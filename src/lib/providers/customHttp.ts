import type { ImageProvider } from './types'
export const customHttp:ImageProvider={
 type:'custom_http',supportsImageInput:true,
 async generate(input,config){
  const template=config.bodyTemplate||'{"prompt":"{{prompt}}","seed":{{seed}}}'
  const body=template.replaceAll('{{prompt}}',JSON.stringify(input.prompt).slice(1,-1)).replaceAll('{{seed}}',String(input.seed||0)).replaceAll('{{image_base64}}','')
  const response=await fetch(config.baseUrl,{method:'POST',headers:{'Content-Type':'application/json',...config.headers},body})
  if(!response.ok) throw new Error(`Custom HTTP failed (${response.status})`)
  const json=await response.json(); const path=(config.responsePath||'data.image').split('.'); let value:any=json
  for(const key of path) value=value?.[key]
  if(typeof value!=='string') throw new Error('Custom response JSON path did not contain an image')
  const binary=atob(value.replace(/^data:image\/[^;]+;base64,/,''))
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
  return {image:new Blob([bytes],{type:'image/png'}),mimeType:'image/png'}
 },
 async testConnection(config){return config.baseUrl?{ok:true,message:'Custom endpoint URL is configured.'}:{ok:false,message:'A custom endpoint URL is required.'}}
}
