// gcal.js — Google Calendar Integration - Enhanced

const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events';
let gcalTokenClient = null;
let gcalAccessToken = null;

/**
 * Initialize Google Identity Services
 */
export async function initGcal() {
  return new Promise((resolve, reject) => {
    // Load GIS script
    if (!window.google || !window.google.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => initTokenClient(resolve, reject);
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
      initTokenClient(resolve, reject);
    }
  });
}

function initTokenClient(resolve, reject) {
  try {
    gcalTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: window.GCAL_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      scope: GCAL_SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          gcalAccessToken = resp.access_token;
          localStorage.setItem('gcal_token', JSON.stringify(resp));
          resolve(true);
        } else {
          reject(new Error('No access token received'));
        }
      },
      error_callback: (err) => {
        console.error('GCal Auth Error:', err);
        reject(err);
      }
    });
    resolve(true);
  } catch(e) {
    console.error('GCal Init Error:', e);
    reject(e);
  }
}

/**
 * Request permission from user to access Google Calendar
 */
export async function connectGcal() {
  try {
    if (!gcalTokenClient) {
      await initGcal();
    }
    
    // Check if we have a valid token
    const stored = localStorage.getItem('gcal_token');
    if (stored) {
      const tokenData = JSON.parse(stored);
      if (tokenData.access_token && tokenData.expires_at > Date.now()) {
        gcalAccessToken = tokenData.access_token;
        return true;
      }
    }
    
    // Request new token
    return new Promise((resolve, reject) => {
      gcalTokenClient.callback = (resp) => {
        if (resp.error) {
          reject(resp.error);
          return;
        }
        gcalAccessToken = resp.access_token;
        localStorage.setItem('gcal_token', JSON.stringify({
          access_token: resp.access_token,
          expires_at: Date.now() + (resp.expires_in || 3600) * 1000
        }));
        resolve(true);
      };
      gcalTokenClient.requestAccessToken({ prompt: 'consent' });
    });
  } catch(e) {
    console.error('GCal Connect Error:', e);
    return false;
  }
}

/**
 * Add an event to Google Calendar via REST API
 */
export async function addEventToGcal(appointment) {
  if (!appointment) return null;
  
  try {
    // Ensure we have a token
    if (!gcalAccessToken) {
      const connected = await connectGcal();
      if (!connected) {
        throw new Error('Not connected to Google Calendar');
      }
    }
    
    const startDateTime = new Date(appointment.date);
    const [hours, minutes] = (appointment.time || '10:00').split(':');
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + (appointment.duration || 30));
    
    const event = {
      summary: `BookFlow: ${appointment.clientName || 'Client'} - ${appointment.service || 'Appointment'}`,
      description: `Client: ${appointment.clientName || ''}\nService: ${appointment.service || ''}\nPhone: ${appointment.clientPhone || ''}\nNotes: ${appointment.notes || ''}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Africa/Cairo'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Africa/Cairo'
      }
    };
    
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gcalAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      // Token might be expired
      if (response.status === 401) {
        localStorage.removeItem('gcal_token');
        gcalAccessToken = null;
        // Retry once
        return addEventToGcal(appointment);
      }
      throw new Error(errorData.error?.message || 'Failed to create event');
    }
    
    const result = await response.json();
    console.log('✅ Event created in Google Calendar:', result.htmlLink);
    return result;
  } catch(e) {
    console.error('❌ GCal Event Error:', e);
    throw e;
  }
}

/**
 * Check if connected to Google Calendar
 */
export function isGcalConnected() {
  const stored = localStorage.getItem('gcal_token');
  if (!stored) return false;
  
  try {
    const tokenData = JSON.parse(stored);
    return !!(tokenData.access_token && tokenData.expires_at > Date.now());
  } catch(e) {
    return false;
  }
}

/**
 * Disconnect from Google Calendar
 */
export function disconnectGcal() {
  localStorage.removeItem('gcal_token');
  gcalAccessToken = null;
  console.log('✅ Disconnected from Google Calendar');
}
