import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, Image as ImageIcon } from "lucide-react";
import { HomeIcon } from "@/components/ios-icons";

/**
 * Transisi fullscreen saat berpindah dari halaman utama ke Feed Mode.
 * Progress berjalan sekali, lalu layar memudar dan masuk ke /feed.
 */
export function FeedModeSwitch({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(100), 80);
    const t2 = window.setTimeout(() => setFade(true), 1550);
    const t3 = window.setTimeout(() => {
      navigate("/feed");
    }, 1850);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [navigate]);

  return (
    <div
      className={`screen-enter fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#08090d] px-8 text-white transition-opacity duration-300 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex items-center justify-center gap-5">
          <span className="grid size-20 place-items-center rounded-[26px] border border-white/10 bg-white/[0.045] text-white/55">
            <HomeIcon className="size-9" />
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white/60">
            <ArrowLeftRight className="size-4" />
          </span>
          <span className="relative grid size-28 place-items-center rounded-[32px] border border-[var(--ui-c)]/45 bg-[var(--ui-c)]/12 text-[var(--ui-c)] shadow-[0_24px_60px_-26px_rgba(0,0,0,.9)]">
            <ImageIcon className="size-12" strokeWidth={1.7} />
            <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[var(--ui-c)]" />
          </span>
        </div>

        <p className="mt-9 max-w-[300px] text-[10px] font-black uppercase leading-relaxed tracking-[0.2em] text-white/35">
          Beralih dari halaman utama ke feed mode
        </p>
        <div className="mt-4 h-[3px] w-52 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-[var(--ui-c)] transition-[width] duration-[1500ms] ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
