import Messenger from '../Messenger';
import Event, { EventType } from '../Event';

export default class Console implements Messenger {
  constructor(private readonly options: any) {
  }

  async send(events: Event[]): Promise<void> {
    if (!events || events.length < 1) {
      return;
    }
    for (const event of events) {
      let func = console.log;
      if (event.object.type === EventType.WARNING) {
        func = console.error;
      }
      func(event);
    }
  }

  maxMessages(): number {
    return 10;
  }

  name(): string {
    return 'console';
  }
}
