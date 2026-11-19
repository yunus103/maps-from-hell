import * as THREE from 'three';
import { CURB_H } from '../world/district';

// A passenger waiting on the sidewalk at the pickup, waving. Only one exists at a time.
const WAVE_SPEED = 7; // rad/s
const WAVE_LEAN = 0.35; // rad outward from straight up
const WAVE_ANGLE = 0.4; // rad either side of the lean
const BOB = 0.04; // m

export interface PassengerFigure {
  show(x: number, z: number, yaw: number, color: number): void; // yaw: facing direction (0 = +Z)
  hide(): void;
  update(dt: number): void;
}

export function createPassengerFigure(scene: THREE.Scene): PassengerFigure {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const clothes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.7 });

  const body = new THREE.Group(); // bobs; feet stay on the curb
  group.add(body);
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(0.42, 0.8, 0.26), dark, 0.4); // legs
  part(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 10), clothes, 1.16); // torso
  part(new THREE.SphereGeometry(0.19, 12, 10), skin, 1.72); // head
  part(new THREE.BoxGeometry(0.11, 0.6, 0.11), clothes, 1.15).position.x = 0.31; // resting arm

  // Waving arm pivots at the shoulder.
  const shoulder = new THREE.Group();
  shoulder.position.set(-0.3, 1.45, 0);
  body.add(shoulder);
  part(new THREE.BoxGeometry(0.11, 0.6, 0.11), clothes, 0.3, shoulder);
  part(new THREE.SphereGeometry(0.075, 8, 6), skin, 0.62, shoulder);

  let time = 0;

  return {
    show(x, z, yaw, color) {
      group.position.set(x, CURB_H, z);
      group.rotation.y = yaw;
      clothes.color.setHex(color);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update(dt) {
      if (!group.visible) return;
      time += dt;
      // The arm points up at rotation 0; +z leans it outward (it hangs on the -x side).
      shoulder.rotation.z = WAVE_LEAN + WAVE_ANGLE * Math.sin(time * WAVE_SPEED);
      body.position.y = BOB * Math.abs(Math.sin(time * WAVE_SPEED * 0.5));
    },
  };
}
