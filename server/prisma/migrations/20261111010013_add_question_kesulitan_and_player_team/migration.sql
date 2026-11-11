-- AlterTable
ALTER TABLE "session_players" ADD COLUMN "tim" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "teks" TEXT NOT NULL,
    "opsiA" TEXT NOT NULL,
    "opsiB" TEXT NOT NULL,
    "opsiC" TEXT NOT NULL,
    "jawabanBenar" TEXT NOT NULL,
    "penjelasan" TEXT,
    "kesulitan" TEXT NOT NULL DEFAULT 'sedang',
    "dibuatAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "questions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_questions" ("createdAt", "dibuatAi", "id", "jawabanBenar", "opsiA", "opsiB", "opsiC", "penjelasan", "teks", "templateId", "updatedAt", "urutan") SELECT "createdAt", "dibuatAi", "id", "jawabanBenar", "opsiA", "opsiB", "opsiC", "penjelasan", "teks", "templateId", "updatedAt", "urutan" FROM "questions";
DROP TABLE "questions";
ALTER TABLE "new_questions" RENAME TO "questions";
CREATE INDEX "questions_templateId_idx" ON "questions"("templateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
