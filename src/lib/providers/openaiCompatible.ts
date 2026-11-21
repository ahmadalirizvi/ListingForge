import type { ImageProvider } from './types'
import { corsMessage } from './utils'

export const openaiCompatible:ImageProvider={
 type:'openai_compatible',supportsImageInput:false,
 async generate(input,config){
  try{
   const base=(config.proxyUrl||config.baseUrl||'https://api.openai.com/v1').replace(/\/$/,'')
   const response=await fetch(`${base}/images/generations`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,prompt:input.prompt,n:1,size:'1024x1024',response_format:'b64_json'})})
   if(!response.ok) throw new Error(`OpenAI-compatible API failed (${response.status}): ${await response.text()}`)
   const json=await response.json(); const value=json.data?.[0]?.b64_json
   if(!value) throw new Error('No base64 image was returned')
   const binary=atob(value); const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
   return {image:new Blob([bytes],{type:'image/png'}),mimeType:'image/png'}
  }catch(error){throw new Error(corsMessage(error))}
 },
 async testConnection(config){return config.apiKey?{ok:true,message:'OpenAI-compatible credentials are configured.'}:{ok:false,message:'An API key is required.'}}
}
