#!/bin/bash

# ===========================================
# MySQL 数据库备份脚本
# ===========================================

# 配置变量
BACKUP_DIR="/backups/mysql"
MYSQL_CONTAINER="muu_ai_mysql"
MYSQL_USER="root"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-Root_Pass_2026}"
DATABASE="muu_ai_platform"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/muu_ai_$DATE.sql"

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "=========================================="
echo "开始备份数据库: $DATABASE"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 执行备份
docker exec $MYSQL_CONTAINER mysqldump \
  -u$MYSQL_USER \
  -p$MYSQL_PASSWORD \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  $DATABASE > $BACKUP_FILE

# 检查备份是否成功
if [ $? -eq 0 ]; then
    # 压缩备份文件
    gzip $BACKUP_FILE
    echo "✓ 备份成功: ${BACKUP_FILE}.gz"
    
    # 计算备份文件大小
    SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✓ 备份大小: $SIZE"
else
    echo "✗ 备份失败"
    rm -f $BACKUP_FILE
    exit 1
fi

# 清理旧备份（保留最近7天）
echo "=========================================="
echo "清理旧备份文件（保留最近7天）"
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "✓ 清理完成"

# 显示当前备份文件列表
echo "=========================================="
echo "当前备份文件列表:"
ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null | tail -5

echo "=========================================="
echo "备份任务完成"
echo "=========================================="
