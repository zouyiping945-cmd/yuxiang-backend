import { NextResponse } from "next/server";

function toNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lng = toNumber(url.searchParams.get("lng"));
  const lat = toNumber(url.searchParams.get("lat"));
  const name = url.searchParams.get("name")?.trim() || "目的地";
  const key = process.env.AMAP_WEB_SERVICE_KEY?.trim() || process.env.AMAP_KEY?.trim();

  if (!key || typeof lng !== "number" || typeof lat !== "number") {
    return NextResponse.json(
      { ok: false, error: "MAP_PREVIEW_UNAVAILABLE" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams();
  params.set("location", `${lng},${lat}`);
  params.set("zoom", "13");
  params.set("size", "520*220");
  params.set("markers", `mid,,A:${lng},${lat}`);
  params.set("labels", `${name},2,0,16,0xFFFFFF,0x6F8D50:${lng},${lat}`);
  params.set("key", key);

  try {
    const response = await fetch(`https://restapi.amap.com/v3/staticmap?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "AMAP_STATIC_MAP_FAILED" },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=600"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "MAP_PREVIEW_REQUEST_FAILED" },
      { status: 502 }
    );
  }
}
