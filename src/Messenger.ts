import Event from './Event';

export default interface Messenger {
  send(events: Event[]): Promise<void>;

  maxMessages(): number;

  name(): string;
}
