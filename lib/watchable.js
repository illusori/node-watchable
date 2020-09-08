/* jshint esversion: 9, node: true */
"use strict";

class WatchableHandler {

    static handlerProp = '_watchableHandler_';
    static rawValueProp = '_rawValue_';

    constructor () {
        // FIXME: self-listener too.
        this.listeners = {};
        this.parents = [];
    }

    static fromHandler (source) {
        let handler = new this();
        if (source) {
            handler.listeners = Object.assign({}, source.listeners);
        }
        return handler;
    }

    addListener (target, prop, listener) {
        if (!this.listeners[prop]) {
            this.listeners[prop] = [];
        }
        this.listeners[prop].push(listener);
        // trigger with initial value. TODO: make optional?
        listener(target[prop], undefined, prop);
    }

    removeListener (target, prop, listener) {
        this.listeners[prop] = this.listeners[prop]?.filter(f => f !== listener);
    }

    parentMatch (a, b) {
        return (a[0] === b[0]) && (a[1] === b[1]);
    }

    // Note: parent here is the unproxied parent.
    addParent (parent, parentProp, parentHandler) {
        if (this.parents.filter(v => this.parentMatch(v, [parent, parentProp])).length == 0) {
            this.parents.push([parent, parentProp, parentHandler]);
        }
    }

    removeParent (parent, parentProp, parentHandler) {
        this.parents = this.parents.filter(v => !this.parentMatch(v, [parent, parentProp]))
    }

    propChanged (newValue, oldValue, prop) {
        for (const listener of this.listeners[prop] || []) {
            listener(newValue, oldValue, prop);
        }
        for (const [parent, parentProp, parentHandler] of this.parents) {
            // Ick, we don't know the old value.
            // It's been changed already, plus it's a reference rather than scalar.
            parentHandler.propChanged(parent[parentProp], undefined, parentProp);
        }
    }

    static handlerFor (target) {
        return target?.[this.handlerProp];
    }

    handlerFor (target) {
        return this.constructor.handlerFor(target);
    }

    get (target, prop, receiver) {
        if (prop === this.constructor.handlerProp) {
            return this;
        }
        if (prop === this.constructor.rawValueProp) {
            return target;
        }
        // FIXME: prebuild vs create
        if (prop === 'addListener') {
            return (prop, listener) => this.addListener(target, prop, listener);
        }
        if (prop === 'removeListener') {
            return (prop, listener) => this.removeListener(target, prop, listener);
        }
        return target[prop];
    }

    set (target, prop, newValue) {
        let oldValue = target[prop];
        // Won't old true for arrays or objects, but if you're not so likely to
        // assign to those, or listen to them, vs mutating them, and any assigns
        // are likely to be changes rather than same-value.
        // In either case, the proxy wrapper will make it fail the comparison too.
        if (oldValue !== newValue) {
            if (this.constructor.shouldProxy(newValue)) {
                if (this.constructor.isProxied(oldValue)) {
                    // preserve listeners/formatters from oldValue
                    newValue = this.constructor.attach(newValue, this.handlerFor(oldValue));
                } else {
                    newValue = this.constructor.attach(newValue);
                }
            }
            if (this.constructor.isProxied(oldValue)) {
                this.handlerFor(oldValue).removeParent(target, prop, this);
            }
            if (this.constructor.isProxied(newValue)) {
                this.handlerFor(newValue).addParent(target, prop, this);
            }
            target[prop] = newValue;
            this.propChanged(newValue, oldValue, prop);
        }
        return newValue;
    }

    deleteProperty (target, prop) {
        let oldValue = target[prop];
        let ret = delete target[prop];
        // Eeeeehhhhh... sorta kinda I guess.
        this.propChanged(undefined, oldValue, prop);
        return ret;
    }

    static rawValue (target) {
        return target?.[this.rawValueProp] ?? target;
    }

    static isProxied (target) {
        return target?.[this.handlerProp] !== undefined;
    }

    static shouldProxy (target) {
        return typeof(target) === 'object' && !this.isProxied(target);
    }

    static attach (target, handler = null) {
        if (!this.shouldProxy(target)) {
            return target;
        }
        handler = handler ? this.fromHandler(handler) : new this();
        // Yes, this modifies the original object/array by reference. Bug? Feature? You decide.
        for (const [k, v] of Object.entries(target)) {
            if (this.shouldProxy(v)) {
                target[k] = this.attach(v);
                this.handlerFor(target[k]).addParent(target, k, handler);
            }
        }
        return new Proxy(target, handler);
    }
}

class Watchable {

    static watchableHandler = WatchableHandler;

    constructor (target) {
        // Sleight-of-hand: we actually just return a proxy, not an instance of this class.
        return this.constructor.watchableHandler.attach(target)
    }
}

exports.WatchableHandler = WatchableHandler;
exports.Watchable = Watchable;
