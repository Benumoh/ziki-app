import type { ReactNode } from "react";
import type { OnboardingGoalValue } from "@/lib/onboarding-flow";

/**
 * #onboarding: line icons for the welcome flow, sign-up and the feedback
 * prompt, drawn like the app's other inline icons (24px grid, 2px stroke).
 * Always decorative: the text next to them carries the meaning.
 */
function Icon({ children, size = 18, strokeWidth = 2 }: { children: ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const ArrowRightIcon = ({ size }: IconProps) => (
  <Icon size={size} strokeWidth={2.4}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Icon>
);
export const ArrowLeftIcon = ({ size }: IconProps) => (
  <Icon size={size} strokeWidth={2.4}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Icon>
);
export const CheckIcon = ({ size }: IconProps) => (
  <Icon size={size} strokeWidth={2.6}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
export const CloseIcon = ({ size }: IconProps) => (
  <Icon size={size} strokeWidth={2.4}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
export const SparkleIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
  </Icon>
);
export const LightbulbIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M9 18h6M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  </Icon>
);
export const PeopleIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
export const ShippedIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="M22 4 12 14.01l-3-3" />
  </Icon>
);
export const CompassIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
  </Icon>
);
export const WrenchIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Icon>
);
export const AgentIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M12 4v4M9 14h.01M15 14h.01" />
  </Icon>
);
export const MessageIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);
export const ShieldCheckIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

/** The icon for each welcome-flow goal. */
export function GoalIcon({ goal, size }: { goal: OnboardingGoalValue; size?: number }) {
  if (goal === "explore_projects") return <CompassIcon size={size} />;
  if (goal === "contribute_issues") return <WrenchIcon size={size} />;
  return <AgentIcon size={size} />;
}

export const ChevronDownIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
