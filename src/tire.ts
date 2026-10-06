// Arcade lateral grip curve: rises linearly to 1 at the peak slip angle,
// then eases down to `slide` over `falloff` radians. Returns a multiplier on mu * load.
export function lateralGrip(slip: number, peak: number, falloff: number, slide: number): number {
  if (slip <= peak) return slip / peak;
  const t = Math.min((slip - peak) / falloff, 1);
  return 1 + (slide - 1) * t * t * (3 - 2 * t);
}
