// pay/js/pay-agent-chat-privacy.js

/*
--------------------------------------------------
Pay Agent Chat Privacy

Responsibility:
- Normalize visible user text.
- Mask standalone recipient-like values before rendering them in chat.

Does not:
- Mutate backend payloads.
- Store values.
- Validate beneficiary fields.
- Decide whether a value is acceptable for payout.
--------------------------------------------------
*/

window.UnibridgePayAgentChatPrivacy = (() => {
  const MASKED_VALUE =
    "••••••••••••••";

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function isStandaloneEmail(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  }

  function isStandaloneCpfOrPhone(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    const digits =
      text.replace(/\D/g, "");

    if (digits.length < 8) {
      return false;
    }

    if (digits.length > 15) {
      return false;
    }

    return /^[+\d][\d\s().-]+$/.test(text);
  }

  function isStandalonePixRandomKey(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    ) {
      return true;
    }

    if (
      !/\s/.test(text) &&
      /^[a-z0-9._-]{18,}$/i.test(text)
    ) {
      return true;
    }

    return false;
  }

  function shouldMaskUserMessage(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    return (
      isStandaloneEmail(text) ||
      isStandaloneCpfOrPhone(text) ||
      isStandalonePixRandomKey(text)
    );
  }

  function getVisibleUserMessage(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return "";
    }

    return shouldMaskUserMessage(text)
      ? MASKED_VALUE
      : text;
  }

  function isMaskedVisibleMessage(value) {
    return normalizeString(value) === MASKED_VALUE;
  }

  return {
    MASKED_VALUE,
    normalizeString,
    isStandaloneEmail,
    isStandaloneCpfOrPhone,
    isStandalonePixRandomKey,
    shouldMaskUserMessage,
    getVisibleUserMessage,
    isMaskedVisibleMessage
  };
})();
