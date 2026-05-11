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
    `description` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `params` TEXT NOT NULL,
    `config` TEXT NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `code_type` VARCHAR(191) NULL,
    `plugin_name` VARCHAR(191) NULL,
    `function_name` VARCHAR(191) NULL,
    `code_content` TEXT NULL,
    `app_code` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Skill_type_status_idx`(`type`, `status`),
    INDEX `Skill_code_type_idx`(`code_type`),
    INDEX `Skill_app_code_idx`(`app_code`),
    INDEX `Skill_is_public_idx`(`is_public`),
    UNIQUE INDEX `Skill_code_app_code_key`(`code`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `systemPrompt` TEXT NOT NULL,
    `prompt_template_code` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `skills` TEXT NOT NULL,
    `mcpServers` TEXT NULL,
    `knowledgeBases` TEXT NULL,
    `maxSteps` INTEGER NOT NULL DEFAULT 5,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `reasoning_mode` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `reasoning_prompt` TEXT NULL,
    `kb_retrieval_mode` VARCHAR(191) NOT NULL DEFAULT 'tool',
    `app_code` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Agent_status_idx`(`status`),
    INDEX `Agent_app_code_idx`(`app_code`),
    INDEX `Agent_is_public_idx`(`is_public`),
    INDEX `Agent_prompt_template_code_idx`(`prompt_template_code`),
    UNIQUE INDEX `Agent_code_app_code_key`(`code`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `model_id` VARCHAR(191) NULL,
    `model_code` VARCHAR(191) NOT NULL,
    `model_type` VARCHAR(191) NOT NULL,
    `request` TEXT NOT NULL,
    `response` TEXT NULL,
    `cost_ms` INTEGER NOT NULL,
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `client_ip` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiInvokeLog_model_id_createdAt_idx`(`model_id`, `createdAt`),
    INDEX `AiInvokeLog_model_type_createdAt_idx`(`model_type`, `createdAt`),
    INDEX `AiInvokeLog_success_createdAt_idx`(`success`, `createdAt`),
    INDEX `AiInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `AiInvokeLog_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SkillInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `skill_id` VARCHAR(191) NOT NULL,
    `skill_code` VARCHAR(191) NOT NULL,
    `agent_invoke_log_id` VARCHAR(191) NULL,
    `params` TEXT NULL,
    `result` TEXT NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `cost_ms` INTEGER NOT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SkillInvokeLog_skill_id_createdAt_idx`(`skill_id`, `createdAt`),
    INDEX `SkillInvokeLog_skill_code_createdAt_idx`(`skill_code`, `createdAt`),
    INDEX `SkillInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentInvokeLog` (
    `id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NULL,
    `user_message` TEXT NOT NULL,
    `agent_response` TEXT NULL,
    `steps` TEXT NULL,
    `total_cost_ms` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `reasoning_mode` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentInvokeLog_agent_id_createdAt_idx`(`agent_id`, `createdAt`),
    INDEX `AgentInvokeLog_conversation_id_idx`(`conversation_id`),
    INDEX `AgentInvokeLog_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `AgentInvokeLog_app_code_createdAt_idx`(`app_code`, `createdAt`),
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
CREATE TABLE `app_tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `secretKey` VARCHAR(191) NOT NULL,
    `allowed_models` TEXT NULL,
    `allowed_agents` TEXT NULL,
    `allowed_skills` TEXT NULL,
    `allowed_kbs` TEXT NULL,
    `qps_limit` INTEGER NOT NULL DEFAULT 100,
    `daily_limit` INTEGER NOT NULL DEFAULT 10000,
    `token_limit` INTEGER NOT NULL DEFAULT 1000000,
    `enable_oauth` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `expireAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_tenants_code_key`(`code`),
    UNIQUE INDEX `app_tenants_apiKey_key`(`apiKey`),
    INDEX `app_tenants_code_idx`(`code`),
    INDEX `app_tenants_apiKey_idx`(`apiKey`),
    INDEX `app_tenants_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_usage` (
    `id` VARCHAR(191) NOT NULL,
    `app_code` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `call_count` INTEGER NOT NULL DEFAULT 0,
    `token_count` INTEGER NOT NULL DEFAULT 0,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,

    INDEX `app_usage_app_code_idx`(`app_code`),
    INDEX `app_usage_date_idx`(`date`),
    UNIQUE INDEX `app_usage_app_code_date_key`(`app_code`, `date`),
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
    `is_super_admin` BOOLEAN NOT NULL DEFAULT false,
    `status` INTEGER NOT NULL DEFAULT 1,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_username_key`(`username`),
    INDEX `AdminUser_username_idx`(`username`),
    INDEX `AdminUser_status_idx`(`status`),
    INDEX `AdminUser_is_super_admin_idx`(`is_super_admin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbInfo` (
    `id` VARCHAR(191) NOT NULL,
    `kbName` VARCHAR(191) NOT NULL,
    `kbCode` VARCHAR(191) NOT NULL,
    `embedding_model` VARCHAR(191) NOT NULL DEFAULT 'doubao-embedding-v1',
    `chunk_size` INTEGER NOT NULL DEFAULT 500,
    `chunk_overlap` INTEGER NOT NULL DEFAULT 100,
    `similarity_thresh` DOUBLE NOT NULL DEFAULT 0.7,
    `topN` INTEGER NOT NULL DEFAULT 5,
    `retrieval_method` VARCHAR(191) NOT NULL DEFAULT 'vector',
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `app_code` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KbInfo_kbCode_idx`(`kbCode`),
    INDEX `KbInfo_app_code_idx`(`app_code`),
    INDEX `KbInfo_is_public_status_idx`(`is_public`, `status`),
    INDEX `KbInfo_createdBy_idx`(`createdBy`),
    UNIQUE INDEX `KbInfo_kbCode_app_code_key`(`kbCode`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbDocument` (
    `id` VARCHAR(191) NOT NULL,
    `kb_id` VARCHAR(191) NOT NULL,
    `doc_name` VARCHAR(191) NOT NULL,
    `doc_code` VARCHAR(191) NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `file_size_kb` INTEGER NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `total_chunks` INTEGER NOT NULL DEFAULT 0,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KbDocument_kb_id_status_idx`(`kb_id`, `status`),
    INDEX `KbDocument_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbChunk` (
    `id` VARCHAR(191) NOT NULL,
    `kb_id` VARCHAR(191) NOT NULL,
    `doc_id` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `vector_id` VARCHAR(191) NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KbChunk_kb_id_doc_id_idx`(`kb_id`, `doc_id`),
    INDEX `KbChunk_kb_id_status_idx`(`kb_id`, `status`),
    INDEX `KbChunk_vector_id_idx`(`vector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbRetrievalLog` (
    `id` VARCHAR(191) NOT NULL,
    `kb_id` VARCHAR(191) NOT NULL,
    `uid` VARCHAR(191) NULL,
    `query` TEXT NOT NULL,
    `topN` INTEGER NOT NULL,
    `similarity_thresh` DOUBLE NOT NULL,
    `retrieval_count` INTEGER NOT NULL DEFAULT 0,
    `results` TEXT NULL,
    `cost_time` INTEGER NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `client_ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KbRetrievalLog_kb_id_createdAt_idx`(`kb_id`, `createdAt`),
    INDEX `KbRetrievalLog_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `KbRetrievalLog_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_clients` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `client_secret` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `redirect_uris` TEXT NOT NULL,
    `scopes` TEXT NOT NULL,
    `grants` VARCHAR(191) NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    `status` INTEGER NOT NULL DEFAULT 1,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `oauth_clients_client_id_key`(`client_id`),
    INDEX `oauth_clients_client_id_idx`(`client_id`),
    INDEX `oauth_clients_app_code_idx`(`app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `redirect_uri` VARCHAR(191) NOT NULL,
    `scope` TEXT NOT NULL,
    `state` VARCHAR(191) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_codes_code_key`(`code`),
    INDEX `oauth_codes_code_idx`(`code`),
    INDEX `oauth_codes_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `access_token` VARCHAR(191) NOT NULL,
    `refresh_token` VARCHAR(191) NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `scope` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `refresh_expires_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_tokens_access_token_key`(`access_token`),
    UNIQUE INDEX `oauth_tokens_refresh_token_key`(`refresh_token`),
    INDEX `oauth_tokens_access_token_idx`(`access_token`),
    INDEX `oauth_tokens_refresh_token_idx`(`refresh_token`),
    INDEX `oauth_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reasoning_steps` (
    `id` VARCHAR(191) NOT NULL,
    `agent_invoke_log_id` VARCHAR(191) NOT NULL,
    `step_number` INTEGER NOT NULL,
    `thought` TEXT NULL,
    `action` VARCHAR(191) NULL,
    `action_input` TEXT NULL,
    `observation` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `cost_ms` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reasoning_steps_agent_invoke_log_id_idx`(`agent_invoke_log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_type` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `target_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_conversation_type_target_id_createdAt_idx`(`conversation_type`, `target_id`, `createdAt`),
    INDEX `Conversation_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `Conversation_app_code_idx`(`app_code`),
    INDEX `Conversation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `tool_calls` TEXT NULL,
    `tool_call_id` VARCHAR(191) NULL,
    `token_count` INTEGER NULL,
    `reasoning_steps` TEXT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversation_id_createdAt_idx`(`conversation_id`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_templates` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `variables` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `tags` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `created_by` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `prompt_templates_category_status_idx`(`category`, `status`),
    INDEX `prompt_templates_app_code_idx`(`app_code`),
    INDEX `prompt_templates_is_public_idx`(`is_public`),
    INDEX `prompt_templates_is_default_idx`(`is_default`),
    INDEX `prompt_templates_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `prompt_templates_code_app_code_key`(`code`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_versions` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `variables` TEXT NULL,
    `change_log` TEXT NULL,
    `change_type` VARCHAR(191) NOT NULL DEFAULT 'update',
    `created_by` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prompt_versions_template_id_idx`(`template_id`),
    INDEX `prompt_versions_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `prompt_versions_template_id_version_key`(`template_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_invoke_logs` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NULL,
    `template_code` VARCHAR(191) NOT NULL,
    `template_version` INTEGER NOT NULL,
    `variables` TEXT NULL,
    `rendered_prompt` TEXT NOT NULL,
    `model_id` VARCHAR(191) NULL,
    `model_code` VARCHAR(191) NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `cost_ms` INTEGER NOT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prompt_invoke_logs_template_id_idx`(`template_id`),
    INDEX `prompt_invoke_logs_template_code_idx`(`template_code`),
    INDEX `prompt_invoke_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plugins` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
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

-- AddForeignKey
ALTER TABLE `McpRule` ADD CONSTRAINT `McpRule_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `Model`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skill` ADD CONSTRAINT `Skill_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agent` ADD CONSTRAINT `Agent_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInvokeLog` ADD CONSTRAINT `AiInvokeLog_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `Model`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInvokeLog` ADD CONSTRAINT `AiInvokeLog_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SkillInvokeLog` ADD CONSTRAINT `SkillInvokeLog_skill_id_fkey` FOREIGN KEY (`skill_id`) REFERENCES `Skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentInvokeLog` ADD CONSTRAINT `AgentInvokeLog_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `Agent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentInvokeLog` ADD CONSTRAINT `AgentInvokeLog_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModelHealth` ADD CONSTRAINT `ModelHealth_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `Model`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_usage` ADD CONSTRAINT `app_usage_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateLimitCounter` ADD CONSTRAINT `RateLimitCounter_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `RateLimitRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbInfo` ADD CONSTRAINT `KbInfo_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbDocument` ADD CONSTRAINT `KbDocument_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbChunk` ADD CONSTRAINT `KbChunk_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbChunk` ADD CONSTRAINT `KbChunk_doc_id_fkey` FOREIGN KEY (`doc_id`) REFERENCES `KbDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbRetrievalLog` ADD CONSTRAINT `KbRetrievalLog_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_clients` ADD CONSTRAINT `oauth_clients_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reasoning_steps` ADD CONSTRAINT `reasoning_steps_agent_invoke_log_id_fkey` FOREIGN KEY (`agent_invoke_log_id`) REFERENCES `AgentInvokeLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_templates` ADD CONSTRAINT `prompt_templates_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `prompt_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_invoke_logs` ADD CONSTRAINT `prompt_invoke_logs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `prompt_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
