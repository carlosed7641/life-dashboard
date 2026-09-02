"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV, MOBILE_TABS, isActive } from "@/lib/nav";
import { NAV_ICON, IconHome, IconMenu, IconDots, IconLogout } from "@/components/icons";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

type UserInfo = { name: string | null; email: string | null; image: string | null };

function Avatar({
  user,
  initials,
  size,
}: {
  user: UserInfo;
  initials: string;
  size: number;
}) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name ?? "Perfil"}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#2e6b4c] font-semibold text-[#eaf7ef]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: UserInfo;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar escritorio */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col gap-6 bg-sidebar px-[18px] py-7 text-sidebar-muted">
        <Brand />
        <nav className="flex flex-col gap-[3px]">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <UserChip user={user} initials={initials} />
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] text-sidebar-dim transition-colors hover:bg-white/5 hover:text-white"
            >
              <IconLogout size={16} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-[18px] py-3.5 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawer(true)}
            className="text-sidebar-muted"
          >
            <IconMenu size={22} />
          </button>
          <span className="font-display text-[15px] font-semibold text-[#f4fbf7]">
            Mi Dashboard
          </span>
        </div>
        <Avatar user={user} initials={initials} size={32} />
      </header>

      {/* Contenido */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>

      {/* Barra inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card px-1.5 pb-2.5 pt-2 md:hidden">
        {MOBILE_TABS.map((item) => {
          const Icon = NAV_ICON[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px]",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon size={21} />
              <span className={active ? "font-semibold" : undefined}>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] text-muted"
        >
          <IconDots size={21} />
          <span>Más</span>
        </button>
      </nav>

      {/* Drawer móvil con la navegación completa */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-0 top-0 flex h-full w-72 flex-col gap-6 bg-sidebar px-[18px] py-7 text-sidebar-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <Brand />
            <nav className="flex flex-col gap-[3px]">
              {NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onClick={() => setDrawer(false)}
                />
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3">
              <UserChip user={user} initials={initials} />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] text-sidebar-dim hover:bg-white/5 hover:text-white"
                >
                  <IconLogout size={16} />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-[11px] px-1.5">
      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-accent text-white">
        <IconHome size={18} />
      </span>
      <span className="font-display text-[15px] font-semibold text-[#f4fbf7]">
        Mi Dashboard
      </span>
    </div>
  );
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = NAV_ICON[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-accent/20 font-semibold text-white"
          : "text-sidebar-muted hover:bg-white/[0.06]",
      )}
    >
      <Icon size={18} />
      {item.label}
    </Link>
  );
}

function UserChip({ user, initials }: { user: UserInfo; initials: string }) {
  return (
    <div className="flex items-center gap-[11px] rounded-xl bg-white/5 px-3 py-2.5">
      <Avatar user={user} initials={initials} size={30} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold text-[#eaf7ef]">
          {user.name ?? "Mi cuenta"}
        </span>
        <span className="truncate text-[11px] text-sidebar-dim">{user.email}</span>
      </div>
    </div>
  );
}
