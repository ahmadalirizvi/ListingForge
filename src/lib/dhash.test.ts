import { describe,it,expect } from 'vitest'
import { hammingDistance } from './dhash'
describe('dHash similarity',()=>{
 it('calculates exact distance',()=>expect(hammingDistance([1,0,1],[1,1,1])).toBe(1))
 it('returns zero for identical hashes',()=>expect(hammingDistance([0,1],[0,1])).toBe(0))
})
