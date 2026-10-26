import { useEffect, useRef, useState } from "react";
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
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LeaderboardScreen,
  LB_MENU,
  type LbMenuKey,
} from "@/components/leaderboard/LeaderboardScreen";
import { InfoContent } from "@/pages/Info";
import { VoteCatalogScreen } from "@/components/VoteCatalogScreen";
import { FriendsCatalogScreen } from "@/components/FriendsCatalogScreen";
import { AdofimaScreen } from "@/components/AdofimaScreen";
import { NobarCatalogScreen } from "@/components/NobarCatalogScreen";
import { BubbleChatScreen } from "@/components/BubbleChatScreen";

/** Shell isi Catalog — TIDAK fullscreen: panel ini menempel di dalam halaman
    catalog (scroll mengikuti halaman), strip-back di kiri atas tanpa judul. */
function FullScreen({ onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="screen-enter w-full pb-10 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onClose} aria-label="Kembali" className="-ml-1 flex items-center py-1 pr-2 text-white/90 transition active:opacity-60">
          <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden>
            <path d="M25 9H2M8 2 1.5 9 8 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {children}
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
  /** Warna ikon — latar kotak gelap, aksen lewat ikon. */
  icon: string;
}

const BOXES: Box[] = [
  { key: "leaderboard", label: "Leaderboard", Icon: Trophy, from: "from-amber-300", to: "to-orange-400", ring: "ring-amber-400/30", icon: "text-amber-400" },
  { key: "friends", label: "Teman", Icon: Users, from: "from-sky-300", to: "to-blue-400", ring: "ring-sky-400/30", icon: "text-sky-400" },
  { key: "nobar", label: "Nobar", Icon: Radio, from: "from-rose-300", to: "to-pink-400", ring: "ring-rose-400/30", icon: "text-rose-400" },
  { key: "history", label: "History", Icon: Clock, from: "from-emerald-300", to: "to-teal-400", ring: "ring-emerald-400/30", icon: "text-emerald-400" },
  { key: "voteWaifu", label: "Vote Waifu", Icon: Heart, from: "from-fuchsia-300", to: "to-purple-400", ring: "ring-fuchsia-400/30", icon: "text-fuchsia-400" },
  { key: "bubble", label: "Bubble Chat", Icon: MessageCircle, from: "from-cyan-300", to: "to-sky-400", ring: "ring-cyan-400/30", icon: "text-cyan-400" },
  { key: "adofima", label: "Adofima-nga", Icon: LayoutGrid, from: "from-lime-300", to: "to-green-400", ring: "ring-lime-400/30", icon: "text-lime-400" },
];

/** Latar kotak: dasar gelap + WASH gradasi warna (dari/to di tiap kotak)
 *  supaya tiap kotak terlihat berwarna & cool, bukan abu-abu polos. */
const BOX_BG = "bg-gradient-to-b from-zinc-900 via-zinc-950 to-black";

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
  const [voteMenu, setVoteMenu] = useState(false);
  const voteRef = useRef<HTMLDivElement>(null);
  // Titik tiga LEADERBOARD — berada DI LUAR layar (di kotaknya, sama
  // persis seperti kotak Vote Waifu), bukan di dalam layar leaderboard.
  const [lbMenu, setLbMenu] = useState(false);
  const [lbView, setLbView] = useState<LbMenuKey | null>(null);
  const lbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voteMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (voteRef.current && !voteRef.current.contains(e.target as Node)) setVoteMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [voteMenu]);

  useEffect(() => {
    if (!lbMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (lbRef.current && !lbRef.current.contains(e.target as Node)) setLbMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [lbMenu]);

  return (
    <div className="pb-6 pt-2">
      {screen === null && (
      <div className="grid grid-cols-2 gap-3">
        {BOXES.map((b) =>
          b.key === "voteWaifu" ? (
            /* Kotak vote punya TITIK TIGA di dalam kotaknya (di luar isi),
               buat ganti Waifu ⇄ Husbu — tiap pilihan kotaknya sendiri. */
            <div key={b.key} ref={voteRef} className="relative">
              <button
                onClick={() => setScreen("voteWaifu")}
                className={cn(
                  "group relative flex h-56 w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-3xl border shadow-lg shadow-black/40 transition hover:brightness-110 active:scale-[0.97]",
                  BOX_BG,
                  voteKind === "husbu" ? "border-rose-400/40" : b.ring,
                )}
              >
                <span
                  aria-hidden
                  className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30", b.from, b.to)}
                />
                <b.Icon
                  className={cn("relative size-9 drop-shadow", voteKind === "husbu" ? "text-rose-400" : b.icon)}
                  strokeWidth={2}
                />
                <span className="relative text-sm font-extrabold text-white">
                  {voteKind === "husbu" ? "Vote Husbu" : "Vote Waifu"}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVoteMenu((v) => !v);
                }}
                aria-label="Ganti jenis vote"
                className="absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white/85 transition active:scale-90"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {voteMenu && (
                <div className="absolute right-2 top-11 z-30 flex w-40 flex-col gap-2">
                  <button
                    onClick={() => {
                      setVoteKind((k) => (k === "waifu" ? "husbu" : "waifu"));
                      setVoteMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/12 bg-neutral-900/95 px-3 py-2.5 text-left text-xs font-bold text-white/90 shadow-2xl backdrop-blur-xl transition hover:bg-white/10"
                  >
                    <Heart className="size-4 text-rose-300" />
                    {voteKind === "waifu" ? "Vote Husbu" : "Vote Waifu"}
                  </button>
                </div>
              )}
            </div>
          ) : b.key === "leaderboard" ? (
            /* Kotak Leaderboard punya TITIK TIGA di LUAR kotaknya — sama
               seperti Vote Waifu — buat pilih Top Give Prem / Clan. */
            <div key={b.key} ref={lbRef} className="relative">
              <button
                onClick={() => setScreen("leaderboard")}
                className={cn(
                  "group relative flex h-56 w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-3xl border shadow-lg shadow-black/40 transition hover:brightness-110 active:scale-[0.97]",
                  BOX_BG,
                  b.ring,
                )}
              >
                <span
                  aria-hidden
                  className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30", b.from, b.to)}
                />
                <b.Icon className={cn("relative size-9 drop-shadow", b.icon)} strokeWidth={2} />
                <span className="relative text-sm font-extrabold text-white">{b.label}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLbMenu((v) => !v);
                }}
                aria-label="Menu leaderboard"
                className="absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white/85 transition active:scale-90"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {lbMenu && (
                <div className="absolute right-2 top-11 z-30 flex w-40 flex-col gap-2">
                  {LB_MENU.map((m, mi) => (
                    <button
                      key={m.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLbView(m.key);
                        setScreen("leaderboard");
                        setLbMenu(false);
                      }}
                      style={{ animationDelay: `${mi * 90}ms` }}
                      className="lb-menu-item flex w-full items-center gap-2 rounded-xl border border-white/12 bg-neutral-900/95 px-3 py-2.5 text-left text-xs font-bold text-white/90 shadow-2xl backdrop-blur-xl transition hover:bg-white/10"
                    >
                      <m.Icon className={cn("size-3.5", m.iconCls)} /> {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              key={b.key}
              onClick={() => {
                setScreen(b.key);
              }}
              className={cn(
                "group relative flex h-56 flex-col items-center justify-center gap-2.5 overflow-hidden rounded-3xl border shadow-lg shadow-black/40 transition hover:brightness-110 active:scale-[0.97]",
                BOX_BG,
                b.ring,
              )}
            >
              <span
                aria-hidden
                className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30", b.from, b.to)}
              />
              <b.Icon className={cn("relative size-9 drop-shadow", b.icon)} strokeWidth={2} />
              <span className="relative text-sm font-extrabold text-white">{b.label}</span>
            </button>
          ),
        )}
      </div>
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen
          onClose={() => setScreen(null)}
          initialView={lbView ?? undefined}
        />
      )}
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
