// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
import { ownerSymbol } from "./async_hooks.ts";
import { kArrayBufferOffset, kBytesWritten, kLastWriteWasAsync, streamBaseState, WriteWrap } from "../internal_binding/stream_wrap.ts";
import { isUint8Array } from "./util/types.ts";
import { errnoException } from "./errors.ts";
import { getTimerDuration, kTimeout } from "./timers.mjs";
import { setUnrefTimeout } from "../timers.ts";
import { validateFunction } from "./validators.mjs";
import { codeMap } from "../internal_binding/uv.ts";
import { Buffer } from "../buffer.ts";
export const kMaybeDestroy = Symbol("kMaybeDestroy");
export const kUpdateTimer = Symbol("kUpdateTimer");
export const kAfterAsyncWrite = Symbol("kAfterAsyncWrite");
export const kHandle = Symbol("kHandle");
export const kSession = Symbol("kSession");
export const kBuffer = Symbol("kBuffer");
export const kBufferGen = Symbol("kBufferGen");
export const kBufferCb = Symbol("kBufferCb");
// deno-lint-ignore no-explicit-any
function handleWriteReq(req, data, encoding) {
    const { handle  } = req;
    switch(encoding){
        case "buffer":
            {
                const ret = handle.writeBuffer(req, data);
                if (streamBaseState[kLastWriteWasAsync]) {
                    req.buffer = data;
                }
                return ret;
            }
        case "latin1":
        case "binary":
            return handle.writeLatin1String(req, data);
        case "utf8":
        case "utf-8":
            return handle.writeUtf8String(req, data);
        case "ascii":
            return handle.writeAsciiString(req, data);
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
            return handle.writeUcs2String(req, data);
        default:
            {
                const buffer = Buffer.from(data, encoding);
                const ret1 = handle.writeBuffer(req, buffer);
                if (streamBaseState[kLastWriteWasAsync]) {
                    req.buffer = buffer;
                }
                return ret1;
            }
    }
}
// deno-lint-ignore no-explicit-any
function onWriteComplete(status) {
    let stream = this.handle[ownerSymbol];
    if (stream.constructor.name === "ReusedHandle") {
        stream = stream.handle;
    }
    if (stream.destroyed) {
        if (typeof this.callback === "function") {
            this.callback(null);
        }
        return;
    }
    if (status < 0) {
        const ex = errnoException(status, "write", this.error);
        if (typeof this.callback === "function") {
            this.callback(ex);
        } else {
            stream.destroy(ex);
        }
        return;
    }
    stream[kUpdateTimer]();
    stream[kAfterAsyncWrite](this);
    if (typeof this.callback === "function") {
        this.callback(null);
    }
}
function createWriteWrap(handle, callback) {
    const req = new WriteWrap();
    req.handle = handle;
    req.oncomplete = onWriteComplete;
    req.async = false;
    req.bytes = 0;
    req.buffer = null;
    req.callback = callback;
    return req;
}
export function writevGeneric(// deno-lint-ignore no-explicit-any
owner, // deno-lint-ignore no-explicit-any
data, cb) {
    const req = createWriteWrap(owner[kHandle], cb);
    const allBuffers = data.allBuffers;
    let chunks;
    if (allBuffers) {
        chunks = data;
        for(let i = 0; i < data.length; i++){
            data[i] = data[i].chunk;
        }
    } else {
        chunks = new Array(data.length << 1);
        for(let i1 = 0; i1 < data.length; i1++){
            const entry = data[i1];
            chunks[i1 * 2] = entry.chunk;
            chunks[i1 * 2 + 1] = entry.encoding;
        }
    }
    const err = req.handle.writev(req, chunks, allBuffers);
    // Retain chunks
    if (err === 0) {
        req._chunks = chunks;
    }
    afterWriteDispatched(req, err, cb);
    return req;
}
export function writeGeneric(// deno-lint-ignore no-explicit-any
owner, // deno-lint-ignore no-explicit-any
data, encoding, cb) {
    const req = createWriteWrap(owner[kHandle], cb);
    const err = handleWriteReq(req, data, encoding);
    afterWriteDispatched(req, err, cb);
    return req;
}
function afterWriteDispatched(// deno-lint-ignore no-explicit-any
req, err, cb) {
    req.bytes = streamBaseState[kBytesWritten];
    req.async = !!streamBaseState[kLastWriteWasAsync];
    if (err !== 0) {
        return cb(errnoException(err, "write", req.error));
    }
    if (!req.async && typeof req.callback === "function") {
        req.callback();
    }
}
// Here we differ from Node slightly. Node makes use of the `kReadBytesOrError`
// entry of the `streamBaseState` array from the `stream_wrap` internal binding.
// Here we pass the `nread` value directly to this method as async Deno APIs
// don't grant us the ability to rely on some mutable array entry setting.
export function onStreamRead(arrayBuffer, nread) {
    // deno-lint-ignore no-this-alias
    const handle = this;
    let stream = this[ownerSymbol];
    if (stream.constructor.name === "ReusedHandle") {
        stream = stream.handle;
    }
    stream[kUpdateTimer]();
    if (nread > 0 && !stream.destroyed) {
        let ret;
        let result;
        const userBuf = stream[kBuffer];
        if (userBuf) {
            result = stream[kBufferCb](nread, userBuf) !== false;
            const bufGen = stream[kBufferGen];
            if (bufGen !== null) {
                const nextBuf = bufGen();
                if (isUint8Array(nextBuf)) {
                    stream[kBuffer] = ret = nextBuf;
                }
            }
        } else {
            const offset = streamBaseState[kArrayBufferOffset];
            const buf = Buffer.from(arrayBuffer, offset, nread);
            result = stream.push(buf);
        }
        if (!result) {
            handle.reading = false;
            if (!stream.destroyed) {
                const err = handle.readStop();
                if (err) {
                    stream.destroy(errnoException(err, "read"));
                }
            }
        }
        return ret;
    }
    if (nread === 0) {
        return;
    }
    if (nread !== codeMap.get("EOF")) {
        // CallJSOnreadMethod expects the return value to be a buffer.
        // Ref: https://github.com/nodejs/node/pull/34375
        stream.destroy(errnoException(nread, "read"));
        return;
    }
    // Defer this until we actually emit end
    if (stream._readableState.endEmitted) {
        if (stream[kMaybeDestroy]) {
            stream[kMaybeDestroy]();
        }
    } else {
        if (stream[kMaybeDestroy]) {
            stream.on("end", stream[kMaybeDestroy]);
        }
        if (handle.readStop) {
            const err1 = handle.readStop();
            if (err1) {
                // CallJSOnreadMethod expects the return value to be a buffer.
                // Ref: https://github.com/nodejs/node/pull/34375
                stream.destroy(errnoException(err1, "read"));
                return;
            }
        }
        // Push a null to signal the end of data.
        // Do it before `maybeDestroy` for correct order of events:
        // `end` -> `close`
        stream.push(null);
        stream.read(0);
    }
}
export function setStreamTimeout(msecs, callback) {
    if (this.destroyed) {
        return this;
    }
    this.timeout = msecs;
    // Type checking identical to timers.enroll()
    msecs = getTimerDuration(msecs, "msecs");
    // Attempt to clear an existing timer in both cases -
    //  even if it will be rescheduled we don't want to leak an existing timer.
    clearTimeout(this[kTimeout]);
    if (msecs === 0) {
        if (callback !== undefined) {
            validateFunction(callback, "callback");
            this.removeListener("timeout", callback);
        }
    } else {
        this[kTimeout] = setUnrefTimeout(this._onTimeout.bind(this), msecs);
        if (this[kSession]) {
            this[kSession][kUpdateTimer]();
        }
        if (callback !== undefined) {
            validateFunction(callback, "callback");
            this.once("timeout", callback);
        }
    }
    return this;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvc3RyZWFtX2Jhc2VfY29tbW9ucy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmltcG9ydCB7IG93bmVyU3ltYm9sIH0gZnJvbSBcIi4vYXN5bmNfaG9va3MudHNcIjtcbmltcG9ydCB7XG4gIGtBcnJheUJ1ZmZlck9mZnNldCxcbiAga0J5dGVzV3JpdHRlbixcbiAga0xhc3RXcml0ZVdhc0FzeW5jLFxuICBMaWJ1dlN0cmVhbVdyYXAsXG4gIHN0cmVhbUJhc2VTdGF0ZSxcbiAgV3JpdGVXcmFwLFxufSBmcm9tIFwiLi4vaW50ZXJuYWxfYmluZGluZy9zdHJlYW1fd3JhcC50c1wiO1xuaW1wb3J0IHsgaXNVaW50OEFycmF5IH0gZnJvbSBcIi4vdXRpbC90eXBlcy50c1wiO1xuaW1wb3J0IHsgZXJybm9FeGNlcHRpb24gfSBmcm9tIFwiLi9lcnJvcnMudHNcIjtcbmltcG9ydCB7IGdldFRpbWVyRHVyYXRpb24sIGtUaW1lb3V0IH0gZnJvbSBcIi4vdGltZXJzLm1qc1wiO1xuaW1wb3J0IHsgc2V0VW5yZWZUaW1lb3V0IH0gZnJvbSBcIi4uL3RpbWVycy50c1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVGdW5jdGlvbiB9IGZyb20gXCIuL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQgeyBjb2RlTWFwIH0gZnJvbSBcIi4uL2ludGVybmFsX2JpbmRpbmcvdXYudHNcIjtcbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9idWZmZXIudHNcIjtcblxuZXhwb3J0IGNvbnN0IGtNYXliZURlc3Ryb3kgPSBTeW1ib2woXCJrTWF5YmVEZXN0cm95XCIpO1xuZXhwb3J0IGNvbnN0IGtVcGRhdGVUaW1lciA9IFN5bWJvbChcImtVcGRhdGVUaW1lclwiKTtcbmV4cG9ydCBjb25zdCBrQWZ0ZXJBc3luY1dyaXRlID0gU3ltYm9sKFwia0FmdGVyQXN5bmNXcml0ZVwiKTtcbmV4cG9ydCBjb25zdCBrSGFuZGxlID0gU3ltYm9sKFwia0hhbmRsZVwiKTtcbmV4cG9ydCBjb25zdCBrU2Vzc2lvbiA9IFN5bWJvbChcImtTZXNzaW9uXCIpO1xuZXhwb3J0IGNvbnN0IGtCdWZmZXIgPSBTeW1ib2woXCJrQnVmZmVyXCIpO1xuZXhwb3J0IGNvbnN0IGtCdWZmZXJHZW4gPSBTeW1ib2woXCJrQnVmZmVyR2VuXCIpO1xuZXhwb3J0IGNvbnN0IGtCdWZmZXJDYiA9IFN5bWJvbChcImtCdWZmZXJDYlwiKTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIGhhbmRsZVdyaXRlUmVxKHJlcTogYW55LCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgeyBoYW5kbGUgfSA9IHJlcTtcblxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSBcImJ1ZmZlclwiOiB7XG4gICAgICBjb25zdCByZXQgPSBoYW5kbGUud3JpdGVCdWZmZXIocmVxLCBkYXRhKTtcblxuICAgICAgaWYgKHN0cmVhbUJhc2VTdGF0ZVtrTGFzdFdyaXRlV2FzQXN5bmNdKSB7XG4gICAgICAgIHJlcS5idWZmZXIgPSBkYXRhO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmV0O1xuICAgIH1cbiAgICBjYXNlIFwibGF0aW4xXCI6XG4gICAgY2FzZSBcImJpbmFyeVwiOlxuICAgICAgcmV0dXJuIGhhbmRsZS53cml0ZUxhdGluMVN0cmluZyhyZXEsIGRhdGEpO1xuICAgIGNhc2UgXCJ1dGY4XCI6XG4gICAgY2FzZSBcInV0Zi04XCI6XG4gICAgICByZXR1cm4gaGFuZGxlLndyaXRlVXRmOFN0cmluZyhyZXEsIGRhdGEpO1xuICAgIGNhc2UgXCJhc2NpaVwiOlxuICAgICAgcmV0dXJuIGhhbmRsZS53cml0ZUFzY2lpU3RyaW5nKHJlcSwgZGF0YSk7XG4gICAgY2FzZSBcInVjczJcIjpcbiAgICBjYXNlIFwidWNzLTJcIjpcbiAgICBjYXNlIFwidXRmMTZsZVwiOlxuICAgIGNhc2UgXCJ1dGYtMTZsZVwiOlxuICAgICAgcmV0dXJuIGhhbmRsZS53cml0ZVVjczJTdHJpbmcocmVxLCBkYXRhKTtcbiAgICBkZWZhdWx0OiB7XG4gICAgICBjb25zdCBidWZmZXIgPSBCdWZmZXIuZnJvbShkYXRhLCBlbmNvZGluZyk7XG4gICAgICBjb25zdCByZXQgPSBoYW5kbGUud3JpdGVCdWZmZXIocmVxLCBidWZmZXIpO1xuXG4gICAgICBpZiAoc3RyZWFtQmFzZVN0YXRlW2tMYXN0V3JpdGVXYXNBc3luY10pIHtcbiAgICAgICAgcmVxLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG4gIH1cbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIG9uV3JpdGVDb21wbGV0ZSh0aGlzOiBhbnksIHN0YXR1czogbnVtYmVyKSB7XG4gIGxldCBzdHJlYW0gPSB0aGlzLmhhbmRsZVtvd25lclN5bWJvbF07XG5cbiAgaWYgKHN0cmVhbS5jb25zdHJ1Y3Rvci5uYW1lID09PSBcIlJldXNlZEhhbmRsZVwiKSB7XG4gICAgc3RyZWFtID0gc3RyZWFtLmhhbmRsZTtcbiAgfVxuXG4gIGlmIChzdHJlYW0uZGVzdHJveWVkKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRoaXMuY2FsbGJhY2sobnVsbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHN0YXR1cyA8IDApIHtcbiAgICBjb25zdCBleCA9IGVycm5vRXhjZXB0aW9uKHN0YXR1cywgXCJ3cml0ZVwiLCB0aGlzLmVycm9yKTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5jYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aGlzLmNhbGxiYWNrKGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyZWFtLmRlc3Ryb3koZXgpO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0cmVhbVtrVXBkYXRlVGltZXJdKCk7XG4gIHN0cmVhbVtrQWZ0ZXJBc3luY1dyaXRlXSh0aGlzKTtcblxuICBpZiAodHlwZW9mIHRoaXMuY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHRoaXMuY2FsbGJhY2sobnVsbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlV3JpdGVXcmFwKFxuICBoYW5kbGU6IExpYnV2U3RyZWFtV3JhcCxcbiAgY2FsbGJhY2s6IChlcnI/OiBFcnJvciB8IG51bGwpID0+IHZvaWQsXG4pIHtcbiAgY29uc3QgcmVxID0gbmV3IFdyaXRlV3JhcDxMaWJ1dlN0cmVhbVdyYXA+KCk7XG5cbiAgcmVxLmhhbmRsZSA9IGhhbmRsZTtcbiAgcmVxLm9uY29tcGxldGUgPSBvbldyaXRlQ29tcGxldGU7XG4gIHJlcS5hc3luYyA9IGZhbHNlO1xuICByZXEuYnl0ZXMgPSAwO1xuICByZXEuYnVmZmVyID0gbnVsbDtcbiAgcmVxLmNhbGxiYWNrID0gY2FsbGJhY2s7XG5cbiAgcmV0dXJuIHJlcTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRldkdlbmVyaWMoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG93bmVyOiBhbnksXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGRhdGE6IGFueSxcbiAgY2I6IChlcnI/OiBFcnJvciB8IG51bGwpID0+IHZvaWQsXG4pIHtcbiAgY29uc3QgcmVxID0gY3JlYXRlV3JpdGVXcmFwKG93bmVyW2tIYW5kbGVdLCBjYik7XG4gIGNvbnN0IGFsbEJ1ZmZlcnMgPSBkYXRhLmFsbEJ1ZmZlcnM7XG4gIGxldCBjaHVua3M7XG5cbiAgaWYgKGFsbEJ1ZmZlcnMpIHtcbiAgICBjaHVua3MgPSBkYXRhO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhW2ldID0gZGF0YVtpXS5jaHVuaztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzID0gbmV3IEFycmF5KGRhdGEubGVuZ3RoIDw8IDEpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IGRhdGFbaV07XG4gICAgICBjaHVua3NbaSAqIDJdID0gZW50cnkuY2h1bms7XG4gICAgICBjaHVua3NbaSAqIDIgKyAxXSA9IGVudHJ5LmVuY29kaW5nO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGVyciA9IHJlcS5oYW5kbGUud3JpdGV2KHJlcSwgY2h1bmtzLCBhbGxCdWZmZXJzKTtcblxuICAvLyBSZXRhaW4gY2h1bmtzXG4gIGlmIChlcnIgPT09IDApIHtcbiAgICByZXEuX2NodW5rcyA9IGNodW5rcztcbiAgfVxuXG4gIGFmdGVyV3JpdGVEaXNwYXRjaGVkKHJlcSwgZXJyLCBjYik7XG5cbiAgcmV0dXJuIHJlcTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlR2VuZXJpYyhcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgb3duZXI6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgZGF0YTogYW55LFxuICBlbmNvZGluZzogc3RyaW5nLFxuICBjYjogKGVycj86IEVycm9yIHwgbnVsbCkgPT4gdm9pZCxcbikge1xuICBjb25zdCByZXEgPSBjcmVhdGVXcml0ZVdyYXAob3duZXJba0hhbmRsZV0sIGNiKTtcbiAgY29uc3QgZXJyID0gaGFuZGxlV3JpdGVSZXEocmVxLCBkYXRhLCBlbmNvZGluZyk7XG5cbiAgYWZ0ZXJXcml0ZURpc3BhdGNoZWQocmVxLCBlcnIsIGNiKTtcblxuICByZXR1cm4gcmVxO1xufVxuXG5mdW5jdGlvbiBhZnRlcldyaXRlRGlzcGF0Y2hlZChcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcmVxOiBhbnksXG4gIGVycjogbnVtYmVyLFxuICBjYjogKGVycj86IEVycm9yIHwgbnVsbCkgPT4gdm9pZCxcbikge1xuICByZXEuYnl0ZXMgPSBzdHJlYW1CYXNlU3RhdGVba0J5dGVzV3JpdHRlbl07XG4gIHJlcS5hc3luYyA9ICEhc3RyZWFtQmFzZVN0YXRlW2tMYXN0V3JpdGVXYXNBc3luY107XG5cbiAgaWYgKGVyciAhPT0gMCkge1xuICAgIHJldHVybiBjYihlcnJub0V4Y2VwdGlvbihlcnIsIFwid3JpdGVcIiwgcmVxLmVycm9yKSk7XG4gIH1cblxuICBpZiAoIXJlcS5hc3luYyAmJiB0eXBlb2YgcmVxLmNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXEuY2FsbGJhY2soKTtcbiAgfVxufVxuXG4vLyBIZXJlIHdlIGRpZmZlciBmcm9tIE5vZGUgc2xpZ2h0bHkuIE5vZGUgbWFrZXMgdXNlIG9mIHRoZSBga1JlYWRCeXRlc09yRXJyb3JgXG4vLyBlbnRyeSBvZiB0aGUgYHN0cmVhbUJhc2VTdGF0ZWAgYXJyYXkgZnJvbSB0aGUgYHN0cmVhbV93cmFwYCBpbnRlcm5hbCBiaW5kaW5nLlxuLy8gSGVyZSB3ZSBwYXNzIHRoZSBgbnJlYWRgIHZhbHVlIGRpcmVjdGx5IHRvIHRoaXMgbWV0aG9kIGFzIGFzeW5jIERlbm8gQVBJc1xuLy8gZG9uJ3QgZ3JhbnQgdXMgdGhlIGFiaWxpdHkgdG8gcmVseSBvbiBzb21lIG11dGFibGUgYXJyYXkgZW50cnkgc2V0dGluZy5cbmV4cG9ydCBmdW5jdGlvbiBvblN0cmVhbVJlYWQoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHRoaXM6IGFueSxcbiAgYXJyYXlCdWZmZXI6IFVpbnQ4QXJyYXksXG4gIG5yZWFkOiBudW1iZXIsXG4pIHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby10aGlzLWFsaWFzXG4gIGNvbnN0IGhhbmRsZSA9IHRoaXM7XG5cbiAgbGV0IHN0cmVhbSA9IHRoaXNbb3duZXJTeW1ib2xdO1xuXG4gIGlmIChzdHJlYW0uY29uc3RydWN0b3IubmFtZSA9PT0gXCJSZXVzZWRIYW5kbGVcIikge1xuICAgIHN0cmVhbSA9IHN0cmVhbS5oYW5kbGU7XG4gIH1cblxuICBzdHJlYW1ba1VwZGF0ZVRpbWVyXSgpO1xuXG4gIGlmIChucmVhZCA+IDAgJiYgIXN0cmVhbS5kZXN0cm95ZWQpIHtcbiAgICBsZXQgcmV0O1xuICAgIGxldCByZXN1bHQ7XG4gICAgY29uc3QgdXNlckJ1ZiA9IHN0cmVhbVtrQnVmZmVyXTtcblxuICAgIGlmICh1c2VyQnVmKSB7XG4gICAgICByZXN1bHQgPSBzdHJlYW1ba0J1ZmZlckNiXShucmVhZCwgdXNlckJ1ZikgIT09IGZhbHNlO1xuICAgICAgY29uc3QgYnVmR2VuID0gc3RyZWFtW2tCdWZmZXJHZW5dO1xuXG4gICAgICBpZiAoYnVmR2VuICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG5leHRCdWYgPSBidWZHZW4oKTtcblxuICAgICAgICBpZiAoaXNVaW50OEFycmF5KG5leHRCdWYpKSB7XG4gICAgICAgICAgc3RyZWFtW2tCdWZmZXJdID0gcmV0ID0gbmV4dEJ1ZjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBvZmZzZXQgPSBzdHJlYW1CYXNlU3RhdGVba0FycmF5QnVmZmVyT2Zmc2V0XTtcbiAgICAgIGNvbnN0IGJ1ZiA9IEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyLCBvZmZzZXQsIG5yZWFkKTtcbiAgICAgIHJlc3VsdCA9IHN0cmVhbS5wdXNoKGJ1Zik7XG4gICAgfVxuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGhhbmRsZS5yZWFkaW5nID0gZmFsc2U7XG5cbiAgICAgIGlmICghc3RyZWFtLmRlc3Ryb3llZCkge1xuICAgICAgICBjb25zdCBlcnIgPSBoYW5kbGUucmVhZFN0b3AoKTtcblxuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgc3RyZWFtLmRlc3Ryb3koZXJybm9FeGNlcHRpb24oZXJyLCBcInJlYWRcIikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGlmIChucmVhZCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChucmVhZCAhPT0gY29kZU1hcC5nZXQoXCJFT0ZcIikpIHtcbiAgICAvLyBDYWxsSlNPbnJlYWRNZXRob2QgZXhwZWN0cyB0aGUgcmV0dXJuIHZhbHVlIHRvIGJlIGEgYnVmZmVyLlxuICAgIC8vIFJlZjogaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL3B1bGwvMzQzNzVcbiAgICBzdHJlYW0uZGVzdHJveShlcnJub0V4Y2VwdGlvbihucmVhZCwgXCJyZWFkXCIpKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIERlZmVyIHRoaXMgdW50aWwgd2UgYWN0dWFsbHkgZW1pdCBlbmRcbiAgaWYgKHN0cmVhbS5fcmVhZGFibGVTdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgaWYgKHN0cmVhbVtrTWF5YmVEZXN0cm95XSkge1xuICAgICAgc3RyZWFtW2tNYXliZURlc3Ryb3ldKCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChzdHJlYW1ba01heWJlRGVzdHJveV0pIHtcbiAgICAgIHN0cmVhbS5vbihcImVuZFwiLCBzdHJlYW1ba01heWJlRGVzdHJveV0pO1xuICAgIH1cblxuICAgIGlmIChoYW5kbGUucmVhZFN0b3ApIHtcbiAgICAgIGNvbnN0IGVyciA9IGhhbmRsZS5yZWFkU3RvcCgpO1xuXG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIC8vIENhbGxKU09ucmVhZE1ldGhvZCBleHBlY3RzIHRoZSByZXR1cm4gdmFsdWUgdG8gYmUgYSBidWZmZXIuXG4gICAgICAgIC8vIFJlZjogaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL3B1bGwvMzQzNzVcbiAgICAgICAgc3RyZWFtLmRlc3Ryb3koZXJybm9FeGNlcHRpb24oZXJyLCBcInJlYWRcIikpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQdXNoIGEgbnVsbCB0byBzaWduYWwgdGhlIGVuZCBvZiBkYXRhLlxuICAgIC8vIERvIGl0IGJlZm9yZSBgbWF5YmVEZXN0cm95YCBmb3IgY29ycmVjdCBvcmRlciBvZiBldmVudHM6XG4gICAgLy8gYGVuZGAgLT4gYGNsb3NlYFxuICAgIHN0cmVhbS5wdXNoKG51bGwpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdHJlYW1UaW1lb3V0KFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICB0aGlzOiBhbnksXG4gIG1zZWNzOiBudW1iZXIsXG4gIGNhbGxiYWNrPzogKCkgPT4gdm9pZCxcbikge1xuICBpZiAodGhpcy5kZXN0cm95ZWQpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHRoaXMudGltZW91dCA9IG1zZWNzO1xuXG4gIC8vIFR5cGUgY2hlY2tpbmcgaWRlbnRpY2FsIHRvIHRpbWVycy5lbnJvbGwoKVxuICBtc2VjcyA9IGdldFRpbWVyRHVyYXRpb24obXNlY3MsIFwibXNlY3NcIik7XG5cbiAgLy8gQXR0ZW1wdCB0byBjbGVhciBhbiBleGlzdGluZyB0aW1lciBpbiBib3RoIGNhc2VzIC1cbiAgLy8gIGV2ZW4gaWYgaXQgd2lsbCBiZSByZXNjaGVkdWxlZCB3ZSBkb24ndCB3YW50IHRvIGxlYWsgYW4gZXhpc3RpbmcgdGltZXIuXG4gIGNsZWFyVGltZW91dCh0aGlzW2tUaW1lb3V0XSk7XG5cbiAgaWYgKG1zZWNzID09PSAwKSB7XG4gICAgaWYgKGNhbGxiYWNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKFwidGltZW91dFwiLCBjYWxsYmFjayk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXNba1RpbWVvdXRdID0gc2V0VW5yZWZUaW1lb3V0KHRoaXMuX29uVGltZW91dC5iaW5kKHRoaXMpLCBtc2Vjcyk7XG5cbiAgICBpZiAodGhpc1trU2Vzc2lvbl0pIHtcbiAgICAgIHRoaXNba1Nlc3Npb25dW2tVcGRhdGVUaW1lcl0oKTtcbiAgICB9XG5cbiAgICBpZiAoY2FsbGJhY2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsaWRhdGVGdW5jdGlvbihjYWxsYmFjaywgXCJjYWxsYmFja1wiKTtcbiAgICAgIHRoaXMub25jZShcInRpbWVvdXRcIiwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFDdEQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSxnRUFBZ0U7QUFDaEUsc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSw0RUFBNEU7QUFDNUUscUVBQXFFO0FBQ3JFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUN6RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLDZEQUE2RDtBQUM3RCw0RUFBNEU7QUFDNUUsMkVBQTJFO0FBQzNFLHdFQUF3RTtBQUN4RSw0RUFBNEU7QUFDNUUseUNBQXlDO0FBRXpDLFNBQVMsV0FBVyxRQUFRLG1CQUFtQjtBQUMvQyxTQUNFLGtC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