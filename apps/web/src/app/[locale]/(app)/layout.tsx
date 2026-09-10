import { setRequestLocale } from "next-intl/server";
import { AppFrame } from "@/components/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AppFrame>{children}</AppFrame>;
}
