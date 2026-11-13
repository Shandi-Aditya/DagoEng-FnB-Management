"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { HomeNav } from "@/features/landing/home/HomeNav";
import type { AuthenticatedUser } from "@/types/auth";
import type { PublicCommunityEvent } from "@/types/event";

import { EventsCatalogToolbar } from "@/features/events-catalog/EventsCatalogToolbar";
import { EventsCatalogGrid } from "@/features/events-catalog/EventsCatalogGrid";
import {
  emptyCatalogMessage,
  filterPublicEvents,
  sortPublicEvents,
  type EventPriceFilter,
  type EventTimeTab,
} from "@/features/events-catalog/events-catalog-domain";

function MyTicketsNavAction({ user }: { user: AuthenticatedUser | null }) {
  if (user) {
    return (
      <Button
        variant="ghost"
        render={<Link href="/customer?tab=PROFILE" />}
        nativeButton={false}
      >
        <Ticket className="size-4" />
        <span className="hidden sm:inline">Tiket saya</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost">
            <Ticket className="size-4" />
            <span className="hidden sm:inline">Tiket saya</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          render={
            <Link
              href={`/login?returnTo=${encodeURIComponent("/customer?tab=PROFILE")}&from=events&mode=customer`}
            />
          }
        >
          <LogIn />
          <span>Masuk dengan akun</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/events/tickets/recovery" />}>
          <Search />
          <span>Cari e-tiket tamu</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function EventsListingPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PublicCommunityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Tabs
  const [viewTab, setViewTab] = useState<EventTimeTab>("UPCOMING");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [priceFilter, setPriceFilter] = useState<EventPriceFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/events");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEvents(json.data);
      }
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, priceFilter, viewTab, pageSize]);

  const nowMs = useMemo(() => Date.now(), []);

  // Counts for upcoming vs past
  const upcomingCount = useMemo(() => {
    return sortPublicEvents(events, "UPCOMING", nowMs).length;
  }, [events, nowMs]);

  const pastCount = useMemo(() => {
    return sortPublicEvents(events, "PAST", nowMs).length;
  }, [events, nowMs]);

  // Filtered pool
  const filteredEvents = useMemo(() => {
    return filterPublicEvents(
      events,
      viewTab,
      selectedCategory,
      priceFilter,
      searchQuery,
      nowMs
    );
  }, [events, viewTab, selectedCategory, priceFilter, searchQuery, nowMs]);

  // Paginated events
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const hasFilterActive = Boolean(
    searchQuery.trim() || selectedCategory !== "ALL" || priceFilter !== "ALL"
  );

  const handleResetFilter = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setPriceFilter("ALL");
    setCurrentPage(1);
  };

  const emptyMsg = emptyCatalogMessage(viewTab, hasFilterActive);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground justify-between">
      {/* 1. Header (consistent HomeNav layout: ModeToggle on the left, ghost tickets action, and blue Portal Mitra button) */}
      <HomeNav
        showLinks={false}
        action={<MyTicketsNavAction user={user} />}
        cta={{ href: "/events/portal", label: "Portal mitra" }}
      />

      {/* 2. Hero & Main Directory */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Title */}
        <div className="flex flex-col gap-2 max-w-2xl">
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Event komunitas
          </h1>
          <p className="text-base text-muted-foreground text-pretty">
            Temukan lokakarya, sesi berbagi, dan kegiatan kreatif yang diselenggarakan oleh berbagai komunitas di Dago Creative Hub.
          </p>
        </div>

        {/* Toolbar & Filters */}
        <EventsCatalogToolbar
          viewTab={viewTab}
          onViewTabChange={setViewTab}
          upcomingCount={upcomingCount}
          pastCount={pastCount}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          priceFilter={priceFilter}
          onPriceFilterChange={setPriceFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Grid & Pagination */}
        <EventsCatalogGrid
          events={paginatedEvents}
          isLoading={isLoading}
          viewTab={viewTab}
          emptyMessage={emptyMsg}
          hasFilterActive={hasFilterActive}
          onResetFilter={handleResetFilter}
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredEvents.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </main>

      {/* 3. Footer */}
      <footer className="border-t py-6 text-xs text-muted-foreground bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Dago Creative Hub — Ekosistem Terpadu F&B, Co-Working & Komunitas.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Beranda
            </Link>
            <Link href="/events/tickets/recovery" className="hover:text-foreground transition-colors">
              Cari tiket
            </Link>
            <Link href="/events/portal" className="hover:text-foreground transition-colors">
              Portal mitra
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
