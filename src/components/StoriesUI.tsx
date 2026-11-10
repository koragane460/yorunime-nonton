/**
 * YoruNime: Story UI (komposisi + penyunting + penampil).
 *
 * Alur: pilih media (kamera langsung atau galeri) -> sunting (teks, stiker,
 * pangkas, lagu dari katalog Musik, suara, privasi) -> kirim dengan bar
 * persentase -> tonton di penampil fullscreen.
 *
 * Semua layar di-portal ke <body>. Kalau dirender di dalam pohon yang punya
 * transform/overflow-hidden (cincin avatar), `fixed inset-0` hanya sebesar
 * container itu, bukan sebesar layar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { avatarFallback } from "@/lib/lstream";
import type { MusicTrack } from "@/convex/music";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music2,
  Search,
  Sticker,
  Trash2,
  Type,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lagu latar LAMA (bebas royalti, file lokal). Masih dipakai untuk menampilkan
 * label story lama yang hanya menyimpan `musicKey`. Story baru memakai lagu
 * dari katalog Musik (iTunes/Internet Archive).
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

/* ============================== gaya teks ============================== */

/** Pilihan font teks story. Font sistem, tidak perlu unduh apa pun. */
const FONTS: { id: string; label: string; css: string }[] = [
  { id: "modern", label: "Modern", css: "system-ui, 'Segoe UI', sans-serif" },
  { id: "klasik", label: "Klasik", css: "Georgia, 'Times New Roman', serif" },
  { id: "tulis", label: "Tulis", css: "'Segoe Script', 'Comic Sans MS', cursive" },
  { id: "tebal", label: "Tebal", css: "Impact, 'Arial Black', sans-serif" },
  { id: "kode", label: "Kode", css: "'Courier New', ui-monospace, monospace" },
];
const fontCss = (id: string) => FONTS.find((f) => f.id === id)?.css ?? FONTS[0].css;

const TEXT_COLORS = [
  "#ffffff",
  "#0f0f13",
  "#f43f5e",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#38bdf8",
  "#c084fc",
];

/** Outline teks: bayangan hitam ke 4 arah + diagonal. */
const OUTLINE_SHADOW =
  "2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 1.5px 1.5px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000";

/** Paket stiker. Semua emoji — tidak ada aset gambar yang perlu diunduh. */
const STICKER_PACKS: { name: string; items: string[] }[] = [
  {
    name: "Ekspresi",
    items: ["😀", "😂", "🥰", "😍", "😭", "😱", "😡", "🤯", "🤩", "😎", "🥺", "😴"],
  },
  {
    name: "Aksi",
    items: ["⚔️", "🔥", "💥", "⚡", "🗡️", "🛡️", "💫", "🌀", "🚀", "🏆", "🎯", "🥊"],
  },
  {
    name: "Cute",
    items: ["🌸", "✨", "💖", "🐱", "🐰", "🍰", "🍡", "🧸", "🌷", "🦄", "🍬", "🌈"],
  },
  {
    name: "Anime",
    items: ["👁️", "👹", "👺", "🦊", "🐉", "🥋", "🍥", "🎮", "📸", "👾", "🤖", "🔮"],
  },
  {
    name: "Malam",
    items: ["🌙", "⭐", "🌟", "☄️", "☔", "🌊", "🍂", "❄️", "☀️", "🕯️", "🎧", "💤"],
  },
];

/* ============================== tipe data ============================== */

export type Picked = { file: File; url: string; kind: "image" | "video" };

type TextLayer = {
  id: string;
  text: string;
  color: string;
  outline: boolean;
  bg: boolean;
  font: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
};

type StickerLayer = {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
};

type CropState = { aspect: string; zoom: number };

type ItemEdit = { texts: TextLayer[]; stickers: StickerLayer[]; crop: CropState };

const emptyEdit = (): ItemEdit => ({
  texts: [],
  stickers: [],
  crop: { aspect: "asli", zoom: 1 },
});

const ASPECTS: { id: string; label: string; ratio?: string; width?: string }[] = [
  { id: "asli", label: "Asli" },
  { id: "1:1", label: "1:1", ratio: "1 / 1", width: "min(100%, 100vh)" },
  { id: "4:5", label: "4:5", ratio: "4 / 5", width: "min(100%, 80vh)" },
  { id: "16:9", label: "16:9", ratio: "16 / 9", width: "100%" },
];
const aspectOf = (id?: string) => ASPECTS.find((a) => a.id === id);

const PRIVACY_OPTIONS: { id: "all" | "teman" | "diri"; label: string; hint: string }[] = [
  { id: "all", label: "Semua orang", hint: "Siapa pun yang membuka feed story bisa melihat" },
  { id: "teman", label: "Hanya teman", hint: "Hanya daftar temanmu yang bisa melihat" },
  { id: "diri", label: "Hanya saya", hint: "Arsip pribadi — orang lain tidak melihat apa pun" },
];

/** Alat sunting: kolom tombol vertikal di KANAN pratinjau. */
const TOOLS: { id: Tool; label: string; icon: typeof Type }[] = [
  { id: "teks", label: "Teks", icon: Type },
  { id: "stiker", label: "Stiker", icon: Sticker },
  { id: "pangkas", label: "Pangkas", icon: Crop },
  { id: "suara", label: "Suara", icon: Volume2 },
  { id: "privasi", label: "Privasi", icon: Lock },
];

/* =============================== CINCIN ================================= */

/**
 * Avatar dengan cincin story.
 *
 * Cincin BIRU TUA saat user punya story yang belum dilihat, cincin tipis
 * kalau tidak. Padding kecil supaya cincinnya rapat ke foto profil.
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
        "relative shrink-0 rounded-full p-[3px] transition",
        hasStory && !seen
          ? "bg-[linear-gradient(135deg,#15803D,#22C55E_52%,#A3E635)] shadow-[0_0_0_1px_rgba(74,222,128,.25)]"
          : hasStory
            ? "bg-gradient-to-tr from-zinc-600 to-zinc-400"
            : "bg-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* p-[1px]: gap cincin 1px supaya foto rapat ke cincin story.
          Dulu 1.5px + padding luar lain membuat cincin terlihat miring. */}
      <span className="flex size-full items-center justify-center rounded-full bg-background p-[1px]">
        {/* Fallback HARUS sama dengan Avatar (lstream-ui): pixel-art dari
            avatarFallback — dulu memakai dicebear bottts sehingga foto profil
            di panel akun (Avatar) dan di halaman Akun (StoryRing) beda. */}
        <img
          src={image || avatarFallback(seed)}
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

/**
 * Layar pilih media (fullscreen).
 *
 * - "Ambil foto": membuka KAMERA perangkat langsung (capture=environment),
 *   seperti memotret dari app kamera.
 * - "Rekam video": kamera perangkat dalam mode video.
 * - Galeri: pilih banyak sekaligus dari penyimpanan.
 */
export function StoryComposer({
  onClose,
  onPicked,
}: {
  onClose: () => void;
  onPicked: (items: Picked[]) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Picked[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  return createPortal(
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
        {/* Kamera langsung: dua tombol, foto & video, seperti app kamera. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => photoRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400/50 bg-sky-400/5 px-3 py-7 transition hover:border-sky-400"
          >
            <Camera className="size-7 text-sky-300" />
            <span className="text-sm font-bold text-sky-200">Ambil foto</span>
            <span className="text-[10px] text-muted-foreground">Kamera langsung</span>
          </button>
          <button
            onClick={() => videoRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-400/50 bg-rose-400/5 px-3 py-7 transition hover:border-rose-400"
          >
            <Camera className="size-7 text-rose-300" />
            <span className="text-sm font-bold text-rose-200">Rekam video</span>
            <span className="text-[10px] text-muted-foreground">Kamera video</span>
          </button>
        </div>

        {/* Galeri perangkat */}
        <div className="mt-5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[12px] font-bold">
            <ImageIcon className="size-3.5 text-muted-foreground" /> Galeri perangkat
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
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          pushFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/* capture=environment membuat browser langsung membuka kamera belakang. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pushFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pushFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>,
    document.body,
  );
}

/* =============================== SUNTING =============================== */

type Tool = "teks" | "stiker" | "pangkas" | "musik" | "suara" | "privasi" | null;

/**
 * Layar sunting, gaya story TikTok/WA/IG:
 * - media penuh dengan pangkas (rasio + zoom),
 * - lapisan teks & stiker yang bisa digeser langsung di pratinjau,
 * - bar panjang di bawah untuk memilih lagu (katalog Musik) + tombol Suara
 *   untuk mengatur volume suara asli & suara tambahan,
 * - tombol Posting dengan persentase unggah.
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
  const searchMusic = useAction(api.music.musicSearch);

  const [idx, setIdx] = useState(0);
  const [edits, setEdits] = useState<Record<string, ItemEdit>>({});
  const [tool, setTool] = useState<Tool>(null);
  const [sel, setSel] = useState<{ kind: "text" | "sticker"; id: string } | null>(null);
  const [music, setMusic] = useState<MusicTrack | null>(null);
  const [mediaVol, setMediaVol] = useState(1);
  const [musicVol, setMusicVol] = useState(0.6);
  const [privacy, setPrivacy] = useState<"all" | "teman" | "diri">("all");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [packIdx, setPackIdx] = useState(0);
  const [mq, setMq] = useState("");
  const [mSearching, setMSearching] = useState(false);
  const [mResults, setMResults] = useState<MusicTrack[] | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: "text" | "sticker"; id: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = items[Math.min(idx, items.length - 1)];
  const edit = edits[current?.url ?? ""] ?? emptyEdit();
  const aspect = aspectOf(edit.crop.aspect);

  const setEdit = useCallback(
    (url: string, patch: Partial<ItemEdit>) => {
      setEdits((prev) => ({
        ...prev,
        [url]: { ...(prev[url] ?? emptyEdit()), ...patch },
      }));
    },
    [],
  );

  // Musik latar diputar saat pratinjau.
  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    const url = music?.audioUrl;
    if (!url) return;
    const a = new Audio(url);
    a.loop = true;
    void a.play().catch(() => {
      // Autoplay bisa ditolak browser; tidak apa-apa, hanya pratinjau.
    });
    audioRef.current = a;
    return () => {
      a.pause();
    };
  }, [music]);

  // Volume dipisah dari efek di atas supaya menggeser slider Suara tidak
  // me-restart lagunya dari awal.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, musicVol));
    }
  }, [musicVol]);

  const uploadOne = useCallback(
    (it: Picked, onProgress: (p: number) => void) =>
      new Promise<void>(async (resolve, reject) => {
        // Batas mengikuti Convex: file tidak dibatasi ukuran oleh storage,
        // tetapi POST request punya timeout 2 menit. 100 MB adalah batas aman
        // yang sama dengan Feed supaya foto/video status tidak ditolak lebih
        // awal daripada Feed.
        if (it.file.size > 100 * 1024 * 1024) {
          reject(
            new Error(
              "Ukuran melebihi 100 MB. Potong videonya lebih pendek lalu coba lagi.",
            ),
          );
          return;
        }
        try {
          const url = await getUploadUrl();
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Content-Type", it.file.type || "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
          };
          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error("Unggah media gagal"));
              return;
            }
            try {
              const { storageId } = JSON.parse(xhr.responseText) as { storageId: string };
              const ed = edits[it.url] ?? emptyEdit();
              void addStory({
                storageId,
                mediaType: it.kind,
                privacy,
                music: music
                  ? {
                      title: music.title,
                      artist: music.artist,
                      cover: music.cover,
                      audioUrl: music.audioUrl,
                      source: music.source,
                    }
                  : undefined,
                mediaVol,
                musicVol,
                crop:
                  ed.crop.aspect !== "asli"
                    ? { aspect: ed.crop.aspect, zoom: ed.crop.zoom }
                    : undefined,
                texts:
                  ed.texts.length > 0
                    ? ed.texts.map((t) => ({
                        text: t.text,
                        color: t.color,
                        outline: t.outline,
                        bg: t.bg,
                        font: t.font,
                        x: t.x,
                        y: t.y,
                        scale: t.scale,
                        rotate: t.rotate,
                      }))
                    : undefined,
                stickers:
                  ed.stickers.length > 0
                    ? ed.stickers.map((s) => ({
                        emoji: s.emoji,
                        x: s.x,
                        y: s.y,
                        size: s.size,
                        rotate: s.rotate,
                      }))
                    : undefined,
              })
                .then(() => resolve())
                .catch((err: unknown) =>
                  reject(err instanceof Error ? err : new Error("Gagal menyimpan story")),
                );
            } catch {
              reject(new Error("Unggah media gagal"));
            }
          };
          xhr.onerror = () => reject(new Error("Jaringan bermasalah saat mengunggah"));
          xhr.send(it.file);
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Gagal mengunggah"));
        }
      }),
    [addStory, getUploadUrl, edits, privacy, music, mediaVol, musicVol],
  );

  const post = async () => {
    setBusy(true);
    setPct(0);
    try {
      const totalBytes = items.reduce((s, it) => s + it.file.size, 0) || 1;
      let doneBytes = 0;
      for (const it of items) {
        await uploadOne(it, (p) => {
          const overall = ((doneBytes + it.file.size * p) / totalBytes) * 100;
          setPct(Math.min(99, Math.round(overall)));
        });
        doneBytes += it.file.size;
      }
      setPct(100);
      toast.success(
        items.length > 1 ? `${items.length} story terkirim` : "Story terkirim",
      );
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim story");
    } finally {
      setBusy(false);
    }
  };

  const doMusicSearch = async () => {
    const term = mq.trim();
    if (term.length < 2) return;
    setMSearching(true);
    try {
      const r = (await searchMusic({ q: term, limit: 24 })) as MusicTrack[];
      // Story butuh file audio langsung; hasil YouTube tidak punya URL audio.
      setMResults((r ?? []).filter((t) => t?.audioUrl && t.source !== "youtube"));
    } catch {
      setMResults([]);
    }
    setMSearching(false);
  };

  /* ---------------------------- lapisan ---------------------------- */

  const addText = () => {
    const text = textDraft.trim();
    if (!text || !current) return;
    const layer: TextLayer = {
      id: `t${Date.now()}`,
      text,
      color: "#ffffff",
      outline: true,
      bg: false,
      font: "modern",
      x: 0.5,
      y: 0.42,
      scale: 1,
      rotate: 0,
    };
    setEdit(current.url, { texts: [...edit.texts, layer] });
    setSel({ kind: "text", id: layer.id });
    setTextDraft("");
  };

  const updateSelText = (patch: Partial<TextLayer>) => {
    if (!current || sel?.kind !== "text") return;
    setEdit(current.url, {
      texts: edit.texts.map((t) => (t.id === sel.id ? { ...t, ...patch } : t)),
    });
  };

  const removeSel = () => {
    if (!current || !sel) return;
    if (sel.kind === "text") {
      setEdit(current.url, { texts: edit.texts.filter((t) => t.id !== sel.id) });
    } else {
      setEdit(current.url, { stickers: edit.stickers.filter((s) => s.id !== sel.id) });
    }
    setSel(null);
  };

  const addSticker = (emoji: string) => {
    if (!current) return;
    const layer: StickerLayer = {
      id: `s${Date.now()}`,
      emoji,
      x: 0.5 + (Math.random() * 0.16 - 0.08),
      y: 0.5 + (Math.random() * 0.16 - 0.08),
      size: 0.18,
      rotate: 0,
    };
    setEdit(current.url, { stickers: [...edit.stickers, layer] });
    setSel({ kind: "sticker", id: layer.id });
  };

  const onLayerDown =
    (kind: "text" | "sticker", id: string) => (e: RPointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { kind, id };
      setSel({ kind, id });
    };

  const onPreviewMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = previewRef.current;
    if (!d || !el || !current) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    const y = Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height));
    const ed = edits[current.url] ?? emptyEdit();
    if (d.kind === "text") {
      setEdit(current.url, {
        texts: ed.texts.map((t) => (t.id === d.id ? { ...t, x, y } : t)),
      });
    } else {
      setEdit(current.url, {
        stickers: ed.stickers.map((s) => (s.id === d.id ? { ...s, x, y } : s)),
      });
    }
  };

  if (!current) return null;

  const selText = sel?.kind === "text" ? edit.texts.find((t) => t.id === sel.id) : null;
  const selSticker =
    sel?.kind === "sticker" ? edit.stickers.find((s) => s.id === sel.id) : null;

  /** Buka layar tulis penuh. Kalau belum ada teks terpilih, buat lapisan
   *  kosong dulu supaya kontrol warna/font sudah bisa dipakai saat menulis. */
  const beginTextTool = () => {
    if (!current) return;
    if (selText) {
      setTool("teks");
      return;
    }
    const layer: TextLayer = {
      id: `t${Date.now()}`,
      text: textDraft,
      color: "#ffffff",
      outline: true,
      bg: false,
      font: "modern",
      x: 0.5,
      y: 0.42,
      scale: 1,
      rotate: 0,
    };
    setEdit(current.url, { texts: [...edit.texts, layer] });
    setSel({ kind: "text", id: layer.id });
    setTextDraft("");
    setTool("teks");
  };

  /** Selesai menulis: buang lapisan yang benar-benar kosong, lalu tutup
   *  layar tulis tanpa menyembunyikan pratinjau. */
  const commitTextTool = () => {
    if (current && sel?.kind === "text") {
      const layer = edit.texts.find((t) => t.id === sel.id);
      if (layer && !layer.text.trim()) {
        setEdit(current.url, {
          texts: edit.texts.filter((t) => t.id !== sel.id),
        });
        setSel(null);
      }
    }
    setTool(null);
  };

  const mediaClass = "size-full object-contain";
  const mediaStyle = { transform: `scale(${edit.crop.zoom})` } as const;
  // Salinan TIDAK dipersempit untuk kondisi render panel lama. Dengan begitu
  // isi panel lama tetap lolos typecheck, sementara teks & stiker selalu
  // memakai layar penuh baru di bawah ini.
  const legacyTool: Tool = tool;
  const mediaEl = (cls: string) =>
    current.kind === "image" ? (
      <img src={current.url} alt="" className={cls} style={mediaStyle} />
    ) : (
      <video
        src={current.url}
        autoPlay
        loop
        muted
        playsInline
        className={cls}
        style={mediaStyle}
      />
    );

  return createPortal(
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-black text-white">
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
          className="ml-auto rounded-full bg-white px-4 py-1.5 text-xs font-black text-black disabled:opacity-70"
        >
          {busy ? `Posting ${pct}%` : "Posting"}
        </button>
      </div>

      {/* Pratinjau media + lapisan */}
      <div
        ref={previewRef}
        className="relative flex-1 touch-none overflow-hidden"
        onPointerMove={onPreviewMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {aspect?.ratio ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: aspect.ratio, width: aspect.width }}
            >
              {mediaEl("size-full object-cover")}
            </div>
          </div>
        ) : (
          mediaEl(mediaClass)
        )}

        {/* Lapisan teks */}
        {edit.texts.map((t) => (
          <p
            key={t.id}
            onPointerDown={onLayerDown("text", t.id)}
            className={cn(
              "absolute max-w-[86%] -translate-x-1/2 -translate-y-1/2 cursor-grab select-none text-center text-lg font-black leading-snug",
              sel?.kind === "text" && sel.id === t.id && "ring-2 ring-sky-400/80",
              t.bg && "rounded-lg px-2.5 py-0.5",
            )}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              color: t.color,
              fontFamily: fontCss(t.font),
              textShadow: t.outline ? OUTLINE_SHADOW : "none",
              background: t.bg ? "rgba(0,0,0,0.55)" : "transparent",
              transform: `translate(-50%, -50%) scale(${t.scale}) rotate(${t.rotate ?? 0}deg)`,
            }}
          >
            {t.text}
          </p>
        ))}

        {/* Lapisan stiker */}
        {edit.stickers.map((s) => (
          <span
            key={s.id}
            onPointerDown={onLayerDown("sticker", s.id)}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 cursor-grab select-none leading-none",
              sel?.kind === "sticker" && sel.id === s.id && "rounded-xl ring-2 ring-sky-400/80",
            )}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              fontSize: `${s.size * 100}px`,
              transform: `translate(-50%, -50%) rotate(${s.rotate ?? 0}deg)`,
            }}
          >
            {s.emoji}
          </span>
        ))}

        {items.length > 1 && (
          <>
            <button
              onClick={() => {
                setIdx((i) => Math.max(0, i - 1));
                setSel(null);
              }}
              aria-label="Sebelumnya"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => {
                setIdx((i) => Math.min(items.length - 1, i + 1));
                setSel(null);
              }}
              aria-label="Berikutnya"
              // Panah kanan dipindah ke sisi kiri (sebelah panah kiri) supaya
              // kolom tombol alat di kanan tidak bertabrakan dengannya.
              className="absolute left-14 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
        {/* Kolom alat vertikal di kanan pratinjau: Teks, Stiker, Pangkas,
            Suara, Privasi. Icon-only supaya tetap ringkas di layar kecil. */}
        <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "teks") {
                  beginTextTool();
                  return;
                }
                setTool((v) => (v === t.id ? null : t.id));
              }}
              aria-label={t.label}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-95",
                tool === t.id
                  ? "border-white bg-white text-black"
                  : "border-white/20 bg-black/50 text-white hover:border-white/40",
              )}
            >
              <t.icon className="size-[18px]" />
            </button>
          ))}
        </div>

        {/* LAYAR TULIS FULLSCREEN — teks ditulis di area besar, kontrol
            menempel di atas keyboard. Bukan panel kecil di bawah lagi. */}
        {tool === "teks" && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/60 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 px-3 pt-3">
              <button
                type="button"
                onClick={commitTextTool}
                className="rounded-full bg-black/45 p-2 text-white"
                aria-label="Tutup editor teks"
              >
                <ChevronLeft className="size-5" />
              </button>
              <p className="text-[12px] font-black text-white/85">Tulis teks</p>
              <button
                type="button"
                onClick={commitTextTool}
                className="ml-auto rounded-full bg-white px-4 py-1.5 text-[11px] font-black text-black"
              >
                Selesai
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center px-4">
              <textarea
                autoFocus
                value={selText?.text ?? textDraft}
                onChange={(e) =>
                  selText
                    ? updateSelText({ text: e.target.value.slice(0, 120) })
                    : setTextDraft(e.target.value.slice(0, 120))
                }
                maxLength={120}
                rows={3}
                placeholder="Tulis apa yang kamu pikirkan…"
                className="max-h-[42dvh] w-full resize-none bg-transparent text-center text-[32px] font-black leading-tight text-white outline-none placeholder:text-white/30"
                style={{
                  fontFamily: selText ? fontCss(selText.font) : fontCss("modern"),
                  color: selText?.color ?? "#fff",
                  textShadow: selText?.outline === false ? "none" : OUTLINE_SHADOW,
                }}
              />
            </div>
            <div className="shrink-0 border-t border-white/12 bg-black/65 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
              {selText ? (
                <div className="thin-scroll flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Warna ${c}`}
                      onClick={() => updateSelText({ color: c })}
                      className={cn(
                        "size-7 shrink-0 rounded-full",
                        selText.color === c ? "ring-2 ring-white" : "",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <span className="h-5 w-px shrink-0 bg-white/20" />
                  {FONTS.slice(0, 3).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => updateSelText({ font: f.id })}
                      style={{ fontFamily: f.css }}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold",
                        selText.font === f.id
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/70",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateSelText({ outline: !selText.outline })}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold",
                      selText.outline
                        ? "bg-white text-black"
                        : "bg-white/10 text-white/70",
                    )}
                  >
                    Outline
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelText({ bg: !selText.bg })}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold",
                      selText.bg
                        ? "bg-white text-black"
                        : "bg-white/10 text-white/70",
                    )}
                  >
                    Latar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelText({ scale: Math.min(2, selText.scale + 0.15) })
                    }
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/70"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelText({ scale: Math.max(0.6, selText.scale - 0.15) })
                    }
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/70"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={removeSel}
                    className="shrink-0 rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-200"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-white/45">
                  Ketik teks, lalu atur warna, font, dan ukuran dari sini.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STICKER FULLSCREEN — overlay abu-abu 40%, tanpa panel kecil. */}
        {tool === "stiker" && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 px-3 pt-3">
              <button
                type="button"
                onClick={() => setTool(null)}
                className="rounded-full bg-black/45 p-2 text-white"
                aria-label="Tutup stiker"
              >
                <ChevronLeft className="size-5" />
              </button>
              <p className="text-[12px] font-black text-white/85">Stiker</p>
              {selSticker && (
                <button
                  type="button"
                  onClick={removeSel}
                  className="ml-auto rounded-full bg-red-500/20 px-3 py-1.5 text-[10px] font-bold text-red-200"
                >
                  Hapus stiker
                </button>
              )}
            </div>
            {selSticker && (
              <div className="mt-2 flex items-center gap-3 px-4">
                <span className="text-[9px] font-bold text-white/60">Ukuran</span>
                <input
                  type="range"
                  min={0.08}
                  max={0.4}
                  step={0.01}
                  value={selSticker.size}
                  onChange={(e) => {
                    if (!current) return;
                    setEdit(current.url, {
                      stickers: edit.stickers.map((s) =>
                        s.id === selSticker.id
                          ? { ...s, size: Number(e.target.value) }
                          : s,
                      ),
                    });
                  }}
                  className="min-w-0 flex-1 accent-white"
                />
              </div>
            )}
            <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
              {STICKER_PACKS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPackIdx(i)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                    packIdx === i
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/70",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="thin-scroll grid min-h-0 flex-1 grid-cols-6 content-start gap-2 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              {STICKER_PACKS[packIdx].items.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => addSticker(emoji)}
                  className="flex aspect-square items-center justify-center rounded-2xl bg-white/[0.08] text-3xl transition hover:bg-white/20 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Panel alat lain (pangkas / musik / suara / privasi): kartu melayang
            di atas media. Teks & stiker punya layar penuhnya sendiri. */}
        {tool && legacyTool !== "teks" && legacyTool !== "stiker" && (
          <div className="thin-scroll absolute bottom-3 left-2 right-14 z-20 max-h-[55%] touch-auto overflow-y-auto rounded-2xl border border-white/15 bg-[#12101a]/95 p-3 shadow-2xl backdrop-blur-sm">
          {/* ------------------------------ TEKS ------------------------------ */}
          {tool === "teks" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] font-bold">
                  <Type className="size-3.5" /> Teks
                </p>
                {selText && (
                  <button
                    onClick={removeSel}
                    className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300"
                  >
                    <Trash2 className="size-3" /> Hapus teks ini
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={selText ? selText.text : textDraft}
                  onChange={(e) =>
                    selText ? updateSelText({ text: e.target.value }) : setTextDraft(e.target.value)
                  }
                  placeholder="Tulis di sini…"
                  maxLength={120}
                  className="w-full rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/50"
                />
                {!selText && (
                  <button
                    onClick={addText}
                    disabled={!textDraft.trim()}
                    className="shrink-0 rounded-full bg-white px-4 text-xs font-black text-black disabled:opacity-40"
                  >
                    Tambah
                  </button>
                )}
              </div>
              {selText ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        aria-label={`Warna ${c}`}
                        onClick={() => updateSelText({ color: c })}
                        className={cn(
                          "size-7 rounded-full border-2 transition",
                          selText.color === c ? "border-sky-400 scale-110" : "border-white/20",
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => updateSelText({ outline: !selText.outline })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-semibold",
                        selText.outline
                          ? "border-white bg-white text-black"
                          : "border-white/30 text-white/80",
                      )}
                    >
                      Outline
                    </button>
                    <button
                      onClick={() => updateSelText({ bg: !selText.bg })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-semibold",
                        selText.bg
                          ? "border-white bg-white text-black"
                          : "border-white/30 text-white/80",
                      )}
                    >
                      Background
                    </button>
                    <span className="text-[10px] text-white/40">·</span>
                    {FONTS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => updateSelText({ font: f.id })}
                        style={{ fontFamily: f.css }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold",
                          selText.font === f.id
                            ? "border-white bg-white text-black"
                            : "border-white/30 text-white/80",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        updateSelText({ scale: Math.min(2, selText.scale + 0.15) })
                      }
                      className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-bold text-white/80"
                    >
                      A+
                    </button>
                    <button
                      onClick={() =>
                        updateSelText({ scale: Math.max(0.6, selText.scale - 0.15) })
                      }
                      className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-bold text-white/80"
                    >
                      A-
                    </button>
                    <label className="ml-auto flex items-center gap-1.5 rounded-full border border-white/25 px-2 py-1 text-[9px] font-bold text-white/55">
                      Rotasi
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={selText.rotate ?? 0}
                        onChange={(e) => updateSelText({ rotate: Number(e.target.value) })}
                        className="w-16 accent-sky-400"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-white/45">
                    Geser teks di pratinjau untuk memindahkannya.
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-white/45">
                  Tambah teks, lalu ketuk teksnya untuk mengubah warna, outline,
                  background, dan font. Geser langsung di pratinjau.
                </p>
              )}
            </div>
          )}

          {/* ----------------------------- STIKER ----------------------------- */}
          {tool === "stiker" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] font-bold">
                  <Sticker className="size-3.5" /> Stiker
                </p>
                {selSticker && (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.08}
                      max={0.4}
                      step={0.01}
                      value={selSticker.size}
                      onChange={(e) =>
                        current &&
                        setEdit(current.url, {
                          stickers: edit.stickers.map((s) =>
                            s.id === selSticker.id
                              ? { ...s, size: Number(e.target.value) }
                              : s,
                          ),
                        })
                      }
                      className="w-24"
                    />
                    <button
                      onClick={removeSel}
                      className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300"
                    >
                      <Trash2 className="size-3" /> Hapus
                    </button>
                  </div>
                )}
              </div>
              {selSticker && (
                <label className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[9px] font-bold text-white/55">
                  Rotasi stiker
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={selSticker.rotate ?? 0}
                    onChange={(e) => {
                      if (!current) return;
                      setEdit(current.url, {
                        stickers: edit.stickers.map((s) =>
                          s.id === selSticker.id
                            ? { ...s, rotate: Number(e.target.value) }
                            : s,
                        ),
                      });
                    }}
                    className="w-28 accent-sky-400"
                  />
                </label>
              )}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STICKER_PACKS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => setPackIdx(i)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold",
                      packIdx === i
                        ? "border-white bg-white text-black"
                        : "border-white/30 text-white/80",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {STICKER_PACKS[packIdx].items.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addSticker(emoji)}
                    className="flex aspect-square items-center justify-center rounded-xl bg-white/10 text-2xl transition hover:bg-white/20 active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/45">
                Ketuk stiker untuk menaruhnya, lalu geser di pratinjau.
              </p>
            </div>
          )}

          {/* ----------------------------- PANGKAS ---------------------------- */}
          {tool === "pangkas" && (
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-bold">
                <Crop className="size-3.5" /> Pangkas ukuran
              </p>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => current && setEdit(current.url, { crop: { ...edit.crop, aspect: a.id } })}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                      edit.crop.aspect === a.id
                        ? "border-white bg-white text-black"
                        : "border-white/30 text-white/80",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-white/70">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={edit.crop.zoom}
                  onChange={(e) =>
                    current &&
                    setEdit(current.url, {
                      crop: { ...edit.crop, zoom: Number(e.target.value) },
                    })
                  }
                  className="flex-1"
                />
                <span className="w-8 text-right text-[10px] text-white/60">
                  {edit.crop.zoom.toFixed(2)}x
                </span>
              </div>
              <p className="text-[10px] text-white/45">
                Pilih rasio frame lalu atur zoom. Foto &amp; video dipangkas
                mengikuti frame saat ditonton.
              </p>
            </div>
          )}

          {/* ------------------------------ MUSIK ----------------------------- */}
          {tool === "musik" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] font-bold">
                  <Music2 className="size-3.5" /> Lagu latar
                </p>
                <button
                  onClick={() => {
                    setMusic(null);
                    setTool(null);
                  }}
                  className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold text-white/80"
                >
                  Tanpa musik
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2">
                  <Search className="size-3.5 shrink-0 text-white/60" />
                  <input
                    value={mq}
                    onChange={(e) => setMq(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void doMusicSearch()}
                    placeholder="Cari lagu atau artis…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                  />
                </div>
                <button
                  onClick={() => void doMusicSearch()}
                  disabled={mSearching || mq.trim().length < 2}
                  className="shrink-0 rounded-full bg-white px-4 text-xs font-bold text-black disabled:opacity-40"
                >
                  {mSearching ? <Loader2 className="size-3.5 animate-spin" /> : "Cari"}
                </button>
              </div>
              {mResults && (
                <div className="thin-scroll max-h-56 space-y-1 overflow-y-auto">
                  {mResults.length === 0 && (
                    <p className="py-4 text-center text-[11px] text-white/50">
                      Tidak ada lagu yang cocok.
                    </p>
                  )}
                  {mResults.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setMusic(t);
                        setTool(null);
                        toast.success(`Lagu dipilih: ${t.title}`);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition",
                        music?.id === t.id ? "bg-white/20" : "hover:bg-white/10",
                      )}
                    >
                      {t.cover ? (
                        <img
                          src={t.cover}
                          alt=""
                          className="size-9 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                          <Music2 className="size-4 text-white/50" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{t.title}</span>
                        <span className="block truncate text-[10px] text-white/55">
                          {t.artist}
                        </span>
                      </span>
                      {music?.id === t.id && <Check className="size-4 shrink-0 text-sky-300" />}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-white/45">
                Lagu dari katalog Musik (iTunes/Internet Archive) — pratinjau audio
                langsung diputar.
              </p>
            </div>
          )}

          {/* ------------------------------ SUARA ----------------------------- */}
          {tool === "suara" && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[12px] font-bold">
                <Volume2 className="size-3.5" /> Suara
              </p>
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80">Suara asli (video)</span>
                  <span className="font-mono text-white/55">
                    {Math.round(mediaVol * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mediaVol}
                  onChange={(e) => setMediaVol(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80">Suara tambahan (musik)</span>
                  <span className="font-mono text-white/55">
                    {Math.round(musicVol * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicVol}
                  onChange={(e) => setMusicVol(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>
              <p className="text-[10px] text-white/45">
                Atur keseimbangan suara asli video dan lagu tambahan. Musik
                pratinjau langsung mengikuti slider ini.
              </p>
            </div>
          )}

          {/* ----------------------------- PRIVASI ---------------------------- */}
          {tool === "privasi" && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[12px] font-bold">
                <Lock className="size-3.5" /> Siapa yang bisa melihat
              </p>
              {PRIVACY_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                    privacy === p.id
                      ? "border-sky-400 bg-sky-400/10"
                      : "border-white/15 hover:border-white/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      privacy === p.id ? "border-sky-400 bg-sky-400" : "border-white/40",
                    )}
                  >
                    {privacy === p.id && <Check className="size-3 text-black" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold">{p.label}</span>
                    <span className="block text-[10px] text-white/55">{p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Bar bawah: hanya kotak panjang musik — semua tombol alat lain sudah
          pindah ke kolom vertikal di kanan pratinjau. */}
      <div className="border-t border-white/15 bg-black/80 p-2.5">
        <button
          onClick={() => setTool((v) => (v === "musik" ? null : "musik"))}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
            tool === "musik"
              ? "border-sky-400 bg-sky-400/10"
              : "border-white/20 bg-white/5 hover:border-white/40",
          )}
        >
          <Music2 className="size-4 shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold">
              {music ? music.title : "Pilih lagu untuk story"}
            </span>
            <span className="block truncate text-[9px] text-white/50">
              {music ? music.artist : "Ketuk untuk mencari lagu"}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-white/40" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* =============================== PENAMPIL =============================== */

type StoryItem = {
  _id: string;
  storageId: string;
  mediaType: "image" | "video";
  caption?: string;
  musicKey?: string;
  music?: {
    title: string;
    artist: string;
    cover?: string;
    audioUrl?: string;
    source?: string;
  };
  privacy?: "all" | "teman" | "diri";
  crop?: { aspect: string; zoom?: number };
  texts?: {
    text: string;
    color: string;
    outline: boolean;
    bg: boolean;
    font: string;
    x: number;
    y: number;
    scale?: number;
    rotate?: number;
  }[];
  stickers?: {
    emoji: string;
    x: number;
    y: number;
    size: number;
    rotate?: number;
  }[];
  mediaVol?: number;
  musicVol?: number;
  createdAt: number;
  viewCount?: number;
};

/**
 * Penampil story (fullscreen).
 *
 * - Bar progres di paling atas, satu per story, terisi sesuai durasi tampil.
 * - Ketuk kiri = mundur, ketuk kanan = maju. Seperti story pada umumnya.
 * - Lapisan teks & stiker ikut tampil, lagu latar diputar sesuai volume.
 * - Story sendiri punya tombol hapus dan tombol "siapa yang melihat".
 */
export function StoryViewer({
  userId,
  initialUserId,
  onClose,
}: {
  userId?: string;
  /** Mulai dari story user tertentu (mis. kartu status teman). */
  initialUserId?: string;
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
  const purgeExpired = useMutation(api.stories.purgeExpired);
  const sendDm = useMutation(api.chat.sendMessage);
  const { user: me } = useAuth();

  const [group, setGroup] = useState(0);
  const [idx, setIdx] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const groups = useMemo(() => feed ?? [], [feed]);
  const active = groups[group];
  const currentStory = active?.stories?.[idx];
  const viewingOwn =
    (!!userId && active?.userId === userId) ||
    (!!me && !!active && String(active.userId) === String(me._id));
  const initialGroup = useMemo(
    () =>
      initialUserId
        ? groups.findIndex((g) => String(g.userId) === String(initialUserId))
        : -1,
    [groups, initialUserId],
  );
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current || initialGroup < 0) return;
    jumpedRef.current = true;
    setGroup(initialGroup);
    setIdx(0);
  }, [initialGroup]);

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

  // Story berikutnya dipanaskan diam-diam selagi yang sekarang diputar.
  // Video tidak perlu menunggu query URL + buffering dari nol saat user
  // menekan layar; gambar berikutnya juga sudah masuk cache browser.
  const nextStory = useMemo(() => {
    const list = groups[group]?.stories ?? [];
    if (idx + 1 < list.length) return list[idx + 1];
    const nextGroup = groups[group + 1];
    return nextGroup?.stories?.[0];
  }, [groups, group, idx]);
  const nextUrl = useQuery(
    api.storage.getUrl,
    nextStory ? { storageId: nextStory.storageId } : "skip",
  );
  useEffect(() => {
    if (!nextUrl || !nextStory) return;
    if (nextStory.mediaType === "image") {
      const img = new Image();
      img.src = nextUrl;
      return;
    }
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = nextUrl;
    v.style.display = "none";
    document.body.appendChild(v);
    v.load();
    return () => {
      v.pause();
      v.removeAttribute("src");
      v.load();
      v.remove();
    };
  }, [nextUrl, nextStory]);

  useEffect(() => {
    setVideoReady(false);
  }, [currentStory?._id]);

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

  // Tandai dilihat — JANGAN mencatat pemilik sebagai penonton dirinya sendiri.
  useEffect(() => {
    if (!currentStory || viewingOwn) return;
    void markViewed({ storyId: currentStory._id as never }).catch(() => {});
  }, [currentStory, markViewed, viewingOwn]);

  // Story kedaluwarsa dibersihkan dari storage secara berkala (maks. sekali
  // per 6 jam per perangkat). Tampilan sudah difilter 24 jam di server.
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem("yn:story-purge") ?? 0);
      if (Date.now() - last < 6 * 3600_000) return;
      localStorage.setItem("yn:story-purge", String(Date.now()));
    } catch {
      /* mode privat */
    }
    void purgeExpired({}).catch(() => {});
  }, [purgeExpired]);

  // Gambar tampil 5 detik. Video TIDAK memakai timer tetap: progresnya
  // diambil dari timeupdate elemen video dan baru lanjut saat `ended`, jadi
  // durasi asli selalu dihormati dan tidak ada lompatan ganda.
  useEffect(() => {
    if (!currentStory || currentStory.mediaType !== "image") return;
    setProgress(0);
    const t0 = Date.now();
    const dur = 5000;
    const timer = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / dur) * 100);
      setProgress(p);
      if (p >= 100) next();
    }, 250);
    return () => window.clearInterval(timer);
  }, [currentStory, next]);

  // Reset balasan ketika pindah story.
  useEffect(() => {
    setReplyText("");
  }, [currentStory?._id]);

  // Lagu latar story diputar sesuai volume yang disimpan.
  const musicUrl = currentStory?.music?.audioUrl;
  const musicVol = currentStory?.musicVol ?? 0.6;
  useEffect(() => {
    if (!musicUrl) return;
    const a = new Audio(musicUrl);
    a.loop = true;
    a.volume = Math.min(1, Math.max(0, musicVol));
    void a.play().catch(() => {
      // Autoplay bisa ditolak; story tetap jalan tanpa musik.
    });
    return () => {
      a.pause();
    };
  }, [musicUrl, musicVol]);

  if (feed === undefined) {
    return createPortal(
      <div className="screen-enter fixed inset-0 z-[80] overflow-hidden bg-[#0b0b10]">
        <div className="skeleton absolute inset-0 rounded-none opacity-40" />
        <div className="absolute inset-x-0 top-0 flex gap-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="skeleton h-0.5 flex-1 rounded-full" />
          ))}
        </div>
        <div className="absolute inset-x-0 top-6 flex items-center gap-2 p-3">
          <div className="skeleton size-9 rounded-full" />
          <div className="space-y-1.5">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-2 w-14 rounded-full" />
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-3 top-8 z-10 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
        >
          <X className="size-4" />
        </button>
      </div>,
      document.body,
    );
  }

  if (!active || !currentStory) {
    return createPortal(
      <div className="screen-enter fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black">
        <p className="text-sm font-semibold text-white/70">Tidak ada story</p>
        <button
          onClick={onClose}
          className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold text-white"
        >
          Tutup
        </button>
      </div>,
      document.body,
    );
  }

  const list = active.stories;
  // Media mengisi SELURUH layar (cover), termasuk area di belakang header dan
  // footer. Tidak ada lagi kotak/letterbox setengah layar.
  const mediaStyle = undefined;

  const sendReply = async (text: string) => {
    const t = text.trim();
    if (!t || replyBusy || viewingOwn) return;
    setReplyBusy(true);
    try {
      await sendDm({
        kind: "dm",
        peerId: active.userId as Id<"users">,
        text: t.slice(0, 240),
      });
      setReplyText("");
      toast.success(`Balasan terkirim ke DM ${active.username}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim balasan");
    } finally {
      setReplyBusy(false);
    }
  };

  const renderMedia = (cls: string) =>
    currentStory.mediaType === "image" ? (
      url ? (
        <img
          src={url}
          alt=""
          loading="eager"
          decoding="async"
          className={cls}
          style={mediaStyle}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-black">
          <Loader2 className="size-7 animate-spin text-white/55" />
        </div>
      )
    ) : url ? (
      <video
        ref={(el) => {
          if (el) el.volume = Math.min(1, Math.max(0, currentStory.mediaVol ?? 1));
        }}
        key={currentStory._id}
        src={url}
        autoPlay
        playsInline
        preload="auto"
        controls={false}
        onCanPlay={() => setVideoReady(true)}
        onLoadedData={() => setVideoReady(true)}
        onWaiting={() => setVideoReady(false)}
        onPlaying={() => setVideoReady(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration) && v.duration > 0) {
            setProgress(
              Math.min(100, Math.max(0, (v.currentTime / v.duration) * 100)),
            );
          }
        }}
        onEnded={next}
        className={cls}
        style={mediaStyle}
      />
    ) : (
      <div className="flex size-full items-center justify-center bg-black">
        <Loader2 className="size-7 animate-spin text-white/55" />
      </div>
    );

  return createPortal(
    <div className="screen-enter fixed inset-0 z-[80] overflow-hidden bg-black">
      {/* Media mengisi seluruh layar; header/footer mengapung di atasnya. */}
      <div className="absolute inset-0 z-0">{renderMedia("size-full object-cover")}</div>
      {currentStory.mediaType === "video" && !videoReady && url && (
        <div className="pointer-events-none absolute inset-0 z-[2] grid place-items-center bg-black/15">
          <Loader2 className="size-7 animate-spin text-white/65" />
        </div>
      )}

      {/* Bar progres + header mengapung di atas media. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-[linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,.28)_68%,transparent)] pb-10">
        <div className="pointer-events-auto flex gap-1 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          {list.map((s, i) => (
            <span key={s._id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-3 px-3 pb-2.5 pt-3">
          <StoryRing image={active.userImage} seed={active.username} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black leading-tight text-white">
              {active.username}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-white/72">
              {Math.max(1, Math.round((Date.now() - currentStory.createdAt) / 3600000))} jam lalu
              {currentStory.privacy === "teman" && (
                <span className="ml-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold">
                  TEMAN
                </span>
              )}
              {currentStory.privacy === "diri" && (
                <span className="ml-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold">
                  PRIBADI
                </span>
              )}
            </p>
          </div>
          {viewingOwn && (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Hapus story"
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
            >
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
          >
            <X className="size-[18px]" />
          </button>
        </div>
      </div>

      {/* Lapisan teks/stiker + zona ketuk. */}
      <div className="absolute inset-0 z-10 overflow-hidden">

        {/* Teks dari penyunting */}
        {currentStory.texts?.map((t, i) => (
          <p
            key={`t${i}`}
            className={cn(
              "pointer-events-none absolute max-w-[86%] text-center text-lg font-black leading-snug",
              t.bg && "rounded-lg px-2.5 py-0.5",
            )}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              color: t.color,
              fontFamily: fontCss(t.font),
              textShadow: t.outline ? OUTLINE_SHADOW : "none",
              background: t.bg ? "rgba(0,0,0,0.55)" : "transparent",
              transform: `translate(-50%, -50%) scale(${t.scale ?? 1}) rotate(${t.rotate ?? 0}deg)`,
            }}
          >
            {t.text}
          </p>
        ))}

        {/* Stiker dari penyunting */}
        {currentStory.stickers?.map((s, i) => (
          <span
            key={`s${i}`}
            className="pointer-events-none absolute leading-none"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              fontSize: `${s.size * 100}px`,
              transform: `translate(-50%, -50%) rotate(${s.rotate ?? 0}deg)`,
            }}
          >
            {s.emoji}
          </span>
        ))}

        {(currentStory.music || (currentStory.musicKey && currentStory.musicKey !== "none")) && (
          <span className="absolute left-3 bottom-20 flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">
            <Music2 className="size-3 shrink-0" />
            <span className="truncate">
              {currentStory.music
                ? `${currentStory.music.title} — ${currentStory.music.artist}`
                : trackOf(currentStory.musicKey).label}
            </span>
          </span>
        )}

        {/* Dua zona ketuk, tanpa tombol yang terlihat. */}
        <button
          onClick={prev}
          aria-label="Sebelumnya"
          className="absolute inset-y-0 left-0 z-10 w-1/3"
        />
        <button
          onClick={next}
          aria-label="Berikutnya"
          className="absolute inset-y-0 right-0 z-10 w-2/3"
        />
      </div>

      {/* Footer mengapung di bawah media. Pemilik hanya mendapat ikon mata +
          jumlah penonton, tanpa latar tombol. */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(0deg,rgba(0,0,0,.82),rgba(0,0,0,.36)_62%,transparent)] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-12">
        {currentStory.caption && (
          <p className="mb-2 text-center text-[13px] font-semibold leading-snug text-white [text-shadow:0_2px_8px_rgba(0,0,0,.8)]">
            {currentStory.caption}
          </p>
        )}
        {viewingOwn ? (
          <button
            type="button"
            onClick={() => setShowViewers(true)}
            className="mx-auto flex items-center justify-center gap-2 py-2 text-[17px] font-black text-white transition active:scale-[0.96]"
          >
            <Eye className="size-[22px]" strokeWidth={2.8} />
            <span className="tabular-nums">{viewers?.length ?? 0}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-full border border-white/15 bg-white/[0.07] pl-3 pr-1">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 240))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendReply(replyText);
                }}
                placeholder={`Balas status ${active.username}…`}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => void sendReply(replyText)}
                disabled={replyBusy || !replyText.trim()}
                className="grid size-8 shrink-0 place-items-center rounded-full text-black disabled:opacity-40"
                style={{ background: "var(--ui-c, #FFD23F)" }}
                aria-label="Kirim balasan ke DM"
              >
                {replyBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="size-4" strokeWidth={3} />
                )}
              </button>
            </div>
            {["❤️", "😂", "👍"].map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => void sendReply(emoji)}
                disabled={replyBusy}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.07] text-[17px] transition active:scale-90 disabled:opacity-50"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DAFTAR PENONTON — sheet 50% layar, tanpa blur, animasi dari bawah. */}
      <AnimatePresence>
        {showViewers && viewingOwn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[95] flex items-end bg-black/45"
          >
            <button
              aria-label="Tutup daftar penonton"
              className="absolute inset-0"
              onClick={() => setShowViewers(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-[50dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-white/12 bg-[#100e16] pb-[max(env(safe-area-inset-bottom),0.75rem)]"
            >
              <div className="flex items-center gap-2 px-4 pb-2 pt-3">
                <div className="mx-auto h-1 w-11 rounded-full bg-white/20" />
              </div>
              <div className="flex items-baseline justify-between px-4 pb-2">
                <p className="text-[14px] font-black text-white">
                  Dilihat {viewers?.length ?? 0}
                </p>
                <button
                  onClick={() => setShowViewers(false)}
                  aria-label="Tutup"
                  className="text-white/45"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3">
                {(viewers ?? []).length === 0 ? (
                  <p className="py-10 text-center text-[12px] text-white/45">
                    Belum ada yang melihat.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {(viewers ?? []).map((v) => (
                      <div
                        key={v.userId}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2"
                      >
                        <img
                          src={v.userImage || avatarFallback(v.username)}
                          alt=""
                          className="size-10 rounded-full bg-white/10 object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                          {v.username}
                        </span>
                        <span className="shrink-0 text-[9px] text-white/30">
                          {new Date(v.at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KONFIRMASI HAPUS — popup minimalis, bukan langsung menghapus. */}
      <AnimatePresence>
        {confirmDelete && viewingOwn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-5"
            onClick={() => !deleting && setConfirmDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[19rem] overflow-hidden rounded-[26px] border border-white/12 bg-[#14121b] p-4"
            >
              <div className="mx-auto grid size-11 place-items-center rounded-full bg-rose-500/15 text-rose-300">
                <Trash2 className="size-5" />
              </div>
              <p className="mt-3 text-center text-[15px] font-black text-white">
                Hapus story ini?
              </p>
              <p className="mt-1 text-center text-[11px] leading-relaxed text-white/45">
                Story akan hilang dari profil dan feed temanmu.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-xl border border-white/12 py-2.5 text-[12px] font-bold text-white/70"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setDeleting(true);
                    void removeStory({ storyId: currentStory._id as never })
                      .then(() => {
                        toast.success("Story dihapus");
                        setConfirmDelete(false);
                        setDeleting(false);
                        next();
                      })
                      .catch((e: unknown) => {
                        setDeleting(false);
                        toast.error(
                          e instanceof Error ? e.message : "Gagal hapus",
                        );
                      });
                  }}
                  className="rounded-xl bg-rose-500 py-2.5 text-[12px] font-black text-white disabled:opacity-60"
                >
                  {deleting ? "Menghapus…" : "Hapus"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
