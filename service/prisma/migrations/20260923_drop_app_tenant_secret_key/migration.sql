-- 删除应用的 Secret Key 字段
-- secretKey（sk_前缀）自引入以来从未参与任何认证（业务端认证仅使用 x-api-key），
-- 属于多余设计；api_key_hash 为唯一业务凭证，重置流程只轮换 API Key
-- 幂等写法：MySQL 5.7 不支持 DROP COLUMN IF EXISTS，部分环境（如 dev 库）建表时即无此列

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'muuagent_app_tenants'
    AND COLUMN_NAME = 'secretKey'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE `muuagent_app_tenants` DROP COLUMN `secretKey`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
