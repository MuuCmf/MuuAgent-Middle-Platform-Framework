-- 移除废弃的 skills 表
DROP TABLE IF EXISTS `skills`;

-- 移除 skill_invoke_logs 表中的 skill_id 字段
ALTER TABLE `skill_invoke_logs` DROP FOREIGN KEY IF EXISTS `skill_invoke_logs_skillId_fkey`;
ALTER TABLE `skill_invoke_logs` DROP COLUMN `skill_id`;

-- 移除相关索引
DROP INDEX IF EXISTS `skill_invoke_logs_skillId_createdAt_idx`;