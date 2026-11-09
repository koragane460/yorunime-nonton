import { useMemo, useState } from "react";
import {
  Crown,
  Flame,
  Gem,
  Heart,
  Orbit,
  Shield,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TierKind = "followers" | "likes";

export type TierBadge = {
  id: string;
  kind: TierKind;
  tier: number;
  title: string;
  requirement: number;
  note: string;
  from: string;
  via: string;
  to: string;
  glow: string;
};

const FOLLOWERS = [
  ["Pemula Ramah", 0, "Langkah pertama di lingkaran"],
  ["Sahabat Baru", 100, "Seratus orang memilih tinggal"],
  ["Pengagum", 250, "Mulai jadi nama yang dicari"],
  ["Penyemangat", 500, "Setiap konten punya penonton setia"],
  ["Pengiring", 1_000, "Ribuan alasan untuk terus hadir"],
  ["Penjaga", 2_500, "Lingkaran kecil yang makin kuat"],
  ["Pendukung", 5_000, "Dukungan yang terasa nyata"],
  ["Penaung", 7_500, "Kamu punya komunitas sendiri"],
  ["Pemimpin", 10_000, "Sepuluh ribu suara mengikuti"],
  ["Panutan", 15_000, "Jejakmu mulai dicontoh"],
  ["Inspirator", 25_000, "Inspirasi menyebar lebih jauh"],
  ["Magnet Sosial", 40_000, "Orang datang tanpa dipanggil"],
  ["Bintang Komunitas", 60_000, "Namamu menyala di komunitas"],
  ["Legenda Lokal", 85_000, "Kisahmu sudah dikenal"],
  ["Ikatan Emas", 120_000, "Ikatan yang tak mudah putus"],
  ["Mahkota Perak", 175_000, "Mulai masuk jajaran teratas"],
  ["Mahkota Emas", 250_000, "Mahkota untuk lingkaran raksasa"],
  ["Penguasa Lingkaran", 400_000, "Ratusan ribu orang di sisimu"],
  ["Kaisar Sosial", 700_000, "Kekuatan sosial level tertinggi"],
  ["Dewa Persahabatan", 1_000_000, "Satu juta hati memilihmu"],
] as const;

const LIKES = [
  ["Percikan", 0, "Satu like menyalakan awal"],
  ["Bara", 250, "Api kecil yang mulai hangat"],
  ["Nyala", 500, "Cahayamu mulai terlihat"],
  ["Pijar", 1_000, "Seribu apresiasi menyala"],
  ["Sorot", 2_500, "Kontenmu jadi pusat perhatian"],
  ["Kilau", 5_000, "Lima ribu kilauan kecil"],
  ["Mercusuar", 10_000, "Cahaya yang menuntun banyak orang"],
  ["Supernova", 20_000, "Ledakan apresiasi yang besar"],
  ["Aurora", 35_000, "Warna baru di langit komunitas"],
  ["Meteor", 60_000, "Jejak cahaya yang tak terlupakan"],
  ["Nebula", 100_000, "Ratusan ribu bintang berkumpul"],
  ["Kosmik", 175_000, "Energi apresiasi lintas batas"],
  ["Quasar", 300_000, "Inti cahaya paling terang"],
  ["Pulsar", 500_000, "Denyut popularitas yang stabil"],
  ["Singularitas", 800_000, "Gravitasi perhatian tak terbendung"],
  ["Horizon", 1_200_000, "Cakrawala baru telah terbuka"],
  ["Mahkota Cahaya", 2_000_000, "Dua juta like bermahkota"],
  ["Galaksi", 3_500_000, "Kumpulan cahaya yang luas"],
  ["Alam Semesta", 6_000_000, "Skala apresiasi luar biasa"],
  ["Abadi", 10_000_000, "Sepuluh juta cahaya yang abadi"],
] as const;

function palette(kind: TierKind, tier: number) {
  if (kind === "followers") {
    if (tier <= 4) return ["#5eead4", "#38bdf8", "#6366f1"];
    if (tier <= 8) return ["#67e8f9", "#818cf8", "#a855f7"];
    if (tier <= 12) return ["#c4b5fd", "#8b5cf6", "#4f46e5"];
    if (tier <= 16) return ["#fde68a", "#d4af37", "#7c4a03"];
    return ["#fff7cc", "#f6c445", "#b86b00"];
  }
  if (tier <= 4) return ["#fecdd3", "#fb7185", "#e11d48"];
  if (tier <= 8) return ["#fdba74", "#fb7185", "#be123c"];
  if (tier <= 12) return ["#fde68a", "#fb923c", "#dc2626"];
  if (tier <= 16) return ["#a5f3fc", "#38bdf8", "#7c3aed"];
  return ["#fff7b0", "#fbbf24", "#7c2d12"];
}

function build(kind: TierKind, source: readonly (readonly [string, number, string])[]) {
  return source.map(([title, requirement, note], index) => {
    const [from, via, to] = palette(kind, index + 1);
    return {
      id: `${kind}:${index + 1}`,
      kind,
      tier: index + 1,
      title,
      requirement,
      note,
      from,
      via,
      to,
      glow: kind === "followers" ? to : via,
    } satisfies TierBadge;
  });
}

export const TIER_BADGES: Record<TierKind, TierBadge[]> = {
  followers: build("followers", FOLLOWERS),
  likes: build("likes", LIKES),
};

const ALL_BADGES = [...TIER_BADGES.followers, ...TIER_BADGES.likes];

export function tierBadgeById(id: string | null | undefined) {
  return ALL_BADGES.find((b) => b.id === id) ?? null;
}

export function currentTierId(kind: TierKind, value: number) {
  const list = TIER_BADGES[kind];
  return [...list].reverse().find((b) => value >= b.requirement)?.id ?? list[0].id;
}

export function fmtTierRequirement(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)} jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)} rb`;
  return String(n);
}

function glyphFor(badge: TierBadge) {
  if (badge.kind === "followers") {
    if (badge.tier <= 5) return Shield;
    if (badge.tier <= 10) return Users;
    if (badge.tier <= 15) return Gem;
    if (badge.tier <= 18) return Crown;
    return Trophy;
  }
  if (badge.tier <= 5) return Flame;
  if (badge.tier <= 10) return Sparkles;
  if (badge.tier <= 15) return Sun;
  if (badge.tier <= 18) return Orbit;
  return Zap;
}

/**
 * Sigil tier: dua keluarga bentuk yang benar-benar berbeda.
 * Followers = perisai kristal berlapis. Like = medali matahari berputar.
 * Efek memakai cahaya, kilau logam, dan halo; bukan partikel.
 */
export function TierBadgeMark({
  badge,
  size = 56,
  className,
}: {
  badge: TierBadge;
  size?: number;
  className?: string;
}) {
  const Icon = glyphFor(badge);
  const power = 0.35 + badge.tier * 0.032;
  return (
    <span
      aria-hidden
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="pointer-events-none absolute inset-[-28%] rounded-full blur-xl"
        style={{
          opacity: power,
          background: `radial-gradient(circle, ${badge.glow}aa 0%, ${badge.via}55 36%, transparent 72%)`,
        }}
      />
      {badge.kind === "followers" ? (
        <>
          <span
            className="absolute inset-[2%] shadow-[inset_0_1px_1px_rgba(255,255,255,.85)]"
            style={{
              clipPath: "polygon(50% 0%, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%)",
              background: `linear-gradient(145deg, ${badge.from}, ${badge.via} 54%, ${badge.to})`,
            }}
          />
          <span
            className="absolute inset-[15%] opacity-80"
            style={{
              clipPath: "polygon(50% 0%, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%)",
              background: `linear-gradient(160deg, rgba(255,255,255,.35), transparent 40%, ${badge.to}bb)`,
            }}
          />
          <span className="yn-tier-sheen absolute inset-[15%] overflow-hidden" />
          <Icon
            className="relative z-10 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.55)]"
            style={{ width: size * 0.36, height: size * 0.36 }}
            strokeWidth={2}
          />
          {badge.tier >= 14 && (
            <span
              className="yn-tier-orbit absolute inset-[-12%] rounded-full border border-dashed opacity-60"
              style={{ borderColor: badge.from }}
            />
          )}
        </>
      ) : (
        <>
          <span
            className="absolute inset-[4%] rounded-full shadow-[inset_0_2px_2px_rgba(255,255,255,.55)]"
            style={{
              background: `conic-gradient(from 30deg, ${badge.to}, ${badge.from}, ${badge.via}, ${badge.to})`,
            }}
          />
          <span
            className="absolute inset-[15%] rounded-full"
            style={{
              background: `radial-gradient(circle at 34% 25%, rgba(255,255,255,.65), transparent 34%), linear-gradient(145deg, ${badge.via}, ${badge.to})`,
              boxShadow: `inset 0 0 ${8 + badge.tier}px rgba(0,0,0,.45)`,
            }}
          />
          <span className="yn-tier-sheen absolute inset-[15%] overflow-hidden rounded-full" />
          <Icon
            className="relative z-10 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.55)]"
            style={{ width: size * 0.36, height: size * 0.36 }}
            strokeWidth={2}
          />
          {badge.tier >= 11 && (
            <span
              className="yn-tier-orbit absolute inset-[-13%] rounded-full border opacity-65"
              style={{ borderColor: badge.from }}
            />
          )}
          {badge.tier >= 18 && (
            <span
              className="absolute inset-[-22%] rounded-full border border-white/25 opacity-70"
              style={{ boxShadow: `0 0 ${12}px ${badge.from}88` }}
            />
          )}
        </>
      )}
    </span>
  );
}

export function TierPinnedBadge({
  badgeId,
  compact = false,
}: {
  badgeId: string | null | undefined;
  compact?: boolean;
}) {
  const badge = tierBadgeById(badgeId);
  if (!badge) return null;
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border bg-black/45 font-black text-white backdrop-blur",
        compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
      )}
      style={{
        borderColor: `${badge.from}77`,
        boxShadow: `0 0 16px -5px ${badge.glow}aa, inset 0 1px 0 rgba(255,255,255,.16)`,
      }}
    >
      <TierBadgeMark badge={badge} size={compact ? 14 : 17} />
      <span className="truncate">{badge.title}</span>
      <span className="absolute inset-y-0 -left-1/3 w-1/3 yn-tier-sheen" />
    </span>
  );
}

function TierCard({
  badge,
  unlocked,
  selected,
  onSelect,
}: {
  badge: TierBadge;
  unlocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-2.5 text-left transition active:scale-[0.98]",
        selected
          ? "border-white/45 bg-white/[0.1]"
          : "border-white/10 bg-[#11141c] hover:border-white/25",
        !unlocked && "opacity-58",
      )}
    >
      <span
        className="pointer-events-none absolute -right-7 -top-7 size-24 rounded-full blur-2xl"
        style={{ background: `${badge.glow}55`, opacity: unlocked ? 0.8 : 0.25 }}
      />
      <span className="relative flex items-center gap-2">
        <TierBadgeMark badge={badge} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/40">
            {badge.kind === "followers" ? <Users className="size-2.5" /> : <Heart className="size-2.5" />}
            Tier {badge.tier}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] font-black text-white">
            {badge.title}
          </span>
          <span
            className="mt-0.5 block truncate text-[9px] font-bold"
            style={{ color: unlocked ? badge.from : "rgba(255,255,255,.35)" }}
          >
            {unlocked ? "Terbuka" : `Butuh ${fmtTierRequirement(badge.requirement)}`}
          </span>
        </span>
      </span>
    </button>
  );
}

export function TierRewardsSheet({
  followers,
  likes,
  pinned,
  onPin,
  onClose,
}: {
  followers: number;
  likes: number;
  pinned?: string | null;
  onPin: (badgeId: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<TierKind>("followers");
  const count = kind === "followers" ? followers : likes;
  const list = TIER_BADGES[kind];
  const active = useMemo(() => currentTierId(kind, count), [kind, count]);
  const [selected, setSelected] = useState<string>(() =>
    pinned?.startsWith("followers:")
      ? pinned
      : currentTierId("followers", followers),
  );
  const selectedBadge = tierBadgeById(selected) ?? list[0];
  const activeBadge = tierBadgeById(active) ?? list[0];
  const next = list.find((b) => b.tier === activeBadge.tier + 1);
  const unlocked = count >= selectedBadge.requirement;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-[#08090e] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-[radial-gradient(80%_80%_at_50%_0%,rgba(139,92,246,.24),transparent_68%)]" />
      <div className="relative flex items-center gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.8rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Rewards"
          className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/80"
        >
          <span className="text-xl leading-none">‹</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-center text-[17px] font-black tracking-tight">Rewards</h2>
          <p className="text-center text-[9px] font-semibold text-white/35">
            Koleksi tier badge Feed
          </p>
        </div>
        <span className="size-9" />
      </div>

      <div className="relative flex gap-1 rounded-2xl border border-white/10 bg-black/35 p-1 mx-4">
        {(
          [
            ["followers", "Followers", Users],
            ["likes", "Like", Heart],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setKind(key);
              const id = currentTierId(key, key === "followers" ? followers : likes);
              setSelected(pinned && pinned.startsWith(`${key}:`) ? pinned : id);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-black transition",
              kind === key
                ? "bg-white text-black shadow-[0_8px_22px_-12px_rgba(255,255,255,.7)]"
                : "text-white/45",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="thin-scroll relative min-h-0 flex-1 overflow-y-auto px-3 pb-32 pt-3">
        <div className="relative overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.045] p-3.5">
          <span
            className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full blur-3xl"
            style={{ background: `${activeBadge.glow}55` }}
          />
          <div className="relative flex items-center gap-3">
            <TierBadgeMark badge={activeBadge} size={74} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                Tier saat ini · {kind === "followers" ? "Followers" : "Like"}
              </p>
              <p className="mt-0.5 text-[18px] font-black">{activeBadge.title}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-white/45">
                {fmtTierRequirement(count)} {kind === "followers" ? "pengikut" : "suka"}
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-black text-white/60">
              {activeBadge.tier}/20
            </span>
          </div>
          {next && (
            <div className="relative mt-3">
              <div className="flex items-center justify-between text-[9px] font-bold text-white/40">
                <span>Menuju {next.title}</span>
                <span>{fmtTierRequirement(next.requirement)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, ((count - activeBadge.requirement) / Math.max(1, next.requirement - activeBadge.requirement)) * 100))}%`,
                    background: `linear-gradient(90deg, ${activeBadge.from}, ${activeBadge.via})`,
                    boxShadow: `0 0 12px ${activeBadge.glow}`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-2 mt-4 flex items-end justify-between px-1">
          <div>
            <p className="text-[13px] font-black">20 Tier {kind === "followers" ? "Followers" : "Like"}</p>
            <p className="mt-0.5 text-[9px] text-white/35">
              Dari level terendah sampai tertinggi
            </p>
          </div>
          <span className="text-[9px] font-bold text-white/30">
            {list.filter((b) => count >= b.requirement).length}/20 terbuka
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {list.map((badge) => (
            <TierCard
              key={badge.id}
              badge={badge}
              unlocked={count >= badge.requirement}
              selected={selected === badge.id}
              onSelect={() => setSelected(badge.id)}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#0b0d13]/95 px-4 pb-[max(env(safe-area-inset-bottom),0.8rem)] pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <TierBadgeMark badge={selectedBadge} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black">{selectedBadge.title}</p>
            <p className="truncate text-[9.5px] font-semibold text-white/40">
              {unlocked
                ? selectedBadge.note
                : `Butuh ${fmtTierRequirement(selectedBadge.requirement - count)} lagi`}
            </p>
          </div>
          <button
            type="button"
            disabled={!unlocked}
            onClick={() => void onPin(selectedBadge.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[10.5px] font-black transition active:scale-95",
              unlocked
                ? "bg-white text-black shadow-[0_0_22px_-5px_rgba(255,255,255,.8)]"
                : "bg-white/10 text-white/30",
            )}
          >
            {pinned === selectedBadge.id ? "Terpasang" : "Pasang badge"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TierBadgePickerRow({
  pinned,
  onOpen,
}: {
  pinned?: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1.5 flex w-full items-center gap-3 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-left transition active:scale-[0.99]"
    >
      {tierBadgeById(pinned) ? (
        <TierPinnedBadge badgeId={pinned} />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-white/35">
          <Star className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-white/75">
          {tierBadgeById(pinned)?.title ?? "Pilih tier badge"}
        </span>
        <span className="block text-[9px] text-white/32">
          Tampil di bawah username khusus Feed Mode
        </span>
      </span>
      <span className="text-[10px] font-black text-white/45">Pilih</span>
    </button>
  );
}
