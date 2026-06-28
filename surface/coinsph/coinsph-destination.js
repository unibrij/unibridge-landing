// unibridge-landing/surface/coinsph/coinsph-destination.js

export function normalizeDigits(value) {
  return String(value || "")
    .replace(/[^\d]/g, "")
    .trim();
}

export function normalizeOptionalText(value) {
  const normalized =
    String(value || "").trim();

  return normalized || null;
}

export function validateCoinsPhDestinationInput({
  isActivePh,
  selectedOption,
  recipientNameInput,
  recipientAccountInput,
  recipientAddressInput,
  remarksInput
} = {}) {
  if (!isActivePh) {
    return {
      ok:
        false,

      error:
        "COINSPH_NOT_ACTIVE_DESTINATION"
    };
  }

  if (!selectedOption) {
    return {
      ok:
        false,

      error:
        "COINSPH_INSTITUTION_REQUIRED"
    };
  }

  const recipientName =
    normalizeOptionalText(
      recipientNameInput?.value
    );

  const recipientAccountNumber =
    normalizeDigits(
      recipientAccountInput?.value
    );

  const recipientAddress =
    normalizeOptionalText(
      recipientAddressInput?.value
    );

  const remarks =
    normalizeOptionalText(
      remarksInput?.value
    );

  if (!recipientName) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_NAME_REQUIRED"
    };
  }

  if (recipientName.length < 2) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_NAME_TOO_SHORT"
    };
  }

  if (recipientName.length > 80) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_NAME_TOO_LONG"
    };
  }

  if (!recipientAccountNumber) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_ACCOUNT_NUMBER_REQUIRED"
    };
  }

  if (recipientAccountNumber.length < 6) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_SHORT"
    };
  }

  if (recipientAccountNumber.length > 30) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_LONG"
    };
  }

  if (
    recipientAddress &&
    recipientAddress.length > 160
  ) {
    return {
      ok:
        false,

      error:
        "COINSPH_RECIPIENT_ADDRESS_TOO_LONG"
    };
  }

  if (
    remarks &&
    remarks.length > 120
  ) {
    return {
      ok:
        false,

      error:
        "COINSPH_REMARKS_TOO_LONG"
    };
  }

  return {
    ok:
      true,

    option:
      selectedOption,

    recipientName,

    recipientAccountNumber,

    recipientAddress,

    remarks
  };
}

export function buildCoinsPhDestination({
  validation,
  getOptionChannel,
  getOptionSubject,
  getOptionLabel
} = {}) {
  if (!validation?.ok) {
    throw new Error(
      validation?.error ||
        "COINSPH_DESTINATION_INVALID"
    );
  }

  const {
    option,
    recipientName,
    recipientAccountNumber,
    recipientAddress,
    remarks
  } =
    validation;

  const channelName =
    getOptionChannel(option);

  const channelSubject =
    getOptionSubject(option);

  const institutionName =
    getOptionLabel(option);

  if (!channelName) {
    throw new Error(
      "COINSPH_CHANNEL_NAME_MISSING"
    );
  }

  if (!channelSubject) {
    throw new Error(
      "COINSPH_CHANNEL_SUBJECT_MISSING"
    );
  }

  const destination = {
    country:
      "PH",

    currency:
      "PHP",

    recipientName,

    recipientAccountNumber,

    recipient_institution:
      channelSubject,

    channelName,

    channelSubject,

    /*
    --------------------------------------------------
    Compatibility aliases for older settlement /
    execution readers. These are derived from the
    selected CoinsPH institution, not typed by user.
    --------------------------------------------------
    */

    bankId:
      channelSubject,

    bankName:
      institutionName || null,

    bankCode:
      channelSubject,

    bank_code:
      channelSubject,

    institution_code:
      channelSubject,

    transactionChannel:
      channelName,

    transactionSubject:
      channelSubject
  };

  if (recipientAddress) {
    destination.recipientAddress =
      recipientAddress;
  }

  if (remarks) {
    destination.remarks =
      remarks;
  }

  return destination;
}
