// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { getDefaultHighWaterMark } from "./internal/streams/state.mjs";
import assert from "./internal/assert.mjs";
import EE from "./events.ts";
import { Stream } from "./stream.ts";
import * as internalUtil from "./internal/util.mjs";
import { kNeedDrain, kOutHeaders, utcDate } from "./internal/http.ts";
import { Buffer } from "./buffer.ts";
import { _checkInvalidHeaderChar as checkInvalidHeaderChar, _checkIsHttpToken as checkIsHttpToken, chunkExpression as RE_TE_CHUNKED } from "./_http_common.ts";
import { defaultTriggerAsyncIdScope, symbols } from "./internal/async_hooks.ts";
// deno-lint-ignore camelcase
const { async_id_symbol  } = symbols;
import { ERR_HTTP_HEADERS_SENT, ERR_HTTP_INVALID_HEADER_VALUE, ERR_HTTP_TRAILER_INVALID, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_CHAR, ERR_INVALID_HTTP_TOKEN, ERR_METHOD_NOT_IMPLEMENTED, ERR_STREAM_ALREADY_FINISHED, ERR_STREAM_CANNOT_PIPE, ERR_STREAM_DESTROYED, ERR_STREAM_NULL_VALUES, ERR_STREAM_WRITE_AFTER_END, hideStackFrames } from "./internal/errors.ts";
import { validateString } from "./internal/validators.mjs";
import { isUint8Array } from "./internal/util/types.ts";
import { debuglog } from "./internal/util/debuglog.ts";
let debug = debuglog("http", (fn)=>{
    debug = fn;
});
const HIGH_WATER_MARK = getDefaultHighWaterMark();
const kCorked = Symbol("corked");
const nop = ()=>{};
const RE_CONN_CLOSE = /(?:^|\W)close(?:$|\W)/i;
// isCookieField performs a case-insensitive comparison of a provided string
// against the word "cookie." As of V8 6.6 this is faster than handrolling or
// using a case-insensitive RegExp.
function isCookieField(s) {
    return s.length === 6 && s.toLowerCase() === "cookie";
}
// deno-lint-ignore no-explicit-any
export function OutgoingMessage() {
    Stream.call(this);
    // Queue that holds all currently pending data, until the response will be
    // assigned to the socket (until it will its turn in the HTTP pipeline).
    this.outputData = [];
    // `outputSize` is an approximate measure of how much data is queued on this
    // response. `_onPendingData` will be invoked to update similar global
    // per-connection counter. That counter will be used to pause/unpause the
    // TCP socket and HTTP Parser and thus handle the backpressure.
    this.outputSize = 0;
    this.writable = true;
    this.destroyed = false;
    this._last = false;
    this.chunkedEncoding = false;
    this.shouldKeepAlive = true;
    this.maxRequestsOnConnectionReached = false;
    this._defaultKeepAlive = true;
    this.useChunkedEncodingByDefault = true;
    this.sendDate = false;
    this._removedConnection = false;
    this._removedContLen = false;
    this._removedTE = false;
    this._contentLength = null;
    this._hasBody = true;
    this._trailer = "";
    this[kNeedDrain] = false;
    this.finished = false;
    this._headerSent = false;
    this[kCorked] = 0;
    this._closed = false;
    this.socket = null;
    this._header = null;
    this[kOutHeaders] = null;
    this._keepAliveTimeout = 0;
    this._onPendingData = nop;
}
Object.setPrototypeOf(OutgoingMessage.prototype, Stream.prototype);
Object.setPrototypeOf(OutgoingMessage, Stream);
Object.defineProperty(OutgoingMessage.prototype, "writableFinished", {
    get () {
        return this.finished && this.outputSize === 0 && (!this.socket || this.socket.writableLength === 0);
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableObjectMode", {
    get () {
        return false;
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableLength", {
    get () {
        return this.outputSize + (this.socket ? this.socket.writableLength : 0);
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableHighWaterMark", {
    get () {
        return this.socket ? this.socket.writableHighWaterMark : HIGH_WATER_MARK;
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableCorked", {
    get () {
        const corked = this.socket ? this.socket.writableCorked : 0;
        return corked + this[kCorked];
    }
});
Object.defineProperty(OutgoingMessage.prototype, "_headers", {
    get: internalUtil.deprecate(// deno-lint-ignore no-explicit-any
    function() {
        return this.getHeaders();
    }, "OutgoingMessage.prototype._headers is deprecated", "DEP0066"),
    set: internalUtil.deprecate(// deno-lint-ignore no-explicit-any
    function(val) {
        if (val == null) {
            this[kOutHeaders] = null;
        } else if (typeof val === "object") {
            const headers = this[kOutHeaders] = Object.create(null);
            const keys = Object.keys(val);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for(let i = 0; i < keys.length; ++i){
                const name = keys[i];
                headers[name.toLowerCase()] = [
                    name,
                    val[name]
                ];
            }
        }
    }, "OutgoingMessage.prototype._headers is deprecated", "DEP0066")
});
Object.defineProperty(OutgoingMessage.prototype, "connection", {
    get: function() {
        return this.socket;
    },
    set: function(val) {
        this.socket = val;
    }
});
Object.defineProperty(OutgoingMessage.prototype, "_headerNames", {
    get: internalUtil.deprecate(// deno-lint-ignore no-explicit-any
    function() {
        const headers = this[kOutHeaders];
        if (headers !== null) {
            const out = Object.create(null);
            const keys = Object.keys(headers);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for(let i = 0; i < keys.length; ++i){
                const key = keys[i];
                const val = headers[key][0];
                out[key] = val;
            }
            return out;
        }
        return null;
    }, "OutgoingMessage.prototype._headerNames is deprecated", "DEP0066"),
    set: internalUtil.deprecate(// deno-lint-ignore no-explicit-any
    function(val) {
        if (typeof val === "object" && val !== null) {
            const headers = this[kOutHeaders];
            if (!headers) {
                return;
            }
            const keys = Object.keys(val);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for(let i = 0; i < keys.length; ++i){
                const header = headers[keys[i]];
                if (header) {
                    header[0] = val[keys[i]];
                }
            }
        }
    }, "OutgoingMessage.prototype._headerNames is deprecated", "DEP0066")
});
OutgoingMessage.prototype._renderHeaders = function _renderHeaders() {
    if (this._header) {
        throw new ERR_HTTP_HEADERS_SENT("render");
    }
    const headersMap = this[kOutHeaders];
    // deno-lint-ignore no-explicit-any
    const headers = {};
    if (headersMap !== null) {
        const keys = Object.keys(headersMap);
        // Retain for(;;) loop for performance reasons
        // Refs: https://github.com/nodejs/node/pull/30958
        for(let i = 0, l = keys.length; i < l; i++){
            const key = keys[i];
            headers[headersMap[key][0]] = headersMap[key][1];
        }
    }
    return headers;
};
OutgoingMessage.prototype.cork = function() {
    if (this.socket) {
        this.socket.cork();
    } else {
        this[kCorked]++;
    }
};
OutgoingMessage.prototype.uncork = function() {
    if (this.socket) {
        this.socket.uncork();
    } else if (this[kCorked]) {
        this[kCorked]--;
    }
};
OutgoingMessage.prototype.setTimeout = function setTimeout(msecs, callback) {
    if (callback) {
        this.on("timeout", callback);
    }
    if (!this.socket) {
        // deno-lint-ignore no-explicit-any
        this.once("socket", function socketSetTimeoutOnConnect(socket) {
            socket.setTimeout(msecs);
        });
    } else {
        this.socket.setTimeout(msecs);
    }
    return this;
};
// It's possible that the socket will be destroyed, and removed from
// any messages, before ever calling this.  In that case, just skip
// it, since something else is destroying this connection anyway.
OutgoingMessage.prototype.destroy = function destroy(error) {
    if (this.destroyed) {
        return this;
    }
    this.destroyed = true;
    if (this.socket) {
        this.socket.destroy(error);
    } else {
        // deno-lint-ignore no-explicit-any
        this.once("socket", function socketDestroyOnConnect(socket) {
            socket.destroy(error);
        });
    }
    return this;
};
// This abstract either writing directly to the socket or buffering it.
OutgoingMessage.prototype._send = function _send(// deno-lint-ignore no-explicit-any
data, encoding, callback) {
    // This is a shameful hack to get the headers and first body chunk onto
    // the same packet. Future versions of Node are going to take care of
    // this at a lower level and in a more general way.
    if (!this._headerSent) {
        if (typeof data === "string" && (encoding === "utf8" || encoding === "latin1" || !encoding)) {
            data = this._header + data;
        } else {
            const header = this._header;
            this.outputData.unshift({
                data: header,
                encoding: "latin1",
                callback: null
            });
            this.outputSize += header.length;
            this._onPendingData(header.length);
        }
        this._headerSent = true;
    }
    return this._writeRaw(data, encoding, callback);
};
OutgoingMessage.prototype._writeRaw = _writeRaw;
function _writeRaw(// deno-lint-ignore no-explicit-any
data, encoding, callback) {
    const conn = this.socket;
    if (conn && conn.destroyed) {
        // The socket was destroyed. If we're still trying to write to it,
        // then we haven't gotten the 'close' event yet.
        return false;
    }
    if (typeof encoding === "function") {
        callback = encoding;
        encoding = null;
    }
    if (conn && conn._httpMessage === this && conn.writable) {
        // There might be pending data in the this.output buffer.
        if (this.outputData.length) {
            this._flushOutput(conn);
        }
        // Directly write to socket.
        return conn.write(data, encoding, callback);
    }
    // Buffer, as long as we're not destroyed.
    this.outputData.push({
        data,
        encoding,
        callback
    });
    this.outputSize += data.length;
    this._onPendingData(data.length);
    return this.outputSize < HIGH_WATER_MARK;
}
OutgoingMessage.prototype._storeHeader = _storeHeader;
// deno-lint-ignore no-explicit-any
function _storeHeader(firstLine, headers) {
    // firstLine in the case of request is: 'GET /index.html HTTP/1.1\r\n'
    // in the case of response it is: 'HTTP/1.1 200 OK\r\n'
    const state = {
        connection: false,
        contLen: false,
        te: false,
        date: false,
        expect: false,
        trailer: false,
        header: firstLine
    };
    if (headers) {
        if (headers === this[kOutHeaders]) {
            for(const key in headers){
                const entry = headers[key];
                processHeader(this, state, entry[0], entry[1], false);
            }
        } else if (Array.isArray(headers)) {
            if (headers.length && Array.isArray(headers[0])) {
                for(let i = 0; i < headers.length; i++){
                    const entry1 = headers[i];
                    processHeader(this, state, entry1[0], entry1[1], true);
                }
            } else {
                if (headers.length % 2 !== 0) {
                    throw new ERR_INVALID_ARG_VALUE("headers", headers);
                }
                for(let n = 0; n < headers.length; n += 2){
                    processHeader(this, state, headers[n + 0], headers[n + 1], true);
                }
            }
        } else {
            for(const key1 in headers){
                if (Object.hasOwn(headers, key1)) {
                    processHeader(this, state, key1, headers[key1], true);
                }
            }
        }
    }
    let { header  } = state;
    // Date header
    if (this.sendDate && !state.date) {
        header += "Date: " + utcDate() + "\r\n";
    }
    // Force the connection to close when the response is a 204 No Content or
    // a 304 Not Modified and the user has set a "Transfer-Encoding: chunked"
    // header.
    //
    // RFC 2616 mandates that 204 and 304 responses MUST NOT have a body but
    // node.js used to send out a zero chunk anyway to accommodate clients
    // that don't have special handling for those responses.
    //
    // It was pointed out that this might confuse reverse proxies to the point
    // of creating security liabilities, so suppress the zero chunk and force
    // the connection to close.
    if (this.chunkedEncoding && (this.statusCode === 204 || this.statusCode === 304)) {
        debug(this.statusCode + " response should not use chunked encoding," + " closing connection.");
        this.chunkedEncoding = false;
        this.shouldKeepAlive = false;
    }
    // keep-alive logic
    if (this._removedConnection) {
        this._last = true;
        this.shouldKeepAlive = false;
    } else if (!state.connection) {
        const shouldSendKeepAlive = this.shouldKeepAlive && (state.contLen || this.useChunkedEncodingByDefault || this.agent);
        if (shouldSendKeepAlive && this.maxRequestsOnConnectionReached) {
            header += "Connection: close\r\n";
        } else if (shouldSendKeepAlive) {
            header += "Connection: keep-alive\r\n";
            if (this._keepAliveTimeout && this._defaultKeepAlive) {
                const timeoutSeconds = Math.floor(this._keepAliveTimeout / 1000);
                header += `Keep-Alive: timeout=${timeoutSeconds}\r\n`;
            }
        } else {
            this._last = true;
            header += "Connection: close\r\n";
        }
    }
    if (!state.contLen && !state.te) {
        if (!this._hasBody) {
            // Make sure we don't end the 0\r\n\r\n at the end of the message.
            this.chunkedEncoding = false;
        } else if (!this.useChunkedEncodingByDefault) {
            this._last = true;
        } else if (!state.trailer && !this._removedContLen && typeof this._contentLength === "number") {
            header += "Content-Length: " + this._contentLength + "\r\n";
        } else if (!this._removedTE) {
            header += "Transfer-Encoding: chunked\r\n";
            this.chunkedEncoding = true;
        } else {
            // We should only be able to get here if both Content-Length and
            // Transfer-Encoding are removed by the user.
            // See: test/parallel/test-http-remove-header-stays-removed.js
            debug("Both Content-Length and Transfer-Encoding are removed");
        }
    }
    // Test non-chunked message does not have trailer header set,
    // message will be terminated by the first empty line after the
    // header fields, regardless of the header fields present in the
    // message, and thus cannot contain a message body or 'trailers'.
    if (this.chunkedEncoding !== true && state.trailer) {
        throw new ERR_HTTP_TRAILER_INVALID();
    }
    this._header = header + "\r\n";
    this._headerSent = false;
    // Wait until the first body chunk, or close(), is sent to flush,
    // UNLESS we're sending Expect: 100-continue.
    if (state.expect) this._send("");
}
function processHeader(// deno-lint-ignore no-explicit-any
self, // deno-lint-ignore no-explicit-any
state, // deno-lint-ignore no-explicit-any
key, // deno-lint-ignore no-explicit-any
value, // deno-lint-ignore no-explicit-any
validate) {
    if (validate) {
        validateHeaderName(key);
    }
    if (Array.isArray(value)) {
        if (value.length < 2 || !isCookieField(key)) {
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for(let i = 0; i < value.length; i++){
                storeHeader(self, state, key, value[i], validate);
            }
            return;
        }
        value = value.join("; ");
    }
    storeHeader(self, state, key, value, validate);
}
function storeHeader(// deno-lint-ignore no-explicit-any
self, // deno-lint-ignore no-explicit-any
state, // deno-lint-ignore no-explicit-any
key, // deno-lint-ignore no-explicit-any
value, // deno-lint-ignore no-explicit-any
validate) {
    if (validate) {
        validateHeaderValue(key, value);
    }
    state.header += key + ": " + value + "\r\n";
    matchHeader(self, state, key, value);
}
// deno-lint-ignore no-explicit-any
function matchHeader(self, state, field, value) {
    if (field.length < 4 || field.length > 17) {
        return;
    }
    field = field.toLowerCase();
    switch(field){
        case "connection":
            state.connection = true;
            self._removedConnection = false;
            if (RE_CONN_CLOSE.test(value)) {
                self._last = true;
            } else {
                self.shouldKeepAlive = true;
            }
            break;
        case "transfer-encoding":
            state.te = true;
            self._removedTE = false;
            if (RE_TE_CHUNKED.test(value)) {
                self.chunkedEncoding = true;
            }
            break;
        case "content-length":
            state.contLen = true;
            self._removedContLen = false;
            break;
        case "date":
        case "expect":
        case "trailer":
            state[field] = true;
            break;
        case "keep-alive":
            self._defaultKeepAlive = false;
            break;
    }
}
export const validateHeaderName = hideStackFrames((name)=>{
    if (typeof name !== "string" || !name || !checkIsHttpToken(name)) {
        throw new ERR_INVALID_HTTP_TOKEN("Header name", name);
    }
});
export const validateHeaderValue = hideStackFrames((name, value)=>{
    if (value === undefined) {
        throw new ERR_HTTP_INVALID_HEADER_VALUE(value, name);
    }
    if (checkInvalidHeaderChar(value)) {
        debug('Header "%s" contains invalid characters', name);
        throw new ERR_INVALID_CHAR("header content", name);
    }
});
OutgoingMessage.prototype.setHeader = function setHeader(name, value) {
    if (this._header) {
        throw new ERR_HTTP_HEADERS_SENT("set");
    }
    validateHeaderName(name);
    validateHeaderValue(name, value);
    let headers = this[kOutHeaders];
    if (headers === null) {
        this[kOutHeaders] = headers = Object.create(null);
    }
    headers[name.toLowerCase()] = [
        name,
        value
    ];
    return this;
};
OutgoingMessage.prototype.getHeader = function getHeader(name) {
    validateString(name, "name");
    const headers = this[kOutHeaders];
    if (headers === null) {
        return;
    }
    const entry = headers[name.toLowerCase()];
    return entry && entry[1];
};
// Returns an array of the names of the current outgoing headers.
OutgoingMessage.prototype.getHeaderNames = function getHeaderNames() {
    return this[kOutHeaders] !== null ? Object.keys(this[kOutHeaders]) : [];
};
// Returns an array of the names of the current outgoing raw headers.
OutgoingMessage.prototype.getRawHeaderNames = function getRawHeaderNames() {
    const headersMap = this[kOutHeaders];
    if (headersMap === null) return [];
    const values = Object.values(headersMap);
    const headers = Array(values.length);
    // Retain for(;;) loop for performance reasons
    // Refs: https://github.com/nodejs/node/pull/30958
    for(let i = 0, l = values.length; i < l; i++){
        // deno-lint-ignore no-explicit-any
        headers[i] = values[i][0];
    }
    return headers;
};
// Returns a shallow copy of the current outgoing headers.
OutgoingMessage.prototype.getHeaders = function getHeaders() {
    const headers = this[kOutHeaders];
    const ret = Object.create(null);
    if (headers) {
        const keys = Object.keys(headers);
        // Retain for(;;) loop for performance reasons
        // Refs: https://github.com/nodejs/node/pull/30958
        for(let i = 0; i < keys.length; ++i){
            const key = keys[i];
            const val = headers[key][1];
            ret[key] = val;
        }
    }
    return ret;
};
OutgoingMessage.prototype.hasHeader = function hasHeader(name) {
    validateString(name, "name");
    return this[kOutHeaders] !== null && !!this[kOutHeaders][name.toLowerCase()];
};
OutgoingMessage.prototype.removeHeader = function removeHeader(name) {
    validateString(name, "name");
    if (this._header) {
        throw new ERR_HTTP_HEADERS_SENT("remove");
    }
    const key = name.toLowerCase();
    switch(key){
        case "connection":
            this._removedConnection = true;
            break;
        case "content-length":
            this._removedContLen = true;
            break;
        case "transfer-encoding":
            this._removedTE = true;
            break;
        case "date":
            this.sendDate = false;
            break;
    }
    if (this[kOutHeaders] !== null) {
        delete this[kOutHeaders][key];
    }
};
OutgoingMessage.prototype._implicitHeader = function _implicitHeader() {
    throw new ERR_METHOD_NOT_IMPLEMENTED("_implicitHeader()");
};
Object.defineProperty(OutgoingMessage.prototype, "headersSent", {
    configurable: true,
    enumerable: true,
    get: function() {
        return !!this._header;
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableEnded", {
    get: function() {
        return this.finished;
    }
});
Object.defineProperty(OutgoingMessage.prototype, "writableNeedDrain", {
    get: function() {
        return !this.destroyed && !this.finished && this[kNeedDrain];
    }
});
// deno-lint-ignore camelcase
const crlf_buf = Buffer.from("\r\n");
OutgoingMessage.prototype.write = function write(// deno-lint-ignore no-explicit-any
chunk, encoding, callback) {
    if (typeof encoding === "function") {
        callback = encoding;
        encoding = null;
    }
    const ret = write_(this, chunk, encoding, callback, false);
    if (!ret) {
        this[kNeedDrain] = true;
    }
    return ret;
};
// deno-lint-ignore no-explicit-any
function onError(msg, err, callback) {
    const triggerAsyncId = msg.socket ? msg.socket[async_id_symbol] : undefined;
    defaultTriggerAsyncIdScope(triggerAsyncId, // deno-lint-ignore no-explicit-any
    globalThis.process.nextTick, emitErrorNt, msg, err, callback);
}
// deno-lint-ignore no-explicit-any
function emitErrorNt(msg, err, callback) {
    callback(err);
    if (typeof msg.emit === "function" && !msg._closed) {
        msg.emit("error", err);
    }
}
function write_(// deno-lint-ignore no-explicit-any
msg, // deno-lint-ignore no-explicit-any
chunk, encoding, // deno-lint-ignore no-explicit-any
callback, // deno-lint-ignore no-explicit-any
fromEnd) {
    if (typeof callback !== "function") {
        callback = nop;
    }
    let len;
    if (chunk === null) {
        throw new ERR_STREAM_NULL_VALUES();
    } else if (typeof chunk === "string") {
        len = Buffer.byteLength(chunk, encoding);
    } else if (isUint8Array(chunk)) {
        len = chunk.length;
    } else {
        throw new ERR_INVALID_ARG_TYPE("chunk", [
            "string",
            "Buffer",
            "Uint8Array"
        ], chunk);
    }
    let err;
    if (msg.finished) {
        err = new ERR_STREAM_WRITE_AFTER_END();
    } else if (msg.destroyed) {
        err = new ERR_STREAM_DESTROYED("write");
    }
    if (err) {
        if (!msg.destroyed) {
            onError(msg, err, callback);
        } else {
            // deno-lint-ignore no-explicit-any
            globalThis.process.nextTick(callback, err);
        }
        return false;
    }
    if (!msg._header) {
        if (fromEnd) {
            msg._contentLength = len;
        }
        msg._implicitHeader();
    }
    if (!msg._hasBody) {
        debug("This type of response MUST NOT have a body. " + "Ignoring write() calls.");
        // deno-lint-ignore no-explicit-any
        globalThis.process.nextTick(callback);
        return true;
    }
    if (!fromEnd && msg.socket && !msg.socket.writableCorked) {
        msg.socket.cork();
        // deno-lint-ignore no-explicit-any
        globalThis.process.nextTick(connectionCorkNT, msg.socket);
    }
    let ret;
    if (msg.chunkedEncoding && chunk.length !== 0) {
        msg._send(len.toString(16), "latin1", null);
        msg._send(crlf_buf, null, null);
        msg._send(chunk, encoding, null);
        ret = msg._send(crlf_buf, null, callback);
    } else {
        ret = msg._send(chunk, encoding, callback);
    }
    debug("write ret = " + ret);
    return ret;
}
// deno-lint-ignore no-explicit-any
function connectionCorkNT(conn) {
    conn.uncork();
}
// deno-lint-ignore no-explicit-any
OutgoingMessage.prototype.addTrailers = function addTrailers(headers) {
    this._trailer = "";
    const keys = Object.keys(headers);
    const isArray = Array.isArray(headers);
    // Retain for(;;) loop for performance reasons
    // Refs: https://github.com/nodejs/node/pull/30958
    for(let i = 0, l = keys.length; i < l; i++){
        let field, value;
        const key = keys[i];
        if (isArray) {
            // deno-lint-ignore no-explicit-any
            field = headers[key][0];
            // deno-lint-ignore no-explicit-any
            value = headers[key][1];
        } else {
            field = key;
            value = headers[key];
        }
        if (typeof field !== "string" || !field || !checkIsHttpToken(field)) {
            throw new ERR_INVALID_HTTP_TOKEN("Trailer name", field);
        }
        if (checkInvalidHeaderChar(value)) {
            debug('Trailer "%s" contains invalid characters', field);
            throw new ERR_INVALID_CHAR("trailer content", field);
        }
        this._trailer += field + ": " + value + "\r\n";
    }
};
// deno-lint-ignore no-explicit-any
function onFinish(outmsg) {
    if (outmsg && outmsg.socket && outmsg.socket._hadError) return;
    outmsg.emit("finish");
}
OutgoingMessage.prototype.end = function end(// deno-lint-ignore no-explicit-any
chunk, // deno-lint-ignore no-explicit-any
encoding, // deno-lint-ignore no-explicit-any
callback) {
    if (typeof chunk === "function") {
        callback = chunk;
        chunk = null;
        encoding = null;
    } else if (typeof encoding === "function") {
        callback = encoding;
        encoding = null;
    }
    if (chunk) {
        if (this.finished) {
            onError(this, new ERR_STREAM_WRITE_AFTER_END(), typeof callback !== "function" ? nop : callback);
            return this;
        }
        if (this.socket) {
            this.socket.cork();
        }
        write_(this, chunk, encoding, null, true);
    } else if (this.finished) {
        if (typeof callback === "function") {
            if (!this.writableFinished) {
                this.on("finish", callback);
            } else {
                callback(new ERR_STREAM_ALREADY_FINISHED("end"));
            }
        }
        return this;
    } else if (!this._header) {
        if (this.socket) {
            this.socket.cork();
        }
        this._contentLength = 0;
        this._implicitHeader();
    }
    if (typeof callback === "function") {
        this.once("finish", callback);
    }
    const finish = onFinish.bind(undefined, this);
    if (this._hasBody && this.chunkedEncoding) {
        this._send("0\r\n" + this._trailer + "\r\n", "latin1", finish);
    } else if (!this._headerSent || this.writableLength || chunk) {
        this._send("", "latin1", finish);
    } else {
        // deno-lint-ignore no-explicit-any
        globalThis.process.nextTick(finish);
    }
    if (this.socket) {
        // Fully uncork connection on end().
        this.socket._writableState.corked = 1;
        this.socket.uncork();
    }
    this[kCorked] = 0;
    this.finished = true;
    // There is the first message on the outgoing queue, and we've sent
    // everything to the socket.
    debug("outgoing message end.");
    if (this.outputData.length === 0 && this.socket && this.socket._httpMessage === this) {
        this._finish();
    }
    return this;
};
OutgoingMessage.prototype._finish = function _finish() {
    assert(this.socket);
    this.emit("prefinish");
};
// This logic is probably a bit confusing. Let me explain a bit:
//
// In both HTTP servers and clients it is possible to queue up several
// outgoing messages. This is easiest to imagine in the case of a client.
// Take the following situation:
//
//    req1 = client.request('GET', '/');
//    req2 = client.request('POST', '/');
//
// When the user does
//
//   req2.write('hello world\n');
//
// it's possible that the first request has not been completely flushed to
// the socket yet. Thus the outgoing messages need to be prepared to queue
// up data internally before sending it on further to the socket's queue.
//
// This function, outgoingFlush(), is called by both the Server and Client
// to attempt to flush any pending messages out to the socket.
OutgoingMessage.prototype._flush = function _flush() {
    const socket = this.socket;
    if (socket && socket.writable) {
        // There might be remaining data in this.output; write it out
        const ret = this._flushOutput(socket);
        if (this.finished) {
            // This is a queue to the server or client to bring in the next this.
            this._finish();
        } else if (ret && this[kNeedDrain]) {
            this[kNeedDrain] = false;
            this.emit("drain");
        }
    }
};
OutgoingMessage.prototype._flushOutput = function _flushOutput(socket) {
    while(this[kCorked]){
        this[kCorked]--;
        socket.cork();
    }
    const outputLength = this.outputData.length;
    if (outputLength <= 0) {
        return undefined;
    }
    const outputData = this.outputData;
    socket.cork();
    let ret;
    // Retain for(;;) loop for performance reasons
    // Refs: https://github.com/nodejs/node/pull/30958
    for(let i = 0; i < outputLength; i++){
        const { data , encoding , callback  } = outputData[i];
        ret = socket.write(data, encoding, callback);
    }
    socket.uncork();
    this.outputData = [];
    this._onPendingData(-this.outputSize);
    this.outputSize = 0;
    return ret;
};
OutgoingMessage.prototype.flushHeaders = function flushHeaders() {
    if (!this._header) {
        this._implicitHeader();
    }
    // Force-flush the headers.
    this._send("");
};
OutgoingMessage.prototype.pipe = function pipe() {
    // OutgoingMessage should be write-only. Piping from it is disabled.
    this.emit("error", new ERR_STREAM_CANNOT_PIPE());
};
OutgoingMessage.prototype[EE.captureRejectionSymbol] = function(// deno-lint-ignore no-explicit-any
err, // deno-lint-ignore no-explicit-any
_event) {
    this.destroy(err);
};
export default {
    validateHeaderName,
    validateHeaderValue,
    OutgoingMessage
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2h0dHBfb3V0Z29pbmcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQgYW5kIE5vZGUgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgZ2V0RGVmYXVsdEhpZ2hXYXRlck1hcmsgfSBmcm9tIFwiLi9pbnRlcm5hbC9zdHJlYW1zL3N0YXRlLm1qc1wiO1xuaW1wb3J0IGFzc2VydCBmcm9tIFwiLi9pbnRlcm5hbC9hc3NlcnQubWpzXCI7XG5pbXBvcnQgRUUgZnJvbSBcIi4vZXZlbnRzLnRzXCI7XG5pbXBvcnQgeyBTdHJlYW0gfSBmcm9tIFwiLi9zdHJlYW0udHNcIjtcbmltcG9ydCAqIGFzIGludGVybmFsVXRpbCBmcm9tIFwiLi9pbnRlcm5hbC91dGlsLm1qc1wiO1xuaW1wb3J0IHR5cGUgeyBTb2NrZXQgfSBmcm9tIFwiLi9uZXQudHNcIjtcbmltcG9ydCB7IGtOZWVkRHJhaW4sIGtPdXRIZWFkZXJzLCB1dGNEYXRlIH0gZnJvbSBcIi4vaW50ZXJuYWwvaHR0cC50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQge1xuICBfY2hlY2tJbnZhbGlkSGVhZGVyQ2hhciBhcyBjaGVja0ludmFsaWRIZWFkZXJDaGFyLFxuICBfY2hlY2tJc0h0dHBUb2tlbiBhcyBjaGVja0lzSHR0cFRva2VuLFxuICBjaHVua0V4cHJlc3Npb24gYXMgUkVfVEVfQ0hVTktFRCxcbn0gZnJvbSBcIi4vX2h0dHBfY29tbW9uLnRzXCI7XG5pbXBvcnQgeyBkZWZhdWx0VHJpZ2dlckFzeW5jSWRTY29wZSwgc3ltYm9scyB9IGZyb20gXCIuL2ludGVybmFsL2FzeW5jX2hvb2tzLnRzXCI7XG4vLyBkZW5vLWxpbnQtaWdub3JlIGNhbWVsY2FzZVxuY29uc3QgeyBhc3luY19pZF9zeW1ib2wgfSA9IHN5bWJvbHM7XG5pbXBvcnQge1xuICBFUlJfSFRUUF9IRUFERVJTX1NFTlQsXG4gIEVSUl9IVFRQX0lOVkFMSURfSEVBREVSX1ZBTFVFLFxuICBFUlJfSFRUUF9UUkFJTEVSX0lOVkFMSUQsXG4gIEVSUl9JTlZBTElEX0FSR19UWVBFLFxuICBFUlJfSU5WQUxJRF9BUkdfVkFMVUUsXG4gIEVSUl9JTlZBTElEX0NIQVIsXG4gIEVSUl9JTlZBTElEX0hUVFBfVE9LRU4sXG4gIEVSUl9NRVRIT0RfTk9UX0lNUExFTUVOVEVELFxuICBFUlJfU1RSRUFNX0FMUkVBRFlfRklOSVNIRUQsXG4gIEVSUl9TVFJFQU1fQ0FOTk9UX1BJUEUsXG4gIEVSUl9TVFJFQU1fREVTVFJPWUVELFxuICBFUlJfU1RSRUFNX05VTExfVkFMVUVTLFxuICBFUlJfU1RSRUFNX1dSSVRFX0FGVEVSX0VORCxcbiAgaGlkZVN0YWNrRnJhbWVzLFxufSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlU3RyaW5nIH0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IGlzVWludDhBcnJheSB9IGZyb20gXCIuL2ludGVybmFsL3V0aWwvdHlwZXMudHNcIjtcblxuaW1wb3J0IHsgZGVidWdsb2cgfSBmcm9tIFwiLi9pbnRlcm5hbC91dGlsL2RlYnVnbG9nLnRzXCI7XG5sZXQgZGVidWcgPSBkZWJ1Z2xvZyhcImh0dHBcIiwgKGZuKSA9PiB7XG4gIGRlYnVnID0gZm47XG59KTtcblxuY29uc3QgSElHSF9XQVRFUl9NQVJLID0gZ2V0RGVmYXVsdEhpZ2hXYXRlck1hcmsoKTtcblxuY29uc3Qga0NvcmtlZCA9IFN5bWJvbChcImNvcmtlZFwiKTtcblxuY29uc3Qgbm9wID0gKCkgPT4ge307XG5cbmNvbnN0IFJFX0NPTk5fQ0xPU0UgPSAvKD86XnxcXFcpY2xvc2UoPzokfFxcVykvaTtcblxuLy8gaXNDb29raWVGaWVsZCBwZXJmb3JtcyBhIGNhc2UtaW5zZW5zaXRpdmUgY29tcGFyaXNvbiBvZiBhIHByb3ZpZGVkIHN0cmluZ1xuLy8gYWdhaW5zdCB0aGUgd29yZCBcImNvb2tpZS5cIiBBcyBvZiBWOCA2LjYgdGhpcyBpcyBmYXN0ZXIgdGhhbiBoYW5kcm9sbGluZyBvclxuLy8gdXNpbmcgYSBjYXNlLWluc2Vuc2l0aXZlIFJlZ0V4cC5cbmZ1bmN0aW9uIGlzQ29va2llRmllbGQoczogc3RyaW5nKSB7XG4gIHJldHVybiBzLmxlbmd0aCA9PT0gNiAmJiBzLnRvTG93ZXJDYXNlKCkgPT09IFwiY29va2llXCI7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gT3V0Z29pbmdNZXNzYWdlKHRoaXM6IGFueSkge1xuICBTdHJlYW0uY2FsbCh0aGlzKTtcblxuICAvLyBRdWV1ZSB0aGF0IGhvbGRzIGFsbCBjdXJyZW50bHkgcGVuZGluZyBkYXRhLCB1bnRpbCB0aGUgcmVzcG9uc2Ugd2lsbCBiZVxuICAvLyBhc3NpZ25lZCB0byB0aGUgc29ja2V0ICh1bnRpbCBpdCB3aWxsIGl0cyB0dXJuIGluIHRoZSBIVFRQIHBpcGVsaW5lKS5cbiAgdGhpcy5vdXRwdXREYXRhID0gW107XG5cbiAgLy8gYG91dHB1dFNpemVgIGlzIGFuIGFwcHJveGltYXRlIG1lYXN1cmUgb2YgaG93IG11Y2ggZGF0YSBpcyBxdWV1ZWQgb24gdGhpc1xuICAvLyByZXNwb25zZS4gYF9vblBlbmRpbmdEYXRhYCB3aWxsIGJlIGludm9rZWQgdG8gdXBkYXRlIHNpbWlsYXIgZ2xvYmFsXG4gIC8vIHBlci1jb25uZWN0aW9uIGNvdW50ZXIuIFRoYXQgY291bnRlciB3aWxsIGJlIHVzZWQgdG8gcGF1c2UvdW5wYXVzZSB0aGVcbiAgLy8gVENQIHNvY2tldCBhbmQgSFRUUCBQYXJzZXIgYW5kIHRodXMgaGFuZGxlIHRoZSBiYWNrcHJlc3N1cmUuXG4gIHRoaXMub3V0cHV0U2l6ZSA9IDA7XG5cbiAgdGhpcy53cml0YWJsZSA9IHRydWU7XG4gIHRoaXMuZGVzdHJveWVkID0gZmFsc2U7XG5cbiAgdGhpcy5fbGFzdCA9IGZhbHNlO1xuICB0aGlzLmNodW5rZWRFbmNvZGluZyA9IGZhbHNlO1xuICB0aGlzLnNob3VsZEtlZXBBbGl2ZSA9IHRydWU7XG4gIHRoaXMubWF4UmVxdWVzdHNPbkNvbm5lY3Rpb25SZWFjaGVkID0gZmFsc2U7XG4gIHRoaXMuX2RlZmF1bHRLZWVwQWxpdmUgPSB0cnVlO1xuICB0aGlzLnVzZUNodW5rZWRFbmNvZGluZ0J5RGVmYXVsdCA9IHRydWU7XG4gIHRoaXMuc2VuZERhdGUgPSBmYWxzZTtcbiAgdGhpcy5fcmVtb3ZlZENvbm5lY3Rpb24gPSBmYWxzZTtcbiAgdGhpcy5fcmVtb3ZlZENvbnRMZW4gPSBmYWxzZTtcbiAgdGhpcy5fcmVtb3ZlZFRFID0gZmFsc2U7XG5cbiAgdGhpcy5fY29udGVudExlbmd0aCA9IG51bGw7XG4gIHRoaXMuX2hhc0JvZHkgPSB0cnVlO1xuICB0aGlzLl90cmFpbGVyID0gXCJcIjtcbiAgdGhpc1trTmVlZERyYWluXSA9IGZhbHNlO1xuXG4gIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcbiAgdGhpcy5faGVhZGVyU2VudCA9IGZhbHNlO1xuICB0aGlzW2tDb3JrZWRdID0gMDtcbiAgdGhpcy5fY2xvc2VkID0gZmFsc2U7XG5cbiAgdGhpcy5zb2NrZXQgPSBudWxsO1xuICB0aGlzLl9oZWFkZXIgPSBudWxsO1xuICB0aGlzW2tPdXRIZWFkZXJzXSA9IG51bGw7XG5cbiAgdGhpcy5fa2VlcEFsaXZlVGltZW91dCA9IDA7XG5cbiAgdGhpcy5fb25QZW5kaW5nRGF0YSA9IG5vcDtcbn1cbk9iamVjdC5zZXRQcm90b3R5cGVPZihPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBTdHJlYW0ucHJvdG90eXBlKTtcbk9iamVjdC5zZXRQcm90b3R5cGVPZihPdXRnb2luZ01lc3NhZ2UsIFN0cmVhbSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcIndyaXRhYmxlRmluaXNoZWRcIiwge1xuICBnZXQoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuZmluaXNoZWQgJiZcbiAgICAgIHRoaXMub3V0cHV0U2l6ZSA9PT0gMCAmJlxuICAgICAgKCF0aGlzLnNvY2tldCB8fCB0aGlzLnNvY2tldC53cml0YWJsZUxlbmd0aCA9PT0gMClcbiAgICApO1xuICB9LFxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcIndyaXRhYmxlT2JqZWN0TW9kZVwiLCB7XG4gIGdldCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUsIFwid3JpdGFibGVMZW5ndGhcIiwge1xuICBnZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMub3V0cHV0U2l6ZSArICh0aGlzLnNvY2tldCA/IHRoaXMuc29ja2V0LndyaXRhYmxlTGVuZ3RoIDogMCk7XG4gIH0sXG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUsIFwid3JpdGFibGVIaWdoV2F0ZXJNYXJrXCIsIHtcbiAgZ2V0KCkge1xuICAgIHJldHVybiB0aGlzLnNvY2tldCA/IHRoaXMuc29ja2V0LndyaXRhYmxlSGlnaFdhdGVyTWFyayA6IEhJR0hfV0FURVJfTUFSSztcbiAgfSxcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZSwgXCJ3cml0YWJsZUNvcmtlZFwiLCB7XG4gIGdldCgpIHtcbiAgICBjb25zdCBjb3JrZWQgPSB0aGlzLnNvY2tldCA/IHRoaXMuc29ja2V0LndyaXRhYmxlQ29ya2VkIDogMDtcbiAgICByZXR1cm4gY29ya2VkICsgdGhpc1trQ29ya2VkXTtcbiAgfSxcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZSwgXCJfaGVhZGVyc1wiLCB7XG4gIGdldDogaW50ZXJuYWxVdGlsLmRlcHJlY2F0ZShcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGZ1bmN0aW9uICh0aGlzOiBhbnkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldEhlYWRlcnMoKTtcbiAgICB9LFxuICAgIFwiT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5faGVhZGVycyBpcyBkZXByZWNhdGVkXCIsXG4gICAgXCJERVAwMDY2XCIsXG4gICksXG4gIHNldDogaW50ZXJuYWxVdGlsLmRlcHJlY2F0ZShcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGZ1bmN0aW9uICh0aGlzOiBhbnksIHZhbDogYW55KSB7XG4gICAgICBpZiAodmFsID09IG51bGwpIHtcbiAgICAgICAgdGhpc1trT3V0SGVhZGVyc10gPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSB0aGlzW2tPdXRIZWFkZXJzXSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWwpO1xuICAgICAgICAvLyBSZXRhaW4gZm9yKDs7KSBsb29wIGZvciBwZXJmb3JtYW5jZSByZWFzb25zXG4gICAgICAgIC8vIFJlZnM6IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzMwOTU4XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBrZXlzW2ldO1xuICAgICAgICAgIGhlYWRlcnNbbmFtZS50b0xvd2VyQ2FzZSgpXSA9IFtuYW1lLCB2YWxbbmFtZV1dO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBcIk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX2hlYWRlcnMgaXMgZGVwcmVjYXRlZFwiLFxuICAgIFwiREVQMDA2NlwiLFxuICApLFxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcImNvbm5lY3Rpb25cIiwge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zb2NrZXQ7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24gKHZhbCkge1xuICAgIHRoaXMuc29ja2V0ID0gdmFsO1xuICB9LFxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcIl9oZWFkZXJOYW1lc1wiLCB7XG4gIGdldDogaW50ZXJuYWxVdGlsLmRlcHJlY2F0ZShcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGZ1bmN0aW9uICh0aGlzOiBhbnkpIHtcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSB0aGlzW2tPdXRIZWFkZXJzXTtcbiAgICAgIGlmIChoZWFkZXJzICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG91dCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhoZWFkZXJzKTtcbiAgICAgICAgLy8gUmV0YWluIGZvcig7OykgbG9vcCBmb3IgcGVyZm9ybWFuY2UgcmVhc29uc1xuICAgICAgICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgICAgICAgIGNvbnN0IHZhbCA9IGhlYWRlcnNba2V5XVswXTtcbiAgICAgICAgICBvdXRba2V5XSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBcIk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX2hlYWRlck5hbWVzIGlzIGRlcHJlY2F0ZWRcIixcbiAgICBcIkRFUDAwNjZcIixcbiAgKSxcbiAgc2V0OiBpbnRlcm5hbFV0aWwuZGVwcmVjYXRlKFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgZnVuY3Rpb24gKHRoaXM6IGFueSwgdmFsOiBhbnkpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSBcIm9iamVjdFwiICYmIHZhbCAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBoZWFkZXJzID0gdGhpc1trT3V0SGVhZGVyc107XG4gICAgICAgIGlmICghaGVhZGVycykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModmFsKTtcbiAgICAgICAgLy8gUmV0YWluIGZvcig7OykgbG9vcCBmb3IgcGVyZm9ybWFuY2UgcmVhc29uc1xuICAgICAgICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJzW2tleXNbaV1dO1xuICAgICAgICAgIGlmIChoZWFkZXIpIHtcbiAgICAgICAgICAgIGhlYWRlclswXSA9IHZhbFtrZXlzW2ldXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFwiT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5faGVhZGVyTmFtZXMgaXMgZGVwcmVjYXRlZFwiLFxuICAgIFwiREVQMDA2NlwiLFxuICApLFxufSk7XG5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX3JlbmRlckhlYWRlcnMgPSBmdW5jdGlvbiBfcmVuZGVySGVhZGVycygpIHtcbiAgaWYgKHRoaXMuX2hlYWRlcikge1xuICAgIHRocm93IG5ldyBFUlJfSFRUUF9IRUFERVJTX1NFTlQoXCJyZW5kZXJcIik7XG4gIH1cblxuICBjb25zdCBoZWFkZXJzTWFwID0gdGhpc1trT3V0SGVhZGVyc107XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGhlYWRlcnM6IGFueSA9IHt9O1xuXG4gIGlmIChoZWFkZXJzTWFwICE9PSBudWxsKSB7XG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGhlYWRlcnNNYXApO1xuICAgIC8vIFJldGFpbiBmb3IoOzspIGxvb3AgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnNcbiAgICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICAgIGZvciAobGV0IGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGtleXNbaV07XG4gICAgICBoZWFkZXJzW2hlYWRlcnNNYXBba2V5XVswXV0gPSBoZWFkZXJzTWFwW2tleV1bMV07XG4gICAgfVxuICB9XG4gIHJldHVybiBoZWFkZXJzO1xufTtcblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5jb3JrID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5zb2NrZXQpIHtcbiAgICB0aGlzLnNvY2tldC5jb3JrKCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpc1trQ29ya2VkXSsrO1xuICB9XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLnVuY29yayA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuc29ja2V0KSB7XG4gICAgdGhpcy5zb2NrZXQudW5jb3JrKCk7XG4gIH0gZWxzZSBpZiAodGhpc1trQ29ya2VkXSkge1xuICAgIHRoaXNba0NvcmtlZF0tLTtcbiAgfVxufTtcblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5zZXRUaW1lb3V0ID0gZnVuY3Rpb24gc2V0VGltZW91dChcbiAgbXNlY3M6IG51bWJlcixcbiAgY2FsbGJhY2s/OiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkLFxuKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIHRoaXMub24oXCJ0aW1lb3V0XCIsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIGlmICghdGhpcy5zb2NrZXQpIHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRoaXMub25jZShcInNvY2tldFwiLCBmdW5jdGlvbiBzb2NrZXRTZXRUaW1lb3V0T25Db25uZWN0KHNvY2tldDogYW55KSB7XG4gICAgICBzb2NrZXQuc2V0VGltZW91dChtc2Vjcyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5zb2NrZXQuc2V0VGltZW91dChtc2Vjcyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBJdCdzIHBvc3NpYmxlIHRoYXQgdGhlIHNvY2tldCB3aWxsIGJlIGRlc3Ryb3llZCwgYW5kIHJlbW92ZWQgZnJvbVxuLy8gYW55IG1lc3NhZ2VzLCBiZWZvcmUgZXZlciBjYWxsaW5nIHRoaXMuICBJbiB0aGF0IGNhc2UsIGp1c3Qgc2tpcFxuLy8gaXQsIHNpbmNlIHNvbWV0aGluZyBlbHNlIGlzIGRlc3Ryb3lpbmcgdGhpcyBjb25uZWN0aW9uIGFueXdheS5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIGRlc3Ryb3koZXJyb3I6IHVua25vd24pIHtcbiAgaWYgKHRoaXMuZGVzdHJveWVkKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuXG4gIGlmICh0aGlzLnNvY2tldCkge1xuICAgIHRoaXMuc29ja2V0LmRlc3Ryb3koZXJyb3IpO1xuICB9IGVsc2Uge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgdGhpcy5vbmNlKFwic29ja2V0XCIsIGZ1bmN0aW9uIHNvY2tldERlc3Ryb3lPbkNvbm5lY3Qoc29ja2V0OiBhbnkpIHtcbiAgICAgIHNvY2tldC5kZXN0cm95KGVycm9yKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gVGhpcyBhYnN0cmFjdCBlaXRoZXIgd3JpdGluZyBkaXJlY3RseSB0byB0aGUgc29ja2V0IG9yIGJ1ZmZlcmluZyBpdC5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX3NlbmQgPSBmdW5jdGlvbiBfc2VuZChcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgZGF0YTogYW55LFxuICBlbmNvZGluZzogc3RyaW5nIHwgbnVsbCxcbiAgY2FsbGJhY2s6ICgpID0+IHZvaWQsXG4pIHtcbiAgLy8gVGhpcyBpcyBhIHNoYW1lZnVsIGhhY2sgdG8gZ2V0IHRoZSBoZWFkZXJzIGFuZCBmaXJzdCBib2R5IGNodW5rIG9udG9cbiAgLy8gdGhlIHNhbWUgcGFja2V0LiBGdXR1cmUgdmVyc2lvbnMgb2YgTm9kZSBhcmUgZ29pbmcgdG8gdGFrZSBjYXJlIG9mXG4gIC8vIHRoaXMgYXQgYSBsb3dlciBsZXZlbCBhbmQgaW4gYSBtb3JlIGdlbmVyYWwgd2F5LlxuICBpZiAoIXRoaXMuX2hlYWRlclNlbnQpIHtcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZGF0YSA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgKGVuY29kaW5nID09PSBcInV0ZjhcIiB8fCBlbmNvZGluZyA9PT0gXCJsYXRpbjFcIiB8fCAhZW5jb2RpbmcpXG4gICAgKSB7XG4gICAgICBkYXRhID0gdGhpcy5faGVhZGVyICsgZGF0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaGVhZGVyID0gdGhpcy5faGVhZGVyO1xuICAgICAgdGhpcy5vdXRwdXREYXRhLnVuc2hpZnQoe1xuICAgICAgICBkYXRhOiBoZWFkZXIsXG4gICAgICAgIGVuY29kaW5nOiBcImxhdGluMVwiLFxuICAgICAgICBjYWxsYmFjazogbnVsbCxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5vdXRwdXRTaXplICs9IGhlYWRlci5sZW5ndGg7XG4gICAgICB0aGlzLl9vblBlbmRpbmdEYXRhKGhlYWRlci5sZW5ndGgpO1xuICAgIH1cbiAgICB0aGlzLl9oZWFkZXJTZW50ID0gdHJ1ZTtcbiAgfVxuICByZXR1cm4gdGhpcy5fd3JpdGVSYXcoZGF0YSwgZW5jb2RpbmcsIGNhbGxiYWNrKTtcbn07XG5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX3dyaXRlUmF3ID0gX3dyaXRlUmF3O1xuZnVuY3Rpb24gX3dyaXRlUmF3KFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICB0aGlzOiBhbnksXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGRhdGE6IGFueSxcbiAgZW5jb2Rpbmc6IHN0cmluZyB8IG51bGwsXG4gIGNhbGxiYWNrOiAoKSA9PiB2b2lkLFxuKSB7XG4gIGNvbnN0IGNvbm4gPSB0aGlzLnNvY2tldDtcbiAgaWYgKGNvbm4gJiYgY29ubi5kZXN0cm95ZWQpIHtcbiAgICAvLyBUaGUgc29ja2V0IHdhcyBkZXN0cm95ZWQuIElmIHdlJ3JlIHN0aWxsIHRyeWluZyB0byB3cml0ZSB0byBpdCxcbiAgICAvLyB0aGVuIHdlIGhhdmVuJ3QgZ290dGVuIHRoZSAnY2xvc2UnIGV2ZW50IHlldC5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjYWxsYmFjayA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjb25uICYmIGNvbm4uX2h0dHBNZXNzYWdlID09PSB0aGlzICYmIGNvbm4ud3JpdGFibGUpIHtcbiAgICAvLyBUaGVyZSBtaWdodCBiZSBwZW5kaW5nIGRhdGEgaW4gdGhlIHRoaXMub3V0cHV0IGJ1ZmZlci5cbiAgICBpZiAodGhpcy5vdXRwdXREYXRhLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hPdXRwdXQoY29ubik7XG4gICAgfVxuICAgIC8vIERpcmVjdGx5IHdyaXRlIHRvIHNvY2tldC5cbiAgICByZXR1cm4gY29ubi53cml0ZShkYXRhLCBlbmNvZGluZywgY2FsbGJhY2spO1xuICB9XG4gIC8vIEJ1ZmZlciwgYXMgbG9uZyBhcyB3ZSdyZSBub3QgZGVzdHJveWVkLlxuICB0aGlzLm91dHB1dERhdGEucHVzaCh7IGRhdGEsIGVuY29kaW5nLCBjYWxsYmFjayB9KTtcbiAgdGhpcy5vdXRwdXRTaXplICs9IGRhdGEubGVuZ3RoO1xuICB0aGlzLl9vblBlbmRpbmdEYXRhKGRhdGEubGVuZ3RoKTtcbiAgcmV0dXJuIHRoaXMub3V0cHV0U2l6ZSA8IEhJR0hfV0FURVJfTUFSSztcbn1cblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5fc3RvcmVIZWFkZXIgPSBfc3RvcmVIZWFkZXI7XG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gX3N0b3JlSGVhZGVyKHRoaXM6IGFueSwgZmlyc3RMaW5lOiBhbnksIGhlYWRlcnM6IGFueSkge1xuICAvLyBmaXJzdExpbmUgaW4gdGhlIGNhc2Ugb2YgcmVxdWVzdCBpczogJ0dFVCAvaW5kZXguaHRtbCBIVFRQLzEuMVxcclxcbidcbiAgLy8gaW4gdGhlIGNhc2Ugb2YgcmVzcG9uc2UgaXQgaXM6ICdIVFRQLzEuMSAyMDAgT0tcXHJcXG4nXG4gIGNvbnN0IHN0YXRlID0ge1xuICAgIGNvbm5lY3Rpb246IGZhbHNlLFxuICAgIGNvbnRMZW46IGZhbHNlLFxuICAgIHRlOiBmYWxzZSxcbiAgICBkYXRlOiBmYWxzZSxcbiAgICBleHBlY3Q6IGZhbHNlLFxuICAgIHRyYWlsZXI6IGZhbHNlLFxuICAgIGhlYWRlcjogZmlyc3RMaW5lLFxuICB9O1xuXG4gIGlmIChoZWFkZXJzKSB7XG4gICAgaWYgKGhlYWRlcnMgPT09IHRoaXNba091dEhlYWRlcnNdKSB7XG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gaGVhZGVyc1trZXldO1xuICAgICAgICBwcm9jZXNzSGVhZGVyKHRoaXMsIHN0YXRlLCBlbnRyeVswXSwgZW50cnlbMV0sIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGVhZGVycykpIHtcbiAgICAgIGlmIChoZWFkZXJzLmxlbmd0aCAmJiBBcnJheS5pc0FycmF5KGhlYWRlcnNbMF0pKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGVhZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGVudHJ5ID0gaGVhZGVyc1tpXTtcbiAgICAgICAgICBwcm9jZXNzSGVhZGVyKHRoaXMsIHN0YXRlLCBlbnRyeVswXSwgZW50cnlbMV0sIHRydWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaGVhZGVycy5sZW5ndGggJSAyICE9PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19WQUxVRShcImhlYWRlcnNcIiwgaGVhZGVycyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IGhlYWRlcnMubGVuZ3RoOyBuICs9IDIpIHtcbiAgICAgICAgICBwcm9jZXNzSGVhZGVyKHRoaXMsIHN0YXRlLCBoZWFkZXJzW24gKyAwXSwgaGVhZGVyc1tuICsgMV0sIHRydWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoY29uc3Qga2V5IGluIGhlYWRlcnMpIHtcbiAgICAgICAgaWYgKE9iamVjdC5oYXNPd24oaGVhZGVycywga2V5KSkge1xuICAgICAgICAgIHByb2Nlc3NIZWFkZXIodGhpcywgc3RhdGUsIGtleSwgaGVhZGVyc1trZXldLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCB7IGhlYWRlciB9ID0gc3RhdGU7XG5cbiAgLy8gRGF0ZSBoZWFkZXJcbiAgaWYgKHRoaXMuc2VuZERhdGUgJiYgIXN0YXRlLmRhdGUpIHtcbiAgICBoZWFkZXIgKz0gXCJEYXRlOiBcIiArIHV0Y0RhdGUoKSArIFwiXFxyXFxuXCI7XG4gIH1cblxuICAvLyBGb3JjZSB0aGUgY29ubmVjdGlvbiB0byBjbG9zZSB3aGVuIHRoZSByZXNwb25zZSBpcyBhIDIwNCBObyBDb250ZW50IG9yXG4gIC8vIGEgMzA0IE5vdCBNb2RpZmllZCBhbmQgdGhlIHVzZXIgaGFzIHNldCBhIFwiVHJhbnNmZXItRW5jb2Rpbmc6IGNodW5rZWRcIlxuICAvLyBoZWFkZXIuXG4gIC8vXG4gIC8vIFJGQyAyNjE2IG1hbmRhdGVzIHRoYXQgMjA0IGFuZCAzMDQgcmVzcG9uc2VzIE1VU1QgTk9UIGhhdmUgYSBib2R5IGJ1dFxuICAvLyBub2RlLmpzIHVzZWQgdG8gc2VuZCBvdXQgYSB6ZXJvIGNodW5rIGFueXdheSB0byBhY2NvbW1vZGF0ZSBjbGllbnRzXG4gIC8vIHRoYXQgZG9uJ3QgaGF2ZSBzcGVjaWFsIGhhbmRsaW5nIGZvciB0aG9zZSByZXNwb25zZXMuXG4gIC8vXG4gIC8vIEl0IHdhcyBwb2ludGVkIG91dCB0aGF0IHRoaXMgbWlnaHQgY29uZnVzZSByZXZlcnNlIHByb3hpZXMgdG8gdGhlIHBvaW50XG4gIC8vIG9mIGNyZWF0aW5nIHNlY3VyaXR5IGxpYWJpbGl0aWVzLCBzbyBzdXBwcmVzcyB0aGUgemVybyBjaHVuayBhbmQgZm9yY2VcbiAgLy8gdGhlIGNvbm5lY3Rpb24gdG8gY2xvc2UuXG4gIGlmIChcbiAgICB0aGlzLmNodW5rZWRFbmNvZGluZyAmJiAodGhpcy5zdGF0dXNDb2RlID09PSAyMDQgfHxcbiAgICAgIHRoaXMuc3RhdHVzQ29kZSA9PT0gMzA0KVxuICApIHtcbiAgICBkZWJ1ZyhcbiAgICAgIHRoaXMuc3RhdHVzQ29kZSArIFwiIHJlc3BvbnNlIHNob3VsZCBub3QgdXNlIGNodW5rZWQgZW5jb2RpbmcsXCIgK1xuICAgICAgICBcIiBjbG9zaW5nIGNvbm5lY3Rpb24uXCIsXG4gICAgKTtcbiAgICB0aGlzLmNodW5rZWRFbmNvZGluZyA9IGZhbHNlO1xuICAgIHRoaXMuc2hvdWxkS2VlcEFsaXZlID0gZmFsc2U7XG4gIH1cblxuICAvLyBrZWVwLWFsaXZlIGxvZ2ljXG4gIGlmICh0aGlzLl9yZW1vdmVkQ29ubmVjdGlvbikge1xuICAgIHRoaXMuX2xhc3QgPSB0cnVlO1xuICAgIHRoaXMuc2hvdWxkS2VlcEFsaXZlID0gZmFsc2U7XG4gIH0gZWxzZSBpZiAoIXN0YXRlLmNvbm5lY3Rpb24pIHtcbiAgICBjb25zdCBzaG91bGRTZW5kS2VlcEFsaXZlID0gdGhpcy5zaG91bGRLZWVwQWxpdmUgJiZcbiAgICAgIChzdGF0ZS5jb250TGVuIHx8IHRoaXMudXNlQ2h1bmtlZEVuY29kaW5nQnlEZWZhdWx0IHx8IHRoaXMuYWdlbnQpO1xuICAgIGlmIChzaG91bGRTZW5kS2VlcEFsaXZlICYmIHRoaXMubWF4UmVxdWVzdHNPbkNvbm5lY3Rpb25SZWFjaGVkKSB7XG4gICAgICBoZWFkZXIgKz0gXCJDb25uZWN0aW9uOiBjbG9zZVxcclxcblwiO1xuICAgIH0gZWxzZSBpZiAoc2hvdWxkU2VuZEtlZXBBbGl2ZSkge1xuICAgICAgaGVhZGVyICs9IFwiQ29ubmVjdGlvbjoga2VlcC1hbGl2ZVxcclxcblwiO1xuICAgICAgaWYgKHRoaXMuX2tlZXBBbGl2ZVRpbWVvdXQgJiYgdGhpcy5fZGVmYXVsdEtlZXBBbGl2ZSkge1xuICAgICAgICBjb25zdCB0aW1lb3V0U2Vjb25kcyA9IE1hdGguZmxvb3IodGhpcy5fa2VlcEFsaXZlVGltZW91dCAvIDEwMDApO1xuICAgICAgICBoZWFkZXIgKz0gYEtlZXAtQWxpdmU6IHRpbWVvdXQ9JHt0aW1lb3V0U2Vjb25kc31cXHJcXG5gO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9sYXN0ID0gdHJ1ZTtcbiAgICAgIGhlYWRlciArPSBcIkNvbm5lY3Rpb246IGNsb3NlXFxyXFxuXCI7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFzdGF0ZS5jb250TGVuICYmICFzdGF0ZS50ZSkge1xuICAgIGlmICghdGhpcy5faGFzQm9keSkge1xuICAgICAgLy8gTWFrZSBzdXJlIHdlIGRvbid0IGVuZCB0aGUgMFxcclxcblxcclxcbiBhdCB0aGUgZW5kIG9mIHRoZSBtZXNzYWdlLlxuICAgICAgdGhpcy5jaHVua2VkRW5jb2RpbmcgPSBmYWxzZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLnVzZUNodW5rZWRFbmNvZGluZ0J5RGVmYXVsdCkge1xuICAgICAgdGhpcy5fbGFzdCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICFzdGF0ZS50cmFpbGVyICYmXG4gICAgICAhdGhpcy5fcmVtb3ZlZENvbnRMZW4gJiZcbiAgICAgIHR5cGVvZiB0aGlzLl9jb250ZW50TGVuZ3RoID09PSBcIm51bWJlclwiXG4gICAgKSB7XG4gICAgICBoZWFkZXIgKz0gXCJDb250ZW50LUxlbmd0aDogXCIgKyB0aGlzLl9jb250ZW50TGVuZ3RoICsgXCJcXHJcXG5cIjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9yZW1vdmVkVEUpIHtcbiAgICAgIGhlYWRlciArPSBcIlRyYW5zZmVyLUVuY29kaW5nOiBjaHVua2VkXFxyXFxuXCI7XG4gICAgICB0aGlzLmNodW5rZWRFbmNvZGluZyA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdlIHNob3VsZCBvbmx5IGJlIGFibGUgdG8gZ2V0IGhlcmUgaWYgYm90aCBDb250ZW50LUxlbmd0aCBhbmRcbiAgICAgIC8vIFRyYW5zZmVyLUVuY29kaW5nIGFyZSByZW1vdmVkIGJ5IHRoZSB1c2VyLlxuICAgICAgLy8gU2VlOiB0ZXN0L3BhcmFsbGVsL3Rlc3QtaHR0cC1yZW1vdmUtaGVhZGVyLXN0YXlzLXJlbW92ZWQuanNcbiAgICAgIGRlYnVnKFwiQm90aCBDb250ZW50LUxlbmd0aCBhbmQgVHJhbnNmZXItRW5jb2RpbmcgYXJlIHJlbW92ZWRcIik7XG4gICAgfVxuICB9XG5cbiAgLy8gVGVzdCBub24tY2h1bmtlZCBtZXNzYWdlIGRvZXMgbm90IGhhdmUgdHJhaWxlciBoZWFkZXIgc2V0LFxuICAvLyBtZXNzYWdlIHdpbGwgYmUgdGVybWluYXRlZCBieSB0aGUgZmlyc3QgZW1wdHkgbGluZSBhZnRlciB0aGVcbiAgLy8gaGVhZGVyIGZpZWxkcywgcmVnYXJkbGVzcyBvZiB0aGUgaGVhZGVyIGZpZWxkcyBwcmVzZW50IGluIHRoZVxuICAvLyBtZXNzYWdlLCBhbmQgdGh1cyBjYW5ub3QgY29udGFpbiBhIG1lc3NhZ2UgYm9keSBvciAndHJhaWxlcnMnLlxuICBpZiAodGhpcy5jaHVua2VkRW5jb2RpbmcgIT09IHRydWUgJiYgc3RhdGUudHJhaWxlcikge1xuICAgIHRocm93IG5ldyBFUlJfSFRUUF9UUkFJTEVSX0lOVkFMSUQoKTtcbiAgfVxuXG4gIHRoaXMuX2hlYWRlciA9IGhlYWRlciArIFwiXFxyXFxuXCI7XG4gIHRoaXMuX2hlYWRlclNlbnQgPSBmYWxzZTtcblxuICAvLyBXYWl0IHVudGlsIHRoZSBmaXJzdCBib2R5IGNodW5rLCBvciBjbG9zZSgpLCBpcyBzZW50IHRvIGZsdXNoLFxuICAvLyBVTkxFU1Mgd2UncmUgc2VuZGluZyBFeHBlY3Q6IDEwMC1jb250aW51ZS5cbiAgaWYgKHN0YXRlLmV4cGVjdCkgdGhpcy5fc2VuZChcIlwiKTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0hlYWRlcihcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgc2VsZjogYW55LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBzdGF0ZTogYW55LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBrZXk6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdmFsdWU6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdmFsaWRhdGU6IGFueSxcbikge1xuICBpZiAodmFsaWRhdGUpIHtcbiAgICB2YWxpZGF0ZUhlYWRlck5hbWUoa2V5KTtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBpZiAodmFsdWUubGVuZ3RoIDwgMiB8fCAhaXNDb29raWVGaWVsZChrZXkpKSB7XG4gICAgICAvLyBSZXRhaW4gZm9yKDs7KSBsb29wIGZvciBwZXJmb3JtYW5jZSByZWFzb25zXG4gICAgICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdG9yZUhlYWRlcihzZWxmLCBzdGF0ZSwga2V5LCB2YWx1ZVtpXSwgdmFsaWRhdGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YWx1ZSA9IHZhbHVlLmpvaW4oXCI7IFwiKTtcbiAgfVxuICBzdG9yZUhlYWRlcihzZWxmLCBzdGF0ZSwga2V5LCB2YWx1ZSwgdmFsaWRhdGUpO1xufVxuXG5mdW5jdGlvbiBzdG9yZUhlYWRlcihcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgc2VsZjogYW55LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBzdGF0ZTogYW55LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBrZXk6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdmFsdWU6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdmFsaWRhdGU6IGFueSxcbikge1xuICBpZiAodmFsaWRhdGUpIHtcbiAgICB2YWxpZGF0ZUhlYWRlclZhbHVlKGtleSwgdmFsdWUpO1xuICB9XG4gIHN0YXRlLmhlYWRlciArPSBrZXkgKyBcIjogXCIgKyB2YWx1ZSArIFwiXFxyXFxuXCI7XG4gIG1hdGNoSGVhZGVyKHNlbGYsIHN0YXRlLCBrZXksIHZhbHVlKTtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIG1hdGNoSGVhZGVyKHNlbGY6IGFueSwgc3RhdGU6IGFueSwgZmllbGQ6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICBpZiAoZmllbGQubGVuZ3RoIDwgNCB8fCBmaWVsZC5sZW5ndGggPiAxNykge1xuICAgIHJldHVybjtcbiAgfVxuICBmaWVsZCA9IGZpZWxkLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAoZmllbGQpIHtcbiAgICBjYXNlIFwiY29ubmVjdGlvblwiOlxuICAgICAgc3RhdGUuY29ubmVjdGlvbiA9IHRydWU7XG4gICAgICBzZWxmLl9yZW1vdmVkQ29ubmVjdGlvbiA9IGZhbHNlO1xuICAgICAgaWYgKFJFX0NPTk5fQ0xPU0UudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgc2VsZi5fbGFzdCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLnNob3VsZEtlZXBBbGl2ZSA9IHRydWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwidHJhbnNmZXItZW5jb2RpbmdcIjpcbiAgICAgIHN0YXRlLnRlID0gdHJ1ZTtcbiAgICAgIHNlbGYuX3JlbW92ZWRURSA9IGZhbHNlO1xuICAgICAgaWYgKFJFX1RFX0NIVU5LRUQudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgc2VsZi5jaHVua2VkRW5jb2RpbmcgPSB0cnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImNvbnRlbnQtbGVuZ3RoXCI6XG4gICAgICBzdGF0ZS5jb250TGVuID0gdHJ1ZTtcbiAgICAgIHNlbGYuX3JlbW92ZWRDb250TGVuID0gZmFsc2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZGF0ZVwiOlxuICAgIGNhc2UgXCJleHBlY3RcIjpcbiAgICBjYXNlIFwidHJhaWxlclwiOlxuICAgICAgc3RhdGVbZmllbGRdID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJrZWVwLWFsaXZlXCI6XG4gICAgICBzZWxmLl9kZWZhdWx0S2VlcEFsaXZlID0gZmFsc2U7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdmFsaWRhdGVIZWFkZXJOYW1lID0gaGlkZVN0YWNrRnJhbWVzKChuYW1lKSA9PiB7XG4gIGlmICh0eXBlb2YgbmFtZSAhPT0gXCJzdHJpbmdcIiB8fCAhbmFtZSB8fCAhY2hlY2tJc0h0dHBUb2tlbihuYW1lKSkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9IVFRQX1RPS0VOKFwiSGVhZGVyIG5hbWVcIiwgbmFtZSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgdmFsaWRhdGVIZWFkZXJWYWx1ZSA9IGhpZGVTdGFja0ZyYW1lcygobmFtZSwgdmFsdWUpID0+IHtcbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0hUVFBfSU5WQUxJRF9IRUFERVJfVkFMVUUodmFsdWUsIG5hbWUpO1xuICB9XG4gIGlmIChjaGVja0ludmFsaWRIZWFkZXJDaGFyKHZhbHVlKSkge1xuICAgIGRlYnVnKCdIZWFkZXIgXCIlc1wiIGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycycsIG5hbWUpO1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9DSEFSKFwiaGVhZGVyIGNvbnRlbnRcIiwgbmFtZSk7XG4gIH1cbn0pO1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLnNldEhlYWRlciA9IGZ1bmN0aW9uIHNldEhlYWRlcihcbiAgbmFtZTogc3RyaW5nLFxuICB2YWx1ZTogc3RyaW5nLFxuKSB7XG4gIGlmICh0aGlzLl9oZWFkZXIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0hUVFBfSEVBREVSU19TRU5UKFwic2V0XCIpO1xuICB9XG4gIHZhbGlkYXRlSGVhZGVyTmFtZShuYW1lKTtcbiAgdmFsaWRhdGVIZWFkZXJWYWx1ZShuYW1lLCB2YWx1ZSk7XG5cbiAgbGV0IGhlYWRlcnMgPSB0aGlzW2tPdXRIZWFkZXJzXTtcbiAgaWYgKGhlYWRlcnMgPT09IG51bGwpIHtcbiAgICB0aGlzW2tPdXRIZWFkZXJzXSA9IGhlYWRlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgaGVhZGVyc1tuYW1lLnRvTG93ZXJDYXNlKCldID0gW25hbWUsIHZhbHVlXTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLmdldEhlYWRlciA9IGZ1bmN0aW9uIGdldEhlYWRlcihuYW1lOiBzdHJpbmcpIHtcbiAgdmFsaWRhdGVTdHJpbmcobmFtZSwgXCJuYW1lXCIpO1xuXG4gIGNvbnN0IGhlYWRlcnMgPSB0aGlzW2tPdXRIZWFkZXJzXTtcbiAgaWYgKGhlYWRlcnMgPT09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBlbnRyeSA9IGhlYWRlcnNbbmFtZS50b0xvd2VyQ2FzZSgpXTtcbiAgcmV0dXJuIGVudHJ5ICYmIGVudHJ5WzFdO1xufTtcblxuLy8gUmV0dXJucyBhbiBhcnJheSBvZiB0aGUgbmFtZXMgb2YgdGhlIGN1cnJlbnQgb3V0Z29pbmcgaGVhZGVycy5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuZ2V0SGVhZGVyTmFtZXMgPSBmdW5jdGlvbiBnZXRIZWFkZXJOYW1lcygpIHtcbiAgcmV0dXJuIHRoaXNba091dEhlYWRlcnNdICE9PSBudWxsID8gT2JqZWN0LmtleXModGhpc1trT3V0SGVhZGVyc10pIDogW107XG59O1xuXG4vLyBSZXR1cm5zIGFuIGFycmF5IG9mIHRoZSBuYW1lcyBvZiB0aGUgY3VycmVudCBvdXRnb2luZyByYXcgaGVhZGVycy5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuZ2V0UmF3SGVhZGVyTmFtZXMgPSBmdW5jdGlvbiBnZXRSYXdIZWFkZXJOYW1lcygpIHtcbiAgY29uc3QgaGVhZGVyc01hcCA9IHRoaXNba091dEhlYWRlcnNdO1xuICBpZiAoaGVhZGVyc01hcCA9PT0gbnVsbCkgcmV0dXJuIFtdO1xuXG4gIGNvbnN0IHZhbHVlcyA9IE9iamVjdC52YWx1ZXMoaGVhZGVyc01hcCk7XG4gIGNvbnN0IGhlYWRlcnMgPSBBcnJheSh2YWx1ZXMubGVuZ3RoKTtcbiAgLy8gUmV0YWluIGZvcig7OykgbG9vcCBmb3IgcGVyZm9ybWFuY2UgcmVhc29uc1xuICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICBmb3IgKGxldCBpID0gMCwgbCA9IHZhbHVlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGhlYWRlcnNbaV0gPSAodmFsdWVzIGFzIGFueSlbaV1bMF07XG4gIH1cblxuICByZXR1cm4gaGVhZGVycztcbn07XG5cbi8vIFJldHVybnMgYSBzaGFsbG93IGNvcHkgb2YgdGhlIGN1cnJlbnQgb3V0Z29pbmcgaGVhZGVycy5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uIGdldEhlYWRlcnMoKSB7XG4gIGNvbnN0IGhlYWRlcnMgPSB0aGlzW2tPdXRIZWFkZXJzXTtcbiAgY29uc3QgcmV0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgaWYgKGhlYWRlcnMpIHtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoaGVhZGVycyk7XG4gICAgLy8gUmV0YWluIGZvcig7OykgbG9vcCBmb3IgcGVyZm9ybWFuY2UgcmVhc29uc1xuICAgIC8vIFJlZnM6IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzMwOTU4XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgICAgY29uc3QgdmFsID0gaGVhZGVyc1trZXldWzFdO1xuICAgICAgcmV0W2tleV0gPSB2YWw7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXQ7XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLmhhc0hlYWRlciA9IGZ1bmN0aW9uIGhhc0hlYWRlcihuYW1lOiBzdHJpbmcpIHtcbiAgdmFsaWRhdGVTdHJpbmcobmFtZSwgXCJuYW1lXCIpO1xuICByZXR1cm4gdGhpc1trT3V0SGVhZGVyc10gIT09IG51bGwgJiZcbiAgICAhIXRoaXNba091dEhlYWRlcnNdW25hbWUudG9Mb3dlckNhc2UoKV07XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLnJlbW92ZUhlYWRlciA9IGZ1bmN0aW9uIHJlbW92ZUhlYWRlcihuYW1lOiBzdHJpbmcpIHtcbiAgdmFsaWRhdGVTdHJpbmcobmFtZSwgXCJuYW1lXCIpO1xuXG4gIGlmICh0aGlzLl9oZWFkZXIpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0hUVFBfSEVBREVSU19TRU5UKFwicmVtb3ZlXCIpO1xuICB9XG5cbiAgY29uc3Qga2V5ID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuXG4gIHN3aXRjaCAoa2V5KSB7XG4gICAgY2FzZSBcImNvbm5lY3Rpb25cIjpcbiAgICAgIHRoaXMuX3JlbW92ZWRDb25uZWN0aW9uID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJjb250ZW50LWxlbmd0aFwiOlxuICAgICAgdGhpcy5fcmVtb3ZlZENvbnRMZW4gPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInRyYW5zZmVyLWVuY29kaW5nXCI6XG4gICAgICB0aGlzLl9yZW1vdmVkVEUgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImRhdGVcIjpcbiAgICAgIHRoaXMuc2VuZERhdGUgPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgaWYgKHRoaXNba091dEhlYWRlcnNdICE9PSBudWxsKSB7XG4gICAgZGVsZXRlIHRoaXNba091dEhlYWRlcnNdW2tleV07XG4gIH1cbn07XG5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX2ltcGxpY2l0SGVhZGVyID0gZnVuY3Rpb24gX2ltcGxpY2l0SGVhZGVyKCkge1xuICB0aHJvdyBuZXcgRVJSX01FVEhPRF9OT1RfSU1QTEVNRU5URUQoXCJfaW1wbGljaXRIZWFkZXIoKVwiKTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcImhlYWRlcnNTZW50XCIsIHtcbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9oZWFkZXI7XG4gIH0sXG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUsIFwid3JpdGFibGVFbmRlZFwiLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmZpbmlzaGVkO1xuICB9LFxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLCBcIndyaXRhYmxlTmVlZERyYWluXCIsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICF0aGlzLmRlc3Ryb3llZCAmJiAhdGhpcy5maW5pc2hlZCAmJiB0aGlzW2tOZWVkRHJhaW5dO1xuICB9LFxufSk7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgY2FtZWxjYXNlXG5jb25zdCBjcmxmX2J1ZiA9IEJ1ZmZlci5mcm9tKFwiXFxyXFxuXCIpO1xuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjaHVuazogYW55LFxuICBlbmNvZGluZzogc3RyaW5nIHwgbnVsbCxcbiAgY2FsbGJhY2s6ICgpID0+IHZvaWQsXG4pIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbGJhY2sgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBjb25zdCByZXQgPSB3cml0ZV8odGhpcywgY2h1bmssIGVuY29kaW5nLCBjYWxsYmFjaywgZmFsc2UpO1xuICBpZiAoIXJldCkge1xuICAgIHRoaXNba05lZWREcmFpbl0gPSB0cnVlO1xuICB9XG4gIHJldHVybiByZXQ7XG59O1xuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gb25FcnJvcihtc2c6IGFueSwgZXJyOiBhbnksIGNhbGxiYWNrOiBhbnkpIHtcbiAgY29uc3QgdHJpZ2dlckFzeW5jSWQgPSBtc2cuc29ja2V0ID8gbXNnLnNvY2tldFthc3luY19pZF9zeW1ib2xdIDogdW5kZWZpbmVkO1xuICBkZWZhdWx0VHJpZ2dlckFzeW5jSWRTY29wZShcbiAgICB0cmlnZ2VyQXN5bmNJZCxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIChnbG9iYWxUaGlzIGFzIGFueSkucHJvY2Vzcy5uZXh0VGljayxcbiAgICBlbWl0RXJyb3JOdCxcbiAgICBtc2csXG4gICAgZXJyLFxuICAgIGNhbGxiYWNrLFxuICApO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gZW1pdEVycm9yTnQobXNnOiBhbnksIGVycjogYW55LCBjYWxsYmFjazogYW55KSB7XG4gIGNhbGxiYWNrKGVycik7XG4gIGlmICh0eXBlb2YgbXNnLmVtaXQgPT09IFwiZnVuY3Rpb25cIiAmJiAhbXNnLl9jbG9zZWQpIHtcbiAgICBtc2cuZW1pdChcImVycm9yXCIsIGVycik7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JpdGVfKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBtc2c6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgY2h1bms6IGFueSxcbiAgZW5jb2Rpbmc6IHN0cmluZyB8IG51bGwsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNhbGxiYWNrOiBhbnksXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGZyb21FbmQ6IGFueSxcbikge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjYWxsYmFjayA9IG5vcDtcbiAgfVxuXG4gIGxldCBsZW47XG4gIGlmIChjaHVuayA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFUlJfU1RSRUFNX05VTExfVkFMVUVTKCk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNodW5rID09PSBcInN0cmluZ1wiKSB7XG4gICAgbGVuID0gQnVmZmVyLmJ5dGVMZW5ndGgoY2h1bmssIGVuY29kaW5nKTtcbiAgfSBlbHNlIGlmIChpc1VpbnQ4QXJyYXkoY2h1bmspKSB7XG4gICAgbGVuID0gY2h1bmsubGVuZ3RoO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcbiAgICAgIFwiY2h1bmtcIixcbiAgICAgIFtcInN0cmluZ1wiLCBcIkJ1ZmZlclwiLCBcIlVpbnQ4QXJyYXlcIl0sXG4gICAgICBjaHVuayxcbiAgICApO1xuICB9XG5cbiAgbGV0IGVycjtcbiAgaWYgKG1zZy5maW5pc2hlZCkge1xuICAgIGVyciA9IG5ldyBFUlJfU1RSRUFNX1dSSVRFX0FGVEVSX0VORCgpO1xuICB9IGVsc2UgaWYgKG1zZy5kZXN0cm95ZWQpIHtcbiAgICBlcnIgPSBuZXcgRVJSX1NUUkVBTV9ERVNUUk9ZRUQoXCJ3cml0ZVwiKTtcbiAgfVxuXG4gIGlmIChlcnIpIHtcbiAgICBpZiAoIW1zZy5kZXN0cm95ZWQpIHtcbiAgICAgIG9uRXJyb3IobXNnLCBlcnIsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIChnbG9iYWxUaGlzIGFzIGFueSkucHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjaywgZXJyKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCFtc2cuX2hlYWRlcikge1xuICAgIGlmIChmcm9tRW5kKSB7XG4gICAgICBtc2cuX2NvbnRlbnRMZW5ndGggPSBsZW47XG4gICAgfVxuICAgIG1zZy5faW1wbGljaXRIZWFkZXIoKTtcbiAgfVxuXG4gIGlmICghbXNnLl9oYXNCb2R5KSB7XG4gICAgZGVidWcoXG4gICAgICBcIlRoaXMgdHlwZSBvZiByZXNwb25zZSBNVVNUIE5PVCBoYXZlIGEgYm9keS4gXCIgK1xuICAgICAgICBcIklnbm9yaW5nIHdyaXRlKCkgY2FsbHMuXCIsXG4gICAgKTtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIChnbG9iYWxUaGlzIGFzIGFueSkucHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjayk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAoIWZyb21FbmQgJiYgbXNnLnNvY2tldCAmJiAhbXNnLnNvY2tldC53cml0YWJsZUNvcmtlZCkge1xuICAgIG1zZy5zb2NrZXQuY29yaygpO1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgKGdsb2JhbFRoaXMgYXMgYW55KS5wcm9jZXNzLm5leHRUaWNrKGNvbm5lY3Rpb25Db3JrTlQsIG1zZy5zb2NrZXQpO1xuICB9XG5cbiAgbGV0IHJldDtcbiAgaWYgKG1zZy5jaHVua2VkRW5jb2RpbmcgJiYgY2h1bmsubGVuZ3RoICE9PSAwKSB7XG4gICAgbXNnLl9zZW5kKGxlbi50b1N0cmluZygxNiksIFwibGF0aW4xXCIsIG51bGwpO1xuICAgIG1zZy5fc2VuZChjcmxmX2J1ZiwgbnVsbCwgbnVsbCk7XG4gICAgbXNnLl9zZW5kKGNodW5rLCBlbmNvZGluZywgbnVsbCk7XG4gICAgcmV0ID0gbXNnLl9zZW5kKGNybGZfYnVmLCBudWxsLCBjYWxsYmFjayk7XG4gIH0gZWxzZSB7XG4gICAgcmV0ID0gbXNnLl9zZW5kKGNodW5rLCBlbmNvZGluZywgY2FsbGJhY2spO1xuICB9XG5cbiAgZGVidWcoXCJ3cml0ZSByZXQgPSBcIiArIHJldCk7XG4gIHJldHVybiByZXQ7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBjb25uZWN0aW9uQ29ya05UKGNvbm46IGFueSkge1xuICBjb25uLnVuY29yaygpO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5hZGRUcmFpbGVycyA9IGZ1bmN0aW9uIGFkZFRyYWlsZXJzKGhlYWRlcnM6IGFueSkge1xuICB0aGlzLl90cmFpbGVyID0gXCJcIjtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGhlYWRlcnMpO1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShoZWFkZXJzKTtcbiAgLy8gUmV0YWluIGZvcig7OykgbG9vcCBmb3IgcGVyZm9ybWFuY2UgcmVhc29uc1xuICAvLyBSZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8zMDk1OFxuICBmb3IgKGxldCBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbGV0IGZpZWxkLCB2YWx1ZTtcbiAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgIGlmIChpc0FycmF5KSB7XG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgZmllbGQgPSBoZWFkZXJzW2tleSBhcyBhbnldWzBdO1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIHZhbHVlID0gaGVhZGVyc1trZXkgYXMgYW55XVsxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmllbGQgPSBrZXk7XG4gICAgICB2YWx1ZSA9IGhlYWRlcnNba2V5XTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBmaWVsZCAhPT0gXCJzdHJpbmdcIiB8fCAhZmllbGQgfHwgIWNoZWNrSXNIdHRwVG9rZW4oZmllbGQpKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfSFRUUF9UT0tFTihcIlRyYWlsZXIgbmFtZVwiLCBmaWVsZCk7XG4gICAgfVxuICAgIGlmIChjaGVja0ludmFsaWRIZWFkZXJDaGFyKHZhbHVlKSkge1xuICAgICAgZGVidWcoJ1RyYWlsZXIgXCIlc1wiIGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycycsIGZpZWxkKTtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9DSEFSKFwidHJhaWxlciBjb250ZW50XCIsIGZpZWxkKTtcbiAgICB9XG4gICAgdGhpcy5fdHJhaWxlciArPSBmaWVsZCArIFwiOiBcIiArIHZhbHVlICsgXCJcXHJcXG5cIjtcbiAgfVxufTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIG9uRmluaXNoKG91dG1zZzogYW55KSB7XG4gIGlmIChvdXRtc2cgJiYgb3V0bXNnLnNvY2tldCAmJiBvdXRtc2cuc29ja2V0Ll9oYWRFcnJvcikgcmV0dXJuO1xuICBvdXRtc2cuZW1pdChcImZpbmlzaFwiKTtcbn1cblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiBlbmQoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNodW5rOiBhbnksXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGVuY29kaW5nOiBhbnksXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNhbGxiYWNrOiBhbnksXG4pIHtcbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbGJhY2sgPSBjaHVuaztcbiAgICBjaHVuayA9IG51bGw7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbGJhY2sgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBpZiAoY2h1bmspIHtcbiAgICBpZiAodGhpcy5maW5pc2hlZCkge1xuICAgICAgb25FcnJvcihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgbmV3IEVSUl9TVFJFQU1fV1JJVEVfQUZURVJfRU5EKCksXG4gICAgICAgIHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiID8gbm9wIDogY2FsbGJhY2ssXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc29ja2V0KSB7XG4gICAgICB0aGlzLnNvY2tldC5jb3JrKCk7XG4gICAgfVxuXG4gICAgd3JpdGVfKHRoaXMsIGNodW5rLCBlbmNvZGluZywgbnVsbCwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAodGhpcy5maW5pc2hlZCkge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKCF0aGlzLndyaXRhYmxlRmluaXNoZWQpIHtcbiAgICAgICAgdGhpcy5vbihcImZpbmlzaFwiLCBjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhuZXcgRVJSX1NUUkVBTV9BTFJFQURZX0ZJTklTSEVEKFwiZW5kXCIpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0gZWxzZSBpZiAoIXRoaXMuX2hlYWRlcikge1xuICAgIGlmICh0aGlzLnNvY2tldCkge1xuICAgICAgdGhpcy5zb2NrZXQuY29yaygpO1xuICAgIH1cblxuICAgIHRoaXMuX2NvbnRlbnRMZW5ndGggPSAwO1xuICAgIHRoaXMuX2ltcGxpY2l0SGVhZGVyKCk7XG4gIH1cblxuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aGlzLm9uY2UoXCJmaW5pc2hcIiwgY2FsbGJhY2spO1xuICB9XG5cbiAgY29uc3QgZmluaXNoID0gb25GaW5pc2guYmluZCh1bmRlZmluZWQsIHRoaXMpO1xuXG4gIGlmICh0aGlzLl9oYXNCb2R5ICYmIHRoaXMuY2h1bmtlZEVuY29kaW5nKSB7XG4gICAgdGhpcy5fc2VuZChcIjBcXHJcXG5cIiArIHRoaXMuX3RyYWlsZXIgKyBcIlxcclxcblwiLCBcImxhdGluMVwiLCBmaW5pc2gpO1xuICB9IGVsc2UgaWYgKCF0aGlzLl9oZWFkZXJTZW50IHx8IHRoaXMud3JpdGFibGVMZW5ndGggfHwgY2h1bmspIHtcbiAgICB0aGlzLl9zZW5kKFwiXCIsIFwibGF0aW4xXCIsIGZpbmlzaCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAoZ2xvYmFsVGhpcyBhcyBhbnkpLnByb2Nlc3MubmV4dFRpY2soZmluaXNoKTtcbiAgfVxuXG4gIGlmICh0aGlzLnNvY2tldCkge1xuICAgIC8vIEZ1bGx5IHVuY29yayBjb25uZWN0aW9uIG9uIGVuZCgpLlxuICAgIHRoaXMuc29ja2V0Ll93cml0YWJsZVN0YXRlLmNvcmtlZCA9IDE7XG4gICAgdGhpcy5zb2NrZXQudW5jb3JrKCk7XG4gIH1cbiAgdGhpc1trQ29ya2VkXSA9IDA7XG5cbiAgdGhpcy5maW5pc2hlZCA9IHRydWU7XG5cbiAgLy8gVGhlcmUgaXMgdGhlIGZpcnN0IG1lc3NhZ2Ugb24gdGhlIG91dGdvaW5nIHF1ZXVlLCBhbmQgd2UndmUgc2VudFxuICAvLyBldmVyeXRoaW5nIHRvIHRoZSBzb2NrZXQuXG4gIGRlYnVnKFwib3V0Z29pbmcgbWVzc2FnZSBlbmQuXCIpO1xuICBpZiAoXG4gICAgdGhpcy5vdXRwdXREYXRhLmxlbmd0aCA9PT0gMCAmJlxuICAgIHRoaXMuc29ja2V0ICYmXG4gICAgdGhpcy5zb2NrZXQuX2h0dHBNZXNzYWdlID09PSB0aGlzXG4gICkge1xuICAgIHRoaXMuX2ZpbmlzaCgpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLl9maW5pc2ggPSBmdW5jdGlvbiBfZmluaXNoKCkge1xuICBhc3NlcnQodGhpcy5zb2NrZXQpO1xuICB0aGlzLmVtaXQoXCJwcmVmaW5pc2hcIik7XG59O1xuXG4vLyBUaGlzIGxvZ2ljIGlzIHByb2JhYmx5IGEgYml0IGNvbmZ1c2luZy4gTGV0IG1lIGV4cGxhaW4gYSBiaXQ6XG4vL1xuLy8gSW4gYm90aCBIVFRQIHNlcnZlcnMgYW5kIGNsaWVudHMgaXQgaXMgcG9zc2libGUgdG8gcXVldWUgdXAgc2V2ZXJhbFxuLy8gb3V0Z29pbmcgbWVzc2FnZXMuIFRoaXMgaXMgZWFzaWVzdCB0byBpbWFnaW5lIGluIHRoZSBjYXNlIG9mIGEgY2xpZW50LlxuLy8gVGFrZSB0aGUgZm9sbG93aW5nIHNpdHVhdGlvbjpcbi8vXG4vLyAgICByZXExID0gY2xpZW50LnJlcXVlc3QoJ0dFVCcsICcvJyk7XG4vLyAgICByZXEyID0gY2xpZW50LnJlcXVlc3QoJ1BPU1QnLCAnLycpO1xuLy9cbi8vIFdoZW4gdGhlIHVzZXIgZG9lc1xuLy9cbi8vICAgcmVxMi53cml0ZSgnaGVsbG8gd29ybGRcXG4nKTtcbi8vXG4vLyBpdCdzIHBvc3NpYmxlIHRoYXQgdGhlIGZpcnN0IHJlcXVlc3QgaGFzIG5vdCBiZWVuIGNvbXBsZXRlbHkgZmx1c2hlZCB0b1xuLy8gdGhlIHNvY2tldCB5ZXQuIFRodXMgdGhlIG91dGdvaW5nIG1lc3NhZ2VzIG5lZWQgdG8gYmUgcHJlcGFyZWQgdG8gcXVldWVcbi8vIHVwIGRhdGEgaW50ZXJuYWxseSBiZWZvcmUgc2VuZGluZyBpdCBvbiBmdXJ0aGVyIHRvIHRoZSBzb2NrZXQncyBxdWV1ZS5cbi8vXG4vLyBUaGlzIGZ1bmN0aW9uLCBvdXRnb2luZ0ZsdXNoKCksIGlzIGNhbGxlZCBieSBib3RoIHRoZSBTZXJ2ZXIgYW5kIENsaWVudFxuLy8gdG8gYXR0ZW1wdCB0byBmbHVzaCBhbnkgcGVuZGluZyBtZXNzYWdlcyBvdXQgdG8gdGhlIHNvY2tldC5cbk91dGdvaW5nTWVzc2FnZS5wcm90b3R5cGUuX2ZsdXNoID0gZnVuY3Rpb24gX2ZsdXNoKCkge1xuICBjb25zdCBzb2NrZXQgPSB0aGlzLnNvY2tldDtcblxuICBpZiAoc29ja2V0ICYmIHNvY2tldC53cml0YWJsZSkge1xuICAgIC8vIFRoZXJlIG1pZ2h0IGJlIHJlbWFpbmluZyBkYXRhIGluIHRoaXMub3V0cHV0OyB3cml0ZSBpdCBvdXRcbiAgICBjb25zdCByZXQgPSB0aGlzLl9mbHVzaE91dHB1dChzb2NrZXQpO1xuXG4gICAgaWYgKHRoaXMuZmluaXNoZWQpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBxdWV1ZSB0byB0aGUgc2VydmVyIG9yIGNsaWVudCB0byBicmluZyBpbiB0aGUgbmV4dCB0aGlzLlxuICAgICAgdGhpcy5fZmluaXNoKCk7XG4gICAgfSBlbHNlIGlmIChyZXQgJiYgdGhpc1trTmVlZERyYWluXSkge1xuICAgICAgdGhpc1trTmVlZERyYWluXSA9IGZhbHNlO1xuICAgICAgdGhpcy5lbWl0KFwiZHJhaW5cIik7XG4gICAgfVxuICB9XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlLl9mbHVzaE91dHB1dCA9IGZ1bmN0aW9uIF9mbHVzaE91dHB1dChzb2NrZXQ6IFNvY2tldCkge1xuICB3aGlsZSAodGhpc1trQ29ya2VkXSkge1xuICAgIHRoaXNba0NvcmtlZF0tLTtcbiAgICBzb2NrZXQuY29yaygpO1xuICB9XG5cbiAgY29uc3Qgb3V0cHV0TGVuZ3RoID0gdGhpcy5vdXRwdXREYXRhLmxlbmd0aDtcbiAgaWYgKG91dHB1dExlbmd0aCA8PSAwKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IG91dHB1dERhdGEgPSB0aGlzLm91dHB1dERhdGE7XG4gIHNvY2tldC5jb3JrKCk7XG4gIGxldCByZXQ7XG4gIC8vIFJldGFpbiBmb3IoOzspIGxvb3AgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnNcbiAgLy8gUmVmczogaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL3B1bGwvMzA5NThcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRMZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHsgZGF0YSwgZW5jb2RpbmcsIGNhbGxiYWNrIH0gPSBvdXRwdXREYXRhW2ldO1xuICAgIHJldCA9IHNvY2tldC53cml0ZShkYXRhLCBlbmNvZGluZywgY2FsbGJhY2spO1xuICB9XG4gIHNvY2tldC51bmNvcmsoKTtcblxuICB0aGlzLm91dHB1dERhdGEgPSBbXTtcbiAgdGhpcy5fb25QZW5kaW5nRGF0YSgtdGhpcy5vdXRwdXRTaXplKTtcbiAgdGhpcy5vdXRwdXRTaXplID0gMDtcblxuICByZXR1cm4gcmV0O1xufTtcblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5mbHVzaEhlYWRlcnMgPSBmdW5jdGlvbiBmbHVzaEhlYWRlcnMoKSB7XG4gIGlmICghdGhpcy5faGVhZGVyKSB7XG4gICAgdGhpcy5faW1wbGljaXRIZWFkZXIoKTtcbiAgfVxuXG4gIC8vIEZvcmNlLWZsdXNoIHRoZSBoZWFkZXJzLlxuICB0aGlzLl9zZW5kKFwiXCIpO1xufTtcblxuT3V0Z29pbmdNZXNzYWdlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24gcGlwZSgpIHtcbiAgLy8gT3V0Z29pbmdNZXNzYWdlIHNob3VsZCBiZSB3cml0ZS1vbmx5LiBQaXBpbmcgZnJvbSBpdCBpcyBkaXNhYmxlZC5cbiAgdGhpcy5lbWl0KFwiZXJyb3JcIiwgbmV3IEVSUl9TVFJFQU1fQ0FOTk9UX1BJUEUoKSk7XG59O1xuXG5PdXRnb2luZ01lc3NhZ2UucHJvdG90eXBlW0VFLmNhcHR1cmVSZWplY3Rpb25TeW1ib2xdID0gZnVuY3Rpb24gKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBlcnI6IGFueSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX2V2ZW50OiBhbnksXG4pIHtcbiAgdGhpcy5kZXN0cm95KGVycik7XG59O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHZhbGlkYXRlSGVhZGVyTmFtZSxcbiAgdmFsaWRhdGVIZWFkZXJWYWx1ZSxcbiAgT3V0Z29pbmdNZXNzYWdlLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsNEVBQTRFO0FBRTVFLFNBQVMsdUJBQXVCLFFBQVEsK0JBQStCO0FBQ3ZFLE9BQU8sWUFBWSx3QkFBd0I7QUFDM0MsT0FBTyxRQUFRLGNBQWM7QUFDN0IsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUNyQyxZQUFZLGtCQUFrQixzQkFBc0I7QUFFcEQsU0FBUyxVQUFVLEVBQUUsV0FBVyxFQUFFLE9BQU8sUUFBUSxxQkFBcUI7QUFDdEUsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUNyQyxTQUNFLDJCQUEyQixzQkFBc0IsRUFDakQscUJBQXFCLGdCQUFnQixFQUNyQyxtQkFBbUIsYUFBYSxRQUMzQixvQkFBb0I7QUFDM0IsU0FBUywwQkFBMEIsRUFBRSxPQUFPLFFBQVEsNEJBQTRCO0FBQ2hGLDZCQUE2QjtBQUM3QixNQUFNLEVBQUUsZ0JBQWUsRUFBRSxHQUFHO0FBQzVCLFNBQ0UscUJBQXFCLEVBQ3JCLDZCQUE2QixFQUM3Qix3QkFBd0IsRUFDeEIsb0JBQW9CLEVBQ3BCLHFCQUFxQixFQUNyQixnQkFBZ0IsRUFDaEIsc0JBQXNCLEVBQ3RCLDBCQUEwQixFQUMxQiwyQkFBMkIsRUFDM0Isc0JBQXNCLEVBQ3RCLG9CQUFvQixFQUNwQixzQkFBc0IsRUFDdEIsMEJBQTBCLEVBQzFCLGVBQWUsUUFDVix1QkFBdUI7QUFDOUIsU0FBUyxjQUFjLFFBQVEsNEJBQTRCO0FBQzNELFNBQVMsWUFBWSxRQUFRLDJCQUEyQjtBQUV4RCxTQUFTLFFBQVEsUUFBUSw4QkFBOEI7QUFDdkQsSUFBSSxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQU87SUFDbkMsUUFBUTtBQUNWO0FBRUEsTUFBTSxrQkFBa0I7QUFFeEIsTUFBTSxVQUFVLE9BQU87QUFF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