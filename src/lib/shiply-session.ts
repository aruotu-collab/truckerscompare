import { chromium, type Page } from "playwright-core";
import { CITIES } from "./geo";
import { listingToJob, type ImportedListing } from "./shiply";
import type { RawJob } from "./types";

export const SHIPLY_LOGIN = "https://www.shiply.com/users/login";
const SEARCH_URL = "https://www.shiply.com/search";
const DETAIL_LIMIT = 20;

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
};

export async function openShiplyPage(connectUrl: string): Promise<{
  browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>;
  page: Page;
}> {
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

function placeToCity(place: string): string | null {
  const first = place.split(",")[0]?.trim() ?? place.trim();
  if (!first) return null;
  const lower = first.toLowerCase();
  const exact = CITIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.name;
  const prefix = CITIES.find(
    (c) =>
      lower.startsWith(`${c.name.toLowerCase()} `) ||
      lower.startsWith(`${c.name.toLowerCase()}-`),
  );
  if (prefix) return prefix.name;
  return CITIES.find((c) => lower.includes(c.name.toLowerCase()))?.name ?? null;
}

function parsePosted(date: string): number {
  const mins = date.match(/(\d+)\s*min/i);
  if (mins) return Number(mins[1]);
  const hours = date.match(/(\d+)\s*hour/i);
  if (hours) return Number(hours[1]) * 60;
  if (/yesterday/i.test(date)) return 1440;
  return 0;
}

function budgetFromText(text: string): number {
  const labelled = text.match(
    /(?:budget|offering|offer|pay(?:ing)? up to|customer(?:'s)? (?:budget|offer))[^££GBP]{0,64}(?:£|&pound;|GBP)\s?([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (labelled) return Number(labelled[1]!.replace(/,/g, ""));
  const quotes = [
    ...text.matchAll(/£\s?([\d,]+(?:\.\d{1,2})?)\s+[A-Za-z][A-Za-z0-9_-]+\s+\(/g),
  ]
    .map((m) => Number(m[1]!.replace(/,/g, "")))
    .filter((n) => n >= 15 && n <= 20000);
  if (quotes.length) return Math.min(...quotes);
  const amounts = [...text.matchAll(/(?:£|&pound;|GBP)\s?([\d,]+(?:\.\d{1,2})?)/gi)]
    .map((m) => Number(m[1]!.replace(/,/g, "")))
    .filter((n) => n >= 20 && n <= 20000);
  return amounts[0] ?? 0;
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
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForShiplyReady(page);
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();
  await new Promise((resolve) => setTimeout(resolve, 1500));

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
        date: cells[4] || "",
        quotes: Number((cells[5] || "").replace(/\D/g, "")) || 0,
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
        quotes: 0,
      });
    }
    return rows;
  });
}

async function readListingBudget(page: Page, listingUrl: string): Promise<{
  revenue: number;
  snippet: string;
}> {
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
    const nearby =
      text.match(/.{0,70}(?:£|&pound;|GBP|budget|quote|offer).{0,70}/i)?.[0] ??
      text.slice(0, 160);
    return { revenue: budgetFromText(text), snippet: nearby.trim() };
  }

  await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  await waitForShiplyReady(page);
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();
  const text = (await page.innerText("body").catch(() => "")).replace(/\s+/g, " ");
  const nearby =
    text.match(/.{0,70}(?:£|&pound;|GBP|budget|quote|offer).{0,70}/i)?.[0] ??
    text.slice(0, 160);
  return { revenue: budgetFromText(text), snippet: nearby.trim() };
}

export async function extractVisibleJobs(page: Page): Promise<ShiplyExtract> {
  if (isShiplyLogin(page)) throw new ShiplyAuthRequired();

  const rows = await readSearchRows(page);
  const auth = await pageAuthState(page);
  const jobs: RawJob[] = [];
  let mapped = 0;
  let withBudget = 0;
  let sampleSnippet = "";

  for (const row of rows) {
    if (withBudget >= DETAIL_LIMIT) break;
    const pickupCity = placeToCity(row.pickup);
    const deliveryCity = placeToCity(row.delivery);
    if (!pickupCity || !deliveryCity) continue;
    mapped += 1;

    let revenue = 0;
    try {
      const detail = await readListingBudget(page, row.listingUrl);
      revenue = detail.revenue;
      if (!sampleSnippet && detail.snippet) sampleSnippet = detail.snippet;
    } catch (err) {
      if (err instanceof ShiplyAuthRequired) throw err;
    }
    if (!revenue) continue;
    withBudget += 1;

    const item: ImportedListing = {
      externalId: row.listingUrl.split("/").filter(Boolean).pop() || row.listingUrl,
      listingUrl: row.listingUrl,
      pickupCity,
      deliveryCity,
      revenue,
      quoteCount: row.quotes,
      postedMinutesAgo: parsePosted(row.date),
      description: row.title,
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
  } else if (rows.length === 0) {
    note = `Opened ${page.url()} but found no Shiply listing table.`;
  } else if (jobs.length === 0) {
    note = `Read ${rows.length} listings; ${mapped} mapped to the city book, none had a readable budget.`;
  }

  console.log(
    `[shiply] url=${page.url()} rows=${rows.length} mapped=${mapped} jobs=${jobs.length} auth=${auth.hint}`,
  );

  return { jobs, listingCount: rows.length, note };
}
