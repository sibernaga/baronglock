// Runs inside the VS Code test window. run.mjs prepares the files, then checks
// the saved file on disk once this finishes.
const assert = require("node:assert/strict");
const { readdir, readFile } = require("node:fs/promises");
const path = require("node:path");
const vscode = require("vscode");

const dir = process.env.BARONGLOCK_TEST_DIR;
const userData = process.env.BARONGLOCK_TEST_USER_DATA;
const fileUri = (name) => vscode.Uri.file(path.join(dir, name));
const lockedUri = (name) => fileUri(name).with({ scheme: "baronglock" });
const allTabs = () => vscode.window.tabGroups.all.flatMap((group) => group.tabs);
const isCustomTab = (tab) => tab.input instanceof vscode.TabInputCustom;
const closeAll = () => vscode.commands.executeCommand("workbench.action.closeAllEditors");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, what, ms = 10000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (check()) return;
  throw new Error(`Timed out waiting for ${what}`);
}
const unlockedEditorIsActive = () => vscode.window.activeTextEditor?.document.uri.scheme === "baronglock";

async function filesContaining(root, text) {
  const found = [];
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    if ((await readFile(file).catch(() => Buffer.alloc(0))).includes(text)) found.push(path.relative(root, file));
  }
  return found;
}

const steps = [
  ["opens a locked file as text", async () => {
    const doc = await vscode.workspace.openTextDocument(lockedUri("notes.blj"));
    assert.equal(doc.getText(), "hello,world\n");
  }],
  ["saving locks the new text again", async () => {
    const doc = await vscode.workspace.openTextDocument(lockedUri("notes.blj"));
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((edit) => edit.insert(doc.positionAt(doc.getText().length), "more\n"));
    assert.ok(await doc.save(), "save returned false");
    assert.equal(doc.isDirty, false);
  }],
  ["opening a .blj file shows the unlocked text editor", async () => {
    await closeAll();
    await vscode.commands.executeCommand("vscode.open", fileUri("notes.blj"));
    await waitFor(unlockedEditorIsActive, "the unlocked editor");
    assert.equal(vscode.window.activeTextEditor.document.getText(), "hello,world\nmore\n");
    await waitFor(() => !allTabs().some(isCustomTab), "the BarongLock tab to close");
  }],
  ["a file whose key is missing shows a message instead", async () => {
    await closeAll();
    await vscode.commands.executeCommand("vscode.open", fileUri("nokey.blj"));
    await waitFor(() => allTabs().some(isCustomTab), "the message tab");
    await sleep(500);
    assert.ok(!unlockedEditorIsActive(), "an unlocked editor opened without a key");
  }],
  ["the Unlock and Edit command opens the file", async () => {
    await closeAll();
    await vscode.commands.executeCommand("baronglock.open", fileUri("notes.blj"));
    await waitFor(unlockedEditorIsActive, "the unlocked editor");
  }],
  ["Lock File locks a plain file next to it", async () => {
    await vscode.commands.executeCommand("baronglock.lockFile", fileUri("plain.txt"), undefined, { method: "key" });
    const doc = await vscode.workspace.openTextDocument(lockedUri("plain.baronglock"));
    assert.equal(doc.getText(), "plain text\n");
  }],
  ["Lock File locks every selected file", async () => {
    const selected = [fileUri("a.csv"), fileUri("b.json")];
    await vscode.commands.executeCommand("baronglock.lockFile", selected[0], selected, { method: "key" });
    for (const [name, text] of [["a.baronglock", "a,b\n"], ["b.baronglock", "{}\n"]]) {
      assert.equal((await vscode.workspace.openTextDocument(lockedUri(name))).getText(), text);
    }
  }],
  ["Lock File skips a file that is already locked", async () => {
    const before = (await readdir(dir)).sort();
    await vscode.commands.executeCommand("baronglock.lockFile", fileUri("notes.blj"));
    assert.deepEqual((await readdir(dir)).sort(), before);
  }],
  ["Lock File saves a new, unsaved editor as a locked file", async () => {
    await closeAll();
    const doc = await vscode.workspace.openTextDocument({ content: "new secret\n" });
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand("baronglock.lockFile", doc.uri, fileUri("new.blj"), { method: "key" });
    await waitFor(unlockedEditorIsActive, "the new locked file to open");
    assert.equal(vscode.window.activeTextEditor.document.getText(), "new secret\n");
    assert.ok(!allTabs().some((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === "untitled"),
      "the unsaved editor is still open");
  }],
  ["Lock File locks with a password", async () => {
    await closeAll();
    await vscode.commands.executeCommand("baronglock.lockFile", fileUri("pw.txt"), undefined,
      { method: "password", password: process.env.BARONGLOCK_TEST_PASSWORD });
    const doc = await vscode.workspace.openTextDocument(lockedUri("pw.baronglock"));
    assert.equal(doc.getText(), "pw text\n");
  }],
  ["a password file still saves after its language is changed", async () => {
    let doc = await vscode.workspace.openTextDocument(lockedUri("pw.baronglock"));
    await vscode.window.showTextDocument(doc);
    doc = await vscode.languages.setTextDocumentLanguage(doc, "markdown");
    await sleep(2500); // Longer than the extension waits before forgetting a password.
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((edit) => edit.insert(doc.positionAt(doc.getText().length), "more\n"));
    assert.ok(await doc.save(), "save returned false");
  }],
  ["opens a password file with BARONGLOCK_PASSWORD, and saves it", async () => {
    await closeAll();
    process.env.BARONGLOCK_PASSWORD = process.env.BARONGLOCK_TEST_SECRET_PASSWORD;
    try {
      await vscode.commands.executeCommand("vscode.open", fileUri("secret.blj"));
      await waitFor(unlockedEditorIsActive, "the unlocked editor");
      const editor = vscode.window.activeTextEditor;
      assert.equal(editor.document.getText(), "top secret\n");
      await editor.edit((edit) => edit.insert(editor.document.positionAt(editor.document.getText().length), "edited\n"));
      assert.ok(await editor.document.save(), "save returned false");
    } finally {
      delete process.env.BARONGLOCK_PASSWORD;
    }
  }],
  ["where VS Code keeps unsaved text (report only)", async () => {
    const editor = vscode.window.activeTextEditor;
    await editor.edit((edit) => edit.insert(editor.document.positionAt(0), "UNSAVED-MARKER\n"));
    await sleep(3000); // VS Code backs up unsaved changes after a short pause.
    const copies = await filesContaining(userData, "UNSAVED-MARKER");
    console.log(copies.length
      ? `note - unsaved plaintext found in VS Code's data folder:\n  ${copies.join("\n  ")}`
      : "note - no unsaved plaintext found in VS Code's data folder");
    await vscode.commands.executeCommand("workbench.action.files.revert");
  }],
];

exports.run = async () => {
  await vscode.extensions.getExtension("sibernaga.baronglock-vscode").activate();
  const failed = [];
  for (const [name, step] of steps) {
    try {
      // A password box that shouldn't appear would wait forever; fail the step instead.
      await Promise.race([step(), sleep(30000).then(() => { throw new Error("Step took over 30 s (stuck on a prompt?)"); })]);
      console.log(`ok - ${name}`);
    } catch (error) {
      failed.push(name);
      console.log(`not ok - ${name}\n  ${error.stack}`);
    }
  }
  await closeAll();
  if (failed.length) throw new Error(`${failed.length} VS Code check(s) failed: ${failed.join("; ")}`);
};
