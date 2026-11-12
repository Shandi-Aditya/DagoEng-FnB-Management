"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MenuPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[300px] text-center">
      <div className="space-y-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground font-medium">Mengarahkan ke Pusat Master Data Produk & Pengaturan...</p>
      </div>
    </div>
  );
}
