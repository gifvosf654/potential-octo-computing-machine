import { syncImapAccount } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return Response.json({ error: "Invalid account." }, { status: 400 });
  }

  try {
    const result = await syncImapAccount(accountId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
