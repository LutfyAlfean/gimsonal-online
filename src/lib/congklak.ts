// Logika permainan Congklak (dakon) — 7 lubang per pemain, 7 biji per lubang.
// Index papan: 0..6 lubang Pemain 1, 7 = lumbung Pemain 1,
//              8..14 lubang Pemain 2, 15 = lumbung Pemain 2.

export type Board = number[];
export type Player = 0 | 1;

export const INITIAL_BOARD: Board = [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0];

export const storeOf = (p: Player) => (p === 0 ? 7 : 15);
export const holesOf = (p: Player) => (p === 0 ? [0, 1, 2, 3, 4, 5, 6] : [8, 9, 10, 11, 12, 13, 14]);
export const ownsHole = (p: Player, i: number) =>
  p === 0 ? i >= 0 && i <= 6 : i >= 8 && i <= 14;
export const oppositeHole = (i: number) => 14 - i;

const nextIndex = (i: number, skip: number) => {
  let n = (i + 1) % 16;
  if (n === skip) n = (n + 1) % 16;
  return n;
};

export const sideSum = (board: Board, p: Player) =>
  holesOf(p).reduce((sum, i) => sum + board[i], 0);

export type MoveResult = {
  board: Board;
  turn: Player;
  status: "playing" | "finished";
  winner: number | null; // 0 | 1 | -1 (seri)
  path: number[];
  captured: number;
  extraTurn: boolean;
};

export function canMove(board: Board, player: Player, hole: number) {
  return ownsHole(player, hole) && board[hole] > 0;
}

export function applyMove(board: Board, player: Player, hole: number): MoveResult | null {
  if (!canMove(board, player, hole)) return null;

  const b = [...board];
  const store = storeOf(player);
  const skip = player === 0 ? 15 : 7;
  const path: number[] = [];
  let captured = 0;
  let extraTurn = false;

  let hand = b[hole];
  b[hole] = 0;
  let idx = hole;

  // Menyebar terus-menerus sampai biji terakhir jatuh di lubang kosong.
  for (let guard = 0; guard < 2000; guard++) {
    while (hand > 0) {
      idx = nextIndex(idx, skip);
      b[idx] += 1;
      hand -= 1;
      path.push(idx);
    }

    if (idx === store) {
      extraTurn = true;
      break;
    }

    if (b[idx] === 1) {
      if (ownsHole(player, idx)) {
        const opp = oppositeHole(idx);
        if (b[opp] > 0) {
          captured = b[opp] + 1;
          b[store] += captured;
          b[opp] = 0;
          b[idx] = 0;
        }
      }
      break;
    }

    hand = b[idx];
    b[idx] = 0;
  }

  let status: MoveResult["status"] = "playing";
  let winner: number | null = null;
  let turn: Player = extraTurn ? player : ((1 - player) as Player);

  const empty0 = sideSum(b, 0) === 0;
  const empty1 = sideSum(b, 1) === 0;

  if (empty0 || empty1) {
    // Biji yang tersisa masuk ke lumbung pemiliknya.
    b[7] += sideSum(b, 0);
    b[15] += sideSum(b, 1);
    holesOf(0).forEach((i) => (b[i] = 0));
    holesOf(1).forEach((i) => (b[i] = 0));
    status = "finished";
    winner = b[7] > b[15] ? 0 : b[15] > b[7] ? 1 : -1;
  } else if (sideSum(b, turn) === 0) {
    // Pemain berikutnya tidak punya biji: giliran kembali ke pemain ini.
    turn = player;
  }

  return { board: b, turn, status, winner, path, captured, extraTurn };
}
