import { createContext, useState, useCallback, useRef } from "react";
import OverlayDialog from "./OverlayDialog";
import AppButton from "./AppButton";
import { Check, X, AlertTriangle, AlertCircle, Info, ArrowLeft } from "lucide-react";

export const ConfirmationContext = createContext(null);

export function ConfirmationProvider({ children }) {
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "primary"
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfirmState({
        open: true,
        title: options.title || "Confirm Action",
        message: options.message || "Are you sure?",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        variant: options.variant || "primary"
      });
    });
  }, []);

  const handleConfirm = () => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <OverlayDialog
        open={confirmState.open}
        onClose={handleCancel}
        closeOnClickOutside={false}
        ariaLabel={confirmState.title}
        cardClassName="confirmation-modal-card"
      >
        <div className={`confirmation-dialog confirmation-dialog--${confirmState.variant || "primary"}`}>
          <div className="confirmation-dialog__icon-wrapper" aria-hidden="true">
            {confirmState.variant === "danger" ? (
              <AlertTriangle size={20} />
            ) : confirmState.variant === "warning" ? (
              <AlertCircle size={20} />
            ) : (
              <Info size={20} />
            )}
          </div>
          <div className="confirmation-dialog__body">
            {confirmState.title && (
              <h3 className="confirmation-dialog__title">
                {confirmState.title}
              </h3>
            )}
            <p className="confirmation-dialog__message">
              {confirmState.message}
            </p>
          </div>
          <div className="confirmation-dialog__actions">
            <AppButton
              variant="secondary"
              onClick={handleCancel}
            >
              {/back/i.test(confirmState.cancelLabel) ? <ArrowLeft size={16} /> : <X size={16} />}
              <span>{confirmState.cancelLabel}</span>
            </AppButton>
            <AppButton
              variant="primary"
              danger={confirmState.variant === "danger"}
              className={confirmState.variant === "danger" ? "danger" : ""}
              onClick={handleConfirm}
            >
              <Check size={16} />
              <span>{confirmState.confirmLabel}</span>
            </AppButton>
          </div>
        </div>
      </OverlayDialog>
    </ConfirmationContext.Provider>
  );
}
