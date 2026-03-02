-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PipelineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "verdict" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cardId" TEXT NOT NULL,
    CONSTRAINT "PipelineRun_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PipelineRun" ("cardId", "createdAt", "error", "id", "stage", "status", "updatedAt") SELECT "cardId", "createdAt", "error", "id", "stage", "status", "updatedAt" FROM "PipelineRun";
DROP TABLE "PipelineRun";
ALTER TABLE "new_PipelineRun" RENAME TO "PipelineRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
