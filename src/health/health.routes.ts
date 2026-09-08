import { Router } from "express";
import { prisma } from "../database/prisma.client";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    res.status(200).json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

export default router;
