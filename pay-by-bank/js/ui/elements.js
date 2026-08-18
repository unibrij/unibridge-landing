// pay-by-bank/js/ui/elements.js

const elements = {
  sourceCountry:
    document.getElementById(
      "sourceCountry"
    ),

  receiverCountry:
    document.getElementById(
      "receiverCountry"
    ),

  amount:
    document.getElementById(
      "amount"
    ),

  phoneNumber:
    document.getElementById(
      "phoneNumber"
    ),

  amountCurrency:
    document.getElementById(
      "amountCurrency"
    ),

  entryBox:
    document.getElementById(
      "entryBox"
    ),

  prepareBox:
    document.getElementById(
      "prepareBox"
    ),

  routeSummary:
    document.getElementById(
      "routeSummary"
    ),

  pricingPreviewMount:
    document.getElementById(
      "pricingPreviewMount"
    ),

  destinationBox:
    document.getElementById(
      "destinationBox"
    ),

  destinationFields:
    document.getElementById(
      "destinationFields"
    ),

  statusBox:
    document.getElementById(
      "statusBox"
    ),

  continueAction:
    document.getElementById(
      "continueAction"
    ),

  confirmAction:
    document.getElementById(
      "confirmAction"
    ),

  primaryAction:
    document.getElementById(
      "primaryAction"
    ),

  backAction:
    document.getElementById(
      "backAction"
    )
};


function requireElement(
  element,
  name
) {
  if (!element) {
    throw new Error(
      `missing_pay_by_bank_ui_element:${name}`
    );
  }

  return element;
}


export function getRequiredElements() {
  return {
    sourceCountry:
      requireElement(
        elements.sourceCountry,
        "sourceCountry"
      ),

    receiverCountry:
      requireElement(
        elements.receiverCountry,
        "receiverCountry"
      ),

    amount:
      requireElement(
        elements.amount,
        "amount"
      ),

    phoneNumber:
      requireElement(
        elements.phoneNumber,
        "phoneNumber"
      ),

    amountCurrency:
      requireElement(
        elements.amountCurrency,
        "amountCurrency"
      ),

    entryBox:
      requireElement(
        elements.entryBox,
        "entryBox"
      ),

    prepareBox:
      requireElement(
        elements.prepareBox,
        "prepareBox"
      ),

    routeSummary:
      requireElement(
        elements.routeSummary,
        "routeSummary"
      ),

    pricingPreviewMount:
      requireElement(
        elements.pricingPreviewMount,
        "pricingPreviewMount"
      ),

    destinationBox:
      requireElement(
        elements.destinationBox,
        "destinationBox"
      ),

    destinationFields:
      requireElement(
        elements.destinationFields,
        "destinationFields"
      ),

    statusBox:
      requireElement(
        elements.statusBox,
        "statusBox"
      ),

    continueAction:
      requireElement(
        elements.continueAction,
        "continueAction"
      ),

    confirmAction:
      requireElement(
        elements.confirmAction,
        "confirmAction"
      ),

    primaryAction:
      requireElement(
        elements.primaryAction,
        "primaryAction"
      ),

    backAction:
      requireElement(
        elements.backAction,
        "backAction"
      )
  };
}
