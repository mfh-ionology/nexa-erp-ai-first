'use client';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Download, Upload } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Company Profile</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">Company Profile</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border text-foreground hover:bg-[#f5f3ff]">
            <Download className="h-4 w-4" />
            Export Config
          </Button>
          <Button variant="outline" className="border-border text-foreground hover:bg-[#f5f3ff]">
            <Upload className="h-4 w-4" />
            Import Config
          </Button>
        </div>
      </div>

      {/* Settings Form */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '100ms' }}
      >
        {/* Company Information */}
        <div className="mb-6">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            Company Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input id="company-name" defaultValue="Meridian Manufacturing Ltd" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-number">Registration Number</Label>
              <Input id="reg-number" defaultValue="08123456" className="font-mono" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="vat-number">VAT Number</Label>
              <Input id="vat-number" defaultValue="GB 123 4567 89" className="font-mono max-w-sm" />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Address */}
        <div className="mb-6">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">Address</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="address1">Address Line 1</Label>
              <Input id="address1" defaultValue="Unit 5, Riverside Business Park" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address2">Address Line 2</Label>
              <Input id="address2" defaultValue="Thames Road" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" defaultValue="Manchester" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" defaultValue="M1 5QP" className="font-mono max-w-[200px]" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country</Label>
              <Select defaultValue="gb">
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gb">United Kingdom</SelectItem>
                  <SelectItem value="ie">Ireland</SelectItem>
                  <SelectItem value="fr">France</SelectItem>
                  <SelectItem value="de">Germany</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Financial Settings */}
        <div className="mb-6">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            Financial Settings
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Base Currency</Label>
              <Select defaultValue="gbp">
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gbp">{'GBP \u2014 British Pound'}</SelectItem>
                  <SelectItem value="eur">{'EUR \u2014 Euro'}</SelectItem>
                  <SelectItem value="usd">{'USD \u2014 US Dollar'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fy-start">Financial Year Start</Label>
              <Select defaultValue="april">
                <SelectTrigger id="fy-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="january">January</SelectItem>
                  <SelectItem value="april">April</SelectItem>
                  <SelectItem value="july">July</SelectItem>
                  <SelectItem value="october">October</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-terms">Default Payment Terms</Label>
              <Select defaultValue="net30">
                <SelectTrigger id="payment-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net15">NET15</SelectItem>
                  <SelectItem value="net30">NET30</SelectItem>
                  <SelectItem value="net45">NET45</SelectItem>
                  <SelectItem value="net60">NET60</SelectItem>
                  <SelectItem value="due-receipt">Due on Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-[#f5f3ff]"
          >
            Reset to Defaults
          </Button>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
