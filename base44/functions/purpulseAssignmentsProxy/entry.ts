/**
 * GET /mock/api/purpulse/me
 * GET /mock/api/purpulse/assignments?assigned_to=<technician_uid>
 *
 * Forwards Authorization: Bearer <token> to PurPulse Azure API.
 * Base URL from Secrets: PURPULSE_API_BASE_URL or AZURE_API_BASE_URL (e.g. https://api-test.purpulse.app)
 *
 * No Base44 session required on this edge — the token must be valid for upstream /api/me.
 * (Optional: add IP allowlist / rate limits in production.)
 */
Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const upstreamBase =
    Deno.env.get('PURPULSE_API_BASE_URL')?.trim()?.replace(/\/$/, '') ||
    Deno.env.get('AZURE_API_BASE_URL')?.trim()?.replace(/\/$/, '') ||
    ''

  if (!upstreamBase) {
    return Response.json(
      { error: 'Server misconfiguration: set PURPULSE_API_BASE_URL or AZURE_API_BASE_URL in Secrets' },
      { status: 500 },
    )
  }

  const incoming = new URL(req.url)
  const path = incoming.pathname.replace(/\/$/, '') || '/'

  let upstreamPath: string
  if (path.endsWith('/me')) {
    upstreamPath = '/api/me'
  } else if (path.endsWith('/assignments')) {
    upstreamPath = '/api/assignments' + incoming.search
  } else {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Authorization Bearer token required' }, { status: 401 })
  }

  const upstream = await fetch(`${upstreamBase}${upstreamPath}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
    },
  })

  const text = await upstream.text()
  const ct = upstream.headers.get('Content-Type') || 'application/json; charset=utf-8'
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    },
  })
})
