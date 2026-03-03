'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import {
  BookOpen,
  Search,
  Upload,
  FileText,
  Database,
  Globe,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Eye,
} from 'lucide-react';

/* ── Types ── */
interface KnowledgeSource {
  id: string;
  name: string;
  type: 'Document' | 'Database' | 'API' | 'Web';
  status: 'Indexed' | 'Indexing' | 'Error' | 'Pending';
  documents: number;
  chunks: number;
  lastSync: string;
  autoSync: boolean;
  size: string;
}

interface SearchResult {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata: string;
}

/* ── Data ── */
const sources: KnowledgeSource[] = [
  {
    id: 's1',
    name: 'Company Policies',
    type: 'Document',
    status: 'Indexed',
    documents: 24,
    chunks: 1842,
    lastSync: '2h ago',
    autoSync: false,
    size: '12 MB',
  },
  {
    id: 's2',
    name: 'Product Catalog',
    type: 'Database',
    status: 'Indexed',
    documents: 156,
    chunks: 4210,
    lastSync: '15m ago',
    autoSync: true,
    size: '34 MB',
  },
  {
    id: 's3',
    name: 'Vendor Contracts',
    type: 'Document',
    status: 'Indexed',
    documents: 42,
    chunks: 3100,
    lastSync: '1d ago',
    autoSync: false,
    size: '28 MB',
  },
  {
    id: 's4',
    name: 'Industry Regulations',
    type: 'Web',
    status: 'Indexing',
    documents: 18,
    chunks: 890,
    lastSync: 'Syncing...',
    autoSync: true,
    size: '8 MB',
  },
  {
    id: 's5',
    name: 'Historical Transactions',
    type: 'Database',
    status: 'Indexed',
    documents: 12400,
    chunks: 52000,
    lastSync: '30m ago',
    autoSync: true,
    size: '420 MB',
  },
  {
    id: 's6',
    name: 'Training Materials',
    type: 'Document',
    status: 'Error',
    documents: 8,
    chunks: 0,
    lastSync: 'Failed',
    autoSync: false,
    size: '6 MB',
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  Document: <FileText className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
  API: <Globe className="h-4 w-4" />,
  Web: <Globe className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  Document: 'bg-[#ede9fe] text-[#5b21b6]',
  Database: 'bg-[#dbeafe] text-[#1e40af]',
  API: 'bg-[#d1fae5] text-[#065f46]',
  Web: 'bg-[#fef3c7] text-[#92400e]',
};

const statusConfig: Record<string, { color: string; dot: string }> = {
  Indexed: { color: 'text-[#065f46]', dot: 'bg-[#10b981]' },
  Indexing: { color: 'text-[#1e40af]', dot: 'bg-[#3b82f6]' },
  Error: { color: 'text-[#991b1b]', dot: 'bg-[#ef4444]' },
  Pending: { color: 'text-muted-foreground', dot: 'bg-[#9ca3af]' },
};

const sampleResults: SearchResult[] = [
  {
    id: 'r1',
    content:
      'Net 30 payment terms apply to all new domestic customers unless a credit check indicates higher risk...',
    source: 'Company Policies',
    score: 0.94,
    metadata: 'policy-012.pdf, page 3',
  },
  {
    id: 'r2',
    content:
      'Standard VAT rate for professional services is 20%. Exemptions require proof of charitable status...',
    source: 'Company Policies',
    score: 0.89,
    metadata: 'vat-guide.pdf, page 7',
  },
  {
    id: 'r3',
    content: 'Vendor payment terms must not exceed Net 60 without CFO approval...',
    source: 'Vendor Contracts',
    score: 0.82,
    metadata: 'procurement-policy.pdf, page 12',
  },
];

/* ── Stats ── */
const stats = [
  { label: 'Sources', value: sources.length.toString(), icon: Database, color: '#7c3aed' },
  { label: 'Documents', value: '12.6k', icon: FileText, color: '#3b82f6' },
  { label: 'Chunks', value: '62k', icon: BookOpen, color: '#10b981' },
  { label: 'Total Size', value: '508 MB', icon: Globe, color: '#f59e0b' },
];

/* ── Page ── */
export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const [semanticSearch, setSemanticSearch] = useState('');
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);

  const filteredSources = useMemo(() => {
    if (!search) return sources;
    const s = search.toLowerCase();
    return sources.filter(
      (src) => src.name.toLowerCase().includes(s) || src.type.toLowerCase().includes(s),
    );
  }, [search]);

  const handleSemanticSearch = () => {
    if (!semanticSearch.trim()) return;
    setSearching(true);
    setSemanticResults([]);
    setTimeout(() => {
      setSemanticResults(sampleResults);
      setSearching(false);
    }, 800);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-[#7c3aed]" />
            <span>AI &gt; Knowledge Base</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage sources, documents, and vector embeddings for AI knowledge.
          </p>
        </div>
        <Button size="sm" className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Add Source
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="sources">
        <TabsList className="mb-4 rounded-lg border border-border bg-secondary/50 p-1">
          <TabsTrigger
            value="sources"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Sources
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Semantic Search
          </TabsTrigger>
        </TabsList>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg pl-9 text-sm"
            />
          </div>

          <div className="space-y-3">
            {filteredSources.map((src) => {
              const sc = statusConfig[src.status];
              return (
                <div
                  key={src.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${typeColors[src.type]}`}
                      >
                        {typeIcons[src.type]}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{src.name}</h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{src.documents} docs</span>
                          <span>&middot;</span>
                          <span>{src.chunks} chunks</span>
                          <span>&middot;</span>
                          <span>{src.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${sc.color}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {src.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{src.lastSync}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-md text-xs text-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#5b21b6]"
                        onClick={() => setSelectedSource(src)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Semantic Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={'Try: "What are the standard payment terms?"'}
              value={semanticSearch}
              onChange={(e) => setSemanticSearch(e.target.value)}
              className="rounded-lg text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
            />
            <Button
              onClick={handleSemanticSearch}
              disabled={searching}
              className="shrink-0 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
              size="sm"
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {semanticResults.length > 0 && (
            <div className="space-y-3">
              {semanticResults.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-md text-[10px]">
                        {r.source}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{r.metadata}</span>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10px] font-semibold text-[#065f46]">
                      {(r.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{r.content}</p>
                </div>
              ))}
            </div>
          )}

          {semanticResults.length === 0 && !searching && (
            <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Search across all knowledge sources using natural language.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Source Detail Sheet */}
      <Sheet open={!!selectedSource} onOpenChange={(o) => !o && setSelectedSource(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif">{selectedSource?.name}</SheetTitle>
          </SheetHeader>
          {selectedSource && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Type
                  </Label>
                  <Badge className={`mt-1 rounded-md ${typeColors[selectedSource.type]}`}>
                    {selectedSource.type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </Label>
                  <p
                    className={`mt-1 text-sm font-medium ${statusConfig[selectedSource.status].color}`}
                  >
                    {selectedSource.status}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Documents
                  </Label>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {selectedSource.documents}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Chunks
                  </Label>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {selectedSource.chunks}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Size
                  </Label>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {selectedSource.size}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Last Sync
                </Label>
                <p className="mt-1 text-sm text-foreground">{selectedSource.lastSync}</p>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-foreground">Auto Sync</Label>
                <Switch
                  checked={selectedSource.autoSync}
                  className="data-[state=checked]:bg-[#7c3aed]"
                />
              </div>
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Re-index
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg text-[#991b1b] hover:bg-[#fee2e2] hover:text-[#991b1b]"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
