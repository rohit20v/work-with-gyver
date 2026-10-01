import { Prisma } from '@prisma/client'
import { createController } from 'remix/router'

import { ensureDatabaseReady, prisma } from '../lib/prisma.server.ts'
import { generateAdvertisement, LLMProviderError } from '../services/llm.server.ts'
import { assets } from '../assets.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { AdvertisementDashboard } from './public/advertisement-dashboard.tsx'

const channels = ['INDEED', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP'] as const
const formats = ['TEXT', 'IMAGE', 'IMAGE_TEXT'] as const

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    async home(context) {
      try {
        await ensureDatabaseReady()
        const [jobOffers, advertisements] = await Promise.all([
          prisma.jobOffer.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
          prisma.advertisement.findMany({
            include: { jobOffer: { select: { id: true, title: true, company: true } } },
            orderBy: { createdAt: 'desc' },
          }),
        ])
        const clientAdvertisements = advertisements.map((item) => ({
          ...item,
          generatedContent: item.generatedContent as { imagePrompt?: string },
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }))
        return context.render(
          <Document title="Gyver Advertisements">
            <main style={{ maxWidth: '960px', margin: '32px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
              <h1>Job advertisements</h1>
              <p>Create channel-specific drafts from an internal job offer, then review and edit the generated copy.</p>
              <AdvertisementDashboard jobOffers={jobOffers} advertisements={clientAdvertisements} />
            </main>
          </Document>,
        )
      } catch {
        return context.render(
          <Document title="Gyver Advertisements">
            <main style={{ maxWidth: '960px', margin: '32px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
              <h1>Job advertisements</h1>
              <p>The in-memory database could not start. Restart the development server to initialize it.</p>
            </main>
          </Document>,
        )
      }
    },
    async jobOffers() {
      await ensureDatabaseReady()
      const offers = await prisma.jobOffer.findMany({
        select: {
          id: true,
          title: true,
          company: true,
          description: true,
          location: true,
          requiredSkills: true,
          experience: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return Response.json(offers)
    },
    async jobOffer(context) {
      await ensureDatabaseReady()
      const offer = await prisma.jobOffer.findUnique({
        where: { id: context.params.id },
        select: {
          id: true,
          title: true,
          company: true,
          description: true,
          location: true,
          requiredSkills: true,
          experience: true,
        },
      })
      return offer ? Response.json(offer) : errorResponse('Job offer not found.', 404)
    },
    async advertisements(context) {
      await ensureDatabaseReady()
      const jobOfferId = context.url.searchParams.get('jobOfferId') || undefined
      const channel = context.url.searchParams.get('channel') || undefined
      if (channel && !isOneOf(channels, channel)) return errorResponse('Unsupported channel.', 400)

      const items = await prisma.advertisement.findMany({
        where: { jobOfferId, channel: channel as (typeof channels)[number] | undefined },
        include: { jobOffer: { select: { id: true, title: true, company: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return Response.json(items)
    },
    async advertisement(context) {
      await ensureDatabaseReady()
      const item = await prisma.advertisement.findUnique({
        where: { id: context.params.id },
        include: { jobOffer: { select: { id: true, title: true, company: true } } },
      })
      return item ? Response.json(item) : errorResponse('Advertisement not found.', 404)
    },
    async createAdvertisement(context) {
      await ensureDatabaseReady()
      const body = await readJson(context.request)
      if (!body.ok) return errorResponse(body.message, 400)
      const { jobOfferId, channel, format, location } = body.value
      if (!isNonEmptyString(jobOfferId) || !isOneOf(channels, channel) || !isOneOf(formats, format) || !isNonEmptyString(location)) {
        return errorResponse('Provide jobOfferId, a supported channel and format, and a non-empty location.', 400)
      }

      const jobOffer = await prisma.jobOffer.findUnique({ where: { id: jobOfferId } })
      if (!jobOffer) return errorResponse('Job offer not found.', 404)

      let generated
      try {
        generated = await generateAdvertisement({
          jobOffer: {
            title: jobOffer.title,
            company: jobOffer.company,
            description: jobOffer.description,
            location: jobOffer.location,
            requiredSkills: jobOffer.requiredSkills,
            experience: jobOffer.experience,
          },
          channel,
          format,
          location: location.trim(),
        })
      } catch (error) {
        if (error instanceof LLMProviderError) return errorResponse(error.message, 503)
        throw error
      }

      const created = await prisma.advertisement.create({
        data: {
          jobOfferId,
          channel,
          format,
          location: location.trim(),
          generatedContent: {
            title: generated.title,
            content: generated.content,
            callToAction: generated.callToAction,
            ...(generated.imagePrompt ? { imagePrompt: generated.imagePrompt } : {}),
          },
          content: generated.content,
          title: generated.title,
          callToAction: generated.callToAction,
        },
        include: { jobOffer: { select: { id: true, title: true, company: true } } },
      })
      return Response.json(created, { status: 201 })
    },
    async updateAdvertisement(context) {
      await ensureDatabaseReady()
      const body = await readJson(context.request)
      if (!body.ok) return errorResponse(body.message, 400)
      const data: { content?: string; title?: string; callToAction?: string } = {}
      for (const key of ['content', 'title', 'callToAction'] as const) {
        if (key in body.value) {
          if (!isNonEmptyString(body.value[key])) return errorResponse(`${key} must be a non-empty string.`, 400)
          data[key] = body.value[key].trim()
        }
      }
      if (Object.keys(data).length === 0) return errorResponse('Provide content, title, or callToAction to update.', 400)

      try {
        const updated = await prisma.advertisement.update({
          where: { id: context.params.id },
          data,
          include: { jobOffer: { select: { id: true, title: true, company: true } } },
        })
        return Response.json(updated)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return errorResponse('Advertisement not found.', 404)
        }
        throw error
      }
    },
    async deleteAdvertisement(context) {
      await ensureDatabaseReady()
      try {
        await prisma.advertisement.delete({ where: { id: context.params.id } })
        return new Response(null, { status: 204 })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return errorResponse('Advertisement not found.', 404)
        }
        throw error
      }
    },
  },
})

async function readJson(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const value: unknown = await request.json()
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, message: 'Request body must be a JSON object.' }
    }
    return { ok: true, value: value as Record<string, unknown> }
  } catch {
    return { ok: false, message: 'Request body must contain valid JSON.' }
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOneOf<const Values extends readonly string[]>(values: Values, value: unknown): value is Values[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value)
}
