// CHAT ROOM (VOICE) — panel SETENGAH layar di dalam voice room, gaya Discord:
// handle garis pendek di tengah atas, koton hint command Luna Bot, daftar pesan
// (foto + username + centang biru + tag clan + id) tanpa outline bubble, pesan
// sendiri rata kanan, dan kolom input + tombol kirim di paling bawah.
//
// Command musik diawali & diakhiri tanda seru (!help!, !play judul!) diproses
// action `music.luna` → Luna Bot 24/7 membalas di chat (avatar bulan + centang
// ungu) lengkap dengan kartu kaset now-playing yang bisa benar-benar bunyi
// (pratinjau audio dari API musik).
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck, ClanTag, PurpleCheck } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { useAuth } from "@/hooks/use-auth";
import { Music, Send, X } from "lucide-react";
import {
  lunaPause,
  lunaPlay,
  lunaResume,
  lunaSeen,
  lunaSetVolume,
  lunaStop,
} from "@/lib/lunaAudio";
import {
  ensureYouTubePlayer,
  youtubePause,
  youtubeResume,
  youtubeStop,
  youtubeTime,
  youtubeVolume,
} from "@/lib/youtubeAudio";

/** Avatar Luna Bot — bulan sabit gradasi violet + bintang, tanpa foto external. */
function LunaAvatar({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-violet-400/50`}
      style={{
        background:
          "radial-gradient(120% 120% at 25% 15%, #7c3aed 0%, #4c1d95 45%, #1e1b4b 100%)",
      }}
      aria-label="Luna Bot 24/7"
    >
      <svg viewBox="0 0 24 24" className="size-[70%]" aria-hidden>
        <defs>
          <linearGradient id="luna-moon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path
          d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.9 8.9 0 1 0 10.6 10.6Z"
          fill="url(#luna-moon)"
        />
        <circle cx="17.6" cy="6.4" r="1" fill="#fde68a" />
        <circle cx="20.4" cy="9.6" r="0.6" fill="#fde68a" />
      </svg>
    </span>
  );
}

/** Kartu kaset now-playing — KOTAK VERTIKAL: kaset+poster di tengah atas,
 *  judul & pembuat, lirik fade per baris, lalu bar + menit di bawah. */
function NowPlayingCard({ d }: { d: any }) {
  const t = d.track ?? {};
  const preview = !!t.preview;
  const totalSec = Math.max(
    1,
    preview ? 30 : Math.round(Number(t.durationMs || 30000) / 1000),
  );
  const art = t.art || "";
  const getLyrics = useAction(api.music.lyrics);
  // Jam berjalan (tick 500ms) — sumber waktu untuk bar, menit & lirik.
  // Kalau lagu diputar lewat YouTube, waktu asli diambil dari pemutar.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 500);
    return () => clearInterval(iv);
  }, []);
  const ytNow = t.videoId ? youtubeTime().now : 0;
  const elapsed = Math.min(
    totalSec,
    ytNow > 0 ? Math.floor(ytNow) : Math.floor(tick / 2),
  );
  // Lirik diambil sekali — utamakan lirik SINKRON (timestamp), jadi tiap
  // baris muncul TEPAT sesuai lagu (kayak pemutar musik YoruVerse).
  type LyricLine = { t?: number; text: string };
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  useEffect(() => {
    if (!t.title) return;
    let alive = true;
    void getLyrics({
      artist: t.artist ?? "",
      track: t.title,
      durationSec: totalSec,
    })
      .then((r: any) => {
        if (!alive) return;
        const synced: LyricLine[] | null = r?.synced?.length
          ? r.synced.map((x: any) => ({
              t: Number(x.t),
              text: String(x.text),
            }))
          : null;
        const plain: LyricLine[] | null = r?.plain?.length
          ? r.plain.map((text: string) => ({ text }))
          : null;
        const l = synced ?? plain;
        if (l && l.length) setLines(l);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Pilih baris lirik: sinkron pakai timestamp (belum waktunya → diam);
  // kalau tidak ada timestamp, baru dibagi rata sepanjang durasi.
  let idx = -1;
  if (lines && lines.length) {
    if (lines[0].t !== undefined) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].t! <= elapsed) idx = i;
        else break;
      }
    } else {
      idx = Math.min(
        lines.length - 1,
        Math.floor((elapsed / totalSec) * lines.length),
      );
    }
  }
  const lyric = idx >= 0 ? lines![idx].text : null;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = Math.min(100, (elapsed / totalSec) * 100);
  return (
    <div className="yn-panel mb-1.5 flex w-full flex-col items-center rounded-2xl px-4 pb-3 pt-4">
      <div className="flex flex-col items-center">
        {/* Kaset puter: poster di tengah piringan berputar */}
        <span className="relative size-24 shrink-0">
          <span
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#1b1b22,#3f3f4d,#131318,#4b4b5c,#1b1b22)] animate-[spin_4s_linear_infinite]"
            aria-hidden
          />
          <span className="absolute inset-[7px] rounded-full bg-black/70" aria-hidden />
          {art ? (
            <img
              src={art}
              alt=""
              className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
            />
          ) : (
            <span className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/40" />
          )}
          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" aria-hidden />
        </span>
        <div className="mt-2.5 min-w-0 max-w-full text-center">
          <p className="truncate text-[13px] font-black text-white">
            {t.title ?? "—"}
          </p>
          <p className="truncate text-[11px] font-semibold text-violet-200/80">
            {t.artist ?? ""}
          </p>
        </div>
      </div>
      {/* Lirik — SATU baris per giliran, fade in */}
      <div className="mt-2.5 flex h-7 w-full items-center justify-center px-1">
        <p
          key={`${idx}-${lyric ?? ""}`}
          className="yn-fade-line line-clamp-1 text-center text-[11px] font-semibold italic text-violet-100/85"
        >
          {lyric ?? "♪ …"}
        </p>
      </div>
      {/* Bar lagu + menit (sekarang / total) */}
      <div className="mt-1 w-full">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-strong transition-[width] duration-500 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[9px] font-black text-white/55">
          <span>{fmt(elapsed)}</span>
          <span>{fmt(totalSec)}</span>
        </div>
      </div>
    </div>
  );
}

/** Command Luna Bot: teks diawali DAN diakhiri tanda seru. */
function isLunaCommand(text: string) {
  const t = text.trim();
  return t.length >= 3 && t.startsWith("!") && t.endsWith("!");
}

export function VoiceChatSheet({
  roomId,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  onClose: () => void;
}) {
  const channel = `voice:${roomId}`;
  // 40 terakhir cukup & jauh lebih ringan dari 60 (chat sering lag).
  const msgs = useQuery(api.chat.listMessages, {
    kind: "voice",
    channel,
    limit: 40,
  });
  const send = useMutation(api.chat.sendMessage);
  const luna = useAction(api.music.luna);
  const { user } = useAuth();
  const lunaEndedM = useAction(api.music.lunaEnded);
  // Mode pemutar terakhir: YouTube (lagu penuh) atau preview HTMLAudio.
  const ytMode = useRef(false);

  /** Putar lagu Luna — YouTube dulu (lagu PENUH), jatuh ke preview 30 dtk.
      Begitu habis → panggil lunaEnded (lanjut antrian / bilang habis). */
  const playTrack = (t: any, vol: number) => {
    const ended = () => {
      ytMode.current = false;
      if (user?._id) {
        void lunaEndedM({
          roomId,
          userId: user._id as Id<"users">,
        }).catch(() => {});
      }
    };
    if (t?.videoId) {
      ytMode.current = true;
      void ensureYouTubePlayer(
        String(t.videoId),
        {
          onPlay: () => {},
          onPause: () => {},
          onReady: () => youtubeVolume(vol),
          onDuration: () => {},
          onEnded: ended,
        },
        false,
      );
      youtubeVolume(vol);
    } else {
      ytMode.current = false;
      if (t?.preview) lunaPlay(String(t.preview), vol, ended);
    }
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const count = msgs?.length ?? 0;

  // Audio dipegang modul lunaAudio — musik tetap bunyi walau panel ditutup.

  // Selalu pipih ke bawah — pesan baru langsung terlihat.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  // Reaksi terhadap pesan bot: putar lagu (YouTube penuh / preview),
  // pause/resume/stop/skip/volume. Pesan LAMA tidak diproses ulang lagi.
  useEffect(() => {
    if (!msgs) return;
    for (const m of msgs) {
      const d: any = m.botData;
      if (!m.bot || !d) continue;
      if (lunaSeen(String(m._id))) continue;
      const vol = Math.max(0, Math.min(1, (d.volume ?? 80) / 100));
      if (d.kind === "np" && d.track) {
        playTrack(d.track, vol);
      } else if (d.kind === "control") {
        if (d.action === "pause") {
          if (ytMode.current) youtubePause();
          else lunaPause();
        } else if (d.action === "resume") {
          if (ytMode.current) youtubeResume();
          else lunaResume();
        } else if (d.action === "stop") {
          lunaStop();
          youtubeStop();
          ytMode.current = false;
        } else if (d.action === "volume") {
          lunaSetVolume(vol);
          youtubeVolume(vol);
        } else if (d.action === "skip" && d.track) {
          playTrack(d.track, vol);
        }
      }
    }
  }, [msgs]);
  // TIDAK ada cleanup yang mematikan audio: musik tetap terdengar di room
  // walau chat room ditutup / dibuka lagi.

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setText("");
    try {
      await send({ kind: "voice", channel, text: t });
      // Command Luna Bot (!help!, !play judul!, …) diproses di action.
      if (isLunaCommand(t) && user?._id) {
        void luna({
          roomId,
          text: t,
          userId: user._id as Id<"users">,
          username: user.username ?? "user",
        }).catch(() => {});
      }
    } catch {
      setText(t); // kembalikan teks kalau gagal kirim
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-x-0 bottom-0 z-[90] flex h-[58vh] max-h-[58vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/15 bg-[#0c0f16] shadow-[0_-26px_60px_-30px_rgba(0,0,0,1)]">
      {/* Handle: garis pendek di tengah + tombol tutup di kanan. */}
      <div className="relative flex items-center justify-center pt-2.5">
        <span className="block h-1.5 w-12 rounded-full bg-white/25" />
        <button
          onClick={onClose}
          aria-label="Tutup chat room"
          className="absolute right-3 top-2 flex size-7 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-95"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/45">
        Chat Room
      </p>

      {/* Kotak hint command musik (paling atas, di atas daftar pesan) */}
      <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2">
        <Music className="size-3.5 shrink-0 text-violet-300" />
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-violet-100/90">
          Ketik <span className="font-black text-white">!invite!</span> untuk
          melihat daftar musik
        </p>
      </div>

      {/* Daftar pesan */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {msgs === undefined && (
          <p className="py-6 text-center text-xs text-white/40">Memuat chat…</p>
        )}
        {msgs?.length === 0 && (
          <p className="py-6 text-center text-xs text-white/40">
            Belum ada pesan — sapa yang lain!
          </p>
        )}
        <div className="flex flex-col gap-3">
          {msgs?.map((m) => {
            const mine = !m.bot && !!user && m.userId === user._id;
            const bot: any = m.botData;
            return (
              <div
                key={m._id}
                className={`flex items-start gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
              >
                {m.bot ? (
                  <LunaAvatar />
                ) : (
                  <Avatar
                    src={m.image}
                    seed={m.username}
                    className="size-8 shrink-0"
                  />
                )}
                <div
                  className={`min-w-0 flex-1 ${mine ? "flex flex-col items-end" : ""}`}
                >
                  {/* Baris nama: username + centang + tag clan + id */}
                  <div
                    className={`flex flex-wrap items-center gap-1.5 ${mine ? "justify-end" : ""}`}
                  >
                    <span
                      className={`text-[12px] font-black ${m.bot ? "text-violet-200" : "text-white"}`}
                    >
                      {m.username}
                    </span>
                    {m.bot ? (
                      <PurpleCheck className="size-3.5 shrink-0" />
                    ) : (
                      m.premium && <BlueCheck className="size-3.5 shrink-0" />
                    )}
                    {!mine && m.clanTag && (
                      <ClanTag
                        icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
                        tag={m.clanTag}
                        color={m.clanNameColor}
                        level={m.clanLevel}
                        className="shrink-0 scale-90 px-1.5 py-0 text-[9px]"
                      />
                    )}
                    {!mine && !m.bot && typeof m.seqId === "number" && (
                      <span className="text-[9px] font-bold text-white/35">
                        #{m.seqId}
                      </span>
                    )}
                  </div>
                  {/* Kartu kaset now-playing (di ATAS teks) */}
                  {m.bot && bot?.kind === "np" && <NowPlayingCard d={bot} />}
                  {/* Bubble — TANPA outline, abu-abu polos */}
                  <div
                    className={`mt-1 w-fit max-w-full rounded-2xl px-3 py-2 text-[12px] leading-snug ${
                      mine
                        ? "bubble-mine yn-tail-r"
                        : "bubble-other yn-tail-l"
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-words">{m.text}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={endRef} />
      </div>

      {/* Kolom input + tombol kirim (tanpa outline) */}
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Tulis pesan…"
          className="min-w-0 flex-1 rounded-full bg-white/[0.09] px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-white/35"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !text.trim()}
          aria-label="Kirim pesan"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_10px_22px_-12px_rgba(251,191,36,0.9)] transition active:scale-95 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
