// Tema visual YoruNime: dipilih sekali setelah login, lalu bisa diganti dari
// Pengaturan. Semua warna disimpan sebagai CSS variable supaya komponen lama
// ikut berubah tanpa perlu ditulis ulang satu per satu.

export type UiTheme = "glass" | "default";

export type ThemePalette = {
  id: string;
  name: string;
  /** [utama/gelap, lebih gelap, aksen terang, aksen pendukung] */
  colors: [string, string, string, string];
};

/**
 * 10 baris gradasi. Empat warna per baris dipakai untuk:
 * utama (tombol), bayangan, aksen terang (emas/nav), dan aksen pendukung.
 */
export const THEME_PALETTES: ThemePalette[] = [
  { id: "0", name: "Midnight Gold", colors: ["#B8863B", "#6B4423", "#F2C94C", "#D98E3A"] },
  { id: "1", name: "Sakura Dusk", colors: ["#A83E62", "#5E2039", "#F09AB4", "#D66A8A"] },
  { id: "2", name: "Ocean Glass", colors: ["#2F7E9E", "#173F55", "#7FD8EF", "#4CA9C9"] },
  { id: "3", name: "Forest Ember", colors: ["#3F7A5A", "#1F3F32", "#A9D8B4", "#D3A653"] },
  { id: "4", name: "Royal Plum", colors: ["#62439F", "#33235A", "#C3A6F5", "#8C6BC9"] },
  { id: "5", name: "Sunset Clay", colors: ["#B35346", "#5E2D2A", "#F1A17D", "#D57A5F"] },
  { id: "6", name: "Mint Steel", colors: ["#3A7C74", "#1D403D", "#9FE0D4", "#63B8A9"] },
  { id: "7", name: "Amber Noir", colors: ["#A46D24", "#553713", "#F4CE7A", "#CE9440"] },
  { id: "8", name: "Lavender Ice", colors: ["#575EA8", "#2C2F5E", "#BFC2FF", "#8589DA"] },
  { id: "9", name: "Copper Rose", colors: ["#9A4555", "#542332", "#F0A9A2", "#C76C71"] },
];

export type SavedUiTheme = {
  theme: UiTheme;
  accent: string;
};

const storageKey = (userId: string) => `yn:ui-theme:${userId}`;

function normalizeTheme(value?: string | null): UiTheme {
  return value === "glass" ? "glass" : "default";
}

function normalizeAccent(value?: string | null): string {
  if (value && THEME_PALETTES.some((p) => p.id === value)) return value;
  return "0";
}

export function readStoredUiTheme(
  userId: string,
  serverTheme?: string | null,
  serverAccent?: string | null,
): SavedUiTheme | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as { theme?: string; accent?: string };
      return {
        theme: normalizeTheme(parsed.theme),
        accent: normalizeAccent(parsed.accent),
      };
    }
  } catch {
    /* localStorage bisa diblokir di mode privat */
  }
  if (serverTheme) {
    return {
      theme: normalizeTheme(serverTheme),
      accent: normalizeAccent(serverAccent),
    };
  }
  return null;
}

export function storeUiTheme(userId: string, choice: SavedUiTheme) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(choice));
  } catch {
    /* abaikan */
  }
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 156;
}

function mix(hex: string, base: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(base);
  const to = (x: number, y: number) =>
    Math.round(x * amount + y * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${to(a.r, b.r)}${to(a.g, b.g)}${to(a.b, b.b)}`;
}

export function applyUiTheme(choice: SavedUiTheme) {
  if (typeof document === "undefined") return;
  const palette =
    THEME_PALETTES.find((p) => p.id === choice.accent) ?? THEME_PALETTES[0];
  const [main, deep, bright, support] = palette.colors;
  const root = document.documentElement;
  const rgb = hexToRgb(main);
  root.dataset.uiTheme = choice.theme;
  root.style.setProperty("--ui-a", main);
  root.style.setProperty("--ui-b", deep);
  root.style.setProperty("--ui-c", bright);
  root.style.setProperty("--ui-d", support);
  root.style.setProperty("--brand", main);
  root.style.setProperty("--primary", main);
  root.style.setProperty("--primary-foreground", isLight(main) ? "#160f09" : "#fffaf0");
  root.style.setProperty("--gold", bright);
  root.style.setProperty("--gold-strong", bright);
  root.style.setProperty("--gold-foreground", isLight(bright) ? "#241c02" : "#fffaf0");
  root.style.setProperty("--gold-strong-foreground", isLight(bright) ? "#241c02" : "#fffaf0");
  root.style.setProperty("--ring", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .55)`);
  // Satu warna solid, bukan gradasi — dipakai Home dari header sampai Season.
  root.style.setProperty("--home-tint", mix(main, "#0b0910", 0.24));
  root.style.setProperty("--glass-tint", mix(main, "#0b0910", 0.14));
}

export function paletteOf(id?: string | null) {
  return THEME_PALETTES.find((p) => p.id === id) ?? THEME_PALETTES[0];
}
