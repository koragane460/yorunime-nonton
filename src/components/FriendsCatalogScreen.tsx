import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck, ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  Search, UserPlus, Check, UserRound, X, MoreHorizontal, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Hit = {
  _id: string;
  username?: string;
  image?: string;
  level?: number;
  seqId?: number;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
};

export function FriendsCatalogScreen() {
  const [tab, setTab] = useState<"cari" | "teman" | "request">("cari");
  const [q, setQ] = useState("");
  const friends = useQuery(api.friends.listFriends, {});
  const requests = useQuery(api.friends.listRequests, {});
  const respond = useMutation(api.friends.respondRequest);

  return (
    <div className="space-y-3">
      {/* Tab: Teman → Cari (permintaan), plus Request. */}
      <div className="grid grid-cols-2 gap-2">
        {([
          ["cari", "Cari"],
          ["request", `Request (${requests?.length ?? 0})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-xl py-2.5 text-xs font-black transition",
              tab === k ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cari" && <CariTab />}

      {tab === "request" && (
        <div className="space-y-2">
          {(requests ?? []).length === 0 && (
            <p className="py-8 text-center text-xs font-bold text-zinc-500">Tidak ada request teman.</p>
          )}
          {(requests ?? []).map((r: any) => (
            <div key={r.requestId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
              <Avatar src={r.image} seed={r.username} className="size-10 shrink-0" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold">{r.username}</p>
              <button
                onClick={() => void respond({ requestId: r.requestId, accept: true })}
                className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 transition hover:bg-emerald-500/30"
                aria-label="Terima"
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={() => void respond({ requestId: r.requestId, accept: false }).catch(() => {})}
                className="flex size-9 items-center justify-center rounded-xl bg-red-500/20 text-red-300 transition hover:bg-red-500/30"
                aria-label="Tolak"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "teman" && (
        <div className="space-y-2">
          {(friends ?? []).map((f: any) => <FriendRow key={f.userId} f={f} />)}
        </div>
      )}
    </div>
  );
}

/* Kolom cari user dari username ATAU id (#). Hasil = kotak rounded. */
function CariTab() {
  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const isId = /^#?\d+$/.test(trimmed);
  const nameHits = useQuery(
    api.users.searchUsers,
    !isId && trimmed ? { q: trimmed } : "skip",
  );
  const idHit = useQuery(
    api.users.getUserBySeq,
    isId ? { seqId: parseInt(trimmed.replace("#", ""), 10) } : "skip",
  );

  const hits: Hit[] = useMemo(() => {
    if (isId) return idHit ? [idHit as Hit] : [];
    return (nameHits ?? []) as Hit[];
  }, [isId, idHit, nameHits]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2.5">
        <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari username atau id…"
          className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600"
        />
      </div>

      <div className="space-y-2">
        {trimmed && hits.length === 0 && (
          <p className="py-6 text-center text-xs font-bold text-zinc-500">Tidak ditemukan.</p>
        )}
        {hits.map((h) => <SearchResultCard key={h._id} h={h} />)}
      </div>
    </div>
  );
}

/* Kotak hasil: photo, nama + tag clan + id. Ditekan → bottom sheet. */
function SearchResultCard({ h }: { h: Hit }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const status = useQuery(
    api.friends.statusWith,
    h._id ? { toUserId: h._id as Id<"users"> } : "skip",
  );
  const sendReq = useMutation(api.friends.sendFriendRequest);
  const navigate = useNavigate();

  const add = async () => {
    if (sent || status === "pending" || status === "friend") return;
    try {
      await sendReq({ toUserId: h._id as Id<"users"> });
      setSent(true);
      toast.success("Request terkirim");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal kirim request");
    }
  };

  const requestLabel =
    sent || status === "pending" ? "Terkirim" : status === "friend" ? "Teman" : "Add Friend";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left transition hover:bg-white/10"
      >
        <Avatar src={h.image} seed={h.username} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">{h.username ?? "user"}</p>
            {h.clanTag && (
              <ClanTag
                icon={h.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={h.clanTag}
                color={h.clanNameColor}
                className="shrink-0 scale-[0.72] px-1 py-0 text-[9px]"
              />
            )}
          </div>
          <p className="text-xs text-white/50">
            {h.seqId !== undefined ? `#${h.seqId}` : h.level !== undefined ? `Lv.${h.level}` : ""}
          </p>
        </div>
      </button>

      {/* BOTTOM SHEET — full ke samping, tanpa rounded, di paling bawah. */}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full animate-[sheet-up_0.28s_cubic-bezier(0.22,1,0.36,1)] border-t border-white/15 bg-neutral-900 pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2.5">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>
            <button
              onClick={() => { setOpen(false); navigate(`/akun?user=${h._id}`); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
                <UserRound className="size-5 text-white/85" />
              </span>
              <span className="text-sm font-bold">Lihat Profile</span>
            </button>
            <button
              onClick={() => void add()}
              disabled={status === "friend"}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 disabled:opacity-60",
                "border-t border-white/10",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
                {requestLabel === "Terkirim" ? (
                  <Check className="size-5 text-emerald-300" />
                ) : requestLabel === "Teman" ? (
                  <Heart className="size-5 text-pink-300" />
                ) : (
                  <UserPlus className="size-5 text-white/85" />
                )}
              </span>
              <span className="text-sm font-bold">{requestLabel}</span>
            </button>
            <div className="h-3" />
          </div>
        </div>
      )}
    </>
  );
}

function FriendRow({ f }: { f: any }) {
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
      <Avatar src={f.image} seed={f.username} className="size-10 shrink-0" />
      <button
        onClick={() => navigate(`/akun?user=${f.userId}`)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-bold">{f.username}</p>
      </button>
      <button
        onClick={() => setMenu((v) => !v)}
        aria-label="Aksi"
        className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu && <FriendSheet username={f.username} onClose={() => setMenu(false)} />}
    </div>
  );
}

/* Sheet aksi teman (Give Premium dkk) — muncul di paling bawah. */
function FriendSheet({ username, onClose }: { username: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full border-t border-white/15 bg-neutral-900 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center py-2.5">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <p className="px-4 pb-2 text-center text-xs font-bold text-white/50">{username}</p>
        <button className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3.5 text-left hover:bg-white/5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20">
            <Heart className="size-5 text-amber-300" />
          </span>
          <span className="text-sm font-bold">Give Premium</span>
        </button>
        <div className="h-3" />
      </div>
    </div>
  );
}
