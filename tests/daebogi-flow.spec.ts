import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
  }
});

test("mobile MVP flow", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  await expect(page.getByRole("heading", { name: "대보기" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles("/tmp/daebogi-person.svg");
  await expect(page.getByAltText("내 사진")).toBeVisible();
  await page.getByRole("button", { name: "카메라", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video instanceof HTMLVideoElement && video.videoWidth > 0 && video.videoHeight > 0;
  });
  await page.getByRole("button", { name: "고정" }).click();
  await expect(page.getByAltText("옷 레이어")).toBeVisible();
  await page.getByRole("slider", { name: "크기" }).fill("1.22");
  await page.getByRole("slider", { name: "회전" }).fill("8");
  await page.getByRole("slider", { name: "투명도" }).fill("0.64");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("1 / 8")).toBeVisible();
  await expect(page.getByAltText("저장한 착장").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/daebogi-flow.png", fullPage: false });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(clientWidth);
});

test("고정 버튼: 카메라 미준비 시 안내 메시지 표시", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  await page.getByRole("button", { name: "고정" }).click();
  await expect(page.locator(".notice")).toBeVisible();
  await expect(page.locator(".notice")).toContainText("카메라를 먼저 켜주세요");
});

test("비교 모드: 두 저장 룩을 나란히 표시", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  // Inject two fake saved looks so we don't need the full save flow
  await page.evaluate(() => {
    const fakeJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC AABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA//EACMQAAEDBAMAAwAAAAAAAAAAAAECAxEEITFBUWGBkf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AyuFw2Pq8hFNLTTHc4+EdXsBYiIiAiIgIiICIiAiIgIiICIiAiIgP/9k=";
    const looks = [
      { id: "look-a", image: fakeJpeg, createdAt: Date.now() - 2000 },
      { id: "look-b", image: fakeJpeg, createdAt: Date.now() - 1000 }
    ];
    localStorage.setItem("daebogi.savedLooks", JSON.stringify(looks));
  });
  await page.reload();
  await page.getByRole("button", { name: "비교" }).click();
  await expect(page.locator(".compareView")).toBeVisible();
  await expect(page.getByAltText("비교 A")).toBeVisible();
  await expect(page.getByAltText("비교 B")).toBeVisible();
});

test("썸네일 두 번 탭으로 비교 모드 진입", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  await page.evaluate(() => {
    const fakeJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC AABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA//EACMQAAEDBAMAAwAAAAAAAAAAAAECAxEEITFBUWGBkf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AyuFw2Pq8hFNLTTHc4+EdXsBYiIiAiIgIiICIiAiIgIiICIiAiIgP/9k=";
    const looks = [
      { id: "look-a", image: fakeJpeg, createdAt: Date.now() - 2000 },
      { id: "look-b", image: fakeJpeg, createdAt: Date.now() - 1000 }
    ];
    localStorage.setItem("daebogi.savedLooks", JSON.stringify(looks));
  });
  await page.reload();
  const thumbs = page.locator(".thumb:not(.empty)");
  await thumbs.nth(0).click(); // select primary
  await thumbs.nth(1).click(); // select compare
  await expect(page.locator(".compareView")).toBeVisible();
});

test("localStorage 손상 데이터 자동 복구", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  await page.evaluate(() => {
    localStorage.setItem("daebogi.savedLooks", "invalid json {{{{");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "대보기" })).toBeVisible();
  await expect(page.locator(".compareStrip")).toBeVisible();
});
