// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { validateFunction, validateInteger, validateString } from "../validators.mjs";
import { ERR_INVALID_ARG_TYPE, ERR_OUT_OF_RANGE, hideStackFrames } from "../errors.ts";
import { toBuf, validateByteSource } from "./util.ts";
import { createSecretKey, isKeyObject } from "./keys.ts";
import { kMaxLength } from "../buffer.mjs";
import { isAnyArrayBuffer, isArrayBufferView } from "../util/types.ts";
import { notImplemented } from "../../_utils.ts";
const validateParameters = hideStackFrames((hash, key, salt, info, length)=>{
    key = prepareKey(key);
    salt = toBuf(salt);
    info = toBuf(info);
    validateString(hash, "digest");
    validateByteSource(salt, "salt");
    validateByteSource(info, "info");
    validateInteger(length, "length", 0, kMaxLength);
    if (info.byteLength > 1024) {
        throw new ERR_OUT_OF_RANGE("info", "must not contain more than 1024 bytes", info.byteLength);
    }
    return {
        hash,
        key,
        salt,
        info,
        length
    };
});
function prepareKey(key) {
    if (isKeyObject(key)) {
        return key;
    }
    if (isAnyArrayBuffer(key)) {
        return createSecretKey(new Uint8Array(key));
    }
    key = toBuf(key);
    if (!isArrayBufferView(key)) {
        throw new ERR_INVALID_ARG_TYPE("ikm", [
            "string",
            "SecretKeyObject",
            "ArrayBuffer",
            "TypedArray",
            "DataView",
            "Buffer"
        ], key);
    }
    return createSecretKey(key);
}
export function hkdf(hash, key, salt, info, length, callback) {
    ({ hash , key , salt , info , length  } = validateParameters(hash, key, salt, info, length));
    validateFunction(callback, "callback");
    notImplemented("crypto.hkdf");
}
export function hkdfSync(hash, key, salt, info, length) {
    ({ hash , key , salt , info , length  } = validateParameters(hash, key, salt, info, length));
    notImplemented("crypto.hkdfSync");
}
export default {
    hkdf,
    hkdfSync
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL2hrZGYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIE5vZGUuanMgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHtcbiAgdmFsaWRhdGVGdW5jdGlvbixcbiAgdmFsaWRhdGVJbnRlZ2VyLFxuICB2YWxpZGF0ZVN0cmluZyxcbn0gZnJvbSBcIi4uL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQge1xuICBFUlJfSU5WQUxJRF9BUkdfVFlQRSxcbiAgRVJSX09VVF9PRl9SQU5HRSxcbiAgaGlkZVN0YWNrRnJhbWVzLFxufSBmcm9tIFwiLi4vZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyB0b0J1ZiwgdmFsaWRhdGVCeXRlU291cmNlIH0gZnJvbSBcIi4vdXRpbC50c1wiO1xuaW1wb3J0IHsgY3JlYXRlU2VjcmV0S2V5LCBpc0tleU9iamVjdCwgS2V5T2JqZWN0IH0gZnJvbSBcIi4va2V5cy50c1wiO1xuaW1wb3J0IHR5cGUgeyBCaW5hcnlMaWtlIH0gZnJvbSBcIi4vdHlwZXMudHNcIjtcbmltcG9ydCB7IGtNYXhMZW5ndGggfSBmcm9tIFwiLi4vYnVmZmVyLm1qc1wiO1xuaW1wb3J0IHsgaXNBbnlBcnJheUJ1ZmZlciwgaXNBcnJheUJ1ZmZlclZpZXcgfSBmcm9tIFwiLi4vdXRpbC90eXBlcy50c1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vLi4vX3V0aWxzLnRzXCI7XG5cbmNvbnN0IHZhbGlkYXRlUGFyYW1ldGVycyA9IGhpZGVTdGFja0ZyYW1lcygoaGFzaCwga2V5LCBzYWx0LCBpbmZvLCBsZW5ndGgpID0+IHtcbiAga2V5ID0gcHJlcGFyZUtleShrZXkpO1xuICBzYWx0ID0gdG9CdWYoc2FsdCk7XG4gIGluZm8gPSB0b0J1ZihpbmZvKTtcblxuICB2YWxpZGF0ZVN0cmluZyhoYXNoLCBcImRpZ2VzdFwiKTtcbiAgdmFsaWRhdGVCeXRlU291cmNlKHNhbHQsIFwic2FsdFwiKTtcbiAgdmFsaWRhdGVCeXRlU291cmNlKGluZm8sIFwiaW5mb1wiKTtcblxuICB2YWxpZGF0ZUludGVnZXIobGVuZ3RoLCBcImxlbmd0aFwiLCAwLCBrTWF4TGVuZ3RoKTtcblxuICBpZiAoaW5mby5ieXRlTGVuZ3RoID4gMTAyNCkge1xuICAgIHRocm93IG5ldyBFUlJfT1VUX09GX1JBTkdFKFxuICAgICAgXCJpbmZvXCIsXG4gICAgICBcIm11c3Qgbm90IGNvbnRhaW4gbW9yZSB0aGFuIDEwMjQgYnl0ZXNcIixcbiAgICAgIGluZm8uYnl0ZUxlbmd0aCxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBoYXNoLFxuICAgIGtleSxcbiAgICBzYWx0LFxuICAgIGluZm8sXG4gICAgbGVuZ3RoLFxuICB9O1xufSk7XG5cbmZ1bmN0aW9uIHByZXBhcmVLZXkoa2V5OiBCaW5hcnlMaWtlIHwgS2V5T2JqZWN0KSB7XG4gIGlmIChpc0tleU9iamVjdChrZXkpKSB7XG4gICAgcmV0dXJuIGtleTtcbiAgfVxuXG4gIGlmIChpc0FueUFycmF5QnVmZmVyKGtleSkpIHtcbiAgICByZXR1cm4gY3JlYXRlU2VjcmV0S2V5KG5ldyBVaW50OEFycmF5KGtleSBhcyB1bmtub3duIGFzIEFycmF5QnVmZmVyTGlrZSkpO1xuICB9XG5cbiAga2V5ID0gdG9CdWYoa2V5IGFzIHN0cmluZyk7XG5cbiAgaWYgKCFpc0FycmF5QnVmZmVyVmlldyhrZXkpKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFxuICAgICAgXCJpa21cIixcbiAgICAgIFtcbiAgICAgICAgXCJzdHJpbmdcIixcbiAgICAgICAgXCJTZWNyZXRLZXlPYmplY3RcIixcbiAgICAgICAgXCJBcnJheUJ1ZmZlclwiLFxuICAgICAgICBcIlR5cGVkQXJyYXlcIixcbiAgICAgICAgXCJEYXRhVmlld1wiLFxuICAgICAgICBcIkJ1ZmZlclwiLFxuICAgICAgXSxcbiAgICAgIGtleSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZVNlY3JldEtleShrZXkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGtkZihcbiAgaGFzaDogc3RyaW5nLFxuICBrZXk6IEJpbmFyeUxpa2UgfCBLZXlPYmplY3QsXG4gIHNhbHQ6IEJpbmFyeUxpa2UsXG4gIGluZm86IEJpbmFyeUxpa2UsXG4gIGxlbmd0aDogbnVtYmVyLFxuICBjYWxsYmFjazogKGVycjogRXJyb3IgfCBudWxsLCBkZXJpdmVkS2V5OiBBcnJheUJ1ZmZlcikgPT4gdm9pZCxcbikge1xuICAoeyBoYXNoLCBrZXksIHNhbHQsIGluZm8sIGxlbmd0aCB9ID0gdmFsaWRhdGVQYXJhbWV0ZXJzKFxuICAgIGhhc2gsXG4gICAga2V5LFxuICAgIHNhbHQsXG4gICAgaW5mbyxcbiAgICBsZW5ndGgsXG4gICkpO1xuXG4gIHZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG5cbiAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uaGtkZlwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhrZGZTeW5jKFxuICBoYXNoOiBzdHJpbmcsXG4gIGtleTogQmluYXJ5TGlrZSB8IEtleU9iamVjdCxcbiAgc2FsdDogQmluYXJ5TGlrZSxcbiAgaW5mbzogQmluYXJ5TGlrZSxcbiAgbGVuZ3RoOiBudW1iZXIsXG4pIHtcbiAgKHsgaGFzaCwga2V5LCBzYWx0LCBpbmZvLCBsZW5ndGggfSA9IHZhbGlkYXRlUGFyYW1ldGVycyhcbiAgICBoYXNoLFxuICAgIGtleSxcbiAgICBzYWx0LFxuICAgIGluZm8sXG4gICAgbGVuZ3RoLFxuICApKTtcblxuICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5oa2RmU3luY1wiKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBoa2RmLFxuICBoa2RmU3luYyxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFGQUFxRjtBQUVyRixTQUNFLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YsY0FBYyxRQUNULG9CQUFvQjtBQUMzQixTQUNFLG9CQUFvQixFQUNwQixnQkFBZ0IsRUFDaEIsZUFBZSxRQUNWLGVBQWU7QUFDdEIsU0FBUyxLQUFLLEVBQUUsa0JBQWtCLFFBQVEsWUFBWTtBQUN0RCxTQUFTLGVBQWUsRUFBRSxXQUFXLFFBQW1CLFlBQVk7QUFFcEUsU0FBUyxVQUFVLFFBQVEsZ0JBQWdCO0FBQzNDLFNBQVMsZ0JBQWdCLEVBQUUsaUJBQWlCLFFBQVEsbUJBQW1CO0FBQ3ZFLFNBQVMsY0FBYyxRQUFRLGtCQUFrQjtBQUVqRCxNQUFNLHFCQUFxQixnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssTUFBTSxNQUFNLFNBQVc7SUFDNUUsTUFBTSxXQUFXO0lBQ2pCLE9BQU8sTUFBTTtJQUNiLE9BQU8sTUFBTTtJQUViLGVBQWUsTUFBTTtJQUNyQixtQkFBbUIsTUFBTTtJQUN6QixtQkFBbUIsTUFBTTtJQUV6QixnQkFBZ0IsUUFBUSxVQUFVLEdBQUc7SUFFckMsSUFBSSxLQUFLLFVBQVUsR0FBRyxNQUFNO1FBQzFCLE1BQU0sSUFBSSxpQkFDUixRQUNBLHlDQUNBLEtBQUssVUFBVSxFQUNmO0lBQ0osQ0FBQztJQUVELE9BQU87UUFDTDtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0Y7QUFDRjtBQUVBLFNBQVMsV0FBVyxHQUEyQixFQUFFO0lBQy9DLElBQUksWUFBWSxNQUFNO1FBQ3BCLE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBSSxpQkFBaUIsTUFBTTtRQUN6QixPQUFPLGdCQUFnQixJQUFJLFdBQVc7SUFDeEMsQ0FBQztJQUVELE1BQU0sTUFBTTtJQUVaLElBQUksQ0FBQyxrQkFBa0IsTUFBTTtRQUMzQixNQUFNLElBQUkscUJBQ1IsT0FDQTtZQUNFO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtTQUNELEVBQ0QsS0FDQTtJQUNKLENBQUM7SUFFRCxPQUFPLGdCQUFnQjtBQUN6QjtBQUVBLE9BQU8sU0FBUyxLQUNkLElBQVksRUFDWixHQUEyQixFQUMzQixJQUFnQixFQUNoQixJQUFnQixFQUNoQixNQUFjLEVBQ2QsUUFBOEQsRUFDOUQ7SUFDQSxDQUFDLEVBQUUsS0FBSSxFQUFFLElBQUcsRUFBRSxLQUFJLEVBQUUsS0FBSSxFQUFFLE9BQU0sRUFBRSxHQUFHLG1CQUNuQyxNQUNBLEtBQ0EsTUFDQSxNQUNBLE9BQ0Q7SUFFRCxpQkFBaUIsVUFBVTtJQUUzQixlQUFlO0FBQ2pCLENBQUM7QUFFRCxPQUFPLFNBQVMsU0FDZCxJQUFZLEVBQ1osR0FBMkIsRUFDM0IsSUFBZ0IsRUFDaEIsSUFBZ0IsRUFDaEIsTUFBYyxFQUNkO0lBQ0EsQ0FBQyxFQUFFLEtBQUksRUFBRSxJQUFHLEVBQUUsS0FBSSxFQUFFLEtBQUksRUFBRSxPQUFNLEVBQUUsR0FBRyxtQkFDbkMsTUFDQSxLQUNBLE1BQ0EsTUFDQSxPQUNEO0lBRUQsZUFBZTtBQUNqQixDQUFDO0FBRUQsZUFBZTtJQUNiO0lBQ0E7QUFDRixFQUFFIn0=