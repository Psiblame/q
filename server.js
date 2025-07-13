const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

const questions = {};

app.post("/manual-review", (req, res) => {
  const { questionID, questionHTML, imageUrl } = req.body;
  if (!questionID || !questionHTML) return res.status(400).send("Invalid data");

  questions[questionID] = { html: questionHTML, imageUrl, answer: null };
  res.send({ status: "received" });
});

app.get("/get-answer/:id", (req, res) => {
  const q = questions[req.params.id];
  if (!q || !q.answer) return res.json({ answer: null });
  res.json({ answer: q.answer });
});

app.post("/submit-answer", (req, res) => {
  const { id, answer } = req.body;
  if (!questions[id]) return res.status(404).send("Question not found");

  questions[id].answer = answer;
  res.json({ status: "saved" });
});

app.get("/admin", (req, res) => {
  let html = `<h1>Admin panel — вопросы</h1>`;
  for (const id in questions) {
    const q = questions[id];
    html += `
      <div style="border:1px solid #ccc; margin:10px; padding:10px;">
        <b>ID:</b> ${id}<br/>
        ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-width:300px;"><br/>` : ""}
        ${q.html}
        <form onsubmit="submitAnswer(event, '${id}')">
          <input type="text" name="answer" placeholder="Ответ (A, B, C…)" required />
          <button type="submit">Отправить</button>
        </form>
      </div>
    `;
  }

  html += `
  <script>
    function submitAnswer(e, id) {
      e.preventDefault();
      const form = e.target;
      const answer = form.answer.value.trim();
      fetch('/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, answer })
      }).then(r => r.json()).then(() => {
        alert('Ответ сохранён');
        form.answer.value = '';
      });
    }
  </script>
  `;

  res.send(html);
});

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
