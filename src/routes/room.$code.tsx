import { createFileRoute, Link } from "@tanstack/react-router";
import { useRoom, type RoomCtx } from "@/lib/use-room";
import { CongklakRoom } from "@/components/games/CongklakRoom";
import { AbcRoom } from "@/components/games/AbcRoom";
import { KelerengRoom } from "@/components/games/KelerengRoom";
import { CublakRoom } from "@/components/games/CublakRoom";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Gimsonal` },
      {
        name: "description",
        content: `Room ${params.code} di Gimsonal. Main permainan tradisional online bersama teman.`,
      },
      { property: "og:title", content: `Room ${params.code} — Gimsonal` },
      { property: "og:description", content: "Gabung room ini dan main bareng temanmu sekarang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const ctx = useRoom(code);

  if (ctx.loading || !ctx.myId) return <Centered>Memuat room…</Centered>;
  if (ctx.notFound || !ctx.room) {
    return (
      <Centered>
        <p className="mb-4">Room {code} tidak ditemukan.</p>
        <Link to="/" className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">
          Kembali ke depan
        </Link>
      </Centered>
    );
  }
  const c = ctx as RoomCtx;
  switch (c.room.game) {
    case "abc":
      return <AbcRoom ctx={c} />;
    case "kelereng":
      return <KelerengRoom ctx={c} />;
    case "cublak":
      return <CublakRoom ctx={c} />;
    default:
      return <CongklakRoom ctx={c} />;
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</div>
  );
}
