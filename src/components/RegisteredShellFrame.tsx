import { useEffect, useRef } from 'react';
import shellui from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

interface RegisteredShellFrameProps {
  src: string;
  title: string;
}

export function RegisteredShellFrame({ src, title }: RegisteredShellFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeUuidRef = useRef<string | null>(null);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const uuid = shellui.addIframe(frame);
    iframeUuidRef.current = uuid;

    const pushSettingsToChild = (settings: Settings | null | undefined) => {
      if (!iframeUuidRef.current || !settings) return;
      shellui.sendMessage({
        type: 'SHELLUI_SETTINGS',
        payload: { settings },
        to: [iframeUuidRef.current],
      });
    };

    pushSettingsToChild(shellui.initialSettings);

    const offSettings = shellui.addMessageListener('SHELLUI_SETTINGS', (message) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      pushSettingsToChild(settings);
    });

    return () => {
      offSettings();
      if (iframeUuidRef.current) {
        shellui.removeIframe(iframeUuidRef.current);
      }
      iframeUuidRef.current = null;
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      className="h-full w-full border-0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
