import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import './Dashboard.css';

const defaultAvatar = 'https://ui-avatars.com/api/?name=User&background=4a90e2&color=fff';

const complaintTypes = [
  'Noise', 'Harassment', 'Garbage', 'Vandalism', 'Other'
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showComplaint, setShowComplaint] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // Get user info from localStorage
  const storedUser = JSON.parse(localStorage.getItem('user')) || {
    _id: '',
    firstName: 'User',
    lastName: '',
    email: 'user@email.com',
    phoneNumber: '',
    address: '',
    credentials: [],
    profilePicture: null,
  };
  const [user, setUser] = useState(storedUser);
  const [editData, setEditData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber || '',
    address: user.address || '',
    profilePic: user.profilePicture || '',
    file: null,
  });

  // Complaint form state
  const [complaint, setComplaint] = useState({
    fullName: user.firstName + ' ' + user.lastName,
    contact: user.email,
    date: '',
    time: '',
    location: '',
    people: '',
    description: '',
    evidence: [],
    type: '',
    resolution: '',
  });

  // Complaints list state
  const [complaints, setComplaints] = useState([]);
  const [viewComplaint, setViewComplaint] = useState(null);
  const [editComplaint, setEditComplaint] = useState(null);
  const [editComplaintData, setEditComplaintData] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const notificationContentRef = useRef(null);

  // Evidence modal state for complaint evidence viewer (user side)
  const [evidenceModal, setEvidenceModal] = useState({ open: false, index: 0 });

  // Derived complaint counts for summary cards
  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const inProgressCount = complaints.filter(c => (c.status || '').toLowerCase() === 'in progress').length;
  const solvedCount = complaints.filter(c => (c.status || '').toLowerCase() === 'solved').length;

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
          const res = await axios.get(`http://localhost:5000/api/complaints/user/${user._id}`);
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
          const res = await axios.get(`http://localhost:5000/api/complaints/user/${user._id}`);
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

  // Setup offline detection
  const setupOfflineDetection = () => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  };

  const handleOnline = () => {
    console.log('User is back online');
    // Reconnect to real-time updates
    if (user._id) {
      setupRealTimeUpdates();
    }
  };

  const handleOffline = () => {
    console.log('User is offline');
    // Close real-time connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const setupRealTimeUpdates = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`http://localhost:5000/api/realtime/${user._id}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setRealtimeConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'connected':
            break;
          case 'status_update':
            handleStatusUpdate(data);
            break;
          case 'feedback_update':
            handleFeedbackUpdate(data);
            break;
          case 'credential_verification':
            handleCredentialVerification(data);
            break;
          case 'credential_resubmission':
            handleCredentialResubmission(data);
            break;
          default:
        }
      } catch {}
    };

    eventSource.onerror = () => {
      setRealtimeConnected(false);
      // Try reconnect after a short delay, but only if still not connected
      setTimeout(() => {
        if (!realtimeConnected && user._id) {
          setupRealTimeUpdates();
        }
      }, 4000);
    };
  };

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
          timerProgressBar: true
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
      timerProgressBar: true
    });
    if (viewComplaint && viewComplaint._id === data.complaintId) {
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

  const handleFeedbackUpdate = (data) => {
    if (!isLoggedIn || !user || !user._id) return;
    setComplaints(prevComplaints => 
      prevComplaints.map(complaint => 
        complaint._id === data.complaintId 
          ? { ...complaint, feedback: data.feedback }
          : complaint
      )
    );
    Swal.fire({
      title: 'New Feedback!',
      text: data.message,
      icon: 'info',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true
    });
    if (viewComplaint && viewComplaint._id === data.complaintId) {
      setViewComplaint(prev => ({ ...prev, feedback: data.feedback }));
    }
    saveNotificationToStorage(data);
    setTimeout(() => { scrollToUpdatedComplaint(data.complaintId); }, 1000);
  };
  // Render missed notifications (after login), under welcome
  function renderMissedNotifications() {
    if (!justLoggedIn || missedNotifications.length === 0) return null;
    // Show SweetAlert for each missed notification after welcome
    setTimeout(() => {
      missedNotifications.forEach((notif, idx) => {
        setTimeout(() => {
          Swal.fire({
            title: notif.type === 'feedback_update' ? 'New Feedback!' : 'Status Update!',
            text: notif.message,
            icon: notif.type === 'feedback_update' ? 'info' : 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
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
              title: notif.type === 'feedback_update' ? 'New Feedback!' : 'Status Update!',
              text: notif.message,
              icon: notif.type === 'feedback_update' ? 'info' : 'info',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 5000,
              timerProgressBar: true
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

  // Fetch latest user data from backend on mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      console.log('Current user data:', parsedUser);
      // Initialize notifications and complaints immediately
      checkForStoredNotifications();
      if (parsedUser._id) {
        (async () => {
          try {
            const res = await axios.get(`http://localhost:5000/api/complaints/user/${parsedUser._id}`);
            const latest = res.data.complaints || [];
            // Seed snapshot on first load only
            const seededKey = `complaints_snapshot_seeded_${parsedUser._id}`;
            if (!localStorage.getItem(seededKey)) {
              localStorage.setItem(`complaints_snapshot_${parsedUser._id}`, JSON.stringify(latest.map(c => ({ _id: c._id, status: c.status, feedback: c.feedback }))));
              localStorage.setItem(seededKey, '1');
            }
            setComplaints(latest);
            updateNotificationCount();
          } catch (e) {
            setComplaints([]);
          }
        })();
      }
    }
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

  // Fetch user's complaints after mount and after submitting
  const fetchComplaints = async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/complaints/user/${userId}`);
      setComplaints(res.data.complaints);
    } catch (err) {
      setComplaints([]);
    }
  };

  useEffect(() => {
    if (user._id) {
      fetchComplaints();
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
      if (user._id) {
        const response = await axios.get(`http://localhost:5000/api/user/${user._id}`);
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setNotificationCount(calculateNotificationCount());
      }
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
            type: 'feedback_update',
            complaintId: newC._id,
            subject: newC.subject || newC.type || 'Complaint',
            feedback: newC.feedback,
            updatedAt: newC.updatedAt,
            message: 'Admin added new feedback to your complaint.'
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
      if (user._id) {
        const response = await axios.get(`http://localhost:5000/api/complaints/user/${user._id}`);
        const latest = response.data.complaints || [];
        detectAndNotifyComplaintChanges(latest);
        setComplaints(latest);
        console.log('Complaints refreshed:', latest);
        // Badge count comes from storage
        updateNotificationCount();
      }
    } catch (error) {
      console.error('Failed to refresh complaints data:', error);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([refreshUserData(), refreshComplaintsData()]);
  };

  const handleEditChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'phoneNumber') {
      // Keep only digits, limit to 11 chars (PH mobile format), format as 09XX-XXX-XXXX visually
      const digits = value.replace(/\D/g, '').slice(0, 11);
      let display = digits;
      if (digits.length > 4 && digits.length <= 7) {
        display = `${digits.slice(0,4)}-${digits.slice(4)}`;
      } else if (digits.length > 7) {
        display = `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
      }
      setEditData({ ...editData, phoneNumber: display });
      return;
    }
    if (name === 'profilePic' && files && files[0]) {
      setEditData({ ...editData, file: files[0], profilePic: URL.createObjectURL(files[0]) });
    } else {
      setEditData({ ...editData, [name]: value });
    }
  };

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
      // Send numeric-only phone to backend
      formData.append('phoneNumber', (editData.phoneNumber || '').replace(/\D/g, ''));
      formData.append('address', editData.address);
      if (editData.file) {
        formData.append('profilePic', editData.file);
      }
      const token = localStorage.getItem('token');
      const res = await axios.patch(`http://localhost:5000/api/user/${user._id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setShowEdit(false);
      Swal.fire('Saved!', 'Your profile has been updated.', 'success');
    } catch (err) {
      Swal.fire('Error', 'Failed to update profile.', 'error');
    }
    setLoading(false);
  };

  // Complaint form handlers
  const handleComplaintChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setComplaint({ ...complaint, [name]: checked });
    } else if (type === 'file') {
      setComplaint({ ...complaint, evidence: files ? Array.from(files) : [] });
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
      const res = await axios.post('http://localhost:5000/api/complaints', formData, {
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
      await axios.patch(`http://localhost:5000/api/complaints/${editComplaint._id}`, formData, {
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
      await axios.delete(`http://localhost:5000/api/complaints/${complaintId}`);
      Swal.fire('Deleted!', 'Your complaint has been deleted.', 'success');
      fetchComplaints(user._id);
    } catch (err) {
      Swal.fire('Error', 'Failed to delete complaint.', 'error');
    }
    setLoading(false);
  };

  const profilePic = user.profilePicture ? `http://localhost:5000/${user.profilePicture}` : defaultAvatar;
  const editPreviewSrc = editData.profilePic
    ? (editData.profilePic.startsWith('blob:') ? editData.profilePic : `http://localhost:5000/${editData.profilePic}`)
    : defaultAvatar;

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
    const evidenceList = viewComplaint.evidence;
    const idx = evidenceModal.index;
    const file = evidenceList[idx];
    const url = `http://localhost:5000/${file}`;
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

  return (
    <div className="dashboard-container">
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
            {user.profilePicture ? (
              <img src={`http://localhost:5000/${user.profilePicture}`} alt="Profile" />
            ) : (
              <img src={defaultAvatar} alt="Profile" />
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
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
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
          <button
            onClick={() => setShowComplaint(true)}
            className="dashboard-add-complaint-btn"
          >
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+</span>
            Add Complaint
          </button>
          {/* Complaints List */}
          {complaints.length > 0 && (
            <div className="dashboard-complaints-table">
              <h4>Your Complaints</h4>
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
                  {complaints.map(c => (
                    <tr key={c._id} data-complaint-id={c._id}>
                      <td>{c.date}</td>
                      <td>{c.type}</td>
                      <td>{c.location}</td>
                      <td>
                        <div className="status-container">
                          <span className={`status-badge status-${c.status?.toLowerCase().replace(' ', '-')}`}>
                            {c.status}
                          </span>
                          {c.recentlyUpdated && (
                            <div className="update-swap">
                              <span className="swap-text">Just Updated!</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="dashboard-action-buttons">
                          <button onClick={() => setViewComplaint(c)} className="action-btn view-btn">View</button>
                          <button onClick={() => { setEditComplaint(c); setEditComplaintData({ ...c, evidence: [] }); }} className="edit-btn">Edit</button>
                          <button onClick={() => handleDeleteComplaint(c._id)} className="delete-btn">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="dashboard-modal-bg" onClick={() => setShowEdit(false)}>
          <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => setShowEdit(false)}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <h3>Edit Profile</h3>
            <form onSubmit={handleEditProfile}>
              <div className="profile-pic-container">
                <img src={editPreviewSrc} alt="Profile Preview" className="profile-pic-large" />
                <input
                  type="file"
                  name="profilePic"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden-input"
                  onChange={handleEditChange}
                />
               
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
              <div className="profile-actions">
                <button type="submit" disabled={loading} className="profile-action-btn">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setShowEdit(false)} className="profile-action-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Complaint Modal */}
      {showComplaint && (
        <div className="dashboard-modal-bg" onClick={() => setShowComplaint(false)}>
          <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => setShowComplaint(false)}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <h3>Add Complaint</h3>
            <form onSubmit={handleComplaintSubmit}>
              <div className="complaint-input-container">
                <label className="complaint-label">Full Name and Contact Info:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    name="fullName"
                    value={complaint.fullName}
                    onChange={handleComplaintChange}
                    placeholder="Full Name"
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type="email"
                    name="contact"
                    value={complaint.contact}
                    onChange={handleComplaintChange}
                    placeholder="Contact Info"
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Date and Time of Incident:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="date" name="date" value={complaint.date} onChange={handleComplaintChange} required style={{ flex: 1 }} />
                  <input type="time" name="time" value={complaint.time} onChange={handleComplaintChange} required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">People/Group Involved and Location:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
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
              <button type="button" onClick={() => setShowComplaint(false)} className="complaint-btn">Cancel</button>
            </form>
          </div>
        </div>
      )}
      {/* View Complaint Modal */}
      {viewComplaint && (
        <div className="dashboard-modal-bg" onClick={() => setViewComplaint(null)}>
          <div className="dashboard-modal complaint-details-modal">
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
                <div className="description-text">{viewComplaint.description}</div>
              </div>
              
              <div className="complaint-resolution">
                <label>Resolution Requested</label>
                <div className="resolution-text">{viewComplaint.resolution}</div>
              </div>
              
              <div className="complaint-evidence">
                <label>Evidence</label>
                {viewComplaint.evidence && viewComplaint.evidence.length > 0 ? (
                  <div className="evidence-grid">
                    {viewComplaint.evidence.map((file, idx) => {
                      const url = `http://localhost:5000/${file}`;
                      const ext = file.split('.').pop().toLowerCase();
                      // Stop propagation so background modal does not close
                      const handleEvidenceClick = (e) => {
                        e.stopPropagation();
                        setEvidenceModal({ open: true, index: idx });
                      };
                      if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "jfif"].includes(ext)) {
                        return (
                          <div key={idx} className="evidence-item">
                            <img
                              src={url}
                              alt={`evidence-${idx}`}
                              onClick={handleEvidenceClick}
                              title="Click to view full size"
                            />
                            <small className="evidence-filename">{file.split('/').pop()}</small>
                          </div>
                        );
                      } else if (["mp4", "webm", "ogg"].includes(ext)) {
                        return (
                          <div key={idx} className="evidence-item">
                            <video
                              controls
                              onClick={handleEvidenceClick}
                              title="Click to view full size"
                            >
                              <source src={url} type={`video/${ext}`} />
                              Your browser does not support the video tag.
                            </video>
                            <small className="evidence-filename">{file.split('/').pop()}</small>
                          </div>
                        );
                      } else if (ext === 'pdf') {
                        return (
                          <div key={idx} className="evidence-item">
                            <embed
                              src={url}
                              type="application/pdf"
                              onClick={handleEvidenceClick}
                              title="Click to view full size"
                            />
                            <small className="evidence-filename">{file.split('/').pop()}</small>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="evidence-item">
                            <div className="file-placeholder" onClick={handleEvidenceClick} style={{ cursor: 'zoom-in' }}>
                              {ext.toUpperCase()}
                            </div>
                            <small className="evidence-filename">{file.split('/').pop()}</small>
                          </div>
                        );
                      }
                    })}
                  </div>
                ) : (
                  <div className="no-evidence">No Evidence Uploaded</div>
                )}
                {renderEvidenceModal()}
              </div>
            </div>
            {viewComplaint.feedback && (
              <div className="feedback-area">
                <b>Admin Feedback:</b>
                <div>{viewComplaint.feedback}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Edit Complaint Modal */}
      {editComplaint && editComplaintData && (
        <div className="dashboard-modal-bg" onClick={() => { setEditComplaint(null); setEditComplaintData(null); }}>
          <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close-x" 
              onClick={() => { setEditComplaint(null); setEditComplaintData(null); }}
              type="button"
              aria-label="Close modal"
            >
            </button>
            <h3>Edit Complaint</h3>
            <form onSubmit={handleEditComplaintSubmit}>
              <div className="complaint-input-container">
                <label className="complaint-label">Full Name and Contact Info:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    name="fullName"
                    value={editComplaintData.fullName}
                    onChange={handleEditComplaintChange}
                    placeholder="Full Name"
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type="email"
                    name="contact"
                    value={editComplaintData.contact}
                    onChange={handleEditComplaintChange}
                    placeholder="Contact Info"
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">Date and Time of Incident:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="date" name="date" value={editComplaintData.date} onChange={handleEditComplaintChange} required style={{ flex: 1 }} />
                  <input type="time" name="time" value={editComplaintData.time} onChange={handleEditComplaintChange} required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="complaint-input-container">
                <label className="complaint-label">People/Group Involved and Location:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
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
              <button type="button" onClick={() => { setEditComplaint(null); setEditComplaintData(null); }} className="complaint-btn">Cancel</button>
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
                  {user.profilePicture ? (
                    <img src={`http://localhost:5000/${user.profilePicture}`} alt="Profile" className="profile-picture-large" />
                  ) : (
                    <img src={defaultAvatar} alt="Profile" className="profile-picture-large" />
                  )}
                </div>
                
                <div className="profile-details">
                  <h3>{user.firstName} {user.lastName}</h3>
                  <div className="profile-contact-info">
                    <div className="contact-item">
                      <span className="contact-label">Email:</span>
                                           <span className="contact-value">{user.email}</span>
                    </div>
                    {user.phoneNumber && (
                      <div className="contact-item">
                        <span className="contact-label">Phone:</span>
                        <span className="contact-value">{user.phoneNumber}</span>
                      </div>
                    )}
                    {user.address && (
                      <div className="contact-item">
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
