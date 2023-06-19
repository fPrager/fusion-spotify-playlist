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
import { nextTick } from "./_next_tick.ts";
import { customPromisifyArgs } from "./internal/util.mjs";
import { validateBoolean, validateFunction, validateNumber, validateOneOf, validateString } from "./internal/validators.mjs";
import { isIP } from "./internal/net.ts";
import { emitInvalidHostnameWarning, getDefaultResolver, getDefaultVerbatim, isFamily, isLookupCallback, isLookupOptions, isResolveCallback, Resolver as CallbackResolver, setDefaultResolver, setDefaultResultOrder, validateHints } from "./internal/dns/utils.ts";
import promisesBase from "./internal/dns/promises.ts";
import { dnsException, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE } from "./internal/errors.ts";
import { AI_ADDRCONFIG as ADDRCONFIG, AI_ALL as ALL, AI_V4MAPPED as V4MAPPED } from "./internal_binding/ares.ts";
import { getaddrinfo, GetAddrInfoReqWrap, QueryReqWrap } from "./internal_binding/cares_wrap.ts";
import { toASCII } from "./internal/idna.ts";
import { notImplemented } from "./_utils.ts";
function onlookup(err, addresses) {
    if (err) {
        return this.callback(dnsException(err, "getaddrinfo", this.hostname));
    }
    this.callback(null, addresses[0], this.family || isIP(addresses[0]));
}
function onlookupall(err, addresses) {
    if (err) {
        return this.callback(dnsException(err, "getaddrinfo", this.hostname));
    }
    const family = this.family;
    const parsedAddresses = [];
    for(let i = 0; i < addresses.length; i++){
        const addr = addresses[i];
        parsedAddresses[i] = {
            address: addr,
            family: family || isIP(addr)
        };
    }
    this.callback(null, parsedAddresses);
}
const validFamilies = [
    0,
    4,
    6
];
export function lookup(hostname, options, callback) {
    let hints = 0;
    let family = 0;
    let all = false;
    let verbatim = getDefaultVerbatim();
    // Parse arguments
    if (hostname) {
        validateString(hostname, "hostname");
    }
    if (isLookupCallback(options)) {
        callback = options;
        family = 0;
    } else if (isFamily(options)) {
        validateFunction(callback, "callback");
        validateOneOf(options, "family", validFamilies);
        family = options;
    } else if (!isLookupOptions(options)) {
        validateFunction(arguments.length === 2 ? options : callback, "callback");
        throw new ERR_INVALID_ARG_TYPE("options", [
            "integer",
            "object"
        ], options);
    } else {
        validateFunction(callback, "callback");
        if (options?.hints != null) {
            validateNumber(options.hints, "options.hints");
            hints = options.hints >>> 0;
            validateHints(hints);
        }
        if (options?.family != null) {
            validateOneOf(options.family, "options.family", validFamilies);
            family = options.family;
        }
        if (options?.all != null) {
            validateBoolean(options.all, "options.all");
            all = options.all;
        }
        if (options?.verbatim != null) {
            validateBoolean(options.verbatim, "options.verbatim");
            verbatim = options.verbatim;
        }
    }
    if (!hostname) {
        emitInvalidHostnameWarning(hostname);
        if (all) {
            nextTick(callback, null, []);
        } else {
            nextTick(callback, null, null, family === 6 ? 6 : 4);
        }
        return {};
    }
    const matchedFamily = isIP(hostname);
    if (matchedFamily) {
        if (all) {
            nextTick(callback, null, [
                {
                    address: hostname,
                    family: matchedFamily
                }
            ]);
        } else {
            nextTick(callback, null, hostname, matchedFamily);
        }
        return {};
    }
    const req = new GetAddrInfoReqWrap();
    req.callback = callback;
    req.family = family;
    req.hostname = hostname;
    req.oncomplete = all ? onlookupall : onlookup;
    const err = getaddrinfo(req, toASCII(hostname), family, hints, verbatim);
    if (err) {
        nextTick(callback, dnsException(err, "getaddrinfo", hostname));
        return {};
    }
    return req;
}
Object.defineProperty(lookup, customPromisifyArgs, {
    value: [
        "address",
        "family"
    ],
    enumerable: false
});
function onresolve(err, records, ttls) {
    if (err) {
        this.callback(dnsException(err, this.bindingName, this.hostname));
        return;
    }
    const parsedRecords = ttls && this.ttl ? records.map((address, index)=>({
            address,
            ttl: ttls[index]
        })) : records;
    this.callback(null, parsedRecords);
}
function resolver(bindingName) {
    function query(name, options, callback) {
        if (isResolveCallback(options)) {
            callback = options;
            options = {};
        }
        validateString(name, "name");
        validateFunction(callback, "callback");
        const req = new QueryReqWrap();
        req.bindingName = bindingName;
        req.callback = callback;
        req.hostname = name;
        req.oncomplete = onresolve;
        if (options && options.ttl) {
            notImplemented("dns.resolve* with ttl option");
        }
        req.ttl = !!(options && options.ttl);
        const err = this._handle[bindingName](req, toASCII(name));
        if (err) {
            throw dnsException(err, bindingName, name);
        }
        return req;
    }
    Object.defineProperty(query, "name", {
        value: bindingName
    });
    return query;
}
const resolveMap = Object.create(null);
export class Resolver extends CallbackResolver {
    constructor(options){
        super(options);
    }
}
Resolver.prototype.resolveAny = resolveMap.ANY = resolver("queryAny");
Resolver.prototype.resolve4 = resolveMap.A = resolver("queryA");
Resolver.prototype.resolve6 = resolveMap.AAAA = resolver("queryAaaa");
Resolver.prototype.resolveCaa = resolveMap.CAA = resolver("queryCaa");
Resolver.prototype.resolveCname = resolveMap.CNAME = resolver("queryCname");
Resolver.prototype.resolveMx = resolveMap.MX = resolver("queryMx");
Resolver.prototype.resolveNs = resolveMap.NS = resolver("queryNs");
Resolver.prototype.resolveTxt = resolveMap.TXT = resolver("queryTxt");
Resolver.prototype.resolveSrv = resolveMap.SRV = resolver("querySrv");
Resolver.prototype.resolvePtr = resolveMap.PTR = resolver("queryPtr");
Resolver.prototype.resolveNaptr = resolveMap.NAPTR = resolver("queryNaptr");
Resolver.prototype.resolveSoa = resolveMap.SOA = resolver("querySoa");
Resolver.prototype.reverse = resolver("getHostByAddr");
Resolver.prototype.resolve = _resolve;
function _resolve(hostname, rrtype, callback) {
    let resolver;
    if (typeof hostname !== "string") {
        throw new ERR_INVALID_ARG_TYPE("name", "string", hostname);
    }
    if (typeof rrtype === "string") {
        resolver = resolveMap[rrtype];
    } else if (typeof rrtype === "function") {
        resolver = resolveMap.A;
        callback = rrtype;
    } else {
        throw new ERR_INVALID_ARG_TYPE("rrtype", "string", rrtype);
    }
    if (typeof resolver === "function") {
        return Reflect.apply(resolver, this, [
            hostname,
            callback
        ]);
    }
    throw new ERR_INVALID_ARG_VALUE("rrtype", rrtype);
}
/**
 * Sets the IP address and port of servers to be used when performing DNS
 * resolution. The `servers` argument is an array of [RFC 5952](https://tools.ietf.org/html/rfc5952#section-6) formatted
 * addresses. If the port is the IANA default DNS port (53) it can be omitted.
 *
 * ```js
 * dns.setServers([
 *   '4.4.4.4',
 *   '[2001:4860:4860::8888]',
 *   '4.4.4.4:1053',
 *   '[2001:4860:4860::8888]:1053',
 * ]);
 * ```
 *
 * An error will be thrown if an invalid address is provided.
 *
 * The `dns.setServers()` method must not be called while a DNS query is in
 * progress.
 *
 * The `setServers` method affects only `resolve`,`dns.resolve*()` and `reverse` (and specifically _not_ `lookup`).
 *
 * This method works much like [resolve.conf](https://man7.org/linux/man-pages/man5/resolv.conf.5.html).
 * That is, if attempting to resolve with the first server provided results in a
 * `NOTFOUND` error, the `resolve()` method will _not_ attempt to resolve with
 * subsequent servers provided. Fallback DNS servers will only be used if the
 * earlier ones time out or result in some other error.
 *
 * @param servers array of `RFC 5952` formatted addresses
 */ export function setServers(servers) {
    const resolver = new Resolver();
    resolver.setServers(servers);
    setDefaultResolver(resolver);
}
// The Node implementation uses `bindDefaultResolver` to set the follow methods
// on `module.exports` bound to the current `defaultResolver`. We don't have
// the same ability in ESM but can simulate this (at some cost) by explicitly
// exporting these methods which dynamically bind to the default resolver when
// called.
/**
 * Returns an array of IP address strings, formatted according to [RFC 5952](https://tools.ietf.org/html/rfc5952#section-6),
 * that are currently configured for DNS resolution. A string will include a port
 * section if a custom port is used.
 *
 * ```js
 * [
 *   '4.4.4.4',
 *   '2001:4860:4860::8888',
 *   '4.4.4.4:1053',
 *   '[2001:4860:4860::8888]:1053',
 * ]
 * ```
 */ export function getServers() {
    return Resolver.prototype.getServers.bind(getDefaultResolver())();
}
export function resolveAny(...args) {
    return Resolver.prototype.resolveAny.bind(getDefaultResolver())(...args);
}
export function resolve4(hostname, options, callback) {
    return Resolver.prototype.resolve4.bind(getDefaultResolver())(hostname, options, callback);
}
export function resolve6(hostname, options, callback) {
    return Resolver.prototype.resolve6.bind(getDefaultResolver())(hostname, options, callback);
}
export function resolveCaa(...args) {
    return Resolver.prototype.resolveCaa.bind(getDefaultResolver())(...args);
}
export function resolveCname(...args) {
    return Resolver.prototype.resolveCname.bind(getDefaultResolver())(...args);
}
export function resolveMx(...args) {
    return Resolver.prototype.resolveMx.bind(getDefaultResolver())(...args);
}
export function resolveNs(...args) {
    return Resolver.prototype.resolveNs.bind(getDefaultResolver())(...args);
}
export function resolveTxt(...args) {
    return Resolver.prototype.resolveTxt.bind(getDefaultResolver())(...args);
}
export function resolveSrv(...args) {
    return Resolver.prototype.resolveSrv.bind(getDefaultResolver())(...args);
}
export function resolvePtr(...args) {
    return Resolver.prototype.resolvePtr.bind(getDefaultResolver())(...args);
}
export function resolveNaptr(...args) {
    return Resolver.prototype.resolveNaptr.bind(getDefaultResolver())(...args);
}
export function resolveSoa(...args) {
    return Resolver.prototype.resolveSoa.bind(getDefaultResolver())(...args);
}
export function reverse(...args) {
    return Resolver.prototype.reverse.bind(getDefaultResolver())(...args);
}
export function resolve(hostname, rrtype, callback) {
    return Resolver.prototype.resolve.bind(getDefaultResolver())(hostname, rrtype, callback);
}
// ERROR CODES
export const NODATA = "ENODATA";
export const FORMERR = "EFORMERR";
export const SERVFAIL = "ESERVFAIL";
export const NOTFOUND = "ENOTFOUND";
export const NOTIMP = "ENOTIMP";
export const REFUSED = "EREFUSED";
export const BADQUERY = "EBADQUERY";
export const BADNAME = "EBADNAME";
export const BADFAMILY = "EBADFAMILY";
export const BADRESP = "EBADRESP";
export const CONNREFUSED = "ECONNREFUSED";
export const TIMEOUT = "ETIMEOUT";
export const EOF = "EOF";
export const FILE = "EFILE";
export const NOMEM = "ENOMEM";
export const DESTRUCTION = "EDESTRUCTION";
export const BADSTR = "EBADSTR";
export const BADFLAGS = "EBADFLAGS";
export const NONAME = "ENONAME";
export const BADHINTS = "EBADHINTS";
export const NOTINITIALIZED = "ENOTINITIALIZED";
export const LOADIPHLPAPI = "ELOADIPHLPAPI";
export const ADDRGETNETWORKPARAMS = "EADDRGETNETWORKPARAMS";
export const CANCELLED = "ECANCELLED";
const promises = {
    ...promisesBase,
    setDefaultResultOrder,
    setServers,
    // ERROR CODES
    NODATA,
    FORMERR,
    SERVFAIL,
    NOTFOUND,
    NOTIMP,
    REFUSED,
    BADQUERY,
    BADNAME,
    BADFAMILY,
    BADRESP,
    CONNREFUSED,
    TIMEOUT,
    EOF,
    FILE,
    NOMEM,
    DESTRUCTION,
    BADSTR,
    BADFLAGS,
    NONAME,
    BADHINTS,
    NOTINITIALIZED,
    LOADIPHLPAPI,
    ADDRGETNETWORKPARAMS,
    CANCELLED
};
export { ADDRCONFIG, ALL, promises, setDefaultResultOrder, V4MAPPED };
export default {
    ADDRCONFIG,
    ALL,
    V4MAPPED,
    lookup,
    getServers,
    resolveAny,
    resolve4,
    resolve6,
    resolveCaa,
    resolveCname,
    resolveMx,
    resolveNs,
    resolveTxt,
    resolveSrv,
    resolvePtr,
    resolveNaptr,
    resolveSoa,
    resolve,
    Resolver,
    reverse,
    setServers,
    setDefaultResultOrder,
    promises,
    NODATA,
    FORMERR,
    SERVFAIL,
    NOTFOUND,
    NOTIMP,
    REFUSED,
    BADQUERY,
    BADNAME,
    BADFAMILY,
    BADRESP,
    CONNREFUSED,
    TIMEOUT,
    EOF,
    FILE,
    NOMEM,
    DESTRUCTION,
    BADSTR,
    BADFLAGS,
    NONAME,
    BADHINTS,
    NOTINITIALIZED,
    LOADIPHLPAPI,
    ADDRGETNETWORKPARAMS,
    CANCELLED
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvZG5zLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi9fbmV4dF90aWNrLnRzXCI7XG5pbXBvcnQgeyBjdXN0b21Qcm9taXNpZnlBcmdzIH0gZnJvbSBcIi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcbmltcG9ydCB7XG4gIHZhbGlkYXRlQm9vbGVhbixcbiAgdmFsaWRhdGVGdW5jdGlvbixcbiAgdmFsaWRhdGVOdW1iZXIsXG4gIHZhbGlkYXRlT25lT2YsXG4gIHZhbGlkYXRlU3RyaW5nLFxufSBmcm9tIFwiLi9pbnRlcm5hbC92YWxpZGF0b3JzLm1qc1wiO1xuaW1wb3J0IHsgaXNJUCB9IGZyb20gXCIuL2ludGVybmFsL25ldC50c1wiO1xuaW1wb3J0IHtcbiAgZW1pdEludmFsaWRIb3N0bmFtZVdhcm5pbmcsXG4gIGdldERlZmF1bHRSZXNvbHZlcixcbiAgZ2V0RGVmYXVsdFZlcmJhdGltLFxuICBpc0ZhbWlseSxcbiAgaXNMb29rdXBDYWxsYmFjayxcbiAgaXNMb29rdXBPcHRpb25zLFxuICBpc1Jlc29sdmVDYWxsYmFjayxcbiAgUmVzb2x2ZXIgYXMgQ2FsbGJhY2tSZXNvbHZlcixcbiAgc2V0RGVmYXVsdFJlc29sdmVyLFxuICBzZXREZWZhdWx0UmVzdWx0T3JkZXIsXG4gIHZhbGlkYXRlSGludHMsXG59IGZyb20gXCIuL2ludGVybmFsL2Rucy91dGlscy50c1wiO1xuaW1wb3J0IHR5cGUge1xuICBBbnlBYWFhUmVjb3JkLFxuICBBbnlBUmVjb3JkLFxuICBBbnlDbmFtZVJlY29yZCxcbiAgQW55TXhSZWNvcmQsXG4gIEFueU5hcHRyUmVjb3JkLFxuICBBbnlOc1JlY29yZCxcbiAgQW55UHRyUmVjb3JkLFxuICBBbnlSZWNvcmQsXG4gIEFueVNvYVJlY29yZCxcbiAgQW55U3J2UmVjb3JkLFxuICBBbnlUeHRSZWNvcmQsXG4gIENhYVJlY29yZCxcbiAgTG9va3VwQWRkcmVzcyxcbiAgTG9va3VwQWxsT3B0aW9ucyxcbiAgTG9va3VwT25lT3B0aW9ucyxcbiAgTG9va3VwT3B0aW9ucyxcbiAgTXhSZWNvcmQsXG4gIE5hcHRyUmVjb3JkLFxuICBSZWNvcmRzLFxuICBSZWNvcmRXaXRoVHRsLFxuICBSZXNvbHZlQ2FsbGJhY2ssXG4gIFJlc29sdmVPcHRpb25zLFxuICBSZXNvbHZlck9wdGlvbnMsXG4gIFJlc29sdmVXaXRoVHRsT3B0aW9ucyxcbiAgU29hUmVjb3JkLFxuICBTcnZSZWNvcmQsXG59IGZyb20gXCIuL2ludGVybmFsL2Rucy91dGlscy50c1wiO1xuaW1wb3J0IHByb21pc2VzQmFzZSBmcm9tIFwiLi9pbnRlcm5hbC9kbnMvcHJvbWlzZXMudHNcIjtcbmltcG9ydCB0eXBlIHsgRXJybm9FeGNlcHRpb24gfSBmcm9tIFwiLi9pbnRlcm5hbC9lcnJvcnMudHNcIjtcbmltcG9ydCB7XG4gIGRuc0V4Y2VwdGlvbixcbiAgRVJSX0lOVkFMSURfQVJHX1RZUEUsXG4gIEVSUl9JTlZBTElEX0FSR19WQUxVRSxcbn0gZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQge1xuICBBSV9BRERSQ09ORklHIGFzIEFERFJDT05GSUcsXG4gIEFJX0FMTCBhcyBBTEwsXG4gIEFJX1Y0TUFQUEVEIGFzIFY0TUFQUEVELFxufSBmcm9tIFwiLi9pbnRlcm5hbF9iaW5kaW5nL2FyZXMudHNcIjtcbmltcG9ydCB7XG4gIENoYW5uZWxXcmFwUXVlcnksXG4gIGdldGFkZHJpbmZvLFxuICBHZXRBZGRySW5mb1JlcVdyYXAsXG4gIFF1ZXJ5UmVxV3JhcCxcbn0gZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy9jYXJlc193cmFwLnRzXCI7XG5pbXBvcnQgeyB0b0FTQ0lJIH0gZnJvbSBcIi4vaW50ZXJuYWwvaWRuYS50c1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcblxuZnVuY3Rpb24gb25sb29rdXAoXG4gIHRoaXM6IEdldEFkZHJJbmZvUmVxV3JhcCxcbiAgZXJyOiBudW1iZXIgfCBudWxsLFxuICBhZGRyZXNzZXM6IHN0cmluZ1tdLFxuKSB7XG4gIGlmIChlcnIpIHtcbiAgICByZXR1cm4gdGhpcy5jYWxsYmFjayhkbnNFeGNlcHRpb24oZXJyLCBcImdldGFkZHJpbmZvXCIsIHRoaXMuaG9zdG5hbWUpKTtcbiAgfVxuXG4gIHRoaXMuY2FsbGJhY2sobnVsbCwgYWRkcmVzc2VzWzBdLCB0aGlzLmZhbWlseSB8fCBpc0lQKGFkZHJlc3Nlc1swXSkpO1xufVxuXG5mdW5jdGlvbiBvbmxvb2t1cGFsbChcbiAgdGhpczogR2V0QWRkckluZm9SZXFXcmFwLFxuICBlcnI6IG51bWJlciB8IG51bGwsXG4gIGFkZHJlc3Nlczogc3RyaW5nW10sXG4pIHtcbiAgaWYgKGVycikge1xuICAgIHJldHVybiB0aGlzLmNhbGxiYWNrKGRuc0V4Y2VwdGlvbihlcnIsIFwiZ2V0YWRkcmluZm9cIiwgdGhpcy5ob3N0bmFtZSkpO1xuICB9XG5cbiAgY29uc3QgZmFtaWx5ID0gdGhpcy5mYW1pbHk7XG4gIGNvbnN0IHBhcnNlZEFkZHJlc3NlcyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkcmVzc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYWRkciA9IGFkZHJlc3Nlc1tpXTtcbiAgICBwYXJzZWRBZGRyZXNzZXNbaV0gPSB7XG4gICAgICBhZGRyZXNzOiBhZGRyLFxuICAgICAgZmFtaWx5OiBmYW1pbHkgfHwgaXNJUChhZGRyKSxcbiAgICB9O1xuICB9XG5cbiAgdGhpcy5jYWxsYmFjayhudWxsLCBwYXJzZWRBZGRyZXNzZXMpO1xufVxuXG50eXBlIExvb2t1cENhbGxiYWNrID0gKFxuICBlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCxcbiAgYWRkcmVzc09yQWRkcmVzc2VzPzogc3RyaW5nIHwgTG9va3VwQWRkcmVzc1tdIHwgbnVsbCxcbiAgZmFtaWx5PzogbnVtYmVyLFxuKSA9PiB2b2lkO1xuXG5jb25zdCB2YWxpZEZhbWlsaWVzID0gWzAsIDQsIDZdO1xuXG4vLyBFYXN5IEROUyBBL0FBQUEgbG9vayB1cFxuLy8gbG9va3VwKGhvc3RuYW1lLCBbb3B0aW9ucyxdIGNhbGxiYWNrKVxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgZmFtaWx5OiBudW1iZXIsXG4gIGNhbGxiYWNrOiAoXG4gICAgZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsXG4gICAgYWRkcmVzczogc3RyaW5nLFxuICAgIGZhbWlseTogbnVtYmVyLFxuICApID0+IHZvaWQsXG4pOiBHZXRBZGRySW5mb1JlcVdyYXAgfCBSZWNvcmQ8c3RyaW5nLCBuZXZlcj47XG5leHBvcnQgZnVuY3Rpb24gbG9va3VwKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBMb29rdXBPbmVPcHRpb25zLFxuICBjYWxsYmFjazogKFxuICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgIGFkZHJlc3M6IHN0cmluZyxcbiAgICBmYW1pbHk6IG51bWJlcixcbiAgKSA9PiB2b2lkLFxuKTogR2V0QWRkckluZm9SZXFXcmFwIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogTG9va3VwQWxsT3B0aW9ucyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBMb29rdXBBZGRyZXNzW10pID0+IHZvaWQsXG4pOiBHZXRBZGRySW5mb1JlcVdyYXAgfCBSZWNvcmQ8c3RyaW5nLCBuZXZlcj47XG5leHBvcnQgZnVuY3Rpb24gbG9va3VwKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBMb29rdXBPcHRpb25zLFxuICBjYWxsYmFjazogKFxuICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgIGFkZHJlc3M6IHN0cmluZyB8IExvb2t1cEFkZHJlc3NbXSxcbiAgICBmYW1pbHk6IG51bWJlcixcbiAgKSA9PiB2b2lkLFxuKTogR2V0QWRkckluZm9SZXFXcmFwIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChcbiAgICBlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCxcbiAgICBhZGRyZXNzOiBzdHJpbmcsXG4gICAgZmFtaWx5OiBudW1iZXIsXG4gICkgPT4gdm9pZCxcbik6IEdldEFkZHJJbmZvUmVxV3JhcCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPjtcbmV4cG9ydCBmdW5jdGlvbiBsb29rdXAoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IHVua25vd24sXG4gIGNhbGxiYWNrPzogdW5rbm93bixcbik6IEdldEFkZHJJbmZvUmVxV3JhcCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPiB7XG4gIGxldCBoaW50cyA9IDA7XG4gIGxldCBmYW1pbHkgPSAwO1xuICBsZXQgYWxsID0gZmFsc2U7XG4gIGxldCB2ZXJiYXRpbSA9IGdldERlZmF1bHRWZXJiYXRpbSgpO1xuXG4gIC8vIFBhcnNlIGFyZ3VtZW50c1xuICBpZiAoaG9zdG5hbWUpIHtcbiAgICB2YWxpZGF0ZVN0cmluZyhob3N0bmFtZSwgXCJob3N0bmFtZVwiKTtcbiAgfVxuXG4gIGlmIChpc0xvb2t1cENhbGxiYWNrKG9wdGlvbnMpKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIGZhbWlseSA9IDA7XG4gIH0gZWxzZSBpZiAoaXNGYW1pbHkob3B0aW9ucykpIHtcbiAgICB2YWxpZGF0ZUZ1bmN0aW9uKGNhbGxiYWNrLCBcImNhbGxiYWNrXCIpO1xuXG4gICAgdmFsaWRhdGVPbmVPZihvcHRpb25zLCBcImZhbWlseVwiLCB2YWxpZEZhbWlsaWVzKTtcbiAgICBmYW1pbHkgPSBvcHRpb25zO1xuICB9IGVsc2UgaWYgKCFpc0xvb2t1cE9wdGlvbnMob3B0aW9ucykpIHtcbiAgICB2YWxpZGF0ZUZ1bmN0aW9uKGFyZ3VtZW50cy5sZW5ndGggPT09IDIgPyBvcHRpb25zIDogY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG5cbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJvcHRpb25zXCIsIFtcImludGVnZXJcIiwgXCJvYmplY3RcIl0sIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHZhbGlkYXRlRnVuY3Rpb24oY2FsbGJhY2ssIFwiY2FsbGJhY2tcIik7XG5cbiAgICBpZiAob3B0aW9ucz8uaGludHMgIT0gbnVsbCkge1xuICAgICAgdmFsaWRhdGVOdW1iZXIob3B0aW9ucy5oaW50cywgXCJvcHRpb25zLmhpbnRzXCIpO1xuICAgICAgaGludHMgPSBvcHRpb25zLmhpbnRzID4+PiAwO1xuICAgICAgdmFsaWRhdGVIaW50cyhoaW50cyk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnM/LmZhbWlseSAhPSBudWxsKSB7XG4gICAgICB2YWxpZGF0ZU9uZU9mKG9wdGlvbnMuZmFtaWx5LCBcIm9wdGlvbnMuZmFtaWx5XCIsIHZhbGlkRmFtaWxpZXMpO1xuICAgICAgZmFtaWx5ID0gb3B0aW9ucy5mYW1pbHk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnM/LmFsbCAhPSBudWxsKSB7XG4gICAgICB2YWxpZGF0ZUJvb2xlYW4ob3B0aW9ucy5hbGwsIFwib3B0aW9ucy5hbGxcIik7XG4gICAgICBhbGwgPSBvcHRpb25zLmFsbDtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucz8udmVyYmF0aW0gIT0gbnVsbCkge1xuICAgICAgdmFsaWRhdGVCb29sZWFuKG9wdGlvbnMudmVyYmF0aW0sIFwib3B0aW9ucy52ZXJiYXRpbVwiKTtcbiAgICAgIHZlcmJhdGltID0gb3B0aW9ucy52ZXJiYXRpbTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhvc3RuYW1lKSB7XG4gICAgZW1pdEludmFsaWRIb3N0bmFtZVdhcm5pbmcoaG9zdG5hbWUpO1xuXG4gICAgaWYgKGFsbCkge1xuICAgICAgbmV4dFRpY2soY2FsbGJhY2sgYXMgTG9va3VwQ2FsbGJhY2ssIG51bGwsIFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dFRpY2soY2FsbGJhY2sgYXMgTG9va3VwQ2FsbGJhY2ssIG51bGwsIG51bGwsIGZhbWlseSA9PT0gNiA/IDYgOiA0KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge307XG4gIH1cblxuICBjb25zdCBtYXRjaGVkRmFtaWx5ID0gaXNJUChob3N0bmFtZSk7XG5cbiAgaWYgKG1hdGNoZWRGYW1pbHkpIHtcbiAgICBpZiAoYWxsKSB7XG4gICAgICBuZXh0VGljayhjYWxsYmFjayBhcyBMb29rdXBDYWxsYmFjaywgbnVsbCwgW1xuICAgICAgICB7IGFkZHJlc3M6IGhvc3RuYW1lLCBmYW1pbHk6IG1hdGNoZWRGYW1pbHkgfSxcbiAgICAgIF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0VGljayhjYWxsYmFjayBhcyBMb29rdXBDYWxsYmFjaywgbnVsbCwgaG9zdG5hbWUsIG1hdGNoZWRGYW1pbHkpO1xuICAgIH1cblxuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIGNvbnN0IHJlcSA9IG5ldyBHZXRBZGRySW5mb1JlcVdyYXAoKTtcbiAgcmVxLmNhbGxiYWNrID0gY2FsbGJhY2sgYXMgTG9va3VwQ2FsbGJhY2s7XG4gIHJlcS5mYW1pbHkgPSBmYW1pbHk7XG4gIHJlcS5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICByZXEub25jb21wbGV0ZSA9IGFsbCA/IG9ubG9va3VwYWxsIDogb25sb29rdXA7XG5cbiAgY29uc3QgZXJyID0gZ2V0YWRkcmluZm8ocmVxLCB0b0FTQ0lJKGhvc3RuYW1lKSwgZmFtaWx5LCBoaW50cywgdmVyYmF0aW0pO1xuXG4gIGlmIChlcnIpIHtcbiAgICBuZXh0VGljayhcbiAgICAgIGNhbGxiYWNrIGFzIExvb2t1cENhbGxiYWNrLFxuICAgICAgZG5zRXhjZXB0aW9uKGVyciwgXCJnZXRhZGRyaW5mb1wiLCBob3N0bmFtZSksXG4gICAgKTtcblxuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIHJldHVybiByZXE7XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShsb29rdXAsIGN1c3RvbVByb21pc2lmeUFyZ3MsIHtcbiAgdmFsdWU6IFtcImFkZHJlc3NcIiwgXCJmYW1pbHlcIl0sXG4gIGVudW1lcmFibGU6IGZhbHNlLFxufSk7XG5cbmZ1bmN0aW9uIG9ucmVzb2x2ZShcbiAgdGhpczogUXVlcnlSZXFXcmFwLFxuICBlcnI6IG51bWJlcixcbiAgcmVjb3JkczogUmVjb3JkcyxcbiAgdHRscz86IG51bWJlcltdLFxuKSB7XG4gIGlmIChlcnIpIHtcbiAgICB0aGlzLmNhbGxiYWNrKGRuc0V4Y2VwdGlvbihlcnIsIHRoaXMuYmluZGluZ05hbWUsIHRoaXMuaG9zdG5hbWUpKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHBhcnNlZFJlY29yZHMgPSB0dGxzICYmIHRoaXMudHRsXG4gICAgPyAocmVjb3JkcyBhcyBzdHJpbmdbXSkubWFwKChhZGRyZXNzOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+ICh7XG4gICAgICBhZGRyZXNzLFxuICAgICAgdHRsOiB0dGxzW2luZGV4XSxcbiAgICB9KSlcbiAgICA6IHJlY29yZHM7XG5cbiAgdGhpcy5jYWxsYmFjayhudWxsLCBwYXJzZWRSZWNvcmRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZXIoYmluZGluZ05hbWU6IGtleW9mIENoYW5uZWxXcmFwUXVlcnkpIHtcbiAgZnVuY3Rpb24gcXVlcnkoXG4gICAgdGhpczogUmVzb2x2ZXIsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IHVua25vd24sXG4gICAgY2FsbGJhY2s/OiB1bmtub3duLFxuICApOiBRdWVyeVJlcVdyYXAge1xuICAgIGlmIChpc1Jlc29sdmVDYWxsYmFjayhvcHRpb25zKSkge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHZhbGlkYXRlU3RyaW5nKG5hbWUsIFwibmFtZVwiKTtcbiAgICB2YWxpZGF0ZUZ1bmN0aW9uKGNhbGxiYWNrLCBcImNhbGxiYWNrXCIpO1xuXG4gICAgY29uc3QgcmVxID0gbmV3IFF1ZXJ5UmVxV3JhcCgpO1xuICAgIHJlcS5iaW5kaW5nTmFtZSA9IGJpbmRpbmdOYW1lO1xuICAgIHJlcS5jYWxsYmFjayA9IGNhbGxiYWNrIGFzIFJlc29sdmVDYWxsYmFjaztcbiAgICByZXEuaG9zdG5hbWUgPSBuYW1lO1xuICAgIHJlcS5vbmNvbXBsZXRlID0gb25yZXNvbHZlO1xuXG4gICAgaWYgKG9wdGlvbnMgJiYgKG9wdGlvbnMgYXMgUmVzb2x2ZU9wdGlvbnMpLnR0bCkge1xuICAgICAgbm90SW1wbGVtZW50ZWQoXCJkbnMucmVzb2x2ZSogd2l0aCB0dGwgb3B0aW9uXCIpO1xuICAgIH1cblxuICAgIHJlcS50dGwgPSAhIShvcHRpb25zICYmIChvcHRpb25zIGFzIFJlc29sdmVPcHRpb25zKS50dGwpO1xuXG4gICAgY29uc3QgZXJyID0gdGhpcy5faGFuZGxlW2JpbmRpbmdOYW1lXShyZXEsIHRvQVNDSUkobmFtZSkpO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgdGhyb3cgZG5zRXhjZXB0aW9uKGVyciwgYmluZGluZ05hbWUsIG5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiByZXE7XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocXVlcnksIFwibmFtZVwiLCB7IHZhbHVlOiBiaW5kaW5nTmFtZSB9KTtcblxuICByZXR1cm4gcXVlcnk7XG59XG5cbmNvbnN0IHJlc29sdmVNYXAgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5leHBvcnQgY2xhc3MgUmVzb2x2ZXIgZXh0ZW5kcyBDYWxsYmFja1Jlc29sdmVyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucz86IFJlc29sdmVyT3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgW3Jlc29sdmVNZXRob2Q6IHN0cmluZ106IGFueTtcbn1cblxuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVBbnkgPSByZXNvbHZlTWFwLkFOWSA9IHJlc29sdmVyKFwicXVlcnlBbnlcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZTQgPSByZXNvbHZlTWFwLkEgPSByZXNvbHZlcihcInF1ZXJ5QVwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlNiA9IHJlc29sdmVNYXAuQUFBQSA9IHJlc29sdmVyKFwicXVlcnlBYWFhXCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVDYWEgPSByZXNvbHZlTWFwLkNBQSA9IHJlc29sdmVyKFwicXVlcnlDYWFcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZUNuYW1lID0gcmVzb2x2ZU1hcC5DTkFNRSA9IHJlc29sdmVyKFwicXVlcnlDbmFtZVwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlTXggPSByZXNvbHZlTWFwLk1YID0gcmVzb2x2ZXIoXCJxdWVyeU14XCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVOcyA9IHJlc29sdmVNYXAuTlMgPSByZXNvbHZlcihcInF1ZXJ5TnNcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVR4dCA9IHJlc29sdmVNYXAuVFhUID0gcmVzb2x2ZXIoXCJxdWVyeVR4dFwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlU3J2ID0gcmVzb2x2ZU1hcC5TUlYgPSByZXNvbHZlcihcInF1ZXJ5U3J2XCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVQdHIgPSByZXNvbHZlTWFwLlBUUiA9IHJlc29sdmVyKFwicXVlcnlQdHJcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZU5hcHRyID0gcmVzb2x2ZU1hcC5OQVBUUiA9IHJlc29sdmVyKFwicXVlcnlOYXB0clwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlU29hID0gcmVzb2x2ZU1hcC5TT0EgPSByZXNvbHZlcihcInF1ZXJ5U29hXCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJldmVyc2UgPSByZXNvbHZlcihcImdldEhvc3RCeUFkZHJcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZSA9IF9yZXNvbHZlO1xuXG5mdW5jdGlvbiBfcmVzb2x2ZShcbiAgdGhpczogUmVzb2x2ZXIsXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogdW5rbm93bixcbiAgY2FsbGJhY2s/OiB1bmtub3duLFxuKTogUXVlcnlSZXFXcmFwIHtcbiAgbGV0IHJlc29sdmVyOiBSZXNvbHZlcjtcblxuICBpZiAodHlwZW9mIGhvc3RuYW1lICE9PSBcInN0cmluZ1wiKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19UWVBFKFwibmFtZVwiLCBcInN0cmluZ1wiLCBob3N0bmFtZSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHJydHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIHJlc29sdmVyID0gcmVzb2x2ZU1hcFtycnR5cGVdO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBycnR5cGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJlc29sdmVyID0gcmVzb2x2ZU1hcC5BO1xuICAgIGNhbGxiYWNrID0gcnJ0eXBlO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcInJydHlwZVwiLCBcInN0cmluZ1wiLCBycnR5cGUpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiByZXNvbHZlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIFJlZmxlY3QuYXBwbHkocmVzb2x2ZXIsIHRoaXMsIFtob3N0bmFtZSwgY2FsbGJhY2tdKTtcbiAgfVxuXG4gIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUoXCJycnR5cGVcIiwgcnJ0eXBlKTtcbn1cblxuLyoqXG4gKiBTZXRzIHRoZSBJUCBhZGRyZXNzIGFuZCBwb3J0IG9mIHNlcnZlcnMgdG8gYmUgdXNlZCB3aGVuIHBlcmZvcm1pbmcgRE5TXG4gKiByZXNvbHV0aW9uLiBUaGUgYHNlcnZlcnNgIGFyZ3VtZW50IGlzIGFuIGFycmF5IG9mIFtSRkMgNTk1Ml0oaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzU5NTIjc2VjdGlvbi02KSBmb3JtYXR0ZWRcbiAqIGFkZHJlc3Nlcy4gSWYgdGhlIHBvcnQgaXMgdGhlIElBTkEgZGVmYXVsdCBETlMgcG9ydCAoNTMpIGl0IGNhbiBiZSBvbWl0dGVkLlxuICpcbiAqIGBgYGpzXG4gKiBkbnMuc2V0U2VydmVycyhbXG4gKiAgICc0LjQuNC40JyxcbiAqICAgJ1syMDAxOjQ4NjA6NDg2MDo6ODg4OF0nLFxuICogICAnNC40LjQuNDoxMDUzJyxcbiAqICAgJ1syMDAxOjQ4NjA6NDg2MDo6ODg4OF06MTA1MycsXG4gKiBdKTtcbiAqIGBgYFxuICpcbiAqIEFuIGVycm9yIHdpbGwgYmUgdGhyb3duIGlmIGFuIGludmFsaWQgYWRkcmVzcyBpcyBwcm92aWRlZC5cbiAqXG4gKiBUaGUgYGRucy5zZXRTZXJ2ZXJzKClgIG1ldGhvZCBtdXN0IG5vdCBiZSBjYWxsZWQgd2hpbGUgYSBETlMgcXVlcnkgaXMgaW5cbiAqIHByb2dyZXNzLlxuICpcbiAqIFRoZSBgc2V0U2VydmVyc2AgbWV0aG9kIGFmZmVjdHMgb25seSBgcmVzb2x2ZWAsYGRucy5yZXNvbHZlKigpYCBhbmQgYHJldmVyc2VgIChhbmQgc3BlY2lmaWNhbGx5IF9ub3RfIGBsb29rdXBgKS5cbiAqXG4gKiBUaGlzIG1ldGhvZCB3b3JrcyBtdWNoIGxpa2UgW3Jlc29sdmUuY29uZl0oaHR0cHM6Ly9tYW43Lm9yZy9saW51eC9tYW4tcGFnZXMvbWFuNS9yZXNvbHYuY29uZi41Lmh0bWwpLlxuICogVGhhdCBpcywgaWYgYXR0ZW1wdGluZyB0byByZXNvbHZlIHdpdGggdGhlIGZpcnN0IHNlcnZlciBwcm92aWRlZCByZXN1bHRzIGluIGFcbiAqIGBOT1RGT1VORGAgZXJyb3IsIHRoZSBgcmVzb2x2ZSgpYCBtZXRob2Qgd2lsbCBfbm90XyBhdHRlbXB0IHRvIHJlc29sdmUgd2l0aFxuICogc3Vic2VxdWVudCBzZXJ2ZXJzIHByb3ZpZGVkLiBGYWxsYmFjayBETlMgc2VydmVycyB3aWxsIG9ubHkgYmUgdXNlZCBpZiB0aGVcbiAqIGVhcmxpZXIgb25lcyB0aW1lIG91dCBvciByZXN1bHQgaW4gc29tZSBvdGhlciBlcnJvci5cbiAqXG4gKiBAcGFyYW0gc2VydmVycyBhcnJheSBvZiBgUkZDIDU5NTJgIGZvcm1hdHRlZCBhZGRyZXNzZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFNlcnZlcnMoc2VydmVyczogUmVhZG9ubHlBcnJheTxzdHJpbmc+KSB7XG4gIGNvbnN0IHJlc29sdmVyID0gbmV3IFJlc29sdmVyKCk7XG5cbiAgcmVzb2x2ZXIuc2V0U2VydmVycyhzZXJ2ZXJzKTtcbiAgc2V0RGVmYXVsdFJlc29sdmVyKHJlc29sdmVyKTtcbn1cblxuLy8gVGhlIE5vZGUgaW1wbGVtZW50YXRpb24gdXNlcyBgYmluZERlZmF1bHRSZXNvbHZlcmAgdG8gc2V0IHRoZSBmb2xsb3cgbWV0aG9kc1xuLy8gb24gYG1vZHVsZS5leHBvcnRzYCBib3VuZCB0byB0aGUgY3VycmVudCBgZGVmYXVsdFJlc29sdmVyYC4gV2UgZG9uJ3QgaGF2ZVxuLy8gdGhlIHNhbWUgYWJpbGl0eSBpbiBFU00gYnV0IGNhbiBzaW11bGF0ZSB0aGlzIChhdCBzb21lIGNvc3QpIGJ5IGV4cGxpY2l0bHlcbi8vIGV4cG9ydGluZyB0aGVzZSBtZXRob2RzIHdoaWNoIGR5bmFtaWNhbGx5IGJpbmQgdG8gdGhlIGRlZmF1bHQgcmVzb2x2ZXIgd2hlblxuLy8gY2FsbGVkLlxuXG4vKipcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgSVAgYWRkcmVzcyBzdHJpbmdzLCBmb3JtYXR0ZWQgYWNjb3JkaW5nIHRvIFtSRkMgNTk1Ml0oaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzU5NTIjc2VjdGlvbi02KSxcbiAqIHRoYXQgYXJlIGN1cnJlbnRseSBjb25maWd1cmVkIGZvciBETlMgcmVzb2x1dGlvbi4gQSBzdHJpbmcgd2lsbCBpbmNsdWRlIGEgcG9ydFxuICogc2VjdGlvbiBpZiBhIGN1c3RvbSBwb3J0IGlzIHVzZWQuXG4gKlxuICogYGBganNcbiAqIFtcbiAqICAgJzQuNC40LjQnLFxuICogICAnMjAwMTo0ODYwOjQ4NjA6Ojg4ODgnLFxuICogICAnNC40LjQuNDoxMDUzJyxcbiAqICAgJ1syMDAxOjQ4NjA6NDg2MDo6ODg4OF06MTA1MycsXG4gKiBdXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcnZlcnMoKTogc3RyaW5nW10ge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLmdldFNlcnZlcnMuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSkoKTtcbn1cblxuLyoqXG4gKiBVc2VzIHRoZSBETlMgcHJvdG9jb2wgdG8gcmVzb2x2ZSBhbGwgcmVjb3JkcyAoYWxzbyBrbm93biBhcyBgQU5ZYCBvciBgKmAgcXVlcnkpLlxuICogVGhlIGByZXRgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiB3aWxsIGJlIGFuIGFycmF5IGNvbnRhaW5pbmdcbiAqIHZhcmlvdXMgdHlwZXMgb2YgcmVjb3Jkcy4gRWFjaCBvYmplY3QgaGFzIGEgcHJvcGVydHkgYHR5cGVgIHRoYXQgaW5kaWNhdGVzIHRoZVxuICogdHlwZSBvZiB0aGUgY3VycmVudCByZWNvcmQuIEFuZCBkZXBlbmRpbmcgb24gdGhlIGB0eXBlYCwgYWRkaXRpb25hbCBwcm9wZXJ0aWVzXG4gKiB3aWxsIGJlIHByZXNlbnQgb24gdGhlIG9iamVjdC5cbiAqXG4gKiBIZXJlIGlzIGFuIGV4YW1wbGUgb2YgdGhlIGByZXRgIG9iamVjdCBwYXNzZWQgdG8gdGhlIGNhbGxiYWNrOlxuICpcbiAqIGBgYGpzXG4gKiBbIHsgdHlwZTogJ0EnLCBhZGRyZXNzOiAnMTI3LjAuMC4xJywgdHRsOiAyOTkgfSxcbiAqICAgeyB0eXBlOiAnQ05BTUUnLCB2YWx1ZTogJ2V4YW1wbGUuY29tJyB9LFxuICogICB7IHR5cGU6ICdNWCcsIGV4Y2hhbmdlOiAnYWx0NC5hc3BteC5sLmV4YW1wbGUuY29tJywgcHJpb3JpdHk6IDUwIH0sXG4gKiAgIHsgdHlwZTogJ05TJywgdmFsdWU6ICduczEuZXhhbXBsZS5jb20nIH0sXG4gKiAgIHsgdHlwZTogJ1RYVCcsIGVudHJpZXM6IFsgJ3Y9c3BmMSBpbmNsdWRlOl9zcGYuZXhhbXBsZS5jb20gfmFsbCcgXSB9LFxuICogICB7IHR5cGU6ICdTT0EnLFxuICogICAgIG5zbmFtZTogJ25zMS5leGFtcGxlLmNvbScsXG4gKiAgICAgaG9zdG1hc3RlcjogJ2FkbWluLmV4YW1wbGUuY29tJyxcbiAqICAgICBzZXJpYWw6IDE1NjY5Njc0MixcbiAqICAgICByZWZyZXNoOiA5MDAsXG4gKiAgICAgcmV0cnk6IDkwMCxcbiAqICAgICBleHBpcmU6IDE4MDAsXG4gKiAgICAgbWludHRsOiA2MCB9IF1cbiAqIGBgYFxuICpcbiAqIEROUyBzZXJ2ZXIgb3BlcmF0b3JzIG1heSBjaG9vc2Ugbm90IHRvIHJlc3BvbmQgdG8gYEFOWWAgcXVlcmllcy4gSXQgbWF5IGJlXG4gKiBiZXR0ZXIgdG8gY2FsbCBpbmRpdmlkdWFsIG1ldGhvZHMgbGlrZSBgcmVzb2x2ZTRgLCBgcmVzb2x2ZU14YCwgYW5kIHNvIG9uLlxuICogRm9yIG1vcmUgZGV0YWlscywgc2VlIFtSRkMgODQ4Ml0oaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzg0ODIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUFueShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBBbnlSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQW55KC4uLmFyZ3M6IHVua25vd25bXSk6IFF1ZXJ5UmVxV3JhcCB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZUFueS5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFVzZXMgdGhlIEROUyBwcm90b2NvbCB0byByZXNvbHZlIGEgSVB2NCBhZGRyZXNzZXMgKGBBYCByZWNvcmRzKSBmb3IgdGhlXG4gKiBgaG9zdG5hbWVgLiBUaGUgYGFkZHJlc3Nlc2AgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgY2FsbGJhY2tgIGZ1bmN0aW9uIHdpbGxcbiAqIGNvbnRhaW4gYW4gYXJyYXkgb2YgSVB2NCBhZGRyZXNzZXMgKGUuZy4gYFsnNzQuMTI1Ljc5LjEwNCcsICc3NC4xMjUuNzkuMTA1JywnNzQuMTI1Ljc5LjEwNiddYCkuXG4gKlxuICogQHBhcmFtIGhvc3RuYW1lIEhvc3QgbmFtZSB0byByZXNvbHZlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZTQoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3Nlczogc3RyaW5nW10pID0+IHZvaWQsXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU0KFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBSZXNvbHZlV2l0aFR0bE9wdGlvbnMsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3NlczogUmVjb3JkV2l0aFR0bFtdKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlNChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogUmVzb2x2ZU9wdGlvbnMsXG4gIGNhbGxiYWNrOiAoXG4gICAgZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsXG4gICAgYWRkcmVzc2VzOiBzdHJpbmdbXSB8IFJlY29yZFdpdGhUdGxbXSxcbiAgKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlNChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogdW5rbm93bixcbiAgY2FsbGJhY2s/OiB1bmtub3duLFxuKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZTQuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICAgb3B0aW9ucyxcbiAgICBjYWxsYmFjayxcbiAgKTtcbn1cblxuLyoqXG4gKiBVc2VzIHRoZSBETlMgcHJvdG9jb2wgdG8gcmVzb2x2ZSBhIElQdjYgYWRkcmVzc2VzIChgQUFBQWAgcmVjb3JkcykgZm9yIHRoZVxuICogYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvblxuICogd2lsbCBjb250YWluIGFuIGFycmF5IG9mIElQdjYgYWRkcmVzc2VzLlxuICpcbiAqIEBwYXJhbSBob3N0bmFtZSBIb3N0IG5hbWUgdG8gcmVzb2x2ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU2KFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBhZGRyZXNzZXM6IHN0cmluZ1tdKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlNihcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogUmVzb2x2ZVdpdGhUdGxPcHRpb25zLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBhZGRyZXNzZXM6IFJlY29yZFdpdGhUdGxbXSkgPT4gdm9pZCxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZTYoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IFJlc29sdmVPcHRpb25zLFxuICBjYWxsYmFjazogKFxuICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgIGFkZHJlc3Nlczogc3RyaW5nW10gfCBSZWNvcmRXaXRoVHRsW10sXG4gICkgPT4gdm9pZCxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZTYoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IHVua25vd24sXG4gIGNhbGxiYWNrPzogdW5rbm93bixcbikge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmU2LmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIGhvc3RuYW1lLFxuICAgIG9wdGlvbnMsXG4gICAgY2FsbGJhY2ssXG4gICk7XG59XG5cbi8qKlxuICogVXNlcyB0aGUgRE5TIHByb3RvY29sIHRvIHJlc29sdmUgYENBQWAgcmVjb3JkcyBmb3IgdGhlIGBob3N0bmFtZWAuIFRoZVxuICogYGFkZHJlc3Nlc2AgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgY2FsbGJhY2tgIGZ1bmN0aW9uIHdpbGwgY29udGFpbiBhbiBhcnJheVxuICogb2YgY2VydGlmaWNhdGlvbiBhdXRob3JpdHkgYXV0aG9yaXphdGlvbiByZWNvcmRzIGF2YWlsYWJsZSBmb3IgdGhlXG4gKiBgaG9zdG5hbWVgIChlLmcuIGBbe2NyaXRpY2FsOiAwLCBpb2RlZjogJ21haWx0bzpwa2lAZXhhbXBsZS5jb20nfSwge2NyaXRpY2FsOiAxMjgsIGlzc3VlOiAncGtpLmV4YW1wbGUuY29tJ31dYCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ2FhKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCByZWNvcmRzOiBDYWFSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ2FhKC4uLmFyZ3M6IHVua25vd25bXSk6IFF1ZXJ5UmVxV3JhcCB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZUNhYS5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFVzZXMgdGhlIEROUyBwcm90b2NvbCB0byByZXNvbHZlIGBDTkFNRWAgcmVjb3JkcyBmb3IgdGhlIGBob3N0bmFtZWAuIFRoZVxuICogYGFkZHJlc3Nlc2AgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgY2FsbGJhY2tgIGZ1bmN0aW9uIHdpbGwgY29udGFpbiBhbiBhcnJheVxuICogb2YgY2Fub25pY2FsIG5hbWUgcmVjb3JkcyBhdmFpbGFibGUgZm9yIHRoZSBgaG9zdG5hbWVgKGUuZy4gYFsnYmFyLmV4YW1wbGUuY29tJ11gKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDbmFtZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBzdHJpbmdbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ25hbWUoLi4uYXJnczogdW5rbm93bltdKTogUXVlcnlSZXFXcmFwIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlQ25hbWUuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgLi4uYXJncyxcbiAgKTtcbn1cblxuLyoqXG4gKiBVc2VzIHRoZSBETlMgcHJvdG9jb2wgdG8gcmVzb2x2ZSBtYWlsIGV4Y2hhbmdlIHJlY29yZHMgKGBNWGAgcmVjb3JkcykgZm9yIHRoZVxuICogYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiB3aWxsXG4gKiBjb250YWluIGFuIGFycmF5IG9mIG9iamVjdHMgY29udGFpbmluZyBib3RoIGEgYHByaW9yaXR5YCBhbmQgYGV4Y2hhbmdlYFxuICogcHJvcGVydHkgKGUuZy4gYFt7cHJpb3JpdHk6IDEwLCBleGNoYW5nZTogJ214LmV4YW1wbGUuY29tJ30sIC4uLl1gKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVNeChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBNeFJlY29yZFtdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVNeCguLi5hcmdzOiB1bmtub3duW10pOiBRdWVyeVJlcVdyYXAge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVNeC5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFVzZXMgdGhlIEROUyBwcm90b2NvbCB0byByZXNvbHZlIG5hbWUgc2VydmVyIHJlY29yZHMgKGBOU2AgcmVjb3JkcykgZm9yIHRoZVxuICogYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiB3aWxsXG4gKiBjb250YWluIGFuIGFycmF5IG9mIG5hbWUgc2VydmVyIHJlY29yZHMgYXZhaWxhYmxlIGZvciBgaG9zdG5hbWVgXG4gKiAoZS5nLiBgWyduczEuZXhhbXBsZS5jb20nLCAnbnMyLmV4YW1wbGUuY29tJ11gKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVOcyhcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBzdHJpbmdbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTnMoLi4uYXJnczogdW5rbm93bltdKTogUXVlcnlSZXFXcmFwIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlTnMuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgLi4uYXJncyxcbiAgKTtcbn1cblxuLyoqXG4gKiBVc2VzIHRoZSBETlMgcHJvdG9jb2wgdG8gcmVzb2x2ZSB0ZXh0IHF1ZXJpZXMgKGBUWFRgIHJlY29yZHMpIGZvciB0aGVcbiAqIGBob3N0bmFtZWAuIFRoZSBgcmVjb3Jkc2AgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgY2FsbGJhY2tgIGZ1bmN0aW9uIGlzIGFcbiAqIHR3by1kaW1lbnNpb25hbCBhcnJheSBvZiB0aGUgdGV4dCByZWNvcmRzIGF2YWlsYWJsZSBmb3IgYGhvc3RuYW1lYFxuICogKGUuZy5gWyBbJ3Y9c3BmMSBpcDQ6MC4wLjAuMCAnLCAnfmFsbCcgXSBdYCkuIEVhY2ggc3ViLWFycmF5IGNvbnRhaW5zIFRYVFxuICogY2h1bmtzIG9mIG9uZSByZWNvcmQuIERlcGVuZGluZyBvbiB0aGUgdXNlIGNhc2UsIHRoZXNlIGNvdWxkIGJlIGVpdGhlclxuICogam9pbmVkIHRvZ2V0aGVyIG9yIHRyZWF0ZWQgc2VwYXJhdGVseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVUeHQoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3Nlczogc3RyaW5nW11bXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlVHh0KC4uLmFyZ3M6IHVua25vd25bXSk6IFF1ZXJ5UmVxV3JhcCB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVR4dC5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFVzZXMgdGhlIEROUyBwcm90b2NvbCB0byByZXNvbHZlIHNlcnZpY2UgcmVjb3JkcyAoYFNSVmAgcmVjb3JkcykgZm9yIHRoZVxuICogYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiB3aWxsXG4gKiBiZSBhbiBhcnJheSBvZiBvYmplY3RzIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICpcbiAqIC0gYHByaW9yaXR5YFxuICogLSBgd2VpZ2h0YFxuICogLSBgcG9ydGBcbiAqIC0gYG5hbWVgXG4gKlxuICogYGBganNcbiAqIHtcbiAqICAgcHJpb3JpdHk6IDEwLFxuICogICB3ZWlnaHQ6IDUsXG4gKiAgIHBvcnQ6IDIxMjIzLFxuICogICBuYW1lOiAnc2VydmljZS5leGFtcGxlLmNvbSdcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNydihcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBTcnZSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU3J2KC4uLmFyZ3M6IHVua25vd25bXSk6IFF1ZXJ5UmVxV3JhcCB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVNydi5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFVzZXMgdGhlIEROUyBwcm90b2NvbCB0byByZXNvbHZlIHBvaW50ZXIgcmVjb3JkcyAoYFBUUmAgcmVjb3JkcykgZm9yIHRoZVxuICogYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiB3aWxsXG4gKiBiZSBhbiBhcnJheSBvZiBzdHJpbmdzIGNvbnRhaW5pbmcgdGhlIHJlcGx5IHJlY29yZHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlUHRyKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBhZGRyZXNzZXM6IHN0cmluZ1tdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVQdHIoLi4uYXJnczogdW5rbm93bltdKTogUXVlcnlSZXFXcmFwIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlUHRyLmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIC4uLmFyZ3MsXG4gICk7XG59XG5cbi8qKlxuICogVXNlcyB0aGUgRE5TIHByb3RvY29sIHRvIHJlc29sdmUgcmVndWxhciBleHByZXNzaW9uIGJhc2VkIHJlY29yZHMgKGBOQVBUUmBcbiAqIHJlY29yZHMpIGZvciB0aGUgYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzZXNgIGFyZ3VtZW50IHBhc3NlZCB0byB0aGVcbiAqIGBjYWxsYmFja2AgZnVuY3Rpb24gd2lsbCBjb250YWluIGFuIGFycmF5IG9mIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nXG4gKiBwcm9wZXJ0aWVzOlxuICpcbiAqIC0gYGZsYWdzYFxuICogLSBgc2VydmljZWBcbiAqIC0gYHJlZ2V4cGBcbiAqIC0gYHJlcGxhY2VtZW50YFxuICogLSBgb3JkZXJgXG4gKiAtIGBwcmVmZXJlbmNlYFxuICpcbiAqIGBgYGpzXG4gKiB7XG4gKiAgIGZsYWdzOiAncycsXG4gKiAgIHNlcnZpY2U6ICdTSVArRDJVJyxcbiAqICAgcmVnZXhwOiAnJyxcbiAqICAgcmVwbGFjZW1lbnQ6ICdfc2lwLl91ZHAuZXhhbXBsZS5jb20nLFxuICogICBvcmRlcjogMzAsXG4gKiAgIHByZWZlcmVuY2U6IDEwMFxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTmFwdHIoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3NlczogTmFwdHJSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTmFwdHIoLi4uYXJnczogdW5rbm93bltdKTogUXVlcnlSZXFXcmFwIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlTmFwdHIuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgLi4uYXJncyxcbiAgKTtcbn1cblxuLyoqXG4gKiBVc2VzIHRoZSBETlMgcHJvdG9jb2wgdG8gcmVzb2x2ZSBhIHN0YXJ0IG9mIGF1dGhvcml0eSByZWNvcmQgKGBTT0FgIHJlY29yZCkgZm9yXG4gKiB0aGUgYGhvc3RuYW1lYC4gVGhlIGBhZGRyZXNzYCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGBjYWxsYmFja2AgZnVuY3Rpb24gd2lsbFxuICogYmUgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICpcbiAqIC0gYG5zbmFtZWBcbiAqIC0gYGhvc3RtYXN0ZXJgXG4gKiAtIGBzZXJpYWxgXG4gKiAtIGByZWZyZXNoYFxuICogLSBgcmV0cnlgXG4gKiAtIGBleHBpcmVgXG4gKiAtIGBtaW50dGxgXG4gKlxuICogYGBganNcbiAqIHtcbiAqICAgbnNuYW1lOiAnbnMuZXhhbXBsZS5jb20nLFxuICogICBob3N0bWFzdGVyOiAncm9vdC5leGFtcGxlLmNvbScsXG4gKiAgIHNlcmlhbDogMjAxMzEwMTgwOSxcbiAqICAgcmVmcmVzaDogMTAwMDAsXG4gKiAgIHJldHJ5OiAyNDAwLFxuICogICBleHBpcmU6IDYwNDgwMCxcbiAqICAgbWludHRsOiAzNjAwXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTb2EoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3M6IFNvYVJlY29yZCkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU29hKC4uLmFyZ3M6IHVua25vd25bXSk6IFF1ZXJ5UmVxV3JhcCB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVNvYS5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICAuLi5hcmdzLFxuICApO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIGEgcmV2ZXJzZSBETlMgcXVlcnkgdGhhdCByZXNvbHZlcyBhbiBJUHY0IG9yIElQdjYgYWRkcmVzcyB0byBhblxuICogYXJyYXkgb2YgaG9zdCBuYW1lcy5cbiAqXG4gKiBPbiBlcnJvciwgYGVycmAgaXMgYW4gYEVycm9yYCBvYmplY3QsIHdoZXJlIGBlcnIuY29kZWAgaXNcbiAqIG9uZSBvZiB0aGUgYEROUyBlcnJvciBjb2Rlc2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXZlcnNlKFxuICBpcDogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBob3N0bmFtZXM6IHN0cmluZ1tdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJldmVyc2UoLi4uYXJnczogdW5rbm93bltdKTogUXVlcnlSZXFXcmFwIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXZlcnNlLmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIC4uLmFyZ3MsXG4gICk7XG59XG5cbi8qKlxuICogVXNlcyB0aGUgRE5TIHByb3RvY29sIHRvIHJlc29sdmUgYSBob3N0IG5hbWUgKGUuZy4gYCdub2RlanMub3JnJ2ApIGludG8gYW4gYXJyYXlcbiAqIG9mIHRoZSByZXNvdXJjZSByZWNvcmRzLiBUaGUgYGNhbGxiYWNrYCBmdW5jdGlvbiBoYXMgYXJndW1lbnRzYChlcnIsIHJlY29yZHMpYC5dXG4gKiBXaGVuIHN1Y2Nlc3NmdWwsIGByZWNvcmRzYCB3aWxsIGJlIGFuIGFycmF5IG9mIHJlc291cmNlXG4gKiByZWNvcmRzLiBUaGUgdHlwZSBhbmQgc3RydWN0dXJlIG9mIGluZGl2aWR1YWwgcmVzdWx0cyB2YXJpZXMgYmFzZWQgb24gYHJydHlwZWAuXG4gKlxuICogT24gZXJyb3IsIGBlcnJgIGlzIGFuIGBFcnJvcmAgb2JqZWN0LCB3aGVyZSBgZXJyLmNvZGVgIGlzIG9uZSBvZiB0aGUgRE5TIGVycm9yIGNvZGVzLlxuICpcbiAqIEBwYXJhbSBob3N0bmFtZSBIb3N0IG5hbWUgdG8gcmVzb2x2ZS5cbiAqIEBwYXJhbSBbcnJ0eXBlPSdBJ10gUmVzb3VyY2UgcmVjb3JkIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBhZGRyZXNzZXM6IHN0cmluZ1tdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJBXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3Nlczogc3RyaW5nW10pID0+IHZvaWQsXG4pOiBRdWVyeVJlcVdyYXA7XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgcnJ0eXBlOiBcIkFBQUFcIixcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBzdHJpbmdbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiQU5ZXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3NlczogQW55UmVjb3JkW10pID0+IHZvaWQsXG4pOiBRdWVyeVJlcVdyYXA7XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgcnJ0eXBlOiBcIkNOQU1FXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3Nlczogc3RyaW5nW10pID0+IHZvaWQsXG4pOiBRdWVyeVJlcVdyYXA7XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgcnJ0eXBlOiBcIk1YXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3NlczogTXhSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiTkFQVFJcIixcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBOYXB0clJlY29yZFtdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJOU1wiLFxuICBjYWxsYmFjazogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLCBhZGRyZXNzZXM6IHN0cmluZ1tdKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJQVFJcIixcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBzdHJpbmdbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiU09BXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3NlczogU29hUmVjb3JkKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJTUlZcIixcbiAgY2FsbGJhY2s6IChlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCwgYWRkcmVzc2VzOiBTcnZSZWNvcmRbXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiVFhUXCIsXG4gIGNhbGxiYWNrOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwsIGFkZHJlc3Nlczogc3RyaW5nW11bXSkgPT4gdm9pZCxcbik6IFF1ZXJ5UmVxV3JhcDtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IHN0cmluZyxcbiAgY2FsbGJhY2s6IChcbiAgICBlcnI6IEVycm5vRXhjZXB0aW9uIHwgbnVsbCxcbiAgICBhZGRyZXNzZXM6XG4gICAgICB8IHN0cmluZ1tdXG4gICAgICB8IE14UmVjb3JkW11cbiAgICAgIHwgTmFwdHJSZWNvcmRbXVxuICAgICAgfCBTb2FSZWNvcmRcbiAgICAgIHwgU3J2UmVjb3JkW11cbiAgICAgIHwgc3RyaW5nW11bXVxuICAgICAgfCBBbnlSZWNvcmRbXSxcbiAgKSA9PiB2b2lkLFxuKTogUXVlcnlSZXFXcmFwO1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoaG9zdG5hbWU6IHN0cmluZywgcnJ0eXBlOiB1bmtub3duLCBjYWxsYmFjaz86IHVua25vd24pIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlLmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIGhvc3RuYW1lLFxuICAgIHJydHlwZSxcbiAgICBjYWxsYmFjayxcbiAgKTtcbn1cblxuLy8gRVJST1IgQ09ERVNcbmV4cG9ydCBjb25zdCBOT0RBVEEgPSBcIkVOT0RBVEFcIjtcbmV4cG9ydCBjb25zdCBGT1JNRVJSID0gXCJFRk9STUVSUlwiO1xuZXhwb3J0IGNvbnN0IFNFUlZGQUlMID0gXCJFU0VSVkZBSUxcIjtcbmV4cG9ydCBjb25zdCBOT1RGT1VORCA9IFwiRU5PVEZPVU5EXCI7XG5leHBvcnQgY29uc3QgTk9USU1QID0gXCJFTk9USU1QXCI7XG5leHBvcnQgY29uc3QgUkVGVVNFRCA9IFwiRVJFRlVTRURcIjtcbmV4cG9ydCBjb25zdCBCQURRVUVSWSA9IFwiRUJBRFFVRVJZXCI7XG5leHBvcnQgY29uc3QgQkFETkFNRSA9IFwiRUJBRE5BTUVcIjtcbmV4cG9ydCBjb25zdCBCQURGQU1JTFkgPSBcIkVCQURGQU1JTFlcIjtcbmV4cG9ydCBjb25zdCBCQURSRVNQID0gXCJFQkFEUkVTUFwiO1xuZXhwb3J0IGNvbnN0IENPTk5SRUZVU0VEID0gXCJFQ09OTlJFRlVTRURcIjtcbmV4cG9ydCBjb25zdCBUSU1FT1VUID0gXCJFVElNRU9VVFwiO1xuZXhwb3J0IGNvbnN0IEVPRiA9IFwiRU9GXCI7XG5leHBvcnQgY29uc3QgRklMRSA9IFwiRUZJTEVcIjtcbmV4cG9ydCBjb25zdCBOT01FTSA9IFwiRU5PTUVNXCI7XG5leHBvcnQgY29uc3QgREVTVFJVQ1RJT04gPSBcIkVERVNUUlVDVElPTlwiO1xuZXhwb3J0IGNvbnN0IEJBRFNUUiA9IFwiRUJBRFNUUlwiO1xuZXhwb3J0IGNvbnN0IEJBREZMQUdTID0gXCJFQkFERkxBR1NcIjtcbmV4cG9ydCBjb25zdCBOT05BTUUgPSBcIkVOT05BTUVcIjtcbmV4cG9ydCBjb25zdCBCQURISU5UUyA9IFwiRUJBREhJTlRTXCI7XG5leHBvcnQgY29uc3QgTk9USU5JVElBTElaRUQgPSBcIkVOT1RJTklUSUFMSVpFRFwiO1xuZXhwb3J0IGNvbnN0IExPQURJUEhMUEFQSSA9IFwiRUxPQURJUEhMUEFQSVwiO1xuZXhwb3J0IGNvbnN0IEFERFJHRVRORVRXT1JLUEFSQU1TID0gXCJFQUREUkdFVE5FVFdPUktQQVJBTVNcIjtcbmV4cG9ydCBjb25zdCBDQU5DRUxMRUQgPSBcIkVDQU5DRUxMRURcIjtcblxuY29uc3QgcHJvbWlzZXMgPSB7XG4gIC4uLnByb21pc2VzQmFzZSxcbiAgc2V0RGVmYXVsdFJlc3VsdE9yZGVyLFxuICBzZXRTZXJ2ZXJzLFxuXG4gIC8vIEVSUk9SIENPREVTXG4gIE5PREFUQSxcbiAgRk9STUVSUixcbiAgU0VSVkZBSUwsXG4gIE5PVEZPVU5ELFxuICBOT1RJTVAsXG4gIFJFRlVTRUQsXG4gIEJBRFFVRVJZLFxuICBCQUROQU1FLFxuICBCQURGQU1JTFksXG4gIEJBRFJFU1AsXG4gIENPTk5SRUZVU0VELFxuICBUSU1FT1VULFxuICBFT0YsXG4gIEZJTEUsXG4gIE5PTUVNLFxuICBERVNUUlVDVElPTixcbiAgQkFEU1RSLFxuICBCQURGTEFHUyxcbiAgTk9OQU1FLFxuICBCQURISU5UUyxcbiAgTk9USU5JVElBTElaRUQsXG4gIExPQURJUEhMUEFQSSxcbiAgQUREUkdFVE5FVFdPUktQQVJBTVMsXG4gIENBTkNFTExFRCxcbn07XG5cbmV4cG9ydCB7IEFERFJDT05GSUcsIEFMTCwgcHJvbWlzZXMsIHNldERlZmF1bHRSZXN1bHRPcmRlciwgVjRNQVBQRUQgfTtcblxuZXhwb3J0IHR5cGUge1xuICBBbnlBYWFhUmVjb3JkLFxuICBBbnlBUmVjb3JkLFxuICBBbnlDbmFtZVJlY29yZCxcbiAgQW55TXhSZWNvcmQsXG4gIEFueU5hcHRyUmVjb3JkLFxuICBBbnlOc1JlY29yZCxcbiAgQW55UHRyUmVjb3JkLFxuICBBbnlSZWNvcmQsXG4gIEFueVNvYVJlY29yZCxcbiAgQW55U3J2UmVjb3JkLFxuICBBbnlUeHRSZWNvcmQsXG4gIENhYVJlY29yZCxcbiAgTG9va3VwQWRkcmVzcyxcbiAgTG9va3VwQWxsT3B0aW9ucyxcbiAgTG9va3VwT25lT3B0aW9ucyxcbiAgTG9va3VwT3B0aW9ucyxcbiAgTXhSZWNvcmQsXG4gIE5hcHRyUmVjb3JkLFxuICBSZWNvcmRzLFxuICBSZWNvcmRXaXRoVHRsLFxuICBSZXNvbHZlQ2FsbGJhY2ssXG4gIFJlc29sdmVPcHRpb25zLFxuICBSZXNvbHZlck9wdGlvbnMsXG4gIFJlc29sdmVXaXRoVHRsT3B0aW9ucyxcbiAgU29hUmVjb3JkLFxuICBTcnZSZWNvcmQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIEFERFJDT05GSUcsXG4gIEFMTCxcbiAgVjRNQVBQRUQsXG4gIGxvb2t1cCxcbiAgZ2V0U2VydmVycyxcbiAgcmVzb2x2ZUFueSxcbiAgcmVzb2x2ZTQsXG4gIHJlc29sdmU2LFxuICByZXNvbHZlQ2FhLFxuICByZXNvbHZlQ25hbWUsXG4gIHJlc29sdmVNeCxcbiAgcmVzb2x2ZU5zLFxuICByZXNvbHZlVHh0LFxuICByZXNvbHZlU3J2LFxuICByZXNvbHZlUHRyLFxuICByZXNvbHZlTmFwdHIsXG4gIHJlc29sdmVTb2EsXG4gIHJlc29sdmUsXG4gIFJlc29sdmVyLFxuICByZXZlcnNlLFxuICBzZXRTZXJ2ZXJzLFxuICBzZXREZWZhdWx0UmVzdWx0T3JkZXIsXG4gIHByb21pc2VzLFxuICBOT0RBVEEsXG4gIEZPUk1FUlIsXG4gIFNFUlZGQUlMLFxuICBOT1RGT1VORCxcbiAgTk9USU1QLFxuICBSRUZVU0VELFxuICBCQURRVUVSWSxcbiAgQkFETkFNRSxcbiAgQkFERkFNSUxZLFxuICBCQURSRVNQLFxuICBDT05OUkVGVVNFRCxcbiAgVElNRU9VVCxcbiAgRU9GLFxuICBGSUxFLFxuICBOT01FTSxcbiAgREVTVFJVQ1RJT04sXG4gIEJBRFNUUixcbiAgQkFERkxBR1MsXG4gIE5PTkFNRSxcbiAgQkFESElOVFMsXG4gIE5PVElOSVRJQUxJWkVELFxuICBMT0FESVBITFBBUEksXG4gIEFERFJHRVRORVRXT1JLUEFSQU1TLFxuICBDQU5DRUxMRUQsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFDdEQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSxnRUFBZ0U7QUFDaEUsc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSw0RUFBNEU7QUFDNUUscUVBQXFFO0FBQ3JFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUN6RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLDZEQUE2RDtBQUM3RCw0RUFBNEU7QUFDNUUsMkVBQTJFO0FBQzNFLHdFQUF3RTtBQUN4RSw0RUFBNEU7QUFDNUUseUNBQXlDO0FBRXpDLFNBQVMsUUFBUSxRQUFRLGtCQUFrQjtBQUMzQyxTQUFTLG1CQUFtQixRQUFRLHNCQUFzQjtBQUMxRCxTQUNFLGVBQWUsRUFDZixnQkFBZ0IsRUFDaEIsY0FBYyxFQUNkLGFBQWEsRUFDYixjQUFjLFFBQ1QsNEJBQTRCO0FBQ25DLFNBQVMsSUFBSSxRQUFRLG9CQUFvQjtBQUN6QyxTQUNFLDBCQUEwQixFQUMxQixrQkFBa0IsRUFDbEIsa0JBQWtCLEVBQ2xCLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLGlCQUFpQixFQUNqQixZQUFZLGdCQUFnQixFQUM1QixrQkFBa0IsRUFDbEIscUJBQXFCLEVBQ3JCLGFBQWEsUUFDUiwwQkFBMEI7QUE2QmpDLE9BQU8sa0JBQWtCLDZCQUE2QjtBQUV0RCxT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O0FBRUosQ0FBQztBQUVELGNBQWM7QUFDZCxPQUFPLE1BQU0sU0FBUyxVQUFVO0FBQ2hDLE9BQU8sTUFBTSxVQUFVLFdBQVc7QUFDbEMsT0FBTyxNQUFNLFdBQVcsWUFBWTtBQUNwQyxPQUFPLE1BQU0sV0FBVyxZQUFZO0FBQ3BDLE9BQU8sTUFBTSxTQUFTLFVBQVU7QUFDaEMsT0FBTyxNQUFNLFVBQVUsV0FBVztBQUNsQyxPQUFPLE1BQU0sV0FBVyxZQUFZO0FBQ3BDLE9BQU8sTUFBTSxVQUFVLFdBQVc7QUFDbEMsT0FBTyxNQUFNLFlBQVksYUFBYTtBQUN0QyxPQUFPLE1BQU0sVUFBVSxXQUFXO0FBQ2xDLE9BQU8sTUFBTSxjQUFjLGVBQWU7QUFDMUMsT0FBTyxNQUFNLFVBQVUsV0FBVztBQUNsQyxPQUFPLE1BQU0sTUFBTSxNQUFNO0FBQ3pCLE9BQU8sTUFBTSxPQUFPLFFBQVE7QUFDNUIsT0FBTyxNQUFNLFFBQVEsU0FBUztBQUM5QixPQUFPLE1BQU0sY0FBYyxlQUFlO0FBQzFDLE9BQU8sTUFBTSxTQUFTLFVBQVU7QUFDaEMsT0FBTyxNQUFNLFdBQVcsWUFBWTtBQUNwQyxPQUFPLE1BQU0sU0FBUyxVQUFVO0FBQ2hDLE9BQU8sTUFBTSxXQUFXLFlBQVk7QUFDcEMsT0FBTyxNQUFNLGlCQUFpQixrQkFBa0I7QUFDaEQsT0FBTyxNQUFNLGVBQWUsZ0JBQWdCO0FBQzVDLE9BQU8sTUFBTSx1QkFBdUIsd0JBQXdCO0FBQzVELE9BQU8sTUFBTSxZQUFZLGFBQWE7QUFFdEMsTUFBTSxXQUFXO0lBQ2YsR0FBRyxZQUFZO0lBQ2Y7SUFDQTtJQUVBLGNBQWM7SUFDZDtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7QUFDRjtBQUVBLFNBQVMsVUFBVSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUscUJBQXFCLEVBQUUsUUFBUSxHQUFHO0FBK0J0RSxlQUFlO0lBQ2I7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtBQUNGLEVBQUUifQ==