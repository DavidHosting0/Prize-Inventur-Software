/**
 * Upsert new permission codes onto ADMIN (and optionally other roles)
 * without wiping demo data.
 */
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "@prize/types";

const prisma = new PrismaClient();

async function main() {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }

  const admin = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!admin) throw new Error("ADMIN role missing — run seed first");

  const all = await prisma.permission.findMany();
  for (const p of all) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: admin.id, permissionId: p.id },
      },
      create: { roleId: admin.id, permissionId: p.id },
      update: {},
    });
  }

  // Warehouse / F&B managers get receiving
  for (const roleCode of ["WAREHOUSE_MANAGER", "FB_MANAGER"]) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;
    const codes = [
      "receiving.view",
      "receiving.create",
      "receiving.confirm",
      "suppliers.view",
    ];
    for (const code of codes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  console.log("Permissions synced.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
