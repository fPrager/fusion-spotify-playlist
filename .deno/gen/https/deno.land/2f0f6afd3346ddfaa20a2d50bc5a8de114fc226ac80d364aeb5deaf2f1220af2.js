// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// deno-lint-ignore-file no-explicit-any
import { notImplemented } from "./_utils.ts";
export class Script {
    code;
    constructor(code, _options = {}){
        this.code = `${code}`;
    }
    runInThisContext(_options) {
        return eval.call(globalThis, this.code);
    }
    runInContext(_contextifiedObject, _options) {
        notImplemented("Script.prototype.runInContext");
    }
    runInNewContext(_contextObject, _options) {
        notImplemented("Script.prototype.runInNewContext");
    }
    createCachedData() {
        notImplemented("Script.prototyp.createCachedData");
    }
}
export function createContext(_contextObject, _options) {
    notImplemented("createContext");
}
export function createScript(code, options) {
    return new Script(code, options);
}
export function runInContext(_code, _contextifiedObject, _options) {
    notImplemented("runInContext");
}
export function runInNewContext(_code, _contextObject, _options) {
    notImplemented("runInNewContext");
}
export function runInThisContext(code, options) {
    return createScript(code, options).runInThisContext(options);
}
export function isContext(_maybeContext) {
    notImplemented("isContext");
}
export function compileFunction(_code, _params, _options) {
    notImplemented("compileFunction");
}
export function measureMemory(_options) {
    notImplemented("measureMemory");
}
export default {
    Script,
    createContext,
    createScript,
    runInContext,
    runInNewContext,
    runInThisContext,
    isContext,
    compileFunction,
    measureMemory
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvdm0udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLy8gZGVuby1saW50LWlnbm9yZS1maWxlIG5vLWV4cGxpY2l0LWFueVxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuL191dGlscy50c1wiO1xuXG5leHBvcnQgY2xhc3MgU2NyaXB0IHtcbiAgY29kZTogc3RyaW5nO1xuICBjb25zdHJ1Y3Rvcihjb2RlOiBzdHJpbmcsIF9vcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNvZGUgPSBgJHtjb2RlfWA7XG4gIH1cblxuICBydW5JblRoaXNDb250ZXh0KF9vcHRpb25zOiBhbnkpIHtcbiAgICByZXR1cm4gZXZhbC5jYWxsKGdsb2JhbFRoaXMsIHRoaXMuY29kZSk7XG4gIH1cblxuICBydW5JbkNvbnRleHQoX2NvbnRleHRpZmllZE9iamVjdDogYW55LCBfb3B0aW9uczogYW55KSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJTY3JpcHQucHJvdG90eXBlLnJ1bkluQ29udGV4dFwiKTtcbiAgfVxuXG4gIHJ1bkluTmV3Q29udGV4dChfY29udGV4dE9iamVjdDogYW55LCBfb3B0aW9uczogYW55KSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJTY3JpcHQucHJvdG90eXBlLnJ1bkluTmV3Q29udGV4dFwiKTtcbiAgfVxuXG4gIGNyZWF0ZUNhY2hlZERhdGEoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJTY3JpcHQucHJvdG90eXAuY3JlYXRlQ2FjaGVkRGF0YVwiKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29udGV4dChfY29udGV4dE9iamVjdDogYW55LCBfb3B0aW9uczogYW55KSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY3JlYXRlQ29udGV4dFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdChjb2RlOiBzdHJpbmcsIG9wdGlvbnM6IGFueSkge1xuICByZXR1cm4gbmV3IFNjcmlwdChjb2RlLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkluQ29udGV4dChcbiAgX2NvZGU6IHN0cmluZyxcbiAgX2NvbnRleHRpZmllZE9iamVjdDogYW55LFxuICBfb3B0aW9uczogYW55LFxuKSB7XG4gIG5vdEltcGxlbWVudGVkKFwicnVuSW5Db250ZXh0XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuSW5OZXdDb250ZXh0KFxuICBfY29kZTogc3RyaW5nLFxuICBfY29udGV4dE9iamVjdDogYW55LFxuICBfb3B0aW9uczogYW55LFxuKSB7XG4gIG5vdEltcGxlbWVudGVkKFwicnVuSW5OZXdDb250ZXh0XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuSW5UaGlzQ29udGV4dChcbiAgY29kZTogc3RyaW5nLFxuICBvcHRpb25zOiBhbnksXG4pIHtcbiAgcmV0dXJuIGNyZWF0ZVNjcmlwdChjb2RlLCBvcHRpb25zKS5ydW5JblRoaXNDb250ZXh0KG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb250ZXh0KF9tYXliZUNvbnRleHQ6IGFueSkge1xuICBub3RJbXBsZW1lbnRlZChcImlzQ29udGV4dFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVGdW5jdGlvbihfY29kZTogc3RyaW5nLCBfcGFyYW1zOiBhbnksIF9vcHRpb25zOiBhbnkpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJjb21waWxlRnVuY3Rpb25cIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZWFzdXJlTWVtb3J5KF9vcHRpb25zOiBhbnkpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJtZWFzdXJlTWVtb3J5XCIpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIFNjcmlwdCxcbiAgY3JlYXRlQ29udGV4dCxcbiAgY3JlYXRlU2NyaXB0LFxuICBydW5JbkNvbnRleHQsXG4gIHJ1bkluTmV3Q29udGV4dCxcbiAgcnVuSW5UaGlzQ29udGV4dCxcbiAgaXNDb250ZXh0LFxuICBjb21waWxlRnVuY3Rpb24sXG4gIG1lYXN1cmVNZW1vcnksXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSx3Q0FBd0M7QUFFeEMsU0FBUyxjQUFjLFFBQVEsY0FBYztBQUU3QyxPQUFPLE1BQU07SUFDWCxLQUFhO0lBQ2IsWUFBWSxJQUFZLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBRTtRQUN2QyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUM7SUFDdkI7SUFFQSxpQkFBaUIsUUFBYSxFQUFFO1FBQzlCLE9BQU8sS0FBSyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSTtJQUN4QztJQUVBLGFBQWEsbUJBQXdCLEVBQUUsUUFBYSxFQUFFO1FBQ3BELGVBQWU7SUFDakI7SUFFQSxnQkFBZ0IsY0FBbUIsRUFBRSxRQUFhLEVBQUU7UUFDbEQsZUFBZTtJQUNqQjtJQUVBLG1CQUFtQjtRQUNqQixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUVELE9BQU8sU0FBUyxjQUFjLGNBQW1CLEVBQUUsUUFBYSxFQUFFO0lBQ2hFLGVBQWU7QUFDakIsQ0FBQztBQUVELE9BQU8sU0FBUyxhQUFhLElBQVksRUFBRSxPQUFZLEVBQUU7SUFDdkQsT0FBTyxJQUFJLE9BQU8sTUFBTTtBQUMxQixDQUFDO0FBRUQsT0FBTyxTQUFTLGFBQ2QsS0FBYSxFQUNiLG1CQUF3QixFQUN4QixRQUFhLEVBQ2I7SUFDQSxlQUFlO0FBQ2pCLENBQUM7QUFFRCxPQUFPLFNBQVMsZ0JBQ2QsS0FBYSxFQUNiLGNBQW1CLEVBQ25CLFFBQWEsRUFDYjtJQUNBLGVBQWU7QUFDakIsQ0FBQztBQUVELE9BQU8sU0FBUyxpQkFDZCxJQUFZLEVBQ1osT0FBWSxFQUNaO0lBQ0EsT0FBTyxhQUFhLE1BQU0sU0FBUyxnQkFBZ0IsQ0FBQztBQUN0RCxDQUFDO0FBRUQsT0FBTyxTQUFTLFVBQVUsYUFBa0IsRUFBRTtJQUM1QyxlQUFlO0FBQ2pCLENBQUM7QUFFRCxPQUFPLFNBQVMsZ0JBQWdCLEtBQWEsRUFBRSxPQUFZLEVBQUUsUUFBYSxFQUFFO0lBQzFFLGVBQWU7QUFDakIsQ0FBQztBQUVELE9BQU8sU0FBUyxjQUFjLFFBQWEsRUFBRTtJQUMzQyxlQUFlO0FBQ2pCLENBQUM7QUFFRCxlQUFlO0lBQ2I7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0FBQ0YsRUFBRSJ9