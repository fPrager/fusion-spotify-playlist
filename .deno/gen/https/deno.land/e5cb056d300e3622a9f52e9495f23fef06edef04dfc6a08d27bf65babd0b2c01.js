// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "../buffer.ts";
import { ERR_INVALID_ARG_TYPE } from "../internal/errors.ts";
import { validateOffsetLengthRead, validatePosition } from "../internal/fs/utils.mjs";
import { validateBuffer, validateInteger } from "../internal/validators.mjs";
export function read(fd, optOrBufferOrCb, offsetOrCallback, length, position, callback) {
    let cb;
    let offset = 0, buffer;
    if (typeof fd !== "number") {
        throw new ERR_INVALID_ARG_TYPE("fd", "number", fd);
    }
    if (length == null) {
        length = 0;
    }
    if (typeof offsetOrCallback === "function") {
        cb = offsetOrCallback;
    } else if (typeof optOrBufferOrCb === "function") {
        cb = optOrBufferOrCb;
    } else {
        offset = offsetOrCallback;
        validateInteger(offset, "offset", 0);
        cb = callback;
    }
    if (optOrBufferOrCb instanceof Buffer || optOrBufferOrCb instanceof Uint8Array) {
        buffer = optOrBufferOrCb;
    } else if (typeof optOrBufferOrCb === "function") {
        offset = 0;
        buffer = Buffer.alloc(16384);
        length = buffer.byteLength;
        position = null;
    } else {
        const opt = optOrBufferOrCb;
        if (!(opt.buffer instanceof Buffer) && !(opt.buffer instanceof Uint8Array)) {
            if (opt.buffer === null) {
                // @ts-ignore: Intentionally create TypeError for passing test-fs-read.js#L87
                length = opt.buffer.byteLength;
            }
            throw new ERR_INVALID_ARG_TYPE("buffer", [
                "Buffer",
                "TypedArray",
                "DataView"
            ], optOrBufferOrCb);
        }
        offset = opt.offset ?? 0;
        buffer = opt.buffer ?? Buffer.alloc(16384);
        length = opt.length ?? buffer.byteLength;
        position = opt.position ?? null;
    }
    if (position == null) {
        position = -1;
    }
    validatePosition(position);
    validateOffsetLengthRead(offset, length, buffer.byteLength);
    if (!cb) throw new ERR_INVALID_ARG_TYPE("cb", "Callback", cb);
    (async ()=>{
        try {
            let nread;
            if (typeof position === "number" && position >= 0) {
                const currentPosition = await Deno.seek(fd, 0, Deno.SeekMode.Current);
                // We use sync calls below to avoid being affected by others during
                // these calls.
                Deno.seekSync(fd, position, Deno.SeekMode.Start);
                nread = Deno.readSync(fd, buffer);
                Deno.seekSync(fd, currentPosition, Deno.SeekMode.Start);
            } else {
                nread = await Deno.read(fd, buffer);
            }
            cb(null, nread ?? 0, Buffer.from(buffer.buffer, offset, length));
        } catch (error) {
            cb(error, null);
        }
    })();
}
export function readSync(fd, buffer, offsetOrOpt, length, position) {
    let offset = 0;
    if (typeof fd !== "number") {
        throw new ERR_INVALID_ARG_TYPE("fd", "number", fd);
    }
    validateBuffer(buffer);
    if (length == null) {
        length = 0;
    }
    if (typeof offsetOrOpt === "number") {
        offset = offsetOrOpt;
        validateInteger(offset, "offset", 0);
    } else {
        const opt = offsetOrOpt;
        offset = opt.offset ?? 0;
        length = opt.length ?? buffer.byteLength;
        position = opt.position ?? null;
    }
    if (position == null) {
        position = -1;
    }
    validatePosition(position);
    validateOffsetLengthRead(offset, length, buffer.byteLength);
    let currentPosition = 0;
    if (typeof position === "number" && position >= 0) {
        currentPosition = Deno.seekSync(fd, 0, Deno.SeekMode.Current);
        Deno.seekSync(fd, position, Deno.SeekMode.Start);
    }
    const numberOfBytesRead = Deno.readSync(fd, buffer);
    if (typeof position === "number" && position >= 0) {
        Deno.seekSync(fd, currentPosition, Deno.SeekMode.Start);
    }
    return numberOfBytesRead ?? 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19yZWFkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBFUlJfSU5WQUxJRF9BUkdfVFlQRSB9IGZyb20gXCIuLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7XG4gIHZhbGlkYXRlT2Zmc2V0TGVuZ3RoUmVhZCxcbiAgdmFsaWRhdGVQb3NpdGlvbixcbn0gZnJvbSBcIi4uL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVCdWZmZXIsIHZhbGlkYXRlSW50ZWdlciB9IGZyb20gXCIuLi9pbnRlcm5hbC92YWxpZGF0b3JzLm1qc1wiO1xuXG50eXBlIHJlYWRPcHRpb25zID0ge1xuICBidWZmZXI6IEJ1ZmZlciB8IFVpbnQ4QXJyYXk7XG4gIG9mZnNldDogbnVtYmVyO1xuICBsZW5ndGg6IG51bWJlcjtcbiAgcG9zaXRpb246IG51bWJlciB8IG51bGw7XG59O1xuXG50eXBlIHJlYWRTeW5jT3B0aW9ucyA9IHtcbiAgb2Zmc2V0OiBudW1iZXI7XG4gIGxlbmd0aDogbnVtYmVyO1xuICBwb3NpdGlvbjogbnVtYmVyIHwgbnVsbDtcbn07XG5cbnR5cGUgQmluYXJ5Q2FsbGJhY2sgPSAoXG4gIGVycjogRXJyb3IgfCBudWxsLFxuICBieXRlc1JlYWQ6IG51bWJlciB8IG51bGwsXG4gIGRhdGE/OiBCdWZmZXIsXG4pID0+IHZvaWQ7XG50eXBlIENhbGxiYWNrID0gQmluYXJ5Q2FsbGJhY2s7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkKGZkOiBudW1iZXIsIGNhbGxiYWNrOiBDYWxsYmFjayk6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVhZChcbiAgZmQ6IG51bWJlcixcbiAgb3B0aW9uczogcmVhZE9wdGlvbnMsXG4gIGNhbGxiYWNrOiBDYWxsYmFjayxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVhZChcbiAgZmQ6IG51bWJlcixcbiAgYnVmZmVyOiBCdWZmZXIgfCBVaW50OEFycmF5LFxuICBvZmZzZXQ6IG51bWJlcixcbiAgbGVuZ3RoOiBudW1iZXIsXG4gIHBvc2l0aW9uOiBudW1iZXIgfCBudWxsLFxuICBjYWxsYmFjazogQ2FsbGJhY2ssXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWQoXG4gIGZkOiBudW1iZXIsXG4gIG9wdE9yQnVmZmVyT3JDYj86IEJ1ZmZlciB8IFVpbnQ4QXJyYXkgfCByZWFkT3B0aW9ucyB8IENhbGxiYWNrLFxuICBvZmZzZXRPckNhbGxiYWNrPzogbnVtYmVyIHwgQ2FsbGJhY2ssXG4gIGxlbmd0aD86IG51bWJlcixcbiAgcG9zaXRpb24/OiBudW1iZXIgfCBudWxsLFxuICBjYWxsYmFjaz86IENhbGxiYWNrLFxuKSB7XG4gIGxldCBjYjogQ2FsbGJhY2sgfCB1bmRlZmluZWQ7XG4gIGxldCBvZmZzZXQgPSAwLFxuICAgIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheTtcblxuICBpZiAodHlwZW9mIGZkICE9PSBcIm51bWJlclwiKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwiZmRcIiwgXCJudW1iZXJcIiwgZmQpO1xuICB9XG5cbiAgaWYgKGxlbmd0aCA9PSBudWxsKSB7XG4gICAgbGVuZ3RoID0gMDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2Zmc2V0T3JDYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2IgPSBvZmZzZXRPckNhbGxiYWNrO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRPckJ1ZmZlck9yQ2IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNiID0gb3B0T3JCdWZmZXJPckNiO1xuICB9IGVsc2Uge1xuICAgIG9mZnNldCA9IG9mZnNldE9yQ2FsbGJhY2sgYXMgbnVtYmVyO1xuICAgIHZhbGlkYXRlSW50ZWdlcihvZmZzZXQsIFwib2Zmc2V0XCIsIDApO1xuICAgIGNiID0gY2FsbGJhY2s7XG4gIH1cblxuICBpZiAoXG4gICAgb3B0T3JCdWZmZXJPckNiIGluc3RhbmNlb2YgQnVmZmVyIHx8IG9wdE9yQnVmZmVyT3JDYiBpbnN0YW5jZW9mIFVpbnQ4QXJyYXlcbiAgKSB7XG4gICAgYnVmZmVyID0gb3B0T3JCdWZmZXJPckNiO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRPckJ1ZmZlck9yQ2IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9mZnNldCA9IDA7XG4gICAgYnVmZmVyID0gQnVmZmVyLmFsbG9jKDE2Mzg0KTtcbiAgICBsZW5ndGggPSBidWZmZXIuYnl0ZUxlbmd0aDtcbiAgICBwb3NpdGlvbiA9IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgb3B0ID0gb3B0T3JCdWZmZXJPckNiIGFzIHJlYWRPcHRpb25zO1xuICAgIGlmIChcbiAgICAgICEob3B0LmJ1ZmZlciBpbnN0YW5jZW9mIEJ1ZmZlcikgJiYgIShvcHQuYnVmZmVyIGluc3RhbmNlb2YgVWludDhBcnJheSlcbiAgICApIHtcbiAgICAgIGlmIChvcHQuYnVmZmVyID09PSBudWxsKSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmU6IEludGVudGlvbmFsbHkgY3JlYXRlIFR5cGVFcnJvciBmb3IgcGFzc2luZyB0ZXN0LWZzLXJlYWQuanMjTDg3XG4gICAgICAgIGxlbmd0aCA9IG9wdC5idWZmZXIuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcImJ1ZmZlclwiLCBbXG4gICAgICAgIFwiQnVmZmVyXCIsXG4gICAgICAgIFwiVHlwZWRBcnJheVwiLFxuICAgICAgICBcIkRhdGFWaWV3XCIsXG4gICAgICBdLCBvcHRPckJ1ZmZlck9yQ2IpO1xuICAgIH1cbiAgICBvZmZzZXQgPSBvcHQub2Zmc2V0ID8/IDA7XG4gICAgYnVmZmVyID0gb3B0LmJ1ZmZlciA/PyBCdWZmZXIuYWxsb2MoMTYzODQpO1xuICAgIGxlbmd0aCA9IG9wdC5sZW5ndGggPz8gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgcG9zaXRpb24gPSBvcHQucG9zaXRpb24gPz8gbnVsbDtcbiAgfVxuXG4gIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgcG9zaXRpb24gPSAtMTtcbiAgfVxuXG4gIHZhbGlkYXRlUG9zaXRpb24ocG9zaXRpb24pO1xuICB2YWxpZGF0ZU9mZnNldExlbmd0aFJlYWQob2Zmc2V0LCBsZW5ndGgsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcblxuICBpZiAoIWNiKSB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJjYlwiLCBcIkNhbGxiYWNrXCIsIGNiKTtcblxuICAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgbnJlYWQ6IG51bWJlciB8IG51bGw7XG4gICAgICBpZiAodHlwZW9mIHBvc2l0aW9uID09PSBcIm51bWJlclwiICYmIHBvc2l0aW9uID49IDApIHtcbiAgICAgICAgY29uc3QgY3VycmVudFBvc2l0aW9uID0gYXdhaXQgRGVuby5zZWVrKGZkLCAwLCBEZW5vLlNlZWtNb2RlLkN1cnJlbnQpO1xuICAgICAgICAvLyBXZSB1c2Ugc3luYyBjYWxscyBiZWxvdyB0byBhdm9pZCBiZWluZyBhZmZlY3RlZCBieSBvdGhlcnMgZHVyaW5nXG4gICAgICAgIC8vIHRoZXNlIGNhbGxzLlxuICAgICAgICBEZW5vLnNlZWtTeW5jKGZkLCBwb3NpdGlvbiwgRGVuby5TZWVrTW9kZS5TdGFydCk7XG4gICAgICAgIG5yZWFkID0gRGVuby5yZWFkU3luYyhmZCwgYnVmZmVyKTtcbiAgICAgICAgRGVuby5zZWVrU3luYyhmZCwgY3VycmVudFBvc2l0aW9uLCBEZW5vLlNlZWtNb2RlLlN0YXJ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5yZWFkID0gYXdhaXQgRGVuby5yZWFkKGZkLCBidWZmZXIpO1xuICAgICAgfVxuICAgICAgY2IobnVsbCwgbnJlYWQgPz8gMCwgQnVmZmVyLmZyb20oYnVmZmVyLmJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2IoZXJyb3IgYXMgRXJyb3IsIG51bGwpO1xuICAgIH1cbiAgfSkoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRTeW5jKFxuICBmZDogbnVtYmVyLFxuICBidWZmZXI6IEJ1ZmZlciB8IFVpbnQ4QXJyYXksXG4gIG9mZnNldDogbnVtYmVyLFxuICBsZW5ndGg6IG51bWJlcixcbiAgcG9zaXRpb246IG51bWJlciB8IG51bGwsXG4pOiBudW1iZXI7XG5leHBvcnQgZnVuY3Rpb24gcmVhZFN5bmMoXG4gIGZkOiBudW1iZXIsXG4gIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheSxcbiAgb3B0OiByZWFkU3luY09wdGlvbnMsXG4pOiBudW1iZXI7XG5leHBvcnQgZnVuY3Rpb24gcmVhZFN5bmMoXG4gIGZkOiBudW1iZXIsXG4gIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheSxcbiAgb2Zmc2V0T3JPcHQ/OiBudW1iZXIgfCByZWFkU3luY09wdGlvbnMsXG4gIGxlbmd0aD86IG51bWJlcixcbiAgcG9zaXRpb24/OiBudW1iZXIgfCBudWxsLFxuKTogbnVtYmVyIHtcbiAgbGV0IG9mZnNldCA9IDA7XG5cbiAgaWYgKHR5cGVvZiBmZCAhPT0gXCJudW1iZXJcIikge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcImZkXCIsIFwibnVtYmVyXCIsIGZkKTtcbiAgfVxuXG4gIHZhbGlkYXRlQnVmZmVyKGJ1ZmZlcik7XG5cbiAgaWYgKGxlbmd0aCA9PSBudWxsKSB7XG4gICAgbGVuZ3RoID0gMDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2Zmc2V0T3JPcHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXRPck9wdDtcbiAgICB2YWxpZGF0ZUludGVnZXIob2Zmc2V0LCBcIm9mZnNldFwiLCAwKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBvcHQgPSBvZmZzZXRPck9wdCBhcyByZWFkU3luY09wdGlvbnM7XG4gICAgb2Zmc2V0ID0gb3B0Lm9mZnNldCA/PyAwO1xuICAgIGxlbmd0aCA9IG9wdC5sZW5ndGggPz8gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgcG9zaXRpb24gPSBvcHQucG9zaXRpb24gPz8gbnVsbDtcbiAgfVxuXG4gIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgcG9zaXRpb24gPSAtMTtcbiAgfVxuXG4gIHZhbGlkYXRlUG9zaXRpb24ocG9zaXRpb24pO1xuICB2YWxpZGF0ZU9mZnNldExlbmd0aFJlYWQob2Zmc2V0LCBsZW5ndGgsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcblxuICBsZXQgY3VycmVudFBvc2l0aW9uID0gMDtcbiAgaWYgKHR5cGVvZiBwb3NpdGlvbiA9PT0gXCJudW1iZXJcIiAmJiBwb3NpdGlvbiA+PSAwKSB7XG4gICAgY3VycmVudFBvc2l0aW9uID0gRGVuby5zZWVrU3luYyhmZCwgMCwgRGVuby5TZWVrTW9kZS5DdXJyZW50KTtcbiAgICBEZW5vLnNlZWtTeW5jKGZkLCBwb3NpdGlvbiwgRGVuby5TZWVrTW9kZS5TdGFydCk7XG4gIH1cblxuICBjb25zdCBudW1iZXJPZkJ5dGVzUmVhZCA9IERlbm8ucmVhZFN5bmMoZmQsIGJ1ZmZlcik7XG5cbiAgaWYgKHR5cGVvZiBwb3NpdGlvbiA9PT0gXCJudW1iZXJcIiAmJiBwb3NpdGlvbiA+PSAwKSB7XG4gICAgRGVuby5zZWVrU3luYyhmZCwgY3VycmVudFBvc2l0aW9uLCBEZW5vLlNlZWtNb2RlLlN0YXJ0KTtcbiAgfVxuXG4gIHJldHVybiBudW1iZXJPZkJ5dGVzUmVhZCA/PyAwO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLE1BQU0sUUFBUSxlQUFlO0FBQ3RDLFNBQVMsb0JBQW9CLFFBQVEsd0JBQXdCO0FB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