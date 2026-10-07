/**
 * Panel developer: atur pesanan, saldo, dan tarik saldo.
 *
 * Ini bagian "atur pesanan" dari pembayaran otomatis Xendit. Semua status
 * ditampilkan apa adanya - termasuk kalau kunci Xendit belum diisi - supaya
 * developer tidak bingung kenapa tombol bayar otomatis tidak muncul di sisi
 * user.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const rupiah = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "failed"
        ? "border-red-500/40 bg-red-500/10 text-red-300"
        : "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
        tone,
      )}
    >
      {status === "pending_xendit" ? "menunggu" : status}
    </span>
  );
}

function Orders() {
  const rows = useQuery(api.xendit.devOrders, {}) as
    | {
        _id: string;
        orderId: string;
        planLabel: string;
        priceIdr: number;
        status: string;
        method?: string;
        paymentUrl?: string;
        paymentRef?: string;
        note?: string;
        username: string;
        createdAt: number;
      }[]
    | undefined;
  const setOrder = useMutation(api.xendit.devSetOrderStatus);
  const simulate = useMutation(api.xendit.devSimulatePaid);

  if (rows === undefined)
    return (
      <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Memuat pesanan…
      </p>
    );
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Belum ada pesanan.
      </p>
    );

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r._id} className="rounded-xl border border-border bg-card/60 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{r.planLabel}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {r.username} · {r.orderId}
              </p>
              {r.note && (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {r.note}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs font-bold text-gold">
                {rupiah(r.priceIdr)}
              </p>
              <div className="mt-1 flex justify-end">
                <StatusPill status={r.status} />
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.paymentUrl && (
              <a
                href={r.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
              >
                <ExternalLink className="size-3" /> Buka invoice
              </a>
            )}
            {r.status !== "paid" && (
              <>
                <button
                  onClick={() => {
                    void simulate({ orderId: r.orderId })
                      .then(() =>
                        toast.success("Order ditandai lunas (simulasi)"),
                      )
                      .catch((e: unknown) =>
                        toast.error(e instanceof Error ? e.message : "Gagal"),
                      );
                  }}
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300"
                >
                  Simulasi bayar
                </button>
                <button
                  onClick={() => {
                    void setOrder({ orderId: r.orderId, status: "paid" })
                      .then(() => toast.success("Order ditandai lunas"))
                      .catch((e: unknown) =>
                        toast.error(e instanceof Error ? e.message : "Gagal"),
                      );
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold"
                >
                  Tandai lunas
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function WalletPanel() {
  const data = useQuery(api.xendit.saldo, {}) as
    | {
        total: number;
        entries: { _id: string; kind: string; amount: number; note?: string; createdAt: number }[];
        withdrawals: {
          _id: string;
          amount: number;
          target: string;
          channel: string;
          status: string;
          createdAt: number;
        }[];
      }
    | undefined;
  const withdraw = useMutation(api.xendit.requestWithdrawal);
  const setWd = useMutation(api.xendit.setWithdrawalStatus);

  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("GoPay");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const channels = ["GoPay", "DANA", "ShopeePay", "OVO", "LinkAja", "BCA", "BRI", "Mandiri"];

  const submit = () => {
    const n = Number(amount.replace(/\D/g, ""));
    if (!n) {
      toast.error("Nominal belum diisi");
      return;
    }
    setBusy(true);
    void withdraw({ amount: n, channel, target })
      .then(() => {
        toast.success("Permintaan tarik saldo dicatat");
        setAmount("");
        setTarget("");
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Gagal"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-3">
      {/* Kartu saldo, gaya aplikasi dompet digital */}
      <div className="rounded-2xl bg-gradient-to-br from-[oklch(0.45_0.16_14)] to-[oklch(0.32_0.07_262)] p-4 text-white shadow-lg">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
          <Wallet className="size-3.5" /> Saldo
        </p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-tight">
          {rupiah(data?.total ?? 0)}
        </p>
        <p className="mt-1 text-[10px] text-white/70">
          Terkumpul dari semua pembayaran premium
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-3">
        <p className="text-[11px] font-bold">Tarik saldo ke e-wallet</p>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          Permintaan dicatat di sini, transfer-nya dieksekusi dari Dashboard
          Xendit (Send Payouts) lalu statusnya ditandai terkirim.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Nominal"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none"
          >
            {channels.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Nomor / rekening tujuan"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
        />
        <button
          disabled={busy}
          onClick={submit}
          className="yn-btn yn-btn-gold mt-2 w-full text-xs disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Memproses…
            </>
          ) : (
            <>
              <Banknote className="size-4" /> Ajukan tarik saldo
            </>
          )}
        </button>
      </div>

      {(data?.withdrawals?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold">Riwayat tarik saldo</p>
          {data!.withdrawals.map((w) => (
            <div
              key={w._id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">{rupiah(w.amount)}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {w.channel} · {w.target}
                </p>
              </div>
              {w.status === "requested" ? (
                <button
                  onClick={() => {
                    void setWd({ id: w._id as never, status: "sent" })
                      .then(() => toast.success("Ditandai terkirim"))
                      .catch(() => {});
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold"
                >
                  Tandai terkirim
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                  <CheckCircle2 className="size-3" /> {w.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold">Mutasi</p>
        {(data?.entries?.length ?? 0) === 0 ? (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            Belum ada mutasi.
          </p>
        ) : (
          data!.entries.slice(0, 25).map((e) => (
            <div
              key={e._id}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">{e.note}</p>
                <p className="text-[9px] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("id-ID")}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 font-mono text-[11px] font-bold",
                  e.kind === "topup" ? "text-emerald-400" : "text-red-400",
                )}
              >
                {e.kind === "topup" ? "+" : "-"}
                {rupiah(e.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Config() {
  const status = useQuery(api.xendit.xenditStatus, {});
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <p className="text-[11px] font-bold">Status koneksi Xendit</p>
      <div className="mt-2 space-y-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              status?.hasSecret ? "bg-emerald-500" : "bg-red-500",
            )}
          />
          <span>Secret API key {status?.hasSecret ? "terisi" : "belum diisi"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              status?.hasCallback ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span>
            Callback token {status?.hasCallback ? "terisi" : "belum diisi"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Isi keduanya di menu Keys/API keys:{" "}
        <span className="font-mono">XENDIT_SECRET_KEY</span> dan{" "}
        <span className="font-mono">XENDIT_CALLBACK_TOKEN</span>.
      </p>
    </div>
  );
}

/** Panel lengkap, dipakai sebagai tab di FAB developer. */
export function OrdersPanel({ tab }: { tab: "orders" | "wallet" | "config" }) {
  if (tab === "wallet") return <WalletPanel />;
  if (tab === "config") return <Config />;
  return <Orders />;
}
