// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { emitRecursiveRmdirWarning, getValidatedPath, validateRmdirOptions, validateRmOptions, validateRmOptionsSync } from "../internal/fs/utils.mjs";
import { toNamespacedPath } from "../path.ts";
import { denoErrorToNodeError, ERR_FS_RMDIR_ENOTDIR } from "../internal/errors.ts";
import { promisify } from "../internal/util.mjs";
export function rmdir(path, optionsOrCallback, maybeCallback) {
    path = toNamespacedPath(getValidatedPath(path));
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : undefined;
    if (!callback) throw new Error("No callback function supplied");
    if (options?.recursive) {
        emitRecursiveRmdirWarning();
        validateRmOptions(path, {
            ...options,
            force: false
        }, true, (err, options)=>{
            if (err === false) {
                return callback(new ERR_FS_RMDIR_ENOTDIR(path.toString()));
            }
            if (err) {
                return callback(err);
            }
            Deno.remove(path, {
                recursive: options?.recursive
            }).then((_)=>callback(), callback);
        });
    } else {
        validateRmdirOptions(options);
        Deno.remove(path, {
            recursive: options?.recursive
        }).then((_)=>callback(), (err)=>{
            callback(err instanceof Error ? denoErrorToNodeError(err, {
                syscall: "rmdir"
            }) : err);
        });
    }
}
export const rmdirPromise = promisify(rmdir);
export function rmdirSync(path, options) {
    path = getValidatedPath(path);
    if (options?.recursive) {
        emitRecursiveRmdirWarning();
        options = validateRmOptionsSync(path, {
            ...options,
            force: false
        }, true);
        if (options === false) {
            throw new ERR_FS_RMDIR_ENOTDIR(path.toString());
        }
    } else {
        validateRmdirOptions(options);
    }
    try {
        Deno.removeSync(toNamespacedPath(path), {
            recursive: options?.recursive
        });
    } catch (err) {
        throw err instanceof Error ? denoErrorToNodeError(err, {
            syscall: "rmdir"
        }) : err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19ybWRpci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHtcbiAgZW1pdFJlY3Vyc2l2ZVJtZGlyV2FybmluZyxcbiAgZ2V0VmFsaWRhdGVkUGF0aCxcbiAgdmFsaWRhdGVSbWRpck9wdGlvbnMsXG4gIHZhbGlkYXRlUm1PcHRpb25zLFxuICB2YWxpZGF0ZVJtT3B0aW9uc1N5bmMsXG59IGZyb20gXCIuLi9pbnRlcm5hbC9mcy91dGlscy5tanNcIjtcbmltcG9ydCB7IHRvTmFtZXNwYWNlZFBhdGggfSBmcm9tIFwiLi4vcGF0aC50c1wiO1xuaW1wb3J0IHtcbiAgZGVub0Vycm9yVG9Ob2RlRXJyb3IsXG4gIEVSUl9GU19STURJUl9FTk9URElSLFxufSBmcm9tIFwiLi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxudHlwZSBybWRpck9wdGlvbnMgPSB7XG4gIG1heFJldHJpZXM/OiBudW1iZXI7XG4gIHJlY3Vyc2l2ZT86IGJvb2xlYW47XG4gIHJldHJ5RGVsYXk/OiBudW1iZXI7XG59O1xuXG50eXBlIHJtZGlyQ2FsbGJhY2sgPSAoZXJyPzogRXJyb3IpID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBybWRpcihwYXRoOiBzdHJpbmcgfCBVUkwsIGNhbGxiYWNrOiBybWRpckNhbGxiYWNrKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBybWRpcihcbiAgcGF0aDogc3RyaW5nIHwgVVJMLFxuICBvcHRpb25zOiBybWRpck9wdGlvbnMsXG4gIGNhbGxiYWNrOiBybWRpckNhbGxiYWNrLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBybWRpcihcbiAgcGF0aDogc3RyaW5nIHwgVVJMLFxuICBvcHRpb25zT3JDYWxsYmFjazogcm1kaXJPcHRpb25zIHwgcm1kaXJDYWxsYmFjayxcbiAgbWF5YmVDYWxsYmFjaz86IHJtZGlyQ2FsbGJhY2ssXG4pIHtcbiAgcGF0aCA9IHRvTmFtZXNwYWNlZFBhdGgoZ2V0VmFsaWRhdGVkUGF0aChwYXRoKSBhcyBzdHJpbmcpO1xuXG4gIGNvbnN0IGNhbGxiYWNrID0gdHlwZW9mIG9wdGlvbnNPckNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCJcbiAgICA/IG9wdGlvbnNPckNhbGxiYWNrXG4gICAgOiBtYXliZUNhbGxiYWNrO1xuICBjb25zdCBvcHRpb25zID0gdHlwZW9mIG9wdGlvbnNPckNhbGxiYWNrID09PSBcIm9iamVjdFwiXG4gICAgPyBvcHRpb25zT3JDYWxsYmFja1xuICAgIDogdW5kZWZpbmVkO1xuXG4gIGlmICghY2FsbGJhY2spIHRocm93IG5ldyBFcnJvcihcIk5vIGNhbGxiYWNrIGZ1bmN0aW9uIHN1cHBsaWVkXCIpO1xuXG4gIGlmIChvcHRpb25zPy5yZWN1cnNpdmUpIHtcbiAgICBlbWl0UmVjdXJzaXZlUm1kaXJXYXJuaW5nKCk7XG4gICAgdmFsaWRhdGVSbU9wdGlvbnMoXG4gICAgICBwYXRoLFxuICAgICAgeyAuLi5vcHRpb25zLCBmb3JjZTogZmFsc2UgfSxcbiAgICAgIHRydWUsXG4gICAgICAoZXJyOiBFcnJvciB8IG51bGwgfCBmYWxzZSwgb3B0aW9uczogcm1kaXJPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChlcnIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFUlJfRlNfUk1ESVJfRU5PVERJUihwYXRoLnRvU3RyaW5nKCkpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBEZW5vLnJlbW92ZShwYXRoLCB7IHJlY3Vyc2l2ZTogb3B0aW9ucz8ucmVjdXJzaXZlIH0pXG4gICAgICAgICAgLnRoZW4oKF8pID0+IGNhbGxiYWNrKCksIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICB2YWxpZGF0ZVJtZGlyT3B0aW9ucyhvcHRpb25zKTtcbiAgICBEZW5vLnJlbW92ZShwYXRoLCB7IHJlY3Vyc2l2ZTogb3B0aW9ucz8ucmVjdXJzaXZlIH0pXG4gICAgICAudGhlbigoXykgPT4gY2FsbGJhY2soKSwgKGVycjogdW5rbm93bikgPT4ge1xuICAgICAgICBjYWxsYmFjayhcbiAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvclxuICAgICAgICAgICAgPyBkZW5vRXJyb3JUb05vZGVFcnJvcihlcnIsIHsgc3lzY2FsbDogXCJybWRpclwiIH0pXG4gICAgICAgICAgICA6IGVycixcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBybWRpclByb21pc2UgPSBwcm9taXNpZnkocm1kaXIpIGFzIChcbiAgcGF0aDogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICBvcHRpb25zPzogcm1kaXJPcHRpb25zLFxuKSA9PiBQcm9taXNlPHZvaWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gcm1kaXJTeW5jKHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCwgb3B0aW9ucz86IHJtZGlyT3B0aW9ucykge1xuICBwYXRoID0gZ2V0VmFsaWRhdGVkUGF0aChwYXRoKTtcbiAgaWYgKG9wdGlvbnM/LnJlY3Vyc2l2ZSkge1xuICAgIGVtaXRSZWN1cnNpdmVSbWRpcldhcm5pbmcoKTtcbiAgICBvcHRpb25zID0gdmFsaWRhdGVSbU9wdGlvbnNTeW5jKHBhdGgsIHsgLi4ub3B0aW9ucywgZm9yY2U6IGZhbHNlIH0sIHRydWUpO1xuICAgIGlmIChvcHRpb25zID09PSBmYWxzZSkge1xuICAgICAgdGhyb3cgbmV3IEVSUl9GU19STURJUl9FTk9URElSKHBhdGgudG9TdHJpbmcoKSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhbGlkYXRlUm1kaXJPcHRpb25zKG9wdGlvbnMpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBEZW5vLnJlbW92ZVN5bmModG9OYW1lc3BhY2VkUGF0aChwYXRoIGFzIHN0cmluZyksIHtcbiAgICAgIHJlY3Vyc2l2ZTogb3B0aW9ucz8ucmVjdXJzaXZlLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnI6IHVua25vd24pIHtcbiAgICB0aHJvdyAoZXJyIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgID8gZGVub0Vycm9yVG9Ob2RlRXJyb3IoZXJyLCB7IHN5c2NhbGw6IFwicm1kaXJcIiB9KVxuICAgICAgOiBlcnIpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQ0UseUJBQXlCLEVBQ3pCLGdCQUFnQixFQUNoQixvQkFBb0IsRUFDcEIsaUJBQWlCLEVBQ2pCLHFCQUFxQixRQUNoQiwyQkFBMkI7QUFDbEMsU0FBUyxnQkFBZ0IsUUFBUSxhQUFhO0FBQzlDLFNBQ0Usb0JBQW9CLEVBQ3BCLG9CQUFvQixRQUNmLHdCQUF3QjtBQUUvQixTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFnQmpELE9BQU8sU0FBUyxNQUNkLElBQWtCLEVBQ2xCLGlCQUErQyxFQUMvQyxhQUE2QixFQUM3QjtJQUNBLE9BQU8saUJBQWlCLGlCQUFpQjtJQUV6QyxNQUFNLFdBQVcsT0FBTyxzQkFBc0IsYUFDMUMsb0JBQ0EsYUFBYTtJQUNqQixNQUFNLFVBQVUsT0FBTyxzQkFBc0IsV0FDekMsb0JBQ0EsU0FBUztJQUViLElBQUksQ0FBQyxVQUFVLE1BQU0sSUFBSSxNQUFNLGlDQUFpQztJQUVoRSxJQUFJLFNBQVMsV0FBVztRQUN0QjtRQUNBLGtCQUNFLE1BQ0E7WUFBRSxHQUFHLE9BQU87WUFBRSxPQUFPLEtBQUs7UUFBQyxHQUMzQixJQUFJLEVBQ0osQ0FBQyxLQUEyQixVQUEwQjtZQUNwRCxJQUFJLFFBQVEsS0FBSyxFQUFFO2dCQUNqQixPQUFPLFNBQVMsSUFBSSxxQkFBcUIsS0FBSyxRQUFRO1lBQ3hELENBQUM7WUFDRCxJQUFJLEtBQUs7Z0JBQ1AsT0FBTyxTQUFTO1lBQ2xCLENBQUM7WUFFRCxLQUFLLE1BQU0sQ0FBQyxNQUFNO2dCQUFFLFdBQVcsU0FBUztZQUFVLEdBQy9DLElBQUksQ0FBQyxDQUFDLElBQU0sWUFBWTtRQUM3QjtJQUVKLE9BQU87UUFDTCxxQkFBcUI7UUFDckIsS0FBSyxNQUFNLENBQUMsTUFBTTtZQUFFLFdBQVcsU0FBUztRQUFVLEdBQy9DLElBQUksQ0FBQyxDQUFDLElBQU0sWUFBWSxDQUFDLE1BQWlCO1lBQ3pDLFNBQ0UsZUFBZSxRQUNYLHFCQUFxQixLQUFLO2dCQUFFLFNBQVM7WUFBUSxLQUM3QyxHQUFHO1FBRVg7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVELE9BQU8sTUFBTSxlQUFlLFVBQVUsT0FHbkI7QUFFbkIsT0FBTyxTQUFTLFVBQVUsSUFBMkIsRUFBRSxPQUFzQixFQUFFO0lBQzdFLE9BQU8saUJBQWlCO0lBQ3hCLElBQUksU0FBUyxXQUFXO1FBQ3RCO1FBQ0EsVUFBVSxzQkFBc0IsTUFBTTtZQUFFLEdBQUcsT0FBTztZQUFFLE9BQU8sS0FBSztRQUFDLEdBQUcsSUFBSTtRQUN4RSxJQUFJLFlBQVksS0FBSyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxxQkFBcUIsS0FBSyxRQUFRLElBQUk7UUFDbEQsQ0FBQztJQUNILE9BQU87UUFDTCxxQkFBcUI7SUFDdkIsQ0FBQztJQUVELElBQUk7UUFDRixLQUFLLFVBQVUsQ0FBQyxpQkFBaUIsT0FBaUI7WUFDaEQsV0FBVyxTQUFTO1FBQ3RCO0lBQ0YsRUFBRSxPQUFPLEtBQWM7UUFDckIsTUFBTyxlQUFlLFFBQ2xCLHFCQUFxQixLQUFLO1lBQUUsU0FBUztRQUFRLEtBQzdDLEdBQUcsQ0FBRTtJQUNYO0FBQ0YsQ0FBQyJ9