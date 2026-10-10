import * as THREE from 'three';

// One palette texture, one material for the whole world (GAME_DESIGN §15.2): every surface samples
// a single texel of this texture, so code-built geometry and imported models share one look.
export const PALETTE = {
  asphalt: 0x504d4b,
  sidewalk: 0xbcb3a3,
  curb: 0xd9d3c7,
  line: 0xece6d6,
  plinth: 0x8e867a,
  roof: 0x9a948b,
  glass: 0x4d606b, // blue-grey: reads as glass catching the sky, not a black hole
  curtain: 0xb9b4a6,
  // Same look by day; these glow at night (see GLOW).
  glassLit: 0x4d606b,
  curtainLit: 0xb9b4a6,
  frame: 0xf2efe8,
  trim: 0xebe4d6,
  metal: 0x3b3d40,
  door: 0x5b3f2c,
  shutter: 0xd8d1c2,
  shopFrame: 0x6f7377,
  ahsap: 0x8a5f3c, // painted timber: old-house frames and shutters
  kiremitCati: 0xb5583a, // terracotta roof tiles
  acUnit: 0xe6e2d8,
  solar: 0x2c4363, // solar water-heater panels
  concrete: 0xb9b5ad,
  lamp: 0xf2ead2, // street-lamp lens; lit at night
  white: 0xf3f0ea,
  // Apartment facades: sun-faded pastels and earth tones.
  krem: 0xe8dcc2,
  okra: 0xdaa962,
  kiremit: 0xc8785a,
  pembe: 0xe4b9a9,
  yesil: 0xb7c49f,
  griMavi: 0xaebcc6,
  kirliBeyaz: 0xe2dccf,
  sari: 0xe6c977,
  seftali: 0xe9b88f,
  kahve: 0xc9ab8c,
  // Shop awnings and sign bands.
  red: 0xb83a30,
  green: 0x2f7d4f,
  blue: 0x2f62a0,
  yellow: 0xe2b231,
  orange: 0xd9702e,
};

export type Swatch = keyof typeof PALETTE;

export const FACADES: Swatch[] = ['krem', 'okra', 'kiremit', 'pembe', 'yesil', 'griMavi', 'kirliBeyaz', 'sari', 'seftali', 'kahve'];
export const AWNINGS: Swatch[] = ['red', 'green', 'blue', 'yellow', 'orange'];

const SIZE = 8; // texels per side; room for 64 swatches
const names = Object.keys(PALETTE) as Swatch[];
const index = new Map(names.map((n, i) => [n, i]));

// UV at the centre of the swatch's texel.
export function swatchUV(s: Swatch): [number, number] {
  const i = index.get(s)!;
  return [((i % SIZE) + 0.5) / SIZE, (Math.floor(i / SIZE) + 0.5) / SIZE];
}

// Emissive colour per swatch, scaled at runtime by the lighting preset's glow. Everything else stays dark.
const GLOW: Partial<Record<Swatch, number>> = {
  lamp: 0xfff0c8,
  glassLit: 0xb87a40, // warm interior light behind glass
  curtainLit: 0xd09858, // light through a curtain
};

function paletteTexture(colors: (s: Swatch) => number): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  // Raw sRGB bytes; the texture's colour space converts them to linear.
  names.forEach((n, i) => {
    const c = colors(n);
    data.set([c >> 16, (c >> 8) & 0xff, c & 0xff, 255], i * 4);
  });
  const tex = new THREE.DataTexture(data, SIZE, SIZE);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Nearest + no mipmaps: each face shows exactly its texel, no bleeding from neighbours.
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const worldMaterial = new THREE.MeshStandardMaterial({
  map: paletteTexture((s) => PALETTE[s]),
  emissiveMap: paletteTexture((s) => GLOW[s] ?? 0),
  emissive: 0xffffff,
  emissiveIntensity: 0, // set by the lighting preset
  roughness: 0.9,
});
