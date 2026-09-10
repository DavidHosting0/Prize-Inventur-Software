"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { signOut, useSession } from "next-auth/react";
import { Menu, X, LogOut, ChevronDown, Keyboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@prize/ui";
import { NotificationBell } from "./notification-bell";
import { HotelSwitcher } from "./hotel-switcher";
import { KeyboardProvider, useAppKeyboard } from "./keyboard-provider";
import { PageHeader } from "./page-header";
import { BrandMark } from "./brand-mark";
import type { Crumb } from "./breadcrumbs";
import { flattenNavItems, findNavIndex } from "@/lib/nav";
import { GROUP_NAV_SECTIONS } from "@/lib/group-nav";
import dynamic from "next/dynamic";

const LazyShortcutsHelp = dynamic(
  () => import("./shortcuts-help").then((m) => m.ShortcutsHelp),
  { ssr: false }
);

function GroupShellChrome({
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
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const th = useTranslations("header");
  const ts = useTranslations("shortcuts");
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const {
    registerNav,
    openShortcutsHelp,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
  } = useAppKeyboard();

  const brandName = "Prize by Radisson";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of GROUP_NAV_SECTIONS) {
      init[s.id] = !s.collapsedByDefault;
      if (
        s.items.some(
          (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
        )
      ) {
        init[s.id] = true;
      }
    }
    return init;
  });

  const flat = useMemo(() => flattenNavItems(GROUP_NAV_SECTIONS), []);
  const activeIndex = findNavIndex(pathname, flat);

  useEffect(() => {
    for (const s of GROUP_NAV_SECTIONS) {
      if (
        s.items.some(
          (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
        )
      ) {
        setExpanded((prev) => ({ ...prev, [s.id]: true }));
      }
    }
  }, [pathname]);

  function switchLocale() {
    const next = locale === "de" ? "en" : "de";
    router.replace(pathname, { locale: next });
  }

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

  const sidebar = (
    <aside className="flex h-full w-[252px] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] shadow-[4px_0_24px_rgba(15,23,42,0.04)]">
      <BrandMark name={brandName} badge={th("groupBadge")} />

      <nav
        ref={registerNav}
        className="flex-1 overflow-y-auto px-2 py-3 outline-none"
        aria-label="Group"
        onKeyDown={onNavKeyDown}
      >
        {GROUP_NAV_SECTIONS.map((section) => {
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
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          data-nav-item
                          data-active={active ? "true" : "false"}
                          data-kbd-index={flat.indexOf(item)}
                          onClick={() => setDrawerOpen(false)}
                          className="nav-item"
                          tabIndex={0}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-80" />
                          <span className="flex-1 truncate">
                            {t(`items.${item.labelKey}`)}
                          </span>
                          {item.alt ? (
                            <span className="kbd opacity-50">{item.alt}</span>
                          ) : null}
                        </Link>
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
          {session?.user?.roleCode ?? "—"} · GROUP
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
    <div className="app-canvas flex h-screen overflow-hidden">
      <div className="hidden desktop:flex">{sidebar}</div>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 desktop:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
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
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />
          <div className="mt-0.5 flex shrink-0 items-center gap-2">
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
        <main className="flex-1 overflow-auto p-4 desktop:p-5" data-nav={activeIndex}>
          {children}
        </main>
      </div>

      {shortcutsHelpOpen ? (
        <LazyShortcutsHelp
          open={shortcutsHelpOpen}
          onClose={() => setShortcutsHelpOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function GroupShell({
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
  const router = useRouter();
  const onNavigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <KeyboardProvider onOpenSearch={() => {}} onNavigate={onNavigate}>
      <GroupShellChrome
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={actions}
      >
        {children}
      </GroupShellChrome>
    </KeyboardProvider>
  );
}
