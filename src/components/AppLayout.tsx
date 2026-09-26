import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { Avatar, UserBadges } from "@/components/lstream-ui";
import {
  Home,
  CalendarDays,
  UserRound,
  Users,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { clanNameCls } from "@/lib/lstream";
import type { ComponentType } from "react";
import type { ReactNode } from "react";

export function AppLayout({
  children,
  hideAccountPanel,
}: {
  children: ReactNode;
  hideAccountPanel?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ensure = useMutation(api.account.ensureUser);

  useEffect(() => {
    if (user) void ensure();
  }, [user, ensure]);

  const isAuth = location.pathname.startsWith("/auth");
  if (isAuth) return <>{children}</>;

  const showPanel = !hideAccountPanel;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-3 pb-32">
      {showPanel && user && (
        <AccountPanel
          onOpen={() => navigate("/akun")}
          name={user.username ?? "user"}
          id={user._id.slice(-6).toUpperCase()}
          image={user.image}
          level={user.level ?? 1}
          staffRole={user.staffRole}
          bannerUrl={user.bannerUrl}
          clanTag={user.clanTag}
          clanTagIcon={user.clanTagIcon}
          clanColor={user.clanNameColor}
          premium={(user.premiumUntil ?? 0) > Date.now()}
          diamonds={user.diamonds ?? 0}
          hideOnline={user.hideOnline}
        />
      )}
      {/* Animasi halus setiap kali layar berpindah */}
      <div key={location.pathname} className="screen-enter flex-1">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

function AccountPanel({
  onOpen,
  name,
  id,
  image,
  level,
  staffRole,
  bannerUrl,
  clanTag,
  clanTagIcon,
  clanColor,
  premium,
  diamonds,
  hideOnline,
}: {
  onOpen: () => void;
  name: string;
  id: string;
  image?: string;
  level: number;
  staffRole?: string;
  bannerUrl?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanColor?: string;
  premium: boolean;
  diamonds: number;
  hideOnline?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="pop-enter relative mt-3 block w-full overflow-hidden rounded-2xl border border-white/10 text-left transition hover:border-amber-300/50"
      style={
        bannerUrl
          ? {
              backgroundImage: `url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Fallback gradasi merah tua ke hitam saat banner kosong */}
      {!bannerUrl && <div className="bg-hero-gradient absolute inset-0" />}
      <div className="relative flex items-center gap-3 bg-black/45 p-3">
        <Avatar src={image} seed={name} className="size-14" online={!hideOnline} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold">{name}</p>
            {premium && (
              <span className="rounded bg-amber-300 px-1.5 text-[10px] font-black text-black">
                ✓ PREMIUM
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <UserBadges level={level} staffRole={staffRole} />
            {clanTag && (
              <span
                className={cn(
                  "rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold",
                  clanNameCls(clanColor) || "text-amber-200",
                )}
              >
                {clanTagIcon} [{clanTag}]
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            ID: {id} · 💎 {diamonds.toLocaleString("id-ID")}
          </p>
        </div>
        <ChevronRight className="size-5 text-zinc-500" />
      </div>
    </button>
  );
}

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const items: { path: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { path: "/", label: "Home", icon: Home },
    { path: "/jadwal", label: "Jadwal", icon: CalendarDays },
    { path: "/clan", label: "Clan", icon: Users },
    { path: "/akun", label: "Akun", icon: UserRound },
  ];
  return (
    <>
      {/* Footer hitam pipih di paling bawah */}
      <footer className="fixed inset-x-0 bottom-0 z-30 bg-black py-1.5 text-center text-[10px] text-zinc-500">
        LStream © {new Date().getFullYear()} — Nonton anime sub Indonesia
      </footer>
      {/* Navbar lurus full-width, solid (bukan glass, tidak rounded) */}
      <nav className="nav-bar fixed inset-x-0 bottom-6 z-40">
        <div className="mx-auto grid w-full max-w-2xl grid-cols-4">
          {items.map((it) => {
            const active =
              it.path === "/"
                ? location.pathname === "/" ||
                  location.pathname.startsWith("/dashboard") ||
                  location.pathname.startsWith("/home")
                : location.pathname.startsWith(it.path);
            const Icon = it.icon;
            return (
              <button
                key={it.path}
                onClick={() => navigate(it.path)}
                className="nav-item relative flex flex-col items-center gap-0.5 py-2"
              >
                <Icon
                  className={cn(
                    "size-[22px]",
                    active ? "text-amber-300" : "text-zinc-500",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-foreground" : "text-zinc-500",
                  )}
                >
                  {it.label}
                </span>
                {active && (
                  <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-amber-300" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function useAccountBannerStyle(bannerUrl?: string) {
  return bannerUrl
    ? {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
}
