import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/debates/$id")({
  component: DebateLayout,
});

function DebateLayout() {
  return <Outlet />;
}