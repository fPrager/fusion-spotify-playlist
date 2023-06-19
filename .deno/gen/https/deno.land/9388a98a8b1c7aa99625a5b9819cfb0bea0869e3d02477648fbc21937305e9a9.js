// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
// Copyright Mathias Bynens <https://mathiasbynens.be/>
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// Adapted from https://github.com/mathiasbynens/punycode.js
// TODO(cmorten): migrate punycode logic to "icu" internal binding and/or "url"
// internal module so there can be re-use within the "url" module etc.
"use strict";
/** Highest positive signed 32-bit float value */ const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1
/** Bootstring parameters */ const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = "-"; // '\x2D'
/** Regular expressions */ const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7E]/; // non-ASCII chars
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators
/** Error messages */ const errors = {
    "overflow": "Overflow: input needs wider integers to process",
    "not-basic": "Illegal input >= 0x80 (not a basic code point)",
    "invalid-input": "Invalid input"
};
/** Convenience shortcuts */ const baseMinusTMin = base - tMin;
const floor = Math.floor;
/**
 * A generic error utility function.
 *
 * @param type The error type.
 * @return Throws a `RangeError` with the applicable error message.
 */ function error(type) {
    throw new RangeError(errors[type]);
}
/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 *
 * @param domain The domain name or email address.
 * @param callback The function that gets called for every
 * character.
 * @return A new string of characters returned by the callback
 * function.
 */ function mapDomain(str, fn) {
    const parts = str.split("@");
    let result = "";
    if (parts.length > 1) {
        // In email addresses, only the domain name should be punycoded. Leave
        // the local part (i.e. everything up to `@`) intact.
        result = parts[0] + "@";
        str = parts[1];
    }
    // Avoid `split(regex)` for IE8 compatibility. See #17.
    str = str.replace(regexSeparators, "\x2E");
    const labels = str.split(".");
    const encoded = labels.map(fn).join(".");
    return result + encoded;
}
/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 *
 * @param str The Unicode input string (UCS-2).
 * @return The new array of code points.
 */ function ucs2decode(str) {
    const output = [];
    let counter = 0;
    const length = str.length;
    while(counter < length){
        const value = str.charCodeAt(counter++);
        if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
            // It's a high surrogate, and there is a next character.
            const extra = str.charCodeAt(counter++);
            if ((extra & 0xFC00) == 0xDC00) {
                output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
            } else {
                // It's an unmatched surrogate; only append this code unit, in case the
                // next code unit is the high surrogate of a surrogate pair.
                output.push(value);
                counter--;
            }
        } else {
            output.push(value);
        }
    }
    return output;
}
/**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param codePoints The array of numeric code points.
 * @returns The new Unicode string (UCS-2).
 */ function ucs2encode(array) {
    return String.fromCodePoint(...array);
}
export const ucs2 = {
    decode: ucs2decode,
    encode: ucs2encode
};
/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param codePoint The basic numeric code point value.
 * @returns The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */ function basicToDigit(codePoint) {
    if (codePoint - 0x30 < 0x0A) {
        return codePoint - 0x16;
    }
    if (codePoint - 0x41 < 0x1A) {
        return codePoint - 0x41;
    }
    if (codePoint - 0x61 < 0x1A) {
        return codePoint - 0x61;
    }
    return base;
}
/**
 * Converts a digit/integer into a basic code point.
 *
 * @param digit The numeric value of a basic code point.
 * @return The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */ function digitToBasic(digit, flag) {
    //  0..25 map to ASCII a..z or A..Z
    // 26..35 map to ASCII 0..9
    return digit + 22 + 75 * Number(digit < 26) - (Number(flag != 0) << 5);
}
/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 */ function adapt(delta, numPoints, firstTime) {
    let k = 0;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for(; delta > baseMinusTMin * tMax >> 1; k += base){
        delta = Math.floor(delta / baseMinusTMin);
    }
    return Math.floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
}
/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param input The Punycode string of ASCII-only symbols.
 * @returns The resulting string of Unicode symbols.
 */ export function decode(input) {
    // Don't use UCS-2.
    const output = [];
    const inputLength = input.length;
    let i = 0;
    let n = initialN;
    let bias = initialBias;
    // Handle the basic code points: let `basic` be the number of input code
    // points before the last delimiter, or `0` if there is none, then copy
    // the first basic code points to the output.
    let basic = input.lastIndexOf(delimiter);
    if (basic < 0) {
        basic = 0;
    }
    for(let j = 0; j < basic; ++j){
        // if it's not a basic code point
        if (input.charCodeAt(j) >= 0x80) {
            error("not-basic");
        }
        output.push(input.charCodeAt(j));
    }
    // Main decoding loop: start just after the last delimiter if any basic code
    // points were copied; start at the beginning otherwise.
    for(let index = basic > 0 ? basic + 1 : 0; index < inputLength;){
        // `index` is the index of the next character to be consumed.
        // Decode a generalized variable-length integer into `delta`,
        // which gets added to `i`. The overflow checking is easier
        // if we increase `i` as we go, then subtract off its starting
        // value at the end to obtain `delta`.
        const oldi = i;
        for(let w = 1, k = base;; k += base){
            if (index >= inputLength) {
                error("invalid-input");
            }
            const digit = basicToDigit(input.charCodeAt(index++));
            if (digit >= base || digit > floor((maxInt - i) / w)) {
                error("overflow");
            }
            i += digit * w;
            const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
            if (digit < t) {
                break;
            }
            const baseMinusT = base - t;
            if (w > floor(maxInt / baseMinusT)) {
                error("overflow");
            }
            w *= baseMinusT;
        }
        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);
        // `i` was supposed to wrap around from `out` to `0`,
        // incrementing `n` each time, so we'll fix that now:
        if (floor(i / out) > maxInt - n) {
            error("overflow");
        }
        n += floor(i / out);
        i %= out;
        // Insert `n` at position `i` of the output.
        output.splice(i++, 0, n);
    }
    return String.fromCodePoint(...output);
}
/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 *
 * @param str The string of Unicode symbols.
 * @return The resulting Punycode string of ASCII-only symbols.
 */ export function encode(str) {
    const output = [];
    // Convert the input in UCS-2 to an array of Unicode code points.
    const input = ucs2decode(str);
    // Cache the length.
    const inputLength = input.length;
    // Initialize the state.
    let n = initialN;
    let delta = 0;
    let bias = initialBias;
    // Handle the basic code points.
    for (const currentValue of input){
        if (currentValue < 0x80) {
            output.push(String.fromCharCode(currentValue));
        }
    }
    const basicLength = output.length;
    let handledCPCount = basicLength;
    // `handledCPCount` is the number of code points that have been handled;
    // `basicLength` is the number of basic code points.
    // Finish the basic string with a delimiter unless it's empty.
    if (basicLength) {
        output.push(delimiter);
    }
    // Main encoding loop:
    while(handledCPCount < inputLength){
        // All non-basic code points < n have been handled already. Find the next
        // larger one:
        let m = maxInt;
        for (const currentValue1 of input){
            if (currentValue1 >= n && currentValue1 < m) {
                m = currentValue1;
            }
        }
        // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
        // but guard against overflow.
        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > Math.floor((maxInt - delta) / handledCPCountPlusOne)) {
            error("overflow");
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        for (const currentValue2 of input){
            if (currentValue2 < n && ++delta > maxInt) {
                error("overflow");
            }
            if (currentValue2 == n) {
                // Represent delta as a generalized variable-length integer.
                let q = delta;
                for(let k = base;; k += base){
                    const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                    if (q < t) {
                        break;
                    }
                    const qMinusT = q - t;
                    const baseMinusT = base - t;
                    output.push(String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                    q = Math.floor(qMinusT / baseMinusT);
                }
                output.push(String.fromCharCode(digitToBasic(q, 0)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                delta = 0;
                ++handledCPCount;
            }
        }
        ++delta;
        ++n;
    }
    return output.join("");
}
/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns The Unicode representation of the given Punycode
 * string.
 */ export function toUnicode(input) {
    return mapDomain(input, function(string) {
        return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
    });
}
/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 *
 * @param input The domain name or email address to convert, as a
 * Unicode string.
 * @return The Punycode representation of the given domain name or
 * email address.
 */ export function toASCII(input) {
    return mapDomain(input, function(str) {
        return regexNonASCII.test(str) ? "xn--" + encode(str) : str;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvaWRuYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIENvcHlyaWdodCBNYXRoaWFzIEJ5bmVucyA8aHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlLz5cblxuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nXG4vLyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvXG4vLyBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG9cbi8vIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcbi8vIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxuLy8gRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORFxuLy8gTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRVxuLy8gTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTlxuLy8gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OXG4vLyBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gQWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXRoaWFzYnluZW5zL3B1bnljb2RlLmpzXG5cbi8vIFRPRE8oY21vcnRlbik6IG1pZ3JhdGUgcHVueWNvZGUgbG9naWMgdG8gXCJpY3VcIiBpbnRlcm5hbCBiaW5kaW5nIGFuZC9vciBcInVybFwiXG4vLyBpbnRlcm5hbCBtb2R1bGUgc28gdGhlcmUgY2FuIGJlIHJlLXVzZSB3aXRoaW4gdGhlIFwidXJsXCIgbW9kdWxlIGV0Yy5cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cbmNvbnN0IG1heEludCA9IDIxNDc0ODM2NDc7IC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuLyoqIEJvb3RzdHJpbmcgcGFyYW1ldGVycyAqL1xuY29uc3QgYmFzZSA9IDM2O1xuY29uc3QgdE1pbiA9IDE7XG5jb25zdCB0TWF4ID0gMjY7XG5jb25zdCBza2V3ID0gMzg7XG5jb25zdCBkYW1wID0gNzAwO1xuY29uc3QgaW5pdGlhbEJpYXMgPSA3MjtcbmNvbnN0IGluaXRpYWxOID0gMTI4OyAvLyAweDgwXG5jb25zdCBkZWxpbWl0ZXIgPSBcIi1cIjsgLy8gJ1xceDJEJ1xuXG4vKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuY29uc3QgcmVnZXhQdW55Y29kZSA9IC9eeG4tLS87XG5jb25zdCByZWdleE5vbkFTQ0lJID0gL1teXFwwLVxceDdFXS87IC8vIG5vbi1BU0NJSSBjaGFyc1xuY29uc3QgcmVnZXhTZXBhcmF0b3JzID0gL1tcXHgyRVxcdTMwMDJcXHVGRjBFXFx1RkY2MV0vZzsgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG4vKiogRXJyb3IgbWVzc2FnZXMgKi9cbmNvbnN0IGVycm9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCJvdmVyZmxvd1wiOiBcIk92ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzXCIsXG4gIFwibm90LWJhc2ljXCI6IFwiSWxsZWdhbCBpbnB1dCA+PSAweDgwIChub3QgYSBiYXNpYyBjb2RlIHBvaW50KVwiLFxuICBcImludmFsaWQtaW5wdXRcIjogXCJJbnZhbGlkIGlucHV0XCIsXG59O1xuXG4vKiogQ29udmVuaWVuY2Ugc2hvcnRjdXRzICovXG5jb25zdCBiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW47XG5jb25zdCBmbG9vciA9IE1hdGguZmxvb3I7XG5cbi8qKlxuICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHR5cGUgVGhlIGVycm9yIHR5cGUuXG4gKiBAcmV0dXJuIFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG4gKi9cbmZ1bmN0aW9uIGVycm9yKHR5cGU6IHN0cmluZykge1xuICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xufVxuXG4vKipcbiAqIEEgc2ltcGxlIGBBcnJheSNtYXBgLWxpa2Ugd3JhcHBlciB0byB3b3JrIHdpdGggZG9tYWluIG5hbWUgc3RyaW5ncyBvciBlbWFpbFxuICogYWRkcmVzc2VzLlxuICpcbiAqIEBwYXJhbSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MuXG4gKiBAcGFyYW0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG4gKiBjaGFyYWN0ZXIuXG4gKiBAcmV0dXJuIEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuICogZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG1hcERvbWFpbihzdHI6IHN0cmluZywgZm46IChsYWJlbDogc3RyaW5nKSA9PiBzdHJpbmcpIHtcbiAgY29uc3QgcGFydHMgPSBzdHIuc3BsaXQoXCJAXCIpO1xuICBsZXQgcmVzdWx0ID0gXCJcIjtcblxuICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgIC8vIEluIGVtYWlsIGFkZHJlc3Nlcywgb25seSB0aGUgZG9tYWluIG5hbWUgc2hvdWxkIGJlIHB1bnljb2RlZC4gTGVhdmVcbiAgICAvLyB0aGUgbG9jYWwgcGFydCAoaS5lLiBldmVyeXRoaW5nIHVwIHRvIGBAYCkgaW50YWN0LlxuICAgIHJlc3VsdCA9IHBhcnRzWzBdICsgXCJAXCI7XG4gICAgc3RyID0gcGFydHNbMV07XG4gIH1cblxuICAvLyBBdm9pZCBgc3BsaXQocmVnZXgpYCBmb3IgSUU4IGNvbXBhdGliaWxpdHkuIFNlZSAjMTcuXG4gIHN0ciA9IHN0ci5yZXBsYWNlKHJlZ2V4U2VwYXJhdG9ycywgXCJcXHgyRVwiKTtcbiAgY29uc3QgbGFiZWxzID0gc3RyLnNwbGl0KFwiLlwiKTtcbiAgY29uc3QgZW5jb2RlZCA9IGxhYmVscy5tYXAoZm4pLmpvaW4oXCIuXCIpO1xuXG4gIHJldHVybiByZXN1bHQgKyBlbmNvZGVkO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgbnVtZXJpYyBjb2RlIHBvaW50cyBvZiBlYWNoIFVuaWNvZGVcbiAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG4gKiBVQ1MtMiBleHBvc2VzIGFzIHNlcGFyYXRlIGNoYXJhY3RlcnMpIGludG8gYSBzaW5nbGUgY29kZSBwb2ludCxcbiAqIG1hdGNoaW5nIFVURi0xNi5cbiAqXG4gKiBAcGFyYW0gc3RyIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuICogQHJldHVybiBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuICovXG5mdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cjogc3RyaW5nKSB7XG4gIGNvbnN0IG91dHB1dCA9IFtdO1xuICBsZXQgY291bnRlciA9IDA7XG4gIGNvbnN0IGxlbmd0aCA9IHN0ci5sZW5ndGg7XG5cbiAgd2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0ci5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cbiAgICBpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG4gICAgICAvLyBJdCdzIGEgaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyLlxuICAgICAgY29uc3QgZXh0cmEgPSBzdHIuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXG4gICAgICBpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gTG93IHN1cnJvZ2F0ZS5cbiAgICAgICAgb3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEl0J3MgYW4gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlXG4gICAgICAgIC8vIG5leHQgY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyLlxuICAgICAgICBvdXRwdXQucHVzaCh2YWx1ZSk7XG4gICAgICAgIGNvdW50ZXItLTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG4gKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuICogQG5hbWUgZW5jb2RlXG4gKiBAcGFyYW0gY29kZVBvaW50cyBUaGUgYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cbiAqIEByZXR1cm5zIFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cbiAqL1xuZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheTogbnVtYmVyW10pIHtcbiAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KC4uLmFycmF5KTtcbn1cblxuZXhwb3J0IGNvbnN0IHVjczIgPSB7XG4gIGRlY29kZTogdWNzMmRlY29kZSxcbiAgZW5jb2RlOiB1Y3MyZW5jb2RlLFxufTtcblxuLyoqXG4gKiBDb252ZXJ0cyBhIGJhc2ljIGNvZGUgcG9pbnQgaW50byBhIGRpZ2l0L2ludGVnZXIuXG4gKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0gY29kZVBvaW50IFRoZSBiYXNpYyBudW1lcmljIGNvZGUgcG9pbnQgdmFsdWUuXG4gKiBAcmV0dXJucyBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cbiAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcbiAqIHRoZSBjb2RlIHBvaW50IGRvZXMgbm90IHJlcHJlc2VudCBhIHZhbHVlLlxuICovXG5mdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50OiBudW1iZXIpIHtcbiAgaWYgKGNvZGVQb2ludCAtIDB4MzAgPCAweDBBKSB7XG4gICAgcmV0dXJuIGNvZGVQb2ludCAtIDB4MTY7XG4gIH1cbiAgaWYgKGNvZGVQb2ludCAtIDB4NDEgPCAweDFBKSB7XG4gICAgcmV0dXJuIGNvZGVQb2ludCAtIDB4NDE7XG4gIH1cbiAgaWYgKGNvZGVQb2ludCAtIDB4NjEgPCAweDFBKSB7XG4gICAgcmV0dXJuIGNvZGVQb2ludCAtIDB4NjE7XG4gIH1cbiAgcmV0dXJuIGJhc2U7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuICpcbiAqIEBwYXJhbSBkaWdpdCBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQuXG4gKiBAcmV0dXJuIFRoZSBiYXNpYyBjb2RlIHBvaW50IHdob3NlIHZhbHVlICh3aGVuIHVzZWQgZm9yXG4gKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG4gKiB1c2VkOyBlbHNlLCB0aGUgbG93ZXJjYXNlIGZvcm0gaXMgdXNlZC4gVGhlIGJlaGF2aW9yIGlzIHVuZGVmaW5lZFxuICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cbiAqL1xuZnVuY3Rpb24gZGlnaXRUb0Jhc2ljKGRpZ2l0OiBudW1iZXIsIGZsYWc6IG51bWJlcikge1xuICAvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuICAvLyAyNi4uMzUgbWFwIHRvIEFTQ0lJIDAuLjlcbiAgcmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIE51bWJlcihkaWdpdCA8IDI2KSAtIChOdW1iZXIoZmxhZyAhPSAwKSA8PCA1KTtcbn1cblxuLyoqXG4gKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuICogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0OTIjc2VjdGlvbi0zLjRcbiAqL1xuZnVuY3Rpb24gYWRhcHQoZGVsdGE6IG51bWJlciwgbnVtUG9pbnRzOiBudW1iZXIsIGZpcnN0VGltZTogYm9vbGVhbikge1xuICBsZXQgayA9IDA7XG4gIGRlbHRhID0gZmlyc3RUaW1lID8gTWF0aC5mbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcbiAgZGVsdGEgKz0gTWF0aC5mbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cbiAgZm9yICg7IC8qIG5vIGluaXRpYWxpemF0aW9uICovIGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG4gICAgZGVsdGEgPSBNYXRoLmZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG4gIH1cblxuICByZXR1cm4gTWF0aC5mbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG4gKiBzeW1ib2xzLlxuICogQG1lbWJlck9mIHB1bnljb2RlXG4gKiBAcGFyYW0gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG4gKiBAcmV0dXJucyBUaGUgcmVzdWx0aW5nIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIERvbid0IHVzZSBVQ1MtMi5cbiAgY29uc3Qgb3V0cHV0ID0gW107XG4gIGNvbnN0IGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuICBsZXQgaSA9IDA7XG4gIGxldCBuID0gaW5pdGlhbE47XG4gIGxldCBiaWFzID0gaW5pdGlhbEJpYXM7XG5cbiAgLy8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG4gIC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG4gIC8vIHRoZSBmaXJzdCBiYXNpYyBjb2RlIHBvaW50cyB0byB0aGUgb3V0cHV0LlxuXG4gIGxldCBiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG4gIGlmIChiYXNpYyA8IDApIHtcbiAgICBiYXNpYyA9IDA7XG4gIH1cblxuICBmb3IgKGxldCBqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcbiAgICAvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcbiAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChqKSA+PSAweDgwKSB7XG4gICAgICBlcnJvcihcIm5vdC1iYXNpY1wiKTtcbiAgICB9XG4gICAgb3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG4gIH1cblxuICAvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG4gIC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cbiAgZm9yIChcbiAgICBsZXQgaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwO1xuICAgIGluZGV4IDwgaW5wdXRMZW5ndGg7XG4gICAgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqL1xuICApIHtcbiAgICAvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG4gICAgLy8gRGVjb2RlIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXIgaW50byBgZGVsdGFgLFxuICAgIC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG4gICAgLy8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcbiAgICAvLyB2YWx1ZSBhdCB0aGUgZW5kIHRvIG9idGFpbiBgZGVsdGFgLlxuICAgIGNvbnN0IG9sZGkgPSBpO1xuICAgIGZvciAobGV0IHcgPSAxLCBrID0gYmFzZTs7IC8qIG5vIGNvbmRpdGlvbiAqLyBrICs9IGJhc2UpIHtcbiAgICAgIGlmIChpbmRleCA+PSBpbnB1dExlbmd0aCkge1xuICAgICAgICBlcnJvcihcImludmFsaWQtaW5wdXRcIik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG4gICAgICBpZiAoZGlnaXQgPj0gYmFzZSB8fCBkaWdpdCA+IGZsb29yKChtYXhJbnQgLSBpKSAvIHcpKSB7XG4gICAgICAgIGVycm9yKFwib3ZlcmZsb3dcIik7XG4gICAgICB9XG5cbiAgICAgIGkgKz0gZGlnaXQgKiB3O1xuICAgICAgY29uc3QgdCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cbiAgICAgIGlmIChkaWdpdCA8IHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcbiAgICAgIGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcbiAgICAgICAgZXJyb3IoXCJvdmVyZmxvd1wiKTtcbiAgICAgIH1cblxuICAgICAgdyAqPSBiYXNlTWludXNUO1xuICAgIH1cblxuICAgIGNvbnN0IG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuICAgIGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG4gICAgLy8gYGlgIHdhcyBzdXBwb3NlZCB0byB3cmFwIGFyb3VuZCBmcm9tIGBvdXRgIHRvIGAwYCxcbiAgICAvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuICAgIGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcbiAgICAgIGVycm9yKFwib3ZlcmZsb3dcIik7XG4gICAgfVxuXG4gICAgbiArPSBmbG9vcihpIC8gb3V0KTtcbiAgICBpICU9IG91dDtcblxuICAgIC8vIEluc2VydCBgbmAgYXQgcG9zaXRpb24gYGlgIG9mIHRoZSBvdXRwdXQuXG4gICAgb3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuICB9XG5cbiAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KC4uLm91dHB1dCk7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzIChlLmcuIGEgZG9tYWluIG5hbWUgbGFiZWwpIHRvIGFcbiAqIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG4gKlxuICogQHBhcmFtIHN0ciBUaGUgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cbiAqIEByZXR1cm4gVGhlIHJlc3VsdGluZyBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jb2RlKHN0cjogc3RyaW5nKSB7XG4gIGNvbnN0IG91dHB1dCA9IFtdO1xuXG4gIC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIGFuIGFycmF5IG9mIFVuaWNvZGUgY29kZSBwb2ludHMuXG4gIGNvbnN0IGlucHV0ID0gdWNzMmRlY29kZShzdHIpO1xuXG4gIC8vIENhY2hlIHRoZSBsZW5ndGguXG4gIGNvbnN0IGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG4gIC8vIEluaXRpYWxpemUgdGhlIHN0YXRlLlxuICBsZXQgbiA9IGluaXRpYWxOO1xuICBsZXQgZGVsdGEgPSAwO1xuICBsZXQgYmlhcyA9IGluaXRpYWxCaWFzO1xuXG4gIC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHMuXG4gIGZvciAoY29uc3QgY3VycmVudFZhbHVlIG9mIGlucHV0KSB7XG4gICAgaWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcbiAgICAgIG91dHB1dC5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuICBsZXQgaGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aDtcblxuICAvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcbiAgLy8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG4gIC8vIEZpbmlzaCB0aGUgYmFzaWMgc3RyaW5nIHdpdGggYSBkZWxpbWl0ZXIgdW5sZXNzIGl0J3MgZW1wdHkuXG4gIGlmIChiYXNpY0xlbmd0aCkge1xuICAgIG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG4gIH1cblxuICAvLyBNYWluIGVuY29kaW5nIGxvb3A6XG4gIHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG4gICAgLy8gQWxsIG5vbi1iYXNpYyBjb2RlIHBvaW50cyA8IG4gaGF2ZSBiZWVuIGhhbmRsZWQgYWxyZWFkeS4gRmluZCB0aGUgbmV4dFxuICAgIC8vIGxhcmdlciBvbmU6XG4gICAgbGV0IG0gPSBtYXhJbnQ7XG5cbiAgICBmb3IgKGNvbnN0IGN1cnJlbnRWYWx1ZSBvZiBpbnB1dCkge1xuICAgICAgaWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcbiAgICAgICAgbSA9IGN1cnJlbnRWYWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG4gICAgLy8gYnV0IGd1YXJkIGFnYWluc3Qgb3ZlcmZsb3cuXG4gICAgY29uc3QgaGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXG4gICAgaWYgKG0gLSBuID4gTWF0aC5mbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuICAgICAgZXJyb3IoXCJvdmVyZmxvd1wiKTtcbiAgICB9XG5cbiAgICBkZWx0YSArPSAobSAtIG4pICogaGFuZGxlZENQQ291bnRQbHVzT25lO1xuICAgIG4gPSBtO1xuXG4gICAgZm9yIChjb25zdCBjdXJyZW50VmFsdWUgb2YgaW5wdXQpIHtcbiAgICAgIGlmIChjdXJyZW50VmFsdWUgPCBuICYmICsrZGVsdGEgPiBtYXhJbnQpIHtcbiAgICAgICAgZXJyb3IoXCJvdmVyZmxvd1wiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG4gICAgICAgIC8vIFJlcHJlc2VudCBkZWx0YSBhcyBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyLlxuICAgICAgICBsZXQgcSA9IGRlbHRhO1xuXG4gICAgICAgIGZvciAobGV0IGsgPSBiYXNlOzsgLyogbm8gY29uZGl0aW9uICovIGsgKz0gYmFzZSkge1xuICAgICAgICAgIGNvbnN0IHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG4gICAgICAgICAgaWYgKHEgPCB0KSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBxTWludXNUID0gcSAtIHQ7XG4gICAgICAgICAgY29uc3QgYmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXG4gICAgICAgICAgb3V0cHV0LnB1c2goXG4gICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyh0ICsgcU1pbnVzVCAlIGJhc2VNaW51c1QsIDApKSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgcSA9IE1hdGguZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0cHV0LnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblxuICAgICAgICBiaWFzID0gYWRhcHQoXG4gICAgICAgICAgZGVsdGEsXG4gICAgICAgICAgaGFuZGxlZENQQ291bnRQbHVzT25lLFxuICAgICAgICAgIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoLFxuICAgICAgICApO1xuXG4gICAgICAgIGRlbHRhID0gMDtcbiAgICAgICAgKytoYW5kbGVkQ1BDb3VudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICArK2RlbHRhO1xuICAgICsrbjtcbiAgfVxuXG4gIHJldHVybiBvdXRwdXQuam9pbihcIlwiKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzXG4gKiB0byBVbmljb2RlLiBPbmx5IHRoZSBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGlucHV0IHdpbGwgYmUgY29udmVydGVkLCBpLmUuXG4gKiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCBvbiBhIHN0cmluZyB0aGF0IGhhcyBhbHJlYWR5IGJlZW5cbiAqIGNvbnZlcnRlZCB0byBVbmljb2RlLlxuICogQG1lbWJlck9mIHB1bnljb2RlXG4gKiBAcGFyYW0gaW5wdXQgVGhlIFB1bnljb2RlZCBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvXG4gKiBjb252ZXJ0IHRvIFVuaWNvZGUuXG4gKiBAcmV0dXJucyBUaGUgVW5pY29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gUHVueWNvZGVcbiAqIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvVW5pY29kZShpbnB1dDogc3RyaW5nKSB7XG4gIHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICByZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcbiAgICAgID8gZGVjb2RlKHN0cmluZy5zbGljZSg0KS50b0xvd2VyQ2FzZSgpKVxuICAgICAgOiBzdHJpbmc7XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzcyB0b1xuICogUHVueWNvZGUuIE9ubHkgdGhlIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsXG4gKiBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW5cbiAqIEFTQ0lJLlxuICpcbiAqIEBwYXJhbSBpbnB1dCBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0byBjb252ZXJ0LCBhcyBhXG4gKiBVbmljb2RlIHN0cmluZy5cbiAqIEByZXR1cm4gVGhlIFB1bnljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBkb21haW4gbmFtZSBvclxuICogZW1haWwgYWRkcmVzcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvQVNDSUkoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uIChzdHI6IHN0cmluZykge1xuICAgIHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyKSA/IFwieG4tLVwiICsgZW5jb2RlKHN0cikgOiBzdHI7XG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFDdEQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSxnRUFBZ0U7QUFDaEUsc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSw0RUFBNEU7QUFDNUUscUVBQXFFO0FBQ3JFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUN6RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLDZEQUE2RDtBQUM3RCw0RUFBNEU7QUFDNUUsMkVBQTJFO0FBQzNFLHdFQUF3RTtBQUN4RSw0RUFBNEU7QUFDNUUseUNBQXlDO0FBRXpDLHVEQUF1RDtBQUV2RCx3RUFBd0U7QUFDeEUsa0VBQWtFO0FBQ2xFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUscUVBQXFFO0FBQ3JFLHdFQUF3RTtBQUN4RSw0QkFBNEI7QUFFNUIsaUVBQWlFO0FBQ2pFLGtFQUFrRTtBQUVsRSxrRUFBa0U7QUFDbEUscUVBQXFFO0FBQ3JFLHdEQUF3RDtBQUN4RCx5RUFBeUU7QUFDekUseUVBQXlFO0FBQ3pFLHdFQUF3RTtBQUN4RSxrRUFBa0U7QUFFbEUsNERBQTREO0FBRTVELCtFQUErRTtBQUMvRSxzRUFBc0U7QUFFdEU7QUFFQSwrQ0FBK0MsR0FDL0MsTUFBTSxTQUFTLFlBQVksNEJBQTRCO0FBRXZELDBCQUEwQixHQUMxQixNQUFNLE9BQU87QUFDYixNQUFNLE9BQU87QUFDYixNQUFNLE9BQU87QUFDYixNQUFNLE9BQU87QUFDYixNQUFNLE9BQU87QUFDYixNQUFNLGNBQWM7QUFDcEIsTUFBTSxXQUFXLEtBQUssT0FBTztBQUM3QixNQUFNLFlBQVksS0FBSyxTQUFTO0FBRWhDLHdCQUF3QixHQUN4QixNQUFNLGdCQUFnQjtBQUN0QixNQUFNLGdCQUFnQixjQUFjLGtCQUFrQjtBQUN0RCxNQUFNLGtCQUFrQiw2QkFBNkIsc0JBQXNCO0FBRTNFLG1CQUFtQixHQUNuQixNQUFNLFNBQWlDO0lBQ3JDLFlBQVk7SUFDWixhQUFhO0lBQ2IsaUJBQWlCO0FBQ25CO0FBRUEsMEJBQTBCLEdBQzFCLE1BQU0sZ0JBQWdCLE9BQU87QUFDN0IsTUFBTSxRQUFRLEtBQUssS0FBSztBQUV4Qjs7Ozs7Q0FLQyxHQUNELFNBQVMsTUFBTSxJQUFZLEVBQUU7SUFDM0IsTUFBTSxJQUFJLFdBQVcsTUFBTSxDQUFDLEtBQUssRUFBRTtBQUNyQztBQUVBOzs7Ozs7Ozs7Q0FTQyxHQUNELFNBQVMsVUFBVSxHQUFXLEVBQUUsRUFBNkIsRUFBRTtJQUM3RCxNQUFNLFFBQVEsSUFBSSxLQUFLLENBQUM7SUFDeEIsSUFBSSxTQUFTO0lBRWIsSUFBSSxNQUFNLE1BQU0sR0FBRyxHQUFHO1FBQ3BCLHNFQUFzRTtRQUN0RSxxREFBcUQ7UUFDckQsU0FBUyxLQUFLLENBQUMsRUFBRSxHQUFHO1FBQ3BCLE1BQU0sS0FBSyxDQUFDLEVBQUU7SUFDaEIsQ0FBQztJQUVELHVEQUF1RDtJQUN2RCxNQUFNLElBQUksT0FBTyxDQUFDLGlCQUFpQjtJQUNuQyxNQUFNLFNBQVMsSUFBSSxLQUFLLENBQUM7SUFDekIsTUFBTSxVQUFVLE9BQU8sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDO0lBRXBDLE9BQU8sU0FBUztBQUNsQjtBQUVBOzs7Ozs7Ozs7Q0FTQyxHQUNELFNBQVMsV0FBVyxHQUFXLEVBQUU7SUFDL0IsTUFBTSxTQUFTLEVBQUU7SUFDakIsSUFBSSxVQUFVO0lBQ2QsTUFBTSxTQUFTLElBQUksTUFBTTtJQUV6QixNQUFPLFVBQVUsT0FBUTtRQUN2QixNQUFNLFFBQVEsSUFBSSxVQUFVLENBQUM7UUFFN0IsSUFBSSxTQUFTLFVBQVUsU0FBUyxVQUFVLFVBQVUsUUFBUTtZQUMxRCx3REFBd0Q7WUFDeEQsTUFBTSxRQUFRLElBQUksVUFBVSxDQUFDO1lBRTdCLElBQUksQ0FBQyxRQUFRLE1BQU0sS0FBSyxRQUFRO2dCQUM5QixPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUk7WUFDMUQsT0FBTztnQkFDTCx1RUFBdUU7Z0JBQ3ZFLDREQUE0RDtnQkFDNUQsT0FBTyxJQUFJLENBQUM7Z0JBQ1o7WUFDRixDQUFDO1FBQ0gsT0FBTztZQUNMLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNIO0lBRUEsT0FBTztBQUNUO0FBRUE7Ozs7Ozs7Q0FPQyxHQUNELFNBQVMsV0FBVyxLQUFlLEVBQUU7SUFDbkMsT0FBTyxPQUFPLGFBQWEsSUFBSTtBQUNqQztBQUVBLE9BQU8sTUFBTSxPQUFPO0lBQ2xCLFFBQVE7SUFDUixRQUFRO0FBQ1YsRUFBRTtBQUVGOzs7Ozs7OztDQVFDLEdBQ0QsU0FBUyxhQUFhLFNBQWlCLEVBQUU7SUFDdkMsSUFBSSxZQUFZLE9BQU8sTUFBTTtRQUMzQixPQUFPLFlBQVk7SUFDckIsQ0FBQztJQUNELElBQUksWUFBWSxPQUFPLE1BQU07UUFDM0IsT0FBTyxZQUFZO0lBQ3JCLENBQUM7SUFDRCxJQUFJLFlBQVksT0FBTyxNQUFNO1FBQzNCLE9BQU8sWUFBWTtJQUNyQixDQUFDO0lBQ0QsT0FBTztBQUNUO0FBRUE7Ozs7Ozs7OztDQVNDLEdBQ0QsU0FBUyxhQUFhLEtBQWEsRUFBRSxJQUFZLEVBQUU7SUFDakQsbUNBQW1DO0lBQ25DLDJCQUEyQjtJQUMzQixPQUFPLFFBQVEsS0FBSyxLQUFLLE9BQU8sUUFBUSxNQUFNLENBQUMsT0FBTyxRQUFRLE1BQU0sQ0FBQztBQUN2RTtBQUVBOzs7Q0FHQyxHQUNELFNBQVMsTUFBTSxLQUFhLEVBQUUsU0FBaUIsRUFBRSxTQUFrQixFQUFFO0lBQ25FLElBQUksSUFBSTtJQUNSLFFBQVEsWUFBWSxLQUFLLEtBQUssQ0FBQyxRQUFRLFFBQVEsU0FBUyxDQUFDO0lBQ3pELFNBQVMsS0FBSyxLQUFLLENBQUMsUUFBUTtJQUU1QixNQUErQixRQUFRLGdCQUFnQixRQUFRLEdBQUcsS0FBSyxLQUFNO1FBQzNFLFFBQVEsS0FBSyxLQUFLLENBQUMsUUFBUTtJQUM3QjtJQUVBLE9BQU8sS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksUUFBUSxDQUFDLFFBQVEsSUFBSTtBQUNuRTtBQUVBOzs7Ozs7Q0FNQyxHQUNELE9BQU8sU0FBUyxPQUFPLEtBQWEsRUFBVTtJQUM1QyxtQkFBbUI7SUFDbkIsTUFBTSxTQUFTLEVBQUU7SUFDakIsTUFBTSxjQUFjLE1BQU0sTUFBTTtJQUNoQyxJQUFJLElBQUk7SUFDUixJQUFJLElBQUk7SUFDUixJQUFJLE9BQU87SUFFWCx3RUFBd0U7SUFDeEUsdUVBQXVFO0lBQ3ZFLDZDQUE2QztJQUU3QyxJQUFJLFFBQVEsTUFBTSxXQUFXLENBQUM7SUFDOUIsSUFBSSxRQUFRLEdBQUc7UUFDYixRQUFRO0lBQ1YsQ0FBQztJQUVELElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPLEVBQUUsRUFBRztRQUM5QixpQ0FBaUM7UUFDakMsSUFBSSxNQUFNLFVBQVUsQ0FBQyxNQUFNLE1BQU07WUFDL0IsTUFBTTtRQUNSLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLFVBQVUsQ0FBQztJQUMvQjtJQUVBLDRFQUE0RTtJQUM1RSx3REFBd0Q7SUFFeEQsSUFDRSxJQUFJLFFBQVEsUUFBUSxJQUFJLFFBQVEsSUFBSSxDQUFDLEVBQ3JDLFFBQVEsYUFFUjtRQUNBLDZEQUE2RDtRQUM3RCw2REFBNkQ7UUFDN0QsMkRBQTJEO1FBQzNELDhEQUE4RDtRQUM5RCxzQ0FBc0M7UUFDdEMsTUFBTSxPQUFPO1FBQ2IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQTBCLEtBQUssS0FBTTtZQUN2RCxJQUFJLFNBQVMsYUFBYTtnQkFDeEIsTUFBTTtZQUNSLENBQUM7WUFFRCxNQUFNLFFBQVEsYUFBYSxNQUFNLFVBQVUsQ0FBQztZQUU1QyxJQUFJLFNBQVMsUUFBUSxRQUFRLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJO2dCQUNwRCxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUssUUFBUTtZQUNiLE1BQU0sSUFBSSxLQUFLLE9BQU8sT0FBUSxLQUFLLE9BQU8sT0FBTyxPQUFPLElBQUksSUFBSSxBQUFDO1lBRWpFLElBQUksUUFBUSxHQUFHO2dCQUNiLEtBQU07WUFDUixDQUFDO1lBRUQsTUFBTSxhQUFhLE9BQU87WUFDMUIsSUFBSSxJQUFJLE1BQU0sU0FBUyxhQUFhO2dCQUNsQyxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUs7UUFDUDtRQUVBLE1BQU0sTUFBTSxPQUFPLE1BQU0sR0FBRztRQUM1QixPQUFPLE1BQU0sSUFBSSxNQUFNLEtBQUssUUFBUTtRQUVwQyxxREFBcUQ7UUFDckQscURBQXFEO1FBQ3JELElBQUksTUFBTSxJQUFJLE9BQU8sU0FBUyxHQUFHO1lBQy9CLE1BQU07UUFDUixDQUFDO1FBRUQsS0FBSyxNQUFNLElBQUk7UUFDZixLQUFLO1FBRUwsNENBQTRDO1FBQzVDLE9BQU8sTUFBTSxDQUFDLEtBQUssR0FBRztJQUN4QjtJQUVBLE9BQU8sT0FBTyxhQUFhLElBQUk7QUFDakMsQ0FBQztBQUVEOzs7Ozs7Q0FNQyxHQUNELE9BQU8sU0FBUyxPQUFPLEdBQVcsRUFBRTtJQUNsQyxNQUFNLFNBQVMsRUFBRTtJQUVqQixpRUFBaUU7SUFDakUsTUFBTSxRQUFRLFdBQVc7SUFFekIsb0JBQW9CO0lBQ3BCLE1BQU0sY0FBYyxNQUFNLE1BQU07SUFFaEMsd0JBQXdCO0lBQ3hCLElBQUksSUFBSTtJQUNSLElBQUksUUFBUTtJQUNaLElBQUksT0FBTztJQUVYLGdDQUFnQztJQUNoQyxLQUFLLE1BQU0sZ0JBQWdCLE1BQU87UUFDaEMsSUFBSSxlQUFlLE1BQU07WUFDdkIsT0FBTyxJQUFJLENBQUMsT0FBTyxZQUFZLENBQUM7UUFDbEMsQ0FBQztJQUNIO0lBRUEsTUFBTSxjQUFjLE9BQU8sTUFBTTtJQUNqQyxJQUFJLGlCQUFpQjtJQUVyQix3RUFBd0U7SUFDeEUsb0RBQW9EO0lBRXBELDhEQUE4RDtJQUM5RCxJQUFJLGFBQWE7UUFDZixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxzQkFBc0I7SUFDdEIsTUFBTyxpQkFBaUIsWUFBYTtRQUNuQyx5RUFBeUU7UUFDekUsY0FBYztRQUNkLElBQUksSUFBSTtRQUVSLEtBQUssTUFBTSxpQkFBZ0IsTUFBTztZQUNoQyxJQUFJLGlCQUFnQixLQUFLLGdCQUFlLEdBQUc7Z0JBQ3pDLElBQUk7WUFDTixDQUFDO1FBQ0g7UUFFQSx5RUFBeUU7UUFDekUsOEJBQThCO1FBQzlCLE1BQU0sd0JBQXdCLGlCQUFpQjtRQUUvQyxJQUFJLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDLFNBQVMsS0FBSyxJQUFJLHdCQUF3QjtZQUNoRSxNQUFNO1FBQ1IsQ0FBQztRQUVELFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSTtRQUNuQixJQUFJO1FBRUosS0FBSyxNQUFNLGlCQUFnQixNQUFPO1lBQ2hDLElBQUksZ0JBQWUsS0FBSyxFQUFFLFFBQVEsUUFBUTtnQkFDeEMsTUFBTTtZQUNSLENBQUM7WUFFRCxJQUFJLGlCQUFnQixHQUFHO2dCQUNyQiw0REFBNEQ7Z0JBQzVELElBQUksSUFBSTtnQkFFUixJQUFLLElBQUksSUFBSSxPQUEwQixLQUFLLEtBQU07b0JBQ2hELE1BQU0sSUFBSSxLQUFLLE9BQU8sT0FBUSxLQUFLLE9BQU8sT0FBTyxPQUFPLElBQUksSUFBSSxBQUFDO29CQUVqRSxJQUFJLElBQUksR0FBRzt3QkFDVCxLQUFNO29CQUNSLENBQUM7b0JBRUQsTUFBTSxVQUFVLElBQUk7b0JBQ3BCLE1BQU0sYUFBYSxPQUFPO29CQUUxQixPQUFPLElBQUksQ0FDVCxPQUFPLFlBQVksQ0FBQyxhQUFhLElBQUksVUFBVSxZQUFZO29CQUc3RCxJQUFJLEtBQUssS0FBSyxDQUFDLFVBQVU7Z0JBQzNCO2dCQUVBLE9BQU8sSUFBSSxDQUFDLE9BQU8sWUFBWSxDQUFDLGFBQWEsR0FBRztnQkFFaEQsT0FBTyxNQUNMLE9BQ0EsdUJBQ0Esa0JBQWtCO2dCQUdwQixRQUFRO2dCQUNSLEVBQUU7WUFDSixDQUFDO1FBQ0g7UUFFQSxFQUFFO1FBQ0YsRUFBRTtJQUNKO0lBRUEsT0FBTyxPQUFPLElBQUksQ0FBQztBQUNyQixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Q0FVQyxHQUNELE9BQU8sU0FBUyxVQUFVLEtBQWEsRUFBRTtJQUN2QyxPQUFPLFVBQVUsT0FBTyxTQUFVLE1BQU0sRUFBRTtRQUN4QyxPQUFPLGNBQWMsSUFBSSxDQUFDLFVBQ3RCLE9BQU8sT0FBTyxLQUFLLENBQUMsR0FBRyxXQUFXLE1BQ2xDLE1BQU07SUFDWjtBQUNGLENBQUM7QUFFRDs7Ozs7Ozs7OztDQVVDLEdBQ0QsT0FBTyxTQUFTLFFBQVEsS0FBYSxFQUFVO0lBQzdDLE9BQU8sVUFBVSxPQUFPLFNBQVUsR0FBVyxFQUFFO1FBQzdDLE9BQU8sY0FBYyxJQUFJLENBQUMsT0FBTyxTQUFTLE9BQU8sT0FBTyxHQUFHO0lBQzdEO0FBQ0YsQ0FBQyJ9