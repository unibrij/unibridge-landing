// connect-app/src/hooks/useFundingTransaction.js

import {
  encodeFunctionData,
  parseUnits
} from "viem";

import {
  clearStoredFlow
} from "../flow/flowStorage";

import {
  REQUIRED_CHAIN_ID,
  POLYGON_TOKENS,
  ERC20_TRANSFER_ABI,
  pickFundingAsset,
  pickFundingAmount,
  pickFundingDepositAddress
} from "../flow/funding";

export function useFundingTransaction({
  address,
  chainId,
  walletClient,
  switchChainAsync,

  settlement,
  payoutIntentId,
  payoutIntentIdRef,

  setFundingTxHash,
  setIsBusy,
  setWalletConfirmationPending,

  pollSettlementAfterFunding,
  writeDebug
}) {
  async function ensurePolygonNetwork() {
    if (
      !chainId ||
      Number(
        chainId
      ) ===
        REQUIRED_CHAIN_ID
    ) {
      return true;
    }

    if (!switchChainAsync) {
      writeDebug(
        "Wallet network switch unavailable",
        {
          message:
            "Your wallet is on the wrong network and automatic switching is unavailable.",

          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      return false;
    }

    try {
      writeDebug(
        "Switching wallet network to Polygon...",
        {
          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      await switchChainAsync({
        chainId:
          REQUIRED_CHAIN_ID
      });

      writeDebug(
        "Wallet network switched. Press Send funding again.",
        {
          expected_chain_id:
            REQUIRED_CHAIN_ID
        }
      );

      return false;
    }
    catch (
      err
    ) {
      writeDebug(
        "Wallet network switch failed",
        {
          message:
            err?.message ||
            String(
              err
            ),

          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      return false;
    }
  }

  async function sendFundingTransaction() {
    if (!settlement?.funding) {
      writeDebug(
        "Missing funding instructions"
      );

      return;
    }

    if (!walletClient) {
      writeDebug(
        "Wallet not ready"
      );

      return;
    }

    if (!address) {
      writeDebug(
        "Wallet address missing"
      );

      return;
    }

    const isNetworkReady =
      await ensurePolygonNetwork();

    if (!isNetworkReady) {
      return;
    }

    const funding =
      settlement.funding;

    const asset =
      pickFundingAsset(
        funding
      );

    const amount =
      pickFundingAmount(
        funding
      );

    const depositAddress =
      pickFundingDepositAddress(
        funding
      );

    const token =
      POLYGON_TOKENS[
        asset
      ];

    if (!token) {
      writeDebug(
        "Unsupported funding token",
        {
          asset,

          supported_assets:
            Object.keys(
              POLYGON_TOKENS
            )
        }
      );

      return;
    }

    if (!depositAddress) {
      writeDebug(
        "Missing deposit address"
      );

      return;
    }

    if (
      !amount ||
      Number(
        amount
      ) <= 0
    ) {
      writeDebug(
        "Invalid funding amount",
        {
          amount
        }
      );

      return;
    }

    setIsBusy(
      true
    );

    setWalletConfirmationPending(
      true
    );

    try {
      const transferData =
        encodeFunctionData({
          abi:
            ERC20_TRANSFER_ABI,

          functionName:
            "transfer",

          args: [
            depositAddress,

            parseUnits(
              String(
                amount
              ),
              token.decimals
            )
          ]
        });

      writeDebug(
        "Opening wallet transfer...",
        {
          mode:
            "send_transaction_encoded_transfer",

          status:
            "wallet_confirmation_pending",

          asset,
          amount,

          deposit_address:
            depositAddress,

          token_contract:
            token.address,

          gas_limit:
            "100000"
        }
      );

      const hash =
        await walletClient
          .sendTransaction({
            account:
              address,

            to:
              token.address,

            data:
              transferData,

            gas:
              100000n
          });

      setFundingTxHash(
        hash
      );

      setWalletConfirmationPending(
        false
      );

      /*
       * The redirect and KYC recovery snapshot is no longer
       * needed after the wallet submits the funding transaction.
       *
       * Payout access tokens are stored separately and are not
       * removed by clearStoredFlow().
       */

      clearStoredFlow();

      writeDebug(
        "Wallet transaction submitted.",
        {
          tx_hash:
            hash,

          status:
            "wallet_submitted",

          mode:
            "send_transaction_encoded_transfer",

          asset,
          amount,

          deposit_address:
            depositAddress,

          token_contract:
            token.address
        }
      );

      const activeIntentId =
        payoutIntentIdRef.current ||
        payoutIntentId ||
        null;

      /*
       * Poll without blocking the wallet transaction flow.
       */

      void pollSettlementAfterFunding({
        intentId:
          activeIntentId,

        txHash:
          hash,

        asset,
        amount
      });
    }
    catch (
      err
    ) {
      setWalletConfirmationPending(
        false
      );

      writeDebug(
        "Funding transaction failed",
        {
          message:
            err?.message ||
            String(
              err
            )
        }
      );
    }
    finally {
      setIsBusy(
        false
      );
    }
  }

  return {
    ensurePolygonNetwork,
    sendFundingTransaction
  };
}

export default useFundingTransaction;
