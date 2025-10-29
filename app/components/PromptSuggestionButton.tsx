// components/PromptSuggestionButton.tsx
import React from "react";

const PromptSuggestionButton: React.FC<{
  text: string;
  onClick: (text: string) => void;
}> = ({ text, onClick }) => {
  return (
    <button
      className="prompt-suggestion-button"
      onClick={() => onClick(text)}
      type="button"
    >
      {text}
    </button>
  );
};

export default PromptSuggestionButton;
