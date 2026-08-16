import { getNotesApi } from "./base";

export async function getP2PStatus() {
  const api = getNotesApi();
  if (typeof api.getP2PStatus !== "function") {
    throw new Error("P2P status unavailable. Please restart the app.");
  }
  return api.getP2PStatus();
}

export async function startP2PDiscovery() {
  const api = getNotesApi();
  if (typeof api.startP2PDiscovery !== "function") {
    throw new Error("P2P discovery unavailable. Please restart the app.");
  }
  return api.startP2PDiscovery();
}

export async function stopP2PDiscovery() {
  const api = getNotesApi();
  if (typeof api.stopP2PDiscovery !== "function") {
    throw new Error("P2P discovery unavailable. Please restart the app.");
  }
  return api.stopP2PDiscovery();
}

export async function setP2PDeviceName(name) {
  const api = getNotesApi();
  if (typeof api.setP2PDeviceName !== "function") {
    throw new Error("P2P device naming unavailable. Please restart the app.");
  }
  return api.setP2PDeviceName({ name });
}

export async function createP2PInvite(peerId) {
  const api = getNotesApi();
  if (typeof api.createP2PInvite !== "function") {
    throw new Error("P2P invite unavailable. Please restart the app.");
  }
  return api.createP2PInvite({ peerId });
}

export async function pairP2PWithCode(peerId, code) {
  const api = getNotesApi();
  if (typeof api.pairP2PWithCode !== "function") {
    throw new Error("P2P pairing unavailable. Please restart the app.");
  }
  return api.pairP2PWithCode({ peerId, code });
}

export async function pairP2PWithCodeReauth(peerId, code, reauth) {
  const api = getNotesApi();
  if (typeof api.pairP2PWithCode !== "function") {
    throw new Error("P2P pairing unavailable. Please restart the app.");
  }
  return api.pairP2PWithCode({ peerId, code, reauth: Boolean(reauth) });
}

export async function setP2PKeyPolicyDays(days) {
  const api = getNotesApi();
  if (typeof api.setP2PKeyPolicyDays !== "function") {
    throw new Error("P2P key policy unavailable. Please restart the app.");
  }
  return api.setP2PKeyPolicyDays({ days });
}

export async function manualP2PConnect(address, listenPort) {
  const api = getNotesApi();
  if (typeof api.manualP2PConnect !== "function") {
    throw new Error("P2P manual connect unavailable. Please restart the app.");
  }
  return api.manualP2PConnect({ address, listenPort });
}

export async function removeTrustedP2PPeer(peerId) {
  const api = getNotesApi();
  if (typeof api.removeTrustedP2PPeer !== "function") {
    throw new Error("P2P trust management unavailable. Please restart the app.");
  }
  return api.removeTrustedP2PPeer({ peerId });
}

export async function rotateP2PWorkspaceKeys(peerId) {
  const api = getNotesApi();
  if (typeof api.rotateP2PWorkspaceKeys !== "function") {
    throw new Error("P2P key rotation unavailable. Please restart the app.");
  }
  return api.rotateP2PWorkspaceKeys({ peerId });
}

export async function runP2PSyncSelfTest() {
  const api = getNotesApi();
  if (typeof api.runP2PSyncSelfTest !== "function") {
    throw new Error("P2P sync self-test unavailable. Please restart the app.");
  }
  return api.runP2PSyncSelfTest();
}

export async function listP2PSyncConflicts(limit = 200) {
  const api = getNotesApi();
  if (typeof api.listP2PSyncConflicts !== "function") {
    throw new Error("P2P conflict list unavailable. Please restart the app.");
  }
  return api.listP2PSyncConflicts({ limit });
}

export async function readP2PConflictFiles(filePath, conflictPath) {
  const api = getNotesApi();
  if (typeof api.readP2PConflictFiles !== "function") {
    throw new Error("Conflict file reader unavailable. Please restart the app.");
  }
  return api.readP2PConflictFiles({ filePath, conflictPath });
}

export async function resolveP2PConflict(filePath, conflictPath, resolution, mergedContent) {
  const api = getNotesApi();
  if (typeof api.resolveP2PConflict !== "function") {
    throw new Error("Conflict resolution unavailable. Please restart the app.");
  }
  return api.resolveP2PConflict({
    filePath,
    conflictPath,
    resolution: typeof resolution === "string" ? resolution : "merged",
    mergedContent: typeof mergedContent === "string" ? mergedContent : undefined
  });
}

export function onP2PSyncApplied(callback) {
  const api = getNotesApi();
  if (typeof api.onP2PSyncApplied !== "function") {
    return () => {};
  }
  return api.onP2PSyncApplied(callback);
}

export function onP2PFullSyncProgress(callback) {
  const api = getNotesApi();
  if (typeof api.onP2PFullSyncProgress !== "function") {
    return () => {};
  }
  return api.onP2PFullSyncProgress(callback);
}
