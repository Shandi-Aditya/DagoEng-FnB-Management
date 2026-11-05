/**
 * Utility to generate and download e-tickets as crisp PNG images.
 * Works seamlessly across desktop and mobile devices without external canvas libraries.
 */

export interface TicketDownloadData {
  ticketCode: string;
  eventTitle: string;
  guestName: string;
  guestEmail: string;
  ticketCount: number;
  totalPrice: number;
  paymentMethod?: string;
  paymentStatus: string;
  eventLocation?: string;
  eventDate?: string;
  subTicketIndex?: number;
  subTicketCode?: string;
  subGuestLabel?: string;
  subCheckedIn?: boolean;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function downloadTicketAsImage(
  ticket: TicketDownloadData,
  svgElement?: SVGElement | null
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const width = 720;
    const height = 1040;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      window.print();
      return true;
    }

    const displayCode = ticket.subTicketCode || ticket.ticketCode || "DAGO-EVT";
    const isSubTicket = Boolean(ticket.subTicketCode && ticket.subTicketIndex);

    // 1. Background (Card Container)
    ctx.fillStyle = "#0B1512";
    ctx.fillRect(0, 0, width, height);

    // Subtle outer card border
    ctx.strokeStyle = "#1B4332";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // 2. Header Banner
    const headerGrad = ctx.createLinearGradient(0, 10, width, 140);
    headerGrad.addColorStop(0, "#1B4332");
    headerGrad.addColorStop(1, "#2D6A4F");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(12, 12, width - 24, 120);

    // Header Text
    ctx.fillStyle = "#A7F3D0";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillText("E-TIKET KOMUNITAS RESMI", 36, 50);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("DAGO Creative Hub", 36, 82);

    ctx.fillStyle = "#D1FAE5";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isSubTicket
        ? `Tiket #${ticket.subTicketIndex} dari ${ticket.ticketCount} • Akses Masuk Venue`
        : "Platform & Ekosistem Komunitas Singaraja",
      36,
      105
    );

    // Status Pill
    const isPaid = ticket.paymentStatus === "PAID";
    let pillText = isPaid ? "TERKONFIRMASI (LUNAS)" : "MENUNGGU VERIFIKASI";
    let pillBg = isPaid ? "#10B981" : "#F59E0B";

    if (ticket.subCheckedIn) {
      pillText = "SUDAH HADIR (CHECK-IN)";
      pillBg = "#3B82F6";
    }

    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    const pillWidth = ctx.measureText(pillText).width + 24;
    const pillX = width - pillWidth - 36;
    const pillY = 52;

    ctx.fillStyle = pillBg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pillX, pillY, pillWidth, 30, 15) : ctx.rect(pillX, pillY, pillWidth, 30);
    ctx.fill();

    ctx.fillStyle = "#062C1E";
    ctx.fillText(pillText, pillX + 12, pillY + 19);

    // 3. Ticket Code Highlight
    let currentY = 175;
    ctx.fillStyle = "#94A3B8";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isSubTicket
        ? `KODE TIKET RESMI (#${ticket.subTicketIndex} DARI ${ticket.ticketCount}):`
        : "KODE BOOKING REGISTRASI:",
      36,
      currentY
    );

    currentY += 32;
    ctx.fillStyle = "#52B788";
    ctx.font = "900 32px 'Courier New', Courier, monospace";
    ctx.fillText(displayCode, 36, currentY);

    // Dashed divider line
    currentY += 25;
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(36, currentY);
    ctx.lineTo(width - 36, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Event Information
    currentY += 30;
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("NAMA ACARA", 36, currentY);

    currentY += 24;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    const titleLines = wrapText(ctx, ticket.eventTitle || "Event Dago", width - 72);
    titleLines.slice(0, 2).forEach((line) => {
      ctx.fillText(line, 36, currentY);
      currentY += 26;
    });

    currentY += 8;
    // Two-column details: Peserta & Jumlah/Biaya
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.fillText(isSubTicket ? "PEMEGANG TIKET" : "NAMA PESERTA", 36, currentY);
    ctx.fillText("STATUS PEMESANAN", 380, currentY);

    currentY += 20;
    ctx.fillStyle = "#F1F5F9";
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    const attendeeLabel = ticket.subGuestLabel
      ? `${ticket.subGuestLabel} (${ticket.guestName})`
      : ticket.guestName || "Tamu Undangan";
    ctx.fillText(attendeeLabel, 36, currentY);

    const priceText =
      ticket.totalPrice && ticket.totalPrice > 0
        ? `Rp ${ticket.totalPrice.toLocaleString("id-ID")}`
        : "GRATIS";
    ctx.fillStyle = "#52B788";
    ctx.fillText(
      isSubTicket ? `Tiket #${ticket.subTicketIndex} • LUNAS` : `${ticket.ticketCount || 1} Tiket • ${priceText}`,
      380,
      currentY
    );

    currentY += 18;
    ctx.fillStyle = "#94A3B8";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(ticket.guestEmail || "-", 36, currentY);
    ctx.fillText(ticket.paymentMethod || "Transfer Manual", 380, currentY);

    // Venue & Schedule
    currentY += 25;
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("LOKASI VENUE & FASILITAS", 36, currentY);

    currentY += 20;
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    const locationLines = wrapText(ctx, ticket.eventLocation || "Dago Creative Hub, Singaraja", width - 72);
    locationLines.slice(0, 2).forEach((line) => {
      ctx.fillText(line, 36, currentY);
      currentY += 20;
    });

    // 5. QR Code Card Section
    currentY += 20;
    const qrBoxWidth = width - 72;
    const qrBoxHeight = 310;
    const qrBoxX = 36;
    const qrBoxY = currentY;

    ctx.fillStyle = "#062C1E";
    ctx.strokeStyle = "#1B4332";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight, 20)
      : ctx.rect(qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight);
    ctx.fill();
    ctx.stroke();

    // Render QR Code if SVG element is present
    const qrSvg =
      svgElement ||
      (document.querySelector("#ticket-qr-container svg") as SVGElement | null) ||
      (document.querySelector("svg[level]") as SVGElement | null);

    if (isPaid && qrSvg) {
      await new Promise<void>((resolve) => {
        try {
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(qrSvg);
          const svgDataUrl =
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
          const img = new Image();
          img.onload = () => {
            // White rounded backing for QR
            const qrBgSize = 190;
            const qrBgX = qrBoxX + (qrBoxWidth - qrBgSize) / 2;
            const qrBgY = qrBoxY + 20;

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.roundRect
              ? ctx.roundRect(qrBgX, qrBgY, qrBgSize, qrBgSize, 14)
              : ctx.rect(qrBgX, qrBgY, qrBgSize, qrBgSize);
            ctx.fill();

            // Draw QR code image
            ctx.drawImage(img, qrBgX + 10, qrBgY + 10, qrBgSize - 20, qrBgSize - 20);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = svgDataUrl;
        } catch {
          resolve();
        }
      });
    } else {
      // Fallback box
      ctx.fillStyle = "#1E293B";
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(qrBoxX + (qrBoxWidth - 190) / 2, qrBoxY + 20, 190, 190, 14)
        : ctx.rect(qrBoxX + (qrBoxWidth - 190) / 2, qrBoxY + 20, 190, 190);
      ctx.fill();

      ctx.fillStyle = isPaid ? "#10B981" : "#F59E0B";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isPaid ? "QR CHECK-IN" : "MENUNGGU", qrBoxX + qrBoxWidth / 2, qrBoxY + 105);
      ctx.fillText(displayCode, qrBoxX + qrBoxWidth / 2, qrBoxY + 125);
      ctx.textAlign = "left";
    }

    // Text under QR Box
    ctx.textAlign = "center";
    ctx.fillStyle = "#D1FAE5";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      ticket.subCheckedIn ? "Tiket Sudah Digunakan (Check-in)" : "QR Check-in Aktif & Valid",
      qrBoxX + qrBoxWidth / 2,
      qrBoxY + 235
    );

    ctx.fillStyle = "#94A3B8";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isSubTicket
        ? `Tunjukkan QR Tiket #${ticket.subTicketIndex} ini saat masuk ke pintu registrasi.`
        : "Tunjukkan e-tiket ini kepada panitia saat kedatangan di lokasi acara.",
      qrBoxX + qrBoxWidth / 2,
      qrBoxY + 258
    );

    ctx.fillStyle = "#64748B";
    ctx.font = "10px 'Courier New', Courier, monospace";
    ctx.fillText(
      `VERIFIKASI SISTEM: ${displayCode} • DAGO CREATIVE HUB BALI`,
      qrBoxX + qrBoxWidth / 2,
      qrBoxY + 282
    );
    ctx.textAlign = "left";

    // 6. Footer Note
    ctx.fillStyle = "#475569";
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Simpan tiket ini di galeri foto smartphone Anda untuk akses instan tanpa kuota internet.",
      width / 2,
      height - 30
    );

    // 7. Trigger Download
    const dataUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    const safeFilename = `Tiket-${displayCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    downloadLink.download = safeFilename;
    downloadLink.href = dataUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  } catch (err) {
    console.error("Gagal mendownload tiket sebagai gambar, beralih ke print dialog:", err);
    window.print();
    return true;
  }
}
