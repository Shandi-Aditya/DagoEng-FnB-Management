import { describe, it, expect } from "vitest";
import type { PublicCommunityEvent } from "@/types/event";
import {
  filterPublicEvents,
  sortPublicEvents,
  eventPriceLabel,
  emptyCatalogMessage,
  formatEventSchedule,
} from "@/features/events-catalog/events-catalog-domain";

describe("events-catalog-domain", () => {
  const mockNow = new Date("2026-11-20T12:00:00Z").getTime();

  const mockEvents: PublicCommunityEvent[] = [
    {
      id: "evt-1",
      title: "Latte Art Workshop",
      description: "Belajar membuat pola latte art",
      category: "WORKSHOP",
      startDate: "2026-11-25T10:00:00Z",
      endDate: "2026-11-25T13:00:00Z",
      location: "Amphitheater Dago",
      isPaid: true,
      price: 50000,
      status: "APPROVED",
      organizerName: "Barista Guild",
      posterUrl: "https://example.com/poster1.jpg",
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "evt-2",
      title: "Komunitas Desain Meetup",
      description: "Kumpul desainer grafis dan UI/UX",
      category: "CREATIVE",
      startDate: "2026-11-22T14:00:00Z",
      endDate: "2026-11-22T16:00:00Z",
      location: "Creative Hall",
      isPaid: false,
      price: 0,
      status: "APPROVED",
      organizerName: "Singaraja Creative",
      posterUrl: "https://example.com/poster2.jpg",
      createdAt: "2026-11-02T00:00:00Z",
    },
    {
      id: "evt-3",
      title: "Web Development Bootcamp",
      description: "Sesi coding Next.js dan Tailwind",
      category: "TECH",
      startDate: "2026-11-10T09:00:00Z",
      endDate: "2026-11-10T12:00:00Z", // Past event
      location: "Workshop Room",
      isPaid: true,
      price: 75000,
      status: "APPROVED",
      organizerName: "Dago Tech Hub",
      posterUrl: "https://example.com/poster3.jpg",
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];

  it("splits and sorts upcoming events closest first, and past events newest first", () => {
    const upcoming = sortPublicEvents(mockEvents, "UPCOMING", mockNow);
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].id).toBe("evt-2"); // Nov 22 comes before Nov 25
    expect(upcoming[1].id).toBe("evt-1"); // Nov 25

    const past = sortPublicEvents(mockEvents, "PAST", mockNow);
    expect(past).toHaveLength(1);
    expect(past[0].id).toBe("evt-3"); // Nov 10
  });

  it("filters events by category accurately", () => {
    const workshopOnly = filterPublicEvents(mockEvents, "UPCOMING", "WORKSHOP", "ALL", "", mockNow);
    expect(workshopOnly).toHaveLength(1);
    expect(workshopOnly[0].id).toBe("evt-1");

    const creativeOnly = filterPublicEvents(mockEvents, "UPCOMING", "CREATIVE", "ALL", "", mockNow);
    expect(creativeOnly).toHaveLength(1);
    expect(creativeOnly[0].id).toBe("evt-2");
  });

  it("filters events by price (free vs paid)", () => {
    const freeOnly = filterPublicEvents(mockEvents, "UPCOMING", "ALL", "FREE", "", mockNow);
    expect(freeOnly).toHaveLength(1);
    expect(freeOnly[0].id).toBe("evt-2");

    const paidOnly = filterPublicEvents(mockEvents, "UPCOMING", "ALL", "PAID", "", mockNow);
    expect(paidOnly).toHaveLength(1);
    expect(paidOnly[0].id).toBe("evt-1");
  });

  it("filters events by case-insensitive keyword search", () => {
    const searchByTitle = filterPublicEvents(mockEvents, "UPCOMING", "ALL", "ALL", "latte", mockNow);
    expect(searchByTitle).toHaveLength(1);
    expect(searchByTitle[0].id).toBe("evt-1");

    const searchByLocation = filterPublicEvents(mockEvents, "UPCOMING", "ALL", "ALL", "creative hall", mockNow);
    expect(searchByLocation).toHaveLength(1);
    expect(searchByLocation[0].id).toBe("evt-2");

    const searchByOrganizer = filterPublicEvents(mockEvents, "UPCOMING", "ALL", "ALL", "barista", mockNow);
    expect(searchByOrganizer).toHaveLength(1);
    expect(searchByOrganizer[0].id).toBe("evt-1");
  });

  it("formats event price correctly as 'Gratis' or IDR format", () => {
    expect(eventPriceLabel(false, 0)).toBe("Gratis");
    expect(eventPriceLabel(true, 0)).toBe("Gratis");
    expect(eventPriceLabel(true, 50000)).toMatch(/Rp\s*50\.000/);
  });

  it("generates honest empty catalog messages for no events vs no search matches", () => {
    const emptyUpcoming = emptyCatalogMessage("UPCOMING", false);
    expect(emptyUpcoming.title).toBe("Belum ada event mendatang");

    const emptyFiltered = emptyCatalogMessage("UPCOMING", true);
    expect(emptyFiltered.title).toBe("Tidak ada event yang cocok");
  });

  it("formats event schedule properly with WITA timezone", () => {
    const schedule = formatEventSchedule("2026-11-25T10:00:00Z", "2026-11-25T13:00:00Z");
    expect(schedule).toContain("WITA");
  });
});
