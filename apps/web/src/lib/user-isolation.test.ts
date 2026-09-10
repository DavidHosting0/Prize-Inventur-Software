import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("hotel vs group user isolation", () => {
  let hotelId: string;
  let orgId: string;

  beforeAll(async () => {
    const hotel = await prisma.hotel.findFirstOrThrow({
      where: { slug: "bern" },
    });
    hotelId = hotel.id;
    orgId = hotel.organizationId;
  });

  it("GROUP users linked to a hotel are not hotel-staff accounts", async () => {
    const groupOnHotel = await prisma.user.findMany({
      where: {
        accountType: "GROUP",
        hotels: { some: { hotelId } },
      },
    });
    expect(groupOnHotel.length).toBeGreaterThan(0);

    const hotelStaffQuery = await prisma.user.findMany({
      where: {
        accountType: "HOTEL",
        hotels: { some: { hotelId } },
      },
    });
    expect(hotelStaffQuery.every((u) => u.accountType === "HOTEL")).toBe(true);
    expect(
      hotelStaffQuery.some((u) => u.email === "group.admin@prize-radisson.ch")
    ).toBe(false);
  });

  it("GROUP roles cannot be used as hotel create targets", async () => {
    const groupRoles = await prisma.role.findMany({
      where: { scope: "GROUP" },
    });
    const hotelRoles = await prisma.role.findMany({
      where: { scope: "HOTEL" },
    });
    expect(groupRoles.some((r) => r.code === "GROUP_ADMIN")).toBe(true);
    expect(hotelRoles.some((r) => r.code === "ADMIN")).toBe(true);
    expect(hotelRoles.every((r) => r.scope === "HOTEL")).toBe(true);
  });

  it("corporate user list is GROUP-only for the org", async () => {
    const corp = await prisma.user.findMany({
      where: { organizationId: orgId, accountType: "GROUP" },
    });
    expect(corp.every((u) => u.accountType === "GROUP")).toBe(true);
    expect(corp.some((u) => u.email === "admin@demo-hotel.ch")).toBe(false);
  });
});
