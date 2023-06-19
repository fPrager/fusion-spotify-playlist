// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Adapted from Node.js. Copyright Joyent, Inc. and other Node contributors.
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
import { inspect } from "./util.ts";
import { stripColor as removeColors } from "../fmt/colors.ts";
function getConsoleWidth() {
    try {
        return Deno.consoleSize().columns;
    } catch  {
        return 80;
    }
}
// TODO(schwarzkopfb): we should implement Node's concept of "primordials"
// Ref: https://github.com/denoland/deno/issues/6040#issuecomment-637305828
const MathMax = Math.max;
const { Error  } = globalThis;
const { create: ObjectCreate , defineProperty: ObjectDefineProperty , getPrototypeOf: ObjectGetPrototypeOf , getOwnPropertyDescriptor: ObjectGetOwnPropertyDescriptor , keys: ObjectKeys  } = Object;
import { ERR_INVALID_ARG_TYPE } from "./internal/errors.ts";
let blue = "";
let green = "";
let red = "";
let defaultColor = "";
const kReadableOperator = {
    deepStrictEqual: "Expected values to be strictly deep-equal:",
    strictEqual: "Expected values to be strictly equal:",
    strictEqualObject: 'Expected "actual" to be reference-equal to "expected":',
    deepEqual: "Expected values to be loosely deep-equal:",
    notDeepStrictEqual: 'Expected "actual" not to be strictly deep-equal to:',
    notStrictEqual: 'Expected "actual" to be strictly unequal to:',
    notStrictEqualObject: 'Expected "actual" not to be reference-equal to "expected":',
    notDeepEqual: 'Expected "actual" not to be loosely deep-equal to:',
    notIdentical: "Values have same structure but are not reference-equal:",
    notDeepEqualUnequal: "Expected values not to be loosely deep-equal:"
};
// Comparing short primitives should just show === / !== instead of using the
// diff.
const kMaxShortLength = 12;
export function copyError(source) {
    const keys = ObjectKeys(source);
    const target = ObjectCreate(ObjectGetPrototypeOf(source));
    for (const key of keys){
        const desc = ObjectGetOwnPropertyDescriptor(source, key);
        if (desc !== undefined) {
            ObjectDefineProperty(target, key, desc);
        }
    }
    ObjectDefineProperty(target, "message", {
        value: source.message
    });
    return target;
}
export function inspectValue(val) {
    // The util.inspect default values could be changed. This makes sure the
    // error messages contain the necessary information nevertheless.
    return inspect(val, {
        compact: true,
        customInspect: false,
        depth: 1000,
        maxArrayLength: Infinity,
        // Assert compares only enumerable properties (with a few exceptions).
        showHidden: false,
        // Assert does not detect proxies currently.
        showProxy: false,
        sorted: true,
        // Inspect getters as we also check them when comparing entries.
        getters: true
    });
}
export function createErrDiff(actual, expected, operator) {
    let other = "";
    let res = "";
    let end = "";
    let skipped = false;
    const actualInspected = inspectValue(actual);
    const actualLines = actualInspected.split("\n");
    const expectedLines = inspectValue(expected).split("\n");
    let i = 0;
    let indicator = "";
    // In case both values are objects or functions explicitly mark them as not
    // reference equal for the `strictEqual` operator.
    if (operator === "strictEqual" && (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null || typeof actual === "function" && typeof expected === "function")) {
        operator = "strictEqualObject";
    }
    // If "actual" and "expected" fit on a single line and they are not strictly
    // equal, check further special handling.
    if (actualLines.length === 1 && expectedLines.length === 1 && actualLines[0] !== expectedLines[0]) {
        // Check for the visible length using the `removeColors()` function, if
        // appropriate.
        const c = inspect.defaultOptions.colors;
        const actualRaw = c ? removeColors(actualLines[0]) : actualLines[0];
        const expectedRaw = c ? removeColors(expectedLines[0]) : expectedLines[0];
        const inputLength = actualRaw.length + expectedRaw.length;
        // If the character length of "actual" and "expected" together is less than
        // kMaxShortLength and if neither is an object and at least one of them is
        // not `zero`, use the strict equal comparison to visualize the output.
        if (inputLength <= kMaxShortLength) {
            if ((typeof actual !== "object" || actual === null) && (typeof expected !== "object" || expected === null) && (actual !== 0 || expected !== 0)) {
                return `${kReadableOperator[operator]}\n\n` + `${actualLines[0]} !== ${expectedLines[0]}\n`;
            }
        } else if (operator !== "strictEqualObject") {
            // If the stderr is a tty and the input length is lower than the current
            // columns per line, add a mismatch indicator below the output. If it is
            // not a tty, use a default value of 80 characters.
            const maxLength = Deno.isatty(Deno.stderr.rid) ? getConsoleWidth() : 80;
            if (inputLength < maxLength) {
                while(actualRaw[i] === expectedRaw[i]){
                    i++;
                }
                // Ignore the first characters.
                if (i > 2) {
                    // Add position indicator for the first mismatch in case it is a
                    // single line and the input length is less than the column length.
                    indicator = `\n  ${" ".repeat(i)}^`;
                    i = 0;
                }
            }
        }
    }
    // Remove all ending lines that match (this optimizes the output for
    // readability by reducing the number of total changed lines).
    let a = actualLines[actualLines.length - 1];
    let b = expectedLines[expectedLines.length - 1];
    while(a === b){
        if (i++ < 3) {
            end = `\n  ${a}${end}`;
        } else {
            other = a;
        }
        actualLines.pop();
        expectedLines.pop();
        if (actualLines.length === 0 || expectedLines.length === 0) {
            break;
        }
        a = actualLines[actualLines.length - 1];
        b = expectedLines[expectedLines.length - 1];
    }
    const maxLines = MathMax(actualLines.length, expectedLines.length);
    // Strict equal with identical objects that are not identical by reference.
    // E.g., assert.deepStrictEqual({ a: Symbol() }, { a: Symbol() })
    if (maxLines === 0) {
        // We have to get the result again. The lines were all removed before.
        const actualLines1 = actualInspected.split("\n");
        // Only remove lines in case it makes sense to collapse those.
        if (actualLines1.length > 50) {
            actualLines1[46] = `${blue}...${defaultColor}`;
            while(actualLines1.length > 47){
                actualLines1.pop();
            }
        }
        return `${kReadableOperator.notIdentical}\n\n${actualLines1.join("\n")}\n`;
    }
    // There were at least five identical lines at the end. Mark a couple of
    // skipped.
    if (i >= 5) {
        end = `\n${blue}...${defaultColor}${end}`;
        skipped = true;
    }
    if (other !== "") {
        end = `\n  ${other}${end}`;
        other = "";
    }
    let printedLines = 0;
    let identical = 0;
    const msg = kReadableOperator[operator] + `\n${green}+ actual${defaultColor} ${red}- expected${defaultColor}`;
    const skippedMsg = ` ${blue}...${defaultColor} Lines skipped`;
    let lines = actualLines;
    let plusMinus = `${green}+${defaultColor}`;
    let maxLength1 = expectedLines.length;
    if (actualLines.length < maxLines) {
        lines = expectedLines;
        plusMinus = `${red}-${defaultColor}`;
        maxLength1 = actualLines.length;
    }
    for(i = 0; i < maxLines; i++){
        if (maxLength1 < i + 1) {
            // If more than two former lines are identical, print them. Collapse them
            // in case more than five lines were identical.
            if (identical > 2) {
                if (identical > 3) {
                    if (identical > 4) {
                        if (identical === 5) {
                            res += `\n  ${lines[i - 3]}`;
                            printedLines++;
                        } else {
                            res += `\n${blue}...${defaultColor}`;
                            skipped = true;
                        }
                    }
                    res += `\n  ${lines[i - 2]}`;
                    printedLines++;
                }
                res += `\n  ${lines[i - 1]}`;
                printedLines++;
            }
            // No identical lines before.
            identical = 0;
            // Add the expected line to the cache.
            if (lines === actualLines) {
                res += `\n${plusMinus} ${lines[i]}`;
            } else {
                other += `\n${plusMinus} ${lines[i]}`;
            }
            printedLines++;
        // Only extra actual lines exist
        // Lines diverge
        } else {
            const expectedLine = expectedLines[i];
            let actualLine = actualLines[i];
            // If the lines diverge, specifically check for lines that only diverge by
            // a trailing comma. In that case it is actually identical and we should
            // mark it as such.
            let divergingLines = actualLine !== expectedLine && (!actualLine.endsWith(",") || actualLine.slice(0, -1) !== expectedLine);
            // If the expected line has a trailing comma but is otherwise identical,
            // add a comma at the end of the actual line. Otherwise the output could
            // look weird as in:
            //
            //   [
            //     1         // No comma at the end!
            // +   2
            //   ]
            //
            if (divergingLines && expectedLine.endsWith(",") && expectedLine.slice(0, -1) === actualLine) {
                divergingLines = false;
                actualLine += ",";
            }
            if (divergingLines) {
                // If more than two former lines are identical, print them. Collapse
                // them in case more than five lines were identical.
                if (identical > 2) {
                    if (identical > 3) {
                        if (identical > 4) {
                            if (identical === 5) {
                                res += `\n  ${actualLines[i - 3]}`;
                                printedLines++;
                            } else {
                                res += `\n${blue}...${defaultColor}`;
                                skipped = true;
                            }
                        }
                        res += `\n  ${actualLines[i - 2]}`;
                        printedLines++;
                    }
                    res += `\n  ${actualLines[i - 1]}`;
                    printedLines++;
                }
                // No identical lines before.
                identical = 0;
                // Add the actual line to the result and cache the expected diverging
                // line so consecutive diverging lines show up as +++--- and not +-+-+-.
                res += `\n${green}+${defaultColor} ${actualLine}`;
                other += `\n${red}-${defaultColor} ${expectedLine}`;
                printedLines += 2;
            // Lines are identical
            } else {
                // Add all cached information to the result before adding other things
                // and reset the cache.
                res += other;
                other = "";
                identical++;
                // The very first identical line since the last diverging line is be
                // added to the result.
                if (identical <= 2) {
                    res += `\n  ${actualLine}`;
                    printedLines++;
                }
            }
        }
        // Inspected object to big (Show ~50 rows max)
        if (printedLines > 50 && i < maxLines - 2) {
            return `${msg}${skippedMsg}\n${res}\n${blue}...${defaultColor}${other}\n` + `${blue}...${defaultColor}`;
        }
    }
    return `${msg}${skipped ? skippedMsg : ""}\n${res}${other}${end}${indicator}`;
}
export class AssertionError extends Error {
    // deno-lint-ignore constructor-super
    constructor(options){
        if (typeof options !== "object" || options === null) {
            throw new ERR_INVALID_ARG_TYPE("options", "Object", options);
        }
        const { message , operator , stackStartFn , details , // Compatibility with older versions.
        stackStartFunction  } = options;
        let { actual , expected  } = options;
        // TODO(schwarzkopfb): `stackTraceLimit` should be added to `ErrorConstructor` in
        // cli/dts/lib.deno.shared_globals.d.ts
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 0;
        if (message != null) {
            super(String(message));
        } else {
            if (Deno.isatty(Deno.stderr.rid)) {
                // Reset on each call to make sure we handle dynamically set environment
                // variables correct.
                if (Deno.noColor) {
                    blue = "";
                    green = "";
                    defaultColor = "";
                    red = "";
                } else {
                    blue = "\u001b[34m";
                    green = "\u001b[32m";
                    defaultColor = "\u001b[39m";
                    red = "\u001b[31m";
                }
            }
            // Prevent the error stack from being visible by duplicating the error
            // in a very close way to the original in case both sides are actually
            // instances of Error.
            if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null && "stack" in actual && actual instanceof Error && "stack" in expected && expected instanceof Error) {
                actual = copyError(actual);
                expected = copyError(expected);
            }
            if (operator === "deepStrictEqual" || operator === "strictEqual") {
                super(createErrDiff(actual, expected, operator));
            } else if (operator === "notDeepStrictEqual" || operator === "notStrictEqual") {
                // In case the objects are equal but the operator requires unequal, show
                // the first object and say A equals B
                let base = kReadableOperator[operator];
                const res = inspectValue(actual).split("\n");
                // In case "actual" is an object or a function, it should not be
                // reference equal.
                if (operator === "notStrictEqual" && (typeof actual === "object" && actual !== null || typeof actual === "function")) {
                    base = kReadableOperator.notStrictEqualObject;
                }
                // Only remove lines in case it makes sense to collapse those.
                if (res.length > 50) {
                    res[46] = `${blue}...${defaultColor}`;
                    while(res.length > 47){
                        res.pop();
                    }
                }
                // Only print a single input.
                if (res.length === 1) {
                    super(`${base}${res[0].length > 5 ? "\n\n" : " "}${res[0]}`);
                } else {
                    super(`${base}\n\n${res.join("\n")}\n`);
                }
            } else {
                let res1 = inspectValue(actual);
                let other = inspectValue(expected);
                const knownOperator = kReadableOperator[operator ?? ""];
                if (operator === "notDeepEqual" && res1 === other) {
                    res1 = `${knownOperator}\n\n${res1}`;
                    if (res1.length > 1024) {
                        res1 = `${res1.slice(0, 1021)}...`;
                    }
                    super(res1);
                } else {
                    if (res1.length > 512) {
                        res1 = `${res1.slice(0, 509)}...`;
                    }
                    if (other.length > 512) {
                        other = `${other.slice(0, 509)}...`;
                    }
                    if (operator === "deepEqual") {
                        res1 = `${knownOperator}\n\n${res1}\n\nshould loosely deep-equal\n\n`;
                    } else {
                        const newOp = kReadableOperator[`${operator}Unequal`];
                        if (newOp) {
                            res1 = `${newOp}\n\n${res1}\n\nshould not loosely deep-equal\n\n`;
                        } else {
                            other = ` ${operator} ${other}`;
                        }
                    }
                    super(`${res1}${other}`);
                }
            }
        }
        Error.stackTraceLimit = limit;
        this.generatedMessage = !message;
        ObjectDefineProperty(this, "name", {
            __proto__: null,
            value: "AssertionError [ERR_ASSERTION]",
            enumerable: false,
            writable: true,
            configurable: true
        });
        this.code = "ERR_ASSERTION";
        if (details) {
            this.actual = undefined;
            this.expected = undefined;
            this.operator = undefined;
            for(let i = 0; i < details.length; i++){
                this["message " + i] = details[i].message;
                this["actual " + i] = details[i].actual;
                this["expected " + i] = details[i].expected;
                this["operator " + i] = details[i].operator;
                this["stack trace " + i] = details[i].stack;
            }
        } else {
            this.actual = actual;
            this.expected = expected;
            this.operator = operator;
        }
        // @ts-ignore this function is not available in lib.dom.d.ts
        Error.captureStackTrace(this, stackStartFn || stackStartFunction);
        // Create error message including the error code in the name.
        this.stack;
        // Reset the name.
        this.name = "AssertionError";
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
    [inspect.custom](_recurseTimes, ctx) {
        // Long strings should not be fully inspected.
        const tmpActual = this.actual;
        const tmpExpected = this.expected;
        for (const name of [
            "actual",
            "expected"
        ]){
            if (typeof this[name] === "string") {
                const value = this[name];
                const lines = value.split("\n");
                if (lines.length > 10) {
                    lines.length = 10;
                    this[name] = `${lines.join("\n")}\n...`;
                } else if (value.length > 512) {
                    this[name] = `${value.slice(512)}...`;
                }
            }
        }
        // This limits the `actual` and `expected` property default inspection to
        // the minimum depth. Otherwise those values would be too verbose compared
        // to the actual error message which contains a combined view of these two
        // input values.
        const result = inspect(this, {
            ...ctx,
            customInspect: false,
            depth: 0
        });
        // Reset the properties after inspection.
        this.actual = tmpActual;
        this.expected = tmpExpected;
        return result;
    }
}
export default AssertionError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvYXNzZXJ0aW9uX2Vycm9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbi8vIEFkYXB0ZWQgZnJvbSBOb2RlLmpzLiBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cblxuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHsgaW5zcGVjdCB9IGZyb20gXCIuL3V0aWwudHNcIjtcbmltcG9ydCB7IHN0cmlwQ29sb3IgYXMgcmVtb3ZlQ29sb3JzIH0gZnJvbSBcIi4uL2ZtdC9jb2xvcnMudHNcIjtcblxuZnVuY3Rpb24gZ2V0Q29uc29sZVdpZHRoKCk6IG51bWJlciB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIERlbm8uY29uc29sZVNpemUoKS5jb2x1bW5zO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gODA7XG4gIH1cbn1cblxuLy8gVE9ETyhzY2h3YXJ6a29wZmIpOiB3ZSBzaG91bGQgaW1wbGVtZW50IE5vZGUncyBjb25jZXB0IG9mIFwicHJpbW9yZGlhbHNcIlxuLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvNjA0MCNpc3N1ZWNvbW1lbnQtNjM3MzA1ODI4XG5jb25zdCBNYXRoTWF4ID0gTWF0aC5tYXg7XG5jb25zdCB7IEVycm9yIH0gPSBnbG9iYWxUaGlzO1xuY29uc3Qge1xuICBjcmVhdGU6IE9iamVjdENyZWF0ZSxcbiAgZGVmaW5lUHJvcGVydHk6IE9iamVjdERlZmluZVByb3BlcnR5LFxuICBnZXRQcm90b3R5cGVPZjogT2JqZWN0R2V0UHJvdG90eXBlT2YsXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcjogT2JqZWN0R2V0T3duUHJvcGVydHlEZXNjcmlwdG9yLFxuICBrZXlzOiBPYmplY3RLZXlzLFxufSA9IE9iamVjdDtcblxuaW1wb3J0IHsgRVJSX0lOVkFMSURfQVJHX1RZUEUgfSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcblxubGV0IGJsdWUgPSBcIlwiO1xubGV0IGdyZWVuID0gXCJcIjtcbmxldCByZWQgPSBcIlwiO1xubGV0IGRlZmF1bHRDb2xvciA9IFwiXCI7XG5cbmNvbnN0IGtSZWFkYWJsZU9wZXJhdG9yOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuICBkZWVwU3RyaWN0RXF1YWw6IFwiRXhwZWN0ZWQgdmFsdWVzIHRvIGJlIHN0cmljdGx5IGRlZXAtZXF1YWw6XCIsXG4gIHN0cmljdEVxdWFsOiBcIkV4cGVjdGVkIHZhbHVlcyB0byBiZSBzdHJpY3RseSBlcXVhbDpcIixcbiAgc3RyaWN0RXF1YWxPYmplY3Q6ICdFeHBlY3RlZCBcImFjdHVhbFwiIHRvIGJlIHJlZmVyZW5jZS1lcXVhbCB0byBcImV4cGVjdGVkXCI6JyxcbiAgZGVlcEVxdWFsOiBcIkV4cGVjdGVkIHZhbHVlcyB0byBiZSBsb29zZWx5IGRlZXAtZXF1YWw6XCIsXG4gIG5vdERlZXBTdHJpY3RFcXVhbDogJ0V4cGVjdGVkIFwiYWN0dWFsXCIgbm90IHRvIGJlIHN0cmljdGx5IGRlZXAtZXF1YWwgdG86JyxcbiAgbm90U3RyaWN0RXF1YWw6ICdFeHBlY3RlZCBcImFjdHVhbFwiIHRvIGJlIHN0cmljdGx5IHVuZXF1YWwgdG86JyxcbiAgbm90U3RyaWN0RXF1YWxPYmplY3Q6XG4gICAgJ0V4cGVjdGVkIFwiYWN0dWFsXCIgbm90IHRvIGJlIHJlZmVyZW5jZS1lcXVhbCB0byBcImV4cGVjdGVkXCI6JyxcbiAgbm90RGVlcEVxdWFsOiAnRXhwZWN0ZWQgXCJhY3R1YWxcIiBub3QgdG8gYmUgbG9vc2VseSBkZWVwLWVxdWFsIHRvOicsXG4gIG5vdElkZW50aWNhbDogXCJWYWx1ZXMgaGF2ZSBzYW1lIHN0cnVjdHVyZSBidXQgYXJlIG5vdCByZWZlcmVuY2UtZXF1YWw6XCIsXG4gIG5vdERlZXBFcXVhbFVuZXF1YWw6IFwiRXhwZWN0ZWQgdmFsdWVzIG5vdCB0byBiZSBsb29zZWx5IGRlZXAtZXF1YWw6XCIsXG59O1xuXG4vLyBDb21wYXJpbmcgc2hvcnQgcHJpbWl0aXZlcyBzaG91bGQganVzdCBzaG93ID09PSAvICE9PSBpbnN0ZWFkIG9mIHVzaW5nIHRoZVxuLy8gZGlmZi5cbmNvbnN0IGtNYXhTaG9ydExlbmd0aCA9IDEyO1xuXG5leHBvcnQgZnVuY3Rpb24gY29weUVycm9yKHNvdXJjZTogRXJyb3IpOiBFcnJvciB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3RLZXlzKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldCA9IE9iamVjdENyZWF0ZShPYmplY3RHZXRQcm90b3R5cGVPZihzb3VyY2UpKTtcbiAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3RHZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuXG4gICAgaWYgKGRlc2MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgT2JqZWN0RGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO1xuICAgIH1cbiAgfVxuICBPYmplY3REZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIFwibWVzc2FnZVwiLCB7IHZhbHVlOiBzb3VyY2UubWVzc2FnZSB9KTtcbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluc3BlY3RWYWx1ZSh2YWw6IHVua25vd24pOiBzdHJpbmcge1xuICAvLyBUaGUgdXRpbC5pbnNwZWN0IGRlZmF1bHQgdmFsdWVzIGNvdWxkIGJlIGNoYW5nZWQuIFRoaXMgbWFrZXMgc3VyZSB0aGVcbiAgLy8gZXJyb3IgbWVzc2FnZXMgY29udGFpbiB0aGUgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIG5ldmVydGhlbGVzcy5cbiAgcmV0dXJuIGluc3BlY3QoXG4gICAgdmFsLFxuICAgIHtcbiAgICAgIGNvbXBhY3Q6IHRydWUsXG4gICAgICBjdXN0b21JbnNwZWN0OiBmYWxzZSxcbiAgICAgIGRlcHRoOiAxMDAwLFxuICAgICAgbWF4QXJyYXlMZW5ndGg6IEluZmluaXR5LFxuICAgICAgLy8gQXNzZXJ0IGNvbXBhcmVzIG9ubHkgZW51bWVyYWJsZSBwcm9wZXJ0aWVzICh3aXRoIGEgZmV3IGV4Y2VwdGlvbnMpLlxuICAgICAgc2hvd0hpZGRlbjogZmFsc2UsXG4gICAgICAvLyBBc3NlcnQgZG9lcyBub3QgZGV0ZWN0IHByb3hpZXMgY3VycmVudGx5LlxuICAgICAgc2hvd1Byb3h5OiBmYWxzZSxcbiAgICAgIHNvcnRlZDogdHJ1ZSxcbiAgICAgIC8vIEluc3BlY3QgZ2V0dGVycyBhcyB3ZSBhbHNvIGNoZWNrIHRoZW0gd2hlbiBjb21wYXJpbmcgZW50cmllcy5cbiAgICAgIGdldHRlcnM6IHRydWUsXG4gICAgfSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVyckRpZmYoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG9wZXJhdG9yOiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICBsZXQgb3RoZXIgPSBcIlwiO1xuICBsZXQgcmVzID0gXCJcIjtcbiAgbGV0IGVuZCA9IFwiXCI7XG4gIGxldCBza2lwcGVkID0gZmFsc2U7XG4gIGNvbnN0IGFjdHVhbEluc3BlY3RlZCA9IGluc3BlY3RWYWx1ZShhY3R1YWwpO1xuICBjb25zdCBhY3R1YWxMaW5lcyA9IGFjdHVhbEluc3BlY3RlZC5zcGxpdChcIlxcblwiKTtcbiAgY29uc3QgZXhwZWN0ZWRMaW5lcyA9IGluc3BlY3RWYWx1ZShleHBlY3RlZCkuc3BsaXQoXCJcXG5cIik7XG5cbiAgbGV0IGkgPSAwO1xuICBsZXQgaW5kaWNhdG9yID0gXCJcIjtcblxuICAvLyBJbiBjYXNlIGJvdGggdmFsdWVzIGFyZSBvYmplY3RzIG9yIGZ1bmN0aW9ucyBleHBsaWNpdGx5IG1hcmsgdGhlbSBhcyBub3RcbiAgLy8gcmVmZXJlbmNlIGVxdWFsIGZvciB0aGUgYHN0cmljdEVxdWFsYCBvcGVyYXRvci5cbiAgaWYgKFxuICAgIG9wZXJhdG9yID09PSBcInN0cmljdEVxdWFsXCIgJiZcbiAgICAoKHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIgJiYgYWN0dWFsICE9PSBudWxsICYmXG4gICAgICB0eXBlb2YgZXhwZWN0ZWQgPT09IFwib2JqZWN0XCIgJiYgZXhwZWN0ZWQgIT09IG51bGwpIHx8XG4gICAgICAodHlwZW9mIGFjdHVhbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBleHBlY3RlZCA9PT0gXCJmdW5jdGlvblwiKSlcbiAgKSB7XG4gICAgb3BlcmF0b3IgPSBcInN0cmljdEVxdWFsT2JqZWN0XCI7XG4gIH1cblxuICAvLyBJZiBcImFjdHVhbFwiIGFuZCBcImV4cGVjdGVkXCIgZml0IG9uIGEgc2luZ2xlIGxpbmUgYW5kIHRoZXkgYXJlIG5vdCBzdHJpY3RseVxuICAvLyBlcXVhbCwgY2hlY2sgZnVydGhlciBzcGVjaWFsIGhhbmRsaW5nLlxuICBpZiAoXG4gICAgYWN0dWFsTGluZXMubGVuZ3RoID09PSAxICYmIGV4cGVjdGVkTGluZXMubGVuZ3RoID09PSAxICYmXG4gICAgYWN0dWFsTGluZXNbMF0gIT09IGV4cGVjdGVkTGluZXNbMF1cbiAgKSB7XG4gICAgLy8gQ2hlY2sgZm9yIHRoZSB2aXNpYmxlIGxlbmd0aCB1c2luZyB0aGUgYHJlbW92ZUNvbG9ycygpYCBmdW5jdGlvbiwgaWZcbiAgICAvLyBhcHByb3ByaWF0ZS5cbiAgICBjb25zdCBjID0gaW5zcGVjdC5kZWZhdWx0T3B0aW9ucy5jb2xvcnM7XG4gICAgY29uc3QgYWN0dWFsUmF3ID0gYyA/IHJlbW92ZUNvbG9ycyhhY3R1YWxMaW5lc1swXSkgOiBhY3R1YWxMaW5lc1swXTtcbiAgICBjb25zdCBleHBlY3RlZFJhdyA9IGMgPyByZW1vdmVDb2xvcnMoZXhwZWN0ZWRMaW5lc1swXSkgOiBleHBlY3RlZExpbmVzWzBdO1xuICAgIGNvbnN0IGlucHV0TGVuZ3RoID0gYWN0dWFsUmF3Lmxlbmd0aCArIGV4cGVjdGVkUmF3Lmxlbmd0aDtcbiAgICAvLyBJZiB0aGUgY2hhcmFjdGVyIGxlbmd0aCBvZiBcImFjdHVhbFwiIGFuZCBcImV4cGVjdGVkXCIgdG9nZXRoZXIgaXMgbGVzcyB0aGFuXG4gICAgLy8ga01heFNob3J0TGVuZ3RoIGFuZCBpZiBuZWl0aGVyIGlzIGFuIG9iamVjdCBhbmQgYXQgbGVhc3Qgb25lIG9mIHRoZW0gaXNcbiAgICAvLyBub3QgYHplcm9gLCB1c2UgdGhlIHN0cmljdCBlcXVhbCBjb21wYXJpc29uIHRvIHZpc3VhbGl6ZSB0aGUgb3V0cHV0LlxuICAgIGlmIChpbnB1dExlbmd0aCA8PSBrTWF4U2hvcnRMZW5ndGgpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKHR5cGVvZiBhY3R1YWwgIT09IFwib2JqZWN0XCIgfHwgYWN0dWFsID09PSBudWxsKSAmJlxuICAgICAgICAodHlwZW9mIGV4cGVjdGVkICE9PSBcIm9iamVjdFwiIHx8IGV4cGVjdGVkID09PSBudWxsKSAmJlxuICAgICAgICAoYWN0dWFsICE9PSAwIHx8IGV4cGVjdGVkICE9PSAwKVxuICAgICAgKSB7IC8vIC0wID09PSArMFxuICAgICAgICByZXR1cm4gYCR7a1JlYWRhYmxlT3BlcmF0b3Jbb3BlcmF0b3JdfVxcblxcbmAgK1xuICAgICAgICAgIGAke2FjdHVhbExpbmVzWzBdfSAhPT0gJHtleHBlY3RlZExpbmVzWzBdfVxcbmA7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcGVyYXRvciAhPT0gXCJzdHJpY3RFcXVhbE9iamVjdFwiKSB7XG4gICAgICAvLyBJZiB0aGUgc3RkZXJyIGlzIGEgdHR5IGFuZCB0aGUgaW5wdXQgbGVuZ3RoIGlzIGxvd2VyIHRoYW4gdGhlIGN1cnJlbnRcbiAgICAgIC8vIGNvbHVtbnMgcGVyIGxpbmUsIGFkZCBhIG1pc21hdGNoIGluZGljYXRvciBiZWxvdyB0aGUgb3V0cHV0LiBJZiBpdCBpc1xuICAgICAgLy8gbm90IGEgdHR5LCB1c2UgYSBkZWZhdWx0IHZhbHVlIG9mIDgwIGNoYXJhY3RlcnMuXG4gICAgICBjb25zdCBtYXhMZW5ndGggPSBEZW5vLmlzYXR0eShEZW5vLnN0ZGVyci5yaWQpID8gZ2V0Q29uc29sZVdpZHRoKCkgOiA4MDtcbiAgICAgIGlmIChpbnB1dExlbmd0aCA8IG1heExlbmd0aCkge1xuICAgICAgICB3aGlsZSAoYWN0dWFsUmF3W2ldID09PSBleHBlY3RlZFJhd1tpXSkge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICAvLyBJZ25vcmUgdGhlIGZpcnN0IGNoYXJhY3RlcnMuXG4gICAgICAgIGlmIChpID4gMikge1xuICAgICAgICAgIC8vIEFkZCBwb3NpdGlvbiBpbmRpY2F0b3IgZm9yIHRoZSBmaXJzdCBtaXNtYXRjaCBpbiBjYXNlIGl0IGlzIGFcbiAgICAgICAgICAvLyBzaW5nbGUgbGluZSBhbmQgdGhlIGlucHV0IGxlbmd0aCBpcyBsZXNzIHRoYW4gdGhlIGNvbHVtbiBsZW5ndGguXG4gICAgICAgICAgaW5kaWNhdG9yID0gYFxcbiAgJHtcIiBcIi5yZXBlYXQoaSl9XmA7XG4gICAgICAgICAgaSA9IDA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIGVuZGluZyBsaW5lcyB0aGF0IG1hdGNoICh0aGlzIG9wdGltaXplcyB0aGUgb3V0cHV0IGZvclxuICAvLyByZWFkYWJpbGl0eSBieSByZWR1Y2luZyB0aGUgbnVtYmVyIG9mIHRvdGFsIGNoYW5nZWQgbGluZXMpLlxuICBsZXQgYSA9IGFjdHVhbExpbmVzW2FjdHVhbExpbmVzLmxlbmd0aCAtIDFdO1xuICBsZXQgYiA9IGV4cGVjdGVkTGluZXNbZXhwZWN0ZWRMaW5lcy5sZW5ndGggLSAxXTtcbiAgd2hpbGUgKGEgPT09IGIpIHtcbiAgICBpZiAoaSsrIDwgMykge1xuICAgICAgZW5kID0gYFxcbiAgJHthfSR7ZW5kfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVyID0gYTtcbiAgICB9XG4gICAgYWN0dWFsTGluZXMucG9wKCk7XG4gICAgZXhwZWN0ZWRMaW5lcy5wb3AoKTtcbiAgICBpZiAoYWN0dWFsTGluZXMubGVuZ3RoID09PSAwIHx8IGV4cGVjdGVkTGluZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgYSA9IGFjdHVhbExpbmVzW2FjdHVhbExpbmVzLmxlbmd0aCAtIDFdO1xuICAgIGIgPSBleHBlY3RlZExpbmVzW2V4cGVjdGVkTGluZXMubGVuZ3RoIC0gMV07XG4gIH1cblxuICBjb25zdCBtYXhMaW5lcyA9IE1hdGhNYXgoYWN0dWFsTGluZXMubGVuZ3RoLCBleHBlY3RlZExpbmVzLmxlbmd0aCk7XG4gIC8vIFN0cmljdCBlcXVhbCB3aXRoIGlkZW50aWNhbCBvYmplY3RzIHRoYXQgYXJlIG5vdCBpZGVudGljYWwgYnkgcmVmZXJlbmNlLlxuICAvLyBFLmcuLCBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgYTogU3ltYm9sKCkgfSwgeyBhOiBTeW1ib2woKSB9KVxuICBpZiAobWF4TGluZXMgPT09IDApIHtcbiAgICAvLyBXZSBoYXZlIHRvIGdldCB0aGUgcmVzdWx0IGFnYWluLiBUaGUgbGluZXMgd2VyZSBhbGwgcmVtb3ZlZCBiZWZvcmUuXG4gICAgY29uc3QgYWN0dWFsTGluZXMgPSBhY3R1YWxJbnNwZWN0ZWQuc3BsaXQoXCJcXG5cIik7XG5cbiAgICAvLyBPbmx5IHJlbW92ZSBsaW5lcyBpbiBjYXNlIGl0IG1ha2VzIHNlbnNlIHRvIGNvbGxhcHNlIHRob3NlLlxuICAgIGlmIChhY3R1YWxMaW5lcy5sZW5ndGggPiA1MCkge1xuICAgICAgYWN0dWFsTGluZXNbNDZdID0gYCR7Ymx1ZX0uLi4ke2RlZmF1bHRDb2xvcn1gO1xuICAgICAgd2hpbGUgKGFjdHVhbExpbmVzLmxlbmd0aCA+IDQ3KSB7XG4gICAgICAgIGFjdHVhbExpbmVzLnBvcCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBgJHtrUmVhZGFibGVPcGVyYXRvci5ub3RJZGVudGljYWx9XFxuXFxuJHthY3R1YWxMaW5lcy5qb2luKFwiXFxuXCIpfVxcbmA7XG4gIH1cblxuICAvLyBUaGVyZSB3ZXJlIGF0IGxlYXN0IGZpdmUgaWRlbnRpY2FsIGxpbmVzIGF0IHRoZSBlbmQuIE1hcmsgYSBjb3VwbGUgb2ZcbiAgLy8gc2tpcHBlZC5cbiAgaWYgKGkgPj0gNSkge1xuICAgIGVuZCA9IGBcXG4ke2JsdWV9Li4uJHtkZWZhdWx0Q29sb3J9JHtlbmR9YDtcbiAgICBza2lwcGVkID0gdHJ1ZTtcbiAgfVxuICBpZiAob3RoZXIgIT09IFwiXCIpIHtcbiAgICBlbmQgPSBgXFxuICAke290aGVyfSR7ZW5kfWA7XG4gICAgb3RoZXIgPSBcIlwiO1xuICB9XG5cbiAgbGV0IHByaW50ZWRMaW5lcyA9IDA7XG4gIGxldCBpZGVudGljYWwgPSAwO1xuICBjb25zdCBtc2cgPSBrUmVhZGFibGVPcGVyYXRvcltvcGVyYXRvcl0gK1xuICAgIGBcXG4ke2dyZWVufSsgYWN0dWFsJHtkZWZhdWx0Q29sb3J9ICR7cmVkfS0gZXhwZWN0ZWQke2RlZmF1bHRDb2xvcn1gO1xuICBjb25zdCBza2lwcGVkTXNnID0gYCAke2JsdWV9Li4uJHtkZWZhdWx0Q29sb3J9IExpbmVzIHNraXBwZWRgO1xuXG4gIGxldCBsaW5lcyA9IGFjdHVhbExpbmVzO1xuICBsZXQgcGx1c01pbnVzID0gYCR7Z3JlZW59KyR7ZGVmYXVsdENvbG9yfWA7XG4gIGxldCBtYXhMZW5ndGggPSBleHBlY3RlZExpbmVzLmxlbmd0aDtcbiAgaWYgKGFjdHVhbExpbmVzLmxlbmd0aCA8IG1heExpbmVzKSB7XG4gICAgbGluZXMgPSBleHBlY3RlZExpbmVzO1xuICAgIHBsdXNNaW51cyA9IGAke3JlZH0tJHtkZWZhdWx0Q29sb3J9YDtcbiAgICBtYXhMZW5ndGggPSBhY3R1YWxMaW5lcy5sZW5ndGg7XG4gIH1cblxuICBmb3IgKGkgPSAwOyBpIDwgbWF4TGluZXM7IGkrKykge1xuICAgIGlmIChtYXhMZW5ndGggPCBpICsgMSkge1xuICAgICAgLy8gSWYgbW9yZSB0aGFuIHR3byBmb3JtZXIgbGluZXMgYXJlIGlkZW50aWNhbCwgcHJpbnQgdGhlbS4gQ29sbGFwc2UgdGhlbVxuICAgICAgLy8gaW4gY2FzZSBtb3JlIHRoYW4gZml2ZSBsaW5lcyB3ZXJlIGlkZW50aWNhbC5cbiAgICAgIGlmIChpZGVudGljYWwgPiAyKSB7XG4gICAgICAgIGlmIChpZGVudGljYWwgPiAzKSB7XG4gICAgICAgICAgaWYgKGlkZW50aWNhbCA+IDQpIHtcbiAgICAgICAgICAgIGlmIChpZGVudGljYWwgPT09IDUpIHtcbiAgICAgICAgICAgICAgcmVzICs9IGBcXG4gICR7bGluZXNbaSAtIDNdfWA7XG4gICAgICAgICAgICAgIHByaW50ZWRMaW5lcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzICs9IGBcXG4ke2JsdWV9Li4uJHtkZWZhdWx0Q29sb3J9YDtcbiAgICAgICAgICAgICAgc2tpcHBlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcyArPSBgXFxuICAke2xpbmVzW2kgLSAyXX1gO1xuICAgICAgICAgIHByaW50ZWRMaW5lcysrO1xuICAgICAgICB9XG4gICAgICAgIHJlcyArPSBgXFxuICAke2xpbmVzW2kgLSAxXX1gO1xuICAgICAgICBwcmludGVkTGluZXMrKztcbiAgICAgIH1cbiAgICAgIC8vIE5vIGlkZW50aWNhbCBsaW5lcyBiZWZvcmUuXG4gICAgICBpZGVudGljYWwgPSAwO1xuICAgICAgLy8gQWRkIHRoZSBleHBlY3RlZCBsaW5lIHRvIHRoZSBjYWNoZS5cbiAgICAgIGlmIChsaW5lcyA9PT0gYWN0dWFsTGluZXMpIHtcbiAgICAgICAgcmVzICs9IGBcXG4ke3BsdXNNaW51c30gJHtsaW5lc1tpXX1gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3RoZXIgKz0gYFxcbiR7cGx1c01pbnVzfSAke2xpbmVzW2ldfWA7XG4gICAgICB9XG4gICAgICBwcmludGVkTGluZXMrKztcbiAgICAgIC8vIE9ubHkgZXh0cmEgYWN0dWFsIGxpbmVzIGV4aXN0XG4gICAgICAvLyBMaW5lcyBkaXZlcmdlXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGV4cGVjdGVkTGluZSA9IGV4cGVjdGVkTGluZXNbaV07XG4gICAgICBsZXQgYWN0dWFsTGluZSA9IGFjdHVhbExpbmVzW2ldO1xuICAgICAgLy8gSWYgdGhlIGxpbmVzIGRpdmVyZ2UsIHNwZWNpZmljYWxseSBjaGVjayBmb3IgbGluZXMgdGhhdCBvbmx5IGRpdmVyZ2UgYnlcbiAgICAgIC8vIGEgdHJhaWxpbmcgY29tbWEuIEluIHRoYXQgY2FzZSBpdCBpcyBhY3R1YWxseSBpZGVudGljYWwgYW5kIHdlIHNob3VsZFxuICAgICAgLy8gbWFyayBpdCBhcyBzdWNoLlxuICAgICAgbGV0IGRpdmVyZ2luZ0xpbmVzID0gYWN0dWFsTGluZSAhPT0gZXhwZWN0ZWRMaW5lICYmXG4gICAgICAgICghYWN0dWFsTGluZS5lbmRzV2l0aChcIixcIikgfHxcbiAgICAgICAgICBhY3R1YWxMaW5lLnNsaWNlKDAsIC0xKSAhPT0gZXhwZWN0ZWRMaW5lKTtcbiAgICAgIC8vIElmIHRoZSBleHBlY3RlZCBsaW5lIGhhcyBhIHRyYWlsaW5nIGNvbW1hIGJ1dCBpcyBvdGhlcndpc2UgaWRlbnRpY2FsLFxuICAgICAgLy8gYWRkIGEgY29tbWEgYXQgdGhlIGVuZCBvZiB0aGUgYWN0dWFsIGxpbmUuIE90aGVyd2lzZSB0aGUgb3V0cHV0IGNvdWxkXG4gICAgICAvLyBsb29rIHdlaXJkIGFzIGluOlxuICAgICAgLy9cbiAgICAgIC8vICAgW1xuICAgICAgLy8gICAgIDEgICAgICAgICAvLyBObyBjb21tYSBhdCB0aGUgZW5kIVxuICAgICAgLy8gKyAgIDJcbiAgICAgIC8vICAgXVxuICAgICAgLy9cbiAgICAgIGlmIChcbiAgICAgICAgZGl2ZXJnaW5nTGluZXMgJiZcbiAgICAgICAgZXhwZWN0ZWRMaW5lLmVuZHNXaXRoKFwiLFwiKSAmJlxuICAgICAgICBleHBlY3RlZExpbmUuc2xpY2UoMCwgLTEpID09PSBhY3R1YWxMaW5lXG4gICAgICApIHtcbiAgICAgICAgZGl2ZXJnaW5nTGluZXMgPSBmYWxzZTtcbiAgICAgICAgYWN0dWFsTGluZSArPSBcIixcIjtcbiAgICAgIH1cbiAgICAgIGlmIChkaXZlcmdpbmdMaW5lcykge1xuICAgICAgICAvLyBJZiBtb3JlIHRoYW4gdHdvIGZvcm1lciBsaW5lcyBhcmUgaWRlbnRpY2FsLCBwcmludCB0aGVtLiBDb2xsYXBzZVxuICAgICAgICAvLyB0aGVtIGluIGNhc2UgbW9yZSB0aGFuIGZpdmUgbGluZXMgd2VyZSBpZGVudGljYWwuXG4gICAgICAgIGlmIChpZGVudGljYWwgPiAyKSB7XG4gICAgICAgICAgaWYgKGlkZW50aWNhbCA+IDMpIHtcbiAgICAgICAgICAgIGlmIChpZGVudGljYWwgPiA0KSB7XG4gICAgICAgICAgICAgIGlmIChpZGVudGljYWwgPT09IDUpIHtcbiAgICAgICAgICAgICAgICByZXMgKz0gYFxcbiAgJHthY3R1YWxMaW5lc1tpIC0gM119YDtcbiAgICAgICAgICAgICAgICBwcmludGVkTGluZXMrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXMgKz0gYFxcbiR7Ymx1ZX0uLi4ke2RlZmF1bHRDb2xvcn1gO1xuICAgICAgICAgICAgICAgIHNraXBwZWQgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMgKz0gYFxcbiAgJHthY3R1YWxMaW5lc1tpIC0gMl19YDtcbiAgICAgICAgICAgIHByaW50ZWRMaW5lcysrO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXMgKz0gYFxcbiAgJHthY3R1YWxMaW5lc1tpIC0gMV19YDtcbiAgICAgICAgICBwcmludGVkTGluZXMrKztcbiAgICAgICAgfVxuICAgICAgICAvLyBObyBpZGVudGljYWwgbGluZXMgYmVmb3JlLlxuICAgICAgICBpZGVudGljYWwgPSAwO1xuICAgICAgICAvLyBBZGQgdGhlIGFjdHVhbCBsaW5lIHRvIHRoZSByZXN1bHQgYW5kIGNhY2hlIHRoZSBleHBlY3RlZCBkaXZlcmdpbmdcbiAgICAgICAgLy8gbGluZSBzbyBjb25zZWN1dGl2ZSBkaXZlcmdpbmcgbGluZXMgc2hvdyB1cCBhcyArKystLS0gYW5kIG5vdCArLSstKy0uXG4gICAgICAgIHJlcyArPSBgXFxuJHtncmVlbn0rJHtkZWZhdWx0Q29sb3J9ICR7YWN0dWFsTGluZX1gO1xuICAgICAgICBvdGhlciArPSBgXFxuJHtyZWR9LSR7ZGVmYXVsdENvbG9yfSAke2V4cGVjdGVkTGluZX1gO1xuICAgICAgICBwcmludGVkTGluZXMgKz0gMjtcbiAgICAgICAgLy8gTGluZXMgYXJlIGlkZW50aWNhbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQWRkIGFsbCBjYWNoZWQgaW5mb3JtYXRpb24gdG8gdGhlIHJlc3VsdCBiZWZvcmUgYWRkaW5nIG90aGVyIHRoaW5nc1xuICAgICAgICAvLyBhbmQgcmVzZXQgdGhlIGNhY2hlLlxuICAgICAgICByZXMgKz0gb3RoZXI7XG4gICAgICAgIG90aGVyID0gXCJcIjtcbiAgICAgICAgaWRlbnRpY2FsKys7XG4gICAgICAgIC8vIFRoZSB2ZXJ5IGZpcnN0IGlkZW50aWNhbCBsaW5lIHNpbmNlIHRoZSBsYXN0IGRpdmVyZ2luZyBsaW5lIGlzIGJlXG4gICAgICAgIC8vIGFkZGVkIHRvIHRoZSByZXN1bHQuXG4gICAgICAgIGlmIChpZGVudGljYWwgPD0gMikge1xuICAgICAgICAgIHJlcyArPSBgXFxuICAke2FjdHVhbExpbmV9YDtcbiAgICAgICAgICBwcmludGVkTGluZXMrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBJbnNwZWN0ZWQgb2JqZWN0IHRvIGJpZyAoU2hvdyB+NTAgcm93cyBtYXgpXG4gICAgaWYgKHByaW50ZWRMaW5lcyA+IDUwICYmIGkgPCBtYXhMaW5lcyAtIDIpIHtcbiAgICAgIHJldHVybiBgJHttc2d9JHtza2lwcGVkTXNnfVxcbiR7cmVzfVxcbiR7Ymx1ZX0uLi4ke2RlZmF1bHRDb2xvcn0ke290aGVyfVxcbmAgK1xuICAgICAgICBgJHtibHVlfS4uLiR7ZGVmYXVsdENvbG9yfWA7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGAke21zZ30ke3NraXBwZWQgPyBza2lwcGVkTXNnIDogXCJcIn1cXG4ke3Jlc30ke290aGVyfSR7ZW5kfSR7aW5kaWNhdG9yfWA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXNzZXJ0aW9uRXJyb3JEZXRhaWxzRGVzY3JpcHRvciB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgYWN0dWFsOiB1bmtub3duO1xuICBleHBlY3RlZDogdW5rbm93bjtcbiAgb3BlcmF0b3I6IHN0cmluZztcbiAgc3RhY2s6IEVycm9yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzc2VydGlvbkVycm9yQ29uc3RydWN0b3JPcHRpb25zIHtcbiAgbWVzc2FnZT86IHN0cmluZztcbiAgYWN0dWFsPzogdW5rbm93bjtcbiAgZXhwZWN0ZWQ/OiB1bmtub3duO1xuICBvcGVyYXRvcj86IHN0cmluZztcbiAgZGV0YWlscz86IEFzc2VydGlvbkVycm9yRGV0YWlsc0Rlc2NyaXB0b3JbXTtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgc3RhY2tTdGFydEZuPzogRnVuY3Rpb247XG4gIC8vIENvbXBhdGliaWxpdHkgd2l0aCBvbGRlciB2ZXJzaW9ucy5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgc3RhY2tTdGFydEZ1bmN0aW9uPzogRnVuY3Rpb247XG59XG5cbmludGVyZmFjZSBFcnJvcldpdGhTdGFja1RyYWNlTGltaXQgZXh0ZW5kcyBFcnJvckNvbnN0cnVjdG9yIHtcbiAgc3RhY2tUcmFjZUxpbWl0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgW2tleTogc3RyaW5nXTogdW5rbm93bjtcblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGNvbnN0cnVjdG9yLXN1cGVyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEFzc2VydGlvbkVycm9yQ29uc3RydWN0b3JPcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zICE9PSBcIm9iamVjdFwiIHx8IG9wdGlvbnMgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcIm9wdGlvbnNcIiwgXCJPYmplY3RcIiwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGNvbnN0IHtcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcixcbiAgICAgIHN0YWNrU3RhcnRGbixcbiAgICAgIGRldGFpbHMsXG4gICAgICAvLyBDb21wYXRpYmlsaXR5IHdpdGggb2xkZXIgdmVyc2lvbnMuXG4gICAgICBzdGFja1N0YXJ0RnVuY3Rpb24sXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgbGV0IHtcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgIH0gPSBvcHRpb25zO1xuXG4gICAgLy8gVE9ETyhzY2h3YXJ6a29wZmIpOiBgc3RhY2tUcmFjZUxpbWl0YCBzaG91bGQgYmUgYWRkZWQgdG8gYEVycm9yQ29uc3RydWN0b3JgIGluXG4gICAgLy8gY2xpL2R0cy9saWIuZGVuby5zaGFyZWRfZ2xvYmFscy5kLnRzXG4gICAgY29uc3QgbGltaXQgPSAoRXJyb3IgYXMgRXJyb3JXaXRoU3RhY2tUcmFjZUxpbWl0KS5zdGFja1RyYWNlTGltaXQ7XG4gICAgKEVycm9yIGFzIEVycm9yV2l0aFN0YWNrVHJhY2VMaW1pdCkuc3RhY2tUcmFjZUxpbWl0ID0gMDtcblxuICAgIGlmIChtZXNzYWdlICE9IG51bGwpIHtcbiAgICAgIHN1cGVyKFN0cmluZyhtZXNzYWdlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChEZW5vLmlzYXR0eShEZW5vLnN0ZGVyci5yaWQpKSB7XG4gICAgICAgIC8vIFJlc2V0IG9uIGVhY2ggY2FsbCB0byBtYWtlIHN1cmUgd2UgaGFuZGxlIGR5bmFtaWNhbGx5IHNldCBlbnZpcm9ubWVudFxuICAgICAgICAvLyB2YXJpYWJsZXMgY29ycmVjdC5cbiAgICAgICAgaWYgKERlbm8ubm9Db2xvcikge1xuICAgICAgICAgIGJsdWUgPSBcIlwiO1xuICAgICAgICAgIGdyZWVuID0gXCJcIjtcbiAgICAgICAgICBkZWZhdWx0Q29sb3IgPSBcIlwiO1xuICAgICAgICAgIHJlZCA9IFwiXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYmx1ZSA9IFwiXFx1MDAxYlszNG1cIjtcbiAgICAgICAgICBncmVlbiA9IFwiXFx1MDAxYlszMm1cIjtcbiAgICAgICAgICBkZWZhdWx0Q29sb3IgPSBcIlxcdTAwMWJbMzltXCI7XG4gICAgICAgICAgcmVkID0gXCJcXHUwMDFiWzMxbVwiO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IHRoZSBlcnJvciBzdGFjayBmcm9tIGJlaW5nIHZpc2libGUgYnkgZHVwbGljYXRpbmcgdGhlIGVycm9yXG4gICAgICAvLyBpbiBhIHZlcnkgY2xvc2Ugd2F5IHRvIHRoZSBvcmlnaW5hbCBpbiBjYXNlIGJvdGggc2lkZXMgYXJlIGFjdHVhbGx5XG4gICAgICAvLyBpbnN0YW5jZXMgb2YgRXJyb3IuXG4gICAgICBpZiAoXG4gICAgICAgIHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIgJiYgYWN0dWFsICE9PSBudWxsICYmXG4gICAgICAgIHR5cGVvZiBleHBlY3RlZCA9PT0gXCJvYmplY3RcIiAmJiBleHBlY3RlZCAhPT0gbnVsbCAmJlxuICAgICAgICBcInN0YWNrXCIgaW4gYWN0dWFsICYmIGFjdHVhbCBpbnN0YW5jZW9mIEVycm9yICYmXG4gICAgICAgIFwic3RhY2tcIiBpbiBleHBlY3RlZCAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIEVycm9yXG4gICAgICApIHtcbiAgICAgICAgYWN0dWFsID0gY29weUVycm9yKGFjdHVhbCk7XG4gICAgICAgIGV4cGVjdGVkID0gY29weUVycm9yKGV4cGVjdGVkKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wZXJhdG9yID09PSBcImRlZXBTdHJpY3RFcXVhbFwiIHx8IG9wZXJhdG9yID09PSBcInN0cmljdEVxdWFsXCIpIHtcbiAgICAgICAgc3VwZXIoY3JlYXRlRXJyRGlmZihhY3R1YWwsIGV4cGVjdGVkLCBvcGVyYXRvcikpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgb3BlcmF0b3IgPT09IFwibm90RGVlcFN0cmljdEVxdWFsXCIgfHxcbiAgICAgICAgb3BlcmF0b3IgPT09IFwibm90U3RyaWN0RXF1YWxcIlxuICAgICAgKSB7XG4gICAgICAgIC8vIEluIGNhc2UgdGhlIG9iamVjdHMgYXJlIGVxdWFsIGJ1dCB0aGUgb3BlcmF0b3IgcmVxdWlyZXMgdW5lcXVhbCwgc2hvd1xuICAgICAgICAvLyB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBzYXkgQSBlcXVhbHMgQlxuICAgICAgICBsZXQgYmFzZSA9IGtSZWFkYWJsZU9wZXJhdG9yW29wZXJhdG9yXTtcbiAgICAgICAgY29uc3QgcmVzID0gaW5zcGVjdFZhbHVlKGFjdHVhbCkuc3BsaXQoXCJcXG5cIik7XG5cbiAgICAgICAgLy8gSW4gY2FzZSBcImFjdHVhbFwiIGlzIGFuIG9iamVjdCBvciBhIGZ1bmN0aW9uLCBpdCBzaG91bGQgbm90IGJlXG4gICAgICAgIC8vIHJlZmVyZW5jZSBlcXVhbC5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIG9wZXJhdG9yID09PSBcIm5vdFN0cmljdEVxdWFsXCIgJiZcbiAgICAgICAgICAoKHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIgJiYgYWN0dWFsICE9PSBudWxsKSB8fFxuICAgICAgICAgICAgdHlwZW9mIGFjdHVhbCA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICApIHtcbiAgICAgICAgICBiYXNlID0ga1JlYWRhYmxlT3BlcmF0b3Iubm90U3RyaWN0RXF1YWxPYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPbmx5IHJlbW92ZSBsaW5lcyBpbiBjYXNlIGl0IG1ha2VzIHNlbnNlIHRvIGNvbGxhcHNlIHRob3NlLlxuICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDUwKSB7XG4gICAgICAgICAgcmVzWzQ2XSA9IGAke2JsdWV9Li4uJHtkZWZhdWx0Q29sb3J9YDtcbiAgICAgICAgICB3aGlsZSAocmVzLmxlbmd0aCA+IDQ3KSB7XG4gICAgICAgICAgICByZXMucG9wKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT25seSBwcmludCBhIHNpbmdsZSBpbnB1dC5cbiAgICAgICAgaWYgKHJlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBzdXBlcihgJHtiYXNlfSR7cmVzWzBdLmxlbmd0aCA+IDUgPyBcIlxcblxcblwiIDogXCIgXCJ9JHtyZXNbMF19YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VwZXIoYCR7YmFzZX1cXG5cXG4ke3Jlcy5qb2luKFwiXFxuXCIpfVxcbmApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcmVzID0gaW5zcGVjdFZhbHVlKGFjdHVhbCk7XG4gICAgICAgIGxldCBvdGhlciA9IGluc3BlY3RWYWx1ZShleHBlY3RlZCk7XG4gICAgICAgIGNvbnN0IGtub3duT3BlcmF0b3IgPSBrUmVhZGFibGVPcGVyYXRvcltvcGVyYXRvciA/PyBcIlwiXTtcbiAgICAgICAgaWYgKG9wZXJhdG9yID09PSBcIm5vdERlZXBFcXVhbFwiICYmIHJlcyA9PT0gb3RoZXIpIHtcbiAgICAgICAgICByZXMgPSBgJHtrbm93bk9wZXJhdG9yfVxcblxcbiR7cmVzfWA7XG4gICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAxMDI0KSB7XG4gICAgICAgICAgICByZXMgPSBgJHtyZXMuc2xpY2UoMCwgMTAyMSl9Li4uYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3VwZXIocmVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDUxMikge1xuICAgICAgICAgICAgcmVzID0gYCR7cmVzLnNsaWNlKDAsIDUwOSl9Li4uYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG90aGVyLmxlbmd0aCA+IDUxMikge1xuICAgICAgICAgICAgb3RoZXIgPSBgJHtvdGhlci5zbGljZSgwLCA1MDkpfS4uLmA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gXCJkZWVwRXF1YWxcIikge1xuICAgICAgICAgICAgcmVzID0gYCR7a25vd25PcGVyYXRvcn1cXG5cXG4ke3Jlc31cXG5cXG5zaG91bGQgbG9vc2VseSBkZWVwLWVxdWFsXFxuXFxuYDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbmV3T3AgPSBrUmVhZGFibGVPcGVyYXRvcltgJHtvcGVyYXRvcn1VbmVxdWFsYF07XG4gICAgICAgICAgICBpZiAobmV3T3ApIHtcbiAgICAgICAgICAgICAgcmVzID0gYCR7bmV3T3B9XFxuXFxuJHtyZXN9XFxuXFxuc2hvdWxkIG5vdCBsb29zZWx5IGRlZXAtZXF1YWxcXG5cXG5gO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb3RoZXIgPSBgICR7b3BlcmF0b3J9ICR7b3RoZXJ9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgc3VwZXIoYCR7cmVzfSR7b3RoZXJ9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAoRXJyb3IgYXMgRXJyb3JXaXRoU3RhY2tUcmFjZUxpbWl0KS5zdGFja1RyYWNlTGltaXQgPSBsaW1pdDtcblxuICAgIHRoaXMuZ2VuZXJhdGVkTWVzc2FnZSA9ICFtZXNzYWdlO1xuICAgIE9iamVjdERlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICBfX3Byb3RvX186IG51bGwsXG4gICAgICB2YWx1ZTogXCJBc3NlcnRpb25FcnJvciBbRVJSX0FTU0VSVElPTl1cIixcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIH0gYXMgYW55KTtcbiAgICB0aGlzLmNvZGUgPSBcIkVSUl9BU1NFUlRJT05cIjtcblxuICAgIGlmIChkZXRhaWxzKSB7XG4gICAgICB0aGlzLmFjdHVhbCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZXhwZWN0ZWQgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLm9wZXJhdG9yID0gdW5kZWZpbmVkO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRldGFpbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpc1tcIm1lc3NhZ2UgXCIgKyBpXSA9IGRldGFpbHNbaV0ubWVzc2FnZTtcbiAgICAgICAgdGhpc1tcImFjdHVhbCBcIiArIGldID0gZGV0YWlsc1tpXS5hY3R1YWw7XG4gICAgICAgIHRoaXNbXCJleHBlY3RlZCBcIiArIGldID0gZGV0YWlsc1tpXS5leHBlY3RlZDtcbiAgICAgICAgdGhpc1tcIm9wZXJhdG9yIFwiICsgaV0gPSBkZXRhaWxzW2ldLm9wZXJhdG9yO1xuICAgICAgICB0aGlzW1wic3RhY2sgdHJhY2UgXCIgKyBpXSA9IGRldGFpbHNbaV0uc3RhY2s7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWN0dWFsID0gYWN0dWFsO1xuICAgICAgdGhpcy5leHBlY3RlZCA9IGV4cGVjdGVkO1xuICAgICAgdGhpcy5vcGVyYXRvciA9IG9wZXJhdG9yO1xuICAgIH1cblxuICAgIC8vIEB0cy1pZ25vcmUgdGhpcyBmdW5jdGlvbiBpcyBub3QgYXZhaWxhYmxlIGluIGxpYi5kb20uZC50c1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHN0YWNrU3RhcnRGbiB8fCBzdGFja1N0YXJ0RnVuY3Rpb24pO1xuICAgIC8vIENyZWF0ZSBlcnJvciBtZXNzYWdlIGluY2x1ZGluZyB0aGUgZXJyb3IgY29kZSBpbiB0aGUgbmFtZS5cbiAgICB0aGlzLnN0YWNrO1xuICAgIC8vIFJlc2V0IHRoZSBuYW1lLlxuICAgIHRoaXMubmFtZSA9IFwiQXNzZXJ0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIG92ZXJyaWRlIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICB9XG5cbiAgW2luc3BlY3QuY3VzdG9tXShfcmVjdXJzZVRpbWVzOiBudW1iZXIsIGN0eDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pIHtcbiAgICAvLyBMb25nIHN0cmluZ3Mgc2hvdWxkIG5vdCBiZSBmdWxseSBpbnNwZWN0ZWQuXG4gICAgY29uc3QgdG1wQWN0dWFsID0gdGhpcy5hY3R1YWw7XG4gICAgY29uc3QgdG1wRXhwZWN0ZWQgPSB0aGlzLmV4cGVjdGVkO1xuXG4gICAgZm9yIChjb25zdCBuYW1lIG9mIFtcImFjdHVhbFwiLCBcImV4cGVjdGVkXCJdKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbbmFtZV0gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSAodGhpc1tuYW1lXSBhcyBzdHJpbmcpO1xuICAgICAgICBjb25zdCBsaW5lcyA9IHZhbHVlLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICBsaW5lcy5sZW5ndGggPSAxMDtcbiAgICAgICAgICB0aGlzW25hbWVdID0gYCR7bGluZXMuam9pbihcIlxcblwiKX1cXG4uLi5gO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmxlbmd0aCA+IDUxMikge1xuICAgICAgICAgIHRoaXNbbmFtZV0gPSBgJHt2YWx1ZS5zbGljZSg1MTIpfS4uLmA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUaGlzIGxpbWl0cyB0aGUgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgcHJvcGVydHkgZGVmYXVsdCBpbnNwZWN0aW9uIHRvXG4gICAgLy8gdGhlIG1pbmltdW0gZGVwdGguIE90aGVyd2lzZSB0aG9zZSB2YWx1ZXMgd291bGQgYmUgdG9vIHZlcmJvc2UgY29tcGFyZWRcbiAgICAvLyB0byB0aGUgYWN0dWFsIGVycm9yIG1lc3NhZ2Ugd2hpY2ggY29udGFpbnMgYSBjb21iaW5lZCB2aWV3IG9mIHRoZXNlIHR3b1xuICAgIC8vIGlucHV0IHZhbHVlcy5cbiAgICBjb25zdCByZXN1bHQgPSBpbnNwZWN0KHRoaXMsIHtcbiAgICAgIC4uLmN0eCxcbiAgICAgIGN1c3RvbUluc3BlY3Q6IGZhbHNlLFxuICAgICAgZGVwdGg6IDAsXG4gICAgfSk7XG5cbiAgICAvLyBSZXNldCB0aGUgcHJvcGVydGllcyBhZnRlciBpbnNwZWN0aW9uLlxuICAgIHRoaXMuYWN0dWFsID0gdG1wQWN0dWFsO1xuICAgIHRoaXMuZXhwZWN0ZWQgPSB0bXBFeHBlY3RlZDtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXNzZXJ0aW9uRXJyb3I7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFLDRFQUE0RTtBQUU1RSwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFFeEIsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUV6RCwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwy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