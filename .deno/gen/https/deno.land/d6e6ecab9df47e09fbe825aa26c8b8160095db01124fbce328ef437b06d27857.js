// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2017 crypto-browserify. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
import { nextTick } from "../../_next_tick.ts";
// limit of Crypto.getRandomValues()
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
const MAX_BYTES = 65536;
// Node supports requesting up to this number of bytes
// https://github.com/nodejs/node/blob/master/lib/internal/crypto/random.js#L48
const MAX_UINT32 = 4294967295;
export function randomBytes(size, cb) {
    // phantomjs needs to throw
    if (size > MAX_UINT32) {
        throw new RangeError("requested too many random bytes");
    }
    const bytes = Buffer.allocUnsafe(size);
    if (size > 0) {
        if (size > MAX_BYTES) {
            // can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
            for(let generated = 0; generated < size; generated += MAX_BYTES){
                // buffer.slice automatically checks if the end is past the end of
                // the buffer so we don't have to here
                globalThis.crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
            }
        } else {
            globalThis.crypto.getRandomValues(bytes);
        }
    }
    if (typeof cb === "function") {
        return nextTick(function() {
            cb(null, bytes);
        });
    }
    return bytes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2NyeXB0by9jcnlwdG9fYnJvd3NlcmlmeS9yYW5kb21ieXRlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IDIwMTcgY3J5cHRvLWJyb3dzZXJpZnkuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi4vLi4vX25leHRfdGljay50c1wiO1xuXG4vLyBsaW1pdCBvZiBDcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKClcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DcnlwdG8vZ2V0UmFuZG9tVmFsdWVzXG5jb25zdCBNQVhfQllURVMgPSA2NTUzNjtcblxuLy8gTm9kZSBzdXBwb3J0cyByZXF1ZXN0aW5nIHVwIHRvIHRoaXMgbnVtYmVyIG9mIGJ5dGVzXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvbGliL2ludGVybmFsL2NyeXB0by9yYW5kb20uanMjTDQ4XG5jb25zdCBNQVhfVUlOVDMyID0gNDI5NDk2NzI5NTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbUJ5dGVzKFxuICBzaXplOiBudW1iZXIsXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCBiOiBCdWZmZXIpID0+IHZvaWQsXG4pIHtcbiAgLy8gcGhhbnRvbWpzIG5lZWRzIHRvIHRocm93XG4gIGlmIChzaXplID4gTUFYX1VJTlQzMikge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwicmVxdWVzdGVkIHRvbyBtYW55IHJhbmRvbSBieXRlc1wiKTtcbiAgfVxuXG4gIGNvbnN0IGJ5dGVzID0gQnVmZmVyLmFsbG9jVW5zYWZlKHNpemUpO1xuXG4gIGlmIChzaXplID4gMCkgeyAvLyBnZXRSYW5kb21WYWx1ZXMgZmFpbHMgb24gSUUgaWYgc2l6ZSA9PSAwXG4gICAgaWYgKHNpemUgPiBNQVhfQllURVMpIHsgLy8gdGhpcyBpcyB0aGUgbWF4IGJ5dGVzIGNyeXB0by5nZXRSYW5kb21WYWx1ZXNcbiAgICAgIC8vIGNhbiBkbyBhdCBvbmNlIHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXNcbiAgICAgIGZvciAobGV0IGdlbmVyYXRlZCA9IDA7IGdlbmVyYXRlZCA8IHNpemU7IGdlbmVyYXRlZCArPSBNQVhfQllURVMpIHtcbiAgICAgICAgLy8gYnVmZmVyLnNsaWNlIGF1dG9tYXRpY2FsbHkgY2hlY2tzIGlmIHRoZSBlbmQgaXMgcGFzdCB0aGUgZW5kIG9mXG4gICAgICAgIC8vIHRoZSBidWZmZXIgc28gd2UgZG9uJ3QgaGF2ZSB0byBoZXJlXG4gICAgICAgIGdsb2JhbFRoaXMuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhcbiAgICAgICAgICBieXRlcy5zbGljZShnZW5lcmF0ZWQsIGdlbmVyYXRlZCArIE1BWF9CWVRFUyksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGdsb2JhbFRoaXMuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhieXRlcyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNiKG51bGwsIGJ5dGVzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBieXRlcztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0VBQXNFO0FBQ3RFLFNBQVMsTUFBTSxRQUFRLGtCQUFrQjtBQUN6QyxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0Msb0NBQW9DO0FBQ3BDLDBFQUEwRTtBQUMxRSxNQUFNLFlBQVk7QUFFbEIsc0RBQXNEO0FBQ3RELCtFQUErRTtBQUMvRSxNQUFNLGFBQWE7QUFFbkIsT0FBTyxTQUFTLFlBQ2QsSUFBWSxFQUNaLEVBQTJDLEVBQzNDO0lBQ0EsMkJBQTJCO0lBQzNCLElBQUksT0FBTyxZQUFZO1FBQ3JCLE1BQU0sSUFBSSxXQUFXLG1DQUFtQztJQUMxRCxDQUFDO0lBRUQsTUFBTSxRQUFRLE9BQU8sV0FBVyxDQUFDO0lBRWpDLElBQUksT0FBTyxHQUFHO1FBQ1osSUFBSSxPQUFPLFdBQVc7WUFDcEIsb0dBQW9HO1lBQ3BHLElBQUssSUFBSSxZQUFZLEdBQUcsWUFBWSxNQUFNLGFBQWEsVUFBVztnQkFDaEUsa0VBQWtFO2dCQUNsRSxzQ0FBc0M7Z0JBQ3RDLFdBQVcsTUFBTSxDQUFDLGVBQWUsQ0FDL0IsTUFBTSxLQUFLLENBQUMsV0FBVyxZQUFZO1lBRXZDO1FBQ0YsT0FBTztZQUNMLFdBQVcsTUFBTSxDQUFDLGVBQWUsQ0FBQztRQUNwQyxDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksT0FBTyxPQUFPLFlBQVk7UUFDNUIsT0FBTyxTQUFTLFdBQVk7WUFDMUIsR0FBRyxJQUFJLEVBQUU7UUFDWDtJQUNGLENBQUM7SUFFRCxPQUFPO0FBQ1QsQ0FBQyJ9