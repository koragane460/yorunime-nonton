import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { CsBadge, CsScreen } from "@/components/CsDevScreens";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Ban,
  Check,
  ChevronDown,
  
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Gem,
  Headset,
  Infinity as InfinityIcon,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  VolumeX,
  X,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

type PanelUser = {
  _id: Id<"users">;
  username: string;
  image?: string;
  seqId?: number;
  staffRole?: string;
  diamonds: number;
  unlimitedSacret: boolean;
  unlimitedPremium: boolean;
  premiumUntil: number;
  level: number;
  clanTag?: string;
  clanNameColor?: string;
  banned: boolean;
  bannedPermanent: boolean;
  bannedUntil: number;
  bannedReason: string;
  muted: boolean;
  mutedPermanent: boolean;
  mutedUntil: number;
  mutedReason: string;
  adultAccess?: boolean;
};

/**
 * Panel Developer (#1 / title dev) & Panel Moderator (title moderator).
 * Dev: title, unlimited Sacret/Premium, ban/unban, mute/unmute, premium clan.
 * Mod: ban/unban + mute/unmute saja, tampilannya sama.
 */
export function StaffPanel({ level }: { level: "dev" | "mod" | "none" }) {
  const [q, setQ] = useState("");
  const users = useQuery(api.moderation.panelUsers, { q }) as PanelUser[] | undefined;
  const clans = useQuery(api.moderation.panelClans, level === "dev" ? {} : "skip");
  const toggleTitle = useMutation(api.moderation.toggleTitle);
  const toggleUnlimited = useMutation(api.moderation.toggleUnlimited);
  const moderate = useMutation(api.moderation.moderate);
  const giveClan = useMutation(api.moderation.devGiveClanPremium);
  const simulateFriend = useMutation(api.friends.devSimulateFriendRequest);
  const toggleAdult = useMutation(api.moderation.toggleAdultAccess);
  const { user: me } = useAuth();

  const [picked, setPicked] = useState<PanelUser | null>(null);
  const [csOpen, setCsOpen] = useState(false);
  /** User yang jadi target dialog ban/mute (harus bertahan setelah sheet ditutup). */
  const [target, setTarget] = useState<PanelUser | null>(null);
  const [dialog, setDialog] = useState<null | "ban" | "mute" | "clan">(null);

  if (level === "none") return null;
  const isDev = level === "dev";

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        isDev ? "border-red-500/40 bg-red-500/5" : "border-blue-500/40 bg-blue-500/5",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-bold",
          isDev ? "text-red-400" : "text-blue-400",
        )}
      >
        {isDev ? <Shield className="size-4" /> : <ShieldCheck className="size-4" />}
        {isDev ? "Developer Panel" : "Moderator Panel"}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {isDev
          ? "Kelola title, unlimited, CS, ban & mute semua user"
          : "Kelola ban & mute user"}
      </p>

      {isDev && (
        <button
          onClick={() => setCsOpen(true)}
          className="mt-2.5 flex w-full items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2.5 text-left transition hover:border-violet-400"
        >
          <Headset className="size-4 shrink-0 text-violet-300" />
          <span className="min-w-0 flex-1 text-xs font-bold text-violet-200">
            Customer Service
          </span>
          <CsBadge />
        </button>
      )}
      {csOpen && <CsScreen onClose={() => setCsOpen(false)} />}

      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari username…"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Bersihkan">
            <X className="size-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="thin-scroll mt-2 max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {(users ?? []).map((u) => (
          <button
            key={u._id}
            onClick={() => setPicked(u)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition",
              u.banned
                ? "border-red-500/50 bg-red-500/10"
                : u.muted
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-border/70 bg-secondary/30 hover:border-violet-500/50",
            )}
          >
            <Avatar src={u.image} seed={u.username} className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="truncate text-xs font-semibold">{u.username}</span>
                <TitleBadge role={u.staffRole} compact />
                {u.clanTag && (
                  <ClanTag
                    icon={DEFAULT_CLAN_ICON}
                    tag={u.clanTag}
                    color={u.clanNameColor}
                    className="scale-90 px-1 py-0 text-[9px]"
                  />
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                <span>{displayId(u.seqId, u._id)}</span>
                <span>Lv.{u.level}</span>
                {u.unlimitedSacret && (
                  <span className="text-cyan-300">∞ Sacret</span>
                )}
                {u.unlimitedPremium && <span className="text-amber-300">∞ Prem</span>}
                {u.banned && (
                  <span className="text-red-400">
                    Banned{u.bannedPermanent ? " permanen" : ""}
                  </span>
                )}
                {u.muted && (
                  <span className="text-amber-400">
                    Mute{u.mutedPermanent ? " permanen" : ""}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
        {users && users.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">User tidak ditemukan</p>
        )}
      </div>

      {isDev && <GrantPremiumPanel />}
      {isDev && <ManualPaymentPanel />}
      {isDev && (
        <button
          onClick={() => setDialog("clan")}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 py-2 text-xs font-bold text-amber-300"
        >
          <Crown className="size-3.5" /> Premium Clan
        </button>
      )}

      {picked && (
        <UserActions
          user={picked}
          isDev={isDev}
          meId={me?._id as Id<"users"> | undefined}
          onClose={() => setPicked(null)}
          onSimulate={async (from, to) => {
            const t = picked;
            const fromName = from === me?._id ? (me?.username ?? "Kamu") : t.username;
            const toName = to === me?._id ? (me?.username ?? "Kamu") : t.username;
            try {
              const r = await simulateFriend({ fromUserId: from, toUserId: to });
              if (r.status === "friends")
                toast.info(`${fromName} sudah berteman dengan ${toName}`);
              else if (r.status === "pending")
                toast.info(`Request ${fromName} ke ${toName} masih pending`);
              else toast.success(`${fromName} mengirim request ke ${toName}`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
            setPicked(null);
          }}
          onTitle={async (title) => {
            const r = await toggleTitle({ targetId: picked._id, title });
            toast.success(r.granted ? `Title ${title} diberikan` : "Title dilepas");
            setPicked(null);
          }}
          onUnlimited={async (what) => {
            const r = await toggleUnlimited({ targetId: picked._id, what });
            toast.success(
              r.unlimited ? `Unlimited ${what} aktif` : `Unlimited ${what} mati`,
            );
            setPicked(null);
          }}
          onAdultAccess={async () => {
            const r = await toggleAdult({ targetId: picked._id });
            toast.success(r.adultAccess ? "Akses 18+ diberikan" : "Akses 18+ dicabut");
            setPicked(null);
          }}
          
          onDialog={(d) => {
            const t = picked;
            setPicked(null);
            if (d === "ban" || d === "mute") {
              setTarget(t);
              setDialog(d);
            } else {
              // unban / unmute langsung jalan
              void moderate({
                targetId: t!._id,
                action: d,
                permanent: false,
                reason: t!.bannedReason || t!.mutedReason || " Dicabut panel",
              }).then(() => toast.success(d === "unban" ? "Ban dicabut" : "Mute dicabut"))
                .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal"));
            }
          }}
        />
      )}

      {dialog && dialog !== "clan" && target && (
        <ModerationDialog
          kind={dialog}
          user={target}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => {
            try {
              await moderate({
                targetId: payload.targetId,
                action: payload.args.action,
                permanent: payload.args.permanent,
                value: payload.args.value,
                unit: payload.args.unit,
                reason: payload.args.reason,
              });
              toast.success(payload.kind === "ban" ? "User dibanned" : "User dimute");
              setDialog(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        />
      )}

      {dialog === "clan" && isDev && (
        <ClanPremiumDialog
          clans={(clans ?? []) as { _id: Id<"clans">; name: string; tag: string; members: number }[]}
          onClose={() => setDialog(null)}
          onSubmit={async (clanId, value, unit) => {
            try {
              const r = await giveClan({ clanId, value, unit });
              toast.success(`Premium diberikan ke ${r.count} member clan`);
              setDialog(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        />
      )}
    </div>
  );
}

 

/**
 * Mode pembayaran manual (QRIS statis): developer menempelkan foto QRIS +
 * rekening, lalu menyetujui order yang sudah dibayar user.
 */
function ManualPaymentPanel() {
  const config = useQuery(api.payments.devSettings, {});
  const pending = useQuery(api.payments.pendingManualOrders, {});
  const qrFile = useQuery(
    api.storage.getUrl,
    config?.qrStorageId ? { storageId: config.qrStorageId } : "skip",
  );
  const save = useMutation(api.payments.saveManualConfig);
  const approve = useMutation(api.payments.approveManualOrder);
  const reject = useMutation(api.payments.rejectManualOrder);
  const testBot = useAction(api.payments.devTestBot);
  const mailStatus = useAction(api.payments.devMailStatus);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoMax, setAutoMax] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrStorageId, setQrStorageId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [contact, setContact] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!config) return;
    setQrUrl(config.qrUrl ?? "");
    setQrStorageId(config.qrStorageId ?? "");
    setAccountName(config.accountName ?? "");
    setAccountLabel(config.accountLabel ?? "");
    setContact(config.contact ?? "");
    setDevEmail(config.devEmail ?? "");
    setNote(config.note ?? "");
    setAutoApprove(config.autoApprove === true);
    setAutoMax(config.autoApproveMax ? String(config.autoApproveMax) : "");
  }, [config]);

  return (
    <div className="mt-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-emerald-300">
          Pembayaran manual (QRIS)
        </span>
        <span className="text-[10px] text-emerald-300/80">
          {config?.ready ? `aktif · ${(pending ?? []).length} menunggu` : "belum diaktifkan"}
        </span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          <Field2 label="Link foto QRIS" value={qrUrl} onChange={setQrUrl} placeholder="https://.../qris.png" />
          <Field2 label="Nama pemilik rekening" value={accountName} onChange={setAccountName} placeholder="Nama di akun bank" />
          <Field2 label="Bank / e-wallet" value={accountLabel} onChange={setAccountLabel} placeholder="mis. GoPay - 08xx" />
          <Field2 label="Kontak (WA/Discord)" value={contact} onChange={setContact} placeholder="wa.me/xxxx" />
          <Field2
            label="Email developer (notifikasi order)"
            value={devEmail}
            onChange={setDevEmail}
            placeholder="email@kamu.com"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Instruksi tambahan (opsional)"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none"
          />
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-500/50 py-2 text-[11px] font-bold text-emerald-300">
            <Upload className="size-3.5" /> Unggah foto QRIS
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const uploadUrl = await getUploadUrl();
                  const res = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": f.type || "image/jpeg" },
                    body: f,
                  });
                  if (!res.ok) throw new Error("Unggah gagal");
                  const { storageId } = (await res.json()) as { storageId: string };
                  setQrStorageId(storageId);
                  toast.success("Foto QRIS siap, tekan Simpan pengaturan");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Unggah gagal");
                }
              }}
            />
          </label>
          {(qrFile || qrUrl) && (
            <img
              src={qrFile ?? qrUrl}
              alt="QRIS"
              className="h-28 w-28 rounded-lg bg-white object-contain p-1"
            />
          )}
          <button
            onClick={async () => {
              try {
                await save({
                  qrUrl: qrUrl || undefined,
                  qrStorageId: qrStorageId || undefined,
                  accountName: accountName || undefined,
                  accountLabel: accountLabel || undefined,
                  contact: contact || undefined,
                  devEmail: devEmail || undefined,
                  note: note || undefined,
                  autoApprove,
                  autoApproveMax: autoMax ? Number(autoMax) : 0,
                });
                toast.success("Pengaturan QRIS disimpan");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
              }
            }}
            className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white"
          >
            Simpan pengaturan
          </button>

          <div className="rounded-lg border border-border bg-background/60 p-2">
            <label className="flex items-center gap-2 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="size-4 accent-emerald-500"
              />
              Auto-setujui order (tanpa cek manual)
            </label>
            <input
              value={autoMax}
              onChange={(e) => setAutoMax(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="Batas harga auto-setuju (0 = semua)"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none"
            />
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await testBot({ expectedAmount: 7000 });
                  toast.success(`Engine: ${r.engine} · verdict: ${r.verdict}`);
                  toast.info(r.note);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal tes bot");
                }
                setBusy(false);
              }}
              className="mt-2 w-full rounded-lg border border-emerald-500/50 py-1.5 text-[11px] font-bold text-emerald-300"
            >
              Tes bot AI (cek key)
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await mailStatus({});
                  if (r.keyPresent) toast.success("RESEND_API_KEY terbaca, email siap");
                  else toast.error("RESEND_API_KEY belum terbaca di backend");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal cek");
                }
                setBusy(false);
              }}
              className="mt-2 w-full rounded-lg border border-amber-500/50 py-1.5 text-[11px] font-bold text-amber-300 disabled:opacity-50"
            >
              Cek kunci email
            </button>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Kalau engine-nya heuristik, berarti GEMINI_API_KEY belum terisi di
              tab Keys. Order tetap bisa kamu setujui manual di bawah.
            </p>
          </div>

          <p className="pt-1 text-[11px] font-bold text-emerald-300">
            Order menunggu verifikasi
          </p>
          {(pending ?? []).length === 0 && (
            <p className="text-[10px] text-muted-foreground">Belum ada order manual.</p>
          )}
          {(pending ?? []).map((o: any) => (
            <PendingOrderRow key={o._id} order={o} onApprove={approve} onReject={reject} />
          ))}
        </div>
      )}
    </div>
  );
}

type PendingOrder = {
  _id: string;
  orderId: string;
  status: string;
  planLabel: string;
  priceIdr: number;
  proofText?: string;
  proofUrl?: string;
  analysisNote?: string;
  username: string;
  image?: string;
  uidCode?: string;
};

function PendingOrderRow({
  order,
  onApprove,
  onReject,
}: {
  order: PendingOrder;
  onApprove: ReturnType<typeof useMutation<typeof api.payments.approveManualOrder>>;
  onReject: ReturnType<typeof useMutation<typeof api.payments.rejectManualOrder>>;
}) {
  const proofUrl = useQuery(
    api.storage.getUrl,
    order.proofUrl ? { storageId: order.proofUrl } : "skip",
  );
  const [showProof, setShowProof] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-background/60 p-2">
      <div className="flex items-center gap-2">
        <img
          src={order.image ?? ""}
          alt=""
          className="size-8 shrink-0 rounded-full bg-secondary object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold">{order.username}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {order.orderId}
          </p>
          <p className="text-[10px] text-emerald-300">
            {order.planLabel} · Rp {order.priceIdr.toLocaleString("id-ID")}
          </p>
          {order.status === "manual_review" && order.proofUrl && (
            <button
              onClick={() => setShowProof((v) => !v)}
              className="text-[10px] font-bold text-amber-300"
            >
              {showProof ? "Sembunyikan bukti" : "Lihat bukti transfer"}
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onApprove({ orderId: order.orderId });
                toast.success("Premium dikirim ke user");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
              }
              setBusy(false);
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            Setujui
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onReject({ orderId: order.orderId, reason: "Bukti tidak valid." });
                toast.info("Bukti ditolak");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
              }
              setBusy(false);
            }}
            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-[11px] font-bold text-red-300"
          >
            Tolak
          </button>
        </div>
      </div>
      {order.proofText && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          "{order.proofText}"
        </p>
      )}
      {order.analysisNote && (
        <p className="mt-1 text-[10px] text-amber-300/90">
          Catatan AI: {order.analysisNote}
        </p>
      )}
      {showProof && proofUrl && (
        <img
          src={proofUrl}
          alt="Bukti transfer"
          className="mt-2 max-h-48 w-full rounded-lg border border-border object-contain"
        />
      )}
    </div>
  );
}

/** Panel developer: beri premium manual ke user dengan durasi dan nominal. */
function GrantPremiumPanel() {
  const grant = useMutation(api.payments.devGrantPremium);
  const [target, setTarget] = useState("");
  const findUserByName = useQuery(
    api.moderation.findByExactUsername,
    target.trim() ? { username: target.trim() } : "skip",
  ) as { _id: Id<"users">; username: string; image?: string } | undefined;
  const [days, setDays] = useState("0");
  const [months, setMonths] = useState("1");
  const [years, setYears] = useState("0");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-amber-300">Kasih premium ke user</span>
        {open ? (
          <ChevronUp className="size-3.5 text-amber-300/80" />
        ) : (
          <ChevronDown className="size-3.5 text-amber-300/80" />
        )}
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          <Field2
            label="Nama user persis"
            value={target}
            onChange={setTarget}
            placeholder="username tanpa @"
          />
          <div className="grid grid-cols-3 gap-1.5">
            <Field2 label="Hari" value={days} onChange={setDays} />
            <Field2 label="Bulan" value={months} onChange={setMonths} />
            <Field2 label="Tahun" value={years} onChange={setYears} />
          </div>
          <Field2
            label="Nominal (Rp)"
            value={amount}
            onChange={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
            placeholder="7000"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Catatan ke user. Bisa tag: @username (pakai username asli)"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none"
          />
          <button
            disabled={busy || !target.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                if (!findUserByName) {
                  toast.error("Username tidak ada, cek ejaan persis");
                } else {
                  const r = await grant({
                    targetId: findUserByName._id,
                    days: Number(days) || 0,
                    months: Number(months) || 0,
                    years: Number(years) || 0,
                    amountIdr: Number(amount) || 0,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  });
                  toast.success("Premium dikirim, order kini lunas");
                  if (r.tagged.length > 0) {
                    toast.info("Bertanda merah: " + r.tagged.join(", "));
                  }
                  if (r.unknown.length > 0) {
                    toast.error("Username tidak ditemukan: " + r.unknown.join(", "));
                  }
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
              }
              setBusy(false);
            }}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-xs font-black text-black disabled:opacity-40"
          >
            {busy ? "Mengirim…" : "Kirim"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            Order dibuat berstatus menunggu pembayaran lalu langsung dilunasi.
            Tag hanya berlaku kalau username-nya benar-benar ada.
          </p>
        </div>
      )}
    </div>
  );
}

function Field2({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function UserActions({
  user,
  isDev,
  meId,
  onClose,
  onTitle,
  onUnlimited,
  onDialog,
  onSimulate,
  onAdultAccess,
}: {
  user: PanelUser;
  isDev: boolean;
  meId?: Id<"users">;
  onClose: () => void;
  onTitle: (t: "dev" | "mod" | "tester" | "sepuh") => void;
  onUnlimited: (w: "sacret" | "premium") => void;
  onDialog: (d: "ban" | "unban" | "mute" | "unmute") => void;
  onSimulate: (from: Id<"users">, to: Id<"users">) => void;
  onAdultAccess: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="pop-enter w-full max-w-sm rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <Avatar src={user.image} seed={user.username} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.username}</p>
            <p className="text-[10px] text-muted-foreground">
              {displayId(user.seqId, user._id)} · Lv.{user.level} ·{" "}
              {user.diamonds.toLocaleString("id-ID")} Sacret
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-1.5">
            <X className="size-4" />
          </button>
        </div>

        {isDev && (
          <>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ["dev", "+Developer"],
                  ["mod", "+Moderator"],
                  ["tester", "+Tester"],
                  ["sepuh", "+Sepuh"],
                ] as const
              ).map(([t, label]) => {
                const active = user.staffRole === t;
                return (
                  <button
                    key={t}
                    onClick={() => onTitle(t)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      active
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-border text-muted-foreground hover:border-violet-500",
                    )}
                  >
                    {active ? `✓ ${label.slice(1)} (lepas)` : label}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Unlimited
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => onUnlimited("sacret")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  user.unlimitedSacret
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                    : "border-border text-muted-foreground hover:border-cyan-400",
                )}
              >
                <Gem className="size-3" /> Unlimited Sacret
              </button>
              <button
                onClick={() => onUnlimited("premium")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  user.unlimitedPremium
                    ? "border-amber-400 bg-amber-400/20 text-amber-300"
                    : "border-border text-muted-foreground hover:border-amber-400",
                )}
              >
                <Crown className="size-3" /> Unlimited Premium
              </button>
            </div>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Izin Konten
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={onAdultAccess}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  user.adultAccess
                    ? "border-rose-400 bg-rose-400/20 text-rose-300"
                    : "border-border text-muted-foreground hover:border-rose-400 hover:text-rose-300",
                )}
              >
                {user.adultAccess ? "Cabut akses 18+" : "Beri akses 18+"}
              </button>
              </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Izin ini hanya berlaku di akun tersebut, tidak mengubah role lain.
            </p>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Simulasi Pertemanan
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                disabled={!meId || meId === user._id}
                onClick={() => meId && onSimulate(meId, user._id)}
                className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-40"
              >
                <UserPlus className="size-3" /> Aku add dia
              </button>
              <button
                disabled={!meId || meId === user._id}
                onClick={() => meId && onSimulate(user._id, meId)}
                className="flex items-center gap-1.5 rounded-full border border-sky-500/50 px-3 py-1.5 text-xs font-bold text-sky-300 transition hover:bg-sky-500/10 disabled:opacity-40"
              >
                <UserPlus className="size-3" /> Dia add aku
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Request masuk sungguhan ke tab Request, notifikasi ikut muncul.
            </p>
          </>
        )}

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Moderasi
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {user.banned ? (
            <button
              onClick={() => onDialog("unban")}
              className="rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-bold text-emerald-300"
            >
              Unban
            </button>
          ) : (
            <button
              onClick={() => onDialog("ban")}
              className="flex items-center gap-1.5 rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-bold text-red-300"
            >
              <Ban className="size-3" /> Ban
            </button>
          )}
          {user.muted ? (
            <button
              onClick={() => onDialog("unmute")}
              className="rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-bold text-emerald-300"
            >
              Unmute
            </button>
          ) : (
            <button
              onClick={() => onDialog("mute")}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/50 px-3 py-1.5 text-xs font-bold text-amber-300"
            >
              <VolumeX className="size-3" /> Mute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const UNITS = [
  ["hari", "Hari"],
  ["minggu", "Minggu"],
  ["bulan", "Bulan"],
  ["tahun", "Tahun"],
] as const;

function ModerationDialog({
  kind,
  user,
  onClose,
  onSubmit,
}: {
  kind: "ban" | "mute";
  user: PanelUser;
  onClose: () => void;
  onSubmit: (p: {
    targetId: Id<"users">;
    kind: "ban" | "mute";
    args: {
      action: "ban" | "mute";
      permanent: boolean;
      value?: number;
      unit?: string;
      reason: string;
    };
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [value, setValue] = useState(1);
  const [unit, setUnit] = useState<string>("hari");
  const isBan = kind === "ban";
  const Icon = isBan ? Ban : VolumeX;
  const tone = isBan
    ? "border-red-500/50 bg-red-500/10 text-red-300"
    : "border-amber-500/50 bg-amber-500/10 text-amber-300";
  const valid = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="pop-enter w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background">
        <div className={cn("flex items-center gap-3 p-4", tone)}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-black/30">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {isBan ? "Ban" : "Mute"} — {user.username}
            </p>
            <p className="text-[10px] opacity-80">
              {isBan
                ? "User tidak bisa masuk akun dan langsung logout"
                : "User tidak bisa kirim chat, komen, foto, atau premium"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-1.5">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isBan ? "Pesan ban" : "Pesan mute"} (wajib)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                isBan
                  ? "Contoh: Destruction of public property, language abuse…"
                  : "Contoh: Spam chat, kirim link berlebihan…"
              }
              className="mt-1 w-full resize-none rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Durasi
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => setPermanent(false)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-xs font-bold transition",
                  !permanent
                    ? "border-violet-500 bg-violet-500/15 text-violet-200"
                    : "border-border text-muted-foreground",
                )}
              >
                Pakai Waktu
              </button>
              <button
                onClick={() => setPermanent(true)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-xs font-bold transition",
                  permanent
                    ? "border-red-500 bg-red-500/15 text-red-300"
                    : "border-border text-muted-foreground",
                )}
              >
                {isBan ? "Permanen" : "Selamanya"}
              </button>
            </div>
          </div>

          {!permanent && (
            <div className="fade-enter flex gap-2">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
              <div className="flex flex-1 flex-wrap gap-1.5">
                {UNITS.map(([u, label]) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      unit === u
                        ? "border-violet-500 bg-violet-500/15 text-violet-200"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground"
            >
              Batal
            </button>
            <button
              disabled={!valid}
              onClick={() =>
                void onSubmit({
                  targetId: user._id,
                  kind,
                  args: {
                    action: kind,
                    permanent,
                    value: permanent ? undefined : value,
                    unit: permanent ? undefined : unit,
                    reason: reason.trim(),
                  },
                })
              }
              className={cn(
                "flex-1 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-40",
                isBan ? "bg-red-600" : "bg-amber-600",
              )}
            >
              {isBan ? "Ban Sekarang" : "Mute Sekarang"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClanPremiumDialog({
  clans,
  onClose,
  onSubmit,
}: {
  clans: { _id: Id<"clans">; name: string; tag: string; members: number }[];
  onClose: () => void;
  onSubmit: (clanId: Id<"clans">, value: number, unit: string) => void | Promise<void>;
}) {
  const [clanId, setClanId] = useState<Id<"clans"> | null>(clans[0]?._id ?? null);
  const [value, setValue] = useState(1);
  const [unit, setUnit] = useState<string>("bulan");
  const [amount, setAmount] = useState("");

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="pop-enter w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex items-center gap-3 border-b border-border bg-amber-500/10 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-black/30">
            <Crown className="size-5 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Premium Clan</p>
            <p className="text-[10px] text-muted-foreground">
              Semua member clan langsung dapat premium
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-1.5">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pilih clan
            </label>
            <div className="thin-scroll mt-1.5 max-h-40 space-y-1 overflow-y-auto">
              {clans.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setClanId(c._id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                    clanId === c._id
                      ? "border-amber-400 bg-amber-400/15 text-amber-200"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <Sparkles className="size-3" />
                  <span className="flex-1 truncate font-semibold">{c.name}</span>
                  <span className="text-[10px]">{c.members} member</span>
                </button>
              ))}
              {clans.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada clan
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Durasi premium
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
              <div className="flex flex-1 flex-wrap gap-1.5">
                {UNITS.map(([u, label]) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      unit === u
                        ? "border-amber-400 bg-amber-400/15 text-amber-200"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nominal (catatan)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: Rp 150.000"
              className="mt-1 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground"
            >
              Batal
            </button>
            <button
              disabled={!clanId}
              onClick={() => clanId && void onSubmit(clanId, value, unit)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              <InfinityIcon className="size-3.5" /> Kirim Premium
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
