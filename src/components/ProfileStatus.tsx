import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, Plus, Send, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
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
}: {
  text?: string;
  bg?: string;
  seed?: string;
  onClick: () => void;
  className?: string;
  clamp?: boolean;
}) {
  const message = text?.trim() || randomStatusGreeting(seed);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buka status bubble"
      className={cn(
        "group relative z-20 max-w-[132px] rounded-[15px] rounded-br-[4px] border border-white/18 bg-[#171220]/94 px-2.5 py-1.5 text-left shadow-[0_12px_28px_-16px_rgba(0,0,0,.95)] backdrop-blur-xl transition hover:border-white/35 active:scale-95",
        className,
      )}
    >
      <span
        className={cn(
          "text-[8.5px] font-semibold leading-snug text-white/78",
          clamp && "line-clamp-2",
        )}
      >
        {message}
      </span>
      <span
        aria-hidden
        className="absolute -bottom-[5px] right-3 size-2.5 rotate-45 rounded-[1px] border-b border-r border-white/18 bg-[#171220]"
      />
      <span
        aria-hidden
        className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />
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
    <div className="screen-enter fixed inset-0 z-[96] flex flex-col bg-[#07060b] text-white">
      <header className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black">Status bubble</p>
          <p className="text-[9.5px] text-white/38">Tulisan kecil di foto profilmu</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/60"
        >
          <X className="size-4" />
        </button>
      </header>

      <div
        className="relative mx-4 mt-1 flex min-h-[250px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[26px] border border-white/12"
        style={{ background: pattern.css }}
      >
        <span className="absolute inset-0 bg-black/18" />
        <div className="relative flex items-center">
          <span className="relative">
            <span className="absolute -inset-1.5 rounded-full bg-white/15 blur-md" />
            <img
              src={user?.image ?? ""}
              alt=""
              className="relative size-[112px] rounded-full border-[3px] border-white/55 object-cover shadow-[0_20px_44px_-18px_rgba(0,0,0,.9)]"
            />
          </span>
          <ProfileStatusBubble
            text={shown}
            bg={bg}
            seed={user?._id}
            onClick={() => undefined}
            clamp={false}
            className="pointer-events-none absolute -right-[116px] -top-3 max-h-[180px] w-[128px] overflow-y-auto bg-[#171220]/96 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
        </div>
        <p className="relative mt-5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">
          Pratinjau
        </p>
      </div>

      <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
          Pesan bubble
        </label>
        <div className="mt-1.5 flex items-end gap-2 rounded-2xl border border-white/12 bg-white/[0.055] p-2 focus-within:border-white/30">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 140))}
            rows={2}
            placeholder="Tulis status mu…"
            className="min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-[12px] leading-relaxed outline-none placeholder:text-white/25"
          />
          <span className="shrink-0 pb-1 text-[8.5px] font-bold text-white/28">
            {text.length}/140
          </span>
        </div>

        <div className="mt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
            Latar
          </p>
          <div className="thin-scroll mt-1.5 flex gap-2 overflow-x-auto pb-1">
            {STATUS_BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBg(b.id)}
                aria-pressed={bg === b.id}
                className={cn(
                  "relative size-11 shrink-0 overflow-hidden rounded-xl border-2 transition active:scale-95",
                  bg === b.id ? "border-white" : "border-white/10",
                )}
                style={{ background: b.css }}
              >
                {bg === b.id && (
                  <span className="absolute inset-0 grid place-items-center bg-black/20">
                    <Check className="size-4 drop-shadow" strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <p className="mt-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-200">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => void post()}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ui-c,#FFD23F)] py-3 text-[12px] font-black text-black transition active:scale-[0.99] disabled:opacity-55"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {busy ? "Memposting…" : "Posting"}
        </button>
      </div>
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
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
          Status
        </p>
        <p className="text-[8.5px] font-medium text-white/25">24 jam</p>
      </div>
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
