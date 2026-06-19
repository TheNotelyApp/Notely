export function MarkdownValidationBanner({ issues = [], status = "idle" }) {

  if (status === "checking") {
    return <div className="validation-banner checking">Checking markdown...</div>;
  }

  if (status === "error") {
    return <div className="validation-banner error">Validation service unavailable.</div>;
  }

  if (!issues.length) {
    return <div className="validation-banner ok">No markdown issues detected.</div>;
  }

  const firstIssue = issues[0];
  const remaining = issues.length - 1;

  return (
    <div className="validation-banner warning">
      <span>
        Line {firstIssue.line}:{firstIssue.column || 1} - {firstIssue.message}
      </span>
      {remaining > 0 ? <span>+{remaining} more</span> : null}
    </div>
  );
}
