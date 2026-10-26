import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/lstream-ui";
import { Heart, Search, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AZ = ["Semua", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

export function VoteCatalogScreen({
  kind,
  onKindChange,
  onClose,
}: {
  kind: "waifu" | "husbu";
  onKindChange: (k: "waifu" | "husbu") => void;
  onClose: () => void;
}) {
  const board = useQuery(api.waifuVotes.board, { kind });
  const doVote = useMutation(api.waifuVotes.vote);
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState("Semua");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => {
    let list = board?.items ?? [];
    if (q.trim())
      list = list.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (letter !== "Semua")
      list = list.filter((c) => c.name.toUpperCase().startsWith(letter));
    return list;
  }, [board?.items, q, letter]);

  const vote = async (id: string) => {
    if (!board?.loggedIn) {
      toast.error("Masuk akun dulu untuk vote");
      return;
    }
    if (board.votedToday) {
      toast.error("Kamu sudah vote hari ini — vote lagi besok.");
      return;
    }
    setBusy(id);
    try {
      await doVote({ kind, candidateId: id as Id<"waifuVoteCandidates"> });
      toast.success("Vote terkirim ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal vote");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Kepala: judul + titik tiga (di dalam KOTAK SENDIRI, di luar kotak
          konten) buat ganti jenis vote (Waifu ⇄ Husbu). Tiap pilihan juga
          kotaknya masing-masing — tidak digabung jadi satu list. */}
      <div className="relative flex items-center gap-2 pr-1">
        <h2 className="flex-1 text-lg font-extrabold capitalize">Vote {kind}</h2>
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Ganti jenis vote"
            className="flex size-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] text-white/85 transition active:scale-90"
          >
            <MoreHorizontal className="size-5" />
          </button>
          {menu && (
            <div className="absolute right-0 top-11 z-30 flex w-44 flex-col gap-2">
              <button
                onClick={() => { onKindChange(kind === "waifu" ? "husbu" : "waifu"); setMenu(false); }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/12 bg-neutral-900/95 px-3.5 py-3 text-left text-[13px] font-bold text-white/90 shadow-2xl backdrop-blur-xl transition hover:bg-white/10"
              >
                <Heart className="size-4 text-pink-300" />
                {kind === "waifu" ? "Vote Husbu" : "Vote Waifu"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kolom cari nama character. */}
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2">
        <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama character…"
          className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Filter A-Z + Semua. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {AZ.map((l) => (
          <button
            key={l}
            onClick={() => setLetter(l)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition",
              letter === l ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {board?.votedToday && (
        <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/20">
          Kamu sudah vote hari ini — vote lagi besok.
        </p>
      )}

      {/* Grid kartu character: gambar + nama + tombol Vote. */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((c) => {
          const votedThis = board?.votedCandidateId === c.id;
          return (
            <div
              key={c.id}
              className={cn(
                "overflow-hidden rounded-3xl border bg-gradient-to-b from-zinc-900 to-black shadow-lg shadow-black/40 transition",
                votedThis ? "border-pink-400/60" : "border-white/10",
              )}
            >
              <div className="relative aspect-[3/4] w-full bg-black">
                {c.image ? (
                  <img src={c.image} alt={c.name} loading="lazy" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <Avatar seed={c.name} className="absolute inset-0 size-full" />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-black text-white ring-1 ring-white/15 backdrop-blur-sm">
                  {c.votes.toLocaleString("id-ID")} vote
                </span>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 to-transparent" />
                <p className="absolute inset-x-0 bottom-1.5 truncate px-2 text-center text-xs font-extrabold text-white drop-shadow">
                  {c.name}
                </p>
              </div>
              <div className="p-2.5">
                <button
                  onClick={() => void vote(c.id)}
                  disabled={busy === c.id || board?.votedToday}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-black transition disabled:opacity-50",
                    votedThis ? "bg-pink-500 text-white" : "bg-white/12 text-white hover:bg-white/20",
                  )}
                >
                  <Heart className={cn("size-3.5", votedThis && "fill-current")} />
                  {votedThis ? "Voted" : "Vote"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="py-10 text-center text-xs font-bold text-zinc-500">
          Belum ada karakter{letter !== "Semua" ? ` di huruf ${letter}` : ""}.
        </p>
      )}
    </div>
  );
}
