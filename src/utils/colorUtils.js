export function getContrastColor(rgbaOrHex) {
  if (!rgbaOrHex) return '';
  
  let r, g, b, a = 1;
  
  if (rgbaOrHex.startsWith('rgba') || rgbaOrHex.startsWith('rgb')) {
    const parts = rgbaOrHex.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return '#ffffff';
    r = parseInt(parts[0], 10);
    g = parseInt(parts[1], 10);
    b = parseInt(parts[2], 10);
    if (parts.length > 3) a = parseFloat(parts[3]);
  } else if (rgbaOrHex.startsWith('#')) {
    const hex = rgbaOrHex.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      if (hex.length === 8) {
        a = parseInt(hex.substring(6, 8), 16) / 255;
      }
    }
  }

  // If very transparent, just return standard text color (assume dark mode/light mode based on body)
  if (a < 0.3) {
    return 'var(--text-strong)';
  }

  // Calculate relative luminance
  // Using simple YIQ formula for perceived brightness
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}
