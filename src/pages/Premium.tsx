import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import {
  Check,
  ChevronLeft,
  Gem,
  Loader2,
  QrCode,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  Avatar,
  BlueCheck,
  ClanTag,
  LevelBadge,
  TitleBadge,
} from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { displayId, usernameColor } from "@/lib/lstream";

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
      <div className="py-3">
        {/* Tombol balik — sekarang di ALUR halaman (bukan fixed yang
            menimpa kartu), jadi kotak akun di bawahnya punya celah dan
            terlihat rapi. */}
        <button
          onClick={() => navigate("/home")}
          className="mb-3 ml-1 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur transition hover:border-white/30"
          aria-label="Kembali"
        >
          <ChevronLeft className="size-5" />
        </button>
        <Hero />
        <Plans />
        <Perks />
        <HistoryList />
      </div>
    </AppLayout>
  );
}

/**
 * Kartu profil lurus (tanpa skew) di atas layar Premium — menggantikan
 * hero "YORUNIME Premium" + langkah "Cara beli" yang diminta dihapus.
 * Isinya: foto profil, username, title staff, badge centang biru, tag clan,
 * ID, dan status premium.
 */
function Hero() {
  const { user } = useAuth();
  const now = Date.now();
  const premium = (user?.premiumUntil ?? 0) > now;
  const premiumDays = Math.max(
    0,
    Math.floor(((user?.premiumUntil ?? 0) - now) / 86400000),
  );
  if (!user) return null;
  return (
    <header className="pop-enter yn-card flex items-center gap-3 rounded-2xl border border-gold/25 p-3">
      <Avatar
        src={user.image}
        seed={user.username}
        className="size-12 shrink-0 ring-2 ring-gold/40"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm font-bold", usernameColor(user.username))}>
            {user.username ?? "user"}
          </span>
          {premium && <BlueCheck className="size-3.5" />}
          <TitleBadge role={user.staffRole} compact />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <LevelBadge level={user.level ?? 1} className="origin-left scale-90" />
          {user.clanTag && (
            <ClanTag
              icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={user.clanTag}
              color={user.clanNameColor}
              className="scale-90"
            />
          )}
          <span className="text-[10px] text-zinc-500">
            ID: {displayId(user.seqId, user._id)}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-lg px-2.5 py-1.5 text-center text-[10px] font-bold",
          premium ? "bg-gold/15 text-gold" : "bg-white/5 text-zinc-400",
        )}
      >
        {premium ? (
          <>
            Premium
            <span className="block text-[13px]">{premiumDays} hari</span>
          </>
        ) : (
          "Belum premium"
        )}
      </span>
    </header>
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
      {/* Kartu paket gaya 2 kolom: durasi, harga besar, catatan per bulan,
          chip Sacret (biru), chip HD 1080P (hijau), dan tombol "Pilih paket".
          Tanpa harga coretan. Paket paling hemat mendapat badge "Paling
          hemat" + aksen emas. */}
      {(() => {
        const sorted = [...(plans ?? [])].sort(
          (a, b) => (a.price ?? 0) - (b.price ?? 0),
        );
        // Baseline harga per hari = paket paling mahal per hari (biasanya
        // paket 1 bulan). Hemat% dihitung terhadap baseline itu.
        const perDay = (p: Plan) => (p.days > 0 ? p.price / p.days : p.price);
        const baseline = Math.max(...sorted.map(perDay), 0);
        // Badge "Paling hemat" menempel di paket 1 BULAN (permintaan user),
        // bukan lagi otomatis paket paling murah per hari. Kalau tidak ada
        // paket 30 hari, jatuh ke paket yang durasinya paling mendekati 30
        // hari, supaya labelnya tetap masuk akal.
        const bestId =
          sorted.length === 0
            ? undefined
            : sorted.reduce<Plan>(
                (closest, p) =>
                  Math.abs(p.days - 30) < Math.abs(closest.days - 30) ? p : closest,
                sorted[0],
              ).id;
        return (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {sorted.map((p) => {
              const hemat =
                baseline > 0 && perDay(p) < baseline
                  ? Math.round((1 - perDay(p) / baseline) * 100)
                  : 0;
              const perBulan = Math.round((p.price / Math.max(1, p.days)) * 30);
              const best = p.id === bestId;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-3.5",
                    best
                      ? "border-gold/70 bg-gradient-to-b from-gold/12 to-transparent"
                      : "border-border bg-card",
                  )}
                >
                  {/* Badge "Paling hemat" di atas kartu terbaik */}
                  {best && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-black text-black">
                      Paling hemat
                    </span>
                  )}
                  <p className="text-[13px] font-bold text-white/90">
                    {p.label}
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-black leading-tight tracking-tight text-white">
                    Rp{p.price.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {p.days} hari{p.days >= 60 ? ` · ≈ Rp${perBulan.toLocaleString("id-ID")} / bulan` : ""}
                  </p>
                  {/* Chip Sacret (berlian biru) */}
                  {typeof p.sacret === "number" && p.sacret > 0 && (
                    <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                      <Gem className="size-3" /> +{p.sacret.toLocaleString("id-ID")} Sacret
                    </span>
                  )}
                  {/* Chip HD 1080P (hijau) — SEMUA paket dapat chip ini.
                      Dulu hanya muncul untuk paket yang dianggap "hemat"
                      sehingga ada kartu yang kehilangan chip HD-nya. */}
                  <span className="mt-1.5 inline-flex w-fit items-center rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    HD 1080P
                  </span>
                  <button
                    disabled={busy !== null}
                    onClick={() => void startOrder(p)}
                    className={cn(
                      "mt-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-50",
                      best
                        ? "bg-gold text-black shadow-[0_0_16px_-6px] shadow-gold/60"
                        : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]",
                    )}
                  >
                    {busy === "order" ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" /> Menyiapkan…
                      </span>
                    ) : (
                      "Pilih paket"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}
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
            className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3.5 text-xs font-bold text-zinc-100 transition hover:border-gold/60 hover:bg-white/[0.12] disabled:opacity-50"
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