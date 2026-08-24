// shared/pay/destination/fieldValues.js

import {
  isObject,
  normalizeString
} from "./fieldModel.js";


/*
--------------------------------------------------
Collect
--------------------------------------------------
*/

export function collectDestination({
  container
} = {}) {
  if (!container) {
    return {};
  }


  const beneficiary =
    {};


  const fields =
    container.querySelectorAll(
      "[data-destination-field='1']"
    );


  for (
    const field of
      fields
  ) {
    const name =
      normalizeString(
        field.name ||
        field.dataset
          ?.destinationFieldName
      );


    if (!name) {
      continue;
    }


    if (
      field.type ===
      "checkbox"
    ) {
      beneficiary[name] =
        Boolean(
          field.checked
        );

      continue;
    }


    const value =
      normalizeString(
        field.value
      );


    if (
      value !==
      ""
    ) {
      beneficiary[name] =
        value;
    }
  }


  return beneficiary;
}


/*
--------------------------------------------------
Prefill
--------------------------------------------------
*/

export async function prefillDestination({
  container,
  beneficiary
} = {}) {
  if (
    !container ||
    !isObject(
      beneficiary
    )
  ) {
    return;
  }


  for (
    const [
      name,
      value
    ] of
      Object.entries(
        beneficiary
      )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      continue;
    }


    const field =
      container.querySelector(
        `[data-destination-field-name="${CSS.escape(
          name
        )}"]`
      );


    if (!field) {
      continue;
    }


    if (
      field.type ===
      "checkbox"
    ) {
      field.checked =
        Boolean(
          value
        );
    }
    else {
      field.value =
        String(
          value
        );
    }


    field.dispatchEvent(
      new Event(
        "input",
        {
          bubbles:
            true
        }
      )
    );


    field.dispatchEvent(
      new Event(
        "change",
        {
          bubbles:
            true
        }
      )
    );


    /*
    ------------------------------------------------
    A parent select may asynchronously create
    dependent fields.

    Wait until that render finishes before attempting
    to prefill the next beneficiary value.
    ------------------------------------------------
    */

    if (
      field
        .__destinationChangePromise
    ) {
      await field
        .__destinationChangePromise;
    }
  }
}


/*
--------------------------------------------------
Clear
--------------------------------------------------
*/

export function clearDestinationFields({
  container
} = {}) {
  if (!container) {
    return;
  }


  container.replaceChildren();
}
