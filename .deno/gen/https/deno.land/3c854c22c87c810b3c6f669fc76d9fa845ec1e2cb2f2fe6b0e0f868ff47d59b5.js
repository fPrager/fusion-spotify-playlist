// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
const tokenRegExp = /^[\^_`a-zA-Z\-0-9!#$%&'*+.|~]+$/;
/**
 * Verifies that the given val is a valid HTTP token
 * per the rules defined in RFC 7230
 * See https://tools.ietf.org/html/rfc7230#section-3.2.6
 */ function checkIsHttpToken(val) {
    return tokenRegExp.test(val);
}
const headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/;
/**
 * True if val contains an invalid field-vchar
 *  field-value    = *( field-content / obs-fold )
 *  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 *  field-vchar    = VCHAR / obs-text
 */ function checkInvalidHeaderChar(val) {
    return headerCharRegex.test(val);
}
export const chunkExpression = /(?:^|\W)chunked(?:$|\W)/i;
export { checkInvalidHeaderChar as _checkInvalidHeaderChar, checkIsHttpToken as _checkIsHttpToken };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2h0dHBfY29tbW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50IGFuZCBOb2RlIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmNvbnN0IHRva2VuUmVnRXhwID0gL15bXFxeX2BhLXpBLVpcXC0wLTkhIyQlJicqKy58fl0rJC87XG4vKipcbiAqIFZlcmlmaWVzIHRoYXQgdGhlIGdpdmVuIHZhbCBpcyBhIHZhbGlkIEhUVFAgdG9rZW5cbiAqIHBlciB0aGUgcnVsZXMgZGVmaW5lZCBpbiBSRkMgNzIzMFxuICogU2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3MjMwI3NlY3Rpb24tMy4yLjZcbiAqL1xuZnVuY3Rpb24gY2hlY2tJc0h0dHBUb2tlbih2YWw6IHN0cmluZykge1xuICByZXR1cm4gdG9rZW5SZWdFeHAudGVzdCh2YWwpO1xufVxuXG5jb25zdCBoZWFkZXJDaGFyUmVnZXggPSAvW15cXHRcXHgyMC1cXHg3ZVxceDgwLVxceGZmXS87XG4vKipcbiAqIFRydWUgaWYgdmFsIGNvbnRhaW5zIGFuIGludmFsaWQgZmllbGQtdmNoYXJcbiAqICBmaWVsZC12YWx1ZSAgICA9ICooIGZpZWxkLWNvbnRlbnQgLyBvYnMtZm9sZCApXG4gKiAgZmllbGQtY29udGVudCAgPSBmaWVsZC12Y2hhciBbIDEqKCBTUCAvIEhUQUIgKSBmaWVsZC12Y2hhciBdXG4gKiAgZmllbGQtdmNoYXIgICAgPSBWQ0hBUiAvIG9icy10ZXh0XG4gKi9cbmZ1bmN0aW9uIGNoZWNrSW52YWxpZEhlYWRlckNoYXIodmFsOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGhlYWRlckNoYXJSZWdleC50ZXN0KHZhbCk7XG59XG5cbmV4cG9ydCBjb25zdCBjaHVua0V4cHJlc3Npb24gPSAvKD86XnxcXFcpY2h1bmtlZCg/OiR8XFxXKS9pO1xuZXhwb3J0IHtcbiAgY2hlY2tJbnZhbGlkSGVhZGVyQ2hhciBhcyBfY2hlY2tJbnZhbGlkSGVhZGVyQ2hhcixcbiAgY2hlY2tJc0h0dHBUb2tlbiBhcyBfY2hlY2tJc0h0dHBUb2tlbixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUU1RSxNQUFNLGNBQWM7QUFDcEI7Ozs7Q0FJQyxHQUNELFNBQVMsaUJBQWlCLEdBQVcsRUFBRTtJQUNyQyxPQUFPLFlBQVksSUFBSSxDQUFDO0FBQzFCO0FBRUEsTUFBTSxrQkFBa0I7QUFDeEI7Ozs7O0NBS0MsR0FDRCxTQUFTLHVCQUF1QixHQUFXLEVBQUU7SUFDM0MsT0FBTyxnQkFBZ0IsSUFBSSxDQUFDO0FBQzlCO0FBRUEsT0FBTyxNQUFNLGtCQUFrQiwyQkFBMkI7QUFDMUQsU0FDRSwwQkFBMEIsdUJBQXVCLEVBQ2pELG9CQUFvQixpQkFBaUIsR0FDckMifQ==