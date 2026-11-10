import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Check, Gem, Plus, Sticker, X } from "lucide-react";

type Category = "pack" | "anime" | "random";

type Pack = {
  key: string;
  title: string;
  category: Category;
  price: number;
  stickers: string[];
  owned: boolean;
  mine: boolean;
  custom: boolean;
};

const CATS: { key: Category; label: string }[] = [
  { key: "pack", label: "Sticker Pack" },
  { key: "anime", label: "Anime" },
  { key: "random", label: "Random" },
];

const CAT_LABEL: Record<Category, string> = {
  pack: "Sticker Pack",
  anime: "Anime",
  random: "Random",
};

function rupiah(n: number) {
  return n.toLocaleString("id-ID");
}

/**
 * TOKO STICKER — dipakai di tab "Sticker" Chat Global.
 *
 * Kategori: Sticker Pack · Anime · Random. Pack tampil 2 per baris dengan
 * preview 6 sticker (3+3) di atas kotak hitam berisi judul, harga, dan tombol
 * beli. Anime/Random tampil 5 sticker per baris dengan judul + total harga.
 * Setelah dibeli, kotak miring "DIBELI" menutup preview. Developer bisa
 * mengunggah pack baru (tanpa glow/outline).
 */
export function StickerStore() {
  // Toko tetap dimuat walau belum login (saldo 0) supaya daftarnya kelihatan
  // dan tombol beli memberi alasan yang jelas.
  const shop = useQuery(api.stickers.shop, {}) as
    | {
        sacret: number;
        unlimited: boolean;
        canUpload: boolean;
        packs: Pack[];
        ownedStickers: string[];
      }
    | undefined;
  const buy = useMutation(api.stickers.buy);
  const buySticker = useMutation(api.stickers.buySticker);
  const createPack = useMutation(api.stickers.createPack);

  const [cat, setCat] = useState<Category>("pack");
  const [preview, setPreview] = useState<Pack | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Form upload developer.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uTitle, setUTitle] = useState("");
  const [uCat, setUCat] = useState<Category>("anime");
  const [uPrice, setUPrice] = useState("1200");
  const [uStickers, setUStickers] = useState("");
  const [uBusy, setUBusy] = useState(false);

  const packs = useMemo(
    () => (shop?.packs ?? []).filter((p) => p.category === cat),
    [shop?.packs, cat],
  );

  // Sticker INDIVIDU yang sudah dibeli (untuk status "sudah punya").
  const ownedStickers = useMemo(
    () => new Set(shop?.ownedStickers ?? []),
    [shop?.ownedStickers],
  );

  // Kategori anime/random dijual SATUAN (bukan pack): semua sticker dari
  // seluruh pack di kategori ini diflatten jadi item per sticker, nanti
  // ditampilkan 5 per baris.
  const individual = useMemo(() => {
    if (cat === "pack") return [];
    return packs.flatMap((p) =>
      p.stickers.map((s) => ({
        id: `${p.key}:${s}`,
        sticker: s,
        packKey: p.key,
        packTitle: p.title,
        price: Math.max(
          100,
          Math.round(p.price / Math.max(1, p.stickers.length)),
        ),
        owned: ownedStickers.has(s),
      })),
    );
  }, [packs, cat, ownedStickers]);

  const doBuy = async (p: Pack) => {
    setErr(null);
    setOkMsg(null);
    setBusyKey(p.key);
    try {
      const res = (await buy({ packKey: p.key })) as { count?: number };
      setOkMsg(
        `${p.title} dibeli — ${res?.count ?? p.stickers.length} sticker masuk ke sheet chat`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membeli sticker");
    } finally {
      setBusyKey(null);
    }
  };

  const doBuySticker = async (it: {
    id: string;
    sticker: string;
    packKey: string;
  }) => {
    setErr(null);
    setOkMsg(null);
    setBusyKey(it.id);
    try {
      await buySticker({ packKey: it.packKey, sticker: it.sticker });
      setOkMsg(`Sticker ${it.sticker} dibeli — masuk ke sheet chat`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membeli sticker");
    } finally {
      setBusyKey(null);
    }
  };

  const doUpload = async () => {
    setErr(null);
    setOkMsg(null);
    setUBusy(true);
    try {
      await createPack({
        title: uTitle,
        category: uCat,
        price: Number(uPrice) || 0,
        stickers: uStickers
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setOkMsg(`Pack "${uTitle.trim()}" berhasil diunggah`);
      setUTitle("");
      setUStickers("");
      setUploadOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal upload sticker");
    } finally {
      setUBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header bersih: tanpa kolom pencarian dan tanpa saldo di atas. */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-300/25 bg-[linear-gradient(145deg,rgba(167,139,250,.24),rgba(88,28,135,.28))] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
          <span aria-hidden className="absolute -right-3 -top-4 size-10 rounded-full bg-violet-300/20 blur-xl" />
          <Sticker className="relative size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black tracking-tight text-white">Toko Sticker</p>
          <p className="mt-0.5 text-[10px] leading-snug text-white/45">
            Pilih pack, bayar sekali, langsung dipakai di chat
          </p>
        </div>
        {shop?.canUpload && (
          <button
            type="button"
            onClick={() => setUploadOpen((v) => !v)}
            aria-label="Upload sticker"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/75 transition hover:text-white active:scale-95"
          >
            {uploadOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          </button>
        )}
      </div>

      <div className="px-4">
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cn(
                "flex-1 rounded-xl px-2 py-2 text-[11px] font-black transition active:scale-[0.98]",
                cat === c.key
                  ? "bg-white text-[#17131f] shadow-[0_6px_16px_-10px_rgba(0,0,0,.9)]"
                  : "text-white/45 hover:bg-white/[0.05] hover:text-white/80",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {(err || okMsg) && (
        <div className="px-4 pt-2">
          <p
            className={cn(
              "rounded-xl border px-3 py-2 text-[11px] font-semibold leading-snug",
              err
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
            )}
          >
            {err ?? okMsg}
          </p>
        </div>
      )}

      {/* FORM UPLOAD DEVELOPER — datar, tanpa glow/outline. */}
      {shop?.canUpload && uploadOpen && (
        <div className="mx-4 mt-2 rounded-2xl border border-white/12 bg-white/[0.03] p-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-white/60">
            Upload sticker (developer)
          </p>
          <input
            value={uTitle}
            onChange={(e) => setUTitle(e.target.value)}
            placeholder="Judul pack"
            className="mt-2 w-full rounded-xl border border-white/12 bg-black/35 px-2.5 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
          <div className="mt-2 flex gap-2">
            <select
              value={uCat}
              onChange={(e) => setUCat(e.target.value as Category)}
              className="min-w-0 flex-1 rounded-xl border border-white/12 bg-black/35 px-2 py-2 text-xs text-white outline-none"
            >
              {CATS.map((c) => (
                <option key={c.key} value={c.key} className="bg-neutral-900">
                  {c.label}
                </option>
              ))}
            </select>
            <input
              value={uPrice}
              onChange={(e) => setUPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Harga"
              className="w-24 rounded-xl border border-white/12 bg-black/35 px-2.5 py-2 text-xs text-white outline-none placeholder:text-white/35"
            />
          </div>
          <textarea
            value={uStickers}
            onChange={(e) => setUStickers(e.target.value)}
            rows={2}
            placeholder="Tempel emoji sticker, pisah spasi — 😀 😎 🥳"
            className="mt-2 w-full resize-none rounded-xl border border-white/12 bg-black/35 px-2.5 py-2 text-xs text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            disabled={uBusy}
            onClick={() => void doUpload()}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.08] py-2 text-xs font-black text-white transition hover:bg-white/[0.14] active:scale-[0.99] disabled:opacity-50"
          >
            {uBusy ? "Mengunggah…" : "Upload sticker"}
          </button>
        </div>
      )}

      {/* DAFTAR PACK. */}
      <div className="thin-scroll mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {!shop && (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03] p-1.5">
                <div className="skeleton aspect-[1.18/1] w-full rounded-[17px]" />
                <div className="skeleton mt-2.5 h-3 w-2/3 rounded-full" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="skeleton h-3 w-12 rounded-full" />
                  <div className="skeleton h-6 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {shop && packs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-5 py-12 text-center">
            <Sticker className="mx-auto size-6 text-white/25" />
            <p className="mt-2 text-[12px] font-bold text-white/55">Belum ada sticker di kategori ini</p>
            <p className="mt-1 text-[10px] text-white/30">Coba kategori lain atau kembali lagi nanti.</p>
          </div>
        )}

        {cat === "pack" ? (
          <div className="grid grid-cols-2 gap-3">
            {packs.map((p, index) => (
              <div
                key={p.key}
                className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] p-1.5 shadow-[0_18px_35px_-30px_rgba(0,0,0,.95)] transition hover:border-white/18"
              >
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className={cn(
                    "relative grid w-full grid-cols-3 gap-1 overflow-hidden rounded-[18px] p-2",
                    index % 2 === 0
                      ? "bg-[linear-gradient(145deg,rgba(139,92,246,.22),rgba(24,20,38,.55))]"
                      : "bg-[linear-gradient(145deg,rgba(251,191,36,.18),rgba(38,29,16,.58))]",
                  )}
                  aria-label={`Preview ${p.title}`}
                >
                  <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full bg-white/10 blur-2xl" />
                  {p.stickers.slice(0, 6).map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className="relative flex aspect-square items-center justify-center rounded-xl border border-white/[0.055] bg-black/15 text-[22px] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
                    >
                      {s}
                    </span>
                  ))}
                  <span className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-white/65 backdrop-blur">
                    {p.stickers.length} sticker
                  </span>
                </button>
                <div className="px-1.5 pb-1 pt-2">
                  <p className="truncate text-[12px] font-black text-white">
                    {p.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-200/90">
                      <Gem className="size-3" />
                      {rupiah(p.price)}
                    </span>
                    <button
                      type="button"
                      disabled={p.owned || busyKey === p.key}
                      onClick={() => void doBuy(p)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[9.5px] font-black transition active:scale-95",
                        p.owned
                          ? "bg-white/8 text-white/35"
                          : "bg-white text-black shadow-[0_6px_16px_-9px_rgba(0,0,0,.9)] hover:brightness-105",
                      )}
                    >
                      {p.owned
                        ? "Dibeli"
                        : busyKey === p.key
                          ? "…"
                          : "Beli"}
                    </button>
                  </div>
                </div>
                {p.owned && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <span className="-rotate-[14deg] rounded-lg border border-emerald-300/70 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                      Dibeli
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Anime & Random: sticker dijual SATUAN — 5 per baris, grid ke
              bawah. Tiap sel berisi emoji + harga/beli (atau tanda sudah
              punya). Tanpa kotak pack. */
          <div className="grid grid-cols-5 gap-2">
            {individual.map((it) => (
              <div
                key={it.id}
                className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] p-1.5 transition hover:border-white/25"
              >
                <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-black/35 text-2xl leading-none">
                  {it.sticker}
                </span>
                {it.owned ? (
                  <span className="mt-1.5 flex items-center gap-0.5 text-[9px] font-black text-emerald-300">
                    <Check className="size-3" aria-hidden />
                    Punya
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busyKey === it.id}
                    onClick={() => void doBuySticker(it)}
                    className="mt-1.5 w-full rounded-full bg-amber-400 px-1 py-0.5 text-[9px] font-black text-black transition hover:brightness-105 active:scale-95 disabled:opacity-50"
                    aria-label={`Beli sticker ${it.sticker}`}
                  >
                    {busyKey === it.id ? "…" : rupiah(it.price)}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POP-UP PREVIEW — semua sticker, 4 per baris. */}
      {preview && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-5"
          onClick={() => setPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="screen-enter w-full max-w-sm overflow-hidden rounded-3xl border border-white/12 bg-[#0c0f16]"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  Preview Sticker
                </p>
                <p className="truncate text-[10px] text-white/45">
                  {preview.title} · {preview.stickers.length} sticker
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Tutup preview"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/70 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="thin-scroll max-h-[55vh] overflow-y-auto p-2.5">
              <div className="grid grid-cols-4 gap-1.5">
                {preview.stickers.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="flex aspect-square items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-3xl leading-none"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
              <span className="flex flex-1 items-center gap-1 text-xs font-black text-amber-200">
                <Gem className="size-3.5" /> {rupiah(preview.price)}
              </span>
              <button
                type="button"
                disabled={preview.owned || busyKey === preview.key}
                onClick={() => void doBuy(preview)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-black transition",
                  preview.owned
                    ? "bg-white/10 text-white/45"
                    : "bg-amber-400 text-black hover:brightness-105 active:scale-95",
                )}
              >
                {preview.owned ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" /> Dibeli
                  </span>
                ) : (
                  "Beli"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
