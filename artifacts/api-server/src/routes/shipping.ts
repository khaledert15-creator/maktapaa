import { Router, type IRouter } from "express";
import { db, governoratesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/governorates", async (_req, res): Promise<void> => {
  const govs = await db.select().from(governoratesTable)
    .where(eq(governoratesTable.isActive, true))
    .orderBy(asc(governoratesTable.nameAr));
  res.json(govs.map(g => ({
    id: g.id, nameAr: g.nameAr, nameEn: g.nameEn,
    shippingCost: Number(g.shippingCost),
    freeShippingThreshold: g.freeShippingThreshold ? Number(g.freeShippingThreshold) : null,
    estimatedDays: g.estimatedDays, isActive: g.isActive,
  })));
});

export default router;
