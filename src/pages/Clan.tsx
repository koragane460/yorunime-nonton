import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowsLeftRight, Crown, Users, Star, Cpu, ShieldCheck, Bookmark, ChevronRight, ChevronLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { levelCost, CLAN_LEVELS_MAX, claimAmountForLevel } from "@/convex/clans";
import { Avatar, BlueCheck, StaffBadge, LvProgressBar } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Clan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);

  const joinTag = searchParams.get("join");
  const wantCreate = searchParams.get("create");
  const openCreate = wantCreate === "1";

  const myClan = useQuery(api.clans.myClan, user ? {} : "skip");
  const clan = myClan?.clan;

  useEffect(() => {
    if (openCreate) {
      setOpen(true);
      return;
    }
    if (joinTag) {
      void navigator.clipboard?.writeText(joinTag);
    }
  }, [openCreate, joinTag]);

  const joinClan = useMutation(api.clans.joinClan);
  const leaveClan = useMutation(api.clans.leaveClan);
  const createClan = useMutation(api.clans.createClan);
  const donate = useMutation(api.clans.donate);
  const claimDaily = useMutation(api.clans.claimDaily);
  const updateProfile = useMutation(api.users.updateProfile);

  const handleJoin = async () => {
    if (!user || !joinTag) return;
    try {
      await joinClan({ tag: joinTag });
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    try {
      const name = (document.querySelector("#clan-name") as HTMLInputElement)?.value ?? "";
      const tag = (document.querySelector("#clan-tag") as HTMLInputElement)?.value ?? "";
      const info = (document.querySelector("#clan-info") as HTMLInputElement)?.value ?? "";
      await createClan({ name, tag, info });
      setOpen(false);
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    try {
      await leaveClan({});
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDonate = async (amount: number) => {
    if (!user) return;
    try {
      await donate({ amount });
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const handleClaim = async () => {
    if (!user) return;
    try {
      await claimDaily({});
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateName = async () => {
    if (!user) return;
    try {
      const input = document.querySelector("#clan-name") as HTMLInputElement;
      await updateProfile({ username: input.value });
      setOpen(false);
      navigate("/dashboard?tab=clan");
    } catch (e) {
      console.error(e);
    }
  };

  const isLeader = clan ? clan.leaderId === user?.id : false;
  const canManage = clan ? isLeader || clan.myRole === "officer" : false;
  const canJoin = !clan && user;
  const isMember = !clan || (clan && (clan.myRole === "leader" || clan.myRole === "officer"));
  const isInClan = !!myClan;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Klan</h1>
          <p className="text-sm text-muted-foreground">
            {isInClan
              ? "Kelola klan, donor, dan anggotanya."
              : "Buat atau bergabunglah ke klan untuk bersaing."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
        >
          <ArrowsLeftRight className="size-4" />
          {isInClan ? "Keluar" : canJoin ? "Bergabung" : "Buat"}
        </button>
      </div>

      {openCreate ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Buat Klan</SheetTitle>
              <SheetDescription>Isi form di bawah ini untuk membuat klan baru.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3">
                <Label htmlFor="clan-name">Nama Klan</Label>
                <Input id="clan-name" placeholder="Nama klan" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="clan-tag">Tag Klan</Label>
                <Input id="clan-tag" placeholder="3-4 karakter" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="clan-info">Deskripsi</Label>
                <Input id="clan-info" placeholder="Tentang klan" />
              </div>
              <Button onClick={handleCreate} className="mt-2">Buat Klan</Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : clan ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center gap-3">
              <Avatar
                src={clan.avatarUrl}
                seed={clan.name}
                className="size-12"
              />
              <div>
                <h2 className="text-2xl font-extrabold">{clan.name}</h2>
                <p className="text-sm text-muted-foreground">{clan.tag}</p>
              </div>
              {clan.badge && <Badge>{clan.badge}</Badge>}
              {isLeader && <Badge>Leader</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border bg-white/5 p-4">
                <div className="text-xs text-muted-foreground">Level</div>
                <div className="mt-1 text-xl font-extrabold">{clan.level}</div>
                <div className="mt-1">
                  <LvProgressBar value={clan.levelProgress} />
                </div>
              </div>
              <div className="rounded-2xl border bg-white/5 p-4">
                <div className="text-xs text-muted-foreground">Anggota</div>
                <div className="mt-1 text-xl font-extrabold">{clan.memberCount}</div>
              </div>
              <div className="rounded-2xl border bg-white/5 p-4">
                <div className="text-xs text-muted-foreground">Diamond</div>
                <div className="mt-1 text-xl font-extrabold">{clan.diamonds}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleDonate(clan.level >= 50 ? 5000 : 2000)}
                className="bg-amber-500 hover:bg-amber-400"
              >
                Donasi
              </Button>
              <Button
                onClick={handleClaim}
                className="bg-emerald-500 hover:bg-emerald-400"
              >
                Claim Harian
              </Button>
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-2 text-sm font-semibold">
                {isInClan ? "Anggota" : "Bebas"}
              </div>
              {canJoin && <Button onClick={handleJoin} className="mt-3">Bergabung</Button>}
              {canManage && (
                <Button
                  variant="outline"
                  onClick={handleLeave}
                  className="mt-3 text-destructive"
                >
                  Keluar
                </Button>
              )}
            </div>
            <div className="rounded-2xl border bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Tingkat Keanggotaan</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pemimpin</span>
                  <span className="font-semibold">{isLeader ? "Ya" : "Tidak"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Officer</span>
                  <span className="font-semibold">
                    {clan.myRole === "officer" ? "Ya" : "Tidak"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Anggota</span>
                  <span className="font-semibold">
                    {clan.myRole === "member" ? "Ya" : "Tidak"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {user
              ? "Kamu belum memiliki klan. Buat atau bergabung untuk mulai berkarya."
              : "Silakan login untuk membuat atau bergabung ke klan."}
          </p>
        </div>
      )}
    </main>
  );
}
