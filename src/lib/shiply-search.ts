import type { Page } from "playwright-core";

export type ShiplySearchQuery = {
  startingCity: string;
  radiusMiles: number;
};

/** Radii Shiply actually offers on Local search. */
export const SHIPLY_LOCAL_RADII = [
  5, 10, 20, 30, 40, 60, 100, 125, 150, 175, 200,
] as const;

export function nearestShiplyRadius(miles: number): number {
  if (miles <= 0) return 0;
  let best: number = SHIPLY_LOCAL_RADII[0]!;
  for (const option of SHIPLY_LOCAL_RADII) {
    const closer = Math.abs(option - miles) < Math.abs(best - miles);
    const tieHigher =
      Math.abs(option - miles) === Math.abs(best - miles) && option > best;
    if (closer || tieHigher) best = option;
  }
  return best;
}

export function parseShiplySearch(body: unknown): ShiplySearchQuery {
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const startingCity =
    typeof row.startingCity === "string" && row.startingCity.trim()
      ? row.startingCity.trim()
      : "London";
  const radiusMiles = Number(row.radiusMiles);
  return {
    startingCity,
    radiusMiles: Number.isFinite(radiusMiles) ? radiusMiles : 40,
  };
}

/**
 * Run Shiply Local search: collection within `radius` of `location`.
 * Returns false if the logged-in search form is not on the page.
 */
export async function runShiplyLocalSearch(
  page: Page,
  location: string,
  radius: number,
): Promise<boolean> {
  const formReady = await page
    .locator("#ListingsSearchForm, #SearchLocalAddress")
    .first()
    .waitFor({ state: "attached", timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (!formReady) return false;

  const localTab = page.locator("#SearchLocalTab, a[href='#SearchLocal']").first();
  if ((await localTab.count()) > 0) {
    await localTab.click().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const filled = await page.evaluate(
    ({ location: place, radius: miles }) => {
      const addr = document.getElementById(
        "SearchLocalAddress",
      ) as HTMLInputElement | null;
      const rad = document.getElementById(
        "SearchLocalRadius",
      ) as HTMLSelectElement | null;
      const from = document.getElementById(
        "SearchLocalFrom",
      ) as HTMLInputElement | null;
      const to = document.getElementById(
        "SearchLocalTo",
      ) as HTMLInputElement | null;
      const type = document.getElementById(
        "SearchType",
      ) as HTMLInputElement | null;
      if (!addr || !rad) return false;
      addr.focus();
      addr.value = place;
      addr.dispatchEvent(new Event("input", { bubbles: true }));
      addr.dispatchEvent(new Event("change", { bubbles: true }));
      const option = [...rad.options].find(
        (row) => row.value === String(miles) || row.textContent?.trim() === String(miles),
      );
      if (option) {
        rad.value = option.value;
        rad.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (from && !from.checked) from.click();
      if (to && to.checked) to.click();
      if (type) type.value = "2";
      return true;
    },
    { location, radius },
  );
  if (!filled) return false;

  const submit = page
    .locator(
      "#ListingsSearchForm button.search-tabs-action-submit, #ListingsSearchForm button[type='submit'], #ListingsSearchForm input[type='submit']",
    )
    .first();
  if ((await submit.count()) > 0) {
    await Promise.all([
      page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
        .catch(() => undefined),
      submit.click(),
    ]);
  } else {
    await page.evaluate(() => {
      const form = document.getElementById(
        "ListingsSearchForm",
      ) as HTMLFormElement | null;
      form?.submit();
    });
    await page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(() => undefined);
  }
  return true;
}
