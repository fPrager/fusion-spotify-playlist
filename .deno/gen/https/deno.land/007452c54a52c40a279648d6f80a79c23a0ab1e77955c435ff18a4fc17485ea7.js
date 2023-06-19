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
// - https://github.com/nodejs/node/blob/master/src/node_file-inl.h
// - https://github.com/nodejs/node/blob/master/src/node_file.cc
// - https://github.com/nodejs/node/blob/master/src/node_file.h
import { assert } from "../../_util/asserts.ts";
/**
 * Write to the given file from the given buffer synchronously.
 *
 * Implements sync part of WriteBuffer in src/node_file.cc
 * See: https://github.com/nodejs/node/blob/e9ed113/src/node_file.cc#L1818
 *
 * @param fs file descriptor
 * @param buffer the data to write
 * @param offset where in the buffer to start from
 * @param length how much to write
 * @param position if integer, position to write at in the file. if null, write from the current position
 * @param context context object for passing error number
 */ export function writeBuffer(fd, buffer, offset, length, position, ctx) {
    assert(offset >= 0, "offset should be greater or equal to 0");
    assert(offset + length <= buffer.byteLength, `buffer doesn't have enough data: byteLength = ${buffer.byteLength}, offset + length = ${offset + length}`);
    if (position) {
        Deno.seekSync(fd, position, Deno.SeekMode.Current);
    }
    const subarray = buffer.subarray(offset, offset + length);
    try {
        return Deno.writeSync(fd, subarray);
    } catch (e) {
        ctx.errno = extractOsErrorNumberFromErrorMessage(e);
        return 0;
    }
}
function extractOsErrorNumberFromErrorMessage(e) {
    const match = e instanceof Error ? e.message.match(/\(os error (\d+)\)/) : false;
    if (match) {
        return +match[1];
    }
    return 255; // Unknown error
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9ub2RlX2ZpbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBUaGlzIG1vZHVsZSBwb3J0czpcbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy9ub2RlX2ZpbGUtaW5sLmhcbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy9ub2RlX2ZpbGUuY2Ncbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy9ub2RlX2ZpbGUuaFxuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vLi4vX3V0aWwvYXNzZXJ0cy50c1wiO1xuXG4vKipcbiAqIFdyaXRlIHRvIHRoZSBnaXZlbiBmaWxlIGZyb20gdGhlIGdpdmVuIGJ1ZmZlciBzeW5jaHJvbm91c2x5LlxuICpcbiAqIEltcGxlbWVudHMgc3luYyBwYXJ0IG9mIFdyaXRlQnVmZmVyIGluIHNyYy9ub2RlX2ZpbGUuY2NcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvZTllZDExMy9zcmMvbm9kZV9maWxlLmNjI0wxODE4XG4gKlxuICogQHBhcmFtIGZzIGZpbGUgZGVzY3JpcHRvclxuICogQHBhcmFtIGJ1ZmZlciB0aGUgZGF0YSB0byB3cml0ZVxuICogQHBhcmFtIG9mZnNldCB3aGVyZSBpbiB0aGUgYnVmZmVyIHRvIHN0YXJ0IGZyb21cbiAqIEBwYXJhbSBsZW5ndGggaG93IG11Y2ggdG8gd3JpdGVcbiAqIEBwYXJhbSBwb3NpdGlvbiBpZiBpbnRlZ2VyLCBwb3NpdGlvbiB0byB3cml0ZSBhdCBpbiB0aGUgZmlsZS4gaWYgbnVsbCwgd3JpdGUgZnJvbSB0aGUgY3VycmVudCBwb3NpdGlvblxuICogQHBhcmFtIGNvbnRleHQgY29udGV4dCBvYmplY3QgZm9yIHBhc3NpbmcgZXJyb3IgbnVtYmVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUJ1ZmZlcihcbiAgZmQ6IG51bWJlcixcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBvZmZzZXQ6IG51bWJlcixcbiAgbGVuZ3RoOiBudW1iZXIsXG4gIHBvc2l0aW9uOiBudW1iZXIgfCBudWxsLFxuICBjdHg6IHsgZXJybm8/OiBudW1iZXIgfSxcbikge1xuICBhc3NlcnQob2Zmc2V0ID49IDAsIFwib2Zmc2V0IHNob3VsZCBiZSBncmVhdGVyIG9yIGVxdWFsIHRvIDBcIik7XG4gIGFzc2VydChcbiAgICBvZmZzZXQgKyBsZW5ndGggPD0gYnVmZmVyLmJ5dGVMZW5ndGgsXG4gICAgYGJ1ZmZlciBkb2Vzbid0IGhhdmUgZW5vdWdoIGRhdGE6IGJ5dGVMZW5ndGggPSAke2J1ZmZlci5ieXRlTGVuZ3RofSwgb2Zmc2V0ICsgbGVuZ3RoID0gJHtcbiAgICAgIG9mZnNldCArXG4gICAgICBsZW5ndGhcbiAgICB9YCxcbiAgKTtcblxuICBpZiAocG9zaXRpb24pIHtcbiAgICBEZW5vLnNlZWtTeW5jKGZkLCBwb3NpdGlvbiwgRGVuby5TZWVrTW9kZS5DdXJyZW50KTtcbiAgfVxuXG4gIGNvbnN0IHN1YmFycmF5ID0gYnVmZmVyLnN1YmFycmF5KG9mZnNldCwgb2Zmc2V0ICsgbGVuZ3RoKTtcblxuICB0cnkge1xuICAgIHJldHVybiBEZW5vLndyaXRlU3luYyhmZCwgc3ViYXJyYXkpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY3R4LmVycm5vID0gZXh0cmFjdE9zRXJyb3JOdW1iZXJGcm9tRXJyb3JNZXNzYWdlKGUpO1xuICAgIHJldHVybiAwO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RPc0Vycm9yTnVtYmVyRnJvbUVycm9yTWVzc2FnZShlOiB1bmtub3duKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSBlIGluc3RhbmNlb2YgRXJyb3JcbiAgICA/IGUubWVzc2FnZS5tYXRjaCgvXFwob3MgZXJyb3IgKFxcZCspXFwpLylcbiAgICA6IGZhbHNlO1xuXG4gIGlmIChtYXRjaCkge1xuICAgIHJldHVybiArbWF0Y2hbMV07XG4gIH1cblxuICByZXR1cm4gMjU1OyAvLyBVbmtub3duIGVycm9yXG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0Usd0VBQXdFO0FBQ3hFLDRFQUE0RTtBQUM1RSx5Q0FBeUM7QUFFekMscUJBQXFCO0FBQ3JCLG1FQUFtRTtBQUNuRSxnRUFBZ0U7QUFDaEUsK0RBQStEO0FBRS9ELFNBQVMsTUFBTSxRQUFRLHlCQUF5QjtBQUVoRDs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsWUFDZCxFQUFVLEVBQ1YsTUFBa0IsRUFDbEIsTUFBYyxFQUNkLE1BQWMsRUFDZCxRQUF1QixFQUN2QixHQUF1QixFQUN2QjtJQUNBLE9BQU8sVUFBVSxHQUFHO0lBQ3BCLE9BQ0UsU0FBUyxVQUFVLE9BQU8sVUFBVSxFQUNwQyxDQUFDLDhDQUE4QyxFQUFFLE9BQU8sVUFBVSxDQUFDLG9CQUFvQixFQUNyRixTQUNBLE9BQ0QsQ0FBQztJQUdKLElBQUksVUFBVTtRQUNaLEtBQUssUUFBUSxDQUFDLElBQUksVUFBVSxLQUFLLFFBQVEsQ0FBQyxPQUFPO0lBQ25ELENBQUM7SUFFRCxNQUFNLFdBQVcsT0FBTyxRQUFRLENBQUMsUUFBUSxTQUFTO0lBRWxELElBQUk7UUFDRixPQUFPLEtBQUssU0FBUyxDQUFDLElBQUk7SUFDNUIsRUFBRSxPQUFPLEdBQUc7UUFDVixJQUFJLEtBQUssR0FBRyxxQ0FBcUM7UUFDakQsT0FBTztJQUNUO0FBQ0YsQ0FBQztBQUVELFNBQVMscUNBQXFDLENBQVUsRUFBVTtJQUNoRSxNQUFNLFFBQVEsYUFBYSxRQUN2QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0JBQ2hCLEtBQUs7SUFFVCxJQUFJLE9BQU87UUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDbEIsQ0FBQztJQUVELE9BQU8sS0FBSyxnQkFBZ0I7QUFDOUIifQ==