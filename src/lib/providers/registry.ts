import type { ImageProvider } from './types'
import { gemini } from './gemini'
import { openaiCompatible } from './openaiCompatible'
import { huggingface } from './huggingface'
import { pollinations } from './pollinations'
import { cloudflare } from './cloudflare'
import { customHttp } from './customHttp'
import { mock } from './mock'

export const providerRegistry:Record<string,ImageProvider>={gemini,openai_compatible:openaiCompatible,huggingface,pollinations,cloudflare,custom_http:customHttp,mock}
