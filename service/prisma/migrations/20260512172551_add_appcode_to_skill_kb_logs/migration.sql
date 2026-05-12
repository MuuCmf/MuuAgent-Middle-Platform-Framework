-- AlterTable
ALTER TABLE `kbretrievallog` ADD COLUMN `app_code` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `skillinvokelog` ADD COLUMN `app_code` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `KbRetrievalLog_app_code_createdAt_idx` ON `KbRetrievalLog`(`app_code`, `createdAt`);

-- CreateIndex
CREATE INDEX `SkillInvokeLog_app_code_createdAt_idx` ON `SkillInvokeLog`(`app_code`, `createdAt`);

-- AddForeignKey
ALTER TABLE `SkillInvokeLog` ADD CONSTRAINT `SkillInvokeLog_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbRetrievalLog` ADD CONSTRAINT `KbRetrievalLog_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
