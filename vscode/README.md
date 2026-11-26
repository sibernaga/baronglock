# BarongLock for VS Code

**Open, edit and save BarongLock locked files (`.blj`, `.baronglock`) as normal text.**

The file on disk stays locked. VS Code shows the unlocked text, and every save locks it again the same way: with the file's own key, or with its password. Anyone who could open it before still can.

## How to use

- **Open:** click a `.blj` or `.baronglock` file. It opens as normal text. A password file asks for its password first.
- **Or:** right-click it in the Explorer and choose **Unlock and Edit**, or run **BarongLock: Unlock and Edit** from the Command Palette.
- **Save:** save as usual (`Ctrl+S` / `Cmd+S`). The file is locked again the same way.
- **File type:** locked files don't record their type. To get CSV or JSON colours, click the language name in the status bar and pick one.

## Lock a file

- **A file:** right-click it in the Explorer (or its editor tab) and choose **Lock File**. `notes.txt` becomes `notes.baronglock` next to it. Select several files to lock them all.
- **A new, unsaved editor:** run **BarongLock: Lock File** from the Command Palette, then choose where to save. The unsaved editor closes and the locked file opens.
- **Key or password:** you're asked which to use each time. Set `baronglock.lockMethod` to `key` or `password` to skip the question.
  - **Key:** a new key is saved on this computer. To let someone else open the file, they need a copy of the key. **Back up your keys folder:** without the key, the file can't be opened.
  - **Password:** you choose a password (at least 8 characters) and type it twice. Type it to open the file, on any computer. **If you forget it, the file can't be opened.** Use a long passphrase: anyone who has the file can keep guessing.
- **Unsaved changes** in a file are saved first. You're asked before that happens.
- **Shorter ending:** set `baronglock.lockedExtension` to `blj` to get `notes.blj`.
- **Never overwrites:** if the name is taken, you're asked for another one.
- **After locking**, a message has buttons to open the locked file, copy its Key ID (key files only), or move the original to the Trash. The original is kept unless you choose that.

## Passwords

- A password you type is kept in memory while the file is open, so saving doesn't ask again. It is forgotten a moment after the file closes. It is never written to disk.
- After a wrong password, you can try again a few times.
- To open password files without typing, start VS Code with the `BARONGLOCK_PASSWORD` environment variable set. Only do this on a computer you trust: any program started from that environment can read it.

## Before you start

- Keys live in the same key store the [BarongLock CLI](https://github.com/sibernaga/baronglock#readme) uses: `~/.baronglock/keys`, or `BARONGLOCK_KEY_DIR`. Files locked here open with the CLI, and the other way round.
- To open a key file locked on another computer, import its key first: `npx baronglock key import my-key.json`.
- If the key is missing, the file shows a message with its Key ID instead.

## Privacy: where unlocked text can end up

The file on disk is never unlocked, and no unlocked temp file is written. Our automated test with VS Code 1.148 found no unlocked text in VS Code's own data folder, either after saving (Local History) or a few seconds after an unsaved edit (backups). That is a short test, not a guarantee:

- **Unsaved changes** may still be backed up later, for example when VS Code closes with unsaved edits. Save before closing, or set `"files.hotExit": "off"`.
- **Other extensions** (AI assistants, linters, sync tools) can read the open text like any other open file.
- **Copy, Save As and the clipboard** put the unlocked text somewhere else, unlocked.
- **New, unsaved editors:** VS Code can back up unsaved Untitled text to its data folder while you type. Lock it soon, or set `"files.hotExit": "off"`.
- **Move Original to Trash** keeps the plain file in the Trash until you empty it.

## Limits

- Files on this computer only. Remote, WSL and virtual workspaces are not supported yet.
- The whole file is unlocked in memory. Avoid very large files.
- Password files need BarongLock 0.3 or newer. Older versions can't open them.
- BarongLock is an early version and has not had an independent security review.

## Development

```sh
npm install
npm test             # unit tests, plain Node
npm run test:vscode  # runs the extension in a separate, downloaded copy of VS Code
npm run package      # builds baronglock-vscode-<version>.vsix
```
