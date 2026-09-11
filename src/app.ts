import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./common/utils/logger";
import { errorHandler } from "./common/middlewares/error-handler.middleware";
import routes from "./routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: "*" }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/api/v1", routes);

  // Must be registered last — Express identifies error middleware by its 4-arg signature.
  app.use(errorHandler);

  return app;
}
