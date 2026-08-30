(function () {
  function fromExtension(value) {
    var text = String(value || "");
    return (
      text.indexOf("chrome-extension://") !== -1 ||
      text.indexOf("moz-extension://") !== -1 ||
      /MetaMask/i.test(text)
    );
  }

  window.addEventListener(
    "error",
    function (event) {
      if (
        fromExtension(event.filename) ||
        fromExtension(event.message) ||
        fromExtension(event.error && event.error.stack)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    function (event) {
      var reason = event.reason;
      var message = reason && (reason.message || reason.stack || reason);
      if (fromExtension(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
})();
