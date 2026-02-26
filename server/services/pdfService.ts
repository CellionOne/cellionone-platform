import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

function findChromePath(): string | undefined {
  const searchDirs = [
    path.join(process.cwd(), ".puppeteer-cache", "chrome"),
    path.join(process.env.HOME || "/home/runner", ".cache", "puppeteer", "chrome"),
  ];

  for (const cacheDir of searchDirs) {
    if (fs.existsSync(cacheDir)) {
      const versions = fs.readdirSync(cacheDir).filter(d => d.startsWith("linux-"));
      if (versions.length > 0) {
        const chromePath = path.join(cacheDir, versions[versions.length - 1], "chrome-linux64", "chrome");
        if (fs.existsSync(chromePath)) {
          console.log(`[PDF] Found Chrome at: ${chromePath}`);
          return chromePath;
        }
      }
    }
  }

  console.warn("[PDF] Chrome not found in any search path");
  return undefined;
}

export async function launchBrowser() {
  const executablePath = findChromePath();
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
}

export async function generatePdf(html: string, options?: { format?: "A4" | "Letter"; margin?: { top?: string; right?: string; bottom?: string; left?: string } }): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: options?.format || "A4",
      printBackground: true,
      margin: options?.margin || { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
