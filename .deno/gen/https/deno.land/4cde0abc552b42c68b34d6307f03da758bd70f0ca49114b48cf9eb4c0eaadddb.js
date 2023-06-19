// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { makeCallback } from "./_fs_common.ts";
import { getValidatedPath, kMaxUserId } from "../internal/fs/utils.mjs";
import * as pathModule from "../../path/mod.ts";
import { validateInteger } from "../internal/validators.mjs";
import { promisify } from "../internal/util.mjs";
/**
 * Asynchronously changes the owner and group
 * of a file.
 */ export function chown(path, uid, gid, callback) {
    callback = makeCallback(callback);
    path = getValidatedPath(path).toString();
    validateInteger(uid, "uid", -1, kMaxUserId);
    validateInteger(gid, "gid", -1, kMaxUserId);
    Deno.chown(pathModule.toNamespacedPath(path), uid, gid).then(()=>callback(null), callback);
}
export const chownPromise = promisify(chown);
/**
 * Synchronously changes the owner and group
 * of a file.
 */ export function chownSync(path, uid, gid) {
    path = getValidatedPath(path).toString();
    validateInteger(uid, "uid", -1, kMaxUserId);
    validateInteger(gid, "gid", -1, kMaxUserId);
    Deno.chownSync(pathModule.toNamespacedPath(path), uid, gid);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19jaG93bi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgdHlwZSBDYWxsYmFja1dpdGhFcnJvciwgbWFrZUNhbGxiYWNrIH0gZnJvbSBcIi4vX2ZzX2NvbW1vbi50c1wiO1xuaW1wb3J0IHsgZ2V0VmFsaWRhdGVkUGF0aCwga01heFVzZXJJZCB9IGZyb20gXCIuLi9pbnRlcm5hbC9mcy91dGlscy5tanNcIjtcbmltcG9ydCAqIGFzIHBhdGhNb2R1bGUgZnJvbSBcIi4uLy4uL3BhdGgvbW9kLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUludGVnZXIgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB0eXBlIHsgQnVmZmVyIH0gZnJvbSBcIi4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSBcIi4uL2ludGVybmFsL3V0aWwubWpzXCI7XG5cbi8qKlxuICogQXN5bmNocm9ub3VzbHkgY2hhbmdlcyB0aGUgb3duZXIgYW5kIGdyb3VwXG4gKiBvZiBhIGZpbGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaG93bihcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICB1aWQ6IG51bWJlcixcbiAgZ2lkOiBudW1iZXIsXG4gIGNhbGxiYWNrOiBDYWxsYmFja1dpdGhFcnJvcixcbikge1xuICBjYWxsYmFjayA9IG1ha2VDYWxsYmFjayhjYWxsYmFjayk7XG4gIHBhdGggPSBnZXRWYWxpZGF0ZWRQYXRoKHBhdGgpLnRvU3RyaW5nKCk7XG4gIHZhbGlkYXRlSW50ZWdlcih1aWQsIFwidWlkXCIsIC0xLCBrTWF4VXNlcklkKTtcbiAgdmFsaWRhdGVJbnRlZ2VyKGdpZCwgXCJnaWRcIiwgLTEsIGtNYXhVc2VySWQpO1xuXG4gIERlbm8uY2hvd24ocGF0aE1vZHVsZS50b05hbWVzcGFjZWRQYXRoKHBhdGgpLCB1aWQsIGdpZCkudGhlbihcbiAgICAoKSA9PiBjYWxsYmFjayhudWxsKSxcbiAgICBjYWxsYmFjayxcbiAgKTtcbn1cblxuZXhwb3J0IGNvbnN0IGNob3duUHJvbWlzZSA9IHByb21pc2lmeShjaG93bikgYXMgKFxuICBwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gIHVpZDogbnVtYmVyLFxuICBnaWQ6IG51bWJlcixcbikgPT4gUHJvbWlzZTx2b2lkPjtcblxuLyoqXG4gKiBTeW5jaHJvbm91c2x5IGNoYW5nZXMgdGhlIG93bmVyIGFuZCBncm91cFxuICogb2YgYSBmaWxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hvd25TeW5jKFxuICBwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gIHVpZDogbnVtYmVyLFxuICBnaWQ6IG51bWJlcixcbikge1xuICBwYXRoID0gZ2V0VmFsaWRhdGVkUGF0aChwYXRoKS50b1N0cmluZygpO1xuICB2YWxpZGF0ZUludGVnZXIodWlkLCBcInVpZFwiLCAtMSwga01heFVzZXJJZCk7XG4gIHZhbGlkYXRlSW50ZWdlcihnaWQsIFwiZ2lkXCIsIC0xLCBrTWF4VXNlcklkKTtcblxuICBEZW5vLmNob3duU3luYyhwYXRoTW9kdWxlLnRvTmFtZXNwYWNlZFBhdGgocGF0aCksIHVpZCwgZ2lkKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FBaUMsWUFBWSxRQUFRLGtCQUFrQjtBQUN2RSxTQUFTLGdCQUFnQixFQUFFLFVBQVUsUUFBUSwyQkFBMkI7QUFDeEUsWUFBWSxnQkFBZ0Isb0JBQW9CO0FBQ2hELFNBQVMsZUFBZSxRQUFRLDZCQUE2QjtBQUU3RCxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7OztDQUdDLEdBQ0QsT0FBTyxTQUFTLE1BQ2QsSUFBMkIsRUFDM0IsR0FBVyxFQUNYLEdBQVcsRUFDWCxRQUEyQixFQUMzQjtJQUNBLFdBQVcsYUFBYTtJQUN4QixPQUFPLGlCQUFpQixNQUFNLFFBQVE7SUFDdEMsZ0JBQWdCLEtBQUssT0FBTyxDQUFDLEdBQUc7SUFDaEMsZ0JBQWdCLEtBQUssT0FBTyxDQUFDLEdBQUc7SUFFaEMsS0FBSyxLQUFLLENBQUMsV0FBVyxnQkFBZ0IsQ0FBQyxPQUFPLEtBQUssS0FBSyxJQUFJLENBQzFELElBQU0sU0FBUyxJQUFJLEdBQ25CO0FBRUosQ0FBQztBQUVELE9BQU8sTUFBTSxlQUFlLFVBQVUsT0FJbkI7QUFFbkI7OztDQUdDLEdBQ0QsT0FBTyxTQUFTLFVBQ2QsSUFBMkIsRUFDM0IsR0FBVyxFQUNYLEdBQVcsRUFDWDtJQUNBLE9BQU8saUJBQWlCLE1BQU0sUUFBUTtJQUN0QyxnQkFBZ0IsS0FBSyxPQUFPLENBQUMsR0FBRztJQUNoQyxnQkFBZ0IsS0FBSyxPQUFPLENBQUMsR0FBRztJQUVoQyxLQUFLLFNBQVMsQ0FBQyxXQUFXLGdCQUFnQixDQUFDLE9BQU8sS0FBSztBQUN6RCxDQUFDIn0=