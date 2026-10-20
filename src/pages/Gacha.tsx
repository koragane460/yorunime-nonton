// YoruNime — HALAMAN GACHA.
//
// Tarik karakter anime pakai Sacret: 1 pull = 160, 10 pull = 1600.
// Pity 75 menjamin SSS dan SETELAH dapat SSS pity balik ke 0 (guaranteed).
// Alur animasi: menekan Pull → komet meluncur dari bawah ke atas → hasil
// reveal satu per satu dengan kartu besar lalu mengecil. Logika angka ada di
// src/convex/gacha.ts — halaman ini hanya tampilan + animasi.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  History as HistoryIcon,
  Loader2,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { SacretIcon } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import { useRosterImages } from "@/hooks/use-roster-images";
import { CharacterCard } from "@/components/Cosmetics";
import {
  GACHA_ROSTER,
  PITY_MAX,
  PULL_COST_1,
  PULL_COST_10,
  RANK_ORDER,
  type GachaChar,
  type GachaRank,
} from "@/lib/gachaRoster";

const RANK_STYLE: Record<
  GachaRank,
  { chip: string; card: string; glow: string; text: string }
> = {
  SSS: {
    chip: "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-black",
    card: "from-amber-300 via-yellow-400 to-amber-600",
    glow: "shadow-[0_0_28px_-6px_rgba(251,191,36,.85)]",
    text: "text-amber-300",
  },
  SS: {
    chip: "bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white",
    card: "from-violet-400 via-fuchsia-500 to-purple-700",
    glow: "shadow-[0_0_22px_-8px_rgba(192,132,252,.8)]",
    text: "text-fuchsia-300",
  },
  S: {
    chip: "bg-gradient-to-r from-sky-400 to-blue-600 text-white",
    card: "from-sky-400 via-blue-500 to-indigo-600",
    glow: "shadow-[0_0_18px_-8px_rgba(56,189,248,.7)]",
    text: "text-sky-300",
  },
};

type PullCard = { id: string; name: string; anime: string; rank: string };

export default function Gacha() {
  const navigate = useNavigate();
  const state = useQuery(api.gacha.myState, {});
  const pulls = useQuery(api.gacha.myPulls, {});
  const images = useRosterImages();
  const pull = useMutation(api.gacha.pull);
  const equipCard = useMutation(api.gacha.equipCard);

  const [busy, setBusy] = useState<null | 1 | 10>(null);
  const [phase, setPhase] = useState<null | "comet" | "results">(null);
  const [reveal, setReveal] = useState<PullCard[]>([]);
  const [rankTab, setRankTab] = useState<GachaRank>("SSS");
  const [showIndex, setShowIndex] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bersihkan timer saat unmount supaya tidak setState setelah lepas.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const sacret = state?.sacret ?? 0;
  const pity = state?.pity ?? 0;
  const owned = (state?.owned ?? {}) as Record<string, number>;
  const equipped = state?.equippedCard ?? null;

  // Banner: 1 karakter SSS besar + 3 karakter SS di sebelahnya.
  const bannerSss = useMemo(
    () => GACHA_ROSTER.find((c) => c.rank === "SSS"),
    [],
  );
  const bannerSs = useMemo(
    () => GACHA_ROSTER.filter((c) => c.rank === "SS").slice(0, 3),
    [],
  );
  const rankPool = useMemo(
    () => GACHA_ROSTER.filter((c) => c.rank === rankTab),
    [rankTab],
  );

  const doPull = async (count: 1 | 10) => {
    if (busy || phase) return;
    const cost = count === 1 ? PULL_COST_1 : PULL_COST_10;
    if (sacret < cost) {
      toast.error(`Sacret tidak cukup — butuh ${cost.toLocaleString("id-ID")}`);
      return;
    }
    setBusy(count);
    setPhase("comet");
    try {
      const res = await pull({ count });
      const results = res.results as PullCard[];
      // Tunggu animasi komet selesai dulu (~1.6s) sebelum reveal hasil.
      timerRef.current = setTimeout(() => {
        setReveal(results);
        setPhase("results");
        setBusy(null);
        if (res.sssInPull > 0) toast.success(`Dapat SSS ×${res.sssInPull}! 🎉`);
      }, 1600);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal melakukan pull");
      setPhase(null);
      setBusy(null);
    }
  };

  const onPickCard = async (c: GachaChar) => {
    if (!owned[c.id]) {
      toast.info("Kartu ini belum dimiliki — coba tarik di altar!");
      return;
    }
    try {
      await equipCard({ cardId: equipped === c.id ? "none" : c.id });
      toast.success(
        equipped === c.id
          ? "Kartu dilepas"
          : `${c.name} dipasang di profil kamu ✨`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memasang kartu");
    }
  };

  return (
    <AppLayout hideAccountPanel>
      <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3">
        {/* ------------------------------- kepala ------------------------ */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/home")}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-extrabold tracking-tight">
            <Sparkles className="size-5 text-gold" aria-hidden />
            Gacha Karakter
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[13px] font-black text-gold">
            <SacretIcon className="size-4" />
            {sacret.toLocaleString("id-ID")}
          </span>
        </div>

        {/* ------------------------- BANNER: 1 SSS + 3 SS ---------------- */}
        <div className="relative mt-4 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#1b1430] via-[#120d22] to-[#0b0714] p-4">
          <div
            aria-hidden
            className="absolute -right-16 -top-16 size-52 rounded-full bg-gold/15 blur-3xl"
          />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gold/90">
                Banner Rate Up
              </p>
              <p className="mt-0.5 text-sm font-bold text-white/90">
                1 SSS + 3 SS siap menemani pull kamu
              </p>
            </div>
            {/* Tombol buka INDEKS + RIWAYAT pull */}
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setShowIndex(true)}
                className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-black text-gold transition active:scale-95"
              >
                Indeks
              </button>
              <button
                onClick={() => setShowHistory(true)}
                aria-label="Riwayat pull"
                className="rounded-full border border-white/15 bg-white/[0.06] p-1.5 text-white/80 transition active:scale-95"
              >
                <HistoryIcon className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-end gap-2.5">
            {/* 1 kartu SSS besar di kiri */}
            {bannerSss && (
              <div className="w-28 shrink-0">
                <CharacterCard
                  name={bannerSss.name}
                  anime={bannerSss.anime}
                  rank="SSS"
                  image={images[bannerSss.id]}
                />
              </div>
            )}
            {/* 3 kartu SS kecil bertumpuk di kanan */}
            <div className="grid flex-1 grid-cols-3 gap-2">
              {bannerSs.map((c) => (
                <div key={c.id}>
                  <CharacterCard
                    name={c.name}
                    anime={c.anime}
                    rank="SS"
                    image={images[c.id]}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------ pity bar ------------------------ */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-muted-foreground">PITY SSS</span>
            <span className="text-gold">
              {pity} / {PITY_MAX}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (pity / PITY_MAX) * 100)}%`,
              }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-gold to-amber-400"
            />
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
            Dapat SSS → pity langsung balik ke 0 (guaranteed tiap 75 pull)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-muted-foreground">
              Total pull: {(state?.totalPulls ?? 0).toLocaleString("id-ID")}
            </span>
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-300">
              SSS: {state?.sssCount ?? 0}
            </span>
            <span className="rounded-full bg-fuchsia-400/10 px-2 py-0.5 text-fuchsia-300">
              SS: {state?.ssCount ?? 0}
            </span>
          </div>
        </div>

        {/* ----------------------------- tombol pull ---------------------- */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => void doPull(1)}
            disabled={busy !== null}
            className="rounded-2xl border border-gold/50 bg-gradient-to-b from-gold/20 to-gold/5 py-3.5 text-center transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="block text-sm font-black text-gold">Pull ×1</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-gold/80">
              <SacretIcon className="size-3" />
              {PULL_COST_1.toLocaleString("id-ID")}
            </span>
          </button>
          <button
            onClick={() => void doPull(10)}
            disabled={busy !== null}
            className="relative rounded-2xl border border-gold bg-gradient-to-b from-gold to-amber-500 py-3.5 text-center transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="block text-sm font-black text-black">
              Pull ×10
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-black text-black/75">
              <SacretIcon className="size-3" />
              {PULL_COST_10.toLocaleString("id-ID")}
            </span>
            {busy === 10 && (
              <Loader2
                className="absolute right-2 top-2 size-4 animate-spin text-black/70"
                aria-hidden
              />
            )}
          </button>
        </div>

        {/* CTA buka indeks koleksi (jalan dari tombol atas juga) */}
        <button
          onClick={() => setShowIndex(true)}
          className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-gold/40"
        >
          <span className="text-sm font-bold">Koleksi Kartu</span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {Object.keys(owned).length}/{GACHA_ROSTER.length} kartu · buka indeks
          </span>
        </button>
      </div>

      {/* --------------------- overlay: animasi komet -------------------- */}
      <AnimatePresence>
        {phase === "comet" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] overflow-hidden bg-black"
          >
            {/* Bintang latar berkelip */}
            {Array.from({ length: 26 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute size-1 rounded-full bg-white"
                style={{
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 53) % 100}%`,
                }}
                animate={{ opacity: [0.15, 0.9, 0.15] }}
                transition={{
                  duration: 1.4 + (i % 4) * 0.3,
                  repeat: Infinity,
                  delay: (i % 7) * 0.12,
                }}
              />
            ))}
            {/* KOMET meluncur dari bawah ke atas */}
            <motion.div
              aria-hidden
              className="absolute left-1/2 bottom-0 h-40 w-1.5 -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(to top, rgba(251,191,36,0) 0%, rgba(251,191,36,.7) 60%, #fff 100%)",
                filter: "blur(1px)",
              }}
              initial={{ y: "100vh", opacity: 0, scaleY: 0.6 }}
              animate={{ y: "-20vh", opacity: 1, scaleY: 1 }}
              transition={{ duration: 1.35, ease: [0.4, 0, 0.2, 1] }}
            />
            {/* Kepala komet (titik terang) + kilau saat sampai puncak */}
            <motion.div
              aria-hidden
              className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-[0_0_30px_10px_rgba(251,191,36,.9)]"
              initial={{ top: "100%", opacity: 0 }}
              animate={{ top: ["100%", "18%"], opacity: [0, 1, 1] }}
              transition={{ duration: 1.35, ease: [0.4, 0, 0.2, 1] }}
            />
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-[18%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/40 blur-2xl"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 0.9], opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.7, delay: 1.2 }}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute inset-x-0 top-1/2 text-center text-sm font-black uppercase tracking-[0.35em] text-gold"
            >
              Menarik nasib…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------- overlay: hasil reveal --------------------- */}
      <AnimatePresence>
        {phase === "results" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-y-auto bg-black/95 px-4 py-8 backdrop-blur-md"
          >
            <motion.p
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-sm font-black uppercase tracking-[0.3em] text-gold"
            >
              Hasil Pull
            </motion.p>
            <div
              className={cn(
                "mt-5 grid w-full max-w-lg gap-2.5",
                reveal.length > 1
                  ? "grid-cols-5"
                  : "grid-cols-1 justify-items-center",
              )}
            >
              {reveal.map((card, i) => {
                const style = RANK_STYLE[card.rank as GachaRank] ?? RANK_STYLE.S;
                return (
                  <motion.div
                    key={`${card.id}-${i}`}
                    // Kartu muncul BESAR lalu mengecil ke tempatnya, satu per satu.
                    initial={{ scale: 2.6, opacity: 0, rotateY: 180 }}
                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                    transition={{
                      delay: 0.15 + i * 0.28,
                      duration: 0.5,
                      type: "spring",
                      bounce: 0.32,
                    }}
                    className={cn(
                      "relative",
                      reveal.length > 1 ? "" : "w-44",
                    )}
                  >
                    <CharacterCard
                      name={card.name}
                      anime={card.anime}
                      rank={(card.rank as GachaRank) ?? "S"}
                      image={images[card.id]}
                      className={style.glow}
                    />
                  </motion.div>
                );
              })}
            </div>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + reveal.length * 0.28 }}
              onClick={() => {
                setPhase(null);
                setReveal([]);
              }}
              className="mt-7 rounded-full bg-gold px-10 py-2.5 text-sm font-black text-black transition active:scale-95"
            >
              Lanjut
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------- overlay: INDEKS ----------------------- */}
      <AnimatePresence>
        {showIndex && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-0 z-[92] overflow-y-auto overscroll-contain bg-background"
          >
            <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-lg font-extrabold tracking-tight">
                  Indeks Kartu
                </h2>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {Object.keys(owned).length}/{GACHA_ROSTER.length} kartu
                </span>
                <button
                  onClick={() => setShowIndex(false)}
                  aria-label="Tutup"
                  className="flex size-9 items-center justify-center rounded-full border border-border"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex rounded-full border border-border bg-card p-0.5">
                {RANK_ORDER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRankTab(r)}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[12px] font-black transition",
                      rankTab === r
                        ? cn(RANK_STYLE[r].chip, "shadow-sm")
                        : "text-muted-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {rankPool.map((c) => {
                  const count = owned[c.id] ?? 0;
                  const has = count > 0;
                  const isActive = equipped === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      onClick={() => void onPickCard(c)}
                      className="text-left"
                    >
                      <div className="relative">
                        <CharacterCard
                          name={c.name}
                          anime={c.anime}
                          rank={c.rank}
                          image={images[c.id]}
                          locked={!has}
                        />
                        {!has && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
                            <Lock className="size-5 text-white/80" aria-hidden />
                          </span>
                        )}
                        {has && count > 1 && (
                          <span className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white">
                            ×{count}
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute inset-x-0 bottom-6 rounded-t-md bg-gold py-0.5 text-center text-[9px] font-black text-black">
                            TERPASANG
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------ overlay: RIWAYAT ----------------------- */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-0 z-[92] overflow-y-auto overscroll-contain bg-background"
          >
            <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-lg font-extrabold tracking-tight">
                  Riwayat Pull
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  aria-label="Tutup"
                  className="flex size-9 items-center justify-center rounded-full border border-border"
                >
                  <X className="size-4" />
                </button>
              </div>
              {(pulls ?? []).length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Belum ada pull — coba tarik di altar!
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {(pulls ?? []).map((p) => (
                    <div
                      key={p._id}
                      className="rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-muted-foreground">
                          {new Date(p.createdAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="font-bold text-gold">
                          {(p.cards as PullCard[]).length} kartu
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(p.cards as PullCard[]).map((c, i) => (
                          <span
                            key={`${c.id}-${i}`}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              c.rank === "SSS"
                                ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                                : c.rank === "SS"
                                  ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300"
                                  : "border-sky-400/50 bg-sky-400/10 text-sky-300",
                            )}
                          >
                            {c.name}
                            <span className="ml-1 opacity-70">{c.rank}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
