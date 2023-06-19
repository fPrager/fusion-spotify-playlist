// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module implements 'child_process' module of Node.JS API.
// ref: https://nodejs.org/api/child_process.html
import { assert } from "../../_util/asserts.ts";
import { EventEmitter } from "../events.ts";
import { os } from "../internal_binding/constants.ts";
import { notImplemented, warnNotImplemented } from "../_utils.ts";
import { Readable, Stream, Writable } from "../stream.ts";
import { deferred } from "../../async/deferred.ts";
import { isWindows } from "../../_util/os.ts";
import { nextTick } from "../_next_tick.ts";
import { AbortError, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_UNKNOWN_SIGNAL } from "./errors.ts";
import { mapValues } from "../../collections/map_values.ts";
import { Buffer } from "../buffer.ts";
import { errnoException } from "./errors.ts";
import { codeMap } from "../internal_binding/uv.ts";
import { isInt32, validateBoolean, validateObject, validateString } from "./validators.mjs";
import { ArrayIsArray, ArrayPrototypeFilter, ArrayPrototypeJoin, ArrayPrototypePush, ArrayPrototypeSlice, ArrayPrototypeSort, ArrayPrototypeUnshift, ObjectPrototypeHasOwnProperty, StringPrototypeToUpperCase } from "./primordials.mjs";
import { kEmptyObject } from "./util.mjs";
import { getValidatedPath } from "./fs/utils.mjs";
import process from "../process.ts";
// @ts-ignore Deno[Deno.internal] is used on purpose here
const DenoCommand = Deno[Deno.internal]?.nodeUnstable?.Command || Deno.Command;
export function stdioStringToArray(stdio, channel) {
    const options = [];
    switch(stdio){
        case "ignore":
        case "overlapped":
        case "pipe":
            options.push(stdio, stdio, stdio);
            break;
        case "inherit":
            options.push(stdio, stdio, stdio);
            break;
        default:
            throw new ERR_INVALID_ARG_VALUE("stdio", stdio);
    }
    if (channel) options.push(channel);
    return options;
}
export class ChildProcess extends EventEmitter {
    /**
   * The exit code of the child process. This property will be `null` until the child process exits.
   */ exitCode = null;
    /**
   * This property is set to `true` after `kill()` is called.
   */ killed = false;
    /**
   * The PID of this child process.
   */ pid;
    /**
   * The signal received by this child process.
   */ signalCode = null;
    /**
   * Command line arguments given to this child process.
   */ spawnargs;
    /**
   * The executable file name of this child process.
   */ spawnfile;
    /**
   * This property represents the child process's stdin.
   */ stdin = null;
    /**
   * This property represents the child process's stdout.
   */ stdout = null;
    /**
   * This property represents the child process's stderr.
   */ stderr = null;
    /**
   * Pipes to this child process.
   */ stdio = [
        null,
        null,
        null
    ];
    #process;
    #spawned = deferred();
    constructor(command, args, options){
        super();
        const { env ={} , stdio =[
            "pipe",
            "pipe",
            "pipe"
        ] , cwd , shell =false , signal , windowsVerbatimArguments =false  } = options || {};
        const [stdin = "pipe", stdout = "pipe", stderr = "pipe", _channel] = normalizeStdioOption(stdio);
        const [cmd, cmdArgs] = buildCommand(command, args || [], shell);
        this.spawnfile = cmd;
        this.spawnargs = [
            cmd,
            ...cmdArgs
        ];
        const stringEnv = mapValues(env, (value)=>value.toString());
        try {
            this.#process = new DenoCommand(cmd, {
                args: cmdArgs,
                cwd,
                env: stringEnv,
                stdin: toDenoStdio(stdin),
                stdout: toDenoStdio(stdout),
                stderr: toDenoStdio(stderr),
                windowsRawArguments: windowsVerbatimArguments
            }).spawn();
            this.pid = this.#process.pid;
            if (stdin === "pipe") {
                assert(this.#process.stdin);
                this.stdin = Writable.fromWeb(this.#process.stdin);
            }
            if (stdout === "pipe") {
                assert(this.#process.stdout);
                this.stdout = Readable.fromWeb(this.#process.stdout);
            }
            if (stderr === "pipe") {
                assert(this.#process.stderr);
                this.stderr = Readable.fromWeb(this.#process.stderr);
            }
            this.stdio[0] = this.stdin;
            this.stdio[1] = this.stdout;
            this.stdio[2] = this.stderr;
            nextTick(()=>{
                this.emit("spawn");
                this.#spawned.resolve();
            });
            if (signal) {
                const onAbortListener = ()=>{
                    try {
                        if (this.kill("SIGKILL")) {
                            this.emit("error", new AbortError());
                        }
                    } catch (err) {
                        this.emit("error", err);
                    }
                };
                if (signal.aborted) {
                    nextTick(onAbortListener);
                } else {
                    signal.addEventListener("abort", onAbortListener, {
                        once: true
                    });
                    this.addListener("exit", ()=>signal.removeEventListener("abort", onAbortListener));
                }
            }
            (async ()=>{
                const status = await this.#process.status;
                this.exitCode = status.code;
                this.#spawned.then(async ()=>{
                    const exitCode = this.signalCode == null ? this.exitCode : null;
                    const signalCode = this.signalCode == null ? null : this.signalCode;
                    // The 'exit' and 'close' events must be emitted after the 'spawn' event.
                    this.emit("exit", exitCode, signalCode);
                    await this.#_waitForChildStreamsToClose();
                    this.#closePipes();
                    this.emit("close", exitCode, signalCode);
                });
            })();
        } catch (err) {
            this.#_handleError(err);
        }
    }
    /**
   * @param signal NOTE: this parameter is not yet implemented.
   */ kill(signal) {
        if (this.killed) {
            return this.killed;
        }
        const denoSignal = signal == null ? "SIGTERM" : toDenoSignal(signal);
        this.#closePipes();
        try {
            this.#process.kill(denoSignal);
        } catch (err) {
            const alreadyClosed = err instanceof TypeError || err instanceof Deno.errors.PermissionDenied;
            if (!alreadyClosed) {
                throw err;
            }
        }
        this.killed = true;
        this.signalCode = denoSignal;
        return this.killed;
    }
    ref() {
        this.#process.ref();
    }
    unref() {
        this.#process.unref();
    }
    disconnect() {
        warnNotImplemented("ChildProcess.prototype.disconnect");
    }
    async #_waitForChildStreamsToClose() {
        const promises = [];
        if (this.stdin && !this.stdin.destroyed) {
            assert(this.stdin);
            this.stdin.destroy();
            promises.push(waitForStreamToClose(this.stdin));
        }
        if (this.stdout && !this.stdout.destroyed) {
            promises.push(waitForReadableToClose(this.stdout));
        }
        if (this.stderr && !this.stderr.destroyed) {
            promises.push(waitForReadableToClose(this.stderr));
        }
        await Promise.all(promises);
    }
    #_handleError(err) {
        nextTick(()=>{
            this.emit("error", err); // TODO(uki00a) Convert `err` into nodejs's `SystemError` class.
        });
    }
    #closePipes() {
        if (this.stdin) {
            assert(this.stdin);
            this.stdin.destroy();
        }
    }
}
const supportedNodeStdioTypes = [
    "pipe",
    "ignore",
    "inherit"
];
function toDenoStdio(pipe) {
    if (!supportedNodeStdioTypes.includes(pipe) || typeof pipe === "number" || pipe instanceof Stream) {
        notImplemented(`toDenoStdio pipe=${typeof pipe} (${pipe})`);
    }
    switch(pipe){
        case "pipe":
        case undefined:
        case null:
            return "piped";
        case "ignore":
            return "null";
        case "inherit":
            return "inherit";
        default:
            notImplemented(`toDenoStdio pipe=${typeof pipe} (${pipe})`);
    }
}
function toDenoSignal(signal) {
    if (typeof signal === "number") {
        for (const name of keys(os.signals)){
            if (os.signals[name] === signal) {
                return name;
            }
        }
        throw new ERR_UNKNOWN_SIGNAL(String(signal));
    }
    const denoSignal = signal;
    if (denoSignal in os.signals) {
        return denoSignal;
    }
    throw new ERR_UNKNOWN_SIGNAL(signal);
}
function keys(object) {
    return Object.keys(object);
}
function copyProcessEnvToEnv(env, name, optionEnv) {
    if (Deno.env.get(name) && (!optionEnv || !ObjectPrototypeHasOwnProperty(optionEnv, name))) {
        env[name] = Deno.env.get(name);
    }
}
function normalizeStdioOption(stdio = [
    "pipe",
    "pipe",
    "pipe"
]) {
    if (Array.isArray(stdio)) {
        return stdio;
    } else {
        switch(stdio){
            case "overlapped":
                if (isWindows) {
                    notImplemented("normalizeStdioOption overlapped (on windows)");
                }
                // 'overlapped' is same as 'piped' on non Windows system.
                return [
                    "pipe",
                    "pipe",
                    "pipe"
                ];
            case "pipe":
                return [
                    "pipe",
                    "pipe",
                    "pipe"
                ];
            case "inherit":
                return [
                    "inherit",
                    "inherit",
                    "inherit"
                ];
            case "ignore":
                return [
                    "ignore",
                    "ignore",
                    "ignore"
                ];
            default:
                notImplemented(`normalizeStdioOption stdio=${typeof stdio} (${stdio})`);
        }
    }
}
export function normalizeSpawnArguments(file, args, options) {
    validateString(file, "file");
    if (file.length === 0) {
        throw new ERR_INVALID_ARG_VALUE("file", file, "cannot be empty");
    }
    if (ArrayIsArray(args)) {
        args = ArrayPrototypeSlice(args);
    } else if (args == null) {
        args = [];
    } else if (typeof args !== "object") {
        throw new ERR_INVALID_ARG_TYPE("args", "object", args);
    } else {
        options = args;
        args = [];
    }
    if (options === undefined) {
        options = kEmptyObject;
    } else {
        validateObject(options, "options");
    }
    let cwd = options.cwd;
    // Validate the cwd, if present.
    if (cwd != null) {
        cwd = getValidatedPath(cwd, "options.cwd");
    }
    // Validate detached, if present.
    if (options.detached != null) {
        validateBoolean(options.detached, "options.detached");
    }
    // Validate the uid, if present.
    if (options.uid != null && !isInt32(options.uid)) {
        throw new ERR_INVALID_ARG_TYPE("options.uid", "int32", options.uid);
    }
    // Validate the gid, if present.
    if (options.gid != null && !isInt32(options.gid)) {
        throw new ERR_INVALID_ARG_TYPE("options.gid", "int32", options.gid);
    }
    // Validate the shell, if present.
    if (options.shell != null && typeof options.shell !== "boolean" && typeof options.shell !== "string") {
        throw new ERR_INVALID_ARG_TYPE("options.shell", [
            "boolean",
            "string"
        ], options.shell);
    }
    // Validate argv0, if present.
    if (options.argv0 != null) {
        validateString(options.argv0, "options.argv0");
    }
    // Validate windowsHide, if present.
    if (options.windowsHide != null) {
        validateBoolean(options.windowsHide, "options.windowsHide");
    }
    // Validate windowsVerbatimArguments, if present.
    let { windowsVerbatimArguments  } = options;
    if (windowsVerbatimArguments != null) {
        validateBoolean(windowsVerbatimArguments, "options.windowsVerbatimArguments");
    }
    if (options.shell) {
        const command = ArrayPrototypeJoin([
            file,
            ...args
        ], " ");
        // Set the shell, switches, and commands.
        if (process.platform === "win32") {
            if (typeof options.shell === "string") {
                file = options.shell;
            } else {
                file = Deno.env.get("comspec") || "cmd.exe";
            }
            // '/d /s /c' is used only for cmd.exe.
            if (/^(?:.*\\)?cmd(?:\.exe)?$/i.exec(file) !== null) {
                args = [
                    "/d",
                    "/s",
                    "/c",
                    `"${command}"`
                ];
                windowsVerbatimArguments = true;
            } else {
                args = [
                    "-c",
                    command
                ];
            }
        } else {
            /** TODO: add Android condition */ if (typeof options.shell === "string") {
                file = options.shell;
            } else {
                file = "/bin/sh";
            }
            args = [
                "-c",
                command
            ];
        }
    }
    if (typeof options.argv0 === "string") {
        ArrayPrototypeUnshift(args, options.argv0);
    } else {
        ArrayPrototypeUnshift(args, file);
    }
    const env = options.env || Deno.env.toObject();
    const envPairs = [];
    // process.env.NODE_V8_COVERAGE always propagates, making it possible to
    // collect coverage for programs that spawn with white-listed environment.
    copyProcessEnvToEnv(env, "NODE_V8_COVERAGE", options.env);
    /** TODO: add `isZOS` condition */ let envKeys = [];
    // Prototype values are intentionally included.
    for(const key in env){
        ArrayPrototypePush(envKeys, key);
    }
    if (process.platform === "win32") {
        // On Windows env keys are case insensitive. Filter out duplicates,
        // keeping only the first one (in lexicographic order)
        /** TODO: implement SafeSet and makeSafe */ const sawKey = new Set();
        envKeys = ArrayPrototypeFilter(ArrayPrototypeSort(envKeys), (key)=>{
            const uppercaseKey = StringPrototypeToUpperCase(key);
            if (sawKey.has(uppercaseKey)) {
                return false;
            }
            sawKey.add(uppercaseKey);
            return true;
        });
    }
    for (const key1 of envKeys){
        const value = env[key1];
        if (value !== undefined) {
            ArrayPrototypePush(envPairs, `${key1}=${value}`);
        }
    }
    return {
        // Make a shallow copy so we don't clobber the user's options object.
        ...options,
        args,
        cwd,
        detached: !!options.detached,
        envPairs,
        file,
        windowsHide: !!options.windowsHide,
        windowsVerbatimArguments: !!windowsVerbatimArguments
    };
}
function waitForReadableToClose(readable) {
    readable.resume(); // Ensure buffered data will be consumed.
    return waitForStreamToClose(readable);
}
function waitForStreamToClose(stream) {
    const promise = deferred();
    const cleanup = ()=>{
        stream.removeListener("close", onClose);
        stream.removeListener("error", onError);
    };
    const onClose = ()=>{
        cleanup();
        promise.resolve();
    };
    const onError = (err)=>{
        cleanup();
        promise.reject(err);
    };
    stream.once("close", onClose);
    stream.once("error", onError);
    return promise;
}
/**
 * This function is based on https://github.com/nodejs/node/blob/fc6426ccc4b4cb73076356fb6dbf46a28953af01/lib/child_process.js#L504-L528.
 * Copyright Joyent, Inc. and other Node contributors. All rights reserved. MIT license.
 */ function buildCommand(file, args, shell) {
    if (file === Deno.execPath()) {
        // The user is trying to spawn another Deno process as Node.js.
        args = toDenoArgs(args);
    }
    if (shell) {
        const command = [
            file,
            ...args
        ].join(" ");
        // Set the shell, switches, and commands.
        if (isWindows) {
            if (typeof shell === "string") {
                file = shell;
            } else {
                file = Deno.env.get("comspec") || "cmd.exe";
            }
            // '/d /s /c' is used only for cmd.exe.
            if (/^(?:.*\\)?cmd(?:\.exe)?$/i.test(file)) {
                args = [
                    "/d",
                    "/s",
                    "/c",
                    `"${command}"`
                ];
            } else {
                args = [
                    "-c",
                    command
                ];
            }
        } else {
            if (typeof shell === "string") {
                file = shell;
            } else {
                file = "/bin/sh";
            }
            args = [
                "-c",
                command
            ];
        }
    }
    return [
        file,
        args
    ];
}
function _createSpawnSyncError(status, command, args = []) {
    const error = errnoException(codeMap.get(status), "spawnSync " + command);
    error.path = command;
    error.spawnargs = args;
    return error;
}
function parseSpawnSyncOutputStreams(output, name) {
    // new Deno.Command().outputSync() returns getters for stdout and stderr that throw when set
    // to 'inherit'.
    try {
        return Buffer.from(output[name]);
    } catch  {
        return null;
    }
}
export function spawnSync(command, args, options) {
    const { env =Deno.env.toObject() , stdio =[
        "pipe",
        "pipe",
        "pipe"
    ] , shell =false , cwd , encoding , uid , gid , maxBuffer , windowsVerbatimArguments =false  } = options;
    const normalizedStdio = normalizeStdioOption(stdio);
    [command, args] = buildCommand(command, args ?? [], shell);
    const result = {};
    try {
        const output = new DenoCommand(command, {
            args,
            cwd,
            env,
            stdout: toDenoStdio(normalizedStdio[1]),
            stderr: toDenoStdio(normalizedStdio[2]),
            uid,
            gid,
            windowsRawArguments: windowsVerbatimArguments
        }).outputSync();
        const status = output.signal ? null : 0;
        let stdout = parseSpawnSyncOutputStreams(output, "stdout");
        let stderr = parseSpawnSyncOutputStreams(output, "stderr");
        if (stdout && stdout.length > maxBuffer || stderr && stderr.length > maxBuffer) {
            result.error = _createSpawnSyncError("ENOBUFS", command, args);
        }
        if (encoding && encoding !== "buffer") {
            stdout = stdout && stdout.toString(encoding);
            stderr = stderr && stderr.toString(encoding);
        }
        result.status = status;
        result.signal = output.signal;
        result.stdout = stdout;
        result.stderr = stderr;
        result.output = [
            output.signal,
            stdout,
            stderr
        ];
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            result.error = _createSpawnSyncError("ENOENT", command, args);
        }
    }
    return result;
}
// These are Node.js CLI flags that expect a value. It's necessary to
// understand these flags in order to properly replace flags passed to the
// child process. For example, -e is a Node flag for eval mode if it is part
// of process.execArgv. However, -e could also be an application flag if it is
// part of process.execv instead. We only want to process execArgv flags.
const kLongArgType = 1;
const kShortArgType = 2;
const kLongArg = {
    type: kLongArgType
};
const kShortArg = {
    type: kShortArgType
};
const kNodeFlagsMap = new Map([
    [
        "--build-snapshot",
        kLongArg
    ],
    [
        "-c",
        kShortArg
    ],
    [
        "--check",
        kLongArg
    ],
    [
        "-C",
        kShortArg
    ],
    [
        "--conditions",
        kLongArg
    ],
    [
        "--cpu-prof-dir",
        kLongArg
    ],
    [
        "--cpu-prof-interval",
        kLongArg
    ],
    [
        "--cpu-prof-name",
        kLongArg
    ],
    [
        "--diagnostic-dir",
        kLongArg
    ],
    [
        "--disable-proto",
        kLongArg
    ],
    [
        "--dns-result-order",
        kLongArg
    ],
    [
        "-e",
        kShortArg
    ],
    [
        "--eval",
        kLongArg
    ],
    [
        "--experimental-loader",
        kLongArg
    ],
    [
        "--experimental-policy",
        kLongArg
    ],
    [
        "--experimental-specifier-resolution",
        kLongArg
    ],
    [
        "--heapsnapshot-near-heap-limit",
        kLongArg
    ],
    [
        "--heapsnapshot-signal",
        kLongArg
    ],
    [
        "--heap-prof-dir",
        kLongArg
    ],
    [
        "--heap-prof-interval",
        kLongArg
    ],
    [
        "--heap-prof-name",
        kLongArg
    ],
    [
        "--icu-data-dir",
        kLongArg
    ],
    [
        "--input-type",
        kLongArg
    ],
    [
        "--inspect-publish-uid",
        kLongArg
    ],
    [
        "--max-http-header-size",
        kLongArg
    ],
    [
        "--openssl-config",
        kLongArg
    ],
    [
        "-p",
        kShortArg
    ],
    [
        "--print",
        kLongArg
    ],
    [
        "--policy-integrity",
        kLongArg
    ],
    [
        "--prof-process",
        kLongArg
    ],
    [
        "-r",
        kShortArg
    ],
    [
        "--require",
        kLongArg
    ],
    [
        "--redirect-warnings",
        kLongArg
    ],
    [
        "--report-dir",
        kLongArg
    ],
    [
        "--report-directory",
        kLongArg
    ],
    [
        "--report-filename",
        kLongArg
    ],
    [
        "--report-signal",
        kLongArg
    ],
    [
        "--secure-heap",
        kLongArg
    ],
    [
        "--secure-heap-min",
        kLongArg
    ],
    [
        "--snapshot-blob",
        kLongArg
    ],
    [
        "--title",
        kLongArg
    ],
    [
        "--tls-cipher-list",
        kLongArg
    ],
    [
        "--tls-keylog",
        kLongArg
    ],
    [
        "--unhandled-rejections",
        kLongArg
    ],
    [
        "--use-largepages",
        kLongArg
    ],
    [
        "--v8-pool-size",
        kLongArg
    ]
]);
const kDenoSubcommands = new Set([
    "bench",
    "bundle",
    "cache",
    "check",
    "compile",
    "completions",
    "coverage",
    "doc",
    "eval",
    "fmt",
    "help",
    "info",
    "init",
    "install",
    "lint",
    "lsp",
    "repl",
    "run",
    "tasks",
    "test",
    "types",
    "uninstall",
    "upgrade",
    "vendor"
]);
function toDenoArgs(args) {
    if (args.length === 0) {
        return args;
    }
    // Update this logic as more CLI arguments are mapped from Node to Deno.
    const denoArgs = [];
    let useRunArgs = true;
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (arg.charAt(0) !== "-" || arg === "--") {
            // Not a flag or no more arguments.
            // If the arg is a Deno subcommand, then the child process is being
            // spawned as Deno, not Deno in Node compat mode. In this case, bail out
            // and return the original args.
            if (kDenoSubcommands.has(arg)) {
                return args;
            }
            // Copy of the rest of the arguments to the output.
            for(let j = i; j < args.length; j++){
                denoArgs.push(args[j]);
            }
            break;
        }
        // Something that looks like a flag was passed.
        let flag = arg;
        let flagInfo = kNodeFlagsMap.get(arg);
        let isLongWithValue = false;
        let flagValue;
        if (flagInfo === undefined) {
            // If the flag was not found, it's either not a known flag or it's a long
            // flag containing an '='.
            const splitAt = arg.indexOf("=");
            if (splitAt !== -1) {
                flag = arg.slice(0, splitAt);
                flagInfo = kNodeFlagsMap.get(flag);
                flagValue = arg.slice(splitAt + 1);
                isLongWithValue = true;
            }
        }
        if (flagInfo === undefined) {
            // Not a known flag that expects a value. Just copy it to the output.
            denoArgs.push(arg);
            continue;
        }
        // This is a flag with a value. Get the value if we don't already have it.
        if (flagValue === undefined) {
            i++;
            if (i >= args.length) {
                // There was user error. There should be another arg for the value, but
                // there isn't one. Just copy the arg to the output. It's not going
                // to work anyway.
                denoArgs.push(arg);
                continue;
            }
            flagValue = args[i];
        }
        // Remap Node's eval flags to Deno.
        if (flag === "-e" || flag === "--eval") {
            denoArgs.push("eval", flagValue);
            useRunArgs = false;
        } else if (isLongWithValue) {
            denoArgs.push(arg);
        } else {
            denoArgs.push(flag, flagValue);
        }
    }
    if (useRunArgs) {
        // -A is not ideal, but needed to propagate permissions.
        // --unstable is needed for Node compat.
        denoArgs.unshift("run", "-A", "--unstable");
    }
    return denoArgs;
}
export default {
    ChildProcess,
    stdioStringToArray,
    spawnSync
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY2hpbGRfcHJvY2Vzcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBUaGlzIG1vZHVsZSBpbXBsZW1lbnRzICdjaGlsZF9wcm9jZXNzJyBtb2R1bGUgb2YgTm9kZS5KUyBBUEkuXG4vLyByZWY6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvY2hpbGRfcHJvY2Vzcy5odG1sXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vLi4vX3V0aWwvYXNzZXJ0cy50c1wiO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSBcIi4uL2V2ZW50cy50c1wiO1xuaW1wb3J0IHsgb3MgfSBmcm9tIFwiLi4vaW50ZXJuYWxfYmluZGluZy9jb25zdGFudHMudHNcIjtcbmltcG9ydCB7IG5vdEltcGxlbWVudGVkLCB3YXJuTm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vX3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBSZWFkYWJsZSwgU3RyZWFtLCBXcml0YWJsZSB9IGZyb20gXCIuLi9zdHJlYW0udHNcIjtcbmltcG9ydCB7IGRlZmVycmVkIH0gZnJvbSBcIi4uLy4uL2FzeW5jL2RlZmVycmVkLnRzXCI7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tIFwiLi4vLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCB7IG5leHRUaWNrIH0gZnJvbSBcIi4uL19uZXh0X3RpY2sudHNcIjtcbmltcG9ydCB7XG4gIEFib3J0RXJyb3IsXG4gIEVSUl9JTlZBTElEX0FSR19UWVBFLFxuICBFUlJfSU5WQUxJRF9BUkdfVkFMVUUsXG4gIEVSUl9VTktOT1dOX1NJR05BTCxcbn0gZnJvbSBcIi4vZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBtYXBWYWx1ZXMgfSBmcm9tIFwiLi4vLi4vY29sbGVjdGlvbnMvbWFwX3ZhbHVlcy50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgZXJybm9FeGNlcHRpb24gfSBmcm9tIFwiLi9lcnJvcnMudHNcIjtcbmltcG9ydCB7IEVycm5vRXhjZXB0aW9uIH0gZnJvbSBcIi4uL19nbG9iYWwuZC50c1wiO1xuaW1wb3J0IHsgY29kZU1hcCB9IGZyb20gXCIuLi9pbnRlcm5hbF9iaW5kaW5nL3V2LnRzXCI7XG5pbXBvcnQge1xuICBpc0ludDMyLFxuICB2YWxpZGF0ZUJvb2xlYW4sXG4gIHZhbGlkYXRlT2JqZWN0LFxuICB2YWxpZGF0ZVN0cmluZyxcbn0gZnJvbSBcIi4vdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7XG4gIEFycmF5SXNBcnJheSxcbiAgQXJyYXlQcm90b3R5cGVGaWx0ZXIsXG4gIEFycmF5UHJvdG90eXBlSm9pbixcbiAgQXJyYXlQcm90b3R5cGVQdXNoLFxuICBBcnJheVByb3RvdHlwZVNsaWNlLFxuICBBcnJheVByb3RvdHlwZVNvcnQsXG4gIEFycmF5UHJvdG90eXBlVW5zaGlmdCxcbiAgT2JqZWN0UHJvdG90eXBlSGFzT3duUHJvcGVydHksXG4gIFN0cmluZ1Byb3RvdHlwZVRvVXBwZXJDYXNlLFxufSBmcm9tIFwiLi9wcmltb3JkaWFscy5tanNcIjtcbmltcG9ydCB7IGtFbXB0eU9iamVjdCB9IGZyb20gXCIuL3V0aWwubWpzXCI7XG5pbXBvcnQgeyBnZXRWYWxpZGF0ZWRQYXRoIH0gZnJvbSBcIi4vZnMvdXRpbHMubWpzXCI7XG5pbXBvcnQgcHJvY2VzcyBmcm9tIFwiLi4vcHJvY2Vzcy50c1wiO1xuXG50eXBlIE5vZGVTdGRpbyA9IFwicGlwZVwiIHwgXCJvdmVybGFwcGVkXCIgfCBcImlnbm9yZVwiIHwgXCJpbmhlcml0XCIgfCBcImlwY1wiO1xudHlwZSBEZW5vU3RkaW8gPSBcImluaGVyaXRcIiB8IFwicGlwZWRcIiB8IFwibnVsbFwiO1xuXG4vLyBAdHMtaWdub3JlIERlbm9bRGVuby5pbnRlcm5hbF0gaXMgdXNlZCBvbiBwdXJwb3NlIGhlcmVcbmNvbnN0IERlbm9Db21tYW5kID0gRGVub1tEZW5vLmludGVybmFsXT8ubm9kZVVuc3RhYmxlPy5Db21tYW5kIHx8XG4gIERlbm8uQ29tbWFuZDtcblxuZXhwb3J0IGZ1bmN0aW9uIHN0ZGlvU3RyaW5nVG9BcnJheShcbiAgc3RkaW86IE5vZGVTdGRpbyxcbiAgY2hhbm5lbDogTm9kZVN0ZGlvIHwgbnVtYmVyLFxuKSB7XG4gIGNvbnN0IG9wdGlvbnM6IChOb2RlU3RkaW8gfCBudW1iZXIpW10gPSBbXTtcblxuICBzd2l0Y2ggKHN0ZGlvKSB7XG4gICAgY2FzZSBcImlnbm9yZVwiOlxuICAgIGNhc2UgXCJvdmVybGFwcGVkXCI6XG4gICAgY2FzZSBcInBpcGVcIjpcbiAgICAgIG9wdGlvbnMucHVzaChzdGRpbywgc3RkaW8sIHN0ZGlvKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJpbmhlcml0XCI6XG4gICAgICBvcHRpb25zLnB1c2goc3RkaW8sIHN0ZGlvLCBzdGRpbyk7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19WQUxVRShcInN0ZGlvXCIsIHN0ZGlvKTtcbiAgfVxuXG4gIGlmIChjaGFubmVsKSBvcHRpb25zLnB1c2goY2hhbm5lbCk7XG5cbiAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGlsZFByb2Nlc3MgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogVGhlIGV4aXQgY29kZSBvZiB0aGUgY2hpbGQgcHJvY2Vzcy4gVGhpcyBwcm9wZXJ0eSB3aWxsIGJlIGBudWxsYCB1bnRpbCB0aGUgY2hpbGQgcHJvY2VzcyBleGl0cy5cbiAgICovXG4gIGV4aXRDb2RlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogVGhpcyBwcm9wZXJ0eSBpcyBzZXQgdG8gYHRydWVgIGFmdGVyIGBraWxsKClgIGlzIGNhbGxlZC5cbiAgICovXG4gIGtpbGxlZCA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBUaGUgUElEIG9mIHRoaXMgY2hpbGQgcHJvY2Vzcy5cbiAgICovXG4gIHBpZCE6IG51bWJlcjtcblxuICAvKipcbiAgICogVGhlIHNpZ25hbCByZWNlaXZlZCBieSB0aGlzIGNoaWxkIHByb2Nlc3MuXG4gICAqL1xuICBzaWduYWxDb2RlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogQ29tbWFuZCBsaW5lIGFyZ3VtZW50cyBnaXZlbiB0byB0aGlzIGNoaWxkIHByb2Nlc3MuXG4gICAqL1xuICBzcGF3bmFyZ3M6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBUaGUgZXhlY3V0YWJsZSBmaWxlIG5hbWUgb2YgdGhpcyBjaGlsZCBwcm9jZXNzLlxuICAgKi9cbiAgc3Bhd25maWxlOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoaXMgcHJvcGVydHkgcmVwcmVzZW50cyB0aGUgY2hpbGQgcHJvY2VzcydzIHN0ZGluLlxuICAgKi9cbiAgc3RkaW46IFdyaXRhYmxlIHwgbnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIFRoaXMgcHJvcGVydHkgcmVwcmVzZW50cyB0aGUgY2hpbGQgcHJvY2VzcydzIHN0ZG91dC5cbiAgICovXG4gIHN0ZG91dDogUmVhZGFibGUgfCBudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogVGhpcyBwcm9wZXJ0eSByZXByZXNlbnRzIHRoZSBjaGlsZCBwcm9jZXNzJ3Mgc3RkZXJyLlxuICAgKi9cbiAgc3RkZXJyOiBSZWFkYWJsZSB8IG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBQaXBlcyB0byB0aGlzIGNoaWxkIHByb2Nlc3MuXG4gICAqL1xuICBzdGRpbzogW1dyaXRhYmxlIHwgbnVsbCwgUmVhZGFibGUgfCBudWxsLCBSZWFkYWJsZSB8IG51bGxdID0gW1xuICAgIG51bGwsXG4gICAgbnVsbCxcbiAgICBudWxsLFxuICBdO1xuXG4gICNwcm9jZXNzITogRGVuby5DaGlsZFByb2Nlc3M7XG4gICNzcGF3bmVkID0gZGVmZXJyZWQ8dm9pZD4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJncz86IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBDaGlsZFByb2Nlc3NPcHRpb25zLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgY29uc3Qge1xuICAgICAgZW52ID0ge30sXG4gICAgICBzdGRpbyA9IFtcInBpcGVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgICAgIGN3ZCxcbiAgICAgIHNoZWxsID0gZmFsc2UsXG4gICAgICBzaWduYWwsXG4gICAgICB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMgPSBmYWxzZSxcbiAgICB9ID0gb3B0aW9ucyB8fCB7fTtcbiAgICBjb25zdCBbXG4gICAgICBzdGRpbiA9IFwicGlwZVwiLFxuICAgICAgc3Rkb3V0ID0gXCJwaXBlXCIsXG4gICAgICBzdGRlcnIgPSBcInBpcGVcIixcbiAgICAgIF9jaGFubmVsLCAvLyBUT0RPKGt0M2spOiBoYW5kbGUgdGhpcyBjb3JyZWN0bHlcbiAgICBdID0gbm9ybWFsaXplU3RkaW9PcHRpb24oc3RkaW8pO1xuICAgIGNvbnN0IFtjbWQsIGNtZEFyZ3NdID0gYnVpbGRDb21tYW5kKFxuICAgICAgY29tbWFuZCxcbiAgICAgIGFyZ3MgfHwgW10sXG4gICAgICBzaGVsbCxcbiAgICApO1xuICAgIHRoaXMuc3Bhd25maWxlID0gY21kO1xuICAgIHRoaXMuc3Bhd25hcmdzID0gW2NtZCwgLi4uY21kQXJnc107XG5cbiAgICBjb25zdCBzdHJpbmdFbnYgPSBtYXBWYWx1ZXMoZW52LCAodmFsdWUpID0+IHZhbHVlLnRvU3RyaW5nKCkpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuI3Byb2Nlc3MgPSBuZXcgRGVub0NvbW1hbmQoY21kLCB7XG4gICAgICAgIGFyZ3M6IGNtZEFyZ3MsXG4gICAgICAgIGN3ZCxcbiAgICAgICAgZW52OiBzdHJpbmdFbnYsXG4gICAgICAgIHN0ZGluOiB0b0Rlbm9TdGRpbyhzdGRpbiBhcyBOb2RlU3RkaW8gfCBudW1iZXIpLFxuICAgICAgICBzdGRvdXQ6IHRvRGVub1N0ZGlvKHN0ZG91dCBhcyBOb2RlU3RkaW8gfCBudW1iZXIpLFxuICAgICAgICBzdGRlcnI6IHRvRGVub1N0ZGlvKHN0ZGVyciBhcyBOb2RlU3RkaW8gfCBudW1iZXIpLFxuICAgICAgICB3aW5kb3dzUmF3QXJndW1lbnRzOiB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMsXG4gICAgICB9KS5zcGF3bigpO1xuICAgICAgdGhpcy5waWQgPSB0aGlzLiNwcm9jZXNzLnBpZDtcblxuICAgICAgaWYgKHN0ZGluID09PSBcInBpcGVcIikge1xuICAgICAgICBhc3NlcnQodGhpcy4jcHJvY2Vzcy5zdGRpbik7XG4gICAgICAgIHRoaXMuc3RkaW4gPSBXcml0YWJsZS5mcm9tV2ViKHRoaXMuI3Byb2Nlc3Muc3RkaW4pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3Rkb3V0ID09PSBcInBpcGVcIikge1xuICAgICAgICBhc3NlcnQodGhpcy4jcHJvY2Vzcy5zdGRvdXQpO1xuICAgICAgICB0aGlzLnN0ZG91dCA9IFJlYWRhYmxlLmZyb21XZWIodGhpcy4jcHJvY2Vzcy5zdGRvdXQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RkZXJyID09PSBcInBpcGVcIikge1xuICAgICAgICBhc3NlcnQodGhpcy4jcHJvY2Vzcy5zdGRlcnIpO1xuICAgICAgICB0aGlzLnN0ZGVyciA9IFJlYWRhYmxlLmZyb21XZWIodGhpcy4jcHJvY2Vzcy5zdGRlcnIpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnN0ZGlvWzBdID0gdGhpcy5zdGRpbjtcbiAgICAgIHRoaXMuc3RkaW9bMV0gPSB0aGlzLnN0ZG91dDtcbiAgICAgIHRoaXMuc3RkaW9bMl0gPSB0aGlzLnN0ZGVycjtcblxuICAgICAgbmV4dFRpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLmVtaXQoXCJzcGF3blwiKTtcbiAgICAgICAgdGhpcy4jc3Bhd25lZC5yZXNvbHZlKCk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICBjb25zdCBvbkFib3J0TGlzdGVuZXIgPSAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmtpbGwoXCJTSUdLSUxMXCIpKSB7XG4gICAgICAgICAgICAgIHRoaXMuZW1pdChcImVycm9yXCIsIG5ldyBBYm9ydEVycm9yKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5lbWl0KFwiZXJyb3JcIiwgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGlmIChzaWduYWwuYWJvcnRlZCkge1xuICAgICAgICAgIG5leHRUaWNrKG9uQWJvcnRMaXN0ZW5lcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBvbkFib3J0TGlzdGVuZXIsIHsgb25jZTogdHJ1ZSB9KTtcbiAgICAgICAgICB0aGlzLmFkZExpc3RlbmVyKFxuICAgICAgICAgICAgXCJleGl0XCIsXG4gICAgICAgICAgICAoKSA9PiBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIG9uQWJvcnRMaXN0ZW5lciksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCB0aGlzLiNwcm9jZXNzLnN0YXR1cztcbiAgICAgICAgdGhpcy5leGl0Q29kZSA9IHN0YXR1cy5jb2RlO1xuICAgICAgICB0aGlzLiNzcGF3bmVkLnRoZW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGV4aXRDb2RlID0gdGhpcy5zaWduYWxDb2RlID09IG51bGwgPyB0aGlzLmV4aXRDb2RlIDogbnVsbDtcbiAgICAgICAgICBjb25zdCBzaWduYWxDb2RlID0gdGhpcy5zaWduYWxDb2RlID09IG51bGwgPyBudWxsIDogdGhpcy5zaWduYWxDb2RlO1xuICAgICAgICAgIC8vIFRoZSAnZXhpdCcgYW5kICdjbG9zZScgZXZlbnRzIG11c3QgYmUgZW1pdHRlZCBhZnRlciB0aGUgJ3NwYXduJyBldmVudC5cbiAgICAgICAgICB0aGlzLmVtaXQoXCJleGl0XCIsIGV4aXRDb2RlLCBzaWduYWxDb2RlKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLiNfd2FpdEZvckNoaWxkU3RyZWFtc1RvQ2xvc2UoKTtcbiAgICAgICAgICB0aGlzLiNjbG9zZVBpcGVzKCk7XG4gICAgICAgICAgdGhpcy5lbWl0KFwiY2xvc2VcIiwgZXhpdENvZGUsIHNpZ25hbENvZGUpO1xuICAgICAgICB9KTtcbiAgICAgIH0pKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLiNfaGFuZGxlRXJyb3IoZXJyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHNpZ25hbCBOT1RFOiB0aGlzIHBhcmFtZXRlciBpcyBub3QgeWV0IGltcGxlbWVudGVkLlxuICAgKi9cbiAga2lsbChzaWduYWw/OiBudW1iZXIgfCBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5raWxsZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmtpbGxlZDtcbiAgICB9XG5cbiAgICBjb25zdCBkZW5vU2lnbmFsID0gc2lnbmFsID09IG51bGwgPyBcIlNJR1RFUk1cIiA6IHRvRGVub1NpZ25hbChzaWduYWwpO1xuICAgIHRoaXMuI2Nsb3NlUGlwZXMoKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy4jcHJvY2Vzcy5raWxsKGRlbm9TaWduYWwpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgYWxyZWFkeUNsb3NlZCA9IGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvciB8fFxuICAgICAgICBlcnIgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5QZXJtaXNzaW9uRGVuaWVkO1xuICAgICAgaWYgKCFhbHJlYWR5Q2xvc2VkKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5raWxsZWQgPSB0cnVlO1xuICAgIHRoaXMuc2lnbmFsQ29kZSA9IGRlbm9TaWduYWw7XG4gICAgcmV0dXJuIHRoaXMua2lsbGVkO1xuICB9XG5cbiAgcmVmKCkge1xuICAgIHRoaXMuI3Byb2Nlc3MucmVmKCk7XG4gIH1cblxuICB1bnJlZigpIHtcbiAgICB0aGlzLiNwcm9jZXNzLnVucmVmKCk7XG4gIH1cblxuICBkaXNjb25uZWN0KCkge1xuICAgIHdhcm5Ob3RJbXBsZW1lbnRlZChcIkNoaWxkUHJvY2Vzcy5wcm90b3R5cGUuZGlzY29ubmVjdFwiKTtcbiAgfVxuXG4gIGFzeW5jICNfd2FpdEZvckNoaWxkU3RyZWFtc1RvQ2xvc2UoKSB7XG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXSBhcyBBcnJheTxQcm9taXNlPHZvaWQ+PjtcbiAgICBpZiAodGhpcy5zdGRpbiAmJiAhdGhpcy5zdGRpbi5kZXN0cm95ZWQpIHtcbiAgICAgIGFzc2VydCh0aGlzLnN0ZGluKTtcbiAgICAgIHRoaXMuc3RkaW4uZGVzdHJveSgpO1xuICAgICAgcHJvbWlzZXMucHVzaCh3YWl0Rm9yU3RyZWFtVG9DbG9zZSh0aGlzLnN0ZGluKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0ZG91dCAmJiAhdGhpcy5zdGRvdXQuZGVzdHJveWVkKSB7XG4gICAgICBwcm9taXNlcy5wdXNoKHdhaXRGb3JSZWFkYWJsZVRvQ2xvc2UodGhpcy5zdGRvdXQpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RkZXJyICYmICF0aGlzLnN0ZGVyci5kZXN0cm95ZWQpIHtcbiAgICAgIHByb21pc2VzLnB1c2god2FpdEZvclJlYWRhYmxlVG9DbG9zZSh0aGlzLnN0ZGVycikpO1xuICAgIH1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gIH1cblxuICAjX2hhbmRsZUVycm9yKGVycjogdW5rbm93bikge1xuICAgIG5leHRUaWNrKCgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChcImVycm9yXCIsIGVycik7IC8vIFRPRE8odWtpMDBhKSBDb252ZXJ0IGBlcnJgIGludG8gbm9kZWpzJ3MgYFN5c3RlbUVycm9yYCBjbGFzcy5cbiAgICB9KTtcbiAgfVxuXG4gICNjbG9zZVBpcGVzKCkge1xuICAgIGlmICh0aGlzLnN0ZGluKSB7XG4gICAgICBhc3NlcnQodGhpcy5zdGRpbik7XG4gICAgICB0aGlzLnN0ZGluLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3Qgc3VwcG9ydGVkTm9kZVN0ZGlvVHlwZXM6IE5vZGVTdGRpb1tdID0gW1wicGlwZVwiLCBcImlnbm9yZVwiLCBcImluaGVyaXRcIl07XG5mdW5jdGlvbiB0b0Rlbm9TdGRpbyhcbiAgcGlwZTogTm9kZVN0ZGlvIHwgbnVtYmVyIHwgU3RyZWFtIHwgbnVsbCB8IHVuZGVmaW5lZCxcbik6IERlbm9TdGRpbyB7XG4gIGlmIChcbiAgICAhc3VwcG9ydGVkTm9kZVN0ZGlvVHlwZXMuaW5jbHVkZXMocGlwZSBhcyBOb2RlU3RkaW8pIHx8XG4gICAgdHlwZW9mIHBpcGUgPT09IFwibnVtYmVyXCIgfHwgcGlwZSBpbnN0YW5jZW9mIFN0cmVhbVxuICApIHtcbiAgICBub3RJbXBsZW1lbnRlZChgdG9EZW5vU3RkaW8gcGlwZT0ke3R5cGVvZiBwaXBlfSAoJHtwaXBlfSlgKTtcbiAgfVxuICBzd2l0Y2ggKHBpcGUpIHtcbiAgICBjYXNlIFwicGlwZVwiOlxuICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgIGNhc2UgbnVsbDpcbiAgICAgIHJldHVybiBcInBpcGVkXCI7XG4gICAgY2FzZSBcImlnbm9yZVwiOlxuICAgICAgcmV0dXJuIFwibnVsbFwiO1xuICAgIGNhc2UgXCJpbmhlcml0XCI6XG4gICAgICByZXR1cm4gXCJpbmhlcml0XCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIG5vdEltcGxlbWVudGVkKGB0b0Rlbm9TdGRpbyBwaXBlPSR7dHlwZW9mIHBpcGV9ICgke3BpcGV9KWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvRGVub1NpZ25hbChzaWduYWw6IG51bWJlciB8IHN0cmluZyk6IERlbm8uU2lnbmFsIHtcbiAgaWYgKHR5cGVvZiBzaWduYWwgPT09IFwibnVtYmVyXCIpIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2Yga2V5cyhvcy5zaWduYWxzKSkge1xuICAgICAgaWYgKG9zLnNpZ25hbHNbbmFtZV0gPT09IHNpZ25hbCkge1xuICAgICAgICByZXR1cm4gbmFtZSBhcyBEZW5vLlNpZ25hbDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVSUl9VTktOT1dOX1NJR05BTChTdHJpbmcoc2lnbmFsKSk7XG4gIH1cblxuICBjb25zdCBkZW5vU2lnbmFsID0gc2lnbmFsIGFzIERlbm8uU2lnbmFsO1xuICBpZiAoZGVub1NpZ25hbCBpbiBvcy5zaWduYWxzKSB7XG4gICAgcmV0dXJuIGRlbm9TaWduYWw7XG4gIH1cbiAgdGhyb3cgbmV3IEVSUl9VTktOT1dOX1NJR05BTChzaWduYWwpO1xufVxuXG5mdW5jdGlvbiBrZXlzPFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4ob2JqZWN0OiBUKTogQXJyYXk8a2V5b2YgVD4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMob2JqZWN0KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGlsZFByb2Nlc3NPcHRpb25zIHtcbiAgLyoqXG4gICAqIEN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnkgb2YgdGhlIGNoaWxkIHByb2Nlc3MuXG4gICAqL1xuICBjd2Q/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEVudmlyb25tZW50IHZhcmlhYmxlcyBwYXNzZWQgdG8gdGhlIGNoaWxkIHByb2Nlc3MuXG4gICAqL1xuICBlbnY/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuPjtcblxuICAvKipcbiAgICogVGhpcyBvcHRpb24gZGVmaW5lcyBjaGlsZCBwcm9jZXNzJ3Mgc3RkaW8gY29uZmlndXJhdGlvbi5cbiAgICogQHNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2NoaWxkX3Byb2Nlc3MuaHRtbCNjaGlsZF9wcm9jZXNzX29wdGlvbnNfc3RkaW9cbiAgICovXG4gIHN0ZGlvPzogQXJyYXk8Tm9kZVN0ZGlvIHwgbnVtYmVyIHwgU3RyZWFtIHwgbnVsbCB8IHVuZGVmaW5lZD4gfCBOb2RlU3RkaW87XG5cbiAgLyoqXG4gICAqIE5PVEU6IFRoaXMgb3B0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuXG4gICAqL1xuICBkZXRhY2hlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIE5PVEU6IFRoaXMgb3B0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuXG4gICAqL1xuICB1aWQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIE5PVEU6IFRoaXMgb3B0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuXG4gICAqL1xuICBnaWQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIE5PVEU6IFRoaXMgb3B0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuXG4gICAqL1xuICBhcmd2MD86IHN0cmluZztcblxuICAvKipcbiAgICogKiBJZiB0aGlzIG9wdGlvbiBpcyBgdHJ1ZWAsIHJ1biB0aGUgY29tbWFuZCBpbiB0aGUgc2hlbGwuXG4gICAqICogSWYgdGhpcyBvcHRpb24gaXMgYSBzdHJpbmcsIHJ1biB0aGUgY29tbWFuZCBpbiB0aGUgc3BlY2lmaWVkIHNoZWxsLlxuICAgKi9cbiAgc2hlbGw/OiBzdHJpbmcgfCBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBbGxvd3MgYWJvcnRpbmcgdGhlIGNoaWxkIHByb2Nlc3MgdXNpbmcgYW4gQWJvcnRTaWduYWwuXG4gICAqL1xuICBzaWduYWw/OiBBYm9ydFNpZ25hbDtcblxuICAvKipcbiAgICogTk9URTogVGhpcyBvcHRpb24gaXMgbm90IHlldCBpbXBsZW1lbnRlZC5cbiAgICovXG4gIHNlcmlhbGl6YXRpb24/OiBcImpzb25cIiB8IFwiYWR2YW5jZWRcIjtcblxuICAvKiogTm8gcXVvdGluZyBvciBlc2NhcGluZyBvZiBhcmd1bWVudHMgaXMgZG9uZSBvbiBXaW5kb3dzLiBJZ25vcmVkIG9uIFVuaXguXG4gICAqIERlZmF1bHQ6IGZhbHNlLiAqL1xuICB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBOT1RFOiBUaGlzIG9wdGlvbiBpcyBub3QgeWV0IGltcGxlbWVudGVkLlxuICAgKi9cbiAgd2luZG93c0hpZGU/OiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBjb3B5UHJvY2Vzc0VudlRvRW52KFxuICBlbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZD4sXG4gIG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uRW52PzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbikge1xuICBpZiAoXG4gICAgRGVuby5lbnYuZ2V0KG5hbWUpICYmXG4gICAgKCFvcHRpb25FbnYgfHxcbiAgICAgICFPYmplY3RQcm90b3R5cGVIYXNPd25Qcm9wZXJ0eShvcHRpb25FbnYsIG5hbWUpKVxuICApIHtcbiAgICBlbnZbbmFtZV0gPSBEZW5vLmVudi5nZXQobmFtZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU3RkaW9PcHRpb24oXG4gIHN0ZGlvOiBBcnJheTxOb2RlU3RkaW8gfCBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkIHwgU3RyZWFtPiB8IE5vZGVTdGRpbyA9IFtcbiAgICBcInBpcGVcIixcbiAgICBcInBpcGVcIixcbiAgICBcInBpcGVcIixcbiAgXSxcbikge1xuICBpZiAoQXJyYXkuaXNBcnJheShzdGRpbykpIHtcbiAgICByZXR1cm4gc3RkaW87XG4gIH0gZWxzZSB7XG4gICAgc3dpdGNoIChzdGRpbykge1xuICAgICAgY2FzZSBcIm92ZXJsYXBwZWRcIjpcbiAgICAgICAgaWYgKGlzV2luZG93cykge1xuICAgICAgICAgIG5vdEltcGxlbWVudGVkKFwibm9ybWFsaXplU3RkaW9PcHRpb24gb3ZlcmxhcHBlZCAob24gd2luZG93cylcIik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gJ292ZXJsYXBwZWQnIGlzIHNhbWUgYXMgJ3BpcGVkJyBvbiBub24gV2luZG93cyBzeXN0ZW0uXG4gICAgICAgIHJldHVybiBbXCJwaXBlXCIsIFwicGlwZVwiLCBcInBpcGVcIl07XG4gICAgICBjYXNlIFwicGlwZVwiOlxuICAgICAgICByZXR1cm4gW1wicGlwZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdO1xuICAgICAgY2FzZSBcImluaGVyaXRcIjpcbiAgICAgICAgcmV0dXJuIFtcImluaGVyaXRcIiwgXCJpbmhlcml0XCIsIFwiaW5oZXJpdFwiXTtcbiAgICAgIGNhc2UgXCJpZ25vcmVcIjpcbiAgICAgICAgcmV0dXJuIFtcImlnbm9yZVwiLCBcImlnbm9yZVwiLCBcImlnbm9yZVwiXTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG5vdEltcGxlbWVudGVkKGBub3JtYWxpemVTdGRpb09wdGlvbiBzdGRpbz0ke3R5cGVvZiBzdGRpb30gKCR7c3RkaW99KWApO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU3Bhd25Bcmd1bWVudHMoXG4gIGZpbGU6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIG9wdGlvbnM6IFNwYXduU3luY09wdGlvbnMsXG4pIHtcbiAgdmFsaWRhdGVTdHJpbmcoZmlsZSwgXCJmaWxlXCIpO1xuXG4gIGlmIChmaWxlLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXCJmaWxlXCIsIGZpbGUsIFwiY2Fubm90IGJlIGVtcHR5XCIpO1xuICB9XG5cbiAgaWYgKEFycmF5SXNBcnJheShhcmdzKSkge1xuICAgIGFyZ3MgPSBBcnJheVByb3RvdHlwZVNsaWNlKGFyZ3MpO1xuICB9IGVsc2UgaWYgKGFyZ3MgPT0gbnVsbCkge1xuICAgIGFyZ3MgPSBbXTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgYXJncyAhPT0gXCJvYmplY3RcIikge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcImFyZ3NcIiwgXCJvYmplY3RcIiwgYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgb3B0aW9ucyA9IGFyZ3M7XG4gICAgYXJncyA9IFtdO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgIG9wdGlvbnMgPSBrRW1wdHlPYmplY3Q7XG4gIH0gZWxzZSB7XG4gICAgdmFsaWRhdGVPYmplY3Qob3B0aW9ucywgXCJvcHRpb25zXCIpO1xuICB9XG5cbiAgbGV0IGN3ZCA9IG9wdGlvbnMuY3dkO1xuXG4gIC8vIFZhbGlkYXRlIHRoZSBjd2QsIGlmIHByZXNlbnQuXG4gIGlmIChjd2QgIT0gbnVsbCkge1xuICAgIGN3ZCA9IGdldFZhbGlkYXRlZFBhdGgoY3dkLCBcIm9wdGlvbnMuY3dkXCIpIGFzIHN0cmluZztcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGRldGFjaGVkLCBpZiBwcmVzZW50LlxuICBpZiAob3B0aW9ucy5kZXRhY2hlZCAhPSBudWxsKSB7XG4gICAgdmFsaWRhdGVCb29sZWFuKG9wdGlvbnMuZGV0YWNoZWQsIFwib3B0aW9ucy5kZXRhY2hlZFwiKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHRoZSB1aWQsIGlmIHByZXNlbnQuXG4gIGlmIChvcHRpb25zLnVpZCAhPSBudWxsICYmICFpc0ludDMyKG9wdGlvbnMudWlkKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcIm9wdGlvbnMudWlkXCIsIFwiaW50MzJcIiwgb3B0aW9ucy51aWQpO1xuICB9XG5cbiAgLy8gVmFsaWRhdGUgdGhlIGdpZCwgaWYgcHJlc2VudC5cbiAgaWYgKG9wdGlvbnMuZ2lkICE9IG51bGwgJiYgIWlzSW50MzIob3B0aW9ucy5naWQpKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwib3B0aW9ucy5naWRcIiwgXCJpbnQzMlwiLCBvcHRpb25zLmdpZCk7XG4gIH1cblxuICAvLyBWYWxpZGF0ZSB0aGUgc2hlbGwsIGlmIHByZXNlbnQuXG4gIGlmIChcbiAgICBvcHRpb25zLnNoZWxsICE9IG51bGwgJiZcbiAgICB0eXBlb2Ygb3B0aW9ucy5zaGVsbCAhPT0gXCJib29sZWFuXCIgJiZcbiAgICB0eXBlb2Ygb3B0aW9ucy5zaGVsbCAhPT0gXCJzdHJpbmdcIlxuICApIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXG4gICAgICBcIm9wdGlvbnMuc2hlbGxcIixcbiAgICAgIFtcImJvb2xlYW5cIiwgXCJzdHJpbmdcIl0sXG4gICAgICBvcHRpb25zLnNoZWxsLFxuICAgICk7XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBhcmd2MCwgaWYgcHJlc2VudC5cbiAgaWYgKG9wdGlvbnMuYXJndjAgIT0gbnVsbCkge1xuICAgIHZhbGlkYXRlU3RyaW5nKG9wdGlvbnMuYXJndjAsIFwib3B0aW9ucy5hcmd2MFwiKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHdpbmRvd3NIaWRlLCBpZiBwcmVzZW50LlxuICBpZiAob3B0aW9ucy53aW5kb3dzSGlkZSAhPSBudWxsKSB7XG4gICAgdmFsaWRhdGVCb29sZWFuKG9wdGlvbnMud2luZG93c0hpZGUsIFwib3B0aW9ucy53aW5kb3dzSGlkZVwiKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHdpbmRvd3NWZXJiYXRpbUFyZ3VtZW50cywgaWYgcHJlc2VudC5cbiAgbGV0IHsgd2luZG93c1ZlcmJhdGltQXJndW1lbnRzIH0gPSBvcHRpb25zO1xuICBpZiAod2luZG93c1ZlcmJhdGltQXJndW1lbnRzICE9IG51bGwpIHtcbiAgICB2YWxpZGF0ZUJvb2xlYW4oXG4gICAgICB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMsXG4gICAgICBcIm9wdGlvbnMud2luZG93c1ZlcmJhdGltQXJndW1lbnRzXCIsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLnNoZWxsKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IEFycmF5UHJvdG90eXBlSm9pbihbZmlsZSwgLi4uYXJnc10sIFwiIFwiKTtcbiAgICAvLyBTZXQgdGhlIHNoZWxsLCBzd2l0Y2hlcywgYW5kIGNvbW1hbmRzLlxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5zaGVsbCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBmaWxlID0gb3B0aW9ucy5zaGVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGUgPSBEZW5vLmVudi5nZXQoXCJjb21zcGVjXCIpIHx8IFwiY21kLmV4ZVwiO1xuICAgICAgfVxuICAgICAgLy8gJy9kIC9zIC9jJyBpcyB1c2VkIG9ubHkgZm9yIGNtZC5leGUuXG4gICAgICBpZiAoL14oPzouKlxcXFwpP2NtZCg/OlxcLmV4ZSk/JC9pLmV4ZWMoZmlsZSkgIT09IG51bGwpIHtcbiAgICAgICAgYXJncyA9IFtcIi9kXCIsIFwiL3NcIiwgXCIvY1wiLCBgXCIke2NvbW1hbmR9XCJgXTtcbiAgICAgICAgd2luZG93c1ZlcmJhdGltQXJndW1lbnRzID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MgPSBbXCItY1wiLCBjb21tYW5kXTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLyoqIFRPRE86IGFkZCBBbmRyb2lkIGNvbmRpdGlvbiAqL1xuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnNoZWxsID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGZpbGUgPSBvcHRpb25zLnNoZWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZSA9IFwiL2Jpbi9zaFwiO1xuICAgICAgfVxuICAgICAgYXJncyA9IFtcIi1jXCIsIGNvbW1hbmRdO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5hcmd2MCA9PT0gXCJzdHJpbmdcIikge1xuICAgIEFycmF5UHJvdG90eXBlVW5zaGlmdChhcmdzLCBvcHRpb25zLmFyZ3YwKTtcbiAgfSBlbHNlIHtcbiAgICBBcnJheVByb3RvdHlwZVVuc2hpZnQoYXJncywgZmlsZSk7XG4gIH1cblxuICBjb25zdCBlbnYgPSBvcHRpb25zLmVudiB8fCBEZW5vLmVudi50b09iamVjdCgpO1xuICBjb25zdCBlbnZQYWlyczogc3RyaW5nW11bXSA9IFtdO1xuXG4gIC8vIHByb2Nlc3MuZW52Lk5PREVfVjhfQ09WRVJBR0UgYWx3YXlzIHByb3BhZ2F0ZXMsIG1ha2luZyBpdCBwb3NzaWJsZSB0b1xuICAvLyBjb2xsZWN0IGNvdmVyYWdlIGZvciBwcm9ncmFtcyB0aGF0IHNwYXduIHdpdGggd2hpdGUtbGlzdGVkIGVudmlyb25tZW50LlxuICBjb3B5UHJvY2Vzc0VudlRvRW52KGVudiwgXCJOT0RFX1Y4X0NPVkVSQUdFXCIsIG9wdGlvbnMuZW52KTtcblxuICAvKiogVE9ETzogYWRkIGBpc1pPU2AgY29uZGl0aW9uICovXG5cbiAgbGV0IGVudktleXM6IHN0cmluZ1tdID0gW107XG4gIC8vIFByb3RvdHlwZSB2YWx1ZXMgYXJlIGludGVudGlvbmFsbHkgaW5jbHVkZWQuXG4gIGZvciAoY29uc3Qga2V5IGluIGVudikge1xuICAgIEFycmF5UHJvdG90eXBlUHVzaChlbnZLZXlzLCBrZXkpO1xuICB9XG5cbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuICAgIC8vIE9uIFdpbmRvd3MgZW52IGtleXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUuIEZpbHRlciBvdXQgZHVwbGljYXRlcyxcbiAgICAvLyBrZWVwaW5nIG9ubHkgdGhlIGZpcnN0IG9uZSAoaW4gbGV4aWNvZ3JhcGhpYyBvcmRlcilcbiAgICAvKiogVE9ETzogaW1wbGVtZW50IFNhZmVTZXQgYW5kIG1ha2VTYWZlICovXG4gICAgY29uc3Qgc2F3S2V5ID0gbmV3IFNldCgpO1xuICAgIGVudktleXMgPSBBcnJheVByb3RvdHlwZUZpbHRlcihcbiAgICAgIEFycmF5UHJvdG90eXBlU29ydChlbnZLZXlzKSxcbiAgICAgIChrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCB1cHBlcmNhc2VLZXkgPSBTdHJpbmdQcm90b3R5cGVUb1VwcGVyQ2FzZShrZXkpO1xuICAgICAgICBpZiAoc2F3S2V5Lmhhcyh1cHBlcmNhc2VLZXkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHNhd0tleS5hZGQodXBwZXJjYXNlS2V5KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGtleSBvZiBlbnZLZXlzKSB7XG4gICAgY29uc3QgdmFsdWUgPSBlbnZba2V5XTtcbiAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgQXJyYXlQcm90b3R5cGVQdXNoKGVudlBhaXJzLCBgJHtrZXl9PSR7dmFsdWV9YCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjb3B5IHNvIHdlIGRvbid0IGNsb2JiZXIgdGhlIHVzZXIncyBvcHRpb25zIG9iamVjdC5cbiAgICAuLi5vcHRpb25zLFxuICAgIGFyZ3MsXG4gICAgY3dkLFxuICAgIGRldGFjaGVkOiAhIW9wdGlvbnMuZGV0YWNoZWQsXG4gICAgZW52UGFpcnMsXG4gICAgZmlsZSxcbiAgICB3aW5kb3dzSGlkZTogISFvcHRpb25zLndpbmRvd3NIaWRlLFxuICAgIHdpbmRvd3NWZXJiYXRpbUFyZ3VtZW50czogISF3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHdhaXRGb3JSZWFkYWJsZVRvQ2xvc2UocmVhZGFibGU6IFJlYWRhYmxlKSB7XG4gIHJlYWRhYmxlLnJlc3VtZSgpOyAvLyBFbnN1cmUgYnVmZmVyZWQgZGF0YSB3aWxsIGJlIGNvbnN1bWVkLlxuICByZXR1cm4gd2FpdEZvclN0cmVhbVRvQ2xvc2UocmVhZGFibGUgYXMgdW5rbm93biBhcyBTdHJlYW0pO1xufVxuXG5mdW5jdGlvbiB3YWl0Rm9yU3RyZWFtVG9DbG9zZShzdHJlYW06IFN0cmVhbSkge1xuICBjb25zdCBwcm9taXNlID0gZGVmZXJyZWQ8dm9pZD4oKTtcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBzdHJlYW0ucmVtb3ZlTGlzdGVuZXIoXCJjbG9zZVwiLCBvbkNsb3NlKTtcbiAgICBzdHJlYW0ucmVtb3ZlTGlzdGVuZXIoXCJlcnJvclwiLCBvbkVycm9yKTtcbiAgfTtcbiAgY29uc3Qgb25DbG9zZSA9ICgpID0+IHtcbiAgICBjbGVhbnVwKCk7XG4gICAgcHJvbWlzZS5yZXNvbHZlKCk7XG4gIH07XG4gIGNvbnN0IG9uRXJyb3IgPSAoZXJyOiBFcnJvcikgPT4ge1xuICAgIGNsZWFudXAoKTtcbiAgICBwcm9taXNlLnJlamVjdChlcnIpO1xuICB9O1xuICBzdHJlYW0ub25jZShcImNsb3NlXCIsIG9uQ2xvc2UpO1xuICBzdHJlYW0ub25jZShcImVycm9yXCIsIG9uRXJyb3IpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL2ZjNjQyNmNjYzRiNGNiNzMwNzYzNTZmYjZkYmY0NmEyODk1M2FmMDEvbGliL2NoaWxkX3Byb2Nlc3MuanMjTDUwNC1MNTI4LlxuICogQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuICovXG5mdW5jdGlvbiBidWlsZENvbW1hbmQoXG4gIGZpbGU6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIHNoZWxsOiBzdHJpbmcgfCBib29sZWFuLFxuKTogW3N0cmluZywgc3RyaW5nW11dIHtcbiAgaWYgKGZpbGUgPT09IERlbm8uZXhlY1BhdGgoKSkge1xuICAgIC8vIFRoZSB1c2VyIGlzIHRyeWluZyB0byBzcGF3biBhbm90aGVyIERlbm8gcHJvY2VzcyBhcyBOb2RlLmpzLlxuICAgIGFyZ3MgPSB0b0Rlbm9BcmdzKGFyZ3MpO1xuICB9XG5cbiAgaWYgKHNoZWxsKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFtmaWxlLCAuLi5hcmdzXS5qb2luKFwiIFwiKTtcblxuICAgIC8vIFNldCB0aGUgc2hlbGwsIHN3aXRjaGVzLCBhbmQgY29tbWFuZHMuXG4gICAgaWYgKGlzV2luZG93cykge1xuICAgICAgaWYgKHR5cGVvZiBzaGVsbCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBmaWxlID0gc2hlbGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWxlID0gRGVuby5lbnYuZ2V0KFwiY29tc3BlY1wiKSB8fCBcImNtZC5leGVcIjtcbiAgICAgIH1cbiAgICAgIC8vICcvZCAvcyAvYycgaXMgdXNlZCBvbmx5IGZvciBjbWQuZXhlLlxuICAgICAgaWYgKC9eKD86LipcXFxcKT9jbWQoPzpcXC5leGUpPyQvaS50ZXN0KGZpbGUpKSB7XG4gICAgICAgIGFyZ3MgPSBbXCIvZFwiLCBcIi9zXCIsIFwiL2NcIiwgYFwiJHtjb21tYW5kfVwiYF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcmdzID0gW1wiLWNcIiwgY29tbWFuZF07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2Ygc2hlbGwgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgZmlsZSA9IHNoZWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZSA9IFwiL2Jpbi9zaFwiO1xuICAgICAgfVxuICAgICAgYXJncyA9IFtcIi1jXCIsIGNvbW1hbmRdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2ZpbGUsIGFyZ3NdO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlU3Bhd25TeW5jRXJyb3IoXG4gIHN0YXR1czogc3RyaW5nLFxuICBjb21tYW5kOiBzdHJpbmcsXG4gIGFyZ3M6IHN0cmluZ1tdID0gW10sXG4pOiBFcnJub0V4Y2VwdGlvbiB7XG4gIGNvbnN0IGVycm9yID0gZXJybm9FeGNlcHRpb24oXG4gICAgY29kZU1hcC5nZXQoc3RhdHVzKSxcbiAgICBcInNwYXduU3luYyBcIiArIGNvbW1hbmQsXG4gICk7XG4gIGVycm9yLnBhdGggPSBjb21tYW5kO1xuICBlcnJvci5zcGF3bmFyZ3MgPSBhcmdzO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25TeW5jT3B0aW9ucyB7XG4gIGN3ZD86IHN0cmluZyB8IFVSTDtcbiAgaW5wdXQ/OiBzdHJpbmcgfCBCdWZmZXIgfCBEYXRhVmlldztcbiAgYXJndjA/OiBzdHJpbmc7XG4gIHN0ZGlvPzogQXJyYXk8Tm9kZVN0ZGlvIHwgbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCB8IFN0cmVhbT4gfCBOb2RlU3RkaW87XG4gIGVudj86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHVpZD86IG51bWJlcjtcbiAgZ2lkPzogbnVtYmVyO1xuICB0aW1lb3V0PzogbnVtYmVyO1xuICBtYXhCdWZmZXI/OiBudW1iZXI7XG4gIGVuY29kaW5nPzogc3RyaW5nO1xuICBzaGVsbD86IGJvb2xlYW4gfCBzdHJpbmc7XG4gIC8qKiBObyBxdW90aW5nIG9yIGVzY2FwaW5nIG9mIGFyZ3VtZW50cyBpcyBkb25lIG9uIFdpbmRvd3MuIElnbm9yZWQgb24gVW5peC5cbiAgICogRGVmYXVsdDogZmFsc2UuICovXG4gIHdpbmRvd3NWZXJiYXRpbUFyZ3VtZW50cz86IGJvb2xlYW47XG4gIHdpbmRvd3NIaWRlPzogYm9vbGVhbjtcbiAgLyoqIFRoZSBiZWxvdyBvcHRpb25zIGFyZW4ndCBjdXJyZW50bHkgc3VwcG9ydGVkLiBIb3dldmVyLCB0aGV5J3JlIGhlcmUgZm9yIHZhbGlkYXRpb24gY2hlY2tzLiAqL1xuICBraWxsU2lnbmFsPzogc3RyaW5nO1xuICBkZXRhY2hlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25TeW5jUmVzdWx0IHtcbiAgcGlkPzogbnVtYmVyO1xuICBvdXRwdXQ/OiBbc3RyaW5nIHwgbnVsbCwgc3RyaW5nIHwgQnVmZmVyIHwgbnVsbCwgc3RyaW5nIHwgQnVmZmVyIHwgbnVsbF07XG4gIHN0ZG91dD86IEJ1ZmZlciB8IHN0cmluZyB8IG51bGw7XG4gIHN0ZGVycj86IEJ1ZmZlciB8IHN0cmluZyB8IG51bGw7XG4gIHN0YXR1cz86IG51bWJlciB8IG51bGw7XG4gIHNpZ25hbD86IHN0cmluZyB8IG51bGw7XG4gIGVycm9yPzogRXJyb3I7XG59XG5cbmZ1bmN0aW9uIHBhcnNlU3Bhd25TeW5jT3V0cHV0U3RyZWFtcyhcbiAgb3V0cHV0OiBEZW5vLkNvbW1hbmRPdXRwdXQsXG4gIG5hbWU6IFwic3Rkb3V0XCIgfCBcInN0ZGVyclwiLFxuKTogc3RyaW5nIHwgQnVmZmVyIHwgbnVsbCB7XG4gIC8vIG5ldyBEZW5vLkNvbW1hbmQoKS5vdXRwdXRTeW5jKCkgcmV0dXJucyBnZXR0ZXJzIGZvciBzdGRvdXQgYW5kIHN0ZGVyciB0aGF0IHRocm93IHdoZW4gc2V0XG4gIC8vIHRvICdpbmhlcml0Jy5cbiAgdHJ5IHtcbiAgICByZXR1cm4gQnVmZmVyLmZyb20ob3V0cHV0W25hbWVdKSBhcyBzdHJpbmcgfCBCdWZmZXI7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGF3blN5bmMoXG4gIGNvbW1hbmQ6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIG9wdGlvbnM6IFNwYXduU3luY09wdGlvbnMsXG4pOiBTcGF3blN5bmNSZXN1bHQge1xuICBjb25zdCB7XG4gICAgZW52ID0gRGVuby5lbnYudG9PYmplY3QoKSxcbiAgICBzdGRpbyA9IFtcInBpcGVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgICBzaGVsbCA9IGZhbHNlLFxuICAgIGN3ZCxcbiAgICBlbmNvZGluZyxcbiAgICB1aWQsXG4gICAgZ2lkLFxuICAgIG1heEJ1ZmZlcixcbiAgICB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMgPSBmYWxzZSxcbiAgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IG5vcm1hbGl6ZWRTdGRpbyA9IG5vcm1hbGl6ZVN0ZGlvT3B0aW9uKHN0ZGlvKTtcbiAgW2NvbW1hbmQsIGFyZ3NdID0gYnVpbGRDb21tYW5kKGNvbW1hbmQsIGFyZ3MgPz8gW10sIHNoZWxsKTtcblxuICBjb25zdCByZXN1bHQ6IFNwYXduU3luY1Jlc3VsdCA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBEZW5vQ29tbWFuZChjb21tYW5kLCB7XG4gICAgICBhcmdzLFxuICAgICAgY3dkLFxuICAgICAgZW52LFxuICAgICAgc3Rkb3V0OiB0b0Rlbm9TdGRpbyhub3JtYWxpemVkU3RkaW9bMV0gYXMgTm9kZVN0ZGlvIHwgbnVtYmVyKSxcbiAgICAgIHN0ZGVycjogdG9EZW5vU3RkaW8obm9ybWFsaXplZFN0ZGlvWzJdIGFzIE5vZGVTdGRpbyB8IG51bWJlciksXG4gICAgICB1aWQsXG4gICAgICBnaWQsXG4gICAgICB3aW5kb3dzUmF3QXJndW1lbnRzOiB3aW5kb3dzVmVyYmF0aW1Bcmd1bWVudHMsXG4gICAgfSkub3V0cHV0U3luYygpO1xuXG4gICAgY29uc3Qgc3RhdHVzID0gb3V0cHV0LnNpZ25hbCA/IG51bGwgOiAwO1xuICAgIGxldCBzdGRvdXQgPSBwYXJzZVNwYXduU3luY091dHB1dFN0cmVhbXMob3V0cHV0LCBcInN0ZG91dFwiKTtcbiAgICBsZXQgc3RkZXJyID0gcGFyc2VTcGF3blN5bmNPdXRwdXRTdHJlYW1zKG91dHB1dCwgXCJzdGRlcnJcIik7XG5cbiAgICBpZiAoXG4gICAgICAoc3Rkb3V0ICYmIHN0ZG91dC5sZW5ndGggPiBtYXhCdWZmZXIhKSB8fFxuICAgICAgKHN0ZGVyciAmJiBzdGRlcnIubGVuZ3RoID4gbWF4QnVmZmVyISlcbiAgICApIHtcbiAgICAgIHJlc3VsdC5lcnJvciA9IF9jcmVhdGVTcGF3blN5bmNFcnJvcihcIkVOT0JVRlNcIiwgY29tbWFuZCwgYXJncyk7XG4gICAgfVxuXG4gICAgaWYgKGVuY29kaW5nICYmIGVuY29kaW5nICE9PSBcImJ1ZmZlclwiKSB7XG4gICAgICBzdGRvdXQgPSBzdGRvdXQgJiYgc3Rkb3V0LnRvU3RyaW5nKGVuY29kaW5nKTtcbiAgICAgIHN0ZGVyciA9IHN0ZGVyciAmJiBzdGRlcnIudG9TdHJpbmcoZW5jb2RpbmcpO1xuICAgIH1cblxuICAgIHJlc3VsdC5zdGF0dXMgPSBzdGF0dXM7XG4gICAgcmVzdWx0LnNpZ25hbCA9IG91dHB1dC5zaWduYWw7XG4gICAgcmVzdWx0LnN0ZG91dCA9IHN0ZG91dDtcbiAgICByZXN1bHQuc3RkZXJyID0gc3RkZXJyO1xuICAgIHJlc3VsdC5vdXRwdXQgPSBbb3V0cHV0LnNpZ25hbCwgc3Rkb3V0LCBzdGRlcnJdO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIHJlc3VsdC5lcnJvciA9IF9jcmVhdGVTcGF3blN5bmNFcnJvcihcIkVOT0VOVFwiLCBjb21tYW5kLCBhcmdzKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gVGhlc2UgYXJlIE5vZGUuanMgQ0xJIGZsYWdzIHRoYXQgZXhwZWN0IGEgdmFsdWUuIEl0J3MgbmVjZXNzYXJ5IHRvXG4vLyB1bmRlcnN0YW5kIHRoZXNlIGZsYWdzIGluIG9yZGVyIHRvIHByb3Blcmx5IHJlcGxhY2UgZmxhZ3MgcGFzc2VkIHRvIHRoZVxuLy8gY2hpbGQgcHJvY2Vzcy4gRm9yIGV4YW1wbGUsIC1lIGlzIGEgTm9kZSBmbGFnIGZvciBldmFsIG1vZGUgaWYgaXQgaXMgcGFydFxuLy8gb2YgcHJvY2Vzcy5leGVjQXJndi4gSG93ZXZlciwgLWUgY291bGQgYWxzbyBiZSBhbiBhcHBsaWNhdGlvbiBmbGFnIGlmIGl0IGlzXG4vLyBwYXJ0IG9mIHByb2Nlc3MuZXhlY3YgaW5zdGVhZC4gV2Ugb25seSB3YW50IHRvIHByb2Nlc3MgZXhlY0FyZ3YgZmxhZ3MuXG5jb25zdCBrTG9uZ0FyZ1R5cGUgPSAxO1xuY29uc3Qga1Nob3J0QXJnVHlwZSA9IDI7XG5jb25zdCBrTG9uZ0FyZyA9IHsgdHlwZToga0xvbmdBcmdUeXBlIH07XG5jb25zdCBrU2hvcnRBcmcgPSB7IHR5cGU6IGtTaG9ydEFyZ1R5cGUgfTtcbmNvbnN0IGtOb2RlRmxhZ3NNYXAgPSBuZXcgTWFwKFtcbiAgW1wiLS1idWlsZC1zbmFwc2hvdFwiLCBrTG9uZ0FyZ10sXG4gIFtcIi1jXCIsIGtTaG9ydEFyZ10sXG4gIFtcIi0tY2hlY2tcIiwga0xvbmdBcmddLFxuICBbXCItQ1wiLCBrU2hvcnRBcmddLFxuICBbXCItLWNvbmRpdGlvbnNcIiwga0xvbmdBcmddLFxuICBbXCItLWNwdS1wcm9mLWRpclwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tY3B1LXByb2YtaW50ZXJ2YWxcIiwga0xvbmdBcmddLFxuICBbXCItLWNwdS1wcm9mLW5hbWVcIiwga0xvbmdBcmddLFxuICBbXCItLWRpYWdub3N0aWMtZGlyXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1kaXNhYmxlLXByb3RvXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1kbnMtcmVzdWx0LW9yZGVyXCIsIGtMb25nQXJnXSxcbiAgW1wiLWVcIiwga1Nob3J0QXJnXSxcbiAgW1wiLS1ldmFsXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1leHBlcmltZW50YWwtbG9hZGVyXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1leHBlcmltZW50YWwtcG9saWN5XCIsIGtMb25nQXJnXSxcbiAgW1wiLS1leHBlcmltZW50YWwtc3BlY2lmaWVyLXJlc29sdXRpb25cIiwga0xvbmdBcmddLFxuICBbXCItLWhlYXBzbmFwc2hvdC1uZWFyLWhlYXAtbGltaXRcIiwga0xvbmdBcmddLFxuICBbXCItLWhlYXBzbmFwc2hvdC1zaWduYWxcIiwga0xvbmdBcmddLFxuICBbXCItLWhlYXAtcHJvZi1kaXJcIiwga0xvbmdBcmddLFxuICBbXCItLWhlYXAtcHJvZi1pbnRlcnZhbFwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0taGVhcC1wcm9mLW5hbWVcIiwga0xvbmdBcmddLFxuICBbXCItLWljdS1kYXRhLWRpclwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0taW5wdXQtdHlwZVwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0taW5zcGVjdC1wdWJsaXNoLXVpZFwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tbWF4LWh0dHAtaGVhZGVyLXNpemVcIiwga0xvbmdBcmddLFxuICBbXCItLW9wZW5zc2wtY29uZmlnXCIsIGtMb25nQXJnXSxcbiAgW1wiLXBcIiwga1Nob3J0QXJnXSxcbiAgW1wiLS1wcmludFwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tcG9saWN5LWludGVncml0eVwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tcHJvZi1wcm9jZXNzXCIsIGtMb25nQXJnXSxcbiAgW1wiLXJcIiwga1Nob3J0QXJnXSxcbiAgW1wiLS1yZXF1aXJlXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1yZWRpcmVjdC13YXJuaW5nc1wiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tcmVwb3J0LWRpclwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tcmVwb3J0LWRpcmVjdG9yeVwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tcmVwb3J0LWZpbGVuYW1lXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1yZXBvcnQtc2lnbmFsXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1zZWN1cmUtaGVhcFwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tc2VjdXJlLWhlYXAtbWluXCIsIGtMb25nQXJnXSxcbiAgW1wiLS1zbmFwc2hvdC1ibG9iXCIsIGtMb25nQXJnXSxcbiAgW1wiLS10aXRsZVwiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tdGxzLWNpcGhlci1saXN0XCIsIGtMb25nQXJnXSxcbiAgW1wiLS10bHMta2V5bG9nXCIsIGtMb25nQXJnXSxcbiAgW1wiLS11bmhhbmRsZWQtcmVqZWN0aW9uc1wiLCBrTG9uZ0FyZ10sXG4gIFtcIi0tdXNlLWxhcmdlcGFnZXNcIiwga0xvbmdBcmddLFxuICBbXCItLXY4LXBvb2wtc2l6ZVwiLCBrTG9uZ0FyZ10sXG5dKTtcbmNvbnN0IGtEZW5vU3ViY29tbWFuZHMgPSBuZXcgU2V0KFtcbiAgXCJiZW5jaFwiLFxuICBcImJ1bmRsZVwiLFxuICBcImNhY2hlXCIsXG4gIFwiY2hlY2tcIixcbiAgXCJjb21waWxlXCIsXG4gIFwiY29tcGxldGlvbnNcIixcbiAgXCJjb3ZlcmFnZVwiLFxuICBcImRvY1wiLFxuICBcImV2YWxcIixcbiAgXCJmbXRcIixcbiAgXCJoZWxwXCIsXG4gIFwiaW5mb1wiLFxuICBcImluaXRcIixcbiAgXCJpbnN0YWxsXCIsXG4gIFwibGludFwiLFxuICBcImxzcFwiLFxuICBcInJlcGxcIixcbiAgXCJydW5cIixcbiAgXCJ0YXNrc1wiLFxuICBcInRlc3RcIixcbiAgXCJ0eXBlc1wiLFxuICBcInVuaW5zdGFsbFwiLFxuICBcInVwZ3JhZGVcIixcbiAgXCJ2ZW5kb3JcIixcbl0pO1xuXG5mdW5jdGlvbiB0b0Rlbm9BcmdzKGFyZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICBpZiAoYXJncy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIC8vIFVwZGF0ZSB0aGlzIGxvZ2ljIGFzIG1vcmUgQ0xJIGFyZ3VtZW50cyBhcmUgbWFwcGVkIGZyb20gTm9kZSB0byBEZW5vLlxuICBjb25zdCBkZW5vQXJnczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IHVzZVJ1bkFyZ3MgPSB0cnVlO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGFyZyA9IGFyZ3NbaV07XG5cbiAgICBpZiAoYXJnLmNoYXJBdCgwKSAhPT0gXCItXCIgfHwgYXJnID09PSBcIi0tXCIpIHtcbiAgICAgIC8vIE5vdCBhIGZsYWcgb3Igbm8gbW9yZSBhcmd1bWVudHMuXG5cbiAgICAgIC8vIElmIHRoZSBhcmcgaXMgYSBEZW5vIHN1YmNvbW1hbmQsIHRoZW4gdGhlIGNoaWxkIHByb2Nlc3MgaXMgYmVpbmdcbiAgICAgIC8vIHNwYXduZWQgYXMgRGVubywgbm90IERlbm8gaW4gTm9kZSBjb21wYXQgbW9kZS4gSW4gdGhpcyBjYXNlLCBiYWlsIG91dFxuICAgICAgLy8gYW5kIHJldHVybiB0aGUgb3JpZ2luYWwgYXJncy5cbiAgICAgIGlmIChrRGVub1N1YmNvbW1hbmRzLmhhcyhhcmcpKSB7XG4gICAgICAgIHJldHVybiBhcmdzO1xuICAgICAgfVxuXG4gICAgICAvLyBDb3B5IG9mIHRoZSByZXN0IG9mIHRoZSBhcmd1bWVudHMgdG8gdGhlIG91dHB1dC5cbiAgICAgIGZvciAobGV0IGogPSBpOyBqIDwgYXJncy5sZW5ndGg7IGorKykge1xuICAgICAgICBkZW5vQXJncy5wdXNoKGFyZ3Nbal0pO1xuICAgICAgfVxuXG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBTb21ldGhpbmcgdGhhdCBsb29rcyBsaWtlIGEgZmxhZyB3YXMgcGFzc2VkLlxuICAgIGxldCBmbGFnID0gYXJnO1xuICAgIGxldCBmbGFnSW5mbyA9IGtOb2RlRmxhZ3NNYXAuZ2V0KGFyZyk7XG4gICAgbGV0IGlzTG9uZ1dpdGhWYWx1ZSA9IGZhbHNlO1xuICAgIGxldCBmbGFnVmFsdWU7XG5cbiAgICBpZiAoZmxhZ0luZm8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gSWYgdGhlIGZsYWcgd2FzIG5vdCBmb3VuZCwgaXQncyBlaXRoZXIgbm90IGEga25vd24gZmxhZyBvciBpdCdzIGEgbG9uZ1xuICAgICAgLy8gZmxhZyBjb250YWluaW5nIGFuICc9Jy5cbiAgICAgIGNvbnN0IHNwbGl0QXQgPSBhcmcuaW5kZXhPZihcIj1cIik7XG5cbiAgICAgIGlmIChzcGxpdEF0ICE9PSAtMSkge1xuICAgICAgICBmbGFnID0gYXJnLnNsaWNlKDAsIHNwbGl0QXQpO1xuICAgICAgICBmbGFnSW5mbyA9IGtOb2RlRmxhZ3NNYXAuZ2V0KGZsYWcpO1xuICAgICAgICBmbGFnVmFsdWUgPSBhcmcuc2xpY2Uoc3BsaXRBdCArIDEpO1xuICAgICAgICBpc0xvbmdXaXRoVmFsdWUgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGFnSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBOb3QgYSBrbm93biBmbGFnIHRoYXQgZXhwZWN0cyBhIHZhbHVlLiBKdXN0IGNvcHkgaXQgdG8gdGhlIG91dHB1dC5cbiAgICAgIGRlbm9BcmdzLnB1c2goYXJnKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgYSBmbGFnIHdpdGggYSB2YWx1ZS4gR2V0IHRoZSB2YWx1ZSBpZiB3ZSBkb24ndCBhbHJlYWR5IGhhdmUgaXQuXG4gICAgaWYgKGZsYWdWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpKys7XG5cbiAgICAgIGlmIChpID49IGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIC8vIFRoZXJlIHdhcyB1c2VyIGVycm9yLiBUaGVyZSBzaG91bGQgYmUgYW5vdGhlciBhcmcgZm9yIHRoZSB2YWx1ZSwgYnV0XG4gICAgICAgIC8vIHRoZXJlIGlzbid0IG9uZS4gSnVzdCBjb3B5IHRoZSBhcmcgdG8gdGhlIG91dHB1dC4gSXQncyBub3QgZ29pbmdcbiAgICAgICAgLy8gdG8gd29yayBhbnl3YXkuXG4gICAgICAgIGRlbm9BcmdzLnB1c2goYXJnKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGZsYWdWYWx1ZSA9IGFyZ3NbaV07XG4gICAgfVxuXG4gICAgLy8gUmVtYXAgTm9kZSdzIGV2YWwgZmxhZ3MgdG8gRGVuby5cbiAgICBpZiAoZmxhZyA9PT0gXCItZVwiIHx8IGZsYWcgPT09IFwiLS1ldmFsXCIpIHtcbiAgICAgIGRlbm9BcmdzLnB1c2goXCJldmFsXCIsIGZsYWdWYWx1ZSk7XG4gICAgICB1c2VSdW5BcmdzID0gZmFsc2U7XG4gICAgfSBlbHNlIGlmIChpc0xvbmdXaXRoVmFsdWUpIHtcbiAgICAgIGRlbm9BcmdzLnB1c2goYXJnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVub0FyZ3MucHVzaChmbGFnLCBmbGFnVmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIGlmICh1c2VSdW5BcmdzKSB7XG4gICAgLy8gLUEgaXMgbm90IGlkZWFsLCBidXQgbmVlZGVkIHRvIHByb3BhZ2F0ZSBwZXJtaXNzaW9ucy5cbiAgICAvLyAtLXVuc3RhYmxlIGlzIG5lZWRlZCBmb3IgTm9kZSBjb21wYXQuXG4gICAgZGVub0FyZ3MudW5zaGlmdChcInJ1blwiLCBcIi1BXCIsIFwiLS11bnN0YWJsZVwiKTtcbiAgfVxuXG4gIHJldHVybiBkZW5vQXJncztcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBDaGlsZFByb2Nlc3MsXG4gIHN0ZGlvU3RyaW5nVG9BcnJheSxcbiAgc3Bhd25TeW5jLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUsZ0VBQWdFO0FBQ2hFLGlEQUFpRDtBQUNqRCxTQUFTLE1BQU0sUUFBUSx5QkFBeUI7QUFDaEQsU0FBUyxZQUFZLFFBQVEsZUFBZTtBQUM1QyxTQUFTLEVBQUUsUUFBUSxtQ0FBbUM7QUFDdEQsU0FBUyxjQUFjLEVBQUUsa0JBQWtCLFFBQVEsZUFBZTtBQUNsRSxTQUFTLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxRQUFRLGVBQWU7QUFDMUQsU0FBUyxRQUFRLFFBQVEsMEJBQTBCO0FBQ25ELFNBQVMsU0FBUyxRQUFRLG9CQUFvQjtBQUM5QyxTQUFTLFFBQVEsUUFBUSxtQkFBbUI7QUFDNUMsU0FDRSxVQUFVLEVBQ1Ysb0JBQW9CLEVBQ3BCLHFCQUFxQixFQUNyQixrQkFBa0IsUUFDYixjQUFjO0FBQ3JCLFNBQVMsU0FBUyxRQUFRLGtDQUFrQztBQUM1RCxTQUFTLE1BQU0sUUFBUSxlQUFlO0FBQ3RDLFNBQVMsY0FBYyxRQUFRLGNBQWM7QUFFN0MsU0FBUyxPQUFPLFFBQVEsNEJBQTRCO0FBQ3BELFNBQ0UsT0FBTyxFQUNQLGVBQWUsRUFDZixjQUFjLEVBQ2QsY0FBYyxRQUNULG1CQUFtQjtBQUMxQixTQUNFLFlBQVksRUFDWixvQkFBb0Is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