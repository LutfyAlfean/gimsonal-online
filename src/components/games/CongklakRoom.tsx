import { useEffect, useRef } from "react";
import { getPlayerName } from "@/lib/player-identity";
import { applyMove, INITIAL_BOARD, type Player } from "@/lib/congklak";
import { CongklakBoard } from "@/components/CongklakBoard";
import { RoomShell } from "@/components/RoomShell";
import { db, type RoomCtx } from "@/lib/use-room";

export function CongklakRoom({ ctx }: { ctx: RoomCtx }) {
  const { room, setRoom, myId } = ctx;
  const joined = useRef(false);

  // Otomatis bergabung sebagai pemain 2 jika kursi masih kosong.
  useEffect(() => {
    if (joined.current || room.guest_id || room.host_id === myId) return;
    joined.current = true;
    void db
      .from("game_rooms")
      .update({ guest_id: myId, guest_name: getPlayerName() || "Pemain 2", status: "playing" })
      .eq("id", room.id)
      .is("guest_id", null)
      .then(() => ctx.load());
  }, [room.guest_id, room.host_id, room.id, myId, ctx]);

  const me: Player | null = room.host_id === myId ? 0 : room.guest_id === myId ? 1 : null;

  const pick = async (hole: number) => {
    if (me === null || room.status !== "playing" || room.turn !== me) return;
    const result = applyMove(room.board, me, hole);
    if (!result) return;
    const patch = {
      board: result.board,
      turn: result.turn,
      status: result.status,
      winner: result.winner,
      last_move: { path: result.path },
    };
    setRoom({ ...room, ...patch });
    await db.from("game_rooms").update(patch).eq("id", room.id);
  };

  const restart = async () => {
    await db
      .from("game_rooms")
      .update({
        board: INITIAL_BOARD,
        turn: 0,
        status: room.guest_id ? "playing" : "waiting",
        winner: null,
        last_move: null,
      })
      .eq("id", room.id);
    void ctx.load();
  };

  const names: [string, string] = [room.host_name, room.guest_name ?? "Menunggu…"];
  const waiting = !room.guest_id;

  return (
    <RoomShell code={room.code} title="Congklak">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="text-sm">
          <span className="font-bold">{names[0]}</span>
          <span className="text-muted-foreground"> vs </span>
          <span className="font-bold">{names[1]}</span>
        </div>
        <div className="text-sm font-semibold" data-testid="status">
          {room.status === "finished"
            ? room.winner === -1
              ? "Seri!"
              : `Pemenang: ${names[room.winner ?? 0]}`
            : waiting
              ? "Menunggu pemain kedua…"
              : me !== null && room.turn === me
                ? "Giliran kamu"
                : `Giliran ${names[room.turn]}`}
        </div>
      </div>

      {waiting && (
        <div className="mb-4 rounded-2xl border border-primary/40 bg-secondary p-4 text-sm">
          Bagikan kode <span className="font-bold tracking-[0.3em] text-primary">{room.code}</span> ke temanmu.
        </div>
      )}

      <CongklakBoard
        board={room.board}
        turn={room.turn as Player}
        me={me}
        playable={room.status === "playing"}
        lastPath={room.last_move?.path ?? []}
        onPick={pick}
        names={names}
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={restart} className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold">
          Main ulang
        </button>
        {me === null && (
          <span className="text-xs text-muted-foreground">Kamu menonton — kedua kursi sudah terisi.</span>
        )}
      </div>

      <details className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-bold text-foreground">Cara main congklak</summary>
        <p className="mt-3">
          Pilih lubang di deretmu (bawah). Biji disebar berlawanan arah jarum jam, melewati lumbungmu tapi
          tidak lumbung lawan. Biji terakhir di lubang berisi: ambil dan sebar lagi. Di lumbungmu: jalan
          lagi. Di lubang kosong milikmu: tembak biji lawan di seberangnya. Lumbung terbanyak menang.
        </p>
      </details>
    </RoomShell>
  );
}
