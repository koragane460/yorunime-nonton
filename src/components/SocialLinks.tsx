import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Link2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";

/**
 * TAUTAN MEDIA SOSIAL — 4 kotak (TikTok, Instagram, Discord, Facebook).
 * Dipakai di detail akun dan di Pengaturan (di atas Customer Service).
 *
 * Penyimpanan: `users.socials` berisi handle bersih (tanpa @ / URL).
 * Pemilik akun bisa mengetuk kotak untuk menautkan / mengganti / melepas;
 * pengunjung cukup mengetuk untuk membuka tautannya.
 */
export type Socials = {
  tiktok?: string;
  instagram?: string;
  discord?: string;
  facebook?: string;
};

type Platform = keyof Socials;

const PLATFORMS: {
  id: Platform;
  name: string;
  sub: string;
  color: string;
  icon: (cls: string) => ReactNode;
}[] = [
  {
    id: "tiktok",
    name: "TikTok",
    sub: "Tautan Akun TikTok",
    color: "#25F4EE",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    sub: "Tautan Akun Instagram",
    color: "#E1306C",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.795.646-1.44 1.44-1.44.793 0 1.44.646 1.44 1.44z" />
      </svg>
    ),
  },
  {
    id: "discord",
    name: "Discord",
    sub: "Tautan Akun Discord",
    color: "#818CF8",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    name: "Facebook",
    sub: "Tautan Akun Facebook",
    color: "#1877F2",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

/** URL publik dari sebuah handle. */
export function socialUrl(platform: Platform, handle: string) {
  const h = encodeURIComponent(handle);
  if (platform === "instagram") return `https://instagram.com/${h}`;
  if (platform === "facebook") return `https://facebook.com/${h}`;
  if (platform === "discord") return `https://discord.com/users/${h}`;
  return `https://www.tiktok.com/@${h}`;
}

export function SocialLinkBoxes({
  socials,
  className,
}: {
  /** Untuk profil orang lain; kalau kosong, pakai data akun sendiri. */
  socials?: Socials;
  className?: string;
}) {
  const mine = useQuery(api.account.mySocials);
  const save = useMutation(api.account.updateSocials);
  const data: Socials = socials ?? mine ?? {};
  const isMine = socials === undefined;
  const [edit, setEdit] = useState<Platform | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (id: Platform) => {
    if (isMine) {
      setEdit(id);
      setValue(data[id] ?? "");
      return;
    }
    const handle = data[id];
    if (!handle) {
      toast.error("Pengguna ini belum menautkan akun");
      return;
    }
    if (id === "discord") {
      void navigator.clipboard?.writeText(handle);
      toast.success("Username Discord disalin");
      return;
    }
    window.open(socialUrl(id, handle), "_blank", "noopener,noreferrer");
  };

  const submit = async (remove = false) => {
    if (!edit || busy) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      payload[edit] = remove ? "" : value.trim();
      await save(payload as never);
      toast.success(remove ? "Tautan dilepas" : "Tautan disimpan");
      setEdit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan tautan");
    } finally {
      setBusy(false);
    }
  };

  const active = PLATFORMS.find((p) => p.id === edit);

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        {PLATFORMS.map((p) => {
          const handle = data[p.id];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => open(p.id)}
              className={cn(
                "relative flex min-h-[74px] items-center gap-2.5 overflow-hidden rounded-2xl border p-2.5 pr-9 text-left transition active:scale-[0.98]",
                handle
                  ? "border-white/20 bg-white/[0.07]"
                  : "border-white/10 bg-white/[0.035]",
              )}
            >
              {/* Logo ASLI platform — selalu di KIRI, kotak membulat. */}
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${p.color}22`, color: p.color }}
              >
                {p.icon("size-6")}
              </span>
              {/* Nama + keterangan di kanan logo, rata tengah vertikal. */}
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="block truncate text-[13px] font-black leading-tight text-white">
                  {p.name}
                </span>
                <span className="mt-0.5 block truncate text-[9px] font-semibold leading-tight text-white/45">
                  {p.sub}
                </span>
                {handle && (
                  <span className="mt-0.5 block truncate text-[8.5px] font-medium leading-tight text-white/30">
                    @{handle}
                  </span>
                )}
              </span>
              {isMine && (
                <span className="absolute right-2 top-2 text-[8px] font-black uppercase tracking-wide text-white/30">
                  {handle ? "ubah" : "tautan"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {edit && active && (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="pop-enter w-full max-w-sm rounded-3xl border border-white/12 bg-[#0f131b] p-4">
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: `${active.color}22`, color: active.color }}
              >
                {active.icon("size-5")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-black text-white">{active.name}</p>
                <p className="text-[10.5px] text-white/45">{active.sub}</p>
              </div>
              <button
                onClick={() => setEdit(null)}
                aria-label="Tutup"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/60"
              >
                <X className="size-4" />
              </button>
            </div>

            <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
              Username / tautan
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5">
              <Link2 className="size-4 shrink-0 text-white/35" />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`@username ${active.name}`}
                className="w-full bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/25"
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
              Boleh tempel tautan profil lengkap — sistem mengambil username-nya
              otomatis.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEdit(null)}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-bold text-white/70"
              >
                Batal
              </button>
              <button
                disabled={busy || !value.trim()}
                onClick={() => void submit(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1CA7EC] py-2.5 text-[12px] font-black text-white disabled:opacity-50"
              >
                <Check className="size-4" /> Simpan
              </button>
            </div>
            {data[active.id] && (
              <button
                disabled={busy}
                onClick={() => void submit(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E84855]/40 py-2 text-[11px] font-bold text-[#ff8a94]"
              >
                <Trash2 className="size-3.5" /> Lepas tautan
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
