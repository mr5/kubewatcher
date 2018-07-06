import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import EventDispatcher from './EventDispatcher';
import moment from 'moment-timezone';

require('source-map-support/register');
if (process.env.TZ) {
  moment.tz.setDefault(process.env.TZ);
}
const config = yaml.load(
  fs.readFileSync(path.join(__dirname, '/../config/.kubewatcher.yml')).toString('utf-8')
);

new EventDispatcher(config).start();
