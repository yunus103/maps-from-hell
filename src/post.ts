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
  const ao = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
  // Half resolution: ~4x cheaper, the soft AO hides the difference.
  ao.configuration.halfRes = true;
  ao.configuration.depthAwareUpsampling = true;
  ao.setQualityMode('Medium');

  const bloom = new BloomEffect({ mipmapBlur: true });
  const saturation = new HueSaturationEffect();
  const contrast = new BrightnessContrastEffect();
  const vignette = new VignetteEffect({ offset: 0.35 });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(ao);
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
    ao.configuration.intensity = p.aoIntensity;
    ao.configuration.aoRadius = p.aoRadius;
    ao.configuration.distanceFalloff = p.aoRadius * 0.4;
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
