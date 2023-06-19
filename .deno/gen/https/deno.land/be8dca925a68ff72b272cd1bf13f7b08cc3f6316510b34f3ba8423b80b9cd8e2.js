// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// deno-lint-ignore-file
import { isAnyArrayBuffer, isArrayBufferView, isBigIntObject, isBooleanObject, isBoxedPrimitive, isDate, isFloat32Array, isFloat64Array, isMap, isNativeError, isNumberObject, isRegExp, isSet, isStringObject, isSymbolObject, isTypedArray } from "./types.ts";
import { Buffer } from "../../buffer.ts";
import { getOwnNonIndexProperties, ONLY_ENUMERABLE, SKIP_SYMBOLS } from "../../internal_binding/util.ts";
var valueType;
(function(valueType) {
    valueType[valueType["noIterator"] = 0] = "noIterator";
    valueType[valueType["isArray"] = 1] = "isArray";
    valueType[valueType["isSet"] = 2] = "isSet";
    valueType[valueType["isMap"] = 3] = "isMap";
})(valueType || (valueType = {}));
let memo;
export function isDeepStrictEqual(val1, val2) {
    return innerDeepEqual(val1, val2, true);
}
export function isDeepEqual(val1, val2) {
    return innerDeepEqual(val1, val2, false);
}
function innerDeepEqual(val1, val2, strict, memos = memo) {
    // Basic case covered by Strict Equality Comparison
    if (val1 === val2) {
        if (val1 !== 0) return true;
        return strict ? Object.is(val1, val2) : true;
    }
    if (strict) {
        // Cases where the values are not objects
        // If both values are Not a Number NaN
        if (typeof val1 !== "object") {
            return typeof val1 === "number" && Number.isNaN(val1) && Number.isNaN(val2);
        }
        // If either value is null
        if (typeof val2 !== "object" || val1 === null || val2 === null) {
            return false;
        }
        // If the prototype are not the same
        if (Object.getPrototypeOf(val1) !== Object.getPrototypeOf(val2)) {
            return false;
        }
    } else {
        // Non strict case where values are either null or NaN
        if (val1 === null || typeof val1 !== "object") {
            if (val2 === null || typeof val2 !== "object") {
                return val1 == val2 || Number.isNaN(val1) && Number.isNaN(val2);
            }
            return false;
        }
        if (val2 === null || typeof val2 !== "object") {
            return false;
        }
    }
    const val1Tag = Object.prototype.toString.call(val1);
    const val2Tag = Object.prototype.toString.call(val2);
    // prototype must be Strictly Equal
    if (val1Tag !== val2Tag) {
        return false;
    }
    // handling when values are array
    if (Array.isArray(val1)) {
        // quick rejection cases
        if (!Array.isArray(val2) || val1.length !== val2.length) {
            return false;
        }
        const filter = strict ? ONLY_ENUMERABLE : ONLY_ENUMERABLE | SKIP_SYMBOLS;
        const keys1 = getOwnNonIndexProperties(val1, filter);
        const keys2 = getOwnNonIndexProperties(val2, filter);
        if (keys1.length !== keys2.length) {
            return false;
        }
        return keyCheck(val1, val2, strict, memos, valueType.isArray, keys1);
    } else if (val1Tag === "[object Object]") {
        return keyCheck(val1, val2, strict, memos, valueType.noIterator);
    } else if (val1 instanceof Date) {
        if (!(val2 instanceof Date) || val1.getTime() !== val2.getTime()) {
            return false;
        }
    } else if (val1 instanceof RegExp) {
        if (!(val2 instanceof RegExp) || !areSimilarRegExps(val1, val2)) {
            return false;
        }
    } else if (isNativeError(val1) || val1 instanceof Error) {
        // stack may or may not be same, hence it shouldn't be compared
        if (// How to handle the type errors here
        !isNativeError(val2) && !(val2 instanceof Error) || val1.message !== val2.message || val1.name !== val2.name) {
            return false;
        }
    } else if (isArrayBufferView(val1)) {
        const TypedArrayPrototypeGetSymbolToStringTag = (val)=>Object.getOwnPropertySymbols(val).map((item)=>item.toString()).toString();
        if (isTypedArray(val1) && isTypedArray(val2) && TypedArrayPrototypeGetSymbolToStringTag(val1) !== TypedArrayPrototypeGetSymbolToStringTag(val2)) {
            return false;
        }
        if (!strict && (isFloat32Array(val1) || isFloat64Array(val1))) {
            if (!areSimilarFloatArrays(val1, val2)) {
                return false;
            }
        } else if (!areSimilarTypedArrays(val1, val2)) {
            return false;
        }
        const filter1 = strict ? ONLY_ENUMERABLE : ONLY_ENUMERABLE | SKIP_SYMBOLS;
        const keysVal1 = getOwnNonIndexProperties(val1, filter1);
        const keysVal2 = getOwnNonIndexProperties(val2, filter1);
        if (keysVal1.length !== keysVal2.length) {
            return false;
        }
        return keyCheck(val1, val2, strict, memos, valueType.noIterator, keysVal1);
    } else if (isSet(val1)) {
        if (!isSet(val2) || val1.size !== val2.size) {
            return false;
        }
        return keyCheck(val1, val2, strict, memos, valueType.isSet);
    } else if (isMap(val1)) {
        if (!isMap(val2) || val1.size !== val2.size) {
            return false;
        }
        return keyCheck(val1, val2, strict, memos, valueType.isMap);
    } else if (isAnyArrayBuffer(val1)) {
        if (!isAnyArrayBuffer(val2) || !areEqualArrayBuffers(val1, val2)) {
            return false;
        }
    } else if (isBoxedPrimitive(val1)) {
        if (!isEqualBoxedPrimitive(val1, val2)) {
            return false;
        }
    } else if (Array.isArray(val2) || isArrayBufferView(val2) || isSet(val2) || isMap(val2) || isDate(val2) || isRegExp(val2) || isAnyArrayBuffer(val2) || isBoxedPrimitive(val2) || isNativeError(val2) || val2 instanceof Error) {
        return false;
    }
    return keyCheck(val1, val2, strict, memos, valueType.noIterator);
}
function keyCheck(val1, val2, strict, memos, iterationType, aKeys = []) {
    if (arguments.length === 5) {
        aKeys = Object.keys(val1);
        const bKeys = Object.keys(val2);
        // The pair must have the same number of owned properties.
        if (aKeys.length !== bKeys.length) {
            return false;
        }
    }
    // Cheap key test
    let i = 0;
    for(; i < aKeys.length; i++){
        if (!val2.propertyIsEnumerable(aKeys[i])) {
            return false;
        }
    }
    if (strict && arguments.length === 5) {
        const symbolKeysA = Object.getOwnPropertySymbols(val1);
        if (symbolKeysA.length !== 0) {
            let count = 0;
            for(i = 0; i < symbolKeysA.length; i++){
                const key = symbolKeysA[i];
                if (val1.propertyIsEnumerable(key)) {
                    if (!val2.propertyIsEnumerable(key)) {
                        return false;
                    }
                    // added toString here
                    aKeys.push(key.toString());
                    count++;
                } else if (val2.propertyIsEnumerable(key)) {
                    return false;
                }
            }
            const symbolKeysB = Object.getOwnPropertySymbols(val2);
            if (symbolKeysA.length !== symbolKeysB.length && getEnumerables(val2, symbolKeysB).length !== count) {
                return false;
            }
        } else {
            const symbolKeysB1 = Object.getOwnPropertySymbols(val2);
            if (symbolKeysB1.length !== 0 && getEnumerables(val2, symbolKeysB1).length !== 0) {
                return false;
            }
        }
    }
    if (aKeys.length === 0 && (iterationType === valueType.noIterator || iterationType === valueType.isArray && val1.length === 0 || val1.size === 0)) {
        return true;
    }
    if (memos === undefined) {
        memos = {
            val1: new Map(),
            val2: new Map(),
            position: 0
        };
    } else {
        const val2MemoA = memos.val1.get(val1);
        if (val2MemoA !== undefined) {
            const val2MemoB = memos.val2.get(val2);
            if (val2MemoB !== undefined) {
                return val2MemoA === val2MemoB;
            }
        }
        memos.position++;
    }
    memos.val1.set(val1, memos.position);
    memos.val2.set(val2, memos.position);
    const areEq = objEquiv(val1, val2, strict, aKeys, memos, iterationType);
    memos.val1.delete(val1);
    memos.val2.delete(val2);
    return areEq;
}
function areSimilarRegExps(a, b) {
    return a.source === b.source && a.flags === b.flags && a.lastIndex === b.lastIndex;
}
// TODO(standvpmnt): add type for arguments
function areSimilarFloatArrays(arr1, arr2) {
    if (arr1.byteLength !== arr2.byteLength) {
        return false;
    }
    for(let i = 0; i < arr1.byteLength; i++){
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
// TODO(standvpmnt): add type for arguments
function areSimilarTypedArrays(arr1, arr2) {
    if (arr1.byteLength !== arr2.byteLength) {
        return false;
    }
    return Buffer.compare(new Uint8Array(arr1.buffer, arr1.byteOffset, arr1.byteLength), new Uint8Array(arr2.buffer, arr2.byteOffset, arr2.byteLength)) === 0;
}
// TODO(standvpmnt): add type for arguments
function areEqualArrayBuffers(buf1, buf2) {
    return buf1.byteLength === buf2.byteLength && Buffer.compare(new Uint8Array(buf1), new Uint8Array(buf2)) === 0;
}
// TODO(standvpmnt):  this check of getOwnPropertySymbols and getOwnPropertyNames
// length is sufficient to handle the current test case, however this will fail
// to catch a scenario wherein the getOwnPropertySymbols and getOwnPropertyNames
// length is the same(will be very contrived but a possible shortcoming
function isEqualBoxedPrimitive(a, b) {
    if (Object.getOwnPropertyNames(a).length !== Object.getOwnPropertyNames(b).length) {
        return false;
    }
    if (Object.getOwnPropertySymbols(a).length !== Object.getOwnPropertySymbols(b).length) {
        return false;
    }
    if (isNumberObject(a)) {
        return isNumberObject(b) && Object.is(Number.prototype.valueOf.call(a), Number.prototype.valueOf.call(b));
    }
    if (isStringObject(a)) {
        return isStringObject(b) && String.prototype.valueOf.call(a) === String.prototype.valueOf.call(b);
    }
    if (isBooleanObject(a)) {
        return isBooleanObject(b) && Boolean.prototype.valueOf.call(a) === Boolean.prototype.valueOf.call(b);
    }
    if (isBigIntObject(a)) {
        return isBigIntObject(b) && BigInt.prototype.valueOf.call(a) === BigInt.prototype.valueOf.call(b);
    }
    if (isSymbolObject(a)) {
        return isSymbolObject(b) && Symbol.prototype.valueOf.call(a) === Symbol.prototype.valueOf.call(b);
    }
    // assert.fail(`Unknown boxed type ${val1}`);
    // return false;
    throw Error(`Unknown boxed type`);
}
function getEnumerables(val, keys) {
    return keys.filter((key)=>val.propertyIsEnumerable(key));
}
function objEquiv(obj1, obj2, strict, keys, memos, iterationType) {
    let i = 0;
    if (iterationType === valueType.isSet) {
        if (!setEquiv(obj1, obj2, strict, memos)) {
            return false;
        }
    } else if (iterationType === valueType.isMap) {
        if (!mapEquiv(obj1, obj2, strict, memos)) {
            return false;
        }
    } else if (iterationType === valueType.isArray) {
        for(; i < obj1.length; i++){
            if (obj1.hasOwnProperty(i)) {
                if (!obj2.hasOwnProperty(i) || !innerDeepEqual(obj1[i], obj2[i], strict, memos)) {
                    return false;
                }
            } else if (obj2.hasOwnProperty(i)) {
                return false;
            } else {
                const keys1 = Object.keys(obj1);
                for(; i < keys1.length; i++){
                    const key = keys1[i];
                    if (!obj2.hasOwnProperty(key) || !innerDeepEqual(obj1[key], obj2[key], strict, memos)) {
                        return false;
                    }
                }
                if (keys1.length !== Object.keys(obj2).length) {
                    return false;
                }
                if (keys1.length !== Object.keys(obj2).length) {
                    return false;
                }
                return true;
            }
        }
    }
    // Expensive test
    for(i = 0; i < keys.length; i++){
        const key1 = keys[i];
        if (!innerDeepEqual(obj1[key1], obj2[key1], strict, memos)) {
            return false;
        }
    }
    return true;
}
function findLooseMatchingPrimitives(primitive) {
    switch(typeof primitive){
        case "undefined":
            return null;
        case "object":
            return undefined;
        case "symbol":
            return false;
        case "string":
            primitive = +primitive;
        case "number":
            if (Number.isNaN(primitive)) {
                return false;
            }
    }
    return true;
}
function setMightHaveLoosePrim(set1, set2, primitive) {
    const altValue = findLooseMatchingPrimitives(primitive);
    if (altValue != null) return altValue;
    return set2.has(altValue) && !set1.has(altValue);
}
function setHasEqualElement(set, val1, strict, memos) {
    for (const val2 of set){
        if (innerDeepEqual(val1, val2, strict, memos)) {
            set.delete(val2);
            return true;
        }
    }
    return false;
}
function setEquiv(set1, set2, strict, memos) {
    let set = null;
    for (const item of set1){
        if (typeof item === "object" && item !== null) {
            if (set === null) {
                // What is SafeSet from primordials?
                // set = new SafeSet();
                set = new Set();
            }
            set.add(item);
        } else if (!set2.has(item)) {
            if (strict) return false;
            if (!setMightHaveLoosePrim(set1, set2, item)) {
                return false;
            }
            if (set === null) {
                set = new Set();
            }
            set.add(item);
        }
    }
    if (set !== null) {
        for (const item1 of set2){
            if (typeof item1 === "object" && item1 !== null) {
                if (!setHasEqualElement(set, item1, strict, memos)) return false;
            } else if (!strict && !set1.has(item1) && !setHasEqualElement(set, item1, strict, memos)) {
                return false;
            }
        }
        return set.size === 0;
    }
    return true;
}
// TODO(standvpmnt): add types for argument
function mapMightHaveLoosePrimitive(map1, map2, primitive, item, memos) {
    const altValue = findLooseMatchingPrimitives(primitive);
    if (altValue != null) {
        return altValue;
    }
    const curB = map2.get(altValue);
    if (curB === undefined && !map2.has(altValue) || !innerDeepEqual(item, curB, false, memo)) {
        return false;
    }
    return !map1.has(altValue) && innerDeepEqual(item, curB, false, memos);
}
function mapEquiv(map1, map2, strict, memos) {
    let set = null;
    for (const { 0: key , 1: item1  } of map1){
        if (typeof key === "object" && key !== null) {
            if (set === null) {
                set = new Set();
            }
            set.add(key);
        } else {
            const item2 = map2.get(key);
            if (item2 === undefined && !map2.has(key) || !innerDeepEqual(item1, item2, strict, memos)) {
                if (strict) return false;
                if (!mapMightHaveLoosePrimitive(map1, map2, key, item1, memos)) {
                    return false;
                }
                if (set === null) {
                    set = new Set();
                }
                set.add(key);
            }
        }
    }
    if (set !== null) {
        for (const { 0: key1 , 1: item  } of map2){
            if (typeof key1 === "object" && key1 !== null) {
                if (!mapHasEqualEntry(set, map1, key1, item, strict, memos)) {
                    return false;
                }
            } else if (!strict && (!map1.has(key1) || !innerDeepEqual(map1.get(key1), item, false, memos)) && !mapHasEqualEntry(set, map1, key1, item, false, memos)) {
                return false;
            }
        }
        return set.size === 0;
    }
    return true;
}
function mapHasEqualEntry(set, map, key1, item1, strict, memos) {
    for (const key2 of set){
        if (innerDeepEqual(key1, key2, strict, memos) && innerDeepEqual(item1, map.get(key2), strict, memos)) {
            set.delete(key2);
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvdXRpbC9jb21wYXJpc29ucy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCBhbmQgTm9kZSBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBkZW5vLWxpbnQtaWdub3JlLWZpbGVcbmltcG9ydCB7XG4gIGlzQW55QXJyYXlCdWZmZXIsXG4gIGlzQXJyYXlCdWZmZXJWaWV3LFxuICBpc0JpZ0ludE9iamVjdCxcbiAgaXNCb29sZWFuT2JqZWN0LFxuICBpc0JveGVkUHJpbWl0aXZlLFxuICBpc0RhdGUsXG4gIGlzRmxvYXQzMkFycmF5LFxuICBpc0Zsb2F0NjRBcnJheSxcbiAgaXNNYXAsXG4gIGlzTmF0aXZlRXJyb3IsXG4gIGlzTnVtYmVyT2JqZWN0LFxuICBpc1JlZ0V4cCxcbiAgaXNTZXQsXG4gIGlzU3RyaW5nT2JqZWN0LFxuICBpc1N5bWJvbE9iamVjdCxcbiAgaXNUeXBlZEFycmF5LFxufSBmcm9tIFwiLi90eXBlcy50c1wiO1xuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQge1xuICBnZXRPd25Ob25JbmRleFByb3BlcnRpZXMsXG4gIE9OTFlfRU5VTUVSQUJMRSxcbiAgU0tJUF9TWU1CT0xTLFxufSBmcm9tIFwiLi4vLi4vaW50ZXJuYWxfYmluZGluZy91dGlsLnRzXCI7XG5cbmVudW0gdmFsdWVUeXBlIHtcbiAgbm9JdGVyYXRvcixcbiAgaXNBcnJheSxcbiAgaXNTZXQsXG4gIGlzTWFwLFxufVxuXG5pbnRlcmZhY2UgTWVtbyB7XG4gIHZhbDE6IE1hcDx1bmtub3duLCB1bmtub3duPjtcbiAgdmFsMjogTWFwPHVua25vd24sIHVua25vd24+O1xuICBwb3NpdGlvbjogbnVtYmVyO1xufVxubGV0IG1lbW86IE1lbW87XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RlZXBTdHJpY3RFcXVhbCh2YWwxOiB1bmtub3duLCB2YWwyOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbm5lckRlZXBFcXVhbCh2YWwxLCB2YWwyLCB0cnVlKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc0RlZXBFcXVhbCh2YWwxOiB1bmtub3duLCB2YWwyOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbm5lckRlZXBFcXVhbCh2YWwxLCB2YWwyLCBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGlubmVyRGVlcEVxdWFsKFxuICB2YWwxOiB1bmtub3duLFxuICB2YWwyOiB1bmtub3duLFxuICBzdHJpY3Q6IGJvb2xlYW4sXG4gIG1lbW9zID0gbWVtbyxcbik6IGJvb2xlYW4ge1xuICAvLyBCYXNpYyBjYXNlIGNvdmVyZWQgYnkgU3RyaWN0IEVxdWFsaXR5IENvbXBhcmlzb25cbiAgaWYgKHZhbDEgPT09IHZhbDIpIHtcbiAgICBpZiAodmFsMSAhPT0gMCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHN0cmljdCA/IE9iamVjdC5pcyh2YWwxLCB2YWwyKSA6IHRydWU7XG4gIH1cbiAgaWYgKHN0cmljdCkge1xuICAgIC8vIENhc2VzIHdoZXJlIHRoZSB2YWx1ZXMgYXJlIG5vdCBvYmplY3RzXG4gICAgLy8gSWYgYm90aCB2YWx1ZXMgYXJlIE5vdCBhIE51bWJlciBOYU5cbiAgICBpZiAodHlwZW9mIHZhbDEgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIHR5cGVvZiB2YWwxID09PSBcIm51bWJlclwiICYmIE51bWJlci5pc05hTih2YWwxKSAmJiBOdW1iZXIuaXNOYU4odmFsMilcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIGVpdGhlciB2YWx1ZSBpcyBudWxsXG4gICAgaWYgKHR5cGVvZiB2YWwyICE9PSBcIm9iamVjdFwiIHx8IHZhbDEgPT09IG51bGwgfHwgdmFsMiA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBJZiB0aGUgcHJvdG90eXBlIGFyZSBub3QgdGhlIHNhbWVcbiAgICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbDEpICE9PSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsMikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gTm9uIHN0cmljdCBjYXNlIHdoZXJlIHZhbHVlcyBhcmUgZWl0aGVyIG51bGwgb3IgTmFOXG4gICAgaWYgKHZhbDEgPT09IG51bGwgfHwgdHlwZW9mIHZhbDEgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGlmICh2YWwyID09PSBudWxsIHx8IHR5cGVvZiB2YWwyICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiB2YWwxID09IHZhbDIgfHwgKE51bWJlci5pc05hTih2YWwxKSAmJiBOdW1iZXIuaXNOYU4odmFsMikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodmFsMiA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsMiAhPT0gXCJvYmplY3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHZhbDFUYWcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsMSk7XG4gIGNvbnN0IHZhbDJUYWcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsMik7XG5cbiAgLy8gcHJvdG90eXBlIG11c3QgYmUgU3RyaWN0bHkgRXF1YWxcbiAgaWYgKFxuICAgIHZhbDFUYWcgIT09IHZhbDJUYWdcbiAgKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gaGFuZGxpbmcgd2hlbiB2YWx1ZXMgYXJlIGFycmF5XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbDEpKSB7XG4gICAgLy8gcXVpY2sgcmVqZWN0aW9uIGNhc2VzXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbDIpIHx8IHZhbDEubGVuZ3RoICE9PSB2YWwyLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBmaWx0ZXIgPSBzdHJpY3QgPyBPTkxZX0VOVU1FUkFCTEUgOiBPTkxZX0VOVU1FUkFCTEUgfCBTS0lQX1NZTUJPTFM7XG4gICAgY29uc3Qga2V5czEgPSBnZXRPd25Ob25JbmRleFByb3BlcnRpZXModmFsMSwgZmlsdGVyKTtcbiAgICBjb25zdCBrZXlzMiA9IGdldE93bk5vbkluZGV4UHJvcGVydGllcyh2YWwyLCBmaWx0ZXIpO1xuICAgIGlmIChrZXlzMS5sZW5ndGggIT09IGtleXMyLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4ga2V5Q2hlY2sodmFsMSwgdmFsMiwgc3RyaWN0LCBtZW1vcywgdmFsdWVUeXBlLmlzQXJyYXksIGtleXMxKTtcbiAgfSBlbHNlIGlmICh2YWwxVGFnID09PSBcIltvYmplY3QgT2JqZWN0XVwiKSB7XG4gICAgcmV0dXJuIGtleUNoZWNrKFxuICAgICAgdmFsMSBhcyBvYmplY3QsXG4gICAgICB2YWwyIGFzIG9iamVjdCxcbiAgICAgIHN0cmljdCxcbiAgICAgIG1lbW9zLFxuICAgICAgdmFsdWVUeXBlLm5vSXRlcmF0b3IsXG4gICAgKTtcbiAgfSBlbHNlIGlmICh2YWwxIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIGlmICghKHZhbDIgaW5zdGFuY2VvZiBEYXRlKSB8fCB2YWwxLmdldFRpbWUoKSAhPT0gdmFsMi5nZXRUaW1lKCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsMSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgIGlmICghKHZhbDIgaW5zdGFuY2VvZiBSZWdFeHApIHx8ICFhcmVTaW1pbGFyUmVnRXhwcyh2YWwxLCB2YWwyKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc05hdGl2ZUVycm9yKHZhbDEpIHx8IHZhbDEgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIC8vIHN0YWNrIG1heSBvciBtYXkgbm90IGJlIHNhbWUsIGhlbmNlIGl0IHNob3VsZG4ndCBiZSBjb21wYXJlZFxuICAgIGlmIChcbiAgICAgIC8vIEhvdyB0byBoYW5kbGUgdGhlIHR5cGUgZXJyb3JzIGhlcmVcbiAgICAgICghaXNOYXRpdmVFcnJvcih2YWwyKSAmJiAhKHZhbDIgaW5zdGFuY2VvZiBFcnJvcikpIHx8XG4gICAgICAodmFsMSBhcyBFcnJvcikubWVzc2FnZSAhPT0gKHZhbDIgYXMgRXJyb3IpLm1lc3NhZ2UgfHxcbiAgICAgICh2YWwxIGFzIEVycm9yKS5uYW1lICE9PSAodmFsMiBhcyBFcnJvcikubmFtZVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc0FycmF5QnVmZmVyVmlldyh2YWwxKSkge1xuICAgIGNvbnN0IFR5cGVkQXJyYXlQcm90b3R5cGVHZXRTeW1ib2xUb1N0cmluZ1RhZyA9ICh2YWw6IFtdKSA9PlxuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyh2YWwpXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IGl0ZW0udG9TdHJpbmcoKSlcbiAgICAgICAgLnRvU3RyaW5nKCk7XG4gICAgaWYgKFxuICAgICAgaXNUeXBlZEFycmF5KHZhbDEpICYmXG4gICAgICBpc1R5cGVkQXJyYXkodmFsMikgJiZcbiAgICAgIChUeXBlZEFycmF5UHJvdG90eXBlR2V0U3ltYm9sVG9TdHJpbmdUYWcodmFsMSBhcyBbXSkgIT09XG4gICAgICAgIFR5cGVkQXJyYXlQcm90b3R5cGVHZXRTeW1ib2xUb1N0cmluZ1RhZyh2YWwyIGFzIFtdKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIXN0cmljdCAmJiAoaXNGbG9hdDMyQXJyYXkodmFsMSkgfHwgaXNGbG9hdDY0QXJyYXkodmFsMSkpKSB7XG4gICAgICBpZiAoIWFyZVNpbWlsYXJGbG9hdEFycmF5cyh2YWwxLCB2YWwyKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghYXJlU2ltaWxhclR5cGVkQXJyYXlzKHZhbDEsIHZhbDIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGZpbHRlciA9IHN0cmljdCA/IE9OTFlfRU5VTUVSQUJMRSA6IE9OTFlfRU5VTUVSQUJMRSB8IFNLSVBfU1lNQk9MUztcbiAgICBjb25zdCBrZXlzVmFsMSA9IGdldE93bk5vbkluZGV4UHJvcGVydGllcyh2YWwxIGFzIG9iamVjdCwgZmlsdGVyKTtcbiAgICBjb25zdCBrZXlzVmFsMiA9IGdldE93bk5vbkluZGV4UHJvcGVydGllcyh2YWwyIGFzIG9iamVjdCwgZmlsdGVyKTtcbiAgICBpZiAoa2V5c1ZhbDEubGVuZ3RoICE9PSBrZXlzVmFsMi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIGtleUNoZWNrKFxuICAgICAgdmFsMSBhcyBvYmplY3QsXG4gICAgICB2YWwyIGFzIG9iamVjdCxcbiAgICAgIHN0cmljdCxcbiAgICAgIG1lbW9zLFxuICAgICAgdmFsdWVUeXBlLm5vSXRlcmF0b3IsXG4gICAgICBrZXlzVmFsMSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGlzU2V0KHZhbDEpKSB7XG4gICAgaWYgKFxuICAgICAgIWlzU2V0KHZhbDIpIHx8XG4gICAgICAodmFsMSBhcyBTZXQ8dW5rbm93bj4pLnNpemUgIT09ICh2YWwyIGFzIFNldDx1bmtub3duPikuc2l6ZVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4ga2V5Q2hlY2soXG4gICAgICB2YWwxIGFzIG9iamVjdCxcbiAgICAgIHZhbDIgYXMgb2JqZWN0LFxuICAgICAgc3RyaWN0LFxuICAgICAgbWVtb3MsXG4gICAgICB2YWx1ZVR5cGUuaXNTZXQsXG4gICAgKTtcbiAgfSBlbHNlIGlmIChpc01hcCh2YWwxKSkge1xuICAgIGlmIChcbiAgICAgICFpc01hcCh2YWwyKSB8fFxuICAgICAgKHZhbDEgYXMgU2V0PHVua25vd24+KS5zaXplICE9PSAodmFsMiBhcyBTZXQ8dW5rbm93bj4pLnNpemVcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIGtleUNoZWNrKFxuICAgICAgdmFsMSBhcyBvYmplY3QsXG4gICAgICB2YWwyIGFzIG9iamVjdCxcbiAgICAgIHN0cmljdCxcbiAgICAgIG1lbW9zLFxuICAgICAgdmFsdWVUeXBlLmlzTWFwLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoaXNBbnlBcnJheUJ1ZmZlcih2YWwxKSkge1xuICAgIGlmICghaXNBbnlBcnJheUJ1ZmZlcih2YWwyKSB8fCAhYXJlRXF1YWxBcnJheUJ1ZmZlcnModmFsMSwgdmFsMikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNCb3hlZFByaW1pdGl2ZSh2YWwxKSkge1xuICAgIGlmICghaXNFcXVhbEJveGVkUHJpbWl0aXZlKHZhbDEsIHZhbDIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9IGVsc2UgaWYgKFxuICAgIEFycmF5LmlzQXJyYXkodmFsMikgfHxcbiAgICBpc0FycmF5QnVmZmVyVmlldyh2YWwyKSB8fFxuICAgIGlzU2V0KHZhbDIpIHx8XG4gICAgaXNNYXAodmFsMikgfHxcbiAgICBpc0RhdGUodmFsMikgfHxcbiAgICBpc1JlZ0V4cCh2YWwyKSB8fFxuICAgIGlzQW55QXJyYXlCdWZmZXIodmFsMikgfHxcbiAgICBpc0JveGVkUHJpbWl0aXZlKHZhbDIpIHx8XG4gICAgaXNOYXRpdmVFcnJvcih2YWwyKSB8fFxuICAgIHZhbDIgaW5zdGFuY2VvZiBFcnJvclxuICApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIGtleUNoZWNrKFxuICAgIHZhbDEgYXMgb2JqZWN0LFxuICAgIHZhbDIgYXMgb2JqZWN0LFxuICAgIHN0cmljdCxcbiAgICBtZW1vcyxcbiAgICB2YWx1ZVR5cGUubm9JdGVyYXRvcixcbiAgKTtcbn1cblxuZnVuY3Rpb24ga2V5Q2hlY2soXG4gIHZhbDE6IG9iamVjdCxcbiAgdmFsMjogb2JqZWN0LFxuICBzdHJpY3Q6IGJvb2xlYW4sXG4gIG1lbW9zOiBNZW1vLFxuICBpdGVyYXRpb25UeXBlOiB2YWx1ZVR5cGUsXG4gIGFLZXlzOiAoc3RyaW5nIHwgc3ltYm9sKVtdID0gW10sXG4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDUpIHtcbiAgICBhS2V5cyA9IE9iamVjdC5rZXlzKHZhbDEpO1xuICAgIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXModmFsMik7XG5cbiAgICAvLyBUaGUgcGFpciBtdXN0IGhhdmUgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMuXG4gICAgaWYgKGFLZXlzLmxlbmd0aCAhPT0gYktleXMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hlYXAga2V5IHRlc3RcbiAgbGV0IGkgPSAwO1xuICBmb3IgKDsgaSA8IGFLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCF2YWwyLnByb3BlcnR5SXNFbnVtZXJhYmxlKGFLZXlzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChzdHJpY3QgJiYgYXJndW1lbnRzLmxlbmd0aCA9PT0gNSkge1xuICAgIGNvbnN0IHN5bWJvbEtleXNBID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyh2YWwxKTtcbiAgICBpZiAoc3ltYm9sS2V5c0EubGVuZ3RoICE9PSAwKSB7XG4gICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHN5bWJvbEtleXNBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IHN5bWJvbEtleXNBW2ldO1xuICAgICAgICBpZiAodmFsMS5wcm9wZXJ0eUlzRW51bWVyYWJsZShrZXkpKSB7XG4gICAgICAgICAgaWYgKCF2YWwyLnByb3BlcnR5SXNFbnVtZXJhYmxlKGtleSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gYWRkZWQgdG9TdHJpbmcgaGVyZVxuICAgICAgICAgIGFLZXlzLnB1c2goa2V5LnRvU3RyaW5nKCkpO1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsMi5wcm9wZXJ0eUlzRW51bWVyYWJsZShrZXkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBzeW1ib2xLZXlzQiA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHModmFsMik7XG4gICAgICBpZiAoXG4gICAgICAgIHN5bWJvbEtleXNBLmxlbmd0aCAhPT0gc3ltYm9sS2V5c0IubGVuZ3RoICYmXG4gICAgICAgIGdldEVudW1lcmFibGVzKHZhbDIsIHN5bWJvbEtleXNCKS5sZW5ndGggIT09IGNvdW50XG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzeW1ib2xLZXlzQiA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHModmFsMik7XG4gICAgICBpZiAoXG4gICAgICAgIHN5bWJvbEtleXNCLmxlbmd0aCAhPT0gMCAmJlxuICAgICAgICBnZXRFbnVtZXJhYmxlcyh2YWwyLCBzeW1ib2xLZXlzQikubGVuZ3RoICE9PSAwXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAoXG4gICAgYUtleXMubGVuZ3RoID09PSAwICYmXG4gICAgKGl0ZXJhdGlvblR5cGUgPT09IHZhbHVlVHlwZS5ub0l0ZXJhdG9yIHx8XG4gICAgICAoaXRlcmF0aW9uVHlwZSA9PT0gdmFsdWVUeXBlLmlzQXJyYXkgJiYgKHZhbDEgYXMgW10pLmxlbmd0aCA9PT0gMCkgfHxcbiAgICAgICh2YWwxIGFzIFNldDx1bmtub3duPikuc2l6ZSA9PT0gMClcbiAgKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAobWVtb3MgPT09IHVuZGVmaW5lZCkge1xuICAgIG1lbW9zID0ge1xuICAgICAgdmFsMTogbmV3IE1hcCgpLFxuICAgICAgdmFsMjogbmV3IE1hcCgpLFxuICAgICAgcG9zaXRpb246IDAsXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB2YWwyTWVtb0EgPSBtZW1vcy52YWwxLmdldCh2YWwxKTtcbiAgICBpZiAodmFsMk1lbW9BICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHZhbDJNZW1vQiA9IG1lbW9zLnZhbDIuZ2V0KHZhbDIpO1xuICAgICAgaWYgKHZhbDJNZW1vQiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB2YWwyTWVtb0EgPT09IHZhbDJNZW1vQjtcbiAgICAgIH1cbiAgICB9XG4gICAgbWVtb3MucG9zaXRpb24rKztcbiAgfVxuXG4gIG1lbW9zLnZhbDEuc2V0KHZhbDEsIG1lbW9zLnBvc2l0aW9uKTtcbiAgbWVtb3MudmFsMi5zZXQodmFsMiwgbWVtb3MucG9zaXRpb24pO1xuXG4gIGNvbnN0IGFyZUVxID0gb2JqRXF1aXYodmFsMSwgdmFsMiwgc3RyaWN0LCBhS2V5cywgbWVtb3MsIGl0ZXJhdGlvblR5cGUpO1xuXG4gIG1lbW9zLnZhbDEuZGVsZXRlKHZhbDEpO1xuICBtZW1vcy52YWwyLmRlbGV0ZSh2YWwyKTtcblxuICByZXR1cm4gYXJlRXE7XG59XG5cbmZ1bmN0aW9uIGFyZVNpbWlsYXJSZWdFeHBzKGE6IFJlZ0V4cCwgYjogUmVnRXhwKSB7XG4gIHJldHVybiBhLnNvdXJjZSA9PT0gYi5zb3VyY2UgJiYgYS5mbGFncyA9PT0gYi5mbGFncyAmJlxuICAgIGEubGFzdEluZGV4ID09PSBiLmxhc3RJbmRleDtcbn1cblxuLy8gVE9ETyhzdGFuZHZwbW50KTogYWRkIHR5cGUgZm9yIGFyZ3VtZW50c1xuZnVuY3Rpb24gYXJlU2ltaWxhckZsb2F0QXJyYXlzKGFycjE6IGFueSwgYXJyMjogYW55KTogYm9vbGVhbiB7XG4gIGlmIChhcnIxLmJ5dGVMZW5ndGggIT09IGFycjIuYnl0ZUxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFycjEuYnl0ZUxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGFycjFbaV0gIT09IGFycjJbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIFRPRE8oc3RhbmR2cG1udCk6IGFkZCB0eXBlIGZvciBhcmd1bWVudHNcbmZ1bmN0aW9uIGFyZVNpbWlsYXJUeXBlZEFycmF5cyhhcnIxOiBhbnksIGFycjI6IGFueSk6IGJvb2xlYW4ge1xuICBpZiAoYXJyMS5ieXRlTGVuZ3RoICE9PSBhcnIyLmJ5dGVMZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChcbiAgICBCdWZmZXIuY29tcGFyZShcbiAgICAgIG5ldyBVaW50OEFycmF5KGFycjEuYnVmZmVyLCBhcnIxLmJ5dGVPZmZzZXQsIGFycjEuYnl0ZUxlbmd0aCksXG4gICAgICBuZXcgVWludDhBcnJheShhcnIyLmJ1ZmZlciwgYXJyMi5ieXRlT2Zmc2V0LCBhcnIyLmJ5dGVMZW5ndGgpLFxuICAgICkgPT09IDBcbiAgKTtcbn1cbi8vIFRPRE8oc3RhbmR2cG1udCk6IGFkZCB0eXBlIGZvciBhcmd1bWVudHNcbmZ1bmN0aW9uIGFyZUVxdWFsQXJyYXlCdWZmZXJzKGJ1ZjE6IGFueSwgYnVmMjogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgYnVmMS5ieXRlTGVuZ3RoID09PSBidWYyLmJ5dGVMZW5ndGggJiZcbiAgICBCdWZmZXIuY29tcGFyZShuZXcgVWludDhBcnJheShidWYxKSwgbmV3IFVpbnQ4QXJyYXkoYnVmMikpID09PSAwXG4gICk7XG59XG5cbi8vIFRPRE8oc3RhbmR2cG1udCk6ICB0aGlzIGNoZWNrIG9mIGdldE93blByb3BlcnR5U3ltYm9scyBhbmQgZ2V0T3duUHJvcGVydHlOYW1lc1xuLy8gbGVuZ3RoIGlzIHN1ZmZpY2llbnQgdG8gaGFuZGxlIHRoZSBjdXJyZW50IHRlc3QgY2FzZSwgaG93ZXZlciB0aGlzIHdpbGwgZmFpbFxuLy8gdG8gY2F0Y2ggYSBzY2VuYXJpbyB3aGVyZWluIHRoZSBnZXRPd25Qcm9wZXJ0eVN5bWJvbHMgYW5kIGdldE93blByb3BlcnR5TmFtZXNcbi8vIGxlbmd0aCBpcyB0aGUgc2FtZSh3aWxsIGJlIHZlcnkgY29udHJpdmVkIGJ1dCBhIHBvc3NpYmxlIHNob3J0Y29taW5nXG5mdW5jdGlvbiBpc0VxdWFsQm94ZWRQcmltaXRpdmUoYTogYW55LCBiOiBhbnkpOiBib29sZWFuIHtcbiAgaWYgKFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGEpLmxlbmd0aCAhPT1cbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGIpLmxlbmd0aFxuICApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoYSkubGVuZ3RoICE9PVxuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhiKS5sZW5ndGhcbiAgKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChpc051bWJlck9iamVjdChhKSkge1xuICAgIHJldHVybiAoXG4gICAgICBpc051bWJlck9iamVjdChiKSAmJlxuICAgICAgT2JqZWN0LmlzKFxuICAgICAgICBOdW1iZXIucHJvdG90eXBlLnZhbHVlT2YuY2FsbChhKSxcbiAgICAgICAgTnVtYmVyLnByb3RvdHlwZS52YWx1ZU9mLmNhbGwoYiksXG4gICAgICApXG4gICAgKTtcbiAgfVxuICBpZiAoaXNTdHJpbmdPYmplY3QoYSkpIHtcbiAgICByZXR1cm4gKFxuICAgICAgaXNTdHJpbmdPYmplY3QoYikgJiZcbiAgICAgIChTdHJpbmcucHJvdG90eXBlLnZhbHVlT2YuY2FsbChhKSA9PT0gU3RyaW5nLnByb3RvdHlwZS52YWx1ZU9mLmNhbGwoYikpXG4gICAgKTtcbiAgfVxuICBpZiAoaXNCb29sZWFuT2JqZWN0KGEpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGlzQm9vbGVhbk9iamVjdChiKSAmJlxuICAgICAgKEJvb2xlYW4ucHJvdG90eXBlLnZhbHVlT2YuY2FsbChhKSA9PT0gQm9vbGVhbi5wcm90b3R5cGUudmFsdWVPZi5jYWxsKGIpKVxuICAgICk7XG4gIH1cbiAgaWYgKGlzQmlnSW50T2JqZWN0KGEpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGlzQmlnSW50T2JqZWN0KGIpICYmXG4gICAgICAoQmlnSW50LnByb3RvdHlwZS52YWx1ZU9mLmNhbGwoYSkgPT09IEJpZ0ludC5wcm90b3R5cGUudmFsdWVPZi5jYWxsKGIpKVxuICAgICk7XG4gIH1cbiAgaWYgKGlzU3ltYm9sT2JqZWN0KGEpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGlzU3ltYm9sT2JqZWN0KGIpICYmXG4gICAgICAoU3ltYm9sLnByb3RvdHlwZS52YWx1ZU9mLmNhbGwoYSkgPT09XG4gICAgICAgIFN5bWJvbC5wcm90b3R5cGUudmFsdWVPZi5jYWxsKGIpKVxuICAgICk7XG4gIH1cbiAgLy8gYXNzZXJ0LmZhaWwoYFVua25vd24gYm94ZWQgdHlwZSAke3ZhbDF9YCk7XG4gIC8vIHJldHVybiBmYWxzZTtcbiAgdGhyb3cgRXJyb3IoYFVua25vd24gYm94ZWQgdHlwZWApO1xufVxuXG5mdW5jdGlvbiBnZXRFbnVtZXJhYmxlcyh2YWw6IGFueSwga2V5czogYW55KSB7XG4gIHJldHVybiBrZXlzLmZpbHRlcigoa2V5OiBzdHJpbmcpID0+IHZhbC5wcm9wZXJ0eUlzRW51bWVyYWJsZShrZXkpKTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoXG4gIG9iajE6IGFueSxcbiAgb2JqMjogYW55LFxuICBzdHJpY3Q6IGJvb2xlYW4sXG4gIGtleXM6IGFueSxcbiAgbWVtb3M6IE1lbW8sXG4gIGl0ZXJhdGlvblR5cGU6IHZhbHVlVHlwZSxcbik6IGJvb2xlYW4ge1xuICBsZXQgaSA9IDA7XG5cbiAgaWYgKGl0ZXJhdGlvblR5cGUgPT09IHZhbHVlVHlwZS5pc1NldCkge1xuICAgIGlmICghc2V0RXF1aXYob2JqMSwgb2JqMiwgc3RyaWN0LCBtZW1vcykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXRlcmF0aW9uVHlwZSA9PT0gdmFsdWVUeXBlLmlzTWFwKSB7XG4gICAgaWYgKCFtYXBFcXVpdihvYmoxLCBvYmoyLCBzdHJpY3QsIG1lbW9zKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpdGVyYXRpb25UeXBlID09PSB2YWx1ZVR5cGUuaXNBcnJheSkge1xuICAgIGZvciAoOyBpIDwgb2JqMS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG9iajEuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFvYmoyLmhhc093blByb3BlcnR5KGkpIHx8XG4gICAgICAgICAgIWlubmVyRGVlcEVxdWFsKG9iajFbaV0sIG9iajJbaV0sIHN0cmljdCwgbWVtb3MpXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChvYmoyLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGtleXMxID0gT2JqZWN0LmtleXMob2JqMSk7XG4gICAgICAgIGZvciAoOyBpIDwga2V5czEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBrZXkgPSBrZXlzMVtpXTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhb2JqMi5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8XG4gICAgICAgICAgICAhaW5uZXJEZWVwRXF1YWwob2JqMVtrZXldLCBvYmoyW2tleV0sIHN0cmljdCwgbWVtb3MpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChrZXlzMS5sZW5ndGggIT09IE9iamVjdC5rZXlzKG9iajIpLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5czEubGVuZ3RoICE9PSBPYmplY3Qua2V5cyhvYmoyKS5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRXhwZW5zaXZlIHRlc3RcbiAgZm9yIChpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgIGlmICghaW5uZXJEZWVwRXF1YWwob2JqMVtrZXldLCBvYmoyW2tleV0sIHN0cmljdCwgbWVtb3MpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmaW5kTG9vc2VNYXRjaGluZ1ByaW1pdGl2ZXMoXG4gIHByaW1pdGl2ZTogdW5rbm93bixcbik6IGJvb2xlYW4gfCBudWxsIHwgdW5kZWZpbmVkIHtcbiAgc3dpdGNoICh0eXBlb2YgcHJpbWl0aXZlKSB7XG4gICAgY2FzZSBcInVuZGVmaW5lZFwiOlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBjYXNlIFwic3ltYm9sXCI6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcHJpbWl0aXZlID0gK3ByaW1pdGl2ZTtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICBpZiAoTnVtYmVyLmlzTmFOKHByaW1pdGl2ZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBzZXRNaWdodEhhdmVMb29zZVByaW0oXG4gIHNldDE6IFNldDx1bmtub3duPixcbiAgc2V0MjogU2V0PHVua25vd24+LFxuICBwcmltaXRpdmU6IGFueSxcbikge1xuICBjb25zdCBhbHRWYWx1ZSA9IGZpbmRMb29zZU1hdGNoaW5nUHJpbWl0aXZlcyhwcmltaXRpdmUpO1xuICBpZiAoYWx0VmFsdWUgIT0gbnVsbCkgcmV0dXJuIGFsdFZhbHVlO1xuXG4gIHJldHVybiBzZXQyLmhhcyhhbHRWYWx1ZSkgJiYgIXNldDEuaGFzKGFsdFZhbHVlKTtcbn1cblxuZnVuY3Rpb24gc2V0SGFzRXF1YWxFbGVtZW50KFxuICBzZXQ6IGFueSxcbiAgdmFsMTogYW55LFxuICBzdHJpY3Q6IGJvb2xlYW4sXG4gIG1lbW9zOiBNZW1vLFxuKTogYm9vbGVhbiB7XG4gIGZvciAoY29uc3QgdmFsMiBvZiBzZXQpIHtcbiAgICBpZiAoaW5uZXJEZWVwRXF1YWwodmFsMSwgdmFsMiwgc3RyaWN0LCBtZW1vcykpIHtcbiAgICAgIHNldC5kZWxldGUodmFsMik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHNldEVxdWl2KHNldDE6IGFueSwgc2V0MjogYW55LCBzdHJpY3Q6IGJvb2xlYW4sIG1lbW9zOiBNZW1vKTogYm9vbGVhbiB7XG4gIGxldCBzZXQgPSBudWxsO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2Ygc2V0MSkge1xuICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtICE9PSBudWxsKSB7XG4gICAgICBpZiAoc2V0ID09PSBudWxsKSB7XG4gICAgICAgIC8vIFdoYXQgaXMgU2FmZVNldCBmcm9tIHByaW1vcmRpYWxzP1xuICAgICAgICAvLyBzZXQgPSBuZXcgU2FmZVNldCgpO1xuICAgICAgICBzZXQgPSBuZXcgU2V0KCk7XG4gICAgICB9XG4gICAgICBzZXQuYWRkKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoIXNldDIuaGFzKGl0ZW0pKSB7XG4gICAgICBpZiAoc3RyaWN0KSByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghc2V0TWlnaHRIYXZlTG9vc2VQcmltKHNldDEsIHNldDIsIGl0ZW0pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNldCA9PT0gbnVsbCkge1xuICAgICAgICBzZXQgPSBuZXcgU2V0KCk7XG4gICAgICB9XG4gICAgICBzZXQuYWRkKGl0ZW0pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChzZXQgIT09IG51bGwpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2Ygc2V0Mikge1xuICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSBcIm9iamVjdFwiICYmIGl0ZW0gIT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFzZXRIYXNFcXVhbEVsZW1lbnQoc2V0LCBpdGVtLCBzdHJpY3QsIG1lbW9zKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgIXN0cmljdCAmJlxuICAgICAgICAhc2V0MS5oYXMoaXRlbSkgJiZcbiAgICAgICAgIXNldEhhc0VxdWFsRWxlbWVudChzZXQsIGl0ZW0sIHN0cmljdCwgbWVtb3MpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2V0LnNpemUgPT09IDA7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gVE9ETyhzdGFuZHZwbW50KTogYWRkIHR5cGVzIGZvciBhcmd1bWVudFxuZnVuY3Rpb24gbWFwTWlnaHRIYXZlTG9vc2VQcmltaXRpdmUoXG4gIG1hcDE6IE1hcDx1bmtub3duLCB1bmtub3duPixcbiAgbWFwMjogTWFwPHVua25vd24sIHVua25vd24+LFxuICBwcmltaXRpdmU6IGFueSxcbiAgaXRlbTogYW55LFxuICBtZW1vczogTWVtbyxcbik6IGJvb2xlYW4ge1xuICBjb25zdCBhbHRWYWx1ZSA9IGZpbmRMb29zZU1hdGNoaW5nUHJpbWl0aXZlcyhwcmltaXRpdmUpO1xuICBpZiAoYWx0VmFsdWUgIT0gbnVsbCkge1xuICAgIHJldHVybiBhbHRWYWx1ZTtcbiAgfVxuICBjb25zdCBjdXJCID0gbWFwMi5nZXQoYWx0VmFsdWUpO1xuICBpZiAoXG4gICAgKGN1ckIgPT09IHVuZGVmaW5lZCAmJiAhbWFwMi5oYXMoYWx0VmFsdWUpKSB8fFxuICAgICFpbm5lckRlZXBFcXVhbChpdGVtLCBjdXJCLCBmYWxzZSwgbWVtbylcbiAgKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiAhbWFwMS5oYXMoYWx0VmFsdWUpICYmIGlubmVyRGVlcEVxdWFsKGl0ZW0sIGN1ckIsIGZhbHNlLCBtZW1vcyk7XG59XG5cbmZ1bmN0aW9uIG1hcEVxdWl2KG1hcDE6IGFueSwgbWFwMjogYW55LCBzdHJpY3Q6IGJvb2xlYW4sIG1lbW9zOiBNZW1vKTogYm9vbGVhbiB7XG4gIGxldCBzZXQgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgeyAwOiBrZXksIDE6IGl0ZW0xIH0gb2YgbWFwMSkge1xuICAgIGlmICh0eXBlb2Yga2V5ID09PSBcIm9iamVjdFwiICYmIGtleSAhPT0gbnVsbCkge1xuICAgICAgaWYgKHNldCA9PT0gbnVsbCkge1xuICAgICAgICBzZXQgPSBuZXcgU2V0KCk7XG4gICAgICB9XG4gICAgICBzZXQuYWRkKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGl0ZW0yID0gbWFwMi5nZXQoa2V5KTtcbiAgICAgIGlmIChcbiAgICAgICAgKFxuICAgICAgICAgIChpdGVtMiA9PT0gdW5kZWZpbmVkICYmICFtYXAyLmhhcyhrZXkpKSB8fFxuICAgICAgICAgICFpbm5lckRlZXBFcXVhbChpdGVtMSwgaXRlbTIsIHN0cmljdCwgbWVtb3MpXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICBpZiAoc3RyaWN0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICghbWFwTWlnaHRIYXZlTG9vc2VQcmltaXRpdmUobWFwMSwgbWFwMiwga2V5LCBpdGVtMSwgbWVtb3MpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZXQgPT09IG51bGwpIHtcbiAgICAgICAgICBzZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0LmFkZChrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChzZXQgIT09IG51bGwpIHtcbiAgICBmb3IgKGNvbnN0IHsgMDoga2V5LCAxOiBpdGVtIH0gb2YgbWFwMikge1xuICAgICAgaWYgKHR5cGVvZiBrZXkgPT09IFwib2JqZWN0XCIgJiYga2V5ICE9PSBudWxsKSB7XG4gICAgICAgIGlmICghbWFwSGFzRXF1YWxFbnRyeShzZXQsIG1hcDEsIGtleSwgaXRlbSwgc3RyaWN0LCBtZW1vcykpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICFzdHJpY3QgJiYgKCFtYXAxLmhhcyhrZXkpIHx8XG4gICAgICAgICAgIWlubmVyRGVlcEVxdWFsKG1hcDEuZ2V0KGtleSksIGl0ZW0sIGZhbHNlLCBtZW1vcykpICYmXG4gICAgICAgICFtYXBIYXNFcXVhbEVudHJ5KHNldCwgbWFwMSwga2V5LCBpdGVtLCBmYWxzZSwgbWVtb3MpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2V0LnNpemUgPT09IDA7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gbWFwSGFzRXF1YWxFbnRyeShcbiAgc2V0OiBhbnksXG4gIG1hcDogYW55LFxuICBrZXkxOiBhbnksXG4gIGl0ZW0xOiBhbnksXG4gIHN0cmljdDogYm9vbGVhbixcbiAgbWVtb3M6IE1lbW8sXG4pOiBib29sZWFuIHtcbiAgZm9yIChjb25zdCBrZXkyIG9mIHNldCkge1xuICAgIGlmIChcbiAgICAgIGlubmVyRGVlcEVxdWFsKGtleTEsIGtleTIsIHN0cmljdCwgbWVtb3MpICYmXG4gICAgICBpbm5lckRlZXBFcXVhbChpdGVtMSwgbWFwLmdldChrZXkyKSwgc3RyaWN0LCBtZW1vcylcbiAgICApIHtcbiAgICAgIHNldC5kZWxldGUoa2V5Mik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSw0RUFBNEU7QUFFNUUsd0JBQXdCO0FBQ3hCLFNBQ0UsZ0JBQWdCLEVBQ2hCLGlCQUFpQixFQUNqQixjQUFjLEVBQ2QsZUFBZSxFQUNmLGdCQUFnQixFQUNoQixNQUFNLEVBQ04sY0FBYyxFQUNkLGNBQWMsRUFDZCxLQUFLLEVBQ0wsYUFBYSxFQUNiLGNBQWMsRUFDZCxRQUFRLEVBQ1IsS0FBSyxFQUNMLGNBQWMsRUFDZCxjQUFjLEVBQ2QsWUFBWSxRQUNQLGFBQWE7QUFFcEIsU0FBUyxNQUFNLFFBQVEsa0JBQWtCO0FBQ3pDLFNBQ0Usd0JBQXdCLEVBQ3hCLGVBQWUsRUFDZixZQUFZLFFBQ1AsaUNBQWlDO0lBRXhDO1VBQUssU0FBUztJQUFULFVBQUEsVUFDSCxnQkFBQSxLQUFBO0lBREcsVUFBQSxVQUVILGFBQUEsS0FBQTtJQUZHLFVBQUEsVUFHSCxXQUFBLEtBQUE7SUFIRyxVQUFBLFVBSUgsV0FBQSxLQUFBO0dBSkcsY0FBQTtBQVlMLElBQUk7QUFFSixPQUFPLFNBQVMsa0JBQWtCLElBQWEsRUFBRSxJQUFhLEVBQVc7SUFDdkUsT0FBTyxlQUFlLE1BQU0sTUFBTSxJQUFJO0FBQ3hDLENB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