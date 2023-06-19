// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { deferred } from "../async/deferred.ts";
import { _normalizeArgs, Socket } from "./net.ts";
import { Buffer } from "./buffer.ts";
import { ERR_SERVER_NOT_RUNNING } from "./internal/errors.ts";
import { EventEmitter } from "./events.ts";
import { nextTick } from "./_next_tick.ts";
import { Status as STATUS_CODES } from "../http/http_status.ts";
import { validatePort } from "./internal/validators.mjs";
import { Readable as NodeReadable, Writable as NodeWritable } from "./stream.ts";
import { OutgoingMessage } from "./_http_outgoing.ts";
import { Agent } from "./_http_agent.mjs";
import { chunkExpression as RE_TE_CHUNKED } from "./_http_common.ts";
import { urlToHttpOptions } from "./internal/url.ts";
import { constants, TCP } from "./internal_binding/tcp_wrap.ts";
const METHODS = [
    "ACL",
    "BIND",
    "CHECKOUT",
    "CONNECT",
    "COPY",
    "DELETE",
    "GET",
    "HEAD",
    "LINK",
    "LOCK",
    "M-SEARCH",
    "MERGE",
    "MKACTIVITY",
    "MKCALENDAR",
    "MKCOL",
    "MOVE",
    "NOTIFY",
    "OPTIONS",
    "PATCH",
    "POST",
    "PROPFIND",
    "PROPPATCH",
    "PURGE",
    "PUT",
    "REBIND",
    "REPORT",
    "SEARCH",
    "SOURCE",
    "SUBSCRIBE",
    "TRACE",
    "UNBIND",
    "UNLINK",
    "UNLOCK",
    "UNSUBSCRIBE"
];
// @ts-ignore Deno[Deno.internal] is used on purpose here
const DenoServe = Deno[Deno.internal]?.nodeUnstable?.serve || Deno.serve;
// @ts-ignore Deno[Deno.internal] is used on purpose here
const DenoUpgradeHttpRaw = Deno[Deno.internal]?.nodeUnstable?.upgradeHttpRaw || Deno.upgradeHttpRaw;
const ENCODER = new TextEncoder();
function chunkToU8(chunk) {
    if (typeof chunk === "string") {
        return ENCODER.encode(chunk);
    }
    return chunk;
}
// TODO: Implement ClientRequest methods (e.g. setHeader())
/** ClientRequest represents the http(s) request from the client */ class ClientRequest extends NodeWritable {
    defaultProtocol;
    body;
    controller;
    constructor(opts, cb){
        super();
        this.opts = opts;
        this.cb = cb;
        this.defaultProtocol = "http:";
        this.body = null;
        this.controller = null;
    }
    // deno-lint-ignore no-explicit-any
    _write(chunk, _enc, cb) {
        if (this.controller) {
            this.controller.enqueue(chunk);
            cb();
            return;
        }
        this.body = new ReadableStream({
            start: (controller)=>{
                this.controller = controller;
                controller.enqueue(chunk);
                cb();
            }
        });
    }
    async _final() {
        if (this.controller) {
            this.controller.close();
        }
        const body = await this._createBody(this.body, this.opts);
        const client = await this._createCustomClient();
        const opts = {
            body,
            method: this.opts.method,
            client,
            headers: this.opts.headers
        };
        const mayResponse = fetch(this._createUrlStrFromOptions(this.opts), opts).catch((e)=>{
            if (e.message.includes("connection closed before message completed")) {
            // Node.js seems ignoring this error
            } else {
                this.emit("error", e);
            }
            return undefined;
        });
        const res = new IncomingMessageForClient(await mayResponse, this._createSocket());
        this.emit("response", res);
        if (client) {
            res.on("end", ()=>{
                client.close();
            });
        }
        this.cb?.(res);
    }
    abort() {
        this.destroy();
    }
    async _createBody(body, opts) {
        if (!body) return null;
        if (!opts.headers) return body;
        const headers = Object.fromEntries(Object.entries(opts.headers).map(([k, v])=>[
                k.toLowerCase(),
                v
            ]));
        if (!RE_TE_CHUNKED.test(headers["transfer-encoding"]) && !Number.isNaN(Number.parseInt(headers["content-length"], 10))) {
            const bufferList = [];
            for await (const chunk of body){
                bufferList.push(chunk);
            }
            return Buffer.concat(bufferList);
        }
        return body;
    }
    _createCustomClient() {
        return Promise.resolve(undefined);
    }
    _createSocket() {
        // Note: Creates a dummy socket for the compatibility
        // Sometimes the libraries check some properties of socket
        // e.g. if (!response.socket.authorized) { ... }
        return new Socket({});
    }
    _createUrlStrFromOptions(opts) {
        if (opts.href) {
            return opts.href;
        }
        const protocol = opts.protocol ?? this.defaultProtocol;
        const auth = opts.auth;
        const host = opts.host ?? opts.hostname ?? "localhost";
        const defaultPort = opts.agent?.defaultPort;
        const port = opts.port ?? defaultPort ?? 80;
        let path = opts.path ?? "/";
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return `${protocol}//${auth ? `${auth}@` : ""}${host}${port === 80 ? "" : `:${port}`}${path}`;
    }
    setTimeout() {
        console.log("not implemented: ClientRequest.setTimeout");
    }
    opts;
    cb;
}
/** IncomingMessage for http(s) client */ export class IncomingMessageForClient extends NodeReadable {
    reader;
    #statusMessage;
    constructor(response, socket){
        super();
        this.response = response;
        this.socket = socket;
        this.#statusMessage = "";
        this.reader = response?.body?.getReader();
    }
    async _read(_size) {
        if (this.reader === undefined) {
            this.push(null);
            return;
        }
        try {
            const res = await this.reader.read();
            if (res.done) {
                this.push(null);
                return;
            }
            this.push(res.value);
        } catch (e) {
            // deno-lint-ignore no-explicit-any
            this.destroy(e);
        }
    }
    get headers() {
        if (this.response) {
            return Object.fromEntries(this.response.headers.entries());
        }
        return {};
    }
    get trailers() {
        return {};
    }
    get statusCode() {
        return this.response?.status || 0;
    }
    get statusMessage() {
        return this.#statusMessage || this.response?.statusText || "";
    }
    set statusMessage(v) {
        this.#statusMessage = v;
    }
    response;
    socket;
}
export class ServerResponse extends NodeWritable {
    statusCode = undefined;
    statusMessage = undefined;
    #headers = new Headers({});
    #readable;
    writable = true;
    // used by `npm:on-finished`
    finished = false;
    headersSent = false;
    #firstChunk = null;
    // Used if --unstable flag IS NOT present
    #reqEvent;
    // Used if --unstable flag IS present
    #resolve;
    #isFlashRequest;
    constructor(reqEvent, resolve){
        let controller;
        const readable = new ReadableStream({
            start (c) {
                controller = c;
            }
        });
        super({
            autoDestroy: true,
            defaultEncoding: "utf-8",
            emitClose: true,
            write: (chunk, _encoding, cb)=>{
                if (!this.headersSent) {
                    if (this.#firstChunk === null) {
                        this.#firstChunk = chunk;
                        return cb();
                    } else {
                        controller.enqueue(chunkToU8(this.#firstChunk));
                        this.#firstChunk = null;
                        this.respond(false);
                    }
                }
                controller.enqueue(chunkToU8(chunk));
                return cb();
            },
            final: (cb)=>{
                if (this.#firstChunk) {
                    this.respond(true, this.#firstChunk);
                } else if (!this.headersSent) {
                    this.respond(true);
                }
                controller.close();
                return cb();
            },
            destroy: (err, cb)=>{
                if (err) {
                    controller.error(err);
                }
                return cb(null);
            }
        });
        this.#readable = readable;
        this.#resolve = resolve;
        this.#reqEvent = reqEvent;
        this.#isFlashRequest = typeof resolve !== "undefined";
    }
    setHeader(name, value) {
        this.#headers.set(name, value);
        return this;
    }
    getHeader(name) {
        return this.#headers.get(name);
    }
    removeHeader(name) {
        return this.#headers.delete(name);
    }
    getHeaderNames() {
        return Array.from(this.#headers.keys());
    }
    hasHeader(name) {
        return this.#headers.has(name);
    }
    writeHead(status, headers) {
        this.statusCode = status;
        for(const k in headers){
            this.#headers.set(k, headers[k]);
        }
        return this;
    }
    #ensureHeaders(singleChunk) {
        if (this.statusCode === undefined) {
            this.statusCode = 200;
            this.statusMessage = "OK";
        }
        // Only taken if --unstable IS NOT present
        if (!this.#isFlashRequest && typeof singleChunk === "string" && !this.hasHeader("content-type")) {
            this.setHeader("content-type", "text/plain;charset=UTF-8");
        }
    }
    respond(final, singleChunk) {
        this.headersSent = true;
        this.#ensureHeaders(singleChunk);
        const body = singleChunk ?? (final ? null : this.#readable);
        if (this.#isFlashRequest) {
            this.#resolve(new Response(body, {
                headers: this.#headers,
                status: this.statusCode,
                statusText: this.statusMessage
            }));
        } else {
            this.#reqEvent.respondWith(new Response(body, {
                headers: this.#headers,
                status: this.statusCode,
                statusText: this.statusMessage
            })).catch(()=>{
            // ignore this error
            });
        }
    }
    // deno-lint-ignore no-explicit-any
    end(chunk, encoding, cb) {
        this.finished = true;
        if (this.#isFlashRequest) {
            // Flash sets both of these headers.
            this.#headers.delete("transfer-encoding");
            this.#headers.delete("content-length");
        } else if (!chunk && this.#headers.has("transfer-encoding")) {
            // FIXME(bnoordhuis) Node sends a zero length chunked body instead, i.e.,
            // the trailing "0\r\n", but respondWith() just hangs when I try that.
            this.#headers.set("content-length", "0");
            this.#headers.delete("transfer-encoding");
        }
        // @ts-expect-error The signature for cb is stricter than the one implemented here
        return super.end(chunk, encoding, cb);
    }
}
// TODO(@AaronO): optimize
export class IncomingMessageForServer extends NodeReadable {
    #req;
    url;
    method;
    constructor(req){
        // Check if no body (GET/HEAD/OPTIONS/...)
        const reader = req.body?.getReader();
        super({
            autoDestroy: true,
            emitClose: true,
            objectMode: false,
            read: async function(_size) {
                if (!reader) {
                    return this.push(null);
                }
                try {
                    const { value  } = await reader.read();
                    this.push(value !== undefined ? Buffer.from(value) : null);
                } catch (err) {
                    this.destroy(err);
                }
            },
            destroy: (err, cb)=>{
                reader?.cancel().finally(()=>cb(err));
            }
        });
        // TODO: consider more robust path extraction, e.g:
        // url: (new URL(request.url).pathname),
        this.url = req.url?.slice(req.url.indexOf("/", 8));
        this.method = req.method;
        this.#req = req;
    }
    get aborted() {
        return false;
    }
    get httpVersion() {
        return "1.1";
    }
    get headers() {
        return Object.fromEntries(this.#req.headers.entries());
    }
    get upgrade() {
        return Boolean(this.#req.headers.get("connection")?.toLowerCase().includes("upgrade") && this.#req.headers.get("upgrade"));
    }
}
export function Server(handler) {
    return new ServerImpl(handler);
}
class ServerImpl extends EventEmitter {
    #isFlashServer;
    #httpConnections = new Set();
    #listener;
    #addr;
    #hasClosed = false;
    #ac;
    #servePromise;
    listening = false;
    constructor(handler){
        super();
        // @ts-ignore Might be undefined without `--unstable` flag
        this.#isFlashServer = typeof DenoServe == "function";
        if (this.#isFlashServer) {
            this.#servePromise = deferred();
            this.#servePromise.then(()=>this.emit("close"));
        }
        if (handler !== undefined) {
            this.on("request", handler);
        }
    }
    listen(...args) {
        // TODO(bnoordhuis) Delegate to net.Server#listen().
        const normalized = _normalizeArgs(args);
        const options = normalized[0];
        const cb = normalized[1];
        if (cb !== null) {
            // @ts-ignore change EventEmitter's sig to use CallableFunction
            this.once("listening", cb);
        }
        let port = 0;
        if (typeof options.port === "number" || typeof options.port === "string") {
            validatePort(options.port, "options.port");
            port = options.port | 0;
        }
        // TODO(bnoordhuis) Node prefers [::] when host is omitted,
        // we on the other hand default to 0.0.0.0.
        if (this.#isFlashServer) {
            const hostname = options.host ?? "0.0.0.0";
            this.#addr = {
                hostname,
                port
            };
            this.listening = true;
            nextTick(()=>this.#serve());
        } else {
            this.listening = true;
            const hostname1 = options.host ?? "";
            this.#listener = Deno.listen({
                port,
                hostname: hostname1
            });
            nextTick(()=>this.#listenLoop());
        }
        return this;
    }
    async #listenLoop() {
        const go = async (httpConn)=>{
            try {
                for(;;){
                    let reqEvent = null;
                    try {
                        // Note: httpConn.nextRequest() calls httpConn.close() on error.
                        reqEvent = await httpConn.nextRequest();
                    } catch  {
                    // Connection closed.
                    // TODO(bnoordhuis) Emit "clientError" event on the http.Server
                    // instance? Node emits it when request parsing fails and expects
                    // the listener to send a raw 4xx HTTP response on the underlying
                    // net.Socket but we don't have one to pass to the listener.
                    }
                    if (reqEvent === null) {
                        break;
                    }
                    const req = new IncomingMessageForServer(reqEvent.request);
                    const res = new ServerResponse(reqEvent, undefined);
                    this.emit("request", req, res);
                }
            } finally{
                this.#httpConnections.delete(httpConn);
            }
        };
        const listener = this.#listener;
        if (listener !== undefined) {
            this.emit("listening");
            for await (const conn of listener){
                let httpConn;
                try {
                    httpConn = Deno.serveHttp(conn);
                } catch  {
                    continue; /// Connection closed.
                }
                this.#httpConnections.add(httpConn);
                go(httpConn);
            }
        }
    }
    #serve() {
        const ac = new AbortController();
        const handler = (request)=>{
            const req = new IncomingMessageForServer(request);
            if (req.upgrade && this.listenerCount("upgrade") > 0) {
                const [conn, head] = DenoUpgradeHttpRaw(request);
                const socket = new Socket({
                    handle: new TCP(constants.SERVER, conn)
                });
                this.emit("upgrade", req, socket, Buffer.from(head));
            } else {
                return new Promise((resolve)=>{
                    const res = new ServerResponse(undefined, resolve);
                    this.emit("request", req, res);
                });
            }
        };
        if (this.#hasClosed) {
            return;
        }
        this.#ac = ac;
        DenoServe({
            handler: handler,
            ...this.#addr,
            signal: ac.signal,
            // @ts-ignore Might be any without `--unstable` flag
            onListen: ({ port  })=>{
                this.#addr.port = port;
                this.emit("listening");
            }
        }).then(()=>this.#servePromise.resolve());
    }
    setTimeout() {
        console.error("Not implemented: Server.setTimeout()");
    }
    close(cb) {
        const listening = this.listening;
        this.listening = false;
        this.#hasClosed = true;
        if (typeof cb === "function") {
            if (listening) {
                this.once("close", cb);
            } else {
                this.once("close", function close() {
                    cb(new ERR_SERVER_NOT_RUNNING());
                });
            }
        }
        if (this.#isFlashServer) {
            if (listening && this.#ac) {
                this.#ac.abort();
                this.#ac = undefined;
            } else {
                this.#servePromise.resolve();
            }
        } else {
            nextTick(()=>this.emit("close"));
            if (listening) {
                this.#listener.close();
                this.#listener = undefined;
                for (const httpConn of this.#httpConnections){
                    try {
                        httpConn.close();
                    } catch  {
                    // Already closed.
                    }
                }
                this.#httpConnections.clear();
            }
        }
        return this;
    }
    address() {
        let addr;
        if (this.#isFlashServer) {
            addr = this.#addr;
        } else {
            addr = this.#listener.addr;
        }
        return {
            port: addr.port,
            address: addr.hostname
        };
    }
}
Server.prototype = ServerImpl.prototype;
export function createServer(handler) {
    return Server(handler);
}
// deno-lint-ignore no-explicit-any
export function request(...args) {
    let options = {};
    if (typeof args[0] === "string") {
        options = urlToHttpOptions(new URL(args.shift()));
    } else if (args[0] instanceof URL) {
        options = urlToHttpOptions(args.shift());
    }
    if (args[0] && typeof args[0] !== "function") {
        Object.assign(options, args.shift());
    }
    args.unshift(options);
    return new ClientRequest(args[0], args[1]);
}
// deno-lint-ignore no-explicit-any
export function get(...args) {
    const req = request(args[0], args[1], args[2]);
    req.end();
    return req;
}
export { Agent, ClientRequest, IncomingMessageForServer as IncomingMessage, METHODS, OutgoingMessage, STATUS_CODES };
export default {
    Agent,
    ClientRequest,
    STATUS_CODES,
    METHODS,
    createServer,
    Server,
    IncomingMessage: IncomingMessageForServer,
    IncomingMessageForClient,
    IncomingMessageForServer,
    OutgoingMessage,
    ServerResponse,
    request,
    get
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaHR0cC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyB0eXBlIERlZmVycmVkLCBkZWZlcnJlZCB9IGZyb20gXCIuLi9hc3luYy9kZWZlcnJlZC50c1wiO1xuaW1wb3J0IHsgX25vcm1hbGl6ZUFyZ3MsIExpc3Rlbk9wdGlvbnMsIFNvY2tldCB9IGZyb20gXCIuL25ldC50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBFUlJfU0VSVkVSX05PVF9SVU5OSU5HIH0gZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tIFwiLi9ldmVudHMudHNcIjtcbmltcG9ydCB7IG5leHRUaWNrIH0gZnJvbSBcIi4vX25leHRfdGljay50c1wiO1xuaW1wb3J0IHsgU3RhdHVzIGFzIFNUQVRVU19DT0RFUyB9IGZyb20gXCIuLi9odHRwL2h0dHBfc3RhdHVzLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZVBvcnQgfSBmcm9tIFwiLi9pbnRlcm5hbC92YWxpZGF0b3JzLm1qc1wiO1xuaW1wb3J0IHtcbiAgUmVhZGFibGUgYXMgTm9kZVJlYWRhYmxlLFxuICBXcml0YWJsZSBhcyBOb2RlV3JpdGFibGUsXG59IGZyb20gXCIuL3N0cmVhbS50c1wiO1xuaW1wb3J0IHsgT3V0Z29pbmdNZXNzYWdlIH0gZnJvbSBcIi4vX2h0dHBfb3V0Z29pbmcudHNcIjtcbmltcG9ydCB7IEFnZW50IH0gZnJvbSBcIi4vX2h0dHBfYWdlbnQubWpzXCI7XG5pbXBvcnQgeyBjaHVua0V4cHJlc3Npb24gYXMgUkVfVEVfQ0hVTktFRCB9IGZyb20gXCIuL19odHRwX2NvbW1vbi50c1wiO1xuaW1wb3J0IHsgdXJsVG9IdHRwT3B0aW9ucyB9IGZyb20gXCIuL2ludGVybmFsL3VybC50c1wiO1xuaW1wb3J0IHsgY29uc3RhbnRzLCBUQ1AgfSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL3RjcF93cmFwLnRzXCI7XG5cbmNvbnN0IE1FVEhPRFMgPSBbXG4gIFwiQUNMXCIsXG4gIFwiQklORFwiLFxuICBcIkNIRUNLT1VUXCIsXG4gIFwiQ09OTkVDVFwiLFxuICBcIkNPUFlcIixcbiAgXCJERUxFVEVcIixcbiAgXCJHRVRcIixcbiAgXCJIRUFEXCIsXG4gIFwiTElOS1wiLFxuICBcIkxPQ0tcIixcbiAgXCJNLVNFQVJDSFwiLFxuICBcIk1FUkdFXCIsXG4gIFwiTUtBQ1RJVklUWVwiLFxuICBcIk1LQ0FMRU5EQVJcIixcbiAgXCJNS0NPTFwiLFxuICBcIk1PVkVcIixcbiAgXCJOT1RJRllcIixcbiAgXCJPUFRJT05TXCIsXG4gIFwiUEFUQ0hcIixcbiAgXCJQT1NUXCIsXG4gIFwiUFJPUEZJTkRcIixcbiAgXCJQUk9QUEFUQ0hcIixcbiAgXCJQVVJHRVwiLFxuICBcIlBVVFwiLFxuICBcIlJFQklORFwiLFxuICBcIlJFUE9SVFwiLFxuICBcIlNFQVJDSFwiLFxuICBcIlNPVVJDRVwiLFxuICBcIlNVQlNDUklCRVwiLFxuICBcIlRSQUNFXCIsXG4gIFwiVU5CSU5EXCIsXG4gIFwiVU5MSU5LXCIsXG4gIFwiVU5MT0NLXCIsXG4gIFwiVU5TVUJTQ1JJQkVcIixcbl07XG5cbnR5cGUgQ2h1bmsgPSBzdHJpbmcgfCBCdWZmZXIgfCBVaW50OEFycmF5O1xuXG4vLyBAdHMtaWdub3JlIERlbm9bRGVuby5pbnRlcm5hbF0gaXMgdXNlZCBvbiBwdXJwb3NlIGhlcmVcbmNvbnN0IERlbm9TZXJ2ZSA9IERlbm9bRGVuby5pbnRlcm5hbF0/Lm5vZGVVbnN0YWJsZT8uc2VydmUgfHwgRGVuby5zZXJ2ZTtcbi8vIEB0cy1pZ25vcmUgRGVub1tEZW5vLmludGVybmFsXSBpcyB1c2VkIG9uIHB1cnBvc2UgaGVyZVxuY29uc3QgRGVub1VwZ3JhZGVIdHRwUmF3ID0gRGVub1tEZW5vLmludGVybmFsXT8ubm9kZVVuc3RhYmxlPy51cGdyYWRlSHR0cFJhdyB8fFxuICBEZW5vLnVwZ3JhZGVIdHRwUmF3O1xuXG5jb25zdCBFTkNPREVSID0gbmV3IFRleHRFbmNvZGVyKCk7XG5mdW5jdGlvbiBjaHVua1RvVTgoY2h1bms6IENodW5rKTogVWludDhBcnJheSB7XG4gIGlmICh0eXBlb2YgY2h1bmsgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gRU5DT0RFUi5lbmNvZGUoY2h1bmspO1xuICB9XG4gIHJldHVybiBjaHVuaztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXF1ZXN0T3B0aW9ucyB7XG4gIGFnZW50PzogQWdlbnQ7XG4gIGF1dGg/OiBzdHJpbmc7XG4gIGNyZWF0ZUNvbm5lY3Rpb24/OiAoKSA9PiB1bmtub3duO1xuICBkZWZhdWx0UG9ydD86IG51bWJlcjtcbiAgZmFtaWx5PzogbnVtYmVyO1xuICBoZWFkZXJzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgaGludHM/OiBudW1iZXI7XG4gIGhvc3Q/OiBzdHJpbmc7XG4gIGhvc3RuYW1lPzogc3RyaW5nO1xuICBpbnNlY3VyZUhUVFBQYXJzZXI/OiBib29sZWFuO1xuICBsb2NhbEFkZHJlc3M/OiBzdHJpbmc7XG4gIGxvY2FsUG9ydD86IG51bWJlcjtcbiAgbG9va3VwPzogKCkgPT4gdm9pZDtcbiAgbWF4SGVhZGVyU2l6ZT86IG51bWJlcjtcbiAgbWV0aG9kPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xuICBwb3J0PzogbnVtYmVyO1xuICBwcm90b2NvbD86IHN0cmluZztcbiAgc2V0SG9zdD86IGJvb2xlYW47XG4gIHNvY2tldFBhdGg/OiBzdHJpbmc7XG4gIHRpbWVvdXQ/OiBudW1iZXI7XG4gIHNpZ25hbD86IEFib3J0U2lnbmFsO1xuICBocmVmPzogc3RyaW5nO1xufVxuXG4vLyBUT0RPOiBJbXBsZW1lbnQgQ2xpZW50UmVxdWVzdCBtZXRob2RzIChlLmcuIHNldEhlYWRlcigpKVxuLyoqIENsaWVudFJlcXVlc3QgcmVwcmVzZW50cyB0aGUgaHR0cChzKSByZXF1ZXN0IGZyb20gdGhlIGNsaWVudCAqL1xuY2xhc3MgQ2xpZW50UmVxdWVzdCBleHRlbmRzIE5vZGVXcml0YWJsZSB7XG4gIGRlZmF1bHRQcm90b2NvbCA9IFwiaHR0cDpcIjtcbiAgYm9keTogbnVsbCB8IFJlYWRhYmxlU3RyZWFtID0gbnVsbDtcbiAgY29udHJvbGxlcjogUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgb3B0czogUmVxdWVzdE9wdGlvbnMsXG4gICAgcHVibGljIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlRm9yQ2xpZW50KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgb3ZlcnJpZGUgX3dyaXRlKGNodW5rOiBhbnksIF9lbmM6IHN0cmluZywgY2I6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAodGhpcy5jb250cm9sbGVyKSB7XG4gICAgICB0aGlzLmNvbnRyb2xsZXIuZW5xdWV1ZShjaHVuayk7XG4gICAgICBjYigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYm9keSA9IG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgICBzdGFydDogKGNvbnRyb2xsZXIpID0+IHtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyID0gY29udHJvbGxlcjtcbiAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGNodW5rKTtcbiAgICAgICAgY2IoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBfZmluYWwoKSB7XG4gICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgdGhpcy5jb250cm9sbGVyLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMuX2NyZWF0ZUJvZHkodGhpcy5ib2R5LCB0aGlzLm9wdHMpO1xuICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHRoaXMuX2NyZWF0ZUN1c3RvbUNsaWVudCgpO1xuICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICBib2R5LFxuICAgICAgbWV0aG9kOiB0aGlzLm9wdHMubWV0aG9kLFxuICAgICAgY2xpZW50LFxuICAgICAgaGVhZGVyczogdGhpcy5vcHRzLmhlYWRlcnMsXG4gICAgfTtcbiAgICBjb25zdCBtYXlSZXNwb25zZSA9IGZldGNoKHRoaXMuX2NyZWF0ZVVybFN0ckZyb21PcHRpb25zKHRoaXMub3B0cyksIG9wdHMpXG4gICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgaWYgKGUubWVzc2FnZS5pbmNsdWRlcyhcImNvbm5lY3Rpb24gY2xvc2VkIGJlZm9yZSBtZXNzYWdlIGNvbXBsZXRlZFwiKSkge1xuICAgICAgICAgIC8vIE5vZGUuanMgc2VlbXMgaWdub3JpbmcgdGhpcyBlcnJvclxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZW1pdChcImVycm9yXCIsIGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9KTtcbiAgICBjb25zdCByZXMgPSBuZXcgSW5jb21pbmdNZXNzYWdlRm9yQ2xpZW50KFxuICAgICAgYXdhaXQgbWF5UmVzcG9uc2UsXG4gICAgICB0aGlzLl9jcmVhdGVTb2NrZXQoKSxcbiAgICApO1xuICAgIHRoaXMuZW1pdChcInJlc3BvbnNlXCIsIHJlcyk7XG4gICAgaWYgKGNsaWVudCkge1xuICAgICAgcmVzLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgY2xpZW50LmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5jYj8uKHJlcyk7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIGFzeW5jIF9jcmVhdGVCb2R5KFxuICAgIGJvZHk6IFJlYWRhYmxlU3RyZWFtIHwgbnVsbCxcbiAgICBvcHRzOiBSZXF1ZXN0T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxCdWZmZXIgfCBSZWFkYWJsZVN0cmVhbSB8IG51bGw+IHtcbiAgICBpZiAoIWJvZHkpIHJldHVybiBudWxsO1xuICAgIGlmICghb3B0cy5oZWFkZXJzKSByZXR1cm4gYm9keTtcblxuICAgIGNvbnN0IGhlYWRlcnMgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBPYmplY3QuZW50cmllcyhvcHRzLmhlYWRlcnMpLm1hcCgoW2ssIHZdKSA9PiBbay50b0xvd2VyQ2FzZSgpLCB2XSksXG4gICAgKTtcblxuICAgIGlmIChcbiAgICAgICFSRV9URV9DSFVOS0VELnRlc3QoaGVhZGVyc1tcInRyYW5zZmVyLWVuY29kaW5nXCJdKSAmJlxuICAgICAgIU51bWJlci5pc05hTihOdW1iZXIucGFyc2VJbnQoaGVhZGVyc1tcImNvbnRlbnQtbGVuZ3RoXCJdLCAxMCkpXG4gICAgKSB7XG4gICAgICBjb25zdCBidWZmZXJMaXN0OiBCdWZmZXJbXSA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBib2R5KSB7XG4gICAgICAgIGJ1ZmZlckxpc3QucHVzaChjaHVuayk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQnVmZmVyLmNvbmNhdChidWZmZXJMaXN0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYm9keTtcbiAgfVxuXG4gIF9jcmVhdGVDdXN0b21DbGllbnQoKTogUHJvbWlzZTxEZW5vLkh0dHBDbGllbnQgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gIH1cblxuICBfY3JlYXRlU29ja2V0KCk6IFNvY2tldCB7XG4gICAgLy8gTm90ZTogQ3JlYXRlcyBhIGR1bW15IHNvY2tldCBmb3IgdGhlIGNvbXBhdGliaWxpdHlcbiAgICAvLyBTb21ldGltZXMgdGhlIGxpYnJhcmllcyBjaGVjayBzb21lIHByb3BlcnRpZXMgb2Ygc29ja2V0XG4gICAgLy8gZS5nLiBpZiAoIXJlc3BvbnNlLnNvY2tldC5hdXRob3JpemVkKSB7IC4uLiB9XG4gICAgcmV0dXJuIG5ldyBTb2NrZXQoe30pO1xuICB9XG5cbiAgX2NyZWF0ZVVybFN0ckZyb21PcHRpb25zKG9wdHM6IFJlcXVlc3RPcHRpb25zKTogc3RyaW5nIHtcbiAgICBpZiAob3B0cy5ocmVmKSB7XG4gICAgICByZXR1cm4gb3B0cy5ocmVmO1xuICAgIH1cbiAgICBjb25zdCBwcm90b2NvbCA9IG9wdHMucHJvdG9jb2wgPz8gdGhpcy5kZWZhdWx0UHJvdG9jb2w7XG4gICAgY29uc3QgYXV0aCA9IG9wdHMuYXV0aDtcbiAgICBjb25zdCBob3N0ID0gb3B0cy5ob3N0ID8/IG9wdHMuaG9zdG5hbWUgPz8gXCJsb2NhbGhvc3RcIjtcbiAgICBjb25zdCBkZWZhdWx0UG9ydCA9IG9wdHMuYWdlbnQ/LmRlZmF1bHRQb3J0O1xuICAgIGNvbnN0IHBvcnQgPSBvcHRzLnBvcnQgPz8gZGVmYXVsdFBvcnQgPz8gODA7XG4gICAgbGV0IHBhdGggPSBvcHRzLnBhdGggPz8gXCIvXCI7XG4gICAgaWYgKCFwYXRoLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBwYXRoID0gXCIvXCIgKyBwYXRoO1xuICAgIH1cbiAgICByZXR1cm4gYCR7cHJvdG9jb2x9Ly8ke2F1dGggPyBgJHthdXRofUBgIDogXCJcIn0ke2hvc3R9JHtcbiAgICAgIHBvcnQgPT09IDgwID8gXCJcIiA6IGA6JHtwb3J0fWBcbiAgICB9JHtwYXRofWA7XG4gIH1cblxuICBzZXRUaW1lb3V0KCkge1xuICAgIGNvbnNvbGUubG9nKFwibm90IGltcGxlbWVudGVkOiBDbGllbnRSZXF1ZXN0LnNldFRpbWVvdXRcIik7XG4gIH1cbn1cblxuLyoqIEluY29taW5nTWVzc2FnZSBmb3IgaHR0cChzKSBjbGllbnQgKi9cbmV4cG9ydCBjbGFzcyBJbmNvbWluZ01lc3NhZ2VGb3JDbGllbnQgZXh0ZW5kcyBOb2RlUmVhZGFibGUge1xuICByZWFkZXI6IFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlciB8IHVuZGVmaW5lZDtcbiAgI3N0YXR1c01lc3NhZ2UgPSBcIlwiO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVzcG9uc2U6IFJlc3BvbnNlIHwgdW5kZWZpbmVkLCBwdWJsaWMgc29ja2V0OiBTb2NrZXQpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMucmVhZGVyID0gcmVzcG9uc2U/LmJvZHk/LmdldFJlYWRlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgX3JlYWQoX3NpemU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLnJlYWRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnB1c2gobnVsbCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnJlYWRlci5yZWFkKCk7XG4gICAgICBpZiAocmVzLmRvbmUpIHtcbiAgICAgICAgdGhpcy5wdXNoKG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLnB1c2gocmVzLnZhbHVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgdGhpcy5kZXN0cm95KGUgYXMgYW55KTtcbiAgICB9XG4gIH1cblxuICBnZXQgaGVhZGVycygpIHtcbiAgICBpZiAodGhpcy5yZXNwb25zZSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh0aGlzLnJlc3BvbnNlLmhlYWRlcnMuZW50cmllcygpKTtcbiAgICB9XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgZ2V0IHRyYWlsZXJzKCkge1xuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIGdldCBzdGF0dXNDb2RlKCkge1xuICAgIHJldHVybiB0aGlzLnJlc3BvbnNlPy5zdGF0dXMgfHwgMDtcbiAgfVxuXG4gIGdldCBzdGF0dXNNZXNzYWdlKCkge1xuICAgIHJldHVybiB0aGlzLiNzdGF0dXNNZXNzYWdlIHx8IHRoaXMucmVzcG9uc2U/LnN0YXR1c1RleHQgfHwgXCJcIjtcbiAgfVxuXG4gIHNldCBzdGF0dXNNZXNzYWdlKHY6IHN0cmluZykge1xuICAgIHRoaXMuI3N0YXR1c01lc3NhZ2UgPSB2O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXJ2ZXJSZXNwb25zZSBleHRlbmRzIE5vZGVXcml0YWJsZSB7XG4gIHN0YXR1c0NvZGU/OiBudW1iZXIgPSB1bmRlZmluZWQ7XG4gIHN0YXR1c01lc3NhZ2U/OiBzdHJpbmcgPSB1bmRlZmluZWQ7XG4gICNoZWFkZXJzID0gbmV3IEhlYWRlcnMoe30pO1xuICAjcmVhZGFibGU6IFJlYWRhYmxlU3RyZWFtO1xuICBvdmVycmlkZSB3cml0YWJsZSA9IHRydWU7XG4gIC8vIHVzZWQgYnkgYG5wbTpvbi1maW5pc2hlZGBcbiAgZmluaXNoZWQgPSBmYWxzZTtcbiAgaGVhZGVyc1NlbnQgPSBmYWxzZTtcbiAgI2ZpcnN0Q2h1bms6IENodW5rIHwgbnVsbCA9IG51bGw7XG4gIC8vIFVzZWQgaWYgLS11bnN0YWJsZSBmbGFnIElTIE5PVCBwcmVzZW50XG4gICNyZXFFdmVudD86IERlbm8uUmVxdWVzdEV2ZW50O1xuICAvLyBVc2VkIGlmIC0tdW5zdGFibGUgZmxhZyBJUyBwcmVzZW50XG4gICNyZXNvbHZlPzogKHZhbHVlOiBSZXNwb25zZSB8IFByb21pc2VMaWtlPFJlc3BvbnNlPikgPT4gdm9pZDtcbiAgI2lzRmxhc2hSZXF1ZXN0OiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlcUV2ZW50OiB1bmRlZmluZWQgfCBEZW5vLlJlcXVlc3RFdmVudCxcbiAgICByZXNvbHZlOiB1bmRlZmluZWQgfCAoKHZhbHVlOiBSZXNwb25zZSB8IFByb21pc2VMaWtlPFJlc3BvbnNlPikgPT4gdm9pZCksXG4gICkge1xuICAgIGxldCBjb250cm9sbGVyOiBSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyO1xuICAgIGNvbnN0IHJlYWRhYmxlID0gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICAgIHN0YXJ0KGMpIHtcbiAgICAgICAgY29udHJvbGxlciA9IGMgYXMgUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlcjtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc3VwZXIoe1xuICAgICAgYXV0b0Rlc3Ryb3k6IHRydWUsXG4gICAgICBkZWZhdWx0RW5jb2Rpbmc6IFwidXRmLThcIixcbiAgICAgIGVtaXRDbG9zZTogdHJ1ZSxcbiAgICAgIHdyaXRlOiAoY2h1bmssIF9lbmNvZGluZywgY2IpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgaWYgKHRoaXMuI2ZpcnN0Q2h1bmsgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuI2ZpcnN0Q2h1bmsgPSBjaHVuaztcbiAgICAgICAgICAgIHJldHVybiBjYigpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoY2h1bmtUb1U4KHRoaXMuI2ZpcnN0Q2h1bmspKTtcbiAgICAgICAgICAgIHRoaXMuI2ZpcnN0Q2h1bmsgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZXNwb25kKGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGNodW5rVG9VOChjaHVuaykpO1xuICAgICAgICByZXR1cm4gY2IoKTtcbiAgICAgIH0sXG4gICAgICBmaW5hbDogKGNiKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLiNmaXJzdENodW5rKSB7XG4gICAgICAgICAgdGhpcy5yZXNwb25kKHRydWUsIHRoaXMuI2ZpcnN0Q2h1bmspO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgdGhpcy5yZXNwb25kKHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICB9LFxuICAgICAgZGVzdHJveTogKGVyciwgY2IpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2IobnVsbCk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuI3JlYWRhYmxlID0gcmVhZGFibGU7XG4gICAgdGhpcy4jcmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy4jcmVxRXZlbnQgPSByZXFFdmVudDtcbiAgICB0aGlzLiNpc0ZsYXNoUmVxdWVzdCA9IHR5cGVvZiByZXNvbHZlICE9PSBcInVuZGVmaW5lZFwiO1xuICB9XG5cbiAgc2V0SGVhZGVyKG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuI2hlYWRlcnMuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGdldEhlYWRlcihuYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy4jaGVhZGVycy5nZXQobmFtZSk7XG4gIH1cbiAgcmVtb3ZlSGVhZGVyKG5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLiNoZWFkZXJzLmRlbGV0ZShuYW1lKTtcbiAgfVxuICBnZXRIZWFkZXJOYW1lcygpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLiNoZWFkZXJzLmtleXMoKSk7XG4gIH1cbiAgaGFzSGVhZGVyKG5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLiNoZWFkZXJzLmhhcyhuYW1lKTtcbiAgfVxuXG4gIHdyaXRlSGVhZChzdGF0dXM6IG51bWJlciwgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICAgIHRoaXMuc3RhdHVzQ29kZSA9IHN0YXR1cztcbiAgICBmb3IgKGNvbnN0IGsgaW4gaGVhZGVycykge1xuICAgICAgdGhpcy4jaGVhZGVycy5zZXQoaywgaGVhZGVyc1trXSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgI2Vuc3VyZUhlYWRlcnMoc2luZ2xlQ2h1bms/OiBDaHVuaykge1xuICAgIGlmICh0aGlzLnN0YXR1c0NvZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgdGhpcy5zdGF0dXNNZXNzYWdlID0gXCJPS1wiO1xuICAgIH1cbiAgICAvLyBPbmx5IHRha2VuIGlmIC0tdW5zdGFibGUgSVMgTk9UIHByZXNlbnRcbiAgICBpZiAoXG4gICAgICAhdGhpcy4jaXNGbGFzaFJlcXVlc3QgJiYgdHlwZW9mIHNpbmdsZUNodW5rID09PSBcInN0cmluZ1wiICYmXG4gICAgICAhdGhpcy5oYXNIZWFkZXIoXCJjb250ZW50LXR5cGVcIilcbiAgICApIHtcbiAgICAgIHRoaXMuc2V0SGVhZGVyKFwiY29udGVudC10eXBlXCIsIFwidGV4dC9wbGFpbjtjaGFyc2V0PVVURi04XCIpO1xuICAgIH1cbiAgfVxuXG4gIHJlc3BvbmQoZmluYWw6IGJvb2xlYW4sIHNpbmdsZUNodW5rPzogQ2h1bmspIHtcbiAgICB0aGlzLmhlYWRlcnNTZW50ID0gdHJ1ZTtcbiAgICB0aGlzLiNlbnN1cmVIZWFkZXJzKHNpbmdsZUNodW5rKTtcbiAgICBjb25zdCBib2R5ID0gc2luZ2xlQ2h1bmsgPz8gKGZpbmFsID8gbnVsbCA6IHRoaXMuI3JlYWRhYmxlKTtcbiAgICBpZiAodGhpcy4jaXNGbGFzaFJlcXVlc3QpIHtcbiAgICAgIHRoaXMuI3Jlc29sdmUhKFxuICAgICAgICBuZXcgUmVzcG9uc2UoYm9keSwge1xuICAgICAgICAgIGhlYWRlcnM6IHRoaXMuI2hlYWRlcnMsXG4gICAgICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1c0NvZGUsXG4gICAgICAgICAgc3RhdHVzVGV4dDogdGhpcy5zdGF0dXNNZXNzYWdlLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI3JlcUV2ZW50IS5yZXNwb25kV2l0aChcbiAgICAgICAgbmV3IFJlc3BvbnNlKGJvZHksIHtcbiAgICAgICAgICBoZWFkZXJzOiB0aGlzLiNoZWFkZXJzLFxuICAgICAgICAgIHN0YXR1czogdGhpcy5zdGF0dXNDb2RlLFxuICAgICAgICAgIHN0YXR1c1RleHQ6IHRoaXMuc3RhdHVzTWVzc2FnZSxcbiAgICAgICAgfSksXG4gICAgICApLmNhdGNoKCgpID0+IHtcbiAgICAgICAgLy8gaWdub3JlIHRoaXMgZXJyb3JcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG92ZXJyaWRlIGVuZChjaHVuaz86IGFueSwgZW5jb2Rpbmc/OiBhbnksIGNiPzogYW55KTogdGhpcyB7XG4gICAgdGhpcy5maW5pc2hlZCA9IHRydWU7XG4gICAgaWYgKHRoaXMuI2lzRmxhc2hSZXF1ZXN0KSB7XG4gICAgICAvLyBGbGFzaCBzZXRzIGJvdGggb2YgdGhlc2UgaGVhZGVycy5cbiAgICAgIHRoaXMuI2hlYWRlcnMuZGVsZXRlKFwidHJhbnNmZXItZW5jb2RpbmdcIik7XG4gICAgICB0aGlzLiNoZWFkZXJzLmRlbGV0ZShcImNvbnRlbnQtbGVuZ3RoXCIpO1xuICAgIH0gZWxzZSBpZiAoIWNodW5rICYmIHRoaXMuI2hlYWRlcnMuaGFzKFwidHJhbnNmZXItZW5jb2RpbmdcIikpIHtcbiAgICAgIC8vIEZJWE1FKGJub29yZGh1aXMpIE5vZGUgc2VuZHMgYSB6ZXJvIGxlbmd0aCBjaHVua2VkIGJvZHkgaW5zdGVhZCwgaS5lLixcbiAgICAgIC8vIHRoZSB0cmFpbGluZyBcIjBcXHJcXG5cIiwgYnV0IHJlc3BvbmRXaXRoKCkganVzdCBoYW5ncyB3aGVuIEkgdHJ5IHRoYXQuXG4gICAgICB0aGlzLiNoZWFkZXJzLnNldChcImNvbnRlbnQtbGVuZ3RoXCIsIFwiMFwiKTtcbiAgICAgIHRoaXMuI2hlYWRlcnMuZGVsZXRlKFwidHJhbnNmZXItZW5jb2RpbmdcIik7XG4gICAgfVxuXG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciBUaGUgc2lnbmF0dXJlIGZvciBjYiBpcyBzdHJpY3RlciB0aGFuIHRoZSBvbmUgaW1wbGVtZW50ZWQgaGVyZVxuICAgIHJldHVybiBzdXBlci5lbmQoY2h1bmssIGVuY29kaW5nLCBjYik7XG4gIH1cbn1cblxuLy8gVE9ETyhAQWFyb25PKTogb3B0aW1pemVcbmV4cG9ydCBjbGFzcyBJbmNvbWluZ01lc3NhZ2VGb3JTZXJ2ZXIgZXh0ZW5kcyBOb2RlUmVhZGFibGUge1xuICAjcmVxOiBSZXF1ZXN0O1xuICB1cmw6IHN0cmluZztcbiAgbWV0aG9kOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocmVxOiBSZXF1ZXN0KSB7XG4gICAgLy8gQ2hlY2sgaWYgbm8gYm9keSAoR0VUL0hFQUQvT1BUSU9OUy8uLi4pXG4gICAgY29uc3QgcmVhZGVyID0gcmVxLmJvZHk/LmdldFJlYWRlcigpO1xuICAgIHN1cGVyKHtcbiAgICAgIGF1dG9EZXN0cm95OiB0cnVlLFxuICAgICAgZW1pdENsb3NlOiB0cnVlLFxuICAgICAgb2JqZWN0TW9kZTogZmFsc2UsXG4gICAgICByZWFkOiBhc3luYyBmdW5jdGlvbiAoX3NpemUpIHtcbiAgICAgICAgaWYgKCFyZWFkZXIpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5wdXNoKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IHZhbHVlIH0gPSBhd2FpdCByZWFkZXIhLnJlYWQoKTtcbiAgICAgICAgICB0aGlzLnB1c2godmFsdWUgIT09IHVuZGVmaW5lZCA/IEJ1ZmZlci5mcm9tKHZhbHVlKSA6IG51bGwpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICB0aGlzLmRlc3Ryb3koZXJyIGFzIEVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlc3Ryb3k6IChlcnIsIGNiKSA9PiB7XG4gICAgICAgIHJlYWRlcj8uY2FuY2VsKCkuZmluYWxseSgoKSA9PiBjYihlcnIpKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgLy8gVE9ETzogY29uc2lkZXIgbW9yZSByb2J1c3QgcGF0aCBleHRyYWN0aW9uLCBlLmc6XG4gICAgLy8gdXJsOiAobmV3IFVSTChyZXF1ZXN0LnVybCkucGF0aG5hbWUpLFxuICAgIHRoaXMudXJsID0gcmVxLnVybD8uc2xpY2UocmVxLnVybC5pbmRleE9mKFwiL1wiLCA4KSk7XG4gICAgdGhpcy5tZXRob2QgPSByZXEubWV0aG9kO1xuICAgIHRoaXMuI3JlcSA9IHJlcTtcbiAgfVxuXG4gIGdldCBhYm9ydGVkKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGdldCBodHRwVmVyc2lvbigpIHtcbiAgICByZXR1cm4gXCIxLjFcIjtcbiAgfVxuXG4gIGdldCBoZWFkZXJzKCkge1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXModGhpcy4jcmVxLmhlYWRlcnMuZW50cmllcygpKTtcbiAgfVxuXG4gIGdldCB1cGdyYWRlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBCb29sZWFuKFxuICAgICAgdGhpcy4jcmVxLmhlYWRlcnMuZ2V0KFwiY29ubmVjdGlvblwiKT8udG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcInVwZ3JhZGVcIikgJiZcbiAgICAgICAgdGhpcy4jcmVxLmhlYWRlcnMuZ2V0KFwidXBncmFkZVwiKSxcbiAgICApO1xuICB9XG59XG5cbnR5cGUgU2VydmVySGFuZGxlciA9IChcbiAgcmVxOiBJbmNvbWluZ01lc3NhZ2VGb3JTZXJ2ZXIsXG4gIHJlczogU2VydmVyUmVzcG9uc2UsXG4pID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBTZXJ2ZXIoaGFuZGxlcj86IFNlcnZlckhhbmRsZXIpOiBTZXJ2ZXJJbXBsIHtcbiAgcmV0dXJuIG5ldyBTZXJ2ZXJJbXBsKGhhbmRsZXIpO1xufVxuXG5jbGFzcyBTZXJ2ZXJJbXBsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgI2lzRmxhc2hTZXJ2ZXI6IGJvb2xlYW47XG5cbiAgI2h0dHBDb25uZWN0aW9uczogU2V0PERlbm8uSHR0cENvbm4+ID0gbmV3IFNldCgpO1xuICAjbGlzdGVuZXI/OiBEZW5vLkxpc3RlbmVyO1xuXG4gICNhZGRyPzogRGVuby5OZXRBZGRyO1xuICAjaGFzQ2xvc2VkID0gZmFsc2U7XG4gICNhYz86IEFib3J0Q29udHJvbGxlcjtcbiAgI3NlcnZlUHJvbWlzZT86IERlZmVycmVkPHZvaWQ+O1xuICBsaXN0ZW5pbmcgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihoYW5kbGVyPzogU2VydmVySGFuZGxlcikge1xuICAgIHN1cGVyKCk7XG4gICAgLy8gQHRzLWlnbm9yZSBNaWdodCBiZSB1bmRlZmluZWQgd2l0aG91dCBgLS11bnN0YWJsZWAgZmxhZ1xuICAgIHRoaXMuI2lzRmxhc2hTZXJ2ZXIgPSB0eXBlb2YgRGVub1NlcnZlID09IFwiZnVuY3Rpb25cIjtcbiAgICBpZiAodGhpcy4jaXNGbGFzaFNlcnZlcikge1xuICAgICAgdGhpcy4jc2VydmVQcm9taXNlID0gZGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuI3NlcnZlUHJvbWlzZS50aGVuKCgpID0+IHRoaXMuZW1pdChcImNsb3NlXCIpKTtcbiAgICB9XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5vbihcInJlcXVlc3RcIiwgaGFuZGxlcik7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuKC4uLmFyZ3M6IHVua25vd25bXSk6IHRoaXMge1xuICAgIC8vIFRPRE8oYm5vb3JkaHVpcykgRGVsZWdhdGUgdG8gbmV0LlNlcnZlciNsaXN0ZW4oKS5cbiAgICBjb25zdCBub3JtYWxpemVkID0gX25vcm1hbGl6ZUFyZ3MoYXJncyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZWRbMF0gYXMgUGFydGlhbDxMaXN0ZW5PcHRpb25zPjtcbiAgICBjb25zdCBjYiA9IG5vcm1hbGl6ZWRbMV07XG5cbiAgICBpZiAoY2IgIT09IG51bGwpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmUgY2hhbmdlIEV2ZW50RW1pdHRlcidzIHNpZyB0byB1c2UgQ2FsbGFibGVGdW5jdGlvblxuICAgICAgdGhpcy5vbmNlKFwibGlzdGVuaW5nXCIsIGNiKTtcbiAgICB9XG5cbiAgICBsZXQgcG9ydCA9IDA7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnBvcnQgPT09IFwibnVtYmVyXCIgfHwgdHlwZW9mIG9wdGlvbnMucG9ydCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdmFsaWRhdGVQb3J0KG9wdGlvbnMucG9ydCwgXCJvcHRpb25zLnBvcnRcIik7XG4gICAgICBwb3J0ID0gb3B0aW9ucy5wb3J0IHwgMDtcbiAgICB9XG5cbiAgICAvLyBUT0RPKGJub29yZGh1aXMpIE5vZGUgcHJlZmVycyBbOjpdIHdoZW4gaG9zdCBpcyBvbWl0dGVkLFxuICAgIC8vIHdlIG9uIHRoZSBvdGhlciBoYW5kIGRlZmF1bHQgdG8gMC4wLjAuMC5cbiAgICBpZiAodGhpcy4jaXNGbGFzaFNlcnZlcikge1xuICAgICAgY29uc3QgaG9zdG5hbWUgPSBvcHRpb25zLmhvc3QgPz8gXCIwLjAuMC4wXCI7XG4gICAgICB0aGlzLiNhZGRyID0ge1xuICAgICAgICBob3N0bmFtZSxcbiAgICAgICAgcG9ydCxcbiAgICAgIH0gYXMgRGVuby5OZXRBZGRyO1xuICAgICAgdGhpcy5saXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgbmV4dFRpY2soKCkgPT4gdGhpcy4jc2VydmUoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGhvc3RuYW1lID0gb3B0aW9ucy5ob3N0ID8/IFwiXCI7XG4gICAgICB0aGlzLiNsaXN0ZW5lciA9IERlbm8ubGlzdGVuKHsgcG9ydCwgaG9zdG5hbWUgfSk7XG4gICAgICBuZXh0VGljaygoKSA9PiB0aGlzLiNsaXN0ZW5Mb29wKCkpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgYXN5bmMgI2xpc3Rlbkxvb3AoKSB7XG4gICAgY29uc3QgZ28gPSBhc3luYyAoaHR0cENvbm46IERlbm8uSHR0cENvbm4pID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGZvciAoOzspIHtcbiAgICAgICAgICBsZXQgcmVxRXZlbnQgPSBudWxsO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiBodHRwQ29ubi5uZXh0UmVxdWVzdCgpIGNhbGxzIGh0dHBDb25uLmNsb3NlKCkgb24gZXJyb3IuXG4gICAgICAgICAgICByZXFFdmVudCA9IGF3YWl0IGh0dHBDb25uLm5leHRSZXF1ZXN0KCk7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBDb25uZWN0aW9uIGNsb3NlZC5cbiAgICAgICAgICAgIC8vIFRPRE8oYm5vb3JkaHVpcykgRW1pdCBcImNsaWVudEVycm9yXCIgZXZlbnQgb24gdGhlIGh0dHAuU2VydmVyXG4gICAgICAgICAgICAvLyBpbnN0YW5jZT8gTm9kZSBlbWl0cyBpdCB3aGVuIHJlcXVlc3QgcGFyc2luZyBmYWlscyBhbmQgZXhwZWN0c1xuICAgICAgICAgICAgLy8gdGhlIGxpc3RlbmVyIHRvIHNlbmQgYSByYXcgNHh4IEhUVFAgcmVzcG9uc2Ugb24gdGhlIHVuZGVybHlpbmdcbiAgICAgICAgICAgIC8vIG5ldC5Tb2NrZXQgYnV0IHdlIGRvbid0IGhhdmUgb25lIHRvIHBhc3MgdG8gdGhlIGxpc3RlbmVyLlxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVxRXZlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCByZXEgPSBuZXcgSW5jb21pbmdNZXNzYWdlRm9yU2VydmVyKHJlcUV2ZW50LnJlcXVlc3QpO1xuICAgICAgICAgIGNvbnN0IHJlcyA9IG5ldyBTZXJ2ZXJSZXNwb25zZShyZXFFdmVudCwgdW5kZWZpbmVkKTtcbiAgICAgICAgICB0aGlzLmVtaXQoXCJyZXF1ZXN0XCIsIHJlcSwgcmVzKTtcbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGhpcy4jaHR0cENvbm5lY3Rpb25zLmRlbGV0ZShodHRwQ29ubik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGxpc3RlbmVyID0gdGhpcy4jbGlzdGVuZXI7XG5cbiAgICBpZiAobGlzdGVuZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5lbWl0KFwibGlzdGVuaW5nXCIpO1xuXG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGNvbm4gb2YgbGlzdGVuZXIpIHtcbiAgICAgICAgbGV0IGh0dHBDb25uOiBEZW5vLkh0dHBDb25uO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGh0dHBDb25uID0gRGVuby5zZXJ2ZUh0dHAoY29ubik7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIGNvbnRpbnVlOyAvLy8gQ29ubmVjdGlvbiBjbG9zZWQuXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiNodHRwQ29ubmVjdGlvbnMuYWRkKGh0dHBDb25uKTtcbiAgICAgICAgZ28oaHR0cENvbm4pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gICNzZXJ2ZSgpIHtcbiAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBoYW5kbGVyID0gKHJlcXVlc3Q6IFJlcXVlc3QpID0+IHtcbiAgICAgIGNvbnN0IHJlcSA9IG5ldyBJbmNvbWluZ01lc3NhZ2VGb3JTZXJ2ZXIocmVxdWVzdCk7XG4gICAgICBpZiAocmVxLnVwZ3JhZGUgJiYgdGhpcy5saXN0ZW5lckNvdW50KFwidXBncmFkZVwiKSA+IDApIHtcbiAgICAgICAgY29uc3QgW2Nvbm4sIGhlYWRdID0gRGVub1VwZ3JhZGVIdHRwUmF3KHJlcXVlc3QpIGFzIFtcbiAgICAgICAgICBEZW5vLkNvbm4sXG4gICAgICAgICAgVWludDhBcnJheSxcbiAgICAgICAgXTtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IFNvY2tldCh7XG4gICAgICAgICAgaGFuZGxlOiBuZXcgVENQKGNvbnN0YW50cy5TRVJWRVIsIGNvbm4pLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5lbWl0KFwidXBncmFkZVwiLCByZXEsIHNvY2tldCwgQnVmZmVyLmZyb20oaGVhZCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPFJlc3BvbnNlPigocmVzb2x2ZSk6IHZvaWQgPT4ge1xuICAgICAgICAgIGNvbnN0IHJlcyA9IG5ldyBTZXJ2ZXJSZXNwb25zZSh1bmRlZmluZWQsIHJlc29sdmUpO1xuICAgICAgICAgIHRoaXMuZW1pdChcInJlcXVlc3RcIiwgcmVxLCByZXMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuI2hhc0Nsb3NlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLiNhYyA9IGFjO1xuICAgIERlbm9TZXJ2ZShcbiAgICAgIHtcbiAgICAgICAgaGFuZGxlcjogaGFuZGxlciBhcyBEZW5vLlNlcnZlSGFuZGxlcixcbiAgICAgICAgLi4udGhpcy4jYWRkcixcbiAgICAgICAgc2lnbmFsOiBhYy5zaWduYWwsXG4gICAgICAgIC8vIEB0cy1pZ25vcmUgTWlnaHQgYmUgYW55IHdpdGhvdXQgYC0tdW5zdGFibGVgIGZsYWdcbiAgICAgICAgb25MaXN0ZW46ICh7IHBvcnQgfSkgPT4ge1xuICAgICAgICAgIHRoaXMuI2FkZHIhLnBvcnQgPSBwb3J0O1xuICAgICAgICAgIHRoaXMuZW1pdChcImxpc3RlbmluZ1wiKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgKS50aGVuKCgpID0+IHRoaXMuI3NlcnZlUHJvbWlzZSEucmVzb2x2ZSgpKTtcbiAgfVxuXG4gIHNldFRpbWVvdXQoKSB7XG4gICAgY29uc29sZS5lcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogU2VydmVyLnNldFRpbWVvdXQoKVwiKTtcbiAgfVxuXG4gIGNsb3NlKGNiPzogKGVycj86IEVycm9yKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgY29uc3QgbGlzdGVuaW5nID0gdGhpcy5saXN0ZW5pbmc7XG4gICAgdGhpcy5saXN0ZW5pbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuI2hhc0Nsb3NlZCA9IHRydWU7XG4gICAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAobGlzdGVuaW5nKSB7XG4gICAgICAgIHRoaXMub25jZShcImNsb3NlXCIsIGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub25jZShcImNsb3NlXCIsIGZ1bmN0aW9uIGNsb3NlKCkge1xuICAgICAgICAgIGNiKG5ldyBFUlJfU0VSVkVSX05PVF9SVU5OSU5HKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy4jaXNGbGFzaFNlcnZlcikge1xuICAgICAgaWYgKGxpc3RlbmluZyAmJiB0aGlzLiNhYykge1xuICAgICAgICB0aGlzLiNhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLiNhYyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuI3NlcnZlUHJvbWlzZSEucmVzb2x2ZSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoXCJjbG9zZVwiKSk7XG5cbiAgICAgIGlmIChsaXN0ZW5pbmcpIHtcbiAgICAgICAgdGhpcy4jbGlzdGVuZXIhLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuI2xpc3RlbmVyID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGZvciAoY29uc3QgaHR0cENvbm4gb2YgdGhpcy4jaHR0cENvbm5lY3Rpb25zKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGh0dHBDb25uLmNsb3NlKCk7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBBbHJlYWR5IGNsb3NlZC5cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiNodHRwQ29ubmVjdGlvbnMuY2xlYXIoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGFkZHJlc3MoKSB7XG4gICAgbGV0IGFkZHI7XG4gICAgaWYgKHRoaXMuI2lzRmxhc2hTZXJ2ZXIpIHtcbiAgICAgIGFkZHIgPSB0aGlzLiNhZGRyITtcbiAgICB9IGVsc2Uge1xuICAgICAgYWRkciA9IHRoaXMuI2xpc3RlbmVyIS5hZGRyIGFzIERlbm8uTmV0QWRkcjtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBvcnQ6IGFkZHIucG9ydCxcbiAgICAgIGFkZHJlc3M6IGFkZHIuaG9zdG5hbWUsXG4gICAgfTtcbiAgfVxufVxuXG5TZXJ2ZXIucHJvdG90eXBlID0gU2VydmVySW1wbC5wcm90b3R5cGU7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXIoaGFuZGxlcj86IFNlcnZlckhhbmRsZXIpIHtcbiAgcmV0dXJuIFNlcnZlcihoYW5kbGVyKTtcbn1cblxuLyoqIE1ha2VzIGFuIEhUVFAgcmVxdWVzdC4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0KFxuICB1cmw6IHN0cmluZyB8IFVSTCxcbiAgY2I/OiAocmVzOiBJbmNvbWluZ01lc3NhZ2VGb3JDbGllbnQpID0+IHZvaWQsXG4pOiBDbGllbnRSZXF1ZXN0O1xuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3QoXG4gIG9wdHM6IFJlcXVlc3RPcHRpb25zLFxuICBjYj86IChyZXM6IEluY29taW5nTWVzc2FnZUZvckNsaWVudCkgPT4gdm9pZCxcbik6IENsaWVudFJlcXVlc3Q7XG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdChcbiAgdXJsOiBzdHJpbmcgfCBVUkwsXG4gIG9wdHM6IFJlcXVlc3RPcHRpb25zLFxuICBjYj86IChyZXM6IEluY29taW5nTWVzc2FnZUZvckNsaWVudCkgPT4gdm9pZCxcbik6IENsaWVudFJlcXVlc3Q7XG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3QoLi4uYXJnczogYW55W10pIHtcbiAgbGV0IG9wdGlvbnMgPSB7fTtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgb3B0aW9ucyA9IHVybFRvSHR0cE9wdGlvbnMobmV3IFVSTChhcmdzLnNoaWZ0KCkpKTtcbiAgfSBlbHNlIGlmIChhcmdzWzBdIGluc3RhbmNlb2YgVVJMKSB7XG4gICAgb3B0aW9ucyA9IHVybFRvSHR0cE9wdGlvbnMoYXJncy5zaGlmdCgpKTtcbiAgfVxuICBpZiAoYXJnc1swXSAmJiB0eXBlb2YgYXJnc1swXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgT2JqZWN0LmFzc2lnbihvcHRpb25zLCBhcmdzLnNoaWZ0KCkpO1xuICB9XG4gIGFyZ3MudW5zaGlmdChvcHRpb25zKTtcbiAgcmV0dXJuIG5ldyBDbGllbnRSZXF1ZXN0KGFyZ3NbMF0sIGFyZ3NbMV0pO1xufVxuXG4vKiogTWFrZXMgYSBgR0VUYCBIVFRQIHJlcXVlc3QuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0KFxuICB1cmw6IHN0cmluZyB8IFVSTCxcbiAgY2I/OiAocmVzOiBJbmNvbWluZ01lc3NhZ2VGb3JDbGllbnQpID0+IHZvaWQsXG4pOiBDbGllbnRSZXF1ZXN0O1xuZXhwb3J0IGZ1bmN0aW9uIGdldChcbiAgb3B0czogUmVxdWVzdE9wdGlvbnMsXG4gIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlRm9yQ2xpZW50KSA9PiB2b2lkLFxuKTogQ2xpZW50UmVxdWVzdDtcbmV4cG9ydCBmdW5jdGlvbiBnZXQoXG4gIHVybDogc3RyaW5nIHwgVVJMLFxuICBvcHRzOiBSZXF1ZXN0T3B0aW9ucyxcbiAgY2I/OiAocmVzOiBJbmNvbWluZ01lc3NhZ2VGb3JDbGllbnQpID0+IHZvaWQsXG4pOiBDbGllbnRSZXF1ZXN0O1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBnZXQoLi4uYXJnczogYW55W10pIHtcbiAgY29uc3QgcmVxID0gcmVxdWVzdChhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgcmVxLmVuZCgpO1xuICByZXR1cm4gcmVxO1xufVxuXG5leHBvcnQge1xuICBBZ2VudCxcbiAgQ2xpZW50UmVxdWVzdCxcbiAgSW5jb21pbmdNZXNzYWdlRm9yU2VydmVyIGFzIEluY29taW5nTWVzc2FnZSxcbiAgTUVUSE9EUyxcbiAgT3V0Z29pbmdNZXNzYWdlLFxuICBTVEFUVVNfQ09ERVMsXG59O1xuZXhwb3J0IGRlZmF1bHQge1xuICBBZ2VudCxcbiAgQ2xpZW50UmVxdWVzdCxcbiAgU1RBVFVTX0NPREVTLFxuICBNRVRIT0RTLFxuICBjcmVhdGVTZXJ2ZXIsXG4gIFNlcnZlcixcbiAgSW5jb21pbmdNZXNzYWdlOiBJbmNvbWluZ01lc3NhZ2VGb3JTZXJ2ZXIsXG4gIEluY29taW5nTWVzc2FnZUZvckNsaWVudCxcbiAgSW5jb21pbmdNZXNzYWdlRm9yU2VydmVyLFxuICBPdXRnb2luZ01lc3NhZ2UsXG4gIFNlcnZlclJlc3BvbnNlLFxuICByZXF1ZXN0LFxuICBnZXQsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxTQUF3QixRQUFRLFFBQVEsdUJBQXVCO0FBQy9ELFNBQVMsY0FBYyxFQUFpQixNQUFNLFFBQVEsV0FBVztBQUNqRSxTQUFTLE1BQU0sUUFBUSxjQUFjO0FBQ3JDLFNBQVMsc0JBQXNCLFFBQVEsdUJBQXVCO0FBQzlELFNBQVMsWUFBWSxRQUFRLGNBQWM7QUFDM0MsU0FBUyxRQUFRLFFBQVEsa0JBQWtCO0FBQzNDLFNBQVMsVUFBVSxZQUFZLFFBQVEseUJBQXlCO0FBQ2hFLFNBQVMsWUFBWSxRQUFRLDRCQUE0QjtBQUN6RCxTQUNFLFlBQVksWUFBWSxFQUN4QixZQUFZLFlBQVksUUFDbkIsY0FBYztBQUNyQixTQUFTLGVBQWUsUUFBUSxzQkFBc0I7QUFDdEQsU0FBUyxLQUFLLFFBQVEsb0JBQW9CO0FBQzFDLFNBQVMsbUJBQW1CLGFBQWEsUUFB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