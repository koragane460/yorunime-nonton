import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/lstream-ui";
import { VoiceGamesOverlay } from "@/components/VoiceGames";
import { VoiceChatSheet } from "@/components/VoiceChatSheet";
import { useHideNavOnMount } from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  Coffee,
  Copy,
  Gamepad2,
  GraduationCap,
  Globe,
  Headphones,
  Info,
  Link2,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Music,
  PhoneOff,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
} from "lucide-react";

/* ====================================================================== *
 *  VOICE CALL — YoruNime Voice Call Room
 *
 *  Audio mengalir P2P lewat WebRTC (mic browser → browser lain), signaling
 *  lewat Convex. Tidak butuh API key, jadi langsung bisa dipakai.
 * ====================================================================== */

type RoomType = "casual" | "gaming" | "study" | "music";

const TYPE_META: Record<
  string,
  { label: string; Icon: typeof Coffee; cls: string }
> = {
  casual: { label: "Casual Talk", Icon: Coffee, cls: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  gaming: { label: "Gaming", Icon: Gamepad2, cls: "text-sky-300 border-sky-400/40 bg-sky-400/10" },
  study: { label: "Study", Icon: GraduationCap, cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
  music: { label: "Music", Icon: Music, cls: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10" },
};

const metaOf = (t?: string) => TYPE_META[t ?? "casual"] ?? TYPE_META.casual;

/** Warna latar kotak peserta — diturunkan dari nama supaya senada avatar. */
function participantTint(seed?: string) {
  const s = seed ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 24% / 0.55)`;
}

/** Ikon dicoret (status OFF) — garis miring menimpa ikon. */
function Slashed({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      {children}
      <span
        aria-hidden
        className="absolute left-[-2px] top-1/2 h-[2px] w-[calc(100%+4px)] -translate-y-1/2 rotate-[-40deg] rounded-full bg-current"
      />
    </span>
  );
}

/* ====================================================================== *
 *  SHELL
 * ====================================================================== */

export function VoiceCallScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const [view, setView] = useState<"home" | "create">("home");
  const [roomId, setRoomId] = useState<Id<"voiceRooms"> | null>(null);
  const { user } = useAuth();

  if (roomId) {
    return (
      <RoomScreen
        roomId={roomId}
        myId={user?._id ?? null}
        onLeave={() => setRoomId(null)}
      />
    );
  }
  if (view === "create") {
    return (
      <CreateRoomScreen
        onCancel={() => setView("home")}
        onCreated={(id) => setRoomId(id)}
      />
    );
  }
  return (
    <VoiceHomeScreen
      onClose={onClose}
      onCreate={() => setView("create")}
      onJoin={setRoomId}
    />
  );
}

/* ====================================================================== *
 *  1) DAFTAR ROOM
 * ====================================================================== */

function VoiceHomeScreen({
  onClose,
  onCreate,
  onJoin,
}: {
  onClose: () => void;
  onCreate: () => void;
  onJoin: (id: Id<"voiceRooms">) => void;
}) {
  useHideNavOnMount();
  const { user } = useAuth();
  const rooms = useQuery(api.voice.listRooms, {});
  const joinMut = useMutation(api.voice.joinRoom);
  // Link "yorucall/join/GP-xxxxxxx" yang dibuka di aplikasi ini otomatis
  // join begitu layar terbuka (?vcall=GP-xxxxxxx).
  const linkCode = useMemo(() => {
    try {
      return (
        new URLSearchParams(window.location.search).get("vcall") ?? undefined
      );
    } catch {
      return undefined;
    }
  }, []);
  const target = useQuery(
    api.voice.roomByCode,
    linkCode ? { code: linkCode } : "skip",
  );
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!target || joining || !user) return;
    setJoining(true);
    void joinMut({ roomId: target._id, linkCode: target.matchedCode ?? undefined })
      .then(() => onJoin(target._id))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Gagal join room");
        setJoining(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?._id, user?._id]);

  const join = async (r: { _id: Id<"voiceRooms">; privacy: string }) => {
    if (!user) {
      toast.info("Login dulu ya");
      return;
    }
    if (r.privacy === "private") {
      toast.error("Room private — minta link undangan ke host");
      return;
    }
    try {
      await joinMut({ roomId: r._id });
      onJoin(r._id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal join room");
    }
  };

  const list = rooms ?? [];

  return (
    <div className="screen-enter fixed inset-0 z-[70] overflow-y-auto bg-background">
      <div className="w-full p-3 pb-16">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        {/* SATU KOTAK PREMIUM: judul + status + tombol create, rata tengah. */}
        <div className="relative mt-2 overflow-hidden rounded-3xl border border-emerald-400/25 bg-[linear-gradient(165deg,#0b1f1a_0%,#0d1420_55%,#0a0c12_100%)] p-5 text-center yn-cut">
          <span aria-hidden className="absolute inset-x-10 top-px h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
          {/* Hiasan halus: taburan titik + ornamen sudut — BUKAN blur besar
              yang menyilaukan. */}
          <span aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.045)_1px,transparent_1.2px)] [background-size:24px_24px] opacity-70" />
          <span aria-hidden className="absolute left-3 top-3 size-3 border-l-2 border-t-2 border-emerald-300/45 rounded-tl-md" />
          <span aria-hidden className="absolute right-3 top-3 size-3 border-r-2 border-t-2 border-emerald-300/45 rounded-tr-md" />
          <span
            aria-hidden
            className="relative mx-auto flex h-12 items-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4"
          >
            {/* Equalizer hidup — pengganti medallion bulat yang itu-itu aja. */}
            {[10, 22, 16, 28, 14, 24, 12].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-emerald-400 to-teal-200"
                style={{
                  height: h,
                  animation: `eq-bar 1s ${i * 0.12}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </span>
          <h1 className="relative mt-3 bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-xl font-black tracking-tight text-transparent">
            YoruNime Voice Call Room
          </h1>
          <div className="relative mt-1.5 flex items-center justify-center gap-2 text-[11px]">
            <span className="text-white/50">pilih room untuk join</span>
            <span className="text-white/25">•</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-2 py-0.5 font-black text-emerald-200">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              {list.length} room online
            </span>
          </div>

          {/* Tombol buat room */}
          <button
            onClick={() => {
              if (!user) {
                toast.info("Login dulu ya");
                return;
              }
              onCreate();
            }}
            className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3.5 text-sm font-black text-black transition hover:brightness-110 active:scale-[0.98]"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-black/20">
              <Plus className="size-4" />
            </span>
            Create Voice Room
            <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-black tracking-wider">
              GRATIS
            </span>
          </button>
        </div>

        {/* Kepala daftar room */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-300 to-emerald-500" />
            <h2 className="text-base font-black tracking-tight">Voice Room</h2>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-200">
            {list.length} Room
          </span>
        </div>

        {rooms === undefined ? (
          <div className="mt-3 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Belum ada room — buat yang pertama!
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {list.map((r) => {
              const m = metaOf(r.type);
              const full = r.count >= r.maxUsers;
              const locked = r.privacy === "private";
              return (
                <div
                  key={r._id}
                  className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-[linear-gradient(160deg,#0b1a16_0%,#0d1220_58%,#0a0c12_100%)] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40 yn-cut-alt"
                >
                  <span aria-hidden className="absolute inset-x-10 top-px h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
                  <div className="relative flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-14 shrink-0 items-center justify-center rounded-2xl border",
                        m.cls,
                      )}
                    >
                      <m.Icon className="size-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black tracking-tight">{r.name}</p>
                      <p className="truncate text-[11px] font-bold text-white/55">{m.label}</p>
                    </div>
                    <button
                      onClick={() => void join(r)}
                      disabled={locked || full}
                      className={cn(
                        "shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition active:scale-95",
                        locked || full
                          ? "cursor-not-allowed bg-white/10 text-white/35"
                          : "bg-gradient-to-b from-emerald-300 to-emerald-500 text-black hover:brightness-110",
                      )}
                    >
                      {full ? "Penuh" : locked ? "Private" : "Join"}
                    </button>
                  </div>

                  {/* Garis pembatas agak pudar */}
                  <div className="relative my-3 h-px w-full bg-gradient-to-r from-white/20 via-white/8 to-transparent" />

                  {/* Foto member di KIRI, jumlah user menyusul (pill). */}
                  <div className="relative flex items-center gap-2.5">
                    <div className="flex -space-x-2.5">
                      {(r.previews ?? []).map((p, i) => (
                        <Avatar
                          key={`${p.userId}-${i}`}
                          src={p.image}
                          seed={p.username}
                          className="size-9 ring-2 ring-[#0b1018]"
                        />
                      ))}
                      {(r.previews ?? []).length === 0 && (
                        <span className="flex size-9 items-center justify-center rounded-full bg-white/10 ring-2 ring-[#0b1018]">
                          <Users className="size-4 text-white/50" />
                        </span>
                      )}
                    </div>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                      {r.count}/{r.maxUsers} User
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== *
 *  2) BUAT ROOM
 * ====================================================================== */

const TYPE_OPTIONS: { key: RoomType; label: string }[] = [
  { key: "casual", label: "Casual Talk" },
  { key: "gaming", label: "Gaming" },
  { key: "study", label: "Study" },
  { key: "music", label: "Music" },
];

function CreateRoomScreen({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: Id<"voiceRooms">) => void;
}) {
  useHideNavOnMount();
  const createMut = useMutation(api.voice.createRoom);
  const [name, setName] = useState("");
  const [type, setType] = useState<RoomType>("casual");
  const [typeOpen, setTypeOpen] = useState(false);
  const [max, setMax] = useState(10);
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const m = TYPE_META[type];

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createMut({ name, type, maxUsers: max, privacy });
      onCreated(id);
      toast.success("Room dibuat — mic kamu sudah nyala");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[70] overflow-y-auto bg-background">
      {/* Latar premium: aurora emerald + ungu + taburan bintik. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.2px)] [background-size:26px_26px] opacity-60" />
      </div>
      {/* Form dibuat lebih ke TENGAH (turun dari atas, tetap rata tengah
          horizontal lewat max-w-md). */}
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-3 pb-16 pt-10">
        <button
          onClick={onCancel}
          aria-label="Kembali"
          className="-ml-1 flex items-center py-1 pr-2 text-white/90 transition active:opacity-60"
        >
          <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden>
            <path
              d="M25 9H2M8 2 1.5 9 8 16"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Kepala layar — medallion mic, TANPA ornamen garis berlian. */}
        <div className="mt-4 flex flex-col items-center text-center">
          <span className="relative flex size-16 items-center justify-center rounded-full border border-emerald-300/45 bg-[linear-gradient(to_bottom,rgba(52,211,153,.3),rgba(16,185,129,.08))]">
            <Mic className="size-7 text-emerald-100" />
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-[#0a0d12] bg-emerald-400"
            />
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Buat{" "}
            <span className="text-emerald-300">
              Voice Room
            </span>
          </h1>
          <p className="mt-1 text-[11px] font-semibold text-white/50">
            Atur nama, jenis, kuota & privasi room kamu
          </p>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/12 bg-[linear-gradient(165deg,rgba(20,32,28,.92)_0%,rgba(13,15,22,.94)_60%,rgba(9,10,15,.96)_100%)] p-4 backdrop-blur-xl">
          <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
          {/* Nama room */}
          <p className="flex items-center gap-2 text-[13px] font-black text-white/85">
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-400/15 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/40">
              01
            </span>
            Nama room
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="mis. Nongkrong Santai"
            className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/60"
          />

          {/* Room type */}
          <p className="mt-4 flex items-center gap-2 text-[13px] font-black text-white/85">
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-400/15 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/40">
              02
            </span>
            Room Type
          </p>
          <button
            onClick={() => setTypeOpen((v) => !v)}
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-left"
          >
            <span className={cn("flex size-6 items-center justify-center rounded-md border", m.cls)}>
              <m.Icon className="size-3.5" />
            </span>
            <span className="flex-1 text-sm font-semibold">{m.label}</span>
            <ChevronDown
              className={cn(
                "size-4 text-white/50 transition-transform duration-300",
                typeOpen && "rotate-180",
              )}
            />
          </button>
          {/* Pilihan muncul MELUNCUR ke bawah (animasi height). */}
          <AnimatePresence initial={false}>
            {typeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-2">
                  {TYPE_OPTIONS.map((o) => {
                    const om = TYPE_META[o.key];
                    const on = o.key === type;
                    return (
                      <button
                        key={o.key}
                        onClick={() => {
                          setType(o.key);
                          setTypeOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                          on ? "bg-white/12 font-bold" : "hover:bg-white/6",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded-md border",
                            om.cls,
                          )}
                        >
                          <om.Icon className="size-3.5" />
                        </span>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Max user */}
          <p className="mt-4 flex items-center gap-2 text-[13px] font-black text-white/85">
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-400/15 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/40">
              03
            </span>
            Max user
          </p>
          <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/15 bg-black/40 px-2.5 py-2">
            <button
              onClick={() => setMax((v) => Math.max(1, v - 1))}
              aria-label="Kurangi max user"
              className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 transition active:scale-90 disabled:opacity-40"
              disabled={max <= 1}
            >
              <Minus className="size-4" />
            </button>
            <span className="text-sm font-black tabular-nums">{max}</span>
            <button
              onClick={() => setMax((v) => Math.min(10, v + 1))}
              aria-label="Tambah max user"
              className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 transition active:scale-90 disabled:opacity-40"
              disabled={max >= 10}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-white/40">
            Maksimal 10 orang, minimal 1
          </p>

          {/* Privasi room */}
          <p className="mt-4 flex items-center gap-2 text-[13px] font-black text-white/85">
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-400/15 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/40">
              04
            </span>
            Privasi Room
          </p>
          <div className="mt-1.5 space-y-2">
            <PrivacyBox
              active={privacy === "public"}
              onClick={() => setPrivacy("public")}
              icon={<Globe className="size-4" />}
              title="Publik"
              desc="Izinkan siapapun memasuki room"
            />
            <PrivacyBox
              active={privacy === "private"}
              onClick={() => setPrivacy("private")}
              icon={<Lock className="size-4" />}
              title="Private"
              desc="Invite melalui link"
            />
          </div>

          <div className="mt-3 flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/60">
              <Info className="size-3" />
            </span>
            <p className="text-[10px] leading-snug text-white/50">
              Join ketika room di private hanya bisa saat join melalui link.
            </p>
          </div>

          {/* Tombol buat — kotak luar menyatu, kotak dalam di tengah. */}
          <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-[linear-gradient(150deg,rgba(16,185,129,.14),rgba(255,255,255,.03))] p-2">
            <button
              onClick={() => void submit()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3.5 text-sm font-black text-black transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-black/20">
                <Mic className="size-3.5" />
              </span>
              {busy ? "Membuat…" : "Buat Voice Room"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyBox({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
        active
          ? "border-emerald-400/60 bg-emerald-400/10"
          : "border-white/12 bg-black/30",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border",
          active
            ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
            : "border-white/15 bg-white/5 text-white/60",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="block text-[10px] text-white/50">{desc}</span>
      </span>
      {/* Toggle — hanya satu yang bisa aktif. */}
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          active ? "bg-emerald-500" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            active ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/* ====================================================================== *
 *  3) RUANG PANGGILAN (WebRTC)
 * ====================================================================== */

function RoomScreen({
  roomId,
  myId,
  onLeave,
}: {
  roomId: Id<"voiceRooms">;
  myId: Id<"users"> | null;
  onLeave: () => void;
}) {
  useHideNavOnMount();
  const room = useQuery(api.voice.roomDetail, { roomId });
  const leaveMut = useMutation(api.voice.leaveRoom);
  const [showInvite, setShowInvite] = useState(false);
  // Minimize: perkecil room jadi pil kecil (mic & music tetap jalan).
  const [minimized, setMinimized] = useState(false);
  const call = useVoiceCall(roomId, myId);
  // --- GAME (UNO / Catur) ---
  const [gameOpen, setGameOpen] = useState(false);
  const [gameSession, setGameSession] = useState<Id<"gameSessions"> | null>(
    null,
  );
  const activeGame = useQuery(api.games.activeInRoom, { roomId });
  const invites = useQuery(api.games.myInvites, myId ? {} : "skip");
  const respondMut = useMutation(api.games.respond);
  // Ajakan game yang masuk ke room INI (banner + tombol Gabung).
  const myInvite = invites?.find((i) => i.roomId === roomId);

  // ---- CHAT ROOM — panel setengah layar (bukan fullscreen). ----
  const [chatOpen, setChatOpen] = useState(false);

  // ---- TOAST JOIN / KELUAR di bawah — muncul dari bawah, hilang sendiri. ----
  const memberKey = room?.members?.map((m) => m.userId).join("|") ?? "";
  const namesRef = useRef<Record<string, string>>({});
  const prevIdsRef = useRef<string[] | null>(null);
  const [pops, setPops] = useState<
    { key: string; name: string; kind: "join" | "leave" }[]
  >([]);
  useEffect(() => {
    if (room) {
      for (const m of room.members ?? [])
        namesRef.current[String(m.userId)] = m.username;
    }
    const ids = memberKey ? memberKey.split("|") : [];
    const prev = prevIdsRef.current;
    prevIdsRef.current = ids;
    if (!prev) return;
    const nowSet = new Set(ids);
    const prevSet = new Set(prev);
    const events = [
      ...ids.filter((id) => !prevSet.has(id)).map((id) => ({ id, kind: "join" as const })),
      ...prev.filter((id) => !nowSet.has(id)).map((id) => ({ id, kind: "leave" as const })),
    ];
    if (events.length === 0) return;
    const batch = events.map((e, i) => ({
      key: `${e.kind}-${e.id}-${Date.now()}-${i}`,
      name: namesRef.current[e.id] ?? "Seseorang",
      kind: e.kind,
    }));
    setPops((p) => [...p, ...batch]);
    setTimeout(() => {
      setPops((p) => p.filter((x) => !batch.some((b) => b.key === x.key)));
    }, 2800);
  }, [memberKey, room]);

  const leave = useCallback(async () => {
    try {
      await leaveMut({ roomId });
    } catch {
      /* room sudah tertutup */
    }
    onLeave();
  }, [leaveMut, roomId, onLeave]);

  // Keluar otomatis saat layar ditutup — kecuali unmount sesaat (dev strict).
  useEffect(() => {
    const at = Date.now();
    return () => {
      if (Date.now() - at > 1200) void leaveMut({ roomId }).catch(() => {});
    };
  }, [leaveMut, roomId]);

  if (!room) {
    return (
      <div className="screen-enter fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Memuat room…</p>
        <button
          onClick={onLeave}
          className="mt-3 rounded-full border border-white/15 px-4 py-2 text-xs"
        >
          Kembali
        </button>
      </div>
    );
  }

  const mine = myId ? room.members.find((m) => m.userId === myId) : undefined;
  const host = room.ownerId === myId;
  const ordered = [
    ...(mine ? [mine] : []),
    ...room.members.filter((m) => m.userId !== myId),
  ];
  const alone = ordered.length <= 1;
  const m = metaOf(room.type);

  // Room di-minimize — panggilan tetap hidup jadi kotak besar di home:
  // foto + status mic di kiri, nama & type room di tengah (ketuk = balik),
  // dua tombol bulat di kanan (mute & keluar). Tanpa glow.
  if (minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3.5 rounded-3xl border border-white/15 bg-[#10141d]/95 p-3.5 backdrop-blur-md">
          {/* Kiri — foto profile, di bawahnya ikon mic (merah saat mute, hijau saat on). */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <Avatar
              src={mine?.image}
              seed={mine?.username ?? "user"}
              className="size-14 shrink-0"
            />
            <span
              className={cn(
                "flex items-center gap-0.5 text-[10px] font-black",
                call.micOn ? "text-emerald-400" : "text-rose-500",
              )}
            >
              {call.micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
            </span>
          </div>
          {/* Tengah — nama room + type room. Ketuk untuk balik ke room. */}
          <button
            onClick={() => setMinimized(false)}
            className="min-w-0 flex-1 rounded-xl text-left"
          >
            <p className="truncate text-[15px] font-black text-white">
              {room.name || `Voice Room By ${mine?.username ?? "user"}`}
            </p>
            <p className="truncate text-[11px] text-white/50">{m.label}</p>
          </button>
          {/* Kanan — dua tombol bulat: mute (merah saat mute) & keluar. */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={call.toggleMic}
              aria-label={call.micOn ? "Matikan mic" : "Nyalakan mic"}
              className={cn(
                "flex size-12 items-center justify-center rounded-full border transition active:scale-95",
                call.micOn
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-rose-500/50 bg-rose-500/25 text-rose-300",
              )}
            >
              <Mic className="size-5" />
            </button>
            <button
              onClick={() => void leave()}
              aria-label="Keluar dari room"
              className="flex size-12 items-center justify-center rounded-full border border-rose-500/50 bg-rose-500/20 text-rose-400 transition active:scale-95"
            >
              <PhoneOff className="size-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showInvite) {
    return (
      <InviteScreen
        roomId={roomId}
        onBack={() => setShowInvite(false)}
        count={room.count}
        max={room.maxUsers}
        linkCode={room.linkCode}
        hasOneTime={room.hasOneTime}
      />
    );
  }

  return (
    <div className="screen-enter fixed inset-0 z-[70] flex flex-col bg-background">
      {/* Kepala room */}
      <div className="flex items-start gap-3 px-3 pt-3">
        <button
          onClick={() => setMinimized(true)}
          aria-label="Perkecil room"
          className="flex size-10 shrink-0 items-center justify-center text-white/85 transition active:scale-95"
        >
          <ChevronDown className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">
            Voice Room By {mine?.username ?? "user"}
          </p>
          <p className="truncate text-[11px] text-white/50">{m.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Tombol CHAT ROOM — panel setengah layar (bukan fullscreen). */}
          <button
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Chat room"
            className="flex size-10 items-center justify-center text-white/85 transition hover:text-white active:scale-95"
          >
            <MessageCircle className="size-5" />
          </button>
          {/* Tombol GAME — semua member, tanpa background. Untuk non-host
              ini menggantikan posisi tombol invite; host punya invite
              di sebelah KANANNYA. */}
          <button
            onClick={() => {
              if (activeGame) setGameSession(activeGame.sessionId);
              setGameOpen(true);
            }}
            aria-label="Game"
            className="flex size-10 items-center justify-center text-white/85 transition hover:text-white active:scale-95"
          >
            <Gamepad2 className="size-5" />
          </button>
          {host && (
            <button
              onClick={() => setShowInvite(true)}
              aria-label="Invite user"
              className="flex size-10 shrink-0 items-center justify-center text-white/85 transition hover:text-white active:scale-95"
            >
              <span className="relative">
                <Users className="size-5" />
                <Plus className="absolute -right-1.5 -top-1.5 size-3.5" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Undangan GAME dari host — foto profile, nama, jenis game, Gabung. */}
      {myInvite && !gameSession && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 mt-2 flex items-center gap-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/12 p-2.5"
        >
          <Avatar
            src={myInvite.fromImage}
            seed={myInvite.fromUsername}
            className="size-10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">
              <span className="text-fuchsia-200">{myInvite.fromUsername}</span>{" "}
              Mengajak bermain{" "}
              {myInvite.game === "uno"
                ? "UNO"
                : myInvite.game === "snakes"
                  ? "Ular Tangga"
                  : "Catur"}
            </p>
            <p className="text-[10px] text-white/55">
              {myInvite.roomName} · {myInvite.players}/{myInvite.seats} pemain
            </p>
            {/* Daftar pemain yang sudah bergabung ke sesi. */}
            {myInvite.playerList && myInvite.playerList.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                {myInvite.playerList.slice(0, 6).map((p, i) => (
                  <span
                    key={`${p.username}-${i}`}
                    className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.07] py-0.5 pl-0.5 pr-1.5 text-[9px] font-bold text-white/75"
                  >
                    <Avatar
                      src={p.image}
                      seed={p.username}
                      className="size-4"
                    />
                    {p.username}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                await respondMut({ inviteId: myInvite.inviteId, accept: true });
                setGameSession(myInvite.sessionId);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal join game");
              }
            }}
            className="shrink-0 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-500 px-4 py-2.5 text-xs font-black text-black shadow-lg shadow-fuchsia-600/25 transition active:scale-95"
          >
            Gabung
          </button>
        </motion.div>
      )}

      {/* Peserta — KOTAK GEDE persegi 2 kolom: sendiri satu kotak penuh,
          berdua kiri/kanan, ketiga di kiri bawah, keempat kanan, dst.
          Outline hijau menyala saat bicara; warna kotak mengikuti avatar. */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-4">
        <div
          className={cn(
            "grid w-full gap-3",
            // Sendiri: kotak MEMUAT LEBAR layar (dulu dibatasi 17rem jadi
            // terasa kecil) — aspect tetap supaya tinggi ikut membesar.
            alone ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {ordered.map((p) => {
            const isMe = p.userId === myId;
            const micOn = isMe ? call.micOn : call.peerMic[p.userId] ?? true;
            const talking = isMe
              ? call.speaking
              : !!call.peerSpeaking[p.userId];
            return (
              <div
                key={p.userId}
                className="flex min-w-0 flex-col items-center"
              >
                <div
                  className={cn(
                    "relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border py-6 transition",
                    alone ? "aspect-[3/5]" : "aspect-[3/4]",
                  )}
                  style={{ backgroundColor: participantTint(p.username) }}
                >
                  {/* Outline hijau di tepi kotak — nyala stabil saat bicara. */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-3xl border-2 transition",
                      talking
                        ? "border-emerald-400"
                        : "border-white/10",
                    )}
                  />
                  <div className="relative">
                    <Avatar
                      src={p.image}
                      seed={p.username}
                      className={cn(
                        "relative object-cover ring-2 transition",
                        talking
                          ? "ring-emerald-400 animate-pulse"
                          : "ring-white/25",
                        alone ? "size-32" : "size-20",
                      )}
                    />
                    {!micOn && (
                      <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-white/20 bg-black text-rose-300">
                        <MicOff className="size-3.5" />
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "w-full truncate px-2 text-center font-bold",
                      alone ? "text-base" : "text-[11px]",
                    )}
                  >
                    {p.username}
                    {isMe && <span className="text-white/40"> (kamu)</span>}
                  </p>
                  <span
                    className={cn(
                      "-mt-1 flex items-center gap-1 text-[10px] font-bold",
                      micOn ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {micOn ? <Mic className="size-3" /> : <MicOff className="size-3" />}
                    {micOn ? "On mic" : "Mute"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tombol bawah — TANPA background. */}
      <div className="grid grid-cols-4 gap-1 border-t border-white/10 px-3 pb-6 pt-4">
        <ControlButton
          onClick={call.toggleMic}
          label={call.micOn ? "On mic" : "Mute"}
          icon={call.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          active={call.micOn}
        />
        <ControlButton
          onClick={call.toggleSpeaker}
          label={call.speakerOn ? "Speaker On" : "Speaker Off"}
          icon={
            call.speakerOn ? (
              <Volume2 className="size-5" />
            ) : (
              <Slashed>
                <Volume2 className="size-5" />
              </Slashed>
            )
          }
          active={call.speakerOn}
        />
        <ControlButton
          onClick={call.toggleDeafen}
          label={call.deafen ? "Deafen On" : "Deafen Off"}
          icon={
            call.deafen ? (
              <Headphones className="size-5" />
            ) : (
              <Slashed>
                <Headphones className="size-5" />
              </Slashed>
            )
          }
          active={call.deafen}
        />
        <ControlButton
          onClick={() => void leave()}
          label="Keluar"
          icon={<PhoneOff className="size-5" />}
          danger
        />
      </div>

      {call.error && (
        <p className="px-4 pb-3 text-center text-[10px] text-amber-300">
          {call.error}
        </p>
      )}

      {/* Overlay GAME (menu · lobby · UNO · Catur) di atas panggung. */}
      {/* CHAT ROOM — panel setengah layar dari bawah. */}
      {chatOpen && (
        <VoiceChatSheet roomId={roomId} onClose={() => setChatOpen(false)} />
      )}

      {/* Toast JOIN / KELUAR — kotak kecil rounded, muncul dari bawah. */}
      {pops.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex flex-col items-center gap-1.5">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 14 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[11px] font-black shadow-[0_12px_26px_-14px_rgba(0,0,0,0.95)] backdrop-blur-md",
                  p.kind === "join"
                    ? "border-emerald-400/45 bg-emerald-500/25 text-emerald-100"
                    : "border-rose-400/40 bg-rose-500/20 text-rose-100",
                )}
              >
                {p.name} {p.kind === "join" ? "Join" : "Keluar"}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {(gameOpen || gameSession) && (
        <VoiceGamesOverlay
          roomId={roomId}
          sessionId={gameSession}
          onSession={(id) => setGameSession(id)}
          onClose={() => {
            setGameSession(null);
            setGameOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-1 transition active:scale-95"
    >
      <span
        className={cn(
          "transition",
          danger ? "text-rose-400" : active === false ? "text-white/55" : "text-white",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "text-[11px] font-extrabold leading-none",
          danger ? "text-rose-400" : active === false ? "text-white/55" : "text-white",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/* ---------------------------------------------------------- WebRTC ----- */

function useVoiceCall(roomId: Id<"voiceRooms">, myId: Id<"users"> | null) {
  const sendSignal = useMutation(api.voice.sendSignal);
  const signals = useQuery(api.voice.signals, { roomId });

  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [deafen, setDeafen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peerMic, setPeerMic] = useState<Record<string, boolean>>({});
  const [peerSpeaking, setPeerSpeaking] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  // true setelah mikrofon siap — pemicu sambungan peer (track harus sudah
  // ada dulu sebelum offer dikirim).
  const [micReady, setMicReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const gainRef = useRef<Map<string, GainNode>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const myIdRef = useRef<string>(myId ?? "");
  myIdRef.current = myId ?? "";
  const micRef = useRef(true);
  const deafenRef = useRef(false);
  const speakerRef = useRef(true);
  micRef.current = micOn;
  deafenRef.current = deafen;
  speakerRef.current = speakerOn;

  const applyMic = useCallback(() => {
    const enabled = micRef.current && !deafenRef.current;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }, []);

  const applySpeakers = useCallback(() => {
    const muted = !speakerRef.current || deafenRef.current;
    audioRef.current.forEach((el) => (el.muted = muted));
    gainRef.current.forEach((g) => (g.gain.value = muted ? 0 : 1));
  }, []);

  const attach = useCallback((peerId: string, stream: MediaStream) => {
    let el = audioRef.current.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      document.body.appendChild(el);
      audioRef.current.set(peerId, el);
    }
    el.srcObject = stream;
    const muted = !speakerRef.current || deafenRef.current;
    el.muted = muted;
    void el.play().catch(() => {
      /* autoplay diblokir sampai user interaksi */
    });

    // Routing lewat Web Audio: kompresor + gain stabil biar suara jernih
    // dan tidak "bergenging"/pecah saat lawan bicara bicara keras.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      void ctx.resume().catch(() => {});
      if (!gainRef.current.has(peerId)) {
        const mediaSrc = ctx.createMediaElementSource(el);
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 24;
        comp.ratio.value = 6;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        const gain = ctx.createGain();
        gain.gain.value = muted ? 0 : 1;
        mediaSrc.connect(comp);
        comp.connect(gain);
        gain.connect(ctx.destination);
        gainRef.current.set(peerId, gain);
      }
    } catch {
      /* MediaElementSource tidak tersedia — <audio> biasa tetap jalan */
    }
  }, []);

  const makePeer = useCallback(
    (peerId: string, initiator: boolean) => {
      const existing = pcRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
        ],
      });
      pcRef.current.set(peerId, pc);
      const stream = streamRef.current;
      if (stream && initiator) {
        for (const t of stream.getTracks()) pc.addTrack(t, stream);
      }
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void sendSignal({
          roomId,
          kind: "ice",
          payload: JSON.stringify({ to: peerId, candidate: e.candidate.toJSON() }),
        }).catch(() => {});
      };
      pc.ontrack = (e) => {
        const st = e.streams[0] ?? new MediaStream([e.track]);
        attach(peerId, st);
      };
      pc.onnegotiationneeded = async () => {
        // Hanya sisi dengan id lebih kecil yang menawarkan — mencegah
                 // dua offer bersamaan (glare).
        if (!initiator || pc.signalingState !== "stable") return;
        try {
          await pc.setLocalDescription();
          if (!pc.localDescription) return;
          await sendSignal({
            roomId,
            kind: "offer",
            payload: JSON.stringify({ to: peerId, desc: pc.localDescription }),
          });
        } catch {
          /* negosiasi gagal — coba lagi saat sinyal berikutnya */
        }
      };
      return pc;
    },
    [attach, roomId, sendSignal],
  );

  /* --- mikrofon --- */
  useEffect(() => {
    let cancelled = false;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      setError("Browser ini tidak mendukung mikrofon");
      return;
    }
    md.getUserMedia({
      // Noise suppression + echo cancellation bawaan browser → suara
      // jernih, minim gema/berdengung lawan bicara.
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        applyMic();
        setMicReady(true);
        // Deteksi bicara sederhana (RMS) → animasi cincin + sinyal ke room.
        try {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new Ctx();
          ctxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          src.connect(an);
          const data = new Uint8Array(an.frequencyBinCount);
          let last = false;
          timerRef.current = window.setInterval(() => {
            an.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;
            const on =
              micRef.current && !deafenRef.current && avg > 16;
            if (on !== last) {
              last = on;
              setSpeaking(on);
              void sendSignal({
                roomId,
                kind: "speaking",
                payload: JSON.stringify({ on }),
              }).catch(() => {});
            }
          }, 300);
        } catch {
          /* deteksi bicara nonaktif — panggilan tetap jalan */
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Izin mikrofon ditolak — kamu tetap bisa mendengar");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, applyMic, sendSignal]);

  /* --- bersihkan saat keluar --- */
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
      audioRef.current.forEach((el) => {
        el.srcObject = null;
        el.pause();
        el.remove();
      });
      audioRef.current.clear();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [roomId]);

  /* --- terima sinyal --- */
  useEffect(() => {
    if (!signals || !myId) return;
    const handle = async () => {
      for (const s of signals) {
        if (seenRef.current.has(String(s._id))) continue;
        seenRef.current.add(String(s._id));
        if (String(s.from) === String(myId)) continue;

        if (s.kind === "mic") {
          try {
            const d = JSON.parse(s.payload ?? "{}") as { on?: boolean };
            setPeerMic((prev) => ({ ...prev, [String(s.from)]: !!d.on }));
          } catch {
            /* abaikan */
          }
          continue;
        }
        if (s.kind === "speaking") {
          try {
            const d = JSON.parse(s.payload ?? "{}") as { on?: boolean };
            setPeerSpeaking((prev) => ({ ...prev, [String(s.from)]: !!d.on }));
          } catch {
            /* abaikan */
          }
          continue;
        }

        let data: any = {};
        try {
          data = JSON.parse(s.payload ?? "{}");
        } catch {
          continue;
        }
        if (data.to && String(data.to) !== String(myId)) continue;
        const from = String(s.from);
        try {
          if (s.kind === "offer") {
            const pc = makePeer(from, false);
            await pc.setRemoteDescription(data.desc);
            const stream = streamRef.current;
            if (stream && pc.getSenders().length === 0) {
              for (const t of stream.getTracks()) pc.addTrack(t, stream);
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal({
              roomId,
              kind: "answer",
              payload: JSON.stringify({ to: from, desc: pc.localDescription }),
            });
          } else if (s.kind === "answer") {
            const pc = pcRef.current.get(from);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(data.desc);
            }
          } else if (s.kind === "ice") {
            const pc = pcRef.current.get(from);
            if (pc) await pc.addIceCandidate(data.candidate).catch(() => {});
          }
        } catch {
          /* sinyal datang saat state belum siap — abaikan */
        }
      }
    };
    void handle();
  }, [signals, myId, makePeer, sendSignal, roomId]);

  /* --- sambungkan ke semua member (inisiatif = id lebih kecil) --- */
  const room = useQuery(api.voice.roomDetail, { roomId });
  const members = useMemo(() => room?.members ?? [], [room]);
  useEffect(() => {
    if (!myId) return;
    for (const m of members) {
      const peer = String(m.userId);
      if (peer === String(myId)) continue;
      const initiator = String(myId) < peer;
      const pc = makePeer(peer, initiator);
      const stream = streamRef.current;
      // Inisiatif baru boleh menambahkan track kalau mikrofon sudah siap
      // (menambah track memicu onnegotiationneeded → offer).
      if (initiator && stream && micReady && pc.getSenders().length === 0) {
        for (const t of stream.getTracks()) pc.addTrack(t, stream);
      }
    }
    // Putuskan peer yang sudah keluar room.
    const alive = new Set(members.map((m) => String(m.userId)));
    pcRef.current.forEach((_pc, peer) => {
      if (peer === String(myId) || alive.has(peer)) return;
      _pc.close();
      pcRef.current.delete(peer);
      const el = audioRef.current.get(peer);
      if (el) {
        el.pause();
        el.remove();
        audioRef.current.delete(peer);
      }
    });
  }, [members, myId, makePeer, micReady]);

  /* --- kontrol --- */
  const toggleMic = useCallback(() => {
    setMicOn((v) => {
      const next = !v;
      micRef.current = next;
      applyMic();
      void sendSignal({
        roomId,
        kind: "mic",
        payload: JSON.stringify({ on: next && !deafenRef.current }),
      }).catch(() => {});
      return next;
    });
  }, [applyMic, roomId, sendSignal]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((v) => {
      const next = !v;
      speakerRef.current = next;
      applySpeakers();
      return next;
    });
  }, [applySpeakers]);

  const toggleDeafen = useCallback(() => {
    setDeafen((v) => {
      const next = !v;
      deafenRef.current = next;
      applyMic();
      applySpeakers();
      void sendSignal({
        roomId,
        kind: "mic",
        payload: JSON.stringify({ on: micRef.current && !next }),
      }).catch(() => {});
      return next;
    });
  }, [applyMic, applySpeakers, roomId, sendSignal]);

  return {
    micOn,
    speakerOn,
    deafen,
    speaking,
    peerMic,
    peerSpeaking,
    error,
    toggleMic,
    toggleSpeaker,
    toggleDeafen,
  };
}

/* ====================================================================== *
 *  4) INVITE (khusus host)
 * ====================================================================== */

function InviteScreen({
  roomId,
  onBack,
  count,
  max,
  linkCode,
  hasOneTime,
}: {
  roomId: Id<"voiceRooms">;
  onBack: () => void;
  count: number;
  max: number;
  linkCode: string;
  hasOneTime: boolean;
}) {
  useHideNavOnMount();
  const genLink = useMutation(api.voice.genLink);
  const setMaxMut = useMutation(api.voice.setMaxUsers);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = `yorucall/join/${linkCode}`;
  const pct = Math.min(100, Math.round((count / Math.max(1, max)) * 100));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link disalin");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const regenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await genLink({ roomId, mode: "group" });
      toast.success("Link baru dibuat");
    } catch {
      toast.error("Gagal membuat link baru");
    } finally {
      setBusy(false);
    }
  };

  const changeMax = async (next: number) => {
    try {
      await setMaxMut({ roomId, maxUsers: Math.max(1, Math.min(10, next)) });
    } catch {
      toast.error("Gagal mengubah max user");
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[75] overflow-y-auto bg-background">
      {/* Latar premium: aurora emas + violet + bintik halus. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.2px)] [background-size:26px_26px] opacity-60" />
      </div>
      <div className="relative w-full p-3 pb-16">
        {/* KEPALA PREMIUM — medallion emas + judul di tengah. */}
        <div className="mb-4 flex flex-col items-center text-center">
          <button
            onClick={onBack}
            aria-label="Kembali"
            className="mb-1 self-start flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] transition hover:border-white/40 active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="relative flex size-14 items-center justify-center rounded-full border border-gold/45 bg-[linear-gradient(to_bottom,rgba(251,191,36,.22),rgba(251,191,36,.06))]">
            <UserPlus className="size-6 text-gold" />
          </span>
          <h1 className="mt-2.5 text-lg font-black tracking-tight">
            Invite Private Room
          </h1>
          <p className="mt-0.5 text-[11px] font-bold text-gold/75">
            Undang member · atur kuota · bagikan link
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-3 py-1 text-[10px] font-black text-emerald-200">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            {count} member di room
          </span>
        </div>

        <div className="space-y-3">
          {/* INVITE LINK — aksi utama, di paling atas. */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-[linear-gradient(160deg,#0f241d_0%,#0f131b_60%,#0b0e14_100%)] p-4">
            <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
            <p className="text-center text-sm font-black">Invite Link Mu!</p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-black/45 px-3 py-3">
                <Link2 className="size-3.5 shrink-0 text-emerald-300" />
                <span className="truncate font-mono text-xs text-white/85">
                  {link}
                </span>
              </div>
              <button
                onClick={() => void copy()}
                aria-label="Salin link"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400/12 transition hover:bg-emerald-400/20 active:scale-95"
              >
                {copied ? (
                  <span className="text-emerald-300 text-xs font-black">OK</span>
                ) : (
                  <Copy className="size-4 text-emerald-200" />
                )}
              </button>
            </div>
            <button
              onClick={() => void regenerate()}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-sm font-black text-black transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Membuat…" : "Generate Link Baru"}
            </button>
          </div>
          {/* Kotak 1 — INVITE USER + MAX USER */}
          <div className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-[linear-gradient(160deg,#101d2e_0%,#0f131b_60%,#0b0e14_100%)] p-4 backdrop-blur-xl">
            <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
            <div className="relative flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-400/10 text-sky-300">
                <Users className="size-4" />
              </span>
              <p className="flex-1 text-sm font-black">Invite User</p>
              <span className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black text-white/85">
                Max User
              </span>
            </div>
            <p className="relative mt-2.5 text-xs font-bold text-white/75">
              Max User : <span className="text-sky-300">{count}</span>/{max}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Kotak kecil untuk ubah total max. */}
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-black/40 px-1">
                <button
                  onClick={() => void changeMax(max - 1)}
                  aria-label="Kurangi"
                  className="flex size-6 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-4 text-center text-[11px] font-black tabular-nums">
                  {max}
                </span>
                <button
                  onClick={() => void changeMax(max + 1)}
                  aria-label="Tambah"
                  className="flex size-6 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
            <p className="relative mt-2 text-[10px] leading-snug text-white/55">
              Invite max {max} User, Pakai Link Untuk Invite User.
            </p>
          </div>

          {/* PERSONAL + TIP — dua kotak ringkas, berdampingan di layar lebar. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-400/25 bg-[#190e15] p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl border border-rose-400/45 bg-rose-400/12 text-rose-300">
                  <UserPlus className="size-4" />
                </span>
                <p className="flex-1 text-sm font-black">Personal Invite</p>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-black text-white/85">
                  One time
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-white/55">
                Valid untuk digunakan sekali. Link expired ketika sudah
                digunakan dan join.
              </p>
              <p className="mt-1.5 text-[10px] font-bold text-amber-300">
                {hasOneTime ? "Link personal aktif" : "Belum dibuat"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl border border-amber-400/45 bg-amber-400/12 text-amber-300">
                  <Sparkles className="size-4" />
                </span>
                <p className="text-sm font-black">Tip: Grup vs Personal</p>
              </div>
              <p className="mt-2 text-[11px] font-black text-amber-200">Grup Invite</p>
              <p className="text-[10px] leading-snug text-white/55">
                Reusable sampai max user — semua yang join ditambahkan ke room.
              </p>
              <p className="mt-1.5 text-[11px] font-black text-amber-200">Personal Invite</p>
              <p className="text-[10px] leading-snug text-white/55">
                Untuk 1 orang, link expired setelah dipakai.
              </p>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
