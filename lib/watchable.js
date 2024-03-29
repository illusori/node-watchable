/* jshint esversion: 9, node: true */
"use strict";

class WatchableHandler {

    static handlerProp = '_watchableHandler_';
    static rawValueProp = '_rawValue_';

    constructor () {
        // FIXME: self-listener too.
        this._listeners = {};
        this._parents = [];
    }

    static fromHandler (source) {
        let handler = new this();
        if (source) {
            handler._listeners = Object.assign({}, source._listeners);
        }
        return handler;
    }

    addListener (target, prop, listener) {
        if (!this._listeners[prop]) {
            this._listeners[prop] = [];
        }
        this._listeners[prop].push(listener);
        // trigger with initial value. TODO: make optional?
        listener(target[prop], undefined, prop);
    }

    removeListener (target, prop, listener) {
        this._listeners[prop] = this._listeners[prop]?.filter(f => f !== listener);
    }

    listeners (target, prop) {
        return this._listeners[prop];
    }

    parentMatch (a, b) {
        return (a[0] === b[0]) && (a[1] === b[1]);
    }

    // Note: parent here is the unproxied parent.
    addParent (parent, parentProp, parentHandler) {
        if (this._parents.filter(v => this.parentMatch(v, [parent, parentProp])).length == 0) {
            this._parents.push([parent, parentProp, parentHandler]);
        }
    }

    removeParent (parent, parentProp, parentHandler) {
        this._parents = this._parents.filter(v => !this.parentMatch(v, [parent, parentProp]))
    }

    propChanged (newValue, oldValue, prop) {
        // Shallow array copy to prevent listeners adding new listeners making an infinite loop.
        for (const listener of [...(this._listeners[prop] || [])]) {
            listener(newValue, oldValue, prop);
        }
        for (const [parent, parentProp, parentHandler] of this._parents) {
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
            return (...arg) => this.addListener(target, ...arg);
        }
        if (prop === 'removeListener') {
            return (...arg) => this.removeListener(target, ...arg);
        }
        if (prop === 'listeners') {
            return (...arg) => this.listeners(target, ...arg);
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
        return true;
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

    static isProxiedByMe (target) {
        return target?.[this.handlerProp]?.constructor === this;
    }

    static shouldProxy (target) {
        // typeof(null) is 'object' rather annoyingly.
        return target && typeof(target) === 'object' && !this.isProxiedByMe(target);
    }

    static attach (target, handler = null) {
        if (!this.shouldProxy(target)) {
            return target;
        }
        if (this.isProxied(target)) {
            // This replaces the handler from oldValue. This is _probably_ what you want?
            handler = this.handlerFor(target);
            target = this.rawValue(target);
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
