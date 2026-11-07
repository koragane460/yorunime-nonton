import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { CheckCheck, Megaphone, MessageSquare, ArrowRight } from "lucide-react";
import {
  BellIcon,
  ChevronLeftIcon,
  SparklesIcon,
} from "@/components/ios-icons";
import { StripBackIcon } from "@/components/StripBack";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Area "notif": satu tempat untuk semua pemberitahuan.
 *
 * Broadcast developer, notifikasi sistem, dan komentar teman dikumpulkan di
 * sini, bukan tersebar di beberapa halaman. Di luar sheet, lonceng menampilkan
 * titik merah selama masih ada yang belum dibaca, jadi user tahu ada yang baru
 * tanpa harus membuka apa pun.
 *
 * Notifikasi terbaru ("gasemunta") selalu di paling atas, ditandai label
 * "Terbaru", supaya yang barusan masuk langsung kelihatan tanpa scroll.
 */
export function NotifButton({
  className,
  iconClassName,
  sizeClassName = "size-10",
}: {
  className?: string;
  iconClassName?: string;
  sizeClassName?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useQuery(api.moderation.myUnreadCount, user ? {} : "skip");

  return (
    <>
      <button
        type="button"
        aria-label={
          unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"
        }
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex shrink-0 items-center justify-center text-white/75 transition hover:text-white active:scale-95",
          sizeClassName,
          className,
        )}
      >
        <BellIcon className={cn("size-5", iconClassName)} />
        {unread ? <UnreadBadge count={unread} /> : null}
      </button>

      <NotifSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Titik merah + jumlah notifikasi yang belum dibaca. */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-black/60">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NotifSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const notifs = useQuery(api.moderation.myNotifications, user ? {} : "skip");
  const announcements = useQuery(api.moderation.activeAnnouncements, {});
  const friendComments = useQuery(
    api.activities.myFriendsComments,
    user ? {} : "skip",
  );

  const markRead = useMutation(api.activities.markNotificationsRead);
  const prune = useMutation(api.moderation.pruneMyNotifications);

  // Tandai terbaca + buang yang lawas setelah daftar benar-benar dibuka,
  // bukan saat halaman lain dirender. Dengan begitu titik merahnya sempat tampil.
  useEffect(() => {
    if (!open || !user || !notifs) return;
    void markRead({}).catch(() => {});
    void prune({}).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!notifs]);

  const list = notifs ?? [];
  const news = announcements ?? [];
  const comments = friendComments ?? [];
  const empty = list.length === 0 && comments.length === 0 && news.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-0 top-0 h-dvh max-h-none w-full max-w-none gap-0 overflow-y-auto rounded-none border-0 bg-background/97 pb-6 backdrop-blur md:mx-auto md:max-w-2xl"
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-center gap-3 border-b border-white/10 bg-background/95 px-3 py-3 backdrop-blur">
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Kembali"
            className="flex shrink-0 items-center py-1 pr-1 text-white/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <SheetTitle className="flex items-center gap-2 text-base">
            <BellIcon className="size-4 text-primary" /> Notifikasi
          </SheetTitle>
        </SheetHeader>

        {empty ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <BellIcon className="size-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-bold">Belum ada notifikasi</p>
            <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              Broadcast developer, ajakan Afinitas, dan komentar teman akan
              muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 px-4 pt-3">
            {news.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
                  <Megaphone className="size-3" /> Pengumuman
                </p>
                {news.map((a: any) => (
                  <div
                    key={a._id}
                    className="overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/[0.12] to-transparent p-3"
                  >
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
                        <Megaphone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13px] font-bold">
                            Pengumuman YoruNime
                          </p>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {timeAgo(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-[12.5px] leading-snug text-zinc-200">
                          {a.message}
                        </p>
                        <p className="mt-1 text-[10px] text-white/35">
                          dari {a.authorName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {list.map((n: any, i: number) => {
              // Ajakan/hasil Afinitas → langsung ke layar Afinitas KAMU.
              const isAffinity = !!n.type?.startsWith("affinity");
              const handleOpen = () => {
                if (!isAffinity) return;
                onOpenChange(false);
                navigate("/akun?afinitas=1");
              };
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={handleOpen}
                  className={cn(
                    "block w-full overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.99]",
                    n.type === "premiumClaim"
                      ? "border-amber-500/40 bg-gradient-to-r from-amber-500/[0.12] to-transparent"
                      : isAffinity
                        ? "border-pink-400/45 bg-gradient-to-r from-pink-500/[0.16] to-transparent shadow-[0_0_18px_-10px_rgba(236,72,153,.8)]"
                        : i === 0
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/10 bg-white/[0.05]",
                    isAffinity && "cursor-pointer",
                  )}
                >
                  <div className="flex gap-3">
                    {n.refUserId &&
                    (n.type === "premiumClaim" || isAffinity) ? (
                      <span className="relative mt-0.5 shrink-0">
                        <Avatar
                          src={n.refImage}
                          seed={n.refUsername ?? n.refUserId}
                          className="size-9 rounded-full ring-2 ring-white/25"
                        />
                        {isAffinity && (
                          <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-pink-500 text-[9px] text-white ring-2 ring-black/60">
                            ♥
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                          n.type === "update"
                            ? "bg-primary/20 text-primary"
                            : "bg-white/[0.06] text-muted-foreground",
                          i === 0 && n.type !== "update" && "bg-primary/15",
                        )}
                      >
                        {n.type === "update" ? (
                          <SparklesIcon className="size-4" />
                        ) : (
                          <Megaphone className="size-4" />
                        )}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-bold">
                          {n.title}
                        </p>
                        {i === 0 && (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-primary-foreground">
                            Terbaru
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-1 text-[12.5px] leading-snug text-zinc-300">
                          {n.body}
                        </p>
                      )}
                      {isAffinity && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-pink-400/40 bg-pink-500/25 px-2.5 py-1 text-[10px] font-black text-pink-100">
                          Buka Afinitas kamu
                          <ArrowRight className="size-3" aria-hidden />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {comments.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <MessageSquare className="size-3" /> Komentar teman
                </p>
                {comments.map((c: any) => (
                  <button
                    key={c._id}
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/?pilih=${c.animeId.split("__")[0]}`);
                    }}
                    className="block w-full overflow-hidden rounded-2xl border border-border/70 bg-secondary/30 text-left transition hover:border-foreground/40"
                  >
                    {c.bannerUrl && (
                      <div
                        className="h-7 w-full bg-cover bg-center opacity-70"
                        style={{ backgroundImage: `url(${c.bannerUrl})` }}
                      />
                    )}
                    <div className="flex gap-2.5 p-2.5">
                      <Avatar src={c.image} seed={c.username} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-xs font-bold">{c.username}</p>
                          {c.premium && <BlueCheck className="size-3.5" />}
                          {c.staffRole && STAFF_BADGE[c.staffRole] && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {STAFF_BADGE[c.staffRole].name}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm text-zinc-300">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            <p className="flex items-center justify-center gap-1.5 pt-3 text-[10px] text-muted-foreground">
              <CheckCheck className="size-3" /> Semua notifikasi sudah dibaca
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}