import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { get, set } from 'idb-keyval'
import './App.css'
import presets from './config/presets.json'
import exampleProviders from './config/providers.example.json'
import type { ProviderConfig } from './lib/providers/types'
import { providerRegistry } from './lib/providers/registry'
import { validateAndReadZip, type ZipImage } from './lib/zipValidation'
import { buildPrompt, combinationKey, negativePrompt, sampleCombination, type VariationCombination } from './lib/promptEngine'
import { getUsage, incrementUsage, remainingQuota } from './lib/quota'
import { postProcessBlob, preprocessBlob, type OutputPreset } from './lib/postProcess'
import { computeDHash, hammingDistance } from './lib/dhash'
import { downloadBlob, escapeCsv } from './lib/download'

type JobStatus='queued'|'preparing'|'generating'|'post-processing'|'done'|'failed'
interface JobCard {
  id:string; source:ZipImage; status:JobStatus; progress:number; resultUrl?:string; originalUrl?:string
  resultBlob?:Blob; prompt:string; combination?:VariationCombination; seed:number; provider:string; model:string
  error?:string; keep:boolean; history:{url:string;blob:Blob;prompt:string;combination:VariationCombination;seed:number}[]
}

const providerDefaults:ProviderConfig[]=(exampleProviders as unknown as ProviderConfig[]).map(p=>({...p,apiKey:'',headers:{},bodyTemplate:'',responsePath:'data.image'}))

function App(){
  const [images,setImages]=useState<ZipImage[]>([])
  const [cards,setCards]=useState<JobCard[]>([])
  const [providers,setProviders]=useState<ProviderConfig[]>(providerDefaults)
  const [usage,setUsage]=useState<Record<string,number>>({})
  const [providerScreen,setProviderScreen]=useState(false)
  const [strategy,setStrategy]=useState<'fill'|'round-robin'|'manual'>('fill')
  const [presetName,setPresetName]=useState<'etsy_listing'|'custom'>('etsy_listing')
  const [preset,setPreset]=useState<OutputPreset>(presets.etsy_listing as OutputPreset)
  const [product,setProduct]=useState('')
  const [extra,setExtra]=useState('')
  const [styleSet,setStyleSet]=useState('Mixed')
  const [describe,setDescribe]=useState(false)
  const [dark,setDark]=useState(false)
  const [dragging,setDragging]=useState(false)
  const [notice,setNotice]=useState('')
  const [zipProgress,setZipProgress]=useState(0)
  const [manualProvider,setManualProvider]=useState('')
  const usedCombinations=useRef(new Set<string>())
  const fileInput=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    document.documentElement.classList.toggle('dark',dark)
  },[dark])
  useEffect(()=>{
    getUsage().then(setUsage)
    get<{providers?:ProviderConfig[];cards?:JobCard[]}>('listingforge-session').then(saved=>{
      if(saved?.providers) setProviders(saved.providers.map(p=>({...p,apiKey:''})))
      if(saved?.cards) setCards(saved.cards)
    })
  },[])
  useEffect(()=>{
    set('listingforge-session',{providers:providers.map(p=>({...p,apiKey:'[REDACTED]'})),cards:cards.map(c=>({...c,resultBlob:undefined,source:{...c.source,file:undefined as any}}))})
  },[providers,cards])

  const selected=useMemo(()=>images.filter(i=>i.selected),[images])
  const quota=remainingQuota(providers,usage)

  function addProvider(){
    setProviders(p=>[...p,{id:crypto.randomUUID(),label:'New provider',type:'mock',apiKey:'',model:'',baseUrl:'',dailyLimit:100,priority:p.length+1,maxConcurrency:1,enabled:true,headers:{},bodyTemplate:'',responsePath:'data.image'}])
  }
  function updateProvider(id:string,patch:Partial<ProviderConfig>){setProviders(p=>p.map(v=>v.id===id?{...v,...patch}:v))}

  async function readFile(file:File){
    setNotice('')
    if(!file.name.toLowerCase().endsWith('.zip')){setNotice('Choose a ZIP file.');return}
    try{
      const result=await validateAndReadZip(file,setZipProgress)
      setImages(result)
      setCards([])
    }catch(error){setNotice(error instanceof Error?error.message:'Could not read the ZIP.')}
  }
  function toggleImage(id:number,selected:boolean){setImages(v=>v.map((x,i)=>i===id?{...x,selected}:x))}

  async function generate(){
    if(!selected.length){setNotice('Select at least one image.');return}
    if(quota<selected.length){setNotice(`The enabled providers have ${quota} remaining calls. Trim the selection or enable/fix providers.`);return}
    usedCombinations.current=new Set()
    const next:JobCard[]=selected.map((source,index)=>{
      const seed=Math.floor(Math.random()*2147483647)
      let combination:VariationCombination
      try{combination=sampleCombination(usedCombinations.current,styleSet)}catch{combination=undefined as any}
      if(combination) usedCombinations.current.add(combinationKey(combination))
      return {id:`${Date.now()}-${index}`,source,status:'queued',progress:0,prompt:combination?buildPrompt(product,combination,seed,extra,presetName==='etsy_listing'?'4:3':'4:3'): '',seed,combination,provider:'',model:'',keep:true,history:[]}
    })
    setCards(next)
    await runCards(next)
  }

  async function runCards(initial:JobCard[]){
    let cursor=0
    async function worker(){
      while(cursor<initial.length){
        const index=cursor++
        await processCard(initial[index])
      }
    }
    await Promise.all(Array.from({length:Math.min(3,initial.length)},()=>worker()))
  }

  async function processCard(card:JobCard){
    const update=(patch:Partial<JobCard>)=>setCards(v=>v.map(c=>c.id===card.id?{...c,...patch}:c))
    try{
      update({status:'preparing',progress:12})
      const input=await preprocessBlob(card.source.file,1536)
      update({progress:25,status:'generating'})
      const enabled=providers.filter(p=>p.enabled).sort((a,b)=>a.priority-b.priority)
      let lastError=''
      let generated:{image:Blob;mimeType:string}|undefined
      let chosen:ProviderConfig|undefined
      for(let attempt=0;attempt<enabled.length&& !generated;attempt++){
        const provider=enabled[attempt]
        if((usage[provider.id]||0)>=provider.dailyLimit){continue}
        const implementation=providerRegistry[provider.type]
        if(!implementation){lastError=`Provider type ${provider.type} is not registered.`;continue}
        try{
          let prompt=card.prompt
          if(describe&&implementation.supportsImageInput&&implementation.describeProduct){
            const description=await implementation.describeProduct(input,provider)
            if(card.combination) prompt=buildPrompt(description,card.combination,card.seed,extra,'4:3')
          }
          generated=await implementation.generate({prompt,negativePrompt,referenceImage:implementation.supportsImageInput?input:undefined,aspectRatio:'4:3',seed:card.seed},provider)
          chosen=provider
          await incrementUsage(provider.id)
          setUsage(await getUsage())
        }catch(error){
          lastError=error instanceof Error?error.message:String(error)
          if(/429|quota|5\d\d/i.test(lastError)&&attempt<enabled.length-1) await new Promise(r=>setTimeout(r,500*(attempt+1)))
        }
      }
      if(!generated||!chosen) throw new Error(lastError||'No enabled provider with remaining quota could generate an image.')
      update({progress:65,status:'post-processing',provider:chosen.label,model:chosen.model})
      const processed=await postProcessBlob(generated.image,preset)
      update({progress:90})
      const sourceHash=await computeDHash(card.source.file)
      const resultHash=await computeDHash(processed.blob)
      if(hammingDistance(sourceHash,resultHash)<12) throw new Error('Generated result was too similar to the source. Retrying with a new scene is recommended.')
      const url=URL.createObjectURL(processed.blob)
      update({status:'done',progress:100,resultUrl:url,resultBlob:processed.blob,originalUrl:card.source.previewUrl,prompt:card.prompt,history:[...card.history]})
    }catch(error){
      update({status:'failed',progress:100,error:error instanceof Error?error.message:String(error)})
    }
  }

  async function regenerate(card:JobCard,editPrompt=false){
    try{
      const seed=Math.floor(Math.random()*2147483647)
      const newCombination=sampleCombination(usedCombinations.current,styleSet)
      usedCombinations.current.add(combinationKey(newCombination))
      const prompt=editPrompt&&card.prompt?card.prompt:buildPrompt(product,newCombination,seed,extra,'4:3')
      if(editPrompt){setNotice('Edit the prompt in the card, then press Regenerate.');}
      const updated={...card,seed,prompt,combination:newCombination,status:'queued' as JobStatus,progress:0,error:undefined}
      if(card.resultUrl) updated.history=[...card.history,{url:card.resultUrl,blob:card.resultBlob!,prompt:card.prompt,combination:card.combination!,seed:card.seed}]
      setCards(v=>v.map(c=>c.id===card.id?updated:c))
      await processCard(updated)
    }catch(error){setNotice(error instanceof Error?error.message:String(error))}
  }

  async function downloadAll(){
    const doneCards=cards.filter(c=>c.status==='done'&&c.resultBlob)
    if(!doneCards.length){setNotice('No completed results to download.');return}
    const zip=new JSZip()
    const base=presetName==='etsy_listing'?'product':'product'
    const rows=['source file,output file,provider,model,seed,scene combination,final prompt,dimensions,file size']
    const originals=zip.folder('originals_optimized')!
    const results=zip.folder('results')!
    for(let i=0;i<doneCards.length;i++){
      const c=doneCards[i]
      const ext=preset.format==='png'?'png':preset.format==='webp'?'webp':'jpg'
      const output=`${base}-${String(i+1).padStart(2,'0')}.${ext}`
      results.file(output,c.resultBlob!)
      const sourceOptimized=await preprocessBlob(c.source.file,preset.width)
      originals.file(`${base}-${String(i+1).padStart(2,'0')}.${c.source.file.type.includes('png')?'png':'jpg'}`,sourceOptimized)
      const combo=c.combination?JSON.stringify(c.combination):''
      rows.push([escapeCsv(c.source.name),escapeCsv(output),escapeCsv(c.provider),escapeCsv(c.model),c.seed,escapeCsv(combo),escapeCsv(c.prompt),escapeCsv(`${preset.width}x${preset.height}`),escapeCsv(`${c.resultBlob!.size} bytes`)].join(','))
    }
    zip.file('manifest.csv',rows.join('\n'))
    const blob=await zip.generateAsync({type:'blob'})
    await downloadBlob(blob,'ListingForge-results.zip')
  }

  async function testProvider(p:ProviderConfig){
    const result=await providerRegistry[p.type]?.testConnection(p)
    setNotice(result?.message||'Provider is not registered.')
  }

  function clearSession(){
    cards.forEach(c=>{if(c.resultUrl)URL.revokeObjectURL(c.resultUrl)})
    setCards([]);setImages([]);setNotice('Session cleared.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark" />ListingForge</div>
        <div className="header-actions">
          <span className="quota">Remaining quota: {quota}</span>
          <button className="icon-button" onClick={()=>setDark(v=>!v)} aria-label="Toggle color theme">{dark?'Light':'Dark'}</button>
          <button className="icon-button" onClick={()=>setProviderScreen(v=>!v)}>Providers</button>
          <button className="icon-button" onClick={clearSession}>Clear session</button>
        </div>
      </header>

      {providerScreen?(
        <main className="provider-screen">
          <div className="section-heading"><div><p className="eyebrow">Integrations</p><h1>Provider Manager</h1></div><button onClick={addProvider}>Add provider</button></div>
          <div className="provider-toolbar">
            <label>Strategy<select value={strategy} onChange={e=>setStrategy(e.target.value as any)}><option value="fill">Fill first</option><option value="round-robin">Round-robin</option><option value="manual">Pick one manually</option></select></label>
            {strategy==='manual'&&<label>Provider<select value={manualProvider} onChange={e=>setManualProvider(e.target.value)}><option value="">Choose provider</option>{providers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
          </div>
          <div className="provider-grid">
            {providers.map(p=>(
              <article className="provider-card" key={p.id}>
                <div className="provider-title"><input value={p.label} onChange={e=>updateProvider(p.id,{label:e.target.value})}/><label className="switch"><input type="checkbox" checked={p.enabled} onChange={e=>updateProvider(p.id,{enabled:e.target.checked})}/><span /></label></div>
                <label>Type<select value={p.type} onChange={e=>updateProvider(p.id,{type:e.target.value as any})}>{Object.keys(providerRegistry).map(type=><option key={type} value={type}>{type}</option>)}</select></label>
                <label>Model<input value={p.model} onChange={e=>updateProvider(p.id,{model:e.target.value})}/></label>
                <label>API key<input type="password" value={p.apiKey} onChange={e=>updateProvider(p.id,{apiKey:e.target.value})} placeholder="Stored on this device"/></label>
                <label>Base URL<input value={p.baseUrl||''} onChange={e=>updateProvider(p.id,{baseUrl:e.target.value})}/></label>
                {p.type==='cloudflare'&&<><label>Account ID<input value={p.accountId||''} onChange={e=>updateProvider(p.id,{accountId:e.target.value})}/></label><label>Proxy URL<input value={p.proxyUrl||''} onChange={e=>updateProvider(p.id,{proxyUrl:e.target.value})}/></label></>}
                {p.type==='custom_http'&&<><label>Proxy URL<input value={p.proxyUrl||''} onChange={e=>updateProvider(p.id,{proxyUrl:e.target.value})}/></label><label>JSON response path<input value={p.responsePath||''} onChange={e=>updateProvider(p.id,{responsePath:e.target.value})}/></label><label>Body template<textarea value={p.bodyTemplate||''} onChange={e=>updateProvider(p.id,{bodyTemplate:e.target.value})}/></label></>}
                <div className="provider-meta"><label>Daily limit<input type="number" value={p.dailyLimit} onChange={e=>updateProvider(p.id,{dailyLimit:Number(e.target.value)})}/></label><label>Priority<input type="number" value={p.priority} onChange={e=>updateProvider(p.id,{priority:Number(e.target.value)})}/></label><label>Concurrency<input type="number" value={p.maxConcurrency} onChange={e=>updateProvider(p.id,{maxConcurrency:Number(e.target.value)})}/></label></div>
                {providerRegistry[p.type]&&!providerRegistry[p.type].supportsImageInput&&<p className="warning">This provider cannot preserve your exact product.</p>}
                <div className="card-actions"><button onClick={()=>testProvider(p)}>Test connection</button><button onClick={()=>setProviders(v=>v.filter(x=>x.id!==p.id))}>Delete</button></div>
              </article>
            ))}
          </div>
        </main>
      ):(
        <main className="main-grid">
          <section className="left-column">
            <div className={`drop-zone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0])}} onClick={()=>fileInput.current?.click()} role="button" tabIndex={0}>
              <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/>
              <div className="drop-icon">+</div><h2>Drop a product image ZIP</h2><p>JPG, JPEG, PNG or WebP. Up to 200 MB and 100 images.</p>
              {zipProgress>0&&zipProgress<100&&<progress value={zipProgress} max="100"/>}
            </div>

            {images.length>0&&<div className="image-grid-wrap"><div className="grid-toolbar"><span>{selected.length} of {images.length} selected</span><div><button onClick={()=>setImages(v=>v.map(x=>({...x,selected:true})))}>Select all</button><button onClick={()=>setImages(v=>v.map(x=>({...x,selected:false})))}>None</button></div></div><div className="image-grid">{images.map((img,index)=><label className="thumb" key={index}><input type="checkbox" checked={img.selected} onChange={e=>toggleImage(index,e.target.checked)} /><img src={img.previewUrl} alt={img.name}/><span>{img.name}</span></label>)}</div></div>}

            {cards.length>0&&<div className="progress-grid">{cards.map(card=><article className={`progress-card ${card.status}`} key={card.id}><img src={card.source.previewUrl} alt=""/><div><strong>{card.source.name}</strong><span>{card.status}</span>{card.error&&<small>{card.error}</small>}<progress value={card.progress} max="100"/></div></article>)}</div>}

            {cards.some(c=>c.status==='done')&&<div className="results-section"><div className="section-heading"><div><p className="eyebrow">Output</p><h2>Results</h2></div><div><button onClick={()=>cards.filter(c=>c.status==='failed').forEach(processCard)}>Retry failed</button><button onClick={()=>cards.filter(c=>c.keep===false).forEach(c=>regenerate(c))}>Regenerate discarded</button><button className="primary" onClick={downloadAll}>Download all</button></div></div><div className="results-grid">{cards.filter(c=>c.resultUrl).map(card=><article className="result-card" key={card.id}><div className="compare"><img className="base-image" src={card.resultUrl} alt="Generated result"/><div className="before" style={{width:'50%'}}><img src={card.originalUrl} alt="Original"/></div><div className="compare-line" style={{left:'50%'}}/></div><div className="result-content"><strong>{card.source.name}</strong><p>{card.combination?.scene}</p>            <div className="card-actions"><button onClick={()=>regenerate(card)}>Regenerate</button><button onClick={()=>regenerate(card,true)}>Edit prompt</button><button onClick={()=>card.resultBlob&&downloadBlob(card.resultBlob,`${card.source.name.replace(/\.[^.]+$/, '')}-result.jpg`)}>Download</button><button onClick={()=>setCards(v=>v.map(c=>c.id===card.id?{...c,keep:!c.keep}:c))}>{card.keep?'Keep':'Discarded'}</button></div></div></article>)}</div></div>}
          </section>

          <aside className="settings-panel">
            <p className="eyebrow">Settings</p><h2>Scene setup</h2>
            <label>Preset<select value={presetName} onChange={e=>{const name=e.target.value as 'etsy_listing'|'custom';setPresetName(name);setPreset(presets[name] as OutputPreset)}}><option value="etsy_listing">Etsy listing</option><option value="custom">Custom</option></select></label>
            {presetName==='custom'&&<div className="custom-size"><label>Width<input type="number" value={preset.width} onChange={e=>setPreset(p=>({...p,width:Number(e.target.value)}))}/></label><label>Height<input type="number" value={preset.height} onChange={e=>setPreset(p=>({...p,height:Number(e.target.value)}))}/></label><label>Fit<select value={preset.fit} onChange={e=>setPreset(p=>({...p,fit:e.target.value as any}))}><option>contain</option><option>cover</option><option>pad</option></select></label><label>Background<input type="color" value={preset.background} onChange={e=>setPreset(p=>({...p,background:e.target.value}))}/></label></div>}
            <label>Output format<select value={preset.format} onChange={e=>setPreset(p=>({...p,format:e.target.value as any}))}><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label>
            <label>Quality<input type="range" min=".5" max="1" step=".01" value={preset.quality} onChange={e=>setPreset(p=>({...p,quality:Number(e.target.value)}))}/></label>
            <label>Max file size (KB)<input type="number" value={preset.maxKB} onChange={e=>setPreset(p=>({...p,maxKB:Number(e.target.value)}))}/></label>
            <label>Product name or category<input value={product} onChange={e=>setProduct(e.target.value)} placeholder="Handmade ceramic mug"/></label>
            <label>Scene style<select value={styleSet} onChange={e=>setStyleSet(e.target.value)}><option>Studio</option><option>Lifestyle</option><option>Flat-lay</option><option>Seasonal</option><option>Minimal</option><option>Mixed</option></select></label>
            <label>Extra instructions<textarea value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Keep text and patterns unchanged"/></label>
            <label>Generation strategy<select value={strategy} onChange={e=>setStrategy(e.target.value as any)}><option value="fill">Fill first</option><option value="round-robin">Round-robin</option><option value="manual">Pick one manually</option></select></label>
            {strategy==='manual'&&<label>Provider<select value={manualProvider} onChange={e=>setManualProvider(e.target.value)}><option value="">Choose provider</option>{providers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
            <label className="toggle-row"><span><strong>Describe product first</strong><small>Optional vision pass</small></span><input type="checkbox" checked={describe} onChange={e=>setDescribe(e.target.checked)}/></label>
            <button className="generate-button" disabled={!selected.length} onClick={generate}>Generate {selected.length||''} images</button>
          </aside>
        </main>
      )}
      {notice&&<div className="toast" role="alert">{notice}<button onClick={()=>setNotice('')}>Close</button></div>}
    </div>
  )
}

export default App
