import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useMutation, useQuery, useAction } from "convex/react";
import { ChatPanel } from "@/components/ChatPanel";
import { useFastChat } from "@/hooks/use-fast-chat";
import { useHideNavOnMount, useHideNavWhile } from "@/components/AppLayout";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import {
  Avatar,
  ClanLevelBar,
  ClanTag,
} from "@/components/lstream-ui";
import {
  ChevronLeft,
  Gem,
  Inbox,
  Info,
  LogOut,
  Radio,
  Search,
  Settings,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAN_PIXEL_ICONS, clanPixelIconUrl, DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

// Logo tag clan = gambar pixel (bukan emoji), semua sama ukuran & gaya.
const TAG_ICONS = CLAN_PIXEL_ICONS.map((i) => i.key);
const DONATE_PRESETS = [100, 200, 300, 500, 700, 1000];
const ROLE_INFO = `Info Roles
1. Leader : leader mempunyai akses penuh dalam mengatur peraturan clan apapun itu
2. Officer : Officer membantu leader seperti kick member, accept request, dan lainnya
3. Victro : Memberi peringatan keras kepada member yang melanggar peraturan clan yang sudah ditetapkan
4. Hydler : Memantau kondisi chat clan apabila terjadi kerusuhan`;

const ROLE_BADGE_CLS: Record<string, string> = {
  leader: "from-yellow-300 to-amber-500 text-black",
  officer: "from-green-400 to-emerald-600 text-white",
  victro: "from-purple-400 to-purple-600 text-white",
  hydler: "from-sky-300 to-sky-500 text-black",
  member: "from-zinc-400 to-zinc-600 text-white",
};

const ROLE_LABEL: Record<string, string> = {
  leader: "LEADER",
  officer: "OFFICER",
  victro: "VICTRO",
  hydler: "HYDLER",
  member: "MEMBER",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn("role-badge", `role-badge-${role}`)}>
      {ROLE_LABEL[role] ?? role.toUpperCase()}
    </span>
  );
}

function formatK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.floor(n / 1000)}K`;
  return String(n);
}

export default function ClanPage() {
  return (
    <AppLayout hideAccountPanel>
      <ClanContent />
    </AppLayout>
  );
}

function ClanContent() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const my = useQuery(api.clans.myMembership, user ? {} : "skip");
  // Setelah buat clan: langsung tampilkan chat clan pakai ID dari hasil create
  // sampai data membership baru keluar dari server (anti balik ke list clan).
  const [freshClanId, setFreshClanId] = useState<Id<"clans"> | null>(null);

  if (my === undefined && !freshClanId)
    return <p className="py-20 text-center text-sm text-muted-foreground">Memuat…</p>;

  if (my) return <ClanHub clanId={my.clanId as Id<"clans">} />;
  if (freshClanId) return <ClanHub clanId={freshClanId} />;
  return (
    <NoClan
      initialCreate={params.get("buat") === "1"}
      onCreated={(id) => setFreshClanId(id)}
    />
  );
}

// --------------------------------------------------------- belum join ----

function NoClan({
  initialCreate,
  onCreated,
}: {
  initialCreate?: boolean;
  onCreated?: (clanId: Id<"clans">) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"none" | "buat" | "gabung">(
    initialCreate ? "buat" : "none",
  );
  const clans = useQuery(api.clans.listClans, {});
  const requestJoin = useMutation(api.clans.requestJoin);
  // Clan yang sedang kita-request → tombolnya jadi centang hijau.
  const myPending = useQuery(
    api.clans.myPendingClanId,
    user ? {} : "skip",
  );
  const [detailId, setDetailId] = useState<Id<"clans"> | null>(null);
  const back = useNavigate();
  // Daftar clan = layar fullscreen (navbar bawah & mini player disembunyikan)
  useHideNavOnMount();
  // Lihat clan dari list = fullscreen juga (navbar & mini player hilang)
  useHideNavWhile(detailId !== null);

  if (detailId)
    return <ClanDetail clanId={detailId} onBack={() => setDetailId(null)} viewerNotMember />;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="Kembali"
            onClick={() => back("/home")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-violet-500/60 hover:text-violet-300"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Daftar Clan ({(clans ?? []).length})
          </p>
        </div>
        <button
          onClick={() => setMode("buat")}
          className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-500"
        >
          + Buat Clan
        </button>
      </div>

      {/* List clan langsung tampil di atas — bisa dilihat & join tanpa buka layar lain */}
      <div className="mt-3 space-y-2">
          {(clans ?? []).length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Belum ada clan. Jadilah yang pertama!
            </p>
          )}
          {(clans ?? []).map((c: any) => (
            <div
              key={c._id}
              className="member-row cursor-pointer p-3 transition hover:border-[oklch(0.86_0.16_90)]/40"
              onClick={() => setDetailId(c._id as Id<"clans">)}
            >
              <div className="flex items-center gap-3">
                <Avatar src={c.avatarUrl} seed={c.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <ClanTag icon={c.tagIcon} tag={c.tag} color={c.color} className="mt-0.5" />
                  <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                    <span>👥 {c.memberCount} member</span>
                    <span className="text-violet-300">💎 {c.diamonds} Sacret</span>
                    <span>🕰 {c.ageDays} hari</span>
                  </div>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const r = await requestJoin({ clanId: c._id as Id<"clans"> });
                      toast.success(r.requested ? "Request terkirim" : "Request dibatalkan");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Gagal request");
                    }
                  }}
                  aria-label={myPending === c._id ? "Batalkan request" : "Join clan"}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
                    myPending === c._id
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "bg-violet-600 text-white hover:bg-violet-500",
                  )}
                >
                  {myPending === c._id ? (
                    <Check className="size-5" strokeWidth={3} />
                  ) : (
                    <span className="text-xs font-bold">Join</span>
                  )}
                </button>
              </div>
            </div>
          ))}
      </div>

      {mode === "buat" && (
        <CreateClan
          onCancel={() => setMode("none")}
          onCreated={(id) => {
            setMode("none");
            onCreated?.(id); // → ClanContent langsung render chat clan
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ buat clan ----

function CreateClan({
  onCreated,
  onCancel,
}: {
  onCreated: (clanId: Id<"clans">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.clans.createClan);
  const createRoom = useMutation(api.watchroom.createRoom);
  const [icon, setIcon] = useState(TAG_ICONS[0]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  // Room nonton bareng untuk clan (opsional).
  const [roomOn, setRoomOn] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomQ, setRoomQ] = useState("");
  const [roomResults, setRoomResults] = useState<any[] | null>(null);
  const [roomAnime, setRoomAnime] = useState<any>(null);
  const [roomEp, setRoomEp] = useState("1");
  const [roomAccess, setRoomAccess] = useState<"clan" | "selected">("clan");
  const [roomPicked, setRoomPicked] = useState<any[]>([]);
  const [uQ, setUQ] = useState("");
  const searchAnime = useAction(api.anime.animeSearch);
  const userResults = useQuery(
    api.watchroom.searchUsers,
    uQ.trim().length > 0 ? { q: uQ } : "skip",
  );
  useHideNavOnMount(); // fullscreen: navbar & mini player hilang total

  useEffect(() => {
    if (roomQ.trim().length < 2) {
      setRoomResults(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = (await searchAnime({ q: roomQ.trim() })) as any[];
        if (alive) setRoomResults(r ?? []);
      } catch {
        if (alive) setRoomResults([]);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [roomQ, searchAnime]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-3">
      <div className="w-full">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onCancel} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Buat Clan</h1>
        </div>

        <div className="clan-hero-gradient rounded-3xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar src={avatar || undefined} seed={name || "clan"} className="size-16" />
            <div>
              <p className="font-bold">{name || "Nama Clan"}</p>
              <ClanTag icon={icon} tag={tag || "TAG"} className="mt-1" />
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 py-2 text-xs text-indigo-200/70 hover:border-[oklch(0.86_0.16_90)]">
            Custom photo profile
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setAvatar(String(reader.result));
                reader.readAsDataURL(f);
              }}
            />
          </label>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-card p-4">
          <p className="mb-2 text-xs text-muted-foreground">Logo tag clan (pixel)</p>
          <div className="grid grid-cols-5 gap-2">
            {CLAN_PIXEL_ICONS.map((ic) => (
              <button
                key={ic.key}
                type="button"
                aria-label={ic.name}
                title={ic.name}
                onClick={() => setIcon(ic.key)}
                className={cn(
                  "flex aspect-square items-center justify-center overflow-hidden rounded-xl border p-1.5 transition",
                  icon === ic.key
                    ? "border-[oklch(0.86_0.16_90)] bg-[oklch(0.86_0.16_90)]/15"
                    : "border-border hover:border-[oklch(0.86_0.16_90)]/50",
                )}
              >
                <img
                  src={clanPixelIconUrl(ic.key) ?? ""}
                  alt={ic.name}
                  className="size-full rounded-md object-cover [image-rendering:pixelated]"
                />
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <img
              src={clanPixelIconUrl(icon) ?? ""}
              alt="Logo"
              className="size-6 shrink-0 rounded-md [image-rendering:pixelated]"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Custom nama clan"
              className="flex-1 rounded-full border border-input bg-background/60 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="Custom nama tag clan (3-4 huruf)"
            className="mt-2 w-full rounded-full border border-input bg-background/60 px-3 py-2 text-sm"
          />
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Membuat clan butuh <b className="text-[oklch(0.86_0.16_90)]">1000 Sacret</b>
        </p>

        {/* ------------------------------------------------ Room Nobar ---- */}
        <div className="mt-3 rounded-3xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-violet-300" />
            <p className="flex-1 text-xs font-bold">Buat Room Nonton Bareng</p>
            <button
              onClick={() => setRoomOn((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition",
                roomOn ? "bg-violet-600" : "bg-zinc-700",
              )}
              aria-label="Aktifkan room nobar"
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                  roomOn ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>

          {roomOn && (
            <div className="fade-enter mt-3 space-y-2.5">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Nama room (mis. Nobar clan malam ini)"
                className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm"
              />

              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={roomQ}
                  onChange={(e) => setRoomQ(e.target.value)}
                  placeholder="Cari anime buat nobar…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              {roomAnime ? (
                <div className="flex items-center gap-2 rounded-xl border border-violet-500/50 bg-violet-500/10 p-2">
                  {roomAnime.image && (
                    <img
                      src={roomAnime.image}
                      alt=""
                      className="size-11 rounded-lg object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">
                    {roomAnime.title}
                  </span>
                  <button onClick={() => setRoomAnime(null)} className="p-1">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                roomResults && (
                  <div className="thin-scroll max-h-40 space-y-1 overflow-y-auto">
                    {roomResults.length === 0 && (
                      <p className="py-2 text-center text-[11px] text-muted-foreground">
                        Anime tidak ditemukan
                      </p>
                    )}
                    {roomResults.map((a: any) => (
                      <button
                        key={String(a.id ?? a.malId ?? a.animeId)}
                        onClick={() => {
                          setRoomAnime(a);
                          setRoomResults(null);
                          setRoomQ(a.title ?? "");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-border/60 p-1.5 text-left hover:border-violet-500/50"
                      >
                        {a.image && (
                          <img
                            src={a.image}
                            alt=""
                            className="size-8 rounded-md object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs">
                          {a.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Episode
                </span>
                <input
                  type="number"
                  min={1}
                  value={roomEp}
                  onChange={(e) => setRoomEp(e.target.value)}
                  className="w-20 rounded-lg border border-input bg-background/60 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Siapa yang boleh masuk
                </span>
                <div className="mt-1 flex gap-1.5">
                  {(
                    [
                      ["clan", "Semua member clan (auto masuk)"],
                      ["selected", "User tertentu"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setRoomAccess(k)}
                      className={cn(
                        "min-w-0 flex-1 truncate rounded-xl border py-2 text-[11px] font-bold transition",
                        roomAccess === k
                          ? "border-violet-500 bg-violet-500/15 text-violet-200"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {roomAccess === "selected" && (
                <div className="fade-enter space-y-1.5">
                  {roomPicked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {roomPicked.map((u) => (
                        <button
                          key={u._id}
                          onClick={() =>
                            setRoomPicked((s) => s.filter((x) => x._id !== u._id))
                          }
                          className="flex items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold"
                        >
                          {u.username} <X className="size-3" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={uQ}
                      onChange={(e) => setUQ(e.target.value)}
                      placeholder="Cari username atau ID (#1)…"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  {Array.isArray(userResults) && userResults.length > 0 && (
                    <div className="thin-scroll max-h-32 space-y-1 overflow-y-auto">
                      {userResults.map((u: any) => (
                        <button
                          key={u._id}
                          onClick={() => {
                            setRoomPicked((s) =>
                              s.some((x) => x._id === u._id) ? s : [...s, u],
                            );
                            setUQ("");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg border border-border/60 p-1.5 text-left hover:border-violet-500/50"
                        >
                          <Avatar
                            src={u.image}
                            seed={u.username}
                            className="size-7"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {u.username}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            #{u.seqId ?? "?"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-border py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy || !name.trim() || tag.length < 3 || !avatar}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await create({ name, tag, tagIcon: icon, avatarUrl: avatar });
                toast.success("Clan dibuat! Membuka chat clan…");
                // Room nobar untuk clan (kalau diisi)
                if (roomOn && roomAnime) {
                  const animeId = String(
                    roomAnime.id ?? roomAnime.malId ?? roomAnime.animeId ?? "",
                  );
                  if (animeId) {
                    try {
                      await createRoom({
                        name: roomName.trim() || `${name} Nobar`,
                        animeId,
                        animeTitle: roomAnime.title,
                        animeImage: roomAnime.image,
                        episode: Math.max(1, Math.floor(Number(roomEp) || 1)),
                        visibility: roomAccess === "clan" ? "all" : "selected",
                        allowedUserIds: roomPicked.map((u) => u._id),
                        clanId: r.clanId,
                      });
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? `Room gagal: ${e.message}`
                          : "Room gagal dibuat",
                      );
                    }
                  }
                }
                onCreated(r.clanId); // App auto-switch ke chat clan
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
                setBusy(false);
              }
            }}
            className="flex-1 rounded-full bg-[oklch(0.86_0.16_90)] py-3 font-bold text-[oklch(0.18_0.04_70)] disabled:opacity-40"
          >
            Buat
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- gabung clan ----

function JoinClan({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"semua" | "best">("semua");
  const clans = useQuery(api.clans.listClans, {});
  const requestJoin = useMutation(api.clans.requestJoin);
  const [detailId, setDetailId] = useState<Id<"clans"> | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const sorted =
    tab === "best" ? [...(clans ?? [])].sort((a: any, b: any) => b.diamonds - a.diamonds) : clans ?? [];

  if (detailId)
    return (
      <ClanDetail
        clanId={detailId}
        onBack={() => setDetailId(null)}
        viewerNotMember
      />
    );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-3">
      <div className="w-full">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Gabung Clan</h1>
        </div>
        <div className="tab-pill-track mb-3">
          {(["semua", "best"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("tab-pill", tab === t && "tab-pill-active")}
            >
              {t === "semua" ? "Semua" : "Best Clan"}
            </button>
          ))}
        </div>

        {warn && (
          <div className="mb-3 rounded-2xl border border-violet-500/40 bg-violet-500/10 p-3 text-xs">
            <p>{warn}</p>
            <button
              className="mt-1 font-semibold text-violet-300 underline"
              onClick={() => setWarn(null)}
            >
              tutup
            </button>
          </div>
        )}

        <div className="space-y-2 pb-24">
          {(clans ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Belum ada clan. Jadilah yang pertama!
            </p>
          )}
          {sorted.map((c: any) => (
            <div
              key={c._id}
              className="member-row cursor-pointer p-3 transition hover:border-[oklch(0.86_0.16_90)]/40"
              onClick={() => setDetailId(c._id as Id<"clans">)}
            >
              <div className="flex items-center gap-3">
                <Avatar src={c.avatarUrl} seed={c.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <ClanTag icon={c.tagIcon} tag={c.tag} color={c.color} className="mt-0.5" />                    <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                      <span>👥 {c.memberCount} member</span>
                      <span className="text-violet-300">💎 {c.diamonds} Sacret</span>
                      <span>🕰 {c.ageDays} hari</span>
                    </div>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const r = await requestJoin({ clanId: c._id as Id<"clans"> });
                      toast.success(
                        r.requested ? "Request terkirim" : "Request dibatalkan",
                      );
                    } catch (err) {
                      setDetailId(c._id as Id<"clans">);
                      setWarn(
                        err instanceof Error
                          ? err.message
                          : "Buka detail clan untuk request join",
                      );
                    }
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold",
                    c.isRequested
                      ? "bg-green-500/20 text-green-400"
                      : "bg-[oklch(0.86_0.16_90)] text-[oklch(0.18_0.04_70)]",
                  )}
                >
                  {c.isRequested ? "Request terkirim" : "Request"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ clan hub ----

function ClanHub({ clanId }: { clanId: Id<"clans"> }) {
  const [screen, setScreen] = useState<"chat" | "detail">("chat");
  return (
    <div className="py-2">
      {screen === "chat" ? (
        <ClanChat clanId={clanId} onOpenDetail={() => setScreen("detail")} />
      ) : (
        <ClanDetail clanId={clanId} onBack={() => setScreen("chat")} />
      )}
    </div>
  );
}

function ClanChat({
  clanId,
  onOpenDetail,
}: {
  clanId: Id<"clans">;
  onOpenDetail: () => void;
}) {
  const { user } = useAuth();
  useHideNavOnMount();
  const { messages: msgs, sendFast } = useFastChat(
    { kind: "clan", clanId, limit: 60 },
    { kind: "clan", clanId },
    user,
  );
  const detail = useQuery(api.clans.clanDetail, { clanId });
  const c = detail?.clan;
  const isLeader = detail?.myRole === "leader";
  const isOfficer = detail?.myRole === "officer";
  return (
    // Full screen beneran: navbar hilang total, header clan tetap di atas
    <div className="screen-enter fixed inset-0 z-[55] flex flex-col bg-background">
      <div className="flex w-full shrink-0 items-center gap-3 border-b border-border/60 px-3 py-2.5">
        <button
          onClick={onOpenDetail}
          aria-label="Detail clan"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-card p-2 text-left"
        >
          <ClanTag icon={c?.tagIcon ?? DEFAULT_CLAN_ICON} tag={c?.tag ?? "—"} color={c?.color} />
          <span className="min-w-0 flex-1 truncate font-bold">{c?.name ?? "Clan"}</span>
          <span className="text-muted-foreground">›</span>
        </button>
        {(isLeader || isOfficer) && (
          <button
            onClick={onOpenDetail}
            aria-label="Panel leader"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
          >
            <Settings className="size-[18px]" />
          </button>
        )}
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col pb-2">
        {msgs && user ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-card">
            <ChatPanel
              kind="clan"
              clanId={clanId}
              messages={msgs}
              meId={user._id}
              onSend={(p) => sendFast(p)}
            />
          </div>
        ) : (
          <div className="space-y-2.5 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="msg-skeleton size-9 shrink-0 rounded-full" />
                <div
                  className="msg-skeleton h-10 rounded-lg"
                  style={{ width: `${50 + ((i * 19) % 36)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- clan detail ----

function ClanDetail({
  clanId,
  onBack,
  viewerNotMember,
}: {
  clanId: Id<"clans">;
  onBack: () => void;
  viewerNotMember?: boolean;
}) {
  const detail = useQuery(api.clans.clanDetail, { clanId });
  const requestJoin = useMutation(api.clans.requestJoin);
  const donate = useMutation(api.clans.donate);
  const claim = useMutation(api.clans.claimDaily);
  const leave = useMutation(api.clans.leaveClan);
  const setRole = useMutation(api.clans.setRole);
  const kick = useMutation(api.clans.kickMember);
  const transfer = useMutation(api.clans.transferLeader);
  const setBackground = useMutation(api.clans.setBackground);
  const respond = useMutation(api.clans.respondRequest);
  const [tab, setTab] = useState<"member" | "top">("member");
  const [topScope, setTopScope] = useState<"today" | "all">("today");
  const [search, setSearch] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  useHideNavOnMount(); // fullscreen: navbar & mini player hilang total

  if (!detail) return null;
  const c = detail.clan;
  const isMember = !!detail.myRole;
  const myRole = detail.myRole;
  const isLeader = myRole === "leader";
  const isOfficer = myRole === "officer";
  const canPanel = isLeader || isOfficer;
  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = detail.myLastClaimDay === today;
  const needle = search.trim().toLowerCase();
  const members = detail.members.filter(
    (m: any) =>
      !needle ||
      m.username.toLowerCase().includes(needle) ||
      String(m.userId).toLowerCase().includes(needle),
  );
  const rankAll = [...(detail.topDonateAll ?? [])].sort(
    (a: any, b: any) => b.donatedTotal - a.donatedTotal,
  );
  const topDonate: any[] =
    topScope === "all"
      ? rankAll
      : tab === "top"
        ? detail.topDonateToday
        : detail.topDonateToday.filter((m: any) =>
            m.username.toLowerCase().includes(needle),
          );
  const topTotal =
    topScope === "all"
      ? rankAll.reduce((s: number, m: any) => s + (m.donatedTotal ?? 0), 0)
      : detail.todayDonationsTotal;
  const t1 = topDonate[0];
  const t2 = topDonate[1];
  const t3 = topDonate[2];
  void viewerNotMember;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3 pb-24">
        <div className="mb-3 mt-1 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Lihat Clan</h1>
          {isMember && (
            <button
              onClick={async () => {
                try {
                  await leave();
                  toast.success("Kamu keluar dari clan");
                  onBack();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
              className="ml-auto flex items-center gap-1 rounded-full border border-violet-500/50 px-3 py-1.5 text-xs text-red-400"
            >
              <LogOut className="size-3.5" /> Keluar Clan
            </button>
          )}
        </div>

        {/* Hero clan */}
        <div
          className="clan-hero-gradient relative overflow-hidden rounded-3xl border border-white/10"
          style={
            c.backgroundUrl
              ? {
                  backgroundImage: `url(${c.backgroundUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="relative p-4">
            {/* Lapisan gelap total di atas foto background clan: warna cerah
                cuma kelihatan ~40% sebagai bayangan, teks selalu kontras. */}
            <div className="yn-banner-dim" />
            <div className="relative flex items-center gap-3">
              <Avatar src={c.avatarUrl} seed={c.name} className="size-14" />
              <div className="min-w-0 flex-1">
                <ClanTag icon={c.tagIcon} tag={c.tag} color={c.color} />
              </div>
              <button
                onClick={() => setInfoOpen(true)}
                className="rounded-full border border-white/15 bg-black/30 p-2 text-indigo-100"
              >
                <Info className="size-4" />
              </button>
            </div>
            <p
              className={cn(
                "mt-2 truncate text-2xl font-black",
                c.color === "golden" && "clan-color-golden",
                c.color === "galaxy" && "clan-color-galaxy",
                c.color === "oren" && "text-orange-400",
                c.color === "merah" && "text-red-400",
              )}
            >
              {c.name}
            </p>

            {/* Stat: Level / Total XP / Members */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-black/30 px-2 py-3 text-center">
                <p className="text-lg font-bold text-white">{c.level}</p>
                <p className="text-xs text-indigo-100/70">Level</p>
              </div>
              <div className="rounded-2xl bg-black/30 px-2 py-3 text-center">
                <p className="text-lg font-bold text-white">{formatK(c.diamonds)}</p>
                <p className="text-xs text-indigo-100/70">Total XP</p>
              </div>
              <div className="rounded-2xl bg-black/30 px-2 py-3 text-center">
                <p className="text-lg font-bold text-white">{c.memberCount}</p>
                <p className="text-xs text-indigo-100/70">Members</p>
              </div>
            </div>

            {isMember ? (
              <ClanLevelBar level={c.level} progress={c.levelProgress} cost={c.levelCost} />
            ) : (
              <button
                onClick={async () => {
                  try {
                    const r = await requestJoin({ clanId });
                    toast.success(r.requested ? "Request terkirim" : "Request dibatalkan");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal");
                  }
                }}
                className={cn(
                  "mt-4 w-full rounded-full py-4 text-base font-extrabold shadow-lg shadow-black/30 transition active:scale-[0.985]",
                  detail.myRequestClanId === clanId
                    ? "bg-emerald-600 text-white hover:brightness-105"
                    : "bg-[oklch(0.86_0.16_90)] text-[oklch(0.18_0.04_70)] hover:brightness-105",
                )}
              >
                {detail.myRequestClanId === clanId
                  ? "Request terkirim (batalkan)"
                  : "Request Join"}
              </button>
            )}
          </div>
        </div>

        {isMember && (
          <>
            {/* Aksi: Claim + Donate — angka = Sacret yang bisa diambil, subteks = donate hari ini */}
            <div className="yn-card mt-4 p-4 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15">
                <Gem className="size-6 text-violet-300" />
              </span>
              <p className="mt-2 font-mono text-2xl font-black text-white">{formatK(c.claimAmount)}</p>
              <p className="text-[11px] text-muted-foreground">
                Sacret yang bisa diambil · {detail.todayDonationsTotal} Sacret didonate hari ini
              </p>
              <div className="mt-3 space-y-2">
                <button
                  disabled={claimedToday}
                  onClick={async () => {
                    try {
                      const r = await claim();
                      toast.success(`Berhasil claim ${r.amount} Sacret!`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                  className="yn-btn yn-btn-gold w-full disabled:opacity-40"
                >
                  {claimedToday ? "Sudah claim hari ini" : `Claim Sacret (${c.claimAmount})`}
                </button>
                <button
                  onClick={() => setDonateOpen(true)}
                  className="yn-btn yn-btn-ghost w-full"
                >
                  Donate
                </button>
              </div>
            </div>

            {canPanel && (
              <div className="yn-action-row mt-3">
                <button
                  onClick={() => setPanelOpen(true)}
                  className="yn-btn yn-btn-ghost"
                >
                  <Settings className="size-4" /> Panel {isLeader ? "Leader" : "Officer"}
                </button>
                <button
                  onClick={() => {
                    setTab("top");
                    setTopScope("today");
                  }}
                  className="yn-btn yn-btn-ghost"
                >
                  <Gem className="size-4" /> Top Donate
                </button>
                <button
                  onClick={() => setPanelOpen(true)}
                  className="yn-btn yn-btn-ghost"
                >
                  <Inbox className="size-4" /> Request
                  <span className="rounded-full bg-white/15 px-1.5 font-mono text-[10px]">
                    {detail.requests.length}
                  </span>
                </button>
              </div>
            )}

          </>
        )}

        {/* Tab: Member / Top Donate — terbuka juga untuk yang belum join */}
        <div className="tab-pill-track mt-3">
          <button
            onClick={() => setTab("member")}
            className={cn("tab-pill", tab === "member" && "tab-pill-active")}
          >
            Member ({c.memberCount})
          </button>
          <button
            onClick={() => setTab("top")}
            className={cn("tab-pill", tab === "top" && "tab-pill-active")}
          >
            Top Donate ({detail.todayDonators})
          </button>
        </div>

        {/* Search rounded-full */}
        {tab === "member" && (
          <div className="pill-search mt-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari member (nama atau ID)"
            />
          </div>
        )}

        {tab === "member" && (
          <div className="mt-3 space-y-2.5">
            {members.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tidak ada member yang cocok.
              </p>
            )}
            {members.map((m: any) => (
              <div
                key={m.userId}
                className="member-row relative overflow-hidden"
                style={
                  m.bannerUrl
                    ? {
                        backgroundImage: `url(${m.bannerUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div className="relative p-3">
                  {/* Lapisan gelap total di atas banner member: foto tinggal
                      bayangan samar, warna cerah tidak menerawang lagi. */}
                  <div className="yn-banner-dim" />
                  <div className="relative flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Avatar src={m.image} seed={m.username} className="size-12" />
                    <RoleBadge role={m.role} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-indigo-50">{m.username}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <ClanTag
                        icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
                        tag={c.tag}
                        color={c.color}
                      />
                      <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold text-black">
                        Lv.{m.level ?? 1}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-indigo-200/60">
                      Gabung {Math.max(0, Math.floor((Date.now() - m.joinedAt) / 86400000))} hari lalu
                    </p>
                  </div>
                  <div className="diamond-chip">
                    <Gem className="size-4 text-violet-400" />
                    <span className="text-sm font-bold text-white">
                      {formatK(m.donatedTotal)}
                    </span>
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "top" && (
          <div className="mt-3">
            <div className="tab-pill-track w-fit">
              <button
                onClick={() => setTopScope("today")}
                className={cn("tab-pill", topScope === "today" && "tab-pill-active")}
              >
                Hari ini
              </button>
              <button
                onClick={() => setTopScope("all")}
                className={cn("tab-pill", topScope === "all" && "tab-pill-active")}
              >
                Sepanjang masa
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-card px-3 py-2.5">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {topScope === "today" ? "Donate hari ini" : "Total donate"}
                </p>
                <p className="font-mono text-lg font-bold text-[oklch(0.86_0.16_90)]">
                  {topTotal}{" "}
                  <span className="text-[11px] font-sans text-muted-foreground">Sacret</span>
                </p>
              </div>
              <p className="text-right text-[11px] text-muted-foreground">
                dari
                <br />
                <b className="font-mono text-sm text-foreground">{topDonate.length}</b> member
              </p>
            </div>
            {topDonate.length >= 3 && (
              <div className="mt-3 grid grid-cols-3 items-end gap-2">
                <TopPodium rank={2} m={t2} scope={topScope} />
                <TopPodium rank={1} m={t1} big scope={topScope} />
                <TopPodium rank={3} m={t3} scope={topScope} />
              </div>
            )}
            <div className="mt-3 space-y-1.5">
              {topDonate.map((m: any, i: number) => (
                <MemberDonateRow key={m.userId} m={m} rank={i + 1} scope={topScope} />
              ))}
            </div>
            {topDonate.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Belum ada donate di periode ini
              </p>
            )}
          </div>
        )}

        {!isMember && (
          <p className="mt-3 rounded-3xl border border-white/10 bg-card p-4 text-center text-xs text-muted-foreground">
            Claim & donate terbuka setelah kamu menjadi member clan ini.
          </p>
        )}
      </div>

      {donateOpen && (
        <DonateDialog
          onClose={() => setDonateOpen(false)}
          onDonate={async (amount) => {
            try {
              const r = await donate({ amount });
              toast.success(`Donate berhasil! Level clan ${r.level}`);
              setDonateOpen(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        />
      )}
      {infoOpen && (
        <Popup onClose={() => setInfoOpen(false)} title="Info Roles">
          <div className="space-y-2">
            {[
              ["leader", "Leader", "mempunyai akses penuh dalam mengatur peraturan clan apapun itu"],
              ["officer", "Officer", "membantu leader seperti kick member, accept request, dan lainnya"],
              ["victro", "Victro", "memberi peringatan keras kepada member yang melanggar peraturan clan"],
              ["hydler", "Hydler", "memantau kondisi chat clan apabila terjadi kerusuhan"],
            ].map(([role, name, desc]) => (
              <div
                key={role}
                className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/30 p-2.5"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-md bg-gradient-to-r px-2 py-0.5 text-[10px] font-bold",
                    ROLE_BADGE_CLS[role],
                  )}
                >
                  {name.toUpperCase()}
                </span>
                <p className="text-xs leading-relaxed text-indigo-100/80">{desc}</p>
              </div>
            ))}
          </div>
        </Popup>
      )}
      {panelOpen && (
        <LeaderPanel
          clanId={clanId}
          isLeader={isLeader}
          onClose={() => setPanelOpen(false)}
          onSetRole={async (targetId, role) => {
            await setRole({ targetId: targetId as Id<"users">, role });
            toast.success("Role diterapkan");
          }}
          onKick={async (targetId) => {
            await kick({ targetId: targetId as Id<"users"> });
            toast.success("Member dikick");
          }}
          onTransfer={async (targetId) => {
            await transfer({ targetId: targetId as Id<"users"> });
            toast.success("Leader ditransfer");
          }}
          onBg={async (url) => {
            await setBackground({ url });
            toast.success("Background clan diubah");
          }}
          requests={detail.requests.map((r: any) => ({
            requestId: r.requestId,
            username: r.username,
            image: r.image,
            level: r.level ?? 1,
            userId: r.userId,
          }))}
          onRespond={async (requestId, accept) => {
            await respond({ requestId, accept });
            toast.success(accept ? "Request diterima" : "Request ditolak");
          }}
        />
      )}
    </div>
  );
}

type DonateRow = {
  username: string;
  image?: string;
  donatedToday?: number;
  donatedTotal?: number;
  bannerUrl?: string;
};

/** Angka yang dipakai untuk sort & tampil, sesuai periode yang dipilih. */
function donateAmount(m: DonateRow, scope: "today" | "all"): number {
  return scope === "all" ? (m.donatedTotal ?? 0) : (m.donatedToday ?? 0);
}

function TopPodium({
  rank,
  m,
  big,
  scope,
}: {
  rank: number;
  m?: DonateRow;
  big?: boolean;
  scope: "today" | "all";
}) {
  if (!m) return <div />;
  return (
    <div className="clan-hero-gradient flex flex-col items-center rounded-t-2xl border border-b-0 border-white/10 pt-2">
      <span className="text-lg font-black text-[oklch(0.86_0.16_90)]">{rank}</span>
      <Avatar src={m.image} seed={m.username} className={cn("mt-1", big ? "size-14" : "size-11")} />
      <p className="line-clamp-1 max-w-full px-1 text-xs font-semibold">{m.username}</p>
      <p className="text-[10px] text-muted-foreground">
        {scope === "all" ? "Sepanjang masa" : "Hari ini"}
      </p>
      <p className="mb-1 font-mono text-xs font-bold text-[oklch(0.86_0.16_90)]">
        {formatK(donateAmount(m, scope))}
      </p>
    </div>
  );
}

function MemberDonateRow({
  m,
  rank,
  scope,
}: {
  m: DonateRow;
  rank: number;
  scope: "today" | "all";
}) {
  return (
    <div className="member-row flex items-center gap-3 p-2.5">
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-muted-foreground">
        {rank}
      </span>
      <Avatar src={m.image} seed={m.username} className="size-10" />
      <p className="min-w-0 flex-1 truncate text-sm font-bold">{m.username}</p>
      <span className="shrink-0 font-mono text-sm font-bold text-[oklch(0.86_0.16_90)]">
        {formatK(donateAmount(m, scope))}
      </span>
    </div>
  );
}

function DonateDialog({
  onClose,
  onDonate,
}: {
  onClose: () => void;
  onDonate: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(0);
  return (
    <Popup onClose={onClose} title="Donate Sacret">
      <div className="text-center">
        <Gem className="mx-auto size-9 text-violet-400" />
        <p className="mt-1 text-xl font-black text-white">{amount}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {DONATE_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            className={cn(
              "rounded-full border py-2 text-sm font-semibold",
              amount === p
                ? "border-[oklch(0.86_0.16_90)] bg-[oklch(0.86_0.16_90)]/15 text-white"
                : "border-border text-muted-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        type="number"
        value={amount || ""}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Minimal 50 Sacret"
        className="mt-3 w-full rounded-full border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <button
        disabled={amount < 50}
        onClick={() => onDonate(amount)}
        className="mt-3 w-full rounded-full bg-[oklch(0.86_0.16_90)] py-3 text-sm font-bold text-[oklch(0.18_0.04_70)] disabled:opacity-40"
      >
        Donate
      </button>
    </Popup>
  );
}

function Popup({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// -------------------------------------------------------- leader panel ----

function LeaderPanel({
  clanId,
  isLeader,
  onClose,
  onSetRole,
  onKick,
  onTransfer,
  onBg,
  requests,
  onRespond,
}: {
  clanId: Id<"clans">;
  isLeader: boolean;
  onClose: () => void;
  onSetRole: (id: string, role: "officer" | "victro" | "hydler" | "member") => Promise<void>;
  onKick: (id: string) => Promise<void>;
  onTransfer: (id: string) => Promise<void>;
  onBg: (url: string) => Promise<void>;
  requests: {
    requestId: Id<"clanRequests">;
    username: string;
    image?: string;
    level: number;
    userId: string;
  }[];
  onRespond: (requestId: Id<"clanRequests">, accept: boolean) => Promise<void>;
}) {
  const detail = useQuery(api.clans.clanDetail, { clanId });
  const [sub, setSub] = useState<"bg" | "roles" | "kick" | "transfer" | "unroles">("bg");
  const [bgUrl, setBgUrl] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [role, setRole] = useState<"officer" | "victro" | "hydler">("officer");
  // Cari member di daftar kick/roles/transfer.
  const [mSearch, setMSearch] = useState("");

  const members = detail?.members ?? [];
  const needle = mSearch.trim().toLowerCase();
  void clanId;

  // Fullscreen: panel jadi layar penuh sendiri, bukan popup kecil di atas
  // halaman clan. Keluar hanya lewat tombol kembali di kiri atas.
  return (
    <div className="screen-enter fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-md px-3 pb-24">
        <div className="flex items-center gap-3 py-3">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-violet-500/60 hover:text-violet-300"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">
              Panel {isLeader ? "Leader" : "Officer"}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Atur background, role, dan member clan
            </p>
          </div>
        </div>

        {/* Kolom request join: kartu terpisah di paling atas — tidak menempel
            dengan menu panel lagi. */}
        <div className="yn-card p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-300">
            Request Join ({requests.length})
          </p>
          <div className="space-y-2">
            {requests.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Tidak ada request</p>
            )}
            {requests.map((r) => (
              <div key={r.requestId} className="member-row flex items-center gap-2.5 p-2.5">
                <Avatar src={r.image} seed={r.username} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.username}</p>
                  <p className="text-[10px] text-muted-foreground">Level {r.level}</p>
                </div>
                <button
                  onClick={() => void onRespond(r.requestId, true)}
                  className="flex size-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 transition hover:bg-emerald-500/30"
                  aria-label="Terima request"
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => void onRespond(r.requestId, false)}
                  className="flex size-9 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
                  aria-label="Tolak request"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Menu sub-panel: kartu kecil sama seperti tombol clan lainnya */}
        <div className="yn-card mt-3 p-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["bg", "Background"],
                ["roles", "Add roles"],
                ["kick", "Kick"],
                ["transfer", "Transfer Leader"],
                ...(isLeader ? (["unroles", "UnRoles"] as const) : ([] as const)),
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSub(k as typeof sub)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition",
                  sub === k
                    ? "border-violet-500/70 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-violet-500/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {sub === "bg" && (
          <div className="yn-card mt-3 flex gap-2 p-3">
            <input
              value={bgUrl}
              onChange={(e) => setBgUrl(e.target.value)}
              placeholder="URL background clan"
              className="flex-1 rounded-full border border-input bg-background/60 px-3 py-2 text-sm"
            />
            <button
              onClick={async () => {
                await onBg(bgUrl);
                onClose();
              }}
              className="rounded-full bg-[oklch(0.86_0.16_90)] px-4 text-sm font-bold text-[oklch(0.18_0.04_70)]"
            >
              OK
            </button>
          </div>
        )}

        {(sub === "roles" || sub === "kick" || sub === "transfer" || sub === "unroles") && (
          <div className="yn-card mt-3 p-3">
            {/* Cari member dulu, baru pilih aksi */}
            <div className="pill-search mb-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={mSearch}
                onChange={(e) => setMSearch(e.target.value)}
                placeholder="Cari member (nama atau ID)"
              />
            </div>
            {sub === "roles" && (
              <div className="mb-2 flex gap-1.5">
                {(["officer", "victro", "hydler"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs capitalize",
                      role === r
                        ? "border-[oklch(0.86_0.16_90)] text-[oklch(0.86_0.16_90)]"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    +{r}
                  </button>
                ))}
              </div>
            )}
            {sub === "unroles" && (
              <div className="mb-2 flex gap-1.5">
                {(["victro", "officer", "hydler"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs capitalize",
                      role === r
                        ? "border-[oklch(0.86_0.16_90)] text-[oklch(0.86_0.16_90)]"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    Un{r}
                  </button>
                ))}
              </div>
            )}
            <div className="thin-scroll max-h-[52vh] space-y-1.5 overflow-y-auto">
              {members
                .filter(
                  (m: any) =>
                    m.role !== "leader" &&
                    (!needle ||
                      String(m.username).toLowerCase().includes(needle) ||
                      String(m.userId).toLowerCase().includes(needle)),
                )
                .map((m: any) => (
                  <div
                    key={m.userId}
                    className={cn(
                      "member-row flex cursor-pointer items-center gap-2 p-2",
                      picked === m.userId && "border-[oklch(0.86_0.16_90)]",
                    )}
                    onClick={() => setPicked(m.userId)}
                  >
                    <Avatar src={m.image} seed={m.username} className="size-8" />
                    <p className="flex-1 truncate text-sm">{m.username}</p>
                    <span className="text-[10px] capitalize text-muted-foreground">{m.role}</span>
                  </div>
                ))}
            </div>
            {picked && (
              <button
                onClick={async () => {
                  if (sub === "roles" || sub === "unroles") {
                    const target = members.find((m: any) => m.userId === picked);
                    if (target) {
                      const finalRole =
                        sub === "unroles"
                          ? "member"
                          : role;
                      await onSetRole(picked, finalRole);
                    }
                  } else if (sub === "kick") {
                    await onKick(picked);
                  } else if (sub === "transfer") {
                    await onTransfer(picked);
                  }
                  setPicked(null);
                  onClose();
                }}
                className="yn-btn yn-btn-gold mt-3 w-full"
              >
                {sub === "kick"
                  ? "Kick Sekarang"
                  : sub === "transfer"
                    ? "OK — Transfer"
                    : sub === "unroles"
                      ? "Kembalikan jadi Member"
                      : "Terapkan"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
