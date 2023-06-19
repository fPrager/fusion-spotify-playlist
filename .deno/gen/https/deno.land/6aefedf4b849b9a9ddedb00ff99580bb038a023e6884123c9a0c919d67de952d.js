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
import { notImplemented } from "./_utils.ts";
import { EventEmitter } from "./events.ts";
import { isIP, isIPv4, isIPv6, normalizedArgsSymbol } from "./internal/net.ts";
import { Duplex } from "./stream.ts";
import { asyncIdSymbol, defaultTriggerAsyncIdScope, newAsyncId, ownerSymbol } from "./internal/async_hooks.ts";
import { ERR_INVALID_ADDRESS_FAMILY, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_FD_TYPE, ERR_INVALID_IP_ADDRESS, ERR_MISSING_ARGS, ERR_SERVER_ALREADY_LISTEN, ERR_SERVER_NOT_RUNNING, ERR_SOCKET_CLOSED, errnoException, exceptionWithHostPort, genericNodeError, uvExceptionWithHostPort } from "./internal/errors.ts";
import { isUint8Array } from "./internal/util/types.ts";
import { kAfterAsyncWrite, kBuffer, kBufferCb, kBufferGen, kHandle, kUpdateTimer, onStreamRead, setStreamTimeout, writeGeneric, writevGeneric } from "./internal/stream_base_commons.ts";
import { kTimeout } from "./internal/timers.mjs";
import { nextTick } from "./_next_tick.ts";
import { DTRACE_NET_SERVER_CONNECTION, DTRACE_NET_STREAM_END } from "./internal/dtrace.ts";
import { Buffer } from "./buffer.ts";
import { validateAbortSignal, validateFunction, validateInt32, validateNumber, validatePort, validateString } from "./internal/validators.mjs";
import { constants as TCPConstants, TCP, TCPConnectWrap } from "./internal_binding/tcp_wrap.ts";
import { constants as PipeConstants, Pipe, PipeConnectWrap } from "./internal_binding/pipe_wrap.ts";
import { ShutdownWrap } from "./internal_binding/stream_wrap.ts";
import { assert } from "../_util/asserts.ts";
import { isWindows } from "../_util/os.ts";
import { ADDRCONFIG, lookup as dnsLookup } from "./dns.ts";
import { codeMap } from "./internal_binding/uv.ts";
import { guessHandleType } from "./internal_binding/util.ts";
import { debuglog } from "./internal/util/debuglog.ts";
let debug = debuglog("net", (fn)=>{
    debug = fn;
});
const kLastWriteQueueSize = Symbol("lastWriteQueueSize");
const kSetNoDelay = Symbol("kSetNoDelay");
const kBytesRead = Symbol("kBytesRead");
const kBytesWritten = Symbol("kBytesWritten");
const DEFAULT_IPV4_ADDR = "0.0.0.0";
const DEFAULT_IPV6_ADDR = "::";
function _getNewAsyncId(handle) {
    return !handle || typeof handle.getAsyncId !== "function" ? newAsyncId() : handle.getAsyncId();
}
const _noop = (_arrayBuffer, _nread)=>{
    return;
};
function _toNumber(x) {
    return (x = Number(x)) >= 0 ? x : false;
}
function _isPipeName(s) {
    return typeof s === "string" && _toNumber(s) === false;
}
function _createHandle(fd, isServer) {
    validateInt32(fd, "fd", 0);
    const type = guessHandleType(fd);
    if (type === "PIPE") {
        return new Pipe(isServer ? PipeConstants.SERVER : PipeConstants.SOCKET);
    }
    if (type === "TCP") {
        return new TCP(isServer ? TCPConstants.SERVER : TCPConstants.SOCKET);
    }
    throw new ERR_INVALID_FD_TYPE(type);
}
// Returns an array [options, cb], where options is an object,
// cb is either a function or null.
// Used to normalize arguments of `Socket.prototype.connect()` and
// `Server.prototype.listen()`. Possible combinations of parameters:
// - (options[...][, cb])
// - (path[...][, cb])
// - ([port][, host][...][, cb])
// For `Socket.prototype.connect()`, the [...] part is ignored
// For `Server.prototype.listen()`, the [...] part is [, backlog]
// but will not be handled here (handled in listen())
export function _normalizeArgs(args) {
    let arr;
    if (args.length === 0) {
        arr = [
            {},
            null
        ];
        arr[normalizedArgsSymbol] = true;
        return arr;
    }
    const arg0 = args[0];
    let options = {};
    if (typeof arg0 === "object" && arg0 !== null) {
        // (options[...][, cb])
        options = arg0;
    } else if (_isPipeName(arg0)) {
        // (path[...][, cb])
        options.path = arg0;
    } else {
        // ([port][, host][...][, cb])
        options.port = arg0;
        if (args.length > 1 && typeof args[1] === "string") {
            options.host = args[1];
        }
    }
    const cb = args[args.length - 1];
    if (!_isConnectionListener(cb)) {
        arr = [
            options,
            null
        ];
    } else {
        arr = [
            options,
            cb
        ];
    }
    arr[normalizedArgsSymbol] = true;
    return arr;
}
function _isTCPConnectWrap(req) {
    return "localAddress" in req && "localPort" in req;
}
function _afterConnect(status, // deno-lint-ignore no-explicit-any
handle, req, readable, writable) {
    let socket = handle[ownerSymbol];
    if (socket.constructor.name === "ReusedHandle") {
        socket = socket.handle;
    }
    // Callback may come after call to destroy
    if (socket.destroyed) {
        return;
    }
    debug("afterConnect");
    assert(socket.connecting);
    socket.connecting = false;
    socket._sockname = null;
    if (status === 0) {
        if (socket.readable && !readable) {
            socket.push(null);
            socket.read();
        }
        if (socket.writable && !writable) {
            socket.end();
        }
        socket._unrefTimer();
        socket.emit("connect");
        socket.emit("ready");
        // Start the first read, or get an immediate EOF.
        // this doesn't actually consume any bytes, because len=0.
        if (readable && !socket.isPaused()) {
            socket.read(0);
        }
    } else {
        socket.connecting = false;
        let details;
        if (_isTCPConnectWrap(req)) {
            details = req.localAddress + ":" + req.localPort;
        }
        const ex = exceptionWithHostPort(status, "connect", req.address, req.port, details);
        if (_isTCPConnectWrap(req)) {
            ex.localAddress = req.localAddress;
            ex.localPort = req.localPort;
        }
        socket.destroy(ex);
    }
}
function _checkBindError(err, port, handle) {
    // EADDRINUSE may not be reported until we call `listen()` or `connect()`.
    // To complicate matters, a failed `bind()` followed by `listen()` or `connect()`
    // will implicitly bind to a random port. Ergo, check that the socket is
    // bound to the expected port before calling `listen()` or `connect()`.
    if (err === 0 && port > 0 && handle.getsockname) {
        const out = {};
        err = handle.getsockname(out);
        if (err === 0 && port !== out.port) {
            err = codeMap.get("EADDRINUSE");
        }
    }
    return err;
}
function _isPipe(options) {
    return "path" in options && !!options.path;
}
function _connectErrorNT(socket, err) {
    socket.destroy(err);
}
function _internalConnect(socket, address, port, addressType, localAddress, localPort, flags) {
    assert(socket.connecting);
    let err;
    if (localAddress || localPort) {
        if (addressType === 4) {
            localAddress = localAddress || DEFAULT_IPV4_ADDR;
            err = socket._handle.bind(localAddress, localPort);
        } else {
            // addressType === 6
            localAddress = localAddress || DEFAULT_IPV6_ADDR;
            err = socket._handle.bind6(localAddress, localPort, flags);
        }
        debug("binding to localAddress: %s and localPort: %d (addressType: %d)", localAddress, localPort, addressType);
        err = _checkBindError(err, localPort, socket._handle);
        if (err) {
            const ex = exceptionWithHostPort(err, "bind", localAddress, localPort);
            socket.destroy(ex);
            return;
        }
    }
    if (addressType === 6 || addressType === 4) {
        const req = new TCPConnectWrap();
        req.oncomplete = _afterConnect;
        req.address = address;
        req.port = port;
        req.localAddress = localAddress;
        req.localPort = localPort;
        if (addressType === 4) {
            err = socket._handle.connect(req, address, port);
        } else {
            err = socket._handle.connect6(req, address, port);
        }
    } else {
        const req1 = new PipeConnectWrap();
        req1.oncomplete = _afterConnect;
        req1.address = address;
        err = socket._handle.connect(req1, address);
    }
    if (err) {
        let details = "";
        const sockname = socket._getsockname();
        if (sockname) {
            details = `${sockname.address}:${sockname.port}`;
        }
        const ex1 = exceptionWithHostPort(err, "connect", address, port, details);
        socket.destroy(ex1);
    }
}
// Provide a better error message when we call end() as a result
// of the other side sending a FIN.  The standard "write after end"
// is overly vague, and makes it seem like the user's code is to blame.
function _writeAfterFIN(// deno-lint-ignore no-explicit-any
chunk, encoding, cb) {
    if (!this.writableEnded) {
        return Duplex.prototype.write.call(this, chunk, encoding, // @ts-expect-error Using `call` seem to be interfering with the overload for write
        cb);
    }
    if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
    }
    const err = genericNodeError("This socket has been ended by the other party", {
        code: "EPIPE"
    });
    if (typeof cb === "function") {
        defaultTriggerAsyncIdScope(this[asyncIdSymbol], nextTick, cb, err);
    }
    if (this._server) {
        nextTick(()=>this.destroy(err));
    } else {
        this.destroy(err);
    }
    return false;
}
function _tryReadStart(socket) {
    // Not already reading, start the flow.
    debug("Socket._handle.readStart");
    socket._handle.reading = true;
    const err = socket._handle.readStart();
    if (err) {
        socket.destroy(errnoException(err, "read"));
    }
}
// Called when the "end" event is emitted.
function _onReadableStreamEnd() {
    if (!this.allowHalfOpen) {
        this.write = _writeAfterFIN;
    }
}
// Called when creating new Socket, or when re-using a closed Socket
function _initSocketHandle(socket) {
    socket._undestroy();
    socket._sockname = undefined;
    // Handle creation may be deferred to bind() or connect() time.
    if (socket._handle) {
        // deno-lint-ignore no-explicit-any
        socket._handle[ownerSymbol] = socket;
        socket._handle.onread = onStreamRead;
        socket[asyncIdSymbol] = _getNewAsyncId(socket._handle);
        let userBuf = socket[kBuffer];
        if (userBuf) {
            const bufGen = socket[kBufferGen];
            if (bufGen !== null) {
                userBuf = bufGen();
                if (!isUint8Array(userBuf)) {
                    return;
                }
                socket[kBuffer] = userBuf;
            }
            socket._handle.useUserBuffer(userBuf);
        }
    }
}
function _lookupAndConnect(self, options) {
    const { localAddress , localPort  } = options;
    const host = options.host || "localhost";
    let { port  } = options;
    if (localAddress && !isIP(localAddress)) {
        throw new ERR_INVALID_IP_ADDRESS(localAddress);
    }
    if (localPort) {
        validateNumber(localPort, "options.localPort");
    }
    if (typeof port !== "undefined") {
        if (typeof port !== "number" && typeof port !== "string") {
            throw new ERR_INVALID_ARG_TYPE("options.port", [
                "number",
                "string"
            ], port);
        }
        validatePort(port);
    }
    port |= 0;
    // If host is an IP, skip performing a lookup
    const addressType = isIP(host);
    if (addressType) {
        defaultTriggerAsyncIdScope(self[asyncIdSymbol], nextTick, ()=>{
            if (self.connecting) {
                defaultTriggerAsyncIdScope(self[asyncIdSymbol], _internalConnect, self, host, port, addressType, localAddress, localPort);
            }
        });
        return;
    }
    if (options.lookup !== undefined) {
        validateFunction(options.lookup, "options.lookup");
    }
    const dnsOpts = {
        family: options.family,
        hints: options.hints || 0
    };
    if (!isWindows && dnsOpts.family !== 4 && dnsOpts.family !== 6 && dnsOpts.hints === 0) {
        dnsOpts.hints = ADDRCONFIG;
    }
    debug("connect: find host", host);
    debug("connect: dns options", dnsOpts);
    self._host = host;
    const lookup = options.lookup || dnsLookup;
    defaultTriggerAsyncIdScope(self[asyncIdSymbol], function() {
        lookup(host, dnsOpts, function emitLookup(err, ip, addressType) {
            self.emit("lookup", err, ip, addressType, host);
            // It's possible we were destroyed while looking this up.
            // XXX it would be great if we could cancel the promise returned by
            // the look up.
            if (!self.connecting) {
                return;
            }
            if (err) {
                // net.createConnection() creates a net.Socket object and immediately
                // calls net.Socket.connect() on it (that's us). There are no event
                // listeners registered yet so defer the error event to the next tick.
                nextTick(_connectErrorNT, self, err);
            } else if (!isIP(ip)) {
                err = new ERR_INVALID_IP_ADDRESS(ip);
                nextTick(_connectErrorNT, self, err);
            } else if (addressType !== 4 && addressType !== 6) {
                err = new ERR_INVALID_ADDRESS_FAMILY(`${addressType}`, options.host, options.port);
                nextTick(_connectErrorNT, self, err);
            } else {
                self._unrefTimer();
                defaultTriggerAsyncIdScope(self[asyncIdSymbol], _internalConnect, self, ip, port, addressType, localAddress, localPort);
            }
        });
    });
}
function _afterShutdown() {
    // deno-lint-ignore no-explicit-any
    const self = this.handle[ownerSymbol];
    debug("afterShutdown destroyed=%j", self.destroyed, self._readableState);
    this.callback();
}
function _emitCloseNT(s) {
    debug("SERVER: emit close");
    s.emit("close");
}
/**
 * This class is an abstraction of a TCP socket or a streaming `IPC` endpoint
 * (uses named pipes on Windows, and Unix domain sockets otherwise). It is also
 * an `EventEmitter`.
 *
 * A `net.Socket` can be created by the user and used directly to interact with
 * a server. For example, it is returned by `createConnection`,
 * so the user can use it to talk to the server.
 *
 * It can also be created by Node.js and passed to the user when a connection
 * is received. For example, it is passed to the listeners of a `"connection"` event emitted on a `Server`, so the user can use
 * it to interact with the client.
 */ export class Socket extends Duplex {
    // Problem with this is that users can supply their own handle, that may not
    // have `handle.getAsyncId()`. In this case an `[asyncIdSymbol]` should
    // probably be supplied by `async_hooks`.
    [asyncIdSymbol] = -1;
    [kHandle] = null;
    [kSetNoDelay] = false;
    [kLastWriteQueueSize] = 0;
    // deno-lint-ignore no-explicit-any
    [kTimeout] = null;
    [kBuffer] = null;
    [kBufferCb] = null;
    [kBufferGen] = null;
    // Used after `.destroy()`
    [kBytesRead] = 0;
    [kBytesWritten] = 0;
    // Reserved properties
    server = null;
    // deno-lint-ignore no-explicit-any
    _server = null;
    _peername;
    _sockname;
    _pendingData = null;
    _pendingEncoding = "";
    _host = null;
    // deno-lint-ignore no-explicit-any
    _parent = null;
    constructor(options){
        if (typeof options === "number") {
            // Legacy interface.
            options = {
                fd: options
            };
        } else {
            options = {
                ...options
            };
        }
        // Default to *not* allowing half open sockets.
        options.allowHalfOpen = Boolean(options.allowHalfOpen);
        // For backwards compat do not emit close on destroy.
        options.emitClose = false;
        options.autoDestroy = true;
        // Handle strings directly.
        options.decodeStrings = false;
        super(options);
        if (options.handle) {
            this._handle = options.handle;
            this[asyncIdSymbol] = _getNewAsyncId(this._handle);
        } else if (options.fd !== undefined) {
            // REF: https://github.com/denoland/deno/issues/6529
            notImplemented("net.Socket.prototype.constructor with fd option");
        }
        const onread = options.onread;
        if (onread !== null && typeof onread === "object" && (isUint8Array(onread.buffer) || typeof onread.buffer === "function") && typeof onread.callback === "function") {
            if (typeof onread.buffer === "function") {
                this[kBuffer] = true;
                this[kBufferGen] = onread.buffer;
            } else {
                this[kBuffer] = onread.buffer;
            }
            this[kBufferCb] = onread.callback;
        }
        this.on("end", _onReadableStreamEnd);
        _initSocketHandle(this);
        // If we have a handle, then start the flow of data into the
        // buffer. If not, then this will happen when we connect.
        if (this._handle && options.readable !== false) {
            if (options.pauseOnCreate) {
                // Stop the handle from reading and pause the stream
                this._handle.reading = false;
                this._handle.readStop();
                // @ts-expect-error This property shouldn't be modified
                this.readableFlowing = false;
            } else if (!options.manualStart) {
                this.read(0);
            }
        }
    }
    connect(...args) {
        let normalized;
        // If passed an array, it's treated as an array of arguments that have
        // already been normalized (so we don't normalize more than once). This has
        // been solved before in https://github.com/nodejs/node/pull/12342, but was
        // reverted as it had unintended side effects.
        if (Array.isArray(args[0]) && args[0][normalizedArgsSymbol]) {
            normalized = args[0];
        } else {
            normalized = _normalizeArgs(args);
        }
        const options = normalized[0];
        const cb = normalized[1];
        // `options.port === null` will be checked later.
        if (options.port === undefined && options.path == null) {
            throw new ERR_MISSING_ARGS([
                "options",
                "port",
                "path"
            ]);
        }
        if (this.write !== Socket.prototype.write) {
            this.write = Socket.prototype.write;
        }
        if (this.destroyed) {
            this._handle = null;
            this._peername = undefined;
            this._sockname = undefined;
        }
        const { path  } = options;
        const pipe = _isPipe(options);
        debug("pipe", pipe, path);
        if (!this._handle) {
            this._handle = pipe ? new Pipe(PipeConstants.SOCKET) : new TCP(TCPConstants.SOCKET);
            _initSocketHandle(this);
        }
        if (cb !== null) {
            this.once("connect", cb);
        }
        this._unrefTimer();
        this.connecting = true;
        if (pipe) {
            validateString(path, "options.path");
            defaultTriggerAsyncIdScope(this[asyncIdSymbol], _internalConnect, this, path);
        } else {
            _lookupAndConnect(this, options);
        }
        return this;
    }
    /**
   * Pauses the reading of data. That is, `"data"` events will not be emitted.
   * Useful to throttle back an upload.
   *
   * @return The socket itself.
   */ pause() {
        if (this[kBuffer] && !this.connecting && this._handle && this._handle.reading) {
            this._handle.reading = false;
            if (!this.destroyed) {
                const err = this._handle.readStop();
                if (err) {
                    this.destroy(errnoException(err, "read"));
                }
            }
        }
        return Duplex.prototype.pause.call(this);
    }
    /**
   * Resumes reading after a call to `socket.pause()`.
   *
   * @return The socket itself.
   */ resume() {
        if (this[kBuffer] && !this.connecting && this._handle && !this._handle.reading) {
            _tryReadStart(this);
        }
        return Duplex.prototype.resume.call(this);
    }
    /**
   * Sets the socket to timeout after `timeout` milliseconds of inactivity on
   * the socket. By default `net.Socket` do not have a timeout.
   *
   * When an idle timeout is triggered the socket will receive a `"timeout"` event but the connection will not be severed. The user must manually call `socket.end()` or `socket.destroy()` to
   * end the connection.
   *
   * ```ts
   * import { createRequire } from "https://deno.land/std@$STD_VERSION/node/module.ts";
   *
   * const require = createRequire(import.meta.url);
   * const net = require("net");
   *
   * const socket = new net.Socket();
   * socket.setTimeout(3000);
   * socket.on("timeout", () => {
   *   console.log("socket timeout");
   *   socket.end();
   * });
   * ```
   *
   * If `timeout` is `0`, then the existing idle timeout is disabled.
   *
   * The optional `callback` parameter will be added as a one-time listener for the `"timeout"` event.
   * @return The socket itself.
   */ setTimeout = setStreamTimeout;
    /**
   * Enable/disable the use of Nagle's algorithm.
   *
   * When a TCP connection is created, it will have Nagle's algorithm enabled.
   *
   * Nagle's algorithm delays data before it is sent via the network. It attempts
   * to optimize throughput at the expense of latency.
   *
   * Passing `true` for `noDelay` or not passing an argument will disable Nagle's
   * algorithm for the socket. Passing `false` for `noDelay` will enable Nagle's
   * algorithm.
   *
   * @param noDelay
   * @return The socket itself.
   */ setNoDelay(noDelay) {
        if (!this._handle) {
            this.once("connect", noDelay ? this.setNoDelay : ()=>this.setNoDelay(noDelay));
            return this;
        }
        // Backwards compatibility: assume true when `noDelay` is omitted
        const newValue = noDelay === undefined ? true : !!noDelay;
        if ("setNoDelay" in this._handle && this._handle.setNoDelay && newValue !== this[kSetNoDelay]) {
            this[kSetNoDelay] = newValue;
            this._handle.setNoDelay(newValue);
        }
        return this;
    }
    /**
   * Enable/disable keep-alive functionality, and optionally set the initial
   * delay before the first keepalive probe is sent on an idle socket.
   *
   * Set `initialDelay` (in milliseconds) to set the delay between the last
   * data packet received and the first keepalive probe. Setting `0` for`initialDelay` will leave the value unchanged from the default
   * (or previous) setting.
   *
   * Enabling the keep-alive functionality will set the following socket options:
   *
   * - `SO_KEEPALIVE=1`
   * - `TCP_KEEPIDLE=initialDelay`
   * - `TCP_KEEPCNT=10`
   * - `TCP_KEEPINTVL=1`
   *
   * @param enable
   * @param initialDelay
   * @return The socket itself.
   */ setKeepAlive(enable, initialDelay) {
        if (!this._handle) {
            this.once("connect", ()=>this.setKeepAlive(enable, initialDelay));
            return this;
        }
        if ("setKeepAlive" in this._handle) {
            this._handle.setKeepAlive(enable, ~~(initialDelay / 1000));
        }
        return this;
    }
    /**
   * Returns the bound `address`, the address `family` name and `port` of the
   * socket as reported by the operating system:`{ port: 12346, family: "IPv4", address: "127.0.0.1" }`
   */ address() {
        return this._getsockname();
    }
    /**
   * Calling `unref()` on a socket will allow the program to exit if this is the only
   * active socket in the event system. If the socket is already `unref`ed calling`unref()` again will have no effect.
   *
   * @return The socket itself.
   */ unref() {
        if (!this._handle) {
            this.once("connect", this.unref);
            return this;
        }
        if (typeof this._handle.unref === "function") {
            this._handle.unref();
        }
        return this;
    }
    /**
   * Opposite of `unref()`, calling `ref()` on a previously `unref`ed socket will_not_ let the program exit if it's the only socket left (the default behavior).
   * If the socket is `ref`ed calling `ref` again will have no effect.
   *
   * @return The socket itself.
   */ ref() {
        if (!this._handle) {
            this.once("connect", this.ref);
            return this;
        }
        if (typeof this._handle.ref === "function") {
            this._handle.ref();
        }
        return this;
    }
    /**
   * This property shows the number of characters buffered for writing. The buffer
   * may contain strings whose length after encoding is not yet known. So this number
   * is only an approximation of the number of bytes in the buffer.
   *
   * `net.Socket` has the property that `socket.write()` always works. This is to
   * help users get up and running quickly. The computer cannot always keep up
   * with the amount of data that is written to a socket. The network connection
   * simply might be too slow. Node.js will internally queue up the data written to a
   * socket and send it out over the wire when it is possible.
   *
   * The consequence of this internal buffering is that memory may grow.
   * Users who experience large or growing `bufferSize` should attempt to
   * "throttle" the data flows in their program with `socket.pause()` and `socket.resume()`.
   *
   * @deprecated Use `writableLength` instead.
   */ get bufferSize() {
        if (this._handle) {
            return this.writableLength;
        }
        return 0;
    }
    /**
   * The amount of received bytes.
   */ get bytesRead() {
        return this._handle ? this._handle.bytesRead : this[kBytesRead];
    }
    /**
   * The amount of bytes sent.
   */ get bytesWritten() {
        let bytes = this._bytesDispatched;
        const data = this._pendingData;
        const encoding = this._pendingEncoding;
        const writableBuffer = this.writableBuffer;
        if (!writableBuffer) {
            return undefined;
        }
        for (const el of writableBuffer){
            bytes += el.chunk instanceof Buffer ? el.chunk.length : Buffer.byteLength(el.chunk, el.encoding);
        }
        if (Array.isArray(data)) {
            // Was a writev, iterate over chunks to get total length
            for(let i = 0; i < data.length; i++){
                const chunk = data[i];
                // deno-lint-ignore no-explicit-any
                if (data.allBuffers || chunk instanceof Buffer) {
                    bytes += chunk.length;
                } else {
                    bytes += Buffer.byteLength(chunk.chunk, chunk.encoding);
                }
            }
        } else if (data) {
            // Writes are either a string or a Buffer.
            if (typeof data !== "string") {
                bytes += data.length;
            } else {
                bytes += Buffer.byteLength(data, encoding);
            }
        }
        return bytes;
    }
    /**
   * If `true`,`socket.connect(options[, connectListener])` was
   * called and has not yet finished. It will stay `true` until the socket becomes
   * connected, then it is set to `false` and the `"connect"` event is emitted. Note
   * that the `socket.connect(options[, connectListener])` callback is a listener for the `"connect"` event.
   */ connecting = false;
    /**
   * The string representation of the local IP address the remote client is
   * connecting on. For example, in a server listening on `"0.0.0.0"`, if a client
   * connects on `"192.168.1.1"`, the value of `socket.localAddress` would be`"192.168.1.1"`.
   */ get localAddress() {
        return this._getsockname().address;
    }
    /**
   * The numeric representation of the local port. For example, `80` or `21`.
   */ get localPort() {
        return this._getsockname().port;
    }
    /**
   * The string representation of the local IP family. `"IPv4"` or `"IPv6"`.
   */ get localFamily() {
        return this._getsockname().family;
    }
    /**
   * The string representation of the remote IP address. For example,`"74.125.127.100"` or `"2001:4860:a005::68"`. Value may be `undefined` if
   * the socket is destroyed (for example, if the client disconnected).
   */ get remoteAddress() {
        return this._getpeername().address;
    }
    /**
   * The string representation of the remote IP family. `"IPv4"` or `"IPv6"`.
   */ get remoteFamily() {
        const { family  } = this._getpeername();
        return family ? `IPv${family}` : family;
    }
    /**
   * The numeric representation of the remote port. For example, `80` or `21`.
   */ get remotePort() {
        return this._getpeername().port;
    }
    get pending() {
        return !this._handle || this.connecting;
    }
    get readyState() {
        if (this.connecting) {
            return "opening";
        } else if (this.readable && this.writable) {
            return "open";
        } else if (this.readable && !this.writable) {
            return "readOnly";
        } else if (!this.readable && this.writable) {
            return "writeOnly";
        }
        return "closed";
    }
    end(data, encoding, cb) {
        Duplex.prototype.end.call(this, data, encoding, cb);
        DTRACE_NET_STREAM_END(this);
        return this;
    }
    /**
   * @param size Optional argument to specify how much data to read.
   */ read(size) {
        if (this[kBuffer] && !this.connecting && this._handle && !this._handle.reading) {
            _tryReadStart(this);
        }
        return Duplex.prototype.read.call(this, size);
    }
    destroySoon() {
        if (this.writable) {
            this.end();
        }
        if (this.writableFinished) {
            this.destroy();
        } else {
            this.once("finish", this.destroy);
        }
    }
    _unrefTimer() {
        // deno-lint-ignore no-this-alias
        for(let s = this; s !== null; s = s._parent){
            if (s[kTimeout]) {
                s[kTimeout].refresh();
            }
        }
    }
    // The user has called .end(), and all the bytes have been
    // sent out to the other side.
    // deno-lint-ignore no-explicit-any
    _final(cb) {
        // If still connecting - defer handling `_final` until 'connect' will happen
        if (this.pending) {
            debug("_final: not yet connected");
            return this.once("connect", ()=>this._final(cb));
        }
        if (!this._handle) {
            return cb();
        }
        debug("_final: not ended, call shutdown()");
        const req = new ShutdownWrap();
        req.oncomplete = _afterShutdown;
        req.handle = this._handle;
        req.callback = cb;
        const err = this._handle.shutdown(req);
        if (err === 1 || err === codeMap.get("ENOTCONN")) {
            // synchronous finish
            return cb();
        } else if (err !== 0) {
            return cb(errnoException(err, "shutdown"));
        }
    }
    _onTimeout() {
        const handle = this._handle;
        const lastWriteQueueSize = this[kLastWriteQueueSize];
        if (lastWriteQueueSize > 0 && handle) {
            // `lastWriteQueueSize !== writeQueueSize` means there is
            // an active write in progress, so we suppress the timeout.
            const { writeQueueSize  } = handle;
            if (lastWriteQueueSize !== writeQueueSize) {
                this[kLastWriteQueueSize] = writeQueueSize;
                this._unrefTimer();
                return;
            }
        }
        debug("_onTimeout");
        this.emit("timeout");
    }
    _read(size) {
        debug("_read");
        if (this.connecting || !this._handle) {
            debug("_read wait for connection");
            this.once("connect", ()=>this._read(size));
        } else if (!this._handle.reading) {
            _tryReadStart(this);
        }
    }
    _destroy(exception, cb) {
        debug("destroy");
        this.connecting = false;
        // deno-lint-ignore no-this-alias
        for(let s = this; s !== null; s = s._parent){
            clearTimeout(s[kTimeout]);
        }
        debug("close");
        if (this._handle) {
            debug("close handle");
            const isException = exception ? true : false;
            // `bytesRead` and `kBytesWritten` should be accessible after `.destroy()`
            this[kBytesRead] = this._handle.bytesRead;
            this[kBytesWritten] = this._handle.bytesWritten;
            this._handle.close(()=>{
                this._handle.onread = _noop;
                this._handle = null;
                this._sockname = undefined;
                debug("emit close");
                this.emit("close", isException);
            });
            cb(exception);
        } else {
            cb(exception);
            nextTick(_emitCloseNT, this);
        }
        if (this._server) {
            debug("has server");
            this._server._connections--;
            if (this._server._emitCloseIfDrained) {
                this._server._emitCloseIfDrained();
            }
        }
    }
    _getpeername() {
        if (!this._handle || !("getpeername" in this._handle) || this.connecting) {
            return this._peername || {};
        } else if (!this._peername) {
            this._peername = {};
            this._handle.getpeername(this._peername);
        }
        return this._peername;
    }
    _getsockname() {
        if (!this._handle || !("getsockname" in this._handle)) {
            return {};
        } else if (!this._sockname) {
            this._sockname = {};
            this._handle.getsockname(this._sockname);
        }
        return this._sockname;
    }
    _writeGeneric(writev, // deno-lint-ignore no-explicit-any
    data, encoding, cb) {
        // If we are still connecting, then buffer this for later.
        // The Writable logic will buffer up any more writes while
        // waiting for this one to be done.
        if (this.connecting) {
            this._pendingData = data;
            this._pendingEncoding = encoding;
            this.once("connect", function connect() {
                this._writeGeneric(writev, data, encoding, cb);
            });
            return;
        }
        this._pendingData = null;
        this._pendingEncoding = "";
        if (!this._handle) {
            cb(new ERR_SOCKET_CLOSED());
            return false;
        }
        this._unrefTimer();
        let req;
        if (writev) {
            req = writevGeneric(this, data, cb);
        } else {
            req = writeGeneric(this, data, encoding, cb);
        }
        if (req.async) {
            this[kLastWriteQueueSize] = req.bytes;
        }
    }
    // @ts-ignore Duplex defining as a property when want a method.
    _writev(// deno-lint-ignore no-explicit-any
    chunks, cb) {
        this._writeGeneric(true, chunks, "", cb);
    }
    _write(// deno-lint-ignore no-explicit-any
    data, encoding, cb) {
        this._writeGeneric(false, data, encoding, cb);
    }
    [kAfterAsyncWrite]() {
        this[kLastWriteQueueSize] = 0;
    }
    get [kUpdateTimer]() {
        return this._unrefTimer;
    }
    get _connecting() {
        return this.connecting;
    }
    // Legacy alias. Having this is probably being overly cautious, but it doesn't
    // really hurt anyone either. This can probably be removed safely if desired.
    get _bytesDispatched() {
        return this._handle ? this._handle.bytesWritten : this[kBytesWritten];
    }
    get _handle() {
        return this[kHandle];
    }
    set _handle(v) {
        this[kHandle] = v;
    }
}
export const Stream = Socket;
export function connect(...args) {
    const normalized = _normalizeArgs(args);
    const options = normalized[0];
    debug("createConnection", normalized);
    const socket = new Socket(options);
    if (options.timeout) {
        socket.setTimeout(options.timeout);
    }
    return socket.connect(normalized);
}
export const createConnection = connect;
function _isServerSocketOptions(options) {
    return options === null || typeof options === "undefined" || typeof options === "object";
}
function _isConnectionListener(connectionListener) {
    return typeof connectionListener === "function";
}
function _getFlags(ipv6Only) {
    return ipv6Only === true ? TCPConstants.UV_TCP_IPV6ONLY : 0;
}
function _listenInCluster(server, address, port, addressType, backlog, fd, exclusive, flags) {
    exclusive = !!exclusive;
    // TODO(cmorten): here we deviate somewhat from the Node implementation which
    // makes use of the https://nodejs.org/api/cluster.html module to run servers
    // across a "cluster" of Node processes to take advantage of multi-core
    // systems.
    //
    // Though Deno has has a Worker capability from which we could simulate this,
    // for now we assert that we are _always_ on the primary process.
    const isPrimary = true;
    if (isPrimary || exclusive) {
        // Will create a new handle
        // _listen2 sets up the listened handle, it is still named like this
        // to avoid breaking code that wraps this method
        server._listen2(address, port, addressType, backlog, fd, flags);
        return;
    }
}
function _lookupAndListen(server, port, address, backlog, exclusive, flags) {
    dnsLookup(address, function doListen(err, ip, addressType) {
        if (err) {
            server.emit("error", err);
        } else {
            addressType = ip ? addressType : 4;
            _listenInCluster(server, ip, port, addressType, backlog, null, exclusive, flags);
        }
    });
}
function _addAbortSignalOption(server, options) {
    if (options?.signal === undefined) {
        return;
    }
    validateAbortSignal(options.signal, "options.signal");
    const { signal  } = options;
    const onAborted = ()=>{
        server.close();
    };
    if (signal.aborted) {
        nextTick(onAborted);
    } else {
        signal.addEventListener("abort", onAborted);
        server.once("close", ()=>signal.removeEventListener("abort", onAborted));
    }
}
// Returns handle if it can be created, or error code if it can't
export function _createServerHandle(address, port, addressType, fd, flags) {
    let err = 0;
    // Assign handle in listen, and clean up if bind or listen fails
    let handle;
    let isTCP = false;
    if (typeof fd === "number" && fd >= 0) {
        try {
            handle = _createHandle(fd, true);
        } catch (e) {
            // Not a fd we can listen on. This will trigger an error.
            debug("listen invalid fd=%d:", fd, e.message);
            return codeMap.get("EINVAL");
        }
        err = handle.open(fd);
        if (err) {
            return err;
        }
        assert(!address && !port);
    } else if (port === -1 && addressType === -1) {
        handle = new Pipe(PipeConstants.SERVER);
        if (isWindows) {
            const instances = Number.parseInt(Deno.env.get("NODE_PENDING_PIPE_INSTANCES") ?? "");
            if (!Number.isNaN(instances)) {
                handle.setPendingInstances(instances);
            }
        }
    } else {
        handle = new TCP(TCPConstants.SERVER);
        isTCP = true;
    }
    if (address || port || isTCP) {
        debug("bind to", address || "any");
        if (!address) {
            // TODO: differs from Node which tries to bind to IPv6 first when no
            // address is provided.
            //
            // Forcing IPv4 as a workaround for Deno not aligning with Node on
            // implicit binding on Windows.
            //
            // REF: https://github.com/denoland/deno/issues/10762
            // Try binding to ipv6 first
            // err = (handle as TCP).bind6(DEFAULT_IPV6_ADDR, port ?? 0, flags ?? 0);
            // if (err) {
            //   handle.close();
            // Fallback to ipv4
            return _createServerHandle(DEFAULT_IPV4_ADDR, port, 4, null, flags);
        // }
        } else if (addressType === 6) {
            err = handle.bind6(address, port ?? 0, flags ?? 0);
        } else {
            err = handle.bind(address, port ?? 0);
        }
    }
    if (err) {
        handle.close();
        return err;
    }
    return handle;
}
function _emitErrorNT(server, err) {
    server.emit("error", err);
}
function _emitListeningNT(server) {
    // Ensure handle hasn't closed
    if (server._handle) {
        server.emit("listening");
    }
}
// deno-lint-ignore no-explicit-any
function _onconnection(err, clientHandle) {
    // deno-lint-ignore no-this-alias
    const handle = this;
    const self = handle[ownerSymbol];
    debug("onconnection");
    if (err) {
        self.emit("error", errnoException(err, "accept"));
        return;
    }
    if (self.maxConnections && self._connections >= self.maxConnections) {
        clientHandle.close();
        return;
    }
    const socket = new Socket({
        handle: clientHandle,
        allowHalfOpen: self.allowHalfOpen,
        pauseOnCreate: self.pauseOnConnect,
        readable: true,
        writable: true
    });
    // TODO: implement noDelay and setKeepAlive
    self._connections++;
    socket.server = self;
    socket._server = self;
    DTRACE_NET_SERVER_CONNECTION(socket);
    self.emit("connection", socket);
}
function _setupListenHandle(address, port, addressType, backlog, fd, flags) {
    debug("setupListenHandle", address, port, addressType, backlog, fd);
    // If there is not yet a handle, we need to create one and bind.
    // In the case of a server sent via IPC, we don't need to do this.
    if (this._handle) {
        debug("setupListenHandle: have a handle already");
    } else {
        debug("setupListenHandle: create a handle");
        let rval = null;
        // Try to bind to the unspecified IPv6 address, see if IPv6 is available
        if (!address && typeof fd !== "number") {
            // TODO: differs from Node which tries to bind to IPv6 first when no
            // address is provided.
            //
            // Forcing IPv4 as a workaround for Deno not aligning with Node on
            // implicit binding on Windows.
            //
            // REF: https://github.com/denoland/deno/issues/10762
            // rval = _createServerHandle(DEFAULT_IPV6_ADDR, port, 6, fd, flags);
            // if (typeof rval === "number") {
            //   rval = null;
            address = DEFAULT_IPV4_ADDR;
            addressType = 4;
        // } else {
        //   address = DEFAULT_IPV6_ADDR;
        //   addressType = 6;
        // }
        }
        if (rval === null) {
            rval = _createServerHandle(address, port, addressType, fd, flags);
        }
        if (typeof rval === "number") {
            const error = uvExceptionWithHostPort(rval, "listen", address, port);
            nextTick(_emitErrorNT, this, error);
            return;
        }
        this._handle = rval;
    }
    this[asyncIdSymbol] = _getNewAsyncId(this._handle);
    this._handle.onconnection = _onconnection;
    this._handle[ownerSymbol] = this;
    // Use a backlog of 512 entries. We pass 511 to the listen() call because
    // the kernel does: backlogsize = roundup_pow_of_two(backlogsize + 1);
    // which will thus give us a backlog of 512 entries.
    const err = this._handle.listen(backlog || 511);
    if (err) {
        const ex = uvExceptionWithHostPort(err, "listen", address, port);
        this._handle.close();
        this._handle = null;
        defaultTriggerAsyncIdScope(this[asyncIdSymbol], nextTick, _emitErrorNT, this, ex);
        return;
    }
    // Generate connection key, this should be unique to the connection
    this._connectionKey = addressType + ":" + address + ":" + port;
    // Unref the handle if the server was unref'ed prior to listening
    if (this._unref) {
        this.unref();
    }
    defaultTriggerAsyncIdScope(this[asyncIdSymbol], nextTick, _emitListeningNT, this);
}
/** This class is used to create a TCP or IPC server. */ export class Server extends EventEmitter {
    [asyncIdSymbol] = -1;
    allowHalfOpen = false;
    pauseOnConnect = false;
    // deno-lint-ignore no-explicit-any
    _handle = null;
    _connections = 0;
    _usingWorkers = false;
    // deno-lint-ignore no-explicit-any
    _workers = [];
    _unref = false;
    _pipeName;
    _connectionKey;
    constructor(options, connectionListener){
        super();
        if (_isConnectionListener(options)) {
            this.on("connection", options);
        } else if (_isServerSocketOptions(options)) {
            this.allowHalfOpen = options?.allowHalfOpen || false;
            this.pauseOnConnect = !!options?.pauseOnConnect;
            if (_isConnectionListener(connectionListener)) {
                this.on("connection", connectionListener);
            }
        } else {
            throw new ERR_INVALID_ARG_TYPE("options", "Object", options);
        }
    }
    listen(...args) {
        const normalized = _normalizeArgs(args);
        let options = normalized[0];
        const cb = normalized[1];
        if (this._handle) {
            throw new ERR_SERVER_ALREADY_LISTEN();
        }
        if (cb !== null) {
            this.once("listening", cb);
        }
        const backlogFromArgs = // (handle, backlog) or (path, backlog) or (port, backlog)
        _toNumber(args.length > 1 && args[1]) || _toNumber(args.length > 2 && args[2]); // (port, host, backlog)
        // deno-lint-ignore no-explicit-any
        options = options._handle || options.handle || options;
        const flags = _getFlags(options.ipv6Only);
        // (handle[, backlog][, cb]) where handle is an object with a handle
        if (options instanceof TCP) {
            this._handle = options;
            this[asyncIdSymbol] = this._handle.getAsyncId();
            _listenInCluster(this, null, -1, -1, backlogFromArgs);
            return this;
        }
        _addAbortSignalOption(this, options);
        // (handle[, backlog][, cb]) where handle is an object with a fd
        if (typeof options.fd === "number" && options.fd >= 0) {
            _listenInCluster(this, null, null, null, backlogFromArgs, options.fd);
            return this;
        }
        // ([port][, host][, backlog][, cb]) where port is omitted,
        // that is, listen(), listen(null), listen(cb), or listen(null, cb)
        // or (options[, cb]) where options.port is explicitly set as undefined or
        // null, bind to an arbitrary unused port
        if (args.length === 0 || typeof args[0] === "function" || typeof options.port === "undefined" && "port" in options || options.port === null) {
            options.port = 0;
        }
        // ([port][, host][, backlog][, cb]) where port is specified
        // or (options[, cb]) where options.port is specified
        // or if options.port is normalized as 0 before
        let backlog;
        if (typeof options.port === "number" || typeof options.port === "string") {
            validatePort(options.port, "options.port");
            backlog = options.backlog || backlogFromArgs;
            // start TCP server listening on host:port
            if (options.host) {
                _lookupAndListen(this, options.port | 0, options.host, backlog, !!options.exclusive, flags);
            } else {
                // Undefined host, listens on unspecified address
                // Default addressType 4 will be used to search for primary server
                _listenInCluster(this, null, options.port | 0, 4, backlog, undefined, options.exclusive);
            }
            return this;
        }
        // (path[, backlog][, cb]) or (options[, cb])
        // where path or options.path is a UNIX domain socket or Windows pipe
        if (options.path && _isPipeName(options.path)) {
            const pipeName = this._pipeName = options.path;
            backlog = options.backlog || backlogFromArgs;
            _listenInCluster(this, pipeName, -1, -1, backlog, undefined, options.exclusive);
            if (!this._handle) {
                // Failed and an error shall be emitted in the next tick.
                // Therefore, we directly return.
                return this;
            }
            let mode = 0;
            if (options.readableAll === true) {
                mode |= PipeConstants.UV_READABLE;
            }
            if (options.writableAll === true) {
                mode |= PipeConstants.UV_WRITABLE;
            }
            if (mode !== 0) {
                const err = this._handle.fchmod(mode);
                if (err) {
                    this._handle.close();
                    this._handle = null;
                    throw errnoException(err, "uv_pipe_chmod");
                }
            }
            return this;
        }
        if (!("port" in options || "path" in options)) {
            throw new ERR_INVALID_ARG_VALUE("options", options, 'must have the property "port" or "path"');
        }
        throw new ERR_INVALID_ARG_VALUE("options", options);
    }
    /**
   * Stops the server from accepting new connections and keeps existing
   * connections. This function is asynchronous, the server is finally closed
   * when all connections are ended and the server emits a `"close"` event.
   * The optional `callback` will be called once the `"close"` event occurs. Unlike
   * that event, it will be called with an `Error` as its only argument if the server
   * was not open when it was closed.
   *
   * @param cb Called when the server is closed.
   */ close(cb) {
        if (typeof cb === "function") {
            if (!this._handle) {
                this.once("close", function close() {
                    cb(new ERR_SERVER_NOT_RUNNING());
                });
            } else {
                this.once("close", cb);
            }
        }
        if (this._handle) {
            this._handle.close();
            this._handle = null;
        }
        if (this._usingWorkers) {
            let left = this._workers.length;
            const onWorkerClose = ()=>{
                if (--left !== 0) {
                    return;
                }
                this._connections = 0;
                this._emitCloseIfDrained();
            };
            // Increment connections to be sure that, even if all sockets will be closed
            // during polling of workers, `close` event will be emitted only once.
            this._connections++;
            // Poll workers
            for(let n = 0; n < this._workers.length; n++){
                this._workers[n].close(onWorkerClose);
            }
        } else {
            this._emitCloseIfDrained();
        }
        return this;
    }
    /**
   * Returns the bound `address`, the address `family` name, and `port` of the server
   * as reported by the operating system if listening on an IP socket
   * (useful to find which port was assigned when getting an OS-assigned address):`{ port: 12346, family: "IPv4", address: "127.0.0.1" }`.
   *
   * For a server listening on a pipe or Unix domain socket, the name is returned
   * as a string.
   *
   * ```ts
   * import { createRequire } from "https://deno.land/std@$STD_VERSION/node/module.ts";
   * import { Socket } from "https://deno.land/std@$STD_VERSION/node/net.ts";
   *
   * const require = createRequire(import.meta.url);
   * const net = require("net");
   *
   * const server = net.createServer((socket: Socket) => {
   *   socket.end("goodbye\n");
   * }).on("error", (err: Error) => {
   *   // Handle errors here.
   *   throw err;
   * });
   *
   * // Grab an arbitrary unused port.
   * server.listen(() => {
   *   console.log("opened server on", server.address());
   * });
   * ```
   *
   * `server.address()` returns `null` before the `"listening"` event has been
   * emitted or after calling `server.close()`.
   */ address() {
        if (this._handle && this._handle.getsockname) {
            const out = {};
            const err = this._handle.getsockname(out);
            if (err) {
                throw errnoException(err, "address");
            }
            return out;
        } else if (this._pipeName) {
            return this._pipeName;
        }
        return null;
    }
    /**
   * Asynchronously get the number of concurrent connections on the server. Works
   * when sockets were sent to forks.
   *
   * Callback should take two arguments `err` and `count`.
   */ getConnections(cb) {
        // deno-lint-ignore no-this-alias
        const server = this;
        function end(err, connections) {
            defaultTriggerAsyncIdScope(server[asyncIdSymbol], nextTick, cb, err, connections);
        }
        if (!this._usingWorkers) {
            end(null, this._connections);
            return this;
        }
        // Poll workers
        let left = this._workers.length;
        let total = this._connections;
        function oncount(err, count) {
            if (err) {
                left = -1;
                return end(err);
            }
            total += count;
            if (--left === 0) {
                return end(null, total);
            }
        }
        for(let n = 0; n < this._workers.length; n++){
            this._workers[n].getConnections(oncount);
        }
        return this;
    }
    /**
   * Calling `unref()` on a server will allow the program to exit if this is the only
   * active server in the event system. If the server is already `unref`ed calling `unref()` again will have no effect.
   */ unref() {
        this._unref = true;
        if (this._handle) {
            this._handle.unref();
        }
        return this;
    }
    /**
   * Opposite of `unref()`, calling `ref()` on a previously `unref`ed server will _not_ let the program exit if it's the only server left (the default behavior).
   * If the server is `ref`ed calling `ref()` again will have no effect.
   */ ref() {
        this._unref = false;
        if (this._handle) {
            this._handle.ref();
        }
        return this;
    }
    /**
   * Indicates whether or not the server is listening for connections.
   */ get listening() {
        return !!this._handle;
    }
    _listen2 = _setupListenHandle;
    _emitCloseIfDrained() {
        debug("SERVER _emitCloseIfDrained");
        if (this._handle || this._connections) {
            debug(`SERVER handle? ${!!this._handle}   connections? ${this._connections}`);
            return;
        }
        // We use setTimeout instead of nextTick here to avoid EADDRINUSE error
        // when the same port listened immediately after the 'close' event.
        // ref: https://github.com/denoland/deno_std/issues/2788
        defaultTriggerAsyncIdScope(this[asyncIdSymbol], setTimeout, _emitCloseNT, 0, this);
    }
    _setupWorker(socketList) {
        this._usingWorkers = true;
        this._workers.push(socketList);
        // deno-lint-ignore no-explicit-any
        socketList.once("exit", (socketList)=>{
            const index = this._workers.indexOf(socketList);
            this._workers.splice(index, 1);
        });
    }
    [EventEmitter.captureRejectionSymbol](err, event, sock) {
        switch(event){
            case "connection":
                {
                    sock.destroy(err);
                    break;
                }
            default:
                {
                    this.emit("error", err);
                }
        }
    }
}
/**
 * Creates a new TCP or IPC server.
 *
 * Accepts an `options` object with properties `allowHalfOpen` (default `false`)
 * and `pauseOnConnect` (default `false`).
 *
 * If `allowHalfOpen` is set to `false`, then the socket will
 * automatically end the writable side when the readable side ends.
 *
 * If `allowHalfOpen` is set to `true`, when the other end of the socket
 * signals the end of transmission, the server will only send back the end of
 * transmission when `socket.end()` is explicitly called. For example, in the
 * context of TCP, when a FIN packed is received, a FIN packed is sent back
 * only when `socket.end()` is explicitly called. Until then the connection is
 * half-closed (non-readable but still writable). See `"end"` event and RFC 1122
 * (section 4.2.2.13) for more information.
 *
 * `pauseOnConnect` indicates whether the socket should be paused on incoming
 * connections.
 *
 * If `pauseOnConnect` is set to `true`, then the socket associated with each
 * incoming connection will be paused, and no data will be read from its
 * handle. This allows connections to be passed between processes without any
 * data being read by the original process. To begin reading data from a paused
 * socket, call `socket.resume()`.
 *
 * The server can be a TCP server or an IPC server, depending on what it
 * `listen()` to.
 *
 * Here is an example of an TCP echo server which listens for connections on
 * port 8124:
 *
 * ```ts
 * import { createRequire } from "https://deno.land/std@$STD_VERSION/node/module.ts";
 * import { Socket } from "https://deno.land/std@$STD_VERSION/node/net.ts";
 *
 * const require = createRequire(import.meta.url);
 * const net = require("net");
 *
 * const server = net.createServer((c: Socket) => {
 *   // "connection" listener.
 *   console.log("client connected");
 *   c.on("end", () => {
 *     console.log("client disconnected");
 *   });
 *   c.write("hello\r\n");
 *   c.pipe(c);
 * });
 *
 * server.on("error", (err: Error) => {
 *   throw err;
 * });
 *
 * server.listen(8124, () => {
 *   console.log("server bound");
 * });
 * ```
 *
 * Test this by using `telnet`:
 *
 * ```console
 * $ telnet localhost 8124
 * ```
 *
 * @param options Socket options.
 * @param connectionListener Automatically set as a listener for the `"connection"` event.
 * @return A `net.Server`.
 */ export function createServer(options, connectionListener) {
    return new Server(options, connectionListener);
}
export { isIP, isIPv4, isIPv6 };
export default {
    _createServerHandle,
    _normalizeArgs,
    isIP,
    isIPv4,
    isIPv6,
    connect,
    createConnection,
    createServer,
    Server,
    Socket,
    Stream
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvbmV0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCIuL2V2ZW50cy50c1wiO1xuaW1wb3J0IHsgaXNJUCwgaXNJUHY0LCBpc0lQdjYsIG5vcm1hbGl6ZWRBcmdzU3ltYm9sIH0gZnJvbSBcIi4vaW50ZXJuYWwvbmV0LnRzXCI7XG5pbXBvcnQgeyBEdXBsZXggfSBmcm9tIFwiLi9zdHJlYW0udHNcIjtcbmltcG9ydCB7XG4gIGFzeW5jSWRTeW1ib2wsXG4gIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlLFxuICBuZXdBc3luY0lkLFxuICBvd25lclN5bWJvbCxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvYXN5bmNfaG9va3MudHNcIjtcbmltcG9ydCB7XG4gIEVSUl9JTlZBTElEX0FERFJFU1NfRkFNSUxZLFxuICBFUlJfSU5WQUxJRF9BUkdfVFlQRSxcbiAgRVJSX0lOVkFMSURfQVJHX1ZBTFVFLFxuICBFUlJfSU5WQUxJRF9GRF9UWVBFLFxuICBFUlJfSU5WQUxJRF9JUF9BRERSRVNTLFxuICBFUlJfTUlTU0lOR19BUkdTLFxuICBFUlJfU0VSVkVSX0FMUkVBRFlfTElTVEVOLFxuICBFUlJfU0VSVkVSX05PVF9SVU5OSU5HLFxuICBFUlJfU09DS0VUX0NMT1NFRCxcbiAgZXJybm9FeGNlcHRpb24sXG4gIGV4Y2VwdGlvbldpdGhIb3N0UG9ydCxcbiAgZ2VuZXJpY05vZGVFcnJvcixcbiAgdXZFeGNlcHRpb25XaXRoSG9zdFBvcnQsXG59IGZyb20gXCIuL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHR5cGUgeyBFcnJub0V4Y2VwdGlvbiB9IGZyb20gXCIuL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHsgRW5jb2RpbmdzIH0gZnJvbSBcIi4vX3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBpc1VpbnQ4QXJyYXkgfSBmcm9tIFwiLi9pbnRlcm5hbC91dGlsL3R5cGVzLnRzXCI7XG5pbXBvcnQge1xuICBrQWZ0ZXJBc3luY1dyaXRlLFxuICBrQnVmZmVyLFxuICBrQnVmZmVyQ2IsXG4gIGtCdWZmZXJHZW4sXG4gIGtIYW5kbGUsXG4gIGtVcGRhdGVUaW1lcixcbiAgb25TdHJlYW1SZWFkLFxuICBzZXRTdHJlYW1UaW1lb3V0LFxuICB3cml0ZUdlbmVyaWMsXG4gIHdyaXRldkdlbmVyaWMsXG59IGZyb20gXCIuL2ludGVybmFsL3N0cmVhbV9iYXNlX2NvbW1vbnMudHNcIjtcbmltcG9ydCB7IGtUaW1lb3V0IH0gZnJvbSBcIi4vaW50ZXJuYWwvdGltZXJzLm1qc1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi9fbmV4dF90aWNrLnRzXCI7XG5pbXBvcnQge1xuICBEVFJBQ0VfTkVUX1NFUlZFUl9DT05ORUNUSU9OLFxuICBEVFJBQ0VfTkVUX1NUUkVBTV9FTkQsXG59IGZyb20gXCIuL2ludGVybmFsL2R0cmFjZS50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgdHlwZSB7IExvb2t1cE9uZU9wdGlvbnMgfSBmcm9tIFwiLi9pbnRlcm5hbC9kbnMvdXRpbHMudHNcIjtcbmltcG9ydCB7XG4gIHZhbGlkYXRlQWJvcnRTaWduYWwsXG4gIHZhbGlkYXRlRnVuY3Rpb24sXG4gIHZhbGlkYXRlSW50MzIsXG4gIHZhbGlkYXRlTnVtYmVyLFxuICB2YWxpZGF0ZVBvcnQsXG4gIHZhbGlkYXRlU3RyaW5nLFxufSBmcm9tIFwiLi9pbnRlcm5hbC92YWxpZGF0b3JzLm1qc1wiO1xuaW1wb3J0IHtcbiAgY29uc3RhbnRzIGFzIFRDUENvbnN0YW50cyxcbiAgVENQLFxuICBUQ1BDb25uZWN0V3JhcCxcbn0gZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy90Y3Bfd3JhcC50c1wiO1xuaW1wb3J0IHtcbiAgY29uc3RhbnRzIGFzIFBpcGVDb25zdGFudHMsXG4gIFBpcGUsXG4gIFBpcGVDb25uZWN0V3JhcCxcbn0gZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy9waXBlX3dyYXAudHNcIjtcbmltcG9ydCB7IFNodXRkb3duV3JhcCB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvc3RyZWFtX3dyYXAudHNcIjtcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9fdXRpbC9hc3NlcnRzLnRzXCI7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tIFwiLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCB7IEFERFJDT05GSUcsIGxvb2t1cCBhcyBkbnNMb29rdXAgfSBmcm9tIFwiLi9kbnMudHNcIjtcbmltcG9ydCB7IGNvZGVNYXAgfSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL3V2LnRzXCI7XG5pbXBvcnQgeyBndWVzc0hhbmRsZVR5cGUgfSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL3V0aWwudHNcIjtcbmltcG9ydCB7IGRlYnVnbG9nIH0gZnJvbSBcIi4vaW50ZXJuYWwvdXRpbC9kZWJ1Z2xvZy50c1wiO1xuaW1wb3J0IHR5cGUgeyBEdXBsZXhPcHRpb25zIH0gZnJvbSBcIi4vX3N0cmVhbS5kLnRzXCI7XG5pbXBvcnQgdHlwZSB7IEJ1ZmZlckVuY29kaW5nIH0gZnJvbSBcIi4vX2dsb2JhbC5kLnRzXCI7XG5pbXBvcnQgdHlwZSB7IEFib3J0YWJsZSB9IGZyb20gXCIuL19ldmVudHMuZC50c1wiO1xuXG5sZXQgZGVidWcgPSBkZWJ1Z2xvZyhcIm5ldFwiLCAoZm4pID0+IHtcbiAgZGVidWcgPSBmbjtcbn0pO1xuXG5jb25zdCBrTGFzdFdyaXRlUXVldWVTaXplID0gU3ltYm9sKFwibGFzdFdyaXRlUXVldWVTaXplXCIpO1xuY29uc3Qga1NldE5vRGVsYXkgPSBTeW1ib2woXCJrU2V0Tm9EZWxheVwiKTtcbmNvbnN0IGtCeXRlc1JlYWQgPSBTeW1ib2woXCJrQnl0ZXNSZWFkXCIpO1xuY29uc3Qga0J5dGVzV3JpdHRlbiA9IFN5bWJvbChcImtCeXRlc1dyaXR0ZW5cIik7XG5cbmNvbnN0IERFRkFVTFRfSVBWNF9BRERSID0gXCIwLjAuMC4wXCI7XG5jb25zdCBERUZBVUxUX0lQVjZfQUREUiA9IFwiOjpcIjtcblxudHlwZSBIYW5kbGUgPSBUQ1AgfCBQaXBlO1xuXG5pbnRlcmZhY2UgSGFuZGxlT3B0aW9ucyB7XG4gIHBhdXNlT25DcmVhdGU/OiBib29sZWFuO1xuICBtYW51YWxTdGFydD86IGJvb2xlYW47XG4gIGhhbmRsZT86IEhhbmRsZTtcbn1cblxuaW50ZXJmYWNlIE9uUmVhZE9wdGlvbnMge1xuICBidWZmZXI6IFVpbnQ4QXJyYXkgfCAoKCkgPT4gVWludDhBcnJheSk7XG4gIC8qKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBmb3IgZXZlcnkgY2h1bmsgb2YgaW5jb21pbmcgZGF0YS5cbiAgICpcbiAgICogVHdvIGFyZ3VtZW50cyBhcmUgcGFzc2VkIHRvIGl0OiB0aGUgbnVtYmVyIG9mIGJ5dGVzIHdyaXR0ZW4gdG8gYnVmZmVyIGFuZFxuICAgKiBhIHJlZmVyZW5jZSB0byBidWZmZXIuXG4gICAqXG4gICAqIFJldHVybiBgZmFsc2VgIGZyb20gdGhpcyBmdW5jdGlvbiB0byBpbXBsaWNpdGx5IGBwYXVzZSgpYCB0aGUgc29ja2V0LlxuICAgKi9cbiAgY2FsbGJhY2soYnl0ZXNXcml0dGVuOiBudW1iZXIsIGJ1ZjogVWludDhBcnJheSk6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBDb25uZWN0T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJZiBzcGVjaWZpZWQsIGluY29taW5nIGRhdGEgaXMgc3RvcmVkIGluIGEgc2luZ2xlIGJ1ZmZlciBhbmQgcGFzc2VkIHRvIHRoZVxuICAgKiBzdXBwbGllZCBjYWxsYmFjayB3aGVuIGRhdGEgYXJyaXZlcyBvbiB0aGUgc29ja2V0LlxuICAgKlxuICAgKiBOb3RlOiB0aGlzIHdpbGwgY2F1c2UgdGhlIHN0cmVhbWluZyBmdW5jdGlvbmFsaXR5IHRvIG5vdCBwcm92aWRlIGFueSBkYXRhLFxuICAgKiBob3dldmVyIGV2ZW50cyBsaWtlIGBcImVycm9yXCJgLCBgXCJlbmRcImAsIGFuZCBgXCJjbG9zZVwiYCB3aWxsIHN0aWxsIGJlXG4gICAqIGVtaXR0ZWQgYXMgbm9ybWFsIGFuZCBtZXRob2RzIGxpa2UgYHBhdXNlKClgIGFuZCBgcmVzdW1lKClgIHdpbGwgYWxzb1xuICAgKiBiZWhhdmUgYXMgZXhwZWN0ZWQuXG4gICAqL1xuICBvbnJlYWQ/OiBPblJlYWRPcHRpb25zO1xufVxuXG5pbnRlcmZhY2UgU29ja2V0T3B0aW9ucyBleHRlbmRzIENvbm5lY3RPcHRpb25zLCBIYW5kbGVPcHRpb25zLCBEdXBsZXhPcHRpb25zIHtcbiAgLyoqXG4gICAqIElmIHNwZWNpZmllZCwgd3JhcCBhcm91bmQgYW4gZXhpc3Rpbmcgc29ja2V0IHdpdGggdGhlIGdpdmVuIGZpbGVcbiAgICogZGVzY3JpcHRvciwgb3RoZXJ3aXNlIGEgbmV3IHNvY2tldCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAqL1xuICBmZD86IG51bWJlcjtcbiAgLyoqXG4gICAqIElmIHNldCB0byBgZmFsc2VgLCB0aGVuIHRoZSBzb2NrZXQgd2lsbCBhdXRvbWF0aWNhbGx5IGVuZCB0aGUgd3JpdGFibGVcbiAgICogc2lkZSB3aGVuIHRoZSByZWFkYWJsZSBzaWRlIGVuZHMuIFNlZSBgbmV0LmNyZWF0ZVNlcnZlcigpYCBhbmQgdGhlIGBcImVuZFwiYFxuICAgKiBldmVudCBmb3IgZGV0YWlscy4gRGVmYXVsdDogYGZhbHNlYC5cbiAgICovXG4gIGFsbG93SGFsZk9wZW4/OiBib29sZWFuO1xuICAvKipcbiAgICogQWxsb3cgcmVhZHMgb24gdGhlIHNvY2tldCB3aGVuIGFuIGZkIGlzIHBhc3NlZCwgb3RoZXJ3aXNlIGlnbm9yZWQuXG4gICAqIERlZmF1bHQ6IGBmYWxzZWAuXG4gICAqL1xuICByZWFkYWJsZT86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBbGxvdyB3cml0ZXMgb24gdGhlIHNvY2tldCB3aGVuIGFuIGZkIGlzIHBhc3NlZCwgb3RoZXJ3aXNlIGlnbm9yZWQuXG4gICAqIERlZmF1bHQ6IGBmYWxzZWAuXG4gICAqL1xuICB3cml0YWJsZT86IGJvb2xlYW47XG4gIC8qKiBBbiBBYm9ydCBzaWduYWwgdGhhdCBtYXkgYmUgdXNlZCB0byBkZXN0cm95IHRoZSBzb2NrZXQuICovXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsO1xufVxuXG5pbnRlcmZhY2UgVGNwTmV0Q29ubmVjdE9wdGlvbnMgZXh0ZW5kcyBUY3BTb2NrZXRDb25uZWN0T3B0aW9ucywgU29ja2V0T3B0aW9ucyB7XG4gIHRpbWVvdXQ/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJcGNOZXRDb25uZWN0T3B0aW9ucyBleHRlbmRzIElwY1NvY2tldENvbm5lY3RPcHRpb25zLCBTb2NrZXRPcHRpb25zIHtcbiAgdGltZW91dD86IG51bWJlcjtcbn1cblxudHlwZSBOZXRDb25uZWN0T3B0aW9ucyA9IFRjcE5ldENvbm5lY3RPcHRpb25zIHwgSXBjTmV0Q29ubmVjdE9wdGlvbnM7XG5cbmludGVyZmFjZSBBZGRyZXNzSW5mbyB7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgZmFtaWx5Pzogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG59XG5cbnR5cGUgTG9va3VwRnVuY3Rpb24gPSAoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IExvb2t1cE9uZU9wdGlvbnMsXG4gIGNhbGxiYWNrOiAoXG4gICAgZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsXG4gICAgYWRkcmVzczogc3RyaW5nLFxuICAgIGZhbWlseTogbnVtYmVyLFxuICApID0+IHZvaWQsXG4pID0+IHZvaWQ7XG5cbmludGVyZmFjZSBUY3BTb2NrZXRDb25uZWN0T3B0aW9ucyBleHRlbmRzIENvbm5lY3RPcHRpb25zIHtcbiAgcG9ydDogbnVtYmVyO1xuICBob3N0Pzogc3RyaW5nO1xuICBsb2NhbEFkZHJlc3M/OiBzdHJpbmc7XG4gIGxvY2FsUG9ydD86IG51bWJlcjtcbiAgaGludHM/OiBudW1iZXI7XG4gIGZhbWlseT86IG51bWJlcjtcbiAgbG9va3VwPzogTG9va3VwRnVuY3Rpb247XG59XG5cbmludGVyZmFjZSBJcGNTb2NrZXRDb25uZWN0T3B0aW9ucyBleHRlbmRzIENvbm5lY3RPcHRpb25zIHtcbiAgcGF0aDogc3RyaW5nO1xufVxuXG50eXBlIFNvY2tldENvbm5lY3RPcHRpb25zID0gVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMgfCBJcGNTb2NrZXRDb25uZWN0T3B0aW9ucztcblxuZnVuY3Rpb24gX2dldE5ld0FzeW5jSWQoaGFuZGxlPzogSGFuZGxlKTogbnVtYmVyIHtcbiAgcmV0dXJuICFoYW5kbGUgfHwgdHlwZW9mIGhhbmRsZS5nZXRBc3luY0lkICE9PSBcImZ1bmN0aW9uXCJcbiAgICA/IG5ld0FzeW5jSWQoKVxuICAgIDogaGFuZGxlLmdldEFzeW5jSWQoKTtcbn1cblxuaW50ZXJmYWNlIE5vcm1hbGl6ZWRBcmdzIHtcbiAgMDogUGFydGlhbDxOZXRDb25uZWN0T3B0aW9ucyB8IExpc3Rlbk9wdGlvbnM+O1xuICAxOiBDb25uZWN0aW9uTGlzdGVuZXIgfCBudWxsO1xuICBbbm9ybWFsaXplZEFyZ3NTeW1ib2xdPzogYm9vbGVhbjtcbn1cblxuY29uc3QgX25vb3AgPSAoX2FycmF5QnVmZmVyOiBVaW50OEFycmF5LCBfbnJlYWQ6IG51bWJlcik6IHVuZGVmaW5lZCA9PiB7XG4gIHJldHVybjtcbn07XG5cbmZ1bmN0aW9uIF90b051bWJlcih4OiB1bmtub3duKTogbnVtYmVyIHwgZmFsc2Uge1xuICByZXR1cm4gKHggPSBOdW1iZXIoeCkpID49IDAgPyAoeCBhcyBudW1iZXIpIDogZmFsc2U7XG59XG5cbmZ1bmN0aW9uIF9pc1BpcGVOYW1lKHM6IHVua25vd24pOiBzIGlzIHN0cmluZyB7XG4gIHJldHVybiB0eXBlb2YgcyA9PT0gXCJzdHJpbmdcIiAmJiBfdG9OdW1iZXIocykgPT09IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlSGFuZGxlKGZkOiBudW1iZXIsIGlzU2VydmVyOiBib29sZWFuKTogSGFuZGxlIHtcbiAgdmFsaWRhdGVJbnQzMihmZCwgXCJmZFwiLCAwKTtcblxuICBjb25zdCB0eXBlID0gZ3Vlc3NIYW5kbGVUeXBlKGZkKTtcblxuICBpZiAodHlwZSA9PT0gXCJQSVBFXCIpIHtcbiAgICByZXR1cm4gbmV3IFBpcGUoaXNTZXJ2ZXIgPyBQaXBlQ29uc3RhbnRzLlNFUlZFUiA6IFBpcGVDb25zdGFudHMuU09DS0VUKTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSBcIlRDUFwiKSB7XG4gICAgcmV0dXJuIG5ldyBUQ1AoaXNTZXJ2ZXIgPyBUQ1BDb25zdGFudHMuU0VSVkVSIDogVENQQ29uc3RhbnRzLlNPQ0tFVCk7XG4gIH1cblxuICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfRkRfVFlQRSh0eXBlKTtcbn1cblxuLy8gUmV0dXJucyBhbiBhcnJheSBbb3B0aW9ucywgY2JdLCB3aGVyZSBvcHRpb25zIGlzIGFuIG9iamVjdCxcbi8vIGNiIGlzIGVpdGhlciBhIGZ1bmN0aW9uIG9yIG51bGwuXG4vLyBVc2VkIHRvIG5vcm1hbGl6ZSBhcmd1bWVudHMgb2YgYFNvY2tldC5wcm90b3R5cGUuY29ubmVjdCgpYCBhbmRcbi8vIGBTZXJ2ZXIucHJvdG90eXBlLmxpc3RlbigpYC4gUG9zc2libGUgY29tYmluYXRpb25zIG9mIHBhcmFtZXRlcnM6XG4vLyAtIChvcHRpb25zWy4uLl1bLCBjYl0pXG4vLyAtIChwYXRoWy4uLl1bLCBjYl0pXG4vLyAtIChbcG9ydF1bLCBob3N0XVsuLi5dWywgY2JdKVxuLy8gRm9yIGBTb2NrZXQucHJvdG90eXBlLmNvbm5lY3QoKWAsIHRoZSBbLi4uXSBwYXJ0IGlzIGlnbm9yZWRcbi8vIEZvciBgU2VydmVyLnByb3RvdHlwZS5saXN0ZW4oKWAsIHRoZSBbLi4uXSBwYXJ0IGlzIFssIGJhY2tsb2ddXG4vLyBidXQgd2lsbCBub3QgYmUgaGFuZGxlZCBoZXJlIChoYW5kbGVkIGluIGxpc3RlbigpKVxuZXhwb3J0IGZ1bmN0aW9uIF9ub3JtYWxpemVBcmdzKGFyZ3M6IHVua25vd25bXSk6IE5vcm1hbGl6ZWRBcmdzIHtcbiAgbGV0IGFycjogTm9ybWFsaXplZEFyZ3M7XG5cbiAgaWYgKGFyZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgYXJyID0gW3t9LCBudWxsXTtcbiAgICBhcnJbbm9ybWFsaXplZEFyZ3NTeW1ib2xdID0gdHJ1ZTtcblxuICAgIHJldHVybiBhcnI7XG4gIH1cblxuICBjb25zdCBhcmcwID0gYXJnc1swXSBhcyBQYXJ0aWFsPE5ldENvbm5lY3RPcHRpb25zPiB8IG51bWJlciB8IHN0cmluZztcbiAgbGV0IG9wdGlvbnM6IFBhcnRpYWw8U29ja2V0Q29ubmVjdE9wdGlvbnM+ID0ge307XG5cbiAgaWYgKHR5cGVvZiBhcmcwID09PSBcIm9iamVjdFwiICYmIGFyZzAgIT09IG51bGwpIHtcbiAgICAvLyAob3B0aW9uc1suLi5dWywgY2JdKVxuICAgIG9wdGlvbnMgPSBhcmcwO1xuICB9IGVsc2UgaWYgKF9pc1BpcGVOYW1lKGFyZzApKSB7XG4gICAgLy8gKHBhdGhbLi4uXVssIGNiXSlcbiAgICAob3B0aW9ucyBhcyBJcGNTb2NrZXRDb25uZWN0T3B0aW9ucykucGF0aCA9IGFyZzA7XG4gIH0gZWxzZSB7XG4gICAgLy8gKFtwb3J0XVssIGhvc3RdWy4uLl1bLCBjYl0pXG4gICAgKG9wdGlvbnMgYXMgVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMpLnBvcnQgPSBhcmcwO1xuXG4gICAgaWYgKGFyZ3MubGVuZ3RoID4gMSAmJiB0eXBlb2YgYXJnc1sxXSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgKG9wdGlvbnMgYXMgVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMpLmhvc3QgPSBhcmdzWzFdO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGNiID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gIGlmICghX2lzQ29ubmVjdGlvbkxpc3RlbmVyKGNiKSkge1xuICAgIGFyciA9IFtvcHRpb25zLCBudWxsXTtcbiAgfSBlbHNlIHtcbiAgICBhcnIgPSBbb3B0aW9ucywgY2JdO1xuICB9XG5cbiAgYXJyW25vcm1hbGl6ZWRBcmdzU3ltYm9sXSA9IHRydWU7XG5cbiAgcmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gX2lzVENQQ29ubmVjdFdyYXAoXG4gIHJlcTogVENQQ29ubmVjdFdyYXAgfCBQaXBlQ29ubmVjdFdyYXAsXG4pOiByZXEgaXMgVENQQ29ubmVjdFdyYXAge1xuICByZXR1cm4gXCJsb2NhbEFkZHJlc3NcIiBpbiByZXEgJiYgXCJsb2NhbFBvcnRcIiBpbiByZXE7XG59XG5cbmZ1bmN0aW9uIF9hZnRlckNvbm5lY3QoXG4gIHN0YXR1czogbnVtYmVyLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBoYW5kbGU6IGFueSxcbiAgcmVxOiBQaXBlQ29ubmVjdFdyYXAgfCBUQ1BDb25uZWN0V3JhcCxcbiAgcmVhZGFibGU6IGJvb2xlYW4sXG4gIHdyaXRhYmxlOiBib29sZWFuLFxuKSB7XG4gIGxldCBzb2NrZXQgPSBoYW5kbGVbb3duZXJTeW1ib2xdO1xuXG4gIGlmIChzb2NrZXQuY29uc3RydWN0b3IubmFtZSA9PT0gXCJSZXVzZWRIYW5kbGVcIikge1xuICAgIHNvY2tldCA9IHNvY2tldC5oYW5kbGU7XG4gIH1cblxuICAvLyBDYWxsYmFjayBtYXkgY29tZSBhZnRlciBjYWxsIHRvIGRlc3Ryb3lcbiAgaWYgKHNvY2tldC5kZXN0cm95ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBkZWJ1ZyhcImFmdGVyQ29ubmVjdFwiKTtcblxuICBhc3NlcnQoc29ja2V0LmNvbm5lY3RpbmcpO1xuXG4gIHNvY2tldC5jb25uZWN0aW5nID0gZmFsc2U7XG4gIHNvY2tldC5fc29ja25hbWUgPSBudWxsO1xuXG4gIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICBpZiAoc29ja2V0LnJlYWRhYmxlICYmICFyZWFkYWJsZSkge1xuICAgICAgc29ja2V0LnB1c2gobnVsbCk7XG4gICAgICBzb2NrZXQucmVhZCgpO1xuICAgIH1cblxuICAgIGlmIChzb2NrZXQud3JpdGFibGUgJiYgIXdyaXRhYmxlKSB7XG4gICAgICBzb2NrZXQuZW5kKCk7XG4gICAgfVxuXG4gICAgc29ja2V0Ll91bnJlZlRpbWVyKCk7XG5cbiAgICBzb2NrZXQuZW1pdChcImNvbm5lY3RcIik7XG4gICAgc29ja2V0LmVtaXQoXCJyZWFkeVwiKTtcblxuICAgIC8vIFN0YXJ0IHRoZSBmaXJzdCByZWFkLCBvciBnZXQgYW4gaW1tZWRpYXRlIEVPRi5cbiAgICAvLyB0aGlzIGRvZXNuJ3QgYWN0dWFsbHkgY29uc3VtZSBhbnkgYnl0ZXMsIGJlY2F1c2UgbGVuPTAuXG4gICAgaWYgKHJlYWRhYmxlICYmICFzb2NrZXQuaXNQYXVzZWQoKSkge1xuICAgICAgc29ja2V0LnJlYWQoMCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHNvY2tldC5jb25uZWN0aW5nID0gZmFsc2U7XG4gICAgbGV0IGRldGFpbHM7XG5cbiAgICBpZiAoX2lzVENQQ29ubmVjdFdyYXAocmVxKSkge1xuICAgICAgZGV0YWlscyA9IHJlcS5sb2NhbEFkZHJlc3MgKyBcIjpcIiArIHJlcS5sb2NhbFBvcnQ7XG4gICAgfVxuXG4gICAgY29uc3QgZXggPSBleGNlcHRpb25XaXRoSG9zdFBvcnQoXG4gICAgICBzdGF0dXMsXG4gICAgICBcImNvbm5lY3RcIixcbiAgICAgIHJlcS5hZGRyZXNzLFxuICAgICAgKHJlcSBhcyBUQ1BDb25uZWN0V3JhcCkucG9ydCxcbiAgICAgIGRldGFpbHMsXG4gICAgKTtcblxuICAgIGlmIChfaXNUQ1BDb25uZWN0V3JhcChyZXEpKSB7XG4gICAgICBleC5sb2NhbEFkZHJlc3MgPSByZXEubG9jYWxBZGRyZXNzO1xuICAgICAgZXgubG9jYWxQb3J0ID0gcmVxLmxvY2FsUG9ydDtcbiAgICB9XG5cbiAgICBzb2NrZXQuZGVzdHJveShleCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2NoZWNrQmluZEVycm9yKGVycjogbnVtYmVyLCBwb3J0OiBudW1iZXIsIGhhbmRsZTogVENQKSB7XG4gIC8vIEVBRERSSU5VU0UgbWF5IG5vdCBiZSByZXBvcnRlZCB1bnRpbCB3ZSBjYWxsIGBsaXN0ZW4oKWAgb3IgYGNvbm5lY3QoKWAuXG4gIC8vIFRvIGNvbXBsaWNhdGUgbWF0dGVycywgYSBmYWlsZWQgYGJpbmQoKWAgZm9sbG93ZWQgYnkgYGxpc3RlbigpYCBvciBgY29ubmVjdCgpYFxuICAvLyB3aWxsIGltcGxpY2l0bHkgYmluZCB0byBhIHJhbmRvbSBwb3J0LiBFcmdvLCBjaGVjayB0aGF0IHRoZSBzb2NrZXQgaXNcbiAgLy8gYm91bmQgdG8gdGhlIGV4cGVjdGVkIHBvcnQgYmVmb3JlIGNhbGxpbmcgYGxpc3RlbigpYCBvciBgY29ubmVjdCgpYC5cbiAgaWYgKGVyciA9PT0gMCAmJiBwb3J0ID4gMCAmJiBoYW5kbGUuZ2V0c29ja25hbWUpIHtcbiAgICBjb25zdCBvdXQ6IEFkZHJlc3NJbmZvIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+ID0ge307XG4gICAgZXJyID0gaGFuZGxlLmdldHNvY2tuYW1lKG91dCk7XG5cbiAgICBpZiAoZXJyID09PSAwICYmIHBvcnQgIT09IG91dC5wb3J0KSB7XG4gICAgICBlcnIgPSBjb2RlTWFwLmdldChcIkVBRERSSU5VU0VcIikhO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIF9pc1BpcGUoXG4gIG9wdGlvbnM6IFBhcnRpYWw8U29ja2V0Q29ubmVjdE9wdGlvbnM+LFxuKTogb3B0aW9ucyBpcyBJcGNTb2NrZXRDb25uZWN0T3B0aW9ucyB7XG4gIHJldHVybiBcInBhdGhcIiBpbiBvcHRpb25zICYmICEhb3B0aW9ucy5wYXRoO1xufVxuXG5mdW5jdGlvbiBfY29ubmVjdEVycm9yTlQoc29ja2V0OiBTb2NrZXQsIGVycjogRXJyb3IpIHtcbiAgc29ja2V0LmRlc3Ryb3koZXJyKTtcbn1cblxuZnVuY3Rpb24gX2ludGVybmFsQ29ubmVjdChcbiAgc29ja2V0OiBTb2NrZXQsXG4gIGFkZHJlc3M6IHN0cmluZyxcbiAgcG9ydDogbnVtYmVyLFxuICBhZGRyZXNzVHlwZTogbnVtYmVyLFxuICBsb2NhbEFkZHJlc3M6IHN0cmluZyxcbiAgbG9jYWxQb3J0OiBudW1iZXIsXG4gIGZsYWdzOiBudW1iZXIsXG4pIHtcbiAgYXNzZXJ0KHNvY2tldC5jb25uZWN0aW5nKTtcblxuICBsZXQgZXJyO1xuXG4gIGlmIChsb2NhbEFkZHJlc3MgfHwgbG9jYWxQb3J0KSB7XG4gICAgaWYgKGFkZHJlc3NUeXBlID09PSA0KSB7XG4gICAgICBsb2NhbEFkZHJlc3MgPSBsb2NhbEFkZHJlc3MgfHwgREVGQVVMVF9JUFY0X0FERFI7XG4gICAgICBlcnIgPSAoc29ja2V0Ll9oYW5kbGUgYXMgVENQKS5iaW5kKGxvY2FsQWRkcmVzcywgbG9jYWxQb3J0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRkcmVzc1R5cGUgPT09IDZcbiAgICAgIGxvY2FsQWRkcmVzcyA9IGxvY2FsQWRkcmVzcyB8fCBERUZBVUxUX0lQVjZfQUREUjtcbiAgICAgIGVyciA9IChzb2NrZXQuX2hhbmRsZSBhcyBUQ1ApLmJpbmQ2KGxvY2FsQWRkcmVzcywgbG9jYWxQb3J0LCBmbGFncyk7XG4gICAgfVxuXG4gICAgZGVidWcoXG4gICAgICBcImJpbmRpbmcgdG8gbG9jYWxBZGRyZXNzOiAlcyBhbmQgbG9jYWxQb3J0OiAlZCAoYWRkcmVzc1R5cGU6ICVkKVwiLFxuICAgICAgbG9jYWxBZGRyZXNzLFxuICAgICAgbG9jYWxQb3J0LFxuICAgICAgYWRkcmVzc1R5cGUsXG4gICAgKTtcblxuICAgIGVyciA9IF9jaGVja0JpbmRFcnJvcihlcnIsIGxvY2FsUG9ydCwgc29ja2V0Ll9oYW5kbGUgYXMgVENQKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIGNvbnN0IGV4ID0gZXhjZXB0aW9uV2l0aEhvc3RQb3J0KGVyciwgXCJiaW5kXCIsIGxvY2FsQWRkcmVzcywgbG9jYWxQb3J0KTtcbiAgICAgIHNvY2tldC5kZXN0cm95KGV4KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIGlmIChhZGRyZXNzVHlwZSA9PT0gNiB8fCBhZGRyZXNzVHlwZSA9PT0gNCkge1xuICAgIGNvbnN0IHJlcSA9IG5ldyBUQ1BDb25uZWN0V3JhcCgpO1xuICAgIHJlcS5vbmNvbXBsZXRlID0gX2FmdGVyQ29ubmVjdDtcbiAgICByZXEuYWRkcmVzcyA9IGFkZHJlc3M7XG4gICAgcmVxLnBvcnQgPSBwb3J0O1xuICAgIHJlcS5sb2NhbEFkZHJlc3MgPSBsb2NhbEFkZHJlc3M7XG4gICAgcmVxLmxvY2FsUG9ydCA9IGxvY2FsUG9ydDtcblxuICAgIGlmIChhZGRyZXNzVHlwZSA9PT0gNCkge1xuICAgICAgZXJyID0gKHNvY2tldC5faGFuZGxlIGFzIFRDUCkuY29ubmVjdChyZXEsIGFkZHJlc3MsIHBvcnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnIgPSAoc29ja2V0Ll9oYW5kbGUgYXMgVENQKS5jb25uZWN0NihyZXEsIGFkZHJlc3MsIHBvcnQpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCByZXEgPSBuZXcgUGlwZUNvbm5lY3RXcmFwKCk7XG4gICAgcmVxLm9uY29tcGxldGUgPSBfYWZ0ZXJDb25uZWN0O1xuICAgIHJlcS5hZGRyZXNzID0gYWRkcmVzcztcblxuICAgIGVyciA9IChzb2NrZXQuX2hhbmRsZSBhcyBQaXBlKS5jb25uZWN0KHJlcSwgYWRkcmVzcyk7XG4gIH1cblxuICBpZiAoZXJyKSB7XG4gICAgbGV0IGRldGFpbHMgPSBcIlwiO1xuXG4gICAgY29uc3Qgc29ja25hbWUgPSBzb2NrZXQuX2dldHNvY2tuYW1lKCk7XG5cbiAgICBpZiAoc29ja25hbWUpIHtcbiAgICAgIGRldGFpbHMgPSBgJHtzb2NrbmFtZS5hZGRyZXNzfToke3NvY2tuYW1lLnBvcnR9YDtcbiAgICB9XG5cbiAgICBjb25zdCBleCA9IGV4Y2VwdGlvbldpdGhIb3N0UG9ydChlcnIsIFwiY29ubmVjdFwiLCBhZGRyZXNzLCBwb3J0LCBkZXRhaWxzKTtcbiAgICBzb2NrZXQuZGVzdHJveShleCk7XG4gIH1cbn1cblxuLy8gUHJvdmlkZSBhIGJldHRlciBlcnJvciBtZXNzYWdlIHdoZW4gd2UgY2FsbCBlbmQoKSBhcyBhIHJlc3VsdFxuLy8gb2YgdGhlIG90aGVyIHNpZGUgc2VuZGluZyBhIEZJTi4gIFRoZSBzdGFuZGFyZCBcIndyaXRlIGFmdGVyIGVuZFwiXG4vLyBpcyBvdmVybHkgdmFndWUsIGFuZCBtYWtlcyBpdCBzZWVtIGxpa2UgdGhlIHVzZXIncyBjb2RlIGlzIHRvIGJsYW1lLlxuZnVuY3Rpb24gX3dyaXRlQWZ0ZXJGSU4oXG4gIHRoaXM6IFNvY2tldCxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgY2h1bms6IGFueSxcbiAgZW5jb2Rpbmc/OlxuICAgIHwgQnVmZmVyRW5jb2RpbmdcbiAgICB8IG51bGxcbiAgICB8ICgoZXJyb3I6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCkgPT4gdm9pZCksXG4gIGNiPzogKGVycm9yOiBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQpID0+IHZvaWQsXG4pOiBib29sZWFuIHtcbiAgaWYgKCF0aGlzLndyaXRhYmxlRW5kZWQpIHtcbiAgICByZXR1cm4gRHVwbGV4LnByb3RvdHlwZS53cml0ZS5jYWxsKFxuICAgICAgdGhpcyxcbiAgICAgIGNodW5rLFxuICAgICAgZW5jb2RpbmcgYXMgQnVmZmVyRW5jb2RpbmcgfCBudWxsLFxuICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBVc2luZyBgY2FsbGAgc2VlbSB0byBiZSBpbnRlcmZlcmluZyB3aXRoIHRoZSBvdmVybG9hZCBmb3Igd3JpdGVcbiAgICAgIGNiLFxuICAgICk7XG4gIH1cblxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGVyciA9IGdlbmVyaWNOb2RlRXJyb3IoXG4gICAgXCJUaGlzIHNvY2tldCBoYXMgYmVlbiBlbmRlZCBieSB0aGUgb3RoZXIgcGFydHlcIixcbiAgICB7IGNvZGU6IFwiRVBJUEVcIiB9LFxuICApO1xuXG4gIGlmICh0eXBlb2YgY2IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKHRoaXNbYXN5bmNJZFN5bWJvbF0sIG5leHRUaWNrLCBjYiwgZXJyKTtcbiAgfVxuXG4gIGlmICh0aGlzLl9zZXJ2ZXIpIHtcbiAgICBuZXh0VGljaygoKSA9PiB0aGlzLmRlc3Ryb3koZXJyKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5kZXN0cm95KGVycik7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIF90cnlSZWFkU3RhcnQoc29ja2V0OiBTb2NrZXQpIHtcbiAgLy8gTm90IGFscmVhZHkgcmVhZGluZywgc3RhcnQgdGhlIGZsb3cuXG4gIGRlYnVnKFwiU29ja2V0Ll9oYW5kbGUucmVhZFN0YXJ0XCIpO1xuICBzb2NrZXQuX2hhbmRsZSEucmVhZGluZyA9IHRydWU7XG4gIGNvbnN0IGVyciA9IHNvY2tldC5faGFuZGxlIS5yZWFkU3RhcnQoKTtcblxuICBpZiAoZXJyKSB7XG4gICAgc29ja2V0LmRlc3Ryb3koZXJybm9FeGNlcHRpb24oZXJyLCBcInJlYWRcIikpO1xuICB9XG59XG5cbi8vIENhbGxlZCB3aGVuIHRoZSBcImVuZFwiIGV2ZW50IGlzIGVtaXR0ZWQuXG5mdW5jdGlvbiBfb25SZWFkYWJsZVN0cmVhbUVuZCh0aGlzOiBTb2NrZXQpIHtcbiAgaWYgKCF0aGlzLmFsbG93SGFsZk9wZW4pIHtcbiAgICB0aGlzLndyaXRlID0gX3dyaXRlQWZ0ZXJGSU47XG4gIH1cbn1cblxuLy8gQ2FsbGVkIHdoZW4gY3JlYXRpbmcgbmV3IFNvY2tldCwgb3Igd2hlbiByZS11c2luZyBhIGNsb3NlZCBTb2NrZXRcbmZ1bmN0aW9uIF9pbml0U29ja2V0SGFuZGxlKHNvY2tldDogU29ja2V0KSB7XG4gIHNvY2tldC5fdW5kZXN0cm95KCk7XG4gIHNvY2tldC5fc29ja25hbWUgPSB1bmRlZmluZWQ7XG5cbiAgLy8gSGFuZGxlIGNyZWF0aW9uIG1heSBiZSBkZWZlcnJlZCB0byBiaW5kKCkgb3IgY29ubmVjdCgpIHRpbWUuXG4gIGlmIChzb2NrZXQuX2hhbmRsZSkge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgKHNvY2tldC5faGFuZGxlIGFzIGFueSlbb3duZXJTeW1ib2xdID0gc29ja2V0O1xuICAgIHNvY2tldC5faGFuZGxlLm9ucmVhZCA9IG9uU3RyZWFtUmVhZDtcbiAgICBzb2NrZXRbYXN5bmNJZFN5bWJvbF0gPSBfZ2V0TmV3QXN5bmNJZChzb2NrZXQuX2hhbmRsZSk7XG5cbiAgICBsZXQgdXNlckJ1ZiA9IHNvY2tldFtrQnVmZmVyXTtcblxuICAgIGlmICh1c2VyQnVmKSB7XG4gICAgICBjb25zdCBidWZHZW4gPSBzb2NrZXRba0J1ZmZlckdlbl07XG5cbiAgICAgIGlmIChidWZHZW4gIT09IG51bGwpIHtcbiAgICAgICAgdXNlckJ1ZiA9IGJ1ZkdlbigpO1xuXG4gICAgICAgIGlmICghaXNVaW50OEFycmF5KHVzZXJCdWYpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc29ja2V0W2tCdWZmZXJdID0gdXNlckJ1ZjtcbiAgICAgIH1cblxuICAgICAgc29ja2V0Ll9oYW5kbGUudXNlVXNlckJ1ZmZlcih1c2VyQnVmKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gX2xvb2t1cEFuZENvbm5lY3QoXG4gIHNlbGY6IFNvY2tldCxcbiAgb3B0aW9uczogVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMsXG4pIHtcbiAgY29uc3QgeyBsb2NhbEFkZHJlc3MsIGxvY2FsUG9ydCB9ID0gb3B0aW9ucztcbiAgY29uc3QgaG9zdCA9IG9wdGlvbnMuaG9zdCB8fCBcImxvY2FsaG9zdFwiO1xuICBsZXQgeyBwb3J0IH0gPSBvcHRpb25zO1xuXG4gIGlmIChsb2NhbEFkZHJlc3MgJiYgIWlzSVAobG9jYWxBZGRyZXNzKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9JUF9BRERSRVNTKGxvY2FsQWRkcmVzcyk7XG4gIH1cblxuICBpZiAobG9jYWxQb3J0KSB7XG4gICAgdmFsaWRhdGVOdW1iZXIobG9jYWxQb3J0LCBcIm9wdGlvbnMubG9jYWxQb3J0XCIpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwb3J0ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgaWYgKHR5cGVvZiBwb3J0ICE9PSBcIm51bWJlclwiICYmIHR5cGVvZiBwb3J0ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXG4gICAgICAgIFwib3B0aW9ucy5wb3J0XCIsXG4gICAgICAgIFtcIm51bWJlclwiLCBcInN0cmluZ1wiXSxcbiAgICAgICAgcG9ydCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVQb3J0KHBvcnQpO1xuICB9XG5cbiAgcG9ydCB8PSAwO1xuXG4gIC8vIElmIGhvc3QgaXMgYW4gSVAsIHNraXAgcGVyZm9ybWluZyBhIGxvb2t1cFxuICBjb25zdCBhZGRyZXNzVHlwZSA9IGlzSVAoaG9zdCk7XG4gIGlmIChhZGRyZXNzVHlwZSkge1xuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKHNlbGZbYXN5bmNJZFN5bWJvbF0sIG5leHRUaWNrLCAoKSA9PiB7XG4gICAgICBpZiAoc2VsZi5jb25uZWN0aW5nKSB7XG4gICAgICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICAgICAgICAgIHNlbGZbYXN5bmNJZFN5bWJvbF0sXG4gICAgICAgICAgX2ludGVybmFsQ29ubmVjdCxcbiAgICAgICAgICBzZWxmLFxuICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgcG9ydCxcbiAgICAgICAgICBhZGRyZXNzVHlwZSxcbiAgICAgICAgICBsb2NhbEFkZHJlc3MsXG4gICAgICAgICAgbG9jYWxQb3J0LFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMubG9va3VwICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YWxpZGF0ZUZ1bmN0aW9uKG9wdGlvbnMubG9va3VwLCBcIm9wdGlvbnMubG9va3VwXCIpO1xuICB9XG5cbiAgY29uc3QgZG5zT3B0cyA9IHtcbiAgICBmYW1pbHk6IG9wdGlvbnMuZmFtaWx5LFxuICAgIGhpbnRzOiBvcHRpb25zLmhpbnRzIHx8IDAsXG4gIH07XG5cbiAgaWYgKFxuICAgICFpc1dpbmRvd3MgJiZcbiAgICBkbnNPcHRzLmZhbWlseSAhPT0gNCAmJlxuICAgIGRuc09wdHMuZmFtaWx5ICE9PSA2ICYmXG4gICAgZG5zT3B0cy5oaW50cyA9PT0gMFxuICApIHtcbiAgICBkbnNPcHRzLmhpbnRzID0gQUREUkNPTkZJRztcbiAgfVxuXG4gIGRlYnVnKFwiY29ubmVjdDogZmluZCBob3N0XCIsIGhvc3QpO1xuICBkZWJ1ZyhcImNvbm5lY3Q6IGRucyBvcHRpb25zXCIsIGRuc09wdHMpO1xuICBzZWxmLl9ob3N0ID0gaG9zdDtcbiAgY29uc3QgbG9va3VwID0gb3B0aW9ucy5sb29rdXAgfHwgZG5zTG9va3VwO1xuXG4gIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKHNlbGZbYXN5bmNJZFN5bWJvbF0sIGZ1bmN0aW9uICgpIHtcbiAgICBsb29rdXAoXG4gICAgICBob3N0LFxuICAgICAgZG5zT3B0cyxcbiAgICAgIGZ1bmN0aW9uIGVtaXRMb29rdXAoXG4gICAgICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgICAgICBpcDogc3RyaW5nLFxuICAgICAgICBhZGRyZXNzVHlwZTogbnVtYmVyLFxuICAgICAgKSB7XG4gICAgICAgIHNlbGYuZW1pdChcImxvb2t1cFwiLCBlcnIsIGlwLCBhZGRyZXNzVHlwZSwgaG9zdCk7XG5cbiAgICAgICAgLy8gSXQncyBwb3NzaWJsZSB3ZSB3ZXJlIGRlc3Ryb3llZCB3aGlsZSBsb29raW5nIHRoaXMgdXAuXG4gICAgICAgIC8vIFhYWCBpdCB3b3VsZCBiZSBncmVhdCBpZiB3ZSBjb3VsZCBjYW5jZWwgdGhlIHByb21pc2UgcmV0dXJuZWQgYnlcbiAgICAgICAgLy8gdGhlIGxvb2sgdXAuXG4gICAgICAgIGlmICghc2VsZi5jb25uZWN0aW5nKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIC8vIG5ldC5jcmVhdGVDb25uZWN0aW9uKCkgY3JlYXRlcyBhIG5ldC5Tb2NrZXQgb2JqZWN0IGFuZCBpbW1lZGlhdGVseVxuICAgICAgICAgIC8vIGNhbGxzIG5ldC5Tb2NrZXQuY29ubmVjdCgpIG9uIGl0ICh0aGF0J3MgdXMpLiBUaGVyZSBhcmUgbm8gZXZlbnRcbiAgICAgICAgICAvLyBsaXN0ZW5lcnMgcmVnaXN0ZXJlZCB5ZXQgc28gZGVmZXIgdGhlIGVycm9yIGV2ZW50IHRvIHRoZSBuZXh0IHRpY2suXG4gICAgICAgICAgbmV4dFRpY2soX2Nvbm5lY3RFcnJvck5ULCBzZWxmLCBlcnIpO1xuICAgICAgICB9IGVsc2UgaWYgKCFpc0lQKGlwKSkge1xuICAgICAgICAgIGVyciA9IG5ldyBFUlJfSU5WQUxJRF9JUF9BRERSRVNTKGlwKTtcblxuICAgICAgICAgIG5leHRUaWNrKF9jb25uZWN0RXJyb3JOVCwgc2VsZiwgZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmIChhZGRyZXNzVHlwZSAhPT0gNCAmJiBhZGRyZXNzVHlwZSAhPT0gNikge1xuICAgICAgICAgIGVyciA9IG5ldyBFUlJfSU5WQUxJRF9BRERSRVNTX0ZBTUlMWShcbiAgICAgICAgICAgIGAke2FkZHJlc3NUeXBlfWAsXG4gICAgICAgICAgICBvcHRpb25zLmhvc3QhLFxuICAgICAgICAgICAgb3B0aW9ucy5wb3J0LFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBuZXh0VGljayhfY29ubmVjdEVycm9yTlQsIHNlbGYsIGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZi5fdW5yZWZUaW1lcigpO1xuXG4gICAgICAgICAgZGVmYXVsdFRyaWdnZXJBc3luY0lkU2NvcGUoXG4gICAgICAgICAgICBzZWxmW2FzeW5jSWRTeW1ib2xdLFxuICAgICAgICAgICAgX2ludGVybmFsQ29ubmVjdCxcbiAgICAgICAgICAgIHNlbGYsXG4gICAgICAgICAgICBpcCxcbiAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICBhZGRyZXNzVHlwZSxcbiAgICAgICAgICAgIGxvY2FsQWRkcmVzcyxcbiAgICAgICAgICAgIGxvY2FsUG9ydCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfYWZ0ZXJTaHV0ZG93bih0aGlzOiBTaHV0ZG93bldyYXA8VENQPikge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCBzZWxmOiBhbnkgPSB0aGlzLmhhbmRsZVtvd25lclN5bWJvbF07XG5cbiAgZGVidWcoXCJhZnRlclNodXRkb3duIGRlc3Ryb3llZD0lalwiLCBzZWxmLmRlc3Ryb3llZCwgc2VsZi5fcmVhZGFibGVTdGF0ZSk7XG5cbiAgdGhpcy5jYWxsYmFjaygpO1xufVxuXG5mdW5jdGlvbiBfZW1pdENsb3NlTlQoczogU29ja2V0IHwgU2VydmVyKSB7XG4gIGRlYnVnKFwiU0VSVkVSOiBlbWl0IGNsb3NlXCIpO1xuICBzLmVtaXQoXCJjbG9zZVwiKTtcbn1cblxuLyoqXG4gKiBUaGlzIGNsYXNzIGlzIGFuIGFic3RyYWN0aW9uIG9mIGEgVENQIHNvY2tldCBvciBhIHN0cmVhbWluZyBgSVBDYCBlbmRwb2ludFxuICogKHVzZXMgbmFtZWQgcGlwZXMgb24gV2luZG93cywgYW5kIFVuaXggZG9tYWluIHNvY2tldHMgb3RoZXJ3aXNlKS4gSXQgaXMgYWxzb1xuICogYW4gYEV2ZW50RW1pdHRlcmAuXG4gKlxuICogQSBgbmV0LlNvY2tldGAgY2FuIGJlIGNyZWF0ZWQgYnkgdGhlIHVzZXIgYW5kIHVzZWQgZGlyZWN0bHkgdG8gaW50ZXJhY3Qgd2l0aFxuICogYSBzZXJ2ZXIuIEZvciBleGFtcGxlLCBpdCBpcyByZXR1cm5lZCBieSBgY3JlYXRlQ29ubmVjdGlvbmAsXG4gKiBzbyB0aGUgdXNlciBjYW4gdXNlIGl0IHRvIHRhbGsgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBJdCBjYW4gYWxzbyBiZSBjcmVhdGVkIGJ5IE5vZGUuanMgYW5kIHBhc3NlZCB0byB0aGUgdXNlciB3aGVuIGEgY29ubmVjdGlvblxuICogaXMgcmVjZWl2ZWQuIEZvciBleGFtcGxlLCBpdCBpcyBwYXNzZWQgdG8gdGhlIGxpc3RlbmVycyBvZiBhIGBcImNvbm5lY3Rpb25cImAgZXZlbnQgZW1pdHRlZCBvbiBhIGBTZXJ2ZXJgLCBzbyB0aGUgdXNlciBjYW4gdXNlXG4gKiBpdCB0byBpbnRlcmFjdCB3aXRoIHRoZSBjbGllbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTb2NrZXQgZXh0ZW5kcyBEdXBsZXgge1xuICAvLyBQcm9ibGVtIHdpdGggdGhpcyBpcyB0aGF0IHVzZXJzIGNhbiBzdXBwbHkgdGhlaXIgb3duIGhhbmRsZSwgdGhhdCBtYXkgbm90XG4gIC8vIGhhdmUgYGhhbmRsZS5nZXRBc3luY0lkKClgLiBJbiB0aGlzIGNhc2UgYW4gYFthc3luY0lkU3ltYm9sXWAgc2hvdWxkXG4gIC8vIHByb2JhYmx5IGJlIHN1cHBsaWVkIGJ5IGBhc3luY19ob29rc2AuXG4gIFthc3luY0lkU3ltYm9sXSA9IC0xO1xuXG4gIFtrSGFuZGxlXTogSGFuZGxlIHwgbnVsbCA9IG51bGw7XG4gIFtrU2V0Tm9EZWxheV0gPSBmYWxzZTtcbiAgW2tMYXN0V3JpdGVRdWV1ZVNpemVdID0gMDtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgW2tUaW1lb3V0XTogYW55ID0gbnVsbDtcbiAgW2tCdWZmZXJdOiBVaW50OEFycmF5IHwgYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuICBba0J1ZmZlckNiXTogT25SZWFkT3B0aW9uc1tcImNhbGxiYWNrXCJdIHwgbnVsbCA9IG51bGw7XG4gIFtrQnVmZmVyR2VuXTogKCgpID0+IFVpbnQ4QXJyYXkpIHwgbnVsbCA9IG51bGw7XG5cbiAgLy8gVXNlZCBhZnRlciBgLmRlc3Ryb3koKWBcbiAgW2tCeXRlc1JlYWRdID0gMDtcbiAgW2tCeXRlc1dyaXR0ZW5dID0gMDtcblxuICAvLyBSZXNlcnZlZCBwcm9wZXJ0aWVzXG4gIHNlcnZlciA9IG51bGw7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIF9zZXJ2ZXI6IGFueSA9IG51bGw7XG5cbiAgX3BlZXJuYW1lPzogQWRkcmVzc0luZm8gfCBSZWNvcmQ8c3RyaW5nLCBuZXZlcj47XG4gIF9zb2NrbmFtZT86IEFkZHJlc3NJbmZvIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+O1xuICBfcGVuZGluZ0RhdGE6IFVpbnQ4QXJyYXkgfCBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgX3BlbmRpbmdFbmNvZGluZyA9IFwiXCI7XG4gIF9ob3N0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX3BhcmVudDogYW55ID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTb2NrZXRPcHRpb25zIHwgbnVtYmVyKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAvLyBMZWdhY3kgaW50ZXJmYWNlLlxuICAgICAgb3B0aW9ucyA9IHsgZmQ6IG9wdGlvbnMgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHsgLi4ub3B0aW9ucyB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgdG8gKm5vdCogYWxsb3dpbmcgaGFsZiBvcGVuIHNvY2tldHMuXG4gICAgb3B0aW9ucy5hbGxvd0hhbGZPcGVuID0gQm9vbGVhbihvcHRpb25zLmFsbG93SGFsZk9wZW4pO1xuICAgIC8vIEZvciBiYWNrd2FyZHMgY29tcGF0IGRvIG5vdCBlbWl0IGNsb3NlIG9uIGRlc3Ryb3kuXG4gICAgb3B0aW9ucy5lbWl0Q2xvc2UgPSBmYWxzZTtcbiAgICBvcHRpb25zLmF1dG9EZXN0cm95ID0gdHJ1ZTtcbiAgICAvLyBIYW5kbGUgc3RyaW5ncyBkaXJlY3RseS5cbiAgICBvcHRpb25zLmRlY29kZVN0cmluZ3MgPSBmYWxzZTtcblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgaWYgKG9wdGlvbnMuaGFuZGxlKSB7XG4gICAgICB0aGlzLl9oYW5kbGUgPSBvcHRpb25zLmhhbmRsZTtcbiAgICAgIHRoaXNbYXN5bmNJZFN5bWJvbF0gPSBfZ2V0TmV3QXN5bmNJZCh0aGlzLl9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5mZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy82NTI5XG4gICAgICBub3RJbXBsZW1lbnRlZChcIm5ldC5Tb2NrZXQucHJvdG90eXBlLmNvbnN0cnVjdG9yIHdpdGggZmQgb3B0aW9uXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IG9ucmVhZCA9IG9wdGlvbnMub25yZWFkO1xuXG4gICAgaWYgKFxuICAgICAgb25yZWFkICE9PSBudWxsICYmXG4gICAgICB0eXBlb2Ygb25yZWFkID09PSBcIm9iamVjdFwiICYmXG4gICAgICAoaXNVaW50OEFycmF5KG9ucmVhZC5idWZmZXIpIHx8IHR5cGVvZiBvbnJlYWQuYnVmZmVyID09PSBcImZ1bmN0aW9uXCIpICYmXG4gICAgICB0eXBlb2Ygb25yZWFkLmNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgIGlmICh0eXBlb2Ygb25yZWFkLmJ1ZmZlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRoaXNba0J1ZmZlcl0gPSB0cnVlO1xuICAgICAgICB0aGlzW2tCdWZmZXJHZW5dID0gb25yZWFkLmJ1ZmZlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNba0J1ZmZlcl0gPSBvbnJlYWQuYnVmZmVyO1xuICAgICAgfVxuXG4gICAgICB0aGlzW2tCdWZmZXJDYl0gPSBvbnJlYWQuY2FsbGJhY2s7XG4gICAgfVxuXG4gICAgdGhpcy5vbihcImVuZFwiLCBfb25SZWFkYWJsZVN0cmVhbUVuZCk7XG5cbiAgICBfaW5pdFNvY2tldEhhbmRsZSh0aGlzKTtcblxuICAgIC8vIElmIHdlIGhhdmUgYSBoYW5kbGUsIHRoZW4gc3RhcnQgdGhlIGZsb3cgb2YgZGF0YSBpbnRvIHRoZVxuICAgIC8vIGJ1ZmZlci4gSWYgbm90LCB0aGVuIHRoaXMgd2lsbCBoYXBwZW4gd2hlbiB3ZSBjb25uZWN0LlxuICAgIGlmICh0aGlzLl9oYW5kbGUgJiYgb3B0aW9ucy5yZWFkYWJsZSAhPT0gZmFsc2UpIHtcbiAgICAgIGlmIChvcHRpb25zLnBhdXNlT25DcmVhdGUpIHtcbiAgICAgICAgLy8gU3RvcCB0aGUgaGFuZGxlIGZyb20gcmVhZGluZyBhbmQgcGF1c2UgdGhlIHN0cmVhbVxuICAgICAgICB0aGlzLl9oYW5kbGUucmVhZGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYW5kbGUucmVhZFN0b3AoKTtcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBUaGlzIHByb3BlcnR5IHNob3VsZG4ndCBiZSBtb2RpZmllZFxuICAgICAgICB0aGlzLnJlYWRhYmxlRmxvd2luZyA9IGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICghb3B0aW9ucy5tYW51YWxTdGFydCkge1xuICAgICAgICB0aGlzLnJlYWQoMCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlIGEgY29ubmVjdGlvbiBvbiBhIGdpdmVuIHNvY2tldC5cbiAgICpcbiAgICogUG9zc2libGUgc2lnbmF0dXJlczpcbiAgICpcbiAgICogLSBgc29ja2V0LmNvbm5lY3Qob3B0aW9uc1ssIGNvbm5lY3RMaXN0ZW5lcl0pYFxuICAgKiAtIGBzb2NrZXQuY29ubmVjdChwYXRoWywgY29ubmVjdExpc3RlbmVyXSlgIGZvciBgSVBDYCBjb25uZWN0aW9ucy5cbiAgICogLSBgc29ja2V0LmNvbm5lY3QocG9ydFssIGhvc3RdWywgY29ubmVjdExpc3RlbmVyXSlgIGZvciBUQ1AgY29ubmVjdGlvbnMuXG4gICAqIC0gUmV0dXJuczogYG5ldC5Tb2NrZXRgIFRoZSBzb2NrZXQgaXRzZWxmLlxuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGFzeW5jaHJvbm91cy4gV2hlbiB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZCwgdGhlIGBcImNvbm5lY3RcImAgZXZlbnQgd2lsbCBiZSBlbWl0dGVkLiBJZiB0aGVyZSBpcyBhIHByb2JsZW0gY29ubmVjdGluZyxcbiAgICogaW5zdGVhZCBvZiBhIGBcImNvbm5lY3RcImAgZXZlbnQsIGFuIGBcImVycm9yXCJgIGV2ZW50IHdpbGwgYmUgZW1pdHRlZCB3aXRoXG4gICAqIHRoZSBlcnJvciBwYXNzZWQgdG8gdGhlIGBcImVycm9yXCJgIGxpc3RlbmVyLlxuICAgKiBUaGUgbGFzdCBwYXJhbWV0ZXIgYGNvbm5lY3RMaXN0ZW5lcmAsIGlmIHN1cHBsaWVkLCB3aWxsIGJlIGFkZGVkIGFzIGEgbGlzdGVuZXJcbiAgICogZm9yIHRoZSBgXCJjb25uZWN0XCJgIGV2ZW50ICoqb25jZSoqLlxuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBvbmx5IGJlIHVzZWQgZm9yIHJlY29ubmVjdGluZyBhIHNvY2tldCBhZnRlciBgXCJjbG9zZVwiYCBoYXMgYmVlbiBlbWl0dGVkIG9yIG90aGVyd2lzZSBpdCBtYXkgbGVhZCB0byB1bmRlZmluZWRcbiAgICogYmVoYXZpb3IuXG4gICAqL1xuICBjb25uZWN0KFxuICAgIG9wdGlvbnM6IFNvY2tldENvbm5lY3RPcHRpb25zIHwgTm9ybWFsaXplZEFyZ3MsXG4gICAgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyLFxuICApOiB0aGlzO1xuICBjb25uZWN0KFxuICAgIHBvcnQ6IG51bWJlcixcbiAgICBob3N0OiBzdHJpbmcsXG4gICAgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyLFxuICApOiB0aGlzO1xuICBjb25uZWN0KHBvcnQ6IG51bWJlciwgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyKTogdGhpcztcbiAgY29ubmVjdChwYXRoOiBzdHJpbmcsIGNvbm5lY3Rpb25MaXN0ZW5lcj86IENvbm5lY3Rpb25MaXN0ZW5lcik6IHRoaXM7XG4gIGNvbm5lY3QoLi4uYXJnczogdW5rbm93bltdKTogdGhpcyB7XG4gICAgbGV0IG5vcm1hbGl6ZWQ6IE5vcm1hbGl6ZWRBcmdzO1xuXG4gICAgLy8gSWYgcGFzc2VkIGFuIGFycmF5LCBpdCdzIHRyZWF0ZWQgYXMgYW4gYXJyYXkgb2YgYXJndW1lbnRzIHRoYXQgaGF2ZVxuICAgIC8vIGFscmVhZHkgYmVlbiBub3JtYWxpemVkIChzbyB3ZSBkb24ndCBub3JtYWxpemUgbW9yZSB0aGFuIG9uY2UpLiBUaGlzIGhhc1xuICAgIC8vIGJlZW4gc29sdmVkIGJlZm9yZSBpbiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8xMjM0MiwgYnV0IHdhc1xuICAgIC8vIHJldmVydGVkIGFzIGl0IGhhZCB1bmludGVuZGVkIHNpZGUgZWZmZWN0cy5cbiAgICBpZiAoXG4gICAgICBBcnJheS5pc0FycmF5KGFyZ3NbMF0pICYmXG4gICAgICAoYXJnc1swXSBhcyB1bmtub3duIGFzIE5vcm1hbGl6ZWRBcmdzKVtub3JtYWxpemVkQXJnc1N5bWJvbF1cbiAgICApIHtcbiAgICAgIG5vcm1hbGl6ZWQgPSBhcmdzWzBdIGFzIHVua25vd24gYXMgTm9ybWFsaXplZEFyZ3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vcm1hbGl6ZWQgPSBfbm9ybWFsaXplQXJncyhhcmdzKTtcbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplZFswXTtcbiAgICBjb25zdCBjYiA9IG5vcm1hbGl6ZWRbMV07XG5cbiAgICAvLyBgb3B0aW9ucy5wb3J0ID09PSBudWxsYCB3aWxsIGJlIGNoZWNrZWQgbGF0ZXIuXG4gICAgaWYgKFxuICAgICAgKG9wdGlvbnMgYXMgVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMpLnBvcnQgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgKG9wdGlvbnMgYXMgSXBjU29ja2V0Q29ubmVjdE9wdGlvbnMpLnBhdGggPT0gbnVsbFxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVSUl9NSVNTSU5HX0FSR1MoW1wib3B0aW9uc1wiLCBcInBvcnRcIiwgXCJwYXRoXCJdKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy53cml0ZSAhPT0gU29ja2V0LnByb3RvdHlwZS53cml0ZSkge1xuICAgICAgdGhpcy53cml0ZSA9IFNvY2tldC5wcm90b3R5cGUud3JpdGU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSB7XG4gICAgICB0aGlzLl9oYW5kbGUgPSBudWxsO1xuICAgICAgdGhpcy5fcGVlcm5hbWUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9zb2NrbmFtZSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCB7IHBhdGggfSA9IG9wdGlvbnMgYXMgSXBjTmV0Q29ubmVjdE9wdGlvbnM7XG4gICAgY29uc3QgcGlwZSA9IF9pc1BpcGUob3B0aW9ucyk7XG4gICAgZGVidWcoXCJwaXBlXCIsIHBpcGUsIHBhdGgpO1xuXG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIHRoaXMuX2hhbmRsZSA9IHBpcGVcbiAgICAgICAgPyBuZXcgUGlwZShQaXBlQ29uc3RhbnRzLlNPQ0tFVClcbiAgICAgICAgOiBuZXcgVENQKFRDUENvbnN0YW50cy5TT0NLRVQpO1xuXG4gICAgICBfaW5pdFNvY2tldEhhbmRsZSh0aGlzKTtcbiAgICB9XG5cbiAgICBpZiAoY2IgIT09IG51bGwpIHtcbiAgICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgY2IpO1xuICAgIH1cblxuICAgIHRoaXMuX3VucmVmVGltZXIoKTtcblxuICAgIHRoaXMuY29ubmVjdGluZyA9IHRydWU7XG5cbiAgICBpZiAocGlwZSkge1xuICAgICAgdmFsaWRhdGVTdHJpbmcocGF0aCwgXCJvcHRpb25zLnBhdGhcIik7XG4gICAgICBkZWZhdWx0VHJpZ2dlckFzeW5jSWRTY29wZShcbiAgICAgICAgdGhpc1thc3luY0lkU3ltYm9sXSxcbiAgICAgICAgX2ludGVybmFsQ29ubmVjdCxcbiAgICAgICAgdGhpcyxcbiAgICAgICAgcGF0aCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIF9sb29rdXBBbmRDb25uZWN0KHRoaXMsIG9wdGlvbnMgYXMgVGNwU29ja2V0Q29ubmVjdE9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhdXNlcyB0aGUgcmVhZGluZyBvZiBkYXRhLiBUaGF0IGlzLCBgXCJkYXRhXCJgIGV2ZW50cyB3aWxsIG5vdCBiZSBlbWl0dGVkLlxuICAgKiBVc2VmdWwgdG8gdGhyb3R0bGUgYmFjayBhbiB1cGxvYWQuXG4gICAqXG4gICAqIEByZXR1cm4gVGhlIHNvY2tldCBpdHNlbGYuXG4gICAqL1xuICBvdmVycmlkZSBwYXVzZSgpOiB0aGlzIHtcbiAgICBpZiAoXG4gICAgICB0aGlzW2tCdWZmZXJdICYmXG4gICAgICAhdGhpcy5jb25uZWN0aW5nICYmXG4gICAgICB0aGlzLl9oYW5kbGUgJiZcbiAgICAgIHRoaXMuX2hhbmRsZS5yZWFkaW5nXG4gICAgKSB7XG4gICAgICB0aGlzLl9oYW5kbGUucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgICBpZiAoIXRoaXMuZGVzdHJveWVkKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IHRoaXMuX2hhbmRsZS5yZWFkU3RvcCgpO1xuXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICB0aGlzLmRlc3Ryb3koZXJybm9FeGNlcHRpb24oZXJyLCBcInJlYWRcIikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucGF1c2UuY2FsbCh0aGlzKSBhcyB1bmtub3duIGFzIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVzdW1lcyByZWFkaW5nIGFmdGVyIGEgY2FsbCB0byBgc29ja2V0LnBhdXNlKClgLlxuICAgKlxuICAgKiBAcmV0dXJuIFRoZSBzb2NrZXQgaXRzZWxmLlxuICAgKi9cbiAgb3ZlcnJpZGUgcmVzdW1lKCk6IHRoaXMge1xuICAgIGlmIChcbiAgICAgIHRoaXNba0J1ZmZlcl0gJiZcbiAgICAgICF0aGlzLmNvbm5lY3RpbmcgJiZcbiAgICAgIHRoaXMuX2hhbmRsZSAmJlxuICAgICAgIXRoaXMuX2hhbmRsZS5yZWFkaW5nXG4gICAgKSB7XG4gICAgICBfdHJ5UmVhZFN0YXJ0KHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiBEdXBsZXgucHJvdG90eXBlLnJlc3VtZS5jYWxsKHRoaXMpIGFzIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgc29ja2V0IHRvIHRpbWVvdXQgYWZ0ZXIgYHRpbWVvdXRgIG1pbGxpc2Vjb25kcyBvZiBpbmFjdGl2aXR5IG9uXG4gICAqIHRoZSBzb2NrZXQuIEJ5IGRlZmF1bHQgYG5ldC5Tb2NrZXRgIGRvIG5vdCBoYXZlIGEgdGltZW91dC5cbiAgICpcbiAgICogV2hlbiBhbiBpZGxlIHRpbWVvdXQgaXMgdHJpZ2dlcmVkIHRoZSBzb2NrZXQgd2lsbCByZWNlaXZlIGEgYFwidGltZW91dFwiYCBldmVudCBidXQgdGhlIGNvbm5lY3Rpb24gd2lsbCBub3QgYmUgc2V2ZXJlZC4gVGhlIHVzZXIgbXVzdCBtYW51YWxseSBjYWxsIGBzb2NrZXQuZW5kKClgIG9yIGBzb2NrZXQuZGVzdHJveSgpYCB0b1xuICAgKiBlbmQgdGhlIGNvbm5lY3Rpb24uXG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9ub2RlL21vZHVsZS50c1wiO1xuICAgKlxuICAgKiBjb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuICAgKiBjb25zdCBuZXQgPSByZXF1aXJlKFwibmV0XCIpO1xuICAgKlxuICAgKiBjb25zdCBzb2NrZXQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgKiBzb2NrZXQuc2V0VGltZW91dCgzMDAwKTtcbiAgICogc29ja2V0Lm9uKFwidGltZW91dFwiLCAoKSA9PiB7XG4gICAqICAgY29uc29sZS5sb2coXCJzb2NrZXQgdGltZW91dFwiKTtcbiAgICogICBzb2NrZXQuZW5kKCk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogSWYgYHRpbWVvdXRgIGlzIGAwYCwgdGhlbiB0aGUgZXhpc3RpbmcgaWRsZSB0aW1lb3V0IGlzIGRpc2FibGVkLlxuICAgKlxuICAgKiBUaGUgb3B0aW9uYWwgYGNhbGxiYWNrYCBwYXJhbWV0ZXIgd2lsbCBiZSBhZGRlZCBhcyBhIG9uZS10aW1lIGxpc3RlbmVyIGZvciB0aGUgYFwidGltZW91dFwiYCBldmVudC5cbiAgICogQHJldHVybiBUaGUgc29ja2V0IGl0c2VsZi5cbiAgICovXG4gIHNldFRpbWVvdXQgPSBzZXRTdHJlYW1UaW1lb3V0O1xuXG4gIC8qKlxuICAgKiBFbmFibGUvZGlzYWJsZSB0aGUgdXNlIG9mIE5hZ2xlJ3MgYWxnb3JpdGhtLlxuICAgKlxuICAgKiBXaGVuIGEgVENQIGNvbm5lY3Rpb24gaXMgY3JlYXRlZCwgaXQgd2lsbCBoYXZlIE5hZ2xlJ3MgYWxnb3JpdGhtIGVuYWJsZWQuXG4gICAqXG4gICAqIE5hZ2xlJ3MgYWxnb3JpdGhtIGRlbGF5cyBkYXRhIGJlZm9yZSBpdCBpcyBzZW50IHZpYSB0aGUgbmV0d29yay4gSXQgYXR0ZW1wdHNcbiAgICogdG8gb3B0aW1pemUgdGhyb3VnaHB1dCBhdCB0aGUgZXhwZW5zZSBvZiBsYXRlbmN5LlxuICAgKlxuICAgKiBQYXNzaW5nIGB0cnVlYCBmb3IgYG5vRGVsYXlgIG9yIG5vdCBwYXNzaW5nIGFuIGFyZ3VtZW50IHdpbGwgZGlzYWJsZSBOYWdsZSdzXG4gICAqIGFsZ29yaXRobSBmb3IgdGhlIHNvY2tldC4gUGFzc2luZyBgZmFsc2VgIGZvciBgbm9EZWxheWAgd2lsbCBlbmFibGUgTmFnbGUnc1xuICAgKiBhbGdvcml0aG0uXG4gICAqXG4gICAqIEBwYXJhbSBub0RlbGF5XG4gICAqIEByZXR1cm4gVGhlIHNvY2tldCBpdHNlbGYuXG4gICAqL1xuICBzZXROb0RlbGF5KG5vRGVsYXk/OiBib29sZWFuKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIHRoaXMub25jZShcbiAgICAgICAgXCJjb25uZWN0XCIsXG4gICAgICAgIG5vRGVsYXkgPyB0aGlzLnNldE5vRGVsYXkgOiAoKSA9PiB0aGlzLnNldE5vRGVsYXkobm9EZWxheSksXG4gICAgICApO1xuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eTogYXNzdW1lIHRydWUgd2hlbiBgbm9EZWxheWAgaXMgb21pdHRlZFxuICAgIGNvbnN0IG5ld1ZhbHVlID0gbm9EZWxheSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6ICEhbm9EZWxheTtcblxuICAgIGlmIChcbiAgICAgIFwic2V0Tm9EZWxheVwiIGluIHRoaXMuX2hhbmRsZSAmJlxuICAgICAgdGhpcy5faGFuZGxlLnNldE5vRGVsYXkgJiZcbiAgICAgIG5ld1ZhbHVlICE9PSB0aGlzW2tTZXROb0RlbGF5XVxuICAgICkge1xuICAgICAgdGhpc1trU2V0Tm9EZWxheV0gPSBuZXdWYWx1ZTtcbiAgICAgIHRoaXMuX2hhbmRsZS5zZXROb0RlbGF5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmFibGUvZGlzYWJsZSBrZWVwLWFsaXZlIGZ1bmN0aW9uYWxpdHksIGFuZCBvcHRpb25hbGx5IHNldCB0aGUgaW5pdGlhbFxuICAgKiBkZWxheSBiZWZvcmUgdGhlIGZpcnN0IGtlZXBhbGl2ZSBwcm9iZSBpcyBzZW50IG9uIGFuIGlkbGUgc29ja2V0LlxuICAgKlxuICAgKiBTZXQgYGluaXRpYWxEZWxheWAgKGluIG1pbGxpc2Vjb25kcykgdG8gc2V0IHRoZSBkZWxheSBiZXR3ZWVuIHRoZSBsYXN0XG4gICAqIGRhdGEgcGFja2V0IHJlY2VpdmVkIGFuZCB0aGUgZmlyc3Qga2VlcGFsaXZlIHByb2JlLiBTZXR0aW5nIGAwYCBmb3JgaW5pdGlhbERlbGF5YCB3aWxsIGxlYXZlIHRoZSB2YWx1ZSB1bmNoYW5nZWQgZnJvbSB0aGUgZGVmYXVsdFxuICAgKiAob3IgcHJldmlvdXMpIHNldHRpbmcuXG4gICAqXG4gICAqIEVuYWJsaW5nIHRoZSBrZWVwLWFsaXZlIGZ1bmN0aW9uYWxpdHkgd2lsbCBzZXQgdGhlIGZvbGxvd2luZyBzb2NrZXQgb3B0aW9uczpcbiAgICpcbiAgICogLSBgU09fS0VFUEFMSVZFPTFgXG4gICAqIC0gYFRDUF9LRUVQSURMRT1pbml0aWFsRGVsYXlgXG4gICAqIC0gYFRDUF9LRUVQQ05UPTEwYFxuICAgKiAtIGBUQ1BfS0VFUElOVFZMPTFgXG4gICAqXG4gICAqIEBwYXJhbSBlbmFibGVcbiAgICogQHBhcmFtIGluaXRpYWxEZWxheVxuICAgKiBAcmV0dXJuIFRoZSBzb2NrZXQgaXRzZWxmLlxuICAgKi9cbiAgc2V0S2VlcEFsaXZlKGVuYWJsZTogYm9vbGVhbiwgaW5pdGlhbERlbGF5PzogbnVtYmVyKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgKCkgPT4gdGhpcy5zZXRLZWVwQWxpdmUoZW5hYmxlLCBpbml0aWFsRGVsYXkpKTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKFwic2V0S2VlcEFsaXZlXCIgaW4gdGhpcy5faGFuZGxlKSB7XG4gICAgICB0aGlzLl9oYW5kbGUuc2V0S2VlcEFsaXZlKGVuYWJsZSwgfn4oaW5pdGlhbERlbGF5ISAvIDEwMDApKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBib3VuZCBgYWRkcmVzc2AsIHRoZSBhZGRyZXNzIGBmYW1pbHlgIG5hbWUgYW5kIGBwb3J0YCBvZiB0aGVcbiAgICogc29ja2V0IGFzIHJlcG9ydGVkIGJ5IHRoZSBvcGVyYXRpbmcgc3lzdGVtOmB7IHBvcnQ6IDEyMzQ2LCBmYW1pbHk6IFwiSVB2NFwiLCBhZGRyZXNzOiBcIjEyNy4wLjAuMVwiIH1gXG4gICAqL1xuICBhZGRyZXNzKCk6IEFkZHJlc3NJbmZvIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+IHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0c29ja25hbWUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsaW5nIGB1bnJlZigpYCBvbiBhIHNvY2tldCB3aWxsIGFsbG93IHRoZSBwcm9ncmFtIHRvIGV4aXQgaWYgdGhpcyBpcyB0aGUgb25seVxuICAgKiBhY3RpdmUgc29ja2V0IGluIHRoZSBldmVudCBzeXN0ZW0uIElmIHRoZSBzb2NrZXQgaXMgYWxyZWFkeSBgdW5yZWZgZWQgY2FsbGluZ2B1bnJlZigpYCBhZ2FpbiB3aWxsIGhhdmUgbm8gZWZmZWN0LlxuICAgKlxuICAgKiBAcmV0dXJuIFRoZSBzb2NrZXQgaXRzZWxmLlxuICAgKi9cbiAgdW5yZWYoKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgdGhpcy51bnJlZik7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5faGFuZGxlLnVucmVmID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRoaXMuX2hhbmRsZS51bnJlZigpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wcG9zaXRlIG9mIGB1bnJlZigpYCwgY2FsbGluZyBgcmVmKClgIG9uIGEgcHJldmlvdXNseSBgdW5yZWZgZWQgc29ja2V0IHdpbGxfbm90XyBsZXQgdGhlIHByb2dyYW0gZXhpdCBpZiBpdCdzIHRoZSBvbmx5IHNvY2tldCBsZWZ0ICh0aGUgZGVmYXVsdCBiZWhhdmlvcikuXG4gICAqIElmIHRoZSBzb2NrZXQgaXMgYHJlZmBlZCBjYWxsaW5nIGByZWZgIGFnYWluIHdpbGwgaGF2ZSBubyBlZmZlY3QuXG4gICAqXG4gICAqIEByZXR1cm4gVGhlIHNvY2tldCBpdHNlbGYuXG4gICAqL1xuICByZWYoKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgdGhpcy5yZWYpO1xuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRoaXMuX2hhbmRsZS5yZWYgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhpcy5faGFuZGxlLnJlZigpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgcHJvcGVydHkgc2hvd3MgdGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGJ1ZmZlcmVkIGZvciB3cml0aW5nLiBUaGUgYnVmZmVyXG4gICAqIG1heSBjb250YWluIHN0cmluZ3Mgd2hvc2UgbGVuZ3RoIGFmdGVyIGVuY29kaW5nIGlzIG5vdCB5ZXQga25vd24uIFNvIHRoaXMgbnVtYmVyXG4gICAqIGlzIG9ubHkgYW4gYXBwcm94aW1hdGlvbiBvZiB0aGUgbnVtYmVyIG9mIGJ5dGVzIGluIHRoZSBidWZmZXIuXG4gICAqXG4gICAqIGBuZXQuU29ja2V0YCBoYXMgdGhlIHByb3BlcnR5IHRoYXQgYHNvY2tldC53cml0ZSgpYCBhbHdheXMgd29ya3MuIFRoaXMgaXMgdG9cbiAgICogaGVscCB1c2VycyBnZXQgdXAgYW5kIHJ1bm5pbmcgcXVpY2tseS4gVGhlIGNvbXB1dGVyIGNhbm5vdCBhbHdheXMga2VlcCB1cFxuICAgKiB3aXRoIHRoZSBhbW91bnQgb2YgZGF0YSB0aGF0IGlzIHdyaXR0ZW4gdG8gYSBzb2NrZXQuIFRoZSBuZXR3b3JrIGNvbm5lY3Rpb25cbiAgICogc2ltcGx5IG1pZ2h0IGJlIHRvbyBzbG93LiBOb2RlLmpzIHdpbGwgaW50ZXJuYWxseSBxdWV1ZSB1cCB0aGUgZGF0YSB3cml0dGVuIHRvIGFcbiAgICogc29ja2V0IGFuZCBzZW5kIGl0IG91dCBvdmVyIHRoZSB3aXJlIHdoZW4gaXQgaXMgcG9zc2libGUuXG4gICAqXG4gICAqIFRoZSBjb25zZXF1ZW5jZSBvZiB0aGlzIGludGVybmFsIGJ1ZmZlcmluZyBpcyB0aGF0IG1lbW9yeSBtYXkgZ3Jvdy5cbiAgICogVXNlcnMgd2hvIGV4cGVyaWVuY2UgbGFyZ2Ugb3IgZ3Jvd2luZyBgYnVmZmVyU2l6ZWAgc2hvdWxkIGF0dGVtcHQgdG9cbiAgICogXCJ0aHJvdHRsZVwiIHRoZSBkYXRhIGZsb3dzIGluIHRoZWlyIHByb2dyYW0gd2l0aCBgc29ja2V0LnBhdXNlKClgIGFuZCBgc29ja2V0LnJlc3VtZSgpYC5cbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgVXNlIGB3cml0YWJsZUxlbmd0aGAgaW5zdGVhZC5cbiAgICovXG4gIGdldCBidWZmZXJTaXplKCk6IG51bWJlciB7XG4gICAgaWYgKHRoaXMuX2hhbmRsZSkge1xuICAgICAgcmV0dXJuIHRoaXMud3JpdGFibGVMZW5ndGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGFtb3VudCBvZiByZWNlaXZlZCBieXRlcy5cbiAgICovXG4gIGdldCBieXRlc1JlYWQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5faGFuZGxlID8gdGhpcy5faGFuZGxlLmJ5dGVzUmVhZCA6IHRoaXNba0J5dGVzUmVhZF07XG4gIH1cblxuICAvKipcbiAgICogVGhlIGFtb3VudCBvZiBieXRlcyBzZW50LlxuICAgKi9cbiAgZ2V0IGJ5dGVzV3JpdHRlbigpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICAgIGxldCBieXRlcyA9IHRoaXMuX2J5dGVzRGlzcGF0Y2hlZDtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fcGVuZGluZ0RhdGE7XG4gICAgY29uc3QgZW5jb2RpbmcgPSB0aGlzLl9wZW5kaW5nRW5jb2Rpbmc7XG4gICAgY29uc3Qgd3JpdGFibGVCdWZmZXIgPSB0aGlzLndyaXRhYmxlQnVmZmVyO1xuXG4gICAgaWYgKCF3cml0YWJsZUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGVsIG9mIHdyaXRhYmxlQnVmZmVyKSB7XG4gICAgICBieXRlcyArPSBlbCEuY2h1bmsgaW5zdGFuY2VvZiBCdWZmZXJcbiAgICAgICAgPyBlbCEuY2h1bmsubGVuZ3RoXG4gICAgICAgIDogQnVmZmVyLmJ5dGVMZW5ndGgoZWwhLmNodW5rLCBlbCEuZW5jb2RpbmcpO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAvLyBXYXMgYSB3cml0ZXYsIGl0ZXJhdGUgb3ZlciBjaHVua3MgdG8gZ2V0IHRvdGFsIGxlbmd0aFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNodW5rID0gZGF0YVtpXTtcblxuICAgICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgICBpZiAoKGRhdGEgYXMgYW55KS5hbGxCdWZmZXJzIHx8IGNodW5rIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgICAgYnl0ZXMgKz0gY2h1bmsubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ5dGVzICs9IEJ1ZmZlci5ieXRlTGVuZ3RoKGNodW5rLmNodW5rLCBjaHVuay5lbmNvZGluZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGRhdGEpIHtcbiAgICAgIC8vIFdyaXRlcyBhcmUgZWl0aGVyIGEgc3RyaW5nIG9yIGEgQnVmZmVyLlxuICAgICAgaWYgKHR5cGVvZiBkYXRhICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGJ5dGVzICs9IChkYXRhIGFzIEJ1ZmZlcikubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnl0ZXMgKz0gQnVmZmVyLmJ5dGVMZW5ndGgoZGF0YSwgZW5jb2RpbmcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBieXRlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiBgdHJ1ZWAsYHNvY2tldC5jb25uZWN0KG9wdGlvbnNbLCBjb25uZWN0TGlzdGVuZXJdKWAgd2FzXG4gICAqIGNhbGxlZCBhbmQgaGFzIG5vdCB5ZXQgZmluaXNoZWQuIEl0IHdpbGwgc3RheSBgdHJ1ZWAgdW50aWwgdGhlIHNvY2tldCBiZWNvbWVzXG4gICAqIGNvbm5lY3RlZCwgdGhlbiBpdCBpcyBzZXQgdG8gYGZhbHNlYCBhbmQgdGhlIGBcImNvbm5lY3RcImAgZXZlbnQgaXMgZW1pdHRlZC4gTm90ZVxuICAgKiB0aGF0IHRoZSBgc29ja2V0LmNvbm5lY3Qob3B0aW9uc1ssIGNvbm5lY3RMaXN0ZW5lcl0pYCBjYWxsYmFjayBpcyBhIGxpc3RlbmVyIGZvciB0aGUgYFwiY29ubmVjdFwiYCBldmVudC5cbiAgICovXG4gIGNvbm5lY3RpbmcgPSBmYWxzZTtcblxuICAvKipcbiAgICogVGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbG9jYWwgSVAgYWRkcmVzcyB0aGUgcmVtb3RlIGNsaWVudCBpc1xuICAgKiBjb25uZWN0aW5nIG9uLiBGb3IgZXhhbXBsZSwgaW4gYSBzZXJ2ZXIgbGlzdGVuaW5nIG9uIGBcIjAuMC4wLjBcImAsIGlmIGEgY2xpZW50XG4gICAqIGNvbm5lY3RzIG9uIGBcIjE5Mi4xNjguMS4xXCJgLCB0aGUgdmFsdWUgb2YgYHNvY2tldC5sb2NhbEFkZHJlc3NgIHdvdWxkIGJlYFwiMTkyLjE2OC4xLjFcImAuXG4gICAqL1xuICBnZXQgbG9jYWxBZGRyZXNzKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2dldHNvY2tuYW1lKCkuYWRkcmVzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgbnVtZXJpYyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbG9jYWwgcG9ydC4gRm9yIGV4YW1wbGUsIGA4MGAgb3IgYDIxYC5cbiAgICovXG4gIGdldCBsb2NhbFBvcnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0c29ja25hbWUoKS5wb3J0O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGxvY2FsIElQIGZhbWlseS4gYFwiSVB2NFwiYCBvciBgXCJJUHY2XCJgLlxuICAgKi9cbiAgZ2V0IGxvY2FsRmFtaWx5KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX2dldHNvY2tuYW1lKCkuZmFtaWx5O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIHJlbW90ZSBJUCBhZGRyZXNzLiBGb3IgZXhhbXBsZSxgXCI3NC4xMjUuMTI3LjEwMFwiYCBvciBgXCIyMDAxOjQ4NjA6YTAwNTo6NjhcImAuIFZhbHVlIG1heSBiZSBgdW5kZWZpbmVkYCBpZlxuICAgKiB0aGUgc29ja2V0IGlzIGRlc3Ryb3llZCAoZm9yIGV4YW1wbGUsIGlmIHRoZSBjbGllbnQgZGlzY29ubmVjdGVkKS5cbiAgICovXG4gIGdldCByZW1vdGVBZGRyZXNzKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX2dldHBlZXJuYW1lKCkuYWRkcmVzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSByZW1vdGUgSVAgZmFtaWx5LiBgXCJJUHY0XCJgIG9yIGBcIklQdjZcImAuXG4gICAqL1xuICBnZXQgcmVtb3RlRmFtaWx5KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgeyBmYW1pbHkgfSA9IHRoaXMuX2dldHBlZXJuYW1lKCk7XG5cbiAgICByZXR1cm4gZmFtaWx5ID8gYElQdiR7ZmFtaWx5fWAgOiBmYW1pbHk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG51bWVyaWMgcmVwcmVzZW50YXRpb24gb2YgdGhlIHJlbW90ZSBwb3J0LiBGb3IgZXhhbXBsZSwgYDgwYCBvciBgMjFgLlxuICAgKi9cbiAgZ2V0IHJlbW90ZVBvcnQoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0cGVlcm5hbWUoKS5wb3J0O1xuICB9XG5cbiAgZ2V0IHBlbmRpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICF0aGlzLl9oYW5kbGUgfHwgdGhpcy5jb25uZWN0aW5nO1xuICB9XG5cbiAgZ2V0IHJlYWR5U3RhdGUoKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5jb25uZWN0aW5nKSB7XG4gICAgICByZXR1cm4gXCJvcGVuaW5nXCI7XG4gICAgfSBlbHNlIGlmICh0aGlzLnJlYWRhYmxlICYmIHRoaXMud3JpdGFibGUpIHtcbiAgICAgIHJldHVybiBcIm9wZW5cIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMucmVhZGFibGUgJiYgIXRoaXMud3JpdGFibGUpIHtcbiAgICAgIHJldHVybiBcInJlYWRPbmx5XCI7XG4gICAgfSBlbHNlIGlmICghdGhpcy5yZWFkYWJsZSAmJiB0aGlzLndyaXRhYmxlKSB7XG4gICAgICByZXR1cm4gXCJ3cml0ZU9ubHlcIjtcbiAgICB9XG4gICAgcmV0dXJuIFwiY2xvc2VkXCI7XG4gIH1cblxuICAvKipcbiAgICogSGFsZi1jbG9zZXMgdGhlIHNvY2tldC4gaS5lLiwgaXQgc2VuZHMgYSBGSU4gcGFja2V0LiBJdCBpcyBwb3NzaWJsZSB0aGVcbiAgICogc2VydmVyIHdpbGwgc3RpbGwgc2VuZCBzb21lIGRhdGEuXG4gICAqXG4gICAqIFNlZSBgd3JpdGFibGUuZW5kKClgIGZvciBmdXJ0aGVyIGRldGFpbHMuXG4gICAqXG4gICAqIEBwYXJhbSBlbmNvZGluZyBPbmx5IHVzZWQgd2hlbiBkYXRhIGlzIGBzdHJpbmdgLlxuICAgKiBAcGFyYW0gY2IgT3B0aW9uYWwgY2FsbGJhY2sgZm9yIHdoZW4gdGhlIHNvY2tldCBpcyBmaW5pc2hlZC5cbiAgICogQHJldHVybiBUaGUgc29ja2V0IGl0c2VsZi5cbiAgICovXG4gIG92ZXJyaWRlIGVuZChjYj86ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvdmVycmlkZSBlbmQoYnVmZmVyOiBVaW50OEFycmF5IHwgc3RyaW5nLCBjYj86ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvdmVycmlkZSBlbmQoXG4gICAgZGF0YTogVWludDhBcnJheSB8IHN0cmluZyxcbiAgICBlbmNvZGluZz86IEVuY29kaW5ncyxcbiAgICBjYj86ICgpID0+IHZvaWQsXG4gICk6IHRoaXM7XG4gIG92ZXJyaWRlIGVuZChcbiAgICBkYXRhPzogVWludDhBcnJheSB8IHN0cmluZyB8ICgoKSA9PiB2b2lkKSxcbiAgICBlbmNvZGluZz86IEVuY29kaW5ncyB8ICgoKSA9PiB2b2lkKSxcbiAgICBjYj86ICgpID0+IHZvaWQsXG4gICk6IHRoaXMge1xuICAgIER1cGxleC5wcm90b3R5cGUuZW5kLmNhbGwodGhpcywgZGF0YSwgZW5jb2RpbmcgYXMgRW5jb2RpbmdzLCBjYik7XG4gICAgRFRSQUNFX05FVF9TVFJFQU1fRU5EKHRoaXMpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHNpemUgT3B0aW9uYWwgYXJndW1lbnQgdG8gc3BlY2lmeSBob3cgbXVjaCBkYXRhIHRvIHJlYWQuXG4gICAqL1xuICBvdmVycmlkZSByZWFkKFxuICAgIHNpemU/OiBudW1iZXIsXG4gICk6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIgfCBudWxsIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoXG4gICAgICB0aGlzW2tCdWZmZXJdICYmXG4gICAgICAhdGhpcy5jb25uZWN0aW5nICYmXG4gICAgICB0aGlzLl9oYW5kbGUgJiZcbiAgICAgICF0aGlzLl9oYW5kbGUucmVhZGluZ1xuICAgICkge1xuICAgICAgX3RyeVJlYWRTdGFydCh0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gRHVwbGV4LnByb3RvdHlwZS5yZWFkLmNhbGwodGhpcywgc2l6ZSk7XG4gIH1cblxuICBkZXN0cm95U29vbigpIHtcbiAgICBpZiAodGhpcy53cml0YWJsZSkge1xuICAgICAgdGhpcy5lbmQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy53cml0YWJsZUZpbmlzaGVkKSB7XG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbmNlKFwiZmluaXNoXCIsIHRoaXMuZGVzdHJveSk7XG4gICAgfVxuICB9XG5cbiAgX3VucmVmVGltZXIoKSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby10aGlzLWFsaWFzXG4gICAgZm9yIChsZXQgcyA9IHRoaXM7IHMgIT09IG51bGw7IHMgPSBzLl9wYXJlbnQpIHtcbiAgICAgIGlmIChzW2tUaW1lb3V0XSkge1xuICAgICAgICBzW2tUaW1lb3V0XS5yZWZyZXNoKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlIHVzZXIgaGFzIGNhbGxlZCAuZW5kKCksIGFuZCBhbGwgdGhlIGJ5dGVzIGhhdmUgYmVlblxuICAvLyBzZW50IG91dCB0byB0aGUgb3RoZXIgc2lkZS5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgb3ZlcnJpZGUgX2ZpbmFsKGNiOiBhbnkpOiBhbnkge1xuICAgIC8vIElmIHN0aWxsIGNvbm5lY3RpbmcgLSBkZWZlciBoYW5kbGluZyBgX2ZpbmFsYCB1bnRpbCAnY29ubmVjdCcgd2lsbCBoYXBwZW5cbiAgICBpZiAodGhpcy5wZW5kaW5nKSB7XG4gICAgICBkZWJ1ZyhcIl9maW5hbDogbm90IHlldCBjb25uZWN0ZWRcIik7XG4gICAgICByZXR1cm4gdGhpcy5vbmNlKFwiY29ubmVjdFwiLCAoKSA9PiB0aGlzLl9maW5hbChjYikpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5faGFuZGxlKSB7XG4gICAgICByZXR1cm4gY2IoKTtcbiAgICB9XG5cbiAgICBkZWJ1ZyhcIl9maW5hbDogbm90IGVuZGVkLCBjYWxsIHNodXRkb3duKClcIik7XG5cbiAgICBjb25zdCByZXEgPSBuZXcgU2h1dGRvd25XcmFwPEhhbmRsZT4oKTtcbiAgICByZXEub25jb21wbGV0ZSA9IF9hZnRlclNodXRkb3duO1xuICAgIHJlcS5oYW5kbGUgPSB0aGlzLl9oYW5kbGU7XG4gICAgcmVxLmNhbGxiYWNrID0gY2I7XG4gICAgY29uc3QgZXJyID0gdGhpcy5faGFuZGxlLnNodXRkb3duKHJlcSk7XG5cbiAgICBpZiAoZXJyID09PSAxIHx8IGVyciA9PT0gY29kZU1hcC5nZXQoXCJFTk9UQ09OTlwiKSkge1xuICAgICAgLy8gc3luY2hyb25vdXMgZmluaXNoXG4gICAgICByZXR1cm4gY2IoKTtcbiAgICB9IGVsc2UgaWYgKGVyciAhPT0gMCkge1xuICAgICAgcmV0dXJuIGNiKGVycm5vRXhjZXB0aW9uKGVyciwgXCJzaHV0ZG93blwiKSk7XG4gICAgfVxuICB9XG5cbiAgX29uVGltZW91dCgpIHtcbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzLl9oYW5kbGU7XG4gICAgY29uc3QgbGFzdFdyaXRlUXVldWVTaXplID0gdGhpc1trTGFzdFdyaXRlUXVldWVTaXplXTtcblxuICAgIGlmIChsYXN0V3JpdGVRdWV1ZVNpemUgPiAwICYmIGhhbmRsZSkge1xuICAgICAgLy8gYGxhc3RXcml0ZVF1ZXVlU2l6ZSAhPT0gd3JpdGVRdWV1ZVNpemVgIG1lYW5zIHRoZXJlIGlzXG4gICAgICAvLyBhbiBhY3RpdmUgd3JpdGUgaW4gcHJvZ3Jlc3MsIHNvIHdlIHN1cHByZXNzIHRoZSB0aW1lb3V0LlxuICAgICAgY29uc3QgeyB3cml0ZVF1ZXVlU2l6ZSB9ID0gaGFuZGxlO1xuXG4gICAgICBpZiAobGFzdFdyaXRlUXVldWVTaXplICE9PSB3cml0ZVF1ZXVlU2l6ZSkge1xuICAgICAgICB0aGlzW2tMYXN0V3JpdGVRdWV1ZVNpemVdID0gd3JpdGVRdWV1ZVNpemU7XG4gICAgICAgIHRoaXMuX3VucmVmVGltZXIoKTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgZGVidWcoXCJfb25UaW1lb3V0XCIpO1xuICAgIHRoaXMuZW1pdChcInRpbWVvdXRcIik7XG4gIH1cblxuICBvdmVycmlkZSBfcmVhZChzaXplPzogbnVtYmVyKSB7XG4gICAgZGVidWcoXCJfcmVhZFwiKTtcbiAgICBpZiAodGhpcy5jb25uZWN0aW5nIHx8ICF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIGRlYnVnKFwiX3JlYWQgd2FpdCBmb3IgY29ubmVjdGlvblwiKTtcbiAgICAgIHRoaXMub25jZShcImNvbm5lY3RcIiwgKCkgPT4gdGhpcy5fcmVhZChzaXplKSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5faGFuZGxlLnJlYWRpbmcpIHtcbiAgICAgIF90cnlSZWFkU3RhcnQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgX2Rlc3Ryb3koZXhjZXB0aW9uOiBFcnJvciB8IG51bGwsIGNiOiAoZXJyOiBFcnJvciB8IG51bGwpID0+IHZvaWQpIHtcbiAgICBkZWJ1ZyhcImRlc3Ryb3lcIik7XG4gICAgdGhpcy5jb25uZWN0aW5nID0gZmFsc2U7XG5cbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLXRoaXMtYWxpYXNcbiAgICBmb3IgKGxldCBzID0gdGhpczsgcyAhPT0gbnVsbDsgcyA9IHMuX3BhcmVudCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHNba1RpbWVvdXRdKTtcbiAgICB9XG5cbiAgICBkZWJ1ZyhcImNsb3NlXCIpO1xuICAgIGlmICh0aGlzLl9oYW5kbGUpIHtcbiAgICAgIGRlYnVnKFwiY2xvc2UgaGFuZGxlXCIpO1xuICAgICAgY29uc3QgaXNFeGNlcHRpb24gPSBleGNlcHRpb24gPyB0cnVlIDogZmFsc2U7XG4gICAgICAvLyBgYnl0ZXNSZWFkYCBhbmQgYGtCeXRlc1dyaXR0ZW5gIHNob3VsZCBiZSBhY2Nlc3NpYmxlIGFmdGVyIGAuZGVzdHJveSgpYFxuICAgICAgdGhpc1trQnl0ZXNSZWFkXSA9IHRoaXMuX2hhbmRsZS5ieXRlc1JlYWQ7XG4gICAgICB0aGlzW2tCeXRlc1dyaXR0ZW5dID0gdGhpcy5faGFuZGxlLmJ5dGVzV3JpdHRlbjtcblxuICAgICAgdGhpcy5faGFuZGxlLmNsb3NlKCgpID0+IHtcbiAgICAgICAgdGhpcy5faGFuZGxlIS5vbnJlYWQgPSBfbm9vcDtcbiAgICAgICAgdGhpcy5faGFuZGxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc29ja25hbWUgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgZGVidWcoXCJlbWl0IGNsb3NlXCIpO1xuICAgICAgICB0aGlzLmVtaXQoXCJjbG9zZVwiLCBpc0V4Y2VwdGlvbik7XG4gICAgICB9KTtcbiAgICAgIGNiKGV4Y2VwdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKGV4Y2VwdGlvbik7XG4gICAgICBuZXh0VGljayhfZW1pdENsb3NlTlQsIHRoaXMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9zZXJ2ZXIpIHtcbiAgICAgIGRlYnVnKFwiaGFzIHNlcnZlclwiKTtcbiAgICAgIHRoaXMuX3NlcnZlci5fY29ubmVjdGlvbnMtLTtcblxuICAgICAgaWYgKHRoaXMuX3NlcnZlci5fZW1pdENsb3NlSWZEcmFpbmVkKSB7XG4gICAgICAgIHRoaXMuX3NlcnZlci5fZW1pdENsb3NlSWZEcmFpbmVkKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldHBlZXJuYW1lKCk6IEFkZHJlc3NJbmZvIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+IHtcbiAgICBpZiAoIXRoaXMuX2hhbmRsZSB8fCAhKFwiZ2V0cGVlcm5hbWVcIiBpbiB0aGlzLl9oYW5kbGUpIHx8IHRoaXMuY29ubmVjdGluZykge1xuICAgICAgcmV0dXJuIHRoaXMuX3BlZXJuYW1lIHx8IHt9O1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX3BlZXJuYW1lKSB7XG4gICAgICB0aGlzLl9wZWVybmFtZSA9IHt9O1xuICAgICAgdGhpcy5faGFuZGxlLmdldHBlZXJuYW1lKHRoaXMuX3BlZXJuYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fcGVlcm5hbWU7XG4gIH1cblxuICBfZ2V0c29ja25hbWUoKTogQWRkcmVzc0luZm8gfCBSZWNvcmQ8c3RyaW5nLCBuZXZlcj4ge1xuICAgIGlmICghdGhpcy5faGFuZGxlIHx8ICEoXCJnZXRzb2NrbmFtZVwiIGluIHRoaXMuX2hhbmRsZSkpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9zb2NrbmFtZSkge1xuICAgICAgdGhpcy5fc29ja25hbWUgPSB7fTtcbiAgICAgIHRoaXMuX2hhbmRsZS5nZXRzb2NrbmFtZSh0aGlzLl9zb2NrbmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3NvY2tuYW1lO1xuICB9XG5cbiAgX3dyaXRlR2VuZXJpYyhcbiAgICB3cml0ZXY6IGJvb2xlYW4sXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBkYXRhOiBhbnksXG4gICAgZW5jb2Rpbmc6IHN0cmluZyxcbiAgICBjYjogKGVycm9yPzogRXJyb3IgfCBudWxsKSA9PiB2b2lkLFxuICApIHtcbiAgICAvLyBJZiB3ZSBhcmUgc3RpbGwgY29ubmVjdGluZywgdGhlbiBidWZmZXIgdGhpcyBmb3IgbGF0ZXIuXG4gICAgLy8gVGhlIFdyaXRhYmxlIGxvZ2ljIHdpbGwgYnVmZmVyIHVwIGFueSBtb3JlIHdyaXRlcyB3aGlsZVxuICAgIC8vIHdhaXRpbmcgZm9yIHRoaXMgb25lIHRvIGJlIGRvbmUuXG4gICAgaWYgKHRoaXMuY29ubmVjdGluZykge1xuICAgICAgdGhpcy5fcGVuZGluZ0RhdGEgPSBkYXRhO1xuICAgICAgdGhpcy5fcGVuZGluZ0VuY29kaW5nID0gZW5jb2Rpbmc7XG4gICAgICB0aGlzLm9uY2UoXCJjb25uZWN0XCIsIGZ1bmN0aW9uIGNvbm5lY3QodGhpczogU29ja2V0KSB7XG4gICAgICAgIHRoaXMuX3dyaXRlR2VuZXJpYyh3cml0ZXYsIGRhdGEsIGVuY29kaW5nLCBjYik7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX3BlbmRpbmdEYXRhID0gbnVsbDtcbiAgICB0aGlzLl9wZW5kaW5nRW5jb2RpbmcgPSBcIlwiO1xuXG4gICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgIGNiKG5ldyBFUlJfU09DS0VUX0NMT1NFRCgpKTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuX3VucmVmVGltZXIoKTtcblxuICAgIGxldCByZXE7XG5cbiAgICBpZiAod3JpdGV2KSB7XG4gICAgICByZXEgPSB3cml0ZXZHZW5lcmljKHRoaXMsIGRhdGEsIGNiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxID0gd3JpdGVHZW5lcmljKHRoaXMsIGRhdGEsIGVuY29kaW5nLCBjYik7XG4gICAgfVxuICAgIGlmIChyZXEuYXN5bmMpIHtcbiAgICAgIHRoaXNba0xhc3RXcml0ZVF1ZXVlU2l6ZV0gPSByZXEuYnl0ZXM7XG4gICAgfVxuICB9XG5cbiAgLy8gQHRzLWlnbm9yZSBEdXBsZXggZGVmaW5pbmcgYXMgYSBwcm9wZXJ0eSB3aGVuIHdhbnQgYSBtZXRob2QuXG4gIF93cml0ZXYoXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBjaHVua3M6IEFycmF5PHsgY2h1bms6IGFueTsgZW5jb2Rpbmc6IHN0cmluZyB9PixcbiAgICBjYjogKGVycm9yPzogRXJyb3IgfCBudWxsKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLl93cml0ZUdlbmVyaWModHJ1ZSwgY2h1bmtzLCBcIlwiLCBjYik7XG4gIH1cblxuICBvdmVycmlkZSBfd3JpdGUoXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBkYXRhOiBhbnksXG4gICAgZW5jb2Rpbmc6IHN0cmluZyxcbiAgICBjYjogKGVycm9yPzogRXJyb3IgfCBudWxsKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLl93cml0ZUdlbmVyaWMoZmFsc2UsIGRhdGEsIGVuY29kaW5nLCBjYik7XG4gIH1cblxuICBba0FmdGVyQXN5bmNXcml0ZV0oKSB7XG4gICAgdGhpc1trTGFzdFdyaXRlUXVldWVTaXplXSA9IDA7XG4gIH1cblxuICBnZXQgW2tVcGRhdGVUaW1lcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3VucmVmVGltZXI7XG4gIH1cblxuICBnZXQgX2Nvbm5lY3RpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdGluZztcbiAgfVxuXG4gIC8vIExlZ2FjeSBhbGlhcy4gSGF2aW5nIHRoaXMgaXMgcHJvYmFibHkgYmVpbmcgb3Zlcmx5IGNhdXRpb3VzLCBidXQgaXQgZG9lc24ndFxuICAvLyByZWFsbHkgaHVydCBhbnlvbmUgZWl0aGVyLiBUaGlzIGNhbiBwcm9iYWJseSBiZSByZW1vdmVkIHNhZmVseSBpZiBkZXNpcmVkLlxuICBnZXQgX2J5dGVzRGlzcGF0Y2hlZCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9oYW5kbGUgPyB0aGlzLl9oYW5kbGUuYnl0ZXNXcml0dGVuIDogdGhpc1trQnl0ZXNXcml0dGVuXTtcbiAgfVxuXG4gIGdldCBfaGFuZGxlKCk6IEhhbmRsZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzW2tIYW5kbGVdO1xuICB9XG5cbiAgc2V0IF9oYW5kbGUodjogSGFuZGxlIHwgbnVsbCkge1xuICAgIHRoaXNba0hhbmRsZV0gPSB2O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBTdHJlYW0gPSBTb2NrZXQ7XG5cbi8vIFRhcmdldCBBUEk6XG4vL1xuLy8gbGV0IHMgPSBuZXQuY29ubmVjdCh7cG9ydDogODAsIGhvc3Q6ICdnb29nbGUuY29tJ30sIGZ1bmN0aW9uKCkge1xuLy8gICAuLi5cbi8vIH0pO1xuLy9cbi8vIFRoZXJlIGFyZSB2YXJpb3VzIGZvcm1zOlxuLy9cbi8vIGNvbm5lY3Qob3B0aW9ucywgW2NiXSlcbi8vIGNvbm5lY3QocG9ydCwgW2hvc3RdLCBbY2JdKVxuLy8gY29ubmVjdChwYXRoLCBbY2JdKTtcbi8vXG5leHBvcnQgZnVuY3Rpb24gY29ubmVjdChcbiAgb3B0aW9uczogTmV0Q29ubmVjdE9wdGlvbnMsXG4gIGNvbm5lY3Rpb25MaXN0ZW5lcj86ICgpID0+IHZvaWQsXG4pOiBTb2NrZXQ7XG5leHBvcnQgZnVuY3Rpb24gY29ubmVjdChcbiAgcG9ydDogbnVtYmVyLFxuICBob3N0Pzogc3RyaW5nLFxuICBjb25uZWN0aW9uTGlzdGVuZXI/OiAoKSA9PiB2b2lkLFxuKTogU29ja2V0O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3QocGF0aDogc3RyaW5nLCBjb25uZWN0aW9uTGlzdGVuZXI/OiAoKSA9PiB2b2lkKTogU29ja2V0O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3QoLi4uYXJnczogdW5rbm93bltdKSB7XG4gIGNvbnN0IG5vcm1hbGl6ZWQgPSBfbm9ybWFsaXplQXJncyhhcmdzKTtcbiAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZWRbMF0gYXMgUGFydGlhbDxOZXRDb25uZWN0T3B0aW9ucz47XG4gIGRlYnVnKFwiY3JlYXRlQ29ubmVjdGlvblwiLCBub3JtYWxpemVkKTtcbiAgY29uc3Qgc29ja2V0ID0gbmV3IFNvY2tldChvcHRpb25zKTtcblxuICBpZiAob3B0aW9ucy50aW1lb3V0KSB7XG4gICAgc29ja2V0LnNldFRpbWVvdXQob3B0aW9ucy50aW1lb3V0KTtcbiAgfVxuXG4gIHJldHVybiBzb2NrZXQuY29ubmVjdChub3JtYWxpemVkKTtcbn1cblxuZXhwb3J0IGNvbnN0IGNyZWF0ZUNvbm5lY3Rpb24gPSBjb25uZWN0O1xuXG5leHBvcnQgaW50ZXJmYWNlIExpc3Rlbk9wdGlvbnMgZXh0ZW5kcyBBYm9ydGFibGUge1xuICBmZD86IG51bWJlcjtcbiAgcG9ydD86IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgaG9zdD86IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgYmFja2xvZz86IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgcGF0aD86IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgZXhjbHVzaXZlPzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgcmVhZGFibGVBbGw/OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICB3cml0YWJsZUFsbD86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gIC8qKlxuICAgKiBEZWZhdWx0OiBgZmFsc2VgXG4gICAqL1xuICBpcHY2T25seT86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG59XG5cbnR5cGUgQ29ubmVjdGlvbkxpc3RlbmVyID0gKHNvY2tldDogU29ja2V0KSA9PiB2b2lkO1xuXG5pbnRlcmZhY2UgU2VydmVyT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgd2hldGhlciBoYWxmLW9wZW5lZCBUQ1AgY29ubmVjdGlvbnMgYXJlIGFsbG93ZWQuXG4gICAqIERlZmF1bHQ6IGZhbHNlXG4gICAqL1xuICBhbGxvd0hhbGZPcGVuPzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIHRoZSBzb2NrZXQgc2hvdWxkIGJlIHBhdXNlZCBvbiBpbmNvbWluZyBjb25uZWN0aW9ucy5cbiAgICogRGVmYXVsdDogZmFsc2VcbiAgICovXG4gIHBhdXNlT25Db25uZWN0PzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gX2lzU2VydmVyU29ja2V0T3B0aW9ucyhcbiAgb3B0aW9uczogdW5rbm93bixcbik6IG9wdGlvbnMgaXMgbnVsbCB8IHVuZGVmaW5lZCB8IFNlcnZlck9wdGlvbnMge1xuICByZXR1cm4gKFxuICAgIG9wdGlvbnMgPT09IG51bGwgfHxcbiAgICB0eXBlb2Ygb3B0aW9ucyA9PT0gXCJ1bmRlZmluZWRcIiB8fFxuICAgIHR5cGVvZiBvcHRpb25zID09PSBcIm9iamVjdFwiXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9pc0Nvbm5lY3Rpb25MaXN0ZW5lcihcbiAgY29ubmVjdGlvbkxpc3RlbmVyOiB1bmtub3duLFxuKTogY29ubmVjdGlvbkxpc3RlbmVyIGlzIENvbm5lY3Rpb25MaXN0ZW5lciB7XG4gIHJldHVybiB0eXBlb2YgY29ubmVjdGlvbkxpc3RlbmVyID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIF9nZXRGbGFncyhpcHY2T25seT86IGJvb2xlYW4pOiBudW1iZXIge1xuICByZXR1cm4gaXB2Nk9ubHkgPT09IHRydWUgPyBUQ1BDb25zdGFudHMuVVZfVENQX0lQVjZPTkxZIDogMDtcbn1cblxuZnVuY3Rpb24gX2xpc3RlbkluQ2x1c3RlcihcbiAgc2VydmVyOiBTZXJ2ZXIsXG4gIGFkZHJlc3M6IHN0cmluZyB8IG51bGwsXG4gIHBvcnQ6IG51bWJlciB8IG51bGwsXG4gIGFkZHJlc3NUeXBlOiBudW1iZXIgfCBudWxsLFxuICBiYWNrbG9nOiBudW1iZXIsXG4gIGZkPzogbnVtYmVyIHwgbnVsbCxcbiAgZXhjbHVzaXZlPzogYm9vbGVhbixcbiAgZmxhZ3M/OiBudW1iZXIsXG4pIHtcbiAgZXhjbHVzaXZlID0gISFleGNsdXNpdmU7XG5cbiAgLy8gVE9ETyhjbW9ydGVuKTogaGVyZSB3ZSBkZXZpYXRlIHNvbWV3aGF0IGZyb20gdGhlIE5vZGUgaW1wbGVtZW50YXRpb24gd2hpY2hcbiAgLy8gbWFrZXMgdXNlIG9mIHRoZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2NsdXN0ZXIuaHRtbCBtb2R1bGUgdG8gcnVuIHNlcnZlcnNcbiAgLy8gYWNyb3NzIGEgXCJjbHVzdGVyXCIgb2YgTm9kZSBwcm9jZXNzZXMgdG8gdGFrZSBhZHZhbnRhZ2Ugb2YgbXVsdGktY29yZVxuICAvLyBzeXN0ZW1zLlxuICAvL1xuICAvLyBUaG91Z2ggRGVubyBoYXMgaGFzIGEgV29ya2VyIGNhcGFiaWxpdHkgZnJvbSB3aGljaCB3ZSBjb3VsZCBzaW11bGF0ZSB0aGlzLFxuICAvLyBmb3Igbm93IHdlIGFzc2VydCB0aGF0IHdlIGFyZSBfYWx3YXlzXyBvbiB0aGUgcHJpbWFyeSBwcm9jZXNzLlxuICBjb25zdCBpc1ByaW1hcnkgPSB0cnVlO1xuXG4gIGlmIChpc1ByaW1hcnkgfHwgZXhjbHVzaXZlKSB7XG4gICAgLy8gV2lsbCBjcmVhdGUgYSBuZXcgaGFuZGxlXG4gICAgLy8gX2xpc3RlbjIgc2V0cyB1cCB0aGUgbGlzdGVuZWQgaGFuZGxlLCBpdCBpcyBzdGlsbCBuYW1lZCBsaWtlIHRoaXNcbiAgICAvLyB0byBhdm9pZCBicmVha2luZyBjb2RlIHRoYXQgd3JhcHMgdGhpcyBtZXRob2RcbiAgICBzZXJ2ZXIuX2xpc3RlbjIoYWRkcmVzcywgcG9ydCwgYWRkcmVzc1R5cGUsIGJhY2tsb2csIGZkLCBmbGFncyk7XG5cbiAgICByZXR1cm47XG4gIH1cbn1cblxuZnVuY3Rpb24gX2xvb2t1cEFuZExpc3RlbihcbiAgc2VydmVyOiBTZXJ2ZXIsXG4gIHBvcnQ6IG51bWJlcixcbiAgYWRkcmVzczogc3RyaW5nLFxuICBiYWNrbG9nOiBudW1iZXIsXG4gIGV4Y2x1c2l2ZTogYm9vbGVhbixcbiAgZmxhZ3M6IG51bWJlcixcbikge1xuICBkbnNMb29rdXAoYWRkcmVzcywgZnVuY3Rpb24gZG9MaXN0ZW4oZXJyLCBpcCwgYWRkcmVzc1R5cGUpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBzZXJ2ZXIuZW1pdChcImVycm9yXCIsIGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFkZHJlc3NUeXBlID0gaXAgPyBhZGRyZXNzVHlwZSA6IDQ7XG5cbiAgICAgIF9saXN0ZW5JbkNsdXN0ZXIoXG4gICAgICAgIHNlcnZlcixcbiAgICAgICAgaXAsXG4gICAgICAgIHBvcnQsXG4gICAgICAgIGFkZHJlc3NUeXBlLFxuICAgICAgICBiYWNrbG9nLFxuICAgICAgICBudWxsLFxuICAgICAgICBleGNsdXNpdmUsXG4gICAgICAgIGZsYWdzLFxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfYWRkQWJvcnRTaWduYWxPcHRpb24oc2VydmVyOiBTZXJ2ZXIsIG9wdGlvbnM6IExpc3Rlbk9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnM/LnNpZ25hbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFsaWRhdGVBYm9ydFNpZ25hbChvcHRpb25zLnNpZ25hbCwgXCJvcHRpb25zLnNpZ25hbFwiKTtcblxuICBjb25zdCB7IHNpZ25hbCB9ID0gb3B0aW9ucztcblxuICBjb25zdCBvbkFib3J0ZWQgPSAoKSA9PiB7XG4gICAgc2VydmVyLmNsb3NlKCk7XG4gIH07XG5cbiAgaWYgKHNpZ25hbC5hYm9ydGVkKSB7XG4gICAgbmV4dFRpY2sob25BYm9ydGVkKTtcbiAgfSBlbHNlIHtcbiAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIG9uQWJvcnRlZCk7XG4gICAgc2VydmVyLm9uY2UoXCJjbG9zZVwiLCAoKSA9PiBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIG9uQWJvcnRlZCkpO1xuICB9XG59XG5cbi8vIFJldHVybnMgaGFuZGxlIGlmIGl0IGNhbiBiZSBjcmVhdGVkLCBvciBlcnJvciBjb2RlIGlmIGl0IGNhbid0XG5leHBvcnQgZnVuY3Rpb24gX2NyZWF0ZVNlcnZlckhhbmRsZShcbiAgYWRkcmVzczogc3RyaW5nIHwgbnVsbCxcbiAgcG9ydDogbnVtYmVyIHwgbnVsbCxcbiAgYWRkcmVzc1R5cGU6IG51bWJlciB8IG51bGwsXG4gIGZkPzogbnVtYmVyIHwgbnVsbCxcbiAgZmxhZ3M/OiBudW1iZXIsXG4pOiBIYW5kbGUgfCBudW1iZXIge1xuICBsZXQgZXJyID0gMDtcbiAgLy8gQXNzaWduIGhhbmRsZSBpbiBsaXN0ZW4sIGFuZCBjbGVhbiB1cCBpZiBiaW5kIG9yIGxpc3RlbiBmYWlsc1xuICBsZXQgaGFuZGxlO1xuICBsZXQgaXNUQ1AgPSBmYWxzZTtcblxuICBpZiAodHlwZW9mIGZkID09PSBcIm51bWJlclwiICYmIGZkID49IDApIHtcbiAgICB0cnkge1xuICAgICAgaGFuZGxlID0gX2NyZWF0ZUhhbmRsZShmZCwgdHJ1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm90IGEgZmQgd2UgY2FuIGxpc3RlbiBvbi4gVGhpcyB3aWxsIHRyaWdnZXIgYW4gZXJyb3IuXG4gICAgICBkZWJ1ZyhcImxpc3RlbiBpbnZhbGlkIGZkPSVkOlwiLCBmZCwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuXG4gICAgICByZXR1cm4gY29kZU1hcC5nZXQoXCJFSU5WQUxcIikhO1xuICAgIH1cblxuICAgIGVyciA9IGhhbmRsZS5vcGVuKGZkKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIHJldHVybiBlcnI7XG4gICAgfVxuXG4gICAgYXNzZXJ0KCFhZGRyZXNzICYmICFwb3J0KTtcbiAgfSBlbHNlIGlmIChwb3J0ID09PSAtMSAmJiBhZGRyZXNzVHlwZSA9PT0gLTEpIHtcbiAgICBoYW5kbGUgPSBuZXcgUGlwZShQaXBlQ29uc3RhbnRzLlNFUlZFUik7XG5cbiAgICBpZiAoaXNXaW5kb3dzKSB7XG4gICAgICBjb25zdCBpbnN0YW5jZXMgPSBOdW1iZXIucGFyc2VJbnQoXG4gICAgICAgIERlbm8uZW52LmdldChcIk5PREVfUEVORElOR19QSVBFX0lOU1RBTkNFU1wiKSA/PyBcIlwiLFxuICAgICAgKTtcblxuICAgICAgaWYgKCFOdW1iZXIuaXNOYU4oaW5zdGFuY2VzKSkge1xuICAgICAgICBoYW5kbGUuc2V0UGVuZGluZ0luc3RhbmNlcyEoaW5zdGFuY2VzKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaGFuZGxlID0gbmV3IFRDUChUQ1BDb25zdGFudHMuU0VSVkVSKTtcbiAgICBpc1RDUCA9IHRydWU7XG4gIH1cblxuICBpZiAoYWRkcmVzcyB8fCBwb3J0IHx8IGlzVENQKSB7XG4gICAgZGVidWcoXCJiaW5kIHRvXCIsIGFkZHJlc3MgfHwgXCJhbnlcIik7XG5cbiAgICBpZiAoIWFkZHJlc3MpIHtcbiAgICAgIC8vIFRPRE86IGRpZmZlcnMgZnJvbSBOb2RlIHdoaWNoIHRyaWVzIHRvIGJpbmQgdG8gSVB2NiBmaXJzdCB3aGVuIG5vXG4gICAgICAvLyBhZGRyZXNzIGlzIHByb3ZpZGVkLlxuICAgICAgLy9cbiAgICAgIC8vIEZvcmNpbmcgSVB2NCBhcyBhIHdvcmthcm91bmQgZm9yIERlbm8gbm90IGFsaWduaW5nIHdpdGggTm9kZSBvblxuICAgICAgLy8gaW1wbGljaXQgYmluZGluZyBvbiBXaW5kb3dzLlxuICAgICAgLy9cbiAgICAgIC8vIFJFRjogaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm8vaXNzdWVzLzEwNzYyXG5cbiAgICAgIC8vIFRyeSBiaW5kaW5nIHRvIGlwdjYgZmlyc3RcbiAgICAgIC8vIGVyciA9IChoYW5kbGUgYXMgVENQKS5iaW5kNihERUZBVUxUX0lQVjZfQUREUiwgcG9ydCA/PyAwLCBmbGFncyA/PyAwKTtcblxuICAgICAgLy8gaWYgKGVycikge1xuICAgICAgLy8gICBoYW5kbGUuY2xvc2UoKTtcblxuICAgICAgLy8gRmFsbGJhY2sgdG8gaXB2NFxuICAgICAgcmV0dXJuIF9jcmVhdGVTZXJ2ZXJIYW5kbGUoREVGQVVMVF9JUFY0X0FERFIsIHBvcnQsIDQsIG51bGwsIGZsYWdzKTtcbiAgICAgIC8vIH1cbiAgICB9IGVsc2UgaWYgKGFkZHJlc3NUeXBlID09PSA2KSB7XG4gICAgICBlcnIgPSAoaGFuZGxlIGFzIFRDUCkuYmluZDYoYWRkcmVzcywgcG9ydCA/PyAwLCBmbGFncyA/PyAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyID0gKGhhbmRsZSBhcyBUQ1ApLmJpbmQoYWRkcmVzcywgcG9ydCA/PyAwKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZXJyKSB7XG4gICAgaGFuZGxlLmNsb3NlKCk7XG5cbiAgICByZXR1cm4gZXJyO1xuICB9XG5cbiAgcmV0dXJuIGhhbmRsZTtcbn1cblxuZnVuY3Rpb24gX2VtaXRFcnJvck5UKHNlcnZlcjogU2VydmVyLCBlcnI6IEVycm9yKSB7XG4gIHNlcnZlci5lbWl0KFwiZXJyb3JcIiwgZXJyKTtcbn1cblxuZnVuY3Rpb24gX2VtaXRMaXN0ZW5pbmdOVChzZXJ2ZXI6IFNlcnZlcikge1xuICAvLyBFbnN1cmUgaGFuZGxlIGhhc24ndCBjbG9zZWRcbiAgaWYgKHNlcnZlci5faGFuZGxlKSB7XG4gICAgc2VydmVyLmVtaXQoXCJsaXN0ZW5pbmdcIik7XG4gIH1cbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIF9vbmNvbm5lY3Rpb24odGhpczogYW55LCBlcnI6IG51bWJlciwgY2xpZW50SGFuZGxlPzogSGFuZGxlKSB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tdGhpcy1hbGlhc1xuICBjb25zdCBoYW5kbGUgPSB0aGlzO1xuICBjb25zdCBzZWxmID0gaGFuZGxlW293bmVyU3ltYm9sXTtcblxuICBkZWJ1ZyhcIm9uY29ubmVjdGlvblwiKTtcblxuICBpZiAoZXJyKSB7XG4gICAgc2VsZi5lbWl0KFwiZXJyb3JcIiwgZXJybm9FeGNlcHRpb24oZXJyLCBcImFjY2VwdFwiKSk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc2VsZi5tYXhDb25uZWN0aW9ucyAmJiBzZWxmLl9jb25uZWN0aW9ucyA+PSBzZWxmLm1heENvbm5lY3Rpb25zKSB7XG4gICAgY2xpZW50SGFuZGxlIS5jbG9zZSgpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgc29ja2V0ID0gbmV3IFNvY2tldCh7XG4gICAgaGFuZGxlOiBjbGllbnRIYW5kbGUsXG4gICAgYWxsb3dIYWxmT3Blbjogc2VsZi5hbGxvd0hhbGZPcGVuLFxuICAgIHBhdXNlT25DcmVhdGU6IHNlbGYucGF1c2VPbkNvbm5lY3QsXG4gICAgcmVhZGFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gIH0pO1xuXG4gIC8vIFRPRE86IGltcGxlbWVudCBub0RlbGF5IGFuZCBzZXRLZWVwQWxpdmVcblxuICBzZWxmLl9jb25uZWN0aW9ucysrO1xuICBzb2NrZXQuc2VydmVyID0gc2VsZjtcbiAgc29ja2V0Ll9zZXJ2ZXIgPSBzZWxmO1xuXG4gIERUUkFDRV9ORVRfU0VSVkVSX0NPTk5FQ1RJT04oc29ja2V0KTtcbiAgc2VsZi5lbWl0KFwiY29ubmVjdGlvblwiLCBzb2NrZXQpO1xufVxuXG5mdW5jdGlvbiBfc2V0dXBMaXN0ZW5IYW5kbGUoXG4gIHRoaXM6IFNlcnZlcixcbiAgYWRkcmVzczogc3RyaW5nIHwgbnVsbCxcbiAgcG9ydDogbnVtYmVyIHwgbnVsbCxcbiAgYWRkcmVzc1R5cGU6IG51bWJlciB8IG51bGwsXG4gIGJhY2tsb2c6IG51bWJlcixcbiAgZmQ/OiBudW1iZXIgfCBudWxsLFxuICBmbGFncz86IG51bWJlcixcbikge1xuICBkZWJ1ZyhcInNldHVwTGlzdGVuSGFuZGxlXCIsIGFkZHJlc3MsIHBvcnQsIGFkZHJlc3NUeXBlLCBiYWNrbG9nLCBmZCk7XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm90IHlldCBhIGhhbmRsZSwgd2UgbmVlZCB0byBjcmVhdGUgb25lIGFuZCBiaW5kLlxuICAvLyBJbiB0aGUgY2FzZSBvZiBhIHNlcnZlciBzZW50IHZpYSBJUEMsIHdlIGRvbid0IG5lZWQgdG8gZG8gdGhpcy5cbiAgaWYgKHRoaXMuX2hhbmRsZSkge1xuICAgIGRlYnVnKFwic2V0dXBMaXN0ZW5IYW5kbGU6IGhhdmUgYSBoYW5kbGUgYWxyZWFkeVwiKTtcbiAgfSBlbHNlIHtcbiAgICBkZWJ1ZyhcInNldHVwTGlzdGVuSGFuZGxlOiBjcmVhdGUgYSBoYW5kbGVcIik7XG5cbiAgICBsZXQgcnZhbCA9IG51bGw7XG5cbiAgICAvLyBUcnkgdG8gYmluZCB0byB0aGUgdW5zcGVjaWZpZWQgSVB2NiBhZGRyZXNzLCBzZWUgaWYgSVB2NiBpcyBhdmFpbGFibGVcbiAgICBpZiAoIWFkZHJlc3MgJiYgdHlwZW9mIGZkICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAvLyBUT0RPOiBkaWZmZXJzIGZyb20gTm9kZSB3aGljaCB0cmllcyB0byBiaW5kIHRvIElQdjYgZmlyc3Qgd2hlbiBub1xuICAgICAgLy8gYWRkcmVzcyBpcyBwcm92aWRlZC5cbiAgICAgIC8vXG4gICAgICAvLyBGb3JjaW5nIElQdjQgYXMgYSB3b3JrYXJvdW5kIGZvciBEZW5vIG5vdCBhbGlnbmluZyB3aXRoIE5vZGUgb25cbiAgICAgIC8vIGltcGxpY2l0IGJpbmRpbmcgb24gV2luZG93cy5cbiAgICAgIC8vXG4gICAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy8xMDc2MlxuICAgICAgLy8gcnZhbCA9IF9jcmVhdGVTZXJ2ZXJIYW5kbGUoREVGQVVMVF9JUFY2X0FERFIsIHBvcnQsIDYsIGZkLCBmbGFncyk7XG5cbiAgICAgIC8vIGlmICh0eXBlb2YgcnZhbCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgLy8gICBydmFsID0gbnVsbDtcbiAgICAgIGFkZHJlc3MgPSBERUZBVUxUX0lQVjRfQUREUjtcbiAgICAgIGFkZHJlc3NUeXBlID0gNDtcbiAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAvLyAgIGFkZHJlc3MgPSBERUZBVUxUX0lQVjZfQUREUjtcbiAgICAgIC8vICAgYWRkcmVzc1R5cGUgPSA2O1xuICAgICAgLy8gfVxuICAgIH1cblxuICAgIGlmIChydmFsID09PSBudWxsKSB7XG4gICAgICBydmFsID0gX2NyZWF0ZVNlcnZlckhhbmRsZShhZGRyZXNzLCBwb3J0LCBhZGRyZXNzVHlwZSwgZmQsIGZsYWdzKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHJ2YWwgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gdXZFeGNlcHRpb25XaXRoSG9zdFBvcnQocnZhbCwgXCJsaXN0ZW5cIiwgYWRkcmVzcywgcG9ydCk7XG4gICAgICBuZXh0VGljayhfZW1pdEVycm9yTlQsIHRoaXMsIGVycm9yKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2hhbmRsZSA9IHJ2YWw7XG4gIH1cblxuICB0aGlzW2FzeW5jSWRTeW1ib2xdID0gX2dldE5ld0FzeW5jSWQodGhpcy5faGFuZGxlKTtcbiAgdGhpcy5faGFuZGxlLm9uY29ubmVjdGlvbiA9IF9vbmNvbm5lY3Rpb247XG4gIHRoaXMuX2hhbmRsZVtvd25lclN5bWJvbF0gPSB0aGlzO1xuXG4gIC8vIFVzZSBhIGJhY2tsb2cgb2YgNTEyIGVudHJpZXMuIFdlIHBhc3MgNTExIHRvIHRoZSBsaXN0ZW4oKSBjYWxsIGJlY2F1c2VcbiAgLy8gdGhlIGtlcm5lbCBkb2VzOiBiYWNrbG9nc2l6ZSA9IHJvdW5kdXBfcG93X29mX3R3byhiYWNrbG9nc2l6ZSArIDEpO1xuICAvLyB3aGljaCB3aWxsIHRodXMgZ2l2ZSB1cyBhIGJhY2tsb2cgb2YgNTEyIGVudHJpZXMuXG4gIGNvbnN0IGVyciA9IHRoaXMuX2hhbmRsZS5saXN0ZW4oYmFja2xvZyB8fCA1MTEpO1xuXG4gIGlmIChlcnIpIHtcbiAgICBjb25zdCBleCA9IHV2RXhjZXB0aW9uV2l0aEhvc3RQb3J0KGVyciwgXCJsaXN0ZW5cIiwgYWRkcmVzcywgcG9ydCk7XG4gICAgdGhpcy5faGFuZGxlLmNsb3NlKCk7XG4gICAgdGhpcy5faGFuZGxlID0gbnVsbDtcblxuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICAgICAgdGhpc1thc3luY0lkU3ltYm9sXSxcbiAgICAgIG5leHRUaWNrLFxuICAgICAgX2VtaXRFcnJvck5ULFxuICAgICAgdGhpcyxcbiAgICAgIGV4LFxuICAgICk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBjb25uZWN0aW9uIGtleSwgdGhpcyBzaG91bGQgYmUgdW5pcXVlIHRvIHRoZSBjb25uZWN0aW9uXG4gIHRoaXMuX2Nvbm5lY3Rpb25LZXkgPSBhZGRyZXNzVHlwZSArIFwiOlwiICsgYWRkcmVzcyArIFwiOlwiICsgcG9ydDtcblxuICAvLyBVbnJlZiB0aGUgaGFuZGxlIGlmIHRoZSBzZXJ2ZXIgd2FzIHVucmVmJ2VkIHByaW9yIHRvIGxpc3RlbmluZ1xuICBpZiAodGhpcy5fdW5yZWYpIHtcbiAgICB0aGlzLnVucmVmKCk7XG4gIH1cblxuICBkZWZhdWx0VHJpZ2dlckFzeW5jSWRTY29wZShcbiAgICB0aGlzW2FzeW5jSWRTeW1ib2xdLFxuICAgIG5leHRUaWNrLFxuICAgIF9lbWl0TGlzdGVuaW5nTlQsXG4gICAgdGhpcyxcbiAgKTtcbn1cblxuLyoqIFRoaXMgY2xhc3MgaXMgdXNlZCB0byBjcmVhdGUgYSBUQ1Agb3IgSVBDIHNlcnZlci4gKi9cbmV4cG9ydCBjbGFzcyBTZXJ2ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBbYXN5bmNJZFN5bWJvbF0gPSAtMTtcblxuICBhbGxvd0hhbGZPcGVuID0gZmFsc2U7XG4gIHBhdXNlT25Db25uZWN0ID0gZmFsc2U7XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX2hhbmRsZTogYW55ID0gbnVsbDtcbiAgX2Nvbm5lY3Rpb25zID0gMDtcbiAgX3VzaW5nV29ya2VycyA9IGZhbHNlO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBfd29ya2VyczogYW55W10gPSBbXTtcbiAgX3VucmVmID0gZmFsc2U7XG4gIF9waXBlTmFtZT86IHN0cmluZztcbiAgX2Nvbm5lY3Rpb25LZXk/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIGBuZXQuU2VydmVyYCBpcyBhbiBgRXZlbnRFbWl0dGVyYCB3aXRoIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICAgKlxuICAgKiAtIGBcImNsb3NlXCJgIC0gRW1pdHRlZCB3aGVuIHRoZSBzZXJ2ZXIgY2xvc2VzLiBJZiBjb25uZWN0aW9ucyBleGlzdCwgdGhpc1xuICAgKiBldmVudCBpcyBub3QgZW1pdHRlZCB1bnRpbCBhbGwgY29ubmVjdGlvbnMgYXJlIGVuZGVkLlxuICAgKiAtIGBcImNvbm5lY3Rpb25cImAgLSBFbWl0dGVkIHdoZW4gYSBuZXcgY29ubmVjdGlvbiBpcyBtYWRlLiBgc29ja2V0YCBpcyBhblxuICAgKiBpbnN0YW5jZSBvZiBgbmV0LlNvY2tldGAuXG4gICAqIC0gYFwiZXJyb3JcImAgLSBFbWl0dGVkIHdoZW4gYW4gZXJyb3Igb2NjdXJzLiBVbmxpa2UgYG5ldC5Tb2NrZXRgLCB0aGVcbiAgICogYFwiY2xvc2VcImAgZXZlbnQgd2lsbCBub3QgYmUgZW1pdHRlZCBkaXJlY3RseSBmb2xsb3dpbmcgdGhpcyBldmVudCB1bmxlc3NcbiAgICogYHNlcnZlci5jbG9zZSgpYCBpcyBtYW51YWxseSBjYWxsZWQuIFNlZSB0aGUgZXhhbXBsZSBpbiBkaXNjdXNzaW9uIG9mXG4gICAqIGBzZXJ2ZXIubGlzdGVuKClgLlxuICAgKiAtIGBcImxpc3RlbmluZ1wiYCAtIEVtaXR0ZWQgd2hlbiB0aGUgc2VydmVyIGhhcyBiZWVuIGJvdW5kIGFmdGVyIGNhbGxpbmdcbiAgICogYHNlcnZlci5saXN0ZW4oKWAuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25uZWN0aW9uTGlzdGVuZXI/OiBDb25uZWN0aW9uTGlzdGVuZXIpO1xuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogU2VydmVyT3B0aW9ucywgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyKTtcbiAgY29uc3RydWN0b3IoXG4gICAgb3B0aW9ucz86IFNlcnZlck9wdGlvbnMgfCBDb25uZWN0aW9uTGlzdGVuZXIsXG4gICAgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKF9pc0Nvbm5lY3Rpb25MaXN0ZW5lcihvcHRpb25zKSkge1xuICAgICAgdGhpcy5vbihcImNvbm5lY3Rpb25cIiwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChfaXNTZXJ2ZXJTb2NrZXRPcHRpb25zKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLmFsbG93SGFsZk9wZW4gPSBvcHRpb25zPy5hbGxvd0hhbGZPcGVuIHx8IGZhbHNlO1xuICAgICAgdGhpcy5wYXVzZU9uQ29ubmVjdCA9ICEhb3B0aW9ucz8ucGF1c2VPbkNvbm5lY3Q7XG5cbiAgICAgIGlmIChfaXNDb25uZWN0aW9uTGlzdGVuZXIoY29ubmVjdGlvbkxpc3RlbmVyKSkge1xuICAgICAgICB0aGlzLm9uKFwiY29ubmVjdGlvblwiLCBjb25uZWN0aW9uTGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJvcHRpb25zXCIsIFwiT2JqZWN0XCIsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIHNlcnZlciBsaXN0ZW5pbmcgZm9yIGNvbm5lY3Rpb25zLiBBIGBuZXQuU2VydmVyYCBjYW4gYmUgYSBUQ1Agb3JcbiAgICogYW4gYElQQ2Agc2VydmVyIGRlcGVuZGluZyBvbiB3aGF0IGl0IGxpc3RlbnMgdG8uXG4gICAqXG4gICAqIFBvc3NpYmxlIHNpZ25hdHVyZXM6XG4gICAqXG4gICAqIC0gYHNlcnZlci5saXN0ZW4oaGFuZGxlWywgYmFja2xvZ11bLCBjYWxsYmFja10pYFxuICAgKiAtIGBzZXJ2ZXIubGlzdGVuKG9wdGlvbnNbLCBjYWxsYmFja10pYFxuICAgKiAtIGBzZXJ2ZXIubGlzdGVuKHBhdGhbLCBiYWNrbG9nXVssIGNhbGxiYWNrXSlgIGZvciBgSVBDYCBzZXJ2ZXJzXG4gICAqIC0gYHNlcnZlci5saXN0ZW4oW3BvcnRbLCBob3N0WywgYmFja2xvZ11dXVssIGNhbGxiYWNrXSlgIGZvciBUQ1Agc2VydmVyc1xuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGFzeW5jaHJvbm91cy4gV2hlbiB0aGUgc2VydmVyIHN0YXJ0cyBsaXN0ZW5pbmcsIHRoZSBgJ2xpc3RlbmluZydgIGV2ZW50IHdpbGwgYmUgZW1pdHRlZC4gVGhlIGxhc3QgcGFyYW1ldGVyIGBjYWxsYmFja2B3aWxsIGJlIGFkZGVkIGFzIGEgbGlzdGVuZXIgZm9yIHRoZSBgJ2xpc3RlbmluZydgXG4gICAqIGV2ZW50LlxuICAgKlxuICAgKiBBbGwgYGxpc3RlbigpYCBtZXRob2RzIGNhbiB0YWtlIGEgYGJhY2tsb2dgIHBhcmFtZXRlciB0byBzcGVjaWZ5IHRoZSBtYXhpbXVtXG4gICAqIGxlbmd0aCBvZiB0aGUgcXVldWUgb2YgcGVuZGluZyBjb25uZWN0aW9ucy4gVGhlIGFjdHVhbCBsZW5ndGggd2lsbCBiZSBkZXRlcm1pbmVkXG4gICAqIGJ5IHRoZSBPUyB0aHJvdWdoIHN5c2N0bCBzZXR0aW5ncyBzdWNoIGFzIGB0Y3BfbWF4X3N5bl9iYWNrbG9nYCBhbmQgYHNvbWF4Y29ubmAgb24gTGludXguIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoaXMgcGFyYW1ldGVyIGlzIDUxMSAobm90IDUxMikuXG4gICAqXG4gICAqIEFsbCBgU29ja2V0YCBhcmUgc2V0IHRvIGBTT19SRVVTRUFERFJgIChzZWUgW2Bzb2NrZXQoNylgXShodHRwczovL21hbjcub3JnL2xpbnV4L21hbi1wYWdlcy9tYW43L3NvY2tldC43Lmh0bWwpIGZvclxuICAgKiBkZXRhaWxzKS5cbiAgICpcbiAgICogVGhlIGBzZXJ2ZXIubGlzdGVuKClgIG1ldGhvZCBjYW4gYmUgY2FsbGVkIGFnYWluIGlmIGFuZCBvbmx5IGlmIHRoZXJlIHdhcyBhblxuICAgKiBlcnJvciBkdXJpbmcgdGhlIGZpcnN0IGBzZXJ2ZXIubGlzdGVuKClgIGNhbGwgb3IgYHNlcnZlci5jbG9zZSgpYCBoYXMgYmVlblxuICAgKiBjYWxsZWQuIE90aGVyd2lzZSwgYW4gYEVSUl9TRVJWRVJfQUxSRUFEWV9MSVNURU5gIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICAgKlxuICAgKiBPbmUgb2YgdGhlIG1vc3QgY29tbW9uIGVycm9ycyByYWlzZWQgd2hlbiBsaXN0ZW5pbmcgaXMgYEVBRERSSU5VU0VgLlxuICAgKiBUaGlzIGhhcHBlbnMgd2hlbiBhbm90aGVyIHNlcnZlciBpcyBhbHJlYWR5IGxpc3RlbmluZyBvbiB0aGUgcmVxdWVzdGVkYHBvcnRgL2BwYXRoYC9gaGFuZGxlYC4gT25lIHdheSB0byBoYW5kbGUgdGhpcyB3b3VsZCBiZSB0byByZXRyeVxuICAgKiBhZnRlciBhIGNlcnRhaW4gYW1vdW50IG9mIHRpbWU6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9ub2RlL21vZHVsZS50c1wiO1xuICAgKlxuICAgKiBjb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuICAgKiBjb25zdCBuZXQgPSByZXF1aXJlKFwibmV0XCIpO1xuICAgKlxuICAgKiBjb25zdCBQT1JUID0gMzAwMDtcbiAgICogY29uc3QgSE9TVCA9IFwiMTI3LjAuMC4xXCI7XG4gICAqIGNvbnN0IHNlcnZlciA9IG5ldyBuZXQuU2VydmVyKCk7XG4gICAqXG4gICAqIHNlcnZlci5vbihcImVycm9yXCIsIChlOiBFcnJvciAmIHsgY29kZTogc3RyaW5nOyB9KSA9PiB7XG4gICAqICAgaWYgKGUuY29kZSA9PT0gXCJFQUREUklOVVNFXCIpIHtcbiAgICogICAgIGNvbnNvbGUubG9nKFwiQWRkcmVzcyBpbiB1c2UsIHJldHJ5aW5nLi4uXCIpO1xuICAgKiAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAqICAgICAgIHNlcnZlci5jbG9zZSgpO1xuICAgKiAgICAgICBzZXJ2ZXIubGlzdGVuKFBPUlQsIEhPU1QpO1xuICAgKiAgICAgfSwgMTAwMCk7XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBsaXN0ZW4oXG4gICAgcG9ydD86IG51bWJlcixcbiAgICBob3N0bmFtZT86IHN0cmluZyxcbiAgICBiYWNrbG9nPzogbnVtYmVyLFxuICAgIGxpc3RlbmluZ0xpc3RlbmVyPzogKCkgPT4gdm9pZCxcbiAgKTogdGhpcztcbiAgbGlzdGVuKFxuICAgIHBvcnQ/OiBudW1iZXIsXG4gICAgaG9zdG5hbWU/OiBzdHJpbmcsXG4gICAgbGlzdGVuaW5nTGlzdGVuZXI/OiAoKSA9PiB2b2lkLFxuICApOiB0aGlzO1xuICBsaXN0ZW4ocG9ydD86IG51bWJlciwgYmFja2xvZz86IG51bWJlciwgbGlzdGVuaW5nTGlzdGVuZXI/OiAoKSA9PiB2b2lkKTogdGhpcztcbiAgbGlzdGVuKHBvcnQ/OiBudW1iZXIsIGxpc3RlbmluZ0xpc3RlbmVyPzogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGxpc3RlbihwYXRoOiBzdHJpbmcsIGJhY2tsb2c/OiBudW1iZXIsIGxpc3RlbmluZ0xpc3RlbmVyPzogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGxpc3RlbihwYXRoOiBzdHJpbmcsIGxpc3RlbmluZ0xpc3RlbmVyPzogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGxpc3RlbihvcHRpb25zOiBMaXN0ZW5PcHRpb25zLCBsaXN0ZW5pbmdMaXN0ZW5lcj86ICgpID0+IHZvaWQpOiB0aGlzO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBsaXN0ZW4oaGFuZGxlOiBhbnksIGJhY2tsb2c/OiBudW1iZXIsIGxpc3RlbmluZ0xpc3RlbmVyPzogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGxpc3RlbihoYW5kbGU6IGFueSwgbGlzdGVuaW5nTGlzdGVuZXI/OiAoKSA9PiB2b2lkKTogdGhpcztcbiAgbGlzdGVuKC4uLmFyZ3M6IHVua25vd25bXSk6IHRoaXMge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBfbm9ybWFsaXplQXJncyhhcmdzKTtcbiAgICBsZXQgb3B0aW9ucyA9IG5vcm1hbGl6ZWRbMF0gYXMgUGFydGlhbDxMaXN0ZW5PcHRpb25zPjtcbiAgICBjb25zdCBjYiA9IG5vcm1hbGl6ZWRbMV07XG5cbiAgICBpZiAodGhpcy5faGFuZGxlKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX1NFUlZFUl9BTFJFQURZX0xJU1RFTigpO1xuICAgIH1cblxuICAgIGlmIChjYiAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5vbmNlKFwibGlzdGVuaW5nXCIsIGNiKTtcbiAgICB9XG5cbiAgICBjb25zdCBiYWNrbG9nRnJvbUFyZ3M6IG51bWJlciA9XG4gICAgICAvLyAoaGFuZGxlLCBiYWNrbG9nKSBvciAocGF0aCwgYmFja2xvZykgb3IgKHBvcnQsIGJhY2tsb2cpXG4gICAgICBfdG9OdW1iZXIoYXJncy5sZW5ndGggPiAxICYmIGFyZ3NbMV0pIHx8XG4gICAgICAoX3RvTnVtYmVyKGFyZ3MubGVuZ3RoID4gMiAmJiBhcmdzWzJdKSBhcyBudW1iZXIpOyAvLyAocG9ydCwgaG9zdCwgYmFja2xvZylcblxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgb3B0aW9ucyA9IChvcHRpb25zIGFzIGFueSkuX2hhbmRsZSB8fCAob3B0aW9ucyBhcyBhbnkpLmhhbmRsZSB8fCBvcHRpb25zO1xuICAgIGNvbnN0IGZsYWdzID0gX2dldEZsYWdzKG9wdGlvbnMuaXB2Nk9ubHkpO1xuXG4gICAgLy8gKGhhbmRsZVssIGJhY2tsb2ddWywgY2JdKSB3aGVyZSBoYW5kbGUgaXMgYW4gb2JqZWN0IHdpdGggYSBoYW5kbGVcbiAgICBpZiAob3B0aW9ucyBpbnN0YW5jZW9mIFRDUCkge1xuICAgICAgdGhpcy5faGFuZGxlID0gb3B0aW9ucztcbiAgICAgIHRoaXNbYXN5bmNJZFN5bWJvbF0gPSB0aGlzLl9oYW5kbGUuZ2V0QXN5bmNJZCgpO1xuXG4gICAgICBfbGlzdGVuSW5DbHVzdGVyKHRoaXMsIG51bGwsIC0xLCAtMSwgYmFja2xvZ0Zyb21BcmdzKTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgX2FkZEFib3J0U2lnbmFsT3B0aW9uKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLy8gKGhhbmRsZVssIGJhY2tsb2ddWywgY2JdKSB3aGVyZSBoYW5kbGUgaXMgYW4gb2JqZWN0IHdpdGggYSBmZFxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5mZCA9PT0gXCJudW1iZXJcIiAmJiBvcHRpb25zLmZkID49IDApIHtcbiAgICAgIF9saXN0ZW5JbkNsdXN0ZXIodGhpcywgbnVsbCwgbnVsbCwgbnVsbCwgYmFja2xvZ0Zyb21BcmdzLCBvcHRpb25zLmZkKTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy8gKFtwb3J0XVssIGhvc3RdWywgYmFja2xvZ11bLCBjYl0pIHdoZXJlIHBvcnQgaXMgb21pdHRlZCxcbiAgICAvLyB0aGF0IGlzLCBsaXN0ZW4oKSwgbGlzdGVuKG51bGwpLCBsaXN0ZW4oY2IpLCBvciBsaXN0ZW4obnVsbCwgY2IpXG4gICAgLy8gb3IgKG9wdGlvbnNbLCBjYl0pIHdoZXJlIG9wdGlvbnMucG9ydCBpcyBleHBsaWNpdGx5IHNldCBhcyB1bmRlZmluZWQgb3JcbiAgICAvLyBudWxsLCBiaW5kIHRvIGFuIGFyYml0cmFyeSB1bnVzZWQgcG9ydFxuICAgIGlmIChcbiAgICAgIGFyZ3MubGVuZ3RoID09PSAwIHx8XG4gICAgICB0eXBlb2YgYXJnc1swXSA9PT0gXCJmdW5jdGlvblwiIHx8XG4gICAgICAodHlwZW9mIG9wdGlvbnMucG9ydCA9PT0gXCJ1bmRlZmluZWRcIiAmJiBcInBvcnRcIiBpbiBvcHRpb25zKSB8fFxuICAgICAgb3B0aW9ucy5wb3J0ID09PSBudWxsXG4gICAgKSB7XG4gICAgICBvcHRpb25zLnBvcnQgPSAwO1xuICAgIH1cblxuICAgIC8vIChbcG9ydF1bLCBob3N0XVssIGJhY2tsb2ddWywgY2JdKSB3aGVyZSBwb3J0IGlzIHNwZWNpZmllZFxuICAgIC8vIG9yIChvcHRpb25zWywgY2JdKSB3aGVyZSBvcHRpb25zLnBvcnQgaXMgc3BlY2lmaWVkXG4gICAgLy8gb3IgaWYgb3B0aW9ucy5wb3J0IGlzIG5vcm1hbGl6ZWQgYXMgMCBiZWZvcmVcbiAgICBsZXQgYmFja2xvZztcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5wb3J0ID09PSBcIm51bWJlclwiIHx8IHR5cGVvZiBvcHRpb25zLnBvcnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHZhbGlkYXRlUG9ydChvcHRpb25zLnBvcnQsIFwib3B0aW9ucy5wb3J0XCIpO1xuICAgICAgYmFja2xvZyA9IG9wdGlvbnMuYmFja2xvZyB8fCBiYWNrbG9nRnJvbUFyZ3M7XG5cbiAgICAgIC8vIHN0YXJ0IFRDUCBzZXJ2ZXIgbGlzdGVuaW5nIG9uIGhvc3Q6cG9ydFxuICAgICAgaWYgKG9wdGlvbnMuaG9zdCkge1xuICAgICAgICBfbG9va3VwQW5kTGlzdGVuKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgb3B0aW9ucy5wb3J0IHwgMCxcbiAgICAgICAgICBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgYmFja2xvZyxcbiAgICAgICAgICAhIW9wdGlvbnMuZXhjbHVzaXZlLFxuICAgICAgICAgIGZsYWdzLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVW5kZWZpbmVkIGhvc3QsIGxpc3RlbnMgb24gdW5zcGVjaWZpZWQgYWRkcmVzc1xuICAgICAgICAvLyBEZWZhdWx0IGFkZHJlc3NUeXBlIDQgd2lsbCBiZSB1c2VkIHRvIHNlYXJjaCBmb3IgcHJpbWFyeSBzZXJ2ZXJcbiAgICAgICAgX2xpc3RlbkluQ2x1c3RlcihcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgb3B0aW9ucy5wb3J0IHwgMCxcbiAgICAgICAgICA0LFxuICAgICAgICAgIGJhY2tsb2csXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIG9wdGlvbnMuZXhjbHVzaXZlLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyAocGF0aFssIGJhY2tsb2ddWywgY2JdKSBvciAob3B0aW9uc1ssIGNiXSlcbiAgICAvLyB3aGVyZSBwYXRoIG9yIG9wdGlvbnMucGF0aCBpcyBhIFVOSVggZG9tYWluIHNvY2tldCBvciBXaW5kb3dzIHBpcGVcbiAgICBpZiAob3B0aW9ucy5wYXRoICYmIF9pc1BpcGVOYW1lKG9wdGlvbnMucGF0aCkpIHtcbiAgICAgIGNvbnN0IHBpcGVOYW1lID0gKHRoaXMuX3BpcGVOYW1lID0gb3B0aW9ucy5wYXRoKTtcbiAgICAgIGJhY2tsb2cgPSBvcHRpb25zLmJhY2tsb2cgfHwgYmFja2xvZ0Zyb21BcmdzO1xuXG4gICAgICBfbGlzdGVuSW5DbHVzdGVyKFxuICAgICAgICB0aGlzLFxuICAgICAgICBwaXBlTmFtZSxcbiAgICAgICAgLTEsXG4gICAgICAgIC0xLFxuICAgICAgICBiYWNrbG9nLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMuZXhjbHVzaXZlLFxuICAgICAgKTtcblxuICAgICAgaWYgKCF0aGlzLl9oYW5kbGUpIHtcbiAgICAgICAgLy8gRmFpbGVkIGFuZCBhbiBlcnJvciBzaGFsbCBiZSBlbWl0dGVkIGluIHRoZSBuZXh0IHRpY2suXG4gICAgICAgIC8vIFRoZXJlZm9yZSwgd2UgZGlyZWN0bHkgcmV0dXJuLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cblxuICAgICAgbGV0IG1vZGUgPSAwO1xuXG4gICAgICBpZiAob3B0aW9ucy5yZWFkYWJsZUFsbCA9PT0gdHJ1ZSkge1xuICAgICAgICBtb2RlIHw9IFBpcGVDb25zdGFudHMuVVZfUkVBREFCTEU7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLndyaXRhYmxlQWxsID09PSB0cnVlKSB7XG4gICAgICAgIG1vZGUgfD0gUGlwZUNvbnN0YW50cy5VVl9XUklUQUJMRTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1vZGUgIT09IDApIHtcbiAgICAgICAgY29uc3QgZXJyID0gdGhpcy5faGFuZGxlLmZjaG1vZChtb2RlKTtcblxuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgdGhpcy5faGFuZGxlLmNsb3NlKCk7XG4gICAgICAgICAgdGhpcy5faGFuZGxlID0gbnVsbDtcblxuICAgICAgICAgIHRocm93IGVycm5vRXhjZXB0aW9uKGVyciwgXCJ1dl9waXBlX2NobW9kXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghKFwicG9ydFwiIGluIG9wdGlvbnMgfHwgXCJwYXRoXCIgaW4gb3B0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXG4gICAgICAgIFwib3B0aW9uc1wiLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICAnbXVzdCBoYXZlIHRoZSBwcm9wZXJ0eSBcInBvcnRcIiBvciBcInBhdGhcIicsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXCJvcHRpb25zXCIsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3BzIHRoZSBzZXJ2ZXIgZnJvbSBhY2NlcHRpbmcgbmV3IGNvbm5lY3Rpb25zIGFuZCBrZWVwcyBleGlzdGluZ1xuICAgKiBjb25uZWN0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBhc3luY2hyb25vdXMsIHRoZSBzZXJ2ZXIgaXMgZmluYWxseSBjbG9zZWRcbiAgICogd2hlbiBhbGwgY29ubmVjdGlvbnMgYXJlIGVuZGVkIGFuZCB0aGUgc2VydmVyIGVtaXRzIGEgYFwiY2xvc2VcImAgZXZlbnQuXG4gICAqIFRoZSBvcHRpb25hbCBgY2FsbGJhY2tgIHdpbGwgYmUgY2FsbGVkIG9uY2UgdGhlIGBcImNsb3NlXCJgIGV2ZW50IG9jY3Vycy4gVW5saWtlXG4gICAqIHRoYXQgZXZlbnQsIGl0IHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gYEVycm9yYCBhcyBpdHMgb25seSBhcmd1bWVudCBpZiB0aGUgc2VydmVyXG4gICAqIHdhcyBub3Qgb3BlbiB3aGVuIGl0IHdhcyBjbG9zZWQuXG4gICAqXG4gICAqIEBwYXJhbSBjYiBDYWxsZWQgd2hlbiB0aGUgc2VydmVyIGlzIGNsb3NlZC5cbiAgICovXG4gIGNsb3NlKGNiPzogKGVycj86IEVycm9yKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoIXRoaXMuX2hhbmRsZSkge1xuICAgICAgICB0aGlzLm9uY2UoXCJjbG9zZVwiLCBmdW5jdGlvbiBjbG9zZSgpIHtcbiAgICAgICAgICBjYihuZXcgRVJSX1NFUlZFUl9OT1RfUlVOTklORygpKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9uY2UoXCJjbG9zZVwiLCBjYik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2hhbmRsZSkge1xuICAgICAgKHRoaXMuX2hhbmRsZSBhcyBUQ1ApLmNsb3NlKCk7XG4gICAgICB0aGlzLl9oYW5kbGUgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl91c2luZ1dvcmtlcnMpIHtcbiAgICAgIGxldCBsZWZ0ID0gdGhpcy5fd29ya2Vycy5sZW5ndGg7XG4gICAgICBjb25zdCBvbldvcmtlckNsb3NlID0gKCkgPT4ge1xuICAgICAgICBpZiAoLS1sZWZ0ICE9PSAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29ubmVjdGlvbnMgPSAwO1xuICAgICAgICB0aGlzLl9lbWl0Q2xvc2VJZkRyYWluZWQoKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIEluY3JlbWVudCBjb25uZWN0aW9ucyB0byBiZSBzdXJlIHRoYXQsIGV2ZW4gaWYgYWxsIHNvY2tldHMgd2lsbCBiZSBjbG9zZWRcbiAgICAgIC8vIGR1cmluZyBwb2xsaW5nIG9mIHdvcmtlcnMsIGBjbG9zZWAgZXZlbnQgd2lsbCBiZSBlbWl0dGVkIG9ubHkgb25jZS5cbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb25zKys7XG5cbiAgICAgIC8vIFBvbGwgd29ya2Vyc1xuICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCB0aGlzLl93b3JrZXJzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgIHRoaXMuX3dvcmtlcnNbbl0uY2xvc2Uob25Xb3JrZXJDbG9zZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2VtaXRDbG9zZUlmRHJhaW5lZCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJvdW5kIGBhZGRyZXNzYCwgdGhlIGFkZHJlc3MgYGZhbWlseWAgbmFtZSwgYW5kIGBwb3J0YCBvZiB0aGUgc2VydmVyXG4gICAqIGFzIHJlcG9ydGVkIGJ5IHRoZSBvcGVyYXRpbmcgc3lzdGVtIGlmIGxpc3RlbmluZyBvbiBhbiBJUCBzb2NrZXRcbiAgICogKHVzZWZ1bCB0byBmaW5kIHdoaWNoIHBvcnQgd2FzIGFzc2lnbmVkIHdoZW4gZ2V0dGluZyBhbiBPUy1hc3NpZ25lZCBhZGRyZXNzKTpgeyBwb3J0OiAxMjM0NiwgZmFtaWx5OiBcIklQdjRcIiwgYWRkcmVzczogXCIxMjcuMC4wLjFcIiB9YC5cbiAgICpcbiAgICogRm9yIGEgc2VydmVyIGxpc3RlbmluZyBvbiBhIHBpcGUgb3IgVW5peCBkb21haW4gc29ja2V0LCB0aGUgbmFtZSBpcyByZXR1cm5lZFxuICAgKiBhcyBhIHN0cmluZy5cbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL25vZGUvbW9kdWxlLnRzXCI7XG4gICAqIGltcG9ydCB7IFNvY2tldCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL25vZGUvbmV0LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7XG4gICAqIGNvbnN0IG5ldCA9IHJlcXVpcmUoXCJuZXRcIik7XG4gICAqXG4gICAqIGNvbnN0IHNlcnZlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKHNvY2tldDogU29ja2V0KSA9PiB7XG4gICAqICAgc29ja2V0LmVuZChcImdvb2RieWVcXG5cIik7XG4gICAqIH0pLm9uKFwiZXJyb3JcIiwgKGVycjogRXJyb3IpID0+IHtcbiAgICogICAvLyBIYW5kbGUgZXJyb3JzIGhlcmUuXG4gICAqICAgdGhyb3cgZXJyO1xuICAgKiB9KTtcbiAgICpcbiAgICogLy8gR3JhYiBhbiBhcmJpdHJhcnkgdW51c2VkIHBvcnQuXG4gICAqIHNlcnZlci5saXN0ZW4oKCkgPT4ge1xuICAgKiAgIGNvbnNvbGUubG9nKFwib3BlbmVkIHNlcnZlciBvblwiLCBzZXJ2ZXIuYWRkcmVzcygpKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBgc2VydmVyLmFkZHJlc3MoKWAgcmV0dXJucyBgbnVsbGAgYmVmb3JlIHRoZSBgXCJsaXN0ZW5pbmdcImAgZXZlbnQgaGFzIGJlZW5cbiAgICogZW1pdHRlZCBvciBhZnRlciBjYWxsaW5nIGBzZXJ2ZXIuY2xvc2UoKWAuXG4gICAqL1xuICBhZGRyZXNzKCk6IEFkZHJlc3NJbmZvIHwgc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKHRoaXMuX2hhbmRsZSAmJiB0aGlzLl9oYW5kbGUuZ2V0c29ja25hbWUpIHtcbiAgICAgIGNvbnN0IG91dCA9IHt9O1xuICAgICAgY29uc3QgZXJyID0gdGhpcy5faGFuZGxlLmdldHNvY2tuYW1lKG91dCk7XG5cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgdGhyb3cgZXJybm9FeGNlcHRpb24oZXJyLCBcImFkZHJlc3NcIik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvdXQgYXMgQWRkcmVzc0luZm87XG4gICAgfSBlbHNlIGlmICh0aGlzLl9waXBlTmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BpcGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IGdldCB0aGUgbnVtYmVyIG9mIGNvbmN1cnJlbnQgY29ubmVjdGlvbnMgb24gdGhlIHNlcnZlci4gV29ya3NcbiAgICogd2hlbiBzb2NrZXRzIHdlcmUgc2VudCB0byBmb3Jrcy5cbiAgICpcbiAgICogQ2FsbGJhY2sgc2hvdWxkIHRha2UgdHdvIGFyZ3VtZW50cyBgZXJyYCBhbmQgYGNvdW50YC5cbiAgICovXG4gIGdldENvbm5lY3Rpb25zKGNiOiAoZXJyOiBFcnJvciB8IG51bGwsIGNvdW50OiBudW1iZXIpID0+IHZvaWQpOiB0aGlzIHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLXRoaXMtYWxpYXNcbiAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gZW5kKGVycjogRXJyb3IgfCBudWxsLCBjb25uZWN0aW9ucz86IG51bWJlcikge1xuICAgICAgZGVmYXVsdFRyaWdnZXJBc3luY0lkU2NvcGUoXG4gICAgICAgIHNlcnZlclthc3luY0lkU3ltYm9sXSxcbiAgICAgICAgbmV4dFRpY2ssXG4gICAgICAgIGNiLFxuICAgICAgICBlcnIsXG4gICAgICAgIGNvbm5lY3Rpb25zLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3VzaW5nV29ya2Vycykge1xuICAgICAgZW5kKG51bGwsIHRoaXMuX2Nvbm5lY3Rpb25zKTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy8gUG9sbCB3b3JrZXJzXG4gICAgbGV0IGxlZnQgPSB0aGlzLl93b3JrZXJzLmxlbmd0aDtcbiAgICBsZXQgdG90YWwgPSB0aGlzLl9jb25uZWN0aW9ucztcblxuICAgIGZ1bmN0aW9uIG9uY291bnQoZXJyOiBFcnJvciwgY291bnQ6IG51bWJlcikge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBsZWZ0ID0gLTE7XG5cbiAgICAgICAgcmV0dXJuIGVuZChlcnIpO1xuICAgICAgfVxuXG4gICAgICB0b3RhbCArPSBjb3VudDtcblxuICAgICAgaWYgKC0tbGVmdCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZW5kKG51bGwsIHRvdGFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBuID0gMDsgbiA8IHRoaXMuX3dvcmtlcnMubGVuZ3RoOyBuKyspIHtcbiAgICAgIHRoaXMuX3dvcmtlcnNbbl0uZ2V0Q29ubmVjdGlvbnMob25jb3VudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGluZyBgdW5yZWYoKWAgb24gYSBzZXJ2ZXIgd2lsbCBhbGxvdyB0aGUgcHJvZ3JhbSB0byBleGl0IGlmIHRoaXMgaXMgdGhlIG9ubHlcbiAgICogYWN0aXZlIHNlcnZlciBpbiB0aGUgZXZlbnQgc3lzdGVtLiBJZiB0aGUgc2VydmVyIGlzIGFscmVhZHkgYHVucmVmYGVkIGNhbGxpbmcgYHVucmVmKClgIGFnYWluIHdpbGwgaGF2ZSBubyBlZmZlY3QuXG4gICAqL1xuICB1bnJlZigpOiB0aGlzIHtcbiAgICB0aGlzLl91bnJlZiA9IHRydWU7XG5cbiAgICBpZiAodGhpcy5faGFuZGxlKSB7XG4gICAgICB0aGlzLl9oYW5kbGUudW5yZWYoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBPcHBvc2l0ZSBvZiBgdW5yZWYoKWAsIGNhbGxpbmcgYHJlZigpYCBvbiBhIHByZXZpb3VzbHkgYHVucmVmYGVkIHNlcnZlciB3aWxsIF9ub3RfIGxldCB0aGUgcHJvZ3JhbSBleGl0IGlmIGl0J3MgdGhlIG9ubHkgc2VydmVyIGxlZnQgKHRoZSBkZWZhdWx0IGJlaGF2aW9yKS5cbiAgICogSWYgdGhlIHNlcnZlciBpcyBgcmVmYGVkIGNhbGxpbmcgYHJlZigpYCBhZ2FpbiB3aWxsIGhhdmUgbm8gZWZmZWN0LlxuICAgKi9cbiAgcmVmKCk6IHRoaXMge1xuICAgIHRoaXMuX3VucmVmID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5faGFuZGxlKSB7XG4gICAgICB0aGlzLl9oYW5kbGUucmVmKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSW5kaWNhdGVzIHdoZXRoZXIgb3Igbm90IHRoZSBzZXJ2ZXIgaXMgbGlzdGVuaW5nIGZvciBjb25uZWN0aW9ucy5cbiAgICovXG4gIGdldCBsaXN0ZW5pbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEhdGhpcy5faGFuZGxlO1xuICB9XG5cbiAgX2xpc3RlbjIgPSBfc2V0dXBMaXN0ZW5IYW5kbGU7XG5cbiAgX2VtaXRDbG9zZUlmRHJhaW5lZCgpIHtcbiAgICBkZWJ1ZyhcIlNFUlZFUiBfZW1pdENsb3NlSWZEcmFpbmVkXCIpO1xuICAgIGlmICh0aGlzLl9oYW5kbGUgfHwgdGhpcy5fY29ubmVjdGlvbnMpIHtcbiAgICAgIGRlYnVnKFxuICAgICAgICBgU0VSVkVSIGhhbmRsZT8gJHshIXRoaXMuX2hhbmRsZX0gICBjb25uZWN0aW9ucz8gJHt0aGlzLl9jb25uZWN0aW9uc31gLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBXZSB1c2Ugc2V0VGltZW91dCBpbnN0ZWFkIG9mIG5leHRUaWNrIGhlcmUgdG8gYXZvaWQgRUFERFJJTlVTRSBlcnJvclxuICAgIC8vIHdoZW4gdGhlIHNhbWUgcG9ydCBsaXN0ZW5lZCBpbW1lZGlhdGVseSBhZnRlciB0aGUgJ2Nsb3NlJyBldmVudC5cbiAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vX3N0ZC9pc3N1ZXMvMjc4OFxuICAgIGRlZmF1bHRUcmlnZ2VyQXN5bmNJZFNjb3BlKFxuICAgICAgdGhpc1thc3luY0lkU3ltYm9sXSxcbiAgICAgIHNldFRpbWVvdXQsXG4gICAgICBfZW1pdENsb3NlTlQsXG4gICAgICAwLFxuICAgICAgdGhpcyxcbiAgICApO1xuICB9XG5cbiAgX3NldHVwV29ya2VyKHNvY2tldExpc3Q6IEV2ZW50RW1pdHRlcikge1xuICAgIHRoaXMuX3VzaW5nV29ya2VycyA9IHRydWU7XG4gICAgdGhpcy5fd29ya2Vycy5wdXNoKHNvY2tldExpc3QpO1xuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBzb2NrZXRMaXN0Lm9uY2UoXCJleGl0XCIsIChzb2NrZXRMaXN0OiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fd29ya2Vycy5pbmRleE9mKHNvY2tldExpc3QpO1xuICAgICAgdGhpcy5fd29ya2Vycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuICB9XG5cbiAgW0V2ZW50RW1pdHRlci5jYXB0dXJlUmVqZWN0aW9uU3ltYm9sXShcbiAgICBlcnI6IEVycm9yLFxuICAgIGV2ZW50OiBzdHJpbmcsXG4gICAgc29jazogU29ja2V0LFxuICApIHtcbiAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICBjYXNlIFwiY29ubmVjdGlvblwiOiB7XG4gICAgICAgIHNvY2suZGVzdHJveShlcnIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgdGhpcy5lbWl0KFwiZXJyb3JcIiwgZXJyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IFRDUCBvciBJUEMgc2VydmVyLlxuICpcbiAqIEFjY2VwdHMgYW4gYG9wdGlvbnNgIG9iamVjdCB3aXRoIHByb3BlcnRpZXMgYGFsbG93SGFsZk9wZW5gIChkZWZhdWx0IGBmYWxzZWApXG4gKiBhbmQgYHBhdXNlT25Db25uZWN0YCAoZGVmYXVsdCBgZmFsc2VgKS5cbiAqXG4gKiBJZiBgYWxsb3dIYWxmT3BlbmAgaXMgc2V0IHRvIGBmYWxzZWAsIHRoZW4gdGhlIHNvY2tldCB3aWxsXG4gKiBhdXRvbWF0aWNhbGx5IGVuZCB0aGUgd3JpdGFibGUgc2lkZSB3aGVuIHRoZSByZWFkYWJsZSBzaWRlIGVuZHMuXG4gKlxuICogSWYgYGFsbG93SGFsZk9wZW5gIGlzIHNldCB0byBgdHJ1ZWAsIHdoZW4gdGhlIG90aGVyIGVuZCBvZiB0aGUgc29ja2V0XG4gKiBzaWduYWxzIHRoZSBlbmQgb2YgdHJhbnNtaXNzaW9uLCB0aGUgc2VydmVyIHdpbGwgb25seSBzZW5kIGJhY2sgdGhlIGVuZCBvZlxuICogdHJhbnNtaXNzaW9uIHdoZW4gYHNvY2tldC5lbmQoKWAgaXMgZXhwbGljaXRseSBjYWxsZWQuIEZvciBleGFtcGxlLCBpbiB0aGVcbiAqIGNvbnRleHQgb2YgVENQLCB3aGVuIGEgRklOIHBhY2tlZCBpcyByZWNlaXZlZCwgYSBGSU4gcGFja2VkIGlzIHNlbnQgYmFja1xuICogb25seSB3aGVuIGBzb2NrZXQuZW5kKClgIGlzIGV4cGxpY2l0bHkgY2FsbGVkLiBVbnRpbCB0aGVuIHRoZSBjb25uZWN0aW9uIGlzXG4gKiBoYWxmLWNsb3NlZCAobm9uLXJlYWRhYmxlIGJ1dCBzdGlsbCB3cml0YWJsZSkuIFNlZSBgXCJlbmRcImAgZXZlbnQgYW5kIFJGQyAxMTIyXG4gKiAoc2VjdGlvbiA0LjIuMi4xMykgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKlxuICogYHBhdXNlT25Db25uZWN0YCBpbmRpY2F0ZXMgd2hldGhlciB0aGUgc29ja2V0IHNob3VsZCBiZSBwYXVzZWQgb24gaW5jb21pbmdcbiAqIGNvbm5lY3Rpb25zLlxuICpcbiAqIElmIGBwYXVzZU9uQ29ubmVjdGAgaXMgc2V0IHRvIGB0cnVlYCwgdGhlbiB0aGUgc29ja2V0IGFzc29jaWF0ZWQgd2l0aCBlYWNoXG4gKiBpbmNvbWluZyBjb25uZWN0aW9uIHdpbGwgYmUgcGF1c2VkLCBhbmQgbm8gZGF0YSB3aWxsIGJlIHJlYWQgZnJvbSBpdHNcbiAqIGhhbmRsZS4gVGhpcyBhbGxvd3MgY29ubmVjdGlvbnMgdG8gYmUgcGFzc2VkIGJldHdlZW4gcHJvY2Vzc2VzIHdpdGhvdXQgYW55XG4gKiBkYXRhIGJlaW5nIHJlYWQgYnkgdGhlIG9yaWdpbmFsIHByb2Nlc3MuIFRvIGJlZ2luIHJlYWRpbmcgZGF0YSBmcm9tIGEgcGF1c2VkXG4gKiBzb2NrZXQsIGNhbGwgYHNvY2tldC5yZXN1bWUoKWAuXG4gKlxuICogVGhlIHNlcnZlciBjYW4gYmUgYSBUQ1Agc2VydmVyIG9yIGFuIElQQyBzZXJ2ZXIsIGRlcGVuZGluZyBvbiB3aGF0IGl0XG4gKiBgbGlzdGVuKClgIHRvLlxuICpcbiAqIEhlcmUgaXMgYW4gZXhhbXBsZSBvZiBhbiBUQ1AgZWNobyBzZXJ2ZXIgd2hpY2ggbGlzdGVucyBmb3IgY29ubmVjdGlvbnMgb25cbiAqIHBvcnQgODEyNDpcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL25vZGUvbW9kdWxlLnRzXCI7XG4gKiBpbXBvcnQgeyBTb2NrZXQgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9ub2RlL25ldC50c1wiO1xuICpcbiAqIGNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7XG4gKiBjb25zdCBuZXQgPSByZXF1aXJlKFwibmV0XCIpO1xuICpcbiAqIGNvbnN0IHNlcnZlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKGM6IFNvY2tldCkgPT4ge1xuICogICAvLyBcImNvbm5lY3Rpb25cIiBsaXN0ZW5lci5cbiAqICAgY29uc29sZS5sb2coXCJjbGllbnQgY29ubmVjdGVkXCIpO1xuICogICBjLm9uKFwiZW5kXCIsICgpID0+IHtcbiAqICAgICBjb25zb2xlLmxvZyhcImNsaWVudCBkaXNjb25uZWN0ZWRcIik7XG4gKiAgIH0pO1xuICogICBjLndyaXRlKFwiaGVsbG9cXHJcXG5cIik7XG4gKiAgIGMucGlwZShjKTtcbiAqIH0pO1xuICpcbiAqIHNlcnZlci5vbihcImVycm9yXCIsIChlcnI6IEVycm9yKSA9PiB7XG4gKiAgIHRocm93IGVycjtcbiAqIH0pO1xuICpcbiAqIHNlcnZlci5saXN0ZW4oODEyNCwgKCkgPT4ge1xuICogICBjb25zb2xlLmxvZyhcInNlcnZlciBib3VuZFwiKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogVGVzdCB0aGlzIGJ5IHVzaW5nIGB0ZWxuZXRgOlxuICpcbiAqIGBgYGNvbnNvbGVcbiAqICQgdGVsbmV0IGxvY2FsaG9zdCA4MTI0XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gb3B0aW9ucyBTb2NrZXQgb3B0aW9ucy5cbiAqIEBwYXJhbSBjb25uZWN0aW9uTGlzdGVuZXIgQXV0b21hdGljYWxseSBzZXQgYXMgYSBsaXN0ZW5lciBmb3IgdGhlIGBcImNvbm5lY3Rpb25cImAgZXZlbnQuXG4gKiBAcmV0dXJuIEEgYG5ldC5TZXJ2ZXJgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyKFxuICBvcHRpb25zPzogU2VydmVyT3B0aW9ucyxcbiAgY29ubmVjdGlvbkxpc3RlbmVyPzogQ29ubmVjdGlvbkxpc3RlbmVyLFxuKTogU2VydmVyIHtcbiAgcmV0dXJuIG5ldyBTZXJ2ZXIob3B0aW9ucywgY29ubmVjdGlvbkxpc3RlbmVyKTtcbn1cblxuZXhwb3J0IHsgaXNJUCwgaXNJUHY0LCBpc0lQdjYgfTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBfY3JlYXRlU2VydmVySGFuZGxlLFxuICBfbm9ybWFsaXplQXJncyxcbiAgaXNJUCxcbiAgaXNJUHY0LFxuICBpc0lQdjYsXG4gIGNvbm5lY3QsXG4gIGNyZWF0ZUNvbm5lY3Rpb24sXG4gIGNyZWF0ZVNlcnZlcixcbiAgU2VydmVyLFxuICBTb2NrZXQsXG4gIFN0cmVhbSxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0Usd0VBQXdFO0FBQ3hFLDRFQUE0RTtBQUM1RSx5Q0FBeUM7QUFFekMsU0FBUyxjQUFjLFFBQVEsY0FBYztBQUM3QyxTQUFTLFlBQVksUUFBUSxjQUFjO0FBQzNDLFNBQVMsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsb0JBQW9CLFFBQVEsb0JBQW9CO0FBQy9FLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFDckMsU0FDRSxhQUFhLEVBQ2IsMEJBQTBCLEVBQzFCLFVBQVUsRUFDVixXQUFXLFFBQ04sNEJBQTRCO0FBQ25DLFNBQ0UsMEJBQTBCLEVBQzFCLG9CQUFvQixFQUNwQixxQkFBcUIsRUFDckIsbUJBQW1CLEVBQ25CLHNCQUFzQixFQUN0QixnQkFBZ0IsRUFDaEIseUJBQXlCLEVBQ3pCLHNCQUFzQixFQUN0QixpQkFBaUIsRUFDakIsY0FBYyxFQUNkLHFCQUFxQixFQUNyQixnQkFBZ0IsRUFDaEIsdUJBQXVCLFFBQ2xCLHVCQUF1QjtBQUc5QixTQUFTLFlBQVksUUFBUSwyQkFBMkI7QUFDeEQsU0FDRSxnQkFBZ0IsRUFDaEIsT0FBTyxFQUNQLFNBQVMsRUFDVCxVQUFVLEVBQ1YsT0FBTyxFQUNQLFlBQVksRUFDWixZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLFlBQVksRUFDWixhQUFh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