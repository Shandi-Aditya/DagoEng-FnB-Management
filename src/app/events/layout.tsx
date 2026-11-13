import type { ReactNode } from "react";

import { UnitScope } from "@/components/app/unit-scope";

// Every page under /events belongs to the event unit, so filters and mode
// switches pick up its green accent. `contents` keeps the wrapper out of layout.
export default function EventsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-unit="event" className="contents">
      <UnitScope unit="event" />
      {children}
    </div>
  );
}
