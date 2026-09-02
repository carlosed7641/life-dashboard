import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number };

function base({
  size = 18,
  strokeWidth = 1.6,
  ...props
}: IconProps & { strokeWidth?: number }): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

export function IconGrid(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
    </svg>
  );
}

export function IconCheckSquare(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

export function IconMail(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconFolder(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function IconNote(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function IconFile(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

/* --- Marcas (relleno, un solo trazo) --- */

export function IconGmail({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="m18.73 5.41-1.28 1L12 10.46 6.55 6.37l-1.28-1A2 2 0 0 0 2 7.05v11.59A1.36 1.36 0 0 0 3.36 20h3.19v-7.72L12 16.37l5.45-4.09V20h3.19A1.36 1.36 0 0 0 22 18.64V7.05a2 2 0 0 0-3.27-1.64z" />
    </svg>
  );
}

export function IconGoogleCalendar({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
    </svg>
  );
}

export function IconGoogleDrive({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" {...p}>
      <path d="M339 314.9L175.4 32h161.2l163.6 282.9H339zm-137.5 23.6L120.9 480h310.5L512 338.5H201.5zM154.1 67.4L0 338.5 80.6 480 237 208.8 154.1 67.4z" />
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  );
}

export function IconSunrise(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="M12 3v3" />
      <path d="m5.6 9.6 1.4 1.4" />
      <path d="M3 16h1.5" />
      <path d="M19.5 16H21" />
      <path d="m17 11 1.4-1.4" />
      <path d="M8 16a4 4 0 0 1 8 0" />
      <path d="M2 20h20" />
      <path d="m9 5 3-3 3 3" />
    </svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M17 7l1.4-1.4M5.6 18.4 7 17" />
    </svg>
  );
}

export function IconBrief(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 2 })}>
      <path d="M12 3a6 6 0 0 0-6 6c0 2 1 3.5 2 4.5V17h8v-3.5c1-1 2-2.5 2-4.5a6 6 0 0 0-6-6z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 2 })}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 3 })}>
      <path d="m4 12 5 5 11-11" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

export function IconDots(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.8 })}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconPin({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })} fill={filled ? "currentColor" : "none"}>
      <path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
      <path d="M12 15.5V21" />
    </svg>
  );
}

export function IconStar({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })} fill={filled ? "currentColor" : "none"}>
      <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21 8 13.9 2 9.4h7.6z" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 2 })}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconExternal(p: IconProps) {
  return (
    <svg {...base({ ...p, strokeWidth: 1.7 })}>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export const NAV_ICON = {
  grid: IconGrid,
  calendar: IconCalendar,
  check: IconCheckSquare,
  mail: IconMail,
  note: IconNote,
  file: IconFile,
} as const;

export type NavIconName = keyof typeof NAV_ICON;

export function IconImage(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <path d="m21 15-4.5-4.5L5 21" />
    </svg>
  );
}

export function IconVideo(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="14" height="14" rx="2.5" />
      <path d="m17 9 4-2v10l-4-2" />
    </svg>
  );
}

export function IconAudio(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function IconPdf(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
      <path d="M8.5 13.5h1a1.5 1.5 0 0 1 0 3h-1zM8.5 16.5V13" />
      <path d="M14.5 13.5v3M14.5 13.5h1.8M14.5 15h1.4" />
    </svg>
  );
}

export function IconSheet(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h8M12 13v4" />
    </svg>
  );
}

export function IconArchive(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M11 12h2M11 15h2" />
    </svg>
  );
}

export function IconCode(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9 8-5 4 5 4" />
      <path d="m15 8 5 4-5 4" />
    </svg>
  );
}

export const FILE_ICON = {
  image: IconImage,
  video: IconVideo,
  audio: IconAudio,
  pdf: IconPdf,
  document: IconNote,
  spreadsheet: IconSheet,
  presentation: IconGrid,
  folder: IconFolder,
  archive: IconArchive,
  code: IconCode,
  file: IconFile,
} as const;
