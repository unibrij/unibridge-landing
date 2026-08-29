// unibridge-landing/receive/receive-select.js

function normalizeString(value) {
  return String(value ?? "").trim();
}


function normalizeOptions(options = []) {
  return (
    Array.isArray(options)
      ? options
      : []
  )
    .map(option => ({
      value:
        normalizeString(
          option?.value
        ),

      label:
        normalizeString(
          option?.label
        )
    }))
    .filter(
      option =>
        option.value
    );
}


export function createReceiveSelect({
  select,
  placeholder = "Select",
  options = [],
  searchable = false
} = {}) {
  if (!select) {
    throw new Error(
      "RECEIVE_SELECT_MISSING"
    );
  }

  select.classList.add(
    "country-native-select"
  );


  const shell =
    document.createElement(
      "div"
    );

  shell.className =
    "country-select-shell";


  const parent =
    select.parentNode;

  if (parent) {
    parent.insertBefore(
      shell,
      select
    );
  }

  shell.appendChild(
    select
  );


  const trigger =
    document.createElement(
      "button"
    );

  trigger.type =
    "button";

  trigger.className =
    "country-select-trigger";

  trigger.setAttribute(
    "aria-haspopup",
    "listbox"
  );

  trigger.setAttribute(
    "aria-expanded",
    "false"
  );


  const valueNode =
    document.createElement(
      "span"
    );

  valueNode.className =
    "country-select-value";


  const chevron =
    document.createElement(
      "span"
    );

  chevron.className =
    "country-select-chevron";

  chevron.textContent =
    "⌄";

  chevron.setAttribute(
    "aria-hidden",
    "true"
  );


  trigger.append(
    valueNode,
    chevron
  );


  const menu =
    document.createElement(
      "div"
    );

  menu.className =
    "country-select-menu";

  menu.setAttribute(
    "role",
    "listbox"
  );


  let searchInput =
    null;

  if (searchable) {
    searchInput =
      document.createElement(
        "input"
      );

    searchInput.type =
      "search";

    searchInput.className =
      "country-select-search";

    searchInput.placeholder =
      "Search";

    searchInput.autocomplete =
      "off";

    menu.appendChild(
      searchInput
    );
  }


  const results =
    document.createElement(
      "div"
    );

  results.className =
    "country-select-options";

  menu.appendChild(
    results
  );


  shell.append(
    trigger,
    menu
  );


  let currentOptions =
    [];


  function close() {
    shell.classList.remove(
      "is-open"
    );

    trigger.setAttribute(
      "aria-expanded",
      "false"
    );
  }


  function open() {
    shell.classList.add(
      "is-open"
    );

    trigger.setAttribute(
      "aria-expanded",
      "true"
    );

    if (searchInput) {
      searchInput.value =
        "";

      renderOptions();

      queueMicrotask(
        () =>
          searchInput.focus()
      );
    }
  }


  function sync() {
    const selected =
      currentOptions.find(
        option =>
          option.value ===
          select.value
      );

    valueNode.textContent =
      selected?.label ||
      placeholder;

    results
      .querySelectorAll(
        ".country-select-option"
      )
      .forEach(
        option => {
          const active =
            option.dataset.value ===
            select.value;

          option.classList.toggle(
            "is-selected",
            active
          );

          option.setAttribute(
            "aria-selected",
            active
              ? "true"
              : "false"
          );
        }
      );
  }


  function renderOptions(
    query = ""
  ) {
    const search =
      normalizeString(
        query
      ).toLowerCase();

    const visible =
      search
        ? currentOptions.filter(
            option =>
              `${option.label} ${option.value}`
                .toLowerCase()
                .includes(
                  search
                )
          )
        : currentOptions;

    results.replaceChildren();

    if (!visible.length) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "country-select-empty";

      empty.textContent =
        "No options found.";

      results.appendChild(
        empty
      );

      return;
    }

    for (const option of visible) {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "country-select-option";

      button.dataset.value =
        option.value;

      button.textContent =
        option.label;

      button.setAttribute(
        "role",
        "option"
      );

      button.addEventListener(
        "click",
        () => {
          select.value =
            option.value;

          sync();
          close();

          select.dispatchEvent(
            new Event(
              "change",
              {
                bubbles:
                  true
              }
            )
          );
        }
      );

      results.appendChild(
        button
      );
    }

    sync();
  }


  function setOptions(
    nextOptions = []
  ) {
    currentOptions =
      normalizeOptions(
        nextOptions
      );

    const previousValue =
      select.value;

    select.replaceChildren();

    const empty =
      document.createElement(
        "option"
      );

    empty.value =
      "";

    empty.textContent =
      placeholder;

    select.appendChild(
      empty
    );

    for (
      const option of
        currentOptions
    ) {
      const element =
        document.createElement(
          "option"
        );

      element.value =
        option.value;

      element.textContent =
        option.label;

      select.appendChild(
        element
      );
    }

    if (
      currentOptions.some(
        option =>
          option.value ===
          previousValue
      )
    ) {
      select.value =
        previousValue;
    } else {
      select.value =
        "";
    }

    renderOptions();
    sync();
  }


  trigger.addEventListener(
    "click",
    () => {
      if (
        shell.classList.contains(
          "is-open"
        )
      ) {
        close();
      } else {
        open();
      }
    }
  );


  select.addEventListener(
    "change",
    sync
  );


  searchInput?.addEventListener(
    "input",
    () => {
      renderOptions(
        searchInput.value
      );
    }
  );


  document.addEventListener(
    "pointerdown",
    event => {
      if (
        !shell.contains(
          event.target
        )
      ) {
        close();
      }
    }
  );


  setOptions(
    options
  );


  return {
    element:
      shell,

    input:
      select,

    setOptions,
    sync,

    focus() {
      trigger.focus();
    }
  };
}
