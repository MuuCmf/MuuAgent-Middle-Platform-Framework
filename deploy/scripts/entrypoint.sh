#!/bin/sh
set -e

echo "=========================================="
echo "MuuAgent 启动前初始化"
echo "=========================================="

# 执行 Prisma 数据库迁移
echo "[1/2] 执行数据库迁移..."
npx prisma migrate deploy

echo "[2/2] 启动应用..."
echo "=========================================="

# 启动应用（dumb-init 已在 Dockerfile ENTRYPOINT 中配置）
exec node dist/main.js
