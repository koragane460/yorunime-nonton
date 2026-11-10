// AFINITAS — relasi dekat antar user (FULLSCREEN) dari detail akun.
//
// Lingkaran ala Mobile Legend: foto target di tengah, Pasangan di atas,
// Sahabat di kiri, Saudara di kanan, Orang Terpercaya di bawah — maksimal
// 3 per jenis dengan penempatan melengkung (bukan lurus), tersambung garis
// berwarna jenis. Tombol "+" di atas foto → sheet pilihan jenis (Lover,
// Saudara, Orang Terpercaya, Sahabat) → layar Ajak (cari teman). Ketuk
// baris relasi → sheet Bond (bar level + misi). Trophy kanan atas →
// leaderboard per jenis relasi. Ikon jenis BERSIH tanpa latar.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, LevelBadge } from "@/components/lstream-ui";
import { StripBackIcon } from "@/components/StripBack";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  HandHeart,
  Handshake,
  Heart,
  HeartHandshake,
  Search,
  Send,
  Trophy,
  X,
} from "lucide-react";

type Kind = "pasangan" | "saudara" | "sahabat" | "terpercaya";

/** Label waktu relatif ("baru saja", "3 jam lalu", "2 hari lalu"). */
function agoLabel(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

/** Meta jenis: label, warna Ikon (bersih, tanpa latar), ring lingkaran. */
const KIND_META: Record<
  Kind,
  { label: string; cls: string; hex: string; ring: string; Icon: typeof Heart }
> = {
  pasangan: {
    label: "Pasangan",
    cls: "text-pink-300",
    hex: "#f9a8d4",
    ring: "#f472b6",
    Icon: Heart,
  },
  saudara: {
    label: "Saudara",
    cls: "text-blue-400",
    hex: "#60a5fa",
    ring: "#60a5fa",
    Icon: Handshake,
  },
  sahabat: {
    label: "Sahabat",
    cls: "text-pink-500",
    hex: "#ec4899",
    ring: "#ec4899",
    Icon: HeartHandshake,
  },
  terpercaya: {
    label: "Orang Terpercaya",
    cls: "text-yellow-400",
    hex: "#facc15",
    ring: "#facc15",
    Icon: HandHeart,
  },
};

/** Ikon jenis — JSX tag tidak boleh pakai indexing, jadi dibungkus. */
function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = KIND_META[kind].Icon;
  return <Icon className={className} />;
}

/** Urutan tombol di sheet pilihan jenis (Lover di paling kiri). */
const SHEET_ORDER: Kind[] = ["pasangan", "saudara", "terpercaya", "sahabat"];
/** Urutan tab leaderboard. */
const LB_ORDER: Kind[] = ["pasangan", "saudara", "sahabat", "terpercaya"];
const ALL_KINDS: Kind[] = ["pasangan", "saudara", "sahabat", "terpercaya"];

/** Posisi slot per jenis (% dalam panggung) — simetris & rapi. */
const SLOT_POS: Record<Kind, { x: number; y: number }[]> = {
  // Pasangan cuma SATU slot, tepat di atas foto.
  pasangan: [{ x: 50, y: 10 }],
  sahabat: [
    { x: 20, y: 32 },
    { x: 13, y: 52 },
    { x: 20, y: 72 },
  ],
  saudara: [
    { x: 80, y: 32 },
    { x: 87, y: 52 },
    { x: 80, y: 72 },
  ],
  terpercaya: [
    { x: 26, y: 88 },
    { x: 50, y: 88 },
    { x: 74, y: 88 },
  ],
};
/** Titik tengah foto target dalam panggung (%). */
const CENTER = { x: 50, y: 52 };
/** Jari-jari bulatan avatar (px) — dipakai supaya garis BERHENTI di tepi
    bulatan, bukan menembus ke tengah foto. */
const R_FILLED = 33; // avatar size-14 + padding 2px + border 2.5px
const R_EMPTY = 29; // bulatan putus-putus size-14 + border
/** Posisi emblem ikon jenis di sekitar foto tengah (%). */
const EMBLEM_POS: Record<Kind, { x: number; y: number }> = {
  pasangan: { x: 50, y: 34 },
  sahabat: { x: 30, y: 52 },
  saudara: { x: 70, y: 52 },
  terpercaya: { x: 50, y: 74 },
};

type CircleMember = {
  userId: Id<"users">;
  username: string;
  image?: string;
  level?: number;
  premium?: boolean;
  linkId: Id<"affinity">;
  mine?: boolean;
  bond: {
    xp: number;
    level: number;
    into: number;
    need: number;
    missions: {
      chat: { done: boolean; progress: number; goal: number };
      give7: { done: boolean; progress: number; goal: number };
      give30: { done: boolean; progress: number; goal: number };
    };
  };
};

export function AfinitasScreen({
  targetUserId,
  onClose,
}: {
  targetUserId: Id<"users">;
  onClose: () => void;
}) {
  const target = useQuery(api.users.getUserPublic, { userId: targetUserId });
  const st = useQuery(api.affinity.state, { targetId: targetUserId });
  const friends = useQuery(api.affinity.inviteableFriends, {
    targetId: targetUserId,
  });
  const inviteM = useMutation(api.affinity.invite);
  const respondM = useMutation(api.affinity.respond);
  const breakM = useMutation(api.affinity.breakLink);
  /** SEMUA request masuk (dari siapa pun) — kotak "Permintaan Masuk". */
  const incoming = useQuery(api.affinity.incomingInvites, {});

  const [view, setView] = useState<"circle" | "lb">("circle");
  const [lbKind, setLbKind] = useState<Kind>("pasangan");
  const lb = useQuery(
    api.affinity.leaderboard,
    view === "lb" ? { kind: lbKind, limit: 50 } : "skip",
  );

  /** Sheet pilihan jenis ("Ajak"). */
  const [kindSheet, setKindSheet] = useState(false);
  const [pickKind, setPickKind] = useState<Kind>("pasangan");
  /** Layar penuh pemilih teman untuk diundang. */
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  /** Sheet Bond (dibuka dari baris relasi). */
  const [bondRow, setBondRow] = useState<{ kind: Kind; member: CircleMember } | null>(
    null,
  );
  /** Pop-up konfirmasi putus. */
  const [confirmBreak, setConfirmBreak] = useState<{
    linkId: Id<"affinity">;
    name: string;
  } | null>(null);
  /** Undangan masuk dari target — pop-up Terima/Tolak. */
  const [invHandled, setInvHandled] = useState(false);
  /** Pop-up request bisa dibuka lagi lewat buletan slot (mis. setelah
      ditutup) — jadi buletan pasangan = pintu ke daftar request. */
  const [invOpen, setInvOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  /** Ukuran panggung (px) — agar garis bisa dipotong tepat di tepi bulatan. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () =>
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Potong ujung garis (% panggung) supaya berhenti di tepi bulatan. */
  const trimToEdge = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    radius: number,
  ) => {
    const { w, h } = stageSize;
    if (!w || !h) return to;
    const dx = ((to.x - from.x) / 100) * w;
    const dy = ((to.y - from.y) / 100) * h;
    const len = Math.hypot(dx, dy);
    if (len <= radius) return to;
    return {
      x: to.x - ((dx / len) * radius * 100) / w,
      y: to.y - ((dy / len) * radius * 100) / h,
    };
  };

  const circles = (st?.circles ?? {
    pasangan: [],
    saudara: [],
    sahabat: [],
    terpercaya: [],
  }) as Record<Kind, CircleMember[]>;

  const targetName = target?.username ?? "user";
  const inv = st?.inviteFromTarget;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const filteredFriends = useMemo(() => {
    const list = friends ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (f: any) =>
        (f.username ?? "").toLowerCase().includes(s) ||
        String(f.userId).toLowerCase().includes(s),
    );
  }, [friends, q]);

  const doInvite = (toUserId: Id<"users">) =>
    void run(
      async () => {
        await inviteM({ toUserId, kind: pickKind });
      },
      `Undangan ${KIND_META[pickKind].label} terkirim`,
    );

  /** Terima / tolak request dari kotak Permintaan Masuk. */
  const respondTo = (inviteId: Id<"affinityInvites">, accept: boolean) =>
    void run(async () => {
      await respondM({ inviteId, accept });
      if (accept) {
        setInvHandled(true);
        toast.success("Permintaan diterima — bond kalian dimulai! 💞");
      } else {
        toast.success("Permintaan ditolak");
      }
    });

  /** Garis EKG (garis rumah sakit) + titik kecil melintas — aksen kotak top. */
  const ecg = (mirror = false) => {
    const d = "M0 8 H10 L13 3 L16 13 L19 8 H26 L29 4 L32 12 L35 8 H46";
    return (
      <svg
        viewBox="0 0 46 16"
        className={cn("h-4 w-10 text-rose-400", mirror && "-scale-x-100")}
        fill="none"
        aria-hidden
      >
        <path
          d={d}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.75"
        />
        <circle r="1.7" fill="currentColor">
          <animateMotion dur="2.2s" repeatCount="indefinite" path={d} />
        </circle>
      </svg>
    );
  };

  // Sheet daftar anggota per jenis relasi — dibuka dari 4 kotak bawah.

  if (st == null || target === undefined) {
    return (
      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background text-sm font-bold text-muted-foreground">
        Memuat Afinitas…
      </div>
    );
  }

  return (
    <div className="screen-enter fixed inset-0 z-[85] overflow-y-auto bg-background">
      {/* ================= LEADERBOARD (tombol trophy kanan atas) ========== */}
      {view === "lb" ? (
        <div className="min-h-full pb-10">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-background/95 px-3 py-2.5 backdrop-blur">
            <button
              onClick={() => setView("circle")}
              aria-label="Kembali"
              className="flex items-center py-1 pr-1 text-white transition active:opacity-60"
            >
              <StripBackIcon />
            </button>
            <p className="text-sm font-black">Leaderboard Bond</p>
          </div>
          {/* Tab jenis relasi — SEMUA kelihatan dalam satu pandangan */}
          <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5">
            {LB_ORDER.map((k) => {
              const m = KIND_META[k];
              return (
                <button
                  key={k}
                  onClick={() => setLbKind(k)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1 text-[8.5px] font-black leading-[1.15] transition",
                    lbKind === k
                      ? cn("border-current bg-white/10", m.cls)
                      : "border-white/12 text-zinc-400",
                  )}
                >
                  <m.Icon className="size-3" />
                  <span className="text-center">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* KOTAK TOP 1-3 — angka rank mewah, hati dikelilingi garis EKG
              kiri & kanan dengan titik yang melintas, jarak lebih lega. */}
          {(lb?.length ?? 0) > 0 && (
            <div className="space-y-3.5 px-3 pt-1">
              {lb!.slice(0, 3).map((r: any, i: number) => (
                <motion.div
                  key={`top-${r.linkId}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-2xl border py-2.5 pl-7 pr-2.5",
                    i === 0
                      ? "border-amber-300/55 bg-[linear-gradient(150deg,rgba(251,191,36,.16),rgba(16,19,26,.92))]"
                      : "border-white/12 bg-white/[0.05]",
                    r.isMine && KIND_META[lbKind].cls,
                  )}
                >
                  {/* Medali peringkat — DI LUAR kotak, menempel di tepi
                      kiri supaya isi kotak lega tapi angka tetap jelas. */}
                  <span
                    className={cn(
                      "absolute -left-1.5 top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-black tabular-nums ring-2 ring-[#0b0f19]",
                      i === 0
                        ? "bg-gradient-to-b from-amber-200 to-amber-500 text-black"
                        : i === 1
                          ? "bg-gradient-to-b from-zinc-200 to-zinc-400 text-black"
                          : "bg-gradient-to-b from-orange-400 to-amber-700 text-black",
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar
                    src={r.owner.image}
                    seed={r.owner.username}
                    className="size-10 shrink-0 ring-2 ring-white/30"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">
                      {r.owner.username}
                    </p>
                    <p className="truncate text-[10px] font-bold text-zinc-400">
                      {r.partner.username}
                    </p>
                  </div>
                  {/* Hati di tengah + garis EKG bergerak di kedua sisi */}
                  <div className="flex shrink-0 items-center gap-1">
                    {ecg()}
                    <KindIcon
                      kind={lbKind}
                      className={cn("size-4", KIND_META[lbKind].cls)}
                    />
                    <span className="text-[10px] font-black text-white/85">
                      {r.xp.toLocaleString("id-ID")}
                    </span>
                    {ecg(true)}
                  </div>
                  <Avatar
                    src={r.partner.image}
                    seed={r.partner.username}
                    className="size-10 shrink-0 ring-2 ring-white/20"
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div className="space-y-2 px-3 pt-3">
            {lb === undefined && (
              <div className="space-y-2 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl p-1.5">
                    <div className="skeleton h-3 w-5 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-2/5 rounded-full" />
                      <div className="skeleton h-2 w-1/4 rounded-full" />
                    </div>
                    <div className="skeleton size-9 rounded-full" />
                  </div>
                ))}
              </div>
            )}
            {lb?.length === 0 && (
              <p className="py-10 text-center text-xs text-zinc-500">
                Belum ada pasangan {KIND_META[lbKind].label.toLowerCase()} di
                leaderboard.
              </p>
            )}
            {lb?.slice(3).map((r: any, i: number) => (
              <div
                key={r.linkId}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/[0.05]",
                  r.isMine
                    ? "bg-white/[0.06]"
                    : "",
                  r.isMine && KIND_META[lbKind].cls,
                )}
              >
                {/* Kiri: foto + username pemilik */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-[12px] font-black text-zinc-500">
                    {i + 4}
                  </span>
                  <Avatar
                    src={r.owner.image}
                    seed={r.owner.username}
                    className="size-9 shrink-0"
                  />
                  <span className="min-w-0 truncate text-xs font-bold text-white">
                    {r.owner.username}
                  </span>
                </div>
                {/* Tengah: ikon jenis + XP di bawahnya */}
                <div className="flex shrink-0 flex-col items-center px-1">
                  <KindIcon
                    kind={lbKind}
                    className={cn("size-4", KIND_META[lbKind].cls)}
                  />
                  <span className="text-[9px] font-black text-zinc-400">
                    {r.xp.toLocaleString("id-ID")} xp
                  </span>
                </div>
                {/* Kanan: username + foto pasangan */}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="min-w-0 truncate text-right text-xs font-bold text-white/85">
                    {r.partner.username}
                  </span>
                  <Avatar
                    src={r.partner.image}
                    seed={r.partner.username}
                    className="size-9 shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ==================== LINGKARAN RELASI ========================== */
        <div className="min-h-full pb-10">
          {/* Kepala layar */}
          <div className="flex items-center gap-2 px-3 pt-3">
            <button
              onClick={onClose}
              aria-label="Kembali ke detail akun"
              className="flex items-center py-1 pr-1 text-white transition active:opacity-60"
            >
              <StripBackIcon />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-black">Afinitas</h1>
              <p className="truncate text-[10px] text-zinc-400">
                Relasi dekat {targetName}
              </p>
            </div>
            <button
              onClick={() => setView("lb")}
              aria-label="Leaderboard Afinitas"
              className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-amber-300 transition active:scale-95"
            >
              <Trophy className="size-4" />
            </button>
          </div>

          {/* ============ KOTAK PERMINTAAN MASUK (nerima request) ========= */}
          {st.isMe && (incoming?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="yn-panel mx-3 mt-3 overflow-hidden rounded-2xl"
            >
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.05] px-3.5 py-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-strong/15 text-gold ring-1 ring-gold-strong/45">
                  <HeartHandshake className="size-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 text-[12px] font-black text-white">
                  Permintaan Masuk
                </p>
                <span className="rounded-full bg-gold-strong/15 px-2 py-0.5 text-[10px] font-black text-gold ring-1 ring-gold-strong/45">
                  {incoming?.length ?? 0}
                </span>
              </div>

              <div className="divide-y divide-white/[0.07]">
                {(incoming ?? []).map((iv: any) => {
                  const meta =
                    KIND_META[iv.kind as Kind] ?? KIND_META.sahabat;
                  return (
                  <div
                    key={iv.inviteId}
                    className="flex items-center gap-2.5 px-3.5 py-2.5"
                  >
                    {/* Foto + emblem jenis */}
                    <div className="relative shrink-0">
                      <Avatar
                        src={iv.fromUser?.image}
                        seed={iv.fromUser?.username ?? "?"}
                        className="size-10"
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#120d1c] ring-1 ring-white/25"
                        aria-hidden
                      >
                        <meta.Icon
                          className={cn("size-2.5", meta.cls)}
                        />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-white">
                        {iv.fromUser?.username ?? "user"}
                      </p>
                      <p className="truncate text-[10px] text-white/55">
                        Mengajak jadi{" "}
                        <span
                          className={cn("font-bold", meta.cls)}
                        >
                          {meta.label}
                        </span>{" "}
                        · {agoLabel(iv.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => respondTo(iv.inviteId, false)}
                        aria-label="Tolak permintaan"
                        className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/60 transition hover:border-white/40 hover:text-white active:scale-95"
                      >
                        <X className="size-4" />
                      </button>
                      <button
                        onClick={() => respondTo(iv.inviteId, true)}
                        className="rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-600 px-3.5 py-1.5 text-[11px] font-black text-white shadow-[0_10px_24px_-12px_rgba(236,72,153,0.95)] transition hover:brightness-110 active:scale-95"
                      >
                        Terima
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* --------------------- PANGGUNG ----------------------------- */}
          {/* Geser ke bawah (mt-6) + tinggi ditambah, supaya seluruh isi
              lingkaran tidak menempel di kepala layar. */}
          <div
            ref={stageRef}
            className="relative mx-auto mt-6 h-[505px] w-full max-w-md px-2"
          >
            {/* Garis penghubung ICON jenis → tiap slot (SOLID, bukan
                putus-putus — permintaan user). Titik awalnya emblem ikon,
                bukan foto profile, dan ujungnya DIPOTONG di tepi bulatan. */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {ALL_KINDS.flatMap((kind) =>
                SLOT_POS[kind].map((p, i) => {
                  const filled = i < (circles[kind]?.length ?? 0);
                  const from = EMBLEM_POS[kind];
                  const end = trimToEdge(
                    from,
                    p,
                    filled ? R_FILLED : R_EMPTY,
                  );
                  return (
                    <line
                      key={`${kind}-${i}`}
                      x1={from.x}
                      y1={from.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="#ffffff"
                      strokeWidth={filled ? 1.6 : 1.2}
                      vectorEffect="non-scaling-stroke"
                      opacity={filled ? 0.9 : 0.45}
                    />
                  );
                }),
              )}
            </svg>

            {/* Emblem ikon jenis — garis lingkaran ada di pembungkusnya,
                bukan menempel di ikonnya. */}
            {ALL_KINDS.map((kind) => {
              const p = EMBLEM_POS[kind];
              const meta = KIND_META[kind];
              return (
                <span
                  key={kind}
                  aria-hidden
                  className="absolute z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-[#11131a]/90 shadow-[0_6px_18px_-10px_rgba(0,0,0,.95)] backdrop-blur"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    borderColor: `${meta.hex}66`,
                    color: meta.hex,
                  }}
                >
                  <meta.Icon className="size-[17px]" strokeWidth={2.15} />
                </span>
              );
            })}

            {/* Foto target + nama (TANPA bulatan "+" — dihapus sesuai
                permintaan user; ajakan lewat slot kosong di sekitarnya). */}
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {/* Bulatan besar di belakang foto: hanya garis tepi. */}
                  <span className="pointer-events-none absolute -inset-5 rounded-full border border-white/18" />
                  <span className="pointer-events-none absolute -inset-2.5 rounded-full border border-white/28" />
                  <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-pink-400/20 via-transparent to-blue-400/18 blur-md" />
                  <Avatar
                    src={target?.image}
                    seed={targetName}
                    className="relative size-[92px] rounded-full border-2 border-white/65 shadow-[0_16px_40px_-22px_rgba(0,0,0,.95)]"
                  />
                </div>
                <p className="max-w-[130px] truncate text-[11px] font-black text-white">
                  {targetName}
                </p>
              </div>
            </div>

            {/* Slot lingkaran — slot yang punya REQUEST dari target
                (mis. diajak jadi pasangan) tampil PERSIS seperti pasangan
                yang sudah terhubung: avatar + ring berwarna + nama. */}
            {ALL_KINDS.flatMap((kind) => {
              const meta = KIND_META[kind];
              return SLOT_POS[kind].map((p, i) => {
                const member = circles[kind]?.[i];
                // Request masuk dari target untuk jenis ini (slot masih kosong).
                const pending =
                  !member && inv && !invHandled && inv.kind === kind
                    ? ((inv as unknown as {
                        fromUser?: { username: string; image?: string };
                      }).fromUser ?? null)
                    : null;
                return (
                  <button
                    key={`${kind}-${i}`}
                    aria-label={
                      member
                        ? `Bond ${member.username}`
                        : pending
                          ? `Request ${meta.label} dari ${pending.username}`
                          : `Slot kosong — ajak ${meta.label}`
                    }
                    onClick={() => {
                      if (member) setBondRow({ kind, member });
                      else if (pending) {
                        // Buka pop-up request (Terima / Tolak).
                        setInvOpen(true);
                      } else {
                        setPickKind(kind);
                        setKindSheet(true);
                      }
                    }}
                    className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition active:scale-95"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    {member ? (
                      <span
                        className="rounded-full p-[2px]"
                        style={{
                          boxShadow: `0 0 14px -3px ${meta.ring}`,
                          border: `2.5px solid ${meta.ring}`,
                        }}
                      >
                        <Avatar
                          src={member.image}
                          seed={member.username}
                          className="size-14 rounded-full"
                        />
                      </span>
                    ) : pending ? (
                      /* Request — tampilan SAMA dengan pasangan aktif. */
                      <span
                        className="rounded-full p-[2px]"
                        style={{
                          boxShadow: `0 0 14px -3px ${meta.ring}`,
                          border: `2.5px solid ${meta.ring}`,
                        }}
                      >
                        <Avatar
                          src={pending.image}
                          seed={pending.username}
                          className="size-14 rounded-full"
                        />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "flex size-14 items-center justify-center rounded-full border border-dashed border-white/25 bg-white/[0.04]",
                          meta.cls,
                          "opacity-70",
                        )}
                      >
                        <meta.Icon className="size-5" />
                      </span>
                    )}
                    <span className="max-w-[76px] truncate text-[9px] font-bold text-zinc-300">
                      {member
                        ? member.username
                        : pending
                          ? pending.username
                          : meta.label}
                    </span>
                  </button>
                );
              });
            })}
          </div>

          {/* DAFTAR RELASI — urut dari Pasangan, Sahabat, Saudara, lalu
              Orang Terpercaya. Tiap bagian punya ikon berlingkaran, daftar
              anggota, dan tombol putus di ujung baris. */}
          <div className="mt-5 px-3">
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.025]">
              {ALL_KINDS.map((kind, sectionIndex) => {
                const meta = KIND_META[kind];
                const members = circles[kind] ?? [];
                const total = SLOT_POS[kind].length;
                return (
                  <section key={`relation-${kind}`}>
                    {sectionIndex > 0 && <div className="mx-3 h-px bg-white/[0.075]" />}
                    <div className="flex items-center gap-3 px-3 py-3">
                      <span
                        className="grid size-11 shrink-0 place-items-center rounded-full border bg-black/20"
                        style={{
                          borderColor: `${meta.hex}5c`,
                          color: meta.hex,
                        }}
                      >
                        <meta.Icon className="size-[19px]" strokeWidth={2.1} />
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <p className="truncate text-[12px] font-black text-white">{meta.label}</p>
                        <span
                          className="shrink-0 rounded-full border px-1.5 py-0.5 text-[8.5px] font-black tabular-nums"
                          style={{ borderColor: `${meta.hex}45`, color: meta.hex }}
                        >
                          {members.length}/{total}
                        </span>
                      </div>
                      {members.length < total && (
                        <button
                          type="button"
                          onClick={() => {
                            setPickKind(kind);
                            setKindSheet(true);
                          }}
                          className="shrink-0 rounded-full border border-white/12 bg-white/[0.055] px-2.5 py-1.5 text-[9px] font-black text-white/60 transition active:scale-95"
                        >
                          + Ajak
                        </button>
                      )}
                    </div>

                    <div className="px-3 pb-3">
                      {members.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-white/8 px-3 py-3 text-center text-[9.5px] font-medium text-white/25">
                          Belum ada {meta.label.toLowerCase()}.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {members.map((m) => (
                            <div
                              key={String(m.userId)}
                              className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2"
                            >
                              <button
                                type="button"
                                onClick={() => setBondRow({ kind, member: m })}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition active:scale-[0.995]"
                              >
                                <span
                                  className="rounded-full p-[2px]"
                                  style={{ border: `1.5px solid ${meta.hex}88` }}
                                >
                                  <Avatar
                                    src={m.image}
                                    seed={m.username}
                                    className="size-9 rounded-full"
                                  />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11.5px] font-black text-white">
                                    {m.username}
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold text-white/35">
                                    <span>Lv. {m.bond.level}</span>
                                    <span className="size-0.5 rounded-full bg-white/20" />
                                    <span>{m.bond.xp.toLocaleString("id-ID")} XP</span>
                                  </span>
                                </span>
                              </button>
                              {m.mine && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmBreak({
                                      linkId: m.linkId,
                                      name: m.username,
                                    })
                                  }
                                  className="shrink-0 rounded-full border border-rose-300/20 bg-rose-400/[0.07] px-2.5 py-1 text-[8.5px] font-black text-rose-200/80 transition hover:bg-rose-400/12 active:scale-95"
                                >
                                  Putus
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =============== POP-UP REQUEST / UNDANGAN MASUK (dari target) === */}
      {inv && !invHandled && invOpen && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/65 p-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-xs rounded-3xl border border-white/15 bg-[#10131a] p-4 text-center"
          >
            {/* Tutup — pop-up bisa dibuka lagi lewat buletan slot. */}
            <button
              onClick={() => setInvOpen(false)}
              aria-label="Tutup"
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-300 transition active:scale-90"
            >
              <X className="size-4" />
            </button>
            <Avatar
              src={target?.image}
              seed={targetName}
              className="mx-auto size-16 rounded-full ring-2 ring-white/30"
            />
            <p className="mt-2.5 text-sm font-black text-white">{targetName}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              Mengajak menjadi{" "}
              <span className={cn("font-black", KIND_META[inv.kind as Kind]?.cls)}>
                {KIND_META[inv.kind as Kind]?.label ?? inv.kind}
              </span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  void run(async () => {
                    await respondM({ inviteId: inv.inviteId, accept: false });
                    setInvHandled(true);
                  }, "Undangan ditolak")
                }
                disabled={busy}
                className="rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-xs font-black text-zinc-300 transition active:scale-[0.98] disabled:opacity-50"
              >
                Tolak
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await respondM({ inviteId: inv.inviteId, accept: true });
                    setInvHandled(true);
                  }, "Relasi terhubung ✨")
                }
                disabled={busy}
                className="rounded-xl bg-gradient-to-b from-pink-400 to-pink-600 py-2.5 text-xs font-black text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                Terima
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ================= SHEET PILIHAN JENIS ("Ajak") =================== */}
      <AnimatePresence>
        {kindSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] flex flex-col justify-end"
            onClick={() => setKindSheet(false)}
          >
            <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-6"
            >
              <span
                aria-hidden
                className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25"
              />
              <p className="text-center text-sm font-black text-white">
                Afinitas Bond
              </p>
              {/* HANYA jenis sesuai bulatan yang dipencet — tanpa pemilih 4 buletan */}
              <div className="mt-3 grid grid-cols-1 gap-2">
                {SHEET_ORDER.filter((k) => k === pickKind).map((k) => {
                  const meta = KIND_META[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setPickKind(k)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[9.5px] font-black transition active:scale-95",
                        pickKind === k
                          ? cn("border-current bg-white/10", meta.cls)
                          : "border-white/12 text-zinc-400",
                      )}
                    >
                      <meta.Icon className="size-5" />
                      <span className="leading-tight">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              {st.onCooldown && (
                <p className="mt-2.5 text-center text-[10px] font-bold text-amber-300">
                  Baru putus — tunggu beberapa hari lagi untuk mengajak lagi.
                </p>
              )}
              {/* Slot jenis sudah PENUH → tidak bisa ajak lagi. */}
              {(circles[pickKind]?.length ?? 0) >= SLOT_POS[pickKind].length && (
                <p className="mt-2.5 text-center text-[10px] font-bold text-rose-300">
                  Slot {KIND_META[pickKind].label} sudah penuh — tidak bisa
                  mengajak lagi.
                </p>
              )}
              <button
                onClick={() => {
                  setKindSheet(false);
                  setQ("");
                  setPicker(true);
                }}
                disabled={
                  busy ||
                  st.onCooldown ||
                  (circles[pickKind]?.length ?? 0) >= SLOT_POS[pickKind].length
                }
                className="mt-3 w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-600 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-45"
              >
                Ajak {KIND_META[pickKind].label}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============== LAYAR PENUH: pilih teman untuk diajak ============ */}
      {picker && (
        <div className="screen-enter fixed inset-0 z-[93] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <button
              onClick={() => setPicker(false)}
              aria-label="Kembali"
              className="flex items-center py-1 pr-1 text-white transition active:opacity-60"
            >
              <StripBackIcon />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Ajak Teman</p>
              <p className={cn("text-[10px] font-bold", KIND_META[pickKind].cls)}>
                {KIND_META[pickKind].label}
              </p>
            </div>
          </div>

          {/* Kolom cari teman (yang sudah berteman) */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-2">
              <Search className="size-4 shrink-0 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari teman…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* List teman */}
          <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-6">
            {filteredFriends.length === 0 && (
              <p className="py-10 text-center text-xs text-zinc-500">
                Tidak ada teman yang cocok.
              </p>
            )}
            {filteredFriends.map((f: any) => (
              <div
                key={String(f.userId)}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] p-2.5"
              >
                <Avatar src={f.image} seed={f.username} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {f.username}
                  </p>
                  <p className="mt-0.5 inline-flex">
                    <LevelBadge level={f.level ?? 1} className="scale-90" />
                  </p>
                </div>
                <button
                  onClick={() => void doInvite(f.userId)}
                  disabled={busy || !!f.invitedKind || f.linked}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition active:scale-95 disabled:opacity-55",
                    f.linked
                      ? "bg-white/10 text-zinc-400"
                      : f.invitedKind
                        ? "bg-white/10 text-emerald-300"
                        : "bg-gradient-to-b from-pink-400 to-pink-600 text-white",
                  )}
                >
                  {f.linked ? (
                    "Terhubung"
                  ) : f.invitedKind ? (
                    "Terkirim"
                  ) : (
                    <>
                      <Send className="size-3" /> Ajak
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== SHEET BOND ================================ */}
      <AnimatePresence>
        {bondRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[93] flex flex-col justify-end"
            onClick={() => setBondRow(null)}
          >
            <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-6"
            >
              <span
                aria-hidden
                className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25"
              />
              {/* Kepala: foto + username + jenis + TOMBOL PUTUSKAN
                  (kartu pasangan ada DI DALAM sheet ini, bukan di luar /
                  paling bawah — grid level & misi di bawahnya). */}
              <div className="flex items-center gap-3">
                <Avatar
                  src={bondRow.member.image}
                  seed={bondRow.member.username}
                  className="size-14 rounded-full ring-2 ring-white/25"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {bondRow.member.username}
                  </p>
                  <p
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-bold",
                      KIND_META[bondRow.kind].cls,
                    )}
                  >
                    <KindIcon kind={bondRow.kind} className="size-3.5" />
                    {KIND_META[bondRow.kind].label} · Lv.
                    {" "}{bondRow.member.bond.level}
                  </p>
                </div>
                {bondRow.member.mine && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmBreak({
                        linkId: bondRow.member.linkId,
                        name: bondRow.member.username,
                      })
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] font-black text-rose-200 transition active:scale-95"
                  >
                    <span className="relative flex size-3.5 items-center justify-center">
                      <Heart className="size-3.5 fill-current" />
                      <span className="absolute h-[1.5px] w-4 rotate-45 rounded bg-rose-200" />
                    </span>
                    Putuskan
                  </button>
                )}
              </div>

              {/* Bar level bond + level saat ini */}
              {(() => {
                const b = bondRow.member.bond;
                const pct = Math.round((b.into / Math.max(1, b.need)) * 100);
                return (
                  <div className="mt-3.5">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-black text-white">
                        Level Bond {b.level}
                      </span>
                      <span className="text-zinc-400">
                        {b.into}/{b.need} xp
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/20">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Misi naik level bond */}
              <p className="mt-3.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Misi Bond
              </p>
              <div className="mt-1.5 space-y-1.5">
                {(
                  [
                    ["chat", "Chat 5× per hari"],
                    ["give7", "Give Premium 7 hari"],
                    ["give30", "Give Premium 30 hari"],
                  ] as const
                ).map(([key, label]) => {
                  const m = bondRow.member.bond.missions[key];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                        m.done
                          ? "border-emerald-400/40 bg-emerald-400/[0.08]"
                          : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                          m.done
                            ? "bg-emerald-400 text-black"
                            : "bg-white/10 text-zinc-400",
                        )}
                      >
                        {m.done ? "✓" : "•"}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[12px] font-bold",
                          m.done ? "text-emerald-200" : "text-zinc-200",
                        )}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black",
                          m.done
                            ? "bg-emerald-400/25 text-emerald-200"
                            : "bg-white/10 text-zinc-400",
                        )}
                      >
                        {m.progress}/{m.goal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================ POP-UP KONFIRMASI PUTUS ======================== */}
      {confirmBreak && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/55 p-5 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-[19rem] rounded-2xl border border-white/10 bg-[#12141a] p-4 shadow-2xl"
          >
            <p className="text-[13px] font-black text-white">Putuskan relasi?</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
              <span className="font-bold text-white/80">{confirmBreak.name}</span>{" "}
              akan dilepas dari Afinitas. Bisa mengajak lagi setelah 7 hari.
            </p>
            <div className="mt-3.5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmBreak(null)}
                className="rounded-full px-3.5 py-2 text-[11px] font-bold text-white/45 transition hover:bg-white/[0.05] hover:text-white/75"
              >
                Batal
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await breakM({ linkId: confirmBreak.linkId });
                    setConfirmBreak(null);
                    setBondRow(null);
                  }, "Relasi diputus")
                }
                disabled={busy}
                className="rounded-full bg-rose-500 px-3.5 py-2 text-[11px] font-black text-white transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                Putuskan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
