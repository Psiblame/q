const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

const allowedUsers = ["u1", "u2", "mohir"];
const adminLogin = "psiblame";
const adminPassword = "qwerty123";

// Хранилище вопросов и ответов по uid
const questions = { u1: {}, u2: {}, mohir: {} };
const answers = { u1: {}, u2: {}, mohir: {} };

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Корневой маршрут
app.get("/", (req, res) => {
  res.send("Сервер работает! Доступные маршруты: /:uid, /admin, /manual-review/:uid, /get-answer/:uid/:questionID, /clear-questions/:uid");
});

// Basic-авторизация для /admin
app.use("/admin", (req, res, next) => {
  const auth = req.headers.authorization;
  console.log(`Authorization header: ${auth}`);

  if (!auth) {
    res.set("WWW-Authenticate", 'Basic realm="Admin Panel"');
    return res.status(401).send("Требуется авторизация");
  }

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic") {
    console.log(`Invalid auth scheme: ${scheme}`);
    res.set("WWW-Authenticate", 'Basic realm="Admin Panel"');
    return res.status(401).send("Неверная схема авторизации");
  }

  const decoded = Buffer.from(encoded, "base64").toString();
  const [login, password] = decoded.split(":");
  console.log(`Login attempt: ${login}`);

  if (login === adminLogin && password === adminPassword) {
    next();
  } else {
    console.log(`Failed login: ${login}/${password}`);
    res.set("WWW-Authenticate", 'Basic realm="Admin Panel"');
    res.status(401).send("Неверный логин или пароль");
  }
});

// Панель администратора
app.get("/admin", (req, res) => {
  try {
    let html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Админ-панель</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .question { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
          .question img { max-width: 300px; }
          .question-content { max-height: 150px; overflow: auto; }
          .user-section { margin-bottom: 20px; }
          .clear-btn { background: #ff4444; color: white; padding: 5px 10px; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Админ-панель — Вопросы</h2>
    `;
    for (const uid of allowedUsers) {
      html += `<h3>Пользователь: ${uid}</h3>`;
      html += `<form method="POST" action="/clear-questions/${uid}"><button class="clear-btn">Очистить вопросы ${uid}</button></form>`;
      const userQuestions = questions[uid] || {};
      const sortedQuestions = Object.entries(userQuestions).sort(([id1], [id2]) => {
        const num1 = parseInt(id1.replace("q", ""));
        const num2 = parseInt(id2.replace("q", ""));
        return num1 - num2;
      });
      if (sortedQuestions.length === 0) {
        html += `<p>Вопросы отсутствуют</p>`;
      }
      for (const [id, q] of sortedQuestions) {
        html += `
          <div class="question">
            <strong>Вопрос ${id} (Пользователь: ${uid}):</strong><br>
            <form method="POST" action="/answer">
              <input type="hidden" name="uid" value="${uid}">
              <textarea name="id" hidden>${id}</textarea>
              ${q.imageUrl ? `<img src="${q.imageUrl}" alt="Question image"><br>` : ""}
              <div class="question-content">${q.html}</div>
              <input name="answer" placeholder="Введите ответ (напр. A)" required>
              <button type="submit">Отправить</button>
            </form>
          </div>
        `;
      }
    }
    html += `
      </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error(`Admin panel error: ${error.message}`);
    res.status(500).send("Ошибка при генерации админ-панели");
  }
});

// Обработка ответа
app.post("/answer", (req, res) => {
  const { uid, id, answer } = req.body;
  if (!uid || !id || !answer || !allowedUsers.includes(uid)) {
    return res.status(400).json({ error: "Отсутствует uid, id или answer, или неверный uid" });
  }
  answers[uid][id] = answer.toUpperCase();
  console.log(`Answer saved: ${uid}/${id} -> ${answer}`);
  res.redirect("/admin");
});

// Получение вопроса
app.post("/manual-review/:uid", (req, res) => {
  const { uid } = req.params;
  const { questionID, questionHTML, imageUrl } = req.body;
  if (!uid || !questionID || !questionHTML || !allowedUsers.includes(uid)) {
    return res.status(400).json({ error: "Отсутствует uid, questionID или questionHTML, или неверный uid" });
  }
  questions[uid][questionID] = { html: questionHTML, imageUrl };
  console.log(`Question received: ${uid}/${questionID}`);
  res.status(200).json({ message: "Вопрос успешно сохранён", questionID });
});

// Отправка ответа
app.get("/get-answer/:uid/:questionID", (req, res) => {
  const { uid, questionID } = req.params;
  if (!allowedUsers.includes(uid)) {
    return res.status(400).json({ error: "Неверный uid" });
  }
  const answer = answers[uid][questionID] || null;
  res.json({ answer });
});

// Очистка вопросов пользователя
app.post("/clear-questions/:uid", (req, res) => {
  const { uid } = req.params;
  if (!allowedUsers.includes(uid)) {
    return res.status(400).json({ error: "Неверный uid" });
  }
  questions[uid] = {};
  answers[uid] = {};
  console.log(`Questions and answers cleared for: ${uid}`);
  res.redirect("/admin");
});

// Доступ к inject.js для разрешённых пользователей
app.get("/:uid", (req, res) => {
  const uid = req.params.uid;
  if (allowedUsers.includes(uid)) {
    const filePath = path.join(__dirname, "public", "inject.js");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("Файл inject.js не найден");
    }
  } else {
    console.log(`Unauthorized access attempt: ${uid}`);
    res.status(403).send("Нет доступа к этой ссылке");
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(`Server error: ${err.stack}`);
  res.status(500).json({ error: "Что-то пошло не так!" });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
