-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RateLimitCounter" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RateLimitCounter_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RateLimitRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RateLimitCounter" ("createdAt", "currentConcurrent", "currentQps", "id", "lastResetDate", "lastSecond", "lastTokenUpdate", "ruleId", "todayCount", "tokens", "updatedAt") SELECT "createdAt", "currentConcurrent", "currentQps", "id", "lastResetDate", "lastSecond", "lastTokenUpdate", "ruleId", "todayCount", "tokens", "updatedAt" FROM "RateLimitCounter";
DROP TABLE "RateLimitCounter";
ALTER TABLE "new_RateLimitCounter" RENAME TO "RateLimitCounter";
CREATE INDEX "RateLimitCounter_ruleId_idx" ON "RateLimitCounter"("ruleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
