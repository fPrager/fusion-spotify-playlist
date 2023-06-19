// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { fromFileUrl } from "../path.ts";
import { Buffer } from "../buffer.ts";
import { writeAllSync } from "../../streams/write_all.ts";
import { checkEncoding, getEncoding, getOpenOptions, isFileOptions } from "./_fs_common.ts";
import { isWindows } from "../../_util/os.ts";
import { AbortError, denoErrorToNodeError } from "../internal/errors.ts";
import { showStringCoercionDeprecation, validateStringAfterArrayBufferView } from "../internal/fs/utils.mjs";
import { promisify } from "../internal/util.mjs";
export function writeFile(pathOrRid, // deno-lint-ignore ban-types
data, optOrCallback, callback) {
    const callbackFn = optOrCallback instanceof Function ? optOrCallback : callback;
    const options = optOrCallback instanceof Function ? undefined : optOrCallback;
    if (!callbackFn) {
        throw new TypeError("Callback must be a function.");
    }
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl(pathOrRid) : pathOrRid;
    const flag = isFileOptions(options) ? options.flag : undefined;
    const mode = isFileOptions(options) ? options.mode : undefined;
    const encoding = checkEncoding(getEncoding(options)) || "utf8";
    const openOptions = getOpenOptions(flag || "w");
    if (!ArrayBuffer.isView(data)) {
        validateStringAfterArrayBufferView(data, "data");
        if (typeof data !== "string") {
            showStringCoercionDeprecation();
        }
        data = Buffer.from(String(data), encoding);
    }
    const isRid = typeof pathOrRid === "number";
    let file;
    let error = null;
    (async ()=>{
        try {
            file = isRid ? new Deno.FsFile(pathOrRid) : await Deno.open(pathOrRid, openOptions);
            // ignore mode because it's not supported on windows
            // TODO: remove `!isWindows` when `Deno.chmod` is supported
            if (!isRid && mode && !isWindows) {
                await Deno.chmod(pathOrRid, mode);
            }
            const signal = isFileOptions(options) ? options.signal : undefined;
            await writeAll(file, data, {
                signal
            });
        } catch (e) {
            error = e instanceof Error ? denoErrorToNodeError(e, {
                syscall: "write"
            }) : new Error("[non-error thrown]");
        } finally{
            // Make sure to close resource
            if (!isRid && file) file.close();
            callbackFn(error);
        }
    })();
}
export const writeFilePromise = promisify(writeFile);
export function writeFileSync(pathOrRid, // deno-lint-ignore ban-types
data, options) {
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl(pathOrRid) : pathOrRid;
    const flag = isFileOptions(options) ? options.flag : undefined;
    const mode = isFileOptions(options) ? options.mode : undefined;
    const encoding = checkEncoding(getEncoding(options)) || "utf8";
    const openOptions = getOpenOptions(flag || "w");
    if (!ArrayBuffer.isView(data)) {
        validateStringAfterArrayBufferView(data, "data");
        if (typeof data !== "string") {
            showStringCoercionDeprecation();
        }
        data = Buffer.from(String(data), encoding);
    }
    const isRid = typeof pathOrRid === "number";
    let file;
    let error = null;
    try {
        file = isRid ? new Deno.FsFile(pathOrRid) : Deno.openSync(pathOrRid, openOptions);
        // ignore mode because it's not supported on windows
        // TODO: remove `!isWindows` when `Deno.chmod` is supported
        if (!isRid && mode && !isWindows) {
            Deno.chmodSync(pathOrRid, mode);
        }
        writeAllSync(file, data);
    } catch (e) {
        error = e instanceof Error ? denoErrorToNodeError(e, {
            syscall: "write"
        }) : new Error("[non-error thrown]");
    } finally{
        // Make sure to close resource
        if (!isRid && file) file.close();
    }
    if (error) throw error;
}
async function writeAll(w, arr, options = {}) {
    const { offset =0 , length =arr.byteLength , signal  } = options;
    checkAborted(signal);
    const written = await w.write(arr.subarray(offset, offset + length));
    if (written === length) {
        return;
    }
    await writeAll(w, arr, {
        offset: offset + written,
        length: length - written,
        signal
    });
}
function checkAborted(signal) {
    if (signal?.aborted) {
        throw new AbortError();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc193cml0ZUZpbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IEVuY29kaW5ncyB9IGZyb20gXCIuLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IGZyb21GaWxlVXJsIH0gZnJvbSBcIi4uL3BhdGgudHNcIjtcbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IHdyaXRlQWxsU3luYyB9IGZyb20gXCIuLi8uLi9zdHJlYW1zL3dyaXRlX2FsbC50c1wiO1xuaW1wb3J0IHtcbiAgQ2FsbGJhY2tXaXRoRXJyb3IsXG4gIGNoZWNrRW5jb2RpbmcsXG4gIGdldEVuY29kaW5nLFxuICBnZXRPcGVuT3B0aW9ucyxcbiAgaXNGaWxlT3B0aW9ucyxcbiAgV3JpdGVGaWxlT3B0aW9ucyxcbn0gZnJvbSBcIi4vX2ZzX2NvbW1vbi50c1wiO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSBcIi4uLy4uL191dGlsL29zLnRzXCI7XG5pbXBvcnQgeyBBYm9ydEVycm9yLCBkZW5vRXJyb3JUb05vZGVFcnJvciB9IGZyb20gXCIuLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7XG4gIHNob3dTdHJpbmdDb2VyY2lvbkRlcHJlY2F0aW9uLFxuICB2YWxpZGF0ZVN0cmluZ0FmdGVyQXJyYXlCdWZmZXJWaWV3LFxufSBmcm9tIFwiLi4vaW50ZXJuYWwvZnMvdXRpbHMubWpzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRmlsZShcbiAgcGF0aE9yUmlkOiBzdHJpbmcgfCBudW1iZXIgfCBVUkwsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gIGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBPYmplY3QsXG4gIG9wdE9yQ2FsbGJhY2s6IEVuY29kaW5ncyB8IENhbGxiYWNrV2l0aEVycm9yIHwgV3JpdGVGaWxlT3B0aW9ucyB8IHVuZGVmaW5lZCxcbiAgY2FsbGJhY2s/OiBDYWxsYmFja1dpdGhFcnJvcixcbikge1xuICBjb25zdCBjYWxsYmFja0ZuOiBDYWxsYmFja1dpdGhFcnJvciB8IHVuZGVmaW5lZCA9XG4gICAgb3B0T3JDYWxsYmFjayBpbnN0YW5jZW9mIEZ1bmN0aW9uID8gb3B0T3JDYWxsYmFjayA6IGNhbGxiYWNrO1xuICBjb25zdCBvcHRpb25zOiBFbmNvZGluZ3MgfCBXcml0ZUZpbGVPcHRpb25zIHwgdW5kZWZpbmVkID1cbiAgICBvcHRPckNhbGxiYWNrIGluc3RhbmNlb2YgRnVuY3Rpb24gPyB1bmRlZmluZWQgOiBvcHRPckNhbGxiYWNrO1xuXG4gIGlmICghY2FsbGJhY2tGbikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24uXCIpO1xuICB9XG5cbiAgcGF0aE9yUmlkID0gcGF0aE9yUmlkIGluc3RhbmNlb2YgVVJMID8gZnJvbUZpbGVVcmwocGF0aE9yUmlkKSA6IHBhdGhPclJpZDtcblxuICBjb25zdCBmbGFnOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBpc0ZpbGVPcHRpb25zKG9wdGlvbnMpXG4gICAgPyBvcHRpb25zLmZsYWdcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBtb2RlOiBudW1iZXIgfCB1bmRlZmluZWQgPSBpc0ZpbGVPcHRpb25zKG9wdGlvbnMpXG4gICAgPyBvcHRpb25zLm1vZGVcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBlbmNvZGluZyA9IGNoZWNrRW5jb2RpbmcoZ2V0RW5jb2Rpbmcob3B0aW9ucykpIHx8IFwidXRmOFwiO1xuICBjb25zdCBvcGVuT3B0aW9ucyA9IGdldE9wZW5PcHRpb25zKGZsYWcgfHwgXCJ3XCIpO1xuXG4gIGlmICghQXJyYXlCdWZmZXIuaXNWaWV3KGRhdGEpKSB7XG4gICAgdmFsaWRhdGVTdHJpbmdBZnRlckFycmF5QnVmZmVyVmlldyhkYXRhLCBcImRhdGFcIik7XG4gICAgaWYgKHR5cGVvZiBkYXRhICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICBzaG93U3RyaW5nQ29lcmNpb25EZXByZWNhdGlvbigpO1xuICAgIH1cbiAgICBkYXRhID0gQnVmZmVyLmZyb20oU3RyaW5nKGRhdGEpLCBlbmNvZGluZyk7XG4gIH1cblxuICBjb25zdCBpc1JpZCA9IHR5cGVvZiBwYXRoT3JSaWQgPT09IFwibnVtYmVyXCI7XG4gIGxldCBmaWxlO1xuXG4gIGxldCBlcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcbiAgKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgZmlsZSA9IGlzUmlkXG4gICAgICAgID8gbmV3IERlbm8uRnNGaWxlKHBhdGhPclJpZCBhcyBudW1iZXIpXG4gICAgICAgIDogYXdhaXQgRGVuby5vcGVuKHBhdGhPclJpZCBhcyBzdHJpbmcsIG9wZW5PcHRpb25zKTtcblxuICAgICAgLy8gaWdub3JlIG1vZGUgYmVjYXVzZSBpdCdzIG5vdCBzdXBwb3J0ZWQgb24gd2luZG93c1xuICAgICAgLy8gVE9ETzogcmVtb3ZlIGAhaXNXaW5kb3dzYCB3aGVuIGBEZW5vLmNobW9kYCBpcyBzdXBwb3J0ZWRcbiAgICAgIGlmICghaXNSaWQgJiYgbW9kZSAmJiAhaXNXaW5kb3dzKSB7XG4gICAgICAgIGF3YWl0IERlbm8uY2htb2QocGF0aE9yUmlkIGFzIHN0cmluZywgbW9kZSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNpZ25hbDogQWJvcnRTaWduYWwgfCB1bmRlZmluZWQgPSBpc0ZpbGVPcHRpb25zKG9wdGlvbnMpXG4gICAgICAgID8gb3B0aW9ucy5zaWduYWxcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICBhd2FpdCB3cml0ZUFsbChmaWxlLCBkYXRhIGFzIFVpbnQ4QXJyYXksIHsgc2lnbmFsIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9yID0gZSBpbnN0YW5jZW9mIEVycm9yXG4gICAgICAgID8gZGVub0Vycm9yVG9Ob2RlRXJyb3IoZSwgeyBzeXNjYWxsOiBcIndyaXRlXCIgfSlcbiAgICAgICAgOiBuZXcgRXJyb3IoXCJbbm9uLWVycm9yIHRocm93bl1cIik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIC8vIE1ha2Ugc3VyZSB0byBjbG9zZSByZXNvdXJjZVxuICAgICAgaWYgKCFpc1JpZCAmJiBmaWxlKSBmaWxlLmNsb3NlKCk7XG4gICAgICBjYWxsYmFja0ZuKGVycm9yKTtcbiAgICB9XG4gIH0pKCk7XG59XG5cbmV4cG9ydCBjb25zdCB3cml0ZUZpbGVQcm9taXNlID0gcHJvbWlzaWZ5KHdyaXRlRmlsZSkgYXMgKFxuICBwYXRoT3JSaWQ6IHN0cmluZyB8IG51bWJlciB8IFVSTCxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSB8IE9iamVjdCxcbiAgb3B0aW9ucz86IEVuY29kaW5ncyB8IFdyaXRlRmlsZU9wdGlvbnMsXG4pID0+IFByb21pc2U8dm9pZD47XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpbGVTeW5jKFxuICBwYXRoT3JSaWQ6IHN0cmluZyB8IG51bWJlciB8IFVSTCxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSB8IE9iamVjdCxcbiAgb3B0aW9ucz86IEVuY29kaW5ncyB8IFdyaXRlRmlsZU9wdGlvbnMsXG4pIHtcbiAgcGF0aE9yUmlkID0gcGF0aE9yUmlkIGluc3RhbmNlb2YgVVJMID8gZnJvbUZpbGVVcmwocGF0aE9yUmlkKSA6IHBhdGhPclJpZDtcblxuICBjb25zdCBmbGFnOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBpc0ZpbGVPcHRpb25zKG9wdGlvbnMpXG4gICAgPyBvcHRpb25zLmZsYWdcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBtb2RlOiBudW1iZXIgfCB1bmRlZmluZWQgPSBpc0ZpbGVPcHRpb25zKG9wdGlvbnMpXG4gICAgPyBvcHRpb25zLm1vZGVcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBlbmNvZGluZyA9IGNoZWNrRW5jb2RpbmcoZ2V0RW5jb2Rpbmcob3B0aW9ucykpIHx8IFwidXRmOFwiO1xuICBjb25zdCBvcGVuT3B0aW9ucyA9IGdldE9wZW5PcHRpb25zKGZsYWcgfHwgXCJ3XCIpO1xuXG4gIGlmICghQXJyYXlCdWZmZXIuaXNWaWV3KGRhdGEpKSB7XG4gICAgdmFsaWRhdGVTdHJpbmdBZnRlckFycmF5QnVmZmVyVmlldyhkYXRhLCBcImRhdGFcIik7XG4gICAgaWYgKHR5cGVvZiBkYXRhICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICBzaG93U3RyaW5nQ29lcmNpb25EZXByZWNhdGlvbigpO1xuICAgIH1cbiAgICBkYXRhID0gQnVmZmVyLmZyb20oU3RyaW5nKGRhdGEpLCBlbmNvZGluZyk7XG4gIH1cblxuICBjb25zdCBpc1JpZCA9IHR5cGVvZiBwYXRoT3JSaWQgPT09IFwibnVtYmVyXCI7XG4gIGxldCBmaWxlO1xuXG4gIGxldCBlcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBmaWxlID0gaXNSaWRcbiAgICAgID8gbmV3IERlbm8uRnNGaWxlKHBhdGhPclJpZCBhcyBudW1iZXIpXG4gICAgICA6IERlbm8ub3BlblN5bmMocGF0aE9yUmlkIGFzIHN0cmluZywgb3Blbk9wdGlvbnMpO1xuXG4gICAgLy8gaWdub3JlIG1vZGUgYmVjYXVzZSBpdCdzIG5vdCBzdXBwb3J0ZWQgb24gd2luZG93c1xuICAgIC8vIFRPRE86IHJlbW92ZSBgIWlzV2luZG93c2Agd2hlbiBgRGVuby5jaG1vZGAgaXMgc3VwcG9ydGVkXG4gICAgaWYgKCFpc1JpZCAmJiBtb2RlICYmICFpc1dpbmRvd3MpIHtcbiAgICAgIERlbm8uY2htb2RTeW5jKHBhdGhPclJpZCBhcyBzdHJpbmcsIG1vZGUpO1xuICAgIH1cblxuICAgIHdyaXRlQWxsU3luYyhmaWxlLCBkYXRhIGFzIFVpbnQ4QXJyYXkpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZXJyb3IgPSBlIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgID8gZGVub0Vycm9yVG9Ob2RlRXJyb3IoZSwgeyBzeXNjYWxsOiBcIndyaXRlXCIgfSlcbiAgICAgIDogbmV3IEVycm9yKFwiW25vbi1lcnJvciB0aHJvd25dXCIpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIE1ha2Ugc3VyZSB0byBjbG9zZSByZXNvdXJjZVxuICAgIGlmICghaXNSaWQgJiYgZmlsZSkgZmlsZS5jbG9zZSgpO1xuICB9XG5cbiAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbn1cblxuaW50ZXJmYWNlIFdyaXRlQWxsT3B0aW9ucyB7XG4gIG9mZnNldD86IG51bWJlcjtcbiAgbGVuZ3RoPzogbnVtYmVyO1xuICBzaWduYWw/OiBBYm9ydFNpZ25hbDtcbn1cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlQWxsKFxuICB3OiBEZW5vLldyaXRlcixcbiAgYXJyOiBVaW50OEFycmF5LFxuICBvcHRpb25zOiBXcml0ZUFsbE9wdGlvbnMgPSB7fSxcbikge1xuICBjb25zdCB7IG9mZnNldCA9IDAsIGxlbmd0aCA9IGFyci5ieXRlTGVuZ3RoLCBzaWduYWwgfSA9IG9wdGlvbnM7XG4gIGNoZWNrQWJvcnRlZChzaWduYWwpO1xuXG4gIGNvbnN0IHdyaXR0ZW4gPSBhd2FpdCB3LndyaXRlKGFyci5zdWJhcnJheShvZmZzZXQsIG9mZnNldCArIGxlbmd0aCkpO1xuXG4gIGlmICh3cml0dGVuID09PSBsZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBhd2FpdCB3cml0ZUFsbCh3LCBhcnIsIHtcbiAgICBvZmZzZXQ6IG9mZnNldCArIHdyaXR0ZW4sXG4gICAgbGVuZ3RoOiBsZW5ndGggLSB3cml0dGVuLFxuICAgIHNpZ25hbCxcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNoZWNrQWJvcnRlZChzaWduYWw/OiBBYm9ydFNpZ25hbCkge1xuICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgdGhyb3cgbmV3IEFib3J0RXJyb3IoKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxTQUFTLFdBQVcsUUFBUSxhQUFhO0FBQ3pDLFNBQVMsTUFBTSxRQUFRLGVBQWU7QUFDdEMsU0FBUyxZQUFZLFFBQVEsNkJBQTZCO0FBQzFELFNBRUUsYUFBYSxFQUNiLFdBQVcsRUFDWCxjQUFjLEVBQ2QsYUFBYSxRQUVSLGtCQUFrQjtBQUN6QixTQUFTLFNBQVMsUUFBUSxvQkFBb0I7QUFDOUMsU0FBUyxVQUFVLEVBQUUsb0JBQW9CLFFBQVEsd0JBQXdCO0FBQ3pFLFNBQ0UsNkJBQTZCLEVBQzdCLGtDQUFrQyxRQUM3QiwyQkFBMkI7QUFDbEMsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBRWpELE9BQU8sU0FBUyxVQUNkLFNBQWdDLEVBQ2hDLDZCQUE2QjtBQUM3QixJQUFrQyxFQUNsQyxhQUEyRSxFQUMzRSxRQUE0QixFQUM1QjtJQUNBLE1BQU0sYUFDSix5QkFBeUIsV0FBVyxnQkFBZ0IsUUFBUTtJQUM5RCxNQUFNLFVBQ0oseUJBQXlCLFdBQVcsWUFBWSxhQUFhO0lBRS9ELElBQUksQ0FBQyxZQUFZO1FBQ2YsTUFBTSxJQUFJLFVBQVUsZ0NBQWdDO0lBQ3RELENBQUM7SUFFRCxZQUFZLHFCQUFxQixNQUFNLFlBQVksYUFBYSxTQUFTO0lBRXpFLE1BQU0sT0FBMkIsY0FBYyxXQUMzQyxRQUFRLElBQUksR0FDWixTQUFTO0lBRWIsTUFBTSxPQUEyQixjQUFjLFdBQzNDLFFBQVEsSUFBSSxHQUNaLFNBQVM7SUFFYixNQUFNLFdBQVcsY0FBYyxZQUFZLGFBQWE7SUFDeEQsTUFBTSxjQUFjLGVBQWUsUUFBUTtJQUUzQyxJQUFJLENBQUMsWUFBWSxNQUFNLENBQUMsT0FBTztRQUM3QixtQ0FBbUMsTUFBTTtR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