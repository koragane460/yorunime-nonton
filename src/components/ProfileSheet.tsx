import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import { ChevronLeft, Gem, Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Detail akun (diri sendiri / orang lain) — muncul saat avatar di chat diklik:
 * banner paling atas, foto profile setengah menutupi banner di tengah,
 * username + centang biru + ID, tag clan + level, stats horizontal tanpa background.
 */
export function ProfileSheet({
  userId,
  onClose,
}: {
  userId: Id<"users">;
  onClose: () => void;
}) {
  const profile = useQuery(api.account.getPublicProfile, { userId });

  return (
    <div className="screen-enter fixed inset-0 z-[70] overflow-y-auto bg-background">
      {!profile ? (
        <p className="py-24 text-center text-sm text-muted-foreground">Memuat profil…</p>
      ) : (
        <div className="mx-auto max-w-2xl pb-24">
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
              className="absolute left-3 top-3 rounded-full bg-black/55 p-2 backdrop-blur transition hover:border-violet-500"
              aria-label="Tutup"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-black/55 p-2 backdrop-blur"
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
              <p className="text-lg font-black">{profile.username ?? "user"}</p>
              {profile.premium && <BlueCheck className="size-5" />}
            </div>
            <p className="text-xs text-muted-foreground">
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

            {/* Diamond + premium */}
            <div className="mt-2.5 flex items-center justify-center gap-4 text-xs">
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
            <div className={cn("mt-4 grid grid-cols-4 gap-2")}>
              <StatCell label="History" value={profile.watchCount} />
              <StatCell label="Komen" value={profile.commentCount} />
              <StatCell
                label="Bergabung"
                value={`${Math.max(0, Math.floor((Date.now() - profile.joinedAt) / 86400000))}h`}
              />
              <StatCell label="Menit" value={profile.minutesWatched} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
