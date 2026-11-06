import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { FramedAvatar } from "@/components/FramedAvatar";
import { BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { greetingOf, DailyQuestRow } from "@/components/HomeHead";
import { StickerStore } from "@/components/StickerStore";
import { NobarCatalogScreen } from "@/components/NobarCatalogScreen";
import { VoiceCallScreen } from "@/components/VoiceCall";
import { cn } from "@/lib/utils";
import {
  Award,
  Bone,
  ChevronLeft,
  Clapperboard,
  ListChecks,
  Mic,
  Music,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  X,
  type LucideIcon,
} from "lucide-react";

export type YoruFeature = "quest" | "sticker" | "nobar" | "voice";
type HubView = YoruFeature | "clan" | "shop" | "title" | "pet" | "music";

const BOXES: {
  key: HubView;
  label: string;
  Icon: LucideIcon;
  tone: string;
  iconTone: string;
}[] = [
  {
    key: "quest",
    label: "Quest",
    Icon: ListChecks,
    tone: "from-amber-400/22 via-white/[0.055] to-transparent",
    iconTone: "bg-amber-400/18 text-amber-200",
  },
  {
    key: "sticker",
    label: "Shop Sticker",
    Icon: Sticker,
    tone: "from-violet-400/22 via-white/[0.055] to-transparent",
    iconTone: "bg-violet-400/18 text-violet-200",
  },
  {
    key: "nobar",
    label: "Nobar",
    Icon: Clapperboard,
    tone: "from-sky-400/22 via-white/[0.055] to-transparent",
    iconTone: "bg-sky-400/18 text-sky-200",
  },
  {
    key: "voice",
    label: "Voice",
    Icon: Mic,
    tone: "from-emerald-400/22 via-white/[0.055] to-transparent",
    iconTone: "bg-emerald-400/18 text-emerald-200",
  },
  {
    key: "clan",
    label: "Clan",
    Icon: Shield,
    tone: "from-gold/22 via-white/[0.055] to-transparent",
    iconTone: "bg-gold/15 text-gold",
  },
  {
    key: "shop",
    label: "Shop",
    Icon: ShoppingBag,
    tone: "from-rose-400/20 via-white/[0.05] to-transparent",
    iconTone: "bg-rose-400/16 text-rose-200",
  },
  {
    key: "title",
    label: "Title",
    Icon: Award,
    tone: "from-indigo-400/20 via-white/[0.05] to-transparent",
    iconTone: "bg-indigo-400/16 text-indigo-200",
  },
  {
    key: "pet",
    label: "YoruPet",
    Icon: Bone,
    tone: "from-lime-400/20 via-white/[0.05] to-transparent",
    iconTone: "bg-lime-400/16 text-lime-200",
  },
  {
    key: "music",
    label: "Music",
    Icon: Music,
    tone: "from-fuchsia-400/20 via-white/[0.05] to-transparent",
    iconTone: "bg-fuchsia-400/16 text-fuchsia-200",
  },
];

function FeatureChrome({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="screen-enter fixed inset-0 z-[90] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex size-9 shrink-0 items-center justify-center text-white/85 transition active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-black text-white">{title}</h1>
          {subtitle && (
            <p className="truncate text-[10px] text-white/45">{subtitle}</p>
          )}
        </div>
        <button
          onClick={onBack}
          aria-label="Tutup"
          className="flex size-9 shrink-0 items-center justify-center text-white/55 transition active:scale-90"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function YoruVerseHubScreen({
  onClose,
  onOpenSub,
  initialFeature = null,
}: {
  onClose: () => void;
  onOpenSub: (v: "shop" | "pet" | "music") => void;
  initialFeature?: YoruFeature | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feature, setFeature] = useState<YoruFeature | null>(initialFeature);
  const [clanTag] = useState(user?.clanTag);

  if (feature === "quest") {
    return (
      <FeatureChrome
        title="Quest"
        subtitle="Misi harian · reset 00.00"
        onBack={() => setFeature(null)}
      >
        <div className="px-4 pb-10">
          <DailyQuestRow />
        </div>
      </FeatureChrome>
    );
  }
  if (feature === "sticker") {
    return (
      <FeatureChrome
        title="Shop Sticker"
        subtitle="Pack sticker untuk chat"
        onBack={() => setFeature(null)}
      >
        <StickerStore />
      </FeatureChrome>
    );
  }
  if (feature === "nobar") {
    return <NobarCatalogScreen onClose={() => setFeature(null)} />;
  }
  if (feature === "voice") {
    return <VoiceCallScreen onClose={() => setFeature(null)} />;
  }

  const open = (key: HubView) => {
    if (key === "quest" || key === "sticker" || key === "nobar" || key === "voice") {
      setFeature(key);
      return;
    }
    if (key === "clan") {
      onClose();
      navigate("/clan");
      return;
    }
    if (key === "title") {
      onClose();
      navigate("/title");
      return;
    }
    onOpenSub(key);
  };

  return (
    <div className="screen-enter fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#07080d]">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <div className="mx-auto w-full max-w-2xl">
          {/* KOTAK ATAS — foto, username, sapaan. */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(130deg,rgba(255,210,63,.14),rgba(28,167,236,.07)_45%,rgba(255,255,255,.03))] p-4">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-gold/10 blur-3xl"
            />
            <button
              onClick={onClose}
              aria-label="Tutup YoruVerse"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/70 transition active:scale-90"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3.5">
              <FramedAvatar
                border={user?.avatarBorder}
                src={user?.image}
                seed={user?.username}
                className="size-16 shrink-0 ring-2 ring-gold/35"
              />
              <div className="min-w-0 flex-1 pr-7">
                <p className="text-[10.5px] font-semibold text-white/55">
                  {greetingOf()}
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <h1 className="truncate font-display text-xl font-black leading-tight text-white">
                    {user?.username ?? "user"}
                  </h1>
                  {((user?.premiumUntil ?? 0) > Date.now()) && (
                    <BlueCheck className="size-4 shrink-0" />
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <LevelBadge level={user?.level ?? 1} />
                  {clanTag && (
                    <ClanTag
                      icon={user?.clanTagIcon ?? DEFAULT_CLAN_ICON}
                      tag={clanTag}
                      level={user?.clanLevel}
                      className="scale-90 origin-left"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
              <Sparkles className="size-3 text-gold/70" />
              Semua hal seru YoruNime ada di sini.
            </div>
          </div>

          {/* GRID 2 KOLOM — isi kotak hanya ikon + nama. */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            {BOXES.map(({ key, label, Icon, tone, iconTone }) => (
              <button
                key={key}
                onClick={() => open(key)}
                className={cn(
                  "group flex min-h-[108px] flex-col items-start justify-between rounded-[22px] border border-white/[0.08] bg-gradient-to-br p-3.5 text-left transition hover:border-white/25 active:scale-[0.97]",
                  tone,
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-2xl transition group-hover:brightness-110",
                    iconTone,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="font-display text-[14px] font-black leading-none text-white">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
