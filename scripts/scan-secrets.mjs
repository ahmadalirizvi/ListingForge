import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ignore = new Set(['node_modules', '.git', 'dist'])
const patterns = [/AIza[0-9A-Za-z_-]{20,}/, /sk-[A-Za-z0-9_-]{20,}/, /hf_[A-Za-z0-9]{20,}/]

async function scan(dir) {
  for (const entry of await readdir(dir)) {
    if (ignore.has(entry)) continue
    const file = path.join(dir, entry)
    const info = await stat(file)
    if (info.isDirectory()) await scan(file)
    else if (/\.(js|jsx|ts|tsx|json|env|yml|yaml|md)$/.test(entry)) {
      const text = await readFile(file, 'utf8')
      if (patterns.some(pattern => pattern.test(text))) {
        console.error(`Possible API key-like string found in ${file}`)
        process.exitCode = 1
      }
    }
  }
}
await scan(process.cwd())
