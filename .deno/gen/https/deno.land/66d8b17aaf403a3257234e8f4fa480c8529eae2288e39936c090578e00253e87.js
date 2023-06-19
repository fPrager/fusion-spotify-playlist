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
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { HandleWrap } from "./handle_wrap.ts";
import { ownerSymbol } from "./symbols.ts";
import { codeMap, errorMap } from "./uv.ts";
import { notImplemented } from "../_utils.ts";
import { Buffer } from "../buffer.ts";
import { isIP } from "../internal/net.ts";
import { isLinux, isWindows } from "../../_util/os.ts";
// @ts-ignore Deno[Deno.internal] is used on purpose here
const DenoListenDatagram = Deno[Deno.internal]?.nodeUnstable?.listenDatagram || Deno.listenDatagram;
const AF_INET = 2;
const AF_INET6 = 10;
const UDP_DGRAM_MAXSIZE = 64 * 1024;
export class SendWrap extends AsyncWrap {
    list;
    address;
    port;
    callback;
    oncomplete;
    constructor(){
        super(providerType.UDPSENDWRAP);
    }
}
export class UDP extends HandleWrap {
    [ownerSymbol] = null;
    #address;
    #family;
    #port;
    #remoteAddress;
    #remoteFamily;
    #remotePort;
    #listener;
    #receiving = false;
    #recvBufferSize = UDP_DGRAM_MAXSIZE;
    #sendBufferSize = UDP_DGRAM_MAXSIZE;
    onmessage;
    lookup;
    constructor(){
        super(providerType.UDPWRAP);
    }
    addMembership(_multicastAddress, _interfaceAddress) {
        notImplemented("udp.UDP.prototype.addMembership");
    }
    addSourceSpecificMembership(_sourceAddress, _groupAddress, _interfaceAddress) {
        notImplemented("udp.UDP.prototype.addSourceSpecificMembership");
    }
    /**
   * Bind to an IPv4 address.
   * @param ip The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */ bind(ip, port, flags) {
        return this.#doBind(ip, port, flags, AF_INET);
    }
    /**
   * Bind to an IPv6 address.
   * @param ip The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */ bind6(ip, port, flags) {
        return this.#doBind(ip, port, flags, AF_INET6);
    }
    bufferSize(size, buffer, ctx) {
        let err;
        if (size > UDP_DGRAM_MAXSIZE) {
            err = "EINVAL";
        } else if (!this.#address) {
            err = isWindows ? "ENOTSOCK" : "EBADF";
        }
        if (err) {
            ctx.errno = codeMap.get(err);
            ctx.code = err;
            ctx.message = errorMap.get(ctx.errno)[1];
            ctx.syscall = buffer ? "uv_recv_buffer_size" : "uv_send_buffer_size";
            return;
        }
        if (size !== 0) {
            size = isLinux ? size * 2 : size;
            if (buffer) {
                return this.#recvBufferSize = size;
            }
            return this.#sendBufferSize = size;
        }
        return buffer ? this.#recvBufferSize : this.#sendBufferSize;
    }
    connect(ip, port) {
        return this.#doConnect(ip, port, AF_INET);
    }
    connect6(ip, port) {
        return this.#doConnect(ip, port, AF_INET6);
    }
    disconnect() {
        this.#remoteAddress = undefined;
        this.#remotePort = undefined;
        this.#remoteFamily = undefined;
        return 0;
    }
    dropMembership(_multicastAddress, _interfaceAddress) {
        notImplemented("udp.UDP.prototype.dropMembership");
    }
    dropSourceSpecificMembership(_sourceAddress, _groupAddress, _interfaceAddress) {
        notImplemented("udp.UDP.prototype.dropSourceSpecificMembership");
    }
    /**
   * Populates the provided object with remote address entries.
   * @param peername An object to add the remote address entries to.
   * @return An error status code.
   */ getpeername(peername) {
        if (this.#remoteAddress === undefined) {
            return codeMap.get("EBADF");
        }
        peername.address = this.#remoteAddress;
        peername.port = this.#remotePort;
        peername.family = this.#remoteFamily;
        return 0;
    }
    /**
   * Populates the provided object with local address entries.
   * @param sockname An object to add the local address entries to.
   * @return An error status code.
   */ getsockname(sockname) {
        if (this.#address === undefined) {
            return codeMap.get("EBADF");
        }
        sockname.address = this.#address;
        sockname.port = this.#port;
        sockname.family = this.#family;
        return 0;
    }
    /**
   * Opens a file descriptor.
   * @param fd The file descriptor to open.
   * @return An error status code.
   */ open(_fd) {
        // REF: https://github.com/denoland/deno/issues/6529
        notImplemented("udp.UDP.prototype.open");
    }
    /**
   * Start receiving on the connection.
   * @return An error status code.
   */ recvStart() {
        if (!this.#receiving) {
            this.#receiving = true;
            this.#receive();
        }
        return 0;
    }
    /**
   * Stop receiving on the connection.
   * @return An error status code.
   */ recvStop() {
        this.#receiving = false;
        return 0;
    }
    ref() {
        notImplemented("udp.UDP.prototype.ref");
    }
    send(req, bufs, count, ...args) {
        return this.#doSend(req, bufs, count, args, AF_INET);
    }
    send6(req, bufs, count, ...args) {
        return this.#doSend(req, bufs, count, args, AF_INET6);
    }
    setBroadcast(_bool) {
        notImplemented("udp.UDP.prototype.setBroadcast");
    }
    setMulticastInterface(_interfaceAddress) {
        notImplemented("udp.UDP.prototype.setMulticastInterface");
    }
    setMulticastLoopback(_bool) {
        notImplemented("udp.UDP.prototype.setMulticastLoopback");
    }
    setMulticastTTL(_ttl) {
        notImplemented("udp.UDP.prototype.setMulticastTTL");
    }
    setTTL(_ttl) {
        notImplemented("udp.UDP.prototype.setTTL");
    }
    unref() {
        notImplemented("udp.UDP.prototype.unref");
    }
    #doBind(ip, port, _flags, family) {
        // TODO(cmorten): use flags to inform socket reuse etc.
        const listenOptions = {
            port,
            hostname: ip,
            transport: "udp"
        };
        let listener;
        try {
            listener = DenoListenDatagram(listenOptions);
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
        this.#address = address.hostname;
        this.#port = address.port;
        this.#family = family === AF_INET6 ? "IPv6" : "IPv4";
        this.#listener = listener;
        return 0;
    }
    #doConnect(ip1, port1, family1) {
        this.#remoteAddress = ip1;
        this.#remotePort = port1;
        this.#remoteFamily = family1 === AF_INET6 ? "IPv6" : "IPv4";
        return 0;
    }
    #doSend(req, bufs, _count, args, _family) {
        let hasCallback;
        if (args.length === 3) {
            this.#remotePort = args[0];
            this.#remoteAddress = args[1];
            hasCallback = args[2];
        } else {
            hasCallback = args[0];
        }
        const addr = {
            hostname: this.#remoteAddress,
            port: this.#remotePort,
            transport: "udp"
        };
        // Deno.DatagramConn.prototype.send accepts only one Uint8Array
        const payload = new Uint8Array(Buffer.concat(bufs.map((buf)=>{
            if (typeof buf === "string") {
                return Buffer.from(buf);
            }
            return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
        })));
        (async ()=>{
            let sent;
            let err = null;
            try {
                sent = await this.#listener.send(payload, addr);
            } catch (e) {
                // TODO(cmorten): map errors to appropriate error codes.
                if (e instanceof Deno.errors.BadResource) {
                    err = codeMap.get("EBADF");
                } else if (e instanceof Error && e.message.match(/os error (40|90|10040)/)) {
                    err = codeMap.get("EMSGSIZE");
                } else {
                    err = codeMap.get("UNKNOWN");
                }
                sent = 0;
            }
            if (hasCallback) {
                try {
                    req.oncomplete(err, sent);
                } catch  {
                // swallow callback errors
                }
            }
        })();
        return 0;
    }
    async #receive() {
        if (!this.#receiving) {
            return;
        }
        const p = new Uint8Array(this.#recvBufferSize);
        let buf;
        let remoteAddr;
        let nread;
        try {
            [buf, remoteAddr] = await this.#listener.receive(p);
            nread = buf.length;
        } catch (e1) {
            // TODO(cmorten): map errors to appropriate error codes.
            if (e1 instanceof Deno.errors.Interrupted || e1 instanceof Deno.errors.BadResource) {
                nread = 0;
            } else {
                nread = codeMap.get("UNKNOWN");
            }
            buf = new Uint8Array(0);
            remoteAddr = null;
        }
        nread ??= 0;
        const rinfo = remoteAddr ? {
            address: remoteAddr.hostname,
            port: remoteAddr.port,
            family: isIP(remoteAddr.hostname) === 6 ? "IPv6" : "IPv4"
        } : undefined;
        try {
            this.onmessage(nread, this, Buffer.from(buf), rinfo);
        } catch  {
        // swallow callback errors.
        }
        this.#receive();
    }
    /** Handle socket closure. */ _onClose() {
        this.#receiving = false;
        this.#address = undefined;
        this.#port = undefined;
        this.#family = undefined;
        try {
            this.#listener.close();
        } catch  {
        // listener already closed
        }
        this.#listener = undefined;
        return 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy91ZHBfd3JhcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmltcG9ydCB7IEFzeW5jV3JhcCwgcHJvdmlkZXJUeXBlIH0gZnJvbSBcIi4vYXN5bmNfd3JhcC50c1wiO1xuaW1wb3J0IHsgR2V0QWRkckluZm9SZXFXcmFwIH0gZnJvbSBcIi4vY2FyZXNfd3JhcC50c1wiO1xuaW1wb3J0IHsgSGFuZGxlV3JhcCB9IGZyb20gXCIuL2hhbmRsZV93cmFwLnRzXCI7XG5pbXBvcnQgeyBvd25lclN5bWJvbCB9IGZyb20gXCIuL3N5bWJvbHMudHNcIjtcbmltcG9ydCB7IGNvZGVNYXAsIGVycm9yTWFwIH0gZnJvbSBcIi4vdXYudHNcIjtcbmltcG9ydCB7IG5vdEltcGxlbWVudGVkIH0gZnJvbSBcIi4uL191dGlscy50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHR5cGUgeyBFcnJub0V4Y2VwdGlvbiB9IGZyb20gXCIuLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IGlzSVAgfSBmcm9tIFwiLi4vaW50ZXJuYWwvbmV0LnRzXCI7XG5cbmltcG9ydCB7IGlzTGludXgsIGlzV2luZG93cyB9IGZyb20gXCIuLi8uLi9fdXRpbC9vcy50c1wiO1xuXG4vLyBAdHMtaWdub3JlIERlbm9bRGVuby5pbnRlcm5hbF0gaXMgdXNlZCBvbiBwdXJwb3NlIGhlcmVcbmNvbnN0IERlbm9MaXN0ZW5EYXRhZ3JhbSA9IERlbm9bRGVuby5pbnRlcm5hbF0/Lm5vZGVVbnN0YWJsZT8ubGlzdGVuRGF0YWdyYW0gfHxcbiAgRGVuby5saXN0ZW5EYXRhZ3JhbTtcblxudHlwZSBNZXNzYWdlVHlwZSA9IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIgfCBEYXRhVmlldztcblxuY29uc3QgQUZfSU5FVCA9IDI7XG5jb25zdCBBRl9JTkVUNiA9IDEwO1xuXG5jb25zdCBVRFBfREdSQU1fTUFYU0laRSA9IDY0ICogMTAyNDtcblxuZXhwb3J0IGNsYXNzIFNlbmRXcmFwIGV4dGVuZHMgQXN5bmNXcmFwIHtcbiAgbGlzdCE6IE1lc3NhZ2VUeXBlW107XG4gIGFkZHJlc3MhOiBzdHJpbmc7XG4gIHBvcnQhOiBudW1iZXI7XG5cbiAgY2FsbGJhY2shOiAoZXJyb3I6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYnl0ZXM/OiBudW1iZXIpID0+IHZvaWQ7XG4gIG9uY29tcGxldGUhOiAoZXJyOiBudW1iZXIgfCBudWxsLCBzZW50PzogbnVtYmVyKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHByb3ZpZGVyVHlwZS5VRFBTRU5EV1JBUCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFVEUCBleHRlbmRzIEhhbmRsZVdyYXAge1xuICBbb3duZXJTeW1ib2xdOiB1bmtub3duID0gbnVsbDtcblxuICAjYWRkcmVzcz86IHN0cmluZztcbiAgI2ZhbWlseT86IHN0cmluZztcbiAgI3BvcnQ/OiBudW1iZXI7XG5cbiAgI3JlbW90ZUFkZHJlc3M/OiBzdHJpbmc7XG4gICNyZW1vdGVGYW1pbHk/OiBzdHJpbmc7XG4gICNyZW1vdGVQb3J0PzogbnVtYmVyO1xuXG4gICNsaXN0ZW5lcj86IERlbm8uRGF0YWdyYW1Db25uO1xuICAjcmVjZWl2aW5nID0gZmFsc2U7XG5cbiAgI3JlY3ZCdWZmZXJTaXplID0gVURQX0RHUkFNX01BWFNJWkU7XG4gICNzZW5kQnVmZmVyU2l6ZSA9IFVEUF9ER1JBTV9NQVhTSVpFO1xuXG4gIG9ubWVzc2FnZSE6IChcbiAgICBucmVhZDogbnVtYmVyLFxuICAgIGhhbmRsZTogVURQLFxuICAgIGJ1Zj86IEJ1ZmZlcixcbiAgICByaW5mbz86IHtcbiAgICAgIGFkZHJlc3M6IHN0cmluZztcbiAgICAgIGZhbWlseTogXCJJUHY0XCIgfCBcIklQdjZcIjtcbiAgICAgIHBvcnQ6IG51bWJlcjtcbiAgICAgIHNpemU/OiBudW1iZXI7XG4gICAgfSxcbiAgKSA9PiB2b2lkO1xuXG4gIGxvb2t1cCE6IChcbiAgICBhZGRyZXNzOiBzdHJpbmcsXG4gICAgY2FsbGJhY2s6IChcbiAgICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgICAgYWRkcmVzczogc3RyaW5nLFxuICAgICAgZmFtaWx5OiBudW1iZXIsXG4gICAgKSA9PiB2b2lkLFxuICApID0+IEdldEFkZHJJbmZvUmVxV3JhcCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPjtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihwcm92aWRlclR5cGUuVURQV1JBUCk7XG4gIH1cblxuICBhZGRNZW1iZXJzaGlwKF9tdWx0aWNhc3RBZGRyZXNzOiBzdHJpbmcsIF9pbnRlcmZhY2VBZGRyZXNzPzogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBub3RJbXBsZW1lbnRlZChcInVkcC5VRFAucHJvdG90eXBlLmFkZE1lbWJlcnNoaXBcIik7XG4gIH1cblxuICBhZGRTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXAoXG4gICAgX3NvdXJjZUFkZHJlc3M6IHN0cmluZyxcbiAgICBfZ3JvdXBBZGRyZXNzOiBzdHJpbmcsXG4gICAgX2ludGVyZmFjZUFkZHJlc3M/OiBzdHJpbmcsXG4gICk6IG51bWJlciB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJ1ZHAuVURQLnByb3RvdHlwZS5hZGRTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXBcIik7XG4gIH1cblxuICAvKipcbiAgICogQmluZCB0byBhbiBJUHY0IGFkZHJlc3MuXG4gICAqIEBwYXJhbSBpcCBUaGUgaG9zdG5hbWUgdG8gYmluZCB0by5cbiAgICogQHBhcmFtIHBvcnQgVGhlIHBvcnQgdG8gYmluZCB0b1xuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgYmluZChpcDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIGZsYWdzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLiNkb0JpbmQoaXAsIHBvcnQsIGZsYWdzLCBBRl9JTkVUKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCaW5kIHRvIGFuIElQdjYgYWRkcmVzcy5cbiAgICogQHBhcmFtIGlwIFRoZSBob3N0bmFtZSB0byBiaW5kIHRvLlxuICAgKiBAcGFyYW0gcG9ydCBUaGUgcG9ydCB0byBiaW5kIHRvXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBiaW5kNihpcDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIGZsYWdzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLiNkb0JpbmQoaXAsIHBvcnQsIGZsYWdzLCBBRl9JTkVUNik7XG4gIH1cblxuICBidWZmZXJTaXplKFxuICAgIHNpemU6IG51bWJlcixcbiAgICBidWZmZXI6IGJvb2xlYW4sXG4gICAgY3R4OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXI+LFxuICApOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICAgIGxldCBlcnI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChzaXplID4gVURQX0RHUkFNX01BWFNJWkUpIHtcbiAgICAgIGVyciA9IFwiRUlOVkFMXCI7XG4gICAgfSBlbHNlIGlmICghdGhpcy4jYWRkcmVzcykge1xuICAgICAgZXJyID0gaXNXaW5kb3dzID8gXCJFTk9UU09DS1wiIDogXCJFQkFERlwiO1xuICAgIH1cblxuICAgIGlmIChlcnIpIHtcbiAgICAgIGN0eC5lcnJubyA9IGNvZGVNYXAuZ2V0KGVycikhO1xuICAgICAgY3R4LmNvZGUgPSBlcnI7XG4gICAgICBjdHgubWVzc2FnZSA9IGVycm9yTWFwLmdldChjdHguZXJybm8pIVsxXTtcbiAgICAgIGN0eC5zeXNjYWxsID0gYnVmZmVyID8gXCJ1dl9yZWN2X2J1ZmZlcl9zaXplXCIgOiBcInV2X3NlbmRfYnVmZmVyX3NpemVcIjtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaXplICE9PSAwKSB7XG4gICAgICBzaXplID0gaXNMaW51eCA/IHNpemUgKiAyIDogc2l6ZTtcblxuICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gKHRoaXMuI3JlY3ZCdWZmZXJTaXplID0gc2l6ZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAodGhpcy4jc2VuZEJ1ZmZlclNpemUgPSBzaXplKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyID8gdGhpcy4jcmVjdkJ1ZmZlclNpemUgOiB0aGlzLiNzZW5kQnVmZmVyU2l6ZTtcbiAgfVxuXG4gIGNvbm5lY3QoaXA6IHN0cmluZywgcG9ydDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jZG9Db25uZWN0KGlwLCBwb3J0LCBBRl9JTkVUKTtcbiAgfVxuXG4gIGNvbm5lY3Q2KGlwOiBzdHJpbmcsIHBvcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2RvQ29ubmVjdChpcCwgcG9ydCwgQUZfSU5FVDYpO1xuICB9XG5cbiAgZGlzY29ubmVjdCgpOiBudW1iZXIge1xuICAgIHRoaXMuI3JlbW90ZUFkZHJlc3MgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy4jcmVtb3RlUG9ydCA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLiNyZW1vdGVGYW1pbHkgPSB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGRyb3BNZW1iZXJzaGlwKFxuICAgIF9tdWx0aWNhc3RBZGRyZXNzOiBzdHJpbmcsXG4gICAgX2ludGVyZmFjZUFkZHJlc3M/OiBzdHJpbmcsXG4gICk6IG51bWJlciB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJ1ZHAuVURQLnByb3RvdHlwZS5kcm9wTWVtYmVyc2hpcFwiKTtcbiAgfVxuXG4gIGRyb3BTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXAoXG4gICAgX3NvdXJjZUFkZHJlc3M6IHN0cmluZyxcbiAgICBfZ3JvdXBBZGRyZXNzOiBzdHJpbmcsXG4gICAgX2ludGVyZmFjZUFkZHJlc3M/OiBzdHJpbmcsXG4gICk6IG51bWJlciB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJ1ZHAuVURQLnByb3RvdHlwZS5kcm9wU291cmNlU3BlY2lmaWNNZW1iZXJzaGlwXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBvcHVsYXRlcyB0aGUgcHJvdmlkZWQgb2JqZWN0IHdpdGggcmVtb3RlIGFkZHJlc3MgZW50cmllcy5cbiAgICogQHBhcmFtIHBlZXJuYW1lIEFuIG9iamVjdCB0byBhZGQgdGhlIHJlbW90ZSBhZGRyZXNzIGVudHJpZXMgdG8uXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBnZXRwZWVybmFtZShwZWVybmFtZTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyPik6IG51bWJlciB7XG4gICAgaWYgKHRoaXMuI3JlbW90ZUFkZHJlc3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGNvZGVNYXAuZ2V0KFwiRUJBREZcIikhO1xuICAgIH1cblxuICAgIHBlZXJuYW1lLmFkZHJlc3MgPSB0aGlzLiNyZW1vdGVBZGRyZXNzO1xuICAgIHBlZXJuYW1lLnBvcnQgPSB0aGlzLiNyZW1vdGVQb3J0ITtcbiAgICBwZWVybmFtZS5mYW1pbHkgPSB0aGlzLiNyZW1vdGVGYW1pbHkhO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoZSBwcm92aWRlZCBvYmplY3Qgd2l0aCBsb2NhbCBhZGRyZXNzIGVudHJpZXMuXG4gICAqIEBwYXJhbSBzb2NrbmFtZSBBbiBvYmplY3QgdG8gYWRkIHRoZSBsb2NhbCBhZGRyZXNzIGVudHJpZXMgdG8uXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBnZXRzb2NrbmFtZShzb2NrbmFtZTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyPik6IG51bWJlciB7XG4gICAgaWYgKHRoaXMuI2FkZHJlc3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGNvZGVNYXAuZ2V0KFwiRUJBREZcIikhO1xuICAgIH1cblxuICAgIHNvY2tuYW1lLmFkZHJlc3MgPSB0aGlzLiNhZGRyZXNzO1xuICAgIHNvY2tuYW1lLnBvcnQgPSB0aGlzLiNwb3J0ITtcbiAgICBzb2NrbmFtZS5mYW1pbHkgPSB0aGlzLiNmYW1pbHkhO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogT3BlbnMgYSBmaWxlIGRlc2NyaXB0b3IuXG4gICAqIEBwYXJhbSBmZCBUaGUgZmlsZSBkZXNjcmlwdG9yIHRvIG9wZW4uXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBvcGVuKF9mZDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy82NTI5XG4gICAgbm90SW1wbGVtZW50ZWQoXCJ1ZHAuVURQLnByb3RvdHlwZS5vcGVuXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IHJlY2VpdmluZyBvbiB0aGUgY29ubmVjdGlvbi5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIHJlY3ZTdGFydCgpOiBudW1iZXIge1xuICAgIGlmICghdGhpcy4jcmVjZWl2aW5nKSB7XG4gICAgICB0aGlzLiNyZWNlaXZpbmcgPSB0cnVlO1xuICAgICAgdGhpcy4jcmVjZWl2ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3AgcmVjZWl2aW5nIG9uIHRoZSBjb25uZWN0aW9uLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgcmVjdlN0b3AoKTogbnVtYmVyIHtcbiAgICB0aGlzLiNyZWNlaXZpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgb3ZlcnJpZGUgcmVmKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwidWRwLlVEUC5wcm90b3R5cGUucmVmXCIpO1xuICB9XG5cbiAgc2VuZChcbiAgICByZXE6IFNlbmRXcmFwLFxuICAgIGJ1ZnM6IE1lc3NhZ2VUeXBlW10sXG4gICAgY291bnQ6IG51bWJlcixcbiAgICAuLi5hcmdzOiBbbnVtYmVyLCBzdHJpbmcsIGJvb2xlYW5dIHwgW2Jvb2xlYW5dXG4gICk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2RvU2VuZChyZXEsIGJ1ZnMsIGNvdW50LCBhcmdzLCBBRl9JTkVUKTtcbiAgfVxuXG4gIHNlbmQ2KFxuICAgIHJlcTogU2VuZFdyYXAsXG4gICAgYnVmczogTWVzc2FnZVR5cGVbXSxcbiAgICBjb3VudDogbnVtYmVyLFxuICAgIC4uLmFyZ3M6IFtudW1iZXIsIHN0cmluZywgYm9vbGVhbl0gfCBbYm9vbGVhbl1cbiAgKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jZG9TZW5kKHJlcSwgYnVmcywgY291bnQsIGFyZ3MsIEFGX0lORVQ2KTtcbiAgfVxuXG4gIHNldEJyb2FkY2FzdChfYm9vbDogMCB8IDEpOiBudW1iZXIge1xuICAgIG5vdEltcGxlbWVudGVkKFwidWRwLlVEUC5wcm90b3R5cGUuc2V0QnJvYWRjYXN0XCIpO1xuICB9XG5cbiAgc2V0TXVsdGljYXN0SW50ZXJmYWNlKF9pbnRlcmZhY2VBZGRyZXNzOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIG5vdEltcGxlbWVudGVkKFwidWRwLlVEUC5wcm90b3R5cGUuc2V0TXVsdGljYXN0SW50ZXJmYWNlXCIpO1xuICB9XG5cbiAgc2V0TXVsdGljYXN0TG9vcGJhY2soX2Jvb2w6IDAgfCAxKTogbnVtYmVyIHtcbiAgICBub3RJbXBsZW1lbnRlZChcInVkcC5VRFAucHJvdG90eXBlLnNldE11bHRpY2FzdExvb3BiYWNrXCIpO1xuICB9XG5cbiAgc2V0TXVsdGljYXN0VFRMKF90dGw6IG51bWJlcik6IG51bWJlciB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJ1ZHAuVURQLnByb3RvdHlwZS5zZXRNdWx0aWNhc3RUVExcIik7XG4gIH1cblxuICBzZXRUVEwoX3R0bDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBub3RJbXBsZW1lbnRlZChcInVkcC5VRFAucHJvdG90eXBlLnNldFRUTFwiKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHVucmVmKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwidWRwLlVEUC5wcm90b3R5cGUudW5yZWZcIik7XG4gIH1cblxuICAjZG9CaW5kKGlwOiBzdHJpbmcsIHBvcnQ6IG51bWJlciwgX2ZsYWdzOiBudW1iZXIsIGZhbWlseTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAvLyBUT0RPKGNtb3J0ZW4pOiB1c2UgZmxhZ3MgdG8gaW5mb3JtIHNvY2tldCByZXVzZSBldGMuXG4gICAgY29uc3QgbGlzdGVuT3B0aW9ucyA9IHtcbiAgICAgIHBvcnQsXG4gICAgICBob3N0bmFtZTogaXAsXG4gICAgICB0cmFuc3BvcnQ6IFwidWRwXCIgYXMgY29uc3QsXG4gICAgfTtcblxuICAgIGxldCBsaXN0ZW5lcjtcblxuICAgIHRyeSB7XG4gICAgICBsaXN0ZW5lciA9IERlbm9MaXN0ZW5EYXRhZ3JhbShsaXN0ZW5PcHRpb25zKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkFkZHJJblVzZSkge1xuICAgICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFQUREUklOVVNFXCIpITtcbiAgICAgIH0gZWxzZSBpZiAoZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkFkZHJOb3RBdmFpbGFibGUpIHtcbiAgICAgICAgcmV0dXJuIGNvZGVNYXAuZ2V0KFwiRUFERFJOT1RBVkFJTFwiKSE7XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE8oY21vcnRlbik6IG1hcCBlcnJvcnMgdG8gYXBwcm9wcmlhdGUgZXJyb3IgY29kZXMuXG4gICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJVTktOT1dOXCIpITtcbiAgICB9XG5cbiAgICBjb25zdCBhZGRyZXNzID0gbGlzdGVuZXIuYWRkciBhcyBEZW5vLk5ldEFkZHI7XG4gICAgdGhpcy4jYWRkcmVzcyA9IGFkZHJlc3MuaG9zdG5hbWU7XG4gICAgdGhpcy4jcG9ydCA9IGFkZHJlc3MucG9ydDtcbiAgICB0aGlzLiNmYW1pbHkgPSBmYW1pbHkgPT09IEFGX0lORVQ2ID8gKFwiSVB2NlwiIGFzIGNvbnN0KSA6IChcIklQdjRcIiBhcyBjb25zdCk7XG4gICAgdGhpcy4jbGlzdGVuZXIgPSBsaXN0ZW5lcjtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgI2RvQ29ubmVjdChpcDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIGZhbWlseTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICB0aGlzLiNyZW1vdGVBZGRyZXNzID0gaXA7XG4gICAgdGhpcy4jcmVtb3RlUG9ydCA9IHBvcnQ7XG4gICAgdGhpcy4jcmVtb3RlRmFtaWx5ID0gZmFtaWx5ID09PSBBRl9JTkVUNlxuICAgICAgPyAoXCJJUHY2XCIgYXMgY29uc3QpXG4gICAgICA6IChcIklQdjRcIiBhcyBjb25zdCk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gICNkb1NlbmQoXG4gICAgcmVxOiBTZW5kV3JhcCxcbiAgICBidWZzOiBNZXNzYWdlVHlwZVtdLFxuICAgIF9jb3VudDogbnVtYmVyLFxuICAgIGFyZ3M6IFtudW1iZXIsIHN0cmluZywgYm9vbGVhbl0gfCBbYm9vbGVhbl0sXG4gICAgX2ZhbWlseTogbnVtYmVyLFxuICApOiBudW1iZXIge1xuICAgIGxldCBoYXNDYWxsYmFjazogYm9vbGVhbjtcblxuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMykge1xuICAgICAgdGhpcy4jcmVtb3RlUG9ydCA9IGFyZ3NbMF0gYXMgbnVtYmVyO1xuICAgICAgdGhpcy4jcmVtb3RlQWRkcmVzcyA9IGFyZ3NbMV0gYXMgc3RyaW5nO1xuICAgICAgaGFzQ2FsbGJhY2sgPSBhcmdzWzJdIGFzIGJvb2xlYW47XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0NhbGxiYWNrID0gYXJnc1swXSBhcyBib29sZWFuO1xuICAgIH1cblxuICAgIGNvbnN0IGFkZHI6IERlbm8uTmV0QWRkciA9IHtcbiAgICAgIGhvc3RuYW1lOiB0aGlzLiNyZW1vdGVBZGRyZXNzISxcbiAgICAgIHBvcnQ6IHRoaXMuI3JlbW90ZVBvcnQhLFxuICAgICAgdHJhbnNwb3J0OiBcInVkcFwiLFxuICAgIH07XG5cbiAgICAvLyBEZW5vLkRhdGFncmFtQ29ubi5wcm90b3R5cGUuc2VuZCBhY2NlcHRzIG9ubHkgb25lIFVpbnQ4QXJyYXlcbiAgICBjb25zdCBwYXlsb2FkID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICBCdWZmZXIuY29uY2F0KFxuICAgICAgICBidWZzLm1hcCgoYnVmKSA9PiB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBidWYgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShidWYpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShidWYuYnVmZmVyLCBidWYuYnl0ZU9mZnNldCwgYnVmLmJ5dGVMZW5ndGgpO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKTtcblxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc2VudDogbnVtYmVyO1xuICAgICAgbGV0IGVycjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHNlbnQgPSBhd2FpdCB0aGlzLiNsaXN0ZW5lciEuc2VuZChwYXlsb2FkLCBhZGRyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVycm9ycyB0byBhcHByb3ByaWF0ZSBlcnJvciBjb2Rlcy5cbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5CYWRSZXNvdXJjZSkge1xuICAgICAgICAgIGVyciA9IGNvZGVNYXAuZ2V0KFwiRUJBREZcIikhO1xuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIGUgaW5zdGFuY2VvZiBFcnJvciAmJlxuICAgICAgICAgIGUubWVzc2FnZS5tYXRjaCgvb3MgZXJyb3IgKDQwfDkwfDEwMDQwKS8pXG4gICAgICAgICkge1xuICAgICAgICAgIGVyciA9IGNvZGVNYXAuZ2V0KFwiRU1TR1NJWkVcIikhO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVyciA9IGNvZGVNYXAuZ2V0KFwiVU5LTk9XTlwiKSE7XG4gICAgICAgIH1cblxuICAgICAgICBzZW50ID0gMDtcbiAgICAgIH1cblxuICAgICAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVxLm9uY29tcGxldGUoZXJyLCBzZW50KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnNcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGFzeW5jICNyZWNlaXZlKCkge1xuICAgIGlmICghdGhpcy4jcmVjZWl2aW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuI3JlY3ZCdWZmZXJTaXplKTtcblxuICAgIGxldCBidWY6IFVpbnQ4QXJyYXk7XG4gICAgbGV0IHJlbW90ZUFkZHI6IERlbm8uTmV0QWRkciB8IG51bGw7XG4gICAgbGV0IG5yZWFkOiBudW1iZXIgfCBudWxsO1xuXG4gICAgdHJ5IHtcbiAgICAgIFtidWYsIHJlbW90ZUFkZHJdID0gKGF3YWl0IHRoaXMuI2xpc3RlbmVyIS5yZWNlaXZlKHApKSBhcyBbXG4gICAgICAgIFVpbnQ4QXJyYXksXG4gICAgICAgIERlbm8uTmV0QWRkcixcbiAgICAgIF07XG5cbiAgICAgIG5yZWFkID0gYnVmLmxlbmd0aDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBtYXAgZXJyb3JzIHRvIGFwcHJvcHJpYXRlIGVycm9yIGNvZGVzLlxuICAgICAgaWYgKFxuICAgICAgICBlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuSW50ZXJydXB0ZWQgfHxcbiAgICAgICAgZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlXG4gICAgICApIHtcbiAgICAgICAgbnJlYWQgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbnJlYWQgPSBjb2RlTWFwLmdldChcIlVOS05PV05cIikhO1xuICAgICAgfVxuXG4gICAgICBidWYgPSBuZXcgVWludDhBcnJheSgwKTtcbiAgICAgIHJlbW90ZUFkZHIgPSBudWxsO1xuICAgIH1cblxuICAgIG5yZWFkID8/PSAwO1xuXG4gICAgY29uc3QgcmluZm8gPSByZW1vdGVBZGRyXG4gICAgICA/IHtcbiAgICAgICAgYWRkcmVzczogcmVtb3RlQWRkci5ob3N0bmFtZSxcbiAgICAgICAgcG9ydDogcmVtb3RlQWRkci5wb3J0LFxuICAgICAgICBmYW1pbHk6IGlzSVAocmVtb3RlQWRkci5ob3N0bmFtZSkgPT09IDZcbiAgICAgICAgICA/IChcIklQdjZcIiBhcyBjb25zdClcbiAgICAgICAgICA6IChcIklQdjRcIiBhcyBjb25zdCksXG4gICAgICB9XG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLm9ubWVzc2FnZShucmVhZCwgdGhpcywgQnVmZmVyLmZyb20oYnVmKSwgcmluZm8pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgfVxuXG4gICAgdGhpcy4jcmVjZWl2ZSgpO1xuICB9XG5cbiAgLyoqIEhhbmRsZSBzb2NrZXQgY2xvc3VyZS4gKi9cbiAgb3ZlcnJpZGUgX29uQ2xvc2UoKTogbnVtYmVyIHtcbiAgICB0aGlzLiNyZWNlaXZpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuI2FkZHJlc3MgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy4jcG9ydCA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLiNmYW1pbHkgPSB1bmRlZmluZWQ7XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy4jbGlzdGVuZXIhLmNsb3NlKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBsaXN0ZW5lciBhbHJlYWR5IGNsb3NlZFxuICAgIH1cblxuICAgIHRoaXMuI2xpc3RlbmVyID0gdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSx5REFBeUQ7QUFDekQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSw2REFBNkQ7QUFDN0QsNEVBQTRFO0FBQzVFLDJFQUEyRTtBQUMzRSx3RUFBd0U7QUFDeEUsNEVBQTRFO0FBQzVFLHlDQUF5QztBQUV6QyxTQUFTLFNBQVMsRUFBRSxZQUFZLFFBQVEsa0JBQWtCO0FBRTFELFNBQVMsVUFBVSxRQUFRLG1CQUFtQjtBQUM5QyxTQUFTLFdBQVcsUUFBUSxlQUFlO0FBQzNDLFNBQVMsT0FBTyxFQUFFLFFBQVEsUUFBUSxV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