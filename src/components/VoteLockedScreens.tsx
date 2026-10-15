// Layar VOTE yang belum bisa dipakai: "belum dimulai" dan "selesai".
// Keduanya selalu ditengah, dengan ikon melayang + animasi (bergaya layer
// unlock Premium manga/manhwa tapi tetap rapi).
import { motion } from "framer-motion";
import { Clock, Sparkles, Trophy, Vote as VoteIcon } from "lucide-react";

export function VoteNotStartedScreen() {
  return (
    <div className="flex min-h-[62vh] w-full flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.45, duration: 0.8 }}
        className="relative"
      >
        <span className="absolute inset-0 -m-3 rounded-[2rem] border border-primary/30" />
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-3 rounded-[2rem] border-2 border-dashed border-primary/25"
          aria-hidden
        />
        <span className="relative flex size-20 items-center justify-center rounded-[1.7rem] border border-primary/40 bg-primary/10 shadow-[0_0_44px_-8px] shadow-primary/60">
          <motion.span
            animate={{ y: [-3, 3, -3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <VoteIcon className="size-10 text-primary" aria-hidden />
          </motion.span>
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
        className="mt-6 text-base font-black uppercase tracking-[0.2em] text-white"
      >
        Vote Character
        <br />
        belum dimulai
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground"
      >
        Developer akan membuka voting. Siapkan Token Vote kamu — 4 menit
        nonton = 2 T-V.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.5 }}
        className="mt-5 flex items-center gap-3"
      >
        {[
          { icon: Clock, cls: "text-sky-300 border-sky-400/40 bg-sky-400/10" },
          { icon: Sparkles, cls: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
          { icon: Trophy, cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
        ].map(({ icon: Icon, cls }, i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.25 }}
            className={`flex size-10 items-center justify-center rounded-2xl border ${cls}`}
          >
            <Icon className="size-5" aria-hidden />
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

export function VoteEndedScreen() {
  return (
    <div className="flex min-h-[62vh] w-full flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.7 }}
        className="flex size-20 items-center justify-center rounded-[1.7rem] border border-amber-400/40 bg-amber-400/10 shadow-[0_0_44px_-10px] shadow-amber-400/60"
      >
        <Trophy className="size-10 text-amber-300" aria-hidden />
      </motion.div>
      <h2 className="mt-5 text-base font-black uppercase tracking-[0.2em]">
        Voting selesai
      </h2>
      <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Periode vote sudah berakhir. Lihat TOP VOTE CHARACTER ANIME di
        Koleksi, tepat di bawah bagian Download.
      </p>
    </div>
  );
}
