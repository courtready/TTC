import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const raw = await req.json();

    // NORMALISE INPUT
    const data = {
      full_name: raw.name?.trim(),
      email: raw.email?.toLowerCase().trim(),
      mobile: raw.mobile || null,
      address: raw.address?.trim(),
      suburb: raw.suburb?.trim(),
      state: raw.state?.trim(),
      postcode: raw.postcode?.trim(),
      dob: raw.dob,
      enrolled: raw.enrolled === "on" || raw.enrolled === true,
      declaration: raw.declaration === "on" || raw.declaration === true
    };

    // BASIC VALIDATION
    if (!data.full_name || !data.email || !data.address || !data.suburb || !data.state || !data.postcode || !data.dob) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    if (!data.enrolled || !data.declaration) {
      return new Response(JSON.stringify({ error: "Declarations required" }), { status: 400 });
    }

    // INSERT (dedupe handled by DB constraint if added later)
    const { error } = await supabase.from("supporters").insert(data);

    if (error) {
      return new Response(JSON.stringify(error), { status: 500 });
    }

    // EMAIL CONFIRMATION
    await resend.emails.send({
      from: "Tax the Church <hello@taxthe.church>",
      to: data.email,
      subject: "Supporter registration received",

      text: `Hi ${data.full_name || "there"},

Your supporter registration has been received.

We may contact you if required as part of the political party registration process.

- Tax the Church`,

      html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto;">
        <h2>Supporter registration received</h2>

        <p>Hi ${data.full_name || "there"},</p>

        <p>Your supporter registration has been recorded.</p>

        <p>
          This information may be used as part of a political party registration application.
        </p>

        <p>- Tax the Church</p>
      </div>
      `
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
});
