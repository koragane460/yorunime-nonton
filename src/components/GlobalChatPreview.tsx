import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { ClanTag, TitleBadge, BlueCheck } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { usernameColor } from "@/lib/lstream";
import { FramedAvatar } from "@/components/FramedAvatar";
import { cn } from "@/lib/utils";

/**
 * Pratinjau chat global di kartu "Chat bareng" Home.
 *
 * Bentuknya SATU baris kecil & benar-benar rounded (bukan kartu tinggi):
 * foto profil → username + title + badge + centang biru + tag clan + level →
 * ":" → isi pesan. Pesannya diputar otomatis setiap 3 menit supaya kartu
 * tetap terasa hidup tanpa membuka chat.
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
    return <span className="h-6 min-w-0 flex-1 animate-pulse rounded-full bg-white/5" />;
  }

  const visible = msgs.slice(-6);
  if (visible.length === 0) {
    return (
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        belum ada chat — jadi yang pertama!
      </span>
    );
  }

  const m = visible[idx % visible.length] as any;
  const body = m.premiumGive ? "Give premium" : (m.text ?? "[foto]");

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <FramedAvatar
        border={m.avatarBorder}
        src={m.image}
        seed={m.username}
        className="size-6 shrink-0"
      />
      <span className={cn("shrink-0 text-xs font-semibold", usernameColor(m.username))}>
        {m.username}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <TitleBadge role={m.staffRole} compact />
        {m.premium && <BlueCheck className="size-3" />}
        {m.clanTag && (
          <ClanTag
            icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
            tag={m.clanTag}
            color={m.clanNameColor}
            level={m.clanLevel}
            className="shrink-0 scale-75 px-1 py-0 text-[9px]"
          />
        )}
        {typeof m.level === "number" && (
          <span className="shrink-0 rounded bg-white/10 px-1 py-0 text-[9px] font-bold text-white/70">
            Lv.{m.level}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs font-bold text-white/70">:</span>
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{body}</span>
    </span>
  );
}
