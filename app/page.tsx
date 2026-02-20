'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { VscDashboard, VscHistory, VscGear, VscCode, VscShield, VscBook, VscGithubInverted } from 'react-icons/vsc'
import { FiCopy, FiCheck, FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiMenu, FiX, FiLoader, FiAlertTriangle, FiAlertCircle, FiInfo, FiSearch, FiTrash2, FiRefreshCw, FiExternalLink, FiSend, FiPlay, FiSave } from 'react-icons/fi'
import { HiOutlineDocumentText } from 'react-icons/hi'
import { BsLightningCharge, BsShieldCheck, BsFileEarmarkCode, BsGlobe } from 'react-icons/bs'

// ============================================================================
// CONSTANTS
// ============================================================================

const MANAGER_AGENT_ID = '6998dda44657541456743cb6'
const GITHUB_AGENT_ID = '6998ddbc8d370e1a6cc0ba7a'

const AVAILABLE_LANGUAGES = ['Python', 'Node.js', 'Go', 'Java', 'Ruby', 'PHP']

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

interface CodeSnippet {
  language: string
  code: string
  filename: string
  description: string
}

interface Dependency {
  language: string
  packages: string[]
}

interface CodeOutput {
  code_snippets: CodeSnippet[]
  dependencies: Dependency[]
  usage_notes: string
  authentication_type: string
}

interface SecurityFinding {
  id: string
  severity: string
  category: string
  title: string
  description: string
  remediation: string
  evidence: string
}

interface AlertRule {
  name: string
  condition: string
  severity: string
  action: string
}

interface SecurityOutput {
  findings: SecurityFinding[]
  risk_score: string
  alert_rules: AlertRule[]
  summary: string
}

interface Endpoint {
  method: string
  path: string
  description: string
  parameters: string
  response_schema: string
}

interface DocumentationOutput {
  documentation: string
  endpoints: Endpoint[]
  getting_started: string
  changelog_entry: string
  troubleshooting: string
}

interface IntegrationResult {
  code_output: CodeOutput
  security_output: SecurityOutput
  documentation_output: DocumentationOutput
  integration_summary: string
  readiness_assessment: string
}

interface GitHubAction {
  type: string
  description: string
  url: string
  status: string
}

interface GitHubIssue {
  title: string
  number: number
  url: string
  severity: string
}

interface GitHubPullRequest {
  title: string
  url: string
  branch: string
  files_changed: number
}

interface GitHubResult {
  actions_taken: GitHubAction[]
  issues_created: GitHubIssue[]
  pull_request: GitHubPullRequest
  summary: string
  errors: string[]
}

interface ActivityItem {
  id: string
  type: 'code_gen' | 'security' | 'github_push'
  timestamp: string
  summary: string
  details: string
}

interface AppSettings {
  defaultRepo: string
  defaultBranch: string
  preferredLanguages: string[]
  codeStyle: 'async' | 'sync'
  docFormat: 'markdown' | 'html'
  alertSeverityThreshold: string
}

interface StatusMessage {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// ============================================================================
// UTILITY: Deep parse JSON strings in response
// ============================================================================

function deepParseJSON(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed)
        return deepParseJSON(parsed)
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(deepParseJSON)
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = deepParseJSON((value as Record<string, unknown>)[key])
    }
    return result
  }
  return value
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_API_SPEC = `openapi: 3.0.0
info:
  title: Payment Gateway API
  version: 1.0.0
paths:
  /payments:
    post:
      summary: Create a payment
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                amount:
                  type: number
                currency:
                  type: string
                customer_id:
                  type: string
      responses:
        '200':
          description: Payment created
  /payments/{id}:
    get:
      summary: Get payment status
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string`

const SAMPLE_RESULT: IntegrationResult = {
  code_output: {
    code_snippets: [
      {
        language: 'Python',
        code: `import requests\nimport json\nfrom typing import Optional\n\nclass PaymentGateway:\n    def __init__(self, api_key: str, base_url: str = "https://api.payments.com/v1"):\n        self.api_key = api_key\n        self.base_url = base_url\n        self.session = requests.Session()\n        self.session.headers.update({\n            "Authorization": f"Bearer {api_key}",\n            "Content-Type": "application/json"\n        })\n\n    def create_payment(self, amount: float, currency: str, customer_id: str) -> dict:\n        """Create a new payment."""\n        payload = {\n            "amount": amount,\n            "currency": currency,\n            "customer_id": customer_id\n        }\n        response = self.session.post(f"{self.base_url}/payments", json=payload)\n        response.raise_for_status()\n        return response.json()\n\n    def get_payment(self, payment_id: str) -> dict:\n        """Get payment status."""\n        response = self.session.get(f"{self.base_url}/payments/{payment_id}")\n        response.raise_for_status()\n        return response.json()`,
        filename: 'payment_client.py',
        description: 'Python client for the Payment Gateway API with session management and error handling.'
      },
      {
        language: 'Node.js',
        code: `const axios = require('axios');\n\nclass PaymentGateway {\n  constructor(apiKey, baseUrl = 'https://api.payments.com/v1') {\n    this.client = axios.create({\n      baseURL: baseUrl,\n      headers: {\n        'Authorization': \`Bearer \${apiKey}\`,\n        'Content-Type': 'application/json'\n      }\n    });\n  }\n\n  async createPayment(amount, currency, customerId) {\n    const { data } = await this.client.post('/payments', {\n      amount, currency, customer_id: customerId\n    });\n    return data;\n  }\n\n  async getPayment(paymentId) {\n    const { data } = await this.client.get(\`/payments/\${paymentId}\`);\n    return data;\n  }\n}\n\nmodule.exports = PaymentGateway;`,
        filename: 'paymentClient.js',
        description: 'Node.js client using Axios with async/await patterns.'
      }
    ],
    dependencies: [
      { language: 'Python', packages: ['requests>=2.31.0'] },
      { language: 'Node.js', packages: ['axios@^1.6.0'] }
    ],
    usage_notes: 'Initialize the client with your API key. All methods return parsed JSON responses. Handle rate limiting with exponential backoff.',
    authentication_type: 'Bearer Token'
  },
  security_output: {
    findings: [
      {
        id: 'SEC-001',
        severity: 'Critical',
        category: 'Authentication',
        title: 'API Key Exposure Risk',
        description: 'The API key is passed directly in code. If committed to version control, this could lead to unauthorized access.',
        remediation: 'Use environment variables or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) to store API keys.',
        evidence: 'api_key parameter passed directly to constructor'
      },
      {
        id: 'SEC-002',
        severity: 'Warning',
        category: 'Input Validation',
        title: 'Missing Input Sanitization',
        description: 'Payment amounts and currency codes are not validated before sending to the API.',
        remediation: 'Add input validation for amount (positive number), currency (ISO 4217), and customer_id format.',
        evidence: 'No validation in create_payment() parameters'
      },
      {
        id: 'SEC-003',
        severity: 'Info',
        category: 'Transport Security',
        title: 'HTTPS Enforcement',
        description: 'The base URL uses HTTPS by default, which is correct for payment data.',
        remediation: 'Add certificate pinning for additional security in production environments.',
        evidence: 'base_url defaults to https://'
      }
    ],
    risk_score: '6.5/10',
    alert_rules: [
      { name: 'High-Value Transaction', condition: 'amount > 10000', severity: 'Warning', action: 'Log and notify' },
      { name: 'Failed Auth Attempts', condition: 'auth_failures > 3 in 5min', severity: 'Critical', action: 'Block and alert' }
    ],
    summary: 'The integration has moderate security concerns. Critical: API key management needs improvement. The HTTPS default is good, but input validation should be added before production deployment.'
  },
  documentation_output: {
    documentation: '# Payment Gateway API Integration\n\nThis integration provides a clean client library for the Payment Gateway API, supporting payment creation and status retrieval.\n\n## Features\n\n- **Simple Authentication**: Bearer token-based auth\n- **Multi-language Support**: Python and Node.js clients\n- **Error Handling**: Built-in HTTP error handling\n- **Type Safety**: Full type annotations (Python)',
    endpoints: [
      { method: 'POST', path: '/payments', description: 'Create a new payment transaction', parameters: 'amount (number), currency (string), customer_id (string)', response_schema: '{ id, status, amount, currency, created_at }' },
      { method: 'GET', path: '/payments/{id}', description: 'Retrieve payment status by ID', parameters: 'id (path parameter)', response_schema: '{ id, status, amount, currency, updated_at }' }
    ],
    getting_started: '## Getting Started\n\n1. Install dependencies:\n   - Python: `pip install requests`\n   - Node.js: `npm install axios`\n\n2. Set your API key as an environment variable:\n   ```\n   export PAYMENT_API_KEY=your_key_here\n   ```\n\n3. Initialize the client and make your first call.',
    changelog_entry: '## v1.0.0 (2024-01-15)\n\n- Initial release\n- Added payment creation endpoint\n- Added payment status retrieval\n- Python and Node.js client libraries',
    troubleshooting: '## Troubleshooting\n\n### 401 Unauthorized\nVerify your API key is valid and properly set.\n\n### 429 Too Many Requests\nImplement exponential backoff. Default rate limit is 100 req/min.\n\n### Connection Timeout\nCheck network connectivity and API endpoint availability.'
  },
  integration_summary: 'Successfully generated integration code for the Payment Gateway API with Python and Node.js clients, comprehensive security analysis, and full documentation.',
  readiness_assessment: 'Production Readiness: 7/10. Address the critical API key management finding before deploying to production.'
}

const SAMPLE_GITHUB_RESULT: GitHubResult = {
  actions_taken: [
    { type: 'file_push', description: 'Pushed payment_client.py to integrations/', url: 'https://github.com/acme/api-integrations/blob/main/integrations/payment_client.py', status: 'success' },
    { type: 'file_push', description: 'Pushed paymentClient.js to integrations/', url: 'https://github.com/acme/api-integrations/blob/main/integrations/paymentClient.js', status: 'success' },
    { type: 'docs_update', description: 'Updated README.md with integration docs', url: 'https://github.com/acme/api-integrations/blob/main/README.md', status: 'success' }
  ],
  issues_created: [
    { title: 'SEC-001: API Key Exposure Risk', number: 42, url: 'https://github.com/acme/api-integrations/issues/42', severity: 'Critical' },
    { title: 'SEC-002: Missing Input Sanitization', number: 43, url: 'https://github.com/acme/api-integrations/issues/43', severity: 'Warning' }
  ],
  pull_request: { title: 'feat: Add Payment Gateway API integration', url: 'https://github.com/acme/api-integrations/pull/15', branch: 'feat/payment-gateway', files_changed: 4 },
  summary: 'Successfully pushed integration code, created 2 security issues, and opened a pull request.',
  errors: []
}

const SAMPLE_ACTIVITIES: ActivityItem[] = [
  { id: '1', type: 'code_gen', timestamp: '2024-01-15T10:30:00Z', summary: 'Generated Payment Gateway API integration (Python, Node.js)', details: 'Created client libraries for 2 languages with full error handling and type annotations.' },
  { id: '2', type: 'security', timestamp: '2024-01-15T10:30:05Z', summary: 'Security analysis: Risk Score 6.5/10 - 3 findings', details: '1 Critical (API key exposure), 1 Warning (input validation), 1 Info (HTTPS enforcement).' },
  { id: '3', type: 'github_push', timestamp: '2024-01-15T10:32:00Z', summary: 'Pushed to acme/api-integrations - PR #15 opened', details: '3 files pushed, 2 issues created for security findings.' }
]

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: AppSettings = {
  defaultRepo: '',
  defaultBranch: 'main',
  preferredLanguages: ['Python', 'Node.js'],
  codeStyle: 'async',
  docFormat: 'markdown',
  alertSeverityThreshold: 'Warning'
}

// ============================================================================
// MARKDOWN RENDERER
// ============================================================================

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) {
    const codeParts = text.split(/`(.*?)`/g)
    if (codeParts.length === 1) return text
    return codeParts.map((part, i) =>
      i % 2 === 1 ? (
        <code key={i} className="px-1.5 py-0.5 bg-secondary rounded text-sm font-mono text-[hsl(135,94%,60%)]">{part}</code>
      ) : (
        part
      )
    )
  }
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''
  const elements: React.ReactNode[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeBlockContent = []
      } else {
        inCodeBlock = false
        elements.push(
          <pre key={`code-${i}`} className="bg-secondary/80 border border-border rounded-lg p-3 overflow-x-auto my-2">
            <code className="text-xs font-mono text-foreground">{codeBlockContent.join('\n')}</code>
          </pre>
        )
      }
      continue
    }
    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>)
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>)
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>)
    } else if (!line.trim()) {
      elements.push(<div key={i} className="h-1" />)
    } else {
      elements.push(<p key={i} className="text-sm">{formatInline(line)}</p>)
    }
  }
  return <div className="space-y-1">{elements}</div>
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================================
// SEVERITY BADGE
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return <Badge className="bg-destructive text-destructive-foreground border-0 text-xs">{severity}</Badge>
  if (s === 'warning') return <Badge className="bg-[hsl(31,100%,65%)] text-black border-0 text-xs">{severity}</Badge>
  if (s === 'info') return <Badge className="bg-[hsl(191,97%,70%)] text-black border-0 text-xs">{severity}</Badge>
  return <Badge variant="secondary" className="text-xs">{severity || 'Low'}</Badge>
}

// ============================================================================
// CODE BLOCK
// ============================================================================

function CodeBlock({ code, language, filename, description }: { code: string; language?: string; filename?: string; description?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(code ?? '')
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/50 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border">
        <div className="flex items-center gap-2">
          {language && <Badge className="bg-primary text-primary-foreground border-0 text-xs">{language}</Badge>}
          {filename && <span className="text-xs font-mono text-muted-foreground">{filename}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-muted-foreground hover:text-foreground">
          {copied ? <FiCheck className="w-3.5 h-3.5 text-[hsl(135,94%,60%)]" /> : <FiCopy className="w-3.5 h-3.5" />}
          <span className="ml-1.5 text-xs">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
      {description && <div className="px-4 py-2 border-b border-border"><p className="text-xs text-muted-foreground">{description}</p></div>}
      <ScrollArea className="max-h-80">
        <pre className="p-4 overflow-x-auto"><code className="text-xs font-mono text-foreground leading-relaxed whitespace-pre">{code ?? ''}</code></pre>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// STATUS MESSAGE COMPONENT
// ============================================================================

function StatusAlert({ msg, onDismiss }: { msg: StatusMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(msg.id), 5000)
    return () => clearTimeout(timer)
  }, [msg.id, onDismiss])

  const borderClass = msg.type === 'success' ? 'border-[hsl(135,94%,60%)]/50' : msg.type === 'error' ? 'border-destructive/50' : 'border-primary/50'
  const iconColor = msg.type === 'success' ? 'text-[hsl(135,94%,60%)]' : msg.type === 'error' ? 'text-destructive' : 'text-primary'

  return (
    <Alert className={cn('mb-2', borderClass)}>
      <div className="flex items-start gap-2">
        {msg.type === 'success' && <FiCheck className={cn('w-4 h-4 mt-0.5 shrink-0', iconColor)} />}
        {msg.type === 'error' && <FiAlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', iconColor)} />}
        {msg.type === 'info' && <FiInfo className={cn('w-4 h-4 mt-0.5 shrink-0', iconColor)} />}
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-semibold">{msg.title}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-0.5">{msg.message}</AlertDescription>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => onDismiss(msg.id)}>
          <FiX className="w-3 h-3" />
        </Button>
      </div>
    </Alert>
  )
}

// ============================================================================
// LOADING SKELETON FOR OUTPUT
// ============================================================================

function OutputSkeleton({ phase }: { phase: string }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3 mb-6">
        <FiLoader className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm text-primary font-medium">{phase}</span>
      </div>
      <Skeleton className="h-6 w-1/3 bg-muted" />
      <Skeleton className="h-4 w-full bg-muted" />
      <Skeleton className="h-4 w-5/6 bg-muted" />
      <Skeleton className="h-32 w-full bg-muted rounded-lg" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-20 bg-muted rounded" />
        <Skeleton className="h-8 w-20 bg-muted rounded" />
      </div>
      <Skeleton className="h-4 w-4/6 bg-muted" />
      <Skeleton className="h-24 w-full bg-muted rounded-lg" />
    </div>
  )
}

// ============================================================================
// ACTIVITY TYPE BADGE
// ============================================================================

function ActivityTypeBadge({ type }: { type: string }) {
  if (type === 'code_gen') return <Badge className="bg-primary text-primary-foreground border-0 text-xs"><VscCode className="w-3 h-3 mr-1" />Code Gen</Badge>
  if (type === 'security') return <Badge className="bg-[hsl(31,100%,65%)] text-black border-0 text-xs"><VscShield className="w-3 h-3 mr-1" />Security</Badge>
  if (type === 'github_push') return <Badge className="bg-[hsl(191,97%,70%)] text-black border-0 text-xs"><VscGithubInverted className="w-3 h-3 mr-1" />GitHub</Badge>
  return <Badge variant="secondary" className="text-xs">{type}</Badge>
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function Page() {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'activity' | 'settings'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Dashboard state
  const [apiSpec, setApiSpec] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Python', 'Node.js'])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationPhase, setGenerationPhase] = useState('')
  const [integrationResult, setIntegrationResult] = useState<IntegrationResult | null>(null)
  const [outputTab, setOutputTab] = useState('code')

  // GitHub push state
  const [githubOpen, setGithubOpen] = useState(false)
  const [githubForm, setGithubForm] = useState({ repo: '', branch: 'main', commitMessage: '', filePath: 'integrations/' })
  const [createIssues, setCreateIssues] = useState(true)
  const [isPushing, setIsPushing] = useState(false)
  const [githubResult, setGithubResult] = useState<GitHubResult | null>(null)

  // Sample data toggle
  const [showSample, setShowSample] = useState(false)

  // Status messages
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])

  // Activity log
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activityFilter, setActivityFilter] = useState<string>('all')
  const [activitySearch, setActivitySearch] = useState('')

  // Settings
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // Agent status
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Refs for unique IDs
  const statusIdRef = useRef(0)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedActivities = localStorage.getItem('api-assistant-activities')
      if (savedActivities) {
        const parsed = JSON.parse(savedActivities)
        if (Array.isArray(parsed)) setActivities(parsed)
      }
    } catch { /* ignore */ }
    try {
      const savedSettings = localStorage.getItem('api-assistant-settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        if (parsed && typeof parsed === 'object') setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }
    } catch { /* ignore */ }
  }, [])

  // Persist activities
  useEffect(() => {
    try {
      localStorage.setItem('api-assistant-activities', JSON.stringify(activities))
    } catch { /* ignore */ }
  }, [activities])

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('api-assistant-settings', JSON.stringify(settings))
    } catch { /* ignore */ }
  }, [settings])

  // Handle sample data toggle
  useEffect(() => {
    if (showSample) {
      setApiSpec(SAMPLE_API_SPEC)
      setIntegrationResult(SAMPLE_RESULT)
      setGithubResult(SAMPLE_GITHUB_RESULT)
      setActivities(SAMPLE_ACTIVITIES)
      setSelectedLanguages(['Python', 'Node.js'])
      setGithubForm({ repo: 'acme/api-integrations', branch: 'feat/payment-gateway', commitMessage: 'feat: Add Payment Gateway integration', filePath: 'integrations/' })
    } else {
      setApiSpec('')
      setIntegrationResult(null)
      setGithubResult(null)
      setActivities([])
      setGithubForm({ repo: settings.defaultRepo, branch: settings.defaultBranch || 'main', commitMessage: '', filePath: 'integrations/' })
    }
  }, [showSample])

  // Add status message
  const addStatus = useCallback((type: StatusMessage['type'], title: string, message: string) => {
    statusIdRef.current += 1
    const id = `status-${statusIdRef.current}`
    setStatusMessages(prev => [...prev, { id, type, title, message }])
  }, [])

  const dismissStatus = useCallback((id: string) => {
    setStatusMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  // Add activity
  const addActivity = useCallback((type: ActivityItem['type'], summary: string, details: string) => {
    const item: ActivityItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: new Date().toISOString(),
      summary,
      details
    }
    setActivities(prev => [item, ...prev])
  }, [])

  // Toggle language
  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    )
  }

  // Generate integration
  const handleGenerate = async () => {
    if (!apiSpec.trim()) {
      addStatus('error', 'Missing Input', 'Please enter an API specification or describe your integration.')
      return
    }
    if (selectedLanguages.length === 0) {
      addStatus('error', 'No Languages', 'Please select at least one target language.')
      return
    }

    setIsGenerating(true)
    setIntegrationResult(null)
    setGithubResult(null)
    setOutputTab('code')

    try {
      setGenerationPhase('Analyzing API specification...')
      setActiveAgentId(MANAGER_AGENT_ID)

      const message = `Analyze the following API specification and generate integration code, security analysis, and documentation.\n\nTarget Languages: ${selectedLanguages.join(', ')}\n\nAPI Specification:\n${apiSpec}`

      setGenerationPhase('Generating code... Analyzing security... Writing docs...')
      const result = await callAIAgent(message, MANAGER_AGENT_ID)

      if (result.success) {
        const rawData = result?.response?.result
        const parsed = deepParseJSON(rawData) as Record<string, unknown> | null

        if (parsed && typeof parsed === 'object') {
          const ir: IntegrationResult = {
            code_output: (parsed.code_output ?? null) as CodeOutput,
            security_output: (parsed.security_output ?? null) as SecurityOutput,
            documentation_output: (parsed.documentation_output ?? null) as DocumentationOutput,
            integration_summary: (parsed.integration_summary as string) ?? '',
            readiness_assessment: (parsed.readiness_assessment as string) ?? ''
          }
          setIntegrationResult(ir)
          addStatus('success', 'Integration Generated', ir.integration_summary || 'Code, security analysis, and documentation generated successfully.')
          addActivity('code_gen', `Generated integration for ${selectedLanguages.join(', ')}`, ir.integration_summary || '')
          const findings = Array.isArray((ir.security_output as SecurityOutput)?.findings) ? (ir.security_output as SecurityOutput).findings : []
          if (findings.length > 0) {
            addActivity('security', `Security analysis: ${findings.length} finding(s)`, (ir.security_output as SecurityOutput)?.summary || '')
          }
        } else {
          addStatus('info', 'Response Received', 'The agent returned a response. Check the output tabs.')
          const textResult = typeof rawData === 'string' ? rawData : JSON.stringify(rawData)
          setIntegrationResult({
            code_output: { code_snippets: [], dependencies: [], usage_notes: textResult, authentication_type: '' },
            security_output: { findings: [], risk_score: '', alert_rules: [], summary: '' },
            documentation_output: { documentation: textResult, endpoints: [], getting_started: '', changelog_entry: '', troubleshooting: '' },
            integration_summary: textResult,
            readiness_assessment: ''
          })
        }
      } else {
        addStatus('error', 'Generation Failed', result?.error ?? 'Unknown error occurred.')
      }
    } catch (err) {
      addStatus('error', 'Error', err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsGenerating(false)
      setGenerationPhase('')
      setActiveAgentId(null)
    }
  }

  // Push to GitHub
  const handleGitHubPush = async () => {
    if (!githubForm.repo.trim()) {
      addStatus('error', 'Missing Repository', 'Please enter a repository name (owner/repo).')
      return
    }
    if (!integrationResult) {
      addStatus('error', 'No Integration', 'Generate an integration first before pushing to GitHub.')
      return
    }

    setIsPushing(true)
    setGithubResult(null)

    try {
      setActiveAgentId(GITHUB_AGENT_ID)

      const codeOutput = integrationResult.code_output
      const securityFindings = createIssues && integrationResult.security_output ? integrationResult.security_output.findings : []
      const docsOutput = integrationResult.documentation_output

      const message = `Push the following integration outputs to GitHub repository ${githubForm.repo} on branch ${githubForm.branch}.\n\nCommit Message: ${githubForm.commitMessage || 'feat: Add API integration'}\n\nFile Path: ${githubForm.filePath}\n\nCode to push:\n${JSON.stringify(codeOutput)}\n\nSecurity findings to create issues for:\n${JSON.stringify(securityFindings)}\n\nDocumentation to update:\n${JSON.stringify(docsOutput)}`

      const result = await callAIAgent(message, GITHUB_AGENT_ID)

      if (result.success) {
        const rawData = result?.response?.result
        const parsed = deepParseJSON(rawData) as Record<string, unknown> | null

        if (parsed && typeof parsed === 'object') {
          const gr: GitHubResult = {
            actions_taken: Array.isArray(parsed.actions_taken) ? parsed.actions_taken as GitHubAction[] : [],
            issues_created: Array.isArray(parsed.issues_created) ? parsed.issues_created as GitHubIssue[] : [],
            pull_request: (parsed.pull_request as GitHubPullRequest) ?? { title: '', url: '', branch: '', files_changed: 0 },
            summary: (parsed.summary as string) ?? '',
            errors: Array.isArray(parsed.errors) ? parsed.errors as string[] : []
          }
          setGithubResult(gr)
          addStatus('success', 'Pushed to GitHub', gr.summary || 'Code successfully pushed to GitHub.')
          addActivity('github_push', `Pushed to ${githubForm.repo}`, gr.summary || '')
        } else {
          addStatus('info', 'GitHub Response', 'The GitHub agent returned a response.')
        }
      } else {
        addStatus('error', 'GitHub Push Failed', result?.error ?? 'Failed to push to GitHub.')
      }
    } catch (err) {
      addStatus('error', 'Error', err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPushing(false)
      setActiveAgentId(null)
    }
  }

  // ============================================================================
  // RENDER: SIDEBAR
  // ============================================================================

  function renderSidebar() {
    const navItems = [
      { id: 'dashboard' as const, label: 'Dashboard', icon: VscDashboard },
      { id: 'activity' as const, label: 'Activity Log', icon: VscHistory },
      { id: 'settings' as const, label: 'Settings', icon: VscGear }
    ]

    return (
      <div className={cn('flex flex-col bg-[hsl(231,18%,12%)] border-r border-border transition-all duration-300 shrink-0', sidebarOpen ? 'w-56' : 'w-14')}>
        <div className="flex items-center justify-between p-3 border-b border-border h-14">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <BsLightningCharge className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold tracking-tight text-foreground">API Assist</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
            {sidebarOpen ? <FiChevronLeft className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setCurrentScreen(item.id)} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200', currentScreen === item.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="p-3 border-t border-border">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Agents</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', activeAgentId === MANAGER_AGENT_ID ? 'bg-[hsl(135,94%,60%)] animate-pulse' : 'bg-muted-foreground/40')} />
                  <span className="text-[11px] text-muted-foreground truncate">Integration Orchestrator</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', activeAgentId === GITHUB_AGENT_ID ? 'bg-[hsl(135,94%,60%)] animate-pulse' : 'bg-muted-foreground/40')} />
                  <span className="text-[11px] text-muted-foreground truncate">GitHub Agent</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER: HEADER
  // ============================================================================

  function renderHeader() {
    return (
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 p-0 md:hidden text-muted-foreground">
            <FiMenu className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-semibold tracking-tight text-foreground">API Integration Assistant</h1>
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">v1.0</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
          <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
        </div>
      </header>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD - INPUT PANEL
  // ============================================================================

  function renderInputPanel() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold tracking-tight text-foreground mb-1">API Specification</h2>
          <p className="text-xs text-muted-foreground">Paste your OpenAPI spec or describe the API integration</p>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <Textarea value={apiSpec} onChange={(e) => setApiSpec(e.target.value)} placeholder="Paste your OpenAPI/Swagger spec, endpoint URL, or describe your API integration..." className="min-h-[280px] font-mono text-xs bg-input border-border resize-none leading-relaxed" />

          <div>
            <Label className="text-xs font-medium text-foreground mb-2 block">Target Languages</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_LANGUAGES.map(lang => (
                <button key={lang} onClick={() => toggleLanguage(lang)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border', selectedLanguages.includes(lang) ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground')}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating || !apiSpec.trim() || selectedLanguages.length === 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 h-10">
            {isGenerating ? (
              <>
                <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <BsLightningCharge className="w-4 h-4 mr-2" />
                <span>Generate Integration</span>
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD - OUTPUT PANEL (CODE TAB)
  // ============================================================================

  function renderCodeTab() {
    const codeOutput = integrationResult?.code_output
    const snippets = Array.isArray(codeOutput?.code_snippets) ? codeOutput.code_snippets : []
    const deps = Array.isArray(codeOutput?.dependencies) ? codeOutput.dependencies : []

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {snippets.length === 0 && !codeOutput?.usage_notes && (
            <div className="text-center py-8 text-muted-foreground">
              <VscCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No code snippets generated yet</p>
            </div>
          )}

          {snippets.map((snippet, idx) => (
            <CodeBlock key={idx} code={snippet.code ?? ''} language={snippet.language ?? ''} filename={snippet.filename ?? ''} description={snippet.description ?? ''} />
          ))}

          {deps.length > 0 && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {deps.map((dep, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">{dep.language ?? ''}</Badge>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(dep.packages) && dep.packages.map((pkg, pidx) => (
                          <code key={pidx} className="text-xs font-mono px-2 py-0.5 bg-secondary rounded text-[hsl(135,94%,60%)]">{pkg}</code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {codeOutput?.usage_notes && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Usage Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderMarkdown(codeOutput.usage_notes)}
              </CardContent>
            </Card>
          )}

          {codeOutput?.authentication_type && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auth Type:</span>
              <Badge variant="secondary" className="text-xs">{codeOutput.authentication_type}</Badge>
            </div>
          )}

          <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={isGenerating} className="mt-2">
            <FiRefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate Code
          </Button>
        </div>
      </ScrollArea>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD - OUTPUT PANEL (SECURITY TAB)
  // ============================================================================

  function renderSecurityTab() {
    const secOutput = integrationResult?.security_output
    const findings = Array.isArray(secOutput?.findings) ? secOutput.findings : []
    const alertRules = Array.isArray(secOutput?.alert_rules) ? secOutput.alert_rules : []

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {!secOutput?.summary && findings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <VscShield className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No security analysis yet</p>
            </div>
          )}

          {secOutput?.summary && (
            <Card className="bg-card border-border shadow-lg">
              <CardContent className="p-4">
                {renderMarkdown(secOutput.summary)}
              </CardContent>
            </Card>
          )}

          {secOutput?.risk_score && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">Risk Score</span>
              <Badge className="bg-[hsl(31,100%,65%)] text-black border-0 text-sm font-bold px-3 py-1">{secOutput.risk_score}</Badge>
            </div>
          )}

          {findings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Findings ({findings.length})</h3>
              <Accordion type="multiple" className="space-y-2">
                {findings.map((finding, idx) => (
                  <AccordionItem key={finding.id ?? idx} value={finding.id ?? `finding-${idx}`} className="border border-border rounded-lg bg-card shadow-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/50">
                      <div className="flex items-center gap-3 text-left">
                        <SeverityBadge severity={finding.severity ?? ''} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{finding.title ?? 'Untitled'}</p>
                          <p className="text-[11px] text-muted-foreground">{finding.category ?? ''}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {finding.description && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Description</p>
                            <p className="text-sm text-foreground">{finding.description}</p>
                          </div>
                        )}
                        {finding.evidence && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Evidence</p>
                            <code className="text-xs font-mono block bg-secondary rounded px-3 py-2 text-[hsl(191,97%,70%)]">{finding.evidence}</code>
                          </div>
                        )}
                        {finding.remediation && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Remediation</p>
                            <p className="text-sm text-[hsl(135,94%,60%)]">{finding.remediation}</p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {alertRules.length > 0 && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Alert Rules</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {alertRules.map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                      <SeverityBadge severity={rule.severity ?? ''} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{rule.name ?? ''}</p>
                        <p className="text-xs text-muted-foreground">Condition: {rule.condition ?? ''}</p>
                        <p className="text-xs text-muted-foreground">Action: {rule.action ?? ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={isGenerating} className="mt-2">
            <FiRefreshCw className="w-3.5 h-3.5 mr-1.5" />Re-analyze
          </Button>
        </div>
      </ScrollArea>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD - OUTPUT PANEL (DOCS TAB)
  // ============================================================================

  function renderDocsTab() {
    const docsOutput = integrationResult?.documentation_output
    const endpoints = Array.isArray(docsOutput?.endpoints) ? docsOutput.endpoints : []

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {!docsOutput?.documentation && endpoints.length === 0 && !docsOutput?.getting_started && (
            <div className="text-center py-8 text-muted-foreground">
              <VscBook className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No documentation generated yet</p>
            </div>
          )}

          {docsOutput?.documentation && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Documentation</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderMarkdown(docsOutput.documentation)}
              </CardContent>
            </Card>
          )}

          {endpoints.length > 0 && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs text-muted-foreground">Method</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Path</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Description</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Parameters</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {endpoints.map((ep, idx) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell>
                            <Badge className={cn('text-[10px] border-0 font-bold', (ep.method ?? '').toUpperCase() === 'GET' ? 'bg-[hsl(135,94%,60%)] text-black' : (ep.method ?? '').toUpperCase() === 'POST' ? 'bg-primary text-primary-foreground' : (ep.method ?? '').toUpperCase() === 'PUT' ? 'bg-[hsl(31,100%,65%)] text-black' : (ep.method ?? '').toUpperCase() === 'DELETE' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground')}>
                              {(ep.method ?? '').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[hsl(191,97%,70%)]">{ep.path ?? ''}</TableCell>
                          <TableCell className="text-xs">{ep.description ?? ''}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{ep.parameters ?? ''}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">{ep.response_schema ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {docsOutput?.getting_started && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderMarkdown(docsOutput.getting_started)}
              </CardContent>
            </Card>
          )}

          {docsOutput?.changelog_entry && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Changelog</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderMarkdown(docsOutput.changelog_entry)}
              </CardContent>
            </Card>
          )}

          {docsOutput?.troubleshooting && (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Troubleshooting</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderMarkdown(docsOutput.troubleshooting)}
              </CardContent>
            </Card>
          )}

          <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={isGenerating} className="mt-2">
            <FiRefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate Docs
          </Button>
        </div>
      </ScrollArea>
    )
  }

  // ============================================================================
  // RENDER: GITHUB PUSH BAR
  // ============================================================================

  function renderGitHubPush() {
    if (!integrationResult) return null

    return (
      <Collapsible open={githubOpen} onOpenChange={setGithubOpen} className="border-t border-border">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2">
              <VscGithubInverted className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">Push to GitHub</span>
            </div>
            {githubOpen ? <FiChevronUp className="w-4 h-4 text-muted-foreground" /> : <FiChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-3 bg-card/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Repository (owner/repo)</Label>
                <Input value={githubForm.repo} onChange={(e) => setGithubForm(prev => ({ ...prev, repo: e.target.value }))} placeholder="acme/api-integrations" className="bg-input border-border text-sm h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Branch</Label>
                <Input value={githubForm.branch} onChange={(e) => setGithubForm(prev => ({ ...prev, branch: e.target.value }))} placeholder="main" className="bg-input border-border text-sm h-9" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Commit Message</Label>
                <Input value={githubForm.commitMessage} onChange={(e) => setGithubForm(prev => ({ ...prev, commitMessage: e.target.value }))} placeholder="feat: Add API integration" className="bg-input border-border text-sm h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">File Path</Label>
                <Input value={githubForm.filePath} onChange={(e) => setGithubForm(prev => ({ ...prev, filePath: e.target.value }))} placeholder="integrations/" className="bg-input border-border text-sm h-9" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="create-issues" checked={createIssues} onCheckedChange={(checked) => setCreateIssues(checked === true)} />
              <Label htmlFor="create-issues" className="text-xs text-muted-foreground cursor-pointer">Create issues for security findings</Label>
            </div>

            <Button onClick={handleGitHubPush} disabled={isPushing || !githubForm.repo.trim()} className="bg-secondary text-foreground hover:bg-secondary/80 border border-border h-9">
              {isPushing ? (
                <>
                  <FiLoader className="w-3.5 h-3.5 mr-1.5 animate-spin" />Pushing...
                </>
              ) : (
                <>
                  <FiSend className="w-3.5 h-3.5 mr-1.5" />Push to GitHub
                </>
              )}
            </Button>

            {githubResult && (
              <div className="space-y-2 mt-3">
                {githubResult.summary && (
                  <Alert className="border-[hsl(135,94%,60%)]/50">
                    <FiCheck className="w-4 h-4 text-[hsl(135,94%,60%)]" />
                    <AlertTitle className="text-sm">Success</AlertTitle>
                    <AlertDescription className="text-xs">{githubResult.summary}</AlertDescription>
                  </Alert>
                )}

                {Array.isArray(githubResult.errors) && githubResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <FiAlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Errors</AlertTitle>
                    <AlertDescription className="text-xs">{githubResult.errors.join(', ')}</AlertDescription>
                  </Alert>
                )}

                {Array.isArray(githubResult.actions_taken) && githubResult.actions_taken.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</p>
                    {githubResult.actions_taken.map((action, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" className="text-[10px]">{action.type ?? ''}</Badge>
                        <span className="text-foreground flex-1 truncate">{action.description ?? ''}</span>
                        {action.url && (
                          <a href={action.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                            <FiExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {action.status && <Badge className={cn('text-[10px] border-0', action.status === 'success' ? 'bg-[hsl(135,94%,60%)]/20 text-[hsl(135,94%,60%)]' : 'bg-destructive/20 text-destructive')}>{action.status}</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(githubResult.issues_created) && githubResult.issues_created.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Issues Created</p>
                    {githubResult.issues_created.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <SeverityBadge severity={issue.severity ?? ''} />
                        <span className="text-foreground flex-1 truncate">{issue.title ?? ''}</span>
                        <span className="text-muted-foreground">#{issue.number ?? 0}</span>
                        {issue.url && (
                          <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                            <FiExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {githubResult.pull_request?.url && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pull Request</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">PR</Badge>
                      <span className="text-foreground flex-1 truncate">{githubResult.pull_request.title ?? ''}</span>
                      <span className="text-muted-foreground">{githubResult.pull_request.files_changed ?? 0} files</span>
                      <a href={githubResult.pull_request.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                        <FiExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD - OUTPUT PANEL
  // ============================================================================

  function renderOutputPanel() {
    const hasResult = integrationResult !== null

    return (
      <div className="flex flex-col h-full">
        {isGenerating ? (
          <OutputSkeleton phase={generationPhase} />
        ) : !hasResult ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="bg-card border-border shadow-xl max-w-sm w-full">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <BsFileEarmarkCode className="w-5 h-5 text-primary" />
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[hsl(31,100%,65%)]/15 flex items-center justify-center">
                    <BsShieldCheck className="w-5 h-5 text-[hsl(31,100%,65%)]" />
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[hsl(191,97%,70%)]/15 flex items-center justify-center">
                    <HiOutlineDocumentText className="w-5 h-5 text-[hsl(191,97%,70%)]" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Get Started</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Paste an API spec or describe your integration to generate code, security analysis, and documentation.</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Summary bar */}
            {(integrationResult?.integration_summary || integrationResult?.readiness_assessment) && (
              <div className="px-4 py-3 border-b border-border bg-secondary/20">
                {integrationResult.integration_summary && <p className="text-xs text-foreground leading-relaxed">{integrationResult.integration_summary}</p>}
                {integrationResult.readiness_assessment && <p className="text-xs text-primary font-medium mt-1">{integrationResult.readiness_assessment}</p>}
              </div>
            )}

            <Tabs value={outputTab} onValueChange={setOutputTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="mx-4 mt-3 bg-secondary/50 border border-border self-start">
                <TabsTrigger value="code" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <VscCode className="w-3.5 h-3.5" />Code
                </TabsTrigger>
                <TabsTrigger value="security" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <VscShield className="w-3.5 h-3.5" />Security
                </TabsTrigger>
                <TabsTrigger value="docs" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <VscBook className="w-3.5 h-3.5" />Docs
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0">
                <TabsContent value="code" className="h-full mt-0 data-[state=inactive]:hidden">
                  {renderCodeTab()}
                </TabsContent>
                <TabsContent value="security" className="h-full mt-0 data-[state=inactive]:hidden">
                  {renderSecurityTab()}
                </TabsContent>
                <TabsContent value="docs" className="h-full mt-0 data-[state=inactive]:hidden">
                  {renderDocsTab()}
                </TabsContent>
              </div>
            </Tabs>

            {renderGitHubPush()}
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER: DASHBOARD
  // ============================================================================

  function renderDashboard() {
    return (
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Input Panel */}
        <div className="w-full lg:w-[40%] border-b lg:border-b-0 lg:border-r border-border bg-card/50 min-h-0 lg:h-full overflow-hidden">
          {renderInputPanel()}
        </div>
        {/* Output Panel */}
        <div className="w-full lg:w-[60%] min-h-0 lg:h-full overflow-hidden flex flex-col">
          {renderOutputPanel()}
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: ACTIVITY LOG
  // ============================================================================

  function renderActivityLog() {
    const filtered = activities.filter(item => {
      if (activityFilter !== 'all' && item.type !== activityFilter) return false
      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase()
        return (item.summary ?? '').toLowerCase().includes(q) || (item.details ?? '').toLowerCase().includes(q)
      }
      return true
    })

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Activity Log</h2>
            {activities.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => { setActivities([]); addStatus('info', 'Cleared', 'Activity log cleared.') }}>
                <FiTrash2 className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} placeholder="Search activities..." className="pl-8 bg-input border-border text-sm h-9" />
            </div>
            <div className="flex gap-1">
              {[{ id: 'all', label: 'All' }, { id: 'code_gen', label: 'Code Gen' }, { id: 'security', label: 'Security' }, { id: 'github_push', label: 'GitHub' }].map(f => (
                <button key={f.id} onClick={() => setActivityFilter(f.id)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', activityFilter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <VscHistory className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{activities.length === 0 ? 'No activity yet' : 'No matching activities'}</p>
              </div>
            ) : (
              filtered.map(item => (
                <Card key={item.id} className="bg-card border-border shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <ActivityTypeBadge type={item.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.summary ?? ''}</p>
                        {item.details && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.details}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-2">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ============================================================================
  // RENDER: SETTINGS
  // ============================================================================

  function renderSettings() {
    const handleSave = () => {
      try {
        localStorage.setItem('api-assistant-settings', JSON.stringify(settings))
        addStatus('success', 'Settings Saved', 'Your preferences have been saved.')
      } catch {
        addStatus('error', 'Save Failed', 'Could not save settings.')
      }
    }

    return (
      <ScrollArea className="h-full">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight mb-1">Settings</h2>
            <p className="text-xs text-muted-foreground">Configure defaults and preferences</p>
          </div>

          {/* GitHub Configuration */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <VscGithubInverted className="w-4 h-4" />GitHub Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Default Repository</Label>
                <Input value={settings.defaultRepo} onChange={(e) => setSettings(prev => ({ ...prev, defaultRepo: e.target.value }))} placeholder="owner/repository" className="bg-input border-border text-sm h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Default Branch</Label>
                <Input value={settings.defaultBranch} onChange={(e) => setSettings(prev => ({ ...prev, defaultBranch: e.target.value }))} placeholder="main" className="bg-input border-border text-sm h-9" />
              </div>
            </CardContent>
          </Card>

          {/* Default Preferences */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <VscGear className="w-4 h-4" />Default Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Preferred Languages</Label>
                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_LANGUAGES.map(lang => (
                    <div key={lang} className="flex items-center gap-2">
                      <Checkbox id={`pref-lang-${lang}`} checked={settings.preferredLanguages.includes(lang)} onCheckedChange={(checked) => {
                        setSettings(prev => ({
                          ...prev,
                          preferredLanguages: checked ? [...prev.preferredLanguages, lang] : prev.preferredLanguages.filter(l => l !== lang)
                        }))
                      }} />
                      <Label htmlFor={`pref-lang-${lang}`} className="text-xs text-foreground cursor-pointer">{lang}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Code Style</Label>
                <div className="flex gap-4">
                  {(['async', 'sync'] as const).map(style => (
                    <div key={style} className="flex items-center gap-2">
                      <input type="radio" id={`style-${style}`} name="code-style" checked={settings.codeStyle === style} onChange={() => setSettings(prev => ({ ...prev, codeStyle: style }))} className="accent-primary" />
                      <Label htmlFor={`style-${style}`} className="text-xs text-foreground cursor-pointer capitalize">{style}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Documentation Format</Label>
                <div className="flex gap-4">
                  {(['markdown', 'html'] as const).map(fmt => (
                    <div key={fmt} className="flex items-center gap-2">
                      <input type="radio" id={`fmt-${fmt}`} name="doc-format" checked={settings.docFormat === fmt} onChange={() => setSettings(prev => ({ ...prev, docFormat: fmt }))} className="accent-primary" />
                      <Label htmlFor={`fmt-${fmt}`} className="text-xs text-foreground cursor-pointer capitalize">{fmt}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alert Rules */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4" />Alert Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Minimum Severity Threshold</Label>
                <Select value={settings.alertSeverityThreshold} onValueChange={(value) => setSettings(prev => ({ ...prev, alertSeverityThreshold: value }))}>
                  <SelectTrigger className="bg-input border-border text-sm h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Critical">Critical Only</SelectItem>
                    <SelectItem value="Warning">Warning and Above</SelectItem>
                    <SelectItem value="Info">Info and Above</SelectItem>
                    <SelectItem value="Low">All Findings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
            <FiSave className="w-3.5 h-3.5 mr-1.5" />Save Settings
          </Button>
        </div>
      </ScrollArea>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <ErrorBoundary>
      <div className="min-h-screen h-screen bg-background text-foreground flex overflow-hidden">
        {/* Sidebar */}
        {renderSidebar()}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {renderHeader()}

          {/* Status Messages */}
          {statusMessages.length > 0 && (
            <div className="px-4 pt-3 space-y-1 shrink-0">
              {statusMessages.map(msg => (
                <StatusAlert key={msg.id} msg={msg} onDismiss={dismissStatus} />
              ))}
            </div>
          )}

          {/* Screen Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {currentScreen === 'dashboard' && renderDashboard()}
            {currentScreen === 'activity' && renderActivityLog()}
            {currentScreen === 'settings' && renderSettings()}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
