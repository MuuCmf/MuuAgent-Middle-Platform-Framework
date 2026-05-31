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
    echo "请基于 service/.env.production.example 创建 .env.production"
    exit 1
fi

# 加载环境变量
export $(cat .env.production | grep -v '^#' | xargs)

# 显示配置信息
echo "数据库: $DATABASE_URL"
echo "Redis: $REDIS_URL"
echo "端口: $PORT"
echo "=========================================="

# 检查 SSL 证书
SSL_DIR="./deploy/nginx/ssl"
if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
    echo "警告: 未找到 SSL 证书，Nginx HTTPS 将不可用"
    echo "如需 HTTPS，请运行: bash deploy/scripts/generate-ssl.sh"
    echo "=========================================="
fi

# 停止现有容器
echo "停止现有容器..."
docker-compose down

# 构建镜像
echo "构建应用镜像..."
docker-compose build

# 启动服务
echo "启动服务..."
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 15

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 健康检查
echo "执行健康检查..."
HEALTH_PORT="${APP_PORT:-3002}"
for i in $(seq 1 10); do
    if curl -sf "http://localhost:$HEALTH_PORT/health" > /dev/null 2>&1; then
        echo "✓ 健康检查通过"
        break
    fi
    if [ "$i" -eq 10 ]; then
        echo "✗ 健康检查失败"
        echo "查看日志: docker-compose logs app"
        exit 1
    fi
    echo "等待服务就绪... ($i/10)"
    sleep 5
done

echo "=========================================="
echo "✓ 部署完成"
echo "=========================================="
echo "服务地址: http://localhost:$HEALTH_PORT"
echo "管理后台: http://localhost:$HEALTH_PORT/admin"
echo "用户端:   http://localhost:$HEALTH_PORT/client"
echo "API 文档: http://localhost:$HEALTH_PORT/api-docs"
echo "=========================================="
