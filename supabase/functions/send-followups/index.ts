import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();

  const { data: users, error } = await supabase
    .from("members")
    .select("*")
    .lt("created_at", cutoff)
    .eq("followup_sent", false);

  if (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }

  for (const user of users) {
    await resend.emails.send({
      from: "Tax the Church <hello@taxthe.church>",
      reply_to: "hello@taxthe.church",
      to: user.email,
      subject: "Why this matters",

      text: `Hi ${user.name || "there"},

You signed up recently because something about this didn't sit right.

Everyday Australians pay their share.
Some institutions don't.

That gap is growing - and it's being carried by workers, families, and small businesses.

If you agree, help this grow:
https://taxthe.church

- Tax the Church`,

      html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto;">
        <p>Hi ${user.name || "there"},</p>

        <p>You signed up recently because something about this didn't sit right.</p>

        <p><strong>Everyday Australians pay their share.<br>Some institutions don't.</strong></p>

        <p>
          That gap is growing - and it's being carried by workers, families, and small businesses.
        </p>

        <p>
          <a href="https://taxthe.church">Help this grow</a>
        </p>

        <p>- Tax the Church</p>
      </div>
      `
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (!user.day7_sent && new Date(user.created_at) < sevenDaysAgo) {
      await resend.emails.send({
        from: "Tax the Church <hello@taxthe.church>",
        reply_to: "hello@taxthe.church",
        to: user.email,
        subject: "Most people won't share this",
        text: `Hi ${user.name || "there"},

Most people who read this won't share it.

Not because they disagree -
but because it's easier to ignore.

Meanwhile, nothing changes.

Everyday Australians keep paying their share.
Some institutions still don't.

That only continues because people stay quiet.

If you think that's wrong, prove it.

Send this to one person:
https://taxthe.church

That's all it takes to start shifting things.

- Tax the Church`,
        html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto; line-height: 1.6;">
        <h2>Most people won't share this</h2>

        <p>Hi ${user.name || "there"},</p>

        <p>Most people who read this won't share it.</p>

        <p>Not because they disagree - but because it's easier to ignore.</p>

        <p><strong>Meanwhile, nothing changes.</strong></p>

        <p>
          Everyday Australians pay their share.<br>
          <strong>Some institutions still don't.</strong>
        </p>

        <p>That only continues because people stay quiet.</p>

        <p><strong>If you think that's wrong, prove it.</strong></p>

        <p>
          <a href="https://taxthe.church" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
            Send this to one person
          </a>
        </p>

        <p>- Tax the Church</p>
      </div>
      `,
      });

      await supabase.from("members").update({ day7_sent: true }).eq("id", user.id);
    }

    await supabase.from("members").update({ followup_sent: true }).eq("id", user.id);
  }

  return new Response(JSON.stringify({ sent: users.length }), { status: 200 });
});


