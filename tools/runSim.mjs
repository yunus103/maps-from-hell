// Runs tools/driftSim.ts through Vite's SSR loader so it can import the game's TS modules as-is.
// Usage: node tools/runSim.mjs ['{"carParamOverride": 1}']
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const sim = await server.ssrLoadModule('/tools/driftSim.ts');
  await sim.run(process.argv[2] ? JSON.parse(process.argv[2]) : {});
} finally {
  await server.close();
}
