import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, BookOpen } from 'lucide-react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the Academic Research Assistant. I specialize in deep Computer Science research. Please provide a seminal paper (Title/Authors, DOI, or URL) or ask me a question.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Initialize session explicitly if needed, but the backend handles auto-creation 
    // if session_id is omitted. We will let the first message establish the flow.
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Add empty assistant message that will be populated via SSE
    const botMessageId = 'bot-' + Date.now();
    setMessages(prev => [...prev, { id: botMessageId, role: 'assistant', content: '' }]);

    try {
      // For SSE with POST, native EventSource doesn't support POST with bodies directly well across all browsers.
      // We are using a robust fetch approach to read the stream.
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionId
        })
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });

          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, eolIndex).trim();
            buffer = buffer.slice(eolIndex + 1);

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.session_id && data.session_id !== sessionId) {
                  setSessionId(data.session_id);
                }

                setMessages(prev => prev.map(msg => {
                  if (msg.id === botMessageId) {
                    return { ...msg, content: data.text };
                  }
                  return msg;
                }));
              } catch (err) {
                console.error('Error parsing SSE chunk', err, line);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === botMessageId
          ? { ...msg, content: 'Error connecting to the Academic Research Agent. Ensure the backend is running.' }
          : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-icon">
          <BookOpen color="white" size={24} />
        </div>
        <div>
          <h1>Academic Research Agent</h1>
          <p>Computer Science Specialization</p>
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-wrapper ${msg.role}`}>
            <div className="avatar">
              {msg.role === 'user' ? <User size={20} color="#cbd5e1" /> : <Bot size={22} color="white" />}
            </div>
            <div className="message-bubble">
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-wrapper assistant">
            <div className="avatar">
              <Bot size={22} color="white" />
            </div>
            <div className="message-bubble typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <div className="chat-input-area">
        <form className="input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or provide a seminal paper..."
            disabled={isTyping}
          />
          <button type="submit" className="send-button" disabled={!input.trim() || isTyping}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
