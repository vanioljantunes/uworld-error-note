import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
    try {
        const { vaultPath, notePath, content } = await request.json();
        if (!vaultPath || !notePath || content === undefined) {
            return NextResponse.json(
                { success: false, error: "Missing vaultPath, notePath, or content" },
                { status: 400 }
            );
        }
        const fullPath = path.join(vaultPath, notePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf-8");
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || "Unknown error" },
            { status: 500 }
        );
    }
}
