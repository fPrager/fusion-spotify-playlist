// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
export default function randomInt(max, min, cb) {
    if (typeof max === "number" && typeof min === "number") {
        [max, min] = [
            min,
            max
        ];
    }
    if (min === undefined) min = 0;
    else if (typeof min === "function") {
        cb = min;
        min = 0;
    }
    if (!Number.isSafeInteger(min) || typeof max === "number" && !Number.isSafeInteger(max)) {
        throw new Error("max or min is not a Safe Number");
    }
    if (max - min > Math.pow(2, 48)) {
        throw new RangeError("max - min should be less than 2^48!");
    }
    if (min >= max) {
        throw new Error("Min is bigger than Max!");
    }
    const randomBuffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomBuffer);
    const randomNumber = randomBuffer[0] / (0xffffffff + 1);
    min = Math.ceil(min);
    max = Math.floor(max);
    const result = Math.floor(randomNumber * (max - min)) + min;
    if (cb) {
        cb(null, result);
        return;
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL19yYW5kb21JbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhbmRvbUludChtYXg6IG51bWJlcik6IG51bWJlcjtcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhbmRvbUludChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXI7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5kb21JbnQoXG4gIG1heDogbnVtYmVyLFxuICBjYjogKGVycjogRXJyb3IgfCBudWxsLCBuPzogbnVtYmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhbmRvbUludChcbiAgbWluOiBudW1iZXIsXG4gIG1heDogbnVtYmVyLFxuICBjYjogKGVycjogRXJyb3IgfCBudWxsLCBuPzogbnVtYmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmFuZG9tSW50KFxuICBtYXg6IG51bWJlcixcbiAgbWluPzogKChlcnI6IEVycm9yIHwgbnVsbCwgbj86IG51bWJlcikgPT4gdm9pZCkgfCBudW1iZXIsXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCBuPzogbnVtYmVyKSA9PiB2b2lkLFxuKTogbnVtYmVyIHwgdm9pZCB7XG4gIGlmICh0eXBlb2YgbWF4ID09PSBcIm51bWJlclwiICYmIHR5cGVvZiBtaW4gPT09IFwibnVtYmVyXCIpIHtcbiAgICBbbWF4LCBtaW5dID0gW21pbiwgbWF4XTtcbiAgfVxuICBpZiAobWluID09PSB1bmRlZmluZWQpIG1pbiA9IDA7XG4gIGVsc2UgaWYgKHR5cGVvZiBtaW4gPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNiID0gbWluO1xuICAgIG1pbiA9IDA7XG4gIH1cblxuICBpZiAoXG4gICAgIU51bWJlci5pc1NhZmVJbnRlZ2VyKG1pbikgfHxcbiAgICB0eXBlb2YgbWF4ID09PSBcIm51bWJlclwiICYmICFOdW1iZXIuaXNTYWZlSW50ZWdlcihtYXgpXG4gICkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm1heCBvciBtaW4gaXMgbm90IGEgU2FmZSBOdW1iZXJcIik7XG4gIH1cblxuICBpZiAobWF4IC0gbWluID4gTWF0aC5wb3coMiwgNDgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJtYXggLSBtaW4gc2hvdWxkIGJlIGxlc3MgdGhhbiAyXjQ4IVwiKTtcbiAgfVxuXG4gIGlmIChtaW4gPj0gbWF4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTWluIGlzIGJpZ2dlciB0aGFuIE1heCFcIik7XG4gIH1cblxuICBjb25zdCByYW5kb21CdWZmZXIgPSBuZXcgVWludDMyQXJyYXkoMSk7XG5cbiAgZ2xvYmFsVGhpcy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHJhbmRvbUJ1ZmZlcik7XG5cbiAgY29uc3QgcmFuZG9tTnVtYmVyID0gcmFuZG9tQnVmZmVyWzBdIC8gKDB4ZmZmZmZmZmYgKyAxKTtcblxuICBtaW4gPSBNYXRoLmNlaWwobWluKTtcbiAgbWF4ID0gTWF0aC5mbG9vcihtYXgpO1xuXG4gIGNvbnN0IHJlc3VsdCA9IE1hdGguZmxvb3IocmFuZG9tTnVtYmVyICogKG1heCAtIG1pbikpICsgbWluO1xuXG4gIGlmIChjYikge1xuICAgIGNiKG51bGwsIHJlc3VsdCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFhMUUsZUFBZSxTQUFTLFVBQ3RCLEdBQVcsRUFDWCxHQUF3RCxFQUN4RCxFQUE0QyxFQUM3QjtJQUNmLElBQUksT0FBTyxRQUFRLFlBQVksT0FBTyxRQUFRLFVBQVU7UUFDdEQsQ0FBQyxLQUFLLElBQUksR0FBRztZQUFDO1lBQUs7U0FBSTtJQUN6QixDQUFDO0lBQ0QsSUFBSSxRQUFRLFdBQVcsTUFBTTtTQUN4QixJQUFJLE9BQU8sUUFBUSxZQUFZO1FBQ2xDLEtBQUs7UUFDTCxNQUFNO0lBQ1IsQ0FBQztJQUVELElBQ0UsQ0FBQyxPQUFPLGFBQWEsQ0FBQyxRQUN0QixPQUFPLFFBQVEsWUFBWSxDQUFDLE9BQU8sYUFBYSxDQUFDLE1BQ2pEO1FBQ0EsTUFBTSxJQUFJLE1BQU0sbUNBQW1DO0lBQ3JELENBQUM7SUFFRCxJQUFJLE1BQU0sTUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLEtBQUs7UUFDL0IsTUFBTSxJQUFJLFdBQVcsdUNBQXVDO0lBQzlELENBQUM7SUFFRCxJQUFJLE9BQU8sS0FBSztRQUNkLE1BQU0sSUFBSSxNQUFNLDJCQUEyQjtJQUM3QyxDQUFDO0lBRUQsTUFBTSxlQUFlLElBQUksWUFBWTtJQUVyQyxXQUFXLE1BQU0sQ0FBQyxlQUFlLENBQUM7SUFFbEMsTUFBTSxlQUFlLFlBQVksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUM7SUFFdEQsTUFBTSxLQUFLLElBQUksQ0FBQztJQUNoQixNQUFNLEtBQUssS0FBSyxDQUFDO0lBRWpCLE1BQU0sU0FBUyxLQUFLLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFFeEQsSUFBSSxJQUFJO1FBQ04sR0FBRyxJQUFJLEVBQUU7UUFDVDtJQUNGLENBQUM7SUFFRCxPQUFPO0FBQ1QsQ0FBQyJ9