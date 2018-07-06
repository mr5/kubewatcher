import test from 'ava';
import _ from 'lodash';
import EventDispatcher from '../src/EventDispatcher';

const event = {
    "type": "ADDED",
    "object": {
        "kind": "Event",
        "apiVersion": "events.k8s.io/v1beta1",
        "metadata": {
            "name": "kubewatcher-5f55bfdc66-gfsg7.153e1bfed6e259e2",
            "namespace": "default",
            "selfLink": "/apis/events.k8s.io/v1beta1/namespaces/default/events/kubewatcher-5f55bfdc66-gfsg7.153e1bfed6e259e2",
            "uid": "6cb1db05-7f61-11e8-9112-00163e1a4eca",
            "resourceVersion": "10403557",
            "creationTimestamp": "2018-07-04T08:08:24Z"
        },
        //"eventTime": null,
        "reportingInstance": "",
        "action": "",
        "reason": "SuccessfulMountVolume",
        "regarding": {
            "kind": "Pod",
            "namespace": "default",
            "name": "kubewatcher-5f55bfdc66-gfsg7",
            "uid": "6c89ca90-7f61-11e8-9112-00163e1a4eca",
            "apiVersion": "v1",
            "resourceVersion": "10403548"
        },
        "note": "MountVolume.SetUp succeeded for volume \"default-token-fxknh\" ",
        "type": "Normal",
        "deprecatedSource": {
            "component": "kubelet",
            "host": "cn-shanghai.i-uf63ve3kz84m20c5oeqq"
        },
        "deprecatedFirstTimestamp": "2018-07-04T08:08:24Z",
        "deprecatedLastTimestamp": "2018-07-04T08:08:24Z",
        "deprecatedCount": 1
    }
};
test('EventDispatcher:filter', async (t) => {
    t.true(EventDispatcher.filter(
        {namespaces: '-system$'},
        _.set(_.cloneDeep(event), 'object.metadata.namespace', 'kube-system')
    ));
    t.false(EventDispatcher.filter(
        {namespaces: '-kube'},
        _.set(_.cloneDeep(event), 'object.metadata.namespace', 'kube-system')
    ));
    t.true(EventDispatcher.filter(
        {namespaces: ['kube-system']},
        _.set(_.cloneDeep(event), 'object.metadata.namespace', 'kube-system')
    ));
    t.false(EventDispatcher.filter(
        {namespaces: ['istio-system', '-system$']},
        _.set(_.cloneDeep(event), 'object.metadata.namespace', 'kube-system')
    ));
    t.false(EventDispatcher.filter(
        {minCount: 3},
        _.set(_.cloneDeep(event), 'object.deprecatedCount', 2)
    ));
    t.true(EventDispatcher.filter(
        {minCount: 2},
        _.set(_.cloneDeep(event), 'object.deprecatedCount', 2)
    ));
    t.true(EventDispatcher.filter(
        {minCount: 1},
        _.set(_.cloneDeep(event), 'object.deprecatedCount', 2)
    ));

    t.false(EventDispatcher.filter(
        {namespaces: '-system$', minCount: 3},
        _.merge(_.cloneDeep(event), {object: {metadata: {namespace: 'kube-system'}, deprecatedCount: 2}})
    ));
    t.true(EventDispatcher.filter(
        {namespaces: '-system$', minCount: 3},
        _.merge(_.cloneDeep(event), {object: {metadata: {namespace: 'kube-system'}, deprecatedCount: 4}})
    ));
});
