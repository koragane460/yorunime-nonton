import { api } from "@/convex/_generated/api";
import type { ChatMsg } from "@/components/ChatPanel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type SendPayload = {
  text?: string;
  /** Foto sudah diunggah ke storage, jadi cukup kirim storageId-nya. */
  imageStorageId?: string;
  /** URL hasil resolusi storageId, hanya untuk echo lokal. */
  imageUrl?: string;
  /** Emoji sticker besar dari toko sticker. */
  sticker?: string;
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

const isLocalId = (id: string | undefined | null): boolean =>
  !!id && id.startsWith("local-");

/**
 * Echo lokal dianggap sudah tergantikan oleh pesan server kalau pengirim,
 * teks, dan waktunya nyaris bersamaan (selisih < 3 detik).
 */
function isSameMessage(r: ChatMsg, p: ChatMsg): boolean {
  return (
    r.userId === p.userId &&
    (r.text ?? "") === (p.text ?? "") &&
    (r.imageUrl ?? "") === (p.imageUrl ?? "") &&
    (r.sticker ?? "") === (p.sticker ?? "") &&
    r.createdAt >= p.createdAt - 3000
  );
}

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
  const del = useMutation(api.chat.deleteMessage);
  const [pending, setPending] = useState<ChatMsg[]>([]);

  // Antrean kirim: pesan dikirim satu per satu, TANPA PERNAH dibuang.
  // Dulu ada kunci "sedang kirim" yang menelan pesan kedua diam-diam selama
  // kirim pertama masih berjalan — pesan itu hilang tanpa error apa pun.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // id lokal -> id asli dari server. Dipakai supaya reply ke pesan yang
  // barusan dikirim tetap terhubung, bukan berubah jadi komentar biasa.
  const realIdByLocal = useRef(new Map<string, string>());
  const inflight = useRef(new Map<string, Promise<unknown>>());

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

  // Buang echo yang sudah punya salinan di server. Pakai update fungsional
  // terhadap state terbaru: cara lama (menulis balik hasil filter basi dari
  // useMemo lewat microtask) bisa menimpa dan menghapus pesan yang baru saja
  // ditambahkan, sehingga chat kedua tidak pernah muncul.
  useEffect(() => {
    if (!raw || pending.length === 0) return;
    setPending((prev) => {
      const keep = prev.filter((p) => !raw.some((r) => isSameMessage(r, p)));
      return keep.length === prev.length ? prev : keep;
    });
  }, [raw, pending]);

  const messages = useMemo(() => {
    const real = (raw ?? []) as unknown as ChatMsg[];
    if (pending.length === 0) return real;
    const keep = pending.filter((p) => !real.some((r) => isSameMessage(r, p)));
    return [...real, ...keep].sort((a, b) => a.createdAt - b.createdAt);
  }, [raw, pending]);

  /**
   * Reply menunjuk pesan yang masih berbentuk echo lokal: tunggu server
   * mengembalikan id aslinya dulu. Kalau gagal, kirim tanpa tautan server
   * (kutipan lokal tetap tampil di bubble).
   */
  const resolveReplyId = async (
    localId: string,
  ): Promise<Id<"chatMessages"> | undefined> => {
    const hit = realIdByLocal.current.get(localId);
    if (hit) return hit as Id<"chatMessages">;
    const p = inflight.current.get(localId);
    if (p) {
      await Promise.race([
        p.catch(() => undefined),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    }
    const id = realIdByLocal.current.get(localId);
    return id ? (id as Id<"chatMessages">) : undefined;
  };

  const doSend = async (p: SendPayload) => {
    let replyId = p.replyToId;
    if (isLocalId(replyId as unknown as string)) {
      replyId = await resolveReplyId(String(replyId));
    }
    if (!me?._id) {
      await send({
        ...sendArgs,
        ...p,
        replyToId: replyId,
        _replyTo: undefined,
      } as never);
      return;
    }

    const localId = `local-${Date.now()}-${
      Math.random().toString(36).slice(2, 7)
    }`;
    const temp: ChatMsg = {
      _id: localId as unknown as Id<"chatMessages">,
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
      sticker: p.sticker,
      replyTo: p._replyTo as ChatMsg["replyTo"],
      createdAt: Date.now(),
    };
    setPending((s) => [...s, temp]);

    // imageUrl hanya untuk echo lokal (blob: sementara), tidak disimpan.
    const run = send({
      ...sendArgs,
      text: p.text,
      imageStorageId: p.imageStorageId,
      sticker: p.sticker,
      replyToId: replyId,
    } as never).then((res) => {
      const mid = (res as { messageId?: string } | null)?.messageId;
      if (mid) realIdByLocal.current.set(localId, mid);
    });
    inflight.current.set(localId, run);
    try {
      await run;
      // Echo langsung dilepas begitu server mengonfirmasi. Query akan
      // mengirim pesan aslinya; kalau echo ditahan terlalu lama, yang tampil
      // adalah dua salinan pesan yang sama.
      setPending((s) => s.filter((x) => x._id !== localId));
    } catch (e) {
      setPending((s) => s.filter((x) => x._id !== localId));
      throw e;
    } finally {
      inflight.current.delete(localId);
      // Batasi peta id lokal supaya tidak tumbuh tanpa batas.
      if (realIdByLocal.current.size > 200) {
        const oldest = realIdByLocal.current.keys().next().value;
        if (oldest !== undefined) realIdByLocal.current.delete(oldest);
      }
    }
  };

  const sendFast = (p: SendPayload): Promise<void> => {
    // Dijalankan lewat antrean: kirim berikutnya menunggu yang sebelumnya
    // selesai, tetapi tidak pernah dibuang.
    const run = chain.current.then(() => doSend(p));
    // Kegagalan satu pesan tidak boleh merusak antrean pesan berikutnya.
    chain.current = run.catch(() => undefined);
    return run;
  };

  /** Tombol hapus untuk pesan yang masih berbentuk echo lokal. */
  const dropLocal = async (id: string) => {
    setPending((s) => s.filter((x) => String(x._id) !== id));
    // Kalau pesannya terlanjur dikirim ke server, tunggu lalu hapus juga di
    // sana supaya tidak muncul lagi setelah halaman dimuat ulang.
    const sending = inflight.current.get(id);
    if (sending) await sending.catch(() => undefined);
    const real = realIdByLocal.current.get(id);
    if (real) await del({ messageId: real as Id<"chatMessages"> });
  };

  return { messages, sendFast, dropLocal, loading: raw === undefined };
}
