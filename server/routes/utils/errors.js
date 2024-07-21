const {logger} = require("../../logger");
const {get_common_data} = require("../../session_utils");

class HttpResponse {

    /// INFOS ///
    static CONTINUE = 100;
    static SWITCHING_PROTOCOLS = 101;
    static PROCESSING = 102;
    static EARLY_HINTS = 103;

    /// SUCCESS ///
    static OK = 200;
    static CREATED = 201;
    static ACCEPTED = 202;
    static NON_AUTHORITATIVE_INFORMATION = 203;
    static NO_CONTENT = 204;
    static RESET_CONTENT = 205;
    static PARTIAL_CONTENT = 206;
    static MULTI_STATUS = 207;
    static ALREADY_REPORTED = 208;
    static IM_USED = 226;

    /// REDIRECTION ///
    static MULTIPLE_CHOICES = 300;
    static MOVED_PERMANENTLY = 301;
    static FOUND = 302;
    static SEE_OTHER = 303;
    static NOT_MODIFIED = 304;
    static TEMPORARY_REDIRECT = 307;
    static PERMANENT_REDIRECT = 308;

    /// CLIENT ERROR ///
    static BAD_REQUEST = 400;
    static UNAUTHORIZED = 401;
    static PAYMENT_REQUIRED = 402;
    static FORBIDDEN = 403;
    static NOT_FOUND = 404;
    static METHOD_NOT_ALLOWED = 405;
    static NOT_ACCEPTABLE = 406;
    static PROXY_AUTHENTICATION_REQUIRED = 407;
    static REQUEST_TIMEOUT = 408;
    static CONFLICT = 409;
    static GONE = 410;
    static LENGTH_REQUIRED = 411;
    static PRECONDITION_FAILED = 412;
    static PAYLOAD_TOO_LARGE = 413;
    static URI_TOO_LONG = 414;
    static UNSUPPORTED_MEDIA_TYPE = 415;
    static RANGE_NOT_SATISFIABLE = 416;
    static EXPECTATION_FAILED = 417;
    static MISDIRECTED_REQUEST = 421;
    static UNPROCESSABLE_CONTENT = 422;
    static LOCKED = 423;
    static FAILED_DEPENDENCY = 424;
    static TOO_EARLY = 425;
    static UPGRADE_REQUIRED = 426;
    static PRECONDITION_REQUIRED = 428;
    static TOO_MANY_REQUESTS = 429;
    static REQUEST_HEADER_FIELDS_TOO_LARGE = 431;
    static UNAVAILABLE_FOR_LEGAL_REASONS = 451;

    /// SERVER ERROR ///
    static INTERNAL_SERVER_ERROR = 500;
    static NOT_IMPLEMENTED = 501;
    static BAD_GATEWAY = 502;
    static SERVICE_UNAVAILABLE = 503;
    static GATEWAY_TIMEOUT = 504;
    static HTTP_VERSION_NOT_SUPPORTED = 505;
    static VARIANT_ALSO_NEGOTIATES = 506;
    static INSUFFICIENT_STORAGE = 507;
    static LOOP_DETECTED = 508;
    static NOT_EXTENDED = 510;
    static NETWORK_AUTHENTICATION_REQUIRED = 511;

    /**
     * @param code {number}
     * @return {string}
     */
    static error_code_to_string(code) {
        switch (code) {
            case 100: return "CONTINUE";
            case 101: return "SWITCHING PROTOCOLS";
            case 102: return "PROCESSING";
            case 103: return "EARLY HINTS";
            case 200: return "OK";
            case 201: return "CREATED";
            case 202: return "ACCEPTED";
            case 203: return "NON AUTHORITATIVE INFORMATION";
            case 204: return "NO CONTENT";
            case 205: return "RESET CONTENT";
            case 206: return "PARTIAL CONTENT";
            case 207: return "MULTI STATUS";
            case 208: return "ALREADY REPORTED";
            case 226: return "IM USED";
            case 300: return "MULTIPLE CHOICES";
            case 301: return "MOVED PERMANENTLY";
            case 302: return "FOUND";
            case 303: return "SEE OTHER";
            case 304: return "NOT MODIFIED";
            case 307: return "TEMPORARY REDIRECT";
            case 308: return "PERMANENT REDIRECT";
            case 400: return "BAD REQUEST";
            case 401: return "UNAUTHORIZED";
            case 402: return "PAYMENT REQUIRED";
            case 403: return "FORBIDDEN";
            case 404: return "NOT FOUND";
            case 405: return "METHOD NOT ALLOWED";
            case 406: return "NOT ACCEPTABLE";
            case 407: return "PROXY AUTHENTICATION REQUIRED";
            case 408: return "REQUEST TIMEOUT";
            case 409: return "CONFLICT";
            case 410: return "GONE";
            case 411: return "LENGTH REQUIRED";
            case 412: return "PRECONDITION FAILED";
            case 413: return "PAYLOAD TOO LARGE";
            case 414: return "URI TOO LONG";
            case 415: return "UNSUPPORTED MEDIA TYPE";
            case 416: return "RANGE NOT SATISFIABLE";
            case 417: return "EXPECTATION FAILED";
            case 421: return "MISDIRECTED REQUEST";
            case 422: return "UNPROCESSABLE CONTENT";
            case 423: return "LOCKED";
            case 424: return "FAILED DEPENDENCY";
            case 425: return "TOO EARLY";
            case 426: return "UPGRADE REQUIRED";
            case 428: return "PRECONDITION REQUIRED";
            case 429: return "TOO MANY REQUESTS";
            case 431: return "REQUEST HEADER FIELDS TOO LARGE";
            case 451: return "UNAVAILABLE FOR LEGAL REASONS";
            case 500: return "INTERNAL SERVER ERROR";
            case 501: return "NOT IMPLEMENTED";
            case 502: return "BAD GATEWAY";
            case 503: return "SERVICE UNAVAILABLE";
            case 504: return "GATEWAY TIMEOUT";
            case 505: return "HTTP VERSION NOT SUPPORTED";
            case 506: return "VARIANT ALSO NEGOTIATES";
            case 507: return "INSUFFICIENT STORAGE";
            case 508: return "LOOP DETECTED";
            case 510: return "NOT EXTENDED";
            case 511: return "NETWORK AUTHENTICATION REQUIRED";
            default: 'Unknown error';
        }
    }

    constructor(status_code, response_message = '') {
        this.status_code = status_code;
        this.response_message = response_message;
    }

    /**
     * @param req {Request}
     * @param res {Response}
     */
    async redirect_error(req, res) {
        logger.warn(`Redirect with error ${this.status_code} - ${HttpResponse.error_code_to_string(this.status_code)} : ${this.response_message}`)
        if (req.method === 'POST') {
            return await res.status(this.status_code).send(this.status_code === 200 ? '' : {
                message: {
                    title: `${this.status_code} - ${HttpResponse.error_code_to_string(this.status_code)}`,
                    content: this.response_message
                }
            })
        }
        else {
            return await res.status(this.status_code).render('error', {
                title: `${this.status_code} - ${HttpResponse.error_code_to_string(this.status_code)}`,
                common: await get_common_data(req),
                message: `${this.status_code} - ${HttpResponse.error_code_to_string(this.status_code)}`,
                status: this.response_message,
            })
        }
    }
}

module.exports = {HttpResponse}