import { api } from "@/convex/_generated/api";
import type { ChatMsg } from "@/components/ChatPanel";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type SendPayload = {
  text?: string;
  imageUrl?: string;
  replyToId?: Id<"chatMessages">;
};

type Me = {
  _id?: string;
  username?: string;
  image?: string;
  level?: number;
  premiumUntil?: number;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
} | null | undefined;

/**
 * Chat dengan echo lokal: pesan langsung tampil di layar begitu dikirim,
 * tanpa menunggu bolak-balik server. Echo dibersihkan sendiri begitu pesan
 * aslinya sampai dari query, jadi tidak pernah dobel.
 */
export function useFastChat(
  listArgs: Record<string, unknown>,
  sendArgs: Record<string, unknown>,
  me: Me,
) {
  const raw = useQuery(api.chat.listMessages, listArgs as never);
  const send = useMutation(api.chat.sendMessage);
  const [pending, setPending] = useState<ChatMsg[]>([]);

  const messages = useMemo(() => {
    const real = (raw ?? []) as unknown as ChatMsg[];
    if (pending.length === 0) return real;
    const keep = pending.filter(
      (p) =>
        !real.some(
          (r) =>
            r.userId === p.userId &&
            (r.text ?? "") === (p.text ?? "") &&
            (r.imageUrl ?? "") === (p.imageUrl ?? "") &&
            r.createdAt >= p.createdAt - 3000,
        ),
    );
    if (keep.length !== pending.length) {
      queueMicrotask(() => setPending(keep));
    }
    return [...real, ...keep].sort((a, b) => a.createdAt - b.createdAt);
  }, [raw, pending]);

  const sendFast = async (p: SendPayload) => {
    if (!me?._id) {
      await send({ ...sendArgs, ...p } as never);
      return;
    }
    const temp: ChatMsg = {
      _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` as unknown as Id<"chatMessages">,
      userId: me._id as Id<"users">,
      username: me.username ?? "user",
      image: me.image,
      level: me.level ?? 1,
      premium: (me.premiumUntil ?? 0) > Date.now(),
      staffRole: me.staffRole,
      clanTag: me.clanTag,
      clanTagIcon: me.clanTagIcon,
      clanNameColor: me.clanNameColor,
      text: p.text,
      imageUrl: p.imageUrl,
      createdAt: Date.now(),
    };
    setPending((s) => [...s, temp]);
    try {
      await send({ ...sendArgs, ...p } as never);
    } catch (e) {
      setPending((s) => s.filter((x) => x._id !== temp._id));
      throw e;
    }
  };

  return { messages, sendFast, loading: raw === undefined };
}
