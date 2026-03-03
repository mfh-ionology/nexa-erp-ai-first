'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowUp, ArrowDown, ChevronsUpDown, SearchX } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessGroups: number;
  status: 'Active' | 'Inactive';
  lastLogin: string | null;
}

type SortKey = 'name' | 'role' | 'accessGroups' | 'status' | 'lastLogin';
type SortDir = 'asc' | 'desc';

const avatarColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const roleBadgeStyles: Record<Role, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
  ADMIN: { bg: '#dbeafe', text: '#3b82f6', border: '#93c5fd' },
  MANAGER: { bg: '#d1fae5', text: '#10b981', border: '#6ee7b7' },
  STAFF: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  VIEWER: { bg: '#f3f4f6', text: '#9ca3af', border: '#e5e7eb' },
};

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  VIEWER: 'Viewer',
};

const roleOrder: Record<Role, number> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  MANAGER: 2,
  STAFF: 3,
  VIEWER: 4,
};

const users: User[] = [
  {
    id: 'u1',
    name: 'Sarah Chen',
    email: 'sarah.chen@meridian.co.uk',
    role: 'SUPER_ADMIN',
    accessGroups: 5,
    status: 'Active',
    lastLogin: '17 Feb 2026, 09:42',
  },
  {
    id: 'u2',
    name: 'Mohammed Hussein',
    email: 'm.hussein@meridian.co.uk',
    role: 'ADMIN',
    accessGroups: 4,
    status: 'Active',
    lastLogin: '17 Feb 2026, 08:15',
  },
  {
    id: 'u3',
    name: 'Emily Thompson',
    email: 'e.thompson@meridian.co.uk',
    role: 'ADMIN',
    accessGroups: 3,
    status: 'Active',
    lastLogin: '16 Feb 2026, 17:30',
  },
  {
    id: 'u4',
    name: 'David Mitchell',
    email: 'd.mitchell@meridian.co.uk',
    role: 'MANAGER',
    accessGroups: 2,
    status: 'Active',
    lastLogin: '16 Feb 2026, 14:22',
  },
  {
    id: 'u5',
    name: 'Priya Sharma',
    email: 'p.sharma@meridian.co.uk',
    role: 'MANAGER',
    accessGroups: 2,
    status: 'Active',
    lastLogin: '15 Feb 2026, 11:45',
  },
  {
    id: 'u6',
    name: 'James Wilson',
    email: 'j.wilson@meridian.co.uk',
    role: 'STAFF',
    accessGroups: 1,
    status: 'Active',
    lastLogin: '14 Feb 2026, 09:10',
  },
  {
    id: 'u7',
    name: 'Olivia Brown',
    email: 'o.brown@meridian.co.uk',
    role: 'STAFF',
    accessGroups: 1,
    status: 'Inactive',
    lastLogin: '3 Jan 2026, 16:55',
  },
  {
    id: 'u8',
    name: 'Robert Taylor',
    email: 'r.taylor@meridian.co.uk',
    role: 'VIEWER',
    accessGroups: 0,
    status: 'Inactive',
    lastLogin: null,
  },
];

function SortIndicator({
  sortKey,
  sortDir,
  column,
}: {
  sortKey: SortKey | null;
  sortDir: SortDir;
  column: SortKey;
}) {
  if (sortKey === column && sortDir === 'asc')
    return <ArrowUp className="ml-1 h-3.5 w-3.5 text-foreground" />;
  if (sortKey === column && sortDir === 'desc')
    return <ArrowDown className="ml-1 h-3.5 w-3.5 text-foreground" />;
  return (
    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  );
}

export function UsersTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = users;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'name':
            cmp = a.name.localeCompare(b.name);
            break;
          case 'role':
            cmp = roleOrder[a.role] - roleOrder[b.role];
            break;
          case 'accessGroups':
            cmp = a.accessGroups - b.accessGroups;
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
          case 'lastLogin':
            cmp = (a.lastLogin || '').localeCompare(b.lastLogin || '');
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [searchQuery, sortKey, sortDir]);

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Users</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1
        className="mb-6 animate-fade-in-up font-serif text-3xl font-bold text-foreground"
        style={{ animationDelay: '50ms' }}
      >
        Users
      </h1>

      <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '150ms' }}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Name
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="name" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => toggleSort('role')}
                >
                  Role
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="role" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => toggleSort('accessGroups')}
                >
                  Access Groups
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="accessGroups" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => toggleSort('status')}
                >
                  Status
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="status" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => toggleSort('lastLogin')}
                >
                  Last Login
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="lastLogin" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                      <SearchX className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/50"
                  tabIndex={0}
                  role="link"
                  aria-label={`View ${user.name}`}
                >
                  <TableCell className="px-4 py-3.5">
                    <Link
                      href={`/users/${user.id === 'u1' ? 'sarah-chen' : user.id}`}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: getAvatarColor(user.name) }}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {(() => {
                      const style = roleBadgeStyles[user.role];
                      return (
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: style.bg,
                            color: style.text,
                            borderColor: style.border,
                          }}
                        >
                          {roleLabels[user.role]}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        user.accessGroups > 0
                          ? 'bg-[#ede9fe] text-[#7c3aed]'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {user.accessGroups}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.status === 'Active' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          user.status === 'Active' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {user.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <span
                      className={`text-sm ${
                        user.lastLogin ? 'text-foreground' : 'text-muted-foreground/50'
                      }`}
                    >
                      {user.lastLogin || 'Never'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <p className="text-xs text-muted-foreground">
          {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'record' : 'records'}
        </p>
      </div>
    </div>
  );
}
