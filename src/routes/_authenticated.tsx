import { createFileRoute, Outlet, Navigate, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION } from "@/lib/app-version";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 md:h-14 flex items-center border-b bg-card/80 backdrop-blur px-3 md:px-4 gap-2 sticky top-0 z-30">
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>
            <div className="font-display font-semibold text-base md:text-base truncate">Homestead Hub</div>
          </header>
          <main
            className="flex-1 px-3 py-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
          >
            <Outlet />
          </main>
          <footer className="hidden md:flex border-t bg-card/30 px-3 md:px-4 py-2 md:py-3 text-xs text-muted-foreground flex-wrap items-center justify-between gap-2">
            <span>Homestead Hub · v{APP_VERSION}</span>
            <div className="flex gap-3">
              <Link to="/changelog" className="hover:underline">Changelog</Link>
              <Link to="/app-updates" className="hover:underline">App Updates</Link>
            </div>
          </footer>
        </div>
        <MobileTabBar />
      </div>
    </SidebarProvider>
  );
}
