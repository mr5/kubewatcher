import Event from './Event';
import Messenger from './Messenger';
import moment from 'moment-timezone';
import Timer = NodeJS.Timer;
import * as messengers from './messengers';

export default class Handler {
  private events: Event[] = [];
  private lastSent: moment.Moment;
  private readonly messenger: Messenger;
  private interval: Timer;

  constructor(readonly name: string, private options: HandlerOptions) {
    this.options.seconds = parseInt(String(this.options.seconds), 10);
    if (!this.options.seconds) {
      this.options.seconds = 0;
    }
    this.options.count = parseInt(String(this.options.count), 10);
    if (!this.options.count) {
      this.options.count;
    }
    this.messenger = Handler.messengerFactory(this.options.messenger, this.options.options);
  }

  public static messengerFactory(name: string, options: any) {
    for (const messenger of Object.values(messengers)) {
      if (name === messenger.prototype.name()) {
        return new messenger(options);
      }
    }
    throw new Error(`Unsupported messenger '${name}'`);
  }

  private sendMessages() {
    const maxMessages = this.options.count > 0
      ? Math.min(this.options.count, this.messenger.maxMessages())
      : this.messenger.maxMessages();
    if (
      this.events.length > 0
      && (
        this.events.length >= maxMessages
        || moment().diff(this.lastSent, 'seconds') >= this.options.seconds
      )
    ) {
      const messages = this.events.splice(0, maxMessages);
      console.log(`[${moment().format()}] - [${this.name}] Sending ${messages.length} messages.`);
      this.messenger.send(messages).catch((reason) => {
        throw reason;
      });
      this.lastSent = moment();
    }
  }

  public handle(event: Event) {
    if (!this.lastSent) {
      this.lastSent = moment();
    }
    if (!this.interval) {
      this.interval = setInterval(this.sendMessages.bind(this), 500);
    }
    this.events.push(event);
  }
}

export interface HandlerOptions {
  seconds: number;
  count: number;
  messenger: string;
  options: object;
}
