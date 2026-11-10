import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { CheckCheck, Megaphone, ArrowRight } from "lucide-react";
import {
  BellIcon,
  ChevronLeftIcon,
  SparklesIcon,
} from "@/components/ios-icons";
import { StripBackIcon } from "@/components/StripBack";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/lstream-ui";
import { timeAgo } from "@/lib/lstream";
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
  const empty = list.length === 0 && news.length === 0;

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
              Pengumuman, ajakan Afinitas, dan pemberitahuan penting akan
              muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 px-4 pb-4 pt-3">
            {news.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                  <Megaphone className="size-3" /> Pengumuman
                </p>
                {news.map((a: any) => (
                  <div
                    key={a._id}
                    className="overflow-hidden rounded-[22px] border border-amber-200/15 bg-amber-300/[0.035] p-3.5"
                  >
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-300/10 text-amber-200/80">
                        <Megaphone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white/90">
                            Pengumuman YoruNime
                          </p>
                          <span className="shrink-0 text-[9px] font-medium text-white/30">
                            {timeAgo(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-white/65">
                          {a.message}
                        </p>
                        <p className="mt-1.5 text-[9px] font-medium text-white/25">
                          dari {a.authorName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {list.length > 0 && (
              <p className="flex items-center gap-1.5 px-0.5 pt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                Aktivitas
              </p>
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
                    "block w-full overflow-hidden rounded-[20px] border p-3 text-left transition hover:bg-white/[0.055] active:scale-[0.995]",
                    n.type === "premiumClaim"
                      ? "border-amber-200/20 bg-amber-300/[0.045]"
                      : isAffinity
                        ? "border-pink-200/18 bg-pink-300/[0.04]"
                        : i === 0
                          ? "border-white/16 bg-white/[0.065]"
                          : "border-white/8 bg-white/[0.03]",
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
                        <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">
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

            {!empty && (
              <p className="flex items-center justify-center gap-1.5 pt-3 text-[9.5px] text-white/25">
                <CheckCheck className="size-3" /> Semua notifikasi sudah dibaca
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}