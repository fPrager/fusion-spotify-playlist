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
import { validateBoolean, validateNumber, validateOneOf, validateString } from "../validators.mjs";
import { isIP } from "../net.ts";
import { emitInvalidHostnameWarning, getDefaultResolver, getDefaultVerbatim, isFamily, isLookupOptions, Resolver as CallbackResolver, validateHints } from "../dns/utils.ts";
import { dnsException, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE } from "../errors.ts";
import { getaddrinfo, GetAddrInfoReqWrap, QueryReqWrap } from "../../internal_binding/cares_wrap.ts";
import { toASCII } from "../idna.ts";
function onlookup(err, addresses) {
    if (err) {
        this.reject(dnsException(err, "getaddrinfo", this.hostname));
        return;
    }
    const family = this.family || isIP(addresses[0]);
    this.resolve({
        address: addresses[0],
        family
    });
}
function onlookupall(err, addresses) {
    if (err) {
        this.reject(dnsException(err, "getaddrinfo", this.hostname));
        return;
    }
    const family = this.family;
    const parsedAddresses = [];
    for(let i = 0; i < addresses.length; i++){
        const address = addresses[i];
        parsedAddresses[i] = {
            address,
            family: family ? family : isIP(address)
        };
    }
    this.resolve(parsedAddresses);
}
function createLookupPromise(family, hostname, all, hints, verbatim) {
    return new Promise((resolve, reject)=>{
        if (!hostname) {
            emitInvalidHostnameWarning(hostname);
            resolve(all ? [] : {
                address: null,
                family: family === 6 ? 6 : 4
            });
            return;
        }
        const matchedFamily = isIP(hostname);
        if (matchedFamily !== 0) {
            const result = {
                address: hostname,
                family: matchedFamily
            };
            resolve(all ? [
                result
            ] : result);
            return;
        }
        const req = new GetAddrInfoReqWrap();
        req.family = family;
        req.hostname = hostname;
        req.oncomplete = all ? onlookupall : onlookup;
        req.resolve = resolve;
        req.reject = reject;
        const err = getaddrinfo(req, toASCII(hostname), family, hints, verbatim);
        if (err) {
            reject(dnsException(err, "getaddrinfo", hostname));
        }
    });
}
const validFamilies = [
    0,
    4,
    6
];
export function lookup(hostname, options) {
    let hints = 0;
    let family = 0;
    let all = false;
    let verbatim = getDefaultVerbatim();
    // Parse arguments
    if (hostname) {
        validateString(hostname, "hostname");
    }
    if (isFamily(options)) {
        validateOneOf(options, "family", validFamilies);
        family = options;
    } else if (!isLookupOptions(options)) {
        throw new ERR_INVALID_ARG_TYPE("options", [
            "integer",
            "object"
        ], options);
    } else {
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
    return createLookupPromise(family, hostname, all, hints, verbatim);
}
function onresolve(err, records, ttls) {
    if (err) {
        this.reject(dnsException(err, this.bindingName, this.hostname));
        return;
    }
    const parsedRecords = ttls && this.ttl ? records.map((address, index)=>({
            address,
            ttl: ttls[index]
        })) : records;
    this.resolve(parsedRecords);
}
function createResolverPromise(resolver, bindingName, hostname, ttl) {
    return new Promise((resolve, reject)=>{
        const req = new QueryReqWrap();
        req.bindingName = bindingName;
        req.hostname = hostname;
        req.oncomplete = onresolve;
        req.resolve = resolve;
        req.reject = reject;
        req.ttl = ttl;
        const err = resolver._handle[bindingName](req, toASCII(hostname));
        if (err) {
            reject(dnsException(err, bindingName, hostname));
        }
    });
}
function resolver(bindingName) {
    function query(name, options) {
        validateString(name, "name");
        const ttl = !!(options && options.ttl);
        return createResolverPromise(this, bindingName, name, ttl);
    }
    Object.defineProperty(query, "name", {
        value: bindingName
    });
    return query;
}
const resolveMap = Object.create(null);
class Resolver extends CallbackResolver {
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
function _resolve(hostname, rrtype) {
    let resolver;
    if (typeof hostname !== "string") {
        throw new ERR_INVALID_ARG_TYPE("name", "string", hostname);
    }
    if (rrtype !== undefined) {
        validateString(rrtype, "rrtype");
        resolver = resolveMap[rrtype];
        if (typeof resolver !== "function") {
            throw new ERR_INVALID_ARG_VALUE("rrtype", rrtype);
        }
    } else {
        resolver = resolveMap.A;
    }
    return Reflect.apply(resolver, this, [
        hostname
    ]);
}
// The Node implementation uses `bindDefaultResolver` to set the follow methods
// on `module.exports` bound to the current `defaultResolver`. We don't have
// the same ability in ESM but can simulate this (at some cost) by explicitly
// exporting these methods which dynamically bind to the default resolver when
// called.
export function getServers() {
    return Resolver.prototype.getServers.bind(getDefaultResolver())();
}
export function resolveAny(hostname) {
    return Resolver.prototype.resolveAny.bind(getDefaultResolver())(hostname);
}
export function resolve4(hostname, options) {
    return Resolver.prototype.resolve4.bind(getDefaultResolver())(hostname, options);
}
export function resolve6(hostname, options) {
    return Resolver.prototype.resolve6.bind(getDefaultResolver())(hostname, options);
}
export function resolveCaa(hostname) {
    return Resolver.prototype.resolveCaa.bind(getDefaultResolver())(hostname);
}
export function resolveCname(hostname) {
    return Resolver.prototype.resolveCname.bind(getDefaultResolver())(hostname);
}
export function resolveMx(hostname) {
    return Resolver.prototype.resolveMx.bind(getDefaultResolver())(hostname);
}
export function resolveNs(hostname) {
    return Resolver.prototype.resolveNs.bind(getDefaultResolver())(hostname);
}
export function resolveTxt(hostname) {
    return Resolver.prototype.resolveTxt.bind(getDefaultResolver())(hostname);
}
export function resolveSrv(hostname) {
    return Resolver.prototype.resolveSrv.bind(getDefaultResolver())(hostname);
}
export function resolvePtr(hostname) {
    return Resolver.prototype.resolvePtr.bind(getDefaultResolver())(hostname);
}
export function resolveNaptr(hostname) {
    return Resolver.prototype.resolveNaptr.bind(getDefaultResolver())(hostname);
}
export function resolveSoa(hostname) {
    return Resolver.prototype.resolveSoa.bind(getDefaultResolver())(hostname);
}
export function reverse(ip) {
    return Resolver.prototype.reverse.bind(getDefaultResolver())(ip);
}
export function resolve(hostname, rrtype) {
    return Resolver.prototype.resolve.bind(getDefaultResolver())(hostname, rrtype);
}
export { Resolver };
export default {
    lookup,
    Resolver,
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
    reverse
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvZG5zL3Byb21pc2VzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHtcbiAgdmFsaWRhdGVCb29sZWFuLFxuICB2YWxpZGF0ZU51bWJlcixcbiAgdmFsaWRhdGVPbmVPZixcbiAgdmFsaWRhdGVTdHJpbmcsXG59IGZyb20gXCIuLi92YWxpZGF0b3JzLm1qc1wiO1xuaW1wb3J0IHsgaXNJUCB9IGZyb20gXCIuLi9uZXQudHNcIjtcbmltcG9ydCB7XG4gIGVtaXRJbnZhbGlkSG9zdG5hbWVXYXJuaW5nLFxuICBnZXREZWZhdWx0UmVzb2x2ZXIsXG4gIGdldERlZmF1bHRWZXJiYXRpbSxcbiAgaXNGYW1pbHksXG4gIGlzTG9va3VwT3B0aW9ucyxcbiAgUmVzb2x2ZXIgYXMgQ2FsbGJhY2tSZXNvbHZlcixcbiAgdmFsaWRhdGVIaW50cyxcbn0gZnJvbSBcIi4uL2Rucy91dGlscy50c1wiO1xuaW1wb3J0IHR5cGUge1xuICBMb29rdXBBZGRyZXNzLFxuICBMb29rdXBBbGxPcHRpb25zLFxuICBMb29rdXBPbmVPcHRpb25zLFxuICBMb29rdXBPcHRpb25zLFxuICBSZWNvcmRzLFxuICBSZXNvbHZlT3B0aW9ucyxcbiAgUmVzb2x2ZVdpdGhUdGxPcHRpb25zLFxufSBmcm9tIFwiLi4vZG5zL3V0aWxzLnRzXCI7XG5pbXBvcnQge1xuICBkbnNFeGNlcHRpb24sXG4gIEVSUl9JTlZBTElEX0FSR19UWVBFLFxuICBFUlJfSU5WQUxJRF9BUkdfVkFMVUUsXG59IGZyb20gXCIuLi9lcnJvcnMudHNcIjtcbmltcG9ydCB7XG4gIENoYW5uZWxXcmFwUXVlcnksXG4gIGdldGFkZHJpbmZvLFxuICBHZXRBZGRySW5mb1JlcVdyYXAsXG4gIFF1ZXJ5UmVxV3JhcCxcbn0gZnJvbSBcIi4uLy4uL2ludGVybmFsX2JpbmRpbmcvY2FyZXNfd3JhcC50c1wiO1xuaW1wb3J0IHsgdG9BU0NJSSB9IGZyb20gXCIuLi9pZG5hLnRzXCI7XG5cbmZ1bmN0aW9uIG9ubG9va3VwKFxuICB0aGlzOiBHZXRBZGRySW5mb1JlcVdyYXAsXG4gIGVycjogbnVtYmVyIHwgbnVsbCxcbiAgYWRkcmVzc2VzOiBzdHJpbmdbXSxcbikge1xuICBpZiAoZXJyKSB7XG4gICAgdGhpcy5yZWplY3QoZG5zRXhjZXB0aW9uKGVyciwgXCJnZXRhZGRyaW5mb1wiLCB0aGlzLmhvc3RuYW1lKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZmFtaWx5ID0gdGhpcy5mYW1pbHkgfHwgaXNJUChhZGRyZXNzZXNbMF0pO1xuICB0aGlzLnJlc29sdmUoeyBhZGRyZXNzOiBhZGRyZXNzZXNbMF0sIGZhbWlseSB9KTtcbn1cblxuZnVuY3Rpb24gb25sb29rdXBhbGwoXG4gIHRoaXM6IEdldEFkZHJJbmZvUmVxV3JhcCxcbiAgZXJyOiBudW1iZXIgfCBudWxsLFxuICBhZGRyZXNzZXM6IHN0cmluZ1tdLFxuKSB7XG4gIGlmIChlcnIpIHtcbiAgICB0aGlzLnJlamVjdChkbnNFeGNlcHRpb24oZXJyLCBcImdldGFkZHJpbmZvXCIsIHRoaXMuaG9zdG5hbWUpKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGZhbWlseSA9IHRoaXMuZmFtaWx5O1xuICBjb25zdCBwYXJzZWRBZGRyZXNzZXMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZHJlc3Nlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGFkZHJlc3MgPSBhZGRyZXNzZXNbaV07XG4gICAgcGFyc2VkQWRkcmVzc2VzW2ldID0ge1xuICAgICAgYWRkcmVzcyxcbiAgICAgIGZhbWlseTogZmFtaWx5ID8gZmFtaWx5IDogaXNJUChhZGRyZXNzKSxcbiAgICB9O1xuICB9XG5cbiAgdGhpcy5yZXNvbHZlKHBhcnNlZEFkZHJlc3Nlcyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxvb2t1cFByb21pc2UoXG4gIGZhbWlseTogbnVtYmVyLFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBhbGw6IGJvb2xlYW4sXG4gIGhpbnRzOiBudW1iZXIsXG4gIHZlcmJhdGltOiBib29sZWFuLFxuKTogUHJvbWlzZTx2b2lkIHwgTG9va3VwQWRkcmVzcyB8IExvb2t1cEFkZHJlc3NbXT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGlmICghaG9zdG5hbWUpIHtcbiAgICAgIGVtaXRJbnZhbGlkSG9zdG5hbWVXYXJuaW5nKGhvc3RuYW1lKTtcbiAgICAgIHJlc29sdmUoYWxsID8gW10gOiB7IGFkZHJlc3M6IG51bGwsIGZhbWlseTogZmFtaWx5ID09PSA2ID8gNiA6IDQgfSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaGVkRmFtaWx5ID0gaXNJUChob3N0bmFtZSk7XG5cbiAgICBpZiAobWF0Y2hlZEZhbWlseSAhPT0gMCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0geyBhZGRyZXNzOiBob3N0bmFtZSwgZmFtaWx5OiBtYXRjaGVkRmFtaWx5IH07XG4gICAgICByZXNvbHZlKGFsbCA/IFtyZXN1bHRdIDogcmVzdWx0KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJlcSA9IG5ldyBHZXRBZGRySW5mb1JlcVdyYXAoKTtcblxuICAgIHJlcS5mYW1pbHkgPSBmYW1pbHk7XG4gICAgcmVxLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgcmVxLm9uY29tcGxldGUgPSBhbGwgPyBvbmxvb2t1cGFsbCA6IG9ubG9va3VwO1xuICAgIHJlcS5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICByZXEucmVqZWN0ID0gcmVqZWN0O1xuXG4gICAgY29uc3QgZXJyID0gZ2V0YWRkcmluZm8ocmVxLCB0b0FTQ0lJKGhvc3RuYW1lKSwgZmFtaWx5LCBoaW50cywgdmVyYmF0aW0pO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgcmVqZWN0KGRuc0V4Y2VwdGlvbihlcnIsIFwiZ2V0YWRkcmluZm9cIiwgaG9zdG5hbWUpKTtcbiAgICB9XG4gIH0pO1xufVxuXG5jb25zdCB2YWxpZEZhbWlsaWVzID0gWzAsIDQsIDZdO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBmYW1pbHk6IG51bWJlcixcbik6IFByb21pc2U8dm9pZCB8IExvb2t1cEFkZHJlc3MgfCBMb29rdXBBZGRyZXNzW10+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogTG9va3VwT25lT3B0aW9ucyxcbik6IFByb21pc2U8dm9pZCB8IExvb2t1cEFkZHJlc3MgfCBMb29rdXBBZGRyZXNzW10+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogTG9va3VwQWxsT3B0aW9ucyxcbik6IFByb21pc2U8dm9pZCB8IExvb2t1cEFkZHJlc3MgfCBMb29rdXBBZGRyZXNzW10+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogTG9va3VwT3B0aW9ucyxcbik6IFByb21pc2U8dm9pZCB8IExvb2t1cEFkZHJlc3MgfCBMb29rdXBBZGRyZXNzW10+O1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogdW5rbm93bixcbik6IFByb21pc2U8dm9pZCB8IExvb2t1cEFkZHJlc3MgfCBMb29rdXBBZGRyZXNzW10+IHtcbiAgbGV0IGhpbnRzID0gMDtcbiAgbGV0IGZhbWlseSA9IDA7XG4gIGxldCBhbGwgPSBmYWxzZTtcbiAgbGV0IHZlcmJhdGltID0gZ2V0RGVmYXVsdFZlcmJhdGltKCk7XG5cbiAgLy8gUGFyc2UgYXJndW1lbnRzXG4gIGlmIChob3N0bmFtZSkge1xuICAgIHZhbGlkYXRlU3RyaW5nKGhvc3RuYW1lLCBcImhvc3RuYW1lXCIpO1xuICB9XG5cbiAgaWYgKGlzRmFtaWx5KG9wdGlvbnMpKSB7XG4gICAgdmFsaWRhdGVPbmVPZihvcHRpb25zLCBcImZhbWlseVwiLCB2YWxpZEZhbWlsaWVzKTtcbiAgICBmYW1pbHkgPSBvcHRpb25zO1xuICB9IGVsc2UgaWYgKCFpc0xvb2t1cE9wdGlvbnMob3B0aW9ucykpIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXCJvcHRpb25zXCIsIFtcImludGVnZXJcIiwgXCJvYmplY3RcIl0sIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIGlmIChvcHRpb25zPy5oaW50cyAhPSBudWxsKSB7XG4gICAgICB2YWxpZGF0ZU51bWJlcihvcHRpb25zLmhpbnRzLCBcIm9wdGlvbnMuaGludHNcIik7XG4gICAgICBoaW50cyA9IG9wdGlvbnMuaGludHMgPj4+IDA7XG4gICAgICB2YWxpZGF0ZUhpbnRzKGhpbnRzKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucz8uZmFtaWx5ICE9IG51bGwpIHtcbiAgICAgIHZhbGlkYXRlT25lT2Yob3B0aW9ucy5mYW1pbHksIFwib3B0aW9ucy5mYW1pbHlcIiwgdmFsaWRGYW1pbGllcyk7XG4gICAgICBmYW1pbHkgPSBvcHRpb25zLmZhbWlseTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucz8uYWxsICE9IG51bGwpIHtcbiAgICAgIHZhbGlkYXRlQm9vbGVhbihvcHRpb25zLmFsbCwgXCJvcHRpb25zLmFsbFwiKTtcbiAgICAgIGFsbCA9IG9wdGlvbnMuYWxsO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zPy52ZXJiYXRpbSAhPSBudWxsKSB7XG4gICAgICB2YWxpZGF0ZUJvb2xlYW4ob3B0aW9ucy52ZXJiYXRpbSwgXCJvcHRpb25zLnZlcmJhdGltXCIpO1xuICAgICAgdmVyYmF0aW0gPSBvcHRpb25zLnZlcmJhdGltO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjcmVhdGVMb29rdXBQcm9taXNlKGZhbWlseSwgaG9zdG5hbWUsIGFsbCwgaGludHMsIHZlcmJhdGltKTtcbn1cblxuZnVuY3Rpb24gb25yZXNvbHZlKFxuICB0aGlzOiBRdWVyeVJlcVdyYXAsXG4gIGVycjogbnVtYmVyLFxuICByZWNvcmRzOiBSZWNvcmRzLFxuICB0dGxzPzogbnVtYmVyW10sXG4pIHtcbiAgaWYgKGVycikge1xuICAgIHRoaXMucmVqZWN0KGRuc0V4Y2VwdGlvbihlcnIsIHRoaXMuYmluZGluZ05hbWUsIHRoaXMuaG9zdG5hbWUpKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHBhcnNlZFJlY29yZHMgPSB0dGxzICYmIHRoaXMudHRsXG4gICAgPyAocmVjb3JkcyBhcyBzdHJpbmdbXSkubWFwKChhZGRyZXNzOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+ICh7XG4gICAgICBhZGRyZXNzLFxuICAgICAgdHRsOiB0dGxzW2luZGV4XSxcbiAgICB9KSlcbiAgICA6IHJlY29yZHM7XG5cbiAgdGhpcy5yZXNvbHZlKHBhcnNlZFJlY29yZHMpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSZXNvbHZlclByb21pc2UoXG4gIHJlc29sdmVyOiBSZXNvbHZlcixcbiAgYmluZGluZ05hbWU6IGtleW9mIENoYW5uZWxXcmFwUXVlcnksXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHR0bDogYm9vbGVhbixcbikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHJlcSA9IG5ldyBRdWVyeVJlcVdyYXAoKTtcblxuICAgIHJlcS5iaW5kaW5nTmFtZSA9IGJpbmRpbmdOYW1lO1xuICAgIHJlcS5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgIHJlcS5vbmNvbXBsZXRlID0gb25yZXNvbHZlO1xuICAgIHJlcS5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICByZXEucmVqZWN0ID0gcmVqZWN0O1xuICAgIHJlcS50dGwgPSB0dGw7XG5cbiAgICBjb25zdCBlcnIgPSByZXNvbHZlci5faGFuZGxlW2JpbmRpbmdOYW1lXShyZXEsIHRvQVNDSUkoaG9zdG5hbWUpKTtcblxuICAgIGlmIChlcnIpIHtcbiAgICAgIHJlamVjdChkbnNFeGNlcHRpb24oZXJyLCBiaW5kaW5nTmFtZSwgaG9zdG5hbWUpKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlcihiaW5kaW5nTmFtZToga2V5b2YgQ2hhbm5lbFdyYXBRdWVyeSkge1xuICBmdW5jdGlvbiBxdWVyeShcbiAgICB0aGlzOiBSZXNvbHZlcixcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHVua25vd24sXG4gICkge1xuICAgIHZhbGlkYXRlU3RyaW5nKG5hbWUsIFwibmFtZVwiKTtcblxuICAgIGNvbnN0IHR0bCA9ICEhKG9wdGlvbnMgJiYgKG9wdGlvbnMgYXMgUmVzb2x2ZU9wdGlvbnMpLnR0bCk7XG5cbiAgICByZXR1cm4gY3JlYXRlUmVzb2x2ZXJQcm9taXNlKHRoaXMsIGJpbmRpbmdOYW1lLCBuYW1lLCB0dGwpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHF1ZXJ5LCBcIm5hbWVcIiwgeyB2YWx1ZTogYmluZGluZ05hbWUgfSk7XG5cbiAgcmV0dXJuIHF1ZXJ5O1xufVxuXG5jb25zdCByZXNvbHZlTWFwID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuY2xhc3MgUmVzb2x2ZXIgZXh0ZW5kcyBDYWxsYmFja1Jlc29sdmVyIHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgW3Jlc29sdmVNZXRob2Q6IHN0cmluZ106IGFueTtcbn1cblxuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVBbnkgPSByZXNvbHZlTWFwLkFOWSA9IHJlc29sdmVyKFwicXVlcnlBbnlcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZTQgPSByZXNvbHZlTWFwLkEgPSByZXNvbHZlcihcInF1ZXJ5QVwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlNiA9IHJlc29sdmVNYXAuQUFBQSA9IHJlc29sdmVyKFwicXVlcnlBYWFhXCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVDYWEgPSByZXNvbHZlTWFwLkNBQSA9IHJlc29sdmVyKFwicXVlcnlDYWFcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZUNuYW1lID0gcmVzb2x2ZU1hcC5DTkFNRSA9IHJlc29sdmVyKFwicXVlcnlDbmFtZVwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlTXggPSByZXNvbHZlTWFwLk1YID0gcmVzb2x2ZXIoXCJxdWVyeU14XCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVOcyA9IHJlc29sdmVNYXAuTlMgPSByZXNvbHZlcihcInF1ZXJ5TnNcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVR4dCA9IHJlc29sdmVNYXAuVFhUID0gcmVzb2x2ZXIoXCJxdWVyeVR4dFwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlU3J2ID0gcmVzb2x2ZU1hcC5TUlYgPSByZXNvbHZlcihcInF1ZXJ5U3J2XCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVQdHIgPSByZXNvbHZlTWFwLlBUUiA9IHJlc29sdmVyKFwicXVlcnlQdHJcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZU5hcHRyID0gcmVzb2x2ZU1hcC5OQVBUUiA9IHJlc29sdmVyKFwicXVlcnlOYXB0clwiKTtcblJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlU29hID0gcmVzb2x2ZU1hcC5TT0EgPSByZXNvbHZlcihcInF1ZXJ5U29hXCIpO1xuUmVzb2x2ZXIucHJvdG90eXBlLnJldmVyc2UgPSByZXNvbHZlcihcImdldEhvc3RCeUFkZHJcIik7XG5SZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZSA9IF9yZXNvbHZlO1xuXG5mdW5jdGlvbiBfcmVzb2x2ZShcbiAgdGhpczogUmVzb2x2ZXIsXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZT86IHN0cmluZyxcbikge1xuICBsZXQgcmVzb2x2ZXI7XG5cbiAgaWYgKHR5cGVvZiBob3N0bmFtZSAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9BUkdfVFlQRShcIm5hbWVcIiwgXCJzdHJpbmdcIiwgaG9zdG5hbWUpO1xuICB9XG5cbiAgaWYgKHJydHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFsaWRhdGVTdHJpbmcocnJ0eXBlLCBcInJydHlwZVwiKTtcblxuICAgIHJlc29sdmVyID0gcmVzb2x2ZU1hcFtycnR5cGVdO1xuXG4gICAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1ZBTFVFKFwicnJ0eXBlXCIsIHJydHlwZSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlc29sdmVyID0gcmVzb2x2ZU1hcC5BO1xuICB9XG5cbiAgcmV0dXJuIFJlZmxlY3QuYXBwbHkocmVzb2x2ZXIsIHRoaXMsIFtob3N0bmFtZV0pO1xufVxuXG4vLyBUaGUgTm9kZSBpbXBsZW1lbnRhdGlvbiB1c2VzIGBiaW5kRGVmYXVsdFJlc29sdmVyYCB0byBzZXQgdGhlIGZvbGxvdyBtZXRob2RzXG4vLyBvbiBgbW9kdWxlLmV4cG9ydHNgIGJvdW5kIHRvIHRoZSBjdXJyZW50IGBkZWZhdWx0UmVzb2x2ZXJgLiBXZSBkb24ndCBoYXZlXG4vLyB0aGUgc2FtZSBhYmlsaXR5IGluIEVTTSBidXQgY2FuIHNpbXVsYXRlIHRoaXMgKGF0IHNvbWUgY29zdCkgYnkgZXhwbGljaXRseVxuLy8gZXhwb3J0aW5nIHRoZXNlIG1ldGhvZHMgd2hpY2ggZHluYW1pY2FsbHkgYmluZCB0byB0aGUgZGVmYXVsdCByZXNvbHZlciB3aGVuXG4vLyBjYWxsZWQuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJ2ZXJzKCk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5nZXRTZXJ2ZXJzLmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkpKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQW55KFxuICBob3N0bmFtZTogc3RyaW5nLFxuKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZUFueS5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICBob3N0bmFtZSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU0KFxuICBob3N0bmFtZTogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlNChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogUmVzb2x2ZVdpdGhUdGxPcHRpb25zLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlNChcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogUmVzb2x2ZU9wdGlvbnMsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU0KGhvc3RuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiB1bmtub3duKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZTQuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICAgb3B0aW9ucyxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU2KGhvc3RuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU2KFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBSZXNvbHZlV2l0aFR0bE9wdGlvbnMsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmU2KFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBSZXNvbHZlT3B0aW9ucyxcbik6IFByb21pc2U8dm9pZD47XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZTYoaG9zdG5hbWU6IHN0cmluZywgb3B0aW9ucz86IHVua25vd24pIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlNi5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICBob3N0bmFtZSxcbiAgICBvcHRpb25zLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNhYShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbikge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVDYWEuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ25hbWUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4pIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlQ25hbWUuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTXgoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4pIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlTXguYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTnMoaG9zdG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVOcy5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICBob3N0bmFtZSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVUeHQoaG9zdG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmVUeHQuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU3J2KGhvc3RuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIFJlc29sdmVyLnByb3RvdHlwZS5yZXNvbHZlU3J2LmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIGhvc3RuYW1lLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVB0cihob3N0bmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVB0ci5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICBob3N0bmFtZSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVOYXB0cihob3N0bmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZU5hcHRyLmJpbmQoZ2V0RGVmYXVsdFJlc29sdmVyKCkgYXMgUmVzb2x2ZXIpKFxuICAgIGhvc3RuYW1lLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNvYShob3N0bmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZVNvYS5iaW5kKGdldERlZmF1bHRSZXNvbHZlcigpIGFzIFJlc29sdmVyKShcbiAgICBob3N0bmFtZSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJldmVyc2UoaXA6IHN0cmluZykge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJldmVyc2UuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaXAsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiQVwiLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiQUFBQVwiLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiQU5ZXCIsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJDTkFNRVwiLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiTVhcIixcbik6IFByb21pc2U8dm9pZD47XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgcnJ0eXBlOiBcIk5BUFRSXCIsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJOU1wiLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiUFRSXCIsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogXCJTT0FcIixcbik6IFByb21pc2U8dm9pZD47XG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShcbiAgaG9zdG5hbWU6IHN0cmluZyxcbiAgcnJ0eXBlOiBcIlNSVlwiLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBob3N0bmFtZTogc3RyaW5nLFxuICBycnR5cGU6IFwiVFhUXCIsXG4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIHJydHlwZTogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKGhvc3RuYW1lOiBzdHJpbmcsIHJydHlwZT86IHN0cmluZykge1xuICByZXR1cm4gUmVzb2x2ZXIucHJvdG90eXBlLnJlc29sdmUuYmluZChnZXREZWZhdWx0UmVzb2x2ZXIoKSBhcyBSZXNvbHZlcikoXG4gICAgaG9zdG5hbWUsXG4gICAgcnJ0eXBlLFxuICApO1xufVxuXG5leHBvcnQgeyBSZXNvbHZlciB9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGxvb2t1cCxcbiAgUmVzb2x2ZXIsXG4gIGdldFNlcnZlcnMsXG4gIHJlc29sdmVBbnksXG4gIHJlc29sdmU0LFxuICByZXNvbHZlNixcbiAgcmVzb2x2ZUNhYSxcbiAgcmVzb2x2ZUNuYW1lLFxuICByZXNvbHZlTXgsXG4gIHJlc29sdmVOcyxcbiAgcmVzb2x2ZVR4dCxcbiAgcmVzb2x2ZVNydixcbiAgcmVzb2x2ZVB0cixcbiAgcmVzb2x2ZU5hcHRyLFxuICByZXNvbHZlU29hLFxuICByZXNvbHZlLFxuICByZXZlcnNlLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUs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