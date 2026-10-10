import * as THREE from 'three';
import { worldMaterial } from './palette';

const DEG = Math.PI / 180;
const SHADOW_EXTENT = 45;
const SHADOW_MAP_SIZE = 2048;
const SUN_DISTANCE = 60; // shadow camera distance from its focus
const SKY_RADIUS = 900; // inside the camera's far plane

const LAMP_COLOR = 0xffd59a;
const LAMP_RANGE = 30;
const LAMP_CONE = 1.15; // radians: lights the road and sidewalks, not the upper floors
const HEADLIGHT = { color: 0xfff2d8, range: 45, angle: 0.45, penumbra: 0.6, y: 0.75, z: 2.3, aim: 14 };
// Soft light hovering above and behind the car so it never turns into a black hole at night (a game cheat, not a real light).
const CAR_FILL = { color: 0xdfe6ff, range: 9, y: 3.2, z: -3 };

const DAY = {
  // Istanbul summer afternoon: warm white sun, near-neutral shadows with a warm ground bounce,
  // clear blue overhead fading into a dusty beige haze at the horizon.
  sunElevation: 35, // degrees
  sunAzimuth: 225, // degrees, 0 = +Z
  sunColor: 0xfff1d8,
  sunIntensity: 2.5,
  skyTop: 0x5f9cd4,
  skyHorizon: 0xe6dcc8,
  hemiSky: 0xcddff0,
  hemiGround: 0x9c8466,
  hemiIntensity: 1.1,
  fogNear: 60,
  fogFar: 280,
  glow: 0, // lit windows and lamp lenses
  lampIntensity: 0, // street-lamp lights
  headlights: 0,
  carFill: 0,
};

export const PRESETS: Record<string, typeof DAY> = {
  day: DAY,
  // Low orange sun raking the streets against cool blue shade, so the warm light reads instead of
  // turning the whole frame orange.
  sunset: {
    sunElevation: 8,
    sunAzimuth: 250,
    sunColor: 0xffb877,
    sunIntensity: 2.7,
    skyTop: 0x4a76b0,
    skyHorizon: 0xf0bf96,
    hemiSky: 0xa9b8d2,
    hemiGround: 0x6a5242,
    hemiIntensity: 1.0,
    fogNear: 70,
    fogFar: 340,
    glow: 1.2,
    lampIntensity: 40,
    headlights: 30,
    carFill: 1.5,
  },
  // Blue moonlit night against warm lamps and windows: the cool/warm contrast carries the scene.
  night: {
    sunElevation: 45,
    sunAzimuth: 140,
    sunColor: 0x8fa8d8,
    sunIntensity: 0.5,
    skyTop: 0x0b1628,
    skyHorizon: 0x24304a,
    hemiSky: 0x3d5584,
    hemiGround: 0x2a2520,
    hemiIntensity: 0.8,
    fogNear: 40,
    fogFar: 240,
    glow: 3,
    lampIntensity: 150,
    headlights: 150,
    carFill: 8,
  },
};

export const lightParams = { ...DAY };

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 top, horizon, sunColor, sunDir;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      // Haze hugs the horizon, then clears quickly overhead.
      vec3 c = mix(horizon, top, smoothstep(0.0, 0.45, d.y));
      float s = max(dot(d, sunDir), 0.0);
      c += sunColor * (smoothstep(0.9994, 0.9997, s) * 2.0 + pow(s, 24.0) * 0.25);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});

// `lamps` are street-lamp lens positions; `car` carries the headlight.
export function createLighting(scene: THREE.Scene, lamps: THREE.Vector3[], car: THREE.Object3D) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xffffff);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_EXTENT,
    right: SHADOW_EXTENT,
    top: SHADOW_EXTENT,
    bottom: -SHADOW_EXTENT,
    near: 1,
    far: SUN_DISTANCE + SHADOW_EXTENT * 2,
  });
  scene.add(hemi, sun, sun.target);

  // Lights exist in every preset (intensity 0 by day) so switching never changes the light count,
  // which would recompile every shader.
  const lampLights = lamps.map((p) => {
    const l = new THREE.SpotLight(LAMP_COLOR, 0, LAMP_RANGE, LAMP_CONE, 0.8, 1.6);
    l.position.copy(p).setY(p.y - 0.1);
    l.target.position.copy(p).setY(0);
    scene.add(l, l.target);
    return l;
  });
  const h = HEADLIGHT;
  const headlight = new THREE.SpotLight(h.color, 0, h.range, h.angle, h.penumbra, 1.2);
  headlight.position.set(0, h.y, h.z);
  headlight.target.position.set(0, 0, h.aim);
  car.add(headlight, headlight.target);
  const fill = new THREE.PointLight(CAR_FILL.color, 0, CAR_FILL.range, 2);
  fill.position.set(0, CAR_FILL.y, CAR_FILL.z);
  car.add(fill);

  const sunDir = new THREE.Vector3();
  const sunRotation = new THREE.Matrix4();
  const sunRotationInv = new THREE.Matrix4();
  const shadowTexel = (SHADOW_EXTENT * 2) / SHADOW_MAP_SIZE;
  const focus = new THREE.Vector3();

  function apply() {
    const p = lightParams;
    const el = p.sunElevation * DEG;
    const az = p.sunAzimuth * DEG;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sunRotation.lookAt(sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    sunRotationInv.copy(sunRotation).transpose();

    sun.color.set(p.sunColor);
    sun.intensity = p.sunIntensity;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemiIntensity;

    const u = skyMaterial.uniforms;
    u.top.value.set(p.skyTop);
    u.horizon.value.set(p.skyHorizon);
    u.sunColor.value.set(p.sunColor);
    u.sunDir.value.copy(sunDir);

    const fog = scene.fog as THREE.Fog;
    fog.color.set(p.skyHorizon);
    fog.near = p.fogNear;
    fog.far = p.fogFar;

    worldMaterial.emissiveIntensity = p.glow;
    for (const l of lampLights) l.intensity = p.lampIntensity;
    headlight.intensity = p.headlights;
    fill.intensity = p.carFill;
  }

  function setPreset(name: string) {
    Object.assign(lightParams, PRESETS[name]);
    apply();
  }

  // The shadow box follows the target in whole shadow-map texels; sub-texel moves make shadow edges crawl.
  function follow(target: THREE.Vector3, camera: THREE.Camera) {
    focus.copy(target).applyMatrix4(sunRotationInv);
    focus.x = Math.round(focus.x / shadowTexel) * shadowTexel;
    focus.y = Math.round(focus.y / shadowTexel) * shadowTexel;
    focus.applyMatrix4(sunRotation);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, SUN_DISTANCE);
    sky.position.copy(camera.position);
  }

  apply();
  return { apply, follow, setPreset };
}
