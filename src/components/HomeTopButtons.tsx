import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useHideNavOnMount, useHideNavWhile } from "@/components/AppLayout";
import {
  deleteEpisode,
  fetchWithProgress,
  fmtBytes,
  getEpisode,
  getPartial,
  listKeys,
  MAX_BYTES,
  putEpisode,
} from "@/lib/offline-store";
import {
  AlertCircle,
  Clock,
  HardDriveDownload,
  Loader2,
  PlayCircle,
  RotateCw,
  Save,
  Trash2,
  Tv,
} from "lucide-react";
// Ikon tiga tombol atas Home memakai gaya SF Symbols.
import {
  DownloadIcon as Download,
  FlameIcon as Flame,
  SparklesIcon as Sparkles,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
} from "@/components/ios-icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


/* ==================================================== UNTUK KAMU ====== */

type RecoCard = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
};

export function ForYouPanel({ onClose, inline }: {
  onClose: () => void;
  /** true = tampil di tempat sebagai tab, bukan layar fullscreen. */
  inline?: boolean;
}) {
  useHideNavWhile(!inline);
  const { user } = useAuth();
  const taste = useQuery(api.activities.genreTaste, user ? {} : "skip");
  const history = useQuery(api.activities.mostWatched, user ? { limit: 30 } : "skip");
  const recommend = useAction(api.anime.animeRecommended);

  // Rekomendasi dihitung ulang kalau genre user berubah. `exclude`
  // diisi dari riwayat supaya anime yang sudah ditonton tidak muncul lagi.
  const genres = useMemo(
    () => (taste?.genres ?? []).map((g: { name: string }) => g.name),
    [taste],
  );
  const exclude = useMemo(
    () => (history ?? []).map((h: { animeId: string }) => h.animeId),
    [history],
  );
  const genresKey = genres.join("|");
  const excludeKey = exclude.join("|");
  const reqKey = `${genresKey}##${excludeKey}`;

  // Status muat diturunkan dari kunci permintaan, bukan di-set di dalam effect
  // (setState sinkron di effect memicu render berantai). `settledKey` diisi
  // setelah permintaan selesai; selama kunci berbeda, layar menampilkan
  // skeleton.
  const [loading, setLoading] = useState(true);
  const [settled, setSettled] = useState<{
    key: string;
    list: RecoCard[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    recommend({ genres, exclude })
      .then((r: RecoCard[]) => alive && setSettled({ key: reqKey, list: r ?? [] }))
      .catch(() => alive && setSettled({ key: reqKey, list: [] }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genresKey, excludeKey]);

  const loading = !settled || settled.key !== reqKey;
  const grid = loading ? [] : (settled?.list ?? []);

  return (
    <PanelShell
      title="Untuk kamu"
      subtitle={
        genres.length
          ? `Disusun dari ${genres.slice(0, 3).join(", ")}`
          : "Makin banyak kamu nonton, makin tepat sarannya"
      }
      onClose={onClose}
      inline={inline}
    >
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton aspect-[2/3] w-full rounded-xl" />
              <div className="skeleton mt-1.5 h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : grid.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Belum ada saran"
          body="Tonton beberapa anime dulu supaya YoruNime tahu seleramu."
        />
      ) : (
        <>
          {/* Dua judul utama dibuat besar — memberi rasa "pilihan editor",
              bukan sekadar grid generic. */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {grid.slice(0, 2).map((c, i) => (
              <HeroPick key={c.id} card={c} rank={i} onClose={onClose} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {grid.slice(2).map((c) => (
              <MiniPick key={c.id} card={c} onClose={onClose} />
            ))}
          </div>
        </>
      )}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        Saran disusun dari anime yang paling sering kamu tonton dan yang kamu
        favoritkan — bukan dari daftar umum.
      </p>
    </PanelShell>
  );
}

function MiniPick({ card, onClose }: { card: RecoCard; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        navigate(`/home?pilih=${encodeURIComponent(card.id)}`);
        onClose();
      }}
      className="group text-left"
    >
      <div className="relative overflow-hidden rounded-xl border border-border/60">
        <img
          src={card.image}
          alt=""
          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {card.status && /releasing|airing/i.test(card.status) && (
          <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
            Rilis
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
        {card.title}
      </p>
    </button>
  );
}
