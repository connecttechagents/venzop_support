import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.send('Venzop Backend API is running!');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `http://localhost:3001/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.post('/api/machines', async (req, res) => {
  const { location } = req.body;
  try {
    const machine = await prisma.machine.create({
      data: { location }
    });
    res.json(machine);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

app.get('/api/machines/:id', async (req, res) => {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: req.params.id }
    });
    if (!machine) return res.status(404).json({ error: 'Machine not found' });
    res.json(machine);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch machine' });
  }
});

app.post('/api/tickets', async (req, res) => {
  const { machineId, mobileNumber } = req.body;
  try {
    let user = await prisma.user.findUnique({ where: { mobileNumber } });
    if (!user) {
      user = await prisma.user.create({
        data: { mobileNumber, role: 'CUSTOMER' }
      });
    }

    let machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) {
      // Auto-create machine for testing purposes if it doesn't exist
      machine = await prisma.machine.create({
        data: { id: machineId, location: 'Unknown Location' }
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        machineId,
        customerId: user.id,
        status: 'OPEN'
      }
    });

    res.json(ticket);
  } catch (error: any) {
    console.error('Ticket creation error:', error);
    res.status(500).json({ error: 'Failed to create ticket', details: error?.message || String(error) });
  }
});

app.get('/api/tickets/:id/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { ticketId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: { sender: true }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { machine: true, customer: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  const { status, agentId } = req.body;
  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(agentId && { agentId })
      }
    });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});


// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_ticket', (ticketId) => {
    socket.join(ticketId);
    console.log(`Socket ${socket.id} joined ticket ${ticketId}`);
  });

  socket.on('send_message', async (data) => {
    const { ticketId, senderId, text, imageUrl } = data;
    try {
      // Auto-create agent/user if it doesn't exist to prevent FK errors
      let user = await prisma.user.findUnique({ where: { id: senderId } });
      if (!user) {
        user = await prisma.user.create({
          data: { id: senderId, role: 'AGENT', name: 'Support Agent' }
        });
      }

      const message = await prisma.message.create({
        data: { ticketId, senderId, text: text || '', imageUrl },
        include: { sender: true }
      });
      
      io.to(ticketId).emit('receive_message', message);

      // Simple Auto-Reply Logic for Customers
      if (message.sender.role === 'CUSTOMER') {
        // If it's the first message, show the menu
        const count = await prisma.message.count({ where: { ticketId } });
        if (count === 1) {
          setTimeout(async () => {
            // Find or create a BOT user
            let botUser = await prisma.user.findFirst({ where: { role: 'BOT' } });
            if (!botUser) {
              botUser = await prisma.user.create({ data: { role: 'BOT', name: 'Auto-Reply' } });
            }

            const menuMessage = await prisma.message.create({
              data: {
                ticketId,
                senderId: botUser.id,
                text: "Hi! Welcome to Venzop Support. Please select your issue:\n1. Payment failed but amount deducted.\n2. Item stuck and not dispensed.\n3. QR code unreadable.\n4. Other"
              },
              include: { sender: true }
            });
            io.to(ticketId).emit('receive_message', menuMessage);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
