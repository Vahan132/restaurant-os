'use client';

import { useCallback, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}

interface InternalState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Promise-based confirmation dialog. Render `dialog` once in the component and
 * `await ask({...})` to get a boolean. Labels are passed in (already i18n'd).
 */
export function useConfirm(): {
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [state, setState] = useState<InternalState | null>(null);

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const finish = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  const dialog = state ? (
    <Modal
      open
      title={state.title}
      onClose={() => finish(false)}
      footer={
        <>
          <Button variant="secondary" onClick={() => finish(false)}>
            {state.cancelLabel}
          </Button>
          <Button
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => finish(true)}
          >
            {state.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{state.message}</p>
    </Modal>
  ) : null;

  return { ask, dialog };
}
