
export async function downloadBlob(blob:Blob,name:string){
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)
}

export function escapeCsv(value:string){
  return `"${value.replaceAll('"','""')}"`
}
