import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
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

/** Panduan setup pembayaran untuk pemilik aplikasi (Midtrans). */
const SETUP_STEPS: { t: string; d: string }[] = [
  {
    t: "Buat akun di Midtrans",
    d: "Daftar di midtrans.com, isi data usaha, lalu verifikasi akun sampai statusnya Active. Verifikasi butuh NPWP/NIK dan rekening atas nama sendiri.",
  },
  {
    t: "Aktifkan Snap (halaman pembayaran)",
    d: "Di menu Products > Snap, aktifkan Snap untuk Production. Snap adalah popup pembayaran yang dipakai YoruNime — user tidak perlu keluar dari aplikasi.",
  },
  {
    t: "Salin Server Key",
    d: "Buka Settings > Access Keys. Salin kolom Server Key (prefix SB-Mid-server- untuk sandbox, Mid-server- untuk production). Jangan pakai Client Key.",
  },
  {
    t: "Tempel key di tab Keys",
    d: "Buka tab Keys/API keys di dashboard Freebuff, isi MIDTRANS_SERVER_KEY dengan Server Key tadi. Opsional: MIDTRANS_IS_PRODUCTION = true kalau sudah mau pakai production (default-nya sandbox).",
  },
  {
    t: "Isi rekening penerima",
    d: "Di Midtrans > Settings > Bank Accounts / E-Wallets, daftarkan rekening bank, Virtual Account, atau QRIS yang akan menerima uang. Tanpa ini transaksi tidak bisa diselesaikan.",
  },
  {
    t: "Cek status di halaman ini",
    d: "Muat ulang halaman Premium. Kalau badge hijau muncul, berarti konfigurasi sudah terbaca. Uji dulu pakai mode sandbox, lalu pindah ke production saat sudah yakin.",
  },
  {
    t: "Naikkan ke production",
    d: "Ubah MIDTRANS_IS_PRODUCTION menjadi true, tempel Server Key production, lalu tes sekali pembayaran sungguhan kecil untuk memastikan dana masuk.",
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
            Panduan setup pembayaran (Midtrans)
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
          Pembayaran aman via Midtrans Snap: DANA, GoPay, ShopeePay, QRIS, dan Virtual
          Account. Kamu akan diarahkan ke halaman pembayaran lalu premium aktif otomatis.
        </p>
      </div>

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
                  {p.status === "paid" ? "lunas ✓" : "menunggu pembayaran"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
