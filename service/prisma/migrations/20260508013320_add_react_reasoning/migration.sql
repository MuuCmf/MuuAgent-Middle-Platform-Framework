-- AlterTable
ALTER TABLE `agent` ADD COLUMN `kb_retrieval_method` VARCHAR(191) NOT NULL DEFAULT 'auto',
    ADD COLUMN `kb_retrieval_mode` VARCHAR(191) NOT NULL DEFAULT 'auto',
    ADD COLUMN `reasoning_mode` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    ADD COLUMN `reasoning_prompt` TEXT NULL;

-- AlterTable
ALTER TABLE `agentinvokelog` ADD COLUMN `reasoning_mode` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `reasoning_step` (
    `id` VARCHAR(191) NOT NULL,
    `agent_invoke_log_id` VARCHAR(191) NOT NULL,
    `step_number` INTEGER NOT NULL,
    `step_type` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `thought` TEXT NULL,
    `action` VARCHAR(191) NULL,
    `action_input` TEXT NULL,
    `observation` TEXT NULL,
    `tool_output` TEXT NULL,
    `cost_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reasoning_step_agent_invoke_log_id_idx`(`agent_invoke_log_id`),
    INDEX `reasoning_step_step_type_idx`(`step_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reasoning_step` ADD CONSTRAINT `reasoning_step_agent_invoke_log_id_fkey` FOREIGN KEY (`agent_invoke_log_id`) REFERENCES `AgentInvokeLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
