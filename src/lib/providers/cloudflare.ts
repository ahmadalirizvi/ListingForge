import type { ImageProvider } from './types'
export const cloudflare:ImageProvider={
 type:'cloudflare',supportsImageInput:false,
 async generate(input,config){
  if(!config.proxyUrl) throw new Error('Cloudflare Workers AI requires the CORS proxy URL.')
  const url=config.proxyUrl.replace(/\/$/,'')+'/cloudflare'
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:config.accountId,token:config.apiKey,model:config.model,prompt:input.prompt})})
  if(!response.ok) throw new Error(`Cloudflare failed (${response.status})`)
  const blob=await response.blob(); return {image:blob,mimeType:blob.type||'image/png'}
 },
 async testConnection(config){return config.proxyUrl&&config.accountId&&config.apiKey?{ok:true,message:'Cloudflare proxy configuration is complete.'}:{ok:false,message:'Account ID, token and proxy URL are required.'}}
}
