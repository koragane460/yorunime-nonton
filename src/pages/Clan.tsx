import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, Crown, Gem, Search, TrendingUp, Users, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useHideNavOnMount } from "@/components/AppLayout";
import { ClanLevelBar, ClanTag, clanNameClass } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON, PICKABLE_CLAN_ICONS } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Warna latar tag clan — pastel lembut supaya ikon & tulisan [TAG] tetap
 *  terbaca, tidak ngejreng. */
const TAG_BG_COLORS = [
  "#3b3f52", "#4a4560", "#5a4a5f", "#3f5163", "#45546a",
  "#54503f", "#4c5a4a", "#5f4a4a", "#4a4f5a", "#5a5560",
];

/** Layar clan utama: kalau belum punya clan tampil Browse+Top; kalau sudah
 *  punya tampil ringkas clan-nya, dan layar Buat Clan terpisah (?create=1). */
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
  if (membership) return <MyClanScreen />;
  return <JoinScreen />;
}

/* ====================================================================== */
/*  LAYAR JOIN / BROWSE CLAN — foto 4                                      */
/* ====================================================================== */

function JoinScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"semua" | "top">("semua");
  const [q, setQ] = useState("");
  const all = useQuery(api.clans.listClans, {});
  const requestJoin = useMutation(api.clans.requestJoin);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!all) return [];
    // Search: cocokkan nama ATAU tag clan.
    let out = all;
    const term = q.trim().toLowerCase();
    if (term) {
      out = out.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(term) ||
          c.tag?.toLowerCase().includes(term),
      );
    }
    // Tab "Top clan" = urut XP/Sacret, ambil 100 teratas.
    if (tab === "top") {
      out = [...out].sort((a: any, b: any) => (b.diamonds ?? 0) - (a.diamonds ?? 0)).slice(0, 100);
    }
    return out;
  }, [all, q, tab]);

  // Semua tab: 1-3 teratas tetap diberi highlight_di atas (clan teratas),
  // sisanya urutan biasa sesuai poin.
  const top3 = tab === "semua" ? list.slice(0, 3) : [];

  const join = async (clanId: string) => {
    if (!user) {
      navigate("/auth?returnTo=/clan");
      return;
    }
    setBusyId(clanId);
    try {
      await requestJoin({ clanId: clanId as never });
      toast.success("Permintaan gabung dikirim — tunggu dibuka leader");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal gabung");
    } finally {
      setBusyId(null);
    }
  };

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
            onClick={() => (user ? navigate("/clan?create=1") : navigate("/auth?returnTo=/clan?create=1"))}
            className="yn-btn-warm shrink-0 rounded-full px-4 py-2 text-xs font-bold"
          >
            + Buat
          </button>
        </div>

        {/* Tab Semua / Top clan */}
        <div className="flex gap-1 border-b border-white/10 pb-2">
          <button
            onClick={() => setTab("semua")}
            className={cn(
              "relative flex-1 pb-2 text-xs font-semibold",
              tab === "semua" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Semua
            {tab === "semua" && (
              <span className="absolute inset-x-6 bottom-0 h-0.5 rounded bg-primary" />
            )}
          </button>
          <button
            onClick={() => setTab("top")}
            className={cn(
              "relative flex-1 pb-2 text-xs font-semibold",
              tab === "top" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Top clan
            {tab === "top" && (
              <span className="absolute inset-x-6 bottom-0 h-0.5 rounded bg-primary" />
            )}
          </button>
        </div>

        {/* Kolom pencarian */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
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
            {list.map((c: any, i: number) => (
              <ClanRow
                key={c._id}
                clan={c}
                rank={tab === "top" ? i + 1 : top3.includes(c) ? top3.indexOf(c) + 1 : undefined}
                onJoin={() => void join(c._id)}
                busy={busyId === c._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Satu baris clan: kotak memanjang — gambar kiri, nama+tag+stats kanan, tombol Join. */
function ClanRow({
  clan: c,
  rank,
  onJoin,
  busy,
}: {
  clan: any;
  rank?: number;
  onJoin: () => void;
  busy?: boolean;
}) {
  const { user } = useAuth();
  const levelCost = c.levelCost ?? 100000;
  const progress = Math.min(100, ((c.levelProgress ?? 0) / levelCost) * 100);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card/70 p-3",
        rank === 1
          ? "border-gold/50"
          : rank === 2
            ? "border-zinc-400/40"
            : rank === 3
              ? "border-amber-600/40"
              : "border-border/70",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Foto profil clan SELALU tampil; nomor peringkat jadi lencana
            kecil di pojok foto supaya tetap enak dibaca. */}
        <span className="relative shrink-0">
          <img
            src={c.avatarUrl || ""}
            alt=""
            className="size-10 rounded-xl border border-white/10 object-cover"
          />
          {rank !== undefined && (
            <span
              className={cn(
                "absolute -bottom-1 -left-1 flex min-w-[18px] items-center justify-center rounded-full border px-1 py-px text-[9px] font-black leading-none",
                rank === 1
                  ? "border-yellow-300/50 bg-yellow-400 text-black"
                  : rank === 2
                    ? "border-zinc-200/60 bg-zinc-200 text-black"
                    : rank === 3
                      ? "border-amber-500/60 bg-amber-600 text-white"
                      : "border-white/20 bg-black/80 text-white",
              )}
            >
              {rank === 1 ? <Crown className="size-2.5" /> : rank}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn("truncate text-sm font-bold", clanNameClass(c.level))}>{c.name}</p>
            <ClanTag
              icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.tag}
              color={c.color}
              level={c.level}
              className="px-1.5 py-0 text-[9px]"
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {c.memberCount} member
            </span>
            <span className="inline-flex items-center gap-1">
              <Gem className="size-3 text-sky-300" /> {Number(c.diamonds ?? 0).toLocaleString("id-ID")}
            </span>
            <span>{c.ageDays ?? 0}h</span>
          </div>
        </div>
        <button
          onClick={onJoin}
          disabled={busy || c.isMine || c.isRequested || !user}
          className={cn(
            "shrink-0 rounded-xl px-3.5 py-1.5 text-[11px] font-bold transition",
            c.isMine
              ? "border border-border text-muted-foreground"
              : "yn-btn-warm active:scale-95 disabled:opacity-50",
          )}
        >
          {c.isMine ? "Milikmu" : c.isRequested ? "Diajukan" : busy ? "…" : user ? "Join" : "Login"}
        </button>
      </div>
      {/* Bar level di bawah nama+stats */}
      <div className="mt-2.5">
        <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
          <span>Lv.{c.level}</span>
          <span>
            {(c.levelProgress ?? 0).toLocaleString("id-ID")} / {levelCost.toLocaleString("id-ID")}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  LAYAR BUAT CLAN — terpisah (bukan sheet yang sama dengan Join)          */
/* ====================================================================== */

function CreateClan({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  useHideNavOnMount();
  const createClan = useMutation(api.clans.createClan);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  // Icon tag clan + foto profil — dulu kosong terus; sekarang dipilih di form.
  const [tagIcon, setTagIcon] = useState(DEFAULT_CLAN_ICON);
  // Background tag — warna pastel lembut (bukan ngejreng), opsional.
  // Default null = tanpa background (transparan).
  const [tagBg, setTagBg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [desc, setDesc] = useState("");
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
        description: desc.trim(),
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
          <h1 className="text-lg font-extrabold">Buat Clan</h1>
        </div>

        <div className="space-y-4">
          {/* Preview langsung: foto profil + nama + tag clan */}
          <div className="rounded-2xl border border-white/10 bg-card p-3">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">
              Preview clan kamu
            </p>
            <div className="flex items-center gap-3">
              {avatarUrl.trim() ? (
                <img
                  src={avatarUrl.trim()}
                  alt=""
                  className="size-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-secondary/40 text-muted-foreground">
                  <Users className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-bold", clanNameClass(1))}>
                  {name.trim() || "Nama clan"}
                </p>
                <ClanTag
                  icon={tagIcon}
                  tag={tag.toUpperCase() || "TAG"}
                  level={1}
                  bg={tagBg || undefined}
                  className="mt-1 px-1.5 py-0 text-[10px]"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clan-name">Nama clan</Label>
            <Input
              id="clan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. YoruNime"
              maxLength={28}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clan-tag">Tag clan (3-4 huruf)</Label>
            <Input
              id="clan-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="mis. YRNM"
              maxLength={5}
              className="font-mono"
            />
          </div>

          {/* Pilihan icon tag clan */}
          <div className="grid gap-2">
            <Label>Icon tag clan</Label>
            <div className="grid grid-cols-6 gap-2">
              {PICKABLE_CLAN_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => setTagIcon(ic.key)}
                  aria-label={ic.name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border transition",
                    tagIcon === ic.key
                      ? "border-primary bg-primary/15 ring-2 ring-primary/60"
                      : "border-white/10 bg-secondary/40 hover:border-foreground/40",
                  )}
                >
                  <ic.Icon className="size-5" style={{ color: ic.tone }} />
                </button>
              ))}
            </div>
          </div>

          {/* Background tag — warna pastel lembut, tidak ngejreng. */}
          <div className="grid gap-2">
            <Label>Background tag (opsional)</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTagBg(null)}
                aria-label="Tanpa background"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border text-[10px] transition",
                  tagBg === null
                    ? "border-primary ring-2 ring-primary/60"
                    : "border-white/15 text-muted-foreground hover:border-foreground/40",
                )}
              >
                ✕
              </button>
              {TAG_BG_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setTagBg(col)}
                  aria-label={`Background ${col}`}
                  style={{ backgroundColor: col }}
                  className={cn(
                    "size-9 rounded-full border transition",
                    tagBg === col
                      ? "border-foreground/70 ring-2 ring-primary/60"
                      : "border-white/15 hover:border-foreground/40",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clan-avatar">Foto profil clan (URL gambar, opsional)</Label>
            <Input
              id="clan-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/foto-clan.jpg"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clan-info">Deskripsi (opsional)</Label>
            <Input
              id="clan-info"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Hazem bareng, nonton bareng"
              maxLength={120}
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="yn-btn-warm w-full rounded-xl px-4 py-3 text-sm font-bold active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : "Buat Clan"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Membuat clan gratis. Wajib level 10+ kalau kembali ke fase pemula;
            Sacret clan dikumpulkan dari donasi harian.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  CLAN MILIK USER (ringkas)                                              */
/* ====================================================================== */

function MyClanScreen() {
  const navigate = useNavigate();
  const membership = useQuery(api.clans.myMembership, {});
  if (!membership?.clan) return null;
  const c = membership.clan as any;
  return (
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-lg font-extrabold">Clan kamu</h1>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-card/70">
          <img
            src={c.backgroundUrl || c.avatarUrl || ""}
            alt=""
            className="h-24 w-full object-cover"
          />
          <div className="p-3">
            <div className="flex items-center gap-3">
              <img src={c.avatarUrl || ""} alt="" className="size-12 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-bold", clanNameClass(c.level))}>{c.name}</p>
            <ClanTag
              icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.tag}
              color={c.color}
              level={c.level}
              bg={c.tagBg}
              className="px-1.5 py-0 text-[9px]"
            />
          </div>
        </div>
            <div className="my-3 h-px bg-white/10" />
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
              <div>
                <p className="text-base font-bold text-foreground">{c.level} Lv</p>
                Level
              </div>
              <div>
                <p className="inline-flex items-center gap-1 text-base font-bold text-foreground">
                  <Gem className="size-3.5 text-sky-300" />
                  {Number(c.diamonds ?? 0).toLocaleString("id-ID")}
                </p>
                Sacret
              </div>
              <div>
                <p className="inline-flex items-center gap-1 text-base font-bold text-foreground">
                  <Users className="size-3.5" />
                  {c.memberCount}
                </p>
                Member
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border/70 bg-card/70 p-3">
          <p className="mb-2 text-xs font-bold">Level clan</p>
          <ClanLevelBar
            level={c.level}
            progress={c.levelProgress ?? 0}
            cost={c.levelCost ?? 100000}
          />
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3.5 text-primary" />
            Donasi Sacret buat naik level clan
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          className="mt-6 w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground"
        >
          Kembali ke Home
        </button>
      </div>
    </div>
  );
}
