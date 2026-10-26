import fs from "fs";
import path from "path";
import { beforeAll, afterAll } from "vitest";
import { INITIAL_ORGANIZERS } from "@/types/organizer";
import { INITIAL_COMMUNITY_EVENTS, INITIAL_BOOKINGS } from "@/lib/events";

const TEST_STORAGE_DIR = path.join(process.cwd(), "data", ".test-storage");
process.env.DATA_DIR_OVERRIDE = TEST_STORAGE_DIR;

export function initTestStorageFixtures(): void {
  if (!fs.existsSync(TEST_STORAGE_DIR)) {
    fs.mkdirSync(TEST_STORAGE_DIR, { recursive: true });
  }

  const defaultFiles: Record<string, string> = {
    "events.json": JSON.stringify(INITIAL_COMMUNITY_EVENTS, null, 2),
    "event_bookings.json": JSON.stringify(INITIAL_BOOKINGS, null, 2),
    "event_settings.json": JSON.stringify(
      { defaultPlatformFeePercent: 20, defaultOrganizerSharePercent: 80, minPlatformFeePercent: 0 },
      null,
      2
    ),
    "organizers.json": JSON.stringify(INITIAL_ORGANIZERS, null, 2),
    "organizer_invites.json": "[]",
    "organizer_credentials.json": "[]",
    "unified_users.json": "[]",
  };

  for (const [filename, content] of Object.entries(defaultFiles)) {
    const filePath = path.join(TEST_STORAGE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }
}

// Ensure fixtures exist as soon as test runner imports this setup
initTestStorageFixtures();

beforeAll(() => {
  initTestStorageFixtures();
});

afterAll(() => {
  try {
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
  } catch {
    // Graceful cleanup ignore if Windows process holds file handle temporarily
  }
});
