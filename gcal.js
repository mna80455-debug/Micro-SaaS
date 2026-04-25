import { CONFIG } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
let tokenClient = null;
let accessToken = null;

/**
 * Initialize Google Identity Services
 */
export async function initGcal() {
  return new Promise((resolve, reject) => {
    // LoadGIS script
    if (!window.google || !window.google.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => initTokenClient(resolve);
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
      initTokenClient(resolve);
    }
  });
}

function initTokenClient(resolve) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE.CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.access_token) {
        accessToken = resp.access_token;
        localStorage.setItem('gcal_token', JSON.stringify(resp));
      }
    }
  });
  if (tokenClient) resolve();
}

/**
 * Request permission from user
 */
export function connectGcal() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      initGcal().then(() => {
        tokenClient.requestAccessToken();
        resolve();
      });
      return;
    }
    
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      accessToken = resp.access_token;
      localStorage.setItem('gcal_token', JSON.stringify(resp));
      resolve(resp);
    };

    tokenClient.requestAccessToken();
  });
}

/**
 * Add an event to Google Calendar via REST API
 */
export async function addEventToGcal(appointment) {
  const stored = localStorage.getItem('gcal_token');
  if (!stored) return;
  
  const token = JSON.parse(stored);
  accessToken = token.access_token;
  
  if (!accessToken) {
    await connectGcal();
  }

  const startDateTime = new Date(appointment.date);
  const [hours, minutes] = appointment.time.split(':');
  startDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

  const endDateTime = new Date(startDateTime);
  endDateTime.setMinutes(startDateTime.getMinutes() + (appointment.duration || 30));

  const event = {
    summary: `BookFlow: ${appointment.clientName} - ${appointment.service}`,
    description: `عميل: ${appointment.clientName}\nخدمة: ${appointment.service}\nهاتف: ${appointment.clientPhone}\nملاحظات: ${appointment.notes || ''}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Africa/Cairo'
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Africa/Cairo'
    }
  };

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    const result = await response.json();
    console.log('✅ Event created in Google Calendar:', result.htmlLink);
    return result;
  } catch (err) {
    console.error('❌ Error creating GCal event:', err);
    if (err.status === 401) {
      await connectGcal();
      return addEventToGcal(appointment);
    }
  }
}

/**
 * Check if connected
 */
export function isGcalConnected() {
  return !!localStorage.getItem('gcal_token');
}

/**
 * Disconnect from Google Calendar
 */
export function disconnectGcal() {
  localStorage.removeItem('gcal_token');
  accessToken = null;
}
