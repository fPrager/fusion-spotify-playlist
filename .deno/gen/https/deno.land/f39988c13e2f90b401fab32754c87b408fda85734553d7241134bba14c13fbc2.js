// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { promisify } from "../internal/util.mjs";
import { denoErrorToNodeError } from "../internal/errors.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import { validateBoolean } from "../internal/validators.mjs";
export function mkdir(path, options, callback) {
    path = getValidatedPath(path);
    let mode = 0o777;
    let recursive = false;
    if (typeof options == "function") {
        callback = options;
    } else if (typeof options === "number") {
        mode = options;
    } else if (typeof options === "boolean") {
        recursive = options;
    } else if (options) {
        if (options.recursive !== undefined) recursive = options.recursive;
        if (options.mode !== undefined) mode = options.mode;
    }
    validateBoolean(recursive, "options.recursive");
    Deno.mkdir(path, {
        recursive,
        mode
    }).then(()=>{
        if (typeof callback === "function") {
            callback(null);
        }
    }, (err)=>{
        if (typeof callback === "function") {
            callback(err);
        }
    });
}
export const mkdirPromise = promisify(mkdir);
export function mkdirSync(path, options) {
    path = getValidatedPath(path);
    let mode = 0o777;
    let recursive = false;
    if (typeof options === "number") {
        mode = options;
    } else if (typeof options === "boolean") {
        recursive = options;
    } else if (options) {
        if (options.recursive !== undefined) recursive = options.recursive;
        if (options.mode !== undefined) mode = options.mode;
    }
    validateBoolean(recursive, "options.recursive");
    try {
        Deno.mkdirSync(path, {
            recursive,
            mode
        });
    } catch (err) {
        throw denoErrorToNodeError(err, {
            syscall: "mkdir",
            path
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19ta2Rpci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHR5cGUgeyBDYWxsYmFja1dpdGhFcnJvciB9IGZyb20gXCIuL19mc19jb21tb24udHNcIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCIuLi9pbnRlcm5hbC91dGlsLm1qc1wiO1xuaW1wb3J0IHsgZGVub0Vycm9yVG9Ob2RlRXJyb3IgfSBmcm9tIFwiLi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBnZXRWYWxpZGF0ZWRQYXRoIH0gZnJvbSBcIi4uL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVCb29sZWFuIH0gZnJvbSBcIi4uL2ludGVybmFsL3ZhbGlkYXRvcnMubWpzXCI7XG5cbi8qKlxuICogVE9ETzogQWxzbyBhY2NlcHQgJ3BhdGgnIHBhcmFtZXRlciBhcyBhIE5vZGUgcG9seWZpbGwgQnVmZmVyIHR5cGUgb25jZSB0aGVzZVxuICogYXJlIGltcGxlbWVudGVkLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm8vaXNzdWVzLzM0MDNcbiAqL1xudHlwZSBNa2Rpck9wdGlvbnMgPVxuICB8IHsgcmVjdXJzaXZlPzogYm9vbGVhbjsgbW9kZT86IG51bWJlciB8IHVuZGVmaW5lZCB9XG4gIHwgbnVtYmVyXG4gIHwgYm9vbGVhbjtcblxuZXhwb3J0IGZ1bmN0aW9uIG1rZGlyKFxuICBwYXRoOiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnM/OiBNa2Rpck9wdGlvbnMgfCBDYWxsYmFja1dpdGhFcnJvcixcbiAgY2FsbGJhY2s/OiBDYWxsYmFja1dpdGhFcnJvcixcbikge1xuICBwYXRoID0gZ2V0VmFsaWRhdGVkUGF0aChwYXRoKSBhcyBzdHJpbmc7XG5cbiAgbGV0IG1vZGUgPSAwbzc3NztcbiAgbGV0IHJlY3Vyc2l2ZSA9IGZhbHNlO1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwibnVtYmVyXCIpIHtcbiAgICBtb2RlID0gb3B0aW9ucztcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJib29sZWFuXCIpIHtcbiAgICByZWN1cnNpdmUgPSBvcHRpb25zO1xuICB9IGVsc2UgaWYgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5yZWN1cnNpdmUgIT09IHVuZGVmaW5lZCkgcmVjdXJzaXZlID0gb3B0aW9ucy5yZWN1cnNpdmU7XG4gICAgaWYgKG9wdGlvbnMubW9kZSAhPT0gdW5kZWZpbmVkKSBtb2RlID0gb3B0aW9ucy5tb2RlO1xuICB9XG4gIHZhbGlkYXRlQm9vbGVhbihyZWN1cnNpdmUsIFwib3B0aW9ucy5yZWN1cnNpdmVcIik7XG5cbiAgRGVuby5ta2RpcihwYXRoLCB7IHJlY3Vyc2l2ZSwgbW9kZSB9KVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgIH1cbiAgICB9LCAoZXJyKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH1cbiAgICB9KTtcbn1cblxuZXhwb3J0IGNvbnN0IG1rZGlyUHJvbWlzZSA9IHByb21pc2lmeShta2RpcikgYXMgKFxuICBwYXRoOiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnM/OiBNa2Rpck9wdGlvbnMsXG4pID0+IFByb21pc2U8dm9pZD47XG5cbmV4cG9ydCBmdW5jdGlvbiBta2RpclN5bmMocGF0aDogc3RyaW5nIHwgVVJMLCBvcHRpb25zPzogTWtkaXJPcHRpb25zKSB7XG4gIHBhdGggPSBnZXRWYWxpZGF0ZWRQYXRoKHBhdGgpIGFzIHN0cmluZztcblxuICBsZXQgbW9kZSA9IDBvNzc3O1xuICBsZXQgcmVjdXJzaXZlID0gZmFsc2U7XG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcIm51bWJlclwiKSB7XG4gICAgbW9kZSA9IG9wdGlvbnM7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgcmVjdXJzaXZlID0gb3B0aW9ucztcbiAgfSBlbHNlIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMucmVjdXJzaXZlICE9PSB1bmRlZmluZWQpIHJlY3Vyc2l2ZSA9IG9wdGlvbnMucmVjdXJzaXZlO1xuICAgIGlmIChvcHRpb25zLm1vZGUgIT09IHVuZGVmaW5lZCkgbW9kZSA9IG9wdGlvbnMubW9kZTtcbiAgfVxuICB2YWxpZGF0ZUJvb2xlYW4ocmVjdXJzaXZlLCBcIm9wdGlvbnMucmVjdXJzaXZlXCIpO1xuXG4gIHRyeSB7XG4gICAgRGVuby5ta2RpclN5bmMocGF0aCwgeyByZWN1cnNpdmUsIG1vZGUgfSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHRocm93IGRlbm9FcnJvclRvTm9kZUVycm9yKGVyciBhcyBFcnJvciwgeyBzeXNjYWxsOiBcIm1rZGlyXCIsIHBhdGggfSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsb0JBQW9CLFFBQVEsd0JBQXdCO0FBQzdELFNBQVMsZ0JBQWdCLFFBQVEsMkJBQTJCO0FBQzVELFNBQVMsZUFBZSxRQUFRLDZCQUE2QjtBQVc3RCxPQUFPLFNBQVMsTUFDZCxJQUFrQixFQUNsQixPQUEwQyxFQUMxQyxRQUE0QixFQUM1QjtJQUNBLE9BQU8saUJBQWlCO0lBRXhCLElBQUksT0FBTztJQUNYLElBQUksWUFBWSxLQUFLO0lBRXJCLElBQUksT0FBTyxXQUFXLFlBQVk7UUFDaEMsV0FBVztJQUNiLE9BQU8sSUFBSSxPQUFPLFlBQVksVUFBVTtRQUN0QyxPQUFPO0lBQ1QsT0FBTyxJQUFJLE9BQU8sWUFBWSxXQUFXO1FBQ3ZDLFlBQVk7SUFDZCxPQUFPLElBQUksU0FBUztRQUNsQixJQUFJLFFBQVEsU0FBUyxLQUFLLFdBQVcsWUFBWSxRQUFRLFNBQVM7UUFDbEUsSUFBSSxRQUFRLElBQUksS0FBSyxXQUFXLE9BQU8sUUFBUSxJQUFJO0lBQ3JELENBQUM7SUFDRCxnQkFBZ0IsV0FBVztJQUUzQixLQUFLLEtBQUssQ0FBQyxNQUFNO1FBQUU7UUFBVztJQUFLLEdBQ2hDLElBQUksQ0FBQyxJQUFNO1FBQ1YsSUFBSSxPQUFPLGFBQWEsWUFBWTtZQUNsQyxTQUFTLElBQUk7UUFDZixDQUFDO0lBQ0gsR0FBRyxDQUFDLE1BQVE7UUFDVixJQUFJLE9BQU8sYUFBYSxZQUFZO1lBQ2xDLFNBQVM7UUFDWCxDQUFDO0lBQ0g7QUFDSixDQUFDO0FBRUQsT0FBTyxNQUFNLGVBQWUsVUFBVSxPQUduQjtBQUVuQixPQUFPLFNBQVMsVUFBVSxJQUFrQixFQUFFLE9BQXNCLEVBQUU7SUFDcEUsT0FBTyxpQkFBaUI7SUFFeEIsSUFBSSxPQUFPO0lBQ1gsSUFBSSxZQUFZLEtBQUs7SUFFckIsSUFBSSxPQUFPLFlBQVksVUFBVTtRQUMvQixPQUFPO0lBQ1QsT0FBTyxJQUFJLE9BQU8sWUFBWSxXQUFXO1FBQ3ZDLFlBQVk7SUFDZCxPQUFPLElBQUksU0FBUztRQUNsQixJQUFJLFFBQVEsU0FBUyxLQUFLLFdBQVcsWUFBWSxRQUFRLFNBQVM7UUFDbEUsSUFBSSxRQUFRLElBQUksS0FBSyxXQUFXLE9BQU8sUUFBUSxJQUFJO0lBQ3JELENBQUM7SUFDRCxnQkFBZ0IsV0FBVztJQUUzQixJQUFJO1FBQ0YsS0FBSyxTQUFTLENBQUMsTUFBTTtZQUFFO1lBQVc7UUFBSztJQUN6QyxFQUFFLE9BQU8sS0FBSztRQUNaLE1BQU0scUJBQXFCLEtBQWM7WUFBRSxTQUFTO1lBQVM7UUFBSyxHQUFHO0lBQ3ZFO0FBQ0YsQ0FBQyJ9