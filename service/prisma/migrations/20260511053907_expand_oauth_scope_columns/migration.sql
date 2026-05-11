-- AlterTable
ALTER TABLE `oauth_clients` MODIFY `redirectUris` TEXT NOT NULL,
    MODIFY `scopes` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `oauth_codes` MODIFY `scope` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `oauth_tokens` MODIFY `scope` TEXT NOT NULL;
