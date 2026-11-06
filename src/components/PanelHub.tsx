import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { FramedAvatar } from "@/components/FramedAvatar";
import { BlueCheck } from "@/components/lstream-ui";
import { TierIcon } from "@/components/ProfileSheet";
import { badgeForLevel, displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import {
  Award,
  Bone,
  BookOpen,
  Clapperboard,
  Crown,
  Download,
  Gem,
  History,
  ListChecks,
  Mic,
  Music,
  Newspaper,
  LayoutGrid,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  type LucideIcon,
} from "lucide-react";

/* ====================================================================== *
 *  PANEL — tombol tengah navigasi bawah.
 *
 *  Feed & Baca DIGABUNG jadi satu tombol ("Panel") yang lebih besar di
 *  tengah bar. Ditekan → sheet setinggi 55% layar berisi profil + kotak
 *  pengsingkat: Feed · Baca · History · Download · Clan · Music · YoruPet ·
 *  Title · Shop.
 * ====================================================================== */

export type PanelKey =
  | "yoraverse"
  | "quest"
  | "sticker"
  | "nobar"
  | "voice"
  | "feed"
  | "baca"
  | "history"
  | "download"
  | "clan"
  | "music"
  | "pet"
  | "title"
  | "shop";

const BOXES: {
  key: PanelKey;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: string;
}[] = [
  { key: "quest", label: "Quest", hint: "Misi harian", Icon: ListChecks, tone: "from-amber-400/18 via-white/[0.05] to-transparent" },
  { key: "sticker", label: "Shop Sticker", hint: "Pack chat", Icon: Sticker, tone: "from-violet-400/20 via-white/[0.05] to-transparent" },
  { key: "nobar", label: "Nobar", hint: "Nonton bareng", Icon: Clapperboard, tone: "from-sky-400/20 via-white/[0.05] to-transparent" },
  { key: "voice", label: "Voice", hint: "Room suara", Icon: Mic, tone: "from-emerald-400/18 via-white/[0.05] to-transparent" },
  { key: "feed", label: "Feed", hint: "Konten teman", Icon: Newspaper, tone: "from-rose-400/14 via-white/[0.04] to-transparent" },
  { key: "baca", label: "Baca", hint: "Manga & manhwa", Icon: BookOpen, tone: "from-orange-400/14 via-white/[0.04] to-transparent" },
  { key: "history", label: "History", hint: "Yang ditonton", Icon: History, tone: "from-white/[0.1] via-white/[0.04] to-transparent" },
  { key: "download", label: "Download", hint: "Tersimpan", Icon: Download, tone: "from-white/[0.1] via-white/[0.04] to-transparent" },
  { key: "clan", label: "Clan", hint: "Grup kamu", Icon: Shield, tone: "from-gold/20 via-white/[0.05] to-transparent" },
  { key: "music", label: "Music", hint: "Player & playlist", Icon: Music, tone: "from-fuchsia-400/16 via-white/[0.04] to-transparent" },
  { key: "pet", label: "YoruPet", hint: "Peliharaanmu", Icon: Bone, tone: "from-lime-400/14 via-white/[0.04] to-transparent" },
  { key: "title", label: "Title", hint: "Gelar profile", Icon: Award, tone: "from-indigo-400/16 via-white/[0.04] to-transparent" },
  { key: "shop", label: "Shop", hint: "Border & cosmetic", Icon: ShoppingBag, tone: "from-white/[0.12] via-white/[0.05] to-transparent" },
];

/** Sheet 55% layar — profil di atas, 9 kotak (3×3) di bawahnya. */
export function PanelHub({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (key: PanelKey) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const level = user?.level ?? 1;
  const premium = ((user as any)?.premiumUntil ?? 0) > Date.now();
  const premiumDays = Math.max(
    0,
    Math.floor((((user as any)?.premiumUntil ?? 0) - Date.now()) / 86400000),
  );
  const sacret = (user as any)?.diamonds ?? 0;

  return (
    <div className="fixed inset-0 z-[85]">
      {/* Latar gelap — ketuk untuk menutup. */}
      <button
        aria-label="Tutup panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
      />
      {/* Sheet 68% tinggi layar — TANPA outline. */}
      <div className="screen-enter absolute inset-x-0 bottom-0 flex h-[68dvh] flex-col overflow-hidden rounded-t-[28px] bg-[#0d1017] shadow-[0_-30px_60px_-30px_rgba(0,0,0,1)]">
        {/* Pegangan tarik */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-11 rounded-full bg-white/25" />
        </div>

        {/* Profil singkat */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-3">
          <FramedAvatar
            border={(user as any)?.avatarBorder}
            src={user?.image}
            seed={user?.username}
            className="size-14 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[15px] font-black leading-tight">
                {user?.username ?? "user"}
              </p>
              {premium && <BlueCheck className="size-3.5 shrink-0" />}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold">
                <TierIcon tier={badgeForLevel(level).name} className="size-3" />
                Lv.{level}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-white/45">
              ID {displayId((user as any)?.seqId)}
            </p>
          </div>
          <span className="yn-eyebrow shrink-0 text-[9px]">Panel</span>
        </div>

        {/* KOTAK SALDO — di bawah header akun. Bentuk & ukuran BEDA dari
            9 kotak panel di bawahnya (baris lebar dua sisi, tanpa outline). */}
        <div className="mx-4 mb-3 grid grid-cols-2 gap-2 rounded-[24px] bg-gradient-to-r from-sky-400/18 via-white/[0.07] to-amber-400/18 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
              <Gem className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                Sacret
              </span>
              <span className="block truncate text-[17px] font-black leading-tight text-white">
                {sacret.toLocaleString("id-ID")}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
              <Crown className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                Mahkota
              </span>
              <span className="block truncate text-[17px] font-black leading-tight text-white">                {premium ? `${premiumDays} hari` : "-"}
              </span>
            </span>
          </div>
        </div>

        {/* YoruVerse + isi panel */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          <button
            onClick={() => onPick("yoraverse")}
            className="relative mb-2.5 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-gold/35 bg-[linear-gradient(120deg,rgba(255,210,63,.16),rgba(255,255,255,.045))] px-3 py-3 text-left transition active:scale-[0.99]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-black leading-tight text-white">
                YoruVerse
              </span>
              <span className="block truncate text-[10px] leading-tight text-white/45">
                Quest, shop, nobar, voice &amp; lainnya
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-[10px] font-black text-black">
              Buka
            </span>
          </button>

          {/* Pintasan ke layar MENU (daftar semua tujuan aplikasi). */}
          <button
            onClick={() => {
              onClose();
              navigate("/menu");
            }}
            className="mb-2.5 flex w-full items-center gap-2.5 rounded-2xl border border-[#1CA7EC]/35 bg-[#1CA7EC]/10 px-3 py-2.5 text-left transition active:scale-[0.99]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1CA7EC] text-[#FFFAF0]">
              <LayoutGrid className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-black leading-tight text-white">
                Menu
              </span>
              <span className="block truncate text-[10px] leading-tight text-white/45">
                Semua layar YoruNime
              </span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            {BOXES.map(({ key, label, hint, Icon, tone }) => (
              <button
                key={key}
                onClick={() => onPick(key)}
                className={cn(
                  "group flex min-h-[86px] flex-col items-start justify-between gap-2 rounded-2xl border border-white/[0.07] bg-gradient-to-br p-3 text-left",
                  tone,
                  "transition hover:border-gold-strong/45 active:scale-[0.97]",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-black/30 text-white/90 transition group-hover:text-gold-strong">
                  <Icon className="size-[17px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-black leading-tight text-white">
                    {label}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-white/45">
                    {hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
