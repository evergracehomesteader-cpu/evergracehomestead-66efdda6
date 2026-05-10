import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PawPrint, Wheat, Sprout, Recycle, Receipt, Handshake, LogOut, ListTodo, CalendarDays, BarChart3, Bell } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const manage = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Animals", url: "/animals", icon: PawPrint },
  { title: "Feed", url: "/feed", icon: Wheat },
  { title: "Garden", url: "/garden", icon: Sprout },
  { title: "Compost", url: "/compost", icon: Recycle },
  { title: "Bills", url: "/bills", icon: Receipt },
  { title: "Barter", url: "/barter", icon: Handshake },
];

const plan = [
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Reminders", url: "/reminders", icon: Bell },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();

  const renderItems = (items: { title: string; url: string; icon: typeof Home }[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={path === item.url || path.startsWith(item.url + "/")}>
          <Link to={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-display text-lg font-semibold">
            H
          </div>
          <div className="font-display text-lg font-semibold">Homestead</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(manage)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Plan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(plan)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="text-xs text-sidebar-foreground/70 truncate px-2">{user?.email}</div>
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
