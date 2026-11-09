import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Eye, Loader2, X } from "lucide-react";

export function FeedViewersSheet({
  postId,
  count,
  onClose,
}: {
  postId: Id<"feedPosts">;
  count: number;
  onClose: () => void;
}) {
  const viewers = useQuery(api.feed.postViewers, { postId }) as
    | {
        userId: string;
        username: string;
        image: string | null;
        premium: boolean;
        createdAt: number;
      }[]
    | undefined;

  return (
    <div className="fixed inset-0 z-[115] flex flex-col justify-end" onClick={onClose}>
      <div className="flex-1 bg-black/45 backdrop-blur-[1px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="feed-viewer-sheet flex h-[50dvh] min-h-[300px] flex-col rounded-t-[24px] border-t border-white/12 bg-[#111318] text-white shadow-[0_-30px_80px_-30px_rgba(0,0,0,.95)]"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="relative flex shrink-0 items-center px-4 pb-2">
          <span className="size-8" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[15px] font-black">Dilihat oleh</p>
            <p className="mt-0.5 text-[9px] font-semibold text-white/38">
              {count.toLocaleString("id-ID")} penayangan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup daftar penonton"
            className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/65"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {!viewers && (
            <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-white/40">
              <Loader2 className="size-4 animate-spin" /> Memuat penonton…
            </div>
          )}
          {viewers?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Eye className="size-7 text-white/25" />
              <p className="text-[11px] font-semibold text-white/40">
                Belum ada data penonton. Penonton baru muncul setelah konten dibuka.
              </p>
            </div>
          )}
          {viewers?.map((v) => (
            <div
              key={v.userId}
              className="flex items-center gap-3 border-b border-white/6 py-2.5 last:border-b-0"
            >
              <Avatar src={v.image ?? undefined} seed={v.username} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[12px] font-bold text-white/85">
                  {v.username}
                  {v.premium && <BlueCheck className="size-3.5 shrink-0" />}
                </p>
                <p className="mt-0.5 text-[9px] text-white/32">Melihat konten ini</p>
              </div>
              <Eye className="size-3.5 shrink-0 text-white/22" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeedPrivacySheet({
  post,
  onClose,
}: {
  post: {
    postId: Id<"feedPosts">;
    privacy: "all" | "teman" | "private";
    allowComments?: boolean;
    allowReuse?: boolean;
  };
  onClose: () => void;
}) {
  const update = useMutation(api.feed.updatePostSettings);
  const [privacy, setPrivacy] = useState(post.privacy);
  const [comments, setComments] = useState(post.allowComments !== false);
  const [reuse, setReuse] = useState(post.allowReuse !== false);

  const save = (patch: {
    privacy?: "all" | "teman" | "private";
    allowComments?: boolean;
    allowReuse?: boolean;
  }) => {
    void update({ postId: post.postId, ...patch }).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan"),
    );
  };

  const options = [
    ["all", "Semua orang", "Siapa saja dapat menonton konten ini"],
    ["teman", "Teman", "Hanya teman yang bisa menonton"],
    ["private", "Hanya Anda", "Konten hanya terlihat olehmu"],
  ] as const;

  return (
    <div className="fixed inset-0 z-[118] flex flex-col justify-end" onClick={onClose}>
      <div className="flex-1 bg-black/45 backdrop-blur-[1px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[66dvh] flex-col rounded-t-[20px] bg-[#f7f7f7] text-[#17171a] shadow-[0_-30px_80px_-30px_rgba(0,0,0,.9)]"
      >
        <div className="relative flex shrink-0 items-center px-4 pb-10 pt-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan privasi"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-black"
          >
            <X className="size-6" strokeWidth={1.8} />
          </button>
          <h2 className="w-full text-center text-[17px] font-black">Pengaturan Privasi</h2>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-black/8 px-4 pb-3">
            <p className="mb-2 text-[13px] font-black">Siapa yang dapat menonton</p>
            {options.map(([key, label, desc]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPrivacy(key);
                  save({ privacy: key });
                }}
                className="flex w-full items-start gap-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{label}</span>
                  <span className="mt-0.5 block text-[10px] text-black/42">{desc}</span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                    privacy === key ? "border-[#ec2b5a]" : "border-black/20",
                  )}
                >
                  {privacy === key && <span className="size-2.5 rounded-full bg-[#ec2b5a]" />}
                </span>
              </button>
            ))}
          </div>

          <div className="border-b border-black/8 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[14px] font-semibold">Izinkan komentar</span>
              <button
                type="button"
                role="switch"
                aria-checked={comments}
                onClick={() => {
                  const next = !comments;
                  setComments(next);
                  save({ allowComments: next });
                }}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition",
                  comments ? "bg-[#31c8e8]" : "bg-black/18",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition-all",
                    comments ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-black/40">
              Matikan jika kamu tidak ingin siapa pun menulis komentar.
            </p>
          </div>

          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[14px] font-semibold">
                Izinkan penggunaan ulang konten
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={reuse}
                onClick={() => {
                  const next = !reuse;
                  setReuse(next);
                  save({ allowReuse: next });
                }}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition",
                  reuse ? "bg-[#31c8e8]" : "bg-black/18",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition-all",
                    reuse ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-black/40">
              Duet, Stitch, stiker, dan tambahkan ke Story.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            toast.success("Pengaturan privasi disimpan");
            onClose();
          }}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-black/8 py-3.5 text-[13px] font-black text-[#17171a]"
        >
          <Check className="size-4" /> Selesai
        </button>
      </div>
    </div>
  );
}
