/*
  Warnings:

  - You are about to drop the column `kb_retrieval_method` on the `agent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `agent` DROP COLUMN `kb_retrieval_method`,
    MODIFY `kb_retrieval_mode` VARCHAR(191) NOT NULL DEFAULT 'tool';
