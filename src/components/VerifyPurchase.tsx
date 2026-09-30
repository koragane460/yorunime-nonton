import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Check, X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/lstream-ui";

type Plan = { id: string; label: string; days: number; price: number };

/** Hash ringan (djb2) dari isi file — dipakai sebagai "sidik jari" bukti. */
function hashBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) h = ((h << 5) + h + bytes[i]) >>> 0;
  return `${h.toString(16)}-${bytes.length.toString(16)}`;
}

/** Perkecil gambar supaya cepat dianalisis bot AI. */
async function shrink(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
  if (raw.length < 500_000) return await (await fetch(raw)).blob();
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar rusak"));
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
      canvas.toBlob(r, "image/jpeg", quality),
    );
    return blob ?? (await (await fetch(raw)).blob());
  } catch {
    return await (await fetch(raw)).blob();
  }
}

export function VerifyPurchase() {
  const { user } = useAuth();
  const config = useQuery(api.payments.manualConfig, {});
  const plans = useQuery(api.payments.premiumPlans, {}) as Plan[] | undefined;
  const verifyUid = useQuery(
    api.payments.verifyUid,
    (user?.uidCode ?? "").length === 7 ? { code: user!.uidCode! } : "skip",
  );
  const submitProof = useMutation(api.payments.submitProofPurchase);
  const analyze = useAction(api.payments.analyzeProof);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);

  const [planId, setPlanId] = useState("p1");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<{ storageId: string; hash: string } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{
    verdict: string;
    note: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = (plans ?? []).find((p) => p.id === planId) ?? (plans ?? [])[0];
  const order = useQuery(
    api.payments.myOrder,
    orderId ? { orderId } : "skip",
  );

  // Kalau bot sudah selesai, tampilkan hasilAnalyze-nya.
  useEffect(() => {
    if (order?.analysisNote) {
      setVerdict((v) =>
        v && v.note === order.analysisNote ? v : { verdict: order.status, note: order.analysisNote },
      );
    }
  }, [order?.analysisNote, order?.status]);

  const uidOk = verifyUid?.ok === true;

  const pickFile = async (file: File) => {
    setBusy(true);
    try {
      const blob = await shrink(file);
      const buf = await blob.arrayBuffer();
      const uploadUrl = await getUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload bukti gagal");
      const { storageId } = (await res.json()) as { storageId: string };
      setProof({ storageId, hash: hashBytes(buf) });
      toast.success("Bukti transfer diunggah");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah bukti");
    }
    setBusy(false);
  };

  const submit = async () => {
    if (!plan) return;
    if (!user?.uidCode) {
      toast.error("UID akun belum siap, tunggu sebentar lalu muat ulang");
      return;
    }
    setBusy(true);
    setVerdict(null);
    try {
      const order = await submitProof({
        uidCode: user.uidCode,
        planId: plan.id,
        proofStorageId: proof?.storageId,
        proofText: note.trim() || undefined,
        proofHash: proof?.hash,
      });
      setOrderId(order.orderId);
      toast.success("Bukti terkirim, bot sedang memeriksa…");
      const r = await analyze({ orderId: order.orderId });
      setVerdict({ verdict: r.verdict, note: r.note });
      if (r.verdict === "verified") toast.success("Pembayaran terverifikasi — premium aktif!");
      else if (r.verdict === "rejected") toast.error("Bukti ditolak: " + r.note);
      else toast.info("Bukti belum bisa dipastikan, developer akan cek manual.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim bukti");
    }
    setBusy(false);
  };

  if (!config?.ready) return null;

  return (
    <div className="mt-4 space-y-3">
      <SectionTitle>Verifikasi Pembelian</SectionTitle>

      {/* Langkah 1: UID */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          1. UID akun kamu
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-border bg-black/40 px-3 py-2.5 font-mono text-sm tracking-widest text-emerald-300">
            {user?.uidCode ?? "…"}
          </code>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(user?.uidCode ?? "");
              toast.success("UID disalin");
            }}
            className="rounded-xl border border-border p-2.5 text-muted-foreground"
            aria-label="Salin UID"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          UID otomatis dibuat untuk tiap akun. Jangan pernah bagikan UID ke orang
          lain — UID dipakai untuk memastikan bukti transfer milikmu sendiri.
        </p>
        {verifyUid && !uidOk && (
          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {verifyUid.reason}
          </p>
        )}
        {uidOk && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <Check className="size-3.5" /> UID valid
          </p>
        )}
      </div>

      {/* Langkah 2: paket + QRIS */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          2. Pilih paket &amp; bayar via QRIS
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(plans ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setPlanId(p.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                p.id === planId
                  ? "border-emerald-400 bg-emerald-400/15 text-emerald-300"
                  : "border-border text-muted-foreground hover:border-emerald-400",
              )}
            >
              {p.label} · {p.price.toLocaleString("id-ID")}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col items-center gap-2">
          <img
            src={config.qrUrl}
            alt="QRIS"
            className="size-52 rounded-xl bg-white object-contain p-2"
          />
          <p className="text-center text-xs text-zinc-400">
            Scan pakai GoPay / DANA / ShopeePay / m-banking
          </p>
          {config.accountName && (
            <p className="text-center text-xs text-zinc-300">
              Atas nama: <b>{config.accountName}</b>
              {config.accountLabel ? ` · ${config.accountLabel}` : ""}
            </p>
          )}
          {plan && (
            <p className="text-sm font-black text-emerald-300">
              Rp {plan.price.toLocaleString("id-ID")}
            </p>
          )}
        </div>
      </div>

      {/* Langkah 3: bukti transfer */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          3. Kirim bukti transfer
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Screenshot bukti transfer. Bot AI akan membacanya lalu otomatis
          memberi premium kalau nominalnya cocok. Bukti hanya bisa dipakai satu
          kali.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || !uidOk}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-40"
          >
            {busy ? "Memproses…" : "Pilih screenshot bukti"}
          </button>
          {proof && (
            <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">
              bukti terkirim ✓
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickFile(f);
            e.target.value = "";
          }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Opsional: contoh 'Transfer Rp 7.000 dari GoPay atas nama Rii'"
          className="mt-2 w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:border-emerald-500"
        />
        <button
          onClick={submit}
          disabled={busy || !uidOk || !plan}
          className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Memproses…" : "Kirim bukti & Beli"}
        </button>

        {verdict && (
          <div
            className={cn(
              "mt-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
              verdict.verdict === "verified"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : verdict.verdict === "rejected"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200",
            )}
          >
            <p className="flex items-center gap-1.5 font-bold">
              {verdict.verdict === "verified" ? (
                <ShieldCheck className="size-3.5" />
              ) : verdict.verdict === "rejected" ? (
                <X className="size-3.5" />
              ) : (
                <Loader2 className="size-3.5" />
              )}
              {verdict.verdict === "verified"
                ? "Pembayaran terverifikasi"
                : verdict.verdict === "rejected"
                  ? "Bukti ditolak"
                  : "Menunggu verifikasi developer"}
            </p>
            <p className="mt-1">{verdict.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}