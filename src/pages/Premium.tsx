import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { VerifyPurchase } from "@/components/VerifyPurchase";
import { SectionTitle } from "@/components/lstream-ui";
import {
  Crown,
  Check,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Plan = { id: string; label: string; days: number; price: number };
type PayConfig = {
  configured: boolean;
  isProd: boolean;
  mode?: string;
  masked?: string;
  message: string;
};
type Purchase = {
  _id: string;
  orderId: string;
  planLabel: string;
  priceIdr: number;
  status: string;
  createdAt: number;
};

export default function Premium() {
  return (
    <AppLayout hideAccountPanel>
      <PremiumContent />
    </AppLayout>
  );
}

const PERKS = [
  "Kualitas 1080p (khusus Premium) + server streaming lebih cepat",
  "Tonton tanpa iklan gangguan",
  "Badge centang emas di nama",
  "Bisa give premium ke user lain (dapat XP besar)",
  "Kuis & event eksklusif member premium",
  "Akses cepat server streaming",
];

/** Panduan setup pembayaran untuk pemilik aplikasi (QRIS manual / Midtrans). */
const SETUP_STEPS: { t: string; d: string }[] = [
  {
    t: "Cara sekarang: QRIS statis (tanpa gateway)",
    d: "Buka aplikasi GoPay/GoBiz di HP orang tua, buat QRIS statis, lalu salin link gambarnya. Tempel di panel dev > Pembayaran Manual (QRIS) bersama nama & nomor rekening. Tidak ada NPWP/KTP, tidak ada verifikasi, tidak ada biaya.",
  },
  {
    t: "Alur pembayarannya",
    d: "User pilih paket > dapat kode pesanan + QRIS > transfer sendiri > kirim bukti ke developer > developer tekan Setujui di panel dev. Premium langsung masuk ke akun user (dan notifikasi dikirim).",
  },
  {
    t: "Alternatif kalau nanti sudah punya NPWP",
    d: "Midtrans (Snap/VA/QRIS) atau Xendit bisa dipasang supaya pembayaran otomatis tanpa verifikasi manual. Keduanya butuh merchant atas nama orang dewasa + NIK (NPWP untuk Midtrans).",
  },
  {
    t: "Kalau memakai Midtrans",
    d: "Daftar di midtrans.com, verifikasi merchant, aktifkan Snap, lalu salin Server Key (SB-Mid-server- untuk sandbox). Tempel sebagai MIDTRANS_SERVER_KEY di tab Keys (backend saja, tidak ada key di frontend), opsional MIDTRANS_IS_PRODUCTION=true untuk production.",
  },
  {
    t: "Prioritasnya",
    d: "Selama mode QRIS manual aktif (QRIS terisi), aplikasi memakai pembayaran manual. Begitu MIDTRANS_SERVER_KEY diisi, Snap otomatis menggantikan alur manual.",
  },
];

function PaymentGuide({ config }: { config?: PayConfig }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const steps = [
    "Pilih paket di bawah, lalu tekan Beli.",
    "Popup Midtrans Snap terbuka — pilih metode: Virtual Account, QRIS, GoPay, DANA, OVO, atau kartu.",
    "Selesaikan pembayaran sesuai instruksi di layar.",
    "Premium langsung aktif di akun kamu, tidak perlu login ulang.",
  ];
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
          {config?.configured ? (
            <CircleCheck className="size-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="size-4 text-amber-300" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Cara Pembelian</p>
          {config?.configured ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Midtrans{" "}
              <span
                className={cn(
                  "font-bold",
                  config.isProd ? "text-emerald-400" : "text-amber-300",
                )}
              >
                {config.mode}
              </span>{" "}
              aktif · key {config.masked}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-amber-300">
              {config?.message ?? "Memuat status pembayaran…"}
            </p>
          )}
        </div>
      </div>

      <div className="my-2.5 h-px bg-white/10" />

      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-2.5 text-xs leading-5 text-zinc-300">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[9px] font-black text-white">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {/* Panduan setup untuk pemilik aplikasi */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2.5">
        <button
          onClick={() => setSetupOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-[11px] font-bold text-zinc-200">
            Panduan setup pembayaran (QRIS manual / Midtrans)
          </span>
          {setupOpen ? (
            <ChevronUp className="size-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="size-3.5 text-zinc-400" />
          )}
        </button>
        {setupOpen && (
          <ol className="mt-2.5 space-y-2">
            {SETUP_STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-2.5">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-black text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-zinc-200">
                    {s.t}
                  </span>
                  <span className="block text-[10px] leading-relaxed text-zinc-400">
                    {s.d}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function PremiumContent() {
  const plans = useQuery(api.payments.premiumPlans, {}) as Plan[] | undefined;
  const myPurchases = useQuery(api.payments.myPurchases, {}) as Purchase[] | undefined;
  // Mode manual: QRIS statis, tanpa gateway (Midtrans butuh NPWP/KTP merchant).
  const manual = useQuery(api.payments.manualConfig, {});
  const createManual = useMutation(api.payments.createManualOrder);
  const [manualOrder, setManualOrder] = useState<{
    orderId: string;
    priceIdr: number;
    days: number;
    planLabel: string;
  } | null>(null);
  const createSnap = useAction(api.payments.createSnapTransaction);
  const getPayConfig = useAction(api.payments.paymentConfig);
  const [payConfig, setPayConfig] = useState<PayConfig | undefined>(undefined);

  // Status pembayaran butuh env var (Node runtime) → dipanggil manual.
  useEffect(() => {
    let alive = true;
    getPayConfig()
      .then((c: any) => {
        if (alive) setPayConfig(c as PayConfig);
      })
      .catch((e: any) => {
        if (!alive) return;
        setPayConfig({
          configured: false,
          isProd: false,
          message: e instanceof Error ? e.message : "Gagal memuat status pembayaran",
        });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const checkStatus = useAction(api.payments.checkOrderStatus);
  const confirm = useMutation(api.payments.confirmPurchase);
  const [busy, setBusy] = useState<string | null>(null);
  const [polling, setPolling] = useState<string | null>(null);
  // key remount trick: increment saat pembayaran sukses agar query refetch
  const [paidTick, setPaidTick] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Saat kembali dari halaman pembayaran Snap: cek status order terakhir
  useEffect(() => {
    const orderId = sessionStorage.getItem("ls_pending_order");
    if (!orderId) return;
    setPolling(orderId);
    let tries = 0;
    pollTimer.current = setInterval(async () => {
      tries += 1;
      try {
        const r = (await checkStatus({ orderId })) as { status?: string };
        if (r?.status === "paid") {
          stopPoll(orderId);
          toast.success("Pembayaran diterima — premium aktif! 🎉");
          setPaidTick((t) => t + 1);
        }
      } catch {
        /* coba lagi */
      }
      if (tries >= 12) stopPoll(orderId);
    }, 5000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPoll = (orderId: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setPolling(null);
    sessionStorage.removeItem("ls_pending_order");
    void orderId;
  };

  const buy = async (plan: Plan) => {
    setBusy(plan.id);
    try {
      // 1) Midtrans kalau Server Key-nya sudah diisi.
      if (payConfig?.configured) {
        const r = (await createSnap({ planId: plan.id })) as {
          configured?: boolean;
          orderId?: string;
          token?: string;
          redirectUrl?: string;
          message?: string;
        };
        if (r?.configured && (r.token || r.redirectUrl)) {
          if (r.orderId) sessionStorage.setItem("ls_pending_order", r.orderId);
          if (r.redirectUrl) {
            toast.info("Membuka halaman pembayaran…");
            window.location.href = r.redirectUrl;
          } else if (r.token) {
            const w = window.open(
              `https://app.sandbox.midtrans.com/snap/v2/vtweb/${r.token}`,
              "_blank",
            );
            if (!w) toast.error("Popup diblokir browser — izinkan popup lalu coba lagi");
          }
          setBusy(null);
          return;
        }
      }

      // 2) Mode QRIS statis (dipakai sekarang): bayar manual, developer cek lalu
      if (manual?.ready) {
        const r = (await createManual({ planId: plan.id })) as {
          orderId: string;
          priceIdr: number;
          days: number;
          planLabel: string;
        };
        setManualOrder(r);
        toast.success("Kode pesanan dibuat — scan QRIS di bawah");
        setBusy(null);
        return;
      }

      // 3) Belum ada configured apa pun → demo (premium langsung aktif).
      const r = (await createSnap({ planId: plan.id })) as {
        configured?: boolean;
        orderId?: string;
        token?: string;
        redirectUrl?: string;
        message?: string;
      };
      if (!r) throw new Error("Gagal membuat transaksi");

      if (r.configured && (r.token || r.redirectUrl)) {
        if (r.orderId) sessionStorage.setItem("ls_pending_order", r.orderId);
        if (r.redirectUrl) {
          toast.info("Membuka halaman pembayaran…");
          window.location.href = r.redirectUrl;
        } else if (r.token) {
          // Fallback: pay via Snap popup
          const w = window.open(
            `https://app.sandbox.midtrans.com/snap/v2/vtweb/${r.token}`,
            "_blank",
          );
          if (!w) toast.error("Popup diblokir browser — izinkan popup lalu coba lagi");
        }
      } else {
        // Mode demo (MIDTRANS_SERVER_KEY belum diisi): order ditandai lunas
        if (r.orderId) await confirm({ orderId: r.orderId });
        toast.info(r.message ?? "Mode demo — premium langsung aktif tanpa pembayaran");
        setPaidTick((t) => t + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses pembelian");
    }
    setBusy(null);
  };

  return (
    <div className="py-3" key={paidTick}>
      <div className="bg-hero-gradient pop-enter rounded-2xl border border-white/10 p-5 text-center">
        <Crown className="mx-auto size-12 text-amber-300" />
        <h1 className="mt-2 text-xl font-black">YoruNime Premium</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Buka semua fitur terbaik, dukung YoruNime terus berkembang
        </p>
      </div>

      <PaymentGuide config={payConfig} />

      <SectionTitle>Pilih Paket</SectionTitle>
      <div className="space-y-2.5">
        {(plans ?? []).map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 transition",
              p.id === "p1"
                ? "border-amber-300/60 bg-amber-300/10"
                : "border-border bg-card hover:border-amber-300/40",
            )}
          >
            <div className="flex-1">
              <p className="font-bold">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.days} hari premium</p>
            </div>
            <p className="text-lg font-black text-amber-300">
              Rp {p.price.toLocaleString("id-ID")}
            </p>
            <button
              disabled={busy === p.id}
              onClick={() => void buy(p)}
              className="rounded-full bg-amber-300 px-5 py-2 text-sm font-bold text-black transition hover:bg-amber-200 disabled:opacity-50"
            >
              {busy === p.id ? "…" : "Beli"}
            </button>
          </div>
        ))}
      </div>

      {polling && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-200">
          <Loader2 className="size-4 animate-spin" />
          Menunggu konfirmasi pembayaran untuk order {polling.slice(0, 20)}…
        </div>
      )}

      {/* ---- Panel QRIS statis (mode manual) ---- */}
      {manual?.ready && (
        <div className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <QrCode className="size-4" /> Bayar via QRIS
          </p>
          {manualOrder ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-col items-center gap-2">
                <img
                  src={manual.qrUrl}
                  alt="QRIS"
                  className="size-52 rounded-xl bg-white object-contain p-2"
                />
                <p className="text-xs text-zinc-400">
                  Scan pakai GoPay / DANA / ShopeePay / m-banking apa pun
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                  Total yang dibayar
                </p>
                <p className="text-xl font-black text-emerald-300">
                  Rp {manualOrder.priceIdr.toLocaleString("id-ID")}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {manualOrder.planLabel} · {manualOrder.days} hari premium
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                  Kode pesanan (kirim ke developer)
                </p>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(manualOrder.orderId);
                    toast.success("Kode pesanan disalin");
                  }}
                  className="mt-1 w-full break-all rounded-lg bg-black/50 px-3 py-2 font-mono text-xs text-emerald-300"
                >
                  {manualOrder.orderId}
                </button>
              </div>
              {manual.accountName && (
                <p className="text-center text-xs text-zinc-300">
                  Atas nama: <b>{manual.accountName}</b>
                  {manual.accountLabel ? ` · ${manual.accountLabel}` : ""}
                </p>
              )}
              <p className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-200">
                {manual.note ||
                  "Setelah transfer, kirim bukti + kode pesanan ke developer. Premium aktif setelah pembayaran dicek (biasanya beberapa menit)."}
                {manual.contact ? ` Hubungi: ${manual.contact}` : ""}
              </p>
              <button
                onClick={() => setManualOrder(null)}
                className="w-full rounded-xl py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                Batal / buat pesanan lain
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Pilih paket di atas, lalu tekan Beli. Kamu dapat kode pesanan + QRIS
              untuk dibayar manual, dan premium aktif setelah developer
              memverifikasi pembayaran.
            </p>
          )}
        </div>
      )}

      <SectionTitle>Kegunaan Premium</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <ul className="space-y-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
          {manual?.ready
            ? "Pembayaran lewat QRIS statis: scan QRIS, kirim bukti ke developer, premium aktif setelah diverifikasi."
            : "Pembayaran aman via Midtrans Snap: DANA, GoPay, ShopeePay, QRIS, dan Virtual Account. Kamu akan diarahkan ke halaman pembayaran lalu premium aktif otomatis."}
        </p>
      </div>

      {manual?.ready && <VerifyPurchase />}

      {(myPurchases ?? []).length > 0 && (
        <>
          <SectionTitle>Riwayat Pembelian</SectionTitle>
          <div className="space-y-1.5">
            {(myPurchases ?? []).map((p) => (
              <div
                key={p._id}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/30 p-3 text-sm"
              >
                <span>
                  {p.planLabel} · Rp {p.priceIdr.toLocaleString("id-ID")}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    p.status === "paid" ? "text-emerald-400" : "text-amber-300",
                  )}
                >
                  {p.status === "paid"
                    ? "lunas ✓"
                    : p.status === "manual_pending"
                      ? "menunggu verifikasi developer"
                      : "menunggu pembayaran"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
