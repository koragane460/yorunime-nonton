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
import {
  ChevronLeft,
  Egg,
  BookOpen,
  Coins,
  Gift,
  Mountain,
  Settings2,
  Sparkles,
} from "lucide-react";
import { StripBackIcon } from "@/components/StripBack";
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
import type { Id } from "@/convex/_generated/dataModel";

/** Isi sheet bawah — Kelola (telur + pet) / Index / Scene. Tiap tombol di
    bawah punya isi sendiri, TANPA baris tab di atas (permintaan pemilik). */
type SheetTab = "kelola" | "index" | "scene";

/** Peringkat rarity — dipakai tombol "Auto equip best pet". */
const RARITY_RANK: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Divine: 4,
  Tetrix: 5,
};

/** Format hitungan mundur klaim 24 jam jadi "7j 12m 03d". */
function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}j ${pad(m)}m ${pad(sec)}d` : `${pad(m)}m ${pad(sec)}d`;
}

export function YoruPetScreen({
  onBack,
  viewUserId,
}: {
  onBack: () => void;
  /** Mode lihat: kebun binatang user LAIN (dari detail akun → YoruPet).
      Data dari api.pets.view, semua tombol aksi disembunyikan. */
  viewUserId?: Id<"users">;
}) {
  const isView = !!viewUserId;
  const ownState = useQuery(api.pets.state, viewUserId ? "skip" : {});
  const viewState = useQuery(api.pets.view, viewUserId ? { userId: viewUserId } : "skip");
  // Samakan bentuk data mode view dengan state supaya seluruh render tetap
  // berjalan — hanya tampilan, tanpa klaim/gacha/klaim Sacret.
  const state = isView
    ? viewState && {
        ...viewState,
        sacret: 0,
        eggs: 0,
        claimReady: false,
        claimIn: 0,
      }
    : ownState;
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
  /** POPUP GACHA — berisi telur + tombol Gacha 1× / 10×. */
  const [gachaOpen, setGachaOpen] = useState(false);
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
  /** SEMUA pet yang dipasang — boleh 1 sampai 10 sekaligus (permintaan). */
  const equippedList =
    state?.equippedList ?? (equipped ? [equipped] : []);
  /** Total klaim 24 jam semua pet terpasang + boost scene aktif. */
  const claimTotal = state?.claimTotal ?? (equipped?.claim ?? 0);
  const boost = state?.boost ?? 0;
  const claimReady = equippedList.length > 0 && !!state?.claimReady;
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
      setGachaOpen(false);
      setSheet("kelola");
      toast.success(count === 1 ? "Dapat 1 Telur Misteri!" : "Dapat 10 Telur Misteri!");
    });

  /** Auto equip pet TERBAIK — bukan cuma satu: pasang semua pet terbaik
      (urut rarity, lalu klaim), maksimal 10 (permintaan "equip best"). */
  const autoEquipBest = () => {
    const owned = state?.owned ?? [];
    if (owned.length === 0) {
      toast.error("Belum punya pet — gacha dulu ya");
      return;
    }
    const sorted = [...owned]
      .sort(
        (a, b) =>
          (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) ||
          (b.claim ?? 0) - (a.claim ?? 0),
      )
      .slice(0, 10);
    const already = equippedList.length;
    void run(async () => {
      for (const p of sorted) await equipM({ uid: p.uid });
      toast.success(`Auto equip ${sorted.length} pet terbaik (${already}/${sorted.length} sebelumnya)`);
    });
  };

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

  /** Klaim Sacret SATU pet — tiap pet punya jeda 24 jam sendiri. */
  const doClaim = (uid: string) =>
    void run(async () => {
      const r = await claimM({ uid });
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
        >
          {/* Scene dgn foto asli → gambar beneran, bukan gradien HTML. */}
          {scene.image && (
            <img
              src={scene.image}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {/* Lapisan tekstur — grain film (feTurbulence) + titik rapat +
              scanline + arsir diagonal + vignette: permukaan scene jadi
              bertekstur, bukan mulus/plastik. Filter SVG digambar sekali
              (elemen statis), bukan tiap frame, jadi tidak menambah beban. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full opacity-30 mix-blend-overlay"
          >
            <filter id="yn-scene-noise">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#yn-scene-noise)" />
          </svg>
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1.2px)] opacity-60 mix-blend-overlay [background-size:9px_9px]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.24)_1px,transparent_1.1px)] opacity-70 [background-size:11px_11px] [background-position:4px_5px]"
          />
          <span
            aria-hidden
            className="absolute inset-0 opacity-70 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.16)_0px,rgba(0,0,0,0.16)_1px,transparent_1px,transparent_3px)]"
          />
          <span
            aria-hidden
            className="absolute inset-0 opacity-40 mix-blend-soft-light bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_6px)]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]"
          />
        </motion.div>
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

      {/* debu/kilau melayang tambahan — scene jadi lebih ramai. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={`dust-${i}`}
            className="absolute animate-pulse rounded-full bg-white/70"
            style={{
              left: `${(i * 37) % 97}%`,
              top: `${6 + ((i * 53) % 88)}%`,
              width: i % 3 === 0 ? 4 : 2,
              height: i % 3 === 0 ? 4 : 2,
              animationDelay: `${(i % 7) * 0.45}s`,
              animationDuration: `${2.4 + (i % 5) * 0.7}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* ---------------------------- kepala -------------------------- */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 pt-3">
          <button
            onClick={onBack}
            aria-label="Kembali ke YoruVerse"
            className="flex shrink-0 items-center py-1 pr-1 text-white/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight">
              Kebun Binatang Milik{" "}
              <span className="font-black text-gold">{state.username}</span>
            </h1>
            <p className="text-[10px] text-zinc-300">
              {isView
                ? `🐾 ${state.owned.length} peliharaan`
                : `Telur ×${state.eggs} · Crystal ${state.crystals.toLocaleString("id-ID")}`}
            </p>
          </div>
          {!isView && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[12px] font-black text-gold backdrop-blur-sm">
              <Coins className="size-3.5" aria-hidden />
              {state.sacret.toLocaleString("id-ID")}
            </span>
          )}
        </div>

        {/* ----------------- panggung: TANPA KOTAK PEMBATAS ----------------
            Panggung punya LATAR SENDIRI (panel gelap) supaya TIDAK
            menyatu/bergantung ke background hutan di belakangnya —
            background hutan dan background tampilan dibuat BEDA. */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-4">
          {/* Panggung TANPA kotak pembatas — hanya background, pet
              berdiri langsung di atasnya (permintaan user). */}
          <div className="relative h-72 w-full max-w-2xl overflow-hidden">
            {/* Panggung transparan: TIDAK ada kotak/latar kedua di tengah —
                pet langsung berdiri di atas background kebun. */}
            {/* Sinar matahari/bulan — halus, tanpa glow menyilaukan. */}            <span
              aria-hidden
              className="absolute -right-10 -top-12 size-32 rounded-full bg-white/15 blur-2xl"
            />
            <span
              aria-hidden
              className="absolute left-1/2 top-4 size-36 -translate-x-1/2 rounded-full bg-gold/10 blur-2xl"
            />
            {/* Hiasan khas scene — dahan melengkung + detail beranimasi. */}
            <SceneDecor key={scene.id} id={scene.id} />

            {/* Partikel melayang DI DALAM panggung (lebih dekat ke pet). */}
            {particles.map((p, i) => (
              <motion.span
                key={`in-${i}`}
                className="absolute text-base opacity-60"
                style={{ left: `${(p.left + 11) % 92}%`, top: `${16 + (i % 3) * 24}%` }}
                animate={{ y: [0, -14, 0], rotate: [0, -14, 0] }}
                transition={{ duration: p.dur, repeat: Infinity, delay: p.delay }}
                aria-hidden
              >
                {scene.particle}
              </motion.span>
            ))}
            {/* pet berjalan + bubble klaim di atasnya */}
            {equipped ? (
              <motion.div
                className="absolute z-10"
                initial={false}
                animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                transition={{ duration: 2.4, ease: "easeInOut" }}
              >
                {/* bubble klaim: tipis, rounded penuh, hitung mundur 24 jam */}
                <div className={cn(
                  "absolute -top-10 left-1/2 w-max max-w-[160px] -translate-x-1/2",
                  isView && "hidden",
                )}>
                  {equipped.claimReady ? (
                    <button
                      onClick={() => doClaim(equipped.uid)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-black shadow-[0_0_16px_-4px_rgba(255,207,64,.9)] transition active:scale-95"
                    >
                      <Gift className="size-3" aria-hidden />
                      Klaim {((equipped.claim ?? 0) + boost).toLocaleString("id-ID")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-full border border-white/25 bg-black/55 px-2 py-0.5 text-center text-[10px] font-bold text-zinc-200 backdrop-blur-sm">
                      <Gift className="size-3 text-gold" aria-hidden />
                      {fmtLeft((equipped.claimIn ?? 0) - tick * 1000)}
                    </div>
                  )}
                </div>
                {/* ---- GAMBAR HEWAN BERBADAN (bukan emoji) — membesar,
                    melayang, dengan aura & panggung cahaya ---- */}
                <div className="relative flex flex-col items-center">
                  <motion.div
                    animate={{ scaleX: flip, y: [0, -7, 0] }}
                    transition={{
                      scaleX: { duration: 0.35 },
                      y: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
                    }}
                    // PET EQUIP TANPA kotak/latar: glow kotak di div ini
                    // dihapus (sumber bayangan kotak samar); aura bulat
                    // tetap dipakai lewat span di dalamnya.
                    className="relative size-24"
                  >
                    {/* Aura berdenyut di belakang pet. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -inset-2 rounded-full blur-xl",
                        equippedDef?.glow,
                      )}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PetArt petId={equipped.petId} />
                    </div>
                    {/* Kilau bintang kecil di sekitar pet. */}
                    <motion.span
                      aria-hidden
                      className="absolute -right-1 top-1 text-xs text-white"
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
                      transition={{ duration: 1.9, repeat: Infinity }}
                    >
                      ✦
                    </motion.span>
                    <motion.span
                      aria-hidden
                      className="absolute -left-2 bottom-3 text-[10px] text-gold"
                      animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 0.7, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: 0.6 }}
                    >
                      ✦
                    </motion.span>
                  </motion.div>

                  {/* Panggung cahaya + bayangan tanah. */}
                  <span
                    aria-hidden
                    className="-mt-1 h-3 w-16 rounded-[50%] bg-black/55 blur-[3px]"
                  />
                  <span
                    aria-hidden
                    className="-mt-1.5 h-5 w-24 rounded-[50%] bg-gold/25 blur-md"
                  />
                </div>
              </motion.div>
            ) : null}

            {/* SEMUA PET YANG DI-EQUIP ikut tampil di kebun — bukan cuma
                yang pertama. Posisi tersebar supaya tidak menumpuk. */}
            {equippedList.slice(1).map((p, i) => {
              const slots = [
                { left: 16, top: 56 },
                { left: 70, top: 50 },
                { left: 30, top: 34 },
                { left: 60, top: 70 },
                { left: 12, top: 30 },
                { left: 82, top: 32 },
                { left: 44, top: 22 },
                { left: 26, top: 74 },
                { left: 74, top: 74 },
              ];
              const slot = slots[i % slots.length];
              return (
                <motion.div
                  key={p.uid}
                  className="absolute z-[9]"
                  style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 2.6 + (i % 3) * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                >
                  {/* Klaim Sacret sendiri-sendiri per pet. */}
                  {!isView && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      {p.claimReady ? (
                        <button
                          onClick={() => doClaim(p.uid)}
                          disabled={busy}
                          className="flex items-center gap-1 whitespace-nowrap rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-black"
                        >
                          <Gift className="size-2.5" /> Klaim
                        </button>
                      ) : (
                        <span className="flex items-center gap-0.5 whitespace-nowrap rounded-full bg-black/55 px-1.5 py-0.5 text-[8.5px] font-bold text-zinc-300">
                          <Gift className="size-2.5 text-gold" />
                          {fmtLeft((p.claimIn ?? 0) - tick * 1000)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={cn("relative size-12 sm:size-14", RARITY_STYLE[p.rarity as PetRarity]?.glow)}>
                    <PetArt petId={p.petId} />
                  </div>
                  <span className="mx-auto mt-0.5 block h-1.5 w-8 rounded-[50%] bg-black/45 blur-[2px]" />
                </motion.div>
              );
            })}

            {equippedList.length === 0 && (
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
          {isView ? (
            <p className="mx-auto w-fit rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-center text-[11px] font-bold text-zinc-200 backdrop-blur-sm">
              Melihat kebun milik {state.username} 🐾
            </p>
          ) : (
          <div className="flex items-stretch gap-2">
            {/* GACHA — SATU tombol, buka POPUP (telur + 1× / 10×). */}
            <button
              onClick={() => setGachaOpen(true)}
              disabled={busy}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 py-3 text-black shadow-[0_10px_22px_-10px_rgba(245,158,11,.9)] transition active:scale-[0.97] disabled:opacity-60"
            >
              <Egg className="size-5" aria-hidden />
              <span className="mt-0.5 block text-[12px] font-black leading-tight">Gacha</span>
              <span className="block text-[9px] font-bold opacity-80">1× / 10×</span>
            </button>
            {/* KELOLA — sheet berisi telur, pet, pet terpakai, auto equip. */}
            <button
              onClick={() => setSheet("kelola")}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-violet-400 to-violet-700 py-3 text-white shadow-[0_10px_22px_-10px_rgba(139,92,246,.9)] transition active:scale-[0.97]"
            >
              <Settings2 className="size-5" aria-hidden />
              <span className="mt-0.5 block text-[12px] font-black leading-tight">Kelola</span>
              <span className="block text-[9px] font-bold opacity-80">telur · pet</span>
            </button>
            {/* INDEX — kotak MENDEKATI PERSEGI (tidak memanjang ke samping). */}
            <button
              onClick={() => setSheet("index")}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-zinc-500 to-zinc-700 py-3 text-white shadow-[0_10px_22px_-10px_rgba(0,0,0,.9)] transition active:scale-[0.97]"
            >
              <BookOpen className="size-5" aria-hidden />
              <span className="mt-0.5 block text-[12px] font-black leading-tight">Index</span>
              <span className="block text-[9px] font-bold opacity-80">{PETS.length} pet</span>
            </button>
            {/* SCENE — ganti tampilan background kebun. */}
            <button
              onClick={() => setSheet("scene")}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-teal-400 to-emerald-700 py-3 text-black shadow-[0_10px_22px_-10px_rgba(16,185,129,.85)] transition active:scale-[0.97]"
            >
              <Mountain className="size-5" aria-hidden />
              <span className="mt-0.5 block text-[12px] font-black leading-tight">Scene</span>
              <span className="block text-[9px] font-bold opacity-80">ganti latar</span>
            </button>
          </div>
          )}
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

              <div className="mt-3">
                {/* ----------------- KELOLA (telur + pet terpakai + auto) --- */}
                {sheet === "kelola" && (
                  <div className="space-y-2.5">
                    {/* Telur */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black">
                          🥚 Telur <span className="text-gold">×{state.eggs}</span>
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={doHatch}
                            disabled={busy || state.eggs < 1}
                            className="rounded-xl bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-50"
                          >
                            Tetas 1
                          </button>
                          <button
                            onClick={() =>
                              void run(async () => {
                            const r = await hatchAllM({});
                            setSheet("kelola");
                                toast.success(`Menetas ${r.count} telur!`);
                              })
                            }
                            disabled={busy || state.eggs < 1}
                            className="rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-50"
                          >
                            Tetas Semua
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pet yang dipakai + Auto equip best */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                          Pet yang dipakai
                        </p>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white">
                          {equippedList.length}/10
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2.5">
                        {equipped ? (
                          <>
                            {/* Foto pet pertama + tumpukan pet lain (max 10). */}
                            <span className="flex shrink-0 -space-x-2">
                              {equippedList.slice(0, 5).map((p) => (
                                <span
                                  key={p.uid}
                                  className={cn(
                                    "flex size-11 items-center justify-center rounded-full bg-white/10 p-0.5 ring-2 ring-black/40",
                                    RARITY_STYLE[p.rarity as PetRarity]?.glow,
                                  )}
                                >
                                  <PetArt petId={p.petId} />
                                </span>
                              ))}
                              {equippedList.length > 5 && (
                                <span className="flex size-11 items-center justify-center rounded-full bg-black/70 text-[10px] font-black ring-2 ring-black/40">
                                  +{equippedList.length - 5}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">
                                {equipped.name}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-black",
                                  RARITY_STYLE[equipped.rarity as PetRarity]?.chip,
                                )}
                              >
                                {equipped.rarity}
                              </span>
                            </span>
                          </>
                        ) : (
                          <p className="flex-1 text-xs font-bold text-zinc-400">
                            Belum ada pet yang dipasang
                          </p>
                        )}
                        <button
                          onClick={autoEquipBest}
                          disabled={busy}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-2 text-[11px] font-black text-black transition active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className="size-3.5" aria-hidden />
                          Auto equip best
                        </button>
                      </div>
                      {boost > 0 && (
                        <p className="mt-2 text-[10px] font-bold text-emerald-300">
                          Scene {scene.name}: +{boost} Sacret per pet
                          {claimTotal > 0 && ` · total klaim ${claimTotal.toLocaleString("id-ID")} Sacret`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------- PET (list + jual) ---------- */}
                {sheet === "kelola" &&
                  (state.owned.length === 0 ? (
                    <p className="py-8 text-center text-xs font-bold text-zinc-400">
                      Belum punya pet — gacha lalu tetas telurnya! 🥚
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {state.owned.map((o) => {
                        const st = RARITY_STYLE[o.rarity as PetRarity];
                        const on = equippedList.some((p) => p.uid === o.uid);
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
                                    // Toggle per pet — boleh pasang banyak
                                    // sekaligus (maks 10), tidak terkunci 1.
                                    if (on) await unequipM({ uid: o.uid });
                                    else {
                                      await equipM({ uid: o.uid });
                                      toast.success(`${o.name} equip! (${equippedList.length + 1}/10)`);
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
                          <div className={cn("relative flex h-16 items-center justify-center overflow-hidden bg-gradient-to-b text-2xl", sc.sky)}>
                            <SceneDecor id={sc.id} />
                            <span className="relative">{sc.emoji}</span>
                          </div>
                          <div className="p-2">
                            <p className="text-[11px] font-black">{sc.name}</p>
                            {/* BOOST scene — nambah ke klaim TIAP pet. */}
                            <p
                              className={cn(
                                "mt-0.5 text-[9px] font-black",
                                sc.boost > 0 ? "text-emerald-300" : "text-zinc-400",
                              )}
                            >
                              {sc.boost > 0 ? `+${sc.boost} Sacret/pet` : "Tanpa boost"}
                            </p>
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

      {/* -------------------- POPUP GACHA (telur + 1× / 10×) ---------- */}
      <AnimatePresence>
        {gachaOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setGachaOpen(false)}
            className="fixed inset-0 z-[78] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-3xl border border-white/20 bg-background p-5 text-center"
            >
              <motion.div
                animate={{ rotate: [-4, 4, -4] }}
                transition={{ duration: 2.6, repeat: Infinity }}
                className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/10 text-5xl ring-1 ring-white/20"
              >
                🥚
              </motion.div>
              <p className="mt-2.5 text-sm font-black">
                Telur Misteri <span className="text-gold">×{state?.eggs ?? 0}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => doGacha(1)}
                  disabled={busy}
                  className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600 py-2.5 text-black transition active:scale-[0.97] disabled:opacity-60"
                >
                  <Egg className="mx-auto size-4" aria-hidden />
                  <span className="mt-0.5 block text-[11px] font-black leading-tight">Gacha 1×</span>
                  <span className="block text-[9px] font-bold opacity-80">
                    {state && !(state as any).freeEggUsed
                      ? "GRATIS · pertama kali"
                      : `${GACHA_X1.toLocaleString("id-ID")} Sacret`}
                  </span>
                </button>
                <button
                  onClick={() => doGacha(10)}
                  disabled={busy}
                  className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-600 py-2.5 text-black transition active:scale-[0.97] disabled:opacity-60"
                >
                  <Egg className="mx-auto size-4" aria-hidden />
                  <span className="mt-0.5 block text-[11px] font-black leading-tight">Gacha 10×</span>
                  <span className="block text-[9px] font-bold opacity-80">
                    {GACHA_X10.toLocaleString("id-ID")} Sacret
                  </span>
                </button>
              </div>
              <button
                onClick={() => setGachaOpen(false)}
                className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.06] py-2 text-[11px] font-black text-zinc-300 transition active:scale-[0.98]"
              >
                Tutup
              </button>
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
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
          >
            {/* Kartu hasil tetas — minimalis: tanpa glow ramai / rotasi loop. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-56 rounded-3xl border border-white/10 bg-[#0d1017] p-5 text-center"
            >
              <span className="mx-auto block size-24">
                <PetArt petId={hatched.petId} />
              </span>
              <p className="mt-1 text-lg font-black leading-tight text-white">
                {hatched.name}
              </p>
              <span
                className={cn(
                  "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-black",
                  RARITY_STYLE[hatched.rarity].chip,
                )}
              >
                {hatched.rarity}
              </span>
              <span aria-hidden className="mt-4 block h-px w-full bg-white/10" />
              <p className="mt-2.5 text-[10px] font-medium text-white/40">
                Ketuk untuk menutup
              </p>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * HIASAN KHAS SCENE — dahan & detail MELENGKUNG (bukan kotak lurus),
 * muncul dengan animasi path-draw / mekar. Tanpa glow berlebih.
 */
function SceneDecor({ id }: { id: string }) {
  const wrap = "pointer-events-none absolute inset-0 h-full w-full";
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.8 },
  } as const;

  if (id === "sakura") {
    const blossoms: [number, number][] = [
      [96, 54],
      [146, 44],
      [176, 86],
      [210, 122],
      [232, 152],
      [278, 64],
      [322, 48],
      [178, 28],
      [302, 86],
      [42, 46],
    ];
    return (
      <motion.svg
        {...fade}
        className={cn(wrap, "overflow-hidden")}
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {/* Dahan melengkung — digambar bertahap (path draw), bukan garis lurus */}
        <motion.path d="M-8 34 C 64 50, 116 40, 172 84" stroke="#5d4347" strokeWidth="5" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
        <motion.path d="M172 84 C 202 106, 214 132, 228 154" stroke="#5d4347" strokeWidth="3" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.5 }} />
        <motion.path d="M114 48 C 132 26, 158 22, 184 28" stroke="#6b4a4f" strokeWidth="3" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.35 }} />
        <motion.path d="M408 26 C 330 40, 282 56, 252 92" stroke="#5d4347" strokeWidth="4" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.25 }} />
        <motion.path d="M322 44 C 300 66, 300 78, 306 94" stroke="#6b4a4f" strokeWidth="2.5" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.7 }} />
        {/* Bunga mekar berjenjang — pop kecil satu per satu */}
        {blossoms.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={5}
            fill={i % 2 ? "#ffd7e4" : "#ffb7cf"}
            style={{ transformOrigin: `${x}px ${y}px` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.08, type: "spring", bounce: 0.55 }}
          />
        ))}
        {/* Kelopak jatuh pelan */}
        {[130, 210, 300].map((x, i) => (
          <motion.g
            key={`f${i}`}
            initial={{ y: 70, opacity: 0.85 }}
            animate={{ y: 230, opacity: 0.1 }}
            transition={{ duration: 4.5 + i, repeat: Infinity, delay: i * 1.3, ease: "easeIn" }}
          >
            <circle cx={x} cy={0} r={3} fill="#ffd7e4" />
          </motion.g>
        ))}
      </motion.svg>
    );
  }

  if (id === "galaxy") {
    const stars: [number, number][] = [
      [40, 40], [110, 80], [190, 30], [260, 70], [330, 45], [370, 110],
      [70, 140], [220, 130], [300, 170], [140, 190], [250, 210], [60, 220],
    ];
    return (
      <motion.svg {...fade} className={wrap} viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden>
        {stars.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={i % 3 ? 1.6 : 2.4}
            fill="#e9d5ff"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.6 + (i % 4) * 0.3, repeat: Infinity, delay: i * 0.22 }}
          />
        ))}
        {/* Jejak meteor melengkung */}
        <motion.path
          d="M340 20 C 300 50, 250 70, 200 78"
          stroke="#f5d0fe"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.9, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.5, delay: 1.2 }}
        />
      </motion.svg>
    );
  }

  if (id === "laut") {
    return (
      <motion.svg {...fade} className={wrap} viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden>
        {/* Rumput laut melengkung tumbuh dari dasar */}
        <g stroke="#34d399" fill="none" strokeLinecap="round" opacity="0.55">
          <motion.path d="M24 260 C 6 220, 44 190, 20 150" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
          <motion.path d="M56 260 C 74 226, 40 198, 62 164" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.2 }} />
          <motion.path d="M374 260 C 392 224, 356 196, 380 158" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.35 }} />
        </g>
        {/* Gelembung naik */}
        {[0, 1, 2].map((i) => (
          <motion.g
            key={i}
            initial={{ y: 0, opacity: 0.7 }}
            animate={{ y: -150, opacity: 0 }}
            transition={{ duration: 5 + i * 1.4, repeat: Infinity, delay: i * 1.6, ease: "linear" }}
          >
            <circle cx={300 + i * 24} cy={240} r={3 + i} fill="none" stroke="#bae6fd" strokeWidth="1.5" />
          </motion.g>
        ))}
      </motion.svg>
    );
  }

  if (id === "senja") {
    return (
      <motion.svg {...fade} className={wrap} viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden>
        {/* Siluet burung terbang melengkung melintas */}
        <motion.g
          stroke="#312e81"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 220, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        >
          <path d="M40 60 q 8 -8 16 0 q 8 -8 16 0" />
        </motion.g>
        <motion.g
          stroke="#312e81"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 200, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 20, repeat: Infinity, delay: 4, ease: "linear" }}
        >
          <path d="M70 96 q 6 -6 12 0 q 6 -6 12 0" />
        </motion.g>
      </motion.svg>
    );
  }

  if (id === "abyss") {
    const arcs = [
      { d: "M80 170 C 110 120, 290 120, 320 170", w: 2, delay: 0 },
      { d: "M120 190 C 150 156, 250 156, 280 190", w: 1.6, delay: 0.3 },
      { d: "M158 208 C 178 190, 222 190, 242 208", w: 1.3, delay: 0.6 },
    ];
    return (
      <motion.svg {...fade} className={wrap} viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden>
        {arcs.map((a, i) => (
          <motion.path
            key={i}
            d={a.d}
            stroke="#a78bfa"
            strokeWidth={a.w}
            fill="none"
            strokeLinecap="round"
            opacity="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: a.delay, ease: "easeInOut" }}
          />
        ))}
      </motion.svg>
    );
  }

  // hutan (default) — ranting melengkung + daun di dua sudut.
  return (
    <motion.svg {...fade} className={wrap} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <motion.path d="M-6 22 C 60 40, 96 66, 120 110" stroke="#14532d" strokeWidth="5" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      <motion.path d="M406 26 C 344 44, 316 74, 300 116" stroke="#14532d" strokeWidth="4" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
      {([[70, 52], [104, 76], [118, 104], [340, 54], [316, 84], [304, 112]] as [number, number][]).map(([x, y], i) => (
        <motion.ellipse
          key={i}
          cx={x}
          cy={y}
          rx={7}
          ry={4}
          fill={i % 2 ? "#4ade80" : "#22c55e"}
          style={{ transformOrigin: `${x}px ${y}px` }}
          initial={{ scale: 0, opacity: 0, rotate: i * 27 }}
          animate={{ scale: 1, opacity: 0.85, rotate: i * 27 }}
          transition={{ delay: 0.7 + i * 0.1, type: "spring", bounce: 0.5 }}
        />
      ))}
    </motion.svg>
  );
}

/** Rute /yorupet — versi penuh dengan AppLayout (jika dipakai langsung). */
export default YoruPetScreen;
