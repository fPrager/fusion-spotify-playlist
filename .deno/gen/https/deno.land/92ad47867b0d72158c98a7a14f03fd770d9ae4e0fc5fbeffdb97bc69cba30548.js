// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { assert } from "../_util/asserts.ts";
/** Compare to array buffers or data views in a way that timing based attacks
 * cannot gain information about the platform. */ export function timingSafeEqual(a, b) {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    if (!(a instanceof DataView)) {
        a = new DataView(ArrayBuffer.isView(a) ? a.buffer : a);
    }
    if (!(b instanceof DataView)) {
        b = new DataView(ArrayBuffer.isView(b) ? b.buffer : b);
    }
    assert(a instanceof DataView);
    assert(b instanceof DataView);
    const length = a.byteLength;
    let out = 0;
    let i = -1;
    while(++i < length){
        out |= a.getUint8(i) ^ b.getUint8(i);
    }
    return out === 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2NyeXB0by90aW1pbmdfc2FmZV9lcXVhbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0cy50c1wiO1xuXG4vKiogQ29tcGFyZSB0byBhcnJheSBidWZmZXJzIG9yIGRhdGEgdmlld3MgaW4gYSB3YXkgdGhhdCB0aW1pbmcgYmFzZWQgYXR0YWNrc1xuICogY2Fubm90IGdhaW4gaW5mb3JtYXRpb24gYWJvdXQgdGhlIHBsYXRmb3JtLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRpbWluZ1NhZmVFcXVhbChcbiAgYTogQXJyYXlCdWZmZXJWaWV3IHwgQXJyYXlCdWZmZXJMaWtlIHwgRGF0YVZpZXcsXG4gIGI6IEFycmF5QnVmZmVyVmlldyB8IEFycmF5QnVmZmVyTGlrZSB8IERhdGFWaWV3LFxuKTogYm9vbGVhbiB7XG4gIGlmIChhLmJ5dGVMZW5ndGggIT09IGIuYnl0ZUxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoIShhIGluc3RhbmNlb2YgRGF0YVZpZXcpKSB7XG4gICAgYSA9IG5ldyBEYXRhVmlldyhBcnJheUJ1ZmZlci5pc1ZpZXcoYSkgPyBhLmJ1ZmZlciA6IGEpO1xuICB9XG4gIGlmICghKGIgaW5zdGFuY2VvZiBEYXRhVmlldykpIHtcbiAgICBiID0gbmV3IERhdGFWaWV3KEFycmF5QnVmZmVyLmlzVmlldyhiKSA/IGIuYnVmZmVyIDogYik7XG4gIH1cbiAgYXNzZXJ0KGEgaW5zdGFuY2VvZiBEYXRhVmlldyk7XG4gIGFzc2VydChiIGluc3RhbmNlb2YgRGF0YVZpZXcpO1xuICBjb25zdCBsZW5ndGggPSBhLmJ5dGVMZW5ndGg7XG4gIGxldCBvdXQgPSAwO1xuICBsZXQgaSA9IC0xO1xuICB3aGlsZSAoKytpIDwgbGVuZ3RoKSB7XG4gICAgb3V0IHw9IGEuZ2V0VWludDgoaSkgXiBiLmdldFVpbnQ4KGkpO1xuICB9XG4gIHJldHVybiBvdXQgPT09IDA7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFLFNBQVMsTUFBTSxRQUFRLHNCQUFzQjtBQUU3QzsrQ0FDK0MsR0FDL0MsT0FBTyxTQUFTLGdCQUNkLENBQStDLEVBQy9DLENBQStDLEVBQ3RDO0lBQ1QsSUFBSSxFQUFFLFVBQVUsS0FBSyxFQUFFLFVBQVUsRUFBRTtRQUNqQyxPQUFPLEtBQUs7SUFDZCxDQUFDO0lBQ0QsSUFBSSxDQUFDLENBQUMsYUFBYSxRQUFRLEdBQUc7UUFDNUIsSUFBSSxJQUFJLFNBQVMsWUFBWSxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sR0FBRyxDQUFDO0lBQ3ZELENBQUM7SUFDRCxJQUFJLENBQUMsQ0FBQyxhQUFhLFFBQVEsR0FBRztRQUM1QixJQUFJLElBQUksU0FBUyxZQUFZLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxHQUFHLENBQUM7SUFDdkQsQ0FBQztJQUNELE9BQU8sYUFBYTtJQUNwQixPQUFPLGFBQWE7SUFDcEIsTUFBTSxTQUFTLEVBQUUsVUFBVTtJQUMzQixJQUFJLE1BQU07SUFDVixJQUFJLElBQUksQ0FBQztJQUNULE1BQU8sRUFBRSxJQUFJLE9BQVE7UUFDbkIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDO0lBQ3BDO0lBQ0EsT0FBTyxRQUFRO0FBQ2pCLENBQUMifQ==