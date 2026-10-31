import { Card, PageHeader, StateMessage } from "../components";

// Stand-in for pages a teammate hasn't plugged in yet.
// To replace it: build your page in src/pages/, then swap it in App.jsx.
export function Placeholder({ title, description }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <StateMessage
          kind="empty"
          title="This page is being built"
          message="The menu, permissions and layout are ready. The content arrives once its screens are connected."
        />
      </Card>
    </>
  );
}

export function NotFound() {
  return (
    <Card>
      <StateMessage kind="empty" title="Page not found" message="Check the address, or pick a page from the menu." />
    </Card>
  );
}
