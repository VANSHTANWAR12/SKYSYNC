import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./pages/dashboard.jsx";
import AssistantPage from "./pages/AssistantPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { fetchCurrentUser, getAuthToken, removeAuthToken } from "./services/auth";

function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(() => !!getAuthToken());
  const [activePage, setActivePage] = useState("dashboard");

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    fetchCurrentUser()
      .then((currentUser) => setUser(currentUser))
      .catch(() => {
        removeAuthToken();
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  if (initializing) {
    return <div className="app-loading">Starting SkySync...</div>;
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
  };

  if (activePage === "assistant") {
    return (
      <AssistantPage
        user={user}
        onLogout={handleLogout}
        onBack={() => setActivePage("dashboard")}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onOpenAssistant={() => setActivePage("assistant")}
    />
  );
}

export default App;