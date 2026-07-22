import React from "react";

export function PageContainer({ children, className = "", ...rest }) {
  return (
    <div className={`notely-page-container ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, className = "", ...rest }) {
  return (
    <header className={`notely-page-header ${className}`.trim()} {...rest}>
      <div className="notely-page-title-group">
        {title && <h1 className="notely-page-title">{title}</h1>}
        {description && <p className="notely-page-description">{description}</p>}
      </div>
      {actions && <div className="notely-page-actions">{actions}</div>}
    </header>
  );
}

export function PageContent({ children, className = "", ...rest }) {
  return (
    <main className={`notely-page-content ${className}`.trim()} {...rest}>
      {children}
    </main>
  );
}

export default PageContainer;
