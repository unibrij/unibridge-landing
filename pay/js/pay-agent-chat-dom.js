// pay/js/pay-agent-chat-dom.js

/*
--------------------------------------------------
Pay Agent Chat DOM

Responsibility:
- Own DOM selectors and element binding.
- Create fallback chat root if the HTML page did not provide one.
- Provide safe DOM helpers for controller/renderers.
- Manage busy/status/input focus.

Does not:
- Call backend APIs.
- Read/write storage.
- Pick response fields.
- Render business-specific cards.
- Decide Pay Agent flow.
- Mask private values.
--------------------------------------------------
*/

window.UnibridgePayAgentChatDom = (() => {
  const SELECTORS = {
    root:
      "[data-pay-agent-chat]",

    mount:
      "[data-pay-agent-mount]",

    messages:
      "[data-pay-agent-messages]",

    form:
      "[data-pay-agent-form]",

    input:
      "[data-pay-agent-input]",

    send:
      "[data-pay-agent-send]",

    actions:
      "[data-pay-agent-actions]",

    status:
      "[data-pay-agent-status]",

    reset:
      "[data-pay-agent-reset]"
  };

  const state = {
    root:
      null,

    messages:
      null,

    form:
      null,

    input:
      null,

    send:
      null,

    actions:
      null,

    status:
      null,

    reset:
      null,

    busy:
      false
  };

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value).trim();
    }

    if (typeof value === "object") {
      return normalizeString(
        value.reply ||
          value.message ||
          value.text ||
          value.label ||
          value.content ||
          value.title ||
          ""
      );
    }

    return String(value).trim();
  }

  function createElement(tag, className, text = "") {
    const element =
      document.createElement(tag);

    if (className) {
      element.className =
        className;
    }

    const safeText =
      normalizeString(text);

    if (safeText) {
      element.textContent =
        safeText;
    }

    return element;
  }

  function clearElement(element) {
    if (!element) {
      return;
    }

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function createDefaultRoot() {
    const section =
      createElement(
        "section",
        "pay-agent-chat"
      );

    section.setAttribute(
      "data-pay-agent-chat",
      ""
    );

    section.innerHTML = `
      <div class="pay-agent-chat-card">
        <div class="pay-agent-chat-header">
          <div class="pay-agent-chat-title-row">
            <div class="pay-agent-chat-icon" aria-hidden="true">✦</div>
            <div>
              <p class="pay-agent-chat-kicker">Pay with UniBridge</p>
              <h2>Route preparation assistant</h2>
            </div>
          </div>

          <button type="button" class="pay-agent-reset" data-pay-agent-reset>
            Reset
          </button>
        </div>

        <div class="pay-agent-status-row">
          <span class="pay-agent-status-label">Status</span>
          <span class="pay-agent-status" data-pay-agent-status>ready</span>
        </div>

        <div class="pay-agent-messages" data-pay-agent-messages></div>

        <div class="pay-agent-actions" data-pay-agent-actions></div>

        <form class="pay-agent-form" data-pay-agent-form>
          <input
            class="pay-agent-input"
            data-pay-agent-input
            type="text"
            autocomplete="off"
            placeholder=""
            aria-label="Pay Agent message"
          />
          <button class="pay-agent-send" data-pay-agent-send type="submit">
            Send
          </button>
        </form>
      </div>
    `;

    const mount =
      document.querySelector(SELECTORS.mount) ||
      document.querySelector("main") ||
      document.body;

    mount.appendChild(
      section
    );

    return section;
  }

  function findOrCreateRoot() {
    return (
      document.querySelector(SELECTORS.root) ||
      createDefaultRoot()
    );
  }

  function bindElements(root) {
    state.root =
      root;

    state.messages =
      root.querySelector(
        SELECTORS.messages
      );

    state.form =
      root.querySelector(
        SELECTORS.form
      );

    state.input =
      root.querySelector(
        SELECTORS.input
      );

    state.send =
      root.querySelector(
        SELECTORS.send
      );

    state.actions =
      root.querySelector(
        SELECTORS.actions
      );

    state.status =
      root.querySelector(
        SELECTORS.status
      );

    state.reset =
      root.querySelector(
        SELECTORS.reset
      );

    return getElements();
  }

  function mount() {
    return bindElements(
      findOrCreateRoot()
    );
  }

  function getElements() {
    return {
      root:
        state.root,

      messages:
        state.messages,

      form:
        state.form,

      input:
        state.input,

      send:
        state.send,

      actions:
        state.actions,

      status:
        state.status,

      reset:
        state.reset,

      busy:
        state.busy
    };
  }

  function isBusy() {
    return state.busy === true;
  }

  function setBusy(value) {
    state.busy =
      Boolean(value);

    if (state.input) {
      state.input.disabled =
        state.busy;
    }

    if (state.send) {
      state.send.disabled =
        state.busy;
    }

    if (state.root) {
      state.root.classList.toggle(
        "is-busy",
        state.busy
      );
    }
  }

  function setStatus(text = "ready") {
    if (!state.status) {
      return;
    }

    state.status.textContent =
      normalizeString(text) || "ready";
  }

  function focusInput() {
    if (!state.input) {
      return;
    }

    state.input.focus();
  }

  function getInputValue() {
    return normalizeString(
      state.input?.value
    );
  }

  function setInputValue(value = "") {
    if (!state.input) {
      return;
    }

    state.input.value =
      normalizeString(value);
  }

  function clearInput() {
    setInputValue("");
  }

  function clearMessages() {
    clearElement(
      state.messages
    );
  }

  function clearActions() {
    clearElement(
      state.actions
    );
  }

  function appendToMessages(element) {
    if (
      !state.messages ||
      !element
    ) {
      return;
    }

    state.messages.appendChild(
      element
    );

    scrollMessagesToBottom();
  }

  function appendToActions(element) {
    if (
      !state.actions ||
      !element
    ) {
      return;
    }

    state.actions.appendChild(
      element
    );
  }

  function scrollMessagesToBottom() {
    if (!state.messages) {
      return;
    }

    state.messages.scrollTop =
      state.messages.scrollHeight;
  }

  function bindSubmit(handler) {
    if (
      !state.form ||
      typeof handler !== "function"
    ) {
      return;
    }

    state.form.addEventListener(
      "submit",
      handler
    );
  }

  function bindReset(handler) {
    if (
      !state.reset ||
      typeof handler !== "function"
    ) {
      return;
    }

    state.reset.addEventListener(
      "click",
      handler
    );
  }

  return {
    SELECTORS,

    mount,
    bindElements,
    findOrCreateRoot,
    createDefaultRoot,

    getElements,
    isBusy,
    setBusy,
    setStatus,

    focusInput,
    getInputValue,
    setInputValue,
    clearInput,

    createElement,
    clearElement,

    clearMessages,
    clearActions,
    appendToMessages,
    appendToActions,
    scrollMessagesToBottom,

    bindSubmit,
    bindReset
  };
})();
