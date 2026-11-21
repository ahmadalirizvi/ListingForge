export interface OutputPreset {width:number;height:number;fit:'contain'|'cover'|'pad';background:string;maxKB:number;format:'jpeg'|'png'|'webp';quality:number}

export async function preprocessBlob(blob:Blob,maxSide=1536):Promise<Blob>{
  const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'} as any)
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement('canvas')
  canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale)
  const ctx=canvas.getContext('2d',{colorSpace:'srgb'} as any) as CanvasRenderingContext2D
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
  return await canvasToBlob(canvas,blob.type.includes('png')?'image/png':'image/jpeg',0.9)
}

export async function postProcessBlob(blob:Blob,preset:OutputPreset):Promise<{blob:Blob;width:number;height:number}>{
  const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'} as any)
  const canvas=document.createElement('canvas')
  canvas.width=preset.width;canvas.height=preset.height
  const ctx=canvas.getContext('2d',{colorSpace:'srgb'} as any) as CanvasRenderingContext2D
  ctx.fillStyle=preset.background;ctx.fillRect(0,0,preset.width,preset.height)
  const scale=preset.fit==='cover'?Math.max(preset.width/bitmap.width,preset.height/bitmap.height):Math.min(preset.width/bitmap.width,preset.height/bitmap.height)
  const w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale)
  ctx.drawImage(bitmap,(preset.width-w)/2,(preset.height-h)/2,w,h)
  const mime=preset.format==='png'?'image/png':preset.format==='webp'?'image/webp':'image/jpeg'
  let best=await canvasToBlob(canvas,mime,preset.format==='png'?1:preset.quality)
  if(preset.format!=='png'){
    let low=.3,high=preset.quality
    for(let i=0;i<8;i++){
      const mid=(low+high)/2
      const candidate=await canvasToBlob(canvas,mime,mid)
      if(candidate.size<=preset.maxKB*1024) {best=candidate;low=mid}else high=mid
    }
  }
  return {blob:best,width:preset.width,height:preset.height}
}

function canvasToBlob(canvas:HTMLCanvasElement,mime:string,quality:number){
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Canvas encoding failed')),mime,quality))
}
