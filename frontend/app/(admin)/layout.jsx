"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const links = [
  ["SEO Management", "/seo", "⌕"],
  ["Blog Management", "/blogs", "▤"],
  ["Project Management", "/projects", "▣"],
  ["Leads", "/leads", "✉"],
  ["Settings", "/settings", "⚙"],
];

export default function AdminLayout({ children }) {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem("gstar_admin_token");

    if (!token) {
      // Next.js applies the configured /admin basePath automatically.
      router.replace("/login");
    }
  }, [router]);

  function logout() {
    window.localStorage.removeItem("gstar_admin_token");

    // Use the route without /admin because next.config.mjs has basePath: "/admin".
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-brand-icon">G</div>
          <div>
            <div className="admin-brand-name">GSTAR INFOTECH</div>
            <div className="admin-brand-caption">Admin Panel</div>
          </div>
        </div>

        <div className="admin-nav-label">WEBSITE MANAGEMENT</div>

        <nav className="admin-nav">
          {links.map(([label, href, icon]) => (
            <Link
              key={href}
              href={href}
              className={`admin-nav-link ${path === `/admin${href}` || path === href ? "active" : ""
                }`}
            >
              <span className="admin-nav-icon">{icon}</span>
              <span>{label}</span>
              <span className="admin-nav-arrow">›</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-user-card">
            <div className="admin-user-avatar">A</div>
            <div className="admin-user-info">
              <strong>Administrator</strong>
              <span>GStar Website</span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="admin-logout"
          >
            <span>↪</span> Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-topbar-label">GSTAR INFOTECH</span>
            <span className="admin-topbar-divider">/</span>
            <span className="admin-topbar-current">
              {links.find(
                (item) =>
                  path === `/admin${item[1]}` || path === item[1]
              )?.[0] || "Admin"}
            </span>
          </div>

          <span className="admin-status">
            <i /> System ready
          </span>
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
