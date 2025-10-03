import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import deleteIcon from '../assets/delete.png';
import { useNavigate } from 'react-router-dom';
// Use centralized axios client with interceptors
import api from '../api/client';
import Swal from 'sweetalert2';
import './Dashboard.css';
import { toAbsolute, withCacheBust } from '../utils/url';
import SmartImage from '../components/SmartImage';
import LoadingOverlay from '../components/LoadingOverlay';
import { API_BASE } from '../config/apiBase';

// Removed static default avatar image; we will render an initial-letter fallback avatar dynamically

const complaintTypes = [
  'Noise', 'Harassment', 'Garbage', 'Vandalism', 'Other'
];

const Dashboard = () => {
  // Debug build marker (remove later once confirmed UI updates show)
  try { console.log('[Dashboard] build marker', 'pw-enhanced-v1'); } catch {}
  const navigate = useNavigate();
  // Base API URL constant (single source of truth)
  // API_BASE imported from centralized config

  // 1. Bootstrap token from URL (Google OAuth redirect) BEFORE any data fetching
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        localStorage.setItem('token', tokenParam);
        localStorage.setItem('justLoggedIn', '1');
        params.delete('token');
        const newQuery = params.toString();
        const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      // Non-blocking: fail silently
    }
  }, []);
  const [showProfile, setShowProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showComplaint, setShowComplaint] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  // Password change local state
  const [pwFields, setPwFields] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const fileInputRef = useRef();
  const complaintFileInputRef = useRef();
  const eventSourceRef = useRef(null);

  // Track login state and missed notifications
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('user'));
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [missedNotifications, setMissedNotifications] = useState([]);
  // Listen for login/logout events and fetch missed notifications
  useEffect(() => {
    const handleStorageChange = () => {
      const userNow = localStorage.getItem('user');
      setIsLoggedIn(!!userNow);
      if (userNow && !isLoggedIn) {
        setJustLoggedIn(true);
        fetchMissedNotifications();
      } else if (!userNow && isLoggedIn) {
        setJustLoggedIn(false);
        setMissedNotifications([]);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isLoggedIn]);

  // On mount, if logged in, fetch missed notifications
  useEffect(() => {
    if (isLoggedIn && justLoggedIn) {
      fetchMissedNotifications();
    }
  }, [isLoggedIn, justLoggedIn]);

  // Fetch missed notifications (simulate API or use localStorage)
  const fetchMissedNotifications = async () => {
    // Simulate: get from localStorage (or replace with API call)
    const missed = [];
    const stored = localStorage.getItem(`notifications_${user._id}`);
    if (stored) {
      try {
        const all = JSON.parse(stored);
        // Only show those after last logout
        const lastLogin = parseInt(localStorage.getItem(`lastLogin_${user._id}`) || '0', 10);
        all.forEach(n => {
          if (n.timestamp > lastLogin) missed.push(n);
        });
      } catch {}
    }
    setMissedNotifications(missed);
  };

  // Always fetch user info from backend on mount for correct MongoDB _id
  const [user, setUser] = useState({
    _id: '',
    firstName: 'User',
    lastName: '',
    email: 'user@email.com',
    phoneNumber: '',
    address: '',
    credentials: [],
    profilePicture: null,
  });
  const [editData, setEditData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber || '',
    address: user.address || '',
    profilePic: user.profilePicture || '',
    file: null,
  });

  // Sync edit form with fetched user data (initial load or when user changes) unless user is actively editing.
  useEffect(() => {
    // Avoid overwriting while the modal is open (user is editing) or if no real user loaded yet
    if (!showEdit && user && user._id) {
      setEditData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        profilePic: user.profilePicture || '',
        // Do not carry over previous file selection after user refresh
        file: null,
      }));
    }
  }, [user._id, user.firstName, user.lastName, user.phoneNumber, user.address, user.profilePicture, showEdit]);

  // If the user opens the edit modal before the user data finished loading, populate once it opens.
  useEffect(() => {
    if (showEdit && user && user._id) {
      setEditData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        // Only replace preview if user hasn't selected a new local file
        profilePic: prev.file ? prev.profilePic : (user.profilePicture || ''),
      }));
    }
  }, [showEdit, user._id, user.firstName, user.lastName, user.phoneNumber, user.address, user.profilePicture]);

  // Complaint form state
  const [complaint, setComplaint] = useState({
    fullName: '',
    contact: '',
    date: '',
    time: '',
    location: '',
    people: '',
    description: '',
    evidence: [],
    type: '',
    resolution: '',
  });

  // When user info is loaded/updated, update complaint form with real name/email
  useEffect(() => {
    setComplaint(c => ({
      ...c,
      fullName: user.firstName + ' ' + user.lastName,
      contact: user.email
    }));
  }, [user.firstName, user.lastName, user.email]);

  // Complaints list state
  const [complaints, setComplaints] = useState([]);
  const [viewComplaint, setViewComplaint] = useState(null);
  // Ref mirror of viewComplaint to avoid stale closure inside SSE handlers
  const viewComplaintRef = useRef(null);
  useEffect(()=>{ viewComplaintRef.current = viewComplaint; }, [viewComplaint]);
  // Thread last-read timestamps (per complaint) for unread badge
  const [threadLastRead, setThreadLastRead] = useState({});
  const threadListRef = useRef(null);
  // Threaded feedback (user <-> admin) state
  const [threadMessageUser, setThreadMessageUser] = useState('');
  const [postingUserThread, setPostingUserThread] = useState(false);
  const [editComplaint, setEditComplaint] = useState(null);
  const [editComplaintData, setEditComplaintData] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const notificationContentRef = useRef(null);

  // Reliable scrolling helper (multiple attempts to handle late renders/media)
  const scrollThreadToBottomReliable = (attempts = 5) => {
    const el = threadListRef.current;
    if (!el) return;
    try { el.scrollTop = el.scrollHeight; } catch {}
    if (attempts > 1) {
      setTimeout(() => scrollThreadToBottomReliable(attempts - 1), 40);
    }
  };

  // Reconcile open complaint view with master complaints list in case an SSE append landed there first
  useEffect(() => {
    if (!viewComplaintRef.current) return;
    const latest = complaints.find(c => c._id === viewComplaintRef.current._id);
    if (!latest) return;
    // If counts differ, update viewComplaint to include new entries
    const openEntries = (viewComplaintRef.current.feedbackEntries || []).length;
    const latestEntries = (latest.feedbackEntries || []).length;
    if (latestEntries !== openEntries) {
      setViewComplaint(prev => prev && prev._id === latest._id ? { ...latest, feedback: prev.feedback } : prev);
      // Optionally auto-scroll if we were at bottom
      setTimeout(() => {
        const listEl = threadListRef.current;
        if (!listEl) return;
        const distanceFromBottom = listEl.scrollHeight - (listEl.scrollTop + listEl.clientHeight);
        if (distanceFromBottom < 5) {
          listEl.scrollTop = listEl.scrollHeight;
        }
      }, 30);
    }
  }, [complaints]);

  // Evidence modal state for complaint evidence viewer (user side)
  const [evidenceModal, setEvidenceModal] = useState({ open: false, index: 0 });

  // Derived complaint counts for summary cards
  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const inProgressCount = complaints.filter(c => (c.status || '').toLowerCase() === 'in progress').length;
  const solvedCount = complaints.filter(c => (c.status || '').toLowerCase() === 'solved').length;

  // ===== Real-time & Offline helpers (re-added) =====
  let realtimeReconnectTimerRef = useRef(null);

  function setupRealTimeUpdates() {
    if (!user._id) return;
    // Close existing connection
    if (eventSourceRef.current) {
      try { eventSourceRef.current.close(); } catch {}
      eventSourceRef.current = null;
    }
    const es = new EventSource(`${API_BASE}/api/realtime/${user._id}`);
    eventSourceRef.current = es;
    es.onopen = () => {
      setRealtimeConnected(true);
      if (realtimeReconnectTimerRef.current) {
        clearTimeout(realtimeReconnectTimerRef.current);
        realtimeReconnectTimerRef.current = null;
      }
    };
    es.onmessage = (evt) => {
      if (!evt.data) return;
      try {
        const data = JSON.parse(evt.data);
        switch (data.type) {
          case 'connected':
            break;
          case 'status_update':
            handleStatusUpdate && handleStatusUpdate(data);
            break;
          case 'feedback_thread_update':
            handleThreadFeedbackUpdate && handleThreadFeedbackUpdate(data);
            break;
          case 'credential_verification':
            handleCredentialVerification && handleCredentialVerification(data);
            break;
          case 'credential_resubmission':
            handleCredentialResubmission && handleCredentialResubmission(data);
            break;
          default:
            break;
        }
      } catch (e) { /* swallow parse errors */ }
    };
    es.onerror = () => {
      setRealtimeConnected(false);
      try { es.close(); } catch {}
      if (!realtimeReconnectTimerRef.current) {
        realtimeReconnectTimerRef.current = setTimeout(() => {
          realtimeReconnectTimerRef.current = null;
          setupRealTimeUpdates();
        }, 3000);
      }
    };
  }

  function handleOnline() {
    setupRealTimeUpdates();
  }
  function handleOffline() {
    setRealtimeConnected(false);
    if (eventSourceRef.current) {
      try { eventSourceRef.current.close(); } catch {}
      eventSourceRef.current = null;
    }
  }
  function setupOfflineDetection() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Real-time updates setup
  useEffect(() => {
    if (user._id) {
      setupRealTimeUpdates();
      checkForStoredNotifications();
      setupOfflineDetection();
      checkForMissedUpdates();
      setupPeriodicChecks();
      updateNotificationCount();

      const justLoggedIn = localStorage.getItem('justLoggedIn');
      if (justLoggedIn) {
        const storedUser = JSON.parse(localStorage.getItem('user') || "{}");
        const displayName =
          storedUser.name ||
          `${storedUser.firstName || ''} ${storedUser.lastName || ''}`.trim() ||
          storedUser.email ||
          'User';

        Swal.fire({
          icon: 'success',
          title: `Welcome back, ${displayName}!`,
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true,
          position: 'top-end',
          toast: true,
          customClass: { popup: 'notif-toast' }
        });

        localStorage.removeItem('justLoggedIn');
      }
    }
  }, [user._id]); // ✅ THIS needs to be inside useEffect

  // Update notification count from localStorage
  const updateNotificationCount = () => {
    const stored = localStorage.getItem(`notifications_${user._id}`);
    const lastSeen = parseInt(localStorage.getItem(`notif_last_seen_${user._id}`) || '0', 10);
    
    if (!stored) {
      setNotificationCount(0);
      return;
    }
    
    try {
      const notifications = JSON.parse(stored);
      const unread = notifications.filter(n => n.timestamp > lastSeen);
      setNotificationCount(unread.length);
      console.log('Updated notification count:', unread.length, 'unread out of', notifications.length, 'total');
      } catch (error) {
        console.error('Error updating notification count:', error);
      setNotificationCount(0);
    }
  };

  // Setup periodic background checks for updates
  const setupPeriodicChecks = () => {
    // Check for updates every 2 minutes as a backup to real-time
    window.periodicCheckInterval = setInterval(async () => {
      if (user._id) {
        try {
          const res = await api.get(`/api/complaints/user/${user._id}`);
          const latestComplaints = res.data.complaints;
          
          // Compare with current state to find updates
          latestComplaints.forEach(newComplaint => {
            const currentComplaint = complaints.find(c => c._id === newComplaint._id);
            if (currentComplaint) {
              // Check for status changes
              if (currentComplaint.status !== newComplaint.status) {
                // Only create notification if we haven't already shown it
                const existingNotification = localStorage.getItem(`notifications_${user._id}`);
                if (existingNotification) {
                  const notifications = JSON.parse(existingNotification);
                  const alreadyNotified = notifications.some(n => 
                    n.complaintId === newComplaint._id && 
                    n.type === 'status_update' &&
                    n.newStatus === newComplaint.status
                  );
                  
                  if (!alreadyNotified) {
                    const notification = {
                      type: 'status_update',
                      complaintId: newComplaint._id,
                      oldStatus: currentComplaint.status,
                      newStatus: newComplaint.status,
                      message: `Your complaint status has been updated from "${currentComplaint.status}" to "${newComplaint.status}"`,
                      timestamp: Date.now()
                    };
                    
                    saveNotificationToStorage(notification);
                  }
                }
              }
              
              // Check for new feedback
              if (currentComplaint.feedback !== newComplaint.feedback && newComplaint.feedback) {
                const existingNotification = localStorage.getItem(`notifications_${user._id}`);
                if (existingNotification) {
                  const notifications = JSON.parse(existingNotification);
                  const alreadyNotified = notifications.some(n => 
                    n.complaintId === newComplaint._id && 
                    n.type === 'feedback_update' &&
                    n.feedback === newComplaint.feedback
                  );
                  
                  if (!alreadyNotified) {
                    const notification = {
                      type: 'feedback_update',
                      complaintId: newComplaint._id,
                      feedback: newComplaint.feedback,
                      message: 'Admin has added feedback to your complaint',
                      timestamp: Date.now()
                    };
                    
                    saveNotificationToStorage(notification);
                  }
                }
              }
            }
          });
          
          // Update current complaints state
          setComplaints(latestComplaints);
        } catch (error) {
          console.error('Error in periodic update check:', error);
        }
      }
    }, 2 * 60 * 1000); // Check every 2 minutes
  };

  // Check for updates that happened while user was logged out
  const checkForMissedUpdates = async () => {
    try {
      // Get the last login time from localStorage
      const lastLoginTime = localStorage.getItem(`lastLogin_${user._id}`);
      const now = Date.now();
      
      console.log('Checking for missed updates...');
      console.log('Last login time:', lastLoginTime ? new Date(parseInt(lastLoginTime)).toLocaleString() : 'Never');
      
      if (lastLoginTime) {
        const timeSinceLastLogin = now - parseInt(lastLoginTime);
        console.log('Time since last login:', Math.round(timeSinceLastLogin / 1000), 'seconds');
        
        // If it's been more than 30 seconds since last login, check for updates
        if (timeSinceLastLogin > 30 * 1000) {
          console.log('Checking for updates that happened while logged out...');
          
          // Fetch latest complaints to check for status changes
          const res = await api.get(`/api/complaints/user/${user._id}`);
          const latestComplaints = res.data.complaints;
          console.log('Latest complaints from server:', latestComplaints);
          
          // Compare with stored complaints to find updates
          const storedComplaints = localStorage.getItem(`complaints_${user._id}`);
          if (storedComplaints) {
            try {
              const oldComplaints = JSON.parse(storedComplaints);
              console.log('Stored complaints from before logout:', oldComplaints);
              
              let updatesFound = 0;
              
              // Find complaints that have status changes
              latestComplaints.forEach(newComplaint => {
                const oldComplaint = oldComplaints.find(c => c._id === newComplaint._id);
                if (oldComplaint) {
                  // Check for status changes
                  if (oldComplaint.status !== newComplaint.status) {
                    console.log(`Status change detected: ${oldComplaint.status} -> ${newComplaint.status}`);
                    
                    const notification = {
                      type: 'status_update',
                      complaintId: newComplaint._id,
                      oldStatus: oldComplaint.status,
                      newStatus: newComplaint.status,
                      message: `Your complaint status has been updated from "${oldComplaint.status}" to "${newComplaint.status}"`,
                      timestamp: now
                    };
                    
                    saveNotificationToStorage(notification);
                    updatesFound++;
                  }
                  
                  // Check for new feedback
                  if (oldComplaint.feedback !== newComplaint.feedback && newComplaint.feedback) {
                    console.log(`New feedback detected for complaint: ${newComplaint._id}`);
                    
                    const notification = {
                      type: 'feedback_update',
                      complaintId: newComplaint._id,
                      feedback: newComplaint.feedback,
                      message: 'Admin has added feedback to your complaint',
                      timestamp: now
                    };
                    
                    saveNotificationToStorage(notification);
                    updatesFound++;
                  }
                }
              });
              
              console.log(`Total updates found while logged out: ${updatesFound}`);
            } catch (error) {
              console.error('Error comparing complaints:', error);
            }
          } else {
            console.log('No stored complaints found for comparison');
          }
          
          // Store current complaints for future comparison
          localStorage.setItem(`complaints_${user._id}`, JSON.stringify(latestComplaints));
          console.log('Updated stored complaints for future comparison');
        } else {
          console.log('Not enough time has passed since last login, skipping update check');
        }
      } else {
        console.log('First time login, no previous data to compare');
      }
      
      // Update last login time
      localStorage.setItem(`lastLogin_${user._id}`, now.toString());
      console.log('Updated last login time to:', new Date(now).toLocaleString());
    } catch (error) {
      console.error('Error checking for missed updates:', error);
    }
  };

            {/* Password Change Section (Enhanced) */}
            <div className="pw-section-wrapper">
              <button
                type="button"
                aria-expanded={showPasswordSection}
                onClick={() => setShowPasswordSection(s => !s)}
                className={`pw-toggle-btn ${showPasswordSection ? 'open' : ''}`}
              >
                <span className="pw-toggle-icon" aria-hidden="true">
                  {showPasswordSection ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  )}
                </span>
                <span>{showPasswordSection ? 'Cancel Password Change' : 'Change Password'}</span>
              </button>
              <div className={`pw-collapse ${showPasswordSection ? 'show' : ''}`}>
                {showPasswordSection && (() => {
                  const newPw = pwFields.next || '';
                  const rules = {
                    length: newPw.length >= 8,
                    upper: /[A-Z]/.test(newPw),
                    lower: /[a-z]/.test(newPw),
                    number: /\d/.test(newPw),
                    symbol: /[\W_]/.test(newPw)
                  };
                  const passedCount = Object.values(rules).filter(Boolean).length;
                  const strengthPct = (passedCount / 5) * 100;
                  let strengthLabel = 'Too Weak';
                  if (strengthPct >= 80) strengthLabel = 'Strong';
                  else if (strengthPct >= 60) strengthLabel = 'Good';
                  else if (strengthPct >= 40) strengthLabel = 'Fair';
                  const confirmMismatch = pwFields.confirm && pwFields.confirm !== newPw;
                  return (
                    <form onSubmit={handleChangePassword} className="pw-card enhanced-loaded-debug" noValidate>
                      <div className="pw-card-header">
                        <h4>Update Password</h4>
                        <p>Use a unique strong password you don’t use elsewhere.</p>
                      </div>
                      <div className="pw-grid">
                        <div className="pw-field">
                          <label htmlFor="currentPassword">Current Password</label>
                          <div className="pw-input-wrap">
                            <input
                              id="currentPassword"
                              type={pwFields._showCurrent ? 'text' : 'password'}
                              autoComplete="current-password"
                              value={pwFields.current}
                              onChange={e => setPwFields(f => ({ ...f, current: e.target.value }))}
                              placeholder="Current password"
                              required
                            />
                            <button type="button" className="pw-eye" onClick={() => setPwFields(f => ({ ...f, _showCurrent: !f._showCurrent }))} aria-label="Toggle current password visibility">
                              {pwFields._showCurrent ? '🙈' : '👁️'}
                            </button>
                          </div>
                        </div>
                        <div className="pw-field">
                          <label htmlFor="newPassword">New Password</label>
                          <div className="pw-input-wrap">
                            <input
                              id="newPassword"
                              type={pwFields._showNew ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={pwFields.next}
                              onChange={e => setPwFields(f => ({ ...f, next: e.target.value }))}
                              placeholder="New password"
                              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}"
                              required
                              aria-describedby="pw-strength pw-rules"
                            />
                            <button type="button" className="pw-eye" onClick={() => setPwFields(f => ({ ...f, _showNew: !f._showNew }))} aria-label="Toggle new password visibility">
                              {pwFields._showNew ? '🙈' : '👁️'}
                            </button>
                          </div>
                          <div className="pw-strength-wrapper" id="pw-strength" aria-live="polite">
                            <div className="pw-strength-bar"><span style={{ width: strengthPct + '%'}} data-level={strengthLabel}></span></div>
                            <div className={`pw-strength-label level-${strengthLabel.toLowerCase().replace(/ /g,'-')}`}>{strengthLabel}</div>
                          </div>
                        </div>
                        <div className="pw-field">
                          <label htmlFor="confirmNewPassword">Confirm New Password</label>
                          <div className="pw-input-wrap">
                            <input
                              id="confirmNewPassword"
                              type={pwFields._showConfirm ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={pwFields.confirm}
                              onChange={e => setPwFields(f => ({ ...f, confirm: e.target.value }))}
                              placeholder="Confirm new password"
                              required
                              aria-invalid={confirmMismatch || undefined}
                            />
                            <button type="button" className="pw-eye" onClick={() => setPwFields(f => ({ ...f, _showConfirm: !f._showConfirm }))} aria-label="Toggle confirm password visibility">
                              {pwFields._showConfirm ? '🙈' : '👁️'}
                            </button>
                          </div>
                          {confirmMismatch && <div className="pw-error" role="alert">Passwords do not match.</div>}
                        </div>
                      </div>
                      <div className="pw-rules" id="pw-rules" aria-live="polite">
                        <ul>
                          <li className={rules.length ? 'ok' : ''}>At least 8 characters</li>
                          <li className={rules.upper ? 'ok' : ''}>Uppercase letter</li>
                          <li className={rules.lower ? 'ok' : ''}>Lowercase letter</li>
                          <li className={rules.number ? 'ok' : ''}>Number</li>
                          <li className={rules.symbol ? 'ok' : ''}>Symbol (!@#$…)</li>
                        </ul>
                      </div>
                      <div className="pw-actions">
                        <button type="submit" className="pw-submit" disabled={pwLoading || !strongPw.test(newPw) || confirmMismatch}>{pwLoading ? 'Updating…' : 'Save New Password'}</button>
                        <button type="button" className="pw-cancel-inline" onClick={() => { setShowPasswordSection(false); setPwFields({ current:'', next:'', confirm:'' }); }}>Discard</button>
                      </div>
                    </form>
                  );
                })()}
              </div>
            </div>

  const dedupeNotifications = (items) => {
    const seen = new Set();
    const out = [];
    for (const n of items) {
      const key = `${n.type}|${n.complaintId || ''}|${n.newStatus || ''}|${n.feedback || ''}|${new Date(n.timestamp).toISOString().slice(0,16)}`;
      if (!seen.has(key)) { seen.add(key); out.push(n); }
    }
    return out;
  };

  const checkForStoredNotifications = () => {
    const storedNotifications = localStorage.getItem(`notifications_${user._id}`);
    if (storedNotifications) {
      try {
        const notifications = dedupeNotifications(JSON.parse(storedNotifications));
        const now = Date.now();
        const recentNotifications = notifications.filter(notif => (now - notif.timestamp) < 7 * 24 * 60 * 60 * 1000);
        setNotificationsList(recentNotifications.sort((a, b) => b.timestamp - a.timestamp));
        localStorage.setItem(`notifications_${user._id}`, JSON.stringify(recentNotifications));
        updateNotificationCount();
      } catch (error) {
        localStorage.removeItem(`notifications_${user._id}`);
        setNotificationsList([]);
        setNotificationCount(0);
      }
    } else {
      setNotificationsList([]);
      setNotificationCount(0);
    }
  };

  const clearNotifications = () => {
    const key = `notifications_${user._id}`;
    localStorage.removeItem(key);
    setNotificationsList([]);
    // Keep last seen so badge stays cleared
    setNotificationCount(0);
  };

  const saveNotificationToStorage = (data) => {
    let rawTs = data.timestamp || data.updatedAt || data.verificationDate || Date.now();
    let tsNum = typeof rawTs === 'string' ? Date.parse(rawTs) : Number(rawTs);
    if (!Number.isFinite(tsNum)) tsNum = Date.now();

    const notification = { ...data, timestamp: tsNum };
    const key = `notifications_${user._id}`;
    const lastSeen = parseInt(localStorage.getItem(`notif_last_seen_${user._id}`) || '0', 10);
    let notifications = [];
    try { const stored = localStorage.getItem(key); if (stored) notifications = JSON.parse(stored); } catch {}
    notifications.push(notification);
    notifications = dedupeNotifications(notifications).sort((a,b)=>b.timestamp-a.timestamp);
    if (notifications.length > 50) notifications = notifications.slice(0,50);
    localStorage.setItem(key, JSON.stringify(notifications));
    setNotificationsList(notifications);
    const unreadCount = notifications.filter(n => n.timestamp > lastSeen).length;
    setNotificationCount(unreadCount);
  };

  // Open complaint with fresh data (ensures feedbackEntries present)
  const openComplaint = async (complaintLite) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/complaints/${complaintLite._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        setViewComplaint(complaintLite); // Fallback
        setTimeout(() => scrollThreadToBottomReliable(), 60);
        return;
      }
      const data = await resp.json();
      if (data && data.complaint) {
        setViewComplaint(data.complaint);
        setComplaints(prev => prev.map(c => c._id === data.complaint._id ? data.complaint : c));
        // Mark thread as read (store newest entry timestamp)
        const entries = data.complaint.feedbackEntries || [];
        const latestTs = entries.length ? new Date(entries[entries.length - 1].createdAt).getTime() : Date.now();
        setThreadLastRead(prev => ({ ...prev, [data.complaint._id]: latestTs }));
        setTimeout(() => scrollThreadToBottomReliable(), 60);
      } else {
        setViewComplaint(complaintLite);
        setTimeout(() => scrollThreadToBottomReliable(), 60);
      }
    } catch (e) {
      console.error('Failed to load complaint details', e);
      setViewComplaint(complaintLite);
      setTimeout(() => scrollThreadToBottomReliable(), 60);
    }
  };

  // Scroll to updated complaint
  const scrollToUpdatedComplaint = (complaintId) => {
    const complaintRow = document.querySelector(`tr[data-complaint-id="${complaintId}"]`);
    if (complaintRow) {
      complaintRow.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add a brief highlight effect
      complaintRow.style.transition = 'background-color 0.3s ease';
      complaintRow.style.backgroundColor = '#f0f9ff';
      setTimeout(() => {
        complaintRow.style.backgroundColor = '';
      }, 2000);
    }
  };

  // Handle viewing updates from notification icon
  const handleViewUpdates = (notifications) => {
    if (notifications.length === 0) return;
    
    console.log('Viewing updates:', notifications);
    
    // Show notifications
    notifications.forEach((notif, index) => {
      setTimeout(() => {
        Swal.fire({
          title: 'Status Update!',
          text: notif.message,
          icon: 'info',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          customClass: { popup: 'notif-toast' }
        });
      }, 1000 + (index * 1000)); // Stagger notifications
    });
    
    // Mark complaints as recently updated for visual effect
    const updatedComplaintIds = [...new Set(notifications.map(n => n.complaintId))];
    setComplaints(prevComplaints => 
      prevComplaints.map(complaint => 
        updatedComplaintIds.includes(complaint._id) 
          ? { ...complaint, recentlyUpdated: true, updateTime: Date.now() }
          : complaint
      )
    );
    
    // Scroll to first updated complaint
    setTimeout(() => {
      scrollToUpdatedComplaint(updatedComplaintIds[0]);
    }, 2000);
    
    // Clear the notifications from localStorage
    localStorage.removeItem(`notifications_${user._id}`);
    
    // Update notification count to 0
    setNotificationCount(0);
    
    // Remove the recently updated flag after 15 seconds
    setTimeout(() => {
      setComplaints(prevComplaints => 
        prevComplaints.map(complaint => 
          updatedComplaintIds.includes(complaint._id)
            ? { ...complaint, recentlyUpdated: false }
            : complaint
        )
      );
    }, 15000);
  };



  // Only show notification if logged in and not on login page
  const handleStatusUpdate = (data) => {
    // Prevent notification if not logged in or user is not set
    if (!isLoggedIn || !user || !user._id) return;
    const found = complaints.find(c => c._id === data.complaintId) || {};
    const subject = found.subject || found.type || 'Complaint';
    const complaintType = found.type;
    const location = found.location;
    setComplaints(prevComplaints => 
      prevComplaints.map(complaint => 
        complaint._id === data.complaintId 
          ? { ...complaint, status: data.newStatus, recentlyUpdated: true, updateTime: Date.now() }
          : complaint
      )
    );
    Swal.fire({
      title: 'Status Update!',
      text: data.message,
      icon: 'info',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      customClass: { popup: 'notif-toast' }
    });
    const openNow = viewComplaintRef.current;
    if (openNow && openNow._id === data.complaintId) {
      setViewComplaint(prev => ({ ...prev, status: data.newStatus }));
    }
    saveNotificationToStorage({ ...data, subject, complaintType, location });
    setTimeout(() => { scrollToUpdatedComplaint(data.complaintId); }, 1000);
    setTimeout(() => {
      setComplaints(prevComplaints => 
        prevComplaints.map(complaint => 
          complaint._id === data.complaintId 
            ? { ...complaint, recentlyUpdated: false }
            : complaint
        )
      );
    }, 15000);
  };

  // Threaded feedback SSE handler (append single entry safely)
  const handleThreadFeedbackUpdate = (data) => {
    try { console.log('[SSE:user] feedback_thread_update received', data); } catch {}
    // Merge into complaints list without touching existing summary feedback field
    setComplaints(prev => prev.map(c => {
      if (c._id !== data.complaintId) return c;
      const existing = Array.isArray(c.feedbackEntries) ? c.feedbackEntries : [];
      const dup = existing.some(e => e.createdAt === data.entry.createdAt && e.message === data.entry.message && e.authorType === data.entry.authorType);
      if (dup) return c;
      return { ...c, feedbackEntries: [...existing, data.entry], feedback: c.feedback };
    }));
    // Merge into open modal view using ref to avoid stale closure
    const currentOpen = viewComplaintRef.current;
    if (currentOpen && currentOpen._id === data.complaintId) {
      setViewComplaint(prev => {
        if (!prev) return prev;
        const existing = Array.isArray(prev.feedbackEntries) ? prev.feedbackEntries : [];
        const dup = existing.some(e => e.createdAt === data.entry.createdAt && e.message === data.entry.message && e.authorType === data.entry.authorType);
        if (dup) return prev;
        return { ...prev, feedbackEntries: [...existing, data.entry], feedback: prev.feedback };
      });
      // Decide if we should auto-scroll: only if user is already near bottom (to avoid yanking when reading older msgs)
      setTimeout(() => {
        const listEl = threadListRef.current;
        if (!listEl) return;
        const threshold = 80; // px from bottom considered "near bottom"
        const distanceFromBottom = listEl.scrollHeight - (listEl.scrollTop + listEl.clientHeight);
        if (distanceFromBottom <= threshold) {
          listEl.scrollTop = listEl.scrollHeight; // smooth could be added via CSS scroll-behavior
        }
      }, 40);
      // Mark last read (since user is viewing it)
      const ts = new Date(data.entry.createdAt).getTime();
      setThreadLastRead(prev => ({ ...prev, [data.complaintId]: ts }));
    }
    // Only notify if entry author is admin (thread reply). Distinguish from summary feedback updates.
    if (data.entry && data.entry.authorType === 'admin') {
      try { console.log('[SSE:user] admin entry notification logic triggered'); } catch {}
      const shortMsg = data.entry.message.length > 80 ? data.entry.message.slice(0,80) + '…' : data.entry.message;
      const notification = {
        type: 'feedback_thread_entry',
        complaintId: data.complaintId,
        message: "There's a new message",
        preview: shortMsg,
        authorType: 'admin',
        rawMessage: data.entry.message,
        timestamp: Date.now()
      };
      saveNotificationToStorage(notification);
      Swal.fire({
        title: "There's a new message",
        text: shortMsg,
        icon: 'info',
        toast: true,
        position: 'top-end',
        timer: 4500,
        showConfirmButton: false,
        customClass: { popup: 'notif-toast' }
      });
    }
  };

  // User posts a new threaded feedback message
  const postUserThreadMessage = async () => {
    if (!threadMessageUser.trim() || !viewComplaint) return;
    setPostingUserThread(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/complaints/${viewComplaint._id}/feedback-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: threadMessageUser.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to send');
      setThreadMessageUser('');
      // Merge returned complaint but keep existing summary feedback (avoid accidental overwrite)
      setComplaints(prev => prev.map(c => {
        if (c._id !== data.complaint._id) return c;
        const existingFeedback = c.feedback; // preserve summary
        return { ...data.complaint, feedback: existingFeedback };
      }));
      if (viewComplaint && viewComplaint._id === data.complaint._id) {
        setViewComplaint(prev => {
          const existingFeedback = prev ? prev.feedback : data.complaint.feedback;
          return { ...data.complaint, feedback: existingFeedback };
        });
        // Scroll after DOM paints new message
        setTimeout(() => {
          if (threadListRef.current) {
            threadListRef.current.scrollTop = threadListRef.current.scrollHeight;
          }
        }, 50);
        const entries = data.complaint.feedbackEntries || [];
        const latestTs = entries.length ? new Date(entries[entries.length - 1].createdAt).getTime() : Date.now();
        setThreadLastRead(prev => ({ ...prev, [data.complaint._id]: latestTs }));
      }
    } catch (e) {
      console.error('Failed to post thread message', e);
    } finally {
      setPostingUserThread(false);
    }
  };

  // Render missed notifications (after login), under welcome
  function renderMissedNotifications() {
    if (!justLoggedIn || missedNotifications.length === 0) return null;
    // Show SweetAlert for each missed notification after welcome
    setTimeout(() => {
      missedNotifications.forEach((notif, idx) => {
        setTimeout(() => {
          Swal.fire({
            title: 'Status Update!',
            text: notif.message,
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            customClass: { popup: 'notif-toast' }
          });
        }, idx * 1200);
      });
      // After showing, clear missed notifications so they don't repeat
      setMissedNotifications([]);
      setJustLoggedIn(false);
    }, 1200); // Delay to allow welcome alert to show first
    // Also render below welcome for visual context
    return (
      <div className="missed-notifications-container" style={{ marginTop: 16 }}>
        {missedNotifications.map((notif, idx) => (
          <div key={notif._id || idx} className="missed-notification-alert" style={{ marginBottom: 8 }}>
            <div style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', borderRadius: 8, padding: 12, color: '#92400e', fontWeight: 500 }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{notif.message}</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>Time: {new Date(notif.timestamp).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Show SweetAlert for missed notifications after login using useEffect
  useEffect(() => {
    if (justLoggedIn && missedNotifications.length > 0) {
      // Show SweetAlert for each missed notification after welcome
      let alertTimeouts = [];
      const timer = setTimeout(() => {
        missedNotifications.forEach((notif, idx) => {
          const t = setTimeout(() => {
            Swal.fire({
              title: 'Status Update!',
              text: notif.message,
              icon: 'info',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 5000,
              timerProgressBar: true,
              customClass: { popup: 'notif-toast' }
            });
          }, idx * 1200);
          alertTimeouts.push(t);
        });
        // After showing, clear missed notifications so they don't repeat
        setMissedNotifications([]);
        setJustLoggedIn(false);
      }, 1200); // Delay to allow welcome alert to show first
      return () => {
        clearTimeout(timer);
        alertTimeouts.forEach(clearTimeout);
      };
    }
  }, [justLoggedIn, missedNotifications]);

  const handleCredentialVerification = (data) => {
    if (data.status === 'approved') {
      Swal.fire({
        title: '🎉 Credentials Approved!',
        text: data.message,
        icon: 'success',
        confirmButtonText: 'View Details',
        showCancelButton: true,
        cancelButtonText: 'Close',
      }).then(async (result) => {
        if (result.isConfirmed) {
          // Show detailed approval information
          Swal.fire({
            title: 'Approval Details',
            html: `
              <div style="text-align: left;">
                <p><strong>Status:</strong> <span style="color: #059669;">Approved</span></p>
                <p><strong>Date:</strong> ${new Date(data.verificationDate).toLocaleDateString()}</p>
                <p><strong>Admin Notes:</strong> ${data.adminNotes || 'No additional notes'}</p>
                <p><strong>Next Steps:</strong> Your account is now fully verified!</p>
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'Great!'
          });
        }
      });
    } else if (data.status === 'rejected') {
      Swal.fire({
        title: '⚠️ Credentials Need Attention',
        text: data.message,
        icon: 'warning',
        confirmButtonText: 'View Issues',
        showCancelButton: true,
        cancelButtonText: 'Close',
      }).then(async (result) => {
        if (result.isConfirmed) {
          // Show detailed rejection information
          Swal.fire({
            title: 'Issues Found',
            html: `
              <div style="text-align: left;">
                <p><strong>Status:</strong> <span style="color: #dc2626;">Rejected</span></p>
                <p><strong>Date:</strong> ${new Date(data.verificationDate).toLocaleDateString()}</p>
                <p><strong>Issues Found:</strong></p>
                <div style="background: #fef2f2; padding: 10px; border-radius: 5px; margin: 10px 0;">
                  ${data.issueDetails}
                </div>
                <p><strong>Required Actions:</strong></p>
                <div style="background: #f0f9ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
                  ${data.requiredActions}
                </div>
                <p><strong>Admin Notes:</strong> ${data.adminNotes || 'No additional notes'}</p>
              </div>
            `,
            icon: 'warning',
            confirmButtonText: 'I Understand'
          });
        }
      });
    }
  };

  const handleCredentialResubmission = (data) => {
    Swal.fire({
      title: '📋 Resubmission Required',
      text: data.message,
      icon: 'info',
      confirmButtonText: 'View Requirements',
      showCancelButton: true,
      cancelButtonText: 'Close',
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Show detailed resubmission requirements
        Swal.fire({
          title: 'Resubmission Requirements',
          html: `
            <div style="text-align: left;">
              <p><strong>Reason:</strong></p>
              <div style="background: #fffbeb; padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${data.reason}
              </div>
              <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>
              <p><strong>Request Date:</strong> ${new Date(data.requestDate).toLocaleDateString()}</p>
              <p><strong>Next Steps:</strong> Please upload corrected credentials before the deadline.</p>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'Got It'
        });
      }
    });
  };

  // On mount, fetch user info from backend using JWT, update state/localStorage, then fetch complaints
  useEffect(() => {
    const fetchUserAndComplaints = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await api.get('/api/user/me');
        if (res.data && res.data.user && res.data.user._id) {
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          fetchComplaints(res.data.user._id, token);
        }
      } catch (err) {
        setUser({
          _id: '',
          firstName: 'User',
          lastName: '',
          email: 'user@email.com',
          phoneNumber: '',
          address: '',
          credentials: [],
          profilePicture: null,
        });
        setComplaints([]);
      }
    };
    fetchUserAndComplaints();
    // eslint-disable-next-line
  }, []);

  // Refresh user data every 30 seconds to get admin updates
  useEffect(() => {
    if (user._id) {
      // Load stored notifications and update badge immediately
      checkForStoredNotifications();
      updateNotificationCount();
      const interval = setInterval(() => {
        refreshAllData();
      }, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [user._id]);

  // Recalculate notification count when user data changes
  useEffect(() => {
    if (user._id) {
      setNotificationCount(calculateNotificationCount());
    }
  }, [user.verificationStatus, user.adminNotes, user.issueDetails, user.requiredActions, user.resubmissionRequested, complaints]);

  // Fetch complaints for a given userId (MongoDB _id) and token
  const fetchComplaints = async (uid, tokenOverride) => {
    // Use provided id or fall back to current user state
    const userId = uid || user._id;
    if (!userId) return; // do NOT clear existing complaints prematurely
    try {
      const token = tokenOverride || localStorage.getItem('token');
      const res = await api.get(`/api/complaints/user/${userId}`);
      setComplaints(res.data.complaints || []);
    } catch (err) {
      // Keep previous complaints on transient fetch error
      console.error('fetchComplaints error:', err?.message || err);
    }
  };

  useEffect(() => {
    if (user._id) {
      fetchComplaints(user._id);
    }
  }, [user._id]);

  // Initialize notification count when complaints are loaded
  useEffect(() => {
    if (complaints && user._id) {
      setNotificationCount(calculateNotificationCount());
    }
  }, [complaints, user._id]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Are you sure you want to log out?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
    });
    if (result.isConfirmed) {
      // Store current complaints before logout for future comparison
      if (complaints.length > 0) {
        localStorage.setItem(`complaints_${user._id}`, JSON.stringify(complaints));
        console.log('Stored complaints before logout:', complaints);
      }
      // Store logout time
      const logoutTime = Date.now();
      localStorage.setItem(`lastLogin_${user._id}`, logoutTime.toString());
      console.log('Stored logout time:', new Date(logoutTime).toLocaleString());
      // Close real-time connection if open
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Remove notification state
      setMissedNotifications([]);
      setNotificationsList([]);
      setNotificationCount(0);
      setRealtimeConnected(false);
      setIsLoggedIn(false);
      setJustLoggedIn(false);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleShowNotifications = () => {
    setShowNotifications(true);
    const now = Date.now();
    localStorage.setItem(`notif_last_seen_${user._id}`, now.toString());
    setNotificationCount(0);
    setTimeout(() => {
      if (notificationContentRef.current) {
        notificationContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  const calculateNotificationCount = () => {
    let count = 0;
    
    // Count user verification status changes
    if (user.verificationStatus === 'rejected' || user.verificationStatus === 'resubmission_required') {
      count++;
    }
    
    // Count complaint status updates from admin (all statuses)
    if (complaints && complaints.length > 0) {
      complaints.forEach(complaint => {
        // Count all status changes that admin makes
        if (complaint.status === 'pending' || complaint.status === 'in_progress' || 
            complaint.status === 'solved' || complaint.status === 'rejected' || 
            complaint.status === 'approved') {
          count++;
        }
      });
    }
    
    console.log('Notification count calculated:', count, 'complaints:', complaints?.length, 'user status:', user.verificationStatus);
    return count;
  };

  const refreshUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
  const response = await api.get('/api/user/me');
      const updatedUser = response.data.user;
      if (!updatedUser || !updatedUser._id) return;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setNotificationCount(calculateNotificationCount());
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Snapshot previous complaints to detect changes
  const COMPLAINTS_SNAPSHOT_KEY = (uid) => `complaints_snapshot_${uid}`;

  const detectAndNotifyComplaintChanges = (latestComplaints) => {
    if (!user._id) return;
    try {
      const raw = localStorage.getItem(COMPLAINTS_SNAPSHOT_KEY(user._id));
      const prev = raw ? JSON.parse(raw) : [];
      const prevById = new Map(prev.map(c => [c._id, c]));
      latestComplaints.forEach(newC => {
        const old = prevById.get(newC._id);
        if (!old) return;
        if (old.status !== newC.status) {
          saveNotificationToStorage({
            type: 'status_update',
            complaintId: newC._id,
            subject: newC.subject || newC.type || 'Complaint',
            oldStatus: old.status,
            newStatus: newC.status,
            updatedAt: newC.updatedAt,
            message: `Your complaint changed from "${old.status}" to "${newC.status}".`
          });
        }
        if ((old.feedback || '') !== (newC.feedback || '') && newC.feedback) {
          saveNotificationToStorage({
            // legacy feedback_update removed
            complaintId: newC._id,
            subject: newC.subject || newC.type || 'Complaint',
            feedback: newC.feedback,
            updatedAt: newC.updatedAt,
            message: 'Admin added a new message to your complaint.'
          });
        }
      });
      // Store latest snapshot for next diff
      localStorage.setItem(COMPLAINTS_SNAPSHOT_KEY(user._id), JSON.stringify(latestComplaints.map(c => ({ _id: c._id, status: c.status, feedback: c.feedback }))));
    } catch (e) {
      // Best-effort; reset snapshot
      localStorage.setItem(COMPLAINTS_SNAPSHOT_KEY(user._id), JSON.stringify(latestComplaints.map(c => ({ _id: c._id, status: c.status, feedback: c.feedback }))));
    }
  };

  const refreshComplaintsData = async () => {
    try {
      if (!user._id) return;
  const response = await api.get(`/api/complaints/user/${user._id}`);
      const latest = response.data.complaints || [];
      detectAndNotifyComplaintChanges(latest);
      setComplaints(latest);
      console.log('Complaints refreshed:', latest);
      updateNotificationCount();
    } catch (error) {
      console.error('Failed to refresh complaints data:', error);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([refreshUserData(), refreshComplaintsData()]);
  };

  // Handler for profile field changes (restored)
  const handleEditChange = (e) => {
    const { name, value, files } = e.target;
    // Phone formatting (retain previous logic if existed earlier)
    if (name === 'phoneNumber') {
      const digits = value.replace(/\D/g, '').slice(0, 11); // limit to 11 digits
      let display = digits;
      if (digits.length > 4 && digits.length <= 7) {
        display = `${digits.slice(0,4)}-${digits.slice(4)}`;
      } else if (digits.length > 7) {
        display = `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
      }
      setEditData(ed => ({ ...ed, phoneNumber: display }));
      return;
    }
    if (name === 'profilePic' && files && files[0]) {
      const file = files[0];
      const isValidType = /image\/(jpeg|jpg|png)/i.test(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024;
      if (!isValidType || !isValidSize) {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid Image',
          text: !isValidType ? 'Please select a JPG or PNG image.' : 'Image must be 10MB or smaller.',
          timer: 3200,
          showConfirmButton: false
        });
        return;
      }
      setEditData(ed => ({ ...ed, file, profilePic: URL.createObjectURL(file) }));
    } else {
      setEditData(ed => ({ ...ed, [name]: value }));
    }
  };

  // Profile save handler (moved earlier so it's defined before JSX usage)
  const handleEditProfile = async (e) => {
    e.preventDefault();
    const result = await Swal.fire({
      title: 'Are you sure you want to save changes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('firstName', editData.firstName);
      formData.append('lastName', editData.lastName);
      formData.append('phoneNumber', (editData.phoneNumber || '').replace(/\D/g, ''));
      formData.append('address', editData.address);
      if (editData.file) formData.append('profilePic', editData.file);
      const res = await api.patch('/api/user', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.user) {
        const updatedUser = { ...res.data.user };
        if (updatedUser.profilePicture) updatedUser.profilePicture = withCacheBust(updatedUser.profilePicture);
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setEditData({
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phoneNumber: updatedUser.phoneNumber || '',
            address: updatedUser.address || '',
          profilePic: updatedUser.profilePicture || '',
          file: null,
        });
        setShowEdit(false);
        Swal.fire({ icon: 'success', title: 'Profile updated!' });
        await Promise.all([
          fetchComplaints(updatedUser._id),
          refreshUserData && refreshUserData()
        ]);
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to update profile.', 'error');
    }
    setLoading(false);
  };

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!pwFields.current || !pwFields.next || !pwFields.confirm) {
      Swal.fire('Missing Fields', 'Please fill in all password fields.', 'warning');
      return;
    }
    if (pwFields.next === pwFields.current) {
      Swal.fire('Invalid Password', 'New password must be different from current password.', 'warning');
      return;
    }
    if (!strongPw.test(pwFields.next)) {
      Swal.fire('Weak Password', 'Password must have upper, lower, number, special character and be at least 8 characters.', 'warning');
      return;
    }
    if (pwFields.next !== pwFields.confirm) {
      Swal.fire('Mismatch', 'New password and confirmation do not match.', 'warning');
      return;
    }
    try {
      setPwLoading(true);
      const res = await api.patch('/api/auth/change-password', {
        currentPassword: pwFields.current,
        newPassword: pwFields.next
      });
      if (res.data && res.data.success) {
        Swal.fire({ icon: 'success', title: 'Password changed!', text: 'A confirmation email was sent to your inbox.' });
        setPwFields({ current: '', next: '', confirm: '' });
        setShowPasswordSection(false);
      } else {
        Swal.fire('Error', (res.data && res.data.message) || 'Failed to change password.', 'error');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to change password.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setPwLoading(false);
    }
  }

  // Close Edit Profile modal and cleanup blob preview URL to prevent memory leaks
  const handleCloseEditModal = () => {
    if (editData && editData.profilePic && editData.profilePic.startsWith('blob:')) {
      try { URL.revokeObjectURL(editData.profilePic); } catch {}
    }
    setShowEdit(false);
  };

  // Remove profile picture handler
  const handleRemoveProfilePicture = async () => {
    if (!user.profilePicture) {
      // Nothing to remove
      setEditData(ed => ({ ...ed, profilePic: '', file: null }));
      return;
    }
    const result = await Swal.fire({
      title: 'Remove profile picture?',
      text: 'This will delete the current profile photo. You can upload a new one later.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    try {
      setLoading(true);
      await api.delete('/api/user/profile-picture');
      const cleared = { ...user, profilePicture: null, profilePicturePublicId: null };
      setUser(cleared);
      localStorage.setItem('user', JSON.stringify(cleared));
      setEditData(ed => ({
        ...ed,
        profilePic: '',
        file: null
      }));
      Swal.fire({ icon: 'success', title: 'Profile picture removed' });
    } catch (err) {
      Swal.fire('Error', 'Failed to remove profile picture.', 'error');
    }
    setLoading(false);
  };

  // Complaint form handlers
  const handleComplaintChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setComplaint({ ...complaint, [name]: checked });
    } else if (type === 'file') {
      const MAX_BYTES = 10 * 1024 * 1024; // 10MB
      const list = files ? Array.from(files) : [];
      const tooLarge = list.filter(f => f.size > MAX_BYTES);
      if (tooLarge.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large',
          html: `The following file(s) exceed the 10MB limit:<br/><ul style="text-align:left;">${tooLarge.map(f=>`<li>${f.name} (${(f.size/1024/1024).toFixed(2)}MB)</li>`).join('')}</ul>`,
        });
      }
      const accepted = list.filter(f => f.size <= MAX_BYTES).slice(0,5); // still respect max 5 on client side
      setComplaint({ ...complaint, evidence: accepted });
    } else {
      setComplaint({ ...complaint, [name]: value });
    }
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('userId', user._id);
      formData.append('fullName', complaint.fullName);
      formData.append('contact', complaint.contact);
      formData.append('date', complaint.date);
      formData.append('time', complaint.time);
      formData.append('location', complaint.location);
      formData.append('people', complaint.people);
      formData.append('description', complaint.description);
      formData.append('type', complaint.type);
      formData.append('resolution', complaint.resolution);
      if (complaint.evidence && complaint.evidence.length > 0) {
        complaint.evidence.forEach(file => formData.append('evidence', file));
      }
      const token = localStorage.getItem('token');
      const res = await api.post('/api/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Save a notification for the submission so count updates immediately
      try {
        const created = res && res.data && (res.data.complaint || res.data.createdComplaint || res.data.data);
        const createdAt = (created && (created.createdAt || created.updatedAt)) || Date.now();
        const notifPayload = {
          type: 'status_update',
          newStatus: (created && created.status) || 'pending',
          complaintId: created && created._id ? created._id : undefined,
          subject: created && created.subject ? created.subject : undefined,
          complaintType: created && created.type ? created.type : complaint.type,
          location: created && created.location ? created.location : complaint.location,
          message: 'Your complaint has been submitted and is now pending review.',
          updatedAt: createdAt
        };
        saveNotificationToStorage(notifPayload);
      } catch (e) { /* non-blocking */ }
      Swal.fire('Submitted!', 'Your complaint has been submitted.', 'success');
      setShowComplaint(false);
      fetchComplaints(user._id);
      // Reset form
      setComplaint(c => ({
        ...c,
        date: '',
        time: '',
        location: '',
        people: '',
        description: '',
        evidence: [],
        type: '',
        resolution: '',
      }));
    } catch (err) {
      Swal.fire('Error', 'Failed to submit complaint.', 'error');
    }
    setLoading(false);
  };

  // Edit complaint handlers
  const handleEditComplaintChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setEditComplaintData({ ...editComplaintData, [name]: checked });
    } else if (type === 'file') {
      setEditComplaintData({ ...editComplaintData, evidence: files ? Array.from(files) : [] });
    } else {
      setEditComplaintData({ ...editComplaintData, [name]: value });
    }
  };

  const handleEditComplaintSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('fullName', editComplaintData.fullName);
      formData.append('contact', editComplaintData.contact);
      formData.append('date', editComplaintData.date);
      formData.append('time', editComplaintData.time);
      formData.append('location', editComplaintData.location);
      formData.append('people', editComplaintData.people);
      formData.append('description', editComplaintData.description);
      formData.append('type', editComplaintData.type);
      formData.append('resolution', editComplaintData.resolution);
      if (editComplaintData.evidence && editComplaintData.evidence.length > 0) {
        editComplaintData.evidence.forEach(file => formData.append('evidence', file));
      }
      if (editComplaintData.replaceEvidence) {
        formData.append('replaceEvidence', 'true');
      }
      await api.patch(`/api/complaints/${editComplaint._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire('Updated!', 'Your complaint has been updated.', 'success');
      setEditComplaint(null);
      setEditComplaintData(null);
      fetchComplaints(user._id);
    } catch (err) {
      Swal.fire('Error', 'Failed to update complaint.', 'error');
    }
    setLoading(false);
  };

  const handleDeleteComplaint = async (complaintId) => {
    const result = await Swal.fire({
      title: 'Are you sure you want to delete this complaint?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
  await api.delete(`/api/complaints/${complaintId}`);
      Swal.fire('Deleted!', 'Your complaint has been deleted.', 'success');
      fetchComplaints(user._id);
    } catch (err) {
      Swal.fire('Error', 'Failed to delete complaint.', 'error');
    }
    setLoading(false);
  };

  // Force scroll to bottom on every modal open using layout phase + rAF retries
  useLayoutEffect(() => {
    if (!viewComplaint) return;
    let frame = 0;
    const maxFrames = 6; // ~6 * 16ms ≈ <100ms coverage
    const attempt = () => {
      scrollThreadToBottomReliable(1); // single immediate scroll per frame
      frame++;
      if (frame < maxFrames) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
    // no cleanup needed besides letting frames finish
  }, [viewComplaint?._id]);

  // Derive user initial for avatar fallback (first letter of first name, else email, else 'U')
  const userInitial = (user.firstName || user.email || 'U').trim()[0]?.toUpperCase() || 'U';

  // Simple deterministic background color based on user id/email for visual variety
  function computeColorFromString(str) {
    try {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 65%, 55%)`;
    } catch {
      return '#2563eb';
    }
  }
  const avatarBg = computeColorFromString(user.firstName || user.email || user._id || 'User');

  // Compute unread admin messages for a complaint
  const unreadForComplaint = (c) => {
    try {
      const lastRead = threadLastRead[c._id] || 0;
      const entries = c.feedbackEntries || [];
      return entries.filter(e => e.authorType === 'admin' && new Date(e.createdAt).getTime() > lastRead).length;
    } catch { return 0; }
  };

  const profilePic = user.profilePicture ? toAbsolute(user.profilePicture) : null;
  const editPreviewSrc = editData.profilePic
    ? (editData.profilePic.startsWith('blob:') ? editData.profilePic : toAbsolute(editData.profilePic))
    : (user.profilePicture ? toAbsolute(user.profilePicture) : null);

  const handleViewComplaintFromNotification = async (complaintId) => {
    try {
      // Always refresh to ensure latest state from server
      await refreshComplaintsData();
      const target = complaints.find(c => c._id === complaintId);
      setShowNotifications(false);

      if (target) {
        // Smooth scroll to row and open details
        scrollToUpdatedComplaint(complaintId);
        setTimeout(() => setViewComplaint(target), 400);
      } else {
        // Mark notification as deleted in storage and state
        const key = `notifications_${user._id}`;
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = stored.map(n => (
            n.complaintId === complaintId
              ? { ...n, deleted: true, message: 'This complaint was deleted and can no longer be viewed.' }
              : n
          ));
          localStorage.setItem(key, JSON.stringify(updated));
          setNotificationsList(updated);
        } catch {}

        // Inform the user
        Swal.fire({
          title: 'Complaint Deleted',
          text: 'This complaint has been deleted and is no longer available.',
          icon: 'info',
          confirmButtonText: 'OK'
        });
      }
    } catch (e) {
      setShowNotifications(false);
    }
  };

  // Render the fullscreen evidence modal for complaints (user side)
  function renderEvidenceModal() {
    if (!viewComplaint || !viewComplaint.evidence || !evidenceModal.open) return null;
    const evidenceList = (viewComplaint.evidence || []).map(ev => {
      if (!ev) return '';
      if (typeof ev === 'string') return ev;
      if (ev.url) return ev.url; // new object shape
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
        {evidenceList.length > 1 && (
          <>
            <button className="evidence-messenger-arrow left" onClick={handlePrev} title="Previous">&#10094;</button>
            <button className="evidence-messenger-arrow right" onClick={handleNext} title="Next">&#10095;</button>
          </>
        )}
        <div className="evidence-messenger-modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
          <button className="evidence-messenger-close-modal" onClick={handleClose} title="Close">×</button>
          <div className="evidence-messenger-media">
            {['jpg','jpeg','png','gif','bmp','webp','jfif'].includes(ext) ? (
              <img src={url} alt={`Evidence ${idx + 1}`} className="evidence-messenger-img" />
            ) : ['mp4','avi','mov','wmv','flv','webm','ogg'].includes(ext) ? (
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

  // Complaint history view toggle
  const [showHistory, setShowHistory] = useState(false);

  // Show a global loading overlay while initial user + complaints load (first mount)
  const initialLoading = !user || !complaints || (complaints.length === 0 && !Array.isArray(complaints));


  // ===== Scroll Lock for Open Modals (prevent background page scroll) =====
  useEffect(() => {
    const anyModalOpen = showProfile || showEdit || showComplaint || !!viewComplaint || !!editComplaint || showNotifications || !!editComplaintData;
    const body = document.body;
    if (anyModalOpen) {
      // Preserve current scroll position
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      body.dataset.prevScrollY = String(scrollY);
      body.classList.add('modal-open');
      body.style.top = `-${scrollY}px`;
      body.style.position = 'fixed';
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    } else {
      if (body.classList.contains('modal-open')) {
        const prev = parseInt(body.dataset.prevScrollY || '0', 10);
        body.classList.remove('modal-open');
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        window.scrollTo(0, prev);
      }
    }
    return () => { /* cleanup on unmount */
      body.classList.remove('modal-open');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
    };
  }, [showProfile, showEdit, showComplaint, viewComplaint, editComplaint, showNotifications, editComplaintData]);

  return (
    <div className="dashboard-container" style={{ position:'relative' }}>
  <LoadingOverlay show={loading} text="Processing..." iconSize={44} large={false} minimal />
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-actions">
          <button className="notification-btn" onClick={handleShowNotifications}>
            <svg className="notification-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {notificationCount > 0 && (
              <div className="notification-badge">
                {notificationCount}
              </div>
            )}
              </button>
          <button className="profile-btn" onClick={() => setShowProfile(true)}>
            {profilePic ? (
              <SmartImage
                src={profilePic}
                type="profile"
                alt="Profile"
                className="profile-inline-avatar"
                size={40}
                userNameForAvatar={user.firstName || user.email || 'User'}
              />
            ) : (
              <SmartImage
                src="" // force fallback
                type="profile"
                alt="Profile"
                className="profile-inline-avatar"
                size={40}
                userNameForAvatar={user.firstName || user.email || 'User'}
              />
            )}
          </button>
        </div>
      </header>
      {/* Main Content */}
      <div className="dashboard-main">
  <h3>Welcome back, {user.firstName}!</h3>
  <p>Here you can view updates, submit complaints, and track the status of your reports. Feel free to explore the features available on your dashboard.</p>
  {renderMissedNotifications()}

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card total">
            <div className="summary-title">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Total Complaints
            </div>
            <div className="summary-value">{totalComplaints}</div>
          </div>
          <div className="summary-card pending">
            <div className="summary-title">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0 0v-4m0 0l-2 2m2-2l2 2" clipRule="evenodd"/>
              </svg>
              Pending
            </div>
            <div className="summary-value">{pendingCount}</div>
          </div>
          <div className="summary-card progress">
            <div className="summary-title">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
              </svg>
              In Progress
            </div>
            <div className="summary-value">{inProgressCount}</div>
          </div>
          <div className="summary-card solved">
            <div className="summary-title">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a0 0 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              Solved
            </div>
            <div className="summary-value">{solvedCount}</div>
          </div>
        </div>



        <div className="dashboard-content-section">
          {/* Complaints List */}
          <div className="dashboard-complaints-table">
            <div className="complaints-header">
              <h4>{showHistory ? 'Your Complaints History' : 'Your Complaints'}</h4>
              <div className="complaints-header-actions">
                <button
                  onClick={() => setShowComplaint(true)}
                  className="dashboard-add-complaint-btn"
                  style={{ minWidth: 120, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+</span>
                  Add Complaint
                </button>
                <button
                  className="dashboard-add-complaint-btn"
                  style={{ minWidth: 120, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8, background: showHistory ? '#2563eb' : '#fff', color: showHistory ? '#fff' : '#2563eb', border: '2px solid #2563eb', fontWeight: 600, boxShadow: '0 2px 8px #2563eb22' }}
                  title="View Complaint History"
                  onClick={() => setShowHistory(h => !h)}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0 0v-4m0 0l-2 2m2-2l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {showHistory ? 'Back to Complaints' : 'History'}
                </button>
              </div>
            </div>
            <div className="table-responsive-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Action</th>
                               </tr>
              </thead>
              <tbody>
                {(!showHistory
                  ? complaints.filter(c => (c.status || '').toLowerCase() !== 'solved')
                  : complaints.filter(c => (c.status || '').toLowerCase() === 'solved')
                ).length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: 18, fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" style={{ color: '#60a5fa' }}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v2m0-2a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        No complaints yet
                      </span>
                    </td>
                  </tr>
                ) : (
                  (showHistory
                    ? complaints.filter(c => (c.status || '').toLowerCase() === 'solved')
                    : complaints.filter(c => (c.status || '').toLowerCase() !== 'solved')
                  ).map(c => (
                    <tr key={c._id} data-complaint-id={c._id}>
                      <td style={{ position: 'relative' }}>
                        {c.date}
                        {unreadForComplaint(c) > 0 && (
                          <span style={{
                            position: 'absolute',
                            top: 2,
                            left: 4,
                            background: '#ef4444',
                            color: '#fff',
                            borderRadius: '10px',
                            padding: '0 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            lineHeight: '16px'
                          }} title={`${unreadForComplaint(c)} unread message(s)`}>
                            {unreadForComplaint(c)}
                          </span>
                        )}
                      </td>
                      <td>{c.type}</td>
                      <td>{c.location}</td>
                      <td>
                        <div className="status-container">
                          <span className={`status-badge status-${c.status?.toLowerCase().replace(' ', '-')}`}>{c.status}</span>
                          {c.recentlyUpdated && (
                            <div className="update-swap">
                              <span className="swap-text">Just Updated!</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="dashboard-action-buttons">
                          <button onClick={() => openComplaint(c)} className="action-btn view-btn">View</button>
                          {!showHistory && (
                            <button onClick={() => { setEditComplaint(c); setEditComplaintData({ ...c, evidence: [] }); }} className="edit-btn">Edit</button>
                          )}
                          <button onClick={() => handleDeleteComplaint(c._id)} className="delete-btn">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Profile Modal */}
      {showEdit && (
  <div className="dashboard-modal-bg" onClick={handleCloseEditModal}>
    <div className="dashboard-modal edit-profile-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={handleCloseEditModal}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <h3>Edit Profile</h3>
            <form onSubmit={handleEditProfile}>
              <div className="profile-pic-container">
                <div className="profile-photo-wrapper">
                  <div
                    className="profile-photo-clickable"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title="Click to change photo"
                  >
                    {editPreviewSrc ? (
                      <SmartImage
                        src={editPreviewSrc}
                        type="profile"
                        alt="Profile"
                        className="profile-pic-large"
                        size={260}
                        userNameForAvatar={user.firstName || user.email || 'User'}
                      />
                    ) : (
                      <SmartImage
                        src=""
                        type="profile"
                        alt="Profile"
                        className="profile-pic-large"
                        size={260}
                        userNameForAvatar={user.firstName || user.email || 'User'}
                      />
                    )}
                    <div className="profile-photo-overlay">
                      <span>Change Photo</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    name="profilePic"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleEditChange}
                    style={{ display: 'none' }}
                  />
                  {/* Removed file name and badge per user request; immediate image preview only */}
                  {(user.profilePicture || editData.profilePic) && (
                    <button
                      type="button"
                      className="photo-remove-icon"
                      aria-label="Remove profile photo"
                      title={loading ? 'Removing...' : 'Remove Photo'}
                      onClick={handleRemoveProfilePicture}
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="spinner" />
                      ) : (
                        <img src={deleteIcon} alt="Delete" className="photo-remove-icon-img" />
                      )}
                    </button>
                  )}
                  <small className="photo-hint">Click the image to upload a new one (JPG/PNG). Max ~10MB.</small>
                </div>
              </div>
              <div className="profile-input-container">
                <div className="input-wrapper">
                  <label className="field-label" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    value={editData.firstName}
                    onChange={handleEditChange}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div className="input-wrapper">
                  <label className="field-label" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    value={editData.lastName}
                    onChange={handleEditChange}
                    placeholder="Last Name"
                    required
                  />
                </div>
                <div className="input-wrapper">
                  <label className="field-label" htmlFor="phoneNumber">Phone Number</label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    name="phoneNumber"
                    value={editData.phoneNumber}
                    onChange={handleEditChange}
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div className="input-wrapper">
                  <label className="field-label" htmlFor="address">Address</label>
                  <input
                    id="address"
                    type="text"
                    name="address"
                    value={editData.address}
                    onChange={handleEditChange}
                    placeholder="Street, Barangay, City"
                  />
                </div>
              </div>
              <div className="profile-actions single-action">
                <button type="submit" disabled={loading} className="profile-action-btn">
                  Save Changes
                </button>
              </div>
            </form>
            {/* Password Change Section */}
            <div className="password-change-wrapper">
              <button
                type="button"
                onClick={() => setShowPasswordSection(s => !s)}
                className={showPasswordSection ? 'pw-toggle-btn-primary pw-toggle-btn-cancel' : 'pw-toggle-btn-primary'}
              >
                {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
              </button>
              {showPasswordSection && (
                <form onSubmit={handleChangePassword} className="password-card">
                  <h4>Update Password</h4>
                  <div className="password-grid">
                    <div className="input-wrapper pw-input-group">
                      <label className="field-label" htmlFor="currentPassword">Current Password</label>
                      <input
                        id="currentPassword"
                        type={pwFields.showCurrent ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={pwFields.current}
                        onChange={e => setPwFields(f => ({ ...f, current: e.target.value }))}
                        placeholder="Current Password"
                        required
                      />
                      <button type="button" className="pw-show-btn" onClick={() => setPwFields(f => ({ ...f, showCurrent: !f.showCurrent }))}>{pwFields.showCurrent ? 'Hide' : 'Show'}</button>
                    </div>
                    <div className="input-wrapper pw-input-group">
                      <label className="field-label" htmlFor="newPassword">New Password</label>
                      <input
                        id="newPassword"
                        type={pwFields.showNew ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={pwFields.next}
                        onChange={e => setPwFields(f => ({ ...f, next: e.target.value }))}
                        placeholder="New Password"
                        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}"
                        required
                      />
                      <button type="button" className="pw-show-btn" onClick={() => setPwFields(f => ({ ...f, showNew: !f.showNew }))}>{pwFields.showNew ? 'Hide' : 'Show'}</button>
                    </div>
                    <div className="input-wrapper pw-input-group">
                      <label className="field-label" htmlFor="confirmNewPassword">Confirm New Password</label>
                      <input
                        id="confirmNewPassword"
                        type={pwFields.showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={pwFields.confirm}
                        onChange={e => setPwFields(f => ({ ...f, confirm: e.target.value }))}
                        placeholder="Confirm New Password"
                        required
                      />
                      <button type="button" className="pw-show-btn" onClick={() => setPwFields(f => ({ ...f, showConfirm: !f.showConfirm }))}>{pwFields.showConfirm ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                  <div className="pw-hint">Must include uppercase, lowercase, number, special character. Minimum 8 characters.</div>
                  <div className="pw-actions">
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="pw-submit-btn"
                    >
                      {pwLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Add Complaint Modal */}
      {showComplaint && (
        <div className="dashboard-modal-bg" onClick={() => setShowComplaint(false)}>
          <div className="dashboard-modal add-complaint-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => setShowComplaint(false)}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <div className="complaint-header">
              <h3>Add Complaint</h3>
            </div>
            <form onSubmit={handleComplaintSubmit} className="complaint-form">
              <div className="complaint-input-container">
                <label className="complaint-label">Full Name and Contact Info:</label>
                <div className="complaint-inline-pair">
                  <input
                    type="text"
                    name="fullName"
                    value={complaint.fullName}
                    readOnly
                    className="readonly-field"
                    placeholder="Full Name"
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type="email"
                    name="contact"
                    value={complaint.contact}
                    readOnly
                    className="readonly-field"
                    placeholder="Contact Info"
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Date and Time of Incident:</label>
                <div className="complaint-inline-pair">
                  <input type="date" name="date" value={complaint.date} onChange={handleComplaintChange} required style={{ flex: 1 }} />
                  <input type="time" name="time" value={complaint.time} onChange={handleComplaintChange} required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">People/Group Involved and Location:</label>
                <div className="complaint-inline-pair">
                  <input type="text" name="people" value={complaint.people} onChange={handleComplaintChange} placeholder="People or group involved" style={{ flex: 1 }} />
                  <input type="text" name="location" value={complaint.location} onChange={handleComplaintChange} placeholder="Location" required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container textarea">
                <label className="complaint-label">Description of what happened:</label>
                <textarea name="description" value={complaint.description} onChange={handleComplaintChange} placeholder="Describe what happened..." required />
              </div>
              <div className="complaint-input-container file">
                                              <label className="complaint-label">Supporting evidence (pictures, videos, files):</label>
                <input type="file" name="evidence" multiple ref={complaintFileInputRef} onChange={handleComplaintChange} />
                <small style={{ display:'block', marginTop:4, color:'#555' }}>
                  Max 5 files. Each file up to 10MB. Oversized files will be skipped.
                </small>
                {complaint.evidence && complaint.evidence.length > 0 && (
                  <div style={{ marginTop:6, fontSize:12, color:'#2563eb' }}>
                    {complaint.evidence.length} file(s) selected.
                  </div>
                )}
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Type of complaint:</label>
                <select name="type" value={complaint.type} onChange={handleComplaintChange} required>
                  <option value="">Select type</option>
                  {complaintTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Requested resolution or action:</label>
                <input type="text" name="resolution" value={complaint.resolution} onChange={handleComplaintChange} placeholder="What do you want the authorities to do?" required />
              </div>

              <button type="submit" className="complaint-btn">Submit Complaint</button>
            </form>
          </div>
        </div>
      )}
      {/* View Complaint Modal */}
      {viewComplaint && (
        <div className="dashboard-modal-bg" onClick={() => setViewComplaint(null)}>
          <div className="dashboard-modal complaint-details-modal" onClick={(e)=>e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => setViewComplaint(null)}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <div className="complaint-header">
              <h3>Complaint Details</h3>
              <div className="complaint-status">
                <span className={`status-badge status-${viewComplaint.status}`}>
                  {viewComplaint.status}
                </span>
              </div>
            </div>
            
            {/* Scroll body wrapper combines details + thread so entire body scrolls inside fullscreen modal */}
            <div className="complaint-scroll-body">
              <div className="complaint-content">
              <div className="complaint-info-grid">
                <div className="info-item">
                  <label>Date & Time</label>
                  <span>{viewComplaint.date} {viewComplaint.time}</span>
                </div>
                <div className="info-item">
                  <label>Type</label>
                  <span>{viewComplaint.type}</span>
                </div>
                <div className="info-item">
                  <label>Location</label>
                  <span>{viewComplaint.location}</span>
                </div>
                <div className="info-item">
                  <label>People/Group Involved</label>
                  <span>{viewComplaint.people || 'N/A'}</span>
                </div>
              </div>
              
              <div className="complaint-description">
                <label>Description</label>
                <div className="description-text" style={{ maxHeight: 120, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#f9fafb' }}>
                  {viewComplaint.description}
                </div>
              </div>
              
              <div className="complaint-resolution">
                <label>Resolution Requested</label>
                <div className="resolution-text">{viewComplaint.resolution}</div>
              </div>
              
              <div className="complaint-evidence">
                <label>Evidence</label>
                {viewComplaint.evidence && viewComplaint.evidence.length > 0 ? (
                  <div className="evidence-strip-wrapper">
                    <div className="evidence-strip" onWheel={(e)=>{ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)) { e.currentTarget.scrollLeft += e.deltaY; } }}>
                    {viewComplaint.evidence.map((file, idx)=>{
                      const fileUrl = (typeof file === 'string') ? file : (file?.url || '');
                      if(!fileUrl) return null;
                      const url = toAbsolute(fileUrl);
                      const ext = fileUrl.split('.').pop().toLowerCase();
                      const handleEvidenceClick = (e) => { e.stopPropagation(); setEvidenceModal({ open:true, index: idx }); };
                      if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "jfif"].includes(ext)) {
                        return (
                          <div key={idx} className="evidence-item" title="Click to view full size">
                            <SmartImage
                              src={url}
                              type="evidence"
                              alt={`evidence-${idx}`}
                              onClick={handleEvidenceClick}
                              className="evidence-thumb"
                              size={96}
                            />
                            <small className="evidence-filename">{fileUrl.split('/').pop()}</small>
                          </div>
                        );
                      } else if (["mp4", "webm", "ogg"].includes(ext)) {
                        return (
                          <div key={idx} className="evidence-item" title="Click to view full size" onClick={handleEvidenceClick}>
                            <video
                              className="evidence-thumb"
                              muted
                              preload="metadata"
                              style={{ background:'#000', width:'100%', height:'100%', objectFit:'cover', borderRadius:6 }}
                            >
                              <source src={url} type={`video/${ext}`} />
                            </video>
                            <small className="evidence-filename">{fileUrl.split('/').pop()}</small>
                          </div>
                        );
                      } else if (ext === 'pdf') {
                        return (
                          <div key={idx} className="evidence-item" onClick={handleEvidenceClick} title="Click to view full size">
                            <div className="pdf-thumb" style={{display:'flex',alignItems:'center',justifyContent:'center',background:'#eef2f7',border:'1px solid #cbd5e1',borderRadius:6,fontSize:32,fontWeight:600,color:'#475569'}}>
                              PDF
                            </div>
                            <small className="evidence-filename">{fileUrl.split('/').pop()}</small>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="evidence-item" onClick={handleEvidenceClick} title="Click to view full size">
                            <div className="file-placeholder" style={{ cursor: 'zoom-in' }}>
                              {ext.toUpperCase()}
                            </div>
                            <small className="evidence-filename">{fileUrl.split('/').pop()}</small>
                          </div>
                        );
                      }
                    })}
                    </div>
                  </div>
                ) : (
                  <div className="no-evidence">No Evidence Uploaded</div>
                )}
                {renderEvidenceModal()}
              </div>
              </div>{/* end complaint-content */}
              {/* Legacy single Admin Feedback removed; only thread messages below */}
              {/* Threaded Feedback Section (two-way) */}
              <div className="feedback-thread-wrapper">
              <b>Messages</b>
              <div
                ref={threadListRef}
                className="feedback-thread-list"
                style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 8,
                  background: '#f9fafb',
                  marginTop: 4,
                  scrollBehavior: 'smooth'
                }}
              >
                {(!viewComplaint.feedbackEntries || viewComplaint.feedbackEntries.length === 0) && (
                  <div style={{ color: '#666', fontSize: 13 }}>No messages yet.</div>
                )}
                {(viewComplaint.feedbackEntries || [])
                  .slice()
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .map((entry, idx) => {
                    const isUserSelf = entry.authorType !== 'admin';
                    const rowSide = isUserSelf ? 'right' : 'left';
                    const bubbleClass = 'feedback-bubble ' + (entry.authorType === 'admin' ? 'admin' : 'userSelf');
                    const fullName = isUserSelf ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'You' : 'Admin';
                    return (
                      <div
                        key={idx}
                        className={`feedback-msg-row ${rowSide}`}
                        style={{ marginBottom: 8, display: 'flex' }}
                      >
                        <div className={bubbleClass} style={{ lineHeight: 1.3 }}>
                          <div className="feedback-meta" style={{ marginBottom: 4 }}>
                            <span>{fullName}</span>
                            <span> • {new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                          <div>{entry.message}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="feedback-thread-input">
                <textarea
                  value={threadMessageUser || ''}
                  onChange={e=>setThreadMessageUser(e.target.value)}
                  placeholder="Type a message to the admin..."
                />
                <button
                  onClick={postUserThreadMessage}
                  disabled={postingUserThread || !threadMessageUser || !threadMessageUser.trim()}
                  className="complaint-btn"
                >
                  {postingUserThread ? 'Sending...' : 'Send Message'}
                </button>
              </div>
              </div>
            </div>{/* end complaint-scroll-body */}
          </div>
        </div>
      )}
      {/* Edit Complaint Modal */}
      {editComplaint && editComplaintData && (
        <div className="dashboard-modal-bg" onClick={() => { setEditComplaint(null); setEditComplaintData(null); }}>
          <div className="dashboard-modal edit-complaint-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => { setEditComplaint(null); setEditComplaintData(null); }}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <div className="complaint-header">
              <h3>Edit Complaint</h3>
            </div>
            <form onSubmit={handleEditComplaintSubmit} className="complaint-form">
              <div className="complaint-input-container">
                <label className="complaint-label">Full Name and Contact Info:</label>
                <div className="complaint-inline-pair">
                  <input
                    type="text"
                    name="fullName"
                    value={editComplaintData.fullName}
                    readOnly
                    className="readonly-field"
                    placeholder="Full Name"
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type="email"
                    name="contact"
                    value={editComplaintData.contact}
                    readOnly
                    className="readonly-field"
                    placeholder="Contact Info"
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Date and Time of Incident:</label>
                <div className="complaint-inline-pair">
                  <input type="date" name="date" value={editComplaintData.date} onChange={handleEditComplaintChange} required style={{ flex: 1 }} />
                  <input type="time" name="time" value={editComplaintData.time} onChange={handleEditComplaintChange} required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">People/Group Involved and Location:</label>
                <div className="complaint-inline-pair">
                  <input type="text" name="people" value={editComplaintData.people} onChange={handleEditComplaintChange} placeholder="People or group involved" style={{ flex: 1 }} />
                  <input type="text" name="location" value={editComplaintData.location} onChange={handleEditComplaintChange} placeholder="Location" required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container textarea">
                <label className="complaint-label">Description of what happened:</label>
                <textarea name="description" value={editComplaintData.description} onChange={handleEditComplaintChange} placeholder="Describe what happened..." required />
              </div>
              <div className="complaint-input-container file">
                <label className="complaint-label">Supporting evidence (pictures, videos, files):</label>
                <input type="file" name="evidence" multiple onChange={handleEditComplaintChange} />
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="replaceEvidence"
                      checked={!!editComplaintData.replaceEvidence}
                      onChange={(e) => setEditComplaintData(d => ({ ...d, replaceEvidence: e.target.checked }))}
                    />
                    Replace existing evidence (old files will be deleted)
                  </label>
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Type of complaint:</label>
                <select name="type" value={editComplaintData.type} onChange={handleEditComplaintChange} required>
                  <option value="">Select type</option>
                  {complaintTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Requested resolution or action:</label>
                               <input type="text" name="resolution" value={editComplaintData.resolution} onChange={handleEditComplaintChange} placeholder="What do you want the authorities to do?" required />
              </div>
              <button type="submit" disabled={loading} className="complaint-btn">Save Changes</button>
            </form>
          </div>
        </div>
      )}
      {/* Profile Section */}
      {showProfile && (
        <div className="profile-modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h2>Profile Information</h2>
              <button className="modal-close-btn" onClick={() => setShowProfile(false)}>×</button>
            </div>
            
            <div className="profile-modal-content">
              {/* Profile Picture and Basic Info */}
              <div className="profile-basic-info">
                <div className="profile-picture-section">
                  <SmartImage
                    src={user.profilePicture ? toAbsolute(user.profilePicture) : ''}
                    type="profile"
                    alt="Profile"
                    className="profile-picture-large"
                    size={140}
                    userNameForAvatar={user.firstName || user.email || 'User'}
                  />
                </div>
                
                <div className="profile-details">
                  <h3>{user.firstName} {user.lastName}</h3>
                  <div className="profile-contact-info">
                    <div className="contact-item contact-email">
                      <span className="contact-label">Email:</span>
                                           <span className="contact-value">{user.email}</span>
                    </div>
                    {user.phoneNumber && (
                      <div className="contact-item contact-phone">
                        <span className="contact-label">Phone:</span>
                        <span className="contact-value">{user.phoneNumber}</span>
                      </div>
                    )}
                    {user.address && (
                      <div className="contact-item contact-address">
                        <span className="contact-label">Address:</span>
                        <span className="contact-value">{user.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="profile-actions">
                <button className="edit-profile-btn" onClick={() => {
                  setShowProfile(false);
                  setShowEdit(true);
                }}>
                  Edit Profile
                </button>
              </div>

              {/* Credential Verification Status */}
              <div className="verification-status-section">
                <h4>Credential Verification Status</h4>
                <div className={`status-badge status-${user.verificationStatus || 'pending'}`}>
                  {user.verificationStatus || 'pending'}
                </div>
                
                {user.adminNotes && (
                  <div className="admin-notes">
                    <strong>Admin Notes:</strong> {user.adminNotes}
                  </div>
                )}
                
                {user.issueDetails && (
                  <div className="issue-details">
                    <strong>Issues Found:</strong> {user.issueDetails}
                  </div>
                )}
                
                {user.requiredActions && (
                  <div className="required-actions">
                    <strong>Required Actions:</strong> {user.requiredActions}
                  </div>
                )}
                
                {user.resubmissionRequested && (
                  <div className="resubmission-notice">
                    <strong>Resubmission Required:</strong> {user.resubmissionReason}
                    {user.resubmissionDeadline && (
                      <div className="deadline-info">Deadline: {new Date(user.resubmissionDeadline).toLocaleDateString()}</div>
                    )}
                  </div>
                )}
                
                {user.rejectionCount > 0 && (
                  <div className="rejection-count">
                    <strong>Previous Rejections:</strong> {user.rejectionCount} time(s)
                  </div>
                )}
              </div>
              {/* Uploaded Credentials Preview */}
              {user.credentials && user.credentials.length > 0 && (
                <div className="credentials-preview-section">
                  <h4>Your Uploaded Credentials</h4>
                  <div className="credentials-strip-wrapper">
                    <div className="credentials-strip" role="list" aria-label="Uploaded credentials horizontal list">
                    {user.credentials.map((cred, idx) => {
                      const credUrl = typeof cred === 'string' ? cred : cred.url;
                      if (!credUrl) return null;
                      const ext = credUrl.split('?')[0].split('.').pop().toLowerCase();
                      if (["jpg","jpeg","png","gif","bmp","webp","jfif","avif"].includes(ext)) {
                        return (
                          <div key={idx} className="credential-item" role="listitem" title="Credential image">
                            <SmartImage
                              src={credUrl}
                              type="credential"
                              alt={`credential-${idx}`}
                              className="credential-thumb"
                              size={120}
                            />
                          </div>
                        );
                      } else if (ext === 'pdf') {
                        return (
                          <div key={idx} className="credential-item pdf" role="listitem" title="PDF credential">
                            <a href={credUrl} target="_blank" rel="noopener noreferrer" className="pdf-credential-link">PDF</a>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="credential-item other" role="listitem" title={ext.toUpperCase()}>
                            <a href={credUrl} target="_blank" rel="noopener noreferrer" className="other-credential-link">{ext.toUpperCase()}</a>
                          </div>
                        );
                      }
                    })}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Notification History */}
              <div className="notification-history-section">
                <h4>Verification History</h4>
                <div className="notification-list">
                  {user.verificationDate && (
                    <div className="notification-item" data-type={user.verificationStatus}>
                      <div className="notification-content">
                        <strong>Last Verification:</strong> {new Date(user.verificationDate).toLocaleDateString()}
                        <div className="notification-details">
                          Status: <span className={`status-badge status-${user.verificationStatus}`}>
                            {user.verificationStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {user.resubmissionRequested && (
                    <div className="notification-item" data-type="resubmission">
                      <div className="notification-content">
                        <strong>Resubmission Requested:</strong> {new Date(user.resubmissionRequestDate).toLocaleDateString()}
                        <div className="notification-details">
                          Reason: {user.resubmissionReason}
                          {user.resubmissionDeadline && (
                            <div>Deadline: {new Date(user.resubmissionDeadline).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {user.rejectionCount > 0 && (
                    <div className="notification-item" data-type="rejected">
                      <div className="notification-content">
                        <strong>Previous Issues:</strong> {user.rejectionCount} rejection(s)
                        <div className="notification-details">
                          Last Issue: {user.issueDetails}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!user.verificationDate && !user.resubmissionRequested && user.rejectionCount === 0 && (
                    <div className="notification-item" data-type="pending">
                      <div className="notification-content">
                        <strong>Status:</strong> Awaiting verification
                        <div className="notification-details">
                          Your credentials are pending review by an administrator.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Logout Button */}
              <div className="modal-footer">
                <button className="logout-btn" onClick={handleLogout}>
                  <svg className="logout-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification Modal */}
      {showNotifications && (
        <div className="notification-modal-overlay" onClick={() => setShowNotifications(false)}>
          <div className="notification-modal" onClick={e => e.stopPropagation()}>
            <div className="notification-modal-header">
              <h2>Notifications</h2>
              <div className="notification-header-actions">
                <button className="clear-btn" onClick={clearNotifications} title="Clear notifications" aria-label="Clear notifications">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="refresh-btn" onClick={() => { refreshAllData(); }} title="Refresh notifications">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M23 20V14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M22 14L17.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="modal-close-btn" onClick={() => setShowNotifications(false)}>×</button>
              </div>
            </div>
            <div className="notification-modal-content" ref={notificationContentRef}>
              {notificationsList.length === 0 ? (
                <div className="no-notifications">
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="notification-list">
                  {notificationsList.map((n, idx) => {
                    const status = (n.newStatus || '').toLowerCase().replace(' ', '-');
                    const itemClass =
                      status === 'rejected' ? 'rejected' :
                      status === 'in-progress' ? 'in-progress' :
                      status === 'solved' ? 'solved' :
                      status === 'approved' ? 'approved' :
                      status === 'pending' ? 'pending' : 'pending';
                    const icon =
                      status === 'rejected' ? '🚫' :
                      status === 'in-progress' ? '🔄' :
                      status === 'solved' ? '✅' :
                      status === 'approved' ? '✅' :
                      status === 'pending' ? '⏳' : '🔔';
                    return (
                      <div key={idx} className={`notification-item ${itemClass}`}>
                        <div className="notification-icon">{icon}</div>
                        <div className="notification-content">
                          <h4>{n.type === 'feedback_update' ? 'New Feedback' : 'Complaint Update'}</h4>
                          {n.subject && <p><strong>Subject/Type:</strong> {n.subject}</p>}
                          {!n.subject && n.complaintType && <p><strong>Type:</strong> {n.complaintType}</p>}
                          {n.location && <p><strong>Location:</strong> {n.location}</p>}
                          <p>{n.message}</p>
                          {n.oldStatus && <p><strong>Previous:</strong> {n.oldStatus}</p>}
                          {n.newStatus && <p><strong>Current:</strong> {n.newStatus}</p>}
                          <p><strong>Date:</strong> {new Date(n.timestamp).toLocaleString()}</p>
                          {n.complaintId && (
                            <div className="notif-actions">
                              <button type="button" className="notif-view-btn" onClick={() => handleViewComplaintFromNotification(n.complaintId)} disabled={!!n.deleted}>
                                {n.deleted ? 'Deleted' : 'View complaint'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
