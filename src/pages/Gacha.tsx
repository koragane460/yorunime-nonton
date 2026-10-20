// YoruNime — HALAMAN GACHA.
//
// Tarik karakter anime pakai Sacret: 1 pull = 160, 10 pull = 1600.
// Pity 75 menjamin SSS. Kartu hasil pull masuk koleksi dan bisa dipasang
// (equip) supaya tampil di detail akun. Logika angka ada di
// src/convex/gacha.ts — halaman ini hanya tampilan + animasi.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Lock, Sparkles } from "lucide-react";
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

export default function Gacha() {
  const navigate = useNavigate();
  const state = useQuery(api.gacha.myState, {});
  const rosterImages = useAction(api.gacha.rosterImages);
  const pull = useMutation(api.gacha.pull);
  const equipCard = useMutation(api.gacha.equipCard);

  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | 1 | 10>(null);
  const [reveal, setReveal] = useState<PullCard[] | null>(null);
  const [rankTab, setRankTab] = useState<GachaRank>("SSS");

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

  const sacret = state?.sacret ?? 0;
  const pity = state?.pity ?? 0;
  const owned = (state?.owned ?? {}) as Record<string, number>;
  const equipped = state?.equippedCard ?? null;

  const bannerChars = useMemo(
    () => GACHA_ROSTER.filter((c) => c.rank === "SSS").slice(0, 6),
    [],
  );
  const rankPool = useMemo(
    () => GACHA_ROSTER.filter((c) => c.rank === rankTab),
    [rankTab],
  );

  const doPull = async (count: 1 | 10) => {
    if (busy) return;
    const cost = count === 1 ? PULL_COST_1 : PULL_COST_10;
    if (sacret < cost) {
      toast.error(`Sacret tidak cukup — butuh ${cost.toLocaleString("id-ID")}`);
      return;
    }
    setBusy(count);
    try {
      const res = await pull({ count });
      setReveal(res.results as PullCard[]);
      if (res.sssInPull > 0) {
        toast.success(`Dapat SSS ×${res.sssInPull}! 🎉`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal melakukan pull");
    } finally {
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

        {/* ------------------------- banner SSS showcase ------------------ */}
        <div className="relative mt-4 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#1b1430] via-[#120d22] to-[#0b0714] p-4">
          <div
            aria-hidden
            className="absolute -right-16 -top-16 size-52 rounded-full bg-gold/15 blur-3xl"
          />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gold/90">
            Banner Rate Up — SSS
          </p>
          <p className="mt-0.5 text-sm font-bold text-white/90">
            Karakter paling ikonik, paling susah didapat
          </p>
          <div className="thin-scroll mt-3 flex gap-2.5 overflow-x-auto pb-1">
            {bannerChars.map((c) => (
              <div key={c.id} className="w-24 shrink-0 text-center">
                <div
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b",
                    RANK_STYLE[c.rank].card,
                    RANK_STYLE[c.rank].glow,
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
                    <div className="flex size-full items-center justify-center text-3xl font-black text-white/70">
                      {c.name.slice(0, 1)}
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[9px] font-black",
                      RANK_STYLE[c.rank].chip,
                    )}
                  >
                    {c.rank}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] font-bold text-white/90">
                  {c.name}
                </p>
                <p className="line-clamp-1 text-[9px] text-muted-foreground">
                  {c.anime}
                </p>
              </div>
            ))}
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
            className={cn(
              "rounded-2xl border border-gold/50 bg-gradient-to-b from-gold/20 to-gold/5 py-3.5 text-center transition active:scale-[0.98] disabled:opacity-60",
            )}
          >
            <span className="block text-sm font-black text-gold">
              Pull ×1
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-gold/80">
              <SacretIcon className="size-3" />
              {PULL_COST_1.toLocaleString("id-ID")}
            </span>
          </button>
          <button
            onClick={() => void doPull(10)}
            disabled={busy !== null}
            className={cn(
              "relative rounded-2xl border border-gold bg-gradient-to-b from-gold to-amber-500 py-3.5 text-center transition active:scale-[0.98] disabled:opacity-60",
            )}
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

        {/* ---------------------------- koleksi --------------------------- */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Koleksi Kartu</h2>
          <span className="text-[11px] font-semibold text-muted-foreground">
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

      {/* --------------------------- overlay reveal ---------------------- */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/92 px-4 backdrop-blur-md"
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
                "mt-4 grid w-full max-w-lg gap-2",
                reveal.length > 1 ? "grid-cols-5" : "grid-cols-1 justify-items-center",
              )}
            >
              {reveal.map((card, i) => {
                const style =
                  RANK_STYLE[card.rank as GachaRank] ?? RANK_STYLE.S;
                return (
                  <motion.div
                    key={`${card.id}-${i}`}
                    initial={{ rotateY: 180, opacity: 0, scale: 0.7 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.15 + i * 0.13,
                      duration: 0.5,
                      type: "spring",
                      bounce: 0.3,
                    }}
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b",
                      style.card,
                      style.glow,
                      reveal.length > 1 ? "aspect-[3/4]" : "w-40 aspect-[3/4]",
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
              transition={{ delay: 0.2 + reveal.length * 0.13 }}
              onClick={() => setReveal(null)}
              className="mt-6 rounded-full bg-gold px-8 py-2.5 text-sm font-black text-black transition active:scale-95"
            >
              Lanjut
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
