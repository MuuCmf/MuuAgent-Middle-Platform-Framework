-- 租户 apiKey 与 OAuth clientSecret 改为 SHA-256 哈希存储
-- 与 schema.prisma 中 AppTenant.apiKeyHash / OAuthClient.clientSecretHash 同步变更
-- 迁移策略：新增哈希列 -> 用 SHA2() 回填存量明文 -> 删除明文列与旧索引
-- 注意：哈希不可逆，存量密钥业务方仍持有明文可直接继续使用；新密钥仅在创建/重置响应中返回一次

-- 1. 应用/租户表：apiKey -> api_key_hash
ALTER TABLE `muuagent_app_tenants`
  ADD COLUMN `api_key_hash` VARCHAR(191) NOT NULL DEFAULT '' COMMENT 'API密钥哈希(SHA-256，明文仅在创建/重置接口响应中返回一次)' AFTER `code`;

UPDATE `muuagent_app_tenants` SET `api_key_hash` = SHA2(`apiKey`, 256);

ALTER TABLE `muuagent_app_tenants` DROP INDEX `app_tenants_apiKey_key`;
ALTER TABLE `muuagent_app_tenants` DROP INDEX `app_tenants_apiKey_idx`;
ALTER TABLE `muuagent_app_tenants` DROP COLUMN `apiKey`;

ALTER TABLE `muuagent_app_tenants`
  ADD UNIQUE INDEX `muuagent_app_tenants_api_key_hash_key`(`api_key_hash`);

-- 2. OAuth客户端表：client_secret -> client_secret_hash
ALTER TABLE `muuagent_oauth_clients`
  ADD COLUMN `client_secret_hash` VARCHAR(191) NOT NULL DEFAULT '' COMMENT '客户端密钥哈希(SHA-256，明文仅在创建/重置接口响应中返回一次)' AFTER `client_id`;

UPDATE `muuagent_oauth_clients` SET `client_secret_hash` = SHA2(`client_secret`, 256);

ALTER TABLE `muuagent_oauth_clients` DROP COLUMN `client_secret`;
