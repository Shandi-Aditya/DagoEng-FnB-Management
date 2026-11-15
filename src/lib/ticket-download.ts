/**
 * Utility to generate and download e-tickets as crisp, high-resolution PNG images.
 * Designed with a modern, elegant boarding-pass aesthetic (2x Retina scale).
 */

import { formatTicketEventDate, formatPaymentMethodLabel } from "@/features/events-tickets/ticket-pass-domain";

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

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? truncated + "…" : text;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
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
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
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
    // 2x Retina resolution for razor-sharp rendering
    const scale = 2;
    const baseWidth = 640;
    const baseHeight = 980;

    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      window.print();
      return true;
    }

    ctx.scale(scale, scale);

    const displayCode = ticket.subTicketCode || ticket.ticketCode || "DAGO-EVT";
    const isSubTicket = Boolean(ticket.subTicketCode && ticket.subTicketIndex);
    const isPaid = ticket.paymentStatus === "PAID";
    const isCancelled = ticket.paymentStatus === "CANCELLED";

    // 1. Overall Outer Canvas Background (Soft clean canvas)
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // 2. Ticket Pass Card Container (Rounded Card with drop shadow effect)
    const cardX = 24;
    const cardY = 24;
    const cardWidth = baseWidth - 48;
    const cardHeight = baseHeight - 48;
    const cardRadius = 24;

    // Card background
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius)
      : ctx.rect(cardX, cardY, cardWidth, cardHeight);
    ctx.fill();

    // Card border
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Top Header Banner (Brand Accent: Official Unit Event Green #00C853)
    const headerHeight = 110;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(cardX, cardY, cardWidth, headerHeight, [cardRadius, cardRadius, 0, 0])
      : ctx.rect(cardX, cardY, cardWidth, headerHeight);
    ctx.clip();

    // Header gradient matching business unit event (--unit-event #00c853)
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + headerHeight);
    headerGrad.addColorStop(0, "#00A844");
    headerGrad.addColorStop(1, "#00C853");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(cardX, cardY, cardWidth, headerHeight);

    // Brand Label
    ctx.fillStyle = "#E8F5E9";
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("E-TIKET RESMI • DAGO CREATIVE HUB", cardX + 24, cardY + 36);

    // Brand Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("Dago Creative Hub", cardX + 24, cardY + 64);

    // Sub-title
    ctx.fillStyle = "#E8F5E9";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isSubTicket
        ? `Tiket Masuk #${ticket.subTicketIndex} dari ${ticket.ticketCount} Peserta`
        : "Tiket Registrasi Acara Komunitas",
      cardX + 24,
      cardY + 86
    );

    // Status Badge on Top Right
    let statusText = "LUNAS";
    let statusBg = "#00C853";
    let statusFg = "#FFFFFF";

    if (ticket.subCheckedIn) {
      statusText = "SUDAH HADIR";
      statusBg = "#0284C7";
      statusFg = "#FFFFFF";
    } else if (isCancelled) {
      statusText = "DIBATALKAN";
      statusBg = "#EF4444";
      statusFg = "#FFFFFF";
    } else if (!isPaid) {
      statusText = "MENUNGGU PEMBAYARAN";
      statusBg = "#F59E0B";
      statusFg = "#FFFFFF";
    }

    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    const badgePadX = 14;
    const badgeWidth = ctx.measureText(statusText).width + badgePadX * 2;
    const badgeHeight = 28;
    const badgeX = cardX + cardWidth - badgeWidth - 24;
    const badgeY = cardY + 41;

    ctx.fillStyle = statusBg;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 14)
      : ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.fill();

    ctx.fillStyle = statusFg;
    ctx.fillText(statusText, badgeX + badgePadX, badgeY + 18);
    ctx.restore();

    // 4. Ticket Booking Code Bar
    let currentY = cardY + headerHeight + 28;
    ctx.fillStyle = "#64748B";
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isSubTicket
        ? `KODE TIKET (#${ticket.subTicketIndex} DARI ${ticket.ticketCount})`
        : "KODE TIKET REGISTRASI",
      cardX + 24,
      currentY
    );

    currentY += 26;
    ctx.fillStyle = "#00A844";
    ctx.font = "bold 26px 'Courier New', Courier, monospace";
    ctx.fillText(displayCode, cardX + 24, currentY);

    // 5. Event Title & Schedule Section
    currentY += 24;
    ctx.fillStyle = "#64748B";
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("NAMA ACARA", cardX + 24, currentY);

    currentY += 22;
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    const titleLines = wrapText(ctx, ticket.eventTitle || "Acara Komunitas", cardWidth - 48, 2);
    titleLines.forEach((line) => {
      ctx.fillText(line, cardX + 24, currentY);
      currentY += 24;
    });

    // Date & Venue Details (Compact Grid)
    currentY += 4;
    if (ticket.eventDate) {
      ctx.fillStyle = "#334155";
      ctx.font = "500 12px system-ui, -apple-system, sans-serif";
      const formattedDate = formatTicketEventDate(ticket.eventDate);
      ctx.fillText(`Waktu: ${formattedDate}`, cardX + 24, currentY);
      currentY += 20;
    }

    if (ticket.eventLocation) {
      ctx.fillStyle = "#64748B";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      const locationText = truncateText(ctx, `Lokasi: ${ticket.eventLocation}`, cardWidth - 48);
      ctx.fillText(locationText, cardX + 24, currentY);
      currentY += 24;
    }

    // 6. Two-Column Guest & Order Info (Strict Boundary Isolation - NO OVERLAP)
    currentY += 6;
    const col1X = cardX + 24;
    const col2X = cardX + Math.floor(cardWidth * 0.58);
    const col1Width = col2X - col1X - 16;
    const col2Width = cardX + cardWidth - col2X - 24;

    ctx.fillStyle = "#64748B";
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText(isSubTicket ? "PEMEGANG TIKET" : "NAMA PEMESAN", col1X, currentY);
    ctx.fillText("STATUS & TOTAL", col2X, currentY);

    currentY += 18;
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    const attendeeRaw = ticket.subGuestLabel || ticket.guestName || "Tamu Undangan";
    const attendeeText = truncateText(ctx, attendeeRaw, col1Width);
    ctx.fillText(attendeeText, col1X, currentY);

    const priceText =
      ticket.totalPrice && ticket.totalPrice > 0
        ? `Rp ${ticket.totalPrice.toLocaleString("id-ID")}`
        : "Gratis";
    const totalSummary = isSubTicket
      ? `Tiket #${ticket.subTicketIndex}`
      : `${ticket.ticketCount || 1} Tiket • ${priceText}`;
    ctx.fillText(truncateText(ctx, totalSummary, col2Width), col2X, currentY);

    currentY += 18;
    ctx.fillStyle = "#64748B";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(truncateText(ctx, ticket.guestEmail || "-", col1Width), col1X, currentY);

    const methodLabel = formatPaymentMethodLabel(ticket.paymentMethod || "FREE");
    ctx.fillText(truncateText(ctx, methodLabel, col2Width), col2X, currentY);

    // 7. Perforated Ticket Stub Divider with Left/Right Circular Notches
    currentY += 28;
    const notchRadius = 14;
    const notchY = currentY;

    // Draw dashed divider line
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cardX + notchRadius + 6, notchY);
    ctx.lineTo(cardX + cardWidth - notchRadius - 6, notchY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cutout Left Notch
    ctx.fillStyle = "#F1F5F9";
    ctx.beginPath();
    ctx.arc(cardX, notchY, notchRadius, -Math.PI / 2, Math.PI / 2, false);
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cutout Right Notch
    ctx.beginPath();
    ctx.arc(cardX + cardWidth, notchY, notchRadius, Math.PI / 2, -Math.PI / 2, false);
    ctx.fill();
    ctx.stroke();

    // 8. QR Code Box Section (Clean High-Contrast Container)
    currentY += 24;
    const qrContainerWidth = cardWidth - 48;
    const qrContainerHeight = 270;
    const qrContainerX = cardX + 24;
    const qrContainerY = currentY;

    // QR Box background
    ctx.fillStyle = "#F8FAFC";
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(qrContainerX, qrContainerY, qrContainerWidth, qrContainerHeight, 16)
      : ctx.rect(qrContainerX, qrContainerY, qrContainerWidth, qrContainerHeight);
    ctx.fill();
    ctx.stroke();

    // QR Code rendering
    const qrSvg =
      svgElement ||
      (document.querySelector("#ticket-qr-container svg") as SVGElement | null) ||
      (document.querySelector("svg[level]") as SVGElement | null);

    const qrSize = 160;
    const qrX = qrContainerX + (qrContainerWidth - qrSize) / 2;
    const qrY = qrContainerY + 20;

    if (isPaid && qrSvg) {
      await new Promise<void>((resolve) => {
        try {
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(qrSvg);
          const svgDataUrl =
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
          const img = new Image();
          img.onload = () => {
            // Crisp white backing for QR Code with border
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#CBD5E1";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect
              ? ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12)
              : ctx.rect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
            ctx.fill();
            ctx.stroke();

            // Draw QR code image
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = svgDataUrl;
        } catch {
          resolve();
        }
      });
    } else {
      // Fallback box for Pending / Cancelled
      ctx.fillStyle = isCancelled ? "#FEF2F2" : "#FFFBEB";
      ctx.strokeStyle = isCancelled ? "#FECACA" : "#FDE68A";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12)
        : ctx.rect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = isCancelled ? "#DC2626" : "#D97706";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        isCancelled ? "TIKET DIBATALKAN" : "MENUNGGU PEMBAYARAN",
        qrContainerX + qrContainerWidth / 2,
        qrY + 70
      );

      ctx.fillStyle = "#64748B";
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        isCancelled
          ? "Tidak dapat digunakan untuk check-in"
          : "Selesaikan instruksi transfer bank",
        qrContainerX + qrContainerWidth / 2,
        qrY + 92
      );
      ctx.textAlign = "left";
    }

    // Text under QR Code
    ctx.textAlign = "center";
    ctx.fillStyle = isPaid ? "#0F172A" : "#64748B";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";

    let instructionTitle = "Tunjukkan QR ini di Meja Registrasi";
    if (ticket.subCheckedIn) {
      instructionTitle = "Tiket Sudah Digunakan (Check-in Selesai)";
    } else if (isCancelled) {
      instructionTitle = "E-Tiket Tidak Berlaku";
    } else if (!isPaid) {
      instructionTitle = "QR Terkunci Hingga Pembayaran Lunas";
    }

    ctx.fillText(instructionTitle, qrContainerX + qrContainerWidth / 2, qrContainerY + 215);

    ctx.fillStyle = "#64748B";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    const subNotice = isSubTicket
      ? `Akses masuk resmi untuk 1 tamu • Seat #${ticket.subTicketIndex}`
      : "Petugas akan memindai QR code ini di pintu masuk venue.";
    ctx.fillText(subNotice, qrContainerX + qrContainerWidth / 2, qrContainerY + 235);

    ctx.fillStyle = "#00A844";
    ctx.font = "600 10px 'Courier New', Courier, monospace";
    ctx.fillText(
      `DAGO CREATIVE HUB • ${displayCode}`,
      qrContainerX + qrContainerWidth / 2,
      qrContainerY + 254
    );
    ctx.textAlign = "left";

    // 9. Footer Note
    ctx.fillStyle = "#94A3B8";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Simpan tiket ini di galeri foto untuk kemudahan registrasi offline tanpa kuota internet.",
      baseWidth / 2,
      baseHeight - 38
    );

    // 10. Trigger Download with safe filename
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
