// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
// This module ports:
// - https://github.com/nodejs/node/blob/master/src/uv.cc
// - https://github.com/nodejs/node/blob/master/deps/uv
//
// See also: http://docs.libuv.org/en/v1.x/errors.html#error-constants
import { unreachable } from "../../_util/asserts.ts";
import { osType } from "../../_util/os.ts";
import { uvTranslateSysError } from "./_libuv_winerror.ts";
const codeToErrorWindows = [
    [
        -4093,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -4092,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -4091,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -4090,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -4089,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -4088,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -4084,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -4083,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -4082,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -4081,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -4079,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -4078,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -4077,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -4076,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -4075,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -4074,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -4036,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -4073,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4072,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -4071,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -4070,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -4069,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -4068,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -4067,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -4066,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -4065,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -4064,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -4063,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -4062,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -4061,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -4060,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -4059,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -4058,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -4057,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -4056,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -4035,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -4055,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -4054,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -4053,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -4052,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -4051,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -4050,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -4049,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -4048,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -4047,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -4046,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -4045,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -4044,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -4034,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -4043,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -4042,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -4041,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -4040,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -4039,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -4038,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -4037,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -4033,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -4032,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -4031,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -4030,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -4029,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -4028,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -4027,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const errorToCodeWindows = codeToErrorWindows.map(([status, [error]])=>[
        error,
        status
    ]);
const codeToErrorDarwin = [
    [
        -7,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -13,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -48,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -49,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -47,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -35,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -37,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -9,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -16,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -89,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -53,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -61,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -54,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -39,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -17,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -14,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -27,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -65,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -22,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -5,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -56,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -21,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -62,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -24,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -40,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -63,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -50,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -51,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -23,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -55,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -19,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -2,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -12,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -4056,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -42,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -28,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -78,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -57,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -20,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -66,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -38,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -45,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -1,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -32,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -100,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -43,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -41,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -34,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -30,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -58,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -29,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -3,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -60,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -26,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -18,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -6,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -31,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -64,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -4030,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -25,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -79,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -92,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const errorToCodeDarwin = codeToErrorDarwin.map(([status, [code]])=>[
        code,
        status
    ]);
const codeToErrorLinux = [
    [
        -7,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -13,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -98,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -99,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -97,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -11,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -114,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -9,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -16,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -125,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -103,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -111,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -104,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -89,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -17,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -14,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -27,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -113,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -22,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -5,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -106,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -21,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -40,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -24,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -90,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -36,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -100,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -101,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -23,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -105,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -19,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -2,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -12,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -64,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -92,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -28,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -38,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -107,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -20,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -39,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -88,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -95,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -1,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -32,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -71,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -93,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -91,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -34,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -30,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -108,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -29,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -3,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -110,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -26,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -18,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -6,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -31,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -112,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -121,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -25,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -4028,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -84,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const errorToCodeLinux = codeToErrorLinux.map(([status, [code]])=>[
        code,
        status
    ]);
const codeToErrorFreebsd = [
    [
        -7,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -13,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -48,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -49,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -47,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -35,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -37,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -9,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -16,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -85,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -53,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -61,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -54,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -39,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -17,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -14,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -27,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -65,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -22,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -5,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -56,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -21,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -62,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -24,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -40,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -63,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -50,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -51,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -23,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -55,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -19,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -2,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -12,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -4056,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -42,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -28,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -78,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -57,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -20,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -66,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -38,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -45,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -84,
        [
            "EOVERFLOW",
            "value too large for defined data type"
        ]
    ],
    [
        -1,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -32,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -92,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -43,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -41,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -34,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -30,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -58,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -29,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -3,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -60,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -26,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -18,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -6,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -31,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -64,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -4030,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -25,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -79,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -86,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ],
    [
        -44,
        [
            "ESOCKTNOSUPPORT",
            "socket type not supported"
        ]
    ]
];
const errorToCodeFreebsd = codeToErrorFreebsd.map(([status, [code]])=>[
        code,
        status
    ]);
export const errorMap = new Map(osType === "windows" ? codeToErrorWindows : osType === "darwin" ? codeToErrorDarwin : osType === "linux" ? codeToErrorLinux : osType === "freebsd" ? codeToErrorFreebsd : unreachable());
export const codeMap = new Map(osType === "windows" ? errorToCodeWindows : osType === "darwin" ? errorToCodeDarwin : osType === "linux" ? errorToCodeLinux : osType === "freebsd" ? errorToCodeFreebsd : unreachable());
export function mapSysErrnoToUvErrno(sysErrno) {
    if (osType === "windows") {
        const code = uvTranslateSysError(sysErrno);
        return codeMap.get(code) ?? -sysErrno;
    } else {
        return -sysErrno;
    }
}
export const UV_EAI_MEMORY = codeMap.get("EAI_MEMORY");
export const UV_EBADF = codeMap.get("EBADF");
export const UV_EEXIST = codeMap.get("EEXIST");
export const UV_EINVAL = codeMap.get("EINVAL");
export const UV_ENOENT = codeMap.get("ENOENT");
export const UV_ENOTSOCK = codeMap.get("ENOTSOCK");
export const UV_UNKNOWN = codeMap.get("UNKNOWN");
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWxfYmluZGluZy91di50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIFRoaXMgbW9kdWxlIHBvcnRzOlxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3V2LmNjXG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9kZXBzL3V2XG4vL1xuLy8gU2VlIGFsc286IGh0dHA6Ly9kb2NzLmxpYnV2Lm9yZy9lbi92MS54L2Vycm9ycy5odG1sI2Vycm9yLWNvbnN0YW50c1xuXG5pbXBvcnQgeyB1bnJlYWNoYWJsZSB9IGZyb20gXCIuLi8uLi9fdXRpbC9hc3NlcnRzLnRzXCI7XG5pbXBvcnQgeyBvc1R5cGUgfSBmcm9tIFwiLi4vLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCB7IHV2VHJhbnNsYXRlU3lzRXJyb3IgfSBmcm9tIFwiLi9fbGlidXZfd2luZXJyb3IudHNcIjtcblxuLy8gSW4gTm9kZSB0aGVzZSB2YWx1ZXMgYXJlIGNvbWluZyBmcm9tIGxpYnV2OlxuLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vbGlidXYvbGlidXYvYmxvYi92MS54L2luY2x1ZGUvdXYvZXJybm8uaFxuLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi81MjQxMjNmYmYwNjRmZjY0YmI2ZmNkODM0ODVjZmMyN2RiOTMyZjY4L2xpYi9pbnRlcm5hbC9lcnJvcnMuanMjTDM4M1xuLy8gU2luY2UgdGhlcmUgaXMgbm8gZWFzeSB3YXkgdG8gcG9ydCBjb2RlIGZyb20gbGlidXYgYW5kIHRoZXNlIG1hcHMgYXJlXG4vLyBjaGFuZ2luZyB2ZXJ5IHJhcmVseSwgd2Ugc2ltcGx5IGV4dHJhY3QgdGhlbSBmcm9tIE5vZGUgYW5kIHN0b3JlIGhlcmUuXG5cbi8vIE5vdGVcbi8vIFJ1biB0aGUgZm9sbG93aW5nIHRvIGdldCB0aGUgbWFwOlxuLy8gJCBub2RlIC1lIFwiY29uc29sZS5sb2cocHJvY2Vzcy5iaW5kaW5nKCd1dicpLmdldEVycm9yTWFwKCkpXCJcbi8vIFRoaXMgc2V0dXAgYXV0b21hdGljYWxseSBleHBvcnRzIG1hcHMgZnJvbSBib3RoIFwid2luXCIsIFwibGludXhcIiAmIGRhcndpbjpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zY2h3YXJ6a29wZmIvbm9kZV9lcnJub19tYXBcblxudHlwZSBFcnJvck1hcERhdGEgPSBBcnJheTxbbnVtYmVyLCBbc3RyaW5nLCBzdHJpbmddXT47XG50eXBlIENvZGVNYXBEYXRhID0gQXJyYXk8W3N0cmluZywgbnVtYmVyXT47XG5cbmNvbnN0IGNvZGVUb0Vycm9yV2luZG93czogRXJyb3JNYXBEYXRhID0gW1xuICBbLTQwOTMsIFtcIkUyQklHXCIsIFwiYXJndW1lbnQgbGlzdCB0b28gbG9uZ1wiXV0sXG4gIFstNDA5MiwgW1wiRUFDQ0VTXCIsIFwicGVybWlzc2lvbiBkZW5pZWRcIl1dLFxuICBbLTQwOTEsIFtcIkVBRERSSU5VU0VcIiwgXCJhZGRyZXNzIGFscmVhZHkgaW4gdXNlXCJdXSxcbiAgWy00MDkwLCBbXCJFQUREUk5PVEFWQUlMXCIsIFwiYWRkcmVzcyBub3QgYXZhaWxhYmxlXCJdXSxcbiAgWy00MDg5LCBbXCJFQUZOT1NVUFBPUlRcIiwgXCJhZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy00MDg4LCBbXCJFQUdBSU5cIiwgXCJyZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZVwiXV0sXG4gIFstMzAwMCwgW1wiRUFJX0FERFJGQU1JTFlcIiwgXCJhZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zMDAxLCBbXCJFQUlfQUdBSU5cIiwgXCJ0ZW1wb3JhcnkgZmFpbHVyZVwiXV0sXG4gIFstMzAwMiwgW1wiRUFJX0JBREZMQUdTXCIsIFwiYmFkIGFpX2ZsYWdzIHZhbHVlXCJdXSxcbiAgWy0zMDEzLCBbXCJFQUlfQkFESElOVFNcIiwgXCJpbnZhbGlkIHZhbHVlIGZvciBoaW50c1wiXV0sXG4gIFstMzAwMywgW1wiRUFJX0NBTkNFTEVEXCIsIFwicmVxdWVzdCBjYW5jZWxlZFwiXV0sXG4gIFstMzAwNCwgW1wiRUFJX0ZBSUxcIiwgXCJwZXJtYW5lbnQgZmFpbHVyZVwiXV0sXG4gIFstMzAwNSwgW1wiRUFJX0ZBTUlMWVwiLCBcImFpX2ZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zMDA2LCBbXCJFQUlfTUVNT1JZXCIsIFwib3V0IG9mIG1lbW9yeVwiXV0sXG4gIFstMzAwNywgW1wiRUFJX05PREFUQVwiLCBcIm5vIGFkZHJlc3NcIl1dLFxuICBbLTMwMDgsIFtcIkVBSV9OT05BTUVcIiwgXCJ1bmtub3duIG5vZGUgb3Igc2VydmljZVwiXV0sXG4gIFstMzAwOSwgW1wiRUFJX09WRVJGTE9XXCIsIFwiYXJndW1lbnQgYnVmZmVyIG92ZXJmbG93XCJdXSxcbiAgWy0zMDE0LCBbXCJFQUlfUFJPVE9DT0xcIiwgXCJyZXNvbHZlZCBwcm90b2NvbCBpcyB1bmtub3duXCJdXSxcbiAgWy0zMDEwLCBbXCJFQUlfU0VSVklDRVwiLCBcInNlcnZpY2Ugbm90IGF2YWlsYWJsZSBmb3Igc29ja2V0IHR5cGVcIl1dLFxuICBbLTMwMTEsIFtcIkVBSV9TT0NLVFlQRVwiLCBcInNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTQwODQsIFtcIkVBTFJFQURZXCIsIFwiY29ubmVjdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzXCJdXSxcbiAgWy00MDgzLCBbXCJFQkFERlwiLCBcImJhZCBmaWxlIGRlc2NyaXB0b3JcIl1dLFxuICBbLTQwODIsIFtcIkVCVVNZXCIsIFwicmVzb3VyY2UgYnVzeSBvciBsb2NrZWRcIl1dLFxuICBbLTQwODEsIFtcIkVDQU5DRUxFRFwiLCBcIm9wZXJhdGlvbiBjYW5jZWxlZFwiXV0sXG4gIFstNDA4MCwgW1wiRUNIQVJTRVRcIiwgXCJpbnZhbGlkIFVuaWNvZGUgY2hhcmFjdGVyXCJdXSxcbiAgWy00MDc5LCBbXCJFQ09OTkFCT1JURURcIiwgXCJzb2Z0d2FyZSBjYXVzZWQgY29ubmVjdGlvbiBhYm9ydFwiXV0sXG4gIFstNDA3OCwgW1wiRUNPTk5SRUZVU0VEXCIsIFwiY29ubmVjdGlvbiByZWZ1c2VkXCJdXSxcbiAgWy00MDc3LCBbXCJFQ09OTlJFU0VUXCIsIFwiY29ubmVjdGlvbiByZXNldCBieSBwZWVyXCJdXSxcbiAgWy00MDc2LCBbXCJFREVTVEFERFJSRVFcIiwgXCJkZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkXCJdXSxcbiAgWy00MDc1LCBbXCJFRVhJU1RcIiwgXCJmaWxlIGFscmVhZHkgZXhpc3RzXCJdXSxcbiAgWy00MDc0LCBbXCJFRkFVTFRcIiwgXCJiYWQgYWRkcmVzcyBpbiBzeXN0ZW0gY2FsbCBhcmd1bWVudFwiXV0sXG4gIFstNDAzNiwgW1wiRUZCSUdcIiwgXCJmaWxlIHRvbyBsYXJnZVwiXV0sXG4gIFstNDA3MywgW1wiRUhPU1RVTlJFQUNIXCIsIFwiaG9zdCBpcyB1bnJlYWNoYWJsZVwiXV0sXG4gIFstNDA3MiwgW1wiRUlOVFJcIiwgXCJpbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbFwiXV0sXG4gIFstNDA3MSwgW1wiRUlOVkFMXCIsIFwiaW52YWxpZCBhcmd1bWVudFwiXV0sXG4gIFstNDA3MCwgW1wiRUlPXCIsIFwiaS9vIGVycm9yXCJdXSxcbiAgWy00MDY5LCBbXCJFSVNDT05OXCIsIFwic29ja2V0IGlzIGFscmVhZHkgY29ubmVjdGVkXCJdXSxcbiAgWy00MDY4LCBbXCJFSVNESVJcIiwgXCJpbGxlZ2FsIG9wZXJhdGlvbiBvbiBhIGRpcmVjdG9yeVwiXV0sXG4gIFstNDA2NywgW1wiRUxPT1BcIiwgXCJ0b28gbWFueSBzeW1ib2xpYyBsaW5rcyBlbmNvdW50ZXJlZFwiXV0sXG4gIFstNDA2NiwgW1wiRU1GSUxFXCIsIFwidG9vIG1hbnkgb3BlbiBmaWxlc1wiXV0sXG4gIFstNDA2NSwgW1wiRU1TR1NJWkVcIiwgXCJtZXNzYWdlIHRvbyBsb25nXCJdXSxcbiAgWy00MDY0LCBbXCJFTkFNRVRPT0xPTkdcIiwgXCJuYW1lIHRvbyBsb25nXCJdXSxcbiAgWy00MDYzLCBbXCJFTkVURE9XTlwiLCBcIm5ldHdvcmsgaXMgZG93blwiXV0sXG4gIFstNDA2MiwgW1wiRU5FVFVOUkVBQ0hcIiwgXCJuZXR3b3JrIGlzIHVucmVhY2hhYmxlXCJdXSxcbiAgWy00MDYxLCBbXCJFTkZJTEVcIiwgXCJmaWxlIHRhYmxlIG92ZXJmbG93XCJdXSxcbiAgWy00MDYwLCBbXCJFTk9CVUZTXCIsIFwibm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZVwiXV0sXG4gIFstNDA1OSwgW1wiRU5PREVWXCIsIFwibm8gc3VjaCBkZXZpY2VcIl1dLFxuICBbLTQwNTgsIFtcIkVOT0VOVFwiLCBcIm5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnlcIl1dLFxuICBbLTQwNTcsIFtcIkVOT01FTVwiLCBcIm5vdCBlbm91Z2ggbWVtb3J5XCJdXSxcbiAgWy00MDU2LCBbXCJFTk9ORVRcIiwgXCJtYWNoaW5lIGlzIG5vdCBvbiB0aGUgbmV0d29ya1wiXV0sXG4gIFstNDAzNSwgW1wiRU5PUFJPVE9PUFRcIiwgXCJwcm90b2NvbCBub3QgYXZhaWxhYmxlXCJdXSxcbiAgWy00MDU1LCBbXCJFTk9TUENcIiwgXCJubyBzcGFjZSBsZWZ0IG9uIGRldmljZVwiXV0sXG4gIFstNDA1NCwgW1wiRU5PU1lTXCIsIFwiZnVuY3Rpb24gbm90IGltcGxlbWVudGVkXCJdXSxcbiAgWy00MDUzLCBbXCJFTk9UQ09OTlwiLCBcInNvY2tldCBpcyBub3QgY29ubmVjdGVkXCJdXSxcbiAgWy00MDUyLCBbXCJFTk9URElSXCIsIFwibm90IGEgZGlyZWN0b3J5XCJdXSxcbiAgWy00MDUxLCBbXCJFTk9URU1QVFlcIiwgXCJkaXJlY3Rvcnkgbm90IGVtcHR5XCJdXSxcbiAgWy00MDUwLCBbXCJFTk9UU09DS1wiLCBcInNvY2tldCBvcGVyYXRpb24gb24gbm9uLXNvY2tldFwiXV0sXG4gIFstNDA0OSwgW1wiRU5PVFNVUFwiLCBcIm9wZXJhdGlvbiBub3Qgc3VwcG9ydGVkIG9uIHNvY2tldFwiXV0sXG4gIFstNDA0OCwgW1wiRVBFUk1cIiwgXCJvcGVyYXRpb24gbm90IHBlcm1pdHRlZFwiXV0sXG4gIFstNDA0NywgW1wiRVBJUEVcIiwgXCJicm9rZW4gcGlwZVwiXV0sXG4gIFstNDA0NiwgW1wiRVBST1RPXCIsIFwicHJvdG9jb2wgZXJyb3JcIl1dLFxuICBbLTQwNDUsIFtcIkVQUk9UT05PU1VQUE9SVFwiLCBcInByb3RvY29sIG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTQwNDQsIFtcIkVQUk9UT1RZUEVcIiwgXCJwcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXRcIl1dLFxuICBbLTQwMzQsIFtcIkVSQU5HRVwiLCBcInJlc3VsdCB0b28gbGFyZ2VcIl1dLFxuICBbLTQwNDMsIFtcIkVST0ZTXCIsIFwicmVhZC1vbmx5IGZpbGUgc3lzdGVtXCJdXSxcbiAgWy00MDQyLCBbXCJFU0hVVERPV05cIiwgXCJjYW5ub3Qgc2VuZCBhZnRlciB0cmFuc3BvcnQgZW5kcG9pbnQgc2h1dGRvd25cIl1dLFxuICBbLTQwNDEsIFtcIkVTUElQRVwiLCBcImludmFsaWQgc2Vla1wiXV0sXG4gIFstNDA0MCwgW1wiRVNSQ0hcIiwgXCJubyBzdWNoIHByb2Nlc3NcIl1dLFxuICBbLTQwMzksIFtcIkVUSU1FRE9VVFwiLCBcImNvbm5lY3Rpb24gdGltZWQgb3V0XCJdXSxcbiAgWy00MDM4LCBbXCJFVFhUQlNZXCIsIFwidGV4dCBmaWxlIGlzIGJ1c3lcIl1dLFxuICBbLTQwMzcsIFtcIkVYREVWXCIsIFwiY3Jvc3MtZGV2aWNlIGxpbmsgbm90IHBlcm1pdHRlZFwiXV0sXG4gIFstNDA5NCwgW1wiVU5LTk9XTlwiLCBcInVua25vd24gZXJyb3JcIl1dLFxuICBbLTQwOTUsIFtcIkVPRlwiLCBcImVuZCBvZiBmaWxlXCJdXSxcbiAgWy00MDMzLCBbXCJFTlhJT1wiLCBcIm5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3NcIl1dLFxuICBbLTQwMzIsIFtcIkVNTElOS1wiLCBcInRvbyBtYW55IGxpbmtzXCJdXSxcbiAgWy00MDMxLCBbXCJFSE9TVERPV05cIiwgXCJob3N0IGlzIGRvd25cIl1dLFxuICBbLTQwMzAsIFtcIkVSRU1PVEVJT1wiLCBcInJlbW90ZSBJL08gZXJyb3JcIl1dLFxuICBbLTQwMjksIFtcIkVOT1RUWVwiLCBcImluYXBwcm9wcmlhdGUgaW9jdGwgZm9yIGRldmljZVwiXV0sXG4gIFstNDAyOCwgW1wiRUZUWVBFXCIsIFwiaW5hcHByb3ByaWF0ZSBmaWxlIHR5cGUgb3IgZm9ybWF0XCJdXSxcbiAgWy00MDI3LCBbXCJFSUxTRVFcIiwgXCJpbGxlZ2FsIGJ5dGUgc2VxdWVuY2VcIl1dLFxuXTtcblxuY29uc3QgZXJyb3JUb0NvZGVXaW5kb3dzOiBDb2RlTWFwRGF0YSA9IGNvZGVUb0Vycm9yV2luZG93cy5tYXAoKFxuICBbc3RhdHVzLCBbZXJyb3JdXSxcbikgPT4gW2Vycm9yLCBzdGF0dXNdKTtcblxuY29uc3QgY29kZVRvRXJyb3JEYXJ3aW46IEVycm9yTWFwRGF0YSA9IFtcbiAgWy03LCBbXCJFMkJJR1wiLCBcImFyZ3VtZW50IGxpc3QgdG9vIGxvbmdcIl1dLFxuICBbLTEzLCBbXCJFQUNDRVNcIiwgXCJwZXJtaXNzaW9uIGRlbmllZFwiXV0sXG4gIFstNDgsIFtcIkVBRERSSU5VU0VcIiwgXCJhZGRyZXNzIGFscmVhZHkgaW4gdXNlXCJdXSxcbiAgWy00OSwgW1wiRUFERFJOT1RBVkFJTFwiLCBcImFkZHJlc3Mgbm90IGF2YWlsYWJsZVwiXV0sXG4gIFstNDcsIFtcIkVBRk5PU1VQUE9SVFwiLCBcImFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTM1LCBbXCJFQUdBSU5cIiwgXCJyZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZVwiXV0sXG4gIFstMzAwMCwgW1wiRUFJX0FERFJGQU1JTFlcIiwgXCJhZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zMDAxLCBbXCJFQUlfQUdBSU5cIiwgXCJ0ZW1wb3JhcnkgZmFpbHVyZVwiXV0sXG4gIFstMzAwMiwgW1wiRUFJX0JBREZMQUdTXCIsIFwiYmFkIGFpX2ZsYWdzIHZhbHVlXCJdXSxcbiAgWy0zMDEzLCBbXCJFQUlfQkFESElOVFNcIiwgXCJpbnZhbGlkIHZhbHVlIGZvciBoaW50c1wiXV0sXG4gIFstMzAwMywgW1wiRUFJX0NBTkNFTEVEXCIsIFwicmVxdWVzdCBjYW5jZWxlZFwiXV0sXG4gIFstMzAwNCwgW1wiRUFJX0ZBSUxcIiwgXCJwZXJtYW5lbnQgZmFpbHVyZVwiXV0sXG4gIFstMzAwNSwgW1wiRUFJX0ZBTUlMWVwiLCBcImFpX2ZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zMDA2LCBbXCJFQUlfTUVNT1JZXCIsIFwib3V0IG9mIG1lbW9yeVwiXV0sXG4gIFstMzAwNywgW1wiRUFJX05PREFUQVwiLCBcIm5vIGFkZHJlc3NcIl1dLFxuICBbLTMwMDgsIFtcIkVBSV9OT05BTUVcIiwgXCJ1bmtub3duIG5vZGUgb3Igc2VydmljZVwiXV0sXG4gIFstMzAwOSwgW1wiRUFJX09WRVJGTE9XXCIsIFwiYXJndW1lbnQgYnVmZmVyIG92ZXJmbG93XCJdXSxcbiAgWy0zMDE0LCBbXCJFQUlfUFJPVE9DT0xcIiwgXCJyZXNvbHZlZCBwcm90b2NvbCBpcyB1bmtub3duXCJdXSxcbiAgWy0zMDEwLCBbXCJFQUlfU0VSVklDRVwiLCBcInNlcnZpY2Ugbm90IGF2YWlsYWJsZSBmb3Igc29ja2V0IHR5cGVcIl1dLFxuICBbLTMwMTEsIFtcIkVBSV9TT0NLVFlQRVwiLCBcInNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTM3LCBbXCJFQUxSRUFEWVwiLCBcImNvbm5lY3Rpb24gYWxyZWFkeSBpbiBwcm9ncmVzc1wiXV0sXG4gIFstOSwgW1wiRUJBREZcIiwgXCJiYWQgZmlsZSBkZXNjcmlwdG9yXCJdXSxcbiAgWy0xNiwgW1wiRUJVU1lcIiwgXCJyZXNvdXJjZSBidXN5IG9yIGxvY2tlZFwiXV0sXG4gIFstODksIFtcIkVDQU5DRUxFRFwiLCBcIm9wZXJhdGlvbiBjYW5jZWxlZFwiXV0sXG4gIFstNDA4MCwgW1wiRUNIQVJTRVRcIiwgXCJpbnZhbGlkIFVuaWNvZGUgY2hhcmFjdGVyXCJdXSxcbiAgWy01MywgW1wiRUNPTk5BQk9SVEVEXCIsIFwic29mdHdhcmUgY2F1c2VkIGNvbm5lY3Rpb24gYWJvcnRcIl1dLFxuICBbLTYxLCBbXCJFQ09OTlJFRlVTRURcIiwgXCJjb25uZWN0aW9uIHJlZnVzZWRcIl1dLFxuICBbLTU0LCBbXCJFQ09OTlJFU0VUXCIsIFwiY29ubmVjdGlvbiByZXNldCBieSBwZWVyXCJdXSxcbiAgWy0zOSwgW1wiRURFU1RBRERSUkVRXCIsIFwiZGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZFwiXV0sXG4gIFstMTcsIFtcIkVFWElTVFwiLCBcImZpbGUgYWxyZWFkeSBleGlzdHNcIl1dLFxuICBbLTE0LCBbXCJFRkFVTFRcIiwgXCJiYWQgYWRkcmVzcyBpbiBzeXN0ZW0gY2FsbCBhcmd1bWVudFwiXV0sXG4gIFstMjcsIFtcIkVGQklHXCIsIFwiZmlsZSB0b28gbGFyZ2VcIl1dLFxuICBbLTY1LCBbXCJFSE9TVFVOUkVBQ0hcIiwgXCJob3N0IGlzIHVucmVhY2hhYmxlXCJdXSxcbiAgWy00LCBbXCJFSU5UUlwiLCBcImludGVycnVwdGVkIHN5c3RlbSBjYWxsXCJdXSxcbiAgWy0yMiwgW1wiRUlOVkFMXCIsIFwiaW52YWxpZCBhcmd1bWVudFwiXV0sXG4gIFstNSwgW1wiRUlPXCIsIFwiaS9vIGVycm9yXCJdXSxcbiAgWy01NiwgW1wiRUlTQ09OTlwiLCBcInNvY2tldCBpcyBhbHJlYWR5IGNvbm5lY3RlZFwiXV0sXG4gIFstMjEsIFtcIkVJU0RJUlwiLCBcImlsbGVnYWwgb3BlcmF0aW9uIG9uIGEgZGlyZWN0b3J5XCJdXSxcbiAgWy02MiwgW1wiRUxPT1BcIiwgXCJ0b28gbWFueSBzeW1ib2xpYyBsaW5rcyBlbmNvdW50ZXJlZFwiXV0sXG4gIFstMjQsIFtcIkVNRklMRVwiLCBcInRvbyBtYW55IG9wZW4gZmlsZXNcIl1dLFxuICBbLTQwLCBbXCJFTVNHU0laRVwiLCBcIm1lc3NhZ2UgdG9vIGxvbmdcIl1dLFxuICBbLTYzLCBbXCJFTkFNRVRPT0xPTkdcIiwgXCJuYW1lIHRvbyBsb25nXCJdXSxcbiAgWy01MCwgW1wiRU5FVERPV05cIiwgXCJuZXR3b3JrIGlzIGRvd25cIl1dLFxuICBbLTUxLCBbXCJFTkVUVU5SRUFDSFwiLCBcIm5ldHdvcmsgaXMgdW5yZWFjaGFibGVcIl1dLFxuICBbLTIzLCBbXCJFTkZJTEVcIiwgXCJmaWxlIHRhYmxlIG92ZXJmbG93XCJdXSxcbiAgWy01NSwgW1wiRU5PQlVGU1wiLCBcIm5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGVcIl1dLFxuICBbLTE5LCBbXCJFTk9ERVZcIiwgXCJubyBzdWNoIGRldmljZVwiXV0sXG4gIFstMiwgW1wiRU5PRU5UXCIsIFwibm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeVwiXV0sXG4gIFstMTIsIFtcIkVOT01FTVwiLCBcIm5vdCBlbm91Z2ggbWVtb3J5XCJdXSxcbiAgWy00MDU2LCBbXCJFTk9ORVRcIiwgXCJtYWNoaW5lIGlzIG5vdCBvbiB0aGUgbmV0d29ya1wiXV0sXG4gIFstNDIsIFtcIkVOT1BST1RPT1BUXCIsIFwicHJvdG9jb2wgbm90IGF2YWlsYWJsZVwiXV0sXG4gIFstMjgsIFtcIkVOT1NQQ1wiLCBcIm5vIHNwYWNlIGxlZnQgb24gZGV2aWNlXCJdXSxcbiAgWy03OCwgW1wiRU5PU1lTXCIsIFwiZnVuY3Rpb24gbm90IGltcGxlbWVudGVkXCJdXSxcbiAgWy01NywgW1wiRU5PVENPTk5cIiwgXCJzb2NrZXQgaXMgbm90IGNvbm5lY3RlZFwiXV0sXG4gIFstMjAsIFtcIkVOT1RESVJcIiwgXCJub3QgYSBkaXJlY3RvcnlcIl1dLFxuICBbLTY2LCBbXCJFTk9URU1QVFlcIiwgXCJkaXJlY3Rvcnkgbm90IGVtcHR5XCJdXSxcbiAgWy0zOCwgW1wiRU5PVFNPQ0tcIiwgXCJzb2NrZXQgb3BlcmF0aW9uIG9uIG5vbi1zb2NrZXRcIl1dLFxuICBbLTQ1LCBbXCJFTk9UU1VQXCIsIFwib3BlcmF0aW9uIG5vdCBzdXBwb3J0ZWQgb24gc29ja2V0XCJdXSxcbiAgWy0xLCBbXCJFUEVSTVwiLCBcIm9wZXJhdGlvbiBub3QgcGVybWl0dGVkXCJdXSxcbiAgWy0zMiwgW1wiRVBJUEVcIiwgXCJicm9rZW4gcGlwZVwiXV0sXG4gIFstMTAwLCBbXCJFUFJPVE9cIiwgXCJwcm90b2NvbCBlcnJvclwiXV0sXG4gIFstNDMsIFtcIkVQUk9UT05PU1VQUE9SVFwiLCBcInByb3RvY29sIG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTQxLCBbXCJFUFJPVE9UWVBFXCIsIFwicHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0XCJdXSxcbiAgWy0zNCwgW1wiRVJBTkdFXCIsIFwicmVzdWx0IHRvbyBsYXJnZVwiXV0sXG4gIFstMzAsIFtcIkVST0ZTXCIsIFwicmVhZC1vbmx5IGZpbGUgc3lzdGVtXCJdXSxcbiAgWy01OCwgW1wiRVNIVVRET1dOXCIsIFwiY2Fubm90IHNlbmQgYWZ0ZXIgdHJhbnNwb3J0IGVuZHBvaW50IHNodXRkb3duXCJdXSxcbiAgWy0yOSwgW1wiRVNQSVBFXCIsIFwiaW52YWxpZCBzZWVrXCJdXSxcbiAgWy0zLCBbXCJFU1JDSFwiLCBcIm5vIHN1Y2ggcHJvY2Vzc1wiXV0sXG4gIFstNjAsIFtcIkVUSU1FRE9VVFwiLCBcImNvbm5lY3Rpb24gdGltZWQgb3V0XCJdXSxcbiAgWy0yNiwgW1wiRVRYVEJTWVwiLCBcInRleHQgZmlsZSBpcyBidXN5XCJdXSxcbiAgWy0xOCwgW1wiRVhERVZcIiwgXCJjcm9zcy1kZXZpY2UgbGluayBub3QgcGVybWl0dGVkXCJdXSxcbiAgWy00MDk0LCBbXCJVTktOT1dOXCIsIFwidW5rbm93biBlcnJvclwiXV0sXG4gIFstNDA5NSwgW1wiRU9GXCIsIFwiZW5kIG9mIGZpbGVcIl1dLFxuICBbLTYsIFtcIkVOWElPXCIsIFwibm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzc1wiXV0sXG4gIFstMzEsIFtcIkVNTElOS1wiLCBcInRvbyBtYW55IGxpbmtzXCJdXSxcbiAgWy02NCwgW1wiRUhPU1RET1dOXCIsIFwiaG9zdCBpcyBkb3duXCJdXSxcbiAgWy00MDMwLCBbXCJFUkVNT1RFSU9cIiwgXCJyZW1vdGUgSS9PIGVycm9yXCJdXSxcbiAgWy0yNSwgW1wiRU5PVFRZXCIsIFwiaW5hcHByb3ByaWF0ZSBpb2N0bCBmb3IgZGV2aWNlXCJdXSxcbiAgWy03OSwgW1wiRUZUWVBFXCIsIFwiaW5hcHByb3ByaWF0ZSBmaWxlIHR5cGUgb3IgZm9ybWF0XCJdXSxcbiAgWy05MiwgW1wiRUlMU0VRXCIsIFwiaWxsZWdhbCBieXRlIHNlcXVlbmNlXCJdXSxcbl07XG5cbmNvbnN0IGVycm9yVG9Db2RlRGFyd2luOiBDb2RlTWFwRGF0YSA9IGNvZGVUb0Vycm9yRGFyd2luLm1hcCgoXG4gIFtzdGF0dXMsIFtjb2RlXV0sXG4pID0+IFtjb2RlLCBzdGF0dXNdKTtcblxuY29uc3QgY29kZVRvRXJyb3JMaW51eDogRXJyb3JNYXBEYXRhID0gW1xuICBbLTcsIFtcIkUyQklHXCIsIFwiYXJndW1lbnQgbGlzdCB0b28gbG9uZ1wiXV0sXG4gIFstMTMsIFtcIkVBQ0NFU1wiLCBcInBlcm1pc3Npb24gZGVuaWVkXCJdXSxcbiAgWy05OCwgW1wiRUFERFJJTlVTRVwiLCBcImFkZHJlc3MgYWxyZWFkeSBpbiB1c2VcIl1dLFxuICBbLTk5LCBbXCJFQUREUk5PVEFWQUlMXCIsIFwiYWRkcmVzcyBub3QgYXZhaWxhYmxlXCJdXSxcbiAgWy05NywgW1wiRUFGTk9TVVBQT1JUXCIsIFwiYWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZFwiXV0sXG4gIFstMTEsIFtcIkVBR0FJTlwiLCBcInJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlXCJdXSxcbiAgWy0zMDAwLCBbXCJFQUlfQUREUkZBTUlMWVwiLCBcImFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTMwMDEsIFtcIkVBSV9BR0FJTlwiLCBcInRlbXBvcmFyeSBmYWlsdXJlXCJdXSxcbiAgWy0zMDAyLCBbXCJFQUlfQkFERkxBR1NcIiwgXCJiYWQgYWlfZmxhZ3MgdmFsdWVcIl1dLFxuICBbLTMwMTMsIFtcIkVBSV9CQURISU5UU1wiLCBcImludmFsaWQgdmFsdWUgZm9yIGhpbnRzXCJdXSxcbiAgWy0zMDAzLCBbXCJFQUlfQ0FOQ0VMRURcIiwgXCJyZXF1ZXN0IGNhbmNlbGVkXCJdXSxcbiAgWy0zMDA0LCBbXCJFQUlfRkFJTFwiLCBcInBlcm1hbmVudCBmYWlsdXJlXCJdXSxcbiAgWy0zMDA1LCBbXCJFQUlfRkFNSUxZXCIsIFwiYWlfZmFtaWx5IG5vdCBzdXBwb3J0ZWRcIl1dLFxuICBbLTMwMDYsIFtcIkVBSV9NRU1PUllcIiwgXCJvdXQgb2YgbWVtb3J5XCJdXSxcbiAgWy0zMDA3LCBbXCJFQUlfTk9EQVRBXCIsIFwibm8gYWRkcmVzc1wiXV0sXG4gIFstMzAwOCwgW1wiRUFJX05PTkFNRVwiLCBcInVua25vd24gbm9kZSBvciBzZXJ2aWNlXCJdXSxcbiAgWy0zMDA5LCBbXCJFQUlfT1ZFUkZMT1dcIiwgXCJhcmd1bWVudCBidWZmZXIgb3ZlcmZsb3dcIl1dLFxuICBbLTMwMTQsIFtcIkVBSV9QUk9UT0NPTFwiLCBcInJlc29sdmVkIHByb3RvY29sIGlzIHVua25vd25cIl1dLFxuICBbLTMwMTAsIFtcIkVBSV9TRVJWSUNFXCIsIFwic2VydmljZSBub3QgYXZhaWxhYmxlIGZvciBzb2NrZXQgdHlwZVwiXV0sXG4gIFstMzAxMSwgW1wiRUFJX1NPQ0tUWVBFXCIsIFwic29ja2V0IHR5cGUgbm90IHN1cHBvcnRlZFwiXV0sXG4gIFstMTE0LCBbXCJFQUxSRUFEWVwiLCBcImNvbm5lY3Rpb24gYWxyZWFkeSBpbiBwcm9ncmVzc1wiXV0sXG4gIFstOSwgW1wiRUJBREZcIiwgXCJiYWQgZmlsZSBkZXNjcmlwdG9yXCJdXSxcbiAgWy0xNiwgW1wiRUJVU1lcIiwgXCJyZXNvdXJjZSBidXN5IG9yIGxvY2tlZFwiXV0sXG4gIFstMTI1LCBbXCJFQ0FOQ0VMRURcIiwgXCJvcGVyYXRpb24gY2FuY2VsZWRcIl1dLFxuICBbLTQwODAsIFtcIkVDSEFSU0VUXCIsIFwiaW52YWxpZCBVbmljb2RlIGNoYXJhY3RlclwiXV0sXG4gIFstMTAzLCBbXCJFQ09OTkFCT1JURURcIiwgXCJzb2Z0d2FyZSBjYXVzZWQgY29ubmVjdGlvbiBhYm9ydFwiXV0sXG4gIFstMTExLCBbXCJFQ09OTlJFRlVTRURcIiwgXCJjb25uZWN0aW9uIHJlZnVzZWRcIl1dLFxuICBbLTEwNCwgW1wiRUNPTk5SRVNFVFwiLCBcImNvbm5lY3Rpb24gcmVzZXQgYnkgcGVlclwiXV0sXG4gIFstODksIFtcIkVERVNUQUREUlJFUVwiLCBcImRlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWRcIl1dLFxuICBbLTE3LCBbXCJFRVhJU1RcIiwgXCJmaWxlIGFscmVhZHkgZXhpc3RzXCJdXSxcbiAgWy0xNCwgW1wiRUZBVUxUXCIsIFwiYmFkIGFkZHJlc3MgaW4gc3lzdGVtIGNhbGwgYXJndW1lbnRcIl1dLFxuICBbLTI3LCBbXCJFRkJJR1wiLCBcImZpbGUgdG9vIGxhcmdlXCJdXSxcbiAgWy0xMTMsIFtcIkVIT1NUVU5SRUFDSFwiLCBcImhvc3QgaXMgdW5yZWFjaGFibGVcIl1dLFxuICBbLTQsIFtcIkVJTlRSXCIsIFwiaW50ZXJydXB0ZWQgc3lzdGVtIGNhbGxcIl1dLFxuICBbLTIyLCBbXCJFSU5WQUxcIiwgXCJpbnZhbGlkIGFyZ3VtZW50XCJdXSxcbiAgWy01LCBbXCJFSU9cIiwgXCJpL28gZXJyb3JcIl1dLFxuICBbLTEwNiwgW1wiRUlTQ09OTlwiLCBcInNvY2tldCBpcyBhbHJlYWR5IGNvbm5lY3RlZFwiXV0sXG4gIFstMjEsIFtcIkVJU0RJUlwiLCBcImlsbGVnYWwgb3BlcmF0aW9uIG9uIGEgZGlyZWN0b3J5XCJdXSxcbiAgWy00MCwgW1wiRUxPT1BcIiwgXCJ0b28gbWFueSBzeW1ib2xpYyBsaW5rcyBlbmNvdW50ZXJlZFwiXV0sXG4gIFstMjQsIFtcIkVNRklMRVwiLCBcInRvbyBtYW55IG9wZW4gZmlsZXNcIl1dLFxuICBbLTkwLCBbXCJFTVNHU0laRVwiLCBcIm1lc3NhZ2UgdG9vIGxvbmdcIl1dLFxuICBbLTM2LCBbXCJFTkFNRVRPT0xPTkdcIiwgXCJuYW1lIHRvbyBsb25nXCJdXSxcbiAgWy0xMDAsIFtcIkVORVRET1dOXCIsIFwibmV0d29yayBpcyBkb3duXCJdXSxcbiAgWy0xMDEsIFtcIkVORVRVTlJFQUNIXCIsIFwibmV0d29yayBpcyB1bnJlYWNoYWJsZVwiXV0sXG4gIFstMjMsIFtcIkVORklMRVwiLCBcImZpbGUgdGFibGUgb3ZlcmZsb3dcIl1dLFxuICBbLTEwNSwgW1wiRU5PQlVGU1wiLCBcIm5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGVcIl1dLFxuICBbLTE5LCBbXCJFTk9ERVZcIiwgXCJubyBzdWNoIGRldmljZVwiXV0sXG4gIFstMiwgW1wiRU5PRU5UXCIsIFwibm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeVwiXV0sXG4gIFstMTIsIFtcIkVOT01FTVwiLCBcIm5vdCBlbm91Z2ggbWVtb3J5XCJdXSxcbiAgWy02NCwgW1wiRU5PTkVUXCIsIFwibWFjaGluZSBpcyBub3Qgb24gdGhlIG5ldHdvcmtcIl1dLFxuICBbLTkyLCBbXCJFTk9QUk9UT09QVFwiLCBcInByb3RvY29sIG5vdCBhdmFpbGFibGVcIl1dLFxuICBbLTI4LCBbXCJFTk9TUENcIiwgXCJubyBzcGFjZSBsZWZ0IG9uIGRldmljZVwiXV0sXG4gIFstMzgsIFtcIkVOT1NZU1wiLCBcImZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZFwiXV0sXG4gIFstMTA3LCBbXCJFTk9UQ09OTlwiLCBcInNvY2tldCBpcyBub3QgY29ubmVjdGVkXCJdXSxcbiAgWy0yMCwgW1wiRU5PVERJUlwiLCBcIm5vdCBhIGRpcmVjdG9yeVwiXV0sXG4gIFstMzksIFtcIkVOT1RFTVBUWVwiLCBcImRpcmVjdG9yeSBub3QgZW1wdHlcIl1dLFxuICBbLTg4LCBbXCJFTk9UU09DS1wiLCBcInNvY2tldCBvcGVyYXRpb24gb24gbm9uLXNvY2tldFwiXV0sXG4gIFstOTUsIFtcIkVOT1RTVVBcIiwgXCJvcGVyYXRpb24gbm90IHN1cHBvcnRlZCBvbiBzb2NrZXRcIl1dLFxuICBbLTEsIFtcIkVQRVJNXCIsIFwib3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWRcIl1dLFxuICBbLTMyLCBbXCJFUElQRVwiLCBcImJyb2tlbiBwaXBlXCJdXSxcbiAgWy03MSwgW1wiRVBST1RPXCIsIFwicHJvdG9jb2wgZXJyb3JcIl1dLFxuICBbLTkzLCBbXCJFUFJPVE9OT1NVUFBPUlRcIiwgXCJwcm90b2NvbCBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy05MSwgW1wiRVBST1RPVFlQRVwiLCBcInByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldFwiXV0sXG4gIFstMzQsIFtcIkVSQU5HRVwiLCBcInJlc3VsdCB0b28gbGFyZ2VcIl1dLFxuICBbLTMwLCBbXCJFUk9GU1wiLCBcInJlYWQtb25seSBmaWxlIHN5c3RlbVwiXV0sXG4gIFstMTA4LCBbXCJFU0hVVERPV05cIiwgXCJjYW5ub3Qgc2VuZCBhZnRlciB0cmFuc3BvcnQgZW5kcG9pbnQgc2h1dGRvd25cIl1dLFxuICBbLTI5LCBbXCJFU1BJUEVcIiwgXCJpbnZhbGlkIHNlZWtcIl1dLFxuICBbLTMsIFtcIkVTUkNIXCIsIFwibm8gc3VjaCBwcm9jZXNzXCJdXSxcbiAgWy0xMTAsIFtcIkVUSU1FRE9VVFwiLCBcImNvbm5lY3Rpb24gdGltZWQgb3V0XCJdXSxcbiAgWy0yNiwgW1wiRVRYVEJTWVwiLCBcInRleHQgZmlsZSBpcyBidXN5XCJdXSxcbiAgWy0xOCwgW1wiRVhERVZcIiwgXCJjcm9zcy1kZXZpY2UgbGluayBub3QgcGVybWl0dGVkXCJdXSxcbiAgWy00MDk0LCBbXCJVTktOT1dOXCIsIFwidW5rbm93biBlcnJvclwiXV0sXG4gIFstNDA5NSwgW1wiRU9GXCIsIFwiZW5kIG9mIGZpbGVcIl1dLFxuICBbLTYsIFtcIkVOWElPXCIsIFwibm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzc1wiXV0sXG4gIFstMzEsIFtcIkVNTElOS1wiLCBcInRvbyBtYW55IGxpbmtzXCJdXSxcbiAgWy0xMTIsIFtcIkVIT1NURE9XTlwiLCBcImhvc3QgaXMgZG93blwiXV0sXG4gIFstMTIxLCBbXCJFUkVNT1RFSU9cIiwgXCJyZW1vdGUgSS9PIGVycm9yXCJdXSxcbiAgWy0yNSwgW1wiRU5PVFRZXCIsIFwiaW5hcHByb3ByaWF0ZSBpb2N0bCBmb3IgZGV2aWNlXCJdXSxcbiAgWy00MDI4LCBbXCJFRlRZUEVcIiwgXCJpbmFwcHJvcHJpYXRlIGZpbGUgdHlwZSBvciBmb3JtYXRcIl1dLFxuICBbLTg0LCBbXCJFSUxTRVFcIiwgXCJpbGxlZ2FsIGJ5dGUgc2VxdWVuY2VcIl1dLFxuXTtcblxuY29uc3QgZXJyb3JUb0NvZGVMaW51eDogQ29kZU1hcERhdGEgPSBjb2RlVG9FcnJvckxpbnV4Lm1hcCgoXG4gIFtzdGF0dXMsIFtjb2RlXV0sXG4pID0+IFtjb2RlLCBzdGF0dXNdKTtcblxuY29uc3QgY29kZVRvRXJyb3JGcmVlYnNkOiBFcnJvck1hcERhdGEgPSBbXG4gIFstNywgW1wiRTJCSUdcIiwgXCJhcmd1bWVudCBsaXN0IHRvbyBsb25nXCJdXSxcbiAgWy0xMywgW1wiRUFDQ0VTXCIsIFwicGVybWlzc2lvbiBkZW5pZWRcIl1dLFxuICBbLTQ4LCBbXCJFQUREUklOVVNFXCIsIFwiYWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiXV0sXG4gIFstNDksIFtcIkVBRERSTk9UQVZBSUxcIiwgXCJhZGRyZXNzIG5vdCBhdmFpbGFibGVcIl1dLFxuICBbLTQ3LCBbXCJFQUZOT1NVUFBPUlRcIiwgXCJhZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zNSwgW1wiRUFHQUlOXCIsIFwicmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGVcIl1dLFxuICBbLTMwMDAsIFtcIkVBSV9BRERSRkFNSUxZXCIsIFwiYWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZFwiXV0sXG4gIFstMzAwMSwgW1wiRUFJX0FHQUlOXCIsIFwidGVtcG9yYXJ5IGZhaWx1cmVcIl1dLFxuICBbLTMwMDIsIFtcIkVBSV9CQURGTEFHU1wiLCBcImJhZCBhaV9mbGFncyB2YWx1ZVwiXV0sXG4gIFstMzAxMywgW1wiRUFJX0JBREhJTlRTXCIsIFwiaW52YWxpZCB2YWx1ZSBmb3IgaGludHNcIl1dLFxuICBbLTMwMDMsIFtcIkVBSV9DQU5DRUxFRFwiLCBcInJlcXVlc3QgY2FuY2VsZWRcIl1dLFxuICBbLTMwMDQsIFtcIkVBSV9GQUlMXCIsIFwicGVybWFuZW50IGZhaWx1cmVcIl1dLFxuICBbLTMwMDUsIFtcIkVBSV9GQU1JTFlcIiwgXCJhaV9mYW1pbHkgbm90IHN1cHBvcnRlZFwiXV0sXG4gIFstMzAwNiwgW1wiRUFJX01FTU9SWVwiLCBcIm91dCBvZiBtZW1vcnlcIl1dLFxuICBbLTMwMDcsIFtcIkVBSV9OT0RBVEFcIiwgXCJubyBhZGRyZXNzXCJdXSxcbiAgWy0zMDA4LCBbXCJFQUlfTk9OQU1FXCIsIFwidW5rbm93biBub2RlIG9yIHNlcnZpY2VcIl1dLFxuICBbLTMwMDksIFtcIkVBSV9PVkVSRkxPV1wiLCBcImFyZ3VtZW50IGJ1ZmZlciBvdmVyZmxvd1wiXV0sXG4gIFstMzAxNCwgW1wiRUFJX1BST1RPQ09MXCIsIFwicmVzb2x2ZWQgcHJvdG9jb2wgaXMgdW5rbm93blwiXV0sXG4gIFstMzAxMCwgW1wiRUFJX1NFUlZJQ0VcIiwgXCJzZXJ2aWNlIG5vdCBhdmFpbGFibGUgZm9yIHNvY2tldCB0eXBlXCJdXSxcbiAgWy0zMDExLCBbXCJFQUlfU09DS1RZUEVcIiwgXCJzb2NrZXQgdHlwZSBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy0zNywgW1wiRUFMUkVBRFlcIiwgXCJjb25uZWN0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3NcIl1dLFxuICBbLTksIFtcIkVCQURGXCIsIFwiYmFkIGZpbGUgZGVzY3JpcHRvclwiXV0sXG4gIFstMTYsIFtcIkVCVVNZXCIsIFwicmVzb3VyY2UgYnVzeSBvciBsb2NrZWRcIl1dLFxuICBbLTg1LCBbXCJFQ0FOQ0VMRURcIiwgXCJvcGVyYXRpb24gY2FuY2VsZWRcIl1dLFxuICBbLTQwODAsIFtcIkVDSEFSU0VUXCIsIFwiaW52YWxpZCBVbmljb2RlIGNoYXJhY3RlclwiXV0sXG4gIFstNTMsIFtcIkVDT05OQUJPUlRFRFwiLCBcInNvZnR3YXJlIGNhdXNlZCBjb25uZWN0aW9uIGFib3J0XCJdXSxcbiAgWy02MSwgW1wiRUNPTk5SRUZVU0VEXCIsIFwiY29ubmVjdGlvbiByZWZ1c2VkXCJdXSxcbiAgWy01NCwgW1wiRUNPTk5SRVNFVFwiLCBcImNvbm5lY3Rpb24gcmVzZXQgYnkgcGVlclwiXV0sXG4gIFstMzksIFtcIkVERVNUQUREUlJFUVwiLCBcImRlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWRcIl1dLFxuICBbLTE3LCBbXCJFRVhJU1RcIiwgXCJmaWxlIGFscmVhZHkgZXhpc3RzXCJdXSxcbiAgWy0xNCwgW1wiRUZBVUxUXCIsIFwiYmFkIGFkZHJlc3MgaW4gc3lzdGVtIGNhbGwgYXJndW1lbnRcIl1dLFxuICBbLTI3LCBbXCJFRkJJR1wiLCBcImZpbGUgdG9vIGxhcmdlXCJdXSxcbiAgWy02NSwgW1wiRUhPU1RVTlJFQUNIXCIsIFwiaG9zdCBpcyB1bnJlYWNoYWJsZVwiXV0sXG4gIFstNCwgW1wiRUlOVFJcIiwgXCJpbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbFwiXV0sXG4gIFstMjIsIFtcIkVJTlZBTFwiLCBcImludmFsaWQgYXJndW1lbnRcIl1dLFxuICBbLTUsIFtcIkVJT1wiLCBcImkvbyBlcnJvclwiXV0sXG4gIFstNTYsIFtcIkVJU0NPTk5cIiwgXCJzb2NrZXQgaXMgYWxyZWFkeSBjb25uZWN0ZWRcIl1dLFxuICBbLTIxLCBbXCJFSVNESVJcIiwgXCJpbGxlZ2FsIG9wZXJhdGlvbiBvbiBhIGRpcmVjdG9yeVwiXV0sXG4gIFstNjIsIFtcIkVMT09QXCIsIFwidG9vIG1hbnkgc3ltYm9saWMgbGlua3MgZW5jb3VudGVyZWRcIl1dLFxuICBbLTI0LCBbXCJFTUZJTEVcIiwgXCJ0b28gbWFueSBvcGVuIGZpbGVzXCJdXSxcbiAgWy00MCwgW1wiRU1TR1NJWkVcIiwgXCJtZXNzYWdlIHRvbyBsb25nXCJdXSxcbiAgWy02MywgW1wiRU5BTUVUT09MT05HXCIsIFwibmFtZSB0b28gbG9uZ1wiXV0sXG4gIFstNTAsIFtcIkVORVRET1dOXCIsIFwibmV0d29yayBpcyBkb3duXCJdXSxcbiAgWy01MSwgW1wiRU5FVFVOUkVBQ0hcIiwgXCJuZXR3b3JrIGlzIHVucmVhY2hhYmxlXCJdXSxcbiAgWy0yMywgW1wiRU5GSUxFXCIsIFwiZmlsZSB0YWJsZSBvdmVyZmxvd1wiXV0sXG4gIFstNTUsIFtcIkVOT0JVRlNcIiwgXCJubyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlXCJdXSxcbiAgWy0xOSwgW1wiRU5PREVWXCIsIFwibm8gc3VjaCBkZXZpY2VcIl1dLFxuICBbLTIsIFtcIkVOT0VOVFwiLCBcIm5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnlcIl1dLFxuICBbLTEyLCBbXCJFTk9NRU1cIiwgXCJub3QgZW5vdWdoIG1lbW9yeVwiXV0sXG4gIFstNDA1NiwgW1wiRU5PTkVUXCIsIFwibWFjaGluZSBpcyBub3Qgb24gdGhlIG5ldHdvcmtcIl1dLFxuICBbLTQyLCBbXCJFTk9QUk9UT09QVFwiLCBcInByb3RvY29sIG5vdCBhdmFpbGFibGVcIl1dLFxuICBbLTI4LCBbXCJFTk9TUENcIiwgXCJubyBzcGFjZSBsZWZ0IG9uIGRldmljZVwiXV0sXG4gIFstNzgsIFtcIkVOT1NZU1wiLCBcImZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZFwiXV0sXG4gIFstNTcsIFtcIkVOT1RDT05OXCIsIFwic29ja2V0IGlzIG5vdCBjb25uZWN0ZWRcIl1dLFxuICBbLTIwLCBbXCJFTk9URElSXCIsIFwibm90IGEgZGlyZWN0b3J5XCJdXSxcbiAgWy02NiwgW1wiRU5PVEVNUFRZXCIsIFwiZGlyZWN0b3J5IG5vdCBlbXB0eVwiXV0sXG4gIFstMzgsIFtcIkVOT1RTT0NLXCIsIFwic29ja2V0IG9wZXJhdGlvbiBvbiBub24tc29ja2V0XCJdXSxcbiAgWy00NSwgW1wiRU5PVFNVUFwiLCBcIm9wZXJhdGlvbiBub3Qgc3VwcG9ydGVkIG9uIHNvY2tldFwiXV0sXG4gIFstODQsIFtcIkVPVkVSRkxPV1wiLCBcInZhbHVlIHRvbyBsYXJnZSBmb3IgZGVmaW5lZCBkYXRhIHR5cGVcIl1dLFxuICBbLTEsIFtcIkVQRVJNXCIsIFwib3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWRcIl1dLFxuICBbLTMyLCBbXCJFUElQRVwiLCBcImJyb2tlbiBwaXBlXCJdXSxcbiAgWy05MiwgW1wiRVBST1RPXCIsIFwicHJvdG9jb2wgZXJyb3JcIl1dLFxuICBbLTQzLCBbXCJFUFJPVE9OT1NVUFBPUlRcIiwgXCJwcm90b2NvbCBub3Qgc3VwcG9ydGVkXCJdXSxcbiAgWy00MSwgW1wiRVBST1RPVFlQRVwiLCBcInByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldFwiXV0sXG4gIFstMzQsIFtcIkVSQU5HRVwiLCBcInJlc3VsdCB0b28gbGFyZ2VcIl1dLFxuICBbLTMwLCBbXCJFUk9GU1wiLCBcInJlYWQtb25seSBmaWxlIHN5c3RlbVwiXV0sXG4gIFstNTgsIFtcIkVTSFVURE9XTlwiLCBcImNhbm5vdCBzZW5kIGFmdGVyIHRyYW5zcG9ydCBlbmRwb2ludCBzaHV0ZG93blwiXV0sXG4gIFstMjksIFtcIkVTUElQRVwiLCBcImludmFsaWQgc2Vla1wiXV0sXG4gIFstMywgW1wiRVNSQ0hcIiwgXCJubyBzdWNoIHByb2Nlc3NcIl1dLFxuICBbLTYwLCBbXCJFVElNRURPVVRcIiwgXCJjb25uZWN0aW9uIHRpbWVkIG91dFwiXV0sXG4gIFstMjYsIFtcIkVUWFRCU1lcIiwgXCJ0ZXh0IGZpbGUgaXMgYnVzeVwiXV0sXG4gIFstMTgsIFtcIkVYREVWXCIsIFwiY3Jvc3MtZGV2aWNlIGxpbmsgbm90IHBlcm1pdHRlZFwiXV0sXG4gIFstNDA5NCwgW1wiVU5LTk9XTlwiLCBcInVua25vd24gZXJyb3JcIl1dLFxuICBbLTQwOTUsIFtcIkVPRlwiLCBcImVuZCBvZiBmaWxlXCJdXSxcbiAgWy02LCBbXCJFTlhJT1wiLCBcIm5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3NcIl1dLFxuICBbLTMxLCBbXCJFTUxJTktcIiwgXCJ0b28gbWFueSBsaW5rc1wiXV0sXG4gIFstNjQsIFtcIkVIT1NURE9XTlwiLCBcImhvc3QgaXMgZG93blwiXV0sXG4gIFstNDAzMCwgW1wiRVJFTU9URUlPXCIsIFwicmVtb3RlIEkvTyBlcnJvclwiXV0sXG4gIFstMjUsIFtcIkVOT1RUWVwiLCBcImluYXBwcm9wcmlhdGUgaW9jdGwgZm9yIGRldmljZVwiXV0sXG4gIFstNzksIFtcIkVGVFlQRVwiLCBcImluYXBwcm9wcmlhdGUgZmlsZSB0eXBlIG9yIGZvcm1hdFwiXV0sXG4gIFstODYsIFtcIkVJTFNFUVwiLCBcImlsbGVnYWwgYnl0ZSBzZXF1ZW5jZVwiXV0sXG4gIFstNDQsIFtcIkVTT0NLVE5PU1VQUE9SVFwiLCBcInNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWRcIl1dLFxuXTtcblxuY29uc3QgZXJyb3JUb0NvZGVGcmVlYnNkOiBDb2RlTWFwRGF0YSA9IGNvZGVUb0Vycm9yRnJlZWJzZC5tYXAoKFxuICBbc3RhdHVzLCBbY29kZV1dLFxuKSA9PiBbY29kZSwgc3RhdHVzXSk7XG5cbmV4cG9ydCBjb25zdCBlcnJvck1hcCA9IG5ldyBNYXA8bnVtYmVyLCBbc3RyaW5nLCBzdHJpbmddPihcbiAgb3NUeXBlID09PSBcIndpbmRvd3NcIlxuICAgID8gY29kZVRvRXJyb3JXaW5kb3dzXG4gICAgOiBvc1R5cGUgPT09IFwiZGFyd2luXCJcbiAgICA/IGNvZGVUb0Vycm9yRGFyd2luXG4gICAgOiBvc1R5cGUgPT09IFwibGludXhcIlxuICAgID8gY29kZVRvRXJyb3JMaW51eFxuICAgIDogb3NUeXBlID09PSBcImZyZWVic2RcIlxuICAgID8gY29kZVRvRXJyb3JGcmVlYnNkXG4gICAgOiB1bnJlYWNoYWJsZSgpLFxuKTtcblxuZXhwb3J0IGNvbnN0IGNvZGVNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPihcbiAgb3NUeXBlID09PSBcIndpbmRvd3NcIlxuICAgID8gZXJyb3JUb0NvZGVXaW5kb3dzXG4gICAgOiBvc1R5cGUgPT09IFwiZGFyd2luXCJcbiAgICA/IGVycm9yVG9Db2RlRGFyd2luXG4gICAgOiBvc1R5cGUgPT09IFwibGludXhcIlxuICAgID8gZXJyb3JUb0NvZGVMaW51eFxuICAgIDogb3NUeXBlID09PSBcImZyZWVic2RcIlxuICAgID8gZXJyb3JUb0NvZGVGcmVlYnNkXG4gICAgOiB1bnJlYWNoYWJsZSgpLFxuKTtcblxuZXhwb3J0IGZ1bmN0aW9uIG1hcFN5c0Vycm5vVG9VdkVycm5vKHN5c0Vycm5vOiBudW1iZXIpOiBudW1iZXIge1xuICBpZiAob3NUeXBlID09PSBcIndpbmRvd3NcIikge1xuICAgIGNvbnN0IGNvZGUgPSB1dlRyYW5zbGF0ZVN5c0Vycm9yKHN5c0Vycm5vKTtcbiAgICByZXR1cm4gY29kZU1hcC5nZXQoY29kZSkgPz8gLXN5c0Vycm5vO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAtc3lzRXJybm87XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IFVWX0VBSV9NRU1PUlkgPSBjb2RlTWFwLmdldChcIkVBSV9NRU1PUllcIikhO1xuZXhwb3J0IGNvbnN0IFVWX0VCQURGID0gY29kZU1hcC5nZXQoXCJFQkFERlwiKSE7XG5leHBvcnQgY29uc3QgVVZfRUVYSVNUID0gY29kZU1hcC5nZXQoXCJFRVhJU1RcIik7XG5leHBvcnQgY29uc3QgVVZfRUlOVkFMID0gY29kZU1hcC5nZXQoXCJFSU5WQUxcIikhO1xuZXhwb3J0IGNvbnN0IFVWX0VOT0VOVCA9IGNvZGVNYXAuZ2V0KFwiRU5PRU5UXCIpO1xuZXhwb3J0IGNvbnN0IFVWX0VOT1RTT0NLID0gY29kZU1hcC5nZXQoXCJFTk9UU09DS1wiKSE7XG5leHBvcnQgY29uc3QgVVZfVU5LTk9XTiA9IGNvZGVNYXAuZ2V0KFwiVU5LTk9XTlwiKSE7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0Usd0VBQXdFO0FBQ3hFLDRFQUE0RTtBQUM1RSx5Q0FBeUM7QUFFekMscUJBQXFCO0FBQ3JCLHlEQUF5RDtBQUN6RCx1REFBdUQ7QUFDdkQsRUFBRTtBQUNGLHNFQUFzRTtBQUV0RSxTQUFTLFdBQVcsUUFBUSx5QkFBeUI7QUFDckQsU0FBUyxNQUFNLFFBQVEsb0JBQW9CO0FBQzNDLFNBQVMsbUJBQW1CLFFBQVEsdUJBQXVCO0FBaUIzRCxNQUFNLHFCQUFtQztJQUN2QztRQUFDLENBQUM7UUFBTTtZQUFDO1lBQVM7U0FBeUI7S0FBQztJQUM1QztRQUFDLENBQUM7UUFBTTtZQUFDO1lBQVU7U0FBb0I7S0FBQztJQUN4QztRQUFDLENBQUM7UUFBTTtZQUFDO1lBQWM7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