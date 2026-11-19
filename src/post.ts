import * as THREE from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { QUALITY } from './quality';

export const postParams = {
  enabled: true,
  aoIntensity: 2.5,
  aoRadius: 2.5, // metres
  bloomIntensity: 0.4,
  bloomThreshold: 0.9, // only near-white highlights bloom
  saturation: 0.12, // -1..1, AgX mutes colours a little
  contrast: 0.08,
  vignette: 0.3,
};

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  // Mobile: even half-res AO was ~1/3 of the GPU frame at phone resolution; the sun shadows keep enough depth.
  const ao = QUALITY.ao ? new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight) : null;
  if (ao) {
    // Half resolution: ~4x cheaper, the soft AO hides the difference.
    ao.configuration.halfRes = true;
    ao.configuration.depthAwareUpsampling = true;
    ao.setQualityMode('Medium');
    // Auto-detect turns this on for the lamp-glow sprites, which costs two extra full scene renders per frame
    // (and block.ts's facade-tile hook re-shows facades inside them). The sprites don't need AO handling.
    ao.autoDetectTransparency = false;
  }

  const bloom = new BloomEffect({ mipmapBlur: true });
  const saturation = new HueSaturationEffect();
  const contrast = new BrightnessContrastEffect();
  const vignette = new VignetteEffect({ offset: 0.35 });
  composer.addPass(new RenderPass(scene, camera));
  if (ao) composer.addPass(ao);
  composer.addPass(
    new EffectPass(
      camera,
      bloom,
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      saturation,
      contrast,
      vignette,
      new SMAAEffect(),
    ),
  );

  function apply() {
    const p = postParams;
    if (ao) {
      ao.configuration.intensity = p.aoIntensity;
      ao.configuration.aoRadius = p.aoRadius;
      ao.configuration.distanceFalloff = p.aoRadius * 0.4;
    }
    bloom.intensity = p.bloomIntensity;
    bloom.luminanceMaterial.threshold = p.bloomThreshold;
    saturation.saturation = p.saturation;
    contrast.contrast = p.contrast;
    vignette.darkness = p.vignette;
  }

  apply();
  return {
    apply,
    // Without post the renderer tone-maps on its own; render targets skip that, so the two never double up.
    render(dt: number) {
      if (postParams.enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h);
    },
  };
}
