import { Router } from "express";
import healthRoutes from "../health/health.routes";
import authRoutes from "../modules/auth/auth.routes";
import identityRoutes from "../modules/identity/identity.routes";
import billsRoutes from "../modules/bills/bills.routes";
import walletRoutes from "../modules/wallet/wallet.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/identity", identityRoutes);
router.use("/bills", billsRoutes);
router.use("/wallet", walletRoutes);

// Mount future modules here, following the exact same pattern as auth:
// router.use("/meters", metersRoutes);
// router.use("/wallet", walletRoutes);
// router.use("/vending", vendingRoutes);
// router.use("/alerts", alertsRoutes);
// router.use("/reconciliation", reconciliationRoutes);
// router.use("/admin", adminRoutes);

export default router;
