// pay/js/pay-agent-storage.js

/*
--------------------------------------------------
Pay Agent Storage v1

Small localStorage wrapper for /pay UI.

Stores only UI/session continuity:
- agent_plan_id
- safe last_response snapshot
- last_status
- last_updated_at

Does not store:
- secrets
- private keys
- wallet signatures
- funding confirmations
- settlement execution state
- beneficiary data
- PIX keys
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
        data.id
    );
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

      label:
        normalizeString(data.label) || null,

      country:
        normalizeString(data.country) || null,

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

      selected_funding_method:
        normalizeString(data.selected_funding_method) || null,

      route:
        buildSafeRouteSnapshot(data.route),

      funding_options:
        normalizeArray(data.funding_options),

      next_action:
        data.next_action || null
    };
  }

  function buildSafeResponseSnapshot(response = {}) {
    const data =
      normalizeObject(response);

    return {
      ok:
        data.ok === undefined
          ? null
          : Boolean(data.ok),

      agent_plan_id:
        pickAgentPlanId(data) || null,

      status:
        normalizeString(data.status) || null,

      reply:
        normalizeString(data.reply) || null,

      current_prompt:
        normalizeString(data.current_prompt) || null,

      next_action:
        data.next_action || null,

      missing_fields:
        normalizeArray(data.missing_fields),

      funding_options:
        normalizeArray(data.funding_options),

      selected_funding_method:
        normalizeString(data.selected_funding_method) || null,

      route:
        buildSafeRouteSnapshot(data.route),

      plan:
        buildSafePlanSnapshot(data.plan)
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

    writeRaw(next);

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
        normalizeString(data.status) || null
    };

    if (agentPlanId) {
      patch.agent_plan_id =
        agentPlanId;
    }

    return saveState(patch);
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
