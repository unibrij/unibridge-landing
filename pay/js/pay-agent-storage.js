// pay/js/pay-agent-storage.js

/*
--------------------------------------------------
Pay Agent Storage v3

Small localStorage wrapper for /pay UI.

Stores only UI/session continuity:
- agent_plan_id
- safe last_response snapshot
- last_status / current_state
- last_updated_at

Does not store:
- secrets
- private keys
- wallet signatures
- funding confirmations
- settlement execution state
- beneficiary values
- PIX keys
- bank account values
- normalized_intent
--------------------------------------------------
*/

window.UnibridgePayAgentStorage = (() => {
  const STORAGE_KEY =
    "unibridge_pay_agent_state_v1";

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value;
  }

  function normalizeArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function canUseStorage() {
    try {
      return Boolean(
        window &&
          window.localStorage
      );
    } catch {
      return false;
    }
  }

  function readRaw() {
    if (!canUseStorage()) {
      return {};
    }

    try {
      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return {};
      }

      return normalizeObject(
        JSON.parse(raw)
      );
    } catch {
      return {};
    }
  }

  function writeRaw(state = {}) {
    if (!canUseStorage()) {
      return false;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          normalizeObject(state)
        )
      );

      return true;
    } catch {
      return false;
    }
  }

  function clear() {
    if (!canUseStorage()) {
      return false;
    }

    try {
      window.localStorage.removeItem(
        STORAGE_KEY
      );

      return true;
    } catch {
      return false;
    }
  }

  function pickAgentPlanId(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.agent_plan_id ||
        data.pay_agent_plan_id ||
        data.plan_id ||
        data.id ||
        data.plan?.agent_plan_id ||
        data.plan?.id
    );
  }

  function buildSafeStringArray(value) {
    return normalizeArray(value)
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  function buildSafeActionSnapshot(action = {}) {
    if (typeof action === "string") {
      return normalizeString(action) || null;
    }

    const data =
      normalizeObject(action);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      type:
        normalizeString(data.type) || null,

      action:
        normalizeString(data.action) || null,

      label:
        normalizeString(data.label) || null,

      title:
        normalizeString(data.title) || null,

      description:
        normalizeString(data.description) || null
    };
  }

  function buildSafeOptionSnapshot(option = {}) {
    if (typeof option === "string") {
      const value =
        normalizeString(option);

      return value
        ? value
        : null;
    }

    const data =
      normalizeObject(option);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      id:
        normalizeString(data.id) || null,

      value:
        normalizeString(data.value) || null,

      method:
        normalizeString(data.method) || null,

      funding_method:
        normalizeString(data.funding_method) || null,

      type:
        normalizeString(data.type) || null,

      action:
        normalizeString(data.action) || null,

      name:
        normalizeString(data.name) || null,

      label:
        normalizeString(data.label) || null,

      title:
        normalizeString(data.title) || null,

      description:
        normalizeString(data.description) || null,

      subtitle:
        normalizeString(data.subtitle) || null,

      help:
        normalizeString(data.help) || null,

      hint:
        normalizeString(data.hint) || null
    };
  }

  function buildSafeOptionsSnapshot(options = []) {
    return normalizeArray(options)
      .map((option) => buildSafeOptionSnapshot(option))
      .filter(Boolean);
  }

  function pickOptionsWithPlanFallback(primary, fallback) {
    const primaryOptions =
      normalizeArray(primary);

    if (primaryOptions.length) {
      return primaryOptions;
    }

    return normalizeArray(fallback);
  }

  function buildSafeRouteSnapshot(route = {}) {
    const data =
      normalizeObject(route);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      route_id:
        normalizeString(data.route_id) || null,

      id:
        normalizeString(data.id) || null,

      label:
        normalizeString(data.label) || null,

      country:
        normalizeString(data.country) || null,

      country_name:
        normalizeString(data.country_name) || null,

      rail:
        normalizeString(data.rail) || null,

      payout_rail:
        normalizeString(data.payout_rail) || null,

      network:
        normalizeString(data.network) || null,

      asset:
        normalizeString(data.asset) || null
    };
  }

  function buildSafeDestinationSnapshot(destination = {}) {
    const data =
      normalizeObject(destination);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      country:
        normalizeString(data.country) || null,

      country_name:
        normalizeString(data.country_name) || null,

      payout_rail:
        normalizeString(data.payout_rail) || null,

      rail:
        normalizeString(data.rail) || null,

      label:
        normalizeString(data.label) || null
    };
  }

  function buildSafeBeneficiarySnapshot(beneficiary = {}) {
    const data =
      normalizeObject(beneficiary);

    if (!Object.keys(data).length) {
      return null;
    }

    const rawTotal =
      data.fields_total;

    return {
      fields_total:
        rawTotal === null ||
        rawTotal === undefined ||
        rawTotal === ""
          ? null
          : Number.isFinite(Number(rawTotal))
            ? Number(rawTotal)
            : null,

      fields_collected:
        buildSafeStringArray(
          data.fields_collected
        ),

      missing_fields:
        buildSafeStringArray(
          data.missing_fields
        )
    };
  }

  function buildSafePlanSummarySnapshot(summary = {}) {
    const data =
      normalizeObject(summary);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      destination:
        buildSafeDestinationSnapshot(
          data.destination
        ),

      beneficiary:
        buildSafeBeneficiarySnapshot(
          data.beneficiary
        ),

      amount:
        normalizeString(data.amount) || null,

      amount_currency:
        normalizeString(data.amount_currency) || null,

      selected_funding_method:
        normalizeString(data.selected_funding_method) || null,

      funding_type:
        normalizeString(data.funding_type) || null,

      asset:
        normalizeString(data.asset) || null,

      fiat_currency:
        normalizeString(data.fiat_currency) || null
    };
  }

  function buildSafePlanSnapshot(plan = {}) {
    const data =
      normalizeObject(plan);

    if (!Object.keys(data).length) {
      return null;
    }

    return {
      agent_plan_id:
        pickAgentPlanId(data) || null,

      status:
        normalizeString(data.status) || null,

      current_state:
        normalizeString(data.current_state) || null,

      selected_funding_method:
        normalizeString(data.selected_funding_method) || null,

      route:
        buildSafeRouteSnapshot(
          data.route
        ),

      safe_plan_summary:
        buildSafePlanSummarySnapshot(
          data.safe_plan_summary
        ),

      funding_options:
        buildSafeOptionsSnapshot(
          data.funding_options
        ),

      available_options:
        buildSafeOptionsSnapshot(
          data.available_options
        ),

      options:
        buildSafeOptionsSnapshot(
          data.options
        ),

      next_action:
        buildSafeActionSnapshot(
          data.next_action
        )
    };
  }

  function buildSafeResponseSnapshot(response = {}) {
    const data =
      normalizeObject(response);

    const plan =
      normalizeObject(data.plan);

    return {
      ok:
        data.ok === undefined
          ? null
          : Boolean(data.ok),

      agent_plan_id:
        pickAgentPlanId(data) || null,

      status:
        normalizeString(
          data.status ||
            plan.status
        ) || null,

      current_state:
        normalizeString(
          data.current_state ||
            plan.current_state
        ) || null,

      reply:
        normalizeString(data.reply) || null,

      current_prompt:
        normalizeString(data.current_prompt) || null,

      current_question:
        normalizeString(data.current_question) || null,

      next_action:
        buildSafeActionSnapshot(
          data.next_action ||
            plan.next_action
        ),

      missing_fields:
        buildSafeStringArray(
          normalizeArray(data.missing_fields).length
            ? data.missing_fields
            : plan.missing_fields
        ),

      funding_options:
        buildSafeOptionsSnapshot(
          pickOptionsWithPlanFallback(
            data.funding_options,
            plan.funding_options
          )
        ),

      available_options:
        buildSafeOptionsSnapshot(
          pickOptionsWithPlanFallback(
            data.available_options,
            plan.available_options
          )
        ),

      options:
        buildSafeOptionsSnapshot(
          pickOptionsWithPlanFallback(
            data.options,
            plan.options
          )
        ),

      selected_funding_method:
        normalizeString(
          data.selected_funding_method ||
            plan.selected_funding_method
        ) || null,

      route:
        buildSafeRouteSnapshot(
          data.route ||
            plan.route
        ),

      safe_plan_summary:
        buildSafePlanSummarySnapshot(
          data.safe_plan_summary ||
            plan.safe_plan_summary
        ),

      plan:
        buildSafePlanSnapshot(
          plan
        )
    };
  }

  function getState() {
    return readRaw();
  }

  function saveState(patch = {}) {
    const current =
      readRaw();

    const next = {
      ...current,
      ...normalizeObject(patch),
      last_updated_at:
        nowIso()
    };

    writeRaw(
      next
    );

    return next;
  }

  function getAgentPlanId() {
    const state =
      readRaw();

    return normalizeString(
      state.agent_plan_id
    );
  }

  function setAgentPlanId(agentPlanId) {
    const id =
      normalizeString(agentPlanId);

    if (!id) {
      return readRaw();
    }

    return saveState({
      agent_plan_id:
        id
    });
  }

  function saveResponse(response = {}) {
    const data =
      normalizeObject(response);

    const agentPlanId =
      pickAgentPlanId(data);

    const safeSnapshot =
      buildSafeResponseSnapshot(data);

    const patch = {
      last_response:
        safeSnapshot,

      last_status:
        normalizeString(
          data.current_state ||
            data.status ||
            data.plan?.current_state ||
            data.plan?.status
        ) || null
    };

    if (agentPlanId) {
      patch.agent_plan_id =
        agentPlanId;
    }

    return saveState(
      patch
    );
  }

  function getLastResponse() {
    const state =
      readRaw();

    return normalizeObject(
      state.last_response
    );
  }

  function getLastStatus() {
    const state =
      readRaw();

    return normalizeString(
      state.last_status
    );
  }

  function hasActivePlan() {
    return Boolean(
      getAgentPlanId()
    );
  }

  return {
    STORAGE_KEY,

    getState,
    saveState,
    clear,

    getAgentPlanId,
    setAgentPlanId,

    saveResponse,
    getLastResponse,
    getLastStatus,
    hasActivePlan
  };
})();
