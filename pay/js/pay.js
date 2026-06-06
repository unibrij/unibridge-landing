// pay/js/pay.js

const STORAGE_KEY =
  "unibridge_fiat_context";

function getEl(id) {
  return document.getElementById(id);
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeAmount(value) {
  const n =
    Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("invalid_amount");
  }

  return n;
}

function goTo(path) {
  window.location.href =
    path;
}

function showChoice() {
  getEl("choiceCard")?.classList.remove("hidden");
  getEl("fiatCard")?.classList.add("hidden");
}

function showFiat() {
  getEl("choiceCard")?.classList.add("hidden");
  getEl("fiatCard")?.classList.remove("hidden");
}

function getPaymentMethod() {
  return (
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value || "bank_transfer"
  );
}

function buildFiatContext() {
  const source_country =
    normalizeString(
      getEl("sourceCountry")?.value
    ).toUpperCase();

  const receiver_country =
    normalizeString(
      getEl("receiverCountry")?.value
    ).toUpperCase();

  const amount =
    normalizeAmount(
      getEl("amount")?.value
    );

  const payment_method =
    normalizeString(
      getPaymentMethod()
    );

  if (!source_country) {
    throw new Error("missing_source_country");
  }

  if (!receiver_country) {
    throw new Error("missing_receiver_country");
  }

  if (!payment_method) {
    throw new Error("missing_payment_method");
  }

  return {
    source_country,
    receiver_country,
    amount,
    payment_method,
    created_at:
      new Date().toISOString()
  };
}

function saveFiatContext(context) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(context)
  );
}

function restoreFiatContext() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    const context =
      JSON.parse(raw);

    if (context?.source_country && getEl("sourceCountry")) {
      getEl("sourceCountry").value =
        context.source_country;
    }

    if (context?.receiver_country && getEl("receiverCountry")) {
      getEl("receiverCountry").value =
        context.receiver_country;
    }

    if (context?.amount && getEl("amount")) {
      getEl("amount").value =
        context.amount;
    }

    if (context?.payment_method) {
      const input =
        document.querySelector(
          `input[name="paymentMethod"][value="${context.payment_method}"]`
        );

      if (input) {
        input.checked = true;
      }
    }
  } catch {
    localStorage.removeItem(
      STORAGE_KEY
    );
  }
}

function redirectByPaymentMethod(context) {
  if (context.payment_method === "bank_transfer") {
    goTo("/fiat/bank-transfer");
    return;
  }

  goTo("/surface/ramp");
}

function init() {
  restoreFiatContext();

  getEl("walletOption")
    ?.addEventListener("click", () => {
      goTo("/connect");
    });

  getEl("fiatOption")
    ?.addEventListener("click", () => {
      showFiat();
    });

  getEl("backAction")
    ?.addEventListener("click", () => {
      showChoice();
    });

  getEl("fiatForm")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      try {
        const context =
          buildFiatContext();

        saveFiatContext(context);

        redirectByPaymentMethod(context);
      } catch (err) {
        alert(
          err.message ||
          "Could not continue"
        );
      }
    });
}

init();
