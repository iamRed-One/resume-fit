import { tokenize } from "./text";

/**
 * A dictionary of skills, tools and practices with aliases. It does two jobs:
 *  - recognises a skill in a posting even when it is mentioned once, in a plain list;
 *  - lets "Postgres" on a resume satisfy "PostgreSQL" in a posting.
 *
 * Format, one skill per line: `Display|alias|alias`. Matching is case-insensitive and stem-based.
 * Leading flags on the name: `!` makes it case-sensitive, for words that are also everyday English
 * ("Go", "R"); `~` marks a weak, ambiguous word (see Skill.weak). The `# --- field` comments set the
 * field for the lines below them. Software skills come first and are the most complete.
 */
const RAW = `
# --- languages
Python|python3
Java
JavaScript|js|ecmascript
TypeScript|ts
!Go|golang
Rust
C++|cpp|c/c++
C#|csharp
Scala
Kotlin
Swift
Objective-C
Ruby
PHP
!R|r programming
SQL|t-sql|pl/sql
Bash|shell scripting|shell
Perl
Haskell
Elixir
Erlang
Clojure
Dart
Lua
MATLAB
Solidity
Groovy
WebAssembly|wasm
HTML
CSS|css3|scss|sass
# --- web
React|react.js|reactjs
Angular|angularjs
Vue|vue.js|vue 3|vuejs
Svelte
Next.js|nextjs
Node.js|nodejs
Express
Django
Flask
FastAPI
Spring|spring boot
Rails|ruby on rails
Laravel
.NET|dotnet|asp.net
GraphQL
REST|restful|rest api|rest apis
gRPC
Thrift
Redux
Tailwind|tailwind css
Bootstrap
jQuery
Webpack
Vite
Composition API
ECMAScript Modules|esm
Monorepo|monorepos
Jest
Cypress
Playwright
Selenium
JUnit
pytest
Storybook
Web Components
~Browser|browsers
Frontend|front-end|front end
Backend|back-end|back end
Full-stack|fullstack|full stack
Component Systems@swe+design|component library|component libraries|component design|design system|design systems
# --- mobile
iOS
Android
Jetpack Compose
SwiftUI
UIKit
React Native
Flutter
AVFoundation
RxSwift
RxJava
!~Combine
Coroutines
Core Media
Core Video
~Mobile|mobile development
HLS|http live streaming
MPEG-DASH|dash
# --- data and ml
Machine Learning|ml
Deep Learning
Natural Language Processing|nlp
Computer Vision
LLM|llms|large language models|large language model
Generative AI|genai|gen ai
RAG|retrieval-augmented generation|retrieval augmented generation
MLOps
PyTorch
TensorFlow
Keras
scikit-learn|sklearn
XGBoost
Pandas
NumPy
Spark|apache spark|pyspark
Hadoop
Kafka|apache kafka
Airflow|apache airflow
dbt
Snowflake
Databricks
BigQuery
Redshift
Druid
ClickHouse
ETL|elt
Data Pipelines|data pipeline|data engineering
Data Modeling|data models|dimensional modeling|data model
Data Warehouse|data warehousing|data warehouses
Data Quality
Data Contracts
Semantic Layer
Statistics|statistical analysis|statistical modeling|statistical techniques|statistical methods
Experiment Design@swe+product+marketing+design|a/b testing|ab testing|experimentation|experiments
Model Evaluation|model evaluation
~Optimization|optimisation
Operations Research
Tableau
Looker
Power BI
Excel|microsoft excel
Dashboards|dashboard
KPIs|kpi
# --- databases
PostgreSQL|postgres
MySQL
MongoDB
Redis
DynamoDB
Cassandra
Elasticsearch
SQLite
Oracle@swe+finance
SQL Server
Neo4j
Memcached
Relational Databases|relational database|rdbms
NoSQL
# --- cloud and infrastructure
AWS|amazon web services
Azure
GCP|google cloud|google cloud platform
Kubernetes|k8s
Docker|containers|containerization
Terraform
CloudFormation
Ansible
Pulumi
Helm
Jenkins
GitHub Actions
GitLab CI
CircleCI
Argo CD|argocd
Argo
GitOps
CI/CD|continuous integration|continuous delivery|continuous deployment
Istio
Service Mesh
Prometheus
Grafana
Datadog
Linux
Serverless|lambda
Microservices|microservice
Observability
Monitoring
SRE|site reliability
SLOs|slo|slas|sla
On-call|oncall|on call
Incident Response@swe+support|incident management|incident|incidents|incident handling
Runbooks|runbook
~Networking
Distributed Systems|distributed data systems|distributed data infrastructure
Low-latency|low latency
High-availability|high availability
Scalability|scalable systems
Production Systems
Cloud-native|cloud native
Multi-region
# --- security
Application Security|appsec|product security
Vulnerability Management|vulnerability|vulnerabilities
Penetration Testing|pentesting
OWASP
SIEM
IAM
OAuth
Authentication
Authorization
Encryption
SOC 2
Threat Intelligence
Bug Bounty
Guardrails
CSRF
Detections
# --- engineering practice
Code Review|code reviews
Design Review|design reviews
Unit Testing|unit tests
Integration Testing|integration tests
Testing|test automation|automated testing
TDD|test-driven development
Agile
Scrum
Kanban
System Design
API Design
APIs|api
SDK|sdks
Data Structures
Algorithms
Design Patterns
Software Architecture|architecture|architectures
Technical Strategy|technical vision|technical direction
Technical Leadership|tech lead
Mentoring@general|mentor|mentorship|mentored|coaching|coach
~Performance|performance optimization
Accessibility@swe+design|a11y
~Reliability
Debugging|debug|debugged
Git
Semantic Versioning|semver
State Management
~Rendering
Feature Flags
Systems Programming|systems software
Payments
Fraud
~Trading
~Video
~Search
~Ranking
Data Pipelines
# --- product and design
Roadmap@product+swe|product roadmap
Prioritization@general|prioritisation
User Research@product+design
Product Strategy
Stakeholder Management@general|stakeholders|stakeholder
Cross-functional@general|cross functional|cross-team|cross team|cross functionally
Figma@product+design
~Prototyping@product+design|prototype|prototypes
Wireframes
~Portfolio@design
Design Strategy
OKRs
Jira
~Metrics@product+marketing+sales+finance+swe
Consumer Products
~Qualitative
~Quantitative
# --- sales
SaaS
~Pipeline Generation@sales+recruiting+product+marketing+support|pipeline|pipelines
Quota Attainment|quota|sales targets
Value Selling
~Discovery
Sales Cycles|sales cycle
Account Planning|account plans|account plan
Mid-Market|mid market
Enterprise Sales
Salesforce
HubSpot
~CRM
~Forecasting@sales+finance
~Negotiation|negotiating
Prospecting
~Outbound
Multi-threading|multithreading
~Executives|executive-level
# --- recruiting and people
Full-cycle|full cycle
~Sourcing
~Intake
Structured Interviews|structured interview
Offer Negotiations|offer negotiation
Pipeline Management
Candidate Experience
~Compensation
Applicant Tracking System|ats
OTE|on-target earnings
~Hiring|hire
# --- finance and accounting
GAAP|us gaap|u.s. gaap
IFRS
SOX|sarbanes-oxley
Month-end Close|month end close|month-end|monthly close|close process|close processes
Accruals|accrual
~Reconciliation
~Audit|audits|auditing
Financial Modeling
FP&A
NetSuite
SAP
~Tax
Accounts Payable
~Budgeting
~Accounting
# --- support and IT
JAMF
Intune
ABM|apple business manager
Zendesk
ServiceNow
Okta
Active Directory
~Troubleshooting|troubleshoot
~Ticketing|ticket
~Hardware
~Windows
macOS
ChromeOS|chromebook|chromebooks
~Apple
VPN
WiFi|wi-fi
~Onboarding
# --- marketing
SEO
SEM
PPC
Content Marketing
Email Marketing
Google Analytics
Marketo
Product Marketing
Battlecards|battlecard
~Launches|product launch|product launches
~Positioning
~Messaging
Go-to-market|go to market|gtm
Sales Enablement
Institutional Trading
Derivatives
# --- software: data, streaming and storage
Flink|apache flink
Dagster
Prefect
Kinesis
Pulsar
RabbitMQ
SQS
Debezium
Change Data Capture|cdc
Delta Lake
Iceberg
Trino
Presto
~Aurora|amazon aurora
Cosmos DB
Spanner
CockroachDB
Vitess
S3|amazon s3
EC2
CloudFront
Cloudflare Workers
~Streaming|stream processing|data streaming|real-time processing
~Batch Processing|batch processing|batch jobs
Modern Data Stack
Data Lineage|lineage
Fivetran
Airbyte
# --- software: platform, reliability and security
JVM|java virtual machine
Netty
Akka
Quarkus
Micronaut
Protobuf|protocol buffers
Event-driven Architecture|event-driven|event driven
Infrastructure as Code|iac
Packer
Consul
Envoy
NGINX
HAProxy
Cilium
eBPF
RBAC
AppArmor
SELinux
seccomp
Threat Modeling
Red Teaming|red team
Jailbreak|jailbreaking|jailbreak testing
Prompt Injection
Zero Trust
CVE|cves
Splunk
New Relic
PagerDuty
Sentry
OpenTelemetry|otel
Jaeger
Chaos Engineering
Capacity Planning
Postmortems|postmortem|post-incident|post incident
Root Cause Analysis@swe+support|rca|rcas|root cause
Rollback|rollbacks
Canary|blue-green|blue green
Release Engineering
~Security|secure development|security engineering
# --- software: AI and agents
Agentic|agentic ai|agentic systems|ai agents|multi-agent systems
Prompt Engineering
Evals|evaluations
Tool Calling|function calling|tool use
Fine-tuning|fine tuning
Embeddings|embedding
Vector Databases|vector database|vector db
Orchestration|orchestrator
LangChain
OpenAI
Anthropic
Claude|claude code
GPT|chatgpt
Gemini
GitHub Copilot|copilot
MCP|model context protocol
RLHF
# --- software: web and mobile
Animation|animations
Data Fetching
Modular|modularity|modularization
Monolith|monolithic
WebSockets|websocket
WebRTC
D3|d3.js
Three.js
Remix
Nuxt
Apollo
Retrofit
MVVM
Dagger|hilt
Core Data
# --- general
Documentation|technical documentation
Automation
AI Tools|ai-assisted|ai-assisted development|generative ai tools
Analytics|data analytics|data analysis
Business Intelligence|bi|bi tools|bi visualization
Data Governance|governed data|governance
Compliance@product+finance+support+swe
Cost Optimization|cost optimisation|cost reduction
# --- product and design: product
~Product Management@product|product management
Product Vision
User Stories|user story
Requirements Gathering|business requirements
Survey|surveys
ThoughtSpot
Qualtrics
Metabase
Segment
# --- design
Typography
Micro-interactions|microinteractions
Visual Design|visual craft
Interaction Design
~User Experience@design+product|ux
~UI|user interface
~Craft
Design Tokens
# --- sales: more
IACV|acv|arr
New Business|new customer acquisition|new logo|new logos
Territory Planning|territory|territories
Consultative Selling|consultative|solution selling
~Contract Negotiation|contracts|contract
MEDDIC|meddpicc
Cold Calling
~Closing|closing deals|close deals
Cross-sell|upsell|cross sell
Account Management|account manager
Renewals|renewal
Customer Success
~Advertising|ad sales|media sales
Business Development
~Partnerships|partnership
~Revenue|revenue targets|revenue goals
# --- support and IT: more
Escalation|escalations|escalate
Customer Service|customer support|customer-facing
Tier 2|tier 3|l2|l3
Databases|database
Elastic Stack|elk|elk stack
Telemetry
Logs|logging|log analysis
Unix
# --- recruiting and people: more
Greenhouse|greenhouse ats
Gem
Lever
Passive Candidates|passive candidate|passive talent
Technical Recruiting|technical recruiter|recruiting
Outreach|candidate outreach
Talent Mapping|market mapping
Hiring Managers|hiring manager
Comp Bands|compensation bands
Time to Fill
Interviewing|interview process|interview processes
Talent Acquisition
Workday
# --- finance and accounting: more
Variance Analysis
Scenario Analysis|sensitivity analysis|sensitivity testing|sensitivity
Pivot Tables|pivot table
VLOOKUP|xlookup
Financial Reporting
P&L|profit and loss
RFP|rfps|request for proposal
Anaplan|adaptive insights|hyperion
Cash Flow
Balance Sheet
# --- marketing: more
Lifecycle Marketing|lifecycle
Growth Marketing
~Push Notifications|push
~SMS
Creative Briefs|creative brief
Behavioral Science|behavioural science
Segmentation
Braze
Iterable
Amplitude
Mixpanel
Copywriting
Paid Social|performance marketing|paid media
`;

export interface SkillAlt {
  stems: string[];
  /** When set, the raw token must equal this exactly (case-sensitive). */
  raw?: string[];
}

export type Domain = "swe" | "product" | "sales" | "recruiting" | "finance" | "support" | "marketing" | "design" | "general";

export interface Skill {
  display: string;
  alts: SkillAlt[];
  /** Fields this skill belongs to. "general" means every field (mentoring, cross-functional work). */
  domains: Domain[];
  /**
   * An everyday word that is only a skill in context ("pipeline", "search", "discovery"). It is kept
   * only when the posting is clearly in one of the skill's fields, or when it is repeated.
   */
  weak: boolean;
}

function makeAlt(name: string, forceCase: boolean): SkillAlt {
  const tokens = tokenize(name);
  return { stems: tokens.map((t) => t.stem), ...(forceCase ? { raw: tokens.map((t) => t.raw) } : {}) };
}

function domainOf(header: string): Domain {
  if (/general/i.test(header)) return "general";
  if (/design/i.test(header) && !/product/i.test(header)) return "design";
  if (/product/i.test(header)) return "product";
  if (/sales/i.test(header)) return "sales";
  if (/recruit/i.test(header)) return "recruiting";
  if (/financ/i.test(header)) return "finance";
  if (/support/i.test(header)) return "support";
  if (/marketing/i.test(header)) return "marketing";
  return "swe";
}

const DOMAIN_NAMES = new Set<string>(["swe", "product", "sales", "recruiting", "finance", "support", "marketing", "design", "general"]);

const altKey = (a: SkillAlt) => `${a.stems.join(" ")}|${a.raw?.join(" ") ?? ""}`;

function parse(raw: string): Skill[] {
  const out: Skill[] = [];
  // A name listed twice (say once per field) is one skill: merge fields and spellings, or it would be required twice.
  const byName = new Map<string, Skill>();
  let section: Domain = "swe";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      section = domainOf(trimmed);
      continue;
    }
    const [head, ...rest] = trimmed.split("|");
    // `Name@sales+finance` places one skill in several fields.
    const [first, fields] = head.split("@");
    const domains = fields ? (fields.split("+").filter((d) => DOMAIN_NAMES.has(d)) as Domain[]) : [section];
    const flags = /^[!~]*/.exec(first)![0];
    const cs = flags.includes("!");
    const display = first.slice(flags.length);
    const alts = [makeAlt(display, cs), ...rest.map((a) => makeAlt(a, false))].filter((a) => a.stems.length > 0);
    const skill: Skill = { display, alts, domains: domains.length ? domains : [section], weak: flags.includes("~") };
    const seen = byName.get(display.toLowerCase());
    if (!seen) {
      byName.set(display.toLowerCase(), skill);
      out.push(skill);
      continue;
    }
    const known = new Set(seen.alts.map(altKey));
    seen.alts.push(...skill.alts.filter((a) => !known.has(altKey(a))));
    seen.domains = [...new Set([...seen.domains, ...skill.domains])];
    seen.weak = seen.weak && skill.weak;
  }
  return out;
}

export const SKILLS: Skill[] = parse(RAW);
