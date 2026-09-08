import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  cardTopupSchema,
  initializeTopupSchema,
  walletActivitySchema,
} from "./wallet.schema";
import {
  initializeTopup,
  cardTopup,
  korapayWebhook,
  topupStatus,
  verifyTopup,
  walletActivity,
  walletBalance,
} from "./wallet.controller";

const router = Router();

router.get("/", authMiddleware, asyncHandler(walletBalance));
router.get(
  "/activity",
  authMiddleware,
  validate(walletActivitySchema),
  asyncHandler(walletActivity),
);
router.post(
  "/topups/initialize",
  authMiddleware,
  validate(initializeTopupSchema),
  asyncHandler(initializeTopup),
);
router.post(
  "/topups/card",
  authMiddleware,
  validate(cardTopupSchema),
  asyncHandler(cardTopup),
);
router.get("/topups/:reference", authMiddleware, asyncHandler(topupStatus));
router.post(
  "/topups/:reference/verify",
  authMiddleware,
  asyncHandler(verifyTopup),
);
router.post("/webhook/korapay", asyncHandler(korapayWebhook));

export default router;
