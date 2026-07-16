import bcrypt from "bcryptjs";
import { db, customersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.customerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdminPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.adminId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (
      req.session.adminRole === "owner" ||
      req.session.adminRole === "administrator" ||
      req.session.adminPermissions?.includes(permission)
    ) {
      next();
      return;
    }

    res.status(403).json({ error: "ليس لديك صلاحية لتنفيذ هذا الإجراء" });
  };
}

export async function getCustomerFromSession(req: Request) {
  if (!req.session?.customerId) return null;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, req.session.customerId as number));
  return customer || null;
}

export async function getAdminFromSession(req: Request) {
  if (!req.session?.adminId) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.adminId as number));
  return user || null;
}
