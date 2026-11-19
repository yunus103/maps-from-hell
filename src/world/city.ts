import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { City, CityEvent, RoadGraph } from '../game/types';
import { worldMaterial } from '../palette';
import { createAgentMaterial } from './agentMesh';
import { createParked } from './parked';
import { createTraffic } from './traffic';
import { createPedestrians } from './pedestrians';
import { createBirds } from './birds';
import { buildStreetProps } from './streetProps';

// The ambient city: parked cars, traffic, pedestrians, pigeons and street props. Agent counts come from the
// QUALITY tier; every agent kind is one InstancedMesh (7 draw calls in all, props included).
export function createCity(scene: THREE.Scene, world: RAPIER.World, graph: RoadGraph): City {
  const material = createAgentMaterial();
  const parked = createParked(scene, world, graph, material);
  const traffic = createTraffic(scene, world, graph, material, parked);
  const peds = createPedestrians(scene, graph, material);
  const birds = createBirds(scene, graph, material);
  buildStreetProps(scene, world, graph);
  const events: CityEvent[] = []; // reused every frame: read it before the next update

  return {
    update(dt, car, live) {
      // Headlights glow with the street lamps (the lighting preset drives worldMaterial).
      material.emissiveIntensity = worldMaterial.emissiveIntensity;
      events.length = 0;
      traffic.update(dt, car, live, events);
      peds.update(dt, car, live, events);
      birds.update(dt, car, live);
      return events;
    },
    setDensity: traffic.setDensity,
    reset(x, z) {
      traffic.reset(x, z);
      peds.reset(x, z);
      birds.reset();
    },
  };
}
