import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";

// GET — return all templates for authenticated user (seed if empty)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  // Check if user already has templates
  let { data: templates, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", user.id)
    .order("category")
    .order("slug");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed defaults if user has no templates
  if (!templates || templates.length === 0) {
    const rows = TEMPLATE_DEFAULTS.map((t) => ({
      user_id: user.id,
      slug: t.slug,
      category: t.category,
      title: t.title,
      content: t.content,
    }));

    const { error: insertError } = await supabase
      .from("templates")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Re-fetch after insert
    const { data: seeded } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", user.id)
      .order("category")
      .order("slug");

    templates = seeded;
  }

  // Sync: remove deprecated slugs + seed missing defaults
  if (templates && templates.length > 0) {
    const validSlugs = new Set(TEMPLATE_DEFAULTS.map((d) => d.slug));
    const existingSlugs = new Set(templates.map((t: any) => t.slug));

    const deprecated = templates.filter((t: any) => !validSlugs.has(t.slug));
    if (deprecated.length > 0) {
      await supabase
        .from("templates")
        .delete()
        .eq("user_id", user.id)
        .in("slug", deprecated.map((t: any) => t.slug));
    }

    const missing = TEMPLATE_DEFAULTS.filter((d) => !existingSlugs.has(d.slug));
    if (missing.length > 0) {
      await supabase.from("templates").insert(
        missing.map((t) => ({
          user_id: user.id,
          slug: t.slug,
          category: t.category,
          title: t.title,
          content: t.content,
        }))
      );
    }

    if (deprecated.length > 0 || missing.length > 0) {
      const { data: updated } = await supabase
        .from("templates")
        .select("*")
        .eq("user_id", user.id)
        .order("category")
        .order("slug");
      if (updated) templates = updated;
    }
  }

  return NextResponse.json({ templates });
}

// PUT — update one template by slug
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  const body = await request.json();
  const { slug, content } = body;

  if (!slug || typeof content !== "string") {
    return NextResponse.json(
      { error: "slug and content are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("templates")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
