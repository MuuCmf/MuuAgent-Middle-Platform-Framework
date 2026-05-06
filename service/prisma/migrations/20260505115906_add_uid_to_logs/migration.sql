-- AlterTable
ALTER TABLE "AgentInvokeLog" ADD COLUMN "uid" TEXT;

-- AlterTable
ALTER TABLE "AiInvokeLog" ADD COLUMN "uid" TEXT;

-- AlterTable
ALTER TABLE "SkillInvokeLog" ADD COLUMN "uid" TEXT;

-- CreateIndex
CREATE INDEX "AgentInvokeLog_uid_createdAt_idx" ON "AgentInvokeLog"("uid", "createdAt");

-- CreateIndex
CREATE INDEX "AiInvokeLog_uid_createdAt_idx" ON "AiInvokeLog"("uid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillInvokeLog_uid_createdAt_idx" ON "SkillInvokeLog"("uid", "createdAt");
