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

// Создание бокса (без сохранения позиции и видимости в localStorage)
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

  // Перетаскивание (без сохранения позиции)
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

// Убираем Ctrl+Z, если видимость не сохраняется
// Можно оставить, если нужно временно скрывать бокс
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
    const response = await fetch(`${SERVER}/manual-review/${uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    console.log(`[Inject] Question ${q.questionID} sent: ${result.message}`);
    if (boxes[q.questionID]) boxes[q.questionID].element.textContent = "Вопрос отправлен, ждём ответ...";
  } catch (error) {
    console.error(`[Inject] Error sending ${q.questionID}: ${error.message}`);
    if (boxes[q.questionID]) boxes[q.questionID].element.textContent = `Ошибка: ${error.message}`;
  }
}

// Получение ответа с сервера
async function pollAnswer(questionID, attempts = 10) {
  if (attempts <= 0) {
    boxes[questionID].element.textContent = "Ошибка: Ответ не получен";
    console.error(`[Inject] Polling for ${questionID} stopped: max attempts reached`);
    return;
  }
  try {
    console.log(`[Inject] Polling answer for ${questionID}`);
    const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
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

// Обработка текущего вопроса
async function handleQuestion(manualQuestionNumber = null) {
  let questionNumber = manualQuestionNumber || getCurrentQuestionNumber();
  if (!questionNumber) {
    console.log(`[Inject] Invalid question number: ${questionNumber}, using fallback`);
    questionNumber = 1;
  }
  let questionID = `q${questionNumber}`;

  if (questionID === currentQuestionId) {
    console.log(`[Inject] Question ${questionID} already active`);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  Object.values(boxes).forEach(box => box.element.style.display = "none");
  currentQuestionId = questionID;

  let box = boxes[questionID]?.element;
  if (!box) {
    box = createBox(questionID);
  } else if (boxes[questionID].visible) {
    box.style.display = "block";
  }

  // Всегда отправляем вопрос и запрашиваем ответ
  sendQuestion(questionNumber);
  pollAnswer(questionID);
}

// Обработка кликов
function handleClick() {
  const num = getCurrentQuestionNumber();
  if (num) {
    console.log(`[Inject] Clicked question/answer ${num}`);
    handleQuestion(num);
  }
}

// Ручной запуск
window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question: ${questionNumber}`);
  handleQuestion(questionNumber);
};

// Остальной код (getCurrentQuestionNumber, getCurrentQuestion, setupClickHandlers, MutationObserver) остаётся без изменений
