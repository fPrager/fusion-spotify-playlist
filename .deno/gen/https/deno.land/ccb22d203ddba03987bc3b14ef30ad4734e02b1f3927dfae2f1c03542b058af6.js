// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { ERR_ASYNC_TYPE, ERR_INVALID_ASYNC_ID } from "./internal/errors.ts";
import { validateFunction, validateString } from "./internal/validators.mjs";
import { // deno-lint-ignore camelcase
async_id_symbol, destroyHooksExist, emitInit, enabledHooksExist, getDefaultTriggerAsyncId, hasAsyncIdStack, initHooksExist, newAsyncId, registerDestroyHook, // deno-lint-ignore camelcase
trigger_async_id_symbol } from "./internal/async_hooks.ts";
const destroyedSymbol = Symbol("destroyed");
export class AsyncResource {
    [async_id_symbol];
    [trigger_async_id_symbol];
    [destroyedSymbol];
    constructor(type, opts = {}){
        validateString(type, "type");
        let triggerAsyncId;
        let requireManualDestroy = false;
        if (typeof opts !== "number") {
            triggerAsyncId = opts.triggerAsyncId === undefined ? getDefaultTriggerAsyncId() : opts.triggerAsyncId;
            requireManualDestroy = !!opts.requireManualDestroy;
        } else {
            triggerAsyncId = opts;
        }
        // Unlike emitInitScript, AsyncResource doesn't supports null as the
        // triggerAsyncId.
        if (!Number.isSafeInteger(triggerAsyncId) || triggerAsyncId < -1) {
            throw new ERR_INVALID_ASYNC_ID("triggerAsyncId", triggerAsyncId);
        }
        const asyncId = newAsyncId();
        this[async_id_symbol] = asyncId;
        this[trigger_async_id_symbol] = triggerAsyncId;
        if (initHooksExist()) {
            if (enabledHooksExist() && type.length === 0) {
                throw new ERR_ASYNC_TYPE(type);
            }
            emitInit(asyncId, type, triggerAsyncId, this);
        }
        if (!requireManualDestroy && destroyHooksExist()) {
            // This prop name (destroyed) has to be synchronized with C++
            const destroyed = {
                destroyed: false
            };
            this[destroyedSymbol] = destroyed;
            registerDestroyHook(this, asyncId, destroyed);
        }
    }
    runInAsyncScope(fn, thisArg, ...args) {
        // deno-lint-ignore no-unused-vars
        const asyncId = this[async_id_symbol];
        // TODO(kt3k): Uncomment the below
        // emitBefore(asyncId, this[trigger_async_id_symbol], this);
        try {
            const ret = Reflect.apply(fn, thisArg, args);
            return ret;
        } finally{
            if (hasAsyncIdStack()) {
            // TODO(kt3k): Uncomment the below
            // emitAfter(asyncId);
            }
        }
    }
    emitDestroy() {
        if (this[destroyedSymbol] !== undefined) {
            this[destroyedSymbol].destroyed = true;
        }
        // TODO(kt3k): Uncomment the below
        // emitDestroy(this[async_id_symbol]);
        return this;
    }
    asyncId() {
        return this[async_id_symbol];
    }
    triggerAsyncId() {
        return this[trigger_async_id_symbol];
    }
    bind(fn, thisArg = this) {
        validateFunction(fn, "fn");
        const ret = this.runInAsyncScope.bind(this, fn, thisArg);
        Object.defineProperties(ret, {
            "length": {
                configurable: true,
                enumerable: false,
                value: fn.length,
                writable: false
            },
            "asyncResource": {
                configurable: true,
                enumerable: true,
                value: this,
                writable: true
            }
        });
        return ret;
    }
    static bind(fn, type, thisArg) {
        type = type || fn.name;
        return new AsyncResource(type || "bound-anonymous-fn").bind(fn, thisArg);
    }
}
export function executionAsyncId() {
    return 1;
}
class AsyncHook {
    enable() {}
    disable() {}
}
export function createHook() {
    return new AsyncHook();
}
// Placing all exports down here because the exported classes won't export
// otherwise.
export default {
    // Embedder API
    AsyncResource,
    executionAsyncId,
    createHook
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvYXN5bmNfaG9va3MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQgYW5kIE5vZGUgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgRVJSX0FTWU5DX1RZUEUsIEVSUl9JTlZBTElEX0FTWU5DX0lEIH0gZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUZ1bmN0aW9uLCB2YWxpZGF0ZVN0cmluZyB9IGZyb20gXCIuL2ludGVybmFsL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuICBhc3luY19pZF9zeW1ib2wsXG4gIGRlc3Ryb3lIb29rc0V4aXN0LFxuICBlbWl0SW5pdCxcbiAgZW5hYmxlZEhvb2tzRXhpc3QsXG4gIGdldERlZmF1bHRUcmlnZ2VyQXN5bmNJZCxcbiAgaGFzQXN5bmNJZFN0YWNrLFxuICBpbml0SG9va3NFeGlzdCxcbiAgbmV3QXN5bmNJZCxcbiAgcmVnaXN0ZXJEZXN0cm95SG9vayxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgdHJpZ2dlcl9hc3luY19pZF9zeW1ib2wsXG59IGZyb20gXCIuL2ludGVybmFsL2FzeW5jX2hvb2tzLnRzXCI7XG5cbmNvbnN0IGRlc3Ryb3llZFN5bWJvbCA9IFN5bWJvbChcImRlc3Ryb3llZFwiKTtcblxudHlwZSBBc3luY1Jlc291cmNlT3B0aW9ucyA9IG51bWJlciB8IHtcbiAgdHJpZ2dlckFzeW5jSWQ/OiBudW1iZXI7XG4gIHJlcXVpcmVNYW51YWxEZXN0cm95PzogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBjbGFzcyBBc3luY1Jlc291cmNlIHtcbiAgW2FzeW5jX2lkX3N5bWJvbF06IG51bWJlcjtcbiAgW3RyaWdnZXJfYXN5bmNfaWRfc3ltYm9sXTogbnVtYmVyO1xuICBbZGVzdHJveWVkU3ltYm9sXSE6IHsgZGVzdHJveWVkOiBib29sZWFuIH07XG5cbiAgY29uc3RydWN0b3IodHlwZTogc3RyaW5nLCBvcHRzOiBBc3luY1Jlc291cmNlT3B0aW9ucyA9IHt9KSB7XG4gICAgdmFsaWRhdGVTdHJpbmcodHlwZSwgXCJ0eXBlXCIpO1xuXG4gICAgbGV0IHRyaWdnZXJBc3luY0lkOiBudW1iZXI7XG4gICAgbGV0IHJlcXVpcmVNYW51YWxEZXN0cm95ID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvcHRzICE9PSBcIm51bWJlclwiKSB7XG4gICAgICB0cmlnZ2VyQXN5bmNJZCA9IG9wdHMudHJpZ2dlckFzeW5jSWQgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IGdldERlZmF1bHRUcmlnZ2VyQXN5bmNJZCgpXG4gICAgICAgIDogb3B0cy50cmlnZ2VyQXN5bmNJZDtcbiAgICAgIHJlcXVpcmVNYW51YWxEZXN0cm95ID0gISFvcHRzLnJlcXVpcmVNYW51YWxEZXN0cm95O1xuICAgIH0gZWxzZSB7XG4gICAgICB0cmlnZ2VyQXN5bmNJZCA9IG9wdHM7XG4gICAgfVxuXG4gICAgLy8gVW5saWtlIGVtaXRJbml0U2NyaXB0LCBBc3luY1Jlc291cmNlIGRvZXNuJ3Qgc3VwcG9ydHMgbnVsbCBhcyB0aGVcbiAgICAvLyB0cmlnZ2VyQXN5bmNJZC5cbiAgICBpZiAoIU51bWJlci5pc1NhZmVJbnRlZ2VyKHRyaWdnZXJBc3luY0lkKSB8fCB0cmlnZ2VyQXN5bmNJZCA8IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVNZTkNfSUQoXCJ0cmlnZ2VyQXN5bmNJZFwiLCB0cmlnZ2VyQXN5bmNJZCk7XG4gICAgfVxuXG4gICAgY29uc3QgYXN5bmNJZCA9IG5ld0FzeW5jSWQoKTtcbiAgICB0aGlzW2FzeW5jX2lkX3N5bWJvbF0gPSBhc3luY0lkO1xuICAgIHRoaXNbdHJpZ2dlcl9hc3luY19pZF9zeW1ib2xdID0gdHJpZ2dlckFzeW5jSWQ7XG5cbiAgICBpZiAoaW5pdEhvb2tzRXhpc3QoKSkge1xuICAgICAgaWYgKGVuYWJsZWRIb29rc0V4aXN0KCkgJiYgdHlwZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVSUl9BU1lOQ19UWVBFKHR5cGUpO1xuICAgICAgfVxuXG4gICAgICBlbWl0SW5pdChhc3luY0lkLCB0eXBlLCB0cmlnZ2VyQXN5bmNJZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgaWYgKCFyZXF1aXJlTWFudWFsRGVzdHJveSAmJiBkZXN0cm95SG9va3NFeGlzdCgpKSB7XG4gICAgICAvLyBUaGlzIHByb3AgbmFtZSAoZGVzdHJveWVkKSBoYXMgdG8gYmUgc3luY2hyb25pemVkIHdpdGggQysrXG4gICAgICBjb25zdCBkZXN0cm95ZWQgPSB7IGRlc3Ryb3llZDogZmFsc2UgfTtcbiAgICAgIHRoaXNbZGVzdHJveWVkU3ltYm9sXSA9IGRlc3Ryb3llZDtcbiAgICAgIHJlZ2lzdGVyRGVzdHJveUhvb2sodGhpcywgYXN5bmNJZCwgZGVzdHJveWVkKTtcbiAgICB9XG4gIH1cblxuICBydW5JbkFzeW5jU2NvcGUoXG4gICAgZm46ICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24sXG4gICAgdGhpc0FyZzogdW5rbm93bixcbiAgICAuLi5hcmdzOiB1bmtub3duW11cbiAgKSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby11bnVzZWQtdmFyc1xuICAgIGNvbnN0IGFzeW5jSWQgPSB0aGlzW2FzeW5jX2lkX3N5bWJvbF07XG4gICAgLy8gVE9ETyhrdDNrKTogVW5jb21tZW50IHRoZSBiZWxvd1xuICAgIC8vIGVtaXRCZWZvcmUoYXN5bmNJZCwgdGhpc1t0cmlnZ2VyX2FzeW5jX2lkX3N5bWJvbF0sIHRoaXMpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJldCA9IFJlZmxlY3QuYXBwbHkoZm4sIHRoaXNBcmcsIGFyZ3MpO1xuXG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoaGFzQXN5bmNJZFN0YWNrKCkpIHtcbiAgICAgICAgLy8gVE9ETyhrdDNrKTogVW5jb21tZW50IHRoZSBiZWxvd1xuICAgICAgICAvLyBlbWl0QWZ0ZXIoYXN5bmNJZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZW1pdERlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXNbZGVzdHJveWVkU3ltYm9sXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzW2Rlc3Ryb3llZFN5bWJvbF0uZGVzdHJveWVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gVE9ETyhrdDNrKTogVW5jb21tZW50IHRoZSBiZWxvd1xuICAgIC8vIGVtaXREZXN0cm95KHRoaXNbYXN5bmNfaWRfc3ltYm9sXSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBhc3luY0lkKCkge1xuICAgIHJldHVybiB0aGlzW2FzeW5jX2lkX3N5bWJvbF07XG4gIH1cblxuICB0cmlnZ2VyQXN5bmNJZCgpIHtcbiAgICByZXR1cm4gdGhpc1t0cmlnZ2VyX2FzeW5jX2lkX3N5bWJvbF07XG4gIH1cblxuICBiaW5kKGZuOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duLCB0aGlzQXJnID0gdGhpcykge1xuICAgIHZhbGlkYXRlRnVuY3Rpb24oZm4sIFwiZm5cIik7XG4gICAgY29uc3QgcmV0ID0gdGhpcy5ydW5JbkFzeW5jU2NvcGUuYmluZChcbiAgICAgIHRoaXMsXG4gICAgICBmbixcbiAgICAgIHRoaXNBcmcsXG4gICAgKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZXQsIHtcbiAgICAgIFwibGVuZ3RoXCI6IHtcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgdmFsdWU6IGZuLmxlbmd0aCxcbiAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiYXN5bmNSZXNvdXJjZVwiOiB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgdmFsdWU6IHRoaXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgc3RhdGljIGJpbmQoXG4gICAgZm46ICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24sXG4gICAgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIHRoaXNBcmc6IEFzeW5jUmVzb3VyY2UgfCB1bmRlZmluZWQsXG4gICkge1xuICAgIHR5cGUgPSB0eXBlIHx8IGZuLm5hbWU7XG4gICAgcmV0dXJuIChuZXcgQXN5bmNSZXNvdXJjZSh0eXBlIHx8IFwiYm91bmQtYW5vbnltb3VzLWZuXCIpKS5iaW5kKGZuLCB0aGlzQXJnKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0aW9uQXN5bmNJZCgpIHtcbiAgcmV0dXJuIDE7XG59XG5cbmNsYXNzIEFzeW5jSG9vayB7XG4gIGVuYWJsZSgpIHtcbiAgfVxuXG4gIGRpc2FibGUoKSB7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhvb2soKSB7XG4gIHJldHVybiBuZXcgQXN5bmNIb29rKCk7XG59XG5cbi8vIFBsYWNpbmcgYWxsIGV4cG9ydHMgZG93biBoZXJlIGJlY2F1c2UgdGhlIGV4cG9ydGVkIGNsYXNzZXMgd29uJ3QgZXhwb3J0XG4vLyBvdGhlcndpc2UuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8vIEVtYmVkZGVyIEFQSVxuICBBc3luY1Jlc291cmNlLFxuICBleGVjdXRpb25Bc3luY0lkLFxuICBjcmVhdGVIb29rLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsNEVBQTRFO0FBRTVFLFNBQVMs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