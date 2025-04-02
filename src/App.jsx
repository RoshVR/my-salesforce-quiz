import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase.from("preguntas_examen").select("*");
      if (error) console.error("Error fetching questions:", error);
      else setQuestions(data);
    };

    fetchQuestions();
  }, []);

  const handleOptionSelect = (index) => {
    setSelectedOptions((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const checkAnswer = () => {
    const correctAnswers = questions[currentQuestion]?.correct_answers;
    const isCorrect =
      correctAnswers.length === selectedOptions.length &&
      correctAnswers.every((val) => selectedOptions.includes(val));
    
    alert(isCorrect ? "✅ Correct!" : "❌ Incorrect!");
    setSelectedOptions([]);
    setCurrentQuestion((prev) => (prev + 1) % questions.length);
  };

  if (questions.length === 0) return <p>Loading questions...</p>;

  return (
    <div className="container">
      <h1>Salesforce Admin Quiz</h1>
      <h2>{questions[currentQuestion].question}</h2>
      <ul>
        {questions[currentQuestion].options.map((option, index) => (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={selectedOptions.includes(index)}
                onChange={() => handleOptionSelect(index)}
              />
              {option}
            </label>
          </li>
        ))}
      </ul>
      <button onClick={checkAnswer}>Submit</button>
    </div>
  );
}

export default App;
