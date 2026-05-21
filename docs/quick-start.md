# 快速部署指南

## 5 分钟快速部署

### 前置条件

- 已安装 Docker 和 Docker Compose
- 有 MySQL 数据库（或使用 Docker 自带）

### 步骤 1: 下载项目

```bash
git clone <repository-url>
cd MuuAgent
```

### 步骤 2: 修改配置

编辑 `service/.env.production`：

```env
# 必须修改的配置
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_PASSWORD=your-db-password
API_KEY=your-api-key
JWT_SECRET=your-jwt-secret
```

### 步骤 3: 一键部署

```bash
# Linux/Mac
chmod +x deploy/scripts/deploy.sh
./deploy/scripts/deploy.sh

# Windows PowerShell
docker-compose up -d
```

### 步骤 4: 验证部署

访问: http://localhost:3002/health

返回: `{"status":"ok"}` 表示部署成功

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

## 下一步

- 查看 [完整部署文档](./production-deployment.md)
- 配置 [SSL 证书](./production-deployment.md#ssl-证书配置)
- 设置 [自动备份](./production-deployment.md#备份与恢复)

## 问题排查

### 端口被占用

```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "3003:3002"  # 改为其他端口
```

### 数据库连接失败

```bash
# 检查 MySQL 是否启动
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql
```

### 权限问题

```bash
# 给脚本执行权限
chmod +x deploy/scripts/*.sh

# Docker 权限
sudo usermod -aG docker $USER
```

---

需要帮助? 查看 [完整文档](./production-deployment.md)
