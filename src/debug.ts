import type { WebGLRenderer } from 'three';

const UPDATE_INTERVAL = 0.25;

export function createDebugOverlay(renderer: WebGLRenderer) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:8px;left:8px;padding:6px 8px;background:rgba(0,0,0,.6);' +
    'color:#9f9;font:12px/1.4 monospace;white-space:pre;pointer-events:none;z-index:10';
  document.body.appendChild(el);

  let frames = 0;
  let elapsed = 0;

  // Call once per frame, after rendering, so renderer.info holds this frame's stats.
  return function update(dt: number, extra: string) {
    frames++;
    elapsed += dt;
    if (elapsed < UPDATE_INTERVAL) return;
    const { calls, triangles } = renderer.info.render;
    el.textContent =
      `FPS   ${Math.round(frames / elapsed)}\n` +
      `calls ${calls}\n` +
      `tris  ${triangles.toLocaleString()}\n` +
      extra;
    frames = 0;
    elapsed = 0;
  };
}
