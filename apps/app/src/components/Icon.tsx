import type { IconNode } from "lucide";
import { h } from "preact";

/** Render the same Lucide geometry used by the re:dom design-system controls. */
export function Icon({
  icon,
  className,
}: {
  icon: IconNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon.map(([tag, attributes], index) =>
        h(tag, { ...attributes, key: index }),
      )}
    </svg>
  );
}
