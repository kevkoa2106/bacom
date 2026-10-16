import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  FileKey2,
  FileText,
  FolderKey,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { api, isPreview } from "./lib/api";
import type {
  AccountSummary,
  ParsedCode,
  RevealResult,
  VaultStatus,
} from "./shared/types";
import "./index.css";

type Modal = "import" | "reveal" | "settings" | "help" | null;
type Theme = "light" | "dark" | "system";

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem("bacom-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Theme selection remains available when browser storage is disabled.
  }
  return "system";
}

function ThemePicker({
  theme,
  onChange,
  id,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  id: string;
}) {
  return (
    <div className="theme-picker">
      <label htmlFor={id}>Appearance</label>
      <select
        id={id}
        value={theme}
        onChange={(event) => onChange(event.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}

const message = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      )
    : "Something went wrong. Please try again.";

function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="vault-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      {children}
    </dialog>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && system.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    system.addEventListener("change", apply);
    try {
      localStorage.setItem("bacom-theme", theme);
    } catch {
      /* Nonsecret preference persistence is optional. */
    }
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<Modal>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [website, setWebsite] = useState("");
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [codes, setCodes] = useState<ParsedCode[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const importGeneration = useRef(0);
  const revealedRef = useRef<RevealResult | null>(null);
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    const generation = epoch.current;
    const state = await api.status();
    const list = state.unlocked ? await api.list() : [];
    if (generation !== epoch.current) return;
    setStatus(state);
    setAccounts(list);
  }, []);
  const clearSecrets = useCallback(() => {
    epoch.current++;
    importGeneration.current++;
    setPassword("");
    setConfirmPassword("");
    setCodes([]);
    setReveal(null);
    revealedRef.current = null;
    setFileName("");
    setWarnings([]);
    setCopied(false);
    setExpired(false);
    setWebsite("");
    setLabel("");
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(message(e)));
    return api.onLocked?.(() => {
      clearSecrets();
      setModal(null);
      setAccounts([]);
      setStatus({ exists: true, unlocked: false });
      setError("");
      setBusy(false);
    });
  }, [refresh, clearSecrets]);
  useEffect(() => {
    if (!status?.unlocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const lockNow = () => {
      clearSecrets();
      setModal(null);
      setAccounts([]);
      setStatus({ exists: true, unlocked: false });
      void api.lock().catch((e) => setError(message(e)));
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lockNow, 5 * 60000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [status?.unlocked, clearSecrets]);
  const close = async () => {
    const token = revealedRef.current?.token;
    clearSecrets();
    setModal(null);
    setError("");
    setWebsite("");
    setLabel("");
    if (token)
      try {
        await api.finishReveal(token, false);
      } catch (e) {
        setError(message(e));
        await refresh();
      }
  };
  const open = (next: Modal) => {
    clearSecrets();
    setError("");
    setNotice("");
    setModal(next);
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setPassword("");
      setConfirmPassword("");
      if (revealedRef.current) {
        const masked = { ...revealedRef.current, code: "" };
        revealedRef.current = masked;
        setReveal(masked);
        setExpired(true);
      }
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!reveal?.token) return;
    const timer = setTimeout(() => {
      setExpired(true);
      setReveal((current) => (current ? { ...current, code: "" } : null));
      if (revealedRef.current)
        revealedRef.current = { ...revealedRef.current, code: "" };
    }, 60000);
    return () => clearTimeout(timer);
  }, [reveal?.token]);
  const authenticate = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const attempt = password;
      setPassword("");
      setConfirmPassword("");
      if (!status?.exists && attempt !== confirmPassword)
        throw new Error("The two passwords do not match.");
      if (status?.exists) await api.unlock(attempt);
      else await api.create(attempt);
      await refresh();
    });
  };
  const selectedAccount =
    accounts.find((a) => a.id === selected) ?? accounts[0];
  const remaining = accounts.reduce((sum, a) => sum + a.remaining, 0);
  const filtered = accounts.filter(
    (a) =>
      `${a.website} ${a.label}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "low"
          ? a.remaining > 0 && a.remaining <= 3
          : a.remaining === 0)),
  );
  const readFile = async (file?: File) => {
    if (!file) return;
    const generation = ++importGeneration.current;
    setCodes([]);
    setWarnings([]);
    setError("");
    setBusy(true);
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Choose a text file smaller than 1 MB.");
      const text = await file.text();
      const parsed = await api.parse(text, website);
      if (generation !== importGeneration.current) return;
      setFileName(file.name);
      setCodes(parsed.codes);
      setWarnings(parsed.warnings);
      setFormat(parsed.format);
    } catch (e) {
      if (generation === importGeneration.current) {
        setCodes([]);
        setFileName("");
        setError(message(e));
      }
    } finally {
      if (generation === importGeneration.current) setBusy(false);
    }
  };
  const chooseNativeFile = async () => {
    if (!api.chooseFile) return;
    const generation = ++importGeneration.current;
    setError("");
    setBusy(true);
    try {
      const chosen = await api.chooseFile(website);
      if (generation !== importGeneration.current || !chosen) return;
      setFileName(chosen.name);
      setCodes(chosen.result.codes);
      setWarnings(chosen.result.warnings);
      setFormat(chosen.result.format);
    } catch (error) {
      if (generation === importGeneration.current) {
        setCodes([]);
        setFileName("");
        setError(message(error));
      }
    } finally {
      if (generation === importGeneration.current) setBusy(false);
    }
  };
  const importCodes = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.importCodes({
        website: website.trim(),
        label: label.trim(),
        codes,
      });
      await close();
      await refresh();
      setNotice("Recovery codes added to your vault.");
    });
  };
  const revealCode = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAccount) return;
    void run(async () => {
      const attempt = password;
      setPassword("");
      const currentEpoch = epoch.current;
      const result = await api.reveal(selectedAccount.id, attempt);
      if (epoch.current !== currentEpoch) {
        await api.finishReveal(result.token, false);
        return;
      }
      setExpired(false);
      setReveal(result);
      revealedRef.current = result;
    });
  };
  const markUsed = () => {
    const token = revealedRef.current?.token;
    if (!token) return;
    setReveal((current) => (current ? { ...current, code: "" } : null));
    revealedRef.current = { ...revealedRef.current!, code: "" };
    setExpired(true);
    void run(async () => {
      await api.finishReveal(token, true);
      revealedRef.current = null;
      await close();
      await refresh();
      setNotice("Code marked as used. Your remaining count has been updated.");
    });
  };
  const lock = () => {
    clearSecrets();
    setModal(null);
    setAccounts([]);
    setStatus({ exists: true, unlocked: false });
    void run(() => api.lock());
  };
  const exportVault = () => {
    void run(async () => {
      if (await api.exportVault())
        setNotice("Encrypted backup saved. Keep it somewhere safe.");
    });
  };

  if (!status || !status.unlocked)
    return (
      <main className="entry-shell">
        <div className="entry-brand">
          <Brand />
          <span>RECOVERY CODE VAULT</span>
          <ThemePicker theme={theme} onChange={setTheme} id="entry-theme" />
        </div>
        <div className="entry-content">
          <div className="entry-icon">
            <LockKeyhole size={28} strokeWidth={1.6} />
          </div>
          <p className="eyebrow">YOUR FALLBACK, KEPT CLOSE</p>
          <h1>
            {!status
              ? "Opening Bacom…"
              : status.exists
                ? "Welcome back."
                : "A safe place for your backup codes."}
          </h1>
          <p className="entry-description">
            {status?.exists
              ? "Unlock your vault to access your accounts and recovery codes."
              : "Keep your recovery codes together, ready for the moment you need them."}
          </p>
          {isPreview && (
            <div className="preview-note">
              <strong>Disposable browser preview</strong>
              <br />
              Use sample codes only. Your preview vault resets when this page
              reloads. Real file storage is in the Electron app.
            </div>
          )}
          {!status && error && (
            <>
              <p role="alert" className="error-box">
                {error}
              </p>
              <Button
                onClick={() => {
                  setError("");
                  void refresh().catch((e) => setError(message(e)));
                }}
              >
                Try opening again
              </Button>
            </>
          )}
          {status && (
            <form onSubmit={authenticate} className="entry-form">
              <label htmlFor="master-password">Master password</label>
              <Input
                id="master-password"
                autoFocus
                type="password"
                autoComplete={
                  status.exists ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={status.exists ? undefined : 12}
                disabled={busy}
              />
              {!status.exists && (
                <>
                  <p className="field-note">
                    At least 12 characters, up to 72 UTF-8 bytes. Choose a
                    password you can remember; it cannot be recovered.
                  </p>
                  <label htmlFor="confirm-password">
                    Confirm master password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={busy}
                  />
                </>
              )}
              {error && (
                <p role="alert" className="error-box">
                  {error}
                </p>
              )}
              <Button className="entry-submit" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : status.exists
                    ? "Unlock vault"
                    : "Create vault"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <p className="entry-footer">
            <ShieldCheck size={15} /> Stored locally. Encrypted with your master
            password.
          </p>
        </div>
        <div className="entry-bottom">
          BACOM <span>A little preparation. A lot of peace of mind.</span>
        </div>
      </main>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="vault-location">
          <span className="status-dot" />
          {isPreview ? "Preview vault" : "Local vault"}
          <span>UNLOCKED</span>
        </div>
        <nav aria-label="Vault navigation">
          <p className="nav-label">WORKSPACE</p>
          <button
            className={`nav-item ${filter === "all" ? "active" : ""}`}
            aria-current={filter === "all" ? "page" : undefined}
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
          >
            <FolderKey size={18} />
            All accounts<span className="nav-count">{accounts.length}</span>
          </button>
          <button
            className={`nav-item ${filter === "low" ? "active" : ""}`}
            aria-current={filter === "low" ? "page" : undefined}
            onClick={() => setFilter("low")}
          >
            <KeyRound size={18} />
            Running low
            <span className="nav-count">
              {
                accounts.filter((a) => a.remaining > 0 && a.remaining <= 3)
                  .length
              }
            </span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="local-note">
            <ShieldCheck size={21} />
            <div>
              <strong>Yours, on this device.</strong>
              <p>
                {isPreview
                  ? "Sample codes only. Resets on reload."
                  : "Your codes stay in an encrypted local file."}
              </p>
            </div>
          </div>
          <button className="nav-item" onClick={() => open("help")}>
            <HelpCircle size={18} />
            Help & how it works
          </button>
          <button className="nav-item" onClick={() => open("settings")}>
            <Settings2 size={18} />
            Vault settings
          </button>
          <button
            className="nav-item lock-action"
            disabled={busy}
            onClick={lock}
          >
            <LockKeyhole size={18} />
            Lock vault
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <span>My vault</span>
            <ChevronRight size={14} />
            <strong>Recovery codes</strong>
          </div>
          <Button variant="ghost" onClick={lock} disabled={busy}>
            <LockKeyhole />
            Lock<span className="desktop-label"> vault</span>
          </Button>
        </header>
        {isPreview && (
          <div className="preview-banner">
            Browser preview · Use sample codes only. Nothing is saved after a
            reload.
          </div>
        )}
        <div className="workspace-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">ACCOUNT LIBRARY</p>
              <h1>Recovery codes</h1>
              <p>Your way back in, when your second factor isn’t available.</p>
            </div>
            <Button onClick={() => open("import")}>
              <Plus />
              Add codes
            </Button>
          </div>
          <div className="overview-strip">
            <div>
              <strong>{accounts.length.toString().padStart(2, "0")}</strong>
              <span>accounts stored</span>
            </div>
            <div>
              <strong>{remaining.toString().padStart(2, "0")}</strong>
              <span>unused codes</span>
            </div>
            <div className="overview-note">
              <ShieldCheck size={19} />
              <span>
                Master password required
                <br />
                each time you reveal a code.
              </span>
            </div>
          </div>
          {error && !modal && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="notice-box">
              <Check size={16} />
              {notice}
            </p>
          )}
          <div className="library-tools">
            <div className="search-field">
              <Search size={17} />
              <Input
                aria-label="Search accounts"
                placeholder="Search website or account…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter accounts"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All accounts</option>
              <option value="low">Running low (1–3)</option>
              <option value="empty">No codes left</option>
            </select>
          </div>
          {accounts.length === 0 ? (
            <section className="empty-state">
              <div className="empty-icon">
                <FileKey2 size={32} strokeWidth={1.4} />
              </div>
              <h2>Your backup plan starts here.</h2>
              <p>
                Download backup codes from a website’s security settings,
                <br className="desktop-label" /> then add the text file to your
                vault.
              </p>
              <Button variant="outline" onClick={() => open("import")}>
                <Plus />
                Add your first codes
              </Button>
              <span>Review every code before it’s saved.</span>
            </section>
          ) : (
            <div className="library-grid">
              <section className="account-list" aria-label="Accounts">
                <div className="list-heading">
                  <span>WEBSITE / ACCOUNT</span>
                  <span>AVAILABLE</span>
                </div>
                {filtered.length === 0 ? (
                  <p className="no-results">No accounts match your search.</p>
                ) : (
                  filtered.map((account) => (
                    <button
                      className={`account-row ${selectedAccount?.id === account.id ? "selected" : ""}`}
                      key={account.id}
                      onClick={() => setSelected(account.id)}
                    >
                      <span className="website-monogram" aria-hidden="true">
                        {account.website
                          .replace(/^https?:\/\//, "")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <span className="account-name">
                        <strong>{account.website}</strong>
                        <span>{account.label || "Recovery codes"}</span>
                      </span>
                      <span
                        className={`code-count ${account.remaining <= 3 ? "low" : ""}`}
                      >
                        {account.remaining}
                        <small> / {account.total}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                )}
              </section>
              {selectedAccount &&
                filtered.some(
                  (account) => account.id === selectedAccount.id,
                ) && (
                  <section className="account-detail">
                    <div className="detail-icon">
                      <KeyRound size={24} />
                    </div>
                    <p className="eyebrow">ACCOUNT DETAILS</p>
                    <h2>{selectedAccount.website}</h2>
                    <p className="account-label">
                      {selectedAccount.label || "Recovery codes"}
                    </p>
                    <div className="detail-count">
                      <strong>{selectedAccount.remaining}</strong>
                      <span>
                        codes available
                        <br />
                        <small>of {selectedAccount.total} imported</small>
                      </span>
                    </div>
                    <div
                      className="code-meter"
                      aria-label={`${selectedAccount.used} of ${selectedAccount.total} codes used`}
                    >
                      {Array.from(
                        { length: Math.min(selectedAccount.total, 20) },
                        (_, i) => (
                          <span
                            key={i}
                            className={
                              i / Math.min(selectedAccount.total, 20) <
                              selectedAccount.used / selectedAccount.total
                                ? "used"
                                : ""
                            }
                          />
                        ),
                      )}
                    </div>
                    <p className="used-note">
                      <CheckCheck size={15} />
                      {selectedAccount.used} marked as used
                    </p>
                    <Button
                      className="reveal-button"
                      disabled={selectedAccount.remaining === 0}
                      onClick={() => open("reveal")}
                    >
                      <KeyRound />
                      {selectedAccount.remaining
                        ? "Reveal a code"
                        : "No codes remaining"}
                      <ArrowRight size={16} />
                    </Button>
                    <p className="detail-help">
                      {selectedAccount.remaining
                        ? "You’ll confirm your master password first. A code is only marked used when you say so."
                        : "Generate a new set in this website’s security settings, then import it here."}
                    </p>
                    <div className="import-date">
                      Added{" "}
                      {new Date(selectedAccount.createdAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </div>
                  </section>
                )}
            </div>
          )}
          <footer className="workspace-footer">
            <LockKeyhole size={13} />
            <span>Local storage. No cloud account.</span>
            <span>Bacom / recovery, organized.</span>
          </footer>
        </div>
      </main>
      {modal === "import" && (
        <Dialog
          title="Add recovery codes"
          onClose={() => void close()}
          busy={busy}
        >
          <form onSubmit={importCodes}>
            <p className="dialog-intro">
              Choose a downloaded text file, then review the codes before
              saving.
            </p>
            <label htmlFor="website">Website</label>
            <Input
              id="website"
              placeholder="e.g. github.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={200}
              required
              disabled={busy}
            />
            <label htmlFor="account-label">
              Account label <span className="optional">optional</span>
            </label>
            <Input
              id="account-label"
              placeholder="e.g. Personal · alex@example.com"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
            {api.chooseFile ? (
              <button
                type="button"
                className="file-picker native-file-picker"
                disabled={busy}
                onClick={() => void chooseNativeFile()}
              >
                <FileText size={23} />
                <strong>{fileName || "Choose a text file"}</strong>
                <span>Plain text · up to 1 MB</span>
              </button>
            ) : (
              <label htmlFor="codes-file" className="file-picker">
                <FileText size={23} />
                <strong>{fileName || "Choose a text file"}</strong>
                <span>Plain text · up to 1 MB</span>
                <input
                  id="codes-file"
                  type="file"
                  accept=".txt,text/plain"
                  disabled={busy}
                  onChange={(e) => {
                    void readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {codes.length > 0 && (
              <>
                <div className="preview-heading">
                  <strong>{codes.length} codes found</strong>
                  <span>{format}</span>
                </div>
                <p className="field-note">
                  Check codes already used. You can edit any incorrectly
                  detected code.
                </p>
                <div className="code-preview">
                  {codes.map((code, index) => (
                    <div className="code-preview-row" key={index}>
                      <span className="row-number">{index + 1}</span>
                      <Input
                        aria-label={`Code ${index + 1}`}
                        value={code.value}
                        maxLength={128}
                        onChange={(e) =>
                          setCodes((old) =>
                            old.map((c, i) =>
                              i === index ? { ...c, value: e.target.value } : c,
                            ),
                          )
                        }
                        required
                        disabled={busy}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <label className="used-checkbox">
                        <input
                          type="checkbox"
                          checked={code.used}
                          onChange={(e) =>
                            setCodes((old) =>
                              old.map((c, i) =>
                                i === index
                                  ? { ...c, used: e.target.checked }
                                  : c,
                              ),
                            )
                          }
                          disabled={busy}
                        />
                        Used
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove code ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          setCodes((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              className="manual-code-button"
              disabled={busy || codes.length >= 1000}
              onClick={() =>
                setCodes((current) => [...current, { value: "", used: false }])
              }
            >
              <Plus />
              Add a code manually
            </Button>
            {warnings.map((warning, index) => (
              <p className="warning-box" key={index}>
                {warning}
              </p>
            ))}
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => void close()}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button disabled={busy || codes.length === 0}>
                {busy ? "Processing…" : "Save to vault"}
                <ArrowRight />
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "reveal" && (
        <Dialog
          title={reveal ? "Your recovery code" : "Confirm it’s you"}
          onClose={() => void close()}
          busy={busy}
        >
          {reveal ? (
            <>
              <p className="dialog-intro">
                For <strong>{selectedAccount?.website}</strong>
                {selectedAccount?.label ? ` · ${selectedAccount.label}` : ""}
              </p>
              <div className="revealed-code">
                <code>{expired ? "Code hidden" : reveal.code}</code>
                <Button
                  variant="outline"
                  aria-label="Copy recovery code"
                  disabled={busy || expired}
                  onClick={() =>
                    void run(async () => {
                      await api.copy(reveal.token);
                      setCopied(true);
                    })
                  }
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="field-note">
                Code hides after 60 seconds. You can still confirm usage
                afterward. Clipboard clears after 30 seconds if unchanged.
              </p>
              <div className="use-instruction">
                <CheckCheck size={20} />
                <div>
                  <strong>Did the website accept this code?</strong>
                  <p>
                    Mark it used after you’ve signed in successfully. Copying or
                    closing this window leaves it available.
                  </p>
                </div>
              </div>
              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void close()}
                >
                  Close without using
                </Button>
                <Button disabled={busy} onClick={markUsed}>
                  <Check />
                  Mark as used
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={revealCode}>
              <div className="password-context">
                <KeyRound size={23} />
                <div>
                  <strong>{selectedAccount?.website}</strong>
                  <span>{selectedAccount?.label || "Recovery codes"}</span>
                </div>
              </div>
              <p className="dialog-intro">
                Enter your master password to reveal one unused code.
              </p>
              <label htmlFor="reveal-password">Master password</label>
              <Input
                autoFocus
                id="reveal-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void close()}
                >
                  Cancel
                </Button>
                <Button disabled={busy}>
                  {busy ? "Verifying…" : "Reveal code"}
                  <ArrowRight />
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}
      {modal === "settings" && (
        <Dialog title="Vault settings" onClose={() => void close()} busy={busy}>
          <div className="settings-item theme-settings">
            <Settings2 />
            <div>
              <ThemePicker
                theme={theme}
                onChange={setTheme}
                id="settings-theme"
              />
              <p>
                System follows your device’s appearance. Only this preference is
                saved in browser storage.
              </p>
            </div>
          </div>
          <div className="settings-item">
            <ShieldCheck />
            <div>
              <strong>
                {isPreview
                  ? "Disposable preview storage"
                  : "Encrypted local storage"}
              </strong>
              <p>
                {isPreview
                  ? "This browser demo encrypts its in-memory contents. Reloading removes the entire preview vault."
                  : "Your accounts, codes, and usage history are encrypted together on this device."}
              </p>
            </div>
          </div>
          <div className="settings-item">
            <LockKeyhole />
            <div>
              <strong>Auto-lock after 5 minutes</strong>
              <p>
                Without keyboard or pointer activity, your vault locks. You can
                lock it manually at any time.
              </p>
            </div>
          </div>
          <div className="settings-item">
            <ArrowDownToLine />
            <div>
              <strong>Encrypted backup</strong>
              <p>
                Save a copy of the encrypted vault file. The same master
                password is required to open it.
              </p>
              <Button
                variant="outline"
                disabled={busy || isPreview}
                onClick={exportVault}
              >
                <ArrowDownToLine />
                Export encrypted backup
              </Button>
              {isPreview && (
                <p className="field-note">
                  Export is available in the desktop app.
                </p>
              )}
            </div>
          </div>
          {notice && (
            <p role="status" className="notice-box">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button onClick={() => void close()} disabled={busy}>
              Done
            </Button>
          </div>
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog
          title="Your backup plan, explained"
          onClose={() => void close()}
        >
          <ol className="help-steps">
            <li>
              <strong>Download your recovery codes.</strong>
              <p>
                In a website’s security settings, turn on two-factor
                authentication and save its backup codes as a text file.
              </p>
            </li>
            <li>
              <strong>Import and review.</strong>
              <p>
                Add the file, website, and an optional account label. Bacom
                detects common code formats; review every value and check any
                code already used.
              </p>
            </li>
            <li>
              <strong>Reveal when you need one.</strong>
              <p>
                Confirm your master password, copy a code, and enter it on the
                website. Choose “Mark as used” only after it’s accepted.
              </p>
            </li>
          </ol>
          <div className="warning-box">
            Generating a fresh set on a website usually invalidates its previous
            codes. Import the new set and use that account entry.
          </div>
          <p className="dialog-intro">
            Keep your master password safe: it cannot be reset. Original
            downloaded files remain on your device; manage them yourself after
            import.
          </p>
          <div className="dialog-actions">
            <Button onClick={() => void close()}>Got it</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <FolderKey size={23} strokeWidth={1.7} />
      </span>
      <span>
        bacom<span className="brand-period">.</span>
      </span>
    </div>
  );
}
export default App;
