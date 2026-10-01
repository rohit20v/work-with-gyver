import { PrismaClient } from '@prisma/client'

import { jobOffers } from './seed-data.ts'

const prisma = new PrismaClient()

async function main() {
  for (const jobOffer of jobOffers) {
    await prisma.jobOffer.upsert({
      where: { id: jobOffer.id },
      update: { ...jobOffer, requiredSkills: [...jobOffer.requiredSkills] },
      create: { ...jobOffer, requiredSkills: [...jobOffer.requiredSkills] },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
