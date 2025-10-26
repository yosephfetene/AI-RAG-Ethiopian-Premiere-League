"use client"
import Image from "next/image"
import epl from "./assets/epl.jpg"
import { useState } from "react"


const Home = () =>{


    // show starter paragraph by default when there are no messages
    const noMessages = true

    // simple local input state and handlers (previously used `useChat`)
    const [input, setInput] = useState("")
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInput(e.target.value)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: hook this up to your chat/AI backend. For now just log.
        console.log("Question submitted:", input)
        setInput("")
    }
    return(
        <main>
            <Image src={epl} width={250} height={250} alt="EPL Logo" />
            <section className={noMessages ? "" : "populated"}>
                {noMessages ?(
                    <>
                    <p className="starter-text"> The late to news place where you can ask about any Ethiopian Premier League quessstions, up to date and ready to answer.
                    </p>
                    <br/>
                    {/*<PromptSuggestionRow/>*/}
                    </>
                ) : (
                    <>
                    </>
                )}
            </section>
                            <form onSubmit={handleSubmit}>
                    <input
                        className="question-box"
                        onChange={handleInputChange}
                        value={input}
                        placeholder="Ask me something?"
                    />
                    <input type="submit" />
                </form>
        </main>
    )
}

export default Home