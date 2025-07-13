const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

const allowedUsers = ["u1", "u2", "mohir"];
const adminLogin = "psiblame";
const adminPassword = "m0H1r_top";

const questions = {};
const answers = {};

app.use(cors()); // Включаем CORS для кросс-доменных запросов
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Корневой маршрут
app.get("/", (req, res) => {
  res.send("Сервер работает! Доступные маршруты: /:uid, /admin, /manual-review, /get-answer/:questionID");
});

// Basic-авторизация для /admin
app.use("/admin", (req, res, next) => {
  const auth = req.headers.authorization;
  console.log(`Authorization header: ${auth}`); // Логируем заголовок для диагностики

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
  console.log(`Login attempt: ${login}`); // Логируем логин

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
        </style>
      </head>
      <body>
        <h2>Админ-панель — Вопросы</h2>
    `;
    for (const [id, q] of Object.entries(questions)) {
      html += `
        <div class="question">
          <strong>ID:</strong> ${id}<br>
          <form method="POST" action="/answer">
            <textarea name="id" hidden>${id}</textarea>
            ${q.imageUrl ? `<img src="${q.imageUrl}" alt="Question image"><br>` : ""}
            <div class="question-content">${q.html}</div>
            <input name="answer" placeholder="Введите ответ (напр. A)" required>
            <button type="submit">Отправить</button>
          </form>
        </div>
      `;
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
  const { id, answer } = req.body;
  if (!id || !answer) {
    return res.status(400).json({ error: "Отсутствует id или answer" });
  }
  answers[id] = answer.toUpperCase();
  res.redirect("/admin");
});

// Получение вопроса
app.post("/manual-review", (req, res) => {
  const { questionID, questionHTML, imageUrl } = req.body;
  if (!questionID || !questionHTML) {
    return res.status(400).json({ error: "Отсутствует questionID или questionHTML" });
  }
  questions[questionID] = { html: questionHTML, imageUrl };
  console.log(`Question received: ${questionID}`); // Логируем получение вопроса
  res.status(200).json({ message: "Вопрос успешно сохранён", questionID });
});

// Отправка ответа
app.get("/get-answer/:questionID", (req, res) => {
  const { questionID } = req.params;
  const answer = answers[questionID] || null;
  res.json({ answer });
});

// Доступ к inject.js для разрешённых пользователей (последний маршрут!)
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
