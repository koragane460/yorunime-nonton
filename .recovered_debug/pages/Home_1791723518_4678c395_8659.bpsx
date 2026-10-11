import { Smile, TrendingUp, MessageCircle, Trophy, Search, Home, CalendarDays, Clock, Bookmark, User } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col bg-[#0b1019] text-white px-4">
      {/* Premium banner */}
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#d3a23b] bg-[#141a26] px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d3a23b] text-sm">
          <Trophy className="h-4 w-4 text-[#0b1019]" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#d3a23b]">Premium</p>
          <p className="text-[12px] leading-tight text-white">Premium mulai dari 7.000 — baca manga dan manhwa sepuasnya</p>
        </div>
        <button className="rounded-full bg-[#d3a23b] px-4 py-1 text-[11px] font-semibold text-[#0b1019]">
          Buka Premium
        </button>
      </div>

      {/* Featured One Piece */}
      <div className="mb-3 overflow-hidden rounded-xl border border-[#1e2a3a] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://picsum.photos/seed/onepiece/640/300')" }}>
        <div className="absolute left-2 top-2 flex gap-2">
          <span className="rounded-full bg-[#d32f2f] px-2 py-0.5 text-[9px] font-semibold text-white">Ongoing</span>
          <span className="rounded-full bg-[#d3a23b] px-2 py-0.5 text-[9px] font-semibold text-[#0b1019]">
            <span className="mr-1 inline-flex h-3 w-3 items-center justify-center">
              <span className="text-[8px]">★</span>
            </span>
            New
          </span>
          <span className="rounded-full bg-[#00000088] px-2 py-0.5 text-[9px] font-medium text-white">+ 1474 nonton</span>
        </div>

        <div className="absolute left-3 right-3 top-12">
          <p className="text-[16px] font-bold tracking-tight drop-shadow">ONE PIECE</p>
          <p className="mt-1 text-[11px] leading-snug text-white/90 drop-shadow">
            Gold Roger was known as the Pirate King, the strongest and most infamous being to have sailed the Grand Line. The capture and death of Roger by the World Government brought a change throughout the world....
          </p>
        </div>

        <div className="absolute left-3 right-3 bottom-3 flex gap-2">
          <button className="rounded-full bg-[#d32f2f] px-4 py-1.5 text-[11px] font-semibold text-white">
            Lihat detail
          </button>
          <button className="flex items-center gap-1.5 rounded-full border border-[#2f3b4a] bg-black/60 px-4 py-1.5 text-[11px] font-semibold text-white">
            <span className="text-base">▶</span> Tonton
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#1e2a3a] bg-[#11171f] px-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f2733]">
          <Trophy className="text-[#d3a23b]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-white">Leaderboard</p>
          <p className="text-[10px] text-[#8a94a6]">Top XP minggu ini — lihat semua &gt;</p>
        </div>
      </div>

      {/* Chat bareng */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733]">
            <MessageCircle className="text-[#8a94a6]" />
          </div>
          <p className="text-[13px] font-semibold text-white">Chat bareng</p>
          <span className="text-[10px] text-[#8a94a6]">buka &gt;</span>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#1e2a3a] bg-[#0f1520] px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733] text-[12px] font-semibold text-white">U</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold text-white">user23</p>
            <span className="text-[9px] text-[#3b82f6]">●</span>
            <span className="ml-auto text-[9px] text-[#8a94a6]">3 menit lalu</span>
          </div>
          <p className="mt-1 text-[12px] text-white/90">Test</p>
          <p className="mt-1 text-[10px] text-[#8a94a6]">↩ Test</p>
        </div>
        <button className="rounded-full p-1 text-[#8a94a6]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>

      {/* Clan promo */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#3b4759] bg-[#0f1520] px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2733]">
          <Trophy className="text-[#d3a23b]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-white">Belum punya clan</p>
          <p className="text-[10px] text-[#8a94a6]">Bikin bareng teman, kumpulin XP</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-[#3b4759] px-3 py-1 text-[10px] font-semibold text-white">Buat</button>
          <button className="rounded-lg bg-[#d32f2f] px-3 py-1 text-[10px] font-semibold text-white">Join</button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <p className="mb-2 text-[13px] font-semibold text-white">Cari anime &amp; donghua</p>
        <div className="flex items-center gap-2 rounded-xl bg-[#11171f] border border-[#1e2a3a] px-3 py-2">
          <Search className="text-[#8a94a6]" />
          <input
            placeholder="contoh: ayanokoji adalah aku"
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-[#7d879a] outline-none"
          />
          <button
            className="rounded-full bg-[#d32f2f] px-3 py-0.5 text-[11px] font-semibold text-white"
            onClick={() => setSearchOpen(true)}
          >
            Cari
          </button>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <div className="mt-2 flex h-14 items-center justify-around border-t border-[#1e2a3a] px-2">
        <NavItem active icon={<Home className="h-5 w-5" />} label="Update News" />
        <NavItem icon={<CalendarDays className="h-5 w-5" />} label="News" />
        <NavItem icon={<Clock className="h-5 w-5" />} label="History" />
        <NavItem icon={<Bookmark className="h-5 w-5" />} label="Koleksi" />
        <NavItem icon={<User className="h-5 w-5" />} label="Rilis Hari Ini" />
      </div>

      {/* Search open modal placeholder */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[88%]">
            <div className="flex items-center gap-2 border-b border-[#1e2a3a] px-3 py-3">
              <button onClick={() => setSearchOpen(false)} className="rounded-full p-1 text-[#8a94a6]">
                ✕
              </button>
              <p className="text-[13px] font-semibold text-white">Cari anime &amp; donghua</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#1e2a3a] bg-[#11171f] px-3 py-2">
              <Search className="text-[#8a94a6]" />
              <input
                placeholder="contoh: ayanokoji adalah aku"
                className="flex-1 bg-transparent text-[13px] text-white placeholder:text-[#7d879a] outline-none"
                autoFocus
              />
              <button className="rounded-full bg-[#d32f2f] px-3 py-0.5 text-[11px] font-semibold text-white">
                Cari
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${active ? "text-[#d32f2f]" : "text-[#8a94a6]"}`}>
      {icon}
      <span className="text-[8px]">{label}</span>
    </div>
  );
}
