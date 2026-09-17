const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions to read and write database
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      tournaments: [],
      deposits: [],
      settings: { upiId: '', qrCodeUrl: '' }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { users: [], tournaments: [], deposits: [], settings: { upiId: '', qrCodeUrl: '' } };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// User Routes
app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  const db = readDB();
  const existingUser = db.users.find(u => u.phone === phone || u.email === email);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }
  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    phone,
    password,
    wallet: 0,
    joinedTournaments: []
  };
  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  res.json({ success: true, user });
});

app.get('/api/user/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
});

// Tournament Routes
app.get('/api/tournaments', (req, res) => {
  const db = readDB();
  res.json({ success: true, tournaments: db.tournaments });
});

app.post('/api/tournaments', (req, res) => {
  const { title, game, entryFee, prizePool, time, maxPlayers } = req.body;
  const db = readDB();
  const newTournament = {
    id: Date.now().toString(),
    title,
    game,
    entryFee: Number(entryFee),
    prizePool: Number(prizePool),
    time,
    maxPlayers: Number(maxPlayers),
    joinedPlayers: [],
    status: 'Upcoming'
  };
  db.tournaments.push(newTournament);
  writeDB(db);
  res.json({ success: true, tournament: newTournament });
});

app.post('/api/tournaments/join', (req, res) => {
  const { userId, tournamentId, inGameId } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  const tournament = db.tournaments.find(t => t.id === tournamentId);

  if (!user || !tournament) {
    return res.status(404).json({ success: false, message: 'User or Tournament not found' });
  }
  if (user.wallet < tournament.entryFee) {
    return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
  }
  if (tournament.joinedPlayers.some(p => p.userId === userId)) {
    return res.status(400).json({ success: false, message: 'Already joined this tournament' });
  }

  user.wallet -= tournament.entryFee;
  tournament.joinedPlayers.push({ userId, userName: user.name, inGameId });
  user.joinedTournaments.push(tournamentId);

  writeDB(db);
  res.json({ success: true, message: 'Successfully joined tournament', wallet: user.wallet });
});

// Deposit Routes
app.get('/api/deposits', (req, res) => {
  const db = readDB();
  res.json({ success: true, deposits: db.deposits });
});

app.post('/api/deposits', (req, res) => {
  const { userId, userName, amount, utrNumber } = req.body;
  const db = readDB();
  const newDeposit = {
    id: Date.now().toString(),
    userId,
    userName,
    amount: Number(amount),
    utrNumber,
    status: 'Pending',
    date: new Date().toISOString()
  };
  db.deposits.push(newDeposit);
  writeDB(db);
  res.json({ success: true, deposit: newDeposit });
});

app.post('/api/deposits/approve', (req, res) => {
  const { depositId } = req.body;
  const db = readDB();
  const deposit = db.deposits.find(d => d.id === depositId);
  if (!deposit || deposit.status !== 'Pending') {
    return res.status(400).json({ success: false, message: 'Invalid or processed deposit' });
  }
  const user = db.users.find(u => u.id === deposit.userId);
  if (user) {
    user.wallet += deposit.amount;
  }
  deposit.status = 'Approved';
  writeDB(db);
  res.json({ success: true, message: 'Deposit approved' });
});

app.post('/api/deposits/reject', (req, res) => {
  const { depositId } = req.body;
  const db = readDB();
  const deposit = db.deposits.find(d => d.id === depositId);
  if (!deposit || deposit.status !== 'Pending') {
    return res.status(400).json({ success: false, message: 'Invalid deposit' });
  }
  deposit.status = 'Rejected';
  writeDB(db);
  res.json({ success: true, message: 'Deposit rejected' });
});

// Settings Routes
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json({ success: true, settings: db.settings });
});

app.post('/api/settings', (req, res) => {
  const { upiId, qrCodeUrl } = req.body;
  const db = readDB();
  db.settings = { upiId, qrCodeUrl };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

app.listen(PORT, () => {
  console.log(`TMGame Server running on port ${PORT}`);
});
      
