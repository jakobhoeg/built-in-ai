import type { SVGProps } from "react";

export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="8" height="24" viewBox="0 -9 3 24" {...props}>
    <path
      d="M0 0L3 3L0 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
