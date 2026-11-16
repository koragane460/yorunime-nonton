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
  void onHistory;
  void onDiscover;

  if (rows === undefined) return null;
  // Permintaan: kalau riwayat kosong, JANGAN tampilkan placeholder apa pun.
  if (!rows || rows.length === 0) return null;

  return (
    <section className="fade-enter mt-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="yn-sec text-[1rem]">Lanjutkan menonton</h2>
        <button
          type="button"
          onClick={onHistory}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/42 transition hover:text-white"
        >
          Riwayat <ArrowRight className="size-3" />
        </button>
      </div>
      <div className="no-bar -mr-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pr-4 pb-1">
        {rows.slice(0, 12).map((h) => {
          const duration = h.durationSec && h.durationSec > 0 ? h.durationSec : 1440;
          const progress = Math.max(0, h.progressSec ?? 0);
          const pct = Math.min(100, Math.round((progress / Math.max(1, duration)) * 100));
          return (
            <button
              key={h._id}
              type="button"
              onClick={() => onOpen(h)}
              className="group w-[158px] shrink-0 snap-start text-left transition active:scale-[0.985]"
            >
              <span className="relative block aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
                {h.animeImage ? (
                  <img
                    src={h.animeImage}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-white/30">
                    <Play className="size-5" />
                  </span>
                )}
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.35))]" />
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-1 font-mono text-[9px] font-bold text-white backdrop-blur-sm">
                  EP {h.episode}
                </span>
                <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-white text-black shadow-lg">
                  <Play className="size-3.5 fill-current" />
                </span>
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/20">
                  <span
                    className="block h-full bg-[var(--primary)]"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </span>
              </span>
              <span className="mt-2 line-clamp-1 block text-[11.5px] font-bold leading-tight text-white">
                {h.animeTitle}
              </span>
              <span className="mt-0.5 block font-mono text-[9px] font-semibold text-white/38">
                {clockOf(progress)} / {clockOf(duration)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** "16.45" dari detik — gaya jam kecil di kartu terakhir ditonton. */
function clockOf(sec?: number): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
      <h2 className="yn-sec text-[17px] font-bold">
        Event Aktif
      </h2>
      <div className="relative mt-2 overflow-hidden rounded-xl border border-white/8 bg-[#101215] p-3">
        <div className="relative flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border",
              active
                ? "border-[rgba(230,196,124,.2)] bg-[rgba(230,196,124,.06)] text-[var(--gold)]"
                : "border-white/8 bg-white/[0.025] text-white/28",
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
                <span className="shrink-0 rounded bg-[rgba(116,223,194,.12)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[var(--yn-mint)]">
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
                className="h-full rounded-full bg-[var(--primary)]"
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
            "relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[9.5px] font-bold transition active:scale-[0.99]",
            "border border-white/10 bg-white/[0.035] text-white/62 hover:bg-white/[0.06]",
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
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#121417] px-3 py-2.5 text-left transition hover:border-white/18 hover:bg-[#17191d] active:scale-[0.995]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[rgba(211,62,48,.12)] text-[var(--primary)]">
          <MessageSquare className="size-[18px]" strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[12px] font-bold tracking-tight text-white">
              Ruang komunitas
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-[var(--yn-mint)]">
              <span className="size-1.5 rounded-full bg-[var(--yn-mint)]" />
              {online ?? 0} online
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-white/40">
            Ngobrol, cari teman nobar, atau ikut clan
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-white/28" />
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
      <div className="flex min-h-[176px] flex-col overflow-hidden rounded-xl border border-white/8 bg-[#101215] p-2.5">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5 text-white/34" />
          <p className="text-[11px] font-bold text-white/72">Clan Mu</p>
        </div>

        <div className="mt-2 flex-1 rounded-lg border border-white/8 bg-[#0b0d10] p-2">
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
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] py-2 text-[9.5px] font-bold text-white/62 transition hover:bg-white/[0.06] active:scale-[0.98]"
        >
          Buka Clan
          <ArrowRight className="size-3.5" strokeWidth={2.7} />
        </button>
      </div>

      <div className="flex min-h-[176px] flex-col overflow-hidden rounded-xl border border-white/8 bg-[#101215] p-2.5">
        <div className="flex items-center gap-1.5">
          <Clapperboard className="size-3.5 text-white/34" />
          <p className="text-[11px] font-bold text-white/72">Nobar</p>
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
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#0b0d10] text-[8px] text-white/28">
              <Clapperboard className="size-5 text-white/20" />
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
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] py-2 text-[9.5px] font-bold text-white/62 transition hover:bg-white/[0.06] active:scale-[0.98]"
        >
          Gabung nobar
          <ArrowRight className="size-3.5" strokeWidth={2.7} />
        </button>
      </div>
    </div>
  );
}
