import AppSelect from "./AppSelect";

export function DialogSelectField({
  label,
  value,
  onChange,
  children,
  id,
  className = "",
}) {
  const labelId = id ? `${id}-label` : undefined;

  return (
    <div className={`overlay-dialog-field${className ? ` ${className}` : ""}`}>
      <span id={labelId}>{label}</span>
      <AppSelect
        id={id}
        value={value}
        onChange={onChange}
        aria-labelledby={labelId}
        className="topbar-popover-select app-select"
      >
        {children}
      </AppSelect>
    </div>
  );
}

export default DialogSelectField;
