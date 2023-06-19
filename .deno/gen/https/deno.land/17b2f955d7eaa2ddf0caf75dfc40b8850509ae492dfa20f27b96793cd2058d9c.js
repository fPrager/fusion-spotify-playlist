// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** A library of assertion functions.
 * If the assertion is false an `AssertionError` will be thrown which will
 * result in pretty-printed diff of failing assertion.
 *
 * This module is browser compatible, but do not rely on good formatting of
 * values for AssertionError messages in browsers.
 *
 * @module
 */ import { red, stripColor } from "../fmt/colors.ts";
import { buildMessage, diff, diffstr } from "./_diff.ts";
import { format } from "./_format.ts";
const CAN_NOT_DISPLAY = "[Cannot display]";
export class AssertionError extends Error {
    name = "AssertionError";
    constructor(message){
        super(message);
    }
}
function isKeyedCollection(x) {
    return [
        Symbol.iterator,
        "size"
    ].every((k)=>k in x);
}
/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 */ export function equal(c, d) {
    const seen = new Map();
    return function compare(a, b) {
        // Have to render RegExp & Date for string comparison
        // unless it's mistreated as object
        if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
            return String(a) === String(b);
        }
        if (a instanceof Date && b instanceof Date) {
            const aTime = a.getTime();
            const bTime = b.getTime();
            // Check for NaN equality manually since NaN is not
            // equal to itself.
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
                return true;
            }
            return aTime === bTime;
        }
        if (typeof a === "number" && typeof b === "number") {
            return Number.isNaN(a) && Number.isNaN(b) || a === b;
        }
        if (Object.is(a, b)) {
            return true;
        }
        if (a && typeof a === "object" && b && typeof b === "object") {
            if (a && b && !constructorsEqual(a, b)) {
                return false;
            }
            if (a instanceof WeakMap || b instanceof WeakMap) {
                if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
                throw new TypeError("cannot compare WeakMap instances");
            }
            if (a instanceof WeakSet || b instanceof WeakSet) {
                if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
                throw new TypeError("cannot compare WeakSet instances");
            }
            if (seen.get(a) === b) {
                return true;
            }
            if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
                return false;
            }
            seen.set(a, b);
            if (isKeyedCollection(a) && isKeyedCollection(b)) {
                if (a.size !== b.size) {
                    return false;
                }
                let unmatchedEntries = a.size;
                for (const [aKey, aValue] of a.entries()){
                    for (const [bKey, bValue] of b.entries()){
                        /* Given that Map keys can be references, we need
             * to ensure that they are also deeply equal */ if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
                            unmatchedEntries--;
                            break;
                        }
                    }
                }
                return unmatchedEntries === 0;
            }
            const merged = {
                ...a,
                ...b
            };
            for (const key of [
                ...Object.getOwnPropertyNames(merged),
                ...Object.getOwnPropertySymbols(merged)
            ]){
                if (!compare(a && a[key], b && b[key])) {
                    return false;
                }
                if (key in a && !(key in b) || key in b && !(key in a)) {
                    return false;
                }
            }
            if (a instanceof WeakRef || b instanceof WeakRef) {
                if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
                return compare(a.deref(), b.deref());
            }
            return true;
        }
        return false;
    }(c, d);
}
// deno-lint-ignore ban-types
function constructorsEqual(a, b) {
    return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
/** Make an assertion, error will be thrown if `expr` does not have truthy value. */ export function assert(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
export function assertFalse(expr, msg = "") {
    if (expr) {
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 *
 * @example
 * ```ts
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * Deno.test("example", function (): void {
 *   assertEquals("world", "world");
 *   assertEquals({ hello: "world" }, { hello: "world" });
 * });
 * ```
 */ export function assertEquals(actual, expected, msg) {
    if (equal(actual, expected)) {
        return;
    }
    let message = "";
    const actualString = format(actual);
    const expectedString = format(expected);
    try {
        const stringDiff = typeof actual === "string" && typeof expected === "string";
        const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, {
            stringDiff
        }).join("\n");
        message = `Values are not equal:\n${diffMsg}`;
    } catch  {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
    }
    if (msg) {
        message = msg;
    }
    throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 *
 * @example
 * ```ts
 * import { assertNotEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotEquals<number>(1, 2)
 * ```
 */ export function assertNotEquals(actual, expected, msg) {
    if (!equal(actual, expected)) {
        return;
    }
    let actualString;
    let expectedString;
    try {
        actualString = String(actual);
    } catch  {
        actualString = "[Cannot display]";
    }
    try {
        expectedString = String(expected);
    } catch  {
        expectedString = "[Cannot display]";
    }
    if (!msg) {
        msg = `actual: ${actualString} expected not to be: ${expectedString}`;
    }
    throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * @example
 * ```ts
 * import { assertStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * Deno.test("isStrictlyEqual", function (): void {
 *   const a = {};
 *   const b = a;
 *   assertStrictEquals(a, b);
 * });
 *
 * // This test fails
 * Deno.test("isNotStrictlyEqual", function (): void {
 *   const a = {};
 *   const b = {};
 *   assertStrictEquals(a, b);
 * });
 * ```
 */ export function assertStrictEquals(actual, expected, msg) {
    if (Object.is(actual, expected)) {
        return;
    }
    let message;
    if (msg) {
        message = msg;
    } else {
        const actualString = format(actual);
        const expectedString = format(expected);
        if (actualString === expectedString) {
            const withOffset = actualString.split("\n").map((l)=>`    ${l}`).join("\n");
            message = `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
        } else {
            try {
                const stringDiff = typeof actual === "string" && typeof expected === "string";
                const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
                const diffMsg = buildMessage(diffResult, {
                    stringDiff
                }).join("\n");
                message = `Values are not strictly equal:\n${diffMsg}`;
            } catch  {
                message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
            }
        }
    }
    throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * ```ts
 * import { assertNotStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotStrictEquals(1, 1)
 * ```
 */ export function assertNotStrictEquals(actual, expected, msg) {
    if (!Object.is(actual, expected)) {
        return;
    }
    throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${format(actual)}\n`);
}
/**
 * Make an assertion that `actual` and `expected` are almost equal numbers through
 * a given tolerance. It can be used to take into account IEEE-754 double-precision
 * floating-point representation limitations.
 * If the values are not almost equal then throw.
 *
 * @example
 * ```ts
 * import { assertAlmostEquals, assertThrows } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertAlmostEquals(0.1, 0.2);
 *
 * // Using a custom tolerance value
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16);
 * assertThrows(() => assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17));
 * ```
 */ export function assertAlmostEquals(actual, expected, tolerance = 1e-7, msg) {
    if (Object.is(actual, expected)) {
        return;
    }
    const delta = Math.abs(expected - actual);
    if (delta <= tolerance) {
        return;
    }
    const f = (n)=>Number.isInteger(n) ? n : n.toExponential();
    throw new AssertionError(msg ?? `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`);
}
/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 */ export function assertInstanceOf(actual, expectedType, msg = "") {
    if (!msg) {
        const expectedTypeStr = expectedType.name;
        let actualTypeStr = "";
        if (actual === null) {
            actualTypeStr = "null";
        } else if (actual === undefined) {
            actualTypeStr = "undefined";
        } else if (typeof actual === "object") {
            actualTypeStr = actual.constructor?.name ?? "Object";
        } else {
            actualTypeStr = typeof actual;
        }
        if (expectedTypeStr == actualTypeStr) {
            msg = `Expected object to be an instance of "${expectedTypeStr}".`;
        } else if (actualTypeStr == "function") {
            msg = `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object.`;
        } else {
            msg = `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}".`;
        }
    }
    assert(actual instanceof expectedType, msg);
}
/**
 * Make an assertion that `obj` is not an instance of `type`.
 * If so, then throw.
 */ export function assertNotInstanceOf(actual, // deno-lint-ignore no-explicit-any
unexpectedType, msg = `Expected object to not be an instance of "${typeof unexpectedType}"`) {
    assertFalse(actual instanceof unexpectedType, msg);
}
/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 */ export function assertExists(actual, msg) {
    if (actual === undefined || actual === null) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not be null or undefined`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 */ export function assertStringIncludes(actual, expected, msg) {
    if (!actual.includes(expected)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to contain: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` includes the `expected` values.
 * If not then an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 *
 * @example
 * ```ts
 * import { assertArrayIncludes } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertArrayIncludes<number>([1, 2], [2])
 * ```
 */ export function assertArrayIncludes(actual, expected, msg) {
    const missing = [];
    for(let i = 0; i < expected.length; i++){
        let found = false;
        for(let j = 0; j < actual.length; j++){
            if (equal(expected[i], actual[j])) {
                found = true;
                break;
            }
        }
        if (!found) {
            missing.push(expected[i]);
        }
    }
    if (missing.length === 0) {
        return;
    }
    if (!msg) {
        msg = `actual: "${format(actual)}" expected to include: "${format(expected)}"\nmissing: ${format(missing)}`;
    }
    throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 */ export function assertMatch(actual, expected, msg) {
    if (!expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 */ export function assertNotMatch(actual, expected, msg) {
    if (expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` object is a subset of `expected` object, deeply.
 * If not, then throw.
 */ export function assertObjectMatch(// deno-lint-ignore no-explicit-any
actual, expected) {
    function filter(a, b) {
        const seen = new WeakMap();
        return fn(a, b);
        function fn(a, b) {
            // Prevent infinite loop with circular references with same filter
            if (seen.has(a) && seen.get(a) === b) {
                return a;
            }
            seen.set(a, b);
            // Filter keys and symbols which are present in both actual and expected
            const filtered = {};
            const entries = [
                ...Object.getOwnPropertyNames(a),
                ...Object.getOwnPropertySymbols(a)
            ].filter((key)=>key in b).map((key)=>[
                    key,
                    a[key]
                ]);
            for (const [key, value] of entries){
                // On array references, build a filtered array and filter nested objects inside
                if (Array.isArray(value)) {
                    const subset = b[key];
                    if (Array.isArray(subset)) {
                        filtered[key] = fn({
                            ...value
                        }, {
                            ...subset
                        });
                        continue;
                    }
                } else if (value instanceof RegExp) {
                    filtered[key] = value;
                    continue;
                } else if (typeof value === "object") {
                    const subset1 = b[key];
                    if (typeof subset1 === "object" && subset1) {
                        // When both operands are maps, build a filtered map with common keys and filter nested objects inside
                        if (value instanceof Map && subset1 instanceof Map) {
                            filtered[key] = new Map([
                                ...value
                            ].filter(([k])=>subset1.has(k)).map(([k, v])=>[
                                    k,
                                    typeof v === "object" ? fn(v, subset1.get(k)) : v
                                ]));
                            continue;
                        }
                        // When both operands are set, build a filtered set with common values
                        if (value instanceof Set && subset1 instanceof Set) {
                            filtered[key] = new Set([
                                ...value
                            ].filter((v)=>subset1.has(v)));
                            continue;
                        }
                        filtered[key] = fn(value, subset1);
                        continue;
                    }
                }
                filtered[key] = value;
            }
            return filtered;
        }
    }
    return assertEquals(// get the intersection of "actual" and "expected"
    // side effect: all the instances' constructor field is "Object" now.
    filter(actual, expected), // set (nested) instances' constructor field to be "Object" without changing expected value.
    // see https://github.com/denoland/deno_std/pull/1419
    filter(expected, expected));
}
/**
 * Forcefully throws a failed assertion
 */ export function fail(msg) {
    assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}
/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 */ export function assertIsError(error, // deno-lint-ignore no-explicit-any
ErrorClass, msgIncludes, msg) {
    if (error instanceof Error === false) {
        throw new AssertionError(`Expected "error" to be an Error object.`);
    }
    if (ErrorClass && !(error instanceof ErrorClass)) {
        msg = `Expected error to be instance of "${ErrorClass.name}", but was "${typeof error === "object" ? error?.constructor?.name : "[not an object]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
    if (msgIncludes && (!(error instanceof Error) || !stripColor(error.message).includes(stripColor(msgIncludes)))) {
        msg = `Expected error message to include "${msgIncludes}", but got "${error instanceof Error ? error.message : "[not an Error]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
}
export function assertThrows(fn, errorClassOrMsg, msgIncludesOrMsg, msg) {
    // deno-lint-ignore no-explicit-any
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let err;
    if (typeof errorClassOrMsg !== "string") {
        if (errorClassOrMsg === undefined || errorClassOrMsg.prototype instanceof Error || errorClassOrMsg.prototype === Error.prototype) {
            // deno-lint-ignore no-explicit-any
            ErrorClass = errorClassOrMsg;
            msgIncludes = msgIncludesOrMsg;
        } else {
            msg = msgIncludesOrMsg;
        }
    } else {
        msg = errorClassOrMsg;
    }
    let doesThrow = false;
    const msgToAppendToError = msg ? `: ${msg}` : ".";
    try {
        fn();
    } catch (error) {
        if (ErrorClass) {
            if (error instanceof Error === false) {
                throw new AssertionError("A non-Error object was thrown.");
            }
            assertIsError(error, ErrorClass, msgIncludes, msg);
        }
        err = error;
        doesThrow = true;
    }
    if (!doesThrow) {
        msg = `Expected function to throw${msgToAppendToError}`;
        throw new AssertionError(msg);
    }
    return err;
}
export async function assertRejects(fn, errorClassOrMsg, msgIncludesOrMsg, msg) {
    // deno-lint-ignore no-explicit-any
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let err;
    if (typeof errorClassOrMsg !== "string") {
        if (errorClassOrMsg === undefined || errorClassOrMsg.prototype instanceof Error || errorClassOrMsg.prototype === Error.prototype) {
            // deno-lint-ignore no-explicit-any
            ErrorClass = errorClassOrMsg;
            msgIncludes = msgIncludesOrMsg;
        }
    } else {
        msg = errorClassOrMsg;
    }
    let doesThrow = false;
    let isPromiseReturned = false;
    const msgToAppendToError = msg ? `: ${msg}` : ".";
    try {
        const possiblePromise = fn();
        if (possiblePromise && typeof possiblePromise === "object" && typeof possiblePromise.then === "function") {
            isPromiseReturned = true;
            await possiblePromise;
        }
    } catch (error) {
        if (!isPromiseReturned) {
            throw new AssertionError(`Function throws when expected to reject${msgToAppendToError}`);
        }
        if (ErrorClass) {
            if (error instanceof Error === false) {
                throw new AssertionError("A non-Error object was rejected.");
            }
            assertIsError(error, ErrorClass, msgIncludes, msg);
        }
        err = error;
        doesThrow = true;
    }
    if (!doesThrow) {
        throw new AssertionError(`Expected function to reject${msgToAppendToError}`);
    }
    return err;
}
/** Use this to stub out methods that will throw when invoked. */ export function unimplemented(msg) {
    throw new AssertionError(msg || "unimplemented");
}
/** Use this to assert unreachable code. */ export function unreachable() {
    throw new AssertionError("unreachable");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL3Rlc3RpbmcvYXNzZXJ0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKiogQSBsaWJyYXJ5IG9mIGFzc2VydGlvbiBmdW5jdGlvbnMuXG4gKiBJZiB0aGUgYXNzZXJ0aW9uIGlzIGZhbHNlIGFuIGBBc3NlcnRpb25FcnJvcmAgd2lsbCBiZSB0aHJvd24gd2hpY2ggd2lsbFxuICogcmVzdWx0IGluIHByZXR0eS1wcmludGVkIGRpZmYgb2YgZmFpbGluZyBhc3NlcnRpb24uXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLCBidXQgZG8gbm90IHJlbHkgb24gZ29vZCBmb3JtYXR0aW5nIG9mXG4gKiB2YWx1ZXMgZm9yIEFzc2VydGlvbkVycm9yIG1lc3NhZ2VzIGluIGJyb3dzZXJzLlxuICpcbiAqIEBtb2R1bGVcbiAqL1xuXG5pbXBvcnQgeyByZWQsIHN0cmlwQ29sb3IgfSBmcm9tIFwiLi4vZm10L2NvbG9ycy50c1wiO1xuaW1wb3J0IHsgYnVpbGRNZXNzYWdlLCBkaWZmLCBkaWZmc3RyIH0gZnJvbSBcIi4vX2RpZmYudHNcIjtcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gXCIuL19mb3JtYXQudHNcIjtcblxuY29uc3QgQ0FOX05PVF9ESVNQTEFZID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiQXNzZXJ0aW9uRXJyb3JcIjtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNLZXllZENvbGxlY3Rpb24oeDogdW5rbm93bik6IHggaXMgU2V0PHVua25vd24+IHtcbiAgcmV0dXJuIFtTeW1ib2wuaXRlcmF0b3IsIFwic2l6ZVwiXS5ldmVyeSgoaykgPT4gayBpbiAoeCBhcyBTZXQ8dW5rbm93bj4pKTtcbn1cblxuLyoqXG4gKiBEZWVwIGVxdWFsaXR5IGNvbXBhcmlzb24gdXNlZCBpbiBhc3NlcnRpb25zXG4gKiBAcGFyYW0gYyBhY3R1YWwgdmFsdWVcbiAqIEBwYXJhbSBkIGV4cGVjdGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbChjOiB1bmtub3duLCBkOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwKCk7XG4gIHJldHVybiAoZnVuY3Rpb24gY29tcGFyZShhOiB1bmtub3duLCBiOiB1bmtub3duKTogYm9vbGVhbiB7XG4gICAgLy8gSGF2ZSB0byByZW5kZXIgUmVnRXhwICYgRGF0ZSBmb3Igc3RyaW5nIGNvbXBhcmlzb25cbiAgICAvLyB1bmxlc3MgaXQncyBtaXN0cmVhdGVkIGFzIG9iamVjdFxuICAgIGlmIChcbiAgICAgIGEgJiZcbiAgICAgIGIgJiZcbiAgICAgICgoYSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBiIGluc3RhbmNlb2YgUmVnRXhwKSB8fFxuICAgICAgICAoYSBpbnN0YW5jZW9mIFVSTCAmJiBiIGluc3RhbmNlb2YgVVJMKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbiAgICB9XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBjb25zdCBhVGltZSA9IGEuZ2V0VGltZSgpO1xuICAgICAgY29uc3QgYlRpbWUgPSBiLmdldFRpbWUoKTtcbiAgICAgIC8vIENoZWNrIGZvciBOYU4gZXF1YWxpdHkgbWFudWFsbHkgc2luY2UgTmFOIGlzIG5vdFxuICAgICAgLy8gZXF1YWwgdG8gaXRzZWxmLlxuICAgICAgaWYgKE51bWJlci5pc05hTihhVGltZSkgJiYgTnVtYmVyLmlzTmFOKGJUaW1lKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhVGltZSA9PT0gYlRpbWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgYiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgcmV0dXJuIE51bWJlci5pc05hTihhKSAmJiBOdW1iZXIuaXNOYU4oYikgfHwgYSA9PT0gYjtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5pcyhhLCBiKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChhICYmIHR5cGVvZiBhID09PSBcIm9iamVjdFwiICYmIGIgJiYgdHlwZW9mIGIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGlmIChhICYmIGIgJiYgIWNvbnN0cnVjdG9yc0VxdWFsKGEsIGIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChhIGluc3RhbmNlb2YgV2Vha01hcCB8fCBiIGluc3RhbmNlb2YgV2Vha01hcCkge1xuICAgICAgICBpZiAoIShhIGluc3RhbmNlb2YgV2Vha01hcCAmJiBiIGluc3RhbmNlb2YgV2Vha01hcCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBjb21wYXJlIFdlYWtNYXAgaW5zdGFuY2VzXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrU2V0IHx8IGIgaW5zdGFuY2VvZiBXZWFrU2V0KSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrU2V0ICYmIGIgaW5zdGFuY2VvZiBXZWFrU2V0KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGNvbXBhcmUgV2Vha1NldCBpbnN0YW5jZXNcIik7XG4gICAgICB9XG4gICAgICBpZiAoc2Vlbi5nZXQoYSkgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoT2JqZWN0LmtleXMoYSB8fCB7fSkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyhiIHx8IHt9KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICBpZiAoaXNLZXllZENvbGxlY3Rpb24oYSkgJiYgaXNLZXllZENvbGxlY3Rpb24oYikpIHtcbiAgICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVubWF0Y2hlZEVudHJpZXMgPSBhLnNpemU7XG5cbiAgICAgICAgZm9yIChjb25zdCBbYUtleSwgYVZhbHVlXSBvZiBhLmVudHJpZXMoKSkge1xuICAgICAgICAgIGZvciAoY29uc3QgW2JLZXksIGJWYWx1ZV0gb2YgYi5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIC8qIEdpdmVuIHRoYXQgTWFwIGtleXMgY2FuIGJlIHJlZmVyZW5jZXMsIHdlIG5lZWRcbiAgICAgICAgICAgICAqIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIGFsc28gZGVlcGx5IGVxdWFsICovXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIChhS2V5ID09PSBhVmFsdWUgJiYgYktleSA9PT0gYlZhbHVlICYmIGNvbXBhcmUoYUtleSwgYktleSkpIHx8XG4gICAgICAgICAgICAgIChjb21wYXJlKGFLZXksIGJLZXkpICYmIGNvbXBhcmUoYVZhbHVlLCBiVmFsdWUpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHVubWF0Y2hlZEVudHJpZXMtLTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVubWF0Y2hlZEVudHJpZXMgPT09IDA7XG4gICAgICB9XG4gICAgICBjb25zdCBtZXJnZWQgPSB7IC4uLmEsIC4uLmIgfTtcbiAgICAgIGZvciAoXG4gICAgICAgIGNvbnN0IGtleSBvZiBbXG4gICAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWVyZ2VkKSxcbiAgICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG1lcmdlZCksXG4gICAgICAgIF1cbiAgICAgICkge1xuICAgICAgICB0eXBlIEtleSA9IGtleW9mIHR5cGVvZiBtZXJnZWQ7XG4gICAgICAgIGlmICghY29tcGFyZShhICYmIGFba2V5IGFzIEtleV0sIGIgJiYgYltrZXkgYXMgS2V5XSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCgoa2V5IGluIGEpICYmICghKGtleSBpbiBiKSkpIHx8ICgoa2V5IGluIGIpICYmICghKGtleSBpbiBhKSkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIFdlYWtSZWYgfHwgYiBpbnN0YW5jZW9mIFdlYWtSZWYpIHtcbiAgICAgICAgaWYgKCEoYSBpbnN0YW5jZW9mIFdlYWtSZWYgJiYgYiBpbnN0YW5jZW9mIFdlYWtSZWYpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBjb21wYXJlKGEuZGVyZWYoKSwgYi5kZXJlZigpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pKGMsIGQpO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuZnVuY3Rpb24gY29uc3RydWN0b3JzRXF1YWwoYTogb2JqZWN0LCBiOiBvYmplY3QpIHtcbiAgcmV0dXJuIGEuY29uc3RydWN0b3IgPT09IGIuY29uc3RydWN0b3IgfHxcbiAgICBhLmNvbnN0cnVjdG9yID09PSBPYmplY3QgJiYgIWIuY29uc3RydWN0b3IgfHxcbiAgICAhYS5jb25zdHJ1Y3RvciAmJiBiLmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG59XG5cbi8qKiBNYWtlIGFuIGFzc2VydGlvbiwgZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYGV4cHJgIGRvZXMgbm90IGhhdmUgdHJ1dGh5IHZhbHVlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydChleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIHtcbiAgaWYgKCFleHByKSB7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqIE1ha2UgYW4gYXNzZXJ0aW9uLCBlcnJvciB3aWxsIGJlIHRocm93biBpZiBgZXhwcmAgaGF2ZSB0cnV0aHkgdmFsdWUuICovXG50eXBlIEZhbHN5ID0gZmFsc2UgfCAwIHwgMG4gfCBcIlwiIHwgbnVsbCB8IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRGYWxzZShleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIGlzIEZhbHN5IHtcbiAgaWYgKGV4cHIpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGVxdWFsLCBkZWVwbHkuIElmIG5vdFxuICogZGVlcGx5IGVxdWFsLCB0aGVuIHRocm93LlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEVxdWFscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIERlbm8udGVzdChcImV4YW1wbGVcIiwgZnVuY3Rpb24gKCk6IHZvaWQge1xuICogICBhc3NlcnRFcXVhbHMoXCJ3b3JsZFwiLCBcIndvcmxkXCIpO1xuICogICBhc3NlcnRFcXVhbHMoeyBoZWxsbzogXCJ3b3JsZFwiIH0sIHsgaGVsbG86IFwid29ybGRcIiB9KTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbHM8VD4oYWN0dWFsOiBULCBleHBlY3RlZDogVCwgbXNnPzogc3RyaW5nKSB7XG4gIGlmIChlcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsZXQgbWVzc2FnZSA9IFwiXCI7XG4gIGNvbnN0IGFjdHVhbFN0cmluZyA9IGZvcm1hdChhY3R1YWwpO1xuICBjb25zdCBleHBlY3RlZFN0cmluZyA9IGZvcm1hdChleHBlY3RlZCk7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyaW5nRGlmZiA9ICh0eXBlb2YgYWN0dWFsID09PSBcInN0cmluZ1wiKSAmJlxuICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgID8gZGlmZnN0cihhY3R1YWwgYXMgc3RyaW5nLCBleHBlY3RlZCBhcyBzdHJpbmcpXG4gICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICBtZXNzYWdlID0gYFZhbHVlcyBhcmUgbm90IGVxdWFsOlxcbiR7ZGlmZk1zZ31gO1xuICB9IGNhdGNoIHtcbiAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgfVxuICBpZiAobXNnKSB7XG4gICAgbWVzc2FnZSA9IG1zZztcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IGVxdWFsLCBkZWVwbHkuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnROb3RFcXVhbHMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnROb3RFcXVhbHM8bnVtYmVyPigxLCAyKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnROb3RFcXVhbHM8VD4oYWN0dWFsOiBULCBleHBlY3RlZDogVCwgbXNnPzogc3RyaW5nKSB7XG4gIGlmICghZXF1YWwoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbGV0IGFjdHVhbFN0cmluZzogc3RyaW5nO1xuICBsZXQgZXhwZWN0ZWRTdHJpbmc6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBhY3R1YWxTdHJpbmcgPSBTdHJpbmcoYWN0dWFsKTtcbiAgfSBjYXRjaCB7XG4gICAgYWN0dWFsU3RyaW5nID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG4gIH1cbiAgdHJ5IHtcbiAgICBleHBlY3RlZFN0cmluZyA9IFN0cmluZyhleHBlY3RlZCk7XG4gIH0gY2F0Y2gge1xuICAgIGV4cGVjdGVkU3RyaW5nID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG4gIH1cbiAgaWYgKCFtc2cpIHtcbiAgICBtc2cgPSBgYWN0dWFsOiAke2FjdHVhbFN0cmluZ30gZXhwZWN0ZWQgbm90IHRvIGJlOiAke2V4cGVjdGVkU3RyaW5nfWA7XG4gIH1cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgc3RyaWN0bHkgZXF1YWwuIElmXG4gKiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydFN0cmljdEVxdWFscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIERlbm8udGVzdChcImlzU3RyaWN0bHlFcXVhbFwiLCBmdW5jdGlvbiAoKTogdm9pZCB7XG4gKiAgIGNvbnN0IGEgPSB7fTtcbiAqICAgY29uc3QgYiA9IGE7XG4gKiAgIGFzc2VydFN0cmljdEVxdWFscyhhLCBiKTtcbiAqIH0pO1xuICpcbiAqIC8vIFRoaXMgdGVzdCBmYWlsc1xuICogRGVuby50ZXN0KFwiaXNOb3RTdHJpY3RseUVxdWFsXCIsIGZ1bmN0aW9uICgpOiB2b2lkIHtcbiAqICAgY29uc3QgYSA9IHt9O1xuICogICBjb25zdCBiID0ge307XG4gKiAgIGFzc2VydFN0cmljdEVxdWFscyhhLCBiKTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRTdHJpY3RFcXVhbHM8VD4oXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IFQsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgYWN0dWFsIGlzIFQge1xuICBpZiAoT2JqZWN0LmlzKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IG1lc3NhZ2U6IHN0cmluZztcblxuICBpZiAobXNnKSB7XG4gICAgbWVzc2FnZSA9IG1zZztcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBhY3R1YWxTdHJpbmcgPSBmb3JtYXQoYWN0dWFsKTtcbiAgICBjb25zdCBleHBlY3RlZFN0cmluZyA9IGZvcm1hdChleHBlY3RlZCk7XG5cbiAgICBpZiAoYWN0dWFsU3RyaW5nID09PSBleHBlY3RlZFN0cmluZykge1xuICAgICAgY29uc3Qgd2l0aE9mZnNldCA9IGFjdHVhbFN0cmluZ1xuICAgICAgICAuc3BsaXQoXCJcXG5cIilcbiAgICAgICAgLm1hcCgobCkgPT4gYCAgICAke2x9YClcbiAgICAgICAgLmpvaW4oXCJcXG5cIik7XG4gICAgICBtZXNzYWdlID1cbiAgICAgICAgYFZhbHVlcyBoYXZlIHRoZSBzYW1lIHN0cnVjdHVyZSBidXQgYXJlIG5vdCByZWZlcmVuY2UtZXF1YWw6XFxuXFxuJHtcbiAgICAgICAgICByZWQod2l0aE9mZnNldClcbiAgICAgICAgfVxcbmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0cmluZ0RpZmYgPSAodHlwZW9mIGFjdHVhbCA9PT0gXCJzdHJpbmdcIikgJiZcbiAgICAgICAgICAodHlwZW9mIGV4cGVjdGVkID09PSBcInN0cmluZ1wiKTtcbiAgICAgICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgICAgICA/IGRpZmZzdHIoYWN0dWFsIGFzIHN0cmluZywgZXhwZWN0ZWQgYXMgc3RyaW5nKVxuICAgICAgICAgIDogZGlmZihhY3R1YWxTdHJpbmcuc3BsaXQoXCJcXG5cIiksIGV4cGVjdGVkU3RyaW5nLnNwbGl0KFwiXFxuXCIpKTtcbiAgICAgICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICAgICAgbWVzc2FnZSA9IGBWYWx1ZXMgYXJlIG5vdCBzdHJpY3RseSBlcXVhbDpcXG4ke2RpZmZNc2d9YDtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IHN0cmljdGx5IGVxdWFsLlxuICogSWYgdGhlIHZhbHVlcyBhcmUgc3RyaWN0bHkgZXF1YWwgdGhlbiB0aHJvdy5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0Tm90U3RyaWN0RXF1YWxzIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0Tm90U3RyaWN0RXF1YWxzKDEsIDEpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdFN0cmljdEVxdWFsczxUPihcbiAgYWN0dWFsOiBULFxuICBleHBlY3RlZDogVCxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmICghT2JqZWN0LmlzKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgIG1zZyA/PyBgRXhwZWN0ZWQgXCJhY3R1YWxcIiB0byBiZSBzdHJpY3RseSB1bmVxdWFsIHRvOiAke2Zvcm1hdChhY3R1YWwpfVxcbmAsXG4gICk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgYWxtb3N0IGVxdWFsIG51bWJlcnMgdGhyb3VnaFxuICogYSBnaXZlbiB0b2xlcmFuY2UuIEl0IGNhbiBiZSB1c2VkIHRvIHRha2UgaW50byBhY2NvdW50IElFRUUtNzU0IGRvdWJsZS1wcmVjaXNpb25cbiAqIGZsb2F0aW5nLXBvaW50IHJlcHJlc2VudGF0aW9uIGxpbWl0YXRpb25zLlxuICogSWYgdGhlIHZhbHVlcyBhcmUgbm90IGFsbW9zdCBlcXVhbCB0aGVuIHRocm93LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0QWxtb3N0RXF1YWxzLCBhc3NlcnRUaHJvd3MgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xLCAwLjIpO1xuICpcbiAqIC8vIFVzaW5nIGEgY3VzdG9tIHRvbGVyYW5jZSB2YWx1ZVxuICogYXNzZXJ0QWxtb3N0RXF1YWxzKDAuMSArIDAuMiwgMC4zLCAxZS0xNik7XG4gKiBhc3NlcnRUaHJvd3MoKCkgPT4gYXNzZXJ0QWxtb3N0RXF1YWxzKDAuMSArIDAuMiwgMC4zLCAxZS0xNykpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBbG1vc3RFcXVhbHMoXG4gIGFjdHVhbDogbnVtYmVyLFxuICBleHBlY3RlZDogbnVtYmVyLFxuICB0b2xlcmFuY2UgPSAxZS03LFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKE9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBkZWx0YSA9IE1hdGguYWJzKGV4cGVjdGVkIC0gYWN0dWFsKTtcbiAgaWYgKGRlbHRhIDw9IHRvbGVyYW5jZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBmID0gKG46IG51bWJlcikgPT4gTnVtYmVyLmlzSW50ZWdlcihuKSA/IG4gOiBuLnRvRXhwb25lbnRpYWwoKTtcbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgIG1zZyA/P1xuICAgICAgYGFjdHVhbDogXCIke2YoYWN0dWFsKX1cIiBleHBlY3RlZCB0byBiZSBjbG9zZSB0byBcIiR7ZihleHBlY3RlZCl9XCI6IFxcXG5kZWx0YSBcIiR7ZihkZWx0YSl9XCIgaXMgZ3JlYXRlciB0aGFuIFwiJHtmKHRvbGVyYW5jZSl9XCJgLFxuICApO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxudHlwZSBBbnlDb25zdHJ1Y3RvciA9IG5ldyAoLi4uYXJnczogYW55W10pID0+IGFueTtcbnR5cGUgR2V0Q29uc3RydWN0b3JUeXBlPFQgZXh0ZW5kcyBBbnlDb25zdHJ1Y3Rvcj4gPSBUIGV4dGVuZHMgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbm5ldyAoLi4uYXJnczogYW55KSA9PiBpbmZlciBDID8gQ1xuICA6IG5ldmVyO1xuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYG9iamAgaXMgYW4gaW5zdGFuY2Ugb2YgYHR5cGVgLlxuICogSWYgbm90IHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRJbnN0YW5jZU9mPFQgZXh0ZW5kcyBBbnlDb25zdHJ1Y3Rvcj4oXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWRUeXBlOiBULFxuICBtc2cgPSBcIlwiLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgR2V0Q29uc3RydWN0b3JUeXBlPFQ+IHtcbiAgaWYgKCFtc2cpIHtcbiAgICBjb25zdCBleHBlY3RlZFR5cGVTdHIgPSBleHBlY3RlZFR5cGUubmFtZTtcblxuICAgIGxldCBhY3R1YWxUeXBlU3RyID0gXCJcIjtcbiAgICBpZiAoYWN0dWFsID09PSBudWxsKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gXCJudWxsXCI7XG4gICAgfSBlbHNlIGlmIChhY3R1YWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYWN0dWFsVHlwZVN0ciA9IFwidW5kZWZpbmVkXCI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gYWN0dWFsLmNvbnN0cnVjdG9yPy5uYW1lID8/IFwiT2JqZWN0XCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSB0eXBlb2YgYWN0dWFsO1xuICAgIH1cblxuICAgIGlmIChleHBlY3RlZFR5cGVTdHIgPT0gYWN0dWFsVHlwZVN0cikge1xuICAgICAgbXNnID0gYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiLmA7XG4gICAgfSBlbHNlIGlmIChhY3R1YWxUeXBlU3RyID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgbXNnID1cbiAgICAgICAgYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiIGJ1dCB3YXMgbm90IGFuIGluc3RhbmNlZCBvYmplY3QuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID1cbiAgICAgICAgYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiIGJ1dCB3YXMgXCIke2FjdHVhbFR5cGVTdHJ9XCIuYDtcbiAgICB9XG4gIH1cbiAgYXNzZXJ0KGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkVHlwZSwgbXNnKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBvYmpgIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBgdHlwZWAuXG4gKiBJZiBzbywgdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdEluc3RhbmNlT2Y8QSwgVD4oXG4gIGFjdHVhbDogQSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdW5leHBlY3RlZFR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFQsXG4gIG1zZyA9IGBFeHBlY3RlZCBvYmplY3QgdG8gbm90IGJlIGFuIGluc3RhbmNlIG9mIFwiJHt0eXBlb2YgdW5leHBlY3RlZFR5cGV9XCJgLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgRXhjbHVkZTxBLCBUPiB7XG4gIGFzc2VydEZhbHNlKGFjdHVhbCBpbnN0YW5jZW9mIHVuZXhwZWN0ZWRUeXBlLCBtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYWN0dWFsIGlzIG5vdCBudWxsIG9yIHVuZGVmaW5lZC5cbiAqIElmIG5vdCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0RXhpc3RzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgYWN0dWFsIGlzIE5vbk51bGxhYmxlPFQ+IHtcbiAgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkIHx8IGFjdHVhbCA9PT0gbnVsbCkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZGA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBhY3R1YWwgaW5jbHVkZXMgZXhwZWN0ZWQuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFN0cmluZ0luY2x1ZGVzKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmICghYWN0dWFsLmluY2x1ZGVzKGV4cGVjdGVkKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIGNvbnRhaW46IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBpbmNsdWRlcyB0aGUgYGV4cGVjdGVkYCB2YWx1ZXMuXG4gKiBJZiBub3QgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRBcnJheUluY2x1ZGVzIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0QXJyYXlJbmNsdWRlczxudW1iZXI+KFsxLCAyXSwgWzJdKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBcnJheUluY2x1ZGVzPFQ+KFxuICBhY3R1YWw6IEFycmF5TGlrZTxUPixcbiAgZXhwZWN0ZWQ6IEFycmF5TGlrZTxUPixcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IG1pc3Npbmc6IHVua25vd25bXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cGVjdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IGZvdW5kID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBhY3R1YWwubGVuZ3RoOyBqKyspIHtcbiAgICAgIGlmIChlcXVhbChleHBlY3RlZFtpXSwgYWN0dWFsW2pdKSkge1xuICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWZvdW5kKSB7XG4gICAgICBtaXNzaW5nLnB1c2goZXhwZWN0ZWRbaV0pO1xuICAgIH1cbiAgfVxuICBpZiAobWlzc2luZy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFtc2cpIHtcbiAgICBtc2cgPSBgYWN0dWFsOiBcIiR7Zm9ybWF0KGFjdHVhbCl9XCIgZXhwZWN0ZWQgdG8gaW5jbHVkZTogXCIke1xuICAgICAgZm9ybWF0KGV4cGVjdGVkKVxuICAgIH1cIlxcbm1pc3Npbmc6ICR7Zm9ybWF0KG1pc3NpbmcpfWA7XG4gIH1cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBtYXRjaCBSZWdFeHAgYGV4cGVjdGVkYC4gSWYgbm90XG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0TWF0Y2goXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogUmVnRXhwLFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKCFleHBlY3RlZC50ZXN0KGFjdHVhbCkpIHtcbiAgICBpZiAoIW1zZykge1xuICAgICAgbXNnID0gYGFjdHVhbDogXCIke2FjdHVhbH1cIiBleHBlY3RlZCB0byBtYXRjaDogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIG5vdCBtYXRjaCBSZWdFeHAgYGV4cGVjdGVkYC4gSWYgbWF0Y2hcbiAqIHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnROb3RNYXRjaChcbiAgYWN0dWFsOiBzdHJpbmcsXG4gIGV4cGVjdGVkOiBSZWdFeHAsXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBpZiAoZXhwZWN0ZWQudGVzdChhY3R1YWwpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbm90IG1hdGNoOiBcIiR7ZXhwZWN0ZWR9XCJgO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgb2JqZWN0IGlzIGEgc3Vic2V0IG9mIGBleHBlY3RlZGAgb2JqZWN0LCBkZWVwbHkuXG4gKiBJZiBub3QsIHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRPYmplY3RNYXRjaChcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgYWN0dWFsOiBSZWNvcmQ8UHJvcGVydHlLZXksIGFueT4sXG4gIGV4cGVjdGVkOiBSZWNvcmQ8UHJvcGVydHlLZXksIHVua25vd24+LFxuKSB7XG4gIHR5cGUgbG9vc2UgPSBSZWNvcmQ8UHJvcGVydHlLZXksIHVua25vd24+O1xuXG4gIGZ1bmN0aW9uIGZpbHRlcihhOiBsb29zZSwgYjogbG9vc2UpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFdlYWtNYXAoKTtcbiAgICByZXR1cm4gZm4oYSwgYik7XG5cbiAgICBmdW5jdGlvbiBmbihhOiBsb29zZSwgYjogbG9vc2UpOiBsb29zZSB7XG4gICAgICAvLyBQcmV2ZW50IGluZmluaXRlIGxvb3Agd2l0aCBjaXJjdWxhciByZWZlcmVuY2VzIHdpdGggc2FtZSBmaWx0ZXJcbiAgICAgIGlmICgoc2Vlbi5oYXMoYSkpICYmIChzZWVuLmdldChhKSA9PT0gYikpIHtcbiAgICAgICAgcmV0dXJuIGE7XG4gICAgICB9XG4gICAgICBzZWVuLnNldChhLCBiKTtcbiAgICAgIC8vIEZpbHRlciBrZXlzIGFuZCBzeW1ib2xzIHdoaWNoIGFyZSBwcmVzZW50IGluIGJvdGggYWN0dWFsIGFuZCBleHBlY3RlZFxuICAgICAgY29uc3QgZmlsdGVyZWQgPSB7fSBhcyBsb29zZTtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBbXG4gICAgICAgIC4uLk9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGEpLFxuICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKGEpLFxuICAgICAgXVxuICAgICAgICAuZmlsdGVyKChrZXkpID0+IGtleSBpbiBiKVxuICAgICAgICAubWFwKChrZXkpID0+IFtrZXksIGFba2V5IGFzIHN0cmluZ11dKSBhcyBBcnJheTxbc3RyaW5nLCB1bmtub3duXT47XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIC8vIE9uIGFycmF5IHJlZmVyZW5jZXMsIGJ1aWxkIGEgZmlsdGVyZWQgYXJyYXkgYW5kIGZpbHRlciBuZXN0ZWQgb2JqZWN0cyBpbnNpZGVcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgY29uc3Qgc3Vic2V0ID0gKGIgYXMgbG9vc2UpW2tleV07XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoc3Vic2V0KSkge1xuICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZuKHsgLi4udmFsdWUgfSwgeyAuLi5zdWJzZXQgfSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gLy8gT24gcmVnZXhwIHJlZmVyZW5jZXMsIGtlZXAgdmFsdWUgYXMgaXQgdG8gYXZvaWQgbG9vc2luZyBwYXR0ZXJuIGFuZCBmbGFnc1xuICAgICAgICBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSAvLyBPbiBuZXN0ZWQgb2JqZWN0cyByZWZlcmVuY2VzLCBidWlsZCBhIGZpbHRlcmVkIG9iamVjdCByZWN1cnNpdmVseVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICBjb25zdCBzdWJzZXQgPSAoYiBhcyBsb29zZSlba2V5XTtcbiAgICAgICAgICBpZiAoKHR5cGVvZiBzdWJzZXQgPT09IFwib2JqZWN0XCIpICYmIChzdWJzZXQpKSB7XG4gICAgICAgICAgICAvLyBXaGVuIGJvdGggb3BlcmFuZHMgYXJlIG1hcHMsIGJ1aWxkIGEgZmlsdGVyZWQgbWFwIHdpdGggY29tbW9uIGtleXMgYW5kIGZpbHRlciBuZXN0ZWQgb2JqZWN0cyBpbnNpZGVcbiAgICAgICAgICAgIGlmICgodmFsdWUgaW5zdGFuY2VvZiBNYXApICYmIChzdWJzZXQgaW5zdGFuY2VvZiBNYXApKSB7XG4gICAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBuZXcgTWFwKFxuICAgICAgICAgICAgICAgIFsuLi52YWx1ZV0uZmlsdGVyKChba10pID0+IHN1YnNldC5oYXMoaykpLm1hcCgoXG4gICAgICAgICAgICAgICAgICBbaywgdl0sXG4gICAgICAgICAgICAgICAgKSA9PiBbaywgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgPyBmbih2LCBzdWJzZXQuZ2V0KGspKSA6IHZdKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXaGVuIGJvdGggb3BlcmFuZHMgYXJlIHNldCwgYnVpbGQgYSBmaWx0ZXJlZCBzZXQgd2l0aCBjb21tb24gdmFsdWVzXG4gICAgICAgICAgICBpZiAoKHZhbHVlIGluc3RhbmNlb2YgU2V0KSAmJiAoc3Vic2V0IGluc3RhbmNlb2YgU2V0KSkge1xuICAgICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gbmV3IFNldChbLi4udmFsdWVdLmZpbHRlcigodikgPT4gc3Vic2V0Lmhhcyh2KSkpO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmbih2YWx1ZSBhcyBsb29zZSwgc3Vic2V0IGFzIGxvb3NlKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmaWx0ZXJlZFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBhc3NlcnRFcXVhbHMoXG4gICAgLy8gZ2V0IHRoZSBpbnRlcnNlY3Rpb24gb2YgXCJhY3R1YWxcIiBhbmQgXCJleHBlY3RlZFwiXG4gICAgLy8gc2lkZSBlZmZlY3Q6IGFsbCB0aGUgaW5zdGFuY2VzJyBjb25zdHJ1Y3RvciBmaWVsZCBpcyBcIk9iamVjdFwiIG5vdy5cbiAgICBmaWx0ZXIoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgLy8gc2V0IChuZXN0ZWQpIGluc3RhbmNlcycgY29uc3RydWN0b3IgZmllbGQgdG8gYmUgXCJPYmplY3RcIiB3aXRob3V0IGNoYW5naW5nIGV4cGVjdGVkIHZhbHVlLlxuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVub19zdGQvcHVsbC8xNDE5XG4gICAgZmlsdGVyKGV4cGVjdGVkLCBleHBlY3RlZCksXG4gICk7XG59XG5cbi8qKlxuICogRm9yY2VmdWxseSB0aHJvd3MgYSBmYWlsZWQgYXNzZXJ0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmYWlsKG1zZz86IHN0cmluZyk6IG5ldmVyIHtcbiAgYXNzZXJ0KGZhbHNlLCBgRmFpbGVkIGFzc2VydGlvbiR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWApO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGVycm9yYCBpcyBhbiBgRXJyb3JgLlxuICogSWYgbm90IHRoZW4gYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24uXG4gKiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlXG4gKiBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0SXNFcnJvcjxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGVycm9yOiB1bmtub3duLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzPzogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSxcbiAgbXNnSW5jbHVkZXM/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgZXJyb3IgaXMgRSB7XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihgRXhwZWN0ZWQgXCJlcnJvclwiIHRvIGJlIGFuIEVycm9yIG9iamVjdC5gKTtcbiAgfVxuICBpZiAoRXJyb3JDbGFzcyAmJiAhKGVycm9yIGluc3RhbmNlb2YgRXJyb3JDbGFzcykpIHtcbiAgICBtc2cgPSBgRXhwZWN0ZWQgZXJyb3IgdG8gYmUgaW5zdGFuY2Ugb2YgXCIke0Vycm9yQ2xhc3MubmFtZX1cIiwgYnV0IHdhcyBcIiR7XG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgPyBlcnJvcj8uY29uc3RydWN0b3I/Lm5hbWUgOiBcIltub3QgYW4gb2JqZWN0XVwiXG4gICAgfVwiJHttc2cgPyBgOiAke21zZ31gIDogXCIuXCJ9YDtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxuICBpZiAoXG4gICAgbXNnSW5jbHVkZXMgJiYgKCEoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikgfHxcbiAgICAgICFzdHJpcENvbG9yKGVycm9yLm1lc3NhZ2UpLmluY2x1ZGVzKHN0cmlwQ29sb3IobXNnSW5jbHVkZXMpKSlcbiAgKSB7XG4gICAgbXNnID0gYEV4cGVjdGVkIGVycm9yIG1lc3NhZ2UgdG8gaW5jbHVkZSBcIiR7bXNnSW5jbHVkZXN9XCIsIGJ1dCBnb3QgXCIke1xuICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIltub3QgYW4gRXJyb3JdXCJcbiAgICB9XCIke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogRXhlY3V0ZXMgYSBmdW5jdGlvbiwgZXhwZWN0aW5nIGl0IHRvIHRocm93LiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdFxuICogdGhyb3dzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0VGhyb3dzIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG4gKlxuICogRGVuby50ZXN0KFwiZG9lc1Rocm93XCIsIGZ1bmN0aW9uICgpOiB2b2lkIHtcbiAqICAgYXNzZXJ0VGhyb3dzKCgpOiB2b2lkID0+IHtcbiAqICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiaGVsbG8gd29ybGQhXCIpO1xuICogICB9KTtcbiAqIH0pO1xuICpcbiAqIC8vIFRoaXMgdGVzdCB3aWxsIG5vdCBwYXNzLlxuICogRGVuby50ZXN0KFwiZmFpbHNcIiwgZnVuY3Rpb24gKCk6IHZvaWQge1xuICogICBhc3NlcnRUaHJvd3MoKCk6IHZvaWQgPT4ge1xuICogICAgIGNvbnNvbGUubG9nKFwiSGVsbG8gd29ybGRcIik7XG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93cyhcbiAgZm46ICgpID0+IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IHVua25vd247XG4vKipcbiAqIEV4ZWN1dGVzIGEgZnVuY3Rpb24sIGV4cGVjdGluZyBpdCB0byB0aHJvdy4gSWYgaXQgZG9lcyBub3QsIHRoZW4gaXRcbiAqIHRocm93cy4gQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZVxuICogZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRUaHJvd3MgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBEZW5vLnRlc3QoXCJkb2VzVGhyb3dcIiwgZnVuY3Rpb24gKCk6IHZvaWQge1xuICogICBhc3NlcnRUaHJvd3MoKCk6IHZvaWQgPT4ge1xuICogICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJoZWxsbyB3b3JsZCFcIik7XG4gKiAgIH0sIFR5cGVFcnJvcik7XG4gKiAgIGFzc2VydFRocm93cyhcbiAqICAgICAoKTogdm9pZCA9PiB7XG4gKiAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiaGVsbG8gd29ybGQhXCIpO1xuICogICAgIH0sXG4gKiAgICAgVHlwZUVycm9yLFxuICogICAgIFwiaGVsbG9cIixcbiAqICAgKTtcbiAqIH0pO1xuICpcbiAqIC8vIFRoaXMgdGVzdCB3aWxsIG5vdCBwYXNzLlxuICogRGVuby50ZXN0KFwiZmFpbHNcIiwgZnVuY3Rpb24gKCk6IHZvaWQge1xuICogICBhc3NlcnRUaHJvd3MoKCk6IHZvaWQgPT4ge1xuICogICAgIGNvbnNvbGUubG9nKFwiSGVsbG8gd29ybGRcIik7XG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFLFxuICBtc2dJbmNsdWRlcz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogRTtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgZXJyb3JDbGFzc09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCBzdHJpbmcsXG4gIG1zZ0luY2x1ZGVzT3JNc2c/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IEUgfCBFcnJvciB8IHVua25vd24ge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBsZXQgRXJyb3JDbGFzczogKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgbXNnSW5jbHVkZXM6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPck1zZyAhPT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChcbiAgICAgIGVycm9yQ2xhc3NPck1zZyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBlcnJvckNsYXNzT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPck1zZy5wcm90b3R5cGUgPT09IEVycm9yLnByb3RvdHlwZVxuICAgICkge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIEVycm9yQ2xhc3MgPSBlcnJvckNsYXNzT3JNc2cgYXMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRTtcbiAgICAgIG1zZ0luY2x1ZGVzID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbXNnID0gZXJyb3JDbGFzc09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgY29uc3QgbXNnVG9BcHBlbmRUb0Vycm9yID0gbXNnID8gYDogJHttc2d9YCA6IFwiLlwiO1xuICB0cnkge1xuICAgIGZuKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKEVycm9yQ2xhc3MpIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJBIG5vbi1FcnJvciBvYmplY3Qgd2FzIHRocm93bi5cIik7XG4gICAgICB9XG4gICAgICBhc3NlcnRJc0Vycm9yKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgRXJyb3JDbGFzcyxcbiAgICAgICAgbXNnSW5jbHVkZXMsXG4gICAgICAgIG1zZyxcbiAgICAgICk7XG4gICAgfVxuICAgIGVyciA9IGVycm9yO1xuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICBtc2cgPSBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gdGhyb3cke21zZ1RvQXBwZW5kVG9FcnJvcn1gO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKlxuICogRXhlY3V0ZXMgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGEgcHJvbWlzZSwgZXhwZWN0aW5nIGl0IHRvIHJlamVjdC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydFJlamVjdHMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBEZW5vLnRlc3QoXCJkb2VzVGhyb3dcIiwgYXN5bmMgZnVuY3Rpb24gKCkge1xuICogICBhd2FpdCBhc3NlcnRSZWplY3RzKFxuICogICAgIGFzeW5jICgpID0+IHtcbiAqICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJoZWxsbyB3b3JsZCFcIik7XG4gKiAgICAgfSxcbiAqICAgKTtcbiAqICAgYXdhaXQgYXNzZXJ0UmVqZWN0cyhcbiAqICAgICBhc3luYyAoKSA9PiB7XG4gKiAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCkpO1xuICogICAgIH0sXG4gKiAgICk7XG4gKiB9KTtcbiAqXG4gKiAvLyBUaGlzIHRlc3Qgd2lsbCBub3QgcGFzcy5cbiAqIERlbm8udGVzdChcImZhaWxzXCIsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAqICAgYXdhaXQgYXNzZXJ0UmVqZWN0cyhcbiAqICAgICBhc3luYyAoKSA9PiB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhcIkhlbGxvIHdvcmxkXCIpO1xuICogICAgIH0sXG4gKiAgICk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0cyhcbiAgZm46ICgpID0+IFByb21pc2VMaWtlPHVua25vd24+LFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHVua25vd24+O1xuLyoqXG4gKiBFeGVjdXRlcyBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYSBwcm9taXNlLCBleHBlY3RpbmcgaXQgdG8gcmVqZWN0LlxuICogSWYgaXQgZG9lcyBub3QsIHRoZW4gaXQgdGhyb3dzLiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmVcbiAqIGluY2x1ZGVkIGluIHRoZSBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0UmVqZWN0cyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIERlbm8udGVzdChcImRvZXNUaHJvd1wiLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gKiAgIGF3YWl0IGFzc2VydFJlamVjdHMoYXN5bmMgKCkgPT4ge1xuICogICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJoZWxsbyB3b3JsZCFcIik7XG4gKiAgIH0sIFR5cGVFcnJvcik7XG4gKiAgIGF3YWl0IGFzc2VydFJlamVjdHMoXG4gKiAgICAgYXN5bmMgKCkgPT4ge1xuICogICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImhlbGxvIHdvcmxkIVwiKTtcbiAqICAgICB9LFxuICogICAgIFR5cGVFcnJvcixcbiAqICAgICBcImhlbGxvXCIsXG4gKiAgICk7XG4gKiB9KTtcbiAqXG4gKiAvLyBUaGlzIHRlc3Qgd2lsbCBub3QgcGFzcy5cbiAqIERlbm8udGVzdChcImZhaWxzXCIsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAqICAgYXdhaXQgYXNzZXJ0UmVqZWN0cyhcbiAqICAgICBhc3luYyAoKSA9PiB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhcIkhlbGxvIHdvcmxkXCIpO1xuICogICAgIH0sXG4gKiAgICk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzczogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSxcbiAgbXNnSW5jbHVkZXM/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IFByb21pc2U8RT47XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgZXJyb3JDbGFzc09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCBzdHJpbmcsXG4gIG1zZ0luY2x1ZGVzT3JNc2c/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IFByb21pc2U8RSB8IEVycm9yIHwgdW5rbm93bj4ge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBsZXQgRXJyb3JDbGFzczogKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgbXNnSW5jbHVkZXM6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPck1zZyAhPT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChcbiAgICAgIGVycm9yQ2xhc3NPck1zZyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBlcnJvckNsYXNzT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPck1zZy5wcm90b3R5cGUgPT09IEVycm9yLnByb3RvdHlwZVxuICAgICkge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIEVycm9yQ2xhc3MgPSBlcnJvckNsYXNzT3JNc2cgYXMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRTtcbiAgICAgIG1zZ0luY2x1ZGVzID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbXNnID0gZXJyb3JDbGFzc09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgbGV0IGlzUHJvbWlzZVJldHVybmVkID0gZmFsc2U7XG4gIGNvbnN0IG1zZ1RvQXBwZW5kVG9FcnJvciA9IG1zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIjtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb3NzaWJsZVByb21pc2UgPSBmbigpO1xuICAgIGlmIChcbiAgICAgIHBvc3NpYmxlUHJvbWlzZSAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZSA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZS50aGVuID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgIGlzUHJvbWlzZVJldHVybmVkID0gdHJ1ZTtcbiAgICAgIGF3YWl0IHBvc3NpYmxlUHJvbWlzZTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKCFpc1Byb21pc2VSZXR1cm5lZCkge1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgICAgICBgRnVuY3Rpb24gdGhyb3dzIHdoZW4gZXhwZWN0ZWQgdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChFcnJvckNsYXNzKSB7XG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFwiQSBub24tRXJyb3Igb2JqZWN0IHdhcyByZWplY3RlZC5cIik7XG4gICAgICB9XG4gICAgICBhc3NlcnRJc0Vycm9yKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgRXJyb3JDbGFzcyxcbiAgICAgICAgbXNnSW5jbHVkZXMsXG4gICAgICAgIG1zZyxcbiAgICAgICk7XG4gICAgfVxuICAgIGVyciA9IGVycm9yO1xuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKiBVc2UgdGhpcyB0byBzdHViIG91dCBtZXRob2RzIHRoYXQgd2lsbCB0aHJvdyB3aGVuIGludm9rZWQuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pbXBsZW1lbnRlZChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cgfHwgXCJ1bmltcGxlbWVudGVkXCIpO1xufVxuXG4vKiogVXNlIHRoaXMgdG8gYXNzZXJ0IHVucmVhY2hhYmxlIGNvZGUuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWFjaGFibGUoKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUU7Ozs7Ozs7O0NBUUMsR0FFRCxTQUFTLEdBQUcsRUFBRSxVQUFVLFFBQVEsbUJBQW1CO0FBQ25ELFNBQVMsWUFBWSxFQUFFLElBQUksRUFBRSxPQUFPLFFBQVEsYUFBYTtBQUN6RCxTQUFTLE1BQU0sUUFBUSxlQUFlO0FBRXRDLE1BQU0sa0JBQWtCO0FBRXhCLE9BQU8sTUFBTSx1QkFBdUI7SUFDekIsT0FBTyxp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