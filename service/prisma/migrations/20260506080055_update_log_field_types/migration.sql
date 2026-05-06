-- AlterTable
ALTER TABLE `agentinvokelog` MODIFY `userMessage` TEXT NOT NULL,
    MODIFY `agentResponse` TEXT NULL,
    MODIFY `steps` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `aiinvokelog` MODIFY `request` TEXT NOT NULL,
    MODIFY `response` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `skillinvokelog` MODIFY `request` TEXT NOT NULL,
    MODIFY `response` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;
