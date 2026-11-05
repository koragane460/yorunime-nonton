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
  layout: "left" | "right" | "top-right";
  icon: (cls: string) => ReactNode;
}[] = [
  {
    id: "tiktok",
    name: "TikTok",
    sub: "Tautan Akun Tiktok",
    color: "#25F4EE",
    layout: "left",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M16.5 3c.3 2.1 1.6 3.6 3.9 3.9v2.7c-1.4.1-2.8-.3-3.9-1.1v5.4c0 3.4-2.4 5.9-5.6 5.9A5.5 5.5 0 0 1 5.4 12c0-3.3 2.7-5.7 6.1-5.4v2.9c-.4-.1-.8-.2-1.2-.2a2.7 2.7 0 1 0 2.7 2.7V3h3.5Z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    sub: "Tautan Akun Instagram",
    color: "#E1306C",
    layout: "top-right",
    icon: (cls) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={cls}
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "discord",
    name: "Discord",
    sub: "Tautan Akun Discord",
    color: "#818CF8",
    layout: "right",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.3.6a12 12 0 0 1 3.4 1.7 11.6 11.6 0 0 0-9-.4l-.6.4A12 12 0 0 1 8.9 4.6L8.6 4a16 16 0 0 0-4 1.3C2.2 9 1.4 12.7 1.8 16.3a15.9 15.9 0 0 0 4.8 2.4l.6-1a11 11 0 0 1-1.8-.9l.4-.3a11.4 11.4 0 0 0 9.8 0l.4.3a11 11 0 0 1-1.8.9l.6 1a15.9 15.9 0 0 0 4.8-2.4c.5-4.2-.7-7.9-2.3-11ZM8.6 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    name: "Facebook",
    sub: "Tautan Akun Facebook",
    color: "#1877F2",
    layout: "top-right",
    icon: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3h-3V10c0-.6.4-1 1-1Z" />
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
                "relative min-h-[92px] overflow-hidden rounded-2xl border p-2.5 text-left transition active:scale-[0.98]",
                handle
                  ? "border-white/20 bg-white/[0.07]"
                  : "border-white/10 bg-white/[0.035]",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full blur-2xl"
                style={{ background: `${p.color}33` }}
              />
              {p.layout === "left" ? (
                <span className="flex h-full items-center gap-2.5">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${p.color}22`, color: p.color }}
                  >
                    {p.icon("size-5")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-black text-white">
                      {p.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] font-semibold leading-tight text-white/45">
                      {handle ? `@${handle}` : p.sub}
                    </span>
                  </span>
                </span>
              ) : p.layout === "right" ? (
                <span className="flex h-full items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-black text-white">
                      {p.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] font-semibold leading-tight text-white/45">
                      {handle ? `@${handle}` : p.sub}
                    </span>
                  </span>
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${p.color}22`, color: p.color }}
                  >
                    {p.icon("size-5")}
                  </span>
                </span>
              ) : (
                <span className="flex h-full flex-col justify-between">
                  <span className="flex items-start justify-between gap-2">
                    <span className="block truncate text-[12.5px] font-black text-white">
                      {p.name}
                    </span>
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${p.color}22`, color: p.color }}
                    >
                      {p.icon("size-4")}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[9.5px] font-semibold leading-tight text-white/45">
                    {handle ? `@${handle}` : p.sub}
                  </span>
                </span>
              )}
              {isMine && (
                <span className="absolute bottom-1.5 right-2 text-[8.5px] font-bold uppercase tracking-wide text-white/30">
                  {handle ? "ubah" : "tautkan"}
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
