import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import EventDispatcher from './EventDispatcher';
import moment from 'moment-timezone';
import express from 'express';
import Handler from './Handler';

require('source-map-support/register');
if (process.env.TZ) {
  moment.tz.setDefault(process.env.TZ);
}
const config = yaml.load(
  fs.readFileSync(path.join(__dirname, '/../config/.kubewatcher.yml')).toString('utf-8')
);

const eventDispatcher = new EventDispatcher(config);
eventDispatcher.start();
const app = express();
app.get('/health', (req, res) => {
  const handlersInfo: { [name: string]: any } = {};
  const handlers = eventDispatcher.getHandlers();
  for (const handler of Object.values<Handler>(handlers)) {
    handlersInfo[handler.getName()] = {
      lastSent: handler.getLastSent() ? handler.getLastSent().format() : null,
      lastBreathed: handler.getLastBreathed().format(),
      pendingEvents: handler.getPendingEventsCount()
    };
  }
  res.json({
    handlers: handlersInfo
  });
});

const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}...`);
app.listen(port);
