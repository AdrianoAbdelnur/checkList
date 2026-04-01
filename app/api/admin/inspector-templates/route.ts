import { NextRequest, NextResponse } from "next/server";

const GONE_MSG = "Este módulo fue discontinuado. Los inspectores usan todos los checklists activos.";

export async function GET(_: NextRequest) {
  return NextResponse.json({ error: GONE_MSG }, { status: 410 });
}

export async function PATCH(_: NextRequest) {
  return NextResponse.json({ error: GONE_MSG }, { status: 410 });
}
