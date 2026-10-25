import { Avatar } from "@/components/lstream-ui";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { StripBackIcon } from "@/components/StripBack";
import {
  ChevronLeft,
  Globe,
  Loader2,
  LogOut,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Tv,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export type Room = {
  _id: Id<"watchRooms">;
  name: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episode: number;
  positionSec: number;
  playing: boolean;
  visibility: "all" | "selected";
  hostId: string;
  hostName: string;
  hostImage?: string;
  memberCount: number;
  isHost: boolean;
  joined: boolean;
  updatedAt: number;
};

/**
 * Bar Nobar di atas chat global. Dipencet → muncul daftar room aktif
 * beserta tombol join, dan tombol untuk membuat room baru.
 */
export function NobarBar({ onJoined }: { onJoined: (roomId: string) => void }) {
  const { user } = useAuth();
  const rooms = useQuery(api.watchroom.listRooms, user ? {} : "skip");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const live = (rooms ?? []).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 border-b border-border/60 bg-white/[0.04] px-3 py-2 text-left transition"
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/30">
          <Radio className="size-4 text-primary" />
          {live > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
              {live > 9 ? "9+" : live}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Nonton Bareng</span>
          <span className="block text-[10px] text-muted-foreground">
            {live > 0
              ? `${live} room lagi jalan — ikut sekarang`
              : "Belum ada room — buat sekarang"}
          </span>
        </span>
        <ChevronLeft className="size-4 rotate-180 text-zinc-400" />
      </button>

      {open && (
        <RoomSheet
          rooms={(rooms ?? []) as Room[]}
          onClose={() => setOpen(false)}
          onJoined={(id) => {
            setOpen(false);
            onJoined(id);
          }}
          onCreate={() => {
            setOpen(false);
            setCreating(true);
          }}
        />
      )}

      {creating && (
        <CreateRoomSheet
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onJoined(id);
          }}
        />
      )}
    </>
  );
}

// --------------------------------------------------------- daftar room ----

export function RoomSheet({
  rooms,
  onClose,
  onJoined,
  onCreate,
}: {
  rooms: Room[];
  onClose: () => void;
  onJoined: (roomId: string) => void;
  onCreate: () => void;
}) {
  const join = useMutation(api.watchroom.joinRoom);
  const leave = useMutation(api.watchroom.leaveRoom);
  const [busy, setBusy] = useState<string | null>(null);

  const doJoin = async (r: Room) => {
    setBusy(r._id);
    try {
      await join({ roomId: r._id });
      onJoined(r._id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal join");
    } finally {
      setBusy(null);
    }
  };

  return (
    // Layar penuh, bukan panel dari bawah: daftar room memenuhi layar dan
    // punya tombol "Buat" sendiri di pojok kanan.
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight">
            Nonton Bareng
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {rooms.length > 0
              ? `${rooms.length} room lagi jalan`
              : "Belum ada room aktif"}
          </p>
        </div>
        <button
          onClick={onCreate}
          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white"
        >
          Buat
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {rooms.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Belum ada room aktif. Kamu bisa jadi host pertama.
          </p>
        )}

        {rooms.map((r) => (
          <div
            key={r._id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex gap-3 p-3">
              <div className="relative shrink-0">
                {r.animeImage ? (
                  <img
                    src={r.animeImage}
                    alt=""
                    className="size-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-xl bg-primary/20">
                    <Tv className="size-6 text-primary" />
                  </div>
                )}
                {r.playing && (
                  <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-500">
                    <Play className="size-2.5 fill-white text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">
                    {r.name}
                  </p>
                  {r.visibility === "selected" ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                      <ShieldCheck className="size-2.5" /> Hanya orang tertentu
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      <Globe className="size-2.5" /> Semua orang
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.animeTitle} · Ep {r.episode} · {fmtSec(r.positionSec)}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <Avatar src={r.hostImage} seed={r.hostName} className="size-4" />
                  <span className="truncate">Host: {r.hostName}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    <Users className="size-3" /> {r.memberCount}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border/60 p-2">
              <button
                disabled={busy === r._id}
                onClick={() => void doJoin(r)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === r._id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Play className="size-3" />
                )}
                {r.joined ? "Masuk Lagi" : "Join"}
              </button>
              {r.joined && (
                <button
                  onClick={async () => {
                    try {
                      await leave({ roomId: r._id });
                      toast.success("Keluar dari room");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <LogOut className="size-3" /> Keluar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/80 backdrop-blur-sm">
      <div className="fade-enter max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-background p-4">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border p-2"
            aria-label="Tutup"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ---------------------------------------------------------- buat room ----

export function CreateRoomSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const create = useMutation(api.watchroom.createRoom);
  const searchAnime = useAction(api.anime.animeSearch);
  const searchDonghua = useAction(api.sanka.donghuaSearchCards);
  const detail = useAction(api.anime.animeDetail);

  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  // Kolom pencarian anime untuk sementara disembunyikan sampai tombol "Cari" ditekan,
  // supaya panel buat room tidak langsung penuh dengan isian.
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[] | null>(null);
  const [epInput, setEpInput] = useState("1");
  const [visibility, setVisibility] = useState<"all" | "selected">("all");
  const [pickedUsers, setPickedUsers] = useState<any[]>([]);
  const [uQ, setUQ] = useState("");
  const [busy, setBusy] = useState(false);

  const userList = useQuery(
    api.watchroom.searchUsers,
    uQ.trim().length > 0 ? { q: uQ } : "skip",
  );

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        // Cari anime dulu; kalau tidak ada yang cocok, coba donghua — satu
        // kolom untuk keduanya, sama seperti di Home.
        let r = ((await searchAnime({ q: q.trim() })) as any[]) ?? [];
        if (r.length === 0) {
          r = ((await searchDonghua({ q: q.trim() })) as any[]) ?? [];
        }
        if (alive) setResults(r);
      } catch {
        if (alive) setResults([]);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, searchAnime, searchDonghua]);

  const animeIdOf = (a: any) =>
    String(a?.id ?? a?.malId ?? a?.animeId ?? a?.anilistId ?? "");

  const pickAnime = async (a: any) => {
    setPicked(a);
    setResults(null);
    setQ(a.title ?? "");
    setEpisodes(null);
    setEpInput("1");
    const id = animeIdOf(a);
    if (!id) return;
    try {
      const d: any = await detail({ id });
      const list: any[] = d?.episodeList ?? [];
      setEpisodes(list);
    } catch {
      setEpisodes([]);
    }
  };

  const submit = async () => {
    if (!picked) {
      toast.error("Pilih anime dulu");
      return;
    }
    const animeId = animeIdOf(picked);
    if (!animeId) {
      toast.error("Anime tidak valid");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Nama room minimal 2 karakter");
      return;
    }
    if (visibility === "selected" && pickedUsers.length === 0) {
      toast.error("Pilih minimal 1 orang");
      return;
    }
    setBusy(true);
    try {
      const r = await create({
        name: name.trim(),
        animeId,
        animeTitle: picked.title,
        animeImage: picked.image,
        episode: Math.max(1, Math.floor(Number(epInput) || 1)),
        visibility,
        allowedUserIds: pickedUsers.map((u) => u._id),
      });
      toast.success("Room dibuat — kamu jadi host");
      onCreated(r.roomId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Bikin Room" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Anime yang ditonton
            </label>
            {/* Tombol "Cari" membuka kolom pencarian. Kolomnya disembunyikan
                sampai diminta supaya panel buat room tidak terasa penuh. */}
            {!searchOpen && (
              <button
                onClick={() => setSearchOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              >
                <Search className="size-3" /> Cari
              </button>
            )}
          </div>
          {searchOpen && (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Judul anime atau donghua…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setQ("");
                  setResults(null);
                }}
                aria-label="Tutup pencarian"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
          {picked ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-foreground/40 bg-primary/10 p-2">
              {picked.image && (
                <img
                  src={picked.image}
                  alt=""
                  className="size-12 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{picked.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  Anime dipilih
                </p>
              </div>
              <button onClick={() => setPicked(null)} className="p-1">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            results && (
              <div className="thin-scroll mt-2 max-h-48 space-y-1 overflow-y-auto">
                {results.length === 0 && (
                  <p className="py-3 text-center text-[11px] text-muted-foreground">
                    Anime tidak ditemukan
                  </p>
                )}
                {results.map((a: any) => (
                  <button
                    key={animeIdOf(a)}
                    onClick={() => void pickAnime(a)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 p-1.5 text-left hover:border-foreground/40"
                  >
                    {a.image && (
                      <img
                        src={a.image}
                        alt=""
                        className="size-9 rounded-md object-cover"
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
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nama room
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: ayanokoji adalah aku"
            className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Episode
          </label>
          {Array.isArray(episodes) && episodes.length > 0 ? (
            <select
              value={epInput}
              onChange={(e) => setEpInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
            >
              {episodes.map((e: any) => (
                <option
                  key={String(e.id ?? e.number)}
                  value={String(e.number ?? e.id)}
                >
                  Episode {e.number ?? e.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              value={epInput}
              onChange={(e) => setEpInput(e.target.value)}
              placeholder="1"
              className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
            />
          )}
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Siapa yang boleh masuk
          </label>
          <div className="mt-1 flex gap-1.5">
            {(
              [
                ["all", "Semua orang"],
                ["selected", "Orang tertentu"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-xl border py-2 text-xs font-bold transition",
                  visibility === v
                    ? "border-foreground/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {visibility === "selected" && (
            <div className="fade-enter mt-2 space-y-1.5">
              {pickedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pickedUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() =>
                        setPickedUsers((s) => s.filter((x) => x._id !== u._id))
                      }
                      className="flex items-center gap-1 rounded-full border border-foreground/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold"
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
              {Array.isArray(userList) && userList.length > 0 && (
                <div className="thin-scroll max-h-40 space-y-1 overflow-y-auto">
                  {userList.map((u: any) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        setPickedUsers((s) =>
                          s.some((x) => x._id === u._id) ? s : [...s, u],
                        );
                        setUQ("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-border/60 p-1.5 text-left hover:border-foreground/40"
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

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground"
          >
            Batal
          </button>
          <button
            disabled={busy}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Membuat…" : "Buat & Masuk"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
