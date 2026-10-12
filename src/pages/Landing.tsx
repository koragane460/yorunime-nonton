import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Play,
  Clapperboard,
  Trophy,
  Star,
  Gamepad,
  Users,
  Sparkles,
  Heart,
  ChevronRight,
  Landmark,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const stats = [
    { value: "1.200+", label: "Judul anime + komik subs" },
    { value: "45.000", label: "Sacret disedot new user" },
    { value: "1", label: "Podium XP per hari" },
    { value: "200", label: "Level clan maksimum" },
  ];

  const sections = [
    {
      icon: Play,
      title: "Nonton Tiba-Tiba Nyala",
      desc: "Stream anime dari sub Indonesia di resolusi 1080p, dengan player ringan, mini player, dan unduhan offline. Tidak ada lag, tidak ada interupsi.\n\nOtomasi mulai: pilih deretan favorit, lanjutkan dari episode terakhir, atau cari melalui pencarian kata kunci.",
      items: [
        "Kualitas 1080p, subs Indonesia, dan pemutaran otomatis episode berikutnya",
        "Mini player + unduhan: nonton sambil kerja atau jalan tanpa membuka aplikasi",
        "Lanjutkan dari mana berhenti, lengkap dengan progress dan riwayat perjudi mancanegara",
      ],
    },
    {
      icon: Users,
      title: "Chat Bareng & Clan",
      desc: "Jelajah dunia anime bersama komunitas. Buat clan, kolaborasi Sacret, ikut keep-up happen di dalam game, atau join clan yang sudah ada.\n\nSetiap chat masuk dengan antara kata kunci kerumunan dan antarmuka yang mudah dijangkau.",
      items: [
        "Chat global + clan: ngobrol sambil nonton atau bahkan selama lie-tim",
        "Donasi Sacret dan level clan sampai 200",
        "Clan rank wings + kode akses, jadi nemu clan yang cocok tanpa bingung",
      ],
    },
    {
      icon: Gamepad,
      title: "Game XP & Sacret",
      desc: "Sisihkan Sacret dari setiap nonton, absen harian, main game klik, atau donasikan ke clan. Akumulasi XP diubah jadi top 1 di podium.\n\nHadiah immedit: semua player dapat Sacret bonus sobat lama, dan saklar pembeliannya tetap rapi di akun.\n\n\n",
      items: [
        "Absen 7 hari sekaligus main game klik, transfer Sacret antar pemain",
        "Rebutan podium harian, mingguan, dan bulanan berbasis XP",
        "Sacret dalam game + boleh tukar dengan premium",
      ],
    },
    {
      icon: Landmark,
      title: "Katalog Rapi & Jadwal Rilis",
      desc: "Senin sampai Minggu, pantau kapan episode baru turun. Urutkan favorit, drama, sports, atau comedy — katalognya dibuat rapi tanpa ribet.\n\n\n",
      items: [
        "Grid katalog lengkap dengan rating, jumlah episode, dan kategori",
        "Jadwal rilis mingguan yang update otomatis",
        "Pencarian + filter band, tahun, dan genre",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* ===== Navigasi ===== */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 group"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300 text-xl font-black text-[#0a0a0c]">
              Y
            </span>
            <span className="text-lg font-black tracking-tight text-white">
              Yoru<span className="text-amber-300">Nime</span>
            </span>
          </button>

          <nav className="hidden items-center gap-5 text-sm font-medium text-zinc-400 md:flex">
            <button className="transition hover:text-white">Streaming</button>
            <button className="transition hover:text-white">Komik</button>
            <button className="transition hover:text-white">Game</button>
            <button className="transition hover:text-white">Jadwal</button>
            <button className="transition hover:text-white">Akun</button>
          </nav>

          <Button
            onClick={() => navigate("/auth?returnTo=/home")}
            className="rounded-full bg-amber-300 px-5 py-2 font-bold text-[#0a0a0c] transition hover:bg-amber-200"
          >
            Masuk
          </Button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden pt-36 pb-20 md:pt-44 md:pb-28">
        {/* Scenery gradient + micro-grid */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-amber-300/15 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="flex flex-wrap items-center gap-2.5"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Anime + komik subs Indonesia — jodombo bareng clan
              </span>
              <span className="text-xs text-zinc-500">
                Senin–Minggu · update otomatis
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-6 text-5xl leading-[1.08] tracking-tight text-white sm:text-6xl"
            >
              Nonton dengan <span className="text-amber-300">jodombo</span>
              <br />
              pandu clan ke podium
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.25 }}
              className="mt-5 max-w-xl text-lg leading-7 text-zinc-400"
            >
              YoruNime menggabungkan streaming anime + komik subs, chat global,
              clan, leaderboard XP, give premium, dan Sacret game dalam satu tempat.
              Daftar gratis — dapat 45.000 Sacret untuk new user.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.35 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth?returnTo=/home")}
                className="rounded-full bg-amber-300 px-8 py-3.5 font-bold text-[#0a0a0c] transition hover:bg-amber-200"
              >
                Mulai Nonton — Gratis
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth?returnTo=/home")}
                className="rounded-full border-white/10 bg-white/5 px-8 py-3.5 font-bold text-white transition hover:bg-white/10 hover:border-white/20"
              >
                Lihat Leaderboard
              </Button>
            </motion.div>

            {/* Stats bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/5 bg-white/3 px-4 py-3.5 backdrop-blur-sm">
                  <p className="text-2xl font-black text-white sm:text-3xl">{s.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Decorative floating cards */}
        <div className="absolute right-6 top-24 hidden w-[320px] animate-[float_7s_ease-in-out_infinite]">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/20">
                <Play className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Now Playing</p>
                <p className="text-xs text-zinc-400">Jujutsu Kaisen — Ep 24</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Fitur ===== */}
      <section className="relative py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-400">
              <Users className="h-3.5 w-3.5" />
              Cariin fitur buat kamu
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Sekaligus <span className="text-amber-300">streaming</span>, social, dan game.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group rounded-3xl border border-white/5 bg-white/4 p-6 transition hover:border-amber-300/30 hover:bg-white/5 hover:shadow-2xl hover:shadow-amber-300/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-black text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
                <ul className="mt-4 space-y-2.5">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300/10">
                        <Star className="h-3 w-3 text-amber-300" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="mt-4 text-sm font-semibold text-amber-300 transition group-hover:text-amber-200">
                  Pelajari selengkapnya <ChevronRight className="ml-1.5 h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative pb-24">
        <div className="mx-auto max-w-5xl px-5">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-300/15 via-amber-300/5 to-transparent p-10 text-center md:p-16">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(600px_400px_at_80%_20%,rgba(255,200,50,0.12),transparent)]" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="relative"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                New user
              </span>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
                Siap jadi top 1?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                Daftar gratis, dapat 45.000 Sacret, dan langsung tancap gas ke podium.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth?returnTo=/home")}
                  className="rounded-full bg-amber-300 px-10 py-4 font-bold text-[#0a0a0c] transition hover:bg-amber-200"
                >
                  Gabung Sekarang
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/auth?returnTo=/home")}
                  className="rounded-full border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition hover:bg-white/10 hover:border-white/20"
                >
                  Lihat Katalog
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/5 bg-[#060607]">
        <div className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-zinc-600">
          YoruNime © {new Date().getFullYear()} — Nonton anime + komik sub Indonesia
          <span className="mx-2">·</span>
          <span className="font-medium text-zinc-500">Streaming Anime & Komik</span>
          <span className="mx-2">·</span>
          <span className="font-medium text-zinc-500">Social Game XP & Sacret</span>
        </div>
      </footer>
    </div>
  );
}
