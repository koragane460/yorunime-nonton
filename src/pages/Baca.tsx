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
      <div className="pb-6">
        <h1 className="px-1 pt-4 text-lg font-bold tracking-tight">Baca</h1>
        {/* key supaya state dalam (hero, hasil cari) di-reset saat kategori
            berganti lewat tombol kanan bawah. */}
        <ComicBrowsePage key={kind} kind={kind} />
      </div>
    </AppLayout>
  );
}
