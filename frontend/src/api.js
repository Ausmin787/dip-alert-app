import axios from 'axios'

// In production (Vercel), set VITE_API_URL to the Railway backend URL.
// In dev it stays relative and Vite proxies /api to localhost:8000.
const base = import.meta.env.VITE_API_URL ?? ''
const client = axios.create({ baseURL: `${base}/api` })

export const getStatus = () => client.get('/status').then((r) => r.data)
export const getHistory = (ticker, days = 30) =>
  client.get(`/history/${encodeURIComponent(ticker)}`, { params: { days } }).then((r) => r.data)

export const getWatchlist = () => client.get('/watchlist').then((r) => r.data)
export const addAsset = (body) => client.post('/watchlist', body).then((r) => r.data)
export const updateAsset = (id, body) => client.put(`/watchlist/${id}`, body).then((r) => r.data)
export const deleteAsset = (id) => client.delete(`/watchlist/${id}`)

export const getAlerts = (page = 1, pageSize = 20) =>
  client.get('/alerts', { params: { page, page_size: pageSize } }).then((r) => r.data)

export const getSettings = () => client.get('/settings').then((r) => r.data)
export const updateSettings = (body) => client.put('/settings', body).then((r) => r.data)
export const sendTestAlert = () => client.post('/test-alert').then((r) => r.data)
