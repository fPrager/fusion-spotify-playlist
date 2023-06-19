// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * Test whether or not the given path exists by checking with the file system.
 *
 * Note: do not use this function if performing a check before another operation on that file. Doing so creates a race condition. Instead, perform the actual file operation directly.
 *
 * Bad:
 * ```ts
 * import { exists } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * if (await exists("./foo.txt")) {
 *   await Deno.remove("./foo.txt");
 * }
 * ```
 *
 * Good:
 * ```ts
 * // Notice no use of exists
 * try {
 *   await Deno.remove("./foo.txt");
 * } catch (error) {
 *   if (!(error instanceof Deno.errors.NotFound)) {
 *     throw error;
 *   }
 *   // Do nothing...
 * }
 * ```
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 * @deprecated (will be removed after 0.157.0) Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 */ export async function exists(filePath) {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
}
/**
 * Test whether or not the given path exists by checking with the file system.
 *
 * Note: do not use this function if performing a check before another operation on that file. Doing so creates a race condition. Instead, perform the actual file operation directly.
 *
 * Bad:
 * ```ts
 * import { existsSync } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * if (existsSync("./foo.txt")) {
 *   Deno.removeSync("./foo.txt");
 * }
 * ```
 *
 * Good:
 * ```ts
 * // Notice no use of existsSync
 * try {
 *   Deno.removeSync("./foo.txt");
 * } catch (error) {
 *   if (!(error instanceof Deno.errors.NotFound)) {
 *     throw error;
 *   }
 *   // Do nothing...
 * }
 * ```
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 * @deprecated (will be removed after 0.157.0) Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 */ export function existsSync(filePath) {
    try {
        Deno.lstatSync(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2ZzL2V4aXN0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKipcbiAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtLlxuICpcbiAqIE5vdGU6IGRvIG5vdCB1c2UgdGhpcyBmdW5jdGlvbiBpZiBwZXJmb3JtaW5nIGEgY2hlY2sgYmVmb3JlIGFub3RoZXIgb3BlcmF0aW9uIG9uIHRoYXQgZmlsZS4gRG9pbmcgc28gY3JlYXRlcyBhIHJhY2UgY29uZGl0aW9uLiBJbnN0ZWFkLCBwZXJmb3JtIHRoZSBhY3R1YWwgZmlsZSBvcGVyYXRpb24gZGlyZWN0bHkuXG4gKlxuICogQmFkOlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGV4aXN0cyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2ZzL21vZC50c1wiO1xuICpcbiAqIGlmIChhd2FpdCBleGlzdHMoXCIuL2Zvby50eHRcIikpIHtcbiAqICAgYXdhaXQgRGVuby5yZW1vdmUoXCIuL2Zvby50eHRcIik7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBHb29kOlxuICogYGBgdHNcbiAqIC8vIE5vdGljZSBubyB1c2Ugb2YgZXhpc3RzXG4gKiB0cnkge1xuICogICBhd2FpdCBEZW5vLnJlbW92ZShcIi4vZm9vLnR4dFwiKTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmICghKGVycm9yIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpKSB7XG4gKiAgICAgdGhyb3cgZXJyb3I7XG4gKiAgIH1cbiAqICAgLy8gRG8gbm90aGluZy4uLlxuICogfVxuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RpbWUtb2YtY2hlY2tfdG9fdGltZS1vZi11c2VcbiAqIEBkZXByZWNhdGVkICh3aWxsIGJlIHJlbW92ZWQgYWZ0ZXIgMC4xNTcuMCkgQ2hlY2tpbmcgdGhlIHN0YXRlIG9mIGEgZmlsZSBiZWZvcmUgdXNpbmcgaXQgY2F1c2VzIGEgcmFjZSBjb25kaXRpb24uIFBlcmZvcm0gdGhlIGFjdHVhbCBvcGVyYXRpb24gZGlyZWN0bHkgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4aXN0cyhmaWxlUGF0aDogc3RyaW5nIHwgVVJMKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgRGVuby5sc3RhdChmaWxlUGF0aCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoIHRoZSBmaWxlIHN5c3RlbS5cbiAqXG4gKiBOb3RlOiBkbyBub3QgdXNlIHRoaXMgZnVuY3Rpb24gaWYgcGVyZm9ybWluZyBhIGNoZWNrIGJlZm9yZSBhbm90aGVyIG9wZXJhdGlvbiBvbiB0aGF0IGZpbGUuIERvaW5nIHNvIGNyZWF0ZXMgYSByYWNlIGNvbmRpdGlvbi4gSW5zdGVhZCwgcGVyZm9ybSB0aGUgYWN0dWFsIGZpbGUgb3BlcmF0aW9uIGRpcmVjdGx5LlxuICpcbiAqIEJhZDpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vZnMvbW9kLnRzXCI7XG4gKlxuICogaWYgKGV4aXN0c1N5bmMoXCIuL2Zvby50eHRcIikpIHtcbiAqICAgRGVuby5yZW1vdmVTeW5jKFwiLi9mb28udHh0XCIpO1xuICogfVxuICogYGBgXG4gKlxuICogR29vZDpcbiAqIGBgYHRzXG4gKiAvLyBOb3RpY2Ugbm8gdXNlIG9mIGV4aXN0c1N5bmNcbiAqIHRyeSB7XG4gKiAgIERlbm8ucmVtb3ZlU3luYyhcIi4vZm9vLnR4dFwiKTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmICghKGVycm9yIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpKSB7XG4gKiAgICAgdGhyb3cgZXJyb3I7XG4gKiAgIH1cbiAqICAgLy8gRG8gbm90aGluZy4uLlxuICogfVxuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RpbWUtb2YtY2hlY2tfdG9fdGltZS1vZi11c2VcbiAqIEBkZXByZWNhdGVkICh3aWxsIGJlIHJlbW92ZWQgYWZ0ZXIgMC4xNTcuMCkgQ2hlY2tpbmcgdGhlIHN0YXRlIG9mIGEgZmlsZSBiZWZvcmUgdXNpbmcgaXQgY2F1c2VzIGEgcmFjZSBjb25kaXRpb24uIFBlcmZvcm0gdGhlIGFjdHVhbCBvcGVyYXRpb24gZGlyZWN0bHkgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4aXN0c1N5bmMoZmlsZVBhdGg6IHN0cmluZyB8IFVSTCk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIERlbm8ubHN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTRCQyxHQUNELE9BQU8sZUFBZSxPQUFPLFFBQXNCLEVBQW9CO0lBQ3JFLElBQUk7UUFDRixNQUFNLEtBQUssS0FBSyxDQUFDO1FBQ2pCLE9BQU8sSUFBSTtJQUNiLEVBQUUsT0FBTyxPQUFPO1FBQ2QsSUFBSSxpQkFBaUIsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQ3pDLE9BQU8sS0FBSztRQUNkLENBQUM7UUFDRCxNQUFNLE1BQU07SUFDZDtBQUNGLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTRCQyxHQUNELE9BQU8sU0FBUyxXQUFXLFFBQXNCLEVBQVc7SUFDMUQsSUFBSTtRQUNGLEtBQUssU0FBUyxDQUFDO1FBQ2YsT0FBTyxJQUFJO0lBQ2IsRUFBRSxPQUFPLE9BQU87UUFDZCxJQUFJLGlCQUFpQixLQUFLLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDekMsT0FBTyxLQUFLO1FBQ2QsQ0FBQztRQUNELE1BQU0sTUFBTTtJQUNkO0FBQ0YsQ0FBQyJ9