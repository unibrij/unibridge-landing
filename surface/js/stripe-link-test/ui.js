// unibridge-landing/surface/js/stripe-link-test/ui.js

/*
--------------------------------------------------
Stripe Link diagnostic UI

Owns ONLY:

- DOM lookup
- DOM validation
- raw form reads
- status rendering
- button enable/disable state
- button labels
- Stripe element container mounting
- event binding
- legacy diagnostic-input disabling

Does NOT own:

- shared flow state
- Clerk
- Stripe SDK
- API requests
- KYC interpretation
- transaction limits
- settlement logic
- Headless Session logic
--------------------------------------------------
*/


/*
--------------------------------------------------
Basic helpers
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function requireElement(
  element,
  name
) {
  if (!element) {
    throw new Error(
      `missing_dom_element:${name}`
    );
  }

  return element;
}


function setButtonEnabled(
  button,
  enabled
) {
  button.disabled =
    enabled !== true;
}


/*
--------------------------------------------------
Factory
--------------------------------------------------
*/

export function createDiagnosticUi() {
  /*
  --------------------------------------------------
  Primary identity inputs
  --------------------------------------------------
  */

  const emailInput =
    document.getElementById(
      "email"
    );

  const phoneInput =
    document.getElementById(
      "phone"
    );

  const fullNameInput =
    document.getElementById(
      "full-name"
    );


  /*
  --------------------------------------------------
  Primary flow buttons
  --------------------------------------------------
  */

  const registerButton =
    document.getElementById(
      "register-button"
    );

  const authIntentButton =
    document.getElementById(
      "auth-intent-button"
    );

  const authenticateButton =
    document.getElementById(
      "authenticate-button"
    );

  const customerContextButton =
    document.getElementById(
      "customer-context-button"
    );


  /*
  --------------------------------------------------
  KYC inputs
  --------------------------------------------------
  */

  const kycFirstNameInput =
    document.getElementById(
      "kyc-first-name"
    );

  const kycLastNameInput =
    document.getElementById(
      "kyc-last-name"
    );

  const kycIdNumberInput =
    document.getElementById(
      "kyc-id-number"
    );

  const kycDobInput =
    document.getElementById(
      "kyc-dob"
    );

  const kycAddressLine1Input =
    document.getElementById(
      "kyc-address-line1"
    );

  const kycCityInput =
    document.getElementById(
      "kyc-city"
    );

  const kycStateInput =
    document.getElementById(
      "kyc-state"
    );

  const kycPostalCodeInput =
    document.getElementById(
      "kyc-postal-code"
    );

  const kycButton =
    document.getElementById(
      "kyc-button"
    );


  /*
  --------------------------------------------------
  Funding / checkout buttons
  --------------------------------------------------
  */

  const transactionLimitsButton =
    document.getElementById(
      "transaction-limits-button"
    );

  const achButton =
    document.getElementById(
      "ach-button"
    );

  const headlessSessionButton =
    document.getElementById(
      "headless-session-button"
    );

  const quoteButton =
    document.getElementById(
      "quote-button"
    );


  /*
  --------------------------------------------------
  Shared display/container
  --------------------------------------------------
  */

  const statusElement =
    document.getElementById(
      "status"
    );

  const authContainer =
    document.getElementById(
      "auth-container"
    );


  /*
  --------------------------------------------------
  Legacy diagnostic inputs

  Kept only because the current diagnostic HTML may
  still render them.

  They are non-authoritative and always disabled.
  --------------------------------------------------
  */

  const sessionAmountInput =
    document.getElementById(
      "session-amount"
    );

  const sessionCurrencyInput =
    document.getElementById(
      "session-currency"
    );

  const walletAddressInput =
    document.getElementById(
      "wallet-address"
    );

  const quoteAmountInput =
    document.getElementById(
      "quote-amount"
    );

  const quoteCurrencyInput =
    document.getElementById(
      "quote-currency"
    );


  /*
  --------------------------------------------------
  Required DOM validation
  --------------------------------------------------
  */

  const requiredElements = [
    [
      emailInput,
      "email"
    ],
    [
      phoneInput,
      "phone"
    ],
    [
      fullNameInput,
      "full-name"
    ],
    [
      registerButton,
      "register-button"
    ],
    [
      authIntentButton,
      "auth-intent-button"
    ],
    [
      authenticateButton,
      "authenticate-button"
    ],
    [
      customerContextButton,
      "customer-context-button"
    ],
    [
      kycFirstNameInput,
      "kyc-first-name"
    ],
    [
      kycLastNameInput,
      "kyc-last-name"
    ],
    [
      kycIdNumberInput,
      "kyc-id-number"
    ],
    [
      kycDobInput,
      "kyc-dob"
    ],
    [
      kycAddressLine1Input,
      "kyc-address-line1"
    ],
    [
      kycCityInput,
      "kyc-city"
    ],
    [
      kycStateInput,
      "kyc-state"
    ],
    [
      kycPostalCodeInput,
      "kyc-postal-code"
    ],
    [
      kycButton,
      "kyc-button"
    ],
    [
      transactionLimitsButton,
      "transaction-limits-button"
    ],
    [
      achButton,
      "ach-button"
    ],
    [
      headlessSessionButton,
      "headless-session-button"
    ],
    [
      quoteButton,
      "quote-button"
    ],
    [
      statusElement,
      "status"
    ],
    [
      authContainer,
      "auth-container"
    ]
  ];

  const missing =
    requiredElements
      .filter(
        (
          [
            element
          ]
        ) =>
          !element
      )
      .map(
        (
          [
            ,
            name
          ]
        ) =>
          name
      );

  if (
    missing.length
  ) {
    throw new Error(
      `missing_dom_elements:${missing.join(",")}`
    );
  }


  /*
  --------------------------------------------------
  Narrow required references after validation
  --------------------------------------------------
  */

  const email =
    requireElement(
      emailInput,
      "email"
    );

  const phone =
    requireElement(
      phoneInput,
      "phone"
    );

  const fullName =
    requireElement(
      fullNameInput,
      "full-name"
    );

  const register =
    requireElement(
      registerButton,
      "register-button"
    );

  const authIntent =
    requireElement(
      authIntentButton,
      "auth-intent-button"
    );

  const authenticate =
    requireElement(
      authenticateButton,
      "authenticate-button"
    );

  const customerContext =
    requireElement(
      customerContextButton,
      "customer-context-button"
    );

  const kycFirstName =
    requireElement(
      kycFirstNameInput,
      "kyc-first-name"
    );

  const kycLastName =
    requireElement(
      kycLastNameInput,
      "kyc-last-name"
    );

  const kycIdNumber =
    requireElement(
      kycIdNumberInput,
      "kyc-id-number"
    );

  const kycDob =
    requireElement(
      kycDobInput,
      "kyc-dob"
    );

  const kycAddressLine1 =
    requireElement(
      kycAddressLine1Input,
      "kyc-address-line1"
    );

  const kycCity =
    requireElement(
      kycCityInput,
      "kyc-city"
    );

  const kycState =
    requireElement(
      kycStateInput,
      "kyc-state"
    );

  const kycPostalCode =
    requireElement(
      kycPostalCodeInput,
      "kyc-postal-code"
    );

  const kycAction =
    requireElement(
      kycButton,
      "kyc-button"
    );

  const transactionLimitsAction =
    requireElement(
      transactionLimitsButton,
      "transaction-limits-button"
    );

  const achAction =
    requireElement(
      achButton,
      "ach-button"
    );

  const headlessSessionAction =
    requireElement(
      headlessSessionButton,
      "headless-session-button"
    );

  const checkoutAction =
    requireElement(
      quoteButton,
      "quote-button"
    );

  const status =
    requireElement(
      statusElement,
      "status"
    );

  const stripeContainer =
    requireElement(
      authContainer,
      "auth-container"
    );


  /*
  --------------------------------------------------
  Static diagnostic UI configuration
  --------------------------------------------------
  */

  transactionLimitsAction.textContent =
    "8. Get ACH Transaction Limits";

  headlessSessionAction.textContent =
    "10. Create ACH Headless Session + Quote";

  checkoutAction.textContent =
    "11. Perform Checkout";


  const legacyInputs = [
    sessionAmountInput,
    sessionCurrencyInput,
    walletAddressInput,
    quoteAmountInput,
    quoteCurrencyInput
  ];

  for (
    const input
    of legacyInputs
  ) {
    if (!input) {
      continue;
    }

    input.disabled =
      true;

    input.title =
      "Legacy diagnostic field. Current flow resolves this value from settlement backend state.";
  }


  /*
  --------------------------------------------------
  Raw form readers

  UI returns raw normalized strings only.

  Validation / interpretation belongs to the domain
  module consuming the values.
  --------------------------------------------------
  */

  function getRegistrationValues() {
    return {
      email:
        normalizeString(
          email.value
        ),

      phone:
        normalizeString(
          phone.value
        ),

      fullName:
        normalizeString(
          fullName.value
        )
    };
  }


  function getEmail() {
    return normalizeString(
      email.value
    );
  }


  function getKycValues() {
    return {
      firstName:
        normalizeString(
          kycFirstName.value
        ),

      lastName:
        normalizeString(
          kycLastName.value
        ),

      idNumber:
        normalizeString(
          kycIdNumber.value
        ),

      dateOfBirth:
        normalizeString(
          kycDob.value
        ),

      addressLine1:
        normalizeString(
          kycAddressLine1.value
        ),

      city:
        normalizeString(
          kycCity.value
        ),

      state:
        normalizeString(
          kycState.value
        ),

      postalCode:
        normalizeString(
          kycPostalCode.value
        )
    };
  }


  /*
  --------------------------------------------------
  Status renderer
  --------------------------------------------------
  */

  function setStatus(
    message,
    payload = null
  ) {
    const parts = [
      normalizeString(
        message
      )
    ];

    if (
      payload !==
        null
    ) {
      try {
        parts.push(
          JSON.stringify(
            payload,
            null,
            2
          )
        );
      } catch {
        parts.push(
          String(
            payload
          )
        );
      }
    }

    status.textContent =
      parts.join(
        "\n\n"
      );
  }


  /*
  --------------------------------------------------
  Stripe interactive-element container
  --------------------------------------------------
  */

  function clearStripeContainer() {
    stripeContainer
      .replaceChildren();
  }


  function mountStripeElement(
    element
  ) {
    if (!element) {
      clearStripeContainer();

      return;
    }

    stripeContainer
      .replaceChildren(
        element
      );
  }


  /*
  --------------------------------------------------
  Simple button controls
  --------------------------------------------------
  */

  function setRegisterEnabled(
    enabled
  ) {
    setButtonEnabled(
      register,
      enabled
    );
  }


  function setAuthIntentEnabled(
    enabled
  ) {
    setButtonEnabled(
      authIntent,
      enabled
    );
  }


  function setAuthenticateEnabled(
    enabled
  ) {
    setButtonEnabled(
      authenticate,
      enabled
    );
  }


  function setCustomerContextEnabled(
    enabled
  ) {
    setButtonEnabled(
      customerContext,
      enabled
    );
  }


  function setKycEnabled(
    enabled
  ) {
    setButtonEnabled(
      kycAction,
      enabled
    );
  }


  function setTransactionLimitsEnabled(
    enabled
  ) {
    setButtonEnabled(
      transactionLimitsAction,
      enabled
    );
  }


  function setAchEnabled(
    enabled
  ) {
    setButtonEnabled(
      achAction,
      enabled
    );
  }


  function setHeadlessSessionEnabled(
    enabled
  ) {
    setButtonEnabled(
      headlessSessionAction,
      enabled
    );
  }


  function setCheckoutEnabled(
    enabled
  ) {
    setButtonEnabled(
      checkoutAction,
      enabled
    );
  }


  /*
  --------------------------------------------------
  KYC button projection

  This contains DISPLAY behavior only.

  The caller calculates whether document verification
  may actually start.
  --------------------------------------------------
  */

  function syncKycActionButton({
    cryptoCustomerId = null,
    stripeKycVerified = false,
    stripeDocumentVerified = false,
    stripeDocumentVerificationStatus = null,
    sandbox = false,
    canStartDocumentVerification = false
  } = {}) {
    if (
      !normalizeString(
        cryptoCustomerId
      )
    ) {
      kycAction.textContent =
        "Submit Stripe KYC";

      kycAction.disabled =
        true;

      return;
    }

    if (
      stripeKycVerified !==
        true
    ) {
      kycAction.textContent =
        "Submit Stripe KYC";

      kycAction.disabled =
        sandbox !==
        true;

      return;
    }

    if (
      stripeDocumentVerified ===
        true
    ) {
      kycAction.textContent =
        "L2 Verification Complete";

      kycAction.disabled =
        true;

      return;
    }

    if (
      canStartDocumentVerification ===
        true
    ) {
      kycAction.textContent =
        "Complete L2 Document Verification";

      kycAction.disabled =
        false;

      return;
    }

    const documentStatus =
      normalizeString(
        stripeDocumentVerificationStatus
      );

    kycAction.textContent =
      documentStatus
        ? `L2 Document Verification: ${documentStatus}`
        : "L2 Document Verification";

    kycAction.disabled =
      true;
  }


  /*
  --------------------------------------------------
  Global initial disabled state
  --------------------------------------------------
  */

  function disableAllActions() {
    setRegisterEnabled(
      false
    );

    setAuthIntentEnabled(
      false
    );

    setAuthenticateEnabled(
      false
    );

    setCustomerContextEnabled(
      false
    );

    setKycEnabled(
      false
    );

    setTransactionLimitsEnabled(
      false
    );

    setAchEnabled(
      false
    );

    setHeadlessSessionEnabled(
      false
    );

    setCheckoutEnabled(
      false
    );
  }


  /*
  --------------------------------------------------
  Event binding

  Only maps DOM events to supplied callbacks.

  No flow logic lives here.
  --------------------------------------------------
  */

  function bindClick(
    element,
    handler,
    code
  ) {
    if (
      typeof handler !==
        "function"
    ) {
      throw new Error(
        code
      );
    }

    element.addEventListener(
      "click",
      handler
    );
  }


  function onRegister(
    handler
  ) {
    bindClick(
      register,
      handler,
      "register_handler_required"
    );
  }


  function onCreateAuthIntent(
    handler
  ) {
    bindClick(
      authIntent,
      handler,
      "auth_intent_handler_required"
    );
  }


  function onAuthenticate(
    handler
  ) {
    bindClick(
      authenticate,
      handler,
      "authenticate_handler_required"
    );
  }


  function onLoadCustomerContext(
    handler
  ) {
    bindClick(
      customerContext,
      handler,
      "customer_context_handler_required"
    );
  }


  function onKyc(
    handler
  ) {
    bindClick(
      kycAction,
      handler,
      "kyc_handler_required"
    );
  }


  function onTransactionLimits(
    handler
  ) {
    bindClick(
      transactionLimitsAction,
      handler,
      "transaction_limits_handler_required"
    );
  }


  function onCollectAch(
    handler
  ) {
    bindClick(
      achAction,
      handler,
      "ach_handler_required"
    );
  }


  function onCreateHeadlessSession(
    handler
  ) {
    bindClick(
      headlessSessionAction,
      handler,
      "headless_session_handler_required"
    );
  }


  function onCheckout(
    handler
  ) {
    bindClick(
      checkoutAction,
      handler,
      "checkout_handler_required"
    );
  }


  /*
  --------------------------------------------------
  Public UI contract
  --------------------------------------------------
  */

  return {
    /*
    Raw input reads
    */

    getRegistrationValues,
    getEmail,
    getKycValues,

    /*
    Output
    */

    setStatus,

    /*
    Stripe component mount point
    */

    clearStripeContainer,
    mountStripeElement,

    /*
    Individual action controls
    */

    setRegisterEnabled,
    setAuthIntentEnabled,
    setAuthenticateEnabled,
    setCustomerContextEnabled,
    setKycEnabled,
    setTransactionLimitsEnabled,
    setAchEnabled,
    setHeadlessSessionEnabled,
    setCheckoutEnabled,

    /*
    Specialized UI projection
    */

    syncKycActionButton,

    /*
    Initialization
    */

    disableAllActions,

    /*
    Events
    */

    onRegister,
    onCreateAuthIntent,
    onAuthenticate,
    onLoadCustomerContext,
    onKyc,
    onTransactionLimits,
    onCollectAch,
    onCreateHeadlessSession,
    onCheckout
  };
}
