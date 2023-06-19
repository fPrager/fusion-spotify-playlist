// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
export class REPLServer {
    constructor(){
        notImplemented("REPLServer.prototype.constructor");
    }
}
export const builtinModules = [
    "assert",
    "async_hooks",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "diagnostics_channel",
    "dns",
    "domain",
    "events",
    "fs",
    "http",
    "http2",
    "https",
    "inspector",
    "module",
    "net",
    "os",
    "path",
    "perf_hooks",
    "process",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "string_decoder",
    "sys",
    "timers",
    "tls",
    "trace_events",
    "tty",
    "url",
    "util",
    "v8",
    "vm",
    "wasi",
    "worker_threads",
    "zlib"
];
export function start() {
    notImplemented("repl.start");
}
export default {
    REPLServer,
    builtinModules,
    start
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvcmVwbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCBhbmQgTm9kZSBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuL191dGlscy50c1wiO1xuXG5leHBvcnQgY2xhc3MgUkVQTFNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiUkVQTFNlcnZlci5wcm90b3R5cGUuY29uc3RydWN0b3JcIik7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBidWlsdGluTW9kdWxlcyA9IFtcbiAgXCJhc3NlcnRcIixcbiAgXCJhc3luY19ob29rc1wiLFxuICBcImJ1ZmZlclwiLFxuICBcImNoaWxkX3Byb2Nlc3NcIixcbiAgXCJjbHVzdGVyXCIsXG4gIFwiY29uc29sZVwiLFxuICBcImNvbnN0YW50c1wiLFxuICBcImNyeXB0b1wiLFxuICBcImRncmFtXCIsXG4gIFwiZGlhZ25vc3RpY3NfY2hhbm5lbFwiLFxuICBcImRuc1wiLFxuICBcImRvbWFpblwiLFxuICBcImV2ZW50c1wiLFxuICBcImZzXCIsXG4gIFwiaHR0cFwiLFxuICBcImh0dHAyXCIsXG4gIFwiaHR0cHNcIixcbiAgXCJpbnNwZWN0b3JcIixcbiAgXCJtb2R1bGVcIixcbiAgXCJuZXRcIixcbiAgXCJvc1wiLFxuICBcInBhdGhcIixcbiAgXCJwZXJmX2hvb2tzXCIsXG4gIFwicHJvY2Vzc1wiLFxuICBcInB1bnljb2RlXCIsXG4gIFwicXVlcnlzdHJpbmdcIixcbiAgXCJyZWFkbGluZVwiLFxuICBcInJlcGxcIixcbiAgXCJzdHJlYW1cIixcbiAgXCJzdHJpbmdfZGVjb2RlclwiLFxuICBcInN5c1wiLFxuICBcInRpbWVyc1wiLFxuICBcInRsc1wiLFxuICBcInRyYWNlX2V2ZW50c1wiLFxuICBcInR0eVwiLFxuICBcInVybFwiLFxuICBcInV0aWxcIixcbiAgXCJ2OFwiLFxuICBcInZtXCIsXG4gIFwid2FzaVwiLFxuICBcIndvcmtlcl90aHJlYWRzXCIsXG4gIFwiemxpYlwiLFxuXTtcbmV4cG9ydCBmdW5jdGlvbiBzdGFydCgpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJyZXBsLnN0YXJ0XCIpO1xufVxuZXhwb3J0IGRlZmF1bHQge1xuICBSRVBMU2VydmVyLFxuICBidWlsdGluTW9kdWxlcyxcbiAgc3RhcnQsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSw0RUFBNEU7QUFFNUUsU0FBUyxjQUFjLFFBQVEsY0FBYztBQUU3QyxPQUFPLE1BQU07SUFDWCxhQUFjO1FBQ1osZUFBZTtJQUNqQjtBQUNGLENBQUM7QUFDRCxPQUFPLE1BQU0saUJBQWlCO0lBQzVCO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtDQUNELENBQUM7QUFDRixPQUFPLFNBQVMsUUFBUTtJQUN0QixlQUFlO0FBQ2pCLENBQUM7QUFDRCxlQUFlO0lBQ2I7SUFDQTtJQUNBO0FBQ0YsRUFBRSJ9