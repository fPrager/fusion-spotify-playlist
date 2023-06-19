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
import { Buffer } from "./buffer.ts";
import { EventEmitter } from "./events.ts";
import { ERR_BUFFER_OUT_OF_BOUNDS, ERR_INVALID_ARG_TYPE, ERR_INVALID_FD_TYPE, ERR_MISSING_ARGS, ERR_SOCKET_ALREADY_BOUND, ERR_SOCKET_BAD_BUFFER_SIZE, ERR_SOCKET_BUFFER_SIZE, ERR_SOCKET_DGRAM_IS_CONNECTED, ERR_SOCKET_DGRAM_NOT_CONNECTED, ERR_SOCKET_DGRAM_NOT_RUNNING, errnoException, exceptionWithHostPort } from "./internal/errors.ts";
import { kStateSymbol, newHandle } from "./internal/dgram.ts";
import { asyncIdSymbol, defaultTriggerAsyncIdScope, ownerSymbol } from "./internal/async_hooks.ts";
import { SendWrap } from "./internal_binding/udp_wrap.ts";
import { isInt32, validateAbortSignal, validateNumber, validatePort, validateString } from "./internal/validators.mjs";
import { guessHandleType } from "./internal_binding/util.ts";
import { os } from "./internal_binding/constants.ts";
import { nextTick } from "./process.ts";
import { isArrayBufferView } from "./internal/util/types.ts";
const { UV_UDP_REUSEADDR , UV_UDP_IPV6ONLY  } = os;
const BIND_STATE_UNBOUND = 0;
const BIND_STATE_BINDING = 1;
const BIND_STATE_BOUND = 2;
const CONNECT_STATE_DISCONNECTED = 0;
const CONNECT_STATE_CONNECTING = 1;
const CONNECT_STATE_CONNECTED = 2;
const RECV_BUFFER = true;
const SEND_BUFFER = false;
const isSocketOptions = (socketOption)=>socketOption !== null && typeof socketOption === "object";
const isUdpHandle = (handle)=>handle !== null && typeof handle === "object" && typeof handle.recvStart === "function";
const isBindOptions = (options)=>options !== null && typeof options === "object";
/**
 * Encapsulates the datagram functionality.
 *
 * New instances of `dgram.Socket` are created using `createSocket`.
 * The `new` keyword is not to be used to create `dgram.Socket` instances.
 */ export class Socket extends EventEmitter {
    [asyncIdSymbol];
    [kStateSymbol];
    type;
    constructor(type, listener){
        super();
        let lookup;
        let recvBufferSize;
        let sendBufferSize;
        let options;
        if (isSocketOptions(type)) {
            options = type;
            type = options.type;
            lookup = options.lookup;
            recvBufferSize = options.recvBufferSize;
            sendBufferSize = options.sendBufferSize;
        }
        const handle = newHandle(type, lookup);
        handle[ownerSymbol] = this;
        this[asyncIdSymbol] = handle.getAsyncId();
        this.type = type;
        if (typeof listener === "function") {
            this.on("message", listener);
        }
        this[kStateSymbol] = {
            handle,
            receiving: false,
            bindState: BIND_STATE_UNBOUND,
            connectState: CONNECT_STATE_DISCONNECTED,
            queue: undefined,
            reuseAddr: options && options.reuseAddr,
            ipv6Only: options && options.ipv6Only,
            recvBufferSize,
            sendBufferSize
        };
        if (options?.signal !== undefined) {
            const { signal  } = options;
            validateAbortSignal(signal, "options.signal");
            const onAborted = ()=>{
                this.close();
            };
            if (signal.aborted) {
                onAborted();
            } else {
                signal.addEventListener("abort", onAborted);
                this.once("close", ()=>signal.removeEventListener("abort", onAborted));
            }
        }
    }
    /**
   * Tells the kernel to join a multicast group at the given `multicastAddress`
   * and `multicastInterface` using the `IP_ADD_MEMBERSHIP` socket option. If
   * the`multicastInterface` argument is not specified, the operating system
   * will choose one interface and will add membership to it. To add membership
   * to every available interface, call `addMembership` multiple times, once
   * per interface.
   *
   * When called on an unbound socket, this method will implicitly bind to a
   * random port, listening on all interfaces.
   *
   * When sharing a UDP socket across multiple `cluster` workers, the
   * `socket.addMembership()` function must be called only once or an
   * `EADDRINUSE` error will occur:
   *
   * ```js
   * import cluster from 'cluster';
   * import dgram from 'dgram';
   *
   * if (cluster.isPrimary) {
   *   cluster.fork(); // Works ok.
   *   cluster.fork(); // Fails with EADDRINUSE.
   * } else {
   *   const s = dgram.createSocket('udp4');
   *   s.bind(1234, () => {
   *     s.addMembership('224.0.0.114');
   *   });
   * }
   * ```
   */ addMembership(multicastAddress, interfaceAddress) {
        healthCheck(this);
        if (!multicastAddress) {
            throw new ERR_MISSING_ARGS("multicastAddress");
        }
        const { handle  } = this[kStateSymbol];
        const err = handle.addMembership(multicastAddress, interfaceAddress);
        if (err) {
            throw errnoException(err, "addMembership");
        }
    }
    /**
   * Tells the kernel to join a source-specific multicast channel at the given
   * `sourceAddress` and `groupAddress`, using the `multicastInterface` with
   * the `IP_ADD_SOURCE_MEMBERSHIP` socket option. If the `multicastInterface`
   * argument is not specified, the operating system will choose one interface
   * and will add membership to it. To add membership to every available
   * interface, call `socket.addSourceSpecificMembership()` multiple times,
   * once per interface.
   *
   * When called on an unbound socket, this method will implicitly bind to a
   * random port, listening on all interfaces.
   */ addSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress) {
        healthCheck(this);
        validateString(sourceAddress, "sourceAddress");
        validateString(groupAddress, "groupAddress");
        const err = this[kStateSymbol].handle.addSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress);
        if (err) {
            throw errnoException(err, "addSourceSpecificMembership");
        }
    }
    /**
   * Returns an object containing the address information for a socket.
   * For UDP sockets, this object will contain `address`, `family` and `port`properties.
   *
   * This method throws `EBADF` if called on an unbound socket.
   */ address() {
        healthCheck(this);
        const out = {};
        const err = this[kStateSymbol].handle.getsockname(out);
        if (err) {
            throw errnoException(err, "getsockname");
        }
        return out;
    }
    bind(port_, address_ /* callback */ ) {
        let port = typeof port_ === "function" ? null : port_;
        healthCheck(this);
        const state = this[kStateSymbol];
        if (state.bindState !== BIND_STATE_UNBOUND) {
            throw new ERR_SOCKET_ALREADY_BOUND();
        }
        state.bindState = BIND_STATE_BINDING;
        const cb = arguments.length && arguments[arguments.length - 1];
        if (typeof cb === "function") {
            // deno-lint-ignore no-inner-declarations
            function removeListeners() {
                this.removeListener("error", removeListeners);
                this.removeListener("listening", onListening);
            }
            // deno-lint-ignore no-inner-declarations
            function onListening() {
                removeListeners.call(this);
                cb.call(this);
            }
            this.on("error", removeListeners);
            this.on("listening", onListening);
        }
        if (isUdpHandle(port)) {
            replaceHandle(this, port);
            startListening(this);
            return this;
        }
        // Open an existing fd instead of creating a new one.
        if (isBindOptions(port) && isInt32(port.fd) && port.fd > 0) {
            const fd = port.fd;
            const state1 = this[kStateSymbol];
            // TODO(cmorten): here we deviate somewhat from the Node implementation which
            // makes use of the https://nodejs.org/api/cluster.html module to run servers
            // across a "cluster" of Node processes to take advantage of multi-core
            // systems.
            //
            // Though Deno has has a Worker capability from which we could simulate this,
            // for now we assert that we are _always_ on the primary process.
            const type = guessHandleType(fd);
            if (type !== "UDP") {
                throw new ERR_INVALID_FD_TYPE(type);
            }
            const err = state1.handle.open(fd);
            if (err) {
                throw errnoException(err, "open");
            }
            startListening(this);
            return this;
        }
        let address;
        if (isBindOptions(port)) {
            address = port.address || "";
            port = port.port;
        } else {
            address = typeof address_ === "function" ? "" : address_;
        }
        // Defaulting address for bind to all interfaces
        if (!address) {
            if (this.type === "udp4") {
                address = "0.0.0.0";
            } else {
                address = "::";
            }
        }
        // Resolve address first
        state.handle.lookup(address, (lookupError, ip)=>{
            if (lookupError) {
                state.bindState = BIND_STATE_UNBOUND;
                this.emit("error", lookupError);
                return;
            }
            let flags = 0;
            if (state.reuseAddr) {
                flags |= UV_UDP_REUSEADDR;
            }
            if (state.ipv6Only) {
                flags |= UV_UDP_IPV6ONLY;
            }
            // TODO(cmorten): here we deviate somewhat from the Node implementation which
            // makes use of the https://nodejs.org/api/cluster.html module to run servers
            // across a "cluster" of Node processes to take advantage of multi-core
            // systems.
            //
            // Though Deno has has a Worker capability from which we could simulate this,
            // for now we assert that we are _always_ on the primary process.
            if (!state.handle) {
                return; // Handle has been closed in the mean time
            }
            const err = state.handle.bind(ip, port || 0, flags);
            if (err) {
                const ex = exceptionWithHostPort(err, "bind", ip, port);
                state.bindState = BIND_STATE_UNBOUND;
                this.emit("error", ex);
                // Todo: close?
                return;
            }
            startListening(this);
        });
        return this;
    }
    /**
   * Close the underlying socket and stop listening for data on it. If a
   * callback is provided, it is added as a listener for the `'close'` event.
   *
   * @param callback Called when the socket has been closed.
   */ close(callback) {
        const state = this[kStateSymbol];
        const queue = state.queue;
        if (typeof callback === "function") {
            this.on("close", callback);
        }
        if (queue !== undefined) {
            queue.push(this.close.bind(this));
            return this;
        }
        healthCheck(this);
        stopReceiving(this);
        state.handle.close();
        state.handle = null;
        defaultTriggerAsyncIdScope(this[asyncIdSymbol], nextTick, socketCloseNT, this);
        return this;
    }
    connect(port, address, callback) {
        port = validatePort(port, "Port", false);
        if (typeof address === "function") {
            callback = address;
            address = "";
        } else if (address === undefined) {
            address = "";
        }
        validateString(address, "address");
        const state = this[kStateSymbol];
        if (state.connectState !== CONNECT_STATE_DISCONNECTED) {
            throw new ERR_SOCKET_DGRAM_IS_CONNECTED();
        }
        state.connectState = CONNECT_STATE_CONNECTING;
        if (state.bindState === BIND_STATE_UNBOUND) {
            this.bind({
                port: 0,
                exclusive: true
            });
        }
        if (state.bindState !== BIND_STATE_BOUND) {
            enqueue(this, _connect.bind(this, port, address, callback));
            return;
        }
        Reflect.apply(_connect, this, [
            port,
            address,
            callback
        ]);
    }
    /**
   * A synchronous function that disassociates a connected `dgram.Socket` from
   * its remote address. Trying to call `disconnect()` on an unbound or already
   * disconnected socket will result in an `ERR_SOCKET_DGRAM_NOT_CONNECTED`
   * exception.
   */ disconnect() {
        const state = this[kStateSymbol];
        if (state.connectState !== CONNECT_STATE_CONNECTED) {
            throw new ERR_SOCKET_DGRAM_NOT_CONNECTED();
        }
        const err = state.handle.disconnect();
        if (err) {
            throw errnoException(err, "connect");
        } else {
            state.connectState = CONNECT_STATE_DISCONNECTED;
        }
    }
    /**
   * Instructs the kernel to leave a multicast group at `multicastAddress`
   * using the `IP_DROP_MEMBERSHIP` socket option. This method is automatically
   * called by the kernel when the socket is closed or the process terminates,
   * so most apps will never have reason to call this.
   *
   * If `multicastInterface` is not specified, the operating system will
   * attempt to drop membership on all valid interfaces.
   */ dropMembership(multicastAddress, interfaceAddress) {
        healthCheck(this);
        if (!multicastAddress) {
            throw new ERR_MISSING_ARGS("multicastAddress");
        }
        const err = this[kStateSymbol].handle.dropMembership(multicastAddress, interfaceAddress);
        if (err) {
            throw errnoException(err, "dropMembership");
        }
    }
    /**
   * Instructs the kernel to leave a source-specific multicast channel at the
   * given `sourceAddress` and `groupAddress` using the
   * `IP_DROP_SOURCE_MEMBERSHIP` socket option. This method is automatically
   * called by the kernel when the socket is closed or the process terminates,
   * so most apps will never have reason to call this.
   *
   * If `multicastInterface` is not specified, the operating system will
   * attempt to drop membership on all valid interfaces.
   */ dropSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress) {
        healthCheck(this);
        validateString(sourceAddress, "sourceAddress");
        validateString(groupAddress, "groupAddress");
        const err = this[kStateSymbol].handle.dropSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress);
        if (err) {
            throw errnoException(err, "dropSourceSpecificMembership");
        }
    }
    /**
   * This method throws `ERR_SOCKET_BUFFER_SIZE` if called on an unbound
   * socket.
   *
   * @return the `SO_RCVBUF` socket receive buffer size in bytes.
   */ getRecvBufferSize() {
        return bufferSize(this, 0, RECV_BUFFER);
    }
    /**
   * This method throws `ERR_SOCKET_BUFFER_SIZE` if called on an unbound
   * socket.
   *
   * @return the `SO_SNDBUF` socket send buffer size in bytes.
   */ getSendBufferSize() {
        return bufferSize(this, 0, SEND_BUFFER);
    }
    /**
   * By default, binding a socket will cause it to block the Node.js process
   * from exiting as long as the socket is open. The `socket.unref()` method
   * can be used to exclude the socket from the reference counting that keeps
   * the Node.js process active. The `socket.ref()` method adds the socket back
   * to the reference counting and restores the default behavior.
   *
   * Calling `socket.ref()` multiples times will have no additional effect.
   *
   * The `socket.ref()` method returns a reference to the socket so calls can
   * be chained.
   */ ref() {
        const handle = this[kStateSymbol].handle;
        if (handle) {
            handle.ref();
        }
        return this;
    }
    /**
   * Returns an object containing the `address`, `family`, and `port` of the
   * remote endpoint. This method throws an `ERR_SOCKET_DGRAM_NOT_CONNECTED`
   * exception if the socket is not connected.
   */ remoteAddress() {
        healthCheck(this);
        const state = this[kStateSymbol];
        if (state.connectState !== CONNECT_STATE_CONNECTED) {
            throw new ERR_SOCKET_DGRAM_NOT_CONNECTED();
        }
        const out = {};
        const err = state.handle.getpeername(out);
        if (err) {
            throw errnoException(err, "getpeername");
        }
        return out;
    }
    send(buffer, offset, length, port, address, callback) {
        let list;
        const state = this[kStateSymbol];
        const connected = state.connectState === CONNECT_STATE_CONNECTED;
        if (!connected) {
            if (address || port && typeof port !== "function") {
                buffer = sliceBuffer(buffer, offset, length);
            } else {
                callback = port;
                port = offset;
                address = length;
            }
        } else {
            if (typeof length === "number") {
                buffer = sliceBuffer(buffer, offset, length);
                if (typeof port === "function") {
                    callback = port;
                    port = null;
                }
            } else {
                callback = offset;
            }
            if (port || address) {
                throw new ERR_SOCKET_DGRAM_IS_CONNECTED();
            }
        }
        if (!Array.isArray(buffer)) {
            if (typeof buffer === "string") {
                list = [
                    Buffer.from(buffer)
                ];
            } else if (!isArrayBufferView(buffer)) {
                throw new ERR_INVALID_ARG_TYPE("buffer", [
                    "Buffer",
                    "TypedArray",
                    "DataView",
                    "string"
                ], buffer);
            } else {
                list = [
                    buffer
                ];
            }
        } else if (!(list = fixBufferList(buffer))) {
            throw new ERR_INVALID_ARG_TYPE("buffer list arguments", [
                "Buffer",
                "TypedArray",
                "DataView",
                "string"
            ], buffer);
        }
        if (!connected) {
            port = validatePort(port, "Port", false);
        }
        // Normalize callback so it's either a function or undefined but not anything
        // else.
        if (typeof callback !== "function") {
            callback = undefined;
        }
        if (typeof address === "function") {
            callback = address;
            address = undefined;
        } else if (address && typeof address !== "string") {
            throw new ERR_INVALID_ARG_TYPE("address", [
                "string",
                "falsy"
            ], address);
        }
        healthCheck(this);
        if (state.bindState === BIND_STATE_UNBOUND) {
            this.bind({
                port: 0,
                exclusive: true
            });
        }
        if (list.length === 0) {
            list.push(Buffer.alloc(0));
        }
        // If the socket hasn't been bound yet, push the outbound packet onto the
        // send queue and send after binding is complete.
        if (state.bindState !== BIND_STATE_BOUND) {
            // @ts-ignore mapping unknowns back onto themselves doesn't type nicely
            enqueue(this, this.send.bind(this, list, port, address, callback));
            return;
        }
        const afterDns = (ex, ip)=>{
            defaultTriggerAsyncIdScope(this[asyncIdSymbol], doSend, ex, this, ip, list, address, port, callback);
        };
        if (!connected) {
            state.handle.lookup(address, afterDns);
        } else {
            afterDns(null, "");
        }
    }
    /**
   * Sets or clears the `SO_BROADCAST` socket option. When set to `true`, UDP
   * packets may be sent to a local interface's broadcast address.
   *
   * This method throws `EBADF` if called on an unbound socket.
   */ setBroadcast(arg) {
        const err = this[kStateSymbol].handle.setBroadcast(arg ? 1 : 0);
        if (err) {
            throw errnoException(err, "setBroadcast");
        }
    }
    /**
   * _All references to scope in this section are referring to [IPv6 Zone Indices](https://en.wikipedia.org/wiki/IPv6_address#Scoped_literal_IPv6_addresses), which are defined by [RFC
   * 4007](https://tools.ietf.org/html/rfc4007). In string form, an IP_
   * _with a scope index is written as `'IP%scope'` where scope is an interface name_
   * _or interface number._
   *
   * Sets the default outgoing multicast interface of the socket to a chosen
   * interface or back to system interface selection. The `multicastInterface` must
   * be a valid string representation of an IP from the socket's family.
   *
   * For IPv4 sockets, this should be the IP configured for the desired physical
   * interface. All packets sent to multicast on the socket will be sent on the
   * interface determined by the most recent successful use of this call.
   *
   * For IPv6 sockets, `multicastInterface` should include a scope to indicate the
   * interface as in the examples that follow. In IPv6, individual `send` calls can
   * also use explicit scope in addresses, so only packets sent to a multicast
   * address without specifying an explicit scope are affected by the most recent
   * successful use of this call.
   *
   * This method throws `EBADF` if called on an unbound socket.
   *
   * #### Example: IPv6 outgoing multicast interface
   *
   * On most systems, where scope format uses the interface name:
   *
   * ```js
   * const socket = dgram.createSocket('udp6');
   *
   * socket.bind(1234, () => {
   *   socket.setMulticastInterface('::%eth1');
   * });
   * ```
   *
   * On Windows, where scope format uses an interface number:
   *
   * ```js
   * const socket = dgram.createSocket('udp6');
   *
   * socket.bind(1234, () => {
   *   socket.setMulticastInterface('::%2');
   * });
   * ```
   *
   * #### Example: IPv4 outgoing multicast interface
   *
   * All systems use an IP of the host on the desired physical interface:
   *
   * ```js
   * const socket = dgram.createSocket('udp4');
   *
   * socket.bind(1234, () => {
   *   socket.setMulticastInterface('10.0.0.2');
   * });
   * ```
   */ setMulticastInterface(interfaceAddress) {
        healthCheck(this);
        validateString(interfaceAddress, "interfaceAddress");
        const err = this[kStateSymbol].handle.setMulticastInterface(interfaceAddress);
        if (err) {
            throw errnoException(err, "setMulticastInterface");
        }
    }
    /**
   * Sets or clears the `IP_MULTICAST_LOOP` socket option. When set to `true`,
   * multicast packets will also be received on the local interface.
   *
   * This method throws `EBADF` if called on an unbound socket.
   */ setMulticastLoopback(arg) {
        const err = this[kStateSymbol].handle.setMulticastLoopback(arg ? 1 : 0);
        if (err) {
            throw errnoException(err, "setMulticastLoopback");
        }
        return arg; // 0.4 compatibility
    }
    /**
   * Sets the `IP_MULTICAST_TTL` socket option. While TTL generally stands for
   * "Time to Live", in this context it specifies the number of IP hops that a
   * packet is allowed to travel through, specifically for multicast traffic. Each
   * router or gateway that forwards a packet decrements the TTL. If the TTL is
   * decremented to 0 by a router, it will not be forwarded.
   *
   * The `ttl` argument may be between 0 and 255\. The default on most systems is `1`.
   *
   * This method throws `EBADF` if called on an unbound socket.
   */ setMulticastTTL(ttl) {
        validateNumber(ttl, "ttl");
        const err = this[kStateSymbol].handle.setMulticastTTL(ttl);
        if (err) {
            throw errnoException(err, "setMulticastTTL");
        }
        return ttl;
    }
    /**
   * Sets the `SO_RCVBUF` socket option. Sets the maximum socket receive buffer
   * in bytes.
   *
   * This method throws `ERR_SOCKET_BUFFER_SIZE` if called on an unbound socket.
   */ setRecvBufferSize(size) {
        bufferSize(this, size, RECV_BUFFER);
    }
    /**
   * Sets the `SO_SNDBUF` socket option. Sets the maximum socket send buffer
   * in bytes.
   *
   * This method throws `ERR_SOCKET_BUFFER_SIZE` if called on an unbound socket.
   */ setSendBufferSize(size) {
        bufferSize(this, size, SEND_BUFFER);
    }
    /**
   * Sets the `IP_TTL` socket option. While TTL generally stands for "Time to Live",
   * in this context it specifies the number of IP hops that a packet is allowed to
   * travel through. Each router or gateway that forwards a packet decrements the
   * TTL. If the TTL is decremented to 0 by a router, it will not be forwarded.
   * Changing TTL values is typically done for network probes or when multicasting.
   *
   * The `ttl` argument may be between between 1 and 255\. The default on most systems
   * is 64.
   *
   * This method throws `EBADF` if called on an unbound socket.
   */ setTTL(ttl) {
        validateNumber(ttl, "ttl");
        const err = this[kStateSymbol].handle.setTTL(ttl);
        if (err) {
            throw errnoException(err, "setTTL");
        }
        return ttl;
    }
    /**
   * By default, binding a socket will cause it to block the Node.js process from
   * exiting as long as the socket is open. The `socket.unref()` method can be used
   * to exclude the socket from the reference counting that keeps the Node.js
   * process active, allowing the process to exit even if the socket is still
   * listening.
   *
   * Calling `socket.unref()` multiple times will have no addition effect.
   *
   * The `socket.unref()` method returns a reference to the socket so calls can be
   * chained.
   */ unref() {
        const handle = this[kStateSymbol].handle;
        if (handle) {
            handle.unref();
        }
        return this;
    }
}
export function createSocket(type, listener) {
    return new Socket(type, listener);
}
function startListening(socket) {
    const state = socket[kStateSymbol];
    state.handle.onmessage = onMessage;
    // Todo: handle errors
    state.handle.recvStart();
    state.receiving = true;
    state.bindState = BIND_STATE_BOUND;
    if (state.recvBufferSize) {
        bufferSize(socket, state.recvBufferSize, RECV_BUFFER);
    }
    if (state.sendBufferSize) {
        bufferSize(socket, state.sendBufferSize, SEND_BUFFER);
    }
    socket.emit("listening");
}
function replaceHandle(self, newHandle) {
    const state = self[kStateSymbol];
    const oldHandle = state.handle;
    // Set up the handle that we got from primary.
    newHandle.lookup = oldHandle.lookup;
    newHandle.bind = oldHandle.bind;
    newHandle.send = oldHandle.send;
    newHandle[ownerSymbol] = self;
    // Replace the existing handle by the handle we got from primary.
    oldHandle.close();
    state.handle = newHandle;
}
function bufferSize(self, size, buffer) {
    if (size >>> 0 !== size) {
        throw new ERR_SOCKET_BAD_BUFFER_SIZE();
    }
    const ctx = {};
    const ret = self[kStateSymbol].handle.bufferSize(size, buffer, ctx);
    if (ret === undefined) {
        throw new ERR_SOCKET_BUFFER_SIZE(ctx);
    }
    return ret;
}
function socketCloseNT(self) {
    self.emit("close");
}
function healthCheck(socket) {
    if (!socket[kStateSymbol].handle) {
        // Error message from dgram_legacy.js.
        throw new ERR_SOCKET_DGRAM_NOT_RUNNING();
    }
}
function stopReceiving(socket) {
    const state = socket[kStateSymbol];
    if (!state.receiving) {
        return;
    }
    state.handle.recvStop();
    state.receiving = false;
}
function onMessage(nread, handle, buf, rinfo) {
    const self = handle[ownerSymbol];
    if (nread < 0) {
        self.emit("error", errnoException(nread, "recvmsg"));
        return;
    }
    rinfo.size = buf.length; // compatibility
    self.emit("message", buf, rinfo);
}
function sliceBuffer(buffer, offset, length) {
    if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
    } else if (!isArrayBufferView(buffer)) {
        throw new ERR_INVALID_ARG_TYPE("buffer", [
            "Buffer",
            "TypedArray",
            "DataView",
            "string"
        ], buffer);
    }
    offset = offset >>> 0;
    length = length >>> 0;
    if (offset > buffer.byteLength) {
        throw new ERR_BUFFER_OUT_OF_BOUNDS("offset");
    }
    if (offset + length > buffer.byteLength) {
        throw new ERR_BUFFER_OUT_OF_BOUNDS("length");
    }
    return Buffer.from(buffer.buffer, buffer.byteOffset + offset, length);
}
function fixBufferList(list) {
    const newList = new Array(list.length);
    for(let i = 0, l = list.length; i < l; i++){
        const buf = list[i];
        if (typeof buf === "string") {
            newList[i] = Buffer.from(buf);
        } else if (!isArrayBufferView(buf)) {
            return null;
        } else {
            newList[i] = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
        }
    }
    return newList;
}
function enqueue(self, toEnqueue) {
    const state = self[kStateSymbol];
    // If the send queue hasn't been initialized yet, do it, and install an
    // event handler that flushes the send queue after binding is done.
    if (state.queue === undefined) {
        state.queue = [];
        self.once(EventEmitter.errorMonitor, onListenError);
        self.once("listening", onListenSuccess);
    }
    state.queue.push(toEnqueue);
}
function onListenSuccess() {
    this.removeListener(EventEmitter.errorMonitor, onListenError);
    clearQueue.call(this);
}
function onListenError() {
    this.removeListener("listening", onListenSuccess);
    this[kStateSymbol].queue = undefined;
}
function clearQueue() {
    const state = this[kStateSymbol];
    const queue = state.queue;
    state.queue = undefined;
    // Flush the send queue.
    for (const queueEntry of queue){
        queueEntry();
    }
}
function _connect(port, address, callback) {
    const state = this[kStateSymbol];
    if (callback) {
        this.once("connect", callback);
    }
    const afterDns = (ex, ip)=>{
        defaultTriggerAsyncIdScope(this[asyncIdSymbol], doConnect, ex, this, ip, address, port, callback);
    };
    state.handle.lookup(address, afterDns);
}
function doConnect(ex, self, ip, address, port, callback) {
    const state = self[kStateSymbol];
    if (!state.handle) {
        return;
    }
    if (!ex) {
        const err = state.handle.connect(ip, port);
        if (err) {
            ex = exceptionWithHostPort(err, "connect", address, port);
        }
    }
    if (ex) {
        state.connectState = CONNECT_STATE_DISCONNECTED;
        return nextTick(()=>{
            if (callback) {
                self.removeListener("connect", callback);
                callback(ex);
            } else {
                self.emit("error", ex);
            }
        });
    }
    state.connectState = CONNECT_STATE_CONNECTED;
    nextTick(()=>self.emit("connect"));
}
function doSend(ex, self, ip, list, address, port, callback) {
    const state = self[kStateSymbol];
    if (ex) {
        if (typeof callback === "function") {
            nextTick(callback, ex);
            return;
        }
        nextTick(()=>self.emit("error", ex));
        return;
    } else if (!state.handle) {
        return;
    }
    const req = new SendWrap();
    req.list = list; // Keep reference alive.
    req.address = address;
    req.port = port;
    if (callback) {
        req.callback = callback;
        req.oncomplete = afterSend;
    }
    let err;
    if (port) {
        err = state.handle.send(req, list, list.length, port, ip, !!callback);
    } else {
        err = state.handle.send(req, list, list.length, !!callback);
    }
    if (err >= 1) {
        // Synchronous finish. The return code is msg_length + 1 so that we can
        // distinguish between synchronous success and asynchronous success.
        if (callback) {
            nextTick(callback, null, err - 1);
        }
        return;
    }
    if (err && callback) {
        // Don't emit as error, dgram_legacy.js compatibility
        const ex1 = exceptionWithHostPort(err, "send", address, port);
        nextTick(callback, ex1);
    }
}
function afterSend(err, sent) {
    let ex;
    if (err) {
        ex = exceptionWithHostPort(err, "send", this.address, this.port);
    } else {
        ex = null;
    }
    this.callback(ex, sent);
}
export default {
    createSocket,
    Socket
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvZGdyYW0udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCIuL2V2ZW50cy50c1wiO1xuaW1wb3J0IHsgbG9va3VwIGFzIGRlZmF1bHRMb29rdXAgfSBmcm9tIFwiLi9kbnMudHNcIjtcbmltcG9ydCB0eXBlIHsgRXJybm9FeGNlcHRpb24sIE5vZGVTeXN0ZW1FcnJvckN0eCB9IGZyb20gXCIuL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHtcbiAgRVJSX0JVRkZFUl9PVVRfT0ZfQk9VTkRTLFxuICBFUlJfSU5WQUxJRF9BUkdfVFlQRSxcbiAgRVJSX0lOVkFMSURfRkRfVFlQRSxcbiAgRVJSX01JU1NJTkdfQVJHUyxcbiAgRVJSX1NPQ0tFVF9BTFJFQURZX0JPVU5ELFxuICBFUlJfU09DS0VUX0JBRF9CVUZGRVJfU0laRSxcbiAgRVJSX1NPQ0tFVF9CVUZGRVJfU0laRSxcbiAgRVJSX1NPQ0tFVF9ER1JBTV9JU19DT05ORUNURUQsXG4gIEVSUl9TT0NLRVRfREdSQU1fTk9UX0NPTk5FQ1RFRCxcbiAgRVJSX1NPQ0tFVF9ER1JBTV9OT1RfUlVOTklORyxcbiAgZXJybm9FeGNlcHRpb24sXG4gIGV4Y2VwdGlvbldpdGhIb3N0UG9ydCxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgdHlwZSB7IEFib3J0YWJsZSB9IGZyb20gXCIuL19ldmVudHMuZC50c1wiO1xuaW1wb3J0IHsga1N0YXRlU3ltYm9sLCBuZXdIYW5kbGUgfSBmcm9tIFwiLi9pbnRlcm5hbC9kZ3JhbS50c1wiO1xuaW1wb3J0IHR5cGUgeyBTb2NrZXRUeXBlIH0gZnJvbSBcIi4vaW50ZXJuYWwvZGdyYW0udHNcIjtcbmltcG9ydCB7XG4gIGFzeW5jSWRTeW1ib2wsXG4gIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlLFxuICBvd25lclN5bWJvbCxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvYXN5bmNfaG9va3MudHNcIjtcbmltcG9ydCB7IFNlbmRXcmFwLCBVRFAgfSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL3VkcF93cmFwLnRzXCI7XG5pbXBvcnQge1xuICBpc0ludDMyLFxuICB2YWxpZGF0ZUFib3J0U2lnbmFsLFxuICB2YWxpZGF0ZU51bWJlcixcbiAgdmFsaWRhdGVQb3J0LFxuICB2YWxpZGF0ZVN0cmluZyxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IGd1ZXNzSGFuZGxlVHlwZSB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvdXRpbC50c1wiO1xuaW1wb3J0IHsgb3MgfSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi9wcm9jZXNzLnRzXCI7XG5pbXBvcnQgeyBpc0FycmF5QnVmZmVyVmlldyB9IGZyb20gXCIuL2ludGVybmFsL3V0aWwvdHlwZXMudHNcIjtcblxuY29uc3QgeyBVVl9VRFBfUkVVU0VBRERSLCBVVl9VRFBfSVBWNk9OTFkgfSA9IG9zO1xuXG5jb25zdCBCSU5EX1NUQVRFX1VOQk9VTkQgPSAwO1xuY29uc3QgQklORF9TVEFURV9CSU5ESU5HID0gMTtcbmNvbnN0IEJJTkRfU1RBVEVfQk9VTkQgPSAyO1xuXG5jb25zdCBDT05ORUNUX1NUQVRFX0RJU0NPTk5FQ1RFRCA9IDA7XG5jb25zdCBDT05ORUNUX1NUQVRFX0NPTk5FQ1RJTkcgPSAxO1xuY29uc3QgQ09OTkVDVF9TVEFURV9DT05ORUNURUQgPSAyO1xuXG5jb25zdCBSRUNWX0JVRkZFUiA9IHRydWU7XG5jb25zdCBTRU5EX0JVRkZFUiA9IGZhbHNlO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFkZHJlc3NJbmZvIHtcbiAgYWRkcmVzczogc3RyaW5nO1xuICBmYW1pbHk6IG51bWJlcjtcbiAgcG9ydDogbnVtYmVyO1xufVxuXG5leHBvcnQgdHlwZSBNZXNzYWdlVHlwZSA9IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIgfCBEYXRhVmlldztcblxuZXhwb3J0IHR5cGUgUmVtb3RlSW5mbyA9IHtcbiAgYWRkcmVzczogc3RyaW5nO1xuICBmYW1pbHk6IFwiSVB2NFwiIHwgXCJJUHY2XCI7XG4gIHBvcnQ6IG51bWJlcjtcbiAgc2l6ZT86IG51bWJlcjtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmluZE9wdGlvbnMge1xuICBwb3J0PzogbnVtYmVyO1xuICBhZGRyZXNzPzogc3RyaW5nO1xuICBleGNsdXNpdmU/OiBib29sZWFuO1xuICBmZD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTb2NrZXRPcHRpb25zIGV4dGVuZHMgQWJvcnRhYmxlIHtcbiAgdHlwZTogU29ja2V0VHlwZTtcbiAgcmV1c2VBZGRyPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBpcHY2T25seT86IGJvb2xlYW47XG4gIHJlY3ZCdWZmZXJTaXplPzogbnVtYmVyO1xuICBzZW5kQnVmZmVyU2l6ZT86IG51bWJlcjtcbiAgbG9va3VwPzogdHlwZW9mIGRlZmF1bHRMb29rdXA7XG59XG5cbmludGVyZmFjZSBTb2NrZXRJbnRlcm5hbFN0YXRlIHtcbiAgaGFuZGxlOiBVRFAgfCBudWxsO1xuICByZWNlaXZpbmc6IGJvb2xlYW47XG4gIGJpbmRTdGF0ZTpcbiAgICB8IHR5cGVvZiBCSU5EX1NUQVRFX1VOQk9VTkRcbiAgICB8IHR5cGVvZiBCSU5EX1NUQVRFX0JJTkRJTkdcbiAgICB8IHR5cGVvZiBCSU5EX1NUQVRFX0JPVU5EO1xuICBjb25uZWN0U3RhdGU6XG4gICAgfCB0eXBlb2YgQ09OTkVDVF9TVEFURV9ESVNDT05ORUNURURcbiAgICB8IHR5cGVvZiBDT05ORUNUX1NUQVRFX0NPTk5FQ1RJTkdcbiAgICB8IHR5cGVvZiBDT05ORUNUX1NUQVRFX0NPTk5FQ1RFRDtcbiAgcXVldWU/OiBBcnJheTwoKSA9PiB2b2lkPjtcbiAgcmV1c2VBZGRyPzogYm9vbGVhbjtcbiAgaXB2Nk9ubHk/OiBib29sZWFuO1xuICByZWN2QnVmZmVyU2l6ZT86IG51bWJlcjtcbiAgc2VuZEJ1ZmZlclNpemU/OiBudW1iZXI7XG59XG5cbmNvbnN0IGlzU29ja2V0T3B0aW9ucyA9IChcbiAgc29ja2V0T3B0aW9uOiB1bmtub3duLFxuKTogc29ja2V0T3B0aW9uIGlzIFNvY2tldE9wdGlvbnMgPT5cbiAgc29ja2V0T3B0aW9uICE9PSBudWxsICYmIHR5cGVvZiBzb2NrZXRPcHRpb24gPT09IFwib2JqZWN0XCI7XG5cbmNvbnN0IGlzVWRwSGFuZGxlID0gKGhhbmRsZTogdW5rbm93bik6IGhhbmRsZSBpcyBVRFAgPT5cbiAgaGFuZGxlICE9PSBudWxsICYmXG4gIHR5cGVvZiBoYW5kbGUgPT09IFwib2JqZWN0XCIgJiZcbiAgdHlwZW9mIChoYW5kbGUgYXMgVURQKS5yZWN2U3RhcnQgPT09IFwiZnVuY3Rpb25cIjtcblxuY29uc3QgaXNCaW5kT3B0aW9ucyA9IChvcHRpb25zOiB1bmtub3duKTogb3B0aW9ucyBpcyBCaW5kT3B0aW9ucyA9PlxuICBvcHRpb25zICE9PSBudWxsICYmIHR5cGVvZiBvcHRpb25zID09PSBcIm9iamVjdFwiO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgZGF0YWdyYW0gZnVuY3Rpb25hbGl0eS5cbiAqXG4gKiBOZXcgaW5zdGFuY2VzIG9mIGBkZ3JhbS5Tb2NrZXRgIGFyZSBjcmVhdGVkIHVzaW5nIGBjcmVhdGVTb2NrZXRgLlxuICogVGhlIGBuZXdgIGtleXdvcmQgaXMgbm90IHRvIGJlIHVzZWQgdG8gY3JlYXRlIGBkZ3JhbS5Tb2NrZXRgIGluc3RhbmNlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFNvY2tldCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIFthc3luY0lkU3ltYm9sXSE6IG51bWJlcjtcbiAgW2tTdGF0ZVN5bWJvbF0hOiBTb2NrZXRJbnRlcm5hbFN0YXRlO1xuXG4gIHR5cGUhOiBTb2NrZXRUeXBlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHR5cGU6IFNvY2tldFR5cGUgfCBTb2NrZXRPcHRpb25zLFxuICAgIGxpc3RlbmVyPzogKG1zZzogQnVmZmVyLCByaW5mbzogUmVtb3RlSW5mbykgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGxldCBsb29rdXA7XG4gICAgbGV0IHJlY3ZCdWZmZXJTaXplO1xuICAgIGxldCBzZW5kQnVmZmVyU2l6ZTtcblxuICAgIGxldCBvcHRpb25zOiBTb2NrZXRPcHRpb25zIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKGlzU29ja2V0T3B0aW9ucyh0eXBlKSkge1xuICAgICAgb3B0aW9ucyA9IHR5cGU7XG4gICAgICB0eXBlID0gb3B0aW9ucy50eXBlO1xuICAgICAgbG9va3VwID0gb3B0aW9ucy5sb29rdXA7XG4gICAgICByZWN2QnVmZmVyU2l6ZSA9IG9wdGlvbnMucmVjdkJ1ZmZlclNpemU7XG4gICAgICBzZW5kQnVmZmVyU2l6ZSA9IG9wdGlvbnMuc2VuZEJ1ZmZlclNpemU7XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlID0gbmV3SGFuZGxlKHR5cGUsIGxvb2t1cCk7XG4gICAgaGFuZGxlW293bmVyU3ltYm9sXSA9IHRoaXM7XG5cbiAgICB0aGlzW2FzeW5jSWRTeW1ib2xdID0gaGFuZGxlLmdldEFzeW5jSWQoKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aGlzLm9uKFwibWVzc2FnZVwiLCBsaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgdGhpc1trU3RhdGVTeW1ib2xdID0ge1xuICAgICAgaGFuZGxlLFxuICAgICAgcmVjZWl2aW5nOiBmYWxzZSxcbiAgICAgIGJpbmRTdGF0ZTogQklORF9TVEFURV9VTkJPVU5ELFxuICAgICAgY29ubmVjdFN0YXRlOiBDT05ORUNUX1NUQVRFX0RJU0NPTk5FQ1RFRCxcbiAgICAgIHF1ZXVlOiB1bmRlZmluZWQsXG4gICAgICByZXVzZUFkZHI6IG9wdGlvbnMgJiYgb3B0aW9ucy5yZXVzZUFkZHIsIC8vIFVzZSBVVl9VRFBfUkVVU0VBRERSIGlmIHRydWUuXG4gICAgICBpcHY2T25seTogb3B0aW9ucyAmJiBvcHRpb25zLmlwdjZPbmx5LFxuICAgICAgcmVjdkJ1ZmZlclNpemUsXG4gICAgICBzZW5kQnVmZmVyU2l6ZSxcbiAgICB9O1xuXG4gICAgaWYgKG9wdGlvbnM/LnNpZ25hbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCB7IHNpZ25hbCB9ID0gb3B0aW9ucztcblxuICAgICAgdmFsaWRhdGVBYm9ydFNpZ25hbChzaWduYWwsIFwib3B0aW9ucy5zaWduYWxcIik7XG5cbiAgICAgIGNvbnN0IG9uQWJvcnRlZCA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfTtcblxuICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICAgIG9uQWJvcnRlZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBvbkFib3J0ZWQpO1xuXG4gICAgICAgIHRoaXMub25jZShcbiAgICAgICAgICBcImNsb3NlXCIsXG4gICAgICAgICAgKCkgPT4gc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBvbkFib3J0ZWQpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZWxscyB0aGUga2VybmVsIHRvIGpvaW4gYSBtdWx0aWNhc3QgZ3JvdXAgYXQgdGhlIGdpdmVuIGBtdWx0aWNhc3RBZGRyZXNzYFxuICAgKiBhbmQgYG11bHRpY2FzdEludGVyZmFjZWAgdXNpbmcgdGhlIGBJUF9BRERfTUVNQkVSU0hJUGAgc29ja2V0IG9wdGlvbi4gSWZcbiAgICogdGhlYG11bHRpY2FzdEludGVyZmFjZWAgYXJndW1lbnQgaXMgbm90IHNwZWNpZmllZCwgdGhlIG9wZXJhdGluZyBzeXN0ZW1cbiAgICogd2lsbCBjaG9vc2Ugb25lIGludGVyZmFjZSBhbmQgd2lsbCBhZGQgbWVtYmVyc2hpcCB0byBpdC4gVG8gYWRkIG1lbWJlcnNoaXBcbiAgICogdG8gZXZlcnkgYXZhaWxhYmxlIGludGVyZmFjZSwgY2FsbCBgYWRkTWVtYmVyc2hpcGAgbXVsdGlwbGUgdGltZXMsIG9uY2VcbiAgICogcGVyIGludGVyZmFjZS5cbiAgICpcbiAgICogV2hlbiBjYWxsZWQgb24gYW4gdW5ib3VuZCBzb2NrZXQsIHRoaXMgbWV0aG9kIHdpbGwgaW1wbGljaXRseSBiaW5kIHRvIGFcbiAgICogcmFuZG9tIHBvcnQsIGxpc3RlbmluZyBvbiBhbGwgaW50ZXJmYWNlcy5cbiAgICpcbiAgICogV2hlbiBzaGFyaW5nIGEgVURQIHNvY2tldCBhY3Jvc3MgbXVsdGlwbGUgYGNsdXN0ZXJgIHdvcmtlcnMsIHRoZVxuICAgKiBgc29ja2V0LmFkZE1lbWJlcnNoaXAoKWAgZnVuY3Rpb24gbXVzdCBiZSBjYWxsZWQgb25seSBvbmNlIG9yIGFuXG4gICAqIGBFQUREUklOVVNFYCBlcnJvciB3aWxsIG9jY3VyOlxuICAgKlxuICAgKiBgYGBqc1xuICAgKiBpbXBvcnQgY2x1c3RlciBmcm9tICdjbHVzdGVyJztcbiAgICogaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbiAgICpcbiAgICogaWYgKGNsdXN0ZXIuaXNQcmltYXJ5KSB7XG4gICAqICAgY2x1c3Rlci5mb3JrKCk7IC8vIFdvcmtzIG9rLlxuICAgKiAgIGNsdXN0ZXIuZm9yaygpOyAvLyBGYWlscyB3aXRoIEVBRERSSU5VU0UuXG4gICAqIH0gZWxzZSB7XG4gICAqICAgY29uc3QgcyA9IGRncmFtLmNyZWF0ZVNvY2tldCgndWRwNCcpO1xuICAgKiAgIHMuYmluZCgxMjM0LCAoKSA9PiB7XG4gICAqICAgICBzLmFkZE1lbWJlcnNoaXAoJzIyNC4wLjAuMTE0Jyk7XG4gICAqICAgfSk7XG4gICAqIH1cbiAgICogYGBgXG4gICAqL1xuICBhZGRNZW1iZXJzaGlwKG11bHRpY2FzdEFkZHJlc3M6IHN0cmluZywgaW50ZXJmYWNlQWRkcmVzcz86IHN0cmluZykge1xuICAgIGhlYWx0aENoZWNrKHRoaXMpO1xuXG4gICAgaWYgKCFtdWx0aWNhc3RBZGRyZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcIm11bHRpY2FzdEFkZHJlc3NcIik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBoYW5kbGUgfSA9IHRoaXNba1N0YXRlU3ltYm9sXTtcbiAgICBjb25zdCBlcnIgPSBoYW5kbGUhLmFkZE1lbWJlcnNoaXAobXVsdGljYXN0QWRkcmVzcywgaW50ZXJmYWNlQWRkcmVzcyk7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnJub0V4Y2VwdGlvbihlcnIsIFwiYWRkTWVtYmVyc2hpcFwiKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVsbHMgdGhlIGtlcm5lbCB0byBqb2luIGEgc291cmNlLXNwZWNpZmljIG11bHRpY2FzdCBjaGFubmVsIGF0IHRoZSBnaXZlblxuICAgKiBgc291cmNlQWRkcmVzc2AgYW5kIGBncm91cEFkZHJlc3NgLCB1c2luZyB0aGUgYG11bHRpY2FzdEludGVyZmFjZWAgd2l0aFxuICAgKiB0aGUgYElQX0FERF9TT1VSQ0VfTUVNQkVSU0hJUGAgc29ja2V0IG9wdGlvbi4gSWYgdGhlIGBtdWx0aWNhc3RJbnRlcmZhY2VgXG4gICAqIGFyZ3VtZW50IGlzIG5vdCBzcGVjaWZpZWQsIHRoZSBvcGVyYXRpbmcgc3lzdGVtIHdpbGwgY2hvb3NlIG9uZSBpbnRlcmZhY2VcbiAgICogYW5kIHdpbGwgYWRkIG1lbWJlcnNoaXAgdG8gaXQuIFRvIGFkZCBtZW1iZXJzaGlwIHRvIGV2ZXJ5IGF2YWlsYWJsZVxuICAgKiBpbnRlcmZhY2UsIGNhbGwgYHNvY2tldC5hZGRTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXAoKWAgbXVsdGlwbGUgdGltZXMsXG4gICAqIG9uY2UgcGVyIGludGVyZmFjZS5cbiAgICpcbiAgICogV2hlbiBjYWxsZWQgb24gYW4gdW5ib3VuZCBzb2NrZXQsIHRoaXMgbWV0aG9kIHdpbGwgaW1wbGljaXRseSBiaW5kIHRvIGFcbiAgICogcmFuZG9tIHBvcnQsIGxpc3RlbmluZyBvbiBhbGwgaW50ZXJmYWNlcy5cbiAgICovXG4gIGFkZFNvdXJjZVNwZWNpZmljTWVtYmVyc2hpcChcbiAgICBzb3VyY2VBZGRyZXNzOiBzdHJpbmcsXG4gICAgZ3JvdXBBZGRyZXNzOiBzdHJpbmcsXG4gICAgaW50ZXJmYWNlQWRkcmVzcz86IHN0cmluZyxcbiAgKSB7XG4gICAgaGVhbHRoQ2hlY2sodGhpcyk7XG5cbiAgICB2YWxpZGF0ZVN0cmluZyhzb3VyY2VBZGRyZXNzLCBcInNvdXJjZUFkZHJlc3NcIik7XG4gICAgdmFsaWRhdGVTdHJpbmcoZ3JvdXBBZGRyZXNzLCBcImdyb3VwQWRkcmVzc1wiKTtcblxuICAgIGNvbnN0IGVyciA9IHRoaXNba1N0YXRlU3ltYm9sXS5oYW5kbGUhLmFkZFNvdXJjZVNwZWNpZmljTWVtYmVyc2hpcChcbiAgICAgIHNvdXJjZUFkZHJlc3MsXG4gICAgICBncm91cEFkZHJlc3MsXG4gICAgICBpbnRlcmZhY2VBZGRyZXNzLFxuICAgICk7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnJub0V4Y2VwdGlvbihlcnIsIFwiYWRkU291cmNlU3BlY2lmaWNNZW1iZXJzaGlwXCIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBhZGRyZXNzIGluZm9ybWF0aW9uIGZvciBhIHNvY2tldC5cbiAgICogRm9yIFVEUCBzb2NrZXRzLCB0aGlzIG9iamVjdCB3aWxsIGNvbnRhaW4gYGFkZHJlc3NgLCBgZmFtaWx5YCBhbmQgYHBvcnRgcHJvcGVydGllcy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFQkFERmAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmQgc29ja2V0LlxuICAgKi9cbiAgYWRkcmVzcygpOiBBZGRyZXNzSW5mbyB7XG4gICAgaGVhbHRoQ2hlY2sodGhpcyk7XG5cbiAgICBjb25zdCBvdXQgPSB7fTtcbiAgICBjb25zdCBlcnIgPSB0aGlzW2tTdGF0ZVN5bWJvbF0uaGFuZGxlIS5nZXRzb2NrbmFtZShvdXQpO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcImdldHNvY2tuYW1lXCIpO1xuICAgIH1cblxuICAgIHJldHVybiBvdXQgYXMgQWRkcmVzc0luZm87XG4gIH1cblxuICAvKipcbiAgICogRm9yIFVEUCBzb2NrZXRzLCBjYXVzZXMgdGhlIGBkZ3JhbS5Tb2NrZXRgIHRvIGxpc3RlbiBmb3IgZGF0YWdyYW1cbiAgICogbWVzc2FnZXMgb24gYSBuYW1lZCBgcG9ydGAgYW5kIG9wdGlvbmFsIGBhZGRyZXNzYC4gSWYgYHBvcnRgIGlzIG5vdFxuICAgKiBzcGVjaWZpZWQgb3IgaXMgYDBgLCB0aGUgb3BlcmF0aW5nIHN5c3RlbSB3aWxsIGF0dGVtcHQgdG8gYmluZCB0byBhXG4gICAqIHJhbmRvbSBwb3J0LiBJZiBgYWRkcmVzc2AgaXMgbm90IHNwZWNpZmllZCwgdGhlIG9wZXJhdGluZyBzeXN0ZW0gd2lsbFxuICAgKiBhdHRlbXB0IHRvIGxpc3RlbiBvbiBhbGwgYWRkcmVzc2VzLiBPbmNlIGJpbmRpbmcgaXMgY29tcGxldGUsIGFcbiAgICogYCdsaXN0ZW5pbmcnYCBldmVudCBpcyBlbWl0dGVkIGFuZCB0aGUgb3B0aW9uYWwgYGNhbGxiYWNrYCBmdW5jdGlvbiBpc1xuICAgKiBjYWxsZWQuXG4gICAqXG4gICAqIFNwZWNpZnlpbmcgYm90aCBhIGAnbGlzdGVuaW5nJ2AgZXZlbnQgbGlzdGVuZXIgYW5kIHBhc3NpbmcgYSBgY2FsbGJhY2tgIHRvXG4gICAqIHRoZSBgc29ja2V0LmJpbmQoKWAgbWV0aG9kIGlzIG5vdCBoYXJtZnVsIGJ1dCBub3QgdmVyeSB1c2VmdWwuXG4gICAqXG4gICAqIEEgYm91bmQgZGF0YWdyYW0gc29ja2V0IGtlZXBzIHRoZSBOb2RlLmpzIHByb2Nlc3MgcnVubmluZyB0byByZWNlaXZlXG4gICAqIGRhdGFncmFtIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBJZiBiaW5kaW5nIGZhaWxzLCBhbiBgJ2Vycm9yJ2AgZXZlbnQgaXMgZ2VuZXJhdGVkLiBJbiByYXJlIGNhc2UgKGUuZy5cbiAgICogYXR0ZW1wdGluZyB0byBiaW5kIHdpdGggYSBjbG9zZWQgc29ja2V0KSwgYW4gYEVycm9yYCBtYXkgYmUgdGhyb3duLlxuICAgKlxuICAgKiBFeGFtcGxlIG9mIGEgVURQIHNlcnZlciBsaXN0ZW5pbmcgb24gcG9ydCA0MTIzNDpcbiAgICpcbiAgICogYGBganNcbiAgICogaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbiAgICpcbiAgICogY29uc3Qgc2VydmVyID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0Jyk7XG4gICAqXG4gICAqIHNlcnZlci5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAqICAgY29uc29sZS5sb2coYHNlcnZlciBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICogICBzZXJ2ZXIuY2xvc2UoKTtcbiAgICogfSk7XG4gICAqXG4gICAqIHNlcnZlci5vbignbWVzc2FnZScsIChtc2csIHJpbmZvKSA9PiB7XG4gICAqICAgY29uc29sZS5sb2coYHNlcnZlciBnb3Q6ICR7bXNnfSBmcm9tICR7cmluZm8uYWRkcmVzc306JHtyaW5mby5wb3J0fWApO1xuICAgKiB9KTtcbiAgICpcbiAgICogc2VydmVyLm9uKCdsaXN0ZW5pbmcnLCAoKSA9PiB7XG4gICAqICAgY29uc3QgYWRkcmVzcyA9IHNlcnZlci5hZGRyZXNzKCk7XG4gICAqICAgY29uc29sZS5sb2coYHNlcnZlciBsaXN0ZW5pbmcgJHthZGRyZXNzLmFkZHJlc3N9OiR7YWRkcmVzcy5wb3J0fWApO1xuICAgKiB9KTtcbiAgICpcbiAgICogc2VydmVyLmJpbmQoNDEyMzQpO1xuICAgKiAvLyBQcmludHM6IHNlcnZlciBsaXN0ZW5pbmcgMC4wLjAuMDo0MTIzNFxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNhbGxiYWNrIHdpdGggbm8gcGFyYW1ldGVycy4gQ2FsbGVkIHdoZW4gYmluZGluZyBpcyBjb21wbGV0ZS5cbiAgICovXG4gIGJpbmQocG9ydD86IG51bWJlciwgYWRkcmVzcz86IHN0cmluZywgY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdGhpcztcbiAgYmluZChwb3J0OiBudW1iZXIsIGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGJpbmQoY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBiaW5kKG9wdGlvbnM6IEJpbmRPcHRpb25zLCBjYWxsYmFjaz86ICgpID0+IHZvaWQpOiB0aGlzO1xuICBiaW5kKHBvcnRfPzogdW5rbm93biwgYWRkcmVzc18/OiB1bmtub3duIC8qIGNhbGxiYWNrICovKTogdGhpcyB7XG4gICAgbGV0IHBvcnQgPSB0eXBlb2YgcG9ydF8gPT09IFwiZnVuY3Rpb25cIiA/IG51bGwgOiBwb3J0XztcblxuICAgIGhlYWx0aENoZWNrKHRoaXMpO1xuXG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzW2tTdGF0ZVN5bWJvbF07XG5cbiAgICBpZiAoc3RhdGUuYmluZFN0YXRlICE9PSBCSU5EX1NUQVRFX1VOQk9VTkQpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfU09DS0VUX0FMUkVBRFlfQk9VTkQoKTtcbiAgICB9XG5cbiAgICBzdGF0ZS5iaW5kU3RhdGUgPSBCSU5EX1NUQVRFX0JJTkRJTkc7XG5cbiAgICBjb25zdCBjYiA9IGFyZ3VtZW50cy5sZW5ndGggJiYgYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcblxuICAgIGlmICh0eXBlb2YgY2IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1pbm5lci1kZWNsYXJhdGlvbnNcbiAgICAgIGZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVycyh0aGlzOiBTb2NrZXQpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcihcImVycm9yXCIsIHJlbW92ZUxpc3RlbmVycyk7XG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoXCJsaXN0ZW5pbmdcIiwgb25MaXN0ZW5pbmcpO1xuICAgICAgfVxuXG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWlubmVyLWRlY2xhcmF0aW9uc1xuICAgICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcodGhpczogU29ja2V0KSB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycy5jYWxsKHRoaXMpO1xuICAgICAgICBjYi5jYWxsKHRoaXMpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm9uKFwiZXJyb3JcIiwgcmVtb3ZlTGlzdGVuZXJzKTtcbiAgICAgIHRoaXMub24oXCJsaXN0ZW5pbmdcIiwgb25MaXN0ZW5pbmcpO1xuICAgIH1cblxuICAgIGlmIChpc1VkcEhhbmRsZShwb3J0KSkge1xuICAgICAgcmVwbGFjZUhhbmRsZSh0aGlzLCBwb3J0KTtcbiAgICAgIHN0YXJ0TGlzdGVuaW5nKHRoaXMpO1xuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyBPcGVuIGFuIGV4aXN0aW5nIGZkIGluc3RlYWQgb2YgY3JlYXRpbmcgYSBuZXcgb25lLlxuICAgIGlmIChpc0JpbmRPcHRpb25zKHBvcnQpICYmIGlzSW50MzIocG9ydC5mZCEpICYmIHBvcnQuZmQhID4gMCkge1xuICAgICAgY29uc3QgZmQgPSBwb3J0LmZkITtcbiAgICAgIGNvbnN0IHN0YXRlID0gdGhpc1trU3RhdGVTeW1ib2xdO1xuXG4gICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBoZXJlIHdlIGRldmlhdGUgc29tZXdoYXQgZnJvbSB0aGUgTm9kZSBpbXBsZW1lbnRhdGlvbiB3aGljaFxuICAgICAgLy8gbWFrZXMgdXNlIG9mIHRoZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2NsdXN0ZXIuaHRtbCBtb2R1bGUgdG8gcnVuIHNlcnZlcnNcbiAgICAgIC8vIGFjcm9zcyBhIFwiY2x1c3RlclwiIG9mIE5vZGUgcHJvY2Vzc2VzIHRvIHRha2UgYWR2YW50YWdlIG9mIG11bHRpLWNvcmVcbiAgICAgIC8vIHN5c3RlbXMuXG4gICAgICAvL1xuICAgICAgLy8gVGhvdWdoIERlbm8gaGFzIGhhcyBhIFdvcmtlciBjYXBhYmlsaXR5IGZyb20gd2hpY2ggd2UgY291bGQgc2ltdWxhdGUgdGhpcyxcbiAgICAgIC8vIGZvciBub3cgd2UgYXNzZXJ0IHRoYXQgd2UgYXJlIF9hbHdheXNfIG9uIHRoZSBwcmltYXJ5IHByb2Nlc3MuXG5cbiAgICAgIGNvbnN0IHR5cGUgPSBndWVzc0hhbmRsZVR5cGUoZmQpO1xuXG4gICAgICBpZiAodHlwZSAhPT0gXCJVRFBcIikge1xuICAgICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfRkRfVFlQRSh0eXBlKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXJyID0gc3RhdGUuaGFuZGxlIS5vcGVuKGZkKTtcblxuICAgICAgaWYgKGVycikge1xuICAgICAgICB0aHJvdyBlcnJub0V4Y2VwdGlvbihlcnIsIFwib3BlblwiKTtcbiAgICAgIH1cblxuICAgICAgc3RhcnRMaXN0ZW5pbmcodGhpcyk7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGxldCBhZGRyZXNzOiBzdHJpbmc7XG5cbiAgICBpZiAoaXNCaW5kT3B0aW9ucyhwb3J0KSkge1xuICAgICAgYWRkcmVzcyA9IHBvcnQuYWRkcmVzcyB8fCBcIlwiO1xuICAgICAgcG9ydCA9IHBvcnQucG9ydDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWRkcmVzcyA9IHR5cGVvZiBhZGRyZXNzXyA9PT0gXCJmdW5jdGlvblwiID8gXCJcIiA6IChhZGRyZXNzXyBhcyBzdHJpbmcpO1xuICAgIH1cblxuICAgIC8vIERlZmF1bHRpbmcgYWRkcmVzcyBmb3IgYmluZCB0byBhbGwgaW50ZXJmYWNlc1xuICAgIGlmICghYWRkcmVzcykge1xuICAgICAgaWYgKHRoaXMudHlwZSA9PT0gXCJ1ZHA0XCIpIHtcbiAgICAgICAgYWRkcmVzcyA9IFwiMC4wLjAuMFwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRkcmVzcyA9IFwiOjpcIjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFkZHJlc3MgZmlyc3RcbiAgICBzdGF0ZS5oYW5kbGUhLmxvb2t1cChhZGRyZXNzLCAobG9va3VwRXJyb3IsIGlwKSA9PiB7XG4gICAgICBpZiAobG9va3VwRXJyb3IpIHtcbiAgICAgICAgc3RhdGUuYmluZFN0YXRlID0gQklORF9TVEFURV9VTkJPVU5EO1xuICAgICAgICB0aGlzLmVtaXQoXCJlcnJvclwiLCBsb29rdXBFcnJvcik7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgZmxhZ3M6IG51bWJlciB8IHVuZGVmaW5lZCA9IDA7XG5cbiAgICAgIGlmIChzdGF0ZS5yZXVzZUFkZHIpIHtcbiAgICAgICAgZmxhZ3MgfD0gVVZfVURQX1JFVVNFQUREUjtcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZS5pcHY2T25seSkge1xuICAgICAgICBmbGFncyB8PSBVVl9VRFBfSVBWNk9OTFkhO1xuICAgICAgfVxuXG4gICAgICAvLyBUT0RPKGNtb3J0ZW4pOiBoZXJlIHdlIGRldmlhdGUgc29tZXdoYXQgZnJvbSB0aGUgTm9kZSBpbXBsZW1lbnRhdGlvbiB3aGljaFxuICAgICAgLy8gbWFrZXMgdXNlIG9mIHRoZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2NsdXN0ZXIuaHRtbCBtb2R1bGUgdG8gcnVuIHNlcnZlcnNcbiAgICAgIC8vIGFjcm9zcyBhIFwiY2x1c3RlclwiIG9mIE5vZGUgcHJvY2Vzc2VzIHRvIHRha2UgYWR2YW50YWdlIG9mIG11bHRpLWNvcmVcbiAgICAgIC8vIHN5c3RlbXMuXG4gICAgICAvL1xuICAgICAgLy8gVGhvdWdoIERlbm8gaGFzIGhhcyBhIFdvcmtlciBjYXBhYmlsaXR5IGZyb20gd2hpY2ggd2UgY291bGQgc2ltdWxhdGUgdGhpcyxcbiAgICAgIC8vIGZvciBub3cgd2UgYXNzZXJ0IHRoYXQgd2UgYXJlIF9hbHdheXNfIG9uIHRoZSBwcmltYXJ5IHByb2Nlc3MuXG5cbiAgICAgIGlmICghc3RhdGUuaGFuZGxlKSB7XG4gICAgICAgIHJldHVybjsgLy8gSGFuZGxlIGhhcyBiZWVuIGNsb3NlZCBpbiB0aGUgbWVhbiB0aW1lXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVyciA9IHN0YXRlLmhhbmRsZS5iaW5kKGlwLCBwb3J0IGFzIG51bWJlciB8fCAwLCBmbGFncyk7XG5cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc3QgZXggPSBleGNlcHRpb25XaXRoSG9zdFBvcnQoZXJyLCBcImJpbmRcIiwgaXAsIHBvcnQgYXMgbnVtYmVyKTtcbiAgICAgICAgc3RhdGUuYmluZFN0YXRlID0gQklORF9TVEFURV9VTkJPVU5EO1xuICAgICAgICB0aGlzLmVtaXQoXCJlcnJvclwiLCBleCk7XG5cbiAgICAgICAgLy8gVG9kbzogY2xvc2U/XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgc3RhcnRMaXN0ZW5pbmcodGhpcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZSB0aGUgdW5kZXJseWluZyBzb2NrZXQgYW5kIHN0b3AgbGlzdGVuaW5nIGZvciBkYXRhIG9uIGl0LiBJZiBhXG4gICAqIGNhbGxiYWNrIGlzIHByb3ZpZGVkLCBpdCBpcyBhZGRlZCBhcyBhIGxpc3RlbmVyIGZvciB0aGUgYCdjbG9zZSdgIGV2ZW50LlxuICAgKlxuICAgKiBAcGFyYW0gY2FsbGJhY2sgQ2FsbGVkIHdoZW4gdGhlIHNvY2tldCBoYXMgYmVlbiBjbG9zZWQuXG4gICAqL1xuICBjbG9zZShjYWxsYmFjaz86ICgpID0+IHZvaWQpOiB0aGlzIHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXNba1N0YXRlU3ltYm9sXTtcbiAgICBjb25zdCBxdWV1ZSA9IHN0YXRlLnF1ZXVlO1xuXG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aGlzLm9uKFwiY2xvc2VcIiwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGlmIChxdWV1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBxdWV1ZS5wdXNoKHRoaXMuY2xvc2UuYmluZCh0aGlzKSk7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGhlYWx0aENoZWNrKHRoaXMpO1xuICAgIHN0b3BSZWNlaXZpbmcodGhpcyk7XG5cbiAgICBzdGF0ZS5oYW5kbGUhLmNsb3NlKCk7XG4gICAgc3RhdGUuaGFuZGxlID0gbnVsbDtcblxuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICAgICAgdGhpc1thc3luY0lkU3ltYm9sXSxcbiAgICAgIG5leHRUaWNrLFxuICAgICAgc29ja2V0Q2xvc2VOVCxcbiAgICAgIHRoaXMsXG4gICAgKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc29jaWF0ZXMgdGhlIGBkZ3JhbS5Tb2NrZXRgIHRvIGEgcmVtb3RlIGFkZHJlc3MgYW5kIHBvcnQuIEV2ZXJ5XG4gICAqIG1lc3NhZ2Ugc2VudCBieSB0aGlzIGhhbmRsZSBpcyBhdXRvbWF0aWNhbGx5IHNlbnQgdG8gdGhhdCBkZXN0aW5hdGlvbi5cbiAgICogQWxzbywgdGhlIHNvY2tldCB3aWxsIG9ubHkgcmVjZWl2ZSBtZXNzYWdlcyBmcm9tIHRoYXQgcmVtb3RlIHBlZXIuXG4gICAqIFRyeWluZyB0byBjYWxsIGBjb25uZWN0KClgIG9uIGFuIGFscmVhZHkgY29ubmVjdGVkIHNvY2tldCB3aWxsIHJlc3VsdFxuICAgKiBpbiBhbiBgRVJSX1NPQ0tFVF9ER1JBTV9JU19DT05ORUNURURgIGV4Y2VwdGlvbi4gSWYgYGFkZHJlc3NgIGlzIG5vdFxuICAgKiBwcm92aWRlZCwgYCcxMjcuMC4wLjEnYCAoZm9yIGB1ZHA0YCBzb2NrZXRzKSBvciBgJzo6MSdgIChmb3IgYHVkcDZgIHNvY2tldHMpXG4gICAqIHdpbGwgYmUgdXNlZCBieSBkZWZhdWx0LiBPbmNlIHRoZSBjb25uZWN0aW9uIGlzIGNvbXBsZXRlLCBhIGAnY29ubmVjdCdgIGV2ZW50XG4gICAqIGlzIGVtaXR0ZWQgYW5kIHRoZSBvcHRpb25hbCBgY2FsbGJhY2tgIGZ1bmN0aW9uIGlzIGNhbGxlZC4gSW4gY2FzZSBvZiBmYWlsdXJlLFxuICAgKiB0aGUgYGNhbGxiYWNrYCBpcyBjYWxsZWQgb3IsIGZhaWxpbmcgdGhpcywgYW4gYCdlcnJvcidgIGV2ZW50IGlzIGVtaXR0ZWQuXG4gICAqXG4gICAqIEBwYXJhbSBjYWxsYmFjayBDYWxsZWQgd2hlbiB0aGUgY29ubmVjdGlvbiBpcyBjb21wbGV0ZWQgb3Igb24gZXJyb3IuXG4gICAqL1xuICBjb25uZWN0KFxuICAgIHBvcnQ6IG51bWJlcixcbiAgICBhZGRyZXNzPzogc3RyaW5nLFxuICAgIGNhbGxiYWNrPzogKGVycj86IEVycm5vRXhjZXB0aW9uKSA9PiB2b2lkLFxuICApOiB2b2lkO1xuICBjb25uZWN0KHBvcnQ6IG51bWJlciwgY2FsbGJhY2s6IChlcnI/OiBFcnJub0V4Y2VwdGlvbikgPT4gdm9pZCk6IHZvaWQ7XG4gIGNvbm5lY3QocG9ydDogbnVtYmVyLCBhZGRyZXNzPzogdW5rbm93biwgY2FsbGJhY2s/OiB1bmtub3duKSB7XG4gICAgcG9ydCA9IHZhbGlkYXRlUG9ydChwb3J0LCBcIlBvcnRcIiwgZmFsc2UpO1xuXG4gICAgaWYgKHR5cGVvZiBhZGRyZXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNhbGxiYWNrID0gYWRkcmVzcztcbiAgICAgIGFkZHJlc3MgPSBcIlwiO1xuICAgIH0gZWxzZSBpZiAoYWRkcmVzcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBhZGRyZXNzID0gXCJcIjtcbiAgICB9XG5cbiAgICB2YWxpZGF0ZVN0cmluZyhhZGRyZXNzLCBcImFkZHJlc3NcIik7XG5cbiAgICBjb25zdCBzdGF0ZSA9IHRoaXNba1N0YXRlU3ltYm9sXTtcblxuICAgIGlmIChzdGF0ZS5jb25uZWN0U3RhdGUgIT09IENPTk5FQ1RfU1RBVEVfRElTQ09OTkVDVEVEKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX1NPQ0tFVF9ER1JBTV9JU19DT05ORUNURUQoKTtcbiAgICB9XG5cbiAgICBzdGF0ZS5jb25uZWN0U3RhdGUgPSBDT05ORUNUX1NUQVRFX0NPTk5FQ1RJTkc7XG5cbiAgICBpZiAoc3RhdGUuYmluZFN0YXRlID09PSBCSU5EX1NUQVRFX1VOQk9VTkQpIHtcbiAgICAgIHRoaXMuYmluZCh7IHBvcnQ6IDAsIGV4Y2x1c2l2ZTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUuYmluZFN0YXRlICE9PSBCSU5EX1NUQVRFX0JPVU5EKSB7XG4gICAgICBlbnF1ZXVlKFxuICAgICAgICB0aGlzLFxuICAgICAgICBfY29ubmVjdC5iaW5kKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgcG9ydCxcbiAgICAgICAgICBhZGRyZXNzIGFzIHN0cmluZyxcbiAgICAgICAgICBjYWxsYmFjayBhcyAoZXJyPzogRXJybm9FeGNlcHRpb24pID0+IHZvaWQsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgUmVmbGVjdC5hcHBseShfY29ubmVjdCwgdGhpcywgW3BvcnQsIGFkZHJlc3MsIGNhbGxiYWNrXSk7XG4gIH1cblxuICAvKipcbiAgICogQSBzeW5jaHJvbm91cyBmdW5jdGlvbiB0aGF0IGRpc2Fzc29jaWF0ZXMgYSBjb25uZWN0ZWQgYGRncmFtLlNvY2tldGAgZnJvbVxuICAgKiBpdHMgcmVtb3RlIGFkZHJlc3MuIFRyeWluZyB0byBjYWxsIGBkaXNjb25uZWN0KClgIG9uIGFuIHVuYm91bmQgb3IgYWxyZWFkeVxuICAgKiBkaXNjb25uZWN0ZWQgc29ja2V0IHdpbGwgcmVzdWx0IGluIGFuIGBFUlJfU09DS0VUX0RHUkFNX05PVF9DT05ORUNURURgXG4gICAqIGV4Y2VwdGlvbi5cbiAgICovXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzW2tTdGF0ZVN5bWJvbF07XG5cbiAgICBpZiAoc3RhdGUuY29ubmVjdFN0YXRlICE9PSBDT05ORUNUX1NUQVRFX0NPTk5FQ1RFRCkge1xuICAgICAgdGhyb3cgbmV3IEVSUl9TT0NLRVRfREdSQU1fTk9UX0NPTk5FQ1RFRCgpO1xuICAgIH1cblxuICAgIGNvbnN0IGVyciA9IHN0YXRlLmhhbmRsZSEuZGlzY29ubmVjdCgpO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcImNvbm5lY3RcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmNvbm5lY3RTdGF0ZSA9IENPTk5FQ1RfU1RBVEVfRElTQ09OTkVDVEVEO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN0cnVjdHMgdGhlIGtlcm5lbCB0byBsZWF2ZSBhIG11bHRpY2FzdCBncm91cCBhdCBgbXVsdGljYXN0QWRkcmVzc2BcbiAgICogdXNpbmcgdGhlIGBJUF9EUk9QX01FTUJFUlNISVBgIHNvY2tldCBvcHRpb24uIFRoaXMgbWV0aG9kIGlzIGF1dG9tYXRpY2FsbHlcbiAgICogY2FsbGVkIGJ5IHRoZSBrZXJuZWwgd2hlbiB0aGUgc29ja2V0IGlzIGNsb3NlZCBvciB0aGUgcHJvY2VzcyB0ZXJtaW5hdGVzLFxuICAgKiBzbyBtb3N0IGFwcHMgd2lsbCBuZXZlciBoYXZlIHJlYXNvbiB0byBjYWxsIHRoaXMuXG4gICAqXG4gICAqIElmIGBtdWx0aWNhc3RJbnRlcmZhY2VgIGlzIG5vdCBzcGVjaWZpZWQsIHRoZSBvcGVyYXRpbmcgc3lzdGVtIHdpbGxcbiAgICogYXR0ZW1wdCB0byBkcm9wIG1lbWJlcnNoaXAgb24gYWxsIHZhbGlkIGludGVyZmFjZXMuXG4gICAqL1xuICBkcm9wTWVtYmVyc2hpcChtdWx0aWNhc3RBZGRyZXNzOiBzdHJpbmcsIGludGVyZmFjZUFkZHJlc3M/OiBzdHJpbmcpIHtcbiAgICBoZWFsdGhDaGVjayh0aGlzKTtcblxuICAgIGlmICghbXVsdGljYXN0QWRkcmVzcykge1xuICAgICAgdGhyb3cgbmV3IEVSUl9NSVNTSU5HX0FSR1MoXCJtdWx0aWNhc3RBZGRyZXNzXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGVyciA9IHRoaXNba1N0YXRlU3ltYm9sXS5oYW5kbGUhLmRyb3BNZW1iZXJzaGlwKFxuICAgICAgbXVsdGljYXN0QWRkcmVzcyxcbiAgICAgIGludGVyZmFjZUFkZHJlc3MsXG4gICAgKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIHRocm93IGVycm5vRXhjZXB0aW9uKGVyciwgXCJkcm9wTWVtYmVyc2hpcFwiKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zdHJ1Y3RzIHRoZSBrZXJuZWwgdG8gbGVhdmUgYSBzb3VyY2Utc3BlY2lmaWMgbXVsdGljYXN0IGNoYW5uZWwgYXQgdGhlXG4gICAqIGdpdmVuIGBzb3VyY2VBZGRyZXNzYCBhbmQgYGdyb3VwQWRkcmVzc2AgdXNpbmcgdGhlXG4gICAqIGBJUF9EUk9QX1NPVVJDRV9NRU1CRVJTSElQYCBzb2NrZXQgb3B0aW9uLiBUaGlzIG1ldGhvZCBpcyBhdXRvbWF0aWNhbGx5XG4gICAqIGNhbGxlZCBieSB0aGUga2VybmVsIHdoZW4gdGhlIHNvY2tldCBpcyBjbG9zZWQgb3IgdGhlIHByb2Nlc3MgdGVybWluYXRlcyxcbiAgICogc28gbW9zdCBhcHBzIHdpbGwgbmV2ZXIgaGF2ZSByZWFzb24gdG8gY2FsbCB0aGlzLlxuICAgKlxuICAgKiBJZiBgbXVsdGljYXN0SW50ZXJmYWNlYCBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgb3BlcmF0aW5nIHN5c3RlbSB3aWxsXG4gICAqIGF0dGVtcHQgdG8gZHJvcCBtZW1iZXJzaGlwIG9uIGFsbCB2YWxpZCBpbnRlcmZhY2VzLlxuICAgKi9cbiAgZHJvcFNvdXJjZVNwZWNpZmljTWVtYmVyc2hpcChcbiAgICBzb3VyY2VBZGRyZXNzOiBzdHJpbmcsXG4gICAgZ3JvdXBBZGRyZXNzOiBzdHJpbmcsXG4gICAgaW50ZXJmYWNlQWRkcmVzcz86IHN0cmluZyxcbiAgKSB7XG4gICAgaGVhbHRoQ2hlY2sodGhpcyk7XG5cbiAgICB2YWxpZGF0ZVN0cmluZyhzb3VyY2VBZGRyZXNzLCBcInNvdXJjZUFkZHJlc3NcIik7XG4gICAgdmFsaWRhdGVTdHJpbmcoZ3JvdXBBZGRyZXNzLCBcImdyb3VwQWRkcmVzc1wiKTtcblxuICAgIGNvbnN0IGVyciA9IHRoaXNba1N0YXRlU3ltYm9sXS5oYW5kbGUhLmRyb3BTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXAoXG4gICAgICBzb3VyY2VBZGRyZXNzLFxuICAgICAgZ3JvdXBBZGRyZXNzLFxuICAgICAgaW50ZXJmYWNlQWRkcmVzcyxcbiAgICApO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcImRyb3BTb3VyY2VTcGVjaWZpY01lbWJlcnNoaXBcIik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHRocm93cyBgRVJSX1NPQ0tFVF9CVUZGRVJfU0laRWAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmRcbiAgICogc29ja2V0LlxuICAgKlxuICAgKiBAcmV0dXJuIHRoZSBgU09fUkNWQlVGYCBzb2NrZXQgcmVjZWl2ZSBidWZmZXIgc2l6ZSBpbiBieXRlcy5cbiAgICovXG4gIGdldFJlY3ZCdWZmZXJTaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIGJ1ZmZlclNpemUodGhpcywgMCwgUkVDVl9CVUZGRVIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHRocm93cyBgRVJSX1NPQ0tFVF9CVUZGRVJfU0laRWAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmRcbiAgICogc29ja2V0LlxuICAgKlxuICAgKiBAcmV0dXJuIHRoZSBgU09fU05EQlVGYCBzb2NrZXQgc2VuZCBidWZmZXIgc2l6ZSBpbiBieXRlcy5cbiAgICovXG4gIGdldFNlbmRCdWZmZXJTaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIGJ1ZmZlclNpemUodGhpcywgMCwgU0VORF9CVUZGRVIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ5IGRlZmF1bHQsIGJpbmRpbmcgYSBzb2NrZXQgd2lsbCBjYXVzZSBpdCB0byBibG9jayB0aGUgTm9kZS5qcyBwcm9jZXNzXG4gICAqIGZyb20gZXhpdGluZyBhcyBsb25nIGFzIHRoZSBzb2NrZXQgaXMgb3Blbi4gVGhlIGBzb2NrZXQudW5yZWYoKWAgbWV0aG9kXG4gICAqIGNhbiBiZSB1c2VkIHRvIGV4Y2x1ZGUgdGhlIHNvY2tldCBmcm9tIHRoZSByZWZlcmVuY2UgY291bnRpbmcgdGhhdCBrZWVwc1xuICAgKiB0aGUgTm9kZS5qcyBwcm9jZXNzIGFjdGl2ZS4gVGhlIGBzb2NrZXQucmVmKClgIG1ldGhvZCBhZGRzIHRoZSBzb2NrZXQgYmFja1xuICAgKiB0byB0aGUgcmVmZXJlbmNlIGNvdW50aW5nIGFuZCByZXN0b3JlcyB0aGUgZGVmYXVsdCBiZWhhdmlvci5cbiAgICpcbiAgICogQ2FsbGluZyBgc29ja2V0LnJlZigpYCBtdWx0aXBsZXMgdGltZXMgd2lsbCBoYXZlIG5vIGFkZGl0aW9uYWwgZWZmZWN0LlxuICAgKlxuICAgKiBUaGUgYHNvY2tldC5yZWYoKWAgbWV0aG9kIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIHNvY2tldCBzbyBjYWxscyBjYW5cbiAgICogYmUgY2hhaW5lZC5cbiAgICovXG4gIHJlZigpOiB0aGlzIHtcbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzW2tTdGF0ZVN5bWJvbF0uaGFuZGxlO1xuXG4gICAgaWYgKGhhbmRsZSkge1xuICAgICAgaGFuZGxlLnJlZigpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGBhZGRyZXNzYCwgYGZhbWlseWAsIGFuZCBgcG9ydGAgb2YgdGhlXG4gICAqIHJlbW90ZSBlbmRwb2ludC4gVGhpcyBtZXRob2QgdGhyb3dzIGFuIGBFUlJfU09DS0VUX0RHUkFNX05PVF9DT05ORUNURURgXG4gICAqIGV4Y2VwdGlvbiBpZiB0aGUgc29ja2V0IGlzIG5vdCBjb25uZWN0ZWQuXG4gICAqL1xuICByZW1vdGVBZGRyZXNzKCk6IEFkZHJlc3NJbmZvIHtcbiAgICBoZWFsdGhDaGVjayh0aGlzKTtcblxuICAgIGNvbnN0IHN0YXRlID0gdGhpc1trU3RhdGVTeW1ib2xdO1xuXG4gICAgaWYgKHN0YXRlLmNvbm5lY3RTdGF0ZSAhPT0gQ09OTkVDVF9TVEFURV9DT05ORUNURUQpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfU09DS0VUX0RHUkFNX05PVF9DT05ORUNURUQoKTtcbiAgICB9XG5cbiAgICBjb25zdCBvdXQgPSB7fTtcbiAgICBjb25zdCBlcnIgPSBzdGF0ZS5oYW5kbGUhLmdldHBlZXJuYW1lKG91dCk7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnJub0V4Y2VwdGlvbihlcnIsIFwiZ2V0cGVlcm5hbWVcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dCBhcyBBZGRyZXNzSW5mbztcbiAgfVxuXG4gIC8qKlxuICAgKiBCcm9hZGNhc3RzIGEgZGF0YWdyYW0gb24gdGhlIHNvY2tldC5cbiAgICogRm9yIGNvbm5lY3Rpb25sZXNzIHNvY2tldHMsIHRoZSBkZXN0aW5hdGlvbiBgcG9ydGAgYW5kIGBhZGRyZXNzYCBtdXN0IGJlXG4gICAqIHNwZWNpZmllZC4gQ29ubmVjdGVkIHNvY2tldHMsIG9uIHRoZSBvdGhlciBoYW5kLCB3aWxsIHVzZSB0aGVpciBhc3NvY2lhdGVkXG4gICAqIHJlbW90ZSBlbmRwb2ludCwgc28gdGhlIGBwb3J0YCBhbmQgYGFkZHJlc3NgIGFyZ3VtZW50cyBtdXN0IG5vdCBiZSBzZXQuXG4gICAqXG4gICAqIFRoZSBgbXNnYCBhcmd1bWVudCBjb250YWlucyB0aGUgbWVzc2FnZSB0byBiZSBzZW50LlxuICAgKiBEZXBlbmRpbmcgb24gaXRzIHR5cGUsIGRpZmZlcmVudCBiZWhhdmlvciBjYW4gYXBwbHkuIElmIGBtc2dgIGlzIGFcbiAgICogYEJ1ZmZlcmAsIGFueSBgVHlwZWRBcnJheWAgb3IgYSBgRGF0YVZpZXdgLFxuICAgKiB0aGUgYG9mZnNldGAgYW5kIGBsZW5ndGhgIHNwZWNpZnkgdGhlIG9mZnNldCB3aXRoaW4gdGhlIGBCdWZmZXJgIHdoZXJlIHRoZVxuICAgKiBtZXNzYWdlIGJlZ2lucyBhbmQgdGhlIG51bWJlciBvZiBieXRlcyBpbiB0aGUgbWVzc2FnZSwgcmVzcGVjdGl2ZWx5LlxuICAgKiBJZiBgbXNnYCBpcyBhIGBTdHJpbmdgLCB0aGVuIGl0IGlzIGF1dG9tYXRpY2FsbHkgY29udmVydGVkIHRvIGEgYEJ1ZmZlcmBcbiAgICogd2l0aCBgJ3V0ZjgnYCBlbmNvZGluZy4gV2l0aCBtZXNzYWdlcyB0aGF0IGNvbnRhaW4gbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLFxuICAgKiBgb2Zmc2V0YCBhbmQgYGxlbmd0aGAgd2lsbCBiZSBjYWxjdWxhdGVkIHdpdGggcmVzcGVjdCB0byBgYnl0ZSBsZW5ndGhgIGFuZFxuICAgKiBub3QgdGhlIGNoYXJhY3RlciBwb3NpdGlvbi4gSWYgYG1zZ2AgaXMgYW4gYXJyYXksIGBvZmZzZXRgIGFuZCBgbGVuZ3RoYFxuICAgKiBtdXN0IG5vdCBiZSBzcGVjaWZpZWQuXG4gICAqXG4gICAqIFRoZSBgYWRkcmVzc2AgYXJndW1lbnQgaXMgYSBzdHJpbmcuIElmIHRoZSB2YWx1ZSBvZiBgYWRkcmVzc2AgaXMgYSBob3N0XG4gICAqIG5hbWUsIEROUyB3aWxsIGJlIHVzZWQgdG8gcmVzb2x2ZSB0aGUgYWRkcmVzcyBvZiB0aGUgaG9zdC4gSWYgYGFkZHJlc3NgXG4gICAqIGlzIG5vdCBwcm92aWRlZCBvciBvdGhlcndpc2UgbnVsbGlzaCwgYCcxMjcuMC4wLjEnYCAoZm9yIGB1ZHA0YCBzb2NrZXRzKVxuICAgKiBvciBgJzo6MSdgKGZvciBgdWRwNmAgc29ja2V0cykgd2lsbCBiZSB1c2VkIGJ5IGRlZmF1bHQuXG4gICAqXG4gICAqIElmIHRoZSBzb2NrZXQgaGFzIG5vdCBiZWVuIHByZXZpb3VzbHkgYm91bmQgd2l0aCBhIGNhbGwgdG8gYGJpbmRgLCB0aGVcbiAgICogc29ja2V0IGlzIGFzc2lnbmVkIGEgcmFuZG9tIHBvcnQgbnVtYmVyIGFuZCBpcyBib3VuZCB0byB0aGUgXCJhbGxcbiAgICogaW50ZXJmYWNlc1wiIGFkZHJlc3MgKGAnMC4wLjAuMCdgIGZvciBgdWRwNGAgc29ja2V0cywgYCc6OjAnYCBmb3IgYHVkcDZgXG4gICAqIHNvY2tldHMuKVxuICAgKlxuICAgKiBBbiBvcHRpb25hbCBgY2FsbGJhY2tgIGZ1bmN0aW9uIG1heSBiZSBzcGVjaWZpZWQgdG8gYXMgYSB3YXkgb2ZcbiAgICogcmVwb3J0aW5nIEROUyBlcnJvcnMgb3IgZm9yIGRldGVybWluaW5nIHdoZW4gaXQgaXMgc2FmZSB0byByZXVzZSB0aGUgYGJ1ZmBcbiAgICogb2JqZWN0LiBETlMgbG9va3VwcyBkZWxheSB0aGUgdGltZSB0byBzZW5kIGZvciBhdCBsZWFzdCBvbmUgdGljayBvZiB0aGVcbiAgICogTm9kZS5qcyBldmVudCBsb29wLlxuICAgKlxuICAgKiBUaGUgb25seSB3YXkgdG8ga25vdyBmb3Igc3VyZSB0aGF0IHRoZSBkYXRhZ3JhbSBoYXMgYmVlbiBzZW50IGlzIGJ5IHVzaW5nXG4gICAqIGEgYGNhbGxiYWNrYC4gSWYgYW4gZXJyb3Igb2NjdXJzIGFuZCBhIGBjYWxsYmFja2AgaXMgZ2l2ZW4sIHRoZSBlcnJvciB3aWxsXG4gICAqIGJlIHBhc3NlZCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIGBjYWxsYmFja2AuIElmIGEgYGNhbGxiYWNrYCBpcyBub3RcbiAgICogZ2l2ZW4sIHRoZSBlcnJvciBpcyBlbWl0dGVkIGFzIGFuIGAnZXJyb3InYCBldmVudCBvbiB0aGUgYHNvY2tldGAgb2JqZWN0LlxuICAgKlxuICAgKiBPZmZzZXQgYW5kIGxlbmd0aCBhcmUgb3B0aW9uYWwgYnV0IGJvdGggX211c3RfIGJlIHNldCBpZiBlaXRoZXIgYXJlIHVzZWQuXG4gICAqIFRoZXkgYXJlIHN1cHBvcnRlZCBvbmx5IHdoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGEgYEJ1ZmZlcmAsIGFcbiAgICogYFR5cGVkQXJyYXlgLCBvciBhIGBEYXRhVmlld2AuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHRocm93cyBgRVJSX1NPQ0tFVF9CQURfUE9SVGAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmQgc29ja2V0LlxuICAgKlxuICAgKiBFeGFtcGxlIG9mIHNlbmRpbmcgYSBVRFAgcGFja2V0IHRvIGEgcG9ydCBvbiBgbG9jYWxob3N0YDtcbiAgICpcbiAgICogYGBganNcbiAgICogaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbiAgICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnYnVmZmVyJztcbiAgICpcbiAgICogY29uc3QgbWVzc2FnZSA9IEJ1ZmZlci5mcm9tKCdTb21lIGJ5dGVzJyk7XG4gICAqIGNvbnN0IGNsaWVudCA9IGRncmFtLmNyZWF0ZVNvY2tldCgndWRwNCcpO1xuICAgKiBjbGllbnQuc2VuZChtZXNzYWdlLCA0MTIzNCwgJ2xvY2FsaG9zdCcsIChlcnIpID0+IHtcbiAgICogICBjbGllbnQuY2xvc2UoKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBFeGFtcGxlIG9mIHNlbmRpbmcgYSBVRFAgcGFja2V0IGNvbXBvc2VkIG9mIG11bHRpcGxlIGJ1ZmZlcnMgdG8gYSBwb3J0IG9uXG4gICAqIGAxMjcuMC4wLjFgO1xuICAgKlxuICAgKiBgYGBqc1xuICAgKiBpbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuICAgKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tICdidWZmZXInO1xuICAgKlxuICAgKiBjb25zdCBidWYxID0gQnVmZmVyLmZyb20oJ1NvbWUgJyk7XG4gICAqIGNvbnN0IGJ1ZjIgPSBCdWZmZXIuZnJvbSgnYnl0ZXMnKTtcbiAgICogY29uc3QgY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0Jyk7XG4gICAqIGNsaWVudC5zZW5kKFtidWYxLCBidWYyXSwgNDEyMzQsIChlcnIpID0+IHtcbiAgICogICBjbGllbnQuY2xvc2UoKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBTZW5kaW5nIG11bHRpcGxlIGJ1ZmZlcnMgbWlnaHQgYmUgZmFzdGVyIG9yIHNsb3dlciBkZXBlbmRpbmcgb24gdGhlXG4gICAqIGFwcGxpY2F0aW9uIGFuZCBvcGVyYXRpbmcgc3lzdGVtLiBSdW4gYmVuY2htYXJrcyB0b1xuICAgKiBkZXRlcm1pbmUgdGhlIG9wdGltYWwgc3RyYXRlZ3kgb24gYSBjYXNlLWJ5LWNhc2UgYmFzaXMuIEdlbmVyYWxseVxuICAgKiBzcGVha2luZywgaG93ZXZlciwgc2VuZGluZyBtdWx0aXBsZSBidWZmZXJzIGlzIGZhc3Rlci5cbiAgICpcbiAgICogRXhhbXBsZSBvZiBzZW5kaW5nIGEgVURQIHBhY2tldCB1c2luZyBhIHNvY2tldCBjb25uZWN0ZWQgdG8gYSBwb3J0IG9uXG4gICAqIGBsb2NhbGhvc3RgOlxuICAgKlxuICAgKiBgYGBqc1xuICAgKiBpbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuICAgKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tICdidWZmZXInO1xuICAgKlxuICAgKiBjb25zdCBtZXNzYWdlID0gQnVmZmVyLmZyb20oJ1NvbWUgYnl0ZXMnKTtcbiAgICogY29uc3QgY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0Jyk7XG4gICAqIGNsaWVudC5jb25uZWN0KDQxMjM0LCAnbG9jYWxob3N0JywgKGVycikgPT4ge1xuICAgKiAgIGNsaWVudC5zZW5kKG1lc3NhZ2UsIChlcnIpID0+IHtcbiAgICogICAgIGNsaWVudC5jbG9zZSgpO1xuICAgKiAgIH0pO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBtc2cgTWVzc2FnZSB0byBiZSBzZW50LlxuICAgKiBAcGFyYW0gb2Zmc2V0IE9mZnNldCBpbiB0aGUgYnVmZmVyIHdoZXJlIHRoZSBtZXNzYWdlIHN0YXJ0cy5cbiAgICogQHBhcmFtIGxlbmd0aCBOdW1iZXIgb2YgYnl0ZXMgaW4gdGhlIG1lc3NhZ2UuXG4gICAqIEBwYXJhbSBwb3J0IERlc3RpbmF0aW9uIHBvcnQuXG4gICAqIEBwYXJhbSBhZGRyZXNzIERlc3RpbmF0aW9uIGhvc3QgbmFtZSBvciBJUCBhZGRyZXNzLlxuICAgKiBAcGFyYW0gY2FsbGJhY2sgQ2FsbGVkIHdoZW4gdGhlIG1lc3NhZ2UgaGFzIGJlZW4gc2VudC5cbiAgICovXG4gIHNlbmQoXG4gICAgbXNnOiBNZXNzYWdlVHlwZSB8IFJlYWRvbmx5QXJyYXk8TWVzc2FnZVR5cGU+LFxuICAgIHBvcnQ/OiBudW1iZXIsXG4gICAgYWRkcmVzcz86IHN0cmluZyxcbiAgICBjYWxsYmFjaz86IChlcnJvcjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBieXRlcz86IG51bWJlcikgPT4gdm9pZCxcbiAgKTogdm9pZDtcbiAgc2VuZChcbiAgICBtc2c6IE1lc3NhZ2VUeXBlIHwgUmVhZG9ubHlBcnJheTxNZXNzYWdlVHlwZT4sXG4gICAgcG9ydD86IG51bWJlcixcbiAgICBjYWxsYmFjaz86IChlcnJvcjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBieXRlcz86IG51bWJlcikgPT4gdm9pZCxcbiAgKTogdm9pZDtcbiAgc2VuZChcbiAgICBtc2c6IE1lc3NhZ2VUeXBlIHwgUmVhZG9ubHlBcnJheTxNZXNzYWdlVHlwZT4sXG4gICAgY2FsbGJhY2s/OiAoZXJyb3I6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYnl0ZXM/OiBudW1iZXIpID0+IHZvaWQsXG4gICk6IHZvaWQ7XG4gIHNlbmQoXG4gICAgbXNnOiBNZXNzYWdlVHlwZSxcbiAgICBvZmZzZXQ6IG51bWJlcixcbiAgICBsZW5ndGg6IG51bWJlcixcbiAgICBwb3J0PzogbnVtYmVyLFxuICAgIGFkZHJlc3M/OiBzdHJpbmcsXG4gICAgY2FsbGJhY2s/OiAoZXJyb3I6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYnl0ZXM/OiBudW1iZXIpID0+IHZvaWQsXG4gICk6IHZvaWQ7XG4gIHNlbmQoXG4gICAgbXNnOiBNZXNzYWdlVHlwZSxcbiAgICBvZmZzZXQ6IG51bWJlcixcbiAgICBsZW5ndGg6IG51bWJlcixcbiAgICBwb3J0PzogbnVtYmVyLFxuICAgIGNhbGxiYWNrPzogKGVycm9yOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGJ5dGVzPzogbnVtYmVyKSA9PiB2b2lkLFxuICApOiB2b2lkO1xuICBzZW5kKFxuICAgIG1zZzogTWVzc2FnZVR5cGUsXG4gICAgb2Zmc2V0OiBudW1iZXIsXG4gICAgbGVuZ3RoOiBudW1iZXIsXG4gICAgY2FsbGJhY2s/OiAoZXJyb3I6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYnl0ZXM/OiBudW1iZXIpID0+IHZvaWQsXG4gICk6IHZvaWQ7XG4gIHNlbmQoXG4gICAgYnVmZmVyOiB1bmtub3duLFxuICAgIG9mZnNldD86IHVua25vd24sXG4gICAgbGVuZ3RoPzogdW5rbm93bixcbiAgICBwb3J0PzogdW5rbm93bixcbiAgICBhZGRyZXNzPzogdW5rbm93bixcbiAgICBjYWxsYmFjaz86IHVua25vd24sXG4gICkge1xuICAgIGxldCBsaXN0OiBNZXNzYWdlVHlwZVtdIHwgbnVsbDtcblxuICAgIGNvbnN0IHN0YXRlID0gdGhpc1trU3RhdGVTeW1ib2xdO1xuICAgIGNvbnN0IGNvbm5lY3RlZCA9IHN0YXRlLmNvbm5lY3RTdGF0ZSA9PT0gQ09OTkVDVF9TVEFURV9DT05ORUNURUQ7XG5cbiAgICBpZiAoIWNvbm5lY3RlZCkge1xuICAgICAgaWYgKGFkZHJlc3MgfHwgKHBvcnQgJiYgdHlwZW9mIHBvcnQgIT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICAgICAgYnVmZmVyID0gc2xpY2VCdWZmZXIoXG4gICAgICAgICAgYnVmZmVyIGFzIE1lc3NhZ2VUeXBlLFxuICAgICAgICAgIG9mZnNldCBhcyBudW1iZXIsXG4gICAgICAgICAgbGVuZ3RoIGFzIG51bWJlcixcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrID0gcG9ydDtcbiAgICAgICAgcG9ydCA9IG9mZnNldDtcbiAgICAgICAgYWRkcmVzcyA9IGxlbmd0aDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgYnVmZmVyID0gc2xpY2VCdWZmZXIoYnVmZmVyIGFzIE1lc3NhZ2VUeXBlLCBvZmZzZXQgYXMgbnVtYmVyLCBsZW5ndGgpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgcG9ydCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSBwb3J0O1xuICAgICAgICAgIHBvcnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayA9IG9mZnNldDtcbiAgICAgIH1cblxuICAgICAgaWYgKHBvcnQgfHwgYWRkcmVzcykge1xuICAgICAgICB0aHJvdyBuZXcgRVJSX1NPQ0tFVF9ER1JBTV9JU19DT05ORUNURUQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYnVmZmVyKSkge1xuICAgICAgaWYgKHR5cGVvZiBidWZmZXIgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgbGlzdCA9IFtCdWZmZXIuZnJvbShidWZmZXIpXTtcbiAgICAgIH0gZWxzZSBpZiAoIWlzQXJyYXlCdWZmZXJWaWV3KGJ1ZmZlcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFxuICAgICAgICAgIFwiYnVmZmVyXCIsXG4gICAgICAgICAgW1wiQnVmZmVyXCIsIFwiVHlwZWRBcnJheVwiLCBcIkRhdGFWaWV3XCIsIFwic3RyaW5nXCJdLFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QgPSBbYnVmZmVyIGFzIE1lc3NhZ2VUeXBlXTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCEobGlzdCA9IGZpeEJ1ZmZlckxpc3QoYnVmZmVyKSkpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcbiAgICAgICAgXCJidWZmZXIgbGlzdCBhcmd1bWVudHNcIixcbiAgICAgICAgW1wiQnVmZmVyXCIsIFwiVHlwZWRBcnJheVwiLCBcIkRhdGFWaWV3XCIsIFwic3RyaW5nXCJdLFxuICAgICAgICBidWZmZXIsXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghY29ubmVjdGVkKSB7XG4gICAgICBwb3J0ID0gdmFsaWRhdGVQb3J0KHBvcnQsIFwiUG9ydFwiLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gTm9ybWFsaXplIGNhbGxiYWNrIHNvIGl0J3MgZWl0aGVyIGEgZnVuY3Rpb24gb3IgdW5kZWZpbmVkIGJ1dCBub3QgYW55dGhpbmdcbiAgICAvLyBlbHNlLlxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhZGRyZXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNhbGxiYWNrID0gYWRkcmVzcztcbiAgICAgIGFkZHJlc3MgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIGlmIChhZGRyZXNzICYmIHR5cGVvZiBhZGRyZXNzICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJhZGRyZXNzXCIsIFtcInN0cmluZ1wiLCBcImZhbHN5XCJdLCBhZGRyZXNzKTtcbiAgICB9XG5cbiAgICBoZWFsdGhDaGVjayh0aGlzKTtcblxuICAgIGlmIChzdGF0ZS5iaW5kU3RhdGUgPT09IEJJTkRfU1RBVEVfVU5CT1VORCkge1xuICAgICAgdGhpcy5iaW5kKHsgcG9ydDogMCwgZXhjbHVzaXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgbGlzdC5wdXNoKEJ1ZmZlci5hbGxvYygwKSk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHNvY2tldCBoYXNuJ3QgYmVlbiBib3VuZCB5ZXQsIHB1c2ggdGhlIG91dGJvdW5kIHBhY2tldCBvbnRvIHRoZVxuICAgIC8vIHNlbmQgcXVldWUgYW5kIHNlbmQgYWZ0ZXIgYmluZGluZyBpcyBjb21wbGV0ZS5cbiAgICBpZiAoc3RhdGUuYmluZFN0YXRlICE9PSBCSU5EX1NUQVRFX0JPVU5EKSB7XG4gICAgICAvLyBAdHMtaWdub3JlIG1hcHBpbmcgdW5rbm93bnMgYmFjayBvbnRvIHRoZW1zZWx2ZXMgZG9lc24ndCB0eXBlIG5pY2VseVxuICAgICAgZW5xdWV1ZSh0aGlzLCB0aGlzLnNlbmQuYmluZCh0aGlzLCBsaXN0LCBwb3J0LCBhZGRyZXNzLCBjYWxsYmFjaykpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWZ0ZXJEbnMgPSAoZXg6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgaXA6IHN0cmluZykgPT4ge1xuICAgICAgZGVmYXVsdFRyaWdnZXJBc3luY0lkU2NvcGUoXG4gICAgICAgIHRoaXNbYXN5bmNJZFN5bWJvbF0sXG4gICAgICAgIGRvU2VuZCxcbiAgICAgICAgZXgsXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGlwLFxuICAgICAgICBsaXN0LFxuICAgICAgICBhZGRyZXNzLFxuICAgICAgICBwb3J0LFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGlmICghY29ubmVjdGVkKSB7XG4gICAgICBzdGF0ZS5oYW5kbGUhLmxvb2t1cChhZGRyZXNzIGFzIHN0cmluZywgYWZ0ZXJEbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZnRlckRucyhudWxsLCBcIlwiKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBvciBjbGVhcnMgdGhlIGBTT19CUk9BRENBU1RgIHNvY2tldCBvcHRpb24uIFdoZW4gc2V0IHRvIGB0cnVlYCwgVURQXG4gICAqIHBhY2tldHMgbWF5IGJlIHNlbnQgdG8gYSBsb2NhbCBpbnRlcmZhY2UncyBicm9hZGNhc3QgYWRkcmVzcy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFQkFERmAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmQgc29ja2V0LlxuICAgKi9cbiAgc2V0QnJvYWRjYXN0KGFyZzogYm9vbGVhbikge1xuICAgIGNvbnN0IGVyciA9IHRoaXNba1N0YXRlU3ltYm9sXS5oYW5kbGUhLnNldEJyb2FkY2FzdChhcmcgPyAxIDogMCk7XG5cbiAgICBpZiAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnJub0V4Y2VwdGlvbihlcnIsIFwic2V0QnJvYWRjYXN0XCIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBfQWxsIHJlZmVyZW5jZXMgdG8gc2NvcGUgaW4gdGhpcyBzZWN0aW9uIGFyZSByZWZlcnJpbmcgdG8gW0lQdjYgWm9uZSBJbmRpY2VzXShodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JUHY2X2FkZHJlc3MjU2NvcGVkX2xpdGVyYWxfSVB2Nl9hZGRyZXNzZXMpLCB3aGljaCBhcmUgZGVmaW5lZCBieSBbUkZDXG4gICAqIDQwMDddKGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM0MDA3KS4gSW4gc3RyaW5nIGZvcm0sIGFuIElQX1xuICAgKiBfd2l0aCBhIHNjb3BlIGluZGV4IGlzIHdyaXR0ZW4gYXMgYCdJUCVzY29wZSdgIHdoZXJlIHNjb3BlIGlzIGFuIGludGVyZmFjZSBuYW1lX1xuICAgKiBfb3IgaW50ZXJmYWNlIG51bWJlci5fXG4gICAqXG4gICAqIFNldHMgdGhlIGRlZmF1bHQgb3V0Z29pbmcgbXVsdGljYXN0IGludGVyZmFjZSBvZiB0aGUgc29ja2V0IHRvIGEgY2hvc2VuXG4gICAqIGludGVyZmFjZSBvciBiYWNrIHRvIHN5c3RlbSBpbnRlcmZhY2Ugc2VsZWN0aW9uLiBUaGUgYG11bHRpY2FzdEludGVyZmFjZWAgbXVzdFxuICAgKiBiZSBhIHZhbGlkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBJUCBmcm9tIHRoZSBzb2NrZXQncyBmYW1pbHkuXG4gICAqXG4gICAqIEZvciBJUHY0IHNvY2tldHMsIHRoaXMgc2hvdWxkIGJlIHRoZSBJUCBjb25maWd1cmVkIGZvciB0aGUgZGVzaXJlZCBwaHlzaWNhbFxuICAgKiBpbnRlcmZhY2UuIEFsbCBwYWNrZXRzIHNlbnQgdG8gbXVsdGljYXN0IG9uIHRoZSBzb2NrZXQgd2lsbCBiZSBzZW50IG9uIHRoZVxuICAgKiBpbnRlcmZhY2UgZGV0ZXJtaW5lZCBieSB0aGUgbW9zdCByZWNlbnQgc3VjY2Vzc2Z1bCB1c2Ugb2YgdGhpcyBjYWxsLlxuICAgKlxuICAgKiBGb3IgSVB2NiBzb2NrZXRzLCBgbXVsdGljYXN0SW50ZXJmYWNlYCBzaG91bGQgaW5jbHVkZSBhIHNjb3BlIHRvIGluZGljYXRlIHRoZVxuICAgKiBpbnRlcmZhY2UgYXMgaW4gdGhlIGV4YW1wbGVzIHRoYXQgZm9sbG93LiBJbiBJUHY2LCBpbmRpdmlkdWFsIGBzZW5kYCBjYWxscyBjYW5cbiAgICogYWxzbyB1c2UgZXhwbGljaXQgc2NvcGUgaW4gYWRkcmVzc2VzLCBzbyBvbmx5IHBhY2tldHMgc2VudCB0byBhIG11bHRpY2FzdFxuICAgKiBhZGRyZXNzIHdpdGhvdXQgc3BlY2lmeWluZyBhbiBleHBsaWNpdCBzY29wZSBhcmUgYWZmZWN0ZWQgYnkgdGhlIG1vc3QgcmVjZW50XG4gICAqIHN1Y2Nlc3NmdWwgdXNlIG9mIHRoaXMgY2FsbC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFQkFERmAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmQgc29ja2V0LlxuICAgKlxuICAgKiAjIyMjIEV4YW1wbGU6IElQdjYgb3V0Z29pbmcgbXVsdGljYXN0IGludGVyZmFjZVxuICAgKlxuICAgKiBPbiBtb3N0IHN5c3RlbXMsIHdoZXJlIHNjb3BlIGZvcm1hdCB1c2VzIHRoZSBpbnRlcmZhY2UgbmFtZTpcbiAgICpcbiAgICogYGBganNcbiAgICogY29uc3Qgc29ja2V0ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA2Jyk7XG4gICAqXG4gICAqIHNvY2tldC5iaW5kKDEyMzQsICgpID0+IHtcbiAgICogICBzb2NrZXQuc2V0TXVsdGljYXN0SW50ZXJmYWNlKCc6OiVldGgxJyk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogT24gV2luZG93cywgd2hlcmUgc2NvcGUgZm9ybWF0IHVzZXMgYW4gaW50ZXJmYWNlIG51bWJlcjpcbiAgICpcbiAgICogYGBganNcbiAgICogY29uc3Qgc29ja2V0ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA2Jyk7XG4gICAqXG4gICAqIHNvY2tldC5iaW5kKDEyMzQsICgpID0+IHtcbiAgICogICBzb2NrZXQuc2V0TXVsdGljYXN0SW50ZXJmYWNlKCc6OiUyJyk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogIyMjIyBFeGFtcGxlOiBJUHY0IG91dGdvaW5nIG11bHRpY2FzdCBpbnRlcmZhY2VcbiAgICpcbiAgICogQWxsIHN5c3RlbXMgdXNlIGFuIElQIG9mIHRoZSBob3N0IG9uIHRoZSBkZXNpcmVkIHBoeXNpY2FsIGludGVyZmFjZTpcbiAgICpcbiAgICogYGBganNcbiAgICogY29uc3Qgc29ja2V0ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0Jyk7XG4gICAqXG4gICAqIHNvY2tldC5iaW5kKDEyMzQsICgpID0+IHtcbiAgICogICBzb2NrZXQuc2V0TXVsdGljYXN0SW50ZXJmYWNlKCcxMC4wLjAuMicpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBzZXRNdWx0aWNhc3RJbnRlcmZhY2UoaW50ZXJmYWNlQWRkcmVzczogc3RyaW5nKSB7XG4gICAgaGVhbHRoQ2hlY2sodGhpcyk7XG4gICAgdmFsaWRhdGVTdHJpbmcoaW50ZXJmYWNlQWRkcmVzcywgXCJpbnRlcmZhY2VBZGRyZXNzXCIpO1xuXG4gICAgY29uc3QgZXJyID0gdGhpc1trU3RhdGVTeW1ib2xdLmhhbmRsZSEuc2V0TXVsdGljYXN0SW50ZXJmYWNlKFxuICAgICAgaW50ZXJmYWNlQWRkcmVzcyxcbiAgICApO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcInNldE11bHRpY2FzdEludGVyZmFjZVwiKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBvciBjbGVhcnMgdGhlIGBJUF9NVUxUSUNBU1RfTE9PUGAgc29ja2V0IG9wdGlvbi4gV2hlbiBzZXQgdG8gYHRydWVgLFxuICAgKiBtdWx0aWNhc3QgcGFja2V0cyB3aWxsIGFsc28gYmUgcmVjZWl2ZWQgb24gdGhlIGxvY2FsIGludGVyZmFjZS5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFQkFERmAgaWYgY2FsbGVkIG9uIGFuIHVuYm91bmQgc29ja2V0LlxuICAgKi9cbiAgc2V0TXVsdGljYXN0TG9vcGJhY2soYXJnOiBib29sZWFuKTogdHlwZW9mIGFyZyB7XG4gICAgY29uc3QgZXJyID0gdGhpc1trU3RhdGVTeW1ib2xdLmhhbmRsZSEuc2V0TXVsdGljYXN0TG9vcGJhY2soYXJnID8gMSA6IDApO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcInNldE11bHRpY2FzdExvb3BiYWNrXCIpO1xuICAgIH1cblxuICAgIHJldHVybiBhcmc7IC8vIDAuNCBjb21wYXRpYmlsaXR5XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgYElQX01VTFRJQ0FTVF9UVExgIHNvY2tldCBvcHRpb24uIFdoaWxlIFRUTCBnZW5lcmFsbHkgc3RhbmRzIGZvclxuICAgKiBcIlRpbWUgdG8gTGl2ZVwiLCBpbiB0aGlzIGNvbnRleHQgaXQgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2YgSVAgaG9wcyB0aGF0IGFcbiAgICogcGFja2V0IGlzIGFsbG93ZWQgdG8gdHJhdmVsIHRocm91Z2gsIHNwZWNpZmljYWxseSBmb3IgbXVsdGljYXN0IHRyYWZmaWMuIEVhY2hcbiAgICogcm91dGVyIG9yIGdhdGV3YXkgdGhhdCBmb3J3YXJkcyBhIHBhY2tldCBkZWNyZW1lbnRzIHRoZSBUVEwuIElmIHRoZSBUVEwgaXNcbiAgICogZGVjcmVtZW50ZWQgdG8gMCBieSBhIHJvdXRlciwgaXQgd2lsbCBub3QgYmUgZm9yd2FyZGVkLlxuICAgKlxuICAgKiBUaGUgYHR0bGAgYXJndW1lbnQgbWF5IGJlIGJldHdlZW4gMCBhbmQgMjU1XFwuIFRoZSBkZWZhdWx0IG9uIG1vc3Qgc3lzdGVtcyBpcyBgMWAuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHRocm93cyBgRUJBREZgIGlmIGNhbGxlZCBvbiBhbiB1bmJvdW5kIHNvY2tldC5cbiAgICovXG4gIHNldE11bHRpY2FzdFRUTCh0dGw6IG51bWJlcik6IHR5cGVvZiB0dGwge1xuICAgIHZhbGlkYXRlTnVtYmVyKHR0bCwgXCJ0dGxcIik7XG5cbiAgICBjb25zdCBlcnIgPSB0aGlzW2tTdGF0ZVN5bWJvbF0uaGFuZGxlIS5zZXRNdWx0aWNhc3RUVEwodHRsKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIHRocm93IGVycm5vRXhjZXB0aW9uKGVyciwgXCJzZXRNdWx0aWNhc3RUVExcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR0bDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBgU09fUkNWQlVGYCBzb2NrZXQgb3B0aW9uLiBTZXRzIHRoZSBtYXhpbXVtIHNvY2tldCByZWNlaXZlIGJ1ZmZlclxuICAgKiBpbiBieXRlcy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFUlJfU09DS0VUX0JVRkZFUl9TSVpFYCBpZiBjYWxsZWQgb24gYW4gdW5ib3VuZCBzb2NrZXQuXG4gICAqL1xuICBzZXRSZWN2QnVmZmVyU2l6ZShzaXplOiBudW1iZXIpIHtcbiAgICBidWZmZXJTaXplKHRoaXMsIHNpemUsIFJFQ1ZfQlVGRkVSKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBgU09fU05EQlVGYCBzb2NrZXQgb3B0aW9uLiBTZXRzIHRoZSBtYXhpbXVtIHNvY2tldCBzZW5kIGJ1ZmZlclxuICAgKiBpbiBieXRlcy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGhyb3dzIGBFUlJfU09DS0VUX0JVRkZFUl9TSVpFYCBpZiBjYWxsZWQgb24gYW4gdW5ib3VuZCBzb2NrZXQuXG4gICAqL1xuICBzZXRTZW5kQnVmZmVyU2l6ZShzaXplOiBudW1iZXIpIHtcbiAgICBidWZmZXJTaXplKHRoaXMsIHNpemUsIFNFTkRfQlVGRkVSKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBgSVBfVFRMYCBzb2NrZXQgb3B0aW9uLiBXaGlsZSBUVEwgZ2VuZXJhbGx5IHN0YW5kcyBmb3IgXCJUaW1lIHRvIExpdmVcIixcbiAgICogaW4gdGhpcyBjb250ZXh0IGl0IHNwZWNpZmllcyB0aGUgbnVtYmVyIG9mIElQIGhvcHMgdGhhdCBhIHBhY2tldCBpcyBhbGxvd2VkIHRvXG4gICAqIHRyYXZlbCB0aHJvdWdoLiBFYWNoIHJvdXRlciBvciBnYXRld2F5IHRoYXQgZm9yd2FyZHMgYSBwYWNrZXQgZGVjcmVtZW50cyB0aGVcbiAgICogVFRMLiBJZiB0aGUgVFRMIGlzIGRlY3JlbWVudGVkIHRvIDAgYnkgYSByb3V0ZXIsIGl0IHdpbGwgbm90IGJlIGZvcndhcmRlZC5cbiAgICogQ2hhbmdpbmcgVFRMIHZhbHVlcyBpcyB0eXBpY2FsbHkgZG9uZSBmb3IgbmV0d29yayBwcm9iZXMgb3Igd2hlbiBtdWx0aWNhc3RpbmcuXG4gICAqXG4gICAqIFRoZSBgdHRsYCBhcmd1bWVudCBtYXkgYmUgYmV0d2VlbiBiZXR3ZWVuIDEgYW5kIDI1NVxcLiBUaGUgZGVmYXVsdCBvbiBtb3N0IHN5c3RlbXNcbiAgICogaXMgNjQuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHRocm93cyBgRUJBREZgIGlmIGNhbGxlZCBvbiBhbiB1bmJvdW5kIHNvY2tldC5cbiAgICovXG4gIHNldFRUTCh0dGw6IG51bWJlcik6IHR5cGVvZiB0dGwge1xuICAgIHZhbGlkYXRlTnVtYmVyKHR0bCwgXCJ0dGxcIik7XG5cbiAgICBjb25zdCBlcnIgPSB0aGlzW2tTdGF0ZVN5bWJvbF0uaGFuZGxlIS5zZXRUVEwodHRsKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIHRocm93IGVycm5vRXhjZXB0aW9uKGVyciwgXCJzZXRUVExcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR0bDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCeSBkZWZhdWx0LCBiaW5kaW5nIGEgc29ja2V0IHdpbGwgY2F1c2UgaXQgdG8gYmxvY2sgdGhlIE5vZGUuanMgcHJvY2VzcyBmcm9tXG4gICAqIGV4aXRpbmcgYXMgbG9uZyBhcyB0aGUgc29ja2V0IGlzIG9wZW4uIFRoZSBgc29ja2V0LnVucmVmKClgIG1ldGhvZCBjYW4gYmUgdXNlZFxuICAgKiB0byBleGNsdWRlIHRoZSBzb2NrZXQgZnJvbSB0aGUgcmVmZXJlbmNlIGNvdW50aW5nIHRoYXQga2VlcHMgdGhlIE5vZGUuanNcbiAgICogcHJvY2VzcyBhY3RpdmUsIGFsbG93aW5nIHRoZSBwcm9jZXNzIHRvIGV4aXQgZXZlbiBpZiB0aGUgc29ja2V0IGlzIHN0aWxsXG4gICAqIGxpc3RlbmluZy5cbiAgICpcbiAgICogQ2FsbGluZyBgc29ja2V0LnVucmVmKClgIG11bHRpcGxlIHRpbWVzIHdpbGwgaGF2ZSBubyBhZGRpdGlvbiBlZmZlY3QuXG4gICAqXG4gICAqIFRoZSBgc29ja2V0LnVucmVmKClgIG1ldGhvZCByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBzb2NrZXQgc28gY2FsbHMgY2FuIGJlXG4gICAqIGNoYWluZWQuXG4gICAqL1xuICB1bnJlZigpOiB0aGlzIHtcbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzW2tTdGF0ZVN5bWJvbF0uaGFuZGxlO1xuXG4gICAgaWYgKGhhbmRsZSkge1xuICAgICAgaGFuZGxlLnVucmVmKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYGRncmFtLlNvY2tldGAgb2JqZWN0LiBPbmNlIHRoZSBzb2NrZXQgaXMgY3JlYXRlZCwgY2FsbGluZ1xuICogYHNvY2tldC5iaW5kKClgIHdpbGwgaW5zdHJ1Y3QgdGhlIHNvY2tldCB0byBiZWdpbiBsaXN0ZW5pbmcgZm9yIGRhdGFncmFtXG4gKiBtZXNzYWdlcy4gV2hlbiBgYWRkcmVzc2AgYW5kIGBwb3J0YCBhcmUgbm90IHBhc3NlZCB0byBgc29ja2V0LmJpbmQoKWAgdGhlXG4gKiBtZXRob2Qgd2lsbCBiaW5kIHRoZSBzb2NrZXQgdG8gdGhlIFwiYWxsIGludGVyZmFjZXNcIiBhZGRyZXNzIG9uIGEgcmFuZG9tIHBvcnRcbiAqIChpdCBkb2VzIHRoZSByaWdodCB0aGluZyBmb3IgYm90aCBgdWRwNGAgYW5kIGB1ZHA2YCBzb2NrZXRzKS4gVGhlIGJvdW5kXG4gKiBhZGRyZXNzIGFuZCBwb3J0IGNhbiBiZSByZXRyaWV2ZWQgdXNpbmcgYHNvY2tldC5hZGRyZXNzKCkuYWRkcmVzc2AgYW5kXG4gKiBgc29ja2V0LmFkZHJlc3MoKS5wb3J0YC5cbiAqXG4gKiBJZiB0aGUgYHNpZ25hbGAgb3B0aW9uIGlzIGVuYWJsZWQsIGNhbGxpbmcgYC5hYm9ydCgpYCBvbiB0aGUgY29ycmVzcG9uZGluZ1xuICogYEFib3J0Q29udHJvbGxlcmAgaXMgc2ltaWxhciB0byBjYWxsaW5nIGAuY2xvc2UoKWAgb24gdGhlIHNvY2tldDpcbiAqXG4gKiBgYGBqc1xuICogY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAqIGNvbnN0IHsgc2lnbmFsIH0gPSBjb250cm9sbGVyO1xuICogY29uc3Qgc2VydmVyID0gZGdyYW0uY3JlYXRlU29ja2V0KHsgdHlwZTogJ3VkcDQnLCBzaWduYWwgfSk7XG4gKiBzZXJ2ZXIub24oJ21lc3NhZ2UnLCAobXNnLCByaW5mbykgPT4ge1xuICogICBjb25zb2xlLmxvZyhgc2VydmVyIGdvdDogJHttc2d9IGZyb20gJHtyaW5mby5hZGRyZXNzfToke3JpbmZvLnBvcnR9YCk7XG4gKiB9KTtcbiAqIC8vIExhdGVyLCB3aGVuIHlvdSB3YW50IHRvIGNsb3NlIHRoZSBzZXJ2ZXIuXG4gKiBjb250cm9sbGVyLmFib3J0KCk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gb3B0aW9uc1xuICogQHBhcmFtIGNhbGxiYWNrIEF0dGFjaGVkIGFzIGEgbGlzdGVuZXIgZm9yIGAnbWVzc2FnZSdgIGV2ZW50cy4gT3B0aW9uYWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTb2NrZXQoXG4gIHR5cGU6IFNvY2tldFR5cGUsXG4gIGxpc3RlbmVyPzogKG1zZzogQnVmZmVyLCByaW5mbzogUmVtb3RlSW5mbykgPT4gdm9pZCxcbik6IFNvY2tldDtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTb2NrZXQoXG4gIHR5cGU6IFNvY2tldE9wdGlvbnMsXG4gIGxpc3RlbmVyPzogKG1zZzogQnVmZmVyLCByaW5mbzogUmVtb3RlSW5mbykgPT4gdm9pZCxcbik6IFNvY2tldDtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTb2NrZXQoXG4gIHR5cGU6IFNvY2tldFR5cGUgfCBTb2NrZXRPcHRpb25zLFxuICBsaXN0ZW5lcj86IChtc2c6IEJ1ZmZlciwgcmluZm86IFJlbW90ZUluZm8pID0+IHZvaWQsXG4pOiBTb2NrZXQge1xuICByZXR1cm4gbmV3IFNvY2tldCh0eXBlLCBsaXN0ZW5lcik7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0TGlzdGVuaW5nKHNvY2tldDogU29ja2V0KSB7XG4gIGNvbnN0IHN0YXRlID0gc29ja2V0W2tTdGF0ZVN5bWJvbF07XG5cbiAgc3RhdGUuaGFuZGxlIS5vbm1lc3NhZ2UgPSBvbk1lc3NhZ2U7XG4gIC8vIFRvZG86IGhhbmRsZSBlcnJvcnNcbiAgc3RhdGUuaGFuZGxlIS5yZWN2U3RhcnQoKTtcbiAgc3RhdGUucmVjZWl2aW5nID0gdHJ1ZTtcbiAgc3RhdGUuYmluZFN0YXRlID0gQklORF9TVEFURV9CT1VORDtcblxuICBpZiAoc3RhdGUucmVjdkJ1ZmZlclNpemUpIHtcbiAgICBidWZmZXJTaXplKHNvY2tldCwgc3RhdGUucmVjdkJ1ZmZlclNpemUsIFJFQ1ZfQlVGRkVSKTtcbiAgfVxuXG4gIGlmIChzdGF0ZS5zZW5kQnVmZmVyU2l6ZSkge1xuICAgIGJ1ZmZlclNpemUoc29ja2V0LCBzdGF0ZS5zZW5kQnVmZmVyU2l6ZSwgU0VORF9CVUZGRVIpO1xuICB9XG5cbiAgc29ja2V0LmVtaXQoXCJsaXN0ZW5pbmdcIik7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VIYW5kbGUoc2VsZjogU29ja2V0LCBuZXdIYW5kbGU6IFVEUCkge1xuICBjb25zdCBzdGF0ZSA9IHNlbGZba1N0YXRlU3ltYm9sXTtcbiAgY29uc3Qgb2xkSGFuZGxlID0gc3RhdGUuaGFuZGxlITtcblxuICAvLyBTZXQgdXAgdGhlIGhhbmRsZSB0aGF0IHdlIGdvdCBmcm9tIHByaW1hcnkuXG4gIG5ld0hhbmRsZS5sb29rdXAgPSBvbGRIYW5kbGUubG9va3VwO1xuICBuZXdIYW5kbGUuYmluZCA9IG9sZEhhbmRsZS5iaW5kO1xuICBuZXdIYW5kbGUuc2VuZCA9IG9sZEhhbmRsZS5zZW5kO1xuICBuZXdIYW5kbGVbb3duZXJTeW1ib2xdID0gc2VsZjtcblxuICAvLyBSZXBsYWNlIHRoZSBleGlzdGluZyBoYW5kbGUgYnkgdGhlIGhhbmRsZSB3ZSBnb3QgZnJvbSBwcmltYXJ5LlxuICBvbGRIYW5kbGUuY2xvc2UoKTtcbiAgc3RhdGUuaGFuZGxlID0gbmV3SGFuZGxlO1xufVxuXG5mdW5jdGlvbiBidWZmZXJTaXplKHNlbGY6IFNvY2tldCwgc2l6ZTogbnVtYmVyLCBidWZmZXI6IGJvb2xlYW4pOiBudW1iZXIge1xuICBpZiAoc2l6ZSA+Pj4gMCAhPT0gc2l6ZSkge1xuICAgIHRocm93IG5ldyBFUlJfU09DS0VUX0JBRF9CVUZGRVJfU0laRSgpO1xuICB9XG5cbiAgY29uc3QgY3R4ID0ge307XG4gIGNvbnN0IHJldCA9IHNlbGZba1N0YXRlU3ltYm9sXS5oYW5kbGUhLmJ1ZmZlclNpemUoc2l6ZSwgYnVmZmVyLCBjdHgpO1xuXG4gIGlmIChyZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFUlJfU09DS0VUX0JVRkZFUl9TSVpFKGN0eCBhcyBOb2RlU3lzdGVtRXJyb3JDdHgpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gc29ja2V0Q2xvc2VOVChzZWxmOiBTb2NrZXQpIHtcbiAgc2VsZi5lbWl0KFwiY2xvc2VcIik7XG59XG5cbmZ1bmN0aW9uIGhlYWx0aENoZWNrKHNvY2tldDogU29ja2V0KSB7XG4gIGlmICghc29ja2V0W2tTdGF0ZVN5bWJvbF0uaGFuZGxlKSB7XG4gICAgLy8gRXJyb3IgbWVzc2FnZSBmcm9tIGRncmFtX2xlZ2FjeS5qcy5cbiAgICB0aHJvdyBuZXcgRVJSX1NPQ0tFVF9ER1JBTV9OT1RfUlVOTklORygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0b3BSZWNlaXZpbmcoc29ja2V0OiBTb2NrZXQpIHtcbiAgY29uc3Qgc3RhdGUgPSBzb2NrZXRba1N0YXRlU3ltYm9sXTtcblxuICBpZiAoIXN0YXRlLnJlY2VpdmluZykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRlLmhhbmRsZSEucmVjdlN0b3AoKTtcbiAgc3RhdGUucmVjZWl2aW5nID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9uTWVzc2FnZShcbiAgbnJlYWQ6IG51bWJlcixcbiAgaGFuZGxlOiBVRFAsXG4gIGJ1Zj86IEJ1ZmZlcixcbiAgcmluZm8/OiBSZW1vdGVJbmZvLFxuKSB7XG4gIGNvbnN0IHNlbGYgPSBoYW5kbGVbb3duZXJTeW1ib2xdIGFzIFNvY2tldDtcblxuICBpZiAobnJlYWQgPCAwKSB7XG4gICAgc2VsZi5lbWl0KFwiZXJyb3JcIiwgZXJybm9FeGNlcHRpb24obnJlYWQsIFwicmVjdm1zZ1wiKSk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICByaW5mbyEuc2l6ZSA9IGJ1ZiEubGVuZ3RoOyAvLyBjb21wYXRpYmlsaXR5XG5cbiAgc2VsZi5lbWl0KFwibWVzc2FnZVwiLCBidWYsIHJpbmZvKTtcbn1cblxuZnVuY3Rpb24gc2xpY2VCdWZmZXIoYnVmZmVyOiBNZXNzYWdlVHlwZSwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSB7XG4gIGlmICh0eXBlb2YgYnVmZmVyID09PSBcInN0cmluZ1wiKSB7XG4gICAgYnVmZmVyID0gQnVmZmVyLmZyb20oYnVmZmVyKTtcbiAgfSBlbHNlIGlmICghaXNBcnJheUJ1ZmZlclZpZXcoYnVmZmVyKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcbiAgICAgIFwiYnVmZmVyXCIsXG4gICAgICBbXCJCdWZmZXJcIiwgXCJUeXBlZEFycmF5XCIsIFwiRGF0YVZpZXdcIiwgXCJzdHJpbmdcIl0sXG4gICAgICBidWZmZXIsXG4gICAgKTtcbiAgfVxuXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMDtcbiAgbGVuZ3RoID0gbGVuZ3RoID4+PiAwO1xuXG4gIGlmIChvZmZzZXQgPiBidWZmZXIuYnl0ZUxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFUlJfQlVGRkVSX09VVF9PRl9CT1VORFMoXCJvZmZzZXRcIik7XG4gIH1cblxuICBpZiAob2Zmc2V0ICsgbGVuZ3RoID4gYnVmZmVyLmJ5dGVMZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0JVRkZFUl9PVVRfT0ZfQk9VTkRTKFwibGVuZ3RoXCIpO1xuICB9XG5cbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGJ1ZmZlci5idWZmZXIsIGJ1ZmZlci5ieXRlT2Zmc2V0ICsgb2Zmc2V0LCBsZW5ndGgpO1xufVxuXG5mdW5jdGlvbiBmaXhCdWZmZXJMaXN0KFxuICBsaXN0OiBSZWFkb25seUFycmF5PE1lc3NhZ2VUeXBlPixcbik6IEFycmF5PE1lc3NhZ2VUeXBlPiB8IG51bGwge1xuICBjb25zdCBuZXdMaXN0ID0gbmV3IEFycmF5KGxpc3QubGVuZ3RoKTtcblxuICBmb3IgKGxldCBpID0gMCwgbCA9IGxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgYnVmID0gbGlzdFtpXTtcblxuICAgIGlmICh0eXBlb2YgYnVmID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBuZXdMaXN0W2ldID0gQnVmZmVyLmZyb20oYnVmKTtcbiAgICB9IGVsc2UgaWYgKCFpc0FycmF5QnVmZmVyVmlldyhidWYpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3TGlzdFtpXSA9IEJ1ZmZlci5mcm9tKGJ1Zi5idWZmZXIsIGJ1Zi5ieXRlT2Zmc2V0LCBidWYuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ld0xpc3Q7XG59XG5cbmZ1bmN0aW9uIGVucXVldWUoc2VsZjogU29ja2V0LCB0b0VucXVldWU6ICgpID0+IHZvaWQpIHtcbiAgY29uc3Qgc3RhdGUgPSBzZWxmW2tTdGF0ZVN5bWJvbF07XG5cbiAgLy8gSWYgdGhlIHNlbmQgcXVldWUgaGFzbid0IGJlZW4gaW5pdGlhbGl6ZWQgeWV0LCBkbyBpdCwgYW5kIGluc3RhbGwgYW5cbiAgLy8gZXZlbnQgaGFuZGxlciB0aGF0IGZsdXNoZXMgdGhlIHNlbmQgcXVldWUgYWZ0ZXIgYmluZGluZyBpcyBkb25lLlxuICBpZiAoc3RhdGUucXVldWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXRlLnF1ZXVlID0gW107XG5cbiAgICBzZWxmLm9uY2UoRXZlbnRFbWl0dGVyLmVycm9yTW9uaXRvciwgb25MaXN0ZW5FcnJvcik7XG4gICAgc2VsZi5vbmNlKFwibGlzdGVuaW5nXCIsIG9uTGlzdGVuU3VjY2Vzcyk7XG4gIH1cblxuICBzdGF0ZS5xdWV1ZS5wdXNoKHRvRW5xdWV1ZSk7XG59XG5cbmZ1bmN0aW9uIG9uTGlzdGVuU3VjY2Vzcyh0aGlzOiBTb2NrZXQpIHtcbiAgdGhpcy5yZW1vdmVMaXN0ZW5lcihFdmVudEVtaXR0ZXIuZXJyb3JNb25pdG9yLCBvbkxpc3RlbkVycm9yKTtcbiAgY2xlYXJRdWV1ZS5jYWxsKHRoaXMpO1xufVxuXG5mdW5jdGlvbiBvbkxpc3RlbkVycm9yKHRoaXM6IFNvY2tldCkge1xuICB0aGlzLnJlbW92ZUxpc3RlbmVyKFwibGlzdGVuaW5nXCIsIG9uTGlzdGVuU3VjY2Vzcyk7XG4gIHRoaXNba1N0YXRlU3ltYm9sXS5xdWV1ZSA9IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gY2xlYXJRdWV1ZSh0aGlzOiBTb2NrZXQpIHtcbiAgY29uc3Qgc3RhdGUgPSB0aGlzW2tTdGF0ZVN5bWJvbF07XG4gIGNvbnN0IHF1ZXVlID0gc3RhdGUucXVldWU7XG4gIHN0YXRlLnF1ZXVlID0gdW5kZWZpbmVkO1xuXG4gIC8vIEZsdXNoIHRoZSBzZW5kIHF1ZXVlLlxuICBmb3IgKGNvbnN0IHF1ZXVlRW50cnkgb2YgcXVldWUhKSB7XG4gICAgcXVldWVFbnRyeSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9jb25uZWN0KFxuICB0aGlzOiBTb2NrZXQsXG4gIHBvcnQ6IG51bWJlcixcbiAgYWRkcmVzczogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycj86IEVycm5vRXhjZXB0aW9uKSA9PiB2b2lkLFxuKSB7XG4gIGNvbnN0IHN0YXRlID0gdGhpc1trU3RhdGVTeW1ib2xdO1xuXG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgY2FsbGJhY2spO1xuICB9XG5cbiAgY29uc3QgYWZ0ZXJEbnMgPSAoZXg6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgaXA6IHN0cmluZykgPT4ge1xuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICAgICAgdGhpc1thc3luY0lkU3ltYm9sXSxcbiAgICAgIGRvQ29ubmVjdCxcbiAgICAgIGV4LFxuICAgICAgdGhpcyxcbiAgICAgIGlwLFxuICAgICAgYWRkcmVzcyxcbiAgICAgIHBvcnQsXG4gICAgICBjYWxsYmFjayxcbiAgICApO1xuICB9O1xuXG4gIHN0YXRlLmhhbmRsZSEubG9va3VwKGFkZHJlc3MsIGFmdGVyRG5zKTtcbn1cblxuZnVuY3Rpb24gZG9Db25uZWN0KFxuICBleDogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICBzZWxmOiBTb2NrZXQsXG4gIGlwOiBzdHJpbmcsXG4gIGFkZHJlc3M6IHN0cmluZyxcbiAgcG9ydDogbnVtYmVyLFxuICBjYWxsYmFjazogKGVycj86IEVycm5vRXhjZXB0aW9uKSA9PiB2b2lkLFxuKSB7XG4gIGNvbnN0IHN0YXRlID0gc2VsZltrU3RhdGVTeW1ib2xdO1xuXG4gIGlmICghc3RhdGUuaGFuZGxlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFleCkge1xuICAgIGNvbnN0IGVyciA9IHN0YXRlLmhhbmRsZS5jb25uZWN0KGlwLCBwb3J0KTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIGV4ID0gZXhjZXB0aW9uV2l0aEhvc3RQb3J0KGVyciwgXCJjb25uZWN0XCIsIGFkZHJlc3MsIHBvcnQpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChleCkge1xuICAgIHN0YXRlLmNvbm5lY3RTdGF0ZSA9IENPTk5FQ1RfU1RBVEVfRElTQ09OTkVDVEVEO1xuXG4gICAgcmV0dXJuIG5leHRUaWNrKCgpID0+IHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKFwiY29ubmVjdFwiLCBjYWxsYmFjayk7XG5cbiAgICAgICAgY2FsbGJhY2soZXghKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuZW1pdChcImVycm9yXCIsIGV4KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRlLmNvbm5lY3RTdGF0ZSA9IENPTk5FQ1RfU1RBVEVfQ09OTkVDVEVEO1xuXG4gIG5leHRUaWNrKCgpID0+IHNlbGYuZW1pdChcImNvbm5lY3RcIikpO1xufVxuXG5mdW5jdGlvbiBkb1NlbmQoXG4gIGV4OiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsXG4gIHNlbGY6IFNvY2tldCxcbiAgaXA6IHN0cmluZyxcbiAgbGlzdDogTWVzc2FnZVR5cGVbXSxcbiAgYWRkcmVzczogc3RyaW5nLFxuICBwb3J0OiBudW1iZXIsXG4gIGNhbGxiYWNrPzogKGVycm9yOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGJ5dGVzPzogbnVtYmVyKSA9PiB2b2lkLFxuKSB7XG4gIGNvbnN0IHN0YXRlID0gc2VsZltrU3RhdGVTeW1ib2xdO1xuXG4gIGlmIChleCkge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgbmV4dFRpY2soY2FsbGJhY2ssIGV4KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5leHRUaWNrKCgpID0+IHNlbGYuZW1pdChcImVycm9yXCIsIGV4KSk7XG5cbiAgICByZXR1cm47XG4gIH0gZWxzZSBpZiAoIXN0YXRlLmhhbmRsZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHJlcSA9IG5ldyBTZW5kV3JhcCgpO1xuICByZXEubGlzdCA9IGxpc3Q7IC8vIEtlZXAgcmVmZXJlbmNlIGFsaXZlLlxuICByZXEuYWRkcmVzcyA9IGFkZHJlc3M7XG4gIHJlcS5wb3J0ID0gcG9ydDtcblxuICBpZiAoY2FsbGJhY2spIHtcbiAgICByZXEuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICByZXEub25jb21wbGV0ZSA9IGFmdGVyU2VuZDtcbiAgfVxuXG4gIGxldCBlcnI7XG5cbiAgaWYgKHBvcnQpIHtcbiAgICBlcnIgPSBzdGF0ZS5oYW5kbGUuc2VuZChyZXEsIGxpc3QsIGxpc3QubGVuZ3RoLCBwb3J0LCBpcCwgISFjYWxsYmFjayk7XG4gIH0gZWxzZSB7XG4gICAgZXJyID0gc3RhdGUuaGFuZGxlLnNlbmQocmVxLCBsaXN0LCBsaXN0Lmxlbmd0aCwgISFjYWxsYmFjayk7XG4gIH1cblxuICBpZiAoZXJyID49IDEpIHtcbiAgICAvLyBTeW5jaHJvbm91cyBmaW5pc2guIFRoZSByZXR1cm4gY29kZSBpcyBtc2dfbGVuZ3RoICsgMSBzbyB0aGF0IHdlIGNhblxuICAgIC8vIGRpc3Rpbmd1aXNoIGJldHdlZW4gc3luY2hyb25vdXMgc3VjY2VzcyBhbmQgYXN5bmNocm9ub3VzIHN1Y2Nlc3MuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBuZXh0VGljayhjYWxsYmFjaywgbnVsbCwgZXJyIC0gMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGVyciAmJiBjYWxsYmFjaykge1xuICAgIC8vIERvbid0IGVtaXQgYXMgZXJyb3IsIGRncmFtX2xlZ2FjeS5qcyBjb21wYXRpYmlsaXR5XG4gICAgY29uc3QgZXggPSBleGNlcHRpb25XaXRoSG9zdFBvcnQoZXJyLCBcInNlbmRcIiwgYWRkcmVzcywgcG9ydCk7XG5cbiAgICBuZXh0VGljayhjYWxsYmFjaywgZXgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFmdGVyU2VuZCh0aGlzOiBTZW5kV3JhcCwgZXJyOiBudW1iZXIgfCBudWxsLCBzZW50PzogbnVtYmVyKSB7XG4gIGxldCBleDogRXJybm9FeGNlcHRpb24gfCBudWxsO1xuXG4gIGlmIChlcnIpIHtcbiAgICBleCA9IGV4Y2VwdGlvbldpdGhIb3N0UG9ydChlcnIsIFwic2VuZFwiLCB0aGlzLmFkZHJlc3MsIHRoaXMucG9ydCk7XG4gIH0gZWxzZSB7XG4gICAgZXggPSBudWxsO1xuICB9XG5cbiAgdGhpcy5jYWxsYmFjayhleCwgc2VudCk7XG59XG5cbmV4cG9ydCB0eXBlIHsgU29ja2V0VHlwZSB9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGNyZWF0ZVNvY2tldCxcbiAgU29ja2V0LFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSx5REFBeUQ7QUFDekQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSw2REFBNkQ7QUFDN0QsNEVBQTRFO0FBQzVFLDJFQUEyRTtBQUMzRSx3RUFBd0U7QUFDeEUsNEVBQTRFO0FBQzVFLHlDQUF5QztBQUV6QyxTQUFTLE1BQU0sUUFBUSxjQUFjO0FBQ3JDLFNBQVMsWUFBWSxRQUFRLGNBQWM7QUFHM0MsU0FDRSx3QkFBd0IsRUFDeEIsb0JBQW9CLEVBQ3BCLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsd0JBQXdCLEVBQ3hCLDBCQUEwQixFQUMxQixzQkFBc0IsRUFDdEIsNkJBQTZCLEVBQzdCLDhCQUE4QixFQUM5Qiw0QkFBNEIsRUFDNUIsY0FBYyxFQUNkLHFCQUFxQixRQUNoQix1QkFBdUI7QUFFOUIsU0FBUyxZQUFZLEVBQUUsU0FBUyxRQUFRLHNCQUFzQjtBQUU5RCxTQUNFLGFBQWEsRUFDYiwwQkFBMEIsRUFDMUIsV0FBVyxRQUNOLDRCQUE0QjtBQUNuQyxTQUFTLFFBQVEsUUFBYSxpQ0FBaUM7QUFDL0QsU0FDRSxPQUFPLEVBQ1AsbUJBQW1CLEVBQ25CLGNBQWMsRUFDZCxZQUFZLEVBQ1osY0FBYyxRQUNULDRCQUE0QjtBQUNuQyxTQUFTLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsU0FBUyxFQUFFLFFBQVEsa0NBQWtDO0FBQ3JELFNBQVMsUUFBUSxRQUFRLGVBQWU7QUFDeEMsU0FBUyxpQkFBaUIsUUFBUSwyQkFBMkI7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