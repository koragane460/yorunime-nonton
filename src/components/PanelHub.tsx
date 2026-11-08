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
  { key: "quest", label: "Quest", hint: "Misi harian", Icon: ListChecks, tone: "linear-gradient(140deg, #7C3A1D, #C2872E)" },
  { key: "sticker", label: "Shop Sticker", hint: "Pack chat", Icon: Sticker, tone: "linear-gradient(140deg, #4C2A85, #7C4DBA)" },
  { key: "nobar", label: "Nobar", hint: "Nonton bareng", Icon: Clapperboard, tone: "linear-gradient(140deg, #145C78, #2A8FBA)" },
  { key: "voice", label: "Voice", hint: "Room suara", Icon: Mic, tone: "linear-gradient(140deg, #1D5B4A, #3A8B74)" },
  { key: "feed", label: "Feed", hint: "Konten teman", Icon: Newspaper, tone: "linear-gradient(140deg, #6B2D43, #A84B66)" },
  { key: "baca", label: "Baca", hint: "Manga & manhwa", Icon: BookOpen, tone: "linear-gradient(140deg, #6E4623, #A77A3B)" },
  { key: "history", label: "History", hint: "Yang ditonton", Icon: History, tone: "linear-gradient(140deg, #1F4A63, #3F7593)" },
  { key: "download", label: "Download", hint: "Tersimpan", Icon: Download, tone: "linear-gradient(140deg, #2B3E7A, #5368B5)" },
  { key: "clan", label: "Clan", hint: "Grup kamu", Icon: Shield, tone: "linear-gradient(140deg, #6D521F, #A98437)" },
  { key: "music", label: "Music", hint: "Player & playlist", Icon: Music, tone: "linear-gradient(140deg, #6B2860, #9A4A86)" },
  { key: "pet", label: "YoruPet", hint: "Peliharaanmu", Icon: Bone, tone: "linear-gradient(140deg, #355A2C, #5C8A45)" },
  { key: "title", label: "Title", hint: "Gelar profile", Icon: Award, tone: "linear-gradient(140deg, #2D3D78, #5569A8)" },
  { key: "shop", label: "Shop", hint: "Border & cosmetic", Icon: ShoppingBag, tone: "linear-gradient(140deg, #6B3A24, #A65D3B)" },
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

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <div className="grid grid-cols-3 gap-2">
            {BOXES.map(({ key, label, hint, Icon, tone }) => (
              <button
                key={key}
                onClick={() => onPick(key)}
                className="group relative flex aspect-square min-h-[96px] flex-col items-center justify-center overflow-hidden rounded-[20px] border border-white/18 p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.16)] transition hover:border-white/40 active:scale-[0.96]"
                style={{ background: tone }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-7 size-16 rounded-full bg-white/15 blur-2xl"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.10),transparent_46%,rgba(255,255,255,.035))]"
                />
                <Icon
                  className="relative size-7 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.28)] transition group-hover:scale-105"
                  strokeWidth={2.4}
                />
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
