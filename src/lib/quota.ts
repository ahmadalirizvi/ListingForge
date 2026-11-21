import type { ProviderConfig } from './providers/types'
import { get,set } from 'idb-keyval'

export interface UsageMap { [providerId:string]:number }

export async function getUsage(resetTimezone='UTC'):Promise<UsageMap>{
  const stored=await get<{date:string;usage:UsageMap}>('listingforge-usage')
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:resetTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  if(!stored||stored.date!==today) return {}
  return stored.usage
}
export async function incrementUsage(providerId:string,resetTimezone='UTC'){
  const usage=await getUsage(resetTimezone)
  usage[providerId]=(usage[providerId]||0)+1
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:resetTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  await set('listingforge-usage',{date,usage})
  return usage
}
export function remainingQuota(providers:ProviderConfig[],usage:UsageMap){
  return providers.filter(p=>p.enabled).reduce((n,p)=>n+Math.max(0,p.dailyLimit-(usage[p.id]||0)),0)
}

export function pickProvider(providers:ProviderConfig[],strategy:'fill'|'round-robin'|'manual',usage:UsageMap,manualId?:string){
  const enabled=providers.filter(p=>p.enabled).sort((a,b)=>a.priority-b.priority)
  if(strategy==='manual') return enabled.find(p=>p.id===manualId)||enabled.find(p=>(usage[p.id]||0)<p.dailyLimit)||null
  if(strategy==='round-robin') return enabled.find(p=>(usage[p.id]||0)<p.dailyLimit)??null
  return enabled.find(p=>(usage[p.id]||0)<p.dailyLimit)||null
}
