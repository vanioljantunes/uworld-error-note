import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";
import { getGithubUserId } from "@/lib/auth";

function buildDefaults() {
  return TEMPLATE_DEFAULTS.map((t, i) => ({
    id: String(i + 1),
    slug: t.slug,
    category: t.category,
    title: t.title,
    content: t.content,
    updated_at: new Date().toISOString(),
  }));
}

// GET — return all templates for user (seed defaults if empty)
export async function GET(request: NextRequest) {
  try {
    const defaultTemplates = buildDefaults();

    const userId = await getGithubUserId(request);
    if (!userId) {
      return NextResponse.json({ templates: defaultTemplates, source: "defaults" });
    }

    // Check if user has templates in Supabase
    let { data: templates, error } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .order("category")
      .order("slug");

    if (error) {
      console.error("Supabase templates fetch error:", error.message);
      return NextResponse.json({ templates: defaultTemplates, source: "defaults", dbError: error.message });
    }

    // Seed missing defaults (handles both new users and existing users missing new templates)
    if (!templates || templates.length === 0) {
      const rows = TEMPLATE_DEFAULTS.map((t) => ({
        user_id: userId,
        slug: t.slug,
        category: t.category,
        title: t.title,
        content: t.content,
      }));

      const { error: insertError } = await supabase
        .from("templates")
        .insert(rows);

      if (insertError) {
        console.error("Supabase seed error:", insertError.message);
        return NextResponse.json({ templates: defaultTemplates, source: "defaults", dbError: insertError.message });
      }

      // Re-fetch after seeding
      const { data: seeded } = await supabase
        .from("templates")
        .select("*")
        .eq("user_id", userId)
        .order("category")
        .order("slug");

      templates = seeded;
    }

    // Sync templates: seed missing defaults + remove deprecated slugs
    if (templates && templates.length > 0) {
      const validSlugs = new Set(TEMPLATE_DEFAULTS.map((d) => d.slug));
      const existingSlugs = new Set(templates.map((t: any) => t.slug));

      console.log("[Templates] Valid slugs:", [...validSlugs]);
      console.log("[Templates] Existing slugs:", [...existingSlugs]);

      // Remove templates whose slugs are no longer in defaults
      const deprecated = templates.filter((t: any) => !validSlugs.has(t.slug));
      if (deprecated.length > 0) {
        const deprecatedSlugs = deprecated.map((t: any) => t.slug);
        console.log("[Templates] Deleting deprecated:", deprecatedSlugs);
        const { error: delErr } = await supabase
          .from("templates")
          .delete()
          .eq("user_id", userId)
          .in("slug", deprecatedSlugs);
        if (delErr) console.error("[Templates] Delete error:", delErr.message);
      }

      // Seed any missing defaults (e.g. new template types added)
      const missing = TEMPLATE_DEFAULTS.filter((d) => !existingSlugs.has(d.slug));
      if (missing.length > 0) {
        console.log("[Templates] Seeding missing:", missing.map((m) => m.slug));
        const rows = missing.map((t) => ({
          user_id: userId,
          slug: t.slug,
          category: t.category,
          title: t.title,
          content: t.content,
        }));
        const { error: insErr } = await supabase.from("templates").insert(rows);
        if (insErr) console.error("[Templates] Insert error:", insErr.message);
      }

      // Re-fetch if anything changed
      if (deprecated.length > 0 || missing.length > 0) {
        const { data: updated } = await supabase
          .from("templates")
          .select("*")
          .eq("user_id", userId)
          .order("category")
          .order("slug");
        if (updated) templates = updated;
      }
    }

    return NextResponse.json({ templates, source: "supabase" });
  } catch (err) {
    console.error("Templates GET unhandled error:", err);
    return NextResponse.json({ templates: buildDefaults(), source: "defaults", dbError: String(err) });
  }
}

// PUT — update one template by slug
export async function PUT(request: NextRequest) {
  try {
    const userId = await getGithubUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { slug, content } = await request.json();
    if (!slug || typeof content !== "string") {
      return NextResponse.json({ error: "slug and content required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("templates")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("slug", slug)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (err) {
    console.error("Templates PUT unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
