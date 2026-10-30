// YoruNime — layar GAME di dalam Voice Room.
//
//  1. GameMenu   — pilihan game, kartu besar berselang-seling (kanan-kiri)
//  2. Lobby      — kursi pemain + tombol ajak (host) menunggu sampai penuh
//  3. UNO        — 4 pemain, hand asli dari `myHand`, sisanya sensor jumlah
//  4. Catur      — papan 8x8 validasi server (kastel/en passant/skak)
//
// Semua overlay full-screen (fixed inset-0 z-[80]) di atas voice room.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  ChevronRight,
  Crown,
  Gamepad2,
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
type SnakesView = Extract<SessionView, { game: "snakes" }>;

type Game = "uno" | "chess" | "snakes";

const GAME_LABEL: Record<Game, string> = {
  uno: "UNO",
  chess: "Catur",
  snakes: "Ular Tangga",
};

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
  /** Jumlah pemain yang dipilih host — maksimal mengikuti game-nya. */
  const [seatSel, setSeatSel] = useState<Record<string, number>>({
    uno: 4,
    chess: 2,
    snakes: 4,
  });

  const start = async (game: Game) => {
    if (busy) return;
    setBusy(game);
    try {
      const id = await createMut({ roomId, game, seats: seatSel[game] });
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
    <div className="screen-enter fixed inset-0 z-[80] overflow-y-auto bg-[#060509]">
      {/* Latar premium: grid halus + tiga orb warna + sinar emas atas. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.2px)] [background-size:24px_24px]" />
      </div>

      <div className="relative mx-auto w-full max-w-md px-4 pb-20 pt-3">
        {/* ---- Kepala layar ---- */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Kembali ke voice room"
            className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/85 transition hover:border-white/40 active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold/80">
              YoruNime Party
            </p>
            <h1 className="bg-gradient-to-r from-white via-white to-white/55 bg-clip-text yn-title text-2xl text-transparent">
              Game Room
            </h1>
          </div>
          <span className="flex size-10 items-center justify-center rounded-full border border-gold/45 bg-gold/10 text-gold">
            <Gamepad2 className="size-5" />
          </span>
        </div>
        {/* Ornamen pembatas emas. */}
        <div className="mt-2.5 flex items-center gap-2" aria-hidden>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/55" />
          <span className="size-1.5 rotate-45 bg-gold/80" />
          <span className="size-1 rotate-45 bg-gold/45" />
          <span className="size-1.5 rotate-45 bg-gold/80" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/55" />
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-white/55">
          <Sparkles className="size-3.5 text-amber-300" />
          Ajak teman se-room, kumpulin pemain, mulai main
        </p>

        {/* ---- Strip statistik ---- */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { k: "3", l: "Pilihan game" },
            { k: "100%", l: "Validasi server" },
            { k: "Gratis", l: "Buat room" },
          ].map((s) => (
            <div
              key={s.l}
              className="yn-panel-flat px-2 py-2.5 text-center"
            >
              <p className="yn-num text-sm font-black text-white">{s.k}</p>
              <p className="mt-0.5 text-[9px] font-bold leading-tight text-white/50">
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* ---- Kartu game berselang-seling (kiri-kanan-kiri) ---- */}
        <div className="mt-5 flex flex-col gap-4">
          {/* ---- UNO ---- */}
          <GameCard
            idx={1}
            title="UNO"
            delay={0.05}
            disabled={busy !== null}
            onClick={() => void start("uno")}
            shell="border-red-400/25"
            seats={seatSel.uno}
            seatOpts={[2, 3, 4]}
            onSeats={(n) => setSeatSel((s) => ({ ...s, uno: n }))}
            desc="Buang kartu serasi warna/angka, kartu liar ganti warna, jangan lupa teriak UNO sebelum keburu kehabisan!"
            chips={["4 pemain", "108 kartu", "+2 · +4 · liar", "Validasi server"]}
            cta={
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {busy === "uno" ? "Membuat…" : "Mulai — 4 kursi"}
              </span>
            }
            art={
              <>
                {/* Tiga kartu UNO menumpuk miring. */}
                <div className="relative mx-auto h-32 w-44">
                  <span className="absolute left-4 top-3 h-[112px] w-16 rotate-[-16deg] rounded-xl bg-gradient-to-b from-red-500 to-red-800 ring-2 ring-white/85 shadow-xl" />
                  <span className="absolute left-20 top-2 h-[112px] w-16 rotate-[10deg] rounded-xl bg-gradient-to-b from-amber-400 to-amber-700 ring-2 ring-white/85 shadow-xl" />
                  <span className="absolute left-11 top-6 flex h-[112px] w-16 rotate-[-4deg] items-center justify-center rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 ring-2 ring-white/85 shadow-2xl">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black italic text-red-600 shadow">
                      UNO
                    </span>
                  </span>
                </div>
              </>
            }
          />

          {/* ---- CATUR ---- */}
          <GameCard
            idx={2}
            title="Catur"
            delay={0.12}
            disabled={busy !== null}
            onClick={() => void start("chess")}
            shell="border-sky-400/25"
            seats={seatSel.chess}
            seatOpts={[2]}
            onSeats={(n) => setSeatSel((s) => ({ ...s, chess: n }))}
            desc="Duel klasik 8×8 — kastel, en passant, skak & skakmat, semua langkah divalidasi server."
            chips={["2 pemain", "Papan 8×8", "Skak & skakmat", "Validasi server"]}
            cta={
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {busy === "chess" ? "Membuat…" : "Mulai — 2 kursi"}
              </span>
            }
            art={
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "conic-gradient(#3d4256 90deg, #171a24 0 180deg, #3d4256 0 270deg, #171a24 0)",
                    backgroundSize: "25% 25%",
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10"
                />
                <span className="absolute inset-0 flex items-center justify-center text-6xl text-white drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]">
                  ♞
                </span>
                <span className="absolute bottom-2 right-3 text-3xl text-zinc-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
                  ♚
                </span>
              </>
            }
          />

          {/* ---- ULAR TANGGA — dadu, maju, naik tangga & hindari ular ---- */}
          <GameCard
            idx={3}
            title="Ular Tangga"
            delay={0.19}
            disabled={busy !== null}
            onClick={() => void start("snakes")}
            shell="border-violet-400/25"
            seats={seatSel.snakes}
            seatOpts={[2, 3, 4]}
            onSeats={(n) => setSeatSel((s) => ({ ...s, snakes: n }))}
            desc="Lempar dadu 1–6, maju di papan 100 petak — naik tangga kalau kena, hati-hati ular! Harus PAS sampai di petak 100."
            chips={["4 pemain", "Dadu 1–6", "9 tangga · 10 ular", "PAS di 100"]}
            cta={
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {busy === "snakes" ? "Membuat…" : "Mulai — 4 kursi"}
              </span>
            }
            art={
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "conic-gradient(#1d2a22 90deg, #0f1712 0 180deg, #1d2a22 0 270deg, #0f1712 0)",
                    backgroundSize: "25% 25%",
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/10"
                />
                {/* Tangga emas mini + ular melengkung. */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                  <g stroke="#f5c542" strokeWidth="1.6" strokeLinecap="round">
                    <line x1="24" y1="82" x2="64" y2="26" />
                    <line x1="30" y1="85" x2="70" y2="29" />
                    {[0.2, 0.4, 0.6, 0.8].map((t) => (
                      <line
                        key={t}
                        x1={24 + 40 * t}
                        y1={82 - 56 * t}
                        x2={30 + 40 * t}
                        y2={85 - 56 * t}
                        strokeWidth="1.2"
                      />
                    ))}
                  </g>
                  <path
                    d="M 78 18 Q 55 45 82 62 Q 98 74 74 92"
                    fill="none"
                    stroke="url(#miniSnake)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="miniSnake" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#f43f5e" />
                      <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <circle cx="78" cy="18" r="4.5" fill="#f43f5e" />
                </svg>
                {/* Dadu mini miring. */}
                <span
                  className="absolute bottom-2 left-3 flex h-10 w-10 rotate-[-12deg] items-center justify-center rounded-lg bg-gradient-to-b from-white to-zinc-300 shadow-lg"
                  aria-hidden
                >
                  <span className="grid grid-cols-2 gap-0.5">
                    {[0, 1, 2, 3].map((k) => (
                      <span key={k} className="size-1.5 rounded-full bg-zinc-800" />
                    ))}
                  </span>
                </span>
              </>
            }
          />
        </div>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-white/40">
          Undangan otomatis terkirim ke semua member voice room — tunggu sampai
          kursi penuh, baru permainan dimulai.
        </p>
      </div>
    </div>
  );
}

/**
 * KARTU GAME di menu — artwork besar penuh warna, angka urut besar,
 * ringkasan + chips fitur, dan tombol CTA gradient selebar kartu.
 * Berselang-seling kiri/kanan supaya tata letaknya hidup.
 */
function GameCard({
  idx,
  title,
  desc,
  chips,
  cta,
  shell,
  art,
  delay,
  disabled,
  onClick,
  seats,
  seatOpts,
  onSeats,
}: {
  idx: number;
  title: string;
  desc: string;
  chips: string[];
  cta: ReactNode;
  shell: string;
  art: ReactNode;
  delay: number;
  disabled?: boolean;
  onClick: () => void;
  /** Jumlah pemain terpilih + pilihan (maksimal mengikuti game). */
  seats: number;
  seatOpts: number[];
  onSeats: (n: number) => void;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !disabled) onClick();
      }}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "group relative w-[94%] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] p-3.5 transition hover:border-white/25 active:scale-[0.99]",
        disabled && "pointer-events-none opacity-60",
        idx % 2 === 0 ? "self-end" : "self-start",
        shell,
      )}
    >
      {/* ARTWORK game — pelengkap visual, bukan cuma teks. */}
      <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-black/55">
        {art}
      </div>

      {/* Judul + jumlah pemain terpilih. */}
      <div className="relative mt-2.5 flex items-baseline justify-between gap-2">
        <p className="text-lg tracking-tight text-white yn-title">{title}</p>
        <span className="shrink-0 text-[10px] font-bold text-white/40">
          {seats} pemain
        </span>
      </div>
      <p className="relative mt-0.5 text-[11px] leading-snug text-white/55">
        {desc}
      </p>

      {/* Rincian — satu baris teks biasa, tanpa chip berhiasan. */}
      <p className="relative mt-1.5 text-[10px] font-bold text-white/40">
        {chips.join(" · ")}
      </p>

      {/* Pilih jumlah pemain (maksimal mengikuti game-nya). */}
      <div
        className="relative mt-2.5 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] font-bold text-white/45">Pemain</span>
        {seatOpts.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSeats(n)}
            className={cn(
              "h-7 min-w-7 rounded-lg border px-2 text-[11px] font-black transition",
              seats === n
                ? "border-white/80 bg-white text-black"
                : "border-white/15 text-white/60 hover:border-white/35",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* CTA selebar kartu — permukaan solid, tanpa gradasi mencolok. */}
      <span className="relative mt-3 flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-[12px] font-black text-white transition group-hover:bg-white/12">
        {cta}
        <ChevronRight className="size-4 text-white/50" aria-hidden />
      </span>
    </motion.div>
  );
}

/** Warna tombol CTA mengikuti game (1 UNO, 2 Catur, 3 Ular Tangga). */
function ctaClsOf(idx: number) {
  if (idx === 1) return "bg-gradient-to-r from-red-500 to-rose-700 text-white";
  if (idx === 2) return "bg-gradient-to-r from-sky-400 to-blue-700 text-white";
  return "bg-gradient-to-r from-violet-400 to-fuchsia-600 text-white";
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

  const title = `${GAME_LABEL[s.game]} — ${s.players.length}/${s.seats} pemain`;

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
      {s.status === "playing" && s.game === "snakes" && (
        <SnakesTable sessionId={sessionId} s={s} myId={user?._id ?? null} />
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
      {/* Kepala lobby premium */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-[linear-gradient(155deg,#241a08_0%,#14101f_55%,#0b0a12_100%)] p-4 text-center">
        <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-300/85">
          Menunggu Pemain
        </p>          <p className="mt-1.5 bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-xl yn-title text-transparent">
          {s.players.length}
          <span className="text-white/50"> / {s.seats} kursi terisi</span>
        </p>
        {/* Bar kursi */}
        <div className="mt-3 flex justify-center gap-1.5">
          {seats.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-9 rounded-full transition",
                i < s.players.length
                  ? "bg-gradient-to-r from-amber-300 to-amber-500"
                  : "bg-white/15",
              )}
            />
          ))}
        </div>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-white/55">
          <Sparkles className="size-3.5 text-amber-300" />
          {isHost
            ? "Ajak pemain di room — otomatis mulai saat penuh"
            : "Menunggu host mengajak pemain lain…"}
        </p>
      </div>

      {/* Kursi pemain */}
      <div
        className={cn(
          "mt-4 grid gap-3",
          seats.length <= 4 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {seats.map((_, i) => {
          const p = s.players[i];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl border p-4",
                p
                  ? "border-amber-300/40 bg-[linear-gradient(160deg,rgba(251,191,36,.14),rgba(255,255,255,.04))]"
                  : "border-dashed border-white/18 bg-white/[0.03]",
              )}
            >
              {p ? (
                <>
                  <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                  <Avatar src={p.image} seed={p.username} className="size-14 ring-2 ring-amber-300/70" />
                  <p className="max-w-full truncate text-xs font-black">
                    {p.username}
                  </p>
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/40">
                    ✓ Siap
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-white/25 text-white/35">
                    <UserPlus className="size-6" />
                  </span>
                  <p className="text-[11px] text-white/45">Kursi kosong</p>
                  <span className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/45">
                    <span className="size-1.5 animate-ping rounded-full bg-amber-300" />
                    Menunggu
                  </span>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {isHost && (
        <button
          onClick={() => void onInvite()}
          disabled={inviting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3.5 text-sm font-black text-black transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
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
  const glyph = unoGlyph(c);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group/card relative h-[92px] w-[58px] shrink-0 overflow-hidden rounded-[14px] border-[3px] shadow-[0_10px_20px_-8px_rgba(0,0,0,.85)] transition",
        wild
          ? "border-white/90 bg-[conic-gradient(from_45deg,#ef4444,#eab308,#22c55e,#3b82f6,#ef4444)]"
          : `border-white/90 bg-gradient-to-br ${UNO_BG[c[0]]}`,
        onClick && !disabled
          ? "hover:-translate-y-2 hover:shadow-[0_18px_28px_-10px_rgba(0,0,0,.9)] focus-visible:-translate-y-2"
          : "",
        className,
      )}
    >
      {/* Kilau kaca kartu */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
      />
      {/* Oval putih klasik ala kartu UNO */}
      <span
        aria-hidden
        className="absolute inset-x-[7px] inset-y-[13px] -rotate-[18deg] rounded-[50%] border border-black/10 bg-white/95 shadow-[inset_0_-2px_4px_rgba(0,0,0,.12)]"
      />
      <span
        className={cn(
          "relative flex h-full items-center justify-center text-xl font-black italic tracking-tight",
          wild ? "text-zinc-800" : "text-zinc-900",
        )}
      >
        {glyph}
      </span>
      {/* Sudut kiri-atas & kanan-bawah */}
      <span className="absolute left-1.5 top-1 text-[10px] font-black italic text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.7)]">
        {glyph}
      </span>
      <span className="absolute bottom-1 right-1.5 rotate-180 text-[10px] font-black italic text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.7)]">
        {glyph}
      </span>
    </button>
  );
}

/** Punggung kartu UNO (untuk tumpukan lawan). */
function UnoBack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-[38px] w-[26px] overflow-hidden rounded-[6px] border-2 border-white/85 bg-[linear-gradient(140deg,#1d1d27,#0c0c12)] shadow",
        className,
      )}
    >
      <span className="absolute inset-[3px] rounded-[4px] border border-white/25" />
      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black italic text-red-400">
        UNO
      </span>
    </span>
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
  const dorongMut = useMutation(api.games.dorong);
  const [pickWild, setPickWild] = useState<number | null>(null);
  const [drew, setDrew] = useState(false);
  /** Tangan DISPREAD miring (default) atau dibuka jadi barisan lurus. */
  const [fan, setFan] = useState(true);
  /** Kartu yang sedang diterbangkan ke papan saat dibuang. */
  const [fly, setFly] = useState<{ c: string; id: number } | null>(null);
  /** Efek tembakan DORONG ke lawan. */
  const [shot, setShot] = useState<{ name: string; id: number } | null>(null);

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
      // Animasi: kartu TERBANG dari tangan ke papan.
      setFly({ c: card, id: Date.now() });
      window.setTimeout(() => setFly(null), 520);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal main kartu");
    }
  };

  /** Tembak/DORONG lawan yang sisa 1 kartu tapi belum teriak UNO. */
  const doDorong = async (t: { userId: string; username: string }) => {
    try {
      await dorongMut({
        sessionId,
        targetId: t.userId as Id<"users">,
      });
      setShot({ name: t.username, id: Date.now() });
      window.setTimeout(() => setShot(null), 950);
      toast.success(`Dorong ${t.username}! +2 kartu hukuman`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mendorong");
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">{/* Lawan — rata tengah, wrap untuk 3-5 pemain */}
      <div className="flex flex-wrap justify-center gap-2 px-3 py-2">
        {opponents.map((p) => {
          const count = uno.counts[p.userId] ?? 0;
          const active = uno.turn === p.userId;
          const called = uno.unoCalled[p.userId];
          const pushable = count === 1 && !called;
          return (
            <div
              key={p.userId}
              className={cn(
                "relative flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2 transition",
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
              {/* Tumpukan kartu lawan — punggung kartu UNO, bukan angka polos. */}
              <span className="flex h-[42px] items-center justify-center">
                {Array.from({ length: Math.min(count, 4) }, (_, k) => (
                  <UnoBack
                    key={k}
                    className={cn(
                      "-ml-4 first:ml-0",
                      k > 0 && "-rotate-[10deg]",
                      k % 2 === 0 && "rotate-[6deg]",
                    )}
                  />
                ))}
                <span className="ml-1 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-black text-white ring-1 ring-white/25">
                  {count}
                </span>
              </span>
              {count === 1 && called && (
                <span className="rounded bg-amber-400 px-1.5 text-[8px] font-black text-black">
                  UNO!
                </span>
              )}
              {/* Tombol DORONG — muncul saat lawan sisa 1 kartu & belum UNO. */}
              {pushable && (
                <button
                  type="button"
                  onClick={() => void doDorong(p)}
                  className="mt-0.5 w-full rounded-lg bg-gradient-to-b from-orange-400 to-red-600 px-2 py-1 text-[10px] font-black text-white shadow-[0_8px_16px_-8px_rgba(239,68,68,.9)] transition hover:brightness-110 active:scale-95"
                >
                  DORONG!
                </button>
              )}
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
          {/* Kartu teratas — animasi jatuh dari atas tiap kali kartu baru */}
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
              <motion.div
                key={`${uno.top}-${uno.color}-${uno.deckCount}`}
                initial={{ scale: 0.55, y: -70, rotate: -38, opacity: 0 }}
                animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 17 }}
                className="relative"
              >
                <UnoCard c={uno.top} />
              </motion.div>
            </div>
          )}
        </div>

        {/* Aksi giliran — desain pill premium */}
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
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 text-[11px] font-black text-white transition hover:bg-white/15 active:scale-95 disabled:opacity-35"
          >
            <span aria-hidden>🂠</span> Tarik Kartu
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
            className="rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 text-[11px] font-black text-white transition hover:bg-white/15 active:scale-95 disabled:opacity-35"
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
              "rounded-full px-5 py-2 text-[11px] font-black italic tracking-wide transition active:scale-95",
              myCount === 1
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_0_20px_-4px_rgba(251,191,36,.9)] animate-pulse"
                : "border border-white/15 bg-white/5 text-white/40",
            )}
          >
            UNO!
          </button>
        </div>
      </div>

      {/* Tangan saya — menyebar MIRING dari kiri; ketuk judul untuk
          keluar SEMUA kartu berjejer barisan (wrap, muat berbagai baris). */}
      <div className="border-t border-white/10 px-3 pb-6 pt-3">
        <button
          type="button"
          onClick={() => setFan((f) => !f)}
          className="mb-2.5 w-full text-center text-[10px] font-bold uppercase tracking-widest text-white/45 transition hover:text-white/70"
        >
          Kartu kamu · {myHand.length} {fan ? "· ketuk untuk barisan" : "· ketuk untuk menyebar"}
        </button>
        <div
          className={cn(
            "thin-scroll flex items-end pb-1 pt-4",
            fan ? "gap-0.5 overflow-x-auto" : "flex-wrap justify-center gap-2",
          )}
        >
          {myHand.map((c, i) => {
            const mid = (myHand.length - 1) / 2;
            const rot = fan ? (i - mid) * 3.6 : 0;
            const lift = fan ? Math.abs(i - mid) * 3 : 0;
            return (
              <motion.span
                layout
                key={`${c}-${i}`}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="shrink-0"
                style={{
                  marginLeft: i === 0 ? 0 : fan ? -14 : 0,
                  zIndex: i,
                }}
              >
                <span
                  className="block transition-transform duration-300"
                  style={{ transform: `translateY(${lift}px) rotate(${rot}deg)` }}
                >
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
                </span>
              </motion.span>
            );
          })}
          {myHand.length === 0 && (
            <p className="py-6 w-full text-center text-xs text-white/40">
              Menunggu kartu dibagikan…
            </p>
          )}
        </div>
      </div>

      {/* Animasi kartu TERBANG dari tangan ke papan */}
      {fly && (
        <motion.span
          key={fly.id}
          initial={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
          animate={{ y: -170, scale: 0.92, rotate: 420, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeIn" }}
          className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2"
          aria-hidden
        >
          <UnoCard c={fly.c} />
        </motion.span>
      )}

      {/* Efek tembakan DORONG ke lawan */}
      {shot && (
        <motion.div
          key={shot.id}
          initial={{ opacity: 0, scale: 0.5, y: 40 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1, 1.4], y: [40, 0, 0, -30] }}
          transition={{ duration: 0.95, times: [0, 0.25, 0.7, 1] }}
          className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2"
          aria-hidden
        >
          <span className="flex items-center gap-2 rounded-2xl border-2 border-orange-400/70 bg-gradient-to-b from-orange-500/90 to-red-700/90 px-5 py-3 text-lg font-black italic text-white shadow-[0_0_40px_-6px_rgba(249,115,22,.95)]">
            💥 DORONG {shot.name}!
          </span>
        </motion.div>
      )}

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

  /** Posisi petak (dalam % papan) sesuai tampilan (flip untuk hitam). */
  const cellPos = (i: number) => {
    const disp = flip ? 63 - i : i;
    const col = disp % 8;
    const row = Math.floor(disp / 8);
    return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
  };

  /** Animasi langkah terakhir — bidak DITERBANGKAN dari petak lama ke
      petak baru (bukan teleport). Reset tiap `chess.last` berubah. */
  const [anim, setAnim] = useState<{
    from: number;
    to: number;
    piece: string;
    id: number;
  } | null>(null);
  const lastKey = chess.last ? `${chess.last.from}-${chess.last.to}` : "";
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!chess.last) return;
    // Jangan animasikan langkah lama saat baru membuka layar.
    if (lastRef.current === null) {
      lastRef.current = lastKey;
      return;
    }
    if (lastRef.current === lastKey) return;
    lastRef.current = lastKey;
    const piece = chess.board[chess.last.to];
    if (!piece) return;
    setAnim({
      from: chess.last.from,
      to: chess.last.to,
      piece,
      id: Date.now(),
    });
    const t = window.setTimeout(() => setAnim(null), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);

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

      {/* Papan — petak persegi SERAGAM (grid-rows-8 penuh) + bidak yang
          GERAK halus antar petak (transisi), bukan teleport. */}
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_-30px_rgba(0,0,0,1)]">
        <div className="grid h-full w-full grid-cols-8 grid-rows-8">
          {order.map((i) => {
            const f = i % 8;
            const r = Math.floor(i / 8);
            const light = (f + r) % 2 === 0;
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

        {/* Bidak — diposisikan absolut; yang sedang bergerak disembunyikan
            di petak tujuan dan digantikan ghost yang meluncur. */}
        {chess.board.map((piece, i) => {
          if (!piece) return null;
          if (anim && anim.to === i) return null; // sementara digantikan ghost
          const p = cellPos(i);
          return (
            <span
              key={`${i}-${piece}`}
              aria-hidden={false}
              className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(18px,7vw,30px)] leading-none transition-all duration-300 ease-out"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <span
                className={cn(
                  piece[0] === "w"
                    ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
                    : "text-zinc-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]",
                )}
              >
                {GLYPH[piece]}
              </span>
            </span>
          );
        })}

        {/* Ghost langkah — meluncur dari petak lama ke petak baru. */}
        {anim && (
          <motion.span
            key={anim.id}
            aria-hidden
            initial={{
              left: `${cellPos(anim.from).x}%`,
              top: `${cellPos(anim.from).y}%`,
              scale: 1.15,
            }}
            animate={{
              left: `${cellPos(anim.to).x}%`,
              top: `${cellPos(anim.to).y}%`,
              scale: 1,
            }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2 text-[clamp(18px,7vw,30px)] leading-none"
          >
            <span
              className={cn(
                anim.piece[0] === "w"
                  ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
                  : "text-zinc-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]",
              )}
            >
              {GLYPH[anim.piece]}
            </span>
          </motion.span>
        )}
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

/* --------------------------- ULAR TANGGA ----------------------------- */

/** Titik tengah petak n (1..100) dalam % papan — baris 0 di bawah,
 *  jalur ular-ke-ular (baris genap ke kanan, ganjil ke kiri). */
function cellPct(n: number) {
  const i = Math.min(100, Math.max(1, n)) - 1;
  const row = Math.floor(i / 10);
  const colIn = i % 10;
  const col = row % 2 === 0 ? colIn : 9 - colIn;
  return { x: (col + 0.5) * 10, y: (9 - row + 0.5) * 10 };
}

/** Wajah dadu (pip layout klasik 1–6). */
function DiceFace({ n }: { n: number }) {
  const PIPS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const on = PIPS[n] ?? [];
  return (
    <span className="grid h-full w-full grid-cols-3 grid-rows-3 gap-[3px] p-[6px]">
      {Array.from({ length: 9 }, (_, k) => (
        <span
          key={k}
          className={cn(
            "flex items-center justify-center",
          )}
        >
          {on.includes(k) && (
            <span className="size-full max-w-2 max-h-2 rounded-full bg-zinc-900 shadow-[inset_0_1px_1px_rgba(255,255,255,.4)]" />
          )}
        </span>
      ))}
    </span>
  );
}

function SnakesTable({
  sessionId,
  s,
  myId,
}: {
  sessionId: Id<"gameSessions">;
  s: SnakesView;
  myId: Id<"users"> | null;
}) {
  const st = s.snakes;
  const rollMut = useMutation(api.games.snakesRoll);
  const [rolling, setRolling] = useState(false);
  const myTurn = !!myId && st.turn === myId;
  const nameOf = (id: string) =>
    s.players.find((p) => p.userId === id)?.username ?? "…";

  // Posisi TAMPIL per pemain — dijalankan LANGKAH DEMI LANGKAH mengikuti
  // jalur petak (boustrophedon: kanan → atas → kiri → atas → kanan …),
  // jadi token berjalan, bukan teleport.
  const [anim, setAnim] = useState<Record<string, number>>({});
  const prevPos = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const cur = st.pos;
    const prev = prevPos.current;
    prevPos.current = cur;
    if (!prev) return;
    const touched = new Set<string>();
    const timers: number[] = [];
    for (const p of s.players) {
      const from = prev[p.userId] ?? 0;
      const to = cur[p.userId] ?? 0;
      if (from < 1 || from === to) continue;
      touched.add(p.userId);
      const up = to > from;
      // Naik (dadu) jalan pelan-pelan; kena ular meluncur cepat turun.
      const stepMs = up ? 210 : 80;
      const path: number[] = [];
      if (up) for (let n = from + 1; n <= to; n++) path.push(n);
      else for (let n = from - 1; n >= to; n--) path.push(n);
      if (path.length > 0) {
        // Langkah pertama langsung diset supaya token nggak nongol di
        // petak tujuan akhir dulu sebelum mulai berjalan.
        const first = path[0];
        setAnim((a) => ({ ...a, [p.userId]: first }));
      }
      path.forEach((n, i) => {
        timers.push(
          window.setTimeout(
            () => setAnim((a) => ({ ...a, [p.userId]: n })),
            stepMs * i,
          ),
        );
      });
      timers.push(
        window.setTimeout(
          () =>
            setAnim((a) => {
              const c = { ...a };
              delete c[p.userId];
              return c;
            }),
          stepMs * path.length + 260,
        ),
      );
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      // Roll berikutnya menggantikan animasi lama — buang sisanya supaya
      // token tidak tertinggal di posisi basi.
      if (touched.size > 0) {
        setAnim((a) => {
          const c = { ...a };
          for (const k of touched) delete c[k];
          return c;
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.pos]);

  const roll = async () => {
    if (!myTurn || rolling) return;
    setRolling(true);
    try {
      await rollMut({ sessionId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal melempar dadu");
    }
    // Biar animasi putar dadu terlihat sebentar sebelum hasil muncul.
    window.setTimeout(() => setRolling(false), 550);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-2">
      {/* Pemain + posisi mereka */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {s.players.map((p) => {
          const active = st.turn === p.userId;
          const pos = st.pos[p.userId] ?? 0;
          return (
            <div
              key={p.userId}
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 transition",
                active
                  ? "border-amber-300/70 bg-amber-400/10 shadow-[0_0_16px_-6px_rgba(251,191,36,.9)]"
                  : "border-white/10 bg-white/[0.04]",
              )}
            >
              <Avatar src={p.image} seed={p.username} className={cn("size-8 ring-2", active ? "ring-amber-300" : "ring-white/15")} />
              <div className="min-w-0">
                <p className="max-w-24 truncate text-[10px] font-black">
                  {p.username}
                  {p.userId === myId && <span className="text-white/45"> (kamu)</span>}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                  {pos === 0 ? "Base" : `Petak ${pos}/100`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 flex items-center justify-center gap-2 text-xs font-bold">
        {myTurn ? (
          <span className="text-amber-300">Giliran kamu — lempar dadu!</span>
        ) : (
          <span className="text-white/70">Giliran {nameOf(st.turn)}</span>
        )}
        {st.lastRoll !== null && st.lastBy && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/75">
            {nameOf(st.lastBy)} melempar {st.lastRoll}
          </span>
        )}
      </p>

      {/* PAPAN 10x10 + ular & tangga */}
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_-30px_rgba(0,0,0,1)]">
        <div className="grid h-full w-full grid-cols-10 grid-rows-10">
          {Array.from({ length: 100 }, (_, k) => {
            const vr = Math.floor(k / 10);
            const cc = k % 10;
            const r = 9 - vr;
            const col = r % 2 === 0 ? cc : 9 - cc;
            const n = r * 10 + col + 1;
            const isLadder = st.ladders[n] !== undefined;
            const isSnake = st.snakeMap[n] !== undefined;
            const light = (r + col) % 2 === 0;
            return (
              <div
                key={n}
                className={cn(
                  "relative flex items-center justify-center border border-black/20",
                  light ? "bg-[#131c17]" : "bg-[#0c1210]",
                  n === 100 && "bg-gradient-to-br from-amber-400/40 to-emerald-400/30",
                  isLadder && "bg-emerald-500/20",
                  isSnake && "bg-rose-500/15",
                )}
              >
                <span
                  className={cn(
                    "text-[7px] font-black leading-none",
                    n === 100 ? "text-black" : "text-white/45",
                  )}
                >
                  {n}
                </span>
                {isLadder && (
                  <span aria-hidden className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.9)]" />
                )}
                {isSnake && (
                  <span aria-hidden className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_1px_rgba(244,63,94,.9)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Overlay SVG: tangga emas + ular pink-ungu (gaya neon Afinitas) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="snakeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f43f5e" />
              <stop offset="1" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          {/* Tangga */}
          {Object.entries(st.ladders).map(([a, b]) => {
            const p1 = cellPct(Number(a));
            const p2 = cellPct(Number(b));
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = -dy / len;
            const uy = dx / len;
            const w = 1.1;
            const rungs = Math.max(3, Math.floor(len / 7));
            return (
              <g key={`L${a}`} stroke="#f5c542" strokeLinecap="round" opacity="0.92">
                <line x1={p1.x + ux * w} y1={p1.y + uy * w} x2={p2.x + ux * w} y2={p2.y + uy * w} strokeWidth="0.8" />
                <line x1={p1.x - ux * w} y1={p1.y - uy * w} x2={p2.x - ux * w} y2={p2.y - uy * w} strokeWidth="0.8" />
                {Array.from({ length: rungs + 1 }, (_, i) => {
                  const t = i / rungs;
                  const cx = p1.x + dx * t;
                  const cy = p1.y + dy * t;
                  return (
                    <line
                      key={i}
                      x1={cx + ux * w}
                      y1={cy + uy * w}
                      x2={cx - ux * w}
                      y2={cy - uy * w}
                      strokeWidth="0.55"
                    />
                  );
                })}
              </g>
            );
          })}
          {/* Ular */}
          {Object.entries(st.snakeMap).map(([a, b]) => {
            const p1 = cellPct(Number(a));
            const p2 = cellPct(Number(b));
            const bend = Number(a) % 2 === 0 ? 8 : -8;
            const mx = (p1.x + p2.x) / 2 + bend;
            const my = (p1.y + p2.y) / 2;
            const d = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
            return (
              <g key={`S${a}`}>
                <path d={d} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="2.6" strokeLinecap="round" transform="translate(0.6,0.8)" />
                <path d={d} fill="none" stroke="url(#snakeGrad)" strokeWidth="2.1" strokeLinecap="round" />
                <path d={d} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="0.5" strokeDasharray="1.2 2.2" />
                <circle cx={p1.x} cy={p1.y} r="1.9" fill="#f43f5e" />
                <circle cx={p1.x - 0.7} cy={p1.y - 0.5} r="0.4" fill="#0a0a11" />
                <circle cx={p1.x + 0.7} cy={p1.y - 0.5} r="0.4" fill="#0a0a11" />
              </g>
            );
          })}
        </svg>

        {/* Token pemain di petak mereka (animasi langkah demi langkah) */}
        {s.players.map((p, idx) => {
          const n = anim[p.userId] ?? st.pos[p.userId] ?? 0;
          if (n < 1) return null;
          const c = cellPct(n);
          const same = s.players.filter(
            (q) => (anim[q.userId] ?? st.pos[q.userId] ?? 0) === n,
          );
          const k = same.findIndex((q) => q.userId === p.userId);
          const ox = same.length > 1 ? ((k % 2) * 2 - 1) * 2.2 : 0;
          const oy = same.length > 2 ? 3 : 0;
          const active = st.turn === p.userId;
          return (
            <span
              key={p.userId}
              className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[200ms] ease-in-out"
              style={{ left: `${c.x + ox}%`, top: `${c.y + oy}%` }}
            >
              <Avatar
                src={p.image}
                seed={p.username}
                className={cn(
                  "size-5 ring-2 transition",
                  active
                    ? "ring-amber-300 shadow-[0_0_10px_1px_rgba(251,191,36,.9)]"
                    : "ring-white/85",
                )}
              />
            </span>
          );
        })}

        {/* Papan START — pemain yang masih base (pos 0) */}
        <span className="absolute bottom-0.5 left-1 z-[2] flex gap-1">
          {s.players
            .filter((p) => (st.pos[p.userId] ?? 0) === 0)
            .map((p) => (
              <Avatar
                key={p.userId}
                src={p.image}
                seed={p.username}
                className="size-4 ring-1 ring-white/60"
              />
            ))}
        </span>
      </div>

      {/* DADU + aksi */}
      <div className="mt-3 flex flex-col items-center gap-2">
        <button
          onClick={() => void roll()}
          disabled={!myTurn || rolling}
          aria-label="Lempar dadu"
          className={cn(
            "relative size-16 rounded-2xl border-2 bg-gradient-to-b from-white to-zinc-300 shadow-[0_10px_26px_-10px_rgba(0,0,0,.9)] transition active:scale-95",
            myTurn
              ? "border-amber-300 shadow-[0_0_22px_-6px_rgba(251,191,36,.95)]"
              : "border-white/30 opacity-55",
            rolling && "animate-[dice-tumble_0.5s_ease-in-out_infinite]",
          )}
        >
          {/* Wajah dadu POP muncul tiap hasil lemparan baru. */}
          <motion.span
            key={`d-${st.lastRoll ?? 0}-${st.lastBy ?? ""}`}
            initial={{ scale: 0.55, rotate: -35, opacity: 0.3 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 15 }}
            className="block h-full w-full"
          >
            <DiceFace n={st.lastRoll ?? 0} />
          </motion.span>
        </button>
        <p className="text-[11px] font-bold text-white/60">
          {myTurn
            ? "Ketuk dadu untuk maju"
            : st.lastRoll !== null
              ? `Dadu: ${st.lastRoll}`
              : "Belum ada yang melempar"}
        </p>
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

