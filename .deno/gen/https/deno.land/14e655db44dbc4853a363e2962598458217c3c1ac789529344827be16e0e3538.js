// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Encodings } from "./_node.ts";
import { indexOfNeedle } from "../../bytes/index_of_needle.ts";
export function numberToBytes(n) {
    if (n === 0) return new Uint8Array([
        0
    ]);
    const bytes = [];
    bytes.unshift(n & 255);
    while(n >= 256){
        n = n >>> 8;
        bytes.unshift(n & 255);
    }
    return new Uint8Array(bytes);
}
// TODO(Soremwar)
// Check if offset or buffer can be transform in order to just use std's lastIndexOf directly
// This implementation differs from std's lastIndexOf in the fact that
// it also includes items outside of the offset as long as part of the
// set is contained inside of the offset
// Probably way slower too
function findLastIndex(targetBuffer, buffer, offset) {
    offset = offset > targetBuffer.length ? targetBuffer.length : offset;
    const searchableBuffer = targetBuffer.slice(0, offset + buffer.length);
    const searchableBufferLastIndex = searchableBuffer.length - 1;
    const bufferLastIndex = buffer.length - 1;
    // Important to keep track of the last match index in order to backtrack after an incomplete match
    // Not doing this will cause the search to skip all possible matches that happened in the
    // last match range
    let lastMatchIndex = -1;
    let matches = 0;
    let index = -1;
    for(let x = 0; x <= searchableBufferLastIndex; x++){
        if (searchableBuffer[searchableBufferLastIndex - x] === buffer[bufferLastIndex - matches]) {
            if (lastMatchIndex === -1) {
                lastMatchIndex = x;
            }
            matches++;
        } else {
            matches = 0;
            if (lastMatchIndex !== -1) {
                // Restart the search right after the last index was ignored
                x = lastMatchIndex + 1;
                lastMatchIndex = -1;
            }
            continue;
        }
        if (matches === buffer.length) {
            index = x;
            break;
        }
    }
    if (index === -1) return index;
    return searchableBufferLastIndex - index;
}
// TODO
// Take encoding into account when evaluating index
function indexOfBuffer(targetBuffer, buffer, byteOffset, encoding, forwardDirection) {
    if (!Encodings[encoding] === undefined) {
        throw new Error(`Unknown encoding code ${encoding}`);
    }
    if (!forwardDirection) {
        // If negative the offset is calculated from the end of the buffer
        if (byteOffset < 0) {
            byteOffset = targetBuffer.length + byteOffset;
        }
        if (buffer.length === 0) {
            return byteOffset <= targetBuffer.length ? byteOffset : targetBuffer.length;
        }
        return findLastIndex(targetBuffer, buffer, byteOffset);
    }
    if (buffer.length === 0) {
        return byteOffset <= targetBuffer.length ? byteOffset : targetBuffer.length;
    }
    return indexOfNeedle(targetBuffer, buffer, byteOffset);
}
// TODO(Soremwar)
// Node's implementation is a very obscure algorithm that I haven't been able to crack just yet
function indexOfNumber(targetBuffer, number, byteOffset, forwardDirection) {
    const bytes = numberToBytes(number);
    if (bytes.length > 1) {
        throw new Error("Multi byte number search is not supported");
    }
    return indexOfBuffer(targetBuffer, numberToBytes(number), byteOffset, Encodings.UTF8, forwardDirection);
}
export default {
    indexOfBuffer,
    indexOfNumber
};
export { indexOfBuffer, indexOfNumber };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy9idWZmZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IEVuY29kaW5ncyB9IGZyb20gXCIuL19ub2RlLnRzXCI7XG5pbXBvcnQgeyBpbmRleE9mTmVlZGxlIH0gZnJvbSBcIi4uLy4uL2J5dGVzL2luZGV4X29mX25lZWRsZS50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gbnVtYmVyVG9CeXRlcyhuOiBudW1iZXIpOiBVaW50OEFycmF5IHtcbiAgaWYgKG4gPT09IDApIHJldHVybiBuZXcgVWludDhBcnJheShbMF0pO1xuXG4gIGNvbnN0IGJ5dGVzID0gW107XG4gIGJ5dGVzLnVuc2hpZnQobiAmIDI1NSk7XG4gIHdoaWxlIChuID49IDI1Nikge1xuICAgIG4gPSBuID4+PiA4O1xuICAgIGJ5dGVzLnVuc2hpZnQobiAmIDI1NSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJ5dGVzKTtcbn1cblxuLy8gVE9ETyhTb3JlbXdhcilcbi8vIENoZWNrIGlmIG9mZnNldCBvciBidWZmZXIgY2FuIGJlIHRyYW5zZm9ybSBpbiBvcmRlciB0byBqdXN0IHVzZSBzdGQncyBsYXN0SW5kZXhPZiBkaXJlY3RseVxuLy8gVGhpcyBpbXBsZW1lbnRhdGlvbiBkaWZmZXJzIGZyb20gc3RkJ3MgbGFzdEluZGV4T2YgaW4gdGhlIGZhY3QgdGhhdFxuLy8gaXQgYWxzbyBpbmNsdWRlcyBpdGVtcyBvdXRzaWRlIG9mIHRoZSBvZmZzZXQgYXMgbG9uZyBhcyBwYXJ0IG9mIHRoZVxuLy8gc2V0IGlzIGNvbnRhaW5lZCBpbnNpZGUgb2YgdGhlIG9mZnNldFxuLy8gUHJvYmFibHkgd2F5IHNsb3dlciB0b29cbmZ1bmN0aW9uIGZpbmRMYXN0SW5kZXgoXG4gIHRhcmdldEJ1ZmZlcjogVWludDhBcnJheSxcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBvZmZzZXQ6IG51bWJlcixcbikge1xuICBvZmZzZXQgPSBvZmZzZXQgPiB0YXJnZXRCdWZmZXIubGVuZ3RoID8gdGFyZ2V0QnVmZmVyLmxlbmd0aCA6IG9mZnNldDtcblxuICBjb25zdCBzZWFyY2hhYmxlQnVmZmVyID0gdGFyZ2V0QnVmZmVyLnNsaWNlKDAsIG9mZnNldCArIGJ1ZmZlci5sZW5ndGgpO1xuICBjb25zdCBzZWFyY2hhYmxlQnVmZmVyTGFzdEluZGV4ID0gc2VhcmNoYWJsZUJ1ZmZlci5sZW5ndGggLSAxO1xuICBjb25zdCBidWZmZXJMYXN0SW5kZXggPSBidWZmZXIubGVuZ3RoIC0gMTtcblxuICAvLyBJbXBvcnRhbnQgdG8ga2VlcCB0cmFjayBvZiB0aGUgbGFzdCBtYXRjaCBpbmRleCBpbiBvcmRlciB0byBiYWNrdHJhY2sgYWZ0ZXIgYW4gaW5jb21wbGV0ZSBtYXRjaFxuICAvLyBOb3QgZG9pbmcgdGhpcyB3aWxsIGNhdXNlIHRoZSBzZWFyY2ggdG8gc2tpcCBhbGwgcG9zc2libGUgbWF0Y2hlcyB0aGF0IGhhcHBlbmVkIGluIHRoZVxuICAvLyBsYXN0IG1hdGNoIHJhbmdlXG4gIGxldCBsYXN0TWF0Y2hJbmRleCA9IC0xO1xuICBsZXQgbWF0Y2hlcyA9IDA7XG4gIGxldCBpbmRleCA9IC0xO1xuICBmb3IgKGxldCB4ID0gMDsgeCA8PSBzZWFyY2hhYmxlQnVmZmVyTGFzdEluZGV4OyB4KyspIHtcbiAgICBpZiAoXG4gICAgICBzZWFyY2hhYmxlQnVmZmVyW3NlYXJjaGFibGVCdWZmZXJMYXN0SW5kZXggLSB4XSA9PT1cbiAgICAgICAgYnVmZmVyW2J1ZmZlckxhc3RJbmRleCAtIG1hdGNoZXNdXG4gICAgKSB7XG4gICAgICBpZiAobGFzdE1hdGNoSW5kZXggPT09IC0xKSB7XG4gICAgICAgIGxhc3RNYXRjaEluZGV4ID0geDtcbiAgICAgIH1cbiAgICAgIG1hdGNoZXMrKztcbiAgICB9IGVsc2Uge1xuICAgICAgbWF0Y2hlcyA9IDA7XG4gICAgICBpZiAobGFzdE1hdGNoSW5kZXggIT09IC0xKSB7XG4gICAgICAgIC8vIFJlc3RhcnQgdGhlIHNlYXJjaCByaWdodCBhZnRlciB0aGUgbGFzdCBpbmRleCB3YXMgaWdub3JlZFxuICAgICAgICB4ID0gbGFzdE1hdGNoSW5kZXggKyAxO1xuICAgICAgICBsYXN0TWF0Y2hJbmRleCA9IC0xO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKG1hdGNoZXMgPT09IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGluZGV4ID0geDtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChpbmRleCA9PT0gLTEpIHJldHVybiBpbmRleDtcblxuICByZXR1cm4gc2VhcmNoYWJsZUJ1ZmZlckxhc3RJbmRleCAtIGluZGV4O1xufVxuXG4vLyBUT0RPXG4vLyBUYWtlIGVuY29kaW5nIGludG8gYWNjb3VudCB3aGVuIGV2YWx1YXRpbmcgaW5kZXhcbmZ1bmN0aW9uIGluZGV4T2ZCdWZmZXIoXG4gIHRhcmdldEJ1ZmZlcjogVWludDhBcnJheSxcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBieXRlT2Zmc2V0OiBudW1iZXIsXG4gIGVuY29kaW5nOiBFbmNvZGluZ3MsXG4gIGZvcndhcmREaXJlY3Rpb246IGJvb2xlYW4sXG4pIHtcbiAgaWYgKCFFbmNvZGluZ3NbZW5jb2RpbmddID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZW5jb2RpbmcgY29kZSAke2VuY29kaW5nfWApO1xuICB9XG5cbiAgaWYgKCFmb3J3YXJkRGlyZWN0aW9uKSB7XG4gICAgLy8gSWYgbmVnYXRpdmUgdGhlIG9mZnNldCBpcyBjYWxjdWxhdGVkIGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG5cbiAgICBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICAgIGJ5dGVPZmZzZXQgPSB0YXJnZXRCdWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldDtcbiAgICB9XG5cbiAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGJ5dGVPZmZzZXQgPD0gdGFyZ2V0QnVmZmVyLmxlbmd0aFxuICAgICAgICA/IGJ5dGVPZmZzZXRcbiAgICAgICAgOiB0YXJnZXRCdWZmZXIubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBmaW5kTGFzdEluZGV4KHRhcmdldEJ1ZmZlciwgYnVmZmVyLCBieXRlT2Zmc2V0KTtcbiAgfVxuXG4gIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGJ5dGVPZmZzZXQgPD0gdGFyZ2V0QnVmZmVyLmxlbmd0aCA/IGJ5dGVPZmZzZXQgOiB0YXJnZXRCdWZmZXIubGVuZ3RoO1xuICB9XG5cbiAgcmV0dXJuIGluZGV4T2ZOZWVkbGUodGFyZ2V0QnVmZmVyLCBidWZmZXIsIGJ5dGVPZmZzZXQpO1xufVxuXG4vLyBUT0RPKFNvcmVtd2FyKVxuLy8gTm9kZSdzIGltcGxlbWVudGF0aW9uIGlzIGEgdmVyeSBvYnNjdXJlIGFsZ29yaXRobSB0aGF0IEkgaGF2ZW4ndCBiZWVuIGFibGUgdG8gY3JhY2sganVzdCB5ZXRcbmZ1bmN0aW9uIGluZGV4T2ZOdW1iZXIoXG4gIHRhcmdldEJ1ZmZlcjogVWludDhBcnJheSxcbiAgbnVtYmVyOiBudW1iZXIsXG4gIGJ5dGVPZmZzZXQ6IG51bWJlcixcbiAgZm9yd2FyZERpcmVjdGlvbjogYm9vbGVhbixcbikge1xuICBjb25zdCBieXRlcyA9IG51bWJlclRvQnl0ZXMobnVtYmVyKTtcblxuICBpZiAoYnl0ZXMubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk11bHRpIGJ5dGUgbnVtYmVyIHNlYXJjaCBpcyBub3Qgc3VwcG9ydGVkXCIpO1xuICB9XG5cbiAgcmV0dXJuIGluZGV4T2ZCdWZmZXIoXG4gICAgdGFyZ2V0QnVmZmVyLFxuICAgIG51bWJlclRvQnl0ZXMobnVtYmVyKSxcbiAgICBieXRlT2Zmc2V0LFxuICAgIEVuY29kaW5ncy5VVEY4LFxuICAgIGZvcndhcmREaXJlY3Rpb24sXG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgaW5kZXhPZkJ1ZmZlciwgaW5kZXhPZk51bWJlciB9O1xuZXhwb3J0IHsgaW5kZXhPZkJ1ZmZlciwgaW5kZXhPZk51bWJlciB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLFNBQVMsUUFBUSxhQUFhO0FBQ3ZDLFNBQVMsYUFBYSxRQUFRLGlDQUFpQztBQUUvRCxPQUFPLFNBQVMsY0FBYyxDQUFTLEVBQWM7SUFDbkQsSUFBSSxNQUFNLEdBQUcsT0FBTyxJQUFJLFdBQVc7UUFBQztLQUFFO0lBRXRDLE1BQU0sUUFBUSxFQUFFO0lBQ2hCLE1BQU0sT0FBTyxDQUFDLElBQUk7SUFDbEIsTUFBTyxLQUFLLElBQUs7UUFDZixJQUFJLE1BQU07UUFDVixNQUFNLE9BQU8sQ0FBQyxJQUFJO0lBQ3BCO0lBQ0EsT0FBTyxJQUFJLFdBQVc7QUFDeEIsQ0FBQztBQUVELGlCQUFpQjtBQUNqQiw2RkFBNkY7QUFDN0Ysc0VBQXNFO0FBQ3RFLHNFQUFzRTtBQUN0RSx3Q0FBd0M7QUFDeEMsMEJBQTBCO0FBQzFCLFNBQVMsY0FDUCxZQUF3QixFQUN4QixNQUFrQixFQUNsQixNQUFjLEVBQ2Q7SUFDQSxTQUFTLFNBQVMsYUFBYSxNQUFNLEdBQUcsYUFBYSxNQUFNLEdBQUcsTUFBTTtJQUVwRSxNQUFNLG1CQUFtQixhQUFhLEtBQUssQ0FBQyxHQUFHLFNBQVMsT0FBTyxNQUFNO0lBQ3JFLE1BQU0sNEJBQTRCLGlCQUFpQixNQUFNLEdBQUc7SUFDNUQsTUFBTSxrQkFBa0IsT0FBTyxNQUFNLEdBQUc7SUFFeEMsa0dBQWtHO0lBQ2xHLHlGQUF5RjtJQUN6RixtQkFBbUI7SUFDbkIsSUFBSSxpQkFBaUIsQ0FBQztJQUN0QixJQUFJLFVBQVU7SUFDZCxJQUFJLFFBQVEsQ0FBQztJQUNiLElBQUssSUFBSSxJQUFJLEdBQUcsS0FBSywyQkFBMkIsSUFBSztRQUNuRCxJQUNFLGdCQUFnQixDQUFDLDRCQUE0QixFQUFFLEtBQzdDLE1BQU0sQ0FBQyxrQkFBa0IsUUFBUSxFQUNuQztZQUNBLElBQUksbUJBQW1CLENBQUMsR0FBRztnQkFDekIsaUJBQWlCO1lBQ25CLENBQUM7WUFDRDtRQUNGLE9BQU87WUFDTCxVQUFVO1lBQ1YsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHO2dCQUN6Qiw0REFBNEQ7Z0JBQzVELElBQUksaUJBQWlCO2dCQUNyQixpQkFBaUIsQ0FBQztZQUNwQixDQUFDO1lBQ0QsUUFBUztRQUNYLENBQUM7UUFFRCxJQUFJLFlBQVksT0FBTyxNQUFNLEVBQUU7WUFDN0IsUUFBUTtZQUNSLEtBQU07UUFDUixDQUFDO0lBQ0g7SUFFQSxJQUFJLFVBQVUsQ0FBQyxHQUFHLE9BQU87SUFFekIsT0FBTyw0QkFBNEI7QUFDckM7QUFFQSxPQUFPO0FBQ1AsbURBQW1EO0FBQ25ELFNBQVMsY0FDUCxZQUF3QixFQUN4QixNQUFrQixFQUNsQixVQUFrQixFQUNsQixRQUFtQixFQUNuQixnQkFBeUIsRUFDekI7SUFDQSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxXQUFXO1FBQ3RDLE1BQU0sSUFBSSxNQUFNLENBQUMsc0JBQXNCLEVBQUUsU0FBUyxDQUFDLEVBQUU7SUFDdkQsQ0FBQztJQUVELElBQUksQ0FBQyxrQkFBa0I7UUFDckIsa0VBQWtFO1FBRWxFLElBQUksYUFBYSxHQUFHO1lBQ2xCLGFBQWEsYUFBYSxNQUFNLEdBQUc7UUFDckMsQ0FBQztRQUVELElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztZQUN2QixPQUFPLGNBQWMsYUFBYSxNQUFNLEdBQ3BDLGFBQ0EsYUFBYSxNQUFNO1FBQ3pCLENBQUM7UUFFRCxPQUFPLGNBQWMsY0FBYyxRQUFRO0lBQzdDLENBQUM7SUFFRCxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7UUFDdkIsT0FBTyxjQUFjLGFBQWEsTUFBTSxHQUFHLGFBQWEsYUFBYSxNQUFNO0lBQzdFLENBQUM7SUFFRCxPQUFPLGNBQWMsY0FBYyxRQUFRO0FBQzdDO0FBRUEsaUJBQWlCO0FBQ2pCLCtGQUErRjtBQUMvRixTQUFTLGNBQ1AsWUFBd0IsRUFDeEIsTUFBYyxFQUNkLFVBQWtCLEVBQ2xCLGdCQUF5QixFQUN6QjtJQUNBLE1BQU0sUUFBUSxjQUFjO0lBRTVCLElBQUksTUFBTSxNQUFNLEdBQUcsR0FBRztRQUNwQixNQUFNLElBQUksTUFBTSw2Q0FBNkM7SUFDL0QsQ0FBQztJQUVELE9BQU8sY0FDTCxjQUNBLGNBQWMsU0FDZCxZQUNBLFVBQVUsSUFBSSxFQUNkO0FBRUo7QUFFQSxlQUFlO0lBQUU7SUFBZTtBQUFjLEVBQUU7QUFDaEQsU0FBUyxhQUFhLEVBQUUsYUFBYSxHQUFHIn0=