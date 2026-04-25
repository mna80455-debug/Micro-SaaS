// calendar.js
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentDate = new Date();
let currentView = 'week'; // 'week', 'day', 'month'

const viewNames = { week: 'عرض الأسبوع', day: 'عرض اليوم', month: 'عرض الشهر' };

function getWeekDays(date) {
  const current = new Date(date);
  const week = [];
  current.setDate(current.getDate() - current.getDay());
  for (let i = 0; i < 7; i++) {
    week.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return week;
}

function getMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  
  // Padding from prev month
  const startPad = firstDay.getDay();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  // Actual days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  
  // Padding to complete grid (6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  
  return days;
}

const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const isToday = (d) => {
  const today = new Date();
  return d.getDate() === today.getDate() && 
         d.getMonth() === today.getMonth() && 
         d.getFullYear() === today.getFullYear();
}

window.switchCalView = function(view) {
  currentView = view;
  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('calViewDesc').textContent = viewNames[view];
  renderCalendar();
};

window.renderCalendar = function() {
  const grid = document.getElementById('calendarGrid');
  if(!grid) return;
  
  if (currentView === 'month') {
    renderMonthView(grid);
  } else if (currentView === 'day') {
    renderDayView(grid);
  } else {
    renderWeekView(grid);
  }
};

function renderMonthView(grid) {
  const monthDays = getMonthDays(currentDate);
  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  document.getElementById('calMonthDisplay').textContent = monthName;
  
  grid.className = 'calendar-wrapper month-view';
  grid.innerHTML = `
    <div class="cal-month-grid">
      <div class="cal-month-header">
        ${dayNamesAr.map(d => `<div>${d}</div>`).join('')}
      </div>
      <div class="cal-month-body">
        ${monthDays.map(d => `
          <div class="cal-month-cell ${!d.isCurrentMonth ? 'other-month' : ''} ${isToday(d.date) ? 'today' : ''}"
               data-date="${d.date.getFullYear()}-${d.date.getMonth()+1}-${d.date.getDate()}"
               onclick="calendarCellClick('${d.date.getFullYear()}-${d.date.getMonth()+1}-${d.date.getDate()}', '09:00')">
            <span class="cal-day-num">${d.date.getDate()}</span>
            <div class="cal-month-dots"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  overlayAppointmentsMonth(monthDays.map(d => d.date));
}

function renderDayView(grid) {
  const dayName = dayNamesAr[currentDate.getDay()];
  const dayNum = currentDate.getDate();
  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  document.getElementById('calMonthDisplay').textContent = `${dayName} ${dayNum} ${monthName}`;
  
  const hours = Array.from({length: 14}, (_, i) => i + 8);
  
  grid.className = 'calendar-wrapper day-view';
  grid.innerHTML = `
    <div class="cal-day-header">
      <div class="cal-day-title">${dayName}</div>
      <div class="cal-day-num">${dayNum}</div>
    </div>
    <div class="cal-day-body">
      ${hours.map(hour => {
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()+1}-${currentDate.getDate()}`;
        return `
        <div class="cal-row">
          <div class="cal-time">${hourStr}</div>
          <div class="cal-cell full-day"
               data-date="${dateKey}"
               data-time="${hourStr}"
               onclick="calendarCellClick('${dateKey}', '${hourStr}')">
          </div>
        </div>`
      }).join('')}
    </div>
  `;
  
  overlayAppointments([currentDate]);
}

function renderWeekView(grid) {
  const weekDays = getWeekDays(currentDate);
  
  const opts = { month: 'long', year: 'numeric' };
  document.getElementById('calMonthDisplay').textContent = weekDays[0].toLocaleDateString('ar-EG', opts);
  
  const hours = Array.from({length: 14}, (_, i) => i + 8);
  
  grid.className = 'calendar-wrapper week-view';
  grid.innerHTML = `
    <div class="cal-header">
      <div class="cal-time-col"></div>
      ${weekDays.map(day => `
        <div class="cal-day-header ${isToday(day) ? 'today' : ''}">
          <span class="day-name">${dayNamesAr[day.getDay()]}</span>
          <span class="day-num">${day.getDate()}</span>
        </div>
      `).join('')}
    </div>

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
  const parts = dateStr.split('-');
  const y = parts[0];
  const m = parts[1].padStart(2, '0');
  const d = parts[2].padStart(2, '0');
  
  document.getElementById('aptDate').value = `${y}-${m}-${d}`;
  document.getElementById('aptTime').value = timeStr;
  
  window.openNewAppointmentModal();
};

async function overlayAppointmentsMonth(days) {
  if(!window.currentUser) return;
  
  const startDay = days[0];
  startDay.setHours(0,0,0,0);
  const endDay = days[days.length - 1];
  endDay.setHours(23,59,59,999);

  try {
    const q = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);
    
    snap.docs.forEach(doc => {
      const apt = { id: doc.id, ...doc.data() };
      if (!(apt.date >= startDay.getTime() && apt.date <= endDay.getTime())) return;
      
      const aptDate = new Date(apt.date);
      const dateKey = `${aptDate.getFullYear()}-${aptDate.getMonth()+1}-${aptDate.getDate()}`;
      const cell = document.querySelector(`[data-date="${dateKey}"] .cal-month-dots`);
      
      if(cell) {
        const dot = document.createElement('span');
        dot.className = 'apt-dot';
        dot.style.background = getStatusColor(apt.status);
        cell.appendChild(dot);
      }
    });
  } catch (err) {
    console.error("Cal load err", err);
  }
}

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
      const hourPart = apt.time.split(':')[0] + ':00'; 
      const cell = document.querySelector(`[data-date="${dateKey}"][data-time="${hourPart}"]`);
      
      if(cell) {
        const block = document.createElement('div');
        block.className = 'apt-block';
        block.style.cssText = `
          background: ${getStatusColor(apt.status)}22;
          border-right: 3px solid ${getStatusColor(apt.status)};
        `;
        block.innerHTML = `
          <span class="apt-block-name">${apt.clientName}</span>
          <span class="apt-block-service">${apt.service}</span>
        `;
        
        block.onclick = (e) => {
          e.stopPropagation();
          showToast(`موعد: ${apt.clientName}`, 'success');
        };

        cell.appendChild(block);
      }
    });

  } catch (err) {
    console.error("Cal load err", err);
  }
}

function getStatusColor(status) {
  const colors = {
    confirmed: '#10B981',
    pending: '#F59E0B',
    completed: '#0066FF',
    cancelled: '#EF4444'
  };
  return colors[status] || '#0066FF';
}

// Navigation Buttons
document.getElementById('btnPrevWeek')?.addEventListener('click', () => {
  if (currentView === 'month') {
    currentDate.setMonth(currentDate.getMonth() - 1);
  } else if (currentView === 'day') {
    currentDate.setDate(currentDate.getDate() - 1);
  } else {
    currentDate.setDate(currentDate.getDate() - 7);
  }
  renderCalendar();
});

document.getElementById('btnNextWeek')?.addEventListener('click', () => {
  if (currentView === 'month') {
    currentDate.setMonth(currentDate.getMonth() + 1);
  } else if (currentView === 'day') {
    currentDate.setDate(currentDate.getDate() + 1);
  } else {
    currentDate.setDate(currentDate.getDate() + 7);
  }
  renderCalendar();
});

document.getElementById('btnToday')?.addEventListener('click', () => {
  currentDate = new Date();
  renderCalendar();
});
