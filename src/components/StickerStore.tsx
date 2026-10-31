import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Check, Gem, Plus, Search, Sticker, X } from "lucide-react";

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
      }
    | undefined;
  const buy = useMutation(api.stickers.buy);
  const createPack = useMutation(api.stickers.createPack);

  const [cat, setCat] = useState<Category>("pack");
  const [q, setQ] = useState("");
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

  const packs = useMemo(() => {
    const list = shop?.packs ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter(
      (p) =>
        p.category === cat &&
        (!needle || p.title.toLowerCase().includes(needle)),
    );
  }, [shop?.packs, cat, q]);

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
      {/* Header: judul + TOTAL SACRET di kanan atas. */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <Sticker className="size-4 shrink-0 text-violet-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Toko Sticker</p>
          <p className="text-[10px] text-white/45">
            Beli pack, langsung masuk sheet chat
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-200">
          <Gem className="size-3.5" />
          {shop?.unlimited ? "∞" : rupiah(shop?.sacret ?? 0)}
        </span>
        {shop?.canUpload && (
          <button
            type="button"
            onClick={() => setUploadOpen((v) => !v)}
            aria-label="Upload sticker"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/75 transition hover:text-white"
          >
            {uploadOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          </button>
        )}
      </div>

      {/* Pencarian + kategori. */}
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2">
          <Search className="size-4 shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari sticker…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cn(
                "flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition",
                cat === c.key
                  ? "border-white/35 bg-white/[0.12] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80",
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
      <div className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {!shop && (
          <p className="py-10 text-center text-xs text-white/40">
            Memuat toko sticker…
          </p>
        )}
        {shop && packs.length === 0 && (
          <p className="py-10 text-center text-xs text-white/40">
            Belum ada sticker di kategori ini.
          </p>
        )}

        {cat === "pack" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {packs.map((p) => (
              <div
                key={p.key}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="grid w-full grid-cols-3 gap-0.5 bg-black/45 p-1.5"
                  aria-label={`Preview ${p.title}`}
                >
                  {p.stickers.slice(0, 6).map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className="flex aspect-square items-center justify-center rounded-lg bg-white/[0.04] text-xl leading-none"
                    >
                      {s}
                    </span>
                  ))}
                </button>
                {/* Kotak hitam: judul + harga + tombol beli. */}
                <div className="bg-black px-2 py-2">
                  <p className="truncate text-[11px] font-black text-white">
                    {p.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-200">
                      <Gem className="size-3" />
                      {rupiah(p.price)}
                    </span>
                    <button
                      type="button"
                      disabled={p.owned || busyKey === p.key}
                      onClick={() => void doBuy(p)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-black transition",
                        p.owned
                          ? "bg-white/10 text-white/40"
                          : "bg-amber-400 text-black hover:brightness-105 active:scale-95",
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
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="-rotate-[18deg] rounded-md border-2 border-emerald-300/80 px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-emerald-200">
                      DIBELI
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {packs.map((p) => (
              <div
                key={p.key}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="grid w-full grid-cols-5 gap-1 p-2"
                  aria-label={`Preview ${p.title}`}
                >
                  {p.stickers.map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className="flex aspect-square items-center justify-center rounded-lg bg-black/35 text-xl leading-none"
                    >
                      {s}
                    </span>
                  ))}
                </button>
                <div className="flex items-center gap-2 border-t border-white/10 bg-black px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-black text-white">
                      {p.title}
                    </p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                      {CAT_LABEL[p.category]} · {p.stickers.length} sticker
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-black text-amber-200">
                    <Gem className="size-3" />
                    {rupiah(p.price)}
                  </span>
                  <button
                    type="button"
                    disabled={p.owned || busyKey === p.key}
                    onClick={() => void doBuy(p)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black transition",
                      p.owned
                        ? "bg-white/10 text-white/40"
                        : "bg-amber-400 text-black hover:brightness-105 active:scale-95",
                    )}
                  >
                    {p.owned ? "Dibeli" : busyKey === p.key ? "…" : "Beli"}
                  </button>
                </div>
                {p.owned && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="-rotate-[18deg] rounded-md border-2 border-emerald-300/80 bg-black/20 px-3 py-1 text-sm font-black uppercase tracking-widest text-emerald-200">
                      DIBELI
                    </span>
                  </span>
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
