export type ImageProviderType = 'gemini' | 'openai_compatible' | 'huggingface' | 'pollinations' | 'cloudflare' | 'custom_http' | 'mock'

export interface ProviderConfig {
  id: string
  label: string
  type: ImageProviderType
  apiKey: string
  model: string
  baseUrl: string
  proxyUrl?: string
  accountId?: string
  headers?: Record<string,string>
  bodyTemplate?: string
  responsePath?: string
  dailyLimit: number
  priority: number
  maxConcurrency: number
  enabled: boolean
}

export interface GenerateInput {
  prompt: string
  negativePrompt?: string
  referenceImage?: Blob
  aspectRatio?: '1:1'|'4:3'|'3:4'|'16:9'|'9:16'
  seed?: number
  signal?: AbortSignal
}

export interface ImageProvider {
  type: string
  supportsImageInput: boolean
  generate(input: GenerateInput, config: ProviderConfig): Promise<{image:Blob;mimeType:string}>
  describeProduct?(image: Blob, config: ProviderConfig): Promise<string>
  testConnection(config: ProviderConfig): Promise<{ok:boolean;message:string}>
}
