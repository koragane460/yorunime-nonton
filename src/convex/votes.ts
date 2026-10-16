// YoruNime — Voting karakter anime.
//
// Alur:
//  * Developer menekan "Mulai vote" di Panel Developer → satu event dibuat
//    dengan durasi 7 hari.
//  * Selama event berjalan, layar Vote (detail anime) menampilkan karakter
//    anime itu dan user bisa vote pakai Token Vote (T-V).
//  * T-V didapat dari total menit nonton: 4 menit = 2 T-V (floor(menit / 2)).
//    Saldo = hasil konversi − T-V yang sudah dibuang (users.voteSpent).
//  * Lewat 7 hari event selesai → Koleksi menampilkan "TOP VOTE CHARACTER
//    ANIME" (top 10 kandidat dengan vote terbanyak).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** Durasi satu putaran voting: 7 hari. */
const VOTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
/** Konversi menit nonton → T-V: 4 menit = 2 T-V → 1 menit = 0.5 T-V. */
const MINUTES_PER_TV = 2;

type EventRow = Doc<"voteEvents">;

/** Event terbaru (apapun statusnya berdasarkan waktu). */
async function latestEvent(ctx: any): Promise<EventRow | null> {
  // Urutan TURUN dilakukan lewat `.order("desc")` — fungsi range index hanya
  // boleh eq/gt/gte/lt/lte, memanggil q.desc() di dalam withIndex membuat
  // query melempar Server Error saat runtime (dulu bikin layar Vote & Koleksi
  // crash padahal datanya hanya "belum dimulai").
  return (await ctx.db
    .query("voteEvents")
    .withIndex("by_startedAt", (q: any) => q)
    .order("desc")
    .first()) as EventRow | null;
}

/** Status event terbaru dilihat dari waktu sekarang (bukan kolom status). */
function stateOf(e: EventRow | null, now: number): "none" | "active" | "ended" {
  if (!e) return "none";
  return now < e.endsAt ? "active" : "ended";
}

/** Saldo T-V user = floor(totalMenitNonton / 2) − yang sudah dibuang. */
async function tokenBalance(ctx: any, userId: Id<"users">, user: Doc<"users">) {
  const history = await ctx.db
    .query("watchHistory")
    .withIndex("userId_updated", (q: any) => q.eq("userId", userId))
    .collect();
  const minutes = history.reduce(
    (s: number, h: any) => s + (h.minutesWatched ?? 0),
    0,
  );
  const earned = Math.floor(minutes / MINUTES_PER_TV);
  const spent = user.voteSpent ?? 0;
  return { minutes, earned, spent, balance: Math.max(0, earned - spent) };
}

async function devOnly(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Belum masuk akun");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("Akun tidak ditemukan");
  const role = String(me.staffRole ?? "").toLowerCase();
  const isDev =
    role === "dev" || role === "creator" || Number(me.seqId ?? 0) === 1;
  if (!isDev) throw new Error("Hanya developer");
  return userId;
}

/** Status voting untuk semua layar: belum dimulai / berjalan / selesai. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const e = await latestEvent(ctx);
    const now = Date.now();
    const state = stateOf(e, now);
    return {
      state,
      endsAt: e?.endsAt ?? 0,
      startedAt: e?.startedAt ?? 0,
      msLeft: state === "active" ? Math.max(0, e!.endsAt - now) : 0,
      topReady: state === "ended",
    };
  },
});

/** Mulai voting — hanya developer. Durasi 7 hari. */
export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const devId = await devOnly(ctx);
    const now = Date.now();
    const e = await latestEvent(ctx);
    if (e && now < e.endsAt) {
      throw new Error(
        `Vote masih berjalan (${Math.ceil((e.endsAt - now) / 86_400_000)} hari lagi)`,
      );
    }
    await ctx.db.insert("voteEvents", {
      startedAt: now,
      endsAt: now + VOTE_DURATION_MS,
      startedBy: devId,
    });
    return { ok: true, endsAt: now + VOTE_DURATION_MS };
  },
});

/**
 * Daftar kandidat untuk anime ini — dipanggil layar Vote saat event aktif.
 * Karakter yang belum ada disisipkan dengan 0 vote; yang sudah ada dibiarkan
 * (termasuk gambar yang mungkin diperbarui).
 */
export const ensureCandidates = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    characters: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        image: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { animeId, animeTitle, characters }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false, reason: "login" };
    const e = await latestEvent(ctx);
    if (!e || Date.now() >= e.endsAt) return { ok: false, reason: "inactive" };

    const existing = await ctx.db
      .query("voteCandidates")
      .withIndex("by_event", (q) => q.eq("eventId", e._id))
      .collect();
    const have = new Set(existing.map((c) => c.characterId));

    let added = 0;
    // Batasi supaya satu anime tidak menambah ratusan baris sekaligus.
    for (const c of characters.slice(0, 40)) {
      if (!c?.id || have.has(c.id)) continue;
      have.add(c.id);
      await ctx.db.insert("voteCandidates", {
        eventId: e._id,
        animeId,
        animeTitle,
        characterId: c.id,
        name: c.name,
        image: c.image,
        votes: 0,
      });
      added += 1;
    }
    return { ok: true, added };
  },
});

/** Papan vote untuk satu anime (event berjalan) + saldo T-V user. */
export const board = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const e = await latestEvent(ctx);
    if (!e || now >= e.endsAt) {
      return { state: stateOf(e, now) as string, items: [], tokens: null };
    }
    const rows = (await ctx.db
      .query("voteCandidates")
      .withIndex("by_event", (q) => q.eq("eventId", e._id))
      .collect()) as Doc<"voteCandidates">[];
    const items = rows
      .filter((c) => c.animeId === animeId)
      .sort((a, b) => b.votes - a.votes)
      .map((c) => ({
        characterId: c.characterId,
        name: c.name,
        image: c.image,
        animeTitle: c.animeTitle,
        votes: c.votes,
      }));

    let tokens = null;
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user) tokens = await tokenBalance(ctx, userId, user);
    }
    return { state: "active" as string, endsAt: e.endsAt, items, tokens };
  },
});

/** Tukar menit nonton jadi vote: tambah vote kandidat, buang T-V. */
export const castVote = mutation({
  args: {
    characterId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, { characterId, amount }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    if (!Number.isFinite(amount) || amount < 1 || amount % 1 !== 0)
      throw new Error("Jumlah vote tidak valid");

    const now = Date.now();
    const e = await latestEvent(ctx);
    if (!e || now >= e.endsAt) throw new Error("Vote sudah selesai");

    const cand = await ctx.db
      .query("voteCandidates")
      .withIndex("by_event_char", (q) =>
        q.eq("eventId", e._id).eq("characterId", characterId),
      )
      .first();
    if (!cand) throw new Error("Karakter tidak ditemukan");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Akun tidak ditemukan");
    const tok = await tokenBalance(ctx, userId, user);
    if (amount > tok.balance)
      throw new Error(
        `Token Vote kurang — saldo kamu ${tok.balance} T-V (4 menit nonton = 2 T-V)`,
      );

    await ctx.db.patch(cand._id, { votes: cand.votes + amount });
    await ctx.db.patch(userId, { voteSpent: (user.voteSpent ?? 0) + amount });
    return {
      ok: true,
      votes: cand.votes + amount,
      balance: tok.balance - amount,
    };
  },
});

/** Top 10 karakter dengan vote terbanyak — untuk Koleksi setelah selesai. */
export const topCharacters = query({
  args: {},
  handler: async (ctx) => {
    const e = await latestEvent(ctx);
    const now = Date.now();
    if (!e || now < e.endsAt) return { ready: false as const, items: [] };
    const rows = (await ctx.db
      .query("voteCandidates")
      .withIndex("by_event", (q) => q.eq("eventId", e._id))
      .collect()) as Doc<"voteCandidates">[];
    const items = rows
      .slice()
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10)
      .map((c, i) => ({
        rank: i + 1,
        name: c.name,
        image: c.image,
        animeTitle: c.animeTitle,
        votes: c.votes,
      }));
    return { ready: items.length > 0, items, endsAt: e.endsAt };
  },
});
