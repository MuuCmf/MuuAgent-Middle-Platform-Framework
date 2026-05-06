-- CreateTable
CREATE TABLE `Model` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `maxTokens` INTEGER NOT NULL DEFAULT 4096,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `config` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Model_code_key`(`code`),
    INDEX `Model_type_status_idx`(`type`, `status`),
    INDEX `Model_provider_idx`(`provider`),
    INDEX `Model_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `modelType` VARCHAR(191) NOT NULL,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `topP` DOUBLE NOT NULL DEFAULT 0.7,
    `contextWindow` INTEGER NOT NULL DEFAULT 8192,
    `maxTokens` INTEGER NOT NULL DEFAULT 1000,
    `sceneTag` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModelTemplate_code_key`(`code`),
    INDEX `ModelTemplate_modelType_status_idx`(`modelType`, `status`),
    INDEX `ModelTemplate_sceneTag_idx`(`sceneTag`),
    INDEX `ModelTemplate_isDefault_idx`(`isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpStrategy` (
    `id` VARCHAR(191) NOT NULL,
    `modelType` VARCHAR(191) NOT NULL,
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'weight',
    `retryCount` INTEGER NOT NULL DEFAULT 3,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `fallbackModelId` VARCHAR(191) NULL,
    `enableCircuit` BOOLEAN NOT NULL DEFAULT true,
    `circuitThreshold` INTEGER NOT NULL DEFAULT 5,
    `circuitTimeout` INTEGER NOT NULL DEFAULT 300000,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `McpStrategy_modelType_key`(`modelType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpRule` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `qpsLimit` INTEGER NOT NULL DEFAULT 10,
    `maxConcurrent` INTEGER NOT NULL DEFAULT 5,
    `currentConcurrent` INTEGER NOT NULL DEFAULT 0,
    `circuitStatus` VARCHAR(191) NOT NULL DEFAULT 'closed',
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `lastErrorTime` DATETIME(3) NULL,
    `circuitOpenTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `McpRule_modelId_idx`(`modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Skill` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `params` VARCHAR(191) NOT NULL,
    `config` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Skill_code_key`(`code`),
    INDEX `Skill_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `systemPrompt` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `skills` VARCHAR(191) NOT NULL,
    `maxSteps` INTEGER NOT NULL DEFAULT 5,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Agent_code_key`(`code`),
    INDEX `Agent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `modelCode` VARCHAR(191) NOT NULL,
    `modelType` VARCHAR(191) NOT NULL,
    `request` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NULL,
    `costMs` INTEGER NOT NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `success` BOOLEAN NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `clientIp` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiInvokeLog_modelId_createdAt_idx`(`modelId`, `createdAt`),
    INDEX `AiInvokeLog_modelType_createdAt_idx`(`modelType`, `createdAt`),
    INDEX `AiInvokeLog_success_createdAt_idx`(`success`, `createdAt`),
    INDEX `AiInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SkillInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `skillCode` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `request` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NULL,
    `costMs` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SkillInvokeLog_skillCode_createdAt_idx`(`skillCode`, `createdAt`),
    INDEX `SkillInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `userMessage` VARCHAR(191) NOT NULL,
    `agentResponse` VARCHAR(191) NULL,
    `steps` VARCHAR(191) NULL,
    `totalCostMs` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `clientIp` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentInvokeLog_agentId_createdAt_idx`(`agentId`, `createdAt`),
    INDEX `AgentInvokeLog_conversationId_idx`(`conversationId`),
    INDEX `AgentInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelHealth` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `responseTime` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModelHealth_modelId_checkedAt_idx`(`modelId`, `checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppTenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `secretKey` VARCHAR(191) NOT NULL,
    `allowedModels` VARCHAR(191) NULL,
    `allowedSkills` VARCHAR(191) NULL,
    `qpsLimit` INTEGER NOT NULL DEFAULT 100,
    `dailyLimit` INTEGER NOT NULL DEFAULT 10000,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `expireAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AppTenant_code_key`(`code`),
    UNIQUE INDEX `AppTenant_apiKey_key`(`apiKey`),
    INDEX `AppTenant_code_idx`(`code`),
    INDEX `AppTenant_apiKey_idx`(`apiKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitRule` (
    `id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `qpsLimit` INTEGER NOT NULL DEFAULT 100,
    `concurrentLimit` INTEGER NOT NULL DEFAULT 10,
    `dailyLimit` INTEGER NOT NULL DEFAULT 10000,
    `burstSize` INTEGER NOT NULL DEFAULT 20,
    `enableQueue` BOOLEAN NOT NULL DEFAULT false,
    `queueSize` INTEGER NOT NULL DEFAULT 100,
    `queueTimeout` INTEGER NOT NULL DEFAULT 5000,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RateLimitRule_level_status_idx`(`level`, `status`),
    UNIQUE INDEX `RateLimitRule_level_target_key`(`level`, `target`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitCounter` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `currentQps` INTEGER NOT NULL DEFAULT 0,
    `currentConcurrent` INTEGER NOT NULL DEFAULT 0,
    `todayCount` INTEGER NOT NULL DEFAULT 0,
    `lastSecond` INTEGER NOT NULL DEFAULT 0,
    `lastResetDate` VARCHAR(191) NOT NULL DEFAULT '',
    `tokens` DOUBLE NOT NULL DEFAULT 100,
    `lastTokenUpdate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RateLimitCounter_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitBlacklist` (
    `id` VARCHAR(191) NOT NULL,
    `clientIp` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `blockUntil` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RateLimitBlacklist_clientIp_blockUntil_idx`(`clientIp`, `blockUntil`),
    INDEX `RateLimitBlacklist_appId_blockUntil_idx`(`appId`, `blockUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `status` INTEGER NOT NULL DEFAULT 1,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_username_key`(`username`),
    INDEX `AdminUser_username_idx`(`username`),
    INDEX `AdminUser_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbInfo` (
    `id` VARCHAR(191) NOT NULL,
    `kbName` VARCHAR(191) NOT NULL,
    `kbCode` VARCHAR(191) NOT NULL,
    `embeddingModel` VARCHAR(191) NOT NULL DEFAULT 'doubao-embedding-v1',
    `chunkSize` INTEGER NOT NULL DEFAULT 500,
    `chunkOverlap` INTEGER NOT NULL DEFAULT 100,
    `similarityThresh` DOUBLE NOT NULL DEFAULT 0.7,
    `topN` INTEGER NOT NULL DEFAULT 5,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `KbInfo_kbCode_key`(`kbCode`),
    INDEX `KbInfo_kbCode_idx`(`kbCode`),
    INDEX `KbInfo_isPublic_status_idx`(`isPublic`, `status`),
    INDEX `KbInfo_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbDocument` (
    `id` VARCHAR(191) NOT NULL,
    `kbId` VARCHAR(191) NOT NULL,
    `docName` VARCHAR(191) NOT NULL,
    `docCode` VARCHAR(191) NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSizeKb` INTEGER NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `totalChunks` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KbDocument_kbId_status_idx`(`kbId`, `status`),
    INDEX `KbDocument_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbChunk` (
    `id` VARCHAR(191) NOT NULL,
    `kbId` VARCHAR(191) NOT NULL,
    `docId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `vectorId` VARCHAR(191) NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KbChunk_kbId_docId_idx`(`kbId`, `docId`),
    INDEX `KbChunk_kbId_status_idx`(`kbId`, `status`),
    INDEX `KbChunk_vectorId_idx`(`vectorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbRetrievalLog` (
    `id` VARCHAR(191) NOT NULL,
    `kbId` VARCHAR(191) NOT NULL,
    `uid` VARCHAR(191) NULL,
    `query` VARCHAR(191) NOT NULL,
    `topN` INTEGER NOT NULL,
    `similarityThresh` DOUBLE NOT NULL,
    `retrievalCount` INTEGER NOT NULL DEFAULT 0,
    `costTime` INTEGER NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `clientIp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KbRetrievalLog_kbId_createdAt_idx`(`kbId`, `createdAt`),
    INDEX `KbRetrievalLog_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `KbRetrievalLog_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbPermission` (
    `id` VARCHAR(191) NOT NULL,
    `kbId` VARCHAR(191) NOT NULL,
    `uid` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `permissions` VARCHAR(191) NOT NULL,
    `grantedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KbPermission_kbId_idx`(`kbId`),
    INDEX `KbPermission_uid_idx`(`uid`),
    UNIQUE INDEX `KbPermission_kbId_uid_key`(`kbId`, `uid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `McpRule` ADD CONSTRAINT `McpRule_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `Model`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInvokeLog` ADD CONSTRAINT `AiInvokeLog_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `Model`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SkillInvokeLog` ADD CONSTRAINT `SkillInvokeLog_skillCode_fkey` FOREIGN KEY (`skillCode`) REFERENCES `Skill`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentInvokeLog` ADD CONSTRAINT `AgentInvokeLog_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModelHealth` ADD CONSTRAINT `ModelHealth_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `Model`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateLimitCounter` ADD CONSTRAINT `RateLimitCounter_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `RateLimitRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbDocument` ADD CONSTRAINT `KbDocument_kbId_fkey` FOREIGN KEY (`kbId`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbChunk` ADD CONSTRAINT `KbChunk_kbId_fkey` FOREIGN KEY (`kbId`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbChunk` ADD CONSTRAINT `KbChunk_docId_fkey` FOREIGN KEY (`docId`) REFERENCES `KbDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbRetrievalLog` ADD CONSTRAINT `KbRetrievalLog_kbId_fkey` FOREIGN KEY (`kbId`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbPermission` ADD CONSTRAINT `KbPermission_kbId_fkey` FOREIGN KEY (`kbId`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
