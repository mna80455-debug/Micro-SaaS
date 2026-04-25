// calendar.js
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentDate = new Date();

function getWeekDays(date) {
  const current = new Date(date);
  const week = [];
  // Starting week from Sunday (0)
  current.setDate((current.getDate() - current.getDay()));
  for (let i = 0; i < 7; i++) {
    week.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return week;
}

const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const isToday = (d) => {
  const today = new Date();
  return d.getDate() === today.getDate() && 
         d.getMonth() === today.getMonth() && 
         d.getFullYear() === today.getFullYear();
}

window.renderCalendar = function() {
  const weekDays = getWeekDays(currentDate);
  
  // Set Month display text
  const opts = { month: 'long', year: 'numeric' };
  document.getElementById('calMonthDisplay').textContent = weekDays[0].toLocaleDateString('ar-EG', opts);

  const hours = Array.from({length: 14}, (_, i) => i + 8); // 8am to 9pm
  const grid = document.getElementById('calendarGrid');
  
  if(!grid) return;

  grid.innerHTML = `
    <!-- Header: days -->
    <div class="cal-header">
      <div class="cal-time-col"></div>
      ${weekDays.map(day => `
        <div class="cal-day-header ${isToday(day) ? 'today' : ''}">
          <span class="day-name">${dayNamesAr[day.getDay()]}</span>
          <span class="day-num">${day.getDate()}</span>
        </div>
      `).join('')}
    </div>

    <!-- Body: time slots -->
    <div class="cal-body">
      ${hours.map(hour => {
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        return `
        <div class="cal-row">
          <div class="cal-time">${hourStr}</div>
          ${weekDays.map(day => `
            <div class="cal-cell"
              data-date="${day.getFullYear()}-${day.getMonth()+1}-${day.getDate()}"
              data-time="${hourStr}"
              onclick="calendarCellClick('${day.getFullYear()}-${day.getMonth()+1}-${day.getDate()}', '${hourStr}')">
            </div>
          `).join('')}
        </div>`
      }).join('')}
    </div>
  `;

  overlayAppointments(weekDays);
};

window.calendarCellClick = function(dateStr, timeStr) {
  // Pad month/day for date input value
  const parts = dateStr.split('-');
  const y = parts[0];
  const m = parts[1].padStart(2, '0');
  const d = parts[2].padStart(2, '0');
  
  document.getElementById('aptDate').value = `${y}-${m}-${d}`;
  document.getElementById('aptTime').value = timeStr;
  
  window.openNewAppointmentModal();
};

async function overlayAppointments(days) {
  if(!window.currentUser) return;
  
  const startDay = new Date(days[0]);
  startDay.setHours(0,0,0,0);
  
  const endDay = new Date(days[days.length-1]);
  endDay.setHours(23,59,59,999);

  try {
    const q = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);
    
    snap.docs.forEach(doc => {
      const apt = { id: doc.id, ...doc.data() };
      if (!(apt.date >= startDay.getTime() && apt.date <= endDay.getTime())) return;
      
      const aptDate = new Date(apt.date);
      const dateKey = `${aptDate.getFullYear()}-${aptDate.getMonth()+1}-${aptDate.getDate()}`;
      
      // we match by hour since cell granularity is hour for now.
      const hourPart = apt.time.split(':')[0] + ':00'; 
      const cell = document.querySelector(`[data-date="${dateKey}"][data-time="${hourPart}"]`);
      
      if(cell) {
        const statusColors = {
          confirmed: 'var(--confirmed)', pending: 'var(--pending)',
          completed: 'var(--completed)', cancelled: 'var(--cancelled)'
        };

        const block = document.createElement('div');
        block.className = 'apt-block';
        block.style.cssText = `
          background: ${statusColors[apt.status] || 'var(--teal)'}22;
          border-right: 3px solid ${statusColors[apt.status] || 'var(--teal)'}; /* RTL */
        `;
        block.innerHTML = `
          <span class="apt-block-name">${apt.clientName}</span>
          <span class="apt-block-service">${apt.service}</span>
        `;
        
        block.onclick = (e) => {
          e.stopPropagation();
          // Ideally open appointment details, showing toast for now
          showToast(`موعد: ${apt.clientName}`, 'success');
        };

        cell.appendChild(block);
      }
    });

  } catch (err) {
    console.error("Cal load err", err);
  }
}

// Navigation Buttons
document.getElementById('btnPrevWeek')?.addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() - 7);
  window.renderCalendar();
});

document.getElementById('btnNextWeek')?.addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() + 7);
  window.renderCalendar();
});

document.getElementById('btnToday')?.addEventListener('click', () => {
  currentDate = new Date();
  window.renderCalendar();
});
