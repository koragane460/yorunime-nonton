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
  Clapperboard,
  Gem,
  MessageSquare,
  Play,
  Shield,
  Star,
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
}: {
  onOpen: (h: HistoryRow) => void;
  onHistory: () => void;
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
        <div className="flex items-center gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/[0.035] p-4 text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300">
            <Play className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-white">
              Belum ada riwayat nonton
            </span>
            <span className="mt-0.5 block text-[10.5px] leading-snug text-white/45">
              Mulai satu episode, nanti progresnya muncul di sini.
            </span>
          </span>
          <button
            type="button"
            onClick={onHistory}
            className="shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 text-[9px] font-black text-white/65"
          >
            Riwayat
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
        className="group relative w-full overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(115deg,rgba(28,167,236,.15),rgba(255,255,255,.045)_44%,rgba(232,72,85,.09))] p-2.5 text-left shadow-[0_20px_45px_-34px_rgba(0,0,0,.95)] transition active:scale-[0.99]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-9 -top-12 size-32 rounded-full bg-sky-400/10 blur-3xl"
        />
        <div className="relative flex gap-3">
          <div className="w-[104px] shrink-0">
            <div className="relative h-[132px] overflow-hidden rounded-2xl border border-white/10 bg-black">
              {last.animeImage ? (
                <img
                  src={last.animeImage}
                  alt=""
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-white/30">
                  <Play className="size-7" />
                </span>
              )}
              <span className="absolute left-0 top-0 rounded-br-xl bg-gold-strong px-2 py-1 text-[9px] font-black text-black">
                Ep {last.episode}
              </span>
            </div>
            <div className="mt-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#7FD3F7)]"
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[8.5px] font-bold text-white/45">
                <span>{minutes > 0 ? `${minutes} mnt` : "Baru mulai"}</span>
                <span>{pct}%</span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col py-0.5">
            <p className="line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-white">
              {last.animeTitle}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[9.5px] font-semibold text-white/45">
              <Play className="size-3 shrink-0 text-sky-300" />
              <span className="truncate">{watchedLabel(last.updatedAt)}</span>
            </p>
            <div className="mt-auto pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                  <Star className="size-2.5 fill-current" />
                  {typeof score === "number" ? score.toFixed(1) : "—"}
                </span>
                <span className="text-[10px] font-black text-sky-200">
                  {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7FD3F7,#FFD23F)]"
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </button>
    </section>
  );
}

/** Kartu ajakan Premium — ikon kristal, harga mulai, dan CTA. */
export function HomePremiumCard({ onBuy }: { onBuy: () => void }) {
  return (
    <button
      type="button"
      onClick={onBuy}
      className="fade-enter group relative mt-2.5 flex w-full items-center gap-3 overflow-hidden rounded-[22px] border border-gold/30 bg-[linear-gradient(115deg,rgba(255,210,63,.14),rgba(232,72,85,.06)_52%,rgba(127,211,247,.07))] p-3 text-left transition active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-10 size-24 rounded-full bg-gold/10 blur-2xl"
      />
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/12 text-gold">
        <Gem className="size-5" strokeWidth={2.1} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="line-clamp-2 block text-[11.5px] font-black leading-snug text-white">
          Beli Premium mulai dari Rp5.000,00
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[9px] font-medium leading-snug text-white/45">
          Unlock manga &amp; manhwa baca tanpa batas
        </span>
      </span>
      <span className="relative shrink-0 rounded-full bg-gold px-3 py-1.5 text-[9.5px] font-black text-black">
        Beli Sekarang
      </span>
    </button>
  );
}

/** Event aktif — saat ini belum ada event, jadi tampil empty state. */
export function ActiveEventCard() {
  return (
    <section className="fade-enter mt-5">
      <h2 className="text-[17px] font-black tracking-tight text-white">
        Event Aktif
      </h2>
      <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] py-5 text-center">
        <p className="text-[11px] font-semibold text-white/35">Belum ada event</p>
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
      <h2 className="text-[17px] font-black tracking-tight text-white">
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.065] py-2.5 text-[11px] font-black text-white/80 transition hover:bg-white/[0.1] active:scale-[0.99]"
        >
          Buka Chat
          <ArrowRight className="size-4" />
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

  return (
    <div className="fade-enter mt-2.5 grid grid-cols-2 gap-2.5">
      <div className="flex min-h-[202px] flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(255,210,63,.12),rgba(255,255,255,.045)_46%,rgba(123,216,143,.08))] p-2.5">
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
          className="mt-2 w-full rounded-lg border border-gold/35 bg-gold/15 py-2 text-[9.5px] font-black text-gold transition active:scale-[0.98]"
        >
          Buka Clan
        </button>
      </div>

      <div className="flex min-h-[202px] flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(28,167,236,.14),rgba(255,255,255,.045)_48%,rgba(232,72,85,.08))] p-2.5">
        <div className="flex items-center gap-1.5">
          <Clapperboard className="size-3.5 text-sky-300" />
          <p className="text-[12px] font-black text-white">Nobar</p>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[8px] font-semibold text-white/40">
          Nonton bareng yuk! • {rooms?.length ?? 0} Online
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
          className="mt-2 w-full rounded-lg border border-sky-300/35 bg-sky-400/15 py-2 text-[9.5px] font-black text-sky-100 transition active:scale-[0.98]"
        >
          Gabung nobar
        </button>
      </div>
    </div>
  );
}
