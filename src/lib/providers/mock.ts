import type { ImageProvider } from './types'

export const mock: ImageProvider = {
  type:'mock',
  supportsImageInput:true,
  async generate(input) {
    const bitmap = input.referenceImage ? await createImageBitmap(input.referenceImage) : null
    const canvas = document.createElement('canvas')
    canvas.width = 3000
    canvas.height = 2250
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = ['#e8d8c8','#d9e6d8','#d7dff0'][Math.floor(Math.random()*3)]
    ctx.fillRect(0,0,canvas.width,canvas.height)
    if (bitmap) {
      const scale = Math.min(1800/bitmap.width,1300/bitmap.height)
      ctx.drawImage(bitmap,(3000-bitmap.width*scale)/2,(2250-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale)
    }
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Encoding failed')),'image/jpeg',0.92))
    return {image:blob,mimeType:'image/jpeg'}
  },
  async testConnection() { return {ok:true,message:'Mock provider is ready.'} },
}
