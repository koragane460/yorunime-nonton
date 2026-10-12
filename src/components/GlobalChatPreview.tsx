import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";

/**
 * Pratinjau chat global di kotak "Chat bareng" Home.
 * Satu pesan terbaru: foto profil bulat normal (tanpa latar hitam & tanpa
 * gepeng), nama, waktu, dan isi pesannya.
 */
export function GlobalChatPreview() {
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 6 });
  const [idx, setIdx] = useState(0);

  // Rotasi 1 pesan setiap 3 menit.
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 180_000);
    return () => clearInterval(t);
  }, []);

  if (!msgs) {
    return <div className="mt-2 h-10 w-full rounded-lg bg-white/5" />;
  }

  const visible = msgs.slice(-6);
  if (visible.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Belum ada chat — jadi yang pertama!
      </p>
    );
  }

  const m = visible[idx % visible.length] as any;

  return (
    <div className="mt-2 flex items-center gap-2.5 px-1 py-1">
      <Avatar className="size-10 shrink-0">
        {m.image ? (
          <AvatarImage src={m.image} alt={m.username ?? ""} className="size-full rounded-full object-cover" />
        ) : null}
        <AvatarFallback className="bg-white/10 text-xs text-white">
          {m.username?.[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {m.username}
            {m.premium && (
              <span className="ml-1 inline-block size-3 align-[-1px] rounded-full bg-blue-500 text-center text-[8px] font-bold leading-3 text-white">
                ✓
              </span>
            )}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground/70">
            {timeAgo(m.createdAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-zinc-400">
          {m.premiumGive ? "Bagi premium…" : m.text ?? "[foto]"}
        </p>
      </div>
    </div>
  );
}

/** "Baru saja" / "X menit lalu" / "X jam lalu" / tanggal. */
function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "Baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
