import { Avatar, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { useMutation, useQuery } from "convex/react";
import {
  Globe,
  LogOut,
  MessageSquare,
  Pause,
  PhoneOff,
  Play,
  Radio,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useFastChat } from "@/hooks/use-fast-chat";
import { useAuth } from "@/hooks/use-auth";
import { ChatPanel } from "@/components/ChatPanel";
import type { Id } from "@/convex/_generated/dataModel";

export type RoomInfo = {
  _id: Id<"watchRooms">;
  name: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episode: number;
  positionSec: number;
  playing: boolean;
  visibility: "all" | "selected";
  hostId: string;
  hostName: string;
  hostImage?: string;
};

export type RoomMember = {
  userId: string;
  username: string;
  image?: string;
  clanTag?: string;
  clanTagIcon?: string;
  staffRole?: string;
  joinedAt: number;
};

/**
 * Panel Nobar yang menempel di bawah halaman nonton:
 * info room, daftar participant, tombol kontrol host, dan Chat nobar.
 */
export function NobarDock({
  room,
  isHost,
  members,
  meId,
  onLeave,
  onNextEpisode,
  onPrevEpisode,
  onTogglePlay,
  onSeek,
  currentSec,
  durationSec,
}: {
  room: RoomInfo;
  isHost: boolean;
  members: RoomMember[];
  meId?: string;
  onLeave: () => void;
  onNextEpisode: () => void;
  onPrevEpisode: () => void;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  currentSec: number;
  durationSec: number;
}) {
  const [tab, setTab] = useState<"chat" | "orang">("chat");
  const { user } = useAuth();
  const { messages: msgs, sendFast } = useFastChat(
    { kind: "room", roomId: room._id, limit: 60 },
    { kind: "room", roomId: room._id },
    user,
  );

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/40 bg-card/60 shadow-lg shadow-black/40">
      {/* Kepala room */}
      <div className="flex items-center gap-2.5 border-b border-border bg-white/[0.04] px-3 py-2.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Radio className="size-4 text-primary" />
          {room.playing && (
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{room.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {room.animeTitle} · Ep {room.episode} · Host {room.hostName}
          </p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
            room.visibility === "selected"
              ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
              : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
          )}
        >
          {room.visibility === "selected" ? (
            <>
              <ShieldCheck className="size-2.5" /> Orang tertentu
            </>
          ) : (
            <>
              <Globe className="size-2.5" /> Semua orang
            </>
          )}
        </span>
      </div>

      {/* Kontrol host — hanya host yang boleh menekan */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/40 px-3 py-2">
        {isHost ? (
          <>
            <HostBtn onClick={onPrevEpisode} label="‹ Episode" icon={<SkipBack className="size-4" />} />
            <HostBtn onClick={onSeek.bind(null, -10)} label="−10s" />
            <button
              onClick={onTogglePlay}
              className="flex h-10 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
              aria-label={room.playing ? "Jeda untuk semua" : "Lanjut untuk semua"}
            >
              {room.playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
            <HostBtn onClick={onSeek.bind(null, 10)} label="+10s" />
            <HostBtn onClick={onNextEpisode} label="Episode ›" icon={<SkipForward className="size-4" />} />
            <span className="ml-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
              <Users className="size-3" /> {members.length}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-300">
              {room.playing ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-rose-500" /> Host
                 Sedang menonton
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-zinc-500" /> Dijeda oleh host
                </>
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {fmt(currentSec)} / {fmt(durationSec)}
            </span>
            <span className="ml-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
              <Users className="size-3" /> {members.length}
            </span>
          </>
        )}
        {/* Keluar Room = untuk peserta non-host. Bubarkan Room = khusus host. */}
        {isHost ? (
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 rounded-full border border-rose-500/60 bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-200"
          >
            <PhoneOff className="size-3" /> Bubarkan Room
          </button>
        ) : (
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-zinc-200"
          >
            <LogOut className="size-3" /> Keluar Room
          </button>
        )}
      </div>

      {/* Tab: chat / orang */}
      <div className="flex border-b border-border bg-white/[0.03]">
        {(
          [
            ["chat", "Chat Nobar", MessageSquare],
            ["orang", ` Orang (${members.length})`, Users],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex-1 py-2 text-xs font-bold transition",
              tab === k
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground",
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Icon className="size-3.5" /> {label}
            </span>
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <div className="flex h-[38vh] min-h-52 flex-col overflow-hidden bg-card/40 sm:h-[320px]">
          {msgs ? (
            <ChatPanel
              kind="room"
              roomId={room._id}
              compact
              noPremium
              messages={msgs}
              meId={meId ?? ""}
              onSend={(p) => sendFast(p)}
            />
          ) : (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Memuat chat…
            </p>
          )}
        </div>
      ) : (
        <div className="thin-scroll h-[46vh] min-h-64 space-y-1.5 overflow-y-auto bg-card/40 p-2.5 sm:h-[380px]">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/30 p-2"
            >
              <Avatar src={m.image} seed={m.username} className="size-8" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="truncate text-xs font-bold">{m.username}</span>
                  <TitleBadge role={m.staffRole} compact />
                  {m.clanTag && (
                    <ClanTag
                      icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
                      tag={m.clanTag}
                      className="scale-90 px-1.5 py-0 text-[9px]"
                    />
                  )}
                </div>
              </div>
              {m.userId === room.hostId && (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-foreground/50 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                  <PhoneOff className="size-2.5" /> Host
                </span>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Belum ada yang join
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HostBtn({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/40 px-3 text-[11px] font-bold text-white transition active:scale-95"
    >
      {icon}
      {label}
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
