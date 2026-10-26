/** Level math sisi client — harus sama dengan src/convex/users.ts */
const TIERS = [
  { min: 1, max: 49, per: 12000, badge: "Bronze" },
  { min: 50, max: 99, per: 27000, badge: "Silver" },
  { min: 100, max: 499, per: 45000, badge: "Diamond" },
  { min: 500, max: 1000, per: 70000, badge: "Emerald" },
  { min: 1001, max: 4999, per: 120000, badge: "Master" },
  { min: 5000, max: 12999, per: 165000, badge: "Grandmaster" },
  { min: 13000, max: 19999, per: 220000, badge: "Central" },
  { min: 20000, max: 27999, per: 260000, badge: "Ruby" },
  { min: 28000, max: 999999999, per: 300000, badge: "Ascendant" },
];

export function tierForLevel(level: number) {
  for (const t of TIERS) if (level >= t.min && level <= t.max) return t;
  return TIERS[TIERS.length - 1];
}

/** XP dibutuhkan untuk naik dari `level` ke `level + 1`. */
export function xpForLevel(level: number) {
  return tierForLevel(level).per;
}
