import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import {
  Check,
  ChevronLeft,
  Crown,
  Gem,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Plan = { id: string; label: string; days: number; price: number; sacret?: number };
type Order = {
  orderId: string;
  priceIdr: number;
  days: number;
  planLabel: string;
};
type Verdict = { verdict: string; note: string; emailed: boolean };
type History = {
  _id: string;
  orderId: string;
  planLabel: string;
  priceIdr: number;
  status: string;
  createdAt: number;
};

const PERKS = [
  "Unlock manga dan manhwa untuk dibaca",
  "Kualitas 1080p lebih jernih dan enak di mata",
  "Memuat episode anime jauh lebih cepat dan tidak memakan waktu lama",
  "Memuat gambar manga dan manhwa jauh lebih cepat tanpa harus menunggu lama",
  "Dapatkan centang biru di samping namamu",
  "XP nonton 2× lebih banyak dibandingkan non-premium",
  "Bonus Sacret setiap kali membeli paket",
  "Bisa kasih premium ke orang lain dan kumpulkan XP",
];

const HOW_IT_WORKS = [
  "Buka paket, tekan Beli premium.",
  "Scan QRIS yang muncul, transfer sesuai nominal.",
  "Screenshot bukti transfer, lalu unggah di kolom bukti.",
  "Isi keterangan transfer, tekan Kirim Transfer, lalu tunggu dicek.",
];

/** Bukti transfer harus tajam. Skor di bawah ini berarti foto buram. */
const BLUR_LIMIT = 45;

const STATUS_LABEL: Record<string, string> = {
  paid: "lunas",
  manual_pending: "menunggu pembayaran",
  manual_review: "sedang dianalisis developer",
  rejected: "bukti ditolak",
};

/** Perkecil gambar supaya ringan diunggah dan mudah dibaca AI. */
async function shrink(file: File, maxSide = 1400): Promise<Blob> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
    el.src = raw;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return await (await fetch(raw)).blob();
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/jpeg", 0.85),
  );
  return blob ?? (await fetch(raw)).blob();
}

/**
 * Ukur ketajaman foto lewat variance of Laplacian. Variance kecil berarti
 * semua tepi rata, artinya foto blur dan tidak bisa jadi bukti.
 */
function sharpness(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = 160;
      const h = Math.max(1, Math.round((img.height / img.width) * w));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(0);
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const lap: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const at = (xx: number, yy: number) => {
            const i = (yy * w + xx) * 4;
            return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          };
          lap.push(
            4 * at(x, y) -
              at(x - 1, y) -
              at(x + 1, y) -
              at(x, y - 1) -
              at(x, y + 1),
          );
        }
      }
      const mean = lap.reduce((a, b) => a + b, 0) / (lap.length || 1);
      const variance =
        lap.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (lap.length || 1);
      resolve(variance);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    img.src = url;
  });
}

/** Sidik jari isi file supaya bukti yang sama tidak bisa dipakai dua kali. */
function hashBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) h = ((h << 5) + h + bytes[i]) >>> 0;
  return `${h.toString(16)}-${bytes.length.toString(16)}`;
}

export default function Premium() {
  // Layar bayar tampil penuh: navbar atas-bawah ikut disembunyikan supaya
  // isi layar memenuhi layar HP tanpa ada yang menutupi.
  useHideNavOnMount();
  const navigate = useNavigate();
  return (
    <AppLayout hideAccountPanel>
      {/* Tombol balik — selalu terlihat di kiri atas */}
      <button
        onClick={() => {
          let target = "";
          if (!target || target.startsWith("/premium")) target = "/home";
          navigate(target);
        }}
        className="fixed left-3 top-3 z-50 flex size-10 items-center justify-center rounded-full bg-black/60 backdrop-blur"
        aria-label="Kembali"
      >
        <ChevronLeft className="size-5 text-white" />
      </button>
      <div className="py-3">
        <Hero />
        <HowTo />
        <Plans />
        <Perks />
        <HistoryList />
      </div>
    </AppLayout>
  );
}

function Hero() {
  return (
    <header className="pop-enter flex flex-col items-center border-b border-white/10 pb-5 pt-2 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 shadow-[0_0_24px_-4px] shadow-gold/50">
        <Crown className="size-7 text-gold" />
      </span>
      <p className="mt-2.5 font-mono text-[11px] tracking-[0.28em] text-zinc-400">
        YORUNIME
      </p>
      <h1 className="mt-0.5 text-3xl font-extrabold leading-tight">
        Premium<span className="text-gold">.</span>
      </h1>
      <p className="mt-2 max-w-[22rem] text-[13px] leading-6 text-zinc-400">
        Nonton tanpa iklan, kualitas 1080p, loading sat set, dan centang biru
        di samping namamu.
      </p>
    </header>
  );
}

function HowTo() {
  return (
    <section className="mt-6">
      <h2 className="text-[13px] font-bold text-gold">Cara beli</h2>
      <div className="yn-card mt-2 divide-y divide-white/8 px-4">
        {HOW_IT_WORKS.map((step, i) => (
          <div key={step} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-mono text-[10px] font-bold text-gold">
              {i + 1}
            </span>
            <span className="text-[13px] leading-6 text-zinc-300">{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Plans() {
  const plans = useQuery(api.payments.premiumPlans, {}) as Plan[] | undefined;
  const config = useQuery(api.payments.manualConfig, {});
  const qrUrl = useQuery(
    api.storage.getUrl,
    config?.qrStorageId ? { storageId: config.qrStorageId } : "skip",
  );

  const createOrder = useMutation(api.payments.createManualOrder);
  const attachProof = useMutation(api.payments.attachProof);
  const cancelOrder = useMutation(api.payments.cancelMyOrder);
  const analyze = useAction(api.payments.analyzeProof);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);

  const [order, setOrder] = useState<Order | null>(null);
  const [proof, setProof] = useState<{ storageId: string; hash: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"order" | "proof" | "send" | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // Toast bawah sudah dihapus permanen, jadi galat pembayaran tampil inline.
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Penunjuk geser kartu paket.
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activePlan, setActivePlan] = useState(0);
  const planCount = plans?.length ?? 0;
  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / (el.scrollWidth / Math.max(1, planCount)));
    setActivePlan(Math.min(planCount - 1, Math.max(0, idx)));
  };

  const ready = config?.ready === true;
  const image = config?.qrUrl || qrUrl || "";

  const startOrder = async (plan: Plan) => {
    if (!ready) {
      setErr("QRIS belum siap, coba lagi nanti");
      return;
    }
    setErr("");
    setBusy("order");
    setVerdict(null);
    setProof(null);
    setPreview(null);
    setNote("");
    try {
      setOrder(await createOrder({ planId: plan.id }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat pesanan");
    }
    setBusy(null);
  };

  const pickProof = async (file: File) => {
    setErr("");
    setBusy("proof");
    try {
      const blob = await shrink(file);
      const score = await sharpness(blob);
      if (score < BLUR_LIMIT) {
        throw new Error("Foto bukti buram. Ambil ulang screenshot yang lebih tajam.");
      }
      const buf = await blob.arrayBuffer();
      const uploadUrl = await getUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!res.ok) throw new Error("Unggah bukti gagal");
      const { storageId } = (await res.json()) as { storageId: string };
      setProof({ storageId, hash: hashBytes(buf) });
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setProof(null);
      setPreview(null);
      setErr(e instanceof Error ? e.message : "Gagal memproses bukti");
    }
    setBusy(null);
  };

  const send = async () => {
    if (!order || !proof || !note.trim()) return;
    setErr("");
    setBusy("send");
    try {
      await attachProof({
        orderId: order.orderId,
        proofStorageId: proof.storageId,
        proofHash: proof.hash,
        proofText: note.trim(),
      });
      const r = (await analyze({ orderId: order.orderId })) as Verdict;
      setVerdict(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengirim bukti");
    }
    setBusy(null);
  };

  // Tombol "Batal" di layar bayar: hapus order, lalu tutup layar. Order yang
  // dihapus tidak muncul di riwayat pembayaran — tidak ada status menggantung
  // untuk paket yang tidak jadi dibeli.
  const batal = () => {
    if (order) void cancelOrder({ orderId: order.orderId }).catch(() => {});
    setOrder(null);
    setVerdict(null);
    setErr("");
  };

  return (
    <section className="mt-6">
      <h2 className="text-[13px] font-bold text-gold">Paket</h2>
      {/* Kartu lurus ke atas, digeser ke kanan-kiri: paling murah di kiri,
          paling mahal di kanan (permintaan user). */}
      <div ref={carouselRef} onScroll={onCarouselScroll} className="thin-scroll -mx-3 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1">
        {[...(plans ?? [])]
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
          .map((p, i) => (
          <div
            key={p.id}
            className="yn-card yn-card-hover relative w-full shrink-0 snap-start overflow-hidden p-4"
          >
            {/* Mahkota di tengah */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 shadow-[0_0_20px_-4px] shadow-gold/40">
                <Crown className="size-7 text-gold" />
              </span>
              <p className="text-base font-extrabold leading-tight text-white">{p.label}</p>
              <p className="font-mono text-[10px] leading-tight text-zinc-500">
                {p.days} hari · nonton tanpa iklan
              </p>
            </div>

            {/* Dua kotak: Sacret (berlian) + HD 1080p */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-primary/40 bg-gradient-to-b from-primary/25 to-primary/5 px-2 py-2.5">
                <Gem className="size-6 text-primary" />
                <p className="text-[11px] font-bold text-primary">
                  {typeof p.sacret === "number" && p.sacret > 0
                    ? `${p.sacret.toLocaleString("id-ID")} Sacret`
                    : "Tanpa bonus"}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-sky-400/40 bg-gradient-to-b from-sky-400/25 to-sky-400/5 px-2 py-2.5">
                <span className="flex size-6 items-center justify-center rounded-md border border-sky-300/60 font-mono text-[10px] font-black text-sky-200">HD</span>
                <p className="text-[11px] font-bold text-sky-200">1080p</p>
              </div>
            </div>

            {/* Harga + tombol */}
            <div className="mt-3 text-center">
              <p className="font-mono text-xl font-bold text-gold">
                RP {p.price.toLocaleString("id-ID")}
              </p>
              {typeof p.sacret === "number" && p.sacret > 0 && (
                <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-bold text-primary">
                  <Gem className="size-3" /> +{p.sacret.toLocaleString("id-ID")} Sacret
                </p>
              )}
            </div>
            <button
              disabled={busy !== null}
              onClick={() => void startOrder(p)}
              className="yn-btn yn-btn-gold mt-3 w-full disabled:opacity-50"
            >
              {busy === "order" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyiapkan…
                </>
              ) : (
                "Beli"
              )}
            </button>
          </div>
        ))}
      </div>
      {/* Titik penunjuk geser */}
      {planCount > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: planCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === activePlan ? "w-4 bg-gold" : "w-1.5 bg-white/25",
              )}
            />
          ))}
        </div>
      )}
      {!ready && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Pembayaran sedang disiapkan developer. Cek lagi nanti.
        </p>
      )}
      {err && !order && (
        <p className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-200">
          {err}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickProof(f);
          e.target.value = "";
        }}
      />

      {order && (
        <CheckoutOverlay
          order={order}
          image={image}
          accountName={config?.accountName}
          accountLabel={config?.accountLabel}
          preview={preview}
          proof={proof !== null}
          busy={busy}
          note={note}
          onNote={setNote}
          onPick={() => fileRef.current?.click()}
          onSend={() => void send()}
          onCancel={batal}
          verdict={verdict}
          err={err}
        />
      )}
    </section>
  );
}

/** Layar bayar: satu layar penuh berisi QRIS, nominal, dan bukti transfer. */
function CheckoutOverlay({
  order,
  image,
  accountName,
  accountLabel,
  preview,
  proof,
  busy,
  note,
  onNote,
  onPick,
  onSend,
  onCancel,
  verdict,
  err,
}: {
  order: Order;
  image: string;
  accountName?: string;
  accountLabel?: string;
  preview: string | null;
  proof: boolean;
  busy: string | null;
  note: string;
  onNote: (v: string) => void;
  onPick: () => void;
  onSend: () => void;
  /** Tombol Batal di paling bawah: hapus order + tutup layar. */
  onCancel: () => void;
  verdict: Verdict | null;
  /** Galat inline (toast bawah sudah dihapus permanen). */
  err: string;
}) {
  useHideNavOnMount(); // navbar disembunyikan selama layar bayar terbuka
  return (
    <div className="screen-enter fixed inset-0 z-[80] overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-md px-3 pb-10">
        {/* Tanpa tombol X/tutup: satu-satunya cara keluar adalah Batal di
            bawah, supaya order tidak tertinggal tanpa kejelasan. */}
        <div className="mb-3 mt-1 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{order.planLabel}</p>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              Bayar lewat QRIS · {order.orderId}
            </p>
          </div>
        </div>
        <Checkout
          order={order}
          image={image}
          accountName={accountName}
          accountLabel={accountLabel}
          preview={preview}
          proof={proof}
          busy={busy}
          note={note}
          onNote={onNote}
          onPick={onPick}
          onSend={onSend}
          onCancel={onCancel}
          verdict={verdict}
          err={err}
        />
      </div>
    </div>
  );
}

function Checkout({
  order,
  image,
  accountName,
  accountLabel,
  preview,
  proof,
  busy,
  note,
  onNote,
  onPick,
  onSend,
  onCancel,
  verdict,
  err,
}: {
  order: Order;
  image: string;
  accountName?: string;
  accountLabel?: string;
  preview: string | null;
  proof: boolean;
  busy: string | null;
  note: string;
  onNote: (v: string) => void;
  onPick: () => void;
  onSend: () => void;
  onCancel: () => void;
  verdict: Verdict | null;
  err: string;
}) {
  const live = useQuery(api.payments.myOrder, { orderId: order.orderId });
  // Gambar QRIS diperbesar saat diketuk (permintaan user: bisa dilihat
  // gede seperti membuka foto).
  const [qrisZoom, setQrisZoom] = useState(false);
  if (live?.status === "paid" && !verdict) {
    return (
      <div className="yn-card border-emerald-500/30 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
          <ShieldCheck className="size-4" /> Premium sudah aktif
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {order.planLabel} masuk ke akun kamu. Terima kasih!
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="yn-card flex flex-col items-center gap-2.5 p-5">
        {image ? (
          <button
            type="button"
            onClick={() => setQrisZoom(true)}
            aria-label="Perbesar gambar QRIS"
            className="block"
          >
            <img
              src={image}
              alt="QRIS YoruNime"
              /* object-contain + rasio asli: gambar TIDAK pernah gepeng/
                 dipaksa jadi kotak, walau berkas QRIS-nya bukan persegi. */
              className="max-h-72 w-auto max-w-full rounded-xl bg-white p-2.5 object-contain shadow-lg shadow-black/40"
            />
          </button>
        ) : (
          <div className="flex size-48 items-center justify-center rounded-xl bg-black/40 text-xs text-zinc-400">
            QRIS belum tersedia
          </div>
        )}
        {/* Pratinjau besar: ketuk gambar untuk melihat QRIS sebesar layar. */}
        {qrisZoom && image && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setQrisZoom(false)}
            role="dialog"
            aria-modal="true"
          >
            <img
              src={image}
              alt="QRIS YoruNime (besar)"
              className="max-h-full max-w-full rounded-2xl bg-white object-contain p-3"
            />
            <span className="absolute bottom-10 text-xs text-white/70">
              Ketuk di mana saja untuk menutup
            </span>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <QrCode className="size-3.5" /> Scan dari app apa pun yang bisa QRIS
        </p>
        {accountName && (
          <p className="text-[11px] text-zinc-300">
            Atas nama <b>{accountName}</b>
            {accountLabel ? ` (${accountLabel})` : ""}
          </p>
        )}
      </div>

      <div className="yn-card px-4 py-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">total transfer</p>
        <p className="mt-0.5 font-mono text-3xl font-bold text-gold">
          Rp {order.priceIdr.toLocaleString("id-ID")}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          {order.planLabel} · {order.days} hari
        </p>
      </div>

      <div className="yn-card p-4">
        <p className="text-[13px] font-bold">Bukti transfer</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            onClick={onPick}
            disabled={busy !== null}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3.5 text-xs font-bold text-zinc-100 transition hover:border-gold/60 disabled:opacity-50"
          >
            {busy === "proof" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Unggah foto bukti
          </button>
          {proof && (
            <span className="text-[11px] font-semibold text-emerald-400">
              Bukti siap dikirim
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Screenshot harus jelas. Foto buram ditolak.
        </p>
        {preview && (
          <img
            src={preview}
            alt="Pratinjau bukti"
            className="mt-2 max-h-40 w-full rounded-lg border border-white/10 object-contain"
          />
        )}
      </div>

      <div className="yn-card p-4">
        <p className="text-[13px] font-bold">Keterangan transfer</p>
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="contoh: Transfer Rp 7.000 dari GoPay atas nama Rii"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-gold/70"
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Wajib diisi. Ini yang dicocokkan dengan bukti transfer.
        </p>
      </div>

      {err && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[12px] font-semibold text-red-200">
          {err}
        </p>
      )}

      {/* Dua tombol satu-satunya di layar beli: Batal dan Kirim bukti. */}
      <div className="flex items-stretch gap-2">
        <button
          onClick={onCancel}
          disabled={busy !== null}
          className="yn-btn w-[34%] shrink-0 border border-white/20 text-zinc-200 disabled:opacity-40"
        >
          Batal
        </button>
        <button
          onClick={onSend}
          disabled={!proof || note.trim().length === 0 || busy !== null}
          className="yn-btn yn-btn-gold flex-1 disabled:opacity-40"
        >
          {busy === "send" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Menganalisis
            </>
          ) : (
            "Kirim bukti"
          )}
        </button>
      </div>

      {verdict && (
        <div
          className={cn(
            "border px-3 py-2.5 text-[11px] leading-relaxed",
            verdict.verdict === "verified"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : verdict.verdict === "rejected"
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-gold/40 bg-gold/10 text-amber-200",
          )}
        >
          <p className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="size-3.5" />
            {verdict.verdict === "verified"
              ? "Pembayaran terverifikasi"
              : verdict.verdict === "rejected"
                ? "Bukti ditolak"
                : "Menunggu developer"}
          </p>
          <p className="mt-1">{verdict.note}</p>
        </div>
      )}
    </div>
  );
}

function Perks() {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-gold">
        <Zap className="size-3.5" /> Kegunaannya
      </h2>
      <div className="yn-card mt-2 p-4">
        <ul className="space-y-2.5">
          {PERKS.map((p) => (
            <li
              key={p}
              className="flex items-start gap-2.5 text-[13px] leading-6 text-zinc-300"
            >
              <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="size-3 text-emerald-400" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HistoryList() {
  const history = useQuery(api.payments.myPurchases, {}) as History[] | undefined;
  if (!history || history.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[13px] font-bold text-gold">Riwayat</h2>
      <ul className="mt-2 divide-y divide-white/10">
        {history.map((h) => (
          <li
            key={h._id}
            className="flex items-center justify-between gap-2 py-2 text-[13px]"
          >
            <span className="min-w-0 truncate">
              {h.planLabel}{" "}
              <span className="font-mono text-[11px] text-zinc-500">
                {h.priceIdr.toLocaleString("id-ID")}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-semibold",
                h.status === "paid"
                  ? "text-emerald-400"
                  : h.status === "rejected"
                    ? "text-red-400"
                    : "text-gold",
              )}
            >
              {STATUS_LABEL[h.status] ?? h.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}