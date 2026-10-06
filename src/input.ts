export const inputParams = {
  keySteerSpeed: 5,
  keySteerReturn: 9,
  keyThrottleRise: 0.2, // seconds from 0 to full; lets taps give partial throttle
  padDeadzone: 0.12,
};

// steer: +1 = full left. throttle/brake: 0..1.
export type DriveInput = {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  reset: boolean;
};

const BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const keys = new Set<string>();
let resetQueued = false;
let keySteer = 0;
let keyThrottle = 0;
let padResetHeld = false;

addEventListener('keydown', (e) => {
  if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR' && !e.repeat) resetQueued = true;
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const down = (...codes: string[]) => codes.some((c) => keys.has(c));

function moveTowards(from: number, to: number, maxDelta: number): number {
  return Math.abs(to - from) <= maxDelta ? to : from + Math.sign(to - from) * maxDelta;
}

export function readInput(dt: number): DriveInput {
  const p = inputParams;
  const target = (down('KeyA', 'ArrowLeft') ? 1 : 0) - (down('KeyD', 'ArrowRight') ? 1 : 0);
  // Releasing or reversing the key recentres faster than turning in.
  const returning = target === 0 || Math.sign(target) !== Math.sign(keySteer);
  keySteer = moveTowards(keySteer, target, (returning ? p.keySteerReturn : p.keySteerSpeed) * dt);

  // Release drops instantly; only the rise is ramped.
  keyThrottle = down('KeyW', 'ArrowUp') ? Math.min(keyThrottle + dt / Math.max(p.keyThrottleRise, 1e-3), 1) : 0;

  const input: DriveInput = {
    steer: keySteer,
    throttle: keyThrottle,
    brake: down('KeyS', 'ArrowDown') ? 1 : 0,
    handbrake: down('Space'),
    reset: resetQueued,
  };
  resetQueued = false;

  const pad = navigator.getGamepads().find((g) => g?.connected);
  if (pad) {
    const x = pad.axes[0] ?? 0;
    const stick = Math.abs(x) < p.padDeadzone ? 0 : (Math.sign(x) * (Math.abs(x) - p.padDeadzone)) / (1 - p.padDeadzone);
    if (Math.abs(stick) > Math.abs(input.steer)) input.steer = -stick;
    input.throttle = Math.max(input.throttle, pad.buttons[7]?.value ?? 0);
    input.brake = Math.max(input.brake, pad.buttons[6]?.value ?? 0);
    input.handbrake ||= !!pad.buttons[0]?.pressed;
    const resetHeld = !!pad.buttons[3]?.pressed;
    if (resetHeld && !padResetHeld) input.reset = true;
    padResetHeld = resetHeld;
  }
  return input;
}
