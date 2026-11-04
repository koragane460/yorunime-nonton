import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RoomSheet, CreateRoomSheet, type Room } from "@/components/NobarBar";
import { Avatar } from "@/components/lstream-ui";
import {
  Users,
  Video,
  LogIn,
  Search,
  Loader2,
  Play,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export function NobarCatalogScreen({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const rooms = useQuery(api.watchroom.listRooms, {});
  const join = useMutation(api.watchroom.joinRoom);

  const [listOpen, setListOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Filter daftar room: semua / publik / clan. */
  const [scope, setScope] = useState<"all" | "publik" | "clan">("all");
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // Error inline (toaster dimatikan permanen).
  const [err, setErr] = useState<string | null>(null);

  // Cari room lewat kode undangan.
  const found = useQuery(
    api.watchroom.findByCode,
    code.trim().length >= 2 ? { code: code.trim() } : "skip",
  );

  const joinFound = async () => {
    if (!found) return;
    setErr(null);
    setBusy(true);
    try {
      await join({ roomId: found._id });
      // WAJIB bawa ?room=<id> — tanpa ini halaman nonton tidak pernah
      // tahu sedang masuk room dan macet di layar "Memuat…".
      onClose();
      navigate(`/nonton?room=${found._id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal join room");
    } finally {
      setBusy(false);
    }
  };

  /** Semua jalur masuk room berakhir di sini — selalu membawa ?room=<id>. */
  const onJoined = (roomId?: string) => {
    setListOpen(false);
    setCreating(false);
    onClose();
    navigate(roomId ? `/nonton?room=${roomId}` : "/nonton");
  };

  return (
    <div className="space-y-4">
      {err && (
        <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200">
          {err}
        </p>
      )}
      {/* ------- SATU KOTAK: judul Nobar + Buat/Join digabung ---------- */}
      {/* Tanpa glow/gradien ungu: hanya permukaan netral + aksen palet
          (Sky untuk Buat Room, Harvest untuk Join Room). */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        {/* Hero — ikon teman + judul, MENYATU dengan kotak aksi di bawah. */}
        <div className="flex flex-col items-center border-b border-white/10 px-4 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-[#1CA7EC]/30 bg-[#1CA7EC]/12">
            <Users className="size-7 text-[#7fd3f7]" aria-hidden />
          </span>
          <p className="mt-2.5 text-xl font-black leading-none text-[#FFFAF0]">Nobar</p>
          <p className="mt-1.5 text-xs text-white/55">
            nonton bareng temenmu agar makin asik
          </p>
        </div>

        {/* Dua tombol aksi — SEBARIS di kotak yang sama (tidak dipisah). */}
        <div className="grid grid-cols-2">
          <button
            onClick={() => setCreating(true)}
            className="flex flex-col items-center gap-2 border-r border-white/10 py-5 transition hover:bg-white/[0.06] active:scale-[0.98]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#1CA7EC]/35 bg-[#1CA7EC]/15">
              <Video className="size-5 text-[#1CA7EC]" aria-hidden />
            </span>
            <span className="text-sm font-extrabold text-white">Buat Room</span>
          </button>
          <button
            onClick={() => setJoinOpen((v) => !v)}
            className="flex flex-col items-center gap-2 py-5 transition hover:bg-white/[0.06] active:scale-[0.98]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#FFD23F]/35 bg-[#FFD23F]/12">
              <LogIn className="size-5 text-[#FFD23F]" aria-hidden />
            </span>
            <span className="text-sm font-extrabold text-white">Join Room</span>
          </button>
        </div>

      </div>

      {/* Filter room: DUA KOTAK TERPISAH di bawah kartu besar, gayanya juga
          beda (Publik biru Sky, Clan kuning Harvest). Ketuk judul lagi untuk
          kembali menampilkan semua room. */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setScope((v) => (v === "publik" ? "all" : "publik"))}
          aria-pressed={scope === "publik"}
          className={
            scope === "publik"
              ? "flex flex-col items-start gap-1 rounded-2xl border border-[#1CA7EC] bg-[#1CA7EC]/18 p-3 text-left transition active:scale-[0.98]"
              : "flex flex-col items-start gap-1 rounded-2xl border border-[#1CA7EC]/30 bg-white/[0.04] p-3 text-left transition hover:border-[#1CA7EC]/60 active:scale-[0.98]"
          }
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#1CA7EC]/20">
            <Globe className="size-4 text-[#7fd3f7]" aria-hidden />
          </span>
          <span className="text-[13px] font-black text-white">Publik</span>
          <span className="text-[10px] leading-snug text-white/50">
            Room terbuka untuk semua orang
          </span>
        </button>
        <button
          onClick={() => setScope((v) => (v === "clan" ? "all" : "clan"))}
          aria-pressed={scope === "clan"}
          className={
            scope === "clan"
              ? "flex flex-col items-start gap-1 rounded-2xl border border-[#FFD23F] bg-[#FFD23F]/15 p-3 text-left transition active:scale-[0.98]"
              : "flex flex-col items-start gap-1 rounded-2xl border border-[#FFD23F]/30 bg-white/[0.04] p-3 text-left transition hover:border-[#FFD23F]/60 active:scale-[0.98]"
          }
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#FFD23F]/20">
            <Users className="size-4 text-[#FFD23F]" aria-hidden />
          </span>
          <span className="text-[13px] font-black text-white">Clan</span>
          <span className="text-[10px] leading-snug text-white/50">
            Room khusus anggota clan
          </span>
        </button>
      </div>

      {/* ------- PANEL JOIN — muncul DI BAWAH kotak ------- */}
      {joinOpen && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Masukkan kode room…"
              className="w-full bg-transparent text-sm font-bold uppercase outline-none placeholder:text-zinc-600 placeholder:normal-case"
            />
          </div>

          {found && (
            <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-2.5">
              {found.animeImage ? (
                <img src={found.animeImage} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                  <Video className="size-5 text-primary" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{found.name}</span>
                <span className="block truncate text-[11px] text-white/50">
                  Host: {found.hostName} · {found.animeTitle} · Ep {found.episode}
                </span>
              </span>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setJoinOpen(false);
                setCode("");
              }}
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-xs font-black text-zinc-300 transition active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              onClick={() => void joinFound()}
              disabled={!found || busy}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-black text-white transition active:scale-[0.98] disabled:opacity-45"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
              Join
            </button>
          </div>

          {/* Masih mencari (query belum balik) → jangan bilang "tidak
              ditemukan" dulu; kasih tahu bahwa carinya butuh waktu. */}
          {code.trim().length >= 2 && found === undefined && (
            <p className="mt-2 text-center text-[11px] text-white/40">
              Mencari room… memerlukan 1-10 detik, sabar ya…
            </p>
          )}
          {code.trim().length >= 2 && found === null && (
            <p className="mt-2 text-center text-[11px] text-white/40">
              Room tidak ditemukan atau sudah bubar.
            </p>
          )}
        </div>
      )}

      {/* ------- DAFTAR ROOM — grid ke bawah ------- */}
      <div className="grid gap-2.5">
        {/* Query belum balik → tampilin kotak loading, bukan "belum ada
            room" (dulu kebaca sebagai room kosong padahal masih memuat). */}
        {rooms === undefined && (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-indigo-400/25 bg-white/[0.04] px-4 py-7 text-center">
            <Loader2 className="size-5 animate-spin text-indigo-300" aria-hidden />
            <p className="text-xs font-bold text-white/80">Memuat kotak nobar…</p>
            <p className="text-[11px] text-white/50">
              Memerlukan 1-10 detik, sabar ya…
            </p>
          </div>
        )}
        {rooms !== undefined && rooms.length === 0 && (
          <p className="py-8 text-center text-xs font-bold text-zinc-500">
            Belum ada room aktif — jadilah host pertama.
          </p>
        )}
        {(rooms ?? [])
          .filter((r) =>
            scope === "all" ? true : scope === "clan" ? !!r.clanId : !r.clanId,
          )
          .map((r) => (
            <RoomCard key={r._id} room={r} busy={busy} onJoin={() => void doJoin(r._id)} />
          ))}
      </div>

      {listOpen && (
        <RoomSheet
          rooms={(rooms ?? []) as Room[]}
          onClose={() => setListOpen(false)}
          onJoined={onJoined}
          onCreate={() => {
            setListOpen(false);
            setCreating(true);
          }}
        />
      )}
      {creating && <CreateRoomSheet onClose={() => setCreating(false)} onCreated={onJoined} />}
    </div>
  );

  async function doJoin(roomId: Room["_id"]) {
    setErr(null);
    setBusy(true);
    try {
      await join({ roomId });
      onJoined(roomId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal join room");
    } finally {
      setBusy(false);
    }
  }
}

/** Kotak room: kode undangan ditampilin RAPI + tombol Join. */
function RoomCard({
  room,
  busy,
  onJoin,
}: {
  room: Room;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] transition hover:border-white/25">
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0">
          {room.animeImage ? (
            <img src={room.animeImage} alt="" className="size-16 rounded-xl object-cover" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-xl bg-primary/20">
              <Video className="size-6 text-primary" />
            </div>
          )}
          {room.playing && (
            <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-500">
              <Play className="size-2.5 fill-white text-white" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">{room.name}</p>
            {room.clanId ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#1CA7EC]/45 bg-[#1CA7EC]/12 px-2 py-0.5 text-[9px] font-bold text-[#7fd3f7]">
                <Users className="size-2.5" /> Clan
              </span>
            ) : room.visibility === "selected" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#FFD23F]/45 bg-[#FFD23F]/10 px-2 py-0.5 text-[9px] font-bold text-[#FFD23F]">
                <ShieldCheck className="size-2.5" /> Orang tertentu
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold text-white/70">
                <Globe className="size-2.5" /> Publik
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-white/50">
            {room.animeTitle} · Ep {room.episode}
          </p>

          {/* Kode room — ditampilin menonjol (kotak monospace + aksen). */}
          {room.inviteCode && (
            <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-400/10 px-2 py-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-300/80">Kode</span>
              <span className="font-mono text-[13px] font-black tracking-[0.18em] text-amber-200">
                {room.inviteCode}
              </span>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
            <Avatar src={room.hostImage} seed={room.hostName} className="size-4" />
            <span className="truncate">Host: {room.hostName}</span>
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              <Users className="size-3" /> {room.memberCount}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-2">
        <button
          disabled={busy}
          onClick={onJoin}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-black text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          <Play className="size-3" />
          {room.joined ? "Masuk Lagi" : "Join"}
        </button>
      </div>
    </div>
  );
}
