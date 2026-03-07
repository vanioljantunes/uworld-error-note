import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";

// POST — reset one template to its default content
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  const body = await request.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json(
      { error: "slug is required" },
      { status: 400 }
    );
  }

  const defaultTemplate = TEMPLATE_DEFAULTS.find((t) => t.slug === slug);
  if (!defaultTemplate) {
    return NextResponse.json(
      { error: `Unknown template slug: ${slug}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("templates")
    .update({
      content: defaultTemplate.content,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
