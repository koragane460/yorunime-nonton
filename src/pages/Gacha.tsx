// YoruNime — MESIN VENDING YoruVerse (pengganti gacha kartu anime).
//
// Tampilan: mesin vending model 3D (CSS perspective) yang di dalamnya
// kelihatan produk. Alur pull:
//   1. koin jatuh ke slot,
//   2. produk jatuh dari rak ke kotak pengambilan,
//   3. pintu kotak buka, produk muncul di tengah layar,
//   4. produk dibuka → kartu tiket emas digosok → hadiah terbuka.
// Hadiah: XP 100–10.000 · Telur pet 1–10 · Sacret 500–3.000 ·
// Premium 1–360 hari (paling langka).
// Harga: 1× GRATIS untuk yang belum pernah pull, lalu 169 Sacret;
// 10× 1600 Sacret.
// Logika angka ada di src/convex/gacha.ts + src/lib/vending.ts — halaman
// ini hanya tampilan + animasi.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { StripBackIcon } from "@/components/StripBack";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { SacretIcon } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import {
  REWARD_META,
  VENDING_X1,
  VENDING_X10,
  rewardAmountLabel,
  type RewardKind,
  type VendingReward,
} from "@/lib/vending";

type Reward = { kind: RewardKind; amount: number; tier: string };

const TIER_STYLE: Record<
  string,
  { text: string; chip: string; ring: string; card: string }
> = {
  common: {
    text: "text-zinc-200",
    chip: "bg-white/10 text-zinc-200",
    ring: "ring-white/20",
    card: "from-zinc-500 via-zinc-400 to-zinc-300",
  },
  rare: {
    text: "text-sky-200",
    chip: "bg-sky-500/20 text-sky-200",
    ring: "ring-sky-400/50",
    card: "from-sky-500 via-sky-400 to-cyan-300",
  },
  epic: {
    text: "text-violet-200",
    chip: "bg-violet-500/20 text-violet-200",
    ring: "ring-violet-400/50",
    card: "from-violet-500 via-fuchsia-400 to-fuchsia-300",
  },
  legendary: {
    text: "text-amber-200",
    chip: "bg-amber-500/20 text-amber-200",
    ring: "ring-amber-400/70",
    card: "from-amber-400 via-yellow-300 to-amber-500",
  },
};

/** Produk di dalam etalase — ikon hadiah yang lagi dijual mesin. */
const SHELF_ITEMS: RewardKind[][] = [
  ["xp", "egg", "sacret", "premium"],
  ["egg", "sacret", "xp", "egg"],
  ["sacret", "premium", "egg", "xp"],
];

type Phase =
  | "idle"
  | "coin"
  | "drop"
  | "hatch"
  | "package"
  | "scratch"
  | "done";

export function GachaScreen({ onBack }: { onBack: () => void }) {
  const state = useQuery(api.gacha.myState, {});
  const pullM = useMutation(api.gacha.pull);

  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Reward[]>([]);
  const [revealed, setRevealed] = useState<Reward[]>([]);
  const [current, setCurrent] = useState<Reward | null>(null);
  const [fallKind, setFallKind] = useState<RewardKind>("sacret");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const free = !!state?.freeAvailable;
  const cost1 = free ? 0 : VENDING_X1;
  const canPull1 = !!state && (state.unlimitedSacret || state.sacret >= cost1);
  const canPull10 =
    !!state && (state.unlimitedSacret || state.sacret >= VENDING_X10);

  const runPull = async (count: 1 | 10) => {
    if (busy || phase !== "idle") return;
    const cost = count === 1 ? cost1 : VENDING_X10;
    if (!state?.unlimitedSacret && state && state.sacret < cost) {
      toast.error(`Sacret tidak cukup — butuh ${cost}`);
      return;
    }
    setBusy(true);
    try {
      const res = await pullM({ count });
      const rewards = (res.rewards ?? []) as Reward[];
      setFallKind(rewards[0]?.kind ?? "xp");

      // 1) koin masuk → 2) produk jatuh → 3) pintu buka → 4) paket muncul
      setPhase("coin");
      later(() => setPhase("drop"), 750);
      later(() => setPhase("hatch"), 1750);
      later(() => {
        setPending(rewards);
        setRevealed([]);
        setCurrent(rewards[0] ?? null);
        setPhase("package");
        setBusy(false);
      }, 2500);
    } catch (e) {
      setBusy(false);
      toast.error(
        e instanceof Error
          ? e.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
          : "Gagal pull",
      );
    }
  };

  const nextFromPackage = () => setPhase("scratch");

  const onScratched = (r: Reward) => {
    setRevealed((prev) => [...prev, r]);
    const rest = pending.slice(1);
    setPending(rest);
    if (rest.length === 0) {
      setPhase("done");
      setCurrent(null);
      return;
    }
    // Masih ada tiket: balik dulu ke mesin (seolah produk berikutnya
    // sedang turun), lalu tampilkan kemasan berikutnya.
    setCurrent(null);
    setPhase("idle");
    setBusy(true);
    later(() => {
      setCurrent(rest[0]);
      setPhase("package");
      setBusy(false);
    }, 700);
  };

  const reset = () => {
    setPhase("idle");
    setPending([]);
    setRevealed([]);
    setCurrent(null);
  };

  return (
    <div className="thin-scroll flex min-h-full flex-col overflow-y-auto pb-8">
      {/* ---------------- header ---------------- */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-background/90 px-3 py-3 backdrop-blur">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight">
            Mesin Vending
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Tarik hadiah — XP, telur pet, Sacret, sampai premium
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] font-bold">
          <SacretIcon className="size-4" />
          {(state?.sacret ?? 0).toLocaleString("id-ID")}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* ---------------- daftar hadiah ---------------- */}
        <section className="rounded-2xl border border-white/10 bg-card p-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" />
            <h2 className="text-[13px] font-bold">Hadiah di mesin ini</h2>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {(Object.keys(REWARD_META) as RewardKind[]).map((k) => {
              const m = REWARD_META[k];
              const tier =
                TIER_STYLE[
                  k === "premium"
                    ? "legendary"
                    : k === "sacret"
                      ? "epic"
                      : k === "egg"
                        ? "rare"
                        : "common"
                ];
              return (
                <div
                  key={k}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] font-bold", tier.text)}>
                      {m.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {m.desc}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-1 text-[11px] font-black",
                      tier.chip,
                    )}
                  >
                    {m.range}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Pull 1×{" "}
            <span className="font-bold text-foreground">
              {free ? "GRATIS" : `${VENDING_X1} Sacret`}
            </span>{" "}
            {free && "(khusus yang belum pernah pull)"} · Pull 10×{" "}
            <span className="font-bold text-foreground">
              {VENDING_X10.toLocaleString("id-ID")} Sacret
            </span>
          </p>
        </section>

        {/* ---------------- mesin 3D ---------------- */}
        <div className="mt-5 flex justify-center [perspective:1400px]">
          <motion.div
            animate={{ rotateY: -16, y: phase === "hatch" ? [0, -4, 0] : 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-[300px] origin-center [transform-style:preserve-3d]"
          >
            {/* sisi kiri mesin (kedalaman 3D) */}
            <div className="absolute inset-y-2 left-0 w-10 origin-left rounded-l-2xl bg-gradient-to-r from-zinc-950 to-zinc-800 [transform:translateX(-40px)_rotateY(-90deg)]" />
            {/* atap mesin */}
            <div className="absolute inset-x-3 top-0 h-4 rounded-t-xl bg-gradient-to-b from-zinc-600 to-zinc-800" />

            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 shadow-[0_24px_50px_-20px_rgba(0,0,0,.85)]">
              {/* papan nama */}
              <div className="flex items-center justify-center gap-1.5 border-b border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 py-2">
                <span className="text-[12px] font-black tracking-[0.2em] text-amber-200">
                  YORU VENDING
                </span>
              </div>

              <div className="flex gap-2 p-3">
                {/* etalase kaca */}
                <div className="relative flex-1 overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b from-[#0d1117] to-[#0a0f16] shadow-inner">
                  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
                  <div className="relative space-y-2 p-2.5">
                    {SHELF_ITEMS.map((row, ri) => (
                      <div
                        key={ri}
                        className="grid grid-cols-4 gap-1.5 rounded-md bg-white/[0.04] px-1.5 py-2 shadow-[inset_0_-2px_0_rgba(255,255,255,.08)]"
                      >
                        {row.map((k, ci) => (
                          <div
                            key={`${ri}-${ci}`}
                            className={cn(
                              "flex aspect-square items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] text-lg transition",
                              phase === "drop" &&
                                ri === 0 &&
                                ci === 1 &&
                                "opacity-25",
                            )}
                          >
                            {REWARD_META[k].emoji}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* produk yang jatuh */}
                  <AnimatePresence>
                    {(phase === "drop" || phase === "hatch") && (
                      <motion.div
                        key="fall"
                        initial={{ y: 8, opacity: 0, scale: 0.7 }}
                        animate={
                          phase === "drop"
                            ? {
                                y: [8, 60, 110, 168],
                                opacity: 1,
                                scale: [0.7, 1.1, 1, 1.05],
                              }
                            : { y: 168, opacity: 1, scale: 1 }
                        }
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.9, ease: "easeIn" }}
                        className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-3xl drop-shadow-[0_4px_6px_rgba(0,0,0,.6)]"
                      >
                        {REWARD_META[fallKind].emoji}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* pantulan kaca */}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.14)_0%,transparent_35%,transparent_65%,rgba(255,255,255,.07)_100%)]" />
                </div>

                {/* panel kanan: slot koin + tombol */}
                <div className="w-16 shrink-0 rounded-xl border border-white/10 bg-zinc-900/80 p-2">
                  <div className="mx-auto mt-1 h-1.5 w-8 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,.25)]" />
                  <div className="mx-auto mt-1 h-1.5 w-8 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,.25)]" />
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span
                        key={i}
                        className="aspect-square rounded-[3px] bg-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,.15)]"
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex h-6 items-center justify-center rounded-md bg-black/70 text-[9px] font-bold text-emerald-300/80">
                    {busy ? "BUSY" : "READY"}
                  </div>

                  {/* animasi koin */}
                  <AnimatePresence>
                    {phase === "coin" && (
                      <motion.div
                        key="coin"
                        initial={{ y: 46, opacity: 0, rotate: 0 }}
                        animate={{ y: 0, opacity: 1, rotate: 360 }}
                        exit={{ y: -10, opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.65, ease: "easeIn" }}
                        className="mx-auto mt-2 flex size-6 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-amber-200 to-amber-500 text-[8px] font-black text-amber-900"
                      >
                        ¥
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* kotak pengambilan + pintu */}
              <div className="relative px-3 pb-3">
                <div className="relative h-14 overflow-hidden rounded-xl border border-white/15 bg-black/80">
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-widest text-zinc-600">
                    AMBIL HADIAHMU
                  </div>
                  <AnimatePresence>
                    {(phase === "hatch" || phase === "package") && (
                      <motion.div
                        key="prod"
                        initial={{ y: -40, opacity: 0 }}
                        animate={{ y: 2, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ duration: 0.55 }}
                        className="absolute inset-0 flex items-center justify-center text-3xl"
                      >
                        {REWARD_META[fallKind].emoji}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* pintu melipat */}
                  <motion.div
                    animate={{
                      rotateX:
                        phase === "hatch" || phase === "package" ? -78 : 0,
                    }}
                    transition={{ duration: 0.45 }}
                    className="absolute inset-x-0 top-0 h-full origin-top rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 [transform-style:preserve-3d]"
                  >
                    <div className="mx-auto mt-5 h-1 w-10 rounded-full bg-zinc-500" />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ---------------- tombol pull ---------------- */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            disabled={busy || phase !== "idle" || !canPull1}
            onClick={() => void runPull(1)}
            className="rounded-2xl border border-white/15 bg-gradient-to-b from-zinc-700 to-zinc-900 px-3 py-3 text-left transition active:scale-[0.98] disabled:opacity-45"
          >
            <span className="block text-[13px] font-black">
              Pull 1× {free ? "GRATIS" : ""}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-zinc-300">
              {free ? (
                <>
                  <Sparkles className="size-3.5 text-amber-300" /> hadiah
                  pertamamu
                </>
              ) : (
                <>
                  <SacretIcon className="size-3.5" /> {cost1}
                </>
              )}
            </span>
          </button>
          <button
            disabled={busy || phase !== "idle" || !canPull10}
            onClick={() => void runPull(10)}
            className="rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-500 to-amber-700 px-3 py-3 text-left text-black transition active:scale-[0.98] disabled:opacity-45"
          >
            <span className="block text-[13px] font-black">Pull 10×</span>
            <span className="mt-0.5 flex items-center gap-1 text-[12px] font-black">
              <SacretIcon className="size-3.5" />{" "}
              {VENDING_X10.toLocaleString("id-ID")}
            </span>
          </button>
        </div>
        {busy && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Mesin sedang
            bekerja…
          </p>
        )}

        {/* ---------------- riwayat singkat ---------------- */}
        {!!state?.history?.length && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-card p-3.5">
            <h2 className="text-[13px] font-bold">Tarikan terakhir</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.history.slice(0, 12).map((h, i) => {
                const meta = REWARD_META[h.id as RewardKind];
                if (!meta) return null;
                const tier = TIER_STYLE[h.rank] ?? TIER_STYLE.common;
                return (
                  <span
                    key={`${h.at}-${i}`}
                    className={cn(
                      "rounded-full px-2 py-1 text-[11px] font-bold",
                      tier.chip,
                    )}
                  >
                    {meta.emoji} {meta.name}
                  </span>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ---------------- overlay hadiah ---------------- */}
      <AnimatePresence>
        {phase === "package" && current && (
          <motion.div
            key="package"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 px-6"
          >
            <motion.div
              initial={{ scale: 0.4, y: 80, rotate: -8 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 16 }}
              className="flex flex-col items-center"
            >
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-3xl bg-amber-400/30 blur-2xl" />
                <div className="flex size-28 items-center justify-center rounded-3xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-5xl shadow-[0_18px_40px_-12px_rgba(251,191,36,.7)]">
                  {REWARD_META[current.kind].emoji}
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-zinc-300">
                Kamu mendapat {revealed.length + pending.length} hadiah
              </p>
              <p className="mt-1 text-[12px] text-zinc-500">
                Tiket emas menunggu digosok
              </p>
              <button
                onClick={nextFromPackage}
                className="mt-5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-7 py-3 text-sm font-black text-black transition active:scale-95"
              >
                Buka kemasan ✨
              </button>
            </motion.div>
          </motion.div>
        )}

        {phase === "scratch" && current && (
          <motion.div
            key="scratch"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 px-6"
          >
            <p className="mb-3 text-[12px] tracking-widest text-amber-200/80">
              GOSOK KARTU UNTUK MEMBUKA
            </p>
            <ScratchTicket reward={current} onDone={() => onScratched(current)} />
          </motion.div>
        )}

        {phase === "done" && revealed.length > 0 && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 px-6"
          >
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-800 to-zinc-950 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-300" />
                <h2 className="text-sm font-black">Hadiah kamu</h2>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">
                  {revealed.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {revealed.map((r, i) => {
                  const meta = REWARD_META[r.kind];
                  const tier = TIER_STYLE[r.tier] ?? TIER_STYLE.common;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 ring-1",
                        tier.ring,
                      )}
                    >
                      <span className="text-2xl">{meta.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[13px] font-black", tier.text)}>
                          {meta.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {meta.desc}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-xl bg-gradient-to-br px-2.5 py-1.5 text-[13px] font-black text-black",
                          tier.card,
                        )}
                      >
                        {rewardAmountLabel(r as VendingReward)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              <button
                onClick={reset}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-amber-500 py-3 text-sm font-black text-black transition active:scale-[0.98]"
              >
                Ambil lagi
              </button>
              <button
                onClick={() => {
                  reset();
                  onBack();
                }}
                className="mt-2 w-full rounded-2xl border border-white/15 py-2.5 text-[13px] font-semibold text-muted-foreground transition active:scale-[0.98]"
              >
                Selesai
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Kartu tiket emas yang digosok pakai jari/mouse. */
function ScratchTicket({
  reward,
  onDone,
}: {
  reward: Reward;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const strokes = useRef(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const W = 300;
    const H = 190;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // lapisan gosok: foil emas + tulisan
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f6d365");
    g.addColorStop(0.45, "#e2b93b");
    g.addColorStop(0.6, "#f9e79f");
    g.addColorStop(1, "#c9971f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.font = "900 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOSOK DI SINI", W / 2, H / 2 - 10);
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText("TIKET EMAS", W / 2, H / 2 + 22);

    const scratchAt = (x: number, y: number) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    };

    const checkCleared = () => {
      try {
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let clear = 0;
        let total = 0;
        for (let i = 3; i < data.length; i += 4 * 40) {
          total++;
          if (data[i] < 40) clear++;
        }
        if (total > 0 && clear / total > 0.42 && !doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      } catch {
        /* getImageData bisa gagal di lingkungan tertentu — abaikan */
      }
    };

    let down = false;
    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      const p = pos(e);
      scratchAt(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const p = pos(e);
      scratchAt(p.x, p.y);
      strokes.current++;
      if (strokes.current % 6 === 0) checkCleared();
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      checkCleared();
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onUp);
    return () => {
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward]);

  const meta = REWARD_META[reward.kind];
  const tier = TIER_STYLE[reward.tier] ?? TIER_STYLE.common;

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 rounded-3xl bg-amber-400/20 blur-2xl" />
      {/* isi di balik foil */}
      <div
        className={cn(
          "flex h-[190px] w-[300px] flex-col items-center justify-center rounded-3xl border-2 bg-gradient-to-br",
          tier.ring,
          tier.card,
        )}
      >
        <span className="text-5xl drop-shadow-[0_4px_6px_rgba(0,0,0,.35)]">
          {meta.emoji}
        </span>
        <p className="mt-2 text-xl font-black text-black">
          {rewardAmountLabel(reward as VendingReward)}
        </p>
        <p className="text-[12px] font-bold text-black/70">{meta.name}</p>
      </div>
      {/* foil di atasnya */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-pointer touch-none rounded-3xl"
      />
    </div>
  );
}

/** Rute /gacha — layar Mesin Vending penuh. Versi yang sama juga
 *  di-embed di YoruVerse › Shop (lihat GachaScreen). */
export default function Gacha() {
  const navigate = useNavigate();
  return (
    <AppLayout hideAccountPanel>
      <GachaScreen onBack={() => navigate("/home")} />
    </AppLayout>
  );
}
