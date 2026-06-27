import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { libraryApi, studentsApi } from '../api';
import { usePermissions } from '../hooks/usePermissions';

interface Book {
  book_id: string;
  isbn: string;
  title: string;
  author: string;
  publisher?: string;
  category?: string;
  total_copies: number;
  available_copies: number;
}

interface Loan {
  transaction_id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  isbn: string;
  student_id: string;
  student_name: string;
  issue_date: string;
  due_date: string;
  return_date?: string | null;
  fine_amount: string;
  status: string;
}

interface Student {
  student_id: string;
  person: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  enrollment_number?: string;
}

export default function Library() {
  const { can, role, isStudent, user } = usePermissions();
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'issue' | 'loans' | 'my-loans'>('catalog');
  
  // Loading states
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Form states
  const [newBook, setNewBook] = useState({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    category: '',
    total_copies: 1
  });
  const [issueLoan, setIssueLoan] = useState({
    isbn: '',
    student_id: '',
    days_to_due: 14
  });
  
  // Search / filter states
  const [bookSearch, setBookSearch] = useState('');
  const [loanSearch, setLoanSearch] = useState('');
  
  // Errors & success alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto clear alerts
  const showAlert = (msg: string, isError = true) => {
    if (isError) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  const fetchBooks = () => {
    setLoadingBooks(true);
    libraryApi.books.list()
      .then(r => setBooks(r.data.data ?? []))
      .catch(() => showAlert('Failed to load books catalog'))
      .finally(() => setLoadingBooks(false));
  };

  const fetchLoans = () => {
    if (!can('library.manage')) return;
    setLoadingLoans(true);
    libraryApi.loans.list()
      .then(r => setLoans(r.data.data ?? []))
      .catch(() => showAlert('Failed to load active loans'))
      .finally(() => setLoadingLoans(false));
  };

  const fetchStudentLoans = () => {
    if (!isStudent || !user?.user_id) return;
    setLoadingLoans(true);
    
    // In our system, the student has a student profile student_id which is different from user user_id.
    // Let's resolve the student_id first from their profile, or let the API handle matching by logged-in claims.
    // Let's fetch student profile info from studentsApi list or use a helper to get own student profile.
    studentsApi.list()
      .then(r => {
        const studentList = r.data.data ?? [];
        // Match the student profile whose first name/email matches.
        const ownStudent = studentList.find((s: Student) => s.person?.email === user?.username);
        const sid = ownStudent?.student_id || user?.user_id; // Fallback to user user_id if not found
        
        libraryApi.loans.listStudent(sid)
          .then(r2 => setLoans(r2.data.data ?? []))
          .catch(() => {});
      })
      .catch(() => {
        // If we can't list all students, try fetching by user.user_id directly
        libraryApi.loans.listStudent(user?.user_id ?? '')
          .then(r => setLoans(r.data.data ?? []))
          .catch(() => {});
      })
      .finally(() => setLoadingLoans(false));
  };

  const fetchStudents = () => {
    if (!can('library.manage')) return;
    setLoadingStudents(true);
    studentsApi.list({ limit: 100 })
      .then(r => setStudents(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  };

  useEffect(() => {
    fetchBooks();
    if (can('library.manage')) {
      fetchLoans();
      fetchStudents();
    } else if (isStudent) {
      fetchStudentLoans();
      setActiveTab('my-loans');
    }
  }, [role]);

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('library.manage')) return;
    
    if (!newBook.isbn || !newBook.title || !newBook.author) {
      showAlert('ISBN, Title, and Author are required fields.');
      return;
    }

    libraryApi.books.create(newBook)
      .then(() => {
        showAlert('Book successfully registered to inventory!', false);
        setNewBook({ isbn: '', title: '', author: '', publisher: '', category: '', total_copies: 1 });
        fetchBooks();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to register book');
      });
  };

  const handleIssueBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('library.manage')) return;
    
    if (!issueLoan.isbn || !issueLoan.student_id) {
      showAlert('ISBN and Student ID are required.');
      return;
    }

    libraryApi.loans.issue(issueLoan)
      .then(() => {
        showAlert('Book checked out successfully!', false);
        setIssueLoan({ isbn: '', student_id: '', days_to_due: 14 });
        fetchBooks();
        fetchLoans();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to issue book');
      });
  };

  const handleReturnBook = (transactionId: string) => {
    if (!can('library.manage')) return;
    
    libraryApi.loans.return(transactionId)
      .then((r: any) => {
        const returnedLoan = r.data.data;
        const fine = parseFloat(returnedLoan.fine_amount);
        if (fine > 0) {
          showAlert(`Book returned. A late fine of INR ${fine.toFixed(2)} was generated and posted to student ledger.`, false);
        } else {
          showAlert('Book returned successfully with zero fines.', false);
        }
        fetchBooks();
        fetchLoans();
      })
      .catch((err: any) => {
        showAlert(err.response?.data?.error || 'Failed to return book');
      });
  };

  // Filters
  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.isbn.includes(bookSearch) ||
    (b.category && b.category.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  const filteredLoans = loans.filter(l => 
    l.book_title.toLowerCase().includes(loanSearch.toLowerCase()) ||
    l.student_name.toLowerCase().includes(loanSearch.toLowerCase()) ||
    l.isbn.includes(loanSearch)
  );

  const activeLoansCount = loans.filter(l => l.status === 'Issued').length;

  return (
    <>
      <Header 
        title="Library Management" 
        subtitle={isStudent ? "Search books and view your borrowed log" : "Track inventory registry, loan desk transactions and fines"} 
      />
      <div className="page fade-in">
        
        {/* Banner Alert messages */}
        {error && (
          <div className="alert alert-danger" style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ padding: '0.85rem 1.25rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-success)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', gap: '1rem' }}>
          {isStudent ? (
            <>
              <button 
                onClick={() => setActiveTab('my-loans')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'my-loans' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'my-loans' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                📖 My Borrowings
              </button>
              <button 
                onClick={() => setActiveTab('catalog')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'catalog' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'catalog' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                🔍 Search Books
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setActiveTab('catalog')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'catalog' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'catalog' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                📚 Catalog Inventory
              </button>
              <button 
                onClick={() => setActiveTab('issue')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'issue' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'issue' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                ✍️ Issue Book Desk
              </button>
              <button 
                onClick={() => setActiveTab('loans')} 
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'loans' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'loans' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >
                ⏳ Active Loans & Returns ({activeLoansCount})
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Books Catalog */}
        {activeTab === 'catalog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search by Title, Author, ISBN, Category..." 
                value={bookSearch} 
                onChange={e => setBookSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchBooks}>🔄 Refresh</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {loadingBooks ? (
                <div style={{ color: 'var(--text-secondary)' }}>Loading catalog...</div>
              ) : filteredBooks.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No books match your search.</div>
              ) : filteredBooks.map(book => {
                const isAvailable = book.available_copies > 0;
                return (
                  <div key={book.book_id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                         <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)', fontWeight: 600, padding: '0.25rem 0.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
                          {book.category || 'General'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: isAvailable ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>
                          ● {isAvailable ? `${book.available_copies} of ${book.total_copies} available` : 'Checked Out'}
                        </span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--text-primary)' }}>{book.title}</h3>
                      <p style={{ margin: '0 0 1rem 0', fontStyle: 'italic', fontSize: '0.9rem' }}>by {book.author}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>ISBN: <strong>{book.isbn}</strong></span>
                      {book.publisher && <span>Pub: {book.publisher}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Librarian Add Book form */}
            {can('library.manage') && (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>📚 Register New Book in Inventory</h2>
                <form onSubmit={handleAddBook} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">ISBN *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 978-0131103627" 
                      value={newBook.isbn} 
                      onChange={e => setNewBook({...newBook, isbn: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. The C Programming Language" 
                      value={newBook.title} 
                      onChange={e => setNewBook({...newBook, title: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Author *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Brian W. Kernighan" 
                      value={newBook.author} 
                      onChange={e => setNewBook({...newBook, author: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Publisher</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Prentice Hall" 
                      value={newBook.publisher} 
                      onChange={e => setNewBook({...newBook, publisher: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Computer Science" 
                      value={newBook.category} 
                      onChange={e => setNewBook({...newBook, category: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Copies *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min={1} 
                      max={100} 
                      value={newBook.total_copies} 
                      onChange={e => setNewBook({...newBook, total_copies: parseInt(e.target.value) || 1})} 
                      required 
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary">➕ Register Book</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Issue Desk */}
        {activeTab === 'issue' && can('library.manage') && (
          <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>✍️ Library Check Out Desk</h2>
            <form onSubmit={handleIssueBook} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label className="form-label">Select Student Profile *</label>
                {loadingStudents ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading student records...</span>
                ) : (
                  <select 
                    className="form-input" 
                    value={issueLoan.student_id} 
                    onChange={e => setIssueLoan({...issueLoan, student_id: e.target.value})}
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(st => (
                      <option key={st.student_id} value={st.student_id}>
                        {st.person?.first_name} {st.person?.last_name} ({st.enrollment_number || 'N/A'}) - {st.student_id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  If student does not appear, enter their student ID UUID manually below instead:
                </div>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Manual Student UUID (Optional override)" 
                  value={issueLoan.student_id} 
                  onChange={e => setIssueLoan({...issueLoan, student_id: e.target.value})} 
                  style={{ marginTop: '0.5rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Select Book (ISBN) *</label>
                <select 
                  className="form-input" 
                  value={issueLoan.isbn} 
                  onChange={e => setIssueLoan({...issueLoan, isbn: e.target.value})}
                  required
                >
                  <option value="">-- Choose Book from Available Catalog --</option>
                  {books.filter(b => b.available_copies > 0).map(b => (
                    <option key={b.book_id} value={b.isbn}>
                      {b.title} by {b.author} [ISBN: {b.isbn}]
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Or enter ISBN code manually:
                </div>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ISBN code manual entry" 
                  value={issueLoan.isbn} 
                  onChange={e => setIssueLoan({...issueLoan, isbn: e.target.value})} 
                  style={{ marginTop: '0.5rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Borrow Term (Days until return due) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min={1} 
                  max={90} 
                  value={issueLoan.days_to_due} 
                  onChange={e => setIssueLoan({...issueLoan, days_to_due: parseInt(e.target.value) || 14})} 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                🚀 Check Out Book
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Active Loans registry */}
        {activeTab === 'loans' && can('library.manage') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Filter loans by student name, book title, isbn..." 
                value={loanSearch} 
                onChange={e => setLoanSearch(e.target.value)} 
                style={{ flex: 1, minWidth: 280 }}
              />
              <button className="btn btn-secondary" onClick={fetchLoans}>🔄 Refresh Logs</button>
            </div>

            <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>Book Details</th>
                    <th style={{ padding: '0.75rem' }}>Student Borrower</th>
                    <th style={{ padding: '0.75rem' }}>Issue Date</th>
                    <th style={{ padding: '0.75rem' }}>Due Date</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Late Fees</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLoans ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading transaction registry...
                      </td>
                    </tr>
                  ) : filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No loan records found.
                      </td>
                    </tr>
                  ) : filteredLoans.map(loan => {
                    const isOverdue = loan.status === 'Issued' && new Date(loan.due_date) < new Date();
                    return (
                      <tr key={loan.transaction_id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.1s' }} className="table-row-hover">
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{loan.book_title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{loan.book_author} ({loan.isbn})</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div>{loan.student_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{loan.student_id}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{loan.issue_date}</td>
                        <td style={{ padding: '0.75rem', color: isOverdue ? 'var(--accent-danger)' : 'var(--text-primary)', fontWeight: isOverdue ? 600 : 'normal' }}>
                          {loan.due_date} {isOverdue && '⚠️'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 600, 
                            padding: '0.15rem 0.4rem', 
                            borderRadius: '4px',
                            background: loan.status === 'Returned' ? 'rgba(16, 185, 129, 0.1)' : isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: loan.status === 'Returned' ? 'var(--accent-success)' : isOverdue ? 'var(--accent-danger)' : 'var(--accent-warning)'
                          }}>
                            {loan.status === 'Returned' ? 'Returned' : isOverdue ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {parseFloat(loan.fine_amount) > 0 ? (
                            <strong style={{ color: 'var(--accent-danger)' }}>INR {parseFloat(loan.fine_amount).toFixed(2)}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {loan.status !== 'Returned' && (
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReturnBook(loan.transaction_id)}
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              📥 Return
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Student My Borrowings */}
        {activeTab === 'my-loans' && isStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Summary statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Checked Out Books</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0 0', color: 'var(--accent-primary)' }}>
                  {loans.filter(l => l.status === 'Issued').length}
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Fines Accumulation (Overdue Fines)</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0 0', color: loans.some(l => parseFloat(l.fine_amount) > 0) ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                  INR {loans.reduce((acc, l) => acc + parseFloat(l.fine_amount), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
              <h2 style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>📖 Your Borrowed Loans Log</h2>
              
              {loadingLoans ? (
                <div style={{ color: 'var(--text-secondary)' }}>Loading borrowings...</div>
              ) : loans.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
                  No current or historical book loans recorded. Search the catalog to check out books!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {loans.map(loan => {
                    const isOverdue = loan.status === 'Issued' && new Date(loan.due_date) < new Date();
                    
                    // Late countdown check
                    let warningText = '';
                    if (loan.status === 'Issued') {
                      const diffTime = new Date(loan.due_date).getTime() - new Date().getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) {
                        warningText = `Overdue by ${Math.abs(diffDays)} day(s). Late return fine is active.`;
                      } else if (diffDays <= 3) {
                        warningText = `Due in ${diffDays} day(s). Please return soon.`;
                      } else {
                        warningText = `${diffDays} days remaining until return due.`;
                      }
                    }

                    return (
                      <div 
                        key={loan.transaction_id} 
                        style={{ 
                          padding: '1.25rem', 
                          border: isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                          background: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{loan.book_title}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>by {loan.book_author}</p>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            <span>ISBN: {loan.isbn}</span>
                            <span>Issued: {loan.issue_date}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              padding: '0.15rem 0.4rem', 
                              borderRadius: '4px',
                              background: loan.status === 'Returned' ? 'rgba(16, 185, 129, 0.15)' : isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: loan.status === 'Returned' ? 'var(--accent-success)' : isOverdue ? 'var(--accent-danger)' : 'var(--accent-warning)'
                            }}>
                              {loan.status === 'Returned' ? 'Returned' : isOverdue ? 'Overdue' : 'Active'}
                            </span>
                            
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              Due Date: {loan.due_date}
                            </span>
                          </div>

                          {warningText && (
                            <span style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--accent-danger)' : 'var(--accent-warning)', fontWeight: 600 }}>
                              {isOverdue ? '⚠️ ' : '⏳ '}{warningText}
                            </span>
                          )}

                          {parseFloat(loan.fine_amount) > 0 && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--accent-danger)' }}>
                              Pending late return fine: <strong>INR {parseFloat(loan.fine_amount).toFixed(2)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
