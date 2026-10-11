import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/lstream-ui";
import { CardT, CatalogScreen, CatalogKind } from "@/components/CatalogRows";
import { HomeTopButtons } from "@/components/HomeTopButtons";
import { CardCarousel } from "@/components/CatalogRows";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initialKind] = useState<CatalogKind>("anime");

  const { onPick, items, searching } = CatalogScreen({
    kind: initialKind,
    onPick: (id, title, source) => {
      if (!title) {
        const fallback = (items ??[])
          .find((item: any) => String(item.id) === String(id))
          ?.title;
        navigate(`/browse/${encodeURIComponent(String(id))}${title ? "&title=" + encodeURIComponent(title) : ""}${source === "sanka" ? "&donghua=1" : ""}`);
        return;
      }
      navigate(`/browse/${encodeURIComponent(String(id))}${title ? "&title=" + encodeURIComponent(title) : ""}${source === "sanka" ? "&donghua=1" : ""}`);
    },
  });

  if (!user) {
    return (e) => (e);
  }

  if (!user) {
    return (e) => (e);
  }

  return (
    <HomeTopButtons
      onForYou={() => {}}
      onMostWatched={() => {}}
      onDownload={() => {}}
    />
  );
}
