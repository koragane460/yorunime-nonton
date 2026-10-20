// YORUPET — kebun binatang virtual (bagian dari YORUVERSE).
//
// Alur: gacha telur (1x 1.000 / 10.000 Sacret) -> tetas -> pet random
// sesuai persentase drop (10 pet, 5 rarity) -> equip -> pet berjalan di
// panggung scene -> klaim Sacret tiap 24 jam sesuai rarity -> jual pet
// mengembalikan crystal sesuai harga pet. Shop scene mengubah tampilan
// panggung SEKALIGUS latar layar (transisi halus).
//
// TATA LETAK (permintaan pemilik): panggung "hutan" pas DI TENGAH layar,
// tombol Gacha/Index di PALING BAWAH, dan Index membuka SHEET (kotak overlay
// yang menutupi tombol) — ketuk area kosong untuk menutup. Pet memakai
// GAMBAR HEWAN BERBADAN (SVG, lihat PetArt), bukan emoji.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Egg, BookOpen, Coins, Gift } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  GACHA_X1,
  GACHA_X10,
  PETS,
  RARITY_STYLE,
  SCENES,
  sceneById,
  type PetRarity,
} from "@/lib/pets";
import { PetArt } from "@/components/PetArt";

/** Isi sheet bawah — Telur / Pet / Index / Scene. */
type SheetTab = "telur" | "pet" | "index" | "scene";

/** Format hitungan mundur klaim 24 jam jadi "7j 12m 03d". */
function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}j ${pad(m)}m ${pad(sec)}d` : `${pad(m)}m ${pad(sec)}d`;
}

export function YoruPetScreen({ onBack }: { onBack: () => void }) {
  const state = useQuery(api.pets.state, {});
  const pullM = useMutation(api.pets.pull);
  const hatchM = useMutation(api.pets.hatch);
  const hatchAllM = useMutation(api.pets.hatchAll);
  const equipM = useMutation(api.pets.equip);
  const unequipM = useMutation(api.pets.unequip);
  const sellM = useMutation(api.pets.sell);
  const claimM = useMutation(api.pets.claim);
  const buySceneM = useMutation(api.pets.buyScene);
  const setSceneM = useMutation(api.pets.setScene);

  /** Sheet bawah (overlay) — null = tertutup. */
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  const [busy, setBusy] = useState(false);
  /** Hasil tetasan terakhir — kartu perayaan di tengah layar. */
  const [hatched, setHatched] = useState<
    { name: string; petId: string; rarity: PetRarity } | null
  >(null);
  /** Detik berjalan untuk hitungan mundur klaim. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const scene = sceneById(state?.scene ?? "hutan");
  const equipped = state?.equipped ?? null;
  const claimReady = !!equipped && !!state?.claimReady;
  const claimIn = state?.claimIn ?? 0;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const doGacha = (count: 1 | 10) =>
    void run(async () => {
      await pullM({ count });
      setSheet("telur");
      toast.success(count === 1 ? "Dapat 1 Telur Misteri!" : "Dapat 10 Telur Misteri!");
    });

  const doHatch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await hatchM({});
      setHatched({ name: r.name, petId: r.petId, rarity: r.rarity as PetRarity });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const doClaim = () =>
    void run(async () => {
      const r = await claimM({});
      toast.success(`Klaim +${r.amount.toLocaleString("id-ID")} Sacret!`);
    });

  // ---------- panggung: posisi berjalan pet ----------
  const [pos, setPos] = useState({ x: 40, y: 40 });
  const [flip, setFlip] = useState(1);
  const walkTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!equipped) return;
    const step = () => {
      setPos((p) => {
        const nx = 10 + Math.random() * 62; // batas dalam panggung
        const ny = 28 + Math.random() * 34;
        setFlip(nx >= p.x ? 1 : -1);
        return { x: nx, y: ny };
      });
      walkTimer.current = window.setTimeout(step, 2200 + Math.random() * 2000);
    };
    walkTimer.current = window.setTimeout(step, 1600);
    return () => {
      if (walkTimer.current) window.clearTimeout(walkTimer.current);
    };
  }, [equipped?.uid]);

  const particles = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: (i * 41 + 7) % 96,
        delay: (i % 5) * 0.7,
        dur: 4.5 + (i % 4),
      })),
    [],
  );

  if (state === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold text-muted-foreground">
        Memuat kebun…
      </div>
    );
  }
  if (state === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold text-muted-foreground">
        Masuk dulu untuk bermain YoruPet.
      </div>
    );
  }

  const equippedDef = equipped
    ? RARITY_STYLE[equipped.rarity as PetRarity]
    : null;

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      {/* --------------------------- latar scene ------------------------ */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b", scene.sky)}
          aria-hidden
        />
      </AnimatePresence>
      {/* partikel melayang khas scene */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {particles.map((p, i) => (
          <motion.span
            key={i}
            className="absolute text-lg opacity-70"
            style={{ left: `${p.left}%`, top: `${8 + (i % 4) * 22}%` }}
            animate={{ y: [0, -16, 0], rotate: [0, 12, 0] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.delay }}
          >
            {scene.particle}
          </motion.span>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* ---------------------------- kepala -------------------------- */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 pt-3">
          <button
            onClick={onBack}
            aria-label="Kembali ke YoruVerse"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight">
              Kebun Binatang Milik{" "}
              <span className="font-black text-gold">{state.username}</span>
            </h1>
            <p className="text-[10px] text-zinc-300">
              Telur ×{state.eggs} · Crystal {state.crystals.toLocaleString("id-ID")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[12px] font-black text-gold backdrop-blur-sm">
            <Coins className="size-3.5" aria-hidden />
            {state.sacret.toLocaleString("id-ID")}
          </span>
        </div>

        {/* ----------------- panggung: PAS DI TENGAH ------------------- */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-4">
          <div
            className={cn(
              "relative h-72 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 shadow-[0_18px_40px_-18px_rgba(0,0,0,.9)]",
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-b", scene.sky)} aria-hidden />
            {/* lantai */}
            <div className={cn("absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b opacity-80", scene.floor)} aria-hidden />
            {/* pet berjalan + bubble klaim di atasnya */}
            {equipped ? (
              <motion.div
                className="absolute z-10"
                initial={false}
                animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                transition={{ duration: 2.4, ease: "easeInOut" }}
              >
                {/* bubble klaim: tipis, rounded penuh, hitung mundur 24 jam */}
                <div className="absolute -top-10 left-1/2 w-max max-w-[160px] -translate-x-1/2">
                  {claimReady ? (
                    <button
                      onClick={doClaim}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-black shadow-[0_0_16px_-4px_rgba(255,207,64,.9)] transition active:scale-95"
                    >
                      <Gift className="size-3" aria-hidden />
                      Klaim {equipped.claim} Sacret
                    </button>
                  ) : (
                    <div className="rounded-full border border-white/25 bg-black/55 px-2 py-0.5 text-center text-[10px] font-bold text-zinc-200 backdrop-blur-sm">
                      <span className="mr-1">🎁</span>
                      {fmtLeft(claimIn - tick * 1000)}
                    </div>
                  )}
                </div>
                {/* GAMBAR HEWAN BERBADAN (bukan emoji) */}
                <motion.div
                  animate={{ scaleX: flip }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "relative size-20 rounded-full bg-white/5 ring-1 backdrop-blur-sm",
                    equippedDef?.ring,
                    equippedDef?.glow,
                  )}
                >
                  <PetArt petId={equipped.petId} />
                  {/* bayangan tanah */}
                  <span
                    aria-hidden
                    className="absolute -bottom-1.5 left-1/2 h-2.5 w-14 -translate-x-1/2 rounded-[50%] bg-black/40 blur-[2px]"
                  />
                </motion.div>
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-zinc-300 backdrop-blur-sm">
                  Pasang (equip) pet supaya bermain di kebun 🐾
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ------------- tombol di PALING BAWAH layar ------------------ */}
        <div className="mx-auto w-full max-w-2xl px-3 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => doGacha(1)}
              disabled={busy}
              className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 py-2.5 text-black shadow-[0_10px_22px_-10px_rgba(245,158,11,.9)] transition active:scale-[0.97] disabled:opacity-60"
            >
              <Egg className="mx-auto size-4" aria-hidden />
              <span className="mt-0.5 block text-[11px] font-black leading-tight">Gacha 1×</span>
              <span className="block text-[9px] font-bold opacity-80">
                {GACHA_X1.toLocaleString("id-ID")} Sacret
              </span>
            </button>
            <button
              onClick={() => doGacha(10)}
              disabled={busy}
              className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-600 py-2.5 text-black shadow-[0_10px_22px_-10px_rgba(16,185,129,.9)] transition active:scale-[0.97] disabled:opacity-60"
            >
              <Egg className="mx-auto size-4" aria-hidden />
              <span className="mt-0.5 block text-[11px] font-black leading-tight">Gacha 10×</span>
              <span className="block text-[9px] font-bold opacity-80">
                {GACHA_X10.toLocaleString("id-ID")} Sacret
              </span>
            </button>
            <button
              onClick={() => setSheet("index")}
              className="rounded-2xl bg-gradient-to-b from-zinc-500 to-zinc-700 py-2.5 text-white shadow-[0_10px_22px_-10px_rgba(0,0,0,.9)] transition active:scale-[0.97]"
            >
              <BookOpen className="mx-auto size-4" aria-hidden />
              <span className="mt-0.5 block text-[11px] font-black leading-tight">Index</span>
              <span className="block text-[9px] font-bold opacity-80">{PETS.length} pet</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------- SHEET BAWAH (Index) — nutupi tombol, tap = tutup ---- */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[76] flex flex-col justify-end"
            onClick={() => setSheet(null)}
          >
            {/* area kosong di atas sheet — ketuk untuk menutup */}
            <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="thin-scroll mx-auto max-h-[68%] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-white/20 bg-black/85 p-3 pb-5 backdrop-blur-xl"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" aria-hidden />
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["telur", "🥚 Telur"],
                    ["pet", "🐾 Pet"],
                    ["index", "📖 Index"],
                    ["scene", "🏞️ Scene"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSheet(k)}
                    className={cn(
                      "rounded-full px-2 py-1.5 text-[11px] font-black transition",
                      sheet === k
                        ? "bg-gold text-black"
                        : "bg-white/10 text-zinc-300 hover:bg-white/15",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                {/* ------------------------- TELUR -------------------- */}
                {sheet === "telur" && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <motion.div
                      animate={{ rotate: [-4, 4, -4] }}
                      transition={{ duration: 2.6, repeat: Infinity }}
                      className="flex size-20 items-center justify-center rounded-full bg-white/10 text-5xl ring-1 ring-white/20"
                    >
                      🥚
                    </motion.div>
                    <p className="text-sm font-black">
                      Telur Misteri <span className="text-gold">×{state.eggs}</span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={doHatch}
                        disabled={busy || state.eggs < 1}
                        className="rounded-xl bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 px-4 py-2 text-[12px] font-black text-white transition active:scale-95 disabled:opacity-50"
                      >
                        Tetas 1
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const r = await hatchAllM({});
                            setSheet("pet");
                            toast.success(`Menetas ${r.count} telur!`);
                          })
                        }
                        disabled={busy || state.eggs < 1}
                        className="rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 px-4 py-2 text-[12px] font-black text-white transition active:scale-95 disabled:opacity-50"
                      >
                        Tetas Semua
                      </button>
                    </div>
                  </div>
                )}

                {/* -------------------------- PET --------------------- */}
                {sheet === "pet" &&
                  (state.owned.length === 0 ? (
                    <p className="py-8 text-center text-xs font-bold text-zinc-400">
                      Belum punya pet — gacha lalu tetas telurnya! 🥚
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {state.owned.map((o) => {
                        const st = RARITY_STYLE[o.rarity as PetRarity];
                        const on = equipped?.uid === o.uid;
                        return (
                          <div
                            key={o.uid}
                            className={cn(
                              "rounded-2xl border p-2",
                              on ? cn("bg-white/10", st.ring, "border-transparent") : "border-white/10 bg-white/[0.03]",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 p-0.5",
                                  st.glow,
                                )}
                              >
                                <PetArt petId={o.petId} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black">{o.name}</p>
                                <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-black", st.chip)}>
                                  {o.rarity}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1.5 flex gap-1">
                              <button
                                onClick={() =>
                                  void run(async () => {
                                    if (on) await unequipM({});
                                    else {
                                      await equipM({ uid: o.uid });
                                      toast.success(`${o.name} equip!`);
                                    }
                                  })
                                }
                                className="flex-1 rounded-lg bg-white/10 py-1 text-[10px] font-black transition active:scale-95 hover:bg-white/20"
                              >
                                {on ? "Lepas" : "Equip"}
                              </button>
                              <button
                                onClick={() =>
                                  void run(async () => {
                                    await sellM({ uid: o.uid });
                                    toast.success(`Jual ${o.name} +${o.crystal} crystal`);
                                  })
                                }
                                disabled={on}
                                className="flex-1 rounded-lg bg-rose-500/80 py-1 text-[10px] font-black text-white transition active:scale-95 disabled:opacity-40"
                              >
                                Jual {o.crystal}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {/* ------------------------- INDEX -------------------- */}
                {sheet === "index" && (
                  <div className="grid grid-cols-2 gap-2">
                    {PETS.map((p) => {
                      const st = RARITY_STYLE[p.rarity];
                      const mine = state.owned.filter((o) => o.petId === p.id).length;
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center gap-2 rounded-2xl border p-2",
                            mine > 0 ? cn("border-transparent bg-white/10", st.ring) : "border-white/10 bg-white/[0.02]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 p-0.5",
                              mine > 0 && st.glow,
                            )}
                          >
                            <PetArt petId={p.id} />
                          </span>
                          <div className="min-w-0">
                            <p className={cn("truncate text-xs font-black", mine > 0 ? "text-white" : "text-zinc-500")}>
                              {p.name}
                            </p>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-black", st.chip)}>
                              {p.rarity}
                            </span>
                            <p className="text-[9px] font-bold text-zinc-400">
                              Drop {p.rate}% · Klaim {p.claim} · {mine > 0 ? `punya ${mine}` : "belum"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ------------------------- SCENE ------------------- */}
                {sheet === "scene" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SCENES.map((sc) => {
                      const owned = (state.scenes ?? []).includes(sc.id);
                      const active = (state.scene ?? "hutan") === sc.id;
                      return (
                        <div
                          key={sc.id}
                          className={cn(
                            "overflow-hidden rounded-2xl",
                            active ? "ring-2 ring-gold" : "ring-1 ring-white/15",
                          )}
                        >
                          <div className={cn("flex h-14 items-center justify-center bg-gradient-to-b text-2xl", sc.sky)}>
                            {sc.emoji}
                          </div>
                          <div className="p-2">
                            <p className="text-[11px] font-black">{sc.name}</p>
                            {owned ? (
                              <button
                                onClick={() => void run(() => setSceneM({ sceneId: sc.id }))}
                                disabled={active}
                                className={cn(
                                  "mt-1 w-full rounded-lg py-1 text-[10px] font-black transition active:scale-95",
                                  active
                                    ? "bg-gold/30 text-gold"
                                    : "bg-gradient-to-b from-amber-300 to-amber-500 text-black",
                                )}
                              >
                                {active ? "Aktif" : "Pakai"}
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  void run(async () => {
                                    await buySceneM({ sceneId: sc.id });
                                    toast.success(`Scene ${sc.name} dibeli & dipasang!`);
                                  })
                                }
                                className="mt-1 w-full rounded-lg bg-gradient-to-b from-sky-400 to-blue-600 py-1 text-[10px] font-black text-white transition active:scale-95"
                              >
                                {sc.cost.toLocaleString("id-ID")} Sacret
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------- kartu perayaan tetasan ------------------ */}
      <AnimatePresence>
        {hatched && (
          <motion.button
            type="button"
            onClick={() => setHatched(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.4, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className={cn(
                "flex w-56 flex-col items-center gap-1 rounded-3xl border border-white/20 bg-background p-5",
                RARITY_STYLE[hatched.rarity].glow,
              )}
            >
              <motion.span
                animate={{ rotate: [-6, 6, -6] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="block size-20"
              >
                <PetArt petId={hatched.petId} />
              </motion.span>
              <p className="text-base font-black">{hatched.name}</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black",
                  RARITY_STYLE[hatched.rarity].chip,
                )}
              >
                {hatched.rarity}
              </span>
              <p className="text-[10px] font-bold text-zinc-400">Ketuk untuk menutup</p>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Rute /yorupet — versi penuh dengan AppLayout (jika dipakai langsung). */
export default YoruPetScreen;
