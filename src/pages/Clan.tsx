import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Camera,
  ChevronLeft,
  Crown,
  Gem,
  Search,
  Tag as TagIcon,
  Timer,
  Type,
  Users,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useHideNavOnMount } from "@/components/AppLayout";
import {
  Avatar,
  BlueCheck,
  ClanTag,
  LevelBadge,
  TitleBadge,
  clanNameClass,
} from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON, PICKABLE_CLAN_ICONS } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/* ====================================================================== */
/*  KONSTANTA TAMPILAN                                                     */
/* ====================================================================== */

/**
 * Warna latar tag clan — 5 cerah + 5 gelap, bergradasi antar warna
 * (merah → oranye → kuning → hijau → biru).
 */
const TAG_BG_COLORS = [
  // 5 cerah
  "#f472b6", "#fb923c", "#facc15", "#4ade80", "#60a5fa",
  // 5 agak gelap
  "#831843", "#7c2d12", "#713f12", "#14532d", "#1e3a8a",
];

/** Grade 1-6 ditampilkan dengan angka romawi. */
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/** Warna grade (latar transparan, outline tetap ada). */
const GRADE_CLS = [
  "", // grade 1 tidak pernah dipakai (index 0)
  "border-yellow-400/60 text-yellow-400", // I
  "border-zinc-300/60 text-zinc-300", // II
  "border-amber-600/60 text-amber-500", // III
  "border-sky-400/60 text-sky-400", // IV
  "border-violet-400/60 text-violet-400", // V
  "border-rose-500/60 text-rose-400", // VI
];

/** Title role clan — latar transparan, outline warna role. */
const ROLE_TITLE: Record<string, { name: string; cls: string }> = {
  leader: { name: "Leader", cls: "border-yellow-400/60 text-yellow-400" },
  officer: { name: "Officer", cls: "border-sky-400/60 text-sky-400" },
  victro: { name: "Victro", cls: "border-violet-400/60 text-violet-400" },
  hydler: { name: "Hydler", cls: "border-emerald-400/60 text-emerald-400" },
  member: { name: "Member", cls: "border-zinc-400/50 text-zinc-400" },
};

/** Badge grade: romawi + warna, background transparan dengan outline. */
function GradeBadge({ grade, className }: { grade: number; className?: string }) {
  const g = Math.min(6, Math.max(1, grade));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-black leading-[14px]",
        GRADE_CLS[g],
        className,
      )}
    >
      Grade {ROMAN[g - 1]}
    </span>
  );
}

/** Badge title role clan: latar transparan, outline mengikuti warna role. */
function ClanRoleTitle({ role, className }: { role?: string; className?: string }) {
  const def = ROLE_TITLE[role ?? "member"] ?? ROLE_TITLE.member;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-bold leading-[14px]",
        def.cls,
        className,
      )}
    >
      {def.name}
    </span>
  );
}

/** Garis pembatas pendek di tengah (kayak ngelewatin sedikit tulisan). */
function ShortDivider() {
  return <div className="mx-auto my-1.5 h-px w-24 bg-white/15" />;
}

/* ====================================================================== */
/*  ROUTER LAYAR CLAN                                                      */
/* ====================================================================== */

/** Layar clan utama: ?create=1 → Buat Clan; sudah punya clan → detail;
 *  belum → daftar clan (join). */
export default function Clan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useHideNavOnMount();

  const wantCreate = searchParams.get("create") === "1";
  const membership = useQuery(api.clans.myMembership, user ? {} : "skip");

  if (wantCreate) return <CreateClan onDone={() => setSearchParams({})} />;
  if (membership === undefined) {
    return (
      <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
        <div className="p-3">
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (membership?.clanId)
    return <ClanDetailScreen clanId={membership.clanId} onClose={() => navigate("/")} />;
  return <JoinScreen />;
}

/* ====================================================================== */
/*  LAYAR DAFTAR CLAN (JOIN)                                               */
/* ====================================================================== */

function JoinScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{
    id: string;
    tab: "member" | "donate";
  } | null>(null);
  const all = useQuery(api.clans.listClans, {});
  const requestJoin = useMutation(api.clans.requestJoin);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!all) return [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(term) || c.tag?.toLowerCase().includes(term),
    );
  }, [all, q]);

  const join = async (clanId: string) => {
    if (!user) {
      navigate("/auth?returnTo=/clan");
      return;
    }
    setBusyId(clanId);
    try {
      const r: any = await requestJoin({ clanId: clanId as never });
      toast.success(
        r?.requested
          ? "Permintaan gabung dikirim — tunggu dibuka leader"
          : "Permintaan dibatalkan",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal gabung");
    } finally {
      setBusyId(null);
    }
  };

  // Layar detail terbuka di atas daftar, langsung di tab yang ditekan
  // (tombol Member → tab Member, tombol Donate → tab Donate).
  if (pick) {
    return (
      <ClanDetailScreen
        clanId={pick.id as never}
        initialTab={pick.tab}
        onClose={() => setPick(null)}
        onJoin={() => void join(pick.id)}
        busy={busyId === pick.id}
      />
    );
  }

  return (
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="w-full p-3">
        {/* Header */}
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">Clan</h1>
          <button
            onClick={() =>
              user ? navigate("/clan?create=1") : navigate("/auth?returnTo=/clan?create=1")
            }
            className="yn-btn-warm shrink-0 rounded-full px-4 py-2 text-xs font-bold"
          >
            + Buat
          </button>
        </div>

        {/* Kolom pencarian */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau tag clan…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Bersihkan">
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Daftar clan */}
        {all === undefined ? (
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Tidak ada clan yang cocok.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5 pb-24">
            {list.map((c: any) => (
              <ClanRow
                key={c._id}
                clan={c}
                onOpen={(tab) => setPick({ id: c._id, tab })}
                onJoin={() => void join(c._id)}
                busy={busyId === c._id}
                loggedIn={!!user}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Satu baris clan di daftar: FOTO clan + nama & tag di kanannya, stats
 * tengah (orang/berlian/timer), bar level dalam kotak, lalu tombol Join
 * saja (tombol Member/Donate hanya ada di DETAIL). Menekan kartu membuka
 * detail clan.
 */
function ClanRow({
  clan: c,
  onOpen,
  onJoin,
  busy,
  loggedIn,
}: {
  clan: any;
  onOpen: (tab: "member" | "donate") => void;
  onJoin: () => void;
  busy?: boolean;
  loggedIn: boolean;
}) {
  const levelCost = c.levelCost ?? 100000;
  const progress = Math.min(100, ((c.levelProgress ?? 0) / levelCost) * 100);
  // Foto clan boleh gagal dimuat (link mati) — kalau gagal, langsung ganti
  // dengan kotak ikon supaya tidak pernah tampil sebagai teks rusak.
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
      {/* Foto clan (kiri) + nama & tag di kanannya */}
      <button onClick={() => onOpen("member")} className="flex w-full items-center gap-2.5 text-left">
        {c.avatarUrl && imgOk ? (
          <img
            src={c.avatarUrl}
            alt=""
            onError={() => setImgOk(false)}
            className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-secondary/40 text-muted-foreground">
            <Users className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-bold", clanNameClass(c.level))}>{c.name}</p>
          <div className="mt-0.5">
            <ClanTag
              icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.tag}
              color={c.color}
              level={c.level}
              className="scale-[0.85] px-1.5 py-0 text-[9px]"
            />
          </div>
        </div>
      </button>

      {/* Stats di tengah: orang · member, berlian · donate, timer · umur */}
      <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" /> {c.memberCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <Gem className="size-3 text-sky-300" /> {Number(c.diamonds ?? 0).toLocaleString("id-ID")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="size-3" /> {c.ageDays ?? 0} hari
        </span>
      </div>

      {/* Bar level dibungkus kotak satu baris, level di kiri */}
      <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
        <span className="shrink-0 text-[10px] font-black">Lv.{c.level}</span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-[9px] text-muted-foreground">
          {(c.levelProgress ?? 0).toLocaleString("id-ID")}/{levelCost.toLocaleString("id-ID")}
        </span>
      </div>

      {/* Tombol join / un-join */}
      <button
        onClick={onJoin}
        disabled={busy || c.isMine || !loggedIn}
        className={cn(
          "mt-2.5 w-full rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98]",
          c.isMine
            ? "border border-border text-muted-foreground"
            : "yn-btn-warm disabled:opacity-50",
        )}
      >
        {c.isMine ? "Milikmu" : c.isRequested ? "Batalkan request" : busy ? "…" : loggedIn ? "Join Clan" : "Login untuk Join"}
      </button>

      {/* Member/Donate TIDAK ditampilkan di daftar — hanya ada di detail
          clan (permintaan user: jangan kelihatan di list). */}
    </div>
  );
}

/* ====================================================================== */
/*  LAYAR DETAIL CLAN (dipakai buat clan sendiri & clan yang dilihat)      */
/* ====================================================================== */

function ClanDetailScreen({
  clanId,
  onClose,
  onJoin,
  busy,
  initialTab,
}: {
  clanId: string;
  onClose: () => void;
  onJoin?: () => void;
  busy?: boolean;
  initialTab?: "member" | "donate";
}) {
  const detail = useQuery(api.clans.clanDetail, { clanId: clanId as never });
  const claimDaily = useMutation(api.clans.claimDaily);
  const donateMut = useMutation(api.clans.donate);
  const [tab, setTab] = useState<"member" | "donate">(initialTab ?? "member");
  const [donateOpen, setDonateOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [busyAction, setBusyAction] = useState(false);

  if (!detail) {
    return (
      <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
        <div className="p-3">
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const c = detail.clan;
  const isMember = !!detail.myRole;
  const levelCost = c.levelCost ?? 100000;
  const progress = Math.min(100, ((c.levelProgress ?? 0) / levelCost) * 100);
  // Claim harian = dasar level + bonus +50 per grade.
  const claimable = (c.claimAmount ?? 100) + Math.max(0, (detail.myGrade ?? 1) - 1) * 50;

  const doClaim = async () => {
    setBusyAction(true);
    try {
      const r: any = await claimDaily({});
      toast.success(`Berhasil claim ${r?.amount?.toLocaleString("id-ID")} berlian`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal claim");
    } finally {
      setBusyAction(false);
    }
  };

  const doDonate = async () => {
    const finalAmt = custom.trim() ? Number(custom.trim()) : amount;
    if (!finalAmt || finalAmt < 50) {
      toast.error("Minimal 50 berlian");
      return;
    }
    setBusyAction(true);
    try {
      await donateMut({ amount: finalAmt });
      toast.success(`Donasi ${finalAmt.toLocaleString("id-ID")} berlian terkirim ✓`);
      setDonateOpen(false);
      setCustom("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal donasi");
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="w-full p-3">
        {/* Header */}
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">Detail Clan</h1>
        </div>

        {/* Kotak header clan: foto, nama, tag, bar level + level, stats */}
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <div className="flex items-center gap-3">
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-secondary/40 text-muted-foreground">
                <Users className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-base font-bold", clanNameClass(c.level))}>{c.name}</p>
              <ClanTag
                icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
                tag={c.tag}
                color={c.color}
                level={c.level}
                className="mt-1 px-1.5 py-0 text-[9px]"
              />
            </div>
          </div>

          {/* Bar level dalam kotak satu baris, level di kiri */}
          <div className="mt-2.5 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span className="shrink-0 text-[11px] font-black">Lv.{c.level}</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[9px] text-muted-foreground">
              {(c.levelProgress ?? 0).toLocaleString("id-ID")}/{levelCost.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Member · total donate · umur clan */}
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {c.memberCount} member
            </span>
            <span className="inline-flex items-center gap-1">
              <Gem className="size-3.5 text-sky-300" />{" "}
              {Number(c.diamonds ?? 0).toLocaleString("id-ID")} donasi
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3.5" /> {c.ageDays ?? 0} hari
            </span>
          </div>
        </div>

        {/* Bukan member: tombol Join / Batalkan request */}
        {!isMember && onJoin && (
          <button
            onClick={onJoin}
            disabled={busy}
            className="yn-btn-warm mt-3 w-full rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "…" : "Join Clan"}
          </button>
        )}

        {/* Member: kotak claim harian + tombol donate */}
        {isMember && (
          <div className="mt-3 rounded-2xl border border-gold/25 bg-white/[0.03] p-4 text-center">
            <Gem className="mx-auto size-8 text-sky-300" aria-hidden />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Total berlian harian yang bisa di-claim
            </p>
            <p className="text-lg font-black text-sky-300">
              {claimable.toLocaleString("id-ID")}
            </p>
            <button
              onClick={() => void doClaim()}
              disabled={busyAction || detail.myClaimedToday}
              className={cn(
                "mt-2 w-full rounded-xl py-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-60",
                detail.myClaimedToday
                  ? "border border-white/15 text-muted-foreground"
                  : "yn-btn-warm",
              )}
            >
              {detail.myClaimedToday ? "Sudah claim" : "Claim"}
            </button>

            <button
              onClick={() => setDonateOpen((v) => !v)}
              className="mt-2 w-full rounded-xl border border-sky-400/40 bg-sky-400/10 py-2 text-xs font-bold text-sky-300 transition active:scale-[0.98]"
            >
              Donate
            </button>

            {/* Pilihan nominal donate 100-1000 + kolom bebas */}
            {donateOpen && (
              <div className="mt-3 space-y-2 text-left">
                <div className="grid grid-cols-5 gap-1.5">
                  {[100, 200, 300, 500, 1000].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setAmount(n);
                        setCustom("");
                      }}
                      className={cn(
                        "rounded-lg border py-1.5 text-[11px] font-bold transition",
                        !custom.trim() && amount === n
                          ? "border-sky-400 bg-sky-400/15 text-sky-300"
                          : "border-white/12 text-zinc-300",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="isi nominal sendiri…"
                  className="h-9 text-center"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void doDonate()}
                    disabled={busyAction}
                    className="yn-btn-warm rounded-xl py-2 text-xs font-bold active:scale-[0.98] disabled:opacity-50"
                  >
                    {busyAction ? "…" : "Donate"}
                  </button>
                  <button
                    onClick={() => setDonateOpen(false)}
                    className="rounded-xl border border-white/15 py-2 text-xs font-bold text-muted-foreground"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Member | Donate — TANPA kotak rounded sama sekali: hanya
            teks dengan GARIS PUTIH di bawahnya; tab aktif garisnya penuh. */}
        <div className="mt-3 flex gap-5 border-b border-white/10">
          <button
            onClick={() => setTab("member")}
            className={cn(
              "relative pb-2 text-xs font-bold transition",
              tab === "member"
                ? "text-white"
                : "text-muted-foreground hover:text-white/80",
            )}
          >
            Member
            {tab === "member" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
            )}
          </button>
          <button
            onClick={() => setTab("donate")}
            className={cn(
              "relative pb-2 text-xs font-bold transition",
              tab === "donate"
                ? "text-white"
                : "text-muted-foreground hover:text-white/80",
            )}
          >
            Donate
            {tab === "donate" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
            )}
          </button>
        </div>

        {/* Isi tab */}
        <MemberDonateList
          tab={tab}
          members={detail.members as any[]}
          todayTotal={detail.todayDonationsTotal ?? 0}
          todayDonators={detail.todayDonators ?? 0}
          myRole={detail.myRole}
          leaderId={(detail as any).leaderId}
          clanTag={c.tag}
          clanTagIcon={c.tagIcon}
          clanLevel={c.level}
        />
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  ISI TAB MEMBER / DONATE                                                */
/* ====================================================================== */

function MemberDonateList({
  tab,
  members,
  todayTotal,
  todayDonators,
  myRole,
  leaderId,
  clanTag,
  clanTagIcon,
  clanLevel,
}: {
  tab: "member" | "donate";
  members: any[];
  todayTotal: number;
  todayDonators: number;
  myRole?: string;
  leaderId?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanLevel?: number;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const list = useMemo(() => {
    let out = members;
    if (term) {
      out = out.filter(
        (m: any) =>
          m.username?.toLowerCase().includes(term) ||
          String(m.seqId ?? "").includes(term.replace("#", "")),
      );
    }
    if (tab === "donate") out = [...out].sort((a: any, b: any) => b.donatedToday - a.donatedToday);
    return out;
  }, [members, term, tab]);

  return (
    <>
      {/* Kolom cari member (nama atau id akun) — SELALU di atas, termasuk
          di tab Donate (kotak Terkumpul ada di bawahnya). */}
      <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari member (nama / id akun)…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Bersihkan">
            <X className="size-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Kotak ringkasan donasi hari ini (tab Donate) — di BAWAH kolom cari */}
      {tab === "donate" && (
        <div className="mt-2.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-center text-[11px] font-bold text-sky-200">
          Terkumpul {todayTotal.toLocaleString("id-ID")} Berlian Hari Ini Dari{" "}
          {todayDonators} Member Donate
        </div>
      )}

      {/* Grid ke bawah: satu baris per member */}
      <div className="mt-2.5 space-y-2 pb-6">
        {list.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {term ? "Member tidak ditemukan." : "Belum ada member."}
          </p>
        ) : (
          list.map((m: any) => (
            <MemberRow
              key={m.userId}
              m={m}
              tab={tab}
              myRole={myRole}
              isLeader={m.userId === leaderId}
              clanTag={clanTag}
              clanTagIcon={clanTagIcon}
              clanLevel={clanLevel}
            />
          ))
        )}
      </div>
    </>
  );
}

/** Satu baris member: foto kiri (+title di bawah foto), identitas kanan
 *  (username, badge, title, centang biru / tag clan / grade), donasi di
 *  paling kanan. */
function MemberRow({
  m,
  tab,
  myRole,
  isLeader,
  clanTag,
  clanTagIcon,
  clanLevel,
}: {
  m: any;
  tab: "member" | "donate";
  myRole?: string;
  isLeader?: boolean;
  clanTag?: string;
  clanTagIcon?: string;
  clanLevel?: number;
}) {
  void myRole;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-card/70 p-2.5">
      {/* Foto profil + title role di bawahnya */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <Avatar src={m.image} seed={m.username} className="size-11" />
        {isLeader ? (
          <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-yellow-400">
            <Crown className="size-2.5" aria-hidden /> LEADER
          </span>
        ) : (
          <ClanRoleTitle role={m.role} />
        )}
      </div>

      {/* Identitas: username+badge+title+centang, tag clan, grade */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-bold text-white">{m.username ?? "user"}</span>
          {typeof m.level === "number" && <LevelBadge level={m.level} />}
          <TitleBadge role={m.staffRole} compact />
          {m.premium && <BlueCheck className="size-3.5 shrink-0" />}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {clanTag && (
            <ClanTag
              icon={clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={clanTag}
              level={clanLevel}
              className="scale-[0.8] px-1.5 py-0 text-[9px]"
            />
          )}
          <GradeBadge grade={m.grade ?? 1} />
        </div>
      </div>

      {/* Donasi di paling kanan */}
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-sky-300">
          <Gem className="size-3.5" aria-hidden />
          {Number(m.donatedTotal ?? 0).toLocaleString("id-ID")}
        </span>
        {tab === "donate" && m.donatedToday > 0 && (
          <p className="text-[9px] font-semibold text-emerald-400">
            +{m.donatedToday.toLocaleString("id-ID")} hari ini
          </p>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  LAYAR BUAT CLAN                                                        */
/* ====================================================================== */

/** Perkecil foto clan sebelum di-upload — dokumen Convex maksimal 1MB. */
async function shrinkClanAvatar(file: File, maxSide = 480): Promise<Blob> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
  if (raw.length < 300_000) return await (await fetch(raw)).blob();
  try {
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
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.82),
    );
  } catch {
    return await (await fetch(raw)).blob();
  }
}

function CreateClan({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  useHideNavOnMount();
  const createClan = useMutation(api.clans.createClan);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [tagIcon, setTagIcon] = useState(DEFAULT_CLAN_ICON);
  const [tagBg, setTagBg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  // Foto clan dari GALERI: file di-upload ke penyimpanan Convex, lalu URL
  // publiknya dipakai sebagai avatarUrl (bukan link PNG tempelan).
  const [avatarSid, setAvatarSid] = useState<string | null>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  const avatarPubUrl = useQuery(
    api.storage.getUrl,
    avatarSid ? { storageId: avatarSid } : "skip",
  );
  useEffect(() => {
    if (avatarPubUrl) setAvatarUrl(avatarPubUrl);
  }, [avatarPubUrl]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || tag.trim().length < 2) {
      toast.error("Nama wajib dan tag minimal 2 karakter");
      return;
    }
    setBusy(true);
    try {
      await createClan({
        name: name.trim(),
        tag: tag.toUpperCase(),
        tagIcon,
        tagBg: tagBg ?? undefined,
        avatarUrl: avatarUrl.trim(),
      });
      toast.success("Clan dibuat — level 1, kumpulkan Sacret bareng!");
      onDone();
      navigate("/clan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat clan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onDone}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold">Buat Clan</h1>
            <p className="text-[11px] text-muted-foreground">
              Bikin tim bareng teman — biaya 1.000 Sacret
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* ===== KOTAK PREVIEW — bingkai gradasi, tampil lebih hidup ===== */}
          <div className="rounded-2xl bg-gradient-to-r from-gold/40 via-primary/40 to-sky-400/40 p-px shadow-[0_0_24px_-12px_rgba(212,175,55,0.6)]">
            <div className="rounded-[15px] bg-card px-3 pb-3 pt-3">
              <p className="text-center text-[11px] font-bold tracking-[0.2em] text-muted-foreground">
                PREVIEW
              </p>
              <ShortDivider />
              {/* Isi preview: foto di kiri pas tengah, garis lurus full di
                  kanannya, lalu nama clan + pill "Tag clan" + kotak tag */}
              <div className="flex items-stretch gap-3">
                {avatarUrl.trim() ? (
                  <img
                    src={avatarUrl.trim()}
                    alt=""
                    className="my-auto size-16 shrink-0 rounded-2xl object-cover ring-2 ring-gold/40"
                  />
                ) : (
                  <span className="my-auto flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-secondary to-secondary/40 text-muted-foreground">
                    <Users className="size-7" />
                  </span>
                )}
                <div className="w-px shrink-0 bg-white/12" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">Nama Clan</p>
                  <p className={cn("truncate font-bold", clanNameClass(1))}>
                    {name.trim() || "Nama clan"}
                  </p>
                  <span className="mt-1.5 inline-flex items-center rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
                    Tag clan
                  </span>
                  <div className="mt-1.5">
                    <ClanTag
                      icon={tagIcon}
                      tag={tag.toUpperCase() || "TAG"}
                      level={1}
                      bg={tagBg || undefined}
                      className="px-1.5 py-0 text-[10px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== 3 KOTAK INPUT — tiap kotak punya ikon warna sendiri ===== */}
          <div className="space-y-2.5">
            {/* Ganti photo profile clan dari GALERI (bukan link PNG): foto
                langsung di-upload ke penyimpanan dan tampil di preview. */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-card p-3">
              <span className="relative block size-16 shrink-0">
                <span
                  aria-hidden
                  className="yn-ring-spin absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#fbbf24,#f472b6,#818cf8,#34d399,#fbbf24)]"
                />
                <span className="absolute inset-[3px] overflow-hidden rounded-[13px] bg-background">
                  {avatarUrl.trim() ? (
                    <img
                      src={avatarUrl.trim()}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <Users className="size-6" />
                    </span>
                  )}
                </span>
                <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-[3px] border-card bg-gradient-to-br from-gold to-amber-600 text-black">
                  <Camera className="size-3.5" aria-hidden />
                </span>
              </span>
              <label className="group min-w-0 flex-1 cursor-pointer">
                <span className="block text-xs">Ganti photo profile</span>
                <span className="mt-1.5 inline-flex rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-bold text-gold transition group-hover:bg-gold/20">
                  {busyAvatar ? "Mengunggah…" : "Pilih dari galeri"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busyAvatar}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setBusyAvatar(true);
                    void (async () => {
                      try {
                        const blob = await shrinkClanAvatar(f);
                        const uploadUrl = await getUploadUrl();
                        const res = await fetch(uploadUrl, {
                          method: "POST",
                          headers: { "Content-Type": blob.type || "image/jpeg" },
                          body: blob,
                        });
                        if (!res.ok) throw new Error("Upload gagal");
                        const { storageId } = (await res.json()) as {
                          storageId: string;
                        };
                        setAvatarSid(storageId);
                        toast.success("Foto clan terunggah ✨");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Gagal unggah foto",
                        );
                      } finally {
                        setBusyAvatar(false);
                      }
                    })();
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-card p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Type className="size-[18px] text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor="clan-name" className="mb-1.5 block text-xs">
                  Isi nama clan
                </Label>
                <Input
                  id="clan-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. YoruNime"
                  maxLength={28}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-card p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <TagIcon className="size-[18px] text-emerald-300" />
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor="clan-tag" className="mb-1.5 block text-xs">
                  Isi tag clan (nama)
                </Label>
                <Input
                  id="clan-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="mis. YRNM"
                  maxLength={5}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* ===== KOTAK ICON TAG CLAN ===== */}
          <div className="rounded-2xl border border-white/10 bg-card px-3 pb-3 pt-3">
            <p className="text-center text-[11px] font-bold text-muted-foreground">
              Icon Tag Clan
            </p>
            <ShortDivider />
            <div className="grid grid-cols-6 gap-2">
              {PICKABLE_CLAN_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => setTagIcon(ic.key)}
                  aria-label={ic.name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full border transition hover:scale-110",
                    tagIcon === ic.key
                      ? "scale-110 border-primary ring-2 ring-primary/60 shadow-[0_0_12px_-2px_var(--tw-shadow-color,rgba(244,63,94,0.6))]"
                      : "border-white/10",
                  )}
                  style={{
                    backgroundColor: `${ic.tone}26`,
                    borderColor: tagIcon === ic.key ? undefined : `${ic.tone}66`,
                  }}
                >
                  <ic.Icon
                    className="size-5"
                    style={{ color: ic.tone }}
                    fill="currentColor"
                    strokeWidth={1.4}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* ===== KOTAK BACKGROUND TAG — 10 kotak gradasi antar warna,
              5 cerah di baris atas + 5 agak gelap di baris bawah ===== */}
          <div className="rounded-2xl border border-white/10 bg-card px-3 pb-3 pt-3">
            <p className="text-center text-[11px] font-bold text-muted-foreground">
              Background Tag
            </p>
            <ShortDivider />
            <div className="grid grid-cols-5 gap-2">
              {TAG_BG_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setTagBg(col)}
                  aria-label={`Background ${col}`}
                  style={{ backgroundColor: col }}
                  className={cn(
                    "aspect-square rounded-lg border transition hover:scale-110",
                    tagBg === col
                      ? "scale-110 border-foreground/80 ring-2 ring-primary/60"
                      : "border-white/10",
                  )}
                />
              ))}
            </div>
          </div>

          {/* ===== TOMBOL BUAT & BATAL ===== */}
          <div className="grid grid-cols-2 gap-2 pb-6">
            <button
              onClick={() => void submit()}
              disabled={busy}
              className="yn-btn-warm rounded-xl py-3 text-sm font-bold active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Buat Clan"}
            </button>
            <button
              onClick={onDone}
              className="rounded-xl border border-white/15 py-3 text-sm font-bold text-muted-foreground"
            >
              Batal
            </button>
          </div>
          <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Membuat clan gratis. Wajib level 10+ kalau kembali ke fase pemula;
            Sacret clan dikumpulkan dari donasi harian.
          </p>
        </div>
      </div>
    </div>
  );
}
