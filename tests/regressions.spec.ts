import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const RED_PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64"
);

async function canvasHash(canvas: import("@playwright/test").Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return "";
    const { width, height } = element;
    const pixels = context.getImageData(0, 0, width, height).data;
    let hash = 2166136261;
    const step = Math.max(4, Math.floor((width * height) / 5000)) * 4;
    for (let i = 0; i < pixels.length; i += step) {
      hash ^= pixels[i] + (pixels[i + 1] << 8) + (pixels[i + 2] << 16) + (pixels[i + 3] << 24);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  });
}

async function renderedPixelCount(canvas: import("@playwright/test").Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    const background = [pixels[0], pixels[1], pixels[2]];
    let changed = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const difference =
        Math.abs(pixels[i] - background[0]) +
        Math.abs(pixels[i + 1] - background[1]) +
        Math.abs(pixels[i + 2] - background[2]);
      if (difference > 45) changed++;
    }
    return changed;
  });
}

test("GIF export duration matches the requested loop length", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("TIME");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export GIF" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);

  // Graphic Control Extension blocks (21 F9 04 00 <delayLo> <delayHi> 00 00)
  // carry each frame's delay in centiseconds; summing them is the real
  // played-back duration of the loop.
  let totalCentiseconds = 0;
  let frameCount = 0;
  for (let i = 0; i < bytes.length - 7; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04 && bytes[i + 3] === 0x00) {
      totalCentiseconds += bytes[i + 4] | (bytes[i + 5] << 8);
      frameCount++;
    }
  }

  expect(frameCount).toBeGreaterThan(1);
  const totalMs = totalCentiseconds * 10;
  expect(totalMs).toBeGreaterThanOrEqual(1990);
  expect(totalMs).toBeLessThanOrEqual(2010);
});

test("a broken image in the upload batch does not stop GIF export of the rest", async ({ page }) => {
  await page.goto("/");
  const brokenFile = Buffer.from("this is not a real image, just bytes with a png-like name");

  await page.getByLabel("Upload background images").setInputFiles([
    { name: "broken.png", mimeType: "image/png", buffer: brokenFile },
    { name: "good.png", mimeType: "image/png", buffer: RED_PNG_1X1 }
  ]);

  await expect(page.locator(".mediaThumb")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Export GIF" })).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export GIF" }).click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
});

test("pausing the preview freezes the current frame instead of resetting it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("HOLD");
  await page.getByRole("button", { name: "warp effect" }).click();
  await page.getByRole("button", { name: "Jitter" }).click();

  const canvas = page.locator("canvas.typeCanvas");
  const atStart = await canvasHash(canvas);
  await page.waitForTimeout(400);
  const beforePause = await canvasHash(canvas);
  expect(beforePause).not.toBe(atStart);

  await page.getByRole("button", { name: "Pause preview" }).click();
  const rightAfterPause = await canvasHash(canvas);
  await page.waitForTimeout(400);
  const stillPaused = await canvasHash(canvas);

  expect(stillPaused).toBe(rightAfterPause);
  expect(rightAfterPause).not.toBe(atStart);
});

test("removing the last image while the text layer is hidden makes typed text reachable again", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("BACK");

  await page.getByLabel("Upload background images").setInputFiles([{ name: "solo.png", mimeType: "image/png", buffer: RED_PNG_1X1 }]);
  await expect(page.locator(".mediaThumb")).toHaveCount(1);

  await page.getByRole("button", { name: "Show text layer" }).click();
  await page.getByRole("button", { name: "Remove solo.png" }).click();
  await expect(page.locator(".mediaThumb")).toHaveCount(0);

  const canvas = page.locator("canvas.typeCanvas");
  await expect.poll(() => renderedPixelCount(canvas), { timeout: 5000 }).toBeGreaterThan(100);
});

test("long text fits within the canvas at narrow viewports", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await page.getByLabel("Your text").fill("A VERY LONG HEADLINE FOR THIS TYPE TEST");

  const canvas = page.locator("canvas.typeCanvas");
  await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return false;
    const { width, height } = element;
    const pixels = context.getImageData(0, 0, width, height).data;
    const background = [pixels[0], pixels[1], pixels[2]];
    let minX = width;
    let maxX = 0;
    let found = false;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const difference =
          Math.abs(pixels[i] - background[0]) + Math.abs(pixels[i + 1] - background[1]) + Math.abs(pixels[i + 2] - background[2]);
        if (difference > 45) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (!found) return false;
    const margin = width * 0.02;
    return minX > margin && maxX < width - margin;
  }), { timeout: 5000 }).toBe(true);
});

test("PNG export downloads a decodable, non-blank image", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("PNG");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.byteLength).toBeGreaterThan(500);
});

test("font buttons remain individually distinguishable to screen readers on narrow viewports", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const names = await page.locator(".fontGrid.expandedFonts button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));

  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => Boolean(name))).toBe(true);
  expect(new Set(names).size).toBe(names.length);
});
