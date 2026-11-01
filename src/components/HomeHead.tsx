import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, BlueCheck, ClanTag, SacretIcon } from "@/components/lstream-ui";
import { badgeForLevel, displayId } from "@/lib/lstream";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { CrownIcon } from "@/components/ios-icons";
import { YoruVerseScreen } from "@/components/YoruVerse";
import { TierIcon } from "@/components/ProfileSheet";
import { xpForLevel } from "@/lib/level";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Coffee,
  Crown,
  Heart,
  MessageSquare,
  Mic,
  Sticker,
  Play,
  Sparkles,
  Star,
  Tv,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

/* ====================================================================== *
 *  BAGIAN ATAS HOME
 *  Sapaan · kotak profil + level · kotak Sacret/Premium/YoruVerse ·
 *  Top Airing · Daily Quest · podium Leaderboard · Chat Global & Voice
 *  Call · Lanjutkan nonton.
 * ====================================================================== */

/** Angka disingkat (7.000 → 7k, 1.200.000 → 1,2jt) + koma desimal id-ID. */
function trim1(x: number): string {
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
}
export function fmtShort(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${trim1(v / 1000)}k`;
  if (v < 1_000_000_000) return `${trim1(v / 1_000_000)}jt`;
  if (v < 1_000_000_000_000) return `${trim1(v / 1_000_000_000)}M`;
  return `${trim1(v / 1_000_000_000_000)}T`;
}

/** Sapaan mengikuti jam LOKAL device — WIB / WITA / WIT otomatis benar.
 *  "Selamat Tidur" mulai jam 22.00. */
export function greetingOf(d = new Date()): string {
  const h = d.getHours();
  if (h >= 22 || h < 4) return "Selamat Tidur";
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

/* ------------------------------------------------------------- sapaan -- */

export function GreetingBar() {
  const { user } = useAuth();
  const [, tick] = useState(0);
  // Nama yang disapa harus USERNAME akun user beneran
  // (fallback terakhir baru "YoruNime").
  const name =
    user?.username ||
    user?.name ||
    (typeof (user as any)?.email === "string"
      ? String((user as any).email).split("@")[0]
      : "") ||
    "YoruNime";
  // Ganti otomatis saat jam berpindah (mis. 10.59 → 11.00 jadi "Siang").
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  // Sapaan polos TANPA background/kotak — hanya teks.
  return (
    <div className="fade-enter flex w-full items-center justify-center px-1 py-1.5">
      <p className="text-center text-base font-black tracking-tight">
        {greetingOf()},{" "}
        <span className="bg-gradient-to-r from-white via-gold to-gold-strong bg-clip-text text-transparent">
          {name} Disini!
        </span>
      </p>
    </div>
  );
}

/* ----------------------------------------------------- kotak profil ---- */

export function ProfileBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [yv, setYv] = useState(false);
  const level = user?.level ?? 1;
  const premiumDays =
    user && (user.premiumUntil ?? 0) > Date.now()
      ? Math.max(0, Math.floor(((user.premiumUntil ?? 0) - Date.now()) / 86_400_000))
      : 0;
  const need = xpForLevel(level);
  const have = Math.max(0, Math.min(user?.xp ?? 0, need));
  const pct = Math.min(100, Math.round((have / Math.max(1, need)) * 100));
  return (
    <div className="fade-enter yn-panel mt-3 flex w-full items-center gap-3 p-3.5">
      {/* Foto profile besar, tepat di tengah vertikal sisi kiri. */}
      <Avatar
        src={user?.image}
        seed={user?.username}
        className="size-16 shrink-0 self-center"
      />
      <div className="min-w-0 flex-1">
        {/* Username + centang biru + ID + tag level + tag clan. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-black">{user?.username ?? "user"}</p>
          {((user as any)?.premiumUntil ?? 0) > Date.now() && (
            <BlueCheck className="size-3.5 shrink-0" />
          )}
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/70">
            {displayId((user as any)?.seqId)}
          </span>
          {/* Tag level — gaya sama persis dengan di detail akun:
              bulat, outline putih, ikon material tier di kirinya. */}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/95">
            <TierIcon
              tier={badgeForLevel(level).name}
              className="size-3.5"
            />
            Lv.{level}
          </span>
          {user?.clanTag && (
            <ClanTag
              icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={user.clanTag}
              color={(user as any).clanNameColor}
              level={(user as any).clanLevel}
              className="shrink-0 scale-90 px-1 py-0 text-[9px]"
            />
          )}
        </div>
        {/* Label kecil + status level (TANPA background & outline) di baris
            yang sama, tepat di atas ujung kanan bar — jadi tidak menimpa. */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="yn-eyebrow text-[9px]">Level progress</span>
          <span className="yn-num text-[10px] font-black text-white/75">
            LV {fmtShort(level)}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-strong transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* "7.000/12.000 - 89%" di kiri bawah bar. */}
        <p className="mt-1 text-[10px] font-semibold text-white/60">
          {have.toLocaleString("id-ID")}/{need.toLocaleString("id-ID")} - {pct}%
        </p>
        {/* Ringkasan akun — dulunya 3 kotak terpisah (Sacret · Premium ·
            YoruVerse), sekarang menyatu sebagai chip di header akun. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white">
            <SacretIcon className="size-3.5 text-sky-300" />
            {fmtShort(user?.diamonds ?? 0)} Sacret
          </span>
          <button
            type="button"
            onClick={() => navigate("/premium")}
            className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white transition active:scale-95"
          >
            <CrownIcon className="size-3.5 text-amber-300" />
            {premiumDays} hari
          </button>
        </div>
      </div>
      {/* Tombol & layar MENU YoruVerse DIHAPUS permanen (permintaan):
          Shop / YoruPet / Music sekarang dibuka lewat sheet PANEL. */}
    </div>
  );
}

/* ------------------------------------------- kotak Sacret / Prem / YV -- */

function SaturnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="11" r="5.4" fill="currentColor" fillOpacity="0.22" />
      <circle cx="12" cy="11" r="5.4" />
      <ellipse
        cx="12"
        cy="11"
        rx="10.6"
        ry="3.4"
        transform="rotate(-22 12 11)"
      />
    </svg>
  );
}

/* ---------------------------------------------- sisa lama: kotak tile -- */
/* StatBoxes (Sacret · Premium · YoruVerse) DIHAPUS — isinya pindah jadi
   chip ringkas di dalam ProfileBar (header akun). */

/* --------------------------------------------------------- top airing -- */

export function TopAiringRow({
  items,
  viewsOf,
  onPick,
}: {
  items: { id: string; title: string; image: string; score?: number }[];
  viewsOf: (id: string) => number;
  onPick: (id: string, title?: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="fade-enter mt-5">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_6px_16px_-8px_rgba(251,146,60,.9)]">
          <Play className="size-3.5 text-black" />
        </span>
        <h2 className="text-lg font-bold tracking-tight">Top Airing</h2>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> On air
        </span>
      </div>
      <div className="thin-scroll -mx-1 mt-2.5 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id, a.title)}
            className="w-56 shrink-0 text-left"
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#141827_0%,#0e1120_100%)] shadow-[0_18px_34px_-24px_rgba(0,0,0,.95)] transition hover:border-white/30">
              {/* Banner + badge rating di pojok kanan atas */}
              <div className="relative h-28 bg-black">
                <img
                  src={a.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-300/40 backdrop-blur">
                  <Star className="size-3 fill-amber-300" />
                  {(a.score ?? 0).toFixed(1)}
                </span>
                {/* Scrim gradasi biar banner menyatu ke panel bawah */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#141827] to-transparent"
                />
              </div>
              {/* Panel bawah TERPISAH: judul + jumlah nonton rapi */}
              <div className="px-3 pb-2.5 pt-2">
                <p className="line-clamp-2 text-[12.5px] font-bold leading-snug tracking-tight text-white">
                  {a.title}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5">
                  <span className="flex items-center gap-1 rounded-md bg-sky-400/12 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 ring-1 ring-sky-400/25">
                    <Play className="size-2.5" />
                    {fmtShort(viewsOf(a.id))}
                  </span>
                  <span className="text-[10px] font-semibold text-white/45">
                    nonton
                  </span>
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- daily quest -- */

const QUEST_KEY = "yn:dq";
type QuestLocal = { search: number; detail: number };
type QuestStore = { day: string; local: QuestLocal; claimed: string[] };
type Progress = {
  watchCount: number;
  minutes: number;
  comicCount: number;
  commentCount: number;
  favoriteCount: number;
  chatCount: number;
};

/** Awal hari (00.00 WIB) sebagai kunci reset quest. */
export function questDayKey(now = Date.now()): string {
  const wib = 7 * 3_600_000;
  return String(Math.floor((now + wib) / 86_400_000) * 86_400_000 - wib);
}

function readQuestStore(): QuestStore {
  const day = questDayKey();
  const empty: QuestStore = { day, local: { search: 0, detail: 0 }, claimed: [] };
  try {
    const raw = localStorage.getItem(QUEST_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as QuestStore;
    if (parsed?.day !== day) return empty;
    return {
      day,
      local: { search: parsed.local?.search ?? 0, detail: parsed.local?.detail ?? 0 },
      claimed: Array.isArray(parsed.claimed) ? parsed.claimed : [],
    };
  } catch {
    return empty;
  }
}

function writeQuestStore(s: QuestStore) {
  try {
    localStorage.setItem(QUEST_KEY, JSON.stringify(s));
  } catch {
    /* mode privat: quest tetap tampil, hanya xp tidak tersimpan. */
  }
}

/** Tambah hitung quest lokal (dipanggil layar pencarian & saat buka detail). */
export function bumpQuestLocal(key: keyof QuestLocal) {
  const s = readQuestStore();
  s.local[key] = (s.local[key] ?? 0) + 1;
  writeQuestStore(s);
}

type QuestDef = {
  id: string;
  text: string;
  target: number;
  xp: number;
  get: (p: Progress, l: QuestLocal) => number;
};

/** Misi ringan — XP selalu di rentang 50-300. */
const QUEST_POOL: QuestDef[] = [
  { id: "w1", text: "Nonton 1 anime hari ini", target: 1, xp: 80, get: (p) => p.watchCount },
  { id: "w3", text: "Nonton 3 anime berbeda", target: 3, xp: 220, get: (p) => p.watchCount },
  { id: "m30", text: "Nonton selama 30 menit", target: 30, xp: 250, get: (p) => p.minutes },
  { id: "f1", text: "Tambahkan 1 favorite", target: 1, xp: 60, get: (p) => p.favoriteCount },
  { id: "c1", text: "Tulis 1 komentar", target: 1, xp: 150, get: (p) => p.commentCount },
  { id: "k2", text: "Baca 2 chapter komik", target: 2, xp: 100, get: (p) => p.comicCount },
  { id: "g3", text: "Kirim 3 chat di Chat Global", target: 3, xp: 180, get: (p) => p.chatCount },
  { id: "s3", text: "Cari 3 judul di pencarian", target: 3, xp: 50, get: (_p, l) => l.search },
  { id: "d5", text: "Buka detail 5 judul", target: 5, xp: 120, get: (_p, l) => l.detail },
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 3 misi berbeda tiap hari (dipilih deterministik dari kunci tanggal). */
function questsOfDay(day: string): QuestDef[] {
  return QUEST_POOL.map((q) => ({ q, h: hashStr(`${day}:${q.id}`) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, 3)
    .map((x) => x.q);
}

export function DailyQuestRow() {
  const progress = useQuery(api.quests.dailyProgress, {});
  const addXp = useMutation(api.users.addXp);
  const [store, setStore] = useState<QuestStore>(() => readQuestStore());
  // Tick tiap 30 detik supaya pergantian hari 00.00 langsung me-refresh misi.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      // Baca ulang tiap 30 detik supaya hitungan lokal (search/detail) dan
      // pergantian hari 00.00 langsung terlihat di 3 kotak quest.
      setStore(readQuestStore());
      tick((v) => v + 1);
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const day = store.day;
  const quests = useMemo(() => questsOfDay(day), [day]);
  const p: Progress = progress ?? {
    watchCount: 0,
    minutes: 0,
    comicCount: 0,
    commentCount: 0,
    favoriteCount: 0,
    chatCount: 0,
  };

  // XP masuk otomatis begitu misi selesai — sekali per misi per hari.
  useEffect(() => {
    if (!progress) return;
    let changed = false;
    const s = readQuestStore();
    for (const q of quests) {
      const val = q.get(p, s.local);
      if (val >= q.target && !s.claimed.includes(q.id)) {
        s.claimed.push(q.id);
        changed = true;
        void addXp({ amount: q.xp, source: "daily-quest" })
          .then(() => toast.success(`Daily quest selesai · +${q.xp} XP`))
          .catch(() => {});
      }
    }
    if (changed) {
      writeQuestStore(s);
      setStore(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, store.day]);

  return (
    <section className="fade-enter mt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">Daily Quest</h2>
        <span className="text-[11px] text-muted-foreground">reset 00.00</span>
      </div>
      <div className="thin-scroll -mx-1 mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {quests.map((q) => {
          const val = Math.min(q.target, q.get(p, store.local));
          const done = q.get(p, store.local) >= q.target;
          const pct = Math.min(100, Math.round((val / Math.max(1, q.target)) * 100));
          return (
            <div
              key={q.id}
              className={cn(
                "flex w-56 shrink-0 flex-col rounded-xl border border-dashed border-amber-300/35 bg-[linear-gradient(165deg,rgba(251,191,36,.10),rgba(17,12,26,.65))] p-2.5 shadow-[0_14px_30px_-24px_rgba(251,191,36,.7)]",
              )}
            >
              <div className="flex items-start gap-1.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border",
                    done
                      ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300"
                      : "border-white/25 bg-white/[0.07] text-white/70",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </span>
                <p className="min-w-0 flex-1 text-[10px] font-semibold leading-tight text-white/85">
                  {q.text}
                  <span className="mt-0.5 block text-[10px] font-black text-amber-300">
                    +{q.xp} XP Level
                  </span>
                </p>
              </div>
              {/* Kiri atas bar: "0/1 Selesai" */}
              <p className="mt-2 text-[9px] font-semibold text-white/50">
                {val}/{q.target} Selesai
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    done
                      ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                      : "bg-gradient-to-r from-amber-400 to-orange-400",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Kanan bawah bar: "- 30%" */}
              <p className="mt-1 text-right text-[9px] font-bold text-white/50">
                - {pct}%
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------- podium leaderboard -- */

type PodiumEntry = { username?: string; image?: string; value: string };

function PodiumAvatar({
  rank,
  username,
  image,
}: {
  rank: number;
  username?: string;
  image?: string;
}) {
  const ring =
    rank === 1
      ? "ring-yellow-400"
      : rank === 2
        ? "ring-zinc-300"
        : "ring-amber-600";
  const dash =
    rank === 1 ? "text-yellow-400" : rank === 2 ? "text-zinc-300" : "text-amber-500";
  return (
    <div className="relative">
      <Avatar src={image} seed={username} className={cn("relative size-11 ring-2", ring)} />
      {/* Outline berputar mengelilingi foto juara. */}
      <svg
        className={cn(
          "pointer-events-none absolute -inset-[5px] overflow-visible",
          dash,
        )}
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="50 50"
          className="yn-ep-outline"
        />
      </svg>
      {rank === 1 && (
        <Crown
          className="absolute -top-3.5 left-1/2 size-4 -translate-x-1/2 text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.85)]"
          aria-hidden
        />
      )}
    </div>
  );
}

export function LeaderPodium({ onSeeAll }: { onSeeAll: () => void }) {
  const xpRows = useQuery(api.xp.leaderboard, { period: "mingguan", limit: 3 });
  const giveRows = useQuery(api.account.topGive, { limit: 3 });
  const [mode, setMode] = useState<"xp" | "give">("xp");

  // Ganti top XP ⇄ top give tiap 6 detik, pergantian dihaluskan fade.
  useEffect(() => {
    const t = setInterval(() => setMode((m) => (m === "xp" ? "give" : "xp")), 6000);
    return () => clearInterval(t);
  }, []);

  const entries: PodiumEntry[] =
    mode === "xp"
      ? (xpRows ?? []).slice(0, 3).map((r) => ({
          username: r.username,
          image: r.image,
          value: `${(r.xp ?? 0).toLocaleString("id-ID")} XP`,
        }))
      : (giveRows ?? []).slice(0, 3).map((g) => ({
          username: g.username,
          image: g.image,
          value: `${(g.days ?? 0).toLocaleString("id-ID")} hari`,
        }));

  const byRank = [entries[1], entries[0], entries[2]]; // 2 · 1 · 3

  return (
    <section className="fade-enter mt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">Leaderboard</h2>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-primary"
        >
          Lihat selengkapnya <ChevronRight className="size-3" />
        </button>
      </div>

      {/* Kotak podium PREMIUM — latar gradasi gelap keemasan + glow,
          border neon tipis, bukan abu-abu polos. */}
      <div className="relative mt-2 overflow-hidden rounded-3xl border border-amber-300/30 bg-[radial-gradient(120%_85%_at_50%_-25%,rgba(251,191,36,.20),transparent_60%),linear-gradient(165deg,#191306_0%,#111019_60%,#0a0a10_100%)] p-3 shadow-[0_24px_54px_-30px_rgba(251,191,36,.55)] yn-cut-alt">
        {/* Titik bintik halus + ornamen sudut emas (bukan blur menyilaukan) */}
        <span aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.3px)] [background-size:22px_22px] opacity-60" />
        <span aria-hidden className="absolute left-2.5 top-2.5 size-3.5 border-l-2 border-t-2 border-amber-300/60 rounded-tl-md" />
        <span aria-hidden className="absolute right-2.5 top-2.5 size-3.5 border-r-2 border-t-2 border-amber-300/60 rounded-tr-md" />
        <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        <div className="relative grid grid-cols-3 items-end">
          {byRank.map((e, i) => {
            const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
            return (
              <div key={i} className="flex min-w-0 flex-col items-center">
                <div className="mb-2 flex h-16 items-end justify-center">
                  {e ? (
                    <PodiumAvatar rank={rank} username={e.username} image={e.image} />
                  ) : null}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${mode}-${e?.username ?? "kosong"}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.45 }}
                    style={{
                      // Bentuk TAJAM atas & bawah (pacman/ribbon lancip),
                      // bukan datar di atas.
                      clipPath:
                        "polygon(50% 0, 100% 12%, 100% 88%, 50% 100%, 0 88%, 0 12%)",
                    }}
                    className={cn(
                      "relative flex w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-t-2xl border px-1 pb-6 pt-4 backdrop-blur-[2px]",
                      rank === 1
                        ? "h-28 border-amber-200/60 bg-[linear-gradient(to_top,#f59e0b_0%,rgba(245,158,11,.42)_45%,rgba(251,191,36,.10)_100%)]"
                        : rank === 2
                          ? "h-20 border-zinc-300/45 bg-[linear-gradient(to_top,#cbd5e1_0%,rgba(203,213,225,.32)_50%,rgba(255,255,255,.06)_100%)]"
                          : "h-16 border-amber-600/50 bg-[linear-gradient(to_top,#b45309_0%,rgba(180,83,9,.38)_50%,rgba(251,146,60,.08)_100%)]",
                    )}
                  >
                    {/* Angka rank besar semi-transparan di dasar blok */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute bottom-3 left-1/2 -translate-x-1/2 text-4xl font-black text-black/20",
                      )}
                    >
                      {rank}
                    </span>
                    <p className="relative w-full truncate px-1 text-center text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
                      {e?.username ?? "-"}
                    </p>
                    <p
                      className={cn(
                        "relative w-full truncate px-1 text-center text-[10px] font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]",
                        rank === 1
                          ? "text-amber-50"
                          : rank === 2
                            ? "text-zinc-900"
                            : "text-orange-50",
                      )}
                    >
                      {e?.value ?? "-"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        {/* Label mode kecil di bawah podium — biar jelas sedang lihat apa. */}
        <p className="relative mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-amber-100/70">
          {mode === "xp" ? (
            <>
              <Sparkles className="size-3 text-amber-300" /> Top XP minggu ini
            </>
          ) : (
            <>
              <Crown className="size-3 text-rose-300" /> Top Give Premium
            </>
          )}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------- kotak chat & voice call -- */

export function ChatVoiceRow({
  onOpenChat,
  onOpenSticker,
  onOpenNobar,
  onOpenVoice,
}: {
  onOpenChat: () => void;
  onOpenSticker: () => void;
  onOpenNobar: () => void;
  onOpenVoice: () => void;
}) {
  void onOpenChat;

  // STICKER SHOP = kotak besar menggantikan Chat Global (dipisah dari chat).
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {/* STICKER SHOP — panel paling tinggi (2 baris). */}
      <button
        onClick={onOpenSticker}
        className="group relative row-span-2 flex min-h-[228px] flex-col justify-between overflow-hidden rounded-3xl border border-emerald-400/35 bg-[linear-gradient(165deg,rgba(16,185,129,.24)_0%,rgba(11,20,18,.92)_55%,rgba(8,10,14,.96)_100%)] p-4 text-left shadow-[0_26px_54px_-38px_rgba(0,0,0,1)] transition hover:border-emerald-300/60 active:scale-[0.98]"
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-40 [background-size:22px_22px] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.2px)]"
        />
        <span className="relative flex items-start justify-between gap-2">
          <span className="yn-eyebrow">Toko</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/40 bg-emerald-400/15">
            <Sticker className="size-4 text-emerald-100" />
          </span>
        </span>
        <span className="relative flex flex-col gap-1">
          <span className="font-display text-xl font-black leading-none tracking-tight">
            Sticker Shop
          </span>
          <span className="yn-meta">Pack lucu, anime & random — langsung ke chat</span>
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold text-emerald-100">
            <Sparkles className="size-3" /> Buka toko
          </span>
        </span>
      </button>

      {/* NOBAR — nonton bareng, kotak warna merah muda. */}
      <button
        onClick={onOpenNobar}
        className="relative flex h-28 flex-col justify-between overflow-hidden rounded-3xl border border-rose-400/35 bg-[linear-gradient(165deg,rgba(244,63,94,.22)_0%,rgba(26,12,18,.92)_60%,rgba(12,9,13,.96)_100%)] p-4 text-left shadow-[0_26px_54px_-38px_rgba(0,0,0,1)] transition hover:border-rose-300/60 active:scale-[0.98]"
      >
        <span className="relative flex items-start justify-between gap-2">
          <span className="yn-eyebrow">Nobar</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-rose-300/40 bg-rose-400/15">
            <Tv className="size-4 text-rose-100" />
          </span>
        </span>
        <span className="relative flex flex-col">
          <span className="text-base font-black leading-tight tracking-tight">Nobar</span>
          <span className="yn-meta">Nonton bareng komunitas</span>
        </span>
      </button>

      {/* VOICE — ngobrol suara, kotak warna biru langit. */}
      <button
        onClick={onOpenVoice}
        className="relative flex h-28 flex-col justify-between overflow-hidden rounded-3xl border border-sky-400/35 bg-[linear-gradient(165deg,rgba(56,189,248,.22)_0%,rgba(10,18,28,.92)_60%,rgba(9,10,14,.96)_100%)] p-4 text-left shadow-[0_26px_54px_-38px_rgba(0,0,0,1)] transition hover:border-sky-300/60 active:scale-[0.98]"
      >
        <span className="relative flex items-start justify-between gap-2">
          <span className="yn-eyebrow">Suara</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-400/15">
            <Mic className="size-4 text-sky-100" />
          </span>
        </span>
        <span className="relative flex flex-col">
          <span className="text-base font-black leading-tight tracking-tight">Voice Call</span>
          <span className="yn-meta">Nobaron &amp; ngobrol</span>
        </span>
      </button>
    </div>
  );
}

/* --------------------------------------------------- lanjutkan nonton -- */

type ContRow = {
  _id: string;
  animeId: string;
  animeTitle?: string;
  animeImage?: string;
  episode?: number;
  progressSec?: number;
  durationSec?: number;
  updatedAt?: number;
};

/** "16.45" dari 1005 detik — menit.detik sesuai contoh user. */
function clockOf(sec?: number): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  return `${Math.floor(s / 60)}.${String(s % 60).padStart(2, "0")}`;
}

export function ContinueWatchingRow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rows = useQuery(
    api.activities.continueWatching,
    user ? {} : "skip",
  ) as unknown as ContRow[] | undefined;
  const items = (rows ?? [])
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 8);
  if (items.length === 0) return null;

  return (
    <section className="fade-enter mt-5">
      <h2 className="text-lg font-bold tracking-tight">Lanjutkan nonton</h2>
      <div className="thin-scroll -mx-1 mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((c) => {
          const total = c.durationSec ?? 0;
          const pct =
            total > 0 ? Math.min(100, Math.round(((c.progressSec ?? 0) / total) * 100)) : 0;
          return (
            <div key={c._id} className="w-44 shrink-0">
              <button
                onClick={() =>
                  navigate(
                    `/nonton?anime=${encodeURIComponent(c.animeId)}&ep=${encodeURIComponent(
                      `${c.animeId}__ep${c.episode ?? 1}`,
                    )}&judul=${encodeURIComponent(c.animeTitle ?? "")}`,
                  )
                }
                className="relative block h-24 w-full overflow-hidden rounded-2xl border border-white/10 bg-black text-left"
              >
                {c.animeImage && (
                  <img
                    src={c.animeImage}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35" />
                {/* Posisi tonton — PAS di kiri atas bar (tanpa background). */}
                <span className="absolute bottom-4 left-2 font-mono text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {clockOf(c.progressSec)}/{clockOf(total)}
                </span>
                <span className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/25">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </button>
              {/* Di luar kotak: judul + episode. */}
              <p className="mt-1.5 line-clamp-1 text-[11px] font-bold">
                {c.animeTitle}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Episode {c.episode ?? 1} · {pct}%
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- pencarian ---- */

/**
 * Slide pertama HERO BANNER: promosi AFINITAS. Dibuat seperti kartu promo
 * sungguhan (gradasi gelap + glow pink/indigo + tombol CTA).
 */
export function AfinitasPromo({
  onOpen,
  images,
}: {
  onOpen: () => void;
  /** Foto karakter (anime/donghua) untuk kartu pasangan di sisi kanan. */
  images?: string[];
}) {
  const [a, b] = images ?? [];
  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(150deg,#241033_0%,#14101f_55%,#0a0a11_100%)]">
      <span aria-hidden className="absolute -left-10 -top-12 size-44 rounded-full bg-gold/15 blur-3xl" />
      <span aria-hidden className="absolute -bottom-14 -right-8 size-44 rounded-full bg-white/[0.06] blur-3xl" />
      {/* Dua kartu KARAKTER miring + hati di tengahnya (sisi kanan). */}
      {(a || b) && (
        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
          {a && (
            <div className="relative h-[102px] w-[70px] -rotate-[9deg] overflow-hidden rounded-xl border border-white/20 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]">
              <img src={a} alt="" className="size-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            </div>
          )}
          {b && (
            <div className="relative -ml-6 h-[102px] w-[70px] rotate-[9deg] overflow-hidden rounded-xl border border-white/20 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]">
              <img src={b} alt="" className="size-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            </div>
          )}
          <span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/30 bg-gold-strong text-black">
            <Heart className="size-3.5 fill-black" />
          </span>
        </div>
      )}
      <div className="relative flex h-full max-w-[62%] flex-col justify-center gap-1 px-4">
        <span className="yn-tag">Afinitas</span>
        <p className="text-[15px] font-black leading-tight text-white">
          Hubungkan akun, naikkan level bonding
        </p>
        <p className="text-[10px] leading-snug text-white/65">
          Pasangan · Sahabat · Keluarga — saling kasih XP &amp; bonus tiap hari
        </p>
        <button
          onClick={onOpen}
          className="yn-btn-warm mt-1.5 flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black transition active:scale-95"
        >
          Buka Afinitas <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * PROMO FEED — slide hero kedua. Menampilkan tumpukan miniatur konten di
 * kanan (mirip grid 3-per-baris di profil) tanpa glow mencolok: permukaan
 * solid, garis tipis, dan aksen hangat.
 */
export function FeedPromo({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(150deg,#2a1608_0%,#1a1119_55%,#0b0a11_100%)]">
      {/* Garis emas tipis di atas — pengganti glow. */}
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
      />

      {/* Tumpukan konten di kanan — tiga kartu miring, gaya grid Feed. */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-end gap-1.5">
        {[
          { r: "-8deg", c: "border-amber-300/55" },
          { r: "0deg", c: "border-white/35" },
          { r: "8deg", c: "border-rose-300/55" },
        ].map((k, i) => (
          <span
            key={i}
            style={{ transform: `rotate(${k.r})` }}
            className={cn(
              "flex h-[96px] w-[56px] flex-col items-center justify-end gap-1 overflow-hidden rounded-lg border-2 bg-[#15111b] pb-2",
              k.c,
            )}
          >
            <span className="relative flex flex-col items-center gap-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-white/80">
                {i === 1 ? (
                  <Play className="size-3 fill-white" />
                ) : i === 0 ? (
                  <Sparkles className="size-3 text-amber-200" />
                ) : (
                  <Heart className="size-3 text-rose-300" />
                )}
              </span>
              <span className="h-1 w-8 rounded-full bg-white/25" />
              <span className="h-1 w-5 rounded-full bg-white/15" />
            </span>
          </span>
        ))}
      </div>

      <div className="relative flex h-full max-w-[62%] flex-col justify-center gap-1 px-4">
        <span className="w-fit rounded-full border border-amber-400/45 bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">
          Feed
        </span>
        <p className="text-[15px] font-black leading-tight text-white">
          Pamer konten, kumpulkan like
        </p>
        <p className="text-[10px] leading-snug text-white/65">
          Foto · Musik · Text — bagikan ke teman langsung ke chat mereka
        </p>
        <button
          onClick={onOpen}
          className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-3 py-1.5 text-[11px] font-black text-black transition active:scale-95"
        >
          Buka Feed <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * PROMO DONATE — slide ketiga carousel. Nuansa hangat kopi, beda dari
 * Afinitas (ungu) & Feed (amber), langsung membuka halaman donasi.
 */
export function DonatePromo() {
  return (
    <a
      href="https://sociabuzz.com/yorunime/donate"
      target="_blank"
      rel="noreferrer"
      className="relative block h-full w-full overflow-hidden bg-[linear-gradient(145deg,#1b2a24_0%,#141a17_55%,#0b0d0c_100%)]"
    >
      <span aria-hidden className="absolute -right-10 -top-12 size-44 rounded-full bg-emerald-300/15 blur-3xl" />
      <span aria-hidden className="absolute -bottom-16 -left-8 size-40 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="absolute right-4 top-1/2 flex size-24 -translate-y-1/2 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_35%_25%,#fef3c7,#d97706_55%,#451a03)] shadow-[0_18px_34px_-18px_rgba(0,0,0,.9)]">
        <span className="flex size-14 items-center justify-center rounded-full bg-black/25 text-amber-50 backdrop-blur-sm">
          <Coffee className="size-7" />
        </span>
        <span className="absolute -bottom-2 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-black/40 blur-md" />
      </div>
      <div className="relative flex h-full max-w-[62%] flex-col justify-center gap-1 px-4">
        <span className="w-fit rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-100">
          Donate
        </span>
        <p className="text-[15px] font-black leading-tight text-white">
          Traktir kopi buat developer
        </p>
        <p className="text-[10px] leading-snug text-white/60">
          Biar YoruNime tetap hidup dan server makin kencang.
        </p>
        <span className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-emerald-300 to-teal-400 px-3 py-1.5 text-[11px] font-black text-emerald-950">
          Donate sekarang <ChevronRight className="size-3.5" />
        </span>
      </div>
    </a>
  );
}

const RECENT_KEY = "yn:recent-search";

export function readRecentSearch(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string) {
  const t = term.trim();
  if (!t) return;
  try {
    const prev = readRecentSearch().filter((x) => x.toLowerCase() !== t.toLowerCase());
    localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...prev].slice(0, 10)));
  } catch {
    /* abaikan */
  }
}

/** Tombol pil "Baru Saja" / tag genre — dipakai layar pencarian. */
export function PillButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/85 transition hover:border-white/35 active:scale-95"
    >
      {icon}
      {children}
    </button>
  );
}
