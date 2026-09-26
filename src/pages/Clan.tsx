import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ChatPanel } from "@/components/ChatPanel";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import {
  Avatar,
  ClanLevelBar,
  ClanTag,
  SectionTitle,
  ShineBadge,
} from "@/components/lstream-ui";
import { CLAN_ROLE_BADGE } from "@/lib/lstream";
import {
  ChevronLeft,
  Crown,
  Gem,
  Info,
  LogOut,
  Search,
  Settings,
  Trophy,
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

export default function ClanPage() {
  return (
    <AppLayout hideAccountPanel>
      <ClanContent />
    </AppLayout>
  );
}

function ClanContent() {
  const { user } = useAuth();
  const my = useQuery(api.clans.myMembership, user ? {} : "skip");

  if (my === undefined)
    return <p className="py-20 text-center text-sm text-muted-foreground">Memuat…</p>;

  if (my === null) return <NoClan />;
  return <ClanHub clanId={my.clanId as Id<"clans">} />;
}

// --------------------------------------------------------- belum join ----

function NoClan() {
  const [mode, setMode] = useState<"none" | "buat" | "gabung">("none");
  return (
    <div className="py-6">
      <div className="rounded-2xl border border-amber-300/30 bg-card p-6 text-center">
        <Crown className="mx-auto size-10 text-amber-300" />
        <h1 className="mt-3 text-lg font-bold">Kamu belum join clan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join clan untuk mendapatkan Sacret dan buat clan mu nomor 1
        </p>
        <div className="mt-5 space-y-2">
          <button
            onClick={() => setMode("gabung")}
            className="w-full rounded-xl bg-amber-300 py-3 font-bold text-black hover:bg-amber-200"
          >
            Gabung Clan
          </button>
          <button
            onClick={() => setMode("buat")}
            className="w-full rounded-xl border border-border py-3 font-semibold"
          >
            Buat Clan
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
  const { user } = useAuth();
  const [icon, setIcon] = useState(TAG_ICONS[0]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [avatar, setAvatar] = useState("");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-3">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onDone} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Buat Clan</h1>
        </div>

        <div className="rounded-2xl border border-amber-300/30 bg-card p-4">
          <div className="flex items-center gap-3">
            <Avatar src={avatar || undefined} seed={name || "clan"} className="size-16" />
            <div>
              <p className="font-bold">{name || "Nama Clan"}</p>
              <ClanTag icon={icon} tag={tag || "TAG"} className="mt-1" />
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-amber-300">
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

        <div className="mt-3 rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs text-muted-foreground">Logo tag clan (pixel)</p>
          <div className="grid grid-cols-5 gap-2">
            {TAG_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border text-2xl [image-rendering:pixelated] transition",
                  icon === ic
                    ? "border-amber-300 bg-amber-300/15"
                    : "border-border hover:border-amber-300/50",
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
              className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="Custom nama tag clan (3-4 huruf)"
            className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
          />
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Membuat clan butuh <b className="text-amber-300">1000 berlian</b>
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onDone}
            className="flex-1 rounded-xl border border-border py-3 font-semibold"
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
            className="flex-1 rounded-xl bg-amber-300 py-3 font-bold text-black disabled:opacity-40"
          >
            Buat
          </button>
        </div>
        {void user}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- gabung clan ----

function JoinClan({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"semua" | "best">("semua");
  const clans = useQuery(api.clans.listClans, {});
  const requestJoin = useMutation(api.clans.requestJoin);
  const cancelRequest = useMutation(api.clans.cancelRequest);
  const [detailId, setDetailId] = useState<Id<"clans"> | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const sorted =
    tab === "best" ? [...(clans ?? [])].sort((a, b) => b.diamonds - a.diamonds) : clans ?? [];

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
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Gabung Clan</h1>
        </div>
        <div className="mb-3 flex gap-2">
          {(["semua", "best"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative flex-1 rounded-lg py-2 text-sm font-medium capitalize",
                tab === t ? "text-amber-200" : "text-muted-foreground",
              )}
            >
              {t === "semua" ? "Semua" : "Best Clan"}
              {tab === t && (
                <span className="absolute inset-x-6 bottom-0 h-0.5 rounded bg-amber-300" />
              )}
            </button>
          ))}
        </div>

        {warn && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs">
            <p>{warn}</p>
            <button
              className="mt-1 font-semibold text-red-300 underline"
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
              className="cursor-pointer rounded-2xl border border-border bg-card p-3 hover:border-amber-300/50"
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
                      : "bg-amber-300 text-black",
                  )}
                >
                  {c.isRequested ? "Request terkirim" : "Request"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {void cancelRequest}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ clan hub ----

function ClanHub({ clanId }: { clanId: Id<"clans"> }) {
  const [screen, setScreen] = useState<"chat" | "detail">("chat");
  const detail = useQuery(api.clans.clanDetail, { clanId });
  if (!detail) return null;
  const c = detail.clan;
  return (
    <div className="py-2">
      {screen === "chat" ? (
        <ClanChat clanId={clanId} onOpenDetail={() => setScreen("detail")} />
      ) : (
        <ClanDetail clanId={clanId} onBack={() => setScreen("chat")} />
      )}
      {void c}
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
    <div>
      <button
        onClick={onOpenDetail}
        className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/30 bg-card p-3 text-left"
      >
        <ClanTag icon={c?.tagIcon ?? "⚔️"} tag={c?.tag ?? "—"} color={c?.color} />
        <span className="truncate font-bold">{c?.name}</span>
        <span className="ml-auto text-muted-foreground">›</span>
      </button>
      <div className="mt-2 h-[70vh] overflow-hidden rounded-2xl border border-border bg-card">
        {msgs && user ? (
          <ChatPanel
            kind="clan"
            clanId={clanId}
            messages={msgs as never}
            meId={user._id}
            onSend={async (p) => {
              await send({ kind: "clan", clanId, ...(p as any) });
            }}
          />
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
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [bgUrl, setBgUrl] = useState("");

  if (!detail) return null;
  const c = detail.clan;
  const isMember = !!detail.myRole;
  const myRole = detail.myRole;
  const isLeader = myRole === "leader";
  const isOfficer = myRole === "officer";
  const canPanel = isLeader || isOfficer;
  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = detail.myLastClaimDay === today;
  const members = detail.members.filter((m: any) =>
    m.username.toLowerCase().includes(search.toLowerCase()),
  );
  const topDonate = detail.topDonateToday.filter((m: any) =>
    m.username.toLowerCase().includes(search.toLowerCase()),
  );
  const [t1, t2, t3, ...restTop] = topDonate;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl p-3 pb-24">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Detail Clan</h1>
          {isMember && (
            <button
              onClick={async () => {
                try {
                  await leave();
                  toast.success("Kamu keluar dari clan");
                  onBack();
                  navigate("/clan");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
              className="ml-auto flex items-center gap-1 rounded-full border border-red-500/50 px-3 py-1.5 text-xs text-red-400"
            >
              <LogOut className="size-3.5" /> Keluar Clan
            </button>
          )}
        </div>

        {/* Kotak utama */}
        <div
          className="relative overflow-hidden rounded-2xl border border-amber-300/30"
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
          <div className="bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Avatar src={c.avatarUrl} seed={c.name} className="size-16" />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-lg font-black",
                    c.color === "golden" && "clan-color-golden",
                    c.color === "galaxy" && "clan-color-galaxy",
                    c.color === "oren" && "text-orange-400",
                    c.color === "merah" && "text-red-400",
                  )}
                >
                  {c.name}
                  {c.color === "golden" && <span className="ml-1">🪽🪽</span>}
                </p>
                <ClanTag icon={c.tagIcon} tag={c.tag} color={c.color} className="mt-1" />
              </div>
              <button
                onClick={() => setInfoOpen(true)}
                className="rounded-full border border-border p-2"
              >
                <Info className="size-4" />
              </button>
            </div>

            {isMember ? (
              <p className="mt-3 text-xs leading-5 text-zinc-300">
                {c.description ?? "Clan ini belum punya deskripsi. Semangat berdonasi!"}
              </p>
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
                className="mt-3 w-full rounded-xl bg-amber-300 py-2.5 text-sm font-bold text-black"
              >
                Request
              </button>
            )}
          </div>
        </div>

        {/* Member + umur */}
        <div className="mt-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex justify-between text-center text-sm">
            <div className="flex-1">
              <p className="font-bold text-amber-200">{c.memberCount}</p>
              <p className="text-xs text-muted-foreground">Jumlah Member</p>
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-200">{c.ageDays} hari</p>
              <p className="text-xs text-muted-foreground">Umur Clan</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Semakin lama umur clan mu, semakin banyak premium yang didapatkan seluruh member
          </p>
        </div>

        {/* Berlian + level */}
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 text-center">
          <Gem className="mx-auto size-8 text-cyan-300" />
          <p className="mt-1 text-2xl font-black text-amber-200">{c.diamonds}</p>
          <ClanLevelBar level={c.level} progress={c.levelProgress} cost={c.levelCost} />
          <div className="mt-3 space-y-2">
            <button
              disabled={!isMember || claimedToday}
              onClick={async () => {
                try {
                  const r = await claim();
                  toast.success(`Berhasil claim ${r.amount} berlian!`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
              className="w-full rounded-xl bg-cyan-500/90 py-2.5 text-sm font-bold text-black disabled:opacity-40"
            >
              {claimedToday ? "Sudah claim hari ini" : `Claim Berlian (${c.claimAmount})`}
            </button>
            <button
              disabled={!isMember}
              onClick={() => setDonateOpen(true)}
              className="w-full rounded-xl border border-amber-300/50 py-2.5 text-sm font-bold text-amber-200 disabled:opacity-40"
            >
              Donate
            </button>
          </div>
        </div>

        {isMember && (
          <>
            {/* Cari member */}
            <div className="mt-3 flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari member…"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
              <button className="rounded-xl bg-amber-300 px-4 text-sm font-bold text-black">
                Cari
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {(["member", "top"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative flex-1 rounded-lg py-2 text-sm font-medium",
                    tab === t ? "text-amber-200" : "text-muted-foreground",
                  )}
                >
                  {t === "member" ? "Member" : "Top Donate"}
                  {tab === t && (
                    <span className="absolute inset-x-8 bottom-0 h-0.5 rounded bg-amber-300" />
                  )}
                </button>
              ))}
              {canPanel && (
                <button
                  onClick={() => setPanelOpen(true)}
                  className="rounded-lg border border-border px-3 text-sm"
                >
                  Request ({detail.requests.length})
                </button>
              )}
            </div>

            {tab === "member" && (
              <div className="mt-2 space-y-2">
                {members.map((m: any) => {
                  const badge = CLAN_ROLE_BADGE[m.role] ?? CLAN_ROLE_BADGE.member;
                  return (
                    <div
                      key={m.userId}
                      className="relative overflow-hidden rounded-xl border border-border/70"
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
                      <div className="flex items-center gap-3 bg-black/45 p-2.5 backdrop-blur-[2px]">
                        <Avatar src={m.image} seed={m.username} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{m.username}</p>
                          <ShineBadge label={badge.name} gradient={badge.cls} className="mt-0.5" />
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-cyan-300">
                            💎 {m.donatedTotal}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            join {Math.max(0, Math.floor((Date.now() - m.joinedAt) / 86400000))} hari lalu
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "top" && (
              <div className="mt-2">
                <p className="mb-2 rounded-xl bg-secondary/50 p-2.5 text-center text-xs">
                  Total donate hari ini terkumpul{" "}
                  <b className="text-cyan-300">{detail.todayDonationsTotal}</b> berlian dengan
                  total <b className="text-amber-200">{detail.todayDonators}</b> member donate
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
          <p className="mt-3 rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
            Claim & donate terbuka setelah kamu menjadi member clan ini.
          </p>
        )}

        {/* Panel leader/officer */}
        {canPanel && (
          <button
            onClick={() => setPanelOpen(true)}
            className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm"
          >
            <Settings className="mr-1.5 inline size-4" /> Panel {isLeader ? "Leader" : "Officer"}
          </button>
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
          <pre className="whitespace-pre-wrap text-xs leading-5 text-zinc-300">{ROLE_INFO}</pre>
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
      {void user}
      {void navigate}
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
    <div className="flex flex-col items-center rounded-t-xl border border-b-0 border-amber-300/40 bg-amber-300/10 pt-2">
      <span className="text-lg font-black text-amber-200">{rank}</span>
      <Avatar src={m.image} seed={m.username} className={cn("mt-1", big ? "size-14" : "size-11")} />
      <p className="line-clamp-1 max-w-full px-1 text-xs font-semibold">{m.username}</p>
      <p className="text-[10px] text-muted-foreground">Donate Hari Ini :</p>
      <p className="mb-1 text-xs font-bold text-cyan-300">💎 {m.donatedToday}</p>
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
      className="relative mb-2 overflow-hidden rounded-xl border border-border/70"
      style={
        m.bannerUrl
          ? { backgroundImage: `url(${m.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <div className="flex items-center gap-3 bg-black/45 p-2.5">
        <Avatar src={m.image} seed={m.username} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{m.username}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Donate Hari Ini :</p>
          <p className="text-xs font-bold text-cyan-300">💎 {m.donatedToday}</p>
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
        <Gem className="mx-auto size-10 text-cyan-300" />
        <p className="mt-1 text-xl font-black text-amber-200">{amount}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {DONATE_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            className={cn(
              "rounded-lg border py-2 text-sm font-semibold",
              amount === p ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-border",
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
        className="mt-3 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <button
        disabled={amount < 50}
        onClick={() => onDonate(amount)}
        className="mt-3 w-full rounded-xl bg-amber-300 py-2.5 text-sm font-bold text-black disabled:opacity-40"
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
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-amber-300/30 bg-card p-4"
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
  const voidClanId = clanId;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 p-3" onClick={onClose}>
      <div
        className="mx-auto max-w-md rounded-2xl border border-amber-300/30 bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">Panel {isLeader ? "Leader" : "Officer"}</p>
          <button onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
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
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                sub === k ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-border",
              )}
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
              <div key={r.requestId} className="flex items-center gap-2 rounded-xl border border-border/70 p-2.5">
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
                  className="rounded-full bg-red-500/20 p-1.5 text-red-400"
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
              className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            />
            <button
              onClick={async () => {
                await onBg(bgUrl);
                onClose();
              }}
              className="rounded-lg bg-amber-300 px-4 text-sm font-bold text-black"
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
                      role === r ? "border-amber-300 text-amber-200" : "border-border",
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
                      role === r ? "border-amber-300 text-amber-200" : "border-border",
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
                      "flex cursor-pointer items-center gap-2 rounded-xl border p-2",
                      picked === m.userId ? "border-amber-300" : "border-border/70",
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
                className="mt-3 w-full rounded-xl bg-amber-300 py-2.5 text-sm font-bold text-black"
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
        {void voidClanId}
      </div>
    </div>
  );
}

void Trophy;
void Crown;
