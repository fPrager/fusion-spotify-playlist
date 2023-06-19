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
import { getOptionValue } from "../options.ts";
import { emitWarning } from "../../process.ts";
import { AI_ADDRCONFIG, AI_ALL, AI_V4MAPPED } from "../../internal_binding/ares.ts";
import { ChannelWrap, strerror } from "../../internal_binding/cares_wrap.ts";
import { ERR_DNS_SET_SERVERS_FAILED, ERR_INVALID_ARG_VALUE, ERR_INVALID_IP_ADDRESS } from "../errors.ts";
import { validateArray, validateInt32, validateOneOf, validateString } from "../validators.mjs";
import { isIP } from "../net.ts";
export function isLookupOptions(options) {
    return typeof options === "object" || typeof options === "undefined";
}
export function isLookupCallback(options) {
    return typeof options === "function";
}
export function isFamily(options) {
    return typeof options === "number";
}
export function isResolveCallback(callback) {
    return typeof callback === "function";
}
const IANA_DNS_PORT = 53;
const IPv6RE = /^\[([^[\]]*)\]/;
const addrSplitRE = /(^.+?)(?::(\d+))?$/;
export function validateTimeout(options) {
    const { timeout =-1  } = {
        ...options
    };
    validateInt32(timeout, "options.timeout", -1, 2 ** 31 - 1);
    return timeout;
}
export function validateTries(options) {
    const { tries =4  } = {
        ...options
    };
    validateInt32(tries, "options.tries", 1, 2 ** 31 - 1);
    return tries;
}
/**
 * An independent resolver for DNS requests.
 *
 * Creating a new resolver uses the default server settings. Setting
 * the servers used for a resolver using `resolver.setServers()` does not affect
 * other resolvers:
 *
 * ```js
 * const { Resolver } = require('dns');
 * const resolver = new Resolver();
 * resolver.setServers(['4.4.4.4']);
 *
 * // This request will use the server at 4.4.4.4, independent of global settings.
 * resolver.resolve4('example.org', (err, addresses) => {
 *   // ...
 * });
 * ```
 *
 * The following methods from the `dns` module are available:
 *
 * - `resolver.getServers()`
 * - `resolver.resolve()`
 * - `resolver.resolve4()`
 * - `resolver.resolve6()`
 * - `resolver.resolveAny()`
 * - `resolver.resolveCaa()`
 * - `resolver.resolveCname()`
 * - `resolver.resolveMx()`
 * - `resolver.resolveNaptr()`
 * - `resolver.resolveNs()`
 * - `resolver.resolvePtr()`
 * - `resolver.resolveSoa()`
 * - `resolver.resolveSrv()`
 * - `resolver.resolveTxt()`
 * - `resolver.reverse()`
 * - `resolver.setServers()`
 */ export class Resolver {
    _handle;
    constructor(options){
        const timeout = validateTimeout(options);
        const tries = validateTries(options);
        this._handle = new ChannelWrap(timeout, tries);
    }
    cancel() {
        this._handle.cancel();
    }
    getServers() {
        return this._handle.getServers().map((val)=>{
            if (!val[1] || val[1] === IANA_DNS_PORT) {
                return val[0];
            }
            const host = isIP(val[0]) === 6 ? `[${val[0]}]` : val[0];
            return `${host}:${val[1]}`;
        });
    }
    setServers(servers) {
        validateArray(servers, "servers");
        // Cache the original servers because in the event of an error while
        // setting the servers, c-ares won't have any servers available for
        // resolution.
        const orig = this._handle.getServers();
        const newSet = [];
        servers.forEach((serv, index)=>{
            validateString(serv, `servers[${index}]`);
            let ipVersion = isIP(serv);
            if (ipVersion !== 0) {
                return newSet.push([
                    ipVersion,
                    serv,
                    IANA_DNS_PORT
                ]);
            }
            const match = serv.match(IPv6RE);
            // Check for an IPv6 in brackets.
            if (match) {
                ipVersion = isIP(match[1]);
                if (ipVersion !== 0) {
                    const port = Number.parseInt(serv.replace(addrSplitRE, "$2")) || IANA_DNS_PORT;
                    return newSet.push([
                        ipVersion,
                        match[1],
                        port
                    ]);
                }
            }
            // addr::port
            const addrSplitMatch = serv.match(addrSplitRE);
            if (addrSplitMatch) {
                const hostIP = addrSplitMatch[1];
                const port1 = addrSplitMatch[2] || `${IANA_DNS_PORT}`;
                ipVersion = isIP(hostIP);
                if (ipVersion !== 0) {
                    return newSet.push([
                        ipVersion,
                        hostIP,
                        Number.parseInt(port1)
                    ]);
                }
            }
            throw new ERR_INVALID_IP_ADDRESS(serv);
        });
        const errorNumber = this._handle.setServers(newSet);
        if (errorNumber !== 0) {
            // Reset the servers to the old servers, because ares probably unset them.
            this._handle.setServers(orig.join(","));
            const err = strerror(errorNumber);
            throw new ERR_DNS_SET_SERVERS_FAILED(err, servers.toString());
        }
    }
    /**
   * The resolver instance will send its requests from the specified IP address.
   * This allows programs to specify outbound interfaces when used on multi-homed
   * systems.
   *
   * If a v4 or v6 address is not specified, it is set to the default, and the
   * operating system will choose a local address automatically.
   *
   * The resolver will use the v4 local address when making requests to IPv4 DNS
   * servers, and the v6 local address when making requests to IPv6 DNS servers.
   * The `rrtype` of resolution requests has no impact on the local address used.
   *
   * @param [ipv4='0.0.0.0'] A string representation of an IPv4 address.
   * @param [ipv6='::0'] A string representation of an IPv6 address.
   */ setLocalAddress(ipv4, ipv6) {
        validateString(ipv4, "ipv4");
        if (ipv6 !== undefined) {
            validateString(ipv6, "ipv6");
        }
        this._handle.setLocalAddress(ipv4, ipv6);
    }
}
let defaultResolver = new Resolver();
export function getDefaultResolver() {
    return defaultResolver;
}
export function setDefaultResolver(resolver) {
    defaultResolver = resolver;
}
export function validateHints(hints) {
    if ((hints & ~(AI_ADDRCONFIG | AI_ALL | AI_V4MAPPED)) !== 0) {
        throw new ERR_INVALID_ARG_VALUE("hints", hints, "is invalid");
    }
}
let invalidHostnameWarningEmitted = false;
export function emitInvalidHostnameWarning(hostname) {
    if (invalidHostnameWarningEmitted) {
        return;
    }
    invalidHostnameWarningEmitted = true;
    emitWarning(`The provided hostname "${hostname}" is not a valid ` + "hostname, and is supported in the dns module solely for compatibility.", "DeprecationWarning", "DEP0118");
}
let dnsOrder = getOptionValue("--dns-result-order") || "ipv4first";
export function getDefaultVerbatim() {
    switch(dnsOrder){
        case "verbatim":
            {
                return true;
            }
        case "ipv4first":
            {
                return false;
            }
        default:
            {
                return false;
            }
    }
}
/**
 * Set the default value of `verbatim` in `lookup` and `dnsPromises.lookup()`.
 * The value could be:
 *
 * - `ipv4first`: sets default `verbatim` `false`.
 * - `verbatim`: sets default `verbatim` `true`.
 *
 * The default is `ipv4first` and `setDefaultResultOrder` have higher
 * priority than `--dns-result-order`. When using `worker threads`,
 * `setDefaultResultOrder` from the main thread won't affect the default
 * dns orders in workers.
 *
 * @param order must be `'ipv4first'` or `'verbatim'`.
 */ export function setDefaultResultOrder(order) {
    validateOneOf(order, "dnsOrder", [
        "verbatim",
        "ipv4first"
    ]);
    dnsOrder = order;
}
export function defaultResolverSetServers(servers) {
    const resolver = new Resolver();
    resolver.setServers(servers);
    setDefaultResolver(resolver);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvZG5zL3V0aWxzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuaW1wb3J0IHsgZ2V0T3B0aW9uVmFsdWUgfSBmcm9tIFwiLi4vb3B0aW9ucy50c1wiO1xuaW1wb3J0IHsgZW1pdFdhcm5pbmcgfSBmcm9tIFwiLi4vLi4vcHJvY2Vzcy50c1wiO1xuaW1wb3J0IHtcbiAgQUlfQUREUkNPTkZJRyxcbiAgQUlfQUxMLFxuICBBSV9WNE1BUFBFRCxcbn0gZnJvbSBcIi4uLy4uL2ludGVybmFsX2JpbmRpbmcvYXJlcy50c1wiO1xuaW1wb3J0IHsgQ2hhbm5lbFdyYXAsIHN0cmVycm9yIH0gZnJvbSBcIi4uLy4uL2ludGVybmFsX2JpbmRpbmcvY2FyZXNfd3JhcC50c1wiO1xuaW1wb3J0IHtcbiAgRVJSX0ROU19TRVRfU0VSVkVSU19GQUlMRUQsXG4gIEVSUl9JTlZBTElEX0FSR19WQUxVRSxcbiAgRVJSX0lOVkFMSURfSVBfQUREUkVTUyxcbn0gZnJvbSBcIi4uL2Vycm9ycy50c1wiO1xuaW1wb3J0IHR5cGUgeyBFcnJub0V4Y2VwdGlvbiB9IGZyb20gXCIuLi9lcnJvcnMudHNcIjtcbmltcG9ydCB7XG4gIHZhbGlkYXRlQXJyYXksXG4gIHZhbGlkYXRlSW50MzIsXG4gIHZhbGlkYXRlT25lT2YsXG4gIHZhbGlkYXRlU3RyaW5nLFxufSBmcm9tIFwiLi4vdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IGlzSVAgfSBmcm9tIFwiLi4vbmV0LnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9va3VwT3B0aW9ucyB7XG4gIGZhbWlseT86IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgaGludHM/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGFsbD86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gIHZlcmJhdGltPzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb29rdXBPbmVPcHRpb25zIGV4dGVuZHMgTG9va3VwT3B0aW9ucyB7XG4gIGFsbD86IGZhbHNlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExvb2t1cEFsbE9wdGlvbnMgZXh0ZW5kcyBMb29rdXBPcHRpb25zIHtcbiAgYWxsOiB0cnVlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExvb2t1cEFkZHJlc3Mge1xuICBhZGRyZXNzOiBzdHJpbmcgfCBudWxsO1xuICBmYW1pbHk6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTG9va3VwT3B0aW9ucyhcbiAgb3B0aW9uczogdW5rbm93bixcbik6IG9wdGlvbnMgaXMgTG9va3VwT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiB0eXBlb2Ygb3B0aW9ucyA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2Ygb3B0aW9ucyA9PT0gXCJ1bmRlZmluZWRcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTG9va3VwQ2FsbGJhY2soXG4gIG9wdGlvbnM6IHVua25vd24sXG4pOiBvcHRpb25zIGlzICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQge1xuICByZXR1cm4gdHlwZW9mIG9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRmFtaWx5KG9wdGlvbnM6IHVua25vd24pOiBvcHRpb25zIGlzIG51bWJlciB7XG4gIHJldHVybiB0eXBlb2Ygb3B0aW9ucyA9PT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXNvbHZlT3B0aW9ucyB7XG4gIHR0bD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb2x2ZVdpdGhUdGxPcHRpb25zIGV4dGVuZHMgUmVzb2x2ZU9wdGlvbnMge1xuICB0dGw6IHRydWU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjb3JkV2l0aFR0bCB7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgdHRsOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW55QVJlY29yZCBleHRlbmRzIFJlY29yZFdpdGhUdGwge1xuICB0eXBlOiBcIkFcIjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbnlBYWFhUmVjb3JkIGV4dGVuZHMgUmVjb3JkV2l0aFR0bCB7XG4gIHR5cGU6IFwiQUFBQVwiO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhYVJlY29yZCB7XG4gIGNyaXRpYWw6IG51bWJlcjtcbiAgaXNzdWU/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGlzc3Vld2lsZD86IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaW9kZWY/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGNvbnRhY3RlbWFpbD86IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29udGFjdHBob25lPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE14UmVjb3JkIHtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgZXhjaGFuZ2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbnlNeFJlY29yZCBleHRlbmRzIE14UmVjb3JkIHtcbiAgdHlwZTogXCJNWFwiO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5hcHRyUmVjb3JkIHtcbiAgZmxhZ3M6IHN0cmluZztcbiAgc2VydmljZTogc3RyaW5nO1xuICByZWdleHA6IHN0cmluZztcbiAgcmVwbGFjZW1lbnQ6IHN0cmluZztcbiAgb3JkZXI6IG51bWJlcjtcbiAgcHJlZmVyZW5jZTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFueU5hcHRyUmVjb3JkIGV4dGVuZHMgTmFwdHJSZWNvcmQge1xuICB0eXBlOiBcIk5BUFRSXCI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU29hUmVjb3JkIHtcbiAgbnNuYW1lOiBzdHJpbmc7XG4gIGhvc3RtYXN0ZXI6IHN0cmluZztcbiAgc2VyaWFsOiBudW1iZXI7XG4gIHJlZnJlc2g6IG51bWJlcjtcbiAgcmV0cnk6IG51bWJlcjtcbiAgZXhwaXJlOiBudW1iZXI7XG4gIG1pbnR0bDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFueVNvYVJlY29yZCBleHRlbmRzIFNvYVJlY29yZCB7XG4gIHR5cGU6IFwiU09BXCI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3J2UmVjb3JkIHtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgd2VpZ2h0OiBudW1iZXI7XG4gIHBvcnQ6IG51bWJlcjtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFueVNydlJlY29yZCBleHRlbmRzIFNydlJlY29yZCB7XG4gIHR5cGU6IFwiU1JWXCI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW55VHh0UmVjb3JkIHtcbiAgdHlwZTogXCJUWFRcIjtcbiAgZW50cmllczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW55TnNSZWNvcmQge1xuICB0eXBlOiBcIk5TXCI7XG4gIHZhbHVlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW55UHRyUmVjb3JkIHtcbiAgdHlwZTogXCJQVFJcIjtcbiAgdmFsdWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbnlDbmFtZVJlY29yZCB7XG4gIHR5cGU6IFwiQ05BTUVcIjtcbiAgdmFsdWU6IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgQW55UmVjb3JkID1cbiAgfCBBbnlBUmVjb3JkXG4gIHwgQW55QWFhYVJlY29yZFxuICB8IEFueUNuYW1lUmVjb3JkXG4gIHwgQW55TXhSZWNvcmRcbiAgfCBBbnlOYXB0clJlY29yZFxuICB8IEFueU5zUmVjb3JkXG4gIHwgQW55UHRyUmVjb3JkXG4gIHwgQW55U29hUmVjb3JkXG4gIHwgQW55U3J2UmVjb3JkXG4gIHwgQW55VHh0UmVjb3JkO1xuXG5leHBvcnQgdHlwZSBSZWNvcmRzID1cbiAgfCBzdHJpbmdbXVxuICB8IEFueVJlY29yZFtdXG4gIHwgTXhSZWNvcmRbXVxuICB8IE5hcHRyUmVjb3JkW11cbiAgfCBTb2FSZWNvcmRcbiAgfCBTcnZSZWNvcmRbXVxuICB8IHN0cmluZ1tdO1xuXG5leHBvcnQgdHlwZSBSZXNvbHZlQ2FsbGJhY2sgPSAoXG4gIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICBhZGRyZXNzZXM6IFJlY29yZHMsXG4pID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Jlc29sdmVDYWxsYmFjayhcbiAgY2FsbGJhY2s6IHVua25vd24sXG4pOiBjYWxsYmFjayBpcyBSZXNvbHZlQ2FsbGJhY2sge1xuICByZXR1cm4gdHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmNvbnN0IElBTkFfRE5TX1BPUlQgPSA1MztcbmNvbnN0IElQdjZSRSA9IC9eXFxbKFteW1xcXV0qKVxcXS87XG5jb25zdCBhZGRyU3BsaXRSRSA9IC8oXi4rPykoPzo6KFxcZCspKT8kLztcblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVGltZW91dChvcHRpb25zPzogeyB0aW1lb3V0PzogbnVtYmVyIH0pIHtcbiAgY29uc3QgeyB0aW1lb3V0ID0gLTEgfSA9IHsgLi4ub3B0aW9ucyB9O1xuICB2YWxpZGF0ZUludDMyKHRpbWVvdXQsIFwib3B0aW9ucy50aW1lb3V0XCIsIC0xLCAyICoqIDMxIC0gMSk7XG4gIHJldHVybiB0aW1lb3V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUcmllcyhvcHRpb25zPzogeyB0cmllcz86IG51bWJlciB9KSB7XG4gIGNvbnN0IHsgdHJpZXMgPSA0IH0gPSB7IC4uLm9wdGlvbnMgfTtcbiAgdmFsaWRhdGVJbnQzMih0cmllcywgXCJvcHRpb25zLnRyaWVzXCIsIDEsIDIgKiogMzEgLSAxKTtcbiAgcmV0dXJuIHRyaWVzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlc29sdmVyT3B0aW9ucyB7XG4gIHRpbWVvdXQ/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIC8qKlxuICAgKiBAZGVmYXVsdCA0XG4gICAqL1xuICB0cmllcz86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBBbiBpbmRlcGVuZGVudCByZXNvbHZlciBmb3IgRE5TIHJlcXVlc3RzLlxuICpcbiAqIENyZWF0aW5nIGEgbmV3IHJlc29sdmVyIHVzZXMgdGhlIGRlZmF1bHQgc2VydmVyIHNldHRpbmdzLiBTZXR0aW5nXG4gKiB0aGUgc2VydmVycyB1c2VkIGZvciBhIHJlc29sdmVyIHVzaW5nIGByZXNvbHZlci5zZXRTZXJ2ZXJzKClgIGRvZXMgbm90IGFmZmVjdFxuICogb3RoZXIgcmVzb2x2ZXJzOlxuICpcbiAqIGBgYGpzXG4gKiBjb25zdCB7IFJlc29sdmVyIH0gPSByZXF1aXJlKCdkbnMnKTtcbiAqIGNvbnN0IHJlc29sdmVyID0gbmV3IFJlc29sdmVyKCk7XG4gKiByZXNvbHZlci5zZXRTZXJ2ZXJzKFsnNC40LjQuNCddKTtcbiAqXG4gKiAvLyBUaGlzIHJlcXVlc3Qgd2lsbCB1c2UgdGhlIHNlcnZlciBhdCA0LjQuNC40LCBpbmRlcGVuZGVudCBvZiBnbG9iYWwgc2V0dGluZ3MuXG4gKiByZXNvbHZlci5yZXNvbHZlNCgnZXhhbXBsZS5vcmcnLCAoZXJyLCBhZGRyZXNzZXMpID0+IHtcbiAqICAgLy8gLi4uXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIFRoZSBmb2xsb3dpbmcgbWV0aG9kcyBmcm9tIHRoZSBgZG5zYCBtb2R1bGUgYXJlIGF2YWlsYWJsZTpcbiAqXG4gKiAtIGByZXNvbHZlci5nZXRTZXJ2ZXJzKClgXG4gKiAtIGByZXNvbHZlci5yZXNvbHZlKClgXG4gKiAtIGByZXNvbHZlci5yZXNvbHZlNCgpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZTYoKWBcbiAqIC0gYHJlc29sdmVyLnJlc29sdmVBbnkoKWBcbiAqIC0gYHJlc29sdmVyLnJlc29sdmVDYWEoKWBcbiAqIC0gYHJlc29sdmVyLnJlc29sdmVDbmFtZSgpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZU14KClgXG4gKiAtIGByZXNvbHZlci5yZXNvbHZlTmFwdHIoKWBcbiAqIC0gYHJlc29sdmVyLnJlc29sdmVOcygpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZVB0cigpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZVNvYSgpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZVNydigpYFxuICogLSBgcmVzb2x2ZXIucmVzb2x2ZVR4dCgpYFxuICogLSBgcmVzb2x2ZXIucmV2ZXJzZSgpYFxuICogLSBgcmVzb2x2ZXIuc2V0U2VydmVycygpYFxuICovXG5leHBvcnQgY2xhc3MgUmVzb2x2ZXIge1xuICBfaGFuZGxlITogQ2hhbm5lbFdyYXA7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucz86IFJlc29sdmVyT3B0aW9ucykge1xuICAgIGNvbnN0IHRpbWVvdXQgPSB2YWxpZGF0ZVRpbWVvdXQob3B0aW9ucyk7XG4gICAgY29uc3QgdHJpZXMgPSB2YWxpZGF0ZVRyaWVzKG9wdGlvbnMpO1xuICAgIHRoaXMuX2hhbmRsZSA9IG5ldyBDaGFubmVsV3JhcCh0aW1lb3V0LCB0cmllcyk7XG4gIH1cblxuICBjYW5jZWwoKSB7XG4gICAgdGhpcy5faGFuZGxlLmNhbmNlbCgpO1xuICB9XG5cbiAgZ2V0U2VydmVycygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhbmRsZS5nZXRTZXJ2ZXJzKCkubWFwKCh2YWw6IFtzdHJpbmcsIG51bWJlcl0pID0+IHtcbiAgICAgIGlmICghdmFsWzFdIHx8IHZhbFsxXSA9PT0gSUFOQV9ETlNfUE9SVCkge1xuICAgICAgICByZXR1cm4gdmFsWzBdO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBob3N0ID0gaXNJUCh2YWxbMF0pID09PSA2ID8gYFske3ZhbFswXX1dYCA6IHZhbFswXTtcbiAgICAgIHJldHVybiBgJHtob3N0fToke3ZhbFsxXX1gO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0U2VydmVycyhzZXJ2ZXJzOiBSZWFkb25seUFycmF5PHN0cmluZz4pIHtcbiAgICB2YWxpZGF0ZUFycmF5KHNlcnZlcnMsIFwic2VydmVyc1wiKTtcblxuICAgIC8vIENhY2hlIHRoZSBvcmlnaW5hbCBzZXJ2ZXJzIGJlY2F1c2UgaW4gdGhlIGV2ZW50IG9mIGFuIGVycm9yIHdoaWxlXG4gICAgLy8gc2V0dGluZyB0aGUgc2VydmVycywgYy1hcmVzIHdvbid0IGhhdmUgYW55IHNlcnZlcnMgYXZhaWxhYmxlIGZvclxuICAgIC8vIHJlc29sdXRpb24uXG4gICAgY29uc3Qgb3JpZyA9IHRoaXMuX2hhbmRsZS5nZXRTZXJ2ZXJzKCk7XG4gICAgY29uc3QgbmV3U2V0OiBbbnVtYmVyLCBzdHJpbmcsIG51bWJlcl1bXSA9IFtdO1xuXG4gICAgc2VydmVycy5mb3JFYWNoKChzZXJ2LCBpbmRleCkgPT4ge1xuICAgICAgdmFsaWRhdGVTdHJpbmcoc2VydiwgYHNlcnZlcnNbJHtpbmRleH1dYCk7XG4gICAgICBsZXQgaXBWZXJzaW9uID0gaXNJUChzZXJ2KTtcblxuICAgICAgaWYgKGlwVmVyc2lvbiAhPT0gMCkge1xuICAgICAgICByZXR1cm4gbmV3U2V0LnB1c2goW2lwVmVyc2lvbiwgc2VydiwgSUFOQV9ETlNfUE9SVF0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaCA9IHNlcnYubWF0Y2goSVB2NlJFKTtcblxuICAgICAgLy8gQ2hlY2sgZm9yIGFuIElQdjYgaW4gYnJhY2tldHMuXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgaXBWZXJzaW9uID0gaXNJUChtYXRjaFsxXSk7XG5cbiAgICAgICAgaWYgKGlwVmVyc2lvbiAhPT0gMCkge1xuICAgICAgICAgIGNvbnN0IHBvcnQgPSBOdW1iZXIucGFyc2VJbnQoc2Vydi5yZXBsYWNlKGFkZHJTcGxpdFJFLCBcIiQyXCIpKSB8fFxuICAgICAgICAgICAgSUFOQV9ETlNfUE9SVDtcblxuICAgICAgICAgIHJldHVybiBuZXdTZXQucHVzaChbaXBWZXJzaW9uLCBtYXRjaFsxXSwgcG9ydF0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIGFkZHI6OnBvcnRcbiAgICAgIGNvbnN0IGFkZHJTcGxpdE1hdGNoID0gc2Vydi5tYXRjaChhZGRyU3BsaXRSRSk7XG5cbiAgICAgIGlmIChhZGRyU3BsaXRNYXRjaCkge1xuICAgICAgICBjb25zdCBob3N0SVAgPSBhZGRyU3BsaXRNYXRjaFsxXTtcbiAgICAgICAgY29uc3QgcG9ydCA9IGFkZHJTcGxpdE1hdGNoWzJdIHx8IGAke0lBTkFfRE5TX1BPUlR9YDtcblxuICAgICAgICBpcFZlcnNpb24gPSBpc0lQKGhvc3RJUCk7XG5cbiAgICAgICAgaWYgKGlwVmVyc2lvbiAhPT0gMCkge1xuICAgICAgICAgIHJldHVybiBuZXdTZXQucHVzaChbaXBWZXJzaW9uLCBob3N0SVAsIE51bWJlci5wYXJzZUludChwb3J0KV0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFUlJfSU5WQUxJRF9JUF9BRERSRVNTKHNlcnYpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZXJyb3JOdW1iZXIgPSB0aGlzLl9oYW5kbGUuc2V0U2VydmVycyhuZXdTZXQpO1xuXG4gICAgaWYgKGVycm9yTnVtYmVyICE9PSAwKSB7XG4gICAgICAvLyBSZXNldCB0aGUgc2VydmVycyB0byB0aGUgb2xkIHNlcnZlcnMsIGJlY2F1c2UgYXJlcyBwcm9iYWJseSB1bnNldCB0aGVtLlxuICAgICAgdGhpcy5faGFuZGxlLnNldFNlcnZlcnMob3JpZy5qb2luKFwiLFwiKSk7XG4gICAgICBjb25zdCBlcnIgPSBzdHJlcnJvcihlcnJvck51bWJlcik7XG5cbiAgICAgIHRocm93IG5ldyBFUlJfRE5TX1NFVF9TRVJWRVJTX0ZBSUxFRChlcnIsIHNlcnZlcnMudG9TdHJpbmcoKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSByZXNvbHZlciBpbnN0YW5jZSB3aWxsIHNlbmQgaXRzIHJlcXVlc3RzIGZyb20gdGhlIHNwZWNpZmllZCBJUCBhZGRyZXNzLlxuICAgKiBUaGlzIGFsbG93cyBwcm9ncmFtcyB0byBzcGVjaWZ5IG91dGJvdW5kIGludGVyZmFjZXMgd2hlbiB1c2VkIG9uIG11bHRpLWhvbWVkXG4gICAqIHN5c3RlbXMuXG4gICAqXG4gICAqIElmIGEgdjQgb3IgdjYgYWRkcmVzcyBpcyBub3Qgc3BlY2lmaWVkLCBpdCBpcyBzZXQgdG8gdGhlIGRlZmF1bHQsIGFuZCB0aGVcbiAgICogb3BlcmF0aW5nIHN5c3RlbSB3aWxsIGNob29zZSBhIGxvY2FsIGFkZHJlc3MgYXV0b21hdGljYWxseS5cbiAgICpcbiAgICogVGhlIHJlc29sdmVyIHdpbGwgdXNlIHRoZSB2NCBsb2NhbCBhZGRyZXNzIHdoZW4gbWFraW5nIHJlcXVlc3RzIHRvIElQdjQgRE5TXG4gICAqIHNlcnZlcnMsIGFuZCB0aGUgdjYgbG9jYWwgYWRkcmVzcyB3aGVuIG1ha2luZyByZXF1ZXN0cyB0byBJUHY2IEROUyBzZXJ2ZXJzLlxuICAgKiBUaGUgYHJydHlwZWAgb2YgcmVzb2x1dGlvbiByZXF1ZXN0cyBoYXMgbm8gaW1wYWN0IG9uIHRoZSBsb2NhbCBhZGRyZXNzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSBbaXB2ND0nMC4wLjAuMCddIEEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIElQdjQgYWRkcmVzcy5cbiAgICogQHBhcmFtIFtpcHY2PSc6OjAnXSBBIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBJUHY2IGFkZHJlc3MuXG4gICAqL1xuICBzZXRMb2NhbEFkZHJlc3MoaXB2NDogc3RyaW5nLCBpcHY2Pzogc3RyaW5nKSB7XG4gICAgdmFsaWRhdGVTdHJpbmcoaXB2NCwgXCJpcHY0XCIpO1xuXG4gICAgaWYgKGlwdjYgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsaWRhdGVTdHJpbmcoaXB2NiwgXCJpcHY2XCIpO1xuICAgIH1cblxuICAgIHRoaXMuX2hhbmRsZS5zZXRMb2NhbEFkZHJlc3MoaXB2NCwgaXB2Nik7XG4gIH1cbn1cblxubGV0IGRlZmF1bHRSZXNvbHZlciA9IG5ldyBSZXNvbHZlcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdFJlc29sdmVyKCk6IFJlc29sdmVyIHtcbiAgcmV0dXJuIGRlZmF1bHRSZXNvbHZlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldERlZmF1bHRSZXNvbHZlcjxUIGV4dGVuZHMgUmVzb2x2ZXI+KHJlc29sdmVyOiBUKSB7XG4gIGRlZmF1bHRSZXNvbHZlciA9IHJlc29sdmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVIaW50cyhoaW50czogbnVtYmVyKSB7XG4gIGlmICgoaGludHMgJiB+KEFJX0FERFJDT05GSUcgfCBBSV9BTEwgfCBBSV9WNE1BUFBFRCkpICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19WQUxVRShcImhpbnRzXCIsIGhpbnRzLCBcImlzIGludmFsaWRcIik7XG4gIH1cbn1cblxubGV0IGludmFsaWRIb3N0bmFtZVdhcm5pbmdFbWl0dGVkID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBlbWl0SW52YWxpZEhvc3RuYW1lV2FybmluZyhob3N0bmFtZTogc3RyaW5nKSB7XG4gIGlmIChpbnZhbGlkSG9zdG5hbWVXYXJuaW5nRW1pdHRlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGludmFsaWRIb3N0bmFtZVdhcm5pbmdFbWl0dGVkID0gdHJ1ZTtcblxuICBlbWl0V2FybmluZyhcbiAgICBgVGhlIHByb3ZpZGVkIGhvc3RuYW1lIFwiJHtob3N0bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBgICtcbiAgICAgIFwiaG9zdG5hbWUsIGFuZCBpcyBzdXBwb3J0ZWQgaW4gdGhlIGRucyBtb2R1bGUgc29sZWx5IGZvciBjb21wYXRpYmlsaXR5LlwiLFxuICAgIFwiRGVwcmVjYXRpb25XYXJuaW5nXCIsXG4gICAgXCJERVAwMTE4XCIsXG4gICk7XG59XG5cbmxldCBkbnNPcmRlciA9IGdldE9wdGlvblZhbHVlKFwiLS1kbnMtcmVzdWx0LW9yZGVyXCIpIHx8IFwiaXB2NGZpcnN0XCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREZWZhdWx0VmVyYmF0aW0oKSB7XG4gIHN3aXRjaCAoZG5zT3JkZXIpIHtcbiAgICBjYXNlIFwidmVyYmF0aW1cIjoge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNhc2UgXCJpcHY0Zmlyc3RcIjoge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBkZWZhdWx0OiB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2V0IHRoZSBkZWZhdWx0IHZhbHVlIG9mIGB2ZXJiYXRpbWAgaW4gYGxvb2t1cGAgYW5kIGBkbnNQcm9taXNlcy5sb29rdXAoKWAuXG4gKiBUaGUgdmFsdWUgY291bGQgYmU6XG4gKlxuICogLSBgaXB2NGZpcnN0YDogc2V0cyBkZWZhdWx0IGB2ZXJiYXRpbWAgYGZhbHNlYC5cbiAqIC0gYHZlcmJhdGltYDogc2V0cyBkZWZhdWx0IGB2ZXJiYXRpbWAgYHRydWVgLlxuICpcbiAqIFRoZSBkZWZhdWx0IGlzIGBpcHY0Zmlyc3RgIGFuZCBgc2V0RGVmYXVsdFJlc3VsdE9yZGVyYCBoYXZlIGhpZ2hlclxuICogcHJpb3JpdHkgdGhhbiBgLS1kbnMtcmVzdWx0LW9yZGVyYC4gV2hlbiB1c2luZyBgd29ya2VyIHRocmVhZHNgLFxuICogYHNldERlZmF1bHRSZXN1bHRPcmRlcmAgZnJvbSB0aGUgbWFpbiB0aHJlYWQgd29uJ3QgYWZmZWN0IHRoZSBkZWZhdWx0XG4gKiBkbnMgb3JkZXJzIGluIHdvcmtlcnMuXG4gKlxuICogQHBhcmFtIG9yZGVyIG11c3QgYmUgYCdpcHY0Zmlyc3QnYCBvciBgJ3ZlcmJhdGltJ2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXREZWZhdWx0UmVzdWx0T3JkZXIob3JkZXI6IFwiaXB2NGZpcnN0XCIgfCBcInZlcmJhdGltXCIpIHtcbiAgdmFsaWRhdGVPbmVPZihvcmRlciwgXCJkbnNPcmRlclwiLCBbXCJ2ZXJiYXRpbVwiLCBcImlwdjRmaXJzdFwiXSk7XG4gIGRuc09yZGVyID0gb3JkZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0UmVzb2x2ZXJTZXRTZXJ2ZXJzKHNlcnZlcnM6IHN0cmluZ1tdKSB7XG4gIGNvbnN0IHJlc29sdmVyID0gbmV3IFJlc29sdmVyKCk7XG5cbiAgcmVzb2x2ZXIuc2V0U2VydmVycyhzZXJ2ZXJzKTtcbiAgc2V0RGVmYXVsdFJlc29sdmVyKHJlc29sdmVyKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSx5REFBeUQ7QUFDekQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSw2REFBNkQ7QUFDN0QsNEVBQTRFO0FBQzVFLDJFQUEyRTtBQUMzRSx3RUFBd0U7QUFDeEUsNEVBQTRFO0FBQzVFLHlDQUF5QztBQUV6QyxTQUFTLGNBQWMsUUFBUSxnQkFBZ0I7QUFDL0MsU0FBUyxXQUFXLFFBQVEsbUJBQW1CO0FBQy9DLFNBQ0UsYUFBYSxFQUNiLE1BQU0sRUFDTixXQUFXLFFBQ04saUNBQWlDO0FBQ3hDLFNBQVMsV0FBVyxFQUFFLFFBQVEsUUFBUSx1Q0FBdUM7QUFDN0UsU0FD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