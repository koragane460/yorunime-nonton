import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { Avatar, UserBadges } from "@/components/lstream-ui";
import { Home, CalendarDays, UserRound, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { avatarFallback, clanNameCls } from "@/lib/lstream";
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
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-3 pb-28">
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
          hideOnline={user.hideOnline}
        />
      )}
      <div className="flex-1">{children}</div>
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
  hideOnline?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="relative mt-3 block w-full overflow-hidden rounded-2xl border border-yellow-500/30 text-left transition hover:border-yellow-400/60"
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
      <div className="flex items-center gap-3 bg-black/45 p-3 backdrop-blur-sm">
        <Avatar src={image} seed={name} className="size-14" online={!hideOnline} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold">{name}</p>
            {premium && (
              <span className="rounded bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                ✓
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">ID: {id}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <UserBadges level={level} staffRole={staffRole} />
            {clanTag && (
              <span
                className={cn(
                  "rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold",
                  clanNameCls(clanColor) || "text-yellow-200",
                )}
              >
                {clanTagIcon} [{clanTag}]
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </div>
    </button>
  );
}

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = [
    { path: "/", label: "Home", icon: Home },
    { path: "/jadwal", label: "Jadwal Anime", icon: CalendarDays },
    { path: "/akun", label: "Akun", icon: UserRound },
  ];
  return (
    <>
      {/* Footer hitam */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-yellow-500/20 bg-black/95 py-2 text-center text-[11px] text-zinc-500">
        LStream © {new Date().getFullYear()} — Nonton anime sub Indonesia
      </footer>
      {/* Navbar pill glass */}
      <nav className="fixed inset-x-0 bottom-9 z-40 flex justify-center px-4">
        <div className="glass-nav flex items-center gap-1 rounded-full px-2 py-1.5 shadow-2xl">
          {items.map((it) => {
            const active =
              it.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(it.path);
            const Icon = it.icon;
            return (
              <button
                key={it.path}
                onClick={() => navigate(it.path)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition",
                  active
                    ? "bg-yellow-500 text-black shadow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{it.label}</span>
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

export { useQuery };
