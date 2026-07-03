# FAQ

## What is a workspace in Notely?

A workspace is the folder you open with **File -> Open Workspace**. It holds your notes, files, and Notely's support data for that set of notes.

## Where does Notely store my data?

Your notes stay in the workspace folder you choose.

Notely also keeps a `.notes-app/` folder there for note history and other support data.

Some app-wide preferences, like recent workspaces and theme choice, are stored separately by the app.

## Does Notely work offline?

Yes for core note-taking features.

You can create notes, edit them, preview them, manage media, review history, use the terminal, and export workspaces offline.

## Which features require internet?

AI features need internet access and a working account or key for the service you chose.

Device-to-device sync usually only needs both devices to reach each other on the same network.

## What is `.notes-app`?

`.notes-app` is Notely's own support folder for things like note history, image notes, and other behind-the-scenes app data.

## Should `.notes-app` be committed to Git?

Usually no.

If your workspace is a Git folder, Notely can help keep `.notes-app/` out of version control so private app files do not end up in project history.

## Can I restore deleted or changed notes?

Yes.

Use **File -> Versions** to inspect and restore earlier versions of a note. Notes and folders moved out of the main workspace flow are also handled by Notely's removed-folder flow.

## How do I reopen a workspace quickly?

Use **File -> Open Recent** or the command palette entry for recent workspaces.

## Does Notely have a plugin system?

Not currently. The app does not expose a user plugin or extension mechanism.

## What happens if I configure AI?

AI requests only run when you use an AI feature. They go to the service you set up in **AI -> AI Settings**.

The app keeps its AI working data on your device unless you explicitly move or export it.

## What is the easiest way to learn shortcuts?

Open **Help -> Keyboard Shortcuts** (`Ctrl/Cmd + /`). The in-app guide lists current global, editor, landing, and preview shortcuts.