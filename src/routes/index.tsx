import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId, getPlayerName, setPlayerName, makeRoomCode } from "@/lib/player-identity";
import { INITIAL_BOARD } from "@/lib/congklak";
import { LandscapeToggle } from "@/components/LandscapeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gimsonal — Congklak Online 2 Pemain" },
      {
        name: "description",
        content:
          "Gimsonal: mainkan Congklak tradisional secara online bersama teman. Buat room, bagikan kode, main 2 pemain langsung dari HP atau laptop.",
      },
      { property: "og:title", content: "Gimsonal — Congklak Online 2 Pemain" },
      {
        property: "og:description",
        content: "Permainan tradisional Congklak online. Buat room, bagikan kode, main bareng teman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getPlayerName());
  }, []);

  const requireName = () => {
    const n = name.trim();
    if (n.length < 2) {
      setError("Masukkan nama kamu dulu (minimal 2 huruf).");
      return null;
    }
    setPlayerName(n);
    return n;
  };

  const createRoom = async () => {
    const n = requireName();
    if (!n) return;
    setBusy(true);
    setError(null);
    const roomCode = makeRoomCode();
    const { error: err } = await supabase.from("game_rooms").insert({
      code: roomCode,
      host_id: getPlayerId(),
      host_name: n,
      board: INITIAL_BOARD,
      turn: 0,
      status: "waiting",
    });
    setBusy(false);
    if (err) {
      setError("Gagal membuat room. Coba lagi ya.");
      return;
    }
    navigate({ to: "/room/$code", params: { code: roomCode } });
  };

  const joinRoom = async () => {
    const n = requireName();
    if (!n) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Kode room belum lengkap.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("game_rooms")
      .select("code")
      .eq("code", c)
      .maybeSingle();
    setBusy(false);
    if (err || !data) {
      setError("Room tidak ditemukan. Periksa kodenya.");
      return;
    }
    navigate({ to: "/room/$code", params: { code: c } });
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
            G
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Gimsonal</span>
        </div>
        <LandscapeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Permainan Tradisional
            </span>
            <h1 className="mt-5 text-5xl leading-[1.05] font-bold sm:text-6xl">
              <span className="text-gradient-gold">Congklak</span>
              <br />
              online 2 pemain
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Papan kayu, biji sawo, dan aturan asli congklak — kini bisa dimainkan bareng teman dari
              jarak jauh. Buat room, bagikan kodenya, langsung main.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>• Benar-benar online: teman ikut hanya dengan kode room</li>
              <li>• Papan bergerak langsung di kedua layar</li>
              <li>• Di HP ada tombol layar lebar (mendatar)</li>
            </ul>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold">Mulai bermain</h2>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Nama kamu
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Alex"
              maxLength={18}
              className="mt-2 w-full rounded-xl border border-input bg-secondary px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />

            <button
              type="button"
              onClick={createRoom}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              Buat room baru
            </button>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
            </div>

            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Kode room teman
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC12"
                maxLength={6}
                className="w-full rounded-xl border border-input bg-secondary px-4 py-3 text-base tracking-[0.3em] outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={joinRoom}
                disabled={busy}
                className="shrink-0 rounded-xl bg-accent px-5 py-3 font-bold text-accent-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                Ikut
              </button>
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            ["1. Isi nama", "Nama kamu akan tampil di papan sebagai pemilik lumbung."],
            ["2. Bagikan kode", "Buat room, lalu kirim kode 5 huruf ke lawanmu."],
            ["3. Jalan biji", "Sebar biji berlawanan arah jarum jam, isi lumbung sendiri sebanyak mungkin."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Gimsonal — copyright@alex2026
      </footer>
    </div>
  );
}
