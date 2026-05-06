-- AlterTable
ALTER TABLE "Model" ADD COLUMN "category" TEXT;
ALTER TABLE "Model" ADD COLUMN "tags" TEXT;

-- CreateIndex
CREATE INDEX "Model_category_idx" ON "Model"("category");
