import { canMove, type Board, type Player } from "@/lib/congklak";

type Props = {
  board: Board;
  turn: Player;
  me: Player | null;
  playable: boolean;
  lastPath?: number[];
  onPick: (hole: number) => void;
  names: [string, string];
};

function Seeds({ count }: { count: number }) {
  const dots = Math.min(count, 12);
  return (
    <span className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-[3px] p-2">
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className="h-[7px] w-[7px] rounded-full bg-seed shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        />
      ))}
    </span>
  );
}

function Hole({
  index,
  value,
  active,
  highlight,
  onPick,
}: {
  index: number;
  value: number;
  active: boolean;
  highlight: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => onPick(index)}
      className={`hole-pit relative aspect-square w-full rounded-full transition-transform ${
        active ? "cursor-pointer ring-2 ring-primary/70 hover:scale-105" : "cursor-default"
      } ${highlight ? "ring-2 ring-accent" : ""}`}
    >
      <Seeds count={value} />
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-muted-foreground">
        {value}
      </span>
    </button>
  );
}

function Store({ value, label, glow }: { value: number; label: string; glow: boolean }) {
  return (
    <div
      className={`hole-pit relative flex h-full min-h-[120px] w-16 flex-col items-center justify-center rounded-[2rem] sm:w-20 ${
        glow ? "ring-2 ring-primary" : ""
      }`}
    >
      <Seeds count={value} />
      <span className="relative mt-auto mb-2 text-sm font-bold text-seed">{value}</span>
      <span className="absolute -top-6 whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function CongklakBoard({ board, turn, me, playable, lastPath = [], onPick, names }: Props) {
  const top = [14, 13, 12, 11, 10, 9, 8];
  const bottom = [0, 1, 2, 3, 4, 5, 6];
  const rowsForMe = me === 1 ? { far: bottom.slice().reverse(), near: top.slice().reverse() } : { far: top, near: bottom };
  const myLabel = me === 1 ? names[1] : names[0];
  const oppLabel = me === 1 ? names[0] : names[1];
  const myStore = me === 1 ? 15 : 7;
  const oppStore = me === 1 ? 7 : 15;

  const isActive = (i: number) =>
    playable && me !== null && turn === me && canMove(board, me, i);

  return (
    <div className="surface-wood w-full rounded-[2.5rem] border border-border/60 p-4 pt-8 sm:p-6 sm:pt-10">
      <div className="flex items-stretch gap-3 sm:gap-5">
        <Store value={board[oppStore]} label={oppLabel} glow={me !== null && turn !== me} />
        <div className="flex flex-1 flex-col justify-center gap-7">
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {rowsForMe.far.map((i) => (
              <Hole
                key={i}
                index={i}
                value={board[i]}
                active={false}
                highlight={lastPath.includes(i)}
                onPick={onPick}
              />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {rowsForMe.near.map((i) => (
              <Hole
                key={i}
                index={i}
                value={board[i]}
                active={isActive(i)}
                highlight={lastPath.includes(i)}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
        <Store value={board[myStore]} label={myLabel} glow={me !== null && turn === me} />
      </div>
    </div>
  );
}
