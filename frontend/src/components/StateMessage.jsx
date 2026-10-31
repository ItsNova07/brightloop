import { Button } from "./Button.jsx";

// The three "nothing to show yet" moments: loading, empty and error.
// Use it anywhere data is fetched so these look the same everywhere.
//
//   <StateMessage kind="loading" />
//   <StateMessage kind="empty" title="No customers yet" message="Add your first customer to start billing." action={<Button>Add customer</Button>} />
//   <StateMessage kind="error" message={error.message} onRetry={reload} />
export function StateMessage({ kind, title, message, action, onRetry }) {
  if (kind === "loading") {
    return (
      <div className="state state-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>{message || "Loading…"}</span>
      </div>
    );
  }

  const isError = kind === "error";
  return (
    <div className={`state ${isError ? "state-error" : "state-empty"}`} role={isError ? "alert" : undefined}>
      <p className="state-title">{title || (isError ? "This didn't load" : "Nothing here yet")}</p>
      {message && <p className="state-message">{message}</p>}
      {isError && onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
      {action}
    </div>
  );
}
