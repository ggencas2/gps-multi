import express from 'express'
import cors    from 'cors'
import crypto  from 'crypto'
 
const app = express()
 
app.use(cors())
app.use(express.json())
 
// Serve frontend from /public folder
app.use(express.static('public'))
 
// ─────────────────────────────────────────────
// CREDENTIALS — loaded from environment variables
// Set these in Railway: Variables tab
// ─────────────────────────────────────────────
const APPID    = process.env.APPID    || "GPS-DEMO"
const SECRET   = process.env.SECRET   || "VC88$yXwUcGN^^F5a8B%NUNBaGzg&dyW"
const BASE_URL = process.env.BASE_URL || "https://open.iopgps.com"
 
// ─────────────────────────────────────────────
// MD5 HELPER
// ─────────────────────────────────────────────
const md5 = str => crypto.createHash('md5').update(str).digest('hex')
 
// ─────────────────────────────────────────────
// getToken()
// Signature formula: md5(md5(secret) + unixTimestamp)
// ─────────────────────────────────────────────
async function getToken() {
  const time      = Math.floor(Date.now() / 1000)
  const signature = md5(md5(SECRET) + time)
 
  const response = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appid: APPID, time, signature })
  })
 
  return response.json()
}
 
// ─────────────────────────────────────────────
// ROUTE: GET /api/device?imei=...
// ─────────────────────────────────────────────
app.get('/api/device', async function(req, res) {
  const imei = req.query.imei
 
  if (!imei) {
    return res.status(400).json({ error: 'imei query parameter is required' })
  }
 
  try {
    const { accessToken } = await getToken()
 
    const deviceResponse = await fetch(
      `${BASE_URL}/api/device/detail?imei=${imei}`,
      {
        method: "GET",
        headers: { "AccessToken": accessToken }
      }
    )
 
    const rawText = await deviceResponse.text()
 
    if (!rawText) {
      return res.status(502).json({ error: 'Empty response from GPS API' })
    }
 
    res.json(JSON.parse(rawText))
 
  } catch (err) {
    console.error(`Error fetching IMEI ${imei}:`, err.message)
    res.status(500).json({ error: err.message })
  }
})
 
// ─────────────────────────────────────────────
// START SERVER
// Railway assigns PORT dynamically via process.env.PORT
// Falls back to 3000 for local development
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
