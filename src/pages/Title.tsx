// YoruNime — HALAMAN TITLE.
//
// Tiga grup title: NONTON (jumlah judul ditonton), MENIT (total menit),
// dan COLLECTION (dari hasil gacha). Title yang belum dimiliki tampil
// abu-abu/terkunci; yang sudah dimiliki bisa dipasang (equip) lewat
// tombol — sama juga bisa diatur di Pengaturan.
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Award, ChevronLeft, Crown, Lock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
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

/** Kotak title berdekorasi: gradasi emas bila dimiliki, abu bila belum. */
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.35 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3 transition",
        owned
          ? "border-gold/45 bg-gradient-to-br from-gold/12 via-card to-card"
          : "border-border bg-card/60",
      )}
    >
      {/* Sudut berdekorasi (orname emas kecil) untuk title yang dimiliki */}
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
        </>
      )}
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
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
                : "bg-gold text-black",
            )}
          >
            {equipped ? "Dipakai" : "Pakai"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Title() {
  const navigate = useNavigate();
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
    <AppLayout hideAccountPanel>
      <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3">
        {/* ------------------------------ kepala ------------------------- */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/home")}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-extrabold tracking-tight">
            <Award className="size-5 text-gold" aria-hidden />
            Title
          </h1>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-black text-gold">
            {ownedCount}/{defs.length || "—"}
          </span>
        </div>
        {/* Garis pemisah di bawah judul */}
        <div className="mt-3 h-px w-full bg-gradient-to-r from-gold/60 via-border to-transparent" />

        {/* --------------------------- daftar grup ----------------------- */}
        {GROUPS.map((g) => {
          const list = defs.filter((d) => d.group === g.key);
          if (list.length === 0) return null;
          return (
            <section key={g.key} className="mt-5">
              <h2 className="text-base font-bold tracking-tight">{g.label}</h2>
              <p className="text-[11px] text-muted-foreground">{g.blurb}</p>
              <div className="mt-2 space-y-2">
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
          <p className="py-16 text-center text-sm text-muted-foreground">
            Memuat title…
          </p>
        )}
      </div>
    </AppLayout>
  );
}
