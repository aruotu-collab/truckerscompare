import type { Browser, Page } from "playwright-core";
import { placeLabel } from "./geo";
import { listingToJob, type ImportedListing } from "./shiply";
import {
  listingParseIsComplete,
  parseShiplyListing,
  type ShiplyListingParse,
} from "./shiply-quotes";
import {
  nearestShiplyRadius,
  runShiplyLocalSearch,
  shiplySearchPlace,
  type ShiplySearchQuery,
} from "./shiply-search";
import { cargoFromListingUrl, isJunkLoadText } from "./format";
import type { RawJob } from "./types";

export const SHIPLY_LOGIN = "https://www.shiply.com/users/login";
const SEARCH_URL = "https://www.shiply.com/search";
const DETAIL_LIMIT = 50;
const DETAIL_GOTO_LIMIT = 30;
const ROW_LIMIT = 50;

export class ShiplyAuthRequired extends Error {
  constructor() {
    super("Shiply needs you to sign in again.");
    this.name = "ShiplyAuthRequired";
  }
}

export type ShiplyExtract = {
  jobs: RawJob[];
  listingCount: number;
  note: string | null;
};

type SearchRow = {
  listingUrl: string;
  title: string;
  pickup: string;
  delivery: string;
  date: string;
  quotes: number;
  lowestBid: number;
  listedMiles: number | null;
};

export async function openShiplyPage(connectUrl: string): Promise<{
  browser: Browser;
  page: Page;
}> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser, page };
}

async function waitForShiplyReady(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        document.title !== "Just a moment..." &&
        !/performing security verification/i.test(document.body?.innerText || ""),
      { timeout: 45000 },
    )
    .catch(() => undefined);
}

export async function goToShiplyLogin(page: Page): Promise<void> {
  await page.goto(SHIPLY_LOGIN, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForShiplyReady(page);
}

export function isShiplyLogin(page: Page): boolean {
  const url = page.url().toLowerCase();
  return url.includes("/users/login") || url.includes("/account-security");
}

function placeToCity(place: string): string {
  return placeLabel(place);
}

function parsePosted(date: string): number {
  const mins = date.match(/(\d+)\s*min/i);
  if (mins) return Number(mins[1]);
  const hours = date.match(/(\d+)\s*hour/i);
  if (hours) return Number(hours[1]) * 60;
  if (/yesterday/i.test(date)) return 1440;
  return 0;
}

async function pageAuthState(page: Page): Promise<{
  signedIn: boolean;
  hint: string;
}> {
  return page.evaluate(() => {
    const text = (document.body.innerText || "").replace(/\s+/g, " ");
    const signedIn = /sign out|log out|my account|my quotes|dashboard|welcome/i.test(
      text.slice(0, 2500),
    );
    const loginPrompt = /log in|sign in/i.test(text.slice(0, 1200));
    return {
      signedIn: signedIn && !loginPrompt,
      hint: signedIn ? "account chrome present" : "login chrome still visible",
    };
  });
}

async function readSearchRows(page: Page): Promise<SearchRow[]> {
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();
  await new Promise((resolve) => setTimeout(resolve, 800));

  return page.evaluate(() => {
    const rows: SearchRow[] = [];
    const seen = new Set<string>();

    for (const tr of document.querySelectorAll("table tr")) {
      const link = tr.querySelector('a[href*="/transport/"]') as HTMLAnchorElement | null;
      if (!link?.href) continue;
      if (seen.has(link.href)) continue;
      const cells = [...tr.querySelectorAll("td")].map((td) =>
        (td.textContent || "").replace(/\s+/g, " ").trim(),
      );
      if (cells.length < 3) continue;
      seen.add(link.href);
      rows.push({
        listingUrl: link.href,
        title: (link.textContent || "").replace(/\s+/g, " ").trim(),
        pickup: cells[1] || "",
        delivery: cells[2] || "",
        date: (() => {
          const dated = cells.find((cell) =>
            /\d+\s*(min|hour|hr|day)|yesterday|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(cell),
          );
          return dated || cells[4] || "";
        })(),
        listedMiles: (() => {
          const raw = (cells[3] || "").replace(/,/g, "");
          const miles = Number(raw);
          return Number.isFinite(miles) && miles > 0 && miles < 4000 ? miles : null;
        })(),
        lowestBid: (() => {
          for (const cell of cells) {
            const match = cell.match(/£\s?([\d,]+(?:\.\d{1,2})?)/);
            if (!match) continue;
            const amount = Number(match[1]!.replace(/,/g, ""));
            if (Number.isFinite(amount) && amount >= 15 && amount <= 20000) return amount;
          }
          return 0;
        })(),
        quotes: (() => {
          const fifth = Number((cells[5] || "").replace(/\D/g, ""));
          if (fifth > 0 && fifth < 80 && !/£/.test(cells[5] || "")) return fifth;
          for (let i = cells.length - 1; i >= 3; i -= 1) {
            if (/^\d{1,2}$/.test(cells[i] || "")) return Number(cells[i]);
          }
          return 0;
        })(),
      });
    }

    if (rows.length > 0) return rows;

    for (const a of document.querySelectorAll('a[href*="/transport/"]')) {
      const href = (a as HTMLAnchorElement).href;
      if (!href || seen.has(href)) continue;
      const block = (a.closest("tr, li, article, .row") || a.parentElement) as HTMLElement | null;
      const text = (block?.innerText || a.textContent || "").replace(/\s+/g, " ").trim();
      seen.add(href);
      rows.push({
        listingUrl: href,
        title: (a.textContent || "").replace(/\s+/g, " ").trim(),
        pickup: text,
        delivery: text,
        date: "",
        listedMiles: null,
        lowestBid: 0,
        quotes: 0,
      });
    }
    return rows;
  });
}

async function readListingDetail(
  page: Page,
  listingUrl: string,
  fallbackTitle: string,
  allowGoto: boolean,
): Promise<{ parsed: ShiplyListingParse; usedGoto: boolean }> {
  const fetched = await page
    .evaluate(async (href: string) => {
      const res = await fetch(href, { credentials: "include" });
      const html = await res.text();
      return { status: res.status, html: html.slice(0, 400000) };
    }, listingUrl)
    .catch(() => null);

  if (fetched?.status === 200 && fetched.html) {
    const text = fetched.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (/users\/login|account-security/i.test(fetched.html) && /log in|sign in/i.test(text)) {
      throw new ShiplyAuthRequired();
    }
    const parsed = parseShiplyListing(fetched.html, fallbackTitle);
    if (listingParseIsComplete(parsed) || !allowGoto) {
      return { parsed, usedGoto: false };
    }
  }

  if (!allowGoto) {
    return {
      parsed: parseShiplyListing(fetched?.html ?? "", fallbackTitle),
      usedGoto: false,
    };
  }

  await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  await waitForShiplyReady(page);
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();
  await page
    .waitForFunction(
      () =>
        /net quote amount|view quote|lowest\s+(?:quote|bid)|£\s?\d{2,}\s+[A-Za-z]/i.test(
          document.body?.innerText || "",
        ),
      { timeout: 8000 },
    )
    .catch(() => undefined);
  const html = await page.content();
  return { parsed: parseShiplyListing(html, fallbackTitle), usedGoto: true };
}

export async function extractVisibleJobs(
  page: Page,
  query?: ShiplySearchQuery,
): Promise<ShiplyExtract> {
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();

  // Live sign-in can use a phone viewport so the hosted window is usable.
  // Widen before scrape so Local search and listing tables stay desktop-shaped.
  await page.setViewportSize({ width: 1024, height: 768 }).catch(() => undefined);

  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForShiplyReady(page);
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();

  const radius = query ? nearestShiplyRadius(query.radiusMiles) : 0;
  let usedLocalSearch = false;
  if (query && radius > 0) {
    usedLocalSearch = await runShiplyLocalSearch(
      page,
      shiplySearchPlace(query),
      radius,
    );
    await waitForShiplyReady(page);
    if (isShiplyLogin(page)) throw new ShiplyAuthRequired();
  }

  const rows = await readSearchRows(page);
  const auth = await pageAuthState(page);
  const jobs: RawJob[] = [];
  let kept = 0;
  let withBudget = 0;
  let sampleSnippet = "";
  let gotos = 0;

  for (const row of rows) {
    if (jobs.length >= ROW_LIMIT) break;
    let detail: ShiplyListingParse | null = null;
    if (jobs.length < DETAIL_LIMIT) {
      try {
        const allowGoto = gotos < DETAIL_GOTO_LIMIT;
        const read = await readListingDetail(
          page,
          row.listingUrl,
          row.title,
          allowGoto,
        );
        detail = read.parsed;
        if (read.usedGoto) gotos += 1;
        if (!sampleSnippet && detail.snippet) sampleSnippet = detail.snippet;
      } catch (err) {
        if (err instanceof ShiplyAuthRequired) throw err;
      }
    }
    const pickupCity = placeToCity(detail?.pickup || row.pickup);
    const deliveryCity = placeToCity(detail?.delivery || row.delivery);
    if (!pickupCity || pickupCity === "Unknown" || !deliveryCity || deliveryCity === "Unknown") {
      continue;
    }
    kept += 1;
    const revenue = detail?.lowestBid || row.lowestBid || 0;
    if (revenue) withBudget += 1;

    const fromUrl = cargoFromListingUrl(row.listingUrl);
    const searchTitle = isJunkLoadText(row.title) ? "" : row.title;
    const parsedTitle = detail?.title && !isJunkLoadText(detail.title) ? detail.title : "";
    const parsedNotes =
      detail?.description && !isJunkLoadText(detail.description) ? detail.description : "";
    const load = parsedNotes || parsedTitle || searchTitle || fromUrl;
    const item: ImportedListing = {
      externalId: row.listingUrl.split("/").filter(Boolean).pop() || row.listingUrl,
      listingUrl: row.listingUrl,
      pickupCity,
      deliveryCity,
      category:
        detail?.category && !isJunkLoadText(detail.category)
          ? detail.category
          : load || "General",
      revenue,
      highestBid: detail?.highestBid || revenue || row.lowestBid,
      weightKg: detail?.weightKg ?? null,
      collectionWindow: detail?.collectionWindow,
      deliveryWindow: detail?.deliveryWindow,
      quoteCount: detail?.quoteCount || row.quotes || (revenue ? 1 : 0),
      postedMinutesAgo: parsePosted(row.date),
      description: load,
      listedMiles: detail?.listedMiles ?? row.listedMiles,
    };
    const job = listingToJob(item, jobs.length);
    if (typeof job !== "string") jobs.push(job);
  }

  let note: string | null = null;
  if (!auth.signedIn) {
    note =
      "The hosted Shiply window is not signed in. Click Open Shiply sign-in and log in there — signing in on shiply.com in your own browser does not count.";
  } else if (/been blocked|unable to access/i.test(sampleSnippet)) {
    note =
      "Shiply blocked the hosted browser on listing pages. Open sign-in again and stay in that window, then pull jobs.";
  } else if (query && radius > 0 && !usedLocalSearch) {
    note =
      "Could not open Shiply Local search, so this is the national table. Sign in again if the Local tab is missing.";
  } else if (rows.length === 0) {
    note = `Opened ${page.url()} but found no Shiply listing table.`;
  } else if (jobs.length === 0) {
    note = `Read ${rows.length} listings; ${kept} could be kept.`;
  }

  console.log(
    `[shiply] url=${page.url()} local=${usedLocalSearch} radius=${radius} place=${query ? shiplySearchPlace(query) : "-"} rows=${rows.length} kept=${kept} jobs=${jobs.length} auth=${auth.hint}`,
  );

  return { jobs, listingCount: rows.length, note };
}
