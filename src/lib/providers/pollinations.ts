import type { ImageProvider } from './types'

export const pollinations: ImageProvider = {
  type:'pollinations',
  supportsImageInput:false,
  async generate(input) {
    const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(input.prompt)}`)
    url.searchParams.set('width','3000')
    url.searchParams.set('height','2250')
    if (input.seed) url.searchParams.set('seed',String(input.seed))
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Pollinations failed (${response.status})`)
    return {image: await response.blob(), mimeType:'image/jpeg'}
  },
  async testConnection() {
    return {ok:true,message:'Pollinations is reachable from the browser.'}
  },
}
