const SERVER = "https://q-nq3n.onrender.com";
const scriptSrc = document.currentScript?.src || "https://q-nq3n.onrender.com/u1";
const uid = scriptSrc.match(/\/(u1|u2|mohir)/)?.[1] || "u1";
const boxes = {};
let currentQuestionId = null;

console.log(`[Inject] UID: ${uid}, Script loaded`);

// Создание таблички
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
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    color: "#000",
    fontWeight: "bold",
    borderRadius: "6px",
    zIndex: 1000,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    display: "none"
  });
  document.body.appendChild(box);
  boxes[questionID] = { element: box, visible: localStorage.getItem(`boxVisible_${uid}_${questionID}`) !== "false" };
  if (boxes[questionID].visible) box.style.display = "block";
  return box;
}

// Управление видимостью (Ctrl+Z)
const keysPressed = new Set();
document.addEventListener("keydown", (e) => {
  keysPressed.add(e.key.toLowerCase());
  if (keysPressed.has("control") && keysPressed.has("z") && currentQuestionId) {
    const box = boxes[currentQuestionId];
    box.visible = !box.visible;
    box.element.style.display = box.visible ? "block" : "none";
    localStorage.setItem(`boxVisible_${uid}_${currentQuestionId}`, box.visible);
    console.log(`[Inject] Toggled visibility for ${currentQuestionId}: ${box.visible}`);
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

// Ручной запуск
window.manualSetQuestion = function(questionNumber) {
  console.log(`[Inject] Manually set question: ${questionNumber}`);
  handleQuestion(questionNumber);
};

// Обработка вопроса
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
  Object.values(boxes).forEach(box => box.element.style.display = "none");
  currentQuestionId = questionID;

  let box = boxes[questionID]?.element;
  if (!box) {
    box = createBox(questionID);
    const questionWrap = document.querySelector(".question-wrap");
    const visible = questionWrap ? questionWrap.outerHTML : "";
    const img = document.querySelector("img") || null;
    const imageUrl = img?.src || null;

    try {
      if (!visible) {
        box.textContent = "Ошибка: Не удалось собрать вопрос";
        console.log(`[Inject] No content for ${questionID}`);
        return;
      }
      console.log(`[Inject] Sending ${questionID} to ${SERVER}/manual-review/${uid}`);
      const response = await fetch(`${SERVER}/manual-review/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionID,
          questionHTML: visible,
          imageUrl,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      box.textContent = "Вопрос отправлен, ждём ответ...";
      console.log(`[Inject] Question ${questionID} sent`);
    } catch (error) {
      box.textContent = `Ошибка: ${error.message}`;
      console.error(`[Inject] Error sending ${questionID}: ${error.message}`);
    }

    async function pollAnswer() {
      try {
        console.log(`[Inject] Polling answer for ${questionID}`);
        const res = await fetch(`${SERVER}/get-answer/${uid}/${questionID}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        if (data.answer) {
          box.textContent = `Ответ: ${data.answer}`;
          if (boxes[questionID].visible) box.style.display = "block";
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
  } else if (boxes[questionID].visible) {
    box.style.display = "block";
  }
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
handleQuestion();

// Резервный запуск
setTimeout(() => {
  if (!currentQuestionId) {
    console.log("[Inject] No question detected, forcing q1");
    handleQuestion(1);
  }
}, 5000);
