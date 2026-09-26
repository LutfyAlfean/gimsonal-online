import { PlayerList, Panel, PrimaryButton, RoomShell } from "@/components/RoomShell";
import { db, type RoomCtx } from "@/lib/use-room";

type Hand = "kiri" | "kanan";
type CState = {
  phase?: "lobby" | "hide" | "guess" | "reveal";
  round?: number;
  seeker?: string;
  holder?: string;
  hand?: Hand | null;
  guess?: { player: string; hand: Hand } | null;
  outcome?: "tepat" | "hampir" | "meleset" | null;
};

const LYRIC = "Cublak-cublak suweng, suwenge ting gelenter, mambu ketundhung gudel…";

export function CublakRoom({ ctx }: { ctx: RoomCtx }) {
  const { room, players, myId, updateState, resetScores } = ctx;
  const st: CState = room.state ?? {};
  const phase = st.phase ?? "lobby";
  const isHost = room.host_id === myId;
  const nameOf = (id?: string | null) => players.find((p) => p.player_id === id)?.name ?? "?";
  const iAmSeeker = st.seeker === myId;
  const iAmHolder = st.holder === myId;

  const newRound = async (round: number) => {
    const ids = players.map((p) => p.player_id);
    const seeker = ids[round % ids.length]!;
    const others = ids.filter((i) => i !== seeker);
    const holder = others[Math.floor(Math.random() * others.length)]!;
    await updateState({ phase: "hide", round, seeker, holder, hand: null, guess: null, outcome: null });
  };

  const start = async () => {
    await resetScores();
    await newRound(0);
  };

  const hide = (hand: Hand) => updateState({ ...st, phase: "guess", hand });

  const guess = async (player: string, hand: Hand) => {
    const outcome = player === st.holder ? (hand === st.hand ? "tepat" : "hampir") : "meleset";
    const target = outcome === "meleset" ? st.holder : st.seeker;
    const pts = outcome === "tepat" ? 3 : outcome === "hampir" ? 1 : 2;
    await updateState({ ...st, phase: "reveal", guess: { player, hand }, outcome });
    const p = players.find((x) => x.player_id === target);
    if (p) await db.from("room_players").update({ score: p.score + pts }).eq("id", p.id);
  };

  return (
    <RoomShell code={room.code} title="Cublak-Cublak Suweng">
      <Panel className="mb-4">
        <PlayerList players={players} myId={myId} highlight={st.seeker} />
        {phase !== "lobby" && (
          <p className="mt-3 text-sm text-muted-foreground">
            Pak Empo (penebak) ronde {(st.round ?? 0) + 1}: <b className="text-foreground">{nameOf(st.seeker)}</b>
          </p>
        )}
      </Panel>

      {phase === "lobby" && (
        <Panel className="text-center">
          <h2 className="text-2xl font-bold">Cublak-Cublak Suweng</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Satu pemain jadi Pak Empo. Suweng (biji) diam-diam disembunyikan di tangan salah satu pemain lain.
            Pak Empo harus menebak siapa yang memegang dan di tangan mana. Tepat +3, orangnya benar tapi tangan salah
            +1, meleset: penyembunyi +2. 2–6 pemain.
          </p>
          {isHost ? (
            <PrimaryButton className="mt-5" onClick={start} disabled={players.length < 2}>
              {players.length < 2 ? "Menunggu pemain lain…" : "Mulai main"}
            </PrimaryButton>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Menunggu host memulai…</p>
          )}
        </Panel>
      )}

      {phase === "hide" && (
        <Panel className="text-center">
          <p className="font-display text-lg italic text-seed">“{LYRIC}”</p>
          {iAmHolder ? (
            <>
              <p className="mt-4 font-bold">Suweng ada padamu! Sembunyikan di tangan mana?</p>
              <div className="mt-4 flex justify-center gap-3">
                <PrimaryButton onClick={() => hide("kiri")}>✊ Tangan kiri</PrimaryButton>
                <PrimaryButton onClick={() => hide("kanan")}>Tangan kanan ✊</PrimaryButton>
              </div>
            </>
          ) : (
            <p className="mt-4 text-muted-foreground">
              {iAmSeeker ? "Tutup mata… suweng sedang disembunyikan." : "Suweng sedang disembunyikan seseorang…"}
            </p>
          )}
        </Panel>
      )}

      {(phase === "guess" || phase === "reveal") && (
        <Panel>
          <p className="text-center text-sm font-semibold">
            {phase === "guess"
              ? iAmSeeker
                ? "Siapa yang memegang suweng? Pilih tangannya!"
                : `${nameOf(st.seeker)} sedang menebak… pasang wajah datar!`
              : st.outcome === "tepat"
                ? `Tepat! ${nameOf(st.seeker)} dapat +3`
                : st.outcome === "hampir"
                  ? `Hampir! Orangnya benar, tangannya salah. ${nameOf(st.seeker)} +1`
                  : `Meleset! ${nameOf(st.holder)} berhasil menyembunyikan, +2`}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players
              .filter((p) => p.player_id !== st.seeker)
              .map((p) => (
                <div key={p.id} className="rounded-2xl border border-border bg-secondary p-4 text-center">
                  <div className="font-bold">{p.name}</div>
                  <div className="mt-3 flex justify-center gap-3">
                    {(["kiri", "kanan"] as Hand[]).map((h) => {
                      const revealed = phase === "reveal" && p.player_id === st.holder && st.hand === h;
                      const guessed = st.guess?.player === p.player_id && st.guess?.hand === h;
                      const mine = phase === "guess" && iAmHolder && p.player_id === myId && st.hand === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          aria-label={`${p.name} tangan ${h}`}
                          disabled={!(phase === "guess" && iAmSeeker)}
                          onClick={() => guess(p.player_id, h)}
                          className={`grid h-16 w-16 place-items-center rounded-full text-3xl transition ${
                            phase === "guess" && iAmSeeker ? "cursor-pointer hover:scale-110 ring-2 ring-primary/60" : ""
                          } ${guessed ? "ring-2 ring-accent" : ""} bg-card`}
                        >
                          {revealed || mine ? "💎" : "✊"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
          {phase === "reveal" && (
            <div className="mt-5 text-center">
              <PrimaryButton onClick={() => newRound((st.round ?? 0) + 1)}>Ronde berikutnya</PrimaryButton>
            </div>
          )}
        </Panel>
      )}
    </RoomShell>
  );
}
