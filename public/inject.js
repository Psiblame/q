const SERVER = "https://q-nq3n.onrender.com";
// Извлекаем uid из пути скрипта
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;

console.log(`[Inject] UID: ${uid}, Script loaded from: ${scriptSrc}`);

// Функция для создания таблички
function createBox(questionID) {
  console.log(`[Inject] Creating box for questionID: ${questionID}`);
  const box = document.createElement("div");
  box.dataset.questionId = questionID;
  box.textContent = "Ждём ответ...";
  Object.assign(box.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    color: "#000",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 9999,
    transition: "opacity 0.3s",
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: "none"
  });
  document.body.appendChild(box);
  boxes[questionID] = { element: box, visible: localStorage.getItem(`boxVisible_${uid}_${questionID}`) !== "false" };
  if (boxes[questionID].visible) {
    box.style.display = "block";
  }
  return box;
}

// Управление видимостью таблички
const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z") && currentQuestionId) {
    const box = boxes[currentQuestionId];
    if (box) {
      box.visible = !box.visible;
      box.element.style.display = box.visible ? "block" : "none";
      localStorage.setItem(`boxVisible_${uid}_${currentQuestionId}`, box.visible);
      console.log(`[Inject] Toggled visibility for ${currentQuestionId}: ${box.visible}`);
    }
  }
});

document.addEventListener("keyup", (e) => {
  keysPressed.delete(e.key.toLowerCase());
});

// Функция для получения номера текущего вопроса
function getCurrentQuestionNumber() {
  const selectors = [
    "[class*='question-number']",
    "[class*='question-id']",
    "[class*='current-question']",
    "[data-question-number]",
    "[data-question-id]",
    "h1, h2, h3, h4",
    ".question-header",
    ".question-title",
    "[class*='question']",
    "[id*='question']",
    "div, span, p" // Резервный селектор
  ];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent.toLowerCase();
      const match = text.match(/вопрос\s*(\d+)/i) || text.match(/question\s*(\d+)/i) || text.match(/^\d+/);
      if (match) {
        console.log(`[Inject] Found question number: ${match[1]} from selector: ${selector}`);
        return parseInt(match[1]);
      }
    }
  }
  console.log("[Inject] Could not find question number");
  return null;
}

// Ручной запуск обработки вопроса через консоль
window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question number: ${questionNumber}`);
  handleQuestion(questionNumber);
};

// Функция для обработки вопроса
async function handleQuestion(manualQuestionNumber = null) {
  let questionNumber = manualQuestionNumber || getCurrentQuestionNumber();
  let questionID = questionNumber ? `q${questionNumber}` : `q${Date.now()}`; // Резервный ID

  if (questionID === currentQuestionId) {
    console.log(`[Inject] Question ${questionID} already active, skipping`);
    return;
  }

  console.log(`[Inject] Handling question: ${questionID}`);
  // Скрываем все таблички
  Object.values(boxes).forEach(box => {
    box.element.style.display = "none";
  });

  currentQuestionId = questionID;

  // Показываем или создаём табличку
  let box = boxes[questionID]?.element;
  if (!box) {
    box = createBox(questionID);
    // Собираем содержимое вопроса
    const visible = [...document.querySelectorAll("body > *:not(script):not(style)")]
      .filter(el => el.offsetParent !== null)
      .map(el => el.outerHTML)
      .join("<hr>");
    const img = document.querySelector("img") || null;
    const imageUrl = img?.src || null;

    // Отправка вопроса
    try {
      if (!visible) {
        box.textContent = "Ошибка: Не удалось собрать вопрос";
        console.log(`[Inject] No visible content for question ${questionID}`);
        return;
      }
      console.log(`[Inject] Sending question ${questionID} to ${SERVER}/manual-review/${uid}`);
      const response = await fetch(`${SERVER}/manual-review/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionID,
          questionHTML: visible,
          imageUrl,
        }),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      box.textContent = "Вопрос отправлен, ждём ответ...";
      console.log(`[Inject] Question ${questionID} sent successfully`);
    } catch (error) {
      box.textContent = `Ошибка: ${error.message}`;
      console.error(`[Inject] Error sending question: ${error.message}`);
    }

    // Периодический опрос ответа
    async function pollAnswer() {
      try {
        console.log(`[Inject] Polling answer for ${questionID}`);
        const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}`);
        if (!res.ok) {
          throw new Error(`Ошибка сервера: ${res.status}`);
        }
        const data = await res.json();
        if (data.answer) {
          box.textContent = `Ответ: ${data.answer}`;
          if (boxes[questionID].visible) {
            box.style.display = "block";
          }
          console.log(`[Inject] Received answer for ${questionID}: ${data.answer}`);
        } else {
          setTimeout(pollAnswer, 2000);
        }
      } catch (error) {
        box.textContent = `Ошибка: ${error.message}`;
        console.error(`[Inject] Error polling answer: ${error.message}`);
        setTimeout(pollAnswer, 2000);
      }
    }
    pollAnswer();
  } else if (boxes[questionID].visible) {
    box.style.display = "block";
  }
}

// Отслеживание изменений на странице
const observer = new MutationObserver(() => {
  console.log("[Inject] DOM changed, checking for new question");
  handleQuestion();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Запускаем обработку текущего вопроса
console.log("[Inject] Starting initial question handling");
handleQuestion();

// Резервный запуск через setTimeout
setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing box creation");
    handleQuestion(1); // Попытка создать табличку для вопроса 1
  }
}, 5000);
