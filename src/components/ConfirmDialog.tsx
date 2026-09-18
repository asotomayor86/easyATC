"use client";

import { useEffect, useRef } from "react";

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-msg"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2px] border border-zinc-700 border-l-4 border-l-gold bg-zinc-900 p-4"
      >
        <p className="kicker mb-2 text-gold">Confirmar</p>
        <p id="confirm-msg" className="mb-4 text-[14px] text-zinc-100">
          {request.message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="kicker rounded-[2px] border border-zinc-600 px-3 py-2 text-[12px] text-zinc-300 hover:border-zinc-400"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
            className="kicker rounded-[2px] border border-gold bg-gold px-3 py-2 text-[12px] text-zinc-950"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
