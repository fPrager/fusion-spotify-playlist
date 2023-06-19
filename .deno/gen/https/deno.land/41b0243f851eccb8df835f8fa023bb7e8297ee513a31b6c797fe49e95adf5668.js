// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { instantiateWasm } from "../../../crypto/_wasm/mod.ts";
import { Buffer } from "../../buffer.ts";
import { Transform } from "../../stream.ts";
import { encode as encodeToHex } from "../../../encoding/hex.ts";
import { encode as encodeToBase64 } from "../../../encoding/base64.ts";
import { encode as encodeToBase64Url } from "../../../encoding/base64url.ts";
import { validateString } from "../validators.mjs";
import { KeyObject, prepareSecretKey } from "./keys.ts";
import { notImplemented } from "../../_utils.ts";
const coerceToBytes = (data)=>{
    if (data instanceof Uint8Array) {
        return data;
    } else if (typeof data === "string") {
        // This assumes UTF-8, which may not be correct.
        return new TextEncoder().encode(data);
    } else if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    } else {
        throw new TypeError("expected data to be string | BufferSource");
    }
};
/**
 * The Hash class is a utility for creating hash digests of data. It can be used in one of two ways:
 *
 * - As a stream that is both readable and writable, where data is written to produce a computed hash digest on the readable side, or
 * - Using the hash.update() and hash.digest() methods to produce the computed hash.
 *
 * The crypto.createHash() method is used to create Hash instances. Hash objects are not to be created directly using the new keyword.
 */ export class Hash extends Transform {
    #context;
    constructor(algorithm, _opts){
        super({
            transform (chunk, _encoding, callback) {
                context.update(coerceToBytes(chunk));
                callback();
            },
            flush (callback) {
                this.push(context.digest(undefined));
                callback();
            }
        });
        if (typeof algorithm === "string") {
            // Node/OpenSSL and WebCrypto format some digest names differently;
            // we attempt to handle those here.
            algorithm = algorithm.toUpperCase();
            if (opensslToWebCryptoDigestNames[algorithm]) {
                algorithm = opensslToWebCryptoDigestNames[algorithm];
            }
            this.#context = new (instantiateWasm()).DigestContext(algorithm);
        } else {
            this.#context = algorithm;
        }
        const context = this.#context;
    }
    copy() {
        return new Hash(this.#context.clone());
    }
    /**
   * Updates the hash content with the given data.
   */ update(data, _encoding) {
        let bytes;
        if (typeof data === "string") {
            data = new TextEncoder().encode(data);
            bytes = coerceToBytes(data);
        } else {
            bytes = coerceToBytes(data);
        }
        this.#context.update(bytes);
        return this;
    }
    /**
   * Calculates the digest of all of the data.
   *
   * If encoding is provided a string will be returned; otherwise a Buffer is returned.
   *
   * Supported encodings are currently 'hex', 'binary', 'base64', 'base64url'.
   */ digest(encoding) {
        const digest = this.#context.digest(undefined);
        if (encoding === undefined) {
            return Buffer.from(digest);
        }
        switch(encoding){
            case "hex":
                return new TextDecoder().decode(encodeToHex(new Uint8Array(digest)));
            case "binary":
                return String.fromCharCode(...digest);
            case "base64":
                return encodeToBase64(digest);
            case "base64url":
                return encodeToBase64Url(digest);
            case "buffer":
                return Buffer.from(digest);
            default:
                return Buffer.from(digest).toString(encoding);
        }
    }
}
export function Hmac(hmac, key, options) {
    return new HmacImpl(hmac, key, options);
}
class HmacImpl extends Transform {
    #ipad;
    #opad;
    #ZEROES = Buffer.alloc(128);
    #algorithm;
    #hash;
    constructor(hmac, key, options){
        super({
            transform (chunk, encoding, callback) {
                // deno-lint-ignore no-explicit-any
                self.update(coerceToBytes(chunk), encoding);
                callback();
            },
            flush (callback) {
                this.push(self.digest());
                callback();
            }
        });
        // deno-lint-ignore no-this-alias
        const self = this;
        if (key instanceof KeyObject) {
            notImplemented("Hmac: KeyObject key is not implemented");
        }
        validateString(hmac, "hmac");
        const u8Key = prepareSecretKey(key, options?.encoding);
        const alg = hmac.toLowerCase();
        this.#hash = new Hash(alg, options);
        this.#algorithm = alg;
        const blockSize = alg === "sha512" || alg === "sha384" ? 128 : 64;
        const keySize = u8Key.length;
        let bufKey;
        if (keySize > blockSize) {
            bufKey = this.#hash.update(u8Key).digest();
        } else {
            bufKey = Buffer.concat([
                u8Key,
                this.#ZEROES
            ], blockSize);
        }
        this.#ipad = Buffer.allocUnsafe(blockSize);
        this.#opad = Buffer.allocUnsafe(blockSize);
        for(let i = 0; i < blockSize; i++){
            this.#ipad[i] = bufKey[i] ^ 0x36;
            this.#opad[i] = bufKey[i] ^ 0x5C;
        }
        this.#hash = new Hash(alg);
        this.#hash.update(this.#ipad);
    }
    digest(encoding) {
        const result = this.#hash.digest();
        return new Hash(this.#algorithm).update(this.#opad).update(result).digest(encoding);
    }
    update(data, inputEncoding) {
        this.#hash.update(data, inputEncoding);
        return this;
    }
}
Hmac.prototype = HmacImpl.prototype;
/**
 * Supported digest names that OpenSSL/Node and WebCrypto identify differently.
 */ const opensslToWebCryptoDigestNames = {
    BLAKE2B256: "BLAKE2B-256",
    BLAKE2B384: "BLAKE2B-384",
    BLAKE2B512: "BLAKE2B",
    BLAKE2S256: "BLAKE2S",
    RIPEMD160: "RIPEMD-160",
    RMD160: "RIPEMD-160",
    SHA1: "SHA-1",
    SHA224: "SHA-224",
    SHA256: "SHA-256",
    SHA384: "SHA-384",
    SHA512: "SHA-512"
};
/**
 * Creates and returns a Hash object that can be used to generate hash digests
 * using the given `algorithm`. Optional `options` argument controls stream behavior.
 */ export function createHash(algorithm, opts) {
    return new Hash(algorithm, opts);
}
export default {
    Hash,
    Hmac,
    createHash
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL2hhc2gudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIE5vZGUuanMgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHtcbiAgRGlnZXN0QWxnb3JpdGhtLFxuICBEaWdlc3RDb250ZXh0LFxuICBpbnN0YW50aWF0ZVdhc20sXG59IGZyb20gXCIuLi8uLi8uLi9jcnlwdG8vX3dhc20vbW9kLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBUcmFuc2Zvcm0gfSBmcm9tIFwiLi4vLi4vc3RyZWFtLnRzXCI7XG5pbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlVG9IZXggfSBmcm9tIFwiLi4vLi4vLi4vZW5jb2RpbmcvaGV4LnRzXCI7XG5pbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlVG9CYXNlNjQgfSBmcm9tIFwiLi4vLi4vLi4vZW5jb2RpbmcvYmFzZTY0LnRzXCI7XG5pbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlVG9CYXNlNjRVcmwgfSBmcm9tIFwiLi4vLi4vLi4vZW5jb2RpbmcvYmFzZTY0dXJsLnRzXCI7XG5pbXBvcnQgdHlwZSB7IFRyYW5zZm9ybU9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vX3N0cmVhbS5kLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZVN0cmluZyB9IGZyb20gXCIuLi92YWxpZGF0b3JzLm1qc1wiO1xuaW1wb3J0IHR5cGUgeyBCaW5hcnlUb1RleHRFbmNvZGluZywgRW5jb2RpbmcgfSBmcm9tIFwiLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgS2V5T2JqZWN0LCBwcmVwYXJlU2VjcmV0S2V5IH0gZnJvbSBcIi4va2V5cy50c1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vLi4vX3V0aWxzLnRzXCI7XG5cbmNvbnN0IGNvZXJjZVRvQnl0ZXMgPSAoZGF0YTogc3RyaW5nIHwgQnVmZmVyU291cmNlKTogVWludDhBcnJheSA9PiB7XG4gIGlmIChkYXRhIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIHJldHVybiBkYXRhO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gVGhpcyBhc3N1bWVzIFVURi04LCB3aGljaCBtYXkgbm90IGJlIGNvcnJlY3QuXG4gICAgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShkYXRhKTtcbiAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoZGF0YSkpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCwgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImV4cGVjdGVkIGRhdGEgdG8gYmUgc3RyaW5nIHwgQnVmZmVyU291cmNlXCIpO1xuICB9XG59O1xuXG4vKipcbiAqIFRoZSBIYXNoIGNsYXNzIGlzIGEgdXRpbGl0eSBmb3IgY3JlYXRpbmcgaGFzaCBkaWdlc3RzIG9mIGRhdGEuIEl0IGNhbiBiZSB1c2VkIGluIG9uZSBvZiB0d28gd2F5czpcbiAqXG4gKiAtIEFzIGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUsIHdoZXJlIGRhdGEgaXMgd3JpdHRlbiB0byBwcm9kdWNlIGEgY29tcHV0ZWQgaGFzaCBkaWdlc3Qgb24gdGhlIHJlYWRhYmxlIHNpZGUsIG9yXG4gKiAtIFVzaW5nIHRoZSBoYXNoLnVwZGF0ZSgpIGFuZCBoYXNoLmRpZ2VzdCgpIG1ldGhvZHMgdG8gcHJvZHVjZSB0aGUgY29tcHV0ZWQgaGFzaC5cbiAqXG4gKiBUaGUgY3J5cHRvLmNyZWF0ZUhhc2goKSBtZXRob2QgaXMgdXNlZCB0byBjcmVhdGUgSGFzaCBpbnN0YW5jZXMuIEhhc2ggb2JqZWN0cyBhcmUgbm90IHRvIGJlIGNyZWF0ZWQgZGlyZWN0bHkgdXNpbmcgdGhlIG5ldyBrZXl3b3JkLlxuICovXG5leHBvcnQgY2xhc3MgSGFzaCBleHRlbmRzIFRyYW5zZm9ybSB7XG4gICNjb250ZXh0OiBEaWdlc3RDb250ZXh0O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFsZ29yaXRobTogc3RyaW5nIHwgRGlnZXN0Q29udGV4dCxcbiAgICBfb3B0cz86IFRyYW5zZm9ybU9wdGlvbnMsXG4gICkge1xuICAgIHN1cGVyKHtcbiAgICAgIHRyYW5zZm9ybShjaHVuazogc3RyaW5nLCBfZW5jb2Rpbmc6IHN0cmluZywgY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICAgICAgY29udGV4dC51cGRhdGUoY29lcmNlVG9CeXRlcyhjaHVuaykpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSxcbiAgICAgIGZsdXNoKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMucHVzaChjb250ZXh0LmRpZ2VzdCh1bmRlZmluZWQpKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAodHlwZW9mIGFsZ29yaXRobSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgLy8gTm9kZS9PcGVuU1NMIGFuZCBXZWJDcnlwdG8gZm9ybWF0IHNvbWUgZGlnZXN0IG5hbWVzIGRpZmZlcmVudGx5O1xuICAgICAgLy8gd2UgYXR0ZW1wdCB0byBoYW5kbGUgdGhvc2UgaGVyZS5cbiAgICAgIGFsZ29yaXRobSA9IGFsZ29yaXRobS50b1VwcGVyQ2FzZSgpO1xuICAgICAgaWYgKG9wZW5zc2xUb1dlYkNyeXB0b0RpZ2VzdE5hbWVzW2FsZ29yaXRobV0pIHtcbiAgICAgICAgYWxnb3JpdGhtID0gb3BlbnNzbFRvV2ViQ3J5cHRvRGlnZXN0TmFtZXNbYWxnb3JpdGhtXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuI2NvbnRleHQgPSBuZXcgKGluc3RhbnRpYXRlV2FzbSgpLkRpZ2VzdENvbnRleHQpKFxuICAgICAgICBhbGdvcml0aG0gYXMgRGlnZXN0QWxnb3JpdGhtLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jY29udGV4dCA9IGFsZ29yaXRobTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy4jY29udGV4dDtcbiAgfVxuXG4gIGNvcHkoKTogSGFzaCB7XG4gICAgcmV0dXJuIG5ldyBIYXNoKHRoaXMuI2NvbnRleHQuY2xvbmUoKSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgaGFzaCBjb250ZW50IHdpdGggdGhlIGdpdmVuIGRhdGEuXG4gICAqL1xuICB1cGRhdGUoZGF0YTogc3RyaW5nIHwgQXJyYXlCdWZmZXIsIF9lbmNvZGluZz86IHN0cmluZyk6IHRoaXMge1xuICAgIGxldCBieXRlcztcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGRhdGEgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoZGF0YSk7XG4gICAgICBieXRlcyA9IGNvZXJjZVRvQnl0ZXMoZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ5dGVzID0gY29lcmNlVG9CeXRlcyhkYXRhKTtcbiAgICB9XG5cbiAgICB0aGlzLiNjb250ZXh0LnVwZGF0ZShieXRlcyk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGVzIHRoZSBkaWdlc3Qgb2YgYWxsIG9mIHRoZSBkYXRhLlxuICAgKlxuICAgKiBJZiBlbmNvZGluZyBpcyBwcm92aWRlZCBhIHN0cmluZyB3aWxsIGJlIHJldHVybmVkOyBvdGhlcndpc2UgYSBCdWZmZXIgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIFN1cHBvcnRlZCBlbmNvZGluZ3MgYXJlIGN1cnJlbnRseSAnaGV4JywgJ2JpbmFyeScsICdiYXNlNjQnLCAnYmFzZTY0dXJsJy5cbiAgICovXG4gIGRpZ2VzdChlbmNvZGluZz86IHN0cmluZyk6IEJ1ZmZlciB8IHN0cmluZyB7XG4gICAgY29uc3QgZGlnZXN0ID0gdGhpcy4jY29udGV4dC5kaWdlc3QodW5kZWZpbmVkKTtcbiAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGRpZ2VzdCk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSBcImhleFwiOlxuICAgICAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGVuY29kZVRvSGV4KG5ldyBVaW50OEFycmF5KGRpZ2VzdCkpKTtcbiAgICAgIGNhc2UgXCJiaW5hcnlcIjpcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoLi4uZGlnZXN0KTtcbiAgICAgIGNhc2UgXCJiYXNlNjRcIjpcbiAgICAgICAgcmV0dXJuIGVuY29kZVRvQmFzZTY0KGRpZ2VzdCk7XG4gICAgICBjYXNlIFwiYmFzZTY0dXJsXCI6XG4gICAgICAgIHJldHVybiBlbmNvZGVUb0Jhc2U2NFVybChkaWdlc3QpO1xuICAgICAgY2FzZSBcImJ1ZmZlclwiOlxuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20oZGlnZXN0KTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShkaWdlc3QpLnRvU3RyaW5nKGVuY29kaW5nKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEhtYWMoXG4gIGhtYWM6IHN0cmluZyxcbiAga2V5OiBzdHJpbmcgfCBBcnJheUJ1ZmZlciB8IEtleU9iamVjdCxcbiAgb3B0aW9ucz86IFRyYW5zZm9ybU9wdGlvbnMsXG4pOiBIbWFjIHtcbiAgcmV0dXJuIG5ldyBIbWFjSW1wbChobWFjLCBrZXksIG9wdGlvbnMpO1xufVxuXG50eXBlIEhtYWMgPSBIbWFjSW1wbDtcblxuY2xhc3MgSG1hY0ltcGwgZXh0ZW5kcyBUcmFuc2Zvcm0ge1xuICAjaXBhZDogVWludDhBcnJheTtcbiAgI29wYWQ6IFVpbnQ4QXJyYXk7XG4gICNaRVJPRVMgPSBCdWZmZXIuYWxsb2MoMTI4KTtcbiAgI2FsZ29yaXRobTogc3RyaW5nO1xuICAjaGFzaDogSGFzaDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBobWFjOiBzdHJpbmcsXG4gICAga2V5OiBzdHJpbmcgfCBBcnJheUJ1ZmZlciB8IEtleU9iamVjdCxcbiAgICBvcHRpb25zPzogVHJhbnNmb3JtT3B0aW9ucyxcbiAgKSB7XG4gICAgc3VwZXIoe1xuICAgICAgdHJhbnNmb3JtKGNodW5rOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICAgIHNlbGYudXBkYXRlKGNvZXJjZVRvQnl0ZXMoY2h1bmspLCBlbmNvZGluZyBhcyBhbnkpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSxcbiAgICAgIGZsdXNoKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMucHVzaChzZWxmLmRpZ2VzdCgpKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby10aGlzLWFsaWFzXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGtleSBpbnN0YW5jZW9mIEtleU9iamVjdCkge1xuICAgICAgbm90SW1wbGVtZW50ZWQoXCJIbWFjOiBLZXlPYmplY3Qga2V5IGlzIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICB2YWxpZGF0ZVN0cmluZyhobWFjLCBcImhtYWNcIik7XG4gICAgY29uc3QgdThLZXkgPSBwcmVwYXJlU2VjcmV0S2V5KGtleSwgb3B0aW9ucz8uZW5jb2RpbmcpIGFzIEJ1ZmZlcjtcblxuICAgIGNvbnN0IGFsZyA9IGhtYWMudG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLiNoYXNoID0gbmV3IEhhc2goYWxnLCBvcHRpb25zKTtcbiAgICB0aGlzLiNhbGdvcml0aG0gPSBhbGc7XG4gICAgY29uc3QgYmxvY2tTaXplID0gKGFsZyA9PT0gXCJzaGE1MTJcIiB8fCBhbGcgPT09IFwic2hhMzg0XCIpID8gMTI4IDogNjQ7XG4gICAgY29uc3Qga2V5U2l6ZSA9IHU4S2V5Lmxlbmd0aDtcblxuICAgIGxldCBidWZLZXk6IEJ1ZmZlcjtcblxuICAgIGlmIChrZXlTaXplID4gYmxvY2tTaXplKSB7XG4gICAgICBidWZLZXkgPSB0aGlzLiNoYXNoLnVwZGF0ZSh1OEtleSkuZGlnZXN0KCkgYXMgQnVmZmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZLZXkgPSBCdWZmZXIuY29uY2F0KFt1OEtleSwgdGhpcy4jWkVST0VTXSwgYmxvY2tTaXplKTtcbiAgICB9XG5cbiAgICB0aGlzLiNpcGFkID0gQnVmZmVyLmFsbG9jVW5zYWZlKGJsb2NrU2l6ZSk7XG4gICAgdGhpcy4jb3BhZCA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShibG9ja1NpemUpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBibG9ja1NpemU7IGkrKykge1xuICAgICAgdGhpcy4jaXBhZFtpXSA9IGJ1ZktleVtpXSBeIDB4MzY7XG4gICAgICB0aGlzLiNvcGFkW2ldID0gYnVmS2V5W2ldIF4gMHg1QztcbiAgICB9XG5cbiAgICB0aGlzLiNoYXNoID0gbmV3IEhhc2goYWxnKTtcbiAgICB0aGlzLiNoYXNoLnVwZGF0ZSh0aGlzLiNpcGFkKTtcbiAgfVxuXG4gIGRpZ2VzdCgpOiBCdWZmZXI7XG4gIGRpZ2VzdChlbmNvZGluZzogQmluYXJ5VG9UZXh0RW5jb2RpbmcpOiBzdHJpbmc7XG4gIGRpZ2VzdChlbmNvZGluZz86IEJpbmFyeVRvVGV4dEVuY29kaW5nKTogQnVmZmVyIHwgc3RyaW5nIHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLiNoYXNoLmRpZ2VzdCgpO1xuXG4gICAgcmV0dXJuIG5ldyBIYXNoKHRoaXMuI2FsZ29yaXRobSkudXBkYXRlKHRoaXMuI29wYWQpLnVwZGF0ZShyZXN1bHQpLmRpZ2VzdChcbiAgICAgIGVuY29kaW5nLFxuICAgICk7XG4gIH1cblxuICB1cGRhdGUoZGF0YTogc3RyaW5nIHwgQXJyYXlCdWZmZXIsIGlucHV0RW5jb2Rpbmc/OiBFbmNvZGluZyk6IHRoaXMge1xuICAgIHRoaXMuI2hhc2gudXBkYXRlKGRhdGEsIGlucHV0RW5jb2RpbmcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59XG5cbkhtYWMucHJvdG90eXBlID0gSG1hY0ltcGwucHJvdG90eXBlO1xuXG4vKipcbiAqIFN1cHBvcnRlZCBkaWdlc3QgbmFtZXMgdGhhdCBPcGVuU1NML05vZGUgYW5kIFdlYkNyeXB0byBpZGVudGlmeSBkaWZmZXJlbnRseS5cbiAqL1xuY29uc3Qgb3BlbnNzbFRvV2ViQ3J5cHRvRGlnZXN0TmFtZXM6IFJlY29yZDxzdHJpbmcsIERpZ2VzdEFsZ29yaXRobT4gPSB7XG4gIEJMQUtFMkIyNTY6IFwiQkxBS0UyQi0yNTZcIixcbiAgQkxBS0UyQjM4NDogXCJCTEFLRTJCLTM4NFwiLFxuICBCTEFLRTJCNTEyOiBcIkJMQUtFMkJcIixcbiAgQkxBS0UyUzI1NjogXCJCTEFLRTJTXCIsXG4gIFJJUEVNRDE2MDogXCJSSVBFTUQtMTYwXCIsXG4gIFJNRDE2MDogXCJSSVBFTUQtMTYwXCIsXG4gIFNIQTE6IFwiU0hBLTFcIixcbiAgU0hBMjI0OiBcIlNIQS0yMjRcIixcbiAgU0hBMjU2OiBcIlNIQS0yNTZcIixcbiAgU0hBMzg0OiBcIlNIQS0zODRcIixcbiAgU0hBNTEyOiBcIlNIQS01MTJcIixcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIEhhc2ggb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgaGFzaCBkaWdlc3RzXG4gKiB1c2luZyB0aGUgZ2l2ZW4gYGFsZ29yaXRobWAuIE9wdGlvbmFsIGBvcHRpb25zYCBhcmd1bWVudCBjb250cm9scyBzdHJlYW0gYmVoYXZpb3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIYXNoKGFsZ29yaXRobTogc3RyaW5nLCBvcHRzPzogVHJhbnNmb3JtT3B0aW9ucykge1xuICByZXR1cm4gbmV3IEhhc2goYWxnb3JpdGhtLCBvcHRzKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBIYXNoLFxuICBIbWFjLFxuICBjcmVhdGVIYXNoLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUZBQXFGO0FBRXJGLFNBR0UsZUFBZSxRQUNWLCtCQUErQjtBQUN0QyxTQUFTLE1BQU0sUUFBUSxrQkFBa0I7QUFDekMsU0FBUyxTQUFTLFFBQVEsa0JBQWtCO0FBQzVDLFNBQVMsVUFBVSxXQUFXLFFBQVEsMkJBQTJCO0FBQ2pFLFNBQVMsVUFBVSxjQUFjLFFBQVEsOEJBQThCO0FBQ3ZFLFNBQVMsVUFBVSxpQkFBaUIsUUFBUSxpQ0FBaUM7QUFFN0UsU0FBUyxjQUFjLFFBQVEsb0JBQW9CO0FBRW5ELFNBQVMsU0FBUyxFQUFFLGdCQUFnQixRQUFRLFlBQVk7QUFDeEQsU0FBUyxjQUFjLFFBQVEsa0JBQWtCO0FBRWpELE1BQU0sZ0JBQWdCLENBQUMsT0FBNEM7SUFDakUsSUFBSSxnQkFBZ0IsWUFBWTtRQUM5QixPQUFPO0lBQ1QsT0FBTyxJQUFJLE9BQU8sU0FBUyxVQUFVO1FBQ25DLGdEQUFnRDtRQUNoRCxPQUFPLElBQUksY0FBYyxNQUFNLENBQUM7SUFDbEMsT0FBTyxJQUFJLFlBQVksTUFBTSxDQUFDLE9BQU87UUFDbkMsT0FBTyxJQUFJLFdBQVcsS0FBSyxNQUFNLEVBQUUsS0FBSyxVQUFVLEVBQUUsS0FBSyxVQUFVO0lBQ3JFLE9BQU8sSUFBSSxnQkFB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