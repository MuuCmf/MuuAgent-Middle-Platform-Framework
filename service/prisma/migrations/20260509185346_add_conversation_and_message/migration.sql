/*
  Warnings:

  - You are about to drop the `reasoning_step` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `reasoning_step` DROP FOREIGN KEY `reasoning_step_agent_invoke_log_id_fkey`;

-- DropTable
DROP TABLE `reasoning_step`;

-- CreateTable
CREATE TABLE `reasoning_steps` (
    `id` VARCHAR(191) NOT NULL,
    `agent_invoke_log_id` VARCHAR(191) NOT NULL,
    `step_number` INTEGER NOT NULL,
    `thought` TEXT NULL,
    `action` VARCHAR(191) NULL,
    `actionInput` TEXT NULL,
    `observation` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `costMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reasoning_steps_agent_invoke_log_id_idx`(`agent_invoke_log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `conversationType` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `targetId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_conversationType_targetId_createdAt_idx`(`conversationType`, `targetId`, `createdAt`),
    INDEX `Conversation_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `Conversation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `toolCalls` TEXT NULL,
    `toolCallId` VARCHAR(191) NULL,
    `tokenCount` INTEGER NULL,
    `reasoningSteps` TEXT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reasoning_steps` ADD CONSTRAINT `reasoning_steps_agent_invoke_log_id_fkey` FOREIGN KEY (`agent_invoke_log_id`) REFERENCES `AgentInvokeLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
