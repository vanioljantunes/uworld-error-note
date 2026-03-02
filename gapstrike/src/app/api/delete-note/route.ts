import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const { vaultPath, notePath } = await request.json();
    if (!vaultPath || !notePath) {
      return NextResponse.json({ success: false, error: "Missing vaultPath or notePath" }, { status: 400 });
    }
    const fullPath = path.join(vaultPath, notePath);
    fs.unlinkSync(fullPath);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
  }
}
