import { useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ChatPanel } from "@/components/ChatPanel";
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
  Info,
  LogOut,
  Search,
  Settings,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

const TAG_ICONS = ["🪽", "🔥", "⚡", "☘️", "✳️", "🏹", "💀", "💧", "❄️", "☀️"];
const DONATE_PRESETS = [100, 200, 300, 500, 700, 1000];
const ROLE_INFO = `Info Roles
1. Leader : leader mempunyai akses penuh dalam mengatur peraturan clan apapun itu
2. Officer : Officer membantu leader seperti kick member, accept request, dan lainnya
3. Victro : Memberi peringatan keras kepada member yang melanggar peraturan clan yang sudah ditetapkan
4. Hydler : Memantau kondisi chat clan apabila terjadi kerusuhan`;

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

  if (my === undefined)
    return <p className="py-20 text-center text-sm text-muted-foreground">Memuat…</p>;

  if (my === null) return <NoClan initialCreate={params.get("buat") === "1"} />;
  return <ClanHub clanId={my.clanId as Id<"clans">} />;
}

// --------------------------------------------------------- belum join ----

function NoClan({ initialCreate }: { initialCreate?: boolean }) {
  const [mode, setMode] = useState<"none" | "buat" | "gabung">(
    initialCreate ? "buat" : "none",
  );
  return (
    <div className="py-6">
      <div className="clan-hero-gradient flex flex-col items-center justify-center rounded-3xl border border-white/10 p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-black/30 text-2xl">
          ⚔️
        </div>
        <h1 className="mt-3 text-lg font-bold">Kamu belum join clan</h1>
        <p className="mt-1 text-sm text-white/60">
          Join clan untuk mendapatkan Sacret dan buat clan mu nomor 1
        </p>
        <div className="mx-auto mt-5 flex w-64 flex-col gap-2">
          <button
            onClick={() => setMode("buat")}
            className="w-full rounded-full bg-violet-600 py-3 font-bold text-white transition hover:bg-violet-500"
          >
            Buat Clan
          </button>
          <button
            onClick={() => setMode("gabung")}
            className="w-full rounded-full border border-white/20 bg-white/5 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Lihat Clan
          </button>
        </div>
      </div>
      {mode === "buat" && <CreateClan onDone={() => setMode("none")} />}
      {mode === "gabung" && <JoinClan onBack={() => setMode("none")} />}
    </div>
  );
}

// ------------------------------------------------------------ buat clan ----

function CreateClan({ onDone }: { onDone: () => void }) {
  const create = useMutation(api.clans.createClan);
  const [icon, setIcon] = useState(TAG_ICONS[0]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [avatar, setAvatar] = useState("");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-3">
      <div className="w-full">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onDone} className="rounded-full border border-border p-2">
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
            {TAG_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border text-2xl [image-rendering:pixelated] transition",
                  icon === ic
                    ? "border-[oklch(0.86_0.16_90)] bg-[oklch(0.86_0.16_90)]/15"
                    : "border-border hover:border-[oklch(0.86_0.16_90)]/50",
                )}
              >
                {ic}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xl">{icon}</span>
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
          Membuat clan butuh <b className="text-[oklch(0.86_0.16_90)]">1000 berlian</b>
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onDone}
            className="flex-1 rounded-full border border-border py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || tag.length < 3 || !avatar}
            onClick={async () => {
              try {
                await create({ name, tag, tagIcon: icon, avatarUrl: avatar });
                toast.success("Clan dibuat!");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
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
                  <ClanTag icon={c.tagIcon} tag={c.tag} color={c.color} className="mt-0.5" />
                  <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                    <span>Total Member: {c.memberCount}</span>
                    <span>Total Berlian: {c.diamonds}</span>
                    <span>Umur Clan: {c.ageDays} hari</span>
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
                      setWarn(
                        err instanceof Error
                          ? err.message
                          : "Gagal request",
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
  const msgs = useQuery(api.chat.listMessages, { kind: "clan", clanId, limit: 100 });
  const send = useMutation(api.chat.sendMessage);
  const detail = useQuery(api.clans.clanDetail, { clanId });
  const c = detail?.clan;
  return (
    // Full screen beneran: nutupin navbar + footer, sama seperti chat global
    <div className="screen-enter fixed inset-0 z-[55] flex flex-col bg-background">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          onClick={onOpenDetail}
          className="rounded-full border border-border p-2"
        >
          <ChevronLeft className="size-4" />
        </button>
        <ClanTag icon={c?.tagIcon ?? "⚔️"} tag={c?.tag ?? "—"} color={c?.color} />
        <span className="truncate font-bold">{c?.name ?? "Clan"}</span>
        <span className="ml-auto text-muted-foreground">›</span>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col px-4 pb-2">
        {msgs && user ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <ChatPanel
              kind="clan"
              clanId={clanId}
              messages={msgs as never}
              meId={user._id}
              onSend={async (p) => {
                await send({ kind: "clan", clanId, ...(p as any) });
              }}
            />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Memuat…</p>
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
  const [search, setSearch] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

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
  const topDonate = detail.topDonateToday.filter((m: any) =>
    m.username.toLowerCase().includes(needle),
  );
  const [t1, t2, t3, ...restTop] = topDonate;
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
          <div className="bg-black/25 p-4">
            <div className="flex items-center gap-3">
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
                    await requestJoin({ clanId });
                    toast.success("Request terkirim");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal");
                  }
                }}
                className="mt-4 w-full rounded-full bg-[oklch(0.86_0.16_90)] py-4 text-base font-extrabold text-[oklch(0.18_0.04_70)] shadow-lg shadow-black/30 transition hover:brightness-105 active:scale-[0.985]"
              >
                Request Join
              </button>
            )}
          </div>
        </div>

        {isMember && (
          <>
            {/* Aksi: Claim + Donate + Panel dev/mod — DI ATAS tab Members/Donasi */}
            <div className="mt-4 rounded-3xl border border-white/10 bg-card p-4 text-center">
              <Gem className="mx-auto size-7 text-violet-400" />
              <p className="mt-1 text-xl font-black text-white">{formatK(c.diamonds)}</p>
              <div className="mt-2 space-y-2">
                <button
                  disabled={claimedToday}
                  onClick={async () => {
                    try {
                      const r = await claim();
                      toast.success(`Berhasil claim ${r.amount} berlian!`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                  className="w-full rounded-full bg-[oklch(0.86_0.16_90)] py-3 text-sm font-bold text-[oklch(0.18_0.04_70)] disabled:opacity-40"
                >
                  {claimedToday ? "Sudah claim hari ini" : `Claim Berlian (${c.claimAmount})`}
                </button>
                <button
                  onClick={() => setDonateOpen(true)}
                  className="w-full rounded-full border border-white/15 bg-white/5 py-3 text-sm font-bold text-white hover:bg-white/10"
                >
                  Donate
                </button>
              </div>
            </div>

            {canPanel && (
              <button
                onClick={() => setPanelOpen(true)}
                className="mt-3 w-full rounded-full border border-white/15 bg-white/5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                <Settings className="mr-1.5 inline size-4" /> Panel {isLeader ? "Leader" : "Officer"}{" "}
                ({detail.requests.length} request)
              </button>
            )}

            {/* Tab pill: Members / Donasi Hari Ini */}
            <div className="tab-pill-track mt-3">
              <button
                onClick={() => setTab("member")}
                className={cn("tab-pill", tab === "member" && "tab-pill-active")}
              >
                Members ({c.memberCount})
              </button>
              <button
                onClick={() => setTab("top")}
                className={cn("tab-pill", tab === "top" && "tab-pill-active")}
              >
                Donasi Hari Ini ({detail.todayDonators})
              </button>
            </div>

            {/* Search rounded-full */}
            <div className="pill-search mt-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari member (nama atau ID)"
              />
            </div>

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
                    <div className="flex items-center gap-3 bg-black/40 p-3">
                      <div className="flex flex-col items-center gap-1">
                        <Avatar src={m.image} seed={m.username} className="size-12" />
                        <RoleBadge role={m.role} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-indigo-50">{m.username}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <ClanTag
                            icon={c.tagIcon ?? "⚔️"}
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
                ))}
              </div>
            )}

            {tab === "top" && (
              <div className="mt-3">
                <p className="mb-3 rounded-2xl border border-white/10 bg-card p-3 text-center text-xs">
                  Total donate hari ini terkumpul{" "}
                  <b className="text-[oklch(0.86_0.16_90)]">{detail.todayDonationsTotal}</b>{" "}
                  berlian dari{" "}
                  <b className="text-[oklch(0.86_0.16_90)]">{detail.todayDonators}</b> member
                </p>
                {topDonate.length >= 3 && (
                  <div className="mb-3 grid grid-cols-3 items-end gap-2">
                    <TopPodium rank={2} m={t2} />
                    <TopPodium rank={1} m={t1} big />
                    <TopPodium rank={3} m={t3} />
                  </div>
                )}
                {restTop.map((m: any) => (
                  <MemberDonateRow key={m.userId} m={m} />
                ))}
                {topDonate.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Belum ada yang donate hari ini
                  </p>
                )}
              </div>
            )}

          </>
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
        <Popup onClose={() => setInfoOpen(false)} title="Kegunaan Clan">
          <pre className="whitespace-pre-wrap text-xs leading-5 text-indigo-100/80">{ROLE_INFO}</pre>
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

function TopPodium({
  rank,
  m,
  big,
}: {
  rank: number;
  m?: { username: string; image?: string; donatedToday: number };
  big?: boolean;
}) {
  if (!m) return <div />;
  return (
    <div className="clan-hero-gradient flex flex-col items-center rounded-t-2xl border border-b-0 border-white/10 pt-2">
      <span className="text-lg font-black text-[oklch(0.86_0.16_90)]">{rank}</span>
      <Avatar src={m.image} seed={m.username} className={cn("mt-1", big ? "size-14" : "size-11")} />
      <p className="line-clamp-1 max-w-full px-1 text-xs font-semibold">{m.username}</p>
      <p className="text-[10px] text-indigo-100/60">Donate Hari Ini :</p>
      <p className="mb-1 text-xs font-bold text-[oklch(0.86_0.16_90)]">💎 {m.donatedToday}</p>
    </div>
  );
}

function MemberDonateRow({
  m,
}: {
  m: { username: string; image?: string; donatedToday: number; bannerUrl?: string };
}) {
  return (
    <div
      className="member-row relative mb-2.5 overflow-hidden"
      style={
        m.bannerUrl
          ? { backgroundImage: `url(${m.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <div className="flex items-center gap-3 bg-black/40 p-3">
        <div className="flex flex-col items-center gap-1">
          <Avatar src={m.image} seed={m.username} className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-indigo-50">{m.username}</p>
        </div>
        <div className="diamond-chip">
          <Gem className="size-4 text-violet-400" />
          <span className="text-sm font-bold text-white">{formatK(m.donatedToday)}</span>
        </div>
      </div>
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
    <Popup onClose={onClose} title="Donate Berlian">
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
        placeholder="Minimal 50 berlian"
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
  const [sub, setSub] = useState<"bg" | "roles" | "kick" | "transfer" | "unroles" | "request">(
    "request",
  );
  const [bgUrl, setBgUrl] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [role, setRole] = useState<"officer" | "victro" | "hydler">("officer");

  const members = detail?.members ?? [];
  void clanId;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 p-3" onClick={onClose}>
      <div
        className="mx-auto max-w-md rounded-3xl border border-white/10 bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">Panel {isLeader ? "Leader" : "Officer"}</p>
          <button onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="tab-pill-track mb-3 flex-wrap">
          {(
            [
              ["request", "Request"],
              ["bg", "Background"],
              ["roles", "Add roles"],
              ["kick", "Kick"],
              ["transfer", "Transfer Leader"],
              ...(isLeader
                ? ([["unroles", "UnRoles"]] as const)
                : ([] as const)),
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSub(k as typeof sub)}
              className={cn("rounded-full px-3 py-1.5 text-xs", sub === k && "tab-pill-active")}
            >
              {label}
            </button>
          ))}
        </div>

        {sub === "request" && (
          <div className="space-y-2">
            {requests.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Tidak ada request</p>
            )}
            {requests.map((r) => (
              <div key={r.requestId} className="member-row flex items-center gap-2 p-2.5">
                <Avatar src={r.image} seed={r.username} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.username}</p>
                  <p className="text-[10px] text-muted-foreground">Level {r.level}</p>
                </div>
                <button
                  onClick={() => void onRespond(r.requestId, true)}
                  className="rounded-full bg-green-500/20 p-1.5 text-green-400"
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => void onRespond(r.requestId, false)}
                  className="rounded-full bg-violet-500/20 p-1.5 text-red-400"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {sub === "bg" && (
          <div className="flex gap-2">
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
          <div>
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
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {members
                .filter((m: any) => m.role !== "leader")
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
                className="mt-3 w-full rounded-full bg-[oklch(0.86_0.16_90)] py-3 text-sm font-bold text-[oklch(0.18_0.04_70)]"
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
