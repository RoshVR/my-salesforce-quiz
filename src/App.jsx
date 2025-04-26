import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [questions, setQuestions] = useState([]);
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
  const [warningMessage, setWarningMessage] = useState("");
  const [unansweredIndexes, setUnansweredIndexes] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    setExamSessionId(uuidv4());
    setStartTime(Date.now());

    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from("preguntas_examen")
        .select("*");
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
  }, [showResults, examSessionId]);

  const handleOptionSelect = (questionIndex, optionIndex, isMultipleChoice) => {
    setSelectedOptions((prev) => {
      const updated = [...prev];
      const current = updated[questionIndex] || [];

      if (isMultipleChoice) {
        // Comportamiento actual para selección múltiple
        if (current.includes(optionIndex)) {
          updated[questionIndex] = current.filter((i) => i !== optionIndex);
        } else {
          updated[questionIndex] = [...current, optionIndex];
        }
      } else {
        // Si ya estaba seleccionada, desmarcar
        if (current.includes(optionIndex)) {
          updated[questionIndex] = [];
        } else {
          updated[questionIndex] = [optionIndex];
        }
      }

      return updated;
    });
  };

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const handleSubmitExam = async () => {
    const newUnanswered = questions.reduce((acc, _, index) => {
      const selected = selectedOptions[index];
      if (!selected || selected.length === 0) acc.push(index);
      return acc;
    }, []);

    if (newUnanswered.length > 0) {
      setWarningMessage(
        "⚠️ Por favor responde todas las preguntas antes de enviar el examen."
      );
      setUnansweredIndexes(newUnanswered);
      return;
    }

    setIsReviewing(true);
    setWarningMessage("");
    setUnansweredIndexes([]);

    let correctCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userSelected = selectedOptions[i] || [];
      const correctAnswers = q.correct_answers || [];

      const isCorrect =
        correctAnswers.length === userSelected.length &&
        correctAnswers.every((val) => userSelected.includes(val));

      if (isCorrect) correctCount++;

      await submitAnswer(q.id, userSelected, isCorrect, examSessionId);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    await saveExamResult(
      examSessionId,
      correctCount,
      questions.length,
      totalTime
    );

    setScore(correctCount);
    setEndTime(Date.now());
    setIsReviewing(false);
    setShowResults(true);
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

  const saveExamResult = async (
    sessionId,
    score,
    totalQuestions,
    totalTime
  ) => {
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleRestart = () => {
    window.location.reload(); // puedes cambiar esto si quieres resetear el estado manualmente
  };
  
  const handleFinish = () => {
    // redirigir o cerrar la vista, según tu flujo
    alert("Gracias por presentar el examen 😊");
    window.location.reload();
  };
  



  if (questions.length === 0) return <p>Loading questions...</p>;

  if (isReviewing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-blue-600 text-lg font-semibold animate-pulse">
            Revisando y calificando tu examen...
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6 space-y-4">
          <div className="sticky top-0 z-10 bg-blue-100 border-b border-blue-300 shadow-sm p-4">
            <h1 className="text-2xl font-bold text-center text-blue-800">
              Resultados del Examen
            </h1>
            <div className="flex justify-between mt-2 text-sm text-blue-700 font-medium">
              <span>
                Puntaje: {score} de {questions.length}
              </span>
              <span>Tiempo total: {formatTime(Math.floor(totalTime))}</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-700 mt-6">
            📝 Detalles de tus respuestas:
          </h2>

          {answerDetails.length === 0 ? (
            <p className="text-center text-gray-500">Cargando respuestas...</p>
          ) : (
            <div className="space-y-6">
              {answerDetails.map((item, idx) => {
                const question = item.preguntas_examen;
                const isCorrect = item.is_correct;
                const userAnswer = item.user_answer
                  ?.map((i) => question?.options?.[i])
                  .join(", ");
                const correctAnswer = question?.correct_answers
                  ?.map((i) => question?.options?.[i])
                  .join(", ");
                return (
                  <div
                    key={idx}
                    className={`border-l-4 p-4 rounded shadow-sm ${
                      isCorrect
                        ? "border-green-500 bg-green-50"
                        : "border-red-500 bg-red-50"
                    }`}
                  >
                    <h4 className="font-semibold text-lg text-gray-700 mb-2">
                      Pregunta {idx + 1}:{" "}
                      {question?.question || "Pregunta no encontrada"}
                    </h4>
                    <p className="text-gray-700">
                      <strong>Tu respuesta:</strong> {userAnswer || "Ninguna"}
                    </p>
                    <p className="text-gray-700">
                      <strong>Correcta:</strong> {correctAnswer || "Ninguna"}
                    </p>
                    {!isCorrect && question?.explanation && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Explicación:</strong> {question.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={handleRestart}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
            >
              Volver a hacer el examen
            </button>
            <button
              onClick={handleFinish}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const startIndex = currentPage * questionsPerPage;
  const currentQuestions = questions.slice(
    startIndex,
    startIndex + questionsPerPage
  );

  return (
    <div className="container">
      <div className="sticky top-0 z-10 bg-gray-200 border-b border-gray-400 px-4 py-3 shadow-md">
        <h1 className="text-2xl font-bold text-center text-blue-800 mb-2">
          Salesforce Admin Quiz
        </h1>
        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
          <div>
            Preguntas {startIndex + 1} -{" "}
            {Math.min(startIndex + questionsPerPage, questions.length)} de{" "}
            {questions.length}
          </div>
          <div>Tiempo transcurrido: {formatTime(elapsedTime)}</div>
        </div>
      </div>

      {currentQuestions.map((question, qIndex) => {
        const questionId = startIndex + qIndex;
        const isMultipleChoice = question.correct_answers.length > 1;
        const selected = selectedOptions[questionId] || [];

        return (
          <div
            key={question.id}
            className={`p-4 rounded-xl shadow-sm ${
              unansweredIndexes.includes(questionId)
                ? "border-2 border-red-500 bg-red-50"
                : "border border-gray-200"
            }`}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {startIndex + qIndex + 1}.{" "}
              {question.pregunta || question.question}
            </h3>

            <div className="space-y-3">
              {question.options.map((option, index) => {
                const optionLetter = String.fromCharCode(65 + index);
                const isSelected = selected.includes(index);
                const isCorrect = question.correct_answers.includes(index);
                const showFeedback = showResults;

                let optionClass =
                  "w-full text-left px-4 py-3 border rounded-lg transition transform ";

                if (showFeedback) {
                  if (isCorrect) {
                    optionClass += "bg-green-500 text-white border-green-600 ";
                  } else if (isSelected && !isCorrect) {
                    optionClass += "bg-red-500 text-white border-red-600 ";
                  } else {
                    optionClass += "bg-white ";
                  }
                } else {
                  optionClass += isSelected
                    ? "bg-blue-600 text-white border-blue-700 scale-105 shadow-lg ring-2 ring-offset-2 ring-blue-300 font-bold "
                    : "hover:bg-blue-100 border-blue-300 ";
                }

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      handleOptionSelect(questionId, index, isMultipleChoice)
                    }
                    className={optionClass}
                  >
                    <span className="font-semibold mr-2">{optionLetter}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {warningMessage && (
        <div className="text-red-600 font-semibold my-4">{warningMessage}</div>
      )}

      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {Array.from({
          length: Math.ceil(questions.length / questionsPerPage),
        }).map((_, i) => {
          // Verificar si esta página tiene preguntas sin responder
          const start = i * questionsPerPage;
          const end = start + questionsPerPage;
          const unanswered = questions
            .slice(start, end)
            .some(
              (_, idx) =>
                !(
                  selectedOptions[start + idx] &&
                  selectedOptions[start + idx].length > 0
                )
            );

          return (
            <button
              key={i}
              onClick={() => {
                setCurrentPage(i);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium border
          ${
            i === currentPage
              ? "bg-blue-600 text-white"
              : unanswered
              ? "bg-red-100 border-red-500 text-red-700"
              : "bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200"
          }
        `}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <button
          onClick={goToPreviousPage}
          disabled={currentPage === 0}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Anterior
        </button>
        {(currentPage + 1) * questionsPerPage >= questions.length ? (
          <button
            onClick={handleSubmitExam}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Enviar examen
          </button>
        ) : (
          <button
            onClick={goToNextPage}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
