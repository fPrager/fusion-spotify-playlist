// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { sprintf } from "../../../fmt/printf.ts";
import { inspect } from "./inspect.mjs";
// `debugImpls` and `testEnabled` are deliberately not initialized so any call
// to `debuglog()` before `initializeDebugEnv()` is called will throw.
let debugImpls;
let testEnabled;
// `debugEnv` is initial value of process.env.NODE_DEBUG
function initializeDebugEnv(debugEnv) {
    debugImpls = Object.create(null);
    if (debugEnv) {
        // This is run before any user code, it's OK not to use primordials.
        debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", ".*").replaceAll(",", "$|^");
        const debugEnvRegex = new RegExp(`^${debugEnv}$`, "i");
        testEnabled = (str)=>debugEnvRegex.exec(str) !== null;
    } else {
        testEnabled = ()=>false;
    }
}
// Emits warning when user sets
// NODE_DEBUG=http or NODE_DEBUG=http2.
function emitWarningIfNeeded(set) {
    if ("HTTP" === set || "HTTP2" === set) {
        console.warn("Setting the NODE_DEBUG environment variable " + "to '" + set.toLowerCase() + "' can expose sensitive " + "data (such as passwords, tokens and authentication headers) " + "in the resulting log.");
    }
}
const noop = ()=>{};
function debuglogImpl(enabled, set) {
    if (debugImpls[set] === undefined) {
        if (enabled) {
            emitWarningIfNeeded(set);
            debugImpls[set] = function debug(...args) {
                const msg = args.map((arg)=>inspect(arg)).join(" ");
                console.error(sprintf("%s %s: %s", set, String(Deno.pid), msg));
            };
        } else {
            debugImpls[set] = noop;
        }
    }
    return debugImpls[set];
}
// debuglogImpl depends on process.pid and process.env.NODE_DEBUG,
// so it needs to be called lazily in top scopes of internal modules
// that may be loaded before these run time states are allowed to
// be accessed.
export function debuglog(set, cb) {
    function init() {
        set = set.toUpperCase();
        enabled = testEnabled(set);
    }
    let debug = (...args)=>{
        init();
        // Only invokes debuglogImpl() when the debug function is
        // called for the first time.
        debug = debuglogImpl(enabled, set);
        if (typeof cb === "function") {
            cb(debug);
        }
        return debug(...args);
    };
    let enabled;
    let test = ()=>{
        init();
        test = ()=>enabled;
        return enabled;
    };
    const logger = (...args)=>debug(...args);
    Object.defineProperty(logger, "enabled", {
        get () {
            return test();
        },
        configurable: true,
        enumerable: true
    });
    return logger;
}
let debugEnv;
try {
    debugEnv = Deno.env.get("NODE_DEBUG") ?? "";
} catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
        debugEnv = "";
    } else {
        throw error;
    }
}
initializeDebugEnv(debugEnv);
export default {
    debuglog
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvdXRpbC9kZWJ1Z2xvZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCBhbmQgTm9kZSBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgc3ByaW50ZiB9IGZyb20gXCIuLi8uLi8uLi9mbXQvcHJpbnRmLnRzXCI7XG5pbXBvcnQgeyBpbnNwZWN0IH0gZnJvbSBcIi4vaW5zcGVjdC5tanNcIjtcblxuLy8gYGRlYnVnSW1wbHNgIGFuZCBgdGVzdEVuYWJsZWRgIGFyZSBkZWxpYmVyYXRlbHkgbm90IGluaXRpYWxpemVkIHNvIGFueSBjYWxsXG4vLyB0byBgZGVidWdsb2coKWAgYmVmb3JlIGBpbml0aWFsaXplRGVidWdFbnYoKWAgaXMgY2FsbGVkIHdpbGwgdGhyb3cuXG5sZXQgZGVidWdJbXBsczogUmVjb3JkPHN0cmluZywgKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZD47XG5sZXQgdGVzdEVuYWJsZWQ6IChzdHI6IHN0cmluZykgPT4gYm9vbGVhbjtcblxuLy8gYGRlYnVnRW52YCBpcyBpbml0aWFsIHZhbHVlIG9mIHByb2Nlc3MuZW52Lk5PREVfREVCVUdcbmZ1bmN0aW9uIGluaXRpYWxpemVEZWJ1Z0VudihkZWJ1Z0Vudjogc3RyaW5nKSB7XG4gIGRlYnVnSW1wbHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBpZiAoZGVidWdFbnYpIHtcbiAgICAvLyBUaGlzIGlzIHJ1biBiZWZvcmUgYW55IHVzZXIgY29kZSwgaXQncyBPSyBub3QgdG8gdXNlIHByaW1vcmRpYWxzLlxuICAgIGRlYnVnRW52ID0gZGVidWdFbnYucmVwbGFjZSgvW3xcXFxce30oKVtcXF1eJCs/Ll0vZywgXCJcXFxcJCZcIilcbiAgICAgIC5yZXBsYWNlQWxsKFwiKlwiLCBcIi4qXCIpXG4gICAgICAucmVwbGFjZUFsbChcIixcIiwgXCIkfF5cIik7XG4gICAgY29uc3QgZGVidWdFbnZSZWdleCA9IG5ldyBSZWdFeHAoYF4ke2RlYnVnRW52fSRgLCBcImlcIik7XG4gICAgdGVzdEVuYWJsZWQgPSAoc3RyKSA9PiBkZWJ1Z0VudlJlZ2V4LmV4ZWMoc3RyKSAhPT0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICB0ZXN0RW5hYmxlZCA9ICgpID0+IGZhbHNlO1xuICB9XG59XG5cbi8vIEVtaXRzIHdhcm5pbmcgd2hlbiB1c2VyIHNldHNcbi8vIE5PREVfREVCVUc9aHR0cCBvciBOT0RFX0RFQlVHPWh0dHAyLlxuZnVuY3Rpb24gZW1pdFdhcm5pbmdJZk5lZWRlZChzZXQ6IHN0cmluZykge1xuICBpZiAoXCJIVFRQXCIgPT09IHNldCB8fCBcIkhUVFAyXCIgPT09IHNldCkge1xuICAgIGNvbnNvbGUud2FybihcbiAgICAgIFwiU2V0dGluZyB0aGUgTk9ERV9ERUJVRyBlbnZpcm9ubWVudCB2YXJpYWJsZSBcIiArXG4gICAgICAgIFwidG8gJ1wiICsgc2V0LnRvTG93ZXJDYXNlKCkgKyBcIicgY2FuIGV4cG9zZSBzZW5zaXRpdmUgXCIgK1xuICAgICAgICBcImRhdGEgKHN1Y2ggYXMgcGFzc3dvcmRzLCB0b2tlbnMgYW5kIGF1dGhlbnRpY2F0aW9uIGhlYWRlcnMpIFwiICtcbiAgICAgICAgXCJpbiB0aGUgcmVzdWx0aW5nIGxvZy5cIixcbiAgICApO1xuICB9XG59XG5cbmNvbnN0IG5vb3AgPSAoKSA9PiB7fTtcblxuZnVuY3Rpb24gZGVidWdsb2dJbXBsKFxuICBlbmFibGVkOiBib29sZWFuLFxuICBzZXQ6IHN0cmluZyxcbik6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQge1xuICBpZiAoZGVidWdJbXBsc1tzZXRdID09PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgZW1pdFdhcm5pbmdJZk5lZWRlZChzZXQpO1xuICAgICAgZGVidWdJbXBsc1tzZXRdID0gZnVuY3Rpb24gZGVidWcoLi4uYXJnczogdW5rbm93bltdKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IGFyZ3MubWFwKChhcmcpID0+IGluc3BlY3QoYXJnKSkuam9pbihcIiBcIik7XG4gICAgICAgIGNvbnNvbGUuZXJyb3Ioc3ByaW50ZihcIiVzICVzOiAlc1wiLCBzZXQsIFN0cmluZyhEZW5vLnBpZCksIG1zZykpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdJbXBsc1tzZXRdID0gbm9vcDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVidWdJbXBsc1tzZXRdO1xufVxuXG4vLyBkZWJ1Z2xvZ0ltcGwgZGVwZW5kcyBvbiBwcm9jZXNzLnBpZCBhbmQgcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyxcbi8vIHNvIGl0IG5lZWRzIHRvIGJlIGNhbGxlZCBsYXppbHkgaW4gdG9wIHNjb3BlcyBvZiBpbnRlcm5hbCBtb2R1bGVzXG4vLyB0aGF0IG1heSBiZSBsb2FkZWQgYmVmb3JlIHRoZXNlIHJ1biB0aW1lIHN0YXRlcyBhcmUgYWxsb3dlZCB0b1xuLy8gYmUgYWNjZXNzZWQuXG5leHBvcnQgZnVuY3Rpb24gZGVidWdsb2coXG4gIHNldDogc3RyaW5nLFxuICBjYj86IChkZWJ1ZzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4gdm9pZCxcbikge1xuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICAgIGVuYWJsZWQgPSB0ZXN0RW5hYmxlZChzZXQpO1xuICB9XG5cbiAgbGV0IGRlYnVnID0gKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQgPT4ge1xuICAgIGluaXQoKTtcbiAgICAvLyBPbmx5IGludm9rZXMgZGVidWdsb2dJbXBsKCkgd2hlbiB0aGUgZGVidWcgZnVuY3Rpb24gaXNcbiAgICAvLyBjYWxsZWQgZm9yIHRoZSBmaXJzdCB0aW1lLlxuICAgIGRlYnVnID0gZGVidWdsb2dJbXBsKGVuYWJsZWQsIHNldCk7XG5cbiAgICBpZiAodHlwZW9mIGNiID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNiKGRlYnVnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVidWcoLi4uYXJncyk7XG4gIH07XG5cbiAgbGV0IGVuYWJsZWQ6IGJvb2xlYW47XG4gIGxldCB0ZXN0ID0gKCkgPT4ge1xuICAgIGluaXQoKTtcbiAgICB0ZXN0ID0gKCkgPT4gZW5hYmxlZDtcbiAgICByZXR1cm4gZW5hYmxlZDtcbiAgfTtcblxuICBjb25zdCBsb2dnZXIgPSAoLi4uYXJnczogdW5rbm93bltdKSA9PiBkZWJ1ZyguLi5hcmdzKTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobG9nZ2VyLCBcImVuYWJsZWRcIiwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiB0ZXN0KCk7XG4gICAgfSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgfSk7XG5cbiAgcmV0dXJuIGxvZ2dlcjtcbn1cblxubGV0IGRlYnVnRW52O1xudHJ5IHtcbiAgZGVidWdFbnYgPSBEZW5vLmVudi5nZXQoXCJOT0RFX0RFQlVHXCIpID8/IFwiXCI7XG59IGNhdGNoIChlcnJvcikge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5QZXJtaXNzaW9uRGVuaWVkKSB7XG4gICAgZGVidWdFbnYgPSBcIlwiO1xuICB9IGVsc2Uge1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5pbml0aWFsaXplRGVidWdFbnYoZGVidWdFbnYpO1xuXG5leHBvcnQgZGVmYXVsdCB7IGRlYnVnbG9nIH07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUM1RSxTQUFTLE9BQU8sUUFBUSx5QkFBeUI7QUFDakQsU0FBUyxPQUFPLFFBQVEsZ0JBQWdCO0FBRXhDLDhFQUE4RTtB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