-- AlterTable
ALTER TABLE `agent` ADD COLUMN `mcpServers` VARCHAR(191) NULL DEFAULT '[]',
    MODIFY `skills` VARCHAR(191) NOT NULL DEFAULT '[]';
