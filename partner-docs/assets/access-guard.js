(function () {
  const hasAccess =
    sessionStorage.getItem("ub_api_reference_access") === "granted";

  if (!hasAccess) {
    window.location.replace("/partner-docs/");
  }
})();
