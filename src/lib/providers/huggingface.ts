import type { ImageProvider } from './types'
export const huggingface:ImageProvider={
 type:'huggingface',supportsImageInput:false,
 async generate(input,config){
  const base=config.proxyUrl||'https://api-inference.huggingface.co'
  const response=await fetch(`${base}/models/${config.model}`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({inputs:input.prompt})})
  if(!response.ok) throw new Error(`Hugging Face failed (${response.status}): ${await response.text()}`)
  const blob=await response.blob(); return {image:blob,mimeType:blob.type||'image/png'}
 },
 async testConnection(config){return config.apiKey?{ok:true,message:'Hugging Face token is configured.'}:{ok:false,message:'A Hugging Face token is required.'}}
}
