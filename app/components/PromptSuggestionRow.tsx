import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionRow = ({onPromptClick}) => {
    const prompt = [
        "Who is the director of Ethiopian Premier League?",
        "Who is the latest champion of the Ethiopian Premier League?",
        "When was the ethiopian premier league started?",
    ]
    return(
        <div className="prompt-suggestion-row">
            {PromptSuggestionRow.map((prompt, index)=> <PromptSuggestionButton 
            key={`suggestion-${index}`}
            text={prompt}
            onClick={onPromptClick(prompt)}
            
            />)}
        </div>
    )
}

export default PromptSuggestionRow