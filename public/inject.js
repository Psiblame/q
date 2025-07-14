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

// Получение данных текущего вопроса
function getCurrentQuestion(questionNumber) {
  if (window.questions && window.questions[questionNumber - 1]) {
    const q = window.questions[questionNumber - 1];
    console.log(`[Inject] Found question q${questionNumber} in window.questions`);
    return {
      questionID: `q${questionNumber}`,
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
    };
  }
  // Запасной вариант: собираем из DOM
  const questionWrap = document.querySelector(".question-wrap");
  if (questionWrap) {
    console.log(`[Inject] Collecting question q${questionNumber} from DOM`);
    return {
      questionID: `q${questionNumber}`,
      questionHTML: questionWrap.outerHTML,
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
    if (box) box.textContent = "Ошибка: Не удалось собрать вопрос";
    return;
  }
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
      if (box) box.textContent = "Вопрос отправлен, ждём ответ...";
      break;
    } catch (error) {
      console.error(`[Inject] Error sending ${q.questionID}: ${error.message}, retries left: ${retries}`);
      retries--;
      if (retries === 0) {
        console.error(`[Inject] Failed to send ${q.questionID} after retries`);
        if (box) box.textContent = `Ошибка: ${error.message}`;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Обработка кликов на вопросы и ответы
function setupClickHandlers() {
  document.querySelectorAll(".qnum").forEach(qnum => {
    qnum.addEventListener("click", () => {
      const num = parseInt(qnum.textContent);
      if (num) {
        console.log(`[Inject] Clicked question ${num}`);
        sendQuestion(num);
        handleQuestion(num);
      }
    });
  });
  document.querySelectorAll(".answer").forEach(answer => {
    answer.addEventListener("click", () => {
      const num = getCurrentQuestionNumber();
      if (num) {
        console.log(`[Inject] Clicked answer for question ${num}`);
        sendQuestion(num);
        handleQuestion(num);
      }
    });
  });
}

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
  sendQuestion(questionNumber);
  handleQuestion(questionNumber);
};

// Резервный запуск
setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing q1");
    handleQuestion(1);
  }
}, 5000);
