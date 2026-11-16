// YoruNime — Layar "BACA" (tab navigasi ke-4, di kanan History).
//
// Panel ganti kategori di atas DIHAPUS sesuai permintaan: cukup tombol
// mengambang di kanan bawah ("Lihat Manhwa" / "Lihat Manga") yang sudah
// dimiliki ComicBrowsePage. Dari Home, ?jenis=manga|manhwa menentukan
// kategori awal dan tombol itu mengganti param yang sama (tetap di tab).
import { useSearchParams } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { ComicBrowsePage, type ComicKind } from "@/components/ComicBrowsePage";

export default function Baca() {
  const [params] = useSearchParams();
  // Sumber kebenaran = query ?jenis=… — tanpa state lokal, jadi tombol
  // Back browser dan link "Lihat selengkap" dari Home langsung konsisten.
  const kind: ComicKind = params.get("jenis") === "manhwa" ? "manhwa" : "manga";

  return (
    <AppLayout hideAccountPanel>
      <div className="pb-6 pt-3">
        <header className="mb-4">
          <p className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/34">
            <span className="font-serif text-[16px] font-normal leading-none tracking-normal text-[var(--primary)]">
              /
            </span>
            Baca
          </p>
          <h1 className="mt-1.5 font-display text-[26px] font-bold leading-none tracking-[-0.04em]">
            {kind === "manga" ? "Manga" : "Manhwa"}
          </h1>
          <p className="mt-1.5 text-[10px] font-medium text-white/30">
            Lanjutkan cerita atau temukan judul baru.
          </p>
        </header>
        <ComicBrowsePage key={kind} kind={kind} />
      </div>
    </AppLayout>
  );
}
