"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "model";
  text: string;
}

interface AriaChatProps {
  wardId: string | null;
}

export default function AriaChat({ wardId }: AriaChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const newMessages = [...messages, { role: "user" as const, text }];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/aria/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          wardId: wardId === "all" ? null : wardId,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.text }))
        }),
      });

      if (!res.ok) throw new Error("Failed to connect to Aria");

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "model", text: "Sorry, I am having trouble connecting to the database right now. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-brand-navy text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 hover:bg-on-secondary-fixed transition-colors"
          >
            <div className="absolute inset-0 rounded-full border-2 border-brand-navy/30 animate-ping"></div>
            <span className="material-symbols-outlined text-xl relative z-10">auto_awesome</span>
            <span className="font-title-lg font-bold relative z-10">Ask Aria</span>
          </motion.button>
        )}

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[500px] bg-brand-off-white rounded-2xl shadow-2xl border border-surface-container-highest flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-brand-navy p-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-title-lg font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-saffron">auto_awesome</span>
                  Aria
                </h3>
                <p className="text-xs opacity-80 mt-0.5">Constituency AI Assistant</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:bg-white/20 p-1 rounded transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4 fade-in visible">
                  <div className="w-16 h-16 bg-brand-saffron/10 text-brand-saffron rounded-full flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-3xl">smart_toy</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    I have real-time access to the constituency data. How can I help you allocate priorities today?
                  </p>
                  
                  <div className="flex flex-col gap-2 w-full mt-4">
                    {["What's most urgent this week?", "Which issues are chronic?", "Compare school vs road priorities"].map((prompt, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(prompt)}
                        className="text-left text-xs bg-white border border-brand-navy/20 text-brand-navy px-3 py-2 rounded-lg hover:bg-brand-navy hover:text-white transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div 
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                        msg.role === "user" 
                          ? "bg-brand-saffron text-white rounded-br-none" 
                          : "bg-white text-brand-navy shadow-sm border border-surface-container rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-brand-navy shadow-sm border border-surface-container rounded-2xl rounded-bl-none px-4 py-3 flex gap-1 items-center">
                    <div className="w-2 h-2 bg-brand-navy rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-brand-navy rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-brand-navy rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-surface-container-highest shrink-0">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(inputValue);
                }} 
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask Aria..."
                  className="flex-1 bg-surface-container-low border border-outline-variant rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-navy"
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !inputValue.trim()}
                  className="w-10 h-10 rounded-full bg-brand-saffron text-white flex items-center justify-center shadow-sm disabled:opacity-50 transition"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
