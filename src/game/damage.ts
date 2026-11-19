import * as THREE from 'three';
import type { Damage } from './types';

const DAMAGE_MIN_IMPACT = 6; // m/s Δv; drift wall taps (2–5) are free
const DAMAGE_PER_MS = 1.6; // health points per m/s above the threshold
const DAMAGE_COOLDOWN = 0.25; // s
const POOL = 24;
// Car-local, above the hood surface (body top is y ≈ 1.06): puffs spawned inside the body stayed hidden.
const HOOD = new THREE.Vector3(0, 1.35, 1.5);
const SMOKE_LIGHT_BELOW = 50; // health
const SMOKE_DARK_BELOW = 25;
const PUFF_INTERVAL_LIGHT = 0.12; // s
const PUFF_INTERVAL_DARK = 0.05;
const PUFF_LIFE = 1.6; // s
const PUFF_RISE = 1.8; // m/s
const PUFF_SIZE_START = 0.9; // m
const PUFF_SIZE_END = 4;
const PUFF_OPACITY = 0.9;
const HIT_BURST = 8; // puffs on a damaging hit
const COLOR_LIGHT = 0xe6e3de;
const COLOR_DARK = 0x3d3936;
const COLOR_DUST = 0xa59d92;
// Visual-only popped hood (no physics): hinged at the windscreen, lifts more as health drops.
const HOOD_PIVOT = new THREE.Vector3(0, 1.07, 0.9);
const HOOD_SIZE = { w: 1.6, h: 0.04, d: 1.3 };
const HOOD_POP_BELOW = 50; // health
const HOOD_ANGLE_MIN = 0.2; // rad at HOOD_POP_BELOW
const HOOD_ANGLE_MAX = 0.55; // rad at 0 health
const SOOT_BELOW = 25;

interface Puff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  age: number;
  vx: number;
  vy: number;
  vz: number;
}

function softDot(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The hood shares the car's paint material, which uses vertex colours as brightness.
function makeHood(paint: THREE.Material): { pivot: THREE.Group; soot: THREE.Mesh } {
  const geo = new THREE.BoxGeometry(HOOD_SIZE.w, HOOD_SIZE.h, HOOD_SIZE.d).translate(0, HOOD_SIZE.h / 2, HOOD_SIZE.d / 2);
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.85), 3));
  const hood = new THREE.Mesh(geo, paint);
  hood.castShadow = true;
  const soot = new THREE.Mesh(
    new THREE.PlaneGeometry(HOOD_SIZE.w * 0.8, HOOD_SIZE.d * 0.7),
    new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  soot.rotation.x = -Math.PI / 2;
  soot.position.set(0, HOOD_SIZE.h + 0.005, HOOD_SIZE.d * 0.55);
  hood.add(soot);
  const pivot = new THREE.Group();
  pivot.position.copy(HOOD_PIVOT);
  pivot.add(hood);
  pivot.visible = false;
  return { pivot, soot };
}

export function createDamage(scene: THREE.Scene, car: THREE.Object3D, paint: THREE.Material): Damage {
  const hoodPart = makeHood(paint);
  car.add(hoodPart.pivot);
  const tex = softDot();
  const puffs: Puff[] = [];
  for (let i = 0; i < POOL; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 2;
    scene.add(sprite);
    puffs.push({ sprite, mat, age: PUFF_LIFE, vx: 0, vy: 0, vz: 0 });
  }
  let next = 0;
  let cooldown = 0;
  let emitTimer = 0;
  const hood = new THREE.Vector3();

  function emit(color: number, spread: number) {
    const p = puffs[next];
    next = (next + 1) % POOL;
    hood.copy(HOOD);
    car.localToWorld(hood);
    p.sprite.position.copy(hood);
    p.mat.color.setHex(color);
    p.age = 0;
    p.vx = (Math.random() - 0.5) * spread;
    p.vy = PUFF_RISE * (0.8 + Math.random() * 0.4);
    p.vz = (Math.random() - 0.5) * spread;
    p.sprite.visible = true;
  }

  function update(dt: number, impact: number, health: number): number {
    cooldown -= dt;
    let lost = 0;
    if (impact >= DAMAGE_MIN_IMPACT && cooldown <= 0) {
      lost = (impact - DAMAGE_MIN_IMPACT) * DAMAGE_PER_MS;
      cooldown = DAMAGE_COOLDOWN;
      for (let i = 0; i < HIT_BURST; i++) emit(COLOR_DUST, 3);
    }

    const h = health - lost;
    hoodPart.pivot.visible = h < HOOD_POP_BELOW;
    if (hoodPart.pivot.visible) {
      const k = 1 - Math.max(0, h) / HOOD_POP_BELOW;
      hoodPart.pivot.rotation.x = -(HOOD_ANGLE_MIN + (HOOD_ANGLE_MAX - HOOD_ANGLE_MIN) * k);
      hoodPart.soot.visible = h < SOOT_BELOW;
    }
    if (h < SMOKE_LIGHT_BELOW) {
      const dark = h < SMOKE_DARK_BELOW;
      emitTimer -= dt;
      if (emitTimer <= 0) {
        emitTimer = dark ? PUFF_INTERVAL_DARK : PUFF_INTERVAL_LIGHT;
        emit(dark ? COLOR_DARK : COLOR_LIGHT, 0.6);
      }
    }

    for (const p of puffs) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= PUFF_LIFE) {
        p.sprite.visible = false;
        continue;
      }
      const k = p.age / PUFF_LIFE;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.scale.setScalar(PUFF_SIZE_START + (PUFF_SIZE_END - PUFF_SIZE_START) * k);
      p.mat.opacity = PUFF_OPACITY * (1 - k * k); // stays dense for most of its life
    }
    return lost;
  }

  function reset() {
    cooldown = 0;
    hoodPart.pivot.visible = false;
    emitTimer = 0;
    for (const p of puffs) {
      p.age = PUFF_LIFE;
      p.sprite.visible = false;
    }
  }

  return { update, reset };
}
