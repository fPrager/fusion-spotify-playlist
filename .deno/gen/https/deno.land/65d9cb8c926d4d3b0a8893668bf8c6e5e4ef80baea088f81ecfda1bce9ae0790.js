// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { EventEmitter } from "./events.ts";
import { notImplemented } from "./_utils.ts";
const connectionSymbol = Symbol("connectionProperty");
const messageCallbacksSymbol = Symbol("messageCallbacks");
const nextIdSymbol = Symbol("nextId");
const onMessageSymbol = Symbol("onMessage");
class Session extends EventEmitter {
    [connectionSymbol];
    [nextIdSymbol];
    [messageCallbacksSymbol];
    constructor(){
        super();
        notImplemented("inspector.Session.prototype.constructor");
    }
    /** Connects the session to the inspector back-end. */ connect() {
        notImplemented("inspector.Session.prototype.connect");
    }
    /** Connects the session to the main thread
   * inspector back-end. */ connectToMainThread() {
        notImplemented("inspector.Session.prototype.connectToMainThread");
    }
    [onMessageSymbol](_message) {
        notImplemented("inspector.Session.prototype[Symbol('onMessage')]");
    }
    /** Posts a message to the inspector back-end. */ post(_method, _params, _callback) {
        notImplemented("inspector.Session.prototype.post");
    }
    /** Immediately closes the session, all pending
   * message callbacks will be called with an
   * error.
   */ disconnect() {
        notImplemented("inspector.Session.prototype.disconnect");
    }
}
/** Activates inspector on host and port.
 * See https://nodejs.org/api/inspector.html#inspectoropenport-host-wait */ function open(_port, _host, _wait) {
    notImplemented("inspector.Session.prototype.open");
}
/** Deactivate the inspector. Blocks until there are no active connections.
 * See https://nodejs.org/api/inspector.html#inspectorclose */ function close() {
    notImplemented("inspector.Session.prototype.close");
}
/** Return the URL of the active inspector, or undefined if there is none.
 * See https://nodejs.org/api/inspector.html#inspectorurl */ function url() {
    // TODO(kt3k): returns undefined for now, which means the inspector is not activated.
    return undefined;
}
/** Blocks until a client (existing or connected later) has sent Runtime.runIfWaitingForDebugger command.
 * See https://nodejs.org/api/inspector.html#inspectorwaitfordebugger */ function waitForDebugger() {
    notImplemented("inspector.wairForDebugger");
}
const console = globalThis.console;
export { close, console, open, Session, url, waitForDebugger };
export default {
    close,
    console,
    open,
    Session,
    url,
    waitForDebugger
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW5zcGVjdG9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50IGFuZCBOb2RlIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCIuL2V2ZW50cy50c1wiO1xuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcblxuY29uc3QgY29ubmVjdGlvblN5bWJvbCA9IFN5bWJvbChcImNvbm5lY3Rpb25Qcm9wZXJ0eVwiKTtcbmNvbnN0IG1lc3NhZ2VDYWxsYmFja3NTeW1ib2wgPSBTeW1ib2woXCJtZXNzYWdlQ2FsbGJhY2tzXCIpO1xuY29uc3QgbmV4dElkU3ltYm9sID0gU3ltYm9sKFwibmV4dElkXCIpO1xuY29uc3Qgb25NZXNzYWdlU3ltYm9sID0gU3ltYm9sKFwib25NZXNzYWdlXCIpO1xuXG5jbGFzcyBTZXNzaW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgW2Nvbm5lY3Rpb25TeW1ib2xdOiBudWxsO1xuICBbbmV4dElkU3ltYm9sXTogbnVtYmVyO1xuICBbbWVzc2FnZUNhbGxiYWNrc1N5bWJvbF06IE1hcDxzdHJpbmcsIChlOiBFcnJvcikgPT4gdm9pZD47XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICBub3RJbXBsZW1lbnRlZChcImluc3BlY3Rvci5TZXNzaW9uLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxuXG4gIC8qKiBDb25uZWN0cyB0aGUgc2Vzc2lvbiB0byB0aGUgaW5zcGVjdG9yIGJhY2stZW5kLiAqL1xuICBjb25uZWN0KCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiaW5zcGVjdG9yLlNlc3Npb24ucHJvdG90eXBlLmNvbm5lY3RcIik7XG4gIH1cblxuICAvKiogQ29ubmVjdHMgdGhlIHNlc3Npb24gdG8gdGhlIG1haW4gdGhyZWFkXG4gICAqIGluc3BlY3RvciBiYWNrLWVuZC4gKi9cbiAgY29ubmVjdFRvTWFpblRocmVhZCgpIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImluc3BlY3Rvci5TZXNzaW9uLnByb3RvdHlwZS5jb25uZWN0VG9NYWluVGhyZWFkXCIpO1xuICB9XG5cbiAgW29uTWVzc2FnZVN5bWJvbF0oX21lc3NhZ2U6IHN0cmluZykge1xuICAgIG5vdEltcGxlbWVudGVkKFwiaW5zcGVjdG9yLlNlc3Npb24ucHJvdG90eXBlW1N5bWJvbCgnb25NZXNzYWdlJyldXCIpO1xuICB9XG5cbiAgLyoqIFBvc3RzIGEgbWVzc2FnZSB0byB0aGUgaW5zcGVjdG9yIGJhY2stZW5kLiAqL1xuICBwb3N0KFxuICAgIF9tZXRob2Q6IHN0cmluZyxcbiAgICBfcGFyYW1zPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgX2NhbGxiYWNrPzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJpbnNwZWN0b3IuU2Vzc2lvbi5wcm90b3R5cGUucG9zdFwiKTtcbiAgfVxuXG4gIC8qKiBJbW1lZGlhdGVseSBjbG9zZXMgdGhlIHNlc3Npb24sIGFsbCBwZW5kaW5nXG4gICAqIG1lc3NhZ2UgY2FsbGJhY2tzIHdpbGwgYmUgY2FsbGVkIHdpdGggYW5cbiAgICogZXJyb3IuXG4gICAqL1xuICBkaXNjb25uZWN0KCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiaW5zcGVjdG9yLlNlc3Npb24ucHJvdG90eXBlLmRpc2Nvbm5lY3RcIik7XG4gIH1cbn1cblxuLyoqIEFjdGl2YXRlcyBpbnNwZWN0b3Igb24gaG9zdCBhbmQgcG9ydC5cbiAqIFNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2luc3BlY3Rvci5odG1sI2luc3BlY3Rvcm9wZW5wb3J0LWhvc3Qtd2FpdCAqL1xuZnVuY3Rpb24gb3BlbihfcG9ydD86IG51bWJlciwgX2hvc3Q/OiBzdHJpbmcsIF93YWl0PzogYm9vbGVhbikge1xuICBub3RJbXBsZW1lbnRlZChcImluc3BlY3Rvci5TZXNzaW9uLnByb3RvdHlwZS5vcGVuXCIpO1xufVxuXG4vKiogRGVhY3RpdmF0ZSB0aGUgaW5zcGVjdG9yLiBCbG9ja3MgdW50aWwgdGhlcmUgYXJlIG5vIGFjdGl2ZSBjb25uZWN0aW9ucy5cbiAqIFNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2luc3BlY3Rvci5odG1sI2luc3BlY3RvcmNsb3NlICovXG5mdW5jdGlvbiBjbG9zZSgpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJpbnNwZWN0b3IuU2Vzc2lvbi5wcm90b3R5cGUuY2xvc2VcIik7XG59XG5cbi8qKiBSZXR1cm4gdGhlIFVSTCBvZiB0aGUgYWN0aXZlIGluc3BlY3Rvciwgb3IgdW5kZWZpbmVkIGlmIHRoZXJlIGlzIG5vbmUuXG4gKiBTZWUgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9pbnNwZWN0b3IuaHRtbCNpbnNwZWN0b3J1cmwgKi9cbmZ1bmN0aW9uIHVybCgpIHtcbiAgLy8gVE9ETyhrdDNrKTogcmV0dXJucyB1bmRlZmluZWQgZm9yIG5vdywgd2hpY2ggbWVhbnMgdGhlIGluc3BlY3RvciBpcyBub3QgYWN0aXZhdGVkLlxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKiogQmxvY2tzIHVudGlsIGEgY2xpZW50IChleGlzdGluZyBvciBjb25uZWN0ZWQgbGF0ZXIpIGhhcyBzZW50IFJ1bnRpbWUucnVuSWZXYWl0aW5nRm9yRGVidWdnZXIgY29tbWFuZC5cbiAqIFNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL2luc3BlY3Rvci5odG1sI2luc3BlY3RvcndhaXRmb3JkZWJ1Z2dlciAqL1xuZnVuY3Rpb24gd2FpdEZvckRlYnVnZ2VyKCkge1xuICBub3RJbXBsZW1lbnRlZChcImluc3BlY3Rvci53YWlyRm9yRGVidWdnZXJcIik7XG59XG5cbmNvbnN0IGNvbnNvbGUgPSBnbG9iYWxUaGlzLmNvbnNvbGU7XG5cbmV4cG9ydCB7IGNsb3NlLCBjb25zb2xlLCBvcGVuLCBTZXNzaW9uLCB1cmwsIHdhaXRGb3JEZWJ1Z2dlciB9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGNsb3NlLFxuICBjb25zb2xlLFxuICBvcGVuLFxuICBTZXNzaW9uLFxuICB1cmwsXG4gIHdhaXRGb3JEZWJ1Z2dlcixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUU1RSxTQUFTLFlBQVksUUFBUSxjQUFjO0FBQzNDLFNBQVMsY0FBYyxRQUFRLGNBQWM7QUFFN0MsTUFBTSxtQkFBbUIsT0FBTztBQUNoQyxNQUFNLHlCQUF5QixPQUFPO0FBQ3RDLE1BQU0sZUFBZSxPQUFPO0FBQzVCLE1BQU0sa0JBQWtCLE9BQU87QUFFL0IsTUFBTSxnQkFBZ0I7SUFDcEIsQ0FBQyxpQkFBaUIsQ0FBTztJQUN6QixDQUFDLGFBQWEsQ0FBUztJQUN2QixDQUFDLHVCQUF1QixDQUFrQztJQUUxRCxhQUFjO1FBQ1osS0FBSztRQUNMLGVBQWU7SUFDakI7SUFFQSxvREFBb0QsR0FDcEQsVUFBVTtRQUNSLGVBQWU7SUFDakI7SUFFQTt5QkFDdUIsR0FDdkIsc0JBQXNCO1FBQ3BCLGVBQWU7SUFDakI7SUFFQSxDQUFDLGdCQUFnQixDQUFDLFFBQWdCLEVBQUU7UUFDbEMsZUFBZTtJQUNqQjtJQUVBLCtDQUErQyxHQUMvQyxLQUNFLE9BQWUsRUFDZixPQUFpQyxFQUNqQyxTQUF3QyxFQUN4QztRQUNBLGVBQWU7SUFDakI7SUFFQTs7O0dBR0MsR0FDRCxhQUFhO1FBQ1gsZUFBZTtJQUNqQjtBQUNGO0FBRUE7eUVBQ3lFLEdBQ3pFLFNBQVMsS0FBSyxLQUFjLEVBQUUsS0FBYyxFQUFFLEtBQWUsRUFBRTtJQUM3RCxlQUFlO0FBQ2pCO0FBRUE7NERBQzRELEdBQzVELFNBQVMsUUFBUTtJQUNmLGVBQWU7QUFDakI7QUFFQTswREFDMEQsR0FDMUQsU0FBUyxNQUFNO0lBQ2IscUZBQXFGO0lBQ3JGLE9BQU87QUFDVDtBQUVBO3NFQUNzRSxHQUN0RSxTQUFTLGtCQUFrQjtJQUN6QixlQUFlO0FBQ2pCO0FBRUEsTUFBTSxVQUFVLFdBQVcsT0FBTztBQUVsQyxTQUFTLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsZUFBZSxHQUFHO0FBRS9ELGVBQWU7SUFDYjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7QUFDRixFQUFFIn0=