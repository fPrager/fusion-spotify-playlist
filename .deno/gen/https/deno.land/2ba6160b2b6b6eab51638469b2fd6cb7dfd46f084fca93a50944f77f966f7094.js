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
import { ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_FILE_URL_HOST, ERR_INVALID_FILE_URL_PATH, ERR_INVALID_URL, ERR_INVALID_URL_SCHEME } from "./internal/errors.ts";
import { validateString } from "./internal/validators.mjs";
import { CHAR_0, CHAR_9, CHAR_AT, CHAR_BACKWARD_SLASH, CHAR_CARRIAGE_RETURN, CHAR_CIRCUMFLEX_ACCENT, CHAR_DOT, CHAR_DOUBLE_QUOTE, CHAR_FORM_FEED, CHAR_FORWARD_SLASH, CHAR_GRAVE_ACCENT, CHAR_HASH, CHAR_HYPHEN_MINUS, CHAR_LEFT_ANGLE_BRACKET, CHAR_LEFT_CURLY_BRACKET, CHAR_LEFT_SQUARE_BRACKET, CHAR_LINE_FEED, CHAR_LOWERCASE_A, CHAR_LOWERCASE_Z, CHAR_NO_BREAK_SPACE, CHAR_PERCENT, CHAR_PLUS, CHAR_QUESTION_MARK, CHAR_RIGHT_ANGLE_BRACKET, CHAR_RIGHT_CURLY_BRACKET, CHAR_RIGHT_SQUARE_BRACKET, CHAR_SEMICOLON, CHAR_SINGLE_QUOTE, CHAR_SPACE, CHAR_TAB, CHAR_UNDERSCORE, CHAR_UPPERCASE_A, CHAR_UPPERCASE_Z, CHAR_VERTICAL_LINE, CHAR_ZERO_WIDTH_NOBREAK_SPACE } from "../path/_constants.ts";
import * as path from "./path.ts";
import { toASCII } from "./internal/idna.ts";
import { isWindows, osType } from "../_util/os.ts";
import { encodeStr, hexTable } from "./internal/querystring.ts";
import querystring from "./querystring.ts";
const forwardSlashRegEx = /\//g;
const percentRegEx = /%/g;
const backslashRegEx = /\\/g;
const newlineRegEx = /\n/g;
const carriageReturnRegEx = /\r/g;
const tabRegEx = /\t/g;
// Reference: RFC 3986, RFC 1808, RFC 2396
// define these here so at least they only have to be
// compiled once on the first module load.
const protocolPattern = /^[a-z0-9.+-]+:/i;
const portPattern = /:[0-9]*$/;
const hostPattern = /^\/\/[^@/]+@[^@/]+/;
// Special case for a simple path URL
const simplePathPattern = /^(\/\/?(?!\/)[^?\s]*)(\?[^\s]*)?$/;
// Protocols that can allow "unsafe" and "unwise" chars.
const unsafeProtocol = new Set([
    "javascript",
    "javascript:"
]);
// Protocols that never have a hostname.
const hostlessProtocol = new Set([
    "javascript",
    "javascript:"
]);
// Protocols that always contain a // bit.
const slashedProtocol = new Set([
    "http",
    "http:",
    "https",
    "https:",
    "ftp",
    "ftp:",
    "gopher",
    "gopher:",
    "file",
    "file:",
    "ws",
    "ws:",
    "wss",
    "wss:"
]);
const hostnameMaxLen = 255;
// These characters do not need escaping:
// ! - . _ ~
// ' ( ) * :
// digits
// alpha (uppercase)
// alpha (lowercase)
// deno-fmt-ignore
const noEscapeAuth = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    0
]);
// This prevents some common spoofing bugs due to our use of IDNA toASCII. For
// compatibility, the set of characters we use here is the *intersection* of
// "forbidden host code point" in the WHATWG URL Standard [1] and the
// characters in the host parsing loop in Url.prototype.parse, with the
// following additions:
//
// - ':' since this could cause a "protocol spoofing" bug
// - '@' since this could cause parts of the hostname to be confused with auth
// - '[' and ']' since this could cause a non-IPv6 hostname to be interpreted
//   as IPv6 by isIpv6Hostname above
//
// [1]: https://url.spec.whatwg.org/#forbidden-host-code-point
const forbiddenHostChars = /[\0\t\n\r #%/:<>?@[\\\]^|]/;
// For IPv6, permit '[', ']', and ':'.
const forbiddenHostCharsIpv6 = /[\0\t\n\r #%/<>?@\\^|]/;
const _url = URL;
export { _url as URL };
// Legacy URL API
export class Url {
    protocol;
    slashes;
    auth;
    host;
    port;
    hostname;
    hash;
    search;
    query;
    pathname;
    path;
    href;
    constructor(){
        this.protocol = null;
        this.slashes = null;
        this.auth = null;
        this.host = null;
        this.port = null;
        this.hostname = null;
        this.hash = null;
        this.search = null;
        this.query = null;
        this.pathname = null;
        this.path = null;
        this.href = null;
    }
    #parseHost() {
        let host = this.host || "";
        let port = portPattern.exec(host);
        if (port) {
            port = port[0];
            if (port !== ":") {
                this.port = port.slice(1);
            }
            host = host.slice(0, host.length - port.length);
        }
        if (host) this.hostname = host;
    }
    resolve(relative) {
        return this.resolveObject(parse(relative, false, true)).format();
    }
    resolveObject(relative) {
        if (typeof relative === "string") {
            const rel = new Url();
            rel.urlParse(relative, false, true);
            relative = rel;
        }
        const result = new Url();
        const tkeys = Object.keys(this);
        for(let tk = 0; tk < tkeys.length; tk++){
            const tkey = tkeys[tk];
            result[tkey] = this[tkey];
        }
        // Hash is always overridden, no matter what.
        // even href="" will remove it.
        result.hash = relative.hash;
        // If the relative url is empty, then there's nothing left to do here.
        if (relative.href === "") {
            result.href = result.format();
            return result;
        }
        // Hrefs like //foo/bar always cut to the protocol.
        if (relative.slashes && !relative.protocol) {
            // Take everything except the protocol from relative
            const rkeys = Object.keys(relative);
            for(let rk = 0; rk < rkeys.length; rk++){
                const rkey = rkeys[rk];
                if (rkey !== "protocol") result[rkey] = relative[rkey];
            }
            // urlParse appends trailing / to urls like http://www.example.com
            if (result.protocol && slashedProtocol.has(result.protocol) && result.hostname && !result.pathname) {
                result.path = result.pathname = "/";
            }
            result.href = result.format();
            return result;
        }
        if (relative.protocol && relative.protocol !== result.protocol) {
            // If it's a known url protocol, then changing
            // the protocol does weird things
            // first, if it's not file:, then we MUST have a host,
            // and if there was a path
            // to begin with, then we MUST have a path.
            // if it is file:, then the host is dropped,
            // because that's known to be hostless.
            // anything else is assumed to be absolute.
            if (!slashedProtocol.has(relative.protocol)) {
                const keys = Object.keys(relative);
                for(let v = 0; v < keys.length; v++){
                    const k = keys[v];
                    result[k] = relative[k];
                }
                result.href = result.format();
                return result;
            }
            result.protocol = relative.protocol;
            if (!relative.host && !/^file:?$/.test(relative.protocol) && !hostlessProtocol.has(relative.protocol)) {
                const relPath = (relative.pathname || "").split("/");
                while(relPath.length && !(relative.host = relPath.shift() || null));
                if (!relative.host) relative.host = "";
                if (!relative.hostname) relative.hostname = "";
                if (relPath[0] !== "") relPath.unshift("");
                if (relPath.length < 2) relPath.unshift("");
                result.pathname = relPath.join("/");
            } else {
                result.pathname = relative.pathname;
            }
            result.search = relative.search;
            result.query = relative.query;
            result.host = relative.host || "";
            result.auth = relative.auth;
            result.hostname = relative.hostname || relative.host;
            result.port = relative.port;
            // To support http.request
            if (result.pathname || result.search) {
                const p = result.pathname || "";
                const s = result.search || "";
                result.path = p + s;
            }
            result.slashes = result.slashes || relative.slashes;
            result.href = result.format();
            return result;
        }
        const isSourceAbs = result.pathname && result.pathname.charAt(0) === "/";
        const isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === "/";
        let mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname;
        const removeAllDots = mustEndAbs;
        let srcPath = result.pathname && result.pathname.split("/") || [];
        const relPath1 = relative.pathname && relative.pathname.split("/") || [];
        const noLeadingSlashes = result.protocol && !slashedProtocol.has(result.protocol);
        // If the url is a non-slashed url, then relative
        // links like ../.. should be able
        // to crawl up to the hostname, as well.  This is strange.
        // result.protocol has already been set by now.
        // Later on, put the first path part into the host field.
        if (noLeadingSlashes) {
            result.hostname = "";
            result.port = null;
            if (result.host) {
                if (srcPath[0] === "") srcPath[0] = result.host;
                else srcPath.unshift(result.host);
            }
            result.host = "";
            if (relative.protocol) {
                relative.hostname = null;
                relative.port = null;
                result.auth = null;
                if (relative.host) {
                    if (relPath1[0] === "") relPath1[0] = relative.host;
                    else relPath1.unshift(relative.host);
                }
                relative.host = null;
            }
            mustEndAbs = mustEndAbs && (relPath1[0] === "" || srcPath[0] === "");
        }
        if (isRelAbs) {
            // it's absolute.
            if (relative.host || relative.host === "") {
                if (result.host !== relative.host) result.auth = null;
                result.host = relative.host;
                result.port = relative.port;
            }
            if (relative.hostname || relative.hostname === "") {
                if (result.hostname !== relative.hostname) result.auth = null;
                result.hostname = relative.hostname;
            }
            result.search = relative.search;
            result.query = relative.query;
            srcPath = relPath1;
        // Fall through to the dot-handling below.
        } else if (relPath1.length) {
            // it's relative
            // throw away the existing file, and take the new path instead.
            if (!srcPath) srcPath = [];
            srcPath.pop();
            srcPath = srcPath.concat(relPath1);
            result.search = relative.search;
            result.query = relative.query;
        } else if (relative.search !== null && relative.search !== undefined) {
            // Just pull out the search.
            // like href='?foo'.
            // Put this after the other two cases because it simplifies the booleans
            if (noLeadingSlashes) {
                result.hostname = result.host = srcPath.shift() || null;
                // Occasionally the auth can get stuck only in host.
                // This especially happens in cases like
                // url.resolveObject('mailto:local1@domain1', 'local2@domain2')
                const authInHost = result.host && result.host.indexOf("@") > 0 && result.host.split("@");
                if (authInHost) {
                    result.auth = authInHost.shift() || null;
                    result.host = result.hostname = authInHost.shift() || null;
                }
            }
            result.search = relative.search;
            result.query = relative.query;
            // To support http.request
            if (result.pathname !== null || result.search !== null) {
                result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
            }
            result.href = result.format();
            return result;
        }
        if (!srcPath.length) {
            // No path at all. All other things were already handled above.
            result.pathname = null;
            // To support http.request
            if (result.search) {
                result.path = "/" + result.search;
            } else {
                result.path = null;
            }
            result.href = result.format();
            return result;
        }
        // If a url ENDs in . or .., then it must get a trailing slash.
        // however, if it ends in anything else non-slashy,
        // then it must NOT get a trailing slash.
        let last = srcPath.slice(-1)[0];
        const hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === "." || last === "..") || last === "";
        // Strip single dots, resolve double dots to parent dir
        // if the path tries to go above the root, `up` ends up > 0
        let up = 0;
        for(let i = srcPath.length - 1; i >= 0; i--){
            last = srcPath[i];
            if (last === ".") {
                srcPath.splice(i, 1);
            } else if (last === "..") {
                srcPath.splice(i, 1);
                up++;
            } else if (up) {
                srcPath.splice(i, 1);
                up--;
            }
        }
        // If the path is allowed to go above the root, restore leading ..s
        if (!mustEndAbs && !removeAllDots) {
            while(up--){
                srcPath.unshift("..");
            }
        }
        if (mustEndAbs && srcPath[0] !== "" && (!srcPath[0] || srcPath[0].charAt(0) !== "/")) {
            srcPath.unshift("");
        }
        if (hasTrailingSlash && srcPath.join("/").substr(-1) !== "/") {
            srcPath.push("");
        }
        const isAbsolute = srcPath[0] === "" || srcPath[0] && srcPath[0].charAt(0) === "/";
        // put the host back
        if (noLeadingSlashes) {
            result.hostname = result.host = isAbsolute ? "" : srcPath.length ? srcPath.shift() || null : "";
            // Occasionally the auth can get stuck only in host.
            // This especially happens in cases like
            // url.resolveObject('mailto:local1@domain1', 'local2@domain2')
            const authInHost1 = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
            if (authInHost1) {
                result.auth = authInHost1.shift() || null;
                result.host = result.hostname = authInHost1.shift() || null;
            }
        }
        mustEndAbs = mustEndAbs || result.host && srcPath.length;
        if (mustEndAbs && !isAbsolute) {
            srcPath.unshift("");
        }
        if (!srcPath.length) {
            result.pathname = null;
            result.path = null;
        } else {
            result.pathname = srcPath.join("/");
        }
        // To support request.http
        if (result.pathname !== null || result.search !== null) {
            result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
        }
        result.auth = relative.auth || result.auth;
        result.slashes = result.slashes || relative.slashes;
        result.href = result.format();
        return result;
    }
    format() {
        let auth = this.auth || "";
        if (auth) {
            auth = encodeStr(auth, noEscapeAuth, hexTable);
            auth += "@";
        }
        let protocol = this.protocol || "";
        let pathname = this.pathname || "";
        let hash = this.hash || "";
        let host = "";
        let query = "";
        if (this.host) {
            host = auth + this.host;
        } else if (this.hostname) {
            host = auth + (this.hostname.includes(":") && !isIpv6Hostname(this.hostname) ? "[" + this.hostname + "]" : this.hostname);
            if (this.port) {
                host += ":" + this.port;
            }
        }
        if (this.query !== null && typeof this.query === "object") {
            query = querystring.stringify(this.query);
        }
        let search = this.search || query && "?" + query || "";
        if (protocol && protocol.charCodeAt(protocol.length - 1) !== 58 /* : */ ) {
            protocol += ":";
        }
        let newPathname = "";
        let lastPos = 0;
        for(let i = 0; i < pathname.length; ++i){
            switch(pathname.charCodeAt(i)){
                case CHAR_HASH:
                    if (i - lastPos > 0) {
                        newPathname += pathname.slice(lastPos, i);
                    }
                    newPathname += "%23";
                    lastPos = i + 1;
                    break;
                case CHAR_QUESTION_MARK:
                    if (i - lastPos > 0) {
                        newPathname += pathname.slice(lastPos, i);
                    }
                    newPathname += "%3F";
                    lastPos = i + 1;
                    break;
            }
        }
        if (lastPos > 0) {
            if (lastPos !== pathname.length) {
                pathname = newPathname + pathname.slice(lastPos);
            } else pathname = newPathname;
        }
        // Only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
        // unless they had them to begin with.
        if (this.slashes || slashedProtocol.has(protocol)) {
            if (this.slashes || host) {
                if (pathname && pathname.charCodeAt(0) !== CHAR_FORWARD_SLASH) {
                    pathname = "/" + pathname;
                }
                host = "//" + host;
            } else if (protocol.length >= 4 && protocol.charCodeAt(0) === 102 /* f */  && protocol.charCodeAt(1) === 105 /* i */  && protocol.charCodeAt(2) === 108 /* l */  && protocol.charCodeAt(3) === 101 /* e */ ) {
                host = "//";
            }
        }
        search = search.replace(/#/g, "%23");
        if (hash && hash.charCodeAt(0) !== CHAR_HASH) {
            hash = "#" + hash;
        }
        if (search && search.charCodeAt(0) !== CHAR_QUESTION_MARK) {
            search = "?" + search;
        }
        return protocol + host + pathname + search + hash;
    }
    urlParse(url, parseQueryString, slashesDenoteHost) {
        validateString(url, "url");
        // Copy chrome, IE, opera backslash-handling behavior.
        // Back slashes before the query string get converted to forward slashes
        // See: https://code.google.com/p/chromium/issues/detail?id=25916
        let hasHash = false;
        let start = -1;
        let end = -1;
        let rest = "";
        let lastPos = 0;
        for(let i = 0, inWs = false, split = false; i < url.length; ++i){
            const code = url.charCodeAt(i);
            // Find first and last non-whitespace characters for trimming
            const isWs = code === CHAR_SPACE || code === CHAR_TAB || code === CHAR_CARRIAGE_RETURN || code === CHAR_LINE_FEED || code === CHAR_FORM_FEED || code === CHAR_NO_BREAK_SPACE || code === CHAR_ZERO_WIDTH_NOBREAK_SPACE;
            if (start === -1) {
                if (isWs) continue;
                lastPos = start = i;
            } else if (inWs) {
                if (!isWs) {
                    end = -1;
                    inWs = false;
                }
            } else if (isWs) {
                end = i;
                inWs = true;
            }
            // Only convert backslashes while we haven't seen a split character
            if (!split) {
                switch(code){
                    case CHAR_HASH:
                        hasHash = true;
                    // Fall through
                    case CHAR_QUESTION_MARK:
                        split = true;
                        break;
                    case CHAR_BACKWARD_SLASH:
                        if (i - lastPos > 0) rest += url.slice(lastPos, i);
                        rest += "/";
                        lastPos = i + 1;
                        break;
                }
            } else if (!hasHash && code === CHAR_HASH) {
                hasHash = true;
            }
        }
        // Check if string was non-empty (including strings with only whitespace)
        if (start !== -1) {
            if (lastPos === start) {
                // We didn't convert any backslashes
                if (end === -1) {
                    if (start === 0) rest = url;
                    else rest = url.slice(start);
                } else {
                    rest = url.slice(start, end);
                }
            } else if (end === -1 && lastPos < url.length) {
                // We converted some backslashes and have only part of the entire string
                rest += url.slice(lastPos);
            } else if (end !== -1 && lastPos < end) {
                // We converted some backslashes and have only part of the entire string
                rest += url.slice(lastPos, end);
            }
        }
        if (!slashesDenoteHost && !hasHash) {
            // Try fast path regexp
            const simplePath = simplePathPattern.exec(rest);
            if (simplePath) {
                this.path = rest;
                this.href = rest;
                this.pathname = simplePath[1];
                if (simplePath[2]) {
                    this.search = simplePath[2];
                    if (parseQueryString) {
                        this.query = querystring.parse(this.search.slice(1));
                    } else {
                        this.query = this.search.slice(1);
                    }
                } else if (parseQueryString) {
                    this.search = null;
                    this.query = Object.create(null);
                }
                return this;
            }
        }
        let proto = protocolPattern.exec(rest);
        let lowerProto = "";
        if (proto) {
            proto = proto[0];
            lowerProto = proto.toLowerCase();
            this.protocol = lowerProto;
            rest = rest.slice(proto.length);
        }
        // Figure out if it's got a host
        // user@server is *always* interpreted as a hostname, and url
        // resolution will treat //foo/bar as host=foo,path=bar because that's
        // how the browser resolves relative URLs.
        let slashes;
        if (slashesDenoteHost || proto || hostPattern.test(rest)) {
            slashes = rest.charCodeAt(0) === CHAR_FORWARD_SLASH && rest.charCodeAt(1) === CHAR_FORWARD_SLASH;
            if (slashes && !(proto && hostlessProtocol.has(lowerProto))) {
                rest = rest.slice(2);
                this.slashes = true;
            }
        }
        if (!hostlessProtocol.has(lowerProto) && (slashes || proto && !slashedProtocol.has(proto))) {
            // there's a hostname.
            // the first instance of /, ?, ;, or # ends the host.
            //
            // If there is an @ in the hostname, then non-host chars *are* allowed
            // to the left of the last @ sign, unless some host-ending character
            // comes *before* the @-sign.
            // URLs are obnoxious.
            //
            // ex:
            // http://a@b@c/ => user:a@b host:c
            // http://a@b?@c => user:a host:b path:/?@c
            let hostEnd = -1;
            let atSign = -1;
            let nonHost = -1;
            for(let i1 = 0; i1 < rest.length; ++i1){
                switch(rest.charCodeAt(i1)){
                    case CHAR_TAB:
                    case CHAR_LINE_FEED:
                    case CHAR_CARRIAGE_RETURN:
                    case CHAR_SPACE:
                    case CHAR_DOUBLE_QUOTE:
                    case CHAR_PERCENT:
                    case CHAR_SINGLE_QUOTE:
                    case CHAR_SEMICOLON:
                    case CHAR_LEFT_ANGLE_BRACKET:
                    case CHAR_RIGHT_ANGLE_BRACKET:
                    case CHAR_BACKWARD_SLASH:
                    case CHAR_CIRCUMFLEX_ACCENT:
                    case CHAR_GRAVE_ACCENT:
                    case CHAR_LEFT_CURLY_BRACKET:
                    case CHAR_VERTICAL_LINE:
                    case CHAR_RIGHT_CURLY_BRACKET:
                        // Characters that are never ever allowed in a hostname from RFC 2396
                        if (nonHost === -1) nonHost = i1;
                        break;
                    case CHAR_HASH:
                    case CHAR_FORWARD_SLASH:
                    case CHAR_QUESTION_MARK:
                        // Find the first instance of any host-ending characters
                        if (nonHost === -1) nonHost = i1;
                        hostEnd = i1;
                        break;
                    case CHAR_AT:
                        // At this point, either we have an explicit point where the
                        // auth portion cannot go past, or the last @ char is the decider.
                        atSign = i1;
                        nonHost = -1;
                        break;
                }
                if (hostEnd !== -1) break;
            }
            start = 0;
            if (atSign !== -1) {
                this.auth = decodeURIComponent(rest.slice(0, atSign));
                start = atSign + 1;
            }
            if (nonHost === -1) {
                this.host = rest.slice(start);
                rest = "";
            } else {
                this.host = rest.slice(start, nonHost);
                rest = rest.slice(nonHost);
            }
            // pull out port.
            this.#parseHost();
            // We've indicated that there is a hostname,
            // so even if it's empty, it has to be present.
            if (typeof this.hostname !== "string") this.hostname = "";
            const hostname = this.hostname;
            // If hostname begins with [ and ends with ]
            // assume that it's an IPv6 address.
            const ipv6Hostname = isIpv6Hostname(hostname);
            // validate a little.
            if (!ipv6Hostname) {
                rest = getHostname(this, rest, hostname);
            }
            if (this.hostname.length > hostnameMaxLen) {
                this.hostname = "";
            } else {
                // Hostnames are always lower case.
                this.hostname = this.hostname.toLowerCase();
            }
            if (this.hostname !== "") {
                if (ipv6Hostname) {
                    if (forbiddenHostCharsIpv6.test(this.hostname)) {
                        throw new ERR_INVALID_URL(url);
                    }
                } else {
                    // IDNA Support: Returns a punycoded representation of "domain".
                    // It only converts parts of the domain name that
                    // have non-ASCII characters, i.e. it doesn't matter if
                    // you call it with a domain that already is ASCII-only.
                    // Use lenient mode (`true`) to try to support even non-compliant
                    // URLs.
                    this.hostname = toASCII(this.hostname);
                    // Prevent two potential routes of hostname spoofing.
                    // 1. If this.hostname is empty, it must have become empty due to toASCII
                    //    since we checked this.hostname above.
                    // 2. If any of forbiddenHostChars appears in this.hostname, it must have
                    //    also gotten in due to toASCII. This is since getHostname would have
                    //    filtered them out otherwise.
                    // Rather than trying to correct this by moving the non-host part into
                    // the pathname as we've done in getHostname, throw an exception to
                    // convey the severity of this issue.
                    if (this.hostname === "" || forbiddenHostChars.test(this.hostname)) {
                        throw new ERR_INVALID_URL(url);
                    }
                }
            }
            const p = this.port ? ":" + this.port : "";
            const h = this.hostname || "";
            this.host = h + p;
            // strip [ and ] from the hostname
            // the host field still retains them, though
            if (ipv6Hostname) {
                this.hostname = this.hostname.slice(1, -1);
                if (rest[0] !== "/") {
                    rest = "/" + rest;
                }
            }
        }
        // Now rest is set to the post-host stuff.
        // Chop off any delim chars.
        if (!unsafeProtocol.has(lowerProto)) {
            // First, make 100% sure that any "autoEscape" chars get
            // escaped, even if encodeURIComponent doesn't think they
            // need to be.
            rest = autoEscapeStr(rest);
        }
        let questionIdx = -1;
        let hashIdx = -1;
        for(let i2 = 0; i2 < rest.length; ++i2){
            const code1 = rest.charCodeAt(i2);
            if (code1 === CHAR_HASH) {
                this.hash = rest.slice(i2);
                hashIdx = i2;
                break;
            } else if (code1 === CHAR_QUESTION_MARK && questionIdx === -1) {
                questionIdx = i2;
            }
        }
        if (questionIdx !== -1) {
            if (hashIdx === -1) {
                this.search = rest.slice(questionIdx);
                this.query = rest.slice(questionIdx + 1);
            } else {
                this.search = rest.slice(questionIdx, hashIdx);
                this.query = rest.slice(questionIdx + 1, hashIdx);
            }
            if (parseQueryString) {
                this.query = querystring.parse(this.query);
            }
        } else if (parseQueryString) {
            // No query string, but parseQueryString still requested
            this.search = null;
            this.query = Object.create(null);
        }
        const useQuestionIdx = questionIdx !== -1 && (hashIdx === -1 || questionIdx < hashIdx);
        const firstIdx = useQuestionIdx ? questionIdx : hashIdx;
        if (firstIdx === -1) {
            if (rest.length > 0) this.pathname = rest;
        } else if (firstIdx > 0) {
            this.pathname = rest.slice(0, firstIdx);
        }
        if (slashedProtocol.has(lowerProto) && this.hostname && !this.pathname) {
            this.pathname = "/";
        }
        // To support http.request
        if (this.pathname || this.search) {
            const p1 = this.pathname || "";
            const s = this.search || "";
            this.path = p1 + s;
        }
        // Finally, reconstruct the href based on what has been validated.
        this.href = this.format();
        return this;
    }
}
export function format(urlObject, options) {
    if (typeof urlObject === "string") {
        urlObject = parse(urlObject, true, false);
    } else if (typeof urlObject !== "object" || urlObject === null) {
        throw new ERR_INVALID_ARG_TYPE("urlObject", [
            "Object",
            "string"
        ], urlObject);
    } else if (!(urlObject instanceof Url)) {
        if (urlObject instanceof URL) {
            return formatWhatwg(urlObject, options);
        }
        return Url.prototype.format.call(urlObject);
    }
    return urlObject.format();
}
/**
 * The URL object has both a `toString()` method and `href` property that return string serializations of the URL.
 * These are not, however, customizable in any way.
 * This method allows for basic customization of the output.
 * @see Tested in `parallel/test-url-format-whatwg.js`.
 * @param urlObject
 * @param options
 * @param options.auth `true` if the serialized URL string should include the username and password, `false` otherwise. **Default**: `true`.
 * @param options.fragment `true` if the serialized URL string should include the fragment, `false` otherwise. **Default**: `true`.
 * @param options.search `true` if the serialized URL string should include the search query, **Default**: `true`.
 * @param options.unicode `true` if Unicode characters appearing in the host component of the URL string should be encoded directly as opposed to being Punycode encoded. **Default**: `false`.
 * @returns a customizable serialization of a URL `String` representation of a `WHATWG URL` object.
 */ function formatWhatwg(urlObject, options) {
    if (typeof urlObject === "string") {
        urlObject = new URL(urlObject);
    }
    if (options) {
        if (typeof options !== "object") {
            throw new ERR_INVALID_ARG_TYPE("options", "object", options);
        }
    }
    options = {
        auth: true,
        fragment: true,
        search: true,
        unicode: false,
        ...options
    };
    let ret = urlObject.protocol;
    if (urlObject.host !== null) {
        ret += "//";
        const hasUsername = !!urlObject.username;
        const hasPassword = !!urlObject.password;
        if (options.auth && (hasUsername || hasPassword)) {
            if (hasUsername) {
                ret += urlObject.username;
            }
            if (hasPassword) {
                ret += `:${urlObject.password}`;
            }
            ret += "@";
        }
        // TODO(wafuwfu13): Support unicode option
        // ret += options.unicode ?
        //   domainToUnicode(urlObject.host) : urlObject.host;
        ret += urlObject.host;
        if (urlObject.port) {
            ret += `:${urlObject.port}`;
        }
    }
    ret += urlObject.pathname;
    if (options.search && urlObject.search) {
        ret += urlObject.search;
    }
    if (options.fragment && urlObject.hash) {
        ret += urlObject.hash;
    }
    return ret;
}
function isIpv6Hostname(hostname) {
    return hostname.charCodeAt(0) === CHAR_LEFT_SQUARE_BRACKET && hostname.charCodeAt(hostname.length - 1) === CHAR_RIGHT_SQUARE_BRACKET;
}
function getHostname(self, rest, hostname) {
    for(let i = 0; i < hostname.length; ++i){
        const code = hostname.charCodeAt(i);
        const isValid = code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code === CHAR_DOT || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z || code >= CHAR_0 && code <= CHAR_9 || code === CHAR_HYPHEN_MINUS || code === CHAR_PLUS || code === CHAR_UNDERSCORE || code > 127;
        // Invalid host character
        if (!isValid) {
            self.hostname = hostname.slice(0, i);
            return `/${hostname.slice(i)}${rest}`;
        }
    }
    return rest;
}
// Escaped characters. Use empty strings to fill up unused entries.
// Using Array is faster than Object/Map
// deno-fmt-ignore
const escapedCodes = [
    /* 0 - 9 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "%09",
    /* 10 - 19 */ "%0A",
    "",
    "",
    "%0D",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 20 - 29 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 30 - 39 */ "",
    "",
    "%20",
    "",
    "%22",
    "",
    "",
    "",
    "",
    "%27",
    /* 40 - 49 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 50 - 59 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 60 - 69 */ "%3C",
    "",
    "%3E",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 70 - 79 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 80 - 89 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 90 - 99 */ "",
    "",
    "%5C",
    "",
    "%5E",
    "",
    "%60",
    "",
    "",
    "",
    /* 100 - 109 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 110 - 119 */ "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    /* 120 - 125 */ "",
    "",
    "",
    "%7B",
    "%7C",
    "%7D"
];
// Automatically escape all delimiters and unwise characters from RFC 2396.
// Also escape single quotes in case of an XSS attack.
// Return the escaped string.
function autoEscapeStr(rest) {
    let escaped = "";
    let lastEscapedPos = 0;
    for(let i = 0; i < rest.length; ++i){
        // `escaped` contains substring up to the last escaped character.
        const escapedChar = escapedCodes[rest.charCodeAt(i)];
        if (escapedChar) {
            // Concat if there are ordinary characters in the middle.
            if (i > lastEscapedPos) {
                escaped += rest.slice(lastEscapedPos, i);
            }
            escaped += escapedChar;
            lastEscapedPos = i + 1;
        }
    }
    if (lastEscapedPos === 0) {
        // Nothing has been escaped.
        return rest;
    }
    // There are ordinary characters at the end.
    if (lastEscapedPos < rest.length) {
        escaped += rest.slice(lastEscapedPos);
    }
    return escaped;
}
/**
 * The url.urlParse() method takes a URL string, parses it, and returns a URL object.
 *
 * @see Tested in `parallel/test-url-parse-format.js`.
 * @param url The URL string to parse.
 * @param parseQueryString If `true`, the query property will always be set to an object returned by the querystring module's parse() method. If false,
 * the query property on the returned URL object will be an unparsed, undecoded string. Default: false.
 * @param slashesDenoteHost If `true`, the first token after the literal string // and preceding the next / will be interpreted as the host
 */ export function parse(url, parseQueryString, slashesDenoteHost) {
    if (url instanceof Url) return url;
    const urlObject = new Url();
    urlObject.urlParse(url, parseQueryString, slashesDenoteHost);
    return urlObject;
}
/** The url.resolve() method resolves a target URL relative to a base URL in a manner similar to that of a Web browser resolving an anchor tag HREF.
 * @see https://nodejs.org/api/url.html#urlresolvefrom-to
 * @legacy
 */ export function resolve(from, to) {
    return parse(from, false, true).resolve(to);
}
export function resolveObject(source, relative) {
    if (!source) return relative;
    return parse(source, false, true).resolveObject(relative);
}
/**
 * This function ensures the correct decodings of percent-encoded characters as well as ensuring a cross-platform valid absolute path string.
 * @see Tested in `parallel/test-fileurltopath.js`.
 * @param path The file URL string or URL object to convert to a path.
 * @returns The fully-resolved platform-specific Node.js file path.
 */ export function fileURLToPath(path) {
    if (typeof path === "string") path = new URL(path);
    else if (!(path instanceof URL)) {
        throw new ERR_INVALID_ARG_TYPE("path", [
            "string",
            "URL"
        ], path);
    }
    if (path.protocol !== "file:") {
        throw new ERR_INVALID_URL_SCHEME("file");
    }
    return isWindows ? getPathFromURLWin(path) : getPathFromURLPosix(path);
}
function getPathFromURLWin(url) {
    const hostname = url.hostname;
    let pathname = url.pathname;
    for(let n = 0; n < pathname.length; n++){
        if (pathname[n] === "%") {
            const third = pathname.codePointAt(n + 2) | 0x20;
            if (pathname[n + 1] === "2" && third === 102 || // 2f 2F /
            pathname[n + 1] === "5" && third === 99 // 5c 5C \
            ) {
                throw new ERR_INVALID_FILE_URL_PATH("must not include encoded \\ or / characters");
            }
        }
    }
    pathname = pathname.replace(forwardSlashRegEx, "\\");
    pathname = decodeURIComponent(pathname);
    if (hostname !== "") {
        // TODO(bartlomieju): add support for punycode encodings
        return `\\\\${hostname}${pathname}`;
    } else {
        // Otherwise, it's a local path that requires a drive letter
        const letter = pathname.codePointAt(1) | 0x20;
        const sep = pathname[2];
        if (letter < CHAR_LOWERCASE_A || letter > CHAR_LOWERCASE_Z || // a..z A..Z
        sep !== ":") {
            throw new ERR_INVALID_FILE_URL_PATH("must be absolute");
        }
        return pathname.slice(1);
    }
}
function getPathFromURLPosix(url) {
    if (url.hostname !== "") {
        throw new ERR_INVALID_FILE_URL_HOST(osType);
    }
    const pathname = url.pathname;
    for(let n = 0; n < pathname.length; n++){
        if (pathname[n] === "%") {
            const third = pathname.codePointAt(n + 2) | 0x20;
            if (pathname[n + 1] === "2" && third === 102) {
                throw new ERR_INVALID_FILE_URL_PATH("must not include encoded / characters");
            }
        }
    }
    return decodeURIComponent(pathname);
}
/**
 *  The following characters are percent-encoded when converting from file path
 *  to URL:
 *  - %: The percent character is the only character not encoded by the
 *       `pathname` setter.
 *  - \: Backslash is encoded on non-windows platforms since it's a valid
 *       character but the `pathname` setters replaces it by a forward slash.
 *  - LF: The newline character is stripped out by the `pathname` setter.
 *        (See whatwg/url#419)
 *  - CR: The carriage return character is also stripped out by the `pathname`
 *        setter.
 *  - TAB: The tab character is also stripped out by the `pathname` setter.
 */ function encodePathChars(filepath) {
    if (filepath.includes("%")) {
        filepath = filepath.replace(percentRegEx, "%25");
    }
    // In posix, backslash is a valid character in paths:
    if (!isWindows && filepath.includes("\\")) {
        filepath = filepath.replace(backslashRegEx, "%5C");
    }
    if (filepath.includes("\n")) {
        filepath = filepath.replace(newlineRegEx, "%0A");
    }
    if (filepath.includes("\r")) {
        filepath = filepath.replace(carriageReturnRegEx, "%0D");
    }
    if (filepath.includes("\t")) {
        filepath = filepath.replace(tabRegEx, "%09");
    }
    return filepath;
}
/**
 * This function ensures that `filepath` is resolved absolutely, and that the URL control characters are correctly encoded when converting into a File URL.
 * @see Tested in `parallel/test-url-pathtofileurl.js`.
 * @param filepath The file path string to convert to a file URL.
 * @returns The file URL object.
 */ export function pathToFileURL(filepath) {
    const outURL = new URL("file://");
    if (isWindows && filepath.startsWith("\\\\")) {
        // UNC path format: \\server\share\resource
        const paths = filepath.split("\\");
        if (paths.length <= 3) {
            throw new ERR_INVALID_ARG_VALUE("filepath", filepath, "Missing UNC resource path");
        }
        const hostname = paths[2];
        if (hostname.length === 0) {
            throw new ERR_INVALID_ARG_VALUE("filepath", filepath, "Empty UNC servername");
        }
        // TODO(wafuwafu13): To be `outURL.hostname = domainToASCII(hostname)` once `domainToASCII` are implemented
        outURL.hostname = hostname;
        outURL.pathname = encodePathChars(paths.slice(3).join("/"));
    } else {
        let resolved = path.resolve(filepath);
        // path.resolve strips trailing slashes so we must add them back
        const filePathLast = filepath.charCodeAt(filepath.length - 1);
        if ((filePathLast === CHAR_FORWARD_SLASH || isWindows && filePathLast === CHAR_BACKWARD_SLASH) && resolved[resolved.length - 1] !== path.sep) {
            resolved += "/";
        }
        outURL.pathname = encodePathChars(resolved);
    }
    return outURL;
}
/**
 * This utility function converts a URL object into an ordinary options object as expected by the `http.request()` and `https.request()` APIs.
 * @see Tested in `parallel/test-url-urltooptions.js`.
 * @param url The `WHATWG URL` object to convert to an options object.
 * @returns HttpOptions
 * @returns HttpOptions.protocol Protocol to use.
 * @returns HttpOptions.hostname A domain name or IP address of the server to issue the request to.
 * @returns HttpOptions.hash The fragment portion of the URL.
 * @returns HttpOptions.search The serialized query portion of the URL.
 * @returns HttpOptions.pathname The path portion of the URL.
 * @returns HttpOptions.path Request path. Should include query string if any. E.G. `'/index.html?page=12'`. An exception is thrown when the request path contains illegal characters. Currently, only spaces are rejected but that may change in the future.
 * @returns HttpOptions.href The serialized URL.
 * @returns HttpOptions.port Port of remote server.
 * @returns HttpOptions.auth Basic authentication i.e. `'user:password'` to compute an Authorization header.
 */ export function urlToHttpOptions(url) {
    const options = {
        protocol: url.protocol,
        hostname: typeof url.hostname === "string" && url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname,
        hash: url.hash,
        search: url.search,
        pathname: url.pathname,
        path: `${url.pathname || ""}${url.search || ""}`,
        href: url.href
    };
    if (url.port !== "") {
        options.port = Number(url.port);
    }
    if (url.username || url.password) {
        options.auth = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    }
    return options;
}
const URLSearchParams_ = URLSearchParams;
export { URLSearchParams_ as URLSearchParams };
export default {
    parse,
    format,
    resolve,
    resolveObject,
    fileURLToPath,
    pathToFileURL,
    urlToHttpOptions,
    Url,
    URL,
    URLSearchParams
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvdXJsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHtcbiAgRVJSX0lOVkFMSURfQVJHX1RZUEUsXG4gIEVSUl9JTlZBTElEX0FSR19WQUxVRSxcbiAgRVJSX0lOVkFMSURfRklMRV9VUkxfSE9TVCxcbiAgRVJSX0lOVkFMSURfRklMRV9VUkxfUEFUSCxcbiAgRVJSX0lOVkFMSURfVVJMLFxuICBFUlJfSU5WQUxJRF9VUkxfU0NIRU1FLFxufSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlU3RyaW5nIH0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7XG4gIENIQVJfMCxcbiAgQ0hBUl85LFxuICBDSEFSX0FULFxuICBDSEFSX0JBQ0tXQVJEX1NMQVNILFxuICBDSEFSX0NBUlJJQUdFX1JFVFVSTixcbiAgQ0hBUl9DSVJDVU1GTEVYX0FDQ0VOVCxcbiAgQ0hBUl9ET1QsXG4gIENIQVJfRE9VQkxFX1FVT1RFLFxuICBDSEFSX0ZPUk1fRkVFRCxcbiAgQ0hBUl9GT1JXQVJEX1NMQVNILFxuICBDSEFSX0dSQVZFX0FDQ0VOVCxcbiAgQ0hBUl9IQVNILFxuICBDSEFSX0hZUEhFTl9NSU5VUyxcbiAgQ0hBUl9MRUZUX0FOR0xFX0JSQUNLRVQsXG4gIENIQVJfTEVGVF9DVVJMWV9CUkFDS0VULFxuICBDSEFSX0xFRlRfU1FVQVJFX0JSQUNLRVQsXG4gIENIQVJfTElORV9GRUVELFxuICBDSEFSX0xPV0VSQ0FTRV9BLFxuICBDSEFSX0xPV0VSQ0FTRV9aLFxuICBDSEFSX05PX0JSRUFLX1NQQUNFLFxuICBDSEFSX1BFUkNFTlQsXG4gIENIQVJfUExVUyxcbiAgQ0hBUl9RVUVTVElPTl9NQVJLLFxuICBDSEFSX1JJR0hUX0FOR0xFX0JSQUNLRVQsXG4gIENIQVJfUklHSFRfQ1VSTFlfQlJBQ0tFVCxcbiAgQ0hBUl9SSUdIVF9TUVVBUkVfQlJBQ0tFVCxcbiAgQ0hBUl9TRU1JQ09MT04sXG4gIENIQVJfU0lOR0xFX1FVT1RFLFxuICBDSEFSX1NQQUNFLFxuICBDSEFSX1RBQixcbiAgQ0hBUl9VTkRFUlNDT1JFLFxuICBDSEFSX1VQUEVSQ0FTRV9BLFxuICBDSEFSX1VQUEVSQ0FTRV9aLFxuICBDSEFSX1ZFUlRJQ0FMX0xJTkUsXG4gIENIQVJfWkVST19XSURUSF9OT0JSRUFLX1NQQUNFLFxufSBmcm9tIFwiLi4vcGF0aC9fY29uc3RhbnRzLnRzXCI7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCIuL3BhdGgudHNcIjtcbmltcG9ydCB7IHRvQVNDSUkgfSBmcm9tIFwiLi9pbnRlcm5hbC9pZG5hLnRzXCI7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIG9zVHlwZSB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgZW5jb2RlU3RyLCBoZXhUYWJsZSB9IGZyb20gXCIuL2ludGVybmFsL3F1ZXJ5c3RyaW5nLnRzXCI7XG5pbXBvcnQgcXVlcnlzdHJpbmcgZnJvbSBcIi4vcXVlcnlzdHJpbmcudHNcIjtcbmltcG9ydCB0eXBlIHsgUGFyc2VkVXJsUXVlcnksIFBhcnNlZFVybFF1ZXJ5SW5wdXQgfSBmcm9tIFwiLi9xdWVyeXN0cmluZy50c1wiO1xuXG5jb25zdCBmb3J3YXJkU2xhc2hSZWdFeCA9IC9cXC8vZztcbmNvbnN0IHBlcmNlbnRSZWdFeCA9IC8lL2c7XG5jb25zdCBiYWNrc2xhc2hSZWdFeCA9IC9cXFxcL2c7XG5jb25zdCBuZXdsaW5lUmVnRXggPSAvXFxuL2c7XG5jb25zdCBjYXJyaWFnZVJldHVyblJlZ0V4ID0gL1xcci9nO1xuY29uc3QgdGFiUmVnRXggPSAvXFx0L2c7XG4vLyBSZWZlcmVuY2U6IFJGQyAzOTg2LCBSRkMgMTgwOCwgUkZDIDIzOTZcblxuLy8gZGVmaW5lIHRoZXNlIGhlcmUgc28gYXQgbGVhc3QgdGhleSBvbmx5IGhhdmUgdG8gYmVcbi8vIGNvbXBpbGVkIG9uY2Ugb24gdGhlIGZpcnN0IG1vZHVsZSBsb2FkLlxuY29uc3QgcHJvdG9jb2xQYXR0ZXJuID0gL15bYS16MC05ListXSs6L2k7XG5jb25zdCBwb3J0UGF0dGVybiA9IC86WzAtOV0qJC87XG5jb25zdCBob3N0UGF0dGVybiA9IC9eXFwvXFwvW15AL10rQFteQC9dKy87XG4vLyBTcGVjaWFsIGNhc2UgZm9yIGEgc2ltcGxlIHBhdGggVVJMXG5jb25zdCBzaW1wbGVQYXRoUGF0dGVybiA9IC9eKFxcL1xcLz8oPyFcXC8pW14/XFxzXSopKFxcP1teXFxzXSopPyQvO1xuLy8gUHJvdG9jb2xzIHRoYXQgY2FuIGFsbG93IFwidW5zYWZlXCIgYW5kIFwidW53aXNlXCIgY2hhcnMuXG5jb25zdCB1bnNhZmVQcm90b2NvbCA9IG5ldyBTZXQoW1wiamF2YXNjcmlwdFwiLCBcImphdmFzY3JpcHQ6XCJdKTtcbi8vIFByb3RvY29scyB0aGF0IG5ldmVyIGhhdmUgYSBob3N0bmFtZS5cbmNvbnN0IGhvc3RsZXNzUHJvdG9jb2wgPSBuZXcgU2V0KFtcImphdmFzY3JpcHRcIiwgXCJqYXZhc2NyaXB0OlwiXSk7XG4vLyBQcm90b2NvbHMgdGhhdCBhbHdheXMgY29udGFpbiBhIC8vIGJpdC5cbmNvbnN0IHNsYXNoZWRQcm90b2NvbCA9IG5ldyBTZXQoW1xuICBcImh0dHBcIixcbiAgXCJodHRwOlwiLFxuICBcImh0dHBzXCIsXG4gIFwiaHR0cHM6XCIsXG4gIFwiZnRwXCIsXG4gIFwiZnRwOlwiLFxuICBcImdvcGhlclwiLFxuICBcImdvcGhlcjpcIixcbiAgXCJmaWxlXCIsXG4gIFwiZmlsZTpcIixcbiAgXCJ3c1wiLFxuICBcIndzOlwiLFxuICBcIndzc1wiLFxuICBcIndzczpcIixcbl0pO1xuXG5jb25zdCBob3N0bmFtZU1heExlbiA9IDI1NTtcblxuLy8gVGhlc2UgY2hhcmFjdGVycyBkbyBub3QgbmVlZCBlc2NhcGluZzpcbi8vICEgLSAuIF8gflxuLy8gJyAoICkgKiA6XG4vLyBkaWdpdHNcbi8vIGFscGhhICh1cHBlcmNhc2UpXG4vLyBhbHBoYSAobG93ZXJjYXNlKVxuLy8gZGVuby1mbXQtaWdub3JlXG5jb25zdCBub0VzY2FwZUF1dGggPSBuZXcgSW50OEFycmF5KFtcbiAgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgLy8gMHgwMCAtIDB4MEZcbiAgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgLy8gMHgxMCAtIDB4MUZcbiAgMCwgMSwgMCwgMCwgMCwgMCwgMCwgMSwgMSwgMSwgMSwgMCwgMCwgMSwgMSwgMCwgLy8gMHgyMCAtIDB4MkZcbiAgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMCwgMCwgLy8gMHgzMCAtIDB4M0ZcbiAgMCwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgLy8gMHg0MCAtIDB4NEZcbiAgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMCwgMSwgLy8gMHg1MCAtIDB4NUZcbiAgMCwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgLy8gMHg2MCAtIDB4NkZcbiAgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMSwgMCwgMCwgMCwgMSwgMCwgIC8vIDB4NzAgLSAweDdGXG5dKTtcblxuLy8gVGhpcyBwcmV2ZW50cyBzb21lIGNvbW1vbiBzcG9vZmluZyBidWdzIGR1ZSB0byBvdXIgdXNlIG9mIElETkEgdG9BU0NJSS4gRm9yXG4vLyBjb21wYXRpYmlsaXR5LCB0aGUgc2V0IG9mIGNoYXJhY3RlcnMgd2UgdXNlIGhlcmUgaXMgdGhlICppbnRlcnNlY3Rpb24qIG9mXG4vLyBcImZvcmJpZGRlbiBob3N0IGNvZGUgcG9pbnRcIiBpbiB0aGUgV0hBVFdHIFVSTCBTdGFuZGFyZCBbMV0gYW5kIHRoZVxuLy8gY2hhcmFjdGVycyBpbiB0aGUgaG9zdCBwYXJzaW5nIGxvb3AgaW4gVXJsLnByb3RvdHlwZS5wYXJzZSwgd2l0aCB0aGVcbi8vIGZvbGxvd2luZyBhZGRpdGlvbnM6XG4vL1xuLy8gLSAnOicgc2luY2UgdGhpcyBjb3VsZCBjYXVzZSBhIFwicHJvdG9jb2wgc3Bvb2ZpbmdcIiBidWdcbi8vIC0gJ0AnIHNpbmNlIHRoaXMgY291bGQgY2F1c2UgcGFydHMgb2YgdGhlIGhvc3RuYW1lIHRvIGJlIGNvbmZ1c2VkIHdpdGggYXV0aFxuLy8gLSAnWycgYW5kICddJyBzaW5jZSB0aGlzIGNvdWxkIGNhdXNlIGEgbm9uLUlQdjYgaG9zdG5hbWUgdG8gYmUgaW50ZXJwcmV0ZWRcbi8vICAgYXMgSVB2NiBieSBpc0lwdjZIb3N0bmFtZSBhYm92ZVxuLy9cbi8vIFsxXTogaHR0cHM6Ly91cmwuc3BlYy53aGF0d2cub3JnLyNmb3JiaWRkZW4taG9zdC1jb2RlLXBvaW50XG5jb25zdCBmb3JiaWRkZW5Ib3N0Q2hhcnMgPSAvW1xcMFxcdFxcblxcciAjJS86PD4/QFtcXFxcXFxdXnxdLztcbi8vIEZvciBJUHY2LCBwZXJtaXQgJ1snLCAnXScsIGFuZCAnOicuXG5jb25zdCBmb3JiaWRkZW5Ib3N0Q2hhcnNJcHY2ID0gL1tcXDBcXHRcXG5cXHIgIyUvPD4/QFxcXFxefF0vO1xuXG5jb25zdCBfdXJsID0gVVJMO1xuZXhwb3J0IHsgX3VybCBhcyBVUkwgfTtcblxuLy8gTGVnYWN5IFVSTCBBUElcbmV4cG9ydCBjbGFzcyBVcmwge1xuICBwdWJsaWMgcHJvdG9jb2w6IHN0cmluZyB8IG51bGw7XG4gIHB1YmxpYyBzbGFzaGVzOiBib29sZWFuIHwgbnVsbDtcbiAgcHVibGljIGF1dGg6IHN0cmluZyB8IG51bGw7XG4gIHB1YmxpYyBob3N0OiBzdHJpbmcgfCBudWxsO1xuICBwdWJsaWMgcG9ydDogc3RyaW5nIHwgbnVsbDtcbiAgcHVibGljIGhvc3RuYW1lOiBzdHJpbmcgfCBudWxsO1xuICBwdWJsaWMgaGFzaDogc3RyaW5nIHwgbnVsbDtcbiAgcHVibGljIHNlYXJjaDogc3RyaW5nIHwgbnVsbDtcbiAgcHVibGljIHF1ZXJ5OiBzdHJpbmcgfCBQYXJzZWRVcmxRdWVyeSB8IG51bGw7XG4gIHB1YmxpYyBwYXRobmFtZTogc3RyaW5nIHwgbnVsbDtcbiAgcHVibGljIHBhdGg6IHN0cmluZyB8IG51bGw7XG4gIHB1YmxpYyBocmVmOiBzdHJpbmcgfCBudWxsO1xuICBba2V5OiBzdHJpbmddOiB1bmtub3duO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucHJvdG9jb2wgPSBudWxsO1xuICAgIHRoaXMuc2xhc2hlcyA9IG51bGw7XG4gICAgdGhpcy5hdXRoID0gbnVsbDtcbiAgICB0aGlzLmhvc3QgPSBudWxsO1xuICAgIHRoaXMucG9ydCA9IG51bGw7XG4gICAgdGhpcy5ob3N0bmFtZSA9IG51bGw7XG4gICAgdGhpcy5oYXNoID0gbnVsbDtcbiAgICB0aGlzLnNlYXJjaCA9IG51bGw7XG4gICAgdGhpcy5xdWVyeSA9IG51bGw7XG4gICAgdGhpcy5wYXRobmFtZSA9IG51bGw7XG4gICAgdGhpcy5wYXRoID0gbnVsbDtcbiAgICB0aGlzLmhyZWYgPSBudWxsO1xuICB9XG5cbiAgI3BhcnNlSG9zdCgpIHtcbiAgICBsZXQgaG9zdCA9IHRoaXMuaG9zdCB8fCBcIlwiO1xuICAgIGxldCBwb3J0OiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsIHwgc3RyaW5nID0gcG9ydFBhdHRlcm4uZXhlYyhob3N0KTtcbiAgICBpZiAocG9ydCkge1xuICAgICAgcG9ydCA9IHBvcnRbMF07XG4gICAgICBpZiAocG9ydCAhPT0gXCI6XCIpIHtcbiAgICAgICAgdGhpcy5wb3J0ID0gcG9ydC5zbGljZSgxKTtcbiAgICAgIH1cbiAgICAgIGhvc3QgPSBob3N0LnNsaWNlKDAsIGhvc3QubGVuZ3RoIC0gcG9ydC5sZW5ndGgpO1xuICAgIH1cbiAgICBpZiAoaG9zdCkgdGhpcy5ob3N0bmFtZSA9IGhvc3Q7XG4gIH1cblxuICBwdWJsaWMgcmVzb2x2ZShyZWxhdGl2ZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMucmVzb2x2ZU9iamVjdChwYXJzZShyZWxhdGl2ZSwgZmFsc2UsIHRydWUpKS5mb3JtYXQoKTtcbiAgfVxuXG4gIHB1YmxpYyByZXNvbHZlT2JqZWN0KHJlbGF0aXZlOiBzdHJpbmcgfCBVcmwpIHtcbiAgICBpZiAodHlwZW9mIHJlbGF0aXZlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCByZWwgPSBuZXcgVXJsKCk7XG4gICAgICByZWwudXJsUGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKTtcbiAgICAgIHJlbGF0aXZlID0gcmVsO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBVcmwoKTtcbiAgICBjb25zdCB0a2V5cyA9IE9iamVjdC5rZXlzKHRoaXMpO1xuICAgIGZvciAobGV0IHRrID0gMDsgdGsgPCB0a2V5cy5sZW5ndGg7IHRrKyspIHtcbiAgICAgIGNvbnN0IHRrZXkgPSB0a2V5c1t0a107XG4gICAgICByZXN1bHRbdGtleV0gPSB0aGlzW3RrZXldO1xuICAgIH1cblxuICAgIC8vIEhhc2ggaXMgYWx3YXlzIG92ZXJyaWRkZW4sIG5vIG1hdHRlciB3aGF0LlxuICAgIC8vIGV2ZW4gaHJlZj1cIlwiIHdpbGwgcmVtb3ZlIGl0LlxuICAgIHJlc3VsdC5oYXNoID0gcmVsYXRpdmUuaGFzaDtcblxuICAgIC8vIElmIHRoZSByZWxhdGl2ZSB1cmwgaXMgZW1wdHksIHRoZW4gdGhlcmUncyBub3RoaW5nIGxlZnQgdG8gZG8gaGVyZS5cbiAgICBpZiAocmVsYXRpdmUuaHJlZiA9PT0gXCJcIikge1xuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIEhyZWZzIGxpa2UgLy9mb28vYmFyIGFsd2F5cyBjdXQgdG8gdGhlIHByb3RvY29sLlxuICAgIGlmIChyZWxhdGl2ZS5zbGFzaGVzICYmICFyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgICAgLy8gVGFrZSBldmVyeXRoaW5nIGV4Y2VwdCB0aGUgcHJvdG9jb2wgZnJvbSByZWxhdGl2ZVxuICAgICAgY29uc3QgcmtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgICBmb3IgKGxldCByayA9IDA7IHJrIDwgcmtleXMubGVuZ3RoOyByaysrKSB7XG4gICAgICAgIGNvbnN0IHJrZXkgPSBya2V5c1tya107XG4gICAgICAgIGlmIChya2V5ICE9PSBcInByb3RvY29sXCIpIHJlc3VsdFtya2V5XSA9IHJlbGF0aXZlW3JrZXldO1xuICAgICAgfVxuXG4gICAgICAvLyB1cmxQYXJzZSBhcHBlbmRzIHRyYWlsaW5nIC8gdG8gdXJscyBsaWtlIGh0dHA6Ly93d3cuZXhhbXBsZS5jb21cbiAgICAgIGlmIChcbiAgICAgICAgcmVzdWx0LnByb3RvY29sICYmXG4gICAgICAgIHNsYXNoZWRQcm90b2NvbC5oYXMocmVzdWx0LnByb3RvY29sKSAmJlxuICAgICAgICByZXN1bHQuaG9zdG5hbWUgJiZcbiAgICAgICAgIXJlc3VsdC5wYXRobmFtZVxuICAgICAgKSB7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gcmVzdWx0LnBhdGhuYW1lID0gXCIvXCI7XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBpZiAocmVsYXRpdmUucHJvdG9jb2wgJiYgcmVsYXRpdmUucHJvdG9jb2wgIT09IHJlc3VsdC5wcm90b2NvbCkge1xuICAgICAgLy8gSWYgaXQncyBhIGtub3duIHVybCBwcm90b2NvbCwgdGhlbiBjaGFuZ2luZ1xuICAgICAgLy8gdGhlIHByb3RvY29sIGRvZXMgd2VpcmQgdGhpbmdzXG4gICAgICAvLyBmaXJzdCwgaWYgaXQncyBub3QgZmlsZTosIHRoZW4gd2UgTVVTVCBoYXZlIGEgaG9zdCxcbiAgICAgIC8vIGFuZCBpZiB0aGVyZSB3YXMgYSBwYXRoXG4gICAgICAvLyB0byBiZWdpbiB3aXRoLCB0aGVuIHdlIE1VU1QgaGF2ZSBhIHBhdGguXG4gICAgICAvLyBpZiBpdCBpcyBmaWxlOiwgdGhlbiB0aGUgaG9zdCBpcyBkcm9wcGVkLFxuICAgICAgLy8gYmVjYXVzZSB0aGF0J3Mga25vd24gdG8gYmUgaG9zdGxlc3MuXG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGlzIGFzc3VtZWQgdG8gYmUgYWJzb2x1dGUuXG4gICAgICBpZiAoIXNsYXNoZWRQcm90b2NvbC5oYXMocmVsYXRpdmUucHJvdG9jb2wpKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgICAgIGZvciAobGV0IHYgPSAwOyB2IDwga2V5cy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgIGNvbnN0IGsgPSBrZXlzW3ZdO1xuICAgICAgICAgIHJlc3VsdFtrXSA9IHJlbGF0aXZlW2tdO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgICByZXN1bHQucHJvdG9jb2wgPSByZWxhdGl2ZS5wcm90b2NvbDtcbiAgICAgIGlmIChcbiAgICAgICAgIXJlbGF0aXZlLmhvc3QgJiZcbiAgICAgICAgIS9eZmlsZTo/JC8udGVzdChyZWxhdGl2ZS5wcm90b2NvbCkgJiZcbiAgICAgICAgIWhvc3RsZXNzUHJvdG9jb2wuaGFzKHJlbGF0aXZlLnByb3RvY29sKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IHJlbFBhdGggPSAocmVsYXRpdmUucGF0aG5hbWUgfHwgXCJcIikuc3BsaXQoXCIvXCIpO1xuICAgICAgICB3aGlsZSAocmVsUGF0aC5sZW5ndGggJiYgIShyZWxhdGl2ZS5ob3N0ID0gcmVsUGF0aC5zaGlmdCgpIHx8IG51bGwpKTtcbiAgICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0KSByZWxhdGl2ZS5ob3N0ID0gXCJcIjtcbiAgICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0bmFtZSkgcmVsYXRpdmUuaG9zdG5hbWUgPSBcIlwiO1xuICAgICAgICBpZiAocmVsUGF0aFswXSAhPT0gXCJcIikgcmVsUGF0aC51bnNoaWZ0KFwiXCIpO1xuICAgICAgICBpZiAocmVsUGF0aC5sZW5ndGggPCAyKSByZWxQYXRoLnVuc2hpZnQoXCJcIik7XG4gICAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbFBhdGguam9pbihcIi9cIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxhdGl2ZS5wYXRobmFtZTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICAgIHJlc3VsdC5ob3N0ID0gcmVsYXRpdmUuaG9zdCB8fCBcIlwiO1xuICAgICAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoO1xuICAgICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVsYXRpdmUuaG9zdG5hbWUgfHwgcmVsYXRpdmUuaG9zdDtcbiAgICAgIHJlc3VsdC5wb3J0ID0gcmVsYXRpdmUucG9ydDtcbiAgICAgIC8vIFRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgICBpZiAocmVzdWx0LnBhdGhuYW1lIHx8IHJlc3VsdC5zZWFyY2gpIHtcbiAgICAgICAgY29uc3QgcCA9IHJlc3VsdC5wYXRobmFtZSB8fCBcIlwiO1xuICAgICAgICBjb25zdCBzID0gcmVzdWx0LnNlYXJjaCB8fCBcIlwiO1xuICAgICAgICByZXN1bHQucGF0aCA9IHAgKyBzO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGNvbnN0IGlzU291cmNlQWJzID0gcmVzdWx0LnBhdGhuYW1lICYmIHJlc3VsdC5wYXRobmFtZS5jaGFyQXQoMCkgPT09IFwiL1wiO1xuICAgIGNvbnN0IGlzUmVsQWJzID0gcmVsYXRpdmUuaG9zdCB8fFxuICAgICAgKHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gXCIvXCIpO1xuICAgIGxldCBtdXN0RW5kQWJzOiBzdHJpbmcgfCBib29sZWFuIHwgbnVtYmVyIHwgbnVsbCA9IGlzUmVsQWJzIHx8XG4gICAgICBpc1NvdXJjZUFicyB8fCAocmVzdWx0Lmhvc3QgJiYgcmVsYXRpdmUucGF0aG5hbWUpO1xuICAgIGNvbnN0IHJlbW92ZUFsbERvdHMgPSBtdXN0RW5kQWJzO1xuICAgIGxldCBzcmNQYXRoID0gKHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuc3BsaXQoXCIvXCIpKSB8fCBbXTtcbiAgICBjb25zdCByZWxQYXRoID0gKHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLnNwbGl0KFwiL1wiKSkgfHwgW107XG4gICAgY29uc3Qgbm9MZWFkaW5nU2xhc2hlcyA9IHJlc3VsdC5wcm90b2NvbCAmJlxuICAgICAgIXNsYXNoZWRQcm90b2NvbC5oYXMocmVzdWx0LnByb3RvY29sKTtcblxuICAgIC8vIElmIHRoZSB1cmwgaXMgYSBub24tc2xhc2hlZCB1cmwsIHRoZW4gcmVsYXRpdmVcbiAgICAvLyBsaW5rcyBsaWtlIC4uLy4uIHNob3VsZCBiZSBhYmxlXG4gICAgLy8gdG8gY3Jhd2wgdXAgdG8gdGhlIGhvc3RuYW1lLCBhcyB3ZWxsLiAgVGhpcyBpcyBzdHJhbmdlLlxuICAgIC8vIHJlc3VsdC5wcm90b2NvbCBoYXMgYWxyZWFkeSBiZWVuIHNldCBieSBub3cuXG4gICAgLy8gTGF0ZXIgb24sIHB1dCB0aGUgZmlyc3QgcGF0aCBwYXJ0IGludG8gdGhlIGhvc3QgZmllbGQuXG4gICAgaWYgKG5vTGVhZGluZ1NsYXNoZXMpIHtcbiAgICAgIHJlc3VsdC5ob3N0bmFtZSA9IFwiXCI7XG4gICAgICByZXN1bHQucG9ydCA9IG51bGw7XG4gICAgICBpZiAocmVzdWx0Lmhvc3QpIHtcbiAgICAgICAgaWYgKHNyY1BhdGhbMF0gPT09IFwiXCIpIHNyY1BhdGhbMF0gPSByZXN1bHQuaG9zdDtcbiAgICAgICAgZWxzZSBzcmNQYXRoLnVuc2hpZnQocmVzdWx0Lmhvc3QpO1xuICAgICAgfVxuICAgICAgcmVzdWx0Lmhvc3QgPSBcIlwiO1xuICAgICAgaWYgKHJlbGF0aXZlLnByb3RvY29sKSB7XG4gICAgICAgIHJlbGF0aXZlLmhvc3RuYW1lID0gbnVsbDtcbiAgICAgICAgcmVsYXRpdmUucG9ydCA9IG51bGw7XG4gICAgICAgIHJlc3VsdC5hdXRoID0gbnVsbDtcbiAgICAgICAgaWYgKHJlbGF0aXZlLmhvc3QpIHtcbiAgICAgICAgICBpZiAocmVsUGF0aFswXSA9PT0gXCJcIikgcmVsUGF0aFswXSA9IHJlbGF0aXZlLmhvc3Q7XG4gICAgICAgICAgZWxzZSByZWxQYXRoLnVuc2hpZnQocmVsYXRpdmUuaG9zdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVsYXRpdmUuaG9zdCA9IG51bGw7XG4gICAgICB9XG4gICAgICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyAmJiAocmVsUGF0aFswXSA9PT0gXCJcIiB8fCBzcmNQYXRoWzBdID09PSBcIlwiKTtcbiAgICB9XG5cbiAgICBpZiAoaXNSZWxBYnMpIHtcbiAgICAgIC8vIGl0J3MgYWJzb2x1dGUuXG4gICAgICBpZiAocmVsYXRpdmUuaG9zdCB8fCByZWxhdGl2ZS5ob3N0ID09PSBcIlwiKSB7XG4gICAgICAgIGlmIChyZXN1bHQuaG9zdCAhPT0gcmVsYXRpdmUuaG9zdCkgcmVzdWx0LmF1dGggPSBudWxsO1xuICAgICAgICByZXN1bHQuaG9zdCA9IHJlbGF0aXZlLmhvc3Q7XG4gICAgICAgIHJlc3VsdC5wb3J0ID0gcmVsYXRpdmUucG9ydDtcbiAgICAgIH1cbiAgICAgIGlmIChyZWxhdGl2ZS5ob3N0bmFtZSB8fCByZWxhdGl2ZS5ob3N0bmFtZSA9PT0gXCJcIikge1xuICAgICAgICBpZiAocmVzdWx0Lmhvc3RuYW1lICE9PSByZWxhdGl2ZS5ob3N0bmFtZSkgcmVzdWx0LmF1dGggPSBudWxsO1xuICAgICAgICByZXN1bHQuaG9zdG5hbWUgPSByZWxhdGl2ZS5ob3N0bmFtZTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICAgIHNyY1BhdGggPSByZWxQYXRoO1xuICAgICAgLy8gRmFsbCB0aHJvdWdoIHRvIHRoZSBkb3QtaGFuZGxpbmcgYmVsb3cuXG4gICAgfSBlbHNlIGlmIChyZWxQYXRoLmxlbmd0aCkge1xuICAgICAgLy8gaXQncyByZWxhdGl2ZVxuICAgICAgLy8gdGhyb3cgYXdheSB0aGUgZXhpc3RpbmcgZmlsZSwgYW5kIHRha2UgdGhlIG5ldyBwYXRoIGluc3RlYWQuXG4gICAgICBpZiAoIXNyY1BhdGgpIHNyY1BhdGggPSBbXTtcbiAgICAgIHNyY1BhdGgucG9wKCk7XG4gICAgICBzcmNQYXRoID0gc3JjUGF0aC5jb25jYXQocmVsUGF0aCk7XG4gICAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgfSBlbHNlIGlmIChyZWxhdGl2ZS5zZWFyY2ggIT09IG51bGwgJiYgcmVsYXRpdmUuc2VhcmNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIEp1c3QgcHVsbCBvdXQgdGhlIHNlYXJjaC5cbiAgICAgIC8vIGxpa2UgaHJlZj0nP2ZvbycuXG4gICAgICAvLyBQdXQgdGhpcyBhZnRlciB0aGUgb3RoZXIgdHdvIGNhc2VzIGJlY2F1c2UgaXQgc2ltcGxpZmllcyB0aGUgYm9vbGVhbnNcbiAgICAgIGlmIChub0xlYWRpbmdTbGFzaGVzKSB7XG4gICAgICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gc3JjUGF0aC5zaGlmdCgpIHx8IG51bGw7XG4gICAgICAgIC8vIE9jY2FzaW9uYWxseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdC5cbiAgICAgICAgLy8gVGhpcyBlc3BlY2lhbGx5IGhhcHBlbnMgaW4gY2FzZXMgbGlrZVxuICAgICAgICAvLyB1cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICAgICAgY29uc3QgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoXCJAXCIpID4gMCAmJlxuICAgICAgICAgIHJlc3VsdC5ob3N0LnNwbGl0KFwiQFwiKTtcbiAgICAgICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKSB8fCBudWxsO1xuICAgICAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpIHx8IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICAgIC8vIFRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgICBpZiAocmVzdWx0LnBhdGhuYW1lICE9PSBudWxsIHx8IHJlc3VsdC5zZWFyY2ggIT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogXCJcIikgK1xuICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6IFwiXCIpO1xuICAgICAgfVxuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICAgIC8vIE5vIHBhdGggYXQgYWxsLiBBbGwgb3RoZXIgdGhpbmdzIHdlcmUgYWxyZWFkeSBoYW5kbGVkIGFib3ZlLlxuICAgICAgcmVzdWx0LnBhdGhuYW1lID0gbnVsbDtcbiAgICAgIC8vIFRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgICBpZiAocmVzdWx0LnNlYXJjaCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IFwiL1wiICsgcmVzdWx0LnNlYXJjaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBJZiBhIHVybCBFTkRzIGluIC4gb3IgLi4sIHRoZW4gaXQgbXVzdCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgICAvLyBob3dldmVyLCBpZiBpdCBlbmRzIGluIGFueXRoaW5nIGVsc2Ugbm9uLXNsYXNoeSxcbiAgICAvLyB0aGVuIGl0IG11c3QgTk9UIGdldCBhIHRyYWlsaW5nIHNsYXNoLlxuICAgIGxldCBsYXN0ID0gc3JjUGF0aC5zbGljZSgtMSlbMF07XG4gICAgY29uc3QgaGFzVHJhaWxpbmdTbGFzaCA9XG4gICAgICAoKHJlc3VsdC5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgfHwgc3JjUGF0aC5sZW5ndGggPiAxKSAmJlxuICAgICAgICAobGFzdCA9PT0gXCIuXCIgfHwgbGFzdCA9PT0gXCIuLlwiKSkgfHxcbiAgICAgIGxhc3QgPT09IFwiXCI7XG5cbiAgICAvLyBTdHJpcCBzaW5nbGUgZG90cywgcmVzb2x2ZSBkb3VibGUgZG90cyB0byBwYXJlbnQgZGlyXG4gICAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgICBsZXQgdXAgPSAwO1xuICAgIGZvciAobGV0IGkgPSBzcmNQYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBsYXN0ID0gc3JjUGF0aFtpXTtcbiAgICAgIGlmIChsYXN0ID09PSBcIi5cIikge1xuICAgICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gXCIuLlwiKSB7XG4gICAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgICAgICB1cCsrO1xuICAgICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgICAgdXAtLTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gICAgaWYgKCFtdXN0RW5kQWJzICYmICFyZW1vdmVBbGxEb3RzKSB7XG4gICAgICB3aGlsZSAodXAtLSkge1xuICAgICAgICBzcmNQYXRoLnVuc2hpZnQoXCIuLlwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBtdXN0RW5kQWJzICYmXG4gICAgICBzcmNQYXRoWzBdICE9PSBcIlwiICYmXG4gICAgICAoIXNyY1BhdGhbMF0gfHwgc3JjUGF0aFswXS5jaGFyQXQoMCkgIT09IFwiL1wiKVxuICAgICkge1xuICAgICAgc3JjUGF0aC51bnNoaWZ0KFwiXCIpO1xuICAgIH1cblxuICAgIGlmIChoYXNUcmFpbGluZ1NsYXNoICYmIHNyY1BhdGguam9pbihcIi9cIikuc3Vic3RyKC0xKSAhPT0gXCIvXCIpIHtcbiAgICAgIHNyY1BhdGgucHVzaChcIlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc0Fic29sdXRlID0gc3JjUGF0aFswXSA9PT0gXCJcIiB8fFxuICAgICAgKHNyY1BhdGhbMF0gJiYgc3JjUGF0aFswXS5jaGFyQXQoMCkgPT09IFwiL1wiKTtcblxuICAgIC8vIHB1dCB0aGUgaG9zdCBiYWNrXG4gICAgaWYgKG5vTGVhZGluZ1NsYXNoZXMpIHtcbiAgICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gaXNBYnNvbHV0ZVxuICAgICAgICA/IFwiXCJcbiAgICAgICAgOiBzcmNQYXRoLmxlbmd0aFxuICAgICAgICA/IHNyY1BhdGguc2hpZnQoKSB8fCBudWxsXG4gICAgICAgIDogXCJcIjtcbiAgICAgIC8vIE9jY2FzaW9uYWxseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdC5cbiAgICAgIC8vIFRoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAgIC8vIHVybC5yZXNvbHZlT2JqZWN0KCdtYWlsdG86bG9jYWwxQGRvbWFpbjEnLCAnbG9jYWwyQGRvbWFpbjInKVxuICAgICAgY29uc3QgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoXCJAXCIpID4gMFxuICAgICAgICA/IHJlc3VsdC5ob3N0LnNwbGl0KFwiQFwiKVxuICAgICAgICA6IGZhbHNlO1xuICAgICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgICAgcmVzdWx0LmF1dGggPSBhdXRoSW5Ib3N0LnNoaWZ0KCkgfHwgbnVsbDtcbiAgICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCkgfHwgbnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyB8fCAocmVzdWx0Lmhvc3QgJiYgc3JjUGF0aC5sZW5ndGgpO1xuXG4gICAgaWYgKG11c3RFbmRBYnMgJiYgIWlzQWJzb2x1dGUpIHtcbiAgICAgIHNyY1BhdGgudW5zaGlmdChcIlwiKTtcbiAgICB9XG5cbiAgICBpZiAoIXNyY1BhdGgubGVuZ3RoKSB7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSBzcmNQYXRoLmpvaW4oXCIvXCIpO1xuICAgIH1cblxuICAgIC8vIFRvIHN1cHBvcnQgcmVxdWVzdC5odHRwXG4gICAgaWYgKHJlc3VsdC5wYXRobmFtZSAhPT0gbnVsbCB8fCByZXN1bHQuc2VhcmNoICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQucGF0aCA9IChyZXN1bHQucGF0aG5hbWUgPyByZXN1bHQucGF0aG5hbWUgOiBcIlwiKSArXG4gICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6IFwiXCIpO1xuICAgIH1cbiAgICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGggfHwgcmVzdWx0LmF1dGg7XG4gICAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBmb3JtYXQoKSB7XG4gICAgbGV0IGF1dGggPSB0aGlzLmF1dGggfHwgXCJcIjtcbiAgICBpZiAoYXV0aCkge1xuICAgICAgYXV0aCA9IGVuY29kZVN0cihhdXRoLCBub0VzY2FwZUF1dGgsIGhleFRhYmxlKTtcbiAgICAgIGF1dGggKz0gXCJAXCI7XG4gICAgfVxuXG4gICAgbGV0IHByb3RvY29sID0gdGhpcy5wcm90b2NvbCB8fCBcIlwiO1xuICAgIGxldCBwYXRobmFtZSA9IHRoaXMucGF0aG5hbWUgfHwgXCJcIjtcbiAgICBsZXQgaGFzaCA9IHRoaXMuaGFzaCB8fCBcIlwiO1xuICAgIGxldCBob3N0ID0gXCJcIjtcbiAgICBsZXQgcXVlcnkgPSBcIlwiO1xuXG4gICAgaWYgKHRoaXMuaG9zdCkge1xuICAgICAgaG9zdCA9IGF1dGggKyB0aGlzLmhvc3Q7XG4gICAgfSBlbHNlIGlmICh0aGlzLmhvc3RuYW1lKSB7XG4gICAgICBob3N0ID0gYXV0aCArXG4gICAgICAgICh0aGlzLmhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSAmJiAhaXNJcHY2SG9zdG5hbWUodGhpcy5ob3N0bmFtZSlcbiAgICAgICAgICA/IFwiW1wiICsgdGhpcy5ob3N0bmFtZSArIFwiXVwiXG4gICAgICAgICAgOiB0aGlzLmhvc3RuYW1lKTtcbiAgICAgIGlmICh0aGlzLnBvcnQpIHtcbiAgICAgICAgaG9zdCArPSBcIjpcIiArIHRoaXMucG9ydDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5xdWVyeSAhPT0gbnVsbCAmJiB0eXBlb2YgdGhpcy5xdWVyeSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgcXVlcnkgPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkodGhpcy5xdWVyeSk7XG4gICAgfVxuXG4gICAgbGV0IHNlYXJjaCA9IHRoaXMuc2VhcmNoIHx8IChxdWVyeSAmJiBcIj9cIiArIHF1ZXJ5KSB8fCBcIlwiO1xuXG4gICAgaWYgKHByb3RvY29sICYmIHByb3RvY29sLmNoYXJDb2RlQXQocHJvdG9jb2wubGVuZ3RoIC0gMSkgIT09IDU4IC8qIDogKi8pIHtcbiAgICAgIHByb3RvY29sICs9IFwiOlwiO1xuICAgIH1cblxuICAgIGxldCBuZXdQYXRobmFtZSA9IFwiXCI7XG4gICAgbGV0IGxhc3RQb3MgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aG5hbWUubGVuZ3RoOyArK2kpIHtcbiAgICAgIHN3aXRjaCAocGF0aG5hbWUuY2hhckNvZGVBdChpKSkge1xuICAgICAgICBjYXNlIENIQVJfSEFTSDpcbiAgICAgICAgICBpZiAoaSAtIGxhc3RQb3MgPiAwKSB7XG4gICAgICAgICAgICBuZXdQYXRobmFtZSArPSBwYXRobmFtZS5zbGljZShsYXN0UG9zLCBpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbmV3UGF0aG5hbWUgKz0gXCIlMjNcIjtcbiAgICAgICAgICBsYXN0UG9zID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQ0hBUl9RVUVTVElPTl9NQVJLOlxuICAgICAgICAgIGlmIChpIC0gbGFzdFBvcyA+IDApIHtcbiAgICAgICAgICAgIG5ld1BhdGhuYW1lICs9IHBhdGhuYW1lLnNsaWNlKGxhc3RQb3MsIGkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBuZXdQYXRobmFtZSArPSBcIiUzRlwiO1xuICAgICAgICAgIGxhc3RQb3MgPSBpICsgMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3RQb3MgPiAwKSB7XG4gICAgICBpZiAobGFzdFBvcyAhPT0gcGF0aG5hbWUubGVuZ3RoKSB7XG4gICAgICAgIHBhdGhuYW1lID0gbmV3UGF0aG5hbWUgKyBwYXRobmFtZS5zbGljZShsYXN0UG9zKTtcbiAgICAgIH0gZWxzZSBwYXRobmFtZSA9IG5ld1BhdGhuYW1lO1xuICAgIH1cblxuICAgIC8vIE9ubHkgdGhlIHNsYXNoZWRQcm90b2NvbHMgZ2V0IHRoZSAvLy4gIE5vdCBtYWlsdG86LCB4bXBwOiwgZXRjLlxuICAgIC8vIHVubGVzcyB0aGV5IGhhZCB0aGVtIHRvIGJlZ2luIHdpdGguXG4gICAgaWYgKHRoaXMuc2xhc2hlcyB8fCBzbGFzaGVkUHJvdG9jb2wuaGFzKHByb3RvY29sKSkge1xuICAgICAgaWYgKHRoaXMuc2xhc2hlcyB8fCBob3N0KSB7XG4gICAgICAgIGlmIChwYXRobmFtZSAmJiBwYXRobmFtZS5jaGFyQ29kZUF0KDApICE9PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgICBwYXRobmFtZSA9IFwiL1wiICsgcGF0aG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgaG9zdCA9IFwiLy9cIiArIGhvc3Q7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBwcm90b2NvbC5sZW5ndGggPj0gNCAmJlxuICAgICAgICBwcm90b2NvbC5jaGFyQ29kZUF0KDApID09PSAxMDIgLyogZiAqLyAmJlxuICAgICAgICBwcm90b2NvbC5jaGFyQ29kZUF0KDEpID09PSAxMDUgLyogaSAqLyAmJlxuICAgICAgICBwcm90b2NvbC5jaGFyQ29kZUF0KDIpID09PSAxMDggLyogbCAqLyAmJlxuICAgICAgICBwcm90b2NvbC5jaGFyQ29kZUF0KDMpID09PSAxMDEgLyogZSAqL1xuICAgICAgKSB7XG4gICAgICAgIGhvc3QgPSBcIi8vXCI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VhcmNoID0gc2VhcmNoLnJlcGxhY2UoLyMvZywgXCIlMjNcIik7XG5cbiAgICBpZiAoaGFzaCAmJiBoYXNoLmNoYXJDb2RlQXQoMCkgIT09IENIQVJfSEFTSCkge1xuICAgICAgaGFzaCA9IFwiI1wiICsgaGFzaDtcbiAgICB9XG4gICAgaWYgKHNlYXJjaCAmJiBzZWFyY2guY2hhckNvZGVBdCgwKSAhPT0gQ0hBUl9RVUVTVElPTl9NQVJLKSB7XG4gICAgICBzZWFyY2ggPSBcIj9cIiArIHNlYXJjaDtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvdG9jb2wgKyBob3N0ICsgcGF0aG5hbWUgKyBzZWFyY2ggKyBoYXNoO1xuICB9XG5cbiAgcHVibGljIHVybFBhcnNlKFxuICAgIHVybDogc3RyaW5nLFxuICAgIHBhcnNlUXVlcnlTdHJpbmc6IGJvb2xlYW4sXG4gICAgc2xhc2hlc0Rlbm90ZUhvc3Q6IGJvb2xlYW4sXG4gICkge1xuICAgIHZhbGlkYXRlU3RyaW5nKHVybCwgXCJ1cmxcIik7XG5cbiAgICAvLyBDb3B5IGNocm9tZSwgSUUsIG9wZXJhIGJhY2tzbGFzaC1oYW5kbGluZyBiZWhhdmlvci5cbiAgICAvLyBCYWNrIHNsYXNoZXMgYmVmb3JlIHRoZSBxdWVyeSBzdHJpbmcgZ2V0IGNvbnZlcnRlZCB0byBmb3J3YXJkIHNsYXNoZXNcbiAgICAvLyBTZWU6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNTkxNlxuICAgIGxldCBoYXNIYXNoID0gZmFsc2U7XG4gICAgbGV0IHN0YXJ0ID0gLTE7XG4gICAgbGV0IGVuZCA9IC0xO1xuICAgIGxldCByZXN0ID0gXCJcIjtcbiAgICBsZXQgbGFzdFBvcyA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDAsIGluV3MgPSBmYWxzZSwgc3BsaXQgPSBmYWxzZTsgaSA8IHVybC5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgY29kZSA9IHVybC5jaGFyQ29kZUF0KGkpO1xuXG4gICAgICAvLyBGaW5kIGZpcnN0IGFuZCBsYXN0IG5vbi13aGl0ZXNwYWNlIGNoYXJhY3RlcnMgZm9yIHRyaW1taW5nXG4gICAgICBjb25zdCBpc1dzID0gY29kZSA9PT0gQ0hBUl9TUEFDRSB8fFxuICAgICAgICBjb2RlID09PSBDSEFSX1RBQiB8fFxuICAgICAgICBjb2RlID09PSBDSEFSX0NBUlJJQUdFX1JFVFVSTiB8fFxuICAgICAgICBjb2RlID09PSBDSEFSX0xJTkVfRkVFRCB8fFxuICAgICAgICBjb2RlID09PSBDSEFSX0ZPUk1fRkVFRCB8fFxuICAgICAgICBjb2RlID09PSBDSEFSX05PX0JSRUFLX1NQQUNFIHx8XG4gICAgICAgIGNvZGUgPT09IENIQVJfWkVST19XSURUSF9OT0JSRUFLX1NQQUNFO1xuICAgICAgaWYgKHN0YXJ0ID09PSAtMSkge1xuICAgICAgICBpZiAoaXNXcykgY29udGludWU7XG4gICAgICAgIGxhc3RQb3MgPSBzdGFydCA9IGk7XG4gICAgICB9IGVsc2UgaWYgKGluV3MpIHtcbiAgICAgICAgaWYgKCFpc1dzKSB7XG4gICAgICAgICAgZW5kID0gLTE7XG4gICAgICAgICAgaW5XcyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzV3MpIHtcbiAgICAgICAgZW5kID0gaTtcbiAgICAgICAgaW5XcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgY29udmVydCBiYWNrc2xhc2hlcyB3aGlsZSB3ZSBoYXZlbid0IHNlZW4gYSBzcGxpdCBjaGFyYWN0ZXJcbiAgICAgIGlmICghc3BsaXQpIHtcbiAgICAgICAgc3dpdGNoIChjb2RlKSB7XG4gICAgICAgICAgY2FzZSBDSEFSX0hBU0g6XG4gICAgICAgICAgICBoYXNIYXNoID0gdHJ1ZTtcbiAgICAgICAgICAvLyBGYWxsIHRocm91Z2hcbiAgICAgICAgICBjYXNlIENIQVJfUVVFU1RJT05fTUFSSzpcbiAgICAgICAgICAgIHNwbGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgQ0hBUl9CQUNLV0FSRF9TTEFTSDpcbiAgICAgICAgICAgIGlmIChpIC0gbGFzdFBvcyA+IDApIHJlc3QgKz0gdXJsLnNsaWNlKGxhc3RQb3MsIGkpO1xuICAgICAgICAgICAgcmVzdCArPSBcIi9cIjtcbiAgICAgICAgICAgIGxhc3RQb3MgPSBpICsgMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFoYXNIYXNoICYmIGNvZGUgPT09IENIQVJfSEFTSCkge1xuICAgICAgICBoYXNIYXNoID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBzdHJpbmcgd2FzIG5vbi1lbXB0eSAoaW5jbHVkaW5nIHN0cmluZ3Mgd2l0aCBvbmx5IHdoaXRlc3BhY2UpXG4gICAgaWYgKHN0YXJ0ICE9PSAtMSkge1xuICAgICAgaWYgKGxhc3RQb3MgPT09IHN0YXJ0KSB7XG4gICAgICAgIC8vIFdlIGRpZG4ndCBjb252ZXJ0IGFueSBiYWNrc2xhc2hlc1xuXG4gICAgICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgICAgaWYgKHN0YXJ0ID09PSAwKSByZXN0ID0gdXJsO1xuICAgICAgICAgIGVsc2UgcmVzdCA9IHVybC5zbGljZShzdGFydCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdCA9IHVybC5zbGljZShzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlbmQgPT09IC0xICYmIGxhc3RQb3MgPCB1cmwubGVuZ3RoKSB7XG4gICAgICAgIC8vIFdlIGNvbnZlcnRlZCBzb21lIGJhY2tzbGFzaGVzIGFuZCBoYXZlIG9ubHkgcGFydCBvZiB0aGUgZW50aXJlIHN0cmluZ1xuICAgICAgICByZXN0ICs9IHVybC5zbGljZShsYXN0UG9zKTtcbiAgICAgIH0gZWxzZSBpZiAoZW5kICE9PSAtMSAmJiBsYXN0UG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIFdlIGNvbnZlcnRlZCBzb21lIGJhY2tzbGFzaGVzIGFuZCBoYXZlIG9ubHkgcGFydCBvZiB0aGUgZW50aXJlIHN0cmluZ1xuICAgICAgICByZXN0ICs9IHVybC5zbGljZShsYXN0UG9zLCBlbmQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghc2xhc2hlc0Rlbm90ZUhvc3QgJiYgIWhhc0hhc2gpIHtcbiAgICAgIC8vIFRyeSBmYXN0IHBhdGggcmVnZXhwXG4gICAgICBjb25zdCBzaW1wbGVQYXRoID0gc2ltcGxlUGF0aFBhdHRlcm4uZXhlYyhyZXN0KTtcbiAgICAgIGlmIChzaW1wbGVQYXRoKSB7XG4gICAgICAgIHRoaXMucGF0aCA9IHJlc3Q7XG4gICAgICAgIHRoaXMuaHJlZiA9IHJlc3Q7XG4gICAgICAgIHRoaXMucGF0aG5hbWUgPSBzaW1wbGVQYXRoWzFdO1xuICAgICAgICBpZiAoc2ltcGxlUGF0aFsyXSkge1xuICAgICAgICAgIHRoaXMuc2VhcmNoID0gc2ltcGxlUGF0aFsyXTtcbiAgICAgICAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMuc2VhcmNoLnNsaWNlKDEpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5xdWVyeSA9IHRoaXMuc2VhcmNoLnNsaWNlKDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgICAgdGhpcy5zZWFyY2ggPSBudWxsO1xuICAgICAgICAgIHRoaXMucXVlcnkgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBwcm90bzogUmVnRXhwRXhlY0FycmF5IHwgbnVsbCB8IHN0cmluZyA9IHByb3RvY29sUGF0dGVybi5leGVjKHJlc3QpO1xuICAgIGxldCBsb3dlclByb3RvID0gXCJcIjtcbiAgICBpZiAocHJvdG8pIHtcbiAgICAgIHByb3RvID0gcHJvdG9bMF07XG4gICAgICBsb3dlclByb3RvID0gcHJvdG8udG9Mb3dlckNhc2UoKTtcbiAgICAgIHRoaXMucHJvdG9jb2wgPSBsb3dlclByb3RvO1xuICAgICAgcmVzdCA9IHJlc3Quc2xpY2UocHJvdG8ubGVuZ3RoKTtcbiAgICB9XG5cbiAgICAvLyBGaWd1cmUgb3V0IGlmIGl0J3MgZ290IGEgaG9zdFxuICAgIC8vIHVzZXJAc2VydmVyIGlzICphbHdheXMqIGludGVycHJldGVkIGFzIGEgaG9zdG5hbWUsIGFuZCB1cmxcbiAgICAvLyByZXNvbHV0aW9uIHdpbGwgdHJlYXQgLy9mb28vYmFyIGFzIGhvc3Q9Zm9vLHBhdGg9YmFyIGJlY2F1c2UgdGhhdCdzXG4gICAgLy8gaG93IHRoZSBicm93c2VyIHJlc29sdmVzIHJlbGF0aXZlIFVSTHMuXG4gICAgbGV0IHNsYXNoZXM7XG4gICAgaWYgKHNsYXNoZXNEZW5vdGVIb3N0IHx8IHByb3RvIHx8IGhvc3RQYXR0ZXJuLnRlc3QocmVzdCkpIHtcbiAgICAgIHNsYXNoZXMgPSByZXN0LmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSCAmJlxuICAgICAgICByZXN0LmNoYXJDb2RlQXQoMSkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbiAgICAgIGlmIChzbGFzaGVzICYmICEocHJvdG8gJiYgaG9zdGxlc3NQcm90b2NvbC5oYXMobG93ZXJQcm90bykpKSB7XG4gICAgICAgIHJlc3QgPSByZXN0LnNsaWNlKDIpO1xuICAgICAgICB0aGlzLnNsYXNoZXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChcbiAgICAgICFob3N0bGVzc1Byb3RvY29sLmhhcyhsb3dlclByb3RvKSAmJlxuICAgICAgKHNsYXNoZXMgfHwgKHByb3RvICYmICFzbGFzaGVkUHJvdG9jb2wuaGFzKHByb3RvKSkpXG4gICAgKSB7XG4gICAgICAvLyB0aGVyZSdzIGEgaG9zdG5hbWUuXG4gICAgICAvLyB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgLywgPywgOywgb3IgIyBlbmRzIHRoZSBob3N0LlxuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZXJlIGlzIGFuIEAgaW4gdGhlIGhvc3RuYW1lLCB0aGVuIG5vbi1ob3N0IGNoYXJzICphcmUqIGFsbG93ZWRcbiAgICAgIC8vIHRvIHRoZSBsZWZ0IG9mIHRoZSBsYXN0IEAgc2lnbiwgdW5sZXNzIHNvbWUgaG9zdC1lbmRpbmcgY2hhcmFjdGVyXG4gICAgICAvLyBjb21lcyAqYmVmb3JlKiB0aGUgQC1zaWduLlxuICAgICAgLy8gVVJMcyBhcmUgb2Jub3hpb3VzLlxuICAgICAgLy9cbiAgICAgIC8vIGV4OlxuICAgICAgLy8gaHR0cDovL2FAYkBjLyA9PiB1c2VyOmFAYiBob3N0OmNcbiAgICAgIC8vIGh0dHA6Ly9hQGI/QGMgPT4gdXNlcjphIGhvc3Q6YiBwYXRoOi8/QGNcblxuICAgICAgbGV0IGhvc3RFbmQgPSAtMTtcbiAgICAgIGxldCBhdFNpZ24gPSAtMTtcbiAgICAgIGxldCBub25Ib3N0ID0gLTE7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgc3dpdGNoIChyZXN0LmNoYXJDb2RlQXQoaSkpIHtcbiAgICAgICAgICBjYXNlIENIQVJfVEFCOlxuICAgICAgICAgIGNhc2UgQ0hBUl9MSU5FX0ZFRUQ6XG4gICAgICAgICAgY2FzZSBDSEFSX0NBUlJJQUdFX1JFVFVSTjpcbiAgICAgICAgICBjYXNlIENIQVJfU1BBQ0U6XG4gICAgICAgICAgY2FzZSBDSEFSX0RPVUJMRV9RVU9URTpcbiAgICAgICAgICBjYXNlIENIQVJfUEVSQ0VOVDpcbiAgICAgICAgICBjYXNlIENIQVJfU0lOR0xFX1FVT1RFOlxuICAgICAgICAgIGNhc2UgQ0hBUl9TRU1JQ09MT046XG4gICAgICAgICAgY2FzZSBDSEFSX0xFRlRfQU5HTEVfQlJBQ0tFVDpcbiAgICAgICAgICBjYXNlIENIQVJfUklHSFRfQU5HTEVfQlJBQ0tFVDpcbiAgICAgICAgICBjYXNlIENIQVJfQkFDS1dBUkRfU0xBU0g6XG4gICAgICAgICAgY2FzZSBDSEFSX0NJUkNVTUZMRVhfQUNDRU5UOlxuICAgICAgICAgIGNhc2UgQ0hBUl9HUkFWRV9BQ0NFTlQ6XG4gICAgICAgICAgY2FzZSBDSEFSX0xFRlRfQ1VSTFlfQlJBQ0tFVDpcbiAgICAgICAgICBjYXNlIENIQVJfVkVSVElDQUxfTElORTpcbiAgICAgICAgICBjYXNlIENIQVJfUklHSFRfQ1VSTFlfQlJBQ0tFVDpcbiAgICAgICAgICAgIC8vIENoYXJhY3RlcnMgdGhhdCBhcmUgbmV2ZXIgZXZlciBhbGxvd2VkIGluIGEgaG9zdG5hbWUgZnJvbSBSRkMgMjM5NlxuICAgICAgICAgICAgaWYgKG5vbkhvc3QgPT09IC0xKSBub25Ib3N0ID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgQ0hBUl9IQVNIOlxuICAgICAgICAgIGNhc2UgQ0hBUl9GT1JXQVJEX1NMQVNIOlxuICAgICAgICAgIGNhc2UgQ0hBUl9RVUVTVElPTl9NQVJLOlxuICAgICAgICAgICAgLy8gRmluZCB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgYW55IGhvc3QtZW5kaW5nIGNoYXJhY3RlcnNcbiAgICAgICAgICAgIGlmIChub25Ib3N0ID09PSAtMSkgbm9uSG9zdCA9IGk7XG4gICAgICAgICAgICBob3N0RW5kID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgQ0hBUl9BVDpcbiAgICAgICAgICAgIC8vIEF0IHRoaXMgcG9pbnQsIGVpdGhlciB3ZSBoYXZlIGFuIGV4cGxpY2l0IHBvaW50IHdoZXJlIHRoZVxuICAgICAgICAgICAgLy8gYXV0aCBwb3J0aW9uIGNhbm5vdCBnbyBwYXN0LCBvciB0aGUgbGFzdCBAIGNoYXIgaXMgdGhlIGRlY2lkZXIuXG4gICAgICAgICAgICBhdFNpZ24gPSBpO1xuICAgICAgICAgICAgbm9uSG9zdCA9IC0xO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvc3RFbmQgIT09IC0xKSBicmVhaztcbiAgICAgIH1cbiAgICAgIHN0YXJ0ID0gMDtcbiAgICAgIGlmIChhdFNpZ24gIT09IC0xKSB7XG4gICAgICAgIHRoaXMuYXV0aCA9IGRlY29kZVVSSUNvbXBvbmVudChyZXN0LnNsaWNlKDAsIGF0U2lnbikpO1xuICAgICAgICBzdGFydCA9IGF0U2lnbiArIDE7XG4gICAgICB9XG4gICAgICBpZiAobm9uSG9zdCA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5ob3N0ID0gcmVzdC5zbGljZShzdGFydCk7XG4gICAgICAgIHJlc3QgPSBcIlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ob3N0ID0gcmVzdC5zbGljZShzdGFydCwgbm9uSG9zdCk7XG4gICAgICAgIHJlc3QgPSByZXN0LnNsaWNlKG5vbkhvc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBwdWxsIG91dCBwb3J0LlxuICAgICAgdGhpcy4jcGFyc2VIb3N0KCk7XG5cbiAgICAgIC8vIFdlJ3ZlIGluZGljYXRlZCB0aGF0IHRoZXJlIGlzIGEgaG9zdG5hbWUsXG4gICAgICAvLyBzbyBldmVuIGlmIGl0J3MgZW1wdHksIGl0IGhhcyB0byBiZSBwcmVzZW50LlxuICAgICAgaWYgKHR5cGVvZiB0aGlzLmhvc3RuYW1lICE9PSBcInN0cmluZ1wiKSB0aGlzLmhvc3RuYW1lID0gXCJcIjtcblxuICAgICAgY29uc3QgaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lO1xuXG4gICAgICAvLyBJZiBob3N0bmFtZSBiZWdpbnMgd2l0aCBbIGFuZCBlbmRzIHdpdGggXVxuICAgICAgLy8gYXNzdW1lIHRoYXQgaXQncyBhbiBJUHY2IGFkZHJlc3MuXG4gICAgICBjb25zdCBpcHY2SG9zdG5hbWUgPSBpc0lwdjZIb3N0bmFtZShob3N0bmFtZSk7XG5cbiAgICAgIC8vIHZhbGlkYXRlIGEgbGl0dGxlLlxuICAgICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgICAgcmVzdCA9IGdldEhvc3RuYW1lKHRoaXMsIHJlc3QsIGhvc3RuYW1lKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaG9zdG5hbWUubGVuZ3RoID4gaG9zdG5hbWVNYXhMZW4pIHtcbiAgICAgICAgdGhpcy5ob3N0bmFtZSA9IFwiXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBIb3N0bmFtZXMgYXJlIGFsd2F5cyBsb3dlciBjYXNlLlxuICAgICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5ob3N0bmFtZSAhPT0gXCJcIikge1xuICAgICAgICBpZiAoaXB2Nkhvc3RuYW1lKSB7XG4gICAgICAgICAgaWYgKGZvcmJpZGRlbkhvc3RDaGFyc0lwdjYudGVzdCh0aGlzLmhvc3RuYW1lKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX1VSTCh1cmwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBJRE5BIFN1cHBvcnQ6IFJldHVybnMgYSBwdW55Y29kZWQgcmVwcmVzZW50YXRpb24gb2YgXCJkb21haW5cIi5cbiAgICAgICAgICAvLyBJdCBvbmx5IGNvbnZlcnRzIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB0aGF0XG4gICAgICAgICAgLy8gaGF2ZSBub24tQVNDSUkgY2hhcmFjdGVycywgaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZlxuICAgICAgICAgIC8vIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCBhbHJlYWR5IGlzIEFTQ0lJLW9ubHkuXG5cbiAgICAgICAgICAvLyBVc2UgbGVuaWVudCBtb2RlIChgdHJ1ZWApIHRvIHRyeSB0byBzdXBwb3J0IGV2ZW4gbm9uLWNvbXBsaWFudFxuICAgICAgICAgIC8vIFVSTHMuXG4gICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHRvQVNDSUkodGhpcy5ob3N0bmFtZSk7XG5cbiAgICAgICAgICAvLyBQcmV2ZW50IHR3byBwb3RlbnRpYWwgcm91dGVzIG9mIGhvc3RuYW1lIHNwb29maW5nLlxuICAgICAgICAgIC8vIDEuIElmIHRoaXMuaG9zdG5hbWUgaXMgZW1wdHksIGl0IG11c3QgaGF2ZSBiZWNvbWUgZW1wdHkgZHVlIHRvIHRvQVNDSUlcbiAgICAgICAgICAvLyAgICBzaW5jZSB3ZSBjaGVja2VkIHRoaXMuaG9zdG5hbWUgYWJvdmUuXG4gICAgICAgICAgLy8gMi4gSWYgYW55IG9mIGZvcmJpZGRlbkhvc3RDaGFycyBhcHBlYXJzIGluIHRoaXMuaG9zdG5hbWUsIGl0IG11c3QgaGF2ZVxuICAgICAgICAgIC8vICAgIGFsc28gZ290dGVuIGluIGR1ZSB0byB0b0FTQ0lJLiBUaGlzIGlzIHNpbmNlIGdldEhvc3RuYW1lIHdvdWxkIGhhdmVcbiAgICAgICAgICAvLyAgICBmaWx0ZXJlZCB0aGVtIG91dCBvdGhlcndpc2UuXG4gICAgICAgICAgLy8gUmF0aGVyIHRoYW4gdHJ5aW5nIHRvIGNvcnJlY3QgdGhpcyBieSBtb3ZpbmcgdGhlIG5vbi1ob3N0IHBhcnQgaW50b1xuICAgICAgICAgIC8vIHRoZSBwYXRobmFtZSBhcyB3ZSd2ZSBkb25lIGluIGdldEhvc3RuYW1lLCB0aHJvdyBhbiBleGNlcHRpb24gdG9cbiAgICAgICAgICAvLyBjb252ZXkgdGhlIHNldmVyaXR5IG9mIHRoaXMgaXNzdWUuXG4gICAgICAgICAgaWYgKHRoaXMuaG9zdG5hbWUgPT09IFwiXCIgfHwgZm9yYmlkZGVuSG9zdENoYXJzLnRlc3QodGhpcy5ob3N0bmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9VUkwodXJsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcCA9IHRoaXMucG9ydCA/IFwiOlwiICsgdGhpcy5wb3J0IDogXCJcIjtcbiAgICAgIGNvbnN0IGggPSB0aGlzLmhvc3RuYW1lIHx8IFwiXCI7XG4gICAgICB0aGlzLmhvc3QgPSBoICsgcDtcblxuICAgICAgLy8gc3RyaXAgWyBhbmQgXSBmcm9tIHRoZSBob3N0bmFtZVxuICAgICAgLy8gdGhlIGhvc3QgZmllbGQgc3RpbGwgcmV0YWlucyB0aGVtLCB0aG91Z2hcbiAgICAgIGlmIChpcHY2SG9zdG5hbWUpIHtcbiAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUuc2xpY2UoMSwgLTEpO1xuICAgICAgICBpZiAocmVzdFswXSAhPT0gXCIvXCIpIHtcbiAgICAgICAgICByZXN0ID0gXCIvXCIgKyByZXN0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTm93IHJlc3QgaXMgc2V0IHRvIHRoZSBwb3N0LWhvc3Qgc3R1ZmYuXG4gICAgLy8gQ2hvcCBvZmYgYW55IGRlbGltIGNoYXJzLlxuICAgIGlmICghdW5zYWZlUHJvdG9jb2wuaGFzKGxvd2VyUHJvdG8pKSB7XG4gICAgICAvLyBGaXJzdCwgbWFrZSAxMDAlIHN1cmUgdGhhdCBhbnkgXCJhdXRvRXNjYXBlXCIgY2hhcnMgZ2V0XG4gICAgICAvLyBlc2NhcGVkLCBldmVuIGlmIGVuY29kZVVSSUNvbXBvbmVudCBkb2Vzbid0IHRoaW5rIHRoZXlcbiAgICAgIC8vIG5lZWQgdG8gYmUuXG4gICAgICByZXN0ID0gYXV0b0VzY2FwZVN0cihyZXN0KTtcbiAgICB9XG5cbiAgICBsZXQgcXVlc3Rpb25JZHggPSAtMTtcbiAgICBsZXQgaGFzaElkeCA9IC0xO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdC5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgY29kZSA9IHJlc3QuY2hhckNvZGVBdChpKTtcbiAgICAgIGlmIChjb2RlID09PSBDSEFSX0hBU0gpIHtcbiAgICAgICAgdGhpcy5oYXNoID0gcmVzdC5zbGljZShpKTtcbiAgICAgICAgaGFzaElkeCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIGlmIChjb2RlID09PSBDSEFSX1FVRVNUSU9OX01BUksgJiYgcXVlc3Rpb25JZHggPT09IC0xKSB7XG4gICAgICAgIHF1ZXN0aW9uSWR4ID0gaTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocXVlc3Rpb25JZHggIT09IC0xKSB7XG4gICAgICBpZiAoaGFzaElkeCA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSByZXN0LnNsaWNlKHF1ZXN0aW9uSWR4KTtcbiAgICAgICAgdGhpcy5xdWVyeSA9IHJlc3Quc2xpY2UocXVlc3Rpb25JZHggKyAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gcmVzdC5zbGljZShxdWVzdGlvbklkeCwgaGFzaElkeCk7XG4gICAgICAgIHRoaXMucXVlcnkgPSByZXN0LnNsaWNlKHF1ZXN0aW9uSWR4ICsgMSwgaGFzaElkeCk7XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5xdWVyeSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAvLyBObyBxdWVyeSBzdHJpbmcsIGJ1dCBwYXJzZVF1ZXJ5U3RyaW5nIHN0aWxsIHJlcXVlc3RlZFxuICAgICAgdGhpcy5zZWFyY2ggPSBudWxsO1xuICAgICAgdGhpcy5xdWVyeSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlUXVlc3Rpb25JZHggPSBxdWVzdGlvbklkeCAhPT0gLTEgJiZcbiAgICAgIChoYXNoSWR4ID09PSAtMSB8fCBxdWVzdGlvbklkeCA8IGhhc2hJZHgpO1xuICAgIGNvbnN0IGZpcnN0SWR4ID0gdXNlUXVlc3Rpb25JZHggPyBxdWVzdGlvbklkeCA6IGhhc2hJZHg7XG4gICAgaWYgKGZpcnN0SWR4ID09PSAtMSkge1xuICAgICAgaWYgKHJlc3QubGVuZ3RoID4gMCkgdGhpcy5wYXRobmFtZSA9IHJlc3Q7XG4gICAgfSBlbHNlIGlmIChmaXJzdElkeCA+IDApIHtcbiAgICAgIHRoaXMucGF0aG5hbWUgPSByZXN0LnNsaWNlKDAsIGZpcnN0SWR4KTtcbiAgICB9XG4gICAgaWYgKHNsYXNoZWRQcm90b2NvbC5oYXMobG93ZXJQcm90bykgJiYgdGhpcy5ob3N0bmFtZSAmJiAhdGhpcy5wYXRobmFtZSkge1xuICAgICAgdGhpcy5wYXRobmFtZSA9IFwiL1wiO1xuICAgIH1cblxuICAgIC8vIFRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHRoaXMucGF0aG5hbWUgfHwgdGhpcy5zZWFyY2gpIHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLnBhdGhuYW1lIHx8IFwiXCI7XG4gICAgICBjb25zdCBzID0gdGhpcy5zZWFyY2ggfHwgXCJcIjtcbiAgICAgIHRoaXMucGF0aCA9IHAgKyBzO1xuICAgIH1cblxuICAgIC8vIEZpbmFsbHksIHJlY29uc3RydWN0IHRoZSBocmVmIGJhc2VkIG9uIHdoYXQgaGFzIGJlZW4gdmFsaWRhdGVkLlxuICAgIHRoaXMuaHJlZiA9IHRoaXMuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFVybE9iamVjdCB7XG4gIGF1dGg/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkO1xuICBoYXNoPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgaG9zdD86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG4gIGhvc3RuYW1lPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgaHJlZj86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG4gIHBhdGhuYW1lPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgcHJvdG9jb2w/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkO1xuICBzZWFyY2g/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkO1xuICBzbGFzaGVzPzogYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQ7XG4gIHBvcnQ/OiBzdHJpbmcgfCBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkO1xuICBxdWVyeT86IHN0cmluZyB8IG51bGwgfCBQYXJzZWRVcmxRdWVyeUlucHV0IHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0KFxuICB1cmxPYmplY3Q6IHN0cmluZyB8IFVSTCB8IFVybCB8IFVybE9iamVjdCxcbiAgb3B0aW9ucz86IHtcbiAgICBhdXRoOiBib29sZWFuO1xuICAgIGZyYWdtZW50OiBib29sZWFuO1xuICAgIHNlYXJjaDogYm9vbGVhbjtcbiAgICB1bmljb2RlOiBib29sZWFuO1xuICB9LFxuKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB1cmxPYmplY3QgPT09IFwic3RyaW5nXCIpIHtcbiAgICB1cmxPYmplY3QgPSBwYXJzZSh1cmxPYmplY3QsIHRydWUsIGZhbHNlKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdXJsT2JqZWN0ICE9PSBcIm9iamVjdFwiIHx8IHVybE9iamVjdCA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcbiAgICAgIFwidXJsT2JqZWN0XCIsXG4gICAgICBbXCJPYmplY3RcIiwgXCJzdHJpbmdcIl0sXG4gICAgICB1cmxPYmplY3QsXG4gICAgKTtcbiAgfSBlbHNlIGlmICghKHVybE9iamVjdCBpbnN0YW5jZW9mIFVybCkpIHtcbiAgICBpZiAodXJsT2JqZWN0IGluc3RhbmNlb2YgVVJMKSB7XG4gICAgICByZXR1cm4gZm9ybWF0V2hhdHdnKHVybE9iamVjdCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiBVcmwucHJvdG90eXBlLmZvcm1hdC5jYWxsKHVybE9iamVjdCk7XG4gIH1cblxuICByZXR1cm4gKHVybE9iamVjdCBhcyBVcmwpLmZvcm1hdCgpO1xufVxuXG4vKipcbiAqIFRoZSBVUkwgb2JqZWN0IGhhcyBib3RoIGEgYHRvU3RyaW5nKClgIG1ldGhvZCBhbmQgYGhyZWZgIHByb3BlcnR5IHRoYXQgcmV0dXJuIHN0cmluZyBzZXJpYWxpemF0aW9ucyBvZiB0aGUgVVJMLlxuICogVGhlc2UgYXJlIG5vdCwgaG93ZXZlciwgY3VzdG9taXphYmxlIGluIGFueSB3YXkuXG4gKiBUaGlzIG1ldGhvZCBhbGxvd3MgZm9yIGJhc2ljIGN1c3RvbWl6YXRpb24gb2YgdGhlIG91dHB1dC5cbiAqIEBzZWUgVGVzdGVkIGluIGBwYXJhbGxlbC90ZXN0LXVybC1mb3JtYXQtd2hhdHdnLmpzYC5cbiAqIEBwYXJhbSB1cmxPYmplY3RcbiAqIEBwYXJhbSBvcHRpb25zXG4gKiBAcGFyYW0gb3B0aW9ucy5hdXRoIGB0cnVlYCBpZiB0aGUgc2VyaWFsaXplZCBVUkwgc3RyaW5nIHNob3VsZCBpbmNsdWRlIHRoZSB1c2VybmFtZSBhbmQgcGFzc3dvcmQsIGBmYWxzZWAgb3RoZXJ3aXNlLiAqKkRlZmF1bHQqKjogYHRydWVgLlxuICogQHBhcmFtIG9wdGlvbnMuZnJhZ21lbnQgYHRydWVgIGlmIHRoZSBzZXJpYWxpemVkIFVSTCBzdHJpbmcgc2hvdWxkIGluY2x1ZGUgdGhlIGZyYWdtZW50LCBgZmFsc2VgIG90aGVyd2lzZS4gKipEZWZhdWx0Kio6IGB0cnVlYC5cbiAqIEBwYXJhbSBvcHRpb25zLnNlYXJjaCBgdHJ1ZWAgaWYgdGhlIHNlcmlhbGl6ZWQgVVJMIHN0cmluZyBzaG91bGQgaW5jbHVkZSB0aGUgc2VhcmNoIHF1ZXJ5LCAqKkRlZmF1bHQqKjogYHRydWVgLlxuICogQHBhcmFtIG9wdGlvbnMudW5pY29kZSBgdHJ1ZWAgaWYgVW5pY29kZSBjaGFyYWN0ZXJzIGFwcGVhcmluZyBpbiB0aGUgaG9zdCBjb21wb25lbnQgb2YgdGhlIFVSTCBzdHJpbmcgc2hvdWxkIGJlIGVuY29kZWQgZGlyZWN0bHkgYXMgb3Bwb3NlZCB0byBiZWluZyBQdW55Y29kZSBlbmNvZGVkLiAqKkRlZmF1bHQqKjogYGZhbHNlYC5cbiAqIEByZXR1cm5zIGEgY3VzdG9taXphYmxlIHNlcmlhbGl6YXRpb24gb2YgYSBVUkwgYFN0cmluZ2AgcmVwcmVzZW50YXRpb24gb2YgYSBgV0hBVFdHIFVSTGAgb2JqZWN0LlxuICovXG5mdW5jdGlvbiBmb3JtYXRXaGF0d2coXG4gIHVybE9iamVjdDogc3RyaW5nIHwgVVJMLFxuICBvcHRpb25zPzoge1xuICAgIGF1dGg6IGJvb2xlYW47XG4gICAgZnJhZ21lbnQ6IGJvb2xlYW47XG4gICAgc2VhcmNoOiBib29sZWFuO1xuICAgIHVuaWNvZGU6IGJvb2xlYW47XG4gIH0sXG4pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHVybE9iamVjdCA9PT0gXCJzdHJpbmdcIikge1xuICAgIHVybE9iamVjdCA9IG5ldyBVUkwodXJsT2JqZWN0KTtcbiAgfVxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwib3B0aW9uc1wiLCBcIm9iamVjdFwiLCBvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBvcHRpb25zID0ge1xuICAgIGF1dGg6IHRydWUsXG4gICAgZnJhZ21lbnQ6IHRydWUsXG4gICAgc2VhcmNoOiB0cnVlLFxuICAgIHVuaWNvZGU6IGZhbHNlLFxuICAgIC4uLm9wdGlvbnMsXG4gIH07XG5cbiAgbGV0IHJldCA9IHVybE9iamVjdC5wcm90b2NvbDtcbiAgaWYgKHVybE9iamVjdC5ob3N0ICE9PSBudWxsKSB7XG4gICAgcmV0ICs9IFwiLy9cIjtcbiAgICBjb25zdCBoYXNVc2VybmFtZSA9ICEhdXJsT2JqZWN0LnVzZXJuYW1lO1xuICAgIGNvbnN0IGhhc1Bhc3N3b3JkID0gISF1cmxPYmplY3QucGFzc3dvcmQ7XG4gICAgaWYgKG9wdGlvbnMuYXV0aCAmJiAoaGFzVXNlcm5hbWUgfHwgaGFzUGFzc3dvcmQpKSB7XG4gICAgICBpZiAoaGFzVXNlcm5hbWUpIHtcbiAgICAgICAgcmV0ICs9IHVybE9iamVjdC51c2VybmFtZTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXNQYXNzd29yZCkge1xuICAgICAgICByZXQgKz0gYDoke3VybE9iamVjdC5wYXNzd29yZH1gO1xuICAgICAgfVxuICAgICAgcmV0ICs9IFwiQFwiO1xuICAgIH1cbiAgICAvLyBUT0RPKHdhZnV3ZnUxMyk6IFN1cHBvcnQgdW5pY29kZSBvcHRpb25cbiAgICAvLyByZXQgKz0gb3B0aW9ucy51bmljb2RlID9cbiAgICAvLyAgIGRvbWFpblRvVW5pY29kZSh1cmxPYmplY3QuaG9zdCkgOiB1cmxPYmplY3QuaG9zdDtcbiAgICByZXQgKz0gdXJsT2JqZWN0Lmhvc3Q7XG4gICAgaWYgKHVybE9iamVjdC5wb3J0KSB7XG4gICAgICByZXQgKz0gYDoke3VybE9iamVjdC5wb3J0fWA7XG4gICAgfVxuICB9XG5cbiAgcmV0ICs9IHVybE9iamVjdC5wYXRobmFtZTtcblxuICBpZiAob3B0aW9ucy5zZWFyY2ggJiYgdXJsT2JqZWN0LnNlYXJjaCkge1xuICAgIHJldCArPSB1cmxPYmplY3Quc2VhcmNoO1xuICB9XG4gIGlmIChvcHRpb25zLmZyYWdtZW50ICYmIHVybE9iamVjdC5oYXNoKSB7XG4gICAgcmV0ICs9IHVybE9iamVjdC5oYXNoO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gaXNJcHY2SG9zdG5hbWUoaG9zdG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gKFxuICAgIGhvc3RuYW1lLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfTEVGVF9TUVVBUkVfQlJBQ0tFVCAmJlxuICAgIGhvc3RuYW1lLmNoYXJDb2RlQXQoaG9zdG5hbWUubGVuZ3RoIC0gMSkgPT09IENIQVJfUklHSFRfU1FVQVJFX0JSQUNLRVRcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0SG9zdG5hbWUoc2VsZjogVXJsLCByZXN0OiBzdHJpbmcsIGhvc3RuYW1lOiBzdHJpbmcpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBob3N0bmFtZS5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IGNvZGUgPSBob3N0bmFtZS5jaGFyQ29kZUF0KGkpO1xuICAgIGNvbnN0IGlzVmFsaWQgPSAoY29kZSA+PSBDSEFSX0xPV0VSQ0FTRV9BICYmIGNvZGUgPD0gQ0hBUl9MT1dFUkNBU0VfWikgfHxcbiAgICAgIGNvZGUgPT09IENIQVJfRE9UIHx8XG4gICAgICAoY29kZSA+PSBDSEFSX1VQUEVSQ0FTRV9BICYmIGNvZGUgPD0gQ0hBUl9VUFBFUkNBU0VfWikgfHxcbiAgICAgIChjb2RlID49IENIQVJfMCAmJiBjb2RlIDw9IENIQVJfOSkgfHxcbiAgICAgIGNvZGUgPT09IENIQVJfSFlQSEVOX01JTlVTIHx8XG4gICAgICBjb2RlID09PSBDSEFSX1BMVVMgfHxcbiAgICAgIGNvZGUgPT09IENIQVJfVU5ERVJTQ09SRSB8fFxuICAgICAgY29kZSA+IDEyNztcblxuICAgIC8vIEludmFsaWQgaG9zdCBjaGFyYWN0ZXJcbiAgICBpZiAoIWlzVmFsaWQpIHtcbiAgICAgIHNlbGYuaG9zdG5hbWUgPSBob3N0bmFtZS5zbGljZSgwLCBpKTtcbiAgICAgIHJldHVybiBgLyR7aG9zdG5hbWUuc2xpY2UoaSl9JHtyZXN0fWA7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN0O1xufVxuXG4vLyBFc2NhcGVkIGNoYXJhY3RlcnMuIFVzZSBlbXB0eSBzdHJpbmdzIHRvIGZpbGwgdXAgdW51c2VkIGVudHJpZXMuXG4vLyBVc2luZyBBcnJheSBpcyBmYXN0ZXIgdGhhbiBPYmplY3QvTWFwXG4vLyBkZW5vLWZtdC1pZ25vcmVcbmNvbnN0IGVzY2FwZWRDb2RlcyA9IFtcbiAgLyogMCAtIDkgKi8gXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCIlMDlcIixcbiAgLyogMTAgLSAxOSAqLyBcIiUwQVwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIiUwRFwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICAvKiAyMCAtIDI5ICovIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIC8qIDMwIC0gMzkgKi8gXCJcIixcbiAgXCJcIixcbiAgXCIlMjBcIixcbiAgXCJcIixcbiAgXCIlMjJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCIlMjdcIixcbiAgLyogNDAgLSA0OSAqLyBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICAvKiA1MCAtIDU5ICovIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIC8qIDYwIC0gNjkgKi8gXCIlM0NcIixcbiAgXCJcIixcbiAgXCIlM0VcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgLyogNzAgLSA3OSAqLyBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICAvKiA4MCAtIDg5ICovIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIC8qIDkwIC0gOTkgKi8gXCJcIixcbiAgXCJcIixcbiAgXCIlNUNcIixcbiAgXCJcIixcbiAgXCIlNUVcIixcbiAgXCJcIixcbiAgXCIlNjBcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgLyogMTAwIC0gMTA5ICovIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIC8qIDExMCAtIDExOSAqLyBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICAvKiAxMjAgLSAxMjUgKi8gXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCIlN0JcIixcbiAgXCIlN0NcIixcbiAgXCIlN0RcIlxuXTtcblxuLy8gQXV0b21hdGljYWxseSBlc2NhcGUgYWxsIGRlbGltaXRlcnMgYW5kIHVud2lzZSBjaGFyYWN0ZXJzIGZyb20gUkZDIDIzOTYuXG4vLyBBbHNvIGVzY2FwZSBzaW5nbGUgcXVvdGVzIGluIGNhc2Ugb2YgYW4gWFNTIGF0dGFjay5cbi8vIFJldHVybiB0aGUgZXNjYXBlZCBzdHJpbmcuXG5mdW5jdGlvbiBhdXRvRXNjYXBlU3RyKHJlc3Q6IHN0cmluZykge1xuICBsZXQgZXNjYXBlZCA9IFwiXCI7XG4gIGxldCBsYXN0RXNjYXBlZFBvcyA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdC5sZW5ndGg7ICsraSkge1xuICAgIC8vIGBlc2NhcGVkYCBjb250YWlucyBzdWJzdHJpbmcgdXAgdG8gdGhlIGxhc3QgZXNjYXBlZCBjaGFyYWN0ZXIuXG4gICAgY29uc3QgZXNjYXBlZENoYXIgPSBlc2NhcGVkQ29kZXNbcmVzdC5jaGFyQ29kZUF0KGkpXTtcbiAgICBpZiAoZXNjYXBlZENoYXIpIHtcbiAgICAgIC8vIENvbmNhdCBpZiB0aGVyZSBhcmUgb3JkaW5hcnkgY2hhcmFjdGVycyBpbiB0aGUgbWlkZGxlLlxuICAgICAgaWYgKGkgPiBsYXN0RXNjYXBlZFBvcykge1xuICAgICAgICBlc2NhcGVkICs9IHJlc3Quc2xpY2UobGFzdEVzY2FwZWRQb3MsIGkpO1xuICAgICAgfVxuICAgICAgZXNjYXBlZCArPSBlc2NhcGVkQ2hhcjtcbiAgICAgIGxhc3RFc2NhcGVkUG9zID0gaSArIDE7XG4gICAgfVxuICB9XG4gIGlmIChsYXN0RXNjYXBlZFBvcyA9PT0gMCkge1xuICAgIC8vIE5vdGhpbmcgaGFzIGJlZW4gZXNjYXBlZC5cbiAgICByZXR1cm4gcmVzdDtcbiAgfVxuXG4gIC8vIFRoZXJlIGFyZSBvcmRpbmFyeSBjaGFyYWN0ZXJzIGF0IHRoZSBlbmQuXG4gIGlmIChsYXN0RXNjYXBlZFBvcyA8IHJlc3QubGVuZ3RoKSB7XG4gICAgZXNjYXBlZCArPSByZXN0LnNsaWNlKGxhc3RFc2NhcGVkUG9zKTtcbiAgfVxuXG4gIHJldHVybiBlc2NhcGVkO1xufVxuXG4vKipcbiAqIFRoZSB1cmwudXJsUGFyc2UoKSBtZXRob2QgdGFrZXMgYSBVUkwgc3RyaW5nLCBwYXJzZXMgaXQsIGFuZCByZXR1cm5zIGEgVVJMIG9iamVjdC5cbiAqXG4gKiBAc2VlIFRlc3RlZCBpbiBgcGFyYWxsZWwvdGVzdC11cmwtcGFyc2UtZm9ybWF0LmpzYC5cbiAqIEBwYXJhbSB1cmwgVGhlIFVSTCBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0gcGFyc2VRdWVyeVN0cmluZyBJZiBgdHJ1ZWAsIHRoZSBxdWVyeSBwcm9wZXJ0eSB3aWxsIGFsd2F5cyBiZSBzZXQgdG8gYW4gb2JqZWN0IHJldHVybmVkIGJ5IHRoZSBxdWVyeXN0cmluZyBtb2R1bGUncyBwYXJzZSgpIG1ldGhvZC4gSWYgZmFsc2UsXG4gKiB0aGUgcXVlcnkgcHJvcGVydHkgb24gdGhlIHJldHVybmVkIFVSTCBvYmplY3Qgd2lsbCBiZSBhbiB1bnBhcnNlZCwgdW5kZWNvZGVkIHN0cmluZy4gRGVmYXVsdDogZmFsc2UuXG4gKiBAcGFyYW0gc2xhc2hlc0Rlbm90ZUhvc3QgSWYgYHRydWVgLCB0aGUgZmlyc3QgdG9rZW4gYWZ0ZXIgdGhlIGxpdGVyYWwgc3RyaW5nIC8vIGFuZCBwcmVjZWRpbmcgdGhlIG5leHQgLyB3aWxsIGJlIGludGVycHJldGVkIGFzIHRoZSBob3N0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShcbiAgdXJsOiBzdHJpbmcgfCBVcmwsXG4gIHBhcnNlUXVlcnlTdHJpbmc6IGJvb2xlYW4sXG4gIHNsYXNoZXNEZW5vdGVIb3N0OiBib29sZWFuLFxuKSB7XG4gIGlmICh1cmwgaW5zdGFuY2VvZiBVcmwpIHJldHVybiB1cmw7XG5cbiAgY29uc3QgdXJsT2JqZWN0ID0gbmV3IFVybCgpO1xuICB1cmxPYmplY3QudXJsUGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCk7XG4gIHJldHVybiB1cmxPYmplY3Q7XG59XG5cbi8qKiBUaGUgdXJsLnJlc29sdmUoKSBtZXRob2QgcmVzb2x2ZXMgYSB0YXJnZXQgVVJMIHJlbGF0aXZlIHRvIGEgYmFzZSBVUkwgaW4gYSBtYW5uZXIgc2ltaWxhciB0byB0aGF0IG9mIGEgV2ViIGJyb3dzZXIgcmVzb2x2aW5nIGFuIGFuY2hvciB0YWcgSFJFRi5cbiAqIEBzZWUgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS91cmwuaHRtbCN1cmxyZXNvbHZlZnJvbS10b1xuICogQGxlZ2FjeVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHBhcnNlKGZyb20sIGZhbHNlLCB0cnVlKS5yZXNvbHZlKHRvKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVPYmplY3Qoc291cmNlOiBzdHJpbmcgfCBVcmwsIHJlbGF0aXZlOiBzdHJpbmcpIHtcbiAgaWYgKCFzb3VyY2UpIHJldHVybiByZWxhdGl2ZTtcbiAgcmV0dXJuIHBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmVPYmplY3QocmVsYXRpdmUpO1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gZW5zdXJlcyB0aGUgY29ycmVjdCBkZWNvZGluZ3Mgb2YgcGVyY2VudC1lbmNvZGVkIGNoYXJhY3RlcnMgYXMgd2VsbCBhcyBlbnN1cmluZyBhIGNyb3NzLXBsYXRmb3JtIHZhbGlkIGFic29sdXRlIHBhdGggc3RyaW5nLlxuICogQHNlZSBUZXN0ZWQgaW4gYHBhcmFsbGVsL3Rlc3QtZmlsZXVybHRvcGF0aC5qc2AuXG4gKiBAcGFyYW0gcGF0aCBUaGUgZmlsZSBVUkwgc3RyaW5nIG9yIFVSTCBvYmplY3QgdG8gY29udmVydCB0byBhIHBhdGguXG4gKiBAcmV0dXJucyBUaGUgZnVsbHktcmVzb2x2ZWQgcGxhdGZvcm0tc3BlY2lmaWMgTm9kZS5qcyBmaWxlIHBhdGguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWxlVVJMVG9QYXRoKHBhdGg6IHN0cmluZyB8IFVSTCk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIikgcGF0aCA9IG5ldyBVUkwocGF0aCk7XG4gIGVsc2UgaWYgKCEocGF0aCBpbnN0YW5jZW9mIFVSTCkpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJwYXRoXCIsIFtcInN0cmluZ1wiLCBcIlVSTFwiXSwgcGF0aCk7XG4gIH1cbiAgaWYgKHBhdGgucHJvdG9jb2wgIT09IFwiZmlsZTpcIikge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9VUkxfU0NIRU1FKFwiZmlsZVwiKTtcbiAgfVxuICByZXR1cm4gaXNXaW5kb3dzID8gZ2V0UGF0aEZyb21VUkxXaW4ocGF0aCkgOiBnZXRQYXRoRnJvbVVSTFBvc2l4KHBhdGgpO1xufVxuXG5mdW5jdGlvbiBnZXRQYXRoRnJvbVVSTFdpbih1cmw6IFVSTCk6IHN0cmluZyB7XG4gIGNvbnN0IGhvc3RuYW1lID0gdXJsLmhvc3RuYW1lO1xuICBsZXQgcGF0aG5hbWUgPSB1cmwucGF0aG5hbWU7XG4gIGZvciAobGV0IG4gPSAwOyBuIDwgcGF0aG5hbWUubGVuZ3RoOyBuKyspIHtcbiAgICBpZiAocGF0aG5hbWVbbl0gPT09IFwiJVwiKSB7XG4gICAgICBjb25zdCB0aGlyZCA9IHBhdGhuYW1lLmNvZGVQb2ludEF0KG4gKyAyKSEgfCAweDIwO1xuICAgICAgaWYgKFxuICAgICAgICAocGF0aG5hbWVbbiArIDFdID09PSBcIjJcIiAmJiB0aGlyZCA9PT0gMTAyKSB8fCAvLyAyZiAyRiAvXG4gICAgICAgIChwYXRobmFtZVtuICsgMV0gPT09IFwiNVwiICYmIHRoaXJkID09PSA5OSkgLy8gNWMgNUMgXFxcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfRklMRV9VUkxfUEFUSChcbiAgICAgICAgICBcIm11c3Qgbm90IGluY2x1ZGUgZW5jb2RlZCBcXFxcIG9yIC8gY2hhcmFjdGVyc1wiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhdGhuYW1lID0gcGF0aG5hbWUucmVwbGFjZShmb3J3YXJkU2xhc2hSZWdFeCwgXCJcXFxcXCIpO1xuICBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXRobmFtZSk7XG4gIGlmIChob3N0bmFtZSAhPT0gXCJcIikge1xuICAgIC8vIFRPRE8oYmFydGxvbWllanUpOiBhZGQgc3VwcG9ydCBmb3IgcHVueWNvZGUgZW5jb2RpbmdzXG4gICAgcmV0dXJuIGBcXFxcXFxcXCR7aG9zdG5hbWV9JHtwYXRobmFtZX1gO1xuICB9IGVsc2Uge1xuICAgIC8vIE90aGVyd2lzZSwgaXQncyBhIGxvY2FsIHBhdGggdGhhdCByZXF1aXJlcyBhIGRyaXZlIGxldHRlclxuICAgIGNvbnN0IGxldHRlciA9IHBhdGhuYW1lLmNvZGVQb2ludEF0KDEpISB8IDB4MjA7XG4gICAgY29uc3Qgc2VwID0gcGF0aG5hbWVbMl07XG4gICAgaWYgKFxuICAgICAgbGV0dGVyIDwgQ0hBUl9MT1dFUkNBU0VfQSB8fFxuICAgICAgbGV0dGVyID4gQ0hBUl9MT1dFUkNBU0VfWiB8fCAvLyBhLi56IEEuLlpcbiAgICAgIHNlcCAhPT0gXCI6XCJcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9GSUxFX1VSTF9QQVRIKFwibXVzdCBiZSBhYnNvbHV0ZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGhuYW1lLnNsaWNlKDEpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFBhdGhGcm9tVVJMUG9zaXgodXJsOiBVUkwpOiBzdHJpbmcge1xuICBpZiAodXJsLmhvc3RuYW1lICE9PSBcIlwiKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0ZJTEVfVVJMX0hPU1Qob3NUeXBlKTtcbiAgfVxuICBjb25zdCBwYXRobmFtZSA9IHVybC5wYXRobmFtZTtcbiAgZm9yIChsZXQgbiA9IDA7IG4gPCBwYXRobmFtZS5sZW5ndGg7IG4rKykge1xuICAgIGlmIChwYXRobmFtZVtuXSA9PT0gXCIlXCIpIHtcbiAgICAgIGNvbnN0IHRoaXJkID0gcGF0aG5hbWUuY29kZVBvaW50QXQobiArIDIpISB8IDB4MjA7XG4gICAgICBpZiAocGF0aG5hbWVbbiArIDFdID09PSBcIjJcIiAmJiB0aGlyZCA9PT0gMTAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9GSUxFX1VSTF9QQVRIKFxuICAgICAgICAgIFwibXVzdCBub3QgaW5jbHVkZSBlbmNvZGVkIC8gY2hhcmFjdGVyc1wiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHBhdGhuYW1lKTtcbn1cblxuLyoqXG4gKiAgVGhlIGZvbGxvd2luZyBjaGFyYWN0ZXJzIGFyZSBwZXJjZW50LWVuY29kZWQgd2hlbiBjb252ZXJ0aW5nIGZyb20gZmlsZSBwYXRoXG4gKiAgdG8gVVJMOlxuICogIC0gJTogVGhlIHBlcmNlbnQgY2hhcmFjdGVyIGlzIHRoZSBvbmx5IGNoYXJhY3RlciBub3QgZW5jb2RlZCBieSB0aGVcbiAqICAgICAgIGBwYXRobmFtZWAgc2V0dGVyLlxuICogIC0gXFw6IEJhY2tzbGFzaCBpcyBlbmNvZGVkIG9uIG5vbi13aW5kb3dzIHBsYXRmb3JtcyBzaW5jZSBpdCdzIGEgdmFsaWRcbiAqICAgICAgIGNoYXJhY3RlciBidXQgdGhlIGBwYXRobmFtZWAgc2V0dGVycyByZXBsYWNlcyBpdCBieSBhIGZvcndhcmQgc2xhc2guXG4gKiAgLSBMRjogVGhlIG5ld2xpbmUgY2hhcmFjdGVyIGlzIHN0cmlwcGVkIG91dCBieSB0aGUgYHBhdGhuYW1lYCBzZXR0ZXIuXG4gKiAgICAgICAgKFNlZSB3aGF0d2cvdXJsIzQxOSlcbiAqICAtIENSOiBUaGUgY2FycmlhZ2UgcmV0dXJuIGNoYXJhY3RlciBpcyBhbHNvIHN0cmlwcGVkIG91dCBieSB0aGUgYHBhdGhuYW1lYFxuICogICAgICAgIHNldHRlci5cbiAqICAtIFRBQjogVGhlIHRhYiBjaGFyYWN0ZXIgaXMgYWxzbyBzdHJpcHBlZCBvdXQgYnkgdGhlIGBwYXRobmFtZWAgc2V0dGVyLlxuICovXG5mdW5jdGlvbiBlbmNvZGVQYXRoQ2hhcnMoZmlsZXBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChmaWxlcGF0aC5pbmNsdWRlcyhcIiVcIikpIHtcbiAgICBmaWxlcGF0aCA9IGZpbGVwYXRoLnJlcGxhY2UocGVyY2VudFJlZ0V4LCBcIiUyNVwiKTtcbiAgfVxuICAvLyBJbiBwb3NpeCwgYmFja3NsYXNoIGlzIGEgdmFsaWQgY2hhcmFjdGVyIGluIHBhdGhzOlxuICBpZiAoIWlzV2luZG93cyAmJiBmaWxlcGF0aC5pbmNsdWRlcyhcIlxcXFxcIikpIHtcbiAgICBmaWxlcGF0aCA9IGZpbGVwYXRoLnJlcGxhY2UoYmFja3NsYXNoUmVnRXgsIFwiJTVDXCIpO1xuICB9XG4gIGlmIChmaWxlcGF0aC5pbmNsdWRlcyhcIlxcblwiKSkge1xuICAgIGZpbGVwYXRoID0gZmlsZXBhdGgucmVwbGFjZShuZXdsaW5lUmVnRXgsIFwiJTBBXCIpO1xuICB9XG4gIGlmIChmaWxlcGF0aC5pbmNsdWRlcyhcIlxcclwiKSkge1xuICAgIGZpbGVwYXRoID0gZmlsZXBhdGgucmVwbGFjZShjYXJyaWFnZVJldHVyblJlZ0V4LCBcIiUwRFwiKTtcbiAgfVxuICBpZiAoZmlsZXBhdGguaW5jbHVkZXMoXCJcXHRcIikpIHtcbiAgICBmaWxlcGF0aCA9IGZpbGVwYXRoLnJlcGxhY2UodGFiUmVnRXgsIFwiJTA5XCIpO1xuICB9XG4gIHJldHVybiBmaWxlcGF0aDtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGVuc3VyZXMgdGhhdCBgZmlsZXBhdGhgIGlzIHJlc29sdmVkIGFic29sdXRlbHksIGFuZCB0aGF0IHRoZSBVUkwgY29udHJvbCBjaGFyYWN0ZXJzIGFyZSBjb3JyZWN0bHkgZW5jb2RlZCB3aGVuIGNvbnZlcnRpbmcgaW50byBhIEZpbGUgVVJMLlxuICogQHNlZSBUZXN0ZWQgaW4gYHBhcmFsbGVsL3Rlc3QtdXJsLXBhdGh0b2ZpbGV1cmwuanNgLlxuICogQHBhcmFtIGZpbGVwYXRoIFRoZSBmaWxlIHBhdGggc3RyaW5nIHRvIGNvbnZlcnQgdG8gYSBmaWxlIFVSTC5cbiAqIEByZXR1cm5zIFRoZSBmaWxlIFVSTCBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRoVG9GaWxlVVJMKGZpbGVwYXRoOiBzdHJpbmcpOiBVUkwge1xuICBjb25zdCBvdXRVUkwgPSBuZXcgVVJMKFwiZmlsZTovL1wiKTtcbiAgaWYgKGlzV2luZG93cyAmJiBmaWxlcGF0aC5zdGFydHNXaXRoKFwiXFxcXFxcXFxcIikpIHtcbiAgICAvLyBVTkMgcGF0aCBmb3JtYXQ6IFxcXFxzZXJ2ZXJcXHNoYXJlXFxyZXNvdXJjZVxuICAgIGNvbnN0IHBhdGhzID0gZmlsZXBhdGguc3BsaXQoXCJcXFxcXCIpO1xuICAgIGlmIChwYXRocy5sZW5ndGggPD0gMykge1xuICAgICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19WQUxVRShcbiAgICAgICAgXCJmaWxlcGF0aFwiLFxuICAgICAgICBmaWxlcGF0aCxcbiAgICAgICAgXCJNaXNzaW5nIFVOQyByZXNvdXJjZSBwYXRoXCIsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBob3N0bmFtZSA9IHBhdGhzWzJdO1xuICAgIGlmIChob3N0bmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXG4gICAgICAgIFwiZmlsZXBhdGhcIixcbiAgICAgICAgZmlsZXBhdGgsXG4gICAgICAgIFwiRW1wdHkgVU5DIHNlcnZlcm5hbWVcIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gVE9ETyh3YWZ1d2FmdTEzKTogVG8gYmUgYG91dFVSTC5ob3N0bmFtZSA9IGRvbWFpblRvQVNDSUkoaG9zdG5hbWUpYCBvbmNlIGBkb21haW5Ub0FTQ0lJYCBhcmUgaW1wbGVtZW50ZWRcbiAgICBvdXRVUkwuaG9zdG5hbWUgPSBob3N0bmFtZTtcbiAgICBvdXRVUkwucGF0aG5hbWUgPSBlbmNvZGVQYXRoQ2hhcnMocGF0aHMuc2xpY2UoMykuam9pbihcIi9cIikpO1xuICB9IGVsc2Uge1xuICAgIGxldCByZXNvbHZlZCA9IHBhdGgucmVzb2x2ZShmaWxlcGF0aCk7XG4gICAgLy8gcGF0aC5yZXNvbHZlIHN0cmlwcyB0cmFpbGluZyBzbGFzaGVzIHNvIHdlIG11c3QgYWRkIHRoZW0gYmFja1xuICAgIGNvbnN0IGZpbGVQYXRoTGFzdCA9IGZpbGVwYXRoLmNoYXJDb2RlQXQoZmlsZXBhdGgubGVuZ3RoIC0gMSk7XG4gICAgaWYgKFxuICAgICAgKGZpbGVQYXRoTGFzdCA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIIHx8XG4gICAgICAgIChpc1dpbmRvd3MgJiYgZmlsZVBhdGhMYXN0ID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSkgJiZcbiAgICAgIHJlc29sdmVkW3Jlc29sdmVkLmxlbmd0aCAtIDFdICE9PSBwYXRoLnNlcFxuICAgICkge1xuICAgICAgcmVzb2x2ZWQgKz0gXCIvXCI7XG4gICAgfVxuXG4gICAgb3V0VVJMLnBhdGhuYW1lID0gZW5jb2RlUGF0aENoYXJzKHJlc29sdmVkKTtcbiAgfVxuICByZXR1cm4gb3V0VVJMO1xufVxuXG5pbnRlcmZhY2UgSHR0cE9wdGlvbnMge1xuICBwcm90b2NvbDogc3RyaW5nO1xuICBob3N0bmFtZTogc3RyaW5nO1xuICBoYXNoOiBzdHJpbmc7XG4gIHNlYXJjaDogc3RyaW5nO1xuICBwYXRobmFtZTogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIGhyZWY6IHN0cmluZztcbiAgcG9ydD86IG51bWJlcjtcbiAgYXV0aD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGlzIHV0aWxpdHkgZnVuY3Rpb24gY29udmVydHMgYSBVUkwgb2JqZWN0IGludG8gYW4gb3JkaW5hcnkgb3B0aW9ucyBvYmplY3QgYXMgZXhwZWN0ZWQgYnkgdGhlIGBodHRwLnJlcXVlc3QoKWAgYW5kIGBodHRwcy5yZXF1ZXN0KClgIEFQSXMuXG4gKiBAc2VlIFRlc3RlZCBpbiBgcGFyYWxsZWwvdGVzdC11cmwtdXJsdG9vcHRpb25zLmpzYC5cbiAqIEBwYXJhbSB1cmwgVGhlIGBXSEFUV0cgVVJMYCBvYmplY3QgdG8gY29udmVydCB0byBhbiBvcHRpb25zIG9iamVjdC5cbiAqIEByZXR1cm5zIEh0dHBPcHRpb25zXG4gKiBAcmV0dXJucyBIdHRwT3B0aW9ucy5wcm90b2NvbCBQcm90b2NvbCB0byB1c2UuXG4gKiBAcmV0dXJucyBIdHRwT3B0aW9ucy5ob3N0bmFtZSBBIGRvbWFpbiBuYW1lIG9yIElQIGFkZHJlc3Mgb2YgdGhlIHNlcnZlciB0byBpc3N1ZSB0aGUgcmVxdWVzdCB0by5cbiAqIEByZXR1cm5zIEh0dHBPcHRpb25zLmhhc2ggVGhlIGZyYWdtZW50IHBvcnRpb24gb2YgdGhlIFVSTC5cbiAqIEByZXR1cm5zIEh0dHBPcHRpb25zLnNlYXJjaCBUaGUgc2VyaWFsaXplZCBxdWVyeSBwb3J0aW9uIG9mIHRoZSBVUkwuXG4gKiBAcmV0dXJucyBIdHRwT3B0aW9ucy5wYXRobmFtZSBUaGUgcGF0aCBwb3J0aW9uIG9mIHRoZSBVUkwuXG4gKiBAcmV0dXJucyBIdHRwT3B0aW9ucy5wYXRoIFJlcXVlc3QgcGF0aC4gU2hvdWxkIGluY2x1ZGUgcXVlcnkgc3RyaW5nIGlmIGFueS4gRS5HLiBgJy9pbmRleC5odG1sP3BhZ2U9MTInYC4gQW4gZXhjZXB0aW9uIGlzIHRocm93biB3aGVuIHRoZSByZXF1ZXN0IHBhdGggY29udGFpbnMgaWxsZWdhbCBjaGFyYWN0ZXJzLiBDdXJyZW50bHksIG9ubHkgc3BhY2VzIGFyZSByZWplY3RlZCBidXQgdGhhdCBtYXkgY2hhbmdlIGluIHRoZSBmdXR1cmUuXG4gKiBAcmV0dXJucyBIdHRwT3B0aW9ucy5ocmVmIFRoZSBzZXJpYWxpemVkIFVSTC5cbiAqIEByZXR1cm5zIEh0dHBPcHRpb25zLnBvcnQgUG9ydCBvZiByZW1vdGUgc2VydmVyLlxuICogQHJldHVybnMgSHR0cE9wdGlvbnMuYXV0aCBCYXNpYyBhdXRoZW50aWNhdGlvbiBpLmUuIGAndXNlcjpwYXNzd29yZCdgIHRvIGNvbXB1dGUgYW4gQXV0aG9yaXphdGlvbiBoZWFkZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cmxUb0h0dHBPcHRpb25zKHVybDogVVJMKTogSHR0cE9wdGlvbnMge1xuICBjb25zdCBvcHRpb25zOiBIdHRwT3B0aW9ucyA9IHtcbiAgICBwcm90b2NvbDogdXJsLnByb3RvY29sLFxuICAgIGhvc3RuYW1lOiB0eXBlb2YgdXJsLmhvc3RuYW1lID09PSBcInN0cmluZ1wiICYmIHVybC5ob3N0bmFtZS5zdGFydHNXaXRoKFwiW1wiKVxuICAgICAgPyB1cmwuaG9zdG5hbWUuc2xpY2UoMSwgLTEpXG4gICAgICA6IHVybC5ob3N0bmFtZSxcbiAgICBoYXNoOiB1cmwuaGFzaCxcbiAgICBzZWFyY2g6IHVybC5zZWFyY2gsXG4gICAgcGF0aG5hbWU6IHVybC5wYXRobmFtZSxcbiAgICBwYXRoOiBgJHt1cmwucGF0aG5hbWUgfHwgXCJcIn0ke3VybC5zZWFyY2ggfHwgXCJcIn1gLFxuICAgIGhyZWY6IHVybC5ocmVmLFxuICB9O1xuICBpZiAodXJsLnBvcnQgIT09IFwiXCIpIHtcbiAgICBvcHRpb25zLnBvcnQgPSBOdW1iZXIodXJsLnBvcnQpO1xuICB9XG4gIGlmICh1cmwudXNlcm5hbWUgfHwgdXJsLnBhc3N3b3JkKSB7XG4gICAgb3B0aW9ucy5hdXRoID0gYCR7ZGVjb2RlVVJJQ29tcG9uZW50KHVybC51c2VybmFtZSl9OiR7XG4gICAgICBkZWNvZGVVUklDb21wb25lbnQoXG4gICAgICAgIHVybC5wYXNzd29yZCxcbiAgICAgIClcbiAgICB9YDtcbiAgfVxuICByZXR1cm4gb3B0aW9ucztcbn1cblxuY29uc3QgVVJMU2VhcmNoUGFyYW1zXyA9IFVSTFNlYXJjaFBhcmFtcztcbmV4cG9ydCB7IFVSTFNlYXJjaFBhcmFtc18gYXMgVVJMU2VhcmNoUGFyYW1zIH07XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgcGFyc2UsXG4gIGZvcm1hdCxcbiAgcmVzb2x2ZSxcbiAgcmVzb2x2ZU9iamVjdCxcbiAgZmlsZVVSTFRvUGF0aCxcbiAgcGF0aFRvRmlsZVVSTCxcbiAgdXJsVG9IdHRwT3B0aW9ucyxcbiAgVXJsLFxuICBVUkwsXG4gIFVSTFNlYXJjaFBhcmFtcyxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7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