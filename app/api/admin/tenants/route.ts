import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import { requireAdminSession } from "@/lib/server/auth-next";
import { isSuperAdmin } from "@/lib/roles";
import { ensureGeneralTenant, generateTenantCode, normalizeTenantCode } from "@/lib/tenants";
import Tenant from "@/models/Tenant";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Solo super admin puede gestionar tenants" }, { status: 403 });
  }

  await connectToDatabase();
  try {
    await ensureGeneralTenant();

    const tenants = await Tenant.find({ isDelete: { $ne: true } }).sort({ createdAt: 1 }).lean();
    const counts = await User.aggregate([
      { $match: { isDelete: { $ne: true } } },
      { $group: { _id: "$tenantId", usersCount: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(
      counts.map((item) => [String(item?._id || "general").trim() || "general", Number(item?.usersCount || 0)]),
    );

    return NextResponse.json({
      tenants: tenants.map((tenant: any) => ({
        ...tenant,
        usersCount: countMap.get(String(tenant.code)) || 0,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al listar tenants: ${String(e.message)}` : "Error al listar tenants" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Solo super admin puede crear tenants" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const code = normalizeTenantCode(body?.code ?? generateTenantCode(name));

  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Codigo requerido" }, { status: 400 });
  }

  await connectToDatabase();
  try {
    await ensureGeneralTenant();

    const existing = await Tenant.findOne({ code }).lean();
    if (existing && existing.isDelete !== true) {
      return NextResponse.json({ error: "El codigo del tenant ya existe" }, { status: 409 });
    }
    if (existing && existing.isDelete === true) {
      return NextResponse.json({ error: "El codigo del tenant ya existe y esta reservado" }, { status: 409 });
    }

    const tenant = await Tenant.create({
      name,
      code,
      isActive: true,
      isDelete: false,
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al crear tenant: ${String(e.message)}` : "Error al crear tenant" },
      { status: 500 },
    );
  }
}
