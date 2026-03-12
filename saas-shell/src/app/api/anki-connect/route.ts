import { NextRequest, NextResponse } from "next/server";

const ANKI_CONNECT_URL = "http://localhost:8765";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const resp = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "AnkiConnect unreachable" },
      { status: 502 }
    );
  }
}
