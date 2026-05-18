import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { jwtVerify } from 'jose'
import { handleEvaluate, handleProject } from './api/_harnessService.js'

function harnessDevPlugin(env) {
  const jwtSecret = env.SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
    : null

  async function verifyAuth(req) {
    if (!jwtSecret) return { ok: true, skipped: true }
    const header = req.headers['authorization'] || req.headers['Authorization']
    if (!header || !header.startsWith('Bearer ')) return { ok: false, reason: 'no_token' }
    try {
      await jwtVerify(header.slice(7).trim(), jwtSecret)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'invalid_token' }
    }
  }

  // Cap bodies at 200MB so a runaway upload (or accidental N×30MB batch) can't
  // hang the dev server on string concat / JSON.parse. Buffer-accumulate to
  // avoid V8's O(n²) string growth, then decode once at the end.
  const MAX_BODY_BYTES = 200 * 1024 * 1024
  async function readBody(req) {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > MAX_BODY_BYTES) {
        const err = new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`)
        err.code = 'PAYLOAD_TOO_LARGE'
        throw err
      }
      chunks.push(buf)
    }
    if (!total) return {}
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'))
  }

  function json(res, status, payload) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
  }

  function preflight(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  return {
    name: 'aspice-harness-dev',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        preflight(req, res)
        if (req.method === 'OPTIONS') return json(res, 200, {})
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

        const auth = await verifyAuth(req)
        if (!auth.ok) return json(res, 401, { error: 'Unauthorized. Sign in required.' })

        try {
          const body = await readBody(req)
          const { legacy, verdict } = await handleEvaluate(body, env)
          return json(res, 200, { ...legacy, _verdict: verdict })
        } catch (e) {
          if (e?.code === 'PAYLOAD_TOO_LARGE') {
            return json(res, 413, { error: 'Payload too large', detail: e.message })
          }
          console.error('[aspice] /api/analyze failed:', e)
          return json(res, 502, { error: 'Harness evaluation failed', detail: String(e?.message || e) })
        }
      })

      server.middlewares.use('/api/project', async (req, res) => {
        preflight(req, res)
        if (req.method === 'OPTIONS') return json(res, 200, {})
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

        const auth = await verifyAuth(req)
        if (!auth.ok) return json(res, 401, { error: 'Unauthorized. Sign in required.' })

        try {
          const body = await readBody(req)
          const { verdict } = await handleProject(body, env)
          return json(res, 200, verdict)
        } catch (e) {
          if (e?.code === 'PAYLOAD_TOO_LARGE') {
            return json(res, 413, { error: 'Payload too large', detail: e.message })
          }
          console.error('[aspice] /api/project failed:', e)
          return json(res, 502, { error: 'Harness project evaluation failed', detail: String(e?.message || e) })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), harnessDevPlugin(env)],
    server: { host: true, port: 5174, strictPort: true },
    preview: { host: true, port: 4173 },
  }
})
