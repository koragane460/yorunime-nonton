import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { StripBackIcon } from "@/components/StripBack";
import {
  Camera,
  ChevronLeft,
  Crown,
  LogIn,
  Plus,
  Search,
  Shield,
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
  SacretIcon,
  TitleBadge,
  clanNameClass,
} from "@/components/lstream-ui";
import {
  DEFAULT_CLAN_ICON,
  PICKABLE_CLAN_ICONS,
  resolveClanIcon,
} from "@/lib/clanIcons";
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

/**
 * AKSEN SUDUT EMAS — garis L kecil miring di pojok kiri-atas & kanan-bawah
 * kartu ungu (gaya referensi). Sengaja KECIL dan hanya di dua sudut supaya
 * dekoratif, bukan membungkus seluruh kartu.
 */
function GoldCorners({ size = 14 }: { size?: number }) {
  const s = { width: size, height: size } as const;
  return (
    // inset kecil supaya garis L tidak terpotongrounded corner kartu
    // (dulu inset-0 → setengah aksen hilang kena border-radius + overflow-hidden).
    <span aria-hidden className="pointer-events-none absolute inset-[4px]">
      <span
        className="absolute left-0 top-0 border-l-2 border-t-2 border-gold/75"
        style={s}
      />
      <span
        className="absolute bottom-0 right-0 border-b-2 border-r-2 border-gold/75"
        style={s}
      />
    </span>
  );
}

/** Ranting sakura emas — dekorasi kiri & kanan atas layar Buat Clan. */
function BlossomBranch({
  className,
  id = "ycl",
  flip = false,
}: {
  className?: string;
  id?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 160 96"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <g id={`${id}-bl`}>
          <circle cx="0" cy="-4" r="2.7" />
          <circle cx="3.8" cy="-1.2" r="2.7" />
          <circle cx="2.4" cy="3.4" r="2.7" />
          <circle cx="-2.4" cy="3.4" r="2.7" />
          <circle cx="-3.8" cy="-1.2" r="2.7" />
        </g>
      </defs>
      <g stroke={`url(#${id}-g)`} strokeWidth="1.4" strokeLinecap="round">
        <path d="M0 6 C 34 10, 66 22, 96 52" />
        <path d="M34 13 C 46 26, 52 42, 54 60" />
        <path d="M66 25 C 84 30, 104 34, 128 34" />
        <path d="M14 8 C 20 22, 22 36, 20 52" />
      </g>
      <g fill={`url(#${id}-g)`}>
        <use href={`#${id}-bl`} transform="translate(96 52)" />
        <use href={`#${id}-bl`} transform="translate(54 62) scale(0.85)" />
        <use href={`#${id}-bl`} transform="translate(130 34) scale(0.9)" />
        <use href={`#${id}-bl`} transform="translate(20 54) scale(0.75)" />
        <use href={`#${id}-bl`} transform="translate(70 27) scale(0.7)" />
      </g>
      <g fill="#fff7d6">
        <circle cx="96" cy="52" r="1.8" />
        <circle cx="54" cy="62" r="1.5" />
        <circle cx="130" cy="34" r="1.6" />
      </g>
    </svg>
  );
}

/* ====================================================================== */
/*  ROUTER LAYAR CLAN                                                      */
/* ====================================================================== */

/** Layar clan utama: ?create=1 → Buat Clan; sudah punya clan → detail;
 *  belum → daftar clan (join). */
export default function Clan() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useHideNavOnMount();

  const wantCreate = searchParams.get("create") === "1";
  /** YoruVerse › Clan membuka detail clan langsung lewat ?clan=<id>. */
  const wantClan = searchParams.get("clan");
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
  if (wantClan)
    return <ClanDetailScreen clanId={wantClan} onClose={() => setSearchParams({})} />;
  // Punya clan TETAP lewat daftar clan dulu — di tengah atas ada kotak
  // "clan kamu sendiri" (foto, tag, nama, stats, level) yang bisa dipencet
  // untuk membuka detail clan.
  return <JoinScreen ownClanId={membership?.clanId ?? undefined} />;
}

/* ====================================================================== */
/*  LAYAR DAFTAR CLAN (JOIN)                                               */
/* ====================================================================== */

function JoinScreen({ ownClanId }: { ownClanId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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

  /** Clan SENDIRI — ditampilkan sebagai kotak khusus di tengah ATAS. */
  const ownClan = useMemo(
    () =>
      all?.find((c: any) => c._id === ownClanId) ??
      all?.find((c: any) => c.isMine) ??
      null,
    [all, ownClanId],
  );

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
            className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg yn-title">Cari clan</h1>
        </div>

        {/* KOTAK CLAN KAMU SENDIRI — di TENGAH ATAS, hanya muncul kalau
            punya clan. Isi: foto profile, tag clan, nama clan, stats clan,
            dan level — dipencet → langsung ke detail clan. */}
        {ownClan && (
          <button
            onClick={() => setPick({ id: ownClan._id, tab: "member" })}
            className="mx-auto flex w-full flex-col items-center gap-2 rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.14] via-white/[0.05] to-transparent px-4 py-5 text-center transition hover:border-gold/60 active:scale-[0.99]"
          >
            {ownClan.avatarUrl ? (
              <img
                src={ownClan.avatarUrl}
                alt=""
                className="size-16 shrink-0 rounded-2xl object-cover ring-2 ring-gold/60"
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-black/40">
                <Shield className="size-8 text-violet-300" aria-hidden />
              </span>
            )}
            <ClanTag
              icon={ownClan.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={ownClan.tag}
              color={ownClan.color}
              level={ownClan.level}
              className="px-2 py-0.5 text-[10px]"
            />
            <p className={cn("text-lg font-black", clanNameClass(ownClan.level))}>
              {ownClan.name}
            </p>
            {/* Stats clan: member · Sacret · umur */}
            <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-white/75">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" /> {ownClan.memberCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <SacretIcon className="size-3.5 text-sky-300" />{" "}
                {Number(ownClan.diamonds ?? 0).toLocaleString("id-ID")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3.5" /> {ownClan.ageDays ?? 0} hari
              </span>
            </div>
            {/* Bar level clan */}
            <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5">
              <span className="shrink-0 text-[11px] font-black text-gold">
                Lv.{ownClan.level}
              </span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                  style={{
                    width: `${Math.min(100, ((ownClan.levelProgress ?? 0) / (ownClan.levelCost ?? 100000)) * 100)}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-[9px] text-white/55">
                {(ownClan.levelProgress ?? 0).toLocaleString("id-ID")}/
                {(ownClan.levelCost ?? 100000).toLocaleString("id-ID")}
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gold/70">
              Ketuk untuk buka clan ▾
            </span>
          </button>
        )}

        {/* KOTAK HERO — ikon clan di tengah + tulisan di bawahnya.
            Hanya untuk yang BELUM punya clan. */}
        {!ownClan && (
        <div className="flex flex-col items-center rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.14] via-white/[0.04] to-transparent px-4 py-7 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-black/40">
            <Shield className="size-8 text-violet-300" aria-hidden />
          </span>
          <p className="mt-3 text-xl font-black text-white">Clan kamu nanti di sini</p>
          <p className="mt-1 text-xs text-zinc-400">
            gabung, donasi, dan bawa clan mu ke puncak Top Clan
          </p>
        </div>
        )}

        {/* DUA TOMBOL — lurus ke samping, tidak tinggi. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            onClick={() =>
              user ? navigate("/clan?create=1") : navigate("/auth?returnTo=/clan?create=1")
            }
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] py-3.5 text-sm font-extrabold text-white transition hover:bg-white/10 active:scale-[0.98]"
          >
            <Plus className="size-4 text-emerald-300" aria-hidden />
            Buat clan
          </button>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] py-3.5 text-sm font-extrabold text-white transition hover:bg-white/10 active:scale-[0.98]"
          >
            <LogIn className="size-4 text-sky-300" aria-hidden />
            Join clan
          </button>
        </div>

        {/* Kolom cari — MUNCUL setelah tombol Join clan dipencet. */}
        {searchOpen && (
          <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Cari clan dengan nama atau tag clan…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Bersihkan">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

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
 *
 * EXPORT — dipakai juga oleh YoruVerse › Clan supaya tampilannya persis
 * sama dengan daftar clan di sini (permintaan pemilik).
 */
export function ClanRow({
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
              className="zoom-[0.85] px-1.5 py-0 text-[9px]"
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
          <SacretIcon className="size-3 text-sky-300" /> {Number(c.diamonds ?? 0).toLocaleString("id-ID")}
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

      {/* Tombol join / un-join — request tertunda memakai warna HIJAU
          "Batalkan Request" (permintaan user), selain itu tombol hangat. */}
      <button
        onClick={onJoin}
        disabled={busy || c.isMine || !loggedIn}
        className={cn(
          "mt-2.5 w-full rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98]",
          c.isMine
            ? "border border-border text-muted-foreground"
            : c.isRequested
              ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_-6px_rgba(52,211,153,0.9)]"
              : "yn-btn-warm disabled:opacity-50",
        )}
      >
        {c.isMine ? "Milikmu" : c.isRequested ? "Batalkan Request" : busy ? "…" : loggedIn ? "Join Clan" : "Login untuk Join"}
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
  const respondReq = useMutation(api.clans.respondRequest);
  const setRoleMut = useMutation(api.clans.setRole);
  const setDescription = useMutation(api.clans.setDescription);
  const [tab, setTab] = useState<"member" | "donate">(initialTab ?? "member");
  const [donateOpen, setDonateOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  // Panel PENGATURAN CLAN (khusus leader/officer): request masuk + role +
  // deskripsi. Terbuka lewat tombol gerigi di header.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"request" | "role">("request");
  const [descDraft, setDescDraft] = useState<string | null>(null);
  // Tombol REQUEST JOIN di bawah kotak clan — jalan walau layar dibuka
  // langsung lewat ?clan=<id> (tanpa onJoin dari daftar).
  const requestJoinMut = useMutation(api.clans.requestJoin);
  const [joinBusy, setJoinBusy] = useState(false);
  const doRequestJoin = async () => {
    if (joinBusy) return;
    setJoinBusy(true);
    try {
      const r: any = await requestJoinMut({ clanId: clanId as never });
      toast.success(
        r?.requested
          ? "Permintaan gabung dikirim — tunggu dibuka leader"
          : "Permintaan dibatalkan",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal gabung");
    } finally {
      setJoinBusy(false);
    }
  };

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
  const canManage = detail.myRole === "leader" || detail.myRole === "officer";
  const pending = (detail.requests ?? []) as any[];
  // Permintaan join yang masih menunggu — tombol berubah jadi "Batalkan
  // Request" (hijau) dan tetap bisa dipencet, sama seperti di daftar clan.
  const isRequested = detail.myRequestClanId === clanId;
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
            className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg yn-title">Detail Clan</h1>
          {/* Tombol PENGATURAN CLAN — hanya untuk leader/officer: kelola
              request masuk + role member + deskripsi clan. */}
          {canManage && (
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Pengaturan clan"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition hover:bg-gold/20"
            >
              <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>

        {/* Kotak header clan — TANPA bungkus kotak (TRANSAPAN): foto +
            nama + tag di kiri, STATS di kanan atas, deskripsi, lalu bar
            level. (permintaan user) */}
        <div className="p-1">
          <div className="flex items-start gap-3">
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
            {/* STATS dibungkus background kotak di KANAN ATAS */}
            <div className="grid shrink-0 grid-cols-1 gap-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-[10px]">
              <span className="inline-flex items-center justify-end gap-1.5 text-muted-foreground">
                <Users className="size-3" /> {c.memberCount} member
              </span>
              <span className="inline-flex items-center justify-end gap-1.5 text-sky-300">
                <SacretIcon className="size-3 shrink-0" /> {Number(c.diamonds ?? 0).toLocaleString("id-ID")}
              </span>
              <span className="inline-flex items-center justify-end gap-1.5 text-muted-foreground">
                <Timer className="size-3" /> {c.ageDays ?? 0} hari
              </span>
            </div>
          </div>

          {/* DESKRIPSI CLAN — berada DI ATAS bar level (sesuai permintaan) */}
          {(c as any).description ? (
            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
              {(c as any).description}
            </p>
          ) : null}

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
        </div>

        {/* Bukan member: tombol REQUEST JOIN / Batalkan Request (hijau) —
            selalu tampil di bawah kotak clan, walau dibuka tanpa onJoin. */}
        {!isMember && (
          <button
            onClick={() => (onJoin ? onJoin() : void doRequestJoin())}
            disabled={busy || joinBusy}
            className={cn(
              "mt-3 w-full rounded-xl py-3 text-sm font-bold active:scale-[0.98] disabled:opacity-50",
              isRequested
                ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_-6px_rgba(52,211,153,0.9)]"
                : "yn-btn-warm",
            )}
          >
            {busy || joinBusy ? "…" : isRequested ? "Batalkan Request" : "Request Join"}
          </button>
        )}

        {/* Member: kotak claim harian + tombol donate */}
        {isMember && (
          <div className="mt-3 rounded-2xl border border-gold/25 bg-white/[0.03] p-4 text-center">
            <SacretIcon className="mx-auto size-8 text-sky-300" aria-hidden />
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

        {/* Tab Member | Donate — TANPA background, hanya tulisan putih
            dengan GARIS PUTIH DI BAWAH tab aktif (permintaan user). */}
        <div className="mt-5 flex items-stretch gap-6 border-b border-white/15">
          <button
            onClick={() => setTab("member")}
            className={cn(
              "relative flex-1 pb-2.5 pt-1 text-center text-sm font-black transition",
              tab === "member"
                ? "text-white"
                : "text-muted-foreground hover:text-white/85",
            )}
          >
            Member
            {tab === "member" && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white shadow-[0_0_8px_1px_rgba(255,255,255,.6)]"
                aria-hidden
              />
            )}
          </button>
          <button
            onClick={() => setTab("donate")}
            className={cn(
              "relative flex-1 pb-2.5 pt-1 text-center text-sm font-black transition",
              tab === "donate"
                ? "text-white"
                : "text-muted-foreground hover:text-white/85",
            )}
          >
            Donate
            {tab === "donate" && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white shadow-[0_0_8px_1px_rgba(255,255,255,.6)]"
                aria-hidden
              />
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

      {/* ================= PENGATURAN CLAN (leader/officer) ================= */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal>
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="pop-enter relative w-full max-h-[85vh] overflow-hidden rounded-t-2xl border-t border-white/15 bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Crown className="size-4 text-gold" />
              <p className="text-sm font-bold">Pengaturan Clan</p>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Tutup"
                className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Sub-tab: Request masuk | Role & deskripsi */}
            <div className="flex gap-6 border-b border-white/10 px-4">
              {(["request", "role"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSettingsTab(t)}
                  className={cn(
                    "relative flex items-center gap-1.5 py-2.5 text-[13px] font-bold transition",
                    settingsTab === t ? "text-white" : "text-muted-foreground",
                  )}
                >
                  {t === "request" ? "Request Masuk" : "Role & Deskripsi"}
                  {t === "request" && pending.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] font-black text-white">
                      {pending.length}
                    </span>
                  )}
                  {settingsTab === t && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-gold to-amber-400" />
                  )}
                </button>
              ))}
            </div>

            <div className="thin-scroll max-h-[65vh] overflow-y-auto p-4">
              {settingsTab === "request" ? (
                pending.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Belum ada permintaan masuk.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {pending.map((r) => (
                      <div
                        key={r.requestId}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                      >
                        <Avatar src={r.image} seed={r.username} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.username}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.level ? `Lv.${r.level}` : "Ingin bergabung"}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await respondReq({ requestId: r.requestId, accept: true });
                              toast.success(`${r.username} diterima masuk clan`);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Gagal");
                            }
                          }}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30"
                        >
                          Terima
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await respondReq({ requestId: r.requestId, accept: false });
                              toast.success("Permintaan ditolak");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Gagal");
                            }
                          }}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/30"
                        >
                          Tolak
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {/* Deskripsi clan */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Deskripsi clan</Label>
                    <textarea
                      value={descDraft ?? (c as any).description ?? ""}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={3}
                      placeholder="Ceritakan tentang clan kamu…"
                      className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/30 p-3 text-sm outline-none focus:border-gold/60"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await setDescription({ text: descDraft ?? "" });
                          toast.success("Deskripsi clan disimpan");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
                        }
                      }}
                      className="yn-btn-warm mt-2 w-full rounded-xl py-2.5 text-xs font-bold"
                    >
                      Simpan deskripsi
                    </button>
                  </div>

                  {/* Role member */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Role member</Label>
                    <div className="mt-2 space-y-2">
                      {(detail.members as any[])
                        .filter((m) => m.userId !== (detail as any).leaderId)
                        .map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2"
                          >
                            <Avatar src={m.image} seed={m.username} className="size-8" />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                              {m.username}
                            </span>
                            <select
                              value={m.role}
                              onChange={async (e) => {
                                try {
                                  await setRoleMut({
                                    targetId: m.userId,
                                    role: e.target.value as any,
                                  });
                                  toast.success(`Role ${m.username} → ${e.target.value}`);
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Gagal");
                                }
                              }}
                              className="rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-[11px] font-bold text-white outline-none"
                            >
                              {[
                                ["officer", "Officer"],
                                ["victro", "Victro"],
                                ["hydler", "Hydler"],
                                ["member", "Member"],
                              ].map(([v2, label]) => (
                                <option key={v2} value={v2}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
          /* Chip LEADER: dulu outline saja tanpa latar — sekarang ada
             background emas gradasi + ring tipis supaya menonjol. */
          <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-yellow-500/30 to-amber-600/30 px-1.5 py-0.5 text-[8px] font-black text-yellow-300 ring-1 ring-yellow-400/50">
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
        <div className="mt-1 flex items-center gap-1">
          {clanTag && (
            /* zoom (bukan scale) — zoom ikut mengubah layout, jadi jarak ke
               badge Grade tidak menyisakan sisa ruang tak terpakai. */
            <ClanTag
              icon={clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={clanTag}
              level={clanLevel}
              className="zoom-[0.85] px-2 py-0 text-[9px]"
            />
          )}
          <GradeBadge grade={m.grade ?? 1} />
        </div>
      </div>

      {/* Donasi di paling kanan */}
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-sky-300">
          <SacretIcon className="size-3.5" aria-hidden />
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
  // Ikon tag dipakai di PREVIEW — warnanya mengikuti warna tag yang dipilih
  // (fallback ke warna bawaan ikonnya).
  const { Icon: TagIc, tone: tagTone } = resolveClanIcon(tagIcon);

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
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-[#0a0714]">
      {/* Latar ungu-emas: bintik berkelip, orb gradasi, dan ranting sakura
          emas di kiri & kanan atas (gaya referensi). */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1.3px)] [background-size:26px_26px] opacity-20" />
        <span className="absolute -left-24 top-8 size-72 rounded-full bg-fuchsia-600/25 blur-3xl" />
        <span className="absolute -right-24 bottom-20 size-72 rounded-full bg-violet-600/25 blur-3xl" />
        <BlossomBranch id="ycl-l" className="absolute left-0 top-0 h-24 w-40" />
        <BlossomBranch id="ycl-r" className="absolute right-0 top-0 h-24 w-40" flip />
      </div>
      <div className="relative w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onDone}
            aria-label="Kembali"
            className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <div>
            <h1 className="text-lg yn-title">Buat Clan</h1>
            <p className="text-[11px] text-violet-300/85">
              Bikin tim bareng teman — biaya 1.000 Sacret
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* ===== KOTAK PREVIEW — kartu ungu + aksen sudut emas ===== */}
          <div className="relative overflow-hidden rounded-[6px] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3 shadow-[0_18px_40px_-24px_rgba(168,85,247,0.6)]">
            <GoldCorners />
            <p className="text-center text-[10px] font-black tracking-[0.3em] text-gold/85">
              — PREVIEW —
            </p>
            {/* Isi preview: foto kotak di kiri, nama + pill tag + kotak tag
                berbingkai emas di kanannya. */}
            <div className="mt-3 flex items-stretch gap-3">
              {avatarUrl.trim() ? (
                <img
                  src={avatarUrl.trim()}
                  alt=""
                  className="my-auto size-16 shrink-0 rounded-xl border border-gold/50 object-cover"
                />
              ) : (
                <span className="my-auto flex size-16 shrink-0 items-center justify-center rounded-xl border border-gold/50 bg-[#241640] text-white/75">
                  <Users className="size-7" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-violet-300/75">Nama Clan</p>
                <p className="truncate text-sm font-black text-gold">
                  {name.trim() || "Nama clan"}
                </p>
                <span className="mt-1.5 inline-flex items-center rounded-full border border-gold/45 bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold text-gold/90">
                  Tag clan
                </span>
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-black/45 px-2 py-1">
                    <TagIc
                      className="size-3.5"
                      style={{ color: tagBg ?? tagTone }}
                      fill="currentColor"
                      strokeWidth={1.4}
                    />
                    <span className="text-[11px] font-black italic tracking-wider text-white">
                      [{tag.toUpperCase() || "TAG"}]
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== DUA KOTAK FORM BERDAMPINGAN — kartu ungu + aksen sudut
              emas, persis gaya referensi. ===== */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* KIRI — photo profile + nama clan */}
            <div className="relative overflow-hidden rounded-[6px] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3">
              <GoldCorners />
              <p className="text-center text-[11px] font-black text-white/85">
                Ganti photo profile
              </p>
              <label
                htmlFor="clan-avatar-file"
                className="group relative mx-auto mt-3 block size-16 cursor-pointer"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-[linear-gradient(160deg,#fbbf24,#f59e0b_50%,#d97706)]"
                />
                <span className="absolute inset-[3px] overflow-hidden rounded-[13px] bg-[#241640]">
                  {avatarUrl.trim() ? (
                    <img
                      src={avatarUrl.trim()}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-white/55">
                      <Users className="size-6" />
                    </span>
                  )}
                </span>
                <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-[3px] border-[#1b1133] bg-gradient-to-br from-gold to-amber-600 text-black">
                  <Camera className="size-3.5" aria-hidden />
                </span>
              </label>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-violet-200/85">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
                  <Type className="size-3" />
                </span>
                Isi nama clan
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. YoruNime"
                maxLength={28}
                aria-label="Isi nama clan"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-xs font-bold text-white outline-none placeholder:text-white/35 focus:border-gold/50"
              />
              <label
                htmlFor="clan-avatar-file"
                className="mt-2.5 block cursor-pointer rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 py-2 text-center text-[11px] font-black text-black shadow-[0_8px_20px_-14px_rgba(251,191,36,0.9)] transition hover:brightness-110"
              >
                {busyAvatar ? "Mengunggah…" : "Pilih dari galeri"}
              </label>
              {/* Foto clan dari GALERI: di-upload ke penyimpanan Convex,
                  URL publiknya langsung tampil di preview. */}
              <input
                id="clan-avatar-file"
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
            </div>

            {/* KANAN — tag clan + pilihan warna background tag */}
            <div className="relative overflow-hidden rounded-[6px] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3">
              <GoldCorners />
              <p className="text-center text-[11px] font-black text-white/85">
                Isi tag clan
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-violet-200/85">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <TagIcon className="size-3" />
                </span>
                Isi tag clan (nama)
              </p>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="mis. YRNM"
                maxLength={5}
                aria-label="Isi tag clan"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-xs font-bold uppercase text-white outline-none placeholder:text-white/35 focus:border-gold/50"
              />
              <p className="mt-3 text-center text-[10px] font-black tracking-[0.2em] text-gold/85">
                BACKGROUND TAG
              </p>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {TAG_BG_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setTagBg(col)}
                    aria-label={`Background ${col}`}
                    style={{ backgroundColor: col }}
                    className={cn(
                      "aspect-square rounded-md border transition hover:scale-110",
                      tagBg === col
                        ? "scale-110 border-white ring-2 ring-gold/70"
                        : "border-white/15",
                    )}
                  />
                ))}
              </div>
              {tagBg && (
                <button
                  type="button"
                  onClick={() => setTagBg(null)}
                  className="mt-2 w-full rounded-md border border-white/12 py-1 text-[9px] font-bold text-white/55 transition hover:border-white/25"
                >
                  Pakai warna bawaan
                </button>
              )}
            </div>
          </div>

          {/* ===== KOTAK ICON TAG CLAN ===== */}
          <div className="relative overflow-hidden rounded-[6px] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-3 pb-3 pt-3">
            <GoldCorners />
            <p className="text-center text-[10px] font-black tracking-[0.3em] text-gold/85">
              — ICON TAG CLAN —
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {PICKABLE_CLAN_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => setTagIcon(ic.key)}
                  aria-label={ic.name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full border transition hover:scale-110",
                    tagIcon === ic.key
                      ? "scale-110 border-gold ring-2 ring-gold/60 shadow-[0_0_14px_-3px_rgba(251,191,36,0.9)]"
                      : "border-white/12 hover:border-gold/40",
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

          {/* Background Tag sudah pindah ke dalam kotak kanan (berdampingan
              dengan input tag) supaya tata letaknya persis seperti referensi. */}


          {/* ===== TOMBOL BUAT & BATAL ===== */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => void submit()}
              disabled={busy}
              className="rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-sm font-black text-black shadow-[0_12px_28px_-16px_rgba(251,191,36,0.95)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Buat Clan"}
            </button>
            <button
              onClick={onDone}
              className="rounded-xl border border-white/15 bg-white/[0.05] py-3 text-sm font-black text-white/85 transition hover:border-gold-strong/45 hover:bg-gold-strong/10 active:scale-[0.98]"
            >
              Batal
            </button>
          </div>
          {/* Syarat "level 10+" DIHAPUS — satu-satunya biaya adalah
              1.000 Sacret, ditulis jelas di paling bawah layar. */}
          <p className="pb-6 pt-1 text-center text-[12px] font-bold text-gold/90">
            Dengan 1.000 Sacret
          </p>
        </div>
      </div>
    </div>
  );
}
