import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Warehouse,
  Package,
  Truck,
  ShoppingBag,
  BookOpen,
  Trash2,
  Coffee,
  BedDouble,
  Users,
  Settings,
  BarChart3,
  Store,
  CalendarClock,
  PackagePlus,
  Building2,
  UtensilsCrossed,
  ShieldCheck,
  Percent,
  GitCompare,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type NavItemDef = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Shown in simplified primary list */
  primary?: boolean;
  /** Chord after `g` (go), e.g. "p" → g then p */
  go?: string;
  /** Alt+digit when focused in app */
  alt?: string;
};

export type NavSectionDef = {
  id: string;
  titleKey: string;
  items: NavItemDef[];
  /** Collapsed by default in simplified nav */
  collapsedByDefault?: boolean;
};

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "main",
    titleKey: "sections.main",
    items: [
      {
        href: "/dashboard",
        labelKey: "dashboard",
        icon: LayoutDashboard,
        primary: true,
        go: "d",
        alt: "1",
      },
      {
        href: "/pos",
        labelKey: "pos",
        icon: ShoppingCart,
        primary: true,
        go: "p",
        alt: "2",
      },
    ],
  },
  {
    id: "stock",
    titleKey: "sections.stock",
    items: [
      {
        href: "/warehouse",
        labelKey: "warehouse",
        icon: Warehouse,
        primary: true,
        go: "w",
        alt: "3",
      },
      {
        href: "/inventory",
        labelKey: "inventory",
        icon: ClipboardList,
        primary: true,
        go: "i",
        alt: "4",
      },
      { href: "/lots", labelKey: "lots", icon: CalendarClock, go: "l" },
      { href: "/reorder", labelKey: "reorder", icon: PackagePlus, go: "q" },
    ],
  },
  {
    id: "purchase",
    titleKey: "sections.purchase",
    items: [
      {
        href: "/goods-receipt",
        labelKey: "goodsReceipt",
        icon: Truck,
        primary: true,
        go: "r",
        alt: "5",
      },
      {
        href: "/orders",
        labelKey: "orders",
        icon: ShoppingBag,
        primary: true,
        go: "o",
        alt: "6",
      },
      {
        href: "/suppliers",
        labelKey: "suppliers",
        icon: Truck,
        go: "u",
      },
    ],
  },
  {
    id: "catalog",
    titleKey: "sections.catalog",
    items: [
      {
        href: "/products",
        labelKey: "products",
        icon: Package,
        primary: true,
        go: "a",
        alt: "7",
      },
      {
        href: "/recipes",
        labelKey: "recipes",
        icon: BookOpen,
        go: "c",
      },
      { href: "/outlets", labelKey: "outlets", icon: Building2, go: "t" },
    ],
  },
  {
    id: "fb",
    titleKey: "sections.fb",
    collapsedByDefault: true,
    items: [
      { href: "/food-waste", labelKey: "foodWaste", icon: Trash2, go: "f" },
      { href: "/breakfast", labelKey: "breakfast", icon: Coffee, go: "b" },
      { href: "/minibar", labelKey: "minibar", icon: BedDouble, go: "m" },
      { href: "/banquet", labelKey: "banquet", icon: UtensilsCrossed, go: "j" },
      { href: "/haccp", labelKey: "haccp", icon: ShieldCheck, go: "h" },
    ],
  },
  {
    id: "analysis",
    titleKey: "sections.analysis",
    items: [
      { href: "/food-cost", labelKey: "foodCost", icon: Percent, go: "y" },
      { href: "/variances", labelKey: "variances", icon: GitCompare, go: "v" },
      { href: "/valuation", labelKey: "valuation", icon: Scale, go: "x" },
    ],
  },
  {
    id: "admin",
    titleKey: "sections.admin",
    collapsedByDefault: true,
    items: [
      {
        href: "/reports",
        labelKey: "reports",
        icon: BarChart3,
        primary: true,
        go: "e",
        alt: "8",
      },
      { href: "/users", labelKey: "users", icon: Users, go: "n" },
      {
        href: "/pos-config",
        labelKey: "posConfig",
        icon: Store,
        go: "k",
      },
      { href: "/settings", labelKey: "settings", icon: Settings, go: "," },
    ],
  },
];

export function flattenNavItems(sections: NavSectionDef[] = NAV_SECTIONS) {
  return sections.flatMap((s) => s.items);
}

export function findNavIndex(pathname: string, items = flattenNavItems()) {
  let best = -1;
  let bestLen = -1;
  items.forEach((item, idx) => {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (item.href.length > bestLen) {
        best = idx;
        bestLen = item.href.length;
      }
    }
  });
  return best >= 0 ? best : 0;
}
