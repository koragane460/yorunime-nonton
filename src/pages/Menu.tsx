// YoruNime — MENU: satu layar berisi daftar semua layar aplikasi.
// Dibuka dari panel tengah (Panel › Menu). Fitur Pintasan sudah dihapus.
import { useNavigate } from "react-router";
import type { ComponentType } from "react";
import { CrystalIcon } from "@/components/lstream-ui";
import {
  Bookmark,
  Clapperboard,
  Compass,
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
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
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
  { path: "/gacha", label: "Gacha", hint: "Mesin hadiah", Icon: Sparkles },
  { path: "/music", label: "Musik", hint: "Putar musik", Icon: Music },
  { path: "/premium", label: "Premium", hint: "Langganan", Icon: CrystalIcon },
  { path: "/info", label: "Lanjutkan", hint: "Lanjut dari terakhir", Icon: Info },
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
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header>
        <p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white/28">
          <span className="font-serif text-[15px] font-normal leading-none tracking-normal text-[var(--primary)]">
            /
          </span>
          Navigasi
        </p>
        <h1 className="mt-0.5 font-display text-[27px] font-bold leading-none tracking-[-0.045em]">
          Menu
        </h1>
        <p className="mt-1.5 text-[10px] leading-snug text-white/34">
          Semua ruang YoruNime dalam satu tempat.
        </p>
      </header>

      <section className="mt-5">
        <h2 className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/26">
          Semua layar
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DESTINATIONS.map(({ path, label, hint, Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex min-h-[58px] items-center gap-2.5 rounded-xl border border-white/8 bg-[#101215] px-3 py-2.5 text-left transition hover:border-white/16 hover:bg-[#13161a] active:scale-[0.98]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-white/38">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold leading-tight text-white/82">
                  {label}
                </span>
                <span className="block truncate text-[9px] leading-tight text-white/26">
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
