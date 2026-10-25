import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Crown, Lock, Check, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#64748b", "#1f2937", "#f472b6",
];

const BORDERS = [
  { key: "none", label: "Tanpa" },
  { key: "gold", label: "Gold", ring: "ring-2 ring-amber-400" },
  { key: "neon", label: "Neon", ring: "ring-2 ring-cyan-400" },
  { key: "rose", label: "Rose", ring: "ring-2 ring-rose-400" },
  { key: "galaxy", label: "Galaxy", ring: "ring-2 ring-violet-500" },
];

/** Preview bubble — berubah mengikuti warna / background / frame yang dipilih. */
function BubblePreview({
  color,
  bg,
  border,
}: {
  color: string;
  bg?: string;
  border: string;
}) {
  const borderCls = BORDERS.find((b) => b.key === border)?.ring ?? "";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
        Preview
      </p>
      <div className="flex items-end gap-2">
        <div className="max-w-[75%]">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm font-medium text-white shadow-lg",
              borderCls,
            )}
            style={{
              backgroundColor: bg ? undefined : color,
              backgroundImage: bg ? `url(${bg})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <span className="relative z-10">Hai! Pesan bubble kamu ✨</span>
          </div>
          <p className="mt-1 text-[10px] text-white/40">kamu</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <div className="max-w-[75%]">
          <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm text-white/80">
            Balasan teman
          </div>
        </div>
      </div>
    </div>
  );
}

export function BubbleChatScreen() {
  const { user } = useAuth();
  const saveBubble = useMutation(api.account.saveBubble);
  const isPremium = (user?.premiumUntil ?? 0) > Date.now();

  const [color, setColor] = useState<string>(user?.bubbleColor ?? "#3b82f6");
  const [bg, setBg] = useState<string | undefined>(user?.bubbleBg);
  const [border, setBorder] = useState<string>(user?.bubbleBorder ?? "none");
  const [busy, setBusy] = useState(false);

  // NON-PREMIUM: layar khusus yang bagus, bukan cuma teks.
  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-transparent px-6 py-14 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-amber-400/15 ring-1 ring-amber-400/30">
          <Lock className="size-7 text-amber-300" />
        </span>
        <p className="mt-5 text-lg font-extrabold text-white">
          Bubble Chat hanya untuk premium user
        </p>
        <p className="mt-2 max-w-xs text-sm text-white/55">
          Personalisasi warna, background, dan frame bubble chat kamu — khusus
          yang punya premium.
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 ring-1 ring-amber-400/30">
          <Crown className="size-4 text-amber-300" />
          <span className="text-xs font-bold text-amber-200">
            Ambil premium untuk buka fitur ini
          </span>
        </div>
        {/* Preview redup di balik pesan premium. */}
        <div className="mt-6 w-full max-w-sm opacity-40 blur-[2px]">
          <BubblePreview color="#8b5cf6" border="gold" />
        </div>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await saveBubble({
        bubbleColor: color,
        bubbleBg: bg,
        bubbleBorder: border,
      });
      toast.success("Bubble chat tersimpan ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <BubblePreview color={color} bg={bg} border={border} />

      {/* Warna bubble. */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <p className="mb-3 text-sm font-extrabold">Warna Bubble</p>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setBg(undefined); }}
              aria-label={`Pilih warna ${c}`}
              className={cn(
                "size-9 rounded-full transition",
                color === c && !bg
                  ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                  : "ring-1 ring-white/20",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Background PNG (URL). */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <p className="mb-1 text-sm font-extrabold">Background (PNG)</p>
        <p className="mb-3 text-[11px] text-white/45">
          Tempel link gambar PNG — preview langsung berubah. GIF tidak didukung.
        </p>
        <input
          value={bg ?? ""}
          onChange={(e) => setBg(e.target.value || undefined)}
          placeholder="https://…/bubble.png"
          className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-xs outline-none placeholder:text-zinc-600 focus:border-white/30"
        />
        {bg && (
          <button
            onClick={() => setBg(undefined)}
            className="mt-2 text-[11px] font-bold text-rose-300"
          >
            Hapus background
          </button>
        )}
      </div>

      {/* Frame / border. */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <p className="mb-3 text-sm font-extrabold">Frame / Border</p>
        <div className="flex flex-wrap gap-2">
          {BORDERS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBorder(b.key)}
              className={cn(
                "relative rounded-xl px-3.5 py-2 text-xs font-bold transition",
                border === b.key
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20",
              )}
            >
              {b.key !== "none" && (
                <span className={cn("mr-1.5 inline-block size-2.5 rounded-full", b.ring)} />
              )}
              {b.label}
              {border === b.key && <Check className="ml-1.5 inline size-3" />}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => void save()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 text-sm font-extrabold text-black transition active:scale-[0.98] disabled:opacity-60"
      >
        <MessageCircle className="size-4" />
        {busy ? "Menyimpan…" : "Simpan Bubble"}
      </button>
    </div>
  );
}
