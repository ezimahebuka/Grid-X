import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  airtimeSchema,
  dataSchema,
  educationSchema,
  electricitySchema,
  insuranceSchema,
  tvSchema,
} from "./bills.schema";
import {
  purchaseAirtime,
  purchaseData,
  purchaseEducation,
  purchaseElectricity,
  purchaseInsurance,
  purchaseTv,
  vtpassWebhook,
} from "./bills.controller";

const router = Router();

router.post(
  "/airtime",
  authMiddleware,
  validate(airtimeSchema),
  asyncHandler(purchaseAirtime),
);
router.post(
  "/data",
  authMiddleware,
  validate(dataSchema),
  asyncHandler(purchaseData),
);
router.post(
  "/tv",
  authMiddleware,
  validate(tvSchema),
  asyncHandler(purchaseTv),
);
router.post(
  "/electricity",
  authMiddleware,
  validate(electricitySchema),
  asyncHandler(purchaseElectricity),
);
router.post(
  "/education",
  authMiddleware,
  validate(educationSchema),
  asyncHandler(purchaseEducation),
);
router.post(
  "/insurance",
  authMiddleware,
  validate(insuranceSchema),
  asyncHandler(purchaseInsurance),
);
router.post("/webhook/vtpass", asyncHandler(vtpassWebhook));

export default router;
