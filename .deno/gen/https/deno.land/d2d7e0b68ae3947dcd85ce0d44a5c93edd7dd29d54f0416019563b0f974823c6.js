// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module provides an interface to `Deno.core`. For environments
// that don't have access to `Deno.core` some APIs are polyfilled, while
// some are unavailble and throw on call.
// Note: deno_std shouldn't use Deno.core namespace. We should minimize these
// usages.
// deno-lint-ignore no-explicit-any
export let core;
// deno-lint-ignore no-explicit-any
const { Deno  } = globalThis;
// @ts-ignore Deno.core is not defined in types
if (Deno?.core) {
    // @ts-ignore Deno.core is not defined in types
    core = Deno.core;
} else {
    core = {
        setNextTickCallback: undefined,
        evalContext (_code, _filename) {
            throw new Error("Deno.core.evalContext is not supported in this environment");
        },
        encode (chunk) {
            return new TextEncoder().encode(chunk);
        },
        eventLoopHasMoreWork () {
            return false;
        },
        isProxy () {
            return false;
        },
        ops: {
            op_napi_open (_filename) {
                throw new Error("Node API is not supported in this environment");
            }
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2NvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLy8gVGhpcyBtb2R1bGUgcHJvdmlkZXMgYW4gaW50ZXJmYWNlIHRvIGBEZW5vLmNvcmVgLiBGb3IgZW52aXJvbm1lbnRzXG4vLyB0aGF0IGRvbid0IGhhdmUgYWNjZXNzIHRvIGBEZW5vLmNvcmVgIHNvbWUgQVBJcyBhcmUgcG9seWZpbGxlZCwgd2hpbGVcbi8vIHNvbWUgYXJlIHVuYXZhaWxibGUgYW5kIHRocm93IG9uIGNhbGwuXG4vLyBOb3RlOiBkZW5vX3N0ZCBzaG91bGRuJ3QgdXNlIERlbm8uY29yZSBuYW1lc3BhY2UuIFdlIHNob3VsZCBtaW5pbWl6ZSB0aGVzZVxuLy8gdXNhZ2VzLlxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IGxldCBjb3JlOiBhbnk7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5jb25zdCB7IERlbm8gfSA9IGdsb2JhbFRoaXMgYXMgYW55O1xuXG4vLyBAdHMtaWdub3JlIERlbm8uY29yZSBpcyBub3QgZGVmaW5lZCBpbiB0eXBlc1xuaWYgKERlbm8/LmNvcmUpIHtcbiAgLy8gQHRzLWlnbm9yZSBEZW5vLmNvcmUgaXMgbm90IGRlZmluZWQgaW4gdHlwZXNcbiAgY29yZSA9IERlbm8uY29yZTtcbn0gZWxzZSB7XG4gIGNvcmUgPSB7XG4gICAgc2V0TmV4dFRpY2tDYWxsYmFjazogdW5kZWZpbmVkLFxuICAgIGV2YWxDb250ZXh0KF9jb2RlOiBzdHJpbmcsIF9maWxlbmFtZTogc3RyaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiRGVuby5jb3JlLmV2YWxDb250ZXh0IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudFwiLFxuICAgICAgKTtcbiAgICB9LFxuICAgIGVuY29kZShjaHVuazogc3RyaW5nKTogVWludDhBcnJheSB7XG4gICAgICByZXR1cm4gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGNodW5rKTtcbiAgICB9LFxuICAgIGV2ZW50TG9vcEhhc01vcmVXb3JrKCk6IGJvb2xlYW4ge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNQcm94eSgpOiBib29sZWFuIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIG9wczoge1xuICAgICAgb3BfbmFwaV9vcGVuKF9maWxlbmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcIk5vZGUgQVBJIGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudFwiLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxxRUFBcUU7QUFDckUsd0VBQXdFO0FBQ3hFLHlDQUF5QztBQUN6Qyw2RUFBNkU7QUFDN0UsVUFBVTtBQUVWLG1DQUFtQztBQUNuQyxPQUFPLElBQUksS0FBVTtBQUVyQixtQ0FBbUM7QUFDbkMsTUFBTSxFQUFFLEtBQUksRUFBRSxHQUFHO0FBRWpCLCtDQUErQztBQUMvQyxJQUFJLE1BQU0sTUFBTTtJQUNkLCtDQUErQztJQUMvQyxPQUFPLEtBQUssSUFBSTtBQUNsQixPQUFPO0lBQ0wsT0FBTztRQUNMLHFCQUFxQjtRQUNyQixhQUFZLEtBQWEsRUFBRSxTQUFpQixFQUFFO1lBQzVDLE1BQU0sSUFBSSxNQUNSLDhEQUNBO1FBQ0o7UUFDQSxRQUFPLEtBQWEsRUFBYztZQUNoQyxPQUFPLElBQUksY0FBYyxNQUFNLENBQUM7UUFDbEM7UUFDQSx3QkFBZ0M7WUFDOUIsT0FBTyxLQUFLO1FBQ2Q7UUFDQSxXQUFtQjtZQUNqQixPQUFPLEtBQUs7UUFDZDtRQUNBLEtBQUs7WUFDSCxjQUFhLFNBQWlCLEVBQUU7Z0JBQzlCLE1BQU0sSUFBSSxNQUNSLGlEQUNBO1lBQ0o7UUFDRjtJQUNGO0FBQ0YsQ0FBQyJ9