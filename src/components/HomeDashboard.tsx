import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Clapperboard,
  Crown,
  Gift,
  MessageSquare,
  Percent,
  Play,
  Shield,
  Sparkles,
  Trophy,
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
  const last = rows?.[0];
  void onHistory;
  void onDiscover;

  if (rows === undefined) return null;
  // Permintaan: kalau riwayat kosong, JANGAN tampilkan placeholder apa pun.
  if (!last) return null;

  const duration =
    last.durationSec && last.durationSec > 0 ? last.durationSec : 1440;
  const progress = Math.max(0, last.progressSec ?? 0);
  const pct = Math.min(
    100,
    Math.round((progress / Math.max(1, duration)) * 100),
  );
  const minutes = Math.max(
    1,
    Math.floor((progress > 0 ? progress : (last.minutesWatched ?? 0) * 60) / 60),
  );

  return (
    <section className="fade-enter mt-3">
      <button
        type="button"
        onClick={() => onOpen(last)}
        className="group relative flex h-[112px] w-full items-center overflow-hidden rounded-[24px] border border-white/10 bg-[#1b1a20] p-3 text-left shadow-[0_20px_45px_-34px_rgba(0,0,0,.95)] transition active:scale-[0.99]"
      >
        {/* Lingkaran dekoratif besar supaya kotak tidak terasa polos. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-10 size-48 rounded-full border border-white/[0.06]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-20 size-52 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--ui-a) 16%, transparent), transparent 68%)",
          }}
        />

        <span className="relative h-[88px] w-[68px] shrink-0 overflow-hidden rounded-[15px] border border-white/12 bg-black">
          {last.animeImage ? (
            <img
              src={last.animeImage}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-white/30">
              <Play className="size-6" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,.85))] px-1.5 pb-1.5 pt-5">
            <span className="block h-[3px] overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  background: "var(--ui-c, #FFD23F)",
                }}
              />
            </span>
          </span>
        </span>

        <span className="relative flex min-w-0 flex-1 flex-col pl-3.5 pr-2">
          <span
            className="text-[7.5px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--ui-c, #FFD23F)" }}
          >
            Lanjutkan
          </span>
          <span className="mt-1 line-clamp-2 text-[14.5px] font-black leading-tight tracking-[-0.01em] text-white">
            {last.animeTitle}
          </span>
          <span className="mt-1.5 truncate text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/45">
            Epsd {last.episode} · {minutes} menit
          </span>
        </span>

        <span
          className="relative m-0.5 grid size-11 shrink-0 place-items-center rounded-full text-black shadow-[0_10px_24px_-12px_rgba(0,0,0,.9)] transition group-hover:scale-105"
          style={{ background: "var(--ui-c, #FFD23F)" }}
        >
          <Play className="size-[18px] translate-x-px fill-current" />
        </span>
      </button>
    </section>
  );
}

/** Banner beli premium tiga panel, mengikuti referensi. */
export function HomePremiumCard({ onBuy }: { onBuy: () => void }) {
  const panels = [
    {
      badge: "50% OFF",
      title: "Flash Sale",
      desc: "Penawaran spesial untukmu!",
      button: "Beli Sekarang",
      Icon: Percent,
      bg: "linear-gradient(125deg,#2a0308 0%,#4b0810 48%,#1a0206 100%)",
      accent: "#ff6076",
      border: "#ff536b",
      badgeBg: "#ff2f4f",
    },
    {
      badge: "Premium",
      title: "Premium",
      desc: "Nikmati fitur eksklusif!",
      button: "Upgrade Sekarang",
      Icon: Crown,
      bg: "linear-gradient(125deg,#2a1a00 0%,#4b3000 44%,#241600 100%)",
      accent: "#ffd23f",
      border: "#ffd75e",
      badgeBg: "#e1af1e",
    },
    {
      badge: "Lainnya",
      title: "Lainnya",
      desc: "Temukan lebih banyak!",
      button: "Lihat Semua",
      Icon: Gift,
      bg: "linear-gradient(125deg,#04142a 0%,#092a55 50%,#03101f 100%)",
      accent: "#6fb6ff",
      border: "#79baff",
      badgeBg: "#1f6fe5",
    },
  ] as const;

  return (
    <div className="fade-enter mt-3 overflow-hidden rounded-[20px] border border-white/12 bg-[#07080d] shadow-[0_22px_50px_-32px_rgba(0,0,0,.95)]">
      <div className="grid grid-cols-3">
        {panels.map((p, i) => (
          <button
            key={p.title}
            type="button"
            onClick={onBuy}
            className={cn(
              "relative flex min-h-[146px] flex-col overflow-hidden px-2 py-2.5 text-left transition active:brightness-110",
              i > 0 && "border-l border-white/12",
            )}
            style={{ background: p.bg }}
          >
            <span
              className="relative z-10 w-fit rounded-full px-1.5 py-0.5 text-[7px] font-black"
              style={{ background: p.badgeBg, color: i === 1 ? "#332100" : "#fff" }}
            >
              {p.badge}
            </span>
            <span
              className="relative z-10 mt-1.5 grid size-9 place-items-center rounded-xl text-white"
              style={{ background: `color-mix(in srgb, ${p.accent} 28%, #111)` }}
            >
              <p.Icon className="size-5" fill={i === 1 ? "currentColor" : "none"} strokeWidth={2.3} />
            </span>
            <span className="relative z-10 mt-1.5 text-[12px] font-black leading-none tracking-tight text-white">
              {p.title.split(" ").map((w, wi) => (
                <span key={w} style={{ color: wi === 1 ? p.accent : undefined }}>
                  {w}{wi === 0 && p.title.includes(" ") ? " " : ""}
                </span>
              ))}
            </span>
            <span className="relative z-10 mt-1 text-[6.5px] font-medium leading-snug text-white/55">
              {p.desc}
            </span>
            <span
              className="relative z-10 mt-auto flex items-center justify-center gap-0.5 rounded-full border px-1.5 py-1 text-[7px] font-bold text-white"
              style={{ borderColor: `${p.border}aa` }}
            >
              {p.button} <ArrowRight className="size-2" strokeWidth={3} />
            </span>
            <Sparkles className="pointer-events-none absolute right-2 top-9 size-2" style={{ color: p.accent }} />
          </button>
        ))}
      </div>
    </div>
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

/** Kartu Global Chat Home — persegi panjang, ikon polos, garis pemisah. */
export function HomeCommunityCard({ onOpenChat }: { onOpenChat: () => void }) {
  const online = useQuery(api.presence.onlineCount, {});

  return (
    <section className="fade-enter mt-3">
      <button
        type="button"
        onClick={onOpenChat}
        className="flex w-full items-stretch gap-2.5 rounded-[18px] border border-white/10 bg-[#16151b] px-3 py-2.5 text-left transition active:scale-[0.995]"
      >
        <span className="flex shrink-0 items-center justify-center self-center text-[var(--ui-c)]">
          <MessageSquare className="size-6" strokeWidth={2.4} />
        </span>
        <span
          aria-hidden
          className="w-px shrink-0 self-stretch bg-white/12"
        />
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="flex items-center gap-2">
            <span className="text-[13px] font-black tracking-tight text-white">
              Global Chat
            </span>
            <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-300/85">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {online ?? 0} online
            </span>
          </span>
          <span className="mt-0.5 truncate text-[9px] font-medium text-white/35">
            Ngobrol dengan orang yang sedang online
          </span>
        </span>
        <ArrowRight className="size-3.5 shrink-0 self-center text-white/22" />
      </button>
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
