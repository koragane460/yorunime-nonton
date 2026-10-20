// YoruNime — HALAMAN TITLE.
//
// Tiga grup title: NONTON (jumlah judul ditonton), MENIT (total menit),
// dan COLLECTION (dari hasil gacha). Title yang belum dimiliki tampil
// abu-abu/terkunci; yang sudah dimiliki bisa dipasang (equip) lewat
// tombol — sama juga bisa diatur di Pengaturan.
//
// Tampilan: kotak title memakai BENTUK BERAGAM (bulat klasik, daun,
// kubah, diagonal) + hiasan partikel berkelip & kilau menyapu; title
// aktif ditampilkan sebagai PITA medali di bagian atas.
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Award, ChevronLeft, Crown, Lock, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { TitleTag } from "@/components/Cosmetics";
import { cn } from "@/lib/utils";

type TitleDef = {
  id: string;
  group: "nonton" | "menit" | "collection";
  name: string;
  desc: string;
};

const GROUPS: { key: TitleDef["group"]; label: string; blurb: string }[] = [
  {
    key: "nonton",
    label: "Nonton",
    blurb: "Dari jumlah judul anime yang pernah kamu tonton",
  },
  {
    key: "menit",
    label: "Menit",
    blurb: "Dari total waktu menonton kamu",
  },
  {
    key: "collection",
    label: "Collection",
    blurb: "Dari hasil pull di Gacha",
  },
];

/** Bentuk kotak beragam — bergantian per urutan, bukan rounded seragam. */
const SHAPES = [
  "rounded-2xl",
  "rounded-[20px_6px_20px_6px]",
  "rounded-t-3xl rounded-b-lg",
  "rounded-lg rounded-tr-3xl rounded-bl-3xl",
];

/** Titik partikel berkelip (posisi % + durasi animasi). */
const SPARKS = [
  { x: "12%", y: "22%", d: 2.4, delay: 0 },
  { x: "38%", y: "74%", d: 3.1, delay: 0.5 },
  { x: "64%", y: "18%", d: 2.7, delay: 1.1 },
  { x: "84%", y: "62%", d: 3.4, delay: 0.3 },
  { x: "26%", y: "52%", d: 2.9, delay: 1.6 },
];

/** Kotak title berdekorasi: bentuk bervariasi, partikel + kilau, emas bila
 *  dimiliki, abu bila belum. */
function TitleBox({
  def,
  earnedAt,
  equipped,
  onEquip,
  onUnequip,
  index,
}: {
  def: TitleDef;
  earnedAt?: number;
  equipped: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  index: number;
}) {
  const owned = earnedAt !== undefined;
  const shape = SHAPES[(index + (def.group === "menit" ? 1 : def.group === "collection" ? 2 : 0)) % SHAPES.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.35 }}
      className={cn(
        "relative overflow-hidden border p-3 transition",
        shape,
        owned
          ? "border-gold/45 bg-gradient-to-br from-gold/12 via-card to-card shadow-[0_0_22px_-14px_rgba(251,191,36,.9)]"
          : "border-border bg-card/60",
        equipped && "ring-1 ring-gold/60",
      )}
    >
      {/* Ornamen sudut: wujud berbeda per kotak */}
      {owned && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -left-6 -top-6 size-16 rotate-45 rounded-2xl bg-gold/15"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-6 -right-6 size-16 rotate-45 rounded-2xl bg-gold/10"
          />
          {/* Belah ketupat kecil di sudut — hiasan tambahan */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-2.5 size-2 rotate-45 border border-gold/60 bg-gold/30"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2.5 left-2.5 size-1.5 rotate-45 border border-gold/50"
          />
          {/* Partikel berkelip */}
          <span aria-hidden className="pointer-events-none absolute inset-0">
            {SPARKS.map((s, i) => (
              <span
                key={i}
                className="absolute size-1 rounded-full bg-gold/80"
                style={{
                  left: s.x,
                  top: s.y,
                  animation: `yn-twinkle ${s.d}s ease-in-out ${s.delay}s infinite`,
                }}
              />
            ))}
          </span>
          {/* Kilau emas yang menyapu kotak */}
          <span
            aria-hidden
            className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-gold/20 to-transparent"
            style={{
              backgroundSize: "200% 100%",
              animation: "yn-sheen 3.6s ease-in-out infinite",
            }}
          />
        </>
      )}

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center",
            // Ikon juga bentuknya bervariasi mengikuti kotak
            index % 2 === 0 ? "rounded-xl" : "rounded-full rounded-bl-md",
            owned
              ? "bg-gradient-to-b from-gold to-amber-500 text-black shadow-[0_0_16px_-6px_rgba(212,175,55,.8)]"
              : "bg-white/[0.05] text-zinc-600",
          )}
        >
          {def.group === "collection" ? (
            <Crown className="size-5" aria-hidden />
          ) : (
            <Award className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "truncate text-sm font-black tracking-wide",
                owned ? "text-white" : "text-zinc-500",
              )}
            >
              {def.name}
            </p>
            {!owned && (
              <Lock className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
            )}
            {equipped && (
              <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                DIPAKAI
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-0.5 text-[11px]",
              owned ? "text-muted-foreground" : "text-zinc-600",
            )}
          >
            {def.desc}
          </p>
          {owned && earnedAt && (
            <p className="mt-0.5 text-[10px] font-semibold text-gold/70">
              Diperoleh{" "}
              {new Date(earnedAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        {owned && (
          <button
            onClick={equipped ? onUnequip : onEquip}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition active:scale-95",
              equipped
                ? "border border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                : "bg-gold text-black shadow-[0_0_14px_-6px_rgba(251,191,36,.9)]",
            )}
          >
            {equipped ? "Dipakai" : "Pakai"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function TitleScreen({ onBack }: { onBack: () => void }) {
  const state = useQuery(api.titles.myTitles, {});
  const checkAndAward = useMutation(api.titles.checkAndAward);
  const equip = useMutation(api.titles.equip);

  // Cek syarat title saat layar dibuka (idempoten — tidak menggandakan).
  useEffect(() => {
    checkAndAward({}).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defs = (state?.defs ?? []) as TitleDef[];
  const earnedAt = (state?.earnedAt ?? {}) as Record<string, number>;
  const equippedTitle = state?.equippedTitle ?? null;
  const equippedName = defs.find((d) => d.id === equippedTitle)?.name;

  const onEquip = async (id: string) => {
    try {
      await equip({ titleId: id });
      toast.success("Title dipasang ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memasang title");
    }
  };
  const onUnequip = async () => {
    try {
      await equip({ titleId: null });
    } catch {
      /* diamkan */
    }
  };

  const ownedCount = Object.keys(earnedAt).length;

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3">
        {/* ------------------------------ kepala ------------------------- */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-black tracking-tight">
            <Award className="size-5 text-gold" aria-hidden />
            Title
          </h1>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-black text-gold">
            {ownedCount}/{defs.length || "—"}
          </span>
        </div>
        {/* Garis pemisah di bawah judul */}
        <div className="mt-3 h-px w-full bg-gradient-to-r from-gold/60 via-border to-transparent" />

        {/* ---------- PITA TITLE AKTIF — bentuk pita, bukan teks ---------- */}
        {equippedName && (
          <div className="relative mt-4 flex items-center justify-center overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.10] via-card to-card py-4">
            <span
              aria-hidden
              className="absolute -right-8 -top-10 size-28 rotate-45 rounded-3xl bg-gold/10 blur-xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
            >
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  className="absolute size-1 rounded-full bg-gold/70"
                  style={{
                    left: s.x,
                    top: s.y,
                    animation: `yn-twinkle ${s.d}s ease-in-out ${s.delay}s infinite`,
                  }}
                />
              ))}
            </span>
            <div className="relative flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gold/80">
                Sedang dipakai
              </span>
              <TitleTag name={equippedName} size="lg" />
            </div>
          </div>
        )}

        {/* --------------------------- daftar grup ----------------------- */}
        {GROUPS.map((g) => {
          const list = defs.filter((d) => d.group === g.key);
          if (list.length === 0) return null;
          return (
            <section key={g.key} className="mt-5">
              <h2 className="flex items-center gap-1.5 text-base font-black tracking-tight">
                <Sparkles className="size-4 text-gold" aria-hidden />
                {g.label}
              </h2>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {g.blurb}
              </p>
              <div className="mt-2 space-y-2.5">
                {list.map((d, i) => (
                  <TitleBox
                    key={d.id}
                    def={d}
                    index={i}
                    earnedAt={earnedAt[d.id]}
                    equipped={equippedTitle === d.id}
                    onEquip={() => void onEquip(d.id)}
                    onUnequip={() => void onUnequip()}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {defs.length === 0 && (
          <p className="py-16 text-center text-sm font-bold text-muted-foreground">
            Memuat title…
          </p>
        )}
      </div>
    </>
  );
}

/** Rute /title — layar Title penuh. Versi yang sama juga di-embed di
 *  YoruVerse (lihat TitleScreen). */
export default function Title() {
  const navigate = useNavigate();
  return (
    <AppLayout hideAccountPanel>
      <TitleScreen onBack={() => navigate("/home")} />
    </AppLayout>
  );
}
