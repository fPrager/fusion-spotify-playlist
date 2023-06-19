// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
/** A Worker object contains all public information and method about a worker.
 * In the primary it can be obtained using cluster.workers. In a worker it can
 * be obtained using cluster.worker.
 */ export class Worker {
    constructor(){
        notImplemented("cluster.Worker.prototype.constructor");
    }
}
/** Calls .disconnect() on each worker in cluster.workers. */ export function disconnected() {
    notImplemented("cluster.disconnected");
}
/** Spawn a new worker process. */ export function fork() {
    notImplemented("cluster.fork");
}
/** True if the process is a primary. This is determined by
 * the process.env.NODE_UNIQUE_ID. If process.env.NODE_UNIQUE_ID is undefined,
 * then isPrimary is true. */ export const isPrimary = undefined;
/** True if the process is not a primary (it is the negation of
 * cluster.isPrimary). */ export const isWorker = undefined;
/** Deprecated alias for cluster.isPrimary. details. */ export const isMaster = isPrimary;
/** The scheduling policy, either cluster.SCHED_RR for round-robin or
 * cluster.SCHED_NONE to leave it to the operating system. This is a global
 * setting and effectively frozen once either the first worker is spawned, or
 * .setupPrimary() is called, whichever comes first. */ export const schedulingPolicy = undefined;
/** The settings object */ export const settings = undefined;
/** Deprecated alias for .setupPrimary(). */ export function setupMaster() {
    notImplemented("cluster.setupMaster");
}
/** setupPrimary is used to change the default 'fork' behavior. Once called,
 * the settings will be present in cluster.settings. */ export function setupPrimary() {
    notImplemented("cluster.setupPrimary");
}
/** A reference to the current worker object. Not available in the primary
 * process. */ export const worker = undefined;
/** A hash that stores the active worker objects, keyed by id field. Makes it
 * easy to loop through all the workers. It is only available in the primary
 * process. */ export const workers = undefined;
export default {
    Worker,
    disconnected,
    fork,
    isPrimary,
    isWorker,
    isMaster,
    schedulingPolicy,
    settings,
    setupMaster,
    setupPrimary,
    worker,
    workers
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvY2x1c3Rlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCBhbmQgTm9kZSBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuL191dGlscy50c1wiO1xuXG4vKiogQSBXb3JrZXIgb2JqZWN0IGNvbnRhaW5zIGFsbCBwdWJsaWMgaW5mb3JtYXRpb24gYW5kIG1ldGhvZCBhYm91dCBhIHdvcmtlci5cbiAqIEluIHRoZSBwcmltYXJ5IGl0IGNhbiBiZSBvYnRhaW5lZCB1c2luZyBjbHVzdGVyLndvcmtlcnMuIEluIGEgd29ya2VyIGl0IGNhblxuICogYmUgb2J0YWluZWQgdXNpbmcgY2x1c3Rlci53b3JrZXIuXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNsdXN0ZXIuV29ya2VyLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxufVxuLyoqIENhbGxzIC5kaXNjb25uZWN0KCkgb24gZWFjaCB3b3JrZXIgaW4gY2x1c3Rlci53b3JrZXJzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2Nvbm5lY3RlZCgpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJjbHVzdGVyLmRpc2Nvbm5lY3RlZFwiKTtcbn1cbi8qKiBTcGF3biBhIG5ldyB3b3JrZXIgcHJvY2Vzcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JrKCkge1xuICBub3RJbXBsZW1lbnRlZChcImNsdXN0ZXIuZm9ya1wiKTtcbn1cbi8qKiBUcnVlIGlmIHRoZSBwcm9jZXNzIGlzIGEgcHJpbWFyeS4gVGhpcyBpcyBkZXRlcm1pbmVkIGJ5XG4gKiB0aGUgcHJvY2Vzcy5lbnYuTk9ERV9VTklRVUVfSUQuIElmIHByb2Nlc3MuZW52Lk5PREVfVU5JUVVFX0lEIGlzIHVuZGVmaW5lZCxcbiAqIHRoZW4gaXNQcmltYXJ5IGlzIHRydWUuICovXG5leHBvcnQgY29uc3QgaXNQcmltYXJ5ID0gdW5kZWZpbmVkO1xuLyoqIFRydWUgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGEgcHJpbWFyeSAoaXQgaXMgdGhlIG5lZ2F0aW9uIG9mXG4gKiBjbHVzdGVyLmlzUHJpbWFyeSkuICovXG5leHBvcnQgY29uc3QgaXNXb3JrZXIgPSB1bmRlZmluZWQ7XG4vKiogRGVwcmVjYXRlZCBhbGlhcyBmb3IgY2x1c3Rlci5pc1ByaW1hcnkuIGRldGFpbHMuICovXG5leHBvcnQgY29uc3QgaXNNYXN0ZXIgPSBpc1ByaW1hcnk7XG4vKiogVGhlIHNjaGVkdWxpbmcgcG9saWN5LCBlaXRoZXIgY2x1c3Rlci5TQ0hFRF9SUiBmb3Igcm91bmQtcm9iaW4gb3JcbiAqIGNsdXN0ZXIuU0NIRURfTk9ORSB0byBsZWF2ZSBpdCB0byB0aGUgb3BlcmF0aW5nIHN5c3RlbS4gVGhpcyBpcyBhIGdsb2JhbFxuICogc2V0dGluZyBhbmQgZWZmZWN0aXZlbHkgZnJvemVuIG9uY2UgZWl0aGVyIHRoZSBmaXJzdCB3b3JrZXIgaXMgc3Bhd25lZCwgb3JcbiAqIC5zZXR1cFByaW1hcnkoKSBpcyBjYWxsZWQsIHdoaWNoZXZlciBjb21lcyBmaXJzdC4gKi9cbmV4cG9ydCBjb25zdCBzY2hlZHVsaW5nUG9saWN5ID0gdW5kZWZpbmVkO1xuLyoqIFRoZSBzZXR0aW5ncyBvYmplY3QgKi9cbmV4cG9ydCBjb25zdCBzZXR0aW5ncyA9IHVuZGVmaW5lZDtcbi8qKiBEZXByZWNhdGVkIGFsaWFzIGZvciAuc2V0dXBQcmltYXJ5KCkuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBNYXN0ZXIoKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY2x1c3Rlci5zZXR1cE1hc3RlclwiKTtcbn1cbi8qKiBzZXR1cFByaW1hcnkgaXMgdXNlZCB0byBjaGFuZ2UgdGhlIGRlZmF1bHQgJ2ZvcmsnIGJlaGF2aW9yLiBPbmNlIGNhbGxlZCxcbiAqIHRoZSBzZXR0aW5ncyB3aWxsIGJlIHByZXNlbnQgaW4gY2x1c3Rlci5zZXR0aW5ncy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFByaW1hcnkoKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY2x1c3Rlci5zZXR1cFByaW1hcnlcIik7XG59XG4vKiogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgd29ya2VyIG9iamVjdC4gTm90IGF2YWlsYWJsZSBpbiB0aGUgcHJpbWFyeVxuICogcHJvY2Vzcy4gKi9cbmV4cG9ydCBjb25zdCB3b3JrZXIgPSB1bmRlZmluZWQ7XG4vKiogQSBoYXNoIHRoYXQgc3RvcmVzIHRoZSBhY3RpdmUgd29ya2VyIG9iamVjdHMsIGtleWVkIGJ5IGlkIGZpZWxkLiBNYWtlcyBpdFxuICogZWFzeSB0byBsb29wIHRocm91Z2ggYWxsIHRoZSB3b3JrZXJzLiBJdCBpcyBvbmx5IGF2YWlsYWJsZSBpbiB0aGUgcHJpbWFyeVxuICogcHJvY2Vzcy4gKi9cbmV4cG9ydCBjb25zdCB3b3JrZXJzID0gdW5kZWZpbmVkO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIFdvcmtlcixcbiAgZGlzY29ubmVjdGVkLFxuICBmb3JrLFxuICBpc1ByaW1hcnksXG4gIGlzV29ya2VyLFxuICBpc01hc3RlcixcbiAgc2NoZWR1bGluZ1BvbGljeSxcbiAgc2V0dGluZ3MsXG4gIHNldHVwTWFzdGVyLFxuICBzZXR1cFByaW1hcnksXG4gIHdvcmtlcixcbiAgd29ya2Vycyxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUU1RSxTQUFTLGNBQWMsUUFBUSxjQUFjO0FBRTdDOzs7Q0FHQyxHQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELDJEQUEyRCxHQUMzRCxPQUFPLFNBQVMsZUFBZTtJQUM3QixlQUFlO0FBQ2pCLENBQUM7QUFDRCxnQ0FBZ0MsR0FDaEMsT0FBTyxTQUFTLE9BQU87SUFDckIsZUFBZTtBQUNqQixDQUFDO0FBQ0Q7OzJCQUUyQixHQUMzQixPQUFPLE1BQU0sWUFBWSxVQUFVO0FBQ25DO3VCQUN1QixHQUN2QixPQUFPLE1BQU0sV0FBVyxVQUFVO0FBQ2xDLHFEQUFxRCxHQUNyRCxPQUFPLE1BQU0sV0FBVyxVQUFVO0FBQ2xDOzs7cURBR3FELEdBQ3JELE9BQU8sTUFBTSxtQkFBbUIsVUFBVTtBQUMxQyx3QkFBd0IsR0FDeEIsT0FBTyxNQUFNLFdBQVcsVUFBVTtBQUNsQywwQ0FBMEMsR0FDMUMsT0FBTyxTQUFTLGNBQWM7SUFDNUIsZUFBZTtBQUNqQixDQUFDO0FBQ0Q7cURBQ3FELEdBQ3JELE9BQU8sU0FBUyxlQUFlO0lBQzdCLGVBQWU7QUFDakIsQ0FBQztBQUNEO1lBQ1ksR0FDWixPQUFPLE1BQU0sU0FBUyxVQUFVO0FBQ2hDOztZQUVZLEdBQ1osT0FBTyxNQUFNLFVBQVUsVUFBVTtBQUVqQyxlQUFlO0lBQ2I7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0FBQ0YsRUFBRSJ9