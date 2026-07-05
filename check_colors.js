const fs = require('fs');

const css = fs.readFileSync('src/styles.css', 'utf-8');

// A simple regex to find rules: .class-name { ... color: #xxx ... }
const classBlocks = [];
let match;
const ruleRegex = /([^{}]+)\{([^}]+)\}/g;

while ((match = ruleRegex.exec(css)) !== null) {
  const selector = match[1].trim();
  const body = match[2];
  
  if (selector.startsWith(':root[data-theme="dark"]')) {
    continue; // Ignore existing dark overrides
  }

  // Look for color: #...
  const colorMatch = body.match(/color\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
  if (colorMatch) {
    const color = colorMatch[1];
    classBlocks.push({ selector, color });
  }
}

const darkOverridesStr = css.match(/:root\[data-theme="dark"\]\s*[^{]*\{[^}]*\}/g) || [];
const existingDarkSelectorsWithColor = new Set();
for (const override of darkOverridesStr) {
  if (override.includes('color:')) {
    const m = override.match(/:root\[data-theme="dark"\]\s*([^{]+)\{/);
    if (m) {
      const selectors = m[1].split(',').map(s => s.trim());
      selectors.forEach(s => existingDarkSelectorsWithColor.add(s));
    }
  }
}

const missing = new Set();
for (const block of classBlocks) {
  // Split multiple selectors
  const selectors = block.selector.split(',').map(s => s.trim());
  for (let s of selectors) {
    // Only care about simple class selectors for this automatic fix
    if (s.startsWith('.') || s.startsWith('#') || s.match(/^[a-z]/i)) {
      if (!existingDarkSelectorsWithColor.has(s) && !existingDarkSelectorsWithColor.has(s.replace(/::?(?:hover|focus|active|visited|before|after)/g, ''))) {
         missing.add(:root[data-theme="dark"]  { color: var(--text-strong) !important; });
      }
    }
  }
}

fs.writeFileSync('missing-dark-colors.css', Array.from(missing).join('\n'));
console.log('Found ' + missing.size + ' missing color overrides.');
