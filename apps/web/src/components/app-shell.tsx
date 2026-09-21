"use client";

import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Menu,
  X,
  Search,
  LogOut,
  ChevronDown,
  Keyboard,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import { cn } from "@prize/ui";
import { NotificationBell } from "./notification-bell";
import { HotelSwitcher } from "./hotel-switcher";
import { HotelLink } from "./hotel-link";
import { PwaInstallBanner } from "./pwa-install-banner";
import { KeyboardProvider, useAppKeyboard } from "./keyboard-provider";
import { PageHeader } from "./page-header";
import { BrandMark } from "./brand-mark";
import type { Crumb } from "./breadcrumbs";
import { NAV_SECTIONS, flattenNavItems, findNavIndex } from "@/lib/nav";
import { hotelAppPath } from "@/lib/hotel-url";
import {
  isFullPageNavHref,
  navItemMatchesPath,
} from "@/lib/client-sections";
import {
  PageMetaProvider,
  usePageMetaState,
  useSetPageMeta,
} from "./page-meta";
import {
  HotelSectionProvider,
  useHotelSection,
} from "./hotel-section-provider";
import { HotelSectionOutlet } from "./hotel-section-outlet";
import dynamic from "next/dynamic";

const LazyGlobalSearch = dynamic(
  () => import("./global-search").then((m) => m.GlobalSearch),
  { ssr: false }
);
const LazyShortcutsHelp = dynamic(
  () => import("./shortcuts-help").then((m) => m.ShortcutsHelp),
  { ssr: false }
);

function AppSidebar({
  drawerOpen,
  setDrawerOpen,
}: {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}) {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const th = useTranslations("header");
  const ts = useTranslations("shortcuts");
  const pathname = usePathname();
  const locale = useLocale();
  const { data: session } = useSession();
  const { registerNav, openShortcutsHelp } = useAppKeyboard();
  const { sectionHref, navigateSection, warmSection, isClientSection } =
    useHotelSection();

  const hotelName =
    session?.user?.hotelName?.trim() || th("brandFallback");
  const activePath = sectionHref ?? pathname;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV_SECTIONS) {
      init[s.id] = !s.collapsedByDefault;
      if (s.items.some((i) => navItemMatchesPath(activePath, i.href))) {
        init[s.id] = true;
      }
    }
    return init;
  });

  const flat = useMemo(() => flattenNavItems(), []);

  useEffect(() => {
    for (const s of NAV_SECTIONS) {
      if (s.items.some((i) => navItemMatchesPath(activePath, i.href))) {
        setExpanded((prev) => ({ ...prev, [s.id]: true }));
      }
    }
  }, [activePath]);

  function onNavKeyDown(e: React.KeyboardEvent) {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "Home" &&
      e.key !== "End"
    ) {
      return;
    }
    e.preventDefault();
    const root = e.currentTarget as HTMLElement;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-nav-item]")
    );
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    let next = current < 0 ? 0 : current;
    if (e.key === "ArrowDown") next = Math.min(nodes.length - 1, current + 1);
    if (e.key === "ArrowUp") next = Math.max(0, current - 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = nodes.length - 1;
    nodes[next]?.focus();
  }

  function onNavClick(e: MouseEvent, href: string) {
    setDrawerOpen(false);
    if (isFullPageNavHref(href)) {
      navigateSection(href);
      e.preventDefault();
      return;
    }
    if (isClientSection(href)) {
      e.preventDefault();
      navigateSection(href);
    }
  }

  const sidebar = (
    <aside className="flex h-full w-[252px] flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <BrandMark name={hotelName} badge={th("officeBadge")} />

      <nav
        ref={registerNav}
        className="flex-1 overflow-y-auto px-2 py-3 outline-none"
        aria-label="Main"
        onKeyDown={onNavKeyDown}
      >
        {NAV_SECTIONS.map((section) => {
          const open = expanded[section.id] !== false;
          return (
            <div key={section.id} className="mb-2.5">
              <button
                type="button"
                className="sidebar-section-label"
                onClick={() =>
                  setExpanded((p) => ({ ...p, [section.id]: !open }))
                }
                aria-expanded={open}
              >
                <span className="flex-1 text-left">{t(section.titleKey)}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    open ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              {open ? (
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = navItemMatchesPath(activePath, item.href);
                    return (
                      <li key={item.href}>
                        <HotelLink
                          href={item.href}
                          data-nav-item
                          data-active={active ? "true" : "false"}
                          data-kbd-index={flat.indexOf(item)}
                          onClick={(e) => onNavClick(e, item.href)}
                          onMouseEnter={() => warmSection(item.href)}
                          onFocus={() => warmSection(item.href)}
                          className="nav-item"
                          tabIndex={0}
                          prefetch={item.href === "/pos"}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-80" />
                          <span className="flex-1 truncate">
                            {t(`items.${item.labelKey}`)}
                          </span>
                          {item.alt ? (
                            <span className="kbd opacity-50">{item.alt}</span>
                          ) : null}
                        </HotelLink>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text-dim)]">
          {session?.user?.roleCode ?? "—"}
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-[var(--sidebar-text)]">
          {session?.user?.name}
        </div>
        <div className="truncate text-[11px] text-[var(--sidebar-text-dim)]">
          {session?.user?.email}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sidebar-text-muted)] hover:text-[var(--danger)]"
          >
            <LogOut className="h-3 w-3" />
            {ta("signOut")}
          </button>
          <button
            type="button"
            onClick={openShortcutsHelp}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--sidebar-text-dim)] hover:text-[var(--sidebar-text)]"
            title={ts("title")}
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span className="kbd">?</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden desktop:flex">{sidebar}</div>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 desktop:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 border-r border-[var(--border)]">{sidebar}</div>
        </div>
      ) : null}
    </>
  );
}

function AppHeaderBar({
  drawerOpen,
  setDrawerOpen,
  setSearchOpen,
}: {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
}) {
  const th = useTranslations("header");
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const { meta } = usePageMetaState();
  const { sectionHref } = useHotelSection();

  function switchLocale() {
    const next = locale === "de" ? "en" : "de";
    const slug = session?.user?.hotelSlug;
    const path = sectionHref || pathname || "/dashboard";
    if (slug) {
      window.location.href = hotelAppPath(slug, next, path);
      return;
    }
    router.push(`/${next}${path.startsWith("/") ? path : `/${path}`}`);
  }

  return (
    <header className="app-header-bar flex min-h-14 items-start gap-3 px-4 py-2.5">
      <button
        type="button"
        className="chrome-btn mt-0.5 desktop:hidden"
        onClick={() => setDrawerOpen(true)}
        aria-label="Menu"
      >
        {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        breadcrumbs={meta.breadcrumbs}
        actions={meta.actions}
      />
      <div className="mt-0.5 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="chrome-btn hidden tablet:inline-flex desktop:inline-flex"
        >
          <Search className="h-3.5 w-3.5" />
          {th("searchPlaceholder")}
          <kbd className="kbd">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={switchLocale}
          className="chrome-btn"
        >
          {locale.toUpperCase()}
        </button>
        <NotificationBell />
        <HotelSwitcher />
      </div>
    </header>
  );
}

function AppShellLayout({
  children,
  searchOpen,
  setSearchOpen,
}: {
  children: React.ReactNode;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const { sectionHref } = useHotelSection();
  const flat = useMemo(() => flattenNavItems(), []);
  const activeIndex = findNavIndex(sectionHref ?? pathname, flat);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { shortcutsHelpOpen, setShortcutsHelpOpen } = useAppKeyboard();

  return (
    <div className="app-canvas flex h-screen overflow-hidden">
      <AppSidebar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeaderBar
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          setSearchOpen={setSearchOpen}
        />
        <main
          className="flex-1 overflow-auto p-4 desktop:p-5"
          data-nav={activeIndex}
        >
          <HotelSectionOutlet>{children}</HotelSectionOutlet>
        </main>
        <PwaInstallBanner />
      </div>

      {searchOpen ? (
        <LazyGlobalSearch onClose={() => setSearchOpen(false)} />
      ) : null}
      {shortcutsHelpOpen ? (
        <LazyShortcutsHelp
          open={shortcutsHelpOpen}
          onClose={() => setShortcutsHelpOpen(false)}
        />
      ) : null}
    </div>
  );
}

function AppFrameInner({
  children,
  searchOpen,
  setSearchOpen,
}: {
  children: ReactNode;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}) {
  const { navigateSection } = useHotelSection();
  const onNavigate = useCallback(
    (href: string) => {
      navigateSection(href);
    },
    [navigateSection]
  );

  return (
    <KeyboardProvider
      onOpenSearch={() => setSearchOpen(true)}
      onNavigate={onNavigate}
    >
      <AppShellLayout searchOpen={searchOpen} setSearchOpen={setSearchOpen}>
        {children}
      </AppShellLayout>
    </KeyboardProvider>
  );
}

/** Persistent chrome for hotel app routes — mount once in the layout. */
export function AppFrame({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <PageMetaProvider>
      <HotelSectionProvider>
        <AppFrameInner searchOpen={searchOpen} setSearchOpen={setSearchOpen}>
          {children}
        </AppFrameInner>
      </HotelSectionProvider>
    </PageMetaProvider>
  );
}

/**
 * Page-level chrome registration. The sidebar/header stay mounted in AppFrame;
 * this only updates title / actions for the active route.
 */
export function AppShell({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  useSetPageMeta({ title, subtitle, breadcrumbs, actions });
  return <>{children}</>;
}
