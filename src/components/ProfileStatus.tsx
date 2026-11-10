import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, LockKeyhole, Plus, Send, Sparkles, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/lstream-ui";
import { StoryRing } from "@/components/StoriesUI";
import { cn } from "@/lib/utils";

/** Pola latar penuh untuk bubble/status, bukan sekadar warna datar. */
export const STATUS_BACKGROUNDS: {
  id: string;
  name: string;
  css: string;
}[] = [
  {
    id: "aurora",
    name: "Aurora",
    css: "radial-gradient(55% 60% at 18% 16%, #4C1D95 0%, transparent 68%), radial-gradient(52% 55% at 88% 80%, #0E7490 0%, transparent 72%), #120D20",
  },
  {
    id: "sunset",
    name: "Senja",
    css: "radial-gradient(circle at 72% 20%, #FDE68A 0 8%, transparent 9%), linear-gradient(160deg, #7C2D12 0%, #BE185D 56%, #3B0764 100%)",
  },
  {
    id: "grid",
    name: "Grid",
    css: "repeating-linear-gradient(90deg, rgba(255,255,255,.075) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(255,255,255,.075) 0 1px, transparent 1px 28px), linear-gradient(145deg, #0F172A, #134E4A)",
  },
  {
    id: "dots",
    name: "Titik",
    css: "radial-gradient(circle, rgba(255,255,255,.16) 1.2px, transparent 1.4px) 0 0 / 18px 18px, linear-gradient(145deg, #312E81, #831843)",
  },
  {
    id: "sakura",
    name: "Sakura",
    css: "radial-gradient(circle at 18% 22%, rgba(255,190,214,.8) 0 3px, transparent 4px), radial-gradient(circle at 76% 68%, rgba(255,214,228,.6) 0 2.5px, transparent 3.5px), linear-gradient(145deg, #4A1D35, #1F1020)",
  },
  {
    id: "ocean",
    name: "Laut",
    css: "repeating-radial-gradient(circle at 110% 120%, transparent 0 28px, rgba(125,211,252,.13) 28px 30px), linear-gradient(150deg, #082F49, #0E7490 60%, #164E63)",
  },
  {
    id: "ember",
    name: "Bara",
    css: "conic-gradient(from 210deg at 78% 18%, #F59E0B 0deg, transparent 62deg, #7F1D1D 180deg, #1C0A08 330deg)",
  },
  {
    id: "paper",
    name: "Kertas",
    css: "repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 2px, transparent 2px 12px), linear-gradient(145deg, #3F3F46, #18181B)",
  },
];

const GREETINGS = [
  "Selamat pagi, semesta.",
  "Aku capek, tapi tetap nonton.",
  "Jangan lupa istirahat.",
  "Episode baru, semangat baru.",
  "Malam ini milik kita.",
  "Diam-diam menonton.",
  "Kopi dulu, dunia kemudian.",
];

export function randomStatusGreeting(seed = "") {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return GREETINGS[n % GREETINGS.length];
}

export function statusBackground(id?: string | null) {
  return STATUS_BACKGROUNDS.find((b) => b.id === id) ?? STATUS_BACKGROUNDS[0];
}

/** Gelembung kecil di kanan-atas foto profil. */
export function ProfileStatusBubble({
  text,
  bg,
  seed,
  onClick,
  className,
  clamp = true,
  wide = false,
}: {
  text?: string;
  bg?: string;
  seed?: string;
  onClick: () => void;
  className?: string;
  clamp?: boolean;
  /** Versi besar untuk pratinjau editor. */
  wide?: boolean;
}) {
  const message = text?.trim() || randomStatusGreeting(seed);
  const pattern = statusBackground(bg);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buka status bubble"
      className={cn(
        "group relative z-20 overflow-visible rounded-[22px] border border-white/25 px-3.5 py-2.5 text-left text-white shadow-[0_16px_34px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-18px_rgba(0,0,0,.9)] active:scale-95",
        wide ? "max-w-[270px]" : "max-w-[200px]",
        className,
      )}
      style={{ backgroundImage: pattern.css, backgroundColor: "#17131f" }}
    >
      <span
        aria-hidden
        className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 rounded-[3px] border-b border-l border-white/20"
        style={{ backgroundImage: pattern.css, backgroundColor: "#17131f" }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[21px] bg-black/20" />
      <span className="relative flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-semibold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]",
              wide ? "text-[11.5px]" : "text-[8.5px]",
              clamp && !wide && "line-clamp-2",
            )}
          >
            {message}
          </span>
          <span
            className={cn(
              "mt-1 flex items-center gap-1 font-black uppercase tracking-[0.14em] text-white/55",
              wide ? "text-[7px]" : "text-[5.5px]",
            )}
          >
            <Sparkles className={wide ? "size-2.5" : "size-2"} />
            Status bubble
          </span>
        </span>
      </span>
    </button>
  );
}

export function StatusBubbleEditor({
  initialText,
  initialBg,
  onClose,
}: {
  initialText?: string;
  initialBg?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const save = useMutation(api.account.updateStatusBubble);
  const [text, setText] = useState(initialText ?? "");
  const [bg, setBg] = useState(
    STATUS_BACKGROUNDS.some((b) => b.id === initialBg) ? initialBg! : "aurora",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bgOpen, setBgOpen] = useState(false);
  const pattern = statusBackground(bg);
  const shown = text.trim() || randomStatusGreeting(user?._id ?? "");

  const post = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await save({ text: text.trim(), bg });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="screen-enter fixed inset-0 z-[96] flex flex-col overflow-hidden bg-[#0b0810] text-white"
    >
      {/* Latar pola benar-benar menutup layar; tidak ada halaman lain yang
          kelihatan lewat bagian gradient yang transparan. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.12),transparent_38%,rgba(0,0,0,.55))]"
      />

      <div className="relative flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/70 backdrop-blur-md transition active:scale-95"
        >
          <X className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
            Status
          </p>
          <p className="text-[13px] font-black text-white">Bubble status</p>
        </div>
        <span className="rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[9px] font-bold text-white/55 backdrop-blur-md">
          {text.length}/140
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-6">
        <div className="relative mx-auto h-[310px] w-full max-w-[360px]">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[38%] size-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[38%] size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.055] blur-2xl"
          />

          {/* Foto profil DI TENGAH dan DIKUNCI. Tidak ada drag handle. */}
          <div className="absolute left-1/2 top-[35%] z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex flex-col items-center">
              <span className="absolute -inset-3 rounded-full border border-white/18" />
              <span className="absolute -inset-1 rounded-full bg-white/20 blur-xl" />
              <Avatar
                src={user?.image}
                seed={user?.username ?? "user"}
                className="relative size-[112px] rounded-full border-[3px] border-white/80 shadow-[0_24px_50px_-20px_rgba(0,0,0,.95)]"
              />
              <span className="relative mt-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                <LockKeyhole className="size-2.5" /> Posisi terkunci
              </span>
            </div>
          </div>

          {/* Bubble di KANAN foto. */}
          <div
            className="absolute right-0 top-[58%] z-10 min-h-[112px] w-[72%] rounded-[26px] border border-white/30 px-4 py-3.5 text-white shadow-[0_26px_60px_-22px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.18)]"
            style={{ backgroundImage: pattern.css, backgroundColor: "#17131f" }}
          >
            <span
              aria-hidden
              className="absolute -left-2 top-5 size-4 rotate-45 rounded-[4px] border-b border-l border-white/25"
              style={{ backgroundImage: pattern.css, backgroundColor: "#17131f" }}
            />
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[25px] bg-black/20" />
            <span className="relative flex items-center gap-1 text-[7.5px] font-black uppercase tracking-[0.16em] text-white/55">
              <Sparkles className="size-2.5" /> Kabar hari ini
            </span>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 140))}
              rows={3}
              placeholder={shown}
              className="relative mt-1 h-[66px] w-full resize-none bg-transparent text-[12.5px] font-semibold leading-snug text-white outline-none placeholder:text-white/45"
            />
            <span className="absolute bottom-2.5 right-3 text-[8px] font-bold text-white/40">
              {text.length}/140
            </span>
          </div>
        </div>
      </div>

      <div className="relative shrink-0 bg-[linear-gradient(180deg,transparent,rgba(5,4,8,.76)_24%,rgba(5,4,8,.92))] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
        {err && (
          <p className="mb-2 rounded-xl border border-rose-400/25 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-semibold text-rose-100">
            {err}
          </p>
        )}

        <div className="grid grid-cols-[1fr_1.6fr] gap-2">
          <button
            type="button"
            onClick={() => setBgOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/18 bg-white/[0.08] py-3 text-[11px] font-black text-white/85 backdrop-blur-md active:scale-[0.99]"
          >
            <span
              aria-hidden
              className="size-4 rounded-full border border-white/30"
              style={{ background: pattern.css }}
            />
            Ganti background
          </button>
          <button
            type="button"
            onClick={() => void post()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[12px] font-black text-black transition active:scale-[0.99] disabled:opacity-55"
            style={{ background: "var(--ui-c, #FFD23F)" }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Memposting…" : "Posting"}
          </button>
        </div>
      </div>

      {/* Pemilih latar via tombol: panel tersendiri, tile rata tanpa tepi
          putih terang. */}
      {bgOpen && (
        <div className="fixed inset-0 z-[97] flex items-end bg-black/45">
          <button
            aria-label="Tutup pilihan latar"
            className="absolute inset-0"
            onClick={() => setBgOpen(false)}
          />
          <div className="pop-enter relative w-full rounded-t-[28px] border-t border-white/12 bg-[#100e16] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
            <div className="flex items-center justify-between pb-3">
              <p className="text-[13px] font-black text-white">Pilih background bubble</p>
              <button
                type="button"
                onClick={() => setBgOpen(false)}
                aria-label="Tutup"
                className="text-white/45"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {STATUS_BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBg(b.id);
                    setBgOpen(false);
                  }}
                  aria-pressed={bg === b.id}
                  className="relative aspect-square overflow-hidden rounded-2xl transition active:scale-95"
                  style={{ background: b.css }}
                >
                  {bg === b.id && (
                    <span className="absolute inset-0 grid place-items-center bg-black/20">
                      <span className="grid size-6 place-items-center rounded-full bg-white text-black">
                        <Check className="size-3.5" strokeWidth={3.5} />
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type StoryGroup = {
  userId: string;
  username: string;
  userImage?: string;
  hasUnseen: boolean;
  stories: { _id: string }[];
};

/** Baris status di atas kartu akun. Milik sendiri selalu di kiri. */
export function StatusTray({
  onView,
  onCompose,
}: {
  onView: (userId: string) => void;
  onCompose: () => void;
}) {
  const { user } = useAuth();
  const feed = useQuery(api.stories.allStories, {}) as StoryGroup[] | undefined;
  const friends = useQuery(
    api.friends.listFriends,
    user ? {} : "skip",
  ) as { userId: string }[] | undefined;
  const groups = useMemo(() => feed ?? [], [feed]);
  const own = groups.find((g) => String(g.userId) === String(user?._id));
  const friendIds = useMemo(
    () => new Set((friends ?? []).map((f) => String(f.userId))),
    [friends],
  );
  const others = groups
    .filter(
      (g) =>
        String(g.userId) !== String(user?._id) &&
        friendIds.has(String(g.userId)),
    )
    .slice(0, 10);

  if (!user) return null;

  return (
    <div className="fade-enter mt-3">
      <div className="thin-scroll flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-[68px] shrink-0 text-center">
          <div className="relative mx-auto w-fit">
            <StoryRing
              image={user.image}
              seed={user.username}
              size={64}
              hasStory={!!own?.stories?.length}
              seen={!!own && !own.hasUnseen}
              onClick={() =>
                own?.stories?.length ? onView(String(user._id)) : onCompose()
              }
            />
            <button
              type="button"
              onClick={onCompose}
              aria-label="Tambah status"
              className="absolute -bottom-0.5 -right-0.5 z-10 grid size-5 place-items-center rounded-full border-2 border-[#100d16] bg-[var(--ui-c,#FFD23F)] text-black shadow-md transition active:scale-90"
            >
              <Plus className="size-3" strokeWidth={3} />
            </button>
          </div>
          <p className="mt-1 truncate text-[8.5px] font-bold text-white/58">
            {own ? "Status mu" : "Tambahkan"}
          </p>
        </div>

        {others.map((g) => (
          <div
            key={g.userId}
            role="button"
            tabIndex={0}
            onClick={() => onView(String(g.userId))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onView(String(g.userId));
            }}
            className="w-[68px] shrink-0 cursor-pointer text-center transition active:scale-95"
          >
            <StoryRing
              image={g.userImage}
              seed={g.username}
              size={64}
              hasStory
              seen={!g.hasUnseen}
              className="mx-auto"
            />
            <p className="mt-1 truncate text-[8.5px] font-semibold text-white/52">
              {g.username}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
