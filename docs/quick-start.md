# 快速部署指南

## 5 分钟快速部署

### 前置条件

- 已安装 Docker 和 Docker Compose
- 硬件：2 核 CPU、4GB 内存、20GB 磁盘

### 步骤 1: 下载项目

```bash
git clone <repository-url>
cd MuuAgent
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp service/.env.example service/.env

# 修改以下关键配置（务必修改默认密码和密钥）
vim service/.env
```

**必须修改的配置**：

| 变量             | 说明       | 生成命令                          |
|-----------------|-----------|-----------------------------------|
| JWT_SECRET      | JWT 密钥   | `openssl rand -base64 64`         |
| MYSQL_PASSWORD  | 数据库密码  | `openssl rand -base64 16`         |

### 步骤 3: 一键部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 等待所有服务健康检查通过
docker-compose ps
```

### 步骤 4: 初始化数据库

```bash
# 执行数据库迁移
docker-compose exec app npx prisma migrate deploy

# 初始化管理员账号
docker-compose exec app npx ts-node prisma/init-admin.ts

# 初始化提示词模板
docker-compose exec app npx ts-node prisma/init-templates.ts
```

### 步骤 5: 验证部署

```bash
# 健康检查
curl http://localhost:3002/health

# 预期返回（示例）
{"status":"ok","timestamp":"2026-05-25T12:00:00.000Z"}
```

### 步骤 6: 访问服务

| 服务       | 地址                           |
|-----------|-------------------------------|
| API 服务   | http://localhost:3002          |
| Swagger   | http://localhost:3002/api-docs |
| 管理后台   | http://localhost:3002/admin/   |
| 用户端     | http://localhost:3002/client/  |

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app

# 重启服务
docker-compose restart app

# 停止服务（保留数据）
docker-compose down

# 停止服务并删除数据卷
docker-compose down -v

# 重新构建镜像
docker-compose build

# 更新版本
git pull
docker-compose build
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
```

## 问题排查

### 端口被占用

```bash
# 通过 .env 修改端口映射
echo "APP_PORT=3003" >> .env
echo "NGINX_HTTP_PORT=8080" >> .env
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查 MySQL 是否启动
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql

# 重置数据库
docker-compose exec app npx prisma db push --accept-data-loss
```

### 前端页面 404

```bash
# 确保 Dockerfile 正确构建了前端
docker-compose build --no-cache app
docker-compose up -d

# 检查静态文件是否已生成
docker-compose exec app ls -la /app/public/
```

### 第三方 API 调用 401

```bash
# 确保请求头包含 x-api-key（租户 API 密钥）
curl -H "x-api-key: tn_xxxxxxxx" http://localhost:3002/api/ai/chat

# x-uid 为可选参数，用于用户数据隔离
curl -H "x-api-key: tn_xxxxxxxx" \
     -H "x-uid: user_12345" \
     http://localhost:3002/api/ai/chat
```

---

需要更多帮助？查看 [完整部署文档](./production-deployment.md)