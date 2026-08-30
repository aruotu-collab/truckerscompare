import { NextResponse } from "next/server";

type Point = { id: string; lat: number; lng: number };

export async function POST(request: Request) {
  let points: Point[] = [];
  try {
    const body = (await request.json()) as { points?: Point[] };
    points = Array.isArray(body.points) ? body.points : [];
  } catch {
    return NextResponse.json({ error: "Need a list of places." }, { status: 400 });
  }

  if (points.length < 2 || points.length > 40) {
    return NextResponse.json({ error: "Need 2 to 40 places." }, { status: 400 });
  }
  if (
    points.some(
      (point) =>
        !point?.id ||
        typeof point.lat !== "number" ||
        typeof point.lng !== "number" ||
        !Number.isFinite(point.lat) ||
        !Number.isFinite(point.lng),
    )
  ) {
    return NextResponse.json({ error: "Each place needs a map point." }, { status: 400 });
  }

  const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance,duration`;
  const res = await fetch(url, { headers: { "User-Agent": "TruckersCompare/1.0" } });
  if (!res.ok) {
    return NextResponse.json({ error: "Could not read road miles." }, { status: 502 });
  }
  const data = (await res.json()) as {
    code?: string;
    distances?: number[][];
    durations?: number[][];
  };
  if (data.code !== "Ok" || !data.distances || !data.durations) {
    return NextResponse.json({ error: "Could not read road miles." }, { status: 502 });
  }

  const pairs: { from: string; to: string; miles: number; minutes: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      const metres = data.distances[i]?.[j];
      const seconds = data.durations[i]?.[j];
      if (typeof metres !== "number" || typeof seconds !== "number") continue;
      pairs.push({
        from: points[i]!.id,
        to: points[j]!.id,
        miles: i === j ? 4 : Math.round((metres / 1609.344) * 10) / 10,
        minutes: i === j ? 12 : Math.max(8, Math.round(seconds / 60)),
      });
    }
  }

  return NextResponse.json({ pairs });
}
