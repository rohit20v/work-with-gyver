import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  databaseReady?: Promise<void>
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export function ensureDatabaseReady(): Promise<void> {
  if (globalForPrisma.databaseReady) return globalForPrisma.databaseReady
  globalForPrisma.databaseReady = initializeInMemoryDatabase()
  return globalForPrisma.databaseReady
}

async function initializeInMemoryDatabase(): Promise<void> {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'JobOffer'",
  )
  if (tables.length > 0) return

  await prisma.$executeRawUnsafe(`
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
    )
  `)
  await prisma.$executeRawUnsafe(`
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
    )
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX "Advertisement_jobOfferId_idx" ON "Advertisement"("jobOfferId")')
  await prisma.$executeRawUnsafe('CREATE INDEX "Advertisement_channel_idx" ON "Advertisement"("channel")')

  const { jobOffers } = await import('../../prisma/seed-data.ts')
  for (const jobOffer of jobOffers) {
    await prisma.jobOffer.create({
      data: { ...jobOffer, requiredSkills: [...jobOffer.requiredSkills] },
    })
  }
}
