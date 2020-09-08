# node-watchable

Watch specific object properties for changes. Add and remove listeners. Supports nested objects and arrays. Intended for use in lightweight data-bindings.

## Why not [on-change](https://github.com/sindresorhus/on-change)?

On-change is a robust and well supported library that focuses on just telling you "something changed" rather than what changed.

If you just care that the object changed, so you can persist the entire object to storage for example, then on-change is a better solution for you.

If you care about specific parts of the object changing, and what to, so that you can have a UI callback update its display, this library aims to suit that need.

# Install

Not on npm yet, so you'll have to download it the old fashioned way. FIXME: update once it's released.

# Usage

```js
const { Watchable } = require('watchable');

let m = new Watchable({ a: 1 });
m.addListener('a', (newValue, oldValue, prop) => console.log(`${prop} changed from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}.`));
// a changed from undefined to 1.
// Gets called with the initial value.

m.a++;
// a changed from 1 to 2.

m.a = [];
// a changed from 2 to [].

m.a.push('a value');
// a changed from undefined to ["a value"].
// since `a` is a reference now, the old value gets fudged to warn you not to rely on it.

m.a.addListener('0', (newValue, oldValue, prop) => console.log(`First element of "a" changed from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}.`));
// First element of "a" changed from undefined to "a value".
// Nested objects or arrays automatically get wrapped as watchables for you.

m.a[0] = 'substitute';
// First element of "a" changed from "a value" to "substitute".
// a changed from undefined to ["substitute"].
// Parent listener gets called on modifications of the nested object.

m.a.push('a new value');
// a changed from undefined to ["substitute","a new value"].
// only the first listener fires in this case since we don't touch the first element.

m.a.unshift('a prepended value');
// a changed from undefined to ["substitute","a new value","a new value"].
// a changed from undefined to ["substitute","substitute","a new value"].
// First element of "a" changed from "substitute" to "a prepended value".
// a changed from undefined to ["a prepended value","substitute","a new value"].

// Turns out that unshift changes a lot of stuff, so be aware multiple intermediate calls can happen.
```

# API

## Construction

```js
watchable = new Watchable(original);
```

Creates a watchable from `original`. A watchable is a Proxy wrapper around the original.

WARNING: Changes to `original` will NOT be watched, you will need to use the returned watchable. However, since nested objects are replaced, the original object will be modified. Use the returned watchable and you'll be fine. If you want the original data-structure to be unmodified, create a deep clone yourself before watching.

## watchable.addListener(property, listener)

Adds a listener to a property of the watchable. The property need not exist yet. You can have multiple listeners for a property if you need to, although you'll need to make multiple calls to do so.

## watchable.removeListener(property, listener)

Removes the given listener from the watch list on that property. If you added an anonymous function as a listener, you'll have needed to have kept a reference to it somewhere for this to work.

## watchable[property]._rawValue_

Gets the raw (unwrapped) value of a property in case you need the non-proxied version for some reasons.

# See also

 * [on-change](https://github.com/sindresorhus/on-change) - Watch entire objects for non-specific changes.
 * [watchable-jsonpath](https://github.com/illusori/node-watchable-jsonpath) - Watchable but with added JSONPath spice.
