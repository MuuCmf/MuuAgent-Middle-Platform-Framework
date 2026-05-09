-- AlterTable
ALTER TABLE `agent` ADD COLUMN `prompt_template_code` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `prompt_templates` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `variables` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `tags` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prompt_templates_code_key`(`code`),
    INDEX `prompt_templates_category_status_idx`(`category`, `status`),
    INDEX `prompt_templates_code_version_idx`(`code`, `version`),
    INDEX `prompt_templates_isDefault_idx`(`isDefault`),
    INDEX `prompt_templates_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_versions` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `variables` TEXT NULL,
    `changeLog` TEXT NULL,
    `changeType` VARCHAR(191) NOT NULL DEFAULT 'update',
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prompt_versions_templateId_idx`(`templateId`),
    INDEX `prompt_versions_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `prompt_versions_templateId_version_key`(`templateId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_invoke_logs` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `templateCode` VARCHAR(191) NOT NULL,
    `templateVersion` INTEGER NOT NULL,
    `variables` TEXT NULL,
    `renderedPrompt` TEXT NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `modelCode` VARCHAR(191) NULL,
    `success` BOOLEAN NOT NULL,
    `errorMessage` TEXT NULL,
    `costMs` INTEGER NOT NULL,
    `clientIp` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prompt_invoke_logs_templateId_idx`(`templateId`),
    INDEX `prompt_invoke_logs_templateCode_idx`(`templateCode`),
    INDEX `prompt_invoke_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Agent_prompt_template_code_idx` ON `Agent`(`prompt_template_code`);

-- AddForeignKey
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `prompt_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_invoke_logs` ADD CONSTRAINT `prompt_invoke_logs_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `prompt_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
