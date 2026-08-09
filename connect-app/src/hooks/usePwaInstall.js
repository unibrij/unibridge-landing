// connect-app/src/hooks/usePwaInstall.js

import {
  useCallback,
  useEffect,
  useState
} from "react";

export default function usePwaInstall({
  onInstallClicked,
  writeDebug
}) {
  const [
    installPrompt,
    setInstallPrompt
  ] = useState(null);

  const [
    canInstallPwa,
    setCanInstallPwa
  ] = useState(false);

  const [
    isStandalonePwa,
    setIsStandalonePwa
  ] = useState(false);

  useEffect(() => {
    const standalone =
      window
        .matchMedia(
          "(display-mode: standalone)"
        )
        .matches ||
      window.navigator
        .standalone ===
        true;

    setIsStandalonePwa(
      standalone
    );

    function handleBeforeInstallPrompt(
      event
    ) {
      event.preventDefault();

      setInstallPrompt(
        event
      );

      setCanInstallPwa(
        true
      );
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallPwa =
    useCallback(
      async () => {
        await onInstallClicked?.({
          hasInstallPrompt:
            Boolean(
              installPrompt
            )
        });

        if (!installPrompt) {
          writeDebug?.(
            "Save UniBridge",
            {
              instruction:
                "Use your browser menu and choose Add to Home Screen."
            }
          );

          return;
        }

        installPrompt.prompt();

        const choice =
          await installPrompt
            .userChoice;

        setInstallPrompt(
          null
        );

        setCanInstallPwa(
          false
        );

        writeDebug?.(
          "Home screen install prompt completed.",
          {
            outcome:
              choice?.outcome ||
              null
          }
        );
      },
      [
        installPrompt,
        onInstallClicked,
        writeDebug
      ]
    );

  return {
    canInstallPwa,
    isStandalonePwa,

    handleInstallPwa
  };
}
