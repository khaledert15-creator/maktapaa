import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import contentRouter from "./content";
import shippingRouter from "./shipping";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import adminDashboardRouter from "./admin/dashboard";
import adminProductsRouter from "./admin/products";
import adminOrdersRouter from "./admin/orders";
import adminCustomersRouter from "./admin/customers";
import adminCouponsRouter from "./admin/coupons";
import adminReportsRouter from "./admin/reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(contentRouter);
router.use(shippingRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(adminDashboardRouter);
router.use(adminProductsRouter);
router.use(adminOrdersRouter);
router.use(adminCustomersRouter);
router.use(adminCouponsRouter);
router.use(adminReportsRouter);

export default router;
