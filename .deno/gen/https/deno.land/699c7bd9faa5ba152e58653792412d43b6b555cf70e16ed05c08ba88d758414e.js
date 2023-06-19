// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/** Returns the index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the start of the array.
 *
 * The complexity of this function is O(source.lenth * needle.length).
 *
 * ```ts
 * import { indexOfNeedle } from "https://deno.land/std@$STD_VERSION/bytes/index_of_needle.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * console.log(indexOfNeedle(source, needle)); // 1
 * console.log(indexOfNeedle(source, needle, 2)); // 3
 * ```
 */ export function indexOfNeedle(source, needle, start = 0) {
    if (start >= source.length) {
        return -1;
    }
    if (start < 0) {
        start = Math.max(0, source.length + start);
    }
    const s = needle[0];
    for(let i = start; i < source.length; i++){
        if (source[i] !== s) continue;
        const pin = i;
        let matched = 1;
        let j = i;
        while(matched < needle.length){
            j++;
            if (source[j] !== needle[j - pin]) {
                break;
            }
            matched++;
        }
        if (matched === needle.length) {
            return pin;
        }
    }
    return -1;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2J5dGVzL2luZGV4X29mX25lZWRsZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vKiogUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgdGhlIG5lZWRsZSBhcnJheSBpbiB0aGUgc291cmNlXG4gKiBhcnJheSwgb3IgLTEgaWYgaXQgaXMgbm90IHByZXNlbnQuXG4gKlxuICogQSBzdGFydCBpbmRleCBjYW4gYmUgc3BlY2lmaWVkIGFzIHRoZSB0aGlyZCBhcmd1bWVudCB0aGF0IGJlZ2lucyB0aGUgc2VhcmNoXG4gKiBhdCB0aGF0IGdpdmVuIGluZGV4LiBUaGUgc3RhcnQgaW5kZXggZGVmYXVsdHMgdG8gdGhlIHN0YXJ0IG9mIHRoZSBhcnJheS5cbiAqXG4gKiBUaGUgY29tcGxleGl0eSBvZiB0aGlzIGZ1bmN0aW9uIGlzIE8oc291cmNlLmxlbnRoICogbmVlZGxlLmxlbmd0aCkuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGluZGV4T2ZOZWVkbGUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9ieXRlcy9pbmRleF9vZl9uZWVkbGUudHNcIjtcbiAqIGNvbnN0IHNvdXJjZSA9IG5ldyBVaW50OEFycmF5KFswLCAxLCAyLCAxLCAyLCAxLCAyLCAzXSk7XG4gKiBjb25zdCBuZWVkbGUgPSBuZXcgVWludDhBcnJheShbMSwgMl0pO1xuICogY29uc29sZS5sb2coaW5kZXhPZk5lZWRsZShzb3VyY2UsIG5lZWRsZSkpOyAvLyAxXG4gKiBjb25zb2xlLmxvZyhpbmRleE9mTmVlZGxlKHNvdXJjZSwgbmVlZGxlLCAyKSk7IC8vIDNcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5kZXhPZk5lZWRsZShcbiAgc291cmNlOiBVaW50OEFycmF5LFxuICBuZWVkbGU6IFVpbnQ4QXJyYXksXG4gIHN0YXJ0ID0gMCxcbik6IG51bWJlciB7XG4gIGlmIChzdGFydCA+PSBzb3VyY2UubGVuZ3RoKSB7XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IE1hdGgubWF4KDAsIHNvdXJjZS5sZW5ndGggKyBzdGFydCk7XG4gIH1cbiAgY29uc3QgcyA9IG5lZWRsZVswXTtcbiAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgc291cmNlLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHNvdXJjZVtpXSAhPT0gcykgY29udGludWU7XG4gICAgY29uc3QgcGluID0gaTtcbiAgICBsZXQgbWF0Y2hlZCA9IDE7XG4gICAgbGV0IGogPSBpO1xuICAgIHdoaWxlIChtYXRjaGVkIDwgbmVlZGxlLmxlbmd0aCkge1xuICAgICAgaisrO1xuICAgICAgaWYgKHNvdXJjZVtqXSAhPT0gbmVlZGxlW2ogLSBwaW5dKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgbWF0Y2hlZCsrO1xuICAgIH1cbiAgICBpZiAobWF0Y2hlZCA9PT0gbmVlZGxlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHBpbjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckM7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLGNBQ2QsTUFBa0IsRUFDbEIsTUFBa0IsRUFDbEIsUUFBUSxDQUFDLEVBQ0Q7SUFDUixJQUFJLFNBQVMsT0FBTyxNQUFNLEVBQUU7UUFDMUIsT0FBTyxDQUFDO0lBQ1YsQ0FBQztJQUNELElBQUksUUFBUSxHQUFHO1FBQ2IsUUFBUSxLQUFLLEdBQUcsQ0FBQyxHQUFHLE9BQU8sTUFBTSxHQUFHO0lBQ3RDLENBQUM7SUFDRCxNQUFNLElBQUksTUFBTSxDQUFDLEVBQUU7SUFDbkIsSUFBSyxJQUFJLElBQUksT0FBTyxJQUFJLE9BQU8sTUFBTSxFQUFFLElBQUs7UUFDMUMsSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLEdBQUcsUUFBUztRQUM5QixNQUFNLE1BQU07UUFDWixJQUFJLFVBQVU7UUFDZCxJQUFJLElBQUk7UUFDUixNQUFPLFVBQVUsT0FBTyxNQUFNLENBQUU7WUFDOUI7WUFDQSxJQUFJLE1BQU0sQ0FBQyxFQUFFLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFO2dCQUNqQyxLQUFNO1lBQ1IsQ0FBQztZQUNEO1FBQ0Y7UUFDQSxJQUFJLFlBQVksT0FBTyxNQUFNLEVBQUU7WUFDN0IsT0FBTztRQUNULENBQUM7SUFDSDtJQUNBLE9BQU8sQ0FBQztBQUNWLENBQUMifQ==