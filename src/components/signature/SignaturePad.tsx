'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

export interface SignaturePadHandle {
  /** Returns the signature as a PNG data URL, or null if empty. */
  getDataUrl: () => string | null;
  /** Clears the canvas and notifies the parent via onChange. */
  clear: () => void;
  /** True when the user has drawn at least one stroke. */
  isEmpty: () => boolean;
}

interface Props {
  width?: number;
  height?: number;
  /** Fired with true on first stroke, false after clear. Used to enable/disable "다음" buttons. */
  onChange?: (hasSignature: boolean) => void;
  clearLabel?: string;
}

/**
 * Thin wrapper around react-signature-canvas. Exposes an imperative handle so
 * the parent form can pull the data URL at submit time without re-rendering.
 *
 * Why not return data URL on every stroke? react-signature-canvas re-paints on
 * each pointer event; reading toDataURL every time would stall low-end mobile.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { width = 600, height = 150, onChange, clearLabel = '서명 지우기' },
  ref,
) {
  const padRef = useRef<SignatureCanvas | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  useImperativeHandle(ref, () => ({
    getDataUrl: () => {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return null;
      return pad.getCanvas().toDataURL('image/png');
    },
    clear: () => {
      padRef.current?.clear();
      setHasSignature(false);
      onChange?.(false);
    },
    isEmpty: () => padRef.current?.isEmpty() ?? true,
  }));

  return (
    <div className="space-y-2">
      <div className="border rounded bg-white">
        <SignatureCanvas
          ref={(instance) => {
            padRef.current = instance;
          }}
          penColor="#111827"
          canvasProps={{
            width,
            height,
            className: 'touch-none rounded',
          }}
          onBegin={() => {
            if (!hasSignature) {
              setHasSignature(true);
              onChange?.(true);
            }
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            padRef.current?.clear();
            setHasSignature(false);
            onChange?.(false);
          }}
        >
          {clearLabel}
        </Button>
      </div>
    </div>
  );
});
