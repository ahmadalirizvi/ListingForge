import { describe,it,expect } from 'vitest'
import { combinationKey,sampleCombination } from './promptEngine'

describe('prompt engine combinations',()=>{
 it('does not reuse combinations in a job',()=>{
  const used=new Set<string>()
  for(let i=0;i<30;i++){
   const c=sampleCombination(used,'Mixed')
   const key=combinationKey(c)
   expect(used.has(key)).toBe(false)
   used.add(key)
  }
 })
 it('regeneration can draw a new combination',()=>{
  const used=new Set<string>()
  const first=sampleCombination(used);used.add(combinationKey(first))
  const second=sampleCombination(used);expect(combinationKey(second)).not.toBe(combinationKey(first))
 })
})
