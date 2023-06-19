// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module implements 'child_process' module of Node.JS API.
// ref: https://nodejs.org/api/child_process.html
import { ChildProcess, normalizeSpawnArguments, spawnSync as _spawnSync, stdioStringToArray } from "./internal/child_process.ts";
import { validateAbortSignal, validateFunction, validateObject, validateString } from "./internal/validators.mjs";
import { ERR_CHILD_PROCESS_IPC_REQUIRED, ERR_CHILD_PROCESS_STDIO_MAXBUFFER, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_OUT_OF_RANGE, genericNodeError } from "./internal/errors.ts";
import { ArrayIsArray, ArrayPrototypeJoin, ArrayPrototypePush, ArrayPrototypeSlice, ObjectAssign, StringPrototypeSlice } from "./internal/primordials.mjs";
import { getSystemErrorName, promisify } from "./util.ts";
import { createDeferredPromise } from "./internal/util.mjs";
import { process } from "./process.ts";
import { Buffer } from "./buffer.ts";
import { convertToValidSignal, kEmptyObject } from "./internal/util.mjs";
const MAX_BUFFER = 1024 * 1024;
/**
 * Spawns a new Node.js process + fork.
 * @param modulePath
 * @param args
 * @param option
 * @returns
 */ export function fork(modulePath, _args, _options) {
    validateString(modulePath, "modulePath");
    // Get options and args arguments.
    let execArgv;
    let options = {};
    let args = [];
    let pos = 1;
    if (pos < arguments.length && Array.isArray(arguments[pos])) {
        args = arguments[pos++];
    }
    if (pos < arguments.length && arguments[pos] == null) {
        pos++;
    }
    if (pos < arguments.length && arguments[pos] != null) {
        if (typeof arguments[pos] !== "object") {
            throw new ERR_INVALID_ARG_VALUE(`arguments[${pos}]`, arguments[pos]);
        }
        options = {
            ...arguments[pos++]
        };
    }
    // Prepare arguments for fork:
    execArgv = options.execArgv || process.execArgv;
    if (execArgv === process.execArgv && process._eval != null) {
        const index = execArgv.lastIndexOf(process._eval);
        if (index > 0) {
            // Remove the -e switch to avoid fork bombing ourselves.
            execArgv = execArgv.slice(0);
            execArgv.splice(index - 1, 2);
        }
    }
    // TODO(bartlomieju): this is incomplete, currently only handling a single
    // V8 flag to get Prisma integration running, we should fill this out with
    // more
    const v8Flags = [];
    if (Array.isArray(execArgv)) {
        for(let index1 = 0; index1 < execArgv.length; index1++){
            const flag = execArgv[index1];
            if (flag.startsWith("--max-old-space-size")) {
                execArgv.splice(index1, 1);
                v8Flags.push(flag);
            }
        }
    }
    const stringifiedV8Flags = [];
    if (v8Flags.length > 0) {
        stringifiedV8Flags.push("--v8-flags=" + v8Flags.join(","));
    }
    args = [
        "run",
        "--unstable",
        "--node-modules-dir",
        "-A",
        ...stringifiedV8Flags,
        ...execArgv,
        modulePath,
        ...args
    ];
    if (typeof options.stdio === "string") {
        options.stdio = stdioStringToArray(options.stdio, "ipc");
    } else if (!Array.isArray(options.stdio)) {
        // Use a separate fd=3 for the IPC channel. Inherit stdin, stdout,
        // and stderr from the parent if silent isn't set.
        options.stdio = stdioStringToArray(options.silent ? "pipe" : "inherit", "ipc");
    } else if (!options.stdio.includes("ipc")) {
        throw new ERR_CHILD_PROCESS_IPC_REQUIRED("options.stdio");
    }
    options.execPath = options.execPath || Deno.execPath();
    options.shell = false;
    Object.assign(options.env ??= {}, {
        // deno-lint-ignore no-explicit-any
        DENO_DONT_USE_INTERNAL_NODE_COMPAT_STATE: Deno.core.ops.op_npm_process_state()
    });
    return spawn(options.execPath, args, options);
}
/**
 * Spawns a child process using `command`.
 */ export function spawn(command, argsOrOptions, maybeOptions) {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : [];
    const options = !Array.isArray(argsOrOptions) && argsOrOptions != null ? argsOrOptions : maybeOptions;
    validateAbortSignal(options?.signal, "options.signal");
    return new ChildProcess(command, args, options);
}
function validateTimeout(timeout) {
    if (timeout != null && !(Number.isInteger(timeout) && timeout >= 0)) {
        throw new ERR_OUT_OF_RANGE("timeout", "an unsigned integer", timeout);
    }
}
function validateMaxBuffer(maxBuffer) {
    if (maxBuffer != null && !(typeof maxBuffer === "number" && maxBuffer >= 0)) {
        throw new ERR_OUT_OF_RANGE("options.maxBuffer", "a positive number", maxBuffer);
    }
}
function sanitizeKillSignal(killSignal) {
    if (typeof killSignal === "string" || typeof killSignal === "number") {
        return convertToValidSignal(killSignal);
    } else if (killSignal != null) {
        throw new ERR_INVALID_ARG_TYPE("options.killSignal", [
            "string",
            "number"
        ], killSignal);
    }
}
export function spawnSync(command, argsOrOptions, maybeOptions) {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : [];
    let options = !Array.isArray(argsOrOptions) && argsOrOptions ? argsOrOptions : maybeOptions;
    options = {
        maxBuffer: MAX_BUFFER,
        ...normalizeSpawnArguments(command, args, options)
    };
    // Validate the timeout, if present.
    validateTimeout(options.timeout);
    // Validate maxBuffer, if present.
    validateMaxBuffer(options.maxBuffer);
    // Validate and translate the kill signal, if present.
    sanitizeKillSignal(options.killSignal);
    return _spawnSync(command, args, options);
}
function normalizeExecArgs(command, optionsOrCallback, maybeCallback) {
    let callback = maybeCallback;
    if (typeof optionsOrCallback === "function") {
        callback = optionsOrCallback;
        optionsOrCallback = undefined;
    }
    // Make a shallow copy so we don't clobber the user's options object.
    const options = {
        ...optionsOrCallback
    };
    options.shell = typeof options.shell === "string" ? options.shell : true;
    return {
        file: command,
        options: options,
        callback: callback
    };
}
export function exec(command, optionsOrCallback, maybeCallback) {
    const opts = normalizeExecArgs(command, optionsOrCallback, maybeCallback);
    return execFile(opts.file, opts.options, opts.callback);
}
const customPromiseExecFunction = (orig)=>{
    return (...args)=>{
        const { promise , resolve , reject  } = createDeferredPromise();
        promise.child = orig(...args, (err, stdout, stderr)=>{
            if (err !== null) {
                const _err = err;
                _err.stdout = stdout;
                _err.stderr = stderr;
                reject && reject(_err);
            } else {
                resolve && resolve({
                    stdout,
                    stderr
                });
            }
        });
        return promise;
    };
};
Object.defineProperty(exec, promisify.custom, {
    enumerable: false,
    value: customPromiseExecFunction(exec)
});
class ExecFileError extends Error {
    code;
    constructor(message){
        super(message);
        this.code = "UNKNOWN";
    }
}
export function execFile(file, argsOrOptionsOrCallback, optionsOrCallback, maybeCallback) {
    let args = [];
    let options = {};
    let callback;
    if (Array.isArray(argsOrOptionsOrCallback)) {
        args = argsOrOptionsOrCallback;
    } else if (argsOrOptionsOrCallback instanceof Function) {
        callback = argsOrOptionsOrCallback;
    } else if (argsOrOptionsOrCallback) {
        options = argsOrOptionsOrCallback;
    }
    if (optionsOrCallback instanceof Function) {
        callback = optionsOrCallback;
    } else if (optionsOrCallback) {
        options = optionsOrCallback;
        callback = maybeCallback;
    }
    const execOptions = {
        encoding: "utf8",
        timeout: 0,
        maxBuffer: MAX_BUFFER,
        killSignal: "SIGTERM",
        shell: false,
        ...options
    };
    if (!Number.isInteger(execOptions.timeout) || execOptions.timeout < 0) {
        // In Node source, the first argument to error constructor is "timeout" instead of "options.timeout".
        // timeout is indeed a member of options object.
        throw new ERR_OUT_OF_RANGE("timeout", "an unsigned integer", execOptions.timeout);
    }
    if (execOptions.maxBuffer < 0) {
        throw new ERR_OUT_OF_RANGE("options.maxBuffer", "a positive number", execOptions.maxBuffer);
    }
    const spawnOptions = {
        cwd: execOptions.cwd,
        env: execOptions.env,
        gid: execOptions.gid,
        shell: execOptions.shell,
        signal: execOptions.signal,
        uid: execOptions.uid,
        windowsHide: !!execOptions.windowsHide,
        windowsVerbatimArguments: !!execOptions.windowsVerbatimArguments
    };
    const child = spawn(file, args, spawnOptions);
    let encoding;
    const _stdout = [];
    const _stderr = [];
    if (execOptions.encoding !== "buffer" && Buffer.isEncoding(execOptions.encoding)) {
        encoding = execOptions.encoding;
    } else {
        encoding = null;
    }
    let stdoutLen = 0;
    let stderrLen = 0;
    let killed = false;
    let exited = false;
    let timeoutId;
    let ex = null;
    let cmd = file;
    function exithandler(code = 0, signal) {
        if (exited) return;
        exited = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (!callback) return;
        // merge chunks
        let stdout;
        let stderr;
        if (encoding || child.stdout && child.stdout.readableEncoding) {
            stdout = _stdout.join("");
        } else {
            stdout = Buffer.concat(_stdout);
        }
        if (encoding || child.stderr && child.stderr.readableEncoding) {
            stderr = _stderr.join("");
        } else {
            stderr = Buffer.concat(_stderr);
        }
        if (!ex && code === 0 && signal === null) {
            callback(null, stdout, stderr);
            return;
        }
        if (args?.length) {
            cmd += ` ${args.join(" ")}`;
        }
        if (!ex) {
            ex = new ExecFileError("Command failed: " + cmd + "\n" + stderr);
            ex.code = code < 0 ? getSystemErrorName(code) : code;
            ex.killed = child.killed || killed;
            ex.signal = signal;
        }
        ex.cmd = cmd;
        callback(ex, stdout, stderr);
    }
    function errorhandler(e) {
        ex = e;
        if (child.stdout) {
            child.stdout.destroy();
        }
        if (child.stderr) {
            child.stderr.destroy();
        }
        exithandler();
    }
    function kill() {
        if (child.stdout) {
            child.stdout.destroy();
        }
        if (child.stderr) {
            child.stderr.destroy();
        }
        killed = true;
        try {
            child.kill(execOptions.killSignal);
        } catch (e) {
            if (e) {
                ex = e;
            }
            exithandler();
        }
    }
    if (execOptions.timeout > 0) {
        timeoutId = setTimeout(function delayedKill() {
            kill();
            timeoutId = null;
        }, execOptions.timeout);
    }
    if (child.stdout) {
        if (encoding) {
            child.stdout.setEncoding(encoding);
        }
        child.stdout.on("data", function onChildStdout(chunk) {
            // Do not need to count the length
            if (execOptions.maxBuffer === Infinity) {
                ArrayPrototypePush(_stdout, chunk);
                return;
            }
            const encoding = child.stdout?.readableEncoding;
            const length = encoding ? Buffer.byteLength(chunk, encoding) : chunk.length;
            const slice = encoding ? StringPrototypeSlice : (buf, ...args)=>buf.slice(...args);
            stdoutLen += length;
            if (stdoutLen > execOptions.maxBuffer) {
                const truncatedLen = execOptions.maxBuffer - (stdoutLen - length);
                ArrayPrototypePush(_stdout, slice(chunk, 0, truncatedLen));
                ex = new ERR_CHILD_PROCESS_STDIO_MAXBUFFER("stdout");
                kill();
            } else {
                ArrayPrototypePush(_stdout, chunk);
            }
        });
    }
    if (child.stderr) {
        if (encoding) {
            child.stderr.setEncoding(encoding);
        }
        child.stderr.on("data", function onChildStderr(chunk) {
            // Do not need to count the length
            if (execOptions.maxBuffer === Infinity) {
                ArrayPrototypePush(_stderr, chunk);
                return;
            }
            const encoding = child.stderr?.readableEncoding;
            const length = encoding ? Buffer.byteLength(chunk, encoding) : chunk.length;
            const slice = encoding ? StringPrototypeSlice : (buf, ...args)=>buf.slice(...args);
            stderrLen += length;
            if (stderrLen > execOptions.maxBuffer) {
                const truncatedLen = execOptions.maxBuffer - (stderrLen - length);
                ArrayPrototypePush(_stderr, slice(chunk, 0, truncatedLen));
                ex = new ERR_CHILD_PROCESS_STDIO_MAXBUFFER("stderr");
                kill();
            } else {
                ArrayPrototypePush(_stderr, chunk);
            }
        });
    }
    child.addListener("close", exithandler);
    child.addListener("error", errorhandler);
    return child;
}
function checkExecSyncError(ret, args, cmd) {
    let err;
    if (ret.error) {
        err = ret.error;
        ObjectAssign(err, ret);
    } else if (ret.status !== 0) {
        let msg = "Command failed: ";
        msg += cmd || ArrayPrototypeJoin(args, " ");
        if (ret.stderr && ret.stderr.length > 0) {
            msg += `\n${ret.stderr.toString()}`;
        }
        err = genericNodeError(msg, ret);
    }
    return err;
}
export function execSync(command, options) {
    const opts = normalizeExecArgs(command, options);
    const inheritStderr = !opts.options.stdio;
    const ret = spawnSync(opts.file, opts.options);
    if (inheritStderr && ret.stderr) {
        process.stderr.write(ret.stderr);
    }
    const err = checkExecSyncError(ret, [], command);
    if (err) {
        throw err;
    }
    return ret.stdout;
}
function normalizeExecFileArgs(file, args, options, callback) {
    if (ArrayIsArray(args)) {
        args = ArrayPrototypeSlice(args);
    } else if (args != null && typeof args === "object") {
        callback = options;
        options = args;
        args = null;
    } else if (typeof args === "function") {
        callback = args;
        options = null;
        args = null;
    }
    if (args == null) {
        args = [];
    }
    if (typeof options === "function") {
        callback = options;
    } else if (options != null) {
        validateObject(options, "options");
    }
    if (options == null) {
        options = kEmptyObject;
    }
    args = args;
    options = options;
    if (callback != null) {
        validateFunction(callback, "callback");
    }
    // Validate argv0, if present.
    if (options.argv0 != null) {
        validateString(options.argv0, "options.argv0");
    }
    return {
        file,
        args,
        options,
        callback
    };
}
export function execFileSync(file, args, options) {
    ({ file , args , options  } = normalizeExecFileArgs(file, args, options));
    const inheritStderr = !options.stdio;
    const ret = spawnSync(file, args, options);
    if (inheritStderr && ret.stderr) {
        process.stderr.write(ret.stderr);
    }
    const errArgs = [
        options.argv0 || file,
        ...args
    ];
    const err = checkExecSyncError(ret, errArgs);
    if (err) {
        throw err;
    }
    return ret.stdout;
}
export default {
    fork,
    spawn,
    exec,
    execFile,
    execFileSync,
    execSync,
    ChildProcess,
    spawnSync
};
export { ChildProcess };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvY2hpbGRfcHJvY2Vzcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBUaGlzIG1vZHVsZSBpbXBsZW1lbnRzICdjaGlsZF9wcm9jZXNzJyBtb2R1bGUgb2YgTm9kZS5KUyBBUEkuXG4vLyByZWY6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvY2hpbGRfcHJvY2Vzcy5odG1sXG5pbXBvcnQge1xuICBDaGlsZFByb2Nlc3MsXG4gIENoaWxkUHJvY2Vzc09wdGlvbnMsXG4gIG5vcm1hbGl6ZVNwYXduQXJndW1lbnRzLFxuICBzcGF3blN5bmMgYXMgX3NwYXduU3luYyxcbiAgdHlwZSBTcGF3blN5bmNPcHRpb25zLFxuICB0eXBlIFNwYXduU3luY1Jlc3VsdCxcbiAgc3RkaW9TdHJpbmdUb0FycmF5LFxufSBmcm9tIFwiLi9pbnRlcm5hbC9jaGlsZF9wcm9jZXNzLnRzXCI7XG5pbXBvcnQge1xuICB2YWxpZGF0ZUFib3J0U2lnbmFsLFxuICB2YWxpZGF0ZUZ1bmN0aW9uLFxuICB2YWxpZGF0ZU9iamVjdCxcbiAgdmFsaWRhdGVTdHJpbmcsXG59IGZyb20gXCIuL2ludGVybmFsL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQge1xuICBFUlJfQ0hJTERfUFJPQ0VTU19JUENfUkVRVUlSRUQsXG4gIEVSUl9DSElMRF9QUk9DRVNTX1NURElPX01BWEJVRkZFUixcbiAgRVJSX0lOVkFMSURfQVJHX1RZUEUsXG4gIEVSUl9JTlZBTElEX0FSR19WQUxVRSxcbiAgRVJSX09VVF9PRl9SQU5HRSxcbiAgZ2VuZXJpY05vZGVFcnJvcixcbn0gZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQge1xuICBBcnJheUlzQXJyYXksXG4gIEFycmF5UHJvdG90eXBlSm9pbixcbiAgQXJyYXlQcm90b3R5cGVQdXNoLFxuICBBcnJheVByb3RvdHlwZVNsaWNlLFxuICBPYmplY3RBc3NpZ24sXG4gIFN0cmluZ1Byb3RvdHlwZVNsaWNlLFxufSBmcm9tIFwiLi9pbnRlcm5hbC9wcmltb3JkaWFscy5tanNcIjtcbmltcG9ydCB7IGdldFN5c3RlbUVycm9yTmFtZSwgcHJvbWlzaWZ5IH0gZnJvbSBcIi4vdXRpbC50c1wiO1xuaW1wb3J0IHsgY3JlYXRlRGVmZXJyZWRQcm9taXNlIH0gZnJvbSBcIi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcbmltcG9ydCB7IHByb2Nlc3MgfSBmcm9tIFwiLi9wcm9jZXNzLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IGNvbnZlcnRUb1ZhbGlkU2lnbmFsLCBrRW1wdHlPYmplY3QgfSBmcm9tIFwiLi9pbnRlcm5hbC91dGlsLm1qc1wiO1xuXG5jb25zdCBNQVhfQlVGRkVSID0gMTAyNCAqIDEwMjQ7XG5cbnR5cGUgRm9ya09wdGlvbnMgPSBDaGlsZFByb2Nlc3NPcHRpb25zO1xuXG4vKipcbiAqIFNwYXducyBhIG5ldyBOb2RlLmpzIHByb2Nlc3MgKyBmb3JrLlxuICogQHBhcmFtIG1vZHVsZVBhdGhcbiAqIEBwYXJhbSBhcmdzXG4gKiBAcGFyYW0gb3B0aW9uXG4gKiBAcmV0dXJuc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9yayhcbiAgbW9kdWxlUGF0aDogc3RyaW5nLFxuICBfYXJncz86IHN0cmluZ1tdLFxuICBfb3B0aW9ucz86IEZvcmtPcHRpb25zLFxuKSB7XG4gIHZhbGlkYXRlU3RyaW5nKG1vZHVsZVBhdGgsIFwibW9kdWxlUGF0aFwiKTtcblxuICAvLyBHZXQgb3B0aW9ucyBhbmQgYXJncyBhcmd1bWVudHMuXG4gIGxldCBleGVjQXJndjtcbiAgbGV0IG9wdGlvbnM6IFNwYXduT3B0aW9ucyAmIHtcbiAgICBleGVjQXJndj86IHN0cmluZztcbiAgICBleGVjUGF0aD86IHN0cmluZztcbiAgICBzaWxlbnQ/OiBib29sZWFuO1xuICB9ID0ge307XG4gIGxldCBhcmdzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgcG9zID0gMTtcbiAgaWYgKHBvcyA8IGFyZ3VtZW50cy5sZW5ndGggJiYgQXJyYXkuaXNBcnJheShhcmd1bWVudHNbcG9zXSkpIHtcbiAgICBhcmdzID0gYXJndW1lbnRzW3BvcysrXTtcbiAgfVxuXG4gIGlmIChwb3MgPCBhcmd1bWVudHMubGVuZ3RoICYmIGFyZ3VtZW50c1twb3NdID09IG51bGwpIHtcbiAgICBwb3MrKztcbiAgfVxuXG4gIGlmIChwb3MgPCBhcmd1bWVudHMubGVuZ3RoICYmIGFyZ3VtZW50c1twb3NdICE9IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1twb3NdICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1ZBTFVFKGBhcmd1bWVudHNbJHtwb3N9XWAsIGFyZ3VtZW50c1twb3NdKTtcbiAgICB9XG5cbiAgICBvcHRpb25zID0geyAuLi5hcmd1bWVudHNbcG9zKytdIH07XG4gIH1cblxuICAvLyBQcmVwYXJlIGFyZ3VtZW50cyBmb3IgZm9yazpcbiAgZXhlY0FyZ3YgPSBvcHRpb25zLmV4ZWNBcmd2IHx8IHByb2Nlc3MuZXhlY0FyZ3Y7XG5cbiAgaWYgKGV4ZWNBcmd2ID09PSBwcm9jZXNzLmV4ZWNBcmd2ICYmIHByb2Nlc3MuX2V2YWwgIT0gbnVsbCkge1xuICAgIGNvbnN0IGluZGV4ID0gZXhlY0FyZ3YubGFzdEluZGV4T2YocHJvY2Vzcy5fZXZhbCk7XG4gICAgaWYgKGluZGV4ID4gMCkge1xuICAgICAgLy8gUmVtb3ZlIHRoZSAtZSBzd2l0Y2ggdG8gYXZvaWQgZm9yayBib21iaW5nIG91cnNlbHZlcy5cbiAgICAgIGV4ZWNBcmd2ID0gZXhlY0FyZ3Yuc2xpY2UoMCk7XG4gICAgICBleGVjQXJndi5zcGxpY2UoaW5kZXggLSAxLCAyKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPKGJhcnRsb21pZWp1KTogdGhpcyBpcyBpbmNvbXBsZXRlLCBjdXJyZW50bHkgb25seSBoYW5kbGluZyBhIHNpbmdsZVxuICAvLyBWOCBmbGFnIHRvIGdldCBQcmlzbWEgaW50ZWdyYXRpb24gcnVubmluZywgd2Ugc2hvdWxkIGZpbGwgdGhpcyBvdXQgd2l0aFxuICAvLyBtb3JlXG4gIGNvbnN0IHY4RmxhZ3M6IHN0cmluZ1tdID0gW107XG4gIGlmIChBcnJheS5pc0FycmF5KGV4ZWNBcmd2KSkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBleGVjQXJndi5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGZsYWcgPSBleGVjQXJndltpbmRleF07XG4gICAgICBpZiAoZmxhZy5zdGFydHNXaXRoKFwiLS1tYXgtb2xkLXNwYWNlLXNpemVcIikpIHtcbiAgICAgICAgZXhlY0FyZ3Yuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdjhGbGFncy5wdXNoKGZsYWcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCBzdHJpbmdpZmllZFY4RmxhZ3M6IHN0cmluZ1tdID0gW107XG4gIGlmICh2OEZsYWdzLmxlbmd0aCA+IDApIHtcbiAgICBzdHJpbmdpZmllZFY4RmxhZ3MucHVzaChcIi0tdjgtZmxhZ3M9XCIgKyB2OEZsYWdzLmpvaW4oXCIsXCIpKTtcbiAgfVxuICBhcmdzID0gW1xuICAgIFwicnVuXCIsXG4gICAgXCItLXVuc3RhYmxlXCIsIC8vIFRPRE8oa3Qzayk6IFJlbW92ZSB3aGVuIG5wbTogaXMgc3RhYmxlXG4gICAgXCItLW5vZGUtbW9kdWxlcy1kaXJcIixcbiAgICBcIi1BXCIsXG4gICAgLi4uc3RyaW5naWZpZWRWOEZsYWdzLFxuICAgIC4uLmV4ZWNBcmd2LFxuICAgIG1vZHVsZVBhdGgsXG4gICAgLi4uYXJncyxcbiAgXTtcblxuICBpZiAodHlwZW9mIG9wdGlvbnMuc3RkaW8gPT09IFwic3RyaW5nXCIpIHtcbiAgICBvcHRpb25zLnN0ZGlvID0gc3RkaW9TdHJpbmdUb0FycmF5KG9wdGlvbnMuc3RkaW8sIFwiaXBjXCIpO1xuICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KG9wdGlvbnMuc3RkaW8pKSB7XG4gICAgLy8gVXNlIGEgc2VwYXJhdGUgZmQ9MyBmb3IgdGhlIElQQyBjaGFubmVsLiBJbmhlcml0IHN0ZGluLCBzdGRvdXQsXG4gICAgLy8gYW5kIHN0ZGVyciBmcm9tIHRoZSBwYXJlbnQgaWYgc2lsZW50IGlzbid0IHNldC5cbiAgICBvcHRpb25zLnN0ZGlvID0gc3RkaW9TdHJpbmdUb0FycmF5KFxuICAgICAgb3B0aW9ucy5zaWxlbnQgPyBcInBpcGVcIiA6IFwiaW5oZXJpdFwiLFxuICAgICAgXCJpcGNcIixcbiAgICApO1xuICB9IGVsc2UgaWYgKCFvcHRpb25zLnN0ZGlvLmluY2x1ZGVzKFwiaXBjXCIpKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9DSElMRF9QUk9DRVNTX0lQQ19SRVFVSVJFRChcIm9wdGlvbnMuc3RkaW9cIik7XG4gIH1cblxuICBvcHRpb25zLmV4ZWNQYXRoID0gb3B0aW9ucy5leGVjUGF0aCB8fCBEZW5vLmV4ZWNQYXRoKCk7XG4gIG9wdGlvbnMuc2hlbGwgPSBmYWxzZTtcblxuICBPYmplY3QuYXNzaWduKG9wdGlvbnMuZW52ID8/PSB7fSwge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgREVOT19ET05UX1VTRV9JTlRFUk5BTF9OT0RFX0NPTVBBVF9TVEFURTogKERlbm8gYXMgYW55KS5jb3JlLm9wc1xuICAgICAgLm9wX25wbV9wcm9jZXNzX3N0YXRlKCksXG4gIH0pO1xuXG4gIHJldHVybiBzcGF3bihvcHRpb25zLmV4ZWNQYXRoLCBhcmdzLCBvcHRpb25zKTtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1lbXB0eS1pbnRlcmZhY2VcbmludGVyZmFjZSBTcGF3bk9wdGlvbnMgZXh0ZW5kcyBDaGlsZFByb2Nlc3NPcHRpb25zIHt9XG5leHBvcnQgZnVuY3Rpb24gc3Bhd24oY29tbWFuZDogc3RyaW5nKTogQ2hpbGRQcm9jZXNzO1xuZXhwb3J0IGZ1bmN0aW9uIHNwYXduKGNvbW1hbmQ6IHN0cmluZywgb3B0aW9uczogU3Bhd25PcHRpb25zKTogQ2hpbGRQcm9jZXNzO1xuZXhwb3J0IGZ1bmN0aW9uIHNwYXduKGNvbW1hbmQ6IHN0cmluZywgYXJnczogc3RyaW5nW10pOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gc3Bhd24oXG4gIGNvbW1hbmQ6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIG9wdGlvbnM6IFNwYXduT3B0aW9ucyxcbik6IENoaWxkUHJvY2Vzcztcbi8qKlxuICogU3Bhd25zIGEgY2hpbGQgcHJvY2VzcyB1c2luZyBgY29tbWFuZGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzcGF3bihcbiAgY29tbWFuZDogc3RyaW5nLFxuICBhcmdzT3JPcHRpb25zPzogc3RyaW5nW10gfCBTcGF3bk9wdGlvbnMsXG4gIG1heWJlT3B0aW9ucz86IFNwYXduT3B0aW9ucyxcbik6IENoaWxkUHJvY2VzcyB7XG4gIGNvbnN0IGFyZ3MgPSBBcnJheS5pc0FycmF5KGFyZ3NPck9wdGlvbnMpID8gYXJnc09yT3B0aW9ucyA6IFtdO1xuICBjb25zdCBvcHRpb25zID0gIUFycmF5LmlzQXJyYXkoYXJnc09yT3B0aW9ucykgJiYgYXJnc09yT3B0aW9ucyAhPSBudWxsXG4gICAgPyBhcmdzT3JPcHRpb25zXG4gICAgOiBtYXliZU9wdGlvbnM7XG4gIHZhbGlkYXRlQWJvcnRTaWduYWwob3B0aW9ucz8uc2lnbmFsLCBcIm9wdGlvbnMuc2lnbmFsXCIpO1xuICByZXR1cm4gbmV3IENoaWxkUHJvY2Vzcyhjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVUaW1lb3V0KHRpbWVvdXQ/OiBudW1iZXIpIHtcbiAgaWYgKHRpbWVvdXQgIT0gbnVsbCAmJiAhKE51bWJlci5pc0ludGVnZXIodGltZW91dCkgJiYgdGltZW91dCA+PSAwKSkge1xuICAgIHRocm93IG5ldyBFUlJfT1VUX09GX1JBTkdFKFwidGltZW91dFwiLCBcImFuIHVuc2lnbmVkIGludGVnZXJcIiwgdGltZW91dCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVNYXhCdWZmZXIobWF4QnVmZmVyPzogbnVtYmVyKSB7XG4gIGlmIChcbiAgICBtYXhCdWZmZXIgIT0gbnVsbCAmJlxuICAgICEodHlwZW9mIG1heEJ1ZmZlciA9PT0gXCJudW1iZXJcIiAmJiBtYXhCdWZmZXIgPj0gMClcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9PVVRfT0ZfUkFOR0UoXG4gICAgICBcIm9wdGlvbnMubWF4QnVmZmVyXCIsXG4gICAgICBcImEgcG9zaXRpdmUgbnVtYmVyXCIsXG4gICAgICBtYXhCdWZmZXIsXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZUtpbGxTaWduYWwoa2lsbFNpZ25hbD86IHN0cmluZyB8IG51bWJlcikge1xuICBpZiAodHlwZW9mIGtpbGxTaWduYWwgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIGtpbGxTaWduYWwgPT09IFwibnVtYmVyXCIpIHtcbiAgICByZXR1cm4gY29udmVydFRvVmFsaWRTaWduYWwoa2lsbFNpZ25hbCk7XG4gIH0gZWxzZSBpZiAoa2lsbFNpZ25hbCAhPSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFxuICAgICAgXCJvcHRpb25zLmtpbGxTaWduYWxcIixcbiAgICAgIFtcInN0cmluZ1wiLCBcIm51bWJlclwiXSxcbiAgICAgIGtpbGxTaWduYWwsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc3Bhd25TeW5jKFxuICBjb21tYW5kOiBzdHJpbmcsXG4gIGFyZ3NPck9wdGlvbnM/OiBzdHJpbmdbXSB8IFNwYXduU3luY09wdGlvbnMsXG4gIG1heWJlT3B0aW9ucz86IFNwYXduU3luY09wdGlvbnMsXG4pOiBTcGF3blN5bmNSZXN1bHQge1xuICBjb25zdCBhcmdzID0gQXJyYXkuaXNBcnJheShhcmdzT3JPcHRpb25zKSA/IGFyZ3NPck9wdGlvbnMgOiBbXTtcbiAgbGV0IG9wdGlvbnMgPSAhQXJyYXkuaXNBcnJheShhcmdzT3JPcHRpb25zKSAmJiBhcmdzT3JPcHRpb25zXG4gICAgPyBhcmdzT3JPcHRpb25zXG4gICAgOiBtYXliZU9wdGlvbnMgYXMgU3Bhd25TeW5jT3B0aW9ucztcblxuICBvcHRpb25zID0ge1xuICAgIG1heEJ1ZmZlcjogTUFYX0JVRkZFUixcbiAgICAuLi5ub3JtYWxpemVTcGF3bkFyZ3VtZW50cyhjb21tYW5kLCBhcmdzLCBvcHRpb25zKSxcbiAgfTtcblxuICAvLyBWYWxpZGF0ZSB0aGUgdGltZW91dCwgaWYgcHJlc2VudC5cbiAgdmFsaWRhdGVUaW1lb3V0KG9wdGlvbnMudGltZW91dCk7XG5cbiAgLy8gVmFsaWRhdGUgbWF4QnVmZmVyLCBpZiBwcmVzZW50LlxuICB2YWxpZGF0ZU1heEJ1ZmZlcihvcHRpb25zLm1heEJ1ZmZlcik7XG5cbiAgLy8gVmFsaWRhdGUgYW5kIHRyYW5zbGF0ZSB0aGUga2lsbCBzaWduYWwsIGlmIHByZXNlbnQuXG4gIHNhbml0aXplS2lsbFNpZ25hbChvcHRpb25zLmtpbGxTaWduYWwpO1xuXG4gIHJldHVybiBfc3Bhd25TeW5jKGNvbW1hbmQsIGFyZ3MsIG9wdGlvbnMpO1xufVxuXG5pbnRlcmZhY2UgRXhlY09wdGlvbnMgZXh0ZW5kc1xuICBQaWNrPFxuICAgIENoaWxkUHJvY2Vzc09wdGlvbnMsXG4gICAgfCBcImVudlwiXG4gICAgfCBcInNpZ25hbFwiXG4gICAgfCBcInVpZFwiXG4gICAgfCBcImdpZFwiXG4gICAgfCBcIndpbmRvd3NIaWRlXCJcbiAgPiB7XG4gIGN3ZD86IHN0cmluZyB8IFVSTDtcbiAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBTaGVsbCB0byBleGVjdXRlIHRoZSBjb21tYW5kIHdpdGguXG4gICAqL1xuICBzaGVsbD86IHN0cmluZztcbiAgdGltZW91dD86IG51bWJlcjtcbiAgLyoqXG4gICAqIExhcmdlc3QgYW1vdW50IG9mIGRhdGEgaW4gYnl0ZXMgYWxsb3dlZCBvbiBzdGRvdXQgb3Igc3RkZXJyLiBJZiBleGNlZWRlZCwgdGhlIGNoaWxkIHByb2Nlc3MgaXMgdGVybWluYXRlZCBhbmQgYW55IG91dHB1dCBpcyB0cnVuY2F0ZWQuXG4gICAqL1xuICBtYXhCdWZmZXI/OiBudW1iZXI7XG4gIGtpbGxTaWduYWw/OiBzdHJpbmcgfCBudW1iZXI7XG59XG50eXBlIEV4ZWNFeGNlcHRpb24gPSBDaGlsZFByb2Nlc3NFcnJvcjtcbnR5cGUgRXhlY0NhbGxiYWNrID0gKFxuICBlcnJvcjogRXhlY0V4Y2VwdGlvbiB8IG51bGwsXG4gIHN0ZG91dD86IHN0cmluZyB8IEJ1ZmZlcixcbiAgc3RkZXJyPzogc3RyaW5nIHwgQnVmZmVyLFxuKSA9PiB2b2lkO1xudHlwZSBFeGVjU3luY09wdGlvbnMgPSBTcGF3blN5bmNPcHRpb25zO1xudHlwZSBFeGVjRmlsZVN5bmNPcHRpb25zID0gU3Bhd25TeW5jT3B0aW9ucztcbmZ1bmN0aW9uIG5vcm1hbGl6ZUV4ZWNBcmdzKFxuICBjb21tYW5kOiBzdHJpbmcsXG4gIG9wdGlvbnNPckNhbGxiYWNrPzogRXhlY09wdGlvbnMgfCBFeGVjU3luY09wdGlvbnMgfCBFeGVjQ2FsbGJhY2ssXG4gIG1heWJlQ2FsbGJhY2s/OiBFeGVjQ2FsbGJhY2ssXG4pIHtcbiAgbGV0IGNhbGxiYWNrOiBFeGVjRmlsZUNhbGxiYWNrIHwgdW5kZWZpbmVkID0gbWF5YmVDYWxsYmFjaztcblxuICBpZiAodHlwZW9mIG9wdGlvbnNPckNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNPckNhbGxiYWNrO1xuICAgIG9wdGlvbnNPckNhbGxiYWNrID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gTWFrZSBhIHNoYWxsb3cgY29weSBzbyB3ZSBkb24ndCBjbG9iYmVyIHRoZSB1c2VyJ3Mgb3B0aW9ucyBvYmplY3QuXG4gIGNvbnN0IG9wdGlvbnM6IEV4ZWNPcHRpb25zIHwgRXhlY1N5bmNPcHRpb25zID0geyAuLi5vcHRpb25zT3JDYWxsYmFjayB9O1xuICBvcHRpb25zLnNoZWxsID0gdHlwZW9mIG9wdGlvbnMuc2hlbGwgPT09IFwic3RyaW5nXCIgPyBvcHRpb25zLnNoZWxsIDogdHJ1ZTtcblxuICByZXR1cm4ge1xuICAgIGZpbGU6IGNvbW1hbmQsXG4gICAgb3B0aW9uczogb3B0aW9ucyEsXG4gICAgY2FsbGJhY2s6IGNhbGxiYWNrISxcbiAgfTtcbn1cblxuLyoqXG4gKiBTcGF3bnMgYSBzaGVsbCBleGVjdXRpbmcgdGhlIGdpdmVuIGNvbW1hbmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjKGNvbW1hbmQ6IHN0cmluZyk6IENoaWxkUHJvY2VzcztcbmV4cG9ydCBmdW5jdGlvbiBleGVjKGNvbW1hbmQ6IHN0cmluZywgb3B0aW9uczogRXhlY09wdGlvbnMpOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlYyhjb21tYW5kOiBzdHJpbmcsIGNhbGxiYWNrOiBFeGVjQ2FsbGJhY2spOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlYyhcbiAgY29tbWFuZDogc3RyaW5nLFxuICBvcHRpb25zOiBFeGVjT3B0aW9ucyxcbiAgY2FsbGJhY2s6IEV4ZWNDYWxsYmFjayxcbik6IENoaWxkUHJvY2VzcztcbmV4cG9ydCBmdW5jdGlvbiBleGVjKFxuICBjb21tYW5kOiBzdHJpbmcsXG4gIG9wdGlvbnNPckNhbGxiYWNrPzogRXhlY09wdGlvbnMgfCBFeGVjQ2FsbGJhY2ssXG4gIG1heWJlQ2FsbGJhY2s/OiBFeGVjQ2FsbGJhY2ssXG4pOiBDaGlsZFByb2Nlc3Mge1xuICBjb25zdCBvcHRzID0gbm9ybWFsaXplRXhlY0FyZ3MoY29tbWFuZCwgb3B0aW9uc09yQ2FsbGJhY2ssIG1heWJlQ2FsbGJhY2spO1xuICByZXR1cm4gZXhlY0ZpbGUob3B0cy5maWxlLCBvcHRzLm9wdGlvbnMgYXMgRXhlY0ZpbGVPcHRpb25zLCBvcHRzLmNhbGxiYWNrKTtcbn1cblxuaW50ZXJmYWNlIFByb21pc2VXaXRoQ2hpbGQ8VD4gZXh0ZW5kcyBQcm9taXNlPFQ+IHtcbiAgY2hpbGQ6IENoaWxkUHJvY2Vzcztcbn1cbnR5cGUgRXhlY091dHB1dEZvclByb21pc2lmeSA9IHtcbiAgc3Rkb3V0Pzogc3RyaW5nIHwgQnVmZmVyO1xuICBzdGRlcnI/OiBzdHJpbmcgfCBCdWZmZXI7XG59O1xudHlwZSBFeGVjRXhjZXB0aW9uRm9yUHJvbWlzaWZ5ID0gRXhlY0V4Y2VwdGlvbiAmIEV4ZWNPdXRwdXRGb3JQcm9taXNpZnk7XG5cbmNvbnN0IGN1c3RvbVByb21pc2VFeGVjRnVuY3Rpb24gPSAob3JpZzogdHlwZW9mIGV4ZWMpID0+IHtcbiAgcmV0dXJuICguLi5hcmdzOiBbY29tbWFuZDogc3RyaW5nLCBvcHRpb25zOiBFeGVjT3B0aW9uc10pID0+IHtcbiAgICBjb25zdCB7IHByb21pc2UsIHJlc29sdmUsIHJlamVjdCB9ID0gY3JlYXRlRGVmZXJyZWRQcm9taXNlKCkgYXMgdW5rbm93biBhcyB7XG4gICAgICBwcm9taXNlOiBQcm9taXNlV2l0aENoaWxkPEV4ZWNPdXRwdXRGb3JQcm9taXNpZnk+O1xuICAgICAgcmVzb2x2ZT86ICh2YWx1ZTogRXhlY091dHB1dEZvclByb21pc2lmeSkgPT4gdm9pZDtcbiAgICAgIHJlamVjdD86IChyZWFzb24/OiBFeGVjRXhjZXB0aW9uRm9yUHJvbWlzaWZ5KSA9PiB2b2lkO1xuICAgIH07XG5cbiAgICBwcm9taXNlLmNoaWxkID0gb3JpZyguLi5hcmdzLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgaWYgKGVyciAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBfZXJyOiBFeGVjRXhjZXB0aW9uRm9yUHJvbWlzaWZ5ID0gZXJyO1xuICAgICAgICBfZXJyLnN0ZG91dCA9IHN0ZG91dDtcbiAgICAgICAgX2Vyci5zdGRlcnIgPSBzdGRlcnI7XG4gICAgICAgIHJlamVjdCAmJiByZWplY3QoX2Vycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlICYmIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBwcm9taXNlO1xuICB9O1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4ZWMsIHByb21pc2lmeS5jdXN0b20sIHtcbiAgZW51bWVyYWJsZTogZmFsc2UsXG4gIHZhbHVlOiBjdXN0b21Qcm9taXNlRXhlY0Z1bmN0aW9uKGV4ZWMpLFxufSk7XG5cbmludGVyZmFjZSBFeGVjRmlsZU9wdGlvbnMgZXh0ZW5kcyBDaGlsZFByb2Nlc3NPcHRpb25zIHtcbiAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIHRpbWVvdXQ/OiBudW1iZXI7XG4gIG1heEJ1ZmZlcj86IG51bWJlcjtcbiAga2lsbFNpZ25hbD86IHN0cmluZyB8IG51bWJlcjtcbn1cbmludGVyZmFjZSBDaGlsZFByb2Nlc3NFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29kZT86IHN0cmluZyB8IG51bWJlcjtcbiAga2lsbGVkPzogYm9vbGVhbjtcbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG4gIGNtZD86IHN0cmluZztcbn1cbmNsYXNzIEV4ZWNGaWxlRXJyb3IgZXh0ZW5kcyBFcnJvciBpbXBsZW1lbnRzIENoaWxkUHJvY2Vzc0Vycm9yIHtcbiAgY29kZT86IHN0cmluZyB8IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLmNvZGUgPSBcIlVOS05PV05cIjtcbiAgfVxufVxudHlwZSBFeGVjRmlsZUNhbGxiYWNrID0gKFxuICBlcnJvcjogQ2hpbGRQcm9jZXNzRXJyb3IgfCBudWxsLFxuICBzdGRvdXQ/OiBzdHJpbmcgfCBCdWZmZXIsXG4gIHN0ZGVycj86IHN0cmluZyB8IEJ1ZmZlcixcbikgPT4gdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZShmaWxlOiBzdHJpbmcpOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlY0ZpbGUoXG4gIGZpbGU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IEV4ZWNGaWxlQ2FsbGJhY2ssXG4pOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlY0ZpbGUoZmlsZTogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IENoaWxkUHJvY2VzcztcbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZShcbiAgZmlsZTogc3RyaW5nLFxuICBhcmdzOiBzdHJpbmdbXSxcbiAgY2FsbGJhY2s6IEV4ZWNGaWxlQ2FsbGJhY2ssXG4pOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlY0ZpbGUoZmlsZTogc3RyaW5nLCBvcHRpb25zOiBFeGVjRmlsZU9wdGlvbnMpOiBDaGlsZFByb2Nlc3M7XG5leHBvcnQgZnVuY3Rpb24gZXhlY0ZpbGUoXG4gIGZpbGU6IHN0cmluZyxcbiAgb3B0aW9uczogRXhlY0ZpbGVPcHRpb25zLFxuICBjYWxsYmFjazogRXhlY0ZpbGVDYWxsYmFjayxcbik6IENoaWxkUHJvY2VzcztcbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZShcbiAgZmlsZTogc3RyaW5nLFxuICBhcmdzOiBzdHJpbmdbXSxcbiAgb3B0aW9uczogRXhlY0ZpbGVPcHRpb25zLFxuICBjYWxsYmFjazogRXhlY0ZpbGVDYWxsYmFjayxcbik6IENoaWxkUHJvY2VzcztcbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZShcbiAgZmlsZTogc3RyaW5nLFxuICBhcmdzT3JPcHRpb25zT3JDYWxsYmFjaz86IHN0cmluZ1tdIHwgRXhlY0ZpbGVPcHRpb25zIHwgRXhlY0ZpbGVDYWxsYmFjayxcbiAgb3B0aW9uc09yQ2FsbGJhY2s/OiBFeGVjRmlsZU9wdGlvbnMgfCBFeGVjRmlsZUNhbGxiYWNrLFxuICBtYXliZUNhbGxiYWNrPzogRXhlY0ZpbGVDYWxsYmFjayxcbik6IENoaWxkUHJvY2VzcyB7XG4gIGxldCBhcmdzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgb3B0aW9uczogRXhlY0ZpbGVPcHRpb25zID0ge307XG4gIGxldCBjYWxsYmFjazogRXhlY0ZpbGVDYWxsYmFjayB8IHVuZGVmaW5lZDtcblxuICBpZiAoQXJyYXkuaXNBcnJheShhcmdzT3JPcHRpb25zT3JDYWxsYmFjaykpIHtcbiAgICBhcmdzID0gYXJnc09yT3B0aW9uc09yQ2FsbGJhY2s7XG4gIH0gZWxzZSBpZiAoYXJnc09yT3B0aW9uc09yQ2FsbGJhY2sgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIGNhbGxiYWNrID0gYXJnc09yT3B0aW9uc09yQ2FsbGJhY2s7XG4gIH0gZWxzZSBpZiAoYXJnc09yT3B0aW9uc09yQ2FsbGJhY2spIHtcbiAgICBvcHRpb25zID0gYXJnc09yT3B0aW9uc09yQ2FsbGJhY2s7XG4gIH1cbiAgaWYgKG9wdGlvbnNPckNhbGxiYWNrIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnNPckNhbGxiYWNrO1xuICB9IGVsc2UgaWYgKG9wdGlvbnNPckNhbGxiYWNrKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnNPckNhbGxiYWNrO1xuICAgIGNhbGxiYWNrID0gbWF5YmVDYWxsYmFjaztcbiAgfVxuXG4gIGNvbnN0IGV4ZWNPcHRpb25zID0ge1xuICAgIGVuY29kaW5nOiBcInV0ZjhcIixcbiAgICB0aW1lb3V0OiAwLFxuICAgIG1heEJ1ZmZlcjogTUFYX0JVRkZFUixcbiAgICBraWxsU2lnbmFsOiBcIlNJR1RFUk1cIixcbiAgICBzaGVsbDogZmFsc2UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcbiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKGV4ZWNPcHRpb25zLnRpbWVvdXQpIHx8IGV4ZWNPcHRpb25zLnRpbWVvdXQgPCAwKSB7XG4gICAgLy8gSW4gTm9kZSBzb3VyY2UsIHRoZSBmaXJzdCBhcmd1bWVudCB0byBlcnJvciBjb25zdHJ1Y3RvciBpcyBcInRpbWVvdXRcIiBpbnN0ZWFkIG9mIFwib3B0aW9ucy50aW1lb3V0XCIuXG4gICAgLy8gdGltZW91dCBpcyBpbmRlZWQgYSBtZW1iZXIgb2Ygb3B0aW9ucyBvYmplY3QuXG4gICAgdGhyb3cgbmV3IEVSUl9PVVRfT0ZfUkFOR0UoXG4gICAgICBcInRpbWVvdXRcIixcbiAgICAgIFwiYW4gdW5zaWduZWQgaW50ZWdlclwiLFxuICAgICAgZXhlY09wdGlvbnMudGltZW91dCxcbiAgICApO1xuICB9XG4gIGlmIChleGVjT3B0aW9ucy5tYXhCdWZmZXIgPCAwKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9PVVRfT0ZfUkFOR0UoXG4gICAgICBcIm9wdGlvbnMubWF4QnVmZmVyXCIsXG4gICAgICBcImEgcG9zaXRpdmUgbnVtYmVyXCIsXG4gICAgICBleGVjT3B0aW9ucy5tYXhCdWZmZXIsXG4gICAgKTtcbiAgfVxuICBjb25zdCBzcGF3bk9wdGlvbnM6IFNwYXduT3B0aW9ucyA9IHtcbiAgICBjd2Q6IGV4ZWNPcHRpb25zLmN3ZCxcbiAgICBlbnY6IGV4ZWNPcHRpb25zLmVudixcbiAgICBnaWQ6IGV4ZWNPcHRpb25zLmdpZCxcbiAgICBzaGVsbDogZXhlY09wdGlvbnMuc2hlbGwsXG4gICAgc2lnbmFsOiBleGVjT3B0aW9ucy5zaWduYWwsXG4gICAgdWlkOiBleGVjT3B0aW9ucy51aWQsXG4gICAgd2luZG93c0hpZGU6ICEhZXhlY09wdGlvbnMud2luZG93c0hpZGUsXG4gICAgd2luZG93c1ZlcmJhdGltQXJndW1lbnRzOiAhIWV4ZWNPcHRpb25zLndpbmRvd3NWZXJiYXRpbUFyZ3VtZW50cyxcbiAgfTtcblxuICBjb25zdCBjaGlsZCA9IHNwYXduKGZpbGUsIGFyZ3MsIHNwYXduT3B0aW9ucyk7XG5cbiAgbGV0IGVuY29kaW5nOiBzdHJpbmcgfCBudWxsO1xuICBjb25zdCBfc3Rkb3V0OiAoc3RyaW5nIHwgVWludDhBcnJheSlbXSA9IFtdO1xuICBjb25zdCBfc3RkZXJyOiAoc3RyaW5nIHwgVWludDhBcnJheSlbXSA9IFtdO1xuICBpZiAoXG4gICAgZXhlY09wdGlvbnMuZW5jb2RpbmcgIT09IFwiYnVmZmVyXCIgJiYgQnVmZmVyLmlzRW5jb2RpbmcoZXhlY09wdGlvbnMuZW5jb2RpbmcpXG4gICkge1xuICAgIGVuY29kaW5nID0gZXhlY09wdGlvbnMuZW5jb2Rpbmc7XG4gIH0gZWxzZSB7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG4gIGxldCBzdGRvdXRMZW4gPSAwO1xuICBsZXQgc3RkZXJyTGVuID0gMDtcbiAgbGV0IGtpbGxlZCA9IGZhbHNlO1xuICBsZXQgZXhpdGVkID0gZmFsc2U7XG4gIGxldCB0aW1lb3V0SWQ6IG51bWJlciB8IG51bGw7XG5cbiAgbGV0IGV4OiBDaGlsZFByb2Nlc3NFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGxldCBjbWQgPSBmaWxlO1xuXG4gIGZ1bmN0aW9uIGV4aXRoYW5kbGVyKGNvZGUgPSAwLCBzaWduYWw/OiBBYm9ydFNpZ25hbCkge1xuICAgIGlmIChleGl0ZWQpIHJldHVybjtcbiAgICBleGl0ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghY2FsbGJhY2spIHJldHVybjtcblxuICAgIC8vIG1lcmdlIGNodW5rc1xuICAgIGxldCBzdGRvdXQ7XG4gICAgbGV0IHN0ZGVycjtcbiAgICBpZiAoXG4gICAgICBlbmNvZGluZyB8fFxuICAgICAgKFxuICAgICAgICBjaGlsZC5zdGRvdXQgJiZcbiAgICAgICAgY2hpbGQuc3Rkb3V0LnJlYWRhYmxlRW5jb2RpbmdcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHN0ZG91dCA9IF9zdGRvdXQuam9pbihcIlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3Rkb3V0ID0gQnVmZmVyLmNvbmNhdChfc3Rkb3V0IGFzIEJ1ZmZlcltdKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgZW5jb2RpbmcgfHxcbiAgICAgIChcbiAgICAgICAgY2hpbGQuc3RkZXJyICYmXG4gICAgICAgIGNoaWxkLnN0ZGVyci5yZWFkYWJsZUVuY29kaW5nXG4gICAgICApXG4gICAgKSB7XG4gICAgICBzdGRlcnIgPSBfc3RkZXJyLmpvaW4oXCJcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ZGVyciA9IEJ1ZmZlci5jb25jYXQoX3N0ZGVyciBhcyBCdWZmZXJbXSk7XG4gICAgfVxuXG4gICAgaWYgKCFleCAmJiBjb2RlID09PSAwICYmIHNpZ25hbCA9PT0gbnVsbCkge1xuICAgICAgY2FsbGJhY2sobnVsbCwgc3Rkb3V0LCBzdGRlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChhcmdzPy5sZW5ndGgpIHtcbiAgICAgIGNtZCArPSBgICR7YXJncy5qb2luKFwiIFwiKX1gO1xuICAgIH1cblxuICAgIGlmICghZXgpIHtcbiAgICAgIGV4ID0gbmV3IEV4ZWNGaWxlRXJyb3IoXG4gICAgICAgIFwiQ29tbWFuZCBmYWlsZWQ6IFwiICsgY21kICsgXCJcXG5cIiArIHN0ZGVycixcbiAgICAgICk7XG4gICAgICBleC5jb2RlID0gY29kZSA8IDAgPyBnZXRTeXN0ZW1FcnJvck5hbWUoY29kZSkgOiBjb2RlO1xuICAgICAgZXgua2lsbGVkID0gY2hpbGQua2lsbGVkIHx8IGtpbGxlZDtcbiAgICAgIGV4LnNpZ25hbCA9IHNpZ25hbDtcbiAgICB9XG5cbiAgICBleC5jbWQgPSBjbWQ7XG4gICAgY2FsbGJhY2soZXgsIHN0ZG91dCwgc3RkZXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVycm9yaGFuZGxlcihlOiBFeGVjRmlsZUVycm9yKSB7XG4gICAgZXggPSBlO1xuXG4gICAgaWYgKGNoaWxkLnN0ZG91dCkge1xuICAgICAgY2hpbGQuc3Rkb3V0LmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBpZiAoY2hpbGQuc3RkZXJyKSB7XG4gICAgICBjaGlsZC5zdGRlcnIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGV4aXRoYW5kbGVyKCk7XG4gIH1cblxuICBmdW5jdGlvbiBraWxsKCkge1xuICAgIGlmIChjaGlsZC5zdGRvdXQpIHtcbiAgICAgIGNoaWxkLnN0ZG91dC5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaWYgKGNoaWxkLnN0ZGVycikge1xuICAgICAgY2hpbGQuc3RkZXJyLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBraWxsZWQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBjaGlsZC5raWxsKGV4ZWNPcHRpb25zLmtpbGxTaWduYWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIGV4ID0gZSBhcyBDaGlsZFByb2Nlc3NFcnJvcjtcbiAgICAgIH1cbiAgICAgIGV4aXRoYW5kbGVyKCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGV4ZWNPcHRpb25zLnRpbWVvdXQgPiAwKSB7XG4gICAgdGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBkZWxheWVkS2lsbCgpIHtcbiAgICAgIGtpbGwoKTtcbiAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgfSwgZXhlY09wdGlvbnMudGltZW91dCk7XG4gIH1cblxuICBpZiAoY2hpbGQuc3Rkb3V0KSB7XG4gICAgaWYgKGVuY29kaW5nKSB7XG4gICAgICBjaGlsZC5zdGRvdXQuc2V0RW5jb2RpbmcoZW5jb2RpbmcpO1xuICAgIH1cblxuICAgIGNoaWxkLnN0ZG91dC5vbihcImRhdGFcIiwgZnVuY3Rpb24gb25DaGlsZFN0ZG91dChjaHVuazogc3RyaW5nIHwgQnVmZmVyKSB7XG4gICAgICAvLyBEbyBub3QgbmVlZCB0byBjb3VudCB0aGUgbGVuZ3RoXG4gICAgICBpZiAoZXhlY09wdGlvbnMubWF4QnVmZmVyID09PSBJbmZpbml0eSkge1xuICAgICAgICBBcnJheVByb3RvdHlwZVB1c2goX3N0ZG91dCwgY2h1bmspO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVuY29kaW5nID0gY2hpbGQuc3Rkb3V0Py5yZWFkYWJsZUVuY29kaW5nO1xuICAgICAgY29uc3QgbGVuZ3RoID0gZW5jb2RpbmdcbiAgICAgICAgPyBCdWZmZXIuYnl0ZUxlbmd0aChjaHVuaywgZW5jb2RpbmcpXG4gICAgICAgIDogY2h1bmsubGVuZ3RoO1xuICAgICAgY29uc3Qgc2xpY2UgPSBlbmNvZGluZ1xuICAgICAgICA/IFN0cmluZ1Byb3RvdHlwZVNsaWNlXG4gICAgICAgIDogKGJ1Zjogc3RyaW5nIHwgQnVmZmVyLCAuLi5hcmdzOiBudW1iZXJbXSkgPT4gYnVmLnNsaWNlKC4uLmFyZ3MpO1xuICAgICAgc3Rkb3V0TGVuICs9IGxlbmd0aDtcblxuICAgICAgaWYgKHN0ZG91dExlbiA+IGV4ZWNPcHRpb25zLm1heEJ1ZmZlcikge1xuICAgICAgICBjb25zdCB0cnVuY2F0ZWRMZW4gPSBleGVjT3B0aW9ucy5tYXhCdWZmZXIgLSAoc3Rkb3V0TGVuIC0gbGVuZ3RoKTtcbiAgICAgICAgQXJyYXlQcm90b3R5cGVQdXNoKF9zdGRvdXQsIHNsaWNlKGNodW5rLCAwLCB0cnVuY2F0ZWRMZW4pKTtcblxuICAgICAgICBleCA9IG5ldyBFUlJfQ0hJTERfUFJPQ0VTU19TVERJT19NQVhCVUZGRVIoXCJzdGRvdXRcIik7XG4gICAgICAgIGtpbGwoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIEFycmF5UHJvdG90eXBlUHVzaChfc3Rkb3V0LCBjaHVuayk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAoY2hpbGQuc3RkZXJyKSB7XG4gICAgaWYgKGVuY29kaW5nKSB7XG4gICAgICBjaGlsZC5zdGRlcnIuc2V0RW5jb2RpbmcoZW5jb2RpbmcpO1xuICAgIH1cblxuICAgIGNoaWxkLnN0ZGVyci5vbihcImRhdGFcIiwgZnVuY3Rpb24gb25DaGlsZFN0ZGVycihjaHVuazogc3RyaW5nIHwgQnVmZmVyKSB7XG4gICAgICAvLyBEbyBub3QgbmVlZCB0byBjb3VudCB0aGUgbGVuZ3RoXG4gICAgICBpZiAoZXhlY09wdGlvbnMubWF4QnVmZmVyID09PSBJbmZpbml0eSkge1xuICAgICAgICBBcnJheVByb3RvdHlwZVB1c2goX3N0ZGVyciwgY2h1bmspO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVuY29kaW5nID0gY2hpbGQuc3RkZXJyPy5yZWFkYWJsZUVuY29kaW5nO1xuICAgICAgY29uc3QgbGVuZ3RoID0gZW5jb2RpbmdcbiAgICAgICAgPyBCdWZmZXIuYnl0ZUxlbmd0aChjaHVuaywgZW5jb2RpbmcpXG4gICAgICAgIDogY2h1bmsubGVuZ3RoO1xuICAgICAgY29uc3Qgc2xpY2UgPSBlbmNvZGluZ1xuICAgICAgICA/IFN0cmluZ1Byb3RvdHlwZVNsaWNlXG4gICAgICAgIDogKGJ1Zjogc3RyaW5nIHwgQnVmZmVyLCAuLi5hcmdzOiBudW1iZXJbXSkgPT4gYnVmLnNsaWNlKC4uLmFyZ3MpO1xuICAgICAgc3RkZXJyTGVuICs9IGxlbmd0aDtcblxuICAgICAgaWYgKHN0ZGVyckxlbiA+IGV4ZWNPcHRpb25zLm1heEJ1ZmZlcikge1xuICAgICAgICBjb25zdCB0cnVuY2F0ZWRMZW4gPSBleGVjT3B0aW9ucy5tYXhCdWZmZXIgLSAoc3RkZXJyTGVuIC0gbGVuZ3RoKTtcbiAgICAgICAgQXJyYXlQcm90b3R5cGVQdXNoKF9zdGRlcnIsIHNsaWNlKGNodW5rLCAwLCB0cnVuY2F0ZWRMZW4pKTtcblxuICAgICAgICBleCA9IG5ldyBFUlJfQ0hJTERfUFJPQ0VTU19TVERJT19NQVhCVUZGRVIoXCJzdGRlcnJcIik7XG4gICAgICAgIGtpbGwoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIEFycmF5UHJvdG90eXBlUHVzaChfc3RkZXJyLCBjaHVuayk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBjaGlsZC5hZGRMaXN0ZW5lcihcImNsb3NlXCIsIGV4aXRoYW5kbGVyKTtcbiAgY2hpbGQuYWRkTGlzdGVuZXIoXCJlcnJvclwiLCBlcnJvcmhhbmRsZXIpO1xuXG4gIHJldHVybiBjaGlsZDtcbn1cblxuZnVuY3Rpb24gY2hlY2tFeGVjU3luY0Vycm9yKFxuICByZXQ6IFNwYXduU3luY1Jlc3VsdCxcbiAgYXJnczogc3RyaW5nW10sXG4gIGNtZD86IHN0cmluZyxcbikge1xuICBsZXQgZXJyO1xuICBpZiAocmV0LmVycm9yKSB7XG4gICAgZXJyID0gcmV0LmVycm9yO1xuICAgIE9iamVjdEFzc2lnbihlcnIsIHJldCk7XG4gIH0gZWxzZSBpZiAocmV0LnN0YXR1cyAhPT0gMCkge1xuICAgIGxldCBtc2cgPSBcIkNvbW1hbmQgZmFpbGVkOiBcIjtcbiAgICBtc2cgKz0gY21kIHx8IEFycmF5UHJvdG90eXBlSm9pbihhcmdzLCBcIiBcIik7XG4gICAgaWYgKHJldC5zdGRlcnIgJiYgcmV0LnN0ZGVyci5sZW5ndGggPiAwKSB7XG4gICAgICBtc2cgKz0gYFxcbiR7cmV0LnN0ZGVyci50b1N0cmluZygpfWA7XG4gICAgfVxuICAgIGVyciA9IGdlbmVyaWNOb2RlRXJyb3IobXNnLCByZXQpO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleGVjU3luYyhjb21tYW5kOiBzdHJpbmcsIG9wdGlvbnM6IEV4ZWNTeW5jT3B0aW9ucykge1xuICBjb25zdCBvcHRzID0gbm9ybWFsaXplRXhlY0FyZ3MoY29tbWFuZCwgb3B0aW9ucyk7XG4gIGNvbnN0IGluaGVyaXRTdGRlcnIgPSAhKG9wdHMub3B0aW9ucyBhcyBFeGVjU3luY09wdGlvbnMpLnN0ZGlvO1xuXG4gIGNvbnN0IHJldCA9IHNwYXduU3luYyhvcHRzLmZpbGUsIG9wdHMub3B0aW9ucyBhcyBTcGF3blN5bmNPcHRpb25zKTtcblxuICBpZiAoaW5oZXJpdFN0ZGVyciAmJiByZXQuc3RkZXJyKSB7XG4gICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUocmV0LnN0ZGVycik7XG4gIH1cblxuICBjb25zdCBlcnIgPSBjaGVja0V4ZWNTeW5jRXJyb3IocmV0LCBbXSwgY29tbWFuZCk7XG5cbiAgaWYgKGVycikge1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHJldHVybiByZXQuc3Rkb3V0O1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVFeGVjRmlsZUFyZ3MoXG4gIGZpbGU6IHN0cmluZyxcbiAgYXJncz86IHN0cmluZ1tdIHwgbnVsbCB8IEV4ZWNGaWxlU3luY09wdGlvbnMgfCBFeGVjRmlsZUNhbGxiYWNrLFxuICBvcHRpb25zPzogRXhlY0ZpbGVTeW5jT3B0aW9ucyB8IG51bGwgfCBFeGVjRmlsZUNhbGxiYWNrLFxuICBjYWxsYmFjaz86IEV4ZWNGaWxlQ2FsbGJhY2ssXG4pOiB7XG4gIGZpbGU6IHN0cmluZztcbiAgYXJnczogc3RyaW5nW107XG4gIG9wdGlvbnM6IEV4ZWNGaWxlU3luY09wdGlvbnM7XG4gIGNhbGxiYWNrPzogRXhlY0ZpbGVDYWxsYmFjaztcbn0ge1xuICBpZiAoQXJyYXlJc0FycmF5KGFyZ3MpKSB7XG4gICAgYXJncyA9IEFycmF5UHJvdG90eXBlU2xpY2UoYXJncyk7XG4gIH0gZWxzZSBpZiAoYXJncyAhPSBudWxsICYmIHR5cGVvZiBhcmdzID09PSBcIm9iamVjdFwiKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zIGFzIEV4ZWNGaWxlQ2FsbGJhY2s7XG4gICAgb3B0aW9ucyA9IGFyZ3MgYXMgRXhlY0ZpbGVTeW5jT3B0aW9ucztcbiAgICBhcmdzID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgYXJncyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbGJhY2sgPSBhcmdzO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIGFyZ3MgPSBudWxsO1xuICB9XG5cbiAgaWYgKGFyZ3MgPT0gbnVsbCkge1xuICAgIGFyZ3MgPSBbXTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zIGFzIEV4ZWNGaWxlQ2FsbGJhY2s7XG4gIH0gZWxzZSBpZiAob3B0aW9ucyAhPSBudWxsKSB7XG4gICAgdmFsaWRhdGVPYmplY3Qob3B0aW9ucywgXCJvcHRpb25zXCIpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMgPT0gbnVsbCkge1xuICAgIG9wdGlvbnMgPSBrRW1wdHlPYmplY3Q7XG4gIH1cblxuICBhcmdzID0gYXJncyBhcyBzdHJpbmdbXTtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgYXMgRXhlY0ZpbGVTeW5jT3B0aW9ucztcblxuICBpZiAoY2FsbGJhY2sgIT0gbnVsbCkge1xuICAgIHZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBhcmd2MCwgaWYgcHJlc2VudC5cbiAgaWYgKG9wdGlvbnMuYXJndjAgIT0gbnVsbCkge1xuICAgIHZhbGlkYXRlU3RyaW5nKG9wdGlvbnMuYXJndjAsIFwib3B0aW9ucy5hcmd2MFwiKTtcbiAgfVxuXG4gIHJldHVybiB7IGZpbGUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZVN5bmMoZmlsZTogc3RyaW5nKTogc3RyaW5nIHwgQnVmZmVyO1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWNGaWxlU3luYyhmaWxlOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHwgQnVmZmVyO1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWNGaWxlU3luYyhcbiAgZmlsZTogc3RyaW5nLFxuICBvcHRpb25zOiBFeGVjRmlsZVN5bmNPcHRpb25zLFxuKTogc3RyaW5nIHwgQnVmZmVyO1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWNGaWxlU3luYyhcbiAgZmlsZTogc3RyaW5nLFxuICBhcmdzOiBzdHJpbmdbXSxcbiAgb3B0aW9uczogRXhlY0ZpbGVTeW5jT3B0aW9ucyxcbik6IHN0cmluZyB8IEJ1ZmZlcjtcbmV4cG9ydCBmdW5jdGlvbiBleGVjRmlsZVN5bmMoXG4gIGZpbGU6IHN0cmluZyxcbiAgYXJncz86IHN0cmluZ1tdIHwgRXhlY0ZpbGVTeW5jT3B0aW9ucyxcbiAgb3B0aW9ucz86IEV4ZWNGaWxlU3luY09wdGlvbnMsXG4pOiBzdHJpbmcgfCBCdWZmZXIge1xuICAoeyBmaWxlLCBhcmdzLCBvcHRpb25zIH0gPSBub3JtYWxpemVFeGVjRmlsZUFyZ3MoZmlsZSwgYXJncywgb3B0aW9ucykpO1xuXG4gIGNvbnN0IGluaGVyaXRTdGRlcnIgPSAhb3B0aW9ucy5zdGRpbztcbiAgY29uc3QgcmV0ID0gc3Bhd25TeW5jKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xuXG4gIGlmIChpbmhlcml0U3RkZXJyICYmIHJldC5zdGRlcnIpIHtcbiAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShyZXQuc3RkZXJyKTtcbiAgfVxuXG4gIGNvbnN0IGVyckFyZ3M6IHN0cmluZ1tdID0gW29wdGlvbnMuYXJndjAgfHwgZmlsZSwgLi4uKGFyZ3MgYXMgc3RyaW5nW10pXTtcbiAgY29uc3QgZXJyID0gY2hlY2tFeGVjU3luY0Vycm9yKHJldCwgZXJyQXJncyk7XG5cbiAgaWYgKGVycikge1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHJldHVybiByZXQuc3Rkb3V0IGFzIHN0cmluZyB8IEJ1ZmZlcjtcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBmb3JrLFxuICBzcGF3bixcbiAgZXhlYyxcbiAgZXhlY0ZpbGUsXG4gIGV4ZWNGaWxlU3luYyxcbiAgZXhlY1N5bmMsXG4gIENoaWxkUHJvY2VzcyxcbiAgc3Bhd25TeW5jLFxufTtcbmV4cG9ydCB7IENoaWxkUHJvY2VzcyB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxnRUFBZ0U7QUFDaEUsaURBQWlEO0FBQ2pELFNBQ0UsWUFBWSxFQUVaLHVCQUF1QixFQUN2QixhQUFhLFVBQVUsRUFHdkIsa0JBQWtCLFFBQ2IsOEJBQThCO0FBQ3JDLFNBQ0UsbUJBQW1CLEVBQ25CLGdCQUFnQixFQUNoQixjQUFjLEVBQ2QsY0FBYyxRQUNULDRCQUE0QjtBQUNuQyxTQUNFLDhCQUE4QixFQUM5QixpQ0FBaUMsRUFDakMsb0JBQW9CLEVBQ3BCLHFCQUFxQixFQUNyQixnQkFBZ0IsRUFDaEIsZ0JB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