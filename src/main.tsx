import '@vly-ai/integrations';
import { RequireAuth } from "@/components/RequireAuth";
import { ModerationProvider } from "@/components/ModerationGuard";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import "./index.css";
import { UpdateGate } from "./components/UpdateGate";
import { MusicPlayerProvider } from "./components/MusicPlayer";
import { DownloadWorker } from "./components/HomeTopButtons";

// Lazy load route components for better code splitting
const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Watch = lazy(() => import("./pages/Watch.tsx"));
const Clan = lazy(() => import("./pages/Clan.tsx"));
const Jadwal = lazy(() => import("./pages/Jadwal.tsx"));
const Akun = lazy(() => import("./pages/Akun.tsx"));
const Info = lazy(() => import("./pages/Info.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const Premium = lazy(() => import("./pages/Premium.tsx"));
const Manga = lazy(() => import("./pages/Manga.tsx"));
const Manhwa = lazy(() => import("./pages/Manhwa.tsx"));
const Baca = lazy(() => import("./pages/Baca.tsx"));
const Film = lazy(() => import("./pages/Film.tsx"));
const Gacha = lazy(() => import("./pages/Gacha.tsx"));
const Title = lazy(() => import("./pages/Title.tsx"));

const ReadComic = lazy(() => import("./pages/ReadComic.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary - if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Muat ulang
            </button>
          </div>
        </div>
      );
    }
    return this.state.hasError ? null : this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  // Ingat halaman terakhir yang BUKAN halaman nonton / pembaca (reader).
  // Tab Baca (/baca persis) halaman biasa jadi IKUT disimpan; reader
  // (/baca/:slug/:chapter) yang dikecualikan. Dipakai tombol "kembali" di
  // player supaya balik ke tempat user datang, bukan selalu ke Home.
  useEffect(() => {
    const p = location.pathname;
    if (p === "/nonton" || p.startsWith("/baca/")) return;
    try {
      sessionStorage.setItem(
        "yn-return-to",
        `${location.pathname}${location.search}`,
      );
    } catch {
      /* storage diblokir - tombol kembali jatuh ke Home */
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "navigate") return;
      if (event.data.direction === "back") {
        // Balik ke halaman terakhir yang bukan /nonton maupun /baca. RouteSyncer
        // menulis yn-return-to setiap kali route berubah (kecuali /nonton dan
        // /baca), jadi dari sini ambil targetnya, ganti URL dengan replaceState,
        // lalu navigasi replace client-side - tidak ada full reload dan
        // breadcrumb/halaman tampil seperti yang seharusnya.
        let target = "/home";
        try {
          target =
            (sessionStorage.getItem("yn-return-to") ?? "").trim() ||
            "/home";
        } catch {
          /* storage diblokir - tetap ke Home */
        }
        if (target.startsWith("/nonton") || target.split("?")[0].startsWith("/baca/")) {
          target = "/home";
        }
        const to = target.startsWith("?") ? "/home" + target : target;
        if (typeof window !== "undefined") {
          try {
            window.history.replaceState(null, "", to);
          } catch {
            /* history diblokir */
          }
        }
        navigate(to, { replace: true });
      }
      if (event.data.direction === "forward") window.history.forward();
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <UpdateGate>
        <BrowserRouter>
          <ModerationProvider>
            <MusicPlayerProvider>
            {/* Worker unduhan hidup di semua halaman: memilih resolusi di
                popup Unduh harus langsung menjalankan unduhannya, bukan
                hanya menambah baris di daftar. */}
            <DownloadWorker />
            <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/home" />}
              />
              <Route
                path="/login"
                element={<Login />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/home"
                element={
                  <RequireAuth>
                    <Home />
                  </RequireAuth>
                }
              />
              <Route
                path="/nonton"
                element={
                  <RequireAuth>
                    <Watch />
                  </RequireAuth>
                }
              />
              <Route
                path="/clan"
                element={
                  <RequireAuth>
                    <Clan />
                  </RequireAuth>
                }
              />
              <Route
                path="/info"
                element={
                  <RequireAuth>
                    <Info />
                  </RequireAuth>
                }
              />
              <Route
                path="/catalog"
                element={
                  <RequireAuth>
                    <Catalog />
                  </RequireAuth>
                }
              />
              <Route
                path="/jadwal"
                element={
                  <RequireAuth>
                    <Jadwal />
                  </RequireAuth>
                }
              />
              <Route
                path="/akun"
                element={
                  <RequireAuth>
                    <Akun />
                  </RequireAuth>
                }
              />
              <Route
                path="/manga"
                element={
                  <RequireAuth>
                    <Manga />
                  </RequireAuth>
                }
              />
              <Route
                path="/manhwa"
                element={
                  <RequireAuth>
                    <Manhwa />
                  </RequireAuth>
                }
              />
              {/* Tab Baca: panel ganti kategori + katalog. Bentrok dengan
                  reader /baca/:slug/:chapter TIDAK — route ini lebih spesifik
                  cocok hanya untuk /baca persis. */}
              <Route
                path="/baca"
                element={
                  <RequireAuth>
                    <Baca />
                  </RequireAuth>
                }
              />
              
              {/* Reader layar penuh: navbar & mini player disembunyikan otomatis */}
              <Route
                path="/baca/:slug/:chapter"
                element={
                  <RequireAuth>
                    <ReadComic />
                  </RequireAuth>
                }
              />
              <Route
                path="/premium"
                element={
                  <RequireAuth>
                    <Premium />
                  </RequireAuth>
                }
              />
              <Route
                path="/film"
                element={
                  <RequireAuth>
                    <Film />
                  </RequireAuth>
                }
              />
              {/* GACHA & TITLE — dibuka lewat tombol navigasi bawah
                  (tekan-lama History↔Gacha / Subscribe↔Title). */}
              <Route
                path="/gacha"
                element={
                  <RequireAuth>
                    <Gacha />
                  </RequireAuth>
                }
              />
              <Route
                path="/title"
                element={
                  <RequireAuth>
                    <Title />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
            </MusicPlayerProvider>
          </ModerationProvider>
        </BrowserRouter>
        </UpdateGate>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
