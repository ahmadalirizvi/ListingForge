import { describe,it,expect } from 'vitest'
import { pickProvider,remainingQuota } from './quota'

const providers:any[]=[
 {id:'a',enabled:true,priority:1,dailyLimit:2},
 {id:'b',enabled:true,priority:2,dailyLimit:4},
]
describe('quota and failover',()=>{
 it('counts only remaining enabled quota',()=>expect(remainingQuota(providers,{a:2,b:1})).toBe(3))
 it('fills priority first until limit',()=>expect(pickProvider(providers,'fill',{a:2,b:0})?.id).toBe('b'))
 it('round robin chooses first available provider',()=>expect(pickProvider(providers,'round-robin',{a:0,b:0})?.id).toBe('a'))
})
