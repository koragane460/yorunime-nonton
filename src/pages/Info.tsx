import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import {
  Avatar,
  BlueCheck,
  SectionTitle,
  ShineBadge,
} from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo } from "@/lib/lstream";
import { Heart } from "lucide-react";

/**
 * Halaman Info (ikon "!" di navigasi):
 * komentar teman, clan-mu, dan developer di semua anime — terbaru dulu.
 */
export default function Info() {
  return (
    <AppLayout hideAccountPanel>
      <InfoContent />
    </AppLayout>
  );
}

function InfoContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const friendComments = useQuery(api.activities.myFriendsComments, user ? {} : "skip");

  return (
    <div className="pb-6">
      <h1 className="pb-1 pt-4 text-xl font-black">Info</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Komentar teman, clan, & developer di semua anime — terbaru dulu
      </p>

      {(friendComments ?? []).map((c: any) => (
        <button
          key={c._id}
          onClick={() => navigate(`/nonton?anime=${c.animeId.split("__")[0]}`)}
          className="mb-2.5 block w-full overflow-hidden rounded-lg border border-border/70 bg-secondary/30 text-left transition hover:border-violet-500/50"
        >
          {/* Banner user tampil di komen */}
          {c.bannerUrl && (
            <div
              className="h-8 w-full bg-cover bg-center opacity-70"
              style={{ backgroundImage: `url(${c.bannerUrl})` }}
            />
          )}
          <div className="flex gap-2.5 p-3">
            <Avatar src={c.image} seed={c.username} className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-xs font-bold text-white">{c.username}</p>
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
              <p className="mt-0.5 line-clamp-3 text-sm text-zinc-300">{c.text}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Heart className="size-3" /> {c.likeCount ?? 0}
              </p>
            </div>
          </div>
        </button>
      ))}
      {friendComments && friendComments.length === 0 && (
        <p className="py-12 text-center text-xs text-muted-foreground">
          Belum ada komentar teman — tambahkan teman lewat chat!
        </p>
      )}
    </div>
  );
}
