"use node";
/**
 * Bot AI yang memeriksa bukti transfer.
 *
 * Model: Google Gemini (multimodal) lewat REST API — cukup satu API key
 * (`GEMINI_API_KEY`) di tab Keys, tanpa SDK tambahan. Kalau key belum diisi,
 * dipakai aturan sederhana (heuristik) supaya order tetap bisa diverifikasi.
 *
 * Catatan jujur: AI hanya bisa menilai KEVALIDAN BUKTI (nominal, nama, waktu,
 * tampilan layar transfer). AI tidak bisa mengecek saldo rekening secara
 * langsung — konfirmasi dana masuk tetap dipastikan developer lewat panel dev.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

type Verdict = "verified" | "rejected" | "manual";

/** Ambil nominal dalam bentuk angka dari teks bebas. */
function amountsIn(text: string): number[] {
  const out: number[] = [];
  const re = /rp\.?\s*([0-9][0-9.,]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]!.replace(/[.,]/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/** Heuristik tanpa AI: cukup untuk testing / fallback. */
function heuristic(
  proofText: string,
  expectedAmount: number,
): { verdict: Verdict; note: string } {
  const text = proofText.trim();
  if (!text) {
    return {
      verdict: "manual",
      note: "Tidak ada keterangan transfer. Menunggu cek developer.",
    };
  }
  const amounts = amountsIn(text);
  if (amounts.length === 0) {
    return { verdict: "manual", note: "Nominal tidak terbaca. Menunggu cek developer." };
  }
  const exact = amounts.some((a) => a === expectedAmount);
  if (!exact) {
    return {
      verdict: "rejected",
      note: `Nominal di bukti (${amounts.join(", ")}) tidak sama dengan total (${expectedAmount}).`,
    };
  }
  return {
      verdict: "verified",
      note: `Nominal ${expectedAmount} cocok (dicek aturan sederhana).`,
    };
}

export const analyzeProof = internalAction({
  args: {
    imageUrl: v.union(v.string(), v.null()),
    proofText: v.string(),
    expectedAmount: v.number(),
    planLabel: v.string(),
    uidCode: v.string(),
    accountName: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ verdict: Verdict; note: string; engine: string }> => {
    const key = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
    if (!key) {
      const r = heuristic(args.proofText, args.expectedAmount);
      return { ...r, engine: "heuristik" };
    }

    // Siapkan gambar (kalau ada) sebagai base64 inline.
    let imagePart: Record<string, unknown> | null = null;
    if (args.imageUrl) {
      try {
        const res = await fetch(args.imageUrl, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength > 0 && buf.byteLength < 6_000_000) {
            imagePart = {
              inline_data: { mime_type: "image/jpeg", data: toBase64(buf) },
            };
          }
        }
      } catch {
        imagePart = null;
      }
    }

    const prompt = [
      "Kamu adalah bot verifikasi pembayaran aplikasi streaming.",
      `Total yang harus dibayar user: Rp ${args.expectedAmount} (${args.planLabel}).`,
      args.accountName ? `Nama penerima di QRIS: ${args.accountName}.` : "",
      args.uidCode ? `UID akun pembeli: ${args.uidCode}.` : "",
      args.proofText ? `Keterangan yang diketik user: ${args.proofText}` : "",
      "Tugasmu: nilai screenshot bukti transfer ini.",
      "Jawab HANYA JSON: {\"verdict\":\"verified|rejected|manual\",\"nominal\":angka_or_null,",
      "\"nama_pengirim\":\"...\",\"waktu\":\"...\",\"catatan\":\"alasan singkat bahasa Indonesia\"}.",
      "Aturan:",
      "- verified hanya kalau benar-benar terlihat layar transfer berhasil dengan nominal persis Rp " +
        args.expectedAmount +
        ".",
      "- rejected kalau gambar buram, nominal jelas berbeda, transfer gagal, atau gambar bukan bukti transfer.",
      "- manual kalau nominalnya tidak terbaca atau layar transfer tidak terlihat jelas. Ini berarti developer akan memeriksanya sendiri, jadi jangan menebak.",
    ]
      .filter(Boolean)
      .join("\n");

    const parts: Record<string, unknown>[] = [{ text: prompt }];
    if (imagePart) parts.push(imagePart);

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (!res.ok) {
        const r = heuristic(args.proofText, args.expectedAmount);
        return { ...r, note: `${r.note} (AI gagal dimanggil)`, engine: "heuristik" };
      }
      const json = (await res.json()) as any;
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = JSON.parse(rawText) as {
        verdict?: string;
        catatan?: string;
      };
      const verdict: Verdict =
        parsed.verdict === "verified"
          ? "verified"
          : parsed.verdict === "rejected"
            ? "rejected"
            : "manual";
      return {
        verdict,
        note: (parsed.catatan ?? "Bot AI memeriksa bukti.").slice(0, 300),
        engine: "gemini",
      };
    } catch (e) {
      const r = heuristic(args.proofText, args.expectedAmount);
      return {
        ...r,
        note: `${r.note} (AI error: ${e instanceof Error ? e.message : "tidak diketahui"})`,
        engine: "heuristik",
      };
    }
  },
});

function toBase64(bytes: Uint8Array): string {
  // Buffer tersedia di Node runtime Convex.
  return Buffer.from(bytes).toString("base64");
}