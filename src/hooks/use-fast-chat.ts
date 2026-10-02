import { api } from "@/convex/_generated/api";
import type { ChatMsg } from "@/components/ChatPanel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";export type SendPayload = {
  text?: string;
  /** Foto sudah diunggah ke storage, jadi cukup kirim storageId-nya. */
  imageStorageId?: string;
  /** URL hasil resolusi storageId, hanya untuk echo lokal. */
  imageUrl?: string;
  replyToId?: Id<"chatMessages">;
  /** Kutipan reply untuk echo lokal, supaya balasan langsung kelihatan. */
  _replyTo?: {
    _id: string;
    username: string;
    text?: string;
    premiumGiveId?: string;
  };
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
  listArgs: Record<string, unknown> | "skip",
  sendArgs: Record<string, unknown>,
  me: Me,
) {
  const raw = useQuery(
    api.chat.listMessages,
    (listArgs === "skip" ? "skip" : listArgs) as never,
  );
  const send = useMutation(api.chat.sendMessage);
  const [pending, setPending] = useState<ChatMsg[]>([]);
  // Kunci anti double-submit: tanpa ini, mengetuk "Kirim" dua kali (atau
  // Enter lalu Ketuk) mengirim dua pesan yang isinya sama.
  const sending = useRef(false);

  // Ganti room / teman: pesan yang masih "mengambang" dari chat sebelumnya
  // dibuang supaya chat tiap orang benar-benar terpisah.
  const argsKey = JSON.stringify(listArgs === "skip" ? "skip" : listArgs) +
    JSON.stringify(sendArgs);
  const lastKey = useRef(argsKey);
  useEffect(() => {
    if (lastKey.current !== argsKey) {
      lastKey.current = argsKey;
      setPending([]);
    }
  }, [argsKey]);

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
    if (sending.current) return;
    sending.current = true;
    try {
      await doSend(p);
    } finally {
      sending.current = false;
    }
  };

  const doSend = async (p: SendPayload) => {
    // Kutipan reply ikut dikirim ke server supaya pesan balasan tidak pernah
    // muncul tanpa konteks (masalah lama: pesan reply tidak tampil sama sekali).
    const quoted: Id<"chatMessages"> | undefined = p.replyToId;
    if (!me?._id) {
      await send({ ...sendArgs, ...p, replyToId: quoted, _replyTo: undefined } as never);
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
      imageStorageId: p.imageStorageId,
      replyTo: p._replyTo as ChatMsg["replyTo"],
      createdAt: Date.now(),
    };
    setPending((s) => [...s, temp]);
    try {
      // imageUrl hanya untuk echo lokal (blob: sementara), tidak disimpan.
      await send({
        ...sendArgs,
        text: p.text,
        imageStorageId: p.imageStorageId,
        replyToId: quoted,
      } as never);
      // Echo langsung dilepas begitu server mengonfirmasi. Query akan
      // mengirim pesan aslinya; kalau echo ditahan terlalu lama, yang tampil
      // adalah dua salinan pesan yang sama.
      setPending((s) => s.filter((x) => x._id !== temp._id));
    } catch (e) {
      setPending((s) => s.filter((x) => x._id !== temp._id));
      throw e;
    }
  };

  return { messages, sendFast, loading: raw === undefined };
}
