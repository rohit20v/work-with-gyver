import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from '../router.ts'
import { routes } from '../routes.ts'
import { ensureDatabaseReady, prisma } from '../lib/prisma.server.ts'

describe('root controller', () => {
  it('initializes in-memory SQLite with sample job offers', async () => {
    await ensureDatabaseReady()
    const offers = await prisma.jobOffer.findMany({ orderBy: { id: 'asc' } })

    assert.equal(offers.length, 3)
    assert.equal(offers[0]?.id, 'job-elettricista-industriale')
  })

  it('GET /api/job-offers returns the seeded offers', async () => {
    let response = await router.fetch(new URL(routes.jobOffers.href(), 'http://localhost'))

    assert.equal(response.status, 200)
    const offers = (await response.json()) as Array<Record<string, unknown>>
    assert.equal(offers.length, 3)
    assert.equal('internalNotes' in (offers[0] ?? {}), false)
  })

  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(await response.text(), /<html[\s>]/)
  })
})
