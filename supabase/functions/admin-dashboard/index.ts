import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "Missing PROJECT_URL or SERVICE_ROLE_KEY secrets",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("members")
    .select("first_name,email,postcode,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = Array.isArray(data) ? data : [];
  const total = rows.length;
  const todayDate = new Date().toISOString().slice(0, 10);
  const today = rows.filter((r) =>
    String(r.created_at || "").slice(0, 10) >= todayDate
  ).length;

  const postcodeCounts: Record<string, number> = {};
  for (const row of rows) {
    const postcode = String(row.postcode || "").trim();
    if (!postcode) continue;
    postcodeCounts[postcode] = (postcodeCounts[postcode] || 0) + 1;
  }

  const sortedPostcodes = Object.entries(postcodeCounts).sort((a, b) => b[1] - a[1]);
  const topPostcode = sortedPostcodes.length
    ? { postcode: sortedPostcodes[0][0], count: sortedPostcodes[0][1] }
    : null;

  return new Response(
    JSON.stringify({
      ok: true,
      total,
      today,
      topPostcode,
      postcodeCounts,
      members: rows,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

