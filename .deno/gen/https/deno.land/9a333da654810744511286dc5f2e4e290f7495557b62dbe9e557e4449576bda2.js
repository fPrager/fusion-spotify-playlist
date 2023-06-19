// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// deno-lint-ignore-file no-explicit-any
import { ObjectAssign, StringPrototypeReplace } from "./internal/primordials.mjs";
import assert from "./internal/assert.mjs";
import * as net from "./net.ts";
import { createSecureContext } from "./_tls_common.ts";
import { kStreamBaseField } from "./internal_binding/stream_wrap.ts";
import { connResetException } from "./internal/errors.ts";
import { emitWarning } from "./process.ts";
import { debuglog } from "./internal/util/debuglog.ts";
import { constants as TCPConstants, TCP } from "./internal_binding/tcp_wrap.ts";
import { constants as PipeConstants, Pipe } from "./internal_binding/pipe_wrap.ts";
import { EventEmitter } from "./events.ts";
import { kEmptyObject } from "./internal/util.mjs";
import { nextTick } from "./_next_tick.ts";
const kConnectOptions = Symbol("connect-options");
const kIsVerified = Symbol("verified");
const kPendingSession = Symbol("pendingSession");
const kRes = Symbol("res");
let debug = debuglog("tls", (fn)=>{
    debug = fn;
});
function onConnectEnd() {
    // NOTE: This logic is shared with _http_client.js
    if (!this._hadError) {
        const options = this[kConnectOptions];
        this._hadError = true;
        const error = connResetException("Client network socket disconnected " + "before secure TLS connection was " + "established");
        error.path = options.path;
        error.host = options.host;
        error.port = options.port;
        error.localAddress = options.localAddress;
        this.destroy(error);
    }
}
export class TLSSocket extends net.Socket {
    _tlsOptions;
    _secureEstablished;
    _securePending;
    _newSessionPending;
    _controlReleased;
    secureConnecting;
    _SNICallback;
    servername;
    alpnProtocol;
    authorized;
    authorizationError;
    [kRes];
    [kIsVerified];
    [kPendingSession];
    [kConnectOptions];
    ssl;
    _start;
    constructor(socket, opts = kEmptyObject){
        const tlsOptions = {
            ...opts
        };
        let hostname = tlsOptions?.secureContext?.servername;
        hostname = opts.host;
        tlsOptions.hostname = hostname;
        const _cert = tlsOptions?.secureContext?.cert;
        const _key = tlsOptions?.secureContext?.key;
        let caCerts = tlsOptions?.secureContext?.ca;
        if (typeof caCerts === "string") caCerts = [
            caCerts
        ];
        tlsOptions.caCerts = caCerts;
        super({
            handle: _wrapHandle(tlsOptions, socket),
            ...opts,
            manualStart: true
        });
        if (socket) {
            this._parent = socket;
        }
        this._tlsOptions = tlsOptions;
        this._secureEstablished = false;
        this._securePending = false;
        this._newSessionPending = false;
        this._controlReleased = false;
        this.secureConnecting = true;
        this._SNICallback = null;
        this.servername = null;
        this.alpnProtocol = null;
        this.authorized = false;
        this.authorizationError = null;
        this[kRes] = null;
        this[kIsVerified] = false;
        this[kPendingSession] = null;
        this.ssl = new class {
            verifyError() {
                return null; // Never fails, rejectUnauthorized is always true in Deno.
            }
        }();
        // deno-lint-ignore no-this-alias
        const tlssock = this;
        /** Wraps the given socket and adds the tls capability to the underlying
     * handle */ function _wrapHandle(tlsOptions, wrap) {
            let handle;
            if (wrap) {
                handle = wrap._handle;
            }
            const options = tlsOptions;
            if (!handle) {
                handle = options.pipe ? new Pipe(PipeConstants.SOCKET) : new TCP(TCPConstants.SOCKET);
            }
            // Patches `afterConnect` hook to replace TCP conn with TLS conn
            const afterConnect = handle.afterConnect;
            handle.afterConnect = async (req, status)=>{
                try {
                    const conn = await Deno.startTls(handle[kStreamBaseField], options);
                    tlssock.emit("secure");
                    tlssock.removeListener("end", onConnectEnd);
                    handle[kStreamBaseField] = conn;
                } catch  {
                // TODO(kt3k): Handle this
                }
                return afterConnect.call(handle, req, status);
            };
            handle.verifyError = function() {
                return null; // Never fails, rejectUnauthorized is always true in Deno.
            };
            // Pretends `handle` is `tls_wrap.wrap(handle, ...)` to make some npm modules happy
            // An example usage of `_parentWrap` in npm module:
            // https://github.com/szmarczak/http2-wrapper/blob/51eeaf59ff9344fb192b092241bfda8506983620/source/utils/js-stream-socket.js#L6
            handle._parent = handle;
            handle._parentWrap = wrap;
            return handle;
        }
    }
    _tlsError(err) {
        this.emit("_tlsError", err);
        if (this._controlReleased) {
            return err;
        }
        return null;
    }
    _releaseControl() {
        if (this._controlReleased) {
            return false;
        }
        this._controlReleased = true;
        this.removeListener("error", this._tlsError);
        return true;
    }
    getEphemeralKeyInfo() {
        return {};
    }
    isSessionReused() {
        return false;
    }
    setSession(_session) {
    // TODO(kt3k): implement this
    }
    setServername(_servername) {
    // TODO(kt3k): implement this
    }
    getPeerCertificate(_detailed) {
        // TODO(kt3k): implement this
        return {
            subject: "localhost",
            subjectaltname: "IP Address:127.0.0.1, IP Address:::1"
        };
    }
}
function normalizeConnectArgs(listArgs) {
    const args = net._normalizeArgs(listArgs);
    const options = args[0];
    const cb = args[1];
    // If args[0] was options, then normalize dealt with it.
    // If args[0] is port, or args[0], args[1] is host, port, we need to
    // find the options and merge them in, normalize's options has only
    // the host/port/path args that it knows about, not the tls options.
    // This means that options.host overrides a host arg.
    if (listArgs[1] !== null && typeof listArgs[1] === "object") {
        ObjectAssign(options, listArgs[1]);
    } else if (listArgs[2] !== null && typeof listArgs[2] === "object") {
        ObjectAssign(options, listArgs[2]);
    }
    return cb ? [
        options,
        cb
    ] : [
        options
    ];
}
let ipServernameWarned = false;
export function Server(options, listener) {
    return new ServerImpl(options, listener);
}
export class ServerImpl extends EventEmitter {
    listener;
    #closed;
    constructor(options, listener){
        super();
        this.options = options;
        this.#closed = false;
        if (listener) {
            this.on("secureConnection", listener);
        }
    }
    listen(port, callback) {
        const key = this.options.key?.toString();
        const cert = this.options.cert?.toString();
        // TODO(kt3k): The default host should be "localhost"
        const hostname = this.options.host ?? "0.0.0.0";
        this.listener = Deno.listenTls({
            port,
            hostname,
            cert,
            key
        });
        callback?.call(this);
        this.#listen(this.listener);
        return this;
    }
    async #listen(listener) {
        while(!this.#closed){
            try {
                // Creates TCP handle and socket directly from Deno.TlsConn.
                // This works as TLS socket. We don't use TLSSocket class for doing
                // this because Deno.startTls only supports client side tcp connection.
                const handle = new TCP(TCPConstants.SOCKET, await listener.accept());
                const socket = new net.Socket({
                    handle
                });
                this.emit("secureConnection", socket);
            } catch (e) {
                if (e instanceof Deno.errors.BadResource) {
                    this.#closed = true;
                }
            // swallow
            }
        }
    }
    close(cb) {
        if (this.listener) {
            this.listener.close();
        }
        cb?.();
        nextTick(()=>{
            this.emit("close");
        });
        return this;
    }
    address() {
        const addr = this.listener.addr;
        return {
            port: addr.port,
            address: addr.hostname
        };
    }
    options;
}
Server.prototype = ServerImpl.prototype;
export function createServer(options, listener) {
    return new ServerImpl(options, listener);
}
function onConnectSecure() {
    this.authorized = true;
    this.secureConnecting = false;
    debug("client emit secureConnect. authorized:", this.authorized);
    this.emit("secureConnect");
    this.removeListener("end", onConnectEnd);
}
export function connect(...args) {
    args = normalizeConnectArgs(args);
    let options = args[0];
    const cb = args[1];
    const allowUnauthorized = getAllowUnauthorized();
    options = {
        rejectUnauthorized: !allowUnauthorized,
        ciphers: DEFAULT_CIPHERS,
        checkServerIdentity,
        minDHSize: 1024,
        ...options
    };
    if (!options.keepAlive) {
        options.singleUse = true;
    }
    assert(typeof options.checkServerIdentity === "function");
    assert(typeof options.minDHSize === "number", "options.minDHSize is not a number: " + options.minDHSize);
    assert(options.minDHSize > 0, "options.minDHSize is not a positive number: " + options.minDHSize);
    const context = options.secureContext || createSecureContext(options);
    const tlssock = new TLSSocket(options.socket, {
        allowHalfOpen: options.allowHalfOpen,
        pipe: !!options.path,
        secureContext: context,
        isServer: false,
        requestCert: true,
        rejectUnauthorized: options.rejectUnauthorized !== false,
        session: options.session,
        ALPNProtocols: options.ALPNProtocols,
        requestOCSP: options.requestOCSP,
        enableTrace: options.enableTrace,
        pskCallback: options.pskCallback,
        highWaterMark: options.highWaterMark,
        onread: options.onread,
        signal: options.signal,
        ...options
    });
    // rejectUnauthorized property can be explicitly defined as `undefined`
    // causing the assignment to default value (`true`) fail. Before assigning
    // it to the tlssock connection options, explicitly check if it is false
    // and update rejectUnauthorized property. The property gets used by TLSSocket
    // connection handler to allow or reject connection if unauthorized
    options.rejectUnauthorized = options.rejectUnauthorized !== false;
    tlssock[kConnectOptions] = options;
    if (cb) {
        tlssock.once("secureConnect", cb);
    }
    if (!options.socket) {
        // If user provided the socket, it's their responsibility to manage its
        // connectivity. If we created one internally, we connect it.
        if (options.timeout) {
            tlssock.setTimeout(options.timeout);
        }
        tlssock.connect(options, tlssock._start);
    }
    tlssock._releaseControl();
    if (options.session) {
        tlssock.setSession(options.session);
    }
    if (options.servername) {
        if (!ipServernameWarned && net.isIP(options.servername)) {
            emitWarning("Setting the TLS ServerName to an IP address is not permitted by " + "RFC 6066. This will be ignored in a future version.", "DeprecationWarning", "DEP0123");
            ipServernameWarned = true;
        }
        tlssock.setServername(options.servername);
    }
    if (options.socket) {
        tlssock._start();
    }
    tlssock.on("secure", onConnectSecure);
    tlssock.prependListener("end", onConnectEnd);
    return tlssock;
}
function getAllowUnauthorized() {
    return false;
}
// TODO(kt3k): Implement this when Deno provides APIs for getting peer
// certificates.
export function checkServerIdentity(_hostname, _cert) {}
function unfqdn(host) {
    return StringPrototypeReplace(host, /[.]$/, "");
}
// Order matters. Mirrors ALL_CIPHER_SUITES from rustls/src/suites.rs but
// using openssl cipher names instead. Mutable in Node but not (yet) in Deno.
export const DEFAULT_CIPHERS = [
    // TLSv1.3 suites
    "AES256-GCM-SHA384",
    "AES128-GCM-SHA256",
    "TLS_CHACHA20_POLY1305_SHA256",
    // TLSv1.2 suites
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-CHACHA20-POLY1305",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-CHACHA20-POLY1305"
].join(":");
export default {
    TLSSocket,
    connect,
    createServer,
    checkServerIdentity,
    DEFAULT_CIPHERS,
    Server,
    unfqdn
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX3Rsc193cmFwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50IGFuZCBOb2RlIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBkZW5vLWxpbnQtaWdub3JlLWZpbGUgbm8tZXhwbGljaXQtYW55XG5cbmltcG9ydCB7XG4gIE9iamVjdEFzc2lnbixcbiAgU3RyaW5nUHJvdG90eXBlUmVwbGFjZSxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvcHJpbW9yZGlhbHMubWpzXCI7XG5pbXBvcnQgYXNzZXJ0IGZyb20gXCIuL2ludGVybmFsL2Fzc2VydC5tanNcIjtcbmltcG9ydCAqIGFzIG5ldCBmcm9tIFwiLi9uZXQudHNcIjtcbmltcG9ydCB7IGNyZWF0ZVNlY3VyZUNvbnRleHQgfSBmcm9tIFwiLi9fdGxzX2NvbW1vbi50c1wiO1xuaW1wb3J0IHsga1N0cmVhbUJhc2VGaWVsZCB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvc3RyZWFtX3dyYXAudHNcIjtcbmltcG9ydCB7IGNvbm5SZXNldEV4Y2VwdGlvbiB9IGZyb20gXCIuL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHsgZW1pdFdhcm5pbmcgfSBmcm9tIFwiLi9wcm9jZXNzLnRzXCI7XG5pbXBvcnQgeyBkZWJ1Z2xvZyB9IGZyb20gXCIuL2ludGVybmFsL3V0aWwvZGVidWdsb2cudHNcIjtcbmltcG9ydCB7IGNvbnN0YW50cyBhcyBUQ1BDb25zdGFudHMsIFRDUCB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvdGNwX3dyYXAudHNcIjtcbmltcG9ydCB7XG4gIGNvbnN0YW50cyBhcyBQaXBlQ29uc3RhbnRzLFxuICBQaXBlLFxufSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL3BpcGVfd3JhcC50c1wiO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSBcIi4vZXZlbnRzLnRzXCI7XG5pbXBvcnQgeyBrRW1wdHlPYmplY3QgfSBmcm9tIFwiLi9pbnRlcm5hbC91dGlsLm1qc1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi9fbmV4dF90aWNrLnRzXCI7XG5cbmNvbnN0IGtDb25uZWN0T3B0aW9ucyA9IFN5bWJvbChcImNvbm5lY3Qtb3B0aW9uc1wiKTtcbmNvbnN0IGtJc1ZlcmlmaWVkID0gU3ltYm9sKFwidmVyaWZpZWRcIik7XG5jb25zdCBrUGVuZGluZ1Nlc3Npb24gPSBTeW1ib2woXCJwZW5kaW5nU2Vzc2lvblwiKTtcbmNvbnN0IGtSZXMgPSBTeW1ib2woXCJyZXNcIik7XG5cbmxldCBkZWJ1ZyA9IGRlYnVnbG9nKFwidGxzXCIsIChmbikgPT4ge1xuICBkZWJ1ZyA9IGZuO1xufSk7XG5cbmZ1bmN0aW9uIG9uQ29ubmVjdEVuZCh0aGlzOiBhbnkpIHtcbiAgLy8gTk9URTogVGhpcyBsb2dpYyBpcyBzaGFyZWQgd2l0aCBfaHR0cF9jbGllbnQuanNcbiAgaWYgKCF0aGlzLl9oYWRFcnJvcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzW2tDb25uZWN0T3B0aW9uc107XG4gICAgdGhpcy5faGFkRXJyb3IgPSB0cnVlO1xuICAgIGNvbnN0IGVycm9yOiBhbnkgPSBjb25uUmVzZXRFeGNlcHRpb24oXG4gICAgICBcIkNsaWVudCBuZXR3b3JrIHNvY2tldCBkaXNjb25uZWN0ZWQgXCIgK1xuICAgICAgICBcImJlZm9yZSBzZWN1cmUgVExTIGNvbm5lY3Rpb24gd2FzIFwiICtcbiAgICAgICAgXCJlc3RhYmxpc2hlZFwiLFxuICAgICk7XG4gICAgZXJyb3IucGF0aCA9IG9wdGlvbnMucGF0aDtcbiAgICBlcnJvci5ob3N0ID0gb3B0aW9ucy5ob3N0O1xuICAgIGVycm9yLnBvcnQgPSBvcHRpb25zLnBvcnQ7XG4gICAgZXJyb3IubG9jYWxBZGRyZXNzID0gb3B0aW9ucy5sb2NhbEFkZHJlc3M7XG4gICAgdGhpcy5kZXN0cm95KGVycm9yKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVExTU29ja2V0IGV4dGVuZHMgbmV0LlNvY2tldCB7XG4gIF90bHNPcHRpb25zOiBhbnk7XG4gIF9zZWN1cmVFc3RhYmxpc2hlZDogYm9vbGVhbjtcbiAgX3NlY3VyZVBlbmRpbmc6IGJvb2xlYW47XG4gIF9uZXdTZXNzaW9uUGVuZGluZzogYm9vbGVhbjtcbiAgX2NvbnRyb2xSZWxlYXNlZDogYm9vbGVhbjtcbiAgc2VjdXJlQ29ubmVjdGluZzogYm9vbGVhbjtcbiAgX1NOSUNhbGxiYWNrOiBhbnk7XG4gIHNlcnZlcm5hbWU6IHN0cmluZyB8IG51bGw7XG4gIGFscG5Qcm90b2NvbDogYW55O1xuICBhdXRob3JpemVkOiBib29sZWFuO1xuICBhdXRob3JpemF0aW9uRXJyb3I6IGFueTtcbiAgW2tSZXNdOiBhbnk7XG4gIFtrSXNWZXJpZmllZF06IGJvb2xlYW47XG4gIFtrUGVuZGluZ1Nlc3Npb25dOiBhbnk7XG4gIFtrQ29ubmVjdE9wdGlvbnNdOiBhbnk7XG4gIHNzbDogYW55O1xuICBfc3RhcnQ6IGFueTtcbiAgY29uc3RydWN0b3Ioc29ja2V0OiBhbnksIG9wdHM6IGFueSA9IGtFbXB0eU9iamVjdCkge1xuICAgIGNvbnN0IHRsc09wdGlvbnMgPSB7IC4uLm9wdHMgfTtcblxuICAgIGxldCBob3N0bmFtZSA9IHRsc09wdGlvbnM/LnNlY3VyZUNvbnRleHQ/LnNlcnZlcm5hbWU7XG4gICAgaG9zdG5hbWUgPSBvcHRzLmhvc3Q7XG4gICAgdGxzT3B0aW9ucy5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuXG4gICAgY29uc3QgX2NlcnQgPSB0bHNPcHRpb25zPy5zZWN1cmVDb250ZXh0Py5jZXJ0O1xuICAgIGNvbnN0IF9rZXkgPSB0bHNPcHRpb25zPy5zZWN1cmVDb250ZXh0Py5rZXk7XG5cbiAgICBsZXQgY2FDZXJ0cyA9IHRsc09wdGlvbnM/LnNlY3VyZUNvbnRleHQ/LmNhO1xuICAgIGlmICh0eXBlb2YgY2FDZXJ0cyA9PT0gXCJzdHJpbmdcIikgY2FDZXJ0cyA9IFtjYUNlcnRzXTtcbiAgICB0bHNPcHRpb25zLmNhQ2VydHMgPSBjYUNlcnRzO1xuXG4gICAgc3VwZXIoe1xuICAgICAgaGFuZGxlOiBfd3JhcEhhbmRsZSh0bHNPcHRpb25zLCBzb2NrZXQpLFxuICAgICAgLi4ub3B0cyxcbiAgICAgIG1hbnVhbFN0YXJ0OiB0cnVlLCAvLyBUaGlzIHByZXZlbnRzIHByZW1hdHVyZSByZWFkaW5nIGZyb20gVExTIGhhbmRsZVxuICAgIH0pO1xuICAgIGlmIChzb2NrZXQpIHtcbiAgICAgIHRoaXMuX3BhcmVudCA9IHNvY2tldDtcbiAgICB9XG4gICAgdGhpcy5fdGxzT3B0aW9ucyA9IHRsc09wdGlvbnM7XG4gICAgdGhpcy5fc2VjdXJlRXN0YWJsaXNoZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9zZWN1cmVQZW5kaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fbmV3U2Vzc2lvblBlbmRpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9jb250cm9sUmVsZWFzZWQgPSBmYWxzZTtcbiAgICB0aGlzLnNlY3VyZUNvbm5lY3RpbmcgPSB0cnVlO1xuICAgIHRoaXMuX1NOSUNhbGxiYWNrID0gbnVsbDtcbiAgICB0aGlzLnNlcnZlcm5hbWUgPSBudWxsO1xuICAgIHRoaXMuYWxwblByb3RvY29sID0gbnVsbDtcbiAgICB0aGlzLmF1dGhvcml6ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmF1dGhvcml6YXRpb25FcnJvciA9IG51bGw7XG4gICAgdGhpc1trUmVzXSA9IG51bGw7XG4gICAgdGhpc1trSXNWZXJpZmllZF0gPSBmYWxzZTtcbiAgICB0aGlzW2tQZW5kaW5nU2Vzc2lvbl0gPSBudWxsO1xuXG4gICAgdGhpcy5zc2wgPSBuZXcgY2xhc3Mge1xuICAgICAgdmVyaWZ5RXJyb3IoKSB7XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBOZXZlciBmYWlscywgcmVqZWN0VW5hdXRob3JpemVkIGlzIGFsd2F5cyB0cnVlIGluIERlbm8uXG4gICAgICB9XG4gICAgfSgpO1xuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby10aGlzLWFsaWFzXG4gICAgY29uc3QgdGxzc29jayA9IHRoaXM7XG5cbiAgICAvKiogV3JhcHMgdGhlIGdpdmVuIHNvY2tldCBhbmQgYWRkcyB0aGUgdGxzIGNhcGFiaWxpdHkgdG8gdGhlIHVuZGVybHlpbmdcbiAgICAgKiBoYW5kbGUgKi9cbiAgICBmdW5jdGlvbiBfd3JhcEhhbmRsZSh0bHNPcHRpb25zOiBhbnksIHdyYXA6IG5ldC5Tb2NrZXQgfCB1bmRlZmluZWQpIHtcbiAgICAgIGxldCBoYW5kbGU6IGFueTtcblxuICAgICAgaWYgKHdyYXApIHtcbiAgICAgICAgaGFuZGxlID0gd3JhcC5faGFuZGxlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcHRpb25zID0gdGxzT3B0aW9ucztcbiAgICAgIGlmICghaGFuZGxlKSB7XG4gICAgICAgIGhhbmRsZSA9IG9wdGlvbnMucGlwZVxuICAgICAgICAgID8gbmV3IFBpcGUoUGlwZUNvbnN0YW50cy5TT0NLRVQpXG4gICAgICAgICAgOiBuZXcgVENQKFRDUENvbnN0YW50cy5TT0NLRVQpO1xuICAgICAgfVxuXG4gICAgICAvLyBQYXRjaGVzIGBhZnRlckNvbm5lY3RgIGhvb2sgdG8gcmVwbGFjZSBUQ1AgY29ubiB3aXRoIFRMUyBjb25uXG4gICAgICBjb25zdCBhZnRlckNvbm5lY3QgPSBoYW5kbGUuYWZ0ZXJDb25uZWN0O1xuICAgICAgaGFuZGxlLmFmdGVyQ29ubmVjdCA9IGFzeW5jIChyZXE6IGFueSwgc3RhdHVzOiBudW1iZXIpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjb25uID0gYXdhaXQgRGVuby5zdGFydFRscyhoYW5kbGVba1N0cmVhbUJhc2VGaWVsZF0sIG9wdGlvbnMpO1xuICAgICAgICAgIHRsc3NvY2suZW1pdChcInNlY3VyZVwiKTtcbiAgICAgICAgICB0bHNzb2NrLnJlbW92ZUxpc3RlbmVyKFwiZW5kXCIsIG9uQ29ubmVjdEVuZCk7XG4gICAgICAgICAgaGFuZGxlW2tTdHJlYW1CYXNlRmllbGRdID0gY29ubjtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gVE9ETyhrdDNrKTogSGFuZGxlIHRoaXNcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWZ0ZXJDb25uZWN0LmNhbGwoaGFuZGxlLCByZXEsIHN0YXR1cyk7XG4gICAgICB9O1xuXG4gICAgICAoaGFuZGxlIGFzIGFueSkudmVyaWZ5RXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBOZXZlciBmYWlscywgcmVqZWN0VW5hdXRob3JpemVkIGlzIGFsd2F5cyB0cnVlIGluIERlbm8uXG4gICAgICB9O1xuICAgICAgLy8gUHJldGVuZHMgYGhhbmRsZWAgaXMgYHRsc193cmFwLndyYXAoaGFuZGxlLCAuLi4pYCB0byBtYWtlIHNvbWUgbnBtIG1vZHVsZXMgaGFwcHlcbiAgICAgIC8vIEFuIGV4YW1wbGUgdXNhZ2Ugb2YgYF9wYXJlbnRXcmFwYCBpbiBucG0gbW9kdWxlOlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3N6bWFyY3phay9odHRwMi13cmFwcGVyL2Jsb2IvNTFlZWFmNTlmZjkzNDRmYjE5MmIwOTIyNDFiZmRhODUwNjk4MzYyMC9zb3VyY2UvdXRpbHMvanMtc3RyZWFtLXNvY2tldC5qcyNMNlxuICAgICAgaGFuZGxlLl9wYXJlbnQgPSBoYW5kbGU7XG4gICAgICBoYW5kbGUuX3BhcmVudFdyYXAgPSB3cmFwO1xuXG4gICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cbiAgfVxuXG4gIF90bHNFcnJvcihlcnI6IEVycm9yKSB7XG4gICAgdGhpcy5lbWl0KFwiX3Rsc0Vycm9yXCIsIGVycik7XG4gICAgaWYgKHRoaXMuX2NvbnRyb2xSZWxlYXNlZCkge1xuICAgICAgcmV0dXJuIGVycjtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBfcmVsZWFzZUNvbnRyb2woKSB7XG4gICAgaWYgKHRoaXMuX2NvbnRyb2xSZWxlYXNlZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLl9jb250cm9sUmVsZWFzZWQgPSB0cnVlO1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoXCJlcnJvclwiLCB0aGlzLl90bHNFcnJvcik7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBnZXRFcGhlbWVyYWxLZXlJbmZvKCkge1xuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIGlzU2Vzc2lvblJldXNlZCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBzZXRTZXNzaW9uKF9zZXNzaW9uOiBhbnkpIHtcbiAgICAvLyBUT0RPKGt0M2spOiBpbXBsZW1lbnQgdGhpc1xuICB9XG5cbiAgc2V0U2VydmVybmFtZShfc2VydmVybmFtZTogYW55KSB7XG4gICAgLy8gVE9ETyhrdDNrKTogaW1wbGVtZW50IHRoaXNcbiAgfVxuXG4gIGdldFBlZXJDZXJ0aWZpY2F0ZShfZGV0YWlsZWQ6IGJvb2xlYW4pIHtcbiAgICAvLyBUT0RPKGt0M2spOiBpbXBsZW1lbnQgdGhpc1xuICAgIHJldHVybiB7XG4gICAgICBzdWJqZWN0OiBcImxvY2FsaG9zdFwiLFxuICAgICAgc3ViamVjdGFsdG5hbWU6IFwiSVAgQWRkcmVzczoxMjcuMC4wLjEsIElQIEFkZHJlc3M6OjoxXCIsXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb25uZWN0QXJncyhsaXN0QXJnczogYW55KSB7XG4gIGNvbnN0IGFyZ3MgPSBuZXQuX25vcm1hbGl6ZUFyZ3MobGlzdEFyZ3MpO1xuICBjb25zdCBvcHRpb25zID0gYXJnc1swXTtcbiAgY29uc3QgY2IgPSBhcmdzWzFdO1xuXG4gIC8vIElmIGFyZ3NbMF0gd2FzIG9wdGlvbnMsIHRoZW4gbm9ybWFsaXplIGRlYWx0IHdpdGggaXQuXG4gIC8vIElmIGFyZ3NbMF0gaXMgcG9ydCwgb3IgYXJnc1swXSwgYXJnc1sxXSBpcyBob3N0LCBwb3J0LCB3ZSBuZWVkIHRvXG4gIC8vIGZpbmQgdGhlIG9wdGlvbnMgYW5kIG1lcmdlIHRoZW0gaW4sIG5vcm1hbGl6ZSdzIG9wdGlvbnMgaGFzIG9ubHlcbiAgLy8gdGhlIGhvc3QvcG9ydC9wYXRoIGFyZ3MgdGhhdCBpdCBrbm93cyBhYm91dCwgbm90IHRoZSB0bHMgb3B0aW9ucy5cbiAgLy8gVGhpcyBtZWFucyB0aGF0IG9wdGlvbnMuaG9zdCBvdmVycmlkZXMgYSBob3N0IGFyZy5cbiAgaWYgKGxpc3RBcmdzWzFdICE9PSBudWxsICYmIHR5cGVvZiBsaXN0QXJnc1sxXSA9PT0gXCJvYmplY3RcIikge1xuICAgIE9iamVjdEFzc2lnbihvcHRpb25zLCBsaXN0QXJnc1sxXSk7XG4gIH0gZWxzZSBpZiAobGlzdEFyZ3NbMl0gIT09IG51bGwgJiYgdHlwZW9mIGxpc3RBcmdzWzJdID09PSBcIm9iamVjdFwiKSB7XG4gICAgT2JqZWN0QXNzaWduKG9wdGlvbnMsIGxpc3RBcmdzWzJdKTtcbiAgfVxuXG4gIHJldHVybiBjYiA/IFtvcHRpb25zLCBjYl0gOiBbb3B0aW9uc107XG59XG5cbmxldCBpcFNlcnZlcm5hbWVXYXJuZWQgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIFNlcnZlcihvcHRpb25zOiBhbnksIGxpc3RlbmVyOiBhbnkpIHtcbiAgcmV0dXJuIG5ldyBTZXJ2ZXJJbXBsKG9wdGlvbnMsIGxpc3RlbmVyKTtcbn1cblxuZXhwb3J0IGNsYXNzIFNlcnZlckltcGwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBsaXN0ZW5lcj86IERlbm8uVGxzTGlzdGVuZXI7XG4gICNjbG9zZWQgPSBmYWxzZTtcbiAgY29uc3RydWN0b3IocHVibGljIG9wdGlvbnM6IGFueSwgbGlzdGVuZXI6IGFueSkge1xuICAgIHN1cGVyKCk7XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICB0aGlzLm9uKFwic2VjdXJlQ29ubmVjdGlvblwiLCBsaXN0ZW5lcik7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuKHBvcnQ6IGFueSwgY2FsbGJhY2s6IGFueSk6IHRoaXMge1xuICAgIGNvbnN0IGtleSA9IHRoaXMub3B0aW9ucy5rZXk/LnRvU3RyaW5nKCk7XG4gICAgY29uc3QgY2VydCA9IHRoaXMub3B0aW9ucy5jZXJ0Py50b1N0cmluZygpO1xuICAgIC8vIFRPRE8oa3Qzayk6IFRoZSBkZWZhdWx0IGhvc3Qgc2hvdWxkIGJlIFwibG9jYWxob3N0XCJcbiAgICBjb25zdCBob3N0bmFtZSA9IHRoaXMub3B0aW9ucy5ob3N0ID8/IFwiMC4wLjAuMFwiO1xuXG4gICAgdGhpcy5saXN0ZW5lciA9IERlbm8ubGlzdGVuVGxzKHsgcG9ydCwgaG9zdG5hbWUsIGNlcnQsIGtleSB9KTtcblxuICAgIGNhbGxiYWNrPy5jYWxsKHRoaXMpO1xuICAgIHRoaXMuI2xpc3Rlbih0aGlzLmxpc3RlbmVyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGFzeW5jICNsaXN0ZW4obGlzdGVuZXI6IERlbm8uVGxzTGlzdGVuZXIpIHtcbiAgICB3aGlsZSAoIXRoaXMuI2Nsb3NlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gQ3JlYXRlcyBUQ1AgaGFuZGxlIGFuZCBzb2NrZXQgZGlyZWN0bHkgZnJvbSBEZW5vLlRsc0Nvbm4uXG4gICAgICAgIC8vIFRoaXMgd29ya3MgYXMgVExTIHNvY2tldC4gV2UgZG9uJ3QgdXNlIFRMU1NvY2tldCBjbGFzcyBmb3IgZG9pbmdcbiAgICAgICAgLy8gdGhpcyBiZWNhdXNlIERlbm8uc3RhcnRUbHMgb25seSBzdXBwb3J0cyBjbGllbnQgc2lkZSB0Y3AgY29ubmVjdGlvbi5cbiAgICAgICAgY29uc3QgaGFuZGxlID0gbmV3IFRDUChUQ1BDb25zdGFudHMuU09DS0VULCBhd2FpdCBsaXN0ZW5lci5hY2NlcHQoKSk7XG4gICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBuZXQuU29ja2V0KHsgaGFuZGxlIH0pO1xuICAgICAgICB0aGlzLmVtaXQoXCJzZWN1cmVDb25uZWN0aW9uXCIsIHNvY2tldCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQmFkUmVzb3VyY2UpIHtcbiAgICAgICAgICB0aGlzLiNjbG9zZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHN3YWxsb3dcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjbG9zZShjYj86IChlcnI/OiBFcnJvcikgPT4gdm9pZCk6IHRoaXMge1xuICAgIGlmICh0aGlzLmxpc3RlbmVyKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyLmNsb3NlKCk7XG4gICAgfVxuICAgIGNiPy4oKTtcbiAgICBuZXh0VGljaygoKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoXCJjbG9zZVwiKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGFkZHJlc3MoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMubGlzdGVuZXIhLmFkZHIgYXMgRGVuby5OZXRBZGRyO1xuICAgIHJldHVybiB7XG4gICAgICBwb3J0OiBhZGRyLnBvcnQsXG4gICAgICBhZGRyZXNzOiBhZGRyLmhvc3RuYW1lLFxuICAgIH07XG4gIH1cbn1cblxuU2VydmVyLnByb3RvdHlwZSA9IFNlcnZlckltcGwucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyKG9wdGlvbnM6IGFueSwgbGlzdGVuZXI6IGFueSkge1xuICByZXR1cm4gbmV3IFNlcnZlckltcGwob3B0aW9ucywgbGlzdGVuZXIpO1xufVxuXG5mdW5jdGlvbiBvbkNvbm5lY3RTZWN1cmUodGhpczogVExTU29ja2V0KSB7XG4gIHRoaXMuYXV0aG9yaXplZCA9IHRydWU7XG4gIHRoaXMuc2VjdXJlQ29ubmVjdGluZyA9IGZhbHNlO1xuICBkZWJ1ZyhcImNsaWVudCBlbWl0IHNlY3VyZUNvbm5lY3QuIGF1dGhvcml6ZWQ6XCIsIHRoaXMuYXV0aG9yaXplZCk7XG4gIHRoaXMuZW1pdChcInNlY3VyZUNvbm5lY3RcIik7XG5cbiAgdGhpcy5yZW1vdmVMaXN0ZW5lcihcImVuZFwiLCBvbkNvbm5lY3RFbmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29ubmVjdCguLi5hcmdzOiBhbnlbXSkge1xuICBhcmdzID0gbm9ybWFsaXplQ29ubmVjdEFyZ3MoYXJncyk7XG4gIGxldCBvcHRpb25zID0gYXJnc1swXTtcbiAgY29uc3QgY2IgPSBhcmdzWzFdO1xuICBjb25zdCBhbGxvd1VuYXV0aG9yaXplZCA9IGdldEFsbG93VW5hdXRob3JpemVkKCk7XG5cbiAgb3B0aW9ucyA9IHtcbiAgICByZWplY3RVbmF1dGhvcml6ZWQ6ICFhbGxvd1VuYXV0aG9yaXplZCxcbiAgICBjaXBoZXJzOiBERUZBVUxUX0NJUEhFUlMsXG4gICAgY2hlY2tTZXJ2ZXJJZGVudGl0eSxcbiAgICBtaW5ESFNpemU6IDEwMjQsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICBpZiAoIW9wdGlvbnMua2VlcEFsaXZlKSB7XG4gICAgb3B0aW9ucy5zaW5nbGVVc2UgPSB0cnVlO1xuICB9XG5cbiAgYXNzZXJ0KHR5cGVvZiBvcHRpb25zLmNoZWNrU2VydmVySWRlbnRpdHkgPT09IFwiZnVuY3Rpb25cIik7XG4gIGFzc2VydChcbiAgICB0eXBlb2Ygb3B0aW9ucy5taW5ESFNpemUgPT09IFwibnVtYmVyXCIsXG4gICAgXCJvcHRpb25zLm1pbkRIU2l6ZSBpcyBub3QgYSBudW1iZXI6IFwiICsgb3B0aW9ucy5taW5ESFNpemUsXG4gICk7XG4gIGFzc2VydChcbiAgICBvcHRpb25zLm1pbkRIU2l6ZSA+IDAsXG4gICAgXCJvcHRpb25zLm1pbkRIU2l6ZSBpcyBub3QgYSBwb3NpdGl2ZSBudW1iZXI6IFwiICtcbiAgICAgIG9wdGlvbnMubWluREhTaXplLFxuICApO1xuXG4gIGNvbnN0IGNvbnRleHQgPSBvcHRpb25zLnNlY3VyZUNvbnRleHQgfHwgY3JlYXRlU2VjdXJlQ29udGV4dChvcHRpb25zKTtcblxuICBjb25zdCB0bHNzb2NrID0gbmV3IFRMU1NvY2tldChvcHRpb25zLnNvY2tldCwge1xuICAgIGFsbG93SGFsZk9wZW46IG9wdGlvbnMuYWxsb3dIYWxmT3BlbixcbiAgICBwaXBlOiAhIW9wdGlvbnMucGF0aCxcbiAgICBzZWN1cmVDb250ZXh0OiBjb250ZXh0LFxuICAgIGlzU2VydmVyOiBmYWxzZSxcbiAgICByZXF1ZXN0Q2VydDogdHJ1ZSxcbiAgICByZWplY3RVbmF1dGhvcml6ZWQ6IG9wdGlvbnMucmVqZWN0VW5hdXRob3JpemVkICE9PSBmYWxzZSxcbiAgICBzZXNzaW9uOiBvcHRpb25zLnNlc3Npb24sXG4gICAgQUxQTlByb3RvY29sczogb3B0aW9ucy5BTFBOUHJvdG9jb2xzLFxuICAgIHJlcXVlc3RPQ1NQOiBvcHRpb25zLnJlcXVlc3RPQ1NQLFxuICAgIGVuYWJsZVRyYWNlOiBvcHRpb25zLmVuYWJsZVRyYWNlLFxuICAgIHBza0NhbGxiYWNrOiBvcHRpb25zLnBza0NhbGxiYWNrLFxuICAgIGhpZ2hXYXRlck1hcms6IG9wdGlvbnMuaGlnaFdhdGVyTWFyayxcbiAgICBvbnJlYWQ6IG9wdGlvbnMub25yZWFkLFxuICAgIHNpZ25hbDogb3B0aW9ucy5zaWduYWwsXG4gICAgLi4ub3B0aW9ucywgLy8gQ2F2ZWF0IGVtcHRvcjogTm9kZSBkb2VzIG5vdCBkbyB0aGlzLlxuICB9KTtcblxuICAvLyByZWplY3RVbmF1dGhvcml6ZWQgcHJvcGVydHkgY2FuIGJlIGV4cGxpY2l0bHkgZGVmaW5lZCBhcyBgdW5kZWZpbmVkYFxuICAvLyBjYXVzaW5nIHRoZSBhc3NpZ25tZW50IHRvIGRlZmF1bHQgdmFsdWUgKGB0cnVlYCkgZmFpbC4gQmVmb3JlIGFzc2lnbmluZ1xuICAvLyBpdCB0byB0aGUgdGxzc29jayBjb25uZWN0aW9uIG9wdGlvbnMsIGV4cGxpY2l0bHkgY2hlY2sgaWYgaXQgaXMgZmFsc2VcbiAgLy8gYW5kIHVwZGF0ZSByZWplY3RVbmF1dGhvcml6ZWQgcHJvcGVydHkuIFRoZSBwcm9wZXJ0eSBnZXRzIHVzZWQgYnkgVExTU29ja2V0XG4gIC8vIGNvbm5lY3Rpb24gaGFuZGxlciB0byBhbGxvdyBvciByZWplY3QgY29ubmVjdGlvbiBpZiB1bmF1dGhvcml6ZWRcbiAgb3B0aW9ucy5yZWplY3RVbmF1dGhvcml6ZWQgPSBvcHRpb25zLnJlamVjdFVuYXV0aG9yaXplZCAhPT0gZmFsc2U7XG5cbiAgdGxzc29ja1trQ29ubmVjdE9wdGlvbnNdID0gb3B0aW9ucztcblxuICBpZiAoY2IpIHtcbiAgICB0bHNzb2NrLm9uY2UoXCJzZWN1cmVDb25uZWN0XCIsIGNiKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucy5zb2NrZXQpIHtcbiAgICAvLyBJZiB1c2VyIHByb3ZpZGVkIHRoZSBzb2NrZXQsIGl0J3MgdGhlaXIgcmVzcG9uc2liaWxpdHkgdG8gbWFuYWdlIGl0c1xuICAgIC8vIGNvbm5lY3Rpdml0eS4gSWYgd2UgY3JlYXRlZCBvbmUgaW50ZXJuYWxseSwgd2UgY29ubmVjdCBpdC5cbiAgICBpZiAob3B0aW9ucy50aW1lb3V0KSB7XG4gICAgICB0bHNzb2NrLnNldFRpbWVvdXQob3B0aW9ucy50aW1lb3V0KTtcbiAgICB9XG5cbiAgICB0bHNzb2NrLmNvbm5lY3Qob3B0aW9ucywgdGxzc29jay5fc3RhcnQpO1xuICB9XG5cbiAgdGxzc29jay5fcmVsZWFzZUNvbnRyb2woKTtcblxuICBpZiAob3B0aW9ucy5zZXNzaW9uKSB7XG4gICAgdGxzc29jay5zZXRTZXNzaW9uKG9wdGlvbnMuc2Vzc2lvbik7XG4gIH1cblxuICBpZiAob3B0aW9ucy5zZXJ2ZXJuYW1lKSB7XG4gICAgaWYgKCFpcFNlcnZlcm5hbWVXYXJuZWQgJiYgbmV0LmlzSVAob3B0aW9ucy5zZXJ2ZXJuYW1lKSkge1xuICAgICAgZW1pdFdhcm5pbmcoXG4gICAgICAgIFwiU2V0dGluZyB0aGUgVExTIFNlcnZlck5hbWUgdG8gYW4gSVAgYWRkcmVzcyBpcyBub3QgcGVybWl0dGVkIGJ5IFwiICtcbiAgICAgICAgICBcIlJGQyA2MDY2LiBUaGlzIHdpbGwgYmUgaWdub3JlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uLlwiLFxuICAgICAgICBcIkRlcHJlY2F0aW9uV2FybmluZ1wiLFxuICAgICAgICBcIkRFUDAxMjNcIixcbiAgICAgICk7XG4gICAgICBpcFNlcnZlcm5hbWVXYXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICB0bHNzb2NrLnNldFNlcnZlcm5hbWUob3B0aW9ucy5zZXJ2ZXJuYW1lKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLnNvY2tldCkge1xuICAgIHRsc3NvY2suX3N0YXJ0KCk7XG4gIH1cblxuICB0bHNzb2NrLm9uKFwic2VjdXJlXCIsIG9uQ29ubmVjdFNlY3VyZSk7XG4gIHRsc3NvY2sucHJlcGVuZExpc3RlbmVyKFwiZW5kXCIsIG9uQ29ubmVjdEVuZCk7XG5cbiAgcmV0dXJuIHRsc3NvY2s7XG59XG5cbmZ1bmN0aW9uIGdldEFsbG93VW5hdXRob3JpemVkKCkge1xuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIFRPRE8oa3Qzayk6IEltcGxlbWVudCB0aGlzIHdoZW4gRGVubyBwcm92aWRlcyBBUElzIGZvciBnZXR0aW5nIHBlZXJcbi8vIGNlcnRpZmljYXRlcy5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja1NlcnZlcklkZW50aXR5KF9ob3N0bmFtZTogc3RyaW5nLCBfY2VydDogYW55KSB7XG59XG5cbmZ1bmN0aW9uIHVuZnFkbihob3N0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gU3RyaW5nUHJvdG90eXBlUmVwbGFjZShob3N0LCAvWy5dJC8sIFwiXCIpO1xufVxuXG4vLyBPcmRlciBtYXR0ZXJzLiBNaXJyb3JzIEFMTF9DSVBIRVJfU1VJVEVTIGZyb20gcnVzdGxzL3NyYy9zdWl0ZXMucnMgYnV0XG4vLyB1c2luZyBvcGVuc3NsIGNpcGhlciBuYW1lcyBpbnN0ZWFkLiBNdXRhYmxlIGluIE5vZGUgYnV0IG5vdCAoeWV0KSBpbiBEZW5vLlxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ0lQSEVSUyA9IFtcbiAgLy8gVExTdjEuMyBzdWl0ZXNcbiAgXCJBRVMyNTYtR0NNLVNIQTM4NFwiLFxuICBcIkFFUzEyOC1HQ00tU0hBMjU2XCIsXG4gIFwiVExTX0NIQUNIQTIwX1BPTFkxMzA1X1NIQTI1NlwiLFxuICAvLyBUTFN2MS4yIHN1aXRlc1xuICBcIkVDREhFLUVDRFNBLUFFUzI1Ni1HQ00tU0hBMzg0XCIsXG4gIFwiRUNESEUtRUNEU0EtQUVTMTI4LUdDTS1TSEEyNTZcIixcbiAgXCJFQ0RIRS1FQ0RTQS1DSEFDSEEyMC1QT0xZMTMwNVwiLFxuICBcIkVDREhFLVJTQS1BRVMyNTYtR0NNLVNIQTM4NFwiLFxuICBcIkVDREhFLVJTQS1BRVMxMjgtR0NNLVNIQTI1NlwiLFxuICBcIkVDREhFLVJTQS1DSEFDSEEyMC1QT0xZMTMwNVwiLFxuXS5qb2luKFwiOlwiKTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBUTFNTb2NrZXQsXG4gIGNvbm5lY3QsXG4gIGNyZWF0ZVNlcnZlcixcbiAgY2hlY2tTZXJ2ZXJJZGVudGl0eSxcbiAgREVGQVVMVF9DSVBIRVJTLFxuICBTZXJ2ZXIsXG4gIHVuZnFkbixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUM1RSx3Q0FBd0M7QUFFeEMsU0FDRSxZQUFZLEVBQ1osc0JBQXNCLFFBQ2pCLDZCQUE2QjtBQUNwQyxPQUFPLFlBQVksd0JBQXdCO0FBQzNDLFlBQVksU0FBUyxXQUFXO0FBQ2hDLFNBQVMsbUJBQW1CLFFBQVEsbUJBQW1CO0FBQ3ZELFNBQVMsZ0JBQWdCLFFBQVEsb0NBQW9DO0FBQ3JFLFNBQVMsa0JBQWtCLFFBQVEsdUJBQXVCO0FBQzFELFNBQVMsV0FBVyxRQUFRLGVBQWU7QUFDM0MsU0FBUyxRQUFRLFFBQVEsOEJBQThCO0FBQ3ZELFNBQVMsYUFBYSxZQUFZLEVBQUUsR0FBRyxRQUFRLGlDQUFpQztBQUNoRixTQUNFLGFBQWEsYUFBYSxFQUMxQixJQUFJLFFBQ0Msa0NBQWtDO0FBQ3pDLFNBQVMsWUFBWSxRQUFRLGNBQWM7QUFD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