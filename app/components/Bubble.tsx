// components/Bubble.tsx
import React from "react";

type Message = {
  id?: string;
  content: string;
  role: "user" | "assistant";
};

const Bubble: React.FC<{ message: Message }> = ({ message }) => {
  const { content, role } = message;
  return <div className={`${role} bubble`}>{content}</div>;
};

export default Bubble;
