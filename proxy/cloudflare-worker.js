export default {
  async fetch(request, env) {
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 })
    const url = new URL(request.url)
    if (url.pathname !== '/cloudflare') return new Response('Not found', { status: 404 })
    const body = await request.json()
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${body.accountId}/ai/run/${body.model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${body.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: body.prompt }),
    })
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream', 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN },
    })
  },
}
