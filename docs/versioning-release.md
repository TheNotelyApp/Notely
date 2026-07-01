# Versioning and Release Guide

## 1. Versioning Policy

Notely uses build versions in this format:

- `major.minor.patch-commitHash`

Where:

- `major.minor.patch` are maintained in `app-version.json`
- `commitHash` is resolved from `master` (fallback: `origin/master`, then `HEAD`)

## 2. Source of Truth

- `app-version.json` stores major, minor, and patch values.
- `scripts/generate-app-version.cjs` generates `electron/app-version.generated.json`.

## 3. Operational Flow

1. Update `app-version.json` when planning a release.
2. Run `npm run version:generate` to refresh generated metadata.
3. Build/package using existing scripts (`build`, `pack:win`, `dist:win`).
4. Verify packaged app reports expected version string in **Help -> About Notely**.

## 4. Electron Builder Integration

Packaging injects generated values into Electron Builder metadata:

- `extraMetadata.version` receives `major.minor.patch-commitHash`
- `buildVersion` receives `major.minor.patch`

## 5. Release Checklist

- Version string matches expected `major.minor.patch-commitHash`.
- Signed artifacts are present when signing inputs are configured.
- About dialog and Help Center show matching build identity.
- Docs updates are committed with release changes.
