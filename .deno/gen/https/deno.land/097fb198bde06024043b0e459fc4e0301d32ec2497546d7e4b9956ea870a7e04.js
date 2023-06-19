// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// deno-lint-ignore camelcase
import * as async_wrap from "../internal_binding/async_wrap.ts";
import { ERR_ASYNC_CALLBACK } from "./errors.ts";
export { asyncIdSymbol, ownerSymbol } from "../internal_binding/symbols.ts";
// Properties in active_hooks are used to keep track of the set of hooks being
// executed in case another hook is enabled/disabled. The new set of hooks is
// then restored once the active set of hooks is finished executing.
// deno-lint-ignore camelcase
const active_hooks = {
    // Array of all AsyncHooks that will be iterated whenever an async event
    // fires. Using var instead of (preferably const) in order to assign
    // active_hooks.tmp_array if a hook is enabled/disabled during hook
    // execution.
    array: [],
    // Use a counter to track nested calls of async hook callbacks and make sure
    // the active_hooks.array isn't altered mid execution.
    // deno-lint-ignore camelcase
    call_depth: 0,
    // Use to temporarily store and updated active_hooks.array if the user
    // enables or disables a hook while hooks are being processed. If a hook is
    // enabled() or disabled() during hook execution then the current set of
    // active hooks is duplicated and set equal to active_hooks.tmp_array. Any
    // subsequent changes are on the duplicated array. When all hooks have
    // completed executing active_hooks.tmp_array is assigned to
    // active_hooks.array.
    // deno-lint-ignore camelcase
    tmp_array: null,
    // Keep track of the field counts held in active_hooks.tmp_array. Because the
    // async_hook_fields can't be reassigned, store each uint32 in an array that
    // is written back to async_hook_fields when active_hooks.array is restored.
    // deno-lint-ignore camelcase
    tmp_fields: null
};
export const registerDestroyHook = async_wrap.registerDestroyHook;
// deno-lint-ignore camelcase
const { async_hook_fields , asyncIdFields: async_id_fields , newAsyncId , constants  } = async_wrap;
export { newAsyncId };
const { kInit , kBefore , kAfter , kDestroy , kPromiseResolve , kTotals , kCheck , kDefaultTriggerAsyncId , kStackLength  } = constants;
// deno-lint-ignore camelcase
const resource_symbol = Symbol("resource");
// deno-lint-ignore camelcase
export const async_id_symbol = Symbol("trigger_async_id");
// deno-lint-ignore camelcase
export const trigger_async_id_symbol = Symbol("trigger_async_id");
// deno-lint-ignore camelcase
export const init_symbol = Symbol("init");
// deno-lint-ignore camelcase
export const before_symbol = Symbol("before");
// deno-lint-ignore camelcase
export const after_symbol = Symbol("after");
// deno-lint-ignore camelcase
export const destroy_symbol = Symbol("destroy");
// deno-lint-ignore camelcase
export const promise_resolve_symbol = Symbol("promiseResolve");
export const symbols = {
    // deno-lint-ignore camelcase
    async_id_symbol,
    // deno-lint-ignore camelcase
    trigger_async_id_symbol,
    // deno-lint-ignore camelcase
    init_symbol,
    // deno-lint-ignore camelcase
    before_symbol,
    // deno-lint-ignore camelcase
    after_symbol,
    // deno-lint-ignore camelcase
    destroy_symbol,
    // deno-lint-ignore camelcase
    promise_resolve_symbol
};
// deno-lint-ignore no-explicit-any
function lookupPublicResource(resource) {
    if (typeof resource !== "object" || resource === null) return resource;
    // TODO(addaleax): Merge this with owner_symbol and use it across all
    // AsyncWrap instances.
    const publicResource = resource[resource_symbol];
    if (publicResource !== undefined) {
        return publicResource;
    }
    return resource;
}
// Used by C++ to call all init() callbacks. Because some state can be setup
// from C++ there's no need to perform all the same operations as in
// emitInitScript.
function emitInitNative(asyncId, // deno-lint-ignore no-explicit-any
type, triggerAsyncId, // deno-lint-ignore no-explicit-any
resource) {
    active_hooks.call_depth += 1;
    resource = lookupPublicResource(resource);
    // Use a single try/catch for all hooks to avoid setting up one per iteration.
    try {
        for(let i = 0; i < active_hooks.array.length; i++){
            if (typeof active_hooks.array[i][init_symbol] === "function") {
                active_hooks.array[i][init_symbol](asyncId, type, triggerAsyncId, resource);
            }
        }
    } catch (e) {
        throw e;
    } finally{
        active_hooks.call_depth -= 1;
    }
    // Hooks can only be restored if there have been no recursive hook calls.
    // Also the active hooks do not need to be restored if enable()/disable()
    // weren't called during hook execution, in which case active_hooks.tmp_array
    // will be null.
    if (active_hooks.call_depth === 0 && active_hooks.tmp_array !== null) {
        restoreActiveHooks();
    }
}
function getHookArrays() {
    if (active_hooks.call_depth === 0) {
        return [
            active_hooks.array,
            async_hook_fields
        ];
    }
    // If this hook is being enabled while in the middle of processing the array
    // of currently active hooks then duplicate the current set of active hooks
    // and store this there. This shouldn't fire until the next time hooks are
    // processed.
    if (active_hooks.tmp_array === null) {
        storeActiveHooks();
    }
    return [
        active_hooks.tmp_array,
        active_hooks.tmp_fields
    ];
}
function storeActiveHooks() {
    active_hooks.tmp_array = active_hooks.array.slice();
    // Don't want to make the assumption that kInit to kDestroy are indexes 0 to
    // 4. So do this the long way.
    active_hooks.tmp_fields = [];
    copyHooks(active_hooks.tmp_fields, async_hook_fields);
}
function copyHooks(destination, source) {
    destination[kInit] = source[kInit];
    destination[kBefore] = source[kBefore];
    destination[kAfter] = source[kAfter];
    destination[kDestroy] = source[kDestroy];
    destination[kPromiseResolve] = source[kPromiseResolve];
}
// Then restore the correct hooks array in case any hooks were added/removed
// during hook callback execution.
function restoreActiveHooks() {
    active_hooks.array = active_hooks.tmp_array;
    copyHooks(async_hook_fields, active_hooks.tmp_fields);
    active_hooks.tmp_array = null;
    active_hooks.tmp_fields = null;
}
// deno-lint-ignore no-unused-vars
let wantPromiseHook = false;
function enableHooks() {
    async_hook_fields[kCheck] += 1;
// TODO(kt3k): Uncomment this
// setCallbackTrampoline(callbackTrampoline);
}
function disableHooks() {
    async_hook_fields[kCheck] -= 1;
    wantPromiseHook = false;
// TODO(kt3k): Uncomment the below
// setCallbackTrampoline();
// Delay the call to `disablePromiseHook()` because we might currently be
// between the `before` and `after` calls of a Promise.
// TODO(kt3k): Uncomment the below
// enqueueMicrotask(disablePromiseHookIfNecessary);
}
// Return the triggerAsyncId meant for the constructor calling it. It's up to
// the user to safeguard this call and make sure it's zero'd out when the
// constructor is complete.
export function getDefaultTriggerAsyncId() {
    const defaultTriggerAsyncId = async_id_fields[async_wrap.UidFields.kDefaultTriggerAsyncId];
    // If defaultTriggerAsyncId isn't set, use the executionAsyncId
    if (defaultTriggerAsyncId < 0) {
        return async_id_fields[async_wrap.UidFields.kExecutionAsyncId];
    }
    return defaultTriggerAsyncId;
}
export function defaultTriggerAsyncIdScope(triggerAsyncId, // deno-lint-ignore no-explicit-any
block, ...args) {
    if (triggerAsyncId === undefined) {
        return block.apply(null, args);
    }
    // CHECK(NumberIsSafeInteger(triggerAsyncId))
    // CHECK(triggerAsyncId > 0)
    const oldDefaultTriggerAsyncId = async_id_fields[kDefaultTriggerAsyncId];
    async_id_fields[kDefaultTriggerAsyncId] = triggerAsyncId;
    try {
        return block.apply(null, args);
    } finally{
        async_id_fields[kDefaultTriggerAsyncId] = oldDefaultTriggerAsyncId;
    }
}
function hasHooks(key) {
    return async_hook_fields[key] > 0;
}
export function enabledHooksExist() {
    return hasHooks(kCheck);
}
export function initHooksExist() {
    return hasHooks(kInit);
}
export function afterHooksExist() {
    return hasHooks(kAfter);
}
export function destroyHooksExist() {
    return hasHooks(kDestroy);
}
export function promiseResolveHooksExist() {
    return hasHooks(kPromiseResolve);
}
function emitInitScript(asyncId, // deno-lint-ignore no-explicit-any
type, triggerAsyncId, // deno-lint-ignore no-explicit-any
resource) {
    // Short circuit all checks for the common case. Which is that no hooks have
    // been set. Do this to remove performance impact for embedders (and core).
    if (!hasHooks(kInit)) {
        return;
    }
    if (triggerAsyncId === null) {
        triggerAsyncId = getDefaultTriggerAsyncId();
    }
    emitInitNative(asyncId, type, triggerAsyncId, resource);
}
export { emitInitScript as emitInit };
export function hasAsyncIdStack() {
    return hasHooks(kStackLength);
}
export { constants };
export class AsyncHook {
    [init_symbol];
    [before_symbol];
    [after_symbol];
    [destroy_symbol];
    [promise_resolve_symbol];
    constructor({ init , before , after , destroy , promiseResolve  }){
        if (init !== undefined && typeof init !== "function") {
            throw new ERR_ASYNC_CALLBACK("hook.init");
        }
        if (before !== undefined && typeof before !== "function") {
            throw new ERR_ASYNC_CALLBACK("hook.before");
        }
        if (after !== undefined && typeof after !== "function") {
            throw new ERR_ASYNC_CALLBACK("hook.after");
        }
        if (destroy !== undefined && typeof destroy !== "function") {
            throw new ERR_ASYNC_CALLBACK("hook.destroy");
        }
        if (promiseResolve !== undefined && typeof promiseResolve !== "function") {
            throw new ERR_ASYNC_CALLBACK("hook.promiseResolve");
        }
        this[init_symbol] = init;
        this[before_symbol] = before;
        this[after_symbol] = after;
        this[destroy_symbol] = destroy;
        this[promise_resolve_symbol] = promiseResolve;
    }
    enable() {
        // The set of callbacks for a hook should be the same regardless of whether
        // enable()/disable() are run during their execution. The following
        // references are reassigned to the tmp arrays if a hook is currently being
        // processed.
        // deno-lint-ignore camelcase
        const { 0: hooks_array , 1: hook_fields  } = getHookArrays();
        // Each hook is only allowed to be added once.
        if (hooks_array.includes(this)) {
            return this;
        }
        // deno-lint-ignore camelcase
        const prev_kTotals = hook_fields[kTotals];
        // createHook() has already enforced that the callbacks are all functions,
        // so here simply increment the count of whether each callbacks exists or
        // not.
        hook_fields[kTotals] = hook_fields[kInit] += +!!this[init_symbol];
        hook_fields[kTotals] += hook_fields[kBefore] += +!!this[before_symbol];
        hook_fields[kTotals] += hook_fields[kAfter] += +!!this[after_symbol];
        hook_fields[kTotals] += hook_fields[kDestroy] += +!!this[destroy_symbol];
        hook_fields[kTotals] += hook_fields[kPromiseResolve] += +!!this[promise_resolve_symbol];
        hooks_array.push(this);
        if (prev_kTotals === 0 && hook_fields[kTotals] > 0) {
            enableHooks();
        }
        // TODO(kt3k): Uncomment the below
        // updatePromiseHookMode();
        return this;
    }
    disable() {
        // deno-lint-ignore camelcase
        const { 0: hooks_array , 1: hook_fields  } = getHookArrays();
        const index = hooks_array.indexOf(this);
        if (index === -1) {
            return this;
        }
        // deno-lint-ignore camelcase
        const prev_kTotals = hook_fields[kTotals];
        hook_fields[kTotals] = hook_fields[kInit] -= +!!this[init_symbol];
        hook_fields[kTotals] += hook_fields[kBefore] -= +!!this[before_symbol];
        hook_fields[kTotals] += hook_fields[kAfter] -= +!!this[after_symbol];
        hook_fields[kTotals] += hook_fields[kDestroy] -= +!!this[destroy_symbol];
        hook_fields[kTotals] += hook_fields[kPromiseResolve] -= +!!this[promise_resolve_symbol];
        hooks_array.splice(index, 1);
        if (prev_kTotals > 0 && hook_fields[kTotals] === 0) {
            disableHooks();
        }
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvYXN5bmNfaG9va3MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQgYW5kIE5vZGUgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbmltcG9ydCAqIGFzIGFzeW5jX3dyYXAgZnJvbSBcIi4uL2ludGVybmFsX2JpbmRpbmcvYXN5bmNfd3JhcC50c1wiO1xuaW1wb3J0IHsgRVJSX0FTWU5DX0NBTExCQUNLIH0gZnJvbSBcIi4vZXJyb3JzLnRzXCI7XG5leHBvcnQgeyBhc3luY0lkU3ltYm9sLCBvd25lclN5bWJvbCB9IGZyb20gXCIuLi9pbnRlcm5hbF9iaW5kaW5nL3N5bWJvbHMudHNcIjtcblxuaW50ZXJmYWNlIEFjdGl2ZUhvb2tzIHtcbiAgYXJyYXk6IEFzeW5jSG9va1tdO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICBjYWxsX2RlcHRoOiBudW1iZXI7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIHRtcF9hcnJheTogQXN5bmNIb29rW10gfCBudWxsO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICB0bXBfZmllbGRzOiBudW1iZXJbXSB8IG51bGw7XG59XG5cbi8vIFByb3BlcnRpZXMgaW4gYWN0aXZlX2hvb2tzIGFyZSB1c2VkIHRvIGtlZXAgdHJhY2sgb2YgdGhlIHNldCBvZiBob29rcyBiZWluZ1xuLy8gZXhlY3V0ZWQgaW4gY2FzZSBhbm90aGVyIGhvb2sgaXMgZW5hYmxlZC9kaXNhYmxlZC4gVGhlIG5ldyBzZXQgb2YgaG9va3MgaXNcbi8vIHRoZW4gcmVzdG9yZWQgb25jZSB0aGUgYWN0aXZlIHNldCBvZiBob29rcyBpcyBmaW5pc2hlZCBleGVjdXRpbmcuXG4vLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuY29uc3QgYWN0aXZlX2hvb2tzOiBBY3RpdmVIb29rcyA9IHtcbiAgLy8gQXJyYXkgb2YgYWxsIEFzeW5jSG9va3MgdGhhdCB3aWxsIGJlIGl0ZXJhdGVkIHdoZW5ldmVyIGFuIGFzeW5jIGV2ZW50XG4gIC8vIGZpcmVzLiBVc2luZyB2YXIgaW5zdGVhZCBvZiAocHJlZmVyYWJseSBjb25zdCkgaW4gb3JkZXIgdG8gYXNzaWduXG4gIC8vIGFjdGl2ZV9ob29rcy50bXBfYXJyYXkgaWYgYSBob29rIGlzIGVuYWJsZWQvZGlzYWJsZWQgZHVyaW5nIGhvb2tcbiAgLy8gZXhlY3V0aW9uLlxuICBhcnJheTogW10sXG4gIC8vIFVzZSBhIGNvdW50ZXIgdG8gdHJhY2sgbmVzdGVkIGNhbGxzIG9mIGFzeW5jIGhvb2sgY2FsbGJhY2tzIGFuZCBtYWtlIHN1cmVcbiAgLy8gdGhlIGFjdGl2ZV9ob29rcy5hcnJheSBpc24ndCBhbHRlcmVkIG1pZCBleGVjdXRpb24uXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIGNhbGxfZGVwdGg6IDAsXG4gIC8vIFVzZSB0byB0ZW1wb3JhcmlseSBzdG9yZSBhbmQgdXBkYXRlZCBhY3RpdmVfaG9va3MuYXJyYXkgaWYgdGhlIHVzZXJcbiAgLy8gZW5hYmxlcyBvciBkaXNhYmxlcyBhIGhvb2sgd2hpbGUgaG9va3MgYXJlIGJlaW5nIHByb2Nlc3NlZC4gSWYgYSBob29rIGlzXG4gIC8vIGVuYWJsZWQoKSBvciBkaXNhYmxlZCgpIGR1cmluZyBob29rIGV4ZWN1dGlvbiB0aGVuIHRoZSBjdXJyZW50IHNldCBvZlxuICAvLyBhY3RpdmUgaG9va3MgaXMgZHVwbGljYXRlZCBhbmQgc2V0IGVxdWFsIHRvIGFjdGl2ZV9ob29rcy50bXBfYXJyYXkuIEFueVxuICAvLyBzdWJzZXF1ZW50IGNoYW5nZXMgYXJlIG9uIHRoZSBkdXBsaWNhdGVkIGFycmF5LiBXaGVuIGFsbCBob29rcyBoYXZlXG4gIC8vIGNvbXBsZXRlZCBleGVjdXRpbmcgYWN0aXZlX2hvb2tzLnRtcF9hcnJheSBpcyBhc3NpZ25lZCB0b1xuICAvLyBhY3RpdmVfaG9va3MuYXJyYXkuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIHRtcF9hcnJheTogbnVsbCxcbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgZmllbGQgY291bnRzIGhlbGQgaW4gYWN0aXZlX2hvb2tzLnRtcF9hcnJheS4gQmVjYXVzZSB0aGVcbiAgLy8gYXN5bmNfaG9va19maWVsZHMgY2FuJ3QgYmUgcmVhc3NpZ25lZCwgc3RvcmUgZWFjaCB1aW50MzIgaW4gYW4gYXJyYXkgdGhhdFxuICAvLyBpcyB3cml0dGVuIGJhY2sgdG8gYXN5bmNfaG9va19maWVsZHMgd2hlbiBhY3RpdmVfaG9va3MuYXJyYXkgaXMgcmVzdG9yZWQuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIHRtcF9maWVsZHM6IG51bGwsXG59O1xuXG5leHBvcnQgY29uc3QgcmVnaXN0ZXJEZXN0cm95SG9vayA9IGFzeW5jX3dyYXAucmVnaXN0ZXJEZXN0cm95SG9vaztcbi8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG5jb25zdCB7XG4gIGFzeW5jX2hvb2tfZmllbGRzLFxuICBhc3luY0lkRmllbGRzOiBhc3luY19pZF9maWVsZHMsXG4gIG5ld0FzeW5jSWQsXG4gIGNvbnN0YW50cyxcbn0gPSBhc3luY193cmFwO1xuZXhwb3J0IHsgbmV3QXN5bmNJZCB9O1xuY29uc3Qge1xuICBrSW5pdCxcbiAga0JlZm9yZSxcbiAga0FmdGVyLFxuICBrRGVzdHJveSxcbiAga1Byb21pc2VSZXNvbHZlLFxuICBrVG90YWxzLFxuICBrQ2hlY2ssXG4gIGtEZWZhdWx0VHJpZ2dlckFzeW5jSWQsXG4gIGtTdGFja0xlbmd0aCxcbn0gPSBjb25zdGFudHM7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG5jb25zdCByZXNvdXJjZV9zeW1ib2wgPSBTeW1ib2woXCJyZXNvdXJjZVwiKTtcbi8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG5leHBvcnQgY29uc3QgYXN5bmNfaWRfc3ltYm9sID0gU3ltYm9sKFwidHJpZ2dlcl9hc3luY19pZFwiKTtcbi8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG5leHBvcnQgY29uc3QgdHJpZ2dlcl9hc3luY19pZF9zeW1ib2wgPSBTeW1ib2woXCJ0cmlnZ2VyX2FzeW5jX2lkXCIpO1xuLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbmV4cG9ydCBjb25zdCBpbml0X3N5bWJvbCA9IFN5bWJvbChcImluaXRcIik7XG4vLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuZXhwb3J0IGNvbnN0IGJlZm9yZV9zeW1ib2wgPSBTeW1ib2woXCJiZWZvcmVcIik7XG4vLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuZXhwb3J0IGNvbnN0IGFmdGVyX3N5bWJvbCA9IFN5bWJvbChcImFmdGVyXCIpO1xuLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbmV4cG9ydCBjb25zdCBkZXN0cm95X3N5bWJvbCA9IFN5bWJvbChcImRlc3Ryb3lcIik7XG4vLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuZXhwb3J0IGNvbnN0IHByb21pc2VfcmVzb2x2ZV9zeW1ib2wgPSBTeW1ib2woXCJwcm9taXNlUmVzb2x2ZVwiKTtcblxuZXhwb3J0IGNvbnN0IHN5bWJvbHMgPSB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIGFzeW5jX2lkX3N5bWJvbCxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgdHJpZ2dlcl9hc3luY19pZF9zeW1ib2wsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIGluaXRfc3ltYm9sLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICBiZWZvcmVfc3ltYm9sLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICBhZnRlcl9zeW1ib2wsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gIGRlc3Ryb3lfc3ltYm9sLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICBwcm9taXNlX3Jlc29sdmVfc3ltYm9sLFxufTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIGxvb2t1cFB1YmxpY1Jlc291cmNlKHJlc291cmNlOiBhbnkpIHtcbiAgaWYgKHR5cGVvZiByZXNvdXJjZSAhPT0gXCJvYmplY3RcIiB8fCByZXNvdXJjZSA9PT0gbnVsbCkgcmV0dXJuIHJlc291cmNlO1xuICAvLyBUT0RPKGFkZGFsZWF4KTogTWVyZ2UgdGhpcyB3aXRoIG93bmVyX3N5bWJvbCBhbmQgdXNlIGl0IGFjcm9zcyBhbGxcbiAgLy8gQXN5bmNXcmFwIGluc3RhbmNlcy5cbiAgY29uc3QgcHVibGljUmVzb3VyY2UgPSByZXNvdXJjZVtyZXNvdXJjZV9zeW1ib2xdO1xuICBpZiAocHVibGljUmVzb3VyY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBwdWJsaWNSZXNvdXJjZTtcbiAgfVxuICByZXR1cm4gcmVzb3VyY2U7XG59XG5cbi8vIFVzZWQgYnkgQysrIHRvIGNhbGwgYWxsIGluaXQoKSBjYWxsYmFja3MuIEJlY2F1c2Ugc29tZSBzdGF0ZSBjYW4gYmUgc2V0dXBcbi8vIGZyb20gQysrIHRoZXJlJ3Mgbm8gbmVlZCB0byBwZXJmb3JtIGFsbCB0aGUgc2FtZSBvcGVyYXRpb25zIGFzIGluXG4vLyBlbWl0SW5pdFNjcmlwdC5cbmZ1bmN0aW9uIGVtaXRJbml0TmF0aXZlKFxuICBhc3luY0lkOiBudW1iZXIsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHR5cGU6IGFueSxcbiAgdHJpZ2dlckFzeW5jSWQ6IG51bWJlcixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcmVzb3VyY2U6IGFueSxcbikge1xuICBhY3RpdmVfaG9va3MuY2FsbF9kZXB0aCArPSAxO1xuICByZXNvdXJjZSA9IGxvb2t1cFB1YmxpY1Jlc291cmNlKHJlc291cmNlKTtcbiAgLy8gVXNlIGEgc2luZ2xlIHRyeS9jYXRjaCBmb3IgYWxsIGhvb2tzIHRvIGF2b2lkIHNldHRpbmcgdXAgb25lIHBlciBpdGVyYXRpb24uXG4gIHRyeSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhY3RpdmVfaG9va3MuYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0eXBlb2YgYWN0aXZlX2hvb2tzLmFycmF5W2ldW2luaXRfc3ltYm9sXSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFjdGl2ZV9ob29rcy5hcnJheVtpXVtpbml0X3N5bWJvbF0oXG4gICAgICAgICAgYXN5bmNJZCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHRyaWdnZXJBc3luY0lkLFxuICAgICAgICAgIHJlc291cmNlLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IGU7XG4gIH0gZmluYWxseSB7XG4gICAgYWN0aXZlX2hvb2tzLmNhbGxfZGVwdGggLT0gMTtcbiAgfVxuXG4gIC8vIEhvb2tzIGNhbiBvbmx5IGJlIHJlc3RvcmVkIGlmIHRoZXJlIGhhdmUgYmVlbiBubyByZWN1cnNpdmUgaG9vayBjYWxscy5cbiAgLy8gQWxzbyB0aGUgYWN0aXZlIGhvb2tzIGRvIG5vdCBuZWVkIHRvIGJlIHJlc3RvcmVkIGlmIGVuYWJsZSgpL2Rpc2FibGUoKVxuICAvLyB3ZXJlbid0IGNhbGxlZCBkdXJpbmcgaG9vayBleGVjdXRpb24sIGluIHdoaWNoIGNhc2UgYWN0aXZlX2hvb2tzLnRtcF9hcnJheVxuICAvLyB3aWxsIGJlIG51bGwuXG4gIGlmIChhY3RpdmVfaG9va3MuY2FsbF9kZXB0aCA9PT0gMCAmJiBhY3RpdmVfaG9va3MudG1wX2FycmF5ICE9PSBudWxsKSB7XG4gICAgcmVzdG9yZUFjdGl2ZUhvb2tzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0SG9va0FycmF5cygpOiBbQXN5bmNIb29rW10sIG51bWJlcltdIHwgVWludDMyQXJyYXldIHtcbiAgaWYgKGFjdGl2ZV9ob29rcy5jYWxsX2RlcHRoID09PSAwKSB7XG4gICAgcmV0dXJuIFthY3RpdmVfaG9va3MuYXJyYXksIGFzeW5jX2hvb2tfZmllbGRzXTtcbiAgfVxuICAvLyBJZiB0aGlzIGhvb2sgaXMgYmVpbmcgZW5hYmxlZCB3aGlsZSBpbiB0aGUgbWlkZGxlIG9mIHByb2Nlc3NpbmcgdGhlIGFycmF5XG4gIC8vIG9mIGN1cnJlbnRseSBhY3RpdmUgaG9va3MgdGhlbiBkdXBsaWNhdGUgdGhlIGN1cnJlbnQgc2V0IG9mIGFjdGl2ZSBob29rc1xuICAvLyBhbmQgc3RvcmUgdGhpcyB0aGVyZS4gVGhpcyBzaG91bGRuJ3QgZmlyZSB1bnRpbCB0aGUgbmV4dCB0aW1lIGhvb2tzIGFyZVxuICAvLyBwcm9jZXNzZWQuXG4gIGlmIChhY3RpdmVfaG9va3MudG1wX2FycmF5ID09PSBudWxsKSB7XG4gICAgc3RvcmVBY3RpdmVIb29rcygpO1xuICB9XG4gIHJldHVybiBbYWN0aXZlX2hvb2tzLnRtcF9hcnJheSEsIGFjdGl2ZV9ob29rcy50bXBfZmllbGRzIV07XG59XG5cbmZ1bmN0aW9uIHN0b3JlQWN0aXZlSG9va3MoKSB7XG4gIGFjdGl2ZV9ob29rcy50bXBfYXJyYXkgPSBhY3RpdmVfaG9va3MuYXJyYXkuc2xpY2UoKTtcbiAgLy8gRG9uJ3Qgd2FudCB0byBtYWtlIHRoZSBhc3N1bXB0aW9uIHRoYXQga0luaXQgdG8ga0Rlc3Ryb3kgYXJlIGluZGV4ZXMgMCB0b1xuICAvLyA0LiBTbyBkbyB0aGlzIHRoZSBsb25nIHdheS5cbiAgYWN0aXZlX2hvb2tzLnRtcF9maWVsZHMgPSBbXTtcbiAgY29weUhvb2tzKGFjdGl2ZV9ob29rcy50bXBfZmllbGRzLCBhc3luY19ob29rX2ZpZWxkcyk7XG59XG5cbmZ1bmN0aW9uIGNvcHlIb29rcyhcbiAgZGVzdGluYXRpb246IG51bWJlcltdIHwgVWludDMyQXJyYXksXG4gIHNvdXJjZTogbnVtYmVyW10gfCBVaW50MzJBcnJheSxcbikge1xuICBkZXN0aW5hdGlvbltrSW5pdF0gPSBzb3VyY2Vba0luaXRdO1xuICBkZXN0aW5hdGlvbltrQmVmb3JlXSA9IHNvdXJjZVtrQmVmb3JlXTtcbiAgZGVzdGluYXRpb25ba0FmdGVyXSA9IHNvdXJjZVtrQWZ0ZXJdO1xuICBkZXN0aW5hdGlvbltrRGVzdHJveV0gPSBzb3VyY2Vba0Rlc3Ryb3ldO1xuICBkZXN0aW5hdGlvbltrUHJvbWlzZVJlc29sdmVdID0gc291cmNlW2tQcm9taXNlUmVzb2x2ZV07XG59XG5cbi8vIFRoZW4gcmVzdG9yZSB0aGUgY29ycmVjdCBob29rcyBhcnJheSBpbiBjYXNlIGFueSBob29rcyB3ZXJlIGFkZGVkL3JlbW92ZWRcbi8vIGR1cmluZyBob29rIGNhbGxiYWNrIGV4ZWN1dGlvbi5cbmZ1bmN0aW9uIHJlc3RvcmVBY3RpdmVIb29rcygpIHtcbiAgYWN0aXZlX2hvb2tzLmFycmF5ID0gYWN0aXZlX2hvb2tzLnRtcF9hcnJheSE7XG4gIGNvcHlIb29rcyhhc3luY19ob29rX2ZpZWxkcywgYWN0aXZlX2hvb2tzLnRtcF9maWVsZHMhKTtcblxuICBhY3RpdmVfaG9va3MudG1wX2FycmF5ID0gbnVsbDtcbiAgYWN0aXZlX2hvb2tzLnRtcF9maWVsZHMgPSBudWxsO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLXVudXNlZC12YXJzXG5sZXQgd2FudFByb21pc2VIb29rID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIb29rcygpIHtcbiAgYXN5bmNfaG9va19maWVsZHNba0NoZWNrXSArPSAxO1xuXG4gIC8vIFRPRE8oa3Qzayk6IFVuY29tbWVudCB0aGlzXG4gIC8vIHNldENhbGxiYWNrVHJhbXBvbGluZShjYWxsYmFja1RyYW1wb2xpbmUpO1xufVxuXG5mdW5jdGlvbiBkaXNhYmxlSG9va3MoKSB7XG4gIGFzeW5jX2hvb2tfZmllbGRzW2tDaGVja10gLT0gMTtcblxuICB3YW50UHJvbWlzZUhvb2sgPSBmYWxzZTtcblxuICAvLyBUT0RPKGt0M2spOiBVbmNvbW1lbnQgdGhlIGJlbG93XG4gIC8vIHNldENhbGxiYWNrVHJhbXBvbGluZSgpO1xuXG4gIC8vIERlbGF5IHRoZSBjYWxsIHRvIGBkaXNhYmxlUHJvbWlzZUhvb2soKWAgYmVjYXVzZSB3ZSBtaWdodCBjdXJyZW50bHkgYmVcbiAgLy8gYmV0d2VlbiB0aGUgYGJlZm9yZWAgYW5kIGBhZnRlcmAgY2FsbHMgb2YgYSBQcm9taXNlLlxuICAvLyBUT0RPKGt0M2spOiBVbmNvbW1lbnQgdGhlIGJlbG93XG4gIC8vIGVucXVldWVNaWNyb3Rhc2soZGlzYWJsZVByb21pc2VIb29rSWZOZWNlc3NhcnkpO1xufVxuXG4vLyBSZXR1cm4gdGhlIHRyaWdnZXJBc3luY0lkIG1lYW50IGZvciB0aGUgY29uc3RydWN0b3IgY2FsbGluZyBpdC4gSXQncyB1cCB0b1xuLy8gdGhlIHVzZXIgdG8gc2FmZWd1YXJkIHRoaXMgY2FsbCBhbmQgbWFrZSBzdXJlIGl0J3MgemVybydkIG91dCB3aGVuIHRoZVxuLy8gY29uc3RydWN0b3IgaXMgY29tcGxldGUuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdFRyaWdnZXJBc3luY0lkKCkge1xuICBjb25zdCBkZWZhdWx0VHJpZ2dlckFzeW5jSWQgPVxuICAgIGFzeW5jX2lkX2ZpZWxkc1thc3luY193cmFwLlVpZEZpZWxkcy5rRGVmYXVsdFRyaWdnZXJBc3luY0lkXTtcbiAgLy8gSWYgZGVmYXVsdFRyaWdnZXJBc3luY0lkIGlzbid0IHNldCwgdXNlIHRoZSBleGVjdXRpb25Bc3luY0lkXG4gIGlmIChkZWZhdWx0VHJpZ2dlckFzeW5jSWQgPCAwKSB7XG4gICAgcmV0dXJuIGFzeW5jX2lkX2ZpZWxkc1thc3luY193cmFwLlVpZEZpZWxkcy5rRXhlY3V0aW9uQXN5bmNJZF07XG4gIH1cbiAgcmV0dXJuIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICB0cmlnZ2VyQXN5bmNJZDogbnVtYmVyIHwgdW5kZWZpbmVkLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBibG9jazogKC4uLmFyZzogYW55W10pID0+IHZvaWQsXG4gIC4uLmFyZ3M6IHVua25vd25bXVxuKSB7XG4gIGlmICh0cmlnZ2VyQXN5bmNJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGJsb2NrLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG4gIC8vIENIRUNLKE51bWJlcklzU2FmZUludGVnZXIodHJpZ2dlckFzeW5jSWQpKVxuICAvLyBDSEVDSyh0cmlnZ2VyQXN5bmNJZCA+IDApXG4gIGNvbnN0IG9sZERlZmF1bHRUcmlnZ2VyQXN5bmNJZCA9IGFzeW5jX2lkX2ZpZWxkc1trRGVmYXVsdFRyaWdnZXJBc3luY0lkXTtcbiAgYXN5bmNfaWRfZmllbGRzW2tEZWZhdWx0VHJpZ2dlckFzeW5jSWRdID0gdHJpZ2dlckFzeW5jSWQ7XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYmxvY2suYXBwbHkobnVsbCwgYXJncyk7XG4gIH0gZmluYWxseSB7XG4gICAgYXN5bmNfaWRfZmllbGRzW2tEZWZhdWx0VHJpZ2dlckFzeW5jSWRdID0gb2xkRGVmYXVsdFRyaWdnZXJBc3luY0lkO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhc0hvb2tzKGtleTogbnVtYmVyKSB7XG4gIHJldHVybiBhc3luY19ob29rX2ZpZWxkc1trZXldID4gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZWRIb29rc0V4aXN0KCkge1xuICByZXR1cm4gaGFzSG9va3Moa0NoZWNrKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRIb29rc0V4aXN0KCkge1xuICByZXR1cm4gaGFzSG9va3Moa0luaXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWZ0ZXJIb29rc0V4aXN0KCkge1xuICByZXR1cm4gaGFzSG9va3Moa0FmdGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlc3Ryb3lIb29rc0V4aXN0KCkge1xuICByZXR1cm4gaGFzSG9va3Moa0Rlc3Ryb3kpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvbWlzZVJlc29sdmVIb29rc0V4aXN0KCkge1xuICByZXR1cm4gaGFzSG9va3Moa1Byb21pc2VSZXNvbHZlKTtcbn1cblxuZnVuY3Rpb24gZW1pdEluaXRTY3JpcHQoXG4gIGFzeW5jSWQ6IG51bWJlcixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdHlwZTogYW55LFxuICB0cmlnZ2VyQXN5bmNJZDogbnVtYmVyLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICByZXNvdXJjZTogYW55LFxuKSB7XG4gIC8vIFNob3J0IGNpcmN1aXQgYWxsIGNoZWNrcyBmb3IgdGhlIGNvbW1vbiBjYXNlLiBXaGljaCBpcyB0aGF0IG5vIGhvb2tzIGhhdmVcbiAgLy8gYmVlbiBzZXQuIERvIHRoaXMgdG8gcmVtb3ZlIHBlcmZvcm1hbmNlIGltcGFjdCBmb3IgZW1iZWRkZXJzIChhbmQgY29yZSkuXG4gIGlmICghaGFzSG9va3Moa0luaXQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHRyaWdnZXJBc3luY0lkID09PSBudWxsKSB7XG4gICAgdHJpZ2dlckFzeW5jSWQgPSBnZXREZWZhdWx0VHJpZ2dlckFzeW5jSWQoKTtcbiAgfVxuXG4gIGVtaXRJbml0TmF0aXZlKGFzeW5jSWQsIHR5cGUsIHRyaWdnZXJBc3luY0lkLCByZXNvdXJjZSk7XG59XG5leHBvcnQgeyBlbWl0SW5pdFNjcmlwdCBhcyBlbWl0SW5pdCB9O1xuXG5leHBvcnQgZnVuY3Rpb24gaGFzQXN5bmNJZFN0YWNrKCkge1xuICByZXR1cm4gaGFzSG9va3Moa1N0YWNrTGVuZ3RoKTtcbn1cblxuZXhwb3J0IHsgY29uc3RhbnRzIH07XG5cbnR5cGUgRm4gPSAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duO1xuXG5leHBvcnQgY2xhc3MgQXN5bmNIb29rIHtcbiAgW2luaXRfc3ltYm9sXTogRm47XG4gIFtiZWZvcmVfc3ltYm9sXTogRm47XG4gIFthZnRlcl9zeW1ib2xdOiBGbjtcbiAgW2Rlc3Ryb3lfc3ltYm9sXTogRm47XG4gIFtwcm9taXNlX3Jlc29sdmVfc3ltYm9sXTogRm47XG5cbiAgY29uc3RydWN0b3Ioe1xuICAgIGluaXQsXG4gICAgYmVmb3JlLFxuICAgIGFmdGVyLFxuICAgIGRlc3Ryb3ksXG4gICAgcHJvbWlzZVJlc29sdmUsXG4gIH06IHtcbiAgICBpbml0OiBGbjtcbiAgICBiZWZvcmU6IEZuO1xuICAgIGFmdGVyOiBGbjtcbiAgICBkZXN0cm95OiBGbjtcbiAgICBwcm9taXNlUmVzb2x2ZTogRm47XG4gIH0pIHtcbiAgICBpZiAoaW5pdCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBpbml0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfQVNZTkNfQ0FMTEJBQ0soXCJob29rLmluaXRcIik7XG4gICAgfVxuICAgIGlmIChiZWZvcmUgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgYmVmb3JlICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfQVNZTkNfQ0FMTEJBQ0soXCJob29rLmJlZm9yZVwiKTtcbiAgICB9XG4gICAgaWYgKGFmdGVyICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGFmdGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfQVNZTkNfQ0FMTEJBQ0soXCJob29rLmFmdGVyXCIpO1xuICAgIH1cbiAgICBpZiAoZGVzdHJveSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBkZXN0cm95ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfQVNZTkNfQ0FMTEJBQ0soXCJob29rLmRlc3Ryb3lcIik7XG4gICAgfVxuICAgIGlmIChwcm9taXNlUmVzb2x2ZSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBwcm9taXNlUmVzb2x2ZSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0FTWU5DX0NBTExCQUNLKFwiaG9vay5wcm9taXNlUmVzb2x2ZVwiKTtcbiAgICB9XG5cbiAgICB0aGlzW2luaXRfc3ltYm9sXSA9IGluaXQ7XG4gICAgdGhpc1tiZWZvcmVfc3ltYm9sXSA9IGJlZm9yZTtcbiAgICB0aGlzW2FmdGVyX3N5bWJvbF0gPSBhZnRlcjtcbiAgICB0aGlzW2Rlc3Ryb3lfc3ltYm9sXSA9IGRlc3Ryb3k7XG4gICAgdGhpc1twcm9taXNlX3Jlc29sdmVfc3ltYm9sXSA9IHByb21pc2VSZXNvbHZlO1xuICB9XG5cbiAgZW5hYmxlKCkge1xuICAgIC8vIFRoZSBzZXQgb2YgY2FsbGJhY2tzIGZvciBhIGhvb2sgc2hvdWxkIGJlIHRoZSBzYW1lIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlclxuICAgIC8vIGVuYWJsZSgpL2Rpc2FibGUoKSBhcmUgcnVuIGR1cmluZyB0aGVpciBleGVjdXRpb24uIFRoZSBmb2xsb3dpbmdcbiAgICAvLyByZWZlcmVuY2VzIGFyZSByZWFzc2lnbmVkIHRvIHRoZSB0bXAgYXJyYXlzIGlmIGEgaG9vayBpcyBjdXJyZW50bHkgYmVpbmdcbiAgICAvLyBwcm9jZXNzZWQuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgICBjb25zdCB7IDA6IGhvb2tzX2FycmF5LCAxOiBob29rX2ZpZWxkcyB9ID0gZ2V0SG9va0FycmF5cygpO1xuXG4gICAgLy8gRWFjaCBob29rIGlzIG9ubHkgYWxsb3dlZCB0byBiZSBhZGRlZCBvbmNlLlxuICAgIGlmIChob29rc19hcnJheS5pbmNsdWRlcyh0aGlzKSkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgICBjb25zdCBwcmV2X2tUb3RhbHMgPSBob29rX2ZpZWxkc1trVG90YWxzXTtcblxuICAgIC8vIGNyZWF0ZUhvb2soKSBoYXMgYWxyZWFkeSBlbmZvcmNlZCB0aGF0IHRoZSBjYWxsYmFja3MgYXJlIGFsbCBmdW5jdGlvbnMsXG4gICAgLy8gc28gaGVyZSBzaW1wbHkgaW5jcmVtZW50IHRoZSBjb3VudCBvZiB3aGV0aGVyIGVhY2ggY2FsbGJhY2tzIGV4aXN0cyBvclxuICAgIC8vIG5vdC5cbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSA9IGhvb2tfZmllbGRzW2tJbml0XSArPSArISF0aGlzW2luaXRfc3ltYm9sXTtcbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSArPSBob29rX2ZpZWxkc1trQmVmb3JlXSArPSArISF0aGlzW2JlZm9yZV9zeW1ib2xdO1xuICAgIGhvb2tfZmllbGRzW2tUb3RhbHNdICs9IGhvb2tfZmllbGRzW2tBZnRlcl0gKz0gKyEhdGhpc1thZnRlcl9zeW1ib2xdO1xuICAgIGhvb2tfZmllbGRzW2tUb3RhbHNdICs9IGhvb2tfZmllbGRzW2tEZXN0cm95XSArPSArISF0aGlzW2Rlc3Ryb3lfc3ltYm9sXTtcbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSArPSBob29rX2ZpZWxkc1trUHJvbWlzZVJlc29sdmVdICs9XG4gICAgICArISF0aGlzW3Byb21pc2VfcmVzb2x2ZV9zeW1ib2xdO1xuICAgIGhvb2tzX2FycmF5LnB1c2godGhpcyk7XG5cbiAgICBpZiAocHJldl9rVG90YWxzID09PSAwICYmIGhvb2tfZmllbGRzW2tUb3RhbHNdID4gMCkge1xuICAgICAgZW5hYmxlSG9va3MoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPKGt0M2spOiBVbmNvbW1lbnQgdGhlIGJlbG93XG4gICAgLy8gdXBkYXRlUHJvbWlzZUhvb2tNb2RlKCk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGRpc2FibGUoKSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgICBjb25zdCB7IDA6IGhvb2tzX2FycmF5LCAxOiBob29rX2ZpZWxkcyB9ID0gZ2V0SG9va0FycmF5cygpO1xuXG4gICAgY29uc3QgaW5kZXggPSBob29rc19hcnJheS5pbmRleE9mKHRoaXMpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG4gICAgY29uc3QgcHJldl9rVG90YWxzID0gaG9va19maWVsZHNba1RvdGFsc107XG5cbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSA9IGhvb2tfZmllbGRzW2tJbml0XSAtPSArISF0aGlzW2luaXRfc3ltYm9sXTtcbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSArPSBob29rX2ZpZWxkc1trQmVmb3JlXSAtPSArISF0aGlzW2JlZm9yZV9zeW1ib2xdO1xuICAgIGhvb2tfZmllbGRzW2tUb3RhbHNdICs9IGhvb2tfZmllbGRzW2tBZnRlcl0gLT0gKyEhdGhpc1thZnRlcl9zeW1ib2xdO1xuICAgIGhvb2tfZmllbGRzW2tUb3RhbHNdICs9IGhvb2tfZmllbGRzW2tEZXN0cm95XSAtPSArISF0aGlzW2Rlc3Ryb3lfc3ltYm9sXTtcbiAgICBob29rX2ZpZWxkc1trVG90YWxzXSArPSBob29rX2ZpZWxkc1trUHJvbWlzZVJlc29sdmVdIC09XG4gICAgICArISF0aGlzW3Byb21pc2VfcmVzb2x2ZV9zeW1ib2xdO1xuICAgIGhvb2tzX2FycmF5LnNwbGljZShpbmRleCwgMSk7XG5cbiAgICBpZiAocHJldl9rVG90YWxzID4gMCAmJiBob29rX2ZpZWxkc1trVG90YWxzXSA9PT0gMCkge1xuICAgICAgZGlzYWJsZUhvb2tzKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsNEVBQTRFO0FBRTVFLDZCQUE2QjtBQUM3QixZQUFZLGdCQUFnQixvQ0FBb0M7QUFDaEUsU0FBUyxrQkFBa0IsUUFBUSxjQUFjO0FBQ2pELFNBQVMsYUFBYSxFQUFFLFdBQVcsUUFBUSxpQ0FBaUM7QUFZNUUsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSxvRUFBb0U7QUFDcEUsNkJBQTZCO0FBQzdCLE1BQU0sZUFBNEI7SUFDaEMsd0VBQXdFO0lBQ3hFLG9FQUFvRTtJQUNwRSxtRUFBbUU7SUFDbkUsYUFBYTtJQUNiLE9BQU8sRUFBRTtJQUNULDRFQUE0RTtJQUM1RSxzREFBc0Q7SUFDdEQsNkJBQTZCO0lBQzdCLFlBQVk7SUFDWixzRUFBc0U7SUFDdEUsMkVBQTJFO0lBQzNFLHdFQUF3RTtJQUN4RSwwRUFBMEU7SUFDMUUsc0VBQXNFO0lBQ3RFLDREQUE0RDtJQUM1RCxzQkFBc0I7SUFDdEIsNkJBQTZCO0lBQzdCLFdBQVcsSUFBSTtJQUNmLDZFQUE2RTtJQUM3RSw0RUFBNEU7SUFDNUUsNEVBQTRFO0lBQzVFLDZCQUE2QjtJQUM3QixZQUFZLElBQUk7QUFDbEI7QUFFQSxPQUFPLE1BQU0sc0JBQXNCLFdBQVcsbUJBQW1CLENBQUM7QUFDbEUsNkJBQTZCO0FBQzdCLE1BQU0sRUFDSixrQkFBaUIsRUFDakIsZUFBZSxnQkFBZSxFQUM5QixXQUFVLEVBQ1YsVUFBUyxFQUNWLEdBQUc7QUFDSixTQUFTLFVBQVUsR0FBRztBQUN0QixNQUFNLEVBQ0osTUFBSyxFQUNMLFFBQU8sRUFDUCxPQUFNLEVBQ04sU0FBUSxFQUNSLGdCQUFlLEVBQ2YsUUFBTyxFQUNQLE9BQU0sRUFDTix1QkFBc0IsRUFDdEIsYUFBWSxFQUNiLEdBQUc7QUFFSiw2QkFBNkI7QUFDN0IsTUFBTSxrQkFBa0IsT0FBTztBQUMvQiw2QkFBNkI7QUFDN0IsT0FBTyxNQUFNLGtCQUFrQixPQUFPLG9CQUFvQjtBQUMxRCw2QkFBNkI7QUFDN0IsT0FBTyxNQUFNLDBCQUEwQixPQUFPLG9CQUFvQjtBQUNsRSw2QkFBNkI7QUFDN0IsT0FBTyxNQUFNLGNBQWMsT0FBTyxRQUFRO0FBQzFDLDZCQUE2QjtBQUM3QixPQUFPLE1BQU0sZ0JBQWdCLE9BQU8sVUFBVTtBQUM5Qyw2QkFBNkI7QUFDN0IsT0FBTyxNQUFNLGVBQWUsT0FBTyxTQUFTO0FBQzVDLDZCQUE2QjtBQUM3QixPQUFPLE1BQU0saUJBQWlCLE9BQU8sV0FBVztBQUNoRCw2QkFBNkI7QUFDN0IsT0FBTyxNQUFNLHlCQUF5QixPQUFPLGtCQUFrQjtBQUUvRCxPQUFPLE1BQU0sVUFBVTtJQUNyQiw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7SUFDQSw2QkFBNkI7SUFDN0I7QUFDRixFQUFFO0FBRUYsbUNBQW1DO0FBQ25DLFNBQVMscUJBQXFCLFFBQWEsRUFBRTtJQUMzQyxJQUFJLE9BQU8sYUFBYSxZQUFZLGFBQWEsSUFBSSxFQUFFLE9BQU87SUFDOUQscUVBQXFFO0lBQ3JFLHVCQUF1QjtJQUN2QixNQUFNLGlCQUFpQixRQUFRLENBQUMsZ0JBQWdCO0lBQ2hELElBQUksbUJBQW1CLFdBQVc7UUFDaEMsT0FBTztJQUNULENBQUM7SUFDRCxPQUFPO0FBQ1Q7QUFFQSw0RUFBNEU7QUFDNUUsb0VBQW9FO0FBQ3BFLGtCQUFrQjtBQUNsQixTQUFTLGVBQ1AsT0FBZSxFQUNmLG1DQUFtQztBQUNuQyxJQUFTLEVBQ1QsY0FBc0IsRUFDdEIsbUNBQW1DO0FBQ25DLFFBQWEsRUFDYjtJQUNBLGFBQWEsVUFBVSxJQUFJO0lBQzNCLFdBQVcscUJBQXFCO0lBQ2hDLDhFQUE4RTtJQUM5RSxJQUFJO1FBQ0YsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLGFBQWEsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFLO1lBQ2xELElBQUksT0FBTyxhQUFhLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxLQUFLLFlBQVk7Z0JBQzVELGFBQWEsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQ2hDLFNBQ0EsTUFDQSxnQkFDQTtZQUVKLENBQUM7UUFDSDtJQUNGLEVBQUUsT0FBTyxHQUFHO1FBQ1YsTUFBTSxFQUFFO0lBQ1YsU0FBVTtRQUNSLGFBQWEsVUFBVSxJQUFJO0lBQzdCO0lBRUEseUVBQXlFO0lBQ3pFLHlFQUF5RTtJQUN6RSw2RUFBNkU7SUFDN0UsZ0JBQWdCO0lBQ2hCLElBQUksYUFBYSxVQUFVLEtBQUssS0FBSyxhQUFhLFNBQVMsS0FBSyxJQUFJLEVBQUU7UUFDcEU7SUFDRixDQUFDO0FBQ0g7QUFFQSxTQUFTLGdCQUF1RDtJQUM5RCxJQUFJLGFBQWEsVUFBVSxLQUFLLEdBQUc7UUFDakMsT0FBTztZQUFDLGFBQWEsS0FBSztZQUFFO1NBQWtCO0lBQ2hELENBQUM7SUFDRCw0RUFBNEU7SUFDNUUsMkVBQTJFO0lBQzNFLDBFQUEwRTtJQUMxRSxhQUFhO0lBQ2IsSUFBSSxhQUFhLFNBQVMsS0FBSyxJQUFJLEVBQUU7UUFDbkM7SUFDRixDQUFDO0lBQ0QsT0FBTztRQUFDLGFBQWEsU0FBUztRQUFHLGFBQWEsVUFBVTtLQUFFO0FBQzVEO0FBRUEsU0FBUyxtQkFBbUI7SUFDMUIsYUFBYSxTQUFTLEdBQUcsYUFBYSxLQUFLLENBQUMsS0FBSztJQUNqRCw0RUFBNEU7SUFDNUUsOEJBQThCO0lBQzlCLGFBQWEsVUFBVSxHQUFHLEVBQUU7SUFDNUIsVUFBVSxhQUFhLFVBQVUsRUFBRTtBQUNyQztBQUVBLFNBQVMsVUFDUCxXQUFtQyxFQUNuQyxNQUE4QixFQUM5QjtJQUNBLFdBQVcsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU07SUFDbEMsV0FBVyxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUTtJQUN0QyxXQUFXLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPO0lBQ3BDLFdBQVcsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVM7SUFDeEMsV0FBVyxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxnQkFBZ0I7QUFDeEQ7QUFFQSw0RUFBNEU7QUFDNUUsa0NBQWtDO0FBQ2xDLFNBQVMscUJBQXFCO0lBQzVCLGFBQWEsS0FBSyxHQUFHLGFBQWEsU0FBUztJQUMzQyxVQUFVLG1CQUFtQixhQUFhLFVBQVU7SUFFcEQsYUFBYSxTQUFTLEdBQUcsSUFBSTtJQUM3QixhQUFhLFVBQVUsR0FBRyxJQUFJO0FBQ2hDO0FBRUEsa0NBQWtDO0FBQ2xDLElBQUksa0JBQWtCLEtBQUs7QUFDM0IsU0FBUyxjQUFjO0lBQ3JCLGlCQUFpQixDQUFDLE9BQU8sSUFBSTtBQUU3Qiw2QkFBNkI7QUFDN0IsNkNBQTZDO0FBQy9DO0FBRUEsU0FBUyxlQUFlO0lBQ3RCLGlCQUFpQixDQUFDLE9BQU8sSUFBSTtJQUU3QixrQkFBa0IsS0FBSztBQUV2QixrQ0FBa0M7QUFDbEMsMkJBQTJCO0FBRTNCLHlFQUF5RTtBQUN6RSx1REFBdUQ7QUFDdkQsa0NBQWtDO0FBQ2xDLG1EQUFtRDtBQUNyRDtBQUVBLDZFQUE2RTtBQUM3RSx5RUFBeUU7QUFDekUsMkJBQTJCO0FBQzNCLE9BQU8sU0FBUywyQkFBMkI7SUFDekMsTUFBTSx3QkFDSixlQUFlLENBQUMsV0FBVyxTQUFTLENBQUMsc0JBQXNCLENBQUM7SUFDOUQsK0RBQStEO0lBQy9ELElBQUksd0JBQXdCLEdBQUc7UUFDN0IsT0FBTyxlQUFlLENBQUMsV0FBVyxTQUFTLENBQUMsaUJBQWlCLENBQUM7SUFDaEUsQ0FBQztJQUNELE9BQU87QUFDVCxDQUFDO0FBRUQsT0FBTyxTQUFTLDJCQUNkLGNBQWtDLEVBQ2xDLG1DQUFtQztBQUNuQyxLQUE4QixFQUM5QixHQUFHLElBQWUsRUFDbEI7SUFDQSxJQUFJLG1CQUFtQixXQUFXO1FBQ2hDLE9BQU8sTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFO0lBQzNCLENBQUM7SUFDRCw2Q0FBNkM7SUFDN0MsNEJBQTRCO0lBQzVCLE1BQU0sMkJBQTJCLGVBQWUsQ0FBQyx1QkFBdUI7SUFDeEUsZUFBZSxDQUFDLHVCQUF1QixHQUFHO0lBRTFDLElBQUk7UUFDRixPQUFPLE1BQU0sS0FBSyxDQUFDLElBQUksRUFBRTtJQUMzQixTQUFVO1FBQ1IsZUFBZSxDQUFDLHVCQUF1QixHQUFHO0lBQzVDO0FBQ0YsQ0FBQztBQUVELFNBQVMsU0FBUyxHQUFXLEVBQUU7SUFDN0IsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLEdBQUc7QUFDbEM7QUFFQSxPQUFPLFNBQVMsb0JBQW9CO0lBQ2xDLE9BQU8sU0FBUztBQUNsQixDQUFDO0FBRUQsT0FBTyxTQUFTLGlCQUFpQjtJQUMvQixPQUFPLFNBQVM7QUFDbEIsQ0FBQztBQUVELE9BQU8sU0FBUyxrQkFBa0I7SUFDaEMsT0FBTyxTQUFTO0FBQ2xCLENBQUM7QUFFRCxPQUFPLFNBQVMsb0JBQW9CO0lBQ2xDLE9BQU8sU0FBUztBQUNsQixDQUFDO0FBRUQsT0FBTyxTQUFTLDJCQUEyQjtJQUN6QyxPQUFPLFNBQVM7QUFDbEIsQ0FBQztBQUVELFNBQVMsZUFDUCxPQUFlLEVBQ2YsbUNBQW1DO0FBQ25DLElBQVMsRUFDVCxjQUFzQixFQUN0QixtQ0FBbUM7QUFDbkMsUUFBYSxFQUNiO0lBQ0EsNEVBQTRFO0lBQzVFLDJFQUEyRTtJQUMzRSxJQUFJLENBQUMsU0FBUyxRQUFRO1FBQ3BCO0lBQ0YsQ0FBQztJQUVELElBQUksbUJBQW1CLElBQUksRUFBRTtRQUMzQixpQkFBaUI7SUFDbkIsQ0FBQztJQUVELGVBQWUsU0FBUyxNQUFNLGdCQUFnQjtBQUNoRDtBQUNBLFNBQVMsa0JBQWtCLFFBQVEsR0FBRztBQUV0QyxPQUFPLFNBQVMsa0JBQWtCO0lBQ2hDLE9BQU8sU0FBUztBQUNsQixDQUFDO0FBRUQsU0FBUyxTQUFTLEdBQUc7QUFJckIsT0FBTyxNQUFNO0lBQ1gsQ0FBQyxZQUFZLENBQUs7SUFDbEIsQ0FBQyxjQUFjLENBQUs7SUFDcEIsQ0FBQyxhQUFhLENBQUs7SUFDbkIsQ0FBQyxlQUFlLENBQUs7SUFDckIsQ0FBQyx1QkFBdUIsQ0FBSztJQUU3QixZQUFZLEVBQ1YsS0FBSSxFQUNKLE9BQU0sRUFDTixNQUFLLEVBQ0wsUUFBTyxFQUNQLGVBQWMsRUFPZixDQUFFO1FBQ0QsSUFBSSxTQUFTLGFBQWEsT0FBTyxTQUFTLFlBQVk7WUFDcEQsTUFBTSxJQUFJLG1CQUFtQixhQUFhO1FBQzVDLENBQUM7UUFDRCxJQUFJLFdBQVcsYUFBYSxPQUFPLFdBQVcsWUFBWTtZQUN4RCxNQUFNLElBQUksbUJBQW1CLGVBQWU7UUFDOUMsQ0FBQztRQUNELElBQUksVUFBVSxhQUFhLE9BQU8sVUFBVSxZQUFZO1lBQ3RELE1BQU0sSUFBSSxtQkFBbUIsY0FBYztRQUM3QyxDQUFDO1FBQ0QsSUFBSSxZQUFZLGFBQWEsT0FBTyxZQUFZLFlBQVk7WUFDMUQsTUFBTSxJQUFJLG1CQUFtQixnQkFBZ0I7UUFDL0MsQ0FBQztRQUNELElBQUksbUJBQW1CLGFBQWEsT0FBTyxtQkFBbUIsWUFBWTtZQUN4RSxNQUFNLElBQUksbUJBQW1CLHVCQUF1QjtRQUN0RCxDQUFDO1FBRUQsSUFBSSxDQUFDLFlBQVksR0FBRztRQUNwQixJQUFJLENBQUMsY0FBYyxHQUFHO1FBQ3RCLElBQUksQ0FBQyxhQUFhLEdBQUc7UUFDckIsSUFBSSxDQUFDLGVBQWUsR0FBRztRQUN2QixJQUFJLENBQUMsdUJBQXVCLEdBQUc7SUFDakM7SUFFQSxTQUFTO1FBQ1AsMkVBQTJFO1FBQzNFLG1FQUFtRTtRQUNuRSwyRUFBMkU7UUFDM0UsYUFBYTtRQUNiLDZCQUE2QjtRQUM3QixNQUFNLEVBQUUsR0FBRyxZQUFXLEVBQUUsR0FBRyxZQUFXLEVBQUUsR0FBRztRQUUzQyw4Q0FBOEM7UUFDOUMsSUFBSSxZQUFZLFFBQVEsQ0FBQyxJQUFJLEdBQUc7WUFDOUIsT0FBTyxJQUFJO1FBQ2IsQ0FBQztRQUVELDZCQUE2QjtRQUM3QixNQUFNLGVBQWUsV0FBVyxDQUFDLFFBQVE7UUFFekMsMEVBQTBFO1FBQzFFLHlFQUF5RTtRQUN6RSxPQUFPO1FBQ1AsV0FBVyxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO1FBQ2pFLFdBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztRQUN0RSxXQUFXLENBQUMsUUFBUSxJQUFJLFdBQVcsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7UUFDcEUsV0FBVyxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlO1FBQ3hFLFdBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLGdCQUFnQixJQUNsRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCO1FBQ2pDLFlBQVksSUFBSSxDQUFDLElBQUk7UUFFckIsSUFBSSxpQkFBaUIsS0FBSyxXQUFXLENBQUMsUUFBUSxHQUFHLEdBQUc7WUFDbEQ7UUFDRixDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLDJCQUEyQjtRQUUzQixPQUFPLElBQUk7SUFDYjtJQUVBLFVBQVU7UUFDUiw2QkFBNkI7UUFDN0IsTUFBTSxFQUFFLEdBQUcsWUFBVyxFQUFFLEdBQUcsWUFBVyxFQUFFLEdBQUc7UUFFM0MsTUFBTSxRQUFRLFlBQVksT0FBTyxDQUFDLElBQUk7UUFDdEMsSUFBSSxVQUFVLENBQUMsR0FBRztZQUNoQixPQUFPLElBQUk7UUFDYixDQUFDO1FBRUQsNkJBQTZCO1FBQzdCLE1BQU0sZUFBZSxXQUFXLENBQUMsUUFBUTtRQUV6QyxXQUFXLENBQUMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVk7UUFDakUsV0FBVyxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO1FBQ3RFLFdBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtRQUNwRSxXQUFXLENBQUMsUUFBUSxJQUFJLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWU7UUFDeEUsV0FBVyxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsZ0JBQWdCLElBQ2xELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUI7UUFDakMsWUFBWSxNQUFNLENBQUMsT0FBTztRQUUxQixJQUFJLGVBQWUsS0FBSyxXQUFXLENBQUMsUUFBUSxLQUFLLEdBQUc7WUFDbEQ7UUFDRixDQUFDO1FBRUQsT0FBTyxJQUFJO0lBQ2I7QUFDRixDQUFDIn0=