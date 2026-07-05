#!/usr/bin/env bash
set -e

echo "Running CI checks..."
if ! npm run ci:check; then
  echo "CI checks failed. Aborting release."
  exit 1
fi

# Read current version from app-version.json
MAJOR=$(grep -o '"major": [0-9]*' app-version.json | awk '{print $2}')
MINOR=$(grep -o '"minor": [0-9]*' app-version.json | awk '{print $2}')
PATCH=$(grep -o '"patch": [0-9]*' app-version.json | awk '{print $2}')

CURRENT_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEXT_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEXT_PATCH}"

echo ""
echo "Current version: ${CURRENT_VERSION}"
echo "New version: ${NEW_VERSION}"
echo ""

read -p "Ready to release v${NEW_VERSION}? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Release aborted by user."
    exit 0
fi

# 1. Update app-version.json
sed -i -E "s/\"patch\": [0-9]+/\"patch\": ${NEXT_PATCH}/" app-version.json
echo "Updated app-version.json"

# 2. Update package.json
sed -i -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"${NEW_VERSION}\"/" package.json
echo "Updated package.json"

# 3. Git Add
git add .

# 4. Git Commit
git commit -m "Release v${NEW_VERSION}"

# 5. Git Tag
TAG_NAME="v${NEW_VERSION}"
git tag "${TAG_NAME}"

# 6. Git Push
echo "Pushing commit and tags to origin..."
git push origin master
git push origin "${TAG_NAME}"

echo ""
echo "Successfully released and pushed ${TAG_NAME}!"

