// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Socket } from "./net.ts";
// Returns true when the given numeric fd is associated with a TTY and false otherwise.
function isatty(fd) {
    if (typeof fd !== "number") {
        return false;
    }
    try {
        return Deno.isatty(fd);
    } catch (_) {
        return false;
    }
}
// TODO(kt3k): Implement tty.ReadStream class
export class ReadStream extends Socket {
}
// TODO(kt3k): Implement tty.WriteStream class
export class WriteStream extends Socket {
}
export { isatty };
export default {
    isatty,
    WriteStream,
    ReadStream
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvdHR5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7IFNvY2tldCB9IGZyb20gXCIuL25ldC50c1wiO1xuXG4vLyBSZXR1cm5zIHRydWUgd2hlbiB0aGUgZ2l2ZW4gbnVtZXJpYyBmZCBpcyBhc3NvY2lhdGVkIHdpdGggYSBUVFkgYW5kIGZhbHNlIG90aGVyd2lzZS5cbmZ1bmN0aW9uIGlzYXR0eShmZDogbnVtYmVyKSB7XG4gIGlmICh0eXBlb2YgZmQgIT09IFwibnVtYmVyXCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdHJ5IHtcbiAgICByZXR1cm4gRGVuby5pc2F0dHkoZmQpO1xuICB9IGNhdGNoIChfKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vIFRPRE8oa3Qzayk6IEltcGxlbWVudCB0dHkuUmVhZFN0cmVhbSBjbGFzc1xuZXhwb3J0IGNsYXNzIFJlYWRTdHJlYW0gZXh0ZW5kcyBTb2NrZXQge1xufVxuLy8gVE9ETyhrdDNrKTogSW1wbGVtZW50IHR0eS5Xcml0ZVN0cmVhbSBjbGFzc1xuZXhwb3J0IGNsYXNzIFdyaXRlU3RyZWFtIGV4dGVuZHMgU29ja2V0IHtcbn1cblxuZXhwb3J0IHsgaXNhdHR5IH07XG5leHBvcnQgZGVmYXVsdCB7IGlzYXR0eSwgV3JpdGVTdHJlYW0sIFJlYWRTdHJlYW0gfTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUsU0FBUyxNQUFNLFFBQVEsV0FBVztBQUVsQyx1RkFBdUY7QUFDdkYsU0FBUyxPQUFPLEVBQVUsRUFBRTtJQUMxQixJQUFJLE9BQU8sT0FBTyxVQUFVO1FBQzFCLE9BQU8sS0FBSztJQUNkLENBQUM7SUFDRCxJQUFJO1FBQ0YsT0FBTyxLQUFLLE1BQU0sQ0FBQztJQUNyQixFQUFFLE9BQU8sR0FBRztRQUNWLE9BQU8sS0FBSztJQUNkO0FBQ0Y7QUFFQSw2Q0FBNkM7QUFDN0MsT0FBTyxNQUFNLG1CQUFtQjtBQUNoQyxDQUFDO0FBQ0QsOENBQThDO0FBQzlDLE9BQU8sTUFBTSxvQkFBb0I7QUFDakMsQ0FBQztBQUVELFNBQVMsTUFBTSxHQUFHO0FBQ2xCLGVBQWU7SUFBRTtJQUFRO0lBQWE7QUFBVyxFQUFFIn0=