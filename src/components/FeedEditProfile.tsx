import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { useAuth } from "@/hooks/use-auth";
import { shrinkAvatar } from "@/lib/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Pencil, User, X } from "lucide-react";
import {
  TierBadgePickerRow,
  TierRewardsSheet,
  type TierKind,
} from "@/components/FeedTierBadges";

export function FeedEditProfileSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const profile = useQuery(
    api.account.getPublicProfile,
    user ? { userId: user._id } : "skip",
  ) as
    | {
        username?: string;
        image?: string;
        bio?: string;
        pinnedTierBadge?: string | null;
        premium?: boolean;
      }
    | null
    | undefined;
  const counts = useQuery(
    api.feed.followCounts,
    user ? { userId: user._id } : "skip",
  ) as { followers: number; likes: number } | undefined;
  const updateProfile = useMutation(api.account.updateProfile);
  const pinTier = useMutation(api.account.setPinnedTierBadge);
  const [username, setUsername] = useState(profile?.username ?? user?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [pinned, setPinned] = useState<string | null>(
    profile?.pinnedTierBadge ?? null,
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const myImage = profile?.image ?? user?.image;

  useEffect(() => {
    if (!profile) return;
    setUsername((v) => v || profile.username || user?.username || "");
    setBio((v) => v || profile.bio || "");
    setPinned((v) => v ?? profile.pinnedTierBadge ?? null);
  }, [profile?.username, profile?.bio, profile?.pinnedTierBadge, profile, user?.username]);

  if (!user) return null;
  const clean = username.trim();
  const changed =
    clean !== (profile?.username ?? user.username ?? "") ||
    bio.trim() !== (profile?.bio ?? "");

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setErr("");
    void (async () => {
      try {
        const small = await shrinkAvatar(file);
        await updateProfile({ image: small });
        toast.success("Foto profil diperbarui");
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Gagal mengganti foto");
      } finally {
        setPhotoBusy(false);
      }
    })();
  };

  const save = async () => {
    if (saving) return;
    if (clean.length < 3) {
      setErr("Username minimal 3 karakter");
      return;
    }
    if (!changed && pinned === (profile?.pinnedTierBadge ?? null)) {
      onClose();
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (changed) {
        await updateProfile({
          username: clean !== (profile?.username ?? "") ? clean : undefined,
          bio: bio.trim() !== (profile?.bio ?? "") ? bio.trim() : undefined,
        });
      }
      if (pinned !== (profile?.pinnedTierBadge ?? null)) {
        await pinTier({ badgeId: pinned });
      }
      toast.success("Profil Feed diperbarui");
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[124] flex flex-col bg-[#0b0c11] text-white">
      <div className="flex items-center px-4 pb-2 pt-[max(env(safe-area-inset-top),0.8rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup edit profil"
          className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/75"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[16px] font-black">Edit profil</h1>
          <p className="text-[9px] font-semibold text-white/30">Khusus Feed Mode</p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || photoBusy}
          className="rounded-full px-3 py-1.5 text-[11px] font-black text-[#67baff] disabled:opacity-40"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            className="relative rounded-full transition active:scale-95 disabled:opacity-60"
            aria-label="Ganti foto profil"
          >
            <Avatar
              src={myImage ?? undefined}
              seed={clean || "user"}
              className="size-[96px] ring-2 ring-white/25"
            />
            <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-[#0b0c11] bg-[#00c8ff] text-white">
              <Pencil className="size-3.5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            className="mt-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/60"
          >
            {photoBusy ? "Mengunggah…" : "Ganti foto"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickPhoto}
        />

        <label className="mt-5 block text-[9.5px] font-black uppercase tracking-[0.16em] text-white/38">
          Username
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/12 bg-black/30 px-3 focus-within:border-white/30">
          <User className="size-4 shrink-0 text-white/30" />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-bold text-white outline-none"
          />
          <span className="shrink-0 text-[9px] text-white/25">{clean.length}/20</span>
        </div>

        <label className="mt-4 block text-[9.5px] font-black uppercase tracking-[0.16em] text-white/38">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 160))}
          rows={3}
          placeholder="Tulis bio untuk profil Feed…"
          className="mt-1.5 w-full resize-none rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-[12px] leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-white/30"
        />
        <div className="mt-1 flex justify-end text-[9px] text-white/25">{bio.length}/160</div>

        <label className="mt-4 flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-white/38">
          Tier badge
        </label>
        <TierBadgePickerRow pinned={pinned} onOpen={() => setRewardsOpen(true)} />
        <p className="mt-1.5 text-[9px] leading-snug text-white/30">
          Badge ini hanya tampil di bawah username pada detail akun Feed Mode,
          bukan di halaman utama.
        </p>

        {profile?.premium && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.07] px-3 py-2.5">
            <BlueCheck className="size-4" />
            <span className="text-[10px] font-semibold text-sky-100/65">
              Akun premium · foto dan username tampil dengan centang biru
            </span>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10.5px] font-semibold text-rose-200">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || photoBusy || clean.length < 3}
          className={cn(
            "mt-5 w-full rounded-xl bg-white py-3 text-[12px] font-black text-black transition active:scale-[0.99]",
            (saving || photoBusy || clean.length < 3) && "opacity-40",
          )}
        >
          {saving ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>

      {rewardsOpen && (
        <TierRewardsSheet
          followers={counts?.followers ?? 0}
          likes={counts?.likes ?? 0}
          pinned={pinned}
          onPin={(id) => {
            setPinned(id as `${TierKind}:${number}`);
            setRewardsOpen(false);
            toast.success("Badge dipilih — simpan untuk memasang");
          }}
          onClose={() => setRewardsOpen(false)}
        />
      )}
    </div>
  );
}
