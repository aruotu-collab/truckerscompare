import { CITIES, roadMiles } from "./geo";
import type { JobSource, RawJob, VehicleType } from "./types";

const NEAR_MANCHESTER = [
  "Manchester",
  "Liverpool",
  "Preston",
  "Leeds",
  "Stoke",
  "Sheffield",
  "Birmingham",
  "Walsall",
  "Wolverhampton",
  "Derby",
  "Nottingham",
];

const CATEGORIES = [
  "Palletised goods",
  "Vehicle transport",
  "Furniture",
  "Machinery",
  "Building materials",
  "Steel",
  "Exhibition",
  "White goods",
  "Parcels",
  "Plant",
] as const;

const SOURCES: JobSource[] = [
  "Shiply",
  "Shiply",
  "Shiply",
  "uShip",
  "Courier Exchange",
  "Returnloads",
];

const VEHICLES: VehicleType[] = [
  "van",
  "luton",
  "luton",
  "7.5t",
  "7.5t",
  "7.5t",
  "18t",
  "artic",
  "car_transporter",
];

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

/** Hand-built jobs so winners and combinations are obviously real. */
function heroJobs(): RawJob[] {
  return [
    {
      id: "hero-mcr-bhx",
      source: "Shiply",
      pickupCity: "Manchester",
      deliveryCity: "Birmingham",
      category: "Palletised goods",
      vehicleRequired: "7.5t",
      revenue: 490,
      highestBid: 620,
      weightKg: 1800,
      collectionWindow: "Today 14:00–18:00",
      deliveryWindow: "Today by 22:00",
      postedMinutesAgo: 18,
      quoteCount: 2,
      description:
        "8 pallets of packaged hardware. Tail-lift helpful. Easy access industrial estate both ends.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-bhx-ldn",
      source: "Shiply",
      pickupCity: "Birmingham",
      deliveryCity: "London",
      category: "Vehicle transport",
      vehicleRequired: "car_transporter",
      revenue: 680,
      highestBid: 845,
      weightKg: 1600,
      collectionWindow: "Tomorrow 07:00–10:00",
      deliveryWindow: "Tomorrow by 16:00",
      postedMinutesAgo: 41,
      quoteCount: 4,
      description:
        "Saloon car, running, no modifications. Collection from dealer forecourt.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-cov-gla",
      source: "Courier Exchange",
      pickupCity: "Coventry",
      deliveryCity: "Glasgow",
      category: "Machinery",
      vehicleRequired: "18t",
      revenue: 980,
      weightKg: 4200,
      collectionWindow: "Tomorrow 08:00–12:00",
      deliveryWindow: "Tomorrow by 20:00",
      postedMinutesAgo: 95,
      quoteCount: 7,
      description:
        "CNC bed on pallet, forklift both ends. Booking-in required at Glasgow.",
      loadingMinutesKnown: false,
    },
    {
      id: "hero-wol-not",
      source: "Shiply",
      pickupCity: "Wolverhampton",
      deliveryCity: "Nottingham",
      category: "White goods",
      vehicleRequired: "luton",
      revenue: 340,
      weightKg: 620,
      collectionWindow: "Today 11:00–15:00",
      deliveryWindow: "Today by 18:00",
      postedMinutesAgo: 7,
      quoteCount: 1,
      description:
        "Four washing machines, boxed. Ground floor to ground floor.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-sol-brs",
      source: "Returnloads",
      pickupCity: "Solihull",
      deliveryCity: "Bristol",
      category: "Palletised goods",
      vehicleRequired: "7.5t",
      revenue: 410,
      weightKg: 1400,
      collectionWindow: "Today 15:00–19:00",
      deliveryWindow: "Tomorrow 08:00–12:00",
      postedMinutesAgo: 33,
      quoteCount: 3,
      description: "6 pallets retail stock. Timed delivery slot in Avonmouth.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-ldn-cov",
      source: "uShip",
      pickupCity: "London",
      deliveryCity: "Coventry",
      category: "Furniture",
      vehicleRequired: "luton",
      revenue: 390,
      weightKg: 480,
      collectionWindow: "Tomorrow 12:00–16:00",
      deliveryWindow: "Tomorrow by 20:00",
      postedMinutesAgo: 22,
      quoteCount: 2,
      description:
        "Flat-pack furniture for a new showroom. Two helpers on site at delivery.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-ldn-mcr",
      source: "Shiply",
      pickupCity: "London",
      deliveryCity: "Manchester",
      category: "Exhibition",
      vehicleRequired: "7.5t",
      revenue: 720,
      weightKg: 1100,
      collectionWindow: "Tomorrow 06:00–09:00",
      deliveryWindow: "Tomorrow by 15:00",
      postedMinutesAgo: 64,
      quoteCount: 9,
      description:
        "Exhibition crates. Early dock booking. Tight morning collection.",
      loadingMinutesKnown: false,
    },
    {
      id: "hero-stk-bhx",
      source: "Shiply",
      pickupCity: "Stoke",
      deliveryCity: "Birmingham",
      category: "Steel",
      vehicleRequired: "18t",
      revenue: 280,
      weightKg: 5100,
      collectionWindow: "Today 13:00–17:00",
      deliveryWindow: "Today by 20:00",
      postedMinutesAgo: 12,
      quoteCount: 1,
      description:
        "Bundle of boxed fittings. Earn while closing the gap back to Birmingham.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-mcr-lds",
      source: "Courier Exchange",
      pickupCity: "Manchester",
      deliveryCity: "Leeds",
      category: "Palletised goods",
      vehicleRequired: "7.5t",
      revenue: 260,
      weightKg: 900,
      collectionWindow: "Today 12:00–16:00",
      deliveryWindow: "Today by 19:00",
      postedMinutesAgo: 4,
      quoteCount: 2,
      description: "3 pallets, same-day. Low dead miles from current position.",
      loadingMinutesKnown: true,
    },
    {
      id: "hero-liv-mcr",
      source: "Returnloads",
      pickupCity: "Liverpool",
      deliveryCity: "Manchester",
      category: "Parcels",
      vehicleRequired: "van",
      revenue: 190,
      weightKg: 240,
      collectionWindow: "Today 16:00–19:00",
      deliveryWindow: "Today by 21:00",
      postedMinutesAgo: 9,
      quoteCount: 5,
      description: "Mixed parcels. Could work as a short hop if already nearby.",
      loadingMinutesKnown: true,
    },
  ];
}

export function generateDemoJobs(): RawJob[] {
  const rand = mulberry32(20260830);
  const heroes = heroJobs();
  const generated: RawJob[] = [];
  const cityNames = CITIES.map((c) => c.name);

  for (let i = 0; i < 90; i++) {
    const pickup =
      rand() < 0.42 ? pick(rand, NEAR_MANCHESTER) : pick(rand, cityNames);
    let delivery = pick(rand, cityNames);
    let guard = 0;
    while (delivery === pickup && guard < 8) {
      delivery = pick(rand, cityNames);
      guard += 1;
    }

    const vehicle = pick(rand, VEHICLES);
    const category =
      vehicle === "car_transporter"
        ? "Vehicle transport"
        : pick(rand, CATEGORIES);

    const loaded = roadMiles(pickup, delivery);
    const rate = loaded < 55 ? between(rand, 1.55, 2.85) : between(rand, 1.15, 2.15);
    const revenue = Math.round(loaded * rate + between(rand, 35, 95));

    generated.push({
      id: `job-${1000 + i}`,
      source: pick(rand, SOURCES),
      pickupCity: pickup,
      deliveryCity: delivery,
      category,
      vehicleRequired: vehicle,
      revenue,
      weightKg: rand() < 0.18 ? null : Math.round(between(rand, 180, 6200)),
      collectionWindow: rand() < 0.45 ? "Today 10:00–18:00" : "Tomorrow 08:00–16:00",
      deliveryWindow: rand() < 0.5 ? "Same day" : "Next day by 18:00",
      postedMinutesAgo: Math.round(between(rand, 3, 720)),
      quoteCount: Math.round(between(rand, 0, 14)),
      description: `${category} from ${pickup} to ${delivery}. ${
        rand() < 0.3 ? "Access may be tight at delivery." : "Standard commercial collection."
      }`,
      loadingMinutesKnown: rand() > 0.35,
    });
  }

  return [...heroes, ...generated];
}
