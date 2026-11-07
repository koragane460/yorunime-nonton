import { useAuth } from "@/hooks/use-auth";
import { FramedAvatar } from "@/components/FramedAvatar";
import { BlueCheck, LevelBadge } from "@/components/lstream-ui";
import { displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import {
  Award,
  Bone,
  BookOpen,
  Clapperboard,
  Download,
  Gem,
  History,
  ListChecks,
  Mic,
  Music,
  Newspaper,
  Shield,
  ShoppingBag,
  Sticker,
  type LucideIcon,
} from "lucide-react";

/* ====================================================================== *
 *  PANEL — tombol tengah navigasi bawah.
 *
 *  Sheet 60% layar: profil singkat + saldo, lalu grid 2 kolom ke bawah.
 *  YoruVerse dan pintasan Menu sudah dihapus; fitur di dalamnya tetap
 *  dapat dibuka langsung dari kotak Panel.
 * ====================================================================== */

export type PanelKey =
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
  { key: "quest", label: "Quest", hint: "Misi harian", Icon: ListChecks, tone: "from-amber-400/55 via-orange-500/28 to-rose-500/18" },
  { key: "sticker", label: "Shop Sticker", hint: "Pack chat", Icon: Sticker, tone: "from-violet-500/55 via-purple-500/28 to-sky-500/18" },
  { key: "nobar", label: "Nobar", hint: "Nonton bareng", Icon: Clapperboard, tone: "from-sky-400/55 via-cyan-500/28 to-indigo-500/18" },
  { key: "voice", label: "Voice", hint: "Room suara", Icon: Mic, tone: "from-emerald-400/55 via-teal-500/28 to-cyan-500/18" },
  { key: "feed", label: "Feed", hint: "Konten teman", Icon: Newspaper, tone: "from-rose-400/55 via-pink-500/28 to-amber-500/18" },
  { key: "baca", label: "Baca", hint: "Manga & manhwa", Icon: BookOpen, tone: "from-orange-400/55 via-amber-500/28 to-emerald-500/18" },
  { key: "history", label: "History", hint: "Yang ditonton", Icon: History, tone: "from-cyan-400/55 via-sky-500/28 to-violet-500/18" },
  { key: "download", label: "Download", hint: "Tersimpan", Icon: Download, tone: "from-blue-400/55 via-indigo-500/28 to-fuchsia-500/18" },
  { key: "clan", label: "Clan", hint: "Grup kamu", Icon: Shield, tone: "from-amber-300/50 via-yellow-500/28 to-emerald-500/18" },
  { key: "music", label: "Music", hint: "Player & playlist", Icon: Music, tone: "from-fuchsia-500/55 via-purple-500/28 to-rose-500/18" },
  { key: "pet", label: "YoruPet", hint: "Peliharaanmu", Icon: Bone, tone: "from-lime-400/50 via-emerald-500/28 to-teal-500/18" },
  { key: "title", label: "Title", hint: "Gelar profile", Icon: Award, tone: "from-indigo-400/55 via-blue-500/28 to-cyan-500/18" },
  { key: "shop", label: "Shop", hint: "Border & cosmetic", Icon: ShoppingBag, tone: "from-orange-400/55 via-rose-500/28 to-fuchsia-500/18" },
];

export function PanelHub({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (key: PanelKey) => void;
}) {
  const { user } = useAuth();
  const level = user?.level ?? 1;
  const premium = ((user as any)?.premiumUntil ?? 0) > Date.now();
  const premiumDays = Math.max(
    0,
    Math.floor((((user as any)?.premiumUntil ?? 0) - Date.now()) / 86400000),
  );
  const sacret = (user as any)?.diamonds ?? 0;

  return (
    <div className="fixed inset-0 z-[85]">
      <button
        aria-label="Tutup panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
      />
      <div className="screen-enter absolute inset-x-0 bottom-0 mx-auto flex h-[60dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[linear-gradient(160deg,#211526_0%,#121a2a_52%,#1b1320_100%)] shadow-[0_-30px_60px_-30px_rgba(0,0,0,1)]">
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-11 rounded-full bg-white/25" />
        </div>

        <div className="flex items-center gap-3 px-4 pb-2.5 pt-3">
          <FramedAvatar
            border={(user as any)?.avatarBorder}
            src={user?.image}
            seed={user?.username}
            className="size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[15px] font-black leading-tight">
                {user?.username ?? "user"}
              </p>
              {premium && <BlueCheck className="size-3.5 shrink-0" />}
              <LevelBadge level={level} className="scale-95 origin-left" />
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-white/45">
              ID {displayId((user as any)?.seqId)}
            </p>
          </div>
          <span className="yn-eyebrow shrink-0 text-[9px]">Panel</span>
        </div>

        <div className="mx-4 mb-2.5 grid grid-cols-2 gap-2 rounded-[22px] bg-gradient-to-r from-sky-400/20 via-cyan-400/10 to-amber-400/20 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
              <Gem className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                Sacret
              </span>
              <span className="block truncate text-[16px] font-black leading-tight text-white">
                {sacret.toLocaleString("id-ID")}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
              <Gem className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                Premium
              </span>
              <span className="block truncate text-[16px] font-black leading-tight text-white">
                {premium ? `${premiumDays} hari` : "-"}
              </span>
            </span>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          <div className="grid grid-cols-3 gap-2">
            {BOXES.map(({ key, label, hint, Icon, tone }) => (
              <button
                key={key}
                onClick={() => onPick(key)}
                className={cn(
                  "group relative flex aspect-square min-h-[96px] flex-col items-center justify-center overflow-hidden rounded-[20px] border border-white/15 bg-gradient-to-br p-2 text-center",
                  tone,
                  "shadow-[inset_0_1px_0_rgba(255,255,255,.18)] transition hover:border-white/35 active:scale-[0.96]",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-7 size-16 rounded-full bg-white/12 blur-2xl"
                />
                <span className="relative flex size-[42px] items-center justify-center rounded-2xl border border-white/15 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)] transition group-hover:scale-105 group-hover:bg-white/20">
                  <Icon className="size-6" strokeWidth={1.85} />
                </span>
                <span className="relative mt-1.5 block w-full truncate text-[12px] font-black leading-tight text-white">
                  {label}
                </span>
                <span className="relative mt-0.5 block w-full truncate text-[8.5px] font-medium leading-tight text-white/50">
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
