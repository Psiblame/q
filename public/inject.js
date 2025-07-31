const SERVER = "https://q-nq3n.onrender.com";
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;
const STORAGE_TIMEOUT = 50 * 60 * 1000; // 50 минут в миллисекундах
const MAX_QUESTIONS = 25; // Поддержка до 25 вопросов

console.log(`[Inject] UID: ${uid}, Script loaded`);

// Очистка просроченных данных в localStorage
function clearExpiredStorage() {
  const now = Date.now();
  Object.keys(localStorage)
    .filter(key => 
      key.startsWith(`answer_${uid}_`) || 
      key.startsWith(`boxPosition_${uid}_`) || 
      key.startsWith(`boxVisible_${uid}_`) || 
      key.startsWith(`isSent_${uid}_`) || 
      key.startsWith(`content_${uid}_`) ||
      key === `boxVisible_${uid}`
    )
    .forEach(key => {
      const timestamp = localStorage.getItem(`${key}_timestamp`);
      if (!timestamp || now - parseInt(timestamp) > STORAGE_TIMEOUT) {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_timestamp`);
      }
    });
  console.log(`[Inject] Cleared expired localStorage for uid: ${uid}`);
}
clearExpiredStorage();

// Получение глобальной видимости боксов
function getGlobalBoxVisibility() {
  const savedVisible = localStorage.getItem(`boxVisible_${uid}`);
  const timestamp = localStorage.getItem(`boxVisible_${uid}_timestamp`);
  const isValid = timestamp && Date.now() - parseInt(timestamp) < STORAGE_TIMEOUT;
  return isValid ? savedVisible !== "false" : true; // По умолчанию видимый
}

// Создание бокса
function createBox(questionID) {
  console.log(`[Inject] Creating box for ${questionID}`);
  const box = document.createElement("div");
  box.dataset.questionId = questionID;
  box.textContent = "Ждём ответ...";
  const savedTop = localStorage.getItem(`boxPosition_${uid}_${questionID}_top`);
  const savedRight = localStorage.getItem(`boxPosition_${uid}_${questionID}_right`);
  const timestamp = localStorage.getItem(`boxPosition_${uid}_${questionID}_timestamp`);
  const isPositionValid = timestamp && Date.now() - parseInt(timestamp) < STORAGE_TIMEOUT;
  const isBoxVisible = getGlobalBoxVisibility();
  Object.assign(box.style, {
    position: "fixed",
    top: isPositionValid ? savedTop || "80px" : "80px",
    right: isPositionValid ? savedRight || "20px" : "20px",
    left: isPositionValid && savedRight === "auto" ? localStorage.getItem(`boxPosition_${uid}_${questionID}_left`) || "auto" : "auto",
    padding: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "rgba(0, 0, 0, 0.2)",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 1000,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: isBoxVisible ? "block" : "none",
    cursor: "move",
    userSelect: "none",
    transition: "opacity 0.3s"
  });
  document.body.appendChild(box);
  boxes[questionID] = { element: box, visible: isBoxVisible };

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
      localStorage.setItem(`boxPosition_${uid}_${questionID}_top`, box.style.top);
      localStorage.setItem(`boxPosition_${uid}_${questionID}_left`, box.style.left);
      localStorage.setItem(`boxPosition_${uid}_${questionID}_right`, "auto");
      localStorage.setItem(`boxPosition_${uid}_${questionID}_timestamp`, Date.now());
      console.log(`[Inject] Stopped dragging ${questionID}, position: top=${box.style.top}, left=${box.style.left}`);
    }
  });

  // Восстановить сохранённый ответ
  const savedAnswer = localStorage.getItem(`answer_${uid}_${questionID}`);
  const answerTimestamp = localStorage.getItem(`answer_${uid}_${questionID}_timestamp`);
  if (savedAnswer && answerTimestamp && Date.now() - parseInt(answerTimestamp) < STORAGE_TIMEOUT) {
    box.textContent = `Ответ: ${savedAnswer}`;
    console.log(`[Inject] Restored cached answer for ${questionID}: ${savedAnswer}`);
  }

  return box;
}

// Управление глобальной видимостью (Ctrl+Z)
const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z")) {
    const isBoxVisible = !getGlobalBoxVisibility();
    localStorage.setItem(`boxVisible_${uid}`, isBoxVisible);
    localStorage.setItem(`boxVisible_${uid}_timestamp`, Date.now());
    Object.values(boxes).forEach(box => {
      box.visible = isBoxVisible;
      box.element.style.display = isBoxVisible ? "block" : "none";
    });
    console.log(`[Inject] Toggled global visibility: ${isBoxVisible}`);
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
  const questionWrap = document.querySelector(".question-wrap");
  if (questionWrap) {
    const questionText = document.querySelector(".question-text")?.textContent || "No question text";
    const ball = document.querySelector(".ball-badge")?.textContent || "Балл: 0";
    const answers = document.querySelector(".answers")?.outerHTML || "<div class='answers'>No answers</div>";
    const author = document.querySelector(".author")?.textContent || "Unknown";
    const img = document.querySelector(".question-wrap img")?.src || document.querySelector("img")?.src;
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
      imageUrl: img || null
    };
  }
  console.log(`[Inject] Could not collect question q${questionNumber}`);
  return null;
}

// Получение хеша контента вопроса
function getQuestionContentHash(questionNumber) {
  const questionWrap = document.querySelector(".question-wrap");
  if (!questionWrap) return "";
  const questionText = document.querySelector(".question-text")?.textContent || "";
  const answers = document.querySelector(".answers")?.textContent || "";
  return questionText + answers;
}

// Отправка вопроса
async function sendQuestion(questionNumber) {
  const q = getCurrentQuestion(questionNumber);
  if (!q) {
    console.log(`[Inject] No question data for q${questionNumber}`);
    if (boxes[`q${questionNumber}`]) boxes[`q${questionNumber}`].element.textContent = "Ошибка: Не удалось собрать вопрос";
    return;
  }
  const savedAnswer = localStorage.getItem(`answer_${uid}_${q.questionID}`);
  const answerTimestamp = localStorage.getItem(`answer_${uid}_${q.questionID}_timestamp`);
  if (savedAnswer && answerTimestamp && Date.now() - parseInt(answerTimestamp) < STORAGE_TIMEOUT) {
    console.log(`[Inject] Question ${q.questionID} already has an answer in localStorage, skipping send`);
    if (boxes[q.questionID]) {
      boxes[q.questionID].element.textContent = `Ответ: ${savedAnswer}`;
      boxes[q.questionID].visible = getGlobalBoxVisibility();
      boxes[q.questionID].element.style.display = boxes[q.questionID].visible ? "block" : "none";
    }
    return;
  }
  const isSent = localStorage.getItem(`isSent_${uid}_${q.questionID}`);
  const isSentTimestamp = localStorage.getItem(`isSent_${uid}_${q.questionID}_timestamp`);
  if (isSent && isSentTimestamp && Date.now() - parseInt(isSentTimestamp) < STORAGE_TIMEOUT) {
    console.log(`[Inject] Question ${q.questionID} already sent, skipping send`);
    return;
  }
  let retries = 3;
  while (retries > 0) {
    try {
      console.log(`[Inject] Sending ${q.questionID} to ${SERVER}/manual-review/${uid}`);
      const response = await fetch(`${SERVER}/manual-review/${uid}?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Server error: ${response.status}, ${result.message || ''}`);
      console.log(`[Inject] Question ${q.questionID} sent: ${result.message}`);
      localStorage.setItem(`isSent_${uid}_${q.questionID}`, "true");
      localStorage.setItem(`isSent_${uid}_${q.questionID}_timestamp`, Date.now());
      if (boxes[q.questionID] && !boxes[q.questionID].element.textContent.startsWith("Ответ: ")) {
        boxes[q.questionID].element.textContent = "Вопрос отправлен, ждём ответ...";
      }
      break;
    } catch (error) {
      console.error(`[Inject] Error sending ${q.questionID}: ${error.message}, retries left: ${retries}`);
      retries--;
      if (retries === 0) {
        console.error(`[Inject] Failed to send ${q.questionID} after retries`);
        if (boxes[q.questionID]) boxes[q.questionID].element.textContent = `Ошибка: ${error.message}`;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Получение ответа
async function pollAnswer(questionID) {
  const savedAnswer = localStorage.getItem(`answer_${uid}_${questionID}`);
  const answerTimestamp = localStorage.getItem(`answer_${uid}_${questionID}_timestamp`);
  if (savedAnswer && answerTimestamp && Date.now() - parseInt(answerTimestamp) < STORAGE_TIMEOUT) {
    console.log(`[Inject] Using cached answer for ${questionID}: ${savedAnswer}`);
    if (boxes[questionID]) {
      boxes[questionID].element.textContent = `Ответ: ${savedAnswer}`;
      boxes[questionID].visible = getGlobalBoxVisibility();
      boxes[questionID].element.style.display = boxes[questionID].visible ? "block" : "none";
    }
    return;
  }
  if (boxes[questionID] && boxes[questionID].element.textContent.startsWith("Ответ: ")) {
    console.log(`[Inject] Answer already displayed for ${questionID}, stopping poll`);
    return;
  }
  try {
    console.log(`[Inject] Polling answer for ${questionID}`);
    const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}?t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Server error: ${res.status}, ${data.message || ''}`);
    if (data.answer) {
      boxes[questionID].element.textContent = `Ответ: ${data.answer}`;
      localStorage.setItem(`answer_${uid}_${questionID}`, data.answer);
      localStorage.setItem(`answer_${uid}_${questionID}_timestamp`, Date.now());
      boxes[questionID].visible = getGlobalBoxVisibility();
      boxes[questionID].element.style.display = boxes[questionID].visible ? "block" : "none";
      console.log(`[Inject] Answer for ${questionID}: ${data.answer}, saved to localStorage`);
    } else {
      setTimeout(() => pollAnswer(questionID), 2000);
    }
  } catch (error) {
    boxes[questionID].element.textContent = `Ошибка: ${error.message}`;
    console.error(`[Inject] Error polling ${questionID}: ${error.message}`);
    setTimeout(() => pollAnswer(questionID), 2000);
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
  if (!questionNumber || questionNumber < 1 || questionNumber > MAX_QUESTIONS) {
    console.log(`[Inject] Invalid question number: ${questionNumber}, using fallback`);
    questionNumber = 1;
  }
  let questionID = `q${questionNumber}`;

  // Защита от частых вызовов
  if (currentQuestionId === questionID && Date.now() - lastMutation < 5000) {
    console.log(`[Inject] Skipping redundant update for ${questionID}`);
    return;
  }

  // Удаляем все старые боксы из DOM
  Object.entries(boxes).forEach(([id, box]) => {
    if (id !== questionID) {
      box.element.remove();
      delete boxes[id];
      console.log(`[Inject] Removed old box for ${id}`);
    }
  });

  // Проверка, есть ли уже ответ
  const savedAnswer = localStorage.getItem(`answer_${uid}_${questionID}`);
  const answerTimestamp = localStorage.getItem(`answer_${uid}_${questionID}_timestamp`);
  if (savedAnswer && answerTimestamp && Date.now() - parseInt(answerTimestamp) < STORAGE_TIMEOUT) {
    if (!boxes[questionID]) {
      createBox(questionID);
    }
    boxes[questionID].element.textContent = `Ответ: ${savedAnswer}`;
    boxes[questionID].visible = getGlobalBoxVisibility();
    boxes[questionID].element.style.display = boxes[questionID].visible ? "block" : "none";
    console.log(`[Inject] Restored cached answer for ${questionID}: ${savedAnswer}`);
    currentQuestionId = questionID;
    return;
  }

  // Проверка, изменился ли вопрос
  const currentContent = getQuestionContentHash(questionNumber);
  const savedContent = localStorage.getItem(`content_${uid}_${questionID}`);
  const isSent = localStorage.getItem(`isSent_${uid}_${questionID}`);
  const isSentTimestamp = localStorage.getItem(`isSent_${uid}_${questionID}_timestamp`);

  if (questionID === currentQuestionId && savedContent === currentContent && isSent && isSentTimestamp && Date.now() - parseInt(isSentTimestamp) < STORAGE_TIMEOUT) {
    console.log(`[Inject] Question ${questionID} unchanged and already sent, polling answer`);
    if (!boxes[questionID]) {
      createBox(questionID);
    }
    boxes[questionID].element.textContent = "Вопрос отправлен, ждём ответ...";
    boxes[questionID].visible = getGlobalBoxVisibility();
    boxes[questionID].element.style.display = boxes[questionID].visible ? "block" : "none";
    pollAnswer(questionID);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  currentQuestionId = questionID;

  if (!boxes[questionID]) {
    createBox(questionID);
  }
  boxes[questionID].visible = getGlobalBoxVisibility();
  boxes[questionID].element.style.display = boxes[questionID].visible ? "block" : "none";

  localStorage.setItem(`content_${uid}_${questionID}`, currentContent);
  localStorage.setItem(`content_${uid}_${questionID}_timestamp`, Date.now());
  sendQuestion(questionNumber);
  pollAnswer(questionID);
}

// Отслеживание изменений DOM с throttle
let lastMutation = 0;
const DEBOUNCE_TIME = 2000; // 2 секунды
const observer = new MutationObserver(() => {
  const now = Date.now();
  if (now - lastMutation < DEBOUNCE_TIME) return;
  lastMutation = now;
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

// Очистка localStorage перед закрытием страницы
window.addEventListener("beforeunload", () => {
  Object.keys(localStorage)
    .filter(key => 
      key.startsWith(`answer_${uid}_`) || 
      key.startsWith(`boxPosition_${uid}_`) || 
      key.startsWith(`boxVisible_${uid}_`) || 
      key.startsWith(`isSent_${uid}_`) || 
      key.startsWith(`content_${uid}_`) ||
      key === `boxVisible_${uid}`
    )
    .forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
    });
  console.log(`[Inject] Cleared localStorage on page beforeunload`);
});

// Логирование загрузки скрипта для отладки CORS и COEP
console.log(`[Inject] Attempting to load script from ${scriptSrc}`);
fetch(scriptSrc, {
  mode: "cors",
  credentials: "omit",
  referrerPolicy: "no-referrer",
  cache: "no-store"
}).then(res => {
  console.log(`[Inject] Script response: ${res.status}, CORS: ${res.headers.get('Access-Control-Allow-Origin')}, CORP: ${res.headers.get('Cross-Origin-Resource-Policy')}, CSP: ${res.headers.get('Content-Security-Policy')}`);
}).catch(err => {
  console.error(`[Inject] Script load failed: ${err.message}`);
});
