import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { getUserPermissions } from "./rbac";
import type { AccountType, Permission } from "@prize/types";
import type { Session } from "next-auth";
import { canViewAllHotels } from "./tenant";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      roleCode: string;
      accountType: AccountType;
      organizationId: string;
      hotelId: string | null;
      hotelSlug: string | null;
      permissions: Permission[];
      locale: string;
      currency: string;
      hotelLocale: string;
      hotelName: string;
    };
  }

  interface User {
    username: string;
    roleCode: string;
    accountType: AccountType;
    organizationId: string;
    hotelId: string | null;
    hotelSlug: string | null;
    permissions: Permission[];
    locale: string;
    currency: string;
    hotelLocale: string;
    hotelName: string;
  }
}

type AppJwt = {
  id?: string;
  username?: string;
  roleCode?: string;
  accountType?: AccountType;
  organizationId?: string;
  hotelId?: string | null;
  hotelSlug?: string | null;
  permissions?: Permission[];
  locale?: string;
  currency?: string;
  hotelLocale?: string;
  hotelName?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: true,
            hotels: {
              include: { hotel: true },
              orderBy: { isDefault: "desc" },
            },
          },
        });

        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const permissions = await getUserPermissions(user.id);
        const accountType = user.accountType as AccountType;

        if (accountType === "HOTEL") {
          const hotelLink = user.hotels[0];
          if (!hotelLink) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            roleCode: user.role.code,
            accountType,
            organizationId: user.organizationId,
            hotelId: hotelLink.hotelId,
            hotelSlug: hotelLink.hotel.slug,
            permissions,
            locale: user.locale,
            currency: hotelLink.hotel.currency,
            hotelLocale: hotelLink.hotel.locale,
            hotelName: hotelLink.hotel.name,
          };
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          roleCode: user.role.code,
          accountType,
          organizationId: user.organizationId,
          hotelId: null,
          hotelSlug: null,
          permissions,
          locale: user.locale,
          currency: "CHF",
          hotelLocale: "de-CH",
          hotelName: "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as typeof token & AppJwt;
      if (user) {
        t.id = user.id;
        t.username = user.username;
        t.roleCode = user.roleCode;
        t.accountType = user.accountType;
        t.organizationId = user.organizationId;
        t.hotelId = user.hotelId;
        t.hotelSlug = user.hotelSlug;
        t.permissions = user.permissions;
        t.locale = user.locale;
        t.currency = user.currency;
        t.hotelLocale = user.hotelLocale;
        t.hotelName = user.hotelName;
      }

      // Backfill / heal tenant fields for pre-migration or post-seed stale JWTs
      if (t.id) {
        const needsTenantBackfill = !t.accountType || !t.organizationId;
        const needsSlugBackfill = Boolean(t.hotelId) && !t.hotelSlug;
        const hotelIdToCheck = t.hotelId ? String(t.hotelId) : null;
        let hotelLinkValid = !hotelIdToCheck;
        if (hotelIdToCheck) {
          const link = await prisma.userHotel.findFirst({
            where: { userId: String(t.id), hotelId: hotelIdToCheck },
          });
          hotelLinkValid = Boolean(link);
        }
        if (needsTenantBackfill || !hotelLinkValid || needsSlugBackfill) {
          const dbUser = await prisma.user.findUnique({
            where: { id: String(t.id) },
            include: {
              role: true,
              hotels: {
                include: { hotel: true },
                orderBy: { isDefault: "desc" },
                take: 1,
              },
            },
          });
          if (dbUser) {
            t.accountType = dbUser.accountType as AccountType;
            t.organizationId = dbUser.organizationId;
            t.roleCode = dbUser.role.code;
            t.permissions = await getUserPermissions(dbUser.id);
            if (t.accountType === "HOTEL") {
              const link = dbUser.hotels[0];
              if (link) {
                t.hotelId = link.hotelId;
                t.hotelSlug = link.hotel.slug;
                t.currency = link.hotel.currency;
                t.hotelLocale = link.hotel.locale;
                t.hotelName = link.hotel.name;
              } else {
                t.hotelId = null;
                t.hotelSlug = null;
                t.hotelName = "";
              }
            } else if (t.hotelId) {
              const hotel = await prisma.hotel.findFirst({
                where: {
                  id: String(t.hotelId),
                  organizationId: dbUser.organizationId,
                },
              });
              if (hotel) {
                t.hotelSlug = hotel.slug;
                t.currency = hotel.currency;
                t.hotelLocale = hotel.locale;
                t.hotelName = hotel.name;
              } else {
                t.hotelId = null;
                t.hotelSlug = null;
                t.hotelName = "";
              }
            } else {
              t.hotelSlug = null;
            }
          }
        }
      }

      if (trigger === "update" && session) {
        const userId = String(t.id ?? "");
        const accountType = t.accountType as AccountType;

        if (
          accountType === "GROUP" &&
          "hotelId" in session &&
          (session.hotelId === null || session.hotelId === "")
        ) {
          t.hotelId = null;
          t.hotelSlug = null;
          t.currency = "CHF";
          t.hotelLocale = "de-CH";
          t.hotelName = "";
          return t;
        }

        if (session?.hotelId) {
          const hotelId = String(session.hotelId);
          if (!userId) return t;

          if (accountType === "HOTEL") {
            if (t.hotelId && t.hotelId !== hotelId) {
              return t;
            }
          }

          const hotel = await prisma.hotel.findFirst({
            where: {
              id: hotelId,
              organizationId: String(t.organizationId),
            },
          });
          if (!hotel) return t;

          if (accountType === "HOTEL") {
            const link = await prisma.userHotel.findFirst({
              where: { userId, hotelId },
            });
            if (!link) return t;
          } else {
            const sessionUser = {
              id: userId,
              accountType,
              organizationId: String(t.organizationId),
              hotelId,
              hotelSlug: hotel.slug,
              permissions: (t.permissions ?? []) as Permission[],
              roleCode: String(t.roleCode ?? ""),
              email: "",
              name: "",
              username: "",
              locale: "de",
              currency: hotel.currency,
              hotelLocale: hotel.locale,
              hotelName: hotel.name,
            };
            const allowed =
              canViewAllHotels(sessionUser) ||
              (await prisma.userHotel.findFirst({
                where: { userId, hotelId },
              }));
            if (!allowed) return t;
          }

          t.hotelId = hotel.id;
          t.hotelSlug = hotel.slug;
          t.currency = hotel.currency;
          t.hotelLocale = hotel.locale;
          t.hotelName = hotel.name;
        }
      }

      return t;
    },
    async session({ session, token }) {
      const t = token as typeof token & AppJwt;
      const userId = String(t.id ?? "");
      if (userId) {
        const exists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!exists) {
          // Force logout path: empty id so layouts redirect to login
          const user = session.user as Session["user"];
          user.id = "";
          return session;
        }
      }
      const user = session.user as Session["user"];
      user.id = userId;
      user.email = session.user.email ?? "";
      user.name = session.user.name ?? "";
      user.username = String(t.username ?? "");
      user.roleCode = String(t.roleCode ?? "");
      user.accountType = (t.accountType as AccountType) ?? "HOTEL";
      user.organizationId = String(t.organizationId ?? "");
      user.hotelId = t.hotelId ? String(t.hotelId) : null;
      user.hotelSlug = t.hotelSlug ? String(t.hotelSlug) : null;
      user.permissions = (t.permissions ?? []) as Session["user"]["permissions"];
      user.locale = String(t.locale ?? "de");
      user.currency = String(t.currency ?? "CHF");
      user.hotelLocale = String(t.hotelLocale ?? "de-CH");
      user.hotelName = String(t.hotelName ?? "");
      return session;
    },
  },
});
