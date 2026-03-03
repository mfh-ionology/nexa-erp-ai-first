'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, RotateCcw, Shield, Globe, Database, AlertTriangle } from 'lucide-react';

export default function PlatformSettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [enforceSSO, setEnforceSSO] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1e1b4b]">Platform Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Global configuration for the Nexa ERP platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border bg-white text-[#1e1b4b] hover:bg-[#f5f3ff]"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* General */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1e1b4b]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f3ff]">
              <Globe className="h-4 w-4 text-[#7c3aed]" />
            </div>
            General
          </CardTitle>
          <CardDescription>Core platform identity and branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Platform Name</Label>
              <Input defaultValue="Nexa ERP" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Support Email</Label>
              <Input defaultValue="support@nexa-erp.co.uk" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Default Timezone</Label>
              <Select defaultValue="europe-london">
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                  <SelectItem value="us-eastern">US/Eastern (EST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Default Language</Label>
              <Select defaultValue="en-gb">
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-gb">English (UK)</SelectItem>
                  <SelectItem value="en-us">English (US)</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1e1b4b]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f3ff]">
              <Shield className="h-4 w-4 text-[#7c3aed]" />
            </div>
            Security
          </CardTitle>
          <CardDescription>Authentication and access control settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-[#1e1b4b]">Enforce SSO for all tenants</p>
              <p className="text-xs text-muted-foreground">
                Require SAML/OIDC single sign-on for all tenant users
              </p>
            </div>
            <Switch checked={enforceSSO} onCheckedChange={setEnforceSSO} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Session Timeout (minutes)</Label>
              <Input type="number" defaultValue="480" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Max Login Attempts</Label>
              <Input type="number" defaultValue="5" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-[#1e1b4b]">New Tenant Signups</p>
              <p className="text-xs text-muted-foreground">
                Allow new organisations to self-register
              </p>
            </div>
            <Switch checked={signupsEnabled} onCheckedChange={setSignupsEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1e1b4b]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f3ff]">
              <Database className="h-4 w-4 text-[#7c3aed]" />
            </div>
            AI Configuration
          </CardTitle>
          <CardDescription>Global AI model and usage settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-[#1e1b4b]">AI Features Enabled</p>
              <p className="text-xs text-muted-foreground">
                Global kill-switch for all AI functionality platform-wide
              </p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Default Model</Label>
              <Select defaultValue="gpt-4o">
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-3.5">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="llama-3.3">Llama 3.3 70B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e1b4b]">Global Token Limit (monthly)</Label>
              <Input type="number" defaultValue="10000000" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-[#ef4444]/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1e1b4b]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fee2e2]">
              <AlertTriangle className="h-4 w-4 text-[#ef4444]" />
            </div>
            Danger Zone
          </CardTitle>
          <CardDescription>Potentially destructive platform-wide actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-[#ef4444]/20 bg-[#fee2e2]/10 p-4">
            <div>
              <p className="text-sm font-medium text-[#1e1b4b]">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Blocks all tenant access. Only platform admins can log in.
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
              className="data-[state=checked]:bg-[#ef4444]"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#1e1b4b]">Purge All Caches</p>
              <p className="text-xs text-muted-foreground">
                Clear Redis, CDN, and application caches globally
              </p>
            </div>
            <Button
              variant="outline"
              className="border-[#ef4444]/30 text-[#ef4444] hover:bg-[#fee2e2]/30 hover:text-[#ef4444]"
            >
              Purge Caches
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
