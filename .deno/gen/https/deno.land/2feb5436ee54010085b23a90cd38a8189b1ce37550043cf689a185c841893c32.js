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
// - https://github.com/nodejs/node/blob/master/src/tcp_wrap.cc
// - https://github.com/nodejs/node/blob/master/src/tcp_wrap.h
import { notImplemented } from "../_utils.ts";
import { unreachable } from "../../_util/asserts.ts";
import { ConnectionWrap } from "./connection_wrap.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { LibuvStreamWrap } from "./stream_wrap.ts";
import { ownerSymbol } from "./symbols.ts";
import { codeMap } from "./uv.ts";
import { delay } from "../../async/mod.ts";
import { kStreamBaseField } from "./stream_wrap.ts";
import { isIP } from "../internal/net.ts";
import { ceilPowOf2, INITIAL_ACCEPT_BACKOFF_DELAY, MAX_ACCEPT_BACKOFF_DELAY } from "./_listen.ts";
var /** The type of TCP socket. */ socketType;
(function(socketType) {
    socketType[socketType["SOCKET"] = 0] = "SOCKET";
    socketType[socketType["SERVER"] = 1] = "SERVER";
})(socketType || (socketType = {}));
export class TCPConnectWrap extends AsyncWrap {
    oncomplete;
    address;
    port;
    localAddress;
    localPort;
    constructor(){
        super(providerType.TCPCONNECTWRAP);
    }
}
export var constants;
(function(constants) {
    constants[constants["SOCKET"] = socketType.SOCKET] = "SOCKET";
    constants[constants["SERVER"] = socketType.SERVER] = "SERVER";
    constants[constants["UV_TCP_IPV6ONLY"] = 0] = "UV_TCP_IPV6ONLY";
})(constants || (constants = {}));
export class TCP extends ConnectionWrap {
    [ownerSymbol] = null;
    reading = false;
    #address;
    #port;
    #remoteAddress;
    #remoteFamily;
    #remotePort;
    #backlog;
    #listener;
    #connections = 0;
    #closed = false;
    #acceptBackoffDelay;
    /**
   * Creates a new TCP class instance.
   * @param type The socket type.
   * @param conn Optional connection object to wrap.
   */ constructor(type, conn){
        let provider;
        switch(type){
            case socketType.SOCKET:
                {
                    provider = providerType.TCPWRAP;
                    break;
                }
            case socketType.SERVER:
                {
                    provider = providerType.TCPSERVERWRAP;
                    break;
                }
            default:
                {
                    unreachable();
                }
        }
        super(provider, conn);
        // TODO(cmorten): the handling of new connections and construction feels
        // a little off. Suspect duplicating in some fashion.
        if (conn && provider === providerType.TCPWRAP) {
            const localAddr = conn.localAddr;
            this.#address = localAddr.hostname;
            this.#port = localAddr.port;
            const remoteAddr = conn.remoteAddr;
            this.#remoteAddress = remoteAddr.hostname;
            this.#remotePort = remoteAddr.port;
            this.#remoteFamily = isIP(remoteAddr.hostname);
        }
    }
    /**
   * Opens a file descriptor.
   * @param fd The file descriptor to open.
   * @return An error status code.
   */ open(_fd) {
        // REF: https://github.com/denoland/deno/issues/6529
        notImplemented("TCP.prototype.open");
    }
    /**
   * Bind to an IPv4 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */ bind(address, port) {
        return this.#bind(address, port, 0);
    }
    /**
   * Bind to an IPv6 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */ bind6(address, port, flags) {
        return this.#bind(address, port, flags);
    }
    /**
   * Connect to an IPv4 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */ connect(req, address, port) {
        return this.#connect(req, address, port);
    }
    /**
   * Connect to an IPv6 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */ connect6(req, address, port) {
        return this.#connect(req, address, port);
    }
    /**
   * Listen for new connections.
   * @param backlog The maximum length of the queue of pending connections.
   * @return An error status code.
   */ listen(backlog) {
        this.#backlog = ceilPowOf2(backlog + 1);
        const listenOptions = {
            hostname: this.#address,
            port: this.#port,
            transport: "tcp"
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
        this.#address = address.hostname;
        this.#port = address.port;
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
   * Populates the provided object with local address entries.
   * @param sockname An object to add the local address entries to.
   * @return An error status code.
   */ getsockname(sockname) {
        if (typeof this.#address === "undefined" || typeof this.#port === "undefined") {
            return codeMap.get("EADDRNOTAVAIL");
        }
        sockname.address = this.#address;
        sockname.port = this.#port;
        sockname.family = isIP(this.#address);
        return 0;
    }
    /**
   * Populates the provided object with remote address entries.
   * @param peername An object to add the remote address entries to.
   * @return An error status code.
   */ getpeername(peername) {
        if (typeof this.#remoteAddress === "undefined" || typeof this.#remotePort === "undefined") {
            return codeMap.get("EADDRNOTAVAIL");
        }
        peername.address = this.#remoteAddress;
        peername.port = this.#remotePort;
        peername.family = this.#remoteFamily;
        return 0;
    }
    /**
   * @param noDelay
   * @return An error status code.
   */ setNoDelay(_noDelay) {
        // TODO(bnoordhuis) https://github.com/denoland/deno/pull/13103
        return 0;
    }
    /**
   * @param enable
   * @param initialDelay
   * @return An error status code.
   */ setKeepAlive(_enable, _initialDelay) {
        // TODO(bnoordhuis) https://github.com/denoland/deno/pull/13103
        return 0;
    }
    /**
   * Windows only.
   *
   * Deprecated by Node.
   * REF: https://github.com/nodejs/node/blob/master/lib/net.js#L1731
   *
   * @param enable
   * @return An error status code.
   * @deprecated
   */ setSimultaneousAccepts(_enable) {
        // Low priority to implement owing to it being deprecated in Node.
        notImplemented("TCP.prototype.setSimultaneousAccepts");
    }
    /**
   * Bind to an IPv4 or IPv6 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @param _flags
   * @return An error status code.
   */ #bind(address, port, _flags) {
        // Deno doesn't currently separate bind from connect etc.
        // REF:
        // - https://doc.deno.land/deno/stable/~/Deno.connect
        // - https://doc.deno.land/deno/stable/~/Deno.listen
        //
        // This also means we won't be connecting from the specified local address
        // and port as providing these is not an option in Deno.
        // REF:
        // - https://doc.deno.land/deno/stable/~/Deno.ConnectOptions
        // - https://doc.deno.land/deno/stable/~/Deno.ListenOptions
        this.#address = address;
        this.#port = port;
        return 0;
    }
    /**
   * Connect to an IPv4 or IPv6 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */ #connect(req, address1, port1) {
        this.#remoteAddress = address1;
        this.#remotePort = port1;
        this.#remoteFamily = isIP(address1);
        const connectOptions = {
            hostname: address1,
            port: port1,
            transport: "tcp"
        };
        Deno.connect(connectOptions).then((conn)=>{
            // Incorrect / backwards, but correcting the local address and port with
            // what was actually used given we can't actually specify these in Deno.
            const localAddr = conn.localAddr;
            this.#address = req.localAddress = localAddr.hostname;
            this.#port = req.localPort = localAddr.port;
            this[kStreamBaseField] = conn;
            try {
                this.afterConnect(req, 0);
            } catch  {
            // swallow callback errors.
            }
        }, ()=>{
            try {
                // TODO(cmorten): correct mapping of connection error to status code.
                this.afterConnect(req, codeMap.get("ECONNREFUSED"));
            } catch  {
            // swallow callback errors.
            }
        });
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
        const connectionHandle = new TCP(socketType.SOCKET, connection);
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
        this.#port = undefined;
        this.#remoteAddress = undefined;
        this.#remoteFamily = undefined;
        this.#remotePort = undefined;
        this.#backlog = undefined;
        this.#connections = 0;
        this.#acceptBackoffDelay = undefined;
        if (this.provider === providerType.TCPSERVERWRAP) {
            try {
                this.#listener.close();
            } catch  {
            // listener already closed
            }
        }
        return LibuvStreamWrap.prototype._onClose.call(this);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy90Y3Bfd3JhcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIFRoaXMgbW9kdWxlIHBvcnRzOlxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3RjcF93cmFwLmNjXG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvdGNwX3dyYXAuaFxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IHVucmVhY2hhYmxlIH0gZnJvbSBcIi4uLy4uL191dGlsL2Fzc2VydHMudHNcIjtcbmltcG9ydCB7IENvbm5lY3Rpb25XcmFwIH0gZnJvbSBcIi4vY29ubmVjdGlvbl93cmFwLnRzXCI7XG5pbXBvcnQgeyBBc3luY1dyYXAsIHByb3ZpZGVyVHlwZSB9IGZyb20gXCIuL2FzeW5jX3dyYXAudHNcIjtcbmltcG9ydCB7IExpYnV2U3RyZWFtV3JhcCB9IGZyb20gXCIuL3N0cmVhbV93cmFwLnRzXCI7XG5pbXBvcnQgeyBvd25lclN5bWJvbCB9IGZyb20gXCIuL3N5bWJvbHMudHNcIjtcbmltcG9ydCB7IGNvZGVNYXAgfSBmcm9tIFwiLi91di50c1wiO1xuaW1wb3J0IHsgZGVsYXkgfSBmcm9tIFwiLi4vLi4vYXN5bmMvbW9kLnRzXCI7XG5pbXBvcnQgeyBrU3RyZWFtQmFzZUZpZWxkIH0gZnJvbSBcIi4vc3RyZWFtX3dyYXAudHNcIjtcbmltcG9ydCB7IGlzSVAgfSBmcm9tIFwiLi4vaW50ZXJuYWwvbmV0LnRzXCI7XG5pbXBvcnQge1xuICBjZWlsUG93T2YyLFxuICBJTklUSUFMX0FDQ0VQVF9CQUNLT0ZGX0RFTEFZLFxuICBNQVhfQUNDRVBUX0JBQ0tPRkZfREVMQVksXG59IGZyb20gXCIuL19saXN0ZW4udHNcIjtcblxuLyoqIFRoZSB0eXBlIG9mIFRDUCBzb2NrZXQuICovXG5lbnVtIHNvY2tldFR5cGUge1xuICBTT0NLRVQsXG4gIFNFUlZFUixcbn1cblxuaW50ZXJmYWNlIEFkZHJlc3NJbmZvIHtcbiAgYWRkcmVzczogc3RyaW5nO1xuICBmYW1pbHk/OiBudW1iZXI7XG4gIHBvcnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFRDUENvbm5lY3RXcmFwIGV4dGVuZHMgQXN5bmNXcmFwIHtcbiAgb25jb21wbGV0ZSE6IChcbiAgICBzdGF0dXM6IG51bWJlcixcbiAgICBoYW5kbGU6IENvbm5lY3Rpb25XcmFwLFxuICAgIHJlcTogVENQQ29ubmVjdFdyYXAsXG4gICAgcmVhZGFibGU6IGJvb2xlYW4sXG4gICAgd3JpdGVhYmxlOiBib29sZWFuLFxuICApID0+IHZvaWQ7XG4gIGFkZHJlc3MhOiBzdHJpbmc7XG4gIHBvcnQhOiBudW1iZXI7XG4gIGxvY2FsQWRkcmVzcyE6IHN0cmluZztcbiAgbG9jYWxQb3J0ITogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHByb3ZpZGVyVHlwZS5UQ1BDT05ORUNUV1JBUCk7XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gY29uc3RhbnRzIHtcbiAgU09DS0VUID0gc29ja2V0VHlwZS5TT0NLRVQsXG4gIFNFUlZFUiA9IHNvY2tldFR5cGUuU0VSVkVSLFxuICBVVl9UQ1BfSVBWNk9OTFksXG59XG5cbmV4cG9ydCBjbGFzcyBUQ1AgZXh0ZW5kcyBDb25uZWN0aW9uV3JhcCB7XG4gIFtvd25lclN5bWJvbF06IHVua25vd24gPSBudWxsO1xuICBvdmVycmlkZSByZWFkaW5nID0gZmFsc2U7XG5cbiAgI2FkZHJlc3M/OiBzdHJpbmc7XG4gICNwb3J0PzogbnVtYmVyO1xuXG4gICNyZW1vdGVBZGRyZXNzPzogc3RyaW5nO1xuICAjcmVtb3RlRmFtaWx5PzogbnVtYmVyO1xuICAjcmVtb3RlUG9ydD86IG51bWJlcjtcblxuICAjYmFja2xvZz86IG51bWJlcjtcbiAgI2xpc3RlbmVyITogRGVuby5MaXN0ZW5lcjtcbiAgI2Nvbm5lY3Rpb25zID0gMDtcblxuICAjY2xvc2VkID0gZmFsc2U7XG4gICNhY2NlcHRCYWNrb2ZmRGVsYXk/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgVENQIGNsYXNzIGluc3RhbmNlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgc29ja2V0IHR5cGUuXG4gICAqIEBwYXJhbSBjb25uIE9wdGlvbmFsIGNvbm5lY3Rpb24gb2JqZWN0IHRvIHdyYXAuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih0eXBlOiBudW1iZXIsIGNvbm4/OiBEZW5vLkNvbm4pIHtcbiAgICBsZXQgcHJvdmlkZXI6IHByb3ZpZGVyVHlwZTtcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSBzb2NrZXRUeXBlLlNPQ0tFVDoge1xuICAgICAgICBwcm92aWRlciA9IHByb3ZpZGVyVHlwZS5UQ1BXUkFQO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBzb2NrZXRUeXBlLlNFUlZFUjoge1xuICAgICAgICBwcm92aWRlciA9IHByb3ZpZGVyVHlwZS5UQ1BTRVJWRVJXUkFQO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICB1bnJlYWNoYWJsZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHN1cGVyKHByb3ZpZGVyLCBjb25uKTtcblxuICAgIC8vIFRPRE8oY21vcnRlbik6IHRoZSBoYW5kbGluZyBvZiBuZXcgY29ubmVjdGlvbnMgYW5kIGNvbnN0cnVjdGlvbiBmZWVsc1xuICAgIC8vIGEgbGl0dGxlIG9mZi4gU3VzcGVjdCBkdXBsaWNhdGluZyBpbiBzb21lIGZhc2hpb24uXG4gICAgaWYgKGNvbm4gJiYgcHJvdmlkZXIgPT09IHByb3ZpZGVyVHlwZS5UQ1BXUkFQKSB7XG4gICAgICBjb25zdCBsb2NhbEFkZHIgPSBjb25uLmxvY2FsQWRkciBhcyBEZW5vLk5ldEFkZHI7XG4gICAgICB0aGlzLiNhZGRyZXNzID0gbG9jYWxBZGRyLmhvc3RuYW1lO1xuICAgICAgdGhpcy4jcG9ydCA9IGxvY2FsQWRkci5wb3J0O1xuXG4gICAgICBjb25zdCByZW1vdGVBZGRyID0gY29ubi5yZW1vdGVBZGRyIGFzIERlbm8uTmV0QWRkcjtcbiAgICAgIHRoaXMuI3JlbW90ZUFkZHJlc3MgPSByZW1vdGVBZGRyLmhvc3RuYW1lO1xuICAgICAgdGhpcy4jcmVtb3RlUG9ydCA9IHJlbW90ZUFkZHIucG9ydDtcbiAgICAgIHRoaXMuI3JlbW90ZUZhbWlseSA9IGlzSVAocmVtb3RlQWRkci5ob3N0bmFtZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9wZW5zIGEgZmlsZSBkZXNjcmlwdG9yLlxuICAgKiBAcGFyYW0gZmQgVGhlIGZpbGUgZGVzY3JpcHRvciB0byBvcGVuLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgb3BlbihfZmQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgLy8gUkVGOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvNjUyOVxuICAgIG5vdEltcGxlbWVudGVkKFwiVENQLnByb3RvdHlwZS5vcGVuXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJpbmQgdG8gYW4gSVB2NCBhZGRyZXNzLlxuICAgKiBAcGFyYW0gYWRkcmVzcyBUaGUgaG9zdG5hbWUgdG8gYmluZCB0by5cbiAgICogQHBhcmFtIHBvcnQgVGhlIHBvcnQgdG8gYmluZCB0b1xuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgYmluZChhZGRyZXNzOiBzdHJpbmcsIHBvcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2JpbmQoYWRkcmVzcywgcG9ydCwgMCk7XG4gIH1cblxuICAvKipcbiAgICogQmluZCB0byBhbiBJUHY2IGFkZHJlc3MuXG4gICAqIEBwYXJhbSBhZGRyZXNzIFRoZSBob3N0bmFtZSB0byBiaW5kIHRvLlxuICAgKiBAcGFyYW0gcG9ydCBUaGUgcG9ydCB0byBiaW5kIHRvXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBiaW5kNihhZGRyZXNzOiBzdHJpbmcsIHBvcnQ6IG51bWJlciwgZmxhZ3M6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2JpbmQoYWRkcmVzcywgcG9ydCwgZmxhZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbm5lY3QgdG8gYW4gSVB2NCBhZGRyZXNzLlxuICAgKiBAcGFyYW0gcmVxIEEgVENQQ29ubmVjdFdyYXAgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSBhZGRyZXNzIFRoZSBob3N0bmFtZSB0byBjb25uZWN0IHRvLlxuICAgKiBAcGFyYW0gcG9ydCBUaGUgcG9ydCB0byBjb25uZWN0IHRvLlxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgY29ubmVjdChyZXE6IFRDUENvbm5lY3RXcmFwLCBhZGRyZXNzOiBzdHJpbmcsIHBvcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2Nvbm5lY3QocmVxLCBhZGRyZXNzLCBwb3J0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25uZWN0IHRvIGFuIElQdjYgYWRkcmVzcy5cbiAgICogQHBhcmFtIHJlcSBBIFRDUENvbm5lY3RXcmFwIGluc3RhbmNlLlxuICAgKiBAcGFyYW0gYWRkcmVzcyBUaGUgaG9zdG5hbWUgdG8gY29ubmVjdCB0by5cbiAgICogQHBhcmFtIHBvcnQgVGhlIHBvcnQgdG8gY29ubmVjdCB0by5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIGNvbm5lY3Q2KHJlcTogVENQQ29ubmVjdFdyYXAsIGFkZHJlc3M6IHN0cmluZywgcG9ydDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jY29ubmVjdChyZXEsIGFkZHJlc3MsIHBvcnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3RlbiBmb3IgbmV3IGNvbm5lY3Rpb25zLlxuICAgKiBAcGFyYW0gYmFja2xvZyBUaGUgbWF4aW11bSBsZW5ndGggb2YgdGhlIHF1ZXVlIG9mIHBlbmRpbmcgY29ubmVjdGlvbnMuXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBsaXN0ZW4oYmFja2xvZzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICB0aGlzLiNiYWNrbG9nID0gY2VpbFBvd09mMihiYWNrbG9nICsgMSk7XG5cbiAgICBjb25zdCBsaXN0ZW5PcHRpb25zID0ge1xuICAgICAgaG9zdG5hbWU6IHRoaXMuI2FkZHJlc3MhLFxuICAgICAgcG9ydDogdGhpcy4jcG9ydCEsXG4gICAgICB0cmFuc3BvcnQ6IFwidGNwXCIgYXMgY29uc3QsXG4gICAgfTtcblxuICAgIGxldCBsaXN0ZW5lcjtcblxuICAgIHRyeSB7XG4gICAgICBsaXN0ZW5lciA9IERlbm8ubGlzdGVuKGxpc3Rlbk9wdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQWRkckluVXNlKSB7XG4gICAgICAgIHJldHVybiBjb2RlTWFwLmdldChcIkVBRERSSU5VU0VcIikhO1xuICAgICAgfSBlbHNlIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQWRkck5vdEF2YWlsYWJsZSkge1xuICAgICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFQUREUk5PVEFWQUlMXCIpITtcbiAgICAgIH1cblxuICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVycm9ycyB0byBhcHByb3ByaWF0ZSBlcnJvciBjb2Rlcy5cbiAgICAgIHJldHVybiBjb2RlTWFwLmdldChcIlVOS05PV05cIikhO1xuICAgIH1cblxuICAgIGNvbnN0IGFkZHJlc3MgPSBsaXN0ZW5lci5hZGRyIGFzIERlbm8uTmV0QWRkcjtcbiAgICB0aGlzLiNhZGRyZXNzID0gYWRkcmVzcy5ob3N0bmFtZTtcbiAgICB0aGlzLiNwb3J0ID0gYWRkcmVzcy5wb3J0O1xuXG4gICAgdGhpcy4jbGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICB0aGlzLiNhY2NlcHQoKTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgb3ZlcnJpZGUgcmVmKCkge1xuICAgIGlmICh0aGlzLiNsaXN0ZW5lcikge1xuICAgICAgdGhpcy4jbGlzdGVuZXIucmVmKCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgdW5yZWYoKSB7XG4gICAgaWYgKHRoaXMuI2xpc3RlbmVyKSB7XG4gICAgICB0aGlzLiNsaXN0ZW5lci51bnJlZigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhlIHByb3ZpZGVkIG9iamVjdCB3aXRoIGxvY2FsIGFkZHJlc3MgZW50cmllcy5cbiAgICogQHBhcmFtIHNvY2tuYW1lIEFuIG9iamVjdCB0byBhZGQgdGhlIGxvY2FsIGFkZHJlc3MgZW50cmllcyB0by5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIGdldHNvY2tuYW1lKHNvY2tuYW1lOiBSZWNvcmQ8c3RyaW5nLCBuZXZlcj4gfCBBZGRyZXNzSW5mbyk6IG51bWJlciB7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIHRoaXMuI2FkZHJlc3MgPT09IFwidW5kZWZpbmVkXCIgfHxcbiAgICAgIHR5cGVvZiB0aGlzLiNwb3J0ID09PSBcInVuZGVmaW5lZFwiXG4gICAgKSB7XG4gICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFQUREUk5PVEFWQUlMXCIpITtcbiAgICB9XG5cbiAgICBzb2NrbmFtZS5hZGRyZXNzID0gdGhpcy4jYWRkcmVzcztcbiAgICBzb2NrbmFtZS5wb3J0ID0gdGhpcy4jcG9ydDtcbiAgICBzb2NrbmFtZS5mYW1pbHkgPSBpc0lQKHRoaXMuI2FkZHJlc3MpO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoZSBwcm92aWRlZCBvYmplY3Qgd2l0aCByZW1vdGUgYWRkcmVzcyBlbnRyaWVzLlxuICAgKiBAcGFyYW0gcGVlcm5hbWUgQW4gb2JqZWN0IHRvIGFkZCB0aGUgcmVtb3RlIGFkZHJlc3MgZW50cmllcyB0by5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gIGdldHBlZXJuYW1lKHBlZXJuYW1lOiBSZWNvcmQ8c3RyaW5nLCBuZXZlcj4gfCBBZGRyZXNzSW5mbyk6IG51bWJlciB7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIHRoaXMuI3JlbW90ZUFkZHJlc3MgPT09IFwidW5kZWZpbmVkXCIgfHxcbiAgICAgIHR5cGVvZiB0aGlzLiNyZW1vdGVQb3J0ID09PSBcInVuZGVmaW5lZFwiXG4gICAgKSB7XG4gICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFQUREUk5PVEFWQUlMXCIpITtcbiAgICB9XG5cbiAgICBwZWVybmFtZS5hZGRyZXNzID0gdGhpcy4jcmVtb3RlQWRkcmVzcztcbiAgICBwZWVybmFtZS5wb3J0ID0gdGhpcy4jcmVtb3RlUG9ydDtcbiAgICBwZWVybmFtZS5mYW1pbHkgPSB0aGlzLiNyZW1vdGVGYW1pbHk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gbm9EZWxheVxuICAgKiBAcmV0dXJuIEFuIGVycm9yIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgc2V0Tm9EZWxheShfbm9EZWxheTogYm9vbGVhbik6IG51bWJlciB7XG4gICAgLy8gVE9ETyhibm9vcmRodWlzKSBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9wdWxsLzEzMTAzXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIGVuYWJsZVxuICAgKiBAcGFyYW0gaW5pdGlhbERlbGF5XG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICBzZXRLZWVwQWxpdmUoX2VuYWJsZTogYm9vbGVhbiwgX2luaXRpYWxEZWxheTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAvLyBUT0RPKGJub29yZGh1aXMpIGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL3B1bGwvMTMxMDNcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaW5kb3dzIG9ubHkuXG4gICAqXG4gICAqIERlcHJlY2F0ZWQgYnkgTm9kZS5cbiAgICogUkVGOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvbGliL25ldC5qcyNMMTczMVxuICAgKlxuICAgKiBAcGFyYW0gZW5hYmxlXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqIEBkZXByZWNhdGVkXG4gICAqL1xuICBzZXRTaW11bHRhbmVvdXNBY2NlcHRzKF9lbmFibGU6IGJvb2xlYW4pIHtcbiAgICAvLyBMb3cgcHJpb3JpdHkgdG8gaW1wbGVtZW50IG93aW5nIHRvIGl0IGJlaW5nIGRlcHJlY2F0ZWQgaW4gTm9kZS5cbiAgICBub3RJbXBsZW1lbnRlZChcIlRDUC5wcm90b3R5cGUuc2V0U2ltdWx0YW5lb3VzQWNjZXB0c1wiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCaW5kIHRvIGFuIElQdjQgb3IgSVB2NiBhZGRyZXNzLlxuICAgKiBAcGFyYW0gYWRkcmVzcyBUaGUgaG9zdG5hbWUgdG8gYmluZCB0by5cbiAgICogQHBhcmFtIHBvcnQgVGhlIHBvcnQgdG8gYmluZCB0b1xuICAgKiBAcGFyYW0gX2ZsYWdzXG4gICAqIEByZXR1cm4gQW4gZXJyb3Igc3RhdHVzIGNvZGUuXG4gICAqL1xuICAjYmluZChhZGRyZXNzOiBzdHJpbmcsIHBvcnQ6IG51bWJlciwgX2ZsYWdzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIC8vIERlbm8gZG9lc24ndCBjdXJyZW50bHkgc2VwYXJhdGUgYmluZCBmcm9tIGNvbm5lY3QgZXRjLlxuICAgIC8vIFJFRjpcbiAgICAvLyAtIGh0dHBzOi8vZG9jLmRlbm8ubGFuZC9kZW5vL3N0YWJsZS9+L0Rlbm8uY29ubmVjdFxuICAgIC8vIC0gaHR0cHM6Ly9kb2MuZGVuby5sYW5kL2Rlbm8vc3RhYmxlL34vRGVuby5saXN0ZW5cbiAgICAvL1xuICAgIC8vIFRoaXMgYWxzbyBtZWFucyB3ZSB3b24ndCBiZSBjb25uZWN0aW5nIGZyb20gdGhlIHNwZWNpZmllZCBsb2NhbCBhZGRyZXNzXG4gICAgLy8gYW5kIHBvcnQgYXMgcHJvdmlkaW5nIHRoZXNlIGlzIG5vdCBhbiBvcHRpb24gaW4gRGVuby5cbiAgICAvLyBSRUY6XG4gICAgLy8gLSBodHRwczovL2RvYy5kZW5vLmxhbmQvZGVuby9zdGFibGUvfi9EZW5vLkNvbm5lY3RPcHRpb25zXG4gICAgLy8gLSBodHRwczovL2RvYy5kZW5vLmxhbmQvZGVuby9zdGFibGUvfi9EZW5vLkxpc3Rlbk9wdGlvbnNcblxuICAgIHRoaXMuI2FkZHJlc3MgPSBhZGRyZXNzO1xuICAgIHRoaXMuI3BvcnQgPSBwb3J0O1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogQ29ubmVjdCB0byBhbiBJUHY0IG9yIElQdjYgYWRkcmVzcy5cbiAgICogQHBhcmFtIHJlcSBBIFRDUENvbm5lY3RXcmFwIGluc3RhbmNlLlxuICAgKiBAcGFyYW0gYWRkcmVzcyBUaGUgaG9zdG5hbWUgdG8gY29ubmVjdCB0by5cbiAgICogQHBhcmFtIHBvcnQgVGhlIHBvcnQgdG8gY29ubmVjdCB0by5cbiAgICogQHJldHVybiBBbiBlcnJvciBzdGF0dXMgY29kZS5cbiAgICovXG4gICNjb25uZWN0KHJlcTogVENQQ29ubmVjdFdyYXAsIGFkZHJlc3M6IHN0cmluZywgcG9ydDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICB0aGlzLiNyZW1vdGVBZGRyZXNzID0gYWRkcmVzcztcbiAgICB0aGlzLiNyZW1vdGVQb3J0ID0gcG9ydDtcbiAgICB0aGlzLiNyZW1vdGVGYW1pbHkgPSBpc0lQKGFkZHJlc3MpO1xuXG4gICAgY29uc3QgY29ubmVjdE9wdGlvbnM6IERlbm8uQ29ubmVjdE9wdGlvbnMgPSB7XG4gICAgICBob3N0bmFtZTogYWRkcmVzcyxcbiAgICAgIHBvcnQsXG4gICAgICB0cmFuc3BvcnQ6IFwidGNwXCIsXG4gICAgfTtcblxuICAgIERlbm8uY29ubmVjdChjb25uZWN0T3B0aW9ucykudGhlbihcbiAgICAgIChjb25uOiBEZW5vLkNvbm4pID0+IHtcbiAgICAgICAgLy8gSW5jb3JyZWN0IC8gYmFja3dhcmRzLCBidXQgY29ycmVjdGluZyB0aGUgbG9jYWwgYWRkcmVzcyBhbmQgcG9ydCB3aXRoXG4gICAgICAgIC8vIHdoYXQgd2FzIGFjdHVhbGx5IHVzZWQgZ2l2ZW4gd2UgY2FuJ3QgYWN0dWFsbHkgc3BlY2lmeSB0aGVzZSBpbiBEZW5vLlxuICAgICAgICBjb25zdCBsb2NhbEFkZHIgPSBjb25uLmxvY2FsQWRkciBhcyBEZW5vLk5ldEFkZHI7XG4gICAgICAgIHRoaXMuI2FkZHJlc3MgPSByZXEubG9jYWxBZGRyZXNzID0gbG9jYWxBZGRyLmhvc3RuYW1lO1xuICAgICAgICB0aGlzLiNwb3J0ID0gcmVxLmxvY2FsUG9ydCA9IGxvY2FsQWRkci5wb3J0O1xuICAgICAgICB0aGlzW2tTdHJlYW1CYXNlRmllbGRdID0gY29ubjtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuYWZ0ZXJDb25uZWN0KHJlcSwgMCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIHN3YWxsb3cgY2FsbGJhY2sgZXJyb3JzLlxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIFRPRE8oY21vcnRlbik6IGNvcnJlY3QgbWFwcGluZyBvZiBjb25uZWN0aW9uIGVycm9yIHRvIHN0YXR1cyBjb2RlLlxuICAgICAgICAgIHRoaXMuYWZ0ZXJDb25uZWN0KHJlcSwgY29kZU1hcC5nZXQoXCJFQ09OTlJFRlVTRURcIikhKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMuXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqIEhhbmRsZSBiYWNrb2ZmIGRlbGF5cyBmb2xsb3dpbmcgYW4gdW5zdWNjZXNzZnVsIGFjY2VwdC4gKi9cbiAgYXN5bmMgI2FjY2VwdEJhY2tvZmYoKSB7XG4gICAgLy8gQmFja29mZiBhZnRlciB0cmFuc2llbnQgZXJyb3JzIHRvIGFsbG93IHRpbWUgZm9yIHRoZSBzeXN0ZW0gdG9cbiAgICAvLyByZWNvdmVyLCBhbmQgYXZvaWQgYmxvY2tpbmcgdXAgdGhlIGV2ZW50IGxvb3Agd2l0aCBhIGNvbnRpbnVvdXNseVxuICAgIC8vIHJ1bm5pbmcgbG9vcC5cbiAgICBpZiAoIXRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSkge1xuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZkRlbGF5ID0gSU5JVElBTF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZkRlbGF5ICo9IDI7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSA+PSBNQVhfQUNDRVBUX0JBQ0tPRkZfREVMQVkpIHtcbiAgICAgIHRoaXMuI2FjY2VwdEJhY2tvZmZEZWxheSA9IE1BWF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICB9XG5cbiAgICBhd2FpdCBkZWxheSh0aGlzLiNhY2NlcHRCYWNrb2ZmRGVsYXkpO1xuXG4gICAgdGhpcy4jYWNjZXB0KCk7XG4gIH1cblxuICAvKiogQWNjZXB0IG5ldyBjb25uZWN0aW9ucy4gKi9cbiAgYXN5bmMgI2FjY2VwdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy4jY2xvc2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI2Nvbm5lY3Rpb25zID4gdGhpcy4jYmFja2xvZyEpIHtcbiAgICAgIHRoaXMuI2FjY2VwdEJhY2tvZmYoKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBjb25uZWN0aW9uOiBEZW5vLkNvbm47XG5cbiAgICB0cnkge1xuICAgICAgY29ubmVjdGlvbiA9IGF3YWl0IHRoaXMuI2xpc3RlbmVyLmFjY2VwdCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQmFkUmVzb3VyY2UgJiYgdGhpcy4jY2xvc2VkKSB7XG4gICAgICAgIC8vIExpc3RlbmVyIGFuZCBzZXJ2ZXIgaGFzIGNsb3NlZC5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBtYXAgZXJyb3JzIHRvIGFwcHJvcHJpYXRlIGVycm9yIGNvZGVzLlxuICAgICAgICB0aGlzLm9uY29ubmVjdGlvbiEoY29kZU1hcC5nZXQoXCJVTktOT1dOXCIpISwgdW5kZWZpbmVkKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBzd2FsbG93IGNhbGxiYWNrIGVycm9ycy5cbiAgICAgIH1cblxuICAgICAgdGhpcy4jYWNjZXB0QmFja29mZigpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVzZXQgdGhlIGJhY2tvZmYgZGVsYXkgdXBvbiBzdWNjZXNzZnVsIGFjY2VwdC5cbiAgICB0aGlzLiNhY2NlcHRCYWNrb2ZmRGVsYXkgPSB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBjb25uZWN0aW9uSGFuZGxlID0gbmV3IFRDUChzb2NrZXRUeXBlLlNPQ0tFVCwgY29ubmVjdGlvbik7XG4gICAgdGhpcy4jY29ubmVjdGlvbnMrKztcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLm9uY29ubmVjdGlvbiEoMCwgY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBzd2FsbG93IGNhbGxiYWNrIGVycm9ycy5cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy4jYWNjZXB0KCk7XG4gIH1cblxuICAvKiogSGFuZGxlIHNlcnZlciBjbG9zdXJlLiAqL1xuICBvdmVycmlkZSBfb25DbG9zZSgpOiBudW1iZXIge1xuICAgIHRoaXMuI2Nsb3NlZCA9IHRydWU7XG4gICAgdGhpcy5yZWFkaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLiNhZGRyZXNzID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuI3BvcnQgPSB1bmRlZmluZWQ7XG5cbiAgICB0aGlzLiNyZW1vdGVBZGRyZXNzID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuI3JlbW90ZUZhbWlseSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLiNyZW1vdGVQb3J0ID0gdW5kZWZpbmVkO1xuXG4gICAgdGhpcy4jYmFja2xvZyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLiNjb25uZWN0aW9ucyA9IDA7XG4gICAgdGhpcy4jYWNjZXB0QmFja29mZkRlbGF5ID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHRoaXMucHJvdmlkZXIgPT09IHByb3ZpZGVyVHlwZS5UQ1BTRVJWRVJXUkFQKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLiNsaXN0ZW5lci5jbG9zZSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIGxpc3RlbmVyIGFscmVhZHkgY2xvc2VkXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIExpYnV2U3RyZWFtV3JhcC5wcm90b3R5cGUuX29uQ2xvc2UuY2FsbCh0aGlzKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFDdEQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSxnRUFBZ0U7QUFDaEUsc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSw0RUFBNEU7QUFDNUUscUVBQXFFO0FBQ3JFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUN6RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLDZEQUE2RDtBQUM3RCw0RUFBNEU7QUFDNUUsMkVBQTJFO0FBQzNFLHdFQUF3RTtBQUN4RSw0RUFBNEU7QUFDNUUseUNBQXlDO0FBRXpDLHFCQUFxQjtBQUNyQiwrREFBK0Q7QUFDL0QsOERBQThEO0FBRTlELFNBQVMsY0FBYyxRQUFRLGVBQWU7QUFDOUMsU0FBUyxXQUFXLFFBQVEseUJBQXlCO0FBQ3JELFNBQVMsY0FBYyxRQUFRLHVCQUF1QjtBQUN0RCxTQUFTLFNBQVMsRUFBRSxZQUFZLFFBQVEsa0JBQWtCO0FBQzFELFNBQVMsZUFBZSxRQUFRLG1CQUFtQjtBQUNuRCxTQUFTLFdBQVcsUUFBUSxlQUFlO0FBQzNDLFNBQVMsT0FBTyxRQUFRLFVBQVU7QUFDbEMsU0FBUyxLQUFLLFFBQVEscUJBQXFCO0FBQzNDLFNBQVMsZ0JBQWdCLFFBQVEsbUJBQW1CO0FBQ3BELFNBQVMsSUFBSSxRQUFRLHFCQUFxQjtBQUMxQyxTQUNFLFVBQVUsRUFDViw0QkFBNEIsRUFDNUIsd0JBQXdCLFFBQ25CLGVBQWU7SUFFdEIsNEJBQTRCLEdBQzVCO1VBQUssVUFBVTtJQUFWLFdBQUEsV0FDSCxZQUFBLEtBQUE7SUFERyxXQUFBLFdBRUgsWUFBQSxLQUFBO0dBRkcsZUFBQTtBQVdMLE9BQU8sTUFBTSx1QkFBdUI7SUFDbEMsV0FNVTtJQUNWLFFBQWlCO0lBQ2pCLEtBQWM7SUFDZCxhQUFzQjtJQUN0QixVQUFtQjtJQUVuQixhQUFjO1FB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