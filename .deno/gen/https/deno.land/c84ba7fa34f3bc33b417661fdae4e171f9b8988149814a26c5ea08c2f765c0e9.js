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
// - https://github.com/nodejs/node/blob/master/src/pipe_wrap.cc
// - https://github.com/nodejs/node/blob/master/src/pipe_wrap.h
import { notImplemented } from "../_utils.ts";
import { unreachable } from "../../_util/asserts.ts";
import { ConnectionWrap } from "./connection_wrap.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { LibuvStreamWrap } from "./stream_wrap.ts";
import { codeMap } from "./uv.ts";
import { delay } from "../../async/mod.ts";
import { kStreamBaseField } from "./stream_wrap.ts";
import { ceilPowOf2, INITIAL_ACCEPT_BACKOFF_DELAY, MAX_ACCEPT_BACKOFF_DELAY } from "./_listen.ts";
import { isWindows } from "../../_util/os.ts";
import { fs } from "./constants.ts";
export var socketType;
(function(socketType) {
    socketType[socketType["SOCKET"] = 0] = "SOCKET";
    socketType[socketType["SERVER"] = 1] = "SERVER";
    socketType[socketType["IPC"] = 2] = "IPC";
})(socketType || (socketType = {}));
export class Pipe extends ConnectionWrap {
    reading = false;
    ipc;
    // REF: https://github.com/nodejs/node/blob/master/deps/uv/src/win/pipe.c#L48
    #pendingInstances = 4;
    #address;
    #backlog;
    #listener;
    #connections = 0;
    #closed = false;
    #acceptBackoffDelay;
    constructor(type, conn){
        let provider;
        let ipc;
        switch(type){
            case socketType.SOCKET:
                {
                    provider = providerType.PIPEWRAP;
                    ipc = false;
                    break;
                }
            case socketType.SERVER:
                {
                    provider = providerType.PIPESERVERWRAP;
                    ipc = false;
                    break;
                }
            case socketType.IPC:
                {
                    provider = providerType.PIPEWRAP;
                    ipc = true;
                    break;
                }
            default:
                {
                    unreachable();
                }
        }
        super(provider, conn);
        this.ipc = ipc;
        if (conn && provider === providerType.PIPEWRAP) {
            const localAddr = conn.localAddr;
            this.#address = localAddr.path;
        }
    }
    open(_fd) {
        // REF: https://github.com/denoland/deno/issues/6529
        notImplemented("Pipe.prototype.open");
    }
    /**
   * Bind to a Unix domain or Windows named pipe.
   * @param name Unix domain or Windows named pipe the server should listen to.
   * @return An error status code.
   */ bind(name) {
        // Deno doesn't currently separate bind from connect. For now we noop under
        // the assumption we will connect shortly.
        // REF: https://doc.deno.land/deno/unstable/~/Deno.connect
        this.#address = name;
        return 0;
    }
    /**
   * Connect to a Unix domain or Windows named pipe.
   * @param req A PipeConnectWrap instance.
   * @param address Unix domain or Windows named pipe the server should connect to.
   * @return An error status code.
   */ connect(req, address) {
        if (isWindows) {
            // REF: https://github.com/denoland/deno/issues/10244
            notImplemented("Pipe.prototype.connect - Windows");
        }
        const connectOptions = {
            path: address,
            transport: "unix"
        };
        Deno.connect(connectOptions).then((conn)=>{
            const localAddr = conn.localAddr;
            this.#address = req.address = localAddr.path;
            this[kStreamBaseField] = conn;
            try {
                this.afterConnect(req, 0);
            } catch  {
            // swallow callback errors.
            }
        }, (e)=>{
            // TODO(cmorten): correct mapping of connection error to status code.
            let code;
            if (e instanceof Deno.errors.NotFound) {
                code = codeMap.get("ENOENT");
            } else if (e instanceof Deno.errors.PermissionDenied) {
                code = codeMap.get("EACCES");
            } else {
                code = codeMap.get("ECONNREFUSED");
            }
            try {
                this.afterConnect(req, code);
            } catch  {
            // swallow callback errors.
            }
        });
        return 0;
    }
    /**
   * Listen for new connections.
   * @param backlog The maximum length of the queue of pending connections.
   * @return An error status code.
   */ listen(backlog) {
        if (isWindows) {
            // REF: https://github.com/denoland/deno/issues/10244
            notImplemented("Pipe.prototype.listen - Windows");
        }
        this.#backlog = isWindows ? this.#pendingInstances : ceilPowOf2(backlog + 1);
        const listenOptions = {
            path: this.#address,
            transport: "unix"
        };
        let listener;
        try {
            listener = Deno.listen(listenOptions);
        } catch (e) {
            if (e instanceof Deno.errors.AddrInUse) {
                return codeMap.get("EADDRINUSE");
            } else if (e instanceof Deno.errors.AddrNotAvailable) {
                return codeMap.get("EADDRNOTAVAIL");
            }
            // TODO(cmorten): map errors to appropriate error codes.
            return codeMap.get("UNKNOWN");
        }
        const address = listener.addr;
        this.#address = address.path;
        this.#listener = listener;
        this.#accept();
        return 0;
    }
    ref() {
        if (this.#listener) {
            this.#listener.ref();
        }
    }
    unref() {
        if (this.#listener) {
            this.#listener.unref();
        }
    }
    /**
   * Set the number of pending pipe instance handles when the pipe server is
   * waiting for connections. This setting applies to Windows only.
   * @param instances Number of pending pipe instances.
   */ setPendingInstances(instances) {
        this.#pendingInstances = instances;
    }
    /**
   * Alters pipe permissions, allowing it to be accessed from processes run by
   * different users. Makes the pipe writable or readable by all users. Mode
   * can be `UV_WRITABLE`, `UV_READABLE` or `UV_WRITABLE | UV_READABLE`. This
   * function is blocking.
   * @param mode Pipe permissions mode.
   * @return An error status code.
   */ fchmod(mode) {
        if (mode != constants.UV_READABLE && mode != constants.UV_WRITABLE && mode != (constants.UV_WRITABLE | constants.UV_READABLE)) {
            return codeMap.get("EINVAL");
        }
        let desired_mode = 0;
        if (mode & constants.UV_READABLE) {
            desired_mode |= fs.S_IRUSR | fs.S_IRGRP | fs.S_IROTH;
        }
        if (mode & constants.UV_WRITABLE) {
            desired_mode |= fs.S_IWUSR | fs.S_IWGRP | fs.S_IWOTH;
        }
        // TODO(cmorten): this will incorrectly throw on Windows
        // REF: https://github.com/denoland/deno/issues/4357
        try {
            Deno.chmodSync(this.#address, desired_mode);
        } catch  {
            // TODO(cmorten): map errors to appropriate error codes.
            return codeMap.get("UNKNOWN");
        }
        return 0;
    }
    /** Handle backoff delays following an unsuccessful accept. */ async #acceptBackoff() {
        // Backoff after transient errors to allow time for the system to
        // recover, and avoid blocking up the event loop with a continuously
        // running loop.
        if (!this.#acceptBackoffDelay) {
            this.#acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
        } else {
            this.#acceptBackoffDelay *= 2;
        }
        if (this.#acceptBackoffDelay >= MAX_ACCEPT_BACKOFF_DELAY) {
            this.#acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
        }
        await delay(this.#acceptBackoffDelay);
        this.#accept();
    }
    /** Accept new connections. */ async #accept() {
        if (this.#closed) {
            return;
        }
        if (this.#connections > this.#backlog) {
            this.#acceptBackoff();
            return;
        }
        let connection;
        try {
            connection = await this.#listener.accept();
        } catch (e) {
            if (e instanceof Deno.errors.BadResource && this.#closed) {
                // Listener and server has closed.
                return;
            }
            try {
                // TODO(cmorten): map errors to appropriate error codes.
                this.onconnection(codeMap.get("UNKNOWN"), undefined);
            } catch  {
            // swallow callback errors.
            }
            this.#acceptBackoff();
            return;
        }
        // Reset the backoff delay upon successful accept.
        this.#acceptBackoffDelay = undefined;
        const connectionHandle = new Pipe(socketType.SOCKET, connection);
        this.#connections++;
        try {
            this.onconnection(0, connectionHandle);
        } catch  {
        // swallow callback errors.
        }
        return this.#accept();
    }
    /** Handle server closure. */ _onClose() {
        this.#closed = true;
        this.reading = false;
        this.#address = undefined;
        this.#backlog = undefined;
        this.#connections = 0;
        this.#acceptBackoffDelay = undefined;
        if (this.provider === providerType.PIPESERVERWRAP) {
            try {
                this.#listener.close();
            } catch  {
            // listener already closed
            }
        }
        return LibuvStreamWrap.prototype._onClose.call(this);
    }
}
export class PipeConnectWrap extends AsyncWrap {
    oncomplete;
    address;
    constructor(){
        super(providerType.PIPECONNECTWRAP);
    }
}
export var constants;
(function(constants) {
    constants[constants["SOCKET"] = socketType.SOCKET] = "SOCKET";
    constants[constants["SERVER"] = socketType.SERVER] = "SERVER";
    constants[constants["IPC"] = socketType.IPC] = "IPC";
    constants[constants["UV_READABLE"] = 1] = "UV_READABLE";
    constants[constants["UV_WRITABLE"] = 2] = "UV_WRITABLE";
})(constants || (constants = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9waXBlX3dyYXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBUaGlzIG1vZHVsZSBwb3J0czpcbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy9waXBlX3dyYXAuY2Ncbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy9waXBlX3dyYXAuaFxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IHVucmVhY2hhYmxlIH0gZnJvbSBcIi4uLy4uL191dGlsL2Fzc2VydHMudHNcIjtcbmltcG9ydCB7IENvbm5lY3Rpb25XcmFwIH0gZnJvbSBcIi4vY29ubmVjdGlvbl93cmFwLnRzXCI7XG5pbXBvcnQgeyBBc3luY1dyYXAsIHByb3ZpZGVyVHlwZSB9IGZyb20gXCIuL2FzeW5jX3dyYXAudHNcIjtcbmltcG9ydCB7IExpYnV2U3RyZWFtV3JhcCB9IGZyb20gXCIuL3N0cmVhbV93cmFwLnRzXCI7XG5pbXBvcnQgeyBjb2RlTWFwIH0gZnJvbSBcIi4vdXYudHNcIjtcbmltcG9ydCB7IGRlbGF5IH0gZnJvbSBcIi4uLy4uL2FzeW5jL21vZC50c1wiO1xuaW1wb3J0IHsga1N0cmVhbUJhc2VGaWVsZCB9IGZyb20gXCIuL3N0cmVhbV93cmFwLnRzXCI7XG5pbXBvcnQge1xuICBjZWlsUG93T2YyLFxuICBJTklUSUFMX0FDQ0VQVF9CQUNLT0ZGX0RFTEFZLFxuICBNQVhfQUNDRVBUX0JBQ0tPRkZfREVMQVksXG59IGZyb20gXCIuL19saXN0ZW4udHNcIjtcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi8uLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgZnMgfSBmcm9tIFwiLi9jb25zdGFudHMudHNcIjtcblxuZXhwb3J0IGVudW0gc29ja2V0VHlwZSB7XG4gIFNPQ0tFVCxcbiAgU0VSVkVSLFxuICBJUEMsXG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlIGV4dGVuZHMgQ29ubmVjdGlvbldyYXAge1xuICBvdmVycmlkZSByZWFkaW5nID0gZmFsc2U7XG4gIGlwYzogYm9vbGVhbjtcblxuICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9kZXBzL3V2L3NyYy93aW4vcGlwZS5jI0w0OFxuICAjcGVuZGluZ0luc3RhbmNlcyA9IDQ7XG5cbiAgI2FkZHJlc3M/OiBzdHJpbmc7XG5cbiAgI2JhY2tsb2c/OiBudW1iZXI7XG4gICNsaXN0ZW5lciE6IERlbm8uTGlzdGVuZXI7XG4gICNjb25uZWN0aW9ucyA9IDA7XG5cbiAgI2Nsb3NlZCA9IGZhbHNlO1xuICAjYWNjZXB0QmFja29mZkRlbGF5PzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHR5cGU6IG51bWJlciwgY29ubj86IERlbm8uVW5peENvbm4pIHtcbiAgICBsZXQgcHJvdmlkZXI6IHByb3ZpZGVyVHlwZTtcbiAgICBsZXQgaXBjOiBib29sZWFuO1xuXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIHNvY2tldFR5cGUuU09DS0VUOiB7XG4gICAgICAgIHByb3ZpZGVyID0gcHJvdmlkZXJUeXBlLlBJUEVXUkFQO1xuICAgICAgICBpcGMgPSBmYWxzZTtcblxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2Ugc29ja2V0VHlwZS5TRVJWRVI6IHtcbiAgICAgICAgcHJvdmlkZXIgPSBwcm92aWRlclR5cGUuUElQRVNFUlZFUldSQVA7XG4gICAgICAgIGlwYyA9IGZhbHNlO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBzb2NrZXRUeXBlLklQQzoge1xuICAgICAgICBwcm92aWRlciA9IHByb3ZpZGVyVHlwZS5QSVBFV1JBUDtcbiAgICAgICAgaXBjID0gdHJ1ZTtcblxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgdW5yZWFjaGFibGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdXBlcihwcm92aWRlciwgY29ubik7XG5cbiAgICB0aGlzLmlwYyA9IGlwYztcblxuICAgIGlmIChjb25uICYmIHByb3ZpZGVyID09PSBwcm92aWRlclR5cGUuUElQRVdSQVApIHtcbiAgICAgIGNvbnN0IGxvY2FsQWRkciA9IGNvbm4ubG9jYWxBZGRyIGFzIERlbm8uVW5peEFkZHI7XG4gICAgICB0aGlzLiNhZGRyZXNzID0gbG9jYWxBZGRyLnBhdGg7XG4gICAgfVxuICB9XG5cbiAgb3BlbihfZmQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgLy8gUkVGOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvNjUyOVxuICAgIG5vdEltcGxlbWVudGVkKFwiUGlwZS5wcm90b3R5cGUub3BlblwiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCaW5kIHRvIGEgVW5peCBkb21haW4gb3IgV2luZG93cyBuYW1lZCBwaXBlLlxuICAgKiBAcGFyYW0gbmFtZSBVbml4IGRvbWFpbiBvciBXaW5kb3dzIG5hbWVkIHBpcGUgdGhlIHNlcnZlciBzaG91bGQgbGlzdGVuIHRvLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgYmluZChuYW1lOiBzdHJpbmcpIHtcbiAgICAvLyBEZW5vIGRvZXNuJ3QgY3VycmVudGx5IHNlcGFyYXRlIGJpbmQgZnJvbSBjb25uZWN0LiBGb3Igbm93IHdlIG5vb3AgdW5kZXJcbiAgICAvLyB0aGUgYXNzdW1wdGlvbiB3ZSB3aWxsIGNvbm5lY3Qgc2hvcnRseS5cbiAgICAvLyBSRUY6IGh0dHBzOi8vZG9jLmRlbm8ubGFuZC9kZW5vL3Vuc3RhYmxlL34vRGVuby5jb25uZWN0XG5cbiAgICB0aGlzLiNhZGRyZXNzID0gbmFtZTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbm5lY3QgdG8gYSBVbml4IGRvbWFpbiBvciBXaW5kb3dzIG5hbWVkIHBpcGUuXG4gICAqIEBwYXJhbSByZXEgQSBQaXBlQ29ubmVjdFdyYXAgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSBhZGRyZXNzIFVuaXggZG9tYWluIG9yIFdpbmRvd3MgbmFtZWQgcGlwZSB0aGUgc2VydmVyIHNob3VsZCBjb25uZWN0IHRvLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgY29ubmVjdChyZXE6IFBpcGVDb25uZWN0V3JhcCwgYWRkcmVzczogc3RyaW5nKSB7XG4gICAgaWYgKGlzV2luZG93cykge1xuICAgICAgLy8gUkVGOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvMTAyNDRcbiAgICAgIG5vdEltcGxlbWVudGVkKFwiUGlwZS5wcm90b3R5cGUuY29ubmVjdCAtIFdpbmRvd3NcIik7XG4gICAgfVxuXG4gICAgY29uc3QgY29ubmVjdE9wdGlvbnM6IERlbm8uVW5peENvbm5lY3RPcHRpb25zID0ge1xuICAgICAgcGF0aDogYWRkcmVzcyxcbiAgICAgIHRyYW5zcG9ydDogXCJ1bml4XCIsXG4gICAgfTtcblxuICAgIERlbm8uY29ubmVjdChjb25uZWN0T3B0aW9ucykudGhlbihcbiAgICAgIChjb25uOiBEZW5vLlVuaXhDb25uKSA9PiB7XG4gICAgICAgIGNvbnN0IGxvY2FsQWRkciA9IGNvbm4ubG9jYWxBZGRyIGFzIERlbm8uVW5peEFkZHI7XG5cbiAgICAgICAgdGhpcy4jYWRkcmVzcyA9IHJlcS5hZGRyZXNzID0gbG9jYWxBZGRyLnBhdGg7XG4gICAgICAgIHRoaXNba1N0cmVhbUJhc2VGaWVsZF0gPSBjb25uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5hZnRlckNvbm5lY3QocmVxLCAwKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAoZSkgPT4ge1xuICAgICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBjb3JyZWN0IG1hcHBpbmcgb2YgY29ubmVjdGlvbiBlcnJvciB0byBzdGF0dXMgY29kZS5cbiAgICAgICAgbGV0IGNvZGU6IG51bWJlcjtcblxuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgICAgICAgY29kZSA9IGNvZGVNYXAuZ2V0KFwiRU5PRU5UXCIpITtcbiAgICAgICAgfSBlbHNlIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuUGVybWlzc2lvbkRlbmllZCkge1xuICAgICAgICAgIGNvZGUgPSBjb2RlTWFwLmdldChcIkVBQ0NFU1wiKSE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29kZSA9IGNvZGVNYXAuZ2V0KFwiRUNPTk5SRUZVU0VEXCIpITtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5hZnRlckNvbm5lY3QocmVxLCBjb2RlKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3RlbiBmb3IgbmV3IGNvbm5lY3Rpb25zLlxuICAgKiBAcGFyYW0gYmFja2xvZyBUaGUgbWF4aW11bSBsZW5ndGggb2YgdGhlIHF1ZXVlIG9mIHBlbmRpbmcgY29ubmVjdGlvbnMuXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBsaXN0ZW4oYmFja2xvZzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAoaXNXaW5kb3dzKSB7XG4gICAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy8xMDI0NFxuICAgICAgbm90SW1wbGVtZW50ZWQoXCJQaXBlLnByb3RvdHlwZS5saXN0ZW4gLSBXaW5kb3dzXCIpO1xuICAgIH1cblxuICAgIHRoaXMuI2JhY2tsb2cgPSBpc1dpbmRvd3NcbiAgICAgID8gdGhpcy4jcGVuZGluZ0luc3RhbmNlc1xuICAgICAgOiBjZWlsUG93T2YyKGJhY2tsb2cgKyAxKTtcblxuICAgIGNvbnN0IGxpc3Rlbk9wdGlvbnMgPSB7XG4gICAgICBwYXRoOiB0aGlzLiNhZGRyZXNzISxcbiAgICAgIHRyYW5zcG9ydDogXCJ1bml4XCIgYXMgY29uc3QsXG4gICAgfTtcblxuICAgIGxldCBsaXN0ZW5lcjtcblxuICAgIHRyeSB7XG4gICAgICBsaXN0ZW5lciA9IERlbm8ubGlzdGVuKGxpc3Rlbk9wdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQWRkckluVXNlKSB7XG4gICAgICAgIHJldHVybiBjb2RlTWFwLmdldChcIkVBRERSSU5VU0VcIikhO1xuICAgICAgfSBlbHNlIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQWRkck5vdEF2YWlsYWJsZSkge1xuICAgICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFQUREUk5PVEFWQUlMXCIpITtcbiAgICAgIH1cblxuICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVycm9ycyB0byBhcHByb3ByaWF0ZSBlcnJvciBjb2Rlcy5cbiAgICAgIHJldHVybiBjb2RlTWFwLmdldChcIlVOS05PV05cIikhO1xuICAgIH1cblxuICAgIGNvbnN0IGFkZHJlc3MgPSBsaXN0ZW5lci5hZGRyIGFzIERlbm8uVW5peEFkZHI7XG4gICAgdGhpcy4jYWRkcmVzcyA9IGFkZHJlc3MucGF0aDtcblxuICAgIHRoaXMuI2xpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgdGhpcy4jYWNjZXB0KCk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIG92ZXJyaWRlIHJlZigpIHtcbiAgICBpZiAodGhpcy4jbGlzdGVuZXIpIHtcbiAgICAgIHRoaXMuI2xpc3RlbmVyLnJlZigpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIHVucmVmKCkge1xuICAgIGlmICh0aGlzLiNsaXN0ZW5lcikge1xuICAgICAgdGhpcy4jbGlzdGVuZXIudW5yZWYoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBudW1iZXIgb2YgcGVuZGluZyBwaXBlIGluc3RhbmNlIGhhbmRsZXMgd2hlbiB0aGUgcGlwZSBzZXJ2ZXIgaXNcbiAgICogd2FpdGluZyBmb3IgY29ubmVjdGlvbnMuIFRoaXMgc2V0dGluZyBhcHBsaWVzIHRvIFdpbmRvd3Mgb25seS5cbiAgICogQHBhcmFtIGluc3RhbmNlcyBOdW1iZXIgb2YgcGVuZGluZyBwaXBlIGluc3RhbmNlcy5cbiAgICovXG4gIHNldFBlbmRpbmdJbnN0YW5jZXMoaW5zdGFuY2VzOiBudW1iZXIpIHtcbiAgICB0aGlzLiNwZW5kaW5nSW5zdGFuY2VzID0gaW5zdGFuY2VzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFsdGVycyBwaXBlIHBlcm1pc3Npb25zLCBhbGxvd2luZyBpdCB0byBiZSBhY2Nlc3NlZCBmcm9tIHByb2Nlc3NlcyBydW4gYnlcbiAgICogZGlmZmVyZW50IHVzZXJzLiBNYWtlcyB0aGUgcGlwZSB3cml0YWJsZSBvciByZWFkYWJsZSBieSBhbGwgdXNlcnMuIE1vZGVcbiAgICogY2FuIGJlIGBVVl9XUklUQUJMRWAsIGBVVl9SRUFEQUJMRWAgb3IgYFVWX1dSSVRBQkxFIHwgVVZfUkVBREFCTEVgLiBUaGlzXG4gICAqIGZ1bmN0aW9uIGlzIGJsb2NraW5nLlxuICAgKiBAcGFyYW0gbW9kZSBQaXBlIHBlcm1pc3Npb25zIG1vZGUuXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBmY2htb2QobW9kZTogbnVtYmVyKSB7XG4gICAgaWYgKFxuICAgICAgbW9kZSAhPSBjb25zdGFudHMuVVZfUkVBREFCTEUgJiZcbiAgICAgIG1vZGUgIT0gY29uc3RhbnRzLlVWX1dSSVRBQkxFICYmXG4gICAgICBtb2RlICE9IChjb25zdGFudHMuVVZfV1JJVEFCTEUgfCBjb25zdGFudHMuVVZfUkVBREFCTEUpXG4gICAgKSB7XG4gICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFSU5WQUxcIik7XG4gICAgfVxuXG4gICAgbGV0IGRlc2lyZWRfbW9kZSA9IDA7XG5cbiAgICBpZiAobW9kZSAmIGNvbnN0YW50cy5VVl9SRUFEQUJMRSkge1xuICAgICAgZGVzaXJlZF9tb2RlIHw9IGZzLlNfSVJVU1IgfCBmcy5TX0lSR1JQIHwgZnMuU19JUk9USDtcbiAgICB9XG4gICAgaWYgKG1vZGUgJiBjb25zdGFudHMuVVZfV1JJVEFCTEUpIHtcbiAgICAgIGRlc2lyZWRfbW9kZSB8PSBmcy5TX0lXVVNSIHwgZnMuU19JV0dSUCB8IGZzLlNfSVdPVEg7XG4gICAgfVxuXG4gICAgLy8gVE9ETyhjbW9ydGVuKTogdGhpcyB3aWxsIGluY29ycmVjdGx5IHRocm93IG9uIFdpbmRvd3NcbiAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy80MzU3XG4gICAgdHJ5IHtcbiAgICAgIERlbm8uY2htb2RTeW5jKHRoaXMuI2FkZHJlc3MhLCBkZXNpcmVkX21vZGUpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVycm9ycyB0byBhcHByb3ByaWF0ZSBlcnJvciBjb2Rlcy5cbiAgICAgIHJldHVybiBjb2RlTWFwLmdldChcIlVOS05PV05cIikhO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqIEhhbmRsZSBiYWNrb2ZmIGRlbGF5cyBmb2xsb3dpbmcgYW4gdW5zdWNjZXNzZnVsIGFjY2VwdC4gKi9cbiAgYXN5bmMgI2FjY2VwdEJhY2tvZmYoKSB7XG4gICAgLy8gQmFja29mZiBhZnRlciB0cmFuc2llbnQgZXJyb3JzIHRvIGFsbG93IHRpbWUgZm9yIHRoZSBzeXN0ZW0gdG9cbiAgICAvLyByZWNvdmVyLCBhbmQgYXZvaWQgYmxvY2tpbmcgdXAgdGhlIGV2ZW50IGxvb3Agd2l0aCBhIGNvbnRpbnVvdXNseVxuICAgIC8vIHJ1bm5pbmcgbG9vcC5cbiAgICBpZiAoIXRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSkge1xuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZkRlbGF5ID0gSU5JVElBTF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZkRlbGF5ICo9IDI7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSA+PSBNQVhfQUNDRVBUX0JBQ0tPRkZfREVMQVkpIHtcbiAgICAgIHRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSA9IE1BWF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICB9XG5cbiAgICBhd2FpdCBkZWxheSh0aGlzLiNhY2NlcHRCYWNrb2ZmRGVsYXkpO1xuXG4gICAgdGhpcy4jYWNjZXB0KCk7XG4gIH1cblxuICAvKiogQWNjZXB0IG5ldyBjb25uZWN0aW9ucy4gKi9cbiAgYXN5bmMgI2FjY2VwdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy4jY2xvc2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI2Nvbm5lY3Rpb25zID4gdGhpcy4jYmFja2xvZyEpIHtcbiAgICAgIHRoaXMuI2FjY2VwdEJhY2tvZmYoKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBjb25uZWN0aW9uOiBEZW5vLkNvbm47XG5cbiAgICB0cnkge1xuICAgICAgY29ubmVjdGlvbiA9IGF3YWl0IHRoaXMuI2xpc3RlbmVyLmFjY2VwdCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQmFkUmVzb3VyY2UgJiYgdGhpcy4jY2xvc2VkKSB7XG4gICAgICAgIC8vIExpc3RlbmVyIGFuZCBzZXJ2ZXIgaGFzIGNsb3NlZC5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBtYXAgZXJyb3JzIHRvIGFwcHJvcHJpYXRlIGVycm9yIGNvZGVzLlxuICAgICAgICB0aGlzLm9uY29ubmVjdGlvbiEoY29kZU1hcC5nZXQoXCJVTktOT1dOXCIpISwgdW5kZWZpbmVkKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBzd2FsbG93IGNhbGxiYWNrIGVycm9ycy5cbiAgICAgIH1cblxuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZigpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVzZXQgdGhlIGJhY2tvZmYgZGVsYXkgdXBvbiBzdWNjZXNzZnVsIGFjY2VwdC5cbiAgICB0aGlzLiNhY2NlcHRCYWNrb2ZmRGVsYXkgPSB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBjb25uZWN0aW9uSGFuZGxlID0gbmV3IFBpcGUoc29ja2V0VHlwZS5TT0NLRVQsIGNvbm5lY3Rpb24pO1xuICAgIHRoaXMuI2Nvbm5lY3Rpb25zKys7XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5vbmNvbm5lY3Rpb24hKDAsIGNvbm5lY3Rpb25IYW5kbGUpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuI2FjY2VwdCgpO1xuICB9XG5cbiAgLyoqIEhhbmRsZSBzZXJ2ZXIgY2xvc3VyZS4gKi9cbiAgb3ZlcnJpZGUgX29uQ2xvc2UoKTogbnVtYmVyIHtcbiAgICB0aGlzLiNjbG9zZWQgPSB0cnVlO1xuICAgIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy4jYWRkcmVzcyA9IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuI2JhY2tsb2cgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy4jY29ubmVjdGlvbnMgPSAwO1xuICAgIHRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSA9IHVuZGVmaW5lZDtcblxuICAgIGlmICh0aGlzLnByb3ZpZGVyID09PSBwcm92aWRlclR5cGUuUElQRVNFUlZFUldSQVApIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuI2xpc3RlbmVyLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gbGlzdGVuZXIgYWxyZWFkeSBjbG9zZWRcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gTGlidXZTdHJlYW1XcmFwLnByb3RvdHlwZS5fb25DbG9zZS5jYWxsKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQ29ubmVjdFdyYXAgZXh0ZW5kcyBBc3luY1dyYXAge1xuICBvbmNvbXBsZXRlITogKFxuICAgIHN0YXR1czogbnVtYmVyLFxuICAgIGhhbmRsZTogQ29ubmVjdGlvbldyYXAsXG4gICAgcmVxOiBQaXBlQ29ubmVjdFdyYXAsXG4gICAgcmVhZGFibGU6IGJvb2xlYW4sXG4gICAgd3JpdGVhYmxlOiBib29sZWFuLFxuICApID0+IHZvaWQ7XG4gIGFkZHJlc3MhOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIocHJvdmlkZXJUeXBlLlBJUEVDT05ORUNUV1JBUCk7XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gY29uc3RhbnRzIHtcbiAgU09DS0VUID0gc29ja2V0VHlwZS5TT0NLRVQsXG4gIFNFUlZFUiA9IHNvY2tldFR5cGUuU0VSVkVSLFxuICBJUEMgPSBzb2NrZXRUeXBlLklQQyxcbiAgVVZfUkVBREFCTEUgPSAxLFxuICBVVl9XUklUQUJMRSA9IDIsXG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0Usd0VBQXdFO0FBQ3hFLDRFQUE0RTtBQUM1RSx5Q0FBeUM7QUFFekMscUJBQXFCO0FBQ3JCLGdFQUFnRTtBQUNoRSwrREFBK0Q7QUFFL0QsU0FBUyxjQUFjLFFBQVEsZUFBZTtBQUM5QyxTQUFTLFdBQVcsUUFBUSx5QkFBeUI7QUFDckQsU0FBUyxjQUFjLFFBQVEsdUJBQXVCO0FBQ3RELFNBQVMsU0FBUyxFQUFFLFlBQVksUUFBUSxrQkFBa0I7QUFDMUQsU0FBUyxlQUFlLFFBQVEsbUJBQW1CO0FBQ25ELFNBQVMsT0FBTyxRQUFRLFVBQVU7QUFDbEMsU0FBUyxLQUFLLFFBQVEscUJBQXFCO0FBQzNDLFNBQVMsZ0JBQWdCLFFBQVEsbUJBQW1CO0FBQ3BELFNBQ0UsVUFBVSxFQUNWLDRCQUE0QixFQUM1Qix3QkFBd0IsUUFDbkIsZUFBZTtBQUN0QixTQUFTLFNBQVMsUUFBUSxvQkFBb0I7QUFDOUMsU0FBUyxFQUFFLFFBQVEsaUJBQWlCO1dBRTdCO1VBQUssVUFBVTtJQUFWLFdBQUEsV0FDVixZQUFBLEtBQUE7SUFEVSxXQUFBLFdBRVYsWUFBQSxLQUFBO0lBRlUsV0FBQSxXQUdWLFNBQUEsS0FBQTtHQUhVLGVBQUE7QUFNWixPQUFPLE1BQU0sYUFBYTtJQUNmLFVBQVUsS0FBSyxDQUFDO0lBQ3pCLElBQWE7SUFFYiw2RUFBNkU7SUFDN0UsQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFO0lBRXRCLENBQUMsT0FBTyxDQUFVO0lBRWxCLENBQUMsT0FBTyxDQUFVO0lBQ2xCLENBQUMsUUFBUSxDQUFpQjtJQUMxQixDQUFDLFdBQVcsR0FBRyxFQUFFO0lBRWpCLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNoQixDQUFDLGtCQUFrQixDQUFVO0lBRTdCLFlBQVksSUFBWSxFQUFFLElBQW9CLENBQUU7UUFDOUMsSUFBSTtRQUNKLElBQUk7UUFFSixPQUFRO1lBQ04sS0FBSyxXQUFXLE1BQU07Z0JBQUU7b0JBQ3RCLFdBQVcsYUFBYSxRQUFRO29CQUNoQyxNQUFNLEtBQUs7b0JBRVgsS0FBTTtnQkFDUjtZQUNBLEtBQUssV0FBVyxNQUFNO2dCQUFFO29CQUN0QixXQUFXLGFBQWEsY0FBYztvQkFDdEMsTUFBTSxLQUFLO29CQUVYLEtBQU07Z0JBQ1I7WUFDQSxLQUFLLFdBQVcsR0FBRztnQkFBRTtvQkFDbkIsV0FBVyxhQUFhLFFBQVE7b0JBQ2hDLE1BQU0sSUFBSTtvQkFFVixLQUFNO2dCQUNSO1lBQ0E7Z0JBQVM7b0JBQ1A7Z0JBQ0Y7UUFDRjtRQUVBLEtBQUssQ0FBQyxVQUFVO1FBRWhCLElBQUksQ0FBQyxHQUFHLEdBQUc7UUFFWCxJQUFJLFFBQVEsYUFBYSxhQUFhLFFBQVEsRUFBRTtZQUM5QyxNQUFNLFlBQVksS0FBSyxTQUFTO1lBQ2hDLElBQUksQ0FBQyxDQUFDLE9BQU8sR0FBRyxVQUFVLElBQUk7UUFDaEMsQ0FBQztJQUNIO0lBRUEsS0FBSyxHQUFXLEVBQVU7UUFDeEIsb0RBQW9EO1FBQ3BELGVBQWU7SUFDakI7SUFFQTs7OztHQUlDLEdBQ0QsS0FBSyxJQUFZLEVBQUU7UUFDakIsMkVBQTJFO1FBQzNFLDBDQUEwQztRQUMxQywwREFBMEQ7UUFFMUQsSUFBSSxDQUFDLENBQUMsT0FBTyxHQUFHO1FBRWhCLE9BQU87SUFDVDtJQUVBOzs7OztHQUtDLEdBQ0QsUUFBUSxHQUFvQixFQUFFLE9BQWUsRUFBRTtRQUM3QyxJQUFJLFdBQVc7WUFDYixxREFBcUQ7WUFDckQsZUFBZTtRQUNqQixDQUFDO1FBRUQsTUFBTSxpQkFBMEM7WUFDOUMsTUFBTTtZQUNOLFdBQVc7UUFDYjtRQUVBLEtBQUssT0FBTyxDQUFDLGdCQUFnQixJQUFJLENBQy9CLENBQUMsT0FBd0I7WUFDdkIsTUFBTSxZQUFZLEtBQUssU0FBUztZQUVoQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLEdBQUcsVUFBVSxJQUFJO1lBQzVDLElBQUksQ0FBQyxpQkFBaUIsR0FBRztZQUV6QixJQUFJO2dCQUNGLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSztZQUN6QixFQUFFLE9BQU07WUFDTiwyQkFBMkI7WUFDN0I7UUFDRixHQUNBLENBQUMsSUFBTTtZQUNMLHFFQUFxRTtZQUNyRSxJQUFJO1lBRUosSUFBSSxhQUFhLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDckMsT0FBTyxRQUFRLEdBQUcsQ0FBQztZQUNyQixPQUFPLElBQUksYUFBYSxLQUFLLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDcEQsT0FBTyxRQUFRLEdBQUcsQ0FBQztZQUNyQixPQUFPO2dCQUNMLE9BQU8sUUFBUSxHQUFHLENBQUM7WUFDckIsQ0FBQztZQUVELElBQUk7Z0JBQ0YsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLO1lBQ3pCLEVBQUUsT0FBTTtZQUNOLDJCQUEyQjtZQUM3QjtRQUNGO1FBR0YsT0FBTztJQUNUO0lBRUE7Ozs7R0FJQyxHQUNELE9BQU8sT0FBZSxFQUFVO1FBQzlCLElBQUksV0FBVztZQUNiLHFEQUFxRDtZQUNyRCxlQUFlO1FBQ2pCLENBQUM7UUFFRCxJQUFJLENBQUMsQ0FBQyxPQUFPLEdBQUcsWUFDWixJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsR0FDdEIsV0FBVyxVQUFVLEVBQUU7UUFFM0IsTUFBTSxnQkFBZ0I7WUFDcEIsTUFBTSxJQUFJLENBQUMsQ0FBQyxPQUFPO1lBQ25CLFdBQVc7UUFDYjtRQUVBLElBQUk7UUFFSixJQUFJO1lBQ0YsV0FBVyxLQUFLLE1BQU0sQ0FBQztRQUN6QixFQUFFLE9BQU8sR0FBRztZQUNWLElBQUksYUFBYSxLQUFLLE1BQU0sQ0FBQyxTQUFTLEVBQUU7Z0JBQ3RDLE9BQU8sUUFBUSxHQUFHLENBQUM7WUFDckIsT0FBTyxJQUFJLGFBQWEsS0FBSyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQ3BELE9BQU8sUUFBUSxHQUFHLENBQUM7WUFDckIsQ0FBQztZQUVELHdEQUF3RDtZQUN4RCxPQUFPLFFBQVEsR0FBRyxDQUFDO1FBQ3JCO1FBRUEsTUFBTSxVQUFVLFNBQVMsSUFBSTtRQUM3QixJQUFJLENBQUMsQ0FBQyxPQUFPLEdBQUcsUUFBUSxJQUFJO1FBRTVCLElBQUksQ0FBQyxDQUFDLFFBQVEsR0FBRztRQUNqQixJQUFJLENBQUMsQ0FBQyxNQUFNO1FBRVosT0FBTztJQUNUO0lBRVMsTUFBTTtRQUNiLElBQUksSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHO1FBQ3BCLENBQUM7SUFDSDtJQUVTLFFBQVE7UUFDZixJQUFJLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRTtZQUNsQixJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSztRQUN0QixDQUFDO0lBQ0g7SUFFQTs7OztHQUlDLEdBQ0Qsb0JBQW9CLFNBQWlCLEVBQUU7UUFDckMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEdBQUc7SUFDM0I7SUFFQTs7Ozs7OztHQU9DLEdBQ0QsT0FBTyxJQUFZLEVBQUU7UUFDbkIsSUFDRSxRQUFRLFVBQVUsV0FBVyxJQUM3QixRQUFRLFVBQVUsV0FBVyxJQUM3QixRQUFRLENBQUMsVUFBVSxXQUFXLEdBQUcsVUFBVSxXQUFXLEdBQ3REO1lBQ0EsT0FBTyxRQUFRLEdBQUcsQ0FBQztRQUNyQixDQUFDO1FBRUQsSUFBSSxlQUFlO1FBRW5CLElBQUksT0FBTyxVQUFVLFdBQVcsRUFBRTtZQUNoQyxnQkFBZ0IsR0FBRyxPQUFPLEdBQUcsR0FBRyxPQUFPLEdBQUcsR0FBRyxPQUFPO1FBQ3RELENBQUM7UUFDRCxJQUFJLE9BQU8sVUFBVSxXQUFXLEVBQUU7WUFDaEMsZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLEdBQUcsT0FBTyxHQUFHLEdBQUcsT0FBTztRQUN0RCxDQUFDO1FBRUQsd0RBQXdEO1FBQ3hELG9EQUFvRDtRQUNwRCxJQUFJO1lBQ0YsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFHO1FBQ2pDLEVBQUUsT0FBTTtZQUNOLHdEQUF3RDtZQUN4RCxPQUFPLFFBQVEsR0FBRyxDQUFDO1FBQ3JCO1FBRUEsT0FBTztJQUNUO0lBRUEsNERBQTRELEdBQzVELE1BQU0sQ0FBQyxhQUFhLEdBQUc7UUFDckIsaUVBQWlFO1FBQ2pFLG9FQUFvRTtRQUNwRSxnQkFBZ0I7UUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGtCQUFrQixFQUFFO1lBQzdCLElBQUksQ0FBQyxDQUFDLGtCQUFrQixHQUFHO1FBQzdCLE9BQU87WUFDTCxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsSUFBSTtRQUM5QixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSwwQkFBMEI7WUFDeEQsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEdBQUc7UUFDN0IsQ0FBQztRQUVELE1BQU0sTUFBTSxJQUFJLENBQUMsQ0FBQyxrQkFBa0I7UUFFcEMsSUFBSSxDQUFDLENBQUMsTUFBTTtJQUNkO0lBRUEsNEJBQTRCLEdBQzVCLE1BQU0sQ0FBQyxNQUFNLEdBQWtCO1FBQzdCLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFO1lBQ2hCO1FBQ0YsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRztZQUN0QyxJQUFJLENBQUMsQ0FBQyxhQUFhO1lBRW5CO1FBQ0YsQ0FBQztRQUVELElBQUk7UUFFSixJQUFJO1lBQ0YsYUFBYSxNQUFNLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNO1FBQzFDLEVBQUUsT0FBTyxHQUFHO1lBQ1YsSUFBSSxhQUFhLEtBQUssTUFBTSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3hELGtDQUFrQztnQkFDbEM7WUFDRixDQUFDO1lBRUQsSUFBSTtnQkFDRix3REFBd0Q7Z0JBQ3hELElBQUksQ0FBQyxZQUFZLENBQUUsUUFBUSxHQUFHLENBQUMsWUFBYTtZQUM5QyxFQUFFLE9BQU07WUFDTiwyQkFBMkI7WUFDN0I7WUFFQSxJQUFJLENBQUMsQ0FBQyxhQUFhO1lBRW5CO1FBQ0Y7UUFFQSxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEdBQUc7UUFFM0IsTUFBTSxtQkFBbUIsSUFBSSxLQUFLLFdBQVcsTUFBTSxFQUFFO1FBQ3JELElBQUksQ0FBQyxDQUFDLFdBQVc7UUFFakIsSUFBSTtZQUNGLElBQUksQ0FBQyxZQUFZLENBQUUsR0FBRztRQUN4QixFQUFFLE9BQU07UUFDTiwyQkFBMkI7UUFDN0I7UUFFQSxPQUFPLElBQUksQ0FBQyxDQUFDLE1BQU07SUFDckI7SUFFQSwyQkFBMkIsR0FDM0IsQUFBUyxXQUFtQjtRQUMxQixJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsSUFBSTtRQUNuQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUs7UUFFcEIsSUFBSSxDQUFDLENBQUMsT0FBTyxHQUFHO1FBRWhCLElBQUksQ0FBQyxDQUFDLE9BQU8sR0FBRztRQUNoQixJQUFJLENBQUMsQ0FBQyxXQUFXLEdBQUc7UUFDcEIsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEdBQUc7UUFFM0IsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLGFBQWEsY0FBYyxFQUFFO1lBQ2pELElBQUk7Z0JBQ0YsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUs7WUFDdEIsRUFBRSxPQUFNO1lBQ04sMEJBQTBCO1lBQzVCO1FBQ0YsQ0FBQztRQUVELE9BQU8sZ0JBQWdCLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUk7SUFDckQ7QUFDRixDQUFDO0FBRUQsT0FBTyxNQUFNLHdCQUF3QjtJQUNuQyxXQU1VO0lBQ1YsUUFBaUI7SUFFakIsYUFBYztRQUNaLEtBQUssQ0FBQyxhQUFhLGVBQWU7SUFDcEM7QUFDRixDQUFDO1dBRU07VUFBSyxTQUFTO0lBQVQsVUFBQSxVQUNWLFlBQVMsV0FBVyxNQUFNLElBQTFCO0lBRFUsVUFBQSxVQUVWLFlBQVMsV0FBVyxNQUFNLElBQTFCO0lBRlUsVUFBQSxVQUdWLFNBQU0sV0FBVyxHQUFHLElBQXBCO0lBSFUsVUFBQSxVQUlWLGlCQUFjLEtBQWQ7SUFKVSxVQUFBLFVBS1YsaUJBQWMsS0FBZDtHQUxVLGNBQUEifQ==