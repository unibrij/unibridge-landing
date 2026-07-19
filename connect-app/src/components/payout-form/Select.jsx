// connect-app/src/components/payout-form/Select.jsx

import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  normalizeArray
} from "./routeUtils.js";

function AssetIcon({
  asset
}) {
  const normalizedAsset =
    String(
      asset ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    normalizedAsset ===
    "USDC"
  ) {
    return (
      <svg
        className="connect-select-asset-icon"
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="16"
          cy="16"
          r="16"
          fill="#2775CA"
        />

        <path
          fill="#FFFFFF"
          d="M18.14 18.18c0-1.12-.68-1.5-2.27-1.73-2.27-.3-3.97-.9-3.97-3.04 0-1.67 1.28-2.82 3.26-3.08V8.5h1.67v1.8c1.72.2 2.84 1.08 3.2 2.57l-1.93.45c-.26-.93-.9-1.38-2.02-1.38-1.26 0-2.03.52-2.03 1.35 0 .97.73 1.32 2.35 1.55 2.22.3 3.9.95 3.9 3.14 0 1.76-1.33 2.96-3.47 3.22v1.8h-1.67v-1.78c-1.96-.2-3.2-1.18-3.56-2.88l1.98-.48c.3 1.12 1.08 1.65 2.38 1.65 1.35 0 2.18-.5 2.18-1.33Z"
        />

        <path
          fill="#FFFFFF"
          d="M9.25 24.55a11.1 11.1 0 0 1 0-17.1l1.2 1.45a9.2 9.2 0 0 0 0 14.2l-1.2 1.45Zm13.5 0-1.2-1.45a9.2 9.2 0 0 0 0-14.2l1.2-1.45a11.1 11.1 0 0 1 0 17.1Z"
        />
      </svg>
    );
  }

  if (
    normalizedAsset ===
    "USDT"
  ) {
    return (
      <svg
        className="connect-select-asset-icon"
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="16"
          cy="16"
          r="16"
          fill="#26A17B"
        />

        <path
          fill="#FFFFFF"
          d="M17.86 17.24v-.01c-.12.01-.72.05-2.05.05-1.06 0-1.81-.03-2.08-.05v.01c-4.08-.18-7.12-.89-7.12-1.74 0-.85 3.04-1.56 7.12-1.74v2.78c.28.02 1.05.07 2.1.07 1.26 0 1.9-.05 2.03-.07v-2.78c4.07.18 7.11.89 7.11 1.74 0 .85-3.04 1.56-7.11 1.74Zm0-3.77v-2.49h5.68V7.18H8.07v3.8h5.66v2.49c-4.6.21-8.06 1.12-8.06 2.21 0 1.09 3.46 2 8.06 2.21v7.97h4.13v-7.97c4.59-.21 8.04-1.12 8.04-2.21 0-1.09-3.45-2-8.04-2.21Z"
        />
      </svg>
    );
  }

  return null;
}

function OptionContent({
  option
}) {
  const asset =
    option?.asset ??
    option?.iconAsset ??
    option?.value;

  const showAssetIcon =
    option?.showAssetIcon ===
    true;

  return (
    <span className="connect-select-option-content">
      {showAssetIcon ? (
        <AssetIcon
          asset={
            asset
          }
        />
      ) : null}

      <span>
        {option?.label ||
          "Select"}
      </span>
    </span>
  );
}

export default function Select({
  value,
  options,
  disabled,
  onChange,
  ariaLabel
}) {
  const [
    isOpen,
    setIsOpen
  ] =
    useState(false);

  const shellRef =
    useRef(null);

  const safeOptions =
    normalizeArray(
      options
    );

  const selectedOption =
    safeOptions.find(
      option =>
        option.value ===
        value
    ) ||
    safeOptions[0] ||
    null;

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      if (
        !shellRef.current
      ) {
        return;
      }

      if (
        !shellRef.current.contains(
          event.target
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "click",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClickOutside
      );
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [
    disabled
  ]);

  return (
    <div
      ref={
        shellRef
      }
      className={
        isOpen
          ? "connect-select-shell is-open"
          : "connect-select-shell"
      }
    >
      <button
        type="button"
        className="connect-select-trigger"
        disabled={
          disabled ||
          safeOptions.length ===
            0
        }
        aria-label={
          ariaLabel
        }
        aria-haspopup="listbox"
        aria-expanded={
          isOpen
            ? "true"
            : "false"
        }
        onClick={() => {
          if (
            disabled ||
            safeOptions.length ===
              0
          ) {
            return;
          }

          setIsOpen(
            current =>
              !current
          );
        }}
      >
        <span className="connect-select-value">
          {selectedOption ? (
            <OptionContent
              option={
                selectedOption
              }
            />
          ) : (
            "Select"
          )}
        </span>

        <span
          className="connect-select-chevron"
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      <div
        className="connect-select-menu"
        role="listbox"
      >
        {safeOptions.map(
          option => {
            const isSelected =
              option.value ===
              value;

            const optionDisabled =
              Boolean(
                option.disabled
              );

            return (
              <button
                key={
                  option.value
                }
                type="button"
                disabled={
                  optionDisabled
                }
                className={[
                  "connect-select-option",

                  isSelected
                    ? "is-selected"
                    : "",

                  optionDisabled
                    ? "is-disabled"
                    : ""
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")}
                role="option"
                aria-selected={
                  isSelected
                    ? "true"
                    : "false"
                }
                aria-disabled={
                  optionDisabled
                    ? "true"
                    : "false"
                }
                onClick={() => {
                  if (
                    optionDisabled
                  ) {
                    return;
                  }

                  onChange(
                    option.value
                  );

                  setIsOpen(
                    false
                  );
                }}
              >
                <OptionContent
                  option={
                    option
                  }
                />
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
