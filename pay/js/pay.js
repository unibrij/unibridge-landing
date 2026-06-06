// pay/js/pay.js

function goTo(path) {
  window.location.href = path;
}

document
  .getElementById("walletOption")
  ?.addEventListener("click", () => {
    goTo("/connect");
  });

document
  .getElementById("fiatOption")
  ?.addEventListener("click", () => {
    goTo("/fiat");
  });
