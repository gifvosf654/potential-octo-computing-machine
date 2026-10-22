import { sendSmtpMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    accountId?: number;
    to?: string;
    subject?: string;
    body?: string;
  };

  const to = (body.to || "").trim();
  const accountId = Number(body.accountId);
  if (!Number.isFinite(accountId)) {
    return Response.json({ error: "Choose an account to send from." }, { status: 400 });
  }
  if (!to || !to.includes("@")) {
    return Response.json({ error: "Enter a valid recipient." }, { status: 400 });
  }

  try {
    const result = await sendSmtpMail({
      accountId,
      to,
      subject: (body.subject || "").trim() || "(No subject)",
      body: body.body || "",
    });
    return Response.json({ ok: true, warning: result.warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
