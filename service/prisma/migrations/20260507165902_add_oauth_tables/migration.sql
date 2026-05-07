-- CreateTable
CREATE TABLE `oauth_clients` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `redirectUris` VARCHAR(191) NOT NULL,
    `scopes` VARCHAR(191) NOT NULL,
    `grants` VARCHAR(191) NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    `status` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `oauth_clients_clientId_key`(`clientId`),
    INDEX `oauth_clients_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `redirectUri` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_codes_code_key`(`code`),
    INDEX `oauth_codes_code_idx`(`code`),
    INDEX `oauth_codes_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `refreshExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_tokens_accessToken_key`(`accessToken`),
    UNIQUE INDEX `oauth_tokens_refreshToken_key`(`refreshToken`),
    INDEX `oauth_tokens_accessToken_idx`(`accessToken`),
    INDEX `oauth_tokens_refreshToken_idx`(`refreshToken`),
    INDEX `oauth_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauth_clients`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauth_clients`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;
