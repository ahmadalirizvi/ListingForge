export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer()
  let binary = ''
  const chunk = new Uint8Array(bytes)
  for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i])
  return btoa(binary)
}

export function corsMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/cors|failed to fetch|network/i.test(text)) {
    return 'Request blocked by CORS. Configure the provider origin or use the optional Cloudflare proxy described in the README.'
  }
  return text
}
