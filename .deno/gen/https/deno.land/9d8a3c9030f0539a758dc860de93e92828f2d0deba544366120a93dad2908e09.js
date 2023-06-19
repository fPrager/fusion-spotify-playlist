// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
export const MAX_RANDOM_VALUES = 65536;
export const MAX_SIZE = 4294967295;
function generateRandomBytes(size) {
    if (size > MAX_SIZE) {
        throw new RangeError(`The value of "size" is out of range. It must be >= 0 && <= ${MAX_SIZE}. Received ${size}`);
    }
    const bytes = Buffer.allocUnsafe(size);
    //Work around for getRandomValues max generation
    if (size > MAX_RANDOM_VALUES) {
        for(let generated = 0; generated < size; generated += MAX_RANDOM_VALUES){
            globalThis.crypto.getRandomValues(bytes.slice(generated, generated + MAX_RANDOM_VALUES));
        }
    } else {
        globalThis.crypto.getRandomValues(bytes);
    }
    return bytes;
}
export default function randomBytes(size, cb) {
    if (typeof cb === "function") {
        let err = null, bytes;
        try {
            bytes = generateRandomBytes(size);
        } catch (e) {
            //NodeJS nonsense
            //If the size is out of range it will throw sync, otherwise throw async
            if (e instanceof RangeError && e.message.includes('The value of "size" is out of range')) {
                throw e;
            } else if (e instanceof Error) {
                err = e;
            } else {
                err = new Error("[non-error thrown]");
            }
        }
        setTimeout(()=>{
            if (err) {
                cb(err);
            } else {
                cb(null, bytes);
            }
        }, 0);
    } else {
        return generateRandomBytes(size);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL19yYW5kb21CeXRlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuXG5leHBvcnQgY29uc3QgTUFYX1JBTkRPTV9WQUxVRVMgPSA2NTUzNjtcbmV4cG9ydCBjb25zdCBNQVhfU0laRSA9IDQyOTQ5NjcyOTU7XG5cbmZ1bmN0aW9uIGdlbmVyYXRlUmFuZG9tQnl0ZXMoc2l6ZTogbnVtYmVyKSB7XG4gIGlmIChzaXplID4gTUFYX1NJWkUpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgIGBUaGUgdmFsdWUgb2YgXCJzaXplXCIgaXMgb3V0IG9mIHJhbmdlLiBJdCBtdXN0IGJlID49IDAgJiYgPD0gJHtNQVhfU0laRX0uIFJlY2VpdmVkICR7c2l6ZX1gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBieXRlcyA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShzaXplKTtcblxuICAvL1dvcmsgYXJvdW5kIGZvciBnZXRSYW5kb21WYWx1ZXMgbWF4IGdlbmVyYXRpb25cbiAgaWYgKHNpemUgPiBNQVhfUkFORE9NX1ZBTFVFUykge1xuICAgIGZvciAobGV0IGdlbmVyYXRlZCA9IDA7IGdlbmVyYXRlZCA8IHNpemU7IGdlbmVyYXRlZCArPSBNQVhfUkFORE9NX1ZBTFVFUykge1xuICAgICAgZ2xvYmFsVGhpcy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKFxuICAgICAgICBieXRlcy5zbGljZShnZW5lcmF0ZWQsIGdlbmVyYXRlZCArIE1BWF9SQU5ET01fVkFMVUVTKSxcbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGdsb2JhbFRoaXMuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhieXRlcyk7XG4gIH1cblxuICByZXR1cm4gYnl0ZXM7XG59XG5cbi8qKlxuICogQHBhcmFtIHNpemUgQnVmZmVyIGxlbmd0aCwgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gemVyb1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5kb21CeXRlcyhzaXplOiBudW1iZXIpOiBCdWZmZXI7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5kb21CeXRlcyhcbiAgc2l6ZTogbnVtYmVyLFxuICBjYj86IChlcnI6IEVycm9yIHwgbnVsbCwgYnVmPzogQnVmZmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhbmRvbUJ5dGVzKFxuICBzaXplOiBudW1iZXIsXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCBidWY/OiBCdWZmZXIpID0+IHZvaWQsXG4pOiBCdWZmZXIgfCB2b2lkIHtcbiAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgbGV0IGVycjogRXJyb3IgfCBudWxsID0gbnVsbCwgYnl0ZXM6IEJ1ZmZlcjtcbiAgICB0cnkge1xuICAgICAgYnl0ZXMgPSBnZW5lcmF0ZVJhbmRvbUJ5dGVzKHNpemUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vTm9kZUpTIG5vbnNlbnNlXG4gICAgICAvL0lmIHRoZSBzaXplIGlzIG91dCBvZiByYW5nZSBpdCB3aWxsIHRocm93IHN5bmMsIG90aGVyd2lzZSB0aHJvdyBhc3luY1xuICAgICAgaWYgKFxuICAgICAgICBlIGluc3RhbmNlb2YgUmFuZ2VFcnJvciAmJlxuICAgICAgICBlLm1lc3NhZ2UuaW5jbHVkZXMoJ1RoZSB2YWx1ZSBvZiBcInNpemVcIiBpcyBvdXQgb2YgcmFuZ2UnKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9IGVsc2UgaWYgKGUgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBlcnIgPSBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXJyID0gbmV3IEVycm9yKFwiW25vbi1lcnJvciB0aHJvd25dXCIpO1xuICAgICAgfVxuICAgIH1cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiKG51bGwsIGJ5dGVzKTtcbiAgICAgIH1cbiAgICB9LCAwKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVSYW5kb21CeXRlcyhzaXplKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLE1BQU0sUUFBUSxrQkFBa0I7QUFFekMsT0FBTyxNQUFNLG9CQUFvQixNQUFNO0FBQ3ZDLE9BQU8sTUFBTSxXQUFXLFdBQVc7QUFFbkMsU0FBUyxvQkFBb0IsSUFBWSxFQUFFO0lBQ3pDLElBQUksT0FBTyxVQUFVO1FBQ25CLE1BQU0sSUFBSSxXQUNSLENBQUMsMkRBQTJELEVBQUUsU0FBUyxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQzFGO0lBQ0osQ0FBQztJQUVELE1BQU0sUUFBUSxPQUFPLFdBQVcsQ0FBQztJQUVqQyxnREFBZ0Q7SUFDaEQsSUFBSSxPQUFPLG1CQUFtQjtRQUM1QixJQUFLLElBQUksWUFBWSxHQUFHLFlBQVksTUFBTSxhQUFhLGtCQUFtQjtZQUN4RSxXQUFXLE1BQU0sQ0FBQyxlQUFlLENBQy9CLE1BQU0sS0FBSyxDQUFDLFdBQVcsWUFBWTtRQUV2QztJQUNGLE9BQU87UUFDTCxXQUFXLE1BQU0sQ0FBQyxlQUFlLENBQUM7SUFDcEMsQ0FBQztJQUVELE9BQU87QUFDVDtBQVVBLGVBQWUsU0FBUyxZQUN0QixJQUFZLEVBQ1osRUFBOEMsRUFDL0I7SUFDZixJQUFJLE9BQU8sT0FBTyxZQUFZO1FBQzVCLElBQUksTUFBb0IsSUFBSSxFQUFFO1FBQzlCLElBQUk7WUFDRixRQUFRLG9CQUFvQjtRQUM5QixFQUFFLE9BQU8sR0FBRztZQUNWLGlCQUFpQjtZQUNqQix1RUFBdUU7WUFDdkUsSUFDRSxhQUFhLGNBQ2IsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLHdDQUNuQjtnQkFDQSxNQUFNLEVBQUU7WUFDVixPQUFPLElBQUksYUFBYSxPQUFPO2dCQUM3QixNQUFNO1lBQ1IsT0FBTztnQkFDTCxNQUFNLElBQUksTUFBTTtZQUNsQixDQUFDO1FBQ0g7UUFDQSxXQUFXLElBQU07WUFDZixJQUFJLEtBQUs7Z0JBQ1AsR0FBRztZQUNMLE9BQU87Z0JBQ0wsR0FBRyxJQUFJLEVBQUU7WUFDWCxDQUFDO1FBQ0gsR0FBRztJQUNMLE9BQU87UUFDTCxPQUFPLG9CQUFvQjtJQUM3QixDQUFDO0FBQ0gsQ0FBQyJ9