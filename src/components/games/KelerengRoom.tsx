import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerList, Panel, PrimaryButton, RoomShell } from "@/components/RoomShell";
import type { RoomCtx } from "@/lib/use-room";
import {
  ARENA_R,
  BALL_R,
  initialTargets,
  shooterPos,
  simulate,
  type Ball,
  type Shot,
} from "@/lib/kelereng";

type KState = {
  phase?: "lobby" | "playing" | "finished";
  order?: string[];
  turn?: number;
  targets?: Ball[];
  shot?: (Shot & { seq: number; by: string; before: Ball[]; knocked: number }) | null;
};

const VIEW = 1.3;

export function KelerengRoom({ ctx }: { ctx: RoomCtx }) {
  const { room, players, myId, updateState, addScore, resetScores } = ctx;
  const st: KState = room.state ?? {};
  const phase = st.phase ?? "lobby";
  const order = st.order ?? [];
  const currentId = order[st.turn ?? 0];
  const myTurn = phase === "playing" && currentId === myId;
  const isHost = room.host_id === myId;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(Math.PI / 2);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [animating, setAnimating] = useState(false);
  const frameRef = useRef<{ id: string; x: number; y: number; shooter: boolean }[] | null>(null);
  const seenSeq = useRef<number | null>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string, f: string) => css.getPropertyValue(v).trim() || f;
    const size = cv.width;
    const toPx = (v: number) => ((v + VIEW) / (2 * VIEW)) * size;
    const scale = size / (2 * VIEW);
    g.clearRect(0, 0, size, size);
    // tanah
    g.fillStyle = col("--wood-deep", "#3b2414");
    g.beginPath();
    g.arc(size / 2, size / 2, (VIEW - 0.02) * scale, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col("--seed", "#e8c07a");
    g.lineWidth = 3;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.arc(size / 2, size / 2, ARENA_R * scale, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);

    const drawBall = (x: number, y: number, shooter: boolean) => {
      const px = toPx(x);
      const py = toPx(y);
      const r = BALL_R * scale * (shooter ? 1.15 : 1);
      const grad = g.createRadialGradient(px - r / 3, py - r / 3, r / 5, px, py, r);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, shooter ? col("--primary", "#e0a030") : col("--jade", "#3aa37a"));
      grad.addColorStop(1, "rgba(0,0,0,0.6)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    };

    const fr = frameRef.current;
    if (fr) {
      fr.forEach((b) => drawBall(b.x, b.y, b.shooter));
    } else {
      (st.targets ?? []).forEach((b) => drawBall(b.x, b.y, false));
      if (myTurn) {
        const s = shooterPos(theta);
        drawBall(s.x, s.y, true);
        if (aim) {
          const dx = s.x - aim.x;
          const dy = s.y - aim.y;
          g.strokeStyle = col("--primary", "#e0a030");
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(toPx(s.x), toPx(s.y));
          g.lineTo(toPx(s.x + dx), toPx(s.y + dy));
          g.stroke();
        }
      }
    }
  }, [st.targets, myTurn, theta, aim]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Putar ulang tembakan terbaru di semua layar.
  useEffect(() => {
    const shot = st.shot;
    if (!shot) return;
    if (seenSeq.current === null) {
      seenSeq.current = shot.seq;
      return;
    }
    if (shot.seq === seenSeq.current) return;
    seenSeq.current = shot.seq;
    const sim = simulate(shot.before, shot);
    let i = 0;
    setAnimating(true);
    let raf = 0;
    const tick = () => {
      frameRef.current = sim.frames[i] ?? null;
      draw();
      i += 1;
      if (i < sim.frames.length) raf = requestAnimationFrame(tick);
      else {
        frameRef.current = null;
        setAnimating(false);
        draw();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [st.shot?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (seenSeq.current === null) seenSeq.current = st.shot?.seq ?? 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 * VIEW - VIEW,
      y: ((e.clientY - r.top) / r.height) * 2 * VIEW - VIEW,
    };
  };

  const fire = async (p: { x: number; y: number }) => {
    const s = shooterPos(theta);
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    const power = Math.min(1, Math.hypot(dx, dy) / 0.9);
    if (power < 0.05) return;
    const shot: Shot = { theta, angle: Math.atan2(dy, dx), power };
    const before = st.targets ?? [];
    const sim = simulate(before, shot);
    const knocked = sim.knocked.length;
    const nextTurn = knocked > 0 ? (st.turn ?? 0) : ((st.turn ?? 0) + 1) % Math.max(order.length, 1);
    await updateState({
      ...st,
      targets: sim.final,
      turn: nextTurn,
      phase: sim.final.length === 0 ? "finished" : "playing",
      shot: { ...shot, seq: (st.shot?.seq ?? 0) + 1, by: myId, before, knocked },
    });
    if (knocked) await addScore(myId, knocked);
  };

  const start = async () => {
    await resetScores();
    await updateState({
      phase: "playing",
      order: players.map((p) => p.player_id),
      turn: 0,
      targets: initialTargets(),
      shot: { theta: 0, angle: 0, power: 0, seq: (st.shot?.seq ?? 0) + 1, by: "", before: [], knocked: 0 },
    });
  };

  const nameOf = (id?: string) => players.find((p) => p.player_id === id)?.name ?? "?";
  const best = [...players].sort((a, b) => b.score - a.score)[0];

  return (
    <RoomShell code={room.code} title="Kelereng">
      <Panel className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PlayerList players={players} myId={myId} highlight={currentId} />
        <div className="text-sm font-semibold" data-testid="status">
          {phase === "lobby"
            ? "Menunggu mulai"
            : phase === "finished"
              ? `Selesai! Juara: ${best?.name ?? "-"}`
              : animating
                ? "Kelereng bergulir…"
                : myTurn
                  ? "Giliran kamu — tarik & lepas!"
                  : `Giliran ${nameOf(currentId)}`}
        </div>
      </Panel>

      {st.shot && st.shot.by && !animating && phase !== "lobby" && (
        <p className="mb-3 text-center text-sm text-muted-foreground">
          {nameOf(st.shot.by)} mengeluarkan {st.shot.knocked} kelereng
          {st.shot.knocked > 0 ? " dan boleh menembak lagi!" : "."}
        </p>
      )}

      <div className="mx-auto w-full max-w-[560px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="aspect-square w-full touch-none rounded-full shadow-2xl"
          onPointerDown={(e) => {
            if (!myTurn || animating) return;
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            setAim(toWorld(e));
          }}
          onPointerMove={(e) => aim && setAim(toWorld(e))}
          onPointerUp={(e) => {
            if (!aim) return;
            const p = toWorld(e);
            setAim(null);
            void fire(p);
          }}
        />
        {myTurn && !animating && (
          <label className="mt-4 block text-sm">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Posisi tembak (geser di tepi lingkaran)
            </span>
            <input
              type="range"
              min={0}
              max={628}
              value={Math.round(theta * 100)}
              onChange={(e) => setTheta(Number(e.target.value) / 100)}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {(phase === "lobby" || phase === "finished") &&
          (isHost ? (
            <PrimaryButton onClick={start} disabled={players.length < 2}>
              {players.length < 2 ? "Menunggu pemain lain…" : phase === "finished" ? "Main lagi" : "Mulai main"}
            </PrimaryButton>
          ) : (
            <span className="text-sm text-muted-foreground">Menunggu host memulai…</span>
          ))}
      </div>

      <details className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-bold text-foreground">Cara main kelereng</summary>
        <p className="mt-3">
          Geser posisi kelereng gacoanmu di tepi lingkaran, lalu tarik ke arah berlawanan dan lepaskan seperti
          ketapel. Setiap kelereng yang keluar lingkaran = 1 poin, dan kamu boleh menembak lagi. Kelereng habis,
          poin terbanyak juara. 2–4 pemain.
        </p>
      </details>
    </RoomShell>
  );
}
