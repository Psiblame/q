const SERVER = "https://q-nq3n.onrender.com";
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
let box = null;
let currentQuestionId = null;

console.log(`[Inject] UID: ${uid}, Script loaded`);

// Создание таблички
function createBox() {
  console.log(`[Inject] Creating box`);
  const box = document.createElement("div");
  box.textContent = "Ждём ответ...";
  Object.assign(box.style, {
    position: "fixed",
    top: localStorage.getItem(`boxPosition_${uid}_top`) || "80px",
    right: localStorage.getItem(`boxPosition_${uid}_right`) || "20px",
    padding: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "rgba(0, 0, 0, 0.3)",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 1000,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: localStorage.getItem(`boxVisible_${uid}`) !== "false" ? "block" : "none",
    cursor: "move",
    userSelect: "none",
    transition: "opacity 0.3s"
  });
  document.body.appendChild(box);

  // Перетаскивание
  let isDragging = false;
  let currentX, currentY;
  box.addEventListener("mousedown", (e) => {
    isDragging = true;
    currentX = e.clientX - parseFloat(box.style.left || box.getBoundingClientRect().left);
    currentY = e.clientY - parseFloat(box.style.top || box.getBoundingClientRect().top);
    console.log(`[Inject] Started dragging`);
  });
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      box.style.left = `${e.clientX - currentX}px`;
      box.style.top = `${e.clientY - currentY}px`;
      box.style.right = "auto";
    }
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      localStorage.setItem(`boxPosition_${uid}_top`, box.style.top);
      localStorage.setItem(`boxPosition_${uid}_right`, "auto");
      console.log(`[Inject] Stopped dragging, position: top=${box.style.top}, left=${box.style.left}`);
    }
  });

  return box;
}

// Управление видимостью (Ctrl+Z)
const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z") && box) {
    const visible = localStorage.getItem(`boxVisible_${uid}`) !== "false";
    localStorage.setItem(`boxVisible_${uid}`, !visible);
    box.style.display = !visible ? "block" : "none";
    console.log(`[Inject] Toggled visibility: ${!visible}`);
  }
});
document.addEventListener("keyup", (e) => keysPressed.delete(e.key.toLowerCase()));

// Получение номера вопроса
function getCurrentQuestionNumber() {
  const progress = document.querySelector(".progress");
  if (progress) {
    const match = progress.textContent.match(/(\d+)\/\d+/);
    if (match) {
      console.log(`[Inject] Found question number in .progress: ${match[1]}`);
      return parseInt(match[1]);
    }
  }
  const currentQnum = document.querySelector(".qnum.current");
  if (currentQnum) {
    const num = parseInt(currentQnum.textContent);
    if (num) {
      console.log(`[Inject] Found question number in .qnum.current: ${num}`);
      return num;
    }
  }
  console.log("[Inject] Could not find question number");
  return null;
}

// Извлечение всех вопросов
function getAllQuestions() {
  const script = document.querySelector("script").textContent;
  const questionsMatch = script.match(/let questions = (\[[\s\S]*?\]);/);
  if (questionsMatch) {
    try {
      const questions = eval(questionsMatch[1]);
      console.log(`[Inject] Found ${questions.length} questions`);
      return questions.map((q, i) => ({
        questionID: `q${i + 1}`,
        questionHTML: `
          <div class="question-wrap">
            <div class="question-text">${q.question}</div>
            <span class="ball-badge">Балл: ${q.ball}</span>
            <div class="answers">${Object.entries(q.answers)
              .map(([key, text]) => `<div class="answer"><span class="answer-letter">${key.toUpperCase()}</span> ${text}</div>`)
              .join("")}</div>
            <div class="author">${q.author}</div>
          </div>`,
        imageUrl: null
      }));
    } catch (error) {
      console.error(`[Inject] Error parsing questions: ${error.message}`);
      return [];
    }
  }
  console.log("[Inject] Could not find questions array");
  return [];
}

// Отправка всех вопросов
async function sendAllQuestions() {
  const questions = getAllQuestions();
  if (!questions.length) {
    console.log("[Inject] No questions to send");
    return;
  }
  for (const q of questions) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`[Inject] Sending ${q.questionID} to ${SERVER}/manual-review/${uid}`);
        const response = await fetch(`${SERVER}/manual-review/${uid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(q),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(`Server error: ${response.status}, ${result.message || ''}`);
        console.log(`[Inject] Question ${q.questionID} sent: ${result.message}`);
        break;
      } catch (error) {
        console.error(`[Inject] Error sending ${q.questionID}: ${error.message}, retries left: ${retries}`);
        retries--;
        if (retries === 0) {
          console.error(`[Inject] Failed to send ${q.questionID} after retries`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

// Ручной запуск
window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question: ${questionNumber}`);
  handleQuestion(questionNumber);
};

// Обработка текущего вопроса
async function handleQuestion(manualQuestionNumber = null) {
  let questionNumber = manualQuestionNumber || getCurrentQuestionNumber();
  if (!questionNumber || questionNumber < 1 || questionNumber > 10) {
    console.log(`[Inject] Invalid question number: ${questionNumber}, using fallback`);
    questionNumber = 1;
  }
  let questionID = `q${questionNumber}`;

  if (questionID === currentQuestionId) {
    console.log(`[Inject] Question ${questionID} already active`);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  currentQuestionId = questionID;

  if (!box) {
    box = createBox();
  }
  box.dataset.questionId = questionID;

  async function pollAnswer() {
    try {
      console.log(`[Inject] Polling answer for ${questionID}`);
      const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(`Server error: ${res.status}, ${data.message || ''}`);
      if (data.answer) {
        box.textContent = `Ответ: ${data.answer}`;
        if (localStorage.getItem(`boxVisible_${uid}`) !== "false") box.style.display = "block";
        console.log(`[Inject] Answer for ${questionID}: ${data.answer}`);
      } else {
        setTimeout(pollAnswer, 2000);
      }
    } catch (error) {
      box.textContent = `Ошибка: ${error.message}`;
      console.error(`[Inject] Error polling ${questionID}: ${error.message}`);
      setTimeout(pollAnswer, 2000);
    }
  }
  pollAnswer();
}

// Отслеживание изменений DOM
const observer = new MutationObserver(() => {
  console.log("[Inject] DOM changed, checking question");
  handleQuestion();
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

// Первичная обработка
console.log("[Inject] Initializing");
sendAllQuestions();
handleQuestion();

// Резервный запуск
setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing q1");
    handleQuestion(1);
  }
}, 5000);
