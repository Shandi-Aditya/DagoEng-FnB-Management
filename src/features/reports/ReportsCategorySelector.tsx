"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportCategoryMeta, ReportType } from "@/features/reports/reports-domain";

export interface ReportsCategorySelectorProps {
  categories: ReportCategoryMeta[];
  selectedType: ReportType;
  onSelectType: (type: ReportType) => void;
}

export function ReportsCategorySelector({
  categories,
  selectedType,
  onSelectType,
}: ReportsCategorySelectorProps) {
  return (
    <div className="max-w-full overflow-x-auto no-scrollbar">
      <Tabs value={selectedType} onValueChange={(value) => onSelectType(value as ReportType)}>
        <TabsList aria-label="Jenis laporan">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.label}
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {cat.rawCount}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
