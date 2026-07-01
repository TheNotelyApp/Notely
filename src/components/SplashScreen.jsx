import notelyMark from "../assets/branding/notely-mark.png";

export function SplashScreen({ visible, appInfo, progress = 0, phase = "Loading" }) {
  if (!visible) return null;

  const appName = String(appInfo?.appName || "Notely");
  const version = String(appInfo?.version || "0.0.0");
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Application loading">
      <div className="splash-card">
        <img className="splash-brand-mark" src={notelyMark} alt="Notely logo" />
        <h1>{appName}</h1>
        <p>{phase}...</p>
        <div className="splash-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress} aria-label="Application loading progress">
          <div className="splash-progress-fill" style={{ width: `${safeProgress}%` }} />
        </div>
        <p className="splash-percent">{safeProgress}%</p>
        <p className="splash-version">{version}</p>
      </div>
    </div>
  );
}
