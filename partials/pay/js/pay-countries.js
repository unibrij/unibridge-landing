window.UNIBRIDGE_COUNTRY_OPTIONS = {
  source: [
    { value: "US", label: "United States", flag: "🇺🇸", currency: "USD" },
    { value: "EU", label: "Europe / SEPA", flag: "🇪🇺", currency: "EUR" },
    { value: "GB", label: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
    { value: "AE", label: "United Arab Emirates", flag: "🇦🇪", currency: "AED" }
  ],

  destination: [
    { value: "BR", label: "Brazil", flag: "🇧🇷", currency: "BRL" },
    { value: "PH", label: "Philippines", flag: "🇵🇭", currency: "PHP" }
  ]
};

function getCountryLabel(country) {
  return `${country.flag} ${country.label}`;
}

function getCountriesForSelect(select) {
  const type = select?.getAttribute("data-country-select");

  if (type === "source") {
    return window.UNIBRIDGE_COUNTRY_OPTIONS.source;
  }

  if (type === "destination") {
    return window.UNIBRIDGE_COUNTRY_OPTIONS.destination;
  }

  return [];
}

function findCountryByValue(countries, value) {
  return countries.find((country) => country.value === value) || countries[0];
}

function closeAllUniBridgeCountryMenus(exceptShell = null) {
  document.querySelectorAll(".country-select-shell.is-open").forEach((shell) => {
    if (shell === exceptShell) return;

    shell.classList.remove("is-open");

    const trigger = shell.querySelector(".country-select-trigger");

    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

window.populateUniBridgeCountrySelect = function populateUniBridgeCountrySelect(
  select,
  countries
) {
  if (!select || !Array.isArray(countries)) return;

  const currentValue = select.value;

  select.innerHTML = "";

  countries.forEach((country) => {
    const option = document.createElement("option");

    option.value = country.value;
    option.textContent = getCountryLabel(country);

    select.appendChild(option);
  });

  if (
    currentValue &&
    countries.some((country) => country.value === currentValue)
  ) {
    select.value = currentValue;
  }
};

window.syncUniBridgeCustomCountrySelect = function syncUniBridgeCustomCountrySelect(
  select
) {
  if (!select) return;

  const countries = getCountriesForSelect(select);
  const selectedCountry = findCountryByValue(countries, select.value);

  if (!selectedCountry) return;

  const shell = select.nextElementSibling;

  if (!shell || !shell.classList.contains("country-select-shell")) return;

  const valueNode = shell.querySelector(".country-select-value");
  const optionNodes = shell.querySelectorAll(".country-select-option");

  if (valueNode) {
    valueNode.textContent = getCountryLabel(selectedCountry);
  }

  optionNodes.forEach((optionNode) => {
    const isSelected =
      optionNode.getAttribute("data-value") === selectedCountry.value;

    optionNode.classList.toggle("is-selected", isSelected);
    optionNode.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
};

window.createUniBridgeCustomCountrySelect = function createUniBridgeCustomCountrySelect(
  select,
  countries
) {
  if (!select || !Array.isArray(countries)) return;

  if (
    select.nextElementSibling &&
    select.nextElementSibling.classList.contains("country-select-shell")
  ) {
    select.nextElementSibling.remove();
  }

  select.classList.add("country-native-select");

  const shell = document.createElement("div");
  shell.className = "country-select-shell";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "country-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const valueNode = document.createElement("span");
  valueNode.className = "country-select-value";

  const chevron = document.createElement("span");
  chevron.className = "country-select-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "⌄";

  trigger.appendChild(valueNode);
  trigger.appendChild(chevron);

  const menu = document.createElement("div");
  menu.className = "country-select-menu";
  menu.setAttribute("role", "listbox");

  countries.forEach((country) => {
    const optionButton = document.createElement("button");

    optionButton.type = "button";
    optionButton.className = "country-select-option";
    optionButton.setAttribute("role", "option");
    optionButton.setAttribute("data-value", country.value);
    optionButton.textContent = getCountryLabel(country);

    optionButton.addEventListener("click", (event) => {
      event.stopPropagation();

      select.value = country.value;

      select.dispatchEvent(
        new Event("input", {
          bubbles: true
        })
      );

      select.dispatchEvent(
        new Event("change", {
          bubbles: true
        })
      );

      window.syncUniBridgeCustomCountrySelect(select);
      window.syncUniBridgeAmountCurrency();

      shell.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    });

    menu.appendChild(optionButton);
  });

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();

    const willOpen = !shell.classList.contains("is-open");

    closeAllUniBridgeCountryMenus(shell);

    shell.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  shell.appendChild(trigger);
  shell.appendChild(menu);

  select.insertAdjacentElement("afterend", shell);

  if (!select.dataset.countrySelectBound) {
    select.addEventListener("change", () => {
      window.syncUniBridgeCustomCountrySelect(select);
      window.syncUniBridgeAmountCurrency();
    });

    select.dataset.countrySelectBound = "1";
  }

  window.syncUniBridgeCustomCountrySelect(select);
};

window.getUniBridgeSourceCurrency = function getUniBridgeSourceCurrency() {
  const sourceSelect = document.querySelector(
    '[data-country-select="source"]'
  );

  if (!sourceSelect) return "USD";

  const country = window.UNIBRIDGE_COUNTRY_OPTIONS.source.find(
    (item) => item.value === sourceSelect.value
  );

  return country?.currency || "USD";
};

window.syncUniBridgeAmountCurrency = function syncUniBridgeAmountCurrency() {
  const currency = window.getUniBridgeSourceCurrency();

  const currencyNodes = document.querySelectorAll(
    "#amountCurrency, [data-amount-currency]"
  );

  currencyNodes.forEach((node) => {
    node.textContent = currency;
  });
};

window.populateUniBridgeCountrySelects = function populateUniBridgeCountrySelects() {
  const sourceSelects = document.querySelectorAll(
    '[data-country-select="source"]'
  );

  const destinationSelects = document.querySelectorAll(
    '[data-country-select="destination"]'
  );

  sourceSelects.forEach((select) => {
    window.populateUniBridgeCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.source
    );

    window.createUniBridgeCustomCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.source
    );
  });

  destinationSelects.forEach((select) => {
    window.populateUniBridgeCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.destination
    );

    window.createUniBridgeCustomCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.destination
    );
  });

  window.syncUniBridgeAmountCurrency();
};

document.addEventListener("click", () => {
  closeAllUniBridgeCountryMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllUniBridgeCountryMenus();
  }
});

window.populateUniBridgeCountrySelects();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.populateUniBridgeCountrySelects();
  });
}
