import "express-session";

declare module "express-session" {
  interface SessionData {
    customerId?: number;
    customerName?: string;
    adminId?: number;
    adminRole?: string;
    adminPermissions?: string[];
    cart?: {
      items: { productId: number; quantity: number }[];
      couponCode?: string;
      governorateId?: number;
      notes?: string;
    };
  }
}
