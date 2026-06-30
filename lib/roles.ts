export const ADMIN_EMAILS = new Set([
  "bunphak.p@menatransport.co.th",
  "kittaboon.l@menatransport.co.th",
  // add more admin emails here
])

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has(email ?? "")
}
