import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId, getPlayerName } from "@/lib/player-identity";
import type { Board } from "@/lib/congklak";

export type GameKind = "congklak" | "abc" | "kelereng" | "cublak";

export type Room = {
  id: string;
  code: string;
  game: GameKind;
  host_id: string;
  host_name: string;
  guest_id: string | null;
  guest_name: string | null;
  board: Board;
  turn: number;
  status: string;
  winner: number | null;
  last_move: { path?: number[] } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  player_id: string;
  name: string;
  score: number;
  joined_at: string;
};

export const MAX_PLAYERS: Record<GameKind, number> = { congklak: 2, abc: 8, kelereng: 4, cublak: 6 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export function useRoom(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myId, setMyId] = useState("");
  const joining = useRef(false);

  useEffect(() => setMyId(getPlayerId()), []);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data } = await db
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setPlayers((data ?? []) as RoomPlayer[]);
    return (data ?? []) as RoomPlayer[];
  }, []);

  const load = useCallback(async () => {
    const { data } = await db.from("game_rooms").select("*").eq("code", code).maybeSingle();
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const r = data as Room;
    setRoom(r);
    const ps = await loadPlayers(r.id);
    setLoading(false);

    // Otomatis masuk daftar pemain (game banyak pemain).
    const me = getPlayerId();
    if (
      r.game !== "congklak" &&
      !joining.current &&
      !ps.some((p) => p.player_id === me) &&
      ps.length < MAX_PLAYERS[r.game]
    ) {
      joining.current = true;
      await db.from("room_players").upsert(
        { room_id: r.id, player_id: me, name: getPlayerName() || `Pemain ${ps.length + 1}` },
        { onConflict: "room_id,player_id", ignoreDuplicates: true },
      );
      await loadPlayers(r.id);
    }
  }, [code, loadPlayers]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new && "id" in payload.new) setRoom(payload.new as Room);
        },
      )
      .subscribe();
    const poll = setInterval(() => void load(), 3000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [code, load]);

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`players-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => void loadPlayers(roomId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, loadPlayers]);

  const updateState = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (state: any) => {
      if (!room) return;
      setRoom({ ...room, state });
      await db.from("game_rooms").update({ state }).eq("id", room.id);
    },
    [room],
  );

  const addScore = useCallback(
    async (playerId: string, delta: number) => {
      const p = players.find((x) => x.player_id === playerId);
      if (!p || !delta) return;
      await db.from("room_players").update({ score: p.score + delta }).eq("id", p.id);
    },
    [players],
  );

  const resetScores = useCallback(async () => {
    if (!room) return;
    await db.from("room_players").update({ score: 0 }).eq("room_id", room.id);
  }, [room]);

  return { room, setRoom, players, loading, notFound, myId, load, updateState, addScore, resetScores };
}

export type RoomCtx = ReturnType<typeof useRoom> & { room: Room };
