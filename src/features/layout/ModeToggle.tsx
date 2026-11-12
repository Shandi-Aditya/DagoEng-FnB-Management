"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

/** Light/dark toggle for the app shell, built on the shadcn Button. */
export function ModeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDark = isMounted && resolvedTheme === "dark";
  const label = isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap";

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={label} title={label} disabled={!isMounted}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
