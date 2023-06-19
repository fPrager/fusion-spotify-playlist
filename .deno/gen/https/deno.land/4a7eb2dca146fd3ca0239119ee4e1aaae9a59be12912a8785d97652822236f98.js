// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { getBinding } from "../../internal_binding/mod.ts";
export function internalBinding(name) {
    return getBinding(name);
}
// TODO(kt3k): export actual primordials
export const primordials = {};
export default {
    internalBinding,
    primordials
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvdGVzdC9iaW5kaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBOb2RlLmpzIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBnZXRCaW5kaW5nIH0gZnJvbSBcIi4uLy4uL2ludGVybmFsX2JpbmRpbmcvbW9kLnRzXCI7XG5pbXBvcnQgdHlwZSB7IEJpbmRpbmdOYW1lIH0gZnJvbSBcIi4uLy4uL2ludGVybmFsX2JpbmRpbmcvbW9kLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcm5hbEJpbmRpbmcobmFtZTogQmluZGluZ05hbWUpIHtcbiAgcmV0dXJuIGdldEJpbmRpbmcobmFtZSk7XG59XG5cbi8vIFRPRE8oa3Qzayk6IGV4cG9ydCBhY3R1YWwgcHJpbW9yZGlhbHNcbmV4cG9ydCBjb25zdCBwcmltb3JkaWFscyA9IHt9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGludGVybmFsQmluZGluZyxcbiAgcHJpbW9yZGlhbHMsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxRkFBcUY7QUFDckYsU0FBUyxVQUFVLFFBQVEsZ0NBQWdDO0FBRzNELE9BQU8sU0FBUyxnQkFBZ0IsSUFBaUIsRUFBRTtJQUNqRCxPQUFPLFdBQVc7QUFDcEIsQ0FBQztBQUVELHdDQUF3QztBQUN4QyxPQUFPLE1BQU0sY0FBYyxDQUFDLEVBQUU7QUFFOUIsZUFBZTtJQUNiO0lBQ0E7QUFDRixFQUFFIn0=