import { useNavigate } from "react-router";
import { LayoutGrid, Search, Settings } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { NotifButton } from "@/components/NotifButton";
import { FramedAvatar } from "@/components/FramedAvatar";
import { BlueCheck, ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { fmtShort, greetingOf } from "@/components/HomeHead";
import { xpForLevel } from "@/lib/level";

/**
 * Header Home memprioritaskan siapa yang sedang menonton dan seberapa jauh
 * progresnya. Aksi akun tetap satu ketuk, tetapi tidak lagi mengambil ruang
 * setinggi kartu profil penuh.
 */
export function YoruHomeHeader({ onSearch }: { onSearch?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const premium = ((user as { premiumUntil?: number } | null)?.premiumUntil ?? 0) > Date.now();
  const need = Math.max(1, xpForLevel(level));
  const inLevel = Math.max(0, Math.min(xp, need));
  const pct = Math.min(100, Math.max(2, (inLevel / need) * 100));

  return (
    <header className="fade-enter pt-2">
      <div className="flex items-center gap-3">
        <FramedAvatar
          border={(user as { avatarBorder?: string } | null)?.avatarBorder}
          src={user?.image}
          seed={user?.username}
          className="size-12 shrink-0"
        />

        <button
          type="button"
          onClick={() => navigate("/akun")}
          className="min-w-0 flex-1 text-left"
          aria-label="Buka profil dan pengaturan akun"
        >
          <span className="block truncate text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/42">
            {greetingOf()}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[17px] font-bold leading-tight tracking-[-0.02em] text-white">
              {user?.username ?? "user"}
            </span>
            {premium && <BlueCheck className="size-4 shrink-0 fill-[var(--primary)] text-white" />}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-white/52">
              Lv.{level}
            </span>
            {user?.clanTag && (
              <ClanTag
                icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={user.clanTag}
                level={user.clanLevel}
                className="max-w-[90px] scale-90 origin-left"
              />
            )}
          </span>
        </button>

        <NotifButton
          sizeClassName="size-10"
          iconClassName="size-[18px]"
          className="rounded-xl border border-white/10 bg-[#17191d] text-white/72 hover:bg-[#1d2025]"
        />
        <button
          type="button"
          onClick={() => navigate("/akun?tab=settings")}
          className="yn-icon-btn size-10 rounded-xl"
          aria-label="Pengaturan"
        >
          <Settings className="size-[18px]" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-white/38">
          EXP
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="shrink-0 font-mono text-[9px] tabular-nums text-white/38">
          {fmtShort(inLevel)} / {fmtShort(need)}
        </span>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onSearch?.()}
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-[#17191d] px-3.5 text-left transition hover:border-white/20 hover:bg-[#1b1e23] active:scale-[0.995]"
        >
          <Search className="size-[17px] shrink-0 text-white/45" />
          <span className="truncate text-[11.5px] font-semibold text-white/45">
            Cari anime, film, atau komik
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/catalog")}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#17191d] px-3 text-[11px] font-bold text-white/72 transition hover:border-white/20 hover:bg-[#1b1e23] active:scale-[0.98]"
        >
          <LayoutGrid className="size-[16px]" />
          Katalog
        </button>
      </div>
    </header>
  );
}
