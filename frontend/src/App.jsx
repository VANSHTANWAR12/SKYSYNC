import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./pages/dashboard.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { fetchCurrentUser, getAuthToken, removeAuthToken } from "./services/auth";

function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setInitializing(false);
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

  return <Dashboard user={user} onLogout={() => { removeAuthToken(); setUser(null); }} />;
}

export default App;
