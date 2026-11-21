import variations from '../config/variations.json'

export interface VariationCombination {
  scene:string; camera_angle:string; lens_and_depth:string; lighting:string; composition:string; props_and_surface:string; palette:string; mood:string
}

export function combinationKey(c:VariationCombination){ return [c.scene,c.camera_angle,c.lighting].join('|') }

export function sampleCombination(used:Set<string>, _style='Mixed'):VariationCombination {
  const axes=variations as unknown as Record<string,string[]>
  for(let attempt=0;attempt<1000;attempt++){
    const c={
      scene:axes.scene[Math.floor(Math.random()*axes.scene.length)],
      camera_angle:axes.camera_angle[Math.floor(Math.random()*axes.camera_angle.length)],
      lens_and_depth:axes.lens_and_depth[Math.floor(Math.random()*axes.lens_and_depth.length)],
      lighting:axes.lighting[Math.floor(Math.random()*axes.lighting.length)],
      composition:axes.composition[Math.floor(Math.random()*axes.composition.length)],
      props_and_surface:axes.props_and_surface[Math.floor(Math.random()*axes.props_and_surface.length)],
      palette:axes.palette[Math.floor(Math.random()*axes.palette.length)],
      mood:axes.mood[Math.floor(Math.random()*axes.mood.length)],
    }
    if(!used.has(combinationKey(c))) return c
  }
  throw new Error('No unused variation combinations remain.')
}

export function buildPrompt(product:string,c:VariationCombination,seed:number,extra='',aspect='4:3'){
  const master=`Use the attached photo as the product reference. Keep the product itself - ${product || 'the product'} - recognizable and unchanged: same shape, proportions, materials, color, texture, stitching and overall design. Do not redesign, recolor, add or remove parts of the product. Completely replace everything around it: do NOT reuse the original photo's background, surface, props, framing, camera angle, lighting or any watermark, text overlay or seller branding. Create a brand-new photograph of this product in a different setting.

Scene: ${c.scene}.
Camera: ${c.camera_angle}, ${c.lens_and_depth}.
Lighting: ${c.lighting}.
Composition: ${c.composition}, product kept inside the central 80% safe area for marketplace thumbnails.
Props and surface: ${c.props_and_surface}.
Color palette: ${c.palette}.
Mood: ${c.mood}.
Quality: ultra-sharp focus on the product, realistic contact shadows and reflections, accurate scale, natural material rendering, clean edges, professional commercial product photography, ${aspect} aspect ratio, high resolution.
Variation seed: ${seed}. Make this image visually distinct from every other image in this batch.

${extra ? `Extra instructions: ${extra}` : ''}

Avoid: warped or melted shapes, extra or missing parts, gibberish text, new logos, watermarks, borders, frames, collage, people's faces, deformed hands, blurry or noisy output, oversaturation, plastic look, floating objects, wrong shadows, cut-off product.`
  return master
}

export const negativePrompt='text, watermark, new logo, extra objects, distorted, deformed, blurry, low quality, cropped product, duplicate product, collage, frame, border, cartoon, illustration'
