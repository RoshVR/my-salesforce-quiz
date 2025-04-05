import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [examSessionId, setExamSessionId] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [answerDetails, setAnswerDetails] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 10;

  useEffect(() => {
    setExamSessionId(uuidv4());
    setStartTime(Date.now());

    const fetchQuestions = async () => {
      const { data, error } = await supabase.from("preguntas_examen").select("*");
      if (error) console.error("Error fetching questions:", error);
      else setQuestions(data);
    };

    fetchQuestions();
  }, []);

  useEffect(() => {
    if (showResults) return;

    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [showResults]);

  useEffect(() => {
    const fetchAnswerDetails = async () => {
      if (showResults) {
        const { data, error } = await supabase
          .from("respuestas_examen")
          .select("*, preguntas_examen(*)")
          .eq("exam_session_id", examSessionId);

        if (error) console.error("Error fetching answer details:", error);
        else setAnswerDetails(data);
      }
    };

    fetchAnswerDetails();
  }, [showResults]);

  const handleOptionSelect = (index, isMultipleChoice) => {
    if (isMultipleChoice) {
      setSelectedOptions((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    } else {
      setSelectedOptions([index]);
    }
  };

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const checkAnswer = async () => {
    const startIndex = currentPage * questionsPerPage;
    const currentQ = questions[startIndex + currentQuestion];
    const correctAnswers = currentQ.correct_answers || [];

    const isCorrect =
      correctAnswers.length === selectedOptions.length &&
      correctAnswers.every((val) => selectedOptions.includes(val));

    if (isCorrect) setScore((prev) => prev + 1);

    await submitAnswer(currentQ.id, selectedOptions, isCorrect, examSessionId);

    const nextQuestion = currentQuestion + 1;

    if (nextQuestion < questions.length) {
      setCurrentQuestion(nextQuestion);
      setSelectedOptions([]);
    } else {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      await saveExamResult(examSessionId, score, questions.length, totalTime);
      setEndTime(Date.now());
      setShowResults(true);
    }
  };

  const submitAnswer = async (questionId, userAnswer, isCorrect, sessionId) => {
    const { error } = await supabase.from("respuestas_examen").insert([
      {
        exam_session_id: sessionId,
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
      },
    ]);

    if (error) console.error("Error saving answer:", error);
  };

  const saveExamResult = async (sessionId, score, totalQuestions, totalTime) => {
    const { error } = await supabase.from("resultados_examen").insert([
      {
        exam_session_id: sessionId,
        score,
        total_questions: totalQuestions,
        time_seconds: totalTime,
      },
    ]);
    if (error) console.error("Error saving exam result:", error);
  };

  const goToNextPage = () => {
    if ((currentPage + 1) * questionsPerPage < questions.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (questions.length === 0) return <p>Loading questions...</p>;

  if (showResults) {
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    return (
      <div className="container">
        <h1>¡Examen finalizado!</h1>
        <p><strong>Puntaje:</strong> {score} de {questions.length}</p>
        <p><strong>Tiempo total:</strong> {formatTime(Math.floor(totalTime))}</p>

        <h2>Detalles de tus respuestas:</h2>
        {answerDetails.length === 0 ? (
          <p>Cargando respuestas...</p>
        ) : (
          <ul>
            {answerDetails.map((item, idx) => {
              const question = item.preguntas_examen;
              const isCorrect = item.is_correct;
              const userAnswer = item.user_answer?.map(i => question?.options?.[i]).join(", ");
              const correctAnswer = question?.correct_answers?.map(i => question?.options?.[i]).join(", ");
              return (
                <li key={idx}>
                  <h4>Pregunta {idx + 1}: {question?.question || "Pregunta no encontrada"}</h4>
                  <p><strong>Tu respuesta:</strong> {userAnswer || "Ninguna"}</p>
                  <p><strong>Correcta:</strong> {correctAnswer || "Ninguna"}</p>
                  <p style={{ color: isCorrect ? "green" : "red" }}>
                    {isCorrect ? "✅ Correcto" : "❌ Incorrecto"}
                  </p>
                  {!isCorrect && question?.explanation && (
                    <p><strong>Explicación:</strong> {question.explanation}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const startIndex = currentPage * questionsPerPage;
  const currentQ = questions[startIndex + currentQuestion];

  return (
    <div className="container">
      <div style={{ textAlign: "right", marginBottom: "10px" }}>
        <strong>Tiempo transcurrido: {formatTime(elapsedTime)}</strong>
      </div>
      <h1>Salesforce Admin Quiz</h1>
      <h3>Página {currentPage + 1} de {Math.ceil(questions.length / questionsPerPage)}</h3>
      <h2>{currentQ?.pregunta || currentQ?.question}</h2>
      <ul>
        {currentQ?.options.map((option, index) => {
          const isMultipleChoice = currentQ?.correct_answers.length > 1;

          return (
            <li key={index}>
              <label>
                <input
                  type={isMultipleChoice ? "checkbox" : "radio"}
                  name={`question-${currentQuestion}`}
                  checked={selectedOptions.includes(index)}
                  onChange={() => handleOptionSelect(index, isMultipleChoice)}
                />
                {option}
              </label>
            </li>
          );
        })}
      </ul>
      <div>
        <button onClick={goToPreviousPage} disabled={currentPage === 0}>
          Anterior
        </button>
        <button onClick={goToNextPage} disabled={(currentPage + 1) * questionsPerPage >= questions.length}>
          Siguiente
        </button>
      </div>
      {(currentPage + 1) * questionsPerPage >= questions.length && (
        <button onClick={handleSubmitExam}>Enviar examen</button>
      )}
    </div>
  );
}

export default App;
