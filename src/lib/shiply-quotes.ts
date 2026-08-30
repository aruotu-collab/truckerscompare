export type ShiplyListingParse = {
  lowestBid: number;
  highestBid: number;
  quoteCount: number;
  title: string;
  collectionWindow: string;
  deliveryWindow: string;
  category: string;
  description: string;
  weightKg: number | null;
  snippet: string;
};

const SKIP_NAMES = new Set([
  "gbp",
  "net",
  "minimum",
  "place",
  "budget",
  "lowest",
  "current",
  "from",
  "up",
  "to",
  "the",
  "and",
]);

const NAMED_QUOTE =
  /£\s?([\d,]+(?:\.\d{1,2})?)\s+([A-Za-z][A-Za-z0-9_.-]{2,})/g;

function money(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function validBid(n: number): boolean {
  return Number.isFinite(n) && n >= 15 && n <= 20000;
}

export function htmlToVisibleText(html: string): string {
  return html
    .replace(/&pound;/gi, "£")
    .replace(/&#163;/g, "£")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namedQuotes(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(NAMED_QUOTE)) {
    if (SKIP_NAMES.has(match[2]!.toLowerCase())) continue;
    const amount = money(match[1]!);
    if (validBid(amount)) found.push(amount);
  }
  return found;
}

function quotesSection(text: string): string | null {
  const match = text.match(
    /(?:current quotes|lowest quote)([\s\S]{0,3000}?)(?:place quote|questions from transport|notify me if other)/i,
  );
  return match ? match[0] : null;
}

function labelledLowest(text: string): number {
  const match = text.match(/lowest\s+quote[^£]{0,48}£\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return 0;
  const amount = money(match[1]!);
  return validBid(amount) ? amount : 0;
}

function dateWindows(text: string): { collection: string; delivery: string } {
  const ranges = [
    ...text.matchAll(
      /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{4})/g,
    ),
  ];
  if (ranges.length >= 2) {
    return {
      collection: `${ranges[0]![1]} to ${ranges[0]![2]}`,
      delivery: `${ranges[1]![1]} to ${ranges[1]![2]}`,
    };
  }
  if (ranges.length === 1) {
    const window = `${ranges[0]![1]} to ${ranges[0]![2]}`;
    return { collection: window, delivery: window };
  }
  return { collection: "", delivery: "" };
}

function usableTitle(value: string): string {
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/dimensions and sometimes a photo|photo of the goods|include dimensions/i.test(t)) {
    return "";
  }
  return t;
}

function titleFrom(html: string, fallback: string): string {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (og?.[1]) {
    const fromOg = usableTitle(og[1].replace(/\s*[|\-–].*shiply.*/i, ""));
    if (fromOg) return fromOg;
  }
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (heading) {
    const fromH1 = usableTitle(
      heading[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
    );
    if (fromH1) return fromH1;
  }
  return usableTitle(fallback);
}

export function categoryFromTitle(title: string): string {
  if (/remov/i.test(title)) return "Removal";
  if (/pallet/i.test(title)) return "Palletised goods";
  if (/parcel/i.test(title)) return "Parcels";
  if (/furniture|sofa|chest|wardrobe/i.test(title)) return "Furniture";
  if (/car|vehicle/i.test(title)) return "Vehicle";
  if (/machinery|plant/i.test(title)) return "Machinery";
  return title.trim().slice(0, 40) || "General";
}

function decodeMeta(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&pound;/gi, "£")
    .replace(/\s+/g, " ")
    .trim();
}

export function weightFromText(text: string): number | null {
  const labelled = text.match(
    /(?:total\s+)?weight[^0-9]{0,28}(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:kg|kilos)/i,
  );
  if (!labelled) return null;
  const n = Number(labelled[1]!.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 5 && n <= 40000 ? Math.round(n) : null;
}

export function cargoNotes(html: string, title: string): string {
  const og = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  );
  const text = htmlToVisibleText(html);
  const section = text.match(
    /(?:item list|listing details|about this listing|shipment details|items to be (?:moved|transported|shipped)|what needs (?:to be )?transport(?:ed)?)[:\s]+(.{12,800}?)(?=current quotes|place quote|questions from transport|notify me if other|similar listings)/i,
  );
  const raw = (section?.[1] || (og?.[1] ? decodeMeta(og[1]) : ""))
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^get quotes to transport\s+/i, "")
    .replace(/\s+on shiply.*$/i, "")
    .replace(/\s+place (?:a )?quote.*$/i, "")
    .trim();
  if (!cleaned || cleaned.toLowerCase() === title.trim().toLowerCase()) return "";
  if (/dimensions and sometimes a photo|photo of the goods|include dimensions/i.test(cleaned)) {
    return "";
  }
  return cleaned.slice(0, 500);
}

export function cargoDescription(title: string, notes: string): string {
  const heading = title.replace(/\s+/g, " ").trim();
  const extra = notes.replace(/\s+/g, " ").trim();
  if (!heading) return extra;
  if (!extra) return heading;
  if (extra.toLowerCase().includes(heading.toLowerCase())) return extra;
  if (heading.toLowerCase().includes(extra.toLowerCase())) return heading;
  return `${heading}. ${extra}`;
}

export function listingParseIsComplete(parsed: ShiplyListingParse): boolean {
  return parsed.lowestBid > 0 && (parsed.quoteCount >= 2 || /lowest quote/i.test(parsed.snippet));
}

export function parseShiplyListing(
  html: string,
  fallbackTitle = "",
): ShiplyListingParse {
  const text = htmlToVisibleText(html);
  const section = quotesSection(text) ?? text;
  const liveSection = section.split(/declined, withdrawn/i)[0] ?? section;
  const named = namedQuotes(liveSection);
  const lowestLabel = labelledLowest(text);
  const lowestBid = lowestLabel || (named.length ? Math.min(...named) : 0);
  const highestBid = named.length ? Math.max(...named) : lowestBid;
  let quoteCount = named.length;
  if (quoteCount === 0 && lowestBid) {
    const counted = liveSection.match(/(\d+)\s+(?:live\s+)?quotes\b/i);
    quoteCount = counted ? Number(counted[1]) : 1;
  }
  const title = titleFrom(html, fallbackTitle);
  const windows = dateWindows(text);
  const notes = cargoNotes(html, title);
  return {
    lowestBid,
    highestBid,
    quoteCount,
    title,
    collectionWindow: windows.collection,
    deliveryWindow: windows.delivery,
    category: categoryFromTitle(title),
    description: cargoDescription(title, notes),
    weightKg: weightFromText(text),
    snippet: (quotesSection(text) ?? liveSection).slice(0, 220).trim(),
  };
}
