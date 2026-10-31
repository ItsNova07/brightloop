import { useId } from "react";

// One labelled input with an optional hint and error message.
//
//   <FormField label="Email" type="email" value={email} onChange={...} error={errors.email} />
//   <FormField as="select" label="Plan" options={[{ value: "pro", label: "Pro" }]} ... />
//   <FormField as="textarea" label="Notes" ... />
//   <FormField label="Password" trailing={<button>Show</button>} ... />   (sits inside the input, on the right)
export function FormField({ label, hint, error, as = "input", options = [], trailing, className = "", ...inputProps }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    className: "field-input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    ...inputProps,
  };

  return (
    <div className={`field ${error ? "field-has-error" : ""} ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
        {inputProps.required && <span className="field-required" aria-hidden="true"> *</span>}
      </label>

      {as === "select" ? (
        <select {...shared}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : as === "textarea" ? (
        <textarea rows={3} {...shared} />
      ) : trailing ? (
        <div className="field-with-trailing">
          <input {...shared} />
          {trailing}
        </div>
      ) : (
        <input {...shared} />
      )}

      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
