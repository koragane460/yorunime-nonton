import { AppLayout } from "@/components/AppLayout";
import { ComicBrowsePage } from "@/components/ComicBrowsePage";

export default function Manhwa() {
  return (
    <AppLayout hideAccountPanel>
      <ComicBrowsePage kind="manhwa" />
    </AppLayout>
  );
}
