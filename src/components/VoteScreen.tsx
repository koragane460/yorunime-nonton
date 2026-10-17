// YoruNime — Layar VOTE (menggantikan tombol Cuplikan di detail anime).
// Tiga keadaan: belum dimulai (terpusat) · berjalan 7 hari · selesai.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Vote as VoteIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VoteEndedScreen, VoteNotStartedScreen } from "@/components/VoteLockedScreens";

type CharT = { id: string; name: string; image: string };
/** Nominal T-V yang bisa dipilih (plus tombol "Semua"). */
const NOMINALS = [2, 10, 25, 50];

export function VoteScreen({
  animeId,
  animeTitle,
  chars,
}: {
  animeId: string;
  animeTitle: string;
  chars: CharT[];
}) {
  const status = useQuery(api.votes.status, {});
  const board = useQuery(
    api.votes.board,
    status?.state === "active" ? { animeId } : "skip",
  );
  const ensureCandidates = useMutation(api.votes.ensureCandidates);
  const castVote = useMutation(api.votes.castVote);

  const [picked, setPicked] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(2);
  const [busy, setBusy] = useState(false);
  const ensuredFor = useRef<string | null>(null);

  const state = status?.state ?? "none";

  // Selama event berjalan, daftarkan karakter anime INI sebagai kandidat —
  // sekali per anime (server mengabaikan yang sudah ada).
  useEffect(() => {
    if (state !== "active" || !chars.length) return;
    if (ensuredFor.current === animeId) return;
    ensuredFor.current = animeId;
    void ensureCandidates({
      animeId,
      animeTitle,
      characters: chars.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image || undefined,
      })),
    }).catch(() => {
      ensuredFor.current = null;
    });
  }, [state, chars, animeId, animeTitle, ensureCandidates]);

  const tokens = board?.tokens ?? null;
  const balance = tokens?.balance ?? 0;
  const items = board?.items ?? [];
  /** Total vote semua kandidat — dasar menghitung bar perolehan. */
  const totalVotes = items.reduce((s, c) => s + (c.votes ?? 0), 0);
  const pickedItem = items.find((c) => c.characterId === picked) ?? null;
  // amount >= 999999 = pilihan "Semua"
  const nominal = amount >= 999999 ? balance : amount;
  const canVote = !!pickedItem && nominal > 0 && nominal <= balance && !busy;

  const doVote = async () => {
    if (!pickedItem) return;
    if (nominal <= 0) {
      toast.error("Token Vote masih 0 — nonton dulu ya (4 menit = 2 T-V)");
      return;
    }
    setBusy(true);
    try {
      await castVote({
        characterId: pickedItem.characterId,
        amount: nominal,
      });
      toast.success(`+${nominal} vote untuk ${pickedItem.name}!`);
      setPicked(null);
      setAmount(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal vote");
    } finally {
      setBusy(false);
    }
  };

  if (state === "none") return <VoteNotStartedScreen />;
  if (state === "ended") return <VoteEndedScreen />;

  const msLeft = status?.msLeft ?? 0;
  const days = Math.floor(msLeft / 86_400_000);
  const hours = Math.floor((msLeft % 86_400_000) / 3_600_000);

  return (
    <div className="pb-6">
      {/* Bar atas: sisa waktu + saldo Token Vote */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white">
          <Clock className="size-3.5 text-sky-300" aria-hidden />
          {days > 0 ? `${days} hari lagi` : `${hours} jam lagi`}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary">
          <VoteIcon className="size-3.5" aria-hidden />
          {balance.toLocaleString("id-ID")} T-V
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        4 menit nonton = 2 T-V · total kamu {tokens?.minutes ?? 0} menit
      </p>

      {/* Grid karakter anime ini — kartu masuk satu per satu (stagger),
          bar perolehan vote bergerak halus saat angkanya berubah. */}
      {items.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Karakter belum termuat — buka ulang layar ini sebentar lagi.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((c, i) => {
            const share =
              totalVotes > 0
                ? Math.max(3, Math.round((c.votes / totalVotes) * 100))
                : 0;
            const on = picked === c.characterId;
            return (
              <motion.button
                key={c.characterId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 50, 400), duration: 0.28 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPicked(on ? null : c.characterId)}
                className={cn(
                  "group overflow-hidden rounded-2xl border text-left transition",
                  on
                    ? "border-primary/70 bg-primary/10 shadow-[0_0_20px_-6px_var(--primary)]"
                    : "border-white/12 bg-white/[0.04] hover:border-white/25",
                )}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <VoteIcon className="size-6 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                    {c.votes.toLocaleString("id-ID")} vote
                  </span>
                  {on && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.1 }}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white"
                    >
                      <VoteIcon className="size-3" aria-hidden />
                    </motion.span>
                  )}
                </div>
                {/* Bar perolehan vote — mengisi proporsional, bergerak
                    halus (spring) saat angkanya berubah. */}
                <div className="h-1 w-full bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-gold"
                    initial={false}
                    animate={{ width: `${share}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-white">
                  {c.name}
                </p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Pilih nominal + tombol Vote — SLIDE naik dari bawah dengan spring
          saat karakter dipilih, dan turun lagi saat dibatalkan. */}
      <AnimatePresence>
      {pickedItem && (
        <motion.div
          key="nominal"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 26 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="sticky bottom-2 z-10 mt-4 rounded-2xl border border-white/15 bg-card/95 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center justify-between text-[11px]">
            <span className="min-w-0 truncate font-bold text-white">
              Vote untuk {pickedItem.name}
            </span>
            <span className="shrink-0 text-muted-foreground">
              Saldo {balance.toLocaleString("id-ID")} T-V
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {NOMINALS.map((n) => (
              <button
                key={n}
                onClick={() => setAmount(n)}
                disabled={n > balance}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-35",
                  amount === n
                    ? "border-primary bg-primary text-white"
                    : "border-white/20 bg-white/[0.05] text-white/85",
                )}
              >
                {n} T-V
              </button>
            ))}
            <button
              onClick={() => setAmount(999999)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                amount >= 999999
                  ? "border-primary bg-primary text-white"
                  : "border-white/20 bg-white/[0.05] text-white/85",
              )}
            >
              Semua ({balance.toLocaleString("id-ID")})
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => void doVote()}
            disabled={!canVote}
            className={cn(
              "mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white transition disabled:opacity-50",
              busy && "animate-pulse",
            )}
          >
            <VoteIcon className="size-4" aria-hidden />
            {busy ? "Mengirim…" : nominal > 0 ? `Vote ${nominal} T-V` : "Vote"}
          </motion.button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
