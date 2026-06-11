import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";
import { LegendsLogo } from "@/components/LegendsLogo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Read from localStorage first so a hard refresh doesn't bounce to /auth
    // while the session is still hydrating. getUser() makes a network call
    // and treats transient/refresh failures as "no user".
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw redirect({ to: "/auth" });
    return { user: sessionData.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border/50 glass sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold tracking-wide">
            <LegendsLogo size="sm" />
            <span className="hidden sm:inline">Legends Arena</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/personas"><Button size="sm" variant="ghost">Personas</Button></Link>
            <Link to="/voices"><Button size="sm" variant="ghost">Vozes</Button></Link>
            <Link to="/new"><Button size="sm">Novo debate</Button></Link>
            <ThemeToggle />
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
