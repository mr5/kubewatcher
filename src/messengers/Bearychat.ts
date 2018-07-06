import Messenger from "../Messenger";
import Event, {EventType} from "../Event";
import request from 'request-promise-native';
import moment from "moment-timezone";

export default class Bearychat implements Messenger {
    constructor(private options: BearychatOption) {
        if (!this.options.timeout) {
            this.options.timeout = 10000;
        }
    }

    async send(events: Event[]): Promise<void> {
        if (!events || events.length < 1) {
            return;
        }
        let color = '#DCDFE6';
        const attachments = [];
        for (const event of events) {
            if (event.object.type === EventType.WARNING) {
                color = '#f50057';
            }

            attachments.push({
                title: `${event.object.regarding.name}.${event.object.regarding.namespace}`,
                color,
                text: `[${moment(event.object.deprecatedLastTimestamp).format('YYYY-MM-DD HH:mm:ss')}] ${event.object.note}`,
                url: event.kubeWatcher.dashboard
            });
        }

        const requestOptions = {
            uri: this.options.url,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: this.options.timeout,
            json: true,
            method: 'post',
            body: {
                markdown: true,
                channel: this.options.channel,
                title: 'Kubernetes events',
                attachments
            }
        };
        await request(requestOptions);
    }

    maxMessages(): number {
        return 10;
    }

    name(): string {
        return 'bearychat';
    }
}

export interface BearychatOption {
    url: string;
    channel: string;
    timeout: number;
}
