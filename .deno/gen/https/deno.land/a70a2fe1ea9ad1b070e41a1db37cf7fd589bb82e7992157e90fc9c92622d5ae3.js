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
// This module ports:
// - https://github.com/nodejs/node/blob/master/src/stream_base-inl.h
// - https://github.com/nodejs/node/blob/master/src/stream_base.h
// - https://github.com/nodejs/node/blob/master/src/stream_base.cc
// - https://github.com/nodejs/node/blob/master/src/stream_wrap.h
// - https://github.com/nodejs/node/blob/master/src/stream_wrap.cc
import { Buffer } from "../buffer.ts";
import { notImplemented } from "../_utils.ts";
import { HandleWrap } from "./handle_wrap.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { codeMap } from "./uv.ts";
import { writeAll } from "../../streams/write_all.ts";
var StreamBaseStateFields;
(function(StreamBaseStateFields) {
    StreamBaseStateFields[StreamBaseStateFields["kReadBytesOrError"] = 0] = "kReadBytesOrError";
    StreamBaseStateFields[StreamBaseStateFields["kArrayBufferOffset"] = 1] = "kArrayBufferOffset";
    StreamBaseStateFields[StreamBaseStateFields["kBytesWritten"] = 2] = "kBytesWritten";
    StreamBaseStateFields[StreamBaseStateFields["kLastWriteWasAsync"] = 3] = "kLastWriteWasAsync";
    StreamBaseStateFields[StreamBaseStateFields["kNumStreamBaseStateFields"] = 4] = "kNumStreamBaseStateFields";
})(StreamBaseStateFields || (StreamBaseStateFields = {}));
export const kReadBytesOrError = StreamBaseStateFields.kReadBytesOrError;
export const kArrayBufferOffset = StreamBaseStateFields.kArrayBufferOffset;
export const kBytesWritten = StreamBaseStateFields.kBytesWritten;
export const kLastWriteWasAsync = StreamBaseStateFields.kLastWriteWasAsync;
export const kNumStreamBaseStateFields = StreamBaseStateFields.kNumStreamBaseStateFields;
export const streamBaseState = new Uint8Array(5);
// This is Deno, it always will be async.
streamBaseState[kLastWriteWasAsync] = 1;
export class WriteWrap extends AsyncWrap {
    handle;
    oncomplete;
    async;
    bytes;
    buffer;
    callback;
    _chunks;
    constructor(){
        super(providerType.WRITEWRAP);
    }
}
export class ShutdownWrap extends AsyncWrap {
    handle;
    oncomplete;
    callback;
    constructor(){
        super(providerType.SHUTDOWNWRAP);
    }
}
export const kStreamBaseField = Symbol("kStreamBaseField");
const SUGGESTED_SIZE = 64 * 1024;
export class LibuvStreamWrap extends HandleWrap {
    [kStreamBaseField];
    reading;
    #reading = false;
    destroyed = false;
    writeQueueSize = 0;
    bytesRead = 0;
    bytesWritten = 0;
    onread;
    constructor(provider, stream){
        super(provider);
        this.#attachToObject(stream);
    }
    /**
   * Start the reading of the stream.
   * @return An error status code.
   */ readStart() {
        if (!this.#reading) {
            this.#reading = true;
            this.#read();
        }
        return 0;
    }
    /**
   * Stop the reading of the stream.
   * @return An error status code.
   */ readStop() {
        this.#reading = false;
        return 0;
    }
    /**
   * Shutdown the stream.
   * @param req A shutdown request wrapper.
   * @return An error status code.
   */ shutdown(req) {
        const status = this._onClose();
        try {
            req.oncomplete(status);
        } catch  {
        // swallow callback error.
        }
        return 0;
    }
    /**
   * @param userBuf
   * @return An error status code.
   */ useUserBuffer(_userBuf) {
        // TODO(cmorten)
        notImplemented("LibuvStreamWrap.prototype.useUserBuffer");
    }
    /**
   * Write a buffer to the stream.
   * @param req A write request wrapper.
   * @param data The Uint8Array buffer to write to the stream.
   * @return An error status code.
   */ writeBuffer(req, data) {
        this.#write(req, data);
        return 0;
    }
    /**
   * Write multiple chunks at once.
   * @param req A write request wrapper.
   * @param chunks
   * @param allBuffers
   * @return An error status code.
   */ writev(req, chunks, allBuffers) {
        const count = allBuffers ? chunks.length : chunks.length >> 1;
        const buffers = new Array(count);
        if (!allBuffers) {
            for(let i = 0; i < count; i++){
                const chunk = chunks[i * 2];
                if (Buffer.isBuffer(chunk)) {
                    buffers[i] = chunk;
                }
                // String chunk
                const encoding = chunks[i * 2 + 1];
                buffers[i] = Buffer.from(chunk, encoding);
            }
        } else {
            for(let i1 = 0; i1 < count; i1++){
                buffers[i1] = chunks[i1];
            }
        }
        return this.writeBuffer(req, Buffer.concat(buffers));
    }
    /**
   * Write an ASCII string to the stream.
   * @return An error status code.
   */ writeAsciiString(req, data) {
        const buffer = new TextEncoder().encode(data);
        return this.writeBuffer(req, buffer);
    }
    /**
   * Write an UTF8 string to the stream.
   * @return An error status code.
   */ writeUtf8String(req, data) {
        const buffer = new TextEncoder().encode(data);
        return this.writeBuffer(req, buffer);
    }
    /**
   * Write an UCS2 string to the stream.
   * @return An error status code.
   */ writeUcs2String(_req, _data) {
        notImplemented("LibuvStreamWrap.prototype.writeUcs2String");
    }
    /**
   * Write an LATIN1 string to the stream.
   * @return An error status code.
   */ writeLatin1String(req, data) {
        const buffer = Buffer.from(data, "latin1");
        return this.writeBuffer(req, buffer);
    }
    _onClose() {
        let status = 0;
        this.#reading = false;
        try {
            this[kStreamBaseField]?.close();
        } catch  {
            status = codeMap.get("ENOTCONN");
        }
        return status;
    }
    /**
   * Attaches the class to the underlying stream.
   * @param stream The stream to attach to.
   */ #attachToObject(stream) {
        this[kStreamBaseField] = stream;
    }
    /** Internal method for reading from the attached stream. */ async #read() {
        let buf = new Uint8Array(SUGGESTED_SIZE);
        let nread;
        try {
            nread = await this[kStreamBaseField].read(buf);
        } catch (e) {
            if (e instanceof Deno.errors.Interrupted || e instanceof Deno.errors.BadResource) {
                nread = codeMap.get("EOF");
            } else if (e instanceof Deno.errors.ConnectionReset || e instanceof Deno.errors.ConnectionAborted) {
                nread = codeMap.get("ECONNRESET");
            } else {
                nread = codeMap.get("UNKNOWN");
            }
            buf = new Uint8Array(0);
        }
        nread ??= codeMap.get("EOF");
        streamBaseState[kReadBytesOrError] = nread;
        if (nread > 0) {
            this.bytesRead += nread;
        }
        buf = buf.slice(0, nread);
        streamBaseState[kArrayBufferOffset] = 0;
        try {
            this.onread(buf, nread);
        } catch  {
        // swallow callback errors.
        }
        if (nread >= 0 && this.#reading) {
            this.#read();
        }
    }
    /**
   * Internal method for writing to the attached stream.
   * @param req A write request wrapper.
   * @param data The Uint8Array buffer to write to the stream.
   */ async #write(req, data) {
        const { byteLength  } = data;
        try {
            await writeAll(this[kStreamBaseField], data);
        } catch (e1) {
            let status;
            // TODO(cmorten): map err to status codes
            if (e1 instanceof Deno.errors.BadResource || e1 instanceof Deno.errors.BrokenPipe) {
                status = codeMap.get("EBADF");
            } else {
                status = codeMap.get("UNKNOWN");
            }
            try {
                req.oncomplete(status);
            } catch  {
            // swallow callback errors.
            }
            return;
        }
        streamBaseState[kBytesWritten] = byteLength;
        this.bytesWritten += byteLength;
        try {
            req.oncomplete(0);
        } catch  {
        // swallow callback errors.
        }
        return;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9zdHJlYW1fd3JhcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIFRoaXMgbW9kdWxlIHBvcnRzOlxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3N0cmVhbV9iYXNlLWlubC5oXG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvc3RyZWFtX2Jhc2UuaFxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3N0cmVhbV9iYXNlLmNjXG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvc3RyZWFtX3dyYXAuaFxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3N0cmVhbV93cmFwLmNjXG5cbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IG5vdEltcGxlbWVudGVkIH0gZnJvbSBcIi4uL191dGlscy50c1wiO1xuaW1wb3J0IHsgSGFuZGxlV3JhcCB9IGZyb20gXCIuL2hhbmRsZV93cmFwLnRzXCI7XG5pbXBvcnQgeyBBc3luY1dyYXAsIHByb3ZpZGVyVHlwZSB9IGZyb20gXCIuL2FzeW5jX3dyYXAudHNcIjtcbmltcG9ydCB7IGNvZGVNYXAgfSBmcm9tIFwiLi91di50c1wiO1xuaW1wb3J0IHsgd3JpdGVBbGwgfSBmcm9tIFwiLi4vLi4vc3RyZWFtcy93cml0ZV9hbGwudHNcIjtcblxuZW51bSBTdHJlYW1CYXNlU3RhdGVGaWVsZHMge1xuICBrUmVhZEJ5dGVzT3JFcnJvcixcbiAga0FycmF5QnVmZmVyT2Zmc2V0LFxuICBrQnl0ZXNXcml0dGVuLFxuICBrTGFzdFdyaXRlV2FzQXN5bmMsXG4gIGtOdW1TdHJlYW1CYXNlU3RhdGVGaWVsZHMsXG59XG5cbmV4cG9ydCBjb25zdCBrUmVhZEJ5dGVzT3JFcnJvciA9IFN0cmVhbUJhc2VTdGF0ZUZpZWxkcy5rUmVhZEJ5dGVzT3JFcnJvcjtcbmV4cG9ydCBjb25zdCBrQXJyYXlCdWZmZXJPZmZzZXQgPSBTdHJlYW1CYXNlU3RhdGVGaWVsZHMua0FycmF5QnVmZmVyT2Zmc2V0O1xuZXhwb3J0IGNvbnN0IGtCeXRlc1dyaXR0ZW4gPSBTdHJlYW1CYXNlU3RhdGVGaWVsZHMua0J5dGVzV3JpdHRlbjtcbmV4cG9ydCBjb25zdCBrTGFzdFdyaXRlV2FzQXN5bmMgPSBTdHJlYW1CYXNlU3RhdGVGaWVsZHMua0xhc3RXcml0ZVdhc0FzeW5jO1xuZXhwb3J0IGNvbnN0IGtOdW1TdHJlYW1CYXNlU3RhdGVGaWVsZHMgPVxuICBTdHJlYW1CYXNlU3RhdGVGaWVsZHMua051bVN0cmVhbUJhc2VTdGF0ZUZpZWxkcztcblxuZXhwb3J0IGNvbnN0IHN0cmVhbUJhc2VTdGF0ZSA9IG5ldyBVaW50OEFycmF5KDUpO1xuXG4vLyBUaGlzIGlzIERlbm8sIGl0IGFsd2F5cyB3aWxsIGJlIGFzeW5jLlxuc3RyZWFtQmFzZVN0YXRlW2tMYXN0V3JpdGVXYXNBc3luY10gPSAxO1xuXG5leHBvcnQgY2xhc3MgV3JpdGVXcmFwPEggZXh0ZW5kcyBIYW5kbGVXcmFwPiBleHRlbmRzIEFzeW5jV3JhcCB7XG4gIGhhbmRsZSE6IEg7XG4gIG9uY29tcGxldGUhOiAoc3RhdHVzOiBudW1iZXIpID0+IHZvaWQ7XG4gIGFzeW5jITogYm9vbGVhbjtcbiAgYnl0ZXMhOiBudW1iZXI7XG4gIGJ1ZmZlciE6IHVua25vd247XG4gIGNhbGxiYWNrITogdW5rbm93bjtcbiAgX2NodW5rcyE6IHVua25vd25bXTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihwcm92aWRlclR5cGUuV1JJVEVXUkFQKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2h1dGRvd25XcmFwPEggZXh0ZW5kcyBIYW5kbGVXcmFwPiBleHRlbmRzIEFzeW5jV3JhcCB7XG4gIGhhbmRsZSE6IEg7XG4gIG9uY29tcGxldGUhOiAoc3RhdHVzOiBudW1iZXIpID0+IHZvaWQ7XG4gIGNhbGxiYWNrITogKCkgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihwcm92aWRlclR5cGUuU0hVVERPV05XUkFQKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3Qga1N0cmVhbUJhc2VGaWVsZCA9IFN5bWJvbChcImtTdHJlYW1CYXNlRmllbGRcIik7XG5cbmNvbnN0IFNVR0dFU1RFRF9TSVpFID0gNjQgKiAxMDI0O1xuXG5leHBvcnQgY2xhc3MgTGlidXZTdHJlYW1XcmFwIGV4dGVuZHMgSGFuZGxlV3JhcCB7XG4gIFtrU3RyZWFtQmFzZUZpZWxkXT86IERlbm8uUmVhZGVyICYgRGVuby5Xcml0ZXIgJiBEZW5vLkNsb3NlcjtcblxuICByZWFkaW5nITogYm9vbGVhbjtcbiAgI3JlYWRpbmcgPSBmYWxzZTtcbiAgZGVzdHJveWVkID0gZmFsc2U7XG4gIHdyaXRlUXVldWVTaXplID0gMDtcbiAgYnl0ZXNSZWFkID0gMDtcbiAgYnl0ZXNXcml0dGVuID0gMDtcblxuICBvbnJlYWQhOiAoX2FycmF5QnVmZmVyOiBVaW50OEFycmF5LCBfbnJlYWQ6IG51bWJlcikgPT4gVWludDhBcnJheSB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm92aWRlcjogcHJvdmlkZXJUeXBlLFxuICAgIHN0cmVhbT86IERlbm8uUmVhZGVyICYgRGVuby5Xcml0ZXIgJiBEZW5vLkNsb3NlcixcbiAgKSB7XG4gICAgc3VwZXIocHJvdmlkZXIpO1xuICAgIHRoaXMuI2F0dGFjaFRvT2JqZWN0KHN0cmVhbSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgdGhlIHJlYWRpbmcgb2YgdGhlIHN0cmVhbS5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHJlYWRTdGFydCgpOiBudW1iZXIge1xuICAgIGlmICghdGhpcy4jcmVhZGluZykge1xuICAgICAgdGhpcy4jcmVhZGluZyA9IHRydWU7XG4gICAgICB0aGlzLiNyZWFkKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogU3RvcCB0aGUgcmVhZGluZyBvZiB0aGUgc3RyZWFtLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgcmVhZFN0b3AoKTogbnVtYmVyIHtcbiAgICB0aGlzLiNyZWFkaW5nID0gZmFsc2U7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaHV0ZG93biB0aGUgc3RyZWFtLlxuICAgKiBAcGFyYW0gcmVxIEEgc2h1dGRvd24gcmVxdWVzdCB3cmFwcGVyLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgc2h1dGRvd24ocmVxOiBTaHV0ZG93bldyYXA8TGlidXZTdHJlYW1XcmFwPik6IG51bWJlciB7XG4gICAgY29uc3Qgc3RhdHVzID0gdGhpcy5fb25DbG9zZSgpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlcS5vbmNvbXBsZXRlKHN0YXR1cyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBzd2FsbG93IGNhbGxiYWNrIGVycm9yLlxuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB1c2VyQnVmXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICB1c2VVc2VyQnVmZmVyKF91c2VyQnVmOiB1bmtub3duKTogbnVtYmVyIHtcbiAgICAvLyBUT0RPKGNtb3J0ZW4pXG4gICAgbm90SW1wbGVtZW50ZWQoXCJMaWJ1dlN0cmVhbVdyYXAucHJvdG90eXBlLnVzZVVzZXJCdWZmZXJcIik7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgYSBidWZmZXIgdG8gdGhlIHN0cmVhbS5cbiAgICogQHBhcmFtIHJlcSBBIHdyaXRlIHJlcXVlc3Qgd3JhcHBlci5cbiAgICogQHBhcmFtIGRhdGEgVGhlIFVpbnQ4QXJyYXkgYnVmZmVyIHRvIHdyaXRlIHRvIHRoZSBzdHJlYW0uXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICB3cml0ZUJ1ZmZlcihyZXE6IFdyaXRlV3JhcDxMaWJ1dlN0cmVhbVdyYXA+LCBkYXRhOiBVaW50OEFycmF5KTogbnVtYmVyIHtcbiAgICB0aGlzLiN3cml0ZShyZXEsIGRhdGEpO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgbXVsdGlwbGUgY2h1bmtzIGF0IG9uY2UuXG4gICAqIEBwYXJhbSByZXEgQSB3cml0ZSByZXF1ZXN0IHdyYXBwZXIuXG4gICAqIEBwYXJhbSBjaHVua3NcbiAgICogQHBhcmFtIGFsbEJ1ZmZlcnNcbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHdyaXRldihcbiAgICByZXE6IFdyaXRlV3JhcDxMaWJ1dlN0cmVhbVdyYXA+LFxuICAgIGNodW5rczogQnVmZmVyW10gfCAoc3RyaW5nIHwgQnVmZmVyKVtdLFxuICAgIGFsbEJ1ZmZlcnM6IGJvb2xlYW4sXG4gICk6IG51bWJlciB7XG4gICAgY29uc3QgY291bnQgPSBhbGxCdWZmZXJzID8gY2h1bmtzLmxlbmd0aCA6IGNodW5rcy5sZW5ndGggPj4gMTtcbiAgICBjb25zdCBidWZmZXJzOiBCdWZmZXJbXSA9IG5ldyBBcnJheShjb3VudCk7XG5cbiAgICBpZiAoIWFsbEJ1ZmZlcnMpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBjaHVuayA9IGNodW5rc1tpICogMl07XG5cbiAgICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpIHtcbiAgICAgICAgICBidWZmZXJzW2ldID0gY2h1bms7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdHJpbmcgY2h1bmtcbiAgICAgICAgY29uc3QgZW5jb2Rpbmc6IHN0cmluZyA9IGNodW5rc1tpICogMiArIDFdIGFzIHN0cmluZztcbiAgICAgICAgYnVmZmVyc1tpXSA9IEJ1ZmZlci5mcm9tKGNodW5rIGFzIHN0cmluZywgZW5jb2RpbmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgYnVmZmVyc1tpXSA9IGNodW5rc1tpXSBhcyBCdWZmZXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMud3JpdGVCdWZmZXIocmVxLCBCdWZmZXIuY29uY2F0KGJ1ZmZlcnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBhbiBBU0NJSSBzdHJpbmcgdG8gdGhlIHN0cmVhbS5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHdyaXRlQXNjaWlTdHJpbmcocmVxOiBXcml0ZVdyYXA8TGlidXZTdHJlYW1XcmFwPiwgZGF0YTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoZGF0YSk7XG5cbiAgICByZXR1cm4gdGhpcy53cml0ZUJ1ZmZlcihyZXEsIGJ1ZmZlcik7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgYW4gVVRGOCBzdHJpbmcgdG8gdGhlIHN0cmVhbS5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHdyaXRlVXRmOFN0cmluZyhyZXE6IFdyaXRlV3JhcDxMaWJ1dlN0cmVhbVdyYXA+LCBkYXRhOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShkYXRhKTtcblxuICAgIHJldHVybiB0aGlzLndyaXRlQnVmZmVyKHJlcSwgYnVmZmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBhbiBVQ1MyIHN0cmluZyB0byB0aGUgc3RyZWFtLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgd3JpdGVVY3MyU3RyaW5nKF9yZXE6IFdyaXRlV3JhcDxMaWJ1dlN0cmVhbVdyYXA+LCBfZGF0YTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBub3RJbXBsZW1lbnRlZChcIkxpYnV2U3RyZWFtV3JhcC5wcm90b3R5cGUud3JpdGVVY3MyU3RyaW5nXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlIGFuIExBVElOMSBzdHJpbmcgdG8gdGhlIHN0cmVhbS5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHdyaXRlTGF0aW4xU3RyaW5nKHJlcTogV3JpdGVXcmFwPExpYnV2U3RyZWFtV3JhcD4sIGRhdGE6IHN0cmluZyk6IG51bWJlciB7XG4gICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmZyb20oZGF0YSwgXCJsYXRpbjFcIik7XG4gICAgcmV0dXJuIHRoaXMud3JpdGVCdWZmZXIocmVxLCBidWZmZXIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgX29uQ2xvc2UoKTogbnVtYmVyIHtcbiAgICBsZXQgc3RhdHVzID0gMDtcbiAgICB0aGlzLiNyZWFkaW5nID0gZmFsc2U7XG5cbiAgICB0cnkge1xuICAgICAgdGhpc1trU3RyZWFtQmFzZUZpZWxkXT8uY2xvc2UoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHN0YXR1cyA9IGNvZGVNYXAuZ2V0KFwiRU5PVENPTk5cIikhO1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0dXM7XG4gIH1cblxuICAvKipcbiAgICogQXR0YWNoZXMgdGhlIGNsYXNzIHRvIHRoZSB1bmRlcmx5aW5nIHN0cmVhbS5cbiAgICogQHBhcmFtIHN0cmVhbSBUaGUgc3RyZWFtIHRvIGF0dGFjaCB0by5cbiAgICovXG4gICNhdHRhY2hUb09iamVjdChzdHJlYW0/OiBEZW5vLlJlYWRlciAmIERlbm8uV3JpdGVyICYgRGVuby5DbG9zZXIpIHtcbiAgICB0aGlzW2tTdHJlYW1CYXNlRmllbGRdID0gc3RyZWFtO1xuICB9XG5cbiAgLyoqIEludGVybmFsIG1ldGhvZCBmb3IgcmVhZGluZyBmcm9tIHRoZSBhdHRhY2hlZCBzdHJlYW0uICovXG4gIGFzeW5jICNyZWFkKCkge1xuICAgIGxldCBidWYgPSBuZXcgVWludDhBcnJheShTVUdHRVNURURfU0laRSk7XG5cbiAgICBsZXQgbnJlYWQ6IG51bWJlciB8IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIG5yZWFkID0gYXdhaXQgdGhpc1trU3RyZWFtQmFzZUZpZWxkXSEucmVhZChidWYpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChcbiAgICAgICAgZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkludGVycnVwdGVkIHx8XG4gICAgICAgIGUgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5CYWRSZXNvdXJjZVxuICAgICAgKSB7XG4gICAgICAgIG5yZWFkID0gY29kZU1hcC5nZXQoXCJFT0ZcIikhO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkNvbm5lY3Rpb25SZXNldCB8fFxuICAgICAgICBlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQ29ubmVjdGlvbkFib3J0ZWRcbiAgICAgICkge1xuICAgICAgICBucmVhZCA9IGNvZGVNYXAuZ2V0KFwiRUNPTk5SRVNFVFwiKSE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBucmVhZCA9IGNvZGVNYXAuZ2V0KFwiVU5LTk9XTlwiKSE7XG4gICAgICB9XG5cbiAgICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KDApO1xuICAgIH1cblxuICAgIG5yZWFkID8/PSBjb2RlTWFwLmdldChcIkVPRlwiKSE7XG5cbiAgICBzdHJlYW1CYXNlU3RhdGVba1JlYWRCeXRlc09yRXJyb3JdID0gbnJlYWQ7XG5cbiAgICBpZiAobnJlYWQgPiAwKSB7XG4gICAgICB0aGlzLmJ5dGVzUmVhZCArPSBucmVhZDtcbiAgICB9XG5cbiAgICBidWYgPSBidWYuc2xpY2UoMCwgbnJlYWQpO1xuXG4gICAgc3RyZWFtQmFzZVN0YXRlW2tBcnJheUJ1ZmZlck9mZnNldF0gPSAwO1xuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMub25yZWFkIShidWYsIG5yZWFkKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIHN3YWxsb3cgY2FsbGJhY2sgZXJyb3JzLlxuICAgIH1cblxuICAgIGlmIChucmVhZCA+PSAwICYmIHRoaXMuI3JlYWRpbmcpIHtcbiAgICAgIHRoaXMuI3JlYWQoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIGZvciB3cml0aW5nIHRvIHRoZSBhdHRhY2hlZCBzdHJlYW0uXG4gICAqIEBwYXJhbSByZXEgQSB3cml0ZSByZXF1ZXN0IHdyYXBwZXIuXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBVaW50OEFycmF5IGJ1ZmZlciB0byB3cml0ZSB0byB0aGUgc3RyZWFtLlxuICAgKi9cbiAgYXN5bmMgI3dyaXRlKHJlcTogV3JpdGVXcmFwPExpYnV2U3RyZWFtV3JhcD4sIGRhdGE6IFVpbnQ4QXJyYXkpIHtcbiAgICBjb25zdCB7IGJ5dGVMZW5ndGggfSA9IGRhdGE7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgd3JpdGVBbGwodGhpc1trU3RyZWFtQmFzZUZpZWxkXSEsIGRhdGEpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxldCBzdGF0dXM6IG51bWJlcjtcblxuICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVyciB0byBzdGF0dXMgY29kZXNcbiAgICAgIGlmIChcbiAgICAgICAgZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlIHx8XG4gICAgICAgIGUgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ccm9rZW5QaXBlXG4gICAgICApIHtcbiAgICAgICAgc3RhdHVzID0gY29kZU1hcC5nZXQoXCJFQkFERlwiKSE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0dXMgPSBjb2RlTWFwLmdldChcIlVOS05PV05cIikhO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICByZXEub25jb21wbGV0ZShzdGF0dXMpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIHN3YWxsb3cgY2FsbGJhY2sgZXJyb3JzLlxuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3RyZWFtQmFzZVN0YXRlW2tCeXRlc1dyaXR0ZW5dID0gYnl0ZUxlbmd0aDtcbiAgICB0aGlzLmJ5dGVzV3JpdHRlbiArPSBieXRlTGVuZ3RoO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlcS5vbmNvbXBsZXRlKDApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFB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