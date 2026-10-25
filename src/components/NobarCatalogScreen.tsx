import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RoomSheet, CreateRoomSheet, type Room } from "@/components/NobarBar";
import { Avatar } from "@/components/lstream-ui";
import { Radio, KeyRound, Search, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export function NobarCatalogScreen({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const rooms = useQuery(api.watchroom.listRooms, {});
  const join = useMutation(api.watchroom.joinRoom);

  const [listOpen, setListOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Cari room lewat kode undangan / nama host.
  const found = useQuery(
    api.watchroom.findByCode,
    code.trim().length >= 2 ? { code: code.trim() } : "skip",
  );

  const joinFound = async () => {
    if (!found) return;
    setBusy(true);
    try {
      await join({ roomId: found._id });
      toast.success(`Masuk room "${found.name}"`);
      onClose();
      navigate("/nonton");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal join");
    } finally {
      setBusy(false);
    }
  };

  const onJoined = () => {
    setListOpen(false);
    setCreating(false);
    onClose();
    navigate("/nonton");
  };

  return (
    <div className="space-y-4">
      {/* Kartu utama: pilih room aktif / buat room / join lewat kode. */}
      <div className="grid gap-3">
        <button
          onClick={() => setListOpen(true)}
          className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-rose-300 to-pink-400 p-4 text-white shadow-lg ring-1 ring-rose-400/40 transition active:scale-[0.98]"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/25">
            <Radio className="size-6" />
          </span>
          <span className="text-left">
            <span className="block text-base font-extrabold">Pilih Room</span>
            <span className="block text-xs opacity-90">
              {(rooms ?? []).length > 0
                ? `${(rooms ?? []).length} room lagi jalan`
                : "Belum ada room aktif"}
            </span>
          </span>
        </button>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-sky-300 to-blue-400 p-4 text-white shadow-lg ring-1 ring-sky-400/40 transition active:scale-[0.98]"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/25">
            <Play className="size-6" />
          </span>
          <span className="text-left">
            <span className="block text-base font-extrabold">Buat Room</span>
            <span className="block text-xs opacity-90">Jadi host — tonton bareng</span>
          </span>
        </button>
      </div>

      {/* Join lewat Kode undangan ATAU nama host. */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="size-4 text-amber-300" />
          <p className="text-sm font-extrabold">Join Room</p>
        </div>
        <p className="mb-3 text-[11px] text-white/50">
          Masukkan kode undangan atau nama host untuk langsung masuk.
        </p>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2.5">
          <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Kode undangan / nama host…"
            className="w-full bg-transparent text-sm font-bold uppercase outline-none placeholder:text-zinc-600 placeholder:normal-case"
          />
        </div>

        {found && (
          <button
            onClick={() => void joinFound()}
            disabled={busy}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-60"
          >
            {found.animeImage ? (
              <img src={found.animeImage} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                <Radio className="size-5 text-primary" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{found.name}</span>
              <span className="block truncate text-[11px] text-white/50">
                Host: {found.hostName} · {found.animeTitle} · Ep {found.episode}
              </span>
              {found.inviteCode && (
                <span className="mt-0.5 inline-block rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                  {found.inviteCode}
                </span>
              )}
            </span>
            {busy ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <Play className="size-4 shrink-0 text-white" />
            )}
          </button>
        )}
        {code.trim().length >= 2 && !found && (
          <p className="mt-3 text-center text-xs text-white/40">
            Room tidak ditemukan atau sudah bubar.
          </p>
        )}
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
}
