export interface Metadata {
  name: string;
  namespace: string;
  selfLink: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
}

export interface Regarding {
  kind: string;
  namespace: string;
  name: string;
  uid: string;
  apiVersion: string;
  resourceVersion: string;
}

export interface DeprecatedSource {
  component: string;
}

export interface Object {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  eventTime?: any;
  reportingInstance: string;
  action: string;
  reason: string;
  regarding: Regarding;
  note: string;
  type: string;
  deprecatedSource: DeprecatedSource;
  deprecatedFirstTimestamp: string;
  deprecatedLastTimestamp: string;
  deprecatedCount: number;
}

export interface KubeWatcher {
  dashboard: string;
}

export default interface Event {
  type: string;
  object: Object;
  kubeWatcher?: KubeWatcher;
}

export enum EventType {
  WARNING = 'Warning', NORMAL = 'Normal'
}
