import React, { useEffect, useState, useRef } from 'react';
// If you have sweetalert2 installed, uncomment the next line and use Swal.fire instead of window.alert
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Admin-dashboard.css';
import Select from 'react-select';
import { toAbsolute } from '../utils/url';


// Evidence modal state and renderer for fullscreen evidence viewing

// Uses shared toAbsolute utility for media paths




const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
    // Refs to track previous counts for notifications
    const prevUsersCount = useRef(0);
    const prevComplaintsCount = useRef(0);
  const [activeTab, setActiveTab] = useState('users');
  const [viewComplaint, setViewComplaint] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [complaintFilter, setComplaintFilter] = useState('all');
  const [complaintSearch, setComplaintSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [issueDetailsModalOpen, setIssueDetailsModalOpen] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [requiredActions, setRequiredActions] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [showVerificationHistory, setShowVerificationHistory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedUserCredentials, setSelectedUserCredentials] = useState(null);
  // Credential image modal state and renderer
  const [credentialImageModal, setCredentialImageModal] = useState({ open: false, index: 0 });

  function renderCredentialImageModal() {
  if (!selectedUserCredentials || !credentialImageModal.open) return null;
  const credentials = selectedUserCredentials.credentials || selectedUserCredentials;
  const idx = credentialImageModal.index;
  const cred = credentials[idx];
  if (!cred) return null;
  const rawUrl = typeof cred === 'string' ? cred : cred.url;
  if (!rawUrl) return null;
  const url = toAbsolute(rawUrl);
  const ext = url.split('.').pop().toLowerCase();

    const handlePrev = (e) => {
      e.stopPropagation();
      setCredentialImageModal({ open: true, index: idx === 0 ? credentials.length - 1 : idx - 1 });
    };
    const handleNext = (e) => {
      e.stopPropagation();
      setCredentialImageModal({ open: true, index: idx === credentials.length - 1 ? 0 : idx + 1 });
    };
    const handleClose = (e) => {
      e.stopPropagation();
      setCredentialImageModal({ open: false, index: 0 });
    };

    return (
      <div className="evidence-messenger-overlay" onClick={handleClose}>
        {credentials.length > 1 && (
          <>
            <button className="evidence-messenger-arrow left" onClick={handlePrev} title="Previous">&#10094;</button>
            <button className="evidence-messenger-arrow right" onClick={handleNext} title="Next">&#10095;</button>
          </>
        )}
        <div className="evidence-messenger-modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
          <button className="evidence-messenger-close-modal" onClick={handleClose} title="Close">×</button>
          <div className="evidence-messenger-media">
            {['jpg','jpeg','png','gif','bmp','webp'].includes(ext) ? (
              <img src={url} alt={`Credential ${idx + 1}`} className="evidence-messenger-img" />
            ) : ext === 'pdf' ? (
              <embed src={url} type="application/pdf" className="evidence-messenger-img" />
            ) : (
              <div className="file-preview" style={{ fontSize: 48, padding: 40, color: '#fff' }}>{ext.toUpperCase()}</div>
            )}
          </div>
          <div className="evidence-messenger-footer">
            <span className="evidence-messenger-filename">{url.split('/').pop()}</span>
            {credentials.length > 1 && (
              <span className="evidence-messenger-counter">{idx + 1} of {credentials.length}</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  // In your credential modal, update the image onClick:
  // <img src={url} ... onClick={() => setCredentialImageModal({ open: true, index: idx })} ... />
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [currentCredentialIndex, setCurrentCredentialIndex] = useState(0);
  // Evidence modal state for complaint evidence viewer
  const [evidenceModal, setEvidenceModal] = useState({ open: false, index: 0 });
  // Render the fullscreen evidence modal for complaints
  function renderEvidenceModal() {
    if (!viewComplaint || !viewComplaint.evidence || !evidenceModal.open) return null;
    const evidenceList = (viewComplaint.evidence || []).map(ev => {
      if (!ev) return '';
      if (typeof ev === 'string') return ev;
      if (ev.url) return ev.url;
      return '';
    }).filter(Boolean);
    if (evidenceList.length === 0) return null;
    const idx = evidenceModal.index;
    const file = evidenceList[idx];
  const url = toAbsolute(file);
    const ext = file.split('.').pop().toLowerCase();

    const handlePrev = (e) => {
      e.stopPropagation();
      setEvidenceModal({ open: true, index: idx === 0 ? evidenceList.length - 1 : idx - 1 });
    };
    const handleNext = (e) => {
      e.stopPropagation();
      setEvidenceModal({ open: true, index: idx === evidenceList.length - 1 ? 0 : idx + 1 });
    };
    const handleClose = (e) => {
      e.stopPropagation();
      setEvidenceModal({ open: false, index: 0 });
    };

    return (
      <div className="evidence-messenger-overlay" onClick={handleClose}>
        {/* Arrows absolutely positioned in overlay, outside modal */}
        {evidenceList.length > 1 && (
          <>
            <button className="evidence-messenger-arrow left" onClick={handlePrev} title="Previous">&#10094;</button>
            <button className="evidence-messenger-arrow right" onClick={handleNext} title="Next">&#10095;</button>
          </>
        )}
        <div className="evidence-messenger-modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
          {/* X button absolutely positioned in modal, top right */}
          <button className="evidence-messenger-close-modal" onClick={handleClose} title="Close">×</button>
          <div className="evidence-messenger-media">
            {['jpg','jpeg','png','gif','bmp','webp'].includes(ext) ? (
              <img src={url} alt={`Evidence ${idx + 1}`} className="evidence-messenger-img" />
            ) : ['mp4','avi','mov','wmv','flv','webm'].includes(ext) ? (
              <video src={url} controls className="evidence-messenger-img" style={{ background: '#000' }} />
            ) : ext === 'pdf' ? (
              <embed src={url} type="application/pdf" className="evidence-messenger-img" />
            ) : (
              <div className="file-preview" style={{ fontSize: 48, padding: 40, color: '#fff' }}>{ext.toUpperCase()}</div>
            )}
          </div>
          <div className="evidence-messenger-footer">
            <span className="evidence-messenger-filename">{file.split('/').pop()}</span>
            {evidenceList.length > 1 && (
              <span className="evidence-messenger-counter">{idx + 1} of {evidenceList.length}</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  const navigate = useNavigate();

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: '#ffeaea', textColor: '#e53935' },
    { value: 'in progress', label: 'In Progress', color: '#fffbe6', textColor: '#eab308' },
    { value: 'solved', label: 'Solved', color: '#eaffea', textColor: '#22c55e' },
  ];

  useEffect(() => {
    // Only allow access if admin is logged in
    if (!localStorage.getItem('admin')) {
      navigate('/admin');
      return;
    }
    // Show welcome message on admin login (user-style, top-end toast)
    Swal.fire({
      icon: 'success',
      title: 'Welcome back, Admin!',
      showConfirmButton: false,
      timer: 1000,
      timerProgressBar: true,
      position: 'top-end',
      toast: true,
    });
    // Initial fetch and set previous counts
    const initFetch = async () => {
      const usersRes = await axios.get('https://capstone-sumbong.onrender.com/api/admin/users');
      setUsers(usersRes.data.users);
      prevUsersCount.current = usersRes.data.users.length;
      const complaintsRes = await axios.get('https://capstone-sumbong.onrender.com/api/complaints');
      setComplaints(complaintsRes.data.complaints);
      prevComplaintsCount.current = complaintsRes.data.complaints.length;
    };
    initFetch();
    // Auto-refresh lists every 10 seconds to reflect user profile/photo updates
    const intervalId = setInterval(() => {
      fetchUsers();
      fetchComplaints();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [navigate]);

  useEffect(() => {
    if (viewComplaint) {
      setFeedbackText(viewComplaint.feedback || '');
    }
  }, [viewComplaint]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('https://capstone-sumbong.onrender.com/api/admin/users');
      // Check for new user
      if (prevUsersCount.current && res.data.users.length > prevUsersCount.current) {
        Swal.fire({
          icon: 'info',
          title: 'New user registered!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
          position: 'top-end',
          toast: true,
        });
      }
      setUsers(res.data.users);
      prevUsersCount.current = res.data.users.length;
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to fetch users' });
    }
  };

  const fetchComplaints = async () => {
    try {
      const res = await axios.get('https://capstone-sumbong.onrender.com/api/complaints');
      // Check for new complaint
      if (prevComplaintsCount.current && res.data.complaints.length > prevComplaintsCount.current) {
        Swal.fire({
          icon: 'info',
          title: 'New complaint received!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
          position: 'top-end',
          toast: true,
        });
      }
      setComplaints(res.data.complaints);
      prevComplaintsCount.current = res.data.complaints.length;
    } catch (err) {
      setComplaints([]);
      Swal.fire({ icon: 'error', title: 'Failed to fetch complaints' });
    }
  };

  const verifyUser = async (userId) => {
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/admin/verify/${userId}`);
      fetchUsers();
      Swal.fire({ icon: 'success', title: 'User verified!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to verify user' });
    }
  };

  const disapproveUser = async (userId) => {
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/admin/disapprove/${userId}`);
      fetchUsers();
      Swal.fire({ icon: 'success', title: 'User disapproved!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to disapprove user' });
    }
  };

  const deleteUser = async (userId) => {
    const result = await Swal.fire({
      title: 'Are you sure you want to delete this user?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`https://capstone-sumbong.onrender.com/api/admin/delete/${userId}`);
      fetchUsers();
      Swal.fire({ icon: 'success', title: 'User deleted!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to delete user' });
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Are you sure you want to log out?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    localStorage.removeItem('admin');
    Swal.fire({ icon: 'success', title: 'Logged out!' }).then(() => {
      navigate('/admin');
    });
  };

  const handleStatusChange = async (complaintId, status) => {
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/complaints/${complaintId}/status`, { status });
      fetchComplaints();
      Swal.fire({ icon: 'success', title: 'Status updated!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to update status' });
    }
  };

  const handleSendFeedback = async () => {
    setFeedbackLoading(true);
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/complaints/${viewComplaint._id}/status`, { 
        status: viewComplaint.status,
        feedback: feedbackText 
      });
      setViewComplaint({ ...viewComplaint, feedback: feedbackText });
      fetchComplaints();
      Swal.fire({ icon: 'success', title: 'Feedback sent!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to send feedback' });
    }
    setFeedbackLoading(false);
  };

  const viewCredential = (url, firstName, lastName, userId) => {
    setSelectedCredential({ url, firstName, lastName, userId });
    setCredentialModalOpen(true);
  };

  const viewAllCredentials = (user) => {
    setSelectedUserCredentials(user);
    setCurrentCredentialIndex(0);
    setCredentialsModalOpen(true);
  };

  const closeCredentialsModal = () => {
    setCredentialsModalOpen(false);
    setSelectedUserCredentials(null);
    setCurrentCredentialIndex(0);
  };

  const nextCredential = () => {
    if (selectedUserCredentials && selectedUserCredentials.credentials) {
      setCurrentCredentialIndex((prev) => 
        prev < selectedUserCredentials.credentials.length - 1 ? prev + 1 : 0
      );
    }
  };

  const previousCredential = () => {
    if (selectedUserCredentials && selectedUserCredentials.credentials) {
      setCurrentCredentialIndex((prev) => 
        prev > 0 ? prev - 1 : selectedUserCredentials.credentials.length - 1
      );
    }
  };

  const closeCredentialModal = () => {
    setCredentialModalOpen(false);
    setSelectedCredential(null);
  };

  // New credential verification functions
  const handleApproveCredentials = async (userId) => {
    if (!userId) {
      Swal.fire({ icon: 'error', title: 'Error: User ID not found. Please try again.' });
      return;
    }
    
    setVerificationLoading(true);
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/admin/approve-credentials/${userId}`, {
        adminNotes: adminNotes || 'Credentials verified successfully'
      });
      fetchUsers();
      closeCredentialModal();
      setAdminNotes('');
      Swal.fire({ icon: 'success', title: 'Credentials approved successfully!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to approve credentials', text: err.response?.data?.message || err.message });
    }
    setVerificationLoading(false);
  };

  const handleRejectCredentials = async (userId) => {
    console.log('handleRejectCredentials called with userId:', userId);
    console.log('currentUserId state:', currentUserId);
    
    if (!userId) {
      Swal.fire({ icon: 'error', title: 'Error: User ID not found. Please try again.' });
      return;
    }
    if (!issueDetails.trim()) {
      Swal.fire({ icon: 'warning', title: 'Please provide issue details' });
      return;
    }
    
    setVerificationLoading(true);
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/admin/reject-credentials/${userId}`, {
        issueDetails: issueDetails.trim(),
        adminNotes: adminNotes.trim() || 'Credentials rejected due to issues found',
        requiredActions: requiredActions.trim() || 'Please upload corrected credentials'
      });
      fetchUsers();
      closeIssueDetailsModal();
      setIssueDetails('');
      setAdminNotes('');
      setRequiredActions('');
      Swal.fire({ icon: 'success', title: 'Credentials rejected with issue details!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to reject credentials', text: err.response?.data?.message || err.message });
    }
    setVerificationLoading(false);
  };

  const openIssueDetailsModal = () => {
    console.log('Opening issue details modal for user:', selectedCredential);
    if (selectedCredential && selectedCredential.userId) {
      console.log('User ID:', selectedCredential.userId);
      setCurrentUserId(selectedCredential.userId);
    }
    setIssueDetailsModalOpen(true);
  };

  const openIssueDetailsModalForUser = (userId) => {
    console.log('Opening issue details modal for user ID:', userId);
    setCurrentUserId(userId);
    setIssueDetailsModalOpen(true);
  };

  const closeIssueDetailsModal = () => {
    setIssueDetailsModalOpen(false);
    setIssueDetails('');
    setAdminNotes('');
    setRequiredActions('');
    setCurrentUserId(null);
  };

  const fetchVerificationHistory = async () => {
    try {
      const res = await axios.get('https://capstone-sumbong.onrender.com/api/admin/verification-history');
      setVerificationHistory(res.data.verificationHistory);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to fetch verification history' });
    }
  };

  const handleRequestResubmission = async (userId) => {
    console.log('handleRequestResubmission called with userId:', userId);
    console.log('currentUserId state:', currentUserId);
    
    if (!userId) {
      Swal.fire({ icon: 'error', title: 'Error: User ID not found. Please try again.' });
      return;
    }
    if (!issueDetails.trim()) {
      Swal.fire({ icon: 'warning', title: 'Please provide reason for resubmission' });
      return;
    }
    
    setVerificationLoading(true);
    try {
      await axios.patch(`https://capstone-sumbong.onrender.com/api/admin/request-resubmission/${userId}`, {
        reason: issueDetails.trim(),
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      });
      fetchUsers();
      closeIssueDetailsModal();
      setIssueDetails('');
      setAdminNotes('');
      setRequiredActions('');
      Swal.fire({ icon: 'success', title: 'Resubmission requested successfully!' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to request resubmission', text: err.response?.data?.message || err.message });
    }
    setVerificationLoading(false);
  };

  const pendingCount = complaints.filter(c => c.status === 'pending').length;

  const pendingUsersCount = users.filter(u => !u.approved).length;

  // User summary counts
  const totalUsers = users.length;
  const pendingUsers = users.filter(u => !u.approved).length;
  const approvedUsers = users.filter(u => u.approved).length;
  const rejectedUsers = users.filter(u => (u.verificationStatus || '').toLowerCase() === 'rejected').length;

  // Complaint summary counts
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const inProgressComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'in progress' || (c.status || '').toLowerCase() === 'inprogress').length;
  const solvedComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'solved').length;

  return (
    <div className="admin-root" style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-content">
          <h2>Admin</h2>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            Users
            {pendingUsersCount > 0 && (
              <span className="admin-badge">{pendingUsersCount}</span>
            )}
          </button>
          <button className={activeTab === 'complaints' ? 'active' : ''} onClick={() => setActiveTab('complaints')}>
            Complaints
            {pendingCount > 0 && (
              <span className="admin-badge">{pendingCount}</span>
            )}
          </button>
          <button className={activeTab === 'verification-history' ? 'active' : ''} onClick={() => {
            setActiveTab('verification-history');
            fetchVerificationHistory();
          }}>
            Verification History
          </button>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
      {/* Main Content */}
      <div className="admin-main">
        {activeTab === 'users' && (
          <>
            <h2>Users</h2>
            {/* User Summary Cards */}
            <div className="admin-summary-grid" style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
              <div className="admin-summary-card total">
                <div className="summary-title">Total</div>
                <div className="summary-value">{totalUsers}</div>
              </div>
              <div className="admin-summary-card pending">
                <div className="summary-title">Pending</div>
                <div className="summary-value">{pendingUsers}</div>
              </div>
              <div className="admin-summary-card approved">
                <div className="summary-title">Approved</div>
                <div className="summary-value">{approvedUsers}</div>
              </div>
              <div className="admin-summary-card rejected">
                <div className="summary-title">Rejected</div>
                <div className="summary-value">{rejectedUsers}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Filter by status:</label>
                <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div className="admin-user-search-wrapper">
                <span className="admin-user-search-icon">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="9" cy="9" r="7" stroke="#bfc9d9" strokeWidth="2"/>
                    <line x1="14.4142" y1="14" x2="18" y2="17.5858" stroke="#bfc9d9" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="admin-user-search-input"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Verification Status</th>
            <th>Credentials for Verification</th>
            <th>Admin Notes</th>
            <th>Verify Account</th>
          </tr>
        </thead>
        <tbody>
                {users.filter(user => {
                  // Status filter
                  const statusMatch = userFilter === 'all' ? true :
                    userFilter === 'pending' ? !user.approved :
                    userFilter === 'approved' ? user.approved : true;
                  // Search filter
                  const search = userSearch.trim().toLowerCase();
                  const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                  const email = (user.email || '').toLowerCase();
                  const searchMatch = !search || name.includes(search) || email.includes(search);
                  return statusMatch && searchMatch;
                }).map(user => (
            <tr key={user._id}>
              <td>{user.email}</td>
              <td>{user.firstName} {user.lastName}</td>
              <td>{user.phoneNumber}</td>
              <td>{user.address || 'N/A'}</td>
              <td>
                <span className={`status-badge status-${user.verificationStatus || 'pending'}`}>
                  {user.verificationStatus || 'pending'}
                </span>
                {user.rejectionCount > 0 && (
                  <small style={{ display: 'block', color: '#e53e3e', fontSize: '11px' }}>
                    Rejected {user.rejectionCount} time(s)
                  </small>
                )}
              </td>
                    <td>
                      {user.credentials && user.credentials.length > 0 ? (
                        <button 
                          className="view-credentials-btn"
                          onClick={() => viewAllCredentials(user)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          View {user.credentials.length} Credential{user.credentials.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        'No credentials uploaded'
                      )}
                    </td>
              <td>
                {user.adminNotes ? (
                  <div style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                    <strong>Notes:</strong> {user.adminNotes}
                    {user.issueDetails && (
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#e53e3e' }}>
                        <strong>Issues:</strong> {user.issueDetails}
                      </div>
                    )}
                    {user.requiredActions && (
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#3182ce' }}>
                        <strong>Actions:</strong> {user.requiredActions}
                      </div>
                    )}
                  </div>
                ) : (
                  'No notes'
                )}
              </td>
                    <td>
                      <div className="verify-actions-inner">
                        <button className="action-btn approve-btn" onClick={() => verifyUser(user._id)} disabled={user.approved}>Approve</button>
                        <button className="action-btn disapprove-btn" onClick={() => disapproveUser(user._id)} disabled={!user.approved}>Disapprove</button>
                        <button className="action-btn delete-btn" onClick={() => deleteUser(user._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {activeTab === 'complaints' && (
          <>
            <h2>Complaints</h2>
            {/* Summary Cards */}
            <div className="admin-summary-grid" style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
              <div className="admin-summary-card total">
                <div className="summary-title">Total</div>
                <div className="summary-value">{totalComplaints}</div>
              </div>
              <div className="admin-summary-card pending">
                <div className="summary-title">Pending</div>
                <div className="summary-value">{pendingComplaints}</div>
              </div>
              <div className="admin-summary-card progress">
                <div className="summary-title">In Progress</div>
                <div className="summary-value">{inProgressComplaints}</div>
              </div>
              <div className="admin-summary-card solved">
                <div className="summary-title">Solved</div>
                <div className="summary-value">{solvedComplaints}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Filter by status:</label>
                <select value={complaintFilter} onChange={e => setComplaintFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="in progress">In Progress</option>
                  <option value="solved">Solved</option>
                </select>
              </div>
              <div>
                <div className="admin-user-search-wrapper">
                  <span className="admin-user-search-icon">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="9" r="7" stroke="#bfc9d9" strokeWidth="2"/>
                      <line x1="14.4142" y1="14" x2="18" y2="17.5858" stroke="#bfc9d9" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={complaintSearch}
                    onChange={e => setComplaintSearch(e.target.value)}
                    placeholder="Search by user, email, or type..."
                    className="admin-user-search-input"
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.filter(c => {
                  const statusMatch = complaintFilter === 'all' ? true : c.status === complaintFilter;
                  const search = complaintSearch.trim().toLowerCase();
                  const name = (c.fullName || '').toLowerCase();
                  const email = (c.contact || '').toLowerCase();
                  const type = (c.type || '').toLowerCase();
                  const searchMatch = !search || name.includes(search) || email.includes(search) || type.includes(search);
                  return statusMatch && searchMatch;
                }).map(c => (
                  <tr key={c._id}>
                    <td>{c.fullName || 'Anonymous'}</td>
                    <td>{c.contact || 'N/A'}</td>
                    <td>{c.type}</td>
                    <td>{c.date} {c.time}</td>
                    <td>
                      <Select
                        classNamePrefix="status-rs"
                        value={statusOptions.find(opt => opt.value === c.status)}
                        onChange={opt => handleStatusChange(c._id, opt.value)}
                        options={statusOptions}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: statusOptions.find(opt => opt.value === c.status)?.color,
                            color: statusOptions.find(opt => opt.value === c.status)?.textColor,
                            border: 'none',
                            borderRadius: 6,
                            minHeight: 36,
                            width: 150,
                            boxShadow: state.isFocused ? '0 0 0 2px #2563eb33' : base.boxShadow,
                          }),
                          singleValue: (base, state) => ({
                            ...base,
                            color: statusOptions.find(opt => opt.value === c.status)?.textColor,
                          }),
                          option: (base, state) => {
                            const opt = statusOptions.find(o => o.value === state.data.value);
                            return {
                              ...base,
                              backgroundColor: state.isSelected
                                ? opt.color
                                : state.isFocused
                                  ? '#e0e7ef'
                                  : '#fff',
                              color: opt.textColor,
                              fontWeight: state.isSelected ? 700 : 500,
                            };
                          },
                          menu: base => ({
                            ...base,
                            borderRadius: 8,
                            overflow: 'hidden',
                          }),
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                        }}
                        isSearchable={false}
                      />
                    </td>
                    <td>
                      <button className="action-btn view-btn" onClick={() => setViewComplaint(c)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {activeTab === 'verification-history' && (
          <>
            <h2>Credential Verification History</h2>
            <div style={{ marginBottom: 16 }}>
              <p>This tab shows the complete history of all credential verifications, including approvals, rejections, and resubmission requests.</p>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Verification Status</th>
                  <th>Verification Date</th>
                  <th>Admin Notes</th>
                  <th>Issue Details</th>
                  <th>Required Actions</th>
                  <th>Rejection Count</th>
                </tr>
              </thead>
              <tbody>
                {verificationHistory.map(user => (
                  <tr key={user._id}>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`status-badge status-${user.verificationStatus || 'pending'}`}>
                        {user.verificationStatus || 'pending'}
                      </span>
                    </td>
                    <td>
                      {user.verificationDate ? new Date(user.verificationDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                      {user.adminNotes || 'No notes'}
                    </td>
                    <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                      {user.issueDetails || 'No issues'}
                    </td>
                    <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                      {user.requiredActions || 'No actions required'}
                    </td>
                    <td>
                      {user.rejectionCount || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {verificationHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No verification history found.
              </div>
            )}
          </>
        )}
      </div>
      
      {viewComplaint && (
  <div className="modal-overlay" onClick={() => setViewComplaint(null)}>
    <div className="complaint-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Complaint Details</h3>
        <span
          className={`status-badge status-${viewComplaint.status?.toLowerCase()}`}
          style={{ position: "absolute", top: "20px", right: "70px" }}
        >
          {viewComplaint.status}
        </span>
        <button
          className="modal-close-x"
          onClick={() => setViewComplaint(null)}
          type="button"
          aria-label="Close modal"
        />
      </div>

      <div className="complaint-details-grid">
        <div className="complaint-field">
          <label>Date & Time</label>
          <div className="complaint-value">{viewComplaint.date} {viewComplaint.time}</div>
        </div>
        <div className="complaint-field">
          <label>Type</label>
          <div className="complaint-value">{viewComplaint.type}</div>
        </div>
        <div className="complaint-field">
          <label>Location</label>
          <div className="complaint-value">{viewComplaint.location}</div>
        </div>
        <div className="complaint-field">
          <label>People/Group Involved</label>
          <div className="complaint-value">{viewComplaint.people || "N/A"}</div>
        </div>
      </div>

      <div className="complaint-section">
        <label>Description</label>
        <div className="complaint-value" style={{ maxHeight: 120, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#f9fafb' }}>{viewComplaint.description}</div>
      </div>

      <div className="complaint-section">
        <label>Resolution Requested</label>
        <div className="complaint-value">{viewComplaint.resolution}</div>
      </div>

      <div className="complaint-section">
        <label>Evidence</label>
        {viewComplaint.evidence && viewComplaint.evidence.length > 0 ? (
          <div className="evidence-grid">
            {viewComplaint.evidence.map((file, idx) => {
              const fileUrl = typeof file === 'string' ? file : (file?.url || '');
              if (!fileUrl) return null;
              const url = toAbsolute(fileUrl);
              const ext = fileUrl.split('.').pop().toLowerCase();
              const handleEvidenceClick = () => {
                setEvidenceModal({ open: true, index: idx });
              };
              if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) {
                return (
                  <div key={idx} className="evidence-item">
                    <img src={url} alt={`Evidence ${idx + 1}`} onClick={handleEvidenceClick} style={{ cursor: 'zoom-in' }} />
                    <small>{fileUrl.split('/').pop()}</small>
                  </div>
                );
              } else if (["mp4", "avi", "mov", "wmv", "flv", "webm"].includes(ext)) {
                return (
                  <div key={idx} className="evidence-item">
                    <video src={url} controls onClick={handleEvidenceClick} style={{ cursor: 'zoom-in' }} />
                    <small>{fileUrl.split('/').pop()}</small>
                  </div>
                );
              } else if (ext === "pdf") {
                return (
                  <div key={idx} className="evidence-item">
                    <embed src={url} type="application/pdf" onClick={handleEvidenceClick} style={{ cursor: 'zoom-in' }} />
                    <small>{fileUrl.split('/').pop()}</small>
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="evidence-item">
                    <div className="file-preview" onClick={handleEvidenceClick} style={{ cursor: 'zoom-in' }}>{ext.toUpperCase()}</div>
                    <small>{fileUrl.split('/').pop()}</small>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <p>No evidence uploaded</p>
        )}
        {renderEvidenceModal()}
      </div>

      {/* 🔹 Extra Admin Feature: Feedback */}
      <div className="feedback-section">
        <label><strong>Admin Feedback:</strong></label>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Type feedback for the user..."
        />
        <button 
          onClick={handleSendFeedback} 
          disabled={feedbackLoading}
        >
          {feedbackLoading ? "Sending..." : "Send Feedback"}
        </button>
      </div>
    </div>
  </div>
)}


      {/* All Credentials Modal */}
      {credentialsModalOpen && selectedUserCredentials && (
        <div className="modal-overlay" onClick={closeCredentialsModal}>
          <div className="credentials-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Verification Credentials</h3>
              <button 
                className="modal-close-x" 
                onClick={closeCredentialsModal}
                type="button"
                aria-label="Close modal"
              >
              </button>
            </div>
            <div className="modal-content">
              <div className="credential-info">
                <p><strong>User:</strong> {selectedUserCredentials.firstName} {selectedUserCredentials.lastName}</p>
                <p><strong>Document Type:</strong> Verification Credential</p>
              </div>
              
              <div className="credential-navigation">
                {selectedUserCredentials.credentials.length > 1 && (
                  <>
                    <button 
                      className="nav-btn prev-btn"
                      onClick={previousCredential}
                      disabled={selectedUserCredentials.credentials.length <= 1}
                      title="Previous credential"
                    >
                      ←
                    </button>
                    <span className="credential-counter">
                      {currentCredentialIndex + 1} of {selectedUserCredentials.credentials.length}
                    </span>
                    <button 
                      className="nav-btn next-btn"
                      onClick={nextCredential}
                      disabled={selectedUserCredentials.credentials.length <= 1}
                      title="Next credential"
                    >
                      →
                    </button>
                  </>
                )}
              </div>

              <div className="credential-display">
                {selectedUserCredentials.credentials && selectedUserCredentials.credentials.length > 0 && (
                  <img
                    src={toAbsolute(selectedUserCredentials.credentials[currentCredentialIndex])}
                    alt={`Credential ${currentCredentialIndex + 1}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '500px',
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      cursor: 'pointer'
                    }}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCredentialImageModal({ open: true, index: currentCredentialIndex });
                    }}
                    title="Click to view full screen"
                  />
                )}
              </div>

              <div className="credential-actions">
                <button 
                  className="action-btn approve-btn"
                  onClick={() => handleApproveCredentials(selectedUserCredentials._id)}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? 'Processing...' : 'Credential Looks Valid'}
                </button>
                <button 
                  className="action-btn disapprove-btn"
                  onClick={() => {
                    closeCredentialsModal();
                    openIssueDetailsModalForUser(selectedUserCredentials._id);
                  }}
                  disabled={verificationLoading}
                >
                  Credential Issues Found
                </button>
              </div>
            </div>
            {renderCredentialImageModal()}
          </div>
        </div>
      )}

      {/* Credential View Modal */}
      {credentialModalOpen && selectedCredential && (
        <div className="modal-overlay" onClick={closeCredentialModal}>
          <div className="credential-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Verification Credentials</h3>
              <button 
                className="modal-close-x" 
                onClick={closeCredentialModal}
                type="button"
                aria-label="Close modal"
              >
              </button>
            </div>
            <div className="modal-content">
              <div className="credential-info">
                <p><strong>User:</strong> {selectedCredential.firstName} {selectedCredential.lastName}</p>
                <p><strong>Document Type:</strong> Verification Credential</p>
              </div>
              <div className="credential-display">
                <img 
                  src={toAbsolute(selectedCredential.url)}
                  alt="Verification Credential"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '500px', 
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>
              <div className="credential-actions">
                <button 
                  className="action-btn approve-btn"
                  onClick={() => handleApproveCredentials(selectedCredential.userId)}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? 'Processing...' : 'Credential Looks Valid'}
                </button>
                <button 
                  className="action-btn disapprove-btn"
                  onClick={() => {
                    closeCredentialModal();
                    openIssueDetailsModal();
                  }}
                  disabled={verificationLoading}
                >
                  Credential Issues Found
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Details Modal */}
      {issueDetailsModalOpen && (
        <div className="modal-overlay" onClick={closeIssueDetailsModal}>
          <div className="credential-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Credential Issues Found</h3>
              <button 
                className="modal-close-x" 
                onClick={closeIssueDetailsModal}
                type="button"
                aria-label="Close modal"
              >
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label><strong>Issue Details (Required):</strong></label>
                <textarea
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
                  placeholder="Describe the specific issues found with the credentials..."
                  rows="4"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className="form-group">
                <label><strong>Admin Notes:</strong></label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Additional notes or comments..."
                  rows="3"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className="form-group">
                <label><strong>Required Actions:</strong></label>
                <textarea
                  value={requiredActions}
                  onChange={(e) => setRequiredActions(e.target.value)}
                  placeholder="What actions does the user need to take?"
                  rows="3"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className="credential-issues-actions">
                <button 
                  className="action-btn reject-credentials-btn"
                  onClick={() => handleRejectCredentials(currentUserId)}
                  disabled={verificationLoading || !issueDetails.trim()}
                >
                  {verificationLoading ? 'Processing...' : 'Reject Credentials'}
                </button>
                <button 
                  className="action-btn"
                  onClick={() => handleRequestResubmission(currentUserId)}
                  disabled={verificationLoading || !issueDetails.trim()}
                  style={{ backgroundColor: '#f59e0b', color: 'white' }}
                >
                  {verificationLoading ? 'Processing...' : 'Request Resubmission'}
                </button>
                <button 
                  className="action-btn"
                  onClick={closeIssueDetailsModal}
                  style={{ backgroundColor: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default AdminDashboard;
