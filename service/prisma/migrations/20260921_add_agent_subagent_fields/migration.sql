-- 为智能体调用日志增加子代理调用链追踪字段
-- 与 schema.prisma 中 AgentInvokeLog 模型同步变更
-- 支持: 子代理调用（call_agent 工具）的链路追踪与父子关系记录

ALTER TABLE `muuagent_agent_invoke_logs`
  ADD COLUMN `trace_id` VARCHAR(64) NULL COMMENT '调用链追踪ID（父子调用链共享）' AFTER `reasoning_mode`,
  ADD COLUMN `parent_agent_id` BIGINT NULL COMMENT '直接父智能体ID（子代理调用时记录）' AFTER `trace_id`,
  ADD COLUMN `parent_conversation_id` VARCHAR(64) NULL COMMENT '直接父会话ID' AFTER `parent_agent_id`;

CREATE INDEX `muuagent_agent_invoke_logs_trace_id_idx` ON `muuagent_agent_invoke_logs` (`trace_id`);
