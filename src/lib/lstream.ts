import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import { useQuery } from "convex/react";

/** Tanggal "baru saja / x menit lalu / ..." */
export function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

export const DAYS_ID = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jum'at",
  "Sabtu",
  "Minggu",
];
export const DAYS_EN = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Badge level user (Bronze..Grandmaster) — nama tier + ikonnya. */
export function badgeForLevel(level: number) {
  if (level >= 5000)
    return { name: "Grandmaster", icon: "👑", cls: "bg-gradient-to-r from-red-600 via-fuchsia-600 to-slate-200" };
  if (level >= 1001)
    return { name: "Master", icon: "🔮", cls: "bg-gradient-to-r from-red-700 to-red-400" };
  if (level >= 500)
    return { name: "Emerald", icon: "💎", cls: "bg-gradient-to-r from-emerald-500 to-emerald-700" };
  if (level >= 100)
    return { name: "Diamond", icon: "🔷", cls: "bg-gradient-to-r from-cyan-300 to-sky-500" };
  if (level >= 50)
    return { name: "Silver", icon: "🪙", cls: "bg-gradient-to-r from-slate-300 to-slate-500" };
  return { name: "Bronze", icon: "🪵", cls: "bg-gradient-to-r from-amber-700 to-amber-900" };
}

/** ID tampil: #nomor urut kalau ada, fallback 6 karakter akhir id. */
export function displayId(seqId?: number, rawId?: string) {
  if (seqId !== undefined && seqId !== null) return `#${seqId}`;
  return `#${(rawId ?? "").slice(-6).toUpperCase()}`;
}

export const STAFF_BADGE: Record<string, { name: string; cls: string }> = {
  dev: { name: "Developer", cls: "from-red-500 to-red-700" },
  mod: { name: "Moderator", cls: "from-purple-500 to-purple-700" },
  tester: { name: "Tester", cls: "from-green-500 to-green-700" },
  sepuh: { name: "Sepuh", cls: "from-yellow-400 to-amber-600" },
  creator: { name: "Creator", cls: "from-blue-500 to-blue-700" },
};

export const CLAN_ROLE_BADGE: Record<string, { name: string; cls: string }> = {
  leader: { name: "Leader", cls: "from-yellow-300 to-amber-500" },
  officer: { name: "Officer", cls: "from-green-400 to-emerald-600" },
  victro: { name: "Victro", cls: "from-purple-400 to-purple-600" },
  hydler: { name: "Hydler", cls: "from-sky-300 to-sky-500" },
  member: { name: "Member", cls: "from-zinc-400 to-zinc-600" },
};

/** Warna nama clan sesuai level (25/100/150/200) */
export function clanNameCls(color?: string) {
  if (color === "galaxy") return "clan-color-galaxy";
  if (color === "golden") return "clan-color-golden";
  if (color === "oren") return "text-orange-400";
  if (color === "merah") return "text-red-400";
  return "";
}

/** URL avatar default (dice) berdasarkan id */
export function avatarFallback(seed?: string) {
  const n = seed ? [...seed].reduce((s, c) => s + c.charCodeAt(0), 0) : 0;
  return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed ?? "lstream")}${n % 2 ? "&flip=true" : ""}`;
}

export function useMyAccount() {
  const user = useQuery(api.users.currentUser, {});
  const stats = useQuery(api.account.profileStats, user ? {} : "skip");
  return useMemo(() => ({ user, stats }), [user, stats]);
}
