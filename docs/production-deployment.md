# 生产环境部署文档

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [Docker 部署详解](#docker-部署详解)
- [配置说明](#配置说明)
- [Qdrant 向量数据库配置](#qdrant-向量数据库配置)
- [SSL 证书配置](#ssl-证书配置)
- [备份与恢复](#备份与恢复)
- [监控与日志](#监控与日志)
- [性能优化](#性能优化)
- [故障排查](#故障排查)
- [安全建议](#安全建议)

## 环境要求

### 硬件要求

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU  | 2 核    | 4 核以上 |
| 内存 | 4GB     | 8GB 以上 |
| 磁盘 | 20GB    | 50GB 以上（SSD 推荐） |

### 软件要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### 端口要求

| 端口   | 服务         | 说明                |
|--------|-------------|-------------------|
| 3002   | App         | AI 中台 API 服务     |
| 3306   | MySQL       | 数据库               |
| 6379   | Redis       | 缓存                 |
| 6333   | Qdrant      | 向量数据库（HTTP）    |
| 6334   | Qdrant      | 向量数据库（gRPC）    |
| 80     | Nginx       | HTTP                |
| 443    | Nginx       | HTTPS               |

## 快速部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd MuuAgent
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp service/.env.example service/.env

# 编辑配置文件
vim service/.env
```

**务必修改以下敏感配置**：

```env
# 数据库配置
DATABASE_URL="mysql://muu_ai:your-strong-password@mysql:3306/muu_ai_platform"

# API 鉴权密钥（生成强密钥：openssl rand -base64 32）
API_KEY="your-api-key"

# JWT 签名密钥（生成强密钥：openssl rand -base64 64）
JWT_SECRET="your-jwt-secret"

# 数据库密码（与 docker-compose.yml 中的 MYSQL_PASSWORD 保持一致）
MYSQL_PASSWORD="your-strong-password"
```

> **注意**: Docker 部署时 `DATABASE_URL` 中的主机名应使用服务名 `mysql` 和 `qdrant`，而非 `localhost`。

### 3. Docker 一键部署

```bash
# 拉取最新镜像并构建
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看启动日志
docker-compose logs -f
```

### 4. 初始化数据库

```bash
# 执行数据库迁移
docker-compose exec app npx prisma migrate deploy

# 初始化管理员账号
docker-compose exec app npx ts-node prisma/init-admin.ts

# 初始化提示词模板
docker-compose exec app npx ts-node prisma/init-templates.ts
```

### 5. 验证部署

```bash
# 健康检查
curl http://localhost:3002/health

# 预期返回
{"status":"ok","timestamp":"2026-05-25T..."}

# 查看服务状态
docker-compose ps
```

### 6. 访问服务

| 服务       | 地址                           |
|-----------|-------------------------------|
| API 服务   | http://localhost:3002          |
| Swagger   | http://localhost:3002/api-docs |
| 管理后台   | http://localhost:3002/admin/   |
| 用户端     | http://localhost:3002/client/  |

## Docker 部署详解

### 架构说明

```
┌─────────────────────────────────────────────────────┐
│                     Nginx (可选)                      │
│               HTTP/HTTPS 反向代理 + 限流              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              AI 中台服务 (NestJS)                    │
│           端口 3002，多阶段构建镜像                   │
│   ├── 后端 API (NestJS)                             │
│   ├── 管理后台静态文件 (/admin/)                     │
│   └── 用户端静态文件 (/client/)                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌────────┬────────┬────┴────┬────────┬───────────────┐
│  MySQL │ Redis  │ Qdrant  │ 数据卷  │   网络        │
│  8.0   │  7     │ latest  │持久化   │   bridge      │
└────────┴────────┴─────────┴────────┴───────────────┘
```

### 多阶段构建

`Dockerfile` 采用四阶段构建：

1. **service-builder** — 编译 NestJS 后端（TypeScript → JavaScript）
2. **admin-builder** — 构建管理后台（Vite 打包）
3. **client-builder** — 构建用户端（Vite 打包）
4. **production** — 合并产物，最小化运行镜像

```bash
# 单独构建镜像
docker build -t muu-agent:latest .

# 使用 docker-compose 构建
docker-compose build
```

### 服务依赖顺序

`docker-compose.yml` 配置了完整的健康检查依赖链：

```
qdrant ─┐
mysql ──┤──► app ──► nginx
redis ──┘
```

每个服务都配置了 `healthcheck`，确保上游服务就绪后才启动下游服务。

### 数据持久化

| 数据卷            | 挂载路径              | 服务   |
|------------------|---------------------|--------|
| mysql_data       | /var/lib/mysql       | MySQL  |
| redis_data       | /data                | Redis  |
| qdrant_data      | /qdrant/storage      | Qdrant |
| app_uploads      | /app/uploads         | App    |

```bash
# 查看数据卷
docker volume ls | grep muu

# 备份数据卷
docker run --rm -v mysql_data:/source -v /backup:/dest alpine tar czf /dest/mysql_data.tar.gz -C /source .
```

### 环境变量管理

支持通过 `.env` 文件集中管理配置：

```bash
# 创建根目录 .env 文件，覆盖 docker-compose 默认值
cat > .env << EOF
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_PASSWORD=your-db-password
API_KEY=your-api-key
JWT_SECRET=your-jwt-secret
APP_PORT=3002
APP_MEMORY_LIMIT=4G
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
EOF
```

> `docker-compose.yml` 中的 `${VAR:-default}` 语法会优先读取 `.env` 文件中的值，未设置时使用默认值。

## 配置说明

### 环境变量速查表

| 变量名                      | 说明                  | 默认值                | 必填 |
|---------------------------|----------------------|---------------------|------|
| DATABASE_URL              | MySQL 连接字符串       | -                   | 是   |
| REDIS_URL                 | Redis 连接地址         | redis://redis:6379  | 否   |
| API_KEY                   | API 鉴权密钥           | -                   | 是   |
| JWT_SECRET                | JWT 签名密钥           | -                   | 是   |
| PORT                      | 服务端口               | 3002                | 否   |
| LOG_LEVEL                 | 日志级别               | warn                | 否   |
| NODE_ENV                  | 运行环境               | production          | 是   |
| VECTOR_DB_HOST            | 向量数据库地址          | localhost           | 否   |
| VECTOR_DB_PORT            | 向量数据库端口          | 6333                | 否   |
| MYSQL_ROOT_PASSWORD       | MySQL root 密码        | Root_Pass_2026      | 是   |
| MYSQL_PASSWORD            | MySQL 应用用户密码      | MuAI_2026_Prod_Pass | 是   |

### 数据库连接池配置

```env
DATABASE_URL="mysql://muu_ai:password@mysql:3306/muu_ai_platform?connection_limit=20&pool_timeout=30"
```

- `connection_limit`: 连接池大小，根据并发量调整（默认 10）
- `pool_timeout`: 连接池超时秒数（默认 30）

### 资源限制配置

通过 docker-compose 的 `deploy.resources` 或 `.env` 文件调整：

```bash
# 限制应用最大内存
APP_MEMORY_LIMIT=2G

# 保留最小内存
APP_MEMORY_RESERVATION=512M
```

## Qdrant 向量数据库配置

### 启用知识库功能

部署后默认集成 Qdrant，如需使用知识库功能，需确认以下配置是否正确：

### 应用配置

在 `service/.env` 中配置：

```env
# Qdrant 连接配置（Docker 部署使用服务名）
VECTOR_DB_HOST=qdrant
VECTOR_DB_PORT=6333
VECTOR_DB_URL=http://qdrant:6333

# 向量维度（与使用的 Embedding 模型一致）
VECTOR_DB_DIMENSION=1536

# 默认集合名称
VECTOR_DB_COLLECTION=knowledge_base
```

### 验证 Qdrant 连接

```bash
# 检查 Qdrant 健康状态
curl http://localhost:6333/healthz

# 通过应用健康检查验证
curl http://localhost:3002/health
```

### 数据持久化

Qdrant 数据存储在 Docker 数据卷 `qdrant_storage` 中，默认路径：

```bash
# 查看 Qdrant 数据
docker exec -it muu_ai_qdrant ls -la /qdrant/storage

# 备份 Qdrant 数据
docker run --rm -v qdrant_data:/source -v /backup:/dest alpine tar czf /dest/qdrant_data.tar.gz -C /source .
```

## SSL 证书配置

### 使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
mkdir -p deploy/nginx/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/nginx/ssl/key.pem

# 重启 Nginx
docker-compose restart nginx
```

### 使用自签名证书（测试用）

```bash
# 创建证书目录
mkdir -p deploy/nginx/ssl

# 生成自签名证书（有效期 365 天）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/nginx/ssl/key.pem \
  -out deploy/nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

### 证书自动续期

```bash
# 添加 crontab 自动续期
crontab -e

# 每月 1 日凌晨 3 点检查续期
0 3 1 * * docker-compose -f /path/to/docker-compose.yml restart nginx
```

## 备份与恢复

### 数据库备份

#### 自动备份

项目提供自动备份脚本，通过 crontab 定时执行：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /path/to/deploy/scripts/backup-mysql.sh >> /var/log/mysql-backup.log 2>&1
```

#### 手动备份

```bash
# 执行备份脚本
./deploy/scripts/backup-mysql.sh

# 或直接使用 docker 命令
docker exec muu_ai_mysql mysqldump \
  -uroot -p${MYSQL_ROOT_PASSWORD} \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  muu_ai_platform | gzip > backup_$(date +%Y%m%d).sql.gz
```

### 数据恢复

```bash
# 解压备份文件
gunzip backup_20260525.sql.gz

# 恢复数据库
cat backup_20260525.sql | docker exec -i muu_ai_mysql mysql \
  -uroot -p${MYSQL_ROOT_PASSWORD} muu_ai_platform
```

### 完整环境备份

```bash
#!/bin/bash
# 全量备份脚本
BACKUP_DIR="/backups/full"

# 备份 MySQL
docker exec muu_ai_mysql mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} \
  --all-databases | gzip > $BACKUP_DIR/mysql_full_$(date +%Y%m%d).sql.gz

# 备份 Docker 数据卷
for vol in mysql_data redis_data qdrant_data; do
  docker run --rm -v ${vol}:/source -v $BACKUP_DIR:/dest \
    alpine tar czf /dest/${vol}_$(date +%Y%m%d).tar.gz -C /source .
done

# 清理 7 天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

## 监控与日志

### 服务健康检查

所有服务均配置了 Docker 原生健康检查：

```bash
# 查看各服务健康状态
docker ps --format "table {{.Names}}\t{{.Status}}"

# 详细健康检查日志
docker inspect --format='{{json .State.Health}}' muu_ai_service | jq
```

### 日志查看

```bash
# 实时查看应用日志
docker-compose logs -f app

# 查看最近 100 行日志
docker-compose logs --tail=100 app

# 按时间过滤
docker-compose logs --since="2026-05-25T10:00:00" app

# 保存日志到文件
docker-compose logs app > app_logs_$(date +%Y%m%d).log
```

### 资源监控

```bash
# 实时资源使用
docker stats

# 查看特定容器资源
docker stats muu_ai_service

# 查看容器详细信息
docker inspect muu_ai_service | jq '.[0].HostConfig.Memory'
```

## 性能优化

### 应用性能

#### 集群模式

利用多核 CPU，在 `main.ts` 中启用集群模式：

```typescript
import { NestFactory } from '@nestjs/core';
import cluster from 'cluster';
import os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3002);
}

if (cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
} else {
  bootstrap();
}
```

#### 缓存优化

确保 Redis 已正确配置以启用缓存和限流：

```env
REDIS_URL=redis://redis:6379
```

### 数据库优化

#### 连接池调整

```env
DATABASE_URL="mysql://muu_ai:password@mysql:3306/muu_ai_platform?connection_limit=20&pool_timeout=30"
```

#### MySQL 配置调优

编辑 `deploy/mysql/conf.d/my.cnf`，根据服务器内存调整：

```ini
innodb_buffer_pool_size = 2G   # 设为可用内存的 60-70%
innodb_log_file_size = 512M
max_connections = 2000
```

### Nginx 优化

编辑 `deploy/nginx/nginx.conf`：

```nginx
worker_processes auto;
events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}
http {
    # 开启缓存
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;
}
```

### Docker 资源限制

```bash
# 通过 .env 文件调整
APP_MEMORY_LIMIT=4G
APP_MEMORY_RESERVATION=1G
```

## 故障排查

### 1. 服务无法启动

```bash
# 检查所有容器状态
docker-compose ps

# 查看详细日志
docker-compose logs app

# 检查端口是否被占用
netstat -tlnp | grep -E '3002|3306|6379|6333'

# 检查 Docker 磁盘空间
docker system df
```

### 2. 数据库连接失败

```bash
# 检查 MySQL 是否正常运行
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql

# 测试连接
docker-compose exec app ping mysql
docker-compose exec app npx prisma db push --accept-data-loss
```

### 3. Qdrant 连接失败

```bash
# 检查 Qdrant 健康状态
curl http://localhost:6333/healthz

# 查看 Qdrant 日志
docker-compose logs qdrant

# 验证集合是否存在
curl http://localhost:6333/collections
```

### 4. 应用启动后 502 错误

```bash
# 未构建前端静态文件
# 解决方法：确保 Dockerfile 包含 admin 和 client 构建阶段
docker-compose build --no-cache app
docker-compose up -d
```

### 5. 内存不足

```bash
# 查看内存使用
free -h

# 调整资源限制
vim .env
APP_MEMORY_LIMIT=1G

# 重启服务
docker-compose down
docker-compose up -d
```

### 6. 重置环境

```bash
# 停止并删除容器（保留数据卷）
docker-compose down

# 停止并删除容器和数据卷（危险操作，会丢失所有数据）
docker-compose down -v

# 重新构建并启动
docker-compose build
docker-compose up -d
```

### 7. 更新版本

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 重启服务
docker-compose up -d

# 执行数据库迁移（如有 schema 变更）
docker-compose exec app npx prisma migrate deploy
```

## 安全建议

### 1. 修改默认密钥

```bash
# 生成强密码
API_KEY=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
MYSQL_PASSWORD=$(openssl rand -base64 16)

# 更新 .env 文件
sed -i "s/API_KEY=.*/API_KEY=$API_KEY/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$MYSQL_PASSWORD/" .env
```

### 2. 防火墙配置

```bash
# 使用 ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# 限制数据库端口仅内网访问
sudo ufw deny 3306/tcp
sudo ufw deny 6379/tcp
sudo ufw deny 6333/tcp
sudo ufw deny 6334/tcp
```

### 3. Nginx 安全头

Nginx 配置已包含以下安全头：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 4. 定期更新

```bash
# 更新 Docker 镜像
docker-compose pull

# 更新系统
sudo apt-get update && sudo apt-get upgrade

# 更新项目代码
git pull
docker-compose build
docker-compose up -d
```

### 5. 安全审计

```bash
# 查看所有开放端口
netstat -tulpn

# 检查容器安全配置
docker inspect muu_ai_service | jq '.[0].HostConfig.SecurityOpt'

# 查看非 root 用户运行确认
docker exec muu_ai_service whoami
```

## 附录

### 常用 Docker 命令速查

```bash
# 镜像管理
docker images                    # 列出镜像
docker rmi <image_id>            # 删除镜像
docker system prune -a           # 清理所有未使用镜像

# 容器管理
docker ps -a                     # 列出所有容器
docker logs -f <container>       # 查看日志
docker exec -it <container> sh   # 进入容器
docker stats                     # 查看资源使用

# 数据卷管理
docker volume ls                 # 列出数据卷
docker volume inspect <volume>   # 查看数据卷详情

# 网络管理
docker network ls                # 列出网络
docker network inspect <network> # 查看网络详情
```

### docker-compose 命令速查

```bash
docker-compose up -d             # 启动所有服务
docker-compose down              # 停止所有服务
docker-compose restart           # 重启所有服务
docker-compose logs -f           # 查看所有日志
docker-compose ps                # 查看服务状态
docker-compose build             # 构建镜像
docker-compose pull              # 拉取镜像
docker-compose config            # 验证配置
```