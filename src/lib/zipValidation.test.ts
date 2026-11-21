import { describe,it,expect } from 'vitest'
import { sanitizeFilename } from './zipValidation'
describe('zip validation',()=>{
 it('sanitizes unsafe filename characters',()=>expect(sanitizeFilename('../../My Photo!.jpg')).toBe('My-Photo-.jpg'))
 it('normalizes nested paths',()=>expect(sanitizeFilename('folder\\\\photo.png')).toBe('photo.png'))
})
