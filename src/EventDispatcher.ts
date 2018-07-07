import Event from './Event';
import moment from 'moment-timezone';
import kubernetes from 'kubernetes-client';
import JSONStream from 'json-stream';
import _ from 'lodash';
import Handler, { HandlerOptions } from './Handler';

const Client = (kubernetes as any).Client;
const config = kubernetes.config;

export default class EventDispatcher {
  private events: Event[] = [];
  private stream: JSONStream;
  private readonly handlers: { [name: string]: Handler } = {};
  private startedAt: moment.Moment;

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
    const stream = client.apis['events.k8s.io'].v1beta1.watch.namespaces('').events.getStream();
    stream.pipe(this.stream);
    this.stream.on('data', this.dispatch.bind(this));
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
    event.kubeWatcher = {
      dashboard: `${this.options.kubernetes.dashboard}/#!/${regardingKind}/${regardingNamespace}
      /${regardingName}?namespace=${regardingNamespace}`
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
        const filterValue = (filters as any)[filterKey];
        const filterEventKey = (filterKeyMapping as any)[filterKey];
        const eventValue = _.get(event.object, filterEventKey);
        if (_.isString(filterValue)) {
          if (!new RegExp(filterValue).test(eventValue)) {
            return false;
          }
        } else if (_.isArray(filterValue)) {
          if (!filterValue.includes(eventValue)) {
            return false;
          }
        }
      }
    }

    return !(filters.minCount > 0 && event.object.deprecatedCount < filters.minCount);

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
