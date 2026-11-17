import { NextResponse } from "next/server";
import {
  BenchmarkRequestSchema,
  CalligraphyBenchmarkSuite,
} from "@/lib/calligraphy/CalligraphyBenchmarkSuite";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export async function POST(req: Request) {
  try {
    await assertAdminApi();

    const rawBody: unknown = await req.json().catch(() => ({}));
    const parsed = BenchmarkRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid benchmark request parameters",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { samplesPerCase } = parsed.data;
    const results = await CalligraphyBenchmarkSuite.runAll(samplesPerCase);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      samplesPerCase,
      results,
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error(
      "[Admin Benchmark Error]:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to execute benchmark suite" },
      { status: 500 }
    );
  }
}
