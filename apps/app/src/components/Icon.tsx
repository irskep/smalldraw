import { h } from "preact";
import type { IconNode } from "lucide";

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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon.map(([tag, attributes], index) =>
        h(tag, { ...attributes, key: index }),
      )}
    </svg>
  );
}
