// connect-app/src/hooks/useConnectFlowState.js

import {
  useRef,
  useState
} from "react";

import {
  buildEmptyForm
} from "../flow/routes";


function buildInitialForm({
  entry,
  storedFlow,
  initialFormRoute
}) {
  /*
   * Repeat is hydrated later from Core.
   */
  if (
    entry?.kind ===
    "repeat"
  ) {
    return {
      ...buildEmptyForm(
        initialFormRoute
      ),

      amount:
        ""
    };
  }

  /*
   * Receive must never inherit an unrelated
   * standard payout draft.
   *
   * The matching Receive route will later
   * reinitialize this through useReceivePayoutForm.
   */
  if (
    entry?.kind ===
    "receive"
  ) {
    return {
      ...buildEmptyForm(
        initialFormRoute
      ),

      amount:
        ""
    };
  }

  return {
    amount:
      storedFlow
        ?.form
        ?.amount ||
      "",

    asset:
      storedFlow
        ?.form
        ?.asset ||
      initialFormRoute
        ?.assets
        ?.[0] ||
      "USDT",

    beneficiary:
      storedFlow
        ?.form
        ?.beneficiary ||
      buildEmptyForm(
        initialFormRoute
      ).beneficiary
  };
}


function getInitialDebug(
  entry
) {
  if (
    entry?.kind ===
    "returned"
  ) {
    return (
      "Loading payout route..."
    );
  }

  if (
    entry?.kind ===
    "repeat"
  ) {
    return (
      "Preparing repeat payout..."
    );
  }

  return (
    "Waiting for wallet connection..."
  );
}


export default function useConnectFlowState({
  entry,
  storedFlow,
  initialFormRoute
}) {
  /*
   * Mutable identity of the payout attempt currently
   * owned by this frontend flow.
   *
   * Async lifecycle reads use this to reject stale
   * responses after the active intent changes.
   */
  const payoutIntentIdStateRef =
    useRef(null);

  /*
   * Repeat hydration must execute only once for the
   * active repeat source.
   */
  const repeatInitializedRef =
    useRef(false);

  const [
    returnedFlowDismissed,
    setReturnedFlowDismissed
  ] = useState(false);

  const [
    repeatSourcePayoutIntentId,
    setRepeatSourcePayoutIntentId
  ] = useState(
    entry
      ?.repeatSourcePayoutIntentId ||
    null
  );

  const [
    payoutIntentId,
    setPayoutIntentId
  ] = useState(
    entry
      ?.initialPayoutIntentId ||
    null
  );

  payoutIntentIdStateRef.current =
    payoutIntentId ||
    null;

  const [
    settlement,
    setSettlement
  ] = useState(null);

  const [
    fundingTxHash,
    setFundingTxHash
  ] = useState(null);

  const [
    isBusy,
    setIsBusy
  ] = useState(false);

  const [
    debug,
    setDebug
  ] = useState(
    () =>
      getInitialDebug(
        entry
      )
  );

  const [
    form,
    setForm
  ] = useState(
    () =>
      buildInitialForm({
        entry,
        storedFlow,
        initialFormRoute
      })
  );

  return {
    payoutIntentIdStateRef,
    repeatInitializedRef,

    returnedFlowDismissed,
    setReturnedFlowDismissed,

    repeatSourcePayoutIntentId,
    setRepeatSourcePayoutIntentId,

    payoutIntentId,
    setPayoutIntentId,

    settlement,
    setSettlement,

    fundingTxHash,
    setFundingTxHash,

    isBusy,
    setIsBusy,

    debug,
    setDebug,

    form,
    setForm
  };
}
