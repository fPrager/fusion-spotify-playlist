// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { O_APPEND, O_CREAT, O_EXCL, O_RDONLY, O_RDWR, O_TRUNC, O_WRONLY } from "./_fs_constants.ts";
import { validateFunction } from "../internal/validators.mjs";
import { notImplemented } from "../_utils.ts";
export function isFileOptions(fileOptions) {
    if (!fileOptions) return false;
    return fileOptions.encoding != undefined || fileOptions.flag != undefined || fileOptions.signal != undefined || fileOptions.mode != undefined;
}
export function getEncoding(optOrCallback) {
    if (!optOrCallback || typeof optOrCallback === "function") {
        return null;
    }
    const encoding = typeof optOrCallback === "string" ? optOrCallback : optOrCallback.encoding;
    if (!encoding) return null;
    return encoding;
}
export function checkEncoding(encoding) {
    if (!encoding) return null;
    encoding = encoding.toLowerCase();
    if ([
        "utf8",
        "hex",
        "base64"
    ].includes(encoding)) return encoding;
    if (encoding === "utf-8") {
        return "utf8";
    }
    if (encoding === "binary") {
        return "binary";
    // before this was buffer, however buffer is not used in Node
    // node -e "require('fs').readFile('../world.txt', 'buffer', console.log)"
    }
    const notImplementedEncodings = [
        "utf16le",
        "latin1",
        "ascii",
        "ucs2"
    ];
    if (notImplementedEncodings.includes(encoding)) {
        notImplemented(`"${encoding}" encoding`);
    }
    throw new Error(`The value "${encoding}" is invalid for option "encoding"`);
}
export function getOpenOptions(flag) {
    if (!flag) {
        return {
            create: true,
            append: true
        };
    }
    let openOptions = {};
    if (typeof flag === "string") {
        switch(flag){
            case "a":
                {
                    // 'a': Open file for appending. The file is created if it does not exist.
                    openOptions = {
                        create: true,
                        append: true
                    };
                    break;
                }
            case "ax":
            case "xa":
                {
                    // 'ax', 'xa': Like 'a' but fails if the path exists.
                    openOptions = {
                        createNew: true,
                        write: true,
                        append: true
                    };
                    break;
                }
            case "a+":
                {
                    // 'a+': Open file for reading and appending. The file is created if it does not exist.
                    openOptions = {
                        read: true,
                        create: true,
                        append: true
                    };
                    break;
                }
            case "ax+":
            case "xa+":
                {
                    // 'ax+', 'xa+': Like 'a+' but fails if the path exists.
                    openOptions = {
                        read: true,
                        createNew: true,
                        append: true
                    };
                    break;
                }
            case "r":
                {
                    // 'r': Open file for reading. An exception occurs if the file does not exist.
                    openOptions = {
                        read: true
                    };
                    break;
                }
            case "r+":
                {
                    // 'r+': Open file for reading and writing. An exception occurs if the file does not exist.
                    openOptions = {
                        read: true,
                        write: true
                    };
                    break;
                }
            case "w":
                {
                    // 'w': Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
                    openOptions = {
                        create: true,
                        write: true,
                        truncate: true
                    };
                    break;
                }
            case "wx":
            case "xw":
                {
                    // 'wx', 'xw': Like 'w' but fails if the path exists.
                    openOptions = {
                        createNew: true,
                        write: true
                    };
                    break;
                }
            case "w+":
                {
                    // 'w+': Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
                    openOptions = {
                        create: true,
                        write: true,
                        truncate: true,
                        read: true
                    };
                    break;
                }
            case "wx+":
            case "xw+":
                {
                    // 'wx+', 'xw+': Like 'w+' but fails if the path exists.
                    openOptions = {
                        createNew: true,
                        write: true,
                        read: true
                    };
                    break;
                }
            case "as":
            case "sa":
                {
                    // 'as', 'sa': Open file for appending in synchronous mode. The file is created if it does not exist.
                    openOptions = {
                        create: true,
                        append: true
                    };
                    break;
                }
            case "as+":
            case "sa+":
                {
                    // 'as+', 'sa+': Open file for reading and appending in synchronous mode. The file is created if it does not exist.
                    openOptions = {
                        create: true,
                        read: true,
                        append: true
                    };
                    break;
                }
            case "rs+":
            case "sr+":
                {
                    // 'rs+', 'sr+': Open file for reading and writing in synchronous mode. Instructs the operating system to bypass the local file system cache.
                    openOptions = {
                        create: true,
                        read: true,
                        write: true
                    };
                    break;
                }
            default:
                {
                    throw new Error(`Unrecognized file system flag: ${flag}`);
                }
        }
    } else if (typeof flag === "number") {
        if ((flag & O_APPEND) === O_APPEND) {
            openOptions.append = true;
        }
        if ((flag & O_CREAT) === O_CREAT) {
            openOptions.create = true;
            openOptions.write = true;
        }
        if ((flag & O_EXCL) === O_EXCL) {
            openOptions.createNew = true;
            openOptions.read = true;
            openOptions.write = true;
        }
        if ((flag & O_TRUNC) === O_TRUNC) {
            openOptions.truncate = true;
        }
        if ((flag & O_RDONLY) === O_RDONLY) {
            openOptions.read = true;
        }
        if ((flag & O_WRONLY) === O_WRONLY) {
            openOptions.write = true;
        }
        if ((flag & O_RDWR) === O_RDWR) {
            openOptions.read = true;
            openOptions.write = true;
        }
    }
    return openOptions;
}
export { isUint32 as isFd } from "../internal/validators.mjs";
export function maybeCallback(cb) {
    validateFunction(cb, "cb");
    return cb;
}
// Ensure that callbacks run in the global context. Only use this function
// for callbacks that are passed to the binding layer, callbacks that are
// invoked from JS already run in the proper scope.
export function makeCallback(cb) {
    validateFunction(cb, "cb");
    return (...args)=>Reflect.apply(cb, this, args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19jb21tb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7XG4gIE9fQVBQRU5ELFxuICBPX0NSRUFULFxuICBPX0VYQ0wsXG4gIE9fUkRPTkxZLFxuICBPX1JEV1IsXG4gIE9fVFJVTkMsXG4gIE9fV1JPTkxZLFxufSBmcm9tIFwiLi9fZnNfY29uc3RhbnRzLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUZ1bmN0aW9uIH0gZnJvbSBcIi4uL2ludGVybmFsL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQgdHlwZSB7IEVycm5vRXhjZXB0aW9uIH0gZnJvbSBcIi4uL19nbG9iYWwuZC50c1wiO1xuaW1wb3J0IHtcbiAgQmluYXJ5RW5jb2RpbmdzLFxuICBFbmNvZGluZ3MsXG4gIG5vdEltcGxlbWVudGVkLFxuICBUZXh0RW5jb2RpbmdzLFxufSBmcm9tIFwiLi4vX3V0aWxzLnRzXCI7XG5cbmV4cG9ydCB0eXBlIENhbGxiYWNrV2l0aEVycm9yID0gKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsKSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVPcHRpb25zIHtcbiAgZW5jb2Rpbmc/OiBFbmNvZGluZ3M7XG4gIGZsYWc/OiBzdHJpbmc7XG4gIHNpZ25hbD86IEFib3J0U2lnbmFsO1xufVxuXG5leHBvcnQgdHlwZSBUZXh0T3B0aW9uc0FyZ3VtZW50ID1cbiAgfCBUZXh0RW5jb2RpbmdzXG4gIHwgKHsgZW5jb2Rpbmc6IFRleHRFbmNvZGluZ3MgfSAmIEZpbGVPcHRpb25zKTtcbmV4cG9ydCB0eXBlIEJpbmFyeU9wdGlvbnNBcmd1bWVudCA9XG4gIHwgQmluYXJ5RW5jb2RpbmdzXG4gIHwgKHsgZW5jb2Rpbmc6IEJpbmFyeUVuY29kaW5ncyB9ICYgRmlsZU9wdGlvbnMpO1xuZXhwb3J0IHR5cGUgRmlsZU9wdGlvbnNBcmd1bWVudCA9IEVuY29kaW5ncyB8IEZpbGVPcHRpb25zO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdyaXRlRmlsZU9wdGlvbnMgZXh0ZW5kcyBGaWxlT3B0aW9ucyB7XG4gIG1vZGU/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVPcHRpb25zKFxuICBmaWxlT3B0aW9uczogc3RyaW5nIHwgV3JpdGVGaWxlT3B0aW9ucyB8IHVuZGVmaW5lZCxcbik6IGZpbGVPcHRpb25zIGlzIEZpbGVPcHRpb25zIHtcbiAgaWYgKCFmaWxlT3B0aW9ucykgcmV0dXJuIGZhbHNlO1xuXG4gIHJldHVybiAoXG4gICAgKGZpbGVPcHRpb25zIGFzIEZpbGVPcHRpb25zKS5lbmNvZGluZyAhPSB1bmRlZmluZWQgfHxcbiAgICAoZmlsZU9wdGlvbnMgYXMgRmlsZU9wdGlvbnMpLmZsYWcgIT0gdW5kZWZpbmVkIHx8XG4gICAgKGZpbGVPcHRpb25zIGFzIEZpbGVPcHRpb25zKS5zaWduYWwgIT0gdW5kZWZpbmVkIHx8XG4gICAgKGZpbGVPcHRpb25zIGFzIFdyaXRlRmlsZU9wdGlvbnMpLm1vZGUgIT0gdW5kZWZpbmVkXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbmNvZGluZyhcbiAgb3B0T3JDYWxsYmFjaz86XG4gICAgfCBGaWxlT3B0aW9uc1xuICAgIHwgV3JpdGVGaWxlT3B0aW9uc1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgfCAoKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkpXG4gICAgfCBFbmNvZGluZ3NcbiAgICB8IG51bGwsXG4pOiBFbmNvZGluZ3MgfCBudWxsIHtcbiAgaWYgKCFvcHRPckNhbGxiYWNrIHx8IHR5cGVvZiBvcHRPckNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGVuY29kaW5nID0gdHlwZW9mIG9wdE9yQ2FsbGJhY2sgPT09IFwic3RyaW5nXCJcbiAgICA/IG9wdE9yQ2FsbGJhY2tcbiAgICA6IG9wdE9yQ2FsbGJhY2suZW5jb2Rpbmc7XG4gIGlmICghZW5jb2RpbmcpIHJldHVybiBudWxsO1xuICByZXR1cm4gZW5jb2Rpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0VuY29kaW5nKGVuY29kaW5nOiBFbmNvZGluZ3MgfCBudWxsKTogRW5jb2RpbmdzIHwgbnVsbCB7XG4gIGlmICghZW5jb2RpbmcpIHJldHVybiBudWxsO1xuXG4gIGVuY29kaW5nID0gZW5jb2RpbmcudG9Mb3dlckNhc2UoKSBhcyBFbmNvZGluZ3M7XG4gIGlmIChbXCJ1dGY4XCIsIFwiaGV4XCIsIFwiYmFzZTY0XCJdLmluY2x1ZGVzKGVuY29kaW5nKSkgcmV0dXJuIGVuY29kaW5nO1xuXG4gIGlmIChlbmNvZGluZyA9PT0gXCJ1dGYtOFwiKSB7XG4gICAgcmV0dXJuIFwidXRmOFwiO1xuICB9XG4gIGlmIChlbmNvZGluZyA9PT0gXCJiaW5hcnlcIikge1xuICAgIHJldHVybiBcImJpbmFyeVwiO1xuICAgIC8vIGJlZm9yZSB0aGlzIHdhcyBidWZmZXIsIGhvd2V2ZXIgYnVmZmVyIGlzIG5vdCB1c2VkIGluIE5vZGVcbiAgICAvLyBub2RlIC1lIFwicmVxdWlyZSgnZnMnKS5yZWFkRmlsZSgnLi4vd29ybGQudHh0JywgJ2J1ZmZlcicsIGNvbnNvbGUubG9nKVwiXG4gIH1cblxuICBjb25zdCBub3RJbXBsZW1lbnRlZEVuY29kaW5ncyA9IFtcInV0ZjE2bGVcIiwgXCJsYXRpbjFcIiwgXCJhc2NpaVwiLCBcInVjczJcIl07XG5cbiAgaWYgKG5vdEltcGxlbWVudGVkRW5jb2RpbmdzLmluY2x1ZGVzKGVuY29kaW5nIGFzIHN0cmluZykpIHtcbiAgICBub3RJbXBsZW1lbnRlZChgXCIke2VuY29kaW5nfVwiIGVuY29kaW5nYCk7XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoYFRoZSB2YWx1ZSBcIiR7ZW5jb2Rpbmd9XCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwiZW5jb2RpbmdcImApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3Blbk9wdGlvbnMoXG4gIGZsYWc6IHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZCxcbik6IERlbm8uT3Blbk9wdGlvbnMge1xuICBpZiAoIWZsYWcpIHtcbiAgICByZXR1cm4geyBjcmVhdGU6IHRydWUsIGFwcGVuZDogdHJ1ZSB9O1xuICB9XG5cbiAgbGV0IG9wZW5PcHRpb25zOiBEZW5vLk9wZW5PcHRpb25zID0ge307XG5cbiAgaWYgKHR5cGVvZiBmbGFnID09PSBcInN0cmluZ1wiKSB7XG4gICAgc3dpdGNoIChmbGFnKSB7XG4gICAgICBjYXNlIFwiYVwiOiB7XG4gICAgICAgIC8vICdhJzogT3BlbiBmaWxlIGZvciBhcHBlbmRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgaWYgaXQgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIG9wZW5PcHRpb25zID0geyBjcmVhdGU6IHRydWUsIGFwcGVuZDogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJheFwiOlxuICAgICAgY2FzZSBcInhhXCI6IHtcbiAgICAgICAgLy8gJ2F4JywgJ3hhJzogTGlrZSAnYScgYnV0IGZhaWxzIGlmIHRoZSBwYXRoIGV4aXN0cy5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IGNyZWF0ZU5ldzogdHJ1ZSwgd3JpdGU6IHRydWUsIGFwcGVuZDogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJhK1wiOiB7XG4gICAgICAgIC8vICdhKyc6IE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgYXBwZW5kaW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIGlmIGl0IGRvZXMgbm90IGV4aXN0LlxuICAgICAgICBvcGVuT3B0aW9ucyA9IHsgcmVhZDogdHJ1ZSwgY3JlYXRlOiB0cnVlLCBhcHBlbmQ6IHRydWUgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiYXgrXCI6XG4gICAgICBjYXNlIFwieGErXCI6IHtcbiAgICAgICAgLy8gJ2F4KycsICd4YSsnOiBMaWtlICdhKycgYnV0IGZhaWxzIGlmIHRoZSBwYXRoIGV4aXN0cy5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IHJlYWQ6IHRydWUsIGNyZWF0ZU5ldzogdHJ1ZSwgYXBwZW5kOiB0cnVlIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJcIjoge1xuICAgICAgICAvLyAncic6IE9wZW4gZmlsZSBmb3IgcmVhZGluZy4gQW4gZXhjZXB0aW9uIG9jY3VycyBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdC5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IHJlYWQ6IHRydWUgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicitcIjoge1xuICAgICAgICAvLyAncisnOiBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIHdyaXRpbmcuIEFuIGV4Y2VwdGlvbiBvY2N1cnMgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIG9wZW5PcHRpb25zID0geyByZWFkOiB0cnVlLCB3cml0ZTogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJ3XCI6IHtcbiAgICAgICAgLy8gJ3cnOiBPcGVuIGZpbGUgZm9yIHdyaXRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgKGlmIGl0IGRvZXMgbm90IGV4aXN0KSBvciB0cnVuY2F0ZWQgKGlmIGl0IGV4aXN0cykuXG4gICAgICAgIG9wZW5PcHRpb25zID0geyBjcmVhdGU6IHRydWUsIHdyaXRlOiB0cnVlLCB0cnVuY2F0ZTogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJ3eFwiOlxuICAgICAgY2FzZSBcInh3XCI6IHtcbiAgICAgICAgLy8gJ3d4JywgJ3h3JzogTGlrZSAndycgYnV0IGZhaWxzIGlmIHRoZSBwYXRoIGV4aXN0cy5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IGNyZWF0ZU5ldzogdHJ1ZSwgd3JpdGU6IHRydWUgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwidytcIjoge1xuICAgICAgICAvLyAndysnOiBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIHdyaXRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgKGlmIGl0IGRvZXMgbm90IGV4aXN0KSBvciB0cnVuY2F0ZWQgKGlmIGl0IGV4aXN0cykuXG4gICAgICAgIG9wZW5PcHRpb25zID0geyBjcmVhdGU6IHRydWUsIHdyaXRlOiB0cnVlLCB0cnVuY2F0ZTogdHJ1ZSwgcmVhZDogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJ3eCtcIjpcbiAgICAgIGNhc2UgXCJ4dytcIjoge1xuICAgICAgICAvLyAnd3grJywgJ3h3Kyc6IExpa2UgJ3crJyBidXQgZmFpbHMgaWYgdGhlIHBhdGggZXhpc3RzLlxuICAgICAgICBvcGVuT3B0aW9ucyA9IHsgY3JlYXRlTmV3OiB0cnVlLCB3cml0ZTogdHJ1ZSwgcmVhZDogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJhc1wiOlxuICAgICAgY2FzZSBcInNhXCI6IHtcbiAgICAgICAgLy8gJ2FzJywgJ3NhJzogT3BlbiBmaWxlIGZvciBhcHBlbmRpbmcgaW4gc3luY2hyb25vdXMgbW9kZS4gVGhlIGZpbGUgaXMgY3JlYXRlZCBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IGNyZWF0ZTogdHJ1ZSwgYXBwZW5kOiB0cnVlIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImFzK1wiOlxuICAgICAgY2FzZSBcInNhK1wiOiB7XG4gICAgICAgIC8vICdhcysnLCAnc2ErJzogT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCBhcHBlbmRpbmcgaW4gc3luY2hyb25vdXMgbW9kZS4gVGhlIGZpbGUgaXMgY3JlYXRlZCBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAgICAgICAgb3Blbk9wdGlvbnMgPSB7IGNyZWF0ZTogdHJ1ZSwgcmVhZDogdHJ1ZSwgYXBwZW5kOiB0cnVlIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJzK1wiOlxuICAgICAgY2FzZSBcInNyK1wiOiB7XG4gICAgICAgIC8vICdycysnLCAnc3IrJzogT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCB3cml0aW5nIGluIHN5bmNocm9ub3VzIG1vZGUuIEluc3RydWN0cyB0aGUgb3BlcmF0aW5nIHN5c3RlbSB0byBieXBhc3MgdGhlIGxvY2FsIGZpbGUgc3lzdGVtIGNhY2hlLlxuICAgICAgICBvcGVuT3B0aW9ucyA9IHsgY3JlYXRlOiB0cnVlLCByZWFkOiB0cnVlLCB3cml0ZTogdHJ1ZSB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgZmlsZSBzeXN0ZW0gZmxhZzogJHtmbGFnfWApO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgZmxhZyA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmICgoZmxhZyAmIE9fQVBQRU5EKSA9PT0gT19BUFBFTkQpIHtcbiAgICAgIG9wZW5PcHRpb25zLmFwcGVuZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICgoZmxhZyAmIE9fQ1JFQVQpID09PSBPX0NSRUFUKSB7XG4gICAgICBvcGVuT3B0aW9ucy5jcmVhdGUgPSB0cnVlO1xuICAgICAgb3Blbk9wdGlvbnMud3JpdGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoKGZsYWcgJiBPX0VYQ0wpID09PSBPX0VYQ0wpIHtcbiAgICAgIG9wZW5PcHRpb25zLmNyZWF0ZU5ldyA9IHRydWU7XG4gICAgICBvcGVuT3B0aW9ucy5yZWFkID0gdHJ1ZTtcbiAgICAgIG9wZW5PcHRpb25zLndyaXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKChmbGFnICYgT19UUlVOQykgPT09IE9fVFJVTkMpIHtcbiAgICAgIG9wZW5PcHRpb25zLnRydW5jYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKChmbGFnICYgT19SRE9OTFkpID09PSBPX1JET05MWSkge1xuICAgICAgb3Blbk9wdGlvbnMucmVhZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICgoZmxhZyAmIE9fV1JPTkxZKSA9PT0gT19XUk9OTFkpIHtcbiAgICAgIG9wZW5PcHRpb25zLndyaXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKChmbGFnICYgT19SRFdSKSA9PT0gT19SRFdSKSB7XG4gICAgICBvcGVuT3B0aW9ucy5yZWFkID0gdHJ1ZTtcbiAgICAgIG9wZW5PcHRpb25zLndyaXRlID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3Blbk9wdGlvbnM7XG59XG5cbmV4cG9ydCB7IGlzVWludDMyIGFzIGlzRmQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIG1heWJlQ2FsbGJhY2soY2I6IHVua25vd24pIHtcbiAgdmFsaWRhdGVGdW5jdGlvbihjYiwgXCJjYlwiKTtcblxuICByZXR1cm4gY2IgYXMgQ2FsbGJhY2tXaXRoRXJyb3I7XG59XG5cbi8vIEVuc3VyZSB0aGF0IGNhbGxiYWNrcyBydW4gaW4gdGhlIGdsb2JhbCBjb250ZXh0LiBPbmx5IHVzZSB0aGlzIGZ1bmN0aW9uXG4vLyBmb3IgY2FsbGJhY2tzIHRoYXQgYXJlIHBhc3NlZCB0byB0aGUgYmluZGluZyBsYXllciwgY2FsbGJhY2tzIHRoYXQgYXJlXG4vLyBpbnZva2VkIGZyb20gSlMgYWxyZWFkeSBydW4gaW4gdGhlIHByb3BlciBzY29wZS5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQ2FsbGJhY2soXG4gIHRoaXM6IHVua25vd24sXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCByZXN1bHQ/OiB1bmtub3duKSA9PiB2b2lkLFxuKSB7XG4gIHZhbGlkYXRlRnVuY3Rpb24oY2IsIFwiY2JcIik7XG5cbiAgcmV0dXJuICguLi5hcmdzOiB1bmtub3duW10pID0+IFJlZmxlY3QuYXBwbHkoY2IhLCB0aGlzLCBhcmdzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FDRSxRQUFRLEVBQ1IsT0FBTyxFQUNQLE1BQU0sRUFDTixRQUFRLEVBQ1IsTUFBTSxFQUNOLE9BQU8sRUFDUCxRQUFRLFFBQ0gscUJBQXFCO0FBQzVCLFNBQVMsZ0JBQWdCLFFBQVEsNkJBQTZCO0FBRTlELFNBR0UsY0FBYyxRQUVULGVBQWU7QUFzQnRCLE9BQU8sU0FBUyxjQUNkLFdBQWtELEVBQ3RCO0lBQzVCLElBQUksQ0FBQyxhQUFhLE9BQU8sS0FBSztJQUU5QixPQUNFLEFBQUMsWUFBNEIsUUFBUSxJQUFJLGFBQ3pDLEFBQUMsWUFBNEIsSUFBSSxJQUFJLGFBQ3JDLEFBQUMsWUFBNEIsTUFBTSxJQUFJLGFBQ3ZDLEFBQUMsWUFBaUMsSUFBSSxJQUFJO0FBRTlDLENBQUM7QUFFRCxPQUFPLFNBQVMsWUFDZCxhQU1RLEVBQ1U7SUFDbEIsSUFBSSxDQUFDLGlCQUFpQixPQUFPLGtCQUFrQixZQUFZO1FBQ3pELE9BQU8sSUFBSTtJQUNiLENBQUM7SUFFRCxNQUFNLFdBQVcsT0FBTyxrQkFBa0IsV0FDdEMsZ0JBQ0EsY0FBYyxRQUFRO0lBQzFCLElBQUksQ0FBQyxVQUFVLE9BQU8sSUFBSTtJQUMxQixPQUFPO0FBQ1QsQ0FBQztBQUVELE9BQU8sU0FBUyxjQUFjLFFBQTBCLEVBQW9CO0lBQzFFLElBQUksQ0FBQyxVQUFVLE9BQU8sSUFBSTtJQUUxQixXQUFXLFNBQVMsV0FBVztJQUMvQixJQUFJO1FBQUM7UUFBUTtRQUFPO0tBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxPQUFPO0lBRXpELElBQUksYUFBYSxTQUFTO1FBQ3hCLE9BQU87SUFDVCxDQUFDO0lBQ0Qs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