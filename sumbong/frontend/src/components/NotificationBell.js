import React from 'react';

const NotificationBell = ({ count = 0, onClick, open }) => {
  return (
    <button
      type="button"
      className={`admin-bell-btn png ${open ? 'open' : ''}`}
      onClick={onClick}
      aria-label="Notifications"
    >
      <img src="/assets/icons/notification-bell.png" alt="Notifications" className="admin-bell-img" draggable={false} />
      {count > 0 && (
        <span className="admin-bell-badge" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>
      )}
    </button>
  );
};

export default NotificationBell;
