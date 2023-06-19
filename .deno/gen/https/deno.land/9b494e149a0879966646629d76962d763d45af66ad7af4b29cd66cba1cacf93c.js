// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
import { createHash } from "./hash.ts";
export const MAX_ALLOC = Math.pow(2, 30) - 1;
const createHasher = (algorithm)=>(value)=>Buffer.from(createHash(algorithm).update(value).digest());
function getZeroes(zeros) {
    return Buffer.alloc(zeros);
}
const sizes = {
    md5: 16,
    sha1: 20,
    sha224: 28,
    sha256: 32,
    sha384: 48,
    sha512: 64,
    rmd160: 20,
    ripemd160: 20
};
function toBuffer(bufferable) {
    if (bufferable instanceof Uint8Array || typeof bufferable === "string") {
        return Buffer.from(bufferable);
    } else {
        return Buffer.from(bufferable.buffer);
    }
}
export class Hmac {
    hash;
    ipad1;
    opad;
    alg;
    blocksize;
    size;
    ipad2;
    constructor(alg, key, saltLen){
        this.hash = createHasher(alg);
        const blocksize = alg === "sha512" || alg === "sha384" ? 128 : 64;
        if (key.length > blocksize) {
            key = this.hash(key);
        } else if (key.length < blocksize) {
            key = Buffer.concat([
                key,
                getZeroes(blocksize - key.length)
            ], blocksize);
        }
        const ipad = Buffer.allocUnsafe(blocksize + sizes[alg]);
        const opad = Buffer.allocUnsafe(blocksize + sizes[alg]);
        for(let i = 0; i < blocksize; i++){
            ipad[i] = key[i] ^ 0x36;
            opad[i] = key[i] ^ 0x5c;
        }
        const ipad1 = Buffer.allocUnsafe(blocksize + saltLen + 4);
        ipad.copy(ipad1, 0, 0, blocksize);
        this.ipad1 = ipad1;
        this.ipad2 = ipad;
        this.opad = opad;
        this.alg = alg;
        this.blocksize = blocksize;
        this.size = sizes[alg];
    }
    run(data, ipad) {
        data.copy(ipad, this.blocksize);
        const h = this.hash(ipad);
        h.copy(this.opad, this.blocksize);
        return this.hash(this.opad);
    }
}
/**
 * @param iterations Needs to be higher or equal than zero
 * @param keylen  Needs to be higher or equal than zero but less than max allocation size (2^30)
 * @param digest Algorithm to be used for encryption
 */ export function pbkdf2Sync(password, salt, iterations, keylen, digest = "sha1") {
    if (typeof iterations !== "number" || iterations < 0) {
        throw new TypeError("Bad iterations");
    }
    if (typeof keylen !== "number" || keylen < 0 || keylen > MAX_ALLOC) {
        throw new TypeError("Bad key length");
    }
    const bufferedPassword = toBuffer(password);
    const bufferedSalt = toBuffer(salt);
    const hmac = new Hmac(digest, bufferedPassword, bufferedSalt.length);
    const DK = Buffer.allocUnsafe(keylen);
    const block1 = Buffer.allocUnsafe(bufferedSalt.length + 4);
    bufferedSalt.copy(block1, 0, 0, bufferedSalt.length);
    let destPos = 0;
    const hLen = sizes[digest];
    const l = Math.ceil(keylen / hLen);
    for(let i = 1; i <= l; i++){
        block1.writeUInt32BE(i, bufferedSalt.length);
        const T = hmac.run(block1, hmac.ipad1);
        let U = T;
        for(let j = 1; j < iterations; j++){
            U = hmac.run(U, hmac.ipad2);
            for(let k = 0; k < hLen; k++)T[k] ^= U[k];
        }
        T.copy(DK, destPos);
        destPos += hLen;
    }
    return DK;
}
/**
 * @param iterations Needs to be higher or equal than zero
 * @param keylen  Needs to be higher or equal than zero but less than max allocation size (2^30)
 * @param digest Algorithm to be used for encryption
 */ export function pbkdf2(password, salt, iterations, keylen, digest = "sha1", callback) {
    setTimeout(()=>{
        let err = null, res;
        try {
            res = pbkdf2Sync(password, salt, iterations, keylen, digest);
        } catch (e) {
            err = e;
        }
        if (err) {
            callback(err instanceof Error ? err : new Error("[non-error thrown]"));
        } else {
            callback(null, res);
        }
    }, 0);
}
export default {
    Hmac,
    MAX_ALLOC,
    pbkdf2,
    pbkdf2Sync
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL3Bia2RmMi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCIuL2hhc2gudHNcIjtcbmltcG9ydCB7IEhBU0hfREFUQSB9IGZyb20gXCIuL3R5cGVzLnRzXCI7XG5cbmV4cG9ydCBjb25zdCBNQVhfQUxMT0MgPSBNYXRoLnBvdygyLCAzMCkgLSAxO1xuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkQWxnb3JpdGhtcyA9XG4gIHwgXCJtZDVcIlxuICB8IFwicmlwZW1kMTYwXCJcbiAgfCBcInNoYTFcIlxuICB8IFwic2hhMjI0XCJcbiAgfCBcInNoYTI1NlwiXG4gIHwgXCJzaGEzODRcIlxuICB8IFwic2hhNTEyXCI7XG5cbmV4cG9ydCB0eXBlIEFsZ29yaXRobXMgPVxuICB8IFwibWQ1XCJcbiAgfCBcInJpcGVtZDE2MFwiXG4gIHwgXCJybWQxNjBcIlxuICB8IFwic2hhMVwiXG4gIHwgXCJzaGEyMjRcIlxuICB8IFwic2hhMjU2XCJcbiAgfCBcInNoYTM4NFwiXG4gIHwgXCJzaGE1MTJcIjtcblxuY29uc3QgY3JlYXRlSGFzaGVyID0gKGFsZ29yaXRobTogc3RyaW5nKSA9PiAodmFsdWU6IFVpbnQ4QXJyYXkpID0+XG4gIEJ1ZmZlci5mcm9tKGNyZWF0ZUhhc2goYWxnb3JpdGhtKS51cGRhdGUodmFsdWUpLmRpZ2VzdCgpIGFzIEJ1ZmZlcik7XG5cbmZ1bmN0aW9uIGdldFplcm9lcyh6ZXJvczogbnVtYmVyKSB7XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoemVyb3MpO1xufVxuXG5jb25zdCBzaXplcyA9IHtcbiAgbWQ1OiAxNixcbiAgc2hhMTogMjAsXG4gIHNoYTIyNDogMjgsXG4gIHNoYTI1NjogMzIsXG4gIHNoYTM4NDogNDgsXG4gIHNoYTUxMjogNjQsXG4gIHJtZDE2MDogMjAsXG4gIHJpcGVtZDE2MDogMjAsXG59O1xuXG5mdW5jdGlvbiB0b0J1ZmZlcihidWZmZXJhYmxlOiBIQVNIX0RBVEEpIHtcbiAgaWYgKGJ1ZmZlcmFibGUgaW5zdGFuY2VvZiBVaW50OEFycmF5IHx8IHR5cGVvZiBidWZmZXJhYmxlID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGJ1ZmZlcmFibGUgYXMgVWludDhBcnJheSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGJ1ZmZlcmFibGUuYnVmZmVyKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSG1hYyB7XG4gIGhhc2g6ICh2YWx1ZTogVWludDhBcnJheSkgPT4gQnVmZmVyO1xuICBpcGFkMTogQnVmZmVyO1xuICBvcGFkOiBCdWZmZXI7XG4gIGFsZzogc3RyaW5nO1xuICBibG9ja3NpemU6IG51bWJlcjtcbiAgc2l6ZTogbnVtYmVyO1xuICBpcGFkMjogQnVmZmVyO1xuXG4gIGNvbnN0cnVjdG9yKGFsZzogQWxnb3JpdGhtcywga2V5OiBCdWZmZXIsIHNhbHRMZW46IG51bWJlcikge1xuICAgIHRoaXMuaGFzaCA9IGNyZWF0ZUhhc2hlcihhbGcpO1xuXG4gICAgY29uc3QgYmxvY2tzaXplID0gYWxnID09PSBcInNoYTUxMlwiIHx8IGFsZyA9PT0gXCJzaGEzODRcIiA/IDEyOCA6IDY0O1xuXG4gICAgaWYgKGtleS5sZW5ndGggPiBibG9ja3NpemUpIHtcbiAgICAgIGtleSA9IHRoaXMuaGFzaChrZXkpO1xuICAgIH0gZWxzZSBpZiAoa2V5Lmxlbmd0aCA8IGJsb2Nrc2l6ZSkge1xuICAgICAga2V5ID0gQnVmZmVyLmNvbmNhdChba2V5LCBnZXRaZXJvZXMoYmxvY2tzaXplIC0ga2V5Lmxlbmd0aCldLCBibG9ja3NpemUpO1xuICAgIH1cblxuICAgIGNvbnN0IGlwYWQgPSBCdWZmZXIuYWxsb2NVbnNhZmUoYmxvY2tzaXplICsgc2l6ZXNbYWxnXSk7XG4gICAgY29uc3Qgb3BhZCA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShibG9ja3NpemUgKyBzaXplc1thbGddKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJsb2Nrc2l6ZTsgaSsrKSB7XG4gICAgICBpcGFkW2ldID0ga2V5W2ldIF4gMHgzNjtcbiAgICAgIG9wYWRbaV0gPSBrZXlbaV0gXiAweDVjO1xuICAgIH1cblxuICAgIGNvbnN0IGlwYWQxID0gQnVmZmVyLmFsbG9jVW5zYWZlKGJsb2Nrc2l6ZSArIHNhbHRMZW4gKyA0KTtcbiAgICBpcGFkLmNvcHkoaXBhZDEsIDAsIDAsIGJsb2Nrc2l6ZSk7XG5cbiAgICB0aGlzLmlwYWQxID0gaXBhZDE7XG4gICAgdGhpcy5pcGFkMiA9IGlwYWQ7XG4gICAgdGhpcy5vcGFkID0gb3BhZDtcbiAgICB0aGlzLmFsZyA9IGFsZztcbiAgICB0aGlzLmJsb2Nrc2l6ZSA9IGJsb2Nrc2l6ZTtcbiAgICB0aGlzLnNpemUgPSBzaXplc1thbGddO1xuICB9XG5cbiAgcnVuKGRhdGE6IEJ1ZmZlciwgaXBhZDogQnVmZmVyKSB7XG4gICAgZGF0YS5jb3B5KGlwYWQsIHRoaXMuYmxvY2tzaXplKTtcbiAgICBjb25zdCBoID0gdGhpcy5oYXNoKGlwYWQpO1xuICAgIGguY29weSh0aGlzLm9wYWQsIHRoaXMuYmxvY2tzaXplKTtcbiAgICByZXR1cm4gdGhpcy5oYXNoKHRoaXMub3BhZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBAcGFyYW0gaXRlcmF0aW9ucyBOZWVkcyB0byBiZSBoaWdoZXIgb3IgZXF1YWwgdGhhbiB6ZXJvXG4gKiBAcGFyYW0ga2V5bGVuICBOZWVkcyB0byBiZSBoaWdoZXIgb3IgZXF1YWwgdGhhbiB6ZXJvIGJ1dCBsZXNzIHRoYW4gbWF4IGFsbG9jYXRpb24gc2l6ZSAoMl4zMClcbiAqIEBwYXJhbSBkaWdlc3QgQWxnb3JpdGhtIHRvIGJlIHVzZWQgZm9yIGVuY3J5cHRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBia2RmMlN5bmMoXG4gIHBhc3N3b3JkOiBIQVNIX0RBVEEsXG4gIHNhbHQ6IEhBU0hfREFUQSxcbiAgaXRlcmF0aW9uczogbnVtYmVyLFxuICBrZXlsZW46IG51bWJlcixcbiAgZGlnZXN0OiBBbGdvcml0aG1zID0gXCJzaGExXCIsXG4pOiBCdWZmZXIge1xuICBpZiAodHlwZW9mIGl0ZXJhdGlvbnMgIT09IFwibnVtYmVyXCIgfHwgaXRlcmF0aW9ucyA8IDApIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQmFkIGl0ZXJhdGlvbnNcIik7XG4gIH1cbiAgaWYgKHR5cGVvZiBrZXlsZW4gIT09IFwibnVtYmVyXCIgfHwga2V5bGVuIDwgMCB8fCBrZXlsZW4gPiBNQVhfQUxMT0MpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQmFkIGtleSBsZW5ndGhcIik7XG4gIH1cblxuICBjb25zdCBidWZmZXJlZFBhc3N3b3JkID0gdG9CdWZmZXIocGFzc3dvcmQpO1xuICBjb25zdCBidWZmZXJlZFNhbHQgPSB0b0J1ZmZlcihzYWx0KTtcblxuICBjb25zdCBobWFjID0gbmV3IEhtYWMoZGlnZXN0LCBidWZmZXJlZFBhc3N3b3JkLCBidWZmZXJlZFNhbHQubGVuZ3RoKTtcblxuICBjb25zdCBESyA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShrZXlsZW4pO1xuICBjb25zdCBibG9jazEgPSBCdWZmZXIuYWxsb2NVbnNhZmUoYnVmZmVyZWRTYWx0Lmxlbmd0aCArIDQpO1xuICBidWZmZXJlZFNhbHQuY29weShibG9jazEsIDAsIDAsIGJ1ZmZlcmVkU2FsdC5sZW5ndGgpO1xuXG4gIGxldCBkZXN0UG9zID0gMDtcbiAgY29uc3QgaExlbiA9IHNpemVzW2RpZ2VzdF07XG4gIGNvbnN0IGwgPSBNYXRoLmNlaWwoa2V5bGVuIC8gaExlbik7XG5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPD0gbDsgaSsrKSB7XG4gICAgYmxvY2sxLndyaXRlVUludDMyQkUoaSwgYnVmZmVyZWRTYWx0Lmxlbmd0aCk7XG5cbiAgICBjb25zdCBUID0gaG1hYy5ydW4oYmxvY2sxLCBobWFjLmlwYWQxKTtcbiAgICBsZXQgVSA9IFQ7XG5cbiAgICBmb3IgKGxldCBqID0gMTsgaiA8IGl0ZXJhdGlvbnM7IGorKykge1xuICAgICAgVSA9IGhtYWMucnVuKFUsIGhtYWMuaXBhZDIpO1xuICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBoTGVuOyBrKyspIFRba10gXj0gVVtrXTtcbiAgICB9XG5cbiAgICBULmNvcHkoREssIGRlc3RQb3MpO1xuICAgIGRlc3RQb3MgKz0gaExlbjtcbiAgfVxuXG4gIHJldHVybiBESztcbn1cblxuLyoqXG4gKiBAcGFyYW0gaXRlcmF0aW9ucyBOZWVkcyB0byBiZSBoaWdoZXIgb3IgZXF1YWwgdGhhbiB6ZXJvXG4gKiBAcGFyYW0ga2V5bGVuICBOZWVkcyB0byBiZSBoaWdoZXIgb3IgZXF1YWwgdGhhbiB6ZXJvIGJ1dCBsZXNzIHRoYW4gbWF4IGFsbG9jYXRpb24gc2l6ZSAoMl4zMClcbiAqIEBwYXJhbSBkaWdlc3QgQWxnb3JpdGhtIHRvIGJlIHVzZWQgZm9yIGVuY3J5cHRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBia2RmMihcbiAgcGFzc3dvcmQ6IEhBU0hfREFUQSxcbiAgc2FsdDogSEFTSF9EQVRBLFxuICBpdGVyYXRpb25zOiBudW1iZXIsXG4gIGtleWxlbjogbnVtYmVyLFxuICBkaWdlc3Q6IEFsZ29yaXRobXMgPSBcInNoYTFcIixcbiAgY2FsbGJhY2s6IChlcnI6IEVycm9yIHwgbnVsbCwgZGVyaXZlZEtleT86IEJ1ZmZlcikgPT4gdm9pZCxcbikge1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBsZXQgZXJyID0gbnVsbCxcbiAgICAgIHJlcztcbiAgICB0cnkge1xuICAgICAgcmVzID0gcGJrZGYyU3luYyhwYXNzd29yZCwgc2FsdCwgaXRlcmF0aW9ucywga2V5bGVuLCBkaWdlc3QpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVyciA9IGU7XG4gICAgfVxuICAgIGlmIChlcnIpIHtcbiAgICAgIGNhbGxiYWNrKGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyIDogbmV3IEVycm9yKFwiW25vbi1lcnJvciB0aHJvd25dXCIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzKTtcbiAgICB9XG4gIH0sIDApO1xufVxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIEhtYWMsXG4gIE1BWF9BTExPQyxcbiAgcGJrZGYyLFxuICBwYmtkZjJTeW5jLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FBUyxNQUFNLFFBQVEsa0JBQWtCO0FBQ3pDLFNBQVMsVUFBVSxRQUFRLFlBQVk7QUFHdkMsT0FBTyxNQUFNLFlBQVksS0FBSyxHQUFHLENBQUMsR0FBRyxNQUFNLEVBQUU7QUFxQjdDLE1BQU0sZUFBZSxDQUFDLFlBQXNCLENBQUMsUUFDM0MsT0FBTyxJQUFJLENBQUMsV0FBVyxXQUFXLE1BQU0sQ0FBQyxPQUFPLE1BQU07QUFFeEQsU0FBUyxVQUFVLEtBQWEsRUFBRTtJQUNoQyxPQUFPLE9BQU8sS0FBSyxDQUFDO0FBQ3RCO0FBRUEsTUFBTSxRQUFRO0lBQ1osS0FBSztJQUNMLE1BQU07SUFDTixRQUFRO0lBQ1IsUUFBUTtJQUNSLFFBQVE7SUFDUixRQUFRO0lBQ1IsUUFBUTtJQUNSLFdBQVc7QUFDYjtBQUVBLFNBQVMsU0FBUyxVQUFxQixFQUFFO0lBQ3ZDLElBQUksc0JBQXNCLGNBQWMsT0FBTyxlQUFlLFVBQVU7UUFDdEUsT0FBTyxPQUFPLElBQUksQ0FBQztJQUNyQixPQUFPO1FBQ0wsT0FBTyxPQUFPLElBQUksQ0FBQyxXQUFXLE1BQU07SUFDdEMsQ0FBQztBQUNIO0FBRUEsT0FBTyxNQUFNO0lBQ1gsS0FBb0M7SUFDcEMsTUFBYztJQUNkLEtBQWE7SUFDYixJQUFZO0lBQ1osVUFBa0I7SUFDbEIsS0FBYTtJQUNiLE1BQWM7SUFFZCxZQUFZ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