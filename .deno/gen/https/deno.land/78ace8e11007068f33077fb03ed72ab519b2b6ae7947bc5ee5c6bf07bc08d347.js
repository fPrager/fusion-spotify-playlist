// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
import { ERR_INVALID_ARG_TYPE } from "../errors.ts";
import { isArrayBufferView } from "../util/types.ts";
import { notImplemented } from "../../_utils.ts";
export class X509Certificate {
    constructor(buffer){
        if (typeof buffer === "string") {
            buffer = Buffer.from(buffer);
        }
        if (!isArrayBufferView(buffer)) {
            throw new ERR_INVALID_ARG_TYPE("buffer", [
                "string",
                "Buffer",
                "TypedArray",
                "DataView"
            ], buffer);
        }
        notImplemented("crypto.X509Certificate");
    }
    get ca() {
        notImplemented("crypto.X509Certificate.prototype.ca");
        return false;
    }
    checkEmail(_email, _options) {
        notImplemented("crypto.X509Certificate.prototype.checkEmail");
    }
    checkHost(_name, _options) {
        notImplemented("crypto.X509Certificate.prototype.checkHost");
    }
    checkIP(_ip) {
        notImplemented("crypto.X509Certificate.prototype.checkIP");
    }
    checkIssued(_otherCert) {
        notImplemented("crypto.X509Certificate.prototype.checkIssued");
    }
    checkPrivateKey(_privateKey) {
        notImplemented("crypto.X509Certificate.prototype.checkPrivateKey");
    }
    get fingerprint() {
        notImplemented("crypto.X509Certificate.prototype.fingerprint");
        return "";
    }
    get fingerprint256() {
        notImplemented("crypto.X509Certificate.prototype.fingerprint256");
        return "";
    }
    get fingerprint512() {
        notImplemented("crypto.X509Certificate.prototype.fingerprint512");
        return "";
    }
    get infoAccess() {
        notImplemented("crypto.X509Certificate.prototype.infoAccess");
        return "";
    }
    get issuer() {
        notImplemented("crypto.X509Certificate.prototype.issuer");
        return "";
    }
    get issuerCertificate() {
        notImplemented("crypto.X509Certificate.prototype.issuerCertificate");
        return {};
    }
    get keyUsage() {
        notImplemented("crypto.X509Certificate.prototype.keyUsage");
        return [];
    }
    get publicKey() {
        notImplemented("crypto.X509Certificate.prototype.publicKey");
        return {};
    }
    get raw() {
        notImplemented("crypto.X509Certificate.prototype.raw");
        return {};
    }
    get serialNumber() {
        notImplemented("crypto.X509Certificate.prototype.serialNumber");
        return "";
    }
    get subject() {
        notImplemented("crypto.X509Certificate.prototype.subject");
        return "";
    }
    get subjectAltName() {
        notImplemented("crypto.X509Certificate.prototype.subjectAltName");
        return "";
    }
    toJSON() {
        return this.toString();
    }
    toLegacyObject() {
        notImplemented("crypto.X509Certificate.prototype.toLegacyObject");
    }
    toString() {
        notImplemented("crypto.X509Certificate.prototype.toString");
    }
    get validFrom() {
        notImplemented("crypto.X509Certificate.prototype.validFrom");
        return "";
    }
    get validTo() {
        notImplemented("crypto.X509Certificate.prototype.validTo");
        return "";
    }
    verify(_publicKey) {
        notImplemented("crypto.X509Certificate.prototype.verify");
    }
}
export default {
    X509Certificate
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL3g1MDkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIE5vZGUuanMgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgS2V5T2JqZWN0IH0gZnJvbSBcIi4va2V5cy50c1wiO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgRVJSX0lOVkFMSURfQVJHX1RZUEUgfSBmcm9tIFwiLi4vZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBpc0FycmF5QnVmZmVyVmlldyB9IGZyb20gXCIuLi91dGlsL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuLi8uLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IEJpbmFyeUxpa2UgfSBmcm9tIFwiLi90eXBlcy50c1wiO1xuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IHR5cGUgUGVlckNlcnRpZmljYXRlID0gYW55O1xuXG5leHBvcnQgaW50ZXJmYWNlIFg1MDlDaGVja09wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgJ2Fsd2F5cydcbiAgICovXG4gIHN1YmplY3Q6IFwiYWx3YXlzXCIgfCBcIm5ldmVyXCI7XG4gIC8qKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICB3aWxkY2FyZHM6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBwYXJ0aWFsV2lsZGNhcmRzOiBib29sZWFuO1xuICAvKipcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIG11bHRpTGFiZWxXaWxkY2FyZHM6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgc2luZ2xlTGFiZWxTdWJkb21haW5zOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgWDUwOUNlcnRpZmljYXRlIHtcbiAgY29uc3RydWN0b3IoYnVmZmVyOiBCaW5hcnlMaWtlKSB7XG4gICAgaWYgKHR5cGVvZiBidWZmZXIgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGJ1ZmZlciA9IEJ1ZmZlci5mcm9tKGJ1ZmZlcik7XG4gICAgfVxuXG4gICAgaWYgKCFpc0FycmF5QnVmZmVyVmlldyhidWZmZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1RZUEUoXG4gICAgICAgIFwiYnVmZmVyXCIsXG4gICAgICAgIFtcInN0cmluZ1wiLCBcIkJ1ZmZlclwiLCBcIlR5cGVkQXJyYXlcIiwgXCJEYXRhVmlld1wiXSxcbiAgICAgICAgYnVmZmVyLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGVcIik7XG4gIH1cblxuICBnZXQgY2EoKTogYm9vbGVhbiB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5jYVwiKTtcblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNoZWNrRW1haWwoXG4gICAgX2VtYWlsOiBzdHJpbmcsXG4gICAgX29wdGlvbnM/OiBQaWNrPFg1MDlDaGVja09wdGlvbnMsIFwic3ViamVjdFwiPixcbiAgKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLmNoZWNrRW1haWxcIik7XG4gIH1cblxuICBjaGVja0hvc3QoX25hbWU6IHN0cmluZywgX29wdGlvbnM/OiBYNTA5Q2hlY2tPcHRpb25zKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLmNoZWNrSG9zdFwiKTtcbiAgfVxuXG4gIGNoZWNrSVAoX2lwOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUuY2hlY2tJUFwiKTtcbiAgfVxuXG4gIGNoZWNrSXNzdWVkKF9vdGhlckNlcnQ6IFg1MDlDZXJ0aWZpY2F0ZSk6IGJvb2xlYW4ge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUuY2hlY2tJc3N1ZWRcIik7XG4gIH1cblxuICBjaGVja1ByaXZhdGVLZXkoX3ByaXZhdGVLZXk6IEtleU9iamVjdCk6IGJvb2xlYW4ge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUuY2hlY2tQcml2YXRlS2V5XCIpO1xuICB9XG5cbiAgZ2V0IGZpbmdlcnByaW50KCk6IHN0cmluZyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5maW5nZXJwcmludFwiKTtcblxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgZ2V0IGZpbmdlcnByaW50MjU2KCk6IHN0cmluZyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5maW5nZXJwcmludDI1NlwiKTtcblxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgZ2V0IGZpbmdlcnByaW50NTEyKCk6IHN0cmluZyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5maW5nZXJwcmludDUxMlwiKTtcblxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgZ2V0IGluZm9BY2Nlc3MoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLmluZm9BY2Nlc3NcIik7XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGdldCBpc3N1ZXIoKTogc3RyaW5nIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLmlzc3VlclwiKTtcblxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgZ2V0IGlzc3VlckNlcnRpZmljYXRlKCk6IFg1MDlDZXJ0aWZpY2F0ZSB8IHVuZGVmaW5lZCB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5pc3N1ZXJDZXJ0aWZpY2F0ZVwiKTtcblxuICAgIHJldHVybiB7fSBhcyBYNTA5Q2VydGlmaWNhdGU7XG4gIH1cblxuICBnZXQga2V5VXNhZ2UoKTogc3RyaW5nW10ge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUua2V5VXNhZ2VcIik7XG5cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBnZXQgcHVibGljS2V5KCk6IEtleU9iamVjdCB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS5wdWJsaWNLZXlcIik7XG5cbiAgICByZXR1cm4ge30gYXMgS2V5T2JqZWN0O1xuICB9XG5cbiAgZ2V0IHJhdygpOiBCdWZmZXIge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUucmF3XCIpO1xuXG4gICAgcmV0dXJuIHt9IGFzIEJ1ZmZlcjtcbiAgfVxuXG4gIGdldCBzZXJpYWxOdW1iZXIoKTogc3RyaW5nIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLnNlcmlhbE51bWJlclwiKTtcblxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgZ2V0IHN1YmplY3QoKTogc3RyaW5nIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5YNTA5Q2VydGlmaWNhdGUucHJvdG90eXBlLnN1YmplY3RcIik7XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGdldCBzdWJqZWN0QWx0TmFtZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUuc3ViamVjdEFsdE5hbWVcIik7XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIHRvSlNPTigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKCk7XG4gIH1cblxuICB0b0xlZ2FjeU9iamVjdCgpOiBQZWVyQ2VydGlmaWNhdGUge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUudG9MZWdhY3lPYmplY3RcIik7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlg1MDlDZXJ0aWZpY2F0ZS5wcm90b3R5cGUudG9TdHJpbmdcIik7XG4gIH1cblxuICBnZXQgdmFsaWRGcm9tKCk6IHN0cmluZyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS52YWxpZEZyb21cIik7XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGdldCB2YWxpZFRvKCk6IHN0cmluZyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS52YWxpZFRvXCIpO1xuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICB2ZXJpZnkoX3B1YmxpY0tleTogS2V5T2JqZWN0KTogYm9vbGVhbiB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uWDUwOUNlcnRpZmljYXRlLnByb3RvdHlwZS52ZXJpZnlcIik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBYNTA5Q2VydGlmaWNhdGUsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxRkFBcUY7QUFHckYsU0FBUyxNQUFNLFFBQVEsa0JBQWtCO0FBQ3pDLFNBQVMsb0JBQW9CLFFBQVEsZUFBZTtBQUNwRCxTQUFTLGlCQUFpQixRQUFRLG1CQUFtQjtBQUNyRCxTQUFTLGNBQWMsUUFBUSxrQkFBa0I7QUE2QmpELE9BQU8sTUFBTTtJQUNYLFlBQVksTUFBa0IsQ0FBRTtRQUM5QixJQUFJLE9BQU8sV0FBVyxVQUFVO1lBQzlCLFNBQVMsT0FBTyxJQUFJLENBQUM7UUFDdkIsQ0FBQztRQUVELElBQUksQ0FBQyxrQkFBa0IsU0FBUztZQUM5QixNQUFNLElBQUkscUJBQ1IsVUFDQTtnQkFBQztnQkFBVTtnQkFBVTtnQkFBYzthQUFXLEVBQzlDLFFBQ0E7UUFDSixDQUFDO1FBRUQsZUFBZTtJQUNqQjtJQUVBLElBQUksS0FBYztRQUNoQixlQUFlO1FBRWYsT0FBTyxLQUFLO0lBQ2Q7SUFFQSxXQUNFLE1BQWMsRUFDZCxRQUE0QyxFQUN4QjtRQUNwQixlQUFlO0lBQ2pCO0lBRUEsVUFBVSxLQUFhLEVBQUUsUUFBMkIsRUFBc0I7UUFDeEUsZUFBZTtJQUNqQjtJQUVBLFFBQVEsR0FBVyxFQUFzQjtRQUN2QyxlQUFlO0lBQ2pCO0lBRUEsWUFBWSxVQUEyQixFQUFXO1FBQ2hELGVBQWU7SUFDakI7SUFFQSxnQkFBZ0IsV0FBc0IsRUFBVztRQUMvQyxlQUFlO0lBQ2pCO0lBRUEsSUFBSSxjQUFzQjtRQUN4QixlQUFlO1FBRWYsT0FBTztJQUNUO0lBRUEsSUFBSSxpQkFBeUI7UUFDM0IsZUFBZTtRQUVmLE9BQU87SUFDVDtJQUVBLElBQUksaUJBQXlCO1FBQzNCLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxJQUFJLGFBQWlDO1FBQ25DLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxJQUFJLFNBQWlCO1FBQ25CLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxJQUFJLG9CQUFpRDtRQUNuRCxlQUFlO1FBRWYsT0FBTyxDQUFDO0lBQ1Y7SUFFQSxJQUFJLFdBQXFCO1FBQ3ZCLGVBQWU7UUFFZixPQUFPLEVBQUU7SUFDWDtJQUVBLElBQUksWUFBdUI7UUFDekIsZUFBZTtRQUVmLE9BQU8sQ0FBQztJQUNWO0lBRUEsSUFBSSxNQUFjO1FBQ2hCLGVBQWU7UUFFZixPQUFPLENBQUM7SUFDVjtJQUVBLElBQUksZUFBdUI7UUFDekIsZUFBZTtRQUVmLE9BQU87SUFDVDtJQUVBLElBQUksVUFBa0I7UUFDcEIsZUFBZTtRQUVmLE9BQU87SUFDVDtJQUVBLElBQUksaUJBQXFDO1FBQ3ZDLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxTQUFpQjtRQUNmLE9BQU8sSUFBSSxDQUFDLFFBQVE7SUFDdEI7SUFFQSxpQkFBa0M7UUFDaEMsZUFBZTtJQUNqQjtJQUVBLFdBQW1CO1FBQ2pCLGVBQWU7SUFDakI7SUFFQSxJQUFJLFlBQW9CO1FBQ3RCLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxJQUFJLFVBQWtCO1FBQ3BCLGVBQWU7UUFFZixPQUFPO0lBQ1Q7SUFFQSxPQUFPLFVBQXFCLEVBQVc7UUFDckMsZUFBZTtJQUNqQjtBQUNGLENBQUM7QUFFRCxlQUFlO0lBQ2I7QUFDRixFQUFFIn0=