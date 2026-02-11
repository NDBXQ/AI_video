export const ONBOARDING_DISMISSED_COOKIE_NAME = "ai_video_onboarding_dismissed"

export function buildOnboardingDismissedCookie(input: {
  dismissed: boolean
  maxAgeSeconds?: number
  secure?: boolean
}): string {
  const maxAgeSeconds = input.dismissed ? (input.maxAgeSeconds ?? 60 * 60 * 24 * 365) : 0
  const value = input.dismissed ? "1" : "0"
  const secure = input.secure ? "; Secure" : ""

  return `${ONBOARDING_DISMISSED_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}
