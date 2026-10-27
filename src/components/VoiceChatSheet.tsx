// CHAT ROOM (VOICE) — panel SETENGAH layar di dalam voice room, gaya Discord:
// handle garis pendek di tengah atas, daftar pesan (foto + username + centang
// biru + tag clan + id) dengan bubble abu-abu, dan kolom input + tombol kirim
// di paling bawah. Bukan fullscreen — menutupi sekitar 58% layar dari bawah.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck, ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { Send, X } from "lucide-react";

export function VoiceChatSheet({
  roomId,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  onClose: () => void;
}) {
  const channel = `voice:${roomId}`;
  const msgs = useQuery(api.chat.listMessages, {
    kind: "voice",
    channel,
    limit: 60,
  });
  const send = useMutation(api.chat.sendMessage);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const count = msgs?.length ?? 0;

  // Selalu pipih ke bawah — pesan baru langsung terlihat.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setText("");
    try {
      await send({ kind: "voice", channel, text: t });
    } catch {
      setText(t); // kembalikan teks kalau gagal kirim
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-x-0 bottom-0 z-[90] flex h-[58vh] max-h-[58vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/15 bg-[#0c0f16] shadow-[0_-26px_60px_-30px_rgba(0,0,0,1)]">
      {/* Handle: garis pendek di tengah + tombol tutup di kanan. */}
      <div className="relative flex items-center justify-center pt-2.5">
        <span className="block h-1.5 w-12 rounded-full bg-white/25" />
        <button
          onClick={onClose}
          aria-label="Tutup chat room"
          className="absolute right-3 top-2 flex size-7 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-95"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/45">
        Chat Room
      </p>

      {/* Daftar pesan */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {msgs === undefined && (
          <p className="py-6 text-center text-xs text-white/40">Memuat chat…</p>
        )}
        {msgs?.length === 0 && (
          <p className="py-6 text-center text-xs text-white/40">
            Belum ada pesan — sapa yang lain!
          </p>
        )}
        <div className="flex flex-col gap-3">
          {msgs?.map((m) => (
            <div key={m._id} className="flex items-start gap-2.5">
              <Avatar
                src={m.image}
                seed={m.username}
                className="size-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                {/* Baris nama: username + centang biru + tag clan + id */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] font-black text-white">
                    {m.username}
                  </span>
                  {m.premium && <BlueCheck className="size-3.5 shrink-0" />}
                  {m.clanTag && (
                    <ClanTag
                      icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
                      tag={m.clanTag}
                      color={m.clanNameColor}
                      level={m.clanLevel}
                      className="shrink-0 scale-90 px-1.5 py-0 text-[9px]"
                    />
                  )}
                  {typeof m.seqId === "number" && (
                    <span className="text-[9px] font-bold text-white/35">
                      #{m.seqId}
                    </span>
                  )}
                </div>
                {/* Bubble abu-abu */}
                <div className="mt-1 w-fit max-w-full rounded-2xl rounded-tl-md bg-white/12 px-3 py-2 text-[12px] leading-snug text-white/90">
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div ref={endRef} />
      </div>

      {/* Kolom input + tombol kirim */}
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Tulis pesan…"
          className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.07] px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !text.trim()}
          aria-label="Kirim pesan"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_10px_22px_-12px_rgba(251,191,36,0.9)] transition active:scale-95 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
