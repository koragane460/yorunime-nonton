import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import {
  ChevronLeft,
  Gem,
  Crown,
  X,
  MessageSquare,
  History as HistoryIcon,
  Heart,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { xpForLevel } from "@/lib/level";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Detail akun (diri sendiri / orang lain) — muncul saat avatar di chat diklik:
 * banner paling atas, foto profile setengah menutupi banner di tengah,
 * username + centang biru + ID, tag clan + level, tombol Komen/History/Favorite.
 */
export function ProfileSheet({
  userId,
  onClose,
}: {
  userId: Id<"users">;
  onClose: () => void;
}) {
  const profile = useQuery(api.account.getPublicProfile, { userId });
  const cost = profile ? xpForLevel(profile.level) : 1;
  const inLevel = profile ? Math.max(0, Math.min(profile.xpInLevel, cost)) : 0;
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);

  return (
    <div className="screen-enter fixed inset-0 z-[70] overflow-y-auto bg-background">
      {!profile ? (
        <p className="py-24 text-center text-sm text-muted-foreground">Memuat profil…</p>
      ) : (
        <div className="w-full pb-24">
          {/* Banner paling atas */}
          <div className="relative">
            <div
              className="h-32 w-full bg-cover bg-center"
              style={
                profile.bannerUrl
                  ? { backgroundImage: `url(${profile.bannerUrl})` }
                  : undefined
              }
            >
              {!profile.bannerUrl && <div className="h-full w-full bg-hero-gradient" />}
            </div>
            <button
              onClick={onClose}
              className="absolute left-4 top-3 rounded-full bg-black/60 p-2 text-white"
              aria-label="Tutup"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="absolute right-4 top-3 rounded-full bg-black/60 p-2 text-white"
              aria-label="Tutup profil"
            >
              <X className="size-4" />
            </button>

            {/* Foto profile setengah menutupi banner, di tengah */}
            <div className="relative -mt-10 flex justify-center">
              <Avatar
                src={profile.image}
                seed={profile.username}
                className="size-24 border-4 border-background"
                online={!profile.hideOnline}
              />
            </div>
          </div>

          <div className="px-4 text-center">
            {/* Username + centang biru + ID */}
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <p className="text-lg font-black text-white">{profile.username ?? "user"}</p>
              {profile.premium && <BlueCheck className="size-5" />}
            </div>
            <p className="text-xs text-zinc-400">
              ID: {profile.seqId !== undefined ? `#${profile.seqId}` : "—"}
            </p>

            {/* Tag clan + level */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {profile.clanTag && (
                <ClanTag
                  icon={profile.clanTagIcon ?? "⚔️"}
                  tag={profile.clanTag}
                  color={profile.clanNameColor}
                />
              )}
              <LevelBadge level={profile.level} />
            </div>

            {/* Bar level: kiri Level n, kanan 1/12.000 */}
            <div className="mx-auto mt-3 max-w-sm">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">Level {profile.level}</span>
                <span className="text-zinc-300">
                  {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/25">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Diamond + premium */}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1 font-semibold text-cyan-300">
                <Gem className="size-3.5" /> {profile.diamonds.toLocaleString("id-ID")}
              </span>
              {profile.premium && (
                <span className="flex items-center gap-1 font-semibold text-gold">
                  <Crown className="size-3.5" /> {profile.premiumDays} hari
                </span>
              )}
            </div>

            {/* Stats horizontal tanpa background */}
            <div className="mt-4 grid grid-cols-4 divide-x divide-white/15 text-center">
              <StatCell label="History" value={profile.watchCount} />
              <StatCell label="Komen" value={profile.commentCount} />
              <StatCell
                label="Bergabung"
                value={`${Math.max(0, Math.floor((Date.now() - profile.joinedAt) / 86400000))}h`}
              />
              <StatCell label="Menit" value={profile.minutesWatched} />
            </div>

            {/* Tombol aksi: Komen / History / Favorite */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionBtn
                icon={<MessageSquare className="size-4" />}
                label="Komen"
                active
              />
              <ActionBtn icon={<HistoryIcon className="size-4" />} label="History" />
              <ActionBtn icon={<Heart className="size-4" />} label="Favorite" />
            </div>

            {profile.premium === false && (
              <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <LogIn className="size-3.5" /> Belum premium — centang biru eksklusif ✨
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="py-1">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-400">{label}</p>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition",
        active
          ? "border-violet-500 bg-violet-500/15 text-violet-300"
          : "border-border bg-card text-foreground hover:border-violet-500/60",
      )}
    >
      {icon} {label}
    </button>
  );
}
