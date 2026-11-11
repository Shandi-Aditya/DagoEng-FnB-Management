"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Grid } from "lucide-react";

import { notify } from "@/components/app/notify";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOutlet } from "@/contexts/OutletContext";
import {
  type ScheduledReservation,
  type TableItem,
  useTables,
} from "@/contexts/TableContext";

import { AddAreaModal } from "@/features/tables/AddAreaModal";
import { AddReservationModal } from "@/features/tables/AddReservationModal";
import { AddTableModal } from "@/features/tables/AddTableModal";
import { FloorPlanView } from "@/features/tables/FloorPlanView";
import { ReservationsView } from "@/features/tables/ReservationsView";
import { TableDetailModal } from "@/features/tables/TableDetailModal";
import {
  calculateTableSummary,
  countReservationsByStatus,
  filterReservations,
  tableStatusLabel,
} from "@/features/tables/tables-domain";
import { TablesToolbar } from "@/features/tables/TablesToolbar";

export default function TablesPage() {
  const router = useRouter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const {
    filteredAreas,
    filteredReservations,
    updateTableStatus,
    releaseTableToAvailable,
    seatReservation,
    cancelReservation,
    addReservation,
    addArea,
    addTable,
  } = useTables();

  const [activeTab, setActiveTab] = useState<"FLOOR_PLAN" | "RESERVATIONS">("FLOOR_PLAN");
  const [resFilter, setResFilter] = useState<string>("ALL");
  const [searchResQuery, setSearchResQuery] = useState("");

  // Modals state
  const [selectedTableDetails, setSelectedTableDetails] = useState<{
    areaId: string;
    table: TableItem;
  } | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [isAddReservationModalOpen, setIsAddReservationModalOpen] = useState(false);

  const outletName = activeOutlet?.name || "Singaraja";

  const summary = useMemo(() => {
    return calculateTableSummary(filteredAreas);
  }, [filteredAreas]);

  const reservationCounts = useMemo(() => {
    return countReservationsByStatus(filteredReservations);
  }, [filteredReservations]);

  const searchedReservations = useMemo(() => {
    return filterReservations(filteredReservations, resFilter, searchResQuery);
  }, [filteredReservations, resFilter, searchResQuery]);

  const handleTableClick = (areaId: string, table: TableItem) => {
    setSelectedTableDetails({ areaId, table });
  };

  const handleUpdateTableStatus = (newStatus: TableItem["status"]) => {
    if (!selectedTableDetails) return;
    const { table } = selectedTableDetails;
    if (newStatus === "AVAILABLE") {
      releaseTableToAvailable(table.id);
    } else {
      updateTableStatus(table.id, newStatus);
    }
    setSelectedTableDetails((prev) =>
      prev ? { ...prev, table: { ...prev.table, status: newStatus } } : null
    );
    notify.success(`Meja ${table.number || table.id}: ${tableStatusLabel(newStatus).toLowerCase()}`);
  };

  const handleAddTable = (areaId: string, name: string, cap: number) => {
    addTable(areaId, name, cap);
    notify.success(`Meja ${name} ditambahkan`);
  };

  const handleAddArea = (name: string) => {
    addArea(name, activeOutletId !== "ALL" ? activeOutletId : undefined);
    notify.success(`Area ${name} ditambahkan`);
  };

  const handleAddReservation = (data: {
    customerName: string;
    phone: string;
    tableId: string;
    areaName: string;
    dateTime: string;
    pax: number;
    downPayment: number;
    notes?: string;
  }) => {
    addReservation({
      customerName: data.customerName,
      phone: data.phone,
      tableId: data.tableId,
      areaName: data.areaName,
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName,
      dateTime: data.dateTime,
      pax: data.pax,
      downPayment: data.downPayment,
      notes: data.notes,
      status: "CONFIRMED",
    });

    notify.success(
      "Reservasi dibuat",
      `${data.customerName}, meja ${data.tableId}`
    );
  };

  const handleSeatReservation = (res: ScheduledReservation) => {
    seatReservation(res.id);
    notify.success("Tamu didudukkan", `Meja ${res.tableId} sekarang terisi.`);
  };

  const handleCancelReservation = (resId: string, tableId: string) => {
    cancelReservation(resId);
    notify.info("Reservasi dibatalkan", `Meja ${tableId} kembali tersedia.`);
  };

  return (
    <div className="space-y-6">
      <TablesToolbar
        outletName={outletName}
        totalTables={summary.totalTables}
        availableCount={summary.availableCount}
        occupiedCount={summary.occupiedCount}
        reservedCount={summary.reservedCount}
        onAddArea={() => setIsAddAreaModalOpen(true)}
        onAddTable={() => setIsAddTableModalOpen(true)}
        onAddReservation={() => setIsAddReservationModalOpen(true)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "FLOOR_PLAN" | "RESERVATIONS")}
      >
        <TabsList aria-label="Pilihan tampilan meja dan reservasi">
          <TabsTrigger value="FLOOR_PLAN">
            <Grid />
            <span>Denah meja</span>
          </TabsTrigger>
          <TabsTrigger value="RESERVATIONS">
            <CalendarCheck />
            <span>Buku reservasi</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {reservationCounts.CONFIRMED}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="FLOOR_PLAN" className="m-0 focus-visible:outline-hidden">
            <FloorPlanView
              areas={filteredAreas}
              outletName={outletName}
              onTableClick={handleTableClick}
            />
          </TabsContent>

          <TabsContent value="RESERVATIONS" className="m-0 focus-visible:outline-hidden">
            <ReservationsView
              reservations={searchedReservations}
              counts={reservationCounts}
              statusFilter={resFilter}
              searchQuery={searchResQuery}
              onFilterChange={setResFilter}
              onSearchChange={setSearchResQuery}
              onSeat={handleSeatReservation}
              onCancel={handleCancelReservation}
              onOpenPOS={() => router.push("/pos")}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Table Details & Actions Sheet */}
      <TableDetailModal
        tableDetails={selectedTableDetails}
        isOpen={Boolean(selectedTableDetails)}
        onClose={() => setSelectedTableDetails(null)}
        onUpdateStatus={handleUpdateTableStatus}
        onOpenPOS={() => router.push("/pos")}
      />

      {/* Add Table Modal */}
      <AddTableModal
        isOpen={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        areas={filteredAreas}
        onAddTable={handleAddTable}
      />

      {/* Add Area Modal */}
      <AddAreaModal
        isOpen={isAddAreaModalOpen}
        onClose={() => setIsAddAreaModalOpen(false)}
        outletName={outletName}
        onAddArea={handleAddArea}
      />

      {/* Add Reservation Modal */}
      <AddReservationModal
        isOpen={isAddReservationModalOpen}
        onClose={() => setIsAddReservationModalOpen(false)}
        areas={filteredAreas}
        onAddReservation={handleAddReservation}
      />
    </div>
  );
}
