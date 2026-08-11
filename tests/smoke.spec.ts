import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("creative lab exposes effects, motion, typefaces and colors without dropdowns", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "GLYPH/LAB" })).toBeVisible();
  await expect(page.locator("nav.toolRail button")).toHaveCount(12);
  await expect(page.getByRole("button", { name: /wave effect/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /warp effect/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "serif" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Animation presets" }).locator("button")).toHaveCount(8);
  await expect(page.getByLabel("Background color", { exact: true })).toBeAttached();
  await expect(page.getByLabel("Font color", { exact: true })).toBeAttached();
  await expect(page.getByLabel("Upload background images")).toBeAttached();
  await expect(page.locator("select")).toHaveCount(0);
});

test("user text is editable, case-preserving and exportable as GIF", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Your text");
  await expect(input).toHaveValue("");
  await input.fill("Hello type");
  await expect(input).toHaveValue("Hello type");

  await page.getByRole("button", { name: /Static/i }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export GIF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.gif$/);

  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
  expect(bytes.byteLength).toBeGreaterThan(1500);

  // Decode the exported GIF in the browser and make sure the center of the
  // first frame actually contains rendered glyph pixels. This catches LZW
  // streams that look like GIF files but truncate after only the first rows.
  const dataUrl = `data:image/gif;base64,${bytes.toString("base64")}`;
  const decoded = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return { width: 0, height: 0, changedPixels: 0 };
    context.drawImage(image, 0, 0);

    const background = context.getImageData(0, 0, 1, 1).data;
    const x = Math.floor(canvas.width * 0.15);
    const y = Math.floor(canvas.height * 0.25);
    const width = Math.max(1, Math.floor(canvas.width * 0.7));
    const height = Math.max(1, Math.floor(canvas.height * 0.5));
    const pixels = context.getImageData(x, y, width, height).data;
    let changedPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const difference =
        Math.abs(pixels[i] - background[0]) +
        Math.abs(pixels[i + 1] - background[1]) +
        Math.abs(pixels[i + 2] - background[2]);
      if (difference > 30) changedPixels++;
    }
    return { width: canvas.width, height: canvas.height, changedPixels };
  }, dataUrl);

  expect(decoded.width).toBeGreaterThan(0);
  expect(decoded.height).toBeGreaterThan(0);
  expect(decoded.changedPixels).toBeGreaterThan(100);
});

test("mobile layout has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Your text").fill("Responsive");
  await page.getByLabel("Font color", { exact: true }).evaluate((element: HTMLInputElement) => {
    element.value = "#ff2a8a";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test("line effect keeps rendered glyph pixels visible", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("LINE");
  await page.getByRole("button", { name: "line effect", exact: true }).click();

  const canvas = page.locator("canvas.typeCanvas");
  await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
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
  }), { timeout: 5000 }).toBeGreaterThan(100);
});


test("morph animation changes the rendered effect over time", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("MORPH");
  await page.getByRole("button", { name: "warp effect" }).click();
  await page.getByRole("button", { name: "Morph" }).click();

  const canvas = page.locator("canvas.typeCanvas");
  const signature = async () => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return "";
    const width = element.width;
    const height = element.height;
    const pixels = context.getImageData(0, 0, width, height).data;
    let hash = 2166136261;
    const step = Math.max(4, Math.floor((width * height) / 5000)) * 4;
    for (let i = 0; i < pixels.length; i += step) {
      hash ^= pixels[i] + (pixels[i + 1] << 8) + (pixels[i + 2] << 16) + (pixels[i + 3] << 24);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  });

  const first = await signature();
  await page.waitForTimeout(350);
  const second = await signature();
  expect(first).not.toBe("");
  expect(second).not.toBe(first);
});


test("image-only GIF workflow accepts multiple local images without requiring text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Your text")).toHaveValue("");

  const redPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    "base64"
  );
  const bluePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  await page.getByLabel("Upload background images").setInputFiles([
    { name: "frame-red.png", mimeType: "image/png", buffer: redPng },
    { name: "frame-blue.png", mimeType: "image/png", buffer: bluePng }
  ]);

  await expect(page.locator(".mediaThumb")).toHaveCount(2);
  await expect(page.getByText("IMAGE-ONLY GIF MODE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export GIF" })).toBeEnabled();
  await page.getByRole("button", { name: "fade" }).click();
  await page.getByRole("button", { name: "sequence" }).click();
});
