// YoruNime — MENU: satu layar berisi (1) pintasan milik user dan (2) daftar
// semua layar aplikasi. Dibuka dari panel tengah (Panel › Menu).
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  Clapperboard,
  Compass,
  Crown,
  Film,
  Flame,
  Image as ImageIcon,
  Info,
  Link2,
  Music,
  Play,
  Plus,
  Rss,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Tv,
  User,
  Users,
  X,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { cn } from "@/lib/utils";

/** Daftar tujuan aplikasi — dipakai grid "Semua layar". */
const DESTINATIONS: {
  path: string;
  label: string;
  hint: string;
  Icon: typeof Play;
}[] = [
  { path: "/home", label: "Anime", hint: "Beranda & lanjut nonton", Icon: Play },
  { path: "/film", label: "Film", hint: "Film & series", Icon: Film },
  { path: "/jadwal", label: "Jadwal", hint: "Rilis minggu ini", Icon: Tv },
  { path: "/manga", label: "Manga", hint: "Baca manga", Icon: Bookmark },
  { path: "/manhwa", label: "Manhwa", hint: "Baca manhwa", Icon: Bookmark },
  { path: "/baca", label: "Baca", hint: "Katalog baca", Icon: Compass },
  { path: "/feed", label: "Feed", hint: "Konten komunitas", Icon: ImageIcon },
  { path: "/clan", label: "Clan", hint: "Clan & nobar bareng", Icon: Users },
  { path: "/catalog", label: "Katalog", hint: "Semua judul", Icon: Clapperboard },
  { path: "/title", label: "Title", hint: "Pasang title", Icon: Tag },
  { path: "/gacha", label: "Gacha", hint: "Mesin hadiah", Icon: Sparkles },
  { path: "/music", label: "Musik", hint: "Putar musik", Icon: Music },
  { path: "/premium", label: "Premium", hint: "Langganan", Icon: Crown },
  { path: "/info", label: "Info", hint: "Tentang YoruNime", Icon: Info },
  { path: "/akun", label: "Akun", hint: "Profil & pengaturan", Icon: User },
];

/** Ikon yang boleh dipakai pintasan — nama disimpan di DB. */
const ICONS: { key: string; Icon: typeof Play; label: string }[] = [
  { key: "play", Icon: Play, label: "Nonton" },
  { key: "film", Icon: Film, label: "Film" },
  { key: "bookmark", Icon: Bookmark, label: "Simpan" },
  { key: "star", Icon: Star, label: "Favorit" },
  { key: "flame", Icon: Flame, label: "Populer" },
  { key: "users", Icon: Users, label: "Sosial" },
  { key: "link", Icon: Link2, label: "Tautan" },
  { key: "rss", Icon: Rss, label: "Feed" },
];

const iconFor = (key?: string) =>
  ICONS.find((i) => i.key === key)?.Icon ?? Link2;

export default function MenuPage() {
  return (
    <AppLayout hideAccountPanel>
      <MenuContent />
    </AppLayout>
  );
}

function MenuContent() {
  const navigate = useNavigate();
  const rows = useQuery(api.shortcuts.list, {});
  const addShortcut = useMutation(api.shortcuts.add);
  const removeShortcut = useMutation(api.shortcuts.remove);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("play");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const list = rows ?? [];

  const openTarget = (dest: string) => {
    if (/^https?:\/\//i.test(dest)) {
      window.open(dest, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(dest);
  };

  const save = async () => {
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await addShortcut({ label, target, icon });
      setLabel("");
      setTarget("");
      setIcon("play");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan pintasan");
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (id: string) => {
    setErr("");
    try {
      await removeShortcut({ id: id as never });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menghapus pintasan");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Menu</h1>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Semua layar dalam satu tempat, plus tombol cepat buatan kamu.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-2 text-[11px] font-black text-[#241c02] transition active:scale-95"
        >
          {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {open ? "Tutup" : "Pintasan"}
        </button>
      </header>

      {err && (
        <p className="mt-3 rounded-2xl bg-destructive/15 px-3 py-2 text-[11px] font-bold text-destructive">
          {err}
        </p>
      )}

      {/* ---------- PINTASAN MILIK USER ---------- */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-white/60">
            Pintasan kamu
          </h2>
          <span className="text-[10px] font-bold text-white/35">
            {list.length}/8
          </span>
        </div>

        {list.length === 0 && !open && (
          <p className="mt-2 rounded-2xl border border-dashed border-white/15 px-3 py-6 text-center text-[11px] leading-snug text-white/45">
            Belum ada pintasan. Tekan{" "}
            <span className="font-bold text-gold">Pintasan</span> untuk
            menyimpan halaman favoritmu — misalnya satu episode atau satu tautan.
          </p>
        )}

        {list.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((s) => {
              const Icon = iconFor(s.icon);
              return (
                <div key={s._id} className="relative">
                  <button
                    onClick={() => openTarget(s.target)}
                    className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-card px-3 py-2.5 text-left transition active:scale-[0.98]"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1CA7EC]/18 text-[#1CA7EC]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-black leading-tight">
                        {s.label}
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-white/40">
                        {s.target}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => void hapus(s._id)}
                    aria-label={`Hapus pintasan ${s.label}`}
                    className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-[#E84855] text-[#FFFAF0] shadow transition active:scale-90"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {open && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-card p-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
              Nama tombol
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nonton One Piece"
              maxLength={20}
              className="mt-1 w-full rounded-xl bg-black/35 px-3 py-2 text-[13px] outline-none placeholder:text-white/30"
            />
            <label className="mt-2.5 block text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
              Tujuan
            </label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="/nonton?id=21  atau  https://…"
              className="mt-1 w-full rounded-xl bg-black/35 px-3 py-2 text-[13px] outline-none placeholder:text-white/30"
            />
            <p className="mt-1 text-[10px] leading-snug text-white/35">
              Path aplikasi diawali “/”, tautan luar diawali “http(s)://”.
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ICONS.map(({ key, Icon, label: lbl }) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  title={lbl}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition",
                    icon === key
                      ? "bg-[#1CA7EC] text-[#FFFAF0]"
                      : "bg-white/[0.06] text-white/55",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>

            <button
              onClick={() => void save()}
              disabled={busy || !label.trim() || !target.trim()}
              className="mt-3 w-full rounded-full bg-gold py-2.5 text-[12px] font-black text-[#241c02] transition active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Simpan pintasan"}
            </button>
          </div>
        )}
      </section>

      {/* ---------- SEMUA LAYAR ---------- */}
      <section className="mt-6">
        <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-white/60">
          Semua layar
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DESTINATIONS.map(({ path, label, hint, Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card px-3 py-2.5 text-left transition active:scale-[0.98]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-gold">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-black leading-tight">
                  {label}
                </span>
                <span className="block truncate text-[10px] leading-tight text-white/40">
                  {hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
