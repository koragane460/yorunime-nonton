import { AppLayout } from "@/components/AppLayout";
import { ComicBrowsePage } from "@/components/ComicBrowsePage";

export default function Manga() {
  return (
    <AppLayout hideAccountPanel>
      <ComicBrowsePage kind="manga" />
    </AppLayout>
  );
}
