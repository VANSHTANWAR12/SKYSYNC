import { useState, useEffect, useRef } from "react";
import Header from "../components/Header";
import { sendMessageToChat } from "../services/chat";

function formatUtcTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function AssistantPage({ user, onLogout, onBack }) {
  const [utcTime, setUtcTime] = useState(() => formatUtcTime(new Date()));
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "SkySync pilot intelligence assistant online. Enter operational query regarding flight path deviations, traffic advisories, or weather holds.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  // UTC Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(formatUtcTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMsg = inputText.trim();
    setInputText("");
    setError("");
    setMessages((prev) => [...prev, { role: "pilot", text: userMsg }]);
    setLoading(true);

    try {
      const data = await sendMessageToChat(userMsg);
      setMessages((prev) => [...prev, { role: "assistant", text: data.response }]);
    } catch (err) {
      console.error(err);
      setError("Communication failure: Unable to reach Gemini flight assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <Header
        utcTime={utcTime}
        systemStatus="Operational"
        user={user}
        onLogout={onLogout}
      />

      <div className="assistant-page">
        <button className="assistant-back-button" onClick={onBack}>
          &larr; Back to Dashboard
        </button>

        <div className="chat-panel card">
          <div className="chat-page-header">
            <h2 className="panel-title">Pilot Chat Assistant</h2>
          </div>
          
          <div className="chat-body" style={{ padding: "0 24px 24px" }}>
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-message ${
                    msg.role === "assistant" ? "chat-message--assistant" : ""
                  }`}
                >
                  <span className="chat-message__role">
                    {msg.role === "pilot" ? "Crew / Pilot" : "SkySync Agent"}
                  </span>
                  <p className="chat-message__text">{msg.text}</p>
                </div>
              ))}
              
              {loading && (
                <div className="chat-message chat-message--assistant">
                  <span className="chat-message__role">SkySync Agent</span>
                  <p className="chat-message__text" style={{ opacity: 0.6 }}>
                    Analyzing telemetry and generating operational response...
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && <div className="chat-error">{error}</div>}

            <form className="chat-form" onSubmit={handleSend}>
              <textarea
                placeholder="Type flight operations query (e.g. 'Rerouting due to severe rain at Guwahati')..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button type="submit" disabled={loading || !inputText.trim()}>
                {loading ? "Transmitting..." : "Send Query"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssistantPage;
