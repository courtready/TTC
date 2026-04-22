import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    console.log("FUNCTION HIT");
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const payload = await req.json();
    const record = payload?.record ?? {};
    const email = String(record.email || payload?.email || "").trim();
    const firstName = String(record.first_name || payload?.first_name || payload?.name || "").trim();

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "Missing email" }), { status: 400 });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Tax the Church <updates@taxthe.church>";
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }), { status: 500 });
    }

    const html = `
  <div style="font-family: Arial; max-width: 600px; margin: auto; line-height: 1.6;">
    <h2>You're in. ✊</h2>

    <p>Hi ${firstName || "there"},</p>

    <p>
      Thanks for joining. You're now part of a growing movement pushing for one simple idea:
      if you operate in Australia, you should pay your fair share of tax.
    </p>

    <p>
      For too long, large institutions have operated outside the system while everyday Australians carry the load.
      That's not sustainable — and it's not fair.
    </p>

    <p>
      We're building momentum ahead of the NSW election. Every new supporter strengthens the case for change.
    </p>

    <p>
      <strong>If you know someone who feels the same, forward this email or send them here:</strong><br>
      <a href="https://taxthe.church" style="color:#6c2bd9;">https://taxthe.church</a>
    </p>

    <p>
      We'll keep you updated with what's happening, what matters, and when it's time to act.
    </p>

    <p>
      — Tax the Church
    </p>
  </div>
`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "You’re in — Tax the Church",
        html,
      }),
    });

    const resendJson = await resendResp.json();
    if (!resendResp.ok) {
      return new Response(JSON.stringify({ ok: false, resend: resendJson }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, resend: resendJson }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});




