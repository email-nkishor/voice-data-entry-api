"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const database_1 = require("./db/database");
(0, database_1.initDatabase)();
(0, app_1.bootstrap)();
const app = (0, app_1.createApp)();
app.listen(config_1.config.port, () => {
    console.log(`Voice Data Entry API running on http://localhost:${config_1.config.port}`);
    console.log(`CORS origin: ${config_1.config.corsOrigin}`);
    console.log('Default users: admin@institute.local / admin123');
});
