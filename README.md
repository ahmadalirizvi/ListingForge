# ListingForge

ListingForge is a static, browser-only tool for converting a ZIP of ecommerce product photos into Etsy-ready lifestyle scenes. It uses user-entered provider API keys and never sends keys to the repository or build workflow.

## Run locally

```bash
npm install
npm run dev
```

Build and test:

```bash
npm test
npm run lint
npm run scan-secrets
npm run build
```

The Vite base defaults to `/ListingForge/`. Set `VITE_BASE_PATH=/` for local or alternate hosting.

## GitHub Pages

The included workflow builds `main` and deploys `dist` using GitHub Actions. After the first push, open the repository Settings > Pages > Build and deployment > Source and select GitHub Actions.

Production URL:

https://ahmadalirizvi.github.io/ListingForge/

## Provider setup

Open Provider Manager and add or edit an instance. Provider API keys are typed into the browser UI and are not included in exports or the manifest. Keys are kept in the browser session only; enable encryption later with the planned passphrase key vault.

Supported provider types:

- Gemini: Generative Language API, model name and key.
- OpenAI-compatible: configurable base URL, key and model.
- Hugging Face: inference token and model.
- Pollinations: keyless text-to-image.
- Cloudflare Workers AI: account ID, token and proxy URL.
- Custom HTTP: URL, headers, body template and JSON response path.
- Mock: no-network UI testing with an overlay.

For each provider, set its priority, daily limit and concurrency. Fill first uses priority order, Round-robin uses enabled providers with remaining quota, and Manual pins one provider for the job.

## Adding a provider in code

A new provider needs one module under `src/lib/providers`, an `ImageProvider` implementation, and one registry entry in `src/lib/providers/registry.ts`.

```ts
export const example: ImageProvider = {
  type: 'example',
  supportsImageInput: false,
  async generate(input, config) { /* fetch and return a Blob */ },
  async testConnection(config) { /* return ok/message */ },
}
```

The provider should implement CORS-safe fetching and never read or write API keys outside the browser UI.

## Optional Cloudflare CORS proxy

Deploy `proxy/cloudflare-worker.js` as a Cloudflare Worker. Set the worker environment variable `ALLOWED_ORIGIN` to `https://ahmadalirizvi.github.io`, deploy the worker, and enter its URL as a provider proxy URL.

The proxy is allow-limited to Cloudflare's API and rejects requests whose Origin does not match `ALLOWED_ORIGIN`. Browser keys are still user-owned secrets and should not be embedded in worker code.

## Presets and variation lists

Edit `src/config/presets.json` to change the Etsy or custom output defaults. Edit `src/config/variations.json` to change scene, camera, lens, lighting, composition, props, palette and mood choices. Prompt assembly is in `src/lib/promptEngine.ts`.

## Etsy photo guidance

The Etsy preset targets 3000 by 2250 pixels, 4:3, a 2000-pixel minimum width, sRGB, JPEG and approximately 2000 KB. Etsy listing-photo requirements and crop rules can change. Verify the final export against Etsy's current Seller Help listing-photo guidelines before bulk use.

## Security and key storage

Keys are masked in provider forms and excluded from the ZIP manifest and session exports. The repository and GitHub workflow contain no API keys. `npm run scan-secrets` rejects likely key-like literals.

Browser persistence uses IndexedDB. API keys are not currently persisted by this implementation: re-enter them after a refresh. Use HTTPS and only connect to providers you trust.

## Rights and usage

Only upload product images you own or are authorized to process and commercialize. Review generated output for trademarks, logos, likenesses and marketplace policy compliance.
