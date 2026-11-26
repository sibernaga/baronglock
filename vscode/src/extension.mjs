import * as vscode from "vscode";
import { watch } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import { isLocked, keyIdOf, usesPassword, MIN_PASSWORD_LENGTH } from "baronglock";
import { readLocked, writeLocked, lockedPath, lockToFile } from "./locked-file.mjs";

const SCHEME = "baronglock";
const VIEW_TYPE = "baronglock.lockedFile";
const LOCKED_NAME = /\.(blj|baronglock)$/i;
const LOCKED_FILTER = { "BarongLock files": ["baronglock", "blj"] };

// baronglock:/d:/notes.blj is the unlocked view of file:///d:/notes.blj.
const toFileUri = (uri) => uri.with({ scheme: "file" });
const toLockedUri = (uri) => uri.with({ scheme: SCHEME });
const toPath = (uri) => toFileUri(uri).fsPath;

function toFsError(error, uri) {
  if (error?.code === "ENOENT") return vscode.FileSystemError.FileNotFound(uri);
  if (error?.code === "EISDIR") return vscode.FileSystemError.FileIsADirectory(uri);
  return error;
}

// Passwords that opened a file this session, by path. In memory only, and
// dropped when the file's document closes. Saving needs the password again.
const passwords = new Map();
const passwordFor = (path) => passwords.get(path) ?? (process.env.BARONGLOCK_PASSWORD || undefined);

// Unlocks a file on disk, asking for its password when it has one.
async function unlockPath(path) {
  const { plaintext, password } = await readLocked(path, {
    password: passwordFor(path),
    askPassword: (message) => vscode.window.showInputBox({
      title: `Password for ${basename(path)}`,
      prompt: message,
      password: true,
      ignoreFocusOut: true,
    }),
  });
  if (password !== undefined) passwords.set(path, password);
  return plaintext;
}

// Saves with the remembered password. If there is none (or it no longer
// fits the file on disk), asks for it, checks it against the file, then saves.
async function saveLocked(path, content) {
  try {
    await writeLocked(path, content, { password: passwordFor(path) });
  } catch (error) {
    if (error.code !== "BARONGLOCK_PASSWORD_REQUIRED" && error.code !== "BARONGLOCK_WRONG_PASSWORD") throw error;
    passwords.delete(path);
    await unlockPath(path);
    await writeLocked(path, content, { password: passwords.get(path) });
  }
}

// A language change closes and reopens the document right away, so wait a
// moment before forgetting a password.
function forgetPasswordLater(doc) {
  if (doc.uri.scheme !== SCHEME) return;
  const key = doc.uri.toString();
  setTimeout(() => {
    if (!vscode.workspace.textDocuments.some((d) => d.uri.toString() === key)) passwords.delete(toPath(doc.uri));
  }, 2000);
}

// Shows a locked file's contents as a normal text file. Reading unlocks it;
// saving locks the new text the same way (same key, or same password).
class LockedFileSystem {
  #changes = new vscode.EventEmitter();
  onDidChangeFile = this.#changes.event;

  // Watches the folder, not the file: saving replaces the file, which ends a
  // watch on the file itself on some systems.
  watch(uri) {
    const path = toPath(uri);
    const name = basename(path);
    try {
      const watcher = watch(dirname(path), (_event, changed) => {
        if (!changed || changed === name) this.#changes.fire([{ type: vscode.FileChangeType.Changed, uri }]);
      });
      watcher.on("error", () => {});
      return new vscode.Disposable(() => watcher.close());
    } catch {
      return new vscode.Disposable(() => {});
    }
  }

  async stat(uri) {
    let info;
    try { info = await stat(toPath(uri)); } catch (error) { throw toFsError(error, uri); }
    if (info.isDirectory()) throw vscode.FileSystemError.FileIsADirectory(uri);
    return { type: vscode.FileType.File, ctime: info.ctimeMs, mtime: info.mtimeMs, size: info.size };
  }

  async readFile(uri) {
    try { return await unlockPath(toPath(uri)); } catch (error) { throw toFsError(error, uri); }
  }

  async writeFile(uri, content, { create, overwrite }) {
    const path = toPath(uri);
    const exists = await stat(path).then(() => true, (error) => {
      if (error.code === "ENOENT") return false;
      throw toFsError(error, uri);
    });
    if (!exists) {
      throw create
        ? vscode.FileSystemError.NoPermissions("Create new locked files with the BarongLock CLI.")
        : vscode.FileSystemError.FileNotFound(uri);
    }
    if (!overwrite) throw vscode.FileSystemError.FileExists(uri);
    try { await saveLocked(path, content); } catch (error) { throw toFsError(error, uri); }
    this.#changes.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  readDirectory() { throw vscode.FileSystemError.NoPermissions(); }
  createDirectory() { throw vscode.FileSystemError.NoPermissions(); }
  delete() { throw vscode.FileSystemError.NoPermissions(); }
  rename() { throw vscode.FileSystemError.NoPermissions(); }
}

function openUnlocked(uri, viewColumn) {
  // "default" forces the normal text editor, so this custom editor isn't picked again.
  return vscode.commands.executeCommand("vscode.openWith", toLockedUri(toFileUri(uri)), "default", viewColumn);
}

// Opening a .blj or .baronglock file lands here first. If the file unlocks,
// this tab is swapped for the unlocked text editor. If not, it explains why.
class LockedFileOpener {
  openCustomDocument(uri) {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(document, panel) {
    try {
      // Asks for the password here, or fails with a clear message if the key is missing.
      await unlockPath(toPath(document.uri));
      await openUnlocked(document.uri, panel.viewColumn);
      panel.dispose();
    } catch (error) {
      panel.webview.options = { enableCommandUris: ["baronglock.open"] };
      panel.webview.html = await messagePage(document.uri, error);
    }
  }
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function messagePage(uri, error) {
  const name = basename(toPath(uri));
  const data = await readFile(toPath(uri)).catch(() => null);
  const keyId = data && isLocked(data) ? keyIdOf(data) : null;
  const keyMissing = /Key [a-f0-9]{32} not found/i.test(error?.message ?? "");
  const retry = `command:baronglock.open?${encodeURIComponent(JSON.stringify([toFileUri(uri).toString()]))}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 24px; max-width: 640px; line-height: 1.5; }
  code, pre { font-family: var(--vscode-editor-font-family); }
  pre { background: var(--vscode-textCodeBlock-background); padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; }
</style>
</head>
<body>
<h2>${escapeHtml(name)} can't be opened</h2>
<p>${escapeHtml(error?.message ?? error)}</p>
${keyId ? `<p>Key ID: <code>${escapeHtml(keyId)}</code></p>` : ""}
${keyMissing ? `<p>This computer doesn't have the key for this file. Get the key file from whoever locked it, import it, then try again:</p>
<pre>npx baronglock key import my-key.json</pre>` : ""}
<p><a href="${escapeHtml(retry)}">Try again</a></p>
</body>
</html>`;
}

async function openCommand(uri) {
  if (typeof uri === "string") uri = vscode.Uri.parse(uri); // From the "Try again" link.
  if (!uri) {
    const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: LOCKED_FILTER });
    if (!picked) return;
    uri = picked[0];
  }
  if (uri.scheme !== "file" && uri.scheme !== SCHEME) {
    vscode.window.showErrorMessage("BarongLock can only open files stored on this computer.");
    return;
  }
  await openUnlocked(uri);
}

const showError = (error) => vscode.window.showErrorMessage(`BarongLock: ${error?.message ?? error}`);
const lockedExtension = () => vscode.workspace.getConfiguration("baronglock").get("lockedExtension", "baronglock");
const exists = (path) => stat(path).then(() => true, () => false);
const tabsShowing = (uri) => vscode.window.tabGroups.all
  .flatMap((group) => group.tabs)
  .filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString());

const isLockedByName = (uri) => uri.scheme === SCHEME || (uri.scheme === "file" && LOCKED_NAME.test(uri.path));

// Key or password? Asked once, even when several files are being locked.
async function chooseHow(label) {
  let method = vscode.workspace.getConfiguration("baronglock").get("lockMethod", "ask");
  if (method === "ask") {
    const picked = await vscode.window.showQuickPick([
      { label: "Key", method: "key", detail: "A new key is saved on this computer. To let others open it, share the key file." },
      { label: "Password", method: "password", detail: "Type the password to open it, on any computer. If you forget it, the file can't be opened." },
    ], { title: `Lock ${label} with`, ignoreFocusOut: true });
    method = picked?.method;
  }
  if (method !== "password") return method ? { method } : undefined;
  const password = await vscode.window.showInputBox({
    title: `New password for ${label}`,
    prompt: "A long passphrase is best. If you forget it, the file can't be opened.",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => [...value.normalize("NFC")].length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined,
  });
  if (password === undefined) return undefined;
  const repeat = await vscode.window.showInputBox({ title: `Repeat the password for ${label}`, password: true, ignoreFocusOut: true });
  if (repeat === undefined) return undefined;
  if (repeat !== password) throw new Error("The passwords don't match. Nothing was locked.");
  return { method, password };
}

// Explorer passes (clicked, allSelected). Tests and scripts may pass
// (source, target) and a third argument, { method: "key" } or { method: "password", password }.
async function lockCommand(uri, second, how) {
  let uris;
  if (Array.isArray(second) && second.length > 1) {
    uris = second;
  } else {
    uri ??= vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      const picked = await vscode.window.showOpenDialog({ canSelectMany: false, title: "Choose a file to lock" });
      if (!picked) return;
      uri = picked[0];
    }
    uris = [uri];
  }
  const target = second && !Array.isArray(second) ? second : undefined;
  const toLock = uris.filter((u) => {
    if (isLockedByName(u)) vscode.window.showInformationMessage(`${basename(u.path)} is already locked.`);
    return !isLockedByName(u);
  });
  if (!toLock.length) return;
  try {
    how ??= await chooseHow(toLock.length === 1 ? basename(toLock[0].path) : `${toLock.length} files`);
  } catch (error) {
    showError(error);
    return;
  }
  if (!how) return;
  for (const u of toLock) await lockOne(u, toLock.length === 1 ? target : undefined, how).catch(showError);
}

async function lockOne(uri, target, how) {
  const name = basename(uri.path);
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  let plaintext;
  if (uri.scheme === "untitled") {
    // A new, never-saved editor: ask where to save the locked file.
    plaintext = Buffer.from(doc?.getText() ?? "", "utf8");
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(homedir());
    target ??= await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.joinPath(folder, `${name}.${lockedExtension()}`),
      filters: LOCKED_FILTER,
      title: "Save as a locked file",
    });
  } else if (uri.scheme === "file") {
    if (doc?.isDirty) {
      const choice = await vscode.window.showWarningMessage(`${name} has unsaved changes.`, { modal: true }, "Save and Lock");
      if (choice !== "Save and Lock" || !(await doc.save())) return;
    }
    plaintext = await readFile(uri.fsPath); // The bytes on disk, exactly, whatever the encoding.
    if (isLocked(plaintext)) {
      vscode.window.showInformationMessage(`${name} is already locked.`);
      return;
    }
    target ??= vscode.Uri.file(lockedPath(uri.fsPath, lockedExtension()));
    if (await exists(target.fsPath)) {
      target = await vscode.window.showSaveDialog({
        defaultUri: target,
        filters: LOCKED_FILTER,
        title: `${basename(target.fsPath)} already exists. Choose another name`,
      });
    }
  } else {
    throw new Error("BarongLock can only lock files stored on this computer.");
  }
  if (!target) return;
  if (target.scheme !== "file") throw new Error("BarongLock can only save locked files on this computer.");

  const password = how.method === "password" ? how.password : undefined;
  const { keyId } = await lockToFile(plaintext, target.fsPath, { password });
  if (password) passwords.set(target.fsPath, password); // Opening it now won't ask again.
  if (uri.scheme === "untitled") {
    // The text now lives in the locked file: drop the unsaved editor and open the locked one.
    if (doc) {
      await vscode.window.showTextDocument(doc);
      await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    }
    await openUnlocked(target);
  }
  announce(uri, target, keyId);
}

// Not awaited: the lock is done, and the buttons are optional follow-ups.
// keyId is null for a password file.
function announce(source, target, keyId) {
  const fromFile = source.scheme === "file";
  const buttons = [
    ...(fromFile ? ["Open"] : []),
    ...(keyId ? ["Copy Key ID"] : []),
    ...(fromFile ? ["Move Original to Trash"] : []),
  ];
  const locked = `Locked ${basename(source.path)} to ${basename(target.fsPath)}`;
  vscode.window
    .showInformationMessage(
      keyId
        ? `${locked}. Key ID: ${keyId}. Back up your keys: without the key, the file can't be opened.`
        : `${locked} with a password. If you forget the password, the file can't be opened.`,
      ...buttons,
    )
    .then(async (choice) => {
      if (choice === "Open") await openUnlocked(target);
      if (choice === "Copy Key ID") await vscode.env.clipboard.writeText(keyId);
      if (choice === "Move Original to Trash") {
        await vscode.window.tabGroups.close(tabsShowing(source));
        await vscode.workspace.fs.delete(source, { useTrash: true });
      }
    })
    .then(undefined, showError);
}

export function activate(context) {
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(SCHEME, new LockedFileSystem(), {
      isCaseSensitive: process.platform === "linux",
    }),
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new LockedFileOpener(), {
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand("baronglock.open", openCommand),
    vscode.commands.registerCommand("baronglock.lockFile", lockCommand),
    vscode.workspace.onDidCloseTextDocument(forgetPasswordLater),
  );
}

export function deactivate() {}
