const SERVER = "https://q-nq3n.onrender.com";
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;

console.log(`[Inject] UID: ${uid}, Script loaded`);

// Очистка localStorage при загрузке
function clearLocalStorage() {
  Object.keys(localStorage)
    .filter(key => key.startsWith(`answer_${uid}_`) || key.startsWith(`boxPosition_${uid}_`) || key.startsWith(`boxVisible_${uid}_`))
    .forEach(key => localStorage.removeItem(key));
  console.log(`[Inject] Cleared localStorage for uid: ${uid}`);
}
clearLocalStorage();

// Создание бокса
function createBox(questionID) {
  console.log(`[Inject] Creating box for ${questionID}`);
  const box = document.createElement("div");
  box.dataset.questionId = questionID;
  box.textContent = "Ждём ответ...";
  Object.assign(box.style, {
    position: "fixed",
    top: "80px",
    right: "20px",
    padding: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "rgba(0, 0, 0, 0.2)",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 1000,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: "block",
    cursor: "move",
    userSelect: "none",
    transition: "opacity 0.3s"
  });
  document.body.appendChild(box);
  boxes[questionID] = { element: box, visible: true };

  // Перетаскивание
  let isDragging = false;
  let currentX, currentY;
  box.addEventListener("mousedown", (e) => {
    isDragging = true;
    currentX = e.clientX - parseFloat(box.style.left || box.getBoundingClientRect().left);
    currentY = e.clientY - parseFloat(box.style.top || box.getBoundingClientRect().top);
    console.log(`[Inject] Started dragging ${questionID}`);
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
      console.log(`[Inject] Stopped dragging ${questionID}`);
    }
  });

  return box;
}

// Управление видимостью (Ctrl+Z)
const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z") && currentQuestionId) {
    const box = boxes[currentQuestionId];
    if (box) {
      box.visible = !box.visible;
      box.element.style.display = box.visible ? "block" : "none";
      console.log(`[Inject] Toggled visibility for ${currentQuestionId}: ${box.visible}`);
    }
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

// Получение данных текущего вопроса
function getCurrentQuestion(questionNumber) {
  // Проверка по вашему предложению
  const questionEl = document.querySelector(`#question-${questionNumber}`);
  if (questionEl) {
    const html = questionEl.innerHTML;
    const img = questionEl.querySelector("img")?.src;
    console.log(`[Inject] Found question q${questionNumber} via #question-${questionNumber}`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: html || "<div>No question text</div>",
      imageUrl: img || null
    };
  }

  // Запасной вариант из window.questions
  if (window.questions && window.questions[questionNumber - 1]) {
    const q = window.questions[questionNumber - 1];
    console.log(`[Inject] Found question q${questionNumber} in window.questions`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: `
        <div class="question-wrap">
          <div class="question-text">${q.question || "No question text"}</div>
          <span class="ball-badge">Балл: ${q.ball || 0}</span>
          <div class="answers">${Object.entries(q.answers || {})
            .map(([key, text]) => `<div class="answer"><span class="answer-letter">${key.toUpperCase()}</span> ${text || "No text"}</div>`)
            .join("")}</div>
          <div class="author">${q.author || "Unknown"}</div>
        </div>`,
      imageUrl: null
    };
  }

  // Запасной вариант из DOM
  const questionWrap = document.querySelector(".question-wrap");
  if (questionWrap) {
    const questionText = document.querySelector(".question-text")?.textContent || "No question text";
    const ball = document.querySelector(".ball-badge")?.textContent || "Балл: 0";
    const answers = document.querySelector(".answers")?.outerHTML || "<div class='answers'>No answers</div>";
    const author = document.querySelector(".author")?.textContent || "Unknown";
    console.log(`[Inject] Collecting question q${questionNumber} from DOM`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: `
        <div class="question-wrap">
          <div class="question-text">${questionText}</div>
          ${ball}
          ${answers}
          <div class="author">${author}</div>
        </div>`,
      imageUrl: document.querySelector("img")?.src || null
    };
  }

  console.log(`[Inject] Could not collect question q${questionNumber}`);
  return null;
}

// Отправка вопроса
async function sendQuestion(questionNumber) {
  const q = getCurrentQuestion(questionNumber);
  if (!q) {
    console.log(`[Inject] No question data for q${questionNumber}`);
    if (boxes[`q${questionNumber}`]) boxes[`q${questionNumber}`].element.textContent = "Ошибка: Не удалось собрать вопрос";
    return;
  }
  try {
    console.log(`[Inject] Sending ${q.questionID} to ${SERVER}/manual-review/${uid}`);
    const response = await fetch(`${SERVER}/manual-review/${uid}?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Server error: ${response.status}, ${result.message || ''}`);
    console.log(`[Inject] Question ${q.questionID} sent: ${result.message}`);
    if (boxes[q.questionID]) boxes[q.questionID].element.textContent = "Вопрос отправлен, ждём ответ...";
  } catch (error) {
    console.error(`[Inject] Error sending ${q.questionID}: ${error.message}`);
    if (boxes[q.questionID]) boxes[q.questionID].element.textContent = `Ошибка: ${error.message}`;
  }
}

// Получение ответа
async function pollAnswer(questionID, attempts = 10) {
  if (attempts <= 0) {
    boxes[questionID].element.textContent = "Ошибка: Ответ не получен";
    console.error(`[Inject] Polling for ${questionID} stopped: max attempts reached`);
    return;
  }
  try {
    console.log(`[Inject] Polling answer for ${questionID}`);
    const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}?t=${Date.now()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Server error: ${res.status}, ${data.message || ''}`);
    if (data.answer) {
      boxes[questionID].element.textContent = `Ответ: ${data.answer}`;
      console.log(`[Inject] Answer for ${questionID}: ${data.answer}`);
    } else {
      setTimeout(() => pollAnswer(questionID, attempts - 1), 2000);
    }
  } catch (error) {
    boxes[questionID].element.textContent = `Ошибка: ${error.message}`;
    console.error(`[Inject] Error polling ${questionID}: ${error.message}`);
    setTimeout(() => pollAnswer(questionID, attempts - 1), 2000);
  }
}

// Обработка кликов
function setupClickHandlers() {
  const qnums = document.querySelectorAll(".qnum");
  const answers = document.querySelectorAll(".answer");
  console.log(`[Inject] Found ${qnums.length} .qnum elements and ${answers.length} .answer elements`);

  qnums.forEach(qnum => {
    qnum.removeEventListener("click", handleClick);
    qnum.addEventListener("click", handleClick);
  });
  answers.forEach(answer => {
    answer.removeEventListener("click", handleClick);
    answer.addEventListener("click", handleClick);
  });
}

function handleClick() {
  const num = getCurrentQuestionNumber();
  if (num) {
    console.log(`[Inject] Clicked question/answer ${num}`);
    handleQuestion(num);
  } else {
    console.log(`[Inject] No valid question number found on click`);
  }
}

// Обработка текущего вопроса
async function handleQuestion(manualQuestionNumber = null) {
  let questionNumber = manualQuestionNumber || getCurrentQuestionNumber();
  if (!questionNumber) {
    console.log(`[Inject] Invalid question number: ${questionNumber}, using fallback`);
    questionNumber = 1;
  }
  // Ограничение до 25 вопросов
  if (questionNumber > 25) {
    console.log(`[Inject] Question number ${questionNumber} exceeds limit of 25, using 1`);
    questionNumber = 1;
  }
  let questionID = `q${questionNumber}`;

  if (questionID === currentQuestionId) {
    console.log(`[Inject] Question ${questionID} already active`);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  Object.values(boxes).forEach(box => {
    box.element.style.display = "none";
    box.visible = false;
  });
  currentQuestionId = questionID;

  let box = boxes[questionID]?.element;
  if (!box) {
    box = createBox(questionID);
  }
  boxes[questionID].visible = true;
  box.style.display = "block";

  sendQuestion(questionNumber);
  pollAnswer(questionID);
}

// Отслеживание изменений DOM
const observer = new MutationObserver(() => {
  console.log("[Inject] DOM changed, checking question");
  handleQuestion();
  setupClickHandlers();
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

// Первичная обработка
console.log("[Inject] Initializing");
setupClickHandlers();
handleQuestion();

// Ручной запуск
window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question: ${questionNumber}`);
  handleQuestion(questionNumber);
};

// Резервный запуск
setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing q1");
    handleQuestion(1);
  }
}, 5000);

// Диагностика window.questions
console.log("[Inject] Checking window.questions:", window.questions);
