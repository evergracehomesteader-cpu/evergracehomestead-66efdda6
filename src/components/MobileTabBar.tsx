import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PawPrint, Wheat, CalendarCheck, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

const tabs = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Animals", url: "/animals", icon: PawPrint },
  { title: "Feed", url: "/feed", icon: Wheat },
  { title: "Chores", url: "/chores", icon: CalendarCheck },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();

  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(t.url);
          return (
            <li key={t.url}>
              <Link
                to={t.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium min-h-[56px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <t.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span>{t.title}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium min-h-[56px] text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
