import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./common/utils/logger";

const app = createApp();
const port = Number(env.PORT);

app.listen(port, () => {
  logger.info(`Grid X backend listening on port ${port}`);
});
