-- AlterTable
ALTER TABLE `skill` ADD COLUMN `code_content` TEXT NULL,
    ADD COLUMN `code_type` VARCHAR(191) NULL,
    ADD COLUMN `function_name` VARCHAR(191) NULL,
    ADD COLUMN `plugin_name` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `plugins` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `path` VARCHAR(191) NOT NULL,
    `config` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plugins_name_key`(`name`),
    INDEX `plugins_name_idx`(`name`),
    INDEX `plugins_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Skill_code_type_idx` ON `Skill`(`code_type`);
