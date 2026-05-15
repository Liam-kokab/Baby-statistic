import { useState, useEffect } from 'react';

type TBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type TUseInstallPrompt = {
  canInstall: boolean;
  install: () => Promise<void>;
  dismissed: boolean;
  dismiss: () => void;
};

export const useInstallPrompt = (): TUseInstallPrompt => {
  const [promptEvent, setPromptEvent] = useState<TBeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as TBeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async (): Promise<void> => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setPromptEvent(null);
  };

  const dismiss = (): void => setDismissed(true);

  return { canInstall: promptEvent !== null && !dismissed, install, dismissed, dismiss };
};

