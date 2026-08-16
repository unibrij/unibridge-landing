// pay-by-bank/js/ui/mounts.js

import {
  getRequiredElements
} from "./elements.js";

import {
  setHidden
} from "./dom.js";


export function getPricingPreviewMount() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  return pricingPreviewMount;
}


export function showPricingPreview() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  setHidden(
    pricingPreviewMount,
    false
  );
}


export function hidePricingPreview() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  setHidden(
    pricingPreviewMount,
    true
  );
}


export function clearPricingPreviewMount() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  pricingPreviewMount.replaceChildren();

  setHidden(
    pricingPreviewMount,
    true
  );
}


export function getDestinationFieldsMount() {
  const {
    destinationFields
  } =
    getRequiredElements();

  return destinationFields;
}


export function showDestinationFields() {
  const {
    destinationBox
  } =
    getRequiredElements();

  setHidden(
    destinationBox,
    false
  );
}


export function hideDestinationFields() {
  const {
    destinationBox
  } =
    getRequiredElements();

  setHidden(
    destinationBox,
    true
  );
}


export function clearDestinationFields() {
  const {
    destinationFields
  } =
    getRequiredElements();

  destinationFields.replaceChildren();
}
