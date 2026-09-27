import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, BlueCheck, ShineBadge } from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo } from "@/lib/lstream";
import { Info as InfoIcon } from "lucide-react";

export default function Info() {
  return (
    <AppLayout>
      <InfoContent />
    </AppLayout>
  );
}

function InfoContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const friendComments = useQuery(api.activities.myFriendsComments, user ? {} : "skip");

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-violet-600/20 text-violet-300">
          <InfoIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-black leading-tight">Info</h1>
          <p className="text-[11px] text-muted-foreground">
            Komentar teman & developer di semua anime — terbaru dulu
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {(friendComments ?? []).map((c: any) => (
          <button
            key={c._id}
            onClick={() => navigate(`/?pilih=${c.animeId.split("__")[0]}`)}
            className="block w-full overflow-hidden rounded-lg border border-border/70 bg-secondary/30 text-left transition hover:border-violet-500/50"
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
                    <ShineBadge
                      label={STAFF_BADGE[c.staffRole].name}
                      gradient={STAFF_BADGE[c.staffRole].cls}
                    />
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-zinc-300">{c.text}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  ❤️ {c.likeCount ?? 0}
                </p>
              </div>
            </div>
          </button>
        ))}
        {friendComments && friendComments.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Belum ada komentar teman — tambahkan teman lewat chat!
          </p>
        )}
      </div>
    </div>
  );
}
