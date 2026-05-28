// connect-app/src/App.jsx

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useWalletClient,
  useSwitchChain
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";

import {
  ROUTES,
  getRouteById
} from "./routes";

import {
  readStoredFlow,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  readPayoutIntentFromUrl,
  buildEmptyForm
} from "./flow/routes";

import useConnectSession from "./hooks/useConnectSession";
import useReturnedPayoutIntent from "./hooks/useReturnedPayoutIntent";
import useRouteFlow from "./hooks/useRouteFlow";

import PayoutForm from "./components/PayoutForm";

export default function App() {
  useAppKit();

  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const storedFlow = readStoredFlow();
  const returnedPayoutIntentId = readPayoutIntentFromUrl();

  const [selectedRouteId, setSelectedRouteId] = useState(
    storedFlow?.route_id || "br_pix"
  );

  const selectedRoute = useMemo(
    () => getRouteById(selectedRouteId),
    [selectedRouteId]
  );

  const [payoutIntentId, setPayoutIntentId] = useState(
    returnedPayoutIntentId ||
      storedFlow?.payout_intent_id ||
      null
  );

  const [settlement, setSettlement] = useState(null);
  const [fundingTxHash, setFundingTxHash] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const [debug, setDebug] = useState(
    returnedPayoutIntentId
      ? "Loading payout route..."
      : "Waiting for wallet connection..."
  );

  const [form, setForm] = useState(() => ({
    amount: storedFlow?.form?.amount || "",
    asset:
      storedFlow?.form?.asset ||
      selectedRoute.assets[0],
    beneficiary:
      storedFlow?.form?.beneficiary ||
      buildEmptyForm(selectedRoute).beneficiary
  }));

  const isReturnedFlow =
    Boolean(returnedPayoutIntentId);

  const writeDebug = useCallback((label, value = {}) => {
    setDebug(
      `${label}\n${JSON.stringify(value, null, 2)}`
    );
  }, []);

  const {
    connectSessionId,
    resetConnectSession
  } =
    useConnectSession({
      isConnected,
      address,
      writeDebug
    });

  useReturnedPayoutIntent({
    returnedPayoutIntentId,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  });

  const {
    handleSend,
    walletConfirmationPending
  } =
    useRouteFlow({
      isConnected,
      address,
      chainId,
      walletClient,
      switchChainAsync,

      connectSessionId,
      selectedRoute,
      form,

      payoutIntentId,
      setPayoutIntentId,
      settlement,
      setSettlement,
      setFundingTxHash,
      setIsBusy,

      isReturnedFlow,
      writeDebug
    });

  function updateBeneficiaryField(name, value) {
    setForm(current => ({
      ...current,
      beneficiary: {
        ...current.beneficiary,
        [name]: value
      }
    }));
  }

  function changeRoute(routeId) {
    const route =
      getRouteById(routeId);

    setSelectedRouteId(route.id);
    setPayoutIntentId(null);
    setSettlement(null);
    setFundingTxHash(null);

    resetConnectSession();

    setForm(buildEmptyForm(route));

    clearStoredFlow();
    writeDebug("Ready to start a new route.");
  }

  return (
    <main className="connect-shell">
      <img
        src="/connect/icons/social/Ub.png"
        className="logo"
        alt="UniBridge"
      />

      <h1>Connect your wallet</h1>

      <p>Use your wallet to fund verified payout routes.</p>

      {!isReturnedFlow && (
        <div className="wallet-connect-row">
          <appkit-button />
        </div>
      )}

      {(isConnected || isReturnedFlow) && (
        <PayoutForm
          selectedRouteId={selectedRouteId}
          selectedRoute={selectedRoute}
          form={form}
          setForm={setForm}
          isBusy={isBusy}
          isReturnedFlow={isReturnedFlow}
          settlement={settlement}
          fundingTxHash={fundingTxHash}
          walletConfirmationPending={walletConfirmationPending}
          payoutIntentId={payoutIntentId}
          debug={debug}
          handleSend={handleSend}
          changeRoute={changeRoute}
          updateBeneficiaryField={updateBeneficiaryField}
          routes={ROUTES}
        />
      )}
    </main>
  );
}
