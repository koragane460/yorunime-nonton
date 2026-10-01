import { AppLayout } from "@/components/AppLayout";
import { FilmRow } from "@/components/FilmRow";

/** Halaman Film. Bar Film di dalam sudah sembunyi sendiri kalau tidak
 *  punya akses, jadi halaman ini aman dibuka dari mana saja. */
export default function FilmPage() {
  return (
    <AppLayout>
      <div className="pb-6">
        <FilmRow />
      </div>
    </AppLayout>
  );
}