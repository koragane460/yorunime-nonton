// YoruNime — LIKE / DISLIKE KARAKTER (pengganti sistem vote token).
//
// Setiap kartu karakter punya tombol 👍 like dan 👎 dislike:
//  * satu akun hanya punya satu reaksi per karakter (like ⇄ dislike ⇄ lepas),
//  * angka like/dislike live dari `api.reactions.stats`,
//  * tidak ada token, tidak ada saldo — bebas menekan sesuka hati.
//
// Dipakai tab "Like" di layar detail anime (dan donghua lewat judul).
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type LikeChar = { id: string; name: string; image?: string };

/** Kunci reaksi stabil untuk karakter anime/donghua. */
export function charKey(scope: string, charId: string) {
  return `char:${scope}:${charId}`.slice(0, 200);
}

/** Baris like/dislike KOMPAK untuk satu kartu karakter (CharacterRow). */
export function LikeButtons({
  keys,
  meta,
}: {
  /** [key, nama, gambar, label anime] per karakter — untuk update optimis. */
  keys: { key: string; name: string; image?: string; label?: string }[];
}) {
  const stats = useQuery(
    api.reactions.stats,
    keys.length ? { keys: keys.map((k) => k.key) } : "skip",
  );
  const setReaction = useMutation(api.reactions.set);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const label = meta ?? "";

  const react = async (key: string, dir: 1 | -1, cur: 0 | 1 | -1) => {
    if (busyKey) return;
    const found = keys.find((k) => k.key === key);
    setBusyKey(key);
    try {
      await setReaction({
        key,
        // Tekan lagi reaksi yang sama = lepas reaksi.
        dir: cur === dir ? 0 : dir,
        name: found?.name,
        image: found?.image,
        label: found?.label ?? label,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {keys.map((k) => {
        const s = stats?.[k.key] ?? { likes: 0, dislikes: 0, mine: 0 as const };
        const busy = busyKey === k.key;
        return (
          <span key={k.key} className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void react(k.key, 1, s.mine)}
              aria-label={`Like ${k.name}`}
              aria-pressed={s.mine === 1}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition active:scale-90 disabled:opacity-50",
                s.mine === 1
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "text-muted-foreground hover:bg-white/10",
              )}
            >
              <ThumbsUp
                className={cn("size-3", s.mine === 1 && "fill-emerald-300")}
              />
              {s.likes}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void react(k.key, -1, s.mine)}
              aria-label={`Dislike ${k.name}`}
              aria-pressed={s.mine === -1}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition active:scale-90 disabled:opacity-50",
                s.mine === -1
                  ? "bg-red-400/20 text-red-300"
                  : "text-muted-foreground hover:bg-white/10",
              )}
            >
              <ThumbsDown
                className={cn("size-3", s.mine === -1 && "fill-red-300")}
              />
              {s.dislikes}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Grid karakter + like/dislike besar — isi tab "Like" di detail anime.
 * Kartu masuk satu per satu (streak), reaksi aktif berdenyut lembut.
 */
export function CharacterLikes({
  scope,
  title,
  chars,
}: {
  /** Scope reaksi — id anime/donghua (menjaga kunci sama antar layar). */
  scope: string;
  title: string;
  chars: LikeChar[];
}) {
  const keys = useMemo(
    () => chars.map((c) => charKey(scope, c.id)),
    [chars, scope],
  );
  const stats = useQuery(
    api.reactions.stats,
    keys.length ? { keys } : "skip",
  );
  const setReaction = useMutation(api.reactions.set);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Kartu diurut dari like terbanyak — posisi berubah live saat ada yang like.
  const sorted = useMemo(() => {
    return chars
      .map((c) => {
        const key = charKey(scope, c.id);
        const s = stats?.[key] ?? { likes: 0, dislikes: 0, mine: 0 as const };
        return { ...c, key, ...s, score: s.likes - s.dislikes };
      })
      .sort((a, b) => b.score - a.score);
  }, [chars, scope, stats]);

  const react = async (c: (typeof sorted)[number], dir: 1 | -1) => {
    if (busyKey) return;
    setBusyKey(c.key);
    try {
      await setReaction({
        key: c.key,
        dir: c.mine === dir ? 0 : dir,
        name: c.name,
        image: c.image,
        label: title,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusyKey(null);
    }
  };

  if (chars.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        Karakter belum termuat — buka ulang layar ini sebentar lagi.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {sorted.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 45, 380), duration: 0.28 }}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white/[0.04] transition",
            c.mine === 1
              ? "border-emerald-400/60 shadow-[0_0_20px_-6px_rgba(52,211,153,0.8)]"
              : c.mine === -1
                ? "border-red-400/50 shadow-[0_0_20px_-6px_rgba(248,113,113,0.7)]"
                : "border-white/12",
          )}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
            {c.image ? (
              <img
                src={c.image}
                alt={c.name}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-3xl">
                🎭
              </div>
            )}
            {/* Skor like net di pojok — dasar urutan kartu. */}
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-sm">
              {c.score > 0 ? `+${c.score}` : c.score}
            </span>
          </div>
          <p className="truncate px-2 pt-1.5 text-[11px] font-semibold text-white">
            {c.name}
          </p>
          {/* Dua tombol besar: Like (hijau) & Dislike (merah). */}
          <div className="flex gap-1.5 p-1.5">
            <motion.button
              type="button"
              disabled={busyKey === c.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => void react(c, 1)}
              aria-label={`Like ${c.name}`}
              aria-pressed={c.mine === 1}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-black transition disabled:opacity-50",
                c.mine === 1
                  ? "bg-emerald-400/25 text-emerald-200"
                  : "bg-white/[0.06] text-muted-foreground hover:bg-emerald-400/15 hover:text-emerald-200",
              )}
            >
              <ThumbsUp
                className={cn("size-3.5", c.mine === 1 && "fill-emerald-300")}
              />
              {c.likes.toLocaleString("id-ID")}
            </motion.button>
            <motion.button
              type="button"
              disabled={busyKey === c.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => void react(c, -1)}
              aria-label={`Dislike ${c.name}`}
              aria-pressed={c.mine === -1}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-black transition disabled:opacity-50",
                c.mine === -1
                  ? "bg-red-400/25 text-red-200"
                  : "bg-white/[0.06] text-muted-foreground hover:bg-red-400/15 hover:text-red-200",
              )}
            >
              <ThumbsDown
                className={cn("size-3.5", c.mine === -1 && "fill-red-300")}
              />
              {c.dislikes.toLocaleString("id-ID")}
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
