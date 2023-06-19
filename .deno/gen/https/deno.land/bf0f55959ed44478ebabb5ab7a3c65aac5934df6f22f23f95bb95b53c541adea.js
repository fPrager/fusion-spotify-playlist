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
// - https://github.com/nodejs/node/blob/master/src/cares_wrap.cc
// - https://github.com/nodejs/node/blob/master/src/cares_wrap.h
import { isIPv4 } from "../internal/net.ts";
import { codeMap } from "./uv.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { ares_strerror } from "./ares.ts";
import { notImplemented } from "../_utils.ts";
import { isWindows } from "../../_util/os.ts";
export class GetAddrInfoReqWrap extends AsyncWrap {
    family;
    hostname;
    callback;
    resolve;
    reject;
    oncomplete;
    constructor(){
        super(providerType.GETADDRINFOREQWRAP);
    }
}
export function getaddrinfo(req, hostname, family, _hints, verbatim) {
    let addresses = [];
    // TODO(cmorten): use hints
    // REF: https://nodejs.org/api/dns.html#dns_supported_getaddrinfo_flags
    const recordTypes = [];
    if (family === 0 || family === 4) {
        recordTypes.push("A");
    }
    if (family === 0 || family === 6) {
        recordTypes.push("AAAA");
    }
    (async ()=>{
        await Promise.allSettled(recordTypes.map((recordType)=>Deno.resolveDns(hostname, recordType).then((records)=>{
                records.forEach((record)=>addresses.push(record));
            })));
        const error = addresses.length ? 0 : codeMap.get("EAI_NODATA");
        // TODO(cmorten): needs work
        // REF: https://github.com/nodejs/node/blob/master/src/cares_wrap.cc#L1444
        if (!verbatim) {
            addresses.sort((a, b)=>{
                if (isIPv4(a)) {
                    return -1;
                } else if (isIPv4(b)) {
                    return 1;
                }
                return 0;
            });
        }
        // TODO: Forces IPv4 as a workaround for Deno not
        // aligning with Node on implicit binding on Windows
        // REF: https://github.com/denoland/deno/issues/10762
        if (isWindows && hostname === "localhost") {
            addresses = addresses.filter((address)=>isIPv4(address));
        }
        req.oncomplete(error, addresses);
    })();
    return 0;
}
export class QueryReqWrap extends AsyncWrap {
    bindingName;
    hostname;
    ttl;
    callback;
    // deno-lint-ignore no-explicit-any
    resolve;
    reject;
    oncomplete;
    constructor(){
        super(providerType.QUERYWRAP);
    }
}
function fqdnToHostname(fqdn) {
    return fqdn.replace(/\.$/, "");
}
function compressIPv6(address) {
    const formatted = address.replace(/\b(?:0+:){2,}/, ":");
    const finalAddress = formatted.split(":").map((octet)=>{
        if (octet.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            // decimal
            return Number(octet.replaceAll(".", "")).toString(16);
        }
        return octet.replace(/\b0+/g, "");
    }).join(":");
    return finalAddress;
}
export class ChannelWrap extends AsyncWrap {
    #servers = [];
    #timeout;
    #tries;
    constructor(timeout, tries){
        super(providerType.DNSCHANNEL);
        this.#timeout = timeout;
        this.#tries = tries;
    }
    async #query(query, recordType) {
        // TODO: TTL logic.
        let code;
        let ret;
        if (this.#servers.length) {
            for (const [ipAddr, port] of this.#servers){
                const resolveOptions = {
                    nameServer: {
                        ipAddr,
                        port
                    }
                };
                ({ code , ret  } = await this.#resolve(query, recordType, resolveOptions));
                if (code === 0 || code === codeMap.get("EAI_NODATA")) {
                    break;
                }
            }
        } else {
            ({ code , ret  } = await this.#resolve(query, recordType));
        }
        return {
            code: code,
            ret: ret
        };
    }
    async #resolve(query1, recordType1, resolveOptions1) {
        let ret1 = [];
        let code1 = 0;
        try {
            ret1 = await Deno.resolveDns(query1, recordType1, resolveOptions1);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                code1 = codeMap.get("EAI_NODATA");
            } else {
                // TODO(cmorten): map errors to appropriate error codes.
                code1 = codeMap.get("UNKNOWN");
            }
        }
        return {
            code: code1,
            ret: ret1
        };
    }
    queryAny(req, name) {
        // TODO: implemented temporary measure to allow limited usage of
        // `resolveAny` like APIs.
        //
        // Ideally we move to using the "ANY" / "*" DNS query in future
        // REF: https://github.com/denoland/deno/issues/14492
        (async ()=>{
            const records = [];
            await Promise.allSettled([
                this.#query(name, "A").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "A",
                            address: record
                        }));
                }),
                this.#query(name, "AAAA").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "AAAA",
                            address: compressIPv6(record)
                        }));
                }),
                this.#query(name, "CAA").then(({ ret  })=>{
                    ret.forEach(({ critical , tag , value  })=>records.push({
                            type: "CAA",
                            [tag]: value,
                            critical: +critical && 128
                        }));
                }),
                this.#query(name, "CNAME").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "CNAME",
                            value: record
                        }));
                }),
                this.#query(name, "MX").then(({ ret  })=>{
                    ret.forEach(({ preference , exchange  })=>records.push({
                            type: "MX",
                            priority: preference,
                            exchange: fqdnToHostname(exchange)
                        }));
                }),
                this.#query(name, "NAPTR").then(({ ret  })=>{
                    ret.forEach(({ order , preference , flags , services , regexp , replacement  })=>records.push({
                            type: "NAPTR",
                            order,
                            preference,
                            flags,
                            service: services,
                            regexp,
                            replacement
                        }));
                }),
                this.#query(name, "NS").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "NS",
                            value: fqdnToHostname(record)
                        }));
                }),
                this.#query(name, "PTR").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "PTR",
                            value: fqdnToHostname(record)
                        }));
                }),
                this.#query(name, "SOA").then(({ ret  })=>{
                    ret.forEach(({ mname , rname , serial , refresh , retry , expire , minimum  })=>records.push({
                            type: "SOA",
                            nsname: fqdnToHostname(mname),
                            hostmaster: fqdnToHostname(rname),
                            serial,
                            refresh,
                            retry,
                            expire,
                            minttl: minimum
                        }));
                }),
                this.#query(name, "SRV").then(({ ret  })=>{
                    ret.forEach(({ priority , weight , port , target  })=>records.push({
                            type: "SRV",
                            priority,
                            weight,
                            port,
                            name: target
                        }));
                }),
                this.#query(name, "TXT").then(({ ret  })=>{
                    ret.forEach((record)=>records.push({
                            type: "TXT",
                            entries: record
                        }));
                })
            ]);
            const err = records.length ? 0 : codeMap.get("EAI_NODATA");
            req.oncomplete(err, records);
        })();
        return 0;
    }
    queryA(req, name) {
        this.#query(name, "A").then(({ code , ret  })=>{
            req.oncomplete(code, ret);
        });
        return 0;
    }
    queryAaaa(req, name) {
        this.#query(name, "AAAA").then(({ code , ret  })=>{
            const records = ret.map((record)=>compressIPv6(record));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryCaa(req, name) {
        this.#query(name, "CAA").then(({ code , ret  })=>{
            const records = ret.map(({ critical , tag , value  })=>({
                    [tag]: value,
                    critical: +critical && 128
                }));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryCname(req, name) {
        this.#query(name, "CNAME").then(({ code , ret  })=>{
            req.oncomplete(code, ret);
        });
        return 0;
    }
    queryMx(req, name) {
        this.#query(name, "MX").then(({ code , ret  })=>{
            const records = ret.map(({ preference , exchange  })=>({
                    priority: preference,
                    exchange: fqdnToHostname(exchange)
                }));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryNaptr(req, name) {
        this.#query(name, "NAPTR").then(({ code , ret  })=>{
            const records = ret.map(({ order , preference , flags , services , regexp , replacement  })=>({
                    flags,
                    service: services,
                    regexp,
                    replacement,
                    order,
                    preference
                }));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryNs(req, name) {
        this.#query(name, "NS").then(({ code , ret  })=>{
            const records = ret.map((record)=>fqdnToHostname(record));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryPtr(req, name) {
        this.#query(name, "PTR").then(({ code , ret  })=>{
            const records = ret.map((record)=>fqdnToHostname(record));
            req.oncomplete(code, records);
        });
        return 0;
    }
    querySoa(req, name) {
        this.#query(name, "SOA").then(({ code , ret  })=>{
            let record = {};
            if (ret.length) {
                const { mname , rname , serial , refresh , retry , expire , minimum  } = ret[0];
                record = {
                    nsname: fqdnToHostname(mname),
                    hostmaster: fqdnToHostname(rname),
                    serial,
                    refresh,
                    retry,
                    expire,
                    minttl: minimum
                };
            }
            req.oncomplete(code, record);
        });
        return 0;
    }
    querySrv(req, name) {
        this.#query(name, "SRV").then(({ code , ret  })=>{
            const records = ret.map(({ priority , weight , port , target  })=>({
                    priority,
                    weight,
                    port,
                    name: target
                }));
            req.oncomplete(code, records);
        });
        return 0;
    }
    queryTxt(req, name) {
        this.#query(name, "TXT").then(({ code , ret  })=>{
            req.oncomplete(code, ret);
        });
        return 0;
    }
    getHostByAddr(_req, _name) {
        // TODO: https://github.com/denoland/deno/issues/14432
        notImplemented("cares.ChannelWrap.prototype.getHostByAddr");
    }
    getServers() {
        return this.#servers;
    }
    setServers(servers) {
        if (typeof servers === "string") {
            const tuples = [];
            for(let i = 0; i < servers.length; i += 2){
                tuples.push([
                    servers[i],
                    parseInt(servers[i + 1])
                ]);
            }
            this.#servers = tuples;
        } else {
            this.#servers = servers.map(([_ipVersion, ip, port])=>[
                    ip,
                    port
                ]);
        }
        return 0;
    }
    setLocalAddress(_addr0, _addr1) {
        notImplemented("cares.ChannelWrap.prototype.setLocalAddress");
    }
    cancel() {
        notImplemented("cares.ChannelWrap.prototype.cancel");
    }
}
const DNS_ESETSRVPENDING = -1000;
const EMSG_ESETSRVPENDING = "There are pending queries.";
export function strerror(code) {
    return code === DNS_ESETSRVPENDING ? EMSG_ESETSRVPENDING : ares_strerror(code);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9jYXJlc193cmFwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gVGhpcyBtb2R1bGUgcG9ydHM6XG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvY2FyZXNfd3JhcC5jY1xuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL2NhcmVzX3dyYXAuaFxuXG5pbXBvcnQgdHlwZSB7IEVycm5vRXhjZXB0aW9uIH0gZnJvbSBcIi4uL2ludGVybmFsL2Vycm9ycy50c1wiO1xuaW1wb3J0IHsgaXNJUHY0IH0gZnJvbSBcIi4uL2ludGVybmFsL25ldC50c1wiO1xuaW1wb3J0IHsgY29kZU1hcCB9IGZyb20gXCIuL3V2LnRzXCI7XG5pbXBvcnQgeyBBc3luY1dyYXAsIHByb3ZpZGVyVHlwZSB9IGZyb20gXCIuL2FzeW5jX3dyYXAudHNcIjtcbmltcG9ydCB7IGFyZXNfc3RyZXJyb3IgfSBmcm9tIFwiLi9hcmVzLnRzXCI7XG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi8uLi9fdXRpbC9vcy50c1wiO1xuXG5pbnRlcmZhY2UgTG9va3VwQWRkcmVzcyB7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgZmFtaWx5OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBHZXRBZGRySW5mb1JlcVdyYXAgZXh0ZW5kcyBBc3luY1dyYXAge1xuICBmYW1pbHkhOiBudW1iZXI7XG4gIGhvc3RuYW1lITogc3RyaW5nO1xuXG4gIGNhbGxiYWNrITogKFxuICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgIGFkZHJlc3NPckFkZHJlc3Nlcz86IHN0cmluZyB8IExvb2t1cEFkZHJlc3NbXSB8IG51bGwsXG4gICAgZmFtaWx5PzogbnVtYmVyLFxuICApID0+IHZvaWQ7XG4gIHJlc29sdmUhOiAoYWRkcmVzc09yQWRkcmVzc2VzOiBMb29rdXBBZGRyZXNzIHwgTG9va3VwQWRkcmVzc1tdKSA9PiB2b2lkO1xuICByZWplY3QhOiAoZXJyOiBFcnJub0V4Y2VwdGlvbiB8IG51bGwpID0+IHZvaWQ7XG4gIG9uY29tcGxldGUhOiAoZXJyOiBudW1iZXIgfCBudWxsLCBhZGRyZXNzZXM6IHN0cmluZ1tdKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHByb3ZpZGVyVHlwZS5HRVRBRERSSU5GT1JFUVdSQVApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRhZGRyaW5mbyhcbiAgcmVxOiBHZXRBZGRySW5mb1JlcVdyYXAsXG4gIGhvc3RuYW1lOiBzdHJpbmcsXG4gIGZhbWlseTogbnVtYmVyLFxuICBfaGludHM6IG51bWJlcixcbiAgdmVyYmF0aW06IGJvb2xlYW4sXG4pOiBudW1iZXIge1xuICBsZXQgYWRkcmVzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIFRPRE8oY21vcnRlbik6IHVzZSBoaW50c1xuICAvLyBSRUY6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvZG5zLmh0bWwjZG5zX3N1cHBvcnRlZF9nZXRhZGRyaW5mb19mbGFnc1xuXG4gIGNvbnN0IHJlY29yZFR5cGVzOiAoXCJBXCIgfCBcIkFBQUFcIilbXSA9IFtdO1xuXG4gIGlmIChmYW1pbHkgPT09IDAgfHwgZmFtaWx5ID09PSA0KSB7XG4gICAgcmVjb3JkVHlwZXMucHVzaChcIkFcIik7XG4gIH1cbiAgaWYgKGZhbWlseSA9PT0gMCB8fCBmYW1pbHkgPT09IDYpIHtcbiAgICByZWNvcmRUeXBlcy5wdXNoKFwiQUFBQVwiKTtcbiAgfVxuXG4gIChhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgcmVjb3JkVHlwZXMubWFwKChyZWNvcmRUeXBlKSA9PlxuICAgICAgICBEZW5vLnJlc29sdmVEbnMoaG9zdG5hbWUsIHJlY29yZFR5cGUpLnRoZW4oKHJlY29yZHMpID0+IHtcbiAgICAgICAgICByZWNvcmRzLmZvckVhY2goKHJlY29yZCkgPT4gYWRkcmVzc2VzLnB1c2gocmVjb3JkKSk7XG4gICAgICAgIH0pXG4gICAgICApLFxuICAgICk7XG5cbiAgICBjb25zdCBlcnJvciA9IGFkZHJlc3Nlcy5sZW5ndGggPyAwIDogY29kZU1hcC5nZXQoXCJFQUlfTk9EQVRBXCIpITtcblxuICAgIC8vIFRPRE8oY21vcnRlbik6IG5lZWRzIHdvcmtcbiAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvY2FyZXNfd3JhcC5jYyNMMTQ0NFxuICAgIGlmICghdmVyYmF0aW0pIHtcbiAgICAgIGFkZHJlc3Nlcy5zb3J0KChhOiBzdHJpbmcsIGI6IHN0cmluZyk6IG51bWJlciA9PiB7XG4gICAgICAgIGlmIChpc0lQdjQoYSkpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNJUHY0KGIpKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFRPRE86IEZvcmNlcyBJUHY0IGFzIGEgd29ya2Fyb3VuZCBmb3IgRGVubyBub3RcbiAgICAvLyBhbGlnbmluZyB3aXRoIE5vZGUgb24gaW1wbGljaXQgYmluZGluZyBvbiBXaW5kb3dzXG4gICAgLy8gUkVGOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvMTA3NjJcbiAgICBpZiAoaXNXaW5kb3dzICYmIGhvc3RuYW1lID09PSBcImxvY2FsaG9zdFwiKSB7XG4gICAgICBhZGRyZXNzZXMgPSBhZGRyZXNzZXMuZmlsdGVyKChhZGRyZXNzKSA9PiBpc0lQdjQoYWRkcmVzcykpO1xuICAgIH1cblxuICAgIHJlcS5vbmNvbXBsZXRlKGVycm9yLCBhZGRyZXNzZXMpO1xuICB9KSgpO1xuXG4gIHJldHVybiAwO1xufVxuXG5leHBvcnQgY2xhc3MgUXVlcnlSZXFXcmFwIGV4dGVuZHMgQXN5bmNXcmFwIHtcbiAgYmluZGluZ05hbWUhOiBzdHJpbmc7XG4gIGhvc3RuYW1lITogc3RyaW5nO1xuICB0dGwhOiBib29sZWFuO1xuXG4gIGNhbGxiYWNrITogKFxuICAgIGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgcmVjb3Jkcz86IGFueSxcbiAgKSA9PiB2b2lkO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICByZXNvbHZlITogKHJlY29yZHM6IGFueSkgPT4gdm9pZDtcbiAgcmVqZWN0ITogKGVycjogRXJybm9FeGNlcHRpb24gfCBudWxsKSA9PiB2b2lkO1xuICBvbmNvbXBsZXRlITogKFxuICAgIGVycjogbnVtYmVyLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgcmVjb3JkczogYW55LFxuICAgIHR0bHM/OiBudW1iZXJbXSxcbiAgKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHByb3ZpZGVyVHlwZS5RVUVSWVdSQVApO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hhbm5lbFdyYXBRdWVyeSB7XG4gIHF1ZXJ5QW55KHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXI7XG4gIHF1ZXJ5QShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyO1xuICBxdWVyeUFhYWEocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlDYWEocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlDbmFtZShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyO1xuICBxdWVyeU14KHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXI7XG4gIHF1ZXJ5TnMocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlUeHQocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlTcnYocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlQdHIocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlcjtcbiAgcXVlcnlOYXB0cihyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyO1xuICBxdWVyeVNvYShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyO1xuICBnZXRIb3N0QnlBZGRyKHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXI7XG59XG5cbmZ1bmN0aW9uIGZxZG5Ub0hvc3RuYW1lKGZxZG46IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmcWRuLnJlcGxhY2UoL1xcLiQvLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gY29tcHJlc3NJUHY2KGFkZHJlc3M6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGZvcm1hdHRlZCA9IGFkZHJlc3MucmVwbGFjZSgvXFxiKD86MCs6KXsyLH0vLCBcIjpcIik7XG4gIGNvbnN0IGZpbmFsQWRkcmVzcyA9IGZvcm1hdHRlZFxuICAgIC5zcGxpdChcIjpcIilcbiAgICAubWFwKChvY3RldCkgPT4ge1xuICAgICAgaWYgKG9jdGV0Lm1hdGNoKC9eXFxkK1xcLlxcZCtcXC5cXGQrXFwuXFxkKyQvKSkge1xuICAgICAgICAvLyBkZWNpbWFsXG4gICAgICAgIHJldHVybiBOdW1iZXIob2N0ZXQucmVwbGFjZUFsbChcIi5cIiwgXCJcIikpLnRvU3RyaW5nKDE2KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG9jdGV0LnJlcGxhY2UoL1xcYjArL2csIFwiXCIpO1xuICAgIH0pXG4gICAgLmpvaW4oXCI6XCIpO1xuXG4gIHJldHVybiBmaW5hbEFkZHJlc3M7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFubmVsV3JhcCBleHRlbmRzIEFzeW5jV3JhcCBpbXBsZW1lbnRzIENoYW5uZWxXcmFwUXVlcnkge1xuICAjc2VydmVyczogW3N0cmluZywgbnVtYmVyXVtdID0gW107XG4gICN0aW1lb3V0OiBudW1iZXI7XG4gICN0cmllczogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHRpbWVvdXQ6IG51bWJlciwgdHJpZXM6IG51bWJlcikge1xuICAgIHN1cGVyKHByb3ZpZGVyVHlwZS5ETlNDSEFOTkVMKTtcblxuICAgIHRoaXMuI3RpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMuI3RyaWVzID0gdHJpZXM7XG4gIH1cblxuICBhc3luYyAjcXVlcnkocXVlcnk6IHN0cmluZywgcmVjb3JkVHlwZTogRGVuby5SZWNvcmRUeXBlKSB7XG4gICAgLy8gVE9ETzogVFRMIGxvZ2ljLlxuXG4gICAgbGV0IGNvZGU6IG51bWJlcjtcbiAgICBsZXQgcmV0OiBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIERlbm8ucmVzb2x2ZURucz4+O1xuXG4gICAgaWYgKHRoaXMuI3NlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBmb3IgKGNvbnN0IFtpcEFkZHIsIHBvcnRdIG9mIHRoaXMuI3NlcnZlcnMpIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZU9wdGlvbnMgPSB7XG4gICAgICAgICAgbmFtZVNlcnZlcjoge1xuICAgICAgICAgICAgaXBBZGRyLFxuICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgICh7IGNvZGUsIHJldCB9ID0gYXdhaXQgdGhpcy4jcmVzb2x2ZShcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICByZWNvcmRUeXBlLFxuICAgICAgICAgIHJlc29sdmVPcHRpb25zLFxuICAgICAgICApKTtcblxuICAgICAgICBpZiAoY29kZSA9PT0gMCB8fCBjb2RlID09PSBjb2RlTWFwLmdldChcIkVBSV9OT0RBVEFcIikhKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgKHsgY29kZSwgcmV0IH0gPSBhd2FpdCB0aGlzLiNyZXNvbHZlKHF1ZXJ5LCByZWNvcmRUeXBlKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29kZTogY29kZSEsIHJldDogcmV0ISB9O1xuICB9XG5cbiAgYXN5bmMgI3Jlc29sdmUoXG4gICAgcXVlcnk6IHN0cmluZyxcbiAgICByZWNvcmRUeXBlOiBEZW5vLlJlY29yZFR5cGUsXG4gICAgcmVzb2x2ZU9wdGlvbnM/OiBEZW5vLlJlc29sdmVEbnNPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBjb2RlOiBudW1iZXI7XG4gICAgcmV0OiBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIERlbm8ucmVzb2x2ZURucz4+O1xuICB9PiB7XG4gICAgbGV0IHJldDogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBEZW5vLnJlc29sdmVEbnM+PiA9IFtdO1xuICAgIGxldCBjb2RlID0gMDtcblxuICAgIHRyeSB7XG4gICAgICByZXQgPSBhd2FpdCBEZW5vLnJlc29sdmVEbnMocXVlcnksIHJlY29yZFR5cGUsIHJlc29sdmVPcHRpb25zKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgICAgIGNvZGUgPSBjb2RlTWFwLmdldChcIkVBSV9OT0RBVEFcIikhO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVE9ETyhjbW9ydGVuKTogbWFwIGVycm9ycyB0byBhcHByb3ByaWF0ZSBlcnJvciBjb2Rlcy5cbiAgICAgICAgY29kZSA9IGNvZGVNYXAuZ2V0KFwiVU5LTk9XTlwiKSE7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29kZSwgcmV0IH07XG4gIH1cblxuICBxdWVyeUFueShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnRlZCB0ZW1wb3JhcnkgbWVhc3VyZSB0byBhbGxvdyBsaW1pdGVkIHVzYWdlIG9mXG4gICAgLy8gYHJlc29sdmVBbnlgIGxpa2UgQVBJcy5cbiAgICAvL1xuICAgIC8vIElkZWFsbHkgd2UgbW92ZSB0byB1c2luZyB0aGUgXCJBTllcIiAvIFwiKlwiIEROUyBxdWVyeSBpbiBmdXR1cmVcbiAgICAvLyBSRUY6IGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy8xNDQ5MlxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCByZWNvcmRzOiB7IHR5cGU6IERlbm8uUmVjb3JkVHlwZTsgW2tleTogc3RyaW5nXTogdW5rbm93biB9W10gPSBbXTtcblxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgICAgdGhpcy4jcXVlcnkobmFtZSwgXCJBXCIpLnRoZW4oKHsgcmV0IH0pID0+IHtcbiAgICAgICAgICByZXQuZm9yRWFjaCgocmVjb3JkKSA9PiByZWNvcmRzLnB1c2goeyB0eXBlOiBcIkFcIiwgYWRkcmVzczogcmVjb3JkIH0pKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiQUFBQVwiKS50aGVuKCh7IHJldCB9KSA9PiB7XG4gICAgICAgICAgKHJldCBhcyBzdHJpbmdbXSkuZm9yRWFjaCgocmVjb3JkKSA9PlxuICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHsgdHlwZTogXCJBQUFBXCIsIGFkZHJlc3M6IGNvbXByZXNzSVB2NihyZWNvcmQpIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiQ0FBXCIpLnRoZW4oKHsgcmV0IH0pID0+IHtcbiAgICAgICAgICAocmV0IGFzIERlbm8uQ0FBUmVjb3JkW10pLmZvckVhY2goKHsgY3JpdGljYWwsIHRhZywgdmFsdWUgfSkgPT5cbiAgICAgICAgICAgIHJlY29yZHMucHVzaCh7XG4gICAgICAgICAgICAgIHR5cGU6IFwiQ0FBXCIsXG4gICAgICAgICAgICAgIFt0YWddOiB2YWx1ZSxcbiAgICAgICAgICAgICAgY3JpdGljYWw6ICtjcml0aWNhbCAmJiAxMjgsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICk7XG4gICAgICAgIH0pLFxuICAgICAgICB0aGlzLiNxdWVyeShuYW1lLCBcIkNOQU1FXCIpLnRoZW4oKHsgcmV0IH0pID0+IHtcbiAgICAgICAgICByZXQuZm9yRWFjaCgocmVjb3JkKSA9PlxuICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHsgdHlwZTogXCJDTkFNRVwiLCB2YWx1ZTogcmVjb3JkIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiTVhcIikudGhlbigoeyByZXQgfSkgPT4ge1xuICAgICAgICAgIChyZXQgYXMgRGVuby5NWFJlY29yZFtdKS5mb3JFYWNoKCh7IHByZWZlcmVuY2UsIGV4Y2hhbmdlIH0pID0+XG4gICAgICAgICAgICByZWNvcmRzLnB1c2goe1xuICAgICAgICAgICAgICB0eXBlOiBcIk1YXCIsXG4gICAgICAgICAgICAgIHByaW9yaXR5OiBwcmVmZXJlbmNlLFxuICAgICAgICAgICAgICBleGNoYW5nZTogZnFkblRvSG9zdG5hbWUoZXhjaGFuZ2UpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICAgdGhpcy4jcXVlcnkobmFtZSwgXCJOQVBUUlwiKS50aGVuKCh7IHJldCB9KSA9PiB7XG4gICAgICAgICAgKHJldCBhcyBEZW5vLk5BUFRSUmVjb3JkW10pLmZvckVhY2goXG4gICAgICAgICAgICAoeyBvcmRlciwgcHJlZmVyZW5jZSwgZmxhZ3MsIHNlcnZpY2VzLCByZWdleHAsIHJlcGxhY2VtZW50IH0pID0+XG4gICAgICAgICAgICAgIHJlY29yZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJOQVBUUlwiLFxuICAgICAgICAgICAgICAgIG9yZGVyLFxuICAgICAgICAgICAgICAgIHByZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgZmxhZ3MsXG4gICAgICAgICAgICAgICAgc2VydmljZTogc2VydmljZXMsXG4gICAgICAgICAgICAgICAgcmVnZXhwLFxuICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50LFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICAgdGhpcy4jcXVlcnkobmFtZSwgXCJOU1wiKS50aGVuKCh7IHJldCB9KSA9PiB7XG4gICAgICAgICAgKHJldCBhcyBzdHJpbmdbXSkuZm9yRWFjaCgocmVjb3JkKSA9PlxuICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHsgdHlwZTogXCJOU1wiLCB2YWx1ZTogZnFkblRvSG9zdG5hbWUocmVjb3JkKSB9KVxuICAgICAgICAgICk7XG4gICAgICAgIH0pLFxuICAgICAgICB0aGlzLiNxdWVyeShuYW1lLCBcIlBUUlwiKS50aGVuKCh7IHJldCB9KSA9PiB7XG4gICAgICAgICAgKHJldCBhcyBzdHJpbmdbXSkuZm9yRWFjaCgocmVjb3JkKSA9PlxuICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHsgdHlwZTogXCJQVFJcIiwgdmFsdWU6IGZxZG5Ub0hvc3RuYW1lKHJlY29yZCkgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICAgdGhpcy4jcXVlcnkobmFtZSwgXCJTT0FcIikudGhlbigoeyByZXQgfSkgPT4ge1xuICAgICAgICAgIChyZXQgYXMgRGVuby5TT0FSZWNvcmRbXSkuZm9yRWFjaChcbiAgICAgICAgICAgICh7IG1uYW1lLCBybmFtZSwgc2VyaWFsLCByZWZyZXNoLCByZXRyeSwgZXhwaXJlLCBtaW5pbXVtIH0pID0+XG4gICAgICAgICAgICAgIHJlY29yZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJTT0FcIixcbiAgICAgICAgICAgICAgICBuc25hbWU6IGZxZG5Ub0hvc3RuYW1lKG1uYW1lKSxcbiAgICAgICAgICAgICAgICBob3N0bWFzdGVyOiBmcWRuVG9Ib3N0bmFtZShybmFtZSksXG4gICAgICAgICAgICAgICAgc2VyaWFsLFxuICAgICAgICAgICAgICAgIHJlZnJlc2gsXG4gICAgICAgICAgICAgICAgcmV0cnksXG4gICAgICAgICAgICAgICAgZXhwaXJlLFxuICAgICAgICAgICAgICAgIG1pbnR0bDogbWluaW11bSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiU1JWXCIpLnRoZW4oKHsgcmV0IH0pID0+IHtcbiAgICAgICAgICAocmV0IGFzIERlbm8uU1JWUmVjb3JkW10pLmZvckVhY2goXG4gICAgICAgICAgICAoeyBwcmlvcml0eSwgd2VpZ2h0LCBwb3J0LCB0YXJnZXQgfSkgPT5cbiAgICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlNSVlwiLFxuICAgICAgICAgICAgICAgIHByaW9yaXR5LFxuICAgICAgICAgICAgICAgIHdlaWdodCxcbiAgICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICAgIG5hbWU6IHRhcmdldCxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiVFhUXCIpLnRoZW4oKHsgcmV0IH0pID0+IHtcbiAgICAgICAgICByZXQuZm9yRWFjaCgocmVjb3JkKSA9PlxuICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKHsgdHlwZTogXCJUWFRcIiwgZW50cmllczogcmVjb3JkIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICBdKTtcblxuICAgICAgY29uc3QgZXJyID0gcmVjb3Jkcy5sZW5ndGggPyAwIDogY29kZU1hcC5nZXQoXCJFQUlfTk9EQVRBXCIpITtcblxuICAgICAgcmVxLm9uY29tcGxldGUoZXJyLCByZWNvcmRzKTtcbiAgICB9KSgpO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBxdWVyeUEocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgdGhpcy4jcXVlcnkobmFtZSwgXCJBXCIpLnRoZW4oKHsgY29kZSwgcmV0IH0pID0+IHtcbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJldCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHF1ZXJ5QWFhYShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICB0aGlzLiNxdWVyeShuYW1lLCBcIkFBQUFcIikudGhlbigoeyBjb2RlLCByZXQgfSkgPT4ge1xuICAgICAgY29uc3QgcmVjb3JkcyA9IChyZXQgYXMgc3RyaW5nW10pLm1hcCgocmVjb3JkKSA9PiBjb21wcmVzc0lQdjYocmVjb3JkKSk7XG5cbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJlY29yZHMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBxdWVyeUNhYShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICB0aGlzLiNxdWVyeShuYW1lLCBcIkNBQVwiKS50aGVuKCh7IGNvZGUsIHJldCB9KSA9PiB7XG4gICAgICBjb25zdCByZWNvcmRzID0gKHJldCBhcyBEZW5vLkNBQVJlY29yZFtdKS5tYXAoXG4gICAgICAgICh7IGNyaXRpY2FsLCB0YWcsIHZhbHVlIH0pID0+ICh7XG4gICAgICAgICAgW3RhZ106IHZhbHVlLFxuICAgICAgICAgIGNyaXRpY2FsOiArY3JpdGljYWwgJiYgMTI4LFxuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJlY29yZHMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBxdWVyeUNuYW1lKHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiQ05BTUVcIikudGhlbigoeyBjb2RlLCByZXQgfSkgPT4ge1xuICAgICAgcmVxLm9uY29tcGxldGUoY29kZSwgcmV0KTtcbiAgICB9KTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgcXVlcnlNeChyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICB0aGlzLiNxdWVyeShuYW1lLCBcIk1YXCIpLnRoZW4oKHsgY29kZSwgcmV0IH0pID0+IHtcbiAgICAgIGNvbnN0IHJlY29yZHMgPSAocmV0IGFzIERlbm8uTVhSZWNvcmRbXSkubWFwKFxuICAgICAgICAoeyBwcmVmZXJlbmNlLCBleGNoYW5nZSB9KSA9PiAoe1xuICAgICAgICAgIHByaW9yaXR5OiBwcmVmZXJlbmNlLFxuICAgICAgICAgIGV4Y2hhbmdlOiBmcWRuVG9Ib3N0bmFtZShleGNoYW5nZSksXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgcmVxLm9uY29tcGxldGUoY29kZSwgcmVjb3Jkcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHF1ZXJ5TmFwdHIocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgdGhpcy4jcXVlcnkobmFtZSwgXCJOQVBUUlwiKS50aGVuKCh7IGNvZGUsIHJldCB9KSA9PiB7XG4gICAgICBjb25zdCByZWNvcmRzID0gKHJldCBhcyBEZW5vLk5BUFRSUmVjb3JkW10pLm1hcChcbiAgICAgICAgKHsgb3JkZXIsIHByZWZlcmVuY2UsIGZsYWdzLCBzZXJ2aWNlcywgcmVnZXhwLCByZXBsYWNlbWVudCB9KSA9PiAoe1xuICAgICAgICAgIGZsYWdzLFxuICAgICAgICAgIHNlcnZpY2U6IHNlcnZpY2VzLFxuICAgICAgICAgIHJlZ2V4cCxcbiAgICAgICAgICByZXBsYWNlbWVudCxcbiAgICAgICAgICBvcmRlcixcbiAgICAgICAgICBwcmVmZXJlbmNlLFxuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJlY29yZHMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBxdWVyeU5zKHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiTlNcIikudGhlbigoeyBjb2RlLCByZXQgfSkgPT4ge1xuICAgICAgY29uc3QgcmVjb3JkcyA9IChyZXQgYXMgc3RyaW5nW10pLm1hcCgocmVjb3JkKSA9PiBmcWRuVG9Ib3N0bmFtZShyZWNvcmQpKTtcblxuICAgICAgcmVxLm9uY29tcGxldGUoY29kZSwgcmVjb3Jkcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHF1ZXJ5UHRyKHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiUFRSXCIpLnRoZW4oKHsgY29kZSwgcmV0IH0pID0+IHtcbiAgICAgIGNvbnN0IHJlY29yZHMgPSAocmV0IGFzIHN0cmluZ1tdKS5tYXAoKHJlY29yZCkgPT4gZnFkblRvSG9zdG5hbWUocmVjb3JkKSk7XG5cbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJlY29yZHMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBxdWVyeVNvYShyZXE6IFF1ZXJ5UmVxV3JhcCwgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICB0aGlzLiNxdWVyeShuYW1lLCBcIlNPQVwiKS50aGVuKCh7IGNvZGUsIHJldCB9KSA9PiB7XG4gICAgICBsZXQgcmVjb3JkID0ge307XG5cbiAgICAgIGlmIChyZXQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IHsgbW5hbWUsIHJuYW1lLCBzZXJpYWwsIHJlZnJlc2gsIHJldHJ5LCBleHBpcmUsIG1pbmltdW0gfSA9XG4gICAgICAgICAgcmV0WzBdIGFzIERlbm8uU09BUmVjb3JkO1xuXG4gICAgICAgIHJlY29yZCA9IHtcbiAgICAgICAgICBuc25hbWU6IGZxZG5Ub0hvc3RuYW1lKG1uYW1lKSxcbiAgICAgICAgICBob3N0bWFzdGVyOiBmcWRuVG9Ib3N0bmFtZShybmFtZSksXG4gICAgICAgICAgc2VyaWFsLFxuICAgICAgICAgIHJlZnJlc2gsXG4gICAgICAgICAgcmV0cnksXG4gICAgICAgICAgZXhwaXJlLFxuICAgICAgICAgIG1pbnR0bDogbWluaW11bSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmVxLm9uY29tcGxldGUoY29kZSwgcmVjb3JkKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgcXVlcnlTcnYocmVxOiBRdWVyeVJlcVdyYXAsIG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgdGhpcy4jcXVlcnkobmFtZSwgXCJTUlZcIikudGhlbigoeyBjb2RlLCByZXQgfSkgPT4ge1xuICAgICAgY29uc3QgcmVjb3JkcyA9IChyZXQgYXMgRGVuby5TUlZSZWNvcmRbXSkubWFwKFxuICAgICAgICAoeyBwcmlvcml0eSwgd2VpZ2h0LCBwb3J0LCB0YXJnZXQgfSkgPT4gKHtcbiAgICAgICAgICBwcmlvcml0eSxcbiAgICAgICAgICB3ZWlnaHQsXG4gICAgICAgICAgcG9ydCxcbiAgICAgICAgICBuYW1lOiB0YXJnZXQsXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgcmVxLm9uY29tcGxldGUoY29kZSwgcmVjb3Jkcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHF1ZXJ5VHh0KHJlcTogUXVlcnlSZXFXcmFwLCBuYW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHRoaXMuI3F1ZXJ5KG5hbWUsIFwiVFhUXCIpLnRoZW4oKHsgY29kZSwgcmV0IH0pID0+IHtcbiAgICAgIHJlcS5vbmNvbXBsZXRlKGNvZGUsIHJldCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGdldEhvc3RCeUFkZHIoX3JlcTogUXVlcnlSZXFXcmFwLCBfbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICAvLyBUT0RPOiBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvMTQ0MzJcbiAgICBub3RJbXBsZW1lbnRlZChcImNhcmVzLkNoYW5uZWxXcmFwLnByb3RvdHlwZS5nZXRIb3N0QnlBZGRyXCIpO1xuICB9XG5cbiAgZ2V0U2VydmVycygpOiBbc3RyaW5nLCBudW1iZXJdW10ge1xuICAgIHJldHVybiB0aGlzLiNzZXJ2ZXJzO1xuICB9XG5cbiAgc2V0U2VydmVycyhzZXJ2ZXJzOiBzdHJpbmcgfCBbbnVtYmVyLCBzdHJpbmcsIG51bWJlcl1bXSk6IG51bWJlciB7XG4gICAgaWYgKHR5cGVvZiBzZXJ2ZXJzID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCB0dXBsZXM6IFtzdHJpbmcsIG51bWJlcl1bXSA9IFtdO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlcnZlcnMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgdHVwbGVzLnB1c2goW3NlcnZlcnNbaV0sIHBhcnNlSW50KHNlcnZlcnNbaSArIDFdKV0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLiNzZXJ2ZXJzID0gdHVwbGVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNzZXJ2ZXJzID0gc2VydmVycy5tYXAoKFtfaXBWZXJzaW9uLCBpcCwgcG9ydF0pID0+IFtpcCwgcG9ydF0pO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgc2V0TG9jYWxBZGRyZXNzKF9hZGRyMDogc3RyaW5nLCBfYWRkcjE/OiBzdHJpbmcpIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNhcmVzLkNoYW5uZWxXcmFwLnByb3RvdHlwZS5zZXRMb2NhbEFkZHJlc3NcIik7XG4gIH1cblxuICBjYW5jZWwoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjYXJlcy5DaGFubmVsV3JhcC5wcm90b3R5cGUuY2FuY2VsXCIpO1xuICB9XG59XG5cbmNvbnN0IEROU19FU0VUU1JWUEVORElORyA9IC0xMDAwO1xuY29uc3QgRU1TR19FU0VUU1JWUEVORElORyA9IFwiVGhlcmUgYXJlIHBlbmRpbmcgcXVlcmllcy5cIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmVycm9yKGNvZGU6IG51bWJlcikge1xuICByZXR1cm4gY29kZSA9PT0gRE5TX0VTRVRTUlZQRU5ESU5HXG4gICAgPyBFTVNHX0VTRVRTUlZQRU5ESU5HXG4gICAgOiBhcmVzX3N0cmVycm9yKGNvZGUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFDdEQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSxnRUFBZ0U7QUFDaEUsc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSw0RUFBNEU7QUFDNUUscUVBQXFFO0FBQ3JFLHdCQUF3QjtBQUN4QixFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLHlEQUF5RDtBQUN6RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFF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