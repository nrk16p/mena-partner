import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { isAdmin } from "./roles"

const ALLOWED_DOMAIN = "menatransport.co.th"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = user?.email ?? (profile as { email?: string })?.email ?? ""
      return email.split("@")[1]?.toLowerCase() === ALLOWED_DOMAIN
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.email = token.email ?? (profile as { email?: string })?.email
      }
      token.role = isAdmin(token.email as string) ? "admin" : "viewer"
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
}
