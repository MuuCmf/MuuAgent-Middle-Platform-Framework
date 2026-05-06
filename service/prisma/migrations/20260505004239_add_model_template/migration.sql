-- CreateTable
CREATE TABLE "ModelTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "topP" REAL NOT NULL DEFAULT 0.7,
    "contextWindow" INTEGER NOT NULL DEFAULT 8192,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "sceneTag" TEXT,
    "description" TEXT,
    "remark" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelTemplate_code_key" ON "ModelTemplate"("code");

-- CreateIndex
CREATE INDEX "ModelTemplate_modelType_status_idx" ON "ModelTemplate"("modelType", "status");

-- CreateIndex
CREATE INDEX "ModelTemplate_sceneTag_idx" ON "ModelTemplate"("sceneTag");

-- CreateIndex
CREATE INDEX "ModelTemplate_isDefault_idx" ON "ModelTemplate"("isDefault");
