/**
 * Server entrypoint
 * Owner: Aranno (A-BE-1)
 */

import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`FairBench API server running on port ${PORT} [${env.NODE_ENV}]`);
  console.log(`Lab Timezone: ${env.LAB_TIMEZONE}`);
});
