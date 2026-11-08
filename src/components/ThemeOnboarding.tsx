import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Monitor, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  THEME_PALETTES,
  applyUiTheme,
  paletteOf,
  storeUiTheme,
  type SavedUiTheme,
  type UiTheme,
} from "@/lib/ui-theme";

/**
 * Layar wajib setelah login: pilih bahasa visual, lalu palet warna.
 * Dipisah dua langkah dengan transisi geser supaya terasa seperti membuka
 * sampul majalah, bukan sekadar modal pengaturan.
 */
export function ThemeOnboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (choice: SavedUiTheme) => void;
}) {
  const save = useMutation(api.account.updateSettings);
  const [step, setStep] = useState<"theme" | "color">("theme");
  const [theme, setTheme] = useState<UiTheme>("glass");
  const [accent, setAccent] = useState("0");
  const [saving, setSaving] = useState(false);
  const palette = useMemo(() => paletteOf(accent), [accent]);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    const choice: SavedUiTheme = { theme, accent };
    applyUiTheme(choice);
    storeUiTheme(userId, choice);
    try {
      await save({ uiTheme: theme, uiAccent: accent });
    } catch {
      // Preferensi lokal tetap dipakai walau server sedang sibuk.
    }
    onDone(choice);
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#08070c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(60% 48% at 50% 0%, ${palette.colors[0]}42 0%, transparent 72%), radial-gradient(42% 38% at 100% 100%, ${palette.colors[2]}1f 0%, transparent 74%)`,
        }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
            <span className="size-1.5 rounded-full" style={{ background: palette.colors[2] }} />
            YoruNime
          </span>
          <span className="text-[9px] font-bold tracking-[0.18em] text-white/25">
            {step === "theme" ? "LANGKAH 1 / 2" : "LANGKAH 2 / 2"}
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === "theme" ? (
            <motion.section
              key="theme"
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -34 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 flex-col"
            >
              <div className="mt-9">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[9px] font-black text-white/60">
                  <Sparkles className="size-3" style={{ color: palette.colors[2] }} />
                  Sentuhan pertamamu
                </span>
                <h1 className="mt-3 max-w-[18rem] font-display text-[30px] font-black leading-[1.06] tracking-[-0.045em]">
                  Pilih rumah
                  <br />
                  untuk matamu.
                </h1>
                <p className="mt-2 max-w-[19rem] text-[11px] leading-relaxed text-white/45">
                  Bisa diganti kapan saja di Pengaturan. Pilih yang paling nyaman
                  dipakai sehari-hari.
                </p>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-2.5">
                <ThemeChoiceCard
                  active={theme === "glass"}
                  onClick={() => setTheme("glass")}
                  title="Glassmorphism"
                  hint="Kaca, cahaya, dan blur"
                  kind="glass"
                  colors={palette.colors}
                />
                <ThemeChoiceCard
                  active={theme === "default"}
                  onClick={() => setTheme("default")}
                  title="Default"
                  hint="Bersih, tegas, tanpa blur"
                  kind="default"
                  colors={palette.colors}
                />
              </div>

              <div className="mt-auto pt-7">
                <button
                  type="button"
                  onClick={() => setStep("color")}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[12px] font-black text-black shadow-[0_18px_36px_-24px_rgba(0,0,0,.9)] transition active:scale-[0.985]"
                  style={{
                    background: `linear-gradient(110deg, ${palette.colors[2]}, ${palette.colors[3]})`,
                  }}
                >
                  Lanjut pilih warna
                  <ArrowRight className="size-4" strokeWidth={2.6} />
                </button>
                <p className="mt-3 text-center text-[9px] leading-relaxed text-white/28">
                  Kamu bisa kembali ke sini lewat Pengaturan → Tema tampilan.
                </p>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="color"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <button
                type="button"
                onClick={() => setStep("theme")}
                className="mt-5 flex w-fit items-center gap-1.5 text-[10px] font-bold text-white/45 transition hover:text-white"
              >
                <ArrowLeft className="size-3.5" />
                Ganti tema
              </button>
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                  Palet {palette.name}
                </p>
                <h1 className="mt-1.5 font-display text-[27px] font-black leading-[1.08] tracking-[-0.04em]">
                  Satu warna,
                  <br />
                  seluruh semesta.
                </h1>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/40">
                  Sepuluh baris gradasi. Ketuk satu baris untuk melihat seluruh
                  aplikasi berubah.
                </p>
              </div>

              <div className="thin-scroll -mx-1 mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 pb-3">
                {THEME_PALETTES.map((p) => {
                  const active = p.id === accent;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAccent(p.id)}
                      aria-pressed={active}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition active:scale-[0.99]",
                        active
                          ? "border-white/35 bg-white/[0.09]"
                          : "border-white/8 bg-white/[0.035] hover:border-white/18",
                      )}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/10 bg-black/20 font-display text-[9px] font-black text-white/40">
                        {active ? (
                          <Check className="size-3.5" style={{ color: p.colors[2] }} />
                        ) : (
                          Number(p.id) + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block truncate text-[10px] font-bold text-white/65">
                          {p.name}
                        </span>
                        <span className="flex h-5 w-full overflow-hidden rounded-full border border-white/10">
                          {p.colors.map((c, i) => (
                            <span
                              key={`${p.id}-${i}`}
                              className="h-full flex-1"
                              style={{ background: c }}
                            />
                          ))}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#08070c]/90 pt-3">
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[12px] font-black text-black transition active:scale-[0.985] disabled:opacity-60"
                  style={{
                    background: `linear-gradient(110deg, ${palette.colors[2]}, ${palette.colors[3]})`,
                  }}
                >
                  {saving ? "Menyiapkan…" : "Mulai dengan warna ini"}
                  <ArrowRight className="size-4" strokeWidth={2.6} />
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ThemeChoiceCard({
  active,
  onClick,
  title,
  hint,
  kind,
  colors,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  kind: UiTheme;
  colors: [string, string, string, string];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative overflow-hidden rounded-[22px] border p-2 text-left transition active:scale-[0.99]",
        active
          ? "border-white/55 bg-white/[0.08] shadow-[0_20px_45px_-30px_rgba(0,0,0,1)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25",
      )}
    >
      {active && (
        <span
          className="absolute right-2.5 top-2.5 z-10 grid size-5 place-items-center rounded-full text-black"
          style={{ background: colors[2] }}
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      <div className="relative h-[196px] overflow-hidden rounded-[16px] border border-white/10 bg-[#0b0a11] p-2">
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              kind === "glass"
                ? `radial-gradient(circle at 18% 10%, ${colors[0]}50, transparent 48%), radial-gradient(circle at 92% 78%, ${colors[2]}2e, transparent 55%)`
                : `linear-gradient(180deg, ${colors[1]}24, #08070c 72%)`,
          }}
        />
        <div className="relative flex items-center gap-1.5">
          <span className="size-5 rounded-full border border-white/20 bg-white/10" />
          <span className="h-1.5 w-12 rounded-full bg-white/20" />
          <span className="ml-auto size-3 rounded-full bg-white/12" />
        </div>
        <div
          className={cn(
            "relative mt-6 rounded-xl border p-2",
            kind === "glass"
              ? "border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] backdrop-blur-md"
              : "border-white/8 bg-[#121019]",
          )}
        >
          <span className="block h-1.5 w-10 rounded-full bg-white/25" />
          <span className="mt-1.5 block h-1 w-16 rounded-full bg-white/12" />
          <span
            className="mt-2.5 block h-4 w-12 rounded-full"
            style={{ background: colors[2] }}
          />
        </div>
        <div className="relative mt-2 grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-10 rounded-lg border",
                kind === "glass"
                  ? "border-white/15 bg-white/[0.07] backdrop-blur-sm"
                  : "border-white/6 bg-[#16131d]",
              )}
            />
          ))}
        </div>
        <div className="absolute inset-x-2 bottom-2 flex h-6 items-center justify-around rounded-full border border-white/15 bg-black/35 backdrop-blur-md">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full"
              style={{ background: i === 0 ? colors[2] : "rgba(255,255,255,.22)" }}
            />
          ))}
        </div>
      </div>
      <div className="px-1 pb-0.5 pt-2.5">
        <p className="truncate text-[11.5px] font-black text-white">{title}</p>
        <p className="mt-0.5 truncate text-[8.5px] font-medium text-white/38">{hint}</p>
      </div>
    </button>
  );
}

export function ThemeButtonHint() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] text-white/35">
      <Monitor className="size-3" /> Tema diterapkan ke seluruh aplikasi
    </span>
  );
}
