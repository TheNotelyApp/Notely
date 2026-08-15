import { getNotesApi } from "./base";

export function onMenuAction(callback) {
  const api = getNotesApi();
  if (typeof api.onMenuAction !== "function") {
    return () => {};
  }
  return api.onMenuAction(callback);
}

export function updateMenuContext(context) {
  const api = getNotesApi();
  if (typeof api.updateMenuContext !== "function") {
    return;
  }
  api.updateMenuContext(context || {});
}

export function notifyBootReady() {
  const api = getNotesApi();
  if (typeof api.notifyBootReady !== "function") {
    return;
  }
  api.notifyBootReady();
}

export function notifyBootProgress(progress) {
  const api = getNotesApi();
  if (typeof api.notifyBootProgress !== "function") {
    return;
  }
  api.notifyBootProgress(progress || {});
}

export async function getAppearanceSettings() {
  const api = getNotesApi();
  if (typeof api.getAppearanceSettings !== "function") {
    return {
      themePreference: "auto",
      effectiveTheme: "light",
      zoomFactor: 0.8,
    };
  }
  return api.getAppearanceSettings();
}

export async function getOnboardingComplete() {
  const api = getNotesApi();
  if (typeof api.getOnboardingComplete !== "function") {
    return { onboardingComplete: false };
  }
  return api.getOnboardingComplete();
}

export async function setOnboardingComplete(onboardingComplete) {
  const api = getNotesApi();
  if (typeof api.setOnboardingComplete !== "function") {
    return { onboardingComplete: false };
  }
  return api.setOnboardingComplete({ onboardingComplete });
}

export async function setThemePreference(themePreference) {
  const api = getNotesApi();
  if (typeof api.setThemePreference !== "function") {
    return {
      themePreference: "auto",
      effectiveTheme: "light",
    };
  }
  return api.setThemePreference({ themePreference });
}

export async function setZoomFactor(zoomFactor) {
  const api = getNotesApi();
  if (typeof api.setZoomFactor !== "function") {
    return { zoomFactor: 0.8 };
  }
  return api.setZoomFactor({ zoomFactor });
}

export function onThemeChanged(callback) {
  const api = getNotesApi();
  if (typeof api.onThemeChanged !== "function") {
    return () => {};
  }
  return api.onThemeChanged(callback);
}
