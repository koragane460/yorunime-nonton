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
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Crown,
  Filter,
  Heart,
  List,
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
  return /(releasing|ongoing|berjalan|airing|airing|belum tamat|publishing|jalan)/.test(v);
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

  // "filter" (DEFAULT) = daftar otomatis dikelompokkan Ongoing → garis
  // pembatas → Completed, tanpa satu pun tombol status.
  // "single" = SEMUA kategori dicampur, kartu berbaris polos urut favorite.
  const [mode, setMode] = useState<"single" | "filter">("filter");
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
          : isOngoingStatus(f.status);
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
    "Belum ada judul yang di-subscribe. Tekan tombol hati di detail judul.";

  /** Satu grid kartu — dipakai mode single & tiap kelompok (Ongoing/Completed). */
  const renderGrid = (list: SubRow[]) => (
    <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {list.map((f, i) => {
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 30, 350), duration: 0.26 }}
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
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
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
                <Clapperboard className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow" />
              ) : (
                <Heart className="absolute right-1.5 top-1.5 size-4 fill-white/85 text-white/85 drop-shadow" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
                <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                  {title}
                </span>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="fade-enter pb-24">
      <div className="px-1 pt-4">
        {/* ---------------- JUDUL + GARIS ---------------- */}
        {/* Judul ditengahkan dan garis pembatasi FULL WIDTH (tanpa fade
            transparan di ujung) — permintaan user. */}
        <h1 className="text-center text-2xl font-black tracking-tight">Subscribe</h1>
        <div className="mt-2 h-px w-full bg-gold/60" />

        {/* Playlist bookmark: Default + playlist buatan user. */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className="thin-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.035] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveList("default")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black transition",
                activeList === "default"
                  ? "bg-white text-black"
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
                    ? "bg-white text-black"
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
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] active:scale-95"
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
              className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 text-left"
            >
              <p className="truncate text-[11px] font-black text-white">Default</p>
              <p className="text-[9px] text-white/35">{defaultItems.length} judul</p>
            </button>
            {(lists ?? []).map((l) => (
              <button
                key={l._id}
                onClick={() => { setActiveList(String(l._id)); setPlaylistOpen(false); }}
                className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 text-left"
              >
                <p className="truncate text-[11px] font-black text-white">{l.name}</p>
                <p className="text-[9px] text-white/35">{l.count} judul</p>
              </button>
            ))}
          </div>
        )}

        {/* ---------------- DAFTAR SUBSCRIBE (semua tipe dicampur) ---------------- */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : mode === "single" ? (
          /* Tanpa filter: kartu berbaris sesuai urutan di-favorite. */
          renderGrid(items)
        ) : (
          /* Otomatis terbagi: Ongoing → garis pembatas → Completed. */
          <div>
            {ongoingItems.length > 0 && (
              <>
                {/* Judul ONGOING: putih, tanpa dot, tanpa angka "masih jalan"
                    (permintaan user). */}
                <div className="mt-4 flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                    Ongoing
                  </h2>
                </div>
                {/* Chip tipe anime/manga/manhwa/donghua DIHAPUS PERMANEN. */}
                {renderGrid(ongoingItems)}
              </>
            )}

            {/* Garis pembatas antar kelompok — hanya saat keduanya ada. */}
            {ongoingItems.length > 0 && doneItems.length > 0 && (
              <div className="my-4 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/25 to-white/25" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  selesai
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/25 to-white/25" />
              </div>
            )}

            {doneItems.length > 0 && (
              <>
                {/* Judul COMPLETED: putih, tanpa dot, tanpa angka "tamat". */}
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                    Completed
                  </h2>
                </div>
                {renderGrid(doneItems)}
              </>
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

      {/* Saklar tampilan di pojok kanan bawah — kotak rounded, biru muda,
          ada garis pembatas di tengah: kiri SINGLE (kartu sesuai urutan
          favorite), kanan FILTER (otomatis Ongoing → Completed). */}
      <div className="fixed bottom-24 right-4 z-40 flex items-stretch overflow-hidden rounded-full border border-sky-200/60 bg-sky-300 shadow-[0_10px_26px_-10px_rgba(56,189,248,0.9)]">
        <button
          type="button"
          onClick={() => setMode("single")}
          aria-pressed={mode === "single"}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-black transition active:scale-95",
            mode === "single"
              ? "bg-white text-sky-700"
              : "text-sky-950/75 hover:bg-white/30",
          )}
        >
          <List className="size-3.5" aria-hidden />
          Single
        </button>
        <span className="w-px shrink-0 bg-sky-950/25" aria-hidden />
        <button
          type="button"
          onClick={() => setMode("filter")}
          aria-pressed={mode === "filter"}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-black transition active:scale-95",
            mode === "filter"
              ? "bg-white text-sky-700"
              : "text-sky-950/75 hover:bg-white/30",
          )}
        >
          <Filter className="size-3.5" aria-hidden />
          Filter
        </button>
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/65"
          onClick={() => setCreateOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-[26px] border-t border-white/15 bg-[#111116] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
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
              className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-[12px] font-black text-black disabled:opacity-40"
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
