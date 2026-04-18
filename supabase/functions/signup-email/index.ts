import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { email, first_name } = await req.json();

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Campaign <noreply@yourdomain.com>",
      to: email,
      subject: "You're in.",
      html: `
        <h2>You're in.</h2>
        <p>Hi ${first_name},</p>
        <p>Thanks for joining the movement to put fair taxation on the NSW agenda.</p>
        <p>We’ll keep you updated with real policy, real data, and ways to take action.</p>
      `
    })
  });

  return new Response(await res.text(), { status: 200 });
});
