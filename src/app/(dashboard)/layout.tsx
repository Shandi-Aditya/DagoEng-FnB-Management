"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/features/layout/Sidebar";
import { Header } from "@/features/layout/Header";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Restore client preference for sidebar collapse state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dago_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch (_) {}
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dago_sidebar_collapsed", String(next));
      } catch (_) {}
      return next;
    });
  };

  // Operational screens that benefit from maximum horizontal space
  const isFullWidthPage = pathname === "/pos" || pathname === "/kitchen" || pathname === "/tables";

  useEffect(() => {
    if (!isLoading && user === null) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (!user && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="text-center space-y-3 animate-in fade-in">
          <div className="w-10 h-10 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Sesi telah berakhir. Mengarahkan ke halaman login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200">
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (visible on large screens >= 1024px) */}
        <aside
          className={`hidden lg:flex flex-shrink-0 transition-all duration-300 ease-in-out ${
            isSidebarCollapsed
              ? "w-0 -ml-64 opacity-0 pointer-events-none overflow-hidden"
              : "w-64 opacity-100"
          }`}
        >
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={handleToggleSidebar}
          />
        </aside>

        {/* Mobile & Tablet Slide-over Drawer (< 1024px) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-150">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center touch-manipulation"
                  aria-label="Tutup Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Sidebar
                isCollapsed={false}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Header
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
          />
          <main
            className={`flex-1 w-full animate-in fade-in duration-200 ${
              isFullWidthPage
                ? "p-2.5 sm:p-4 lg:p-5"
                : "p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
