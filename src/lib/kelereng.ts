// Fisika kelereng sederhana & deterministik — dipakai semua pemain untuk memutar ulang tembakan.
export type Ball = { id: string; x: number; y: number };
export type Shot = { theta: number; angle: number; power: number };

export const ARENA_R = 1;
export const BALL_R = 0.05;
export const MAX_SPEED = 4.2;
export const SHOOTER_DIST = 1.12;

export function initialTargets(): Ball[] {
  const s = 0.13;
  const pts: [number, number][] = [
    [0, 0], [s, 0], [-s, 0], [0, s], [0, -s], [2 * s, 0], [-2 * s, 0], [0, 2 * s], [0, -2 * s],
  ];
  return pts.map(([x, y], i) => ({ id: `t${i}`, x, y }));
}

export const shooterPos = (theta: number) => ({
  x: Math.cos(theta) * SHOOTER_DIST,
  y: Math.sin(theta) * SHOOTER_DIST,
});

type Body = { id: string; x: number; y: number; vx: number; vy: number; alive: boolean; shooter: boolean };

export type SimResult = {
  frames: ({ id: string; x: number; y: number; shooter: boolean }[])[];
  knocked: string[];
  final: Ball[];
};

export function simulate(targets: Ball[], shot: Shot): SimResult {
  const s = shooterPos(shot.theta);
  const speed = Math.max(0, Math.min(1, shot.power)) * MAX_SPEED;
  const bodies: Body[] = [
    { id: "shooter", x: s.x, y: s.y, vx: Math.cos(shot.angle) * speed, vy: Math.sin(shot.angle) * speed, alive: true, shooter: true },
    ...targets.map((t) => ({ id: t.id, x: t.x, y: t.y, vx: 0, vy: 0, alive: true, shooter: false })),
  ];
  const dt = 1 / 120;
  const frames: SimResult["frames"] = [];
  const knocked: string[] = [];

  for (let step = 0; step < 3000; step++) {
    for (const b of bodies) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.988;
      b.vy *= 0.988;
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < BALL_R * 2) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = BALL_R * 2 - d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const k = rel * 0.95;
            a.vx -= k * nx;
            a.vy -= k * ny;
            b.vx += k * nx;
            b.vy += k * ny;
          }
        }
      }
    }
    for (const b of bodies) {
      if (b.alive && !b.shooter && Math.hypot(b.x, b.y) > ARENA_R + BALL_R) {
        b.alive = false;
        knocked.push(b.id);
      }
      if (b.alive && b.shooter && Math.hypot(b.x, b.y) > 1.6) b.alive = false;
    }
    if (step % 2 === 0) {
      frames.push(bodies.filter((b) => b.alive).map((b) => ({ id: b.id, x: b.x, y: b.y, shooter: b.shooter })));
    }
    const moving = bodies.some((b) => b.alive && Math.hypot(b.vx, b.vy) > 0.01);
    if (!moving && step > 10) break;
  }

  const final = bodies
    .filter((b) => b.alive && !b.shooter)
    .map((b) => ({ id: b.id, x: Math.round(b.x * 1e4) / 1e4, y: Math.round(b.y * 1e4) / 1e4 }));
  return { frames, knocked, final };
}
