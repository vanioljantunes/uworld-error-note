import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";
import { getGithubUserId } from "@/lib/auth";

// POST — reset one template to its default content
export async function POST(request: NextRequest) {
  const userId = await getGithubUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await request.json();
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const defaultTemplate = TEMPLATE_DEFAULTS.find((t) => t.slug === slug);
  if (!defaultTemplate) {
    return NextResponse.json({ error: `Unknown template: ${slug}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("templates")
    .update({
      content: defaultTemplate.content,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    console.error("Supabase reset error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
