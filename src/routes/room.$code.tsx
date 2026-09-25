import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId, getPlayerName } from "@/lib/player-identity";
import { applyMove, INITIAL_BOARD, type Board, type Player } from "@/lib/congklak";
import { CongklakBoard } from "@/components/CongklakBoard";
import { LandscapeToggle } from "@/components/LandscapeToggle";

type Room = {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  guest_id: string | null;
  guest_name: string | null;
  board: Board;
  turn: number;
  status: string;
  winner: number | null;
  last_move: { path?: number[] } | null;
};

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Congklak Online | Gimsonal` },
      {
        name: "description",
        content: `Papan congklak room ${params.code} di Gimsonal. Main 2 pemain secara online, giliran berganti langsung di kedua layar.`,
      },
      { property: "og:title", content: `Room ${params.code} — Congklak Online | Gimsonal` },
      {
        property: "og:description",
        content: "Gabung room congklak ini dan main bareng temanmu sekarang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage;
});

function RoomPage() {
  const { code } = Route.useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const myId = useRef("");
  const joined = useRef(false);

  useEffect(() => {
    myId.current = getPlayerId();
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRoom(data as Room);
    setLoading(false);

    // Otomatis bergabung sebagai pemain 2 jika kursi masih kosong.
    const r = data as Room;
    if (!joined.current && !r.guest_id && r.host_id !== myId.current) {
      joined.current = true;
      await supabase
        .from("game_rooms")
        .update({
          guest_id: myId.current,
          guest_name: getPlayerName() || "Pemain 2",
          status: "playing",
        })
        .eq("id", r.id)
        .is("guest_id", null);
    }
  }, [code]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        },
      )
      .subscribe();
    const poll = setInterval(() => void load(), 4000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [code, load]);

  const me: Player | null =
    room && room.host_id === myId.current
      ? 0
      : room && room.guest_id === myId.current
        ? 1
        : null;

  const pick = async (hole: number) => {
    if (!room || me === null || room.status !== "playing" || room.turn !== me) return;
    const result = applyMove(room.board, me, hole);
    if (!result) return;
    const next = {
      ...room,
      board: result.board,
      turn: result.turn,
      status: result.status,
      winner: result.winner,
      last_move: { path: result.path },
    };
    setRoom(next);
    await supabase
      .from("game_rooms")
      .update({
        board: result.board,
        turn: result.turn,
        status: result.status,
        winner: result.winner,
        last_move: { path: result.path },
      })
      .eq("id", room.id);
  };

  const restart = async () => {
    if (!room) return;
    await supabase
      .from("game_rooms")
      .update({
        board: INITIAL_BOARD,
        turn: 0,
        status: room.guest_id ? "playing" : "waiting",
        winner: null,
        last_move: null,
      })
      .eq("id", room.id);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return <Centered>Memuat room…</Centered>;
  }

  if (notFound || !room) {
    return (
      <Centered>
        <p className="mb-4">Room {code} tidak ditemukan.</p>
        <Link to="/" className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">
          Kembali ke depan
        </Link>
      </Centered>
    );
  }

  const names: [string, string] = [room.host_name, room.guest_name ?? "Menunggu…"];
  const turnName = names[room.turn];
  const waiting = !room.guest_id;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="font-display text-lg font-bold">
          Gimsonal
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold"
          >
            {copied ? "Link disalin!" : `Kode: ${room.code}`}
          </button>
          <LandscapeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-sm">
            <span className="font-bold">{names[0]}</span>
            <span className="text-muted-foreground"> vs </span>
            <span className="font-bold">{names[1]}</span>
            {me !== null && (
              <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                kamu {me === 0 ? names[0] : names[1]}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold">
            {room.status === "finished"
              ? room.winner === -1
                ? "Seri!"
                : `Pemenang: ${names[room.winner ?? 0]}`
              : waiting
                ? "Menunggu pemain kedua…"
                : me !== null && room.turn === me
                  ? "Giliran kamu"
                  : `Giliran ${turnName}`}
          </div>
        </div>

        {waiting && (
          <div className="mb-4 rounded-2xl border border-primary/40 bg-secondary p-4 text-sm">
            Bagikan kode <span className="font-bold tracking-[0.3em] text-primary">{room.code}</span>{" "}
            ke temanmu, atau tekan tombol kode di atas untuk menyalin link room.
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={restart}
            className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold"
          >
            Main ulang
          </button>
          {me === null && (
            <span className="text-xs text-muted-foreground">
              Kamu menonton — kedua kursi pemain sudah terisi.
            </span>
          )}
        </div>

        <details className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-bold text-foreground">Cara main congklak</summary>
          <p className="mt-3">
            Pilih salah satu lubang di deretmu (deret bawah). Biji disebar satu per satu berlawanan
            arah jarum jam, melewati lumbungmu tapi tidak lumbung lawan. Jika biji terakhir jatuh di
            lubang yang masih ada isinya, biji di lubang itu diambil dan disebar lagi. Jika jatuh di
            lumbungmu, kamu jalan sekali lagi. Jika jatuh di lubang kosong milikmu, biji di lubang
            lawan yang berseberangan kamu tembak masuk lumbung. Pemain dengan biji terbanyak di
            lumbung menang.
          </p>
        </details>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Gimsonal — copyright@alex2026
      </footer>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
