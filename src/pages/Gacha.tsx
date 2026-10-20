// YoruNime — HALAMAN GACHA.
//
// Tarik karakter anime pakai Sacret: 1 pull = 160, 10 pull = 1600.
// Pity 75 menjamin SSS dan RESET ke 0 begitu SSS didapat (guaranteed).
// Animasi pull: komet meluncur dari bawah ke atas, lalu hasil reveal
// muncul SATU PER SATU dengan kartu besar → mengecil ke tempatnya.
// Logika angka ada di src/convex/gacha.ts — halaman ini tampilan + animasi.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  History as HistoryIcon,
  LayoutGrid,
  Loader2,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { SacretIcon } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import {
  GACHA_ROSTER,
  PITY_MAX,
  PULL_COST_1,
  PULL_COST_10,
  RANK_ORDER,
  type GachaChar,
  type GachaRank,
} from "@/lib/gachaRoster";

/** Warna rank — dipakai di banner, kartu reveal, dan koleksi. */
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

/** Waktu relatif ringkas untuk riwayat pull. */
function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

/** Bintang berkelip latar selama animasi komet. */
function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37) % 100,
        top: (i * 61) % 100,
        size: i % 4 === 0 ? 3 : 2,
        delay: (i % 7) * 0.35,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 size-[75vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/80"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `yn-twinkle 2.2s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Animasi KOMET — meluncur dari bawah ke atas membelah layar, membawa ekor
 * panjang emas + kilau, lalu meledak jadi kilatan cahaya sebelum hasil pull
 * muncul. Klik layar untuk melewati.
 */
function CometLayer({ reduce, onSkip }: { reduce: boolean; onSkip: () => void }) {
  const dur = reduce ? 0.35 : 1.35;
  return (
    <motion.button
      type="button"
      onClick={onSkip}
      aria-label="Lewati animasi"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 block w-full cursor-default overflow-hidden"
    >
      <StarField />

      {/* Komet utama: dari kiri-bawah ke kanan-atas */}
      <motion.div
        initial={{ x: "-48vw", y: "52vh", opacity: 0 }}
        animate={{ x: "40vw", y: "-58vh", opacity: [0, 1, 1, 1] }}
        transition={{ duration: dur, ease: [0.4, 0, 0.7, 1] }}
        className="absolute left-1/2 top-1/2"
      >
        <div className="relative -rotate-[38deg]">
          {/* Ekor utama */}
          <div className="absolute right-1/2 top-1/2 h-[3px] w-[52vh] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-gold to-white" />
          {/* Ekor bercahaya (blur) */}
          <div className="absolute right-1/2 top-1/2 h-2.5 w-[52vh] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-gold/60 to-white/70 blur-[6px]" />
          {/* Kepala komet */}
          <div className="size-4 rounded-full bg-white shadow-[0_0_30px_10px_rgba(251,191,36,.9)]" />
        </div>
      </motion.div>

      {/* Komet kecil pengiring */}
      <motion.div
        initial={{ x: "-40vw", y: "62vh", opacity: 0 }}
        animate={{ x: "-14vw", y: "-40vh", opacity: [0, 0.9, 0.9, 0] }}
        transition={{ duration: dur * 0.9, delay: dur * 0.18, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2"
      >
        <div className="relative -rotate-[46deg] scale-50">
          <div className="absolute right-1/2 top-1/2 h-[3px] w-[34vh] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-sky-300 to-white blur-[2px]" />
          <div className="size-4 rounded-full bg-white shadow-[0_0_22px_6px_rgba(125,211,252,.8)]" />
        </div>
      </motion.div>
      <motion.div
        initial={{ x: "18vw", y: "66vh", opacity: 0 }}
        animate={{ x: "52vw", y: "-30vh", opacity: [0, 0.8, 0.8, 0] }}
        transition={{ duration: dur * 0.85, delay: dur * 0.3, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2"
      >
        <div className="relative -rotate-[30deg] scale-[.4]">
          <div className="absolute right-1/2 top-1/2 h-[3px] w-[28vh] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-fuchsia-300 to-white blur-[2px]" />
          <div className="size-4 rounded-full bg-white shadow-[0_0_18px_6px_rgba(232,121,249,.7)]" />
        </div>
      </motion.div>

      {/* Kilatan saat komet mencapai puncak */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.7, 2.6], opacity: [0, 0.85, 0] }}
        transition={{ delay: dur * 0.78, duration: 0.55, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/50 blur-2xl"
      />

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="absolute inset-x-0 top-[62%] text-center text-xs font-black uppercase tracking-[0.4em] text-gold/90"
      >
        Menarik takdir…
      </motion.p>
    </motion.button>
  );
}

export default function Gacha() {
  const navigate = useNavigate();
  const state = useQuery(api.gacha.myState, {});
  const rosterImages = useAction(api.gacha.rosterImages);
  const pull = useMutation(api.gacha.pull);
  const equipCard = useMutation(api.gacha.equipCard);

  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | 1 | 10>(null);
  const [reveal, setReveal] = useState<PullCard[] | null>(null);
  /** Fase animasi: komet dulu, baru hasil. */
  const [phase, setPhase] = useState<"comet" | "results">("comet");
  const [rankTab, setRankTab] = useState<GachaRank>("SSS");
  const [historyOpen, setHistoryOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Gambar karakter dari AniList (di-cache server 30 hari).
  useEffect(() => {
    let alive = true;
    rosterImages()
      .then((r) => alive && setImages(r ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bersihkan timer animasi saat unmount.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const sacret = state?.sacret ?? 0;
  const pity = state?.pity ?? 0;
  const owned = (state?.owned ?? {}) as Record<string, number>;
  const equipped = state?.equippedCard ?? null;
  const history = state?.history ?? [];

  // Rate-up harian: 1 SSS unggulan + 3 SS, berganti tiap hari.
  const { featuredSss, bannerSs } = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    const sss = GACHA_ROSTER.filter((c) => c.rank === "SSS");
    const ss = GACHA_ROSTER.filter((c) => c.rank === "SS");
    const feat = sss[day % sss.length];
    const three = Array.from(
      { length: Math.min(3, ss.length) },
      (_, i) => ss[(day + i) % ss.length],
    );
    return { featuredSss: feat, bannerSs: three };
  }, []);

  const rankPool = useMemo(
    () => GACHA_ROSTER.filter((c) => c.rank === rankTab),
    [rankTab],
  );

  const doPull = async (count: 1 | 10) => {
    if (busy || reveal) return;
    const cost = count === 1 ? PULL_COST_1 : PULL_COST_10;
    if (sacret < cost) {
      toast.error(`Sacret tidak cukup — butuh ${cost.toLocaleString("id-ID")}`);
      return;
    }
    setBusy(count);
    try {
      const res = await pull({ count });
      setReveal(res.results as PullCard[]);
      setPhase("comet");
      // Komet dulu, baru hasil muncul satu per satu.
      const ms = reduceMotion ? 420 : 1500;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPhase("results"), ms);
      if (res.sssInPull > 0) {
        window.setTimeout(
          () => toast.success(`Dapat SSS ×${res.sssInPull}! 🎉`),
          ms,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal melakukan pull");
    } finally {
      setBusy(null);
    }
  };

  const closeReveal = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setReveal(null);
    setPhase("comet");
  };

  const showIndex = () => {
    document
      .getElementById("koleksi-gacha")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // Langkah jeda antar kartu hasil reveal (satu per satu).
  const step = reveal && reveal.length > 5 ? 0.14 : 0.3;

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

        {/* ------------------- BANNER: 1 SSS + 3 SS + Index/History ------- */}
        <div className="relative mt-4 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-[#1e1536] via-[#130d24] to-[#0b0714] p-4">
          <div
            aria-hidden
            className="absolute -right-16 -top-16 size-52 rounded-full bg-gold/15 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -left-20 -bottom-24 size-52 rounded-full bg-fuchsia-500/10 blur-3xl"
          />

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gold/90">
                Banner Rate Up
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-extrabold text-white/90">
                1 SSS + 3 SS — hadir hari ini
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={showIndex}
                className="inline-flex items-center gap-1 rounded-full border border-gold/45 bg-gold/10 px-3 py-1.5 text-[11px] font-black text-gold transition active:scale-95"
              >
                <LayoutGrid className="size-3.5" aria-hidden />
                Index
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white/85 transition active:scale-95"
              >
                <HistoryIcon className="size-3.5" aria-hidden />
                History
              </button>
            </div>
          </div>

          {/* 1 kartu SSS besar + 3 kartu SS */}
          <div className="relative mt-3 flex gap-2.5">
            {featuredSss && (
              <div className="w-[36%] shrink-0">
                <div
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b",
                    RANK_STYLE.SSS.card,
                    RANK_STYLE.SSS.glow,
                  )}
                >
                  {images[featuredSss.id] ? (
                    <img
                      src={images[featuredSss.id]}
                      alt={featuredSss.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-3xl font-black text-white/75">
                      {featuredSss.name.slice(0, 1)}
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black",
                      RANK_STYLE.SSS.chip,
                    )}
                  >
                    SSS
                  </span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-center text-[10px] font-black text-white">
                    {featuredSss.name}
                  </span>
                </div>
                <p className="mt-1 text-center text-[9px] font-semibold text-gold/80">
                  Unggulan
                </p>
              </div>
            )}
            <div className="grid flex-1 grid-cols-3 gap-2">
              {bannerSs.map((c) => (
                <div key={c.id} className="min-w-0">
                  <div
                    className={cn(
                      "relative aspect-[3/4] overflow-hidden rounded-xl border border-white/12 bg-gradient-to-b",
                      RANK_STYLE.SS.card,
                      RANK_STYLE.SS.glow,
                    )}
                  >
                    {images[c.id] ? (
                      <img
                        src={images[c.id]}
                        alt={c.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-lg font-black text-white/75">
                        {c.name.slice(0, 1)}
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-black",
                        RANK_STYLE.SS.chip,
                      )}
                    >
                      SS
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-center text-[9px] font-bold text-white/85">
                    {c.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* -------------------- pity / GUARANTEED SSS ------------------- */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] font-black">
            <span className="text-gold">GUARANTEED SSS</span>
            <span className="text-gold">
              {pity} / {PITY_MAX}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
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
            Dijamin SSS di pull ke-{PITY_MAX}. Counter balik ke 0 otomatis
            begitu kamu dapat SSS.
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
            disabled={busy !== null || !!reveal}
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
            disabled={busy !== null || !!reveal}
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

        {/* ---------------------------- koleksi / INDEX ------------------ */}
        <div
          id="koleksi-gacha"
          className="mt-6 flex items-center justify-between scroll-mt-20"
        >
          <h2 className="text-lg font-black tracking-tight">
            Index Kartu <span className="text-gold">·</span> Koleksi
          </h2>
          <span className="text-[11px] font-bold text-muted-foreground">
            {Object.keys(owned).length}/{GACHA_ROSTER.length} kartu
          </span>
        </div>

        {/* Tab indeks rank: SSS / SS / S */}
        <div className="mt-2 flex rounded-full border border-border bg-card p-0.5">
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
                <div
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden rounded-xl border bg-gradient-to-b",
                    RANK_STYLE[c.rank].card,
                    has ? RANK_STYLE[c.rank].glow : "opacity-45 grayscale",
                    isActive && "ring-2 ring-gold ring-offset-2 ring-offset-background",
                  )}
                >
                  {images[c.id] ? (
                    <img
                      src={images[c.id]}
                      alt={c.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-2xl font-black text-white/70">
                      {c.name.slice(0, 1)}
                    </div>
                  )}
                  {!has && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                      <Lock className="size-5 text-white/80" aria-hidden />
                    </span>
                  )}
                  {has && count > 1 && (
                    <span className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white">
                      ×{count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 bg-gold px-1 py-0.5 text-center text-[9px] font-black text-black">
                      TERPASANG
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 line-clamp-1 text-[11px] font-bold",
                    has ? "text-white/90" : "text-muted-foreground",
                  )}
                >
                  {c.name}
                </p>
                <p className="line-clamp-1 text-[9px] text-muted-foreground">
                  {c.anime}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ------------- overlay: menunggu server (sebelum komet) ---------- */}
      {busy !== null && !reveal && (
        <div className="fixed inset-0 z-[94] flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-md">
          <Loader2 className="size-8 animate-spin text-gold" aria-hidden />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gold/90">
            Menarik takdir…
          </p>
        </div>
      )}

      {/* ------------- overlay reveal: KOMET → hasil satu per satu ------- */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] overflow-hidden bg-black/95 backdrop-blur-md"
          >
            {/* FASE 1 — komet meluncur dari bawah ke atas */}
            {phase === "comet" && (
              <CometLayer reduce={reduceMotion} onSkip={() => setPhase("results")} />
            )}

            {/* FASE 2 — hasil muncul satu per satu, kartu besar → kecil */}
            {phase === "results" && (
              <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8">
                <StarField />
                <motion.p
                  initial={{ y: -12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="relative text-sm font-black uppercase tracking-[0.3em] text-gold"
                >
                  Hasil Pull
                </motion.p>
                <div
                  className={cn(
                    "relative mt-4 grid w-full max-w-lg gap-2",
                    reveal.length > 1
                      ? "grid-cols-5"
                      : "grid-cols-1 justify-items-center",
                  )}
                >
                  {reveal.map((card, i) => {
                    const style =
                      RANK_STYLE[card.rank as GachaRank] ?? RANK_STYLE.S;
                    return (
                      <motion.div
                        key={`${card.id}-${i}`}
                        initial={{
                          scale: reveal.length > 1 ? 1.9 : 2.8,
                          opacity: 0,
                          y: 30,
                          rotateZ: -7,
                        }}
                        animate={{ scale: 1, opacity: 1, y: 0, rotateZ: 0 }}
                        transition={{
                          delay: 0.12 + i * step,
                          type: "spring",
                          stiffness: 170,
                          damping: 15,
                          mass: 0.7,
                        }}
                        className={cn(
                          "relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b",
                          style.card,
                          style.glow,
                          reveal.length > 1
                            ? "aspect-[3/4]"
                            : "w-44 aspect-[3/4]",
                        )}
                      >
                        {images[card.id] ? (
                          <img
                            src={images[card.id]}
                            alt={card.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-2xl font-black text-white/80">
                            {card.name.slice(0, 1)}
                          </div>
                        )}
                        <span
                          className={cn(
                            "absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-black",
                            style.chip,
                          )}
                        >
                          {card.rank}
                        </span>
                        {reveal.length <= 5 && (
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] font-bold text-white">
                            {card.name}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + reveal.length * step }}
                  onClick={closeReveal}
                  className="relative mt-6 rounded-full bg-gold px-8 py-2.5 text-sm font-black text-black transition active:scale-95"
                >
                  Lanjut
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------- overlay history -------------------- */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[92] flex flex-col bg-background/97 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-black tracking-tight">
                <HistoryIcon className="size-5 text-gold" aria-hidden />
                History Pull
                <span className="text-[11px] font-bold text-muted-foreground">
                  {history.length} terakhir
                </span>
              </h2>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Tutup"
                className="flex size-9 items-center justify-center rounded-full border border-border transition active:scale-90"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                  <Sparkles className="size-8 text-gold/50" aria-hidden />
                  <p className="text-sm font-bold text-muted-foreground">
                    Belum ada pull. Tarik altar dulu yuk!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => {
                    const c = GACHA_ROSTER.find((x) => x.id === h.id);
                    const style =
                      RANK_STYLE[h.rank as GachaRank] ?? RANK_STYLE.S;
                    return (
                      <motion.div
                        key={`${h.id}-${h.at}-${i}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.4) }}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2"
                      >
                        <div
                          className={cn(
                            "size-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b",
                            style.card,
                          )}
                        >
                          {images[h.id] ? (
                            <img
                              src={images[h.id]}
                              alt={c?.name ?? h.id}
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-sm font-black text-white/80">
                              {(c?.name ?? "?").slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-[13px] font-black text-white/90">
                            {c?.name ?? h.id}
                          </p>
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {c?.anime ?? "—"} · {timeAgo(h.at)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-lg px-2 py-1 text-[10px] font-black",
                            style.chip,
                          )}
                        >
                          {h.rank}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
