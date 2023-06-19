// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { makeCallback } from "./_fs_common.ts";
import { fs } from "../internal_binding/constants.ts";
import { codeMap } from "../internal_binding/uv.ts";
import { getValidatedPath, getValidMode } from "../internal/fs/utils.mjs";
import { promisify } from "../internal/util.mjs";
export function access(path, mode, callback) {
    if (typeof mode === "function") {
        callback = mode;
        mode = fs.F_OK;
    }
    path = getValidatedPath(path).toString();
    mode = getValidMode(mode, "access");
    const cb = makeCallback(callback);
    Deno.lstat(path).then((info)=>{
        if (info.mode === null) {
            // If the file mode is unavailable, we pretend it has
            // the permission
            cb(null);
            return;
        }
        const m = +mode || 0;
        let fileMode = +info.mode || 0;
        if (Deno.build.os !== "windows" && info.uid === Deno.uid()) {
            // If the user is the owner of the file, then use the owner bits of
            // the file permission
            fileMode >>= 6;
        }
        // TODO(kt3k): Also check the case when the user belong to the group
        // of the file
        if ((m & fileMode) === m) {
            // all required flags exist
            cb(null);
        } else {
            // some required flags don't
            // deno-lint-ignore no-explicit-any
            const e = new Error(`EACCES: permission denied, access '${path}'`);
            e.path = path;
            e.syscall = "access";
            e.errno = codeMap.get("EACCES");
            e.code = "EACCES";
            cb(e);
        }
    }, (err)=>{
        if (err instanceof Deno.errors.NotFound) {
            // deno-lint-ignore no-explicit-any
            const e = new Error(`ENOENT: no such file or directory, access '${path}'`);
            e.path = path;
            e.syscall = "access";
            e.errno = codeMap.get("ENOENT");
            e.code = "ENOENT";
            cb(e);
        } else {
            cb(err);
        }
    });
}
export const accessPromise = promisify(access);
export function accessSync(path, mode) {
    path = getValidatedPath(path).toString();
    mode = getValidMode(mode, "access");
    try {
        const info = Deno.lstatSync(path.toString());
        if (info.mode === null) {
            // If the file mode is unavailable, we pretend it has
            // the permission
            return;
        }
        const m = +mode || 0;
        let fileMode = +info.mode || 0;
        if (Deno.build.os !== "windows" && info.uid === Deno.uid()) {
            // If the user is the owner of the file, then use the owner bits of
            // the file permission
            fileMode >>= 6;
        }
        // TODO(kt3k): Also check the case when the user belong to the group
        // of the file
        if ((m & fileMode) === m) {
        // all required flags exist
        } else {
            // some required flags don't
            // deno-lint-ignore no-explicit-any
            const e = new Error(`EACCES: permission denied, access '${path}'`);
            e.path = path;
            e.syscall = "access";
            e.errno = codeMap.get("EACCES");
            e.code = "EACCES";
            throw e;
        }
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            // deno-lint-ignore no-explicit-any
            const e1 = new Error(`ENOENT: no such file or directory, access '${path}'`);
            e1.path = path;
            e1.syscall = "access";
            e1.errno = codeMap.get("ENOENT");
            e1.code = "ENOENT";
            throw e1;
        } else {
            throw err;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19hY2Nlc3MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgdHlwZSBDYWxsYmFja1dpdGhFcnJvciwgbWFrZUNhbGxiYWNrIH0gZnJvbSBcIi4vX2ZzX2NvbW1vbi50c1wiO1xuaW1wb3J0IHsgZnMgfSBmcm9tIFwiLi4vaW50ZXJuYWxfYmluZGluZy9jb25zdGFudHMudHNcIjtcbmltcG9ydCB7IGNvZGVNYXAgfSBmcm9tIFwiLi4vaW50ZXJuYWxfYmluZGluZy91di50c1wiO1xuaW1wb3J0IHsgZ2V0VmFsaWRhdGVkUGF0aCwgZ2V0VmFsaWRNb2RlIH0gZnJvbSBcIi4uL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuaW1wb3J0IHR5cGUgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFjY2VzcyhcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBtb2RlOiBudW1iZXIgfCBDYWxsYmFja1dpdGhFcnJvcixcbiAgY2FsbGJhY2s/OiBDYWxsYmFja1dpdGhFcnJvcixcbikge1xuICBpZiAodHlwZW9mIG1vZGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNhbGxiYWNrID0gbW9kZTtcbiAgICBtb2RlID0gZnMuRl9PSztcbiAgfVxuXG4gIHBhdGggPSBnZXRWYWxpZGF0ZWRQYXRoKHBhdGgpLnRvU3RyaW5nKCk7XG4gIG1vZGUgPSBnZXRWYWxpZE1vZGUobW9kZSwgXCJhY2Nlc3NcIik7XG4gIGNvbnN0IGNiID0gbWFrZUNhbGxiYWNrKGNhbGxiYWNrKTtcblxuICBEZW5vLmxzdGF0KHBhdGgpLnRoZW4oKGluZm8pID0+IHtcbiAgICBpZiAoaW5mby5tb2RlID09PSBudWxsKSB7XG4gICAgICAvLyBJZiB0aGUgZmlsZSBtb2RlIGlzIHVuYXZhaWxhYmxlLCB3ZSBwcmV0ZW5kIGl0IGhhc1xuICAgICAgLy8gdGhlIHBlcm1pc3Npb25cbiAgICAgIGNiKG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBtID0gK21vZGUgfHwgMDtcbiAgICBsZXQgZmlsZU1vZGUgPSAraW5mby5tb2RlIHx8IDA7XG4gICAgaWYgKERlbm8uYnVpbGQub3MgIT09IFwid2luZG93c1wiICYmIGluZm8udWlkID09PSBEZW5vLnVpZCgpKSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBpcyB0aGUgb3duZXIgb2YgdGhlIGZpbGUsIHRoZW4gdXNlIHRoZSBvd25lciBiaXRzIG9mXG4gICAgICAvLyB0aGUgZmlsZSBwZXJtaXNzaW9uXG4gICAgICBmaWxlTW9kZSA+Pj0gNjtcbiAgICB9XG4gICAgLy8gVE9ETyhrdDNrKTogQWxzbyBjaGVjayB0aGUgY2FzZSB3aGVuIHRoZSB1c2VyIGJlbG9uZyB0byB0aGUgZ3JvdXBcbiAgICAvLyBvZiB0aGUgZmlsZVxuICAgIGlmICgobSAmIGZpbGVNb2RlKSA9PT0gbSkge1xuICAgICAgLy8gYWxsIHJlcXVpcmVkIGZsYWdzIGV4aXN0XG4gICAgICBjYihudWxsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc29tZSByZXF1aXJlZCBmbGFncyBkb24ndFxuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGNvbnN0IGU6IGFueSA9IG5ldyBFcnJvcihgRUFDQ0VTOiBwZXJtaXNzaW9uIGRlbmllZCwgYWNjZXNzICcke3BhdGh9J2ApO1xuICAgICAgZS5wYXRoID0gcGF0aDtcbiAgICAgIGUuc3lzY2FsbCA9IFwiYWNjZXNzXCI7XG4gICAgICBlLmVycm5vID0gY29kZU1hcC5nZXQoXCJFQUNDRVNcIik7XG4gICAgICBlLmNvZGUgPSBcIkVBQ0NFU1wiO1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9LCAoZXJyKSA9PiB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgY29uc3QgZTogYW55ID0gbmV3IEVycm9yKFxuICAgICAgICBgRU5PRU5UOiBubyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5LCBhY2Nlc3MgJyR7cGF0aH0nYCxcbiAgICAgICk7XG4gICAgICBlLnBhdGggPSBwYXRoO1xuICAgICAgZS5zeXNjYWxsID0gXCJhY2Nlc3NcIjtcbiAgICAgIGUuZXJybm8gPSBjb2RlTWFwLmdldChcIkVOT0VOVFwiKTtcbiAgICAgIGUuY29kZSA9IFwiRU5PRU5UXCI7XG4gICAgICBjYihlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoZXJyKTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgY29uc3QgYWNjZXNzUHJvbWlzZSA9IHByb21pc2lmeShhY2Nlc3MpIGFzIChcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBtb2RlPzogbnVtYmVyLFxuKSA9PiBQcm9taXNlPHZvaWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gYWNjZXNzU3luYyhwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsIG1vZGU/OiBudW1iZXIpIHtcbiAgcGF0aCA9IGdldFZhbGlkYXRlZFBhdGgocGF0aCkudG9TdHJpbmcoKTtcbiAgbW9kZSA9IGdldFZhbGlkTW9kZShtb2RlLCBcImFjY2Vzc1wiKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBpbmZvID0gRGVuby5sc3RhdFN5bmMocGF0aC50b1N0cmluZygpKTtcbiAgICBpZiAoaW5mby5tb2RlID09PSBudWxsKSB7XG4gICAgICAvLyBJZiB0aGUgZmlsZSBtb2RlIGlzIHVuYXZhaWxhYmxlLCB3ZSBwcmV0ZW5kIGl0IGhhc1xuICAgICAgLy8gdGhlIHBlcm1pc3Npb25cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbSA9ICttb2RlISB8fCAwO1xuICAgIGxldCBmaWxlTW9kZSA9ICtpbmZvLm1vZGUhIHx8IDA7XG4gICAgaWYgKERlbm8uYnVpbGQub3MgIT09IFwid2luZG93c1wiICYmIGluZm8udWlkID09PSBEZW5vLnVpZCgpKSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBpcyB0aGUgb3duZXIgb2YgdGhlIGZpbGUsIHRoZW4gdXNlIHRoZSBvd25lciBiaXRzIG9mXG4gICAgICAvLyB0aGUgZmlsZSBwZXJtaXNzaW9uXG4gICAgICBmaWxlTW9kZSA+Pj0gNjtcbiAgICB9XG4gICAgLy8gVE9ETyhrdDNrKTogQWxzbyBjaGVjayB0aGUgY2FzZSB3aGVuIHRoZSB1c2VyIGJlbG9uZyB0byB0aGUgZ3JvdXBcbiAgICAvLyBvZiB0aGUgZmlsZVxuICAgIGlmICgobSAmIGZpbGVNb2RlKSA9PT0gbSkge1xuICAgICAgLy8gYWxsIHJlcXVpcmVkIGZsYWdzIGV4aXN0XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNvbWUgcmVxdWlyZWQgZmxhZ3MgZG9uJ3RcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBjb25zdCBlOiBhbnkgPSBuZXcgRXJyb3IoYEVBQ0NFUzogcGVybWlzc2lvbiBkZW5pZWQsIGFjY2VzcyAnJHtwYXRofSdgKTtcbiAgICAgIGUucGF0aCA9IHBhdGg7XG4gICAgICBlLnN5c2NhbGwgPSBcImFjY2Vzc1wiO1xuICAgICAgZS5lcnJubyA9IGNvZGVNYXAuZ2V0KFwiRUFDQ0VTXCIpO1xuICAgICAgZS5jb2RlID0gXCJFQUNDRVNcIjtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBjb25zdCBlOiBhbnkgPSBuZXcgRXJyb3IoXG4gICAgICAgIGBFTk9FTlQ6IG5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnksIGFjY2VzcyAnJHtwYXRofSdgLFxuICAgICAgKTtcbiAgICAgIGUucGF0aCA9IHBhdGg7XG4gICAgICBlLnN5c2NhbGwgPSBcImFjY2Vzc1wiO1xuICAgICAgZS5lcnJubyA9IGNvZGVNYXAuZ2V0KFwiRU5PRU5UXCIpO1xuICAgICAgZS5jb2RlID0gXCJFTk9FTlRcIjtcbiAgICAgIHRocm93IGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUsU0FBaUMsWUFBWSxRQUFRLGtCQUFrQjtBQUN2RSxTQUFTLEVBQUUsUUFBUSxtQ0FBbUM7QUFDdEQsU0FBUyxPQUFPLFFBQVEsNEJBQTRCO0FBQ3BELFNBQVMsZ0JBQWdCLEVBQUUsWUFBWSxRQUFRLDJCQUEyQjtBQUUxRSxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQsT0FBTyxTQUFTLE9BQ2QsSUFBMkIsRUFDM0IsSUFBZ0MsRUFDaEMsUUFBNEIsRUFDNUI7SUFDQSxJQUFJLE9BQU8sU0FBUyxZQUFZO1FBQzlCLFdBQVc7UUFDWCxPQUFPLEdBQUcsSUFBSTtJQUNoQixDQUFDO0lBRUQsT0FBTyxpQkFBaUIsTUFBTSxRQUFRO0lBQ3RDLE9BQU8sYUFBYSxNQUFNO0lBQzFCLE1BQU0sS0FBSyxhQUFhO0lBRXhCLEtBQUssS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBUztRQUM5QixJQUFJLEtBQUssSUFBSSxLQUFLLElBQUksRUFBRTtZQUN0QixxREFBcUQ7WUFDckQsaUJBQWlCO1lBQ2pCLEdBQUcsSUFBSTtZQUNQO1FBQ0YsQ0FBQztRQUNELE1BQU0sSUFBSSxDQUFDLFFBQVE7UUFDbkIsSUFBSSxXQUFXLENBQUMsS0FBSyxJQUFJLElBQUk7UUFDN0IsSUFBSSxLQUFLLEtBQUssQ0FB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