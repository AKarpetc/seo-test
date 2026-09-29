# Тест: список новых перевозчиков FMCSA по подписке, без продаж

Дата: 2026-09-28. Бриф для отдельной сессии. Промпт для запуска —
[NEXT_SESSION_PROMPT_FMCSA.md](NEXT_SESSION_PROMPT_FMCSA.md). Решение уровня портфеля —
`/Users/artyomkarpets/IncomeApps/ideas/backlog/03_self_serve_data_products.md`.

## 1. Что проверяем

**Гипотеза:** страховые агентства (и факторинг, брокеры, продавцы ELD) купят подписку на
свежий список перевозчиков, получивших operating authority, **сами** — через поиск, лендинг и
оплату картой, без звонков и писем с нашей стороны.

Это тест, а не продукт: минимум, достаточный чтобы получить ответ «платят или нет».
**Бюджет: ~$200 на рекламу + ~$15 домен. Срок: 30 дней с момента запуска рекламы.**

## 2. Что уже есть

| | |
|---|---|
| Данные | таблица `DOTCarrier`, 2.2 млн строк; загрузчик `scripts/load_trucking.ts` (FMCSA census из S3, upsert) |
| Выгрузка | `npx tsx scripts/export_new_carriers.ts --days 30 --state TX` → CSV: DOT, название, дата authority, тягачи, водители, тип операции, телефон, адрес |
| Объём | 12–15 тыс. новых authority в месяц, у всех телефон ([ПЛАН_5000](/Users/artyomkarpets/IncomeApps/ideas/imported/seo/ПЛАН_5000.md)) |
| Рынок | конкурент: $39/мес + $40/штат; лид автострахования $30–65, живой перевод $50–120 ([ПРОГНОЗ_ДОХОДА](ПРОГНОЗ_ДОХОДА.md)) |
| Второй набор | новые компании NY/CO/CT, 38 974 за 30 дней — `scripts/export_new_businesses.ts` (в тест **не** включаем, один продукт за раз) |

Оценка без продаж [гипотеза]: $500–2 000/мес к 12-му месяцу, потолок ~$3–5 тыс.

## 3. Фаза 0 — ворота до постройки

Результаты — в §9. «Закрыть» — остановиться и сообщить владельцу.

| # | Проверка | Как | Закрыть, если |
|---|---|---|---|
| F-G1 | **Приём оплаты на ИП РК** | **Stripe в Казахстане недоступен** — проверить merchant of record: Lemon Squeezy, Paddle, Gumroad, 2Checkout; условия для ИП РК, вывод, комиссия, разрешены ли **данные о людях/бизнесах** (у MoR есть списки запрещённых товаров). Регистрацию делает владелец | ни один MoR не принимает ИП РК или запрещает такой товар |
| F-G2 | **Право продавать** | условия использования FMCSA census / data.transportation.gov; персональные данные: у ИП-перевозчиков телефон и адрес — это данные физлица (законы штатов о приватности, брокеры данных — регистрация в CA/VT/TX/OR?); дисклеймер для покупателя (TCPA/DNC при обзвоне — ответственность покупателя) | прямой запрет перепродажи или обязательная регистрация брокера данных, несовместимая с тестом за $200 |
| F-G3 | **Конкуренты и цены сегодня** | найти 3–5 продавцов «new authority / new MC leads»: цены, частота, формат, пробный период | рынок насыщен бесплатными источниками того же качества |
| F-G4 | **Есть ли поиск** | ключи: new trucking authority list, new MC numbers, new DOT numbers leads, trucking insurance leads, new authority leads — объёмы и CPC (Keyword Planner — аккаунт владельца, или Google Trends / сторонние оценки с пометкой) | CPC такой, что $200 дают < 50 кликов |

## 4. Продукт для теста

- **Предложение:** «Новые перевозчики с operating authority — каждый будний день, по вашим штатам,
  CSV на почту».
- **Цены** (решить после F-G3): штат — **$99–149/мес**; вся страна — **$399/мес**;
  годовая со скидкой — не в тесте.
- **Бесплатный образец:** последние 7 дней одного штата, первые 25 строк, телефоны частично
  скрыты — выдаётся мгновенно за email (это и есть замер интереса).
- **Доставка в тесте:** полуавтомат — скрипт на машине владельца или облачный cron формирует
  CSV по подписчикам и отправляет письмо. Полная автоматизация (обновление census, доставка,
  отписка) — **только если ворота §7 пройдены**.
- **Свежесть:** census FMCSA обновляется ежедневно — перед каждой отправкой перезагружать
  (`npm run load:trucking` после `npm run ingest trucking`); проверить, сколько это занимает.

## 5. Что построить

1. Лендинг — статический, на Cloudflare Pages, как три SEO-сайта. Отдельный домен (решить
   бренд; не смешивать с artuplabs.com). Страницы: главная с примером строк и ценами,
   `/sample` (форма образца), `/privacy`, `/terms` (с дисклеймером об использовании данных), `/data`
   (откуда данные, частота, поля).
2. Генератор образца: email → CSV образца на почту; email попадает в список подписчиков-лидов.
3. Оплата: ссылки checkout выбранного MoR на тарифы; вебхук или ручная сверка → список подписчиков.
4. Скрипт рассылки: подписчик × штаты → CSV → письмо. Отправка — через Cloudflare Email / Zoho /
   сервис транзакционной почты (решить; нужен SPF/DKIM на домене).
5. Аналитика без персональных данных: Cloudflare Web Analytics + счётчики событий
   (визит, запрос образца, переход в checkout, оплата).
6. Страница-свод для владельца: `npm run fmcsa:report` — воронка по дням.

Код — в этом репозитории (`scripts/fmcsa/`, `static/fmcsa-landing/` или по соглашениям проекта).
Сначала прочитать `AGENTS.md`: Next.js здесь нестандартной версии.

## 6. Запуск и каналы (без продаж)

1. Google Ads, поиск, $200 на 30 дней по ключам из F-G4, только США. Кампанию создаёт и
   оплачивает **владелец**; сессия готовит структуру, ключи, минус-слова, тексты.
2. Бесплатно: листинг в каталогах данных (Datarade и аналоги) — если разрешают без звонков;
   IndexNow и Search Console для лендинга.
3. **Никаких** холодных писем и звонков — это нарушает условие теста.

## 7. Ворота результата (названы до запуска)

За 30 дней после старта рекламы:

| Оплат | Решение |
|---|---|
| < 3 | закрыть; записать отрицательный результат в IncomeApps |
| 3–10 | записать; решить про второй набор (новые компании) и цену |
| > 10 | строить: полная автоматизация, отдельный проект по правилу IncomeApps (`CLAUDE.md`) |

Дополнительно фиксировать: визиты, запросы образца, конверсию образец → оплата, CPC, отток.

## 8. Роли

| Владелец | Сессия |
|---|---|
| аккаунт MoR, домен, Google Ads и $200, почта на домене, финальный запуск | фаза 0, лендинг, образец, рассылка, аналитика, отчёт, тексты рекламы |

Правила сессии: не пушить без слова владельца; коммиты — как в истории репозитория
(английское предложение) + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`;
секреты только в `.env`; ключи не печатать.

## 9. Результаты

_Заполняет сессия._ Метки: **[И]** измерено, **[С]** источник со ссылкой, **[Г]** гипотеза.

| # | Результат | Дата | Вердикт |
|---|---|---|---|
| F-G1 | ИП РК принимают Paddle, Dodo, Polar, Freemius, Gumroad [С]. Сырой список контактов прямо запрещают Polar, Dodo, Gumroad; Freemius берёт только ПО. У Paddle прямого запрета на данные нет, но есть запрет на «marketing services» и на товар без «bona fide software» → продавать как **SaaS-сервис данных** и получить письменное «да» до постройки. Подробно — §9.1 | 2026-09-29 | **Не закрыто, условно.** MoR есть — **Paddle**, при условии письменного согласия на продукт. Если Paddle откажет — ворота закрываются: запасного MoR под этот товар нет |
| F-G2 | Census — открытые данные федерального правительства: «Rights: public», обновление ежедневное [И]; у работ правительства США нет копирайта (17 U.S.C. §105). Прямого запрета на перепродажу не нашли. Регистрация брокера данных: в VT и OR есть прямое исключение для публичных данных, связанных с бизнесом или профессией человека; в TX и CA публичные государственные записи не считаются «personal data / personal information». Итог: регистрация **скорее не нужна**. Остаточный риск — CA: CPPA оценивает каждый случай отдельно, а регистрация стоит $6 000/год. Подробно — §9.2. **Это исследование, не юридическая консультация** | 2026-09-29 | **Не закрыто, с условиями:** брать только поля census/L&I без обогащения из других источников; дисклеймер TCPA/DNC; удалять запись по запросу. Перед оплатой рекламы — 1 час у юриста США (≈$150–300) [Г] |
| F-G3 | Самостоятельно покупаемые аналоги дешевле нашей плановой цены. TruckerDB — $49/мес за всю страну с email. PollyAI — $39 + $40/штат. XDate Alert — $69 за штат и $249 за всю страну. Barrgo — $99 разово за всю базу. Акторы Apify — $3–20 за 1 000 записей. Сырые данные бесплатны: census ежедневно, L&I, QCMobile. Подробно — §9.3 | 2026-09-29 | **Не закрыто, но цену менять.** Бесплатные источники сырые: страховому агенту без навыков они не заменяют готовую рассылку. Цена $99–149 за штат выше рынка. Для теста — **$49 за штат, $149 за всю страну** или отличие от конкурентов (см. §9.3) |
| F-G4 | Keyword Planner владельца, США, сент. 2025 – авг. 2026 (`IncomeApps/analysis/data/keywords/B_fmcsa_2026-09-29.csv`) [И]: сумма по 22 ключам **≈ 300 запросов/мес**; у 15 из 22 (все «new authority / new MC / new DOT …») объёма нет. С объёмом 10–100: trucking insurance leads (ставка $5.63–23.80), commercial truck insurance leads ($5.33–24.07), trucking company database ($7.24–15.52), fmcsa new authority list, freight factoring leads, trucking company leads | 2026-09-29 | **закрыть по воротам**: минимальная ставка $5.33–7.24 → $200 дают ≈ 28–38 кликов < 50; и поиска под сам продукт почти нет. Покупатель такой список не ищет в Google |
| Итог 30 дней | | | |

### 9.1 F-G1 — оплата (проверено 2026-09-29)

| MoR | ИП РК | Выплата | Комиссия | Данные о бизнесах/людях — точный текст политики |
|---|---|---|---|---|
| **Paddle** | да: РК нет в списке исключённых стран ([страны](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)) | wire (SWIFT), PayPal, Payoneer; минимум $100, выплата до 15-го ([выплаты](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)) | 5% + $0.50 ([pricing](https://www.paddle.com/pricing)) | Слов «list», «database», «leads» в [AUP](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle) нет. Рискованные пункты: «Advertising and marketing (… marketing services, telemarketing … mass marketing products)»; запрещено то, где «no bona fide software or service»; запрещён доступ к «unauthorized access to data belonging to another party» (про spyware — к нам не относится) |
| Dodo Payments | да: РК в [списке стран](https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories) | wire; $5 за выплату < $1 000, $25 за USD SWIFT | 4% + $0.40, +1.5% за международную карту, +0.5% за подписку ([pricing](https://docs.dodopayments.com/miscellaneous/pricing-and-fee-structure)) | **запрет:** «Data privacy violations, including lead scraping, mass outreach or spam tools, and sensitive private information databases» ([политика](https://docs.dodopayments.com/miscellaneous/merchant-acceptance)) |
| Polar | да: РК в [списке](https://polar.sh/docs/merchant-of-record/supported-countries) (Stripe Connect Express) | банк | 5% + $0.50 | **запрет:** «Reselling or distributing customer data»; «… lead generation, bulk SMS and automated outreach»; «Services that aggregate, search, or expose personal data about individuals using public or leaked sources» ([AUP](https://polar.sh/docs/merchant-of-record/acceptable-use)) |
| Freemius | да ([страны](https://freemius.com/help/documentation/selling-with-freemius/supported-countries/)) | PayPal, Payoneer, wire, Wise | 4.7% | **только ПО:** «Freemius is exclusively focused on serving makers selling software like SaaS and downloadable software» ([товары](https://freemius.com/help/documentation/selling-with-freemius/allowed-prohibited-products/)). Подписку на данные туда не отнести |
| Gumroad | да: выплаты в РК с конца 2024 ([X](https://x.com/gumroad/status/1856525514275803638)) | банк, минимум $100 | 10% + $0.50; MoR с 2025 ([С](https://www.swell.is/content/gumroad-pricing)) | **запрет:** «bulk marketing tools which includes email lists…» и «mailing lists» ([prohibited](https://gumroad.com/prohibited)) |
| 2Checkout/Verifone | не подтверждено: страница стран отдаёт 404, AUP закрыт от скрипта (Incapsula) | — | — | по выдаче поиска: запрещён показ или продажа «personal information from third parties» с целью репутационного вреда ([PPL](https://www.2checkout.com/legal/acceptance/)); остальное не проверено |
| Lemon Squeezy | см. [анализ 2026-09-28](/Users/artyomkarpets/IncomeApps/analysis/2026-09-28_new_niches_b2b.md) | — | — | переезжает на Stripe Managed Payments, где РК нет, — для новых продуктов не брать |

**Как подать продукт Paddle.** Не «lead list / leads», а SaaS: «кабинет с фильтрами по штату, парку и дате, ежедневный экспорт и email-сводка по публичным данным FMCSA». В Terms — запрет спама и требование соблюдать TCPA/DNC.

Владельцу до постройки: отправить в поддержку Paddle описание продукта со ссылкой на пример строк и получить письменный ответ. Paddle всё равно проверяет домен до первой продажи, и критерии отказа почти не описаны ([С](https://dev.to/odedunipaas/paddle-rejected-my-account-heres-the-map-of-what-actually-works-in-2026-1f1k)).

### 9.2 F-G2 — право продавать (проверено 2026-09-29; не юридическая консультация)

- **Лицензия census.** Метаданные [набора az4n-8mr2](https://data.transportation.gov/api/views/az4n-8mr2.json): «Public Access Level: public», «Rights: public», «Update Frequency: R/P1D» (ежедневно), «License: unknown-license» [И].
  - Ограничений на коммерческое использование в метаданных нет.
  - Работы федерального правительства не охраняются копирайтом: [17 U.S.C. §105](https://www.law.cornell.edu/uscode/text/17/105).
  - FMCSA L&I: сведения «provided free-of-charge … public information which has long been available under the Freedom of Information Act» ([L&I](https://li-public.fmcsa.dot.gov/LIVIEW/pkg_menu.prc_menu); прямая страница закрыта от скрипта — цитата по выдаче поиска).
  - Прямого запрета на перепродажу **не найдено**.
- **Что в данных.** В наборе есть `phone`, `cell_phone`, `email_address`, `company_officer_1/2` и физический адрес [И]. Наш `export_new_carriers.ts` берёт телефон и адрес, email и имена руководителей не берёт. У ИП-перевозчика это телефон и адрес физлица.
- **Законы штатов о брокерах данных:**

| Штат | Нужна ли регистрация нам | Стоимость | Источник |
|---|---|---|---|
| Vermont | нет: «brokered personal information… does not include publicly available information to the extent that it is related to a consumer's business or profession» | — | [9 V.S.A. §2430](https://legislature.vermont.gov/statutes/section/09/062/02430) |
| Oregon | нет: регистрация не нужна, если речь только о «publicly available information that is related to a resident individual's business or profession» | $600/год | [DFR FAQ](https://dfr.oregon.gov/business/licensing/data-broker-registry/pages/data-broker-faqs.aspx) |
| Texas | скорее нет: «personal data» по Ch. 509 «does not include … publicly available information» (включая государственные записи). С 2025 порог — > 50% выручки или > 50 000 человек | $300/год | [Tex. Bus. & Com. Code §509.001](https://texas.public.law/statutes/tex._bus._&_com._code_section_509.001), [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20250904-texas-expands-and-modifies-data-broker-registration-law), [SOS](https://www.sos.state.tx.us/statdoc/faqs4000.shtml) |
| California (Delete Act, CPPA) | скорее нет, но **главный риск**. «Publicly available» — это «lawfully made available from federal, state, or local government records», такие сведения не считаются personal information. Однако «fact-specific … where data is aggregated, enhanced, or combined». С 2026-08-01 зарегистрированные брокеры обязаны каждые 45 дней обрабатывать удаления через DROP. Штраф — $200 в день; в августе 2026 создана «strike force» | **$6 000 в 2026, $9 500 с 2027** | [Coblentz](https://www.coblentzlaw.com/news/navigating-californias-data-broker-requirements-in-2026/), [CPPA](https://cppa.ca.gov/data_brokers/), [Crowell](https://www.crowell.com/en/insights/client-alerts/california-privacy-agency-launches-data-broker-strike-force-amid-delete-act-crackdown) |

  Вывод [Г]: пока в продукте только государственные записи, связанные с бизнесом перевозчика, регистрация нигде не обязательна. Если придётся регистрироваться в CA, это $6 000 в год — **с тестом за $200 несовместимо**. Правила:
  - **не обогащать** данные email и телефонами из сторонних источников;
  - писать источник на `/data`;
  - удалять запись по запросу.
- **TCPA/DNC** — ответственность на покупателе, но дисклеймер обязателен.
  - Исключения для B2B в TCPA нет. На сотовый (многие owner-operator указывают личный мобильный) звонок с автодозвоном или записью и SMS требуют предварительного согласия. Штраф — $500–1 500 за звонок ([С](https://inboundlabs.app/blog/tcpa-compliance-for-b2b-calls), [С](https://mslawgroup.com/tcpa-requirements-faq/)).
  - Мобильные ИП могут стоять в национальном DNC.
  - Текст для `/terms` и каждого CSV: «Data is compiled from public FMCSA records. Numbers may be wireless or residential and may be listed on the National Do Not Call Registry. Buyer is solely responsible for compliance with the TCPA, TSR, CAN-SPAM and state telemarketing laws, including DNC scrubbing and consent for autodialed/prerecorded calls and texts. Not for consumer credit, employment, insurance eligibility or tenant screening decisions (not a consumer report under FCRA).»

### 9.3 F-G3 — конкуренты (проверено 2026-09-29)

| Продавец | Цена | Частота | Поля | Проба | Как продаёт |
|---|---|---|---|---|---|
| [TruckerDB](https://www.truckerdb.com/motor-carrier-leads) | **$49/мес** (фильтр по штатам); $499/мес с почтовой инфраструктурой | ежедневно в 7:00, 15 тыс./мес | владелец, **email**, телефон, DOT, город/штат, класс | бесплатный образец | self-serve |
| PollyAI ([С](https://getpollyai.com/blog/best-trucking-insurance-leads)) — конкурент из ПРОГНОЗ_ДОХОДА | **$39/мес + $40/штат** (1 штат = $79) | не указано | парк, груз, VIN, OOS, дата окончания страховки + email-рассылки и воронка | не указано | self-serve |
| [XDate Alert](https://xdatealert.com/carrierok-alternative) | **$69 за штат**, $149 за 3 штата, $249 за всю страну | каждое утро письмо | телефон, город, штат, дата отмены страховки; new authority и reinstatement | 3 лида + неделя бесплатно | self-serve, без карты |
| [Barrgo](https://www.barrgotruckinglists.com/fmcsa-carrier-data.html) | **$99 разово**, вся база 1.6 млн | снимок | имя, email, телефон, адрес, DOT, тип | нет | self-serve (Stripe) |
| CarrierOK ([pricing](https://www.carrierok.com/pricing)) | от $149/мес, $349, $499; API по факту использования | ежедневно | 300+ полей, экспорт новых перевозчиков | 14 дней | self-serve + продажи |
| Apify: [jobito](https://apify.com/jobito/fmcsa-new-authority-feed) и ещё ≥ 6 акторов | **$3–20 за 1 000 записей** (≈ $18/мес за 200 записей в день) | ежедневно | вся строка census + AuthHist | платформенный кредит | self-serve, для технарей |
| Carrier IQ, Carrier Details, TruckingLeads.com | цены не публикуют | ежедневно / 2 раза в день | — | демо | продажи |

**Бесплатно:**
- census на data.transportation.gov (ежедневно, со всеми контактными полями);
- набор AuthHist;
- FMCSA Register и L&I;
- [QCMobile API](https://mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi) — бесплатный ключ через Login.gov, поиск по одному DOT;
- SAFER.

Всё это сырые данные: нужны скрипт и чистка, готовой рассылки «новые по моим штатам» бесплатно нет.

**Вывод.** Ворота «рынок насыщен бесплатными источниками того же качества» формально не сработали: бесплатно — только сырьё. Но self-serve рынок **уже занят и дешевле плана**. Лидер по цене — TruckerDB: $49 за всю страну, с email. Цена $99–149 за штат не выдерживает сравнения.

Для теста:
- **(а)** $49/мес за штат, $149/мес за всю страну;
- или **(б)** отличие, за которое платят больше: отметка «уже подана страховка / ещё нет» (BMC-91 из L&I), X-dates отмен как у XDate Alert, CSV готовый для AgencyZoom.

Решает владелец. Иначе ворота §7 (≥ 3 оплат) почти наверняка не пройдём [Г].

### Итог фазы 0 (2026-09-29)

F-G1–F-G3 не закрыли тест, но каждые из них пройдены с условием:
- **(1)** письменное согласие Paddle на продукт, поданный как SaaS;
- **(2)** только поля FMCSA без обогащения, дисклеймер TCPA/DNC, удаление по запросу; желательно час у юриста США по CA Delete Act;
- **(3)** цена ниже: $49 за штат и $149 за всю страну — или отличие продукта.

Строить лендинг — после (1) и F-G4.

**За владельцем:**
1. Письмо в Paddle и ответ.
2. Замер F-G4 в Keyword Planner по списку ниже (порог: при таком CPC $200 должны дать ≥ 50 кликов, то есть CPC ≤ $4).
3. Выбор цены (а) или (б).
4. По желанию — консультация юриста.

**Ключи F-G4 — этот тест (США):**
- *Списки новых authority:*
  - new authority leads
  - new mc authority leads
  - new trucking authority list
  - new mc numbers list
  - new dot numbers list
  - new dot numbers leads
  - newly registered trucking companies
  - new trucking companies list
  - fmcsa new authority list
  - new motor carrier leads
- *Страхование:*
  - trucking insurance leads
  - commercial truck insurance leads
  - new venture trucking insurance leads
  - truck insurance leads for agents
  - owner operator insurance leads
- *Данные и смежные покупатели:*
  - fmcsa carrier data
  - fmcsa database download
  - trucking company database
  - motor carrier list by state
  - trucking company leads
  - freight factoring leads
  - fmcsa leads
- *Минус-слова:* jobs, cdl, driver, salary, school, "how to get", "apply", "cost of authority", free.

**Ключи идеи 09 (комплаенс новых перевозчиков):**
- new entrant safety audit
- new entrant safety audit checklist
- dot new entrant audit
- new authority audit
- dot audit checklist
- fmcsa new entrant program
- boc-3 filing
- boc-3 process agent
- ucr registration
- ucr registration deadline
- mcs-150 update
- mcs-150 biennial update
- dot compliance for new trucking company
- ifta registration
- form 2290 filing
- drug and alcohol clearinghouse registration
