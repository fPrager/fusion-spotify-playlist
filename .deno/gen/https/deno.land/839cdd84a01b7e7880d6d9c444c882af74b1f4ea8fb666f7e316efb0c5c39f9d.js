// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { getCiphers } from "../../_crypto/crypto_browserify/browserify_aes/mod.js";
import { notImplemented } from "../../_utils.ts";
import { Buffer } from "../../buffer.ts";
import { ERR_INVALID_ARG_TYPE, hideStackFrames } from "../errors.ts";
import { isAnyArrayBuffer, isArrayBufferView } from "../util/types.ts";
import { kHandle, kKeyObject } from "./constants.ts";
// TODO(kt3k): Generate this list from `digestAlgorithms`
// of std/crypto/_wasm/mod.ts
const digestAlgorithms = [
    "blake2b256",
    "blake2b384",
    "blake2b",
    "blake2s",
    "blake3",
    "keccak-224",
    "keccak-256",
    "keccak-384",
    "keccak-512",
    "sha384",
    "sha3-224",
    "sha3-256",
    "sha3-384",
    "sha3-512",
    "shake128",
    "shake256",
    "tiger",
    "rmd160",
    "sha224",
    "sha256",
    "sha512",
    "md4",
    "md5",
    "sha1"
];
let defaultEncoding = "buffer";
export function setDefaultEncoding(val) {
    defaultEncoding = val;
}
export function getDefaultEncoding() {
    return defaultEncoding;
}
// This is here because many functions accepted binary strings without
// any explicit encoding in older versions of node, and we don't want
// to break them unnecessarily.
export function toBuf(val, encoding) {
    if (typeof val === "string") {
        if (encoding === "buffer") {
            encoding = "utf8";
        }
        return Buffer.from(val, encoding);
    }
    return val;
}
export const validateByteSource = hideStackFrames((val, name)=>{
    val = toBuf(val);
    if (isAnyArrayBuffer(val) || isArrayBufferView(val)) {
        return;
    }
    throw new ERR_INVALID_ARG_TYPE(name, [
        "string",
        "ArrayBuffer",
        "TypedArray",
        "DataView",
        "Buffer"
    ], val);
});
/**
 * Returns an array of the names of the supported hash algorithms, such as 'sha1'.
 */ export function getHashes() {
    return digestAlgorithms;
}
export function getCurves() {
    notImplemented("crypto.getCurves");
}
export function secureHeapUsed() {
    notImplemented("crypto.secureHeapUsed");
}
export function setEngine(_engine, _flags) {
    notImplemented("crypto.setEngine");
}
export { getCiphers, kHandle, kKeyObject };
export default {
    getDefaultEncoding,
    getHashes,
    setDefaultEncoding,
    getCiphers,
    getCurves,
    secureHeapUsed,
    setEngine,
    validateByteSource,
    toBuf,
    kHandle,
    kKeyObject
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL3V0aWwudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIE5vZGUuanMgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgZ2V0Q2lwaGVycyB9IGZyb20gXCIuLi8uLi9fY3J5cHRvL2NyeXB0b19icm93c2VyaWZ5L2Jyb3dzZXJpZnlfYWVzL21vZC5qc1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vLi4vX3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBFUlJfSU5WQUxJRF9BUkdfVFlQRSwgaGlkZVN0YWNrRnJhbWVzIH0gZnJvbSBcIi4uL2Vycm9ycy50c1wiO1xuaW1wb3J0IHsgaXNBbnlBcnJheUJ1ZmZlciwgaXNBcnJheUJ1ZmZlclZpZXcgfSBmcm9tIFwiLi4vdXRpbC90eXBlcy50c1wiO1xuaW1wb3J0IHsgY3J5cHRvIGFzIGNvbnN0YW50cyB9IGZyb20gXCIuLi8uLi9pbnRlcm5hbF9iaW5kaW5nL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0IHsga0hhbmRsZSwga0tleU9iamVjdCB9IGZyb20gXCIuL2NvbnN0YW50cy50c1wiO1xuXG4vLyBUT0RPKGt0M2spOiBHZW5lcmF0ZSB0aGlzIGxpc3QgZnJvbSBgZGlnZXN0QWxnb3JpdGhtc2Bcbi8vIG9mIHN0ZC9jcnlwdG8vX3dhc20vbW9kLnRzXG5jb25zdCBkaWdlc3RBbGdvcml0aG1zID0gW1xuICBcImJsYWtlMmIyNTZcIixcbiAgXCJibGFrZTJiMzg0XCIsXG4gIFwiYmxha2UyYlwiLFxuICBcImJsYWtlMnNcIixcbiAgXCJibGFrZTNcIixcbiAgXCJrZWNjYWstMjI0XCIsXG4gIFwia2VjY2FrLTI1NlwiLFxuICBcImtlY2Nhay0zODRcIixcbiAgXCJrZWNjYWstNTEyXCIsXG4gIFwic2hhMzg0XCIsXG4gIFwic2hhMy0yMjRcIixcbiAgXCJzaGEzLTI1NlwiLFxuICBcInNoYTMtMzg0XCIsXG4gIFwic2hhMy01MTJcIixcbiAgXCJzaGFrZTEyOFwiLFxuICBcInNoYWtlMjU2XCIsXG4gIFwidGlnZXJcIixcbiAgXCJybWQxNjBcIixcbiAgXCJzaGEyMjRcIixcbiAgXCJzaGEyNTZcIixcbiAgXCJzaGE1MTJcIixcbiAgXCJtZDRcIixcbiAgXCJtZDVcIixcbiAgXCJzaGExXCIsXG5dO1xuXG5sZXQgZGVmYXVsdEVuY29kaW5nID0gXCJidWZmZXJcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHNldERlZmF1bHRFbmNvZGluZyh2YWw6IHN0cmluZykge1xuICBkZWZhdWx0RW5jb2RpbmcgPSB2YWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREZWZhdWx0RW5jb2RpbmcoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGRlZmF1bHRFbmNvZGluZztcbn1cblxuLy8gVGhpcyBpcyBoZXJlIGJlY2F1c2UgbWFueSBmdW5jdGlvbnMgYWNjZXB0ZWQgYmluYXJ5IHN0cmluZ3Mgd2l0aG91dFxuLy8gYW55IGV4cGxpY2l0IGVuY29kaW5nIGluIG9sZGVyIHZlcnNpb25zIG9mIG5vZGUsIGFuZCB3ZSBkb24ndCB3YW50XG4vLyB0byBicmVhayB0aGVtIHVubmVjZXNzYXJpbHkuXG5leHBvcnQgZnVuY3Rpb24gdG9CdWYodmFsOiBzdHJpbmcgfCBCdWZmZXIsIGVuY29kaW5nPzogc3RyaW5nKTogQnVmZmVyIHtcbiAgaWYgKHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoZW5jb2RpbmcgPT09IFwiYnVmZmVyXCIpIHtcbiAgICAgIGVuY29kaW5nID0gXCJ1dGY4XCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpO1xuICB9XG5cbiAgcmV0dXJuIHZhbDtcbn1cblxuZXhwb3J0IGNvbnN0IHZhbGlkYXRlQnl0ZVNvdXJjZSA9IGhpZGVTdGFja0ZyYW1lcygodmFsLCBuYW1lKSA9PiB7XG4gIHZhbCA9IHRvQnVmKHZhbCk7XG5cbiAgaWYgKGlzQW55QXJyYXlCdWZmZXIodmFsKSB8fCBpc0FycmF5QnVmZmVyVmlldyh2YWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFxuICAgIG5hbWUsXG4gICAgW1wic3RyaW5nXCIsIFwiQXJyYXlCdWZmZXJcIiwgXCJUeXBlZEFycmF5XCIsIFwiRGF0YVZpZXdcIiwgXCJCdWZmZXJcIl0sXG4gICAgdmFsLFxuICApO1xufSk7XG5cbi8qKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiB0aGUgbmFtZXMgb2YgdGhlIHN1cHBvcnRlZCBoYXNoIGFsZ29yaXRobXMsIHN1Y2ggYXMgJ3NoYTEnLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SGFzaGVzKCk6IHJlYWRvbmx5IHN0cmluZ1tdIHtcbiAgcmV0dXJuIGRpZ2VzdEFsZ29yaXRobXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJ2ZXMoKTogcmVhZG9ubHkgc3RyaW5nW10ge1xuICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5nZXRDdXJ2ZXNcIik7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJlSGVhcFVzYWdlIHtcbiAgdG90YWw6IG51bWJlcjtcbiAgbWluOiBudW1iZXI7XG4gIHVzZWQ6IG51bWJlcjtcbiAgdXRpbGl6YXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlY3VyZUhlYXBVc2VkKCk6IFNlY3VyZUhlYXBVc2FnZSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLnNlY3VyZUhlYXBVc2VkXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0RW5naW5lKF9lbmdpbmU6IHN0cmluZywgX2ZsYWdzOiB0eXBlb2YgY29uc3RhbnRzKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLnNldEVuZ2luZVwiKTtcbn1cblxuZXhwb3J0IHsgZ2V0Q2lwaGVycywga0hhbmRsZSwga0tleU9iamVjdCB9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGdldERlZmF1bHRFbmNvZGluZyxcbiAgZ2V0SGFzaGVzLFxuICBzZXREZWZhdWx0RW5jb2RpbmcsXG4gIGdldENpcGhlcnMsXG4gIGdldEN1cnZlcyxcbiAgc2VjdXJlSGVhcFVzZWQsXG4gIHNldEVuZ2luZSxcbiAgdmFsaWRhdGVCeXRlU291cmNlLFxuICB0b0J1ZixcbiAga0hhbmRsZSxcbiAga0tleU9iamVjdCxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFGQUFxRjtBQUVyRixTQUFTLFVBQVUsUUFBUSx3REFBd0Q7QUFDbkYsU0FBUyxjQUFjLFFBQVEsa0JBQWtCO0FBQ2pELFNBQVMsTUFBTSxRQUFRLGtCQUFrQjtBQUN6QyxTQUFTLG9CQUFvQixFQUFFLGVBQWUsUUFBUSxlQUFlO0FBQ3JFLFNBQVMsZ0JBQWdCLEVBQUUsaUJBQWlCLFFBQVEsbUJBQW1CO0FBRXZFLFNBQVMsT0FBTyxFQUFFLFVBQVUsUUFBUSxpQkFBaUI7QUFFckQseURBQXlEO0FBQ3pELDZCQUE2QjtBQUM3QixNQUFNLG1CQUFtQjtJQUN2QjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7Q0FDRDtBQUVELElBQUksa0JBQWtCO0FBRXRCLE9BQU8sU0FBUyxtQkFBbUIsR0FBVyxFQUFFO0lBQzlDLGtCQUFrQjtBQUNwQixDQUFDO0FBRUQsT0FBTyxTQUFTLHFCQUE2QjtJQUMzQyxPQUFPO0FBQ1QsQ0FBQztBQUVELHNFQUFzRTtBQUN0RSxxRUFBcUU7QUFDckUsK0JBQStCO0FBQy9CLE9BQU8sU0FBUyxNQUFNLEdBQW9CLEVBQUUsUUFBaUIsRUFBVTtJQUNyRSxJQUFJLE9BQU8sUUFBUSxVQUFVO1FBQzNCLElBQUksYUFBYSxVQUFVO1lBQ3pCLFdBQVc7UUFDYixDQUFDO1FBRUQsT0FBTyxPQUFPLElBQUksQ0FBQyxLQUFLO0lBQzFCLENBQUM7SUFFRCxPQUFPO0FBQ1QsQ0FBQztBQUVELE9BQU8sTUFBTSxxQkFBcUIsZ0JBQWdCLENBQUMsS0FBSyxPQUFTO0lBQy9ELE1BQU0sTUFBTTtJQUVaLElBQUksaUJBQWlCLFFBQVEsa0JBQWtCLE1BQU07UUFDbkQ7SUFDRixDQUFDO0lBRUQsTUFBTSxJQUFJLHFCQUNSLE1BQ0E7UUFBQztRQUFVO1FBQWU7UUFBYztRQUFZO0tBQVMsRUFDN0QsS0FDQTtBQUNKLEdBQUc7QUFFSDs7Q0FFQyxHQUNELE9BQU8sU0FBUyxZQUErQjtJQUM3QyxPQUFPO0FBQ1QsQ0FBQztBQUVELE9BQU8sU0FBUyxZQUErQjtJQUM3QyxlQUFlO0FBQ2pCLENBQUM7QUFTRCxPQUFPLFNBQVMsaUJBQWtDO0lBQ2hELGVBQWU7QUFDakIsQ0FBQztBQUVELE9BQU8sU0FBUyxVQUFVLE9BQWUsRUFBRSxNQUF3QixFQUFFO0lBQ25FLGVBQWU7QUFDakIsQ0FBQztBQUVELFNBQVMsVUFBVSxFQUFFLE9BQU8sRUFBRSxVQUFVLEdBQUc7QUFFM0MsZUFBZTtJQUNiO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7QUFDRixFQUFFIn0=