import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Trophy,
  Users,
  Radio,
  Clock,
  Heart,
  MessageCircle,
  LayoutGrid,
  MoreHorizontal,
  Download,
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
import { DownloadsPanel } from "@/components/HomeTopButtons";

/** Shell isi Catalog — TIDAK fullscreen: panel ini menempel di dalam halaman
    catalog (scroll mengikuti halaman), strip-back di kiri atas tanpa judul. */
function FullScreen({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="screen-enter w-full pb-10 pt-1">
      <div className="mb-4 flex h-12 items-center gap-2 border-b border-white/7">
        <button onClick={onClose} aria-label="Kembali" className="flex size-9 items-center justify-center text-white/70 transition active:opacity-60">
          <svg width="22" height="16" viewBox="0 0 26 18" fill="none" aria-hidden>
            <path d="M25 9H2M8 2 1.5 9 8 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="font-display text-[18px] font-bold tracking-[-0.03em]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type Screen = null | "leaderboard" | "friends" | "nobar" | "history" | "voteWaifu" | "voteHusbu" | "bubble" | "adofima" | "download";

interface Box {
  key: Exclude<Screen, null>;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

const BOXES: Box[] = [
  { key: "leaderboard", label: "Leaderboard", desc: "Peringkat penonton", Icon: Trophy },
  { key: "friends", label: "Teman", desc: "Orang yang kamu ikuti", Icon: Users },
  { key: "nobar", label: "Nobar", desc: "Nonton bareng", Icon: Radio },
  { key: "history", label: "History", desc: "Riwayat tontonan", Icon: Clock },
  { key: "voteWaifu", label: "Vote Waifu", desc: "Pilihan komunitas", Icon: Heart },
  { key: "bubble", label: "Bubble Chat", desc: "Obrolan singkat", Icon: MessageCircle },
  { key: "adofima", label: "Adofima-nga", desc: "Ruang eksplorasi", Icon: LayoutGrid },
  { key: "download", label: "Download", desc: "Episode offline", Icon: Download },
];

const TILE =
  "group relative flex h-[104px] flex-col justify-between rounded-xl border border-white/8 bg-[#101215] p-3 text-left transition hover:border-white/16 hover:bg-[#13161a] active:scale-[0.98]";

export default function Catalog() {
  return (
    <AppLayout>
      <CatalogContent />
    </AppLayout>
  );
}

function CatalogContent() {
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
      <div>
        <div className="mb-5">
          <p className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/34">
            <span className="font-serif text-[16px] font-normal leading-none tracking-normal text-[var(--primary)]">
              /
            </span>
            Jelajahi
          </p>
          <h1 className="mt-1.5 font-display text-[26px] font-bold leading-none tracking-[-0.04em]">
            Semua ruang
          </h1>
          <p className="mt-1.5 text-[10px] font-medium text-white/30">
            Komunitas, tontonan, dan koleksi dalam satu tempat.
          </p>
        </div>
      <div className="grid grid-cols-2 gap-2">
        {BOXES.map((b) =>
          b.key === "voteWaifu" ? (
            /* Kotak vote punya TITIK TIGA di dalam kotaknya (di luar isi),
               buat ganti Waifu ⇄ Husbu — tiap pilihan kotaknya sendiri. */
            <div key={b.key} ref={voteRef} className="relative">
              <button
                onClick={() => setScreen("voteWaifu")}
                className={TILE}
              >
                <span className="grid size-8 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-white/48">
                  <b.Icon className="size-4" strokeWidth={2} />
                </span>
                <span>
                  <span className="block text-[11px] font-bold text-white/86">
                    {voteKind === "husbu" ? "Vote Husbu" : "Vote Waifu"}
                  </span>
                  <span className="mt-0.5 block text-[8.5px] font-medium text-white/26">
                    {b.desc}
                  </span>
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVoteMenu((v) => !v);
                }}
                aria-label="Ganti jenis vote"
                className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md border border-white/8 bg-[#15181c] text-white/34 transition hover:text-white active:scale-90"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {voteMenu && (
                <div className="absolute right-2 top-11 z-30 flex w-40 flex-col gap-2">
                  <button
                    onClick={() => {
                      setVoteKind((k) => (k === "waifu" ? "husbu" : "waifu"));
                      setVoteMenu(false);
                    }}
                    style={{ animationDelay: "0ms" }}
                    className="lb-menu-item flex w-full items-center gap-2 rounded-lg border border-white/8 bg-[#15181c] px-3 py-2.5 text-left text-[10px] font-bold text-white/80 shadow-xl transition hover:bg-[#1c2025]"
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
                className={TILE}
              >
                <span className="grid size-8 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-white/48">
                  <b.Icon className="size-4" strokeWidth={2} />
                </span>
                <span>
                  <span className="block text-[11px] font-bold text-white/86">{b.label}</span>
                  <span className="mt-0.5 block text-[8.5px] font-medium text-white/26">{b.desc}</span>
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLbMenu((v) => !v);
                }}
                aria-label="Menu leaderboard"
                className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md border border-white/8 bg-[#15181c] text-white/34 transition hover:text-white active:scale-90"
              >
                <MoreHorizontal className="size-3.5" />
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
                      className="lb-menu-item flex w-full items-center gap-2 rounded-lg border border-white/8 bg-[#15181c] px-3 py-2.5 text-left text-[10px] font-bold text-white/80 shadow-xl transition hover:bg-[#1c2025]"
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
              className={TILE}
            >
              <span className="grid size-8 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-white/48">
                <b.Icon className="size-4" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[11px] font-bold text-white/86">{b.label}</span>
                <span className="mt-0.5 block text-[8.5px] font-medium text-white/26">{b.desc}</span>
              </span>
            </button>
          ),
        )}
      </div>
      </div>
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen
          onClose={() => setScreen(null)}
          initialView={lbView ?? undefined}
        />
      )}
      {screen === "download" && (
        <FullScreen title="Download" onClose={() => setScreen(null)}>
          <DownloadsPanel inline onClose={() => setScreen(null)} minimalEmpty />
        </FullScreen>
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
