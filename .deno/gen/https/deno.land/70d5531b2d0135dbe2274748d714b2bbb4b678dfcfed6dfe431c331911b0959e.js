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
import { validateIntegerRange } from "./_utils.ts";
import { EOL as fsEOL } from "../fs/eol.ts";
import process from "./process.ts";
import { isWindows, osType } from "../_util/os.ts";
import { os } from "./internal_binding/constants.ts";
export const constants = os;
const SEE_GITHUB_ISSUE = "See https://github.com/denoland/deno_std/issues/1436";
export function arch() {
    return process.arch;
}
// deno-lint-ignore no-explicit-any
arch[Symbol.toPrimitive] = ()=>process.arch;
// deno-lint-ignore no-explicit-any
endianness[Symbol.toPrimitive] = ()=>endianness();
// deno-lint-ignore no-explicit-any
freemem[Symbol.toPrimitive] = ()=>freemem();
// deno-lint-ignore no-explicit-any
homedir[Symbol.toPrimitive] = ()=>homedir();
// deno-lint-ignore no-explicit-any
hostname[Symbol.toPrimitive] = ()=>hostname();
// deno-lint-ignore no-explicit-any
platform[Symbol.toPrimitive] = ()=>platform();
// deno-lint-ignore no-explicit-any
release[Symbol.toPrimitive] = ()=>release();
// deno-lint-ignore no-explicit-any
version[Symbol.toPrimitive] = ()=>version();
// deno-lint-ignore no-explicit-any
totalmem[Symbol.toPrimitive] = ()=>totalmem();
// deno-lint-ignore no-explicit-any
type[Symbol.toPrimitive] = ()=>type();
// deno-lint-ignore no-explicit-any
uptime[Symbol.toPrimitive] = ()=>uptime();
export function cpus() {
    return Array.from(Array(navigator.hardwareConcurrency)).map(()=>{
        return {
            model: "",
            speed: 0,
            times: {
                user: 0,
                nice: 0,
                sys: 0,
                idle: 0,
                irq: 0
            }
        };
    });
}
/**
 * Returns a string identifying the endianness of the CPU for which the Deno
 * binary was compiled. Possible values are 'BE' for big endian and 'LE' for
 * little endian.
 */ export function endianness() {
    // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView#Endianness
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    // Int16Array uses the platform's endianness.
    return new Int16Array(buffer)[0] === 256 ? "LE" : "BE";
}
/** Return free memory amount */ export function freemem() {
    return Deno.systemMemoryInfo().free;
}
/** Not yet implemented */ export function getPriority(pid = 0) {
    validateIntegerRange(pid, "pid");
    notImplemented(SEE_GITHUB_ISSUE);
}
/** Returns the string path of the current user's home directory. */ export function homedir() {
    // Note: Node/libuv calls getpwuid() / GetUserProfileDirectory() when the
    // environment variable isn't set but that's the (very uncommon) fallback
    // path. IMO, it's okay to punt on that for now.
    switch(osType){
        case "windows":
            return Deno.env.get("USERPROFILE") || null;
        case "linux":
        case "darwin":
        case "freebsd":
            return Deno.env.get("HOME") || null;
        default:
            throw Error("unreachable");
    }
}
/** Returns the host name of the operating system as a string. */ export function hostname() {
    return Deno.hostname();
}
/** Returns an array containing the 1, 5, and 15 minute load averages */ export function loadavg() {
    if (isWindows) {
        return [
            0,
            0,
            0
        ];
    }
    return Deno.loadavg();
}
/** Returns an object containing network interfaces that have been assigned a network address.
 * Each key on the returned object identifies a network interface. The associated value is an array of objects that each describe an assigned network address. */ export function networkInterfaces() {
    const interfaces = {};
    for (const { name , address , netmask , family , mac , scopeid , cidr  } of Deno.networkInterfaces()){
        const addresses = interfaces[name] ||= [];
        const networkAddress = {
            address,
            netmask,
            family,
            mac,
            internal: family === "IPv4" && isIPv4LoopbackAddr(address) || family === "IPv6" && isIPv6LoopbackAddr(address),
            cidr
        };
        if (family === "IPv6") {
            networkAddress.scopeid = scopeid;
        }
        addresses.push(networkAddress);
    }
    return interfaces;
}
function isIPv4LoopbackAddr(addr) {
    return addr.startsWith("127");
}
function isIPv6LoopbackAddr(addr) {
    return addr === "::1" || addr === "fe80::1";
}
/** Returns the a string identifying the operating system platform. The value is set at compile time. Possible values are 'darwin', 'linux', and 'win32'. */ export function platform() {
    return process.platform;
}
/** Returns the operating system as a string */ export function release() {
    return Deno.osRelease();
}
/** Returns a string identifying the kernel version */ export function version() {
    // TODO(kt3k): Temporarily uses Deno.osRelease().
    // Revisit this if this implementation is insufficient for any npm module
    return Deno.osRelease();
}
/** Not yet implemented */ export function setPriority(pid, priority) {
    /* The node API has the 'pid' as the first parameter and as optional.
       This makes for a problematic implementation in Typescript. */ if (priority === undefined) {
        priority = pid;
        pid = 0;
    }
    validateIntegerRange(pid, "pid");
    validateIntegerRange(priority, "priority", -20, 19);
    notImplemented(SEE_GITHUB_ISSUE);
}
/** Returns the operating system's default directory for temporary files as a string. */ export function tmpdir() {
    /* This follows the node js implementation, but has a few
     differences:
     * On windows, if none of the environment variables are defined,
       we return null.
     * On unix we use a plain Deno.env.get, instead of safeGetenv,
       which special cases setuid binaries.
     * Node removes a single trailing / or \, we remove all.
  */ if (isWindows) {
        const temp = Deno.env.get("TEMP") || Deno.env.get("TMP");
        if (temp) {
            return temp.replace(/(?<!:)[/\\]*$/, "");
        }
        const base = Deno.env.get("SYSTEMROOT") || Deno.env.get("WINDIR");
        if (base) {
            return base + "\\temp";
        }
        return null;
    } else {
        const temp1 = Deno.env.get("TMPDIR") || Deno.env.get("TMP") || Deno.env.get("TEMP") || "/tmp";
        return temp1.replace(/(?<!^)\/*$/, "");
    }
}
/** Return total physical memory amount */ export function totalmem() {
    return Deno.systemMemoryInfo().total;
}
/** Returns operating system type (i.e. 'Windows_NT', 'Linux', 'Darwin') */ export function type() {
    switch(Deno.build.os){
        case "windows":
            return "Windows_NT";
        case "linux":
            return "Linux";
        case "darwin":
            return "Darwin";
        case "freebsd":
            return "FreeBSD";
        default:
            throw Error("unreachable");
    }
}
/** Not yet implemented */ export function uptime() {
    notImplemented(SEE_GITHUB_ISSUE);
}
/** Not yet implemented */ export function userInfo(// deno-lint-ignore no-unused-vars
options = {
    encoding: "utf-8"
}) {
    notImplemented(SEE_GITHUB_ISSUE);
}
export const EOL = isWindows ? fsEOL.CRLF : fsEOL.LF;
export const devNull = isWindows ? "\\\\.\\nul" : "/dev/null";
export default {
    arch,
    cpus,
    endianness,
    freemem,
    getPriority,
    homedir,
    hostname,
    loadavg,
    networkInterfaces,
    platform,
    release,
    setPriority,
    tmpdir,
    totalmem,
    type,
    uptime,
    userInfo,
    version,
    constants,
    EOL,
    devNull
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvb3MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuL191dGlscy50c1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVJbnRlZ2VyUmFuZ2UgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IEVPTCBhcyBmc0VPTCB9IGZyb20gXCIuLi9mcy9lb2wudHNcIjtcbmltcG9ydCBwcm9jZXNzIGZyb20gXCIuL3Byb2Nlc3MudHNcIjtcbmltcG9ydCB7IGlzV2luZG93cywgb3NUeXBlIH0gZnJvbSBcIi4uL191dGlsL29zLnRzXCI7XG5pbXBvcnQgeyBvcyB9IGZyb20gXCIuL2ludGVybmFsX2JpbmRpbmcvY29uc3RhbnRzLnRzXCI7XG5cbmV4cG9ydCBjb25zdCBjb25zdGFudHMgPSBvcztcblxuY29uc3QgU0VFX0dJVEhVQl9JU1NVRSA9IFwiU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vX3N0ZC9pc3N1ZXMvMTQzNlwiO1xuXG5pbnRlcmZhY2UgQ1BVVGltZXMge1xuICAvKiogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIENQVSBoYXMgc3BlbnQgaW4gdXNlciBtb2RlICovXG4gIHVzZXI6IG51bWJlcjtcblxuICAvKiogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIENQVSBoYXMgc3BlbnQgaW4gbmljZSBtb2RlICovXG4gIG5pY2U6IG51bWJlcjtcblxuICAvKiogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIENQVSBoYXMgc3BlbnQgaW4gc3lzIG1vZGUgKi9cbiAgc3lzOiBudW1iZXI7XG5cbiAgLyoqIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSBDUFUgaGFzIHNwZW50IGluIGlkbGUgbW9kZSAqL1xuICBpZGxlOiBudW1iZXI7XG5cbiAgLyoqIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSBDUFUgaGFzIHNwZW50IGluIGlycSBtb2RlICovXG4gIGlycTogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQ1BVQ29yZUluZm8ge1xuICBtb2RlbDogc3RyaW5nO1xuXG4gIC8qKiBpbiBNSHogKi9cbiAgc3BlZWQ6IG51bWJlcjtcblxuICB0aW1lczogQ1BVVGltZXM7XG59XG5cbmludGVyZmFjZSBOZXR3b3JrQWRkcmVzcyB7XG4gIC8qKiBUaGUgYXNzaWduZWQgSVB2NCBvciBJUHY2IGFkZHJlc3MgKi9cbiAgYWRkcmVzczogc3RyaW5nO1xuXG4gIC8qKiBUaGUgSVB2NCBvciBJUHY2IG5ldHdvcmsgbWFzayAqL1xuICBuZXRtYXNrOiBzdHJpbmc7XG5cbiAgZmFtaWx5OiBcIklQdjRcIiB8IFwiSVB2NlwiO1xuXG4gIC8qKiBUaGUgTUFDIGFkZHJlc3Mgb2YgdGhlIG5ldHdvcmsgaW50ZXJmYWNlICovXG4gIG1hYzogc3RyaW5nO1xuXG4gIC8qKiB0cnVlIGlmIHRoZSBuZXR3b3JrIGludGVyZmFjZSBpcyBhIGxvb3BiYWNrIG9yIHNpbWlsYXIgaW50ZXJmYWNlIHRoYXQgaXMgbm90IHJlbW90ZWx5IGFjY2Vzc2libGU7IG90aGVyd2lzZSBmYWxzZSAqL1xuICBpbnRlcm5hbDogYm9vbGVhbjtcblxuICAvKiogVGhlIG51bWVyaWMgSVB2NiBzY29wZSBJRCAob25seSBzcGVjaWZpZWQgd2hlbiBmYW1pbHkgaXMgSVB2NikgKi9cbiAgc2NvcGVpZD86IG51bWJlcjtcblxuICAvKiogVGhlIGFzc2lnbmVkIElQdjQgb3IgSVB2NiBhZGRyZXNzIHdpdGggdGhlIHJvdXRpbmcgcHJlZml4IGluIENJRFIgbm90YXRpb24uIElmIHRoZSBuZXRtYXNrIGlzIGludmFsaWQsIHRoaXMgcHJvcGVydHkgaXMgc2V0IHRvIG51bGwuICovXG4gIGNpZHI6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIE5ldHdvcmtJbnRlcmZhY2VzIHtcbiAgW2tleTogc3RyaW5nXTogTmV0d29ya0FkZHJlc3NbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBVc2VySW5mb09wdGlvbnMge1xuICBlbmNvZGluZzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVXNlckluZm8ge1xuICB1c2VybmFtZTogc3RyaW5nO1xuICB1aWQ6IG51bWJlcjtcbiAgZ2lkOiBudW1iZXI7XG4gIHNoZWxsOiBzdHJpbmc7XG4gIGhvbWVkaXI6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFyY2goKTogc3RyaW5nIHtcbiAgcmV0dXJuIHByb2Nlc3MuYXJjaDtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbihhcmNoIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBzdHJpbmcgPT4gcHJvY2Vzcy5hcmNoO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbihlbmRpYW5uZXNzIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBzdHJpbmcgPT4gZW5kaWFubmVzcygpO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbihmcmVlbWVtIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBudW1iZXIgPT4gZnJlZW1lbSgpO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbihob21lZGlyIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBzdHJpbmcgfCBudWxsID0+IGhvbWVkaXIoKTtcbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4oaG9zdG5hbWUgYXMgYW55KVtTeW1ib2wudG9QcmltaXRpdmVdID0gKCk6IHN0cmluZyB8IG51bGwgPT4gaG9zdG5hbWUoKTtcbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4ocGxhdGZvcm0gYXMgYW55KVtTeW1ib2wudG9QcmltaXRpdmVdID0gKCk6IHN0cmluZyA9PiBwbGF0Zm9ybSgpO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbihyZWxlYXNlIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBzdHJpbmcgPT4gcmVsZWFzZSgpO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbih2ZXJzaW9uIGFzIGFueSlbU3ltYm9sLnRvUHJpbWl0aXZlXSA9ICgpOiBzdHJpbmcgPT4gdmVyc2lvbigpO1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbih0b3RhbG1lbSBhcyBhbnkpW1N5bWJvbC50b1ByaW1pdGl2ZV0gPSAoKTogbnVtYmVyID0+IHRvdGFsbWVtKCk7XG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuKHR5cGUgYXMgYW55KVtTeW1ib2wudG9QcmltaXRpdmVdID0gKCk6IHN0cmluZyA9PiB0eXBlKCk7XG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuKHVwdGltZSBhcyBhbnkpW1N5bWJvbC50b1ByaW1pdGl2ZV0gPSAoKTogbnVtYmVyID0+IHVwdGltZSgpO1xuXG5leHBvcnQgZnVuY3Rpb24gY3B1cygpOiBDUFVDb3JlSW5mb1tdIHtcbiAgcmV0dXJuIEFycmF5LmZyb20oQXJyYXkobmF2aWdhdG9yLmhhcmR3YXJlQ29uY3VycmVuY3kpKS5tYXAoKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBtb2RlbDogXCJcIixcbiAgICAgIHNwZWVkOiAwLFxuICAgICAgdGltZXM6IHtcbiAgICAgICAgdXNlcjogMCxcbiAgICAgICAgbmljZTogMCxcbiAgICAgICAgc3lzOiAwLFxuICAgICAgICBpZGxlOiAwLFxuICAgICAgICBpcnE6IDAsXG4gICAgICB9LFxuICAgIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBzdHJpbmcgaWRlbnRpZnlpbmcgdGhlIGVuZGlhbm5lc3Mgb2YgdGhlIENQVSBmb3Igd2hpY2ggdGhlIERlbm9cbiAqIGJpbmFyeSB3YXMgY29tcGlsZWQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgJ0JFJyBmb3IgYmlnIGVuZGlhbiBhbmQgJ0xFJyBmb3JcbiAqIGxpdHRsZSBlbmRpYW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmRpYW5uZXNzKCk6IFwiQkVcIiB8IFwiTEVcIiB7XG4gIC8vIFNvdXJjZTogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRGF0YVZpZXcjRW5kaWFubmVzc1xuICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMik7XG4gIG5ldyBEYXRhVmlldyhidWZmZXIpLnNldEludDE2KDAsIDI1NiwgdHJ1ZSAvKiBsaXR0bGVFbmRpYW4gKi8pO1xuICAvLyBJbnQxNkFycmF5IHVzZXMgdGhlIHBsYXRmb3JtJ3MgZW5kaWFubmVzcy5cbiAgcmV0dXJuIG5ldyBJbnQxNkFycmF5KGJ1ZmZlcilbMF0gPT09IDI1NiA/IFwiTEVcIiA6IFwiQkVcIjtcbn1cblxuLyoqIFJldHVybiBmcmVlIG1lbW9yeSBhbW91bnQgKi9cbmV4cG9ydCBmdW5jdGlvbiBmcmVlbWVtKCk6IG51bWJlciB7XG4gIHJldHVybiBEZW5vLnN5c3RlbU1lbW9yeUluZm8oKS5mcmVlO1xufVxuXG4vKiogTm90IHlldCBpbXBsZW1lbnRlZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByaW9yaXR5KHBpZCA9IDApOiBudW1iZXIge1xuICB2YWxpZGF0ZUludGVnZXJSYW5nZShwaWQsIFwicGlkXCIpO1xuICBub3RJbXBsZW1lbnRlZChTRUVfR0lUSFVCX0lTU1VFKTtcbn1cblxuLyoqIFJldHVybnMgdGhlIHN0cmluZyBwYXRoIG9mIHRoZSBjdXJyZW50IHVzZXIncyBob21lIGRpcmVjdG9yeS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBob21lZGlyKCk6IHN0cmluZyB8IG51bGwge1xuICAvLyBOb3RlOiBOb2RlL2xpYnV2IGNhbGxzIGdldHB3dWlkKCkgLyBHZXRVc2VyUHJvZmlsZURpcmVjdG9yeSgpIHdoZW4gdGhlXG4gIC8vIGVudmlyb25tZW50IHZhcmlhYmxlIGlzbid0IHNldCBidXQgdGhhdCdzIHRoZSAodmVyeSB1bmNvbW1vbikgZmFsbGJhY2tcbiAgLy8gcGF0aC4gSU1PLCBpdCdzIG9rYXkgdG8gcHVudCBvbiB0aGF0IGZvciBub3cuXG4gIHN3aXRjaCAob3NUeXBlKSB7XG4gICAgY2FzZSBcIndpbmRvd3NcIjpcbiAgICAgIHJldHVybiBEZW5vLmVudi5nZXQoXCJVU0VSUFJPRklMRVwiKSB8fCBudWxsO1xuICAgIGNhc2UgXCJsaW51eFwiOlxuICAgIGNhc2UgXCJkYXJ3aW5cIjpcbiAgICBjYXNlIFwiZnJlZWJzZFwiOlxuICAgICAgcmV0dXJuIERlbm8uZW52LmdldChcIkhPTUVcIikgfHwgbnVsbDtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbiAgfVxufVxuXG4vKiogUmV0dXJucyB0aGUgaG9zdCBuYW1lIG9mIHRoZSBvcGVyYXRpbmcgc3lzdGVtIGFzIGEgc3RyaW5nLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhvc3RuYW1lKCk6IHN0cmluZyB7XG4gIHJldHVybiBEZW5vLmhvc3RuYW1lKCk7XG59XG5cbi8qKiBSZXR1cm5zIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIDEsIDUsIGFuZCAxNSBtaW51dGUgbG9hZCBhdmVyYWdlcyAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWRhdmcoKTogbnVtYmVyW10ge1xuICBpZiAoaXNXaW5kb3dzKSB7XG4gICAgcmV0dXJuIFswLCAwLCAwXTtcbiAgfVxuICByZXR1cm4gRGVuby5sb2FkYXZnKCk7XG59XG5cbi8qKiBSZXR1cm5zIGFuIG9iamVjdCBjb250YWluaW5nIG5ldHdvcmsgaW50ZXJmYWNlcyB0aGF0IGhhdmUgYmVlbiBhc3NpZ25lZCBhIG5ldHdvcmsgYWRkcmVzcy5cbiAqIEVhY2gga2V5IG9uIHRoZSByZXR1cm5lZCBvYmplY3QgaWRlbnRpZmllcyBhIG5ldHdvcmsgaW50ZXJmYWNlLiBUaGUgYXNzb2NpYXRlZCB2YWx1ZSBpcyBhbiBhcnJheSBvZiBvYmplY3RzIHRoYXQgZWFjaCBkZXNjcmliZSBhbiBhc3NpZ25lZCBuZXR3b3JrIGFkZHJlc3MuICovXG5leHBvcnQgZnVuY3Rpb24gbmV0d29ya0ludGVyZmFjZXMoKTogTmV0d29ya0ludGVyZmFjZXMge1xuICBjb25zdCBpbnRlcmZhY2VzOiBOZXR3b3JrSW50ZXJmYWNlcyA9IHt9O1xuICBmb3IgKFxuICAgIGNvbnN0IHsgbmFtZSwgYWRkcmVzcywgbmV0bWFzaywgZmFtaWx5LCBtYWMsIHNjb3BlaWQsIGNpZHIgfSBvZiBEZW5vXG4gICAgICAubmV0d29ya0ludGVyZmFjZXMoKVxuICApIHtcbiAgICBjb25zdCBhZGRyZXNzZXMgPSBpbnRlcmZhY2VzW25hbWVdIHx8PSBbXTtcbiAgICBjb25zdCBuZXR3b3JrQWRkcmVzczogTmV0d29ya0FkZHJlc3MgPSB7XG4gICAgICBhZGRyZXNzLFxuICAgICAgbmV0bWFzayxcbiAgICAgIGZhbWlseSxcbiAgICAgIG1hYyxcbiAgICAgIGludGVybmFsOiAoZmFtaWx5ID09PSBcIklQdjRcIiAmJiBpc0lQdjRMb29wYmFja0FkZHIoYWRkcmVzcykpIHx8XG4gICAgICAgIChmYW1pbHkgPT09IFwiSVB2NlwiICYmIGlzSVB2Nkxvb3BiYWNrQWRkcihhZGRyZXNzKSksXG4gICAgICBjaWRyLFxuICAgIH07XG4gICAgaWYgKGZhbWlseSA9PT0gXCJJUHY2XCIpIHtcbiAgICAgIG5ldHdvcmtBZGRyZXNzLnNjb3BlaWQgPSBzY29wZWlkITtcbiAgICB9XG4gICAgYWRkcmVzc2VzLnB1c2gobmV0d29ya0FkZHJlc3MpO1xuICB9XG4gIHJldHVybiBpbnRlcmZhY2VzO1xufVxuXG5mdW5jdGlvbiBpc0lQdjRMb29wYmFja0FkZHIoYWRkcjogc3RyaW5nKSB7XG4gIHJldHVybiBhZGRyLnN0YXJ0c1dpdGgoXCIxMjdcIik7XG59XG5cbmZ1bmN0aW9uIGlzSVB2Nkxvb3BiYWNrQWRkcihhZGRyOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGFkZHIgPT09IFwiOjoxXCIgfHwgYWRkciA9PT0gXCJmZTgwOjoxXCI7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBhIHN0cmluZyBpZGVudGlmeWluZyB0aGUgb3BlcmF0aW5nIHN5c3RlbSBwbGF0Zm9ybS4gVGhlIHZhbHVlIGlzIHNldCBhdCBjb21waWxlIHRpbWUuIFBvc3NpYmxlIHZhbHVlcyBhcmUgJ2RhcndpbicsICdsaW51eCcsIGFuZCAnd2luMzInLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBsYXRmb3JtKCk6IHN0cmluZyB7XG4gIHJldHVybiBwcm9jZXNzLnBsYXRmb3JtO1xufVxuXG4vKiogUmV0dXJucyB0aGUgb3BlcmF0aW5nIHN5c3RlbSBhcyBhIHN0cmluZyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoKTogc3RyaW5nIHtcbiAgcmV0dXJuIERlbm8ub3NSZWxlYXNlKCk7XG59XG5cbi8qKiBSZXR1cm5zIGEgc3RyaW5nIGlkZW50aWZ5aW5nIHRoZSBrZXJuZWwgdmVyc2lvbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlcnNpb24oKTogc3RyaW5nIHtcbiAgLy8gVE9ETyhrdDNrKTogVGVtcG9yYXJpbHkgdXNlcyBEZW5vLm9zUmVsZWFzZSgpLlxuICAvLyBSZXZpc2l0IHRoaXMgaWYgdGhpcyBpbXBsZW1lbnRhdGlvbiBpcyBpbnN1ZmZpY2llbnQgZm9yIGFueSBucG0gbW9kdWxlXG4gIHJldHVybiBEZW5vLm9zUmVsZWFzZSgpO1xufVxuXG4vKiogTm90IHlldCBpbXBsZW1lbnRlZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFByaW9yaXR5KHBpZDogbnVtYmVyLCBwcmlvcml0eT86IG51bWJlcikge1xuICAvKiBUaGUgbm9kZSBBUEkgaGFzIHRoZSAncGlkJyBhcyB0aGUgZmlyc3QgcGFyYW1ldGVyIGFuZCBhcyBvcHRpb25hbC5cbiAgICAgICBUaGlzIG1ha2VzIGZvciBhIHByb2JsZW1hdGljIGltcGxlbWVudGF0aW9uIGluIFR5cGVzY3JpcHQuICovXG4gIGlmIChwcmlvcml0eSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcHJpb3JpdHkgPSBwaWQ7XG4gICAgcGlkID0gMDtcbiAgfVxuICB2YWxpZGF0ZUludGVnZXJSYW5nZShwaWQsIFwicGlkXCIpO1xuICB2YWxpZGF0ZUludGVnZXJSYW5nZShwcmlvcml0eSwgXCJwcmlvcml0eVwiLCAtMjAsIDE5KTtcblxuICBub3RJbXBsZW1lbnRlZChTRUVfR0lUSFVCX0lTU1VFKTtcbn1cblxuLyoqIFJldHVybnMgdGhlIG9wZXJhdGluZyBzeXN0ZW0ncyBkZWZhdWx0IGRpcmVjdG9yeSBmb3IgdGVtcG9yYXJ5IGZpbGVzIGFzIGEgc3RyaW5nLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRtcGRpcigpOiBzdHJpbmcgfCBudWxsIHtcbiAgLyogVGhpcyBmb2xsb3dzIHRoZSBub2RlIGpzIGltcGxlbWVudGF0aW9uLCBidXQgaGFzIGEgZmV3XG4gICAgIGRpZmZlcmVuY2VzOlxuICAgICAqIE9uIHdpbmRvd3MsIGlmIG5vbmUgb2YgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlcyBhcmUgZGVmaW5lZCxcbiAgICAgICB3ZSByZXR1cm4gbnVsbC5cbiAgICAgKiBPbiB1bml4IHdlIHVzZSBhIHBsYWluIERlbm8uZW52LmdldCwgaW5zdGVhZCBvZiBzYWZlR2V0ZW52LFxuICAgICAgIHdoaWNoIHNwZWNpYWwgY2FzZXMgc2V0dWlkIGJpbmFyaWVzLlxuICAgICAqIE5vZGUgcmVtb3ZlcyBhIHNpbmdsZSB0cmFpbGluZyAvIG9yIFxcLCB3ZSByZW1vdmUgYWxsLlxuICAqL1xuICBpZiAoaXNXaW5kb3dzKSB7XG4gICAgY29uc3QgdGVtcCA9IERlbm8uZW52LmdldChcIlRFTVBcIikgfHwgRGVuby5lbnYuZ2V0KFwiVE1QXCIpO1xuICAgIGlmICh0ZW1wKSB7XG4gICAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8oPzwhOilbL1xcXFxdKiQvLCBcIlwiKTtcbiAgICB9XG4gICAgY29uc3QgYmFzZSA9IERlbm8uZW52LmdldChcIlNZU1RFTVJPT1RcIikgfHwgRGVuby5lbnYuZ2V0KFwiV0lORElSXCIpO1xuICAgIGlmIChiYXNlKSB7XG4gICAgICByZXR1cm4gYmFzZSArIFwiXFxcXHRlbXBcIjtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSB7IC8vICFpc1dpbmRvd3NcbiAgICBjb25zdCB0ZW1wID0gRGVuby5lbnYuZ2V0KFwiVE1QRElSXCIpIHx8IERlbm8uZW52LmdldChcIlRNUFwiKSB8fFxuICAgICAgRGVuby5lbnYuZ2V0KFwiVEVNUFwiKSB8fCBcIi90bXBcIjtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8oPzwhXilcXC8qJC8sIFwiXCIpO1xuICB9XG59XG5cbi8qKiBSZXR1cm4gdG90YWwgcGh5c2ljYWwgbWVtb3J5IGFtb3VudCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvdGFsbWVtKCk6IG51bWJlciB7XG4gIHJldHVybiBEZW5vLnN5c3RlbU1lbW9yeUluZm8oKS50b3RhbDtcbn1cblxuLyoqIFJldHVybnMgb3BlcmF0aW5nIHN5c3RlbSB0eXBlIChpLmUuICdXaW5kb3dzX05UJywgJ0xpbnV4JywgJ0RhcndpbicpICovXG5leHBvcnQgZnVuY3Rpb24gdHlwZSgpOiBzdHJpbmcge1xuICBzd2l0Y2ggKERlbm8uYnVpbGQub3MgYXMgc3RyaW5nKSB7XG4gICAgY2FzZSBcIndpbmRvd3NcIjpcbiAgICAgIHJldHVybiBcIldpbmRvd3NfTlRcIjtcbiAgICBjYXNlIFwibGludXhcIjpcbiAgICAgIHJldHVybiBcIkxpbnV4XCI7XG4gICAgY2FzZSBcImRhcndpblwiOlxuICAgICAgcmV0dXJuIFwiRGFyd2luXCI7XG4gICAgY2FzZSBcImZyZWVic2RcIjpcbiAgICAgIHJldHVybiBcIkZyZWVCU0RcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbiAgfVxufVxuXG4vKiogTm90IHlldCBpbXBsZW1lbnRlZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVwdGltZSgpOiBudW1iZXIge1xuICBub3RJbXBsZW1lbnRlZChTRUVfR0lUSFVCX0lTU1VFKTtcbn1cblxuLyoqIE5vdCB5ZXQgaW1wbGVtZW50ZWQgKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VySW5mbyhcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby11bnVzZWQtdmFyc1xuICBvcHRpb25zOiBVc2VySW5mb09wdGlvbnMgPSB7IGVuY29kaW5nOiBcInV0Zi04XCIgfSxcbik6IFVzZXJJbmZvIHtcbiAgbm90SW1wbGVtZW50ZWQoU0VFX0dJVEhVQl9JU1NVRSk7XG59XG5cbmV4cG9ydCBjb25zdCBFT0wgPSBpc1dpbmRvd3MgPyBmc0VPTC5DUkxGIDogZnNFT0wuTEY7XG5leHBvcnQgY29uc3QgZGV2TnVsbCA9IGlzV2luZG93cyA/IFwiXFxcXFxcXFwuXFxcXG51bFwiIDogXCIvZGV2L251bGxcIjtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBhcmNoLFxuICBjcHVzLFxuICBlbmRpYW5uZXNzLFxuICBmcmVlbWVtLFxuICBnZXRQcmlvcml0eSxcbiAgaG9tZWRpcixcbiAgaG9zdG5hbWUsXG4gIGxvYWRhdmcsXG4gIG5ldHdvcmtJbnRlcmZhY2VzLFxuICBwbGF0Zm9ybSxcbiAgcmVsZWFzZSxcbiAgc2V0UHJpb3JpdHksXG4gIHRtcGRpcixcbiAgdG90YWxtZW0sXG4gIHR5cGUsXG4gIHVwdGltZSxcbiAgdXNlckluZm8sXG4gIHZlcnNpb24sXG4gIGNvbnN0YW50cyxcbiAgRU9MLFxuICBkZXZOdWxsLFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSx5REFBeUQ7QUFDekQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSw2REFBNkQ7QUFDN0QsNEVBQTRFO0FBQzVFLDJFQUEyRTtBQUMzRSx3RUFBd0U7QUFDeEUsNEVBQTRFO0FBQzVFLHlDQUF5QztBQUV6QyxTQUFTLGNBQWMsUUFBUSxjQUFjO0FBQzdDLFNBQVMsb0JBQW9CLFFBQVEsY0FBYztBQUNuRCxTQUFTLE9BQU8sS0FBSyxRQUFRLGVBQWU7QUFDNUMsT0FBTyxhQUFhLGVBQWU7QUFDbkMsU0FBUyxTQUFTLEVBQUUsTUFBTSxRQUFRLGlCQUFpQjtBQUNuRCxTQUFTLEVBQUUsUUFBUSxrQ0FBa0M7QUFFckQsT0FBTyxNQUFNLFlBQVksR0FBRztBQUU1QixNQUFNLG1CQUFtQjtBQWtFekIsT0FBTyxTQUFTLE9BQWU7SUFDN0IsT0FBTyxRQUFRLElBQUk7QUFDckIsQ0FBQztBQUVELG1DQUFtQztBQUNsQyxJQUFZLENBQUMsT0FBTyxXQUFXLENBQUMsR0FBRyxJQUFjLFFBQVEsSUFBSTtBQUM5RCxtQ0FBbUM7QUFDbEMsVUFBa0IsQ0FBQyxPQUFPLFdBQVcsQ0FBQyxHQUFHLElBQWM7QUFDeEQsbUNBQW1DO0FBQ2xDLE9BQWUsQ0FBQyxPQUFPLFdBQVcsQ0FBQyxHQUFHLElBQWM7QUFDckQsbUNBQW1DO0FBQ2xDLE9BQWUsQ0FBQyxP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