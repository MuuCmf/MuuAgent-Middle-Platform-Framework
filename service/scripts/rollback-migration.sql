-- =====================================================
-- 数据迁移回滚脚本: 从备份表恢复数据
-- =====================================================
-- 创建时间: 2026-07-17
-- 说明: 如果迁移后发现问题,使用此脚本回滚
-- =====================================================

USE muuai_middle_platform;

START TRANSACTION;

-- 从备份表恢复 agents
DELETE FROM agents WHERE id IN (SELECT id FROM agents_backup_before_migration);

INSERT INTO agents
SELECT * FROM agents_backup_before_migration;

-- 从备份表恢复 knowledge_bases
DELETE FROM knowledge_bases WHERE id IN (SELECT id FROM knowledge_bases_backup_before_migration);

INSERT INTO knowledge_bases
SELECT * FROM knowledge_bases_backup_before_migration;

COMMIT;

-- 清理备份表(可选)
-- DROP TABLE IF EXISTS agents_backup_before_migration;
-- DROP TABLE IF EXISTS knowledge_bases_backup_before_migration;