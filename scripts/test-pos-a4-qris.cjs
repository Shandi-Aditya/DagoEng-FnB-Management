/**
 * Playwright E2E UI Test for Task A4 (POS-25)
 * Verifies QRIS payment button locking, PIN supervisor authorization, and receipt printing.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function run() {
  console.log("=== PLAYWRIGHT E2E TEST: TASK A4 (POS-25) QRIS VERIFICATION ===");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });

  // Pre-seed authenticated cashier persona in browser local storage
  await context.addInitScript(() => {
    localStorage.setItem("dagoeng_active_persona", "CASHIER_SGR");
    localStorage.removeItem("dagoeng_is_logged_out");
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error]`, msg.text());
    }
  });

  try {
    console.log("Step 1: Navigating to POS page http://localhost:3000/pos ...");
    await page.goto("http://localhost:3000/pos", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);

    // Step 2: Ensure search input is cleared
    const searchInput = page.locator("input[placeholder*='Cari menu']");
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("");
      await page.waitForTimeout(300);
    }

    // Handle Open Shift modal strictly if visible
    const shiftModal = page.locator("div.fixed:has-text('Buka Shift Kasir')");
    if (await shiftModal.isVisible().catch(() => false)) {
      console.log("Shift modal detected, filling float Rp 250.000...");
      const floatInput = shiftModal.locator("input").first();
      await floatInput.fill("250000");
      const confirmShiftBtn = shiftModal.locator("button:has-text('Buka Shift')").last();
      await confirmShiftBtn.click();
      await page.waitForTimeout(1000);
      console.log("Cashier shift opened successfully.");
    }

    // Step 3: Add an available product to the cart
    console.log("Step 2: Adding product to cart...");
    const productCard = page.locator("div.cursor-pointer.group").first();
    await productCard.waitFor({ state: "visible", timeout: 10000 });
    await productCard.click();
    await page.waitForTimeout(600);

    // If modifier modal opens, click "Tambahkan ke Keranjang"
    const addModifierBtn = page.locator("button:has-text('Tambahkan ke Keranjang')");
    if (await addModifierBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Modifier modal open, clicking 'Tambahkan ke Keranjang'...");
      await addModifierBtn.click();
      await page.waitForTimeout(800);
    }

    console.log("Product successfully added to cart.");

    // Select Takeaway order type for instant checkout without needing table assignment
    const takeawayBtn = page.locator("button:has-text('Takeaway')").first();
    if (await takeawayBtn.isVisible().catch(() => false)) {
      await takeawayBtn.click();
      await page.waitForTimeout(400);
      console.log("Selected Takeaway order mode.");
    }

    // Step 4: Click "Proses Pembayaran"
    console.log("Step 3: Clicking 'Proses Pembayaran'...");
    const payButton = page.locator("button:has-text('Proses Pembayaran')");
    await payButton.waitFor({ state: "visible", timeout: 5000 });
    await payButton.click();
    await page.waitForTimeout(1000);

    // Step 5: Verify PaymentModal opens on QRIS tab
    console.log("Step 4: Inspecting PaymentModal QRIS tab...");
    const modalHeader = page.locator("h3:has-text('Total Tagihan')");
    await modalHeader.waitFor({ state: "visible", timeout: 8000 });

    const qrisTab = page.locator("button:has-text('QRIS Dinamis')");
    await qrisTab.click();
    await page.waitForTimeout(600);

    // Verify confirm payment button is DISABLED by default
    const confirmPaymentBtn = page.locator("div.border-t button:has-text('Menunggu Pembayaran Tamu (QRIS)')");
    await confirmPaymentBtn.waitFor({ state: "visible", timeout: 5000 });
    const isWaitingDisabled = await confirmPaymentBtn.isDisabled();
    console.log(`[CHECK 1] QRIS confirm button disabled by default: ${isWaitingDisabled ? "PASS" : "FAIL"}`);
    if (!isWaitingDisabled) {
      throw new Error("FAIL: Confirm button is not disabled while QRIS is unverified!");
    }

    // Capture screenshot of locked QRIS state
    const screenshotDir = path.resolve(process.cwd(), "public");
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    await page.screenshot({ path: path.join(screenshotDir, "playwright-qris-locked.png") });
    console.log("Saved screenshot: public/playwright-qris-locked.png");

    // Step 6: Test Supervisor Authorization with invalid PIN
    console.log("Step 5: Testing Supervisor Manual Override with invalid PIN...");
    const openSupervisorAuthBtn = page.locator("button:has-text('Otorisasi Manual QRIS Statis')");
    await openSupervisorAuthBtn.click();
    await page.waitForTimeout(500);

    const pinInput = page.locator("input[placeholder*='PIN Supervisor']");
    await pinInput.fill("9999"); // Wrong PIN

    const refInput = page.locator("input[placeholder*='RRN']");
    await refInput.fill("RRN-TEST-WRONG");

    const submitAuthBtn = page.locator("button:has-text('Verifikasi & Setujui')");
    await submitAuthBtn.click();
    await page.waitForTimeout(500);

    const errorAlert = page.locator(":has-text('PIN Supervisor tidak valid')").last();
    const isErrorVisible = await errorAlert.isVisible();
    console.log(`[CHECK 2] Rejection of invalid supervisor PIN: ${isErrorVisible ? "PASS" : "FAIL"}`);
    if (!isErrorVisible) {
      throw new Error("FAIL: Expected supervisor auth error message for PIN 9999!");
    }

    // Step 7: Test Supervisor Authorization with valid PIN (1234)
    console.log("Step 6: Testing Supervisor Manual Override with valid PIN (1234)...");
    await pinInput.fill("1234");
    await refInput.fill("RRN-PLAYWRIGHT-20261109");
    await submitAuthBtn.click();
    await page.waitForTimeout(800);

    const supervisorApprovedBadge = page.locator(":has-text('Otorisasi QRIS Statis Disetujui')").last();
    const isApprovedVisible = await supervisorApprovedBadge.isVisible();
    console.log(`[CHECK 3] Supervisor authorization approved badge: ${isApprovedVisible ? "PASS" : "FAIL"}`);
    if (!isApprovedVisible) {
      throw new Error("FAIL: Expected supervisor approved badge!");
    }

    // Check that confirm button is now ENABLED with supervisor label
    const unlockedConfirmBtn = page.locator("div.border-t button:has-text('Selesaikan QRIS (Otorisasi Supervisor)')");
    await unlockedConfirmBtn.waitFor({ state: "visible", timeout: 5000 });
    const isUnlocked = !(await unlockedConfirmBtn.isDisabled());
    console.log(`[CHECK 4] QRIS confirm button unlocked after authorization: ${isUnlocked ? "PASS" : "FAIL"}`);
    if (!isUnlocked) {
      throw new Error("FAIL: Expected confirm button to be enabled after supervisor approval!");
    }

    await page.screenshot({ path: path.join(screenshotDir, "playwright-qris-authorized.png") });
    console.log("Saved screenshot: public/playwright-qris-authorized.png");

    // Step 8: Click confirm payment and verify Receipt Modal
    console.log("Step 7: Finalizing payment and verifying Receipt...");
    await unlockedConfirmBtn.click();
    await page.waitForTimeout(1500);

    const receiptModal = page.locator(":has-text('Transaksi Berhasil & Tercatat')").last();
    await receiptModal.waitFor({ state: "visible", timeout: 8000 });

    const qrisReceiptRef = page.locator(":has-text('RRN-PLAYWRIGHT-20261109')").last();
    const isReceiptRefVisible = await qrisReceiptRef.isVisible();
    console.log(`[CHECK 5] QRIS reference number printed on receipt: ${isReceiptRefVisible ? "PASS" : "FAIL"}`);
    if (!isReceiptRefVisible) {
      throw new Error("FAIL: Expected RRN reference on receipt modal!");
    }

    await page.screenshot({ path: path.join(screenshotDir, "playwright-qris-receipt.png") });
    console.log("Saved screenshot: public/playwright-qris-receipt.png");

    console.log("=== ALL 5 PLAYWRIGHT CHECKS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Playwright Test Failed:", err);
    await page.screenshot({ path: "public/playwright-error.png" }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
