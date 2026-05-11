/*
  Warnings:

  - You are about to drop the column `agentId` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `agentResponse` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `clientIp` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `inputTokens` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `outputTokens` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `totalCostMs` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `userMessage` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `clientIp` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `costMs` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `inputTokens` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `modelCode` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `modelId` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `modelType` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `outputTokens` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `aiinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `conversationType` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastMessageAt` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `messageCount` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `chunkIndex` on the `kbchunk` table. All the data in the column will be lost.
  - You are about to drop the column `docId` on the `kbchunk` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `kbchunk` table. All the data in the column will be lost.
  - You are about to drop the column `kbId` on the `kbchunk` table. All the data in the column will be lost.
  - You are about to drop the column `vectorId` on the `kbchunk` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `docCode` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `docName` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `fileSizeKb` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `kbId` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `totalChunks` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `kbdocument` table. All the data in the column will be lost.
  - You are about to drop the column `chunkOverlap` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `chunkSize` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `embeddingModel` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `retrievalMethod` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `similarityThresh` on the `kbinfo` table. All the data in the column will be lost.
  - You are about to drop the column `grantedBy` on the `kbpermission` table. All the data in the column will be lost.
  - You are about to drop the column `kbId` on the `kbpermission` table. All the data in the column will be lost.
  - You are about to drop the column `clientIp` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `costTime` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `kbId` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `retrievalCount` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `similarityThresh` on the `kbretrievallog` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `reasoningSteps` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `tokenCount` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `toolCallId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `toolCalls` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `oauth_clients` table. All the data in the column will be lost.
  - You are about to drop the column `clientSecret` on the `oauth_clients` table. All the data in the column will be lost.
  - You are about to drop the column `redirectUris` on the `oauth_clients` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `oauth_codes` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `oauth_codes` table. All the data in the column will be lost.
  - You are about to drop the column `redirectUri` on the `oauth_codes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `oauth_codes` table. All the data in the column will be lost.
  - You are about to drop the column `accessToken` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `refreshExpiresAt` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `oauth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `clientIp` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `costMs` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `modelCode` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `modelId` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `renderedPrompt` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `templateCode` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `templateId` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `templateVersion` on the `prompt_invoke_logs` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `prompt_templates` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `prompt_templates` table. All the data in the column will be lost.
  - You are about to drop the column `changeLog` on the `prompt_versions` table. All the data in the column will be lost.
  - You are about to drop the column `changeType` on the `prompt_versions` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `prompt_versions` table. All the data in the column will be lost.
  - You are about to drop the column `templateId` on the `prompt_versions` table. All the data in the column will be lost.
  - You are about to drop the column `actionInput` on the `reasoning_steps` table. All the data in the column will be lost.
  - You are about to drop the column `costMs` on the `reasoning_steps` table. All the data in the column will be lost.
  - You are about to drop the column `agentId` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `costMs` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `request` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `skillCode` on the `skillinvokelog` table. All the data in the column will be lost.
  - You are about to drop the `apptenant` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code,app_code]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kbCode,app_code]` on the table `KbInfo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kb_id,uid]` on the table `KbPermission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[client_id]` on the table `oauth_clients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[access_token]` on the table `oauth_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refresh_token]` on the table `oauth_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,app_code]` on the table `prompt_templates` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[template_id,version]` on the table `prompt_versions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,app_code]` on the table `Skill` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `agent_id` to the `AgentInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_cost_ms` to the `AgentInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_message` to the `AgentInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_ms` to the `AiInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model_code` to the `AiInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model_type` to the `AiInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_id` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chunk_index` to the `KbChunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `doc_id` to the `KbChunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kb_id` to the `KbChunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `doc_name` to the `KbDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_size_kb` to the `KbDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_type` to the `KbDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_url` to the `KbDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kb_id` to the `KbDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kb_id` to the `KbPermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_time` to the `KbRetrievalLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kb_id` to the `KbRetrievalLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `request_id` to the `KbRetrievalLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `similarity_thresh` to the `KbRetrievalLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `conversation_id` to the `Message` table without a default value. This is not possible if the table is not empty.
  - The required column `client_id` was added to the `oauth_clients` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `client_secret` to the `oauth_clients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `redirect_uris` to the `oauth_clients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `oauth_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `oauth_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `redirect_uri` to the `oauth_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `oauth_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `access_token` to the `oauth_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `oauth_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `oauth_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `oauth_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_ms` to the `prompt_invoke_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rendered_prompt` to the `prompt_invoke_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `template_code` to the `prompt_invoke_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `template_version` to the `prompt_invoke_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `template_id` to the `prompt_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_ms` to the `SkillInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skill_code` to the `SkillInvokeLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skill_id` to the `SkillInvokeLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `agentinvokelog` DROP FOREIGN KEY `AgentInvokeLog_agentId_fkey`;

-- DropForeignKey
ALTER TABLE `aiinvokelog` DROP FOREIGN KEY `AiInvokeLog_modelId_fkey`;

-- DropForeignKey
ALTER TABLE `kbchunk` DROP FOREIGN KEY `KbChunk_docId_fkey`;

-- DropForeignKey
ALTER TABLE `kbchunk` DROP FOREIGN KEY `KbChunk_kbId_fkey`;

-- DropForeignKey
ALTER TABLE `kbdocument` DROP FOREIGN KEY `KbDocument_kbId_fkey`;

-- DropForeignKey
ALTER TABLE `kbpermission` DROP FOREIGN KEY `KbPermission_kbId_fkey`;

-- DropForeignKey
ALTER TABLE `kbretrievallog` DROP FOREIGN KEY `KbRetrievalLog_kbId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `oauth_codes` DROP FOREIGN KEY `oauth_codes_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `oauth_tokens` DROP FOREIGN KEY `oauth_tokens_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `prompt_invoke_logs` DROP FOREIGN KEY `prompt_invoke_logs_templateId_fkey`;

-- DropForeignKey
ALTER TABLE `prompt_versions` DROP FOREIGN KEY `prompt_versions_templateId_fkey`;

-- DropForeignKey
ALTER TABLE `skillinvokelog` DROP FOREIGN KEY `SkillInvokeLog_skillCode_fkey`;

-- DropIndex
DROP INDEX `Agent_code_key` ON `agent`;

-- DropIndex
DROP INDEX `AgentInvokeLog_agentId_createdAt_idx` ON `agentinvokelog`;

-- DropIndex
DROP INDEX `AgentInvokeLog_conversationId_idx` ON `agentinvokelog`;

-- DropIndex
DROP INDEX `AiInvokeLog_modelId_createdAt_idx` ON `aiinvokelog`;

-- DropIndex
DROP INDEX `AiInvokeLog_modelType_createdAt_idx` ON `aiinvokelog`;

-- DropIndex
DROP INDEX `Conversation_conversationType_targetId_createdAt_idx` ON `conversation`;

-- DropIndex
DROP INDEX `KbChunk_kbId_docId_idx` ON `kbchunk`;

-- DropIndex
DROP INDEX `KbChunk_kbId_status_idx` ON `kbchunk`;

-- DropIndex
DROP INDEX `KbChunk_vectorId_idx` ON `kbchunk`;

-- DropIndex
DROP INDEX `KbDocument_createdBy_idx` ON `kbdocument`;

-- DropIndex
DROP INDEX `KbDocument_kbId_status_idx` ON `kbdocument`;

-- DropIndex
DROP INDEX `KbInfo_isPublic_status_idx` ON `kbinfo`;

-- DropIndex
DROP INDEX `KbInfo_kbCode_key` ON `kbinfo`;

-- DropIndex
DROP INDEX `KbPermission_kbId_uid_key` ON `kbpermission`;

-- DropIndex
DROP INDEX `KbRetrievalLog_kbId_createdAt_idx` ON `kbretrievallog`;

-- DropIndex
DROP INDEX `KbRetrievalLog_requestId_idx` ON `kbretrievallog`;

-- DropIndex
DROP INDEX `Message_conversationId_createdAt_idx` ON `message`;

-- DropIndex
DROP INDEX `oauth_clients_clientId_idx` ON `oauth_clients`;

-- DropIndex
DROP INDEX `oauth_clients_clientId_key` ON `oauth_clients`;

-- DropIndex
DROP INDEX `oauth_codes_expiresAt_idx` ON `oauth_codes`;

-- DropIndex
DROP INDEX `oauth_tokens_accessToken_idx` ON `oauth_tokens`;

-- DropIndex
DROP INDEX `oauth_tokens_accessToken_key` ON `oauth_tokens`;

-- DropIndex
DROP INDEX `oauth_tokens_expiresAt_idx` ON `oauth_tokens`;

-- DropIndex
DROP INDEX `oauth_tokens_refreshToken_idx` ON `oauth_tokens`;

-- DropIndex
DROP INDEX `oauth_tokens_refreshToken_key` ON `oauth_tokens`;

-- DropIndex
DROP INDEX `prompt_invoke_logs_templateCode_idx` ON `prompt_invoke_logs`;

-- DropIndex
DROP INDEX `prompt_templates_code_key` ON `prompt_templates`;

-- DropIndex
DROP INDEX `prompt_templates_code_version_idx` ON `prompt_templates`;

-- DropIndex
DROP INDEX `prompt_templates_isDefault_idx` ON `prompt_templates`;

-- DropIndex
DROP INDEX `prompt_versions_templateId_version_key` ON `prompt_versions`;

-- DropIndex
DROP INDEX `Skill_code_key` ON `skill`;

-- DropIndex
DROP INDEX `SkillInvokeLog_skillCode_createdAt_idx` ON `skillinvokelog`;

-- AlterTable
ALTER TABLE `agent` ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `systemPrompt` TEXT NOT NULL,
    MODIFY `skills` TEXT NOT NULL,
    MODIFY `mcpServers` TEXT NULL,
    MODIFY `knowledgeBases` TEXT NULL;

-- AlterTable
ALTER TABLE `agentinvokelog` DROP COLUMN `agentId`,
    DROP COLUMN `agentResponse`,
    DROP COLUMN `clientIp`,
    DROP COLUMN `conversationId`,
    DROP COLUMN `errorMessage`,
    DROP COLUMN `inputTokens`,
    DROP COLUMN `outputTokens`,
    DROP COLUMN `totalCostMs`,
    DROP COLUMN `userMessage`,
    ADD COLUMN `agent_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `agent_response` TEXT NULL,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `client_ip` VARCHAR(191) NULL,
    ADD COLUMN `conversation_id` VARCHAR(191) NULL,
    ADD COLUMN `error_message` TEXT NULL,
    ADD COLUMN `input_tokens` INTEGER NULL,
    ADD COLUMN `output_tokens` INTEGER NULL,
    ADD COLUMN `total_cost_ms` INTEGER NOT NULL,
    ADD COLUMN `user_message` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `aiinvokelog` DROP COLUMN `clientIp`,
    DROP COLUMN `costMs`,
    DROP COLUMN `errorMessage`,
    DROP COLUMN `inputTokens`,
    DROP COLUMN `modelCode`,
    DROP COLUMN `modelId`,
    DROP COLUMN `modelType`,
    DROP COLUMN `outputTokens`,
    DROP COLUMN `userAgent`,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `client_ip` VARCHAR(191) NULL,
    ADD COLUMN `cost_ms` INTEGER NOT NULL,
    ADD COLUMN `error_message` TEXT NULL,
    ADD COLUMN `input_tokens` INTEGER NULL,
    ADD COLUMN `model_code` VARCHAR(191) NOT NULL,
    ADD COLUMN `model_id` VARCHAR(191) NULL,
    ADD COLUMN `model_type` VARCHAR(191) NOT NULL,
    ADD COLUMN `output_tokens` INTEGER NULL,
    ADD COLUMN `user_agent` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `conversation` DROP COLUMN `conversationType`,
    DROP COLUMN `lastMessageAt`,
    DROP COLUMN `messageCount`,
    DROP COLUMN `targetId`,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `conversation_type` VARCHAR(191) NOT NULL DEFAULT 'agent',
    ADD COLUMN `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `message_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `target_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `kbchunk` DROP COLUMN `chunkIndex`,
    DROP COLUMN `docId`,
    DROP COLUMN `isDeleted`,
    DROP COLUMN `kbId`,
    DROP COLUMN `vectorId`,
    ADD COLUMN `chunk_index` INTEGER NOT NULL,
    ADD COLUMN `doc_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kb_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `vector_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `kbdocument` DROP COLUMN `createdBy`,
    DROP COLUMN `docCode`,
    DROP COLUMN `docName`,
    DROP COLUMN `fileSizeKb`,
    DROP COLUMN `fileType`,
    DROP COLUMN `fileUrl`,
    DROP COLUMN `isDeleted`,
    DROP COLUMN `kbId`,
    DROP COLUMN `totalChunks`,
    DROP COLUMN `updatedBy`,
    ADD COLUMN `created_by` VARCHAR(191) NULL,
    ADD COLUMN `doc_code` VARCHAR(191) NULL,
    ADD COLUMN `doc_name` VARCHAR(191) NOT NULL,
    ADD COLUMN `file_size_kb` INTEGER NOT NULL,
    ADD COLUMN `file_type` VARCHAR(191) NOT NULL,
    ADD COLUMN `file_url` VARCHAR(191) NOT NULL,
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kb_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `total_chunks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updated_by` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `kbinfo` DROP COLUMN `chunkOverlap`,
    DROP COLUMN `chunkSize`,
    DROP COLUMN `embeddingModel`,
    DROP COLUMN `isDeleted`,
    DROP COLUMN `isPublic`,
    DROP COLUMN `retrievalMethod`,
    DROP COLUMN `similarityThresh`,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `chunk_overlap` INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN `chunk_size` INTEGER NOT NULL DEFAULT 500,
    ADD COLUMN `embedding_model` VARCHAR(191) NOT NULL DEFAULT 'doubao-embedding-v1',
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `retrieval_method` VARCHAR(191) NOT NULL DEFAULT 'vector',
    ADD COLUMN `similarity_thresh` DOUBLE NOT NULL DEFAULT 0.7,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `kbpermission` DROP COLUMN `grantedBy`,
    DROP COLUMN `kbId`,
    ADD COLUMN `granted_by` VARCHAR(191) NULL,
    ADD COLUMN `kb_id` VARCHAR(191) NOT NULL,
    MODIFY `permissions` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `kbretrievallog` DROP COLUMN `clientIp`,
    DROP COLUMN `costTime`,
    DROP COLUMN `kbId`,
    DROP COLUMN `requestId`,
    DROP COLUMN `retrievalCount`,
    DROP COLUMN `similarityThresh`,
    ADD COLUMN `client_ip` VARCHAR(191) NULL,
    ADD COLUMN `cost_time` INTEGER NOT NULL,
    ADD COLUMN `kb_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `request_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `retrieval_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `similarity_thresh` DOUBLE NOT NULL,
    MODIFY `query` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `message` DROP COLUMN `conversationId`,
    DROP COLUMN `reasoningSteps`,
    DROP COLUMN `tokenCount`,
    DROP COLUMN `toolCallId`,
    DROP COLUMN `toolCalls`,
    ADD COLUMN `conversation_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `reasoning_steps` TEXT NULL,
    ADD COLUMN `token_count` INTEGER NULL,
    ADD COLUMN `tool_call_id` VARCHAR(191) NULL,
    ADD COLUMN `tool_calls` TEXT NULL;

-- AlterTable
ALTER TABLE `oauth_clients` DROP COLUMN `clientId`,
    DROP COLUMN `clientSecret`,
    DROP COLUMN `redirectUris`,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `client_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `client_secret` VARCHAR(191) NOT NULL,
    ADD COLUMN `redirect_uris` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `oauth_codes` DROP COLUMN `clientId`,
    DROP COLUMN `expiresAt`,
    DROP COLUMN `redirectUri`,
    DROP COLUMN `userId`,
    ADD COLUMN `client_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `expires_at` DATETIME(3) NOT NULL,
    ADD COLUMN `redirect_uri` VARCHAR(191) NOT NULL,
    ADD COLUMN `user_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `oauth_tokens` DROP COLUMN `accessToken`,
    DROP COLUMN `clientId`,
    DROP COLUMN `expiresAt`,
    DROP COLUMN `refreshExpiresAt`,
    DROP COLUMN `refreshToken`,
    DROP COLUMN `userId`,
    ADD COLUMN `access_token` VARCHAR(191) NOT NULL,
    ADD COLUMN `client_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `expires_at` DATETIME(3) NOT NULL,
    ADD COLUMN `refresh_expires_at` DATETIME(3) NULL,
    ADD COLUMN `refresh_token` VARCHAR(191) NULL,
    ADD COLUMN `user_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `plugins` MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `prompt_invoke_logs` DROP COLUMN `clientIp`,
    DROP COLUMN `costMs`,
    DROP COLUMN `errorMessage`,
    DROP COLUMN `modelCode`,
    DROP COLUMN `modelId`,
    DROP COLUMN `renderedPrompt`,
    DROP COLUMN `templateCode`,
    DROP COLUMN `templateId`,
    DROP COLUMN `templateVersion`,
    ADD COLUMN `client_ip` VARCHAR(191) NULL,
    ADD COLUMN `cost_ms` INTEGER NOT NULL,
    ADD COLUMN `error_message` TEXT NULL,
    ADD COLUMN `model_code` VARCHAR(191) NULL,
    ADD COLUMN `model_id` VARCHAR(191) NULL,
    ADD COLUMN `rendered_prompt` TEXT NOT NULL,
    ADD COLUMN `template_code` VARCHAR(191) NOT NULL,
    ADD COLUMN `template_id` VARCHAR(191) NULL,
    ADD COLUMN `template_version` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `prompt_templates` DROP COLUMN `createdBy`,
    DROP COLUMN `isDefault`,
    ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `created_by` VARCHAR(191) NULL,
    ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `prompt_versions` DROP COLUMN `changeLog`,
    DROP COLUMN `changeType`,
    DROP COLUMN `createdBy`,
    DROP COLUMN `templateId`,
    ADD COLUMN `change_log` TEXT NULL,
    ADD COLUMN `change_type` VARCHAR(191) NOT NULL DEFAULT 'update',
    ADD COLUMN `created_by` VARCHAR(191) NULL,
    ADD COLUMN `template_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `reasoning_steps` DROP COLUMN `actionInput`,
    DROP COLUMN `costMs`,
    ADD COLUMN `action_input` TEXT NULL,
    ADD COLUMN `cost_ms` INTEGER NULL;

-- AlterTable
ALTER TABLE `skill` ADD COLUMN `app_code` VARCHAR(191) NULL,
    ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `description` TEXT NOT NULL,
    MODIFY `params` TEXT NOT NULL,
    MODIFY `config` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `skillinvokelog` DROP COLUMN `agentId`,
    DROP COLUMN `costMs`,
    DROP COLUMN `errorMessage`,
    DROP COLUMN `request`,
    DROP COLUMN `response`,
    DROP COLUMN `skillCode`,
    ADD COLUMN `agent_invoke_log_id` VARCHAR(191) NULL,
    ADD COLUMN `client_ip` VARCHAR(191) NULL,
    ADD COLUMN `cost_ms` INTEGER NOT NULL,
    ADD COLUMN `error_message` TEXT NULL,
    ADD COLUMN `params` TEXT NULL,
    ADD COLUMN `result` TEXT NULL,
    ADD COLUMN `skill_code` VARCHAR(191) NOT NULL,
    ADD COLUMN `skill_id` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `apptenant`;

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

-- CreateIndex
CREATE INDEX `Agent_app_code_idx` ON `Agent`(`app_code`);

-- CreateIndex
CREATE INDEX `Agent_is_public_idx` ON `Agent`(`is_public`);

-- CreateIndex
CREATE UNIQUE INDEX `Agent_code_app_code_key` ON `Agent`(`code`, `app_code`);

-- CreateIndex
CREATE INDEX `AgentInvokeLog_agent_id_createdAt_idx` ON `AgentInvokeLog`(`agent_id`, `createdAt`);

-- CreateIndex
CREATE INDEX `AgentInvokeLog_conversation_id_idx` ON `AgentInvokeLog`(`conversation_id`);

-- CreateIndex
CREATE INDEX `AgentInvokeLog_app_code_createdAt_idx` ON `AgentInvokeLog`(`app_code`, `createdAt`);

-- CreateIndex
CREATE INDEX `AiInvokeLog_model_id_createdAt_idx` ON `AiInvokeLog`(`model_id`, `createdAt`);

-- CreateIndex
CREATE INDEX `AiInvokeLog_model_type_createdAt_idx` ON `AiInvokeLog`(`model_type`, `createdAt`);

-- CreateIndex
CREATE INDEX `AiInvokeLog_app_code_createdAt_idx` ON `AiInvokeLog`(`app_code`, `createdAt`);

-- CreateIndex
CREATE INDEX `Conversation_conversation_type_target_id_createdAt_idx` ON `Conversation`(`conversation_type`, `target_id`, `createdAt`);

-- CreateIndex
CREATE INDEX `Conversation_app_code_idx` ON `Conversation`(`app_code`);

-- CreateIndex
CREATE INDEX `KbChunk_kb_id_doc_id_idx` ON `KbChunk`(`kb_id`, `doc_id`);

-- CreateIndex
CREATE INDEX `KbChunk_kb_id_status_idx` ON `KbChunk`(`kb_id`, `status`);

-- CreateIndex
CREATE INDEX `KbChunk_vector_id_idx` ON `KbChunk`(`vector_id`);

-- CreateIndex
CREATE INDEX `KbDocument_kb_id_status_idx` ON `KbDocument`(`kb_id`, `status`);

-- CreateIndex
CREATE INDEX `KbDocument_created_by_idx` ON `KbDocument`(`created_by`);

-- CreateIndex
CREATE INDEX `KbInfo_app_code_idx` ON `KbInfo`(`app_code`);

-- CreateIndex
CREATE INDEX `KbInfo_is_public_status_idx` ON `KbInfo`(`is_public`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `KbInfo_kbCode_app_code_key` ON `KbInfo`(`kbCode`, `app_code`);

-- CreateIndex
CREATE INDEX `KbPermission_kb_id_idx` ON `KbPermission`(`kb_id`);

-- CreateIndex
CREATE UNIQUE INDEX `KbPermission_kb_id_uid_key` ON `KbPermission`(`kb_id`, `uid`);

-- CreateIndex
CREATE INDEX `KbRetrievalLog_kb_id_createdAt_idx` ON `KbRetrievalLog`(`kb_id`, `createdAt`);

-- CreateIndex
CREATE INDEX `KbRetrievalLog_request_id_idx` ON `KbRetrievalLog`(`request_id`);

-- CreateIndex
CREATE INDEX `Message_conversation_id_createdAt_idx` ON `Message`(`conversation_id`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `oauth_clients_client_id_key` ON `oauth_clients`(`client_id`);

-- CreateIndex
CREATE INDEX `oauth_clients_client_id_idx` ON `oauth_clients`(`client_id`);

-- CreateIndex
CREATE INDEX `oauth_clients_app_code_idx` ON `oauth_clients`(`app_code`);

-- CreateIndex
CREATE INDEX `oauth_codes_expires_at_idx` ON `oauth_codes`(`expires_at`);

-- CreateIndex
CREATE UNIQUE INDEX `oauth_tokens_access_token_key` ON `oauth_tokens`(`access_token`);

-- CreateIndex
CREATE UNIQUE INDEX `oauth_tokens_refresh_token_key` ON `oauth_tokens`(`refresh_token`);

-- CreateIndex
CREATE INDEX `oauth_tokens_access_token_idx` ON `oauth_tokens`(`access_token`);

-- CreateIndex
CREATE INDEX `oauth_tokens_refresh_token_idx` ON `oauth_tokens`(`refresh_token`);

-- CreateIndex
CREATE INDEX `oauth_tokens_expires_at_idx` ON `oauth_tokens`(`expires_at`);

-- CreateIndex
CREATE INDEX `prompt_invoke_logs_template_id_idx` ON `prompt_invoke_logs`(`template_id`);

-- CreateIndex
CREATE INDEX `prompt_invoke_logs_template_code_idx` ON `prompt_invoke_logs`(`template_code`);

-- CreateIndex
CREATE INDEX `prompt_templates_app_code_idx` ON `prompt_templates`(`app_code`);

-- CreateIndex
CREATE INDEX `prompt_templates_is_public_idx` ON `prompt_templates`(`is_public`);

-- CreateIndex
CREATE INDEX `prompt_templates_is_default_idx` ON `prompt_templates`(`is_default`);

-- CreateIndex
CREATE UNIQUE INDEX `prompt_templates_code_app_code_key` ON `prompt_templates`(`code`, `app_code`);

-- CreateIndex
CREATE INDEX `prompt_versions_template_id_idx` ON `prompt_versions`(`template_id`);

-- CreateIndex
CREATE UNIQUE INDEX `prompt_versions_template_id_version_key` ON `prompt_versions`(`template_id`, `version`);

-- CreateIndex
CREATE INDEX `Skill_app_code_idx` ON `Skill`(`app_code`);

-- CreateIndex
CREATE INDEX `Skill_is_public_idx` ON `Skill`(`is_public`);

-- CreateIndex
CREATE UNIQUE INDEX `Skill_code_app_code_key` ON `Skill`(`code`, `app_code`);

-- CreateIndex
CREATE INDEX `SkillInvokeLog_skill_id_createdAt_idx` ON `SkillInvokeLog`(`skill_id`, `createdAt`);

-- CreateIndex
CREATE INDEX `SkillInvokeLog_skill_code_createdAt_idx` ON `SkillInvokeLog`(`skill_code`, `createdAt`);

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
ALTER TABLE `KbPermission` ADD CONSTRAINT `KbPermission_kb_id_fkey` FOREIGN KEY (`kb_id`) REFERENCES `KbInfo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_clients` ADD CONSTRAINT `oauth_clients_app_code_fkey` FOREIGN KEY (`app_code`) REFERENCES `app_tenants`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
