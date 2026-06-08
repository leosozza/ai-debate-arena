import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <Mic className="h-5 w-5 text-primary" />
            Arena IA
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/new"><Button size="sm">Novo debate</Button></Link>
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
