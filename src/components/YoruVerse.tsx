// YORUVERSE — hub virtual berbentuk "ketupat" zigzag.
//
// Dibuka lewat tombol KUNING DI POJOK KANAN BAWAH panel akun. Berisi lima
// kotak berpangsel zigzag: TEMAN (chat pindah ke sini), CLAN, SHOP (border
// + GACHA — tombol Gacha/Title di navigasi sudah dihapus), TITLE, dan
// YORUPET. Di bawah kotak terakhir ada PODIUM 3D bulat yang menampilkan
// pet yang sedang dipasang.
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Award,
  Bone,
  ChevronLeft,
  Crown,
  Gift,
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
import { BORDERS } from "@/lib/borders";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";

type HubView = null | "teman" | "clan" | "shop" | "title" | "pet";

const BOXES = [
  { key: "teman", label: "Teman", Icon: Users },
  { key: "clan", label: "Clan", Icon: Shield },
  { key: "shop", label: "Shop", Icon: ShoppingBag },
  { key: "title", label: "Title", Icon: Award },
  { key: "pet", label: "YoruPet", Icon: Bone },
] as const;

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
    null;

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
              className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,207,64,.12),transparent_60%)]"
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

              <h1 className="mt-5 text-center text-2xl font-black tracking-[0.25em] text-gold drop-shadow-[0_2px_12px_rgba(255,207,64,.4)]">
                YORUVERSE
              </h1>

              {/* ------------------- kotak zigzag (ketupat) --------------- */}
              <div className="relative mx-auto mt-6 flex w-[92%] flex-col gap-4">
                {BOXES.map((b, i) => {
                  const left = i % 2 === 0;
                  return (
                    <div key={b.key} className={cn("relative", left ? "self-start" : "self-end")}>
                      <button
                        onClick={() => setView(b.key)}
                        className={cn(
                          "flex w-40 flex-col items-center gap-1.5 rounded-2xl border-2 border-white/25 bg-white/10 px-4 py-3.5",
                          "shadow-[0_12px_26px_-14px_rgba(0,0,0,.95)] backdrop-blur-md transition active:scale-95 hover:bg-white/[0.16]",
                        )}
                      >
                        <b.Icon className="size-6 text-gold" strokeWidth={1.8} aria-hidden />
                        <span className="text-[12px] font-black tracking-wide">{b.label}</span>
                      </button>
                      {/* garis tipis putih penghubung — kanan bawah / kiri
                          bawah bergantian, ulang-ulang */}
                      {i < BOXES.length - 1 && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -bottom-3.5 h-4 w-px bg-white/70",
                            left ? "right-3 rotate-[32deg]" : "left-3 -rotate-[32deg]",
                          )}
                        />
                      )}
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
                      className="text-4xl drop-shadow-[0_6px_10px_rgba(0,0,0,.8)]"
                    >
                      {petState.equipped.emoji}
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
                "rounded-full py-2 text-[12px] font-black transition",
                tab === k ? "bg-gold text-black" : "bg-white/10 text-zinc-300 hover:bg-white/15",
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
/*  CLAN — daftar singkat + tombol Semua / Top Clan + pencarian            */
/* ====================================================================== */

function ClanScreen({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [top, setTop] = useState(false);
  const clans = useQuery(api.clans.listClans, q.trim() ? { q: q.trim() } : {});
  const shown = top ? (clans ?? []).slice(0, 10) : (clans ?? []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ScreenHead title="Clan" onBack={onBack} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTop(false)}
            className={cn(
              "rounded-full py-2 text-[12px] font-black transition",
              !top ? "bg-gold text-black" : "bg-white/10 text-zinc-300 hover:bg-white/15",
            )}
          >
            Semua
          </button>
          <button
            onClick={() => setTop(true)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-full py-2 text-[12px] font-black transition",
              top ? "bg-gold text-black" : "bg-white/10 text-zinc-300 hover:bg-white/15",
            )}
          >
            <Crown className="size-3.5" aria-hidden /> Top Clan
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
            <button
              key={c._id}
              onClick={() => navigate(`/clan?clan=${c._id}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-card/60 p-2.5 text-left backdrop-blur-md transition hover:border-white/30"
            >
              {top && i < 3 ? (
                <Crown className="size-8 shrink-0 text-gold" aria-hidden />
              ) : (
                <img
                  src={c.avatarUrl || DEFAULT_CLAN_ICON}
                  alt=""
                  className="size-10 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-black">
                  {c.name}
                  {c.tag && (
                    <ClanTag
                      icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
                      tag={c.tag}
                      level={c.level}
                      className="scale-90 px-1.5 py-0 text-[9px]"
                    />
                  )}
                </p>
                <p className="text-[10px] font-bold text-zinc-400">
                  Lv.{c.level} · {c.memberCount} member ·{" "}
                  {(c.diamonds ?? 0).toLocaleString("id-ID")} 💰
                </p>
              </div>
            </button>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("profile")}
            className={cn(
              "rounded-full py-2 text-[12px] font-black transition",
              tab === "profile"
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black"
                : "bg-white/10 text-zinc-300 hover:bg-white/15",
            )}
          >
            👤 Profile
          </button>
          <button
            onClick={() => setTab("gacha")}
            className={cn(
              "rounded-full py-2 text-[12px] font-black transition",
              tab === "gacha"
                ? "bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 text-white"
                : "bg-white/10 text-zinc-300 hover:bg-white/15",
            )}
          >
            🎰 Gacha
          </button>
        </div>
      </div>

      {tab === "profile" ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
          <div className="mx-auto w-full max-w-2xl px-4 pt-3">
            <p className="text-[11px] font-bold text-muted-foreground">
              Border foto profile — beli dengan Sacret, begitu dipilih langsung
              terpasang. Tekan lagi untuk melepas.
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
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
                  </button>
                );
              })}
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
      <Gift className="size-4 text-gold/60" aria-hidden />
    </div>
  );
}
