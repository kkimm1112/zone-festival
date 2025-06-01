import { router } from '../server';
import { eventRouter } from './event';
import { boothRouter } from './booth';

export const appRouter = router({
  event: eventRouter,
  booth: boothRouter,
});

export type AppRouter = typeof appRouter;