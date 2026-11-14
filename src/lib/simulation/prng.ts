/**
 * Deterministic pseudo-random generator (mulberry32).
 * The whole simulation derives from fixed seeds, so the server render,
 * the client render and every reload start from identical state.
 */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  normal(): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  let spare: number | null = null;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Box–Muller with cached spare.
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };

  return {
    next,
    normal,
    range: (min, max) => min + (max - min) * next(),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
