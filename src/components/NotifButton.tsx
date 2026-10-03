import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import {
  Bell,
  CheckCheck,
  Megaphone,
  MessageSquare,
  Sparkles,
} from "lucide-react";
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
}: {
  className?: string;
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
          "relative flex size-9 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-foreground",
          className,
        )}
      >
        <Bell className="size-4" />
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
  const comments = friendComments ?? [];
  const empty = list.length === 0 && comments.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto border-white/15 bg-background/95 pb-6 backdrop-blur"
      >
        <SheetHeader className="px-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" /> Notifikasi
          </SheetTitle>
        </SheetHeader>

        {empty ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            Belum ada notifikasi
          </p>
        ) : (
          <div className="space-y-2 px-4">
            {list.map((n: any, i: number) => (
              <div
                key={n._id}
                className={cn(
                  "flex gap-2.5 rounded-xl border p-2.5",
                  i === 0
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    i === 0 ? "bg-primary/20" : "bg-white/[0.06]",
                  )}
                >
                  {n.type === "update" ? (
                    <Sparkles className="size-4 text-primary" />
                  ) : (
                    <Megaphone className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-bold">{n.title}</p>
                    {i === 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                        Terbaru
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
                      {n.body}
                    </p>
                  )}
                </div>
              </div>
            ))}

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
                    className="block w-full overflow-hidden rounded-lg border border-border/70 bg-secondary/30 text-left transition hover:border-foreground/40"
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