import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { verify } from "./identity.controller";
import { verifyIdentitySchema } from "./identity.schema";

const router = Router();

router.post(
  "/verify",
  authMiddleware,
  validate(verifyIdentitySchema),
  asyncHandler(verify),
);

export default router;
