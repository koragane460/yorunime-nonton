// YoruNime — Layar LIKE karakter (pengganti tombol Vote di detail anime).
//
// Tiap karakter punya tombol LIKE (jempol ke atas) dan DISLIKE (jempol ke
// bawah). Menekan tombol yang sama = batal; menekan tombol lain = pindah.
// Semua karakter dari anime ini ditampilkan dalam grid kartu foto.
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ImageOff, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CharT = { id: string; name: string; image: string };

export function VoteScreen({
  animeId,
  animeTitle,
  chars,
}: {
  animeId: string;
  animeTitle: string;
  chars: CharT[];
}) {
  void animeTitle;
  const board = useQuery(api.characterLikes.board, { animeId });
  const react = useMutation(api.characterLikes.react);

  const items = board?.items ?? [];
  const loggedIn = board?.loggedIn ?? false;
  const busyFor = useRef<string | null>(null);

  // Karakter yang belum punya baris like tetap ditampilkan (angka 0). Gabung
  // data karakter dari AniList dengan papan like supaya tidak ada karakter
  // yang hilang hanya karena belum ada yang men-like.
  const merged = (() => {
    const map = new Map<string, (typeof items)[number]>();
    for (const it of items)
      map.set(it.characterId, it);
    for (const c of chars) {
      if (!c?.id) continue;
      if (!map.has(c.id))
        map.set(c.id, {
          characterId: c.id,
          name: c.name,
          image: c.image,
          likes: 0,
          dislikes: 0,
          score: 0,
          mine: 0,
        });
    }
    return [...map.values()];
  })();

  const doReact = async (c: (typeof items)[number], value: 1 | -1) => {
    if (!loggedIn) {
      toast.error("Masuk akun dulu untuk memberi Like");
      return;
    }
    if (busyFor.current) return;
    busyFor.current = c.characterId;
    const optimistic = c.mine === value ? 0 : value;
    void optimistic;
    try {
      const r = await react({
        animeId,
        characterId: c.characterId,
        name: c.name,
        image: c.image || undefined,
        value,
      });
      if (r.value === 0) toast.success(`Batal ${value === 1 ? "like" : "dislike"} ${c.name}`);
      else
        toast.success(
          `${value === 1 ? "Like" : "Dislike"} ${c.name}!`,
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      busyFor.current = null;
    }
  };

  if (merged.length === 0)
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        Karakter belum termuat — buka ulang layar ini sebentar lagi.
      </p>
    );

  return (
    <div className="pb-6 pt-1">
      {/* Grid karakter — HANYA foto, nama, dan tombol like/dislike (baris
          total Like/Dislike di atas & teks panduan dihapus sesuai permintaan).
          Warna lembut, tanpa glow neon. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {merged.map((c, i) => {
          const liked = c.mine === 1;
          const disliked = c.mine === -1;
          return (
            <motion.div
              key={c.characterId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 50, 400), duration: 0.28 }}
              className={cn(
                "group overflow-hidden rounded-2xl border transition",
                liked
                  ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                  : disliked
                    ? "border-rose-400/45 bg-rose-500/[0.08]"
                    : "border-white/10 bg-white/[0.03]",
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
                    <ImageOff className="size-6 text-muted-foreground" aria-hidden />
                  </div>
                )}
                {/* Badge Like/Dislike yang aktif di pojok foto — lembut,
                    tanpa pulse neon */}
                {liked && (
                  <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow">
                    <ThumbsUp className="size-3.5" aria-hidden />
                  </span>
                )}
                {disliked && (
                  <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-rose-500/90 text-white shadow">
                    <ThumbsDown className="size-3.5" aria-hidden />
                  </span>
                )}
              </div>

              {/* Nama karakter */}
              <p className="truncate px-2 pt-1.5 text-[11px] font-semibold text-white">
                {c.name}
              </p>

              {/* Dua tombol Like & Dislike — tinggi tetap, tidak melebar */}
              <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1">
                <button
                  onClick={() => void doReact(c, 1)}
                  className={cn(
                    "flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition active:scale-95",
                    liked
                      ? "bg-emerald-600 text-white"
                      : "bg-white/[0.05] text-emerald-200/80 hover:bg-emerald-500/15",
                  )}
                  aria-label={`Like ${c.name}`}
                >
                  <ThumbsUp className={cn("size-3.5", liked && "fill-current")} aria-hidden />
                  {c.likes.toLocaleString("id-ID")}
                </button>
                <button
                  onClick={() => void doReact(c, -1)}
                  className={cn(
                    "flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition active:scale-95",
                    disliked
                      ? "bg-rose-500 text-white"
                      : "bg-white/[0.05] text-rose-200/80 hover:bg-rose-500/15",
                  )}
                  aria-label={`Dislike ${c.name}`}
                >
                  <ThumbsDown className={cn("size-3.5", disliked && "fill-current")} aria-hidden />
                  {c.dislikes.toLocaleString("id-ID")}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
