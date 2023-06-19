// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2017 crypto-browserify. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
import { createHash } from "../../internal/crypto/hash.ts";
export function EVP_BytesToKey(password, salt, keyBits, ivLen) {
    if (!Buffer.isBuffer(password)) password = Buffer.from(password, "binary");
    if (salt) {
        if (!Buffer.isBuffer(salt)) salt = Buffer.from(salt, "binary");
        if (salt.length !== 8) {
            throw new RangeError("salt should be Buffer with 8 byte length");
        }
    }
    let keyLen = keyBits / 8;
    const key = Buffer.alloc(keyLen);
    const iv = Buffer.alloc(ivLen || 0);
    let tmp = Buffer.alloc(0);
    while(keyLen > 0 || ivLen > 0){
        const hash = createHash("md5");
        hash.update(tmp);
        hash.update(password);
        if (salt) hash.update(salt);
        tmp = hash.digest();
        let used = 0;
        if (keyLen > 0) {
            const keyStart = key.length - keyLen;
            used = Math.min(keyLen, tmp.length);
            tmp.copy(key, keyStart, 0, used);
            keyLen -= used;
        }
        if (used < tmp.length && ivLen > 0) {
            const ivStart = iv.length - ivLen;
            const length = Math.min(ivLen, tmp.length - used);
            tmp.copy(iv, ivStart, used, used + length);
            ivLen -= length;
        }
    }
    tmp.fill(0);
    return {
        key,
        iv
    };
}
export default EVP_BytesToKey;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2NyeXB0by9jcnlwdG9fYnJvd3NlcmlmeS9ldnBfYnl0ZXNfdG9fa2V5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgMjAxNyBjcnlwdG8tYnJvd3NlcmlmeS4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi8uLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tIFwiLi4vLi4vaW50ZXJuYWwvY3J5cHRvL2hhc2gudHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIEVWUF9CeXRlc1RvS2V5KFxuICBwYXNzd29yZDogc3RyaW5nIHwgQnVmZmVyLFxuICBzYWx0OiBzdHJpbmcgfCBCdWZmZXIsXG4gIGtleUJpdHM6IG51bWJlcixcbiAgaXZMZW46IG51bWJlcixcbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihwYXNzd29yZCkpIHBhc3N3b3JkID0gQnVmZmVyLmZyb20ocGFzc3dvcmQsIFwiYmluYXJ5XCIpO1xuICBpZiAoc2FsdCkge1xuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKHNhbHQpKSBzYWx0ID0gQnVmZmVyLmZyb20oc2FsdCwgXCJiaW5hcnlcIik7XG4gICAgaWYgKHNhbHQubGVuZ3RoICE9PSA4KSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcInNhbHQgc2hvdWxkIGJlIEJ1ZmZlciB3aXRoIDggYnl0ZSBsZW5ndGhcIik7XG4gICAgfVxuICB9XG5cbiAgbGV0IGtleUxlbiA9IGtleUJpdHMgLyA4O1xuICBjb25zdCBrZXkgPSBCdWZmZXIuYWxsb2Moa2V5TGVuKTtcbiAgY29uc3QgaXYgPSBCdWZmZXIuYWxsb2MoaXZMZW4gfHwgMCk7XG4gIGxldCB0bXAgPSBCdWZmZXIuYWxsb2MoMCk7XG5cbiAgd2hpbGUgKGtleUxlbiA+IDAgfHwgaXZMZW4gPiAwKSB7XG4gICAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goXCJtZDVcIik7XG4gICAgaGFzaC51cGRhdGUodG1wKTtcbiAgICBoYXNoLnVwZGF0ZShwYXNzd29yZCk7XG4gICAgaWYgKHNhbHQpIGhhc2gudXBkYXRlKHNhbHQpO1xuICAgIHRtcCA9IGhhc2guZGlnZXN0KCkgYXMgQnVmZmVyO1xuXG4gICAgbGV0IHVzZWQgPSAwO1xuXG4gICAgaWYgKGtleUxlbiA+IDApIHtcbiAgICAgIGNvbnN0IGtleVN0YXJ0ID0ga2V5Lmxlbmd0aCAtIGtleUxlbjtcbiAgICAgIHVzZWQgPSBNYXRoLm1pbihrZXlMZW4sIHRtcC5sZW5ndGgpO1xuICAgICAgdG1wLmNvcHkoa2V5LCBrZXlTdGFydCwgMCwgdXNlZCk7XG4gICAgICBrZXlMZW4gLT0gdXNlZDtcbiAgICB9XG5cbiAgICBpZiAodXNlZCA8IHRtcC5sZW5ndGggJiYgaXZMZW4gPiAwKSB7XG4gICAgICBjb25zdCBpdlN0YXJ0ID0gaXYubGVuZ3RoIC0gaXZMZW47XG4gICAgICBjb25zdCBsZW5ndGggPSBNYXRoLm1pbihpdkxlbiwgdG1wLmxlbmd0aCAtIHVzZWQpO1xuICAgICAgdG1wLmNvcHkoaXYsIGl2U3RhcnQsIHVzZWQsIHVzZWQgKyBsZW5ndGgpO1xuICAgICAgaXZMZW4gLT0gbGVuZ3RoO1xuICAgIH1cbiAgfVxuXG4gIHRtcC5maWxsKDApO1xuICByZXR1cm4geyBrZXksIGl2IH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVWUF9CeXRlc1RvS2V5O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzRUFBc0U7QUFFdEUsU0FBUyxNQUFNLFFBQVEsa0JBQWtCO0FBQ3pDLFNBQVMsVUFBVSxRQUFRLGdDQUFnQztBQUUzRCxPQUFPLFNBQVMsZUFDZCxRQUF5QixFQUN6QixJQUFxQixFQUNyQixPQUFlLEVBQ2YsS0FBYSxFQUNiO0lBQ0EsSUFBSSxDQUFDLE9BQU8sUUFBUSxDQUFDLFdBQVcsV0FBVyxPQUFPLElBQUksQ0FBQyxVQUFVO0lBQ2pFLElBQUksTUFBTTtRQUNSLElBQUksQ0FBQyxPQUFPLFFBQVEsQ0FBQyxPQUFPLE9BQU8sT0FBTyxJQUFJLENBQUMsTUFBTTtRQUNyRCxJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7WUFDckIsTUFBTSxJQUFJLFdBQVcsNENBQTRDO1FBQ25FLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxTQUFTLFVBQVU7SUFDdkIsTUFBTSxNQUFNLE9BQU8sS0FBSyxDQUFDO0lBQ3pCLE1BQU0sS0FBSyxPQUFPLEtBQUssQ0FBQyxTQUFTO0lBQ2pDLElBQUksTUFBTSxPQUFPLEtBQUssQ0FBQztJQUV2QixNQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUc7UUFDOUIsTUFBTSxPQUFPLFdBQVc7UUFDeEIsS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLE1BQU0sQ0FBQztRQUNaLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQztRQUN0QixNQUFNLEtBQUssTUFBTTtRQUVqQixJQUFJLE9BQU87UUFFWCxJQUFJLFNBQVMsR0FBRztZQUNkLE1BQU0sV0FBVyxJQUFJLE1BQU0sR0FBRztZQUM5QixPQUFPLEtBQUssR0FBRyxDQUFDLFFBQVEsSUFBSSxNQUFNO1lBQ2xDLElBQUksSUFBSSxDQUFDLEtBQUssVUFBVSxHQUFHO1lBQzNCLFVBQVU7UUFDWixDQUFDO1FBRUQsSUFBSSxPQUFPLElBQUksTUFBTSxJQUFJLFFBQVEsR0FBRztZQUNsQyxNQUFNLFVBQVUsR0FBRyxNQUFNLEdBQUc7WUFDNUIsTUFBTSxTQUFTLEtBQUssR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLEdBQUc7WUFDNUMsSUFBSSxJQUFJLENBQUMsSUFBSSxTQUFTLE1BQU0sT0FBTztZQUNuQyxTQUFTO1FBQ1gsQ0FBQztJQUNIO0lBRUEsSUFBSSxJQUFJLENBQUM7SUFDVCxPQUFPO1FBQUU7UUFBSztJQUFHO0FBQ25CLENBQUM7QUFFRCxlQUFlLGVBQWUifQ==