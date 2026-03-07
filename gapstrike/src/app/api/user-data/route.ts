import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getGithubUserId } from "@/lib/auth";

// GET — return all key-value pairs for the authenticated user
export async function GET(request: NextRequest) {
  const userId = await getGithubUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_data")
    .select("key, value")
    .eq("user_id", userId);

  if (error) {
    console.error("user_data GET error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map: Record<string, unknown> = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  return NextResponse.json({ data: map });
}

// PUT — upsert a single key-value pair
export async function PUT(request: NextRequest) {
  const userId = await getGithubUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { key, value } = await request.json();
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { error } = await supabase.from("user_data").upsert(
    {
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );

  if (error) {
    console.error("user_data PUT error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a single key
export async function DELETE(request: NextRequest) {
  const userId = await getGithubUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { key } = await request.json();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_data")
    .delete()
    .eq("user_id", userId)
    .eq("key", key);

  if (error) {
    console.error("user_data DELETE error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
