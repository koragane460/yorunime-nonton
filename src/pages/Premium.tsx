import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { SectionTitle } from "@/components/lstream-ui";
import { Crown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Premium() {
  return (
    <AppLayout hideAccountPanel>
      <PremiumContent />
    </AppLayout>
  );
}

function PremiumContent() {
  const plans = useQuery(api.payments.premiumPlans, {});
  const buy = useAction(api.payments.buyPlan);
  const myPurchases = useQuery(api.payments.myPurchases, {});
  const [busy, setBusy] = useState<string | null>(null);

  const perks = [
    "Tonton tanpa iklan gangguan",
    "Kualitas sampai 1080p",
    "Download episode untuk nonton offline",
    "Badge centang biru di nama",
    "Bisa give premium ke user lain (xp & level)",
    "Kuis & event eksklusif member premium",
    "Akses cepat server streaming",
  ];

  return (
    <div className="py-3">
      <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 to-transparent p-5 text-center">
        <Crown className="mx-auto size-12 text-yellow-400" />
        <h1 className="mt-2 text-xl font-black">LStream Premium</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buka semua fitur terbaik, dukung LStream terus berkembang
        </p>
      </div>

      <SectionTitle>Pilih Paket</SectionTitle>
      <div className="space-y-2.5">
        {(plans ?? []).map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4",
              p.id === "p1"
                ? "border-yellow-400/70 bg-yellow-400/10"
                : "border-border bg-card",
            )}
          >
            <div className="flex-1">
              <p className="font-bold">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.days} hari premium</p>
            </div>
            <p className="text-lg font-black text-yellow-300">
              Rp {p.price.toLocaleString("id-ID")}
            </p>
            <button
              disabled={busy === p.id}
              onClick={async () => {
                setBusy(p.id);
                try {
                  const r = (await buy({ planId: p.id })) as any;
                  if (r?.url) {
                    window.open(r.url, "_blank");
                    toast.success("Lanjutkan pembayaran di tab baru");
                  } else if (r?.note) {
                    toast.info(r.note);
                  } else {
                    toast.success("Pembayaran diproses");
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
                setBusy(null);
              }}
              className="rounded-full bg-yellow-500 px-5 py-2 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {busy === p.id ? "…" : "Beli"}
            </button>
          </div>
        ))}
      </div>

      <SectionTitle>Kegunaan Premium</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <ul className="space-y-2">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check className="mt-0.5 size-4 shrink-0 text-green-400" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Pembayaran mendukung DANA / QRIS / GoPay / VA melalui payment gateway. Jika gateway
          belum aktif, kamu tetap bisa dapat trial 1 hari untuk mencoba.
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
                    p.status === "paid" ? "text-green-400" : "text-yellow-400",
                  )}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
