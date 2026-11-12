import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Heart, ListPlus, Loader2, Plus, X } from "lucide-react";

export type BookmarkItem = {
  id: string;
  title: string;
  image?: string;
  kind?: string;
  status?: string;
};

/**
 * Sheet pilihan playlist bookmark. Default = Subscribe (favorites), playlist
 * lain disimpan di tabel bookmarkLists/bookmarkItems.
 */
export function BookmarkPickerSheet({
  item,
  defaultSaved,
  onToggleDefault,
  onClose,
}: {
  item: BookmarkItem;
  defaultSaved: boolean;
  onToggleDefault?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const lists = useQuery(api.bookmarks.myLists, {}) as
    | { _id: Id<"bookmarkLists">; name: string; count: number }[]
    | undefined;
  const member = useQuery(api.bookmarks.itemLists, { itemId: item.id }) as
    | Id<"bookmarkLists">[]
    | undefined;
  const createList = useMutation(api.bookmarks.createList);
  const addItem = useMutation(api.bookmarks.addItem);
  const removeItem = useMutation(api.bookmarks.removeItem);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localSaved, setLocalSaved] = useState<boolean>(defaultSaved);

  const create = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const listId = await createList({ name: clean });
      await addItem({
        listId,
        itemId: item.id,
        title: item.title,
        image: item.image,
        kind: item.kind ?? "anime",
        status: item.status,
      });
      setName("");
      setCreating(false);
      toast.success(`Playlist "${clean}" dibuat`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat playlist");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (listId: Id<"bookmarkLists">) => {
    const has = (member ?? []).includes(listId);
    try {
      if (has) {
        await removeItem({ listId, itemId: item.id });
      } else {
        await addItem({
          listId,
          itemId: item.id,
          title: item.title,
          image: item.image,
          kind: item.kind ?? "anime",
          status: item.status,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui bookmark");
    }
  };

  const toggleDefault = async () => {
    if (!onToggleDefault) return;
    try {
      await onToggleDefault();
      setLocalSaved((v) => !v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui Subscribe");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/65" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[28px] border-t border-white/15 bg-[#111116] pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-gold">
            <ListPlus className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-white">Simpan ke bookmark</p>
            <p className="truncate text-[10px] text-white/40">{item.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/55"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="thin-scroll max-h-[48vh] space-y-1.5 overflow-y-auto px-4 py-2">
          <button
            onClick={() => void toggleDefault()}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
              localSaved
                ? "border-gold/35 bg-gold/[0.08]"
                : "border-white/10 bg-white/[0.035]",
            )}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06]">
              <Heart className={cn("size-4", localSaved ? "fill-gold text-gold" : "text-white/50")} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-black text-white">Default</span>
              <span className="block text-[9px] text-white/35">Subscribe bawaan akun</span>
            </span>
            {localSaved && <Check className="size-4 text-gold" />}
          </button>

          {(lists ?? []).map((l) => {
            const has = (member ?? []).includes(l._id);
            return (
              <button
                key={l._id}
                onClick={() => void toggle(l._id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                  has ? "border-sky-300/35 bg-sky-400/[0.08]" : "border-white/10 bg-white/[0.035]",
                )}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-[11px] font-black text-white/55">
                  {l.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-black text-white">
                    {l.name} <span className="font-semibold text-white/35">({l.count})</span>
                  </span>
                  <span className="block text-[9px] text-white/35">Playlist bookmark</span>
                </span>
                {has && <Check className="size-4 text-sky-300" />}
              </button>
            );
          })}
          {lists === undefined && (
            <div className="grid h-14 place-items-center">
              <Loader2 className="size-4 animate-spin text-white/35" />
            </div>
          )}
        </div>

        <div className="px-4 pt-2">
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
                maxLength={40}
                placeholder="Nama playlist baru…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/12 bg-black/30 px-3 text-[12px] outline-none placeholder:text-white/30 focus:border-sky-300/45"
              />
              <button
                onClick={() => void create()}
                disabled={!name.trim() || busy}
                className="shrink-0 rounded-xl bg-white px-3 text-[11px] font-black text-black disabled:opacity-40"
              >
                {busy ? "…" : "Buat"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[11px] font-black text-white/65"
            >
              <Plus className="size-3.5" /> Playlist baru
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
