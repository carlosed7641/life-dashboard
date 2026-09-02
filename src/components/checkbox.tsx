import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/icons";

export function CheckBox({
  checked,
  onToggle,
  size = 18,
  disabled,
}: {
  checked: boolean;
  onToggle?: () => void;
  size?: number;
  disabled?: boolean;
}) {
  const Tag = onToggle ? "button" : "span";
  return (
    <Tag
      {...(onToggle ? { type: "button" as const, onClick: onToggle, disabled } : {})}
      aria-pressed={onToggle ? checked : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md transition-colors",
        checked ? "bg-accent text-white" : "border-[1.5px] border-border-strong",
        onToggle && "cursor-pointer disabled:opacity-50",
      )}
      style={{ width: size, height: size }}
    >
      {checked && <IconCheck size={size - 6} />}
    </Tag>
  );
}
