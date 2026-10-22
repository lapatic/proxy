// Patches testcafe-hammerhead's client and Rammerhead's client glue before the build. Run from rammerhead/.
// Idempotent; exits non-zero if the code it patches isn't found (e.g. hammerhead changed).
const fs = require('fs');
const file = 'node_modules/testcafe-hammerhead/lib/client/hammerhead.js';
let src = fs.readFileSync(file, 'utf8');

// 1. postMessage(message, { targetOrigin, transfer }) overload. Hammerhead only understands
//    postMessage(message, targetOrigin, transfer) and drops the call otherwise. reCAPTCHA,
//    hCaptcha and Turnstile use the options form, so their iframes never reached the page.
const start = src.indexOf('MessageSandbox.prototype.postMessage = function (contentWindow, args) {');
const end = src.indexOf('MessageSandbox.prototype.sendServiceMsg', start);
if (src.includes('/*rh-patch:postMessage*/')) {
    console.log('hammerhead already patched');
} else {
    if (start < 0 || end < 0) throw new Error('hammerhead postMessage not found; patch needs updating');
    const replacement = `MessageSandbox.prototype.postMessage = function (contentWindow, args) {
	        /*rh-patch:postMessage*/
	        var second = args[1];
	        var isOptions = second !== null && typeof second === 'object';
	        var targetUrl = (isOptions ? second.targetOrigin : second) || getOriginHeader();
	        var transfer = isOptions ? second.transfer : args[2];
	        if (typeof targetUrl !== 'string') {
	            nativeMethods.consoleMeths.log("testcafe-hammerhead: postMessage called with invalid targetOrigin; aborting call (type: ".concat(typeof targetUrl, ")"));
	            return null;
	        }
	        var wrapped = MessageSandbox._wrapMessage(MessageType.User, args[0], targetUrl);
	        var callArgs = transfer ? [wrapped, '*', transfer] : [wrapped, '*'];
	        return fastApply(contentWindow, 'postMessage', callArgs);
	    };
	    `;
    src = src.slice(0, start) + replacement + src.slice(end);
    fs.writeFileSync(file, src);
    console.log('patched hammerhead postMessage');
}

// 2. Rammerhead's localStorage sync assumed the storage wrapper always has addChangeEventListener.
//    Inside captcha iframes it doesn't, and the TypeError aborted client start-up in those frames.
const rhFile = 'src/client/rammerhead.js';
let rh = fs.readFileSync(rhFile, 'utf8');
const call = 'proxiedLocalStorage.addChangeEventListener(function (event) {';
if (rh.includes('/*rh-patch:storage*/')) {
    console.log('rammerhead client already patched');
} else {
    if (!rh.includes(call)) throw new Error('rammerhead storage listener not found; patch needs updating');
    rh = rh.replace(call, "/*rh-patch:storage*/ (typeof proxiedLocalStorage.addChangeEventListener === 'function' ? proxiedLocalStorage.addChangeEventListener : function () {}).call(proxiedLocalStorage, function (event) {");
    fs.writeFileSync(rhFile, rh);
    console.log('patched rammerhead storage sync');
}
