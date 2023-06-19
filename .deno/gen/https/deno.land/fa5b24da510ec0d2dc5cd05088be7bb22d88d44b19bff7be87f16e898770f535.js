// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
const { PerformanceObserver , PerformanceEntry , performance: shimPerformance  } = globalThis;
const constants = {};
const performance = {
    clearMarks: (markName)=>shimPerformance.clearMarks(markName),
    eventLoopUtilization: ()=>notImplemented("eventLoopUtilization from performance"),
    mark: (markName)=>shimPerformance.mark(markName),
    measure: (measureName, startMark, endMark)=>{
        if (endMark) {
            return shimPerformance.measure(measureName, startMark, endMark);
        } else {
            return shimPerformance.measure(measureName, startMark);
        }
    },
    nodeTiming: {},
    now: ()=>shimPerformance.now(),
    timerify: ()=>notImplemented("timerify from performance"),
    // deno-lint-ignore no-explicit-any
    timeOrigin: shimPerformance.timeOrigin,
    // @ts-ignore waiting on update in `deno`, but currently this is
    // a circular dependency
    toJSON: ()=>shimPerformance.toJSON(),
    addEventListener: (...args)=>shimPerformance.addEventListener(...args),
    removeEventListener: (...args)=>shimPerformance.removeEventListener(...args),
    dispatchEvent: (...args)=>shimPerformance.dispatchEvent(...args)
};
const monitorEventLoopDelay = ()=>notImplemented("monitorEventLoopDelay from performance");
export default {
    performance,
    PerformanceObserver,
    PerformanceEntry,
    monitorEventLoopDelay,
    constants
};
export { constants, monitorEventLoopDelay, performance, PerformanceEntry, PerformanceObserver };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvcGVyZl9ob29rcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcblxuY29uc3QgeyBQZXJmb3JtYW5jZU9ic2VydmVyLCBQZXJmb3JtYW5jZUVudHJ5LCBwZXJmb3JtYW5jZTogc2hpbVBlcmZvcm1hbmNlIH0gPVxuICBnbG9iYWxUaGlzIGFzIHR5cGVvZiBnbG9iYWxUaGlzICYge1xuICAgIFBlcmZvcm1hbmNlRW50cnk6IFBlcmZvcm1hbmNlRW50cnk7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBQZXJmb3JtYW5jZU9ic2VydmVyOiBhbnk7XG4gIH07XG5jb25zdCBjb25zdGFudHMgPSB7fTtcblxuY29uc3QgcGVyZm9ybWFuY2U6XG4gICYgT21pdDxcbiAgICBQZXJmb3JtYW5jZSxcbiAgICBcImNsZWFyTWVhc3VyZXNcIiB8IFwiZ2V0RW50cmllc1wiIHwgXCJnZXRFbnRyaWVzQnlOYW1lXCIgfCBcImdldEVudHJpZXNCeVR5cGVcIlxuICA+XG4gICYge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgZXZlbnRMb29wVXRpbGl6YXRpb246IGFueTtcbiAgICBub2RlVGltaW5nOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgdGltZXJpZnk6IGFueTtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRpbWVPcmlnaW46IGFueTtcbiAgfSA9IHtcbiAgICBjbGVhck1hcmtzOiAobWFya05hbWU6IHN0cmluZykgPT4gc2hpbVBlcmZvcm1hbmNlLmNsZWFyTWFya3MobWFya05hbWUpLFxuICAgIGV2ZW50TG9vcFV0aWxpemF0aW9uOiAoKSA9PlxuICAgICAgbm90SW1wbGVtZW50ZWQoXCJldmVudExvb3BVdGlsaXphdGlvbiBmcm9tIHBlcmZvcm1hbmNlXCIpLFxuICAgIG1hcms6IChtYXJrTmFtZTogc3RyaW5nKSA9PiBzaGltUGVyZm9ybWFuY2UubWFyayhtYXJrTmFtZSksXG4gICAgbWVhc3VyZTogKFxuICAgICAgbWVhc3VyZU5hbWU6IHN0cmluZyxcbiAgICAgIHN0YXJ0TWFyaz86IHN0cmluZyB8IFBlcmZvcm1hbmNlTWVhc3VyZU9wdGlvbnMsXG4gICAgICBlbmRNYXJrPzogc3RyaW5nLFxuICAgICk6IFBlcmZvcm1hbmNlTWVhc3VyZSA9PiB7XG4gICAgICBpZiAoZW5kTWFyaykge1xuICAgICAgICByZXR1cm4gc2hpbVBlcmZvcm1hbmNlLm1lYXN1cmUoXG4gICAgICAgICAgbWVhc3VyZU5hbWUsXG4gICAgICAgICAgc3RhcnRNYXJrIGFzIHN0cmluZyxcbiAgICAgICAgICBlbmRNYXJrLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHNoaW1QZXJmb3JtYW5jZS5tZWFzdXJlKFxuICAgICAgICAgIG1lYXN1cmVOYW1lLFxuICAgICAgICAgIHN0YXJ0TWFyayBhcyBQZXJmb3JtYW5jZU1lYXN1cmVPcHRpb25zLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0sXG4gICAgbm9kZVRpbWluZzoge30sXG4gICAgbm93OiAoKSA9PiBzaGltUGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZXJpZnk6ICgpID0+IG5vdEltcGxlbWVudGVkKFwidGltZXJpZnkgZnJvbSBwZXJmb3JtYW5jZVwiKSxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRpbWVPcmlnaW46IChzaGltUGVyZm9ybWFuY2UgYXMgYW55KS50aW1lT3JpZ2luLFxuICAgIC8vIEB0cy1pZ25vcmUgd2FpdGluZyBvbiB1cGRhdGUgaW4gYGRlbm9gLCBidXQgY3VycmVudGx5IHRoaXMgaXNcbiAgICAvLyBhIGNpcmN1bGFyIGRlcGVuZGVuY3lcbiAgICB0b0pTT046ICgpID0+IHNoaW1QZXJmb3JtYW5jZS50b0pTT04oKSxcbiAgICBhZGRFdmVudExpc3RlbmVyOiAoXG4gICAgICAuLi5hcmdzOiBQYXJhbWV0ZXJzPHR5cGVvZiBzaGltUGVyZm9ybWFuY2UuYWRkRXZlbnRMaXN0ZW5lcj5cbiAgICApID0+IHNoaW1QZXJmb3JtYW5jZS5hZGRFdmVudExpc3RlbmVyKC4uLmFyZ3MpLFxuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXI6IChcbiAgICAgIC4uLmFyZ3M6IFBhcmFtZXRlcnM8dHlwZW9mIHNoaW1QZXJmb3JtYW5jZS5yZW1vdmVFdmVudExpc3RlbmVyPlxuICAgICkgPT4gc2hpbVBlcmZvcm1hbmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoLi4uYXJncyksXG4gICAgZGlzcGF0Y2hFdmVudDogKFxuICAgICAgLi4uYXJnczogUGFyYW1ldGVyczx0eXBlb2Ygc2hpbVBlcmZvcm1hbmNlLmRpc3BhdGNoRXZlbnQ+XG4gICAgKSA9PiBzaGltUGVyZm9ybWFuY2UuZGlzcGF0Y2hFdmVudCguLi5hcmdzKSxcbiAgfTtcblxuY29uc3QgbW9uaXRvckV2ZW50TG9vcERlbGF5ID0gKCkgPT5cbiAgbm90SW1wbGVtZW50ZWQoXG4gICAgXCJtb25pdG9yRXZlbnRMb29wRGVsYXkgZnJvbSBwZXJmb3JtYW5jZVwiLFxuICApO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHBlcmZvcm1hbmNlLFxuICBQZXJmb3JtYW5jZU9ic2VydmVyLFxuICBQZXJmb3JtYW5jZUVudHJ5LFxuICBtb25pdG9yRXZlbnRMb29wRGVsYXksXG4gIGNvbnN0YW50cyxcbn07XG5cbmV4cG9ydCB7XG4gIGNvbnN0YW50cyxcbiAgbW9uaXRvckV2ZW50TG9vcERlbGF5LFxuICBwZXJmb3JtYW5jZSxcbiAgUGVyZm9ybWFuY2VFbnRyeSxcbiAgUGVyZm9ybWFuY2VPYnNlcnZlcixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQVMsY0FBYyxRQUFRLGNBQWM7QUFFN0MsTUFBTSxFQUFFLG9CQUFtQixFQUFFLGlCQUFnQixFQUFFLGFBQWEsZ0JBQWUsRUFBRSxHQUMzRTtBQUtGLE1BQU0sWUFBWSxDQUFDO0FBRW5CLE1BQU0sY0FhQTtJQUNGLFlBQVksQ0FBQyxXQUFxQixnQkFBZ0IsVUFBVSxDQUFDO0lBQzdELHNCQUFzQixJQUNwQixlQUFlO0lBQ2pCLE1BQU0sQ0FBQyxXQUFxQixnQkFBZ0IsSUFBSSxDQUFDO0lBQ2pELFNBQVMsQ0FDUCxhQUNBLFdBQ0EsVUFDdUI7UUFDdkIsSUFBSSxTQUFTO1lBQ1gsT0FBTyxnQkFBZ0IsT0FBTyxDQUM1QixhQUNBLFdBQ0E7UUFFSixPQUFPO1lBQ0wsT0FBTyxnQkFBZ0IsT0FBTyxDQUM1QixhQUNBO1FBRUosQ0FBQztJQUNIO0lBQ0EsWUFBWSxDQUFDO0lBQ2IsS0FBSyxJQUFNLGdCQUFnQixHQUFHO0lBQzlCLFVBQVUsSUFBTSxlQUFlO0lBQy9CLG1DQUFtQztJQUNuQyxZQUFZLEFBQUMsZ0JBQXdCLFVBQVU7SUFDL0MsZ0VBQWdFO0lBQ2hFLHdCQUF3QjtJQUN4QixRQUFRLElBQU0sZ0JBQWdCLE1BQU07SUFDcEMsa0JBQWtCLENBQ2hCLEdBQUcsT0FDQSxnQkFBZ0IsZ0JBQWdCLElBQUk7SUFDekMscUJBQXFCLENBQ25CLEdBQUcsT0FDQSxnQkFBZ0IsbUJBQW1CLElBQUk7SUFDNUMsZUFBZSxDQUNiLEdBQUcsT0FDQSxnQkFBZ0IsYUFBYSxJQUFJO0FBQ3hDO0FBRUYsTUFBTSx3QkFBd0IsSUFDNUIsZUFDRTtBQUdKLGVBQWU7SUFDYjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0FBQ0YsRUFBRTtBQUVGLFNBQ0UsU0FBUyxFQUNULHFCQUFxQixFQUNyQixXQUFXLEVBQ1gsZ0JBQWdCLEVBQ2hCLG1CQUFtQixHQUNuQiJ9