// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "./buffer.ts";
import { encodeStr, hexTable } from "./internal/querystring.ts";
/**
 * Alias of querystring.parse()
 * @legacy
 */ export const decode = parse;
/**
 * Alias of querystring.stringify()
 * @legacy
 */ export const encode = stringify;
/**
 * replaces encodeURIComponent()
 * @see https://www.ecma-international.org/ecma-262/5.1/#sec-15.1.3.4
 */ function qsEscape(str) {
    if (typeof str !== "string") {
        if (typeof str === "object") {
            str = String(str);
        } else {
            str += "";
        }
    }
    return encodeStr(str, noEscape, hexTable);
}
/**
 * Performs URL percent-encoding on the given `str` in a manner that is optimized for the specific requirements of URL query strings.
 * Used by `querystring.stringify()` and is generally not expected to be used directly.
 * It is exported primarily to allow application code to provide a replacement percent-encoding implementation if necessary by assigning `querystring.escape` to an alternative function.
 * @legacy
 * @see Tested in `test-querystring-escape.js`
 */ export const escape = qsEscape;
// deno-fmt-ignore
const isHexTable = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
]);
function charCodes(str) {
    const ret = new Array(str.length);
    for(let i = 0; i < str.length; ++i){
        ret[i] = str.charCodeAt(i);
    }
    return ret;
}
function addKeyVal(obj, key, value, keyEncoded, valEncoded, decode) {
    if (key.length > 0 && keyEncoded) {
        key = decode(key);
    }
    if (value.length > 0 && valEncoded) {
        value = decode(value);
    }
    if (obj[key] === undefined) {
        obj[key] = value;
    } else {
        const curValue = obj[key];
        // A simple Array-specific property check is enough here to
        // distinguish from a string value and is faster and still safe
        // since we are generating all of the values being assigned.
        if (curValue.pop) {
            curValue[curValue.length] = value;
        } else {
            obj[key] = [
                curValue,
                value
            ];
        }
    }
}
/**
 * Parses a URL query string into a collection of key and value pairs.
 * @param str The URL query string to parse
 * @param sep The substring used to delimit key and value pairs in the query string. Default: '&'.
 * @param eq The substring used to delimit keys and values in the query string. Default: '='.
 * @param options The parse options
 * @param options.decodeURIComponent The function to use when decoding percent-encoded characters in the query string. Default: `querystring.unescape()`.
 * @param options.maxKeys Specifies the maximum number of keys to parse. Specify `0` to remove key counting limitations. Default: `1000`.
 * @legacy
 * @see Tested in test-querystring.js
 */ export function parse(str, sep = "&", eq = "=", { decodeURIComponent: decodeURIComponent1 = unescape , maxKeys =1000  } = {}) {
    const obj = Object.create(null);
    if (typeof str !== "string" || str.length === 0) {
        return obj;
    }
    const sepCodes = !sep ? [
        38
    ] : charCodes(String(sep));
    const eqCodes = !eq ? [
        61
    ] : charCodes(String(eq));
    const sepLen = sepCodes.length;
    const eqLen = eqCodes.length;
    let pairs = 1000;
    if (typeof maxKeys === "number") {
        // -1 is used in place of a value like Infinity for meaning
        // "unlimited pairs" because of additional checks V8 (at least as of v5.4)
        // has to do when using variables that contain values like Infinity. Since
        // `pairs` is always decremented and checked explicitly for 0, -1 works
        // effectively the same as Infinity, while providing a significant
        // performance boost.
        pairs = maxKeys > 0 ? maxKeys : -1;
    }
    let decode = unescape;
    if (decodeURIComponent1) {
        decode = decodeURIComponent1;
    }
    const customDecode = decode !== unescape;
    let lastPos = 0;
    let sepIdx = 0;
    let eqIdx = 0;
    let key = "";
    let value = "";
    let keyEncoded = customDecode;
    let valEncoded = customDecode;
    const plusChar = customDecode ? "%20" : " ";
    let encodeCheck = 0;
    for(let i = 0; i < str.length; ++i){
        const code = str.charCodeAt(i);
        // Try matching key/value pair separator (e.g. '&')
        if (code === sepCodes[sepIdx]) {
            if (++sepIdx === sepLen) {
                // Key/value pair separator match!
                const end = i - sepIdx + 1;
                if (eqIdx < eqLen) {
                    // We didn't find the (entire) key/value separator
                    if (lastPos < end) {
                        // Treat the substring as part of the key instead of the value
                        key += str.slice(lastPos, end);
                    } else if (key.length === 0) {
                        // We saw an empty substring between separators
                        if (--pairs === 0) {
                            return obj;
                        }
                        lastPos = i + 1;
                        sepIdx = eqIdx = 0;
                        continue;
                    }
                } else if (lastPos < end) {
                    value += str.slice(lastPos, end);
                }
                addKeyVal(obj, key, value, keyEncoded, valEncoded, decode);
                if (--pairs === 0) {
                    return obj;
                }
                key = value = "";
                encodeCheck = 0;
                lastPos = i + 1;
                sepIdx = eqIdx = 0;
            }
        } else {
            sepIdx = 0;
            // Try matching key/value separator (e.g. '=') if we haven't already
            if (eqIdx < eqLen) {
                if (code === eqCodes[eqIdx]) {
                    if (++eqIdx === eqLen) {
                        // Key/value separator match!
                        const end1 = i - eqIdx + 1;
                        if (lastPos < end1) {
                            key += str.slice(lastPos, end1);
                        }
                        encodeCheck = 0;
                        lastPos = i + 1;
                    }
                    continue;
                } else {
                    eqIdx = 0;
                    if (!keyEncoded) {
                        // Try to match an (valid) encoded byte once to minimize unnecessary
                        // calls to string decoding functions
                        if (code === 37 /* % */ ) {
                            encodeCheck = 1;
                            continue;
                        } else if (encodeCheck > 0) {
                            if (isHexTable[code] === 1) {
                                if (++encodeCheck === 3) {
                                    keyEncoded = true;
                                }
                                continue;
                            } else {
                                encodeCheck = 0;
                            }
                        }
                    }
                }
                if (code === 43 /* + */ ) {
                    if (lastPos < i) {
                        key += str.slice(lastPos, i);
                    }
                    key += plusChar;
                    lastPos = i + 1;
                    continue;
                }
            }
            if (code === 43 /* + */ ) {
                if (lastPos < i) {
                    value += str.slice(lastPos, i);
                }
                value += plusChar;
                lastPos = i + 1;
            } else if (!valEncoded) {
                // Try to match an (valid) encoded byte (once) to minimize unnecessary
                // calls to string decoding functions
                if (code === 37 /* % */ ) {
                    encodeCheck = 1;
                } else if (encodeCheck > 0) {
                    if (isHexTable[code] === 1) {
                        if (++encodeCheck === 3) {
                            valEncoded = true;
                        }
                    } else {
                        encodeCheck = 0;
                    }
                }
            }
        }
    }
    // Deal with any leftover key or value data
    if (lastPos < str.length) {
        if (eqIdx < eqLen) {
            key += str.slice(lastPos);
        } else if (sepIdx < sepLen) {
            value += str.slice(lastPos);
        }
    } else if (eqIdx === 0 && key.length === 0) {
        // We ended on an empty substring
        return obj;
    }
    addKeyVal(obj, key, value, keyEncoded, valEncoded, decode);
    return obj;
}
/**
 * These characters do not need escaping when generating query strings:
 * ! - . _ ~
 * ' ( ) *
 * digits
 * alpha (uppercase)
 * alpha (lowercase)
 */ // deno-fmt-ignore
const noEscape = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    0
]);
// deno-lint-ignore no-explicit-any
function stringifyPrimitive(v) {
    if (typeof v === "string") {
        return v;
    }
    if (typeof v === "number" && isFinite(v)) {
        return "" + v;
    }
    if (typeof v === "bigint") {
        return "" + v;
    }
    if (typeof v === "boolean") {
        return v ? "true" : "false";
    }
    return "";
}
function encodeStringifiedCustom(// deno-lint-ignore no-explicit-any
v, encode) {
    return encode(stringifyPrimitive(v));
}
// deno-lint-ignore no-explicit-any
function encodeStringified(v, encode) {
    if (typeof v === "string") {
        return v.length ? encode(v) : "";
    }
    if (typeof v === "number" && isFinite(v)) {
        // Values >= 1e21 automatically switch to scientific notation which requires
        // escaping due to the inclusion of a '+' in the output
        return Math.abs(v) < 1e21 ? "" + v : encode("" + v);
    }
    if (typeof v === "bigint") {
        return "" + v;
    }
    if (typeof v === "boolean") {
        return v ? "true" : "false";
    }
    return "";
}
/**
 * Produces a URL query string from a given obj by iterating through the object's "own properties".
 * @param obj The object to serialize into a URL query string.
 * @param sep The substring used to delimit key and value pairs in the query string. Default: '&'.
 * @param eq The substring used to delimit keys and values in the query string. Default: '='.
 * @param options The stringify options
 * @param options.encodeURIComponent The function to use when converting URL-unsafe characters to percent-encoding in the query string. Default: `querystring.escape()`.
 * @legacy
 * @see Tested in `test-querystring.js`
 */ export function stringify(// deno-lint-ignore no-explicit-any
obj, sep, eq, options) {
    sep ||= "&";
    eq ||= "=";
    const encode = options ? options.encodeURIComponent : qsEscape;
    const convert = options ? encodeStringifiedCustom : encodeStringified;
    if (obj !== null && typeof obj === "object") {
        const keys = Object.keys(obj);
        const len = keys.length;
        let fields = "";
        for(let i = 0; i < len; ++i){
            const k = keys[i];
            const v = obj[k];
            let ks = convert(k, encode);
            ks += eq;
            if (Array.isArray(v)) {
                const vlen = v.length;
                if (vlen === 0) continue;
                if (fields) {
                    fields += sep;
                }
                for(let j = 0; j < vlen; ++j){
                    if (j) {
                        fields += sep;
                    }
                    fields += ks;
                    fields += convert(v[j], encode);
                }
            } else {
                if (fields) {
                    fields += sep;
                }
                fields += ks;
                fields += convert(v, encode);
            }
        }
        return fields;
    }
    return "";
}
// deno-fmt-ignore
const unhexTable = new Int8Array([
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    +0,
    +1,
    +2,
    +3,
    +4,
    +5,
    +6,
    +7,
    +8,
    +9,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    10,
    11,
    12,
    13,
    14,
    15,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    10,
    11,
    12,
    13,
    14,
    15,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
]);
/**
 * A safe fast alternative to decodeURIComponent
 */ export function unescapeBuffer(s, decodeSpaces = false) {
    const out = Buffer.alloc(s.length);
    let index = 0;
    let outIndex = 0;
    let currentChar;
    let nextChar;
    let hexHigh;
    let hexLow;
    const maxLength = s.length - 2;
    // Flag to know if some hex chars have been decoded
    let hasHex = false;
    while(index < s.length){
        currentChar = s.charCodeAt(index);
        if (currentChar === 43 /* '+' */  && decodeSpaces) {
            out[outIndex++] = 32; // ' '
            index++;
            continue;
        }
        if (currentChar === 37 /* '%' */  && index < maxLength) {
            currentChar = s.charCodeAt(++index);
            hexHigh = unhexTable[currentChar];
            if (!(hexHigh >= 0)) {
                out[outIndex++] = 37; // '%'
                continue;
            } else {
                nextChar = s.charCodeAt(++index);
                hexLow = unhexTable[nextChar];
                if (!(hexLow >= 0)) {
                    out[outIndex++] = 37; // '%'
                    index--;
                } else {
                    hasHex = true;
                    currentChar = hexHigh * 16 + hexLow;
                }
            }
        }
        out[outIndex++] = currentChar;
        index++;
    }
    return hasHex ? out.slice(0, outIndex) : out;
}
function qsUnescape(s) {
    try {
        return decodeURIComponent(s);
    } catch  {
        return unescapeBuffer(s).toString();
    }
}
/**
 * Performs decoding of URL percent-encoded characters on the given `str`.
 * Used by `querystring.parse()` and is generally not expected to be used directly.
 * It is exported primarily to allow application code to provide a replacement decoding implementation if necessary by assigning `querystring.unescape` to an alternative function.
 * @legacy
 * @see Tested in `test-querystring-escape.js`
 */ export const unescape = qsUnescape;
export default {
    parse,
    stringify,
    decode,
    encode,
    unescape,
    escape,
    unescapeBuffer
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvcXVlcnlzdHJpbmcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgZW5jb2RlU3RyLCBoZXhUYWJsZSB9IGZyb20gXCIuL2ludGVybmFsL3F1ZXJ5c3RyaW5nLnRzXCI7XG5cbi8qKlxuICogQWxpYXMgb2YgcXVlcnlzdHJpbmcucGFyc2UoKVxuICogQGxlZ2FjeVxuICovXG5leHBvcnQgY29uc3QgZGVjb2RlID0gcGFyc2U7XG5cbi8qKlxuICogQWxpYXMgb2YgcXVlcnlzdHJpbmcuc3RyaW5naWZ5KClcbiAqIEBsZWdhY3lcbiAqL1xuZXhwb3J0IGNvbnN0IGVuY29kZSA9IHN0cmluZ2lmeTtcblxuLyoqXG4gKiByZXBsYWNlcyBlbmNvZGVVUklDb21wb25lbnQoKVxuICogQHNlZSBodHRwczovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzUuMS8jc2VjLTE1LjEuMy40XG4gKi9cbmZ1bmN0aW9uIHFzRXNjYXBlKHN0cjogdW5rbm93bik6IHN0cmluZyB7XG4gIGlmICh0eXBlb2Ygc3RyICE9PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHR5cGVvZiBzdHIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHN0ciA9IFN0cmluZyhzdHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gXCJcIjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVuY29kZVN0cihzdHIgYXMgc3RyaW5nLCBub0VzY2FwZSwgaGV4VGFibGUpO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIFVSTCBwZXJjZW50LWVuY29kaW5nIG9uIHRoZSBnaXZlbiBgc3RyYCBpbiBhIG1hbm5lciB0aGF0IGlzIG9wdGltaXplZCBmb3IgdGhlIHNwZWNpZmljIHJlcXVpcmVtZW50cyBvZiBVUkwgcXVlcnkgc3RyaW5ncy5cbiAqIFVzZWQgYnkgYHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeSgpYCBhbmQgaXMgZ2VuZXJhbGx5IG5vdCBleHBlY3RlZCB0byBiZSB1c2VkIGRpcmVjdGx5LlxuICogSXQgaXMgZXhwb3J0ZWQgcHJpbWFyaWx5IHRvIGFsbG93IGFwcGxpY2F0aW9uIGNvZGUgdG8gcHJvdmlkZSBhIHJlcGxhY2VtZW50IHBlcmNlbnQtZW5jb2RpbmcgaW1wbGVtZW50YXRpb24gaWYgbmVjZXNzYXJ5IGJ5IGFzc2lnbmluZyBgcXVlcnlzdHJpbmcuZXNjYXBlYCB0byBhbiBhbHRlcm5hdGl2ZSBmdW5jdGlvbi5cbiAqIEBsZWdhY3lcbiAqIEBzZWUgVGVzdGVkIGluIGB0ZXN0LXF1ZXJ5c3RyaW5nLWVzY2FwZS5qc2BcbiAqL1xuZXhwb3J0IGNvbnN0IGVzY2FwZSA9IHFzRXNjYXBlO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFVybFF1ZXJ5IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW10gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVXJsUXVlcnlJbnB1dCB7XG4gIFtrZXk6IHN0cmluZ106XG4gICAgfCBzdHJpbmdcbiAgICB8IG51bWJlclxuICAgIHwgYm9vbGVhblxuICAgIHwgUmVhZG9ubHlBcnJheTxzdHJpbmc+XG4gICAgfCBSZWFkb25seUFycmF5PG51bWJlcj5cbiAgICB8IFJlYWRvbmx5QXJyYXk8Ym9vbGVhbj5cbiAgICB8IG51bGxcbiAgICB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIFBhcnNlT3B0aW9ucyB7XG4gIC8qKiBUaGUgZnVuY3Rpb24gdG8gdXNlIHdoZW4gZGVjb2RpbmcgcGVyY2VudC1lbmNvZGVkIGNoYXJhY3RlcnMgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gKi9cbiAgZGVjb2RlVVJJQ29tcG9uZW50PzogKHN0cmluZzogc3RyaW5nKSA9PiBzdHJpbmc7XG4gIC8qKiBTcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGtleXMgdG8gcGFyc2UuICovXG4gIG1heEtleXM/OiBudW1iZXI7XG59XG5cbi8vIGRlbm8tZm10LWlnbm9yZVxuY29uc3QgaXNIZXhUYWJsZSA9IG5ldyBJbnQ4QXJyYXkoW1xuICAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAvLyAwIC0gMTVcbiAgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgLy8gMTYgLSAzMVxuICAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAvLyAzMiAtIDQ3XG4gIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDAsIDAsIDAsIDAsIDAsIDAsIC8vIDQ4IC0gNjNcbiAgMCwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgLy8gNjQgLSA3OVxuICAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAvLyA4MCAtIDk1XG4gIDAsIDEsIDEsIDEsIDEsIDEsIDEsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIC8vIDk2IC0gMTExXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIC8vIDExMiAtIDEyN1xuICAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAvLyAxMjggLi4uXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsICAvLyAuLi4gMjU2XG5dKTtcblxuZnVuY3Rpb24gY2hhckNvZGVzKHN0cjogc3RyaW5nKTogbnVtYmVyW10ge1xuICBjb25zdCByZXQgPSBuZXcgQXJyYXkoc3RyLmxlbmd0aCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgcmV0W2ldID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gYWRkS2V5VmFsKFxuICBvYmo6IFBhcnNlZFVybFF1ZXJ5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IHN0cmluZyxcbiAga2V5RW5jb2RlZDogYm9vbGVhbixcbiAgdmFsRW5jb2RlZDogYm9vbGVhbixcbiAgZGVjb2RlOiAoZW5jb2RlZFVSSUNvbXBvbmVudDogc3RyaW5nKSA9PiBzdHJpbmcsXG4pIHtcbiAgaWYgKGtleS5sZW5ndGggPiAwICYmIGtleUVuY29kZWQpIHtcbiAgICBrZXkgPSBkZWNvZGUoa2V5KTtcbiAgfVxuICBpZiAodmFsdWUubGVuZ3RoID4gMCAmJiB2YWxFbmNvZGVkKSB7XG4gICAgdmFsdWUgPSBkZWNvZGUodmFsdWUpO1xuICB9XG5cbiAgaWYgKG9ialtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICBvYmpba2V5XSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGN1clZhbHVlID0gb2JqW2tleV07XG4gICAgLy8gQSBzaW1wbGUgQXJyYXktc3BlY2lmaWMgcHJvcGVydHkgY2hlY2sgaXMgZW5vdWdoIGhlcmUgdG9cbiAgICAvLyBkaXN0aW5ndWlzaCBmcm9tIGEgc3RyaW5nIHZhbHVlIGFuZCBpcyBmYXN0ZXIgYW5kIHN0aWxsIHNhZmVcbiAgICAvLyBzaW5jZSB3ZSBhcmUgZ2VuZXJhdGluZyBhbGwgb2YgdGhlIHZhbHVlcyBiZWluZyBhc3NpZ25lZC5cbiAgICBpZiAoKGN1clZhbHVlIGFzIHN0cmluZ1tdKS5wb3ApIHtcbiAgICAgIChjdXJWYWx1ZSBhcyBzdHJpbmdbXSlbY3VyVmFsdWUhLmxlbmd0aF0gPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tleV0gPSBbY3VyVmFsdWUgYXMgc3RyaW5nLCB2YWx1ZV07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUGFyc2VzIGEgVVJMIHF1ZXJ5IHN0cmluZyBpbnRvIGEgY29sbGVjdGlvbiBvZiBrZXkgYW5kIHZhbHVlIHBhaXJzLlxuICogQHBhcmFtIHN0ciBUaGUgVVJMIHF1ZXJ5IHN0cmluZyB0byBwYXJzZVxuICogQHBhcmFtIHNlcCBUaGUgc3Vic3RyaW5nIHVzZWQgdG8gZGVsaW1pdCBrZXkgYW5kIHZhbHVlIHBhaXJzIGluIHRoZSBxdWVyeSBzdHJpbmcuIERlZmF1bHQ6ICcmJy5cbiAqIEBwYXJhbSBlcSBUaGUgc3Vic3RyaW5nIHVzZWQgdG8gZGVsaW1pdCBrZXlzIGFuZCB2YWx1ZXMgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gRGVmYXVsdDogJz0nLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHBhcnNlIG9wdGlvbnNcbiAqIEBwYXJhbSBvcHRpb25zLmRlY29kZVVSSUNvbXBvbmVudCBUaGUgZnVuY3Rpb24gdG8gdXNlIHdoZW4gZGVjb2RpbmcgcGVyY2VudC1lbmNvZGVkIGNoYXJhY3RlcnMgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gRGVmYXVsdDogYHF1ZXJ5c3RyaW5nLnVuZXNjYXBlKClgLlxuICogQHBhcmFtIG9wdGlvbnMubWF4S2V5cyBTcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGtleXMgdG8gcGFyc2UuIFNwZWNpZnkgYDBgIHRvIHJlbW92ZSBrZXkgY291bnRpbmcgbGltaXRhdGlvbnMuIERlZmF1bHQ6IGAxMDAwYC5cbiAqIEBsZWdhY3lcbiAqIEBzZWUgVGVzdGVkIGluIHRlc3QtcXVlcnlzdHJpbmcuanNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKFxuICBzdHI6IHN0cmluZyxcbiAgc2VwID0gXCImXCIsXG4gIGVxID0gXCI9XCIsXG4gIHsgZGVjb2RlVVJJQ29tcG9uZW50ID0gdW5lc2NhcGUsIG1heEtleXMgPSAxMDAwIH06IFBhcnNlT3B0aW9ucyA9IHt9LFxuKTogUGFyc2VkVXJsUXVlcnkge1xuICBjb25zdCBvYmo6IFBhcnNlZFVybFF1ZXJ5ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICBpZiAodHlwZW9mIHN0ciAhPT0gXCJzdHJpbmdcIiB8fCBzdHIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGNvbnN0IHNlcENvZGVzID0gKCFzZXAgPyBbMzhdIC8qICYgKi8gOiBjaGFyQ29kZXMoU3RyaW5nKHNlcCkpKTtcbiAgY29uc3QgZXFDb2RlcyA9ICghZXEgPyBbNjFdIC8qID0gKi8gOiBjaGFyQ29kZXMoU3RyaW5nKGVxKSkpO1xuICBjb25zdCBzZXBMZW4gPSBzZXBDb2Rlcy5sZW5ndGg7XG4gIGNvbnN0IGVxTGVuID0gZXFDb2Rlcy5sZW5ndGg7XG5cbiAgbGV0IHBhaXJzID0gMTAwMDtcbiAgaWYgKHR5cGVvZiBtYXhLZXlzID09PSBcIm51bWJlclwiKSB7XG4gICAgLy8gLTEgaXMgdXNlZCBpbiBwbGFjZSBvZiBhIHZhbHVlIGxpa2UgSW5maW5pdHkgZm9yIG1lYW5pbmdcbiAgICAvLyBcInVubGltaXRlZCBwYWlyc1wiIGJlY2F1c2Ugb2YgYWRkaXRpb25hbCBjaGVja3MgVjggKGF0IGxlYXN0IGFzIG9mIHY1LjQpXG4gICAgLy8gaGFzIHRvIGRvIHdoZW4gdXNpbmcgdmFyaWFibGVzIHRoYXQgY29udGFpbiB2YWx1ZXMgbGlrZSBJbmZpbml0eS4gU2luY2VcbiAgICAvLyBgcGFpcnNgIGlzIGFsd2F5cyBkZWNyZW1lbnRlZCBhbmQgY2hlY2tlZCBleHBsaWNpdGx5IGZvciAwLCAtMSB3b3Jrc1xuICAgIC8vIGVmZmVjdGl2ZWx5IHRoZSBzYW1lIGFzIEluZmluaXR5LCB3aGlsZSBwcm92aWRpbmcgYSBzaWduaWZpY2FudFxuICAgIC8vIHBlcmZvcm1hbmNlIGJvb3N0LlxuICAgIHBhaXJzID0gbWF4S2V5cyA+IDAgPyBtYXhLZXlzIDogLTE7XG4gIH1cblxuICBsZXQgZGVjb2RlID0gdW5lc2NhcGU7XG4gIGlmIChkZWNvZGVVUklDb21wb25lbnQpIHtcbiAgICBkZWNvZGUgPSBkZWNvZGVVUklDb21wb25lbnQ7XG4gIH1cbiAgY29uc3QgY3VzdG9tRGVjb2RlID0gKGRlY29kZSAhPT0gdW5lc2NhcGUpO1xuXG4gIGxldCBsYXN0UG9zID0gMDtcbiAgbGV0IHNlcElkeCA9IDA7XG4gIGxldCBlcUlkeCA9IDA7XG4gIGxldCBrZXkgPSBcIlwiO1xuICBsZXQgdmFsdWUgPSBcIlwiO1xuICBsZXQga2V5RW5jb2RlZCA9IGN1c3RvbURlY29kZTtcbiAgbGV0IHZhbEVuY29kZWQgPSBjdXN0b21EZWNvZGU7XG4gIGNvbnN0IHBsdXNDaGFyID0gKGN1c3RvbURlY29kZSA/IFwiJTIwXCIgOiBcIiBcIik7XG4gIGxldCBlbmNvZGVDaGVjayA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgY29kZSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXG4gICAgLy8gVHJ5IG1hdGNoaW5nIGtleS92YWx1ZSBwYWlyIHNlcGFyYXRvciAoZS5nLiAnJicpXG4gICAgaWYgKGNvZGUgPT09IHNlcENvZGVzW3NlcElkeF0pIHtcbiAgICAgIGlmICgrK3NlcElkeCA9PT0gc2VwTGVuKSB7XG4gICAgICAgIC8vIEtleS92YWx1ZSBwYWlyIHNlcGFyYXRvciBtYXRjaCFcbiAgICAgICAgY29uc3QgZW5kID0gaSAtIHNlcElkeCArIDE7XG4gICAgICAgIGlmIChlcUlkeCA8IGVxTGVuKSB7XG4gICAgICAgICAgLy8gV2UgZGlkbid0IGZpbmQgdGhlIChlbnRpcmUpIGtleS92YWx1ZSBzZXBhcmF0b3JcbiAgICAgICAgICBpZiAobGFzdFBvcyA8IGVuZCkge1xuICAgICAgICAgICAgLy8gVHJlYXQgdGhlIHN1YnN0cmluZyBhcyBwYXJ0IG9mIHRoZSBrZXkgaW5zdGVhZCBvZiB0aGUgdmFsdWVcbiAgICAgICAgICAgIGtleSArPSBzdHIuc2xpY2UobGFzdFBvcywgZW5kKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGtleS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIFdlIHNhdyBhbiBlbXB0eSBzdWJzdHJpbmcgYmV0d2VlbiBzZXBhcmF0b3JzXG4gICAgICAgICAgICBpZiAoLS1wYWlycyA9PT0gMCkge1xuICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFBvcyA9IGkgKyAxO1xuICAgICAgICAgICAgc2VwSWR4ID0gZXFJZHggPSAwO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGxhc3RQb3MgPCBlbmQpIHtcbiAgICAgICAgICB2YWx1ZSArPSBzdHIuc2xpY2UobGFzdFBvcywgZW5kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFkZEtleVZhbChvYmosIGtleSwgdmFsdWUsIGtleUVuY29kZWQsIHZhbEVuY29kZWQsIGRlY29kZSk7XG5cbiAgICAgICAgaWYgKC0tcGFpcnMgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgICAgIGtleSA9IHZhbHVlID0gXCJcIjtcbiAgICAgICAgZW5jb2RlQ2hlY2sgPSAwO1xuICAgICAgICBsYXN0UG9zID0gaSArIDE7XG4gICAgICAgIHNlcElkeCA9IGVxSWR4ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VwSWR4ID0gMDtcbiAgICAgIC8vIFRyeSBtYXRjaGluZyBrZXkvdmFsdWUgc2VwYXJhdG9yIChlLmcuICc9JykgaWYgd2UgaGF2ZW4ndCBhbHJlYWR5XG4gICAgICBpZiAoZXFJZHggPCBlcUxlbikge1xuICAgICAgICBpZiAoY29kZSA9PT0gZXFDb2Rlc1tlcUlkeF0pIHtcbiAgICAgICAgICBpZiAoKytlcUlkeCA9PT0gZXFMZW4pIHtcbiAgICAgICAgICAgIC8vIEtleS92YWx1ZSBzZXBhcmF0b3IgbWF0Y2ghXG4gICAgICAgICAgICBjb25zdCBlbmQgPSBpIC0gZXFJZHggKyAxO1xuICAgICAgICAgICAgaWYgKGxhc3RQb3MgPCBlbmQpIHtcbiAgICAgICAgICAgICAga2V5ICs9IHN0ci5zbGljZShsYXN0UG9zLCBlbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZW5jb2RlQ2hlY2sgPSAwO1xuICAgICAgICAgICAgbGFzdFBvcyA9IGkgKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlcUlkeCA9IDA7XG4gICAgICAgICAgaWYgKCFrZXlFbmNvZGVkKSB7XG4gICAgICAgICAgICAvLyBUcnkgdG8gbWF0Y2ggYW4gKHZhbGlkKSBlbmNvZGVkIGJ5dGUgb25jZSB0byBtaW5pbWl6ZSB1bm5lY2Vzc2FyeVxuICAgICAgICAgICAgLy8gY2FsbHMgdG8gc3RyaW5nIGRlY29kaW5nIGZ1bmN0aW9uc1xuICAgICAgICAgICAgaWYgKGNvZGUgPT09IDM3IC8qICUgKi8pIHtcbiAgICAgICAgICAgICAgZW5jb2RlQ2hlY2sgPSAxO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZW5jb2RlQ2hlY2sgPiAwKSB7XG4gICAgICAgICAgICAgIGlmIChpc0hleFRhYmxlW2NvZGVdID09PSAxKSB7XG4gICAgICAgICAgICAgICAgaWYgKCsrZW5jb2RlQ2hlY2sgPT09IDMpIHtcbiAgICAgICAgICAgICAgICAgIGtleUVuY29kZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbmNvZGVDaGVjayA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGUgPT09IDQzIC8qICsgKi8pIHtcbiAgICAgICAgICBpZiAobGFzdFBvcyA8IGkpIHtcbiAgICAgICAgICAgIGtleSArPSBzdHIuc2xpY2UobGFzdFBvcywgaSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGtleSArPSBwbHVzQ2hhcjtcbiAgICAgICAgICBsYXN0UG9zID0gaSArIDE7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSA0MyAvKiArICovKSB7XG4gICAgICAgIGlmIChsYXN0UG9zIDwgaSkge1xuICAgICAgICAgIHZhbHVlICs9IHN0ci5zbGljZShsYXN0UG9zLCBpKTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZSArPSBwbHVzQ2hhcjtcbiAgICAgICAgbGFzdFBvcyA9IGkgKyAxO1xuICAgICAgfSBlbHNlIGlmICghdmFsRW5jb2RlZCkge1xuICAgICAgICAvLyBUcnkgdG8gbWF0Y2ggYW4gKHZhbGlkKSBlbmNvZGVkIGJ5dGUgKG9uY2UpIHRvIG1pbmltaXplIHVubmVjZXNzYXJ5XG4gICAgICAgIC8vIGNhbGxzIHRvIHN0cmluZyBkZWNvZGluZyBmdW5jdGlvbnNcbiAgICAgICAgaWYgKGNvZGUgPT09IDM3IC8qICUgKi8pIHtcbiAgICAgICAgICBlbmNvZGVDaGVjayA9IDE7XG4gICAgICAgIH0gZWxzZSBpZiAoZW5jb2RlQ2hlY2sgPiAwKSB7XG4gICAgICAgICAgaWYgKGlzSGV4VGFibGVbY29kZV0gPT09IDEpIHtcbiAgICAgICAgICAgIGlmICgrK2VuY29kZUNoZWNrID09PSAzKSB7XG4gICAgICAgICAgICAgIHZhbEVuY29kZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbmNvZGVDaGVjayA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRGVhbCB3aXRoIGFueSBsZWZ0b3ZlciBrZXkgb3IgdmFsdWUgZGF0YVxuICBpZiAobGFzdFBvcyA8IHN0ci5sZW5ndGgpIHtcbiAgICBpZiAoZXFJZHggPCBlcUxlbikge1xuICAgICAga2V5ICs9IHN0ci5zbGljZShsYXN0UG9zKTtcbiAgICB9IGVsc2UgaWYgKHNlcElkeCA8IHNlcExlbikge1xuICAgICAgdmFsdWUgKz0gc3RyLnNsaWNlKGxhc3RQb3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChlcUlkeCA9PT0gMCAmJiBrZXkubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gV2UgZW5kZWQgb24gYW4gZW1wdHkgc3Vic3RyaW5nXG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGFkZEtleVZhbChvYmosIGtleSwgdmFsdWUsIGtleUVuY29kZWQsIHZhbEVuY29kZWQsIGRlY29kZSk7XG5cbiAgcmV0dXJuIG9iajtcbn1cblxuaW50ZXJmYWNlIFN0cmluZ2lmeU9wdGlvbnMge1xuICAvKiogVGhlIGZ1bmN0aW9uIHRvIHVzZSB3aGVuIGNvbnZlcnRpbmcgVVJMLXVuc2FmZSBjaGFyYWN0ZXJzIHRvIHBlcmNlbnQtZW5jb2RpbmcgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gKi9cbiAgZW5jb2RlVVJJQ29tcG9uZW50OiAoc3RyaW5nOiBzdHJpbmcpID0+IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGVzZSBjaGFyYWN0ZXJzIGRvIG5vdCBuZWVkIGVzY2FwaW5nIHdoZW4gZ2VuZXJhdGluZyBxdWVyeSBzdHJpbmdzOlxuICogISAtIC4gXyB+XG4gKiAnICggKSAqXG4gKiBkaWdpdHNcbiAqIGFscGhhICh1cHBlcmNhc2UpXG4gKiBhbHBoYSAobG93ZXJjYXNlKVxuICovXG4vLyBkZW5vLWZtdC1pZ25vcmVcbmNvbnN0IG5vRXNjYXBlID0gbmV3IEludDhBcnJheShbXG4gIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIC8vIDAgLSAxNVxuICAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAvLyAxNiAtIDMxXG4gIDAsIDEsIDAsIDAsIDAsIDAsIDAsIDEsIDEsIDEsIDEsIDAsIDAsIDEsIDEsIDAsIC8vIDMyIC0gNDdcbiAgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMCwgMCwgMCwgLy8gNDggLSA2M1xuICAwLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAxLCAvLyA2NCAtIDc5XG4gIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDAsIDAsIDAsIDAsIDEsIC8vIDgwIC0gOTVcbiAgMCwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgLy8gOTYgLSAxMTFcbiAgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMSwgMCwgIC8vIDExMiAtIDEyN1xuXSk7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBzdHJpbmdpZnlQcmltaXRpdmUodjogYW55KTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgaWYgKHR5cGVvZiB2ID09PSBcIm51bWJlclwiICYmIGlzRmluaXRlKHYpKSB7XG4gICAgcmV0dXJuIFwiXCIgKyB2O1xuICB9XG4gIGlmICh0eXBlb2YgdiA9PT0gXCJiaWdpbnRcIikge1xuICAgIHJldHVybiBcIlwiICsgdjtcbiAgfVxuICBpZiAodHlwZW9mIHYgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgcmV0dXJuIHYgPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbiAgfVxuICByZXR1cm4gXCJcIjtcbn1cblxuZnVuY3Rpb24gZW5jb2RlU3RyaW5naWZpZWRDdXN0b20oXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHY6IGFueSxcbiAgZW5jb2RlOiAoc3RyaW5nOiBzdHJpbmcpID0+IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIHJldHVybiBlbmNvZGUoc3RyaW5naWZ5UHJpbWl0aXZlKHYpKTtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIGVuY29kZVN0cmluZ2lmaWVkKHY6IGFueSwgZW5jb2RlOiAoc3RyaW5nOiBzdHJpbmcpID0+IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiAodi5sZW5ndGggPyBlbmNvZGUodikgOiBcIlwiKTtcbiAgfVxuICBpZiAodHlwZW9mIHYgPT09IFwibnVtYmVyXCIgJiYgaXNGaW5pdGUodikpIHtcbiAgICAvLyBWYWx1ZXMgPj0gMWUyMSBhdXRvbWF0aWNhbGx5IHN3aXRjaCB0byBzY2llbnRpZmljIG5vdGF0aW9uIHdoaWNoIHJlcXVpcmVzXG4gICAgLy8gZXNjYXBpbmcgZHVlIHRvIHRoZSBpbmNsdXNpb24gb2YgYSAnKycgaW4gdGhlIG91dHB1dFxuICAgIHJldHVybiAoTWF0aC5hYnModikgPCAxZTIxID8gXCJcIiArIHYgOiBlbmNvZGUoXCJcIiArIHYpKTtcbiAgfVxuICBpZiAodHlwZW9mIHYgPT09IFwiYmlnaW50XCIpIHtcbiAgICByZXR1cm4gXCJcIiArIHY7XG4gIH1cbiAgaWYgKHR5cGVvZiB2ID09PSBcImJvb2xlYW5cIikge1xuICAgIHJldHVybiB2ID8gXCJ0cnVlXCIgOiBcImZhbHNlXCI7XG4gIH1cbiAgcmV0dXJuIFwiXCI7XG59XG5cbi8qKlxuICogUHJvZHVjZXMgYSBVUkwgcXVlcnkgc3RyaW5nIGZyb20gYSBnaXZlbiBvYmogYnkgaXRlcmF0aW5nIHRocm91Z2ggdGhlIG9iamVjdCdzIFwib3duIHByb3BlcnRpZXNcIi5cbiAqIEBwYXJhbSBvYmogVGhlIG9iamVjdCB0byBzZXJpYWxpemUgaW50byBhIFVSTCBxdWVyeSBzdHJpbmcuXG4gKiBAcGFyYW0gc2VwIFRoZSBzdWJzdHJpbmcgdXNlZCB0byBkZWxpbWl0IGtleSBhbmQgdmFsdWUgcGFpcnMgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gRGVmYXVsdDogJyYnLlxuICogQHBhcmFtIGVxIFRoZSBzdWJzdHJpbmcgdXNlZCB0byBkZWxpbWl0IGtleXMgYW5kIHZhbHVlcyBpbiB0aGUgcXVlcnkgc3RyaW5nLiBEZWZhdWx0OiAnPScuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgc3RyaW5naWZ5IG9wdGlvbnNcbiAqIEBwYXJhbSBvcHRpb25zLmVuY29kZVVSSUNvbXBvbmVudCBUaGUgZnVuY3Rpb24gdG8gdXNlIHdoZW4gY29udmVydGluZyBVUkwtdW5zYWZlIGNoYXJhY3RlcnMgdG8gcGVyY2VudC1lbmNvZGluZyBpbiB0aGUgcXVlcnkgc3RyaW5nLiBEZWZhdWx0OiBgcXVlcnlzdHJpbmcuZXNjYXBlKClgLlxuICogQGxlZ2FjeVxuICogQHNlZSBUZXN0ZWQgaW4gYHRlc3QtcXVlcnlzdHJpbmcuanNgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnkoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG9iajogUmVjb3JkPHN0cmluZywgYW55PixcbiAgc2VwPzogc3RyaW5nLFxuICBlcT86IHN0cmluZyxcbiAgb3B0aW9ucz86IFN0cmluZ2lmeU9wdGlvbnMsXG4pOiBzdHJpbmcge1xuICBzZXAgfHw9IFwiJlwiO1xuICBlcSB8fD0gXCI9XCI7XG4gIGNvbnN0IGVuY29kZSA9IG9wdGlvbnMgPyBvcHRpb25zLmVuY29kZVVSSUNvbXBvbmVudCA6IHFzRXNjYXBlO1xuICBjb25zdCBjb252ZXJ0ID0gb3B0aW9ucyA/IGVuY29kZVN0cmluZ2lmaWVkQ3VzdG9tIDogZW5jb2RlU3RyaW5naWZpZWQ7XG5cbiAgaWYgKG9iaiAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiKSB7XG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgY29uc3QgbGVuID0ga2V5cy5sZW5ndGg7XG4gICAgbGV0IGZpZWxkcyA9IFwiXCI7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgY29uc3QgayA9IGtleXNbaV07XG4gICAgICBjb25zdCB2ID0gb2JqW2tdO1xuICAgICAgbGV0IGtzID0gY29udmVydChrLCBlbmNvZGUpO1xuICAgICAga3MgKz0gZXE7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHYpKSB7XG4gICAgICAgIGNvbnN0IHZsZW4gPSB2Lmxlbmd0aDtcbiAgICAgICAgaWYgKHZsZW4gPT09IDApIGNvbnRpbnVlO1xuICAgICAgICBpZiAoZmllbGRzKSB7XG4gICAgICAgICAgZmllbGRzICs9IHNlcDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHZsZW47ICsraikge1xuICAgICAgICAgIGlmIChqKSB7XG4gICAgICAgICAgICBmaWVsZHMgKz0gc2VwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmaWVsZHMgKz0ga3M7XG4gICAgICAgICAgZmllbGRzICs9IGNvbnZlcnQodltqXSwgZW5jb2RlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZpZWxkcykge1xuICAgICAgICAgIGZpZWxkcyArPSBzZXA7XG4gICAgICAgIH1cbiAgICAgICAgZmllbGRzICs9IGtzO1xuICAgICAgICBmaWVsZHMgKz0gY29udmVydCh2LCBlbmNvZGUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmllbGRzO1xuICB9XG4gIHJldHVybiBcIlwiO1xufVxuXG4vLyBkZW5vLWZtdC1pZ25vcmVcbmNvbnN0IHVuaGV4VGFibGUgPSBuZXcgSW50OEFycmF5KFtcbiAgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC8vIDAgLSAxNVxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gMTYgLSAzMVxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gMzIgLSA0N1xuICArMCwgKzEsICsyLCArMywgKzQsICs1LCArNiwgKzcsICs4LCArOSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gNDggLSA2M1xuICAtMSwgMTAsIDExLCAxMiwgMTMsIDE0LCAxNSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gNjQgLSA3OVxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gODAgLSA5NVxuICAtMSwgMTAsIDExLCAxMiwgMTMsIDE0LCAxNSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gOTYgLSAxMTFcbiAgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC8vIDExMiAtIDEyN1xuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gMTI4IC4uLlxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSxcbiAgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsXG4gIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLFxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSxcbiAgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsXG4gIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLFxuICAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgLy8gLi4uIDI1NVxuXSk7XG5cbi8qKlxuICogQSBzYWZlIGZhc3QgYWx0ZXJuYXRpdmUgdG8gZGVjb2RlVVJJQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmVzY2FwZUJ1ZmZlcihzOiBzdHJpbmcsIGRlY29kZVNwYWNlcyA9IGZhbHNlKTogQnVmZmVyIHtcbiAgY29uc3Qgb3V0ID0gQnVmZmVyLmFsbG9jKHMubGVuZ3RoKTtcbiAgbGV0IGluZGV4ID0gMDtcbiAgbGV0IG91dEluZGV4ID0gMDtcbiAgbGV0IGN1cnJlbnRDaGFyO1xuICBsZXQgbmV4dENoYXI7XG4gIGxldCBoZXhIaWdoO1xuICBsZXQgaGV4TG93O1xuICBjb25zdCBtYXhMZW5ndGggPSBzLmxlbmd0aCAtIDI7XG4gIC8vIEZsYWcgdG8ga25vdyBpZiBzb21lIGhleCBjaGFycyBoYXZlIGJlZW4gZGVjb2RlZFxuICBsZXQgaGFzSGV4ID0gZmFsc2U7XG4gIHdoaWxlIChpbmRleCA8IHMubGVuZ3RoKSB7XG4gICAgY3VycmVudENoYXIgPSBzLmNoYXJDb2RlQXQoaW5kZXgpO1xuICAgIGlmIChjdXJyZW50Q2hhciA9PT0gNDMgLyogJysnICovICYmIGRlY29kZVNwYWNlcykge1xuICAgICAgb3V0W291dEluZGV4KytdID0gMzI7IC8vICcgJ1xuICAgICAgaW5kZXgrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY3VycmVudENoYXIgPT09IDM3IC8qICclJyAqLyAmJiBpbmRleCA8IG1heExlbmd0aCkge1xuICAgICAgY3VycmVudENoYXIgPSBzLmNoYXJDb2RlQXQoKytpbmRleCk7XG4gICAgICBoZXhIaWdoID0gdW5oZXhUYWJsZVtjdXJyZW50Q2hhcl07XG4gICAgICBpZiAoIShoZXhIaWdoID49IDApKSB7XG4gICAgICAgIG91dFtvdXRJbmRleCsrXSA9IDM3OyAvLyAnJSdcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0Q2hhciA9IHMuY2hhckNvZGVBdCgrK2luZGV4KTtcbiAgICAgICAgaGV4TG93ID0gdW5oZXhUYWJsZVtuZXh0Q2hhcl07XG4gICAgICAgIGlmICghKGhleExvdyA+PSAwKSkge1xuICAgICAgICAgIG91dFtvdXRJbmRleCsrXSA9IDM3OyAvLyAnJSdcbiAgICAgICAgICBpbmRleC0tO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhc0hleCA9IHRydWU7XG4gICAgICAgICAgY3VycmVudENoYXIgPSBoZXhIaWdoICogMTYgKyBoZXhMb3c7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgb3V0W291dEluZGV4KytdID0gY3VycmVudENoYXI7XG4gICAgaW5kZXgrKztcbiAgfVxuICByZXR1cm4gaGFzSGV4ID8gb3V0LnNsaWNlKDAsIG91dEluZGV4KSA6IG91dDtcbn1cblxuZnVuY3Rpb24gcXNVbmVzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocyk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB1bmVzY2FwZUJ1ZmZlcihzKS50b1N0cmluZygpO1xuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgZGVjb2Rpbmcgb2YgVVJMIHBlcmNlbnQtZW5jb2RlZCBjaGFyYWN0ZXJzIG9uIHRoZSBnaXZlbiBgc3RyYC5cbiAqIFVzZWQgYnkgYHF1ZXJ5c3RyaW5nLnBhcnNlKClgIGFuZCBpcyBnZW5lcmFsbHkgbm90IGV4cGVjdGVkIHRvIGJlIHVzZWQgZGlyZWN0bHkuXG4gKiBJdCBpcyBleHBvcnRlZCBwcmltYXJpbHkgdG8gYWxsb3cgYXBwbGljYXRpb24gY29kZSB0byBwcm92aWRlIGEgcmVwbGFjZW1lbnQgZGVjb2RpbmcgaW1wbGVtZW50YXRpb24gaWYgbmVjZXNzYXJ5IGJ5IGFzc2lnbmluZyBgcXVlcnlzdHJpbmcudW5lc2NhcGVgIHRvIGFuIGFsdGVybmF0aXZlIGZ1bmN0aW9uLlxuICogQGxlZ2FjeVxuICogQHNlZSBUZXN0ZWQgaW4gYHRlc3QtcXVlcnlzdHJpbmctZXNjYXBlLmpzYFxuICovXG5leHBvcnQgY29uc3QgdW5lc2NhcGUgPSBxc1VuZXNjYXBlO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHBhcnNlLFxuICBzdHJpbmdpZnksXG4gIGRlY29kZSxcbiAgZW5jb2RlLFxuICB1bmVzY2FwZSxcbiAgZXNjYXBlLFxuICB1bmVzY2FwZUJ1ZmZlcixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFDckMsU0FBUyxTQUFTLEVBQUUsUUFBUSxRQUFRLDRCQUE0QjtBQUVoRTs7O0NBR0MsR0FDRCxPQUFPLE1BQU0sU0FBUyxNQUFNO0FBRTVCOzs7Q0FHQyxHQUNELE9BQU8sTUFBTSxTQUFTLFVBQVU7QUFFaEM7OztDQUdDLEdBQ0QsU0FBUyxTQUFTLEdBQVksRUFBVTtJQUN0QyxJQUFJLE9BQU8sUUFBUSxVQUFVO1FBQzNCLElBQUksT0FBTyxRQUFRLFVBQVU7WUFDM0IsTUFBTSxPQUFPO1FBQ2YsT0FBTztZQUNMLE9BQU87UUFDVCxDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sVUFBVSxLQUFlLFVBQVU7QUFDNUM7QUFFQTs7Ozs7O0NBTUMsR0FDRCxPQUFPLE1BQU0sU0FBUyxTQUFTO0FBeUIvQixrQkFBa0I7QUFDbEIsTUFBTSxhQUFhLElBQUksVUFBVTtJQUMvQjtJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUM3QztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFHO0lBQUc7SUFBRztJQUFH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QUFDO1FBQ0g7UUFDQSxPQUFPO0lBQ1QsQ0FBQztJQUNELE9BQU87QUFDVCxDQUFDO0FBRUQsa0JBQWtCO0FBQ2xCLE1BQU0sYUFBYSxJQUFJLFVBQVU7SUFDL0IsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUM3RCxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQzdELENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFDN0QsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUM3RCxDQUFDO0lBQUc7SUFBSTtJQUFJO0lBQUk7SUFBSTtJQUFJO0lBQUksQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQzdELENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFDN0QsQ0FBQztJQUFHO0lBQUk7SUFBSTtJQUFJO0lBQUk7SUFBSTtJQUFJLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUM3RCxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQzdELENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFDN0QsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUM3RCxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQzdELENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFDN0QsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUM3RCxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQzdELENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFDN0QsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztJQUFHLENBQUM7SUFBRyxDQUFDO0lBQUcsQ0FBQztDQUM5RDtBQUVEOztDQUVDLEdBQ0QsT0FBTyxTQUFTLGVBQWUsQ0FBUyxFQUFFLGVBQWUsS0FBSyxFQUFVO0lBQ3RFLE1BQU0sTUFBTSxPQUFPLEtBQUssQ0FBQyxFQUFFLE1BQU07SUFDakMsSUFBSSxRQUFRO0lBQ1osSUFBSSxXQUFXO0lBQ2YsSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLE1BQU0sWUFBWSxFQUFFLE1BQU0sR0FBRztJQUM3QixtREFBbUQ7SUFDbkQsSUFBSSxTQUFTLEtBQUs7SUFDbEIsTUFBTyxRQUFRLEVBQUUsTUFBTSxDQUFFO1FBQ3ZCLGNBQWMsRUFBRSxVQUFVLENBQUM7UUFDM0IsSUFBSSxnQkFBZ0IsR0FBRyxPQUFPLE9BQU0sY0FBYztZQUNoRCxHQUFHLENBQUMsV0FBVyxHQUFHLElBQUksTUFBTTtZQUM1QjtZQUNBLFFBQVM7UUFDWCxDQUFDO1FBQ0QsSUFBSSxnQkFBZ0IsR0FBRyxPQUFPLE9BQU0sUUFBUSxXQUFXO1lBQ3JELGNBQWMsRUFBRSxVQUFVLENBQUMsRUFBRTtZQUM3QixVQUFVLFVBQVUsQ0FBQyxZQUFZO1lBQ2pDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHO2dCQUNuQixHQUFHLENBQUMsV0FBVyxHQUFHLElBQUksTUFBTTtnQkFDNUIsUUFBUztZQUNYLE9BQU87Z0JBQ0wsV0FBVyxFQUFFLFVBQVUsQ0FBQyxFQUFFO2dCQUMxQixTQUFTLFVBQVUsQ0FBQyxTQUFTO2dCQUM3QixJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRztvQkFDbEIsR0FBRyxDQUFDLFdBQVcsR0FBRyxJQUFJLE1BQU07b0JBQzVCO2dCQUNGLE9BQU87b0JBQ0wsU0FBUyxJQUFJO29CQUNiLGNBQWMsVUFBVSxLQUFLO2dCQUMvQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFDRCxHQUFHLENBQUMsV0FBVyxHQUFHO1FBQ2xCO0lBQ0Y7SUFDQSxPQUFPLFNBQVMsSUFBSSxLQUFLLENBQUMsR0FBRyxZQUFZLEdBQUc7QUFDOUMsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFTLEVBQVU7SUFDckMsSUFBSTtRQUNGLE9BQU8sbUJBQW1CO0lBQzVCLEVBQUUsT0FBTTtRQUNOLE9BQU8sZUFBZSxHQUFHLFFBQVE7SUFDbkM7QUFDRjtBQUVBOzs7Ozs7Q0FNQyxHQUNELE9BQU8sTUFBTSxXQUFXLFdBQVc7QUFFbkMsZUFBZTtJQUNiO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0FBQ0YsRUFBRSJ9