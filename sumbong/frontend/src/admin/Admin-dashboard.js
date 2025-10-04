import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
// If you have sweetalert2 installed, uncomment the next line and use Swal.fire instead of window.alert
import Swal from 'sweetalert2';
import axios from 'axios';
import adminApi from '../api/adminApi';
import { useNavigate } from 'react-router-dom';
import './Admin-dashboard.css';
import Select from 'react-select';
import { toAbsolute } from '../utils/url';
import { API_BASE } from '../config/apiBase';
import LoadingOverlay from '../components/LoadingOverlay';
import InlineButtonSpinner from '../components/InlineButtonSpinner';
import NotificationBell from '../components/NotificationBell';
import NotificationDropdown from '../components/NotificationDropdown';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications } from '../api/notificationsApi';


// Evidence modal state and renderer for fullscreen evidence viewing

// Uses shared toAbsolute utility for media paths




const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
    // Refs to track previous counts for notifications
    const prevUsersCount = useRef(0);
    const prevComplaintsCount = useRef(0);
  const [activeTab, setActiveTab] = useState('users');
  const [viewComplaint, setViewComplaint] = useState(null);
  // Ref mirror of viewComplaint to avoid stale closure inside SSE handler
  const viewComplaintRef = useRef(null);
  useEffect(()=>{ viewComplaintRef.current = viewComplaint; }, [viewComplaint]);
  const threadListRef = useRef(null);
  const [threadLastRead, setThreadLastRead] = useState({});
  // Basic one-shot scroll (kept for internal calls)
  const scrollThreadToBottom = () => {
    const el = threadListRef.current;
    if (!el) return;
    try { el.scrollTop = el.scrollHeight; } catch {}
  };
  // Reliable multi-attempt scrolling (handles late layout/media)
  const scrollThreadToBottomReliable = (attempts = 5) => {
    const el = threadListRef.current;
    if (!el) return;
    try { el.scrollTop = el.scrollHeight; } catch {}
    if (attempts > 1) {
      setTimeout(() => scrollThreadToBottomReliable(attempts - 1), 40);
    }
  };
  // Legacy single feedback field removed; using threaded messages only
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  // Threaded feedback state
  const [threadMessage, setThreadMessage] = useState('');
  const [postingThreadMsg, setPostingThreadMsg] = useState(false);
  const eventSourceRef = useRef(null);
  // Try multiple possible keys for stored admin info for robustness
  const adminUser = (() => {
    try {
      const raw = localStorage.getItem('adminUser') || localStorage.getItem('admin') || '{}';
      return JSON.parse(raw);
    } catch { return {}; }
  })();
  const [complaintFilter, setComplaintFilter] = useState('all');
  // New: filters for complaints and history
  const [complaintTypeFilter, setComplaintTypeFilter] = useState('all');
  const [complaintDateFilter, setComplaintDateFilter] = useState('all'); // all|today|7|30|this-month|last-month|custom
  const [complaintDateFrom, setComplaintDateFrom] = useState('');
  const [complaintDateTo, setComplaintDateTo] = useState('');
  const [historyComplaints, setHistoryComplaints] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  // Analytics date filter
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState('all');
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState('');
  const [analyticsDateTo, setAnalyticsDateTo] = useState('');
  const [complaintSearch, setComplaintSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [issueDetailsModalOpen, setIssueDetailsModalOpen] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [requiredActions, setRequiredActions] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [showVerificationHistory, setShowVerificationHistory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedUserCredentials, setSelectedUserCredentials] = useState(null);
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifLimit, setNotifLimit] = useState(30);
  // Version counter to invalidate stale async notification fetch responses
  const notifFetchVersion = useRef(0);
  const notifDropdownRef = useRef(null);
  const bellButtonRef = useRef(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  // Credential image modal state and renderer
  const [credentialImageModal, setCredentialImageModal] = useState({ open: false, index: 0 });
  // Helper: safely extract a raw URL from mixed credential representations (string or {url,...})
  const extractCredentialUrl = (cred) => {
    if (!cred) return '';
    if (typeof cred === 'string') return cred;
    if (cred.url) return cred.url;
    return '';
  };

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
  // Router navigate (moved up so all hooks run every render before any conditional UI)
  const navigate = useNavigate();
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
  // Removed early return to satisfy Rules of Hooks; render loading overlay conditionally instead.
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: '#ffeaea', textColor: '#e53935' },
    { value: 'in progress', label: 'In Progress', color: '#fffbe6', textColor: '#eab308' },
    { value: 'solved', label: 'Solved', color: '#eaffea', textColor: '#22c55e' },
  ];

  useEffect(() => {
    // Only allow access if admin token & flag present
    if (!localStorage.getItem('token') || localStorage.getItem('isAdmin') !== 'true') {
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
  const usersRes = await adminApi.get('/api/admin/users');
      setUsers(usersRes.data.users);
      prevUsersCount.current = usersRes.data.users.length;
  const complaintsRes = await adminApi.get('/api/complaints');
      setComplaints(complaintsRes.data.complaints);
      prevComplaintsCount.current = complaintsRes.data.complaints.length;
    };
    initFetch();
    // Initial notifications load
    const loadNotifs = async () => {
      setNotifLoading(true);
      const currentVersion = ++notifFetchVersion.current;
      try {
        const list = await fetchNotifications({ limit: notifLimit });
        if (currentVersion === notifFetchVersion.current) {
          setNotifications(list);
        }
      } catch (e) { /* ignore */ }
      if (currentVersion === notifFetchVersion.current) setNotifLoading(false);
    };
    loadNotifs();

    // Establish SSE for admin to receive updates (re-using user channel - plus admin_notification events)
    if (adminUser && adminUser._id && !eventSourceRef.current) {
  const es = new EventSource(`${API_BASE}/api/realtime/${adminUser._id}`);
      eventSourceRef.current = es;
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (!data || !data.type) return;
          try { console.log('[Admin SSE]', data.type, data); } catch {}
          if (data.type === 'status_update') {
            // Light refetch for status changes
            fetchComplaints();
            return;
          }
          if (data.type === 'feedback_thread_update' && data.complaintId && data.entry) {
            try { console.log('[SSE:admin] feedback_thread_update received', data); } catch {}
            // Merge into complaints list directly (no full refetch needed for each message)
            setComplaints(prev => prev.map(c => {
              if (c._id !== data.complaintId) return c;
              const existing = Array.isArray(c.feedbackEntries) ? c.feedbackEntries : [];
              const dup = existing.some(e => e.createdAt === data.entry.createdAt && e.message === data.entry.message && e.authorType === data.entry.authorType);
              if (dup) return c;
              return { ...c, feedbackEntries: [...existing, data.entry], feedback: c.feedback };
            }));
            // If modal open for this complaint, merge there too (use ref to prevent stale capture)
            const openNow = viewComplaintRef.current;
            if (openNow && openNow._id === data.complaintId) {
              setViewComplaint(prev => {
                if (!prev) return prev;
                const existing = Array.isArray(prev.feedbackEntries) ? prev.feedbackEntries : [];
                const dup = existing.some(e => e.createdAt === data.entry.createdAt && e.message === data.entry.message && e.authorType === data.entry.authorType);
                if (dup) return prev;
                return { ...prev, feedbackEntries: [...existing, data.entry], feedback: prev.feedback };
              });
              // Mark last read (always update since admin is looking at it)
              try {
                const ts = new Date(data.entry.createdAt).getTime();
                setThreadLastRead(prev => ({ ...prev, [data.complaintId]: ts }));
              } catch {}
              // Near-bottom detection to avoid yanking if admin scrolled up
              setTimeout(() => {
                const el = threadListRef.current;
                if (!el) return;
                const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
                const threshold = 100;
                if (distance <= threshold || data.entry.authorType === 'admin') {
                  scrollThreadToBottom();
                }
              }, 40);
            }
            if (data.entry.authorType === 'user') {
              try { console.log('[SSE:admin] user entry notification toast triggered'); } catch {}
              const actor = viewComplaintRef.current && viewComplaintRef.current.fullName ? viewComplaintRef.current.fullName : 'User';
              const shortMsg = data.entry.message.length > 90 ? data.entry.message.slice(0,90)+'…' : data.entry.message;
              Swal.fire({
                title: `${actor} replied`,
                text: shortMsg,
                icon: 'info',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4500,
                timerProgressBar: true
              });
            }
          }
          if (data.type === 'admin_notification' && data.notification) {
            try { console.log('[Admin SSE] admin_notification received', data.notification); } catch {}
            setNotifications(prev => {
              const exists = prev.some(n => n._id === data.notification._id);
              if (exists) return prev;
              return [data.notification, ...prev].sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).slice(0,300);
            });
          }
        } catch (e) { /* ignore malformed event */ }
      };
      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
    }
    // Auto-refresh lists every 10 seconds to reflect user profile/photo updates
    const intervalId = setInterval(() => {
      fetchUsers();
      fetchComplaints();
    }, 10000);

    // Fallback notification polling (SSE reconciliation)
    const notifPoll = setInterval(async () => {
      const currentVersion = ++notifFetchVersion.current;
      try {
        const latest = await fetchNotifications({ limit: notifLimit });
        if (currentVersion !== notifFetchVersion.current) return; // stale
        setNotifications(prev => {
          const prevIds = new Set(prev.map(p=>p._id));
          const changed = latest.some(n=>!prevIds.has(n._id)) || prev.length !== latest.length;
          return changed ? latest : prev;
        });
      } catch { /* ignore */ }
    }, 20000);
    return () => clearInterval(intervalId);
  }, [navigate]);

  // Removed legacy feedback sync effect (summary field deprecated)

  const fetchUsers = async () => {
    try {
  const res = await adminApi.get('/api/admin/users');
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
  const res = await adminApi.get('/api/complaints');
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
      // Initialize last-read for new complaints
      setThreadLastRead(prev => {
        const merged = { ...prev };
        (res.data.complaints || []).forEach(c => {
          if (!(c._id in merged)) {
            const entries = c.feedbackEntries || [];
            merged[c._id] = entries.length ? new Date(entries[entries.length - 1].createdAt).getTime() : 0;
          }
        });
        return merged;
      });
      prevComplaintsCount.current = res.data.complaints.length;
    } catch (err) {
      setComplaints([]);
      Swal.fire({ icon: 'error', title: 'Failed to fetch complaints' });
    }
  };

  // Helpers: date range compute and filter predicate
  const getDateRange = (preset) => {
    const now = new Date();
    let start = null, end = null;
    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case '7':
        end = now;
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30':
        end = now;
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      default:
        break;
    }
    return { start, end };
  };

  const withinRange = (isoDateStr, preset, fromStr, toStr) => {
    if (!preset || preset === 'all') return true;
    let dateObj = null;
    if (isoDateStr) {
      // complaints may store date/time separately like 'YYYY-MM-DD' and 'HH:mm'
      // For admin table we pass either combined ISO or just date string
      dateObj = new Date(isoDateStr);
      if (Number.isNaN(dateObj.getTime())) return true; // if unparsable, don't filter out
    }
    if (preset === 'custom') {
      if (!fromStr && !toStr) return true;
      const from = fromStr ? new Date(fromStr) : null;
      const to = toStr ? new Date(toStr + 'T23:59:59.999') : null;
      if (from && dateObj < from) return false;
      if (to && dateObj > to) return false;
      return true;
    }
    const { start, end } = getDateRange(preset);
    if (!start || !end || !dateObj) return true;
    return dateObj >= start && dateObj <= end;
  };

  // Format a human-readable date range label for analytics CSV/reporting
  const analyticsRangeLabel = () => {
    if (!analyticsDateFilter || analyticsDateFilter === 'all') return 'All time';
    if (analyticsDateFilter === 'custom') {
      const from = analyticsDateFrom || '';
      const to = analyticsDateTo || '';
      if (!from && !to) return 'All time';
      return `${from || '—'} to ${to || '—'}`;
    }
    const { start, end } = getDateRange(analyticsDateFilter) || {};
    if (!start || !end) return 'All time';
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `${fmt(start)} to ${fmt(end)}`;
  };

  // Download Analytics as CSV based on current filter and visible metrics
  const downloadAnalyticsCSV = () => {
    try {
      const usersFiltered = (users || []).filter(u => {
        if (u && u.isAdmin) return false;
        const candidate = u.verificationDate || u.createdAt || u.updatedAt || null;
        return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
      });
      const complaintsFiltered = (complaints || []).filter(c => {
        const candidate = (c.date && c.time) ? `${c.date}T${c.time}` : (c.createdAt || c.updatedAt || c.deletedAt || null);
        return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
      });

      const approvedUsers = usersFiltered.filter(u => u.approved).length;
      const rejectedUsers = usersFiltered.filter(u => (u.verificationStatus||'').toLowerCase()==='rejected').length;
      const pendingUsersCalc = Math.max(0, usersFiltered.length - approvedUsers - rejectedUsers);

      const pendingComplaintsCalc = complaintsFiltered.filter(c => (c.status||'').toLowerCase()==='pending').length;
      const inProgComplaintsCalc = complaintsFiltered.filter(c => {
        const s = (c.status||'').toLowerCase();
        return s==='in progress' || s==='inprogress';
      }).length;
      const solvedComplaintsCalc = complaintsFiltered.filter(c => (c.status||'').toLowerCase()==='solved').length;

      const csvEscape = (val) => {
        const s = String(val ?? '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const needs = /[",\n]/.test(s);
        const escaped = s.replace(/"/g, '""');
        return needs ? `"${escaped}"` : escaped;
      };

      const rows = [
        ['Report', 'Analytics Summary'],
        ['Generated At', new Date().toLocaleString()],
        ['Date Range', analyticsRangeLabel()],
        [],
        ['Users Total', usersFiltered.length],
        ['Users Approved', approvedUsers],
        ['Users Pending', pendingUsersCalc],
        ['Users Rejected', rejectedUsers],
        [],
        ['Complaints Total', complaintsFiltered.length],
        ['Complaints Pending', pendingComplaintsCalc],
        ['Complaints In Progress', inProgComplaintsCalc],
        ['Complaints Solved', solvedComplaintsCalc],
      ];

      const csv = rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date();
      const y = ts.getFullYear();
      const m = String(ts.getMonth()+1).padStart(2, '0');
      const d = String(ts.getDate()).padStart(2, '0');
      const hh = String(ts.getHours()).padStart(2, '0');
      const mm = String(ts.getMinutes()).padStart(2, '0');
      a.href = url;
      a.download = `analytics-report-${y}${m}${d}-${hh}${mm}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Failed to export CSV' });
    }
  };

  const fetchComplaintHistory = async () => {
    try {
      setHistoryLoading(true);
      try {
        // Primary: dedicated history endpoint
        const res = await adminApi.get('/api/admin/complaints/history');
        let history = res.data.complaints || [];
        // Also include solved complaints in history view
        let baseComplaints = complaints;
        if (!baseComplaints || baseComplaints.length === 0) {
          try {
            const latest = await adminApi.get('/api/complaints');
            baseComplaints = latest.data.complaints || [];
          } catch { /* ignore */ }
        }
        const solved = (baseComplaints || []).filter(c => (c.status || '').toLowerCase() === 'solved');
        const dedup = new Map();
        [...history, ...solved].forEach(c => { if (c && c._id) dedup.set(c._id, c); });
        setHistoryComplaints(Array.from(dedup.values()));
      } catch (err1) {
        // Fallback: includeDeleted=1 and client-side filter if backend hasn't been redeployed yet
        try {
          const res2 = await adminApi.get('/api/complaints?includeDeleted=1');
          const all = res2.data.complaints || [];
          const onlyDeleted = all.filter(c => c.isDeletedByUser);
          const solved = all.filter(c => (c.status || '').toLowerCase() === 'solved');
          const dedup = new Map();
          [...onlyDeleted, ...solved].forEach(c => { if (c && c._id) dedup.set(c._id, c); });
          setHistoryComplaints(Array.from(dedup.values()));
          // Surface that we're using a fallback so you know backend deploy is pending
          Swal.fire({ icon: 'info', title: 'Using fallback for history', text: 'Backend history endpoint not available yet; showing filtered list instead.' });
        } catch (err2) {
          setHistoryComplaints([]);
          const msg = err2?.response?.data?.message || err1?.response?.data?.message || err2?.message || 'Failed to fetch complaint history';
          Swal.fire({ icon: 'error', title: 'Fetch failed', text: msg });
        }
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const verifyUser = async (userId) => {
    try {
  await adminApi.patch(`/api/admin/verify/${userId}`);
      fetchUsers();
      Swal.fire({
        icon: 'success',
        title: 'User verified',
        timer: 650,
        showConfirmButton: false,
        timerProgressBar: true,
        position: 'center'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to verify user',
        timer: 1100,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }
  };

  const disapproveUser = async (userId) => {
    try {
  await adminApi.patch(`/api/admin/disapprove/${userId}`);
      fetchUsers();
      Swal.fire({
        icon: 'success',
        title: 'User disapproved',
        timer: 650,
        showConfirmButton: false,
        timerProgressBar: true,
        position: 'center'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to disapprove user',
        timer: 1100,
        showConfirmButton: false,
        timerProgressBar: true
      });
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
  await adminApi.delete(`/api/admin/delete/${userId}`);
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
    try {
      // Clear all possible admin/session keys
      localStorage.removeItem('admin');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('isAdmin');
      // If token should be distinct for admin vs user, remove token to force re-auth
      localStorage.removeItem('token');
      // Optional: clear any cached notifications state keys if pattern used
      Object.keys(localStorage).forEach(k => {
        if (/^notifications_/i.test(k) || /^notif_last_seen_/i.test(k)) {
          try { localStorage.removeItem(k); } catch {}
        }
      });
    } catch {}
    Swal.fire({
      icon: 'success',
      title: 'Logged out',
      showConfirmButton: false,
      timer: 700,
      timerProgressBar: true,
      position: 'top-end',
      toast: true,
      didClose: () => navigate('/admin/login')
    });
  };

  // Notification interactions
  const toggleNotifications = () => setNotifOpen(o => !o);
  useEffect(() => {
    function handleClickOutside(e) {
      if (!notifOpen) return;
      const dropdown = notifDropdownRef.current;
      const bell = bellButtonRef.current;
      if (dropdown && !dropdown.contains(e.target) && bell && !bell.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const handleSelectNotification = async (n) => {
    // Mark read locally + server
    if (!n.read) {
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
      try { await markNotificationRead(n._id); } catch { /* ignore */ }
    }
    // Navigate based on entityType
    if (n.entityType === 'complaint') {
      // Attempt to open complaint modal if already in complaints tab
      setActiveTab('complaints');
      // Lazy fetch if not loaded yet
      if (!complaints.length) await fetchComplaints();
      const found = complaints.find(c => c._id === n.entityId);
      if (found) setViewComplaint(found);
      else {
        // fallback full refetch then open
        await fetchComplaints();
        const again = complaints.find(c => c._id === n.entityId);
        if (again) setViewComplaint(again);
      }
    } else if (n.entityType === 'user') {
      setActiveTab('users');
      // highlight? For simplicity, maybe filter or scroll later.
    }
  };

  const handleMarkAll = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
  };

  const handleMarkSingle = async (id) => {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    try { await markNotificationRead(id); } catch { /* ignore */ }
  };

  const handleDeleteNotification = async (id) => {
    // Optimistic remove
    setNotifications(prev => prev.filter(n => n._id !== id));
    try { await deleteNotification(id); } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    const result = await Swal.fire({
      title: 'Clear all notifications?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear',
      cancelButtonText: 'Cancel',
      toast: false
    });
    if (!result.isConfirmed) return;
    const backup = notifications; // fallback if API call fails
    // Invalidate in-flight fetches so stale responses can't repopulate list
    notifFetchVersion.current++;
    setNotifications([]);
    try {
      const resp = await clearAllNotifications();
      if (!resp || resp.remaining > 0) {
        // Some still remain – refetch to stay accurate
        notifFetchVersion.current++;
        const list = await fetchNotifications({ limit: notifLimit });
        setNotifications(list);
        Swal.fire({ icon: 'warning', title: 'Some notifications could not be cleared' });
      }
    } catch (e) {
      setNotifications(backup);
      const msg = e?.response?.data?.message || 'Failed to clear notifications';
      Swal.fire({ icon: 'error', title: msg });
    }
  };

  const handleLoadMore = async () => {
    const newLimit = notifLimit + 30;
    setNotifLimit(newLimit);
    const currentVersion = ++notifFetchVersion.current;
    try {
      const list = await fetchNotifications({ limit: newLimit });
      if (currentVersion === notifFetchVersion.current) setNotifications(list);
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (complaintId, status) => {
    try {
  await adminApi.patch(`/api/complaints/${complaintId}/status`, { status });
      fetchComplaints();
      if ((status || '').toLowerCase() === 'solved') {
        // Ensure history reflects newly solved items
        fetchComplaintHistory();
      }
      Swal.fire({
        icon: 'success',
        title: 'Status updated!',
        timer: 500,
        showConfirmButton: false,
        timerProgressBar: true,
        position: 'center',
        didOpen: (popup) => {
          // Optional subtle progress feel
          popup.addEventListener('mouseenter', Swal.stopTimer);
          popup.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to update status',
        timer: 800,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }
  };

  // handleSendFeedback removed (legacy summary feedback deprecated)
  const unreadForComplaint = (c) => {
    try {
      const lastRead = threadLastRead[c._id] || 0;
      const entries = c.feedbackEntries || [];
      return entries.filter(e => e.authorType === 'user' && new Date(e.createdAt).getTime() > lastRead).length;
    } catch { return 0; }
  };

  // Reconcile open complaint with master list (in case SSE merged there first)
  useEffect(() => {
    if (!viewComplaintRef.current) return;
    const latest = complaints.find(c => c._id === viewComplaintRef.current._id);
    if (!latest) return;
    const openEntries = (viewComplaintRef.current.feedbackEntries || []).length;
    const latestEntries = (latest.feedbackEntries || []).length;
    if (openEntries !== latestEntries) {
      setViewComplaint(prev => prev && prev._id === latest._id ? { ...latest, feedback: prev.feedback } : prev);
      setTimeout(() => {
        const el = threadListRef.current;
        if (!el) return;
        const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
        if (distance < 5) scrollThreadToBottom();
      }, 30);
    }
  }, [complaints]);

  // Post threaded feedback entry
  const postThreadMessage = async () => {
    if (!threadMessage.trim()) return;
    setPostingThreadMsg(true);
    try {
      const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/api/complaints/${viewComplaint._id}/feedback-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: threadMessage.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed');
      setThreadMessage('');
      // Preserve existing summary feedback (do not let thread post overwrite it)
      setViewComplaint(prev => {
        if (!prev) return data.complaint;
        return { ...data.complaint, feedback: prev.feedback };
      });
      // Also update complaints list preserving summary feedback
      setComplaints(prev => prev.map(c => {
        if (c._id === data.complaint._id) {
          return { ...data.complaint, feedback: c.feedback };
        }
        return c;
      }));
      // Scroll after paint
      setTimeout(scrollThreadToBottom, 50);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Failed to post entry' });
    }
    setPostingThreadMsg(false);
  };

  // Force scroll to bottom on every modal open using layout phase + rAF retries
  useLayoutEffect(() => {
    if (!viewComplaint) return;
    // Mark last read immediately (admin viewing newest)
    try {
      const entries = viewComplaint.feedbackEntries || [];
      if (entries.length) {
        const latestTs = new Date(entries[entries.length - 1].createdAt).getTime();
        setThreadLastRead(prev => ({ ...prev, [viewComplaint._id]: latestTs }));
      }
    } catch {}
    let frame = 0;
    const maxFrames = 6; // cover ~ first 100ms of paints
    const attempt = () => {
      scrollThreadToBottomReliable(1); // one immediate scroll per frame
      frame++;
      if (frame < maxFrames) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  }, [viewComplaint?._id]);

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
      Swal.fire({
        icon: 'error',
        title: 'Error: User ID not found. Please try again.',
        timer: 900,
        showConfirmButton: false,
        timerProgressBar: true
      });
      return;
    }
    
    setVerificationLoading(true);
    try {
      await adminApi.patch(`/api/admin/approve-credentials/${userId}`);
      fetchUsers();
      closeCredentialModal();
      
      Swal.fire({
        icon: 'success',
        title: 'Credentials approved!',
        timer: 650,
        showConfirmButton: false,
        timerProgressBar: true,
        position: 'center'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to approve credentials',
        text: err.response?.data?.message || err.message,
        timer: 1200,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }
    setVerificationLoading(false);
  };

  const handleRejectCredentials = async (userId) => {
    console.log('handleRejectCredentials called with userId:', userId);
    console.log('currentUserId state:', currentUserId);
    
    if (!userId) {
      Swal.fire({
        icon: 'error',
        title: 'Error: User ID not found. Please try again.',
        timer: 900,
        showConfirmButton: false,
        timerProgressBar: true
      });
      return;
    }
    if (!issueDetails.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Please provide issue details',
        timer: 1000,
        showConfirmButton: false,
        timerProgressBar: true
      });
      return;
    }
    
    setVerificationLoading(true);
    try {
      await adminApi.patch(`/api/admin/reject-credentials/${userId}`, {
        issueDetails: issueDetails.trim(),
        requiredActions: requiredActions.trim() || 'Please upload corrected credentials'
      });
      fetchUsers();
      closeIssueDetailsModal();
      setIssueDetails('');
      
      setRequiredActions('');
      Swal.fire({
        icon: 'success',
        title: 'Credentials rejected',
        timer: 700,
        showConfirmButton: false,
        timerProgressBar: true
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to reject credentials',
        text: err.response?.data?.message || err.message,
        timer: 1400,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }
    setVerificationLoading(false);
  };

  const openIssueDetailsModal = () => {
    if (selectedCredential && selectedCredential.userId) {
      setCurrentUserId(selectedCredential.userId);
    }
    setIssueDetailsModalOpen(true);
  };

  const openIssueDetailsModalForUser = (userId) => {
    setCurrentUserId(userId);
    setIssueDetailsModalOpen(true);
  };

  const closeIssueDetailsModal = () => {
    setIssueDetailsModalOpen(false);
    setIssueDetails('');
    setRequiredActions('');
    setCurrentUserId(null);
  };

  const fetchVerificationHistory = async () => {
    try {
  const res = await adminApi.get('/api/admin/verification-history');
      setVerificationHistory(res.data.verificationHistory);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to fetch verification history' });
    }
  };

  // Removed request resubmission flow

  const pendingCount = complaints.filter(c => c.status === 'pending').length;

  const pendingUsersCount = users.filter(u => !u.isAdmin && !u.approved).length;

  // User summary counts
  const nonAdminUsers = users.filter(u => !u.isAdmin);
  const totalUsers = nonAdminUsers.length;
  const pendingUsers = nonAdminUsers.filter(u => !u.approved).length;
  const approvedUsers = nonAdminUsers.filter(u => u.approved).length;
  const rejectedUsers = nonAdminUsers.filter(u => (u.verificationStatus || '').toLowerCase() === 'rejected').length;

  // Complaint summary counts
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const inProgressComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'in progress' || (c.status || '').toLowerCase() === 'inprogress').length;
  const solvedComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'solved').length;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(o => !o);
  const closeSidebar = () => setSidebarOpen(false);

  // Lock body scroll when sidebar is open on small screens
  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (sidebarOpen) {
      htmlEl.classList.add('no-scroll');
      bodyEl.classList.add('no-scroll');
    } else {
      htmlEl.classList.remove('no-scroll');
      bodyEl.classList.remove('no-scroll');
    }
    return () => {
      htmlEl.classList.remove('no-scroll');
      bodyEl.classList.remove('no-scroll');
    };
  }, [sidebarOpen]);

  // Close sidebar on route/tab change (mobile) to reduce clutter
  useEffect(() => { closeSidebar(); }, [activeTab]);

  // Close on ESC key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeSidebar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch users & complaints initial
  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      try {
        setDataLoading(true);
        const [usersRes, complaintsRes] = await Promise.all([
          adminApi.get('/api/admin/users'),
          // Corrected endpoint: complaints are fetched from /api/complaints (non-admin prefix)
          adminApi.get('/api/complaints')
        ]);
        if (cancelled) return;
        setUsers(usersRes.data.users || usersRes.data || []);
        setComplaints(complaintsRes.data.complaints || complaintsRes.data || []);
      } catch (e) {
        if (!cancelled) Swal.fire('Error', 'Failed to load initial data', 'error');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }
    fetchInitial();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`admin-root ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
      {dataLoading && (
        <div className="admin-dashboard-container" style={{ position:'fixed', inset:0, zIndex:2000 }}>
          <LoadingOverlay show text="Loading admin data..." minimal iconSize={44} large={false} />
        </div>
      )}
      {/* Mobile Hamburger Button */}
      <button
        type="button"
        className="admin-hamburger-btn"
        aria-label="Toggle navigation menu"
        aria-expanded={sidebarOpen}
        aria-controls="admin-sidebar-nav"
        onClick={toggleSidebar}
      >
        <span className="bar" />
        <span className="bar" />
        <span className="bar" />
      </button>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />}
      {/* Floating Notification Bell (moved from sidebar to top-right) */}
      <div className="admin-bell-floating" ref={bellButtonRef}>
        <NotificationBell count={unreadCount} onClick={toggleNotifications} open={notifOpen} />
        {notifOpen && (
          <div ref={notifDropdownRef}>
            <NotificationDropdown
              notifications={notifications}
              loading={notifLoading}
              onSelect={handleSelectNotification}
              onMarkAll={handleMarkAll}
              onMarkSingle={handleMarkSingle}
              onDelete={handleDeleteNotification}
              onClearAll={handleClearAll}
              onLoadMore={handleLoadMore}
              hasMore={notifications.length >= notifLimit}
            />
          </div>
        )}
      </div>
      {/* Sidebar */}
      <div className="admin-sidebar" id="admin-sidebar-nav">
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
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
            Analytics
          </button>
          <button className={activeTab === 'complaint-history' ? 'active' : ''} onClick={() => { setActiveTab('complaint-history'); fetchComplaintHistory(); }}>
            Complaint History
          </button>
          <button className={activeTab === 'verification-history' ? 'active' : ''} onClick={() => {
            setActiveTab('verification-history');
            fetchVerificationHistory();
          }}>
            Verification History
          </button>
          <div className="admin-sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
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
            <div className="admin-table-viewport">
            <div className="admin-table-scroll">
            <table className="admin-table admin-users">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Verification Status</th>
            <th>Credentials for Verification</th>
            <th>Verify Account</th>
          </tr>
        </thead>
        <tbody>
                {users.filter(user => {
                  if (user.isAdmin) return false; // hide admin accounts from list
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
            <tr key={user._id} className={user.isAdmin ? 'admin-row-highlight' : ''}>
              <td>
                <span className="admin-email-wrapper">{user.email}
                  {/* {user.isAdmin && <span className="admin-role-badge" title="Administrator">Admin</span>} */}
                  {user.isAdmin && <span className="admin-email-subline">SYSTEM ADMIN</span>}
                </span>
              </td>
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
                      <div className="verify-actions-inner">
                        <button className="action-btn approve-btn" onClick={() => verifyUser(user._id)} disabled={user.approved}>Approve</button>
                        <button className="action-btn disapprove-btn" onClick={() => disapproveUser(user._id)} disabled={!user.approved}>Disapprove</button>
                        {user.isAdmin ? (
                          <button
                            className="action-btn delete-btn"
                            style={{ opacity: 0.4, cursor: 'not-allowed' }}
                            title="Admin accounts cannot be deleted"
                            disabled
                          >Delete</button>
                        ) : (
                          <button className="action-btn delete-btn" onClick={() => deleteUser(user._id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Category:</label>
                <select value={complaintTypeFilter} onChange={e => setComplaintTypeFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All</option>
                  <option value="Noise">Noise</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Vandalism">Vandalism</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Date:</label>
                <select value={complaintDateFilter} onChange={e => setComplaintDateFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {complaintDateFilter === 'custom' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={complaintDateFrom} onChange={e=>setComplaintDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={complaintDateTo} onChange={e=>setComplaintDateTo(e.target.value)} />
                </div>
              )}
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
                    placeholder="Search by name, email, type, location..."
                    className="admin-user-search-input"
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
            </div>
            <div className="admin-table-viewport">
            <div className="admin-table-scroll">
            <table className="admin-table admin-complaints">
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
                  const statusMatch = complaintFilter === 'all' ? true : (c.status || '').toLowerCase() === complaintFilter.toLowerCase();
                  const typeMatch = complaintTypeFilter === 'all' ? true : (c.type || '') === complaintTypeFilter;
                  const search = complaintSearch.trim().toLowerCase();
                  const hay = [c.fullName, c.contact, c.type, c.location, c.description].map(x => (x || '').toLowerCase()).join(' ');
                  const searchMatch = !search || hay.includes(search);
                  // Combine date and time into ISO-like string for filtering, fallback to createdAt if present
                  const candidateDate = c.date && c.time ? `${c.date}T${c.time}` : (c.createdAt || c.deletedAt || null);
                  const dateMatch = withinRange(candidateDate, complaintDateFilter, complaintDateFrom, complaintDateTo);
                  return statusMatch && typeMatch && searchMatch && dateMatch;
                }).map(c => (
                  <tr key={c._id}>
                    <td>{c.fullName || 'Anonymous'}</td>
                    <td>{c.contact || 'N/A'}</td>
                    <td style={{ position: 'relative' }}>
                      {c.type}
                      {unreadForComplaint(c) > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: 2,
                          left: 4,
                          background: '#2563eb',
                          color: '#fff',
                          borderRadius: '10px',
                          padding: '0 6px',
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: '16px'
                        }} title={`${unreadForComplaint(c)} unread user message(s)`}>
                          {unreadForComplaint(c)}
                        </span>
                      )}
                    </td>
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
            </div>
            </div>
          </>
        )}
        {activeTab === 'analytics' && (
          <>
            <h2>Analytics</h2>
            <div style={{ marginBottom: 12, color: '#64748b' }}>Snapshot of user verification and complaint status distribution.</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Date range:</label>
                <select value={analyticsDateFilter} onChange={e => setAnalyticsDateFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {analyticsDateFilter === 'custom' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={analyticsDateFrom} onChange={e=>setAnalyticsDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={analyticsDateTo} onChange={e=>setAnalyticsDateTo(e.target.value)} />
                </div>
              )}
            </div>

            {/* Quick summary cards */}
            <div className="admin-summary-grid" style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
              {(() => {
                // Filter datasets by analytics date (exclude admin accounts)
                const usersFiltered = (users || []).filter(u => {
                  if (u && u.isAdmin) return false;
                  const candidate = u.verificationDate || u.createdAt || u.updatedAt || null;
                  return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
                });
                const complaintsFiltered = (complaints || []).filter(c => {
                  const candidate = (c.date && c.time) ? `${c.date}T${c.time}` : (c.createdAt || c.updatedAt || c.deletedAt || null);
                  return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
                });
                const approvedUsers = usersFiltered.filter(u => u.approved).length;
                const rejectedUsers = usersFiltered.filter(u => (u.verificationStatus||'').toLowerCase()==='rejected').length;
                const pendingUsersCalc = Math.max(0, usersFiltered.length - approvedUsers - rejectedUsers);
                const pendingComplaintsCalc = complaintsFiltered.filter(c => (c.status||'').toLowerCase()==='pending').length;
                const inProgComplaintsCalc = complaintsFiltered.filter(c => {
                  const s = (c.status||'').toLowerCase();
                  return s==='in progress' || s==='inprogress';
                }).length;
                const solvedComplaintsCalc = complaintsFiltered.filter(c => (c.status||'').toLowerCase()==='solved').length;
                return (
                  <>
              <div className="admin-summary-card total">
                <div className="summary-title">Total Users</div>
                <div className="summary-value">{usersFiltered.length}</div>
              </div>
              <div className="admin-summary-card approved">
                <div className="summary-title">Approved Users</div>
                <div className="summary-value">{approvedUsers}</div>
              </div>
              <div className="admin-summary-card pending">
                <div className="summary-title">Pending Users</div>
                <div className="summary-value">{pendingUsersCalc}</div>
              </div>
              <div className="admin-summary-card rejected">
                <div className="summary-title">Rejected Users</div>
                <div className="summary-value">{rejectedUsers}</div>
              </div>
              <div className="admin-summary-card total">
                <div className="summary-title">Total Complaints</div>
                <div className="summary-value">{complaintsFiltered.length}</div>
              </div>
              <div className="admin-summary-card pending">
                <div className="summary-title">Pending Complaints</div>
                <div className="summary-value">{pendingComplaintsCalc}</div>
              </div>
              <div className="admin-summary-card progress">
                <div className="summary-title">In Progress Complaints</div>
                <div className="summary-value">{inProgComplaintsCalc}</div>
              </div>
              <div className="admin-summary-card solved">
                <div className="summary-title">Solved Complaints</div>
                <div className="summary-value">{solvedComplaintsCalc}</div>
              </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
              {/* Users chart */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff' }}>
                <h3 style={{ marginTop: 0 }}>Users by Status</h3>
                {(() => {
                  const usersFiltered = (users || []).filter(u => {
                    if (u && u.isAdmin) return false;
                    const candidate = u.verificationDate || u.createdAt || u.updatedAt || null;
                    return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
                  });
                  const approved = usersFiltered.filter(u => u.approved).length;
                  const rejected = usersFiltered.filter(u => (u.verificationStatus||'').toLowerCase()==='rejected').length;
                  const pending = Math.max(0, usersFiltered.length - approved - rejected);
                  const data = [
                    { label: 'Approved', value: approved, color: '#22c55e' },
                    { label: 'Pending', value: pending, color: '#eab308' },
                    { label: 'Rejected', value: rejected, color: '#ef4444' }
                  ];
                  const max = Math.max(1, ...data.map(d => d.value));
                  return (
                    <div>
                      {data.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <div style={{ width: 90, textAlign: 'right', fontSize: 13, color: '#475569' }}>{d.label}</div>
                          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 9999, height: 16, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ width: `${(d.value/max)*100}%`, background: d.color, height: '100%' }} />
                          </div>
                          <div style={{ width: 40, textAlign: 'left', fontWeight: 600 }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Complaints chart */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff' }}>
                <h3 style={{ marginTop: 0 }}>Complaints by Status</h3>
                {(() => {
                  const complaintsFiltered = (complaints || []).filter(c => {
                    const candidate = (c.date && c.time) ? `${c.date}T${c.time}` : (c.createdAt || c.updatedAt || c.deletedAt || null);
                    return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
                  });
                  const pending = complaintsFiltered.filter(c => (c.status||'').toLowerCase() === 'pending').length;
                  const inprog = complaintsFiltered.filter(c => {
                    const s = (c.status||'').toLowerCase();
                    return s === 'in progress' || s === 'inprogress';
                  }).length;
                  const solved = complaintsFiltered.filter(c => (c.status||'').toLowerCase() === 'solved').length;
                  const data = [
                    { label: 'Pending', value: pending, color: '#ef4444' },
                    { label: 'In Progress', value: inprog, color: '#eab308' },
                    { label: 'Solved', value: solved, color: '#22c55e' }
                  ];
                  const max = Math.max(1, ...data.map(d => d.value));
                  return (
                    <div>
                      {data.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <div style={{ width: 90, textAlign: 'right', fontSize: 13, color: '#475569' }}>{d.label}</div>
                          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 9999, height: 16, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ width: `${(d.value/max)*100}%`, background: d.color, height: '100%' }} />
                          </div>
                          <div style={{ width: 40, textAlign: 'left', fontWeight: 600 }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Empty state fallback */}
            {(() => {
              const usersFiltered = (users || []).filter(u => {
                if (u && u.isAdmin) return false;
                const candidate = u.verificationDate || u.createdAt || u.updatedAt || null;
                return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
              });
              const complaintsFiltered = (complaints || []).filter(c => {
                const candidate = (c.date && c.time) ? `${c.date}T${c.time}` : (c.createdAt || c.updatedAt || c.deletedAt || null);
                return withinRange(candidate, analyticsDateFilter, analyticsDateFrom, analyticsDateTo);
              });
              return usersFiltered.length === 0 && complaintsFiltered.length === 0;
            })() && (
              <div style={{ marginTop: 16, color: '#64748b' }}>No analytics data yet.</div>
            )}

            {/* Analytics footer action: compact CSV export button at bottom */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={downloadAnalyticsCSV}
                title="Download CSV report"
                aria-label="Download CSV report"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #0369a1',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  boxShadow: 'none',
                  width: 'auto',
                  flex: '0 0 auto',
                  alignSelf: 'flex-end',
                  maxWidth: 'fit-content'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 3v10m0 0l-4-4m4 4l4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                CSV
              </button>
            </div>
          </>
        )}
        {activeTab === 'complaint-history' && (
          <>
            <h2>Complaint History</h2>
            <div style={{ marginBottom: 12, color: '#64748b' }}>Complaints removed by users remain here for administrative review until an admin permanently deletes them.</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="admin-user-search-wrapper">
                <span className="admin-user-search-icon">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="9" cy="9" r="7" stroke="#bfc9d9" strokeWidth="2"/>
                    <line x1="14.4142" y1="14" x2="18" y2="17.5858" stroke="#bfc9d9" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search by name, email, type..."
                  className="admin-user-search-input"
                  style={{ paddingLeft: 36 }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Category:</label>
                <select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All</option>
                  <option value="Noise">Noise</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Vandalism">Vandalism</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: 8 }}>Date:</label>
                <select value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {historyDateFilter === 'custom' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={historyDateFrom} onChange={e=>setHistoryDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={historyDateTo} onChange={e=>setHistoryDateTo(e.target.value)} />
                </div>
              )}
            </div>
            <div className="admin-table-viewport">
              <div className="admin-table-scroll">
                <table className="admin-table admin-complaints">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Type</th>
                      <th>Deleted At</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyComplaints || []).filter(c => {
                      const search = historySearch.trim().toLowerCase();
                      const hay = [c.fullName, c.contact, c.type, c.location, c.description].map(x => (x || '').toLowerCase()).join(' ');
                      const searchMatch = !search || hay.includes(search);
                      const typeMatch = historyTypeFilter === 'all' ? true : (c.type || '') === historyTypeFilter;
                      const candidateDate = c.deletedAt || (c.date && c.time ? `${c.date}T${c.time}` : c.createdAt || null);
                      const dateMatch = withinRange(candidateDate, historyDateFilter, historyDateFrom, historyDateTo);
                      return searchMatch && typeMatch && dateMatch;
                    }).map(c => (
                      <tr key={c._id}>
                        <td>{c.fullName || 'Anonymous'}</td>
                        <td>{c.contact || 'N/A'}</td>
                        <td>{c.type || 'N/A'}</td>
                        <td>{c.deletedAt ? new Date(c.deletedAt).toLocaleString() : '—'}</td>
                        <td>
                          <span className={`status-badge status-${(c.status || 'pending').toLowerCase()}`}>{c.status || 'pending'}</span>
                        </td>
                        <td>
                          <div className="verify-actions-inner">
                            <button className="action-btn view-btn" onClick={() => setViewComplaint(c)}>View</button>
                            <button className="action-btn delete-btn" onClick={async () => {
                              const result = await Swal.fire({ title: 'Permanently delete this complaint?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', cancelButtonText: 'Cancel' });
                              if (!result.isConfirmed) return;
                              try {
                                await adminApi.delete(`/api/complaints/${c._id}`);
                                fetchComplaintHistory();
                                Swal.fire({ icon: 'success', title: 'Complaint permanently deleted', timer: 700, showConfirmButton: false });
                              } catch (e) {
                                Swal.fire({ icon: 'error', title: 'Failed to delete complaint' });
                              }
                            }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!historyComplaints || historyComplaints.length === 0) && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#666', padding: 16 }}>
                          {historyLoading ? 'Loading...' : 'No complaints in history.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {activeTab === 'verification-history' && (
          <>
            <h2>Credential Verification History</h2>
            <div style={{ marginBottom: 16 }}>
              <p>This tab shows the complete history of all credential verifications, including approvals, rejections, and resubmission requests.</p>
            </div>
            <div className="admin-table-viewport">
              <div className="admin-table-scroll">
                <table className="admin-table admin-verification">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Verification Status</th>
                  <th>Verification Date</th>
                  <th>Issue Details</th>
                  <th>Required Actions</th>
                  <th>Rejection Count</th>
                </tr>
              </thead>
              <tbody>
                {verificationHistory.filter(u => !u.isAdmin).map(user => (
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
              </div>
            </div>
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
          <div className="evidence-strip-wrapper">
            <div
              className="evidence-strip"
              onWheel={(e)=>{ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)) { e.currentTarget.scrollLeft += e.deltaY; } }}
              style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:4 }}
            >
              {viewComplaint.evidence.map((file, idx) => {
                const fileUrl = typeof file === 'string' ? file : (file?.url || '');
                if (!fileUrl) return null;
                const url = toAbsolute(fileUrl);
                const ext = fileUrl.split('.').pop().toLowerCase();
                const handleEvidenceClick = (e) => { e.stopPropagation(); setEvidenceModal({ open: true, index: idx }); };
                if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) {
                  return (
                    <div key={idx} className="evidence-item" title="Click to view full size" style={{ minWidth: 120 }}>
                      <img
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        onClick={handleEvidenceClick}
                        className="evidence-thumb"
                        style={{ width:120, height:90, objectFit:'cover', borderRadius:6, border:'1px solid #cbd5e1', cursor:'zoom-in' }}
                      />
                      <small className="evidence-filename" style={{ display:'block', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{fileUrl.split('/').pop()}</small>
                    </div>
                  );
                } else if (["mp4", "avi", "mov", "wmv", "flv", "webm"].includes(ext)) {
                  return (
                    <div key={idx} className="evidence-item" title="Click to view full size" style={{ minWidth: 120 }} onClick={handleEvidenceClick}>
                      <video
                        className="evidence-thumb"
                        muted
                        preload="metadata"
                        style={{ background:'#000', width:120, height:90, objectFit:'cover', borderRadius:6, border:'1px solid #cbd5e1', cursor:'zoom-in' }}
                      >
                        <source src={url} type={`video/${ext}`} />
                      </video>
                      <small className="evidence-filename" style={{ display:'block', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{fileUrl.split('/').pop()}</small>
                    </div>
                  );
                } else if (ext === "pdf") {
                  return (
                    <div key={idx} className="evidence-item" onClick={handleEvidenceClick} title="Click to view full size" style={{ minWidth: 120 }}>
                      <div className="pdf-thumb" style={{display:'flex',alignItems:'center',justifyContent:'center',background:'#eef2f7',border:'1px solid #cbd5e1',borderRadius:6,fontSize:24,fontWeight:600,color:'#475569', width:120, height:90, cursor:'zoom-in'}}>
                        PDF
                      </div>
                      <small className="evidence-filename" style={{ display:'block', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{fileUrl.split('/').pop()}</small>
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="evidence-item" onClick={handleEvidenceClick} title="Click to view full size" style={{ minWidth: 120 }}>
                      <div className="file-placeholder" style={{ cursor: 'zoom-in', display:'flex',alignItems:'center',justifyContent:'center', width:120, height:90, border:'1px solid #cbd5e1', borderRadius:6 }}>
                        {ext.toUpperCase()}
                      </div>
                      <small className="evidence-filename" style={{ display:'block', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{fileUrl.split('/').pop()}</small>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ) : (
          <p>No evidence uploaded</p>
        )}
        {renderEvidenceModal()}
      </div>

      {/* Legacy single feedback field removed */}

      {/* Threaded Feedback (chat layout) */}
      <div className="feedback-section" style={{ marginTop: 24 }}>
        <label><strong>Messages:</strong></label>
  <div ref={threadListRef} className="feedback-thread-list" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#f9fafb', scrollBehavior: 'smooth' }}>
          {(viewComplaint.feedbackEntries || []).length === 0 && <div style={{ color: '#666', fontSize: 14 }}>No messages yet.</div>}
          {(viewComplaint.feedbackEntries || []).slice().sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt)).map((entry, idx) => {
            const isAdmin = entry.authorType === 'admin';
            const rowSide = isAdmin ? 'right' : 'left';
            const bubbleClass = 'feedback-bubble ' + (isAdmin ? 'admin' : 'userSelf');
            // For user name, we try to pull from viewComplaint.fullName (if owner) else generic 'User'
            const userName = !isAdmin ? (viewComplaint.fullName || 'User') : 'Admin';
            return (
              <div key={idx} className={`feedback-msg-row ${rowSide}`}>
                <div className={bubbleClass}>
                  <div className="feedback-meta">
                    <span>{userName}</span>
                    <span>• {new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <div>{entry.message}</div>
                </div>
              </div>
            );
          })}
        </div>
        {activeTab !== 'complaint-history' ? (
          <>
            <textarea value={threadMessage} onChange={e=>setThreadMessage(e.target.value)} placeholder="Type a message to add to the thread..." style={{ marginTop: 8 }} />
            <button onClick={postThreadMessage} disabled={postingThreadMsg || !threadMessage.trim()}>{postingThreadMsg ? 'Posting...' : 'Post Message'}</button>
          </>
        ) : (
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
            Messaging is disabled in the Complaint History tab. You can read previous messages here.
          </div>
        )}
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
                {selectedUserCredentials.credentials && selectedUserCredentials.credentials.length > 0 && (() => {
                  const rawCred = selectedUserCredentials.credentials[currentCredentialIndex];
                  const rawUrl = extractCredentialUrl(rawCred);
                  if (!rawUrl) return <div style={{padding:20,color:'#b91c1c'}}>Unable to display credential (missing URL)</div>;
                  return (
                    <img
                      src={toAbsolute(rawUrl)}
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
                  );
                })()}
              </div>

              <div className="credential-actions">
                <button 
                  className={`action-btn approve-btn ${verificationLoading ? 'button-loading loading-text-hidden' : ''}`}
                  onClick={() => handleApproveCredentials(selectedUserCredentials._id)}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? <InlineButtonSpinner show>Credential Looks Valid</InlineButtonSpinner> : 'Credential Looks Valid'}
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
              {renderCredentialImageModal()}
            </div>
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
                  className={`action-btn approve-btn ${verificationLoading ? 'button-loading loading-text-hidden' : ''}`}
                  onClick={() => handleApproveCredentials(selectedCredential.userId)}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? <InlineButtonSpinner show>Credential Looks Valid</InlineButtonSpinner> : 'Credential Looks Valid'}
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
                  className={`action-btn reject-credentials-btn ${verificationLoading ? 'button-loading loading-text-hidden' : ''}`}
                  onClick={() => handleRejectCredentials(currentUserId)}
                  disabled={verificationLoading || !issueDetails.trim()}
                >
                  {verificationLoading ? <InlineButtonSpinner show>Reject Credentials</InlineButtonSpinner> : 'Reject Credentials'}
                </button>
                {/* Request Resubmission button removed per request */}
                <button 
                  className="action-btn cancel-btn"
                  onClick={closeIssueDetailsModal}
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
