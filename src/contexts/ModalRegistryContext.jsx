import React, { createContext, useContext, useState, useCallback } from "react";

const ModalRegistryContext = createContext(null);

export function ModalRegistryProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);

  const openModal = useCallback((modalId, payload = null) => {
    setActiveModal(modalId);
    setModalPayload(payload);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalPayload(null);
  }, []);

  const isOpen = useCallback(
    (modalId) => activeModal === modalId,
    [activeModal]
  );

  const value = {
    activeModal,
    modalPayload,
    openModal,
    closeModal,
    isOpen,
  };

  return (
    <ModalRegistryContext.Provider value={value}>
      {children}
    </ModalRegistryContext.Provider>
  );
}

export function useModalRegistry() {
  const context = useContext(ModalRegistryContext);
  if (!context) {
    throw new Error("useModalRegistry must be used within a ModalRegistryProvider");
  }
  return context;
}
