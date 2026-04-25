import { CONFIG } from './config.js';

const SCOPES = CONFIG.GOOGLE.SCOPES;
let tokenClient;
let gapiInited = false;
let gsisInited = false;

/**
 * Initialize GAPI client
 */
export async function initGcal() {
  return new Promise((resolve) => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: CONFIG.GOOGLE.API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
      });
      gapiInited = true;
      checkInited(resolve);
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE.CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined at request time
    });
    gsisInited = true;
    checkInited(resolve);
  });
}

function checkInited(resolve) {
  if (gapiInited && gsisInited) resolve();
}

/**
 * Request permission from user
 */
export function connectGcal() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }
      localStorage.setItem('gcal_token', JSON.stringify(resp));
      resolve(resp);
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

/**
 * Add an event to Google Calendar
 */
export async function addEventToGcal(appointment) {
  const token = JSON.parse(localStorage.getItem('gcal_token'));
  if (!token) return;

  gapi.client.setToken(token);

  const startDateTime = new Date(appointment.date);
  const [hours, minutes] = appointment.time.split(':');
  startDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

  const endDateTime = new Date(startDateTime);
  endDateTime.setMinutes(startDateTime.getMinutes() + (appointment.duration || 30));

  const event = {
    'summary': `BookFlow: ${appointment.clientName} - ${appointment.service}`,
    'description': `عميل: ${appointment.clientName}\nخدمة: ${appointment.service}\nهاتف: ${appointment.clientPhone}\nملاحظات: ${appointment.notes || ''}`,
    'start': {
      'dateTime': startDateTime.toISOString(),
      'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    'end': {
      'dateTime': endDateTime.toISOString(),
      'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };

  try {
    const response = await gapi.client.calendar.events.insert({
      'calendarId': 'primary',
      'resource': event
    });
    console.log('✅ Event created in Google Calendar:', response.result.htmlLink);
    return response;
  } catch (err) {
    console.error('❌ Error creating GCal event:', err);
    if (err.status === 401) {
      // Token expired, re-auth
      await connectGcal();
      return addEventToGcal(appointment);
    }
  }
}
