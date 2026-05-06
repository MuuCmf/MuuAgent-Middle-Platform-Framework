# 生产环境部署文档

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [配置说明](#配置说明)
- [数据库配置](#数据库配置)
- [Docker 部署](#docker-部署)
- [SSL 证书配置](#ssl-证书配置)
- [备份与恢复](#备份与恢复)
- [监控与日志](#监控与日志)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

## 环境要求

### 硬件要求

- **CPU**: 4 核以上
- **内存**: 8GB 以上
- **磁盘**: 50GB 以上（SSD 推荐）

### 软件要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (非 Docker 部署)

## 快速部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd MuuAI-Middle-Platform
```

### 2. 配置环境变量

```bash
# 复制生产环境配置
cp service/.env.production service/.env

# 编辑配置文件
vim service/.env.production
```

**重要**: 修改以下敏感配置：

```env
# 修改数据库密码
MYSQL_PASSWORD=your-strong-password
MYSQL_ROOT_PASSWORD=your-root-password

# 修改 API 密钥
API_KEY=your-api-key

# 修改 JWT 密钥
JWT_SECRET=your-jwt-secret
```

### 3. 一键部署

```bash
# 给脚本执行权限
chmod +x deploy/scripts/*.sh

# 执行部署
./deploy/scripts/deploy.sh
```

### 4. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 健康检查
curl http://localhost:3002/health

# 查看日志
docker-compose logs -f app
```

## 配置说明

### 目录结构

```
MuuAI-Middle-Platform/
├── docker-compose.yml          # Docker Compose 配置
├── Dockerfile                  # 应用 Dockerfile
├── service/
│   ├── .env.production        # 生产环境配置
│   └── prisma/
│       └── schema.prisma      # 数据库 Schema
└── deploy/
    ├── mysql/
    │   ├── init/              # MySQL 初始化脚本
    │   └── conf.d/            # MySQL 配置文件
    ├── nginx/
    │   └── nginx.conf         # Nginx 配置
    └── scripts/
        ├── deploy.sh          # 部署脚本
        └── backup-mysql.sh    # 备份脚本
```

### 环境变量说明

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| DATABASE_URL | MySQL 连接字符串 | - | 是 |
| REDIS_URL | Redis 连接字符串 | redis://redis:6379 | 是 |
| API_KEY | API 鉴权密钥 | - | 是 |
| JWT_SECRET | JWT 签名密钥 | - | 是 |
| PORT | 服务端口 | 3002 | 否 |
| LOG_LEVEL | 日志级别 | warn | 否 |
| NODE_ENV | 运行环境 | production | 是 |

## 数据库配置

### MySQL 配置

#### 1. 修改 Schema

编辑 `service/prisma/schema.prisma`：

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

#### 2. 创建数据库

```sql
CREATE DATABASE muu_ai_platform 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

CREATE USER 'muu_ai'@'%' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON muu_ai_platform.* TO 'muu_ai'@'%';
FLUSH PRIVILEGES;
```

#### 3. 执行迁移

```bash
# Docker 环境
docker-compose exec app npx prisma migrate deploy

# 非 Docker 环境
cd service
npx prisma migrate deploy
```

### MySQL 性能优化

编辑 `deploy/mysql/conf.d/my.cnf`：

```ini
[mysqld]
# 根据服务器内存调整
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
max_connections = 2000
```

## Docker 部署

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

### 单独管理服务

```bash
# 只启动 MySQL
docker-compose up -d mysql

# 只启动 Redis
docker-compose up -d redis

# 只启动应用
docker-compose up -d app
```

### 查看服务状态

```bash
# 查看所有服务状态
docker-compose ps

# 查看特定服务日志
docker-compose logs -f app
docker-compose logs -f mysql
```

## SSL 证书配置

### 1. 获取 SSL 证书

#### 使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

#### 使用自签名证书（测试用）

```bash
# 创建证书目录
mkdir -p deploy/nginx/ssl

# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/nginx/ssl/key.pem \
  -out deploy/nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

### 2. 配置 Nginx

证书文件放置在 `deploy/nginx/ssl/` 目录：

```
deploy/nginx/ssl/
├── cert.pem    # 证书文件
└── key.pem     # 私钥文件
```

### 3. 重启 Nginx

```bash
docker-compose restart nginx
```

## 备份与恢复

### 自动备份

#### 1. 配置定时任务

```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每天凌晨 2 点执行）
0 2 * * * /path/to/deploy/scripts/backup-mysql.sh >> /var/log/mysql-backup.log 2>&1
```

#### 2. 手动备份

```bash
# 执行备份脚本
./deploy/scripts/backup-mysql.sh
```

### 数据恢复

```bash
# 解压备份文件
gunzip /backups/mysql/muu_ai_20260505_020000.sql.gz

# 恢复数据库
docker exec -i muu_ai_mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD} muu_ai_platform < /backups/mysql/muu_ai_20260505_020000.sql
```

## 监控与日志

### 日志查看

```bash
# 应用日志
docker-compose logs -f app

# MySQL 日志
docker-compose logs -f mysql

# Nginx 日志
docker-compose logs -f nginx

# 所有服务日志
docker-compose logs -f
```

### 日志位置

- **应用日志**: Docker 容器标准输出
- **MySQL 日志**: `/var/log/mysql/` (容器内)
- **Nginx 日志**: `/var/log/nginx/` (容器内)

### 健康检查

```bash
# 应用健康检查
curl http://localhost:3002/health

# MySQL 健康检查
docker exec muu_ai_mysql mysqladmin ping -h localhost -uroot -p${MYSQL_ROOT_PASSWORD}

# Redis 健康检查
docker exec muu_ai_redis redis-cli ping
```

## 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查 MySQL 是否启动
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql

# 检查网络连接
docker-compose exec app ping mysql
```

#### 2. 应用启动失败

```bash
# 查看应用日志
docker-compose logs app

# 检查环境变量
docker-compose exec app env | grep DATABASE

# 手动启动调试
docker-compose run --rm app sh
```

#### 3. 内存不足

```bash
# 查看容器资源使用
docker stats

# 调整 Docker 内存限制
# 编辑 docker-compose.yml，添加:
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

### 重置环境

```bash
# 停止并删除所有容器
docker-compose down

# 删除数据卷（危险操作）
docker-compose down -v

# 重新部署
./deploy/scripts/deploy.sh
```

## 性能优化

### 应用优化

1. **启用集群模式**（多核 CPU）

```javascript
// service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3002);
}

if (require('cluster').isMaster) {
  const cpuCount = require('os').cpus().length;
  for (let i = 0; i < cpuCount; i++) {
    require('cluster').fork();
  }
} else {
  bootstrap();
}
```

2. **启用缓存**

```bash
# 在 .env.production 中配置
REDIS_URL=redis://redis:6379
```

### 数据库优化

1. **连接池配置**

```env
DATABASE_URL="mysql://user:pass@host:3306/db?connection_limit=20&pool_timeout=30"
```

2. **索引优化**

```sql
-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query%';

-- 分析查询
EXPLAIN SELECT * FROM AiInvokeLog WHERE uid = 'xxx';
```

### Nginx 优化

编辑 `deploy/nginx/nginx.conf`：

```nginx
# 增加工作进程数
worker_processes auto;

# 增加连接数
events {
    worker_connections 2048;
}

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;
```

## 安全建议

### 1. 修改默认密码

```bash
# 生成强密码
openssl rand -base64 32

# 更新 .env.production
MYSQL_ROOT_PASSWORD=<new-password>
API_KEY=<new-api-key>
JWT_SECRET=<new-jwt-secret>
```

### 2. 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. 定期更新

```bash
# 更新 Docker 镜像
docker-compose pull
docker-compose up -d

# 更新系统包
sudo apt-get update && sudo apt-get upgrade
```

## 附录

### 有用的命令

```bash
# 查看容器资源使用
docker stats

# 进入容器
docker-compose exec app sh

# 导出数据库
docker exec muu_ai_mysql mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} muu_ai_platform > backup.sql

# 导入数据库
docker exec -i muu_ai_mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD} muu_ai_platform < backup.sql

# 清理 Docker 资源
docker system prune -a
```

### 联系支持

如遇到问题，请查看：
- 项目文档: `/docs`
- GitHub Issues: <repository-url>/issues
- 日志文件: Docker 容器日志

---

**最后更新**: 2026-05-05
**版本**: 1.0.0
