import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  projectId: string;
  changeType: "rotated" | "revoked";
  newShareUrl?: string; // required when rotated
  senderName?: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

const buildEmail = (opts: {
  changeType: "rotated" | "revoked";
  videoTitle: string;
  senderName: string;
  newShareUrl?: string;
}) => {
  const { changeType, videoTitle, senderName, newShareUrl } = opts;
  const title = escapeHtml(videoTitle);
  const from = escapeHtml(senderName || "The project owner");

  if (changeType === "revoked") {
    return {
      subject: `Access revoked: ${videoTitle}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
          <h1 style="font-size:22px;margin:0 0 12px">Your access has been revoked</h1>
          <p>${from} has revoked shared access to <strong>${title}</strong>.</p>
          <p style="color:#6b7280">The previous share link no longer works. If you believe this was a mistake, reach out to the person who shared it with you.</p>
        </div>`,
    };
  }

  const safeUrl = escapeHtml(newShareUrl ?? "");
  return {
    subject: `Updated share link: ${videoTitle}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <h1 style="font-size:22px;margin:0 0 12px">The share link has been updated</h1>
        <p>${from} rotated the share link for <strong>${title}</strong>. The previous link has been invalidated.</p>
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open updated link</a>
        </p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all">${safeUrl}</p>
      </div>`,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as NotifyRequest;
    if (!body?.projectId || !body?.changeType) {
      return new Response(JSON.stringify({ error: "Missing projectId or changeType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.changeType === "rotated" && !body.newShareUrl) {
      return new Response(JSON.stringify({ error: "newShareUrl required for rotation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is the project owner
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("id, user_id, title")
      .eq("id", body.projectId)
      .maybeSingle();

    if (projectErr || !project || project.user_id !== userRes.user.id) {
      return new Response(JSON.stringify({ error: "Project not found or not owned" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipients, error: recErr } = await admin
      .from("project_share_recipients")
      .select("id, recipient_email")
      .eq("project_id", body.projectId);

    if (recErr) throw recErr;

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ sent: 0, recipients: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildEmail({
      changeType: body.changeType,
      videoTitle: project.title ?? "Shared project",
      senderName: body.senderName ?? userRes.user.email ?? "",
      newShareUrl: body.newShareUrl,
    });

    let sent = 0;
    const errors: Array<{ email: string; error: string }> = [];
    for (const r of recipients) {
      try {
        await resend.emails.send({
          from: "MyStoryAI <onboarding@resend.dev>",
          to: [r.recipient_email],
          subject,
          html,
        });
        sent += 1;
      } catch (e: any) {
        console.error("notify-share-change send failed:", r.recipient_email, e?.message);
        errors.push({ email: r.recipient_email, error: e?.message ?? "unknown" });
      }
    }

    await admin
      .from("project_share_recipients")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("project_id", body.projectId);

    // If revoked, clear the recipient list — they no longer have access.
    if (body.changeType === "revoked") {
      await admin
        .from("project_share_recipients")
        .delete()
        .eq("project_id", body.projectId);
    }

    return new Response(
      JSON.stringify({ sent, recipients: recipients.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-share-change error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
