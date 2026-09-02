import type { NavIconName } from "@/components/icons";

export type NavEntry = {
  href: string;
  label: string;
  icon: NavIconName;
};

/** Navegación completa (sidebar de escritorio + hoja "Más" en móvil). */
export const NAV: NavEntry[] = [
  { href: "/", label: "Resumen", icon: "grid" },
  { href: "/calendario", label: "Calendario", icon: "calendar" },
  { href: "/tareas", label: "Tareas", icon: "check" },
  { href: "/correos", label: "Correos", icon: "mail" },
  { href: "/notas", label: "Notas", icon: "note" },
  { href: "/archivos", label: "Archivos", icon: "file" },
];

/** Accesos directos de la barra inferior en móvil (el 5.º es "Más"). */
export const MOBILE_TABS: NavEntry[] = [
  { href: "/", label: "Resumen", icon: "grid" },
  { href: "/calendario", label: "Calendario", icon: "calendar" },
  { href: "/tareas", label: "Tareas", icon: "check" },
  { href: "/notas", label: "Notas", icon: "note" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
