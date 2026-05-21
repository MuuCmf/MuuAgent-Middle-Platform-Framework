#!/bin/bash

# ===========================================
# 生产环境部署脚本
# ===========================================

set -e

echo "=========================================="
echo "MuuAgent 生产环境部署"
echo "=========================================="

# 检查环境变量
if [ ! -f .env.production ]; then
    echo "错误: 找不到 .env.production 文件"
    exit 1
fi

# 加载环境变量
export $(cat .env.production | grep -v '^#' | xargs)

# 显示配置信息
echo "数据库: $DATABASE_URL"
echo "Redis: $REDIS_URL"
echo "端口: $PORT"
echo "=========================================="

# 停止现有容器
echo "停止现有容器..."
docker-compose down

# 拉取最新镜像
echo "拉取最新镜像..."
docker-compose pull

# 构建镜像
echo "构建应用镜像..."
docker-compose build

# 启动服务
echo "启动服务..."
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 执行数据库迁移
echo "执行数据库迁移..."
docker-compose exec app npx prisma migrate deploy

# 健康检查
echo "执行健康检查..."
curl -f http://localhost:3002/health || exit 1

echo "=========================================="
echo "✓ 部署完成"
echo "=========================================="
echo "服务地址: http://localhost:3002"
echo "API 文档: http://localhost:3002/api"
echo "=========================================="
