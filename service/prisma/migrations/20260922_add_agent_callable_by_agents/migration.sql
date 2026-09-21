-- 为智能体表增加子代理调用白名单字段
-- 与 schema.prisma 中 Agent 模型同步变更
-- 语义: callable_by_agents 为 JSON 数组（智能体 code 列表）
--   NULL            = 不限制（任何智能体都可调用）
--   "[]"            = 禁止被任何智能体调用
--   含 code 的数组   = 仅允许列表中的智能体调用

ALTER TABLE `muuagent_agents`
  ADD COLUMN `callable_by_agents` TEXT NULL COMMENT '可被调用的智能体白名单(JSON数组code列表); NULL=不限制, []="禁止被调用", 有值=仅允许列表中的智能体调用' AFTER `allowed_builtin_tools`;
