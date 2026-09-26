import { useEffect, useRef, useState } from "react";
import { PlayerList, Panel, PrimaryButton, RoomShell } from "@/components/RoomShell";
import { db, type RoomCtx } from "@/lib/use-room";

export const ABC_CATEGORIES = ["Nama", "Hewan", "Buah/Tanaman", "Kota", "Benda"] as const;
const LETTERS = "ABCDEFGHIJKLMNOPRSTUW";
const ROUND_SECONDS = 60;

type Answers = Record<string, string>;
type AbcState = {
  phase?: "lobby" | "writing" | "scoring" | "results";
  round?: number;
  letter?: string;
  endsAt?: number;
  used?: string[];
  stoppedBy?: string | null;
  results?: Record<string, { answers: Answers; points: Record<string, number>; total: number }>;
  scoredRound?: number;
};

export function scoreAbc(letter: string, entries: { player_id: string; answers: Answers }[]) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const out: NonNullable<AbcState["results"]> = {};
  for (const e of entries) out[e.player_id] = { answers: e.answers, points: {}, total: 0 };
  for (const cat of ABC_CATEGORIES) {
    const valid = entries.map((e) => {
      const v = norm(e.answers[cat] ?? "");
      return v.length >= 2 && v[0] === letter.toLowerCase() ? v : "";
    });
    entries.forEach((e, i) => {
      const v = valid[i] ?? "";
      const dup = v ? valid.filter((x) => x === v).length > 1 : false;
      const pts = !v ? 0 : dup ? 5 : 10;
      const r = out[e.player_id]!;
      r.points[cat] = pts;
      r.total += pts;
    });
  }
  return out;
}

export function AbcRoom({ ctx }: { ctx: RoomCtx }) {
  const { room, players, myId, updateState } = ctx;
  const st: AbcState = room.state ?? {};
  const phase = st.phase ?? "lobby";
  const isHost = room.host_id === myId;
  const inGame = players.some((p) => p.player_id === myId);
  const [answers, setAnswers] = useState<Answers>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRound = useRef(-1);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Reset jawaban saat ronde baru.
  useEffect(() => {
    if (phase === "writing") setAnswers({});
  }, [st.round, phase === "writing"]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const round = st.round ?? 0;
    if (!inGame || submittedRound.current === round) return;
    submittedRound.current = round;
    await db
      .from("room_entries")
      .upsert(
        { room_id: room.id, round, player_id: myId, data: { answers: answersRef.current } },
        { onConflict: "room_id,round,player_id" },
      );
  };

  // Kirim jawaban otomatis ketika ronde dihentikan.
  useEffect(() => {
    if (phase === "scoring") void submit();
  }, [phase, st.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host: hentikan saat waktu habis.
  const timeLeft = Math.max(0, Math.ceil(((st.endsAt ?? 0) - now) / 1000));
  useEffect(() => {
    if (isHost && phase === "writing" && st.endsAt && now > st.endsAt) {
      void updateState({ ...st, phase: "scoring", stoppedBy: null });
    }
  }, [isHost, phase, now]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host: hitung skor beberapa detik setelah ronde berhenti.
  useEffect(() => {
    if (!isHost || phase !== "scoring" || st.scoredRound === st.round) return;
    const t = setTimeout(async () => {
      const { data } = await db
        .from("room_entries")
        .select("player_id,data")
        .eq("room_id", room.id)
        .eq("round", st.round ?? 0);
      const entries = ((data ?? []) as { player_id: string; data: { answers?: Answers } }[]).map((e) => ({
        player_id: e.player_id,
        answers: e.data?.answers ?? {},
      }));
      const results = scoreAbc(st.letter ?? "A", entries);
      for (const p of players) {
        const r = results[p.player_id];
        if (r?.total) await db.from("room_players").update({ score: p.score + r.total }).eq("id", p.id);
      }
      await updateState({ ...st, phase: "results", results, scoredRound: st.round });
    }, 2500);
    return () => clearTimeout(t);
  }, [isHost, phase, st.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRound = async () => {
    const used = st.used ?? [];
    const pool = LETTERS.split("").filter((l) => !used.includes(l));
    const from = pool.length ? pool : LETTERS.split("");
    const letter = from[Math.floor(Math.random() * from.length)] ?? "A";
    await updateState({
      phase: "writing",
      round: (st.round ?? 0) + 1,
      letter,
      endsAt: Date.now() + ROUND_SECONDS * 1000,
      used: [...used, letter],
      stoppedBy: null,
      scoredRound: st.scoredRound,
    });
  };

  const stop = async () => {
    await submit();
    await updateState({ ...st, phase: "scoring", stoppedBy: myId });
  };

  const allFilled = ABC_CATEGORIES.every((c) => (answers[c] ?? "").trim().length >= 2);
  const nameOf = (id?: string | null) => players.find((p) => p.player_id === id)?.name ?? "Waktu";

  return (
    <RoomShell code={room.code} title="ABC Lima Dasar">
      <Panel className="mb-4">
        <PlayerList players={players} myId={myId} highlight={room.host_id} />
      </Panel>

      {phase === "lobby" && (
        <Panel className="text-center">
          <h2 className="text-2xl font-bold">ABC Lima Dasar</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Setiap ronde muncul satu huruf. Isi 5 kategori dengan kata berawalan huruf itu secepatnya. Jawaban
            unik 10 poin, sama dengan pemain lain 5 poin. Yang selesai duluan boleh tekan STOP!
          </p>
          <p className="mt-4 text-sm">Bagikan kode <b className="tracking-[0.3em] text-primary">{room.code}</b> (2–8 pemain).</p>
          {isHost ? (
            <PrimaryButton className="mt-5" onClick={startRound} disabled={players.length < 2}>
              {players.length < 2 ? "Menunggu pemain lain…" : "Mulai ronde 1"}
            </PrimaryButton>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Menunggu host memulai…</p>
          )}
        </Panel>
      )}

      {(phase === "writing" || phase === "scoring") && (
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary font-display text-5xl font-black text-primary-foreground" data-testid="letter">
                {st.letter}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Ronde {st.round}</div>
                <div className="text-lg font-bold">
                  {phase === "writing" ? `Sisa waktu ${timeLeft} detik` : `STOP! oleh ${nameOf(st.stoppedBy)} — menghitung skor…`}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ABC_CATEGORIES.map((c) => (
              <label key={c} className="block">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{c}</span>
                <input
                  aria-label={c}
                  value={answers[c] ?? ""}
                  disabled={phase !== "writing" || !inGame}
                  onChange={(e) => setAnswers((a) => ({ ...a, [c]: e.target.value }))}
                  placeholder={`${st.letter}…`}
                  className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          {phase === "writing" && inGame && (
            <PrimaryButton className="mt-5 w-full bg-destructive text-destructive-foreground" disabled={!allFilled} onClick={stop}>
              {allFilled ? "STOP!" : "Isi semua kategori untuk STOP"}
            </PrimaryButton>
          )}
        </Panel>
      )}

      {phase === "results" && (
        <Panel>
          <h2 className="text-xl font-bold">Hasil ronde {st.round} — huruf {st.letter}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Pemain</th>
                  {ABC_CATEGORIES.map((c) => (
                    <th key={c} className="py-2 pr-3">{c}</th>
                  ))}
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(st.results ?? {}).map(([pid, r]) => (
                  <tr key={pid} className="border-t border-border">
                    <td className="py-2 pr-3 font-semibold">{nameOf(pid)}</td>
                    {ABC_CATEGORIES.map((c) => (
                      <td key={c} className="py-2 pr-3">
                        {r.answers[c] || "—"}{" "}
                        <span className={r.points[c] === 10 ? "text-accent" : r.points[c] ? "text-seed" : "text-muted-foreground"}>
                          +{r.points[c] ?? 0}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 font-bold text-primary">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isHost ? (
            <PrimaryButton className="mt-5" onClick={startRound}>Ronde berikutnya</PrimaryButton>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Menunggu host memulai ronde berikutnya…</p>
          )}
        </Panel>
      )}
    </RoomShell>
  );
}
