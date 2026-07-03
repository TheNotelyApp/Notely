import { X } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import AppIconButton from "./AppIconButton";
import { DEFAULT_KEYBOARD_SHORTCUTS } from "../utils/keyboardShortcuts";

export function KeyboardShortcutsModal({ isOpen, onClose, shortcuts = DEFAULT_KEYBOARD_SHORTCUTS }) {
  if (!isOpen) return null;

  return (
    <OverlayDialog open={isOpen} onClose={onClose} ariaLabel="Keyboard shortcuts" cardClassName="keyboard-shortcuts-card">
        <div className="overlay-dialog-header">
          <h2>Keyboard Shortcuts</h2>
          <AppIconButton onClick={onClose} aria-label="Close keyboard shortcuts">
            <X size={16} />
          </AppIconButton>
        </div>
        <p className="keyboard-shortcuts-intro">
          Some shortcuts only work in specific parts of the app. Check the Scope and Notes columns before using them everywhere.
        </p>
        <div className="keyboard-shortcuts-table-wrap">
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