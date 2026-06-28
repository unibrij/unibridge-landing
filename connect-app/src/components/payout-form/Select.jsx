// connect-app/src/components/payout-form/Select.jsx

import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  normalizeArray
} from "./routeUtils.js";

export default function Select({
  value,
  options,
  disabled,
  onChange,
  ariaLabel
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const shellRef =
    useRef(null);

  const safeOptions =
    normalizeArray(options);

  const selectedOption =
    safeOptions.find(option => option.value === value) ||
    safeOptions[0] ||
    null;

  useEffect(() => {
    function handleClickOutside(event) {
      if (!shellRef.current) return;

      if (!shellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div
      ref={shellRef}
      className={
        isOpen
          ? "connect-select-shell is-open"
          : "connect-select-shell"
      }
    >
      <button
        type="button"
        className="connect-select-trigger"
        disabled={disabled || safeOptions.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen ? "true" : "false"}
        onClick={() => {
          if (disabled || safeOptions.length === 0) return;
          setIsOpen(current => !current);
        }}
      >
        <span className="connect-select-value">
          {selectedOption?.label || "Select"}
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
        {safeOptions.map(option => {
          const isSelected =
            option.value === value;

          const optionDisabled =
            Boolean(option.disabled);

          return (
            <button
              key={option.value}
              type="button"
              disabled={optionDisabled}
              className={[
                "connect-select-option",
                isSelected ? "is-selected" : "",
                optionDisabled ? "is-disabled" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              role="option"
              aria-selected={isSelected ? "true" : "false"}
              aria-disabled={optionDisabled ? "true" : "false"}
              onClick={() => {
                if (optionDisabled) return;

                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
