import { OrderRecord, OrderTimeMetrics, SLAStatus, OperationalBottleneckSummary } from "@/types/order";

/**
 * Computes the minute difference between two ISO date strings.
 */
export function getMinutesDiff(startDateStr?: string, endDateStr?: string): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr).getTime();
  const end = endDateStr ? new Date(endDateStr).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  return Number((diffMs / (1000 * 60)).toFixed(1));
}

/**
 * Formats minutes into standard MMm SSs format.
 * Example: 14.36 minutes -> "14m 22s"
 */
export function formatMinutesToHuman(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

/**
 * Calculates all time segments and SLA status for a single order.
 */
export function calculateOrderMetrics(order: OrderRecord, nowTimeMs: number = Date.now()): OrderTimeMetrics {
  const targetMinutes = order.targetServiceMinutes || 10;

  // 1. Kitchen Queue: Confirmed -> Kitchen Received
  const queueStart = order.confirmedAt || order.createdAt;
  const queueEnd = order.kitchenReceivedAt || (order.status === "NEW" || order.status === "CONFIRMED" ? new Date(nowTimeMs).toISOString() : queueStart);
  const kitchenQueueMinutes = getMinutesDiff(queueStart, order.kitchenReceivedAt ? queueEnd : undefined);

  // 2. Cooking Time: Cooking Started -> Ready / Cooking Finished
  let cookingMinutes = 0;
  if (order.cookingStartedAt) {
    const cookEnd = order.readyAt || order.cookingFinishedAt || (order.status === "COOKING" ? new Date(nowTimeMs).toISOString() : order.cookingStartedAt);
    cookingMinutes = getMinutesDiff(order.cookingStartedAt, order.readyAt || order.cookingFinishedAt ? cookEnd : undefined);
  }

  // 3. Serving Time: Ready -> Served
  let servingMinutes = 0;
  if (order.readyAt) {
    const serveEnd = order.servedAt || (order.status === "READY" ? new Date(nowTimeMs).toISOString() : order.readyAt);
    servingMinutes = getMinutesDiff(order.readyAt, order.servedAt ? serveEnd : undefined);
  }

  // 4. Total Customer Waiting Time: Created -> Served (or current time if not yet served)
  const waitingEnd = order.servedAt || order.completedAt || new Date(nowTimeMs).toISOString();
  const totalCustomerWaitingMinutes = getMinutesDiff(order.createdAt, order.servedAt || order.completedAt ? waitingEnd : undefined);

  // 5. Total Fulfillment Time: Created -> Completed
  const totalFulfillmentMinutes = order.completedAt ? getMinutesDiff(order.createdAt, order.completedAt) : totalCustomerWaitingMinutes;

  // 6. SLA Status
  let slaStatus: SLAStatus = "ON_TIME";
  const isDelayed = totalCustomerWaitingMinutes > targetMinutes;
  const delayMinutes = Math.max(0, Number((totalCustomerWaitingMinutes - targetMinutes).toFixed(1)));

  if (isDelayed) {
    slaStatus = "DELAYED";
  } else if (totalCustomerWaitingMinutes >= targetMinutes * 0.75) {
    slaStatus = "AT_RISK";
  }

  return {
    kitchenQueueMinutes,
    cookingMinutes,
    servingMinutes,
    totalCustomerWaitingMinutes,
    totalFulfillmentMinutes,
    slaStatus,
    isDelayed,
    delayMinutes,
  };
}

/**
 * Evaluates an array of orders to determine aggregate waiting metrics and operational bottleneck.
 */
export function analyzeOperationalBottlenecks(
  orders: OrderRecord[],
  targetMinutes: number = 10
): OperationalBottleneckSummary {
  if (!orders || orders.length === 0) {
    return {
      avgKitchenQueueMinutes: 0,
      avgCookingMinutes: 0,
      avgServingMinutes: 0,
      avgTotalWaitingMinutes: 0,
      targetServiceMinutes: targetMinutes,
      totalOrders: 0,
      delayedOrdersCount: 0,
      delayedPercentage: 0,
      primaryBottleneck: "BALANCED",
      diagnosisStatement: "Belum ada data pesanan pada rentang tanggal ini.",
    };
  }

  let totalQueue = 0;
  let totalCook = 0;
  let totalServe = 0;
  let totalWait = 0;
  let delayedCount = 0;

  for (const order of orders) {
    const metrics = calculateOrderMetrics(order);
    totalQueue += metrics.kitchenQueueMinutes;
    totalCook += metrics.cookingMinutes;
    totalServe += metrics.servingMinutes;
    totalWait += metrics.totalCustomerWaitingMinutes;
    if (metrics.isDelayed) delayedCount++;
  }

  const count = orders.length;
  const avgKitchenQueueMinutes = Number((totalQueue / count).toFixed(1));
  const avgCookingMinutes = Number((totalCook / count).toFixed(1));
  const avgServingMinutes = Number((totalServe / count).toFixed(1));
  const avgTotalWaitingMinutes = Number((totalWait / count).toFixed(1));
  const delayedPercentage = Number(((delayedCount / count) * 100).toFixed(1));

  // Determine primary bottleneck
  let primaryBottleneck: "KITCHEN_QUEUE" | "COOKING" | "SERVING" | "BALANCED" = "COOKING";
  let diagnosisStatement = "";

  const maxStage = Math.max(avgKitchenQueueMinutes, avgCookingMinutes, avgServingMinutes);

  if (maxStage === avgCookingMinutes && avgCookingMinutes > 0) {
    const cookRatio = Math.round((avgCookingMinutes / (avgTotalWaitingMinutes || 1)) * 100);
    primaryBottleneck = "COOKING";
    diagnosisStatement = `Proses memasak di dapur adalah bottleneck utama (menyumbang ${cookRatio}% dari total waktu tunggu pelanggan).`;
  } else if (maxStage === avgKitchenQueueMinutes && avgKitchenQueueMinutes > 0) {
    const queueRatio = Math.round((avgKitchenQueueMinutes / (avgTotalWaitingMinutes || 1)) * 100);
    primaryBottleneck = "KITCHEN_QUEUE";
    diagnosisStatement = `Antrean penerimaan pesanan di dapur adalah bottleneck utama (${queueRatio}% waktu habis sebelum mulai dimasak).`;
  } else if (maxStage === avgServingMinutes && avgServingMinutes > 0) {
    const serveRatio = Math.round((avgServingMinutes / (avgTotalWaitingMinutes || 1)) * 100);
    primaryBottleneck = "SERVING";
    diagnosisStatement = `Waktu pengantaran waiter ke meja adalah bottleneck utama (${serveRatio}% waktu dihabiskan saat makanan siap saji).`;
  } else {
    primaryBottleneck = "BALANCED";
    diagnosisStatement = "Alur operasional dapur dan penyajian berjalan seimbang dan optimal.";
  }

  return {
    avgKitchenQueueMinutes,
    avgCookingMinutes,
    avgServingMinutes,
    avgTotalWaitingMinutes,
    targetServiceMinutes: targetMinutes,
    totalOrders: count,
    delayedOrdersCount: delayedCount,
    delayedPercentage,
    primaryBottleneck,
    diagnosisStatement,
  };
}
