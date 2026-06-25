// pay/js/pay.js

const STORAGE_KEY =
  "unibridge_fiat_context";

const UNIBRIDGE_PAY_AGENT_URL =
  "/pay/agent/";

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
  window.location.assign(path);
}

function openPayAgent() {
  goTo(
    UNIBRIDGE_PAY_AGENT_URL
  );
}

function showChoice() {
  getEl("choiceCard")?.classList.remove("hidden");
  getEl("fiatCard")?.classList.add("hidden");
  getEl("guideCard")?.classList.remove("hidden");
}

function showFiat() {
  getEl("choiceCard")?.classList.add("hidden");
  getEl("fiatCard")?.classList.remove("hidden");
  getEl("guideCard")?.classList.add("hidden");
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

    flow_started_at:
      Date.now(),

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
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return;
    }

    const context =
      JSON.parse(raw);

    if (
      context?.source_country &&
      getEl("sourceCountry")
    ) {
      getEl("sourceCountry").value =
        context.source_country;
    }

    if (
      context?.receiver_country &&
      getEl("receiverCountry")
    ) {
      getEl("receiverCountry").value =
        context.receiver_country;
    }

    if (
      context?.amount &&
      getEl("amount")
    ) {
      getEl("amount").value =
        context.amount;
    }

    if (context?.payment_method) {
      const input =
        document.querySelector(
          `input[name="paymentMethod"][value="${context.payment_method}"]`
        );

      if (input) {
        input.checked =
          true;
      }
    }
  } catch {
    localStorage.removeItem(
      STORAGE_KEY
    );
  }
}

function buildQuery({
  source_country,
  receiver_country,
  amount
} = {}) {
  const params =
    new URLSearchParams();

  if (source_country) {
    params.set(
      "source_country",
      source_country
    );
  }

  if (receiver_country) {
    params.set(
      "country",
      receiver_country
    );
  }

  if (amount) {
    params.set(
      "amount",
      String(amount)
    );
  }

  const query =
    params.toString();

  return query
    ? `?${query}`
    : "";
}

function buildBankTransferUrl(context = {}) {
  return `/fiat/bank-transfer${buildQuery(context)}`;
}

function buildSurfaceUrl(context = {}) {
  return `/surface${buildQuery(context)}`;
}

function redirectByPaymentMethod(context) {
  if (context.payment_method === "bank_transfer") {
    goTo(
      buildBankTransferUrl(context)
    );
    return;
  }

  if (context.payment_method === "ramp") {
    goTo(
      buildSurfaceUrl(context)
    );
    return;
  }

  goTo(
    buildSurfaceUrl(context)
  );
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

  getEl("guideCardAction")
    ?.addEventListener("click", () => {
      openPayAgent();
    });

  getEl("fiatForm")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      try {
        const context =
          buildFiatContext();

        saveFiatContext(
          context
        );

        redirectByPaymentMethod(
          context
        );
      } catch (err) {
        alert(
          err.message ||
          "Could not continue"
        );
      }
    });

  showChoice();
}

init();
