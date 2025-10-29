// components/PromptSuggestionRow.tsx
import React from "react";
import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionRow: React.FC<{
  prompts: string[];
  onPromptClick: (text: string) => void;
}> = ({ prompts = [], onPromptClick }) => {
  return (
    <div className="prompt-suggestion-row" role="list">
      {prompts.map((p) => (
        <PromptSuggestionButton key={p} text={p} onClick={onPromptClick} />
      ))}
    </div>
  );
};

export default PromptSuggestionRow;
