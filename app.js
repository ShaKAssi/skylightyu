const SCHEDULE_URL = './data/schedule.json';
const SHARDS_URL = './data/shards.json';

let schedule = null;
let shards = null;

const clockElement = document.getElementById('clock');
const farmListElement = document.getElementById('farm-list');
const shardsListElement = document.getElementById('shards-list');
const shardsCalendarElement = document.getElementById('shards-calendar');

function getBeijingDate() {
const parts = new Intl.DateTimeFormat('en-GB', {
timeZone: 'Asia/Shanghai',
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
hourCycle: 'h23'
}).formatToParts(new Date());

const values = {};

for (const part of parts) {
    if (part.type !== 'literal') {
        values[part.type] = part.value;
    }
}

return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
));

}


function escapeHTML(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(/[&<>"']/g, function (char) {
        return entities[char];
    });
}

function getUTC8Minutes() {
    const now = new Date();
    const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    return utc8.getUTCHours() * 60 + utc8.getUTCMinutes();
}


function getUTC8Date() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function updateClock() {
const parts = new Intl.DateTimeFormat('ru-RU', {
timeZone: 'Asia/Shanghai',
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
weekday: 'long',
hourCycle: 'h23'
}).formatToParts(new Date());

const values = {};

for (const part of parts) {
    if (part.type !== 'literal') {
        values[part.type] = part.value;
    }
}

const weekday =
    values.weekday.charAt(0).toUpperCase() +
    values.weekday.slice(1);

clockElement.textContent =
    `${values.day}.${values.month}.${values.year}` +
    ` • ${values.hour}:${values.minute}:${values.second}` +
    ` • ${weekday}`;

}

function parseClockTime(time) {
const match = /^(\d{1,2}):(\d{2})$/.exec(time);

if (!match) return null;

const hours = Number(match[1]);
const minutes = Number(match[2]);

if (hours > 24 || minutes > 59) return null;
if (hours === 24 && minutes !== 0) return null;

return hours * 60 + minutes;

}

function getCurrentMinute(date = getBeijingDate()) {
return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function isFarmTimeActive(time, durationMinutes, now) {
const start = parseClockTime(time);
const duration = Number(durationMinutes);


if (
    start === null ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration >= 1440
) {
    return false;
}

const current = getCurrentMinute(now);
const elapsed = (current - start + 1440) % 1440;

return elapsed < duration;

}

function isShardTimeActive(timeRange, now) {
const match = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/
.exec(timeRange);

if (!match) return false;

const start = parseClockTime(match[1]);
const end = parseClockTime(match[2]);

if (
    start === null ||
    end === null ||
    end <= start
) {
    return false;
}

const current = getCurrentMinute(now);

return current >= start && current < end;

}

function isFarmTimePast(startTime, durationMinutes = 0) {
    const currentMinutes = getUTC8Minutes();

    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
  
    if (currentMinutes < startMinutes) {
        return false;
    }
  
    return currentMinutes >= endMinutes;
}




function isShardTimePast(timeRange, now = getBeijingDate()) {
    const match = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/
        .exec(timeRange);

    if (!match) return false;

    const end = parseClockTime(match[2]);
    if (end === null) return false;

    const current = getCurrentMinute(now);
  
    if (end === 1440) {
        return current > 0;
    }

    return current >= end;
}

function renderTimes(
times,
activeIndexes = [],
pastIndexes = []
) {
if (!times || times.length === 0) {
return '<span>Времена не указаны</span>';
}

return times.map((time, index) => {
    const classes = ['time-badge'];

    if (activeIndexes.includes(index)) {
        classes.push('active-event');
    } else if (pastIndexes.includes(index)) {
        classes.push('event-past');
    }

    return `
        <span class="${classes.join(' ')}">
            ${escapeHTML(time)}
        </span>
    `;
}).join('');

}

function renderCard(
name,
times,
extraClass = '',
activeIndexes = [],
pastIndexes = []
) {
return ` <article class="schedule-card ${extraClass}"> <div class="schedule-card-header"> <h2>${escapeHTML(name)}</h2> </div>

        <div class="schedule-times">
            ${renderTimes(times, activeIndexes, pastIndexes)}
        </div>
    </article>
`;

}

function formatEventInterval(time, durationMinutes) {
const startMinutes = parseClockTime(time);

if (
    startMinutes === null ||
    !Number.isFinite(Number(durationMinutes))
) {
    return time;
}

const endMinutes = startMinutes + Number(durationMinutes);

function formatTime(totalMinutes) {
    const normalized =
        ((totalMinutes % 1440) + 1440) % 1440;

    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;

    return (
        String(hours).padStart(2, '0') +
        ':' +
        String(minutes).padStart(2, '0')
    );
}

return `${formatTime(startMinutes)}–${formatTime(endMinutes)}`;

}

function updateFarm(now = getBeijingDate()) {
if (!schedule) return;

const events = Object.entries(schedule)
    .filter(([key, config]) =>
        key !== 'timezone' &&
        config &&
        Array.isArray(config.times)
    );

if (events.length === 0) {
    farmListElement.innerHTML = `
        <div class="no-events">
            Расписание фарма отсутствует
        </div>
    `;
    return;
}

farmListElement.innerHTML = events.map(([key, config]) => {
    const duration = Number(config.durationMinutes) || 0;

    const intervals = config.times.map(time =>
        formatEventInterval(time, duration)
    );

    const activeIndexes = [];
    const pastIndexes = [];

    config.times.forEach((time, index) => {
        if (isFarmTimeActive(time, duration, now)) {
            activeIndexes.push(index);
        } else if (isFarmTimePast(time, duration, now)) {
            pastIndexes.push(index);
        }
    });

    return renderCard(
        config.name || key,
        intervals,
        `${key}-card`,
        activeIndexes,
        pastIndexes
    );
}).join('');

}

function getShardTimesForDate(date, color) {
const config = shards?.[color];

if (!config || !Array.isArray(config.schedules)) {
    return [];
}

const day = date.getUTCDate();
const weekday = date.getUTCDay();

const matching = config.schedules.filter(item => {
    if (!item.days?.includes(weekday)) {
        return false;
    }

    if (
        item.fromDay !== undefined &&
        day < item.fromDay
    ) {
        return false;
    }

    if (
        item.toDay !== undefined &&
        day > item.toDay
    ) {
        return false;
    }

    return true;
});

return [
    ...new Set(
        matching.flatMap(item => item.times || [])
    )
];

}

function updateShards(now = getBeijingDate()) {
if (!shards) return;

const colors = [
    {
        key: 'red',
        name: '🔴 Красный осколок',
        className: 'red-shards'
    },
    {
        key: 'black',
        name: '⚫ Чёрный осколок',
        className: 'black-shards'
    }
];

const cards = [];

for (const color of colors) {
    const times = getShardTimesForDate(now, color.key);

    if (times.length === 0) continue;

    const activeIndexes = [];
    const pastIndexes = [];

    times.forEach((time, index) => {
        if (isShardTimeActive(time, now)) {
            activeIndexes.push(index);
        } else if (isShardTimePast(time, now)) {
            pastIndexes.push(index);
        }
    });

    cards.push(
        renderCard(
            color.name,
            times,
            color.className,
            activeIndexes,
            pastIndexes
        )
    );
}

if (cards.length === 0) {
    shardsListElement.innerHTML = `
        <div class="no-events">
            Сегодня осколков нет
        </div>
    `;
    return;
}

shardsListElement.innerHTML = cards.join('');

}


function getShardColor(date) {
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();

    if (
        weekday === 2 &&
        day >= 1 &&
        day <= 15
    ) {
        return 'black';
    }

    if (
        weekday === 3 &&
        day >= 16
    ) {
        return 'black';
    }

    if (
        weekday === 5 &&
        day >= 16
    ) {
        return 'red';
    }

    if (
        weekday === 6 &&
        day >= 1 &&
        day <= 15
    ) {
        return 'red';
    }

    if (weekday === 0) {
        return 'red';
    }

    return null;
}

function updateShardsCalendar(now = getBeijingDate()) {
if (!shardsCalendarElement) return;

const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const today = now.getUTCDate();

const weekdays = [
    'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'
];

const firstDay = new Date(Date.UTC(year, month, 1));

let firstWeekday = firstDay.getUTCDay();
firstWeekday =
    firstWeekday === 0 ? 6 : firstWeekday - 1;

const daysInMonth =
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

let html = '<div class="calendar-header">';

for (const weekday of weekdays) {
    html += `
        <div class="calendar-weekday">
            ${weekday}
        </div>
    `;
}

html += '</div><div class="calendar-grid">';

for (let i = 0; i < firstWeekday; i++) {
    html += '<div class="calendar-day empty"></div>';
}

for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month, day));
    const color = getShardColor(date);
    const isToday = day === today;
    const isPast = day < today;

    let classes = 'calendar-day';

    if (color) classes += ` ${color}`;
    if (isToday) classes += ' today';
    if (isPast) classes += ' event-past';

    html += `
        <div class="${classes}">
            ${day}
        </div>
    `;
}

html += '</div>';

shardsCalendarElement.innerHTML = html;

}

function update() {
const now = getBeijingDate();

updateClock();
updateFarm(now);
updateShards(now);
updateShardsCalendar(now);

}

async function loadData() {
try {
const [scheduleResponse, shardsResponse] =
await Promise.all([
fetch(SCHEDULE_URL),
fetch(SHARDS_URL)
]);

    if (!scheduleResponse.ok) {
        throw new Error(
            `Ошибка schedule.json: ${scheduleResponse.status}`
        );
    }

    if (!shardsResponse.ok) {
        throw new Error(
            `Ошибка shards.json: ${shardsResponse.status}`
        );
    }

    schedule = await scheduleResponse.json();
    shards = await shardsResponse.json();

    update();
} catch (error) {
    console.error(
        'Не удалось загрузить данные:',
        error
    );

    farmListElement.innerHTML = `
        <div class="no-events">
            Не удалось загрузить расписание фарма
        </div>
    `;

    shardsListElement.innerHTML = `
        <div class="no-events">
            Не удалось загрузить расписание осколков
        </div>
    `;
}

}

loadData();

setInterval(update, 1000);