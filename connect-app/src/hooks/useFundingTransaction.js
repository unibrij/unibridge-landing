// connect-app/src/hooks/useFundingTransaction.js

import {
  encodeFunctionData,
  parseUnits
} from "viem";

import {
  clearStoredFlow
} from "../flow/flowStorage";

import {
  resolveFundingCapability
} from "../flow/fundingCapability";

import {
  sendWalletManagedFunding
} from "../flow/sendWalletManagedFunding";

import {
  waitForWalletManagedFunding
} from "../flow/waitForWalletManagedFunding";

import {
  REQUIRED_CHAIN_ID,
  POLYGON_TOKENS,
  ERC20_TRANSFER_ABI,
  pickFundingAsset,
  pickFundingAmount,
  pickFundingDepositAddress
} from "../flow/funding";

function bigintToString(
  value
) {
  return typeof value ===
    "bigint"
    ? value.toString()
    : value ??
        null;
}

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

      const transaction = {
        to:
          token.address,

        data:
          transferData,

        value:
          0n
      };

      writeDebug(
        "Checking wallet funding capability...",
        {
          asset,
          amount,

          chain_id:
            REQUIRED_CHAIN_ID,

          deposit_address:
            depositAddress,

          token_contract:
            token.address
        }
      );

      const fundingCapability =
        await resolveFundingCapability({
          walletClient,
          address,

          chainId:
            REQUIRED_CHAIN_ID,

          transaction
        });

      writeDebug(
        "Wallet funding capability resolved",
        {
          mode:
            fundingCapability
              .mode,

          reason:
            fundingCapability
              .reason,

          native_balance:
            bigintToString(
              fundingCapability
                .native_balance
            ),

          estimated_gas:
            bigintToString(
              fundingCapability
                .estimated_gas
            ),

          estimated_gas_source:
            fundingCapability
              .estimated_gas_source,

          gas_price:
            bigintToString(
              fundingCapability
                .gas_price
            ),

          required_native_amount:
            bigintToString(
              fundingCapability
                .required_native_amount
            ),

          wallet_managed_capability:
            fundingCapability
              .wallet_managed_capability
              ?.type ||
            null
        }
      );

      let hash =
        null;

      let executionMode =
        null;

      let walletCallsId =
        null;

      if (
        fundingCapability.mode ===
          "native"
      ) {
        executionMode =
          "send_transaction_encoded_transfer";

        const nativeGasLimit =
          fundingCapability
            .estimated_gas_source ===
              "rpc" &&
          typeof fundingCapability
            .estimated_gas ===
              "bigint"
            ? fundingCapability
                .estimated_gas
            : 100000n;

        setWalletConfirmationPending(
          true
        );

        writeDebug(
          "Opening wallet transfer...",
          {
            mode:
              executionMode,

            status:
              "wallet_confirmation_pending",

            capability_reason:
              fundingCapability
                .reason,

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address,

            gas_limit:
              nativeGasLimit
                .toString()
          }
        );

        hash =
          await walletClient
            .sendTransaction({
              account:
                address,

              to:
                token.address,

              data:
                transferData,

              gas:
                nativeGasLimit
            });

        setWalletConfirmationPending(
          false
        );
      }
      else if (
        fundingCapability.mode ===
          "wallet_managed"
      ) {
        executionMode =
          "wallet_managed_send_calls";

        setWalletConfirmationPending(
          true
        );

        writeDebug(
          "Opening wallet-managed transfer...",
          {
            mode:
              executionMode,

            status:
              "wallet_confirmation_pending",

            capability:
              fundingCapability
                .wallet_managed_capability
                ?.type ||
              null,

            execution_method:
              fundingCapability
                .wallet_managed_capability
                ?.execution_method ||
              null,

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address
          }
        );

        const submittedCalls =
          await sendWalletManagedFunding({
            walletClient,
            address,

            chainId:
              REQUIRED_CHAIN_ID,

            transaction,

            walletManagedCapability:
              fundingCapability
                .wallet_managed_capability
          });

        walletCallsId =
          submittedCalls.calls_id;

        setWalletConfirmationPending(
          false
        );

        writeDebug(
          "Wallet-managed funding submitted.",
          {
            mode:
              executionMode,

            status:
              "wallet_calls_submitted",

            calls_id:
              walletCallsId,

            capability:
              submittedCalls
                .capability,

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address
          }
        );

        const confirmedCalls =
          await waitForWalletManagedFunding({
            walletClient,

            callsId:
              walletCallsId
          });

        hash =
          confirmedCalls
            .tx_hash;

        writeDebug(
          "Wallet-managed funding confirmed.",
          {
            mode:
              executionMode,

            status:
              "wallet_calls_confirmed",

            calls_id:
              walletCallsId,

            tx_hash:
              hash,

            transaction_hashes:
              confirmedCalls
                .transaction_hashes,

            asset,
            amount
          }
        );
      }
      else if (
        fundingCapability.mode ===
          "insufficient_gas"
      ) {
        writeDebug(
          "Insufficient POL for network fee",
          {
            message:
              "Your wallet needs POL to pay the Polygon network fee.",

            status:
              "insufficient_gas",

            reason:
              fundingCapability
                .reason,

            native_balance:
              bigintToString(
                fundingCapability
                  .native_balance
              ),

            required_native_amount:
              bigintToString(
                fundingCapability
                  .required_native_amount
              ),

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address
          }
        );

        return;
      }
      else {
        throw new Error(
          `Unsupported funding capability mode: ${String(
            fundingCapability.mode
          )}`
        );
      }

      if (!hash) {
        throw new Error(
          "Funding execution completed without a transaction hash"
        );
      }

      setFundingTxHash(
        hash
      );

      setWalletConfirmationPending(
        false
      );

      clearStoredFlow();

      writeDebug(
        "Wallet transaction submitted.",
        {
          tx_hash:
            hash,

          status:
            "wallet_submitted",

          mode:
            executionMode,

          calls_id:
            walletCallsId,

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
