// shared/pay/destination/selectRenderer.js

import {
  normalizeString
} from "./fieldModel.js";


/*
--------------------------------------------------
DOM helpers
--------------------------------------------------
*/

function createElement(
  tag,
  className = ""
) {
  const element =
    document.createElement(
      tag
    );

  if (className) {
    element.className =
      className;
  }

  return element;
}


/*
--------------------------------------------------
Select metadata
--------------------------------------------------
*/

function getSelectPlaceholder(
  field
) {
  return (
    normalizeString(
      field.placeholder ||
      field.option_placeholder
    ) ||
    `Select ${field.label || field.name}`
  );
}


function shouldSearchOptions(
  field,
  options
) {
  if (
    field.searchable ===
    true
  ) {
    return true;
  }

  if (
    field.searchable ===
    false
  ) {
    return false;
  }

  return (
    Array.isArray(options) &&
    options.length > 8
  );
}


function normalizeOptionSearchValue(
  option
) {
  return [
    option?.label,
    option?.value
  ]
    .map(
      value =>
        normalizeString(
          value
        ).toLowerCase()
    )
    .filter(Boolean)
    .join(" ");
}


/*
--------------------------------------------------
Authoritative native select
--------------------------------------------------
*/

function createNativeSelect({
  field,
  options,
  applyCommonAttributes
}) {
  const select =
    createElement(
      "select",
      "destination-field-native-select"
    );

  applyCommonAttributes(
    select,
    field
  );

  /*
  The native select owns the actual field value.

  It stays hidden so:
  - collectors continue reading the canonical field
  - prefill can still set the field and dispatch change
  - dependent option metadata remains attached
  - mobile browsers do not open the native picker
  */

  select.hidden =
    true;


  const placeholder =
    createElement(
      "option"
    );

  placeholder.value =
    "";

  placeholder.textContent =
    getSelectPlaceholder(
      field
    );

  placeholder.selected =
    true;

  placeholder.__destinationOption =
    null;

  select.appendChild(
    placeholder
  );


  for (
    const option of
      options
  ) {
    const element =
      createElement(
        "option"
      );

    element.value =
      String(
        option.value
      );

    element.textContent =
      option.label;

    element.__destinationOption =
      option;

    select.appendChild(
      element
    );
  }


  return select;
}


/*
--------------------------------------------------
Public renderer
--------------------------------------------------
*/

export function createDestinationSelect({
  field,
  options = [],
  applyCommonAttributes
} = {}) {
  const normalizedOptions =
    Array.isArray(options)
      ? options
      : [];


  if (
    typeof applyCommonAttributes !==
    "function"
  ) {
    throw new Error(
      "DESTINATION_SELECT_COMMON_ATTRIBUTES_MISSING"
    );
  }


  const select =
    createNativeSelect({
      field,
      options:
        normalizedOptions,
      applyCommonAttributes
    });


  const shell =
    createElement(
      "div",
      "destination-select"
    );


  const trigger =
    createElement(
      "button",
      "destination-select-trigger"
    );

  trigger.type =
    "button";

  trigger.setAttribute(
    "aria-haspopup",
    "listbox"
  );

  trigger.setAttribute(
    "aria-expanded",
    "false"
  );


  const valueLabel =
    createElement(
      "span",
      "destination-select-value"
    );

  valueLabel.textContent =
    getSelectPlaceholder(
      field
    );


  const chevron =
    createElement(
      "span",
      "destination-select-chevron"
    );

  chevron.textContent =
    "⌄";

  chevron.setAttribute(
    "aria-hidden",
    "true"
  );


  trigger.append(
    valueLabel,
    chevron
  );


  const menu =
    createElement(
      "div",
      "destination-select-menu"
    );

  menu.hidden =
    true;


  const searchable =
    shouldSearchOptions(
      field,
      normalizedOptions
    );


  let searchInput =
    null;


  if (searchable) {
    searchInput =
      createElement(
        "input",
        "destination-select-search"
      );

    searchInput.type =
      "search";

    searchInput.placeholder =
      `Search ${field.label || field.name}`;

    searchInput.autocomplete =
      "off";

    menu.appendChild(
      searchInput
    );
  }


  const results =
    createElement(
      "div",
      "destination-select-options"
    );

  results.setAttribute(
    "role",
    "listbox"
  );

  menu.appendChild(
    results
  );


  shell.append(
    select,
    trigger,
    menu
  );


  /*
  --------------------------------------------------
  Selection state
  --------------------------------------------------
  */

  function getSelectedOption() {
    if (
      select.selectedIndex <
      0
    ) {
      return null;
    }

    return (
      select.options[
        select.selectedIndex
      ]?.__destinationOption ||
      null
    );
  }


  function syncTrigger() {
    const option =
      getSelectedOption();

    valueLabel.textContent =
      option?.label ||
      getSelectPlaceholder(
        field
      );

    trigger.classList.toggle(
      "has-value",
      Boolean(option)
    );
  }


  /*
  --------------------------------------------------
  Menu lifecycle
  --------------------------------------------------
  */

  function handleOutsidePointerDown(
    event
  ) {
    if (
      !shell.contains(
        event.target
      )
    ) {
      closeMenu();
    }
  }


  function closeMenu() {
    shell.classList.remove(
      "is-open"
    );

    menu.hidden =
      true;

    trigger.setAttribute(
      "aria-expanded",
      "false"
    );

    document.removeEventListener(
      "pointerdown",
      handleOutsidePointerDown
    );
  }


  function openMenu() {
    if (
      shell.classList.contains(
        "is-open"
      )
    ) {
      closeMenu();

      return;
    }


    shell.classList.add(
      "is-open"
    );

    menu.hidden =
      false;

    trigger.setAttribute(
      "aria-expanded",
      "true"
    );

    document.addEventListener(
      "pointerdown",
      handleOutsidePointerDown
    );


    if (searchInput) {
      searchInput.value =
        "";

      renderOptions();

      queueMicrotask(
        () => {
          searchInput.focus();
        }
      );
    } else {
      renderOptions();
    }
  }


  /*
  --------------------------------------------------
  Option rendering
  --------------------------------------------------
  */

  function renderOptions(
    query = ""
  ) {
    const normalizedQuery =
      normalizeString(
        query
      ).toLowerCase();


    const visibleOptions =
      normalizedQuery
        ? normalizedOptions.filter(
            option =>
              normalizeOptionSearchValue(
                option
              ).includes(
                normalizedQuery
              )
          )
        : normalizedOptions;


    results.replaceChildren();


    if (
      !visibleOptions.length
    ) {
      const empty =
        createElement(
          "div",
          "destination-select-empty"
        );

      empty.textContent =
        "No options found.";

      results.appendChild(
        empty
      );

      return;
    }


    for (
      const option of
        visibleOptions
    ) {
      const button =
        createElement(
          "button",
          "destination-select-option"
        );

      button.type =
        "button";

      button.setAttribute(
        "role",
        "option"
      );

      button.dataset.value =
        String(
          option.value
        );

      button.textContent =
        option.label;


      const selected =
        String(
          select.value
        ) ===
        String(
          option.value
        );


      button.classList.toggle(
        "is-selected",
        selected
      );

      button.setAttribute(
        "aria-selected",
        selected
          ? "true"
          : "false"
      );


      button.addEventListener(
        "click",
        () => {
          select.value =
            String(
              option.value
            );

          syncTrigger();
          closeMenu();

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
  }


  /*
  --------------------------------------------------
  Events
  --------------------------------------------------
  */

  trigger.addEventListener(
    "click",
    openMenu
  );


  trigger.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();

        if (
          !shell.classList.contains(
            "is-open"
          )
        ) {
          openMenu();
        }

        return;
      }


      if (
        event.key ===
        "Escape"
      ) {
        closeMenu();
      }
    }
  );


  if (searchInput) {
    searchInput.addEventListener(
      "input",
      () => {
        renderOptions(
          searchInput.value
        );
      }
    );


    searchInput.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
          "Escape"
        ) {
          closeMenu();
          trigger.focus();
        }
      }
    );
  }


  select.addEventListener(
    "change",
    () => {
      syncTrigger();

      if (
        !menu.hidden
      ) {
        renderOptions(
          searchInput?.value ||
          ""
        );
      }
    }
  );


  syncTrigger();


  return {
    input:
      select,

    element:
      shell,

    getSelectedOption
  };
}
