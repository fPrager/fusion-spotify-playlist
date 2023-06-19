// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * @param n Number to act on.
 * @return The number rounded up to the nearest power of 2.
 */ export function ceilPowOf2(n) {
    const roundPowOf2 = 1 << 31 - Math.clz32(n);
    return roundPowOf2 < n ? roundPowOf2 * 2 : roundPowOf2;
}
/** Initial backoff delay of 5ms following a temporary accept failure. */ export const INITIAL_ACCEPT_BACKOFF_DELAY = 5;
/** Max backoff delay of 1s following a temporary accept failure. */ export const MAX_ACCEPT_BACKOFF_DELAY = 1000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9fbGlzdGVuLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vKipcbiAqIEBwYXJhbSBuIE51bWJlciB0byBhY3Qgb24uXG4gKiBAcmV0dXJuIFRoZSBudW1iZXIgcm91bmRlZCB1cCB0byB0aGUgbmVhcmVzdCBwb3dlciBvZiAyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2VpbFBvd09mMihuOiBudW1iZXIpIHtcbiAgY29uc3Qgcm91bmRQb3dPZjIgPSAxIDw8ICgzMSAtIE1hdGguY2x6MzIobikpO1xuXG4gIHJldHVybiByb3VuZFBvd09mMiA8IG4gPyByb3VuZFBvd09mMiAqIDIgOiByb3VuZFBvd09mMjtcbn1cblxuLyoqIEluaXRpYWwgYmFja29mZiBkZWxheSBvZiA1bXMgZm9sbG93aW5nIGEgdGVtcG9yYXJ5IGFjY2VwdCBmYWlsdXJlLiAqL1xuZXhwb3J0IGNvbnN0IElOSVRJQUxfQUNDRVBUX0JBQ0tPRkZfREVMQVkgPSA1O1xuXG4vKiogTWF4IGJhY2tvZmYgZGVsYXkgb2YgMXMgZm9sbG93aW5nIGEgdGVtcG9yYXJ5IGFjY2VwdCBmYWlsdXJlLiAqL1xuZXhwb3J0IGNvbnN0IE1BWF9BQ0NFUFRfQkFDS09GRl9ERUxBWSA9IDEwMDA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFOzs7Q0FHQyxHQUNELE9BQU8sU0FBUyxXQUFXLENBQVMsRUFBRTtJQUNwQyxNQUFNLGNBQWMsS0FBTSxLQUFLLEtBQUssS0FBSyxDQUFDO0lBRTFDLE9BQU8sY0FBYyxJQUFJLGNBQWMsSUFBSSxXQUFXO0FBQ3hELENBQUM7QUFFRCx1RUFBdUUsR0FDdkUsT0FBTyxNQUFNLCtCQUErQixFQUFFO0FBRTlDLGtFQUFrRSxHQUNsRSxPQUFPLE1BQU0sMkJBQTJCLEtBQUsifQ==