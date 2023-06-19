// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { getValidatedFd } from "../internal/fs/utils.mjs";
export function close(fd, callback) {
    fd = getValidatedFd(fd);
    setTimeout(()=>{
        let error = null;
        try {
            Deno.close(fd);
        } catch (err) {
            error = err instanceof Error ? err : new Error("[non-error thrown]");
        }
        callback(error);
    }, 0);
}
export function closeSync(fd) {
    fd = getValidatedFd(fd);
    Deno.close(fd);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19jbG9zZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHR5cGUgeyBDYWxsYmFja1dpdGhFcnJvciB9IGZyb20gXCIuL19mc19jb21tb24udHNcIjtcbmltcG9ydCB7IGdldFZhbGlkYXRlZEZkIH0gZnJvbSBcIi4uL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2UoZmQ6IG51bWJlciwgY2FsbGJhY2s6IENhbGxiYWNrV2l0aEVycm9yKSB7XG4gIGZkID0gZ2V0VmFsaWRhdGVkRmQoZmQpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBsZXQgZXJyb3IgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICBEZW5vLmNsb3NlKGZkKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGVycm9yID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIgOiBuZXcgRXJyb3IoXCJbbm9uLWVycm9yIHRocm93bl1cIik7XG4gICAgfVxuICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgfSwgMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZVN5bmMoZmQ6IG51bWJlcikge1xuICBmZCA9IGdldFZhbGlkYXRlZEZkKGZkKTtcbiAgRGVuby5jbG9zZShmZCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFLFNBQVMsY0FBYyxRQUFRLDJCQUEyQjtBQUUxRCxPQUFPLFNBQVMsTUFBTSxFQUFVLEVBQUUsUUFBMkIsRUFBRTtJQUM3RCxLQUFLLGVBQWU7SUFDcEIsV0FBVyxJQUFNO1FBQ2YsSUFBSSxRQUFRLElBQUk7UUFDaEIsSUFBSTtZQUNGLEtBQUssS0FBSyxDQUFDO1FBQ2IsRUFBRSxPQUFPLEtBQUs7WUFDWixRQUFRLGVBQWUsUUFBUSxNQUFNLElBQUksTUFBTSxxQkFBcUI7UUFDdEU7UUFDQSxTQUFTO0lBQ1gsR0FBRztBQUNMLENBQUM7QUFFRCxPQUFPLFNBQVMsVUFBVSxFQUFVLEVBQUU7SUFDcEMsS0FBSyxlQUFlO0lBQ3BCLEtBQUssS0FBSyxDQUFDO0FBQ2IsQ0FBQyJ9