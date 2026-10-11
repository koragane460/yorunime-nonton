import { Trophy, Search, Home, CalendarDays, Clock, Bookmark, User, TrendingUp, Sparkles, ChevronRight, ArrowRight } from "lucide-react";
import { useState } from "react";

function HomeIcon(props: { className?: string }) {
  return <Home {...props} />;
}

export default function HomeScreen() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col bg-[#0b1019] text-white px-4 pb-14">
      {/* Hero banner */}
      <div
        className="mb-3 h-40 w-full overflow-hidden rounded-xl border border-[#1e2a3a] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://picsum.photos/seed/hero1/720/240')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1019]/80 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Sparkles className="text-[#d3a23b]" />
          <span className="rounded-full bg-[#d3a23b] px-2 py-0.5 text-[10px] font-semibold text-[#0b1019]">
            Rilis Hari Ini
          </span>
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

      {/* Search bar */}
      <div className="mb-3">
        <p className="mb-1.5 text-sm font-semibold">Cari anime &amp; donghua</p>
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
      </div>

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
          {[
            { title: "One Piece", sub: "Ongoing • #1" },
            { title: "Naruto", sub: "Classic • #2" },
            { title: "Attack on Titan", sub: "Final • #3" },
            { title: "Demon Slayer", sub: "Season 4 • #4" },
          ].map((item, i) => (
            <button key={i} className="flex h-[96px] shrink-0 items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] p-2 text-left">
              <div className="h-10 w-10 rounded-full bg-[#1f2733] text-xs font-semibold text-[#8a94a6]">
                {item.title.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="text-[9px] text-[#8a94a6]">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Donghua section */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Donghua</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Semua <ChevronRight className="inline h-3 w-3" /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { title: "Battle Through", sub: "Lanjutan • #1" },
            { title: "The Untamed", sub: "Classic • #2" },
            { title: "Apotheosis", sub: "Ongoing • #3" },
            { title: "Against the Gods", sub: "Pilihan • #4" },
          ].map((item, i) => (
            <button key={i} className="flex h-[96px] shrink-0 items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] p-2 text-left">
              <div className="h-10 w-10 rounded-full bg-[#1f2733] text-xs font-semibold text-[#8a94a6]">
                {item.title.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="text-[9px] text-[#8a94a6]">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Upcoming anime */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Upcoming</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Jadwal <ChevronRight className="inline h-3 w-3" /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {["Premium Premium", "One Piece", "Naruto Shippuden", "Attack on Titan"].map((title, i) => (
            <div key={i} className="flex h-[96px] shrink-0 items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] p-2">
              <div className="h-10 w-10 rounded-full bg-[#1f2733] text-xs font-semibold text-[#8a94a6]">Rilis</div>
              <div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[9px] text-[#8a94a6]">besok rilis</p>
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
        <button className="rounded-full bg-[#d3a23b] px-3 py-1 text-xs font-semibold text-[#0b1019]">Akun</button>
      </section>

      {/* Leaderboard XP */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-[#d3a23b]" />
            <span className="text-sm font-semibold">Leaderboard XP</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Top 50 <ChevronRight className="inline h-3 w-3" /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {["#1 userX • 12.450 XP", "#2 userY • 9.800 XP", "#3 userZ • 8.320 XP", "#4 userW • 7.110 XP", "#5 userV • 6.990 XP"].map(
            (item, i) => (
              <div key={i} className="flex h-[96px] shrink-0 items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733]">
                  <span className="text-xs font-semibold text-[#8a94a6]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">{item}</p>
                  <p className="text-[9px] text-[#8a94a6]">minggu ini</p>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Chat bareng */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="text-[#7d879a]" />
            <span className="text-sm font-semibold">Chat Bareng</span>
          </div>
          <button className="text-xs text-[#8a94a6]">Buka <ChevronRight className="inline h-3 w-3" /></button>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#1e2a3a] bg-[#0f1520] px-3 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733] text-xs font-semibold text-white">U</div>
          <div>
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
      </section>

      {/* Clan promo */}
      <section className="mb-3">
        <div className="flex items-center gap-3 rounded-xl border border-[#3b4759] bg-[#0f1520] px-3 py-3">
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

      {/* Content spacer (tampung tombol lain-lain kalau ada) */}
      <div className="flex-1" />

      {/* Bottom nav (5 tombol) */}
      <div className="mt-2 flex h-14 items-center justify-around border-t border-[#1e2a3a]">
        <NavItem active icon={<Home className="h-5 w-5" />} label="Update News" />
        <NavItem icon={<CalendarDays className="h-5 w-5" />} label="News" />
        <NavItem icon={<Clock className="h-5 w-5" />} label="History" />
        <NavItem icon={<Bookmark className="h-5 w-5" />} label="Koleksi" />
        <NavItem icon={<User className="h-5 w-5" />} label="Rilis Hari Ini" />
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[88%]">
            <div className="flex items-center gap-2 border-b border-[#1e2a3a] px-3 py-3">
              <button onClick={() => setSearchOpen(false)} className="rounded-full p-1 text-[#8a94a6]">✕</button>
              <p className="text-sm font-semibold">Cari anime &amp; donghua</p>
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
    </div>
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
