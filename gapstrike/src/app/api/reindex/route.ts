import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Re-index is triggered implicitly by creating a new search
    // In a future version, this could maintain a persistent index
    // For now, it's just a confirmation endpoint
    return NextResponse.json(
      { success: true, message: "Re-index triggered. Next search will be fresh." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reindex error:", error);
    return NextResponse.json(
      { success: false, error: "Reindex failed" },
      { status: 500 }
    );
  }
}
