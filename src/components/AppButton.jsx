import { forwardRef } from "react";

export const AppButton = forwardRef(function AppButton(
  {
    variant = "small",
    danger = false,
    iconOnly = false,
    className = "",
    type = "button",
    children,
    title,
    ...rest
  },
  ref,
) {
  let baseClass = "small-button";
  if (variant === "primary") {
    baseClass = "primary-button";
  } else if (variant === "secondary") {
    baseClass = "secondary-button small-button";
  } else if (variant === "ghost" || variant === "text") {
    baseClass = "text-button ghost-button";
  } else if (variant === "danger") {
    baseClass = "danger-button small-button danger";
  }

  const isDanger = danger || variant === "danger";
  const classes = [
    baseClass,
    isDanger ? "danger" : "",
    iconOnly ? "icon-only" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} type={type} className={classes} data-tooltip={title} {...rest}>
      {children}
    </button>
  );
});

export default AppButton;
