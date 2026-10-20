import { appRouter, documentTransferRouter } from "../trpc/appRouter";
import { router } from "../trpc/trpc";
// Tests exercise both transports' procedures with the same authenticated context.
export const apiRouter = router({
  ...appRouter._def.record,
  ...documentTransferRouter._def.record,
});
