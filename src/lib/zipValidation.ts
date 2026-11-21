import JSZip from 'jszip'

export interface ZipImage {name:string;file:Blob;previewUrl:string;selected:boolean}
export const ZIP_MAX_BYTES=200*1024*1024
export const TOTAL_UNCOMPRESSED_LIMIT=500*1024*1024
export const FILE_UNCOMPRESSED_LIMIT=30*1024*1024

export function sanitizeFilename(name:string){
  return name.normalize('NFKC').replace(/\\/g,'/').split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g,'-').replace(/^\.+/,'')
}

export async function validateAndReadZip(zipFile:File,onProgress?:(n:number)=>void){
  if(zipFile.size>ZIP_MAX_BYTES) throw new Error('ZIP exceeds the 200 MB size limit.')
  const zip=await JSZip.loadAsync(zipFile)
  let total=0
  const entries=Object.values(zip.files).filter(e=>{
    const n=e.name
    return !e.dir&&!n.includes('__MACOSX')&&!n.split('/').pop()?.startsWith('.')
  })
  const images=entries.filter(e=>/\.(jpg|jpeg|png|webp)$/i.test(e.name))
  if(images.length>100) throw new Error('The ZIP contains more than 100 images.')
  const result:ZipImage[]=[]
  for(let i=0;i<images.length;i++){
    const entry=images[i]; const size=entry as any
    if((size._data?.uncompressedSize||0)>FILE_UNCOMPRESSED_LIMIT) throw new Error(`Image exceeds the per-file size limit: ${entry.name}`)
    const blob=await entry.async('blob')
    total+=blob.size
    if(blob.size>FILE_UNCOMPRESSED_LIMIT) throw new Error(`Image exceeds the per-file size limit: ${entry.name}`)
    if(total> TOTAL_UNCOMPRESSED_LIMIT) throw new Error('ZIP exceeds the total uncompressed size limit.')
    result.push({name:sanitizeFilename(entry.name),file:new Blob([blob],{type:mimeFromName(entry.name)}),previewUrl:URL.createObjectURL(blob),selected:true})
    onProgress?.(Math.round(((i+1)/images.length)*100))
  }
  if(!result.length) throw new Error('No JPG, JPEG, PNG or WebP images were found.')
  return result
}
function mimeFromName(name:string){
  const ext=name.split('.').pop()?.toLowerCase()
  return ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg'
}
