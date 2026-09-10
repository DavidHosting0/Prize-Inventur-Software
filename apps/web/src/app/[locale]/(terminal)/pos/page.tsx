import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { loadPosBootstrap } from "@/lib/pos-bootstrap";
import { setRequestLocale } from "next-intl/server";
import { PosTerminalClient } from "./pos-terminal-client";
import { redirect } from "next/navigation";

export default async function PosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) return null;
  if (!session.user.hotelId) {
    redirect(
      session.user.accountType === "GROUP"
        ? `/${locale}/group/dashboard`
        : `/${locale}/login`
    );
  }

  const canDiscount =
    session.user.roleCode === "ADMIN" ||
    session.user.roleCode === "GROUP_ADMIN" ||
    hasPermission(session.user, "pos.discount");
  const canCreateProduct =
    session.user.roleCode === "ADMIN" ||
    session.user.roleCode === "GROUP_ADMIN" ||
    hasPermission(session.user, "products.create");

  const bootstrap = await loadPosBootstrap(session.user.hotelId, {
    canDiscount,
    canCreateProduct,
  });

  return (
    <PosTerminalClient
      bootstrap={bootstrap}
      currency={session.user.currency}
      hotelLocale={session.user.hotelLocale}
    />
  );
}
