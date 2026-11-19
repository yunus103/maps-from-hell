import * as THREE from 'three';
import type { Markers, Place, TargetKind } from './types';

const BEAM_RADIUS = 1.2;
const CORE_RADIUS = 0.35;
const BEAM_HEIGHT = 60;
const BEAM_OPACITY = 0.35;
const CORE_OPACITY = 0.6;
const RING_INNER = 4.9;
const RING_OUTER = 5.5; // ≈ shift ZONE_RADIUS
const RING_OPACITY = 0.85;
const FILL_OPACITY = 0.18;
const RING_Y = 0.06;
const PULSE_SPEED = 3; // rad/s
const PULSE_AMOUNT = 0.25;
// Up close the beam covers a big part of the screen: fade it as the camera gets near.
const BEAM_FADE_NEAR = 8; // m
const BEAM_FADE_FAR = 22;
const BEAM_MIN_FADE = 0.12;
const COLORS: Record<TargetKind, number> = { pickup: 0xd9702e, dropoff: 0x2f7d4f };

export function createMarkers(scene: THREE.Scene, camera: THREE.Camera): Markers {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const additive = (opacity: number) =>
    new THREE.MeshBasicMaterial({
      transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      side: THREE.DoubleSide,
    });
  const beamMat = additive(BEAM_OPACITY);
  const coreMat = additive(CORE_OPACITY);
  // The ring and fill use normal blending so they stay readable on bright daytime asphalt, where additive washes out.
  const flat = (opacity: number) =>
    new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const ringMat = flat(RING_OPACITY);
  const fillMat = flat(FILL_OPACITY);
  const mats = [beamMat, coreMat, ringMat, fillMat];

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, BEAM_HEIGHT, 24, 1, true), beamMat);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, BEAM_HEIGHT, 12, 1, true), coreMat);
  beam.position.y = core.position.y = BEAM_HEIGHT / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_INNER, RING_OUTER, 48), ringMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(RING_INNER, 48), fillMat);
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  ring.position.y = fill.position.y = RING_Y;
  for (const m of [beam, core, ring, fill]) {
    m.renderOrder = 3;
    m.frustumCulled = false;
    group.add(m);
  }
  let time = 0;

  function set(place: Place | null, kind: TargetKind | null) {
    if (!place || !kind) {
      group.visible = false;
      return;
    }
    group.position.set(place.x, 0, place.z);
    for (const m of mats) m.color.setHex(COLORS[kind]);
    group.visible = true;
  }

  function update(dt: number) {
    if (!group.visible) return;
    time += dt;
    const pulse = 1 + PULSE_AMOUNT * Math.sin(time * PULSE_SPEED);
    const d = Math.hypot(camera.position.x - group.position.x, camera.position.z - group.position.z);
    const fade = Math.min(1, Math.max(BEAM_MIN_FADE, (d - BEAM_FADE_NEAR) / (BEAM_FADE_FAR - BEAM_FADE_NEAR)));
    beamMat.opacity = BEAM_OPACITY * pulse * fade;
    coreMat.opacity = CORE_OPACITY * pulse * fade;
    ring.scale.setScalar(1 + 0.04 * Math.sin(time * PULSE_SPEED));
  }

  return { set, update };
}
