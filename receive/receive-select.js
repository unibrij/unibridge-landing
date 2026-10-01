// unibridge-landing/receive/receive-select.js

function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
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


let selectInstanceCounter =
  0;


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


  const instanceId =
    `receive-select-${++selectInstanceCounter}`;


  select.classList.add(
    "country-native-select"
  );


  /*
  --------------------------------------------------
  Trigger shell
  --------------------------------------------------
  */

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
    "dialog"
  );

  trigger.setAttribute(
    "aria-expanded",
    "false"
  );

  trigger.setAttribute(
    "aria-controls",
    `${instanceId}-picker`
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

  shell.appendChild(
    trigger
  );


  /*
  --------------------------------------------------
  Mobile-first picker sheet

  The picker is mounted directly under <body>,
  not inside another bottom sheet.

  This prevents nested dropdown / scroll issues.
  --------------------------------------------------
  */

  const picker =
    document.createElement(
      "div"
    );

  picker.id =
    `${instanceId}-picker`;

  picker.className =
    "country-select-picker";

  picker.hidden =
    true;


  const backdrop =
    document.createElement(
      "button"
    );

  backdrop.type =
    "button";

  backdrop.className =
    "country-select-picker-backdrop";

  backdrop.setAttribute(
    "aria-label",
    "Close selector"
  );


  const panel =
    document.createElement(
      "section"
    );

  panel.className =
    "country-select-picker-panel";

  panel.setAttribute(
    "role",
    "dialog"
  );

  panel.setAttribute(
    "aria-modal",
    "true"
  );

  panel.setAttribute(
    "aria-labelledby",
    `${instanceId}-title`
  );


  const handle =
    document.createElement(
      "div"
    );

  handle.className =
    "country-select-picker-handle";

  handle.setAttribute(
    "aria-hidden",
    "true"
  );


  const header =
    document.createElement(
      "header"
    );

  header.className =
    "country-select-picker-header";


  const title =
    document.createElement(
      "strong"
    );

  title.id =
    `${instanceId}-title`;

  title.className =
    "country-select-picker-title";

  title.textContent =
    placeholder;


  const closeButton =
    document.createElement(
      "button"
    );

  closeButton.type =
    "button";

  closeButton.className =
    "country-select-picker-close";

  closeButton.setAttribute(
    "aria-label",
    "Close"
  );

  closeButton.textContent =
    "×";


  header.append(
    title,
    closeButton
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
  }


  const results =
    document.createElement(
      "div"
    );

  results.className =
    "country-select-options";

  results.setAttribute(
    "role",
    "listbox"
  );


  panel.append(
    handle,
    header
  );

  if (searchInput) {
    panel.appendChild(
      searchInput
    );
  }

  panel.appendChild(
    results
  );


  picker.append(
    backdrop,
    panel
  );

  document.body.appendChild(
    picker
  );


  let currentOptions =
    [];

  let isOpen =
    false;


  /*
  --------------------------------------------------
  State
  --------------------------------------------------
  */

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


  function close({
    restoreFocus = true
  } = {}) {
    if (!isOpen) {
      return;
    }

    isOpen =
      false;

    picker.hidden =
      true;

    shell.classList.remove(
      "is-open"
    );

    trigger.setAttribute(
      "aria-expanded",
      "false"
    );

    document.body.classList.remove(
      "receive-select-open"
    );

    if (
      restoreFocus &&
      document.body.contains(
        trigger
      )
    ) {
      trigger.focus();
    }
  }


  function open() {
    if (isOpen) {
      return;
    }

    isOpen =
      true;

    if (searchInput) {
      searchInput.value =
        "";
    }

    renderOptions();

    picker.hidden =
      false;

    shell.classList.add(
      "is-open"
    );

    trigger.setAttribute(
      "aria-expanded",
      "true"
    );

    document.body.classList.add(
      "receive-select-open"
    );

    requestAnimationFrame(
      () => {
        if (searchInput) {
          searchInput.focus();

          return;
        }

        const selected =
          results.querySelector(
            ".country-select-option.is-selected"
          );

        const first =
          results.querySelector(
            ".country-select-option"
          );

        (
          selected ||
          first ||
          closeButton
        )
          ?.focus();
      }
    );
  }


  /*
  --------------------------------------------------
  Options
  --------------------------------------------------
  */

  function selectOption(
    option
  ) {
    select.value =
      option.value;

    sync();

    close({
      restoreFocus:
        true
    });

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


    for (
      const option
      of visible
    ) {
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
        event => {
          event.stopPropagation();

          selectOption(
            option
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
      const option
      of currentOptions
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
    }
    else {
      select.value =
        "";
    }


    renderOptions();
    sync();
  }


  /*
  --------------------------------------------------
  Events
  --------------------------------------------------
  */

  trigger.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      if (isOpen) {
        close();

        return;
      }

      open();
    }
  );


  backdrop.addEventListener(
    "click",
    () => {
      close();
    }
  );


  closeButton.addEventListener(
    "click",
    () => {
      close();
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


  picker.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Escape"
      ) {
        event.preventDefault();

        close();

        return;
      }

      if (
        event.key !==
        "Tab"
      ) {
        return;
      }


      const focusable =
        Array
          .from(
            panel.querySelectorAll(
              [
                "button:not([disabled])",
                "input:not([disabled])",
                "[tabindex]:not([tabindex='-1'])"
              ].join(",")
            )
          )
          .filter(
            element =>
              !element.hidden
          );


      if (!focusable.length) {
        return;
      }


      const first =
        focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];


      if (
        event.shiftKey &&
        document.activeElement ===
          first
      ) {
        event.preventDefault();

        last.focus();

        return;
      }


      if (
        !event.shiftKey &&
        document.activeElement ===
          last
      ) {
        event.preventDefault();

        first.focus();
      }
    }
  );


  /*
  --------------------------------------------------
  Initial state
  --------------------------------------------------
  */

  setOptions(
    options
  );


  return {
    element:
      shell,

    input:
      select,

    picker,

    setOptions,

    sync,

    open,

    close,

    focus() {
      trigger.focus();
    }
  };
}
