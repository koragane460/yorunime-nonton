// Tools konten developer: sinopsis manual + anime tambahan.
//
// Tersedia di panel staff pada halaman Akun, tapi HANYA untuk developer
// (tombolnya tidak dirender untuk moderator). Guardian sebenarnya ada di
// server (`requireDev` di convex/content.ts), jadi panel ini cuma pintasan.
//
// Anime tambahan TIDAK menyimpan daftar episode: yang disimpan hanya slug
// sumber. Saat judul dibuka, `api.sanka.detail` (atau AniList) mengambil
// episode real-time, sehingga yang tampil selalu episode yang benar-benar
// ada di sumber — bukan nomor karangan.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Trash2, Wrench } from "lucide-react";

const DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export function ContentTools() {
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

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
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
    <div className="mt-2.5 rounded-xl border border-border bg-background/60 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold">
        <Wrench className="size-3.5 text-primary" />
        Tools Konten
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
        Tulis sinopsis sendiri, atau tambah judul baru. Episode anime tambahan
        diambil real-time dari sumbernya, bukan dikarang.
      </p>

      {/* ---- sinopsis manual ---- */}
      <div className="mt-2.5 rounded-lg border border-border/70 bg-background/40 p-2">
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
      <div className="mt-2 rounded-lg border border-border/70 bg-background/40 p-2">
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
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
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