// Tools konten developer: sinopsis manual + anime tambahan.
//
// StaffPanel (halaman Akun) hanya merender satu tombol mengambang (FAB) untuk
// developer; isinya dibuka dari `ContentToolsFab`. Guardian sebenarnya ada di
// server (`requireDev` di convex/content.ts), jadi UI ini cuma pintasan.
//
// Anime tambahan TIDAK menyimpan daftar episode: yang disimpan hanya slug
// sumber. Saat judul dibuka, `api.sanka.detail` (atau AniList) mengambil
// episode real-time, sehingga yang tampil selalu episode yang benar-benar
// ada di sumber — bukan nomor karangan.
import { useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Crown, Plus, Trash2, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

/**
 * Satu tombol untuk tiga tools developer.
 *
 * Sebelumnya "Tambah Sinopsis", "Tambah Anime", dan "Premium Clan" berdiri
 * sendiri-sendiri di panel yang panjang. Sekarang semuanya dibuka dari satu
 * tombol mengambang (FAB) di kanan bawah: sekali ketuk, pilih toolsnya.
 */
export function ContentToolsFab({
  onOpenClan,
  extraTools = [],
}: {
  onOpenClan: () => void;
  /** Tools tambahan milik StaffPanel (premium user, pembayaran manual).
      Dikirim sebagai komponen dari pemanggil supaya tidak ada import
      bolak-balik antara StaffPanel dan file ini. */
  extraTools?: {
    key: string;
    label: string;
    hint: string;
    tone?: "amber";
    render: () => ReactNode;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<string | null>(null);

  const pick = (t: string) => {
    if (t === "clan") {
      setOpen(false);
      setTool(null);
      onOpenClan();
      return;
    }
    setTool(t);
  };

  return (
    <>
      {/* Tombol mengambang */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Tools developer"
        className={cn(
          "fixed bottom-24 right-4 z-[70] flex size-14 items-center justify-center rounded-full shadow-lg shadow-black/40 transition active:scale-95",
          open
            ? "bg-foreground text-background"
            : "bg-primary text-primary-foreground",
        )}
      >
        {open ? <X className="size-6" /> : <Wrench className="size-6" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[69] flex items-end justify-center bg-black/60 p-3 pb-24"
          onClick={() => {
            setOpen(false);
            setTool(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="thin-scroll max-h-[75vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-3"
          >
            <p className="mb-2 text-center text-sm font-bold">
              Tools Developer
            </p>
            {!tool ? (
              <div className="space-y-2">
                <FabMenu
                  label="Tambah Sinopsis"
                  hint="Tulis sendiri sinopsis anime atau donghua"
                  onClick={() => pick("synopsis")}
                />
                <FabMenu
                  label="Tambah Anime"
                  hint="Judul baru, episodenya real-time dari sumber"
                  onClick={() => pick("anime")}
                />
                <FabMenu
                  label="Kasih premium ke user"
                  hint="Durasi + nominal, untuk user biasa"
                  tone="amber"
                  onClick={() => pick("premium-user")}
                />
                <FabMenu
                  label="Pembayaran manual"
                  hint="Cek transfer masuk dari user"
                  tone="amber"
                  onClick={() => pick("bayar")}
                />
                <FabMenu
                  label="Beri Premium Clan"
                  hint="Kasih premium unlimited ke clan"
                  tone="amber"
                  onClick={() => pick("clan")}
                />
              </div>
            ) : (
              <>
                <button
                  onClick={() => setTool(null)}
                  className="mb-2 w-full rounded-lg border border-border py-1.5 text-[11px] font-bold text-muted-foreground"
                >
                  Kembali
                </button>
                {tool === "synopsis" || tool === "anime" ? (
                  <ContentTools mode={tool} />
                ) : (
                  (() => {
                    const found = extraTools.find((t) => t.key === tool);
                    return found ? <>{found.render()}</> : null;
                  })()
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FabMenu({
  label,
  hint,
  onClick,
  tone,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  tone?: "amber";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99]",
        tone === "amber"
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-border bg-secondary/30",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          tone === "amber" ? "bg-amber-500/20" : "bg-primary/15",
        )}
      >
        {tone === "amber" ? (
          <Crown className="size-4 text-amber-300" />
        ) : (
          <Plus className="size-4 text-primary" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function ContentTools({
  mode = "full",
}: {
  /** "full" = dua bagian; dipakai di sheet FAB. */
  mode?: "full" | "synopsis" | "anime";
}) {
  const overrides = useQuery(api.content.listOverrides, {});
  const custom = useQuery(api.content.listCustomAnime, {});
  const setSynopsis = useMutation(api.content.setSynopsis);
  const clearSynopsis = useMutation(api.content.clearSynopsis);
  const addAnime = useMutation(api.content.addCustomAnime);
  const delAnime = useMutation(api.content.deleteCustomAnime);

  const [kind, setKind] = useState<"anime" | "donghua">("anime");
  const [key, setKey] = useState("");
  const [synopsis, setSynopsisText] = useState("");
  const [saving, setSaving] = useState(false);
  // Pencarian judul -> MAL id, supaya developer tidak perlu membuka
  // MyAnimeList hanya untuk menyalin satu angka.
  const searchAnime = useAction(api.content.searchAnime);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<
    { malId: string; anilistId: string; title: string; image: string; status: string; episodes: number | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  // Catat hasil pencarian yang benar-benar sudah dicoba, supaya UI bisa
  // bilang "tidak ada hasil" alih-alih diam saja saat hasilnya kosong.
  const [searched, setSearched] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [search2, setSearch2] = useState("");
  const [hits2, setHits2] = useState<
    { malId: string; anilistId: string; title: string; image: string; status: string; episodes: number | null }[]
  >([]);
  const [searching2, setSearching2] = useState(false);
  const [searched2, setSearched2] = useState("");
  const [source, setSource] = useState<"sanka" | "anilist">("sanka");
  const [poster, setPoster] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [adding, setAdding] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
      return false;
    }
  };

  return (
    <div
      className={
        mode === "full"
          ? "mt-2.5 rounded-xl border border-border bg-background/60 p-2.5"
          : "rounded-xl border border-border bg-background/60 p-2.5"
      }
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold">
        <Wrench className="size-3.5 text-primary" />
        Tools Konten
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
        Tulis sinopsis sendiri, atau tambah judul baru. Episode anime tambahan
        diambil real-time dari sumbernya, bukan dikarang.
      </p>

      {/* ---- sinopsis manual ---- */}
      <div
        className={cn(
          "rounded-lg border border-border/70 bg-background/40 p-2",
          mode === "anime" ? "hidden" : "mt-2.5",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Sinopsis manual
        </p>
        <div className="mt-1.5 flex gap-1.5">
          {(["anime", "donghua"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize ${
                kind === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={kind === "anime" ? "MAL id (mis. 5114)" : "Slug donghua (mis. perfect-world)"}
          className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        {kind === "anime" && (
          <div className="mt-1.5">
            <div className="flex gap-1.5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul untuk dapat MAL id…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
              />
              <button
                disabled={searching || search.trim().length < 2}
                onClick={async () => {
                  setSearching(true);
                  try {
                    const r = ((await searchAnime({ q: search.trim() })) ??
                      []) as any[];
                    setHits(r);
                    setSearched(search.trim());
                    if (r.length === 0)
                      toast.error(
                        `Tidak ada hasil untuk "${search.trim()}". Coba judul Inggris/Jepang.`,
                      );
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal mencari");
                  } finally {
                    setSearching(false);
                  }
                }}
                className="h-8 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-bold disabled:opacity-40"
              >
                {searching ? "..." : "Cari"}
              </button>
            </div>
            {hits.length === 0 && searched !== "" && (
              <p className="mt-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
                Tidak ada hasil untuk &quot;{searched}&quot;. AniList &amp; MyAnimeList
                hanya mengenal judul resminya — coba judul Inggris atau Jepang
                (mis. &quot;Kusuriya no Hitorigoto&quot;).
              </p>
            )}
            {hits.length > 0 && (
              <div className="mt-1.5 max-h-52 space-y-1 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={h.anilistId}
                    onClick={() => {
                      setKey(h.malId || h.anilistId);
                      setSearch(h.title);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-left"
                  >
                    {h.image ? (
                      <img
                        src={h.image}
                        alt=""
                        className="h-9 w-6 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold">
                        {h.title}
                      </span>
                      <span className="block text-[9px] text-muted-foreground">
                        {h.status === "RELEASING" ? "Ongoing" : h.status} ·{" "}
                        {h.episodes ? `${h.episodes} ep` : "?"} · MAL{" "}
                        {h.malId || "?"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <textarea
          value={synopsis}
          onChange={(e) => setSynopsisText(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Tulis sinopsis di sini…"
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        <div className="mt-1.5 flex gap-1.5">
          <button
            disabled={saving || !key.trim() || synopsis.trim().length < 10}
            onClick={async () => {
              setSaving(true);
              const ok = await run(
                () => setSynopsis({ key: key.trim(), kind, synopsis }),
                "Sinopsis disimpan",
              );
              setSaving(false);
              if (ok) {
                setKey("");
                setSynopsisText("");
              }
            }}
            className="h-8 flex-1 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground disabled:opacity-40"
          >
            Simpan Sinopsis
          </button>
        </div>
        {(overrides ?? []).length > 0 && (
          <div className="mt-2 space-y-1">
            {(overrides ?? []).slice(0, 6).map((o: any) => (
              <div
                key={o._id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[10px]">
                  <span className="capitalize opacity-60">{o.kind}:</span>{" "}
                  {o.key}
                </span>
                <button
                  onClick={() =>
                    void run(
                      () => clearSynopsis({ key: o.key, kind: o.kind }),
                      "Sinopsis dihapus",
                    )
                  }
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Hapus sinopsis"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- anime tambahan ---- */}
      <div
        className={cn(
          "rounded-lg border border-border/70 bg-background/40 p-2",
          mode === "synopsis" ? "hidden" : "mt-2",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Tambah anime
        </p>
        <div className="mt-1.5 flex gap-1.5">
          {(["sanka", "anilist"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize ${
                source === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul"
          className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        <div className="mt-1.5 flex gap-1.5">
          <input
            value={search2}
            onChange={(e) => setSearch2(e.target.value)}
            placeholder="Cari judul (bisa isi slug otomatis)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
          />
          <button
            disabled={searching2 || search2.trim().length < 2}
            onClick={async () => {
              setSearching2(true);
              try {
                const r = ((await searchAnime({ q: search2.trim() })) ??
                  []) as any[];
                setHits2(r);
                setSearched2(search2.trim());
                if (r.length === 0)
                  toast.error(
                    `Tidak ada hasil untuk "${search2.trim()}". Coba judul Inggris/Jepang.`,
                  );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal mencari");
              } finally {
                setSearching2(false);
              }
            }}
            className="h-8 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-bold disabled:opacity-40"
          >
            {searching2 ? "..." : "Cari"}
          </button>
        </div>
        {hits2.length === 0 && searched2 !== "" && (
          <p className="mt-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
            Tidak ada hasil untuk &quot;{searched2}&quot;. Coba judul Inggris atau
            Jepang.
          </p>
        )}
        {hits2.length > 0 && (
          <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
            {hits2.map((h) => (
              <button
                key={h.anilistId}
                onClick={() => {
                  setTitle(h.title);
                  setPoster(h.image || "");
                  // Pencarian ini dari AniList, jadi HANYA sumber AniList yang
                  // bisa terisi otomatis (pakai MAL id). Untuk sumber Sanka
                  // slug-nya berbeda format (contoh: perfect-world) dan tidak
                  // bisa ditebak dari hasil pencarian — developer tetap isi
                  // sendiri, daripada slug angka yang pasti salah.
                  if (!slugTouched && source === "anilist") {
                    setSlug(h.malId || h.anilistId);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-left"
              >
                {h.image ? (
                  <img src={h.image} alt="" className="h-9 w-6 shrink-0 rounded object-cover" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold">
                    {h.title}
                  </span>
                  <span className="block text-[9px] text-muted-foreground">
                    {h.status === "RELEASING" ? "Ongoing" : h.status} ·{" "}
                    {h.episodes ? `${h.episodes} ep` : "?"} · MAL {h.malId || "?"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder={
            source === "sanka"
              ? "Slug sumber (mis. perfect-world)"
              : "MAL id / id AniList"
          }
          className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        <input
          value={poster}
          onChange={(e) => setPoster(e.target.value)}
          placeholder="URL poster (opsional)"
          className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        <textarea
          value={newSynopsis}
          onChange={(e) => setNewSynopsis(e.target.value.slice(0, 2000))}
          rows={2}
          placeholder="Sinopsis…"
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] outline-none focus:border-foreground/50"
        />
        <div className="mt-1.5 flex gap-1.5">
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] outline-none focus:border-foreground/50"
          >
            <option value="">Tanpa jadwal</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="19:30"
            className="w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] outline-none focus:border-foreground/50"
          />
        </div>
        <button
          disabled={
            adding ||
            !title.trim() ||
            !slug.trim() ||
            newSynopsis.trim().length < 10
          }
          onClick={async () => {
            setAdding(true);
            const ok = await run(
              () =>
                addAnime({
                  title: title.trim(),
                  slug: slug.trim(),
                  source,
                  synopsis: newSynopsis.trim(),
                  poster: poster.trim() || undefined,
                  airingDay: day || undefined,
                  airingTime: time.trim() || undefined,
                }),
              "Anime ditambahkan — episodenya diambil real-time dari sumber",
            );
            setAdding(false);
            if (ok) {
              setTitle("");
              setSlug("");
              setPoster("");
              setNewSynopsis("");
              setDay("");
              setTime("");
            }
          }}
          className="mt-1.5 h-8 w-full rounded-lg bg-primary text-[11px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {adding ? "Menyimpan…" : "Tambah Anime"}
        </button>
        {(custom ?? []).length > 0 && (
          <div className="mt-2 space-y-1">
            {(custom ?? []).slice(0, 8).map((c: any) => (
              <div
                key={c._id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[10px]">
                  {c.title}
                  {c.airingDay ? ` • ${c.airingDay}${c.airingTime ? ` ${c.airingTime}` : ""}` : ""}
                </span>
                <button
                  onClick={() =>
                    void run(
                      () => delAnime({ id: c._id as Id<"customAnime"> }),
                      "Anime dihapus",
                    )
                  }
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Hapus anime"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}