import { createFileRoute, redirect } from "@tanstack/react-router";

// Tasks merged into Chores (one-time tab). Keep the old route as a redirect
// so existing links/bookmarks keep working. No data was moved or deleted.
export const Route = createFileRoute("/_authenticated/tasks")({
  beforeLoad: () => {
    throw redirect({ to: "/chores", search: { tab: "one-time" } });
  },
});
