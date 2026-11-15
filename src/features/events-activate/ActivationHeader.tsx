"use client";

import { BrandLink } from "@/features/landing/home/HomeNav";
import { ModeToggle } from "@/features/layout/ModeToggle";

export function ActivationHeader() {
  return (
    <header className="flex items-center justify-between w-full max-w-md mx-auto">
      <BrandLink />
      <ModeToggle />
    </header>
  );
}
