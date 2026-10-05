/**
 * YoruNime: Story UI (komposisi + penampil), gaya story di app chat pada
 * umumnya.
 *
 * Dua layar fullscreen:
 *  1. Komposisi - pilih dari galeri perangkat (bisa banyak sekaligus) atau
 *     ambil langsung dengan kamera, lalu rapikan (teks + musik) dan kirim.
 *  2. Penampil - bar progres di atas, ketuk kiri/kanan untuk skip, daftar
 *     penonton untuk story sendiri, dan tombol hapus.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Music2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Umur story dalam jam, hanya untuk teks "hilang dalam X jam". */
const TTL_HOURS = 24;

/**
 * Lagu latar BEBAS ROYALTI.
 *
 * PENTING: tidak ada satu pun lagu berhak cipta di daftar ini. Semua entri
 * mengarah ke `/music/<file>` di folder publik aplikasi. Kalau file belum
 * ada, nama lagunya tetap tampil sebagai label di story (dan tidak ada audio
 * yang diputar) - tidak pernah otomatis mengambil lagu dari internet, karena
 * itu justru berisiko hak cipta.
 */
export const ROYALTY_TRACKS: { key: string; label: string; file: string }[] = [
  { key: "none", label: "Tanpa musik", file: "" },
  { key: "calm", label: "Calm Night (bebas royalti)", file: "/music/calm-night.mp3" },
  { key: "soft", label: "Soft Rain (bebas royalti)", file: "/music/soft-rain.mp3" },
  { key: "lofi", label: "Lo-fi Study (bebas royalti)", file: "/music/lofi-study.mp3" },
  { key: "wave", label: "Ocean Wave (bebas royalti)", file: "/music/ocean-wave.mp3" },
];

const trackOf = (key?: string) =>
  ROYALTY_TRACKS.find((t) => t.key === (key || "none")) ?? ROYALTY_TRACKS[0];

/**
 * Avatar dengan cincin story.
 *
 * Cincinnya BIRU MUDA saat user punya story yang belum dilihat, cincin biasa
 * kalau tidak. Ini bukan dekorasi: tanda biru muda adalah cara app menandai
 * "ada yang baru, ketuk untuk menonton".
 */
export function StoryRing({
  image,
  seed,
  size,
  hasStory,
  seen,
  onClick,
  className,
}: {
  image?: string;
  seed?: string;
  size: number;
  hasStory?: boolean;
  seen?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Lihat story"
      className={cn(
        "relative shrink-0 rounded-full p-[2.5px] transition",
        hasStory && !seen
          ? "bg-gradient-to-tr from-sky-400 via-sky-300 to-cyan-200"
          : hasStory
            ? "bg-gradient-to-tr from-zinc-600 to-zinc-400"
            : "bg-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="flex size-full items-center justify-center rounded-full bg-background p-[2px]">
        <img
          src={image || `https://api.dicebear.com/7.x/bottts/svg?seed=${seed || "u"}`}
          alt=""
          className="size-full rounded-full object-cover"
        />
      </span>
    </button>
  );
}

/** Tombol + kecil di sudut avatar pembuka komposisi story. */
export function StoryAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Tambah story"
      className="absolute -bottom-0.5 -right-0.5 z-10 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition active:scale-95"
    >
      <span className="-mt-0.5 text-base leading-none font-black">+</span>
    </button>
  );
}

/* =============================== KOMPOSISI ============================== */

type Picked = { file: File; url: string; kind: "image" | "video" };

/**
 * Layar pilih media (fullscreen).
 *
 * - Kotak di atas: "Ambil dengan foto" membuka kamera perangkat.
 * - Di bawahnya: galeri perangkat lewat input file bawaan browser, bisa
 *   memilih banyak sekaligus (multiple).
 * - Tombol Pilih membawa yang terpilih ke layar penyuntingan.
 */
export function StoryComposer({
  onClose,
  onPicked,
}: {
  onClose: () => void;
  onPicked: (items: Picked[]) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Picked[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const accept = "image/*,video/*";

  const pushFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Picked[] = [];
    for (const f of Array.from(files).slice(0, 20)) {
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");
      if (!isVideo && !isImage) continue;
      next.push({ file: f, url: URL.createObjectURL(f), kind: isVideo ? "video" : "image" });
    }
    if (next.length === 0) {
      toast.error("Format tidak didukung. Pilih foto atau video.");
      return;
    }
    setItems((prev) => [...prev, ...next]);
    setSelected((prev) => {
      const s = new Set(prev);
      for (const n of next) s.add(n.url);
      return s;
    });
  };

  const toggle = (url: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(url)) s.delete(url);
      else s.add(url);
      return s;
    });

  const chosen = items.filter((i) => selected.has(i.url));

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 pt-3">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-full border border-border p-2"
        >
          <X className="size-4" />
        </button>
        <h1 className="text-base font-bold">Tambah story</h1>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-3 pb-3">
        {/* Kotak kamera: persegi panjang dengan ikon + label di bawahnya. */}
        <button
          onClick={() => cameraRef.current?.click()}
          className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400/50 bg-sky-400/5 px-4 py-8 transition hover:border-sky-400"
        >
          <Camera className="size-7 text-sky-300" />
          <span className="text-sm font-bold text-sky-200">Ambil dengan foto</span>
          <span className="text-[10px] text-muted-foreground">
            Buka kamera, foto atau rekam langsung
          </span>
        </button>

        {/* Galeri perangkat */}
        <div className="mt-5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[12px] font-bold">
            <ImageIcon className="size-3.5 text-muted-foreground" /> Galeri
            perangkat
          </p>
          <button
            onClick={() => galleryRef.current?.click()}
            className="rounded-full border border-border px-3 py-1 text-[10px] font-bold text-muted-foreground"
          >
            Buka galeri
          </button>
        </div>

        {items.length === 0 ? (
          <button
            onClick={() => galleryRef.current?.click()}
            className="mt-2 w-full rounded-2xl border border-border bg-card/40 px-4 py-10 text-center"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              Ketuk untuk memilih foto &amp; video
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Bisa pilih lebih dari satu sekaligus
            </p>
          </button>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {items.map((it) => {
              const on = selected.has(it.url);
              return (
                <button
                  key={it.url}
                  onClick={() => toggle(it.url)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border-2 transition",
                    on ? "border-sky-400" : "border-transparent",
                  )}
                >
                  {it.kind === "image" ? (
                    <img src={it.url} alt="" className="size-full object-cover" />
                  ) : (
                    <video src={it.url} muted playsInline className="size-full object-cover" />
                  )}
                  {it.kind === "video" && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[8px] font-bold text-white">
                      VIDEO
                    </span>
                  )}
                  {on && (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-sky-400 text-[10px] font-black text-black">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tombol Pilih */}
      <div className="border-t border-border bg-background p-3">
        <button
          disabled={chosen.length === 0}
          onClick={() => onPicked(chosen)}
          className="w-full rounded-full bg-sky-500 py-3 text-sm font-bold text-black disabled:opacity-40"
        >
          Pilih{chosen.length > 0 ? ` (${chosen.length})` : ""}
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          pushFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/* `capture` membuat browser Android/iOS langsung membuka kamera. */}
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pushFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* =============================== SUNTING =============================== */

/**
 * Layar sunting, gaya story TikTok/WA/IG: media penuh, teks di tengah,
 * pilihan musik di bawah, tombol kirim di kanan atas.
 */
export function StoryEditor({
  items,
  onClose,
  onPosted,
}: {
  items: Picked[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const addStory = useMutation(api.stories.addStory);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  const [idx, setIdx] = useState(0);
  const [caption, setCaption] = useState("");
  const [track, setTrack] = useState(ROYALTY_TRACKS[0].key);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = items[Math.min(idx, items.length - 1)];
  const chosen = trackOf(track);

  // Musik latar diputar saat pratinjau kalau filenya benar-benar ada.
  useEffect(() => {
    audioRef.current?.pause();
    if (!chosen.file) {
      audioRef.current = null;
      return;
    }
    const a = new Audio(chosen.file);
    a.loop = true;
    a.volume = 0.5;
    void a.play().catch(() => {
      // File belum ada / autoplay ditolak: label tetap disimpan, tanpa error.
    });
    audioRef.current = a;
    return () => {
      a.pause();
    };
  }, [chosen.file]);

  const uploadOne = useCallback(
    async (it: Picked, text: string, musicKey: string) => {
      if (it.file.size > 25 * 1024 * 1024) {
        throw new Error("Ukuran melebihi 25 MB. Potong videonya lebih pendek.");
      }
      const url = await getUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": it.file.type || "application/octet-stream" },
        body: it.file,
      });
      if (!res.ok) throw new Error("Unggah media gagal");
      const { storageId } = (await res.json()) as { storageId: string };
      await addStory({
        storageId,
        mediaType: it.kind,
        caption: text || undefined,
        musicKey: musicKey || undefined,
      });
    },
    [addStory, getUploadUrl],
  );

  const post = async () => {
    setBusy(true);
    try {
      for (const it of items) {
        await uploadOne(it, caption, track === "none" ? "" : track);
        setSent((s) => s + 1);
      }
      toast.success(
        items.length > 1
          ? `${items.length} story terkirim`
          : "Story terkirim",
      );
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim story");
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-black">
      {/* Bar atas */}
      <div className="flex items-center gap-3 px-3 pt-3">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-full bg-black/50 p-2 text-white"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-bold text-white/80">
          {items.length > 1 ? `${idx + 1} / ${items.length}` : "Story baru"}
        </p>
        <button
          disabled={busy}
          onClick={() => void post()}
          className="ml-auto rounded-full bg-white px-4 py-1.5 text-xs font-black text-black disabled:opacity-50"
        >
          {busy
            ? sent > 0
              ? `Kirim ${sent}/${items.length}…`
              : "Mengirim…"
            : "Add story"}
        </button>
      </div>

      {/* Pratinjau media */}
      <div className="relative flex-1 overflow-hidden">
        {current.kind === "image" ? (
          <img src={current.url} alt="" className="size-full object-contain" />
        ) : (
          <video
            src={current.url}
            autoPlay
            loop
            muted
            playsInline
            className="size-full object-contain"
          />
        )}
        {caption.trim() && (
          <p className="pointer-events-none absolute left-0 right-0 top-1/3 px-6 text-center text-lg font-black text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {caption.trim()}
          </p>
        )}
        {track !== "none" && (
          <span className="absolute left-3 bottom-24 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">
            <Music2 className="size-3" /> {chosen.label}
          </span>
        )}

        {items.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              aria-label="Sebelumnya"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}
              aria-label="Berikutnya"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Panel bawah: teks + musik */}
      <div className="space-y-2 bg-gradient-to-t from-black to-transparent p-3 pt-6">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Tulis sesuatu…"
          maxLength={140}
          className="w-full rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/50"
        />
        <div className="thin-scroll flex gap-2 overflow-x-auto pb-1">
          {ROYALTY_TRACKS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTrack(t.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                track === t.key
                  ? "border-white bg-white text-black"
                  : "border-white/30 text-white/80",
              )}
            >
              <Music2 className="mr-1 inline size-3" /> {t.label}
            </button>
          ))}
        </div>
        <p className="text-center text-[9px] text-white/45">
          Semua lagu di daftar ini bebas royalti. Tidak ada lagu berhak cipta.
        </p>
      </div>
    </div>
  );
}

/* =============================== PENAMPIL =============================== */

type StoryItem = {
  _id: string;
  storageId: string;
  mediaType: "image" | "video";
  caption?: string;
  musicKey?: string;
  createdAt: number;
  viewCount?: number;
};

/**
 * Penampil story (fullscreen).
 *
 * - Bar progres di paling atas, satu per story, terisi sesuai durasi tampil.
 * - Ketuk kiri = mundur, ketuk kanan = maju. Seperti story pada umumnya.
 * - Story sendiri punya tombol hapus dan tombol "siapa yang melihat".
 */
export function StoryViewer({
  userId,
  onClose,
}: {
  userId?: string;
  onClose: () => void;
}) {
  const feed = useQuery(api.stories.allStories, {}) as
    | {
        userId: string;
        username: string;
        userImage?: string;
        hasUnseen: boolean;
        stories: StoryItem[];
      }[]
    | undefined;
  const markViewed = useMutation(api.stories.markViewed);
  const removeStory = useMutation(api.stories.removeStory);

  const [group, setGroup] = useState(0);
  const [idx, setIdx] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [progress, setProgress] = useState(0);

  const groups = useMemo(() => feed ?? [], [feed]);
  const active = groups[group];
  const currentStory = active?.stories?.[idx];
  const viewingOwn = !!userId && active?.userId === userId;

  // Daftar penonton hanya untuk story milik sendiri.
  const viewers = useQuery(
    api.stories.viewers,
    viewingOwn && currentStory
      ? { storyId: currentStory._id as never }
      : "skip",
  ) as
    | { userId: string; username: string; userImage?: string; at: number }[]
    | undefined;

  // Ambil URL media dari storage.
  const url = useQuery(
    api.storage.getUrl,
    currentStory ? { storageId: currentStory.storageId } : "skip",
  );

  // Reset kalau feed berubah bentuk.
  useEffect(() => {
    if (group >= groups.length) setGroup(0);
    if (idx >= (groups[group]?.stories.length ?? 0)) setIdx(0);
  }, [groups, group, idx]);

  const next = useCallback(() => {
    setProgress(0);
    const list = groups[group]?.stories ?? [];
    if (idx + 1 < list.length) {
      setIdx(idx + 1);
      return;
    }
    if (group + 1 < groups.length) {
      setGroup(group + 1);
      setIdx(0);
      return;
    }
    onClose();
  }, [groups, group, idx, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    if (idx > 0) {
      setIdx(idx - 1);
      return;
    }
    if (group > 0) {
      setGroup(group - 1);
      setIdx(0);
    }
  }, [group, idx]);

  // Tandai dilihat.
  useEffect(() => {
    if (!currentStory) return;
    void markViewed({ storyId: currentStory._id as never }).catch(() => {});
  }, [currentStory, markViewed]);

  // Progres bar: gambar 5 detik, video mengikuti durasinya.
  useEffect(() => {
    if (!currentStory) return;
    const dur = currentStory.mediaType === "video" ? 15000 : 5000;
    setProgress(0);
    const t0 = Date.now();
    const timer = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / dur) * 100);
      setProgress(p);
      if (p >= 100) next();
    }, 60);
    return () => window.clearInterval(timer);
  }, [currentStory, next]);

  if (!active || !currentStory) {
    return (
      <div className="screen-enter fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black">
        <p className="text-sm font-semibold text-white/70">Tidak ada story</p>
        <button
          onClick={onClose}
          className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold text-white"
        >
          Tutup
        </button>
      </div>
    );
  }

  const list = active.stories;

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-black">
      {/* Bar progres */}
      <div className="flex gap-1 px-3 pt-3">
        {list.map((s, i) => (
          <span key={s._id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full rounded-full bg-white"
              style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
            />
          </span>
        ))
        }
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <StoryRing image={active.userImage} seed={active.username} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{active.username}</p>
          <p className="text-[10px] text-white/60">
            {Math.max(1, Math.round((Date.now() - currentStory.createdAt) / 3600000))} jam lalu
          </p>
        </div>
        {viewingOwn && (
          <>
            <button
              onClick={() => setShowViewers((v) => !v)}
              aria-label="Siapa yang melihat"
              className="rounded-full bg-white/15 p-2 text-white"
            >
              <Eye className="size-4" />
            </button>
            <button
              onClick={() => {
                void removeStory({ storyId: currentStory._id as never })
                  .then(() => {
                    toast.success("Story dihapus");
                    next();
                  })
                  .catch((e: unknown) =>
                    toast.error(e instanceof Error ? e.message : "Gagal hapus"),
                  );
              }}
              aria-label="Hapus story"
              className="rounded-full bg-white/15 p-2 text-white"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-full bg-white/15 p-2 text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Media + zona ketuk kiri/kanan */}
      <div className="relative flex-1 overflow-hidden">
        {currentStory.mediaType === "image" ? (
          url ? (
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <div className="size-full animate-pulse bg-white/5" />
          )
        ) : url ? (
          <video src={url} autoPlay playsInline controls={false} className="size-full object-contain" />
        ) : (
          <div className="size-full animate-pulse bg-white/5" />
        )}

        {currentStory.caption && (
          <p className="pointer-events-none absolute left-0 right-0 top-1/3 px-6 text-center text-lg font-black text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {currentStory.caption}
          </p>
        )}
        {currentStory.musicKey && currentStory.musicKey !== "none" && (
          <span className="absolute left-3 bottom-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">
            <Music2 className="size-3" /> {trackOf(currentStory.musicKey).label}
          </span>
        )}

        {/* Dua zona ketuk, tanpa tombol yang terlihat. */}
        <button
          onClick={prev}
          aria-label="Sebelumnya"
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          onClick={next}
          aria-label="Berikutnya"
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>

      {/* Daftar penonton story sendiri */}
      {showViewers && viewingOwn && (
        <div className="max-h-64 overflow-y-auto border-t border-white/15 bg-black/90 px-3 py-3">
          <p className="mb-2 text-[11px] font-bold text-white">
            Dilihat {viewers?.length ?? 0} orang
          </p>
          {(viewers ?? []).length === 0 ? (
            <p className="py-3 text-center text-[11px] text-white/50">
              Belum ada yang melihat.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(viewers ?? []).map((v) => (
                <div key={v.userId} className="flex items-center gap-2.5">
                  <img
                    src={v.userImage || ""}
                    alt=""
                    className="size-8 rounded-full bg-white/10 object-cover"
                  />
                  <span className="truncate text-xs font-semibold text-white">
                    {v.username}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
