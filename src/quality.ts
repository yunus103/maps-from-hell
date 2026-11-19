// A mid-range phone GPU is roughly 10-20x slower than a desktop one and its fill cost grows with DPR², so
// touch (coarse-pointer) devices get a lighter tier; desktop keeps the full one. ?mobile forces it for testing.
export const MOBILE = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile');

export const QUALITY = MOBILE
  ? // Measured at 844×390: 16 lamp lights and N8AO were the two big per-pixel costs after resolution.
    { pixelRatios: [1.5, 1.25, 1], lampLights: 4, shadowMapSize: 1024, ao: false }
  : { pixelRatios: [2], lampLights: 16, shadowMapSize: 2048, ao: true };
