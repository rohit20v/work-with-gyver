import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buildAdvertisementPrompt } from './llm.server.ts'

const baseInput = {
  jobOffer: {
    title: 'Capo cantiere fotovoltaico',
    company: 'Energia Futura',
    description: 'Coordina cantieri solari in Lombardia.',
    location: 'Lombardia',
    requiredSkills: ['Esperienza di cantiere', 'Patente B'],
    experience: '3 anni',
  },
  channel: 'INSTAGRAM',
  format: 'TEXT',
  location: 'Brescia',
}

describe('buildAdvertisementPrompt', () => {
  it('uses channel guidance, target location, and text JSON contract', () => {
    const prompt = buildAdvertisementPrompt(baseInput)

    assert.match(prompt, /mobile-friendly paragraphs/)
    assert.match(prompt, /Target ad location: Brescia/)
    assert.match(prompt, /"callToAction":"\.\.\."/)
    assert.doesNotMatch(prompt, /internalNotes|confidential detail/i)
  })

  it('requests an image prompt for image formats', () => {
    const prompt = buildAdvertisementPrompt({ ...baseInput, format: 'IMAGE_TEXT' })

    assert.match(prompt, /"imagePrompt":"\.\.\."/)
    assert.match(prompt, /image-generation model/)
  })

  it('does not include fields outside the explicit public source allowlist', () => {
    const prompt = buildAdvertisementPrompt(baseInput)

    assert.doesNotMatch(prompt, /internalNotes|customerSecret|createdAt|updatedAt/)
    assert.match(prompt, /Coordina cantieri solari in Lombardia/)
  })
})
