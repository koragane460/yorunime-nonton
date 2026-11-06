// YoruNime — MENU: satu layar berisi daftar semua layar aplikasi.
// Dibuka dari panel tengah (Panel › Menu). Fitur Pintasan sudah dihapus.
import { useNavigate } from "react-router";
import {
  Bookmark,
  Clapperboard,
  Compass,
  Crown,
  Film,
  Image as ImageIcon,
  Info,
  Music,
  Play,
  Sparkles,
  Tag,
  Tv,
  User,
  Users,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";

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

export default function MenuPage() {
  return (
    <AppLayout hideAccountPanel>
      <MenuContent />
    </AppLayout>
  );
}

function MenuContent() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Menu</h1>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Semua layar YoruNime dalam satu tempat.
        </p>
      </header>

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
