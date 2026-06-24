import { createApp, bootstrap } from './app';
import { config } from './config';
import { initDatabase } from './db/database';

initDatabase();
bootstrap();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Voice Data Entry API running on http://localhost:${config.port}`);
  console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  console.log('Default users: admin@institute.local / admin123');
});
