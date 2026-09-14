import fs from 'fs';
import path from 'path';

/**
 * Builds the review schedule as iCalendar files.
 *
 * The events are written here rather than by hand because the dates move: a
 * slipped deploy shifts the whole chain, and editing raw .ics risks breaking
 * the folding and escaping rules that make a file importable at all.
 *
 * Emits one combined file plus one file per event, so a single reminder can be
 * added without taking the rest.
 *
 * Usage:  npx tsx scripts/ops/make-calendar.ts
 */

const OUT_DIR = 'docs/calendar';

type Event = {
  file: string;
  uid: string;
  date: string;
  summary: string;
  description: string;
  rrule?: string;
};

const EVENTS: Event[] = [
  {
    file: '01-aws-key-rotation',
    uid: 'aws-rotate',
    date: '20260928',
    summary: 'Ротировать ключ AWS',
    description:
      'У текущего ключа права ec2:*, rds:*, iam:CreateRole — намного больше, чем нужно ETL.\n\n' +
      'Завести отдельный ключ только на s3:* по бакетам seo-pr-*, старый отозвать.\n' +
      'Обновить AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY в ~/seo/.env\n\n' +
      'Это единственный незакрытый хвост по безопасности.',
  },
  {
    file: '02-recalls-refresh-monthly',
    uid: 'recalls-refresh',
    date: '20261005',
    summary: 'Обновить отзывы авто (NHTSA)',
    description:
      'NHTSA выпускает примерно 10 новых кампаний в месяц по нашим 41 марке.\n\n' +
      'cd ~/seo\n' +
      'npm run load:recalls        # ~70 минут, можно оставить без присмотра\n' +
      'npm run publish -- recalls\n\n' +
      'Выкладка сама сообщит IndexNow только об изменившихся страницах.\n' +
      'Раз в год, примерно в сентябре, заодно проверить, появился ли новый модельный год.',
    rrule: 'FREQ=MONTHLY;BYMONTHDAY=5',
  },
  {
    file: '03-frost-needs-no-refresh',
    uid: 'frost-no-refresh',
    date: '20261005',
    summary: 'К сведению: заморозки обновлять НЕ надо',
    description:
      'Нормали NOAA — тридцатилетние средние, набор 1991-2020 действует примерно до 2031 года.\n' +
      'Зоны USDA обновляются раз в десятилетие, последний раз в 2023.\n\n' +
      'То есть данные frostdatefinder.com не устаревают. Повторять загрузку незачем.\n' +
      'Событие разовое — можно удалить после прочтения.',
  },
  {
    file: '04-search-console-first-check',
    uid: 'gsc-first-check',
    date: '20261207',
    summary: 'Search Console: первая осмысленная проверка',
    description:
      'Раньше декабря данных не будет, до этого не трогать.\n\n' +
      'Смотреть два отчёта:\n' +
      '- Pages (Страницы): сколько проиндексировано против найденного.\n' +
      '  Статус "Discovered - currently not indexed" у большинства — норма для молодого домена.\n' +
      '- Performance (Эффективность): появились ли первые показы.\n\n' +
      'Ничего не переотправлять и не править по результатам — просто записать цифры.',
  },
  {
    file: '05-adsense-apply',
    uid: 'adsense-apply',
    date: '20261214',
    summary: 'Подать заявку в AdSense',
    description:
      'БЕЗ ЭТОГО ДОХОДА НЕ БУДЕТ ВООБЩЕ. Рекламного кода на сайтах пока нет.\n\n' +
      'Подавать в декабре, а не в феврале: рассмотрение занимает от дней до недель,\n' +
      'и подача в разгар сезона означает потерю самого сезона.\n\n' +
      'Что нужно до подачи:\n' +
      '- страница политики конфиденциальности (обязательна для AdSense)\n' +
      '- немного органического трафика — с нулём заявку часто отклоняют\n' +
      '- рекламный код на страницах + пересборка и выкладка\n\n' +
      'Пороги сетей: AdSense — нет порога, RPM $5-8. Raptive — 25 000 просмотров/мес,\n' +
      'RPM $20+. Journey by Mediavine — от 1 000 сессий/мес.',
  },
  {
    file: '06-pre-season-check',
    uid: 'pre-season',
    date: '20270125',
    summary: 'Проверка перед сезоном заморозок',
    description:
      'Сезон начинается в феврале. Убедиться, что всё живо:\n\n' +
      'curl -s -o /dev/null -w "%{http_code}\\n" https://frostdatefinder.com/frost\n\n' +
      'Проверить в Search Console, что индексация выросла с декабря.\n' +
      'Если страниц в индексе мало — это ответ на вопрос о проекте, а не повод срочно что-то менять.',
  },
  {
    file: '07-season-weekly-watch',
    uid: 'season-watch',
    date: '20270201',
    summary: 'Сезон заморозок: записать трафик за неделю',
    description:
      'Февраль-апрель — единственная близкая проверка гипотезы.\n' +
      'Прогноз: 15-60 тыс. визитов, $120-500/мес. Вероятность превысить $100/мес — 40-45%.\n\n' +
      'Записывать: показы и клики в Search Console, визиты в аналитике.\n' +
      'Не менять сайт в разгар сезона — иначе непонятно, что именно сработало.',
    rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20270430',
  },
  {
    file: '08-decision-point',
    uid: 'decision',
    date: '20270510',
    summary: 'Точка решения по проекту',
    description:
      'Сезон прошёл, данные есть. Решать на цифрах, а не на ощущениях.\n\n' +
      'Вопросы:\n' +
      '- Сколько страниц реально в индексе из 32 604?\n' +
      '- Какой был пик трафика в сезон?\n' +
      '- Окупил ли домен ($1.33/мес) себя?\n\n' +
      'Если да — масштабировать по правилу отбора из docs/КУДА_РАСШИРЯТЬСЯ.md:\n' +
      'ниша живёт, только если рядом с запросом никто не продаёт дорогой товар.\n' +
      'Если нет — закрывать без сожалений, эксперимент стоил цены домена.',
  },
];

/** RFC 5545 escaping: backslash, semicolon, comma and newline are significant. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 caps a content line at 75 octets; continuations start with a space. */
function fold(line: string): string[] {
  if (Buffer.byteLength(line) <= 73) return [line];
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char) > 73) {
      out.push(current);
      current = ` ${char}`;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

function vevent(event: Event): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}@frostdatefinder.com`,
    'DTSTAMP:20260914T120000Z',
    `DTSTART;VALUE=DATE:${event.date}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    'TRANSP:TRANSPARENT',
  ];
  if (event.rrule) lines.push(`RRULE:${event.rrule}`);
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.summary)}`,
    'END:VALARM',
    'END:VEVENT',
  );
  return lines;
}

function calendar(name: string, events: Event[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//seo//programmatic SEO//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events.flatMap(vevent),
    'END:VCALENDAR',
  ];
  return `${lines.flatMap(fold).join('\r\n')}\r\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const event of EVENTS) {
  const file = path.join(OUT_DIR, `${event.file}.ics`);
  fs.writeFileSync(file, calendar(event.summary, [event]));
  console.log(`[+] ${file}`);
}

const combined = path.join(OUT_DIR, '00-all-events.ics');
fs.writeFileSync(combined, calendar('SEO — заморозки и отзывы авто', EVENTS));
console.log(`[+] ${combined} (${EVENTS.length} событий)`);
