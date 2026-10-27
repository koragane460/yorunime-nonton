// YoruNime — layar GAME di dalam Voice Room.
//
//  1. GameMenu   — pilihan game, kartu besar berselang-seling (kanan-kiri)
//  2. Lobby      — kursi pemain + tombol ajak (host) menunggu sampai penuh
//  3. UNO        — 4 pemain, hand asli dari `myHand`, sisanya sensor jumlah
//  4. Catur      — papan 8x8 validasi server (kastel/en passant/skak)
//
// Semua overlay full-screen (fixed inset-0 z-[80]) di atas voice room.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Crown,
  Gamepad2,
  Lightbulb,
  Send,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { GameSessionView } from "@/convex/games";

/** Bentuk session dari server — union terdiscriminasi lewat `game`. */
type SessionView = NonNullable<GameSessionView>;
type UnoView = Extract<SessionView, { game: "uno" }>;
type ChessView = Extract<SessionView, { game: "chess" }>;

type Game = "uno" | "chess";

const GAME_LABEL: Record<Game, string> = { uno: "UNO", chess: "Catur" };

/* ====================================================================== *
 *  OVERLAY
 * ====================================================================== */

export function VoiceGamesOverlay({
  roomId,
  sessionId,
  onSession,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  /** null = tampil menu pilihan game. */
  sessionId: Id<"gameSessions"> | null;
  onSession: (id: Id<"gameSessions"> | null) => void;
  onClose: () => void;
}) {
  if (!sessionId) {
    return (
      <GameMenu
        roomId={roomId}
        onCreated={onSession}
        onClose={onClose}
      />
    );
  }
  return (
    <GameScreen
      sessionId={sessionId}
      onClose={() => {
        onSession(null);
        onClose();
      }}
      onSession={onSession}
    />
  );
}

/* ====================================================================== *
 *  1) MENU GAME — kartu besar berselang-seling
 * ====================================================================== */

function GameMenu({
  roomId,
  onCreated,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  onCreated: (id: Id<"gameSessions">) => void;
  onClose: () => void;
}) {
  const createMut = useMutation(api.games.createSession);
  const inviteMut = useMutation(api.games.inviteAll);
  const [busy, setBusy] = useState<Game | null>(null);

  const start = async (game: Game) => {
    if (busy) return;
    setBusy(game);
    try {
      const id = await createMut({ roomId, game });
      // Undang otomatis supaya member lain langsung lihat ajakan di room.
      await inviteMut({ sessionId: id }).catch(() => 0);
      onCreated(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat game");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[80] overflow-y-auto bg-[#07060c]">
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-3">
        <button
          onClick={onClose}
          aria-label="Kembali ke voice room"
          className="flex size-10 items-center justify-center text-white/85 transition active:scale-95"
        >
          <ChevronLeft className="size-6" />
        </button>

        <div className="mt-2">
          <h1 className="text-2xl font-black tracking-tight">Game Room</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
            <Sparkles className="size-3.5 text-amber-300" />
            Ajak teman se-room, kumpulin pemain, mulai main
          </p>
        </div>

        {/* Kartu berselang-seling: 1 kiri, 2 kanan, dst. */}
        <div className="mt-6 flex flex-col gap-4">
          {/* ---- UNO ---- */}
          <motion.button
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            onClick={() => void start("uno")}
            disabled={busy !== null}
            className="group relative w-[90%] self-start overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(140deg,#2a0f14_0%,#12060a_60%,#0a0508_100%)] p-4 text-left shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition active:scale-[0.98] disabled:opacity-60"
          >
            <span aria-hidden className="absolute -right-10 -top-12 size-40 rounded-full bg-red-500/25 blur-3xl" />
            <span aria-hidden className="absolute -bottom-14 left-6 size-32 rounded-full bg-amber-500/15 blur-3xl" />

            {/* Tiga kartu UNO menumpuk miring. */}
            <div className="relative h-32 w-44">
              <span className="absolute left-4 top-3 h-[112px] w-16 rotate-[-16deg] rounded-xl bg-gradient-to-b from-red-500 to-red-800 ring-2 ring-white/85 shadow-xl" />
              <span className="absolute left-20 top-2 h-[112px] w-16 rotate-[10deg] rounded-xl bg-gradient-to-b from-amber-400 to-amber-700 ring-2 ring-white/85 shadow-xl" />
              <span className="absolute left-11 top-6 flex h-[112px] w-16 rotate-[-4deg] items-center justify-center rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 ring-2 ring-white/85 shadow-2xl">
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black italic text-red-600 shadow">
                  UNO
                </span>
              </span>
            </div>

            <div className="relative mt-3">
              <p className="text-xl font-black tracking-tight">UNO</p>
              <p className="text-[11px] text-white/60">
                4 pemain · buang kartu, tebak warna, jangan lupa teriak UNO!
              </p>
            </div>
            <span className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-[11px] font-black text-red-100 transition group-hover:bg-red-500/25">
              <Users className="size-3.5" /> {busy === "uno" ? "Membuat…" : "Mulai — 4 kursi"}
            </span>
          </motion.button>

          {/* ---- CATUR ---- */}
          <motion.button
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            onClick={() => void start("chess")}
            disabled={busy !== null}
            className="group relative w-[90%] self-end overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(220deg,#0f1a2a_0%,#070d16_60%,#05070c_100%)] p-4 text-left shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition active:scale-[0.98] disabled:opacity-60"
          >
            <span aria-hidden className="absolute -left-10 -top-12 size-40 rounded-full bg-sky-500/20 blur-3xl" />
            <span aria-hidden className="absolute -bottom-14 right-6 size-32 rounded-full bg-indigo-500/15 blur-3xl" />

            {/* Papan catur mini + figur kuda. */}
            <div className="relative ml-auto h-32 w-44 overflow-hidden rounded-xl border border-white/25 shadow-xl"
              style={{
                backgroundImage:
                  "conic-gradient(#3d4256 90deg, #171a24 0 180deg, #3d4256 0 270deg, #171a24 0)",
                backgroundSize: "25% 25%",
              }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center text-6xl text-white drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]">
                ♞
              </span>
              <span className="absolute bottom-2 right-2 text-3xl text-zinc-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
                ♚
              </span>
            </div>

            <div className="relative mt-3">
              <p className="text-xl font-black tracking-tight">Catur</p>
              <p className="text-[11px] text-white/60">
                2 pemain · kastel, en passant, sampai skakmat
              </p>
            </div>
            <span className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-[11px] font-black text-sky-100 transition group-hover:bg-sky-500/25">
              <Users className="size-3.5" /> {busy === "chess" ? "Membuat…" : "Mulai — 2 kursi"}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== *
 *  2) SCREEN GAME — lobby / bermain / selesai
 * ====================================================================== */

function GameScreen({
  sessionId,
  onClose,
  onSession,
}: {
  sessionId: Id<"gameSessions">;
  onClose: () => void;
  onSession: (id: Id<"gameSessions">) => void;
}) {
  const s = useQuery(api.games.session, { sessionId });
  const { user } = useAuth();
  const leaveMut = useMutation(api.games.leave);
  const inviteMut = useMutation(api.games.inviteAll);
  const createMut = useMutation(api.games.createSession);
  const [inviting, setInviting] = useState(false);

  if (!s) {
    return (
      <div className="screen-enter fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#07060c]">
        <p className="text-sm text-white/60">Memuat permainan…</p>
      </div>
    );
  }

  const leave = async () => {
    try {
      await leaveMut({ sessionId });
    } catch {
      /* sudah keluar */
    }
    onClose();
  };

  const title =
    s.game === "uno"
      ? `UNO — ${s.players.length}/${s.seats} pemain`
      : `Catur — ${s.players.length}/${s.seats} pemain`;

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-[#07060c]">
      {/* Kepala */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          onClick={() => void leave()}
          aria-label="Keluar game"
          className="flex size-10 shrink-0 items-center justify-center text-white/85 transition active:scale-95"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{title}</p>
          <p className="text-[11px] text-white/50">
            {s.status === "lobby"
              ? "Menunggu pemain penuh…"
              : s.status === "playing"
                ? "Permainan berlangsung"
                : "Selesai"}
          </p>
        </div>
        <Gamepad2 className="size-5 shrink-0 text-white/60" aria-hidden />
      </div>

      {s.status === "lobby" && (
        <LobbyView
          s={s}
          isHost={user ? s.hostId === user._id : false}
          inviting={inviting}
          onInvite={async () => {
            setInviting(true);
            try {
              const n = await inviteMut({ sessionId });
              toast.success(
                n > 0
                  ? `Undangan dikirim ke ${n} orang di room`
                  : "Semua orang di room sudah diundang",
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal mengundang");
            } finally {
              setInviting(false);
            }
          }}
        />
      )}

      {s.status === "playing" && s.game === "uno" && (
        <UnoTable sessionId={sessionId} s={s} myId={user?._id ?? null} />
      )}
      {s.status === "playing" && s.game === "chess" && (
        <ChessTable sessionId={sessionId} s={s} myId={user?._id ?? null} />
      )}

      {s.status === "done" && (
        <DoneView
          s={s}
          onAgain={async () => {
            try {
              const id = await createMut({ roomId: s.roomId, game: s.game });
              await inviteMut({ sessionId: id }).catch(() => 0);
              onSession(id);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal mulai lagi");
            }
          }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/* ------------------------------ LOBBY -------------------------------- */

function LobbyView({
  s,
  isHost,
  inviting,
  onInvite,
}: {
  s: SessionView;
  isHost: boolean;
  inviting: boolean;
  onInvite: () => void | Promise<void>;
}) {
  const seats = Array.from({ length: s.seats });
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {seats.map((_, i) => {
          const p = s.players[i];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-3xl border p-4",
                p
                  ? "border-emerald-400/35 bg-emerald-400/8"
                  : "border-dashed border-white/18 bg-white/[0.03]",
              )}
            >
              {p ? (
                <>
                  <Avatar src={p.image} seed={p.username} className="size-14" />
                  <p className="max-w-full truncate text-xs font-black">
                    {p.username}
                  </p>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                    Siap
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-white/25 text-white/35">
                    <UserPlus className="size-6" />
                  </span>
                  <p className="text-[11px] text-white/45">Kursi kosong</p>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/45">
                    Menunggu
                  </span>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 rounded-3xl border border-white/12 bg-white/[0.04] p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-white/75">
          <Lightbulb className="size-4 text-amber-300" />
          {s.players.length}/{s.seats} pemain — game otomatis mulai saat kursi
          penuh.
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-white/50">
          {isHost
            ? "Tekan tombol ajak untuk mengundang semua orang yang ada di voice room."
            : "Menunggu host mengajak pemain lain masuk ke game…"}
        </p>
      </div>

      {isHost && (
        <button
          onClick={() => void onInvite()}
          disabled={inviting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/12 py-3.5 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20 active:scale-[0.98] disabled:opacity-60"
        >
          <Send className="size-4" />
          {inviting ? "Mengirim…" : "Ajak pemain di room"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------- UNO --------------------------------- */

const UNO_BG: Record<string, string> = {
  r: "from-red-500 to-red-900",
  g: "from-emerald-500 to-emerald-900",
  y: "from-amber-400 to-amber-700",
  b: "from-sky-500 to-sky-900",
};
const UNO_NAME: Record<string, string> = {
  r: "Merah",
  g: "Hijau",
  y: "Kuning",
  b: "Biru",
};

function unoGlyph(c: string): string {
  if (c === "w") return "★";
  if (c === "w4") return "+4";
  const v = c.slice(1);
  if (v === "s") return "∅";
  if (v === "r") return "⇄";
  if (v === "2") return "+2";
  return v;
}

function UnoCard({
  c,
  onClick,
  disabled,
  className,
}: {
  c: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const wild = c === "w" || c === "w4";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative h-[86px] w-14 shrink-0 overflow-hidden rounded-xl border-2 shadow-lg transition",
        wild
          ? "border-white/85 bg-[conic-gradient(from_45deg,#ef4444,#eab308,#22c55e,#3b82f6,#ef4444)]"
          : `border-white/85 bg-gradient-to-b ${UNO_BG[c[0]]}`,
        onClick && !disabled
          ? "hover:-translate-y-1.5 hover:shadow-xl focus-visible:-translate-y-1.5"
          : "",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-1.5 rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-white/95"
      />
      <span
        className={cn(
          "relative flex h-full items-center justify-center text-lg font-black",
          wild ? "text-zinc-800" : "text-zinc-900",
        )}
      >
        {unoGlyph(c)}
      </span>
      <span className="absolute left-1 top-0.5 text-[9px] font-black text-white drop-shadow">
        {unoGlyph(c)}
      </span>
    </button>
  );
}

function canPlayClient(card: string, top: string, color: string): boolean {
  if (card === "w" || card === "w4") return true;
  const topColor = top === "w" || top === "w4" ? color : top[0];
  return card[0] === topColor || card.slice(1) === top.slice(1);
}

function UnoTable({
  sessionId,
  s,
  myId,
}: {
  sessionId: Id<"gameSessions">;
  s: UnoView;
  myId: Id<"users"> | null;
}) {
  const hand = useQuery(api.games.myHand, { sessionId });
  const drawMut = useMutation(api.games.drawCard);
  const passMut = useMutation(api.games.passTurn);
  const playMut = useMutation(api.games.playCard);
  const unoMut = useMutation(api.games.shoutUno);
  const [pickWild, setPickWild] = useState<number | null>(null);
  const [drew, setDrew] = useState(false);

  const uno = s.uno;
  const myTurn = !!myId && uno.turn === myId;
  const myHand = hand ?? [];
  const myCount = myId ? (uno.counts[myId] ?? 0) : 0;
  const opponents = s.players.filter((p) => p.userId !== myId);
  const nameOf = (id: string) =>
    s.players.find((p) => p.userId === id)?.username ?? "…";

  const play = async (i: number) => {
    const card = myHand[i];
    if (!card || !myTurn) return;
    if (!canPlayClient(card, uno.top, uno.color)) {
      toast.info("Kartu itu belum bisa dibuang");
      return;
    }
    if (card === "w" || card === "w4") {
      setPickWild(i);
      return;
    }
    try {
      await playMut({ sessionId, index: i });
      setDrew(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal main kartu");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Lawan */}
      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {opponents.map((p) => {
          const count = uno.counts[p.userId] ?? 0;
          const active = uno.turn === p.userId;
          const called = uno.unoCalled[p.userId];
          return (
            <div
              key={p.userId}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2 transition",
                active
                  ? "border-amber-300/70 bg-amber-400/10"
                  : "border-white/10 bg-white/[0.04]",
              )}
            >
              <Avatar
                src={s.players.find((x) => x.userId === p.userId)?.image}
                seed={p.username}
                className={cn("size-11 ring-2", active ? "ring-amber-300" : "ring-white/15")}
              />
              <p className="max-w-16 truncate text-[10px] font-bold">
                {p.username}
              </p>
              <span className="flex items-center gap-1 text-[10px] font-black text-white/70">
                <span className="inline-block h-3 w-2 rounded-[3px] bg-gradient-to-b from-red-500 to-red-800 ring-1 ring-white/70" />
                {count}
                {count === 1 && called && (
                  <span className="ml-0.5 rounded bg-amber-400 px-1 text-[8px] font-black text-black">
                    UNO
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Papan tengah */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-xs font-bold text-white/70">
          {uno.turn === myId ? (
            <span className="text-amber-300">Giliran kamu</span>
          ) : (
            <>Giliran {nameOf(uno.turn)}</>
          )}
          <span className="ml-2 text-white/45">
            warna {UNO_NAME[uno.color] ?? "—"} {uno.dir === -1 && "· ↺"}
          </span>
        </p>

        <div className="flex items-center gap-5">
          {/* Tumpukan deck */}
          <div className="relative h-[86px] w-14">
            <span className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl bg-zinc-800 ring-2 ring-white/25" />
            <span className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-xl bg-zinc-900 ring-2 ring-white/20" />
            <span className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[linear-gradient(160deg,#1c1c24,#0c0c11)] ring-2 ring-white/30">
              <span className="text-[9px] font-black text-white/60">DECK</span>
              <span className="text-sm font-black text-white/85">
                {uno.deckCount}
              </span>
            </span>
          </div>
          {/* Kartu teratas */}
          {uno.top && (
            <div className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -inset-2 rounded-2xl blur-md",
                  uno.color === "r" && "bg-red-500/35",
                  uno.color === "g" && "bg-emerald-500/35",
                  uno.color === "y" && "bg-amber-400/35",
                  uno.color === "b" && "bg-sky-500/35",
                )}
              />
              <UnoCard c={uno.top} className="relative" />
            </div>
          )}
        </div>

        {/* Aksi giliran */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={async () => {
              try {
                await drawMut({ sessionId });
                setDrew(true);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal tarik");
              }
            }}
            disabled={!myTurn}
            className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-35"
          >
            Tarik Kartu
          </button>
          <button
            onClick={async () => {
              try {
                await passMut({ sessionId });
                setDrew(false);
              } catch {
                /* lewati */
              }
            }}
            disabled={!myTurn || !drew}
            className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-35"
          >
            Lewat
          </button>
          <button
            onClick={async () => {
              try {
                await unoMut({ sessionId });
                toast.success("UNO!");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Belum saatnya");
              }
            }}
            disabled={myCount !== 1}
            className={cn(
              "rounded-xl px-4 py-2 text-[11px] font-black transition active:scale-95",
              myCount === 1
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-lg shadow-amber-600/30 animate-pulse"
                : "border border-white/15 bg-white/5 text-white/40",
            )}
          >
            UNO!
          </button>
        </div>
      </div>

      {/* Tangan saya */}
      <div className="border-t border-white/10 px-3 pb-6 pt-3">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/45">
          Kartu kamu · {myHand.length}
        </p>
        <div className="thin-scroll flex gap-2 overflow-x-auto pb-1">
          {myHand.map((c, i) => (
            <div key={`${c}-${i}`} className="relative">
              <UnoCard
                c={c}
                onClick={() => void play(i)}
                disabled={!myTurn || !canPlayClient(c, uno.top, uno.color)}
                className={cn(
                  !myTurn || !canPlayClient(c, uno.top, uno.color)
                    ? "opacity-45 grayscale-[0.35]"
                    : "ring-2 ring-amber-300/80",
                )}
              />
            </div>
          ))}
          {myHand.length === 0 && (
            <p className="py-6 text-center text-xs text-white/40">
              Menunggu kartu dibagikan…
            </p>
          )}
        </div>
      </div>

      {/* Pilih warna untuk kartu liar */}
      {pickWild !== null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 px-8">
          <div className="w-full max-w-xs rounded-3xl border border-white/15 bg-[#101018] p-4 text-center">
            <p className="text-sm font-black">Pilih warna</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {(["r", "g", "y", "b"] as const).map((col) => (
                <button
                  key={col}
                  onClick={async () => {
                    const i = pickWild;
                    setPickWild(null);
                    try {
                      await playMut({ sessionId, index: i, color: col });
                      setDrew(false);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                  className={cn(
                    "h-14 rounded-2xl border-2 border-white/70 font-black text-white transition active:scale-95",
                    `bg-gradient-to-b ${UNO_BG[col]}`,
                  )}
                >
                  {UNO_NAME[col]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickWild(null)}
              className="mt-3 text-[11px] font-bold text-white/50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ CATUR -------------------------------- */

const GLYPH: Record<string, string> = {
  wK: "♚",
  wQ: "♛",
  wR: "♜",
  wB: "♝",
  wN: "♞",
  wP: "♟",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

function ChessTable({
  sessionId,
  s,
  myId,
}: {
  sessionId: Id<"gameSessions">;
  s: ChessView;
  myId: Id<"users"> | null;
}) {
  const chess = s.chess;
  const me = s.players.find((p) => p.userId === myId);
  const myColor: "w" | "b" = me?.seat === 0 ? "w" : "b";
  const flip = myColor === "b";
  const [sel, setSel] = useState<number | null>(null);
  const legal = useQuery(
    api.games.legalFor,
    sel !== null ? { sessionId, from: sel } : "skip",
  );
  const moveMut = useMutation(api.games.chessMove);
  const resignMut = useMutation(api.games.resign);

  const myTurn = chess.turn === myColor;
  const nameOf = (id: string) =>
    s.players.find((p) => p.userId === id)?.username ?? "…";

  const tap = async (i: number) => {
    if (!myTurn) return;
    const piece = chess.board[i];
    if (sel !== null && legal?.includes(i)) {
      try {
        await moveMut({ sessionId, from: sel, to: i });
        setSel(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Langkah ditolak");
        setSel(null);
      }
      return;
    }
    if (piece && piece[0] === myColor) setSel(i);
    else setSel(null);
  };

  const order = useMemo(() => {
    const all = Array.from({ length: 64 }, (_, i) => i);
    return flip ? all.reverse() : all;
  }, [flip]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-2">
      {/* Pemain */}
      <div className="flex items-center justify-between gap-2">
        {s.players.map((p) => {
          const color = p.seat === 0 ? "w" : "b";
          const active = chess.turn === color;
          return (
            <div
              key={p.userId}
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-3 py-2",
                active ? "border-amber-300/70 bg-amber-400/10" : "border-white/10 bg-white/[0.04]",
              )}
            >
              <Avatar src={p.image} seed={p.username} className="size-9" />
              <div className="min-w-0">
                <p className="max-w-28 truncate text-[11px] font-black">
                  {p.username}
                  {p.userId === myId && <span className="text-white/45"> (kamu)</span>}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                  {color === "w" ? "Putih" : "Hitam"}
                </p>
              </div>
              <span
                className={cn(
                  "size-4 shrink-0 rounded-full ring-1 ring-white/40",
                  color === "w" ? "bg-white" : "bg-zinc-900",
                )}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-2 flex items-center justify-center gap-2 text-xs font-bold">
        {myTurn ? (
          <span className="text-amber-300">Giliran kamu</span>
        ) : (
          <span className="text-white/70">Giliran {nameOf(chess.turn)}</span>
        )}
        {chess.check && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-300">
            SKAK!
          </span>
        )}
      </p>

      {/* Papan */}
      <div className="mx-auto mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_-30px_rgba(0,0,0,1)]">
        <div className="grid aspect-square grid-cols-8">
          {order.map((i) => {
            const f = i % 8;
            const r = Math.floor(i / 8);
            const light = (f + r) % 2 === 0;
            const piece = chess.board[i];
            const isSel = sel === i;
            const isLast =
              chess.last && (chess.last.from === i || chess.last.to === i);
            const isLegal = sel !== null && legal?.includes(i);
            return (
              <button
                key={i}
                onClick={() => void tap(i)}
                className={cn(
                  "relative flex items-center justify-center",
                  light ? "bg-[#e8d5b5]" : "bg-[#7c5f49]",
                  isLast && "after:absolute after:inset-0 after:bg-amber-300/30",
                )}
              >
                {isSel && (
                  <span aria-hidden className="absolute inset-0 ring-[3px] ring-inset ring-amber-300" />
                )}
                {piece && (
                  <span
                    className={cn(
                      "relative z-[1] select-none text-[clamp(18px,7vw,30px)] leading-none",
                      piece[0] === "w"
                        ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
                        : "text-zinc-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]",
                    )}
                  >
                    {GLYPH[piece]}
                  </span>
                )}
                {isLegal && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute z-[2]",
                      chess.board[i]
                        ? "size-[76%] rounded-full border-[3px] border-emerald-400/85"
                        : "size-3 rounded-full bg-emerald-500/75",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-bold text-white/65">
          <span className="inline-block size-3 rounded-full bg-white ring-1 ring-white/40" />
          Kamu = {myColor === "w" ? "Putih" : "Hitam"}
        </span>
        <button
          onClick={async () => {
            try {
              await resignMut({ sessionId });
            } catch {
              /* selesai */
            }
          }}
          className="rounded-full border border-red-400/40 bg-red-500/10 px-3.5 py-1.5 text-[10px] font-black text-red-300 transition active:scale-95"
        >
          Menyerah
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- DONE -------------------------------- */

function DoneView({
  s,
  onAgain,
  onClose,
}: {
  s: SessionView;
  onAgain: () => void | Promise<void>;
  onClose: () => void;
}) {
  const winner = s.winnerId
    ? s.players.find((p) => p.userId === s.winnerId)
    : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex size-24 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/10"
      >
        <Crown className="size-12 text-amber-300" />
      </motion.div>
      <p className="mt-4 text-2xl font-black">
        {winner ? `${winner.username} menang!` : "Selesai — seri!"}
      </p>
      <p className="mt-1 text-sm text-white/55">
        {GAME_LABEL[s.game]} · {s.players.length} pemain
      </p>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
        <button
          onClick={() => void onAgain()}
          className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-sm font-black text-black shadow-lg shadow-amber-600/25 transition active:scale-[0.98]"
        >
          Main Lagi
        </button>
        <button
          onClick={onClose}
          className="rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/80 transition active:scale-[0.98]"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- TYPES ------------------------------- */

