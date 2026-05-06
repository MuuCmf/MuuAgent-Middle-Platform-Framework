-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "apiKey" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "config" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "McpStrategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelType" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'weight',
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "fallbackModelId" TEXT,
    "enableCircuit" BOOLEAN NOT NULL DEFAULT true,
    "circuitThreshold" INTEGER NOT NULL DEFAULT 5,
    "circuitTimeout" INTEGER NOT NULL DEFAULT 300000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "McpRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "qpsLimit" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "currentConcurrent" INTEGER NOT NULL DEFAULT 0,
    "circuitStatus" TEXT NOT NULL DEFAULT 'closed',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorTime" DATETIME,
    "circuitOpenTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpRule_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "modelId" TEXT,
    "skills" TEXT NOT NULL,
    "maxSteps" INTEGER NOT NULL DEFAULT 5,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiInvokeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT,
    "modelCode" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "response" TEXT,
    "costMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInvokeLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillInvokeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillCode" TEXT NOT NULL,
    "agentId" TEXT,
    "request" TEXT NOT NULL,
    "response" TEXT,
    "costMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillInvokeLog_skillCode_fkey" FOREIGN KEY ("skillCode") REFERENCES "Skill" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentInvokeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "userMessage" TEXT NOT NULL,
    "agentResponse" TEXT,
    "steps" TEXT,
    "totalCostMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "clientIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentInvokeLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelHealth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseTime" INTEGER,
    "errorMessage" TEXT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelHealth_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppTenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "allowedModels" TEXT,
    "allowedSkills" TEXT,
    "qpsLimit" INTEGER NOT NULL DEFAULT 100,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10000,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "expireAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "qpsLimit" INTEGER NOT NULL DEFAULT 100,
    "concurrentLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10000,
    "burstSize" INTEGER NOT NULL DEFAULT 20,
    "enableQueue" BOOLEAN NOT NULL DEFAULT false,
    "queueSize" INTEGER NOT NULL DEFAULT 100,
    "queueTimeout" INTEGER NOT NULL DEFAULT 5000,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "currentQps" INTEGER NOT NULL DEFAULT 0,
    "currentConcurrent" INTEGER NOT NULL DEFAULT 0,
    "todayCount" INTEGER NOT NULL DEFAULT 0,
    "lastSecond" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TEXT NOT NULL DEFAULT '',
    "tokens" REAL NOT NULL DEFAULT 100,
    "lastTokenUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitBlacklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientIp" TEXT NOT NULL,
    "appId" TEXT,
    "reason" TEXT NOT NULL,
    "blockUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Model_code_key" ON "Model"("code");

-- CreateIndex
CREATE INDEX "Model_type_status_idx" ON "Model"("type", "status");

-- CreateIndex
CREATE INDEX "Model_provider_idx" ON "Model"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "McpStrategy_modelType_key" ON "McpStrategy"("modelType");

-- CreateIndex
CREATE INDEX "McpRule_modelId_idx" ON "McpRule"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "Skill_type_status_idx" ON "Skill"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_code_key" ON "Agent"("code");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "AiInvokeLog_modelId_createdAt_idx" ON "AiInvokeLog"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "AiInvokeLog_modelType_createdAt_idx" ON "AiInvokeLog"("modelType", "createdAt");

-- CreateIndex
CREATE INDEX "AiInvokeLog_success_createdAt_idx" ON "AiInvokeLog"("success", "createdAt");

-- CreateIndex
CREATE INDEX "SkillInvokeLog_skillCode_createdAt_idx" ON "SkillInvokeLog"("skillCode", "createdAt");

-- CreateIndex
CREATE INDEX "AgentInvokeLog_agentId_createdAt_idx" ON "AgentInvokeLog"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentInvokeLog_conversationId_idx" ON "AgentInvokeLog"("conversationId");

-- CreateIndex
CREATE INDEX "ModelHealth_modelId_checkedAt_idx" ON "ModelHealth"("modelId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppTenant_code_key" ON "AppTenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AppTenant_apiKey_key" ON "AppTenant"("apiKey");

-- CreateIndex
CREATE INDEX "AppTenant_code_idx" ON "AppTenant"("code");

-- CreateIndex
CREATE INDEX "AppTenant_apiKey_idx" ON "AppTenant"("apiKey");

-- CreateIndex
CREATE INDEX "RateLimitRule_level_status_idx" ON "RateLimitRule"("level", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitRule_level_target_key" ON "RateLimitRule"("level", "target");

-- CreateIndex
CREATE INDEX "RateLimitCounter_ruleId_idx" ON "RateLimitCounter"("ruleId");

-- CreateIndex
CREATE INDEX "RateLimitBlacklist_clientIp_blockUntil_idx" ON "RateLimitBlacklist"("clientIp", "blockUntil");

-- CreateIndex
CREATE INDEX "RateLimitBlacklist_appId_blockUntil_idx" ON "RateLimitBlacklist"("appId", "blockUntil");
