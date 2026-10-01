import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

interface JobOfferOption {
  id: string
  title: string
}

interface AdvertisementItem {
  id: string
  jobOfferId: string
  channel: string
  format: string
  status: string
  location: string
  title: string
  content: string
  callToAction: string
  generatedContent: { imagePrompt?: string }
  createdAt: string
  jobOffer: { id: string; title: string; company: string }
}

interface DashboardProps {
  jobOffers: JobOfferOption[]
  advertisements: AdvertisementItem[]
}

export const AdvertisementDashboard = clientEntry(
  import.meta.url,
  function AdvertisementDashboard(handle: Handle<DashboardProps>) {
    let items = handle.props.advertisements
    let jobOffers = handle.props.jobOffers
    let channelFilter = ''
    let jobOfferFilter = ''
    let notice = ''
    let busy = false

    handle.queueTask(async (signal) => {
      try {
        const [offersResponse, adsResponse] = await Promise.all([
          fetch('/api/job-offers', { signal }),
          fetch('/api/advertisements', { signal }),
        ])
        if (!offersResponse.ok || !adsResponse.ok || signal.aborted) return
        const offers = (await offersResponse.json()) as Array<JobOfferOption>
        const advertisements = (await adsResponse.json()) as AdvertisementItem[]
        if (signal.aborted) return
        jobOffers = offers
        items = advertisements
        await handle.update()
      } catch {
        if (!signal.aborted) {
          notice = 'Could not load data. Check the database connection.'
          handle.update()
        }
      }
    })

    async function refresh() {
      const params = new URLSearchParams()
      if (channelFilter) params.set('channel', channelFilter)
      if (jobOfferFilter) params.set('jobOfferId', jobOfferFilter)
      const response = await fetch(`/api/advertisements?${params}`)
      if (response.ok) items = (await response.json()) as AdvertisementItem[]
      await handle.update()
    }

    return () => (
      <div>
        <section style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '24px 0' }}>
          <h2>Generate advertisement</h2>
          <form
            mix={on('submit', async (event, signal) => {
              event.preventDefault()
              notice = ''
              busy = true
              handle.update()
              const form = new FormData(event.currentTarget)
              try {
                const response = await fetch('/api/advertisements', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(Object.fromEntries(form)),
                  signal,
                })
                const result = (await response.json()) as AdvertisementItem | { error?: string }
                if (signal.aborted) return
                if (!response.ok) throw new Error('error' in result ? result.error : 'Generation failed')
                items = [result as AdvertisementItem, ...items]
                notice = 'Advertisement generated.'
              } catch (error) {
                if (signal.aborted) return
                notice = error instanceof Error ? error.message : 'Generation failed.'
              }
              busy = false
              await handle.update()
            })}
          >
            <label>Job offer <select name="jobOfferId" required>
              {jobOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
            </select></label>{' '}
            <label>Channel <select name="channel">
              <option>INDEED</option><option>INSTAGRAM</option><option>TIKTOK</option><option>WHATSAPP</option>
            </select></label>{' '}
            <label>Format <select name="format"><option>TEXT</option><option>IMAGE</option><option>IMAGE_TEXT</option></select></label>{' '}
            <label>Location <input name="location" required placeholder="Brescia" /></label>{' '}
            <button type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate'}</button>
          </form>
          {notice && <p role="status">{notice}</p>}
        </section>

        <section>
          <h2>Advertisements</h2>
          <label>Filter channel <select value={channelFilter} mix={on('change', async (event) => {
            channelFilter = event.currentTarget.value
            await refresh()
          })}>
            <option value="">All channels</option><option>INDEED</option><option>INSTAGRAM</option><option>TIKTOK</option><option>WHATSAPP</option>
          </select></label>{' '}
          <label>Filter job offer <select value={jobOfferFilter} mix={on('change', async (event) => {
            jobOfferFilter = event.currentTarget.value
            await refresh()
          })}>
            <option value="">All job offers</option>
            {jobOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
          </select></label>
          {items.length === 0 ? <p>No advertisements yet.</p> : items.map((item) => (
            <AdvertisementEditor key={item.id} item={item} onSaved={(updated) => {
              items = items.map((current) => current.id === updated.id ? updated : current)
              handle.update()
            }} />
          ))}
        </section>
      </div>
    )
  },
)

function AdvertisementEditor(handle: Handle<{ item: AdvertisementItem; onSaved: (item: AdvertisementItem) => void }>) {
  let content = handle.props.item.content
  let notice = ''
  let saving = false
  return () => {
    const item = handle.props.item
    return (
      <article style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
        <h3>{item.title}</h3>
        <p>{item.jobOffer.title} · {item.channel} / {item.format} · {item.location} · {item.status}</p>
        {item.generatedContent.imagePrompt && (
          <details>
            <summary>Image-generation prompt (copy into an image model)</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{item.generatedContent.imagePrompt}</pre>
          </details>
        )}
        <label style={{ display: 'block' }}>Content<textarea value={content} rows={5} style={{ display: 'block', width: '100%', margin: '8px 0' }} mix={on('input', (event) => {
          content = event.currentTarget.value
        })} /></label>
        <button type="button" disabled={saving} mix={on('click', async (_event, signal) => {
          notice = ''
          saving = true
          handle.update()
          try {
            const response = await fetch(`/api/advertisements/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
              signal,
            })
            const result = (await response.json()) as AdvertisementItem | { error?: string }
            if (signal.aborted) return
            if (!response.ok) throw new Error('error' in result ? result.error : 'Save failed')
            handle.props.onSaved(result as AdvertisementItem)
            notice = 'Saved.'
          } catch (error) {
            if (signal.aborted) return
            notice = error instanceof Error ? error.message : 'Save failed.'
          }
          saving = false
          handle.update()
        })}>{saving ? 'Saving…' : 'Save content'}</button>
        {notice && <span role="status">{' '}{notice}</span>}
      </article>
    )
  }
}
