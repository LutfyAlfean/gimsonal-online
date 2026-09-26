import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LandscapeToggle } from "@/components/LandscapeToggle";
import type { RoomPlayer } from "@/lib/use-room";

export function RoomShell({ code, title, children }: { code: string; title: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-display text-lg font-bold">
            Gimsonal
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold"
          >
            {copied ? "Link disalin!" : `Kode: ${code}`}
          </button>
          <LandscapeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-10">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Gimsonal — copyright@alex2026
      </footer>
    </div>
  );
}

export function PlayerList({
  players,
  myId,
  highlight,
  showScore = true,
}: {
  players: RoomPlayer[];
  myId: string;
  highlight?: string | null;
  showScore?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
            highlight === p.player_id ? "border-primary bg-primary/15" : "border-border bg-card"
          }`}
        >
          <span className="font-semibold">
            {p.name}
            {p.player_id === myId && <span className="text-muted-foreground"> (kamu)</span>}
          </span>
          {showScore && <span className="rounded-full bg-secondary px-2 text-xs font-bold text-seed">{p.score}</span>}
        </div>
      ))}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
