// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { asyncIterableToCallback } from "./_fs_watch.ts";
import Dirent from "./_fs_dirent.ts";
import { denoErrorToNodeError } from "../internal/errors.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import { promisify } from "../internal/util.mjs";
function toDirent(val) {
    return new Dirent(val);
}
export function readdir(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : null;
    const result = [];
    path = getValidatedPath(path);
    if (!callback) throw new Error("No callback function supplied");
    if (options?.encoding) {
        try {
            new TextDecoder(options.encoding);
        } catch  {
            throw new Error(`TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value "${options.encoding}" is invalid for option "encoding"`);
        }
    }
    try {
        asyncIterableToCallback(Deno.readDir(path.toString()), (val, done)=>{
            if (typeof path !== "string") return;
            if (done) {
                callback(null, result);
                return;
            }
            if (options?.withFileTypes) {
                result.push(toDirent(val));
            } else result.push(decode(val.name));
        }, (e)=>{
            callback(denoErrorToNodeError(e, {
                syscall: "readdir"
            }));
        });
    } catch (e) {
        callback(denoErrorToNodeError(e, {
            syscall: "readdir"
        }));
    }
}
function decode(str, encoding) {
    if (!encoding) return str;
    else {
        const decoder = new TextDecoder(encoding);
        const encoder = new TextEncoder();
        return decoder.decode(encoder.encode(str));
    }
}
export const readdirPromise = promisify(readdir);
export function readdirSync(path, options) {
    const result = [];
    path = getValidatedPath(path);
    if (options?.encoding) {
        try {
            new TextDecoder(options.encoding);
        } catch  {
            throw new Error(`TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value "${options.encoding}" is invalid for option "encoding"`);
        }
    }
    try {
        for (const file of Deno.readDirSync(path.toString())){
            if (options?.withFileTypes) {
                result.push(toDirent(file));
            } else result.push(decode(file.name));
        }
    } catch (e) {
        throw denoErrorToNodeError(e, {
            syscall: "readdir"
        });
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19yZWFkZGlyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBhc3luY0l0ZXJhYmxlVG9DYWxsYmFjayB9IGZyb20gXCIuL19mc193YXRjaC50c1wiO1xuaW1wb3J0IERpcmVudCBmcm9tIFwiLi9fZnNfZGlyZW50LnRzXCI7XG5pbXBvcnQgeyBkZW5vRXJyb3JUb05vZGVFcnJvciB9IGZyb20gXCIuLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IGdldFZhbGlkYXRlZFBhdGggfSBmcm9tIFwiLi4vaW50ZXJuYWwvZnMvdXRpbHMubWpzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxuZnVuY3Rpb24gdG9EaXJlbnQodmFsOiBEZW5vLkRpckVudHJ5KTogRGlyZW50IHtcbiAgcmV0dXJuIG5ldyBEaXJlbnQodmFsKTtcbn1cblxudHlwZSByZWFkRGlyT3B0aW9ucyA9IHtcbiAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIHdpdGhGaWxlVHlwZXM/OiBib29sZWFuO1xufTtcblxudHlwZSByZWFkRGlyQ2FsbGJhY2sgPSAoZXJyOiBFcnJvciB8IG51bGwsIGZpbGVzOiBzdHJpbmdbXSkgPT4gdm9pZDtcblxudHlwZSByZWFkRGlyQ2FsbGJhY2tEaXJlbnQgPSAoZXJyOiBFcnJvciB8IG51bGwsIGZpbGVzOiBEaXJlbnRbXSkgPT4gdm9pZDtcblxudHlwZSByZWFkRGlyQm90aCA9IChcbiAgLi4uYXJnczogW0Vycm9yXSB8IFtudWxsLCBzdHJpbmdbXSB8IERpcmVudFtdIHwgQXJyYXk8c3RyaW5nIHwgRGlyZW50Pl1cbikgPT4gdm9pZDtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRkaXIoXG4gIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzPzogZmFsc2U7IGVuY29kaW5nPzogc3RyaW5nIH0sXG4gIGNhbGxiYWNrOiByZWFkRGlyQ2FsbGJhY2ssXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRkaXIoXG4gIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlOyBlbmNvZGluZz86IHN0cmluZyB9LFxuICBjYWxsYmFjazogcmVhZERpckNhbGxiYWNrRGlyZW50LFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZWFkZGlyKHBhdGg6IHN0cmluZyB8IFVSTCwgY2FsbGJhY2s6IHJlYWREaXJDYWxsYmFjayk6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpcihcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBvcHRpb25zT3JDYWxsYmFjazogcmVhZERpck9wdGlvbnMgfCByZWFkRGlyQ2FsbGJhY2sgfCByZWFkRGlyQ2FsbGJhY2tEaXJlbnQsXG4gIG1heWJlQ2FsbGJhY2s/OiByZWFkRGlyQ2FsbGJhY2sgfCByZWFkRGlyQ2FsbGJhY2tEaXJlbnQsXG4pIHtcbiAgY29uc3QgY2FsbGJhY2sgPVxuICAgICh0eXBlb2Ygb3B0aW9uc09yQ2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgPyBvcHRpb25zT3JDYWxsYmFja1xuICAgICAgOiBtYXliZUNhbGxiYWNrKSBhcyByZWFkRGlyQm90aCB8IHVuZGVmaW5lZDtcbiAgY29uc3Qgb3B0aW9ucyA9IHR5cGVvZiBvcHRpb25zT3JDYWxsYmFjayA9PT0gXCJvYmplY3RcIlxuICAgID8gb3B0aW9uc09yQ2FsbGJhY2tcbiAgICA6IG51bGw7XG4gIGNvbnN0IHJlc3VsdDogQXJyYXk8c3RyaW5nIHwgRGlyZW50PiA9IFtdO1xuICBwYXRoID0gZ2V0VmFsaWRhdGVkUGF0aChwYXRoKTtcblxuICBpZiAoIWNhbGxiYWNrKSB0aHJvdyBuZXcgRXJyb3IoXCJObyBjYWxsYmFjayBmdW5jdGlvbiBzdXBwbGllZFwiKTtcblxuICBpZiAob3B0aW9ucz8uZW5jb2RpbmcpIHtcbiAgICB0cnkge1xuICAgICAgbmV3IFRleHREZWNvZGVyKG9wdGlvbnMuZW5jb2RpbmcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVHlwZUVycm9yIFtFUlJfSU5WQUxJRF9PUFRfVkFMVUVfRU5DT0RJTkddOiBUaGUgdmFsdWUgXCIke29wdGlvbnMuZW5jb2Rpbmd9XCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwiZW5jb2RpbmdcImAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgYXN5bmNJdGVyYWJsZVRvQ2FsbGJhY2soRGVuby5yZWFkRGlyKHBhdGgudG9TdHJpbmcoKSksICh2YWwsIGRvbmUpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gXCJzdHJpbmdcIikgcmV0dXJuO1xuICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnM/LndpdGhGaWxlVHlwZXMpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godG9EaXJlbnQodmFsKSk7XG4gICAgICB9IGVsc2UgcmVzdWx0LnB1c2goZGVjb2RlKHZhbC5uYW1lKSk7XG4gICAgfSwgKGUpID0+IHtcbiAgICAgIGNhbGxiYWNrKGRlbm9FcnJvclRvTm9kZUVycm9yKGUgYXMgRXJyb3IsIHsgc3lzY2FsbDogXCJyZWFkZGlyXCIgfSkpO1xuICAgIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY2FsbGJhY2soZGVub0Vycm9yVG9Ob2RlRXJyb3IoZSBhcyBFcnJvciwgeyBzeXNjYWxsOiBcInJlYWRkaXJcIiB9KSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVjb2RlKHN0cjogc3RyaW5nLCBlbmNvZGluZz86IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghZW5jb2RpbmcpIHJldHVybiBzdHI7XG4gIGVsc2Uge1xuICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoZW5jb2RpbmcpO1xuICAgIGNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgICByZXR1cm4gZGVjb2Rlci5kZWNvZGUoZW5jb2Rlci5lbmNvZGUoc3RyKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHJlYWRkaXJQcm9taXNlID0gcHJvbWlzaWZ5KHJlYWRkaXIpIGFzIChcbiAgJiAoKHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCwgb3B0aW9uczoge1xuICAgIHdpdGhGaWxlVHlwZXM6IHRydWU7XG4gICAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIH0pID0+IFByb21pc2U8RGlyZW50W10+KVxuICAmICgocGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLCBvcHRpb25zPzoge1xuICAgIHdpdGhGaWxlVHlwZXM/OiBmYWxzZTtcbiAgICBlbmNvZGluZz86IHN0cmluZztcbiAgfSkgPT4gUHJvbWlzZTxzdHJpbmdbXT4pXG4pO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpclN5bmMoXG4gIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlOyBlbmNvZGluZz86IHN0cmluZyB9LFxuKTogRGlyZW50W107XG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpclN5bmMoXG4gIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgb3B0aW9ucz86IHsgd2l0aEZpbGVUeXBlcz86IGZhbHNlOyBlbmNvZGluZz86IHN0cmluZyB9LFxuKTogc3RyaW5nW107XG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpclN5bmMoXG4gIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgb3B0aW9ucz86IHJlYWREaXJPcHRpb25zLFxuKTogQXJyYXk8c3RyaW5nIHwgRGlyZW50PiB7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBwYXRoID0gZ2V0VmFsaWRhdGVkUGF0aChwYXRoKTtcblxuICBpZiAob3B0aW9ucz8uZW5jb2RpbmcpIHtcbiAgICB0cnkge1xuICAgICAgbmV3IFRleHREZWNvZGVyKG9wdGlvbnMuZW5jb2RpbmcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVHlwZUVycm9yIFtFUlJfSU5WQUxJRF9PUFRfVkFMVUVfRU5DT0RJTkddOiBUaGUgdmFsdWUgXCIke29wdGlvbnMuZW5jb2Rpbmd9XCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwiZW5jb2RpbmdcImAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIERlbm8ucmVhZERpclN5bmMocGF0aC50b1N0cmluZygpKSkge1xuICAgICAgaWYgKG9wdGlvbnM/LndpdGhGaWxlVHlwZXMpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godG9EaXJlbnQoZmlsZSkpO1xuICAgICAgfSBlbHNlIHJlc3VsdC5wdXNoKGRlY29kZShmaWxlLm5hbWUpKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBkZW5vRXJyb3JUb05vZGVFcnJvcihlIGFzIEVycm9yLCB7IHN5c2NhbGw6IFwicmVhZGRpclwiIH0pO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQVMsdUJBQXVCLFFBQVEsaUJBQWlCO0FBQ3pELE9BQU8sWUFBWSxrQkFBa0I7QUFDckMsU0FBUyxvQkFBb0IsUUFBUSx3QkFBd0I7QUFDN0QsU0FBUyxnQkFBZ0IsUUFBUSwyQkFBMkI7QUFFNUQsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBRWpELFNBQVMsU0FBUyxHQUFrQixFQUFVO0lBQzVDLE9BQU8sSUFBSSxPQUFPO0FBQ3BCO0FBMEJBLE9BQU8sU0FBUyxRQUNkLElBQTJCLEVBQzNCLGlCQUEyRSxFQUMzRSxhQUF1RCxFQUN2RDtJQUNBLE1BQU0sV0FDSCxPQUFPLHNCQUFzQixhQUMxQixvQkFDQSxhQUFhO0lBQ25CLE1BQU0sVUFBVSxPQUFPLHNCQUFzQixXQUN6QyxvQkFDQSxJQUFJO0lBQ1IsTUFBTSxTQUFpQyxFQUFFO0lBQ3pDLE9BQU8saUJBQWlCO0lBRXhCLElBQUksQ0FBQyxVQUFVLE1BQU0sSUFBSSxNQUFNLGlDQUFpQztJQUVoRSxJQUFJLFNBQVMsVUFBVTtRQUNyQixJQUFJO1lBQ0YsSUFBSSxZQUFZLFFBQVEsUUFBUTtRQUNsQyxFQUFFLE9BQU07WUFDTixNQUFNLElBQUksTUFDUixDQUFDLHVEQUF1RCxFQUFFLFFBQVEsUUFBUSxDQUFDLGtDQUFrQyxDQUFDLEVBQzlHO1FBQ0o7SUFDRixDQUFDO0lBRUQsSUFBSTtRQUNGLHdCQUF3QixLQUFLLE9BQU8sQ0FBQyxLQUFLLFFBQVEsS0FBSyxDQUFDLEtBQUssT0FBUztZQUNwRSxJQUFJLE9BQU8sU0FBUyxVQUFVO1lBQzlCLElBQUksTUFBTTtnQkFDUixTQUFTLElBQUksRUFBRTtnQkFDZjtZQUNGLENBQUM7WUFDRCxJQUFJLFNBQVMsZUFBZTtnQkFDMUIsT0FBTyxJQUFJLENBQUMsU0FBUztZQUN2QixPQUFPLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJO1FBQ3BDLEdBQUcsQ0FBQyxJQUFNO1lBQ1IsU0FBUyxxQkFBcUIsR0FBWTtnQkFBRSxTQUFTO1lBQVU7UUFDakU7SUFDRixFQUFFLE9BQU8sR0FBRztRQUNWLFNBQVMscUJBQXFCLEdBQVk7WUFBRSxTQUFTO1FBQVU7SUFDakU7QUFDRixDQUFDO0FBRUQsU0FBUyxPQUFPLEdBQVcsRUFBRSxRQUFpQixFQUFVO0lBQ3RELElBQUksQ0FBQyxVQUFVLE9BQU87U0FDakI7UUFDSCxNQUFNLFVBQVUsSUFBSSxZQUFZO1FBQ2hDLE1BQU0sVUFBVSxJQUFJO1FBQ3BCLE9BQU8sUUFBUSxNQUFNLENBQUMsUUFBUSxNQUFNLENBQUM7SUFDdkMsQ0FBQztBQUNIO0FBRUEsT0FBTyxNQUFNLGlCQUFpQixVQUFVLFNBU3RDO0FBVUYsT0FBTyxTQUFTLFlBQ2QsSUFBMkIsRUFDM0IsT0FBd0IsRUFDQTtJQUN4QixNQUFNLFNBQVMsRUFBRTtJQUNqQixPQUFPLGlCQUFpQjtJQUV4QixJQUFJLFNBQVMsVUFBVTtRQUNyQixJQUFJO1lBQ0YsSUFBSSxZQUFZLFFBQVEsUUFBUTtRQUNsQyxFQUFFLE9BQU07WUFDTixNQUFNLElBQUksTUFDUixDQUFDLHVEQUF1RCxFQUFFLFFBQVEsUUFBUSxDQUFDLGtDQUFrQyxDQUFDLEVBQzlHO1FBQ0o7SUFDRixDQUFDO0lBRUQsSUFBSTtRQUNGLEtBQUssTUFBTSxRQUFRLEtBQUssV0FBVyxDQUFDLEtBQUssUUFBUSxJQUFLO1lBQ3BELElBQUksU0FBUyxlQUFlO2dCQUMxQixPQUFPLElBQUksQ0FBQyxTQUFTO1lBQ3ZCLE9BQU8sT0FBTyxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUk7UUFDckM7SUFDRixFQUFFLE9BQU8sR0FBRztRQUNWLE1BQU0scUJBQXFCLEdBQVk7WUFBRSxTQUFTO1FBQVUsR0FBRztJQUNqRTtJQUNBLE9BQU87QUFDVCxDQUFDIn0=