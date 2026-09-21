import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Users,
  Shield,
  Bot,
  Plug,
  Settings,
  ScrollText,
  TrendingUp,
  Award,
  Wallet,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import type { NavSectionDef } from "./nav";

export type { NavItemDef, NavSectionDef } from "./nav";
export type { LucideIcon };

export const GROUP_NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "overview",
    titleKey: "sections.overview",
    items: [
      {
        href: "/group/dashboard",
        labelKey: "groupDashboard",
        icon: LayoutDashboard,
        primary: true,
        go: "d",
        alt: "1",
      },
      {
        href: "/group/hotels",
        labelKey: "groupHotels",
        icon: Building2,
        primary: true,
        go: "h",
        alt: "2",
      },
      {
        href: "/group/analytics",
        labelKey: "groupAnalytics",
        icon: BarChart3,
        primary: true,
        go: "a",
        alt: "3",
      },
    ],
  },
  {
    id: "analysis",
    titleKey: "sections.analysis",
    items: [
      {
        href: "/group/revenue-compare",
        labelKey: "groupRevenue",
        icon: TrendingUp,
        go: "r",
      },
      {
        href: "/group/top-products",
        labelKey: "groupTopProducts",
        icon: Award,
        go: "t",
      },
      {
        href: "/group/savings",
        labelKey: "groupSavings",
        icon: Wallet,
        go: "s",
      },
      {
        href: "/group/insights",
        labelKey: "groupInsights",
        icon: Lightbulb,
        go: "n",
      },
    ],
  },
  {
    id: "access",
    titleKey: "sections.access",
    items: [
      {
        href: "/group/users",
        labelKey: "groupUsers",
        icon: Users,
        primary: true,
        go: "u",
        alt: "4",
      },
      {
        href: "/group/permissions",
        labelKey: "groupPermissions",
        icon: Shield,
        go: "p",
      },
    ],
  },
  {
    id: "config",
    titleKey: "sections.config",
    collapsedByDefault: true,
    items: [
      {
        href: "/group/ai-config",
        labelKey: "groupAiConfig",
        icon: Bot,
        go: "i",
      },
      {
        href: "/group/api-config",
        labelKey: "groupApiConfig",
        icon: Plug,
        go: "e",
      },
      {
        href: "/group/settings",
        labelKey: "groupSettings",
        icon: Settings,
        go: ",",
      },
      {
        href: "/group/audit-logs",
        labelKey: "groupAuditLogs",
        icon: ScrollText,
        go: "l",
      },
    ],
  },
];
