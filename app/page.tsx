// app/page.tsx
"use client";

import Image from "next/image";
import epl from "./assets/epl.jpg";
import { useState } from "react";
import Bubble from "./components/Bubble";
import PromptSuggestionRow from "./components/PromptSuggestionRow";
import LoadingBubble from "./components/LoadingBubble";

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
};

const starterPrompts = [
  "Who won the last Ethiopian Premier League season?",
  "Top goal scorers this season?",
  "Recent match results for Saint George FC",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const noMessages = messages.length === 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInput(e.target.value);

  const append = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: "user",
    };
    append(userMsg);
    setInput("");
    setIsLoading(true);

    try {
      // TODO: replace '/api/chat' with your route path if different
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        content: data.answer ?? "Sorry, no answer returned.",
        role: "assistant",
      };
      append(assistantMsg);
    } catch (err) {
      console.error("Chat error", err);
      append({
        id: crypto.randomUUID(),
        content: "There was an error getting a response. Check console.",
        role: "assistant",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrompt = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <main>
      <Image src={epl} width={250} height={250} alt="EPL Logo" />
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p className="starter-text">
              The latest news place where you can ask about any Ethiopian
              Premier League questions — up to date and ready to answer.
            </p>
            <br />
            <PromptSuggestionRow
              prompts={starterPrompts}
              onPromptClick={handlePrompt}
            />
          </>
        ) : (
          <>
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>

      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Ask me something?"
          aria-label="Ask a question"
        />
        <input type="submit" />
      </form>
    </main>
  );
}
