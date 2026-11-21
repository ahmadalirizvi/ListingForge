export function hammingDistance(a:number[],b:number[]){
  let distance=0
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) distance++
  return distance
}

export async function computeDHash(blob:Blob):Promise<number[]>{
  const bitmap=await createImageBitmap(blob)
  const canvas=new OffscreenCanvas(9,8)
  const ctx=canvas.getContext('2d')!
  ctx.drawImage(bitmap,0,0,9,8)
  const data=ctx.getImageData(0,0,9,8).data
  const hash:number[]=[]
  for(let y=0;y<8;y++){
    for(let x=0;x<8;x++){
      const i=(y*9+x)*4,j=(y*9+x+1)*4
      const gray1=(data[i]+data[i+1]+data[i+2])/3
      const gray2=(data[j]+data[j+1]+data[j+2])/3
      hash.push(gray1>gray2?1:0)
    }
  }
  return hash
}
