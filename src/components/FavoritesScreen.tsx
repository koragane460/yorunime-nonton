// LAYAR SUBSCRIBE (tombol "Subscribe" di navigasi bawah).
//
// Judul besar + garis, lalu SATU daftar gabungan semua kategori (tab
// Anime/Manga/Manhwa/Donghua/Film di atas DIHAPUS — permintaan user).
// Mode SINGLE = semua favorite tampil polos; mode FILTER = otomatis
// dikelompokkan Ongoing (dengan chip tipe anime/manga/manhwa/donghua)
// → garis pembatas → Completed, dua-duanya berjudul putih tanpa dot.
// Di bawahnya ada TOP VOTE CHARACTER (blok Download dipindah ke Catalog
// sesuai permintaan user).

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { ComicDetailScreen } from "@/components/ComicDetailScreen";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bookmark,
  ArrowUpDown,
  ChevronDown,
  Clapperboard,
  Crown,
  Heart,
  Plus,
  Tv,
  Vote as VoteIcon,
  X,
} from "lucide-react";

// Chip tipe anime/manga/manhwa/donghua DIHAPUS PERMANEN sesuai permintaan
// user — kelompok Ongoing menampilkan SEMUA tipe tanpa penyaring.

/**
 * Status tayang → kelompok Ongoing. Terima snapshot AniList (RELEASING),
 * label tampilan (Ongoing/Berjalan), maupun teks bebas sumber donghua —
 * asal bukan tamat/completed/movie/tv.
 */
function isOngoingStatus(s?: string): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  if (/(tamat|completed|selesai|finished|ended|end|movie|tv|hiatus)/.test(v)) {
    return false;
  }
  return /(releasing|ongoing|berjalan|airing|belum tamat|publishing|jalan)/.test(v);
}

/** Baris favorite anime/donghua/film (tabel animeFavorites). */
type AnimeRow = {
  _id: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  kind?: string;
  /** Snapshot status tayang — diisi & disegarkan oleh aksi refresh. */
  status?: string;
  createdAt: number;
};

/** Baris favorite manga/manhwa (tabel comicFavorites). */
type ComicRow = {
  _id: string;
  slug: string;
  comicTitle: string;
  comicImage?: string;
  kind: string;
  /** Masih berjalan atau sudah tamat — disegarkan oleh aksi refresh. */
  ongoing?: boolean;
  createdAt: number;
};

type SubRow = AnimeRow | ComicRow;

export function FavoritesScreen({ onClose: _onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const comicFavorites = useQuery(api.comics.myFavorites, user ? {} : "skip");
  const lists = useQuery(api.bookmarks.myLists, user ? {} : "skip") as
    | { _id: Id<"bookmarkLists">; name: string; count: number }[]
    | undefined;
  const createList = useMutation(api.bookmarks.createList);
  const [activeList, setActiveList] = useState<string>("default");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const playlistRows = useQuery(
    api.bookmarks.items,
    activeList !== "default" ? { listId: activeList as Id<"bookmarkLists"> } : "skip",
  ) as
    | {
        _id: string;
        itemId: string;
        title: string;
        image?: string;
        kind?: string;
        status?: string;
        createdAt: number;
      }[]
    | undefined;
  // Top 10 hasil voting karakter — hanya terisi setelah event (7 hari) selesai.
  const top = useQuery(api.votes.topCharacters, {});

  const [filter, setFilter] = useState<"all" | "ongoing" | "done">("all");
  const [sort, setSort] = useState<"baru" | "judul">("baru");
  // Detail manga/manhwa dibuka sebagai layar penuh (sama seperti di Baca).
  const [pick, setPick] = useState<{ slug: string; kind: "manga" | "manhwa" } | null>(
    null,
  );

  const animeRows = useMemo(
    () => (favorites ?? []) as AnimeRow[],
    [favorites],
  );
  const comicRows = useMemo(
    () => (comicFavorites ?? []) as ComicRow[],
    [comicFavorites],
  );

  // Segarkan status tayang yang kadaluarsa — favorite menyimpan snapshot,
  // jadi anime/komik yang kelar beberapa minggu lalu harus pindah sendiri ke
  // kelompok Completed. Dibatasi tiap 3 jam (anime) / 6 jam (komik) per device.
  const refreshAnimeStatuses = useAction(api.activities.refreshStatuses);
  const refreshComicStatuses = useAction(api.comics.refreshStatuses);
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    try {
      const lastA = Number(window.localStorage.getItem("yn-sub-ref-a") ?? 0);
      if (now - lastA > 3 * 3600_000) {
        window.localStorage.setItem("yn-sub-ref-a", String(now));
        void refreshAnimeStatuses().catch(() => {});
      }
      const lastC = Number(window.localStorage.getItem("yn-sub-ref-c") ?? 0);
      if (now - lastC > 6 * 3600_000) {
        window.localStorage.setItem("yn-sub-ref-c", String(now));
        void refreshComicStatuses().catch(() => {});
      }
    } catch {
      /* localStorage ditolak — refresh manual tidak masalah */
    }
  }, [user, refreshAnimeStatuses, refreshComicStatuses]);

  /** Default = semua subscribe; playlist lain = item dari bookmarkItems. */
  const defaultItems = useMemo(
    () =>
      [...animeRows, ...comicRows].sort((a, b) => b.createdAt - a.createdAt),
    [animeRows, comicRows],
  );
  const items = useMemo<SubRow[]>(() => {
    if (activeList === "default") return defaultItems;
    return (playlistRows ?? []).map((r) => ({
      _id: r._id,
      animeId: r.itemId,
      animeTitle: r.title,
      animeImage: r.image,
      kind: r.kind ?? "anime",
      status: r.status,
      createdAt: r.createdAt,
    }));
  }, [activeList, defaultItems, playlistRows]);

  /** Pecah daftar jadi dua kelompok — dipakai mode "filter". */
  const { ongoingItems, doneItems } = useMemo(() => {
    const ongoing: SubRow[] = [];
    const done: SubRow[] = [];
    for (const f of items) {
      const flag =
        "slug" in f
          ? f.ongoing !== false
          : f.status
            ? isOngoingStatus(f.status)
            : true;
      (flag ? ongoing : done).push(f);
    }
    return { ongoingItems: ongoing, doneItems: done };
  }, [items]);

  const createPlaylist = async () => {
    const clean = newName.trim();
    if (!clean || creating) return;
    setCreating(true);
    try {
      const id = await createList({ name: clean });
      setActiveList(String(id));
      setNewName("");
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat playlist");
    } finally {
      setCreating(false);
    }
  };

  const emptyText =
    activeList === "default"
      ? "Belum ada judul yang di-subscribe. Tekan tombol lonceng di detail judul."
      : "Playlist ini masih kosong. Tambahkan judul lewat tombol lonceng di detail.";

  const sortRows = (list: SubRow[]) =>
    [...list].sort((a, b) =>
      sort === "judul"
        ? ("slug" in a ? a.comicTitle : a.animeTitle).localeCompare(
            "slug" in b ? b.comicTitle : b.animeTitle,
          )
        : b.createdAt - a.createdAt,
    );

  /** Grid poster yang sama untuk semua filter. */
  const renderGrid = (list: SubRow[]) => (
    <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-4">
      {sortRows(list).map((f) => {
        const comic = "slug" in f;
        const itemId = comic ? f.slug : f.animeId;
        const itemKind = comic ? f.kind : (f.kind ?? "anime");
        const itemStatus = !comic && f.status ? f.status : undefined;
        const key = itemId;
        const title = comic ? f.comicTitle : f.animeTitle;
        const image = comic ? f.comicImage : f.animeImage;
        return (
          <motion.button
            key={key}
            initial={false}
            onClick={() => {
              if (itemKind === "manga" || itemKind === "manhwa") {
                setPick({
                  slug: itemId,
                  kind: itemKind === "manhwa" ? "manhwa" : "manga",
                });
              } else if (itemKind === "film") {
                // status menyimpan jenis film (movie/tv) — lihat Film.tsx
                navigate(
                  `/film?film=${encodeURIComponent(itemId)}&t=${itemStatus === "tv" ? "tv" : "movie"}`,
                );
              } else if (itemKind === "donghua") {
                const slug = itemId.replace(/^donghua:/, "");
                navigate(
                  `/home?pilih=${encodeURIComponent(slug)}&src=sanka`,
                );
              } else {
                navigate(
                  `/home?pilih=${encodeURIComponent(itemId)}&judul=${encodeURIComponent(title)}`,
                );
              }
            }}
            className="group text-left"
          >
            <div className="yn-media-cut relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-[#1a1d22]">
              {image ? (
                <img
                  src={image}
                  alt={title}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  {(f as AnimeRow).kind === "film" ? (
                    <Clapperboard className="size-6 text-muted-foreground" />
                  ) : (
                    <Tv className="size-6 text-muted-foreground" />
                  )}
                </div>
              )}
              {(f as AnimeRow).kind === "film" ? (
                <Clapperboard className="absolute right-1.5 top-1.5 size-4 text-white/80 drop-shadow" />
              ) : activeList === "default" ? (
                <Heart className="absolute right-1.5 top-1.5 size-4 fill-white/85 text-white/85 drop-shadow" />
              ) : (
                <Bookmark className="absolute right-1.5 top-1.5 size-4 fill-white/75 text-white/75 drop-shadow" />
              )}
            </div>
            <span className="mt-2 line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-white/90">
              {title}
            </span>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="fade-enter pb-28">
      <div className="pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-bold leading-none tracking-[-0.04em]">
              Subscribe
            </h1>
            <p className="mt-1.5 text-[10.5px] font-medium text-white/42">
              {items.length} judul · {ongoingItems.length} berjalan
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "baru" ? "judul" : "baru"))}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-[#121417] px-2.5 py-2 text-[10px] font-bold text-white/55 transition hover:text-white"
          >
            <ArrowUpDown className="size-3.5" />
            {sort === "baru" ? "Terbaru" : "A-Z"}
          </button>
        </div>

        <div className="no-bar mt-4 flex gap-2 overflow-x-auto pb-1">
          {([
            ["all", `Semua ${items.length}`],
            ["ongoing", `Berjalan ${ongoingItems.length}`],
            ["done", `Selesai ${doneItems.length}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[10.5px] font-bold transition",
                filter === key
                  ? "border-transparent bg-[var(--primary)] text-white"
                  : "border-white/10 bg-[#121417] text-white/45 hover:text-white/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Playlist bookmark: Default + playlist buatan user. */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className="no-bar flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-lg border border-white/10 bg-[#121417] p-1">
            <button
              onClick={() => setActiveList("default")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black transition",
                activeList === "default"
                  ? "bg-[#252a30] text-white"
                  : "text-white/50 hover:text-white",
              )}
            >
              <Bookmark className="size-3" />
              Default <span className="opacity-50">({defaultItems.length})</span>
            </button>
            {(lists ?? []).map((l) => (
              <button
                key={l._id}
                onClick={() => setActiveList(String(l._id))}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black transition",
                  activeList === String(l._id)
                    ? "bg-[#252a30] text-white"
                    : "text-white/50 hover:text-white",
                )}
              >
                {l.name} <span className="opacity-50">({l.count})</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="Playlist baru"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/12 bg-[#1b1e23] text-white/70 transition hover:bg-[#252a30] active:scale-95"
          >
            <Plus className="size-4" />
          </button>
          {(lists?.length ?? 0) > 0 && (
            <button
              onClick={() => setPlaylistOpen((v) => !v)}
              aria-label="Buka semua playlist"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/45 transition active:scale-95"
            >
              <ChevronDown className={cn("size-4 transition", playlistOpen && "rotate-180")} />
            </button>
          )}
        </div>

        {playlistOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-3 md:grid-cols-4">
            <button
              onClick={() => { setActiveList("default"); setPlaylistOpen(false); }}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left"
            >
              <p className="truncate text-[11px] font-black text-white">Default</p>
              <p className="text-[9px] text-white/35">{defaultItems.length} judul</p>
            </button>
            {(lists ?? []).map((l) => (
              <button
                key={l._id}
                onClick={() => { setActiveList(String(l._id)); setPlaylistOpen(false); }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left"
              >
                <p className="truncate text-[11px] font-black text-white">{l.name}</p>
                <p className="text-[9px] text-white/35">{l.count} judul</p>
              </button>
            ))}
          </div>
        )}

        {/* ---------------- DAFTAR SUBSCRIBE (semua tipe dicampur) ---------------- */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl border border-white/10 bg-[#121417] text-white/30">
              <Heart className="size-5" />
            </span>
            <p className="max-w-[17rem] text-[11px] leading-relaxed text-white/40">
              {emptyText}
            </p>
            <button
              type="button"
              onClick={() => navigate("/catalog")}
              className="yn-btn-secondary min-h-9 px-3 text-[10px]"
            >
              Jelajahi katalog
            </button>
          </div>
        ) : filter === "ongoing" ? (
          renderGrid(ongoingItems)
        ) : filter === "done" ? (
          renderGrid(doneItems)
        ) : (
          <div>
            {ongoingItems.length > 0 && (
              <section className="mt-5">
                <h2 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/52">
                  <span className="size-1.5 rounded-full bg-[var(--yn-mint)]" />
                  Berjalan
                </h2>
                {renderGrid(ongoingItems)}
              </section>
            )}

            {doneItems.length > 0 && (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/52">
                  <span className="size-1.5 rounded-full bg-white/30" />
                  Selesai
                </h2>
                {renderGrid(doneItems)}
              </section>
            )}
          </div>
        )}

        {/* -------- 3) TOP VOTE CHARACTER ANIME — setelah voting 7 hari -------- */}
        {top?.ready && top.items.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-left text-lg font-bold tracking-tight">
              <VoteIcon className="size-5 text-primary" aria-hidden />
              TOP VOTE CHARACTER ANIME
            </h2>
            <div className="mt-2 space-y-2">
              {top.items.map((c, i) => (
                <motion.div
                  key={`${i}-${c.name}`}
                  initial={{ opacity: 0, x: -24, scale: 0.97 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.07, duration: 0.45, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] p-2.5"
                >
                  {/* Peringkat */}
                  <motion.span
                    initial={{ rotate: -20, scale: 0.5 }}
                    whileInView={{ rotate: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.15, type: "spring", bounce: 0.5 }}
                    className={
                      c.rank <= 3
                        ? "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-black text-black shadow-[0_0_14px_-4px] shadow-amber-400/70"
                        : "flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-black text-white/80"
                    }
                  >
                    {c.rank === 1 ? <Crown className="size-4" aria-hidden /> : c.rank}
                  </motion.span>

                  {/* Gambar karakter */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <VoteIcon className="size-5 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>

                  {/* Nama + anime + total vote */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.animeTitle}
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${Math.max(6, Math.round((c.votes / Math.max(1, top.items[0].votes)) * 100))}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.07 + 0.2, duration: 0.9, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400"
                      />
                    </div>
                  </div>

                  {/* Total vote */}
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.25, duration: 0.4 }}
                    className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary"
                  >
                    {c.votes.toLocaleString("id-ID")} vote
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/65"
          onClick={() => setCreateOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-[430px] rounded-t-[26px] border-t border-white/15 bg-[#111116] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-black text-white">Playlist baru</p>
              <button
                onClick={() => setCreateOpen(false)}
                aria-label="Tutup"
                className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/55"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createPlaylist()}
              maxLength={40}
              placeholder="Contoh: Anime favorit, Nonton malam…"
              className="h-11 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-[13px] outline-none placeholder:text-white/30 focus:border-sky-300/45"
            />
            <button
              onClick={() => void createPlaylist()}
              disabled={!newName.trim() || creating}
                              className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] text-[12px] font-bold text-white disabled:opacity-40"
            >
              <Plus className="size-4" />
              {creating ? "Membuat…" : "Buat playlist"}
            </button>
          </div>
        </div>
      )}

      {/* Layar detail manga/manhwa yang di-subscribe */}
      {pick && (
        <ComicDetailScreen
          slug={pick.slug}
          fallbackKind={pick.kind}
          onClose={() => setPick(null)}
          onPick={(slug) => setPick({ slug, kind: pick.kind })}
        />
      )}
    </div>
  );
}
