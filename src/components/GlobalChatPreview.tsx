import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Gift, MoreVertical, Reply } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useState } from "react";

export function GlobalChatPreview() {
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 6 });
  const [idx, setIdx] = useState(0);

  // Rotasi 1 pesan setiap 3 menit
  useMemo(() => {
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
    <div className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-[#0b0b14]/90 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2.5 text-[13px]">
          <Avatar className="size-9">
            <AvatarFallback className="bg-white/10 text-white text-xs">
              {m.username?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
            {m.image && <AvatarImage src={m.image} alt={m.username ?? ""} />}
          </Avatar>
          <div>
            <p className="truncate font-semibold text-zinc-200">
              {m.username}
              {m.premium && (
                <span className="ml-1 inline size-3.5 rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                  ✓
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {m.premiumGive ? "giving premium" : m.text ?? "[foto]"}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground/70">
          3 menit lalu
        </p>
      </div>
      <button className="flex flex-1 items-center justify-between px-1 text-xs text-zinc-400 transition hover:text-zinc-200">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-zinc-500">
            {m.premiumGive ? (
              <Gift className="size-3.5" aria-hidden />
            ) : (
              <Reply className="size-3.5" aria-hidden />
            )}
          </span>
          <span className="truncate">
            {m.premiumGive
              ? `Give premium — ${m.username}`
              : m.text ?? "[foto]"}
          </span>
        </span>
        <MoreVertical className="shrink-0 size-4" />
      </button>
    </div>
  );
}
