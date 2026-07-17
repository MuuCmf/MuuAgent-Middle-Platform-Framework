-- =====================================================
-- 数据迁移脚本: 移除 isPublic 字段,统一使用 appCode 管理
-- =====================================================
-- 创建时间: 2026-07-17
-- 说明:
--   1. isPublic=true 且 appCode 有值 -> 矛盾数据,需要确认处理
--   2. isPublic=true 且 appCode 为空 -> 保持为公共数据
--   3. isPublic=false -> 保持原样
-- =====================================================

USE muuai_middle_platform;

-- 开始事务
START TRANSACTION;

-- 第一步: 检查矛盾数据
-- 如果 appCode 有值但 isPublic=true,需要人工确认处理策略
SELECT
    'agents' as table_name,
    COUNT(*) as conflict_count,
    'appCode IS NOT NULL AND isPublic = true' as conflict_type
FROM agents
WHERE app_code IS NOT NULL AND is_public = true;

SELECT
    'knowledge_bases' as table_name,
    COUNT(*) as conflict_count,
    'appCode IS NOT NULL AND isPublic = true' as conflict_type
FROM knowledge_bases
WHERE app_code IS NOT NULL AND is_public = true;

-- 第二步: 备份受影响的数据
CREATE TABLE IF NOT EXISTS agents_backup_before_migration AS
SELECT * FROM agents WHERE is_public = true;

CREATE TABLE IF NOT EXISTS knowledge_bases_backup_before_migration AS
SELECT * FROM knowledge_bases WHERE is_public = true;

-- 第三步: 迁移数据
-- 将 isPublic=true 且 appCode 为空的记录保持为公共数据(appCode=NULL)
-- 如果有矛盾数据(appCode 有值且 isPublic=true),这里选择保留 appCode,设置 isPublic=false
-- 可根据实际业务需求调整

UPDATE agents
SET
    is_public = false,
    app_code = CASE
        WHEN is_public = true AND app_code IS NULL THEN NULL
        ELSE app_code
    END
WHERE is_public = true;

UPDATE knowledge_bases
SET
    is_public = false,
    app_code = CASE
        WHEN is_public = true AND app_code IS NULL THEN NULL
        ELSE app_code
    END
WHERE is_public = true;

-- 第四步: 验证迁移结果
-- 应该没有 isPublic=true 的数据了
SELECT 'agents' as table_name, COUNT(*) as remaining_public
FROM agents WHERE is_public = true;

SELECT 'knowledge_bases' as table_name, COUNT(*) as remaining_public
FROM knowledge_bases WHERE is_public = true;

-- 统计公共数据(appCode=NULL)数量
SELECT 'agents' as table_name, COUNT(*) as public_count
FROM agents WHERE app_code IS NULL;

SELECT 'knowledge_bases' as table_name, COUNT(*) as public_count
FROM knowledge_bases WHERE app_code IS NULL;

-- 提交事务
COMMIT;

-- =====================================================
-- 后续操作(手动执行):
-- 1. 验证业务逻辑是否正常
-- 2. 运行 Prisma db sync 同步 schema
-- 3. 确认无误后,删除 is_public 字段和索引
-- =====================================================