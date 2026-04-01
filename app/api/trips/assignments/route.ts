const GONE_MSG = "Este módulo fue discontinuado. Los inspectores usan todos los checklists activos.";

export async function GET() {
  return Response.json({ ok: false, message: GONE_MSG }, { status: 410 });
}

export async function PATCH() {
  return Response.json({ ok: false, message: GONE_MSG }, { status: 410 });
}
