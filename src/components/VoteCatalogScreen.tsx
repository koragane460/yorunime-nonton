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
      {/* Kepala: judul + titik tiga ganti jenis vote (Waifu ⇄ Husbu). */}
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-extrabold capitalize">Vote {kind}</h2>
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Ganti jenis vote"
            className="flex size-9 items-center justify-center rounded-xl text-white/80 transition active:scale-90"
          >
            <MoreHorizontal className="size-5" />
          </button>
          {menu && (
            <div className="absolute right-0 top-11 z-30 w-40 overflow-hidden rounded-2xl border border-white/12 bg-neutral-900/95 shadow-2xl">
              <button
                onClick={() => { onKindChange(kind === "waifu" ? "husbu" : "waifu"); setMenu(false); }}
                className="lb-menu-item flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] font-bold text-white/90 hover:bg-white/10"
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
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((c) => {
          const votedThis = board?.votedCandidateId === c.id;
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
              <div className="relative aspect-[3/4] w-full bg-black">
                {c.image ? (
                  <img src={c.image} alt={c.name} loading="lazy" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <Avatar seed={c.name} className="absolute inset-0 size-full" />
                )}
                <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] font-black text-white">
                  {c.votes.toLocaleString("id-ID")} vote
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-center text-xs font-bold">{c.name}</p>
                <button
                  onClick={() => void vote(c.id)}
                  disabled={busy === c.id || board?.votedToday}
                  className={cn(
                    "mt-1.5 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-black transition disabled:opacity-50",
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
