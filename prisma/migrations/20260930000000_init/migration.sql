CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "requiredSkills" JSONB NOT NULL,
    "experience" TEXT NOT NULL,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobOfferId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "location" TEXT NOT NULL,
    "generatedContent" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Advertisement_jobOfferId_idx" ON "Advertisement"("jobOfferId");
CREATE INDEX "Advertisement_channel_idx" ON "Advertisement"("channel");
