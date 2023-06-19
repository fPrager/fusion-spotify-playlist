// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
export class Http2Session {
    constructor(){
        notImplemented("Http2Session.prototype.constructor");
    }
}
export class ServerHttp2Session {
    constructor(){
        notImplemented("ServerHttp2Session");
    }
}
export class ClientHttp2Session {
    constructor(){
        notImplemented("ClientHttp2Session");
    }
}
export class Http2Stream {
    constructor(){
        notImplemented("Http2Stream");
    }
}
export class ClientHttp2Stream {
    constructor(){
        notImplemented("ClientHttp2Stream");
    }
}
export class ServerHttp2Stream {
    constructor(){
        notImplemented("ServerHttp2Stream");
    }
}
export class Http2Server {
    constructor(){
        notImplemented("Http2Server");
    }
}
export class Http2SecureServer {
    constructor(){
        notImplemented("Http2SecureServer");
    }
}
export function createServer() {}
export function createSecureServer() {}
export function connect() {}
export const constants = {};
export function getDefaultSettings() {}
export function getPackedSettings() {}
export function getUnpackedSettings() {}
export const sensitiveHeaders = Symbol("nodejs.http2.sensitiveHeaders");
export class Http2ServerRequest {
    constructor(){
        notImplemented("Http2ServerRequest");
    }
}
export class Http2ServerResponse {
    constructor(){
        notImplemented("Http2ServerResponse");
    }
}
export default {
    Http2Session,
    ServerHttp2Session,
    ClientHttp2Session,
    Http2Stream,
    ClientHttp2Stream,
    ServerHttp2Stream,
    Http2Server,
    Http2SecureServer,
    createServer,
    createSecureServer,
    connect,
    constants,
    getDefaultSettings,
    getPackedSettings,
    getUnpackedSettings,
    sensitiveHeaders,
    Http2ServerRequest,
    Http2ServerResponse
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaHR0cDIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQgYW5kIE5vZGUgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcblxuZXhwb3J0IGNsYXNzIEh0dHAyU2Vzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTZXNzaW9uLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIFNlcnZlckh0dHAyU2Vzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiU2VydmVySHR0cDJTZXNzaW9uXCIpO1xuICB9XG59XG5leHBvcnQgY2xhc3MgQ2xpZW50SHR0cDJTZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJDbGllbnRIdHRwMlNlc3Npb25cIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBIdHRwMlN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTdHJlYW1cIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBDbGllbnRIdHRwMlN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiQ2xpZW50SHR0cDJTdHJlYW1cIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBTZXJ2ZXJIdHRwMlN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiU2VydmVySHR0cDJTdHJlYW1cIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBIdHRwMlNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTZXJ2ZXJcIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBIdHRwMlNlY3VyZVNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTZWN1cmVTZXJ2ZXJcIik7XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXIoKSB7fVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlY3VyZVNlcnZlcigpIHt9XG5leHBvcnQgZnVuY3Rpb24gY29ubmVjdCgpIHt9XG5leHBvcnQgY29uc3QgY29uc3RhbnRzID0ge307XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdFNldHRpbmdzKCkge31cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYWNrZWRTZXR0aW5ncygpIHt9XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5wYWNrZWRTZXR0aW5ncygpIHt9XG5leHBvcnQgY29uc3Qgc2Vuc2l0aXZlSGVhZGVycyA9IFN5bWJvbChcIm5vZGVqcy5odHRwMi5zZW5zaXRpdmVIZWFkZXJzXCIpO1xuZXhwb3J0IGNsYXNzIEh0dHAyU2VydmVyUmVxdWVzdCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTZXJ2ZXJSZXF1ZXN0XCIpO1xuICB9XG59XG5leHBvcnQgY2xhc3MgSHR0cDJTZXJ2ZXJSZXNwb25zZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiSHR0cDJTZXJ2ZXJSZXNwb25zZVwiKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQge1xuICBIdHRwMlNlc3Npb24sXG4gIFNlcnZlckh0dHAyU2Vzc2lvbixcbiAgQ2xpZW50SHR0cDJTZXNzaW9uLFxuICBIdHRwMlN0cmVhbSxcbiAgQ2xpZW50SHR0cDJTdHJlYW0sXG4gIFNlcnZlckh0dHAyU3RyZWFtLFxuICBIdHRwMlNlcnZlcixcbiAgSHR0cDJTZWN1cmVTZXJ2ZXIsXG4gIGNyZWF0ZVNlcnZlcixcbiAgY3JlYXRlU2VjdXJlU2VydmVyLFxuICBjb25uZWN0LFxuICBjb25zdGFudHMsXG4gIGdldERlZmF1bHRTZXR0aW5ncyxcbiAgZ2V0UGFja2VkU2V0dGluZ3MsXG4gIGdldFVucGFja2VkU2V0dGluZ3MsXG4gIHNlbnNpdGl2ZUhlYWRlcnMsXG4gIEh0dHAyU2VydmVyUmVxdWVzdCxcbiAgSHR0cDJTZXJ2ZXJSZXNwb25zZSxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUU1RSxTQUFTLGNBQWMsUUFBUSxjQUFjO0FBRTdDLE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sU0FBUyxlQUFlLENBQUMsQ0FBQztBQUNqQyxPQUFPLFNBQVMscUJBQXFCLENBQUMsQ0FBQztBQUN2QyxPQUFPLFNBQVMsVUFBVSxDQUFDLENBQUM7QUFDNUIsT0FBTyxNQUFNLFlBQVksQ0FBQyxFQUFFO0FBQzVCLE9BQU8sU0FBUyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3ZDLE9BQU8sU0FBUyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3RDLE9BQU8sU0FBUyxzQkFBc0IsQ0FBQyxDQUFDO0FBQ3hDLE9BQU8sTUFBTSxtQkFBbUIsT0FBTyxpQ0FBaUM7QUFDeEUsT0FBTyxNQUFNO0lBQ1gsYUFBYztRQUNaLGVBQWU7SUFDakI7QUFDRixDQUFDO0FBQ0QsT0FBTyxNQUFNO0lBQ1gsYUFBYztRQUNaLGVBQWU7SUFDakI7QUFDRixDQUFDO0FBQ0QsZUFBZTtJQUNiO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtBQUNGLEVBQUUifQ==