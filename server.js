// ─────────────────────────────────────────────
// server.js
// Express backend that:
//   1. Authenticates with the IOPGPS API
//   2. Fetches device data for a given IMEI
//   3. Serves the frontend (public/index.html)
// ─────────────────────────────────────────────
import 'dotenv/config'
// express  → web server framework
// cors     → allows the browser to call our API
// crypto   → built-in Node.js module for hashing (MD5)
import express from 'express'
import cors    from 'cors'
import crypto  from 'crypto'

const app = express()

// Allow cross-origin requests (needed during local development)
app.use(cors())

// Parse incoming JSON request bodies (for POST requests)
app.use(express.json())

// Serve everything in the /public folder as static files
// When user visits http://localhost:3000, Express sends public/index.html
app.use(express.static('public'))

// ─────────────────────────────────────────────
// IOPGPS CREDENTIALS
// These identify your account with the GPS platform
// ─────────────────────────────────────────────

// const APPID  = "GPS-DEMO"
// const SECRET = "VC88$yXwUcGN^^F5a8B%NUNBaGzg&dyW"

const APPID    = process.env.APPID
const SECRET   = process.env.SECRET
const BASE_URL = process.env.BASE_URL

// ─────────────────────────────────────────────
// MD5 HELPER
// Takes a string and returns its 32-character lowercase MD5 hash
// Used to generate the authentication signature
// ─────────────────────────────────────────────
const md5 = str => crypto.createHash('md5').update(str).digest('hex')

// ─────────────────────────────────────────────
// getToken()
// Authenticates with IOPGPS and returns a fresh access token
//
// Signature formula: md5(md5(secret) + unixTimestamp)
// The timestamp changes every second, making each signature unique
// and preventing replay attacks
// ─────────────────────────────────────────────
async function getToken() {
  // Current time in seconds (Unix timestamp)
  const time = Math.floor(Date.now() / 1000)

  // Double MD5: first hash the secret, then hash that + time
  const signature = md5(md5(SECRET) + time)

  const response = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appid: APPID, time, signature })
  })

  // Returns: { code: 0, accessToken: "abc123...", expiresIn: 7200000 }
  return response.json()
}

// ─────────────────────────────────────────────
// ROUTE: GET /api/device?imei=894758493847414
//
// The frontend calls this once per tracker.
// This route:
//   1. Gets a fresh token from IOPGPS
//   2. Uses it to fetch the device with the given IMEI
//   3. Returns the device data to the frontend
// ─────────────────────────────────────────────
app.get('/api/device', async function(req, res) {
  const imei = req.query.imei

  if (!imei) {
    return res.status(400).json({ error: 'imei query parameter is required' })
  }

  try {
    // Log before auth
    console.log("Attempting auth...")
    const authData = await getToken()
    console.log("Auth response:", JSON.stringify(authData))

    const { accessToken } = authData

    if (!accessToken) {
      return res.status(500).json({ error: 'No access token', authData })
    }

    // Log before device fetch
    console.log(`Fetching IMEI ${imei} with token ${accessToken}`)

    const deviceResponse = await fetch(
      `${BASE_URL}/api/device/detail?imei=${imei}`,
      {
        method: "GET",
        headers: { "AccessToken": accessToken }
      }
    )

    console.log("Device status:", deviceResponse.status)
    const rawText = await deviceResponse.text()
    console.log("Raw response:", rawText)

    if (!rawText) {
      return res.status(502).json({ error: "Empty response from IOPGPS" })
    }

    res.json(JSON.parse(rawText))

  } catch (err) {
    // Print full error including stack trace
    console.error(`Full error for IMEI ${imei}:`)
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// START SERVER
// Listens on port 3000
// Visit http://localhost:3000 to see the app
// ─────────────────────────────────────────────
app.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000')
})

// const PORT = process.env.PORT || 3000
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`)
// })
