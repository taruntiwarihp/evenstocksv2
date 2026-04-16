require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const postRoutes = require('./routes/post');
const getRoutes = require('./routes/get');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/post', postRoutes);
app.use('/api/get', getRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'EvenStocks API Server' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
