import * as THREE from 'three';

const DEG = Math.PI / 180;
const SHADOW_EXTENT = 45;
const SHADOW_MAP_SIZE = 2048;
const SUN_DISTANCE = 60; // shadow camera distance from its focus
const SKY_RADIUS = 900; // inside the camera's far plane

// Istanbul summer afternoon: warm white sun, near-neutral shadows with a warm ground bounce,
// clear blue overhead fading into a dusty beige haze at the horizon.
export const lightParams = {
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
};

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

export function createLighting(scene: THREE.Scene) {
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
  return { apply, follow };
}
