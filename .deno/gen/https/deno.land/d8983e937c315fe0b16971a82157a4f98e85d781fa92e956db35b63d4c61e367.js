// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * Command line arguments parser based on
 * [minimist](https://github.com/minimistjs/minimist).
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
 *
 * console.dir(parse(Deno.args));
 * ```
 *
 * ```sh
 * $ deno run https://deno.land/std/examples/flags.ts -a beep -b boop
 * { _: [], a: 'beep', b: 'boop' }
 * ```
 *
 * ```sh
 * $ deno run https://deno.land/std/examples/flags.ts -x 3 -y 4 -n5 -abc --beep=boop foo bar baz
 * { _: [ 'foo', 'bar', 'baz' ],
 *   x: 3,
 *   y: 4,
 *   n: 5,
 *   a: true,
 *   b: true,
 *   c: true,
 *   beep: 'boop' }
 * ```
 *
 * @module
 */ import { assert } from "../_util/asserts.ts";
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {};
    });
    const key = keys[keys.length - 1];
    return hasOwn(o, key);
}
/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * By default, the flags module tries to determine the type of all arguments
 * automatically and the return type of the `parse` method will have an index
 * signature with `any` as value (`{ [x: string]: any }`).
 *
 * If the `string`, `boolean` or `collect` option is set, the return value of
 * the `parse` method will be fully typed and the index signature of the return
 * type will change to `{ [x: string]: unknown }`.
 *
 * Any arguments after `'--'` will not be parsed and will end up in `parsedArgs._`.
 *
 * Numeric-looking arguments will be returned as numbers unless `options.string`
 * or `options.boolean` is set for that argument name.
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
 * const parsedArgs = parse(Deno.args);
 * ```
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
 * const parsedArgs = parse(["--foo", "--bar=baz", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", _: ["./quux.txt"] }
 * ```
 */ export function parse(args, { "--": doubleDash = false , alias ={} , boolean =false , default: defaults = {} , stopEarly =false , string =[] , collect =[] , negatable =[] , unknown =(i)=>i  } = {}) {
    const aliases = {};
    const flags = {
        bools: {},
        strings: {},
        unknownFn: unknown,
        allBools: false,
        collect: {},
        negatable: {}
    };
    if (alias !== undefined) {
        for(const key in alias){
            const val = getForce(alias, key);
            if (typeof val === "string") {
                aliases[key] = [
                    val
                ];
            } else {
                aliases[key] = val;
            }
            for (const alias1 of getForce(aliases, key)){
                aliases[alias1] = [
                    key
                ].concat(aliases[key].filter((y)=>alias1 !== y));
            }
        }
    }
    if (boolean !== undefined) {
        if (typeof boolean === "boolean") {
            flags.allBools = !!boolean;
        } else {
            const booleanArgs = typeof boolean === "string" ? [
                boolean
            ] : boolean;
            for (const key1 of booleanArgs.filter(Boolean)){
                flags.bools[key1] = true;
                const alias2 = get(aliases, key1);
                if (alias2) {
                    for (const al of alias2){
                        flags.bools[al] = true;
                    }
                }
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key2 of stringArgs.filter(Boolean)){
            flags.strings[key2] = true;
            const alias3 = get(aliases, key2);
            if (alias3) {
                for (const al1 of alias3){
                    flags.strings[al1] = true;
                }
            }
        }
    }
    if (collect !== undefined) {
        const collectArgs = typeof collect === "string" ? [
            collect
        ] : collect;
        for (const key3 of collectArgs.filter(Boolean)){
            flags.collect[key3] = true;
            const alias4 = get(aliases, key3);
            if (alias4) {
                for (const al2 of alias4){
                    flags.collect[al2] = true;
                }
            }
        }
    }
    if (negatable !== undefined) {
        const negatableArgs = typeof negatable === "string" ? [
            negatable
        ] : negatable;
        for (const key4 of negatableArgs.filter(Boolean)){
            flags.negatable[key4] = true;
            const alias5 = get(aliases, key4);
            if (alias5) {
                for (const al3 of alias5){
                    flags.negatable[al3] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, name, value, collect = true) {
        let o = obj;
        const keys = name.split(".");
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {};
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        const collectable = collect && !!get(flags.collect, name);
        if (!collectable) {
            o[key] = value;
        } else if (get(o, key) === undefined) {
            o[key] = [
                value
            ];
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined, collect) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key, value, collect);
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
                setKey(argv, x, value, collect);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean");
    }
    let notFlags = [];
    // all args after "--" are not parsed
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key5, value] = m;
            if (flags.bools[key5]) {
                const booleanValue = value !== "false";
                setArg(key5, booleanValue, arg);
            } else {
                setArg(key5, value, arg);
            }
        } else if (/^--no-.+/.test(arg) && get(flags.negatable, arg.replace(/^--no-/, ""))) {
            const m1 = arg.match(/^--no-(.+)/);
            assert(m1 != null);
            setArg(m1[1], false, arg, false);
        } else if (/^--.+/.test(arg)) {
            const m2 = arg.match(/^--(.+)/);
            assert(m2 != null);
            const [, key6] = m2;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key6) && !flags.allBools && (get(aliases, key6) ? !aliasIsBoolean(key6) : true)) {
                setArg(key6, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key6, next === "true", arg);
                i++;
            } else {
                setArg(key6, get(flags.strings, key6) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next1 = arg.slice(j + 2);
                if (next1 === "-") {
                    setArg(letters[j], next1, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next1)) {
                    setArg(letters[j], next1.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next1)) {
                    setArg(letters[j], next1, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key7] = arg.slice(-1);
            if (!broken && key7 !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key7) && (get(aliases, key7) ? !aliasIsBoolean(key7) : true)) {
                    setArg(key7, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key7, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key7, get(flags.strings, key7) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const [key8, value1] of Object.entries(defaults)){
        if (!hasKey(argv, key8.split("."))) {
            setKey(argv, key8, value1);
            if (aliases[key8]) {
                for (const x of aliases[key8]){
                    setKey(argv, x, value1);
                }
            }
        }
    }
    for (const key9 of Object.keys(flags.bools)){
        if (!hasKey(argv, key9.split("."))) {
            const value2 = get(flags.collect, key9) ? [] : false;
            setKey(argv, key9, value2, false);
        }
    }
    for (const key10 of Object.keys(flags.strings)){
        if (!hasKey(argv, key10.split(".")) && get(flags.collect, key10)) {
            setKey(argv, key10, [], false);
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key11 of notFlags){
            argv["--"].push(key11);
        }
    } else {
        for (const key12 of notFlags){
            argv._.push(key12);
        }
    }
    return argv;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2ZsYWdzL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqXG4gKiBDb21tYW5kIGxpbmUgYXJndW1lbnRzIHBhcnNlciBiYXNlZCBvblxuICogW21pbmltaXN0XShodHRwczovL2dpdGh1Yi5jb20vbWluaW1pc3Rqcy9taW5pbWlzdCkuXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9mbGFncy9tb2QudHNcIjtcbiAqXG4gKiBjb25zb2xlLmRpcihwYXJzZShEZW5vLmFyZ3MpKTtcbiAqIGBgYFxuICpcbiAqIGBgYHNoXG4gKiAkIGRlbm8gcnVuIGh0dHBzOi8vZGVuby5sYW5kL3N0ZC9leGFtcGxlcy9mbGFncy50cyAtYSBiZWVwIC1iIGJvb3BcbiAqIHsgXzogW10sIGE6ICdiZWVwJywgYjogJ2Jvb3AnIH1cbiAqIGBgYFxuICpcbiAqIGBgYHNoXG4gKiAkIGRlbm8gcnVuIGh0dHBzOi8vZGVuby5sYW5kL3N0ZC9leGFtcGxlcy9mbGFncy50cyAteCAzIC15IDQgLW41IC1hYmMgLS1iZWVwPWJvb3AgZm9vIGJhciBiYXpcbiAqIHsgXzogWyAnZm9vJywgJ2JhcicsICdiYXonIF0sXG4gKiAgIHg6IDMsXG4gKiAgIHk6IDQsXG4gKiAgIG46IDUsXG4gKiAgIGE6IHRydWUsXG4gKiAgIGI6IHRydWUsXG4gKiAgIGM6IHRydWUsXG4gKiAgIGJlZXA6ICdib29wJyB9XG4gKiBgYGBcbiAqXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9fdXRpbC9hc3NlcnRzLnRzXCI7XG5cbi8qKiBDb21iaW5lcyByZWN1cnNpdmVseSBhbGwgaW50ZXJzZWN0aW9uIHR5cGVzIGFuZCByZXR1cm5zIGEgbmV3IHNpbmdsZSB0eXBlLiAqL1xudHlwZSBJZDxUPiA9IFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICA/IFQgZXh0ZW5kcyBpbmZlciBVID8geyBbSyBpbiBrZXlvZiBVXTogSWQ8VVtLXT4gfSA6IG5ldmVyXG4gIDogVDtcblxuLyoqIENvbnZlcnRzIGFuIHVuaW9uIHR5cGUgYEEgfCBCIHwgQ2AgaW50byBhbiBpbnRlcnNlY3Rpb24gdHlwZSBgQSAmIEIgJiBDYC4gKi9cbnR5cGUgVW5pb25Ub0ludGVyc2VjdGlvbjxUPiA9XG4gIChUIGV4dGVuZHMgdW5rbm93biA/IChhcmdzOiBUKSA9PiB1bmtub3duIDogbmV2ZXIpIGV4dGVuZHNcbiAgICAoYXJnczogaW5mZXIgUikgPT4gdW5rbm93biA/IFIgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA/IFIgOiBuZXZlclxuICAgIDogbmV2ZXI7XG5cbnR5cGUgQm9vbGVhblR5cGUgPSBib29sZWFuIHwgc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBTdHJpbmdUeXBlID0gc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBBcmdUeXBlID0gU3RyaW5nVHlwZSB8IEJvb2xlYW5UeXBlO1xuXG50eXBlIENvbGxlY3RhYmxlID0gc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBOZWdhdGFibGUgPSBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbnR5cGUgVXNlVHlwZXM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSxcbiAgUyBleHRlbmRzIFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSxcbj4gPSB1bmRlZmluZWQgZXh0ZW5kcyAoXG4gICYgKGZhbHNlIGV4dGVuZHMgQiA/IHVuZGVmaW5lZCA6IEIpXG4gICYgQ1xuICAmIFNcbikgPyBmYWxzZVxuICA6IHRydWU7XG5cbi8qKlxuICogQ3JlYXRlcyBhIHJlY29yZCB3aXRoIGFsbCBhdmFpbGFibGUgZmxhZ3Mgd2l0aCB0aGUgY29ycmVzcG9uZGluZyB0eXBlIGFuZFxuICogZGVmYXVsdCB0eXBlLlxuICovXG50eXBlIFZhbHVlczxcbiAgQiBleHRlbmRzIEJvb2xlYW5UeXBlLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSxcbiAgQyBleHRlbmRzIENvbGxlY3RhYmxlLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzIHwgdW5kZWZpbmVkLFxuPiA9IFVzZVR5cGVzPEIsIFMsIEM+IGV4dGVuZHMgdHJ1ZSA/IFxuICAgICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICAmIEFkZEFsaWFzZXM8XG4gICAgICBTcHJlYWREZWZhdWx0czxcbiAgICAgICAgJiBDb2xsZWN0VmFsdWVzPFMsIHN0cmluZywgQywgTj5cbiAgICAgICAgJiBSZWN1cnNpdmVSZXF1aXJlZDxDb2xsZWN0VmFsdWVzPEIsIGJvb2xlYW4sIEM+PlxuICAgICAgICAmIENvbGxlY3RVbmtub3duVmFsdWVzPEIsIFMsIEMsIE4+LFxuICAgICAgICBEZWRvdFJlY29yZDxEPlxuICAgICAgPixcbiAgICAgIEFcbiAgICA+XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIDogUmVjb3JkPHN0cmluZywgYW55PjtcblxudHlwZSBBbGlhc2VzPFQgPSBzdHJpbmcsIFYgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmc+ID0gUGFydGlhbDxcbiAgUmVjb3JkPEV4dHJhY3Q8VCwgc3RyaW5nPiwgViB8IFJlYWRvbmx5QXJyYXk8Vj4+XG4+O1xuXG50eXBlIEFkZEFsaWFzZXM8XG4gIFQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzIHwgdW5kZWZpbmVkLFxuPiA9IHsgW0sgaW4ga2V5b2YgVCBhcyBBbGlhc05hbWU8SywgQT5dOiBUW0tdIH07XG5cbnR5cGUgQWxpYXNOYW1lPFxuICBLLFxuICBBIGV4dGVuZHMgQWxpYXNlcyB8IHVuZGVmaW5lZCxcbj4gPSBLIGV4dGVuZHMga2V5b2YgQVxuICA/IHN0cmluZyBleHRlbmRzIEFbS10gPyBLIDogQVtLXSBleHRlbmRzIHN0cmluZyA/IEsgfCBBW0tdIDogS1xuICA6IEs7XG5cbi8qKlxuICogU3ByZWFkcyBhbGwgZGVmYXVsdCB2YWx1ZXMgb2YgUmVjb3JkIGBEYCBpbnRvIFJlY29yZCBgQWBcbiAqIGFuZCBtYWtlcyBkZWZhdWx0IHZhbHVlcyByZXF1aXJlZC5cbiAqXG4gKiAqKkV4YW1wbGU6KipcbiAqIGBTcHJlYWRWYWx1ZXM8eyBmb28/OiBib29sZWFuLCBiYXI/OiBudW1iZXIgfSwgeyBmb286IG51bWJlciB9PmBcbiAqXG4gKiAqKlJlc3VsdDoqKiBgeyBmb286IGJvb2xhbiB8IG51bWJlciwgYmFyPzogbnVtYmVyIH1gXG4gKi9cbnR5cGUgU3ByZWFkRGVmYXVsdHM8QSwgRD4gPSBEIGV4dGVuZHMgdW5kZWZpbmVkID8gQVxuICA6IEEgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA/IFxuICAgICAgJiBPbWl0PEEsIGtleW9mIEQ+XG4gICAgICAmIHtcbiAgICAgICAgW0sgaW4ga2V5b2YgRF06IEsgZXh0ZW5kcyBrZXlvZiBBXG4gICAgICAgICAgPyAoQVtLXSAmIERbS10gfCBEW0tdKSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgICAgICAgICA/IE5vbk51bGxhYmxlPFNwcmVhZERlZmF1bHRzPEFbS10sIERbS10+PlxuICAgICAgICAgIDogRFtLXSB8IE5vbk51bGxhYmxlPEFbS10+XG4gICAgICAgICAgOiB1bmtub3duO1xuICAgICAgfVxuICA6IG5ldmVyO1xuXG4vKipcbiAqIERlZmluZXMgdGhlIFJlY29yZCBmb3IgdGhlIGBkZWZhdWx0YCBvcHRpb24gdG8gYWRkXG4gKiBhdXRvIHN1Z2dlc3Rpb24gc3VwcG9ydCBmb3IgSURFJ3MuXG4gKi9cbnR5cGUgRGVmYXVsdHM8QiBleHRlbmRzIEJvb2xlYW5UeXBlLCBTIGV4dGVuZHMgU3RyaW5nVHlwZT4gPSBJZDxcbiAgVW5pb25Ub0ludGVyc2VjdGlvbjxcbiAgICAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgLy8gRGVkb3R0ZWQgYXV0byBzdWdnZXN0aW9uczogeyBmb286IHsgYmFyOiB1bmtub3duIH0gfVxuICAgICYgTWFwVHlwZXM8UywgdW5rbm93bj5cbiAgICAmIE1hcFR5cGVzPEIsIHVua25vd24+XG4gICAgLy8gRmxhdCBhdXRvIHN1Z2dlc3Rpb25zOiB7IFwiZm9vLmJhclwiOiB1bmtub3duIH1cbiAgICAmIE1hcERlZmF1bHRzPEI+XG4gICAgJiBNYXBEZWZhdWx0czxTPlxuICA+XG4+O1xuXG50eXBlIE1hcERlZmF1bHRzPFQgZXh0ZW5kcyBBcmdUeXBlPiA9IFBhcnRpYWw8XG4gIFJlY29yZDxUIGV4dGVuZHMgc3RyaW5nID8gVCA6IHN0cmluZywgdW5rbm93bj5cbj47XG5cbnR5cGUgUmVjdXJzaXZlUmVxdWlyZWQ8VD4gPSBUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPyB7XG4gICAgW0sgaW4ga2V5b2YgVF0tPzogUmVjdXJzaXZlUmVxdWlyZWQ8VFtLXT47XG4gIH1cbiAgOiBUO1xuXG4vKiogU2FtZSBhcyBgTWFwVHlwZXNgIGJ1dCBhbHNvIHN1cHBvcnRzIGNvbGxlY3RhYmxlIG9wdGlvbnMuICovXG50eXBlIENvbGxlY3RWYWx1ZXM8XG4gIFQgZXh0ZW5kcyBBcmdUeXBlLFxuICBWLFxuICBDIGV4dGVuZHMgQ29sbGVjdGFibGUsXG4gIE4gZXh0ZW5kcyBOZWdhdGFibGUgPSB1bmRlZmluZWQsXG4+ID0gVW5pb25Ub0ludGVyc2VjdGlvbjxcbiAgQyBleHRlbmRzIHN0cmluZyA/IFxuICAgICAgJiBNYXBUeXBlczxFeGNsdWRlPFQsIEM+LCBWLCBOPlxuICAgICAgJiAoVCBleHRlbmRzIHVuZGVmaW5lZCA/IFJlY29yZDxuZXZlciwgbmV2ZXI+IDogUmVjdXJzaXZlUmVxdWlyZWQ8XG4gICAgICAgIE1hcFR5cGVzPEV4dHJhY3Q8QywgVD4sIEFycmF5PFY+LCBOPlxuICAgICAgPilcbiAgICA6IE1hcFR5cGVzPFQsIFYsIE4+XG4+O1xuXG4vKiogU2FtZSBhcyBgUmVjb3JkYCBidXQgYWxzbyBzdXBwb3J0cyBkb3R0ZWQgYW5kIG5lZ2F0YWJsZSBvcHRpb25zLiAqL1xudHlwZSBNYXBUeXBlczxUIGV4dGVuZHMgQXJnVHlwZSwgViwgTiBleHRlbmRzIE5lZ2F0YWJsZSA9IHVuZGVmaW5lZD4gPVxuICB1bmRlZmluZWQgZXh0ZW5kcyBUID8gUmVjb3JkPG5ldmVyLCBuZXZlcj5cbiAgICA6IFQgZXh0ZW5kcyBgJHtpbmZlciBOYW1lfS4ke2luZmVyIFJlc3R9YCA/IHtcbiAgICAgICAgW0sgaW4gTmFtZV0/OiBNYXBUeXBlczxcbiAgICAgICAgICBSZXN0LFxuICAgICAgICAgIFYsXG4gICAgICAgICAgTiBleHRlbmRzIGAke05hbWV9LiR7aW5mZXIgTmVnYXRlfWAgPyBOZWdhdGUgOiB1bmRlZmluZWRcbiAgICAgICAgPjtcbiAgICAgIH1cbiAgICA6IFQgZXh0ZW5kcyBzdHJpbmcgPyBQYXJ0aWFsPFJlY29yZDxULCBOIGV4dGVuZHMgVCA/IFYgfCBmYWxzZSA6IFY+PlxuICAgIDogUmVjb3JkPG5ldmVyLCBuZXZlcj47XG5cbnR5cGUgQ29sbGVjdFVua25vd25WYWx1ZXM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSxcbiAgUyBleHRlbmRzIFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSxcbiAgTiBleHRlbmRzIE5lZ2F0YWJsZSxcbj4gPSBCICYgUyBleHRlbmRzIEMgPyBSZWNvcmQ8bmV2ZXIsIG5ldmVyPlxuICA6IERlZG90UmVjb3JkPFxuICAgIC8vIFVua25vd24gY29sbGVjdGFibGUgJiBub24tbmVnYXRhYmxlIGFyZ3MuXG4gICAgJiBSZWNvcmQ8XG4gICAgICBFeGNsdWRlPFxuICAgICAgICBFeHRyYWN0PEV4Y2x1ZGU8QywgTj4sIHN0cmluZz4sXG4gICAgICAgIEV4dHJhY3Q8UyB8IEIsIHN0cmluZz5cbiAgICAgID4sXG4gICAgICBBcnJheTx1bmtub3duPlxuICAgID5cbiAgICAvLyBVbmtub3duIGNvbGxlY3RhYmxlICYgbmVnYXRhYmxlIGFyZ3MuXG4gICAgJiBSZWNvcmQ8XG4gICAgICBFeGNsdWRlPFxuICAgICAgICBFeHRyYWN0PEV4dHJhY3Q8QywgTj4sIHN0cmluZz4sXG4gICAgICAgIEV4dHJhY3Q8UyB8IEIsIHN0cmluZz5cbiAgICAgID4sXG4gICAgICBBcnJheTx1bmtub3duPiB8IGZhbHNlXG4gICAgPlxuICA+O1xuXG4vKiogQ29udmVydHMgYHsgXCJmb28uYmFyLmJhelwiOiB1bmtub3duIH1gIGludG8gYHsgZm9vOiB7IGJhcjogeyBiYXo6IHVua25vd24gfSB9IH1gLiAqL1xudHlwZSBEZWRvdFJlY29yZDxUPiA9IFJlY29yZDxzdHJpbmcsIHVua25vd24+IGV4dGVuZHMgVCA/IFRcbiAgOiBUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPyBVbmlvblRvSW50ZXJzZWN0aW9uPFxuICAgICAgVmFsdWVPZjxcbiAgICAgICAgeyBbSyBpbiBrZXlvZiBUXTogSyBleHRlbmRzIHN0cmluZyA/IERlZG90PEssIFRbS10+IDogbmV2ZXIgfVxuICAgICAgPlxuICAgID5cbiAgOiBUO1xuXG50eXBlIERlZG90PFQgZXh0ZW5kcyBzdHJpbmcsIFY+ID0gVCBleHRlbmRzIGAke2luZmVyIE5hbWV9LiR7aW5mZXIgUmVzdH1gXG4gID8geyBbSyBpbiBOYW1lXTogRGVkb3Q8UmVzdCwgVj4gfVxuICA6IHsgW0sgaW4gVF06IFYgfTtcblxudHlwZSBWYWx1ZU9mPFQ+ID0gVFtrZXlvZiBUXTtcblxuLyoqIFRoZSB2YWx1ZSByZXR1cm5lZCBmcm9tIGBwYXJzZWAuICovXG5leHBvcnQgdHlwZSBBcmdzPFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBBIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICBERCBleHRlbmRzIGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4+ID0gSWQ8XG4gICYgQVxuICAmIHtcbiAgICAvKiogQ29udGFpbnMgYWxsIHRoZSBhcmd1bWVudHMgdGhhdCBkaWRuJ3QgaGF2ZSBhbiBvcHRpb24gYXNzb2NpYXRlZCB3aXRoXG4gICAgICogdGhlbS4gKi9cbiAgICBfOiBBcnJheTxzdHJpbmcgfCBudW1iZXI+O1xuICB9XG4gICYgKGJvb2xlYW4gZXh0ZW5kcyBERCA/IERvdWJsZURhc2hcbiAgICA6IHRydWUgZXh0ZW5kcyBERCA/IFJlcXVpcmVkPERvdWJsZURhc2g+XG4gICAgOiBSZWNvcmQ8bmV2ZXIsIG5ldmVyPilcbj47XG5cbnR5cGUgRG91YmxlRGFzaCA9IHtcbiAgLyoqIENvbnRhaW5zIGFsbCB0aGUgYXJndW1lbnRzIHRoYXQgYXBwZWFyIGFmdGVyIHRoZSBkb3VibGUgZGFzaDogXCItLVwiLiAqL1xuICBcIi0tXCI/OiBBcnJheTxzdHJpbmc+O1xufTtcblxuLyoqIFRoZSBvcHRpb25zIGZvciB0aGUgYHBhcnNlYCBjYWxsLiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZU9wdGlvbnM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSA9IEJvb2xlYW5UeXBlLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSA9IFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSA9IENvbGxlY3RhYmxlLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlID0gTmVnYXRhYmxlLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgPVxuICAgIHwgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICB8IHVuZGVmaW5lZCxcbiAgQSBleHRlbmRzIEFsaWFzZXM8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkID1cbiAgICB8IEFsaWFzZXM8c3RyaW5nLCBzdHJpbmc+XG4gICAgfCB1bmRlZmluZWQsXG4gIEREIGV4dGVuZHMgYm9vbGVhbiB8IHVuZGVmaW5lZCA9IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4+IHtcbiAgLyoqXG4gICAqIFdoZW4gYHRydWVgLCBwb3B1bGF0ZSB0aGUgcmVzdWx0IGBfYCB3aXRoIGV2ZXJ5dGhpbmcgYmVmb3JlIHRoZSBgLS1gIGFuZFxuICAgKiB0aGUgcmVzdWx0IGBbJy0tJ11gIHdpdGggZXZlcnl0aGluZyBhZnRlciB0aGUgYC0tYC5cbiAgICpcbiAgICogQGRlZmF1bHQge2ZhbHNlfVxuICAgKlxuICAgKiAgQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogLy8gJCBkZW5vIHJ1biBleGFtcGxlLnRzIC0tIGEgYXJnMVxuICAgKiBpbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2ZsYWdzL21vZC50c1wiO1xuICAgKiBjb25zb2xlLmRpcihwYXJzZShEZW5vLmFyZ3MsIHsgXCItLVwiOiBmYWxzZSB9KSk7XG4gICAqIC8vIG91dHB1dDogeyBfOiBbIFwiYVwiLCBcImFyZzFcIiBdIH1cbiAgICogY29uc29sZS5kaXIocGFyc2UoRGVuby5hcmdzLCB7IFwiLS1cIjogdHJ1ZSB9KSk7XG4gICAqIC8vIG91dHB1dDogeyBfOiBbXSwgLS06IFsgXCJhXCIsIFwiYXJnMVwiIF0gfVxuICAgKiBgYGBcbiAgICovXG4gIFwiLS1cIj86IEREO1xuXG4gIC8qKlxuICAgKiBBbiBvYmplY3QgbWFwcGluZyBzdHJpbmcgbmFtZXMgdG8gc3RyaW5ncyBvciBhcnJheXMgb2Ygc3RyaW5nIGFyZ3VtZW50XG4gICAqIG5hbWVzIHRvIHVzZSBhcyBhbGlhc2VzLlxuICAgKi9cbiAgYWxpYXM/OiBBO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIHRvIGFsd2F5cyB0cmVhdCBhcyBib29sZWFucy4gSWZcbiAgICogYHRydWVgIHdpbGwgdHJlYXQgYWxsIGRvdWJsZSBoeXBoZW5hdGVkIGFyZ3VtZW50cyB3aXRob3V0IGVxdWFsIHNpZ25zIGFzXG4gICAqIGBib29sZWFuYCAoZS5nLiBhZmZlY3RzIGAtLWZvb2AsIG5vdCBgLWZgIG9yIGAtLWZvbz1iYXJgKS5cbiAgICogIEFsbCBgYm9vbGVhbmAgYXJndW1lbnRzIHdpbGwgYmUgc2V0IHRvIGBmYWxzZWAgYnkgZGVmYXVsdC5cbiAgICovXG4gIGJvb2xlYW4/OiBCIHwgUmVhZG9ubHlBcnJheTxFeHRyYWN0PEIsIHN0cmluZz4+O1xuXG4gIC8qKiBBbiBvYmplY3QgbWFwcGluZyBzdHJpbmcgYXJndW1lbnQgbmFtZXMgdG8gZGVmYXVsdCB2YWx1ZXMuICovXG4gIGRlZmF1bHQ/OiBEICYgRGVmYXVsdHM8QiwgUz47XG5cbiAgLyoqXG4gICAqIFdoZW4gYHRydWVgLCBwb3B1bGF0ZSB0aGUgcmVzdWx0IGBfYCB3aXRoIGV2ZXJ5dGhpbmcgYWZ0ZXIgdGhlIGZpcnN0XG4gICAqIG5vbi1vcHRpb24uXG4gICAqL1xuICBzdG9wRWFybHk/OiBib29sZWFuO1xuXG4gIC8qKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHRvIGFsd2F5cyB0cmVhdCBhcyBzdHJpbmdzLiAqL1xuICBzdHJpbmc/OiBTIHwgUmVhZG9ubHlBcnJheTxFeHRyYWN0PFMsIHN0cmluZz4+O1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHRvIGFsd2F5cyB0cmVhdCBhcyBhcnJheXMuXG4gICAqIENvbGxlY3RhYmxlIG9wdGlvbnMgY2FuIGJlIHVzZWQgbXVsdGlwbGUgdGltZXMuIEFsbCB2YWx1ZXMgd2lsbCBiZVxuICAgKiBjb2xsZWN0ZWQgaW50byBvbmUgYXJyYXkuIElmIGEgbm9uLWNvbGxlY3RhYmxlIG9wdGlvbiBpcyB1c2VkIG11bHRpcGxlXG4gICAqIHRpbWVzLCB0aGUgbGFzdCB2YWx1ZSBpcyB1c2VkLlxuICAgKiBBbGwgQ29sbGVjdGFibGUgYXJndW1lbnRzIHdpbGwgYmUgc2V0IHRvIGBbXWAgYnkgZGVmYXVsdC5cbiAgICovXG4gIGNvbGxlY3Q/OiBDIHwgUmVhZG9ubHlBcnJheTxFeHRyYWN0PEMsIHN0cmluZz4+O1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHdoaWNoIGNhbiBiZSBuZWdhdGVkXG4gICAqIGJ5IHByZWZpeGluZyB0aGVtIHdpdGggYC0tbm8tYCwgbGlrZSBgLS1uby1jb25maWdgLlxuICAgKi9cbiAgbmVnYXRhYmxlPzogTiB8IFJlYWRvbmx5QXJyYXk8RXh0cmFjdDxOLCBzdHJpbmc+PjtcblxuICAvKipcbiAgICogQSBmdW5jdGlvbiB3aGljaCBpcyBpbnZva2VkIHdpdGggYSBjb21tYW5kIGxpbmUgcGFyYW1ldGVyIG5vdCBkZWZpbmVkIGluXG4gICAqIHRoZSBgb3B0aW9uc2AgY29uZmlndXJhdGlvbiBvYmplY3QuIElmIHRoZSBmdW5jdGlvbiByZXR1cm5zIGBmYWxzZWAsIHRoZVxuICAgKiB1bmtub3duIG9wdGlvbiBpcyBub3QgYWRkZWQgdG8gYHBhcnNlZEFyZ3NgLlxuICAgKi9cbiAgdW5rbm93bj86IChhcmc6IHN0cmluZywga2V5Pzogc3RyaW5nLCB2YWx1ZT86IHVua25vd24pID0+IHVua25vd247XG59XG5cbmludGVyZmFjZSBGbGFncyB7XG4gIGJvb2xzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgc3RyaW5nczogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIGNvbGxlY3Q6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBuZWdhdGFibGU6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICB1bmtub3duRm46IChhcmc6IHN0cmluZywga2V5Pzogc3RyaW5nLCB2YWx1ZT86IHVua25vd24pID0+IHVua25vd247XG4gIGFsbEJvb2xzOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgTmVzdGVkTWFwcGluZyB7XG4gIFtrZXk6IHN0cmluZ106IE5lc3RlZE1hcHBpbmcgfCB1bmtub3duO1xufVxuXG5jb25zdCB7IGhhc093biB9ID0gT2JqZWN0O1xuXG5mdW5jdGlvbiBnZXQ8VD4ob2JqOiBSZWNvcmQ8c3RyaW5nLCBUPiwga2V5OiBzdHJpbmcpOiBUIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGhhc093bihvYmosIGtleSkpIHtcbiAgICByZXR1cm4gb2JqW2tleV07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Rm9yY2U8VD4ob2JqOiBSZWNvcmQ8c3RyaW5nLCBUPiwga2V5OiBzdHJpbmcpOiBUIHtcbiAgY29uc3QgdiA9IGdldChvYmosIGtleSk7XG4gIGFzc2VydCh2ICE9IG51bGwpO1xuICByZXR1cm4gdjtcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoeDogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHggPT09IFwibnVtYmVyXCIpIHJldHVybiB0cnVlO1xuICBpZiAoL14weFswLTlhLWZdKyQvaS50ZXN0KFN0cmluZyh4KSkpIHJldHVybiB0cnVlO1xuICByZXR1cm4gL15bLStdPyg/OlxcZCsoPzpcXC5cXGQqKT98XFwuXFxkKykoZVstK10/XFxkKyk/JC8udGVzdChTdHJpbmcoeCkpO1xufVxuXG5mdW5jdGlvbiBoYXNLZXkob2JqOiBOZXN0ZWRNYXBwaW5nLCBrZXlzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICBsZXQgbyA9IG9iajtcbiAga2V5cy5zbGljZSgwLCAtMSkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgbyA9IChnZXQobywga2V5KSA/PyB7fSkgYXMgTmVzdGVkTWFwcGluZztcbiAgfSk7XG5cbiAgY29uc3Qga2V5ID0ga2V5c1trZXlzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gaGFzT3duKG8sIGtleSk7XG59XG5cbi8qKiBUYWtlIGEgc2V0IG9mIGNvbW1hbmQgbGluZSBhcmd1bWVudHMsIG9wdGlvbmFsbHkgd2l0aCBhIHNldCBvZiBvcHRpb25zLCBhbmRcbiAqIHJldHVybiBhbiBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBmbGFncyBmb3VuZCBpbiB0aGUgcGFzc2VkIGFyZ3VtZW50cy5cbiAqXG4gKiBCeSBkZWZhdWx0LCBhbnkgYXJndW1lbnRzIHN0YXJ0aW5nIHdpdGggYC1gIG9yIGAtLWAgYXJlIGNvbnNpZGVyZWQgYm9vbGVhblxuICogZmxhZ3MuIElmIHRoZSBhcmd1bWVudCBuYW1lIGlzIGZvbGxvd2VkIGJ5IGFuIGVxdWFsIHNpZ24gKGA9YCkgaXQgaXNcbiAqIGNvbnNpZGVyZWQgYSBrZXktdmFsdWUgcGFpci4gQW55IGFyZ3VtZW50cyB3aGljaCBjb3VsZCBub3QgYmUgcGFyc2VkIGFyZVxuICogYXZhaWxhYmxlIGluIHRoZSBgX2AgcHJvcGVydHkgb2YgdGhlIHJldHVybmVkIG9iamVjdC5cbiAqXG4gKiBCeSBkZWZhdWx0LCB0aGUgZmxhZ3MgbW9kdWxlIHRyaWVzIHRvIGRldGVybWluZSB0aGUgdHlwZSBvZiBhbGwgYXJndW1lbnRzXG4gKiBhdXRvbWF0aWNhbGx5IGFuZCB0aGUgcmV0dXJuIHR5cGUgb2YgdGhlIGBwYXJzZWAgbWV0aG9kIHdpbGwgaGF2ZSBhbiBpbmRleFxuICogc2lnbmF0dXJlIHdpdGggYGFueWAgYXMgdmFsdWUgKGB7IFt4OiBzdHJpbmddOiBhbnkgfWApLlxuICpcbiAqIElmIHRoZSBgc3RyaW5nYCwgYGJvb2xlYW5gIG9yIGBjb2xsZWN0YCBvcHRpb24gaXMgc2V0LCB0aGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGUgYHBhcnNlYCBtZXRob2Qgd2lsbCBiZSBmdWxseSB0eXBlZCBhbmQgdGhlIGluZGV4IHNpZ25hdHVyZSBvZiB0aGUgcmV0dXJuXG4gKiB0eXBlIHdpbGwgY2hhbmdlIHRvIGB7IFt4OiBzdHJpbmddOiB1bmtub3duIH1gLlxuICpcbiAqIEFueSBhcmd1bWVudHMgYWZ0ZXIgYCctLSdgIHdpbGwgbm90IGJlIHBhcnNlZCBhbmQgd2lsbCBlbmQgdXAgaW4gYHBhcnNlZEFyZ3MuX2AuXG4gKlxuICogTnVtZXJpYy1sb29raW5nIGFyZ3VtZW50cyB3aWxsIGJlIHJldHVybmVkIGFzIG51bWJlcnMgdW5sZXNzIGBvcHRpb25zLnN0cmluZ2BcbiAqIG9yIGBvcHRpb25zLmJvb2xlYW5gIGlzIHNldCBmb3IgdGhhdCBhcmd1bWVudCBuYW1lLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9mbGFncy9tb2QudHNcIjtcbiAqIGNvbnN0IHBhcnNlZEFyZ3MgPSBwYXJzZShEZW5vLmFyZ3MpO1xuICogYGBgXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2ZsYWdzL21vZC50c1wiO1xuICogY29uc3QgcGFyc2VkQXJncyA9IHBhcnNlKFtcIi0tZm9vXCIsIFwiLS1iYXI9YmF6XCIsIFwiLi9xdXV4LnR4dFwiXSk7XG4gKiAvLyBwYXJzZWRBcmdzOiB7IGZvbzogdHJ1ZSwgYmFyOiBcImJhelwiLCBfOiBbXCIuL3F1dXgudHh0XCJdIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2U8XG4gIFYgZXh0ZW5kcyBWYWx1ZXM8QiwgUywgQywgTiwgRCwgQT4sXG4gIEREIGV4dGVuZHMgYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcbiAgQiBleHRlbmRzIEJvb2xlYW5UeXBlID0gdW5kZWZpbmVkLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSA9IHVuZGVmaW5lZCxcbiAgQyBleHRlbmRzIENvbGxlY3RhYmxlID0gdW5kZWZpbmVkLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlID0gdW5kZWZpbmVkLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzPEFLLCBBVj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gIEFLIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nLFxuICBBViBleHRlbmRzIHN0cmluZyA9IHN0cmluZyxcbj4oXG4gIGFyZ3M6IHN0cmluZ1tdLFxuICB7XG4gICAgXCItLVwiOiBkb3VibGVEYXNoID0gZmFsc2UsXG4gICAgYWxpYXMgPSB7fSBhcyBOb25OdWxsYWJsZTxBPixcbiAgICBib29sZWFuID0gZmFsc2UsXG4gICAgZGVmYXVsdDogZGVmYXVsdHMgPSB7fSBhcyBEICYgRGVmYXVsdHM8QiwgUz4sXG4gICAgc3RvcEVhcmx5ID0gZmFsc2UsXG4gICAgc3RyaW5nID0gW10sXG4gICAgY29sbGVjdCA9IFtdLFxuICAgIG5lZ2F0YWJsZSA9IFtdLFxuICAgIHVua25vd24gPSAoaTogc3RyaW5nKTogdW5rbm93biA9PiBpLFxuICB9OiBQYXJzZU9wdGlvbnM8QiwgUywgQywgTiwgRCwgQSwgREQ+ID0ge30sXG4pOiBBcmdzPFYsIEREPiB7XG4gIGNvbnN0IGFsaWFzZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHt9O1xuICBjb25zdCBmbGFnczogRmxhZ3MgPSB7XG4gICAgYm9vbHM6IHt9LFxuICAgIHN0cmluZ3M6IHt9LFxuICAgIHVua25vd25GbjogdW5rbm93bixcbiAgICBhbGxCb29sczogZmFsc2UsXG4gICAgY29sbGVjdDoge30sXG4gICAgbmVnYXRhYmxlOiB7fSxcbiAgfTtcblxuICBpZiAoYWxpYXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAoY29uc3Qga2V5IGluIGFsaWFzKSB7XG4gICAgICBjb25zdCB2YWwgPSBnZXRGb3JjZShhbGlhcywga2V5KTtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGFsaWFzZXNba2V5XSA9IFt2YWxdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWxpYXNlc1trZXldID0gdmFsIGFzIEFycmF5PHN0cmluZz47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGFsaWFzIG9mIGdldEZvcmNlKGFsaWFzZXMsIGtleSkpIHtcbiAgICAgICAgYWxpYXNlc1thbGlhc10gPSBba2V5XS5jb25jYXQoYWxpYXNlc1trZXldLmZpbHRlcigoeSkgPT4gYWxpYXMgIT09IHkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYm9vbGVhbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBib29sZWFuID09PSBcImJvb2xlYW5cIikge1xuICAgICAgZmxhZ3MuYWxsQm9vbHMgPSAhIWJvb2xlYW47XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGJvb2xlYW5BcmdzOiBSZWFkb25seUFycmF5PHN0cmluZz4gPSB0eXBlb2YgYm9vbGVhbiA9PT0gXCJzdHJpbmdcIlxuICAgICAgICA/IFtib29sZWFuXVxuICAgICAgICA6IGJvb2xlYW47XG5cbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIGJvb2xlYW5BcmdzLmZpbHRlcihCb29sZWFuKSkge1xuICAgICAgICBmbGFncy5ib29sc1trZXldID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgYWxpYXMgPSBnZXQoYWxpYXNlcywga2V5KTtcbiAgICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBhbCBvZiBhbGlhcykge1xuICAgICAgICAgICAgZmxhZ3MuYm9vbHNbYWxdID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoc3RyaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzdHJpbmdBcmdzOiBSZWFkb25seUFycmF5PHN0cmluZz4gPSB0eXBlb2Ygc3RyaW5nID09PSBcInN0cmluZ1wiXG4gICAgICA/IFtzdHJpbmddXG4gICAgICA6IHN0cmluZztcblxuICAgIGZvciAoY29uc3Qga2V5IG9mIHN0cmluZ0FyZ3MuZmlsdGVyKEJvb2xlYW4pKSB7XG4gICAgICBmbGFncy5zdHJpbmdzW2tleV0gPSB0cnVlO1xuICAgICAgY29uc3QgYWxpYXMgPSBnZXQoYWxpYXNlcywga2V5KTtcbiAgICAgIGlmIChhbGlhcykge1xuICAgICAgICBmb3IgKGNvbnN0IGFsIG9mIGFsaWFzKSB7XG4gICAgICAgICAgZmxhZ3Muc3RyaW5nc1thbF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGNvbGxlY3QgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGNvbGxlY3RBcmdzOiBSZWFkb25seUFycmF5PHN0cmluZz4gPSB0eXBlb2YgY29sbGVjdCA9PT0gXCJzdHJpbmdcIlxuICAgICAgPyBbY29sbGVjdF1cbiAgICAgIDogY29sbGVjdDtcblxuICAgIGZvciAoY29uc3Qga2V5IG9mIGNvbGxlY3RBcmdzLmZpbHRlcihCb29sZWFuKSkge1xuICAgICAgZmxhZ3MuY29sbGVjdFtrZXldID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGFsaWFzID0gZ2V0KGFsaWFzZXMsIGtleSk7XG4gICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBhbCBvZiBhbGlhcykge1xuICAgICAgICAgIGZsYWdzLmNvbGxlY3RbYWxdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZWdhdGFibGUgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG5lZ2F0YWJsZUFyZ3M6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPiA9IHR5cGVvZiBuZWdhdGFibGUgPT09IFwic3RyaW5nXCJcbiAgICAgID8gW25lZ2F0YWJsZV1cbiAgICAgIDogbmVnYXRhYmxlO1xuXG4gICAgZm9yIChjb25zdCBrZXkgb2YgbmVnYXRhYmxlQXJncy5maWx0ZXIoQm9vbGVhbikpIHtcbiAgICAgIGZsYWdzLm5lZ2F0YWJsZVtrZXldID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGFsaWFzID0gZ2V0KGFsaWFzZXMsIGtleSk7XG4gICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBhbCBvZiBhbGlhcykge1xuICAgICAgICAgIGZsYWdzLm5lZ2F0YWJsZVthbF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYXJndjogQXJncyA9IHsgXzogW10gfTtcblxuICBmdW5jdGlvbiBhcmdEZWZpbmVkKGtleTogc3RyaW5nLCBhcmc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAoXG4gICAgICAoZmxhZ3MuYWxsQm9vbHMgJiYgL14tLVtePV0rJC8udGVzdChhcmcpKSB8fFxuICAgICAgZ2V0KGZsYWdzLmJvb2xzLCBrZXkpIHx8XG4gICAgICAhIWdldChmbGFncy5zdHJpbmdzLCBrZXkpIHx8XG4gICAgICAhIWdldChhbGlhc2VzLCBrZXkpXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEtleShcbiAgICBvYmo6IE5lc3RlZE1hcHBpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHZhbHVlOiB1bmtub3duLFxuICAgIGNvbGxlY3QgPSB0cnVlLFxuICApIHtcbiAgICBsZXQgbyA9IG9iajtcbiAgICBjb25zdCBrZXlzID0gbmFtZS5zcGxpdChcIi5cIik7XG4gICAga2V5cy5zbGljZSgwLCAtMSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBpZiAoZ2V0KG8sIGtleSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvW2tleV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIG8gPSBnZXQobywga2V5KSBhcyBOZXN0ZWRNYXBwaW5nO1xuICAgIH0pO1xuXG4gICAgY29uc3Qga2V5ID0ga2V5c1trZXlzLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IGNvbGxlY3RhYmxlID0gY29sbGVjdCAmJiAhIWdldChmbGFncy5jb2xsZWN0LCBuYW1lKTtcblxuICAgIGlmICghY29sbGVjdGFibGUpIHtcbiAgICAgIG9ba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAoZ2V0KG8sIGtleSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgb1trZXldID0gW3ZhbHVlXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZ2V0KG8sIGtleSkpKSB7XG4gICAgICAob1trZXldIGFzIHVua25vd25bXSkucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ba2V5XSA9IFtnZXQobywga2V5KSwgdmFsdWVdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEFyZyhcbiAgICBrZXk6IHN0cmluZyxcbiAgICB2YWw6IHVua25vd24sXG4gICAgYXJnOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gICAgY29sbGVjdD86IGJvb2xlYW4sXG4gICkge1xuICAgIGlmIChhcmcgJiYgZmxhZ3MudW5rbm93bkZuICYmICFhcmdEZWZpbmVkKGtleSwgYXJnKSkge1xuICAgICAgaWYgKGZsYWdzLnVua25vd25GbihhcmcsIGtleSwgdmFsKSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZSA9ICFnZXQoZmxhZ3Muc3RyaW5ncywga2V5KSAmJiBpc051bWJlcih2YWwpID8gTnVtYmVyKHZhbCkgOiB2YWw7XG4gICAgc2V0S2V5KGFyZ3YsIGtleSwgdmFsdWUsIGNvbGxlY3QpO1xuXG4gICAgY29uc3QgYWxpYXMgPSBnZXQoYWxpYXNlcywga2V5KTtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIGZvciAoY29uc3QgeCBvZiBhbGlhcykge1xuICAgICAgICBzZXRLZXkoYXJndiwgeCwgdmFsdWUsIGNvbGxlY3QpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFsaWFzSXNCb29sZWFuKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGdldEZvcmNlKGFsaWFzZXMsIGtleSkuc29tZShcbiAgICAgICh4KSA9PiB0eXBlb2YgZ2V0KGZsYWdzLmJvb2xzLCB4KSA9PT0gXCJib29sZWFuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGxldCBub3RGbGFnczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBhbGwgYXJncyBhZnRlciBcIi0tXCIgYXJlIG5vdCBwYXJzZWRcbiAgaWYgKGFyZ3MuaW5jbHVkZXMoXCItLVwiKSkge1xuICAgIG5vdEZsYWdzID0gYXJncy5zbGljZShhcmdzLmluZGV4T2YoXCItLVwiKSArIDEpO1xuICAgIGFyZ3MgPSBhcmdzLnNsaWNlKDAsIGFyZ3MuaW5kZXhPZihcIi0tXCIpKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGFyZyA9IGFyZ3NbaV07XG5cbiAgICBpZiAoL14tLS4rPS8udGVzdChhcmcpKSB7XG4gICAgICBjb25zdCBtID0gYXJnLm1hdGNoKC9eLS0oW149XSspPSguKikkL3MpO1xuICAgICAgYXNzZXJ0KG0gIT0gbnVsbCk7XG4gICAgICBjb25zdCBbLCBrZXksIHZhbHVlXSA9IG07XG5cbiAgICAgIGlmIChmbGFncy5ib29sc1trZXldKSB7XG4gICAgICAgIGNvbnN0IGJvb2xlYW5WYWx1ZSA9IHZhbHVlICE9PSBcImZhbHNlXCI7XG4gICAgICAgIHNldEFyZyhrZXksIGJvb2xlYW5WYWx1ZSwgYXJnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEFyZyhrZXksIHZhbHVlLCBhcmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICAvXi0tbm8tLisvLnRlc3QoYXJnKSAmJiBnZXQoZmxhZ3MubmVnYXRhYmxlLCBhcmcucmVwbGFjZSgvXi0tbm8tLywgXCJcIikpXG4gICAgKSB7XG4gICAgICBjb25zdCBtID0gYXJnLm1hdGNoKC9eLS1uby0oLispLyk7XG4gICAgICBhc3NlcnQobSAhPSBudWxsKTtcbiAgICAgIHNldEFyZyhtWzFdLCBmYWxzZSwgYXJnLCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmICgvXi0tLisvLnRlc3QoYXJnKSkge1xuICAgICAgY29uc3QgbSA9IGFyZy5tYXRjaCgvXi0tKC4rKS8pO1xuICAgICAgYXNzZXJ0KG0gIT0gbnVsbCk7XG4gICAgICBjb25zdCBbLCBrZXldID0gbTtcbiAgICAgIGNvbnN0IG5leHQgPSBhcmdzW2kgKyAxXTtcbiAgICAgIGlmIChcbiAgICAgICAgbmV4dCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICEvXi0vLnRlc3QobmV4dCkgJiZcbiAgICAgICAgIWdldChmbGFncy5ib29scywga2V5KSAmJlxuICAgICAgICAhZmxhZ3MuYWxsQm9vbHMgJiZcbiAgICAgICAgKGdldChhbGlhc2VzLCBrZXkpID8gIWFsaWFzSXNCb29sZWFuKGtleSkgOiB0cnVlKVxuICAgICAgKSB7XG4gICAgICAgIHNldEFyZyhrZXksIG5leHQsIGFyZyk7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZiAoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KG5leHQpKSB7XG4gICAgICAgIHNldEFyZyhrZXksIG5leHQgPT09IFwidHJ1ZVwiLCBhcmcpO1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRBcmcoa2V5LCBnZXQoZmxhZ3Muc3RyaW5ncywga2V5KSA/IFwiXCIgOiB0cnVlLCBhcmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoL14tW14tXSsvLnRlc3QoYXJnKSkge1xuICAgICAgY29uc3QgbGV0dGVycyA9IGFyZy5zbGljZSgxLCAtMSkuc3BsaXQoXCJcIik7XG5cbiAgICAgIGxldCBicm9rZW4gPSBmYWxzZTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV0dGVycy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBuZXh0ID0gYXJnLnNsaWNlKGogKyAyKTtcblxuICAgICAgICBpZiAobmV4dCA9PT0gXCItXCIpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgbmV4dCwgYXJnKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvW0EtWmEtel0vLnRlc3QobGV0dGVyc1tqXSkgJiYgLz0vLnRlc3QobmV4dCkpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgbmV4dC5zcGxpdCgvPSguKykvKVsxXSwgYXJnKTtcbiAgICAgICAgICBicm9rZW4gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIC9bQS1aYS16XS8udGVzdChsZXR0ZXJzW2pdKSAmJlxuICAgICAgICAgIC8tP1xcZCsoXFwuXFxkKik/KGUtP1xcZCspPyQvLnRlc3QobmV4dClcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0QXJnKGxldHRlcnNbal0sIG5leHQsIGFyZyk7XG4gICAgICAgICAgYnJva2VuID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZXR0ZXJzW2ogKyAxXSAmJiBsZXR0ZXJzW2ogKyAxXS5tYXRjaCgvXFxXLykpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgYXJnLnNsaWNlKGogKyAyKSwgYXJnKTtcbiAgICAgICAgICBicm9rZW4gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldEFyZyhsZXR0ZXJzW2pdLCBnZXQoZmxhZ3Muc3RyaW5ncywgbGV0dGVyc1tqXSkgPyBcIlwiIDogdHJ1ZSwgYXJnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBba2V5XSA9IGFyZy5zbGljZSgtMSk7XG4gICAgICBpZiAoIWJyb2tlbiAmJiBrZXkgIT09IFwiLVwiKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBhcmdzW2kgKyAxXSAmJlxuICAgICAgICAgICEvXigtfC0tKVteLV0vLnRlc3QoYXJnc1tpICsgMV0pICYmXG4gICAgICAgICAgIWdldChmbGFncy5ib29scywga2V5KSAmJlxuICAgICAgICAgIChnZXQoYWxpYXNlcywga2V5KSA/ICFhbGlhc0lzQm9vbGVhbihrZXkpIDogdHJ1ZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0QXJnKGtleSwgYXJnc1tpICsgMV0sIGFyZyk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZ3NbaSArIDFdICYmIC9eKHRydWV8ZmFsc2UpJC8udGVzdChhcmdzW2kgKyAxXSkpIHtcbiAgICAgICAgICBzZXRBcmcoa2V5LCBhcmdzW2kgKyAxXSA9PT0gXCJ0cnVlXCIsIGFyZyk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldEFyZyhrZXksIGdldChmbGFncy5zdHJpbmdzLCBrZXkpID8gXCJcIiA6IHRydWUsIGFyZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFmbGFncy51bmtub3duRm4gfHwgZmxhZ3MudW5rbm93bkZuKGFyZykgIT09IGZhbHNlKSB7XG4gICAgICAgIGFyZ3YuXy5wdXNoKGZsYWdzLnN0cmluZ3NbXCJfXCJdID8/ICFpc051bWJlcihhcmcpID8gYXJnIDogTnVtYmVyKGFyZykpO1xuICAgICAgfVxuICAgICAgaWYgKHN0b3BFYXJseSkge1xuICAgICAgICBhcmd2Ll8ucHVzaCguLi5hcmdzLnNsaWNlKGkgKyAxKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRlZmF1bHRzKSkge1xuICAgIGlmICghaGFzS2V5KGFyZ3YsIGtleS5zcGxpdChcIi5cIikpKSB7XG4gICAgICBzZXRLZXkoYXJndiwga2V5LCB2YWx1ZSk7XG5cbiAgICAgIGlmIChhbGlhc2VzW2tleV0pIHtcbiAgICAgICAgZm9yIChjb25zdCB4IG9mIGFsaWFzZXNba2V5XSkge1xuICAgICAgICAgIHNldEtleShhcmd2LCB4LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhmbGFncy5ib29scykpIHtcbiAgICBpZiAoIWhhc0tleShhcmd2LCBrZXkuc3BsaXQoXCIuXCIpKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBnZXQoZmxhZ3MuY29sbGVjdCwga2V5KSA/IFtdIDogZmFsc2U7XG4gICAgICBzZXRLZXkoXG4gICAgICAgIGFyZ3YsXG4gICAgICAgIGtleSxcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIGZhbHNlLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhmbGFncy5zdHJpbmdzKSkge1xuICAgIGlmICghaGFzS2V5KGFyZ3YsIGtleS5zcGxpdChcIi5cIikpICYmIGdldChmbGFncy5jb2xsZWN0LCBrZXkpKSB7XG4gICAgICBzZXRLZXkoXG4gICAgICAgIGFyZ3YsXG4gICAgICAgIGtleSxcbiAgICAgICAgW10sXG4gICAgICAgIGZhbHNlLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZG91YmxlRGFzaCkge1xuICAgIGFyZ3ZbXCItLVwiXSA9IFtdO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIG5vdEZsYWdzKSB7XG4gICAgICBhcmd2W1wiLS1cIl0ucHVzaChrZXkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBub3RGbGFncykge1xuICAgICAgYXJndi5fLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJndiBhcyBBcmdzPFYsIEREPjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0ErQkMsR0FDRCxTQUFTLE1BQU0sUUFBUSxzQkFBc0I7QUE4UzdDLE1BQU0sRUFBRSxPQUFNLEVBQUUsR0FBRztBQUVuQixTQUFTLElBQU8sR0FBc0IsRUFBRSxHQUFXLEVBQWlCO0lBQ2xFLElBQUksT0FBTyxLQUFLLE1BQU07UUFDcEIsT0FB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