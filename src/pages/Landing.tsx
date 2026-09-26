import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Play, Crown, Trophy, MessagesSquare, CalendarDays, Gem } from "lucide-react";

const FEATURES = [
  {
    icon: Play,
    title: "Streaming Sub Indo",
    desc: "Ribuan anime dengan kualitas sampai 1080p, player ringan, mini player & download.",
  },
  {
    icon: Trophy,
    title: "Leaderboard XP",
    desc: "Kumpulkan XP tiap nonton & chat, rebutan podium top 1 harian, mingguan, bulanan.",
  },
  {
    icon: MessagesSquare,
    title: "Chat bareng & Clan",
    desc: "Ngobrol sambil nonton, bikin clan, donate berlian, dan level up clan sampai 200.",
  },
  {
    icon: Crown,
    title: "Give Premium",
    desc: "Punya premium? Bagikan ke 5-30 orang sekaligus dan panen XP-nya.",
  },
  {
    icon: CalendarDays,
    title: "Jadwal Rilis",
    desc: "Senin sampai Minggu, pantau kapan episode barunya turun.",
  },
  {
    icon: Gem,
    title: "Diamond & Absen",
    desc: "Absen 7 hari, main game klik, tukar diamond dengan premium.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[radial-gradient(1200px_500px_at_50%_-100px,rgba(250,204,21,0.12),transparent)]"
    >
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-yellow-500 px-2 py-1 text-lg font-black text-black">
            L
          </span>
          <span className="text-lg font-black tracking-tight">
            L<span className="text-yellow-400">Stream</span>
          </span>
        </div>
        <Button
          onClick={() => navigate("/auth?returnTo=/dashboard")}
          className="rounded-full bg-yellow-500 font-bold text-black hover:bg-yellow-400"
        >
          Masuk
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-10 text-center">
        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mx-auto mb-3 w-fit rounded-full border border-yellow-500/40 px-3 py-1 text-xs text-yellow-300"
        >
          🎬 Nonton anime sub Indonesia + sosial game XP
        </motion.p>
        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mx-auto max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl"
        >
          Nonton anime, kumpulin XP, <span className="text-yellow-400">jodombo</span> bareng
          clanmu
        </motion.h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          LStream menggabungkan streaming anime, chat global, clan, leaderboard XP, give
          premium, dan diamond game dalam satu tempat.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => navigate("/auth?returnTo=/dashboard")}
            className="rounded-full bg-yellow-500 px-8 font-bold text-black hover:bg-yellow-400"
          >
            Mulai Nonton — Gratis
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/auth?returnTo=/dashboard")}
            className="rounded-full"
          >
            Lihat Leaderboard
          </Button>
        </div>

        {/* Mockup panel */}
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-12 max-w-3xl rounded-2xl border border-yellow-500/30 bg-card p-4 shadow-2xl"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { rank: "1", name: "ZoroSensei", xp: "12.480 XP", h: "h-28" },
              { rank: "2", name: "NakamaGG", xp: "9.870 XP", h: "h-20" },
              { rank: "3", name: "Yeagerist", xp: "8.120 XP", h: "h-16" },
            ].map((p) => (
              <div
                key={p.rank}
                className="flex flex-col items-center rounded-xl border border-yellow-500/25 bg-secondary/40 p-3"
              >
                <span className="text-2xl font-black text-yellow-400">#{p.rank}</span>
                <p className="mt-1 text-sm font-bold">{p.name}</p>
                <p className="text-xs text-yellow-300/80">{p.xp}</p>
                <div className={`mt-2 w-full rounded-t-lg bg-yellow-500/25 ${p.h}`} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Leaderboard XP harian — berlomba tiap hari reset jam 00:00
          </p>
        </motion.div>
      </section>

      {/* Fitur */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <h2 className="text-center text-2xl font-black">Semua yang kamu butuh</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ y: 16, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-yellow-400/50"
            >
              <f.icon className="size-6 text-yellow-400" />
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="rounded-3xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/20 to-transparent p-10 text-center">
          <h2 className="text-2xl font-black">Siap jadi top 1?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Daftar gratis, dapat 45.000 diamond untuk new user, dan langsung tancap gas.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth?returnTo=/dashboard")}
            className="mt-5 rounded-full bg-yellow-500 px-10 font-bold text-black hover:bg-yellow-400"
          >
            Gabung Sekarang
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-black py-6 text-center text-xs text-zinc-500">
        LStream © {new Date().getFullYear()} — Nonton anime sub Indonesia
      </footer>
    </motion.div>
  );
}
