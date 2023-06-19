// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { basename } from "../path.ts";
import { EventEmitter } from "../events.ts";
import { notImplemented } from "../_utils.ts";
import { promisify } from "../util.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import { validateFunction } from "../internal/validators.mjs";
import { stat } from "./_fs_stat.ts";
import { Stats as StatsClass } from "../internal/fs/utils.mjs";
import { delay } from "../../async/delay.ts";
const statPromisified = promisify(stat);
const statAsync = async (filename)=>{
    try {
        return await statPromisified(filename);
    } catch  {
        return emptyStats;
    }
};
const emptyStats = new StatsClass(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Date.UTC(1970, 0, 1, 0, 0, 0), Date.UTC(1970, 0, 1, 0, 0, 0), Date.UTC(1970, 0, 1, 0, 0, 0), Date.UTC(1970, 0, 1, 0, 0, 0));
export function asyncIterableIteratorToCallback(iterator, callback) {
    function next() {
        iterator.next().then((obj)=>{
            if (obj.done) {
                callback(obj.value, true);
                return;
            }
            callback(obj.value);
            next();
        });
    }
    next();
}
export function asyncIterableToCallback(iter, callback, errCallback) {
    const iterator = iter[Symbol.asyncIterator]();
    function next() {
        iterator.next().then((obj)=>{
            if (obj.done) {
                callback(obj.value, true);
                return;
            }
            callback(obj.value);
            next();
        }, errCallback);
    }
    next();
}
export function watch(filename, optionsOrListener, optionsOrListener2) {
    const listener = typeof optionsOrListener === "function" ? optionsOrListener : typeof optionsOrListener2 === "function" ? optionsOrListener2 : undefined;
    const options = typeof optionsOrListener === "object" ? optionsOrListener : typeof optionsOrListener2 === "object" ? optionsOrListener2 : undefined;
    const watchPath = getValidatedPath(filename).toString();
    let iterator;
    // Start the actual watcher a few msec later to avoid race condition
    // error in test case in compat test case
    // (parallel/test-fs-watch.js, parallel/test-fs-watchfile.js)
    const timer = setTimeout(()=>{
        iterator = Deno.watchFs(watchPath, {
            recursive: options?.recursive || false
        });
        asyncIterableToCallback(iterator, (val, done)=>{
            if (done) return;
            fsWatcher.emit("change", convertDenoFsEventToNodeFsEvent(val.kind), basename(val.paths[0]));
        }, (e)=>{
            fsWatcher.emit("error", e);
        });
    }, 5);
    const fsWatcher = new FSWatcher(()=>{
        clearTimeout(timer);
        try {
            iterator?.close();
        } catch (e) {
            if (e instanceof Deno.errors.BadResource) {
                // already closed
                return;
            }
            throw e;
        }
    });
    if (listener) {
        fsWatcher.on("change", listener.bind({
            _handle: fsWatcher
        }));
    }
    return fsWatcher;
}
export const watchPromise = promisify(watch);
export function watchFile(filename, listenerOrOptions, listener) {
    const watchPath = getValidatedPath(filename).toString();
    const handler = typeof listenerOrOptions === "function" ? listenerOrOptions : listener;
    validateFunction(handler, "listener");
    const { bigint =false , persistent =true , interval =5007  } = typeof listenerOrOptions === "object" ? listenerOrOptions : {};
    let stat = statWatchers.get(watchPath);
    if (stat === undefined) {
        stat = new StatWatcher(bigint);
        stat[kFSStatWatcherStart](watchPath, persistent, interval);
        statWatchers.set(watchPath, stat);
    }
    stat.addListener("change", listener);
    return stat;
}
export function unwatchFile(filename, listener) {
    const watchPath = getValidatedPath(filename).toString();
    const stat = statWatchers.get(watchPath);
    if (!stat) {
        return;
    }
    if (typeof listener === "function") {
        const beforeListenerCount = stat.listenerCount("change");
        stat.removeListener("change", listener);
        if (stat.listenerCount("change") < beforeListenerCount) {
            stat[kFSStatWatcherAddOrCleanRef]("clean");
        }
    } else {
        stat.removeAllListeners("change");
        stat[kFSStatWatcherAddOrCleanRef]("cleanAll");
    }
    if (stat.listenerCount("change") === 0) {
        stat.stop();
        statWatchers.delete(watchPath);
    }
}
const statWatchers = new Map();
const kFSStatWatcherStart = Symbol("kFSStatWatcherStart");
const kFSStatWatcherAddOrCleanRef = Symbol("kFSStatWatcherAddOrCleanRef");
class StatWatcher extends EventEmitter {
    #bigint;
    #refCount = 0;
    #abortController = new AbortController();
    constructor(bigint){
        super();
        this.#bigint = bigint;
    }
    [kFSStatWatcherStart](filename, persistent, interval) {
        if (persistent) {
            this.#refCount++;
        }
        (async ()=>{
            let prev = await statAsync(filename);
            if (prev === emptyStats) {
                this.emit("change", prev, prev);
            }
            try {
                while(true){
                    await delay(interval, {
                        signal: this.#abortController.signal
                    });
                    const curr = await statAsync(filename);
                    if (curr?.mtime !== prev?.mtime) {
                        this.emit("change", curr, prev);
                        prev = curr;
                    }
                }
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") {
                    return;
                }
                this.emit("error", e);
            }
        })();
    }
    [kFSStatWatcherAddOrCleanRef](addOrClean) {
        if (addOrClean === "add") {
            this.#refCount++;
        } else if (addOrClean === "clean") {
            this.#refCount--;
        } else {
            this.#refCount = 0;
        }
    }
    stop() {
        if (this.#abortController.signal.aborted) {
            return;
        }
        this.#abortController.abort();
        this.emit("stop");
    }
    ref() {
        notImplemented("FSWatcher.ref() is not implemented");
    }
    unref() {
        notImplemented("FSWatcher.unref() is not implemented");
    }
}
class FSWatcher extends EventEmitter {
    #closer;
    #closed = false;
    constructor(closer){
        super();
        this.#closer = closer;
    }
    close() {
        if (this.#closed) {
            return;
        }
        this.#closed = true;
        this.emit("close");
        this.#closer();
    }
    ref() {
        notImplemented("FSWatcher.ref() is not implemented");
    }
    unref() {
        notImplemented("FSWatcher.unref() is not implemented");
    }
}
function convertDenoFsEventToNodeFsEvent(kind) {
    if (kind === "create" || kind === "remove") {
        return "rename";
    } else {
        return "change";
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc193YXRjaC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tIFwiLi4vcGF0aC50c1wiO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSBcIi4uL2V2ZW50cy50c1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vX3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vdXRpbC50c1wiO1xuaW1wb3J0IHsgZ2V0VmFsaWRhdGVkUGF0aCB9IGZyb20gXCIuLi9pbnRlcm5hbC9mcy91dGlscy5tanNcIjtcbmltcG9ydCB7IHZhbGlkYXRlRnVuY3Rpb24gfSBmcm9tIFwiLi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IHN0YXQsIFN0YXRzIH0gZnJvbSBcIi4vX2ZzX3N0YXQudHNcIjtcbmltcG9ydCB7IFN0YXRzIGFzIFN0YXRzQ2xhc3MgfSBmcm9tIFwiLi4vaW50ZXJuYWwvZnMvdXRpbHMubWpzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBkZWxheSB9IGZyb20gXCIuLi8uLi9hc3luYy9kZWxheS50c1wiO1xuXG5jb25zdCBzdGF0UHJvbWlzaWZpZWQgPSBwcm9taXNpZnkoc3RhdCk7XG5jb25zdCBzdGF0QXN5bmMgPSBhc3luYyAoZmlsZW5hbWU6IHN0cmluZyk6IFByb21pc2U8U3RhdHMgfCBudWxsPiA9PiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHN0YXRQcm9taXNpZmllZChmaWxlbmFtZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBlbXB0eVN0YXRzO1xuICB9XG59O1xuY29uc3QgZW1wdHlTdGF0cyA9IG5ldyBTdGF0c0NsYXNzKFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICAwLFxuICBEYXRlLlVUQygxOTcwLCAwLCAxLCAwLCAwLCAwKSxcbiAgRGF0ZS5VVEMoMTk3MCwgMCwgMSwgMCwgMCwgMCksXG4gIERhdGUuVVRDKDE5NzAsIDAsIDEsIDAsIDAsIDApLFxuICBEYXRlLlVUQygxOTcwLCAwLCAxLCAwLCAwLCAwKSxcbikgYXMgdW5rbm93biBhcyBTdGF0cztcblxuZXhwb3J0IGZ1bmN0aW9uIGFzeW5jSXRlcmFibGVJdGVyYXRvclRvQ2FsbGJhY2s8VD4oXG4gIGl0ZXJhdG9yOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8VD4sXG4gIGNhbGxiYWNrOiAodmFsOiBULCBkb25lPzogYm9vbGVhbikgPT4gdm9pZCxcbikge1xuICBmdW5jdGlvbiBuZXh0KCkge1xuICAgIGl0ZXJhdG9yLm5leHQoKS50aGVuKChvYmopID0+IHtcbiAgICAgIGlmIChvYmouZG9uZSkge1xuICAgICAgICBjYWxsYmFjayhvYmoudmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhvYmoudmFsdWUpO1xuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICB9XG4gIG5leHQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzeW5jSXRlcmFibGVUb0NhbGxiYWNrPFQ+KFxuICBpdGVyOiBBc3luY0l0ZXJhYmxlPFQ+LFxuICBjYWxsYmFjazogKHZhbDogVCwgZG9uZT86IGJvb2xlYW4pID0+IHZvaWQsXG4gIGVyckNhbGxiYWNrOiAoZTogdW5rbm93bikgPT4gdm9pZCxcbikge1xuICBjb25zdCBpdGVyYXRvciA9IGl0ZXJbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG4gIGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgaXRlcmF0b3IubmV4dCgpLnRoZW4oKG9iaikgPT4ge1xuICAgICAgaWYgKG9iai5kb25lKSB7XG4gICAgICAgIGNhbGxiYWNrKG9iai52YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG9iai52YWx1ZSk7XG4gICAgICBuZXh0KCk7XG4gICAgfSwgZXJyQ2FsbGJhY2spO1xuICB9XG4gIG5leHQoKTtcbn1cblxudHlwZSB3YXRjaE9wdGlvbnMgPSB7XG4gIHBlcnNpc3RlbnQ/OiBib29sZWFuO1xuICByZWN1cnNpdmU/OiBib29sZWFuO1xuICBlbmNvZGluZz86IHN0cmluZztcbn07XG5cbnR5cGUgd2F0Y2hMaXN0ZW5lciA9IChldmVudFR5cGU6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZykgPT4gdm9pZDtcblxuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoKFxuICBmaWxlbmFtZTogc3RyaW5nIHwgVVJMLFxuICBvcHRpb25zOiB3YXRjaE9wdGlvbnMsXG4gIGxpc3RlbmVyOiB3YXRjaExpc3RlbmVyLFxuKTogRlNXYXRjaGVyO1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoKFxuICBmaWxlbmFtZTogc3RyaW5nIHwgVVJMLFxuICBsaXN0ZW5lcjogd2F0Y2hMaXN0ZW5lcixcbik6IEZTV2F0Y2hlcjtcbmV4cG9ydCBmdW5jdGlvbiB3YXRjaChcbiAgZmlsZW5hbWU6IHN0cmluZyB8IFVSTCxcbiAgb3B0aW9uczogd2F0Y2hPcHRpb25zLFxuKTogRlNXYXRjaGVyO1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoKGZpbGVuYW1lOiBzdHJpbmcgfCBVUkwpOiBGU1dhdGNoZXI7XG5leHBvcnQgZnVuY3Rpb24gd2F0Y2goXG4gIGZpbGVuYW1lOiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnNPckxpc3RlbmVyPzogd2F0Y2hPcHRpb25zIHwgd2F0Y2hMaXN0ZW5lcixcbiAgb3B0aW9uc09yTGlzdGVuZXIyPzogd2F0Y2hPcHRpb25zIHwgd2F0Y2hMaXN0ZW5lcixcbikge1xuICBjb25zdCBsaXN0ZW5lciA9IHR5cGVvZiBvcHRpb25zT3JMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiXG4gICAgPyBvcHRpb25zT3JMaXN0ZW5lclxuICAgIDogdHlwZW9mIG9wdGlvbnNPckxpc3RlbmVyMiA9PT0gXCJmdW5jdGlvblwiXG4gICAgPyBvcHRpb25zT3JMaXN0ZW5lcjJcbiAgICA6IHVuZGVmaW5lZDtcbiAgY29uc3Qgb3B0aW9ucyA9IHR5cGVvZiBvcHRpb25zT3JMaXN0ZW5lciA9PT0gXCJvYmplY3RcIlxuICAgID8gb3B0aW9uc09yTGlzdGVuZXJcbiAgICA6IHR5cGVvZiBvcHRpb25zT3JMaXN0ZW5lcjIgPT09IFwib2JqZWN0XCJcbiAgICA/IG9wdGlvbnNPckxpc3RlbmVyMlxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHdhdGNoUGF0aCA9IGdldFZhbGlkYXRlZFBhdGgoZmlsZW5hbWUpLnRvU3RyaW5nKCk7XG5cbiAgbGV0IGl0ZXJhdG9yOiBEZW5vLkZzV2F0Y2hlcjtcbiAgLy8gU3RhcnQgdGhlIGFjdHVhbCB3YXRjaGVyIGEgZmV3IG1zZWMgbGF0ZXIgdG8gYXZvaWQgcmFjZSBjb25kaXRpb25cbiAgLy8gZXJyb3IgaW4gdGVzdCBjYXNlIGluIGNvbXBhdCB0ZXN0IGNhc2VcbiAgLy8gKHBhcmFsbGVsL3Rlc3QtZnMtd2F0Y2guanMsIHBhcmFsbGVsL3Rlc3QtZnMtd2F0Y2hmaWxlLmpzKVxuICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGl0ZXJhdG9yID0gRGVuby53YXRjaEZzKHdhdGNoUGF0aCwge1xuICAgICAgcmVjdXJzaXZlOiBvcHRpb25zPy5yZWN1cnNpdmUgfHwgZmFsc2UsXG4gICAgfSk7XG5cbiAgICBhc3luY0l0ZXJhYmxlVG9DYWxsYmFjazxEZW5vLkZzRXZlbnQ+KGl0ZXJhdG9yLCAodmFsLCBkb25lKSA9PiB7XG4gICAgICBpZiAoZG9uZSkgcmV0dXJuO1xuICAgICAgZnNXYXRjaGVyLmVtaXQoXG4gICAgICAgIFwiY2hhbmdlXCIsXG4gICAgICAgIGNvbnZlcnREZW5vRnNFdmVudFRvTm9kZUZzRXZlbnQodmFsLmtpbmQpLFxuICAgICAgICBiYXNlbmFtZSh2YWwucGF0aHNbMF0pLFxuICAgICAgKTtcbiAgICB9LCAoZSkgPT4ge1xuICAgICAgZnNXYXRjaGVyLmVtaXQoXCJlcnJvclwiLCBlKTtcbiAgICB9KTtcbiAgfSwgNSk7XG5cbiAgY29uc3QgZnNXYXRjaGVyID0gbmV3IEZTV2F0Y2hlcigoKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICB0cnkge1xuICAgICAgaXRlcmF0b3I/LmNsb3NlKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5CYWRSZXNvdXJjZSkge1xuICAgICAgICAvLyBhbHJlYWR5IGNsb3NlZFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGxpc3RlbmVyKSB7XG4gICAgZnNXYXRjaGVyLm9uKFwiY2hhbmdlXCIsIGxpc3RlbmVyLmJpbmQoeyBfaGFuZGxlOiBmc1dhdGNoZXIgfSkpO1xuICB9XG5cbiAgcmV0dXJuIGZzV2F0Y2hlcjtcbn1cblxuZXhwb3J0IGNvbnN0IHdhdGNoUHJvbWlzZSA9IHByb21pc2lmeSh3YXRjaCkgYXMgKFxuICAmICgoXG4gICAgZmlsZW5hbWU6IHN0cmluZyB8IFVSTCxcbiAgICBvcHRpb25zOiB3YXRjaE9wdGlvbnMsXG4gICAgbGlzdGVuZXI6IHdhdGNoTGlzdGVuZXIsXG4gICkgPT4gUHJvbWlzZTxGU1dhdGNoZXI+KVxuICAmICgoXG4gICAgZmlsZW5hbWU6IHN0cmluZyB8IFVSTCxcbiAgICBsaXN0ZW5lcjogd2F0Y2hMaXN0ZW5lcixcbiAgKSA9PiBQcm9taXNlPEZTV2F0Y2hlcj4pXG4gICYgKChcbiAgICBmaWxlbmFtZTogc3RyaW5nIHwgVVJMLFxuICAgIG9wdGlvbnM6IHdhdGNoT3B0aW9ucyxcbiAgKSA9PiBQcm9taXNlPEZTV2F0Y2hlcj4pXG4gICYgKChmaWxlbmFtZTogc3RyaW5nIHwgVVJMKSA9PiBQcm9taXNlPEZTV2F0Y2hlcj4pXG4pO1xuXG50eXBlIFdhdGNoRmlsZUxpc3RlbmVyID0gKGN1cnI6IFN0YXRzLCBwcmV2OiBTdGF0cykgPT4gdm9pZDtcbnR5cGUgV2F0Y2hGaWxlT3B0aW9ucyA9IHtcbiAgYmlnaW50PzogYm9vbGVhbjtcbiAgcGVyc2lzdGVudD86IGJvb2xlYW47XG4gIGludGVydmFsPzogbnVtYmVyO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoRmlsZShcbiAgZmlsZW5hbWU6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgbGlzdGVuZXI6IFdhdGNoRmlsZUxpc3RlbmVyLFxuKTogU3RhdFdhdGNoZXI7XG5leHBvcnQgZnVuY3Rpb24gd2F0Y2hGaWxlKFxuICBmaWxlbmFtZTogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBvcHRpb25zOiBXYXRjaEZpbGVPcHRpb25zLFxuICBsaXN0ZW5lcjogV2F0Y2hGaWxlTGlzdGVuZXIsXG4pOiBTdGF0V2F0Y2hlcjtcbmV4cG9ydCBmdW5jdGlvbiB3YXRjaEZpbGUoXG4gIGZpbGVuYW1lOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gIGxpc3RlbmVyT3JPcHRpb25zOiBXYXRjaEZpbGVMaXN0ZW5lciB8IFdhdGNoRmlsZU9wdGlvbnMsXG4gIGxpc3RlbmVyPzogV2F0Y2hGaWxlTGlzdGVuZXIsXG4pOiBTdGF0V2F0Y2hlciB7XG4gIGNvbnN0IHdhdGNoUGF0aCA9IGdldFZhbGlkYXRlZFBhdGgoZmlsZW5hbWUpLnRvU3RyaW5nKCk7XG4gIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2YgbGlzdGVuZXJPck9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIlxuICAgID8gbGlzdGVuZXJPck9wdGlvbnNcbiAgICA6IGxpc3RlbmVyITtcbiAgdmFsaWRhdGVGdW5jdGlvbihoYW5kbGVyLCBcImxpc3RlbmVyXCIpO1xuICBjb25zdCB7XG4gICAgYmlnaW50ID0gZmFsc2UsXG4gICAgcGVyc2lzdGVudCA9IHRydWUsXG4gICAgaW50ZXJ2YWwgPSA1MDA3LFxuICB9ID0gdHlwZW9mIGxpc3RlbmVyT3JPcHRpb25zID09PSBcIm9iamVjdFwiID8gbGlzdGVuZXJPck9wdGlvbnMgOiB7fTtcblxuICBsZXQgc3RhdCA9IHN0YXRXYXRjaGVycy5nZXQod2F0Y2hQYXRoKTtcbiAgaWYgKHN0YXQgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXQgPSBuZXcgU3RhdFdhdGNoZXIoYmlnaW50KTtcbiAgICBzdGF0W2tGU1N0YXRXYXRjaGVyU3RhcnRdKHdhdGNoUGF0aCwgcGVyc2lzdGVudCwgaW50ZXJ2YWwpO1xuICAgIHN0YXRXYXRjaGVycy5zZXQod2F0Y2hQYXRoLCBzdGF0KTtcbiAgfVxuXG4gIHN0YXQuYWRkTGlzdGVuZXIoXCJjaGFuZ2VcIiwgbGlzdGVuZXIhKTtcbiAgcmV0dXJuIHN0YXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bndhdGNoRmlsZShcbiAgZmlsZW5hbWU6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgbGlzdGVuZXI/OiBXYXRjaEZpbGVMaXN0ZW5lcixcbikge1xuICBjb25zdCB3YXRjaFBhdGggPSBnZXRWYWxpZGF0ZWRQYXRoKGZpbGVuYW1lKS50b1N0cmluZygpO1xuICBjb25zdCBzdGF0ID0gc3RhdFdhdGNoZXJzLmdldCh3YXRjaFBhdGgpO1xuXG4gIGlmICghc3RhdCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0eXBlb2YgbGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNvbnN0IGJlZm9yZUxpc3RlbmVyQ291bnQgPSBzdGF0Lmxpc3RlbmVyQ291bnQoXCJjaGFuZ2VcIik7XG4gICAgc3RhdC5yZW1vdmVMaXN0ZW5lcihcImNoYW5nZVwiLCBsaXN0ZW5lcik7XG4gICAgaWYgKHN0YXQubGlzdGVuZXJDb3VudChcImNoYW5nZVwiKSA8IGJlZm9yZUxpc3RlbmVyQ291bnQpIHtcbiAgICAgIHN0YXRba0ZTU3RhdFdhdGNoZXJBZGRPckNsZWFuUmVmXShcImNsZWFuXCIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBzdGF0LnJlbW92ZUFsbExpc3RlbmVycyhcImNoYW5nZVwiKTtcbiAgICBzdGF0W2tGU1N0YXRXYXRjaGVyQWRkT3JDbGVhblJlZl0oXCJjbGVhbkFsbFwiKTtcbiAgfVxuXG4gIGlmIChzdGF0Lmxpc3RlbmVyQ291bnQoXCJjaGFuZ2VcIikgPT09IDApIHtcbiAgICBzdGF0LnN0b3AoKTtcbiAgICBzdGF0V2F0Y2hlcnMuZGVsZXRlKHdhdGNoUGF0aCk7XG4gIH1cbn1cblxuY29uc3Qgc3RhdFdhdGNoZXJzID0gbmV3IE1hcDxzdHJpbmcsIFN0YXRXYXRjaGVyPigpO1xuXG5jb25zdCBrRlNTdGF0V2F0Y2hlclN0YXJ0ID0gU3ltYm9sKFwia0ZTU3RhdFdhdGNoZXJTdGFydFwiKTtcbmNvbnN0IGtGU1N0YXRXYXRjaGVyQWRkT3JDbGVhblJlZiA9IFN5bWJvbChcImtGU1N0YXRXYXRjaGVyQWRkT3JDbGVhblJlZlwiKTtcblxuY2xhc3MgU3RhdFdhdGNoZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAjYmlnaW50OiBib29sZWFuO1xuICAjcmVmQ291bnQgPSAwO1xuICAjYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdHJ1Y3RvcihiaWdpbnQ6IGJvb2xlYW4pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuI2JpZ2ludCA9IGJpZ2ludDtcbiAgfVxuICBba0ZTU3RhdFdhdGNoZXJTdGFydF0oXG4gICAgZmlsZW5hbWU6IHN0cmluZyxcbiAgICBwZXJzaXN0ZW50OiBib29sZWFuLFxuICAgIGludGVydmFsOiBudW1iZXIsXG4gICkge1xuICAgIGlmIChwZXJzaXN0ZW50KSB7XG4gICAgICB0aGlzLiNyZWZDb3VudCsrO1xuICAgIH1cblxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgcHJldiA9IGF3YWl0IHN0YXRBc3luYyhmaWxlbmFtZSk7XG5cbiAgICAgIGlmIChwcmV2ID09PSBlbXB0eVN0YXRzKSB7XG4gICAgICAgIHRoaXMuZW1pdChcImNoYW5nZVwiLCBwcmV2LCBwcmV2KTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBhd2FpdCBkZWxheShpbnRlcnZhbCwgeyBzaWduYWw6IHRoaXMuI2Fib3J0Q29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICAgICAgY29uc3QgY3VyciA9IGF3YWl0IHN0YXRBc3luYyhmaWxlbmFtZSk7XG4gICAgICAgICAgaWYgKGN1cnI/Lm10aW1lICE9PSBwcmV2Py5tdGltZSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KFwiY2hhbmdlXCIsIGN1cnIsIHByZXYpO1xuICAgICAgICAgICAgcHJldiA9IGN1cnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIGUubmFtZSA9PT0gXCJBYm9ydEVycm9yXCIpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbWl0KFwiZXJyb3JcIiwgZSk7XG4gICAgICB9XG4gICAgfSkoKTtcbiAgfVxuICBba0ZTU3RhdFdhdGNoZXJBZGRPckNsZWFuUmVmXShhZGRPckNsZWFuOiBcImFkZFwiIHwgXCJjbGVhblwiIHwgXCJjbGVhbkFsbFwiKSB7XG4gICAgaWYgKGFkZE9yQ2xlYW4gPT09IFwiYWRkXCIpIHtcbiAgICAgIHRoaXMuI3JlZkNvdW50Kys7XG4gICAgfSBlbHNlIGlmIChhZGRPckNsZWFuID09PSBcImNsZWFuXCIpIHtcbiAgICAgIHRoaXMuI3JlZkNvdW50LS07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI3JlZkNvdW50ID0gMDtcbiAgICB9XG4gIH1cbiAgc3RvcCgpIHtcbiAgICBpZiAodGhpcy4jYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuI2Fib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgIHRoaXMuZW1pdChcInN0b3BcIik7XG4gIH1cbiAgcmVmKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiRlNXYXRjaGVyLnJlZigpIGlzIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgfVxuICB1bnJlZigpIHtcbiAgICBub3RJbXBsZW1lbnRlZChcIkZTV2F0Y2hlci51bnJlZigpIGlzIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgfVxufVxuXG5jbGFzcyBGU1dhdGNoZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAjY2xvc2VyOiAoKSA9PiB2b2lkO1xuICAjY2xvc2VkID0gZmFsc2U7XG4gIGNvbnN0cnVjdG9yKGNsb3NlcjogKCkgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy4jY2xvc2VyID0gY2xvc2VyO1xuICB9XG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLiNjbG9zZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy4jY2xvc2VkID0gdHJ1ZTtcbiAgICB0aGlzLmVtaXQoXCJjbG9zZVwiKTtcbiAgICB0aGlzLiNjbG9zZXIoKTtcbiAgfVxuICByZWYoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJGU1dhdGNoZXIucmVmKCkgaXMgbm90IGltcGxlbWVudGVkXCIpO1xuICB9XG4gIHVucmVmKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiRlNXYXRjaGVyLnVucmVmKCkgaXMgbm90IGltcGxlbWVudGVkXCIpO1xuICB9XG59XG5cbnR5cGUgTm9kZUZzRXZlbnRUeXBlID0gXCJyZW5hbWVcIiB8IFwiY2hhbmdlXCI7XG5cbmZ1bmN0aW9uIGNvbnZlcnREZW5vRnNFdmVudFRvTm9kZUZzRXZlbnQoXG4gIGtpbmQ6IERlbm8uRnNFdmVudFtcImtpbmRcIl0sXG4pOiBOb2RlRnNFdmVudFR5cGUge1xuICBpZiAoa2luZCA9PT0gXCJjcmVhdGVcIiB8fCBraW5kID09PSBcInJlbW92ZVwiKSB7XG4gICAgcmV0dXJuIFwicmVuYW1lXCI7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFwiY2hhbmdlXCI7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FBUyxRQUFRLFFBQVEsYUFBYTtBQUN0QyxTQUFTLFlBQVksUUFBUSxlQUFlO0FBQzVDLFNBQVMsY0FBYyxRQUFRLGVBQWU7QUFDOUMsU0FBUyxTQUFTLFFBQVEsYUFBYTtBQUN2QyxTQUFTLGdCQUFnQixRQUFRLDJCQUEyQjtBQUM1RCxTQUFTLGdCQUFnQixRQUFRLDZCQUE2QjtBQUM5RCxTQUFTLElBQUksUUFBZSxnQkFBZ0I7QUFDNUMsU0FBUyxTQUFTLFVBQVUsUUFBUSwyQkFBMkI7QUFFL0QsU0FBUyxLQUFLLFFBQVEsdUJBQXVCO0FBRTdDLE1BQU0sa0JBQWtCLFVBQVU7QUFDbEMsTUFBTSxZQUFZLE9BQU8sV0FBNEM7SUFDbkUsSUFBSTtRQUNGLE9BQU8sTUFBTSxnQkFBZ0I7SUFDL0IsRUFBRSxPQUFNO1FBQ04sT0FBTztJQUNUO0FBQ0Y7QUFDQSxNQUFNLGFBQWEsSUFBSSxXQUNyQixHQUNBLEdBQ0EsR0FDQSxHQUNBLEdBQ0EsR0FDQSxHQUNBLEdBQ0EsR0FDQSxHQUNBLEtBQUssR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUMzQixLQUFLLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFDM0IsS0FBSyxHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQzNCLEtBQUssR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsR0FBRztBQUc3QixPQUFPLFNBQVMsZ0NBQ2QsUUFBa0MsRUFDbEMsUUFBMEMsRUFDMUM7SUFDQSxTQUFTLE9BQU87UUFDZCxTQUFTLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxNQUFRO1lBQzVCLElBQUksSUFBSSxJQUFJLEVBQUU7Z0JBQ1osU0FBUyxJQUFJLEtBQUssRUFBRSxJQUFJ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