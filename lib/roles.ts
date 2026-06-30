// All authenticated @menatransport.co.th users are admin for this module
export function isAdmin(email: string | null | undefined): boolean {
  const domain = (email ?? "").split("@")[1]?.toLowerCase()
  return domain === "menatransport.co.th"
}
