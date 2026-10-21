// unibridge-landing/receive/receive-create.js

import {
  loadReceiveCatalog,
  createReceiveProfile
} from "./receive-api.js";

import {
  buildReceiveCatalog
} from "./receive-form.js";

import {
  createReceiveAuthController,
  isSignedIn,
  savePendingCreate,
  readPendingCreate,
  clearPendingCreate
} from "./create/receive-create-auth.js";

import {
  createReceiveFormController
} from "./create/receive-create-form.js";


export function createReceiveCreateFlow({
  els,
  showOnly,
  clearCreateError,
  showCreateError,
  onCreated
} = {}) {
  let pendingCreate = null;
  let creating = false;
  let initialized = false;
  let initializing = false;

  let createVersion = 0;
  let initVersion = 0;
  let eventsBound = false;

  const authBackdrop =
    document.getElementById(
      "receiveAuthBackdrop"
    );

  const authCloseButton =
    document.getElementById(
      "receiveAuthCloseButton"
    );


  /*
  --------------------------------------------------
  Pending request lifecycle
  --------------------------------------------------
  */

  function invalidatePendingCreate({
    hideAuth = false,
    force = false
  } = {}) {
    const hasPending =
      Boolean(pendingCreate) ||
      Boolean(readPendingCreate());

    if (force || hasPending) {
      createVersion += 1;
    }

    pendingCreate = null;
    clearPendingCreate();

    if (hideAuth) {
      authController.hideAuth();
    }
  }


  /*
  --------------------------------------------------
  Form controller
  --------------------------------------------------
  */

  const formController =
    createReceiveFormController({
      els,
      clearCreateError,
      showCreateError,

      onInvalidatePending: () => {
        invalidatePendingCreate();
      }
    });


  /*
  --------------------------------------------------
  Submit
  --------------------------------------------------
  */

  async function submitCreate(request) {
    if (
      creating ||
      !request ||
      !isSignedIn() ||
      request.version !== createVersion ||
      !els?.createButton
    ) {
      return;
    }

    creating = true;

    // Consume before POST to prevent
    // duplicate submissions from Clerk events.
    pendingCreate = null;
    clearPendingCreate();

    const originalText =
      els.createButton.textContent;

    els.createButton.disabled = true;
    els.createButton.textContent =
      "Creating…";

    try {
      const result =
        await createReceiveProfile({
          routeId: request.routeId,
          beneficiary: request.beneficiary
        });

      authController.hideAuth();

      await onCreated?.(result);
    } catch (error) {
      authController.hideAuth();

      showCreateError?.(
        error?.message ||
        "Unable to create receive link."
      );
    } finally {
      creating = false;

      els.createButton.disabled = false;
      els.createButton.textContent =
        originalText;
    }
  }


  /*
  --------------------------------------------------
  Authentication completion
  --------------------------------------------------
  */

  function handleAuthenticated() {
    if (
      creating ||
      !pendingCreate
    ) {
      return;
    }

    submitCreate(pendingCreate).catch(
      error => {
        showCreateError?.(
          error?.message ||
          "Unable to create receive link."
        );
      }
    );
  }


  const authController =
    createReceiveAuthController({
      authSection: els?.authSection,
      authBackdrop,
      authCloseButton,

      onAuthenticated:
        handleAuthenticated,

      onCancel: () => {
        invalidatePendingCreate({
          force: true
        });

        formController.cancelRestore();
      }
    });


  /*
  --------------------------------------------------
  Create button
  --------------------------------------------------
  */

  async function handleCreate() {
    if (creating || initializing) {
      return;
    }

    clearCreateError?.();

    let details;

    try {
      details =
        formController.collectRequest();
    } catch (error) {
      showCreateError?.(
        error?.message ||
        "Enter valid receiving details."
      );

      return;
    }

    const request = {
      ...details,
      version: ++createVersion
    };

    if (!isSignedIn()) {
      pendingCreate = request;

      savePendingCreate(request);

      authController.revealAuth();
      return;
    }

    pendingCreate = null;
    clearPendingCreate();

    await submitCreate(request);
  }


  /*
  --------------------------------------------------
  Reset
  --------------------------------------------------
  */

  function reset() {
    clearCreateError?.();

    initVersion += 1;
    initialized = false;

    invalidatePendingCreate({
      hideAuth: true,
      force: true
    });

    formController.reset();

    showOnly?.(
      "receiveCreateView"
    );
  }


  /*
  --------------------------------------------------
  Event bindings
  --------------------------------------------------
  */

  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    formController.bindEvents();
    authController.bindEvents();

    els?.createButton?.addEventListener(
      "click",
      handleCreate
    );
  }


  /*
  --------------------------------------------------
  Initialization
  --------------------------------------------------
  */

  async function init() {
    showOnly?.(
      "receiveCreateView"
    );

    bindEvents();

    // Repeated init must not interrupt
    // an active form or Clerk session.
    if (
      initialized ||
      initializing ||
      creating
    ) {
      authController.syncAuthUi();
      return;
    }

    const version = ++initVersion;

    initializing = true;

    try {
      const saved = readPendingCreate();

      const payload =
        await loadReceiveCatalog();

      if (version !== initVersion) {
        return;
      }

      const catalog =
        buildReceiveCatalog(payload);

      if (!catalog.length) {
        throw new Error(
          "No receive routes are currently available."
        );
      }

      formController.setCatalog(catalog);

      initialized = true;

      // Resume directly from the saved request.
      // No need to rebuild beneficiary fields.
      if (saved) {
        pendingCreate = {
          ...saved,
          version: ++createVersion
        };

        if (isSignedIn()) {
          await submitCreate(pendingCreate);
        } else {
          authController.revealAuth();
        }
      } else {
        await formController.handleCountryChange();
      }

      if (version !== initVersion) {
        return;
      }

      authController.syncAuthUi();
    } finally {
      initializing = false;
    }
  }


  return {
    init,
    reset
  };
}
