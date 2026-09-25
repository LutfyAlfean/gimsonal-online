import { useEffect, useState } from "react";

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

export function LandscapeToggle({ className = "" }: { className?: string }) {
  const [isMobile, setIsMobile] = useState(false);
  const [wide, setWide] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900);
      setWide(window.innerWidth > window.innerHeight);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Di HP, coba langsung kunci ke layar lebar saat pertama masuk.
  useEffect(() => {
    if (!isMobile || wide) return;
    const o = window.screen?.orientation as OrientationLock | undefined;
    o?.lock?.("landscape").catch(() => {});
  }, [isMobile, wide]);

  const toLandscape = async () => {
    setNote(null);
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen?.();
    } catch {
      /* sebagian browser menolak, tidak masalah */
    }
    const o = window.screen?.orientation as OrientationLock | undefined;
    try {
      await o?.lock?.("landscape");
    } catch {
      setNote("Putar HP ke posisi mendatar ya");
    }
  };

  const exit = async () => {
    const o = window.screen?.orientation as OrientationLock | undefined;
    o?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  if (!isMobile) return null;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={wide ? exit : toLandscape}
        className="rounded-full border border-primary/50 bg-secondary px-4 py-2 text-xs font-semibold text-primary shadow-lg active:scale-95"
      >
        {wide ? "Keluar layar penuh" : "Mainkan layar lebar"}
      </button>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  );
}
