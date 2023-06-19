// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * {@linkcode sprintf} and {@linkcode printf} for printing formatted strings to
 * stdout.
 *
 * This implementation is inspired by POSIX and Golang but does not port
 * implementation code.
 *
 * sprintf converts and formats a variable number of arguments as is specified
 * by a `format string`. In it's basic form, a format string may just be a
 * literal. In case arguments are meant to be formatted, a `directive` is
 * contained in the format string, preceded by a '%' character:
 *
 *     %<verb>
 *
 * E.g. the verb `s` indicates the directive should be replaced by the string
 * representation of the argument in the corresponding position of the argument
 * list. E.g.:
 *
 *     Hello %s!
 *
 * applied to the arguments "World" yields "Hello World!".
 *
 * The meaning of the format string is modelled after [POSIX][1] format strings
 * as well as well as [Golang format strings][2]. Both contain elements specific
 * to the respective programming language that don't apply to JavaScript, so
 * they can not be fully supported. Furthermore we implement some functionality
 * that is specific to JS.
 *
 * ## Verbs
 *
 * The following verbs are supported:
 *
 * | Verb  | Meaning                                                        |
 * | ----- | -------------------------------------------------------------- |
 * | `%`   | print a literal percent                                        |
 * | `t`   | evaluate arg as boolean, print `true` or `false`               |
 * | `b`   | eval as number, print binary                                   |
 * | `c`   | eval as number, print character corresponding to the codePoint |
 * | `o`   | eval as number, print octal                                    |
 * | `x X` | print as hex (ff FF), treat string as list of bytes            |
 * | `e E` | print number in scientific/exponent format 1.123123e+01        |
 * | `f F` | print number as float with decimal point and no exponent       |
 * | `g G` | use %e %E or %f %F depending on size of argument               |
 * | `s`   | interpolate string                                             |
 * | `T`   | type of arg, as returned by `typeof`                           |
 * | `v`   | value of argument in 'default' format (see below)              |
 * | `j`   | argument as formatted by `JSON.stringify`                      |
 *
 * ## Width and Precision
 *
 * Verbs may be modified by providing them with width and precision, either or
 * both may be omitted:
 *
 *     %9f    width 9, default precision
 *     %.9f   default width, precision 9
 *     %8.9f  width 8, precision 9
 *     %8.f   width 9, precision 0
 *
 * In general, 'width' describes the minimum length of the output, while
 * 'precision' limits the output.
 *
 * | verb      | precision                                                       |
 * | --------- | --------------------------------------------------------------- |
 * | `t`       | n/a                                                             |
 * | `b c o`   | n/a                                                             |
 * | `x X`     | n/a for number, strings are truncated to p bytes(!)             |
 * | `e E f F` | number of places after decimal, default 6                       |
 * | `g G`     | set maximum number of digits                                    |
 * | `s`       | truncate input                                                  |
 * | `T`       | truncate                                                        |
 * | `v`       | truncate, or depth if used with # see "'default' format", below |
 * | `j`       | n/a                                                             |
 *
 * Numerical values for width and precision can be substituted for the `*` char,
 * in which case the values are obtained from the next args, e.g.:
 *
 *     sprintf("%*.*f", 9, 8, 456.0)
 *
 * is equivalent to:
 *
 *     sprintf("%9.8f", 456.0)
 *
 * ## Flags
 *
 * The effects of the verb may be further influenced by using flags to modify
 * the directive:
 *
 * | Flag  | Verb      | Meaning                                                                    |
 * | ----- | --------- | -------------------------------------------------------------------------- |
 * | `+`   | numeric   | always print sign                                                          |
 * | `-`   | all       | pad to the right (left justify)                                            |
 * | `#`   |           | alternate format                                                           |
 * | `#`   | `b o x X` | prefix with `0b 0 0x`                                                      |
 * | `#`   | `g G`     | don't remove trailing zeros                                                |
 * | `#`   | `v`       | ues output of `inspect` instead of `toString`                              |
 * | `' '` |           | space character                                                            |
 * | `' '` | `x X`     | leave spaces between bytes when printing string                            |
 * | `' '` | `d`       | insert space for missing `+` sign character                                |
 * | `0`   | all       | pad with zero, `-` takes precedence, sign is appended in front of padding  |
 * | `<`   | all       | format elements of the passed array according to the directive (extension) |
 *
 * ## 'default' format
 *
 * The default format used by `%v` is the result of calling `toString()` on the
 * relevant argument. If the `#` flags is used, the result of calling `inspect()`
 * is interpolated. In this case, the precision, if set is passed to `inspect()`
 * as the 'depth' config parameter.
 *
 * ## Positional arguments
 *
 * Arguments do not need to be consumed in the order they are provided and may
 * be consumed more than once. E.g.:
 *
 *     sprintf("%[2]s %[1]s", "World", "Hello")
 *
 * returns "Hello World". The presence of a positional indicator resets the arg
 * counter allowing args to be reused:
 *
 *     sprintf("dec[%d]=%d hex[%[1]d]=%x oct[%[1]d]=%#o %s", 1, 255, "Third")
 *
 * returns `dec[1]=255 hex[1]=0xff oct[1]=0377 Third`
 *
 * Width and precision my also use positionals:
 *
 *     "%[2]*.[1]*d", 1, 2
 *
 * This follows the golang conventions and not POSIX.
 *
 * ## Errors
 *
 * The following errors are handled:
 *
 * Incorrect verb:
 *
 *     S("%h", "") %!(BAD VERB 'h')
 *
 * Too few arguments:
 *
 *     S("%d") %!(MISSING 'd')"
 *
 * [1]: https://pubs.opengroup.org/onlinepubs/009695399/functions/fprintf.html
 * [2]: https://golang.org/pkg/fmt/
 *
 * @module
 */ var State;
(function(State) {
    State[State["PASSTHROUGH"] = 0] = "PASSTHROUGH";
    State[State["PERCENT"] = 1] = "PERCENT";
    State[State["POSITIONAL"] = 2] = "POSITIONAL";
    State[State["PRECISION"] = 3] = "PRECISION";
    State[State["WIDTH"] = 4] = "WIDTH";
})(State || (State = {}));
var WorP;
(function(WorP) {
    WorP[WorP["WIDTH"] = 0] = "WIDTH";
    WorP[WorP["PRECISION"] = 1] = "PRECISION";
})(WorP || (WorP = {}));
class Flags {
    plus;
    dash;
    sharp;
    space;
    zero;
    lessthan;
    width = -1;
    precision = -1;
}
const min = Math.min;
const UNICODE_REPLACEMENT_CHARACTER = "\ufffd";
const DEFAULT_PRECISION = 6;
const FLOAT_REGEXP = /(-?)(\d)\.?(\d*)e([+-])(\d+)/;
var F;
(function(F) {
    F[F["sign"] = 1] = "sign";
    F[F["mantissa"] = 2] = "mantissa";
    F[F["fractional"] = 3] = "fractional";
    F[F["esign"] = 4] = "esign";
    F[F["exponent"] = 5] = "exponent";
})(F || (F = {}));
class Printf {
    format;
    args;
    i;
    state = State.PASSTHROUGH;
    verb = "";
    buf = "";
    argNum = 0;
    flags = new Flags();
    haveSeen;
    // barf, store precision and width errors for later processing ...
    tmpError;
    constructor(format, ...args){
        this.format = format;
        this.args = args;
        this.haveSeen = Array.from({
            length: args.length
        });
        this.i = 0;
    }
    doPrintf() {
        for(; this.i < this.format.length; ++this.i){
            const c = this.format[this.i];
            switch(this.state){
                case State.PASSTHROUGH:
                    if (c === "%") {
                        this.state = State.PERCENT;
                    } else {
                        this.buf += c;
                    }
                    break;
                case State.PERCENT:
                    if (c === "%") {
                        this.buf += c;
                        this.state = State.PASSTHROUGH;
                    } else {
                        this.handleFormat();
                    }
                    break;
                default:
                    throw Error("Should be unreachable, certainly a bug in the lib.");
            }
        }
        // check for unhandled args
        let extras = false;
        let err = "%!(EXTRA";
        for(let i = 0; i !== this.haveSeen.length; ++i){
            if (!this.haveSeen[i]) {
                extras = true;
                err += ` '${Deno.inspect(this.args[i])}'`;
            }
        }
        err += ")";
        if (extras) {
            this.buf += err;
        }
        return this.buf;
    }
    // %[<positional>]<flag>...<verb>
    handleFormat() {
        this.flags = new Flags();
        const flags = this.flags;
        for(; this.i < this.format.length; ++this.i){
            const c = this.format[this.i];
            switch(this.state){
                case State.PERCENT:
                    switch(c){
                        case "[":
                            this.handlePositional();
                            this.state = State.POSITIONAL;
                            break;
                        case "+":
                            flags.plus = true;
                            break;
                        case "<":
                            flags.lessthan = true;
                            break;
                        case "-":
                            flags.dash = true;
                            flags.zero = false; // only left pad zeros, dash takes precedence
                            break;
                        case "#":
                            flags.sharp = true;
                            break;
                        case " ":
                            flags.space = true;
                            break;
                        case "0":
                            // only left pad zeros, dash takes precedence
                            flags.zero = !flags.dash;
                            break;
                        default:
                            if ("1" <= c && c <= "9" || c === "." || c === "*") {
                                if (c === ".") {
                                    this.flags.precision = 0;
                                    this.state = State.PRECISION;
                                    this.i++;
                                } else {
                                    this.state = State.WIDTH;
                                }
                                this.handleWidthAndPrecision(flags);
                            } else {
                                this.handleVerb();
                                return; // always end in verb
                            }
                    } // switch c
                    break;
                case State.POSITIONAL:
                    // TODO(bartlomieju): either a verb or * only verb for now
                    if (c === "*") {
                        const worp = this.flags.precision === -1 ? WorP.WIDTH : WorP.PRECISION;
                        this.handleWidthOrPrecisionRef(worp);
                        this.state = State.PERCENT;
                        break;
                    } else {
                        this.handleVerb();
                        return; // always end in verb
                    }
                default:
                    throw new Error(`Should not be here ${this.state}, library bug!`);
            } // switch state
        }
    }
    /**
   * Handle width or precision
   * @param wOrP
   */ handleWidthOrPrecisionRef(wOrP) {
        if (this.argNum >= this.args.length) {
            // handle Positional should have already taken care of it...
            return;
        }
        const arg = this.args[this.argNum];
        this.haveSeen[this.argNum] = true;
        if (typeof arg === "number") {
            switch(wOrP){
                case WorP.WIDTH:
                    this.flags.width = arg;
                    break;
                default:
                    this.flags.precision = arg;
            }
        } else {
            const tmp = wOrP === WorP.WIDTH ? "WIDTH" : "PREC";
            this.tmpError = `%!(BAD ${tmp} '${this.args[this.argNum]}')`;
        }
        this.argNum++;
    }
    /**
   * Handle width and precision
   * @param flags
   */ handleWidthAndPrecision(flags) {
        const fmt = this.format;
        for(; this.i !== this.format.length; ++this.i){
            const c = fmt[this.i];
            switch(this.state){
                case State.WIDTH:
                    switch(c){
                        case ".":
                            // initialize precision, %9.f -> precision=0
                            this.flags.precision = 0;
                            this.state = State.PRECISION;
                            break;
                        case "*":
                            this.handleWidthOrPrecisionRef(WorP.WIDTH);
                            break;
                        default:
                            {
                                const val = parseInt(c);
                                // most likely parseInt does something stupid that makes
                                // it unusable for this scenario ...
                                // if we encounter a non (number|*|.) we're done with prec & wid
                                if (isNaN(val)) {
                                    this.i--;
                                    this.state = State.PERCENT;
                                    return;
                                }
                                flags.width = flags.width == -1 ? 0 : flags.width;
                                flags.width *= 10;
                                flags.width += val;
                            }
                    } // switch c
                    break;
                case State.PRECISION:
                    {
                        if (c === "*") {
                            this.handleWidthOrPrecisionRef(WorP.PRECISION);
                            break;
                        }
                        const val1 = parseInt(c);
                        if (isNaN(val1)) {
                            // one too far, rewind
                            this.i--;
                            this.state = State.PERCENT;
                            return;
                        }
                        flags.precision *= 10;
                        flags.precision += val1;
                        break;
                    }
                default:
                    throw new Error("can't be here. bug.");
            } // switch state
        }
    }
    /** Handle positional */ handlePositional() {
        if (this.format[this.i] !== "[") {
            // sanity only
            throw new Error("Can't happen? Bug.");
        }
        let positional = 0;
        const format = this.format;
        this.i++;
        let err = false;
        for(; this.i !== this.format.length; ++this.i){
            if (format[this.i] === "]") {
                break;
            }
            positional *= 10;
            const val = parseInt(format[this.i]);
            if (isNaN(val)) {
                //throw new Error(
                //  `invalid character in positional: ${format}[${format[this.i]}]`
                //);
                this.tmpError = "%!(BAD INDEX)";
                err = true;
            }
            positional += val;
        }
        if (positional - 1 >= this.args.length) {
            this.tmpError = "%!(BAD INDEX)";
            err = true;
        }
        this.argNum = err ? this.argNum : positional - 1;
        return;
    }
    /** Handle less than */ handleLessThan() {
        // deno-lint-ignore no-explicit-any
        const arg = this.args[this.argNum];
        if ((arg || {}).constructor.name !== "Array") {
            throw new Error(`arg ${arg} is not an array. Todo better error handling`);
        }
        let str = "[ ";
        for(let i = 0; i !== arg.length; ++i){
            if (i !== 0) str += ", ";
            str += this._handleVerb(arg[i]);
        }
        return str + " ]";
    }
    /** Handle verb */ handleVerb() {
        const verb = this.format[this.i];
        this.verb = verb;
        if (this.tmpError) {
            this.buf += this.tmpError;
            this.tmpError = undefined;
            if (this.argNum < this.haveSeen.length) {
                this.haveSeen[this.argNum] = true; // keep track of used args
            }
        } else if (this.args.length <= this.argNum) {
            this.buf += `%!(MISSING '${verb}')`;
        } else {
            const arg = this.args[this.argNum]; // check out of range
            this.haveSeen[this.argNum] = true; // keep track of used args
            if (this.flags.lessthan) {
                this.buf += this.handleLessThan();
            } else {
                this.buf += this._handleVerb(arg);
            }
        }
        this.argNum++; // if there is a further positional, it will reset.
        this.state = State.PASSTHROUGH;
    }
    // deno-lint-ignore no-explicit-any
    _handleVerb(arg) {
        switch(this.verb){
            case "t":
                return this.pad(arg.toString());
            case "b":
                return this.fmtNumber(arg, 2);
            case "c":
                return this.fmtNumberCodePoint(arg);
            case "d":
                return this.fmtNumber(arg, 10);
            case "o":
                return this.fmtNumber(arg, 8);
            case "x":
                return this.fmtHex(arg);
            case "X":
                return this.fmtHex(arg, true);
            case "e":
                return this.fmtFloatE(arg);
            case "E":
                return this.fmtFloatE(arg, true);
            case "f":
            case "F":
                return this.fmtFloatF(arg);
            case "g":
                return this.fmtFloatG(arg);
            case "G":
                return this.fmtFloatG(arg, true);
            case "s":
                return this.fmtString(arg);
            case "T":
                return this.fmtString(typeof arg);
            case "v":
                return this.fmtV(arg);
            case "j":
                return this.fmtJ(arg);
            default:
                return `%!(BAD VERB '${this.verb}')`;
        }
    }
    /**
   * Pad a string
   * @param s text to pad
   */ pad(s) {
        const padding = this.flags.zero ? "0" : " ";
        if (this.flags.dash) {
            return s.padEnd(this.flags.width, padding);
        }
        return s.padStart(this.flags.width, padding);
    }
    /**
   * Pad a number
   * @param nStr
   * @param neg
   */ padNum(nStr, neg) {
        let sign;
        if (neg) {
            sign = "-";
        } else if (this.flags.plus || this.flags.space) {
            sign = this.flags.plus ? "+" : " ";
        } else {
            sign = "";
        }
        const zero = this.flags.zero;
        if (!zero) {
            // sign comes in front of padding when padding w/ zero,
            // in from of value if padding with spaces.
            nStr = sign + nStr;
        }
        const pad = zero ? "0" : " ";
        const len = zero ? this.flags.width - sign.length : this.flags.width;
        if (this.flags.dash) {
            nStr = nStr.padEnd(len, pad);
        } else {
            nStr = nStr.padStart(len, pad);
        }
        if (zero) {
            // see above
            nStr = sign + nStr;
        }
        return nStr;
    }
    /**
   * Format a number
   * @param n
   * @param radix
   * @param upcase
   */ fmtNumber(n, radix, upcase = false) {
        let num = Math.abs(n).toString(radix);
        const prec = this.flags.precision;
        if (prec !== -1) {
            this.flags.zero = false;
            num = n === 0 && prec === 0 ? "" : num;
            while(num.length < prec){
                num = "0" + num;
            }
        }
        let prefix = "";
        if (this.flags.sharp) {
            switch(radix){
                case 2:
                    prefix += "0b";
                    break;
                case 8:
                    // don't annotate octal 0 with 0...
                    prefix += num.startsWith("0") ? "" : "0";
                    break;
                case 16:
                    prefix += "0x";
                    break;
                default:
                    throw new Error("cannot handle base: " + radix);
            }
        }
        // don't add prefix in front of value truncated by precision=0, val=0
        num = num.length === 0 ? num : prefix + num;
        if (upcase) {
            num = num.toUpperCase();
        }
        return this.padNum(num, n < 0);
    }
    /**
   * Format number with code points
   * @param n
   */ fmtNumberCodePoint(n) {
        let s = "";
        try {
            s = String.fromCodePoint(n);
        } catch  {
            s = UNICODE_REPLACEMENT_CHARACTER;
        }
        return this.pad(s);
    }
    /**
   * Format special float
   * @param n
   */ fmtFloatSpecial(n) {
        // formatting of NaN and Inf are pants-on-head
        // stupid and more or less arbitrary.
        if (isNaN(n)) {
            this.flags.zero = false;
            return this.padNum("NaN", false);
        }
        if (n === Number.POSITIVE_INFINITY) {
            this.flags.zero = false;
            this.flags.plus = true;
            return this.padNum("Inf", false);
        }
        if (n === Number.NEGATIVE_INFINITY) {
            this.flags.zero = false;
            return this.padNum("Inf", true);
        }
        return "";
    }
    /**
   * Round fraction to precision
   * @param fractional
   * @param precision
   * @returns tuple of fractional and round
   */ roundFractionToPrecision(fractional, precision) {
        let round = false;
        if (fractional.length > precision) {
            fractional = "1" + fractional; // prepend a 1 in case of leading 0
            let tmp = parseInt(fractional.substr(0, precision + 2)) / 10;
            tmp = Math.round(tmp);
            fractional = Math.floor(tmp).toString();
            round = fractional[0] === "2";
            fractional = fractional.substr(1); // remove extra 1
        } else {
            while(fractional.length < precision){
                fractional += "0";
            }
        }
        return [
            fractional,
            round
        ];
    }
    /**
   * Format float E
   * @param n
   * @param upcase
   */ fmtFloatE(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen, bug");
        }
        let fractional = m[F.fractional];
        const precision = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        let rounding = false;
        [fractional, rounding] = this.roundFractionToPrecision(fractional, precision);
        let e = m[F.exponent];
        let esign = m[F.esign];
        // scientific notation output with exponent padded to minlen 2
        let mantissa = parseInt(m[F.mantissa]);
        if (rounding) {
            mantissa += 1;
            if (10 <= mantissa) {
                mantissa = 1;
                const r = parseInt(esign + e) + 1;
                e = r.toString();
                esign = r < 0 ? "-" : "+";
            }
        }
        e = e.length == 1 ? "0" + e : e;
        const val = `${mantissa}.${fractional}${upcase ? "E" : "e"}${esign}${e}`;
        return this.padNum(val, n < 0);
    }
    /**
   * Format float F
   * @param n
   */ fmtFloatF(n) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        // stupid helper that turns a number into a (potentially)
        // VERY long string.
        function expandNumber(n) {
            if (Number.isSafeInteger(n)) {
                return n.toString() + ".";
            }
            const t = n.toExponential().split("e");
            let m = t[0].replace(".", "");
            const e = parseInt(t[1]);
            if (e < 0) {
                let nStr = "0.";
                for(let i = 0; i !== Math.abs(e) - 1; ++i){
                    nStr += "0";
                }
                return nStr += m;
            } else {
                const splIdx = e + 1;
                while(m.length < splIdx){
                    m += "0";
                }
                return m.substr(0, splIdx) + "." + m.substr(splIdx);
            }
        }
        // avoiding sign makes padding easier
        const val = expandNumber(Math.abs(n));
        const arr = val.split(".");
        let dig = arr[0];
        let fractional = arr[1];
        const precision = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        let round = false;
        [fractional, round] = this.roundFractionToPrecision(fractional, precision);
        if (round) {
            dig = (parseInt(dig) + 1).toString();
        }
        return this.padNum(`${dig}.${fractional}`, n < 0);
    }
    /**
   * Format float G
   * @param n
   * @param upcase
   */ fmtFloatG(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        // The double argument representing a floating-point number shall be
        // converted in the style f or e (or in the style F or E in
        // the case of a G conversion specifier), depending on the
        // value converted and the precision. Let P equal the
        // precision if non-zero, 6 if the precision is omitted, or 1
        // if the precision is zero. Then, if a conversion with style E would
        // have an exponent of X:
        //     - If P > X>=-4, the conversion shall be with style f (or F )
        //     and precision P -( X+1).
        //     - Otherwise, the conversion shall be with style e (or E )
        //     and precision P -1.
        // Finally, unless the '#' flag is used, any trailing zeros shall be
        // removed from the fractional portion of the result and the
        // decimal-point character shall be removed if there is no
        // fractional portion remaining.
        // A double argument representing an infinity or NaN shall be
        // converted in the style of an f or F conversion specifier.
        // https://pubs.opengroup.org/onlinepubs/9699919799/functions/fprintf.html
        let P = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        P = P === 0 ? 1 : P;
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen");
        }
        const X = parseInt(m[F.exponent]) * (m[F.esign] === "-" ? -1 : 1);
        let nStr = "";
        if (P > X && X >= -4) {
            this.flags.precision = P - (X + 1);
            nStr = this.fmtFloatF(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*$/, "");
            }
        } else {
            this.flags.precision = P - 1;
            nStr = this.fmtFloatE(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*e/, upcase ? "E" : "e");
            }
        }
        return nStr;
    }
    /**
   * Format string
   * @param s
   */ fmtString(s) {
        if (this.flags.precision !== -1) {
            s = s.substr(0, this.flags.precision);
        }
        return this.pad(s);
    }
    /**
   * Format hex
   * @param val
   * @param upper
   */ fmtHex(val, upper = false) {
        // allow others types ?
        switch(typeof val){
            case "number":
                return this.fmtNumber(val, 16, upper);
            case "string":
                {
                    const sharp = this.flags.sharp && val.length !== 0;
                    let hex = sharp ? "0x" : "";
                    const prec = this.flags.precision;
                    const end = prec !== -1 ? min(prec, val.length) : val.length;
                    for(let i = 0; i !== end; ++i){
                        if (i !== 0 && this.flags.space) {
                            hex += sharp ? " 0x" : " ";
                        }
                        // TODO(bartlomieju): for now only taking into account the
                        // lower half of the codePoint, ie. as if a string
                        // is a list of 8bit values instead of UCS2 runes
                        const c = (val.charCodeAt(i) & 0xff).toString(16);
                        hex += c.length === 1 ? `0${c}` : c;
                    }
                    if (upper) {
                        hex = hex.toUpperCase();
                    }
                    return this.pad(hex);
                }
            default:
                throw new Error("currently only number and string are implemented for hex");
        }
    }
    /**
   * Format value
   * @param val
   */ fmtV(val) {
        if (this.flags.sharp) {
            const options = this.flags.precision !== -1 ? {
                depth: this.flags.precision
            } : {};
            return this.pad(Deno.inspect(val, options));
        } else {
            const p = this.flags.precision;
            return p === -1 ? val.toString() : val.toString().substr(0, p);
        }
    }
    /**
   * Format JSON
   * @param val
   */ fmtJ(val) {
        return JSON.stringify(val);
    }
}
/**
 * Converts and format a variable number of `args` as is specified by `format`.
 * `sprintf` returns the formatted string.
 *
 * @param format
 * @param args
 */ export function sprintf(format, ...args) {
    const printf = new Printf(format, ...args);
    return printf.doPrintf();
}
/**
 * Converts and format a variable number of `args` as is specified by `format`.
 * `printf` writes the formatted string to standard output.
 * @param format
 * @param args
 */ export function printf(format, ...args) {
    const s = sprintf(format, ...args);
    Deno.stdout.writeSync(new TextEncoder().encode(s));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2ZtdC9wcmludGYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLyoqXG4gKiB7QGxpbmtjb2RlIHNwcmludGZ9IGFuZCB7QGxpbmtjb2RlIHByaW50Zn0gZm9yIHByaW50aW5nIGZvcm1hdHRlZCBzdHJpbmdzIHRvXG4gKiBzdGRvdXQuXG4gKlxuICogVGhpcyBpbXBsZW1lbnRhdGlvbiBpcyBpbnNwaXJlZCBieSBQT1NJWCBhbmQgR29sYW5nIGJ1dCBkb2VzIG5vdCBwb3J0XG4gKiBpbXBsZW1lbnRhdGlvbiBjb2RlLlxuICpcbiAqIHNwcmludGYgY29udmVydHMgYW5kIGZvcm1hdHMgYSB2YXJpYWJsZSBudW1iZXIgb2YgYXJndW1lbnRzIGFzIGlzIHNwZWNpZmllZFxuICogYnkgYSBgZm9ybWF0IHN0cmluZ2AuIEluIGl0J3MgYmFzaWMgZm9ybSwgYSBmb3JtYXQgc3RyaW5nIG1heSBqdXN0IGJlIGFcbiAqIGxpdGVyYWwuIEluIGNhc2UgYXJndW1lbnRzIGFyZSBtZWFudCB0byBiZSBmb3JtYXR0ZWQsIGEgYGRpcmVjdGl2ZWAgaXNcbiAqIGNvbnRhaW5lZCBpbiB0aGUgZm9ybWF0IHN0cmluZywgcHJlY2VkZWQgYnkgYSAnJScgY2hhcmFjdGVyOlxuICpcbiAqICAgICAlPHZlcmI+XG4gKlxuICogRS5nLiB0aGUgdmVyYiBgc2AgaW5kaWNhdGVzIHRoZSBkaXJlY3RpdmUgc2hvdWxkIGJlIHJlcGxhY2VkIGJ5IHRoZSBzdHJpbmdcbiAqIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBhcmd1bWVudCBpbiB0aGUgY29ycmVzcG9uZGluZyBwb3NpdGlvbiBvZiB0aGUgYXJndW1lbnRcbiAqIGxpc3QuIEUuZy46XG4gKlxuICogICAgIEhlbGxvICVzIVxuICpcbiAqIGFwcGxpZWQgdG8gdGhlIGFyZ3VtZW50cyBcIldvcmxkXCIgeWllbGRzIFwiSGVsbG8gV29ybGQhXCIuXG4gKlxuICogVGhlIG1lYW5pbmcgb2YgdGhlIGZvcm1hdCBzdHJpbmcgaXMgbW9kZWxsZWQgYWZ0ZXIgW1BPU0lYXVsxXSBmb3JtYXQgc3RyaW5nc1xuICogYXMgd2VsbCBhcyB3ZWxsIGFzIFtHb2xhbmcgZm9ybWF0IHN0cmluZ3NdWzJdLiBCb3RoIGNvbnRhaW4gZWxlbWVudHMgc3BlY2lmaWNcbiAqIHRvIHRoZSByZXNwZWN0aXZlIHByb2dyYW1taW5nIGxhbmd1YWdlIHRoYXQgZG9uJ3QgYXBwbHkgdG8gSmF2YVNjcmlwdCwgc29cbiAqIHRoZXkgY2FuIG5vdCBiZSBmdWxseSBzdXBwb3J0ZWQuIEZ1cnRoZXJtb3JlIHdlIGltcGxlbWVudCBzb21lIGZ1bmN0aW9uYWxpdHlcbiAqIHRoYXQgaXMgc3BlY2lmaWMgdG8gSlMuXG4gKlxuICogIyMgVmVyYnNcbiAqXG4gKiBUaGUgZm9sbG93aW5nIHZlcmJzIGFyZSBzdXBwb3J0ZWQ6XG4gKlxuICogfCBWZXJiICB8IE1lYW5pbmcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8XG4gKiB8IGAlYCAgIHwgcHJpbnQgYSBsaXRlcmFsIHBlcmNlbnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgdGAgICB8IGV2YWx1YXRlIGFyZyBhcyBib29sZWFuLCBwcmludCBgdHJ1ZWAgb3IgYGZhbHNlYCAgICAgICAgICAgICAgIHxcbiAqIHwgYGJgICAgfCBldmFsIGFzIG51bWJlciwgcHJpbnQgYmluYXJ5ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IGBjYCAgIHwgZXZhbCBhcyBudW1iZXIsIHByaW50IGNoYXJhY3RlciBjb3JyZXNwb25kaW5nIHRvIHRoZSBjb2RlUG9pbnQgfFxuICogfCBgb2AgICB8IGV2YWwgYXMgbnVtYmVyLCBwcmludCBvY3RhbCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgYHggWGAgfCBwcmludCBhcyBoZXggKGZmIEZGKSwgdHJlYXQgc3RyaW5nIGFzIGxpc3Qgb2YgYnl0ZXMgICAgICAgICAgICB8XG4gKiB8IGBlIEVgIHwgcHJpbnQgbnVtYmVyIGluIHNjaWVudGlmaWMvZXhwb25lbnQgZm9ybWF0IDEuMTIzMTIzZSswMSAgICAgICAgfFxuICogfCBgZiBGYCB8IHByaW50IG51bWJlciBhcyBmbG9hdCB3aXRoIGRlY2ltYWwgcG9pbnQgYW5kIG5vIGV4cG9uZW50ICAgICAgIHxcbiAqIHwgYGcgR2AgfCB1c2UgJWUgJUUgb3IgJWYgJUYgZGVwZW5kaW5nIG9uIHNpemUgb2YgYXJndW1lbnQgICAgICAgICAgICAgICB8XG4gKiB8IGBzYCAgIHwgaW50ZXJwb2xhdGUgc3RyaW5nICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgVGAgICB8IHR5cGUgb2YgYXJnLCBhcyByZXR1cm5lZCBieSBgdHlwZW9mYCAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgYHZgICAgfCB2YWx1ZSBvZiBhcmd1bWVudCBpbiAnZGVmYXVsdCcgZm9ybWF0IChzZWUgYmVsb3cpICAgICAgICAgICAgICB8XG4gKiB8IGBqYCAgIHwgYXJndW1lbnQgYXMgZm9ybWF0dGVkIGJ5IGBKU09OLnN0cmluZ2lmeWAgICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqICMjIFdpZHRoIGFuZCBQcmVjaXNpb25cbiAqXG4gKiBWZXJicyBtYXkgYmUgbW9kaWZpZWQgYnkgcHJvdmlkaW5nIHRoZW0gd2l0aCB3aWR0aCBhbmQgcHJlY2lzaW9uLCBlaXRoZXIgb3JcbiAqIGJvdGggbWF5IGJlIG9taXR0ZWQ6XG4gKlxuICogICAgICU5ZiAgICB3aWR0aCA5LCBkZWZhdWx0IHByZWNpc2lvblxuICogICAgICUuOWYgICBkZWZhdWx0IHdpZHRoLCBwcmVjaXNpb24gOVxuICogICAgICU4LjlmICB3aWR0aCA4LCBwcmVjaXNpb24gOVxuICogICAgICU4LmYgICB3aWR0aCA5LCBwcmVjaXNpb24gMFxuICpcbiAqIEluIGdlbmVyYWwsICd3aWR0aCcgZGVzY3JpYmVzIHRoZSBtaW5pbXVtIGxlbmd0aCBvZiB0aGUgb3V0cHV0LCB3aGlsZVxuICogJ3ByZWNpc2lvbicgbGltaXRzIHRoZSBvdXRwdXQuXG4gKlxuICogfCB2ZXJiICAgICAgfCBwcmVjaXNpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAtLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCBgdGAgICAgICAgfCBuL2EgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgYiBjIG9gICAgfCBuL2EgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgeCBYYCAgICAgfCBuL2EgZm9yIG51bWJlciwgc3RyaW5ncyBhcmUgdHJ1bmNhdGVkIHRvIHAgYnl0ZXMoISkgICAgICAgICAgICAgfFxuICogfCBgZSBFIGYgRmAgfCBudW1iZXIgb2YgcGxhY2VzIGFmdGVyIGRlY2ltYWwsIGRlZmF1bHQgNiAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgZyBHYCAgICAgfCBzZXQgbWF4aW11bSBudW1iZXIgb2YgZGlnaXRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgc2AgICAgICAgfCB0cnVuY2F0ZSBpbnB1dCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgVGAgICAgICAgfCB0cnVuY2F0ZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgdmAgICAgICAgfCB0cnVuY2F0ZSwgb3IgZGVwdGggaWYgdXNlZCB3aXRoICMgc2VlIFwiJ2RlZmF1bHQnIGZvcm1hdFwiLCBiZWxvdyB8XG4gKiB8IGBqYCAgICAgICB8IG4vYSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKlxuICogTnVtZXJpY2FsIHZhbHVlcyBmb3Igd2lkdGggYW5kIHByZWNpc2lvbiBjYW4gYmUgc3Vic3RpdHV0ZWQgZm9yIHRoZSBgKmAgY2hhcixcbiAqIGluIHdoaWNoIGNhc2UgdGhlIHZhbHVlcyBhcmUgb2J0YWluZWQgZnJvbSB0aGUgbmV4dCBhcmdzLCBlLmcuOlxuICpcbiAqICAgICBzcHJpbnRmKFwiJSouKmZcIiwgOSwgOCwgNDU2LjApXG4gKlxuICogaXMgZXF1aXZhbGVudCB0bzpcbiAqXG4gKiAgICAgc3ByaW50ZihcIiU5LjhmXCIsIDQ1Ni4wKVxuICpcbiAqICMjIEZsYWdzXG4gKlxuICogVGhlIGVmZmVjdHMgb2YgdGhlIHZlcmIgbWF5IGJlIGZ1cnRoZXIgaW5mbHVlbmNlZCBieSB1c2luZyBmbGFncyB0byBtb2RpZnlcbiAqIHRoZSBkaXJlY3RpdmU6XG4gKlxuICogfCBGbGFnICB8IFZlcmIgICAgICB8IE1lYW5pbmcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgLS0tLS0gfCAtLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8XG4gKiB8IGArYCAgIHwgbnVtZXJpYyAgIHwgYWx3YXlzIHByaW50IHNpZ24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgLWAgICB8IGFsbCAgICAgICB8IHBhZCB0byB0aGUgcmlnaHQgKGxlZnQganVzdGlmeSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgYCNgICAgfCAgICAgICAgICAgfCBhbHRlcm5hdGUgZm9ybWF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IGAjYCAgIHwgYGIgbyB4IFhgIHwgcHJlZml4IHdpdGggYDBiIDAgMHhgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgI2AgICB8IGBnIEdgICAgICB8IGRvbid0IHJlbW92ZSB0cmFpbGluZyB6ZXJvcyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgYCNgICAgfCBgdmAgICAgICAgfCB1ZXMgb3V0cHV0IG9mIGBpbnNwZWN0YCBpbnN0ZWFkIG9mIGB0b1N0cmluZ2AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IGAnICdgIHwgICAgICAgICAgIHwgc3BhY2UgY2hhcmFjdGVyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBgJyAnYCB8IGB4IFhgICAgICB8IGxlYXZlIHNwYWNlcyBiZXR3ZWVuIGJ5dGVzIHdoZW4gcHJpbnRpbmcgc3RyaW5nICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgYCcgJ2AgfCBgZGAgICAgICAgfCBpbnNlcnQgc3BhY2UgZm9yIG1pc3NpbmcgYCtgIHNpZ24gY2hhcmFjdGVyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IGAwYCAgIHwgYWxsICAgICAgIHwgcGFkIHdpdGggemVybywgYC1gIHRha2VzIHByZWNlZGVuY2UsIHNpZ24gaXMgYXBwZW5kZWQgaW4gZnJvbnQgb2YgcGFkZGluZyAgfFxuICogfCBgPGAgICB8IGFsbCAgICAgICB8IGZvcm1hdCBlbGVtZW50cyBvZiB0aGUgcGFzc2VkIGFycmF5IGFjY29yZGluZyB0byB0aGUgZGlyZWN0aXZlIChleHRlbnNpb24pIHxcbiAqXG4gKiAjIyAnZGVmYXVsdCcgZm9ybWF0XG4gKlxuICogVGhlIGRlZmF1bHQgZm9ybWF0IHVzZWQgYnkgYCV2YCBpcyB0aGUgcmVzdWx0IG9mIGNhbGxpbmcgYHRvU3RyaW5nKClgIG9uIHRoZVxuICogcmVsZXZhbnQgYXJndW1lbnQuIElmIHRoZSBgI2AgZmxhZ3MgaXMgdXNlZCwgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIGBpbnNwZWN0KClgXG4gKiBpcyBpbnRlcnBvbGF0ZWQuIEluIHRoaXMgY2FzZSwgdGhlIHByZWNpc2lvbiwgaWYgc2V0IGlzIHBhc3NlZCB0byBgaW5zcGVjdCgpYFxuICogYXMgdGhlICdkZXB0aCcgY29uZmlnIHBhcmFtZXRlci5cbiAqXG4gKiAjIyBQb3NpdGlvbmFsIGFyZ3VtZW50c1xuICpcbiAqIEFyZ3VtZW50cyBkbyBub3QgbmVlZCB0byBiZSBjb25zdW1lZCBpbiB0aGUgb3JkZXIgdGhleSBhcmUgcHJvdmlkZWQgYW5kIG1heVxuICogYmUgY29uc3VtZWQgbW9yZSB0aGFuIG9uY2UuIEUuZy46XG4gKlxuICogICAgIHNwcmludGYoXCIlWzJdcyAlWzFdc1wiLCBcIldvcmxkXCIsIFwiSGVsbG9cIilcbiAqXG4gKiByZXR1cm5zIFwiSGVsbG8gV29ybGRcIi4gVGhlIHByZXNlbmNlIG9mIGEgcG9zaXRpb25hbCBpbmRpY2F0b3IgcmVzZXRzIHRoZSBhcmdcbiAqIGNvdW50ZXIgYWxsb3dpbmcgYXJncyB0byBiZSByZXVzZWQ6XG4gKlxuICogICAgIHNwcmludGYoXCJkZWNbJWRdPSVkIGhleFslWzFdZF09JXggb2N0WyVbMV1kXT0lI28gJXNcIiwgMSwgMjU1LCBcIlRoaXJkXCIpXG4gKlxuICogcmV0dXJucyBgZGVjWzFdPTI1NSBoZXhbMV09MHhmZiBvY3RbMV09MDM3NyBUaGlyZGBcbiAqXG4gKiBXaWR0aCBhbmQgcHJlY2lzaW9uIG15IGFsc28gdXNlIHBvc2l0aW9uYWxzOlxuICpcbiAqICAgICBcIiVbMl0qLlsxXSpkXCIsIDEsIDJcbiAqXG4gKiBUaGlzIGZvbGxvd3MgdGhlIGdvbGFuZyBjb252ZW50aW9ucyBhbmQgbm90IFBPU0lYLlxuICpcbiAqICMjIEVycm9yc1xuICpcbiAqIFRoZSBmb2xsb3dpbmcgZXJyb3JzIGFyZSBoYW5kbGVkOlxuICpcbiAqIEluY29ycmVjdCB2ZXJiOlxuICpcbiAqICAgICBTKFwiJWhcIiwgXCJcIikgJSEoQkFEIFZFUkIgJ2gnKVxuICpcbiAqIFRvbyBmZXcgYXJndW1lbnRzOlxuICpcbiAqICAgICBTKFwiJWRcIikgJSEoTUlTU0lORyAnZCcpXCJcbiAqXG4gKiBbMV06IGh0dHBzOi8vcHVicy5vcGVuZ3JvdXAub3JnL29ubGluZXB1YnMvMDA5Njk1Mzk5L2Z1bmN0aW9ucy9mcHJpbnRmLmh0bWxcbiAqIFsyXTogaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9mbXQvXG4gKlxuICogQG1vZHVsZVxuICovXG5cbmVudW0gU3RhdGUge1xuICBQQVNTVEhST1VHSCxcbiAgUEVSQ0VOVCxcbiAgUE9TSVRJT05BTCxcbiAgUFJFQ0lTSU9OLFxuICBXSURUSCxcbn1cblxuZW51bSBXb3JQIHtcbiAgV0lEVEgsXG4gIFBSRUNJU0lPTixcbn1cblxuY2xhc3MgRmxhZ3Mge1xuICBwbHVzPzogYm9vbGVhbjtcbiAgZGFzaD86IGJvb2xlYW47XG4gIHNoYXJwPzogYm9vbGVhbjtcbiAgc3BhY2U/OiBib29sZWFuO1xuICB6ZXJvPzogYm9vbGVhbjtcbiAgbGVzc3RoYW4/OiBib29sZWFuO1xuICB3aWR0aCA9IC0xO1xuICBwcmVjaXNpb24gPSAtMTtcbn1cblxuY29uc3QgbWluID0gTWF0aC5taW47XG5jb25zdCBVTklDT0RFX1JFUExBQ0VNRU5UX0NIQVJBQ1RFUiA9IFwiXFx1ZmZmZFwiO1xuY29uc3QgREVGQVVMVF9QUkVDSVNJT04gPSA2O1xuY29uc3QgRkxPQVRfUkVHRVhQID0gLygtPykoXFxkKVxcLj8oXFxkKillKFsrLV0pKFxcZCspLztcblxuZW51bSBGIHtcbiAgc2lnbiA9IDEsXG4gIG1hbnRpc3NhLFxuICBmcmFjdGlvbmFsLFxuICBlc2lnbixcbiAgZXhwb25lbnQsXG59XG5cbmNsYXNzIFByaW50ZiB7XG4gIGZvcm1hdDogc3RyaW5nO1xuICBhcmdzOiB1bmtub3duW107XG4gIGk6IG51bWJlcjtcblxuICBzdGF0ZTogU3RhdGUgPSBTdGF0ZS5QQVNTVEhST1VHSDtcbiAgdmVyYiA9IFwiXCI7XG4gIGJ1ZiA9IFwiXCI7XG4gIGFyZ051bSA9IDA7XG4gIGZsYWdzOiBGbGFncyA9IG5ldyBGbGFncygpO1xuXG4gIGhhdmVTZWVuOiBib29sZWFuW107XG5cbiAgLy8gYmFyZiwgc3RvcmUgcHJlY2lzaW9uIGFuZCB3aWR0aCBlcnJvcnMgZm9yIGxhdGVyIHByb2Nlc3NpbmcgLi4uXG4gIHRtcEVycm9yPzogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pIHtcbiAgICB0aGlzLmZvcm1hdCA9IGZvcm1hdDtcbiAgICB0aGlzLmFyZ3MgPSBhcmdzO1xuICAgIHRoaXMuaGF2ZVNlZW4gPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiBhcmdzLmxlbmd0aCB9KTtcbiAgICB0aGlzLmkgPSAwO1xuICB9XG5cbiAgZG9QcmludGYoKTogc3RyaW5nIHtcbiAgICBmb3IgKDsgdGhpcy5pIDwgdGhpcy5mb3JtYXQubGVuZ3RoOyArK3RoaXMuaSkge1xuICAgICAgY29uc3QgYyA9IHRoaXMuZm9ybWF0W3RoaXMuaV07XG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSBTdGF0ZS5QQVNTVEhST1VHSDpcbiAgICAgICAgICBpZiAoYyA9PT0gXCIlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZiArPSBjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5QRVJDRU5UOlxuICAgICAgICAgIGlmIChjID09PSBcIiVcIikge1xuICAgICAgICAgICAgdGhpcy5idWYgKz0gYztcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVNTVEhST1VHSDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVGb3JtYXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgRXJyb3IoXCJTaG91bGQgYmUgdW5yZWFjaGFibGUsIGNlcnRhaW5seSBhIGJ1ZyBpbiB0aGUgbGliLlwiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgZm9yIHVuaGFuZGxlZCBhcmdzXG4gICAgbGV0IGV4dHJhcyA9IGZhbHNlO1xuICAgIGxldCBlcnIgPSBcIiUhKEVYVFJBXCI7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgIT09IHRoaXMuaGF2ZVNlZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmICghdGhpcy5oYXZlU2VlbltpXSkge1xuICAgICAgICBleHRyYXMgPSB0cnVlO1xuICAgICAgICBlcnIgKz0gYCAnJHtEZW5vLmluc3BlY3QodGhpcy5hcmdzW2ldKX0nYDtcbiAgICAgIH1cbiAgICB9XG4gICAgZXJyICs9IFwiKVwiO1xuICAgIGlmIChleHRyYXMpIHtcbiAgICAgIHRoaXMuYnVmICs9IGVycjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnVmO1xuICB9XG5cbiAgLy8gJVs8cG9zaXRpb25hbD5dPGZsYWc+Li4uPHZlcmI+XG4gIGhhbmRsZUZvcm1hdCgpIHtcbiAgICB0aGlzLmZsYWdzID0gbmV3IEZsYWdzKCk7XG4gICAgY29uc3QgZmxhZ3MgPSB0aGlzLmZsYWdzO1xuICAgIGZvciAoOyB0aGlzLmkgPCB0aGlzLmZvcm1hdC5sZW5ndGg7ICsrdGhpcy5pKSB7XG4gICAgICBjb25zdCBjID0gdGhpcy5mb3JtYXRbdGhpcy5pXTtcbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlIFN0YXRlLlBFUkNFTlQ6XG4gICAgICAgICAgc3dpdGNoIChjKSB7XG4gICAgICAgICAgICBjYXNlIFwiW1wiOlxuICAgICAgICAgICAgICB0aGlzLmhhbmRsZVBvc2l0aW9uYWwoKTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBPU0lUSU9OQUw7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIitcIjpcbiAgICAgICAgICAgICAgZmxhZ3MucGx1cyA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIjxcIjpcbiAgICAgICAgICAgICAgZmxhZ3MubGVzc3RoYW4gPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCItXCI6XG4gICAgICAgICAgICAgIGZsYWdzLmRhc2ggPSB0cnVlO1xuICAgICAgICAgICAgICBmbGFncy56ZXJvID0gZmFsc2U7IC8vIG9ubHkgbGVmdCBwYWQgemVyb3MsIGRhc2ggdGFrZXMgcHJlY2VkZW5jZVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIjXCI6XG4gICAgICAgICAgICAgIGZsYWdzLnNoYXJwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiIFwiOlxuICAgICAgICAgICAgICBmbGFncy5zcGFjZSA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIjBcIjpcbiAgICAgICAgICAgICAgLy8gb25seSBsZWZ0IHBhZCB6ZXJvcywgZGFzaCB0YWtlcyBwcmVjZWRlbmNlXG4gICAgICAgICAgICAgIGZsYWdzLnplcm8gPSAhZmxhZ3MuZGFzaDtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBpZiAoKFwiMVwiIDw9IGMgJiYgYyA8PSBcIjlcIikgfHwgYyA9PT0gXCIuXCIgfHwgYyA9PT0gXCIqXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gXCIuXCIpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gMDtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QUkVDSVNJT047XG4gICAgICAgICAgICAgICAgICB0aGlzLmkrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldJRFRIO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVdpZHRoQW5kUHJlY2lzaW9uKGZsYWdzKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVZlcmIoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vIGFsd2F5cyBlbmQgaW4gdmVyYlxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSAvLyBzd2l0Y2ggY1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLlBPU0lUSU9OQUw6XG4gICAgICAgICAgLy8gVE9ETyhiYXJ0bG9taWVqdSk6IGVpdGhlciBhIHZlcmIgb3IgKiBvbmx5IHZlcmIgZm9yIG5vd1xuICAgICAgICAgIGlmIChjID09PSBcIipcIikge1xuICAgICAgICAgICAgY29uc3Qgd29ycCA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uID09PSAtMVxuICAgICAgICAgICAgICA/IFdvclAuV0lEVEhcbiAgICAgICAgICAgICAgOiBXb3JQLlBSRUNJU0lPTjtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZih3b3JwKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlVmVyYigpO1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBhbHdheXMgZW5kIGluIHZlcmJcbiAgICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTaG91bGQgbm90IGJlIGhlcmUgJHt0aGlzLnN0YXRlfSwgbGlicmFyeSBidWchYCk7XG4gICAgICB9IC8vIHN3aXRjaCBzdGF0ZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgd2lkdGggb3IgcHJlY2lzaW9uXG4gICAqIEBwYXJhbSB3T3JQXG4gICAqL1xuICBoYW5kbGVXaWR0aE9yUHJlY2lzaW9uUmVmKHdPclA6IFdvclApIHtcbiAgICBpZiAodGhpcy5hcmdOdW0gPj0gdGhpcy5hcmdzLmxlbmd0aCkge1xuICAgICAgLy8gaGFuZGxlIFBvc2l0aW9uYWwgc2hvdWxkIGhhdmUgYWxyZWFkeSB0YWtlbiBjYXJlIG9mIGl0Li4uXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGFyZyA9IHRoaXMuYXJnc1t0aGlzLmFyZ051bV07XG4gICAgdGhpcy5oYXZlU2Vlblt0aGlzLmFyZ051bV0gPSB0cnVlO1xuICAgIGlmICh0eXBlb2YgYXJnID09PSBcIm51bWJlclwiKSB7XG4gICAgICBzd2l0Y2ggKHdPclApIHtcbiAgICAgICAgY2FzZSBXb3JQLldJRFRIOlxuICAgICAgICAgIHRoaXMuZmxhZ3Mud2lkdGggPSBhcmc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5mbGFncy5wcmVjaXNpb24gPSBhcmc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRtcCA9IHdPclAgPT09IFdvclAuV0lEVEggPyBcIldJRFRIXCIgOiBcIlBSRUNcIjtcbiAgICAgIHRoaXMudG1wRXJyb3IgPSBgJSEoQkFEICR7dG1wfSAnJHt0aGlzLmFyZ3NbdGhpcy5hcmdOdW1dfScpYDtcbiAgICB9XG4gICAgdGhpcy5hcmdOdW0rKztcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgd2lkdGggYW5kIHByZWNpc2lvblxuICAgKiBAcGFyYW0gZmxhZ3NcbiAgICovXG4gIGhhbmRsZVdpZHRoQW5kUHJlY2lzaW9uKGZsYWdzOiBGbGFncykge1xuICAgIGNvbnN0IGZtdCA9IHRoaXMuZm9ybWF0O1xuICAgIGZvciAoOyB0aGlzLmkgIT09IHRoaXMuZm9ybWF0Lmxlbmd0aDsgKyt0aGlzLmkpIHtcbiAgICAgIGNvbnN0IGMgPSBmbXRbdGhpcy5pXTtcbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlIFN0YXRlLldJRFRIOlxuICAgICAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICAgICAgY2FzZSBcIi5cIjpcbiAgICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBwcmVjaXNpb24sICU5LmYgLT4gcHJlY2lzaW9uPTBcbiAgICAgICAgICAgICAgdGhpcy5mbGFncy5wcmVjaXNpb24gPSAwO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUFJFQ0lTSU9OO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIqXCI6XG4gICAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZihXb3JQLldJRFRIKTtcbiAgICAgICAgICAgICAgLy8gZm9yY2UgLiBvciBmbGFnIGF0IHRoaXMgcG9pbnRcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KGMpO1xuICAgICAgICAgICAgICAvLyBtb3N0IGxpa2VseSBwYXJzZUludCBkb2VzIHNvbWV0aGluZyBzdHVwaWQgdGhhdCBtYWtlc1xuICAgICAgICAgICAgICAvLyBpdCB1bnVzYWJsZSBmb3IgdGhpcyBzY2VuYXJpbyAuLi5cbiAgICAgICAgICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGEgbm9uIChudW1iZXJ8KnwuKSB3ZSdyZSBkb25lIHdpdGggcHJlYyAmIHdpZFxuICAgICAgICAgICAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaS0tO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmbGFncy53aWR0aCA9IGZsYWdzLndpZHRoID09IC0xID8gMCA6IGZsYWdzLndpZHRoO1xuICAgICAgICAgICAgICBmbGFncy53aWR0aCAqPSAxMDtcbiAgICAgICAgICAgICAgZmxhZ3Mud2lkdGggKz0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gc3dpdGNoIGNcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5QUkVDSVNJT046IHtcbiAgICAgICAgICBpZiAoYyA9PT0gXCIqXCIpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZihXb3JQLlBSRUNJU0lPTik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdmFsID0gcGFyc2VJbnQoYyk7XG4gICAgICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgICAgIC8vIG9uZSB0b28gZmFyLCByZXdpbmRcbiAgICAgICAgICAgIHRoaXMuaS0tO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBFUkNFTlQ7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGZsYWdzLnByZWNpc2lvbiAqPSAxMDtcbiAgICAgICAgICBmbGFncy5wcmVjaXNpb24gKz0gdmFsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FuJ3QgYmUgaGVyZS4gYnVnLlwiKTtcbiAgICAgIH0gLy8gc3dpdGNoIHN0YXRlXG4gICAgfVxuICB9XG5cbiAgLyoqIEhhbmRsZSBwb3NpdGlvbmFsICovXG4gIGhhbmRsZVBvc2l0aW9uYWwoKSB7XG4gICAgaWYgKHRoaXMuZm9ybWF0W3RoaXMuaV0gIT09IFwiW1wiKSB7XG4gICAgICAvLyBzYW5pdHkgb25seVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgaGFwcGVuPyBCdWcuXCIpO1xuICAgIH1cbiAgICBsZXQgcG9zaXRpb25hbCA9IDA7XG4gICAgY29uc3QgZm9ybWF0ID0gdGhpcy5mb3JtYXQ7XG4gICAgdGhpcy5pKys7XG4gICAgbGV0IGVyciA9IGZhbHNlO1xuICAgIGZvciAoOyB0aGlzLmkgIT09IHRoaXMuZm9ybWF0Lmxlbmd0aDsgKyt0aGlzLmkpIHtcbiAgICAgIGlmIChmb3JtYXRbdGhpcy5pXSA9PT0gXCJdXCIpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbmFsICo9IDEwO1xuICAgICAgY29uc3QgdmFsID0gcGFyc2VJbnQoZm9ybWF0W3RoaXMuaV0pO1xuICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgLy90aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIC8vICBgaW52YWxpZCBjaGFyYWN0ZXIgaW4gcG9zaXRpb25hbDogJHtmb3JtYXR9WyR7Zm9ybWF0W3RoaXMuaV19XWBcbiAgICAgICAgLy8pO1xuICAgICAgICB0aGlzLnRtcEVycm9yID0gXCIlIShCQUQgSU5ERVgpXCI7XG4gICAgICAgIGVyciA9IHRydWU7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbmFsICs9IHZhbDtcbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uYWwgLSAxID49IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgIHRoaXMudG1wRXJyb3IgPSBcIiUhKEJBRCBJTkRFWClcIjtcbiAgICAgIGVyciA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYXJnTnVtID0gZXJyID8gdGhpcy5hcmdOdW0gOiBwb3NpdGlvbmFsIC0gMTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvKiogSGFuZGxlIGxlc3MgdGhhbiAqL1xuICBoYW5kbGVMZXNzVGhhbigpOiBzdHJpbmcge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgYXJnID0gdGhpcy5hcmdzW3RoaXMuYXJnTnVtXSBhcyBhbnk7XG4gICAgaWYgKChhcmcgfHwge30pLmNvbnN0cnVjdG9yLm5hbWUgIT09IFwiQXJyYXlcIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhcmcgJHthcmd9IGlzIG5vdCBhbiBhcnJheS4gVG9kbyBiZXR0ZXIgZXJyb3IgaGFuZGxpbmdgKTtcbiAgICB9XG4gICAgbGV0IHN0ciA9IFwiWyBcIjtcbiAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gYXJnLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoaSAhPT0gMCkgc3RyICs9IFwiLCBcIjtcbiAgICAgIHN0ciArPSB0aGlzLl9oYW5kbGVWZXJiKGFyZ1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBzdHIgKyBcIiBdXCI7XG4gIH1cblxuICAvKiogSGFuZGxlIHZlcmIgKi9cbiAgaGFuZGxlVmVyYigpIHtcbiAgICBjb25zdCB2ZXJiID0gdGhpcy5mb3JtYXRbdGhpcy5pXTtcbiAgICB0aGlzLnZlcmIgPSB2ZXJiO1xuICAgIGlmICh0aGlzLnRtcEVycm9yKSB7XG4gICAgICB0aGlzLmJ1ZiArPSB0aGlzLnRtcEVycm9yO1xuICAgICAgdGhpcy50bXBFcnJvciA9IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0aGlzLmFyZ051bSA8IHRoaXMuaGF2ZVNlZW4ubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaGF2ZVNlZW5bdGhpcy5hcmdOdW1dID0gdHJ1ZTsgLy8ga2VlcCB0cmFjayBvZiB1c2VkIGFyZ3NcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuYXJncy5sZW5ndGggPD0gdGhpcy5hcmdOdW0pIHtcbiAgICAgIHRoaXMuYnVmICs9IGAlIShNSVNTSU5HICcke3ZlcmJ9JylgO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhcmcgPSB0aGlzLmFyZ3NbdGhpcy5hcmdOdW1dOyAvLyBjaGVjayBvdXQgb2YgcmFuZ2VcbiAgICAgIHRoaXMuaGF2ZVNlZW5bdGhpcy5hcmdOdW1dID0gdHJ1ZTsgLy8ga2VlcCB0cmFjayBvZiB1c2VkIGFyZ3NcbiAgICAgIGlmICh0aGlzLmZsYWdzLmxlc3N0aGFuKSB7XG4gICAgICAgIHRoaXMuYnVmICs9IHRoaXMuaGFuZGxlTGVzc1RoYW4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYnVmICs9IHRoaXMuX2hhbmRsZVZlcmIoYXJnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5hcmdOdW0rKzsgLy8gaWYgdGhlcmUgaXMgYSBmdXJ0aGVyIHBvc2l0aW9uYWwsIGl0IHdpbGwgcmVzZXQuXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBU1NUSFJPVUdIO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX2hhbmRsZVZlcmIoYXJnOiBhbnkpOiBzdHJpbmcge1xuICAgIHN3aXRjaCAodGhpcy52ZXJiKSB7XG4gICAgICBjYXNlIFwidFwiOlxuICAgICAgICByZXR1cm4gdGhpcy5wYWQoYXJnLnRvU3RyaW5nKCkpO1xuICAgICAgY2FzZSBcImJcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKGFyZyBhcyBudW1iZXIsIDIpO1xuICAgICAgY2FzZSBcImNcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyQ29kZVBvaW50KGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcImRcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKGFyZyBhcyBudW1iZXIsIDEwKTtcbiAgICAgIGNhc2UgXCJvXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlcihhcmcgYXMgbnVtYmVyLCA4KTtcbiAgICAgIGNhc2UgXCJ4XCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEhleChhcmcpO1xuICAgICAgY2FzZSBcIlhcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10SGV4KGFyZywgdHJ1ZSk7XG4gICAgICBjYXNlIFwiZVwiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXRGbG9hdEUoYXJnIGFzIG51bWJlcik7XG4gICAgICBjYXNlIFwiRVwiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXRGbG9hdEUoYXJnIGFzIG51bWJlciwgdHJ1ZSk7XG4gICAgICBjYXNlIFwiZlwiOlxuICAgICAgY2FzZSBcIkZcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRGKGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcImdcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRHKGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcIkdcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRHKGFyZyBhcyBudW1iZXIsIHRydWUpO1xuICAgICAgY2FzZSBcInNcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10U3RyaW5nKGFyZyBhcyBzdHJpbmcpO1xuICAgICAgY2FzZSBcIlRcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10U3RyaW5nKHR5cGVvZiBhcmcpO1xuICAgICAgY2FzZSBcInZcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10VihhcmcpO1xuICAgICAgY2FzZSBcImpcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10SihhcmcpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGAlIShCQUQgVkVSQiAnJHt0aGlzLnZlcmJ9JylgO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQYWQgYSBzdHJpbmdcbiAgICogQHBhcmFtIHMgdGV4dCB0byBwYWRcbiAgICovXG4gIHBhZChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhZGRpbmcgPSB0aGlzLmZsYWdzLnplcm8gPyBcIjBcIiA6IFwiIFwiO1xuXG4gICAgaWYgKHRoaXMuZmxhZ3MuZGFzaCkge1xuICAgICAgcmV0dXJuIHMucGFkRW5kKHRoaXMuZmxhZ3Mud2lkdGgsIHBhZGRpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiBzLnBhZFN0YXJ0KHRoaXMuZmxhZ3Mud2lkdGgsIHBhZGRpbmcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhZCBhIG51bWJlclxuICAgKiBAcGFyYW0gblN0clxuICAgKiBAcGFyYW0gbmVnXG4gICAqL1xuICBwYWROdW0oblN0cjogc3RyaW5nLCBuZWc6IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgIGxldCBzaWduOiBzdHJpbmc7XG4gICAgaWYgKG5lZykge1xuICAgICAgc2lnbiA9IFwiLVwiO1xuICAgIH0gZWxzZSBpZiAodGhpcy5mbGFncy5wbHVzIHx8IHRoaXMuZmxhZ3Muc3BhY2UpIHtcbiAgICAgIHNpZ24gPSB0aGlzLmZsYWdzLnBsdXMgPyBcIitcIiA6IFwiIFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzaWduID0gXCJcIjtcbiAgICB9XG4gICAgY29uc3QgemVybyA9IHRoaXMuZmxhZ3MuemVybztcbiAgICBpZiAoIXplcm8pIHtcbiAgICAgIC8vIHNpZ24gY29tZXMgaW4gZnJvbnQgb2YgcGFkZGluZyB3aGVuIHBhZGRpbmcgdy8gemVybyxcbiAgICAgIC8vIGluIGZyb20gb2YgdmFsdWUgaWYgcGFkZGluZyB3aXRoIHNwYWNlcy5cbiAgICAgIG5TdHIgPSBzaWduICsgblN0cjtcbiAgICB9XG5cbiAgICBjb25zdCBwYWQgPSB6ZXJvID8gXCIwXCIgOiBcIiBcIjtcbiAgICBjb25zdCBsZW4gPSB6ZXJvID8gdGhpcy5mbGFncy53aWR0aCAtIHNpZ24ubGVuZ3RoIDogdGhpcy5mbGFncy53aWR0aDtcblxuICAgIGlmICh0aGlzLmZsYWdzLmRhc2gpIHtcbiAgICAgIG5TdHIgPSBuU3RyLnBhZEVuZChsZW4sIHBhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5TdHIgPSBuU3RyLnBhZFN0YXJ0KGxlbiwgcGFkKTtcbiAgICB9XG5cbiAgICBpZiAoemVybykge1xuICAgICAgLy8gc2VlIGFib3ZlXG4gICAgICBuU3RyID0gc2lnbiArIG5TdHI7XG4gICAgfVxuICAgIHJldHVybiBuU3RyO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBhIG51bWJlclxuICAgKiBAcGFyYW0gblxuICAgKiBAcGFyYW0gcmFkaXhcbiAgICogQHBhcmFtIHVwY2FzZVxuICAgKi9cbiAgZm10TnVtYmVyKG46IG51bWJlciwgcmFkaXg6IG51bWJlciwgdXBjYXNlID0gZmFsc2UpOiBzdHJpbmcge1xuICAgIGxldCBudW0gPSBNYXRoLmFicyhuKS50b1N0cmluZyhyYWRpeCk7XG4gICAgY29uc3QgcHJlYyA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uO1xuICAgIGlmIChwcmVjICE9PSAtMSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICBudW0gPSBuID09PSAwICYmIHByZWMgPT09IDAgPyBcIlwiIDogbnVtO1xuICAgICAgd2hpbGUgKG51bS5sZW5ndGggPCBwcmVjKSB7XG4gICAgICAgIG51bSA9IFwiMFwiICsgbnVtO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgcHJlZml4ID0gXCJcIjtcbiAgICBpZiAodGhpcy5mbGFncy5zaGFycCkge1xuICAgICAgc3dpdGNoIChyYWRpeCkge1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgcHJlZml4ICs9IFwiMGJcIjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIC8vIGRvbid0IGFubm90YXRlIG9jdGFsIDAgd2l0aCAwLi4uXG4gICAgICAgICAgcHJlZml4ICs9IG51bS5zdGFydHNXaXRoKFwiMFwiKSA/IFwiXCIgOiBcIjBcIjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxNjpcbiAgICAgICAgICBwcmVmaXggKz0gXCIweFwiO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBoYW5kbGUgYmFzZTogXCIgKyByYWRpeCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGRvbid0IGFkZCBwcmVmaXggaW4gZnJvbnQgb2YgdmFsdWUgdHJ1bmNhdGVkIGJ5IHByZWNpc2lvbj0wLCB2YWw9MFxuICAgIG51bSA9IG51bS5sZW5ndGggPT09IDAgPyBudW0gOiBwcmVmaXggKyBudW07XG4gICAgaWYgKHVwY2FzZSkge1xuICAgICAgbnVtID0gbnVtLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhZE51bShudW0sIG4gPCAwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgbnVtYmVyIHdpdGggY29kZSBwb2ludHNcbiAgICogQHBhcmFtIG5cbiAgICovXG4gIGZtdE51bWJlckNvZGVQb2ludChuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGxldCBzID0gXCJcIjtcbiAgICB0cnkge1xuICAgICAgcyA9IFN0cmluZy5mcm9tQ29kZVBvaW50KG4pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcyA9IFVOSUNPREVfUkVQTEFDRU1FTlRfQ0hBUkFDVEVSO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYWQocyk7XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHNwZWNpYWwgZmxvYXRcbiAgICogQHBhcmFtIG5cbiAgICovXG4gIGZtdEZsb2F0U3BlY2lhbChuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIC8vIGZvcm1hdHRpbmcgb2YgTmFOIGFuZCBJbmYgYXJlIHBhbnRzLW9uLWhlYWRcbiAgICAvLyBzdHVwaWQgYW5kIG1vcmUgb3IgbGVzcyBhcmJpdHJhcnkuXG5cbiAgICBpZiAoaXNOYU4obikpIHtcbiAgICAgIHRoaXMuZmxhZ3MuemVybyA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMucGFkTnVtKFwiTmFOXCIsIGZhbHNlKTtcbiAgICB9XG4gICAgaWYgKG4gPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICB0aGlzLmZsYWdzLnBsdXMgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMucGFkTnVtKFwiSW5mXCIsIGZhbHNlKTtcbiAgICB9XG4gICAgaWYgKG4gPT09IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICByZXR1cm4gdGhpcy5wYWROdW0oXCJJbmZcIiwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgLyoqXG4gICAqIFJvdW5kIGZyYWN0aW9uIHRvIHByZWNpc2lvblxuICAgKiBAcGFyYW0gZnJhY3Rpb25hbFxuICAgKiBAcGFyYW0gcHJlY2lzaW9uXG4gICAqIEByZXR1cm5zIHR1cGxlIG9mIGZyYWN0aW9uYWwgYW5kIHJvdW5kXG4gICAqL1xuICByb3VuZEZyYWN0aW9uVG9QcmVjaXNpb24oXG4gICAgZnJhY3Rpb25hbDogc3RyaW5nLFxuICAgIHByZWNpc2lvbjogbnVtYmVyLFxuICApOiBbc3RyaW5nLCBib29sZWFuXSB7XG4gICAgbGV0IHJvdW5kID0gZmFsc2U7XG4gICAgaWYgKGZyYWN0aW9uYWwubGVuZ3RoID4gcHJlY2lzaW9uKSB7XG4gICAgICBmcmFjdGlvbmFsID0gXCIxXCIgKyBmcmFjdGlvbmFsOyAvLyBwcmVwZW5kIGEgMSBpbiBjYXNlIG9mIGxlYWRpbmcgMFxuICAgICAgbGV0IHRtcCA9IHBhcnNlSW50KGZyYWN0aW9uYWwuc3Vic3RyKDAsIHByZWNpc2lvbiArIDIpKSAvIDEwO1xuICAgICAgdG1wID0gTWF0aC5yb3VuZCh0bXApO1xuICAgICAgZnJhY3Rpb25hbCA9IE1hdGguZmxvb3IodG1wKS50b1N0cmluZygpO1xuICAgICAgcm91bmQgPSBmcmFjdGlvbmFsWzBdID09PSBcIjJcIjtcbiAgICAgIGZyYWN0aW9uYWwgPSBmcmFjdGlvbmFsLnN1YnN0cigxKTsgLy8gcmVtb3ZlIGV4dHJhIDFcbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKGZyYWN0aW9uYWwubGVuZ3RoIDwgcHJlY2lzaW9uKSB7XG4gICAgICAgIGZyYWN0aW9uYWwgKz0gXCIwXCI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBbZnJhY3Rpb25hbCwgcm91bmRdO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBFXG4gICAqIEBwYXJhbSBuXG4gICAqIEBwYXJhbSB1cGNhc2VcbiAgICovXG4gIGZtdEZsb2F0RShuOiBudW1iZXIsIHVwY2FzZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIGNvbnN0IG0gPSBuLnRvRXhwb25lbnRpYWwoKS5tYXRjaChGTE9BVF9SRUdFWFApO1xuICAgIGlmICghbSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBoYXBwZW4sIGJ1Z1wiKTtcbiAgICB9XG4gICAgbGV0IGZyYWN0aW9uYWwgPSBtW0YuZnJhY3Rpb25hbF07XG4gICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICA/IHRoaXMuZmxhZ3MucHJlY2lzaW9uXG4gICAgICA6IERFRkFVTFRfUFJFQ0lTSU9OO1xuICAgIGxldCByb3VuZGluZyA9IGZhbHNlO1xuICAgIFtmcmFjdGlvbmFsLCByb3VuZGluZ10gPSB0aGlzLnJvdW5kRnJhY3Rpb25Ub1ByZWNpc2lvbihcbiAgICAgIGZyYWN0aW9uYWwsXG4gICAgICBwcmVjaXNpb24sXG4gICAgKTtcblxuICAgIGxldCBlID0gbVtGLmV4cG9uZW50XTtcbiAgICBsZXQgZXNpZ24gPSBtW0YuZXNpZ25dO1xuICAgIC8vIHNjaWVudGlmaWMgbm90YXRpb24gb3V0cHV0IHdpdGggZXhwb25lbnQgcGFkZGVkIHRvIG1pbmxlbiAyXG4gICAgbGV0IG1hbnRpc3NhID0gcGFyc2VJbnQobVtGLm1hbnRpc3NhXSk7XG4gICAgaWYgKHJvdW5kaW5nKSB7XG4gICAgICBtYW50aXNzYSArPSAxO1xuICAgICAgaWYgKDEwIDw9IG1hbnRpc3NhKSB7XG4gICAgICAgIG1hbnRpc3NhID0gMTtcbiAgICAgICAgY29uc3QgciA9IHBhcnNlSW50KGVzaWduICsgZSkgKyAxO1xuICAgICAgICBlID0gci50b1N0cmluZygpO1xuICAgICAgICBlc2lnbiA9IHIgPCAwID8gXCItXCIgOiBcIitcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgZSA9IGUubGVuZ3RoID09IDEgPyBcIjBcIiArIGUgOiBlO1xuICAgIGNvbnN0IHZhbCA9IGAke21hbnRpc3NhfS4ke2ZyYWN0aW9uYWx9JHt1cGNhc2UgPyBcIkVcIiA6IFwiZVwifSR7ZXNpZ259JHtlfWA7XG4gICAgcmV0dXJuIHRoaXMucGFkTnVtKHZhbCwgbiA8IDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBGXG4gICAqIEBwYXJhbSBuXG4gICAqL1xuICBmbXRGbG9hdEYobjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIC8vIHN0dXBpZCBoZWxwZXIgdGhhdCB0dXJucyBhIG51bWJlciBpbnRvIGEgKHBvdGVudGlhbGx5KVxuICAgIC8vIFZFUlkgbG9uZyBzdHJpbmcuXG4gICAgZnVuY3Rpb24gZXhwYW5kTnVtYmVyKG46IG51bWJlcik6IHN0cmluZyB7XG4gICAgICBpZiAoTnVtYmVyLmlzU2FmZUludGVnZXIobikpIHtcbiAgICAgICAgcmV0dXJuIG4udG9TdHJpbmcoKSArIFwiLlwiO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0ID0gbi50b0V4cG9uZW50aWFsKCkuc3BsaXQoXCJlXCIpO1xuICAgICAgbGV0IG0gPSB0WzBdLnJlcGxhY2UoXCIuXCIsIFwiXCIpO1xuICAgICAgY29uc3QgZSA9IHBhcnNlSW50KHRbMV0pO1xuICAgICAgaWYgKGUgPCAwKSB7XG4gICAgICAgIGxldCBuU3RyID0gXCIwLlwiO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gTWF0aC5hYnMoZSkgLSAxOyArK2kpIHtcbiAgICAgICAgICBuU3RyICs9IFwiMFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoblN0ciArPSBtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNwbElkeCA9IGUgKyAxO1xuICAgICAgICB3aGlsZSAobS5sZW5ndGggPCBzcGxJZHgpIHtcbiAgICAgICAgICBtICs9IFwiMFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtLnN1YnN0cigwLCBzcGxJZHgpICsgXCIuXCIgKyBtLnN1YnN0cihzcGxJZHgpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBhdm9pZGluZyBzaWduIG1ha2VzIHBhZGRpbmcgZWFzaWVyXG4gICAgY29uc3QgdmFsID0gZXhwYW5kTnVtYmVyKE1hdGguYWJzKG4pKSBhcyBzdHJpbmc7XG4gICAgY29uc3QgYXJyID0gdmFsLnNwbGl0KFwiLlwiKTtcbiAgICBsZXQgZGlnID0gYXJyWzBdO1xuICAgIGxldCBmcmFjdGlvbmFsID0gYXJyWzFdO1xuXG4gICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICA/IHRoaXMuZmxhZ3MucHJlY2lzaW9uXG4gICAgICA6IERFRkFVTFRfUFJFQ0lTSU9OO1xuICAgIGxldCByb3VuZCA9IGZhbHNlO1xuICAgIFtmcmFjdGlvbmFsLCByb3VuZF0gPSB0aGlzLnJvdW5kRnJhY3Rpb25Ub1ByZWNpc2lvbihmcmFjdGlvbmFsLCBwcmVjaXNpb24pO1xuICAgIGlmIChyb3VuZCkge1xuICAgICAgZGlnID0gKHBhcnNlSW50KGRpZykgKyAxKS50b1N0cmluZygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYWROdW0oYCR7ZGlnfS4ke2ZyYWN0aW9uYWx9YCwgbiA8IDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBHXG4gICAqIEBwYXJhbSBuXG4gICAqIEBwYXJhbSB1cGNhc2VcbiAgICovXG4gIGZtdEZsb2F0RyhuOiBudW1iZXIsIHVwY2FzZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIC8vIFRoZSBkb3VibGUgYXJndW1lbnQgcmVwcmVzZW50aW5nIGEgZmxvYXRpbmctcG9pbnQgbnVtYmVyIHNoYWxsIGJlXG4gICAgLy8gY29udmVydGVkIGluIHRoZSBzdHlsZSBmIG9yIGUgKG9yIGluIHRoZSBzdHlsZSBGIG9yIEUgaW5cbiAgICAvLyB0aGUgY2FzZSBvZiBhIEcgY29udmVyc2lvbiBzcGVjaWZpZXIpLCBkZXBlbmRpbmcgb24gdGhlXG4gICAgLy8gdmFsdWUgY29udmVydGVkIGFuZCB0aGUgcHJlY2lzaW9uLiBMZXQgUCBlcXVhbCB0aGVcbiAgICAvLyBwcmVjaXNpb24gaWYgbm9uLXplcm8sIDYgaWYgdGhlIHByZWNpc2lvbiBpcyBvbWl0dGVkLCBvciAxXG4gICAgLy8gaWYgdGhlIHByZWNpc2lvbiBpcyB6ZXJvLiBUaGVuLCBpZiBhIGNvbnZlcnNpb24gd2l0aCBzdHlsZSBFIHdvdWxkXG4gICAgLy8gaGF2ZSBhbiBleHBvbmVudCBvZiBYOlxuXG4gICAgLy8gICAgIC0gSWYgUCA+IFg+PS00LCB0aGUgY29udmVyc2lvbiBzaGFsbCBiZSB3aXRoIHN0eWxlIGYgKG9yIEYgKVxuICAgIC8vICAgICBhbmQgcHJlY2lzaW9uIFAgLSggWCsxKS5cblxuICAgIC8vICAgICAtIE90aGVyd2lzZSwgdGhlIGNvbnZlcnNpb24gc2hhbGwgYmUgd2l0aCBzdHlsZSBlIChvciBFIClcbiAgICAvLyAgICAgYW5kIHByZWNpc2lvbiBQIC0xLlxuXG4gICAgLy8gRmluYWxseSwgdW5sZXNzIHRoZSAnIycgZmxhZyBpcyB1c2VkLCBhbnkgdHJhaWxpbmcgemVyb3Mgc2hhbGwgYmVcbiAgICAvLyByZW1vdmVkIGZyb20gdGhlIGZyYWN0aW9uYWwgcG9ydGlvbiBvZiB0aGUgcmVzdWx0IGFuZCB0aGVcbiAgICAvLyBkZWNpbWFsLXBvaW50IGNoYXJhY3RlciBzaGFsbCBiZSByZW1vdmVkIGlmIHRoZXJlIGlzIG5vXG4gICAgLy8gZnJhY3Rpb25hbCBwb3J0aW9uIHJlbWFpbmluZy5cblxuICAgIC8vIEEgZG91YmxlIGFyZ3VtZW50IHJlcHJlc2VudGluZyBhbiBpbmZpbml0eSBvciBOYU4gc2hhbGwgYmVcbiAgICAvLyBjb252ZXJ0ZWQgaW4gdGhlIHN0eWxlIG9mIGFuIGYgb3IgRiBjb252ZXJzaW9uIHNwZWNpZmllci5cbiAgICAvLyBodHRwczovL3B1YnMub3Blbmdyb3VwLm9yZy9vbmxpbmVwdWJzLzk2OTk5MTk3OTkvZnVuY3Rpb25zL2ZwcmludGYuaHRtbFxuXG4gICAgbGV0IFAgPSB0aGlzLmZsYWdzLnByZWNpc2lvbiAhPT0gLTFcbiAgICAgID8gdGhpcy5mbGFncy5wcmVjaXNpb25cbiAgICAgIDogREVGQVVMVF9QUkVDSVNJT047XG4gICAgUCA9IFAgPT09IDAgPyAxIDogUDtcblxuICAgIGNvbnN0IG0gPSBuLnRvRXhwb25lbnRpYWwoKS5tYXRjaChGTE9BVF9SRUdFWFApO1xuICAgIGlmICghbSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBoYXBwZW5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgWCA9IHBhcnNlSW50KG1bRi5leHBvbmVudF0pICogKG1bRi5lc2lnbl0gPT09IFwiLVwiID8gLTEgOiAxKTtcbiAgICBsZXQgblN0ciA9IFwiXCI7XG4gICAgaWYgKFAgPiBYICYmIFggPj0gLTQpIHtcbiAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gUCAtIChYICsgMSk7XG4gICAgICBuU3RyID0gdGhpcy5mbXRGbG9hdEYobik7XG4gICAgICBpZiAoIXRoaXMuZmxhZ3Muc2hhcnApIHtcbiAgICAgICAgblN0ciA9IG5TdHIucmVwbGFjZSgvXFwuPzAqJC8sIFwiXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmZsYWdzLnByZWNpc2lvbiA9IFAgLSAxO1xuICAgICAgblN0ciA9IHRoaXMuZm10RmxvYXRFKG4pO1xuICAgICAgaWYgKCF0aGlzLmZsYWdzLnNoYXJwKSB7XG4gICAgICAgIG5TdHIgPSBuU3RyLnJlcGxhY2UoL1xcLj8wKmUvLCB1cGNhc2UgPyBcIkVcIiA6IFwiZVwiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5TdHI7XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHN0cmluZ1xuICAgKiBAcGFyYW0gc1xuICAgKi9cbiAgZm10U3RyaW5nKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZmxhZ3MucHJlY2lzaW9uICE9PSAtMSkge1xuICAgICAgcyA9IHMuc3Vic3RyKDAsIHRoaXMuZmxhZ3MucHJlY2lzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFkKHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBoZXhcbiAgICogQHBhcmFtIHZhbFxuICAgKiBAcGFyYW0gdXBwZXJcbiAgICovXG4gIGZtdEhleCh2YWw6IHN0cmluZyB8IG51bWJlciwgdXBwZXIgPSBmYWxzZSk6IHN0cmluZyB7XG4gICAgLy8gYWxsb3cgb3RoZXJzIHR5cGVzID9cbiAgICBzd2l0Y2ggKHR5cGVvZiB2YWwpIHtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKHZhbCBhcyBudW1iZXIsIDE2LCB1cHBlcik7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6IHtcbiAgICAgICAgY29uc3Qgc2hhcnAgPSB0aGlzLmZsYWdzLnNoYXJwICYmIHZhbC5sZW5ndGggIT09IDA7XG4gICAgICAgIGxldCBoZXggPSBzaGFycCA/IFwiMHhcIiA6IFwiXCI7XG4gICAgICAgIGNvbnN0IHByZWMgPSB0aGlzLmZsYWdzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3QgZW5kID0gcHJlYyAhPT0gLTEgPyBtaW4ocHJlYywgdmFsLmxlbmd0aCkgOiB2YWwubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gZW5kOyArK2kpIHtcbiAgICAgICAgICBpZiAoaSAhPT0gMCAmJiB0aGlzLmZsYWdzLnNwYWNlKSB7XG4gICAgICAgICAgICBoZXggKz0gc2hhcnAgPyBcIiAweFwiIDogXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFRPRE8oYmFydGxvbWllanUpOiBmb3Igbm93IG9ubHkgdGFraW5nIGludG8gYWNjb3VudCB0aGVcbiAgICAgICAgICAvLyBsb3dlciBoYWxmIG9mIHRoZSBjb2RlUG9pbnQsIGllLiBhcyBpZiBhIHN0cmluZ1xuICAgICAgICAgIC8vIGlzIGEgbGlzdCBvZiA4Yml0IHZhbHVlcyBpbnN0ZWFkIG9mIFVDUzIgcnVuZXNcbiAgICAgICAgICBjb25zdCBjID0gKHZhbC5jaGFyQ29kZUF0KGkpICYgMHhmZikudG9TdHJpbmcoMTYpO1xuICAgICAgICAgIGhleCArPSBjLmxlbmd0aCA9PT0gMSA/IGAwJHtjfWAgOiBjO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1cHBlcikge1xuICAgICAgICAgIGhleCA9IGhleC50b1VwcGVyQ2FzZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhZChoZXgpO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiY3VycmVudGx5IG9ubHkgbnVtYmVyIGFuZCBzdHJpbmcgYXJlIGltcGxlbWVudGVkIGZvciBoZXhcIixcbiAgICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHZhbHVlXG4gICAqIEBwYXJhbSB2YWxcbiAgICovXG4gIGZtdFYodmFsOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZmxhZ3Muc2hhcnApIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmZsYWdzLnByZWNpc2lvbiAhPT0gLTFcbiAgICAgICAgPyB7IGRlcHRoOiB0aGlzLmZsYWdzLnByZWNpc2lvbiB9XG4gICAgICAgIDoge307XG4gICAgICByZXR1cm4gdGhpcy5wYWQoRGVuby5pbnNwZWN0KHZhbCwgb3B0aW9ucykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwID0gdGhpcy5mbGFncy5wcmVjaXNpb247XG4gICAgICByZXR1cm4gcCA9PT0gLTEgPyB2YWwudG9TdHJpbmcoKSA6IHZhbC50b1N0cmluZygpLnN1YnN0cigwLCBwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IEpTT05cbiAgICogQHBhcmFtIHZhbFxuICAgKi9cbiAgZm10Sih2YWw6IHVua25vd24pOiBzdHJpbmcge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydHMgYW5kIGZvcm1hdCBhIHZhcmlhYmxlIG51bWJlciBvZiBgYXJnc2AgYXMgaXMgc3BlY2lmaWVkIGJ5IGBmb3JtYXRgLlxuICogYHNwcmludGZgIHJldHVybnMgdGhlIGZvcm1hdHRlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGZvcm1hdFxuICogQHBhcmFtIGFyZ3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNwcmludGYoZm9ybWF0OiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSk6IHN0cmluZyB7XG4gIGNvbnN0IHByaW50ZiA9IG5ldyBQcmludGYoZm9ybWF0LCAuLi5hcmdzKTtcbiAgcmV0dXJuIHByaW50Zi5kb1ByaW50ZigpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuZCBmb3JtYXQgYSB2YXJpYWJsZSBudW1iZXIgb2YgYGFyZ3NgIGFzIGlzIHNwZWNpZmllZCBieSBgZm9ybWF0YC5cbiAqIGBwcmludGZgIHdyaXRlcyB0aGUgZm9ybWF0dGVkIHN0cmluZyB0byBzdGFuZGFyZCBvdXRwdXQuXG4gKiBAcGFyYW0gZm9ybWF0XG4gKiBAcGFyYW0gYXJnc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcHJpbnRmKGZvcm1hdDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pIHtcbiAgY29uc3QgcyA9IHNwcmludGYoZm9ybWF0LCAuLi5hcmdzKTtcbiAgRGVuby5zdGRvdXQud3JpdGVTeW5jKG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShzKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnSkMsR0FFRCxJQUFBO1VBQUssS0FBSztJQUFMLE1BQUEsTUFDSCxpQkFBQSxLQUFBO0lBREcsTUFBQSxNQUVILGFBQUEsS0FBQTtJQUZHLE1BQUEsTUFHSCxnQkFBQSxLQUFBO0lBSEcsTUFBQSxNQUlILGVBQUEsS0FBQTtJQUpHLE1BQUEsTUFLSCxXQUFBLEtBQUE7R0FMRyxVQUFBO0lBUUw7VUFB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