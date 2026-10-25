import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useHideNavOnMount } from "@/components/AppLayout";
import {
  Trophy,
  Users,
  Radio,
  Clock,
  Heart,
  MessageCircle,
  LayoutGrid,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaderboardScreen } from "@/components/leaderboard/LeaderboardScreen";
import { InfoContent } from "@/pages/Info";
import { VoteCatalogScreen } from "@/components/VoteCatalogScreen";
import { FriendsCatalogScreen } from "@/components/FriendsCatalogScreen";
import { AdofimaScreen } from "@/components/AdofimaScreen";
import { NobarCatalogScreen } from "@/components/NobarCatalogScreen";
import { BubbleChatScreen } from "@/components/BubbleChatScreen";

/** Shell layar penuh untuk isi Catalog: strip-back di kiri atas, tanpa
    background rounded (konsisten dengan Leaderboard). */
function FullScreen({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3 pb-10">
        <div className="mb-3 mt-3 flex items-center gap-2">
          <button onClick={onClose} aria-label="Kembali" className="-ml-1 flex items-center py-1 pr-2 text-white/90 transition active:opacity-60">
            <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden>
              <path d="M25 9H2M8 2 1.5 9 8 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-extrabold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

type Screen = null | "leaderboard" | "friends" | "nobar" | "history" | "voteWaifu" | "voteHusbu" | "bubble" | "adofima";

interface Box {
  key: Exclude<Screen, null>;
  label: string;
  Icon: LucideIcon;
  from: string;
  to: string;
  ring: string;
}

const BOXES: Box[] = [
  { key: "leaderboard", label: "Leaderboard", Icon: Trophy, from: "from-amber-300", to: "to-orange-400", ring: "ring-amber-400/40" },
  { key: "friends", label: "Teman", Icon: Users, from: "from-sky-300", to: "to-blue-400", ring: "ring-sky-400/40" },
  { key: "nobar", label: "Nobar", Icon: Radio, from: "from-rose-300", to: "to-pink-400", ring: "ring-rose-400/40" },
  { key: "history", label: "History", Icon: Clock, from: "from-emerald-300", to: "to-teal-400", ring: "ring-emerald-400/40" },
  { key: "voteWaifu", label: "Vote Waifu", Icon: Heart, from: "from-fuchsia-300", to: "to-purple-400", ring: "ring-fuchsia-400/40" },
  { key: "bubble", label: "Bubble Chat", Icon: MessageCircle, from: "from-cyan-300", to: "to-sky-400", ring: "ring-cyan-400/40" },
  { key: "adofima", label: "Adofima-nga", Icon: LayoutGrid, from: "from-lime-300", to: "to-green-400", ring: "ring-lime-400/40" },
];

export default function Catalog() {
  return (
    <AppLayout>
      <CatalogContent />
    </AppLayout>
  );
}

function CatalogContent() {
  useHideNavOnMount();
  const [screen, setScreen] = useState<Screen>(null);
  const [voteKind, setVoteKind] = useState<"waifu" | "husbu">("waifu");

  return (
    <div className="pb-6 pt-2">
      <header className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">Catalog</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {BOXES.map((b) => (
          <button
            key={b.key}
            onClick={() => {
              if (b.key === "voteWaifu") setVoteKind("waifu");
              setScreen(b.key);
            }}
            className={cn(
              "group relative flex h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl text-white shadow-lg ring-1 transition active:scale-[0.97]",
              `bg-gradient-to-br ${b.from} ${b.to}`,
              b.ring,
            )}
          >
            <b.Icon className="size-8 drop-shadow" strokeWidth={2} />
            <span className="text-sm font-extrabold drop-shadow">{b.label}</span>
          </button>
        ))}
        {/* Kotak ke-6: Vote Husbu — di samping Vote Waifu, punya titik tiga
            sendiri untuk beranti jenis vote. */}
        <button
          onClick={() => {
            setVoteKind("husbu");
            setScreen("voteWaifu");
          }}
          className={cn(
            "group relative flex h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl text-white shadow-lg ring-1 transition active:scale-[0.97]",
            "bg-gradient-to-br from-pink-300 to-rose-400 ring-rose-400/40",
          )}
        >
          <Heart className="size-8 drop-shadow" strokeWidth={2} />
          <span className="text-sm font-extrabold drop-shadow">Vote Husbu</span>
        </button>
      </div>

      {screen === "leaderboard" && <LeaderboardScreen onClose={() => setScreen(null)} />}
      {screen === "history" && (
        <FullScreen title="History" onClose={() => setScreen(null)}>
          <InfoContent />
        </FullScreen>
      )}
      {screen === "bubble" && (
        <FullScreen title="Bubble Chat" onClose={() => setScreen(null)}>
          <BubbleChatScreen />
        </FullScreen>
      )}
      {screen === "nobar" && (
        <FullScreen title="Nobar" onClose={() => setScreen(null)}>
          <NobarCatalogScreen onClose={() => setScreen(null)} />
        </FullScreen>
      )}
      {screen === "adofima" && (
        <FullScreen title="Adofima-nga" onClose={() => setScreen(null)}>
          <AdofimaScreen onClose={() => setScreen(null)} />
        </FullScreen>
      )}
      {screen === "friends" && (
        <FullScreen title="Teman" onClose={() => setScreen(null)}>
          <FriendsCatalogScreen />
        </FullScreen>
      )}
      {screen === "voteWaifu" && (
        <FullScreen title="Vote" onClose={() => setScreen(null)}>
          <VoteCatalogScreen
            kind={voteKind}
            onKindChange={setVoteKind}
            onClose={() => setScreen(null)}
          />
        </FullScreen>
      )}
    </div>
  );
}
