// AFINITAS — relasi dekat antar user (FULLSCREEN) dari detail akun.
//
// Lingkaran ala Mobile Legend: foto target di tengah, Pasangan di atas,
// Sahabat di kiri, Saudara di kanan, Orang Terpercaya di bawah — maksimal
// 3 per jenis dengan penempatan melengkung (bukan lurus), tersambung garis
// berwarna jenis. Tombol "+" di atas foto → sheet pilihan jenis (Lover,
// Saudara, Orang Terpercaya, Sahabat) → layar Ajak (cari teman). Ketuk
// baris relasi → sheet Bond (bar level + misi). Trophy kanan atas →
// leaderboard per jenis relasi. Ikon jenis BERSIH tanpa latar.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/lstream-ui";
import { StripBackIcon } from "@/components/StripBack";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  HandHeart,
  Handshake,
  Heart,
  HeartHandshake,
  Plus,
  Search,
  Send,
  Trophy,
} from "lucide-react";

type Kind = "pasangan" | "saudara" | "sahabat" | "terpercaya";

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
  const [busy, setBusy] = useState(false);

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

  /** Semua baris relasi target (dibawah panggung) — ketuk = sheet Bond. */
  const rows = useMemo(
    () =>
      ALL_KINDS.flatMap((kind) =>
        (circles[kind] ?? []).map((m) => ({ kind, member: m })),
      ),
    [circles],
  );

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
          {/* Tab jenis relasi */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
            {LB_ORDER.map((k) => {
              const m = KIND_META[k];
              return (
                <button
                  key={k}
                  onClick={() => setLbKind(k)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition",
                    lbKind === k
                      ? cn("border-current bg-white/10", m.cls)
                      : "border-white/15 text-zinc-400",
                  )}
                >
                  <m.Icon className="size-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 px-3">
            {lb === undefined && (
              <p className="py-10 text-center text-xs text-zinc-500">Memuat…</p>
            )}
            {lb?.length === 0 && (
              <p className="py-10 text-center text-xs text-zinc-500">
                Belum ada pasangan {KIND_META[lbKind].label.toLowerCase()} di
                leaderboard.
              </p>
            )}
            {lb?.map((r: any, i: number) => (
              <div
                key={r.linkId}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border p-2.5",
                  r.isMine
                    ? "border-current bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.04]",
                  r.isMine && KIND_META[lbKind].cls,
                )}
              >
                {/* Kiri: foto + username pemilik */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-[12px] font-black text-zinc-500">
                    {i + 1}
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

          {/* --------------------- PANGGUNG ----------------------------- */}
          <div className="relative mx-auto mt-1 h-[470px] w-full max-w-md px-2">
            {/* Garis penghubung tengah → tiap slot */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {ALL_KINDS.flatMap((kind) =>
                SLOT_POS[kind].map((p, i) => {
                  const filled = i < (circles[kind]?.length ?? 0);
                  return (
                    <line
                      key={`${kind}-${i}`}
                      x1={CENTER.x}
                      y1={CENTER.y}
                      x2={p.x}
                      y2={p.y}
                      stroke="#ffffff"
                      strokeWidth={filled ? 1.6 : 1.2}
                      strokeDasharray={filled ? undefined : "4 5"}
                      vectorEffect="non-scaling-stroke"
                      opacity={filled ? 0.9 : 0.45}
                    />
                  );
                }),
              )}
            </svg>

            {/* Emblem ikon jenis di sekitar foto (BERSIH, tanpa latar) */}
            {ALL_KINDS.map((kind) => {
              const p = EMBLEM_POS[kind];
              const Icon = KIND_META[kind].Icon;
              return (
                <span
                  key={kind}
                  aria-hidden
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2",
                    KIND_META[kind].cls,
                  )}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  <Icon className="size-5 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]" />
                </span>
              );
            })}

            {/* Foto target + tombol "+" di atasnya */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
            >
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => {
                    setPickKind("pasangan");
                    setKindSheet(true);
                  }}
                  aria-label="Ajak relasi"
                  className="flex size-8 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur-sm transition active:scale-90"
                >
                  <Plus className="size-4" />
                </button>
                <div className="relative">
                  <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-pink-400/40 to-blue-400/40 blur-md" />
                  <Avatar
                    src={target?.image}
                    seed={targetName}
                    className="relative size-[88px] rounded-full ring-2 ring-white/60"
                  />
                </div>
                <p className="max-w-[130px] truncate text-[11px] font-black text-white">
                  {targetName}
                </p>
              </div>
            </div>

            {/* Slot lingkaran */}
            {ALL_KINDS.flatMap((kind) => {
              const meta = KIND_META[kind];
              return SLOT_POS[kind].map((p, i) => {
                const member = circles[kind]?.[i];
                return (
                  <button
                    key={`${kind}-${i}`}
                    aria-label={
                      member
                        ? `Bond ${member.username}`
                        : `Slot kosong — ajak ${meta.label}`
                    }
                    onClick={() => {
                      if (member) setBondRow({ kind, member });
                      else {
                        setPickKind(kind);
                        setKindSheet(true);
                      }
                    }}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition active:scale-95"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    {member ? (
                      <span
                        className="rounded-full p-[2px]"
                        style={{
                          boxShadow: `0 0 12px -3px ${meta.ring}`,
                          border: `2px solid ${meta.ring}`,
                        }}
                      >
                        <Avatar
                          src={member.image}
                          seed={member.username}
                          className="size-10 rounded-full"
                        />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full border border-dashed border-white/25 bg-white/[0.04]",
                          meta.cls,
                          "opacity-70",
                        )}
                      >
                        <meta.Icon className="size-4" />
                      </span>
                    )}
                    <span className="max-w-[64px] truncate text-[8.5px] font-bold text-zinc-300">
                      {member ? member.username : meta.label}
                    </span>
                  </button>
                );
              });
            })}
          </div>

          {/* ----------------- DAFTAR RELASI (grid ke bawah) -------------- */}
          {rows.length > 0 && (
            <div className="mx-auto mt-2 w-full max-w-md space-y-2 px-3">
              {rows.map(({ kind, member }) => {
                const meta = KIND_META[kind];
                return (
                  <div
                    key={String(member.linkId)}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setBondRow({ kind, member })}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <Avatar
                        src={member.image}
                        seed={member.username}
                        className="size-9 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-white">
                          {member.username}
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-bold",
                            meta.cls,
                          )}
                        >
                          <meta.Icon className="size-3" /> {meta.label} · Lv.
                          {" "}{member.bond.level}
                        </span>
                      </span>
                    </button>
                    {member.mine && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmBreak({
                            linkId: member.linkId,
                            name: member.username,
                          })
                        }
                        className="flex shrink-0 items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-black text-rose-200 transition active:scale-95"
                      >
                        {/* Hati + garis miring */}
                        <span className="relative flex size-3.5 items-center justify-center">
                          <Heart className="size-3.5 fill-current" />
                          <span className="absolute h-[1.5px] w-4 rotate-45 rounded bg-rose-200" />
                        </span>
                        Putuskan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =============== POP-UP UNDANGAN MASUK (dari target) ============== */}
      {inv && !invHandled && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/65 p-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-xs rounded-3xl border border-white/15 bg-[#10131a] p-4 text-center"
          >
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
                Ajak jadi…
              </p>
              {/* 4 jenis — Lover di kiri atas */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {SHEET_ORDER.map((k) => {
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
              <button
                onClick={() => {
                  setKindSheet(false);
                  setQ("");
                  setPicker(true);
                }}
                disabled={busy}
                className="mt-3 w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-600 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-50"
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
                  <p className="text-[10px] text-zinc-500">Lv.{f.level ?? 1}</p>
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
              {/* Kepala: foto + username */}
              <div className="flex items-center gap-3">
                <Avatar
                  src={bondRow.member.image}
                  seed={bondRow.member.username}
                  className="size-14 rounded-full ring-2 ring-white/25"
                />
                <div className="min-w-0">
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
                    {KIND_META[bondRow.kind].label}
                  </p>
                </div>
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
        <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/65 p-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xs rounded-3xl border border-white/15 bg-[#10131a] p-4 text-center"
          >
            <p className="text-sm font-black text-white">Putuskan relasi?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Hubungan dengan{" "}
              <span className="font-bold text-white">{confirmBreak.name}</span>{" "}
              akan diputus. Kamu harus menunggu 7 hari untuk mengajaknya lagi.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmBreak(null)}
                className="rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-xs font-black text-zinc-300 transition active:scale-[0.98]"
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
                className="rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 py-2.5 text-xs font-black text-white transition active:scale-[0.98] disabled:opacity-50"
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
