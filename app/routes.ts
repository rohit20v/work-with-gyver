import { del, get, patch, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  jobOffers: get('/api/job-offers'),
  jobOffer: get('/api/job-offers/:id'),
  advertisements: get('/api/advertisements'),
  advertisement: get('/api/advertisements/:id'),
  createAdvertisement: post('/api/advertisements'),
  updateAdvertisement: patch('/api/advertisements/:id'),
  deleteAdvertisement: del('/api/advertisements/:id'),
})
