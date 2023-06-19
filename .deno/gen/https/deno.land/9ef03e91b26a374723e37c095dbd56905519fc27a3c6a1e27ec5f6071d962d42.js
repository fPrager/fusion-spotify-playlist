// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
// deno-lint-ignore-file no-inner-declarations
import { core } from "./_core.ts";
import { validateFunction } from "./internal/validators.mjs";
import { _exiting } from "./_process/exiting.ts";
import { FixedQueue } from "./internal/fixed_queue.ts";
const queue = new FixedQueue();
// deno-lint-ignore no-explicit-any
let _nextTick;
export function processTicksAndRejections() {
    let tock;
    do {
        // deno-lint-ignore no-cond-assign
        while(tock = queue.shift()){
            // FIXME(bartlomieju): Deno currently doesn't support async hooks
            // const asyncId = tock[async_id_symbol];
            // emitBefore(asyncId, tock[trigger_async_id_symbol], tock);
            try {
                const callback = tock.callback;
                if (tock.args === undefined) {
                    callback();
                } else {
                    const args = tock.args;
                    switch(args.length){
                        case 1:
                            callback(args[0]);
                            break;
                        case 2:
                            callback(args[0], args[1]);
                            break;
                        case 3:
                            callback(args[0], args[1], args[2]);
                            break;
                        case 4:
                            callback(args[0], args[1], args[2], args[3]);
                            break;
                        default:
                            callback(...args);
                    }
                }
            } finally{
            // FIXME(bartlomieju): Deno currently doesn't support async hooks
            // if (destroyHooksExist())
            // emitDestroy(asyncId);
            }
        // FIXME(bartlomieju): Deno currently doesn't support async hooks
        // emitAfter(asyncId);
        }
        core.runMicrotasks();
    // FIXME(bartlomieju): Deno currently doesn't unhandled rejections
    // } while (!queue.isEmpty() || processPromiseRejections());
    }while (!queue.isEmpty())
    core.setHasTickScheduled(false);
// FIXME(bartlomieju): Deno currently doesn't unhandled rejections
// setHasRejectionToWarn(false);
}
if (typeof core.setNextTickCallback !== "undefined") {
    function runNextTicks() {
        // FIXME(bartlomieju): Deno currently doesn't unhandled rejections
        // if (!hasTickScheduled() && !hasRejectionToWarn())
        //   runMicrotasks();
        // if (!hasTickScheduled() && !hasRejectionToWarn())
        //   return;
        if (!core.hasTickScheduled()) {
            core.runMicrotasks();
        }
        if (!core.hasTickScheduled()) {
            return true;
        }
        processTicksAndRejections();
        return true;
    }
    core.setNextTickCallback(processTicksAndRejections);
    core.setMacrotaskCallback(runNextTicks);
    function __nextTickNative(callback, ...args) {
        validateFunction(callback, "callback");
        if (_exiting) {
            return;
        }
        // TODO(bartlomieju): seems superfluous if we don't depend on `arguments`
        let args_;
        switch(args.length){
            case 0:
                break;
            case 1:
                args_ = [
                    args[0]
                ];
                break;
            case 2:
                args_ = [
                    args[0],
                    args[1]
                ];
                break;
            case 3:
                args_ = [
                    args[0],
                    args[1],
                    args[2]
                ];
                break;
            default:
                args_ = new Array(args.length);
                for(let i = 0; i < args.length; i++){
                    args_[i] = args[i];
                }
        }
        if (queue.isEmpty()) {
            core.setHasTickScheduled(true);
        }
        // FIXME(bartlomieju): Deno currently doesn't support async hooks
        // const asyncId = newAsyncId();
        // const triggerAsyncId = getDefaultTriggerAsyncId();
        const tickObject = {
            // FIXME(bartlomieju): Deno currently doesn't support async hooks
            // [async_id_symbol]: asyncId,
            // [trigger_async_id_symbol]: triggerAsyncId,
            callback,
            args: args_
        };
        // FIXME(bartlomieju): Deno currently doesn't support async hooks
        // if (initHooksExist())
        //   emitInit(asyncId, 'TickObject', triggerAsyncId, tickObject);
        queue.push(tickObject);
    }
    _nextTick = __nextTickNative;
} else {
    function __nextTickQueueMicrotask(callback, ...args) {
        if (args) {
            queueMicrotask(()=>callback.call(this, ...args));
        } else {
            queueMicrotask(callback);
        }
    }
    _nextTick = __nextTickQueueMicrotask;
}
export function nextTick(callback, ...args) {
    _nextTick(callback, ...args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX25leHRfdGljay50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG5cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby1pbm5lci1kZWNsYXJhdGlvbnNcblxuaW1wb3J0IHsgY29yZSB9IGZyb20gXCIuL19jb3JlLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUZ1bmN0aW9uIH0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IF9leGl0aW5nIH0gZnJvbSBcIi4vX3Byb2Nlc3MvZXhpdGluZy50c1wiO1xuaW1wb3J0IHsgRml4ZWRRdWV1ZSB9IGZyb20gXCIuL2ludGVybmFsL2ZpeGVkX3F1ZXVlLnRzXCI7XG5cbmludGVyZmFjZSBUb2NrIHtcbiAgY2FsbGJhY2s6ICguLi5hcmdzOiBBcnJheTx1bmtub3duPikgPT4gdm9pZDtcbiAgYXJnczogQXJyYXk8dW5rbm93bj47XG59XG5cbmNvbnN0IHF1ZXVlID0gbmV3IEZpeGVkUXVldWUoKTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmxldCBfbmV4dFRpY2s6IGFueTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NUaWNrc0FuZFJlamVjdGlvbnMoKSB7XG4gIGxldCB0b2NrO1xuICBkbyB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1jb25kLWFzc2lnblxuICAgIHdoaWxlICh0b2NrID0gcXVldWUuc2hpZnQoKSkge1xuICAgICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAgIC8vIGNvbnN0IGFzeW5jSWQgPSB0b2NrW2FzeW5jX2lkX3N5bWJvbF07XG4gICAgICAvLyBlbWl0QmVmb3JlKGFzeW5jSWQsIHRvY2tbdHJpZ2dlcl9hc3luY19pZF9zeW1ib2xdLCB0b2NrKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSAodG9jayBhcyBUb2NrKS5jYWxsYmFjaztcbiAgICAgICAgaWYgKCh0b2NrIGFzIFRvY2spLmFyZ3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgYXJncyA9ICh0b2NrIGFzIFRvY2spLmFyZ3M7XG4gICAgICAgICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICBjYWxsYmFjayhhcmdzWzBdKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgY2FsbGJhY2soYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgICBjYWxsYmFjayhhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBjYWxsYmFjayguLi5hcmdzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCBzdXBwb3J0IGFzeW5jIGhvb2tzXG4gICAgICAgIC8vIGlmIChkZXN0cm95SG9va3NFeGlzdCgpKVxuICAgICAgICAvLyBlbWl0RGVzdHJveShhc3luY0lkKTtcbiAgICAgIH1cblxuICAgICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAgIC8vIGVtaXRBZnRlcihhc3luY0lkKTtcbiAgICB9XG4gICAgY29yZS5ydW5NaWNyb3Rhc2tzKCk7XG4gICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHVuaGFuZGxlZCByZWplY3Rpb25zXG4gICAgLy8gfSB3aGlsZSAoIXF1ZXVlLmlzRW1wdHkoKSB8fCBwcm9jZXNzUHJvbWlzZVJlamVjdGlvbnMoKSk7XG4gIH0gd2hpbGUgKCFxdWV1ZS5pc0VtcHR5KCkpO1xuICBjb3JlLnNldEhhc1RpY2tTY2hlZHVsZWQoZmFsc2UpO1xuICAvLyBGSVhNRShiYXJ0bG9taWVqdSk6IERlbm8gY3VycmVudGx5IGRvZXNuJ3QgdW5oYW5kbGVkIHJlamVjdGlvbnNcbiAgLy8gc2V0SGFzUmVqZWN0aW9uVG9XYXJuKGZhbHNlKTtcbn1cblxuaWYgKHR5cGVvZiBjb3JlLnNldE5leHRUaWNrQ2FsbGJhY2sgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgZnVuY3Rpb24gcnVuTmV4dFRpY2tzKCkge1xuICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCB1bmhhbmRsZWQgcmVqZWN0aW9uc1xuICAgIC8vIGlmICghaGFzVGlja1NjaGVkdWxlZCgpICYmICFoYXNSZWplY3Rpb25Ub1dhcm4oKSlcbiAgICAvLyAgIHJ1bk1pY3JvdGFza3MoKTtcbiAgICAvLyBpZiAoIWhhc1RpY2tTY2hlZHVsZWQoKSAmJiAhaGFzUmVqZWN0aW9uVG9XYXJuKCkpXG4gICAgLy8gICByZXR1cm47XG4gICAgaWYgKCFjb3JlLmhhc1RpY2tTY2hlZHVsZWQoKSkge1xuICAgICAgY29yZS5ydW5NaWNyb3Rhc2tzKCk7XG4gICAgfVxuICAgIGlmICghY29yZS5oYXNUaWNrU2NoZWR1bGVkKCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByb2Nlc3NUaWNrc0FuZFJlamVjdGlvbnMoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvcmUuc2V0TmV4dFRpY2tDYWxsYmFjayhwcm9jZXNzVGlja3NBbmRSZWplY3Rpb25zKTtcbiAgY29yZS5zZXRNYWNyb3Rhc2tDYWxsYmFjayhydW5OZXh0VGlja3MpO1xuXG4gIGZ1bmN0aW9uIF9fbmV4dFRpY2tOYXRpdmU8VCBleHRlbmRzIEFycmF5PHVua25vd24+PihcbiAgICB0aGlzOiB1bmtub3duLFxuICAgIGNhbGxiYWNrOiAoLi4uYXJnczogVCkgPT4gdm9pZCxcbiAgICAuLi5hcmdzOiBUXG4gICkge1xuICAgIHZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG5cbiAgICBpZiAoX2V4aXRpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUT0RPKGJhcnRsb21pZWp1KTogc2VlbXMgc3VwZXJmbHVvdXMgaWYgd2UgZG9uJ3QgZGVwZW5kIG9uIGBhcmd1bWVudHNgXG4gICAgbGV0IGFyZ3NfO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIGFyZ3NfID0gW2FyZ3NbMF1dO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgYXJnc18gPSBbYXJnc1swXSwgYXJnc1sxXV07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBhcmdzXyA9IFthcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzXyA9IG5ldyBBcnJheShhcmdzLmxlbmd0aCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGFyZ3NfW2ldID0gYXJnc1tpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChxdWV1ZS5pc0VtcHR5KCkpIHtcbiAgICAgIGNvcmUuc2V0SGFzVGlja1NjaGVkdWxlZCh0cnVlKTtcbiAgICB9XG4gICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAvLyBjb25zdCBhc3luY0lkID0gbmV3QXN5bmNJZCgpO1xuICAgIC8vIGNvbnN0IHRyaWdnZXJBc3luY0lkID0gZ2V0RGVmYXVsdFRyaWdnZXJBc3luY0lkKCk7XG4gICAgY29uc3QgdGlja09iamVjdCA9IHtcbiAgICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCBzdXBwb3J0IGFzeW5jIGhvb2tzXG4gICAgICAvLyBbYXN5bmNfaWRfc3ltYm9sXTogYXN5bmNJZCxcbiAgICAgIC8vIFt0cmlnZ2VyX2FzeW5jX2lkX3N5bWJvbF06IHRyaWdnZXJBc3luY0lkLFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBhcmdzOiBhcmdzXyxcbiAgICB9O1xuICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCBzdXBwb3J0IGFzeW5jIGhvb2tzXG4gICAgLy8gaWYgKGluaXRIb29rc0V4aXN0KCkpXG4gICAgLy8gICBlbWl0SW5pdChhc3luY0lkLCAnVGlja09iamVjdCcsIHRyaWdnZXJBc3luY0lkLCB0aWNrT2JqZWN0KTtcbiAgICBxdWV1ZS5wdXNoKHRpY2tPYmplY3QpO1xuICB9XG4gIF9uZXh0VGljayA9IF9fbmV4dFRpY2tOYXRpdmU7XG59IGVsc2Uge1xuICBmdW5jdGlvbiBfX25leHRUaWNrUXVldWVNaWNyb3Rhc2s8VCBleHRlbmRzIEFycmF5PHVua25vd24+PihcbiAgICB0aGlzOiB1bmtub3duLFxuICAgIGNhbGxiYWNrOiAoLi4uYXJnczogVCkgPT4gdm9pZCxcbiAgICAuLi5hcmdzOiBUXG4gICkge1xuICAgIGlmIChhcmdzKSB7XG4gICAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBjYWxsYmFjay5jYWxsKHRoaXMsIC4uLmFyZ3MpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcXVldWVNaWNyb3Rhc2soY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIF9uZXh0VGljayA9IF9fbmV4dFRpY2tRdWV1ZU1pY3JvdGFzaztcbn1cblxuLy8gYG5leHRUaWNrKClgIHdpbGwgbm90IGVucXVldWUgYW55IGNhbGxiYWNrIHdoZW4gdGhlIHByb2Nlc3MgaXMgYWJvdXQgdG9cbi8vIGV4aXQgc2luY2UgdGhlIGNhbGxiYWNrIHdvdWxkIG5vdCBoYXZlIGEgY2hhbmNlIHRvIGJlIGV4ZWN1dGVkLlxuZXhwb3J0IGZ1bmN0aW9uIG5leHRUaWNrKHRoaXM6IHVua25vd24sIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBuZXh0VGljazxUIGV4dGVuZHMgQXJyYXk8dW5rbm93bj4+KFxuICB0aGlzOiB1bmtub3duLFxuICBjYWxsYmFjazogKC4uLmFyZ3M6IFQpID0+IHZvaWQsXG4gIC4uLmFyZ3M6IFRcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gbmV4dFRpY2s8VCBleHRlbmRzIEFycmF5PHVua25vd24+PihcbiAgdGhpczogdW5rbm93bixcbiAgY2FsbGJhY2s6ICguLi5hcmdzOiBUKSA9PiB2b2lkLFxuICAuLi5hcmdzOiBUXG4pIHtcbiAgX25leHRUaWNrKGNhbGxiYWNrLCAuLi5hcmdzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBRXRELDhDQUE4QztBQUU5QyxTQUFTLElBQUksUUFBUSxhQUFhO0FBQ2xDLFNBQVMsZ0JBQWdCLFFBQVEsNEJBQTRCO0FBQzdELFNBQVMsUUFBUSxRQUFRLHdCQUF3QjtB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