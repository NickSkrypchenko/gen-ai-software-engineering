# **Разработка спецификаций требований (SRS) нового поколения: Синтез классических стандартов системного анализа и операционных сред автономных ИИ-агентов**

## **Теоретические основы сопряжения классического системного анализа и агентных сред разработки**

Исторически разработка спецификаций требований к программному обеспечению (Software Requirements Specification, SRS) преследовала цель минимизации семантического разрыва между бизнес-заказчиком, системным аналитиком и командой инженеров. Классические стандарты, такие как IEEE 830 и ISO/IEC/IEEE 29148, формировали жесткую, иерархическую структуру документирования, ориентированную на человеческое восприятие, долгосрочное планирование и ретроспективный аудит.1 Однако лавинообразное внедрение автономных ИИ-кодеров и терминальных ИИ-агентов (включая Claude Code, Cursor, Aider и решения под эгидой Agentic AI Foundation) радикально изменило природу исполнителя требований.3

ИИ-агент не обладает человеческой интуицией, контекстуальным жизненным опытом или способностью неформально трактовать недосказанности в тексте.6 Он функционирует в рамках строго определенных математических ограничений: вероятностного распределения токенов, ограничений контекстного окна, механизмов внимания и непосредственного цикла обратной связи с исполняемой средой.2 Прямая передача классического человекоориентированного документа SRS в контекст ИИ-агента приводит к неоптимальному расходу вычислительных ресурсов, галлюцинациям, потере фокуса и неконтролируемому усложнению кодовой базы.6

В результате возникает необходимость проектирования гибридного класса спецификаций.7 Этот подход объединяет системную строгость традиционной инженерии требований с операционными принципами работы ИИ-агентов, трансформируя статическое описание системы в «живой», компиляционно проверяемый поведенческий контракт.1

## **Операционные характеристики и ограничения ИИ-агентов**

Эффективность работы ИИ-агентов в рамках проекта жестко лимитирована понятием «бюджета инструкций».9 Несмотря на то, что современные LLM обладают расширенными контекстными окнами (достигающими сотен тысяч токенов), фактическая глубина удержания внимания и точность извлечения информации деградируют по мере роста объема загружаемых файлов.8 Этот феномен накладывает жесткие ограничения на архитектуру управляющих файлов в репозитории.9

### **Контекстный бюджет и прогрессивное раскрытие**

Если корневой конфигурационный файл репозитория перегружен избыточными правилами форматирования, которые могут быть автоматически проверены линтером, или детальным описанием структуры файлов, которые агент способен самостоятельно просканировать через дисковые утилиты, полезный объем контекста для решения текущей инженерной задачи резко снижается.9

Пусть ![][image1] — полный объем контекстного окна ИИ-агента. Эффективный бюджет токенов для непосредственной генерации и анализа кода ![][image2] может быть выражен следующим уравнением:

![][image3]  
Где:

* ![][image4] — базовый системный промпт ИИ-инструмента.9  
* ![][image5] — накопленная история диалога текущей сессии разработки.8  
* ![][image6] — постоянный слой инструкций, считываемый из файлов конфигурации типа CLAUDE.md или AGENTS.md при инициализации.4  
* ![][image7] — переменный контекст, потребляемый кодовыми файлами, логами ошибок и внешними документами, загружаемыми агентом в процессе выполнения задачи.8

Для максимизации переменного пространства решений ![][image2] применяется принцип *прогрессивного раскрытия информации* (progressive disclosure).9 Согласно этой парадигме, корневой управляющий документ содержит исключительно декларативные метаданные, общую архитектурную концепцию и карту команд запуска.5 Специфические же правила предметной области, соглашения о типах данных или детальные сценарии тестирования выносятся во внешние изолированные файлы (например, .claude/rules/, .claude/skills/ или специализированные разделы папки docs/) и подключаются динамически с помощью триггеров или явных относительных импортов в формате @path/to/file.md только в момент входа агента в соответствующую директорию.9

### **Режимы работы, уровни разрешений и поведенческие антипаттерны**

ИИ-агенты требуют четкого разграничения уровней доступа к операционной системе хоста и строгого соблюдения фаз проектирования.3 Выделяются четыре базовых уровня авторизации инструментов, определяющие баланс между безопасностью и скоростью автономной разработки:

| Уровень авторизации | Разрешенные системные инструменты | Типичные сценарии использования | Операционный риск |
| :---- | :---- | :---- | :---- |
| **Permissive** (Свободный) 3 | Запись, изменение файлов, свободный запуск любых Bash-команд.3 | Локальное прототипирование, первичное развертывание среды.3 | Высокий: риск неконтролируемого деструктивного воздействия на ОС.3 |
| **Standard** (Стандартный) 3 | Изменение файлов, запуск безопасных утилит (git, npm, pnpm, pytest).3 | Ежедневная инкрементальная разработка и отладка функций.3 | Низкий: действия ограничены песочницей проекта.3 |
| **Restricted** (Ограниченный) 3 | Чтение файлов, поиск по кодовой базе (grep, glob).3 | Код-ревью, аудит безопасности, первичный статический анализ.3 | Минимальный.3 |
| **Read-only** (Только чтение) 3 | Исключительно чтение содержимого файлов.3 | Ознакомление со структурой репозитория, планирование задач.3 | Нулевой.3 |

Критически важным является использование **режима планирования** (Plan Mode) на начальном этапе работы с задачей.3 В этом режиме агент блокируется в рамках уровня Read-only, что принуждает его проводить детальный анализ существующей кодовой базы, выявлять архитектурные противоречия и согласовывать с разработчиком пошаговый план до внесения физических изменений в файлы.3

Нарушение этого регламента ведет к возникновению опасных антипаттернов 3:

* *Туннелирование промптов (Prompt tunneling)* — отправка последовательности команд без верификации промежуточных результатов выполнения тестов.3  
* *Призрачный контекст (Ghost context)* — ложное предположение агента о том, что он помнит детали прошлых сессий в условиях отсутствия постоянного файла памяти (CLAUDE.md / AGENTS.md).3  
* *Мега-промпты (Mega-prompts)* — попытка упаковать реализацию нескольких несвязанных функций в одну массивную инструкцию, что гарантированно приводит к снижению качества генерации.3

## **Компиляционная трассируемость и сквозная верификация**

Классический подход к формированию матриц трассируемости требований (Requirements Traceability Matrix, RTM) в регулируемых отраслях (например, в рамках стандартов FDA 21 CFR 820.30 или IEC 62304 для медицинского ПО) страдает от структурной хрупкости.1 Трассировочные связи, зафиксированные во внешних ALM-системах (Jira, Polarion, DOORS), неизбежно устаревают и разрушаются в процессе быстрой итеративной разработки.1 Исследования показывают, что затраты на ручную поддержку комплаенса и аудит документации могут поглощать от 12% до 18% совокупной выручки технологических компаний, а общие бюджеты проектов при нарушении трассируемости возрастают в среднем на 30%.2

Для решения этой проблемы ИИ-ориентированное проектирование опирается на концепцию **компиляционной трассируемости (ReqToCode)**.1 Требования трансформируются из пассивного текста в строго типизированные языковые конструкции — компиляционные маркеры (Traceables), внедряемые непосредственно в сигнатуры функций, типы данных и тестовые сценарии.1 Это делает трассируемость внутренним свойством компиляции программной системы.1 Если ИИ-агент или человек-разработчик удаляет или модифицирует функцию, нарушая связь с исходным требованием, компилятор мгновенно генерирует ошибку сборки, предотвращая бесшумную деградацию связей.1

Для оценки плотности и устойчивости архитектурных связей в условиях постоянных изменений вводится коэффициент влияния изменений требований (Change Impact Index, ![][image8]):

![][image9]  
Где:

* ![][image10] — целевой компиляционный маркер требования, подвергающегося модификации.1  
* ![][image11] — количество непосредственных вызовов, импортов или деклараций типов, связанных с данным маркером в кодовой базе.1  
* ![][image12] — число транзитивных зависимостей второго и последующих порядков, затронутых по цепочке вызовов.  
* ![][image13] — общее количество активных программных модулей (классов, сервисов, контроллеров) в системе.

Используя векторные семантические эмбеддинги, ИИ-агенты способны в режиме реального времени проводить автоматический анализ влияния изменений (Change Impact Analysis), мгновенно выстраивая граф зависимостей и локализуя зоны риска при изменении любого пункта спецификации.2

# ---

**Спецификация требований (specification.md): Транзакционный модуль биллинга**

## **1\. Метаданные спецификации и системный контекст**

| Параметр метаданных | Значение / Системный идентификатор |
| :---- | :---- |
| **Идентификатор спецификации** | SPEC-BILLING-LEDGER-101 |
| **Версия документа** | 1.0.4 (Семантическое версионирование требований) |
| **Текущий статус** | APPROVED (Утверждено к реализации) |
| **Архитектурный контекст (ADR)** | @docs/architecture/adr-012-double-entry.md 13 |
| **Ограничение прав агента** | Standard Mode (Разрешен запуск pnpm, pytest, git) 3 |
| **Целевой стек и окружение** | Node.js v20+, PostgreSQL v16, TypeScript v5 16 |

## ---

**2\. Бизнес-цели верхнего уровня (High-Level Objectives)**

Разработка и интеграция изолированного программного модуля транзакционного учета на основе принципа двойной записи для обеспечения гарантированной финансовой целостности балансов пользователей, исключающей возникновение рассогласований на уровне базы данных.10 Модуль должен выполнять атомарный трансфер средств между счетами внутри единой СУБД с нулевой погрешностью округления.10

## ---

**3\. Функциональные цели среднего уровня (Mid-Level Objectives)**

* **ML-OBJ-101 (Реляционная целостность двойной записи)**: Спроектировать схему данных PostgreSQL, в которой каждая транзакция состоит как минимум из одной дебетовой и одной кредитовой записи, причем сумма всех дебетовых и кредитовых операций внутри транзакции всегда математически равна нулю 10:  
  ![][image14]  
* **ML-OBJ-102 (Атомарность операций через API)**: Реализовать программный интерфейс (REST API) на базе FastAPI для инициализации транзакций, гарантирующий изоляцию уровня SERIALIZABLE при списании и зачислении средств.10  
* **ML-OBJ-103 (Непрерывный комплаенс-аудит)**: Разработать фоновый агент безопасности, выполняющий циклическую верификацию балансов системы и генерирующий критические алерты в случае выявления любых ненулевых остатков по техническим счетам.10  
* **ML-OBJ-104 (Регуляторный аудит)**: Обеспечить ведение немодифицируемого журнала транзакций (audit trail) в соответствии с требованиями стандартов PCI-DSS и GDPR с маскированием персональных данных держателей карт.10

## ---

**4\. Нефункциональные требования и системные ограничения (NFR)**

### **4.1 Производительность и масштабируемость (NFR-PERF)**

* **NFR-PERF-001 (Задержка записи)**: При пиковой нагрузке до 500 параллельных транзакций в секунду время отклика API (RTT) должно удовлетворять ограничению 10:  
  ![][image15]  
* **NFR-PERF-002 (Использование оперативной памяти)**: Потребление памяти процессом API-сервера под максимальной нагрузкой не должно превышать фиксированный лимит 10:  
  ![][image16]

### **4.2 Безопасность и целостность данных (NFR-SEC)**

* **NFR-SEC-001 (Шифрование конфиденциальных данных)**: Все идентификаторы платежных карт и балансы пользователей должны шифроваться на уровне строк базы данных с использованием алгоритма AES-256-GCM.10  
* **NFR-SEC-002 (Защита от переполнения)**: Использование типов с плавающей запятой (float, double) для финансовых вычислений строго запрещено.10 Все расчеты должны выполняться исключительно с применением произвольной точности типа Decimal (масштаб 18 знаков, 4 знака после запятой).10

## ---

**5\. Архитектурные спецификации и технический дизайн**

### **5.1 Реляционная модель данных (PostgreSQL)**

Таблицы базы данных должны создаваться в строгом соответствии со следующей схемой типов:

| Имя таблицы | Имя поля | Физический тип данных | Nullable | Индексы, ограничения и связи |
| :---- | :---- | :---- | :---- | :---- |
| **billing\_accounts** | id | UUIDv4 | No | PRIMARY KEY 17 |
| **billing\_accounts** | user\_id | VARCHAR(64) | No | UNIQUE, INDEX |
| **billing\_accounts** | balance | NUMERIC(18, 4\) | No | CHECK (balance \>= 0.0000) (Запрет овердрафта) |
| **ledger\_entries** | id | UUIDv4 | No | PRIMARY KEY |
| **ledger\_entries** | transaction\_id | UUIDv4 | No | INDEX, FOREIGN KEY \-\> billing\_transactions(id) |
| **ledger\_entries** | account\_id | UUIDv4 | No | FOREIGN KEY \-\> billing\_accounts(id) |
| **ledger\_entries** | amount | NUMERIC(18, 4\) | No | CHECK (amount \<\> 0.0000) (Дебет (+), Кредит (-)) |

### **5.2 Обработка исключений и граничные случаи (Edge Cases)**

Агент обязан реализовать обработку следующих нештатных ситуаций:

* **Исключение ERR\_INSUFFICIENT\_FUNDS (Недостаточно средств)**:  
  * *Условие возникновения*: Попытка проведения транзакции, приводящая к отрицательному значению баланса на счете списания.17  
  * *Поведение системы*: Немедленный откат всей транзакции базы данных (Rollback). Логирование инцидента безопасности с указанием user\_id.10  
  * *HTTP-ответ*: Status Code 422 Unprocessable Entity 10:  
    JSON  
    {  
      "error\_code": "ERR\_INSUFFICIENT\_FUNDS",  
      "timestamp": "2026-05-17T10:50:00Z",  
      "details": "Запрашиваемая сумма списания превышает доступный баланс счета."  
    }

* **Исключение ERR\_LOCK\_TIMEOUT (Блокировка строки)**:  
  * *Условие возникновения*: Невозможность захватить блокировку строки счета (Row Lock) в течение 1500 мс из\-за конкурирующих транзакций.  
  * *Поведение системы*: Автоматический повтор транзакции (Retry) до 3 раз с экспоненциальной задержкой. При отказе — откат и освобождение пула соединений.  
  * *HTTP-ответ*: Status Code 503 Service Unavailable.

### **5.3 Матрица авторизации доступа к операциям**

| Системный эндпоинт (Route) | Роль: Root Admin | Роль: Compliance Auditor | Внешний ИИ-агент (API-Key) |
| :---- | :---- | :---- | :---- |
| **POST /v1/transactions** | Разрешено | Запрещено | Разрешено (только свои счета) 17 |
| **GET /v1/audit/ledger** | Разрешено | Разрешено | Запрещено 17 |
| **DELETE /v1/transactions** | Запрещено (WORM) | Запрещено | Запрещено |

## ---

**6\. Слои системного контекста**

### **6.1 Исходное состояние среды (Beginning Context)**

Перед стартом работ ИИ-агент должен обнаружить в рабочей директории следующие файлы и ресурсы 10:

* Конфигурационный файл TypeScript: tsconfig.json (с флагами strict: true и strictNullChecks: true).  
* Файл описания окружения: .env.example с переменными для подключения к PostgreSQL.  
* Корневой файл конвенций проекта: CLAUDE.md.3

### **6.2 Ожидаемое состояние среды по завершении (Ending Context)**

После завершения итерации в репозитории должны быть созданы следующие артефакты 10:

* src/db/migrations/001\_init\_billing.sql — идемпотентный скрипт инициализации схемы данных.  
* src/services/billing\_ledger.service.ts — ядро бизнес-логики учета балансов.10  
* src/api/routes/billing.routes.ts — маршруты FastAPI с валидацией Pydantic.  
* tests/integration/concurrency\_ledger.test.ts — интеграционные тесты конкурентного доступа.16  
* Все задействованные тесты должны успешно выполняться со статусом exit 0\.16

## ---

**7\. Схема сквозной трассируемости (Traceability Matrix)**

Для визуализации декомпозиции требований от целей верхнего уровня до конкретных тестовых сценариев и кодовых файлов используется следующая архитектурная схема зависимостей 14:

Фрагмент кода

flowchart TD  
    %% Слой требований верхнего уровня (High-Level)  
    HL\_1 \--\> ML\_101  
    HL\_1 \--\> ML\_102  
      
    %% Слой нефункциональных требований (NFR)  
    NFR\_SEC \-.-\> ML\_101  
    NFR\_PERF \-.-\> ML\_102  
      
    %% Слой низкоуровневых задач реализации (Low-Level Tasks)  
    ML\_101 \--\> LL\_201  
    ML\_101 \--\> LL\_202  
    ML\_102 \--\> LL\_203  
    ML\_102 \--\> LL\_204  
      
    %% Слой физического кода (Implementation Files)  
    LL\_201 \--\> CODE\_SQL\[File: 001\_init\_billing.sql\]  
    LL\_202 \--\> CODE\_SRV\[File: billing\_ledger.service.ts\]  
    LL\_203 \--\> CODE\_API\[File: billing.routes.ts\]  
      
    %% Слой верификации и тестирования (Verification & Testing)  
    CODE\_SQL \-.-\> TEST\_UNIT  
    CODE\_SRV \-.-\> TEST\_INTEG  
    CODE\_API \-.-\> TEST\_INTEG  
    LL\_204 \-.-\> TEST\_STRESS  
      
    %% Обратная связь трассировки для замыкания верификации  
    TEST\_UNIT \-.-\> |Верифицирует| ML\_101  
    TEST\_INTEG \-.-\> |Верифицирует| HL\_1  
    TEST\_STRESS \-.-\> |Верифицирует| NFR\_PERF  
      
    classDef hl fill:\#1a365d,stroke:\#fff,stroke-width:2px,color:\#fff;  
    classDef ml fill:\#2b6cb0,stroke:\#fff,stroke-width:1.5px,color:\#fff;  
    classDef nfr fill:\#dd6b20,stroke:\#fff,stroke-width:1.5px,color:\#fff;  
    classDef ll fill:\#2f855a,stroke:\#fff,stroke-width:1.2px,color:\#fff;  
    classDef code fill:\#4a5568,stroke:\#fff,stroke-width:1px,color:\#fff;  
    classDef test fill:\#805ad5,stroke:\#fff,stroke-width:1.2px,color:\#fff;  
      
    class HL\_1 hl;  
    class ML\_101,ML\_102 ml;  
    class NFR\_SEC,NFR\_PERF nfr;  
    class LL\_201,LL\_202,LL\_203,LL\_204 ll;  
    class CODE\_SQL,CODE\_SRV,CODE\_API code;  
    class TEST\_UNIT,TEST\_INTEG,TEST\_STRESS test;

Каждое требование в процессе разработки должно иметь явное отражение в таблице трассируемости:

| Идентификатор требования | Файл реализации (Implementation path) | Класс / Функция в коде | Код верификационного теста | Статус проверки |
| :---- | :---- | :---- | :---- | :---- |
| **ML-OBJ-101** | src/db/migrations/001\_init\_billing.sql | Схема БД billing\_accounts | tests/unit/schema.test.ts | \[ \] |
| **ML-OBJ-102** | src/services/billing\_ledger.service.ts | BillingLedgerService.transfer | tests/integration/ledger.test.ts | \[ \] |
| **NFR-PERF-001** | src/services/billing\_ledger.service.ts | Конкурентные транзакции | tests/integration/concurrency.test.ts | \[ \] |
| **NFR-SEC-002** | src/services/billing\_ledger.service.ts | Вычисления класса Decimal | tests/unit/decimal\_precision.test.ts | \[ \] |

## ---

**8\. Исполняемые низкоуровневые задачи (Low-Level Tasks)**

ИИ-агент обязан выполнять представленные задачи последовательно, проводя верификацию каждого шага перед переходом к следующему.6

### **LL-TSK-201: Развертывание реляционной схемы данных PostgreSQL**

* **Связь с требованием**: ML-OBJ-101, NFR-SEC-002 10  
* **Промпт для ИИ-агента**:  
  Bash  
  "Проанализируй схему данных PostgreSQL в разделе 5.1 спецификации requirements.md. Создай файл миграции src/db/migrations/001\_init\_billing.sql. Опиши таблицы billing\_accounts и ledger\_entries. Наложи строгие внешние ключи, уникальные составные индексы и проверки CHECK на баланс и суммы списания. Убедись, что для сумм используется тип NUMERIC(18, 4), исключающий ошибки округления. Запусти локальный контейнер PostgreSQL через docker-cli и примени миграцию для проверки."

* **Создаваемый файл**: src/db/migrations/001\_init\_billing.sql 10  
* **Критерии приемки (Definition of Done)**: Идемпотентный запуск SQL-скрипта без ошибок синтаксиса. Схема данных успешно развернута на локальной СУБД.10

### **LL-TSK-202: Реализация транзакционного сервиса billing\_ledger.service.ts**

* **Связь с требованием**: ML-OBJ-102, NFR-SEC-002 10  
* **Промпт для ИИ-агента**:  
  Bash  
  "Создай сервис BillingLedgerService в файле src/services/billing\_ledger.service.ts. Реализуй метод transfer(fromUserId: string, toUserId: string, amount: string): Promise\<string\>. Метод должен выполняться внутри транзакции базы данных с уровнем изоляции SERIALIZABLE. Для всех арифметических операций импортируй и используй библиотеку decimal.js. При нехватке средств выбрасывай кастомное исключение InsufficientFundsError с кодом ERR\_INSUFFICIENT\_FUNDS. Не изменяй другие файлы проекта." \[6, 10\]

* **Создаваемый файл**: src/services/billing\_ledger.service.ts 10  
* **Критерии приемки (Definition of Done)**: Создан класс сервиса. Код успешно проходит проверку типов tsc. Написаны unit-тесты, покрывающие успешный перевод и сценарии нехватки средств на балансе.10

### **LL-TSK-203: Интеграция API маршрутизации на базе FastAPI**

* **Связь с требованием**: ML-OBJ-102, NFR-PERF-001 10  
* **Промпт для ИИ-агента**:  
  Bash  
  "Разработай эндпоинты REST API в файле src/api/routes/billing.routes.ts. Реализуй POST /v1/transactions для вызова BillingLedgerService.transfer. Настрой Pydantic-схемы для строгой валидации входящих UUID-идентификаторов и строкового формата суммы. Реализуй кастомный обработчик исключений (exception handler) для перехвата InsufficientFundsError, возвращающий структурированный JSON-ответ со статусом 422 в соответствии с разделом 5.2 спецификации." 

* **Создаваемый файл**: src/api/routes/billing.routes.ts 10  
* **Критерии приемки (Definition of Done)**: API-маршруты зарегистрированы в основном приложении. Локальный запуск сервера разработки проходит без ошибок.

### **LL-TSK-204: Написание нагрузочного интеграционного теста конкурентности**

* **Связь с требованием**: ML-OBJ-104, NFR-PERF-001 10  
* **Промпт для ИИ-агента**:  
  Bash  
  "Создай интеграционный тест concurrency\_ledger.test.ts в папке tests/integration. Засели в тестовую базу аккаунт пользователя с начальным балансом 1000.00 Decimal. Сделай 50 одновременных запросов на перевод по 25.00 Decimal каждый, используя Promise.all. Проверь, что ровно 40 транзакций завершились успешно, а оставшиеся 10 отклонены с ошибкой ERR\_INSUFFICIENT\_FUNDS. Убедись, что итоговый баланс счета списания равен ровно 0.0000 Decimal и в системе не возникло взаимоблокировок." \[6\]

* **Создаваемый файл**: tests/integration/concurrency\_ledger.test.ts 10  
* **Критерии приемки (Definition of Done)**: Тест успешно выполняется локально с помощью тест-раннера (pnpm test) при нулевом количестве сбоев.16

## ---

**9\. Протокол исполнения спецификации для ИИ-агента (Runtime Protocol)**

Данный регламент обязателен для разбора и принятия ИИ-агентом перед началом сессии 11:

YAML

agent\_runtime\_instructions:  
  initialization:  
    \- action: "Инициализация сессии"  
      steps:  
        \- "Прочитать файл CLAUDE.md для извлечения проектных конвенций и стилей." \[3, 11\]  
        \- "Запустить команду /init (или проанализировать репозиторий) для детекции тестовых фреймворков." \[13\]  
        \- "Перейти в режим планирования (Plan Mode) через Shift+Tab до начала генерации кода." \[3, 7\]  
    \- action: "Анализ влияния изменений (Change Impact Analysis)" \[2\]  
      steps:  
        \- "Выполнить парсинг разделов 5.1 и 5.2 в specification.md."  
        \- "Оценить потенциальные конфликты с существующими файлами проекта."  
        \- "Сформулировать список архитектурных допущений и согласовать его с разработчиком." \[6, 7\]

  execution\_constraints:  
    \- rule: "Хирургическое редактирование"  
      detail: "Изменять строго те строки кода, которые необходимы для выполнения конкретной задачи LL-TSK. Никогда не проводить косметический рефакторинг соседних методов или файлов." \[6\]  
    \- rule: "Принцип лаконичности (Simplicity)"  
      detail: "Писать минимально достаточный код без спекулятивных абстракций. Если задача может быть решена 50 строками вместо 200, переписать код заново." \[6\]  
    \- rule: "Импорт контекста"  
      detail: "Использовать относительные ссылки вида @src/db/connection.ts вместо жестко зашитых путей в промптах." \[13\]

  verification\_and\_delivery:  
    \- loop\_verification:  
        \- step\_1: "Запуск статического компилятора (tsc / npm run typecheck)." \[3\]  
        \- step\_2: "Запуск локального тест-раннера для созданного модуля." \[3\]  
        \- step\_3: "В случае падения тестов прочитать лог ошибки через cat error.log | claude, исправить код и повторить цикл." \[13\]  
    \- compliance\_signoff:  
        \- step: "Обновить таблицу трассируемости требований в specification.md, установив отметку \[X\] в соответствующей строке." \[1, 10\]  
        \- step: "Сгенерировать сообщение для Git-коммита и детальное PR-описание с перечнем затронутых требований SPEC-BILLING." \[3, 13\]

## ---

**Инструкция по использованию спецификации ИИ-агентом**

Для обеспечения максимальной продуктивности ИИ-агента (например, Claude Code) и предотвращения распространенных ошибок генерации, процесс взаимодействия со спецификацией должен быть строго регламентирован в рамках жизненного цикла разработки.3 Ниже представлены практические рекомендации для разработчиков по организации рабочей сессии.18

### **Организация структуры папок и управляющих файлов**

Для того чтобы ИИ-агент не перегружал свой контекст, в репозитории должна быть выстроена иерархическая структура конфигурационных файлов.9

Bash

project-root/  
├── CLAUDE.md               \# Корневой файл контекста: глобальные команды сборки, тестов, стили   
├── AGENTS.md               \# Общеагентские стандарты разработки (AAIF) \[4, 5\]  
├── docs/  
│   ├── architecture/  
│   │   └── adr-012-db.md   \# Исторические архитектурные решения \[15\]  
│   └── specifications/  
│       └── billing.md      \# Данная спецификация требований \[7, 8\]  
└──.claude/  
    └── rules/  
        ├── typescript.md   \# Правила написания TS-кода (загружаются только при работе с \*.ts)   
        └── db-postgres.md  \# Специфические правила работы с СУБД 

При такой структуре корневой файл CLAUDE.md остается компактным (строго менее 200 строк).12 В нем описываются только базовые команды запуска среды разработки, которые ИИ-кодер не может угадать самостоятельно 12:

# **Команды сборки и запуска проекта**

* Установка зависимостей: pnpm install 16  
* Сборка: pnpm run build  
* Проверка типов: pnpm run typecheck 3  
* Запуск тестов: pnpm test (для запуска конкретного теста: pnpm test tests/unit/file.test.ts) 3

# **Архитектурные правила**

* Все финансовые вычисления: использовать @docs/specifications/billing.md 9  
* Правила TypeScript: загружаются автоматически из @.claude/rules/typescript.md 9

### **Сценарий пошаговой работы с агентом в терминале**

При возникновении необходимости реализовать транзакционный модуль, разработчик запускает сессию ИИ-агента и передает управление по следующему алгоритму 3:

#### **Шаг 1: Инициализация и переход в режим планирования**

Разработчик запускает Claude Code в терминале и принудительно указывает контекст спецификации 13:

Bash

claude "Прочитай спецификацию @docs/specifications/billing.md. Перейди в режим планирования (Plan Mode) и подготовь список необходимых изменений." \[3, 7, 13\]

Агент переходит в режим чтения, сканирует существующий репозиторий, сопоставляет его со спецификацией и выдает пошаговый план реализации задач LL-TSK-201 – LL-TSK-204.3 На этом этапе агент обязан задать уточняющие вопросы, если обнаружит неконсистентность окружения.6

#### **Шаг 2: Инкрементальное выполнение задач**

После утверждения плана разработчик переводит агента в режим выполнения (Standard/Permissive) и дает команду на реализацию первой изолированной задачи 3:

Bash

claude "Выполни задачу LL-TSK-201 из @docs/specifications/billing.md. Напиши файл миграции и протестируй его в локальной СУБД." \[10, 13\]

Агент выполняет задачу, создает файл 001\_init\_billing.sql, запускает проверку схемы и отчитывается о результате.10

#### **Шаг 3: Верификация и замыкание цикла обратной связи**

Для каждой выполненной задачи агент должен самостоятельно запустить соответствующий верификационный тест.6 Разработчик контролирует этот процесс 8:

Bash

claude "Запусти тесты для реализованного транзакционного сервиса. Если тесты упадут, проведи хирургическое исправление кода и повтори запуск." 

Агент запускает pnpm test tests/integration/concurrency\_ledger.test.ts.16 В случае обнаружения ошибок компиляции или падения утверждений (assertions), агент считывает логи ошибок, локализует неисправность, исправляет её и добивается полностью зеленого статуса выполнения тестов.3

#### **Шаг 4: Обновление трассируемости и фиксация изменений**

После того как верификационный тест успешно пройден, агент обновляет состояние спецификации 1:

Bash

claude "Отметь выполненную задачу в таблице трассировки требований в @docs/specifications/billing.md. Сделай git-commit с сообщением о реализации ML-OBJ-101 и подготовь описание пулл-реквеста." 

Агент проставляет символ \[X\] напротив выполненного пункта в markdown-таблице требований, формирует лаконичный и профессиональный коммит-месседж и готовит проект к ревью человеком-разработчиком.1

Этот итеративный подход гарантирует, что спецификация требований остается актуальным, точным и постоянно проверяемым источником истины, значительно снижая затраты на разработку и гарантируя соответствие итогового кода задекларированным бизнес-целям.1

#### **Источники**

1. ReqToCode: Embedding Requirements Traceability as a Structural Property of the Codebase \- arXiv, дата последнего обращения: мая 17, 2026, [https://arxiv.org/html/2603.13999](https://arxiv.org/html/2603.13999)  
2. (PDF) From Bottleneck to Benchmark: Using AI to Automate the Requirements Traceability Matrix (RTM) for FDA Submissions \- ResearchGate, дата последнего обращения: мая 17, 2026, [https://www.researchgate.net/publication/399918015\_From\_Bottleneck\_to\_Benchmark\_Using\_AI\_to\_Automate\_the\_Requirements\_Traceability\_Matrix\_RTM\_for\_FDA\_Submissions](https://www.researchgate.net/publication/399918015_From_Bottleneck_to_Benchmark_Using_AI_to_Automate_the_Requirements_Traceability_Matrix_RTM_for_FDA_Submissions)  
3. Claude Code \- Best Practices | SFEIR Institute, дата последнего обращения: мая 17, 2026, [https://institute.sfeir.com/en/claude-code/claude-code-resources/best-practices/](https://institute.sfeir.com/en/claude-code/claude-code-resources/best-practices/)  
4. How to Build Your AGENTS.md (2026): The Context File That Makes AI Coding Agents Actually Work, дата последнего обращения: мая 17, 2026, [https://www.augmentcode.com/guides/how-to-build-agents-md](https://www.augmentcode.com/guides/how-to-build-agents-md)  
5. AGENTS.md, дата последнего обращения: мая 17, 2026, [https://agents.md/](https://agents.md/)  
6. Best Claude.md files for claude code, дата последнего обращения: мая 17, 2026, [https://www.reddit.com/r/ClaudeAI/comments/1t89g1j/best\_claudemd\_files\_for\_claude\_code/](https://www.reddit.com/r/ClaudeAI/comments/1t89g1j/best_claudemd_files_for_claude_code/)  
7. How to write a good spec for AI agents \- Addy Osmani, дата последнего обращения: мая 17, 2026, [https://addyosmani.com/blog/good-spec/](https://addyosmani.com/blog/good-spec/)  
8. Using spec-driven development with Claude Code | by Heeki Park \- Medium, дата последнего обращения: мая 17, 2026, [https://heeki.medium.com/using-spec-driven-development-with-claude-code-4a1ebe5d9f29](https://heeki.medium.com/using-spec-driven-development-with-claude-code-4a1ebe5d9f29)  
9. A Complete Guide To AGENTS.md \- AI Hero, дата последнего обращения: мая 17, 2026, [https://www.aihero.dev/a-complete-guide-to-agents-md](https://www.aihero.dev/a-complete-guide-to-agents-md)  
10. specification-TEMPLATE-example.md  
11. The Complete Guide to CLAUDE.md: Memory, Rules, Loading, and Cross-Tool Compression, дата последнего обращения: мая 17, 2026, [https://medium.com/@bijit211987/the-complete-guide-to-claude-md-memory-rules-loading-and-cross-tool-compression-97cc12ed037b](https://medium.com/@bijit211987/the-complete-guide-to-claude-md-memory-rules-loading-and-cross-tool-compression-97cc12ed037b)  
12. How to Write a CLAUDE.md File That Actually Works: Best Practices for API Projects, дата последнего обращения: мая 17, 2026, [https://www.turbodocx.com/blog/how-to-write-claude-md-best-practices](https://www.turbodocx.com/blog/how-to-write-claude-md-best-practices)  
13. Best practices for Claude Code \- Claude Code Docs, дата последнего обращения: мая 17, 2026, [https://code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices)  
14. Visualizing Requirements and Traceability Matrix with Mermaid Diagrams | by OpenRose, дата последнего обращения: мая 17, 2026, [https://medium.com/@openrose/visualizing-requirements-and-traceability-matrix-with-mermaid-diagrams-fc27c5339f77](https://medium.com/@openrose/visualizing-requirements-and-traceability-matrix-with-mermaid-diagrams-fc27c5339f77)  
15. Organizing Specifications with Claude Code \- Blog of Jérémie Litzler, дата последнего обращения: мая 17, 2026, [https://iamjeremie.me/post/2026-03/organizing-specifications-with-claude-code/](https://iamjeremie.me/post/2026-03/organizing-specifications-with-claude-code/)  
16. AGENTS.md — a simple, open format for guiding coding agents \- GitHub, дата последнего обращения: мая 17, 2026, [https://github.com/agentsmd/agents.md](https://github.com/agentsmd/agents.md)  
17. How to Write a Software Spec: A Practical Guide for Builders | MindStudio, дата последнего обращения: мая 17, 2026, [https://www.mindstudio.ai/blog/how-to-write-a-software-spec](https://www.mindstudio.ai/blog/how-to-write-a-software-spec)  
18. The Complete Claude Setup Checklist: 72 Steps From Default to Power User, дата последнего обращения: мая 17, 2026, [https://medium.com/nginity/the-complete-claude-setup-checklist-72-steps-from-default-to-power-user-082d8bf0d390](https://medium.com/nginity/the-complete-claude-setup-checklist-72-steps-from-default-to-power-user-082d8bf0d390)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAYCAYAAACIhL/AAAABs0lEQVR4Xu2VzStEYRSHj4+UhLBhgYkFQllJIiFrCwtlY0fEwsJGPsofYIUiwoKsEJZsyM7CzoYFZe+jiIjfcc7kzpl7xwxmzOI+9XTPe957m9+88953iHx8koNO+B6DDfJY4tgm+eBxWAsr4KX2+mAAVsF57eV9PpVAnmG56QVXy7JhG4lg3TbIO+CebcSbZtsAOSThbu0EOLeN/2CGJOCInUgWzkgC1tmJZKCLJNyWnYgzrxTlCTFLcuOwnXDQYRsRGLAND3LhMUURMPj2ptgJB3xeRsuBbURgiWII6AX/63gFzDLjALkHTIeFtgkW6ZuAvGqRApbAHpK3nA/2TO2Pwmqtp2C71nzPiV7ztbcCe7W+hvtaM54BeYM+wnt4Bx/gC3wjOROdtFDoCo5R+BficavWbivIFMFdCn3WM2AscMAJx3iV3AMOaX3onADZ8ArukOy5Pw/YBKdhPZyDjRQe8IJknzFHej3Vq/PeSR2v6XgZFnxN/wx+EfinGYT92luAlVq3wW6tmRuSI2RTx08wVWvegxyQt0EGyarW6NyvSLMNkg8oI/fjqdiMS0necB+fD5R9YZG0Ma9sAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAABd0lEQVR4Xu2VyysFYRjGH3ItZSMpm+NSUrK0YqmsFDsLYUHKgrKRDVuytbFSytrGwpKyJsofQBE7lFtuz9v7jfOdtzPMxJwpza9+zTfP934z75kzFyAjIxmG6EcMO3RZsuxAT7ZIu6AnvXDZKM3RTrrpskpZlDRPtNVkwVWx7NogKbZsgPCmDmyQBH02IA3Qhq5NXk7PTVYy1qFNTduJNDlDCZ+yKIxAG9q2E2myAW1q0k6kSdhTlypRmqq1QQSabOBotoGlDN83VUWPaQ0dRL6uhV7SHugxruism5P6QzeWNWNuPEOnoK+ZF1rh8i9e6QO9o7f0Hlr4Rqu9un1oI/POU2gTATJ34u0H2Qrya+Q80kzYD4+NvDjlYAOePkf00WRSL9/PoL6frrr8TxhH+MEaaRsdpmteLvVz3v4S9IvxjMKrnPPGsdmj7W484bb1KPzb3qHvO0Hqb7y5Bbddhv6dQi/03voVdShyY/5AN4qvkYck4//wCZN5WSrA+iGpAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAYCAYAAABa1LWYAAACKUlEQVR4Xu2WT0hUURTGT0lYBmW2SLGiEJO0TRSUixSCoEXQon9IGwnaKNQiQoQgoiCiTYtcN4gVbZIigiCCapfgQhdtg9q00iIl7O/3cc5lzhxnpCaH5sF88OOd+5377ntn7rx7r0hNNdVUCZ0Av/6C1XpbdeuJ6MsOgV2gA8yadwRsB13gsXmZ0DzYGrw0K1HT0ahW3YmGlC7qXTSqUT3RgLaJFvQ2+M3gQ/Ayo1HRok7GRJb1XrSoTTGRVZ0VLWgkJrKsu6JFce+qpDZHo5Iqteotp9aCPdGspP6kqFa7rilwS2ujXVeAleCWFC+K/dZFU/S+slUnSxd1DoxbzL59YDd4AK6CRtETyUtwADwE561/G2ixK7/XoxZTO8Eni1kADwMUx+K7TIr+GBvAG9BpeeYOWrxI38Ec+Cw6+BewAH76TtAl0YF4XBoIuW+i+1i/856L9s+BU86/JoUzxefzWHbB4FhJvP90aPuYa8A/ibNzWfKzyTNiEtvD4JXzmsCY5Ug6CLOovamT5biNHHb4nF+0friYuXuuXZamwD7XnnDxDdGHHHPejBSe6G/a9QrotviQ5Df7JL8/0j/u2pzVJObuu3ZZ4mH2kWvfdnG76ENWOY/tixY3SP7lesGgxTxIc4H4COrNy9mV3xfH4Lec5Itn/My1y1Ja9fgixVakF6HNhYHaUuCquMqtDx6/yR3B+y/6Kvq3fAr2h1xmdR28BmdioqZl1G+RIntG5wO8ZAAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAYCAYAAABa1LWYAAACQ0lEQVR4Xu2Wy0tVURTGv55U9ECLCgvpMQhMmthEhIKigRg4yUCjWUUhNQuLBBN0loPwAU4Kgv6BCEKdBDUwmoQNmkVZg2rUe9D7+1jr0Hbp1bx04R64P/hx91nruD3rnP0CKlSoUAra6O9FuMr+rLy5C3vYLlpP99D3HjtKd9K99I7HcsFXWhti2VeJPI2BcuVmDKBwUS9ioBw5EANkB6ygZyG+lb4OsdxwC1bU8ZjIM69gRW2JibxyGlbQcEyQT7Dc4ZhwttGmGCwHbsMeXHtXRPvTEAoX1UcnYjDQTrfHYKkptOplnEXhov4F7X8NMVhqFirqDOYvaknSXgYbkivparoU1vdcRSmn+yNpf0WhThcq6hRsqdfKWEVHPb6eHqKTfn3Bf8Vz2LDbDeu7FXZKEXroh3QtXUEf0XV+7wB9S+voT1pNr9B7sJelLeYBPYE5+EG/0I/0A/1Mv9Ff6U2Oiko7+Z60RVZUN6wfHa02/k3P+lKagzXJtXjnv9pDL6cJR30co7vo/Zmp4tDqmC4ieiEpWVH66m9gD6AtQudJoev93hYv6ebkWmQjRUWdTxOOXuQYbGE6GXJFcQ72ljI0LFKyoqaS2A362Nt64EbaT4/AhlOL54QKvObtg7D/F2mG9TMYE8Wg8d+DmfNFnWebtObYE2/r4Lvc2+OwrUDo/k7YsNQheg1sTmkhEdfpJm930EveTtGiMk33xUSp0UQW8fQvtKhENmD2MJyPqzGQZ7R49dKLMZFnNFdH8B/2r1zxBxN5d8eAwqqsAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAZCAYAAABw43NsAAAC8klEQVR4Xu2XS6hOURTH/97Kq1yZeF0DQtItA4RiKEVRRhKllAy8Ji4ioUgJUUKYKMlAGaB0vUoSUl4DRAxMvMn7sf537e1bd3XO+XL0mZz9q3/fPv99ztl7rbMf3wYSiUSieiwR/Qr6Kvpgrn+IXok+Ga+5/alEO5egSZlhvKfBazHe8uB1Nl7leS3q77w4yjynvVF1dnsD+cm76o0qM8EbwiBo4jh1LZyuF5yXcByCJm+Rr0jU5xHSrlqKBdDEHXF+IxklmufNBvIN2ev5P3MY+uKFzq/HXG8UsMFdbxa1Oa+RTESDkpe3y9ZjjTcKOOuN/8wQlIuxLkXJa4KOzG2iF6LFovPQ+9+KnosmhXtniXaI7op2BY/8FH2G3rsyeO9FN//cobwMHtspYib0+TvQP/s8HY0XvUEtjvWhfD1cDzZ1ZKDommivaKuoCzTWo+gYayH8K1KUvNWiE6F8C/rC3tAANor6QhsmT6AbzjjRl+CRftCE894ewRuLjslbK5oTyt9FXU2dh3UjoMfHydC+sw92dPWEvicvedwgYxv0l0JjjcRYM+GLP4reQUcQvyTPuDzXxgDJKujLL0M7F5mO7GnbXbRM9BC1znVC9rSNyWPH8z5eEeyvx76H5/O85LG8Keg+9EMwVubFx1oaBr4C2hinFacHmSZqDeUIR9Mz0XzoqcSOnnOmHInJ245yyeMH9/xN8jhqo7ihMNb4l83GWprboimhvEd0L5SnQndQNrwTmkjbuSuibtDnSVv4jcGQmDyesbkmsvOR4aacB8/nHtsHrrU3QnmYq/MfawtqfSU21tJw7h8Q7RcdFA0wdVxUuR7GNW8d9Ch3DPrVOApnh7oH0OnAIEhcLrjIR7ihsL0zxsuCa2N8/rGrOynaJzoV6pgknpo4StkWnxsp6gPt/0XoOZ9rP9s+juxYS8EzL4lBW7IW9TGmzJFnGequs4gjju3xY2TJjtAsRot6QZeRZuTfzwRyc4sUxZpIJBKV4zc5iMMwUx8o7QAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHUAAAAaCAYAAACJphMzAAAD6UlEQVR4Xu2ZV4hUSRSGf+OaXXNcDMv6YMQAJnBUEEUFUVRQdmUUfVEMD4oghgcfBEFMiC+C+GRGUVEwiyIYQEGMKIyiPqgYwZzOP6eKrj49TU8PPTt3tD746apTt27dW6fqVN1qIBKJRCKRSCEZLfqRhwZqtUiS2Q111jrRMNFgUYmzLRb1Ew0NrmtWWiuSaD6Luhubn5WWPdYQSSZlOSqbU49YQyR5FIlqGFtjqEPfGDt5Yg2R6sE4qFMP24JI9eUa1Kl9bUGkejIJ6tADtsDQSvQSem1PU1YVtEb81MrKZqijFtgCA9fhNkiOU1eKzltjFVJsDVWJ3/XazVM2kuLUpHHCGioAzwcKQrZPmWwUyqkNRHWtsQD8YQ054LJiqW0NOeiA7E7N5+DmlDVUBM7OXE6dLlru0kOQcmp70XvRa1fGzvwoaitqKfoEPaX6R7QU6W2EadbxayPbYdkWUXPRUdFx0Qxo5/i2/hSNEV13ecJ6C0X1RR+Q27l3RDdcmnVXiVqI7olqQt/vOVIRbK/oimiOqJHombPzOh7kXHS/XOvJZNEUl74gqgN9h63Q9jig+XsQOij4Tpeh97AHQ+XiK9Qhb6Hfpu+gp0zfoA/smYZMh4czlc4Iy9sF6Ueixy7dC5n34WzoA3XAJWfrivTr5kOfwXMM6bPbO3U2dCDkA9uxs5R9UhLk6bDTLj0L2o5nP9QRnnCmDofen/sUag1SE4Own24jva/JGZOvFFYj0xnM00kefg41EfUPbKRE9MClOfLC+4wQ3YKOWnYkRyjpgvTr5okmBnmeboUz0Dt1LXTjVF4Y+jmwOSND2Pb9IM+I42dksei/VFHpqVwYWk8G6ZnQe40PxIgVYvuV/C9O5YPYxpnvHeR5GnXTKYQz1XeQdWqYZoSgU3cgc6bORaZTGV493qns/BdI3+z9HaTLgu0wEhA6ZxE01DNaeUZBHUQ4U/8NyuhULhGec+73qqgeNLyHzzM2SHM5Yjh+Jeoc2DkwfB2+kyfXUpI3m0QDXJrhkp0xNVVcCm0rjI0j/KlL+zDNFyGh475AO2Ab9J8hlvkQy5fnbPWchTqeMPSxnof1+A8TGYTcm52HorsufQjqNC4r/BYn7EiG1Fouv0y0BKlO51LQw6UJl5qmop0uz3dZ79J8Vr/WboBGCfIdqShF2AYjHtv0UaQh9F4Fh+HKh5puSB9FZJ/Jlwd2oF9TeP9C4TuvE3SglSU/uEhZmxLeg0tKvvxlDcgdMSw8Cwj3DR2DdKVDp/iNRlFYkBA4O0ZmkV1Lk8x2a6hMuKnZhdTuMFJ4uH/gJ1bkF2OjaII1Rqo3jIaR342faJTSi1JWgKgAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAYAAAD+vg1LAAABC0lEQVR4XmNgGAUkAl50AXKBEhD/AeL/QLwOiMOAuBmI7wCxIhD/RSglHuQC8RcgvgfEbmhy+4H4EQPEQpJADgNEUx26BBLYDsRn0QUJgX9AvAWIGdElkMAEIO5BF8QH9jIQ58VyIOZDF8QFdjJADJ2OLkEpAMUyyOAAdAlKAchQYoIBG/gAxG+A+AUQr0STI9rgCiB2RBNjZoDETxGaOBgQazAoHaMDIwY8eu8yQCQ50CWQgAYDpmtBAORSnAZzAvEJIP6ELgEFV4F4MbogFIDCGKfBMNDGgAgWkLdfAfF6FBWYgOhkCipwaoG4C4jT0OSwAZDBID1UBSZAfANdkBoAVJTORxccBfQBAF4KOcvK6QzJAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAYAAAD+vg1LAAABQUlEQVR4Xu2UuUoEURBFr6KCCIKxG/gBRgYqGqihkf/gHxiZGBi5JEYGBoJg5A+YCQZqLAiCgYGhkRtu4HLLqpl5XG3oZTTywIHuW/2Kntc1D/jnr+mjD/SdfoT39C2ur+lG/ekSLMAbbcZ9C+2lN5EPRV6YS/pKuyTvR+OXFMa2wxYeaYFMoELjLfjCGS2QC3htUgt5+OmNxukuPaNjUstNrfFxeB73p7Qjea4w1uRZstoW2HRkMaJBygC8waHk65EPS55i85/JDrzBtOQnkc9Jnpsr+kI7JbeZtsY2bqWwxcsaovFBB+N+O6nt0W58n6QvHuF7dAs/G+yte5L6LH2Cj9sa/C9vtNefAO6S60LY+bCKxvmRYmO4r2EzWKKjGjaDA9qmYVWmkPHhymLNVuCjuCi1Stihb1swT1ul9nt8AlnZTA8G5VmXAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAYCAYAAABXysXfAAACFElEQVR4Xu2Xz0tUURTHv2alRovwB6hYSREJoojLtE0uEt26ylWK/0ARbcLBpeSiwJUoEe5qEbQIMwRBhEBEtIW0DVxK4Q8SRescznneM2d8Y9A4POF94Mvc8z33zbtn3n333gFSUlL+h5ukHdIR6Y+K413SvsY/SZXRBeeB55CBvzJeCSlD2iOtGj/x/CD9JpX5hMKF9ngziTRCBjvnfAvnZ7yZRKYgg+30CcMW6RDxTy4xRC9+Pji/6c0k8q/FLHszifBAeSmOg6cW97nrEwjvW4PGF0kjx9ki0wgZzBfnW/qQ/8l9QiimC9L3ckgXj2nIzTt8QhmE5DM+YRhDKOYsuOeNODYgUyzul9yGFHPBJwynFcOb70nUe0OpMe2rpEUT54UH+sKbxBPIzs9PxBfyGHL8qdCYjztRMW2kNdIVyKAekX6RhhCmaj/CBvyV9E3bfL8JbfNi0066TVrST9aJ8LnLnse4faD+Oqk5dM2B+4+aeBLZT+YtpJgI+z4+gFz/VPVaY15cVkw/y4I3Cgnf/JmJuZjrJn6D7GI+mPYA5Ppup17SrOlnOfNi3puYi7lhYl+M7VtO+o7s9+i+fvL3NhmfV0Zm3nh8fUEZh0zJCD7qPNQ270kfEf4y1JE+I3fwL7VdDVnaGT7ovtN2LcLUHSa1IH6RKgitpGuQvaqKVJqVPZ073lBueQNS3CVvpqQUgb+QH2ygWj+xsAAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAYCAYAAACiNE5vAAACT0lEQVR4Xu2XPUiVYRTHT1ZiVGhDIGJCRI4qQmmDeoXwgyiHthYRHATdBJeGaHLTwVEjEETUwk0EpyYhFUIiUCJw0JoSJMUPTM+fcx7e40Gv3otJ9/r+4A/n43nv857n630uUUxMzGWikPWH9Zd1oIK/ydpRH/a98EC20UlS5HsX72ZtsFZcPGv4xtpn3fEJBYOCwckq7pIUtuAThj3Wkg9mOgMkhT/zCcNXkjalPpHJhIMtGeHgy/eJTCYUlQzk130w00FR2MPJQJtGtYtYfSZ3VsKWGlO/itUfpS8WfMfxMrM+YagmaXNF/bfqp4Mt/JP650mlD5zEIB2dTU8zSf6dT6SJLfxfMOUDJ/GDZJnf9AnlF8nL3vAJR1gNp5FO4XkkK9OTw8o1fgulsILQsNcHmXaSGxv2pf1xUM/aUhtX2R7WIkX7dY2iZzBgX9S+RkcL71IfYOB/skZZNawRjePZMOho26Y2rtGPWE81Dl6p/UB1LLiH2/s5bMz8Lus7nb5XsFIC6GTY+Pi952ovs267XCi8RP3ADOu68QHyuDZDGNxtkkF5aRspCUphxtMFgxO4zxoyPjp/QTLruAZbkBtXu1j9AAr3IN9k1MD6zKq1jZQEXXDhmHEckgF0jv0GMDvlLjeh9lkLt7whWU0fTQznC4QtEto/idLnRwFr1fjocJKifY3OO9TGoHxQGy+H3Lz6j9UPzJEcZJZp1kO1W1mvWVdJ9nidxnHGgFus3yT94Pz4L8AdHy9cQan/t0dBZT5Icqof9zXCBSsm5rJyCJvpikf80+p/AAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAYCAYAAABjswTDAAABuUlEQVR4Xu2WyytFURTGP4/IK8lEDFyMSImJkbpmJkZKnn+AgZn8AcorpUyUMjJgZoCJMqCUSBnIgBmlMPKIksJarXWcfVf33HvFrXPrfPVrr732ap+vdc7e9wKRImWsGmLMJsOqLyX0KkIOmX1BDpk9Qw6YzSdONf5EyM0+EJMaX0HM1vrL4dIl5HCxjiBm2/3l8GjPzNcgZkdNPlvahDxv2i5Y9UEKD4kDYp+409yEX/ajOptIoSGbCBCfl35kYPaWKDe5EYhZ7rCrMvzu03iyiRRqRBqzXMDGrHogZndNfgnBZu1h5G4F3SjVNkGKIYXZPARvVg9Zu3dyhcQy0Us0OflrYlFj7uQ6pJZreA8eG3Sd4wuNp4hWjVkxBJh9JZ6JN8gDSp21G8ivGOe57p2Y1TXezO1sAeQW8dSGxAYENaOYGCe2nFyMmHHmfxab7XDm/Bl5nWK1IL3ZY+KcGEaWzfKr69S4W8cPokJjNpDM7JyOG0SzxlXENhHXOX8i3hv8F8Xh/8/1rrBHYkHjEyTe2Z7ZHR1XiEGN5yFX5YDOu4hVjf9NlYqVe1hc2doS+LXuWYkUKZm+AdsIWqjrHLskAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAoCAYAAABDw6Z2AAAF1UlEQVR4Xu3deah1UxjH8cf4monwZiihRIhI5vfiH8o/Ev4wJSEkmTKTJCEh5R+hKKJkJsRrHkpmQshQxsx/mIf1s9bqPPfpnH3PPvfce+457/dTT3uvtfa73nP2OrWfu9Y++5gBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDLvjBTnpjg/xQUpLixxUR+B4To4xdkpzrM8HowFAAD43+IU/5box3Ipfrf+j0c7dSz2jg09nGn5+L9iAwAAmCw1SdgtNjTYOcVZsRKztqm1S6BlJWt3PAAAGFM1STgpNjTQ0l2TNn2h4zXLY/FhbJhBU8K9XqwAAADjZ1VrP7Mzk2H2taypY3FsbBjQOylWjpXom24FuN1yUvxIaAMAYF7dZTlJ+CU2DGBjy309FhtG6LdYscANM4F+O8XPsXKExi159OPwUoqrXRkAgHn3h+WL07WxoaUXU7xuw0s4hmHcErb7LJ+/H2NDS5enWNEW1lg8FSsWsNVs+rm7JZQBABiJOrOzfGxo4e6yjRe2w0rdEZaXmR5KsWuKk1OcUNqqb1LsUo77p9RtYvmYO0r5xlKWK8r+W9a5EX+t0qbHl+iblNqO0+yOHrWi91Hf/yC+Llv1U8dFdC6XWp4tuiTFgeWYZ0q7/wwsSnFz2X8vxSFlX3Vflv1rrDMWdZzU95qW+15S2jQGatNWMZ/0WWqKbg6w6Z9L/z4BABiZSy1fkAZ9VMQ5lmclRImGvvnoqW8dI2tYTgB8W/Wp2989xVTZVyJXEzbx/8bvv5LiaVfuNcPW6+LbrX4US2F6HYpeCcVMaqL0kXV/T36pNJ7LY8q+HuXi+eNqwia+Xomi79snnd1eR1u1D71G3YPZj21T7OhihxTbl/pt3HHeHjb99Wr2eRivHwCAWTvaOglSW7+meNxFvLipXC+OWqrTkp1vE83AXe/qlazUe+s+S3Gna4tJRvVcihdcWcu93fSavfozVjiaFWyyUUO0NZvlzL2seSxE9y5W8Vwe36U+lusMnvj6z62579nq1segf2Q00Syj/7/0x8LfrgwAwEisYN0vhv06KJRjXypvVfb1f3VL2DZM8aCr39I6s2qaKfJLe70SgWct30tX1TYtackNKV62zsVXSeG7KW4rZSV4mglU4qGk6QnLCcGU5b7eLMfNNc0M6nwMws9+iV53fMRH02yllqljfSx/5/Z9vc5bU9+ica0+TvFBigcsn+dPUqxi+fOk+/m2Lsepfal1+vi2HPN9qbu11HejsdYxvaIX36Y/GE51ZQAARuL5WNGnEy0nCLqYVpqh0cVOF/V9UuxfynpEwhaWZ9HeT3Go5Qfxqq0+ykIXYCUMm5X66ijLs3iii6faTrfOPXCnpFjd8oycluR0D5WoTQniolKu97fVvrXVT0PdY/mXBvyMnD9G/HucS1rWHZQSSr3eDUpZP32lbzhqRlH3DCoJvMzymGlZ8bRy/HGWlwq1r+NFCaves7Yal3oPm9RzohlN7evntNS3ZijVtxJh37doaVlJu79fzvPlNyyPi+r07eOqHnOkdf5ImIsZtuqrFNdZ/pwDADBSP8SKEVNSVWdWPCVkuu9IdC9STb6aaLZmu7KvZS71ITEZq5oStifLdv2ynQv6QsWVsXLE9o0Vls/lfmVfN+iv69qaLHH78dz7shLBaie3X4853DoJm+ouLvsAAEykeNGciZapxplmoG6y/L41M6PEQ1+AuL+0a3ZOS3qaJdIsnbb1ERvrpHi47M8FzUSuHStn0C2xHSevpnjU8qyeznP9pYw9LS+PTpWylkC17Klx03Kxxumn0qYZu7gkDwDAxBhkJueLWIGh2NzaP3vt3lgBAAAmi+4HWxwrexjkx8nRP83y6X6tfuh5cvq2LOMBAMCE0z1Y9YLfNjB88Rz3G1fpHwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwH7L9+JzSCQsoAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAAEYUlEQVR4Xu3cT6hVVRTH8W1ZKf0F0xL6YyomJag0MlEaZGmIFIlSiBBFhYo4EHLon0AstbCoBgaVYWUR6qCGqUUgVuIg1EEJkkqTIvojElTrx967u956596OD3k87fuBxd1rnXPuOU8Hd7H3OSclAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgfksFrq43WJ1LAIAAAyGZyz+dvnLIR9s94b8m9T3ei7ktf0RC4XOcVUsmhEWl8diCw/FQjDG4v3U/2+7zWKbxW6LH8O2gxZ3W3wX6gAA4BL0SOrfKCifGmqD5UDIr7NY7PJ4rQM1yuJQLBa9znEiFnpQg/eTxY1xQzDX4vrU/7yxUf20jL90dTVuz7kcAABcgro1bCtcfq3FTJdfYTG7jIe5uiy3GBdqT6W+M1a3uvFlbqzvjdeic9/j8rhdjeXDodaGvsefu3on9T+H12tb9YbFolj8D00Nm28Of0+d7X6/pSGfYLHSYoariWqK6tXUaQABAMAQFxu2G0J+2GKdxTRX31LGr7maGryfy9gff7Z8nrOYn/J9YH9ZvG4x1uKkxdqyz6qUj9Xn46W2p9QqP9Y51aCo8frF1duIzVGl+pFYdL61WBiLhZrYvbHYUlPD5mnbhyk3yH6/+P8nj4ba8JBr1k/UIP/m6gAAYIhq+sH3tE0/+Aq/XBmPibkctbgy5WOvSZ193kude8G0HNitIauatt9UxvXaNB5ftmmJcGQZy9MWN7tcms4jqmu51BvtxpqBe8nl0XGLjbHYQq+G7UGLB1zu99PsYjzu/pQbsRdL/lXq7KMZ0H1lDAAALhJtGjbNutXwdS/mEo+tx+/4d4/cXDQ1ZF7T9iVl7L9bs09aOhQ1TqIZMc3AbU+5aayaziOxrqVFzQRWathecXk3f1pMicUeujVst1h8H2p+v8dCLvo3nVzqaj51L13d56PEgwoAAFx02jRsTWJduZ52rNQ8zUp5GbTaWT41w1Z1a9jONNR6ja+2mORqmyyed/k8iy/KWOL1i+6HU4PnxSVDbT+fe+a2Wnwdiw2aGjY1mr7JVBMoWlKu1EB+7HKZUz6PpdygSf3uiW4sn7sxAAAYgu5K+T1k+gFfFrZVb6XOvWl6IlG0bzzmvlJTo7bZ1VVbkPKynl7Z8YTF6ZSXDTVz9UnZpz7EoLHuX3u35BtKTU1IvcF+fdk23eKDlGeQ6ixUbWb0Gow3y6foXjg/s6Tv8Q8dPGtxymKXxZMWL5R9avNTxabqQlDT/HbK363l2ztLXbmPen+cZhPr60+armdN+ew2o6imU/mvKT+FCwAAMKhqE7Y75XvP6lOsepBBjWOld5i1mfmK9scCAAAAzk+dYav3sP2QchMXlzalLjG2pQcZer04N86I+QAAAMAAtZ0xuyP1fTcdAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4H/sH9m7tSLgPNc4AAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAjCAYAAAApBFa1AAADY0lEQVR4Xu3cS8h2UxQA4I3IpaQMpCglkVIiotxSJi5loJCUJDIgCRP/RCEUMSYGyoBcZmLkUq5l4n5JSTIghYnc9+rs/b37rPe88g3ev3/wPLU6e619zvnP+49We3/nlAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOzrLqpxZC4CALA979T4p8Z7Nd5q45dnZ8zF/Bu5WL1dprmn8kR1e1n9G3vbAbmQvFumZ7s21V+scUmNu2p8mOaer/FnjVNS/dUy3evkVA8Hlmnuq5b/1PIxnmtzAABrolkY3V+Wm7LwZlk/v+uNR/ZgWa5vU/yG3hxt8t0w/qHMn/HxGo8OeReNWni4LP+mT8py/e+yXs/56ykHANiRG4c7y9RgbJLP73rDdt9Qu2qY2xtideuPGvvliQXxGy9s474K+F8uq3F5LibXl+X7XFDW6zkHANhobBxuSfmobw3GKls0dVlcd3w7ds8Mc9v0fo0nc3EXYouyr56F2OKN+/0+1OI3xGrhxTV+Lctbn9GwRf3LofZIO+b/g5wDAGwUjcM5Nc6v8VeNB+bTO35ux6PLcrPRa+Pc/gu1bfisxkO5uAvxfP1ZQ1+hu7usVhvjnFiJC4e3PIuGLYxzPy7Uen5cjRvb+LzZLADAYKmRyO6p8cIQcc4JszNW151bplWl8Q/5l+65DWeXqencjfxshw7jo8pq/rcy32rN14XesH1RpvmPh7l8/pjflHIAgJncKER+TKr9kvJoipauG8fjFuU4F9c+VqaXAk6q8VpZNUnflulN077aFVuLsT35aY3PW+3/ipXCK3MxuXQY923MeJv1oDa+pqye/bQaZ7RxPF/+/eGGYRzzZ6Z8NOavpBwAYMetZWoU9tS4otVideilNo7PYjzRzrmj1Q6p8X2r3dxqz7Y87hd683FWjdtaHscwNjX9+vi7uNC3NePFgXBEmRqpq1u+W/Gsm3xTpucaI8QnOPonO6LWX0wIffXugxr3DvUuVh+7aEq7Y8u8ITu95YeV6f4xjm1pAIB9wnXDuH+Et3+j7et2HJubj2qcOOQAAGxZrOb1vwU7tR3jpYHwdDtGwxbboPER3zg38oPb3JK8UpZXzQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANb8C6YYyZIsjbdxAAAAAElFTkSuQmCC>