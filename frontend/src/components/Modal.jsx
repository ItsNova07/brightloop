import { useCallback, useEffect, useRef, useState } from "react";

const EXIT_TIME = 160;

// A dialog for short forms (add customer, record payment…).
// Uses the browser's <dialog>, which keeps keyboard focus inside while open.
//
// It animates in, and animates out when closed with the ✕, Escape, a click
// on the dark backdrop, or any button marked data-close:
//   <Button variant="secondary" data-close>Cancel</Button>
export function Modal({ open, title, onClose, children, footer }) {
  const ref = useRef(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const animatedClose = useCallback(() => {
    if (closing) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, EXIT_TIME);
  }, [closing, onClose]);

  function handleClick(event) {
    if (event.target === ref.current || event.target.closest("[data-close]")) animatedClose();
  }

  return (
    <dialog
      ref={ref}
      className={`modal ${closing ? "modal-closing" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        animatedClose();
      }}
      onClick={handleClick}
    >
      <div className="modal-body">
        <header className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" data-close aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
