import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeForLevel, STAFF_BADGE, avatarFallback, clanNameCls } from "@/lib/lstream";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 text-lg font-bold tracking-tight">{children}</h2>
  );
}

export function AnimeCard({
  id,
  title,
  image,
  score,
  status,
  rank,
  onClick,
  isNew,
}: {
  id?: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  rank?: number;
  onClick?: () => void;
  isNew?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-border/60 bg-card text-left transition hover:border-amber-300/60 hover:shadow-[0_0_18px_-4px] hover:shadow-amber-300/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
            no image
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-amber-200">
            #{rank}
          </span>
        )}
        {isNew && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
            New
          </span>
        )}
        {status && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px]">
            {status}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="line-clamp-2 min-h-8 text-xs font-medium leading-4">{title}</p>
        {score !== undefined && score > 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-300">
            <Star className="size-3 fill-amber-300" /> {score.toFixed(2)}
          </p>
        )}
      </div>
    </button>
  );
}

export function AnimeGrid({
  items,
  onPick,
  ranked,
  newIds,
}: {
  items: {
    id: string;
    title: string;
    image: string;
    score?: number;
    status?: string;
  }[];
  onPick: (id: string) => void;
  ranked?: boolean;
  newIds?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((a, i) => (
        <AnimeCard
          key={a.id + i}
          id={a.id}
          title={a.title}
          image={a.image}
          score={a.score}
          status={a.status}
          rank={ranked ? i + 1 : undefined}
          isNew={newIds?.has(a.id)}
          onClick={() => onPick(a.id)}
        />
      ))}
    </div>
  );
}

/** Badge berkilau (staff / clan role) */
export function ShineBadge({
  label,
  gradient,
  className,
}: {
  label: string;
  gradient: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "badge-shine inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow",
        "bg-gradient-to-r",
        gradient,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function UserBadges({
  level,
  staffRole,
}: {
  level: number;
  staffRole?: string;
}) {
  const badge = badgeForLevel(level);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ShineBadge
        label={badge.name}
        gradient={badge.cls}
        className={badge.name === "Grandmaster" ? "text-white mix-blend-normal" : ""}
      />
      {staffRole && STAFF_BADGE[staffRole] && (
        <ShineBadge label={STAFF_BADGE[staffRole].name} gradient={STAFF_BADGE[staffRole].cls} />
      )}
    </div>
  );
}

export function Avatar({
  src,
  seed,
  className,
  online,
}: {
  src?: string;
  seed?: string;
  className?: string;
  online?: boolean;
}) {
  return (
    <span className={cn("relative inline-block", className)}>
      <img
        src={src ?? avatarFallback(seed)}
        alt=""
        className="size-full rounded-full border border-amber-300/40 object-cover"
      />
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card",
            online ? "bg-green-500" : "bg-zinc-500",
          )}
        />
      )}
    </span>
  );
}

/** Bar level 1..200 clan */
export function ClanLevelBar({
  level,
  progress,
  cost,
}: {
  level: number;
  progress: number;
  cost: number;
}) {
  const pct = Math.min(100, Math.round((progress / Math.max(1, cost)) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>
          Level <b className="text-foreground">{level}</b> / 200
        </span>
        <span>
          {progress} / {cost} 💎
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ClanTag({
  icon,
  tag,
  color,
  className,
}: {
  icon: string;
  tag: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg rounded-tl-none rounded-br-none border border-amber-300/40 bg-black/40 px-2 py-0.5 text-xs font-bold",
        clanNameCls(color) || "text-amber-200",
        className,
      )}
    >
      <span>{icon}</span> [{tag}]
    </span>
  );
}
