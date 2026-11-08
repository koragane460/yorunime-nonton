import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, BlueCheck, ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { usernameColor } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Gem,
  MessageSquare,
  Play,
  Shield,
  Sparkles,
  Star,
  Trophy,
  ArrowUpRight,
} from "lucide-react";

type HistoryRow = {
  _id: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episode: number;
  minutesWatched?: number;
  progressSec?: number;
  durationSec?: number;
  updatedAt: number;
};

function watchedLabel(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  const day = sameDay ? "Hari ini" : isYesterday ? "Kemarin" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Ditonton • ${day} ${time}`;
}

/**
 * Kartu "lanjut nonton" di bawah pil profil Home.
 * Satu kotak dengan dua zona: banner + episode + menit di kiri, judul dan
 * detail tontonan di kanan.
 */
export function ContinueWatchingCard({
  onOpen,
  onHistory,
  onDiscover,
}: {
  onOpen: (h: HistoryRow) => void;
  onHistory: () => void;
  onDiscover?: () => void;
}) {
  const { user } = useAuth();
  const rows = useQuery(
    api.activities.myHistory,
    user ? {} : "skip",
  ) as HistoryRow[] | undefined;
  const detail = useAction(api.anime.animeDetail);
  const [score, setScore] = useState<number | undefined>(undefined);
  const last = rows?.[0];

  useEffect(() => {
    let alive = true;
    setScore(undefined);
    if (!last) return;
    void detail({ id: last.animeId, title: last.animeTitle })
      .then((d: any) => {
        if (alive && typeof d?.score === "number") setScore(d.score);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [detail, last?.animeId, last?.animeTitle]);

  if (rows === undefined) return null;
  if (!last) {
    return (
      <section className="fade-enter mt-3">
        <div className="relative flex h-[94px] items-center gap-3 overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(115deg,rgba(28,167,236,.1),rgba(255,255,255,.045)_48%,rgba(255,210,63,.08))] p-3 text-left">
          <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 size-28 rounded-full bg-sky-400/10 blur-3xl" />
          <span className="relative flex h-[62px] w-[68px] shrink-0 items-center justify-center">
            <span className="absolute left-1 top-1.5 h-[50px] w-[42px] -rotate-[15deg] rounded-lg border border-white/10 bg-[linear-gradient(150deg,#243247,#121722)]" />
            <span className="absolute right-1 top-1 h-[54px] w-[43px] rotate-[12deg] rounded-lg border border-white/10 bg-[linear-gradient(150deg,#302338,#15121d)]" />
            <span className="relative flex h-[56px] w-[45px] items-center justify-center rounded-lg border border-white/18 bg-[linear-gradient(150deg,#15324a,#0c1723)] text-sky-200 shadow-lg">
              <Play className="size-4 fill-current" />
            </span>
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[13px] font-black text-white">
              Belum ada riwayat nonton
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-white/45">
              Mulai satu episode — progres, episode, dan menitnya muncul di sini.
            </span>
          </span>
          <button
            type="button"
            onClick={onDiscover ?? onHistory}
            className="relative shrink-0 rounded-full bg-[linear-gradient(110deg,#1CA7EC,#7C6CFF_55%,#E84855)] px-3 py-2 text-[9px] font-black text-white shadow-[0_10px_20px_-14px_rgba(28,167,236,.9)] active:scale-95"
          >
            Mulai
          </button>
        </div>
      </section>
    );
  }

  const duration =
    last.durationSec && last.durationSec > 0 ? last.durationSec : 1440;
  const progress = Math.max(0, last.progressSec ?? 0);
  const pct = Math.min(100, Math.round((progress / Math.max(1, duration)) * 100));
  const minutes = Math.floor(
    (progress > 0 ? progress : (last.minutesWatched ?? 0) * 60) / 60,
  );

  return (
    <section className="fade-enter mt-3">
      <button
        type="button"
        onClick={() => onOpen(last)}
        className="group relative flex h-[116px] w-full items-stretch overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(115deg,rgba(28,167,236,.15),rgba(255,255,255,.045)_44%,rgba(232,72,85,.09))] p-2.5 text-left shadow-[0_20px_45px_-34px_rgba(0,0,0,.95)] transition active:scale-[0.99]"
      >
        <span aria-hidden className="pointer-events-none absolute -right-9 -top-12 size-32 rounded-full bg-sky-400/10 blur-3xl" />
        <span className="relative ml-1 flex w-[82px] shrink-0 items-center justify-center">
          <span className="relative h-[94px] w-[68px] -rotate-[4deg] overflow-hidden rounded-[18px] border border-white/18 bg-black shadow-[0_16px_26px_-18px_rgba(0,0,0,1)] transition duration-300 group-hover:-rotate-[2deg]">
            {last.animeImage ? (
              <img src={last.animeImage} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-white/30">
                <Play className="size-6" />
              </span>
            )}
            <span className="absolute left-0 top-0 rounded-br-xl bg-gold-strong px-1.5 py-0.5 text-[8px] font-black text-black">
              Ep {last.episode}
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,.9))] px-1.5 pb-1.5 pt-5">
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#7FD3F7)]" style={{ width: `${Math.max(3, pct)}%` }} />
              </span>
              <span className="mt-1 flex items-center justify-between text-[7.5px] font-black text-white/80">
                <span>{minutes > 0 ? `${minutes} mnt` : "Baru mulai"}</span>
                <span>{pct}%</span>
              </span>
            </span>
          </span>
        </span>

        <span className="relative flex min-w-0 flex-1 flex-col py-0.5 pl-2.5">
          <span className="line-clamp-2 text-[13.5px] font-black leading-tight tracking-[-0.01em] text-white">
            {last.animeTitle}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-white/45">
            <Play className="size-2.5 shrink-0 text-sky-300" />
            <span className="truncate">{watchedLabel(last.updatedAt)}</span>
          </span>
          <span className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[8.5px] font-black text-amber-200">
              <Star className="size-2.5 fill-current" />
              {typeof score === "number" ? score.toFixed(1) : "—"}
            </span>
            <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/12">
              <span className="block h-full rounded-full bg-[linear-gradient(90deg,#7FD3F7,#FFD23F)]" style={{ width: `${Math.max(3, pct)}%` }} />
            </span>
            <span className="shrink-0 text-[8.5px] font-black text-sky-100">{pct}%</span>
          </span>
        </span>
      </button>
    </section>
  );
}

/** Kartu Premium editorial: foil emas di atas kertas gelap, tanpa pelangi
 *  gradien. Terasa seperti undangan klub, bukan banner iklan. */
export function HomePremiumCard({ onBuy }: { onBuy: () => void }) {
  return (
    <button
      type="button"
      onClick={onBuy}
      className="fade-enter group relative mt-3 w-full overflow-hidden rounded-[24px] border border-[#D8B86E]/35 bg-[linear-gradient(135deg,#1c1710_0%,#100e0c_58%,#1a130b_100%)] p-3.5 text-left shadow-[0_26px_58px_-40px_rgba(0,0,0,1)] transition active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#E8C77A,transparent)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-[#D8B86E]/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[4.4rem] w-px bg-[linear-gradient(180deg,transparent,rgba(216,184,110,.25),transparent)]"
      />

      <span className="relative flex items-center gap-3">
        <span className="relative flex size-12 shrink-0 flex-col items-center justify-center rounded-[15px] border border-[#D8B86E]/40 bg-[#0d0b09] text-[#F1D48D] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">
          <span className="font-display text-[17px] font-black leading-none tracking-[-0.04em]">
            Y+
          </span>
          <span className="mt-1 text-[5.5px] font-black uppercase tracking-[0.2em] text-[#F1D48D]/55">
            Premium
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-[0.23em] text-[#E8C77A]">
              Yoru Premium
            </span>
            <span className="size-1 rounded-full bg-[#E8C77A]/50" />
            <span className="text-[8px] font-bold text-white/35">Tanpa iklan</span>
          </span>
          <span className="mt-1 block truncate font-display text-[15px] font-black leading-tight tracking-[-0.02em] text-[#FFF6DF]">
            Nonton lebih tenang.
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[8px] font-semibold text-white/40">
            <Check className="size-2.5 text-[#E8C77A]" strokeWidth={3} />
            1080p
            <span className="size-0.5 rounded-full bg-white/25" />
            Manga
            <span className="size-0.5 rounded-full bg-white/25" />
            Border eksklusif
          </span>
        </span>

        <span className="relative flex shrink-0 flex-col items-end gap-1.5 pl-1">
          <span className="font-display text-[13px] font-black leading-none text-[#F4D58B]">
            Rp5<span className="text-[8px] font-bold text-[#F4D58B]/65">rb</span>
          </span>
          <span className="flex size-8 items-center justify-center rounded-full border border-[#D8B86E]/45 bg-[#D8B86E]/10 text-[#F1D48D] transition group-hover:bg-[#D8B86E]/20">
            <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
          </span>
        </span>
      </span>
    </button>
  );
}

function eventCountdown(ms: number) {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} hari ${hours} jam`;
  const minutes = Math.max(1, Math.floor(total / 60_000));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} jam ${minutes % 60} mnt`
    : `${minutes} mnt`;
}

/** Event aktif — mengikuti status voting karakter yang asli. */
export function ActiveEventCard({
  onSearch,
  onResults,
}: {
  onSearch: () => void;
  onResults: () => void;
}) {
  const status = useQuery(api.votes.status, {});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!status) return null;

  // Status dari server dihitung saat query berjalan. Kalau halaman dibiarkan
  // terbuka melewati batas waktu, pakai jam lokal supaya kartu tidak tetap
  // terlihat "Live" sampai ada data lain yang memicu query ulang.
  const expired = status.endsAt > 0 && now >= status.endsAt;
  const active = status.state === "active" && !expired;
  const ended = status.state === "ended" || (status.state === "active" && expired);
  const total = Math.max(1, status.endsAt - status.startedAt);
  const pct = active
    ? Math.min(100, Math.max(3, Math.round(((now - status.startedAt) / total) * 100)))
    : ended
      ? 100
      : 0;

  return (
    <section className="fade-enter mt-5">
      <h2 className="yn-sec text-[17px] font-black tracking-tight text-white">
        Event Aktif
      </h2>
      <div
        className={cn(
          "relative mt-2 overflow-hidden rounded-[24px] border p-3",
          active
            ? "border-gold/25 bg-[linear-gradient(120deg,rgba(255,210,63,.16),rgba(232,72,85,.09)_55%,rgba(255,255,255,.035))]"
            : ended
              ? "border-rose-400/20 bg-[linear-gradient(120deg,rgba(232,72,85,.12),rgba(255,210,63,.07)_55%,rgba(255,255,255,.035))]"
              : "border-white/10 bg-[linear-gradient(120deg,rgba(255,210,63,.1),rgba(255,255,255,.04)_52%,rgba(232,72,85,.06))]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 size-28 rounded-full bg-gold/10 blur-3xl"
        />
        <Trophy
          aria-hidden
          className="pointer-events-none absolute -bottom-4 right-2 size-20 rotate-[-12deg] text-white/[0.035]"
          strokeWidth={1.4}
        />
        <div className="relative flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
              active
                ? "border-gold/30 bg-gold/12 text-gold"
                : "border-rose-300/20 bg-rose-400/10 text-rose-200/80",
            )}
          >
            <Trophy className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-black text-white">
              <span className="truncate">
                {active
                  ? "Vote Karakter Anime"
                  : ended
                    ? "Voting karakter selesai"
                    : "Belum ada event"}
              </span>
              {active && (
                <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">
                  Live
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[9px] leading-snug text-white/45">
              {active
                ? `Voting berlangsung • sisa ${eventCountdown(status.endsAt - now)}`
                : ended
                  ? "Top Vote Character Anime sudah tersedia di Koleksi."
                  : "Event seru akan muncul di sini."}
            </span>
          </span>
          {!active && !ended && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white/40">
              Segera
            </span>
          )}
        </div>

        {(active || ended) && (
          <div className="relative mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#E84855)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[8.5px] font-black text-white/40">
              {pct}%
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={active ? onSearch : ended ? onResults : onSearch}
          className={cn(
            "relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[9.5px] font-black transition active:scale-[0.99]",
            active || ended
              ? "border border-white/12 bg-white/[0.055] text-white/75 hover:bg-white/[0.09]"
              : "bg-[linear-gradient(110deg,#FFD23F,#FF8A3D_55%,#E84855)] text-black shadow-[0_10px_20px_-15px_rgba(255,210,63,.9)]",
          )}
        >
          {active
            ? "Cari anime untuk vote"
            : ended
              ? "Lihat hasil vote"
              : "Jelajahi anime"}
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

type ChatRow = {
  _id: string;
  username: string;
  image?: string;
  premium?: boolean;
  text?: string;
  premiumGive?: unknown;
};

/** Kartu Global Chat Home — 3 pesan yang berganti setiap 1 menit. */
export function HomeCommunityCard({ onOpenChat }: { onOpenChat: () => void }) {
  const msgs = useQuery(api.chat.listMessages, {
    kind: "global",
    channel: "scg1",
    limit: 12,
  }) as ChatRow[] | undefined;
  const online = useQuery(api.presence.onlineCount, {});
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const visible = useMemo(() => {
    const list = (msgs ?? []).slice(-9);
    if (list.length === 0) return [];
    return Array.from({ length: Math.min(3, list.length) }, (_, i) => {
      return list[(idx + i) % list.length];
    });
  }, [msgs, idx]);

  return (
    <section className="fade-enter mt-5">
      <h2 className="yn-sec text-[17px] font-black tracking-tight text-white">
        Komunitas
      </h2>
      <div className="mt-2 overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(140deg,rgba(28,167,236,.10),rgba(255,255,255,.045)_48%,rgba(123,216,143,.07))] p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/12 text-emerald-200">
            <MessageSquare className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] font-black text-white">
              Global Chat
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
            </p>
            <p className="text-[9px] font-semibold text-white/40">
              Obrolan komunitas YoruNime
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black text-white">
            {online ?? 0} Online
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {visible.length > 0 ? (
            visible.map((m, i) => (
              <div key={`${m._id}-${idx}-${i}`} className="flex min-w-0 items-center gap-2">
                <Avatar
                  src={m.image}
                  seed={m.username}
                  className="size-7 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1 text-[10px] font-bold leading-tight">
                    <span className={cn("truncate", usernameColor(m.username))}>
                      {m.username}
                    </span>
                    {m.premium && <BlueCheck className="size-3 shrink-0" />}
                    <span className="shrink-0 text-white/65">:</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-white/55">
                      {m.premiumGive ? "Give premium" : m.text || "[foto]"}
                    </span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-center text-[10px] text-white/35">
              {msgs === undefined
                ? "Memuat chat…"
                : "Belum ada chat — jadi yang pertama!"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenChat}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,#0E7490_0%,#1CA7EC_100%)] py-2.5 text-[11px] font-black text-white shadow-[0_12px_24px_-16px_rgba(14,116,144,.85)] transition hover:brightness-110 active:scale-[0.99]"
        >
          Buka Chat
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </button>
      </div>
    </section>
  );
}

type RoomRow = {
  _id: string;
  animeTitle?: string;
  animeImage?: string;
  episode: number;
  memberCount?: number;
};

/** Dua kartu setengah lebar: Clan Mu dan Nobar. */
export function ClanNobarCards({
  onOpenClan,
  onOpenNobar,
}: {
  onOpenClan: (clanId?: string) => void;
  onOpenNobar: () => void;
}) {
  const { user } = useAuth();
  const membership = useQuery(
    api.clans.myMembership,
    user ? {} : "skip",
  ) as
    | {
        clan?: {
          _id?: string;
          name?: string;
          avatarUrl?: string;
          tag?: string;
          tagIcon?: string;
          level?: number;
          description?: string;
          tagTier?: number;
        };
      }
    | null
    | undefined;
  const rooms = useQuery(
    api.watchroom.listRooms,
    user ? {} : "skip",
  ) as RoomRow[] | undefined;
  const [roomIdx, setRoomIdx] = useState(0);

  useEffect(() => {
    if (!rooms || rooms.length < 2) return;
    const t = setInterval(
      () => setRoomIdx((v) => (v + 1) % rooms.length),
      5_000,
    );
    return () => clearInterval(t);
  }, [rooms?.length]);

  const clan = membership?.clan;
  const room = rooms && rooms.length > 0 ? rooms[roomIdx % rooms.length] : null;
  const nobarOnline = (rooms ?? []).reduce(
    (total, r) => total + Math.max(0, r.memberCount ?? 0),
    0,
  );

  return (
    <div className="fade-enter mt-1.5 grid grid-cols-2 gap-2.5">
      <div className="flex min-h-[176px] flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(255,210,63,.16),rgba(255,255,255,.05)_46%,rgba(123,216,143,.1))] p-2.5">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5 text-gold" />
          <p className="text-[12px] font-black text-white">Clan Mu</p>
        </div>

        <div className="mt-2 flex-1 rounded-xl border border-white/10 bg-white/[0.06] p-2">
          {clan ? (
            <>
              <div className="flex items-center gap-2">
                {clan.avatarUrl ? (
                  <img
                    src={clan.avatarUrl}
                    alt=""
                    className="size-8 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60">
                    <Shield className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <p className="truncate text-[10px] font-black text-white">
                      {clan.name ?? "Clan"}
                    </p>
                    <span className="shrink-0 rounded-full bg-black/20 px-1 py-0.5 text-[7px] font-black text-white/55">
                      Lv.{clan.level ?? 1}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1.5">
                <ClanTag
                  icon={clan.tagIcon ?? DEFAULT_CLAN_ICON}
                  tag={clan.tag ?? "CLAN"}
                  level={clan.level}
                  tier={clan.tagTier}
                  className="origin-left scale-[0.78]"
                />
              </div>
              <p className="mt-1 line-clamp-1 text-[8.5px] leading-snug text-white/40">
                {clan.description || "Belum ada deskripsi clan."}
              </p>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-2 text-center">
              <p className="text-[10px] font-black text-white/70">
                Belum punya clan
              </p>
              <p className="mt-0.5 text-[8px] text-white/35">
                Cari clan yang cocok
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenClan(clan?._id)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(110deg,#FFD23F,#F08A3D)] py-2 text-[9.5px] font-black text-black shadow-[0_10px_20px_-15px_rgba(255,210,63,.9)] transition hover:brightness-105 active:scale-[0.98]"
        >
          Buka Clan
          <ArrowRight className="size-3.5" strokeWidth={2.7} />
        </button>
      </div>

      <div className="flex min-h-[176px] flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(28,167,236,.17),rgba(255,255,255,.05)_48%,rgba(232,72,85,.11))] p-2.5">
        <div className="flex items-center gap-1.5">
          <Clapperboard className="size-3.5 text-sky-300" />
          <p className="text-[12px] font-black text-white">Nobar</p>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[8px] font-semibold text-white/40">
          Nonton bareng yuk! • {nobarOnline} Online
        </p>

        <div className="relative mt-1.5 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
          {room?.animeImage ? (
            <img
              src={room.animeImage}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[linear-gradient(145deg,rgba(28,167,236,.18),rgba(15,23,42,.8))] text-[8px] text-white/40">
              <Clapperboard className="size-5 text-sky-300/70" />
              Belum ada room
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5">
            <span className="line-clamp-2 block text-[8.5px] font-black leading-tight text-white">
              {room?.animeTitle || "Nobar YoruNime"}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenNobar}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(110deg,#3B82F6,#7C3AED)] py-2 text-[9.5px] font-black text-white shadow-[0_10px_20px_-15px_rgba(59,130,246,.9)] transition hover:brightness-110 active:scale-[0.98]"
        >
          Gabung nobar
          <ArrowRight className="size-3.5" strokeWidth={2.7} />
        </button>
      </div>
    </div>
  );
}
