// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { promisify } from "../util.ts";
import timers from "../timers.ts";
export const setTimeout = promisify(timers.setTimeout), setImmediate = promisify(timers.setImmediate), setInterval = promisify(timers.setInterval);
export default {
    setTimeout,
    setImmediate,
    setInterval
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvdGltZXJzL3Byb21pc2VzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vdXRpbC50c1wiO1xuaW1wb3J0IHRpbWVycyBmcm9tIFwiLi4vdGltZXJzLnRzXCI7XG5cbmV4cG9ydCBjb25zdCBzZXRUaW1lb3V0ID0gcHJvbWlzaWZ5KHRpbWVycy5zZXRUaW1lb3V0KSxcbiAgc2V0SW1tZWRpYXRlID0gcHJvbWlzaWZ5KHRpbWVycy5zZXRJbW1lZGlhdGUpLFxuICBzZXRJbnRlcnZhbCA9IHByb21pc2lmeSh0aW1lcnMuc2V0SW50ZXJ2YWwpO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHNldFRpbWVvdXQsXG4gIHNldEltbWVkaWF0ZSxcbiAgc2V0SW50ZXJ2YWwsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLFNBQVMsUUFBUSxhQUFhO0FBQ3ZDLE9BQU8sWUFBWSxlQUFlO0FBRWxDLE9BQU8sTUFBTSxhQUFhLFVBQVUsT0FBTyxVQUFVLEdBQ25ELGVBQWUsVUFBVSxPQUFPLFlBQVksR0FDNUMsY0FBYyxVQUFVLE9BQU8sV0FBVyxFQUFFO0FBRTlDLGVBQWU7SUFDYjtJQUNBO0lBQ0E7QUFDRixFQUFFIn0=