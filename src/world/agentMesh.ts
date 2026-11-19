import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBuilder } from '../meshBuilder';
import { worldMaterial } from '../palette';
import { QUALITY } from '../quality';

// Shared bits of the ambient agents: low-poly geometry in the world palette, one material, collision groups.
// Every agent kind is a single InstancedMesh, so the whole city costs a handful of draw calls.

// Membership bit 2: the player car collides with agents, the chase camera's shape-cast (bit 0 only) ignores them.
export const AGENT_GROUPS = 0x0004ffff;

export const SEDAN = { L: 4.4, W: 1.8, halfL: 2.2, halfW: 0.92, halfH: 0.7 }; // collider halves (plan values)
export const DOLMUS = { L: 5.4, W: 2.0, halfL: 2.7, halfW: 1.0, halfH: 1.1 };

const m = new THREE.Matrix4();

// Two builders: `fixed` parts keep their swatch, `paint` parts (swatch 'white') get tinted by the instance colour.
function agentGeometry(draw: (fixed: MeshBuilder, paint: MeshBuilder) => void): THREE.BufferGeometry {
  const fixed = new MeshBuilder();
  const paint = new MeshBuilder();
  draw(fixed, paint);
  const parts = [fixed.build(), paint.build()].map((g, i) => {
    g.setAttribute('paint', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1));
    return g;
  });
  return mergeGeometries(parts.filter((g) => g.attributes.position.count > 0))!;
}

// worldMaterial's look (palette texture, night glow on 'lamp' texels) with the instance colour applied only to
// vertices whose `paint` attribute is 1, so glass, tyres and lights keep their colour on a red car.
// Its emissiveIntensity must follow worldMaterial's (city.ts copies it each frame).
export function createAgentMaterial(): THREE.MeshStandardMaterial {
  const mat = worldMaterial.clone();
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float paint;').replace(
      '#include <color_vertex>',
      // Replaces three's color_vertex chunk (r186; agents use no vertex colours or batching).
      `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
  vColor = vec4( 1.0 );
#endif
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, paint );
#endif`,
    );
  };
  return mat;
}

export function createInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadows: boolean): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1));
  mesh.count = count;
  // Instances move all over the map; bounds would be stale and culling saves nothing at this scale.
  mesh.frustumCulled = false;
  mesh.castShadow = shadows && QUALITY.agentShadows;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

const wheels = (b: MeshBuilder, halfW: number, z: number[], r: number) => {
  for (const x of [-halfW + 0.12, halfW - 0.12]) for (const zz of z) b.boxWorld(x - 0.13, x + 0.13, 0, 2 * r, zz - r, zz + r, 'metal');
};

// Sedan facing +Z, origin on the ground under its centre. `lights`: headlight lenses glow at night (traffic);
// parked cars get plain white lenses.
export function sedanGeometry(lights: boolean): THREE.BufferGeometry {
  const { L, W } = SEDAN;
  const [hl, hw] = [L / 2, W / 2];
  return agentGeometry((f, p) => {
    wheels(f, hw, [-1.35, 1.35], 0.33);
    p.boxWorld(-hw, hw, 0.3, 0.86, -hl, hl, 'white'); // lower body
    p.boxWorld(-hw + 0.04, hw - 0.04, 0.86, 0.95, -1.2, 0.95, 'white'); // waist under the glass
    f.boxWorld(-hw + 0.1, hw - 0.1, 0.95, 1.32, -1.15, 0.85, 'glass');
    p.boxWorld(-hw + 0.14, hw - 0.14, 1.32, 1.42, -1.05, 0.75, 'white'); // roof
    f.boxWorld(-hw - 0.02, hw + 0.02, 0.28, 0.42, hl - 0.05, hl + 0.06, 'metal'); // bumpers
    f.boxWorld(-hw - 0.02, hw + 0.02, 0.28, 0.42, -hl - 0.06, -hl + 0.05, 'metal');
    for (const x of [-hw + 0.3, hw - 0.3]) {
      f.boxWorld(x - 0.2, x + 0.2, 0.58, 0.72, hl - 0.02, hl + 0.03, lights ? 'lamp' : 'white');
      f.boxWorld(x - 0.2, x + 0.2, 0.62, 0.74, -hl - 0.03, -hl + 0.02, 'red');
    }
  });
}

// Yellow Istanbul dolmuş (minibus), 5.4 m, facing +Z.
export function dolmusGeometry(): THREE.BufferGeometry {
  const { L, W } = DOLMUS;
  const [hl, hw] = [L / 2, W / 2];
  return agentGeometry((f) => {
    wheels(f, hw, [-1.75, 1.8], 0.36);
    f.boxWorld(-hw, hw, 0.35, 1.3, -hl, hl - 0.75, 'yellow'); // body
    f.boxWorld(-hw + 0.05, hw - 0.05, 0.35, 1.1, hl - 0.75, hl, 'yellow'); // nose
    f.boxWorld(-hw + 0.08, hw - 0.08, 1.1, 1.85, hl - 1.15, hl - 0.6, 'glass'); // windscreen
    f.boxWorld(-hw - 0.01, hw + 0.01, 1.3, 1.9, -hl + 0.15, hl - 1.15, 'glass'); // side windows
    f.boxWorld(-hw, hw, 1.9, 2.25, -hl, hl - 0.6, 'yellow'); // roof
    f.boxWorld(-hw - 0.02, hw + 0.02, 1.0, 1.12, -hl, hl - 0.75, 'blue'); // stripe
    f.boxWorld(-0.45, 0.45, 2.25, 2.5, 0.4, 0.6, 'white'); // roof board
    f.boxWorld(-hw - 0.02, hw + 0.02, 0.3, 0.45, hl - 0.05, hl + 0.06, 'metal');
    f.boxWorld(-hw - 0.02, hw + 0.02, 0.3, 0.45, -hl - 0.06, -hl + 0.05, 'metal');
    for (const x of [-hw + 0.32, hw - 0.32]) {
      f.boxWorld(x - 0.2, x + 0.2, 0.7, 0.86, hl - 0.02, hl + 0.03, 'lamp');
      f.boxWorld(x - 0.12, x + 0.12, 0.7, 1.0, -hl - 0.03, -hl + 0.02, 'red');
    }
  });
}

// Pedestrian body (legs + torso + arms) facing +Z, feet at y = 0. Shirt and arms are paint.
export const PED_NECK = 1.42;
export function pedBodyGeometry(): THREE.BufferGeometry {
  return agentGeometry((f, p) => {
    for (const x of [-0.1, 0.1]) {
      f.boxWorld(x - 0.08, x + 0.08, 0.06, 0.82, -0.09, 0.09, 'griMavi'); // jeans
      f.boxWorld(x - 0.09, x + 0.09, 0, 0.07, -0.1, 0.14, 'metal'); // shoes
    }
    p.boxWorld(-0.22, 0.22, 0.8, 1.4, -0.13, 0.13, 'white');
    for (const x of [-0.29, 0.29]) p.boxWorld(x - 0.06, x + 0.06, 0.86, 1.38, -0.07, 0.07, 'white');
  });
}

// Head with hair, neck at the origin. Skin is paint (tinted per instance).
export function pedHeadGeometry(): THREE.BufferGeometry {
  return agentGeometry((f, p) => {
    p.boxWorld(-0.11, 0.11, 0.02, 0.27, -0.12, 0.12, 'white');
    f.boxWorld(-0.12, 0.12, 0.22, 0.3, -0.13, 0.11, 'door');
  });
}

// Pigeon facing +Z, feet at y = 0. Wings angle up from the back, so scaling the instance's X folds them
// (flapping) without a separate wing mesh.
export function pigeonGeometry(): THREE.BufferGeometry {
  return agentGeometry((f) => {
    f.boxWorld(-0.09, 0.09, 0.05, 0.19, -0.15, 0.13, 'roof');
    f.boxWorld(-0.05, 0.05, 0.17, 0.27, 0.1, 0.2, 'plinth');
    f.boxWorld(-0.015, 0.015, 0.2, 0.22, 0.2, 0.24, 'okra'); // beak
    f.boxWorld(-0.04, 0.04, 0.12, 0.15, -0.25, -0.14, 'plinth'); // tail
    for (const s of [-1, 1]) {
      m.makeRotationZ(s * 0.5).premultiply(new THREE.Matrix4().makeTranslation(s * 0.19, 0.22, -0.02));
      f.box(m, 0.22, 0.012, 0.2, 'griMavi');
    }
  });
}
