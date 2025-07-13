const SERVER = "https://q-nq3n.onrender.com";
// Извлекаем uid из пути скрипта
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;

// Функция для создания таблички
function createBox(questionID) {
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
    }
  }
});

document.addEventListener("keyup", (e) => {
  keysPressed.delete(e.key.toLowerCase());
});

// Функция для получения номера текущего вопроса
function getCurrentQuestionNumber() {
  const questionElement = document.querySelector("[class*='question-number'], [class*='question-id'], [class*='current-question']") || document.querySelector("h1, h2, h3");
  if (questionElement) {
    const text = questionElement.textContent.toLowerCase();
    const match = text.match(/вопрос\s*(\d+)/i) || text.match(/question\s*(\d+)/i) || text.match(/^\d+/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

// Функция для обработки вопроса
async function handleQuestion() {
  const questionNumber = getCurrentQuestionNumber();
  if (!questionNumber || questionNumber < 1 || questionNumber > 25) {
    return;
  }

  const questionID = `q${questionNumber}`;
  if (questionID === currentQuestionId) {
    return;
  }

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
    const visible = [...document.querySelectorAll("[class*='question'], [class*='test'], [class*='pane']")]
      .filter(el => el.offsetParent !== null)
      .map(el => el.outerHTML)
      .join("<hr>");
    const img = document.querySelector("img.question-image") || document.querySelector("img");
    const imageUrl = img?.src || null;

    // Отправка вопроса
    try {
      if (!visible) {
        throw new Error("Не удалось собрать содержимое вопроса");
      }
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
    } catch (error) {
      box.textContent = `Ошибка: ${error.message}`;
    }

    // Периодический опрос ответа
    async function pollAnswer() {
      try {
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
        } else {
          setTimeout(pollAnswer, 2000);
        }
      } catch (error) {
        box.textContent = `Ошибка: ${error.message}`;
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
  handleQuestion();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Запускаем обработку текущего вопроса
handleQuestion();
