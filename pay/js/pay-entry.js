// pay/js/pay-entry.js

function getEl(id) {
  return document.getElementById(id);
}


function goTo(path) {
  window.location.assign(path);
}


function init() {
  getEl("sendOption")
    ?.addEventListener("click", () => {
      goTo("/pay/send/");
    });


  getEl("receiveOption")
    ?.addEventListener("click", () => {
      goTo("/receive/");
    });
}


init();
