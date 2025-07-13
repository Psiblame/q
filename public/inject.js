const server = "https://q-nq3n.onrender.com";

const questionID = Math.random().toString(36).slice(2);
const visible = [...document.querySelectorAll("[class*='question'], [class*='test'], [class*='pane']")]
  .filter(el => el.offsetParent !== null)
  .map(el => el.outerHTML)
  .join("<hr>");

const img = document.querySelector("img");
const imageUrl = img?.src || null;

fetch(`${server}/manual-review`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    questionID,
    questionHTML: visible,
    imageUrl,
  }),
});

async function pollAnswer() {
  const res = await fetch(`${server}/get-answer/${questionID}`);
  const data = await res.json();
  if (data.answer) {
    const box = document.createElement("div");
    box.textContent = `Ответ: ${data.answer}`;
    Object.assign(box.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "10px",
      backgroundColor: "#dff0d8",
      color: "#000",
      fontWeight: "bold",
      border: "1px solid #ccc",
      zIndex: 9999,
    });
    document.body.appendChild(box);
  } else {
    setTimeout(pollAnswer, 2000);
  }
}

pollAnswer();
