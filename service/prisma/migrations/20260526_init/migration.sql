-- CreateTable
CREATE TABLE `models` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `config` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `models_code_key`(`code`),
    INDEX `models_type_status_idx`(`type`, `status`),
    INDEX `models_provider_idx`(`provider`),
    INDEX `models_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_templates` (
    `id` BIGINT NOT NULL DEFAULT 0,
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

    UNIQUE INDEX `model_templates_code_key`(`code`),
    INDEX `model_templates_modelType_status_idx`(`modelType`, `status`),
    INDEX `model_templates_sceneTag_idx`(`sceneTag`),
    INDEX `model_templates_isDefault_idx`(`isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_routing_strategies` (
    `id` BIGINT NOT NULL DEFAULT 0,
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

    UNIQUE INDEX `model_routing_strategies_modelType_key`(`modelType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_routing_rules` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `modelId` BIGINT NOT NULL,
    `qpsLimit` INTEGER NOT NULL DEFAULT 10,
    `maxConcurrent` INTEGER NOT NULL DEFAULT 5,
    `currentConcurrent` INTEGER NOT NULL DEFAULT 0,
    `circuitStatus` VARCHAR(191) NOT NULL DEFAULT 'closed',
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `lastErrorTime` DATETIME(3) NULL,
    `circuitOpenTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `model_routing_rules_modelId_idx`(`modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intent_cache` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `message_hash` VARCHAR(191) NOT NULL,
    `intent` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 1.0,
    `source` VARCHAR(191) NOT NULL DEFAULT 'ai',
    `hit_count` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `intent_cache_message_hash_key`(`message_hash`),
    INDEX `intent_cache_message_hash_idx`(`message_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agents` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `systemPrompt` TEXT NOT NULL,
    `prompt_template_code` VARCHAR(191) NULL,
    `skills` TEXT NOT NULL,
    `mcp_servers` TEXT NULL,
    `maxSteps` INTEGER NOT NULL DEFAULT 5,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `model_template_code` VARCHAR(191) NULL,
    `custom_model_params` TEXT NULL,
    `reasoning_mode` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `reasoning_prompt` TEXT NULL,
    `knowledge_bases` TEXT NULL,
    `kb_retrieval_config` TEXT NULL,
    `allowed_builtin_tools` TEXT NULL,
    `app_code` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `agents_status_idx`(`status`),
    INDEX `agents_app_code_idx`(`app_code`),
    INDEX `agents_is_public_idx`(`is_public`),
    INDEX `agents_prompt_template_code_idx`(`prompt_template_code`),
    INDEX `agents_model_template_code_idx`(`model_template_code`),
    UNIQUE INDEX `agents_code_app_code_key`(`code`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_invoke_logs` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `model_id` BIGINT NULL,
    `model_code` VARCHAR(191) NOT NULL,
    `model_type` VARCHAR(191) NOT NULL,
    `request` LONGTEXT NOT NULL,
    `response` LONGTEXT NULL,
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

    INDEX `ai_invoke_logs_model_id_createdAt_idx`(`model_id`, `createdAt`),
    INDEX `ai_invoke_logs_model_type_createdAt_idx`(`model_type`, `createdAt`),
    INDEX `ai_invoke_logs_success_createdAt_idx`(`success`, `createdAt`),
    INDEX `ai_invoke_logs_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `ai_invoke_logs_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_invoke_logs` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `skill_code` VARCHAR(191) NOT NULL,
    `agent_invoke_log_id` VARCHAR(191) NULL,
    `params` TEXT NULL,
    `result` TEXT NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `cost_ms` INTEGER NOT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skill_invoke_logs_skill_code_createdAt_idx`(`skill_code`, `createdAt`),
    INDEX `skill_invoke_logs_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `skill_invoke_logs_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_invoke_logs` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `agent_id` BIGINT NOT NULL,
    `conversation_id` VARCHAR(191) NULL,
    `user_message` TEXT NOT NULL,
    `agent_response` TEXT NULL,
    `steps` LONGTEXT NULL,
    `total_cost_ms` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `error_message` TEXT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `reasoning_mode` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_invoke_logs_agent_id_createdAt_idx`(`agent_id`, `createdAt`),
    INDEX `agent_invoke_logs_conversation_id_idx`(`conversation_id`),
    INDEX `agent_invoke_logs_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `agent_invoke_logs_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_health_records` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `modelId` BIGINT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `responseTime` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `model_health_records_modelId_checkedAt_idx`(`modelId`, `checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_tenants` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `secretKey` VARCHAR(191) NOT NULL,
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
    `id` BIGINT NOT NULL DEFAULT 0,
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
CREATE TABLE `rate_limit_rules` (
    `id` BIGINT NOT NULL DEFAULT 0,
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

    INDEX `rate_limit_rules_level_status_idx`(`level`, `status`),
    UNIQUE INDEX `rate_limit_rules_level_target_key`(`level`, `target`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit_counters` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `ruleId` BIGINT NOT NULL,
    `currentQps` INTEGER NOT NULL DEFAULT 0,
    `currentConcurrent` INTEGER NOT NULL DEFAULT 0,
    `todayCount` INTEGER NOT NULL DEFAULT 0,
    `lastSecond` INTEGER NOT NULL DEFAULT 0,
    `lastResetDate` VARCHAR(191) NOT NULL DEFAULT '',
    `tokens` DOUBLE NOT NULL DEFAULT 100,
    `lastTokenUpdate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rate_limit_counters_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit_blacklists` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `clientIp` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `blockUntil` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rate_limit_blacklists_clientIp_blockUntil_idx`(`clientIp`, `blockUntil`),
    INDEX `rate_limit_blacklists_appId_blockUntil_idx`(`appId`, `blockUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` BIGINT NOT NULL DEFAULT 0,
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

    UNIQUE INDEX `admin_users_username_key`(`username`),
    INDEX `admin_users_username_idx`(`username`),
    INDEX `admin_users_status_idx`(`status`),
    INDEX `admin_users_is_super_admin_idx`(`is_super_admin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_refresh_tokens` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `adminId` BIGINT NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_refresh_tokens_token_key`(`token`),
    INDEX `admin_refresh_tokens_adminId_idx`(`adminId`),
    INDEX `admin_refresh_tokens_token_idx`(`token`),
    INDEX `admin_refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kb_infos` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `kbName` VARCHAR(191) NOT NULL,
    `kbCode` VARCHAR(191) NOT NULL,
    `embedding_model` VARCHAR(191) NOT NULL DEFAULT 'doubao-embedding-v1',
    `chunk_size` INTEGER NOT NULL DEFAULT 500,
    `chunk_overlap` INTEGER NOT NULL DEFAULT 100,
    `similarity_thresh` DOUBLE NOT NULL DEFAULT 0.5,
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

    INDEX `kb_infos_kbCode_idx`(`kbCode`),
    INDEX `kb_infos_app_code_idx`(`app_code`),
    INDEX `kb_infos_is_public_status_idx`(`is_public`, `status`),
    INDEX `kb_infos_createdBy_idx`(`createdBy`),
    UNIQUE INDEX `kb_infos_kbCode_app_code_key`(`kbCode`, `app_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kb_documents` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `kb_id` BIGINT NOT NULL,
    `doc_code` VARCHAR(191) NULL,
    `file_id` BIGINT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `total_chunks` INTEGER NOT NULL DEFAULT 0,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `kb_documents_kb_id_status_idx`(`kb_id`, `status`),
    INDEX `kb_documents_file_id_idx`(`file_id`),
    INDEX `kb_documents_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kb_chunks` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `kb_id` BIGINT NOT NULL,
    `doc_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `vector_id` VARCHAR(191) NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `kb_chunks_kb_id_doc_id_idx`(`kb_id`, `doc_id`),
    INDEX `kb_chunks_kb_id_status_idx`(`kb_id`, `status`),
    INDEX `kb_chunks_vector_id_idx`(`vector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kb_retrieval_logs` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `kb_id` BIGINT NOT NULL,
    `uid` VARCHAR(191) NULL,
    `query` TEXT NOT NULL,
    `topN` INTEGER NOT NULL,
    `similarity_thresh` DOUBLE NOT NULL,
    `retrieval_count` INTEGER NOT NULL DEFAULT 0,
    `results` TEXT NULL,
    `cost_time` INTEGER NULL,
    `request_id` VARCHAR(191) NULL,
    `client_ip` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kb_retrieval_logs_kb_id_createdAt_idx`(`kb_id`, `createdAt`),
    INDEX `kb_retrieval_logs_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `kb_retrieval_logs_request_id_idx`(`request_id`),
    INDEX `kb_retrieval_logs_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mcp_servers` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `transport` VARCHAR(191) NOT NULL DEFAULT 'http',
    `url` VARCHAR(191) NULL,
    `command` VARCHAR(191) NULL,
    `args` TEXT NULL,
    `env` TEXT NULL,
    `api_key` TEXT NULL,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `tools` TEXT NULL,
    `metadata` TEXT NULL,
    `last_sync_at` DATETIME(3) NULL,
    `last_health_check` DATETIME(3) NULL,
    `health_status` VARCHAR(191) NULL DEFAULT 'unknown',
    `app_code` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `mcp_servers_name_key`(`name`),
    INDEX `mcp_servers_name_idx`(`name`),
    INDEX `mcp_servers_app_code_idx`(`app_code`),
    INDEX `mcp_servers_enabled_idx`(`enabled`),
    INDEX `mcp_servers_health_status_idx`(`health_status`),
    INDEX `mcp_servers_transport_idx`(`transport`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_clients` (
    `id` BIGINT NOT NULL DEFAULT 0,
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
    `id` BIGINT NOT NULL DEFAULT 0,
    `code` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `user_id` BIGINT NOT NULL,
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
    `id` BIGINT NOT NULL DEFAULT 0,
    `access_token` VARCHAR(191) NOT NULL,
    `refresh_token` VARCHAR(191) NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `user_id` BIGINT NOT NULL,
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
    `id` BIGINT NOT NULL DEFAULT 0,
    `agent_invoke_log_id` BIGINT NOT NULL,
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
CREATE TABLE `conversations` (
    `id` BIGINT NOT NULL DEFAULT 0,
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

    INDEX `conversations_conversation_type_target_id_createdAt_idx`(`conversation_type`, `target_id`, `createdAt`),
    INDEX `conversations_uid_createdAt_idx`(`uid`, `createdAt`),
    INDEX `conversations_app_code_idx`(`app_code`),
    INDEX `conversations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `conversation_id` BIGINT NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `tool_calls` TEXT NULL,
    `tool_call_id` VARCHAR(191) NULL,
    `token_count` INTEGER NULL,
    `reasoning_steps` TEXT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversation_id_createdAt_idx`(`conversation_id`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_templates` (
    `id` BIGINT NOT NULL DEFAULT 0,
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
    `id` BIGINT NOT NULL DEFAULT 0,
    `template_id` BIGINT NOT NULL,
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
    `id` BIGINT NOT NULL DEFAULT 0,
    `template_id` BIGINT NULL,
    `template_code` VARCHAR(191) NOT NULL,
    `template_version` INTEGER NOT NULL,
    `variables` TEXT NULL,
    `rendered_prompt` TEXT NOT NULL,
    `model_id` BIGINT NULL,
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
    `id` BIGINT NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE `files` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `file_name` VARCHAR(191) NOT NULL,
    `storage_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_hash` VARCHAR(191) NULL,
    `storage_type` VARCHAR(191) NOT NULL DEFAULT 'local',
    `storage_config` TEXT NULL,
    `business_type` VARCHAR(191) NOT NULL,
    `business_id` VARCHAR(191) NULL,
    `is_processed` BOOLEAN NOT NULL DEFAULT false,
    `process_config` TEXT NULL,
    `process_result` TEXT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `access_count` INTEGER NOT NULL DEFAULT 0,
    `app_code` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `files_business_type_business_id_idx`(`business_type`, `business_id`),
    INDEX `files_file_hash_idx`(`file_hash`),
    INDEX `files_created_by_createdAt_idx`(`created_by`, `createdAt`),
    INDEX `files_app_code_createdAt_idx`(`app_code`, `createdAt`),
    INDEX `files_storage_type_idx`(`storage_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_process_tasks` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `file_id` BIGINT NOT NULL,
    `task_type` VARCHAR(191) NOT NULL,
    `task_config` TEXT NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 5,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `result` TEXT NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cost_ms` INTEGER NOT NULL DEFAULT 0,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_process_tasks_status_priority_idx`(`status`, `priority`),
    INDEX `file_process_tasks_file_id_idx`(`file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intent_keywords` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `intent` VARCHAR(191) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `is_regex` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `intent_keywords_intent_status_idx`(`intent`, `status`),
    INDEX `intent_keywords_keyword_idx`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intent_routing_logs` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `user_message` TEXT NOT NULL,
    `detected_intent` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 1.0,
    `source` VARCHAR(191) NOT NULL DEFAULT 'keyword',
    `selected_model_id` BIGINT NULL,
    `selected_model_code` VARCHAR(191) NULL,
    `model_type` VARCHAR(191) NULL,
    `is_degraded` BOOLEAN NOT NULL DEFAULT false,
    `degrade_reason` VARCHAR(191) NULL,
    `cost_ms` INTEGER NOT NULL DEFAULT 0,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `error_message` TEXT NULL,
    `client_ip` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `intent_routing_logs_detected_intent_createdAt_idx`(`detected_intent`, `createdAt`),
    INDEX `intent_routing_logs_selected_model_code_createdAt_idx`(`selected_model_code`, `createdAt`),
    INDEX `intent_routing_logs_is_degraded_createdAt_idx`(`is_degraded`, `createdAt`),
    INDEX `intent_routing_logs_app_code_createdAt_idx`(`app_code`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `uid` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `has_references` BOOLEAN NOT NULL DEFAULT false,
    `has_scripts` BOOLEAN NOT NULL DEFAULT false,
    `has_assets` BOOLEAN NOT NULL DEFAULT false,
    `instructions` TEXT NULL,
    `frontmatter` JSON NULL,
    `allowed_tools` JSON NULL,
    `directory_path` VARCHAR(191) NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `skills_name_key`(`name`),
    INDEX `skills_app_code_idx`(`app_code`),
    INDEX `skills_name_idx`(`name`),
    INDEX `skills_is_public_idx`(`is_public`),
    INDEX `skills_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_references` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `skill_id` BIGINT NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `skill_references_skill_id_idx`(`skill_id`),
    UNIQUE INDEX `skill_references_skill_id_filePath_key`(`skill_id`, `filePath`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dynamic_client_tools` (
    `id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `parameters` TEXT NOT NULL,
    `executor_type` VARCHAR(191) NOT NULL,
    `executor_config` TEXT NOT NULL,
    `confirm_mode` VARCHAR(191) NOT NULL DEFAULT 'confirm',
    `confirm_message` TEXT NULL,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `uid` VARCHAR(191) NULL,
    `app_code` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dynamic_client_tools_enabled_idx`(`enabled`),
    INDEX `dynamic_client_tools_app_code_idx`(`app_code`),
    INDEX `dynamic_client_tools_uid_idx`(`uid`),
    INDEX `dynamic_client_tools_app_code_uid_idx`(`app_code`, `uid`),
    UNIQUE INDEX `dynamic_client_tools_name_app_code_uid_key`(`name`, `app_code`, `uid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `model_routing_rules` ADD CONSTRAINT `model_routing_rules_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `models`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agents` ADD CONSTRAINT `agents_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_invoke_logs` ADD CONSTRAINT `ai_invoke_logs_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_invoke_logs` ADD CONSTRAINT `ai_invoke_logs_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_invoke_logs` ADD CONSTRAINT `skill_invoke_logs_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_invoke_logs` ADD CONSTRAINT `agent_invoke_logs_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_invoke_logs` ADD CONSTRAINT `agent_invoke_logs_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_health_records` ADD CONSTRAINT `model_health_records_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `models`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_usage` ADD CONSTRAINT `app_usage_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_limit_counters` ADD CONSTRAINT `rate_limit_counters_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `rate_limit_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_refresh_tokens` ADD CONSTRAINT `admin_refresh_tokens_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_infos` ADD CONSTRAINT `kb_infos_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_documents` ADD CONSTRAINT `kb_documents_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `kb_infos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_documents` ADD CONSTRAINT `kb_documents_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_chunks` ADD CONSTRAINT `kb_chunks_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `kb_infos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_chunks` ADD CONSTRAINT `kb_chunks_doc_id_fkey` FOREIGN KEY (`doc_id`) REFERENCES `kb_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_retrieval_logs` ADD CONSTRAINT `kb_retrieval_logs_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `kb_infos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_retrieval_logs` ADD CONSTRAINT `kb_retrieval_logs_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_clients` ADD CONSTRAINT `oauth_clients_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reasoning_steps` ADD CONSTRAINT `reasoning_steps_agent_invoke_log_id_fkey` FOREIGN KEY (`agent_invoke_log_id`) REFERENCES `agent_invoke_logs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_templates` ADD CONSTRAINT `prompt_templates_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `prompt_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_invoke_logs` ADD CONSTRAINT `prompt_invoke_logs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `prompt_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_process_tasks` ADD CONSTRAINT `file_process_tasks_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_references` ADD CONSTRAINT `skill_references_skill_id_fkey` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dynamic_client_tools` ADD CONSTRAINT `dynamic_client_tools_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

