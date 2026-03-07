import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
    try {
        const { vaultPath, notePath } = await req.json();

        if (!vaultPath || !notePath) {
            return NextResponse.json(
                { error: "Missing vaultPath or notePath" },
                { status: 400 }
            );
        }

        const fullPath = path.join(vaultPath, notePath);

        // Security: ensure the resolved path is inside the vault
        const resolvedVault = path.resolve(vaultPath);
        const resolvedFile = path.resolve(fullPath);
        if (!resolvedFile.startsWith(resolvedVault)) {
            return NextResponse.json(
                { error: "Path traversal not allowed" },
                { status: 403 }
            );
        }

        if (!fs.existsSync(resolvedFile)) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        const content = fs.readFileSync(resolvedFile, "utf-8");
        return NextResponse.json({ content });
    } catch (error) {
        console.error("Read note error:", error);
        return NextResponse.json(
            { error: "Failed to read note" },
            { status: 500 }
        );
    }
}
