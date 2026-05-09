import { NextResponse } from "next/server";
import { getPublishedVillageById } from "@/lib/data";

type VillageSuccessResponse = {
  ok: true;
  data: {
    source: "supabase" | "mock";
    item: NonNullable<Awaited<ReturnType<typeof getPublishedVillageById>>["village"]>;
  };
};

type VillageErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type VillageRouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: VillageRouteContext) {
  try {
    const id = context.params.id?.trim();
    if (!id) {
      const badRequestResponse: VillageErrorResponse = {
        ok: false,
        error: {
          code: "INVALID_VILLAGE_ID",
          message: "Missing village id."
        }
      };

      return NextResponse.json(badRequestResponse, { status: 400 });
    }

    const result = await getPublishedVillageById(id);
    if (!result.village) {
      const notFoundResponse: VillageErrorResponse = {
        ok: false,
        error: {
          code: "VILLAGE_NOT_FOUND",
          message: "Village does not exist or is not published."
        }
      };

      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    const successResponse: VillageSuccessResponse = {
      ok: true,
      data: {
        source: result.source,
        item: result.village
      }
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch {
    const failResponse: VillageErrorResponse = {
      ok: false,
      error: {
        code: "VILLAGE_FETCH_FAILED",
        message: "Failed to load village detail."
      }
    };

    return NextResponse.json(failResponse, { status: 500 });
  }
}
