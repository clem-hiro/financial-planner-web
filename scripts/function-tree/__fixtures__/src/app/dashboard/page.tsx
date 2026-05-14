import { ServerView } from "../../features/ServerView.tsx";
import { ClientView } from "../../features/ClientView.tsx";

export default function DashboardPage() {
  return (
    <main>
      <ServerView amount={1234} />
      <ClientView label="hello" />
    </main>
  );
}
