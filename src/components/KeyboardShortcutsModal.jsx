import { OverlayDialog } from "./OverlayDialog";
import AppButton from "./AppButton";
import { DEFAULT_KEYBOARD_SHORTCUTS } from "../utils/keyboardShortcuts";

export function KeyboardShortcutsModal({ isOpen, onClose, shortcuts = DEFAULT_KEYBOARD_SHORTCUTS }) {
  if (!isOpen) return null;

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel="Keyboard shortcuts" cardClassName="keyboard-shortcuts-card">
        <div className="overlay-dialog-header">
          <h2>Keyboard Shortcuts</h2>
          <AppButton variant="small" onClick={onClose}>Close</AppButton>
        </div>
        <div className="keyboard-shortcuts-table-wrap">
          <p className="muted">
            Some shortcuts are context-specific. Check the Scope and Notes columns before relying on a shortcut globally.
          </p>
          <table className="keyboard-shortcuts-table">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
                <th>Scope</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((shortcut) => (
                <tr key={`${shortcut.keys}-${shortcut.action}`}>
                  <td><kbd>{shortcut.keys}</kbd></td>
                  <td>{shortcut.action}</td>
                  <td>{shortcut.group}</td>
                  <td>{shortcut.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </OverlayDialog>
  );
}