// YoruNime — GAMES di Voice Room: UNO (4 orang) & Catur (2 orang).
//
// Semua validasi permainan ada di server. Query `session` menyensor hand
// UNO (hanya jumlah kartu per user) — hand milik sendiri lewat `myHand`.
// Karena query Convex reaktif, tiap langkah langsung terlihat semua pemain.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

async function me(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

type Game = "uno" | "chess" | "snakes";

/* ====================================================================== *
 *  UNO — 108 kartu standar (encode: r/g/b/y + value, w/w4 = liar)
 * ====================================================================== */

const COLORS = ["r", "g", "b", "y"] as const;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshDeck(): string[] {
  const deck: string[] = [];
  for (const c of COLORS) {
    deck.push(`${c}0`);
    for (let n = 1; n <= 9; n++) deck.push(`${c}${n}`);
    for (let n = 1; n <= 9; n++) deck.push(`${c}${n}`);
    deck.push(`${c}s`, `${c}s`, `${c}r`, `${c}r`, `${c}2`, `${c}2`);
  }
  deck.push("w", "w", "w", "w", "w4", "w4", "w4", "w4");
  return shuffle(deck);
}

const isWild = (c: string) => c === "w" || c === "w4";

function canPlay(card: string, top: string, color: string): boolean {
  if (isWild(card)) return true;
  const topColor = isWild(top) ? color : top[0];
  return card[0] === topColor || card.slice(1) === top.slice(1);
}

type UnoState = {
  deck: string[];
  discard: string[];
  hands: Record<string, string[]>;
  /** Warna aktif (setelah kartu liar). */
  color: string;
  turn: string;
  dir: 1 | -1;
  unoCalled: Record<string, boolean>;
};

function orderOf(players: { userId: string; seat: number }[]): string[] {
  return [...players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.userId);
}

function ensureDeck(st: UnoState, need: number): void {
  if (st.deck.length >= need) return;
  if (st.discard.length <= 1) return; // tidak ada bahan daur ulang
  const top = st.discard.pop()!;
  st.deck = shuffle(st.discard);
  st.discard = [top];
}

function drawCards(st: UnoState, userId: string, n: number): void {
  ensureDeck(st, n);
  const hand = st.hands[userId] ?? [];
  for (let i = 0; i < n && st.deck.length; i++) hand.push(st.deck.pop()!);
  st.hands[userId] = hand;
}

function nextTurn(st: UnoState, order: string[], steps = 1): void {
  const i = order.indexOf(st.turn);
  if (i < 0) return;
  const n = order.length;
  st.turn = order[(((i + st.dir * steps) % n) + n) % n];
}

function startUno(s: Doc<"gameSessions">): UnoState {
  const deck = freshDeck();
  const order = orderOf(s.players);
  const hands: Record<string, string[]> = {};
  for (const uid of order) hands[uid] = [];
  for (let k = 0; k < 7; k++)
    for (const uid of order) hands[uid].push(deck.pop()!);
  // Kartu pertama di discard: yang bukan kartu liar/special supaya netral.
  let top = "";
  while (deck.length) {
    const c = deck[deck.length - 1];
    if (isWild(c) || c.endsWith("2") || c.endsWith("s") || c.endsWith("r")) {
      deck.push(deck.pop()!); // balik ke bawah — sederhana: keluarkan saja
      deck.unshift(deck.pop()!);
      if (isWild(c)) deck.unshift(deck.pop()!);
      continue;
    }
    top = c;
    deck.pop();
    break;
  }
  if (!top) {
    top = "r5";
  }
  return {
    deck,
    discard: [top],
    hands,
    color: top[0],
    turn: order[0],
    dir: 1,
    unoCalled: Object.fromEntries(order.map((u) => [u, true])),
  };
}

/* ====================================================================== *
 *  ULAR TANGGA — dadu 1–6, maju, naik tangga & turun ular, harus PAS di 100
 * ====================================================================== */

type SnakesState = {
  /** Posisi tiap pemain (0 = base, 1..100 = petak). */
  pos: Record<string, number>;
  turn: string;
  /** Hasil dadu terakhir + siapa yang melempar (buat animasi UI). */
  lastRoll: number | null;
  lastBy: string | null;
};

/** Tangga: petak awal → petak akhir. */
const LADDERS: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

/** Ular: kepala → ekor. */
const SNAKES: Record<number, number> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

function startSnakes(order: string[]): SnakesState {
  return {
    pos: Object.fromEntries(order.map((u) => [u, 0])),
    turn: order[0] ?? "",
    lastRoll: null,
    lastBy: null,
  };
}

/* ====================================================================== *
 *  CATUR — validasi langkah lengkap (bidak, kastel, en passant, skak)
 * ====================================================================== */

type ChessState = {
  /** 64 petak, index 0 = a8. Kode: wP/wN/wB/wR/wWQ/wK — "wQ","bK", dll. */
  board: (string | null)[];
  turn: "w" | "b";
  castling: string; // substring dari "KQkq"
  ep: number | null; // petak sasaran en passant
  last: { from: number; to: number } | null;
};

const KIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const DIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTHO: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const ALL: [number, number][] = [...DIAG, ...ORTHO];

const idx = (f: number, r: number) => r * 8 + f;
const fileOf = (i: number) => i % 8;
const rankOf = (i: number) => Math.floor(i / 8);

function startChess(): ChessState {
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board: (string | null)[] = new Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    board[idx(f, 0)] = `b${back[f]}`;
    board[idx(f, 1)] = "bP";
    board[idx(f, 6)] = "wP";
    board[idx(f, 7)] = `w${back[f]}`;
  }
  return { board, turn: "w", castling: "KQkq", ep: null, last: null };
}

function isAttacked(
  board: (string | null)[],
  target: number,
  by: "w" | "b",
): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);
  // pion
  const pr = by === "w" ? tr + 1 : tr - 1; // pion by menyerang dari rank pr
  for (const df of [-1, 1]) {
    const f = tf + df;
    if (f >= 0 && f < 8 && pr >= 0 && pr < 8) {
      if (board[idx(f, pr)] === `${by}P`) return true;
    }
  }
  // kuda
  for (const [df, dr] of KIGHT) {
    const f = tf + df;
    const r = tr + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8 && board[idx(f, r)] === `${by}N`)
      return true;
  }
  // raja
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = tf + df;
      const r = tr + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8 && board[idx(f, r)] === `${by}K`)
        return true;
    }
  // garis: benteng/mafil/gajah/menteri
  const scan = (dirs: [number, number][], types: string[]) => {
    for (const [df, dr] of dirs) {
      let f = tf + df;
      let r = tr + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const p = board[idx(f, r)];
        if (p) {
          if (p[0] === by && types.includes(p[1])) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
    return false;
  };
  if (scan(DIAG, ["B", "Q"])) return true;
  if (scan(ORTHO, ["R", "Q"])) return true;
  return false;
}

function inCheck(board: (string | null)[], color: "w" | "b"): boolean {
  const king = board.indexOf(`${color}K`);
  if (king < 0) return false;
  return isAttacked(board, king, color === "w" ? "b" : "w");
}

function applyMove(st: ChessState, from: number, to: number): ChessState {
  const board = st.board.slice();
  const p = board[from]!;
  const color = p[0] as "w" | "b";
  const type = p[1];
  const f = fileOf(from);
  const r = rankOf(from);
  const tf = fileOf(to);
  const tr = rankOf(to);
  let castling = st.castling;
  let ep: number | null = null;
  const captured = board[to] !== null;

  // en passant: pion makan diagonal ke petak kosong
  if (type === "P" && st.ep === to) board[idx(tf, r)] = null;

  board[to] = p;
  board[from] = null;

  // promosi — selalu menteri (sederhana & cukup untuk voice room)
  if (type === "P" && (tr === 0 || tr === 7)) board[to] = `${color}Q`;

  // pion maju 2 → target en passant
  if (type === "P" && Math.abs(tr - r) === 2) ep = idx(f, (r + tr) / 2);

  // kastel — geser benteng
  if (type === "K" && Math.abs(tf - f) === 2) {
    const homeR = color === "w" ? 7 : 0;
    if (tf === 6) {
      board[idx(5, homeR)] = board[idx(7, homeR)];
      board[idx(7, homeR)] = null;
    }
    if (tf === 2) {
      board[idx(3, homeR)] = board[idx(0, homeR)];
      board[idx(0, homeR)] = null;
    }
  }

  // hak kastel hilang
  if (type === "K")
    castling = castling.replace(color === "w" ? /[KQ]/g : /[kq]/g, "");
  if (from === 63 || to === 63) castling = castling.replace("K", "");
  if (from === 56 || to === 56) castling = castling.replace("Q", "");
  if (from === 7 || to === 7) castling = castling.replace("k", "");
  if (from === 0 || to === 0) castling = castling.replace("q", "");

  return {
    board,
    turn: color === "w" ? "b" : "w",
    castling,
    ep,
    last: { from, to },
    ...(type === "P" || captured ? {} : {}),
  };
}

function pseudoMoves(st: ChessState, from: number): number[] {
  const p = st.board[from];
  if (!p) return [];
  const color = p[0] as "w" | "b";
  const type = p[1];
  const f = fileOf(from);
  const r = rankOf(from);
  const out: number[] = [];
  const push = (tf: number, tr: number) => {
    if (tf < 0 || tf > 7 || tr < 0 || tr > 7) return false;
    const t = idx(tf, tr);
    const occ = st.board[t];
    if (occ && occ[0] === color) return false;
    out.push(t);
    return !occ;
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startR = color === "w" ? 6 : 1;
    const one = idx(f, r + dir);
    if (r + dir >= 0 && r + dir < 8 && !st.board[one]) {
      out.push(one);
      const two = idx(f, r + 2 * dir);
      if (r === startR && !st.board[two]) out.push(two);
    }
    for (const df of [-1, 1]) {
      const tf = f + df;
      const tr = r + dir;
      if (tf < 0 || tf > 7 || tr < 0 || tr > 7) continue;
      const t = idx(tf, tr);
      const occ = st.board[t];
      if (occ && occ[0] !== color) out.push(t);
      else if (st.ep === t) out.push(t);
    }
  } else if (type === "N") {
    for (const [df, dr] of KIGHT) push(f + df, r + dr);
  } else if (type === "K") {
    for (const [df, dr] of ALL) push(f + df, r + dr);
    // kastel
    const opp = color === "w" ? "b" : "w";
    const homeR = color === "w" ? 7 : 0;
    if (from === idx(4, homeR) && !isAttacked(st.board, from, opp)) {
      if (
        castlingOk(st, color, "K") &&
        st.board[idx(7, homeR)] === `${color}R` &&
        !st.board[idx(5, homeR)] &&
        !st.board[idx(6, homeR)] &&
        !isAttacked(st.board, idx(5, homeR), opp) &&
        !isAttacked(st.board, idx(6, homeR), opp)
      )
        out.push(idx(6, homeR));
      if (
        castlingOk(st, color, "Q") &&
        st.board[idx(0, homeR)] === `${color}R` &&
        !st.board[idx(1, homeR)] &&
        !st.board[idx(2, homeR)] &&
        !st.board[idx(3, homeR)] &&
        !isAttacked(st.board, idx(3, homeR), opp) &&
        !isAttacked(st.board, idx(2, homeR), opp)
      )
        out.push(idx(2, homeR));
    }
  } else {
    const dirs =
      type === "B" ? DIAG : type === "R" ? ORTHO : ([...ALL] as [number, number][]);
    for (const [df, dr] of dirs) {
      let tf = f + df;
      let tr = r + dr;
      while (tf >= 0 && tf < 8 && tr >= 0 && tr < 8) {
        const t = idx(tf, tr);
        const occ = st.board[t];
        if (!occ) out.push(t);
        else {
          if (occ[0] !== color) out.push(t);
          break;
        }
        tf += df;
        tr += dr;
      }
    }
  }
  return out;
}

function castlingOk(st: ChessState, color: "w" | "b", side: "K" | "Q") {
  return st.castling.includes(color === "w" ? side : side.toLowerCase());
}

function legalMoves(st: ChessState, from: number): number[] {
  const p = st.board[from];
  if (!p) return [];
  const color = p[0] as "w" | "b";
  return pseudoMoves(st, from).filter((to) => {
    const nxt = applyMove(st, from, to);
    return !inCheck(nxt.board, color);
  });
}

function sideHasMove(st: ChessState, color: "w" | "b"): boolean {
  for (let i = 0; i < 64; i++) {
    const p = st.board[i];
    if (p && p[0] === color && legalMoves(st, i).length) return true;
  }
  return false;
}

/* ====================================================================== *
 *  HELPERS SESI
 * ====================================================================== */

async function getSession(ctx: QueryCtx | MutationCtx, id: Id<"gameSessions">) {
  return await ctx.db.get(id);
}

async function requirePlayer(
  ctx: MutationCtx,
  sessionId: Id<"gameSessions">,
): Promise<{ s: Doc<"gameSessions">; userId: Id<"users"> }> {
  const userId = await me(ctx);
  if (!userId) throw new Error("Login dulu ya");
  const s = await ctx.db.get(sessionId);
  if (!s) throw new Error("Sesi permainan tidak ada");
  if (!s.players.some((p) => p.userId === userId))
    throw new Error("Kamu bukan pemain");
  return { s, userId };
}

function myColor(
  s: Doc<"gameSessions">,
  userId: Id<"users">,
): "w" | "b" | null {
  const p = s.players.find((x) => x.userId === userId);
  if (!p) return null;
  if (s.game === "chess") return p.seat === 0 ? "w" : "b";
  return null;
}

/** Bentuk session untuk semua klien — hand UNO disensor jadi jumlah. */
function view(s: Doc<"gameSessions">) {
  // LOBBY: state belum dibuat — dulu `st.pos` / `st.hands` / `st.board`
  // diakses saat state masih null sehingga query MELEMPAR error dan klien
  // crash (terpental ke menu home, game tidak bisa dimulai). Bangun preview
  // state dulu supaya kartu lobby tampil normal.
  if (!s.state) {
    const preview =
      s.game === "uno"
        ? startUno(s)
        : s.game === "snakes"
          ? startSnakes(orderOf(s.players))
          : startChess();
    if (preview) return view({ ...s, state: preview });
  }
  const base = {
    _id: s._id,
    roomId: s.roomId,
    hostId: s.hostId,
    game: s.game,
    seats: s.seats,
    status: s.status,
    winnerId: s.winnerId,
    players: s.players,
    updatedAt: s.updatedAt,
  };
  if (s.game === "snakes") {
    const st = s.state as SnakesState;
    return {
      ...base,
      game: "snakes" as const,
      snakes: {
        pos: st.pos,
        turn: st.turn,
        lastRoll: st.lastRoll,
        lastBy: st.lastBy,
        ladders: LADDERS,
        snakeMap: SNAKES,
      },
    };
  }
  if (s.game === "uno") {
    const st = s.state as UnoState;
    const counts: Record<string, number> = {};
    const called: Record<string, boolean> = {};
    for (const p of s.players) {
      counts[p.userId] = (st.hands[p.userId] ?? []).length;
      called[p.userId] = !!st.unoCalled[p.userId];
    }
    return {
      ...base,
      game: "uno" as const,
      uno: {
        deckCount: st.deck.length,
        top: st.discard[st.discard.length - 1] ?? "",
        pileCount: st.discard.length,
        color: st.color,
        turn: st.turn,
        dir: st.dir,
        counts,
        unoCalled: called,
      },
    };
  }
  const st = s.state as ChessState;
  return {
    ...base,
    game: "chess" as const,
    chess: {
      board: st.board,
      turn: st.turn,
      castling: st.castling,
      ep: st.ep,
      last: st.last,
      check: inCheck(st.board, st.turn),
    },
  };
}

export type GameSessionView = ReturnType<typeof view>;

/* ====================================================================== *
 *  QUERIES
 * ====================================================================== */

export const session = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    return s ? view(s) : null;
  },
});

/** Hand UNO milik sendiri saja. */
export const myHand = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }): Promise<string[]> => {
    const userId = await me(ctx);
    if (!userId) return [];
    const s = await ctx.db.get(sessionId);
    if (!s || s.game !== "uno") return [];
    const st = s.state as UnoState;
    return st.hands[userId] ?? [];
  },
});

/** Langkah legal untuk satu petak catur (untuk highlight di papan). */
export const legalFor = query({
  args: {
    sessionId: v.id("gameSessions"),
    from: v.number(),
  },
  handler: async (ctx, { sessionId, from }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.game !== "chess" || s.status !== "playing") return [];
    return legalMoves(s.state as ChessState, from);
  },
});

/** Undangan game pending untuk saya (dipakai banner di voice room). */
export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await me(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("gameInvites")
      .withIndex("by_to_status", (q) =>
        q.eq("toUserId", userId).eq("status", "pending"),
      )
      .collect();
    const out = [];
    for (const r of rows) {
      const from = await ctx.db.get(r.fromUserId);
      const room = await ctx.db.get(r.roomId);
      const s = await ctx.db.get(r.sessionId);
      if (!s || s.status === "done") continue;
      out.push({
        inviteId: r._id,
        sessionId: r.sessionId,
        roomId: r.roomId,
        game: r.game,
        fromUsername: from?.username ?? "user",
        fromImage: from?.image,
        roomName: room?.name ?? "Room",
        players: s.players.length,
        seats: s.seats,
        // Daftar pemain yang sudah bergabung — ditampilkan di banner
        // "Mengajak bermain" di voice room.
        playerList: s.players.map((p) => ({
          username: p.username,
          image: p.image,
        })),
      });
    }
    return out;
  },
});

/* ====================================================================== *
 *  MUTATIONS
 * ====================================================================== */

export const createSession = mutation({
  args: {
    roomId: v.id("voiceRooms"),
    game: v.union(
      v.literal("uno"),
      v.literal("chess"),
      v.literal("snakes"),
    ),
    /** Jumlah kursi yang dipilih host (2..max game). Catur selalu 2. */
    seats: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, game, seats: wanted }) => {
    const userId = await me(ctx);
    if (!userId) throw new Error("Login dulu ya");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room tidak ada");
    if (room.ownerId !== userId)
      throw new Error("Cuma host room yang boleh buat game");
    if (!room.members?.some((m) => m.userId === userId))
      throw new Error("Kamu bukan member room");

    // Satu sesi aktif per room — kalau masih ada, pakai itu.
    const existing = await ctx.db
      .query("gameSessions")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
    if (existing && existing.status !== "done") return existing._id;

    const user = await ctx.db.get(userId);
    // UNO / Ular Tangga / Ludo maksimal 4 kursi, Catur 2 — host boleh
    // memilih lebih sedikit (mis. 2) supaya permainan cepat mulai.
    const maxSeats = game === "chess" ? 2 : 4;
    const seats =
      game === "chess"
        ? 2
        : Math.min(maxSeats, Math.max(2, Math.round(wanted ?? maxSeats)));
    const now = Date.now();
    const sessionId = await ctx.db.insert("gameSessions", {
      roomId,
      hostId: userId,
      game,
      seats,
      players: [
        {
          userId,
          username: user?.username ?? "user",
          image: user?.image,
          seat: 0,
        },
      ],
      status: "lobby",
      state: null,
      createdAt: now,
      updatedAt: now,
    });
    // Siapkan state LOBBY segera — `view()` membaca state untuk kartu lobby,
    // dan state null membuat query melempar error (klien crash / terpental
    // ke home). State asli disiapkan ulang oleh `startGame` saat kursi penuh.
    const doc = await ctx.db.get(sessionId);
    if (doc) {
      const preview =
        game === "uno"
          ? startUno(doc)
          : game === "snakes"
            ? startSnakes(orderOf(doc.players))
            : startChess();
      await ctx.db.patch(sessionId, { state: preview, updatedAt: Date.now() });
    }
    return sessionId;
  },
});

/** Host mengundang SEMUA member room lain untuk join game. */
export const inviteAll = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await me(ctx);
    if (!userId) throw new Error("Login dulu ya");
    const s = await ctx.db.get(sessionId);
    if (!s) throw new Error("Sesi tidak ada");
    if (s.hostId !== userId) throw new Error("Cuma host yang boleh mengundang");
    if (s.status !== "lobby") throw new Error("Game sudah jalan");
    const room = await ctx.db.get(s.roomId);
    if (!room) throw new Error("Room tidak ada");

    let count = 0;
    const now = Date.now();
    for (const m of room.members ?? []) {
      if (s.players.some((p) => p.userId === m.userId)) continue;
      if (m.userId === userId) continue;
      // hindari spam undangan dobel
      const already = await ctx.db
        .query("gameInvites")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
      if (already.some((i) => i.toUserId === m.userId && i.status === "pending"))
        continue;
      await ctx.db.insert("gameInvites", {
        sessionId,
        roomId: s.roomId,
        game: s.game,
        fromUserId: userId,
        toUserId: m.userId,
        status: "pending",
        updatedAt: now,
      });
      count++;
    }
    return count;
  },
});

/** Terima / tolak undangan. Join penuh (4/4 atau 2/2) → game mulai. */
export const respond = mutation({
  args: {
    inviteId: v.id("gameInvites"),
    accept: v.boolean(),
  },
  handler: async (ctx, { inviteId, accept }) => {
    const userId = await me(ctx);
    if (!userId) throw new Error("Login dulu ya");
    const inv = await ctx.db.get(inviteId);
    if (!inv || inv.toUserId !== userId) throw new Error("Undangan tidak ada");
    if (inv.status !== "pending") throw new Error("Undangan sudah dipakai");
    const s = await ctx.db.get(inv.sessionId);
    if (!s || s.status === "done") {
      await ctx.db.patch(inviteId, { status: "declined", updatedAt: Date.now() });
      throw new Error("Game sudah selesai");
    }
    if (!accept) {
      await ctx.db.patch(inviteId, { status: "declined", updatedAt: Date.now() });
      return { started: false };
    }
    if (s.status !== "lobby") throw new Error("Game sudah mulai");
    if (s.players.length >= s.seats) throw new Error("Kursi game sudah penuh");
    if (s.players.some((p) => p.userId === userId)) {
      await ctx.db.patch(inviteId, { status: "joined", updatedAt: Date.now() });
      return { started: false };
    }
    const user = await ctx.db.get(userId);
    const seat = Math.max(...s.players.map((p) => p.seat)) + 1;
    const players = [
      ...s.players,
      {
        userId,
        username: user?.username ?? "user",
        image: user?.image,
        seat,
      },
    ];
    await ctx.db.patch(inviteId, { status: "joined", updatedAt: Date.now() });
    await ctx.db.patch(s._id, { players, updatedAt: Date.now() });

    if (players.length >= s.seats) await startGame(ctx, s._id);
    return { started: players.length >= s.seats };
  },
});

/** Mulai permainan: tutup undangan sisa, siapkan state. */
async function startGame(
  ctx: MutationCtx,
  sessionId: Id<"gameSessions">,
): Promise<void> {
  const s = await ctx.db.get(sessionId);
  if (!s || s.status !== "lobby") return;
  const state =
    s.game === "uno"
      ? startUno(s)
      : s.game === "snakes"
        ? startSnakes(orderOf(s.players))
        : startChess();
  await ctx.db.patch(sessionId, {
    status: "playing",
    state,
    updatedAt: Date.now(),
  });
  // Undangan pending lain kedaluwarsa — kursi sudah terisi.
  const invites = await ctx.db
    .query("gameInvites")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const i of invites)
    if (i.status === "pending")
      await ctx.db.patch(i._id, { status: "declined", updatedAt: Date.now() });
}

export const leave = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    const players = s.players.filter((p) => p.userId !== userId);
    if (s.status === "playing") {
      if (s.game === "chess" && players.length === 1) {
        await ctx.db.patch(sessionId, {
          players,
          status: "done",
          winnerId: players[0].userId,
          updatedAt: Date.now(),
        });
        return;
      }
      if (players.length < 2) {
        await ctx.db.patch(sessionId, {
          players,
          status: "done",
          updatedAt: Date.now(),
        });
        return;
      }
      // Lanjut tanpa yang keluar (giliran dilewati lewat orderOf).
      await ctx.db.patch(sessionId, { players, updatedAt: Date.now() });
      if (s.game === "snakes") {
        const st = s.state as SnakesState;
        const order = orderOf(players);
        if (st.turn === userId && order.length) st.turn = order[0];
        await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
        return;
      }
      if (s.game === "uno") {
        const st = s.state as UnoState;
        if (st.turn === userId) nextTurn(st, orderOf(players));
        await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
      }
      return;
    }
    await ctx.db.patch(sessionId, { players, updatedAt: Date.now() });
  },
});

/* ------------------------------ UNO ---------------------------------- */

function requireUnoTurn(
  s: Doc<"gameSessions">,
  userId: Doc<"users">["_id"],
): UnoState {
  if (s.status !== "playing") throw new Error("Game belum mulai");
  const st = s.state as UnoState;
  if (st.turn !== userId) throw new Error("Bukan giliranmu");
  return st;
}

export const drawCard = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "uno") throw new Error("Bukan UNO");
    const st = requireUnoTurn(s, userId);
    drawCards(st, userId, 1);
    await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
  },
});

export const passTurn = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "uno") throw new Error("Bukan UNO");
    const st = requireUnoTurn(s, userId);
    nextTurn(st, orderOf(s.players));
    await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
  },
});

export const playCard = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    index: v.number(),
    color: v.optional(
      v.union(v.literal("r"), v.literal("g"), v.literal("b"), v.literal("y")),
    ),
  },
  handler: async (ctx, { sessionId, index, color }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "uno") throw new Error("Bukan UNO");
    const st = requireUnoTurn(s, userId);
    const hand = st.hands[userId] ?? [];
    const card = hand[index];
    if (!card) throw new Error("Kartu tidak ada di tanganmu");
    const top = st.discard[st.discard.length - 1];
    if (!canPlay(card, top, st.color)) throw new Error("Kartu itu belum bisa dibuang");

    hand.splice(index, 1);
    st.hands[userId] = hand;
    st.discard.push(card);
    if (isWild(card)) st.color = color ?? "r";
    else st.color = card[0];

    const order = orderOf(s.players);
    const value = card.slice(1);
    let steps = 1;
    if (value === "r") st.dir = (st.dir * -1) as 1 | -1;
    if (value === "s") steps = 2;
    if (value === "2" || card === "w4") {
      // korban menarik 2/4 lalu giliran dilewati
      const victimI = (order.indexOf(st.turn) + st.dir + order.length) % order.length;
      const victim = order[victimI];
      drawCards(st, victim, value === "2" ? 2 : 4);
      st.unoCalled[victim] = true;
      nextTurn(st, order, 2);
      steps = 0;
    }
    if (steps === 1 || steps === 2) nextTurn(st, order, steps);

    // Sanksi UNO: pemain lain yang tinggal 1 kartu tapi belum woof "UNO!"
    // (diberlakukan saat ada yang BERIKUTNYA buang kartu — jadi masih sempat
    // menekan tombol UNO setelah turun ke 1 kartu).
    for (const uid of order) {
      if (uid === userId) continue;
      if ((st.hands[uid]?.length ?? 0) === 1 && !st.unoCalled[uid]) {
        drawCards(st, uid, 2);
        st.unoCalled[uid] = true;
      }
    }

    if (hand.length === 0) {
      await ctx.db.patch(sessionId, {
        state: st,
        status: "done",
        winnerId: userId,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
  },
});

export const shoutUno = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "uno") throw new Error("Bukan UNO");
    const st = s.state as UnoState;
    if ((st.hands[userId]?.length ?? 0) !== 1)
      throw new Error("UNO cuma boleh saat sisa 1 kartu");
    st.unoCalled[userId] = true;
    await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
  },
});

/* ------------------------------ CATUR -------------------------------- */

export const chessMove = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, { sessionId, from, to }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "chess") throw new Error("Bukan Catur");
    if (s.status !== "playing") throw new Error("Game belum mulai");
    const st = s.state as ChessState;
    const color = myColor(s, userId);
    if (!color) throw new Error("Kamu bukan pemain catur");
    if (st.turn !== color) throw new Error("Bukan giliranmu");
    if (!legalMoves(st, from).includes(to))
      throw new Error("Langkah itu tidak legal");

    const nxt = applyMove(st, from, to);
    const opp = nxt.turn;
    if (!sideHasMove(nxt, opp)) {
      await ctx.db.patch(sessionId, {
        state: nxt,
        status: "done",
        ...(inCheck(nxt.board, opp)
          ? { winnerId: userId }
          : { winnerId: undefined }),
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(sessionId, { state: nxt, updatedAt: Date.now() });
  },
});

/** Lempar dadu — Ular Tangga. */
export const snakesRoll = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    if (s.game !== "snakes") throw new Error("Bukan Ular Tangga");
    if (s.status !== "playing") throw new Error("Game belum mulai");
    const st = s.state as SnakesState;
    if (st.turn !== userId) throw new Error("Bukan giliranmu");

    const roll = 1 + Math.floor(Math.random() * 6);
    const cur = st.pos[userId] ?? 0;
    let next = cur + roll;
    // Harus PAS di 100 — kalau lebih, tetap di tempat.
    if (next > 100) next = cur;
    // Naik tangga / turun ular.
    if (LADDERS[next]) next = LADDERS[next];
    else if (SNAKES[next]) next = SNAKES[next];

    st.pos[userId] = next;
    st.lastRoll = roll;
    st.lastBy = userId;

    if (next === 100) {
      await ctx.db.patch(sessionId, {
        state: st,
        status: "done",
        winnerId: userId,
        updatedAt: Date.now(),
      });
      return;
    }
    const order = orderOf(s.players);
    const i = order.indexOf(userId);
    if (i >= 0 && order.length) st.turn = order[(i + 1) % order.length];
    await ctx.db.patch(sessionId, { state: st, updatedAt: Date.now() });
  },
});

export const resign = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const { s, userId } = await requirePlayer(ctx, sessionId);
    const other = s.players.find((p) => p.userId !== userId);
    await ctx.db.patch(sessionId, {
      status: "done",
      winnerId: other?.userId,
      updatedAt: Date.now(),
    });
  },
});

/** Keadaan singkat untuk layar lobby (dipakai saat overlay dibuka ulang). */
export const activeInRoom = query({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const s = await ctx.db
      .query("gameSessions")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
    if (!s || s.status === "done") return null;
    return { sessionId: s._id, game: s.game, status: s.status };
  },
});
