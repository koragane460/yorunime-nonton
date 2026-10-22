// YORUVERSE — hub virtual berbentuk "ketupat" zigzag.
//
// Dibuka lewat tombol di pojok KANAN BAWAH panel akun. Isinya kotak-kotak
// BELAH KETUPAT (jajar genjang diagonal / diamond) bergradien lembut kayak
// judul baris Home, dihubungkan garis panjang dari titik atas kotak satu ke
// titik bawah kotak berikutnya. Kotak: TEMAN, CLAN, SHOP (border + GACHA),
// TITLE, YORUPET, dan MUSIC (layar musik rahasia — tampilan persis aslinya).
// Di bawah kotak terakhir ada PODIUM 3D bulat berisi pet yang sedang dipasang.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Award,
  Bone,
  ChevronLeft,
  Crown,
  Music,
  Search,
  Shield,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, BlueCheck, ClanTag, LevelBadge, SacretIcon } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { GachaScreen } from "@/pages/Gacha";
import { TitleScreen } from "@/pages/Title";
import { YoruPetScreen } from "@/components/YoruPet";
import { PetArt } from "@/components/PetArt";
import MusicScreen from "@/pages/Music";
import { ClanRow } from "@/pages/Clan";
import { BORDERS } from "@/lib/borders";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";

type HubView = null | "teman" | "clan" | "shop" | "title" | "pet" | "music";

/** Kotak ketupat + gradien lembut per kotak (gaya sama kayak judul baris
 *  "Manga / Manhwa Terbaru & Populer" di Home — bukan neon). */
const BOXES = [
  { key: "teman", label: "Teman", Icon: Users, grad: "from-amber-300/70 via-orange-200/45 to-rose-300/60" },
  { key: "clan", label: "Clan", Icon: Shield, grad: "from-violet-400/70 via-fuchsia-300/45 to-pink-400/60" },
  { key: "shop", label: "Shop", Icon: ShoppingBag, grad: "from-sky-400/70 via-cyan-300/45 to-teal-400/60" },
  { key: "title", label: "Title", Icon: Award, grad: "from-emerald-400/70 via-lime-300/45 to-yellow-300/60" },
  { key: "pet", label: "YoruPet", Icon: Bone, grad: "from-rose-400/70 via-red-300/45 to-orange-400/60" },
  { key: "music", label: "Music", Icon: Music, grad: "from-indigo-400/70 via-purple-300/45 to-fuchsia-400/60" },
] as const;

/** Potongan garis penghubung antar kotak (dihitung dari posisi nyata). */
type LinkLine = { x1: number; y1: number; x2: number; y2: number };

/** Layar penuh YoruVerse — dirender AppLayout di atas segalanya. */
export function YoruVerseScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const petState = useQuery(api.pets.state, {});
  const [view, setView] = useState<HubView>(null);

  const sub =
    view === "teman" ? <TemanScreen onBack={() => setView(null)} /> :
    view === "clan" ? <ClanScreen onBack={() => setView(null)} /> :
    view === "shop" ? <ShopScreen onBack={() => setView(null)} /> :
    view === "title" ? <TitleScreen onBack={() => setView(null)} /> :
    view === "pet" ? <YoruPetScreen onBack={() => setView(null)} /> :
    view === "music" ? <MusicScreen onClose={() => setView(null)} /> :
    null;

  // ---- ukur garis penghubung: dari TITIK SISAN KANAN kotak kiri ke TITIK
  // SISAN KIRI kotak kanan berikutnya (dan sebaliknya) — garis jadi berada
  // DI SAMPING kotak (kiri/kanan), bukan menyeberang DI ATASnya. ----
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [lines, setLines] = useState<LinkLine[]>([]);
  /** Lebar wrap — dipakai lane tengah garis penghubung (elbow). */
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    if (view) return;
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wb = wrap.getBoundingClientRect();
      setWrapW(wb.width);
      const pts: { x: number; y: number }[] = [];
      BOXES.forEach((_, i) => {
        const el = boxRefs.current[i];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cy = r.top + r.height / 2 - wb.top;
        // kotak kiri → titik sisi KANAN ketupat; kanan → titik sisi KIRI
        pts.push(
          i % 2 === 0
            ? { x: r.right - wb.left, y: cy }
            : { x: r.left - wb.left, y: cy },
        );
      });
      const out: LinkLine[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        out.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
      }
      setLines(out);
    };
    // tunggu frame supaya layout sudah final sebelum diukur
    const raf = window.requestAnimationFrame(measure);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [view]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {sub ? (
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {sub}
          </motion.div>
        ) : (
          <motion.div
            key="hub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {/* ------------------------- latar ------------------------ */}
            <div
              className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,207,64,.10),transparent_60%)]"
              aria-hidden
            />

            <div className="relative mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
              {/* ----------------------- kepala ---------------------- */}
              <div className="flex items-center gap-3 rounded-3xl border border-white/15 bg-card/70 p-3 backdrop-blur-xl">
                {user?.avatarBorder && user.avatarBorder !== "none" ? (
                  <FramedAvatar
                    border={user.avatarBorder}
                    src={user.image}
                    seed={user.username ?? "user"}
                    className="size-14 shrink-0"
                  />
                ) : (
                  <div className="yn-avatar-ring shrink-0">
                    <div className="rounded-full bg-background p-[2px]">
                      <Avatar src={user?.image} seed={user?.username ?? "user"} className="size-14" />
                    </div>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-black">{user?.username ?? "user"}</p>
                    {user && (user.premiumUntil ?? 0) > Date.now() && <BlueCheck />}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <LevelBadge level={user?.level ?? 1} />
                    {user?.clanTag && (
                      <ClanTag
                        icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                        tag={user.clanTag}
                        level={user.clanLevel}
                        className="scale-90 px-1.5 py-0 text-[9px]"
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-black text-gold">
                    <SacretIcon className="size-3" />
                    {(user?.diamonds ?? 0).toLocaleString("id-ID")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    💎 {petState?.crystals?.toLocaleString("id-ID") ?? 0}
                  </span>
                  <button
                    onClick={onClose}
                    aria-label="Tutup YoruVerse"
                    className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/40 transition hover:border-white/40"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* -------------------- judul YORUVERSE ---------------- */}
              {/* Emas gradasi lembut + garis emas kiri/kanan + belah ketupat
                  kecil — elegan, TANPA neon (tema YoruNime tidak neon). */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <span aria-hidden className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70" />
                <h1 className="bg-gradient-to-b from-amber-100 via-gold to-amber-600 bg-clip-text text-center text-[26px] font-black tracking-[0.3em] text-transparent drop-shadow-[0_2px_3px_rgba(0,0,0,.85)]">
                  YORUVERSE
                </h1>
                <span aria-hidden className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70" />
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5" aria-hidden>
                <span className="size-1.5 rotate-45 bg-gold/70" />
                <span className="size-1 rotate-45 bg-gold/40" />
                <span className="size-1.5 rotate-45 bg-gold/70" />
              </div>

              {/* ------------- kotak BELAH KETUPAT zigzag -------------- */}
              <div
                ref={wrapRef}
                className="relative mx-auto mt-8 flex w-[94%] flex-col gap-6"
              >
                {/* garis penghubung: LURUS ke arah yang benar — dari titik
                    sisi tiap ketupat ke lane TENGAH (di sela dua ketupat,
                    tidak menyentuh kotak), lalu lurus ke titik sisi kotak
                    berikutnya. Tidak ada lagi garis menyeberang di atas kotak. */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden
                >
                  {lines.map((l, i) => {
                    // Lane tengah = 50% lebar wrap; kalau belum terukur,
                    // garis lurus biasa.
                    const cx = wrapW > 0 ? wrapW / 2 : l.x2;
                    const d =
                      wrapW > 0
                        ? `M ${l.x1} ${l.y1} L ${cx} ${l.y1} L ${cx} ${l.y2} L ${l.x2} ${l.y2}`
                        : `M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`;
                    return (
                      <g key={i}>
                        <path
                          d={d}
                          fill="none"
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* titik belah ketupat kecil di ujung garis */}
                        <rect
                          x={l.x2 - 2.5}
                          y={l.y2 - 2.5}
                          width="5"
                          height="5"
                          transform={`rotate(45 ${l.x2} ${l.y2})`}
                          fill="rgba(255,255,255,0.75)"
                        />
                      </g>
                    );
                  })}
                </svg>

                {BOXES.map((b, i) => {
                  const left = i % 2 === 0;
                  return (
                    <div key={b.key} className={cn("relative", left ? "self-start" : "self-end")}>
                      {/* ring tipis luar = "outline" ketupat */}
                      <div className="bg-white/30 p-[2px] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]">
                        <button
                          ref={(el) => {
                            boxRefs.current[i] = el;
                          }}
                          onClick={() => setView(b.key)}
                          className={cn(
                            "flex h-20 w-32 flex-col items-center justify-center gap-1 bg-gradient-to-br",
                            b.grad,
                            "shadow-[0_14px_28px_-16px_rgba(0,0,0,.95)] transition active:scale-95",
                            "[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]",
                          )}
                        >
                          <b.Icon
                            className="size-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]"
                            strokeWidth={1.8}
                            aria-hidden
                          />
                          <span className="text-[12px] font-black tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">
                            {b.label}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ------------------------ podium 3D --------------------- */}
              <div className="relative mx-auto mt-12 w-48">
                {/* pantulan cahaya di lantai */}
                <div className="absolute -bottom-3 left-1/2 h-4 w-44 -translate-x-1/2 rounded-[50%] bg-black/50 blur-md" aria-hidden />
                {/* pet yang sedang dipasang, berdiri di podium */}
                {petState?.equipped && (
                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                      className="size-16 drop-shadow-[0_6px_10px_rgba(0,0,0,.8)]"
                    >
                      <PetArt petId={petState.equipped.petId} />
                    </motion.div>
                    <span className="mb-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-sm">
                      {petState.equipped.name}
                    </span>
                  </div>
                )}
                {/* piringan atas */}
                <div className="mx-auto h-5 w-48 rounded-[50%] bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-500 shadow-[inset_0_2px_4px_rgba(255,255,255,.6)]" aria-hidden />
                {/* badan silinder */}
                <div className="mx-auto -mt-2 h-8 w-44 rounded-b-[30px] bg-gradient-to-b from-zinc-500 via-zinc-600 to-zinc-900" aria-hidden />
                {!petState?.equipped && (
                  <p className="mt-2 text-center text-[10px] font-bold text-zinc-500">
                    Pasang pet di YoruPet untuk pajang di podium ✨
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====================================================================== */
/*  TEMAN — daftar teman + request + chat DM (pindah dari layar Chat)      */
/* ====================================================================== */

function TemanScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const friends = useQuery(api.friends.listFriends, {});
  const requests = useQuery(api.friends.listRequests, {});
  const respond = useMutation(api.friends.respondRequest);
  const [tab, setTab] = useState<"teman" | "request">("teman");
  const [peer, setPeer] = useState<{ id: Id<"users">; name: string } | null>(null);

  if (peer && user) {
    return (
      <DmScreen
        peer={peer}
        meId={user._id}
        onBack={() => setPeer(null)}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ScreenHead title="Teman" onBack={onBack} />
        {/* Tab TEKAN SAJA — tanpa background, hanya garis bawah di bawah
            teks (permintaan pemilik). */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["teman", `Teman (${friends?.length ?? 0})`],
              ["request", `Request (${requests?.length ?? 0})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "border-b-2 pb-1.5 pt-1 text-[12px] font-black transition",
                tab === k
                  ? "border-gold text-gold"
                  : "border-transparent text-zinc-400 hover:text-zinc-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {tab === "teman" &&
            (friends?.length ?? 0) === 0 && (
              <p className="py-10 text-center text-xs font-bold text-zinc-500">
                Belum punya teman — cari lewat profil user lain dulu ya.
              </p>
            )}
          {tab === "teman" &&
            friends?.map((f) => (
              <button
                key={f.friendshipId}
                onClick={() => setPeer({ id: f.userId as Id<"users">, name: f.username })}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-card/60 p-2.5 text-left backdrop-blur-md transition hover:border-white/30"
              >
                <Avatar src={f.image} seed={f.username} className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-black">
                    {f.username}
                    {f.premium && <BlueCheck />}
                  </p>
                  <LevelBadge level={f.level ?? 1} className="scale-90 origin-left" />
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-zinc-200">
                  Chat 💬
                </span>
              </button>
            ))}

          {tab === "request" &&
            (requests?.length ?? 0) === 0 && (
              <p className="py-10 text-center text-xs font-bold text-zinc-500">
                Tidak ada request teman.
              </p>
            )}
          {tab === "request" &&
            requests?.map((r) => (
              <div
                key={r.requestId}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card/60 p-2.5 backdrop-blur-md"
              >
                <Avatar src={r.image} seed={r.username} className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{r.username}</p>
                  <LevelBadge level={r.level ?? 1} className="scale-90 origin-left" />
                </div>
                <button
                  onClick={() =>
                    void respond({ requestId: r.requestId as never, accept: true })
                      .then(() => toast.success(`Berteman dengan ${r.username}!`))
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal"))
                  }
                  className="rounded-full bg-emerald-500/80 px-3 py-1.5 text-[10px] font-black text-white transition active:scale-95"
                >
                  Terima
                </button>
                <button
                  onClick={() =>
                    void respond({ requestId: r.requestId as never, accept: false }).catch(() => {})
                  }
                  className="rounded-full bg-rose-500/70 px-3 py-1.5 text-[10px] font-black text-white transition active:scale-95"
                >
                  Tolak
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Chat DM antar teman — dipindah ke dalam YoruVerse › Teman. */
function DmScreen({
  peer,
  meId,
  onBack,
}: {
  peer: { id: Id<"users">; name: string };
  meId: Id<"users">;
  onBack: () => void;
}) {
  const msgs = useQuery(api.chat.listMessages, { kind: "dm", peerId: peer.id });
  const send = useMutation(api.chat.sendMessage);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 bg-card/70 p-3 backdrop-blur-xl">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="truncate text-sm font-black">Chat {peer.name}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black/30">
        <ChatPanel
          kind="dm"
          peerId={peer.id}
          messages={(msgs ?? []) as unknown as ChatMsg[]}
          meId={meId}
          onOpenProfile={() => {}}
          onSend={async (p) => {
            await send({
              kind: "dm",
              peerId: peer.id,
              text: p.text,
              imageStorageId: p.imageStorageId,
              replyToId: p.replyToId as never,
            });
          }}
        />
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  CLAN — daftar clan PERSIS kayak daftar clan di halaman Clan (ClanRow), */
/*  Top Clan menampilkan peringkat 1-50 dengan ANGKA TOP.                  */
/* ====================================================================== */

/** Warna angka peringkat: emas 1-3, perak 4-10, zinc sisanya. */
function rankChipCls(i: number) {
  if (i < 3) return "bg-gradient-to-b from-amber-300 to-amber-500 text-black";
  if (i < 10) return "bg-gradient-to-b from-zinc-200 to-zinc-400 text-black";
  return "bg-white/10 text-zinc-300";
}

function ClanScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [top, setTop] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const clans = useQuery(api.clans.listClans, q.trim() ? { q: q.trim() } : {});
  const requestJoin = useMutation(api.clans.requestJoin);
  // Top Clan = peringkat 1-50 (list sudah diurutkan dari diamonds terbesar).
  const shown = top ? (clans ?? []).slice(0, 50) : (clans ?? []);

  const join = async (clanId: string) => {
    if (!user) {
      navigate("/auth?returnTo=/home");
      return;
    }
    setBusyId(clanId);
    try {
      const r = (await requestJoin({ clanId: clanId as never })) as { requested?: boolean };
      toast.success(
        r?.requested
          ? "Permintaan gabung dikirim — tunggu dibuka leader"
          : "Permintaan dibatalkan",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal gabung");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ScreenHead title="Clan" onBack={onBack} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTop(false)}
            className={cn(
              "border-b-2 pb-1.5 pt-1 text-[12px] font-black transition",
              !top ? "border-gold text-gold" : "border-transparent text-zinc-400 hover:text-zinc-200",
            )}
          >
            Semua
          </button>
          <button
            onClick={() => setTop(true)}
            className={cn(
              "flex items-center justify-center gap-1 border-b-2 pb-1.5 pt-1 text-[12px] font-black transition",
              top ? "border-gold text-gold" : "border-transparent text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Crown className="size-3.5" aria-hidden /> Top Clan 1-50
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2">
          <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama clan…"
            className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-zinc-600"
          />
        </div>

        <div className="mt-3 space-y-2">
          {shown.length === 0 && (
            <p className="py-10 text-center text-xs font-bold text-zinc-500">
              Tidak ada clan{q ? ` untuk "${q}"` : " — jadilah yang pertama!"}
            </p>
          )}
          {shown.map((c, i) => (
            <div key={c._id} className="flex items-start gap-2">
              {top && (
                <span
                  className={cn(
                    "mt-3 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-[11px] font-black",
                    rankChipCls(i),
                  )}
                >
                  #{i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <ClanRow
                  clan={c}
                  onOpen={() => navigate(`/clan?clan=${c._id}`)}
                  onJoin={() => void join(c._id)}
                  busy={busyId === c._id}
                  loggedIn={!!user}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  SHOP — border profile + GACHA (layar Gacha pindah ke sini)             */
/* ====================================================================== */

function ShopScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const buyBorder = useMutation(api.account.buyBorder);
  const equipBorder = useMutation(api.account.equipBorder);
  const [tab, setTab] = useState<"profile" | "gacha">("profile");
  const [busyBorder, setBusyBorder] = useState<string | null>(null);

  const ownedBorders = user?.ownedBorders ?? [];
  const equippedBorder = user?.avatarBorder ?? "none";

  const pickBorder = async (b: (typeof BORDERS)[number]) => {
    if (busyBorder) return;
    setBusyBorder(b.id);
    try {
      if (equippedBorder === b.id) {
        await equipBorder({ borderId: "none" });
      } else if (ownedBorders.includes(b.id)) {
        await equipBorder({ borderId: b.id });
      } else {
        await buyBorder({ borderId: b.id });
        toast.success(`Border ${b.name} dibeli & terpasang!`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusyBorder(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ScreenHead title="Shop" onBack={onBack} />
        {/* Tab PROFILE / GACHA — teks + garis bawah saja, tanpa background */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("profile")}
            className={cn(
              "border-b-2 pb-1.5 pt-1 text-[12px] font-black transition",
              tab === "profile"
                ? "border-gold text-gold"
                : "border-transparent text-zinc-400 hover:text-zinc-200",
            )}
          >
            👤 Profile
          </button>
          <button
            onClick={() => setTab("gacha")}
            className={cn(
              "border-b-2 pb-1.5 pt-1 text-[12px] font-black transition",
              tab === "gacha"
                ? "border-gold text-gold"
                : "border-transparent text-zinc-400 hover:text-zinc-200",
            )}
          >
            🎰 Gacha
          </button>
        </div>
      </div>

      {tab === "profile" ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
          <div className="mx-auto w-full max-w-2xl px-4 pt-3">
            {/* Semua kotak border dibungkus SATU kotak lagi, dan di paling
                atas ada KOTAK LURUS KE SAMPING (header bar) yang tidak
                memanjang ke bawah. Tanpa paragraf penjelas lagi. */}
            <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.06] px-3 py-2">
                <p className="text-[12px] font-black tracking-wide">Border Profile</p>
                <span className="text-[10px] font-bold text-zinc-400">
                  Tekan lagi untuk melepas
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                {BORDERS.map((b) => {
                  const owned = b.id === "none" || ownedBorders.includes(b.id);
                  const active = equippedBorder === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => void pickBorder(b)}
                      disabled={busyBorder !== null}
                      title={b.blurb}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-2 transition active:scale-[0.97] disabled:opacity-60",
                        active
                          ? "border-gold/70 bg-gold/10 shadow-[0_0_14px_-6px_rgba(212,175,55,0.7)]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/30",
                      )}
                    >
                      <FramedAvatar
                        border={b.id === "none" ? undefined : b.id}
                        src={user?.image}
                        seed={user?.username ?? "user"}
                        className="size-12"
                      />
                      <span className="text-[10px] font-black">{b.name}</span>
                      <span className="text-[9px] font-bold text-gold">
                        {b.price === 0 ? "Gratis" : `${b.price.toLocaleString("id-ID")} 💰`}
                      </span>
                      {owned && !active && (
                        <span className="text-[8px] font-bold text-zinc-500">dimiliki</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden pt-2">
          <div className="h-full overflow-y-auto overscroll-contain pb-24">
            <GachaScreen onBack={onBack} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ScreenHead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onBack}
        aria-label="Kembali ke YoruVerse"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30"
      >
        <ChevronLeft className="size-5" />
      </button>
      <h2 className="flex-1 text-lg font-black tracking-tight">{title}</h2>
    </div>
  );
}
