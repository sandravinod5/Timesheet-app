"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock3,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/timesheet", label: "Timesheet", icon: Clock3 },
  { href: "/visits", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 }
];

type AppShellProps = React.PropsWithChildren<{
  user?: {
    email?: string;
    displayName?: string;
  } | null;
}>;

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.displayName?.trim() || "Signed In User";

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    setProfileOpen(false);
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
    });
  };

  const renderNavButtons = (orientation: "mobile" | "desktop") =>
    navItems.map((item) => {
      const Icon = item.icon;
      const active = pathname === item.href;

      return (
        <button
          key={`${orientation}-${item.href}`}
          className={active ? "nav-button active" : "nav-button"}
          onClick={() => router.push(item.href)}
          aria-current={active ? "page" : undefined}
        >
          <Icon size={20} />
          <span className="nav-label">{item.label}</span>
        </button>
      );
    });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-card">
          <div className="brand">
            <button className="brand-logo-wrap brand-logo-button" onClick={() => router.push("/")} aria-label="Go to overview" type="button">
              <Image src="/marks-leaps.png" alt="Marks and Leaps logo" width={150} height={66} className="brand-logo" priority />
            </button>
            <div className="header-actions">
              <button className="ghost-button" onClick={toggleTheme} aria-label="Toggle theme">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="user-profile-menu" ref={profileMenuRef}>
                <button
                  className="user-profile"
                  aria-label="Logged in user"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((current) => !current)}
                  type="button"
                >
                  <div className="user-avatar" aria-hidden="true">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </button>
                {profileOpen ? (
                  <div className="user-profile-dropdown">
                    <div className="user-profile-dropdown-header">
                      <div className="user-avatar user-avatar--large" aria-hidden="true">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-profile-dropdown-copy">
                        <p className="user-profile-name">{displayName}</p>
                      </div>
                    </div>
                    <button className="user-logout" onClick={handleLogout} aria-label="Logout" type="button">
                      <LogOut size={16} />
                      <span>Logout</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className="desktop-sidebar" aria-label="Primary navigation">
          <nav className="desktop-nav-rail" aria-label="Primary desktop">
            <div className="desktop-nav-grid">{renderNavButtons("desktop")}</div>
          </nav>
        </aside>

        <main className="app-main">
          <div className="app-main-inner">{children}</div>
        </main>
      </div>

      <div className="nav-wrap">
        <nav className="nav-rail" aria-label="Primary">
          <div className="nav-grid">{renderNavButtons("mobile")}</div>
        </nav>
      </div>
    </div>
  );
}
