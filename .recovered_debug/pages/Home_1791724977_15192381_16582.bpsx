import { Trophy, Search, Home, CalendarDays, Clock, Bookmark, User, TrendingUp, Sparkles, ChevronRight, Star, Play, Heart, ArrowRight, ChevronsDown } from "lucide-react";
import { useState } from "react";

type MediaKind = "anime" | "manga" | "manhwa" | "manhua" | "donghua";
type MediaItem = {
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  episodes?: number;
  score?: number;
  tags: string[];
  kind: MediaKind;
};

const TOP_ANIME_HARI_INI: MediaItem[] = [
  { id: "1", title: "One Piece", subtitle: "Ongoing • 1100+ eps", episodes: 1100, score: 9.1, tags: ["Ongoing"], kind: "anime" },
  { id: "2", title: "Naruto", subtitle: "Completed • 72 vols", episodes: 220, score: 8.9, tags: ["Classic"], kind: "anime" },
  { id: "3", title: "Attack on Titan", subtitle: "Completed • Final", episodes: 87, score: 9.0, tags: ["Final"], kind: "anime" },
  { id: "4", title: "Demon Slayer", subtitle: "Season 4 • Ongoing", episodes: 46, score: 8.8, tags: ["Season 4"], kind: "anime" },
];

const TOP_4_5: MediaItem[] = [
  { id: "t4", title: "Jujutsu Kaisen", subtitle: "Season 2 • Ongoing", episodes: 24, score: 8.7, tags: ["Season 2"], kind: "anime" },
  { id: "t5", title: "Spy x Family", subtitle: "Season 2 • Ongoing", episodes: 12, score: 8.6, tags: ["Season 2"], kind: "anime" },
];

const DONGHUA: MediaItem[] = [
  { id: "d1", title: "Battle Through the Heavens", subtitle: "Completed • 248 eps", episodes: 248, score: 8.4, tags: ["Lanjutan"], kind: "donghua" },
  { id: "d2", title: "The Untamed", subtitle: "Completed • 50 eps", episodes: 50, score: 8.9, tags: ["Classic"], kind: "donghua" },
  { id: "d3", title: "Apotheosis", subtitle: "Ongoing • 16 seasons", episodes: 900, score: 8.2, tags: ["Ongoing"], kind: "donghua" },
  { id: "d4", title: "Against the Gods", subtitle: "Completed • 117 eps", episodes: 117, score: 8.1, tags: ["Pilihan"], kind: "donghua" },
];

const MANHWA: MediaItem[] = [
  { id: "m1", title: "Solo Leveling", subtitle: "Completed • 173 ch", episodes: 173, score: 9.3, tags: ["Completed"], kind: "manhwa" },
  { id: "m2", title: "The Beginning After the End", subtitle: "Completed • 200 ch", episodes: 200, score: 9.0, tags: ["Completed"], kind: "manhwa" },
];

const MANHUA: MediaItem[] = [
  { id: "u1", title: "Tales of Demons and Gods", subtitle: "Completed • 1800 ch", episodes: 1800, score: 8.0, tags: ["Classic"], kind: "manhua" },
];

const UPCOMING: { title: string; when: string }[] = [
  { title: "Premium Premium", when: "besok rilis" },
  { title: "One Piece", when: "besok rilis" },
  { title: "Naruto Shippuden", when: "besok rilis" },
  { title: "Attack on Titan", when: "besok rilis" },
];

export default function HomeScreen() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col bg-black text-white px-4 pb-14">
      {/* Hero / Podium banner */}
      <section className="mb-3">
        <div className="relative h-44 w-full overflow-hidden rounded-xl border border-[#1e2a3a] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://picsum.photos/seed/hero1/720/240')" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Sparkles className="text-[#d3a23b]" />
            <span className="rounded-full bg-[#d3a23b] px-2 py-0.5 text-[10px] font-semibold text-black">Rilis Hari Ini</span>
          </div>
          <div className="absolute left-3 bottom-3">
            <p className="text-lg font-bold drop-shadow">One Piece</p>
            <p className="text-[11px] text-white/90 drop-shadow">Gold Roger was known as the Pirate King...</p>
            <div className="mt-1.5 flex gap-2">
              <button className="rounded-full bg-[#d32f2f] px-3 py-1 text-[10px] font-semibold text-white">Lihat detail</button>
              <button className="flex items-center gap-1 rounded-full border border-[#2f3b4a] bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
                <ArrowRight className="text-sm" /> Tonton
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Top 4 & 5 (podium, masih ada kayak semula) */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-[#d3a23b]" />
            <span className="text-sm font-semibold">Top 4 & 5</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Lihat semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TOP_4_5.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Search tapi nggak ada tombol relevant */}
      <section className="mb-3">
        <p className="mb-1.5 text-sm font-semibold">Cari anime, manga, manhwa, donghua</p>
        <div className="flex items-center gap-2 rounded-xl bg-[#11171f] border border-[#1e2a3a] px-3 py-2">
          <Search className="text-[#8a94a6]" />
          <input
            placeholder="contoh: ayanokoji adalah aku"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#7d879a] outline-none"
          />
          <button
            className="rounded-full bg-[#d32f2f] px-4 py-1 text-xs font-semibold text-white"
            onClick={() => setSearchOpen(true)}
          >
            Cari
          </button>
        </div>
      </section>

      {/* Top Anime hari ini */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-[#d3a23b]" />
            <span className="text-sm font-semibold">Top Anime Hari Ini</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Lihat semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TOP_ANIME_HARI_INI.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Donghua */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Donghua</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DONGHUA.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Manga */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Manga</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {MANHWA.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Manhwa */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Manhwa</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {MANHWA.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Manhua */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Manhua</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {MANHUA.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Upcoming */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Upcoming</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Jadwal <ChevronRight className="inline h-3 w-3" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {UPCOMING.map((item, i) => (
            <div key={i} className="flex h-[96px] shrink-0 items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] p-2">
              <div className="h-10 w-10 rounded-full bg-[#1f2733] text-xs font-semibold text-[#8a94a6]">Rilis</div>
              <div>
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="text-[9px] text-[#8a94a6]">{item.when}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Panel akun */}
      <section className="mb-4 flex items-center gap-3 rounded-xl border border-[#1e2a3a] bg-[#11171f] px-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f2733] text-sm font-semibold text-white">U</div>
        <div className="flex-1">
          <p className="text-sm font-semibold">user23</p>
          <p className="text-[10px] text-[#8a94a6]">Level 21 • XP 2.340 • 45 menit lagi ke level 22</p>
        </div>
        <button className="rounded-full bg-[#d3a23b] px-3 py-1 text-xs font-semibold text-black">Akun</button>
      </section>

      {/* Chat bareng: rounded grey, nggak hitam */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Chat Bareng</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Buka <ChevronRight className="inline h-3 w-3" /></button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3 rounded-xl border border-[#3b4759] bg-[#2b2f36] px-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f2733] text-xs font-semibold text-white">U</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold">user23</p>
                <span className="text-[8px] text-[#3b82f6]">●</span>
                <span className="ml-auto text-[9px] text-[#8a94a6]">3 menit lalu</span>
              </div>
              <p className="mt-0.5 text-xs text-white/90">Test</p>
              <p className="mt-0.5 text-[10px] text-[#8a94a6]">↩ Test</p>
            </div>
            <button className="rounded-full p-1 text-[#8a94a6]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Clan promo */}
      <section className="mb-3">
        <div className="flex items-center gap-3 rounded-xl border border-[#3b4759] bg-[#11171f] px-3 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733]">
            <Trophy className="text-[#d3a23b]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Belum punya clan</p>
            <p className="text-[10px] text-[#8a94a6]">Bikin bareng teman, kumpulin XP</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-[#3b4759] px-3 py-1 text-[10px] font-semibold text-white">Buat</button>
            <button className="rounded-lg bg-[#d32f2f] px-3 py-1 text-[10px] font-semibold text-white">Join</button>
          </div>
        </div>
      </section>

      {/* Spacer buat konten lain kalau ada */}
      <div className="flex-1" />

      {/* Bottom nav: background hitam */}
      <div className="mt-2 flex h-14 items-center justify-around border-t border-[#1e2a3a] bg-black">
        <NavItem active icon={<Home className="h-5 w-5" />} label="Update News" />
        <NavItem icon={<CalendarDays className="h-5 w-5" />} label="News" />
        <NavItem icon={<Clock className="h-5 w-5" />} label="History" />
        <NavItem icon={<Bookmark className="h-5 w-5" />} label="Koleksi" />
        <NavItem icon={<User className="h-5 w-5" />} label="Rilis Hari Ini" />
      </div>

      {/* Modal search */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[88%]">
            <div className="flex items-center gap-2 border-b border-[#1e2a3a] px-3 py-3">
              <button onClick={() => setSearchOpen(false)} className="rounded-full p-1 text-[#8a94a6]">✕</button>
              <p className="text-sm font-semibold">Cari anime, manga, manhwa, donghua</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] px-3 py-2">
              <Search className="text-[#8a94a6]" />
              <input
                placeholder="contoh: ayanokoji adalah aku"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#7d879a] outline-none"
                autoFocus
              />
              <button className="rounded-full bg-[#d32f2f] px-3 py-0.5 text-xs font-semibold text-white">Cari</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating chevron down sesuai screenshot */}
      <button className="fixed right-4 top-24 z-40 rounded-full bg-black/60 p-2 text-white shadow">
        <ChevronsDown className="h-5 w-5" />
      </button>
    </div>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  return (
    <button className="flex h-[96px] shrink-0 flex-col gap-1 rounded-xl border border-[#1e2a3a] bg-[#11171f] p-2 text-left">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1f2733] text-xs font-semibold text-[#8a94a6]">
        {item.title.charAt(0)}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{item.title}</p>
        <p className="text-[9px] text-[#8a94a6]">{item.subtitle}</p>
        <div className="mt-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-[#f5c518] text-[#f5c518]" />
            {item.score != null && <span className="text-[9px] text-white/80">{item.score.toFixed(1)}</span>}
          </div>
          {item.episodes != null && (
            <span className="rounded-full bg-[#1f2733] px-1.5 py-0.5 text-[9px] text-[#8a94a6]">
              {item.episodes} ep
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function NavItem({ icon, label, active = false, className }: { icon: React.ReactNode; label: string; active?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${active ? "text-[#d32f2f]" : "text-[#8a94a6]"} ${className ?? ""}`.trim()}>
      {icon}
      <span className="text-[8px]">{label}</span>
    </div>
  );
}
