import React from "react"

type AuthCardShellProps = {
  tone?: "neutral" | "success" | "error"
  icon?: React.ReactNode
  children: React.ReactNode
  testId?: string
}

const TONE_STYLES: Record<
  NonNullable<AuthCardShellProps["tone"]>,
  { ring: string; iconBg: string; iconText: string }
> = {
  neutral: {
    ring: "border-gray-200",
    iconBg: "bg-gray-100",
    iconText: "text-ui-fg-base",
  },
  success: {
    ring: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
  },
  error: {
    ring: "border-red-200",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
  },
}

/**
 * Centered card wrapper used by auth-flow pages (login, forgot-password,
 * reset-password, verify-email). Keeps a consistent visual language across
 * all auth-related entry points.
 */
export default function AuthCardShell({
  tone = "neutral",
  icon,
  children,
  testId,
}: AuthCardShellProps) {
  const styles = TONE_STYLES[tone]

  return (
    <div
      className="flex w-full items-center justify-center px-4 py-10"
      data-testid={testId}
    >
      <div
        className={
          "w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm small:p-8 " +
          styles.ring
        }
      >
        {icon ? (
          <div className="mb-5 flex justify-center">
            <span
              className={
                "inline-flex h-12 w-12 items-center justify-center rounded-full " +
                styles.iconBg +
                " " +
                styles.iconText
              }
              aria-hidden="true"
            >
              {icon}
            </span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function CheckCircleIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}

export function AlertCircleIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function MailIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export function KeyIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  )
}
