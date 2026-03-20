import * as React from "react";
import { cn } from "@/lib/utils";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="sidebar"
    className={cn(
      "flex min-h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)]",
      className
    )}
    {...props}
  />
));
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
      data-sidebar="header"
      className={cn(
      "flex shrink-0 items-center gap-2",
      className
    )}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
      data-sidebar="content"
      className={cn("flex flex-1 flex-col gap-1 overflow-auto pt-2 pb-4", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full flex-col gap-0.5 px-2", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} data-sidebar="menu-item" className={cn("list-none", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

export interface SidebarMenuButtonProps
  extends Omit<React.ComponentProps<"a">, "href"> {
  isActive?: boolean;
  icon?: React.ReactNode;
}

const SidebarMenuButton = React.forwardRef<
  HTMLAnchorElement,
  SidebarMenuButtonProps
>(({ className, isActive, icon, children, ...props }, ref) => (
  <a
    ref={ref}
    data-sidebar="menu-button"
    data-active={isActive}
    className={cn(
      "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--font-size-small)] font-normal transition-all",
      isActive
        ? "bg-[rgba(113,128,255,0.12)] text-[var(--color-accent)] font-[var(--font-weight-medium)]"
        : "text-[var(--color-text-secondary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-[var(--color-text-primary)]",
      className
    )}
    {...props}
  >
    {icon && (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-5">
        {icon}
      </span>
    )}
    <span className="truncate">{children}</span>
  </a>
));
SidebarMenuButton.displayName = "SidebarMenuButton";

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
};
