// A plain panel. Use it to group one section of a page, not for every item.
export function Card({ title, description, actions, children, className = "", padded = true, ...props }) {
  return (
    <section className={`card ${padded ? "card-padded" : ""} ${className}`} {...props}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-description">{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
