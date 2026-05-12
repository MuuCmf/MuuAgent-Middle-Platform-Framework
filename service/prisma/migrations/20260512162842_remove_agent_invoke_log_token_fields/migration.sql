/*
  Warnings:

  - You are about to drop the column `input_tokens` on the `agentinvokelog` table. All the data in the column will be lost.
  - You are about to drop the column `output_tokens` on the `agentinvokelog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `agentinvokelog` DROP COLUMN `input_tokens`,
    DROP COLUMN `output_tokens`;
