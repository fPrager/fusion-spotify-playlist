// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { notImplemented, warnNotImplemented } from "./_utils.ts";
import { EventEmitter } from "./events.ts";
import { validateString } from "./internal/validators.mjs";
import { ERR_INVALID_ARG_TYPE, ERR_UNKNOWN_SIGNAL, errnoException } from "./internal/errors.ts";
import { getOptionValue } from "./internal/options.ts";
import { assert } from "../_util/asserts.ts";
import { fromFileUrl, join } from "../path/mod.ts";
import { arch, chdir, cwd, env, nextTick as _nextTick, pid, platform, version, versions } from "./_process/process.ts";
import { _exiting } from "./_process/exiting.ts";
export { _nextTick as nextTick, arch, argv, chdir, cwd, env, pid, platform, version, versions };
import { stderr as stderr_, stdin as stdin_, stdout as stdout_ } from "./_process/streams.mjs";
import { core } from "./_core.ts";
import { processTicksAndRejections } from "./_next_tick.ts";
// TODO(kt3k): Give better types to stdio objects
// deno-lint-ignore no-explicit-any
const stderr = stderr_;
// deno-lint-ignore no-explicit-any
const stdin = stdin_;
// deno-lint-ignore no-explicit-any
const stdout = stdout_;
export { stderr, stdin, stdout };
import { getBinding } from "./internal_binding/mod.ts";
import * as constants from "./internal_binding/constants.ts";
import * as uv from "./internal_binding/uv.ts";
import { buildAllowedFlags } from "./internal/process/per_thread.mjs";
// @ts-ignore Deno[Deno.internal] is used on purpose here
const DenoCommand = Deno[Deno.internal]?.nodeUnstable?.Command || Deno.Command;
const notImplementedEvents = [
    "disconnect",
    "message",
    "multipleResolves",
    "rejectionHandled",
    "worker"
];
// The first 2 items are placeholders.
// They will be overwritten by the below Object.defineProperty calls.
const argv = [
    "",
    "",
    ...Deno.args
];
// Overwrites the 1st item with getter.
Object.defineProperty(argv, "0", {
    get: Deno.execPath
});
// Overwrites the 2st item with getter.
Object.defineProperty(argv, "1", {
    get: ()=>{
        if (Deno.mainModule.startsWith("file:")) {
            return fromFileUrl(Deno.mainModule);
        } else {
            return join(Deno.cwd(), "$deno$node.js");
        }
    }
});
/** https://nodejs.org/api/process.html#process_process_exit_code */ export const exit = (code)=>{
    if (code || code === 0) {
        if (typeof code === "string") {
            const parsedCode = parseInt(code);
            process.exitCode = isNaN(parsedCode) ? undefined : parsedCode;
        } else {
            process.exitCode = code;
        }
    }
    if (!process._exiting) {
        process._exiting = true;
        // FIXME(bartlomieju): this is wrong, we won't be using syscall to exit
        // and thus the `unload` event will not be emitted to properly trigger "emit"
        // event on `process`.
        process.emit("exit", process.exitCode || 0);
    }
    Deno.exit(process.exitCode || 0);
};
function addReadOnlyProcessAlias(name, option, enumerable = true) {
    const value = getOptionValue(option);
    if (value) {
        Object.defineProperty(process, name, {
            writable: false,
            configurable: true,
            enumerable,
            value
        });
    }
}
function createWarningObject(warning, type, code, // deno-lint-ignore ban-types
ctor, detail) {
    assert(typeof warning === "string");
    // deno-lint-ignore no-explicit-any
    const warningErr = new Error(warning);
    warningErr.name = String(type || "Warning");
    if (code !== undefined) {
        warningErr.code = code;
    }
    if (detail !== undefined) {
        warningErr.detail = detail;
    }
    // @ts-ignore this function is not available in lib.dom.d.ts
    Error.captureStackTrace(warningErr, ctor || process.emitWarning);
    return warningErr;
}
function doEmitWarning(warning) {
    process.emit("warning", warning);
}
/** https://nodejs.org/api/process.html#process_process_emitwarning_warning_options */ export function emitWarning(warning, type, code, // deno-lint-ignore ban-types
ctor) {
    let detail;
    if (type !== null && typeof type === "object" && !Array.isArray(type)) {
        ctor = type.ctor;
        code = type.code;
        if (typeof type.detail === "string") {
            detail = type.detail;
        }
        type = type.type || "Warning";
    } else if (typeof type === "function") {
        ctor = type;
        code = undefined;
        type = "Warning";
    }
    if (type !== undefined) {
        validateString(type, "type");
    }
    if (typeof code === "function") {
        ctor = code;
        code = undefined;
    } else if (code !== undefined) {
        validateString(code, "code");
    }
    if (typeof warning === "string") {
        warning = createWarningObject(warning, type, code, ctor, detail);
    } else if (!(warning instanceof Error)) {
        throw new ERR_INVALID_ARG_TYPE("warning", [
            "Error",
            "string"
        ], warning);
    }
    if (warning.name === "DeprecationWarning") {
        // deno-lint-ignore no-explicit-any
        if (process.noDeprecation) {
            return;
        }
        // deno-lint-ignore no-explicit-any
        if (process.throwDeprecation) {
            // Delay throwing the error to guarantee that all former warnings were
            // properly logged.
            return process.nextTick(()=>{
                throw warning;
            });
        }
    }
    process.nextTick(doEmitWarning, warning);
}
function hrtime(time) {
    const milli = performance.now();
    const sec = Math.floor(milli / 1000);
    const nano = Math.floor(milli * 1_000_000 - sec * 1_000_000_000);
    if (!time) {
        return [
            sec,
            nano
        ];
    }
    const [prevSec, prevNano] = time;
    return [
        sec - prevSec,
        nano - prevNano
    ];
}
hrtime.bigint = function() {
    const [sec, nano] = hrtime();
    return BigInt(sec) * 1_000_000_000n + BigInt(nano);
};
function memoryUsage() {
    return {
        ...Deno.memoryUsage(),
        arrayBuffers: 0
    };
}
memoryUsage.rss = function() {
    return memoryUsage().rss;
};
// Returns a negative error code than can be recognized by errnoException
function _kill(pid, sig) {
    let errCode;
    if (sig === 0) {
        let status;
        if (Deno.build.os === "windows") {
            status = new DenoCommand("powershell.exe", {
                args: [
                    "Get-Process",
                    "-pid",
                    pid
                ]
            }).outputSync();
        } else {
            status = new DenoCommand("kill", {
                args: [
                    "-0",
                    pid
                ]
            }).outputSync();
        }
        if (!status.success) {
            errCode = uv.codeMap.get("ESRCH");
        }
    } else {
        // Reverse search the shortname based on the numeric code
        const maybeSignal = Object.entries(constants.os.signals).find(([_, numericCode])=>numericCode === sig);
        if (!maybeSignal) {
            errCode = uv.codeMap.get("EINVAL");
        } else {
            try {
                Deno.kill(pid, maybeSignal[0]);
            } catch (e) {
                if (e instanceof TypeError) {
                    throw notImplemented(maybeSignal[0]);
                }
                throw e;
            }
        }
    }
    if (!errCode) {
        return 0;
    } else {
        return errCode;
    }
}
export function kill(pid, sig = "SIGTERM") {
    if (pid != (pid | 0)) {
        throw new ERR_INVALID_ARG_TYPE("pid", "number", pid);
    }
    let err;
    if (typeof sig === "number") {
        err = process._kill(pid, sig);
    } else {
        if (sig in constants.os.signals) {
            // @ts-ignore Index previously checked
            err = process._kill(pid, constants.os.signals[sig]);
        } else {
            throw new ERR_UNKNOWN_SIGNAL(sig);
        }
    }
    if (err) {
        throw errnoException(err, "kill");
    }
    return true;
}
// deno-lint-ignore no-explicit-any
function uncaughtExceptionHandler(err, origin) {
    // The origin parameter can be 'unhandledRejection' or 'uncaughtException'
    // depending on how the uncaught exception was created. In Node.js,
    // exceptions thrown from the top level of a CommonJS module are reported as
    // 'uncaughtException', while exceptions thrown from the top level of an ESM
    // module are reported as 'unhandledRejection'. Deno does not have a true
    // CommonJS implementation, so all exceptions thrown from the top level are
    // reported as 'uncaughtException'.
    process.emit("uncaughtExceptionMonitor", err, origin);
    process.emit("uncaughtException", err, origin);
}
let execPath = null;
class Process extends EventEmitter {
    constructor(){
        super();
        globalThis.addEventListener("unhandledrejection", (event)=>{
            if (process.listenerCount("unhandledRejection") === 0) {
                // The Node.js default behavior is to raise an uncaught exception if
                // an unhandled rejection occurs and there are no unhandledRejection
                // listeners.
                if (process.listenerCount("uncaughtException") === 0) {
                    throw event.reason;
                }
                event.preventDefault();
                uncaughtExceptionHandler(event.reason, "unhandledRejection");
                return;
            }
            event.preventDefault();
            process.emit("unhandledRejection", event.reason, event.promise);
        });
        globalThis.addEventListener("error", (event)=>{
            if (process.listenerCount("uncaughtException") > 0) {
                event.preventDefault();
            }
            uncaughtExceptionHandler(event.error, "uncaughtException");
        });
        globalThis.addEventListener("beforeunload", (e)=>{
            super.emit("beforeExit", process.exitCode || 0);
            processTicksAndRejections();
            if (core.eventLoopHasMoreWork()) {
                e.preventDefault();
            }
        });
        globalThis.addEventListener("unload", ()=>{
            if (!process._exiting) {
                process._exiting = true;
                super.emit("exit", process.exitCode || 0);
            }
        });
    }
    /** https://nodejs.org/api/process.html#process_process_arch */ arch = arch;
    /**
   * https://nodejs.org/api/process.html#process_process_argv
   * Read permissions are required in order to get the executable route
   */ argv = argv;
    /** https://nodejs.org/api/process.html#process_process_chdir_directory */ chdir = chdir;
    /** https://nodejs.org/api/process.html#processconfig */ config = {
        target_defaults: {},
        variables: {}
    };
    /** https://nodejs.org/api/process.html#process_process_cwd */ cwd = cwd;
    /**
   * https://nodejs.org/api/process.html#process_process_env
   * Requires env permissions
   */ env = env;
    /** https://nodejs.org/api/process.html#process_process_execargv */ execArgv = [];
    /** https://nodejs.org/api/process.html#process_process_exit_code */ exit = exit;
    _exiting = _exiting;
    /** https://nodejs.org/api/process.html#processexitcode_1 */ exitCode = undefined;
    // Typed as any to avoid importing "module" module for types
    // deno-lint-ignore no-explicit-any
    mainModule = undefined;
    /** https://nodejs.org/api/process.html#process_process_nexttick_callback_args */ nextTick = _nextTick;
    // deno-lint-ignore no-explicit-any
    on(event, listener) {
        if (notImplementedEvents.includes(event)) {
            warnNotImplemented(`process.on("${event}")`);
            super.on(event, listener);
        } else if (event.startsWith("SIG")) {
            if (event === "SIGBREAK" && Deno.build.os !== "windows") {
            // Ignores SIGBREAK if the platform is not windows.
            } else if (event === "SIGTERM" && Deno.build.os === "windows") {
            // Ignores SIGTERM on windows.
            } else {
                Deno.addSignalListener(event, listener);
            }
        } else {
            super.on(event, listener);
        }
        return this;
    }
    // deno-lint-ignore no-explicit-any
    off(event, listener) {
        if (notImplementedEvents.includes(event)) {
            warnNotImplemented(`process.off("${event}")`);
            super.off(event, listener);
        } else if (event.startsWith("SIG")) {
            if (event === "SIGBREAK" && Deno.build.os !== "windows") {
            // Ignores SIGBREAK if the platform is not windows.
            } else if (event === "SIGTERM" && Deno.build.os === "windows") {
            // Ignores SIGTERM on windows.
            } else {
                Deno.removeSignalListener(event, listener);
            }
        } else {
            super.off(event, listener);
        }
        return this;
    }
    // deno-lint-ignore no-explicit-any
    emit(event, ...args) {
        if (event.startsWith("SIG")) {
            if (event === "SIGBREAK" && Deno.build.os !== "windows") {
            // Ignores SIGBREAK if the platform is not windows.
            } else {
                Deno.kill(Deno.pid, event);
            }
        } else {
            return super.emit(event, ...args);
        }
        return true;
    }
    prependListener(event, // deno-lint-ignore no-explicit-any
    listener) {
        if (notImplementedEvents.includes(event)) {
            warnNotImplemented(`process.prependListener("${event}")`);
            super.prependListener(event, listener);
        } else if (event.startsWith("SIG")) {
            if (event === "SIGBREAK" && Deno.build.os !== "windows") {
            // Ignores SIGBREAK if the platform is not windows.
            } else {
                Deno.addSignalListener(event, listener);
            }
        } else {
            super.prependListener(event, listener);
        }
        return this;
    }
    /** https://nodejs.org/api/process.html#process_process_pid */ pid = pid;
    /** https://nodejs.org/api/process.html#process_process_platform */ platform = platform;
    addListener(event, // deno-lint-ignore no-explicit-any
    listener) {
        if (notImplementedEvents.includes(event)) {
            warnNotImplemented(`process.addListener("${event}")`);
        }
        return this.on(event, listener);
    }
    removeListener(event, // deno-lint-ignore no-explicit-any
    listener) {
        if (notImplementedEvents.includes(event)) {
            warnNotImplemented(`process.removeListener("${event}")`);
        }
        return this.off(event, listener);
    }
    /**
   * Returns the current high-resolution real time in a [seconds, nanoseconds]
   * tuple.
   *
   * Note: You need to give --allow-hrtime permission to Deno to actually get
   * nanoseconds precision values. If you don't give 'hrtime' permission, the returned
   * values only have milliseconds precision.
   *
   * `time` is an optional parameter that must be the result of a previous process.hrtime() call to diff with the current time.
   *
   * These times are relative to an arbitrary time in the past, and not related to the time of day and therefore not subject to clock drift. The primary use is for measuring performance between intervals.
   * https://nodejs.org/api/process.html#process_process_hrtime_time
   */ hrtime = hrtime;
    /**
   * @private
   *
   * NodeJS internal, use process.kill instead
   */ _kill = _kill;
    /** https://nodejs.org/api/process.html#processkillpid-signal */ kill = kill;
    memoryUsage = memoryUsage;
    /** https://nodejs.org/api/process.html#process_process_stderr */ stderr = stderr;
    /** https://nodejs.org/api/process.html#process_process_stdin */ stdin = stdin;
    /** https://nodejs.org/api/process.html#process_process_stdout */ stdout = stdout;
    /** https://nodejs.org/api/process.html#process_process_version */ version = version;
    /** https://nodejs.org/api/process.html#process_process_versions */ versions = versions;
    /** https://nodejs.org/api/process.html#process_process_emitwarning_warning_options */ emitWarning = emitWarning;
    binding(name) {
        return getBinding(name);
    }
    /** https://nodejs.org/api/process.html#processumaskmask */ umask() {
        // Always return the system default umask value.
        // We don't use Deno.umask here because it has a race
        // condition bug.
        // See https://github.com/denoland/deno_std/issues/1893#issuecomment-1032897779
        return 0o22;
    }
    /** This method is removed on Windows */ getgid() {
        return Deno.gid();
    }
    /** This method is removed on Windows */ getuid() {
        return Deno.uid();
    }
    // TODO(kt3k): Implement this when we added -e option to node compat mode
    _eval = undefined;
    /** https://nodejs.org/api/process.html#processexecpath */ get execPath() {
        if (execPath) {
            return execPath;
        }
        execPath = Deno.execPath();
        return execPath;
    }
    set execPath(path) {
        execPath = path;
    }
    #startTime = Date.now();
    /** https://nodejs.org/api/process.html#processuptime */ uptime() {
        return (Date.now() - this.#startTime) / 1000;
    }
    #allowedFlags = buildAllowedFlags();
    /** https://nodejs.org/api/process.html#processallowednodeenvironmentflags */ get allowedNodeEnvironmentFlags() {
        return this.#allowedFlags;
    }
    features = {
        inspector: false
    };
}
if (Deno.build.os === "windows") {
    delete Process.prototype.getgid;
    delete Process.prototype.getuid;
}
/** https://nodejs.org/api/process.html#process_process */ const process = new Process();
Object.defineProperty(process, Symbol.toStringTag, {
    enumerable: false,
    writable: true,
    configurable: false,
    value: "process"
});
addReadOnlyProcessAlias("noDeprecation", "--no-deprecation");
addReadOnlyProcessAlias("throwDeprecation", "--throw-deprecation");
export const removeListener = process.removeListener;
export const removeAllListeners = process.removeAllListeners;
export default process;
//TODO(Soremwar)
//Remove on 1.0
//Kept for backwards compatibility with std
export { process };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvcHJvY2Vzcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgTm9kZS5qcyBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCwgd2Fybk5vdEltcGxlbWVudGVkIH0gZnJvbSBcIi4vX3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tIFwiLi9ldmVudHMudHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlU3RyaW5nIH0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7XG4gIEVSUl9JTlZBTElEX0FSR19UWVBFLFxuICBFUlJfVU5LTk9XTl9TSUdOQUwsXG4gIGVycm5vRXhjZXB0aW9uLFxufSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IGdldE9wdGlvblZhbHVlIH0gZnJvbSBcIi4vaW50ZXJuYWwvb3B0aW9ucy50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uL191dGlsL2Fzc2VydHMudHNcIjtcbmltcG9ydCB7IGZyb21GaWxlVXJsLCBqb2luIH0gZnJvbSBcIi4uL3BhdGgvbW9kLnRzXCI7XG5pbXBvcnQge1xuICBhcmNoLFxuICBjaGRpcixcbiAgY3dkLFxuICBlbnYsXG4gIG5leHRUaWNrIGFzIF9uZXh0VGljayxcbiAgcGlkLFxuICBwbGF0Zm9ybSxcbiAgdmVyc2lvbixcbiAgdmVyc2lvbnMsXG59IGZyb20gXCIuL19wcm9jZXNzL3Byb2Nlc3MudHNcIjtcbmltcG9ydCB7IF9leGl0aW5nIH0gZnJvbSBcIi4vX3Byb2Nlc3MvZXhpdGluZy50c1wiO1xuZXhwb3J0IHtcbiAgX25leHRUaWNrIGFzIG5leHRUaWNrLFxuICBhcmNoLFxuICBhcmd2LFxuICBjaGRpcixcbiAgY3dkLFxuICBlbnYsXG4gIHBpZCxcbiAgcGxhdGZvcm0sXG4gIHZlcnNpb24sXG4gIHZlcnNpb25zLFxufTtcbmltcG9ydCB7XG4gIHN0ZGVyciBhcyBzdGRlcnJfLFxuICBzdGRpbiBhcyBzdGRpbl8sXG4gIHN0ZG91dCBhcyBzdGRvdXRfLFxufSBmcm9tIFwiLi9fcHJvY2Vzcy9zdHJlYW1zLm1qc1wiO1xuaW1wb3J0IHsgY29yZSB9IGZyb20gXCIuL19jb3JlLnRzXCI7XG5pbXBvcnQgeyBwcm9jZXNzVGlja3NBbmRSZWplY3Rpb25zIH0gZnJvbSBcIi4vX25leHRfdGljay50c1wiO1xuXG4vLyBUT0RPKGt0M2spOiBHaXZlIGJldHRlciB0eXBlcyB0byBzdGRpbyBvYmplY3RzXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuY29uc3Qgc3RkZXJyID0gc3RkZXJyXyBhcyBhbnk7XG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuY29uc3Qgc3RkaW4gPSBzdGRpbl8gYXMgYW55O1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmNvbnN0IHN0ZG91dCA9IHN0ZG91dF8gYXMgYW55O1xuZXhwb3J0IHsgc3RkZXJyLCBzdGRpbiwgc3Rkb3V0IH07XG5pbXBvcnQgeyBnZXRCaW5kaW5nIH0gZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy9tb2QudHNcIjtcbmltcG9ydCAqIGFzIGNvbnN0YW50cyBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0ICogYXMgdXYgZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy91di50c1wiO1xuaW1wb3J0IHR5cGUgeyBCaW5kaW5nTmFtZSB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvbW9kLnRzXCI7XG5pbXBvcnQgeyBidWlsZEFsbG93ZWRGbGFncyB9IGZyb20gXCIuL2ludGVybmFsL3Byb2Nlc3MvcGVyX3RocmVhZC5tanNcIjtcblxuLy8gQHRzLWlnbm9yZSBEZW5vW0Rlbm8uaW50ZXJuYWxdIGlzIHVzZWQgb24gcHVycG9zZSBoZXJlXG5jb25zdCBEZW5vQ29tbWFuZCA9IERlbm9bRGVuby5pbnRlcm5hbF0/Lm5vZGVVbnN0YWJsZT8uQ29tbWFuZCB8fFxuICBEZW5vLkNvbW1hbmQ7XG5cbmNvbnN0IG5vdEltcGxlbWVudGVkRXZlbnRzID0gW1xuICBcImRpc2Nvbm5lY3RcIixcbiAgXCJtZXNzYWdlXCIsXG4gIFwibXVsdGlwbGVSZXNvbHZlc1wiLFxuICBcInJlamVjdGlvbkhhbmRsZWRcIixcbiAgXCJ3b3JrZXJcIixcbl07XG5cbi8vIFRoZSBmaXJzdCAyIGl0ZW1zIGFyZSBwbGFjZWhvbGRlcnMuXG4vLyBUaGV5IHdpbGwgYmUgb3ZlcndyaXR0ZW4gYnkgdGhlIGJlbG93IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBjYWxscy5cbmNvbnN0IGFyZ3YgPSBbXCJcIiwgXCJcIiwgLi4uRGVuby5hcmdzXTtcbi8vIE92ZXJ3cml0ZXMgdGhlIDFzdCBpdGVtIHdpdGggZ2V0dGVyLlxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyZ3YsIFwiMFwiLCB7IGdldDogRGVuby5leGVjUGF0aCB9KTtcbi8vIE92ZXJ3cml0ZXMgdGhlIDJzdCBpdGVtIHdpdGggZ2V0dGVyLlxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyZ3YsIFwiMVwiLCB7XG4gIGdldDogKCkgPT4ge1xuICAgIGlmIChEZW5vLm1haW5Nb2R1bGUuc3RhcnRzV2l0aChcImZpbGU6XCIpKSB7XG4gICAgICByZXR1cm4gZnJvbUZpbGVVcmwoRGVuby5tYWluTW9kdWxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGpvaW4oRGVuby5jd2QoKSwgXCIkZGVubyRub2RlLmpzXCIpO1xuICAgIH1cbiAgfSxcbn0pO1xuXG4vKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2V4aXRfY29kZSAqL1xuZXhwb3J0IGNvbnN0IGV4aXQgPSAoY29kZT86IG51bWJlciB8IHN0cmluZykgPT4ge1xuICBpZiAoY29kZSB8fCBjb2RlID09PSAwKSB7XG4gICAgaWYgKHR5cGVvZiBjb2RlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCBwYXJzZWRDb2RlID0gcGFyc2VJbnQoY29kZSk7XG4gICAgICBwcm9jZXNzLmV4aXRDb2RlID0gaXNOYU4ocGFyc2VkQ29kZSkgPyB1bmRlZmluZWQgOiBwYXJzZWRDb2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcm9jZXNzLmV4aXRDb2RlID0gY29kZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIXByb2Nlc3MuX2V4aXRpbmcpIHtcbiAgICBwcm9jZXNzLl9leGl0aW5nID0gdHJ1ZTtcbiAgICAvLyBGSVhNRShiYXJ0bG9taWVqdSk6IHRoaXMgaXMgd3JvbmcsIHdlIHdvbid0IGJlIHVzaW5nIHN5c2NhbGwgdG8gZXhpdFxuICAgIC8vIGFuZCB0aHVzIHRoZSBgdW5sb2FkYCBldmVudCB3aWxsIG5vdCBiZSBlbWl0dGVkIHRvIHByb3Blcmx5IHRyaWdnZXIgXCJlbWl0XCJcbiAgICAvLyBldmVudCBvbiBgcHJvY2Vzc2AuXG4gICAgcHJvY2Vzcy5lbWl0KFwiZXhpdFwiLCBwcm9jZXNzLmV4aXRDb2RlIHx8IDApO1xuICB9XG5cbiAgRGVuby5leGl0KHByb2Nlc3MuZXhpdENvZGUgfHwgMCk7XG59O1xuXG5mdW5jdGlvbiBhZGRSZWFkT25seVByb2Nlc3NBbGlhcyhcbiAgbmFtZTogc3RyaW5nLFxuICBvcHRpb246IHN0cmluZyxcbiAgZW51bWVyYWJsZSA9IHRydWUsXG4pIHtcbiAgY29uc3QgdmFsdWUgPSBnZXRPcHRpb25WYWx1ZShvcHRpb24pO1xuXG4gIGlmICh2YWx1ZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9jZXNzLCBuYW1lLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICBlbnVtZXJhYmxlLFxuICAgICAgdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlV2FybmluZ09iamVjdChcbiAgd2FybmluZzogc3RyaW5nLFxuICB0eXBlOiBzdHJpbmcsXG4gIGNvZGU/OiBzdHJpbmcsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gIGN0b3I/OiBGdW5jdGlvbixcbiAgZGV0YWlsPzogc3RyaW5nLFxuKTogRXJyb3Ige1xuICBhc3NlcnQodHlwZW9mIHdhcm5pbmcgPT09IFwic3RyaW5nXCIpO1xuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IHdhcm5pbmdFcnI6IGFueSA9IG5ldyBFcnJvcih3YXJuaW5nKTtcbiAgd2FybmluZ0Vyci5uYW1lID0gU3RyaW5nKHR5cGUgfHwgXCJXYXJuaW5nXCIpO1xuXG4gIGlmIChjb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICB3YXJuaW5nRXJyLmNvZGUgPSBjb2RlO1xuICB9XG4gIGlmIChkZXRhaWwgIT09IHVuZGVmaW5lZCkge1xuICAgIHdhcm5pbmdFcnIuZGV0YWlsID0gZGV0YWlsO1xuICB9XG5cbiAgLy8gQHRzLWlnbm9yZSB0aGlzIGZ1bmN0aW9uIGlzIG5vdCBhdmFpbGFibGUgaW4gbGliLmRvbS5kLnRzXG4gIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHdhcm5pbmdFcnIsIGN0b3IgfHwgcHJvY2Vzcy5lbWl0V2FybmluZyk7XG5cbiAgcmV0dXJuIHdhcm5pbmdFcnI7XG59XG5cbmZ1bmN0aW9uIGRvRW1pdFdhcm5pbmcod2FybmluZzogRXJyb3IpIHtcbiAgcHJvY2Vzcy5lbWl0KFwid2FybmluZ1wiLCB3YXJuaW5nKTtcbn1cblxuLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19lbWl0d2FybmluZ193YXJuaW5nX29wdGlvbnMgKi9cbmV4cG9ydCBmdW5jdGlvbiBlbWl0V2FybmluZyhcbiAgd2FybmluZzogc3RyaW5nIHwgRXJyb3IsXG4gIHR5cGU6XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgICB8IHsgdHlwZTogc3RyaW5nOyBkZXRhaWw6IHN0cmluZzsgY29kZTogc3RyaW5nOyBjdG9yOiBGdW5jdGlvbiB9XG4gICAgfCBzdHJpbmdcbiAgICB8IG51bGwsXG4gIGNvZGU/OiBzdHJpbmcsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gIGN0b3I/OiBGdW5jdGlvbixcbikge1xuICBsZXQgZGV0YWlsO1xuXG4gIGlmICh0eXBlICE9PSBudWxsICYmIHR5cGVvZiB0eXBlID09PSBcIm9iamVjdFwiICYmICFBcnJheS5pc0FycmF5KHR5cGUpKSB7XG4gICAgY3RvciA9IHR5cGUuY3RvcjtcbiAgICBjb2RlID0gdHlwZS5jb2RlO1xuXG4gICAgaWYgKHR5cGVvZiB0eXBlLmRldGFpbCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgZGV0YWlsID0gdHlwZS5kZXRhaWw7XG4gICAgfVxuXG4gICAgdHlwZSA9IHR5cGUudHlwZSB8fCBcIldhcm5pbmdcIjtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3RvciA9IHR5cGU7XG4gICAgY29kZSA9IHVuZGVmaW5lZDtcbiAgICB0eXBlID0gXCJXYXJuaW5nXCI7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFsaWRhdGVTdHJpbmcodHlwZSwgXCJ0eXBlXCIpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBjb2RlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjdG9yID0gY29kZTtcbiAgICBjb2RlID0gdW5kZWZpbmVkO1xuICB9IGVsc2UgaWYgKGNvZGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhbGlkYXRlU3RyaW5nKGNvZGUsIFwiY29kZVwiKTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygd2FybmluZyA9PT0gXCJzdHJpbmdcIikge1xuICAgIHdhcm5pbmcgPSBjcmVhdGVXYXJuaW5nT2JqZWN0KHdhcm5pbmcsIHR5cGUgYXMgc3RyaW5nLCBjb2RlLCBjdG9yLCBkZXRhaWwpO1xuICB9IGVsc2UgaWYgKCEod2FybmluZyBpbnN0YW5jZW9mIEVycm9yKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcIndhcm5pbmdcIiwgW1wiRXJyb3JcIiwgXCJzdHJpbmdcIl0sIHdhcm5pbmcpO1xuICB9XG5cbiAgaWYgKHdhcm5pbmcubmFtZSA9PT0gXCJEZXByZWNhdGlvbldhcm5pbmdcIikge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChwcm9jZXNzIGFzIGFueSkubm9EZXByZWNhdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChwcm9jZXNzIGFzIGFueSkudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgLy8gRGVsYXkgdGhyb3dpbmcgdGhlIGVycm9yIHRvIGd1YXJhbnRlZSB0aGF0IGFsbCBmb3JtZXIgd2FybmluZ3Mgd2VyZVxuICAgICAgLy8gcHJvcGVybHkgbG9nZ2VkLlxuICAgICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soKCkgPT4ge1xuICAgICAgICB0aHJvdyB3YXJuaW5nO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJvY2Vzcy5uZXh0VGljayhkb0VtaXRXYXJuaW5nLCB3YXJuaW5nKTtcbn1cblxuZnVuY3Rpb24gaHJ0aW1lKHRpbWU/OiBbbnVtYmVyLCBudW1iZXJdKTogW251bWJlciwgbnVtYmVyXSB7XG4gIGNvbnN0IG1pbGxpID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gIGNvbnN0IHNlYyA9IE1hdGguZmxvb3IobWlsbGkgLyAxMDAwKTtcbiAgY29uc3QgbmFubyA9IE1hdGguZmxvb3IobWlsbGkgKiAxXzAwMF8wMDAgLSBzZWMgKiAxXzAwMF8wMDBfMDAwKTtcbiAgaWYgKCF0aW1lKSB7XG4gICAgcmV0dXJuIFtzZWMsIG5hbm9dO1xuICB9XG4gIGNvbnN0IFtwcmV2U2VjLCBwcmV2TmFub10gPSB0aW1lO1xuICByZXR1cm4gW3NlYyAtIHByZXZTZWMsIG5hbm8gLSBwcmV2TmFub107XG59XG5cbmhydGltZS5iaWdpbnQgPSBmdW5jdGlvbiAoKTogQmlnSW50IHtcbiAgY29uc3QgW3NlYywgbmFub10gPSBocnRpbWUoKTtcbiAgcmV0dXJuIEJpZ0ludChzZWMpICogMV8wMDBfMDAwXzAwMG4gKyBCaWdJbnQobmFubyk7XG59O1xuXG5mdW5jdGlvbiBtZW1vcnlVc2FnZSgpOiB7XG4gIHJzczogbnVtYmVyO1xuICBoZWFwVG90YWw6IG51bWJlcjtcbiAgaGVhcFVzZWQ6IG51bWJlcjtcbiAgZXh0ZXJuYWw6IG51bWJlcjtcbiAgYXJyYXlCdWZmZXJzOiBudW1iZXI7XG59IHtcbiAgcmV0dXJuIHtcbiAgICAuLi5EZW5vLm1lbW9yeVVzYWdlKCksXG4gICAgYXJyYXlCdWZmZXJzOiAwLFxuICB9O1xufVxuXG5tZW1vcnlVc2FnZS5yc3MgPSBmdW5jdGlvbiAoKTogbnVtYmVyIHtcbiAgcmV0dXJuIG1lbW9yeVVzYWdlKCkucnNzO1xufTtcblxuLy8gUmV0dXJucyBhIG5lZ2F0aXZlIGVycm9yIGNvZGUgdGhhbiBjYW4gYmUgcmVjb2duaXplZCBieSBlcnJub0V4Y2VwdGlvblxuZnVuY3Rpb24gX2tpbGwocGlkOiBudW1iZXIsIHNpZzogbnVtYmVyKTogbnVtYmVyIHtcbiAgbGV0IGVyckNvZGU7XG5cbiAgaWYgKHNpZyA9PT0gMCkge1xuICAgIGxldCBzdGF0dXM7XG4gICAgaWYgKERlbm8uYnVpbGQub3MgPT09IFwid2luZG93c1wiKSB7XG4gICAgICBzdGF0dXMgPSAobmV3IERlbm9Db21tYW5kKFwicG93ZXJzaGVsbC5leGVcIiwge1xuICAgICAgICBhcmdzOiBbXCJHZXQtUHJvY2Vzc1wiLCBcIi1waWRcIiwgcGlkXSxcbiAgICAgIH0pKS5vdXRwdXRTeW5jKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1cyA9IChuZXcgRGVub0NvbW1hbmQoXCJraWxsXCIsIHtcbiAgICAgICAgYXJnczogW1wiLTBcIiwgcGlkXSxcbiAgICAgIH0pKS5vdXRwdXRTeW5jKCk7XG4gICAgfVxuXG4gICAgaWYgKCFzdGF0dXMuc3VjY2Vzcykge1xuICAgICAgZXJyQ29kZSA9IHV2LmNvZGVNYXAuZ2V0KFwiRVNSQ0hcIik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIFJldmVyc2Ugc2VhcmNoIHRoZSBzaG9ydG5hbWUgYmFzZWQgb24gdGhlIG51bWVyaWMgY29kZVxuICAgIGNvbnN0IG1heWJlU2lnbmFsID0gT2JqZWN0LmVudHJpZXMoY29uc3RhbnRzLm9zLnNpZ25hbHMpLmZpbmQoKFxuICAgICAgW18sIG51bWVyaWNDb2RlXSxcbiAgICApID0+IG51bWVyaWNDb2RlID09PSBzaWcpO1xuXG4gICAgaWYgKCFtYXliZVNpZ25hbCkge1xuICAgICAgZXJyQ29kZSA9IHV2LmNvZGVNYXAuZ2V0KFwiRUlOVkFMXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBEZW5vLmtpbGwocGlkLCBtYXliZVNpZ25hbFswXSBhcyBEZW5vLlNpZ25hbCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgVHlwZUVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgbm90SW1wbGVtZW50ZWQobWF5YmVTaWduYWxbMF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoIWVyckNvZGUpIHtcbiAgICByZXR1cm4gMDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXJyQ29kZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24ga2lsbChwaWQ6IG51bWJlciwgc2lnOiBzdHJpbmcgfCBudW1iZXIgPSBcIlNJR1RFUk1cIikge1xuICBpZiAocGlkICE9IChwaWQgfCAwKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcInBpZFwiLCBcIm51bWJlclwiLCBwaWQpO1xuICB9XG5cbiAgbGV0IGVycjtcbiAgaWYgKHR5cGVvZiBzaWcgPT09IFwibnVtYmVyXCIpIHtcbiAgICBlcnIgPSBwcm9jZXNzLl9raWxsKHBpZCwgc2lnKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoc2lnIGluIGNvbnN0YW50cy5vcy5zaWduYWxzKSB7XG4gICAgICAvLyBAdHMtaWdub3JlIEluZGV4IHByZXZpb3VzbHkgY2hlY2tlZFxuICAgICAgZXJyID0gcHJvY2Vzcy5fa2lsbChwaWQsIGNvbnN0YW50cy5vcy5zaWduYWxzW3NpZ10pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX1VOS05PV05fU0lHTkFMKHNpZyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVycikge1xuICAgIHRocm93IGVycm5vRXhjZXB0aW9uKGVyciwgXCJraWxsXCIpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiB1bmNhdWdodEV4Y2VwdGlvbkhhbmRsZXIoZXJyOiBhbnksIG9yaWdpbjogc3RyaW5nKSB7XG4gIC8vIFRoZSBvcmlnaW4gcGFyYW1ldGVyIGNhbiBiZSAndW5oYW5kbGVkUmVqZWN0aW9uJyBvciAndW5jYXVnaHRFeGNlcHRpb24nXG4gIC8vIGRlcGVuZGluZyBvbiBob3cgdGhlIHVuY2F1Z2h0IGV4Y2VwdGlvbiB3YXMgY3JlYXRlZC4gSW4gTm9kZS5qcyxcbiAgLy8gZXhjZXB0aW9ucyB0aHJvd24gZnJvbSB0aGUgdG9wIGxldmVsIG9mIGEgQ29tbW9uSlMgbW9kdWxlIGFyZSByZXBvcnRlZCBhc1xuICAvLyAndW5jYXVnaHRFeGNlcHRpb24nLCB3aGlsZSBleGNlcHRpb25zIHRocm93biBmcm9tIHRoZSB0b3AgbGV2ZWwgb2YgYW4gRVNNXG4gIC8vIG1vZHVsZSBhcmUgcmVwb3J0ZWQgYXMgJ3VuaGFuZGxlZFJlamVjdGlvbicuIERlbm8gZG9lcyBub3QgaGF2ZSBhIHRydWVcbiAgLy8gQ29tbW9uSlMgaW1wbGVtZW50YXRpb24sIHNvIGFsbCBleGNlcHRpb25zIHRocm93biBmcm9tIHRoZSB0b3AgbGV2ZWwgYXJlXG4gIC8vIHJlcG9ydGVkIGFzICd1bmNhdWdodEV4Y2VwdGlvbicuXG4gIHByb2Nlc3MuZW1pdChcInVuY2F1Z2h0RXhjZXB0aW9uTW9uaXRvclwiLCBlcnIsIG9yaWdpbik7XG4gIHByb2Nlc3MuZW1pdChcInVuY2F1Z2h0RXhjZXB0aW9uXCIsIGVyciwgb3JpZ2luKTtcbn1cblxubGV0IGV4ZWNQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuY2xhc3MgUHJvY2VzcyBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG5cbiAgICBnbG9iYWxUaGlzLmFkZEV2ZW50TGlzdGVuZXIoXCJ1bmhhbmRsZWRyZWplY3Rpb25cIiwgKGV2ZW50KSA9PiB7XG4gICAgICBpZiAocHJvY2Vzcy5saXN0ZW5lckNvdW50KFwidW5oYW5kbGVkUmVqZWN0aW9uXCIpID09PSAwKSB7XG4gICAgICAgIC8vIFRoZSBOb2RlLmpzIGRlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmFpc2UgYW4gdW5jYXVnaHQgZXhjZXB0aW9uIGlmXG4gICAgICAgIC8vIGFuIHVuaGFuZGxlZCByZWplY3Rpb24gb2NjdXJzIGFuZCB0aGVyZSBhcmUgbm8gdW5oYW5kbGVkUmVqZWN0aW9uXG4gICAgICAgIC8vIGxpc3RlbmVycy5cbiAgICAgICAgaWYgKHByb2Nlc3MubGlzdGVuZXJDb3VudChcInVuY2F1Z2h0RXhjZXB0aW9uXCIpID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgZXZlbnQucmVhc29uO1xuICAgICAgICB9XG5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdW5jYXVnaHRFeGNlcHRpb25IYW5kbGVyKGV2ZW50LnJlYXNvbiwgXCJ1bmhhbmRsZWRSZWplY3Rpb25cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHByb2Nlc3MuZW1pdChcInVuaGFuZGxlZFJlamVjdGlvblwiLCBldmVudC5yZWFzb24sIGV2ZW50LnByb21pc2UpO1xuICAgIH0pO1xuXG4gICAgZ2xvYmFsVGhpcy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKGV2ZW50KSA9PiB7XG4gICAgICBpZiAocHJvY2Vzcy5saXN0ZW5lckNvdW50KFwidW5jYXVnaHRFeGNlcHRpb25cIikgPiAwKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG5cbiAgICAgIHVuY2F1Z2h0RXhjZXB0aW9uSGFuZGxlcihldmVudC5lcnJvciwgXCJ1bmNhdWdodEV4Y2VwdGlvblwiKTtcbiAgICB9KTtcblxuICAgIGdsb2JhbFRoaXMuYWRkRXZlbnRMaXN0ZW5lcihcImJlZm9yZXVubG9hZFwiLCAoZSkgPT4ge1xuICAgICAgc3VwZXIuZW1pdChcImJlZm9yZUV4aXRcIiwgcHJvY2Vzcy5leGl0Q29kZSB8fCAwKTtcbiAgICAgIHByb2Nlc3NUaWNrc0FuZFJlamVjdGlvbnMoKTtcbiAgICAgIGlmIChjb3JlLmV2ZW50TG9vcEhhc01vcmVXb3JrKCkpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZ2xvYmFsVGhpcy5hZGRFdmVudExpc3RlbmVyKFwidW5sb2FkXCIsICgpID0+IHtcbiAgICAgIGlmICghcHJvY2Vzcy5fZXhpdGluZykge1xuICAgICAgICBwcm9jZXNzLl9leGl0aW5nID0gdHJ1ZTtcbiAgICAgICAgc3VwZXIuZW1pdChcImV4aXRcIiwgcHJvY2Vzcy5leGl0Q29kZSB8fCAwKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfYXJjaCAqL1xuICBhcmNoID0gYXJjaDtcblxuICAvKipcbiAgICogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2FyZ3ZcbiAgICogUmVhZCBwZXJtaXNzaW9ucyBhcmUgcmVxdWlyZWQgaW4gb3JkZXIgdG8gZ2V0IHRoZSBleGVjdXRhYmxlIHJvdXRlXG4gICAqL1xuICBhcmd2ID0gYXJndjtcblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2NoZGlyX2RpcmVjdG9yeSAqL1xuICBjaGRpciA9IGNoZGlyO1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzY29uZmlnICovXG4gIGNvbmZpZyA9IHtcbiAgICB0YXJnZXRfZGVmYXVsdHM6IHt9LFxuICAgIHZhcmlhYmxlczoge30sXG4gIH07XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19jd2QgKi9cbiAgY3dkID0gY3dkO1xuXG4gIC8qKlxuICAgKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfZW52XG4gICAqIFJlcXVpcmVzIGVudiBwZXJtaXNzaW9uc1xuICAgKi9cbiAgZW52ID0gZW52O1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfZXhlY2FyZ3YgKi9cbiAgZXhlY0FyZ3Y6IHN0cmluZ1tdID0gW107XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19leGl0X2NvZGUgKi9cbiAgZXhpdCA9IGV4aXQ7XG5cbiAgX2V4aXRpbmcgPSBfZXhpdGluZztcblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc2V4aXRjb2RlXzEgKi9cbiAgZXhpdENvZGU6IHVuZGVmaW5lZCB8IG51bWJlciA9IHVuZGVmaW5lZDtcblxuICAvLyBUeXBlZCBhcyBhbnkgdG8gYXZvaWQgaW1wb3J0aW5nIFwibW9kdWxlXCIgbW9kdWxlIGZvciB0eXBlc1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBtYWluTW9kdWxlOiBhbnkgPSB1bmRlZmluZWQ7XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19uZXh0dGlja19jYWxsYmFja19hcmdzICovXG4gIG5leHRUaWNrID0gX25leHRUaWNrO1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfZXZlbnRzICovXG4gIG92ZXJyaWRlIG9uKGV2ZW50OiBcImV4aXRcIiwgbGlzdGVuZXI6IChjb2RlOiBudW1iZXIpID0+IHZvaWQpOiB0aGlzO1xuICBvdmVycmlkZSBvbihcbiAgICBldmVudDogdHlwZW9mIG5vdEltcGxlbWVudGVkRXZlbnRzW251bWJlcl0sXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgICBsaXN0ZW5lcjogRnVuY3Rpb24sXG4gICk6IHRoaXM7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG92ZXJyaWRlIG9uKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzIHtcbiAgICBpZiAobm90SW1wbGVtZW50ZWRFdmVudHMuaW5jbHVkZXMoZXZlbnQpKSB7XG4gICAgICB3YXJuTm90SW1wbGVtZW50ZWQoYHByb2Nlc3Mub24oXCIke2V2ZW50fVwiKWApO1xuICAgICAgc3VwZXIub24oZXZlbnQsIGxpc3RlbmVyKTtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LnN0YXJ0c1dpdGgoXCJTSUdcIikpIHtcbiAgICAgIGlmIChldmVudCA9PT0gXCJTSUdCUkVBS1wiICYmIERlbm8uYnVpbGQub3MgIT09IFwid2luZG93c1wiKSB7XG4gICAgICAgIC8vIElnbm9yZXMgU0lHQlJFQUsgaWYgdGhlIHBsYXRmb3JtIGlzIG5vdCB3aW5kb3dzLlxuICAgICAgfSBlbHNlIGlmIChldmVudCA9PT0gXCJTSUdURVJNXCIgJiYgRGVuby5idWlsZC5vcyA9PT0gXCJ3aW5kb3dzXCIpIHtcbiAgICAgICAgLy8gSWdub3JlcyBTSUdURVJNIG9uIHdpbmRvd3MuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBEZW5vLmFkZFNpZ25hbExpc3RlbmVyKGV2ZW50IGFzIERlbm8uU2lnbmFsLCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBvdmVycmlkZSBvZmYoZXZlbnQ6IFwiZXhpdFwiLCBsaXN0ZW5lcjogKGNvZGU6IG51bWJlcikgPT4gdm9pZCk6IHRoaXM7XG4gIG92ZXJyaWRlIG9mZihcbiAgICBldmVudDogdHlwZW9mIG5vdEltcGxlbWVudGVkRXZlbnRzW251bWJlcl0sXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgICBsaXN0ZW5lcjogRnVuY3Rpb24sXG4gICk6IHRoaXM7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG92ZXJyaWRlIG9mZihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgaWYgKG5vdEltcGxlbWVudGVkRXZlbnRzLmluY2x1ZGVzKGV2ZW50KSkge1xuICAgICAgd2Fybk5vdEltcGxlbWVudGVkKGBwcm9jZXNzLm9mZihcIiR7ZXZlbnR9XCIpYCk7XG4gICAgICBzdXBlci5vZmYoZXZlbnQsIGxpc3RlbmVyKTtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LnN0YXJ0c1dpdGgoXCJTSUdcIikpIHtcbiAgICAgIGlmIChldmVudCA9PT0gXCJTSUdCUkVBS1wiICYmIERlbm8uYnVpbGQub3MgIT09IFwid2luZG93c1wiKSB7XG4gICAgICAgIC8vIElnbm9yZXMgU0lHQlJFQUsgaWYgdGhlIHBsYXRmb3JtIGlzIG5vdCB3aW5kb3dzLlxuICAgICAgfSBlbHNlIGlmIChldmVudCA9PT0gXCJTSUdURVJNXCIgJiYgRGVuby5idWlsZC5vcyA9PT0gXCJ3aW5kb3dzXCIpIHtcbiAgICAgICAgLy8gSWdub3JlcyBTSUdURVJNIG9uIHdpbmRvd3MuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBEZW5vLnJlbW92ZVNpZ25hbExpc3RlbmVyKGV2ZW50IGFzIERlbm8uU2lnbmFsLCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyLm9mZihldmVudCwgbGlzdGVuZXIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgb3ZlcnJpZGUgZW1pdChldmVudDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IGJvb2xlYW4ge1xuICAgIGlmIChldmVudC5zdGFydHNXaXRoKFwiU0lHXCIpKSB7XG4gICAgICBpZiAoZXZlbnQgPT09IFwiU0lHQlJFQUtcIiAmJiBEZW5vLmJ1aWxkLm9zICE9PSBcIndpbmRvd3NcIikge1xuICAgICAgICAvLyBJZ25vcmVzIFNJR0JSRUFLIGlmIHRoZSBwbGF0Zm9ybSBpcyBub3Qgd2luZG93cy5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIERlbm8ua2lsbChEZW5vLnBpZCwgZXZlbnQgYXMgRGVuby5TaWduYWwpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3VwZXIuZW1pdChldmVudCwgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBwcmVwZW5kTGlzdGVuZXIoXG4gICAgZXZlbnQ6IFwiZXhpdFwiLFxuICAgIGxpc3RlbmVyOiAoY29kZTogbnVtYmVyKSA9PiB2b2lkLFxuICApOiB0aGlzO1xuICBvdmVycmlkZSBwcmVwZW5kTGlzdGVuZXIoXG4gICAgZXZlbnQ6IHR5cGVvZiBub3RJbXBsZW1lbnRlZEV2ZW50c1tudW1iZXJdLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gICAgbGlzdGVuZXI6IEZ1bmN0aW9uLFxuICApOiB0aGlzO1xuICBvdmVycmlkZSBwcmVwZW5kTGlzdGVuZXIoXG4gICAgZXZlbnQ6IHN0cmluZyxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQsXG4gICk6IHRoaXMge1xuICAgIGlmIChub3RJbXBsZW1lbnRlZEV2ZW50cy5pbmNsdWRlcyhldmVudCkpIHtcbiAgICAgIHdhcm5Ob3RJbXBsZW1lbnRlZChgcHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIoXCIke2V2ZW50fVwiKWApO1xuICAgICAgc3VwZXIucHJlcGVuZExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgfSBlbHNlIGlmIChldmVudC5zdGFydHNXaXRoKFwiU0lHXCIpKSB7XG4gICAgICBpZiAoZXZlbnQgPT09IFwiU0lHQlJFQUtcIiAmJiBEZW5vLmJ1aWxkLm9zICE9PSBcIndpbmRvd3NcIikge1xuICAgICAgICAvLyBJZ25vcmVzIFNJR0JSRUFLIGlmIHRoZSBwbGF0Zm9ybSBpcyBub3Qgd2luZG93cy5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIERlbm8uYWRkU2lnbmFsTGlzdGVuZXIoZXZlbnQgYXMgRGVuby5TaWduYWwsIGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3VwZXIucHJlcGVuZExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX3BpZCAqL1xuICBwaWQgPSBwaWQ7XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19wbGF0Zm9ybSAqL1xuICBwbGF0Zm9ybSA9IHBsYXRmb3JtO1xuXG4gIG92ZXJyaWRlIGFkZExpc3RlbmVyKGV2ZW50OiBcImV4aXRcIiwgbGlzdGVuZXI6IChjb2RlOiBudW1iZXIpID0+IHZvaWQpOiB0aGlzO1xuICBvdmVycmlkZSBhZGRMaXN0ZW5lcihcbiAgICBldmVudDogdHlwZW9mIG5vdEltcGxlbWVudGVkRXZlbnRzW251bWJlcl0sXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgICBsaXN0ZW5lcjogRnVuY3Rpb24sXG4gICk6IHRoaXM7XG4gIG92ZXJyaWRlIGFkZExpc3RlbmVyKFxuICAgIGV2ZW50OiBzdHJpbmcsXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBsaXN0ZW5lcjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkLFxuICApOiB0aGlzIHtcbiAgICBpZiAobm90SW1wbGVtZW50ZWRFdmVudHMuaW5jbHVkZXMoZXZlbnQpKSB7XG4gICAgICB3YXJuTm90SW1wbGVtZW50ZWQoYHByb2Nlc3MuYWRkTGlzdGVuZXIoXCIke2V2ZW50fVwiKWApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG4gIH1cblxuICBvdmVycmlkZSByZW1vdmVMaXN0ZW5lcihcbiAgICBldmVudDogXCJleGl0XCIsXG4gICAgbGlzdGVuZXI6IChjb2RlOiBudW1iZXIpID0+IHZvaWQsXG4gICk6IHRoaXM7XG4gIG92ZXJyaWRlIHJlbW92ZUxpc3RlbmVyKFxuICAgIGV2ZW50OiB0eXBlb2Ygbm90SW1wbGVtZW50ZWRFdmVudHNbbnVtYmVyXSxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICAgIGxpc3RlbmVyOiBGdW5jdGlvbixcbiAgKTogdGhpcztcbiAgb3ZlcnJpZGUgcmVtb3ZlTGlzdGVuZXIoXG4gICAgZXZlbnQ6IHN0cmluZyxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQsXG4gICk6IHRoaXMge1xuICAgIGlmIChub3RJbXBsZW1lbnRlZEV2ZW50cy5pbmNsdWRlcyhldmVudCkpIHtcbiAgICAgIHdhcm5Ob3RJbXBsZW1lbnRlZChgcHJvY2Vzcy5yZW1vdmVMaXN0ZW5lcihcIiR7ZXZlbnR9XCIpYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgY3VycmVudCBoaWdoLXJlc29sdXRpb24gcmVhbCB0aW1lIGluIGEgW3NlY29uZHMsIG5hbm9zZWNvbmRzXVxuICAgKiB0dXBsZS5cbiAgICpcbiAgICogTm90ZTogWW91IG5lZWQgdG8gZ2l2ZSAtLWFsbG93LWhydGltZSBwZXJtaXNzaW9uIHRvIERlbm8gdG8gYWN0dWFsbHkgZ2V0XG4gICAqIG5hbm9zZWNvbmRzIHByZWNpc2lvbiB2YWx1ZXMuIElmIHlvdSBkb24ndCBnaXZlICdocnRpbWUnIHBlcm1pc3Npb24sIHRoZSByZXR1cm5lZFxuICAgKiB2YWx1ZXMgb25seSBoYXZlIG1pbGxpc2Vjb25kcyBwcmVjaXNpb24uXG4gICAqXG4gICAqIGB0aW1lYCBpcyBhbiBvcHRpb25hbCBwYXJhbWV0ZXIgdGhhdCBtdXN0IGJlIHRoZSByZXN1bHQgb2YgYSBwcmV2aW91cyBwcm9jZXNzLmhydGltZSgpIGNhbGwgdG8gZGlmZiB3aXRoIHRoZSBjdXJyZW50IHRpbWUuXG4gICAqXG4gICAqIFRoZXNlIHRpbWVzIGFyZSByZWxhdGl2ZSB0byBhbiBhcmJpdHJhcnkgdGltZSBpbiB0aGUgcGFzdCwgYW5kIG5vdCByZWxhdGVkIHRvIHRoZSB0aW1lIG9mIGRheSBhbmQgdGhlcmVmb3JlIG5vdCBzdWJqZWN0IHRvIGNsb2NrIGRyaWZ0LiBUaGUgcHJpbWFyeSB1c2UgaXMgZm9yIG1lYXN1cmluZyBwZXJmb3JtYW5jZSBiZXR3ZWVuIGludGVydmFscy5cbiAgICogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2hydGltZV90aW1lXG4gICAqL1xuICBocnRpbWUgPSBocnRpbWU7XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqXG4gICAqIE5vZGVKUyBpbnRlcm5hbCwgdXNlIHByb2Nlc3Mua2lsbCBpbnN0ZWFkXG4gICAqL1xuICBfa2lsbCA9IF9raWxsO1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNza2lsbHBpZC1zaWduYWwgKi9cbiAga2lsbCA9IGtpbGw7XG5cbiAgbWVtb3J5VXNhZ2UgPSBtZW1vcnlVc2FnZTtcblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX3N0ZGVyciAqL1xuICBzdGRlcnIgPSBzdGRlcnI7XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19zdGRpbiAqL1xuICBzdGRpbiA9IHN0ZGluO1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3Nfc3Rkb3V0ICovXG4gIHN0ZG91dCA9IHN0ZG91dDtcblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX3ZlcnNpb24gKi9cbiAgdmVyc2lvbiA9IHZlcnNpb247XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc192ZXJzaW9ucyAqL1xuICB2ZXJzaW9ucyA9IHZlcnNpb25zO1xuXG4gIC8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfZW1pdHdhcm5pbmdfd2FybmluZ19vcHRpb25zICovXG4gIGVtaXRXYXJuaW5nID0gZW1pdFdhcm5pbmc7XG5cbiAgYmluZGluZyhuYW1lOiBCaW5kaW5nTmFtZSkge1xuICAgIHJldHVybiBnZXRCaW5kaW5nKG5hbWUpO1xuICB9XG5cbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3N1bWFza21hc2sgKi9cbiAgdW1hc2soKSB7XG4gICAgLy8gQWx3YXlzIHJldHVybiB0aGUgc3lzdGVtIGRlZmF1bHQgdW1hc2sgdmFsdWUuXG4gICAgLy8gV2UgZG9uJ3QgdXNlIERlbm8udW1hc2sgaGVyZSBiZWNhdXNlIGl0IGhhcyBhIHJhY2VcbiAgICAvLyBjb25kaXRpb24gYnVnLlxuICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVub19zdGQvaXNzdWVzLzE4OTMjaXNzdWVjb21tZW50LTEwMzI4OTc3NzlcbiAgICByZXR1cm4gMG8yMjtcbiAgfVxuXG4gIC8qKiBUaGlzIG1ldGhvZCBpcyByZW1vdmVkIG9uIFdpbmRvd3MgKi9cbiAgZ2V0Z2lkPygpOiBudW1iZXIge1xuICAgIHJldHVybiBEZW5vLmdpZCgpITtcbiAgfVxuXG4gIC8qKiBUaGlzIG1ldGhvZCBpcyByZW1vdmVkIG9uIFdpbmRvd3MgKi9cbiAgZ2V0dWlkPygpOiBudW1iZXIge1xuICAgIHJldHVybiBEZW5vLnVpZCgpITtcbiAgfVxuXG4gIC8vIFRPRE8oa3Qzayk6IEltcGxlbWVudCB0aGlzIHdoZW4gd2UgYWRkZWQgLWUgb3B0aW9uIHRvIG5vZGUgY29tcGF0IG1vZGVcbiAgX2V2YWw6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc2V4ZWNwYXRoICovXG4gIGdldCBleGVjUGF0aCgpIHtcbiAgICBpZiAoZXhlY1BhdGgpIHtcbiAgICAgIHJldHVybiBleGVjUGF0aDtcbiAgICB9XG4gICAgZXhlY1BhdGggPSBEZW5vLmV4ZWNQYXRoKCk7XG4gICAgcmV0dXJuIGV4ZWNQYXRoO1xuICB9XG5cbiAgc2V0IGV4ZWNQYXRoKHBhdGg6IHN0cmluZykge1xuICAgIGV4ZWNQYXRoID0gcGF0aDtcbiAgfVxuXG4gICNzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAvKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc3VwdGltZSAqL1xuICB1cHRpbWUoKSB7XG4gICAgcmV0dXJuIChEYXRlLm5vdygpIC0gdGhpcy4jc3RhcnRUaW1lKSAvIDEwMDA7XG4gIH1cblxuICAjYWxsb3dlZEZsYWdzID0gYnVpbGRBbGxvd2VkRmxhZ3MoKTtcbiAgLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NhbGxvd2Vkbm9kZWVudmlyb25tZW50ZmxhZ3MgKi9cbiAgZ2V0IGFsbG93ZWROb2RlRW52aXJvbm1lbnRGbGFncygpIHtcbiAgICByZXR1cm4gdGhpcy4jYWxsb3dlZEZsYWdzO1xuICB9XG5cbiAgZmVhdHVyZXMgPSB7IGluc3BlY3RvcjogZmFsc2UgfTtcbn1cblxuaWYgKERlbm8uYnVpbGQub3MgPT09IFwid2luZG93c1wiKSB7XG4gIGRlbGV0ZSBQcm9jZXNzLnByb3RvdHlwZS5nZXRnaWQ7XG4gIGRlbGV0ZSBQcm9jZXNzLnByb3RvdHlwZS5nZXR1aWQ7XG59XG5cbi8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3MgKi9cbmNvbnN0IHByb2Nlc3MgPSBuZXcgUHJvY2VzcygpO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvY2VzcywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7XG4gIGVudW1lcmFibGU6IGZhbHNlLFxuICB3cml0YWJsZTogdHJ1ZSxcbiAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgdmFsdWU6IFwicHJvY2Vzc1wiLFxufSk7XG5cbmFkZFJlYWRPbmx5UHJvY2Vzc0FsaWFzKFwibm9EZXByZWNhdGlvblwiLCBcIi0tbm8tZGVwcmVjYXRpb25cIik7XG5hZGRSZWFkT25seVByb2Nlc3NBbGlhcyhcInRocm93RGVwcmVjYXRpb25cIiwgXCItLXRocm93LWRlcHJlY2F0aW9uXCIpO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlTGlzdGVuZXIgPSBwcm9jZXNzLnJlbW92ZUxpc3RlbmVyO1xuZXhwb3J0IGNvbnN0IHJlbW92ZUFsbExpc3RlbmVycyA9IHByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzO1xuXG5leHBvcnQgZGVmYXVsdCBwcm9jZXNzO1xuXG4vL1RPRE8oU29yZW13YXIpXG4vL1JlbW92ZSBvbiAxLjBcbi8vS2VwdCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzdGRcbmV4cG9ydCB7IHByb2Nlc3MgfTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUZBQXFGO0FBRXJGLFNBQVMsY0FBYyxFQUFFLGtCQUFrQixRQUFRLGNBQWM7QUFDakUsU0FBUyxZQUFZLFFBQVEsY0FBYztBQUMzQyxTQUFTLGNBQWMsUUFBUSw0QkFBNEI7QUFDM0QsU0FDRSxvQkFBb0IsRUFDcEIsa0JBQWtCLEVBQ2xCLGNBQWMsUUFDVCx1QkFBdUI7QUFDOUIsU0FBUyxjQUFjLFFBQVEsd0JBQXdCO0FBQ3ZELFNBQVMsTUFBTSxRQUFRLHNCQUFzQjtBQUM3QyxTQUFTLFdBQVcsRUFBRSxJQUFJLFFBQVEsaUJBQWlCO0FBQ25ELFNBQ0UsSUFBSSxFQUNKLEtBQUssRUFDTCxHQUFHLEVBQ0gsR0FBRyxFQUNILFlBQVksU0FBUyxFQUNyQixHQUFHLEVB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