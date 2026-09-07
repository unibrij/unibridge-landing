// pay/fiat/pay-fiat.js

function getEl(id) {
  return document.getElementById(
    id
  );
}

function goTo(path) {
  window.location.assign(
    path
  );
}

function init() {
  getEl(
    "personalOption"
  )
    ?.addEventListener(
      "click",
      () => {
        goTo(
          "/surface"
        );
      }
    );

  getEl(
    "businessOption"
  )
    ?.addEventListener(
      "click",
      () => {
        goTo(
          "/fiat/bank-transfer/"
        );
      }
    );
}

init();
