// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/** Platform-specific conventions for the line ending format (i.e., the "end-of-line"). */ export var EOL;
(function(EOL) {
    EOL[/** Line Feed. Typically used in Unix (and Unix-like) systems. */ "LF"] = "\n";
    EOL[/** Carriage Return + Line Feed. Historically used in Windows and early DOS systems. */ "CRLF"] = "\r\n";
})(EOL || (EOL = {}));
const regDetect = /(?:\r?\n)/g;
/**
 * Detect the EOL character for string input.
 * returns null if no newline.
 *
 * @example
 * ```ts
 * import { detect, EOL } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * const CRLFinput = "deno\r\nis not\r\nnode";
 * const Mixedinput = "deno\nis not\r\nnode";
 * const LFinput = "deno\nis not\nnode";
 * const NoNLinput = "deno is not node";
 *
 * detect(LFinput); // output EOL.LF
 * detect(CRLFinput); // output EOL.CRLF
 * detect(Mixedinput); // output EOL.CRLF
 * detect(NoNLinput); // output null
 * ```
 */ export function detect(content) {
    const d = content.match(regDetect);
    if (!d || d.length === 0) {
        return null;
    }
    const hasCRLF = d.some((x)=>x === EOL.CRLF);
    return hasCRLF ? EOL.CRLF : EOL.LF;
}
/**
 * Format the file to the targeted EOL.
 *
 * @example
 * ```ts
 * import { EOL, format } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * const CRLFinput = "deno\r\nis not\r\nnode";
 *
 * format(CRLFinput, EOL.LF); // output "deno\nis not\nnode"
 * ```
 */ export function format(content, eol) {
    return content.replace(regDetect, eol);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2ZzL2VvbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vKiogUGxhdGZvcm0tc3BlY2lmaWMgY29udmVudGlvbnMgZm9yIHRoZSBsaW5lIGVuZGluZyBmb3JtYXQgKGkuZS4sIHRoZSBcImVuZC1vZi1saW5lXCIpLiAqL1xuZXhwb3J0IGVudW0gRU9MIHtcbiAgLyoqIExpbmUgRmVlZC4gVHlwaWNhbGx5IHVzZWQgaW4gVW5peCAoYW5kIFVuaXgtbGlrZSkgc3lzdGVtcy4gKi9cbiAgTEYgPSBcIlxcblwiLFxuICAvKiogQ2FycmlhZ2UgUmV0dXJuICsgTGluZSBGZWVkLiBIaXN0b3JpY2FsbHkgdXNlZCBpbiBXaW5kb3dzIGFuZCBlYXJseSBET1Mgc3lzdGVtcy4gKi9cbiAgQ1JMRiA9IFwiXFxyXFxuXCIsXG59XG5cbmNvbnN0IHJlZ0RldGVjdCA9IC8oPzpcXHI/XFxuKS9nO1xuXG4vKipcbiAqIERldGVjdCB0aGUgRU9MIGNoYXJhY3RlciBmb3Igc3RyaW5nIGlucHV0LlxuICogcmV0dXJucyBudWxsIGlmIG5vIG5ld2xpbmUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBkZXRlY3QsIEVPTCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2ZzL21vZC50c1wiO1xuICpcbiAqIGNvbnN0IENSTEZpbnB1dCA9IFwiZGVub1xcclxcbmlzIG5vdFxcclxcbm5vZGVcIjtcbiAqIGNvbnN0IE1peGVkaW5wdXQgPSBcImRlbm9cXG5pcyBub3RcXHJcXG5ub2RlXCI7XG4gKiBjb25zdCBMRmlucHV0ID0gXCJkZW5vXFxuaXMgbm90XFxubm9kZVwiO1xuICogY29uc3QgTm9OTGlucHV0ID0gXCJkZW5vIGlzIG5vdCBub2RlXCI7XG4gKlxuICogZGV0ZWN0KExGaW5wdXQpOyAvLyBvdXRwdXQgRU9MLkxGXG4gKiBkZXRlY3QoQ1JMRmlucHV0KTsgLy8gb3V0cHV0IEVPTC5DUkxGXG4gKiBkZXRlY3QoTWl4ZWRpbnB1dCk7IC8vIG91dHB1dCBFT0wuQ1JMRlxuICogZGV0ZWN0KE5vTkxpbnB1dCk7IC8vIG91dHB1dCBudWxsXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdChjb250ZW50OiBzdHJpbmcpOiBFT0wgfCBudWxsIHtcbiAgY29uc3QgZCA9IGNvbnRlbnQubWF0Y2gocmVnRGV0ZWN0KTtcbiAgaWYgKCFkIHx8IGQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgaGFzQ1JMRiA9IGQuc29tZSgoeDogc3RyaW5nKTogYm9vbGVhbiA9PiB4ID09PSBFT0wuQ1JMRik7XG5cbiAgcmV0dXJuIGhhc0NSTEYgPyBFT0wuQ1JMRiA6IEVPTC5MRjtcbn1cblxuLyoqXG4gKiBGb3JtYXQgdGhlIGZpbGUgdG8gdGhlIHRhcmdldGVkIEVPTC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IEVPTCwgZm9ybWF0IH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vZnMvbW9kLnRzXCI7XG4gKlxuICogY29uc3QgQ1JMRmlucHV0ID0gXCJkZW5vXFxyXFxuaXMgbm90XFxyXFxubm9kZVwiO1xuICpcbiAqIGZvcm1hdChDUkxGaW5wdXQsIEVPTC5MRik7IC8vIG91dHB1dCBcImRlbm9cXG5pcyBub3RcXG5ub2RlXCJcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0KGNvbnRlbnQ6IHN0cmluZywgZW9sOiBFT0wpOiBzdHJpbmcge1xuICByZXR1cm4gY29udGVudC5yZXBsYWNlKHJlZ0RldGVjdCwgZW9sKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLHdGQUF3RixHQUN4RixXQUFPO1VBQUssR0FBRztJQUFILElBQ1YsK0RBQStELEdBQy9ELFFBQUs7SUFGSyxJQUdWLHFGQUFxRixHQUNyRixVQUFPO0dBSkcsUUFBQTtBQU9aLE1BQU0sWUFBWTtBQUVsQjs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBa0JDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sT0FBZSxFQUFjO0lBQ2xELE1BQU0sSUFBSSxRQUFRLEtBQUssQ0FBQztJQUN4QixJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sS0FBSyxHQUFHO1FBQ3hCLE9BQU8sSUFBSTtJQUNiLENBQUM7SUFDRCxNQUFNLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUF1QixNQUFNLElBQUksSUFBSTtJQUU3RCxPQUFPLFVBQVUsSUFBSSxJQUFJLEdBQUcsSUFBSSxFQUFFO0FBQ3BDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Q0FXQyxHQUNELE9BQU8sU0FBUyxPQUFPLE9BQWUsRUFBRSxHQUFRLEVBQVU7SUFDeEQsT0FBTyxRQUFRLE9BQU8sQ0FBQyxXQUFXO0FBQ3BDLENBQUMifQ==