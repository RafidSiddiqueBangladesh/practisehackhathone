const express = require("express");
const { v4: uuidv4 } = require("uuid");
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// In-memory stores
const members = new Map();
const books = new Map();
const borrowings = new Map();
const reservations = new Map();

/* ------------------------
   Q1: Create Member
------------------------- */
app.post("/api/members", (req, res) => {
  const { member_id, name, age } = req.body;
  if (!member_id || !name || age === undefined) {
    return res.status(400).json({ message: "member_id, name, and age are required" });
  }
  if (members.has(member_id)) {
    return res.status(400).json({ message: `member with id: ${member_id} already exists` });
  }
  if (age < 12) {
    return res.status(400).json({ message: `invalid age: ${age}, must be 12 or older` });
  }
  const newMember = { member_id, name, age, has_borrowed: false };
  members.set(member_id, { ...newMember, history: [] });
  res.status(200).json(newMember);
});

/* ------------------------
   Q2: Get Member Info
------------------------- */
app.get("/api/members/:member_id", (req, res) => {
  const id = parseInt(req.params.member_id);
  if (!members.has(id)) return res.status(404).json({ message: `member with id: ${id} was not found` });
  const { member_id, name, age, has_borrowed } = members.get(id);
  res.json({ member_id, name, age, has_borrowed });
});

/* ------------------------
   Q3: List All Members
------------------------- */
app.get("/api/members", (req, res) => {
  const allMembers = [...members.values()].map(m => ({
    member_id: m.member_id,
    name: m.name,
    age: m.age
  }));
  res.json({ members: allMembers });
});

/* ------------------------
   Q4: Update Member Info
------------------------- */
app.put("/api/members/:member_id", (req, res) => {
  const id = parseInt(req.params.member_id);
  if (!members.has(id)) return res.status(404).json({ message: `member with id: ${id} was not found` });

  const { name, age } = req.body;
  if (age !== undefined && age < 12) return res.status(400).json({ message: `invalid age: ${age}, must be 12 or older` });

  const member = members.get(id);
  if (name) member.name = name;
  if (age) member.age = age;
  members.set(id, member);

  const { member_id, has_borrowed } = member;
  res.json({ member_id, name: member.name, age: member.age, has_borrowed });
});

/* ------------------------
   Q5: Borrow Book
------------------------- */
app.post("/api/borrow", (req, res) => {
  const { member_id, book_id } = req.body;
  if (!members.has(member_id)) return res.status(404).json({ message: `member with id: ${member_id} not found` });
  if (!books.has(book_id)) return res.status(404).json({ message: `book with id: ${book_id} not found` });

  const member = members.get(member_id);
  const book = books.get(book_id);

  if (member.has_borrowed) return res.status(400).json({ message: `member with id: ${member_id} already borrowed a book` });
  if (!book.is_available) return res.status(400).json({ message: `book with id: ${book_id} is not available` });

  const transaction_id = borrowings.size + 1; // simple increment
  const now = new Date();
  const dueDate = new Date(now); dueDate.setDate(now.getDate() + 14);

  const borrowing = {
    transaction_id,
    member_id,
    member_name: member.name,
    book_id,
    book_title: book.title,
    borrowed_at: now.toISOString(),
    due_date: dueDate.toISOString(),
    status: "active"
  };

  borrowings.set(transaction_id, borrowing);
  member.has_borrowed = true;
  member.history.push(borrowing);
  book.is_available = false;

  res.json(borrowing);
});

/* ------------------------
   Q6: Return Book
------------------------- */
app.post("/api/return", (req, res) => {
  const { member_id, book_id } = req.body;
  const member = members.get(member_id);
  if (!member) return res.status(404).json({ message: `member with id: ${member_id} not found` });

  const borrowing = [...borrowings.values()].find(b => b.member_id === member_id && b.book_id === book_id && b.status === "active");
  if (!borrowing) return res.status(400).json({ message: `member with id: ${member_id} has not borrowed book with id: ${book_id}` });

  borrowing.status = "returned";
  borrowing.returned_at = new Date().toISOString();
  member.has_borrowed = false;
  const book = books.get(book_id);
  book.is_available = true;

  res.json(borrowing);
});

/* ------------------------
   Q7: List Borrowed Books
------------------------- */
app.get("/api/borrowed", (req, res) => {
  const borrowed_books = [...borrowings.values()]
    .filter(b => b.status === "active")
    .map(b => ({
      transaction_id: b.transaction_id,
      member_id: b.member_id,
      member_name: b.member_name,
      book_id: b.book_id,
      book_title: b.book_title,
      borrowed_at: b.borrowed_at,
      due_date: b.due_date
    }));
  res.json({ borrowed_books });
});

/* ------------------------
   Q8: Get Borrowing History
------------------------- */
app.get("/api/members/:member_id/history", (req, res) => {
  const id = parseInt(req.params.member_id);
  if (!members.has(id)) return res.status(404).json({ message: `member with id: ${id} was not found` });
  const member = members.get(id);
  const borrowing_history = member.history.map(b => ({
    transaction_id: b.transaction_id,
    book_id: b.book_id,
    book_title: b.book_title,
    borrowed_at: b.borrowed_at,
    returned_at: b.returned_at || null,
    status: b.status
  }));
  res.json({ member_id: id, member_name: member.name, borrowing_history });
});

/* ------------------------
   Q9: Delete Member
------------------------- */
app.delete("/api/members/:member_id", (req, res) => {
  const id = parseInt(req.params.member_id);
  if (!members.has(id)) return res.status(404).json({ message: `member with id: ${id} not found` });
  const member = members.get(id);
  if (member.has_borrowed) return res.status(400).json({ message: `cannot delete member with id: ${id}, member has an active book borrowing` });
  members.delete(id);
  res.json({ message: `member with id: ${id} has been deleted successfully` });
});

/* ------------------------
   Q10: Get Overdue Books
------------------------- */
app.get("/api/overdue", (req, res) => {
  const now = new Date();
  const overdue_books = [...borrowings.values()]
    .filter(b => b.status === "active" && new Date(b.due_date) < now)
    .map(b => ({
      transaction_id: b.transaction_id,
      member_id: b.member_id,
      member_name: b.member_name,
      book_id: b.book_id,
      book_title: b.book_title,
      borrowed_at: b.borrowed_at,
      due_date: b.due_date,
      days_overdue: Math.floor((now - new Date(b.due_date)) / (1000 * 60 * 60 * 24))
    }));
  res.json({ overdue_books });
});

/* ------------------------
   Q11: Add Book
------------------------- */
app.post("/api/books", (req, res) => {
  const { book_id, title, author, isbn } = req.body;
  if (!book_id || !title || !author || !isbn) return res.status(400).json({ message: "book_id, title, author, and isbn are required" });
  if (books.has(book_id)) return res.status(400).json({ message: `book with id: ${book_id} already exists` });
  const newBook = { book_id, title, author, isbn, is_available: true };
  books.set(book_id, newBook);
  res.json(newBook);
});

/* ------------------------
   Q12: Get Book Info
------------------------- */
app.get("/api/books/:book_id", (req, res) => {
  const id = parseInt(req.params.book_id);
  if (!books.has(id)) return res.status(404).json({ message: `book with id: ${id} was not found` });
  res.json(books.get(id));
});

/* ------------------------
   Q15: Delete Book
------------------------- */
app.delete("/api/books/:book_id", (req, res) => {
  const id = parseInt(req.params.book_id);
  if (!books.has(id)) return res.status(404).json({ message: `book with id: ${id} not found` });
  const borrowed = [...borrowings.values()].some(b => b.book_id === id && b.status === "active");
  if (borrowed) return res.status(400).json({ message: `cannot delete book with id: ${id}, book is currently borrowed` });
  books.delete(id);
  res.json({ message: `book with id: ${id} has been deleted successfully` });
});

app.listen(PORT, () => console.log(`Library API running on port ${PORT}`));
