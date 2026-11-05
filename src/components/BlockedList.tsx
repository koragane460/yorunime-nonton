import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  EyeOff,
  FileText,
  Lightbulb,
  Lock,
  MoreVertical,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

/**
 * DAFTAR BLOKIR — layar penuh dari Pengaturan.
 * Privasi komunitas, statistik, pencarian, chip kategori, kartu pengguna
 * yang diblokir, sheet buka blokir, bukti laporan, dan hapus catatan
 * (dengan countdown 5 detik).
 */

type BlockedUser = {
  userId: string;
  username: string;
  image?: string;
  reason?: string;
  category?: string;
  animeTitle?: string;
  episode?: number;
  evidence?: string;
  createdAt: number;
};

const FILTERS = ["Semua", "Spoiler", "Toxic", "Seksual", "Menghina"] as const;
type Filter = (typeof FILTERS)[number];

const LABEL: Record<string, string> = {
  Spoiler: "Spoiler",
  Toxic: "Toxic/Spam",
  Seksual: "Seksual",
  Menghina: "Menghina",
};

function fmtDate(ts: number) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function BlockedList({ onClose }: { onClose: () => void }) {
  const rows = useQuery(api.activities.listBlocked) as BlockedUser[] | undefined;
  const unblock = useMutation(api.activities.unblockUser);
  const removeRecord = useMutation(api.activities.deleteBlockRecord);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("Semua");
  const [menu, setMenu] = useState<string | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<BlockedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockedUser | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Hitung mundur 5 detik sebelum tombol Setuju aktif.
  useEffect(() => {
    if (!deleteTarget) return;
    setCountdown(5);
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [deleteTarget]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Semua: rows?.length ?? 0 };
    for (const r of rows ?? []) {
      const k = r.category ?? "Menghina";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const key = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (filter !== "Semua" && (r.category ?? "Menghina") !== filter) return false;
      if (key && !r.username.toLowerCase().includes(key)) return false;
      return true;
    });
  }, [rows, q, filter]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 2600);
  };

  const doUnblock = async () => {
    if (!unblockTarget || busy) return;
    setBusy(true);
    try {
      await unblock({ userId: unblockTarget.userId as never });
      setUnblockTarget(null);
      showFlash("Blokir sudah dibuka");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await removeRecord({ userId: deleteTarget.userId as never });
      const name = deleteTarget.username;
      setDeleteTarget(null);
      showFlash(`@${name} dihapus permanen dari daftar blokir`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-background">
      {/* HEADER */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] text-white/70"
        >
          <ChevronLeft className="size-4.5" />
        </button>
        <h2 className="text-[17px] font-black tracking-tight">Daftar Blokir</h2>
        <span className="ml-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-black text-white/60">
          {counts.Semua ?? 0}
        </span>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-28">
        {/* KARTU PRIVASI KOMUNITAS */}
        <div className="mt-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1CA7EC]/30 text-[#8fd8fb]">
              <ShieldCheck className="size-5" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-black text-white">
              Privasi Komunitas
            </p>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FFD23F]/30 px-2 py-1 text-[9px] font-black text-[#ffe89a]">
              <Lock className="size-3" /> Terlindungi
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">
            Pengguna dalam daftar ini tidak dapat melihat komentar Anda,
            membalas ulasan, atau mengirimkan notifikasi interaksi apapun.
          </p>
        </div>

        {/* JUDUL + STATISTIK */}
        <div className="mt-4 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black">Daftar Blokir</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2">
              <Search className="size-4 shrink-0 text-white/35" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari username yang diblokir…"
                className="w-full bg-transparent text-[11.5px] font-semibold text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>
          <div className="flex w-[132px] shrink-0 gap-1.5">
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
              <p className="text-[15px] font-black leading-none text-white">
                {counts.Semua ?? 0}
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase leading-tight text-white/40">
                Pengguna
              </p>
            </div>
            <div className="flex-1 rounded-xl border border-[#E84855]/25 bg-[#E84855]/10 p-2 text-center">
              <p className="text-[15px] font-black leading-none text-[#ff9aa4]">
                {counts.Semua ?? 0}
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase leading-tight text-[#ff9aa4]/70">
                Blokir Aktif
              </p>
            </div>
          </div>
        </div>

        {/* CHIP FILTER */}
        <div className="thin-scroll -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1.5 text-[10.5px] font-black transition",
                filter === f
                  ? "border-[#1CA7EC]/60 bg-[#1CA7EC]/20 text-[#9fdcfb]"
                  : "border-white/10 bg-white/[0.03] text-white/45",
              )}
            >
              {LABEL[f] ?? f}{" "}
              <span className="opacity-70">[{counts[f] ?? 0}]</span>
            </button>
          ))}
        </div>

        {/* DAFTAR */}
        {rows === undefined ? (
          <p className="py-8 text-center text-xs text-white/40">Memuat…</p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-white/40">
            {q
              ? "Username tidak ada di daftar blokir."
              : "Belum ada pengguna yang diblokir."}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {shown.map((b) => (
              <div
                key={b.userId}
                className="relative rounded-2xl border border-white/10 bg-white/[0.035] p-2.5"
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar gelap + ikon blokir */}
                  <span className="relative shrink-0">
                    <Avatar src={b.image} seed={b.username} className="size-12" />
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/80 text-white/85">
                      <Ban className="size-5" />
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#FFD23F]/20 text-[#FFD23F]">
                        <TriangleAlert className="size-3" />
                      </span>
                      <p className="truncate text-[13px] font-black text-white">
                        {b.username}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] font-bold text-[#7fd3f7]">
                      @{b.username}
                    </p>
                  </div>

                  <button
                    onClick={() => setMenu((m) => (m === b.userId ? null : b.userId))}
                    aria-label="Opsi"
                    className="relative z-20 flex size-7 shrink-0 items-center justify-center rounded-full text-white/50 active:bg-white/10"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </div>

                {/* Alasan dari laporan */}
                <div className="mt-2 rounded-xl bg-white/[0.05] px-2.5 py-1.5 text-[10.5px] font-bold text-white/70">
                  {b.category
                    ? LABEL[b.category] ?? b.category
                    : b.reason
                      ? b.reason
                      : "Diblokir manual"}
                  {b.reason && b.category && b.reason !== b.category ? (
                    <span className="text-white/35"> · {b.reason}</span>
                  ) : null}
                </div>

                <p className="mt-1.5 truncate text-[9.5px] text-white/35">
                  Diblokir pada {fmtDate(b.createdAt)}
                  {b.animeTitle
                    ? ` • ${b.animeTitle}${b.episode ? ` Episode ${b.episode}` : ""}`
                    : ""}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40">
                    <EyeOff className="size-3.5" /> Tersembunyi
                  </span>
                  <button
                    onClick={() => setUnblockTarget(b)}
                    className="rounded-full border border-[#1CA7EC]/45 bg-[#1CA7EC]/10 px-3 py-1.5 text-[10.5px] font-black text-[#9fdcfb] transition active:scale-95"
                  >
                    Buka Blokir
                  </button>
                </div>

                {/* MENU TITIK TIGA */}
                {menu === b.userId && (
                  <>
                    <span
                      className="fixed inset-0 z-20"
                      onClick={() => setMenu(null)}
                    />
                    <div className="pop-enter absolute right-2 top-9 z-30 w-44 overflow-hidden rounded-xl border border-white/12 bg-[#12161f] shadow-xl">
                      <button
                        onClick={() => {
                          setMenu(null);
                          setEvidenceTarget(b);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11.5px] font-semibold text-white/80 active:bg-white/10"
                      >
                        <ShieldCheck className="size-3.5 text-[#7fd3f7]" /> Bukti
                        Laporan
                      </button>
                      <button
                        onClick={() => {
                          setMenu(null);
                          setDeleteTarget(b);
                        }}
                        className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[11.5px] font-semibold text-[#ff8a94] active:bg-white/10"
                      >
                        <Trash2 className="size-3.5" /> Hapus catatan
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TIPS */}
        <div className="mt-4 rounded-2xl border border-[#FFD23F]/20 bg-[#FFD23F]/[0.06] p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#FFD23F]/15 text-[#FFD23F]">
              <Lightbulb className="size-4" />
            </span>
            <p className="text-[12px] font-black text-[#ffe89a]">
              Tips Pemblokiran Cepat
            </p>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/45">
            Ingin memblokir pengguna baru? Anda dapat mengetuk ikon opsi [•••]
            pada setiap komentar di pemutar video lalu pilih &apos;Blokir
            Pengguna&apos;.
          </p>
        </div>
      </div>

      {/* --- Sheet BUKA BLOKIR (40%) --- */}
      {unblockTarget && (
        <div className="fixed inset-0 z-[160] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="pop-enter flex h-[40vh] w-full flex-col rounded-t-3xl border-t border-white/12 bg-[#0f131b] p-4">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#1CA7EC]/20 text-[#7fd3f7]">
              <Lock className="size-5" />
            </span>
            <p className="mt-3 text-[15px] font-black text-white">
              Buka Blokir Pengguna?
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">
              Pengguna @{unblockTarget.username} akan dapat kembali berinteraksi
              di ruang publik.
            </p>
            <div className="mt-auto flex gap-2">
              <button
                onClick={() => setUnblockTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-3 text-[12px] font-bold text-white/70"
              >
                Batal
              </button>
              <button
                disabled={busy}
                onClick={() => void doUnblock()}
                className="flex-1 rounded-xl bg-[#1CA7EC] py-3 text-[12px] font-black text-white disabled:opacity-60"
              >
                {busy ? "Memproses…" : "Buka blokir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Sheet BUKTI LAPORAN (30%) --- */}
      {evidenceTarget && (
        <div className="fixed inset-0 z-[160] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="pop-enter flex h-[30vh] w-full flex-col rounded-t-3xl border-t border-white/12 bg-[#0f131b] p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <ShieldCheck className="size-5" />
              </span>
              <p className="text-[13.5px] font-black text-white">
                Bukti Catatan Laporan
              </p>
              <button
                onClick={() => setEvidenceTarget(null)}
                aria-label="Tutup"
                className="ml-auto flex size-7 items-center justify-center rounded-full bg-white/10 text-white/60"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="thin-scroll mt-2.5 min-h-0 flex-1 overflow-y-auto rounded-xl bg-black/60 p-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                Target Pelanggaran
              </p>
              <p className="text-[11.5px] font-bold text-[#7fd3f7]">
                @{evidenceTarget.username}
              </p>
              <p className="mt-1.5 text-[10.5px] text-white/55">
                Kategori:{" "}
                {evidenceTarget.category
                  ? LABEL[evidenceTarget.category] ?? evidenceTarget.category
                  : evidenceTarget.reason ?? "—"}
              </p>
              {evidenceTarget.evidence && (
                <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[10.5px] italic leading-relaxed text-white/45">
                  “{evidenceTarget.evidence}”
                </p>
              )}
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-white/35">
              Log cuplikan komentar telah diarsipkan secara otomatis oleh sistem
              YoruNime Moderation Engine untuk menjaga integritas komunitas
              tontonan Anda.
            </p>
            <button
              onClick={() => setEvidenceTarget(null)}
              className="mt-2 rounded-xl bg-white/10 py-2.5 text-[11.5px] font-black text-white/80"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* --- Popup HAPUS CATATAN --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="pop-enter w-full max-w-[300px] rounded-3xl border border-white/12 bg-[#0f131b] p-4 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E84855]/15 text-[#ff8a94]">
              <Trash2 className="size-7" />
            </span>
            <p className="mt-3 text-[13.5px] font-black text-white">
              Apakah kamu yakin ingin menghapus catatan?
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/45">
              Menghapus catatan akan menghilangkan pengguna dari daftar blokir
              secara permanen.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-[11.5px] font-bold text-white/70"
              >
                Batal
              </button>
              <button
                disabled={countdown > 0 || busy}
                onClick={() => void doDelete()}
                className="flex-1 rounded-xl bg-[#E84855] py-2.5 text-[11.5px] font-black text-white disabled:opacity-45"
              >
                {countdown > 0 ? `Setuju (${countdown})` : "Setuju"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Toast bawah beranimasi --- */}
      {flash && (
        <div className="pop-enter fixed bottom-6 left-1/2 z-[190] -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-[#10231c] px-3.5 py-2.5 text-[11.5px] font-bold text-emerald-200 shadow-xl">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4" /> {flash}
          </span>
        </div>
      )}
    </div>
  );
}
