// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// deno-lint-ignore-file ban-types
import { AssertionError } from "./assertion_error.ts";
import * as asserts from "../testing/asserts.ts";
import { inspect } from "./util.ts";
import { ERR_AMBIGUOUS_ARGUMENT, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_RETURN_VALUE, ERR_MISSING_ARGS } from "./internal/errors.ts";
import { isDeepEqual } from "./internal/util/comparisons.ts";
function innerFail(obj) {
    if (obj.message instanceof Error) {
        throw obj.message;
    }
    throw new AssertionError({
        actual: obj.actual,
        expected: obj.expected,
        message: obj.message,
        operator: obj.operator
    });
}
// TODO(uki00a): This function is a workaround for setting the `generatedMessage` property flexibly.
function createAssertionError(options) {
    const error = new AssertionError(options);
    if (options.generatedMessage) {
        error.generatedMessage = true;
    }
    return error;
}
/** Converts the std assertion error to node.js assertion error */ function toNode(fn, opts) {
    const { operator , message , actual , expected  } = opts || {};
    try {
        fn();
    } catch (e) {
        if (e instanceof asserts.AssertionError) {
            if (typeof message === "string") {
                throw new AssertionError({
                    operator,
                    message,
                    actual,
                    expected
                });
            } else if (message instanceof Error) {
                throw message;
            } else {
                throw new AssertionError({
                    operator,
                    message: e.message,
                    actual,
                    expected
                });
            }
        }
        throw e;
    }
}
function assert(actual, message) {
    if (arguments.length === 0) {
        throw new AssertionError({
            message: "No value argument passed to `assert.ok()`"
        });
    }
    toNode(()=>asserts.assert(actual), {
        message,
        actual,
        expected: true
    });
}
const ok = assert;
function throws(fn, error, message) {
    // Check arg types
    if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", "function", fn);
    }
    if (typeof error === "object" && error !== null && Object.getPrototypeOf(error) === Object.prototype && Object.keys(error).length === 0) {
        // error is an empty object
        throw new ERR_INVALID_ARG_VALUE("error", error, "may not be an empty object");
    }
    if (typeof message === "string") {
        if (!(error instanceof RegExp) && typeof error !== "function" && !(error instanceof Error) && typeof error !== "object") {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Function",
                "Error",
                "RegExp",
                "Object"
            ], error);
        }
    } else {
        if (typeof error !== "undefined" && typeof error !== "string" && !(error instanceof RegExp) && typeof error !== "function" && !(error instanceof Error) && typeof error !== "object") {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Function",
                "Error",
                "RegExp",
                "Object"
            ], error);
        }
    }
    // Checks test function
    try {
        fn();
    } catch (e) {
        if (validateThrownError(e, error, message, {
            operator: throws
        })) {
            return;
        }
    }
    if (message) {
        let msg = `Missing expected exception: ${message}`;
        if (typeof error === "function" && error?.name) {
            msg = `Missing expected exception (${error.name}): ${message}`;
        }
        throw new AssertionError({
            message: msg,
            operator: "throws",
            actual: undefined,
            expected: error
        });
    } else if (typeof error === "string") {
        // Use case of throws(fn, message)
        throw new AssertionError({
            message: `Missing expected exception: ${error}`,
            operator: "throws",
            actual: undefined,
            expected: undefined
        });
    } else if (typeof error === "function" && error?.prototype !== undefined) {
        throw new AssertionError({
            message: `Missing expected exception (${error.name}).`,
            operator: "throws",
            actual: undefined,
            expected: error
        });
    } else {
        throw new AssertionError({
            message: "Missing expected exception.",
            operator: "throws",
            actual: undefined,
            expected: error
        });
    }
}
function doesNotThrow(fn, expected, message) {
    // Check arg type
    if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", "function", fn);
    } else if (!(expected instanceof RegExp) && typeof expected !== "function" && typeof expected !== "string" && typeof expected !== "undefined") {
        throw new ERR_INVALID_ARG_TYPE("expected", [
            "Function",
            "RegExp"
        ], fn);
    }
    // Checks test function
    try {
        fn();
    } catch (e) {
        gotUnwantedException(e, expected, message, doesNotThrow);
    }
    return;
}
function equal(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (actual == expected) {
        return;
    }
    if (Number.isNaN(actual) && Number.isNaN(expected)) {
        return;
    }
    if (typeof message === "string") {
        throw new AssertionError({
            message
        });
    } else if (message instanceof Error) {
        throw message;
    }
    toNode(()=>asserts.assertStrictEquals(actual, expected), {
        message: message || `${actual} == ${expected}`,
        operator: "==",
        actual,
        expected
    });
}
function notEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (Number.isNaN(actual) && Number.isNaN(expected)) {
        throw new AssertionError({
            message: `${actual} != ${expected}`,
            operator: "!=",
            actual,
            expected
        });
    }
    if (actual != expected) {
        return;
    }
    if (typeof message === "string") {
        throw new AssertionError({
            message
        });
    } else if (message instanceof Error) {
        throw message;
    }
    toNode(()=>asserts.assertNotStrictEquals(actual, expected), {
        message: message || `${actual} != ${expected}`,
        operator: "!=",
        actual,
        expected
    });
}
function strictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>asserts.assertStrictEquals(actual, expected), {
        message,
        operator: "strictEqual",
        actual,
        expected
    });
}
function notStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>asserts.assertNotStrictEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "notStrictEqual"
    });
}
function deepEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (!isDeepEqual(actual, expected)) {
        innerFail({
            actual,
            expected,
            message,
            operator: "deepEqual"
        });
    }
}
function notDeepEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (isDeepEqual(actual, expected)) {
        innerFail({
            actual,
            expected,
            message,
            operator: "notDeepEqual"
        });
    }
}
function deepStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>asserts.assertEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "deepStrictEqual"
    });
}
function notDeepStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>asserts.assertNotEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "deepNotStrictEqual"
    });
}
function fail(message) {
    if (typeof message === "string" || message == null) {
        throw createAssertionError({
            message: message ?? "Failed",
            operator: "fail",
            generatedMessage: message == null
        });
    } else {
        throw message;
    }
}
function match(actual, regexp, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "regexp");
    }
    if (!(regexp instanceof RegExp)) {
        throw new ERR_INVALID_ARG_TYPE("regexp", "RegExp", regexp);
    }
    toNode(()=>asserts.assertMatch(actual, regexp), {
        message,
        actual,
        expected: regexp,
        operator: "match"
    });
}
function doesNotMatch(string, regexp, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("string", "regexp");
    }
    if (!(regexp instanceof RegExp)) {
        throw new ERR_INVALID_ARG_TYPE("regexp", "RegExp", regexp);
    }
    if (typeof string !== "string") {
        if (message instanceof Error) {
            throw message;
        }
        throw new AssertionError({
            message: message || `The "string" argument must be of type string. Received type ${typeof string} (${inspect(string)})`,
            actual: string,
            expected: regexp,
            operator: "doesNotMatch"
        });
    }
    toNode(()=>asserts.assertNotMatch(string, regexp), {
        message,
        actual: string,
        expected: regexp,
        operator: "doesNotMatch"
    });
}
function strict(actual, message) {
    if (arguments.length === 0) {
        throw new AssertionError({
            message: "No value argument passed to `assert.ok()`"
        });
    }
    assert(actual, message);
}
// Intentionally avoid using async/await because test-assert-async.js requires it
function rejects(// deno-lint-ignore no-explicit-any
asyncFn, error, message) {
    let promise;
    if (typeof asyncFn === "function") {
        try {
            promise = asyncFn();
        } catch (err) {
            // If `asyncFn` throws an error synchronously, this function returns a rejected promise.
            return Promise.reject(err);
        }
        if (!isValidThenable(promise)) {
            return Promise.reject(new ERR_INVALID_RETURN_VALUE("instance of Promise", "promiseFn", promise));
        }
    } else if (!isValidThenable(asyncFn)) {
        return Promise.reject(new ERR_INVALID_ARG_TYPE("promiseFn", [
            "function",
            "Promise"
        ], asyncFn));
    } else {
        promise = asyncFn;
    }
    function onFulfilled() {
        let message = "Missing expected rejection";
        if (typeof error === "string") {
            message += `: ${error}`;
        } else if (typeof error === "function" && error.prototype !== undefined) {
            message += ` (${error.name}).`;
        } else {
            message += ".";
        }
        return Promise.reject(createAssertionError({
            message,
            operator: "rejects",
            generatedMessage: true
        }));
    }
    // deno-lint-ignore camelcase
    function rejects_onRejected(e) {
        if (validateThrownError(e, error, message, {
            operator: rejects,
            validationFunctionName: "validate"
        })) {
            return;
        }
    }
    return promise.then(onFulfilled, rejects_onRejected);
}
// Intentionally avoid using async/await because test-assert-async.js requires it
function doesNotReject(// deno-lint-ignore no-explicit-any
asyncFn, error, message) {
    // deno-lint-ignore no-explicit-any
    let promise;
    if (typeof asyncFn === "function") {
        try {
            const value = asyncFn();
            if (!isValidThenable(value)) {
                return Promise.reject(new ERR_INVALID_RETURN_VALUE("instance of Promise", "promiseFn", value));
            }
            promise = value;
        } catch (e) {
            // If `asyncFn` throws an error synchronously, this function returns a rejected promise.
            return Promise.reject(e);
        }
    } else if (!isValidThenable(asyncFn)) {
        return Promise.reject(new ERR_INVALID_ARG_TYPE("promiseFn", [
            "function",
            "Promise"
        ], asyncFn));
    } else {
        promise = asyncFn;
    }
    return promise.then(()=>{}, (e)=>gotUnwantedException(e, error, message, doesNotReject));
}
function gotUnwantedException(// deno-lint-ignore no-explicit-any
e, expected, message, operator) {
    if (typeof expected === "string") {
        // The use case of doesNotThrow(fn, message);
        throw new AssertionError({
            message: `Got unwanted exception: ${expected}\nActual message: "${e.message}"`,
            operator: operator.name
        });
    } else if (typeof expected === "function" && expected.prototype !== undefined) {
        // The use case of doesNotThrow(fn, Error, message);
        if (e instanceof expected) {
            let msg = `Got unwanted exception: ${e.constructor?.name}`;
            if (message) {
                msg += ` ${String(message)}`;
            }
            throw new AssertionError({
                message: msg,
                operator: operator.name
            });
        } else if (expected.prototype instanceof Error) {
            throw e;
        } else {
            const result = expected(e);
            if (result === true) {
                let msg1 = `Got unwanted rejection.\nActual message: "${e.message}"`;
                if (message) {
                    msg1 += ` ${String(message)}`;
                }
                throw new AssertionError({
                    message: msg1,
                    operator: operator.name
                });
            }
        }
        throw e;
    } else {
        if (message) {
            throw new AssertionError({
                message: `Got unwanted exception: ${message}\nActual message: "${e ? e.message : String(e)}"`,
                operator: operator.name
            });
        }
        throw new AssertionError({
            message: `Got unwanted exception.\nActual message: "${e ? e.message : String(e)}"`,
            operator: operator.name
        });
    }
}
/**
 * Throws `value` if the value is not `null` or `undefined`.
 *
 * @param err
 */ // deno-lint-ignore no-explicit-any
function ifError(err) {
    if (err !== null && err !== undefined) {
        let message = "ifError got unwanted exception: ";
        if (typeof err === "object" && typeof err.message === "string") {
            if (err.message.length === 0 && err.constructor) {
                message += err.constructor.name;
            } else {
                message += err.message;
            }
        } else {
            message += inspect(err);
        }
        const newErr = new AssertionError({
            actual: err,
            expected: null,
            operator: "ifError",
            message,
            stackStartFn: ifError
        });
        // Make sure we actually have a stack trace!
        const origStack = err.stack;
        if (typeof origStack === "string") {
            // This will remove any duplicated frames from the error frames taken
            // from within `ifError` and add the original error frames to the newly
            // created ones.
            const tmp2 = origStack.split("\n");
            tmp2.shift();
            // Filter all frames existing in err.stack.
            let tmp1 = newErr.stack?.split("\n");
            for (const errFrame of tmp2){
                // Find the first occurrence of the frame.
                const pos = tmp1?.indexOf(errFrame);
                if (pos !== -1) {
                    // Only keep new frames.
                    tmp1 = tmp1?.slice(0, pos);
                    break;
                }
            }
            newErr.stack = `${tmp1?.join("\n")}\n${tmp2.join("\n")}`;
        }
        throw newErr;
    }
}
function validateThrownError(// deno-lint-ignore no-explicit-any
e, error, message, options) {
    if (typeof error === "string") {
        if (message != null) {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Object",
                "Error",
                "Function",
                "RegExp"
            ], error);
        } else if (typeof e === "object" && e !== null) {
            if (e.message === error) {
                throw new ERR_AMBIGUOUS_ARGUMENT("error/message", `The error message "${e.message}" is identical to the message.`);
            }
        } else if (e === error) {
            throw new ERR_AMBIGUOUS_ARGUMENT("error/message", `The error "${e}" is identical to the message.`);
        }
        message = error;
        error = undefined;
    }
    if (error instanceof Function && error.prototype !== undefined && error.prototype instanceof Error) {
        // error is a constructor
        if (e instanceof error) {
            return true;
        }
        throw createAssertionError({
            message: `The error is expected to be an instance of "${error.name}". Received "${e?.constructor?.name}"\n\nError message:\n\n${e?.message}`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (error instanceof Function) {
        const received = error(e);
        if (received === true) {
            return true;
        }
        throw createAssertionError({
            message: `The ${options.validationFunctionName ? `"${options.validationFunctionName}" validation` : "validation"} function is expected to return "true". Received ${inspect(received)}\n\nCaught error:\n\n${e}`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (error instanceof RegExp) {
        if (error.test(String(e))) {
            return true;
        }
        throw createAssertionError({
            message: `The input did not match the regular expression ${error.toString()}. Input:\n\n'${String(e)}'\n`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (typeof error === "object" && error !== null) {
        const keys = Object.keys(error);
        if (error instanceof Error) {
            keys.push("name", "message");
        }
        for (const k of keys){
            if (e == null) {
                throw createAssertionError({
                    message: message || "object is expected to thrown, but got null",
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (typeof e === "string") {
                throw createAssertionError({
                    message: message || `object is expected to thrown, but got string: ${e}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (typeof e === "number") {
                throw createAssertionError({
                    message: message || `object is expected to thrown, but got number: ${e}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (!(k in e)) {
                throw createAssertionError({
                    message: message || `A key in the expected object is missing: ${k}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            const actual = e[k];
            // deno-lint-ignore no-explicit-any
            const expected = error[k];
            if (typeof actual === "string" && expected instanceof RegExp) {
                match(actual, expected);
            } else {
                deepStrictEqual(actual, expected);
            }
        }
        return true;
    }
    if (typeof error === "undefined") {
        return true;
    }
    throw createAssertionError({
        message: `Invalid expectation: ${error}`,
        operator: options.operator.name,
        generatedMessage: true
    });
}
// deno-lint-ignore no-explicit-any
function isValidThenable(maybeThennable) {
    if (!maybeThennable) {
        return false;
    }
    if (maybeThennable instanceof Promise) {
        return true;
    }
    const isThenable = typeof maybeThennable.then === "function" && typeof maybeThennable.catch === "function";
    return isThenable && typeof maybeThennable !== "function";
}
Object.assign(strict, {
    AssertionError,
    deepEqual: deepStrictEqual,
    deepStrictEqual,
    doesNotMatch,
    doesNotReject,
    doesNotThrow,
    equal: strictEqual,
    fail,
    ifError,
    match,
    notDeepEqual: notDeepStrictEqual,
    notDeepStrictEqual,
    notEqual: notStrictEqual,
    notStrictEqual,
    ok,
    rejects,
    strict,
    strictEqual,
    throws
});
export default Object.assign(assert, {
    AssertionError,
    deepEqual,
    deepStrictEqual,
    doesNotMatch,
    doesNotReject,
    doesNotThrow,
    equal,
    fail,
    ifError,
    match,
    notDeepEqual,
    notDeepStrictEqual,
    notEqual,
    notStrictEqual,
    ok,
    rejects,
    strict,
    strictEqual,
    throws
});
export { AssertionError, deepEqual, deepStrictEqual, doesNotMatch, doesNotReject, doesNotThrow, equal, fail, ifError, match, notDeepEqual, notDeepStrictEqual, notEqual, notStrictEqual, ok, rejects, strict, strictEqual, throws };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvYXNzZXJ0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBkZW5vLWxpbnQtaWdub3JlLWZpbGUgYmFuLXR5cGVzXG5pbXBvcnQge1xuICBBc3NlcnRpb25FcnJvcixcbiAgQXNzZXJ0aW9uRXJyb3JDb25zdHJ1Y3Rvck9wdGlvbnMsXG59IGZyb20gXCIuL2Fzc2VydGlvbl9lcnJvci50c1wiO1xuaW1wb3J0ICogYXMgYXNzZXJ0cyBmcm9tIFwiLi4vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG5pbXBvcnQgeyBpbnNwZWN0IH0gZnJvbSBcIi4vdXRpbC50c1wiO1xuaW1wb3J0IHtcbiAgRVJSX0FNQklHVU9VU19BUkdVTUVOVCxcbiAgRVJSX0lOVkFMSURfQVJHX1RZUEUsXG4gIEVSUl9JTlZBTElEX0FSR19WQUxVRSxcbiAgRVJSX0lOVkFMSURfUkVUVVJOX1ZBTFVFLFxuICBFUlJfTUlTU0lOR19BUkdTLFxufSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IGlzRGVlcEVxdWFsIH0gZnJvbSBcIi4vaW50ZXJuYWwvdXRpbC9jb21wYXJpc29ucy50c1wiO1xuXG5mdW5jdGlvbiBpbm5lckZhaWwob2JqOiB7XG4gIGFjdHVhbD86IHVua25vd247XG4gIGV4cGVjdGVkPzogdW5rbm93bjtcbiAgbWVzc2FnZT86IHN0cmluZyB8IEVycm9yO1xuICBvcGVyYXRvcj86IHN0cmluZztcbn0pIHtcbiAgaWYgKG9iai5tZXNzYWdlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICB0aHJvdyBvYmoubWVzc2FnZTtcbiAgfVxuXG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgYWN0dWFsOiBvYmouYWN0dWFsLFxuICAgIGV4cGVjdGVkOiBvYmouZXhwZWN0ZWQsXG4gICAgbWVzc2FnZTogb2JqLm1lc3NhZ2UsXG4gICAgb3BlcmF0b3I6IG9iai5vcGVyYXRvcixcbiAgfSk7XG59XG5cbmludGVyZmFjZSBFeHRlbmRlZEFzc2VydGlvbkVycm9yQ29uc3RydWN0b3JPcHRpb25zXG4gIGV4dGVuZHMgQXNzZXJ0aW9uRXJyb3JDb25zdHJ1Y3Rvck9wdGlvbnMge1xuICBnZW5lcmF0ZWRNZXNzYWdlPzogYm9vbGVhbjtcbn1cblxuLy8gVE9ETyh1a2kwMGEpOiBUaGlzIGZ1bmN0aW9uIGlzIGEgd29ya2Fyb3VuZCBmb3Igc2V0dGluZyB0aGUgYGdlbmVyYXRlZE1lc3NhZ2VgIHByb3BlcnR5IGZsZXhpYmx5LlxuZnVuY3Rpb24gY3JlYXRlQXNzZXJ0aW9uRXJyb3IoXG4gIG9wdGlvbnM6IEV4dGVuZGVkQXNzZXJ0aW9uRXJyb3JDb25zdHJ1Y3Rvck9wdGlvbnMsXG4pOiBBc3NlcnRpb25FcnJvciB7XG4gIGNvbnN0IGVycm9yID0gbmV3IEFzc2VydGlvbkVycm9yKG9wdGlvbnMpO1xuICBpZiAob3B0aW9ucy5nZW5lcmF0ZWRNZXNzYWdlKSB7XG4gICAgZXJyb3IuZ2VuZXJhdGVkTWVzc2FnZSA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIGVycm9yO1xufVxuXG4vKiogQ29udmVydHMgdGhlIHN0ZCBhc3NlcnRpb24gZXJyb3IgdG8gbm9kZS5qcyBhc3NlcnRpb24gZXJyb3IgKi9cbmZ1bmN0aW9uIHRvTm9kZShcbiAgZm46ICgpID0+IHZvaWQsXG4gIG9wdHM/OiB7XG4gICAgYWN0dWFsOiB1bmtub3duO1xuICAgIGV4cGVjdGVkOiB1bmtub3duO1xuICAgIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcjtcbiAgICBvcGVyYXRvcj86IHN0cmluZztcbiAgfSxcbikge1xuICBjb25zdCB7IG9wZXJhdG9yLCBtZXNzYWdlLCBhY3R1YWwsIGV4cGVjdGVkIH0gPSBvcHRzIHx8IHt9O1xuICB0cnkge1xuICAgIGZuKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIGFzc2VydHMuQXNzZXJ0aW9uRXJyb3IpIHtcbiAgICAgIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgICAgIG9wZXJhdG9yLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgYWN0dWFsLFxuICAgICAgICAgIGV4cGVjdGVkLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IG1lc3NhZ2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgICAgIG9wZXJhdG9yLFxuICAgICAgICAgIG1lc3NhZ2U6IGUubWVzc2FnZSxcbiAgICAgICAgICBhY3R1YWwsXG4gICAgICAgICAgZXhwZWN0ZWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydChhY3R1YWw6IHVua25vd24sIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcik6IGFzc2VydHMgYWN0dWFsIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZTogXCJObyB2YWx1ZSBhcmd1bWVudCBwYXNzZWQgdG8gYGFzc2VydC5vaygpYFwiLFxuICAgIH0pO1xuICB9XG4gIHRvTm9kZShcbiAgICAoKSA9PiBhc3NlcnRzLmFzc2VydChhY3R1YWwpLFxuICAgIHsgbWVzc2FnZSwgYWN0dWFsLCBleHBlY3RlZDogdHJ1ZSB9LFxuICApO1xufVxuY29uc3Qgb2sgPSBhc3NlcnQ7XG5cbmZ1bmN0aW9uIHRocm93cyhcbiAgZm46ICgpID0+IHZvaWQsXG4gIGVycm9yPzogUmVnRXhwIHwgRnVuY3Rpb24gfCBFcnJvcixcbiAgbWVzc2FnZT86IHN0cmluZyxcbikge1xuICAvLyBDaGVjayBhcmcgdHlwZXNcbiAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwiZm5cIiwgXCJmdW5jdGlvblwiLCBmbik7XG4gIH1cbiAgaWYgKFxuICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJiBlcnJvciAhPT0gbnVsbCAmJlxuICAgIE9iamVjdC5nZXRQcm90b3R5cGVPZihlcnJvcikgPT09IE9iamVjdC5wcm90b3R5cGUgJiZcbiAgICBPYmplY3Qua2V5cyhlcnJvcikubGVuZ3RoID09PSAwXG4gICkge1xuICAgIC8vIGVycm9yIGlzIGFuIGVtcHR5IG9iamVjdFxuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXG4gICAgICBcImVycm9yXCIsXG4gICAgICBlcnJvcixcbiAgICAgIFwibWF5IG5vdCBiZSBhbiBlbXB0eSBvYmplY3RcIixcbiAgICApO1xuICB9XG4gIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChcbiAgICAgICEoZXJyb3IgaW5zdGFuY2VvZiBSZWdFeHApICYmIHR5cGVvZiBlcnJvciAhPT0gXCJmdW5jdGlvblwiICYmXG4gICAgICAhKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpICYmIHR5cGVvZiBlcnJvciAhPT0gXCJvYmplY3RcIlxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwiZXJyb3JcIiwgW1xuICAgICAgICBcIkZ1bmN0aW9uXCIsXG4gICAgICAgIFwiRXJyb3JcIixcbiAgICAgICAgXCJSZWdFeHBcIixcbiAgICAgICAgXCJPYmplY3RcIixcbiAgICAgIF0sIGVycm9yKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGVycm9yICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBlcnJvciAhPT0gXCJzdHJpbmdcIiAmJlxuICAgICAgIShlcnJvciBpbnN0YW5jZW9mIFJlZ0V4cCkgJiYgdHlwZW9mIGVycm9yICE9PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICEoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikgJiYgdHlwZW9mIGVycm9yICE9PSBcIm9iamVjdFwiXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJlcnJvclwiLCBbXG4gICAgICAgIFwiRnVuY3Rpb25cIixcbiAgICAgICAgXCJFcnJvclwiLFxuICAgICAgICBcIlJlZ0V4cFwiLFxuICAgICAgICBcIk9iamVjdFwiLFxuICAgICAgXSwgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENoZWNrcyB0ZXN0IGZ1bmN0aW9uXG4gIHRyeSB7XG4gICAgZm4oKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChcbiAgICAgIHZhbGlkYXRlVGhyb3duRXJyb3IoZSwgZXJyb3IsIG1lc3NhZ2UsIHtcbiAgICAgICAgb3BlcmF0b3I6IHRocm93cyxcbiAgICAgIH0pXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGlmIChtZXNzYWdlKSB7XG4gICAgbGV0IG1zZyA9IGBNaXNzaW5nIGV4cGVjdGVkIGV4Y2VwdGlvbjogJHttZXNzYWdlfWA7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJmdW5jdGlvblwiICYmIGVycm9yPy5uYW1lKSB7XG4gICAgICBtc2cgPSBgTWlzc2luZyBleHBlY3RlZCBleGNlcHRpb24gKCR7ZXJyb3IubmFtZX0pOiAke21lc3NhZ2V9YDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKHtcbiAgICAgIG1lc3NhZ2U6IG1zZyxcbiAgICAgIG9wZXJhdG9yOiBcInRocm93c1wiLFxuICAgICAgYWN0dWFsOiB1bmRlZmluZWQsXG4gICAgICBleHBlY3RlZDogZXJyb3IsXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVycm9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gVXNlIGNhc2Ugb2YgdGhyb3dzKGZuLCBtZXNzYWdlKVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOiBgTWlzc2luZyBleHBlY3RlZCBleGNlcHRpb246ICR7ZXJyb3J9YCxcbiAgICAgIG9wZXJhdG9yOiBcInRocm93c1wiLFxuICAgICAgYWN0dWFsOiB1bmRlZmluZWQsXG4gICAgICBleHBlY3RlZDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJmdW5jdGlvblwiICYmIGVycm9yPy5wcm90b3R5cGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOiBgTWlzc2luZyBleHBlY3RlZCBleGNlcHRpb24gKCR7ZXJyb3IubmFtZX0pLmAsXG4gICAgICBvcGVyYXRvcjogXCJ0aHJvd3NcIixcbiAgICAgIGFjdHVhbDogdW5kZWZpbmVkLFxuICAgICAgZXhwZWN0ZWQ6IGVycm9yLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOiBcIk1pc3NpbmcgZXhwZWN0ZWQgZXhjZXB0aW9uLlwiLFxuICAgICAgb3BlcmF0b3I6IFwidGhyb3dzXCIsXG4gICAgICBhY3R1YWw6IHVuZGVmaW5lZCxcbiAgICAgIGV4cGVjdGVkOiBlcnJvcixcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkb2VzTm90VGhyb3coXG4gIGZuOiAoKSA9PiB2b2lkLFxuICBtZXNzYWdlPzogc3RyaW5nLFxuKTogdm9pZDtcbmZ1bmN0aW9uIGRvZXNOb3RUaHJvdyhcbiAgZm46ICgpID0+IHZvaWQsXG4gIGVycm9yPzogRnVuY3Rpb24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbik6IHZvaWQ7XG5mdW5jdGlvbiBkb2VzTm90VGhyb3coXG4gIGZuOiAoKSA9PiB2b2lkLFxuICBlcnJvcj86IFJlZ0V4cCxcbiAgbWVzc2FnZT86IHN0cmluZyxcbik6IHZvaWQ7XG5mdW5jdGlvbiBkb2VzTm90VGhyb3coXG4gIGZuOiAoKSA9PiB2b2lkLFxuICBleHBlY3RlZD86IEZ1bmN0aW9uIHwgUmVnRXhwIHwgc3RyaW5nLFxuICBtZXNzYWdlPzogc3RyaW5nIHwgRXJyb3IsXG4pIHtcbiAgLy8gQ2hlY2sgYXJnIHR5cGVcbiAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwiZm5cIiwgXCJmdW5jdGlvblwiLCBmbik7XG4gIH0gZWxzZSBpZiAoXG4gICAgIShleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkgJiYgdHlwZW9mIGV4cGVjdGVkICE9PSBcImZ1bmN0aW9uXCIgJiZcbiAgICB0eXBlb2YgZXhwZWN0ZWQgIT09IFwic3RyaW5nXCIgJiYgdHlwZW9mIGV4cGVjdGVkICE9PSBcInVuZGVmaW5lZFwiXG4gICkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcImV4cGVjdGVkXCIsIFtcIkZ1bmN0aW9uXCIsIFwiUmVnRXhwXCJdLCBmbik7XG4gIH1cblxuICAvLyBDaGVja3MgdGVzdCBmdW5jdGlvblxuICB0cnkge1xuICAgIGZuKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBnb3RVbndhbnRlZEV4Y2VwdGlvbihlLCBleHBlY3RlZCwgbWVzc2FnZSwgZG9lc05vdFRocm93KTtcbiAgfVxuICByZXR1cm47XG59XG5cbmZ1bmN0aW9uIGVxdWFsKFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiB1bmtub3duLFxuICBtZXNzYWdlPzogc3RyaW5nIHwgRXJyb3IsXG4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9NSVNTSU5HX0FSR1MoXCJhY3R1YWxcIiwgXCJleHBlY3RlZFwiKTtcbiAgfVxuXG4gIGlmIChhY3R1YWwgPT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoTnVtYmVyLmlzTmFOKGFjdHVhbCkgJiYgTnVtYmVyLmlzTmFOKGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKG1lc3NhZ2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHRocm93IG1lc3NhZ2U7XG4gIH1cblxuICB0b05vZGUoXG4gICAgKCkgPT4gYXNzZXJ0cy5hc3NlcnRTdHJpY3RFcXVhbHMoYWN0dWFsLCBleHBlY3RlZCksXG4gICAge1xuICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCBgJHthY3R1YWx9ID09ICR7ZXhwZWN0ZWR9YCxcbiAgICAgIG9wZXJhdG9yOiBcIj09XCIsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICB9LFxuICApO1xufVxuZnVuY3Rpb24gbm90RXF1YWwoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcImFjdHVhbFwiLCBcImV4cGVjdGVkXCIpO1xuICB9XG5cbiAgaWYgKE51bWJlci5pc05hTihhY3R1YWwpICYmIE51bWJlci5pc05hTihleHBlY3RlZCkpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZTogYCR7YWN0dWFsfSAhPSAke2V4cGVjdGVkfWAsXG4gICAgICBvcGVyYXRvcjogXCIhPVwiLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgfSk7XG4gIH1cbiAgaWYgKGFjdHVhbCAhPSBleHBlY3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKG1lc3NhZ2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHRocm93IG1lc3NhZ2U7XG4gIH1cblxuICB0b05vZGUoXG4gICAgKCkgPT4gYXNzZXJ0cy5hc3NlcnROb3RTdHJpY3RFcXVhbHMoYWN0dWFsLCBleHBlY3RlZCksXG4gICAge1xuICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCBgJHthY3R1YWx9ICE9ICR7ZXhwZWN0ZWR9YCxcbiAgICAgIG9wZXJhdG9yOiBcIiE9XCIsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICB9LFxuICApO1xufVxuZnVuY3Rpb24gc3RyaWN0RXF1YWwoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcImFjdHVhbFwiLCBcImV4cGVjdGVkXCIpO1xuICB9XG5cbiAgdG9Ob2RlKFxuICAgICgpID0+IGFzc2VydHMuYXNzZXJ0U3RyaWN0RXF1YWxzKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgIHsgbWVzc2FnZSwgb3BlcmF0b3I6IFwic3RyaWN0RXF1YWxcIiwgYWN0dWFsLCBleHBlY3RlZCB9LFxuICApO1xufVxuZnVuY3Rpb24gbm90U3RyaWN0RXF1YWwoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcImFjdHVhbFwiLCBcImV4cGVjdGVkXCIpO1xuICB9XG5cbiAgdG9Ob2RlKFxuICAgICgpID0+IGFzc2VydHMuYXNzZXJ0Tm90U3RyaWN0RXF1YWxzKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgIHsgbWVzc2FnZSwgYWN0dWFsLCBleHBlY3RlZCwgb3BlcmF0b3I6IFwibm90U3RyaWN0RXF1YWxcIiB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBkZWVwRXF1YWwoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcImFjdHVhbFwiLCBcImV4cGVjdGVkXCIpO1xuICB9XG5cbiAgaWYgKCFpc0RlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIGlubmVyRmFpbCh7IGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG9wZXJhdG9yOiBcImRlZXBFcXVhbFwiIH0pO1xuICB9XG59XG5mdW5jdGlvbiBub3REZWVwRXF1YWwoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcixcbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcImFjdHVhbFwiLCBcImV4cGVjdGVkXCIpO1xuICB9XG5cbiAgaWYgKGlzRGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgaW5uZXJGYWlsKHsgYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgb3BlcmF0b3I6IFwibm90RGVlcEVxdWFsXCIgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGRlZXBTdHJpY3RFcXVhbChcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZDogdW5rbm93bixcbiAgbWVzc2FnZT86IHN0cmluZyB8IEVycm9yLFxuKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBFUlJfTUlTU0lOR19BUkdTKFwiYWN0dWFsXCIsIFwiZXhwZWN0ZWRcIik7XG4gIH1cblxuICB0b05vZGUoXG4gICAgKCkgPT4gYXNzZXJ0cy5hc3NlcnRFcXVhbHMoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgeyBtZXNzYWdlLCBhY3R1YWwsIGV4cGVjdGVkLCBvcGVyYXRvcjogXCJkZWVwU3RyaWN0RXF1YWxcIiB9LFxuICApO1xufVxuZnVuY3Rpb24gbm90RGVlcFN0cmljdEVxdWFsKFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiB1bmtub3duLFxuICBtZXNzYWdlPzogc3RyaW5nIHwgRXJyb3IsXG4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9NSVNTSU5HX0FSR1MoXCJhY3R1YWxcIiwgXCJleHBlY3RlZFwiKTtcbiAgfVxuXG4gIHRvTm9kZShcbiAgICAoKSA9PiBhc3NlcnRzLmFzc2VydE5vdEVxdWFscyhhY3R1YWwsIGV4cGVjdGVkKSxcbiAgICB7IG1lc3NhZ2UsIGFjdHVhbCwgZXhwZWN0ZWQsIG9wZXJhdG9yOiBcImRlZXBOb3RTdHJpY3RFcXVhbFwiIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIGZhaWwobWVzc2FnZT86IHN0cmluZyB8IEVycm9yKTogbmV2ZXIge1xuICBpZiAodHlwZW9mIG1lc3NhZ2UgPT09IFwic3RyaW5nXCIgfHwgbWVzc2FnZSA9PSBudWxsKSB7XG4gICAgdGhyb3cgY3JlYXRlQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZTogbWVzc2FnZSA/PyBcIkZhaWxlZFwiLFxuICAgICAgb3BlcmF0b3I6IFwiZmFpbFwiLFxuICAgICAgZ2VuZXJhdGVkTWVzc2FnZTogbWVzc2FnZSA9PSBudWxsLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG1lc3NhZ2U7XG4gIH1cbn1cbmZ1bmN0aW9uIG1hdGNoKGFjdHVhbDogc3RyaW5nLCByZWdleHA6IFJlZ0V4cCwgbWVzc2FnZT86IHN0cmluZyB8IEVycm9yKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBFUlJfTUlTU0lOR19BUkdTKFwiYWN0dWFsXCIsIFwicmVnZXhwXCIpO1xuICB9XG4gIGlmICghKHJlZ2V4cCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJyZWdleHBcIiwgXCJSZWdFeHBcIiwgcmVnZXhwKTtcbiAgfVxuXG4gIHRvTm9kZShcbiAgICAoKSA9PiBhc3NlcnRzLmFzc2VydE1hdGNoKGFjdHVhbCwgcmVnZXhwKSxcbiAgICB7IG1lc3NhZ2UsIGFjdHVhbCwgZXhwZWN0ZWQ6IHJlZ2V4cCwgb3BlcmF0b3I6IFwibWF0Y2hcIiB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBkb2VzTm90TWF0Y2goXG4gIHN0cmluZzogc3RyaW5nLFxuICByZWdleHA6IFJlZ0V4cCxcbiAgbWVzc2FnZT86IHN0cmluZyB8IEVycm9yLFxuKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBFUlJfTUlTU0lOR19BUkdTKFwic3RyaW5nXCIsIFwicmVnZXhwXCIpO1xuICB9XG4gIGlmICghKHJlZ2V4cCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJyZWdleHBcIiwgXCJSZWdFeHBcIiwgcmVnZXhwKTtcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChtZXNzYWdlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHRocm93IG1lc3NhZ2U7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8XG4gICAgICAgIGBUaGUgXCJzdHJpbmdcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIHN0cmluZ30gKCR7XG4gICAgICAgICAgaW5zcGVjdChzdHJpbmcpXG4gICAgICAgIH0pYCxcbiAgICAgIGFjdHVhbDogc3RyaW5nLFxuICAgICAgZXhwZWN0ZWQ6IHJlZ2V4cCxcbiAgICAgIG9wZXJhdG9yOiBcImRvZXNOb3RNYXRjaFwiLFxuICAgIH0pO1xuICB9XG5cbiAgdG9Ob2RlKFxuICAgICgpID0+IGFzc2VydHMuYXNzZXJ0Tm90TWF0Y2goc3RyaW5nLCByZWdleHApLFxuICAgIHsgbWVzc2FnZSwgYWN0dWFsOiBzdHJpbmcsIGV4cGVjdGVkOiByZWdleHAsIG9wZXJhdG9yOiBcImRvZXNOb3RNYXRjaFwiIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIHN0cmljdChhY3R1YWw6IHVua25vd24sIG1lc3NhZ2U/OiBzdHJpbmcgfCBFcnJvcik6IGFzc2VydHMgYWN0dWFsIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZTogXCJObyB2YWx1ZSBhcmd1bWVudCBwYXNzZWQgdG8gYGFzc2VydC5vaygpYFwiLFxuICAgIH0pO1xuICB9XG4gIGFzc2VydChhY3R1YWwsIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiByZWplY3RzKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBhc3luY0ZuOiBQcm9taXNlPGFueT4gfCAoKCkgPT4gUHJvbWlzZTxhbnk+KSxcbiAgZXJyb3I/OiBSZWdFeHAgfCBGdW5jdGlvbiB8IEVycm9yLFxuKTogUHJvbWlzZTx2b2lkPjtcblxuZnVuY3Rpb24gcmVqZWN0cyhcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgYXN5bmNGbjogUHJvbWlzZTxhbnk+IHwgKCgpID0+IFByb21pc2U8YW55PiksXG4gIG1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+O1xuXG4vLyBJbnRlbnRpb25hbGx5IGF2b2lkIHVzaW5nIGFzeW5jL2F3YWl0IGJlY2F1c2UgdGVzdC1hc3NlcnQtYXN5bmMuanMgcmVxdWlyZXMgaXRcbmZ1bmN0aW9uIHJlamVjdHMoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFzeW5jRm46IFByb21pc2U8YW55PiB8ICgoKSA9PiBQcm9taXNlPGFueT4pLFxuICBlcnJvcj86IFJlZ0V4cCB8IEZ1bmN0aW9uIHwgRXJyb3IgfCBzdHJpbmcsXG4gIG1lc3NhZ2U/OiBzdHJpbmcsXG4pIHtcbiAgbGV0IHByb21pc2U6IFByb21pc2U8dm9pZD47XG4gIGlmICh0eXBlb2YgYXN5bmNGbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgdHJ5IHtcbiAgICAgIHByb21pc2UgPSBhc3luY0ZuKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBJZiBgYXN5bmNGbmAgdGhyb3dzIGFuIGVycm9yIHN5bmNocm9ub3VzbHksIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhIHJlamVjdGVkIHByb21pc2UuXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzVmFsaWRUaGVuYWJsZShwcm9taXNlKSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgRVJSX0lOVkFMSURfUkVUVVJOX1ZBTFVFKFxuICAgICAgICAgIFwiaW5zdGFuY2Ugb2YgUHJvbWlzZVwiLFxuICAgICAgICAgIFwicHJvbWlzZUZuXCIsXG4gICAgICAgICAgcHJvbWlzZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2UgaWYgKCFpc1ZhbGlkVGhlbmFibGUoYXN5bmNGbikpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoXG4gICAgICBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJwcm9taXNlRm5cIiwgW1wiZnVuY3Rpb25cIiwgXCJQcm9taXNlXCJdLCBhc3luY0ZuKSxcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHByb21pc2UgPSBhc3luY0ZuO1xuICB9XG5cbiAgZnVuY3Rpb24gb25GdWxmaWxsZWQoKSB7XG4gICAgbGV0IG1lc3NhZ2UgPSBcIk1pc3NpbmcgZXhwZWN0ZWQgcmVqZWN0aW9uXCI7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgbWVzc2FnZSArPSBgOiAke2Vycm9yfWA7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXJyb3IgPT09IFwiZnVuY3Rpb25cIiAmJiBlcnJvci5wcm90b3R5cGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWVzc2FnZSArPSBgICgke2Vycm9yLm5hbWV9KS5gO1xuICAgIH0gZWxzZSB7XG4gICAgICBtZXNzYWdlICs9IFwiLlwiO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoY3JlYXRlQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiBcInJlamVjdHNcIixcbiAgICAgIGdlbmVyYXRlZE1lc3NhZ2U6IHRydWUsXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBjYW1lbGNhc2VcbiAgZnVuY3Rpb24gcmVqZWN0c19vblJlamVjdGVkKGU6IEVycm9yKSB7IC8vIFRPRE8odWtpMDBhKTogSW4gb3JkZXIgdG8gYHRlc3QtYXNzZXJ0LWFzeW5jLmpzYCBwYXNzLCBpbnRlbnRpb25hbGx5IGFkZHMgYHJlamVjdHNfYCBhcyBhIHByZWZpeC5cbiAgICBpZiAoXG4gICAgICB2YWxpZGF0ZVRocm93bkVycm9yKGUsIGVycm9yLCBtZXNzYWdlLCB7XG4gICAgICAgIG9wZXJhdG9yOiByZWplY3RzLFxuICAgICAgICB2YWxpZGF0aW9uRnVuY3Rpb25OYW1lOiBcInZhbGlkYXRlXCIsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwcm9taXNlLnRoZW4ob25GdWxmaWxsZWQsIHJlamVjdHNfb25SZWplY3RlZCk7XG59XG5cbmZ1bmN0aW9uIGRvZXNOb3RSZWplY3QoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFzeW5jRm46IFByb21pc2U8YW55PiB8ICgoKSA9PiBQcm9taXNlPGFueT4pLFxuICBlcnJvcj86IFJlZ0V4cCB8IEZ1bmN0aW9uLFxuKTogUHJvbWlzZTx2b2lkPjtcblxuZnVuY3Rpb24gZG9lc05vdFJlamVjdChcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgYXN5bmNGbjogUHJvbWlzZTxhbnk+IHwgKCgpID0+IFByb21pc2U8YW55PiksXG4gIG1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+O1xuXG4vLyBJbnRlbnRpb25hbGx5IGF2b2lkIHVzaW5nIGFzeW5jL2F3YWl0IGJlY2F1c2UgdGVzdC1hc3NlcnQtYXN5bmMuanMgcmVxdWlyZXMgaXRcbmZ1bmN0aW9uIGRvZXNOb3RSZWplY3QoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFzeW5jRm46IFByb21pc2U8YW55PiB8ICgoKSA9PiBQcm9taXNlPGFueT4pLFxuICBlcnJvcj86IFJlZ0V4cCB8IEZ1bmN0aW9uIHwgc3RyaW5nLFxuICBtZXNzYWdlPzogc3RyaW5nLFxuKSB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGxldCBwcm9taXNlOiBQcm9taXNlPGFueT47XG4gIGlmICh0eXBlb2YgYXN5bmNGbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN5bmNGbigpO1xuICAgICAgaWYgKCFpc1ZhbGlkVGhlbmFibGUodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcbiAgICAgICAgICBuZXcgRVJSX0lOVkFMSURfUkVUVVJOX1ZBTFVFKFxuICAgICAgICAgICAgXCJpbnN0YW5jZSBvZiBQcm9taXNlXCIsXG4gICAgICAgICAgICBcInByb21pc2VGblwiLFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHByb21pc2UgPSB2YWx1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBJZiBgYXN5bmNGbmAgdGhyb3dzIGFuIGVycm9yIHN5bmNocm9ub3VzbHksIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhIHJlamVjdGVkIHByb21pc2UuXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKCFpc1ZhbGlkVGhlbmFibGUoYXN5bmNGbikpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoXG4gICAgICBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJwcm9taXNlRm5cIiwgW1wiZnVuY3Rpb25cIiwgXCJQcm9taXNlXCJdLCBhc3luY0ZuKSxcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHByb21pc2UgPSBhc3luY0ZuO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2UudGhlbihcbiAgICAoKSA9PiB7fSxcbiAgICAoZSkgPT4gZ290VW53YW50ZWRFeGNlcHRpb24oZSwgZXJyb3IsIG1lc3NhZ2UsIGRvZXNOb3RSZWplY3QpLFxuICApO1xufVxuXG5mdW5jdGlvbiBnb3RVbndhbnRlZEV4Y2VwdGlvbihcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgZTogYW55LFxuICBleHBlY3RlZDogUmVnRXhwIHwgRnVuY3Rpb24gfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxuICBtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQsXG4gIG9wZXJhdG9yOiBGdW5jdGlvbixcbik6IG5ldmVyIHtcbiAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIikge1xuICAgIC8vIFRoZSB1c2UgY2FzZSBvZiBkb2VzTm90VGhyb3coZm4sIG1lc3NhZ2UpO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOlxuICAgICAgICBgR290IHVud2FudGVkIGV4Y2VwdGlvbjogJHtleHBlY3RlZH1cXG5BY3R1YWwgbWVzc2FnZTogXCIke2UubWVzc2FnZX1cImAsXG4gICAgICBvcGVyYXRvcjogb3BlcmF0b3IubmFtZSxcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChcbiAgICB0eXBlb2YgZXhwZWN0ZWQgPT09IFwiZnVuY3Rpb25cIiAmJiBleHBlY3RlZC5wcm90b3R5cGUgIT09IHVuZGVmaW5lZFxuICApIHtcbiAgICAvLyBUaGUgdXNlIGNhc2Ugb2YgZG9lc05vdFRocm93KGZuLCBFcnJvciwgbWVzc2FnZSk7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBleHBlY3RlZCkge1xuICAgICAgbGV0IG1zZyA9IGBHb3QgdW53YW50ZWQgZXhjZXB0aW9uOiAke2UuY29uc3RydWN0b3I/Lm5hbWV9YDtcbiAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgIG1zZyArPSBgICR7U3RyaW5nKG1lc3NhZ2UpfWA7XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgICBtZXNzYWdlOiBtc2csXG4gICAgICAgIG9wZXJhdG9yOiBvcGVyYXRvci5uYW1lLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChleHBlY3RlZC5wcm90b3R5cGUgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgdGhyb3cgZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZXhwZWN0ZWQoZSk7XG4gICAgICBpZiAocmVzdWx0ID09PSB0cnVlKSB7XG4gICAgICAgIGxldCBtc2cgPSBgR290IHVud2FudGVkIHJlamVjdGlvbi5cXG5BY3R1YWwgbWVzc2FnZTogXCIke2UubWVzc2FnZX1cImA7XG4gICAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgICAgbXNnICs9IGAgJHtTdHJpbmcobWVzc2FnZSl9YDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgICAgIG1lc3NhZ2U6IG1zZyxcbiAgICAgICAgICBvcGVyYXRvcjogb3BlcmF0b3IubmFtZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH0gZWxzZSB7XG4gICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICAgIG1lc3NhZ2U6IGBHb3QgdW53YW50ZWQgZXhjZXB0aW9uOiAke21lc3NhZ2V9XFxuQWN0dWFsIG1lc3NhZ2U6IFwiJHtcbiAgICAgICAgICBlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgICAgIH1cImAsXG4gICAgICAgIG9wZXJhdG9yOiBvcGVyYXRvci5uYW1lLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBtZXNzYWdlOiBgR290IHVud2FudGVkIGV4Y2VwdGlvbi5cXG5BY3R1YWwgbWVzc2FnZTogXCIke1xuICAgICAgICBlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgICB9XCJgLFxuICAgICAgb3BlcmF0b3I6IG9wZXJhdG9yLm5hbWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd3MgYHZhbHVlYCBpZiB0aGUgdmFsdWUgaXMgbm90IGBudWxsYCBvciBgdW5kZWZpbmVkYC5cbiAqXG4gKiBAcGFyYW0gZXJyXG4gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBpZkVycm9yKGVycjogYW55KSB7XG4gIGlmIChlcnIgIT09IG51bGwgJiYgZXJyICE9PSB1bmRlZmluZWQpIHtcbiAgICBsZXQgbWVzc2FnZSA9IFwiaWZFcnJvciBnb3QgdW53YW50ZWQgZXhjZXB0aW9uOiBcIjtcblxuICAgIGlmICh0eXBlb2YgZXJyID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBlcnIubWVzc2FnZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgaWYgKGVyci5tZXNzYWdlLmxlbmd0aCA9PT0gMCAmJiBlcnIuY29uc3RydWN0b3IpIHtcbiAgICAgICAgbWVzc2FnZSArPSBlcnIuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lc3NhZ2UgKz0gZXJyLm1lc3NhZ2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG1lc3NhZ2UgKz0gaW5zcGVjdChlcnIpO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld0VyciA9IG5ldyBBc3NlcnRpb25FcnJvcih7XG4gICAgICBhY3R1YWw6IGVycixcbiAgICAgIGV4cGVjdGVkOiBudWxsLFxuICAgICAgb3BlcmF0b3I6IFwiaWZFcnJvclwiLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIHN0YWNrU3RhcnRGbjogaWZFcnJvcixcbiAgICB9KTtcblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBhY3R1YWxseSBoYXZlIGEgc3RhY2sgdHJhY2UhXG4gICAgY29uc3Qgb3JpZ1N0YWNrID0gZXJyLnN0YWNrO1xuXG4gICAgaWYgKHR5cGVvZiBvcmlnU3RhY2sgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIC8vIFRoaXMgd2lsbCByZW1vdmUgYW55IGR1cGxpY2F0ZWQgZnJhbWVzIGZyb20gdGhlIGVycm9yIGZyYW1lcyB0YWtlblxuICAgICAgLy8gZnJvbSB3aXRoaW4gYGlmRXJyb3JgIGFuZCBhZGQgdGhlIG9yaWdpbmFsIGVycm9yIGZyYW1lcyB0byB0aGUgbmV3bHlcbiAgICAgIC8vIGNyZWF0ZWQgb25lcy5cbiAgICAgIGNvbnN0IHRtcDIgPSBvcmlnU3RhY2suc3BsaXQoXCJcXG5cIik7XG4gICAgICB0bXAyLnNoaWZ0KCk7XG5cbiAgICAgIC8vIEZpbHRlciBhbGwgZnJhbWVzIGV4aXN0aW5nIGluIGVyci5zdGFjay5cbiAgICAgIGxldCB0bXAxID0gbmV3RXJyIS5zdGFjaz8uc3BsaXQoXCJcXG5cIik7XG5cbiAgICAgIGZvciAoY29uc3QgZXJyRnJhbWUgb2YgdG1wMikge1xuICAgICAgICAvLyBGaW5kIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIHRoZSBmcmFtZS5cbiAgICAgICAgY29uc3QgcG9zID0gdG1wMT8uaW5kZXhPZihlcnJGcmFtZSk7XG5cbiAgICAgICAgaWYgKHBvcyAhPT0gLTEpIHtcbiAgICAgICAgICAvLyBPbmx5IGtlZXAgbmV3IGZyYW1lcy5cbiAgICAgICAgICB0bXAxID0gdG1wMT8uc2xpY2UoMCwgcG9zKTtcblxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG5ld0Vyci5zdGFjayA9IGAke3RtcDE/LmpvaW4oXCJcXG5cIil9XFxuJHt0bXAyLmpvaW4oXCJcXG5cIil9YDtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXdFcnI7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFZhbGlkYXRlVGhyb3duRXJyb3JPcHRpb25zIHtcbiAgb3BlcmF0b3I6IEZ1bmN0aW9uO1xuICB2YWxpZGF0aW9uRnVuY3Rpb25OYW1lPzogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVRocm93bkVycm9yKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBlOiBhbnksXG4gIGVycm9yOiBSZWdFeHAgfCBGdW5jdGlvbiB8IEVycm9yIHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgbWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCxcbiAgb3B0aW9uczogVmFsaWRhdGVUaHJvd25FcnJvck9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChtZXNzYWdlICE9IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcbiAgICAgICAgXCJlcnJvclwiLFxuICAgICAgICBbXCJPYmplY3RcIiwgXCJFcnJvclwiLCBcIkZ1bmN0aW9uXCIsIFwiUmVnRXhwXCJdLFxuICAgICAgICBlcnJvcixcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZSA9PT0gXCJvYmplY3RcIiAmJiBlICE9PSBudWxsKSB7XG4gICAgICBpZiAoZS5tZXNzYWdlID09PSBlcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRVJSX0FNQklHVU9VU19BUkdVTUVOVChcbiAgICAgICAgICBcImVycm9yL21lc3NhZ2VcIixcbiAgICAgICAgICBgVGhlIGVycm9yIG1lc3NhZ2UgXCIke2UubWVzc2FnZX1cIiBpcyBpZGVudGljYWwgdG8gdGhlIG1lc3NhZ2UuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGUgPT09IGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0FNQklHVU9VU19BUkdVTUVOVChcbiAgICAgICAgXCJlcnJvci9tZXNzYWdlXCIsXG4gICAgICAgIGBUaGUgZXJyb3IgXCIke2V9XCIgaXMgaWRlbnRpY2FsIHRvIHRoZSBtZXNzYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgICBtZXNzYWdlID0gZXJyb3I7XG4gICAgZXJyb3IgPSB1bmRlZmluZWQ7XG4gIH1cbiAgaWYgKFxuICAgIGVycm9yIGluc3RhbmNlb2YgRnVuY3Rpb24gJiYgZXJyb3IucHJvdG90eXBlICE9PSB1bmRlZmluZWQgJiZcbiAgICBlcnJvci5wcm90b3R5cGUgaW5zdGFuY2VvZiBFcnJvclxuICApIHtcbiAgICAvLyBlcnJvciBpcyBhIGNvbnN0cnVjdG9yXG4gICAgaWYgKGUgaW5zdGFuY2VvZiBlcnJvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHRocm93IGNyZWF0ZUFzc2VydGlvbkVycm9yKHtcbiAgICAgIG1lc3NhZ2U6XG4gICAgICAgIGBUaGUgZXJyb3IgaXMgZXhwZWN0ZWQgdG8gYmUgYW4gaW5zdGFuY2Ugb2YgXCIke2Vycm9yLm5hbWV9XCIuIFJlY2VpdmVkIFwiJHtlPy5jb25zdHJ1Y3Rvcj8ubmFtZX1cIlxcblxcbkVycm9yIG1lc3NhZ2U6XFxuXFxuJHtlPy5tZXNzYWdlfWAsXG4gICAgICBhY3R1YWw6IGUsXG4gICAgICBleHBlY3RlZDogZXJyb3IsXG4gICAgICBvcGVyYXRvcjogb3B0aW9ucy5vcGVyYXRvci5uYW1lLFxuICAgICAgZ2VuZXJhdGVkTWVzc2FnZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIGNvbnN0IHJlY2VpdmVkID0gZXJyb3IoZSk7XG4gICAgaWYgKHJlY2VpdmVkID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgdGhyb3cgY3JlYXRlQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgbWVzc2FnZTogYFRoZSAke1xuICAgICAgICBvcHRpb25zLnZhbGlkYXRpb25GdW5jdGlvbk5hbWVcbiAgICAgICAgICA/IGBcIiR7b3B0aW9ucy52YWxpZGF0aW9uRnVuY3Rpb25OYW1lfVwiIHZhbGlkYXRpb25gXG4gICAgICAgICAgOiBcInZhbGlkYXRpb25cIlxuICAgICAgfSBmdW5jdGlvbiBpcyBleHBlY3RlZCB0byByZXR1cm4gXCJ0cnVlXCIuIFJlY2VpdmVkICR7XG4gICAgICAgIGluc3BlY3QocmVjZWl2ZWQpXG4gICAgICB9XFxuXFxuQ2F1Z2h0IGVycm9yOlxcblxcbiR7ZX1gLFxuICAgICAgYWN0dWFsOiBlLFxuICAgICAgZXhwZWN0ZWQ6IGVycm9yLFxuICAgICAgb3BlcmF0b3I6IG9wdGlvbnMub3BlcmF0b3IubmFtZSxcbiAgICAgIGdlbmVyYXRlZE1lc3NhZ2U6IHRydWUsXG4gICAgfSk7XG4gIH1cbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgaWYgKGVycm9yLnRlc3QoU3RyaW5nKGUpKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHRocm93IGNyZWF0ZUFzc2VydGlvbkVycm9yKHtcbiAgICAgIG1lc3NhZ2U6XG4gICAgICAgIGBUaGUgaW5wdXQgZGlkIG5vdCBtYXRjaCB0aGUgcmVndWxhciBleHByZXNzaW9uICR7ZXJyb3IudG9TdHJpbmcoKX0uIElucHV0Olxcblxcbicke1xuICAgICAgICAgIFN0cmluZyhlKVxuICAgICAgICB9J1xcbmAsXG4gICAgICBhY3R1YWw6IGUsXG4gICAgICBleHBlY3RlZDogZXJyb3IsXG4gICAgICBvcGVyYXRvcjogb3B0aW9ucy5vcGVyYXRvci5uYW1lLFxuICAgICAgZ2VuZXJhdGVkTWVzc2FnZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuICBpZiAodHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmIGVycm9yICE9PSBudWxsKSB7XG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGVycm9yKTtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAga2V5cy5wdXNoKFwibmFtZVwiLCBcIm1lc3NhZ2VcIik7XG4gICAgfVxuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoZSA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZUFzc2VydGlvbkVycm9yKHtcbiAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8IFwib2JqZWN0IGlzIGV4cGVjdGVkIHRvIHRocm93biwgYnV0IGdvdCBudWxsXCIsXG4gICAgICAgICAgYWN0dWFsOiBlLFxuICAgICAgICAgIGV4cGVjdGVkOiBlcnJvcixcbiAgICAgICAgICBvcGVyYXRvcjogb3B0aW9ucy5vcGVyYXRvci5uYW1lLFxuICAgICAgICAgIGdlbmVyYXRlZE1lc3NhZ2U6IG1lc3NhZ2UgPT0gbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICB0aHJvdyBjcmVhdGVBc3NlcnRpb25FcnJvcih7XG4gICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fFxuICAgICAgICAgICAgYG9iamVjdCBpcyBleHBlY3RlZCB0byB0aHJvd24sIGJ1dCBnb3Qgc3RyaW5nOiAke2V9YCxcbiAgICAgICAgICBhY3R1YWw6IGUsXG4gICAgICAgICAgZXhwZWN0ZWQ6IGVycm9yLFxuICAgICAgICAgIG9wZXJhdG9yOiBvcHRpb25zLm9wZXJhdG9yLm5hbWUsXG4gICAgICAgICAgZ2VuZXJhdGVkTWVzc2FnZTogbWVzc2FnZSA9PSBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB0aHJvdyBjcmVhdGVBc3NlcnRpb25FcnJvcih7XG4gICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fFxuICAgICAgICAgICAgYG9iamVjdCBpcyBleHBlY3RlZCB0byB0aHJvd24sIGJ1dCBnb3QgbnVtYmVyOiAke2V9YCxcbiAgICAgICAgICBhY3R1YWw6IGUsXG4gICAgICAgICAgZXhwZWN0ZWQ6IGVycm9yLFxuICAgICAgICAgIG9wZXJhdG9yOiBvcHRpb25zLm9wZXJhdG9yLm5hbWUsXG4gICAgICAgICAgZ2VuZXJhdGVkTWVzc2FnZTogbWVzc2FnZSA9PSBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICghKGsgaW4gZSkpIHtcbiAgICAgICAgdGhyb3cgY3JlYXRlQXNzZXJ0aW9uRXJyb3Ioe1xuICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgYEEga2V5IGluIHRoZSBleHBlY3RlZCBvYmplY3QgaXMgbWlzc2luZzogJHtrfWAsXG4gICAgICAgICAgYWN0dWFsOiBlLFxuICAgICAgICAgIGV4cGVjdGVkOiBlcnJvcixcbiAgICAgICAgICBvcGVyYXRvcjogb3B0aW9ucy5vcGVyYXRvci5uYW1lLFxuICAgICAgICAgIGdlbmVyYXRlZE1lc3NhZ2U6IG1lc3NhZ2UgPT0gbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCBhY3R1YWwgPSBlW2tdO1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGNvbnN0IGV4cGVjdGVkID0gKGVycm9yIGFzIGFueSlba107XG4gICAgICBpZiAodHlwZW9mIGFjdHVhbCA9PT0gXCJzdHJpbmdcIiAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICBtYXRjaChhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHRocm93IGNyZWF0ZUFzc2VydGlvbkVycm9yKHtcbiAgICBtZXNzYWdlOiBgSW52YWxpZCBleHBlY3RhdGlvbjogJHtlcnJvcn1gLFxuICAgIG9wZXJhdG9yOiBvcHRpb25zLm9wZXJhdG9yLm5hbWUsXG4gICAgZ2VuZXJhdGVkTWVzc2FnZTogdHJ1ZSxcbiAgfSk7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBpc1ZhbGlkVGhlbmFibGUobWF5YmVUaGVubmFibGU6IGFueSk6IGJvb2xlYW4ge1xuICBpZiAoIW1heWJlVGhlbm5hYmxlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKG1heWJlVGhlbm5hYmxlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgaXNUaGVuYWJsZSA9IHR5cGVvZiBtYXliZVRoZW5uYWJsZS50aGVuID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICB0eXBlb2YgbWF5YmVUaGVubmFibGUuY2F0Y2ggPT09IFwiZnVuY3Rpb25cIjtcblxuICByZXR1cm4gaXNUaGVuYWJsZSAmJiB0eXBlb2YgbWF5YmVUaGVubmFibGUgIT09IFwiZnVuY3Rpb25cIjtcbn1cblxuT2JqZWN0LmFzc2lnbihzdHJpY3QsIHtcbiAgQXNzZXJ0aW9uRXJyb3IsXG4gIGRlZXBFcXVhbDogZGVlcFN0cmljdEVxdWFsLFxuICBkZWVwU3RyaWN0RXF1YWwsXG4gIGRvZXNOb3RNYXRjaCxcbiAgZG9lc05vdFJlamVjdCxcbiAgZG9lc05vdFRocm93LFxuICBlcXVhbDogc3RyaWN0RXF1YWwsXG4gIGZhaWwsXG4gIGlmRXJyb3IsXG4gIG1hdGNoLFxuICBub3REZWVwRXF1YWw6IG5vdERlZXBTdHJpY3RFcXVhbCxcbiAgbm90RGVlcFN0cmljdEVxdWFsLFxuICBub3RFcXVhbDogbm90U3RyaWN0RXF1YWwsXG4gIG5vdFN0cmljdEVxdWFsLFxuICBvayxcbiAgcmVqZWN0cyxcbiAgc3RyaWN0LFxuICBzdHJpY3RFcXVhbCxcbiAgdGhyb3dzLFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IE9iamVjdC5hc3NpZ24oYXNzZXJ0LCB7XG4gIEFzc2VydGlvbkVycm9yLFxuICBkZWVwRXF1YWwsXG4gIGRlZXBTdHJpY3RFcXVhbCxcbiAgZG9lc05vdE1hdGNoLFxuICBkb2VzTm90UmVqZWN0LFxuICBkb2VzTm90VGhyb3csXG4gIGVxdWFsLFxuICBmYWlsLFxuICBpZkVycm9yLFxuICBtYXRjaCxcbiAgbm90RGVlcEVxdWFsLFxuICBub3REZWVwU3RyaWN0RXF1YWwsXG4gIG5vdEVxdWFsLFxuICBub3RTdHJpY3RFcXVhbCxcbiAgb2ssXG4gIHJlamVjdHMsXG4gIHN0cmljdCxcbiAgc3RyaWN0RXF1YWwsXG4gIHRocm93cyxcbn0pO1xuXG5leHBvcnQge1xuICBBc3NlcnRpb25FcnJvcixcbiAgZGVlcEVxdWFsLFxuICBkZWVwU3RyaWN0RXF1YWwsXG4gIGRvZXNOb3RNYXRjaCxcbiAgZG9lc05vdFJlamVjdCxcbiAgZG9lc05vdFRocm93LFxuICBlcXVhbCxcbiAgZmFpbCxcbiAgaWZFcnJvcixcbiAgbWF0Y2gsXG4gIG5vdERlZXBFcXVhbCxcbiAgbm90RGVlcFN0cmljdEVxdWFsLFxuICBub3RFcXVhbCxcbiAgbm90U3RyaWN0RXF1YWwsXG4gIG9rLFxuICByZWplY3RzLFxuICBzdHJpY3QsXG4gIHN0cmljdEVxdWFsLFxuICB0aHJvd3MsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxrQ0FBa0M7QUFDbEMsU0FDRSxjQUFjLFFBRVQsdUJBQXVCO0FBQzlCLFlBQVksYUFBYSx3QkFBd0I7QUFDakQsU0FBUyxPQUFPLFFBQVEsWUFBWTtBQUNwQyxTQUNFLHNCQUFzQixFQUN0QixvQkFBb0IsRUFDcEIscUJBQXFCLEVBQ3JCLHdCQUF3QixFQUN4QixnQkFBZ0IsUUFDWCx1QkFBdUI7QUFDOUIsU0FBUyxXQUFXLFFBQVEsaUNBQWlDO0FBRTdELFNBQVMsVUFBVSxHQUtsQixFQUFFO0lBQ0QsSUFBSSxJQUFJLE9BQU8sWUFBWSxPQUFPO1FBQ2hDLE1BQU0sSUFBSSxPQUFPLENBQUM7SUFDcEIsQ0FBQztJQUVELE1BQU0sSUFBSSxlQUFlO1FBQ3ZCLFFBQVEsSUFBSSxNQUFNO1FBQ2xCLFVBQVUsSUFBSSxRQUFRO1FBQ3RCLFNBQVMsSUFBSSxPQUFPO1FBQ3BCLFVBQVUsSUFBSSxRQUFRO0lBQ3hCLEdBQUc7QUFDTDtBQU9BLG9HQUFvRztBQUNwRyxTQUFTLHFCQUNQLE9BQWlELEVBQ2pDO0lBQ2hCLE1BQU0sUUFBUSxJQUFJLGVBQWU7SUFDakMsSUFBSSxRQUFRLGdCQUFnQixFQUFFO1FBQzVCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSTtJQUMvQixDQUFDO0lBQ0QsT0FBTztBQUNUO0FBRUEsZ0VBQWdFLEdBQ2hFLFNBQVMsT0FDUCxFQUFjLEVBQ2QsSUFLQyxFQUNEO0lBQ0EsTUFBTSxFQUFFLFNBQVEsRUFBRSxRQUFPLEVBQUUsT0FBTSxFQUFFLFNBQVEsRUFBRSxHQUFHLFFBQVEsQ0FBQztJQUN6RCxJQUFJO1FBQ0Y7SUFDRixFQUFFLE9B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