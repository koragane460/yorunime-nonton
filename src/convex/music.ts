// LUNA BOT 24/7 — bot musik resmi YoruNime untuk chat di voice room.
//
// Semua command diawali DAN diakhiri tanda seru: !play judul lagu!,
// !help!, !skip!, !q!, dst. Command diproses oleh action `luna` (boleh
// fetch API musik luar — iTunes Search API, CORS-free & tanpa API key),
// lalu hasilnya ditulis ke chat sebagai pesan bot (bot: true) dan state
// antrian disimpan di tabel voiceMusic.
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

type Track = {
  id: string;
  title: string;
  artist: string;
  art: string;
  preview: string;
  durationMs: number;
  /** Video YouTube untuk lagu PENUH (bukan preview 30 detik). */
  videoId?: string;
};

/**
 * Bentuk track seragam untuk layar Musik / pemutar / stories.
 * (`source` & `kind` dipertahankan seperti katalog lama: "archive" +
 * "penuh"/"potongan" untuk track tersimpan, "itunes" untuk hasil live.)
 */
export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  durationSec: number;
  source: string;
  kind: string;
  videoId?: string;
};

/**
 * Saring hasil pencarian archive/katalog: simpan track yang judul,
 * penyanyi, atau albumnya memuat minimal satu kata kueri (kata < 3 huruf
 * diabaikan supaya tidak jadi pengecoh). Pencocokan tanpa memperdulikan
 * huruf besar-kecil dan tanda baca.
 */
export function relevant(list: MusicTrack[], q: string): MusicTrack[] {
  const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const words = (q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter((w) => w.length >= 3);
  if (words.length === 0) return list;
  return list.filter((t) => {
    const hay = norm(`${t.title} ${t.artist} ${t.album ?? ""}`);
    return words.some((w) => hay.includes(w));
  });
}

/** Peta section katalog layar Musik → kueri iTunes. */
const SECTION_QUERIES: Record<string, string> = {
  anime: "anime opening theme song",
  ost: "anime opening",
  ostpenuh: "anime ending full",
  full: "official full song",
  jpop: "j-pop hits",
  indo: "lagu indonesia pop",
  dangdut: "dangdut",
  lofi: "lofi chill beats",
};

const SECTION_LIST: { id: string; label: string }[] = [
  { id: "anime", label: "Anime & OST" },
  { id: "ost", label: "Opening & Ending" },
  { id: "ostpenuh", label: "OST Penuh" },
  { id: "full", label: "Trek Penuh" },
  { id: "jpop", label: "J-Pop & K-Pop" },
  { id: "indo", label: "Lagu Indonesia" },
  { id: "dangdut", label: "Dangdut" },
  { id: "lofi", label: "Lofi & Chill" },
];

/** iTunes → MusicTrack[] (audio = pratinjau 30 detik yang bisa diputar). */
function toTracks(results: Record<string, unknown>[]): MusicTrack[] {
  return results
    .filter((r) => r.previewUrl || r.trackViewUrl)
    .map((r) => ({
      id: String(r.trackId ?? r.collectionId ?? Math.random()),
      title: String(r.trackName ?? "Unknown Title"),
      artist: String(r.artistName ?? "Unknown Artist"),
      album: String(r.collectionName ?? ""),
      cover: String(r.artworkUrl100 ?? "").replace("100x100", "400x400"),
      audioUrl: String(r.previewUrl ?? ""),
      durationSec: Math.round(Number(r.trackTimeMillis ?? 30000) / 1000),
      source: "itunes",
      kind: "potongan",
    }));
}

async function itunesSearch(q: string, limit: number): Promise<MusicTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API musik tidak merespons");
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  return toTracks(json.results ?? []);
}

/** Cari lagu (layar Musik & stories). */
export const musicSearch = action({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, { q, limit = 24 }): Promise<MusicTrack[]> => {
    const list = await itunesSearch(q, limit);
    return relevant(list, q);
  },
});

/** Daftar baris katalog layar Musik (satu sumber kebenaran). */
export const musicSections = action({
  args: {},
  handler: async (): Promise<{ id: string; label: string }[]> => SECTION_LIST,
});

/** Isi satu baris katalog. */
export const musicSection = action({
  args: { section: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, { section, limit = 12 }): Promise<{ tracks: MusicTrack[] }> => {
    const q = SECTION_QUERIES[section] ?? section;
    try {
      return { tracks: await itunesSearch(q, limit) };
    } catch {
      return { tracks: [] };
    }
  },
});

/** Lirik tersinkron dari LRCLIB (gratis, tanpa API key). */
export const lyrics = action({
  args: {
    artist: v.string(),
    track: v.string(),
    durationSec: v.optional(v.number()),
  },
  handler: async (
    _ctx,
    { artist, track, durationSec },
  ): Promise<{
    synced: { t: number; text: string }[] | null;
    plain: string[] | null;
  }> => {
    try {
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}`;
      const res = await fetch(url, { headers: { "User-Agent": "YoruNime/1.0" } });
      if (!res.ok) return { synced: null, plain: null };
      const rows = (await res.json()) as {
        syncedLyrics?: string | null;
        plainLyrics?: string | null;
        duration?: number;
      }[];
      if (!Array.isArray(rows) || rows.length === 0)
        return { synced: null, plain: null };
      // Pilih versi yang durasinya paling mendekati lagu yang diputar.
      const target = durationSec ?? 0;
      const pick = target
        ? rows.reduce((a, b) =>
            Math.abs((a.duration ?? 0) - target) <=
            Math.abs((b.duration ?? 0) - target)
              ? a
              : b,
          )
        : rows[0]!;
      const plain = pick.plainLyrics
        ? pick.plainLyrics.split("\n").filter((l) => l.trim().length > 0)
        : null;
      const synced = pick.syncedLyrics
        ? pick.syncedLyrics
            .split("\n")
            .map((l) => {
              const m = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/.exec(
                l.trim(),
              );
              if (!m) return null;
              const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) / 1000 : 0;
              return {
                t: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac,
                text: m[4] ?? "",
              };
            })
            .filter((l): l is { t: number; text: string } => l !== null)
        : null;
      return { synced: synced && synced.length > 0 ? synced : null, plain };
    } catch {
      return { synced: null, plain: null };
    }
  },
});

/**
 * Cari video YouTube untuk lagu penuh (pemutar tetap milik YoruNime).
 * Tanpa API key: ambil halaman hasil pencarian YouTube dari server lalu
 * ambil videoId pertama dari JSON yang disisipkan YouTube.
 */
/** Cari videoId YouTube (dipakai action publik & alur !play Luna Bot). */
async function findYouTubeId(q: string, remix = false): Promise<string | null> {
  try {
    const term = remix ? `${q} remix` : q;
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`,
      { headers: { "Accept-Language": "en-US,en;q=0.9" } },
    );
    if (!res.ok) return null;
    const html = await res.text();
    const m = /"videoId":"([A-Za-z0-9_-]{11})"/.exec(html);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export const youtubeFind = action({
  args: { q: v.string(), remix: v.optional(v.boolean()) },
  handler: async (_ctx, { q, remix }): Promise<{ videoId: string | null }> => ({
    videoId: await findYouTubeId(q, !!remix),
  }),
});

type MusicState = {
  _id: Id<"voiceMusic">;
  roomId: Id<"voiceRooms">;
  current?: Track & { by: string; startedAt: number; posMs: number };
  queue: { track: Track; by: string }[];
  botInRoom: boolean;
  paused: boolean;
  volume: number;
  fx: string;
  last?: Track;
};

const BOT_NAME = "Luna Bot 24/7";

const HELP_TEXT = `LUNA BOT MUSIK 🎶🎵
 • MUSIK
  !play <judul>   - play lagu
  !skip           - skip
  !stop           - stop
  !queue          - antrian
  !np             - now playing
  !pause/resume   - jeda/lanjut

• AUDIO 
  !bassboost, !nightcore, !8d, !volume

• INFO
  !help, !ping, !invite`;

/** "03:42" dari milidetik. */
function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Posisi main sekarang (ms) — berguna untuk pesan pause/resume. */
function posOf(st: MusicState) {
  const c = st.current;
  if (!c) return 0;
  if (st.paused) return c.posMs;
  return Math.min(c.durationMs, c.posMs + (Date.now() - c.startedAt));
}

/** Cari lagu lewat iTunes Search API (butuh fetch → action, bukan mutation). */
async function searchTracks(q: string, limit = 5): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API musik tidak merespons");
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  return (json.results ?? []).map((r) => ({
    id: String(r.trackId ?? r.collectionId ?? Math.random()),
    title: String(r.trackName ?? "Unknown Title"),
    artist: String(r.artistName ?? "Unknown Artist"),
    art: String(r.artworkUrl100 ?? "").replace("100x100", "400x400"),
    preview: String(r.previewUrl ?? ""),
    durationMs: Number(r.trackTimeMillis ?? 30000),
  }));
}

// ------------------------------------------------------------- store ----

async function getState(
  ctx: QueryCtx,
  roomId: Id<"voiceRooms">,
): Promise<MusicState | null> {
  return (await ctx.db
    .query("voiceMusic")
    .withIndex("roomId", (q) => q.eq("roomId", roomId))
    .first()) as MusicState | null;
}

async function ensureState(ctx: MutationCtx, roomId: Id<"voiceRooms">) {
  const cur = await getState(ctx, roomId);
  if (cur) return cur;
  const id = await ctx.db.insert("voiceMusic", {
    roomId,
    queue: [],
    botInRoom: false,
    paused: false,
    volume: 80,
    fx: "off",
  });
  return (await ctx.db.get(id)) as MusicState;
}

export const getStateQ = internalQuery({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => getState(ctx, roomId),
});

/** Tulis pesan bot ke chat voice (dari pembawa command — tampil sebagai
    pesan biasa, dirender khusus oleh klien karena bot: true). */
export const postBot = internalMutation({
  args: {
    roomId: v.id("voiceRooms"),
    userId: v.id("users"),
    text: v.string(),
    botData: v.optional(v.any()),
  },
  handler: async (ctx, { roomId, userId, text, botData }) => {
    const doc: Record<string, unknown> = {
      kind: "voice",
      dmKey: `voice:${roomId}`,
      userId,
      text,
      bot: true,
      createdAt: Date.now(),
    };
    if (botData !== undefined) doc.botData = botData;
    return await ctx.db.insert("chatMessages", doc as never);
  },
});

/** Simpan/ubah state antrian musik room. */
export const saveState = internalMutation({
  args: {
    roomId: v.id("voiceRooms"),
    patch: v.any(),
  },
  handler: async (ctx, { roomId, patch }) => {
    const st = await ensureState(ctx, roomId);
    await ctx.db.patch(st._id, patch);
  },
});

/** Tambahkan Luna Bot ke room saat !invite! (member palsu? tidak — hanya
    flag botInRoom, avatar bot tampil di kartu pesan). */
export const botJoin = internalMutation({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const st = await ensureState(ctx, roomId);
    await ctx.db.patch(st._id, { botInRoom: true });
  },
});

// ------------------------------------------------------------ action ----

/** Lagu selesai diputar di klien → lanjut antrian, atau Luna bilang habis. */
export const lunaEnded = action({
  args: { roomId: v.id("voiceRooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const st = (await ctx.runQuery(internal.music.getStateQ, {
      roomId,
    })) as MusicState | null;
    const save = (patch: Record<string, unknown>) =>
      ctx.runMutation(internal.music.saveState, { roomId, patch });
    const post = (t: string, botData?: unknown) =>
      ctx.runMutation(internal.music.postBot, {
        roomId,
        userId,
        text: t,
        botData,
      });
    const queue = st?.queue ?? [];
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      const started = {
        ...next.track,
        by: next.by,
        startedAt: Date.now(),
        posMs: 0,
      };
      await save({ current: started, queue: rest, paused: false });
      await post(
        `▶️ Lanjut antrian\n🎶 Judul: ${next.track.title}\n⏱️ Durasi: ${fmt(next.track.durationMs)}\n👤 Request by: @${next.by}\n\n| Sisa antrean: ${rest.length} • Volume: ${st?.volume ?? 80}% |`,
        { kind: "np", track: next.track, volume: st?.volume ?? 80, by: next.by },
      );
      return;
    }
    if (st?.current) {
      await save({ current: null, last: st.current, paused: false });
    }
    await post(
      "🎵 Lagu selesai — tidak ada lagi di antrean.\n• Ketik !play <judul>! untuk tambah lagu lagi.",
    );
  },
});

export const luna = action({
  args: {
    roomId: v.id("voiceRooms"),
    text: v.string(),
    userId: v.id("users"),
    username: v.string(),
  },
  handler: async (ctx, { roomId, text, userId, username }) => {
    const raw = text.trim();
    // Command HARUS diawali dan diakhiri tanda seru.
    if (raw.length < 3 || !raw.startsWith("!") || !raw.endsWith("!")) return;
    const inner = raw.slice(1, -1).trim();
    const sp = inner.indexOf(" ");
    const cmd = (sp < 0 ? inner : inner.slice(0, sp)).toLowerCase();
    const args = sp < 0 ? "" : inner.slice(sp + 1).trim();

    const post = (t: string, botData?: unknown) =>
      ctx.runMutation(internal.music.postBot, {
        roomId,
        userId,
        text: t,
        botData,
      });
    const save = (patch: Record<string, unknown>) =>
      ctx.runMutation(internal.music.saveState, { roomId, patch });
    const st = (await ctx.runQuery(internal.music.getStateQ, {
      roomId,
    })) as MusicState | null;
    const cur = st?.current;

    const reqBy = `@${username}`;

    switch (cmd) {
      case "help": {
        await post(HELP_TEXT);
        return;
      }
      case "ping": {
        const ms = 20 + Math.floor(Math.random() * 40);
        await post(`🏓 Pong! • ${ms}ms\nBot: ${BOT_NAME} siap melayani 🎵`);
        return;
      }
      case "invite": {
        // Bot masuk room + tampilkan daftar musik yang bisa diputar.
        await ctx.runMutation(internal.music.botJoin, { roomId });
        let list: Track[] = [];
        try {
          list = await searchTracks("lagu pop terpopuler", 6);
        } catch {
          list = [];
        }
        const daftar = list.length
          ? list
              .map((t, i) => `${String(i + 1).padStart(2, "0")}. ${t.title} — ${t.artist}`)
              .join("\n")
          : "(daftar musik sedang tidak tersedia — coba lagi)";
        await post(
          `🎧 Luna Bot masuk ke voice room\n✨ ${BOT_NAME} terhubung • siap memutar musik\n\n🎵 DAFTAR MUSIK\n${daftar}\n\nKetik !play <judul>! untuk memutar.`,
        );
        return;
      }
      case "play": {
        let track: Track | null = null;
        try {
          const found = await searchTracks(
            args || "DJ Remix Full Bass 2024",
            1,
          );
          track = found[0] ?? null;
        } catch {
          track = null;
        }
        if (!track) {
          await post(`🔎 Tidak menemukan "${args || "lagu"}" — coba judul lain.`);
          return;
        }
        // Lagu PENUH via YouTube (bukan preview 30 detik) — kalau ketemu.
        try {
          const yt = await findYouTubeId(`${track.artist} ${track.title}`);
          if (yt) track = { ...track, videoId: yt };
        } catch {
          /* tetap pakai preview Apple Music */
        }
        // Bot otomatis masuk room saat dipanggil play.
        if (!st?.botInRoom) await ctx.runMutation(internal.music.botJoin, { roomId });

        if (!cur) {
          const started = {
            ...track,
            by: username,
            startedAt: Date.now(),
            posMs: 0,
          };
          await save({ current: started, paused: false });
          await post(
            `🌸 Memutar\n🎶 Judul: ${track.title}\n⏱️ Durasi: ${fmt(track.durationMs)}\n👤 Request by: ${reqBy}\n🔗 Sumber: Apple Music\n\n| Antrian: #1 • Volume: ${st?.volume ?? 80}% |`,
            { kind: "np", track, volume: st?.volume ?? 80, by: username },
          );
        } else {
          const queue = [...(st?.queue ?? []), { track, by: username }];
          await save({ queue });
          await post(
            `➕ Ditambahkan ke antrian\n🎶 Judul: ${track.title}\n📍 Posisi: #${queue.length} di antrian\n👤 Request by: ${reqBy}`,
          );
        }
        return;
      }
      case "np": {
        if (!cur) {
          await post("🔇 Tidak ada musik yang diputar — ketik !play <judul>!");
          return;
        }
        await post(
          `🎶 Now Playing\n   ${cur.title} — ${cur.artist}\n⏱️ ${fmt(posOf(st!))} / ${fmt(cur.durationMs)} • Volume: ${st?.volume ?? 80}%`,
          { kind: "np", track: cur, volume: st?.volume ?? 80, by: cur.by },
        );
        return;
      }
      case "skip": {
        const queue = st?.queue ?? [];
        if (!cur && queue.length === 0) {
          await post("⏭️ Skipped  - Antrian kosong\n• Gunakan !play! untuk tambah lagu lagi.");
          return;
        }
        if (queue.length === 0) {
          await save({ current: null, queue: [], last: cur, paused: false });
          await post(
            "⏭️ Skipped  - Antrian kosong\n• Gunakan !play! untuk tambah lagu lagi.",
            { kind: "control", action: "stop" },
          );
          return;
        }
        const [next, ...rest] = queue;
        const prev = cur;
        const started = {
          ...next.track,
          by: next.by,
          startedAt: Date.now(),
          posMs: 0,
        };
        await save({ current: started, queue: rest, last: prev, paused: false });
        await post(
          `⏭️ Skipped\n🎶 Sebelumnya: ${prev ? prev.title : "-"}\n🎶 Sekarang: ${next.track.title}\n\n• Di-skip oleh: ${reqBy}`,
          { kind: "control", action: "skip", track: next.track },
        );
        return;
      }
      case "stop": {
        const n = (st?.queue?.length ?? 0) + (cur ? 1 : 0);
        await save({
          current: null,
          queue: [],
          paused: false,
          botInRoom: false,
        });
        await post(
          `⏹️ Stopped\n\n• Musik dihentikan\n• Antrian dibersihkan (${n} lagu)\n• Bot keluar dari voice channel\n• Terimakasih sudah pakai Luna Bot.`,
          { kind: "control", action: "stop" },
        );
        return;
      }
      case "queue":
      case "q": {
        const queue = st?.queue ?? [];
        if (!cur && queue.length === 0) {
          await post("📜 Antrian kosong\n• Ketik !play <judul>! untuk memutar musik.");
          return;
        }
        const lines: string[] = [`📜 Antrian - ${queue.length + (cur ? 1 : 0)} lagu`];
        if (cur) {
          lines.push("▶️ Now Playing", `   01. ${cur.title} - ${fmt(cur.durationMs)}`);
        }
        if (queue.length) {
          lines.push("⏭️ Next");
          queue.forEach((q, i) => {
            lines.push(
              `   ${String(i + 2).padStart(2, "0")}. ${q.track.title} - ${fmt(q.track.durationMs)} (@${q.by})`,
            );
          });
        }
        const total =
          (cur?.durationMs ?? 0) + queue.reduce((a, q) => a + q.track.durationMs, 0);
        lines.push(
          `Total: ${fmt(total)} • Loop: Off • Volume: ${st?.volume ?? 80}%`,
        );
        await post(lines.join("\n"));
        return;
      }
      case "pause": {
        if (!cur) {
          await post("⏸️ Tidak ada musik yang dijeda.");
          return;
        }
        if (st!.paused) {
          await post("⏸️ Musik sudah dalam keadaan pause.");
          return;
        }
        const pos = posOf(st!);
        await save({ paused: true, current: { ...cur, posMs: pos } });
        await post(
          `⏸️ Paused\n\n🎶 ${cur.title} - ${fmt(pos)} / ${fmt(cur.durationMs)}\n• Ketik !resume! untuk lanjut.`,
          { kind: "control", action: "pause" },
        );
        return;
      }
      case "resume": {
        if (!cur) {
          await post("▶️ Tidak ada musik yang dilanjutkan — ketik !play <judul>!");
          return;
        }
        const pos = st!.paused ? cur.posMs : posOf(st!);
        await save({
          paused: false,
          current: { ...cur, posMs: pos, startedAt: Date.now() },
        });
        await post(
          `▶️ Resumed\n\n🎶 Melanjutkan: ${cur.title}\n⏱️ ${fmt(pos)} / ${fmt(cur.durationMs)} • Volume: ${st?.volume ?? 80}%`,
          { kind: "control", action: "resume" },
        );
        return;
      }
      case "volume": {
        const n = parseInt(args.replace(/[^0-9]/g, ""), 10);
        if (!args) {
          await post(`🔊 Volume: ${st?.volume ?? 80}%`);
          return;
        }
        if (Number.isNaN(n) || n < 0 || n > 100) {
          await post("🔊 Volume harus 0–100. Contoh: !volume 80!");
          return;
        }
        await save({ volume: n });
        await post(`🔊 Volume: ${n}%`, {
          kind: "control",
          action: "volume",
          volume: n,
        });
        return;
      }
      case "bassboost":
      case "nightcore":
      case "8d": {
        const label =
          cmd === "bassboost" ? "Bassboost" : cmd === "nightcore" ? "Nightcore" : "8D";
        const on = st?.fx !== cmd;
        await save({ fx: on ? cmd : "off" });
        await post(
          `🎛️ Effect: ${label} ${on ? "ON" : "OFF"}\n🎶 ${cur ? cur.title : "(tidak ada musik)"}\n• Efek ${on ? "diterapkan ke" : "dilepas dari"} pemutar musik.`,
          { kind: "control", action: "fx", fx: cmd, on },
        );
        return;
      }
      default:
        // Perintah tidak dikenal — bantu user.
        await post(`❓ Command !${cmd}! tidak dikenal — ketik !help! untuk daftar command.`);
        return;
    }
  },
});
