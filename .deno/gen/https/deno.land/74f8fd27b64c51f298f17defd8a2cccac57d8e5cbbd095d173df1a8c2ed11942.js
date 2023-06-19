// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import Dir from "./_fs_dir.ts";
import { getOptions, getValidatedPath } from "../internal/fs/utils.mjs";
import { denoErrorToNodeError } from "../internal/errors.ts";
import { validateFunction, validateInteger } from "../internal/validators.mjs";
import { promisify } from "../internal/util.mjs";
function _validateFunction(callback) {
    validateFunction(callback, "callback");
}
/** @link https://nodejs.org/api/fs.html#fsopendirsyncpath-options */ export function opendir(path, options, callback) {
    callback = typeof options === "function" ? options : callback;
    _validateFunction(callback);
    path = getValidatedPath(path).toString();
    let err, dir;
    try {
        const { bufferSize  } = getOptions(options, {
            encoding: "utf8",
            bufferSize: 32
        });
        validateInteger(bufferSize, "options.bufferSize", 1, 4294967295);
        /** Throws if path is invalid */ Deno.readDirSync(path);
        dir = new Dir(path);
    } catch (error) {
        err = denoErrorToNodeError(error, {
            syscall: "opendir"
        });
    }
    if (err) {
        callback(err);
    } else {
        callback(null, dir);
    }
}
/** @link https://nodejs.org/api/fs.html#fspromisesopendirpath-options */ export const opendirPromise = promisify(opendir);
export function opendirSync(path, options) {
    path = getValidatedPath(path).toString();
    const { bufferSize  } = getOptions(options, {
        encoding: "utf8",
        bufferSize: 32
    });
    validateInteger(bufferSize, "options.bufferSize", 1, 4294967295);
    try {
        /** Throws if path is invalid */ Deno.readDirSync(path);
        return new Dir(path);
    } catch (err) {
        throw denoErrorToNodeError(err, {
            syscall: "opendir"
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19vcGVuZGlyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCBEaXIgZnJvbSBcIi4vX2ZzX2Rpci50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgZ2V0T3B0aW9ucywgZ2V0VmFsaWRhdGVkUGF0aCB9IGZyb20gXCIuLi9pbnRlcm5hbC9mcy91dGlscy5tanNcIjtcbmltcG9ydCB7IGRlbm9FcnJvclRvTm9kZUVycm9yIH0gZnJvbSBcIi4uL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVGdW5jdGlvbiwgdmFsaWRhdGVJbnRlZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxuLyoqIFRoZXNlIG9wdGlvbnMgYXJlbid0IGZ1bmNpdG9uYWxseSB1c2VkIHJpZ2h0IG5vdywgYXMgYERpcmAgZG9lc24ndCB5ZXQgc3VwcG9ydCB0aGVtLlxuICogSG93ZXZlciwgdGhlc2UgdmFsdWVzIGFyZSBzdGlsbCB2YWxpZGF0ZWQuXG4gKi9cbnR5cGUgT3B0aW9ucyA9IHtcbiAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIGJ1ZmZlclNpemU/OiBudW1iZXI7XG59O1xudHlwZSBDYWxsYmFjayA9IChlcnI/OiBFcnJvciB8IG51bGwsIGRpcj86IERpcikgPT4gdm9pZDtcblxuZnVuY3Rpb24gX3ZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2s6IHVua25vd24pOiBhc3NlcnRzIGNhbGxiYWNrIGlzIENhbGxiYWNrIHtcbiAgdmFsaWRhdGVGdW5jdGlvbihjYWxsYmFjaywgXCJjYWxsYmFja1wiKTtcbn1cblxuLyoqIEBsaW5rIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvZnMuaHRtbCNmc29wZW5kaXJzeW5jcGF0aC1vcHRpb25zICovXG5leHBvcnQgZnVuY3Rpb24gb3BlbmRpcihcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBvcHRpb25zOiBPcHRpb25zIHwgQ2FsbGJhY2ssXG4gIGNhbGxiYWNrPzogQ2FsbGJhY2ssXG4pIHtcbiAgY2FsbGJhY2sgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucyA6IGNhbGxiYWNrO1xuICBfdmFsaWRhdGVGdW5jdGlvbihjYWxsYmFjayk7XG5cbiAgcGF0aCA9IGdldFZhbGlkYXRlZFBhdGgocGF0aCkudG9TdHJpbmcoKTtcblxuICBsZXQgZXJyLCBkaXI7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBidWZmZXJTaXplIH0gPSBnZXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgIGVuY29kaW5nOiBcInV0ZjhcIixcbiAgICAgIGJ1ZmZlclNpemU6IDMyLFxuICAgIH0pO1xuICAgIHZhbGlkYXRlSW50ZWdlcihidWZmZXJTaXplLCBcIm9wdGlvbnMuYnVmZmVyU2l6ZVwiLCAxLCA0Mjk0OTY3Mjk1KTtcblxuICAgIC8qKiBUaHJvd3MgaWYgcGF0aCBpcyBpbnZhbGlkICovXG4gICAgRGVuby5yZWFkRGlyU3luYyhwYXRoKTtcblxuICAgIGRpciA9IG5ldyBEaXIocGF0aCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgZXJyID0gZGVub0Vycm9yVG9Ob2RlRXJyb3IoZXJyb3IgYXMgRXJyb3IsIHsgc3lzY2FsbDogXCJvcGVuZGlyXCIgfSk7XG4gIH1cbiAgaWYgKGVycikge1xuICAgIGNhbGxiYWNrKGVycik7XG4gIH0gZWxzZSB7XG4gICAgY2FsbGJhY2sobnVsbCwgZGlyKTtcbiAgfVxufVxuXG4vKiogQGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9mcy5odG1sI2ZzcHJvbWlzZXNvcGVuZGlycGF0aC1vcHRpb25zICovXG5leHBvcnQgY29uc3Qgb3BlbmRpclByb21pc2UgPSBwcm9taXNpZnkob3BlbmRpcikgYXMgKFxuICBwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gIG9wdGlvbnM/OiBPcHRpb25zLFxuKSA9PiBQcm9taXNlPERpcj47XG5cbmV4cG9ydCBmdW5jdGlvbiBvcGVuZGlyU3luYyhcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBvcHRpb25zPzogT3B0aW9ucyxcbik6IERpciB7XG4gIHBhdGggPSBnZXRWYWxpZGF0ZWRQYXRoKHBhdGgpLnRvU3RyaW5nKCk7XG5cbiAgY29uc3QgeyBidWZmZXJTaXplIH0gPSBnZXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICBlbmNvZGluZzogXCJ1dGY4XCIsXG4gICAgYnVmZmVyU2l6ZTogMzIsXG4gIH0pO1xuXG4gIHZhbGlkYXRlSW50ZWdlcihidWZmZXJTaXplLCBcIm9wdGlvbnMuYnVmZmVyU2l6ZVwiLCAxLCA0Mjk0OTY3Mjk1KTtcblxuICB0cnkge1xuICAgIC8qKiBUaHJvd3MgaWYgcGF0aCBpcyBpbnZhbGlkICovXG4gICAgRGVuby5yZWFkRGlyU3luYyhwYXRoKTtcblxuICAgIHJldHVybiBuZXcgRGlyKHBhdGgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB0aHJvdyBkZW5vRXJyb3JUb05vZGVFcnJvcihlcnIgYXMgRXJyb3IsIHsgc3lzY2FsbDogXCJvcGVuZGlyXCIgfSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUsT0FBTyxTQUFTLGVBQWU7QUFFL0IsU0FBUyxVQUFVLEVBQUUsZ0JBQWdCLFFBQVEsMkJBQTJCO0FBQ3hFLFNBQVMsb0JBQW9CLFFBQVEsd0JBQXdCO0FBQzdELFNBQVMsZ0JBQWdCLEVBQUUsZUFBZSxRQUFRLDZCQUE2QjtBQUMvRSxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFXakQsU0FBUyxrQkFBa0IsUUFBaUIsRUFBZ0M7SUFDMUUsaUJBQWlCLFVBQVU7QUFDN0I7QUFFQSxtRUFBbUUsR0FDbkUsT0FBTyxTQUFTLFFBQ2QsSUFBMkIsRUFDM0IsT0FBMkIsRUFDM0IsUUFBbUIsRUFDbkI7SUFDQSxXQUFXLE9BQU8sWUFBWSxhQUFhLFVBQVUsUUFBUTtJQUM3RCxrQkFBa0I7SUFFbEIsT0FBTyxpQkFBaUIsTUFBTSxRQUFRO0lBRXRDLElBQUksS0FBSztJQUNULElBQUk7UUFDRixNQUFNLEVBQUUsV0FBVSxFQUFFLEdBQUcsV0FBVyxTQUFTO1lBQ3pDLFVBQVU7WUFDVixZQUFZO1FBQ2Q7UUFDQSxnQkFBZ0IsWUFBWSxzQkFBc0IsR0FBRztRQUVyRCw4QkFBOEIsR0FDOUIsS0FBSyxXQUFXLENBQUM7UUFFakIsTUFBTSxJQUFJLElBQUk7SUFDaEIsRUFBRSxPQUFPLE9BQU87UUFDZCxNQUFNLHFCQUFxQixPQUFnQjtZQUFFLFNBQVM7UUFBVTtJQUNsRTtJQUNBLElBQUksS0FBSztRQUNQLFNBQVM7SUFDWCxPQUFPO1FBQ0wsU0FBUyxJQUFJLEVBQUU7SUFDakIsQ0FBQztBQUNILENBQUM7QUFFRCx1RUFBdUUsR0FDdkUsT0FBTyxNQUFNLGlCQUFpQixVQUFVLFNBR3RCO0FBRWxCLE9BQU8sU0FBUyxZQUNkLElBQTJCLEVBQzNCLE9BQWlCLEVBQ1o7SUFDTCxPQUFPLGlCQUFpQixNQUFNLFFBQVE7SUFFdEMsTUFBTSxFQUFFLFdBQVUsRUFBRSxHQUFHLFdBQVcsU0FBUztRQUN6QyxVQUFVO1FBQ1YsWUFBWTtJQUNkO0lBRUEsZ0JBQWdCLFlBQVksc0JBQXNCLEdBQUc7SUFFckQsSUFBSTtRQUNGLDhCQUE4QixHQUM5QixLQUFLLFdBQVcsQ0FBQztRQUVqQixPQUFPLElBQUksSUFBSTtJQUNqQixFQUFFLE9BQU8sS0FBSztRQUNaLE1BQU0scUJBQXFCLEtBQWM7WUFBRSxTQUFTO1FBQVUsR0FBRztJQUNuRTtBQUNGLENBQUMifQ==