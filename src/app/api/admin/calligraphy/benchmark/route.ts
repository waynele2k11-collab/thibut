import { NextResponse } from "next/server";
import { CalligraphyBenchmarkSuite } from "@/lib/calligraphy/CalligraphyBenchmarkSuite";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const samplesPerCase = body.samplesPerCase || 20;

    console.log(`[Admin Benchmark] Running calligraphy benchmark suite with ${samplesPerCase} samples per case...`);
    const results = await CalligraphyBenchmarkSuite.runAll(samplesPerCase);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("[Admin Benchmark Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to execute benchmark suite" }, { status: 500 });
  }
}
