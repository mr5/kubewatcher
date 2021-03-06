import Event from './Event';
import moment from 'moment-timezone';
import kubernetes from 'kubernetes-client';
import JSONStream from 'json-stream';
import _ from 'lodash';
import Handler, { HandlerOptions } from './Handler';
import Timer = NodeJS.Timer;

const Client = (kubernetes as any).Client;
const config = kubernetes.config;

export default class EventDispatcher {
  private events: Event[] = [];
  private stream: JSONStream;
  private readonly handlers: { [name: string]: Handler } = {};
  private startedAt: moment.Moment;
  private restartTimer: Timer;

  constructor(private readonly options: KubeWatcherOptions) {
    for (const handlerName of Object.keys(options.handlers)) {
      this.handlers[handlerName] = new Handler(handlerName, options.handlers[handlerName]);
    }
    for (const spec of options.specs) {
      for (const handleName of spec.handlers) {
        if (!Object.keys(this.handlers).includes(handleName)) {
          throw new Error(`Handler '${handleName}' does not exists, can not be defined in spec.`);
        }
      }
    }
  }

  public getHandlers() {
    return this.handlers;
  }

  public async start() {
    this.startedAt = moment();
    let clientConfig;
    if (this.options.kubernetes.config_from === 'cluster') {
      clientConfig =
        config.getInCluster();
    } else {
      clientConfig = config.loadKubeconfig(this.options.kubernetes.config_from);
      clientConfig = config.fromKubeconfig(clientConfig, this.options.kubernetes.context);
    }
    if (this.options.kubernetes.insecureSkipTlsVerify) {
      clientConfig.insecureSkipTlsVerify = true;
    }
    const client = new Client({
      config: clientConfig
    });
    await client.loadSpec();
    this.stream = new JSONStream();
    const stream = client.apis['events.k8s.io'].v1beta1.watch.events.getStream({
      qs: {
        watch: true,
        follow: true
      }
    });
    stream.pipe(this.stream);
    this.stream.on('data', this.dispatch.bind(this));
    for (const streamEventName of ['end', 'close', 'error']) {
      stream.on(streamEventName, async () => {
        console.error(`[${moment().format()}] - stream: ${streamEventName}`, arguments);
        this.restart();
      });
    }
    for (const jsonStreamEventName of ['end', 'drain', 'error', 'close']) {
      this.stream.on(jsonStreamEventName, async () => {
        console.error(
          `[${moment().format()}] - json stream: ${jsonStreamEventName}, restarting...`, arguments
        );
        this.restart();
      });
    }
  }

  private restart() {
    // avoid repetitive restarting
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }
    console.error(
      `[${moment().format()}] - It's going to restart after 500ms.`
    );
    this.restartTimer = setTimeout(this.start.bind(this), 500);
  }

  private dispatch(event: Event) {
    if (!event || !event.object) {
      console.error(`[${moment().format()}] - Invalid event: ${JSON.stringify(event)}`);
      return;
    }
    let regardingKind: string = event.object.regarding.kind;
    if (process.env.KUBE_WATCHER_FRESH_ONLY
      && this.startedAt.diff(moment(event.object.deprecatedLastTimestamp), 'seconds') > 0) {
      return;
    }
    regardingKind = regardingKind ? regardingKind.toLowerCase() : '';
    const regardingNamespace = event.object.regarding.namespace;
    const regardingName = event.object.regarding.name;
    const dashPath = `${regardingKind}/${regardingNamespace}/${regardingName}?namespace=${regardingNamespace}`;
    event.kubeWatcher = {
      dashboard: `${this.options.kubernetes.dashboard}/#!/${dashPath}`
    };
    for (const spec of this.options.specs) {
      if (EventDispatcher.filter(spec.filters, event)) {
        for (const handlerName of spec.handlers) {
          this.handlers[handlerName].handle(event);
        }
      }
    }
  }

  public static filter(filters: Filters, event: Event) {
    if (!filters) {
      return true;
    }
    const filterKeyMapping = {
      namespaces: 'metadata.namespace',
      types: 'type',
      reasons: 'reason',
      notes: 'note',
      regardingKind: 'regarding.kind',
      regardingName: 'regarding.name'
    };
    const filterKeys = Object.keys(filters);
    const availableFilterKeys = Object.keys(filterKeyMapping);
    for (const filterKey of availableFilterKeys) {
      if (!availableFilterKeys.includes(filterKey)) {
        throw new Error(`Unknown filter: ${filterKey}`);
      }
      if (filterKeys.includes(filterKey)) {
        let filterValue = (filters as any)[filterKey];
        const filterEventKey = (filterKeyMapping as any)[filterKey];
        const eventValue = _.get(event.object, filterEventKey);
        if (_.isString(filterValue)) {
          filterValue = [filterValue];
        }
        if (_.isArray(filterValue)) {
          for (const v of filterValue) {
            if (!this.match(v, eventValue)) {
              return false;
            }
          }
        }
      }
    }

    return !(filters.minCount > 0 && event.object.deprecatedCount < filters.minCount);
  }

  private static match(expected: string, actual: string) {
    let negative = false;
    let expectedValue = expected;
    let matched = false;
    if (expectedValue && expectedValue.startsWith('!')) {
      negative = true;
      expectedValue = expectedValue.substring(1);
    }
    const expectedValueRegexMatch = /^\/(.+)\/$/.exec(expectedValue);
    if (expectedValueRegexMatch) {
      matched = new RegExp(expectedValueRegexMatch[1]).test(actual);
    } else {
      matched = expectedValue === actual;
    }
    return negative ? !matched : matched;
  }
}

export interface Filters {
  namespaces?: string[] | string;
  types?: string[] | string;
  reasons?: string[] | string;
  notes?: string[] | string;
  regardingKind?: string[] | string;
  regardingName?: string[] | string;
  minCount?: number;
}

export interface Spec {
  filters: Filters;
  handlers: string[] | string;
}

export interface Kubernetes {
  dashboard: string;
  config_from: string;
  insecureSkipTlsVerify: boolean;
  context: string;
}

export interface KubeWatcherOptions {
  kubernetes: Kubernetes;
  handlers: { [name: string]: HandlerOptions };
  specs: Spec[];
}
