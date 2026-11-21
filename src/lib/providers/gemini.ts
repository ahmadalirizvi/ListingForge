import type { ImageProvider } from './types'
import { blobToBase64, corsMessage } from './utils'

export const gemini: ImageProvider = {
  type:'gemini',
  supportsImageInput:true,
  async generate(input,config) {
    try {
      const parts:any[] = [{text:input.prompt}]
      if (input.referenceImage) parts.unshift({inlineData:{mimeType:input.referenceImage.type||'image/jpeg',data:await blobToBase64(input.referenceImage)}})
      const base=config.proxyUrl||config.baseUrl||'https://generativelanguage.googleapis.com'
      const response=await fetch(`${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}]}),signal:input.signal,
      })
      if(!response.ok) throw new Error(`Gemini failed (${response.status}): ${await response.text()}`)
      const data=await response.json()
      const base64=data.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData)?.inlineData?.data
      if(!base64) throw new Error('Gemini returned no inline image')
      const binary=atob(base64)
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
      return {image:new Blob([bytes],{type:'image/png'}),mimeType:'image/png'}
    } catch(error){throw new Error(corsMessage(error))}
  },
  async describeProduct(image,config) {
    const data=await blobToBase64(image)
    const base=config.proxyUrl||config.baseUrl||'https://generativelanguage.googleapis.com'
    const response=await fetch(`${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{inlineData:{mimeType:image.type,data}},{text:'Describe the product in one short, factual sentence. Do not describe the background.'}]}]})})
    if(!response.ok) throw new Error(`Gemini vision failed (${response.status})`)
    const json=await response.json()
    return json.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join(' ').trim()||'the product'
  },
  async testConnection(config) {
    if(!config.apiKey) return {ok:false,message:'An API key is required.'}
    try { return {ok:true,message:'Gemini credentials are configured. Run a generation to verify the model.'} } catch(error){return {ok:false,message:corsMessage(error)}}
  },
}
