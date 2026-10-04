import { describe, expect, test } from "bun:test";
import { nextIndex, randomOtherIndex } from "../src/lib/musicQueue";
import { MUSIC_SECRET_CODE, isMusicSecret } from "../src/lib/musicSecret";
import { relevant } from "../src/convex/music";
import type { MusicTrack } from "../src/convex/music";

const base = {
  length: 3,
  shuffle: false,
  repeat: "all" as const,
};

describe("musik: perpindahan antrean", () => {
  test("urutan normal naik satu indeks", () => {
    expect(nextIndex({ ...base, from: 0, auto: false })).toBe(1);
    expect(nextIndex({ ...base, from: 1, auto: false })).toBe(2);
  });

  test("tombol next di lagu terakhir balik ke lagu pertama", () => {
    expect(nextIndex({ ...base, from: 2, auto: false })).toBe(0);
  });

  test("repeat off: lagu terakhir berhenti, next tetap jalan", () => {
    const off = { ...base, repeat: "off" as const };
    expect(nextIndex({ ...off, from: 2, auto: true })).toBe(-1);
    expect(nextIndex({ ...off, from: 2, auto: false })).toBe(0);
  });

  test("repeat all: lagu terakhir berputar ke lagu pertama", () => {
    expect(nextIndex({ ...base, repeat: "all", from: 2, auto: true })).toBe(0);
  });

  test("repeat one: akhir lagu mengulang lagu yang sama", () => {
    expect(nextIndex({ ...base, repeat: "one", from: 1, auto: true })).toBe(1);
    // Tapi tombol next tetap harus pindah.
    expect(nextIndex({ ...base, repeat: "one", from: 1, auto: false })).toBe(2);
  });

  test("shuffle memakai indeks acak yang berbeda", () => {
    expect(
      nextIndex({ ...base, shuffle: true, from: 0, auto: false, randomIndex: 2 }),
    ).toBe(2);
    // Hasil acak yang jatuh di lagu sendiri diabaikan.
    expect(
      nextIndex({ ...base, shuffle: true, from: 1, auto: false, randomIndex: 1 }),
    ).toBe(1);
  });

  test("antrean kosong atau belum ada lagu berhenti", () => {
    expect(nextIndex({ ...base, length: 0, from: -1, auto: true })).toBe(-1);
    expect(nextIndex({ ...base, from: -1, auto: false })).toBe(-1);
  });

  test("antrean satu lagu: acak tidak pernah membuat macet", () => {
    expect(randomOtherIndex(0, 1)).toBe(0);
    expect(
      nextIndex({ ...base, length: 1, shuffle: true, from: 0, auto: false }),
    ).toBe(0);
  });

  test("randomOtherIndex tidak pernah mengembalikan indeks yang sama", () => {
    for (let i = 0; i < 200; i++) {
      const n = randomOtherIndex(0, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
      expect(n).not.toBe(0);
    }
  });
});

describe("musik: relevansi hasil archive", () => {
  const track = (o: Partial<MusicTrack> = {}): MusicTrack => ({
    id: "x",
    title: "",
    artist: "",
    album: "",
    cover: "",
    audioUrl: "https://example.test/a.mp3",
    durationSec: 0,
    source: "archive",
    kind: "penuh",
    ...o,
  });

  test("menyimpan track yang judul/penyanyi/albumnya memuat kata kueri", () => {
    const kept = relevant(
      [
        track({ title: "Jujutsu Kaisen Opening" }),
        track({ title: "Lagu", artist: "Kaisen Band" }),
        track({ title: "Ambient", album: "Kaisen Sessions" }),
      ],
      "jujutsu kaisen",
    );
    expect(kept).toHaveLength(3);
  });

  test("membuang track yang cuma cocok karena OR longgar", () => {
    const kept = relevant(
      [
        track({ title: "Winter Bell", artist: "Unknown" }),
        track({ title: "Sunrise", album: "Morning Set" }),
      ],
      "deezer indonesian",
    );
    expect(kept).toHaveLength(0);
  });

  test("kueri dengan kata terlalu pendek tidak menyaring apa pun", () => {
    const list = [track({ title: "Anything" })];
    // "zz" diabaikan karena hanya 2 huruf, jadi tidak ada kata pembanding.
    expect(relevant(list, "zz")).toHaveLength(1);
  });

  test("pencocokan mengabaikan huruf besar-kecil dan tanda baca", () => {
    const kept = relevant(
      [track({ title: "Lo-Fi Beats 2024" })],
      "lo-fi beats",
    );
    expect(kept).toHaveLength(1);
  });
});

describe("musik: kode rahasia", () => {
  test("kode yang benar membuka pemutar musik", () => {
    expect(MUSIC_SECRET_CODE).toBe("110219941");
    expect(isMusicSecret("110219941")).toBe(true);
    // Spasi nyasar tidak boleh membatalkan kode.
    expect(isMusicSecret("  110219941 ")).toBe(true);
  });

  test("kode lain tidak membuka pemutar musik", () => {
    expect(isMusicSecret("")).toBe(false);
    expect(isMusicSecret("11021994")).toBe(false);
    expect(isMusicSecret("1102199411")).toBe(false);
    expect(isMusicSecret("jujutsu kaisen")).toBe(false);
  });
});