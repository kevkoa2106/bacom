import { contextBridge, ipcRenderer } from "electron";
import type { VaultAPI } from "../src/shared/types";

const api: VaultAPI = {
  status: () => ipcRenderer.invoke("vault:status"),
  create: (password) => ipcRenderer.invoke("vault:create", password),
  unlock: (password) => ipcRenderer.invoke("vault:unlock", password),
  lock: () => ipcRenderer.invoke("vault:lock"),
  list: () => ipcRenderer.invoke("vault:list"),
  parse: (text, website) => ipcRenderer.invoke("vault:parse", text, website),
  chooseFile: (website) => ipcRenderer.invoke("vault:choose-file", website),
  importCodes: (input) => ipcRenderer.invoke("vault:import", input),
  reveal: (accountId, password) =>
    ipcRenderer.invoke("vault:reveal", accountId, password),
  finishReveal: (token, used) =>
    ipcRenderer.invoke("vault:finish", token, used),
  copy: (token) => ipcRenderer.invoke("vault:copy", token),
  exportVault: () => ipcRenderer.invoke("vault:export"),
  onLocked: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("vault:locked", listener);
    return () => {
      ipcRenderer.removeListener("vault:locked", listener);
    };
  },
};

contextBridge.exposeInMainWorld("bacom", Object.freeze(api));
